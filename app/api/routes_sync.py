"""Sincronización de la APK móvil — D-73 (Ciclo 8).

Endpoints:
  - `GET /api/v1/sync/cuadrilla`     → cuadrilla activa del usuario.
  - `GET /api/v1/sync/descarga`      → casos asignados a la cuadrilla, diferenciales.
  - `POST /api/v1/evidencias/upload` → subida multipart de una foto.
  - `POST /api/v1/sync/carga`        → batch de actividades y estados del día.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Evidencia, Usuario
from ..schemas.sync import (
    EvidenciaUploadOut,
    SyncCargaIn,
    SyncCargaOut,
    SyncCuadrillaOut,
    SyncDescargaOut,
)
from ..services import sync as svc
from ..services.storage import serial_desde_nombre, subir_evidencia
from .deps import get_current_user

router = APIRouter(prefix="/api/v1", tags=["sincronización móvil"])

MAX_FOTO_BYTES = 3 * 1024 * 1024  # 3 MB por evidencia (decisión del usuario)


def _parsear_datetime(valor: str | None) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Fecha inválida en 'desde'") from exc


@router.get("/sync/cuadrilla", response_model=SyncCuadrillaOut, summary="Cuadrilla activa del usuario")
def sync_cuadrilla(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncCuadrillaOut:
    return SyncCuadrillaOut(**svc.resolver_cuadrilla(db, usuario))


@router.get("/sync/descarga", response_model=SyncDescargaOut, summary="Descarga diferencial por cuadrilla")
def sync_descarga(
    desde: Annotated[str | None, Query(description="ISO8601; devuelve solo cambios posteriores")] = None,
    ids_conocidos: Annotated[list[int] | None, Query(description="IDs locales ya conocidos")] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncDescargaOut:
    dt = _parsear_datetime(desde)
    payload = svc.construir_descarga(db, usuario, desde=dt, ids_conocidos=set(ids_conocidos or []))
    return SyncDescargaOut(**payload)


@router.post("/evidencias/upload", response_model=EvidenciaUploadOut, summary="Subir una foto de evidencia")
async def upload_evidencia(
    file: Annotated[UploadFile, File()],
    id_caso: Annotated[int, Form()],
    tipo: Annotated[str, Form()] = "DEMO",
    serial_local: Annotated[str | None, Form()] = None,
    latitud: Annotated[float | None, Form()] = None,
    longitud: Annotated[float | None, Form()] = None,
    fecha_hora: Annotated[str | None, Form()] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> EvidenciaUploadOut:
    contenido = await file.read()
    if len(contenido) > MAX_FOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La foto supera el máximo de {MAX_FOTO_BYTES // (1024 * 1024)} MB",
        )
    if not contenido:
        raise HTTPException(status_code=422, detail="Archivo vacío")

    nombre = file.filename or "foto.jpg"
    ruta_remota = subir_evidencia(nombre, contenido, content_type=file.content_type or "image/jpeg")
    serial = serial_local or serial_desde_nombre(nombre)

    existente = db.query(Evidencia).filter(Evidencia.serial_imagen == serial).first()
    if existente is not None:
        return EvidenciaUploadOut(
            id_evidencia=existente.id_evidencia,
            serial_imagen=existente.serial_imagen,
            ruta_remota=existente.ruta_remota or "",
            url_firmada=None,
        )

    ev = Evidencia(
        id_actividad=None,  # se vincula al crear la actividad en /sync/carga
        tipo=tipo[:20],
        serial_imagen=serial,
        ruta_remota=ruta_remota[:255],
        latitud=latitud,
        longitud=longitud,
        fecha_hora=_parsear_datetime(fecha_hora) or datetime.now(UTC),
        origen_camara=True,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return EvidenciaUploadOut(
        id_evidencia=ev.id_evidencia,
        serial_imagen=ev.serial_imagen,
        ruta_remota=ev.ruta_remota or "",
        url_firmada=None,
    )


@router.post("/sync/carga", response_model=SyncCargaOut, summary="Cargar actividades y estados del día")
def sync_carga(
    datos: SyncCargaIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncCargaOut:
    payload = datos.model_dump(mode="python")
    resultado = svc.aplicar_carga(db, usuario, payload)
    return SyncCargaOut(**resultado)
