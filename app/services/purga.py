"""Trabajos de mantenimiento del incremento D-81.

- **Cerrar sesiones colgadas** (`cerrar_sesiones_colgadas`): pasa a `ERROR` las
  `sync_log` que quedaron en `EN_PROCESO` más allá de `sync.timeout_min`
  (CU-D81-01 A1 / C-01).
- **Purga** (`purgar`): borra en lotes (M-09) los mensajes vencidos —salvo los que
  tengan destinatarios sin leer, que se conservan hasta `mensajeria.retencion_max_dias`
  (E-14)— y las `sync_log` fuera de retención (cascada a `sync_check`).

Sin cron en proceso: se invocan desde `POST /mantenimiento/*` (Cloud Scheduler).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import select, text
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from ..models import Auditoria, Configuracion, SyncLog

#: Tamaño de lote del borrado (evita bloquear la tabla).
LOTE = 1000


def _config_int(db: Session, clave: str, defecto: int) -> int:
    valor = db.scalar(select(Configuracion.valor).where(Configuracion.clave == clave))
    try:
        return int(valor) if valor is not None else defecto
    except (TypeError, ValueError):
        return defecto


def cerrar_sesiones_colgadas(db: Session, ahora: datetime | None = None) -> dict[str, Any]:
    """Cierra como ERROR las sesiones que excedieron `sync.timeout_min`."""
    timeout = _config_int(db, "sync.timeout_min", 10)
    ahora = ahora or datetime.now(UTC)
    limite = ahora - timedelta(minutes=timeout)

    filas = list(
        db.scalars(
            select(SyncLog).where(
                SyncLog.estado == "EN_PROCESO", SyncLog.iniciado_en < limite
            )
        ).all()
    )
    for sesion in filas:
        sesion.estado = "ERROR"
        sesion.finalizado_en = ahora
        if sesion.iniciado_en is not None:
            sesion.duracion_ms = int((ahora - sesion.iniciado_en).total_seconds() * 1000)
        sesion.detalle = {**(sesion.detalle or {}), "motivo": "sesión abandonada"}

    db.commit()
    return {"cerradas": len(filas), "timeout_min": timeout}


_PURGA_MENSAJES = text(
    """
    DELETE FROM mensaje
     WHERE id_mensaje IN (
        SELECT m.id_mensaje
          FROM mensaje m
         WHERE m.expira_en < :ahora
           AND (
                m.creado_en < :ahora - make_interval(days => :ret_max)
                OR NOT EXISTS (
                     SELECT 1 FROM mensaje_destino d
                      WHERE d.id_mensaje = m.id_mensaje AND d.leido_en IS NULL
                )
           )
         LIMIT :lote
     )
    """
)

_PURGA_SYNC = text(
    """
    DELETE FROM sync_log
     WHERE id_sync_log IN (
        SELECT id_sync_log
          FROM sync_log
         WHERE iniciado_en < :ahora - make_interval(days => :ret)
         LIMIT :lote
     )
    """
)


def purgar(db: Session, ahora: datetime | None = None) -> dict[str, Any]:
    """Borra en lotes los mensajes vencidos y las `sync_log` fuera de retención."""
    ahora = ahora or datetime.now(UTC)
    ret_msj = _config_int(db, "mensajeria.retencion_dias", 5)
    ret_max = _config_int(db, "mensajeria.retencion_max_dias", 30)
    ret_sync = _config_int(db, "sync_log.retencion_dias", 90)

    mensajes = 0
    while True:
        res = cast(
            "CursorResult[Any]",
            db.execute(_PURGA_MENSAJES, {"ahora": ahora, "ret_max": ret_max, "lote": LOTE}),
        )
        db.commit()
        filas = res.rowcount or 0
        mensajes += filas
        if filas < LOTE:
            break

    sync_logs = 0
    while True:
        res = cast(
            "CursorResult[Any]",
            db.execute(_PURGA_SYNC, {"ahora": ahora, "ret": ret_sync, "lote": LOTE}),
        )
        db.commit()
        filas = res.rowcount or 0
        sync_logs += filas
        if filas < LOTE:
            break

    resultado = {
        "mensajes_eliminados": mensajes,
        "sync_log_eliminadas": sync_logs,
        "retencion_mensajes_dias": ret_msj,
        "retencion_max_dias": ret_max,
        "retencion_sync_dias": ret_sync,
    }
    db.add(
        Auditoria(
            usuario=None,
            accion="MANTENIMIENTO_PURGA",
            entidad="mantenimiento",
            id_entidad=None,
            datos_despues=resultado,
        )
    )
    db.commit()
    return resultado
