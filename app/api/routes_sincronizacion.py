"""SINCRONIZACIÓN — log de sincronizaciones de la APK (RF-39 / CU-D81-02).

Acceso para **ADMIN/SUPERVISOR/SUPER** (la inspección de la base de datos de
SISTEMAS sigue siendo **exclusiva del Super Usuario** — D-69). Todas las consultas
se **acotan a la central** del usuario (RNF-21).
"""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Usuario
from ..services import sincronizacion as svc
from .deps import require_roles

router = APIRouter(prefix="/api/v1/sincronizaciones", tags=["sincronización"])

#: Solo ADMIN/SUPERVISOR (SUPER pasa por la regla de acceso total).
_gestion = require_roles("ADMIN", "SUPERVISOR")


def _parsear_dt(valor: str | None) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Fecha inválida") from exc


@router.get("", summary="Listado paginado del log de sincronizaciones")
def listar(
    p00: str | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None),
    dispositivo_id: str | None = Query(default=None),
    tipo: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    orden: str = Query(default="iniciado_en_desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_gestion),
) -> dict:
    idc = usuario.id_central
    if idc is None:
        return {"total": 0, "page": page, "page_size": page_size, "pages": 0, "items": []}
    return svc.listar(
        db,
        id_central=idc,
        p00=p00,
        id_cuadrilla=id_cuadrilla,
        dispositivo_id=dispositivo_id,
        tipo=tipo,
        estado=estado,
        desde=_parsear_dt(desde),
        hasta=_parsear_dt(hasta),
        orden=orden,
        page=page,
        page_size=page_size,
    )


@router.get("/resumen", summary="KPIs de sincronización de una fecha")
def resumen(
    fecha: date | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_gestion),
) -> dict:
    idc = usuario.id_central
    if idc is None:
        return {"fecha": fecha, "total": 0}
    return svc.resumen(db, id_central=idc, fecha=fecha)


@router.get("/checklist", summary="Último checklist por dispositivo")
def checklist(
    db: Session = Depends(get_db), usuario: Usuario = Depends(_gestion)
) -> dict:
    idc = usuario.id_central
    if idc is None:
        return {"items": []}
    return {"items": svc.ultimo_checklist_por_dispositivo(db, idc)}


@router.get("/{id_sync_log}", summary="Detalle de una sesión (incluye el checklist)")
def detalle(
    id_sync_log: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_gestion),
) -> dict:
    idc = usuario.id_central
    if idc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada")
    datos = svc.detalle(db, id_sync_log, idc)
    if datos is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada")
    return datos
