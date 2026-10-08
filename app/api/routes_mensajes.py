"""Mensajería interna (RF-41 / D-81).

Unidireccional supervisor → técnicos. El envío lo hacen SUPER/ADMIN/SUPERVISOR; la
recepción (sondeo cada 20 s) y la lectura, los técnicos.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Usuario
from ..schemas.mensajes import (
    BandejaOut,
    LeidosIn,
    LeidosOut,
    MensajeIn,
    MensajeOut,
    MensajeRecibidoOut,
    NoLeidosOut,
)
from ..services import mensajes as svc
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v1/mensajes", tags=["mensajería interna"])

#: El envío es de SUPER/ADMIN/SUPERVISOR; los técnicos solo reciben y leen.
_envio = require_roles("ADMIN", "SUPERVISOR")


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
