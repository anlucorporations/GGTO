"""Cierre de la jornada de despacho — RF-65 · RF-66 · D-99 · D-160.

Los despachos se cierran **automáticamente a las 23:00** del día de la jornada
(hora configurable en `despacho.hora_cierre_jornada`): el job de Cloud Scheduler
`ggto-cierre-jornada` (`POST /mantenimiento/cierre-jornada`, token
`X-Mantenimiento-Token`, D-160) es el disparador principal. Lo no atendido vuelve
a **PENDIENTE** para reasignarse en la jornada siguiente, y **además las
asignaciones se anulan** (D-157): el renglón de `despacho_caso` pasa a `DEVUELTO`
y queda excluido de las consultas de vigencia, así que el caso deja de pertenecer
a la cuadrilla (la APK deja de descargarlo y CASOS lo muestra sin cuadrilla)
mientras el histórico del despacho conserva la fila y el estado que había tenido.

D-160 (con la corrección del usuario) consolida el corte nocturno: **los casos no
atendidos —todo lo que no esté `CERRADO`, `CANCELADO` o `ENRUTADO`— vuelven a
`PENDIENTE`** para reasignarse en la jornada siguiente, y **las asignaciones se
anulan** (D-157: el renglón de `despacho_caso` pasa a `DEVUELTO`), así que el
caso deja de pertenecer a la cuadrilla mientras el histórico del despacho
conserva la fila. Los casos **citados** mantienen la fecha de su cita
(`caso.fecha_cita` no se toca), y el despacho del día siguiente los vuelve a
detectar como citas con prioridad. Las **fallas masivas activas pierden su
cuadrilla** (`id_cuadrilla = NULL`), de modo que a la mañana siguiente el
supervisor las reasigna junto con el resto del reparto.

El cierre sigue siendo también **perezoso** (DEC-MA-5): la entrada de un usuario
rol SUPER o SUPERVISOR (ya no ADMIN) lo aplica si ninguna jornada quedó vencida
sin cortar, de modo que el modo manual `POST /despachos/cierre-jornada` y la
entrada al listado sirven de respaldo — solo el Supervisor o el Super Usuario
pueden ejecutarlo (D-160).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta, timezone
from typing import Any, cast
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from ..models import Caso, Configuracion, Despacho, DespachoCasos, FallaMasiva, Usuario
from . import resolucion
from .tiempo import ZONA_OPERATIVA, ahora_operativo, dia_operativo

#: Hora del corte de jornada cuando la configuración no está sembrada (D-160).
HORA_CIERRE_POR_DEFECTO = "23:00"
#: Roles cuya entrada dispara el cierre perezoso de la jornada vencida (D-160).
ROLES_QUE_CIERRAN = ("SUPER", "SUPERVISOR")
#: Estados que el corte respeta (D-99, confirmado en D-160): el caso ya tuvo
#: un desenlace. Todo lo demás —NUEVO/ASIGNADO/CONTACTADO/CITADO/DIFERIDO/
#: EN_GESTION/PENDIENTE— vuelve a `PENDIENTE`, y los `CITADO` conservan su
#: fecha de cita (`caso.fecha_cita`) para que el despacho siguiente los
#: trate como citas (prioridad, `es_cita`).
ESTADOS_RESUELTOS = ("CERRADO", "CANCELADO", "ENRUTADO")
#: Estado al que vuelven los casos que quedaron sin cerrar (DEC-MA-6).
ESTADO_PENDIENTE = "PENDIENTE"
#: Estado de `despacho_caso` que anula la asignación (D-157).
ESTADO_DEVUELTO = "DEVUELTO"
#: Estados de falla masiva que el corte desasigna (D-160): las activas.
ESTADOS_MASIVA_ACTIVA = ("DETECTADA", "PLANIFICADA")


def _zona():
    """Zona operativa, con respaldo UTC-4 si falta la base de zonas horarias."""
    try:
        return ZoneInfo(ZONA_OPERATIVA)
    except Exception:  # pragma: no cover - solo entornos sin tzdata
        return timezone(timedelta(hours=-4), ZONA_OPERATIVA)


def hora_cierre(db: Session) -> time:
    """Hora del corte de jornada según la configuración."""
    valor = db.scalar(
        select(Configuracion.valor).where(
            Configuracion.clave == "despacho.hora_cierre_jornada"
        )
    )
    texto = str(valor if valor not in (None, "") else HORA_CIERRE_POR_DEFECTO).strip('"')
    try:
        horas, minutos = texto.split(":")[:2]
        return time(int(horas), int(minutos))
    except (TypeError, ValueError):
        return time(23, 0)


def jornada_vencida(fecha: date, ahora: datetime, corte: time) -> bool:
    """¿La jornada de esa fecha ya pasó su hora de corte?"""
    hoy = dia_operativo(ahora)
    if fecha < hoy:
        return True
    if fecha > hoy:
        return False
    return ahora.astimezone(_zona()).time() >= corte


def desasignar_masivas(db: Session, id_central: int | None = None) -> int:
    """D-160: deja **sin cuadrilla** las fallas masivas activas.

    El corte nocturno anula el reparto de las masivas (`id_cuadrilla = NULL`)
    para que la mañana siguiente el supervisor decida de nuevo qué cuadrilla
    las atiende, igual que el resto del despacho. Las `CERRADA` no se tocan.
    Devuelve cuántas quedaron desasignadas. **No hace `commit`**.
    """
    stmt = (
        update(FallaMasiva)
        .where(FallaMasiva.estado.in_(ESTADOS_MASIVA_ACTIVA),
               FallaMasiva.id_cuadrilla.is_not(None))
        .values(id_cuadrilla=None)
    )
    if id_central is not None:
        stmt = stmt.where(FallaMasiva.id_central == id_central)
    resultado = cast("CursorResult[Any]", db.execute(stmt))
    return resultado.rowcount or 0


def cerrar_jornada(
    db: Session,
    *,
    id_central: int | None = None,
    ahora: datetime | None = None,
    usuario_p00: str | None = None,
    solo_vencidos: bool = True,
) -> dict:
    """Cierra los despachos vencidos, anula sus asignaciones y devuelve a
    PENDIENTE los casos no atendidos —todo lo que no esté `CERRADO`, `CANCELADO`
    o `ENRUTADO` (D-99, confirmado en D-160); los `CITADO` conservan su fecha de
    cita—. Las fallas masivas activas pierden su cuadrilla (D-160) y la
    asignación devuelta deja de contar para la cuadrilla (D-157).

    **No hace `commit`**: quien llama decide la unidad de trabajo.
    """
    momento = ahora or ahora_operativo()
    corte = hora_cierre(db)

    stmt = select(Despacho).where(Despacho.estado != "CERRADO").order_by(Despacho.fecha)
    if id_central is not None:
        stmt = stmt.where(Despacho.id_central == id_central)

    cerrados = pendientes = devueltas = 0
    detalle: list[dict] = []
    for despacho in db.scalars(stmt).all():
        if solo_vencidos and not jornada_vencida(despacho.fecha, momento, corte):
            continue
        filas = db.execute(
            select(DespachoCasos, Caso)
            .join(Caso, Caso.id_caso == DespachoCasos.id_caso)
            .where(DespachoCasos.id_despacho == despacho.id_despacho)
        ).all()
        liberados = 0
        for vinculo, caso in filas:
            if caso.estado_actual in ESTADOS_RESUELTOS:  # D-99/D-160
                continue
            resolucion.registrar_estado(
                db, caso, ESTADO_PENDIENTE,
                "Corte nocturno 23:00: el caso no atendido vuelve a PENDIENTE",
                usuario_p00,
            )
            # D-157: la asignación se anula. La fila conserva la historia de la
            # jornada, pero deja de contar para la cuadrilla (sync, CASOS…).
            vinculo.estado = ESTADO_DEVUELTO
            liberados += 1
        despacho.estado = "CERRADO"
        despacho.cerrado_en = datetime.now(UTC)
        despacho.cierre_auto = True
        cerrados += 1
        pendientes += liberados
        devueltas += liberados
        detalle.append({
            "id_despacho": despacho.id_despacho,
            "fecha": despacho.fecha.isoformat(),
            "casos_pendientes": liberados,
        })
    # D-160: las masivas activas pierden su cuadrilla cuando el corte **actúa**
    # (job nocturno, que viene con `solo_vencidos=False`) o cierra alguna
    # jornada vencida. El disparo perezoso de media mañana no toca nada.
    masivas = desasignar_masivas(db, id_central) if (not solo_vencidos or cerrados) else 0
    db.flush()
    return {
        "despachos_cerrados": cerrados,
        "casos_pendientes": pendientes,
        "asignaciones_devueltas": devueltas,
        "masivas_desasignadas": masivas,
        "hora_corte": corte.strftime("%H:%M"),
        "fecha_corte": momento.isoformat(),
        "detalle": detalle,
    }


def quizas_cerrar(db: Session, usuario: Usuario | None,
                  ahora: datetime | None = None) -> dict | None:
    """Cierre perezoso: solo para SUPER o SUPERVISOR (DEC-MA-5 · D-160).

    Devuelve el resultado del cierre, o `None` si el rol que entra no lo dispara.
    """
    if usuario is None or usuario.rol is None:
        return None
    if usuario.rol.codigo not in ROLES_QUE_CIERRAN:
        return None
    resultado = cerrar_jornada(
        db,
        id_central=usuario.id_central if usuario.rol.codigo != "SUPER" else None,
        ahora=ahora,
        usuario_p00=usuario.p00,
    )
    if resultado["despachos_cerrados"] or resultado["masivas_desasignadas"]:
        db.commit()
    return resultado
