"""Endpoints de salud y metadatos del servicio."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.db import get_db
from ..models import Usuario
from .deps import get_current_user

router = APIRouter(tags=["salud"])


@router.get("/api/v1/info")
def root() -> dict:
    s = get_settings()
    return {
        "servicio": s.app_name,
        "version": s.app_version,
        "entorno": s.app_env,
        "documentacion": "/docs",
    }


@router.get("/health")
def health() -> dict:
    """Liveness: no toca la base de datos."""
    return {"status": "ok"}


@router.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict:
    """Readiness: verifica la conexión y el esquema desplegado."""
    try:
        row = db.execute(
            text(
                """
                SELECT version() AS version,
                       current_database() AS base,
                       current_user AS usuario,
                       (SELECT count(*) FROM information_schema.tables
                         WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tablas
                """
            )
        ).mappings().one()
        return {
            "status": "ready",
            "base": row["base"],
            "usuario": row["usuario"],
            "postgres": str(row["version"]).split(" on ")[0],
            "tablas": row["tablas"],
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"BD no disponible: {type(exc).__name__}") from exc


@router.get("/api/v1/resumen")
def resumen(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)) -> dict:
    """Conteo de entidades principales (evidencia del esquema desplegado)."""
    try:
        row = db.execute(
            text(
                """
                SELECT
                  (SELECT count(*) FROM information_schema.tables
                    WHERE table_schema='public' AND table_type='BASE TABLE') AS tablas,
                  (SELECT count(*) FROM central)       AS centrales,
                  (SELECT count(*) FROM rol)           AS roles,
                  (SELECT count(*) FROM cuadrilla)     AS cuadrillas,
                  (SELECT count(*) FROM causa)         AS causas,
                  (SELECT count(*) FROM configuracion) AS parametros
                """
            )
        ).mappings().one()
        return dict(row)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"BD no disponible: {type(exc).__name__}") from exc
