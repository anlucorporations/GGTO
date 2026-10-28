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
from ..services import jornada as svc_jornada
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


@router.post("/purgar", summary="Purga y anonimiza según la retención por entidad")
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


@router.post("/cierre-jornada",
             summary="Corte nocturno: los casos no atendidos (CERRADO y ENRUTADO incluidos) "
                     "vuelven a PENDIENTE y las masivas pierden su cuadrilla (D-160)")
def cierre_jornada(
    db: Session = Depends(get_db), _: None = Depends(verificar_token)
) -> dict:
    """Job de las **23:00** (Cloud Scheduler, D-160).

    Recorre **todas** las centrales con `solo_vencidos=False`: cada despacho
    abierto se cierra y **todos** sus casos —CERRADO y ENRUTADO incluidos—
    vuelven a `PENDIENTE` con la asignación anulada (`DEVUELTO`, D-157), y las
    fallas masivas activas quedan sin cuadrilla. Idempotente: un segundo
    disparo no cambia nada (los despachos ya quedaron `CERRADO`).
    """
    resultado = svc_jornada.cerrar_jornada(db, solo_vencidos=False)
    db.commit()
    return resultado
