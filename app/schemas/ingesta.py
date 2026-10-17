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


class AvisoIngesta(BaseModel):
    """Fila del archivo cuya clasificación de números generó un aviso (RF-56)."""

    fila: int | None = None
    id_averia: str | None = None
    numero: str | None = None
    motivo: str | None = None


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
    filas_sin_identificador_pago: int = 0
    filas_con_contacto: int = 0
    avisos: list[str] = Field(default_factory=list)
    avisos_detalle: list[AvisoIngesta] = Field(default_factory=list)
    ejemplos: list[EjemploCaso] = Field(default_factory=list)
    direcciones_sin_sector: list[DireccionSinSector] = Field(default_factory=list)
    id_lote: int | None = None
    fallas_masivas: int = 0


class SectorizacionPendientesOut(BaseModel):
    revisados: int = 0
    asignados: int = 0
    sin_sector: int = 0


class DireccionesSinSectorOut(BaseModel):
    """Direcciones **del sistema** (no solo del último archivo) sin sector (D-106).

    Permite volver a la gestión de direcciones sin sector en cualquier momento y
    no solo al terminar una ingesta: la pantalla INGESTA muestra el total y abre
    el mismo cuadro de asignación.
    """

    total_direcciones: int = 0
    total_casos: int = 0
    direcciones: list[DireccionSinSector] = Field(default_factory=list)


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
    filas_sin_identificador_pago: int = 0
    filas_con_contacto: int = 0
    avisos: list[AvisoIngesta] = Field(default_factory=list)
    estado: str
    detalle_error: str | None = None
    usuario: str | None = None
    creado_en: datetime | None = None
