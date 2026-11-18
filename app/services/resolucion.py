"""Resolución del caso: cierre (RF-15 · RF-61/RF-62).

La lógica de cierre nació en `routes_casos.cerrar_caso` (D-70) y se extrajo aquí
en D-99 para que el **cierre en cascada de una masiva** cierre los casos asociados
exactamente por la misma vía que el cierre individual, sin duplicar reglas.

No hace `commit`: quien llama decide la unidad de trabajo, de modo que cerrar N
casos de una masiva sea una sola transacción.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
    Actividad,
    Caso,
    CasoEstadoHist,
    CatalogoMetodo,
    Configuracion,
    EstadoTransicion,
    Evidencia,
    Usuario,
)
from . import clasificacion


class CierreInvalido(Exception):
    """El cierre no procede (caso ya cerrado o modo inexistente en el catálogo)."""

    def __init__(self, mensaje: str, *, ya_cerrado: bool = False) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.ya_cerrado = ya_cerrado


class TransicionInvalida(Exception):
    """El par origen→destino no está permitido por la matriz (RN-EST-01)."""

    def __init__(self, mensaje: str, validas: list[str] | None = None) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.validas = validas or []


class EvidenciasInsuficientes(Exception):
    """Faltan evidencias del tipo exigido para la resolución (RN-EV-01)."""

    def __init__(self, mensaje: str, faltante: str = "") -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.faltante = faltante


# --------------------------------------------------------------------------- #
# RN-EST-01 · RN-EV-01 · RN-NC-01 (Fase 3, ciclo F3-1)
# --------------------------------------------------------------------------- #

#: Estados terminales del ciclo del caso (fuente: routes_casos, sync, jornada).
ESTADOS_TERMINALES = frozenset({"CERRADO", "CANCELADO", "ENRUTADO"})

#: Evidencias mínimas al cambiar el estado **vía `registrar_estado`** (RN-EV-01):
#: DIFERIDO exige 3 demostrativas y ENRUTADO 1 de cualquier tipo. El cierre
#: (2 POTENCIA) se valida en `cerrar_caso` con el flag `exigir_evidencias`,
#: porque la cascada de masivas lo omite (D-99: la valida el CRASS).
EVIDENCIAS_MINIMAS: dict[str, tuple[str | None, int]] = {
    "DIFERIDO": ("DEMO", 3),
    "ENRUTADO": (None, 1),
}

#: Evidencias mínimas del cierre (RN-EV-01): resolución final IVR/COS/SACAS.
MIN_EVIDENCIAS_CIERRE: tuple[str, int] = ("POTENCIA", 2)


def _config(db: Session, clave: str, defecto):
    """Valor de `configuracion.clave` (JSONB) o el defecto (idioma del outbox)."""
    valor = db.scalar(select(Configuracion.valor).where(Configuracion.clave == clave))
    return defecto if valor in (None, "") else valor


def matriz_activa(db: Session) -> bool:
    """Interruptor de la matriz RN-EST-01 (clave `rn_est01_activo`, 1 si falta)."""
    return bool(_config(db, "rn_est01_activo", True))


def n_intentos_no_contesta(db: Session) -> int:
    """N de «No Contesta» antes de devolver el caso a la cola (RN-NC-01)."""
    try:
        return int(_config(db, "rn_nc01_n_intentos", 3))
    except (TypeError, ValueError):
        return 3


def transiciones_validas(db: Session, origen: str) -> list[str]:
    """Destinos permitidos desde `origen` según la matriz (RN-EST-01)."""
    return list(db.scalars(
        select(EstadoTransicion.estado_destino)
        .where(
            EstadoTransicion.estado_origen == origen,
            EstadoTransicion.activo.is_(True),
        )
        .order_by(EstadoTransicion.estado_destino)
    ).all())


def validar_transicion(db: Session, caso: Caso, nuevo: str) -> None:
    """Valida origen→destino contra la matriz; sin semilla no bloquea.

    La migración F3-1 siembra la matriz completa: si un origen no tiene filas
    es que la instalación aún no migró, y bloquearlo rompería el ciclo del
    caso. Con la matriz sembrada, un destino fuera de la lista levanta
    `TransicionInvalida` (el router lo traduce a 409).
    """
    if not matriz_activa(db) or nuevo == caso.estado_actual:
        return
    validas = transiciones_validas(db, caso.estado_actual)
    if not validas:
        return
    if nuevo in validas:
        return
    detalle = ", ".join(validas)
    raise TransicionInvalida(
        f"Transición {caso.estado_actual} → {nuevo} no permitida por la matriz "
        f"de estados (RN-EST-01). Transiciones válidas: {detalle}.",
        validas=validas,
    )


def _contar_evidencias(db: Session, caso: Caso, tipo: str | None) -> int:
    """Evidencias vinculadas al caso (D-128), de un tipo o de cualquier tipo."""
    condicion = [Evidencia.id_caso == caso.id_caso]
    if tipo is not None:
        condicion.append(Evidencia.tipo == tipo)
    return int(db.scalar(
        select(func.count()).select_from(Evidencia).where(*condicion)
    ) or 0)


def _rn_ev01_activo(db: Session) -> bool:
    """Interruptor de la RN-EV-01 (configuracion.rn_ev01_activo).

    Por defecto DESACTIVADA: el APK en producción todavía no envía evidencias
    con el cierre/enrutado/diferido (la exigencia local llega con el build F3-1);
    se activa al desplegar ese build para no romper los flujos heredados.
    """
    clave = db.scalar(select(Configuracion.valor).where(Configuracion.clave == "rn_ev01_activo"))
    return clave is True or (isinstance(clave, str) and clave.lower() in ("true", "1"))


def validar_evidencias(db: Session, caso: Caso, destino: str, *,
                       regla: tuple[str | None, int] | None = None) -> None:
    """Exige las evidencias mínimas de la resolución (RN-EV-01).

    `regla` permite pasar la del cierre (2 POTENCIA); si no se pasa se usa la
    del estado destino en `EVIDENCIAS_MINIMAS` (DIFERIDO/ENRUTADO).
    Gobernada por `rn_ev01_activo` (F3-1): mientras esté en false, las reglas
    de evidencia se aplican solo del lado del cliente (la APK las pide antes
    de enviar).
    """
    if not _rn_ev01_activo(db):
        return
    if regla is None:
        regla = EVIDENCIAS_MINIMAS.get(destino)
    if regla is None:
        return
    tipo, minimo = regla
    hay = _contar_evidencias(db, caso, tipo)
    if hay >= minimo:
        return
    exigido = f"{minimo} de {tipo}" if tipo else f"{minimo} (de cualquier tipo)"
    raise EvidenciasInsuficientes(
        f"Para {destino} el caso exige {exigido} evidencias y hay {hay} "
        "(RN-EV-01). Adjunte las evidencias faltantes e inténtelo de nuevo.",
        faltante=f"{max(minimo - hay, 0)} evidencias de {tipo or 'cualquier tipo'}",
    )


def metodo_cierre(db: Session, codigo: str) -> CatalogoMetodo:
    """Devuelve el método de cierre del catálogo (dominio CIERRE)."""
    metodo = db.scalar(
        select(CatalogoMetodo).where(
            CatalogoMetodo.dominio == "CIERRE", CatalogoMetodo.codigo == codigo
        )
    )
    if metodo is None:
        raise CierreInvalido(f"El modo de cierre {codigo} no está en el catálogo")
    return metodo


def registrar_estado(db: Session, caso: Caso, nuevo: str, motivo: str | None,
                     usuario: str | None,
                     momento: datetime | None = None,
                     exigir_evidencias: bool = True) -> None:
    """Anota el cambio de estado en la bitácora y lo aplica al caso (RNF-12).

    D-120: es el camino **único** de los cambios de estado, así que aquí se
    sincroniza también la ficha del caso especial (`caso_especial.estado`): sin
    esto, cerrar un referido desde la APK dejaba su especial en `ABIERTO` para
    siempre y parecía que «no se cerraba».

    F3-1: `exigir_evidencias=False` exime del RN-EV-01 en los caminos donde las
    evidencias llegan aparte (cola offline de la APK vía upload, cascada de
    masivas D-99).
    """
    if nuevo == caso.estado_actual:
        return
    # RN-EST-01 (F3-1): toda transición pasa por la matriz `estado_transicion`.
    validar_transicion(db, caso, nuevo)
    # RN-EV-01 (F3-1): DIFERIDO exige 3 DEMO y ENRUTADO 1 evidencia. El cierre
    # se valida aparte en `cerrar_caso` (con exención para la cascada, D-99).
    if exigir_evidencias:
        validar_evidencias(db, caso, nuevo)
    db.add(
        CasoEstadoHist(
            id_caso=caso.id_caso,
            estado_anterior=caso.estado_actual,
            estado_nuevo=nuevo,
            motivo=motivo,
            usuario=usuario,
            # D-141 · H-24: la hora en que el técnico hizo la acción (si la mandó).
            **({"fecha_hora": momento} if momento is not None else {}),
        )
    )
    caso.estado_actual = nuevo
    if nuevo == "CONTACTADO":
        # RN-NC-01: el contacto efectivo cierra el ciclo de «No Contesta».
        caso.intentos_no_contesta = 0
    clasificacion.sincronizar_estado_especial(db, caso)


def cerrar_caso(
    db: Session,
    caso: Caso,
    *,
    modo: str,
    descripcion: str,
    evidencias: list[str] | None = None,
    id_causa: int | None = None,
    usuario: Usuario | None = None,
    p00: str | None = None,
    sincronizado: bool = True,
    id_actividad_local: int | None = None,
    dispositivo_id: str | None = None,
    exigir_evidencias: bool = True,
) -> Actividad:
    """Cierra el caso: actividad CIERRE + evidencias + estado CERRADO.

    `usuario` es el usuario de la API; `p00` permite cerrar en nombre del sistema
    (cierre en cascada de una masiva) sin un `Usuario` cargado.
    `id_actividad_local`/`dispositivo_id` (D-121) identifican la acción de la cola
    de la APK para que el reenvío del lote no duplique el cierre.

    RN-EV-01 (F3-1): exige 2 evidencias de POTENCIA (`exigir_evidencias=True`).
    El cierre en cascada de una masiva pasa `exigir_evidencias=False`: D-99 ya
    exige al masiva el personal del CRASS que valida la reparación y sus
    evidencias, y los casos asociados se cierran «Reparado en FDT».
    """
    if caso.estado_actual == "CERRADO":
        raise CierreInvalido(
            "El caso ya está cerrado; reabra el estado antes de registrar otro cierre",
            ya_cerrado=True,
        )
    metodo = metodo_cierre(db, modo)
    autor = p00 if p00 is not None else (usuario.p00 if usuario else None)

    actividad = Actividad(
        id_caso=caso.id_caso,
        id_usuario=usuario.id_usuario if usuario else None,
        tipo="CIERRE",
        resultado="CERRADO",
        reporte_corto=descripcion,
        id_metodo=metodo.id_metodo,
        id_causa=id_causa,
        fecha_hora=datetime.now(UTC),
        sincronizado=sincronizado,
        id_actividad_local=id_actividad_local,
        dispositivo_id=dispositivo_id,
    )
    db.add(actividad)
    db.flush()

    ahora = datetime.now(UTC)
    for indice, serial in enumerate(evidencias or [], start=1):
        limpio = serial.strip()
        if not limpio:
            continue
        db.add(
            Evidencia(
                id_actividad=actividad.id_actividad,
                # RN-EV-01 (F3-1): las evidencias del cierre son de POTENCIA
                # (la resolución final IVR/COS/SACAS exige 2 de ese tipo).
                tipo="POTENCIA",
                # El serial debe ser único en toda la tabla: se incluye el id de la
                # actividad para poder cerrar/reabrir el mismo caso varias veces.
                serial_imagen=(
                    f"{caso.id_averia}-A{actividad.id_actividad}-CIERRE-{indice:02d}"[:160]
                ),
                ruta_remota=limpio[:255],
                fecha_hora=ahora,
                origen_camara=False,
            )
        )
    db.flush()
    # RN-EV-01 (F3-1): se valida DESPUÉS de crear las evidencias del cierre —
    # las adjuntas en esta misma operación cuentan (la APK las envía junto al
    # cierre); el rollback descarta todo si la regla se incumple.
    if exigir_evidencias:
        validar_evidencias(db, caso, "CERRADO", regla=MIN_EVIDENCIAS_CIERRE)

    registrar_estado(db, caso, "CERRADO", f"Cierre con {modo}", autor)
    clasificacion.aplicar_en_cambio(db, caso, "CIERRE", autor)
    return actividad
