"""Consultas del log de sincronización (RF-39 / CU-D81-02).

Todas las consultas se **acotan a la central** del usuario (RNF-21).
"""

from __future__ import annotations

import math
from datetime import date, datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import SyncCheck, SyncLog

ORDENES: dict[str, Any] = {
    "iniciado_en_desc": SyncLog.iniciado_en.desc(),
    "iniciado_en_asc": SyncLog.iniciado_en.asc(),
    "duracion_ms_desc": SyncLog.duracion_ms.desc(),
}


def _tz() -> ZoneInfo:
    """Zona horaria de la app; si falta `tzdata`, degrada a UTC."""
    try:
        return ZoneInfo(get_settings().app_timezone)
    except Exception:  # ZoneInfoNotFoundError, p. ej. sin tzdata
        return ZoneInfo("UTC")


def rango_dia(fecha: date) -> tuple[datetime, datetime]:
    tz = _tz()
    return (
        datetime.combine(fecha, time.min, tzinfo=tz),
        datetime.combine(fecha, time.max, tzinfo=tz),
    )


def _fila(s: SyncLog) -> dict[str, Any]:
    return {
        "id_sync_log": s.id_sync_log,
        "p00": s.p00,
        "id_cuadrilla": s.id_cuadrilla,
        "tipo": s.tipo,
        "dispositivo_id": s.dispositivo_id,
        "version_app": s.version_app,
        "plataforma": s.plataforma,
        "iniciado_en": s.iniciado_en,
        "finalizado_en": s.finalizado_en,
        "duracion_ms": s.duracion_ms,
        "recibidos": s.recibidos,
        "procesados": s.procesados,
        "errores": s.errores,
        "estado": s.estado,
        "detalle": s.detalle,
    }


def _checklist(db: Session, id_sync_log: int) -> list[dict[str, Any]]:
    filas = db.scalars(
        select(SyncCheck).where(SyncCheck.id_sync_log == id_sync_log).order_by(SyncCheck.paso)
    ).all()
    return [
        {
            "paso": f.paso,
            "estado": f.estado,
            "fecha_hora": f.fecha_hora,
            "detalle": f.detalle,
        }
        for f in filas
    ]


def listar(
    db: Session,
    *,
    id_central: int,
    p00: str | None = None,
    id_cuadrilla: int | None = None,
    dispositivo_id: str | None = None,
    tipo: str | None = None,
    estado: str | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    orden: str = "iniciado_en_desc",
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    stmt = select(SyncLog).where(SyncLog.id_central == id_central)
    if p00:
        stmt = stmt.where(SyncLog.p00 == p00)
    if id_cuadrilla is not None:
        stmt = stmt.where(SyncLog.id_cuadrilla == id_cuadrilla)
    if dispositivo_id:
        stmt = stmt.where(SyncLog.dispositivo_id == dispositivo_id)
    if tipo:
        stmt = stmt.where(SyncLog.tipo == tipo)
    if estado:
        stmt = stmt.where(SyncLog.estado == estado)
    if desde:
        stmt = stmt.where(SyncLog.iniciado_en >= desde)
    if hasta:
        stmt = stmt.where(SyncLog.iniciado_en <= hasta)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    filas = db.scalars(
        stmt.order_by(ORDENES.get(orden, ORDENES["iniciado_en_desc"]))
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if page_size else 0,
        "items": [_fila(s) for s in filas],
    }


def detalle(db: Session, id_sync_log: int, id_central: int) -> dict[str, Any] | None:
    s = db.get(SyncLog, id_sync_log)
    if s is None or s.id_central != id_central:
        return None
    datos = _fila(s)
    datos["checklist"] = _checklist(db, id_sync_log)
    return datos


def resumen(db: Session, *, id_central: int, fecha: date | None = None) -> dict[str, Any]:
    fecha = fecha or datetime.now(_tz()).date()
    inicio, fin = rango_dia(fecha)
    base = select(SyncLog).where(
        SyncLog.id_central == id_central,
        SyncLog.iniciado_en >= inicio,
        SyncLog.iniciado_en <= fin,
    )
    filas = list(db.scalars(base).all())
    por_estado: dict[str, int] = {}
    por_cuadrilla: dict[str, int] = {}
    for s in filas:
        por_estado[s.estado] = por_estado.get(s.estado, 0) + 1
        clave = str(s.id_cuadrilla) if s.id_cuadrilla is not None else "SIN_CUADRILLA"
        por_cuadrilla[clave] = por_cuadrilla.get(clave, 0) + 1
    return {
        "fecha": fecha,
        "total": len(filas),
        "ok": por_estado.get("OK", 0),
        "parcial": por_estado.get("PARCIAL", 0),
        "error": por_estado.get("ERROR", 0),
        "en_proceso": por_estado.get("EN_PROCESO", 0),
        "por_estado": por_estado,
        "por_cuadrilla": por_cuadrilla,
    }


def ultimo_checklist_por_dispositivo(db: Session, id_central: int) -> list[dict[str, Any]]:
    rn = (
        func.row_number()
        .over(partition_by=SyncLog.dispositivo_id, order_by=SyncLog.iniciado_en.desc())
        .label("rn")
    )
    sub = (
        select(SyncLog.id_sync_log, SyncLog.dispositivo_id, SyncLog.p00, rn)
        .where(SyncLog.id_central == id_central)
        .subquery()
    )
    ids = db.execute(
        select(sub.c.id_sync_log, sub.c.dispositivo_id, sub.c.p00).where(sub.c.rn == 1)
    ).all()
    salida = []
    for id_sync_log, dispositivo_id, p00 in ids:
        s = db.get(SyncLog, id_sync_log)
        salida.append(
            {
                "dispositivo_id": dispositivo_id,
                "p00": p00,
                "id_sync_log": id_sync_log,
                "iniciado_en": s.iniciado_en if s else None,
                "checklist": _checklist(db, id_sync_log),
            }
        )
    return salida
