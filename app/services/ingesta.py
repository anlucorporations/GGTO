"""Parser del archivo diario `detalle_averias_gpon_<fecha>.csv`.

Reglas (RT-05 / D-27 · D-164):
- delimitador `;`
- codificación **ISO-8859-1**
- **80 columnas por posición** (estructura original) **u 81** si el archivo es
  la versión de 02/11/2026 que inserta `telefono_ip` (índice 14, después de
  `telefono`); la estructura se deduce del encabezado, así que todo el mapeo
  a partir de ahí se desplaza +1
- se descartan 21 columnas y se unifican `informacion`(31) + `informacion`(32) + `descripcion`(52)
- fechas `dd/mm/aaaa hh:mm:ss a.m./p.m.`
"""

from __future__ import annotations

import csv
import io
import re
import unicodedata
from datetime import datetime
from typing import Any

DELIMITADOR = ";"
CODIFICACION = "iso-8859-1"
COLUMNAS_ESPERADAS = 80           # estructura original (RT-05 / RT-20)
COLUMNAS_INFORMACION = (30, 31, 51)  # 0-based: cols. 31, 32 y 52 del archivo

# (campo destino, índices 0-based en el CSV, tipo)
ESPECIFICACION: tuple[tuple[str, tuple[int, ...], str], ...] = (
    ("region", (0,), "str"),
    ("estado_geografico", (1,), "str"),
    ("capital_estado", (2,), "str"),
    ("municipio", (3,), "str"),
    ("parroquia", (4,), "str"),
    ("estado_operativo", (5,), "str"),
    ("distrito", (6,), "str"),
    ("area", (7,), "str"),
    ("codigo_central", (8,), "str"),
    ("nombre_central", (9,), "str"),
    ("id_averia", (10,), "str"),
    ("telefono", (13,), "str"),
    ("fecha_reporte", (14,), "fecha"),
    ("persona_reporta", (15,), "str"),
    ("contacto_cliente", (16,), "str"),
    ("fecha_compromiso", (17,), "fecha"),
    ("fecha_cita", (18,), "fecha"),
    ("ultimo_comentario", (20,), "str"),
    ("results", (21,), "str"),
    ("asignado_a", (22,), "str"),
    ("cuadrilla_externa", (23,), "str"),
    ("estatus_origen", (26,), "str"),
    ("problema_reporte", (27,), "str"),
    ("informacion", COLUMNAS_INFORMACION, "unir"),
    ("nombre_cliente", (32,), "str"),
    ("direccion", (33,), "str"),
    ("olt", (35,), "str"),
    ("plan", (38,), "str"),
    ("slot", (39,), "str"),
    ("puerto", (40,), "str"),
    ("fat", (42,), "str"),
    ("serial", (43,), "str"),
    ("extra", (45,), "str"),
    ("area_trabajo", (46,), "str"),
    ("tipo_servicio", (49,), "str"),
    ("tipo_problema", (50,), "str"),
    ("dias_area_resolutoria", (54,), "int"),
    ("unidad_negocio", (60,), "str"),
    ("ups", (61,), "str"),
    ("codigos_gestionados_venapp", (62,), "str"),
    ("codigos_sin_gestion_venapp", (63,), "str"),
    ("reparador_principal", (64,), "str"),
    ("ayudantes", tuple(range(65, 74)), "lista"),
    ("flota_can", (74,), "str"),
    ("despacho_nombre", (75,), "str"),
    ("despacho_apellido", (76,), "str"),
    ("telefono_oficina", (77,), "str"),
    ("telefono_movil", (78,), "str"),
    ("fecha_hora_asignacion", (79,), "fecha"),
)

# Estructura de 81 columnas (D-164): el archivo nuevo inserta `telefono_ip`
# (teléfono IP/fijo del cliente) justo después de `telefono`; todo el mapeo
# a partir de la 15.ª columna se desplaza +1. Se deriva de la especificación
# original para que el contrato siga en un solo lugar.
_CORTE = next(k for k, (_, indices, _) in enumerate(ESPECIFICACION) if min(indices) >= 14)
ESPECIFICACION_81: tuple[tuple[str, tuple[int, ...], str], ...] = (
    *ESPECIFICACION[:_CORTE],
    ("telefono_ip", (14,), "str"),
    *(
        (campo, tuple(i + 1 if i >= 14 else i for i in indices), tipo)
        for campo, indices, tipo in ESPECIFICACION[_CORTE:]
    ),
)
ESTRUCTURAS: dict[int, tuple[tuple[str, tuple[int, ...], str], ...]] = {
    80: ESPECIFICACION,
    81: ESPECIFICACION_81,
}

