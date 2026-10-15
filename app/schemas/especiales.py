"""Esquemas Pydantic del Ciclo 6 (seguimiento, casos especiales y agenda)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    """Datos del solicitante (RN-AL-01): nombre, unidad y contacto obligatorios.

    D-99: la misma tabla es el **catálogo de personal externo**. `tipo` distingue
    al solicitante de un caso referido del personal del CRASS que valida la
    reparación de una masiva; `contacto` es el teléfono del catálogo.
    """

    unidad: str = Field(min_length=1, max_length=120)
    nombre: str = Field(min_length=1, max_length=120)
    contacto: str = Field(min_length=1, max_length=60)
    canal: Literal["TELEGRAM", "MCP_IA", "MANUAL", "CORREO"] | None = "MANUAL"
    documento: str | None = Field(default=None, max_length=30)
    tipo: Literal["SOLICITANTE", "CRASS", "OTRO"] = "SOLICITANTE"
    activo: bool = True
    id_central: int | None = None


class SolicitanteUpdate(BaseModel):
    """Edición parcial de una ficha del catálogo de personal externo (D-99)."""

    unidad: str | None = Field(default=None, min_length=1, max_length=120)
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    contacto: str | None = Field(default=None, min_length=1, max_length=60)
    documento: str | None = Field(default=None, max_length=30)
    tipo: Literal["SOLICITANTE", "CRASS", "OTRO"] | None = None
    activo: bool | None = None


class SolicitanteOut(SolicitanteCreate):
    model_config = ConfigDict(from_attributes=True)
    id_solicitante: int


# --------------------------------------------------------------------------- #
# Casos especiales
# --------------------------------------------------------------------------- #
class CasoEspecialCreate(BaseModel):
    """Alta de un caso especial (RF-35/RF-36) — datos obligatorios (RN-AL-01).

    Al **incorporar un caso especial** hay que informar, sin excepción:

    - **nombre y teléfono de contacto** (`nombre_cliente` y `contacto_cliente`);
    - **dirección del inmueble** (`direccion`);
    - **teléfono con el identificador de pago (70\\*)** (`telefono`);
    - **tipo de reporte** (`tipo_actividad`: REPARACIÓN o CONSTRUCCIÓN);
    - **datos extra**: si el tipo de reporte es **REPARACIÓN**, el **id de avería**
      (`id_averia`) y el **tipo de problema** (`tipo_problema`);
    - **datos del solicitante** (`crear_solicitante` con nombre, unidad y
      contacto, o `id_solicitante` de uno ya registrado).

    Los datos del caso solo se exigen cuando el especial **crea** su caso
    asociado (`id_caso` no informado); al enlazar un caso existente ya vienen con
    él, pero los del solicitante siguen siendo obligatorios.
    """

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
    contacto_cliente: str | None = None
    telefono: str | None = Field(
        default=None, max_length=30,
        description="Teléfono con el identificador de pago (70*) del caso",
    )
    direccion: str | None = None
    tipo_problema: str | None = Field(
        default=None, max_length=20,
        description="Obligatorio cuando `tipo_actividad` es REPARACION",
    )

    @model_validator(mode="after")
    def _validar_datos_obligatorios(self) -> CasoEspecialCreate:
        if (self.id_solicitante is None) == (self.crear_solicitante is None):
            raise ValueError(
                "Los datos del solicitante son obligatorios: indique "
                "`crear_solicitante` (nombre, unidad y contacto) o `id_solicitante`"
            )
        if self.id_caso is not None:
            return self
        faltan = [
            nombre
            for nombre, valor in (
                ("nombre_cliente", self.nombre_cliente),
                ("contacto_cliente", self.contacto_cliente),
                ("direccion", self.direccion),
                ("telefono", self.telefono),
            )
            if not (valor or "").strip()
        ]
        if self.tipo_actividad == "REPARACION":
            faltan += [
                nombre
                for nombre, valor in (
                    ("id_averia", self.id_averia),
                    ("tipo_problema", self.tipo_problema),
                )
                if not (valor or "").strip()
            ]
        if faltan:
            raise ValueError("Faltan datos obligatorios del alta: " + ", ".join(faltan))
        return self


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

    # Resumen para el listado (se calcula en el endpoint)
    sector_nombre: str | None = None
    solicitante_nombre: str | None = None
    solicitante_unidad: str | None = None
    # Datos tomados del caso asociado (D-72): columnas Direccion y Nombre.
    direccion: str | None = None
    nombre_cliente: str | None = None
    # RN-AL-01: contacto y tipo de problema del alta, tomados del caso asociado.
    contacto_cliente: str | None = None
    telefono: str | None = None
    tipo_problema: str | None = None
    pendiente: bool = True
    asignado: bool = False
    citado: bool = False
    gestion: bool = False
    # D-80: cuadrilla del último despacho del caso asociado, para pintar el
    # icono de cuadrilla con su color en el listado (la calcula el endpoint).
    id_cuadrilla: int | None = None
    cuadrilla_codigo: str | None = None
    cuadrilla_nombre: str | None = None


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
