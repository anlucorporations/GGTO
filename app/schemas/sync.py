"""Esquemas Pydantic del módulo de sincronización móvil (D-73).

Incluye:
  - `SyncCuadrillaOut`: cuadrilla activa resuelta para el usuario logueado.
  - `SyncDescargaOut`: payload diferencial devuelto por `GET /sync/descarga`.
  - `EvidenciaUploadOut`: confirmación de subida de una foto a Cloud Storage.
  - `ActividadSyncIn` / `EstadoSyncIn` / `SyncCargaIn`: batch enviado por la APK.
  - `SyncCargaOut`: resumen de la carga aplicada en el servidor.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

#: Tipos que la APK puede enviar. «ENRUTADO» se normaliza a «ENRUTE» al guardar
#: (`actividad.tipo` solo admite los valores del CHECK del DDL).
TipoActividad = Literal["CONTACTO", "CIERRE", "CITA", "ENRUTE", "ENRUTADO", "DIFERIDO"]


class SyncCuadrillaOut(BaseModel):
    id_cuadrilla: int | None = None
    codigo: str | None = None
    nombre: str | None = None
    desde: date | None = None
    es_supervisor: bool = False


class CuadrillaSyncOut(BaseModel):
    """Cuadrilla que el servidor resolvió para la DESCARGA (D-83)."""

    id_cuadrilla: int
    codigo: str
    nombre: str
    es_supervisor: bool = False


class DespachoDelDiaOut(BaseModel):
    """Despacho de **hoy** de la cuadrilla (D-104).

    Si no viene (`null`), la cuadrilla **no tiene jornada del día** y la APK no
    debe borrar ningún caso: el técnico puede estar trabajando con el de ayer.
    """

    id_despacho: int
    fecha: date


class CasoSyncOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_caso: int
    id_averia: str
    estado_actual: str
    tipo_caso: str
    categoria: str
    sector_nombre: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    nombre_cliente: str | None = None
    problema_reporte: str | None = None
    informacion: str | None = None
    fecha_cita: datetime | None = None
    actualizado_en: datetime | None = None
    orden_visita: int | None = None
    tipo_asignacion: str | None = None
    observacion_despacho: str | None = None
    # D-96/D-99: teléfono de contacto y datos técnicos del caso. Sin ellos el
    # bloque «Técnica» de la ficha de la APK no se pintaba tras la descarga.
    contacto_cliente: str | None = None
    persona_reporta: str | None = None
    olt: str | None = None
    plan: str | None = None
    slot: str | None = None
    puerto: str | None = None
    fat: str | None = None
    #: Columna EXTRA del archivo de ingesta: es donde viaja la RUTA.
    extra: str | None = None
    serial: str | None = None
    tipo_servicio: str | None = None
    area_trabajo: str | None = None
    nombre_central: str | None = None
    ultimo_comentario: str | None = None
    fecha_reporte: datetime | None = None
    es_falla_masiva: bool = False


class CatalogoSyncOut(BaseModel):
    modelos: list[dict] = Field(default_factory=list)
    causas: list[dict] = Field(default_factory=list)


class SyncDescargaOut(BaseModel):
    server_ts: datetime
    casos: list[CasoSyncOut] = Field(default_factory=list)
    catalogos: CatalogoSyncOut = Field(default_factory=CatalogoSyncOut)
    # D-83: la APK explica por qué no hay casos en lugar de decir siempre
    # «No hay casos nuevos ni cambios».
    motivo: str = "OK"
    mensaje: str = ""
    cuadrilla: CuadrillaSyncOut | None = None
    casos_cuadrilla: int = 0
    # D-99 (RF-72): masivas activas que atañen a la cuadrilla, con sus CASOS
    # ASOCIADOS y la RUTA, para el bloque MASIVA fijo de la APK.
    masivas: list[dict] = Field(default_factory=list)
    # D-104: jornada del día. `despacho_del_dia` es `null` si la cuadrilla no
    # tiene despacho hoy, y en ese caso la APK **no borra** casos; `ids_del_dia`
    # son los casos del despacho de hoy, que la APK conserva siempre.
    despacho_del_dia: DespachoDelDiaOut | None = None
    ids_del_dia: list[int] = Field(default_factory=list)
    # D-119: todo el trabajo vigente de la cuadrilla (los casos que el servidor le
    # reconoce, estén o no en el despacho de hoy). La purga del dispositivo
    # conserva estos ids: sin ellos se borraba lo que la descarga acababa de
    # entregar cuando el despacho del día seguía en BORRADOR.
    ids_vigentes: list[int] = Field(default_factory=list)


class SyncDescargaIn(BaseModel):
    """Cuerpo de `POST /sync/descarga` (D-127 · H-10).

    La descarga diferencial llevaba los ids conocidos en la **query string**
    (`?ids_conocidos=1&ids_conocidos=2…`): con cientos de casos la URL crece sin
    límite y el proxy o el servidor pueden rechazarla. El mismo contrato viaja
    ahora en JSON; `ids_conocidos = null` mantiene el significado de la versión
    GET (el dispositivo no declara lo que tiene).
    """

    desde: datetime | None = None
    ids_conocidos: list[int] | None = None


class EvidenciaUploadOut(BaseModel):
    id_evidencia: int
    serial_imagen: str
    ruta_remota: str
    url_firmada: str | None = None


class ActividadSyncIn(BaseModel):
    id_actividad_local: int | None = None
    id_caso: int
    tipo: TipoActividad
    resultado: str | None = Field(
        default=None,
        max_length=20,
        description="Resultado de campo (EXITOSO, NO_ATIENDE…). El servidor lo "
                    "normaliza al valor que admite el DDL de `actividad`.",
    )
    reporte_corto: str | None = Field(default=None, max_length=2000)
    id_metodo: int | None = None
    modo: str | None = Field(
        default=None,
        max_length=20,
        description="Modo de cierre del catálogo (IVR/COS/SACAS). Si llega, el "
                    "servidor resuelve `id_metodo`; la APK lo conserva offline.",
    )
    id_causa: int | None = None
    fecha_hora: datetime
    latitud: float | None = None
    longitud: float | None = None
    evidencias: list[str] = Field(default_factory=list, max_length=5)


class EstadoSyncIn(BaseModel):
    id_caso: int
    estado_nuevo: str
    motivo: str | None = Field(default=None, max_length=200)
    #: D-129 · H-12: id de la acción en la cola del dispositivo. Ordena el lote
    #: junto con las actividades (sin él, un CONTACTADO anterior podía aplicarse
    #: después de un CIERRE y revertirlo).
    id_actividad_local: int | None = None


class SyncCargaIn(BaseModel):
    id_sync_log: int | None = None  # D-81: sesión asociada (opcional, retrocompatible)
    dispositivo_id: str | None = Field(default=None, max_length=80)
    version_app: str | None = Field(default=None, max_length=20)
    actividades: list[ActividadSyncIn] = Field(default_factory=list, max_length=200)
    estados: list[EstadoSyncIn] = Field(default_factory=list, max_length=200)


class ErrorSyncItem(BaseModel):
    id_caso: int | None = None
    id_actividad_local: int | None = None
    mensaje: str


class ItemCargaOut(BaseModel):
    """Resultado de **una** acción de la cola del dispositivo (D-121).

    La APK marca cada acción con su propio desenlace en lugar de todo el lote: una
    acción rechazada (p. ej. un caso reasignado) queda en `ERROR` visible y no
    arrastra al resto.
    """

    id_actividad_local: int | None = None
    id_caso: int | None = None
    aceptada: bool = False
    mensaje: str | None = None
    #: Actividad ya registrada (o recién creada) en el servidor.
    id_actividad: int | None = None


class SyncCargaOut(BaseModel):
    aceptadas: int = 0
    rechazadas: int = 0
    errores: list[ErrorSyncItem] = Field(default_factory=list)
    #: Desglose por acción de la cola (vacío si el cliente no envía ids locales).
    items: list[ItemCargaOut] = Field(default_factory=list)
    server_ts: datetime


# --------------------------------------------------------------------------- #
# Sesiones de sincronización y checklist (D-81 · RF-39 / RF-40)
# --------------------------------------------------------------------------- #
TipoSesion = Literal["DESCARGA", "CARGA"]
PasoChecklist = Literal["CONEXION", "LOGIN", "DESCARGA", "CARGA"]
EstadoChecklist = Literal["PENDIENTE", "EN_CURSO", "OK", "ERROR", "OMITIDO"]
EstadoSesion = Literal["OK", "PARCIAL", "ERROR"]


class SyncSesionIn(BaseModel):
    tipo: TipoSesion
    dispositivo_id: str | None = Field(default=None, max_length=80)
    version_app: str | None = Field(default=None, max_length=20)


class SyncSesionOut(BaseModel):
    id_sync_log: int


class ChecklistPasoIn(BaseModel):
    paso: PasoChecklist
    estado: EstadoChecklist
    fecha_hora: datetime | None = None
    detalle: dict | None = None


class ChecklistIn(BaseModel):
    pasos: list[ChecklistPasoIn] = Field(default_factory=list, max_length=4)


class SyncSesionCierreIn(BaseModel):
    recibidos: int = Field(default=0, ge=0)
    procesados: int = Field(default=0, ge=0)
    errores: int = Field(default=0, ge=0)
    estado: EstadoSesion | None = None
    detalle: dict | None = None
    checklist: list[ChecklistPasoIn] = Field(default_factory=list, max_length=4)


class SyncSesionCierreOut(BaseModel):
    id_sync_log: int
    estado: str
    recibidos: int
    procesados: int
    errores: int
    duracion_ms: int | None = None


class ChecklistPasoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    paso: str
    estado: str
    fecha_hora: datetime | None = None
    detalle: dict | None = None
