"""SISTEMAS — inspección de la base de datos (solo Super Usuario, D-69).

Rutas de diagnóstico para el Super Usuario: estructura general del esquema y
ficha por tabla (estructura + contenido paginado con las columnas sensibles
ofuscadas). No exponen escritura alguna.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Usuario
from ..services import sistemas as svc
from .deps import require_roles

router = APIRouter(prefix="/api/v1/sistemas", tags=["sistemas"])

# `require_roles()` sin argumentos deja la sección exclusivamente en manos del
# Super Usuario: los demás roles no están listados y SUPER pasa por la regla de
# acceso total de `deps.py`.
_solo_super = require_roles()


@router.get("/estructura", summary="Análisis de la estructura de la base de datos")
def estructura(db: Session = Depends(get_db), _: Usuario = Depends(_solo_super)) -> dict:
    try:
        return svc.resumen_estructura(db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No fue posible analizar la estructura: {type(exc).__name__}",
        ) from exc


@router.get("/tablas", summary="Listado de tablas del esquema público")
def listado_tablas(db: Session = Depends(get_db), _: Usuario = Depends(_solo_super)) -> dict:
    nombres = svc.tablas(db)
    return {"total": len(nombres), "tablas": nombres}


@router.get("/tabla/{nombre}", summary="Estructura de una tabla")
def detalle(nombre: str, db: Session = Depends(get_db), _: Usuario = Depends(_solo_super)) -> dict:
    try:
        return svc.detalle_tabla(db, nombre)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/tabla/{nombre}/datos", summary="Contenido paginado de una tabla")
def datos(
    nombre: str,
    pagina: int = Query(default=1, ge=1),
    tamano: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Usuario = Depends(_solo_super),
) -> dict:
    try:
        return svc.contenido_tabla(db, nombre, pagina, tamano)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
