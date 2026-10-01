"""Esquemas Pydantic del módulo de sincronización móvil (D-73).

Incluye:
  - `SyncCuadrillaOut`: cuadrilla activa resuelta para el usuario logueado.
  - `SyncDescargaOut`: payload diferencial devuelto por `GET /sync/descarga`.
  - `EvidenciaUploadOut`: confirmación de subida de una foto a Cloud Storage.
  - `ActividadSyncIn` / `EstadoSyncIn` / `SyncCargaIn`: batch enviado por la APK.
  - `SyncCargaOut`: resumen de la carga aplicada en el servidor.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TipoActividad = Literal["CONTACTO", "CIERRE", "CITA", "ENRUTADO", "DIFERIDO"]
ResultadoActividad = Literal["EXITOSO", "FALLIDO", "NO_ATIENDE", "PENDIENTE"]


class SyncCuadrillaOut(BaseModel):
    id_cuadrilla: int | None = None
    codigo: str | None = None
    nombre: str | None = None
    desde: date | None = None
    es_supervisor: bool = False


class CasoSyncOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_caso: int
    id_averia: str
    estado_actual: str
    tipo_caso: str
    categoria: str
    sector_nombre: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    nombre_cliente: str | None = None
    problema_reporte: str | None = None
    informacion: str | None = None
    fecha_cita: datetime | None = None
    actualizado_en: datetime | None = None
    orden_visita: int | None = None
    tipo_asignacion: str | None = None
    observacion_despacho: str | None = None


class CatalogoSyncOut(BaseModel):
    modelos: list[dict] = Field(default_factory=list)
    causas: list[dict] = Field(default_factory=list)


class SyncDescargaOut(BaseModel):
    server_ts: datetime
    casos: list[CasoSyncOut] = Field(default_factory=list)
    catalogos: CatalogoSyncOut = Field(default_factory=CatalogoSyncOut)


class EvidenciaUploadOut(BaseModel):
    id_evidencia: int
    serial_imagen: str
    ruta_remota: str
    url_firmada: str | None = None


class ActividadSyncIn(BaseModel):
    id_actividad_local: int | None = None
    id_caso: int
    tipo: TipoActividad
    resultado: ResultadoActividad | None = None
    reporte_corto: str | None = Field(default=None, max_length=2000)
    id_metodo: int | None = None
    id_causa: int | None = None
    fecha_hora: datetime
    latitud: float | None = None
    longitud: float | None = None
    evidencias: list[str] = Field(default_factory=list, max_length=5)


class EstadoSyncIn(BaseModel):
    id_caso: int
    estado_nuevo: str
    motivo: str | None = Field(default=None, max_length=200)


class SyncCargaIn(BaseModel):
    dispositivo_id: str | None = Field(default=None, max_length=80)
    version_app: str | None = Field(default=None, max_length=20)
    actividades: list[ActividadSyncIn] = Field(default_factory=list, max_length=200)
    estados: list[EstadoSyncIn] = Field(default_factory=list, max_length=200)


class ErrorSyncItem(BaseModel):
    id_caso: int | None = None
    id_actividad_local: int | None = None
    mensaje: str


class SyncCargaOut(BaseModel):
    aceptadas: int = 0
    rechazadas: int = 0
    errores: list[ErrorSyncItem] = Field(default_factory=list)
    server_ts: datetime
