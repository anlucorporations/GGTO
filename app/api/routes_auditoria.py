"""Rutas de auditoría del sistema (D-95 / RT-APK-06 / DEC-G17).

Exclusivo para el Super Usuario (SUPER) en solo lectura.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Auditoria, Usuario
from ..schemas.auditoria import AuditoriaListOut, AuditoriaOut
from .deps import _auditoria_lectura

router = APIRouter(prefix="/api/v1/auditoria", tags=["auditoría"])


@router.get("", response_model=AuditoriaListOut, summary="Consultar traza de auditoría (solo SUPER)")
def listar_auditoria(
    usuario_filtro: str | None = Query(
        default=None, alias="usuario", description="Filtrar por P00 del actor"
    ),
    accion: str | None = Query(default=None, description="Filtrar por acción realizada"),
    entidad: str | None = Query(default=None, description="Filtrar por entidad afectada"),
    id_entidad: str | None = Query(default=None, description="Filtrar por ID de la entidad"),
    id_central: int | None = Query(default=None, description="Filtrar por central"),
    desde: datetime | None = Query(default=None, description="Fecha/hora inicio"),
    hasta: datetime | None = Query(default=None, description="Fecha/hora fin"),
    page: int = Query(default=1, ge=1, description="Número de página"),
    page_size: int = Query(default=50, ge=1, le=200, description="Tamaño de página"),
    db: Session = Depends(get_db),
    _super: Usuario = Depends(_auditoria_lectura),
) -> AuditoriaListOut:
    stmt = select(Auditoria)
    if usuario_filtro:
        stmt = stmt.where(Auditoria.usuario == usuario_filtro)
    if accion:
        stmt = stmt.where(Auditoria.accion == accion)
    if entidad:
        stmt = stmt.where(Auditoria.entidad == entidad)
    if id_entidad:
        stmt = stmt.where(Auditoria.id_entidad == id_entidad)
    if id_central is not None:
        stmt = stmt.where(Auditoria.id_central == id_central)
    if desde:
        stmt = stmt.where(Auditoria.fecha_hora >= desde)
    if hasta:
        stmt = stmt.where(Auditoria.fecha_hora <= hasta)

    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    offset = (page - 1) * page_size
    items = db.scalars(stmt.order_by(Auditoria.fecha_hora.desc()).offset(offset).limit(page_size)).all()

    return AuditoriaListOut(
        total=total,
        page=page,
        page_size=page_size,
        items=[AuditoriaOut.model_validate(it) for it in items],
    )