CAMPOS_DESTINO = tuple(campo for campo, _, _ in ESPECIFICACION)
CAMPOS_DESTINO_81 = tuple(campo for campo, _, _ in ESPECIFICACION_81)

# Longitudes máximas de los campos de texto (evita que un valor inesperado
# aborte la ingesta completa). Los campos `text` no tienen límite.
LIMITES: dict[str, int] = {
    "region": 80, "estado_geografico": 80, "capital_estado": 80, "municipio": 80,
    "parroquia": 80, "estado_operativo": 80, "distrito": 40, "area": 20,
    "codigo_central": 20, "nombre_central": 120, "id_averia": 30, "telefono": 30,
    "persona_reporta": 120, "contacto_cliente": 60, "asignado_a": 60,
    "cuadrilla_externa": 40, "estatus_origen": 20, "nombre_cliente": 160,
    "olt": 40, "plan": 60, "slot": 10, "puerto": 10, "fat": 80, "serial": 60,
    "extra": 120, "area_trabajo": 40, "tipo_servicio": 40, "tipo_problema": 20,
    "unidad_negocio": 40, "ups": 10, "codigos_gestionados_venapp": 60,
    "codigos_sin_gestion_venapp": 60, "reparador_principal": 20, "flota_can": 20,
    "despacho_nombre": 80, "despacho_apellido": 80, "telefono_oficina": 30,
    "telefono_movil": 30,
}
LIMITES_81: dict[str, int] = {**LIMITES, "telefono_ip": 30}




def normalizar(texto: str | None) -> str:
    """Mayúsculas, sin acentos y sin espacios sobrantes (para comparar frases)."""
    base = unicodedata.normalize("NFKD", (texto or "").strip().upper())
    sin_acentos = "".join(c for c in base if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sin_acentos)


def _normalizar_fecha(valor: str) -> str:
    v = valor.strip()
    reemplazos = (
        ("a. m.", "AM"), ("p. m.", "PM"), ("a.m.", "AM"), ("p.m.", "PM"),
        ("a. m", "AM"), ("p. m", "PM"), ("a.m", "AM"), ("p.m", "PM"),
    )
    for viejo, nuevo in reemplazos:
        v = v.replace(viejo, nuevo)
        v = v.replace(viejo.upper(), nuevo)
    return re.sub(r"\s+", " ", v).upper()


