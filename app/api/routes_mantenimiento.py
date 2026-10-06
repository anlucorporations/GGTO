"""MANTENIMIENTO — trabajos periódicos invocados por Cloud Scheduler (D-81).

Rutas **fuera del esquema OpenAPI** (`include_in_schema=False`) y protegidas por el
header `X-Mantenimiento-Token` comparado en tiempo constante. Si el token no está
configurado, responden **503** (fail-closed, nunca abiertas).
"""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.db import get_db
from ..services import mensajes as svc_mensajes
from ..services import purga as svc

router = APIRouter(
    prefix="/api/v1/mantenimiento", tags=["mantenimiento"], include_in_schema=False
)


def verificar_token(
    x_mantenimiento_token: str | None = Header(default=None, alias="X-Mantenimiento-Token"),
) -> None:
    esperado = get_settings().mantenimiento_token
    if not esperado:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mantenimiento no configurado (falta MANTENIMIENTO_TOKEN)",
        )
    if not x_mantenimiento_token or not secrets.compare_digest(x_mantenimiento_token, esperado):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de mantenimiento inválido",
        )


@router.post("/cerrar-sesiones", summary="Cierra sesiones de sincronización colgadas")
def cerrar_sesiones(
    db: Session = Depends(get_db), _: None = Depends(verificar_token)
) -> dict:
    return svc.cerrar_sesiones_colgadas(db)


@router.post("/purgar", summary="Purga mensajes vencidos y log fuera de retención")
def purgar(db: Session = Depends(get_db), _: None = Depends(verificar_token)) -> dict:
    return svc.purgar(db)


@router.post("/recordatorios-citas", summary="Emite recordatorios de citas del día")
def recordatorios_citas(
    db: Session = Depends(get_db), _: None = Depends(verificar_token)
) -> dict:
    return svc_mensajes.emitir_recordatorios_citas(db)


@router.post("/alarmas-despacho", summary="Emite alarmas de fallas por sector del despacho")
def alarmas_despacho(
    db: Session = Depends(get_db), _: None = Depends(verificar_token)
) -> dict:
    return svc_mensajes.emitir_alarmas_despacho(db)
