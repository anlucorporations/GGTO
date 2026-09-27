"""Esquemas Pydantic del Ciclo 6 (seguimiento, casos especiales y agenda)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Clasificacion = Literal["REFERIDO", "EMPRESA", "GOBIERNO"]
TipoActividad = Literal["REPARACION", "CONSTRUCCION"]
Prioridad = Literal["ALTA", "MEDIA", "BAJA"]
EstadoEspecial = Literal["ABIERTO", "EN_PROCESO", "ATENDIDO", "CERRADO"]
EstadoSeguimiento = Literal["EN_COLA", "RESUELTO", "DEVUELTO"]
TipoCita = Literal["CONTACTO", "ATENCION"]
EstadoCita = Literal["PROPUESTA", "CONFIRMADA", "CUMPLIDA", "REPROGRAMADA", "DIFERIDA", "CANCELADA"]


# --------------------------------------------------------------------------- #
# Solicitantes
# --------------------------------------------------------------------------- #
class SolicitanteCreate(BaseModel):
    unidad: str = Field(max_length=120)
    nombre: str = Field(max_length=120)
    contacto: str = Field(max_length=60)
    canal: Literal["TELEGRAM", "MCP_IA", "MANUAL", "CORREO"] | None = "MANUAL"


class SolicitanteOut(SolicitanteCreate):
    model_config = ConfigDict(from_attributes=True)
    id_solicitante: int


# --------------------------------------------------------------------------- #
# Casos especiales
# --------------------------------------------------------------------------- #
class CasoEspecialCreate(BaseModel):
    clasificacion: Clasificacion
    tipo_actividad: TipoActividad
    prioridad: Prioridad = "MEDIA"
    descripcion: str | None = None
    requiere_informe: bool = True
    id_caso: int | None = None
    id_solicitante: int | None = None
    crear_solicitante: SolicitanteCreate | None = Field(
        default=None, description="Crea el solicitante en la misma operación"
    )
    # Datos para crear el caso asociado cuando no existe
    id_averia: str | None = None
    nombre_cliente: str | None = None
    telefono: str | None = None
    direccion: str | None = None


class CasoEspecialUpdate(BaseModel):
    clasificacion: Clasificacion | None = None
    tipo_actividad: TipoActividad | None = None
    prioridad: Prioridad | None = None
    descripcion: str | None = None
    requiere_informe: bool | None = None
    estado: EstadoEspecial | None = None
    id_solicitante: int | None = None


class CasoEspecialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_caso_especial: int
    id_caso: int | None = None
    id_solicitante: int | None = None
    clasificacion: str
    tipo_actividad: str
    prioridad: str
    tiene_id_averia: bool
    descripcion: str | None = None
    requiere_informe: bool
    estado: str
    creado_en: datetime | None = None
    actualizado_en: datetime | None = None


# --------------------------------------------------------------------------- #
# Citas
# --------------------------------------------------------------------------- #
class CitaCreate(BaseModel):
    fecha_hora: datetime
    tipo: TipoCita = "CONTACTO"
    estado: EstadoCita = "PROPUESTA"
    id_caso: int | None = None
    id_caso_especial: int | None = None
    id_cuadrilla: int | None = None
    observacion: str | None = None
    permitir_solape: bool = Field(default=False, description="Solo el rol SUPER puede forzarlo")


class CitaUpdate(BaseModel):
    fecha_hora: datetime | None = None
    tipo: TipoCita | None = None
    estado: EstadoCita | None = None
    id_cuadrilla: int | None = None
    observacion: str | None = None
    permitir_solape: bool = False


class CitaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_cita: int
    id_caso: int | None = None
    id_caso_especial: int | None = None
    id_cuadrilla: int | None = None
    fecha_hora: datetime
    tipo: str
    estado: str
    observacion: str | None = None
    creado_por: str | None = None
    creado_en: datetime | None = None


# --------------------------------------------------------------------------- #
# Seguimiento
# --------------------------------------------------------------------------- #
class SeguimientoCreate(BaseModel):
    id_caso: int
    instancia_destino: str = Field(max_length=120)
    motivo: str | None = None
    estado: EstadoSeguimiento = "EN_COLA"
    observacion: str | None = None


class SeguimientoUpdate(BaseModel):
    instancia_destino: str | None = Field(default=None, max_length=120)
    motivo: str | None = None
    estado: EstadoSeguimiento | None = None
    observacion: str | None = None
    fecha_retorno: datetime | None = None


class SeguimientoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_seguimiento: int
    id_caso: int
    instancia_destino: str
    motivo: str | None = None
    fecha_envio: datetime | None = None
    fecha_retorno: datetime | None = None
    estado: str
    observacion: str | None = None
    usuario: str | None = None