def parse_fecha(valor: str | None) -> datetime | None:
    """Convierte `dd/mm/aaaa hh:mm:ss a.m./p.m.` (o variantes) en datetime."""
    if not valor or not valor.strip():
        return None
    texto = _normalizar_fecha(valor)
    for formato in (
        "%d/%m/%Y %I:%M:%S %p",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %I:%M %p",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(texto, formato)
        except ValueError:
            continue
    return None


def _limpiar(valor: str | None) -> str | None:
    v = (valor or "").strip()
    return v or None


def _convertir(valor: str, tipo: str) -> Any:
    if tipo == "fecha":
        return parse_fecha(valor)
    if tipo == "int":
        try:
            return int(float(valor.strip()))
        except (TypeError, ValueError):
            return None
    return _limpiar(valor)


def decodificar(contenido: bytes) -> str:
    """Decodifica en ISO-8859-1 con fallo ruidoso (H-02)."""
    try:
        return contenido.decode(CODIFICACION)
    except UnicodeDecodeError as exc:  # pragma: no cover - latin-1 no falla
        raise ValueError(f"No se pudo decodificar el archivo como {CODIFICACION}") from exc


def parsear_encabezado(contenido: str) -> list[str]:
    lector = csv.reader(io.StringIO(contenido), delimiter=DELIMITADOR)
    try:
        return next(lector)
    except StopIteration:
        return []


def columnas_encabezado(contenido: bytes | str) -> int:
    """Número de columnas del encabezado del archivo (RT-20)."""
    texto = decodificar(contenido) if isinstance(contenido, bytes) else contenido
    return len(parsear_encabezado(texto.lstrip("\ufeff")))


def _estructura_de_encabezado(
    encabezado: list[str],
) -> tuple[tuple[str, tuple[int, ...], str], ...]:
    """Deduce la estructura (80 o 81, D-164) a partir de las columnas reales.

    La estructura de 81 columnas solo se reconoce si la columna 15 es
    `telefono_ip`; cualquier otro encabezado devuelve la original (80) y el
    aviso del tamaño indicará el desvío del encabezado real.
    """
    if len(encabezado) == 81 and encabezado[14].strip().lower() == "telefono_ip":
        return ESTRUCTURAS[81]
    return ESTRUCTURAS[80]


def encabezado_valido(contenido: bytes | str) -> bool:
    """Valida la estructura del encabezado (RT-05 / RT-20 · D-164).

    80 columnas siempre; 81 solo si la 15 es «telefono_ip».
    """
    texto = decodificar(contenido) if isinstance(contenido, bytes) else contenido
    encabezado = parsear_encabezado(texto.lstrip("\ufeff"))
    if len(encabezado) == 81:
        return encabezado[14].strip().lower() == "telefono_ip"
    return len(encabezado) == 80


def parsear(contenido: bytes | str) -> tuple[list[dict[str, Any]], list[str]]:
    """Devuelve (filas mapeadas, avisos) sin tocar la base de datos."""
    texto = decodificar(contenido) if isinstance(contenido, bytes) else contenido
    texto = texto.lstrip("\ufeff")
    lector = csv.reader(io.StringIO(texto), delimiter=DELIMITADOR)

    try:
        encabezado = next(lector)
    except StopIteration:
        return [], ["El archivo está vacío"]

    avisos: list[str] = []
    es_81 = len(encabezado) == 81 and encabezado[14].strip().lower() == "telefono_ip"
    if not (len(encabezado) == COLUMNAS_ESPERADAS or es_81):
        avisos.append(
            f"El encabezado tiene {len(encabezado)} columnas; se esperaban {COLUMNAS_ESPERADAS}"
            " o 81 (D-164)"
        )
    especificacion = ESTRUCTURAS[81] if es_81 else ESTRUCTURAS[80]
    columnas_contrato = len(encabezado) if es_81 else COLUMNAS_ESPERADAS
    limites = LIMITES_81 if es_81 else LIMITES

    filas: list[dict[str, Any]] = []
    malformadas = 0
    recortados = 0
    for numero_linea, cruda in enumerate(lector, start=2):
        if not any(celda.strip() for celda in cruda):
            continue
        if len(cruda) != columnas_contrato:
            malformadas += 1
        fila: dict[str, Any] = {"_linea": numero_linea}
        for campo, indices, tipo in especificacion:
            if tipo == "unir":
                partes = [cruda[i].strip() for i in indices if i < len(cruda) and cruda[i].strip()]
                fila[campo] = " | ".join(partes) if partes else None
            elif tipo == "lista":
                fila[campo] = [
                    cruda[i].strip() for i in indices if i < len(cruda) and cruda[i].strip()
                ]
            else:
                valor = cruda[indices[0]] if indices[0] < len(cruda) else ""
                convertido = _convertir(valor, tipo)
                limite = limites.get(campo)
                if isinstance(convertido, str) and limite and len(convertido) > limite:
                    convertido = convertido[:limite]
                    recortados += 1
                fila[campo] = convertido
        if not fila.get("id_averia"):
            malformadas += 1
            continue
        filas.append(fila)

    if malformadas:
        avisos.append(f"{malformadas} filas malformadas o sin id_averia (descartadas)")
    if recortados:
        avisos.append(
            f"{recortados} valores recortados por exceder la longitud de su campo"
        )
    return filas, avisos


def filtrar_por_central(filas: list[dict[str, Any]], codigo_central: str) -> list[dict[str, Any]]:
    """Conserva solo los casos de la central configurada (RF-21)."""
    objetivo = normalizar(codigo_central)
    return [f for f in filas if normalizar(f.get("codigo_central")) == objetivo]
