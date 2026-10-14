"""Mensajería interna (RF-41 / D-81).

Unidireccional supervisor → técnicos. El envío lo hacen SUPER/ADMIN/SUPERVISOR; la
recepción (sondeo cada 20 s) y la lectura, los técnicos.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Rol, Usuario
from ..schemas.mensajes import (
    BandejaOut,
    LeidosIn,
    LeidosOut,
    MensajeIn,
    MensajeOut,
    MensajeRecibidoOut,
    MensajeSupervisorIn,
    NoLeidosOut,
)
from ..services import mensajes as svc
from ..services.consultas import cargar_config, resolver_central
from .deps import _envio_supervisor, get_current_user, require_roles

router = APIRouter(prefix="/api/v1/mensajes", tags=["mensajería interna"])

#: El envío es de SUPER/ADMIN/SUPERVISOR; los técnicos solo reciben y leen.
_envio = require_roles("ADMIN", "SUPERVISOR")


@router.get("/supervisores", summary="Supervisores de la central del Coordinador")
def listar_supervisores(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_envio_supervisor),
) -> list[dict[str, str | None]]:
    central = resolver_central(db, None, cargar_config(db), usuario)
    filas = db.execute(
        select(Usuario.p00, Usuario.nombre, Usuario.apellido)
        .join(Rol, Rol.id_rol == Usuario.id_rol)
        .where(
            Usuario.id_central == central.id_central,
            Usuario.activo.is_(True),
            Rol.codigo == "SUPERVISOR",
        )
        .order_by(Usuario.nombre, Usuario.apellido, Usuario.p00)
    ).all()
    return [
        {"p00": p00, "nombre": nombre, "apellido": apellido}
        for p00, nombre, apellido in filas
    ]


@router.post("/supervisor", response_model=MensajeOut, status_code=status.HTTP_201_CREATED,
             summary="Coordinador: enviar mensaje al Supervisor (DEC-G9 / DEC-G15)")
def enviar_a_supervisor_endpoint(
    datos: MensajeSupervisorIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_envio_supervisor),
) -> MensajeOut:
    return MensajeOut.model_validate(svc.enviar_a_supervisor(db, usuario, datos.model_dump()))


@router.get("", response_model=list[MensajeRecibidoOut], summary="Sondeo incremental (60 s)")
def listar(
    desde: int | None = Query(default=None, description="Último id visto"),
    ultimos: int | None = Query(
        default=None, ge=1, le=200,
        description="D-86: los N más recientes (primera carga de la APK)",
    ),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> list[dict]:
    return svc.recibidos(db, usuario, desde=desde, limit=limit, ultimos=ultimos)


@router.get("/no-leidos", response_model=NoLeidosOut, summary="Contador de no leídos")
def no_leidos(
    db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
) -> NoLeidosOut:
    return NoLeidosOut(total=svc.contar_no_leidos(db, usuario))


@router.get("/bandeja", response_model=BandejaOut, summary="Mensajes enviados por el autor")
def bandeja(
    db: Session = Depends(get_db), usuario: Usuario = Depends(_envio)
) -> BandejaOut:
    items = svc.bandeja(db, usuario)
    return BandejaOut(total=len(items), items=[MensajeOut.model_validate(m) for m in items])


@router.post("", response_model=MensajeOut, status_code=status.HTTP_201_CREATED,
             summary="Enviar un mensaje interno")
def enviar(
    datos: MensajeIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_envio),
) -> MensajeOut:
    return MensajeOut.model_validate(svc.enviar_manual(db, usuario, datos.model_dump()))


@router.post("/leidos", response_model=LeidosOut, summary="Marcar varios como leídos")
def marcar_varios(
    datos: LeidosIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> LeidosOut:
    return LeidosOut(actualizados=svc.marcar_leidos(db, usuario, datos.ids))


@router.post("/{id_mensaje}/leido", status_code=status.HTTP_204_NO_CONTENT,
             summary="Marcar un mensaje como leído (idempotente)")
def marcar_uno(
    id_mensaje: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> None:
    svc.marcar_leido(db, usuario, id_mensaje)
