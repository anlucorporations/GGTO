"""Reglas de **REPARACIÓN / REFERIDO** del incremento D-90 (RF-49, RF-50).

Una **REPARACIÓN** exige **identificador de pago (70\\*) + ID de AVERÍA real**:

- `caso.id_pago` informado (el 70\\* enlazado, no solo un texto);
- `caso.id_averia` **no** sintético (no `REF-…`).

Si falta cualquiera de los dos, el caso **no es una reparación**: pasa a
`tipo_caso='REFERIDO'` (la base lo garantiza con el trigger de D-89) y se registra
como **caso especial** (`caso_especial`, **una sola fila por caso**).

La **marca** es *derivada*, no una columna (`esta_marcado`), de modo que los casos
históricos se **regularizan en su próximo cambio** (DEC-IP-3); un cambio de estado
en un caso **ya** terminal no reclasifica y queda informado en MONITOREO.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Auditoria, Caso, CasoEspecial

TERMINALES = ("CERRADO", "CANCELADO", "ENRUTADO")
PREFIJO_REF = "REF-"
MOTIVO_SIN_IP = "SIN_IDENTIFICADOR_PAGO"
MOTIVO_SIN_AVERIA = "SIN_ID_AVERIA"
MOTIVO_AMBOS = "SIN_IDENTIFICADOR_PAGO_Y_AVERIA"
ACCION_RECLASIFICADO = "RECLASIFICACION_REFERIDO"
MENSAJE_RECLASIFICADO = (
    "El caso no cumple las condiciones de una REPARACIÓN (70* + id de avería real): "
    "se registró como caso especial REFERIDO."
)


# --------------------------------------------------------------------------- #
# Predicados (marca derivada)
# --------------------------------------------------------------------------- #
def tiene_id_averia_real(caso: Caso) -> bool:
    """¿El caso trae un ID de avería real (no vacío y no sintético `REF-…`)?"""
    id_averia = (caso.id_averia or "").strip()
    return bool(id_averia) and not id_averia.upper().startswith(PREFIJO_REF)


def esta_marcado(caso: Caso) -> bool:
    """Marca derivada: REPARACIÓN sin identificador de pago o sin avería real."""
    if caso.tipo_caso != "REPARACION":
        return False
    return caso.id_pago is None or not tiene_id_averia_real(caso)


def motivo_marca(caso: Caso) -> str | None:
    """Motivo de la marca (o `None` si el caso no está marcado)."""
    if caso.tipo_caso != "REPARACION":
        return None
    falta_ip = caso.id_pago is None
    falta_real = not tiene_id_averia_real(caso)
    if falta_ip and falta_real:
        return MOTIVO_AMBOS
    if falta_ip:
        return MOTIVO_SIN_IP
    if falta_real:
        return MOTIVO_SIN_AVERIA
    return None


def clasificacion_especial(caso: Caso) -> str:
    """Clasificación de negocio de la ficha del especial (EMPRESA/GOBIERNO o REFERIDO)."""
    return caso.categoria if caso.categoria in ("EMPRESA", "GOBIERNO") else "REFERIDO"


# --------------------------------------------------------------------------- #
# Estado de la ficha del especial (D-120)
# --------------------------------------------------------------------------- #
#: Estados del caso que **dan por cerrada** la ficha del especial: el trabajo
#: terminó (cerrado) o salió de la instancia (cancelado o enrutado).
ESTADOS_CASO_CIERRAN = ("CERRADO", "CANCELADO", "ENRUTADO")
#: Estados del caso que dejan el especial **en proceso** (ya hubo gestión).
ESTADOS_CASO_EN_PROCESO = ("CONTACTADO", "CITADO", "EN_GESTION", "DIFERIDO")
#: Estados de la ficha del especial que no deben reabrirse solos.
ESTADOS_ESPECIAL_FINALES = ("ATENDIDO", "CERRADO")

#: D-134 · H-17: transiciones permitidas del caso especial.
#:
#: Antes el PATCH cambiaba `estado` a cualquier valor: se podía cerrar un caso
#: saltándose pasos o **reabrir** uno cerrado sin motivo ni rastro. Ahora el flujo
#: es explícito y el retroceso solo lo autoriza el SUPER con `motivo_reversion`.
TRANSICIONES_ESPECIAL: dict[str, set[str]] = {
    "ABIERTO": {"EN_PROCESO", "ATENDIDO", "CERRADO"},
    "EN_PROCESO": {"ATENDIDO", "CERRADO"},
    "ATENDIDO": {"CERRADO"},
    "CERRADO": set(),
}

#: Estados a los que solo se puede volver con autorización del SUPER.
RETROCESOS_ESPECIAL = {"ABIERTO", "EN_PROCESO"}



def estado_especial_para(estado_caso: str | None) -> str | None:
    """Estado que le corresponde a `caso_especial` según el del caso.

    Devuelve `None` cuando el estado del caso **no** determina el del especial
    (NUEVO, ASIGNADO, PENDIENTE…): en ese caso manda lo que tenga la ficha.
    """
    estado = (estado_caso or "").strip().upper()
    if estado in ESTADOS_CASO_CIERRAN:
        return "CERRADO"
    if estado in ESTADOS_CASO_EN_PROCESO:
        return "EN_PROCESO"
    return None


def estado_especial_visible(estado_especial: str, estado_caso: str | None) -> str:
    """Estado que se **muestra** del especial (función pura, RT-30).

    El caso es la fuente de verdad: si el técnico lo cerró, el especial está
    `CERRADO` aunque la fila `caso_especial` siguiera en `ABIERTO` (era el
    defecto reportado: los referidos «no se cerraban» porque nadie movía esa
    fila). Un `ATENDIDO`/`CERRADO` manual **no se reabre** solo.
    """
    derivado = estado_especial_para(estado_caso)
    if derivado == "CERRADO":
        return "CERRADO"
    if estado_especial in ESTADOS_ESPECIAL_FINALES:
        return estado_especial
    if derivado == "EN_PROCESO":
        return "EN_PROCESO"
    return estado_especial


def sincronizar_estado_especial(db: Session, caso: Caso) -> bool:
    """Alinea `caso_especial.estado` con el estado del caso (D-120).

    Se llama desde `resolucion.registrar_estado`, que es el camino único de los
    cambios de estado (cierre, contacto, cita, enrutado, diferido y cierre de
    jornada). Devuelve `True` si la ficha cambió.
    """
    objetivo = estado_especial_para(caso.estado_actual)
    if objetivo is None:
        return False
    especial = db.scalar(
        select(CasoEspecial).where(CasoEspecial.id_caso == caso.id_caso)
    )
    if especial is None or especial.estado == objetivo:
        return False
    especial.estado = objetivo
    return True



# --------------------------------------------------------------------------- #
# Ficha del caso especial (idempotente)
# --------------------------------------------------------------------------- #
def asegurar_caso_especial(
    db: Session, caso: Caso, clasificacion: str | None = None
) -> CasoEspecial:
    """Crea o actualiza la ficha `caso_especial` del caso.

    Es **idempotente**: como máximo existe una fila por caso (si ya hay una, se
    actualiza en lugar de duplicarla), de modo que puede llamarse desde cualquier
    camino de escritura y desde el trigger lógico de la regla.
    """
    clasificacion = clasificacion or clasificacion_especial(caso)
    real = tiene_id_averia_real(caso)
    especial = db.scalar(
        select(CasoEspecial).where(CasoEspecial.id_caso == caso.id_caso)
    )
    if especial is None:
        especial = CasoEspecial(
            id_caso=caso.id_caso,
            clasificacion=clasificacion,
            tipo_actividad="REPARACION",
            prioridad="MEDIA",
            tiene_id_averia=real,
            estado="ABIERTO",
        )
        db.add(especial)
        db.flush()
    else:
        especial.clasificacion = clasificacion
        especial.tiene_id_averia = real
    return especial


# --------------------------------------------------------------------------- #
# Regla
# --------------------------------------------------------------------------- #
@dataclass
class ResultadoClasificacion:
    """Resultado de aplicar la regla (para mensajes de la API y pruebas)."""

    accion: str  # SIN_CAMBIO | OK | RECLASIFICADO | PENDIENTE_HISTORICO
    motivo: str | None = None
    id_caso_especial: int | None = None
    mensaje: str = ""


def aplicar_regla_reparacion(
    db: Session, caso: Caso, origen: str, usuario: str | None = None
) -> ResultadoClasificacion:
    """Aplica RN-IP-05/06 al caso. **Debe llamarse antes del `commit`.**

    Devuelve `RECLASIFICADO` con su motivo cuando el caso deja de ser REPARACIÓN.
    """
    if caso.tipo_caso != "REPARACION":
        return ResultadoClasificacion("SIN_CAMBIO")

    falta_ip = caso.id_pago is None
    falta_real = not tiene_id_averia_real(caso)
    if not (falta_ip or falta_real):
        return ResultadoClasificacion("OK")

    motivo = (
        MOTIVO_AMBOS
        if (falta_ip and falta_real)
        else (MOTIVO_SIN_IP if falta_ip else MOTIVO_SIN_AVERIA)
    )
    antes = {
        "tipo_caso": caso.tipo_caso,
        "categoria": caso.categoria,
        "id_pago": caso.id_pago,
        "id_averia": caso.id_averia,
    }
    caso.tipo_caso = "REFERIDO"
    if caso.categoria in ("RESIDENCIAL", "REFERIDO"):
        caso.categoria = "REFERIDO"
    especial = asegurar_caso_especial(db, caso)
    db.add(
        Auditoria(
            usuario=usuario,
            accion=ACCION_RECLASIFICADO,
            entidad="caso",
            id_entidad=str(caso.id_caso),
            datos_antes=antes,
            datos_despues={
                "tipo_caso": caso.tipo_caso,
                "categoria": caso.categoria,
                "id_pago": caso.id_pago,
                "id_averia": caso.id_averia,
                "motivo": motivo,
                "origen": origen,
            },
        )
    )
    return ResultadoClasificacion(
        "RECLASIFICADO",
        motivo=motivo,
        id_caso_especial=especial.id_caso_especial,
        mensaje=MENSAJE_RECLASIFICADO,
    )


def aplicar_en_cambio(
    db: Session,
    caso: Caso,
    origen: str,
    usuario: str | None = None,
) -> ResultadoClasificacion:
    """Aplica la regla en cualquier cambio del caso (edición, estado, cierre, cita…).

    **Nota de diseño (D-90).** La primera redacción contemplaba una excepción para
    los casos que **ya** estaban en estado terminal («un cambio de estado no los
    reclasifica»). Es **inexecutable** con el modelo de D-89: el `CHECK
    ck_reparacion_con_ip` rige para todo `UPDATE`, de modo que una fila marcada
    cuya única modificación sea el estado **no podría guardarse** sin reclasificar;
    y el trigger de la base la convierte de todos modos. Por tanto, **cualquier
    escritura regulariza el caso**. Los casos marcados que aún no se han reescrito
    (los que quedaron en estado terminal tras la migración) siguen marcados y se
    informan en MONITOREO como **pendientes históricos** (RF-55).
    """
    return aplicar_regla_reparacion(db, caso, origen, usuario)
