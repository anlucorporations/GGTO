"""Esquemas Pydantic del Ciclo 3 (INGESTA)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EjemploCaso(BaseModel):
    id_averia: str
    direccion: str | None = None
    sector: int | None = None
    cuadrilla0: bool


class DireccionSinSector(BaseModel):
    """Dirección del archivo diario que no coincide con ningún sector (D-66)."""

    direccion: str
    total: int = 1
    ejemplo_id_averia: str | None = None


class ResumenIngesta(BaseModel):
    archivo: str
    filas_leidas: int
    filas_central: int
    casos_nuevos: int
    casos_duplicados: int
    casos_descartados: int
    sectorizados: int
    sin_sector: int
    cuadrilla0: int
    avisos: list[str] = Field(default_factory=list)
    ejemplos: list[EjemploCaso] = Field(default_factory=list)
    direcciones_sin_sector: list[DireccionSinSector] = Field(default_factory=list)
    id_lote: int | None = None
    fallas_masivas: int = 0


class SectorizacionPendientesOut(BaseModel):
    revisados: int = 0
    asignados: int = 0
    sin_sector: int = 0


class IngestaLoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_lote: int
    archivo: str
    fecha_archivo: datetime | None = None
    id_central: int | None = None
    filas_leidas: int
    filas_central: int
    casos_nuevos: int
    casos_duplicados: int
    casos_descartados: int
    estado: str
    detalle_error: str | None = None
    usuario: str | None = None
    creado_en: datetime | None = None
