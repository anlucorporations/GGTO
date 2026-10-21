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
    #: D-113 · D-114: tipo principal del checklist de distribución.
    tipo_distribucion: str = "COMUNES"
    #: D-114: todos los tipos del checklist a los que pertenece el caso (un
    #: especial de gobierno suma a su actividad y a gobierno).
    tipos_distribucion: list[str] = Field(default_factory=list)
    #: D-77: el caso se despacha a la cuadrilla 0 (gestión), no a la de su sector.
    en_gestion: bool = False


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
    # D-99: trazas del corte de jornada y del último reproceso.
    cerrado_en: datetime | None = None
    cierre_auto: bool = False
    reprocesado_en: datetime | None = None
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
    #: D-114: los especiales separados por concepto (Gobierno suma a su actividad).
    especiales: int = 0
    especiales_reparacion: int = 0
    especiales_construccion: int = 0
    especiales_gobierno: int = 0
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
    #: D-114: los especiales separados en sus tres conceptos.
    especiales_reparacion: int = 0
    especiales_construccion: int = 0
    especiales_gobierno: int = 0
    sin_sector: int = 0
    #: D-113: total por tipo del checklist.
    por_tipo: dict[str, int] = Field(default_factory=dict)
    casos: list[CasoAsignadoOut] = Field(default_factory=list)


class TipoDespachoOut(BaseModel):
    """Tipo de caso que el supervisor marca en el checklist (D-113)."""

    clave: str
    etiqueta: str
    total: int = 0
    por_defecto: bool = False


class AsignacionBloque(BaseModel):
    id_cuadrilla: int
    ids_sector: list[int] = Field(default_factory=list)


class AsignacionUpdate(BaseModel):
    fecha: date
    id_central: int | None = None
    asignaciones: list[AsignacionBloque] = Field(default_factory=list)


class MasivaProcesoOut(BaseModel):
    """Masiva activa del día, para el icono MASIVA del despacho (D-99 · RF-71).

    D-113 añade la cuadrilla (reasignable desde el formulario de proceso) y los
    casos asociados, que se despachan a esa cuadrilla. D-114 añade el **sector**
    al que pertenece (para la lista desplegable de la tabla de sectores) y la
    marca `incluida`, que el formulario usa para dejar la masiva dentro o fuera
    del despacho.
    """

    id_falla: int
    id_cuadrilla: int | None = None
    cuadrilla_codigo: str | None = None
    cuadrilla_nombre: str | None = None
    estado: str
    descripcion: str
    es_activa: bool = True
    casos: int = 0
    ids_caso: list[int] = Field(default_factory=list)
    #: D-114: sector de la masiva (o el de sus casos si no lo declara).
    id_sector: int | None = None
    sector_nombre: str | None = None
    #: D-114: incluida en el despacho (el formulario arranca con todas dentro).
    incluida: bool = True


class SectorConstruccionOut(BaseModel):
    """Sector con su cantidad de construcciones (D-143)."""

    id_sector: int
    nombre: str | None = None
    cantidad: int = 0


class ConstruccionProcesoOut(BaseModel):
    """Bloque de CONSTRUCCIÓN del proceso de despacho (D-143).

    La construcción se procesa **aparte** del resto: el formulario muestra sus
    sectores con las cantidades y elige la cuadrilla que la atiende (una sola).
    """

    total: int = 0
    por_sector: list[SectorConstruccionOut] = Field(default_factory=list)
    id_cuadrilla: int | None = None
    cuadrilla_codigo: str | None = None
    cuadrilla_nombre: str | None = None
    automatica: bool = True


class DiaConstruccionOut(BaseModel):
    """Construcciones de un día del seguimiento global (D-143)."""

    fecha: date
    asignadas: int = 0
    cerradas: int = 0
    abiertas: int = 0


class SectorConstruccionSeguimientoOut(BaseModel):
    id_sector: int | None = None
    nombre: str | None = None
    asignadas: int = 0
    cerradas: int = 0


class SeguimientoConstruccionOut(BaseModel):
    """Seguimiento global de construcciones (D-143).

    `por_dia` es la serie para medir cuántas construcciones se realizaron cada
    día; `por_sector` reparte el periodo entre sectores y `totales` resume.
    """

    desde: date
    hasta: date
    id_central: int
    totales: dict = Field(default_factory=dict)
    por_dia: list[DiaConstruccionOut] = Field(default_factory=list)
    por_sector: list[SectorConstruccionSeguimientoOut] = Field(default_factory=list)


