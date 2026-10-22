"""Trabajos de mantenimiento: purga y anonimización por retención (D-81 · D-153).

- **Cerrar sesiones colgadas** (`cerrar_sesiones_colgadas`): pasa a `ERROR` las
  `sync_log` que quedaron en `EN_PROCESO` más allá de `sync.timeout_min`
  (CU-D81-01 A1 / C-01).
- **Purga** (`purgar`): aplica la retención de `requerimientos.md` §5.1 sobre
  todas las entidades con PII, en lotes de `LOTE` filas:
  - elimina mensajes vencidos (salvo destinatarios sin leer hasta
    `mensajeria.retencion_max_dias`), `sync_log`, `notificacion`, `evidencia`
    (con su imagen) y `auditoria`;
  - anonimiza `caso`, `actividad`, `solicitante` e `identificador_pago` cuando
    superan su plazo, conservando los datos operativos y de conciliación.

Sin cron en proceso: se invocan desde `POST /mantenimiento/*` (Cloud Scheduler).
Las retenciones se leen de `configuracion` y caen a los plazos por defecto de
`requerimientos.md` si la clave no existe.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import delete, select, text
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from ..models import Auditoria, Configuracion, Evidencia, SyncLog
from . import storage as svc_storage

#: Tamaño de lote del borrado (evita bloquear la tabla).
LOTE = 1000

#: Marca que reemplaza los datos personales de un registro anonimizado.
ANONIMIZADO = "[ANONIMIZADO]"


def _config_int(db: Session, clave: str, defecto: int) -> int:
    valor = db.scalar(select(Configuracion.valor).where(Configuracion.clave == clave))
    try:
        return int(valor) if valor is not None else defecto
    except (TypeError, ValueError):
        return defecto


def _ejecutar_lotes(db: Session, sql: Any, params: dict[str, Any]) -> int:
    """Ejecuta un DELETE/UPDATE por lotes hasta agotar las filas elegibles."""
    total = 0
    while True:
        res = cast(
            "CursorResult[Any]", db.execute(sql, {**params, "lote": LOTE})
        )
        db.commit()
        filas = res.rowcount or 0
        total += filas
        if filas < LOTE:
            break
    return total


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

_PURGA_AUDITORIA = text(
    """
    DELETE FROM auditoria
     WHERE id_auditoria IN (
        SELECT id_auditoria
          FROM auditoria
         WHERE fecha_hora < :ahora - make_interval(days => :ret)
         LIMIT :lote
     )
    """
)

_PURGA_NOTIFICACIONES = text(
    """
    DELETE FROM notificacion
     WHERE id_notificacion IN (
        SELECT id_notificacion
          FROM notificacion
         WHERE creado_en < :ahora - make_interval(days => :ret)
         LIMIT :lote
     )
    """
)

_ANON_CASOS = text(
    """
    UPDATE caso
       SET nombre_cliente = NULL,
           telefono = NULL,
           contacto_cliente = NULL,
           persona_reporta = NULL,
           direccion = NULL,
           serial = NULL,
           ultimo_comentario = NULL,
           informacion = NULL,
           results = NULL,
           problema_reporte = NULL,
           telefono_oficina = NULL,
           telefono_movil = NULL,
           asignado_a = NULL,
           despacho_nombre = NULL,
           despacho_apellido = NULL,
           ayudantes = '[]'::jsonb,
           actualizado_en = :ahora
     WHERE id_caso IN (
        SELECT id_caso
          FROM caso
         WHERE COALESCE(fecha_reporte, creado_en) < :ahora - make_interval(days => :ret)
           AND (
                nombre_cliente IS NOT NULL
                OR telefono IS NOT NULL
                OR contacto_cliente IS NOT NULL
                OR persona_reporta IS NOT NULL
                OR direccion IS NOT NULL
                OR serial IS NOT NULL
                OR ultimo_comentario IS NOT NULL
                OR informacion IS NOT NULL
                OR results IS NOT NULL
                OR problema_reporte IS NOT NULL
                OR telefono_oficina IS NOT NULL
                OR telefono_movil IS NOT NULL
                OR asignado_a IS NOT NULL
                OR despacho_nombre IS NOT NULL
                OR despacho_apellido IS NOT NULL
                OR ayudantes <> '[]'::jsonb
           )
         LIMIT :lote
     )
    """
)

_ANON_ACTIVIDADES = text(
    """
    UPDATE actividad
       SET reporte_corto = NULL,
           latitud = NULL,
           longitud = NULL
     WHERE id_actividad IN (
        SELECT id_actividad
          FROM actividad
         WHERE fecha_hora < :ahora - make_interval(days => :ret)
           AND (reporte_corto IS NOT NULL OR latitud IS NOT NULL OR longitud IS NOT NULL)
         LIMIT :lote
     )
    """
)

_ANON_SOLICITANTES = text(
    """
    UPDATE solicitante
       SET nombre = :marca,
           contacto = :marca,
           documento = NULL,
           actualizado_en = :ahora
     WHERE id_solicitante IN (
        SELECT s.id_solicitante
          FROM solicitante s
         WHERE s.creado_en < :ahora - make_interval(days => :ret)
           AND (s.nombre <> :marca OR s.contacto <> :marca OR s.documento IS NOT NULL)
           AND NOT EXISTS (
                SELECT 1
                  FROM caso_especial ce
                 WHERE ce.id_solicitante = s.id_solicitante
                   AND ce.creado_en >= :ahora - make_interval(days => :ret)
           )
         LIMIT :lote
     )
    """
)

_ANON_PAGOS = text(
    """
    UPDATE identificador_pago
       SET nombre_titular = NULL,
           direccion_principal = NULL,
           actualizado_en = :ahora
     WHERE id_pago IN (
        SELECT ip.id_pago
          FROM identificador_pago ip
         WHERE ip.creado_en < :ahora - make_interval(days => :ret)
           AND (ip.nombre_titular IS NOT NULL OR ip.direccion_principal IS NOT NULL)
           AND NOT EXISTS (
                SELECT 1
                  FROM caso c
                 WHERE c.id_pago = ip.id_pago
                   AND COALESCE(c.fecha_reporte, c.creado_en) >= :ahora - make_interval(days => :ret)
           )
         LIMIT :lote
     )
    """
)


def _purgar_evidencias(db: Session, ahora: datetime, ret_dias: int) -> tuple[int, int]:
    """Borra la imagen y la fila de las evidencias fuera de retención.

    Devuelve `(eliminadas, pendientes)`. Una evidencia cuyo objeto no se pudo
    borrar se conserva para el siguiente intento en vez de perder su referencia.
    """
    limite = ahora - timedelta(days=ret_dias)
    eliminadas = 0
    pendientes: set[int] = set()
    while True:
        filas = list(
            db.scalars(
                select(Evidencia)
                .where(Evidencia.fecha_hora < limite)
                .order_by(Evidencia.fecha_hora)
                .limit(LOTE)
            ).all()
        )
        if not filas:
            break
        ids: list[int] = []
        for evidencia in filas:
            if evidencia.id_evidencia in pendientes:
                continue
            ruta = evidencia.ruta_remota or evidencia.ruta_local or ""
            if svc_storage.borrar_evidencia(ruta):
                ids.append(evidencia.id_evidencia)
            else:
                pendientes.add(evidencia.id_evidencia)
        if not ids:
            break
        db.execute(delete(Evidencia).where(Evidencia.id_evidencia.in_(ids)))
        db.commit()
        eliminadas += len(ids)
        if len(filas) < LOTE:
            break
    return eliminadas, len(pendientes)


def purgar(db: Session, ahora: datetime | None = None) -> dict[str, Any]:
    """Aplica la retención declarada: purga lo vencido y anonimiza lo que aplica."""
    ahora = ahora or datetime.now(UTC)
    ret_msj = _config_int(db, "mensajeria.retencion_dias", 5)
    ret_max = _config_int(db, "mensajeria.retencion_max_dias", 30)
    ret_sync = _config_int(db, "sync_log.retencion_dias", 90)
    # H-25: la auditoría se conserva 3 años, no 365 días.
    ret_auditoria = _config_int(db, "auditoria.retencion_dias", 1095)
    ret_notificacion = _config_int(db, "notificacion.retencion_dias", 365)
    ret_evidencia = _config_int(db, "evidencia.retencion_dias", 730)
    ret_caso = _config_int(db, "caso.retencion_dias", 1825)
    ret_actividad = _config_int(db, "actividad.retencion_dias", 1825)
    ret_solicitante = _config_int(db, "solicitante.retencion_dias", 1825)
    ret_pago = _config_int(db, "identificador_pago.retencion_dias", 1825)

    mensajes = _ejecutar_lotes(
        db, _PURGA_MENSAJES, {"ahora": ahora, "ret_max": ret_max}
    )
    sync_logs = _ejecutar_lotes(db, _PURGA_SYNC, {"ahora": ahora, "ret": ret_sync})
    auditorias = _ejecutar_lotes(
        db, _PURGA_AUDITORIA, {"ahora": ahora, "ret": ret_auditoria}
    )
    notificaciones = _ejecutar_lotes(
        db, _PURGA_NOTIFICACIONES, {"ahora": ahora, "ret": ret_notificacion}
    )
    evidencias, evidencias_pendientes = _purgar_evidencias(db, ahora, ret_evidencia)
    casos = _ejecutar_lotes(db, _ANON_CASOS, {"ahora": ahora, "ret": ret_caso})
    actividades = _ejecutar_lotes(
        db, _ANON_ACTIVIDADES, {"ahora": ahora, "ret": ret_actividad}
    )
    solicitantes = _ejecutar_lotes(
        db,
        _ANON_SOLICITANTES,
        {"ahora": ahora, "ret": ret_solicitante, "marca": ANONIMIZADO},
    )
    pagos = _ejecutar_lotes(db, _ANON_PAGOS, {"ahora": ahora, "ret": ret_pago})

    resultado = {
        "mensajes_eliminados": mensajes,
        "sync_log_eliminadas": sync_logs,
        "auditorias_eliminadas": auditorias,
        "notificaciones_eliminadas": notificaciones,
        "evidencias_eliminadas": evidencias,
        "evidencias_pendientes": evidencias_pendientes,
        "casos_anonimizados": casos,
        "actividades_anonimizadas": actividades,
        "solicitantes_anonimizados": solicitantes,
        "pagos_anonimizados": pagos,
        "retencion_mensajes_dias": ret_msj,
        "retencion_max_dias": ret_max,
        "retencion_sync_dias": ret_sync,
        "retencion_auditoria_dias": ret_auditoria,
        "retencion_notificacion_dias": ret_notificacion,
        "retencion_evidencia_dias": ret_evidencia,
        "retencion_caso_dias": ret_caso,
        "retencion_actividad_dias": ret_actividad,
        "retencion_solicitante_dias": ret_solicitante,
        "retencion_pago_dias": ret_pago,
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
