"""Mensajería interna (RF-41 / D-81).

Unidireccional **supervisor → técnicos**. Al emitir un mensaje se materializa su
**fan-out** de destinatarios en `mensaje_destino` (sondeo 20 s incremental y
conteo de no leídos baratos). Los mensajes automáticos (estado de sync,
recordatorios de cita y alarmas de despacho) son **idempotentes** por `dedupe_key`.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import (
    Cita,
    Configuracion,
    Cuadrilla,
    CuadrillaSectorDia,
    CuadrillaTecnico,
    FallaMasiva,
    Mensaje,
    MensajeDestino,
    Rol,
    SyncLog,
    Tecnico,
    Usuario,
)


def _config_int(db: Session, clave: str, defecto: int) -> int:
    valor = db.scalar(select(Configuracion.valor).where(Configuracion.clave == clave))
    try:
        return int(valor) if valor is not None else defecto
    except (TypeError, ValueError):
        return defecto


def _tz() -> ZoneInfo:
    try:
        return ZoneInfo(get_settings().app_timezone)
    except Exception:  # ZoneInfoNotFoundError, p. ej. sin tzdata
        return ZoneInfo("UTC")


# --------------------------------------------------------------------------- #
# Creación y fan-out
# --------------------------------------------------------------------------- #
def resolver_destinatarios(db: Session, m: Mensaje) -> list[int]:
    """IDs de los técnicos destinatarios según el `destino_tipo`."""
    if m.destino_tipo == "TECNICO":
        return [m.id_tecnico] if m.id_tecnico else []

    if m.destino_tipo == "CUADRILLA":
        if not m.id_cuadrilla:
            return []
        hoy = date.today()
        miembros = db.scalars(
            select(CuadrillaTecnico.id_tecnico).where(
                CuadrillaTecnico.id_cuadrilla == m.id_cuadrilla,
                (CuadrillaTecnico.hasta.is_(None)) | (CuadrillaTecnico.hasta >= hoy),
            )
        ).all()
        return sorted({int(i) for i in miembros})

    # TODOS: técnicos con cuenta activa en la central.
    cuentas = db.scalars(
        select(Usuario.id_tecnico)
        .join(Rol, Rol.id_rol == Usuario.id_rol)
        .where(
            Usuario.id_central == m.id_central,
            Usuario.activo.is_(True),
            Rol.codigo == "TECNICO",
            Usuario.id_tecnico.isnot(None),
        )
    ).all()
    return sorted({int(i) for i in cuentas if i is not None})


def crear_mensaje(
    db: Session,
    *,
    id_central: int,
    origen_p00: str | None,
    destino_tipo: str,
    tipo: str,
    cuerpo: str,
    id_cuadrilla: int | None = None,
    id_tecnico: int | None = None,
    id_caso: int | None = None,
    dedupe_key: str | None = None,
    ahora: datetime | None = None,
) -> Mensaje:
    """Crea el mensaje y materializa su fan-out. Idempotente si hay `dedupe_key`."""
    ahora = ahora or datetime.now(UTC)
    if dedupe_key:
        existente = db.scalar(select(Mensaje).where(Mensaje.dedupe_key == dedupe_key))
        if existente is not None:
            return existente

    dias = _config_int(db, "mensajeria.retencion_dias", 5)
    m = Mensaje(
        id_central=id_central,
        origen_p00=origen_p00,
        destino_tipo=destino_tipo,
        id_cuadrilla=id_cuadrilla if destino_tipo == "CUADRILLA" else None,
        id_tecnico=id_tecnico if destino_tipo == "TECNICO" else None,
        tipo=tipo,
        cuerpo=cuerpo[:500],
        id_caso=id_caso,
        dedupe_key=dedupe_key,
        creado_en=ahora,
        expira_en=ahora + timedelta(days=dias),
    )
    db.add(m)
    db.flush()
    for idt in resolver_destinatarios(db, m):
        db.add(MensajeDestino(id_mensaje=m.id_mensaje, id_tecnico=idt))
    db.commit()
    db.refresh(m)
    return m


def enviar_manual(db: Session, usuario: Usuario, datos: dict[str, Any]) -> Mensaje:
    """Envío manual de un mensaje (SUPER/ADMIN/SUPERVISOR)."""
    if usuario.id_central is None:
        raise HTTPException(status_code=422, detail="El usuario no tiene central asignada")
    destino = datos["destino_tipo"]
    id_cuadrilla = datos.get("id_cuadrilla")
    id_tecnico = datos.get("id_tecnico")
    cuerpo = (datos.get("cuerpo") or "").strip()
    if not cuerpo:
        raise HTTPException(status_code=422, detail="El mensaje no puede estar vacío")

    if destino == "TODOS":
        if id_cuadrilla or id_tecnico:
            raise HTTPException(status_code=422, detail="El destino TODOS no admite ids")
    elif destino == "CUADRILLA":
        if not id_cuadrilla:
            raise HTTPException(status_code=422, detail="Falta id_cuadrilla para el destino CUADRILLA")
        c = db.get(Cuadrilla, id_cuadrilla)
        if c is None or c.id_central != usuario.id_central:
            raise HTTPException(status_code=404, detail="Cuadrilla no encontrada")
    elif destino == "TECNICO":
        if not id_tecnico:
            raise HTTPException(status_code=422, detail="Falta id_tecnico para el destino TECNICO")
        t = db.get(Tecnico, id_tecnico)
        if t is None or t.id_central != usuario.id_central:
            raise HTTPException(status_code=404, detail="Técnico no encontrado")
    else:
        raise HTTPException(status_code=422, detail="Destino inválido")

    return crear_mensaje(
        db,
        id_central=usuario.id_central,
        origen_p00=usuario.p00,
        destino_tipo=destino,
        tipo="TEXTO",
        cuerpo=cuerpo,
        id_cuadrilla=id_cuadrilla,
        id_tecnico=id_tecnico,
        id_caso=datos.get("id_caso"),
    )


# --------------------------------------------------------------------------- #
# Recepción (sondeo incremental), lectura y contadores
# --------------------------------------------------------------------------- #
def _recibido(m: Mensaje, leido_en: datetime | None) -> dict[str, Any]:
    return {
        "id_mensaje": m.id_mensaje,
        "id_central": m.id_central,
        "origen_p00": m.origen_p00,
        "destino_tipo": m.destino_tipo,
        "id_cuadrilla": m.id_cuadrilla,
        "id_tecnico": m.id_tecnico,
        "tipo": m.tipo,
        "cuerpo": m.cuerpo,
        "id_caso": m.id_caso,
        "creado_en": m.creado_en,
        "expira_en": m.expira_en,
        "leido": leido_en is not None,
    }


def recibidos(
    db: Session, usuario: Usuario, desde: int | None = None, limit: int = 50,
    ultimos: int | None = None,
) -> list[dict[str, Any]]:
    """Sondeo incremental: mensajes del técnico con `id_mensaje > desde` y vigentes.

    D-86: con `ultimos=N` se devuelven los **N más recientes** (y en orden
    ascendente), que es lo que necesita la **primera carga** de la APK. Antes la
    APK pedía `desde=0` y recibía los N **más antiguos**, así que con más de N
    mensajes los recientes tardaban varios ciclos de sondeo en aparecer.
    """
    if usuario.id_tecnico is None:
        return []
    ahora = datetime.now(UTC)
    base = (
        select(Mensaje, MensajeDestino.leido_en)
        .join(MensajeDestino, MensajeDestino.id_mensaje == Mensaje.id_mensaje)
        .where(
            MensajeDestino.id_tecnico == usuario.id_tecnico,
            Mensaje.expira_en > ahora,
        )
    )
    if ultimos is not None:
        recientes = list(
            db.execute(base.order_by(Mensaje.id_mensaje.desc()).limit(ultimos)).all()
        )
        recientes.reverse()  # se entregan en orden cronológico
        return [_recibido(m, leido) for m, leido in recientes]
    if desde is not None:
        base = base.where(Mensaje.id_mensaje > desde)
    filas = db.execute(base.order_by(Mensaje.id_mensaje).limit(limit)).all()
    return [_recibido(m, leido) for m, leido in filas]


def marcar_leido(db: Session, usuario: Usuario, id_mensaje: int) -> None:
    if usuario.id_tecnico is None:
        raise HTTPException(status_code=403, detail="Su usuario no es un técnico")
    fila = db.get(MensajeDestino, (id_mensaje, usuario.id_tecnico))
    if fila is None:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if fila.leido_en is None:
        fila.leido_en = datetime.now(UTC)
        db.commit()


def marcar_leidos(db: Session, usuario: Usuario, ids: list[int]) -> int:
    if usuario.id_tecnico is None:
        return 0
    filas = db.scalars(
        select(MensajeDestino).where(
            MensajeDestino.id_tecnico == usuario.id_tecnico,
            MensajeDestino.id_mensaje.in_(ids),
            MensajeDestino.leido_en.is_(None),
        )
    ).all()
    ahora = datetime.now(UTC)
    for f in filas:
        f.leido_en = ahora
    db.commit()
    return len(filas)


def contar_no_leidos(db: Session, usuario: Usuario) -> int:
    if usuario.id_tecnico is None:
        return 0
    ahora = datetime.now(UTC)
    return int(
        db.scalar(
            select(func.count())
            .select_from(MensajeDestino)
            .join(Mensaje, Mensaje.id_mensaje == MensajeDestino.id_mensaje)
            .where(
                MensajeDestino.id_tecnico == usuario.id_tecnico,
                MensajeDestino.leido_en.is_(None),
                Mensaje.expira_en > ahora,
            )
        )
        or 0
    )


def bandeja(db: Session, usuario: Usuario, limit: int = 100) -> list[Mensaje]:
    return list(
        db.scalars(
            select(Mensaje)
            .where(Mensaje.origen_p00 == usuario.p00)
            .order_by(Mensaje.id_mensaje.desc())
            .limit(limit)
        ).all()
    )


# --------------------------------------------------------------------------- #
# Mensajes automáticos (idempotentes por `dedupe_key`)
# --------------------------------------------------------------------------- #
def emitir_estado_sync(db: Session, sesion: SyncLog) -> Mensaje | None:
    """Mensaje ESTADO_SYNC al técnico que acaba de sincronizar (CU-D81-06)."""
    u = db.scalar(select(Usuario).where(Usuario.p00 == sesion.p00))
    if u is None or u.id_tecnico is None or u.id_central is None:
        return None
    cuerpo = (
        f"Sincronización {sesion.tipo}: {sesion.estado} · "
        f"{sesion.procesados} proc., {sesion.errores} err."
    )
    return crear_mensaje(
        db,
        id_central=u.id_central,
        origen_p00=None,
        destino_tipo="TECNICO",
        tipo="ESTADO_SYNC",
        cuerpo=cuerpo,
        id_tecnico=u.id_tecnico,
        dedupe_key=f"SYNC:{sesion.id_sync_log}",
    )


def emitir_recordatorios_citas(db: Session, ahora: datetime | None = None) -> dict[str, int]:
    """Recordatorios de citas próximas del día (idempotente por `recordatorio_para`)."""
    ahora = ahora or datetime.now(UTC)
    min_aviso = _config_int(db, "mensajeria.recordatorio_cita_min", 60)
    limite = ahora + timedelta(minutes=min_aviso)
    citas = db.scalars(
        select(Cita).where(
            Cita.id_cuadrilla.isnot(None),
            Cita.estado.in_(("PROPUESTA", "CONFIRMADA")),
            Cita.fecha_hora >= ahora,
            Cita.fecha_hora <= limite,
        )
    ).all()
    emitidos = 0
    for c in citas:
        if c.recordatorio_para == c.fecha_hora:
            continue
        central = db.scalar(
            select(Cuadrilla.id_central).where(Cuadrilla.id_cuadrilla == c.id_cuadrilla)
        )
        if central is None:
            continue
        cuerpo = f"Recordatorio de cita {c.fecha_hora:%d/%m %H:%M} en su cuadrilla."
        crear_mensaje(
            db,
            id_central=central,
            origen_p00=None,
            destino_tipo="CUADRILLA",
            tipo="RECORDATORIO_CITA",
            cuerpo=cuerpo,
            id_cuadrilla=c.id_cuadrilla,
            id_caso=c.id_caso,
            dedupe_key=f"CITA:{c.id_cita}:{c.fecha_hora.isoformat()}",
            ahora=ahora,
        )
        c.recordatorio_para = c.fecha_hora
        emitidos += 1
    db.commit()
    return {"recordatorios": emitidos}


def emitir_alarmas_despacho(db: Session, ahora: datetime | None = None) -> dict[str, int]:
    """Alarmas por falla masiva hacia la cuadrilla que cubre su sector (idempotente)."""
    ahora = ahora or datetime.now(UTC)
    fallas = db.scalars(
        select(FallaMasiva).where(
            FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")),
            FallaMasiva.id_sector.isnot(None),
        )
    ).all()
    emitidos = 0
    for f in fallas:
        dia = f.fecha_deteccion.date() if f.fecha_deteccion else ahora.date()
        id_cuadrilla = f.id_cuadrilla
        if id_cuadrilla is None:
            id_cuadrilla = db.scalar(
                select(CuadrillaSectorDia.id_cuadrilla)
                .where(CuadrillaSectorDia.fecha == dia, CuadrillaSectorDia.id_sector == f.id_sector)
                .limit(1)
            )
        if id_cuadrilla is None:
            continue
        clave = f"FALLA:{f.id_falla}:{id_cuadrilla}:{dia.isoformat()}"
        if db.scalar(select(Mensaje.id_mensaje).where(Mensaje.dedupe_key == clave)) is not None:
            continue  # ya emitida
        cuerpo = f"Alarma: {f.descripcion[:120]}"
        crear_mensaje(
            db,
            id_central=f.id_central,
            origen_p00=None,
            destino_tipo="CUADRILLA",
            tipo="ALARMA_DESPACHO",
            cuerpo=cuerpo,
            id_cuadrilla=id_cuadrilla,
            dedupe_key=clave,
            ahora=ahora,
        )
        emitidos += 1
    db.commit()
    return {"alarmas": emitidos}
