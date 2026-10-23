"""Cierre de la jornada de despacho — RF-65 · RF-66 · D-99.

Los despachos se cierran **automáticamente a las 23:50** del día de la jornada
(hora configurable en `despacho.hora_cierre_jornada`) y los casos que no quedaron
cerrados pasan a **PENDIENTE**, de modo que vuelven al universo despachable y se
reasignan en la jornada siguiente. Además, las **asignaciones se anulan**
(D-157): el renglón de `despacho_caso` pasa a `DEVUELTO` y queda excluido de las
consultas de vigencia, así que el caso deja de pertenecer a la cuadrilla (la
APK deja de descargarlo y CASOS lo muestra sin cuadrilla) mientras el histórico
del despacho conserva la fila y el estado que había tenido.

DEC-MA-5: no hay *cron*. El cierre lo dispara de forma **perezosa** la entrada de
un usuario con rol SUPER/ADMIN/SUPERVISOR (opción elegida en el proyecto), de
modo que no hace falta ni un job de Cloud Scheduler ni un planificador en proceso
—poco fiable en Cloud Run, donde la instancia se apaga sin tráfico—.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Caso, Configuracion, Despacho, DespachoCasos, Usuario
from . import resolucion
from .tiempo import ZONA_OPERATIVA, ahora_operativo, dia_operativo

#: Hora del corte de jornada cuando la configuración no está sembrada.
HORA_CIERRE_POR_DEFECTO = "23:50"
#: Roles cuya entrada dispara el cierre perezoso de la jornada vencida.
ROLES_QUE_CIERRAN = ("SUPER", "ADMIN", "SUPERVISOR")
#: Estados que el corte respeta: el caso ya tuvo un desenlace en la jornada.
ESTADOS_RESUELTOS = ("CERRADO", "CANCELADO", "ENRUTADO")
#: Estado al que vuelven los casos que quedaron sin cerrar (DEC-MA-6).
ESTADO_PENDIENTE = "PENDIENTE"
#: Estado de `despacho_caso` que anula la asignación (D-157).
ESTADO_DEVUELTO = "DEVUELTO"


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
        return time(23, 50)


def jornada_vencida(fecha: date, ahora: datetime, corte: time) -> bool:
    """¿La jornada de esa fecha ya pasó su hora de corte?"""
    hoy = dia_operativo(ahora)
    if fecha < hoy:
        return True
    if fecha > hoy:
        return False
    return ahora.astimezone(_zona()).time() >= corte


def cerrar_jornada(
    db: Session,
    *,
    id_central: int | None = None,
    ahora: datetime | None = None,
    usuario_p00: str | None = None,
    solo_vencidos: bool = True,
) -> dict:
    """Cierra los despachos vencidos, anula sus asignaciones y devuelve los casos
    a PENDIENTE (D-157: la asignación devuelta deja de contar para la cuadrilla).

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
            if caso.estado_actual in ESTADOS_RESUELTOS:
                continue
            resolucion.registrar_estado(
                db, caso, ESTADO_PENDIENTE,
                f"Cierre de jornada: el caso no se cerró a las {corte.strftime('%H:%M')}",
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
    db.flush()
    return {
        "despachos_cerrados": cerrados,
        "casos_pendientes": pendientes,
        "asignaciones_devueltas": devueltas,
        "hora_corte": corte.strftime("%H:%M"),
        "fecha_corte": momento.isoformat(),
        "detalle": detalle,
    }


def quizas_cerrar(db: Session, usuario: Usuario | None,
                  ahora: datetime | None = None) -> dict | None:
    """Cierre perezoso: solo para SUPER/ADMIN/SUPERVISOR (DEC-MA-5).

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
    if resultado["despachos_cerrados"]:
        db.commit()
    return resultado
