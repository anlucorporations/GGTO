"""Esquemas Pydantic del Ciclo 9 (alertas, Telegram y MCP)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FallaMasivaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_falla: int
    id_central: int
    clave_concentracion: str | None = None
    descripcion: str
    fecha_deteccion: datetime | None = None
    origen: str
    id_sector: int | None = None
    id_cuadrilla: int | None = None
    estado: str
    planificacion: str | None = None
    reporte_simple: str | None = None
    planificada_en: datetime | None = None
    actualizado_en: datetime | None = None

    # Resumen enriquecido para la tabla y la ficha (D-75): se calcula en el
    # endpoint a partir del sector, la cuadrilla, el caso representativo de la
    # concentración y las órdenes de material.
    sector_nombre: str | None = None
    cuadrilla_codigo: str | None = None
    cuadrilla_nombre: str | None = None
    # RUTA unificada: Tarjeta (slot) + Puerto + FAT del caso representativo.
    ruta: str | None = None
    # Dirección corta (truncada) del caso representativo.
    direccion_corta: str | None = None
    ordenes_count: int = 0
    casos_afectos: int | None = None


class FallaMasivaManual(BaseModel):
    descripcion: str = Field(min_length=5, max_length=500)
    id_sector: int | None = None
    id_cuadrilla: int | None = None
    origen: str = "REPORTE_TECNICO"


class FallaMasivaUpdate(BaseModel):
    estado: str | None = Field(default=None,
                               pattern="^(DETECTADA|PLANIFICADA|ATENDIDA|CERRADA)$")
    id_cuadrilla: int | None = None
    id_sector: int | None = None
    # D-75: la ficha flotante permite editar la descripción de la masiva.
    descripcion: str | None = Field(default=None, min_length=5, max_length=500)


class PlanificacionRequest(BaseModel):
    """RF-17: planificación de la atención con reporte simple y evidencias."""

    planificacion: str = Field(min_length=5, max_length=2000)
    reporte_simple: str | None = Field(default=None, max_length=2000)
    evidencias: list[str] = Field(default_factory=list,
                                  description="Seriales o rutas de las evidencias fotográficas")
    id_cuadrilla: int | None = None


class MaterialRequest(BaseModel):
    """RF-18: solicitud de material asociada a la falla."""

    descripcion: str = Field(min_length=3, max_length=500)
    id_cuadrilla: int | None = None


class OrdenMaterialOut(BaseModel):
    """Orden de material devuelta por la API (D-75: ya con `id_falla` real)."""

    model_config = ConfigDict(from_attributes=True)

    id_orden: int
    id_falla: int | None = None
    id_cuadrilla: int | None = None
    solicitante_usuario: str | None = None
    estado: str
    observacion: str | None = None
    fecha: datetime | None = None


class NotificacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_notificacion: int
    canal: str
    destinatario: str | None = None
    asunto: str | None = None
    cuerpo: str | None = None
    id_caso: int | None = None
    estado: str
    error: str | None = None
    intentos: int = 0
    proximo_intento: datetime | None = None
    enviado_en: datetime | None = None
    creado_en: datetime | None = None


class ProcesarOutboxOut(BaseModel):
    intentadas: int
    enviadas: int
    diferidas: int
    fallidas: int
    detalle: list[dict[str, Any]] = Field(default_factory=list)


class MetricasOut(BaseModel):
    casos_total: int
    casos_por_estado: dict[str, int]
    casos_por_categoria: dict[str, int]
    lotes_ingesta: int
    casos_ingeridos: int
    fallas_activas: int
    notificaciones_pendientes: int
    notificaciones_enviadas: int
    notificaciones_fallidas: int
    canales_configurados: dict[str, bool]
