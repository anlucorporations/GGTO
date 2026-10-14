"""Identificador de pago (70\\*) — normalización, resolución e histórico (D-89).

Reglas cubiertas (ver `RepoTecnico/propuesta_identificador_pago.md` §2.2):

- **RN-IP-01 / DEC-IP-1**: es identificador de pago todo número que cumpla el patrón
  configurado (`configuracion.pago.serie_regex`, por defecto ``^70[0-9]{8}$``).
- **RN-IP-02 / DEC-IP-2**: cualquier otro número es **número de contacto** y se suma
  a `informacion` marcado ``[CONTACTO]``.
- **RN-IP-07**: todo número se normaliza (sin separadores ni prefijo internacional).
- **RN-IP-13 / DEC-IP-6**: una sola ficha por número (única global); el alta es
  idempotente y tolerante a concurrencia (``ON CONFLICT … DO NOTHING`` + ``SELECT``).
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from ..models import Caso, IdentificadorPago

PATRON_POR_DEFECTO = r"^70[0-9]{8}$"
REINCIDENCIA_DIAS_POR_DEFECTO = 90
RE_CONTACTO = re.compile(r"\[CONTACTO\][^\n]*")
MOTIVO_SIN_NUMERO = "SIN_NUMERO"
MOTIVO_NO_CUMPLE_PATRON = "NO_CUMPLE_PATRON"


# --------------------------------------------------------------------------- #
# Patrón configurable (DEC-IP-1)
# --------------------------------------------------------------------------- #
def patron_config(config: Mapping[str, Any] | None) -> str:
    """Patrón del identificador tomado de la configuración (o el de por defecto)."""
    valor = (config or {}).get("pago.serie_regex")
    if isinstance(valor, str) and valor.strip():
        return valor.strip().strip('"')
    return PATRON_POR_DEFECTO


def compilar_patron(config: Mapping[str, Any] | None) -> re.Pattern[str]:
    """Compila el patrón configurado; si es inválido, cae al de por defecto."""
    try:
        return re.compile(patron_config(config))
    except re.error:  # pragma: no cover - configuración corrupta
        return re.compile(PATRON_POR_DEFECTO)


def dias_reincidencia(config: Mapping[str, Any] | None) -> int:
    """Ventana (días) para marcar reincidencia (RF-54)."""
    valor = (config or {}).get("pago.reincidencia_dias")
    try:
        return int(str(valor).strip('"'))
    except (TypeError, ValueError):
        return REINCIDENCIA_DIAS_POR_DEFECTO


# --------------------------------------------------------------------------- #
# Normalización y clasificación (RN-IP-01/02/07)
# --------------------------------------------------------------------------- #
def normalizar_numero(valor: Any) -> str:
    """Deja solo dígitos y quita el prefijo internacional y el 0 inicial.

    ``+58 0414-222-3344`` → ``4142223344`` · ``0058 701-400.0848`` → ``7014000848``
    · ``0422-310-9000`` → ``4223109000``.
    """
    digitos = re.sub(r"\D", "", str(valor or ""))
    if digitos.startswith("0058"):
        digitos = digitos[4:]
    elif digitos.startswith("58") and len(digitos) >= 12:
        digitos = digitos[2:]
    if len(digitos) == 11 and digitos.startswith("0"):
        digitos = digitos[1:]
    return digitos


def es_identificador_pago(numero: str, patron: re.Pattern[str]) -> bool:
    """¿El número (ya normalizado) es un identificador de pago?"""
    return bool(numero) and patron.fullmatch(numero) is not None


@dataclass
class ClasificacionNumeros:
    """Resultado de clasificar los números de una fila del archivo (RF-46)."""

    identificador: str | None = None
    contacto_principal: str | None = None
    contactos: list[str] = field(default_factory=list)
    motivo: str | None = None

    @property
    def sin_identificador(self) -> bool:
        return self.identificador is None


def clasificar_numeros(
    fila: Mapping[str, Any], patron: re.Pattern[str]
) -> ClasificacionNumeros:
    """Separa el identificador de pago (70\\*) de los números de contacto.

    Orden de precedencia (RN-IP-01 y DEC-IP-2):

    1. el primer valor —columna 13 y, si no, columna 16— que cumpla el patrón es el
       **identificador**;
    2. los demás valores son **números de contacto**; el de la **columna 16** manda
       como contacto vigente (`contacto_cliente`).

    Las columnas 78/79 (`telefono_oficina`, `telefono_movil`) son datos del técnico
    y **no** se consideran aquí.
    """
    valores = [
        ("13", normalizar_numero(fila.get("telefono"))),
        ("16", normalizar_numero(fila.get("contacto_cliente"))),
    ]
    identificador = next(
        (n for _, n in valores if es_identificador_pago(n, patron)), None
    )
    contactos: list[str] = []
    for _columna, numero in valores:
        if not numero or numero == identificador or numero in contactos:
            continue
        if es_identificador_pago(numero, patron):
            continue
        contactos.append(numero)
    # La columna 16 manda como contacto vigente.
    if len(contactos) == 2 and valores[0][1] == contactos[0]:
        contactos.reverse()
    principal = contactos[0] if contactos else None
    motivo = None
    if identificador is None:
        motivo = MOTIVO_SIN_NUMERO if not valores[0][1] else MOTIVO_NO_CUMPLE_PATRON
    return ClasificacionNumeros(
        identificador=identificador,
        contacto_principal=principal,
        contactos=contactos,
        motivo=motivo,
    )


def componer_informacion(informacion: str | None, numeros: list[str]) -> str | None:
    """Suma los contactos al campo `informacion` sin duplicar (RN-IP-02)."""
    base = (informacion or "").strip()
    nuevos = [n for n in numeros if n and f"[CONTACTO] {n}" not in base]
    if not nuevos:
        return base or None
    linea = "[CONTACTO] " + " | ".join(nuevos)
    return f"{base}\n{linea}" if base else linea


# --------------------------------------------------------------------------- #
# Resolución del identificador (RF-45, idempotente y concurrente)
# --------------------------------------------------------------------------- #
def resolver_identificador(
    db: Session,
    numero: str,
    id_central: int,
    nombre_titular: str | None = None,
    direccion: str | None = None,
    cache: dict[str, int] | None = None,
) -> int:
    """Devuelve el `id_pago` del número, creándolo si no existe (ficha única global).

    El número se **normaliza** aquí (RN-IP-07), de modo que cualquier llamada con
    separadores o prefijo internacional apunte a la misma ficha. Usa
    ``INSERT … ON CONFLICT (numero) DO NOTHING`` seguido de ``SELECT``: dos ingestas
    simultáneas no rompen la unicidad ni crean fichas duplicadas (H-07).
    """
    if cache is not None and numero in cache:
        return cache[numero]

    numero = normalizar_numero(numero)
    db.execute(
        pg_insert(IdentificadorPago)
        .values(
            numero=numero,
            id_central=id_central,
            nombre_titular=(nombre_titular or None),
            direccion_principal=(direccion or None),
        )
        .on_conflict_do_nothing(index_elements=["numero"])
    )
    id_pago = db.scalar(
        select(IdentificadorPago.id_pago).where(IdentificadorPago.numero == numero)
    )
    if id_pago is None:  # pragma: no cover - no debería ocurrir
        raise RuntimeError(f"No se pudo resolver el identificador de pago {numero}")
    if cache is not None:
        cache[numero] = id_pago
    return int(id_pago)


def obtener_por_numero(db: Session, numero: str) -> IdentificadorPago | None:
    """Ficha del identificador por su número (normalizado)."""
    return db.scalar(
        select(IdentificadorPago).where(
            IdentificadorPago.numero == normalizar_numero(numero)
        )
    )


# --------------------------------------------------------------------------- #
# Contactos en `informacion` (RN-IP-02)
# --------------------------------------------------------------------------- #
def sumar_contacto_a_informacion(db: Session, id_caso: int, numero: str) -> None:
    """Suma un contacto a `informacion` de forma **atómica e idempotente**."""
    if not numero:
        return
    db.execute(
        text(
            """
            UPDATE caso
               SET informacion = CASE
                     WHEN coalesce(informacion, '') LIKE '%[CONTACTO] ' || :numero || '%'
                          THEN informacion
                     ELSE coalesce(informacion || E'\\n', '') || '[CONTACTO] ' || :numero
                   END,
                   contacto_cliente = coalesce(contacto_cliente, :numero)
             WHERE id_caso = :id_caso
            """
        ),
        {"numero": numero, "id_caso": id_caso},
    )


def reemplazar_contacto_en_informacion(
    db: Session, id_caso: int, numeros: list[str]
) -> None:
    """Reemplaza las marcas ``[CONTACTO]`` anteriores por las vigentes (CU-05)."""
    fila = db.execute(
        text("SELECT informacion FROM caso WHERE id_caso = :id_caso"),
        {"id_caso": id_caso},
    ).first()
    if fila is None:
        return
    limpio = RE_CONTACTO.sub("", fila[0] or "").strip()
    nuevo = componer_informacion(limpio, numeros)
    db.execute(
        text("UPDATE caso SET informacion = :informacion WHERE id_caso = :id_caso"),
        {"informacion": nuevo, "id_caso": id_caso},
    )


# --------------------------------------------------------------------------- #
# Histórico y reincidencia (RF-48, RF-54)
# --------------------------------------------------------------------------- #
def historico_por_identificador(
    db: Session, id_pago: int, limite: int = 100
) -> list[Caso]:
    """Casos enlazados al identificador, del más reciente al más antiguo."""
    return list(
        db.scalars(
            select(Caso)
            .where(Caso.id_pago == id_pago)
            .order_by(Caso.fecha_reporte.desc().nulls_last(), Caso.id_caso.desc())
            .limit(limite)
        ).all()
    )


def contar_casos(db: Session, id_pago: int, solo_vigentes: bool = False) -> int:
    """Número de casos del identificador (opcionalmente, solo los no cancelados)."""
    stmt = select(func.count()).select_from(Caso).where(Caso.id_pago == id_pago)
    if solo_vigentes:
        stmt = stmt.where(Caso.estado_actual != "CANCELADO")
    return int(db.scalar(stmt) or 0)


def reincidencia(db: Session, id_pago: int, dias: int) -> int:
    """Reportes del identificador dentro de la ventana de reincidencia (RF-54)."""
    return int(
        db.scalar(
            text(
                """
                SELECT count(*) FROM caso
                 WHERE id_pago = :id_pago
                   AND fecha_reporte >= now() - make_interval(days => :dias)
                """
            ),
            {"id_pago": id_pago, "dias": dias},
        )
        or 0
    )
