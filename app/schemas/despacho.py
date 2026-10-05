"""Esquemas Pydantic del Ciclo 5 (DESPACHO)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EstadoDespacho = Literal["BORRADOR", "PUBLICADO", "CERRADO"]
EstadoDespachoCaso = Literal["ASIGNADO", "GESTIONADO", "CERRADO", "CITADO", "DIFERIDO"]
TipoAsignacion = Literal["REPARACION", "CONSTRUCCION", "REFERIDO", "EMPRESA", "FALLA_MASIVA"]
Canal = Literal["TELEGRAM", "CORREO"]


class CasoAsignadoOut(BaseModel):
    id_caso: int
    id_averia: str
    id_sector: int | None = None
    sector_nombre: str | None = None
    tipo_asignacion: str
    orden_visita: int
    direccion: str | None = None
    telefono: str | None = None
    nombre_cliente: str | None = None
    problema_reporte: str | None = None
    estado_actual: str
    categoria: str
    tipo_caso: str
    es_cita: bool
    especial: bool = False


class GrupoCuadrillaOut(BaseModel):
    id_cuadrilla: int
    codigo: str
    nombre: str
    total: int
    # D-77: la cuadrilla 0 (supervisor) recibe los casos en GESTIÓN
    es_supervisor: bool = False
    casos: list[CasoAsignadoOut]


class PropuestaOut(BaseModel):
    fecha: date
    id_central: int
    grupos: list[GrupoCuadrillaOut]
    sin_asignar: list[CasoAsignadoOut] = Field(default_factory=list)
    reglas: dict
    resumen: dict


class DespachoCasoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_despacho_caso: int
    id_caso: int
    id_sector: int | None = None
    orden_visita: int | None = None
    tipo_asignacion: str | None = None
    estado: str
    observacion: str | None = None


class DespachoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_despacho: int
    id_central: int
    fecha: date
    id_cuadrilla: int
    estado: str
    generado_auto: bool
    enviado_canal: str | None = None
    enviado_en: datetime | None = None
    reporte_produccion_en: datetime | None = None
    usuario_crea: str | None = None
    creado_en: datetime | None = None


class DespachoDetalleOut(DespachoOut):
    cuadrilla_codigo: str | None = None
    cuadrilla_nombre: str | None = None
    casos: list[DespachoCasoOut] = Field(default_factory=list)


class DespachoUpdate(BaseModel):
    estado: EstadoDespacho | None = None
    enviado_canal: Canal | None = None
    observacion: str | None = None


# --------------------------------------------------------------------------- #
# Proceso de despacho con asignación diaria de sectores (D-66)
# --------------------------------------------------------------------------- #
class SectorProcesoOut(BaseModel):
    id_sector: int
    nombre: str | None = None
    total: int = 0
    especiales: int = 0
    citados: int = 0
    id_cuadrilla: int | None = None


class CuadrillaProcesoOut(BaseModel):
    id_cuadrilla: int
    codigo: str
    nombre: str
    es_supervisor: bool = False
    ids_sector: list[int] = Field(default_factory=list)
    total: int = 0


class UniversoOut(BaseModel):
    total: int = 0
    comunes: int = 0
    especiales: int = 0
    sin_sector: int = 0
    casos: list[CasoAsignadoOut] = Field(default_factory=list)


class AsignacionBloque(BaseModel):
    id_cuadrilla: int
    ids_sector: list[int] = Field(default_factory=list)


class AsignacionUpdate(BaseModel):
    fecha: date
    id_central: int | None = None
    asignaciones: list[AsignacionBloque] = Field(default_factory=list)


class ProcesoDespachoOut(BaseModel):
    fecha: date
    id_central: int
    asignacion_origen: str
    universo: UniversoOut
    sectores: list[SectorProcesoOut] = Field(default_factory=list)
    cuadrillas: list[CuadrillaProcesoOut] = Field(default_factory=list)
    asignacion: list[AsignacionBloque] = Field(default_factory=list)
    grupos: list[GrupoCuadrillaOut] = Field(default_factory=list)
    sin_asignar: list[CasoAsignadoOut] = Field(default_factory=list)
    reglas: dict = Field(default_factory=dict)
    resumen: dict = Field(default_factory=dict)


class ProcesarDespacho(BaseModel):
    fecha: date
    id_central: int | None = None
    asignaciones: list[AsignacionBloque] = Field(default_factory=list)
    reemplazar: bool = True


class AsignacionCasosRequest(BaseModel):
    """D-77: asignar o quitar casos (comunes y especiales) a una cuadrilla."""

    id_cuadrilla: int | None = Field(
        default=None, description="Cuadrilla destino (obligatoria al asignar)"
    )
    ids_caso: list[int] = Field(default_factory=list, description="Casos comunes")
    ids_caso_especial: list[int] = Field(
        default_factory=list, description="Casos especiales (se resuelven a su caso asociado)"
    )
    fecha: date | None = Field(default=None, description="Por defecto, hoy")
    id_central: int | None = None


class AsignacionCasosOut(BaseModel):
    """Resultado de asignar/quitar casos a una cuadrilla (D-77)."""

    fecha: date
    id_cuadrilla: int | None = None
    cuadrilla_codigo: str | None = None
    id_despacho: int | None = None
    agregados: int = 0
    movidos: int = 0
    quitados: int = 0
    omitidos: list[int] = Field(default_factory=list)
    mensaje: str = ""


class CasoAgregar(BaseModel):
    id_caso: int
    tipo_asignacion: TipoAsignacion | None = None
    orden_visita: int | None = None
    observacion: str | None = None


class CasoEstadoUpdate(BaseModel):
    estado: EstadoDespachoCaso
    observacion: str | None = None


class NotificacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_notificacion: int
    canal: str
    destinatario: str | None = None
    asunto: str | None = None
    cuerpo: str | None = None
    estado: str
    error: str | None = None
    enviado_en: datetime | None = None
    creado_en: datetime | None = None


class EnvioOut(BaseModel):
    id_despacho: int
    canal: str
    estado: str
    error: str | None = None
    notificacion: NotificacionOut | None = None


class ReporteProduccionOut(BaseModel):
    fecha: date
    id_central: int
    por_cuadrilla: list[dict]
    totales: dict


class FallaMasivaCreate(BaseModel):
    descripcion: str
    id_sector: int | None = None
    origen: Literal["AUTOMATICA", "REPORTE_TECNICO", "MCP"] = "REPORTE_TECNICO"


class FallaMasivaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_falla: int
    id_central: int
    descripcion: str
    fecha_deteccion: datetime | None = None
    origen: str
    id_sector: int | None = None
    id_cuadrilla: int | None = None
    estado: str
    planificacion: str | None = None