class ProcesoDespachoOut(BaseModel):
    fecha: date
    id_central: int
    asignacion_origen: str
    #: D-99 (RF-67): True en el **primer** procesamiento de la jornada, cuando el
    #: formulario debe pedir la asignación de sectores a las cuadrillas.
    primera_vez: bool = True
    #: D-99 (RF-68): True si la jornada ya tiene despachos (reproceso por sector).
    reproceso: bool = False
    #: D-113 · D-114: checklist de tipos (Comunes y Especiales Reparación por defecto).
    tipos: list[TipoDespachoOut] = Field(default_factory=list)
    masivas: list[MasivaProcesoOut] = Field(default_factory=list)
    universo: UniversoOut
    sectores: list[SectorProcesoOut] = Field(default_factory=list)
    cuadrillas: list[CuadrillaProcesoOut] = Field(default_factory=list)
    asignacion: list[AsignacionBloque] = Field(default_factory=list)
    grupos: list[GrupoCuadrillaOut] = Field(default_factory=list)
    sin_asignar: list[CasoAsignadoOut] = Field(default_factory=list)
    #: D-143: bloque aparte de construcción (sectores, cantidades y cuadrilla).
    construccion: ConstruccionProcesoOut = Field(default_factory=ConstruccionProcesoOut)
    reglas: dict = Field(default_factory=dict)
    resumen: dict = Field(default_factory=dict)


class AsignacionMasiva(BaseModel):
    """D-113 · D-114: cuadrilla que atiende una falla masiva y si entra al despacho.

    `incluida=False` deja la masiva **fuera** del proceso: sus casos no se
    despachan en esa jornada.
    """

    id_falla: int
    id_cuadrilla: int | None = None
    incluida: bool = True


class ProcesarDespacho(BaseModel):
    fecha: date
    id_central: int | None = None
    asignaciones: list[AsignacionBloque] = Field(default_factory=list)
    #: D-113 · D-114: tipos marcados en el checklist. `None` = todos (compatibilidad).
    tipos: list[str] | None = Field(
        default=None,
        description=(
            "Tipos a distribuir: COMUNES, ESPECIALES_REPARACION, "
            "ESPECIALES_CONSTRUCCION, ESPECIALES_GOBIERNO, MASIVAS"
        ),
    )
    #: D-113 · D-114: reasignación de las fallas masivas y su inclusión.
    masivas: list[AsignacionMasiva] = Field(default_factory=list)
    #: D-143: cuadrilla que atiende **toda** la construcción del día.
    construccion_cuadrilla: int | None = Field(
        default=None,
        description=(
            "Cuadrilla a la que se asigna toda la construcción. Si se omite, se "
            "usa la regla automática (la cuadrilla con más sectores de construcción)."
        ),
    )
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


class EfectividadCuadrillaOut(BaseModel):
    """Efectividad de una cuadrilla en el periodo (D-146)."""

    id_cuadrilla: int
    codigo: str
    nombre: str
    activa: bool = True
    #: Posición en el ranking (None si no tiene muestra suficiente).
    posicion: int | None = None
    puntaje: float = 0.0
    etiqueta: str = "BAJO"
    muestra_suficiente: bool = False
    #: Componentes del puntaje, en 0..1.
    componentes: dict = Field(default_factory=dict)
    #: Conteos crudos: la misma información con la que se calcula el puntaje.
    asignados: int = 0
    cerrados: int = 0
    devueltos: int = 0
    en_plazo: int = 0
    con_evidencia: int = 0
    reaperturas: int = 0
    casos_unicos: int = 0
    dias_trabajados: int = 0
    por_estado: dict = Field(default_factory=dict)


class RankingEfectividadOut(BaseModel):
    """Ranking de efectividad de las cuadrillas de la central (D-146).

    Incluye los pesos y la definición de cada criterio para que el número sea
    reproducible: el ranking no es una caja negra.
    """

    desde: date
    hasta: date
    id_central: int
    pesos: dict
    criterios: dict
    minimo_muestras: int
    dias_oportunidad: int
    ranking: list[EfectividadCuadrillaOut] = Field(default_factory=list)


class ReporteProduccionOut(BaseModel):
    fecha: date
    id_central: int
    por_cuadrilla: list[dict]
    totales: dict


class CierreJornadaOut(BaseModel):
    """Resultado del corte de jornada del despacho (D-99 · RF-65)."""

    despachos_cerrados: int = 0
    casos_pendientes: int = 0
    hora_corte: str
    fecha_corte: str
    detalle: list[dict] = Field(default_factory=list)


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
