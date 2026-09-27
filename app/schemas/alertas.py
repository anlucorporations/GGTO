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
