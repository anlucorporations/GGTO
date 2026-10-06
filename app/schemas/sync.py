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

#: Tipos que la APK puede enviar. «ENRUTADO» se normaliza a «ENRUTE» al guardar
#: (`actividad.tipo` solo admite los valores del CHECK del DDL).
TipoActividad = Literal["CONTACTO", "CIERRE", "CITA", "ENRUTE", "ENRUTADO", "DIFERIDO"]


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
    resultado: str | None = Field(
        default=None,
        max_length=20,
        description="Resultado de campo (EXITOSO, NO_ATIENDE…). El servidor lo "
                    "normaliza al valor que admite el DDL de `actividad`.",
    )
    reporte_corto: str | None = Field(default=None, max_length=2000)
    id_metodo: int | None = None
    modo: str | None = Field(
        default=None,
        max_length=20,
        description="Modo de cierre del catálogo (IVR/COS/SACAS). Si llega, el "
                    "servidor resuelve `id_metodo`; la APK lo conserva offline.",
    )
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
    id_sync_log: int | None = None  # D-81: sesión asociada (opcional, retrocompatible)
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


# --------------------------------------------------------------------------- #
# Sesiones de sincronización y checklist (D-81 · RF-39 / RF-40)
# --------------------------------------------------------------------------- #
TipoSesion = Literal["DESCARGA", "CARGA"]
PasoChecklist = Literal["CONEXION", "LOGIN", "DESCARGA", "CARGA"]
EstadoChecklist = Literal["PENDIENTE", "EN_CURSO", "OK", "ERROR", "OMITIDO"]
EstadoSesion = Literal["OK", "PARCIAL", "ERROR"]


class SyncSesionIn(BaseModel):
    tipo: TipoSesion
    dispositivo_id: str | None = Field(default=None, max_length=80)
    version_app: str | None = Field(default=None, max_length=20)


class SyncSesionOut(BaseModel):
    id_sync_log: int


class ChecklistPasoIn(BaseModel):
    paso: PasoChecklist
    estado: EstadoChecklist
    fecha_hora: datetime | None = None
    detalle: dict | None = None


class ChecklistIn(BaseModel):
    pasos: list[ChecklistPasoIn] = Field(default_factory=list, max_length=4)


class SyncSesionCierreIn(BaseModel):
    recibidos: int = Field(default=0, ge=0)
    procesados: int = Field(default=0, ge=0)
    errores: int = Field(default=0, ge=0)
    estado: EstadoSesion | None = None
    detalle: dict | None = None
    checklist: list[ChecklistPasoIn] = Field(default_factory=list, max_length=4)


class SyncSesionCierreOut(BaseModel):
    id_sync_log: int
    estado: str
    recibidos: int
    procesados: int
    errores: int
    duracion_ms: int | None = None


class ChecklistPasoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    paso: str
    estado: str
    fecha_hora: datetime | None = None
    detalle: dict | None = None
