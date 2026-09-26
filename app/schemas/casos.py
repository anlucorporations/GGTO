"""Esquemas Pydantic del Ciclo 4 (PANEL y CASOS)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ESTADOS_CASO = (
    "NUEVO",
    "ASIGNADO",
    "CONTACTADO",
    "CITADO",
    "DIFERIDO",
    "EN_GESTION",
    "ENRUTADO",
    "CERRADO",
    "CANCELADO",
)
TIPO_CASO = Literal["AVERIA", "REPARACION", "CONSTRUCCION"]
CATEGORIA = Literal["RESIDENCIAL", "EMPRESA", "REFERIDO", "GOBIERNO"]
ORIGEN = Literal["INGESTA_CSV", "MANUAL", "TELEGRAM", "MCP_IA"]
EstadoCaso = Literal[
    "NUEVO", "ASIGNADO", "CONTACTADO", "CITADO", "DIFERIDO",
    "EN_GESTION", "ENRUTADO", "CERRADO", "CANCELADO",
]


class CasoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # Identificación y clasificación
    id_caso: int
    id_averia: str
    id_central: int
    origen: str
    tipo_caso: str
    categoria: str
    estado_actual: str
    id_sector: int | None = None
    id_causa: int | None = None
    id_lote_ingesta: int | None = None
    en_gestion_supervisor: bool
    es_falla_masiva: bool

    # Geografía
    region: str | None = None
    estado_geografico: str | None = None
    municipio: str | None = None
    parroquia: str | None = None
    area: str | None = None
    codigo_central: str | None = None
    nombre_central: str | None = None

    # Contacto
    telefono: str | None = None
    nombre_cliente: str | None = None
    direccion: str | None = None
    persona_reporta: str | None = None
    contacto_cliente: str | None = None

    # Fechas
    fecha_reporte: datetime | None = None
    fecha_compromiso: datetime | None = None
    fecha_cita: datetime | None = None

    # Textos
    problema_reporte: str | None = None
    ultimo_comentario: str | None = None
    informacion: str | None = None
    results: str | None = None
    estatus_origen: str | None = None

    # Datos técnicos
    olt: str | None = None
    plan: str | None = None
    slot: str | None = None
    puerto: str | None = None
    fat: str | None = None
    serial: str | None = None
    tipo_servicio: str | None = None
    tipo_problema: str | None = None
    area_trabajo: str | None = None
    unidad_negocio: str | None = None

    # Asignación de origen
    cuadrilla_externa: str | None = None
    reparador_principal: str | None = None
    ayudantes: list = Field(default_factory=list)
    flota_can: str | None = None

    creado_en: datetime | None = None
    actualizado_en: datetime | None = None


class PaginaCasos(BaseModel):
    items: list[CasoOut]
    total: int
    page: int
    page_size: int
    pages: int


class CasoManualCreate(BaseModel):
    """Alta manual desde PANEL (RF-32). Si no se indica `id_averia` se genera `REF-…`."""

    id_central: int | None = None
    id_averia: str | None = Field(default=None, max_length=30)
    categoria: CATEGORIA = "RESIDENCIAL"
    tipo_caso: TIPO_CASO = "AVERIA"
    nombre_cliente: str | None = Field(default=None, max_length=160)
    telefono: str | None = Field(default=None, max_length=30)
    direccion: str | None = None
    informacion: str | None = None
    problema_reporte: str | None = None
    persona_reporta: str | None = Field(default=None, max_length=120)
    contacto_cliente: str | None = Field(default=None, max_length=60)
    fecha_reporte: datetime | None = None
    fecha_cita: datetime | None = None
    fecha_compromiso: datetime | None = None
    id_sector: int | None = None
    tipo_servicio: str | None = Field(default=None, max_length=40)


class CasoUpdate(BaseModel):
    """Edición desde PANEL (RF-31). El cambio de estado queda en la bitácora."""

    nombre_cliente: str | None = Field(default=None, max_length=160)
    telefono: str | None = Field(default=None, max_length=30)
    direccion: str | None = None
    informacion: str | None = None
    problema_reporte: str | None = None
    ultimo_comentario: str | None = None
    persona_reporta: str | None = Field(default=None, max_length=120)
    contacto_cliente: str | None = Field(default=None, max_length=60)
    tipo_caso: TIPO_CASO | None = None
    categoria: CATEGORIA | None = None
    estado_actual: EstadoCaso | None = None
    motivo_estado: str | None = Field(default=None, max_length=200)
    id_sector: int | None = None
    id_causa: int | None = None
    en_gestion_supervisor: bool | None = None
    es_falla_masiva: bool | None = None
    fecha_cita: datetime | None = None
    fecha_compromiso: datetime | None = None
    tipo_servicio: str | None = Field(default=None, max_length=40)


class CasoEstadoHistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_hist: int
    id_caso: int
    estado_anterior: str | None = None
    estado_nuevo: str
    motivo: str | None = None
    usuario: str | None = None
    fecha_hora: datetime | None = None
