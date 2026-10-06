"""PANEL — gestión diaria del supervisor (RF-43 / D-81)."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Usuario
from ..services import panel as svc
from .deps import require_roles

router = APIRouter(prefix="/api/v1/panel", tags=["panel"])

_gestion = require_roles("ADMIN", "SUPERVISOR")


@router.get("/gestion-diaria", summary="Gestión diaria: Asignadas vs. Cerradas por cuadrilla")
def gestion_diaria(
    fecha: date | None = Query(default=None),
    modo: str = Query(default="COMUN"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_gestion),
) -> dict:
    modo = modo.upper()
    if modo not in svc.MODOS:
        raise HTTPException(status_code=422, detail="Modo inválido: use COMUN o REFERIDOS")
    idc = usuario.id_central
    if idc is None:
        return {
            "fecha": fecha,
            "modo": modo,
            "cuadrillas": [],
            "totales": {"asignadas": 0, "cerradas": 0, "porcentaje": 0.0},
        }
    return svc.gestion_diaria(db, id_central=idc, fecha=fecha, modo=modo)
