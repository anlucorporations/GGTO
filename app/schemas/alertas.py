"""Esquemas Pydantic del Ciclo 9 (alertas, Telegram y MCP)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ValidadorCrassOut(BaseModel):
    """Personal del CRASS que valida la reparación de una masiva (D-99 · DEC-MA-4).

    Se resuelve desde el catálogo de personal externo (`solicitante`).
    """

    model_config = ConfigDict(from_attributes=True)

    id_solicitante: int
    nombre: str
    unidad: str
    contacto: str | None = None


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
    # D-82: reporte de campo desde la APK (ODN, dirección, FAT y evidencias).
    odn: str | None = None
    direccion: str | None = None
    fat: str | None = None
    # D-118: identidad técnica del FAT (OLT + slot + puerto + FAT).
    olt: str | None = None
    slot: str | None = None
    puerto: str | None = None
    evidencias: list[str] = Field(default_factory=list)
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

    # D-99 · MASIVAS: asociación explícita, cierre y ubicación del FAT.
    casos_asociados: int = 0
    validador_crass: ValidadorCrassOut | None = None
    descripcion_cierre: str | None = None
    evidencias_cierre: list[str] = Field(default_factory=list)
    cerrada_por: str | None = None
    cerrada_en: datetime | None = None
    casos_cerrados: int = 0
    latitud: float | None = None
    longitud: float | None = None

    @field_validator("evidencias_cierre", mode="before")
    @classmethod
    def _cierre_sin_nulos(cls, valor: object) -> object:
        """Mismo criterio que `evidencias`: la columna guarda seriales separados
        por comas y el ORM entrega `None` cuando no hubo fotos."""
        if valor is None:
            return []
        if isinstance(valor, str):
            return [p.strip() for p in valor.split(",") if p.strip()]
        return valor

    @field_validator("evidencias", mode="before")
    @classmethod
    def _evidencias_sin_nulos(cls, valor: object) -> object:
        """La columna guarda los seriales como texto separado por comas; el ORM
        entrega `None` cuando el reporte no llevó fotos."""
        if valor is None:
            return []
        if isinstance(valor, str):
            return [p.strip() for p in valor.split(",") if p.strip()]
        return valor


class FallaMasivaManual(BaseModel):
    """Alta manual de una masiva (D-118).

    La identidad del FAT es **obligatoria**: OLT, slot, puerto, FAT y dirección.
    Además, el alta manual debe asociar **al menos un caso** que coincida con esa
    tupla (`ids_caso`); la validación se hace en el endpoint para conservar los
    códigos de error del API.
    """

    descripcion: str = Field(min_length=5, max_length=500)
    olt: str = Field(min_length=1, max_length=60)
    slot: str = Field(min_length=1, max_length=20)
    puerto: str = Field(min_length=1, max_length=20)
    fat: str = Field(min_length=1, max_length=60)
    direccion: str = Field(min_length=5, max_length=200)
    # D-82: ODN/evidencias siguen siendo opcionales en el alta administrativa.
    odn: str | None = Field(default=None, max_length=60)
    evidencias: list[str] = Field(default_factory=list, max_length=2)
    id_sector: int | None = None
    id_cuadrilla: int | None = None
    origen: str = "REPORTE_TECNICO"
    # D-118: casos que se asocian en el mismo alta (mínimo 1, validado en el endpoint).
    ids_caso: list[int] = Field(default_factory=list, max_length=500)


class FallaMasivaCampo(FallaMasivaManual):
    """D-82 · reporte de falla masiva desde la APK (RF-16).

    Exige la **ODN**, la **dirección**, la **FAT** y la **descripción** del
    incidente, y admite **como máximo 2 fotos** de evidencia (seriales ya
    subidos con `POST /evidencias/upload`).
    """

    odn: str = Field(min_length=3, max_length=60)
    direccion: str = Field(min_length=5, max_length=200)
    fat: str = Field(min_length=1, max_length=60)
    descripcion: str = Field(min_length=5, max_length=500)


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


# --------------------------------------------------------------------------- #
# D-99 · Módulo MASIVAS
# --------------------------------------------------------------------------- #
class CasoAsociadoOut(BaseModel):
    """Caso vinculado a una falla masiva (sección CASOS ASOCIADOS de la ficha)."""

    model_config = ConfigDict(from_attributes=True)

    id_caso: int
    id_averia: str
    estado_actual: str
    nombre_cliente: str | None = None
    telefono: str | None = None
    direccion: str | None = None
    id_sector: int | None = None
    sector_nombre: str | None = None
    #: Datos técnicos y RUTA unificada (Slot · Puerto · FAT), más el EXTRA del
    #: archivo de ingesta, que es donde viaja la ruta en la mayoría de los casos.
    olt: str | None = None
    slot: str | None = None
    puerto: str | None = None
    fat: str | None = None
    extra: str | None = None
    ruta: str | None = None
    id_cuadrilla: int | None = None
    cuadrilla_codigo: str | None = None
    cuadrilla_nombre: str | None = None
    #: AUTO = la agregó la detección por concentración · MANUAL = la agregó una persona.
    origen_asociacion: str = "AUTO"


class AsociarCasosRequest(BaseModel):
    """Cuerpo para asociar o desasociar casos de una masiva (D-99 · DEC-MA-1)."""

    ids_caso: list[int] = Field(min_length=1, max_length=500)


class CasoCandidatoOut(BaseModel):
    """Caso que coincide con OLT + slot + puerto + FAT de una masiva (D-118).

    Es lo que devuelve el buscador del alta manual y de la asociación: el
    operador ve solo casos del mismo FAT antes de asociarlos.
    """

    model_config = ConfigDict(from_attributes=True)

    id_caso: int
    id_averia: str
    estado_actual: str
    nombre_cliente: str | None = None
    direccion: str | None = None
    olt: str | None = None
    slot: str | None = None
    puerto: str | None = None
    fat: str | None = None
    id_sector: int | None = None
    sector_nombre: str | None = None
    id_cuadrilla: int | None = None
    cuadrilla_codigo: str | None = None
    cuadrilla_nombre: str | None = None


class CierreMasivaRequest(BaseModel):
    """Cierre de la masiva (RF-61 · RF-62 · DEC-MA-3).

    Exige la **descripción del trabajo**, el **personal del CRASS que valida la
    reparación** y las **evidencias**. Al cerrar, todos los casos asociados se
    cierran con el mismo modo y la misma descripción.
    """

    descripcion: str = Field(min_length=10, max_length=2000)
    id_validador_crass: int
    evidencias: list[str] = Field(default_factory=list, max_length=20)
    #: Modo de cierre aplicado a los casos asociados (RF-62: CERRAR + IVR).
    modo: Literal["IVR", "COS", "SACAS"] = "IVR"
    #: Descripción que queda en cada caso asociado; por defecto «Reparado en FDT».
    descripcion_caso: str = Field(default="Reparado en FDT", min_length=10, max_length=2000)
    id_causa: int | None = None
    latitud: float | None = None
    longitud: float | None = None


class CierreMasivaOut(BaseModel):
    """Resultado del cierre en cascada de una masiva."""

    id_falla: int
    estado: str
    casos_cerrados: int
    casos_omitidos: int
    detalle: list[dict[str, Any]] = Field(default_factory=list)


class UbicacionOut(BaseModel):
    """Ubicación del FAT afectado para el mapa de la sección MASIVAS (RF-60)."""

    id_falla: int
    latitud: float | None = None
    longitud: float | None = None
    direccion: str | None = None
    ruta: str | None = None
    olt: str | None = None
    fat: str | None = None
    sector_nombre: str | None = None
    #: MASIVA (coordenadas de la masiva) · EVIDENCIA (GPS de una foto) ·
    #: GEOCODIFICADA (resuelta desde la dirección) · SIN_DATOS.
    origen: str = "SIN_DATOS"
    #: Puntos GPS de las evidencias (actividad/evidencia) y de los casos.
    puntos: list[dict[str, Any]] = Field(default_factory=list)
    #: D-145: enlaces listos para el mapa (OpenStreetMap) cuando hay coordenadas
    #: o, al menos, una dirección con la que buscarla.
    url_mapa: str | None = None
    url_busqueda: str | None = None


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
