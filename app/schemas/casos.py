"""Esquemas Pydantic del Ciclo 4 (PANEL y CASOS)."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
TIPO_CASO = Literal["AVERIA", "REPARACION", "CONSTRUCCION", "REFERIDO", "MANTENIMIENTO"]
CATEGORIA = Literal["RESIDENCIAL", "EMPRESA", "REFERIDO", "GOBIERNO"]
#: Tipo de reporte del alta (RN-AL-01): solo REPARACIÓN o CONSTRUCCIÓN.
TIPO_REPORTE = Literal["REPARACION", "CONSTRUCCION"]
#: Estados que **no** cuentan como trabajo abierto (mismo criterio que MONITOREO).
ESTADOS_TERMINALES = ("CERRADO", "CANCELADO")
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
    sector_nombre: str | None = None
    id_causa: int | None = None
    id_lote_ingesta: int | None = None
    id_pago: int | None = None          # D-89: identificador de pago del caso
    # D-90: marca derivada de la regla REPARACIÓN ⇐ 70* + avería real (la calcula
    # el endpoint; `motivo_marca` ∈ SIN_IDENTIFICADOR_PAGO | SIN_ID_AVERIA | ambos).
    marcado_reclasificar: bool = False
    motivo_marca: str | None = None
    tiene_identificador_pago: bool = False
    tiene_id_averia_real: bool = True
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

    # Iconos de estado del listado (se calculan en el endpoint)
    pendiente: bool = True
    asignado: bool = False
    citado: bool = False
    gestion: bool = False

    # D-78: cuadrilla del último despacho que incluyó el caso (se calcula en el endpoint).
    id_cuadrilla: int | None = None
    cuadrilla_codigo: str | None = None
    cuadrilla_nombre: str | None = None


class PaginaCasos(BaseModel):
    items: list[CasoOut]
    total: int
    page: int
    page_size: int
    pages: int


class CasoManualCreate(BaseModel):
    """Alta manual desde PANEL (RF-32) — datos obligatorios (RN-AL-01).

    Al **incorporar un caso manual** hay que informar, sin excepción:

    - **nombre y teléfono de contacto** (`nombre_cliente` y `contacto_cliente`);
    - **dirección del inmueble** (`direccion`);
    - **teléfono con el identificador de pago (70\\*)** (`id_pago`);
    - **tipo de reporte** (`tipo_reporte`: REPARACIÓN o CONSTRUCCIÓN);
    - **datos extra**: si el reporte es una **REPARACIÓN**, el **id de avería**
      (`id_averia`) y el **tipo de problema** (`tipo_problema`).

    Solo cuando no se indica `id_averia` el sistema genera un `REF-…` sintético;
    con `tipo_reporte=REPARACION` el id de avería es obligatorio, de modo que ese
    camino queda reservado a CONSTRUCCIÓN.
    """

    id_central: int | None = None
    tipo_reporte: TIPO_REPORTE
    #: D-145: el id de avería se genera solo (`REF-REP-…` / `REF-CONS-…`). Se
    #: admite uno explícito por compatibilidad (pruebas e importaciones).
    id_averia: str | None = Field(default=None, max_length=30)
    categoria: CATEGORIA = "RESIDENCIAL"
    #: D-145: personal externo que reporta (catálogo de solicitantes).
    id_solicitante: int | None = None
    nombre_cliente: str = Field(min_length=1, max_length=160,
                                description="Nombre de contacto (obligatorio)")
    telefono: str | None = Field(default=None, max_length=30)
    id_pago: str | None = Field(default=None, max_length=20,
                                description="Teléfono con el identificador de pago "
                                            "(70*) del caso (D-89) — obligatorio")
    contacto_cliente: str = Field(min_length=1, max_length=60,
                                  description="Teléfono de contacto (obligatorio)")
    direccion: str = Field(min_length=1,
                           description="Dirección del inmueble (obligatoria)")
    informacion: str | None = None
    problema_reporte: str | None = None
    tipo_problema: str | None = Field(
        default=None, max_length=20,
        description="Obligatorio cuando `tipo_reporte` es REPARACION")
    persona_reporta: str | None = Field(default=None, max_length=120)
    fecha_reporte: datetime | None = None
    fecha_cita: datetime | None = None
    fecha_compromiso: datetime | None = None
    id_sector: int | None = None
    tipo_servicio: str | None = Field(default=None, max_length=40)

    @field_validator("nombre_cliente", "contacto_cliente", "direccion")
    @classmethod
    def _no_vacio(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El campo es obligatorio y no puede quedar en blanco")
        return limpio

    @model_validator(mode="after")
    def _validar_datos_obligatorios(self) -> CasoManualCreate:
        falta_pago = not (self.id_pago or self.telefono or "").strip()
        if falta_pago:
            raise ValueError(
                "El teléfono con el identificador de pago (70*) es obligatorio "
                "(`id_pago`)"
            )
        # D-145: el id de avería lo genera el servidor; el tipo de problema sigue
        # siendo obligatorio en una reparación.
        if self.tipo_reporte == "REPARACION" and not (self.tipo_problema or "").strip():
            raise ValueError(
                "En un reporte de REPARACIÓN es obligatorio el tipo de problema "
                "(`tipo_problema`)"
            )
        return self



class CasoUpdate(BaseModel):
    """Edición desde PANEL (RF-31). El cambio de estado queda en la bitácora."""

    nombre_cliente: str | None = Field(default=None, max_length=160)
    telefono: str | None = Field(default=None, max_length=30)
    id_pago: str | None = Field(default=None, max_length=20,
                               description="Identificador de pago (70*) del caso (D-89)")
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
    sector_nombre: str | None = None
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


class CasoGestionEstado(BaseModel):
    """Cambio de estado desde la gestión del caso (D-68).

    Lo usa también el rol TECNICO: puede mover el estado del caso que atiende,
    sin poder editar el resto de los campos.
    """

    estado_actual: EstadoCaso
    motivo_estado: str | None = Field(default=None, max_length=200)


# --------------------------------------------------------------------------- #
# Resolución del caso: cierre, cita y enrutado (D-70)
# --------------------------------------------------------------------------- #
MODOS_CIERRE = Literal["IVR", "COS", "SACAS"]


class CierreCaso(BaseModel):
    """Cierre del caso con la descripción de lo realizado y sus evidencias."""

    modo: MODOS_CIERRE = Field(description="Cómo se cerró: IVR, COS o SACAS")
    descripcion: str = Field(min_length=10, max_length=2000,
                             description="Resumen corto de lo realizado")
    evidencias: list[str] = Field(default_factory=list, max_length=20,
                                  description="Seriales o rutas de las evidencias cargadas")
    id_causa: int | None = None


class CitaRapida(BaseModel):
    """Agendamiento de una cita desde la ficha del caso."""

    fecha_hora: datetime
    tipo: Literal["CONTACTO", "ATENCION"] = "ATENCION"
    observacion: str | None = Field(default=None, max_length=500)


class EnrutadoCaso(BaseModel):
    """Enrutado del caso a otra instancia con su motivo."""

    destino: str = Field(min_length=3, max_length=120,
                         description="Instancia destino (seguimiento, planta, masivos…)")
    motivo: str | None = Field(default=None, max_length=500)
    id_metodo: int | None = None


class NoContestaIn(BaseModel):
    """Cuerpo de «No Contesta» (D-88 · RF-APK-12).

    La APK envía la cita del **día siguiente a las 08:00 en la hora del
    dispositivo** (el técnico está en campo); si no la envía, el servidor propone
    las 08:00 del día siguiente en UTC.
    """

    fecha_hora: datetime | None = None
    observacion: str | None = Field(default=None, max_length=200)


class ContactoUpdate(BaseModel):
    """Edición de campo del contacto (D-88 · RF-APK-11).

    Un técnico solo puede corregir la **dirección** y el **número de contacto**;
    cualquier otro campo sigue reservado a la gestión por web.
    """

    direccion: str | None = Field(default=None, min_length=5, max_length=200)
    telefono: str | None = Field(default=None, max_length=20)

    @field_validator("telefono")
    @classmethod
    def _serie_valida(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        limpio = re.sub(r"[\s\-().]", "", valor.strip())
        if not re.fullmatch(r"(700|701|702)\d{7}", limpio):
            raise ValueError(
                "El número de contacto debe ser de la serie 700, 701 o 702 (10 dígitos)"
            )
        return limpio

    @field_validator("direccion")
    @classmethod
    def _direccion_util(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        limpio = " ".join(valor.split())
        if len(limpio) < 5:
            raise ValueError("La dirección indicada es demasiado corta")
        return limpio


class ResolucionOut(BaseModel):
    """Resultado de registrar un cierre, una cita o un enrutado."""

    accion: str
    id_actividad: int | None = None
    id_cita: int | None = None
    id_seguimiento: int | None = None
    estado_actual: str
    mensaje: str


class CasoRelacionado(BaseModel):
    """Antecedente del mismo teléfono o dirección (pestaña Histórico)."""

    id_caso: int
    id_averia: str
    fecha_reporte: datetime | None = None
    fecha_cierre: datetime | None = None
    estado_actual: str
    categoria: str | None = None
    problema_reporte: str | None = None
    justificacion_cierre: str | None = None
    direccion: str | None = None
    nombre_cliente: str | None = None


#: Estados desde los que se puede **reactivar** un caso (D-106). Son los
#: terminales: mientras esté cerrado, cancelado o enrutado, la gestión web no
#: puede volver a trabajarlo.
ESTADOS_REACTIVABLES = ("CERRADO", "CANCELADO", "ENRUTADO")


class ReactivarCaso(BaseModel):
    """Reapertura de un caso terminal (D-106 · RF-88).

    La operación devuelve el caso a la cola abierta con su motivo en la bitácora;
    por defecto queda `ASIGNADO` (trabajo vigente de la cuadrilla).
    """

    motivo: str = Field(min_length=5, max_length=200,
                        description="Por qué se reabre el caso (queda en la bitácora)")
    estado: Literal["NUEVO", "ASIGNADO", "EN_GESTION"] = Field(
        default="ASIGNADO", description="Estado abierto al que vuelve el caso"
    )
