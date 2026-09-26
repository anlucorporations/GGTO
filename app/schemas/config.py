"""Esquemas Pydantic del Ciclo 2 (CONFIGURACIÓN)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# --------------------------------------------------------------------------- #
# CENTRAL
# --------------------------------------------------------------------------- #


class CentralBase(BaseModel):
    region: str = Field(max_length=80)
    estado_geografico: str = Field(max_length=80)
    capital_estado: str | None = Field(default=None, max_length=80)
    municipio: str = Field(max_length=80)
    parroquia: str = Field(max_length=80)
    estado_operativo: str | None = Field(default=None, max_length=80)
    distrito: str | None = Field(default=None, max_length=40)
    area: str = Field(max_length=20)
    codigo_central: str = Field(max_length=20)
    nombre_central: str = Field(max_length=120)
    activa: bool = True


class CentralCreate(CentralBase):
    pass


class CentralUpdate(BaseModel):
    region: str | None = Field(default=None, max_length=80)
    estado_geografico: str | None = Field(default=None, max_length=80)
    capital_estado: str | None = Field(default=None, max_length=80)
    municipio: str | None = Field(default=None, max_length=80)
    parroquia: str | None = Field(default=None, max_length=80)
    estado_operativo: str | None = Field(default=None, max_length=80)
    distrito: str | None = Field(default=None, max_length=40)
    area: str | None = Field(default=None, max_length=20)
    codigo_central: str | None = Field(default=None, max_length=20)
    nombre_central: str | None = Field(default=None, max_length=120)
    activa: bool | None = None


class CentralOut(CentralBase):
    model_config = ConfigDict(from_attributes=True)
    id_central: int


# --------------------------------------------------------------------------- #
# SECTORES
# --------------------------------------------------------------------------- #


class SectorDireccionCreate(BaseModel):
    patron: str = Field(max_length=160)
    tipo_coincidencia: Literal["CONTIENE", "EXACTO", "REGEX"] = "CONTIENE"
    normalizar: bool = True
    activo: bool = True


class SectorDireccionOut(SectorDireccionCreate):
    model_config = ConfigDict(from_attributes=True)
    id_sector_direccion: int
    id_sector: int


class SectorCreate(BaseModel):
    id_central: int
    nombre: str = Field(max_length=120)
    codigo: str = Field(max_length=20)
    descripcion: str | None = None
    prioridad: int = Field(default=100, ge=1, le=999)
    activo: bool = True
    direcciones: list[SectorDireccionCreate] = Field(default_factory=list)


class SectorUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=120)
    codigo: str | None = Field(default=None, max_length=20)
    descripcion: str | None = None
    prioridad: int | None = Field(default=None, ge=1, le=999)
    activo: bool | None = None


class SectorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_sector: int
    id_central: int
    nombre: str
    codigo: str
    descripcion: str | None = None
    prioridad: int
    activo: bool
    direcciones: list[SectorDireccionOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# TÉCNICOS
# --------------------------------------------------------------------------- #

STATUS_TECNICO = Literal["ACTIVO", "INACTIVO", "VACACIONES", "SUSPENDIDO"]


class TecnicoCreate(BaseModel):
    id_central: int
    nombre: str = Field(max_length=80)
    apellido: str | None = Field(default=None, max_length=80)
    cedula: str | None = Field(default=None, max_length=20)
    p00: str = Field(max_length=20)
    telefono: str | None = Field(default=None, max_length=30)
    correo: str | None = Field(default=None, max_length=120)
    especialidad: str | None = Field(default=None, max_length=80)
    status: STATUS_TECNICO = "ACTIVO"


class TecnicoUpdate(BaseModel):
    id_central: int | None = None
    nombre: str | None = Field(default=None, max_length=80)
    apellido: str | None = Field(default=None, max_length=80)
    cedula: str | None = Field(default=None, max_length=20)
    telefono: str | None = Field(default=None, max_length=30)
    correo: str | None = Field(default=None, max_length=120)
    especialidad: str | None = Field(default=None, max_length=80)
    status: STATUS_TECNICO | None = None


class TecnicoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_tecnico: int
    id_central: int
    nombre: str
    apellido: str | None = None
    cedula: str | None = None
    p00: str
    telefono: str | None = None
    correo: str | None = None
    especialidad: str | None = None
    status: str


# --------------------------------------------------------------------------- #
# FLOTA
# --------------------------------------------------------------------------- #

STATUS_FLOTA = Literal["DISPONIBLE", "EN_RUTA", "MANTENIMIENTO", "FUERA_SERVICIO"]


class FlotaCreate(BaseModel):
    id_central: int
    can: str = Field(max_length=20)
    tipo: str | None = Field(default=None, max_length=40)
    marca: str | None = Field(default=None, max_length=40)
    modelo: str | None = Field(default=None, max_length=40)
    placa: str | None = Field(default=None, max_length=20)
    combustible: str | None = Field(default=None, max_length=20)
    status: STATUS_FLOTA = "DISPONIBLE"
    estado_cauchos: str | None = Field(default=None, max_length=30)
    estado_fluidos: str | None = Field(default=None, max_length=30)
    estado_general: str | None = Field(default=None, max_length=30)


class FlotaUpdate(BaseModel):
    id_central: int | None = None
    can: str | None = Field(default=None, max_length=20)
    tipo: str | None = Field(default=None, max_length=40)
    marca: str | None = Field(default=None, max_length=40)
    modelo: str | None = Field(default=None, max_length=40)
    placa: str | None = Field(default=None, max_length=20)
    combustible: str | None = Field(default=None, max_length=20)
    status: STATUS_FLOTA | None = None
    estado_cauchos: str | None = Field(default=None, max_length=30)
    estado_fluidos: str | None = Field(default=None, max_length=30)
    estado_general: str | None = Field(default=None, max_length=30)


class FlotaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_flota: int
    id_central: int
    can: str
    tipo: str | None = None
    marca: str | None = None
    modelo: str | None = None
    placa: str | None = None
    combustible: str | None = None
    status: str
    estado_cauchos: str | None = None
    estado_fluidos: str | None = None
    estado_general: str | None = None


# --------------------------------------------------------------------------- #
# CUADRILLAS
# --------------------------------------------------------------------------- #

ROL_CUADRILLA = Literal["REPARADOR_PRINCIPAL", "AYUDANTE", "SUPERVISOR"]


class CuadrillaIntegranteCreate(BaseModel):
    id_tecnico: int
    rol_cuadrilla: ROL_CUADRILLA = "REPARADOR_PRINCIPAL"
    desde: date | None = None


class CuadrillaIntegranteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_tecnico: int
    rol_cuadrilla: str
    desde: date
    hasta: date | None = None


class CuadrillaCreate(BaseModel):
    id_central: int
    codigo: str = Field(max_length=20)
    nombre: str = Field(max_length=80)
    id_flota: int | None = None
    es_supervisor: bool = False
    activa: bool = True
    integrantes: list[CuadrillaIntegranteCreate] = Field(default_factory=list)
    herramientas: list[int] = Field(default_factory=list)


class CuadrillaUpdate(BaseModel):
    codigo: str | None = Field(default=None, max_length=20)
    nombre: str | None = Field(default=None, max_length=80)
    id_flota: int | None = None
    es_supervisor: bool | None = None
    activa: bool | None = None


class CuadrillaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_cuadrilla: int
    id_central: int
    codigo: str
    nombre: str
    id_flota: int | None = None
    es_supervisor: bool
    activa: bool
    integrantes: list[CuadrillaIntegranteOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# CATÁLOGOS
# --------------------------------------------------------------------------- #


class CausaCreate(BaseModel):
    codigo_causa: str = Field(max_length=20)
    subcodigo_causa: str = Field(default="", max_length=20)
    descripcion: str | None = Field(default=None, max_length=255)
    descripcion_subcodigo: str | None = Field(default=None, max_length=255)
    tipo: str | None = Field(default=None, max_length=20)
    activo: bool = True


class CausaOut(CausaCreate):
    model_config = ConfigDict(from_attributes=True)
    id_causa: int


class MetodoCreate(BaseModel):
    dominio: Literal["CIERRE", "ENRUTE", "DIFERIDO", "CONTACTO"]
    codigo: str = Field(max_length=30)
    nombre: str = Field(max_length=120)
    activo: bool = True


class MetodoOut(MetodoCreate):
    model_config = ConfigDict(from_attributes=True)
    id_metodo: int


class ConfiguracionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    clave: str
    valor: Any
    descripcion: str | None = None
    actualizado_en: datetime | None = None


class ConfiguracionUpdate(BaseModel):
    valor: Any
    descripcion: str | None = None
