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
