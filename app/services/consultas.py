"""Consultas de apoyo compartidas entre la ingesta y la gestión de casos."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Central, Configuracion, Sector, SectorDireccion
from .sectorizacion import Patron


def cargar_config(db: Session) -> dict[str, Any]:
    """Todos los parámetros del sistema como diccionario clave → valor."""
    return {c.clave: c.valor for c in db.scalars(select(Configuracion)).all()}


def resolver_central(db: Session, id_central: int | None, config: dict[str, Any]) -> Central:
    """Central indicada o, si no, la configurada en `ingesta.central_codigo`."""
    if id_central is not None:
        central = db.get(Central, id_central)
    else:
        codigo = str(config.get("ingesta.central_codigo") or "2324X").strip('"')
        central = db.scalar(select(Central).where(Central.codigo_central == codigo))
    if central is None:
        raise HTTPException(status_code=404, detail="Central no encontrada o no configurada")
    return central


def cargar_patrones(db: Session, id_central: int) -> list[Patron]:
    """Patrones activos de los sectores activos de la central, por prioridad."""
    filas = db.execute(
        select(SectorDireccion.id_sector, SectorDireccion.patron,
               SectorDireccion.tipo_coincidencia, SectorDireccion.normalizar)
        .join(Sector, Sector.id_sector == SectorDireccion.id_sector)
        .where(Sector.id_central == id_central, Sector.activo.is_(True),
               SectorDireccion.activo.is_(True))
        .order_by(Sector.prioridad, Sector.nombre)
    ).all()
    return [Patron(id_sector=f[0], patron=f[1], tipo_coincidencia=f[2], normalizar=f[3]) for f in filas]
