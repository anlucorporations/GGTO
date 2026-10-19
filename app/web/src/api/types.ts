/**
 * Tipos del dominio GGTO — espejo de los esquemas Pydantic del backend
 * (`app/schemas/auth.py` y `app/schemas/config.py`).
 */

/* ------------------------------------------------------------------ */
/* Autenticación                                                       */
/* ------------------------------------------------------------------ */

export interface Usuario {
  p00: string;
  correo: string | null;
  rol: string;
  id_rol: number;
  id_central: number | null;
  nombre: string | null;
  apellido: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  usuario: Usuario;
}

export interface PalabraPosicion {
  pos: number;
  valor: string;
}

export interface UnlockResponse {
  p00: string;
  bloqueado: boolean;
  mensaje: string;
}

/** Estado del P00 para el proceso de primer acceso (D-67). */
export type EstadoPrimerAcceso =
  | 'INEXISTENTE'
  | 'PENDIENTE'
  | 'ACTIVO'
  | 'BLOQUEADO'
  | 'INACTIVO';

export interface PrimerAccesoOut {
  p00: string;
  registrado: boolean;
  estado: EstadoPrimerAcceso;
  puede_registrarse: boolean;
  nombre: string | null;
  mensaje: string;
}

export interface SetupResponse {
  p00: string;
  palabras: string[];
  aviso: string;
}

export interface RegenerarPalabrasResponse {
  p00: string;
  palabras: string[];
  aviso: string;
}

/** Estado de la seguridad de la propia cuenta (Perfil, D-72). */
export interface MiSeguridad {
  p00: string;
  tiene_palabras: boolean;
  version: number | null;
  cantidad: number;
  actualizado_en: string | null;
  requiere_cambio_clave: boolean;
  bloqueado: boolean;
}

/** Datos editables del propio perfil (D-72). */
export interface MeUpdate {
  correo: string;
}

export interface CambioClaveRequest {
  clave_actual: string;
  clave_nueva: string;
  confirmacion: string;
}

/** Ciclo de vida de la cuenta de acceso de un técnico (D-67). */
export type EstadoCuentaTecnico =
  | 'SIN_ALTA'
  | 'BLOQUEADO'
  | 'REQUIERE_CAMBIO'
  | 'INACTIVO'
  | 'ACTIVO';

/* ------------------------------------------------------------------ */
/* CENTRAL                                                             */
/* ------------------------------------------------------------------ */

export interface Central {
  id_central: number;
  region: string;
  estado_geografico: string;
  capital_estado: string | null;
  municipio: string;
  parroquia: string;
  estado_operativo: string | null;
  distrito: string | null;
  area: string;
  codigo_central: string;
  nombre_central: string;
  activa: boolean;
}

export type CentralCreate = Omit<Central, 'id_central'>;
export type CentralUpdate = Partial<CentralCreate>;

/* ------------------------------------------------------------------ */
/* SECTORES                                                            */
/* ------------------------------------------------------------------ */

export type TipoCoincidencia = 'CONTIENE' | 'EXACTO' | 'REGEX';

export interface SectorDireccionCreate {
  patron: string;
  tipo_coincidencia: TipoCoincidencia;
  normalizar: boolean;
  activo: boolean;
}

export interface SectorDireccion extends SectorDireccionCreate {
  id_sector_direccion: number;
  id_sector: number;
}

export interface Sector {
  id_sector: number;
  id_central: number;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  prioridad: number;
  activo: boolean;
  direcciones: SectorDireccion[];
}

export interface SectorCreate {
  id_central: number;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  prioridad: number;
  activo: boolean;
  direcciones: SectorDireccionCreate[];
}

export type SectorUpdate = Partial<Omit<SectorCreate, 'id_central' | 'direcciones'>>;

/* ------------------------------------------------------------------ */
/* TÉCNICOS                                                            */
/* ------------------------------------------------------------------ */

export type StatusTecnico = 'ACTIVO' | 'INACTIVO' | 'VACACIONES' | 'SUSPENDIDO';

export interface Tecnico {
  id_tecnico: number;
  id_central: number;
  nombre: string;
  apellido: string | null;
  cedula: string | null;
  p00: string;
  telefono: string | null;
  correo: string | null;
  especialidad: string | null;
  status: StatusTecnico;
  estado_cuenta?: EstadoCuentaTecnico;
  /** Rol efectivo de la cuenta de acceso (D-68). `null` si aún no tiene cuenta. */
  rol?: RolAsignable | 'SUPER' | null;
}

/** Roles asignables desde TÉCNICOS; el SUPER no se reparte (D-68). */
export type RolAsignable = 'TECNICO' | 'SUPERVISOR' | 'ADMIN';

export interface TecnicoCreate {
  id_central: number;
  nombre: string;
  apellido?: string | null;
  cedula?: string | null;
  p00: string;
  telefono?: string | null;
  correo?: string | null;
  especialidad?: string | null;
  status: StatusTecnico;
}

/** `p00` no es modificable por PATCH. */
export type TecnicoUpdate = Partial<Omit<TecnicoCreate, 'p00'>>;

/* ------------------------------------------------------------------ */
/* FLOTA                                                               */
/* ------------------------------------------------------------------ */

export type StatusFlota = 'DISPONIBLE' | 'EN_RUTA' | 'MANTENIMIENTO' | 'FUERA_SERVICIO';

export interface Flota {
  id_flota: number;
  id_central: number;
  can: string;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  placa: string | null;
  combustible: string | null;
  status: StatusFlota;
  estado_cauchos: string | null;
  estado_fluidos: string | null;
  estado_general: string | null;
}

export interface FlotaCreate {
  id_central: number;
  can: string;
  tipo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  placa?: string | null;
  combustible?: string | null;
  status: StatusFlota;
  estado_cauchos?: string | null;
  estado_fluidos?: string | null;
  estado_general?: string | null;
}

export type FlotaUpdate = Partial<FlotaCreate>;

/* ------------------------------------------------------------------ */
/* CUADRILLAS                                                          */
/* ------------------------------------------------------------------ */

export type RolCuadrilla = 'REPARADOR_PRINCIPAL' | 'AYUDANTE' | 'SUPERVISOR';

export interface CuadrillaIntegranteCreate {
  id_tecnico: number;
  rol_cuadrilla: RolCuadrilla;
  desde?: string | null;
}

export interface CuadrillaIntegrante {
  id_tecnico: number;
  rol_cuadrilla: RolCuadrilla;
  desde: string;
  hasta: string | null;
}

export interface Cuadrilla {
  id_cuadrilla: number;
  id_central: number;
  codigo: string;
  nombre: string;
  id_flota: number | null;
  es_supervisor: boolean;
  activa: boolean;
  integrantes: CuadrillaIntegrante[];
}

export interface CuadrillaCreate {
  id_central: number;
  codigo: string;
  nombre: string;
  id_flota?: number | null;
  es_supervisor: boolean;
  activa: boolean;
  integrantes: CuadrillaIntegranteCreate[];
  herramientas: number[];
}

export type CuadrillaUpdate = Partial<
  Pick<CuadrillaCreate, 'codigo' | 'nombre' | 'id_flota' | 'es_supervisor' | 'activa'>
>;

/* ------------------------------------------------------------------ */
/* CATÁLOGOS                                                           */
/* ------------------------------------------------------------------ */

export interface Causa {
  id_causa: number;
  codigo_causa: string;
  subcodigo_causa: string;
  descripcion: string | null;
  descripcion_subcodigo: string | null;
  tipo: string | null;
  activo: boolean;
}

export type CausaCreate = Omit<Causa, 'id_causa'>;

export type DominioMetodo = 'CIERRE' | 'ENRUTE' | 'DIFERIDO' | 'CONTACTO';

export interface Metodo {
  id_metodo: number;
  dominio: DominioMetodo;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export type MetodoCreate = Omit<Metodo, 'id_metodo'>;

/* ------------------------------------------------------------------ */
/* PARÁMETROS                                                          */
/* ------------------------------------------------------------------ */

export interface Parametro {
  clave: string;
  valor: unknown;
  descripcion: string | null;
  actualizado_en: string | null;
}

export interface ParametroUpdate {
  valor: unknown;
  descripcion?: string | null;
}

/* ------------------------------------------------------------------ */
/* INGESTA                                                             */
/* ------------------------------------------------------------------ */

export interface EjemploCaso {
  id_averia: string;
  direccion: string | null;
  sector: number | null;
  cuadrilla0: boolean;
}

export interface DireccionSinSector {
  direccion: string;
  total: number;
  ejemplo_id_averia: string | null;
}

export interface ResumenIngesta {
  archivo: string;
  filas_leidas: number;
  filas_central: number;
  casos_nuevos: number;
  casos_duplicados: number;
  casos_descartados: number;
  sectorizados: number;
  sin_sector: number;
  cuadrilla0: number;
  avisos: string[];
  ejemplos: EjemploCaso[];
  direcciones_sin_sector?: DireccionSinSector[];
  id_lote: number | null;
}

export interface SectorizacionPendientesOut {
  revisados: number;
  asignados: number;
  sin_sector: number;
}

/** Direcciones del sistema sin sector (D-106): vista permanente de la ingesta. */
export interface DireccionesSinSectorOut {
  total_direcciones: number;
  total_casos: number;
  direcciones: DireccionSinSector[];
}

export interface IngestaLoteOut {
  id_lote: number;
  archivo: string;
  fecha_archivo: string | null;
  id_central: number | null;
  filas_leidas: number;
  filas_central: number;
  casos_nuevos: number;
  casos_duplicados: number;
  casos_descartados: number;
  estado: string;
  detalle_error: string | null;
  usuario: string | null;
  creado_en: string | null;
}

/* ------------------------------------------------------------------ */
/* CASOS (Ciclo 4)                                                     */
/* ------------------------------------------------------------------ */

export type EstadoCaso =
  | 'NUEVO'
  | 'ASIGNADO'
  | 'CONTACTADO'
  | 'CITADO'
  | 'DIFERIDO'
  | 'EN_GESTION'
  | 'ENRUTADO'
  | 'CERRADO'
  | 'CANCELADO';

export type TipoCaso = 'AVERIA' | 'REPARACION' | 'CONSTRUCCION';

export type CategoriaCaso = 'RESIDENCIAL' | 'EMPRESA' | 'REFERIDO' | 'GOBIERNO';

export type OrigenCaso = 'INGESTA_CSV' | 'MANUAL' | 'TELEGRAM' | 'MCP_IA';

export interface CasoOut {
  id_caso: number;
  id_averia: string;
  id_central: number;
  origen: string;
  tipo_caso: string;
  categoria: string;
  estado_actual: string;
  id_sector: number | null;
  sector_nombre: string | null;
  id_causa: number | null;
  id_lote_ingesta: number | null;
  en_gestion_supervisor: boolean;
  es_falla_masiva: boolean;

  /* Iconos de estado del listado (RF-33): los calcula la API. */
  pendiente: boolean;
  asignado: boolean;
  citado: boolean;
  gestion: boolean;

  /* D-78: cuadrilla del último despacho que incluyó el caso (la calcula la API). */
  id_cuadrilla: number | null;
  cuadrilla_codigo: string | null;
  cuadrilla_nombre: string | null;

  region: string | null;
  estado_geografico: string | null;
  municipio: string | null;
  parroquia: string | null;
  area: string | null;
  codigo_central: string | null;
  nombre_central: string | null;

  telefono: string | null;
  nombre_cliente: string | null;
  direccion: string | null;
  persona_reporta: string | null;
  contacto_cliente: string | null;

  // D-89/D-90: identificador de pago (70*) y marca de la regla REPARACIÓN/REFERIDO.
  id_pago: number | null;
  marcado_reclasificar: boolean;
  motivo_marca: string | null;
  tiene_identificador_pago: boolean;
  tiene_id_averia_real: boolean;

  fecha_reporte: string | null;
  fecha_compromiso: string | null;
  fecha_cita: string | null;

  problema_reporte: string | null;
  ultimo_comentario: string | null;
  informacion: string | null;
  results: string | null;
  estatus_origen: string | null;

  olt: string | null;
  plan: string | null;
  slot: string | null;
  puerto: string | null;
  fat: string | null;
  serial: string | null;
  tipo_servicio: string | null;
  tipo_problema: string | null;
  area_trabajo: string | null;
  unidad_negocio: string | null;

  cuadrilla_externa: string | null;
  reparador_principal: string | null;
  ayudantes: unknown[];
  flota_can: string | null;

  creado_en: string | null;
  actualizado_en: string | null;
}

export interface PaginaCasos {
  items: CasoOut[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** Alta manual (RF-32). RN-AL-01: los datos de abajo son obligatorios. */
export interface CasoManualCreate {
  id_central?: number | null;
  /** Tipo de reporte de la alta: sola REPARACIÓN o CONSTRUCCIÓN. */
  tipo_reporte: 'REPARACION' | 'CONSTRUCCION';
  /** Obligatorio cuando `tipo_reporte` es REPARACION. */
  id_averia?: string | null;
  categoria?: CategoriaCaso;
  nombre_cliente: string;
  /** Teléfono con el identificador de pago (70*) del caso. */
  id_pago: string;
  telefono?: string | null;
  direccion: string;
  informacion?: string | null;
  problema_reporte?: string | null;
  /** Obligatorio cuando `tipo_reporte` es REPARACION. */
  tipo_problema?: string | null;
  persona_reporta?: string | null;
  contacto_cliente: string;
  fecha_reporte?: string | null;
  fecha_cita?: string | null;
  fecha_compromiso?: string | null;
  id_sector?: number | null;
  tipo_servicio?: string | null;
}

export interface CasoUpdate {
  nombre_cliente?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  informacion?: string | null;
  problema_reporte?: string | null;
  ultimo_comentario?: string | null;
  persona_reporta?: string | null;
  contacto_cliente?: string | null;
  tipo_caso?: TipoCaso;
  categoria?: CategoriaCaso;
  estado_actual?: EstadoCaso;
  motivo_estado?: string | null;
  id_sector?: number | null;
  id_causa?: number | null;
  en_gestion_supervisor?: boolean;
  es_falla_masiva?: boolean;
  fecha_cita?: string | null;
  fecha_compromiso?: string | null;
  tipo_servicio?: string | null;
}

export interface CasoEstadoHistOut {
  id_hist: number;
  id_caso: number;
  estado_anterior: string | null;
  estado_nuevo: string;
  motivo: string | null;
  usuario: string | null;
  fecha_hora: string | null;
}

/** Cuerpo de `POST /casos/{id}/reactivar` (D-106): motivo obligatorio. */
export interface ReactivarCaso {
  motivo: string;
  estado?: Extract<EstadoCaso, 'NUEVO' | 'ASIGNADO' | 'EN_GESTION'>;
}

/** Parámetros del listado paginado de casos (RF-33). */
export type CasosFiltros = {
  q?: string;
  id_averia?: string;
  telefono?: string;
  id_central?: number;
  id_sector?: number;
  id_cuadrilla?: number;
  id_causa?: number;
  id_lote_ingesta?: number;
  estado_actual?: string;
  /** Solo casos abiertos (excluye CERRADO y CANCELADO) — sección CASOS. */
  solo_abiertos?: boolean;
  tipo_caso?: string;
  categoria?: string;
  origen?: string;
  en_gestion_supervisor?: boolean;
  es_falla_masiva?: boolean;
  desde?: string;
  hasta?: string;
  page?: number;
  page_size?: number;
};

/* ------------------------------------------------------------------ */
/* DESPACHO (Ciclo 5)                                                  */
/* ------------------------------------------------------------------ */

export type EstadoDespacho = 'BORRADOR' | 'PUBLICADO' | 'CERRADO';

export type EstadoDespachoCaso =
  | 'ASIGNADO'
  | 'GESTIONADO'
  | 'CERRADO'
  | 'CITADO'
  | 'DIFERIDO';

export type CanalDespacho = 'TELEGRAM' | 'CORREO';

export type TipoAsignacionDespacho =
  | 'REPARACION'
  | 'CONSTRUCCION'
  | 'REFERIDO'
  | 'EMPRESA'
  | 'FALLA_MASIVA';

export type OrigenFallaMasiva = 'AUTOMATICA' | 'REPORTE_TECNICO' | 'MCP';

export interface CasoAsignadoOut {
  id_caso: number;
  id_averia: string;
  id_sector: number | null;
  sector_nombre: string | null;
  tipo_asignacion: string;
  orden_visita: number;
  direccion: string | null;
  telefono: string | null;
  nombre_cliente: string | null;
  problema_reporte: string | null;
  estado_actual: string;
  categoria: string;
  tipo_caso: string;
  es_cita: boolean;
  especial?: boolean;
  /** D-113 · D-114: tipo principal del checklist de distribución. */
  tipo_distribucion?: string;
  /** D-114: todos los tipos del checklist a los que pertenece el caso. */
  tipos_distribucion?: string[];
  /** D-77: el caso va a la cuadrilla 0 (gestión), no a la de su sector. */
  en_gestion?: boolean;
}

/* ------------------ Proceso de despacho (D-66) --------------------- */

export interface SectorProcesoOut {
  id_sector: number;
  nombre: string | null;
  total: number;
  /** D-114: los especiales separados por concepto. */
  especiales: number;
  especiales_reparacion: number;
  especiales_construccion: number;
  especiales_gobierno: number;
  citados: number;
  id_cuadrilla: number | null;
}

export interface CuadrillaProcesoOut {
  id_cuadrilla: number;
  codigo: string;
  nombre: string;
  /** D-77: cuadrilla 0 (supervisor), sin sectores asignados. */
  es_supervisor?: boolean;
  ids_sector: number[];
  total: number;
}

export interface UniversoOut {
  total: number;
  comunes: number;
  especiales: number;
  /** D-114: los especiales separados en sus tres conceptos. */
  especiales_reparacion: number;
  especiales_construccion: number;
  especiales_gobierno: number;
  sin_sector: number;
  /** D-113: total por tipo del checklist. */
  por_tipo?: Record<string, number>;
  casos: CasoAsignadoOut[];
}

export interface AsignacionBloque {
  id_cuadrilla: number;
  ids_sector: number[];
}

/** D-113: tipo de caso que el supervisor marca en el checklist. */
export interface TipoDespachoOut {
  clave: string;
  etiqueta: string;
  total: number;
  por_defecto: boolean;
}

/** Masiva activa del día, para el icono MASIVA del despacho (D-99 · RF-71). */
export interface MasivaProcesoOut {
  id_falla: number;
  id_cuadrilla: number | null;
  cuadrilla_codigo?: string | null;
  cuadrilla_nombre?: string | null;
  estado: string;
  descripcion: string;
  es_activa: boolean;
  /** D-113: casos asociados que se despachan con la masiva. */
  casos?: number;
  ids_caso?: number[];
  /** D-114: sector de la masiva (o el de sus casos si no lo declara). */
  id_sector?: number | null;
  sector_nombre?: string | null;
  /** D-114: incluida en el despacho (arranca en `true`). */
  incluida?: boolean;
}

/** D-113 · D-114: cuadrilla que atiende una falla masiva y si entra al despacho. */
export interface AsignacionMasiva {
  id_falla: number;
  id_cuadrilla: number | null;
  incluida?: boolean;
}

export interface ProcesoDespachoOut {
  fecha: string;
  id_central: number;
  asignacion_origen: string;
  /**
   * D-99 (RF-67): `true` en el **primer** procesamiento de la jornada, cuando hay
   * que asignar los sectores a cada cuadrilla antes de procesar.
   */
  primera_vez: boolean;
  /** D-99 (RF-68): `true` si la jornada ya tiene despachos (es un reproceso). */
  reproceso: boolean;
  /** D-113 · D-114: checklist de tipos (Comunes y Especiales Reparación por defecto). */
  tipos?: TipoDespachoOut[];
  masivas: MasivaProcesoOut[];
  universo: UniversoOut;
  sectores: SectorProcesoOut[];
  cuadrillas: CuadrillaProcesoOut[];
  asignacion: AsignacionBloque[];
  grupos: GrupoCuadrillaOut[];
  sin_asignar: CasoAsignadoOut[];
  reglas: Record<string, unknown>;
  resumen: Record<string, unknown>;
}

export interface GrupoCuadrillaOut {
  id_cuadrilla: number;
  codigo: string;
  nombre: string;
  total: number;
  /** D-77: la cuadrilla 0 (supervisor) recibe los casos en GESTIÓN. */
  es_supervisor?: boolean;
  casos: CasoAsignadoOut[];
}

/** D-77: asignar o quitar casos (comunes y especiales) a una cuadrilla. */
export interface AsignacionCasosRequest {
  id_cuadrilla?: number | null;
  ids_caso?: number[];
  ids_caso_especial?: number[];
  fecha?: string | null;
  id_central?: number | null;
}

export interface AsignacionCasosOut {
  fecha: string;
  id_cuadrilla: number | null;
  cuadrilla_codigo: string | null;
  id_despacho: number | null;
  agregados: number;
  movidos: number;
  quitados: number;
  omitidos: number[];
  mensaje: string;
}

export interface PropuestaOut {
  fecha: string;
  id_central: number;
  grupos: GrupoCuadrillaOut[];
  sin_asignar: CasoAsignadoOut[];
  reglas: Record<string, unknown>;
  resumen: Record<string, unknown>;
}

export interface DespachoCasoOut {
  id_despacho_caso: number;
  id_caso: number;
  id_sector: number | null;
  orden_visita: number | null;
  tipo_asignacion: string | null;
  estado: string;
  observacion: string | null;
}

export interface DespachoDetalleOut {
  id_despacho: number;
  id_central: number;
  fecha: string;
  id_cuadrilla: number;
  estado: string;
  generado_auto: boolean;
  enviado_canal: string | null;
  enviado_en: string | null;
  reporte_produccion_en: string | null;
  /* D-99: trazas del corte de jornada y del último reproceso. */
  cerrado_en?: string | null;
  cierre_auto?: boolean;
  reprocesado_en?: string | null;
  usuario_crea: string | null;
  creado_en: string | null;
  cuadrilla_codigo: string | null;
  cuadrilla_nombre: string | null;
  casos: DespachoCasoOut[];
}

export interface DespachoUpdate {
  estado?: EstadoDespacho;
  enviado_canal?: CanalDespacho;
}

export interface CasoAgregar {
  id_caso: number;
  tipo_asignacion?: TipoAsignacionDespacho;
  orden_visita?: number;
  observacion?: string;
}

export interface CasoEstadoUpdate {
  estado: EstadoDespachoCaso;
  observacion?: string;
}

export interface NotificacionOut {
  id_notificacion: number;
  canal: string;
  destinatario: string | null;
  asunto: string | null;
  cuerpo: string | null;
  id_caso?: number | null;
  estado: string;
  error: string | null;
  intentos?: number;
  proximo_intento?: string | null;
  enviado_en: string | null;
  creado_en: string | null;
}

export interface EnvioOut {
  id_despacho: number;
  canal: string;
  estado: string;
  error: string | null;
  notificacion: NotificacionOut | null;
}

export interface ReporteProduccionOut {
  fecha: string;
  id_central: number;
  por_cuadrilla: FilaProduccionOut[];
  totales: Record<string, number>;
}

/**
 * Desglose de producción de una cuadrilla (RF-27 · RF-70).
 *
 * D-99 añade `abiertos` y `enrutado` —el aro de cumplimiento pinta ABIERTOS,
 * CERRADOS, ENRUTADO, DIFERIDO y CITADOS— y `es_masiva`/`masivas`, que encienden
 * el icono MASIVA de la cuadrilla a la que se le asignó una falla masiva.
 */
export interface FilaProduccionOut {
  cuadrilla: string;
  nombre: string;
  id_cuadrilla: number;
  asignados: number;
  abiertos: number;
  cerrados: number;
  enrutado: number;
  citados: number;
  diferidos: number;
  gestionados: number;
  referidos: number;
  empresas: number;
  es_masiva: boolean;
  masivas: number[];
}

/** Resultado del corte de jornada del despacho (D-99 · RF-65). */
export interface CierreJornadaOut {
  despachos_cerrados: number;
  casos_pendientes: number;
  hora_corte: string;
  fecha_corte: string;
  detalle: { id_despacho: number; fecha: string; casos_pendientes: number }[];
}

export interface FallaMasivaCreate {
  descripcion: string;
  id_sector?: number | null;
  origen?: OrigenFallaMasiva;
}

export interface FallaMasivaOut {
  id_falla: number;
  id_central: number;
  clave_concentracion?: string | null;
  descripcion: string;
  fecha_deteccion: string | null;
  origen: string;
  id_sector: number | null;
  id_cuadrilla: number | null;
  estado: string;
  planificacion: string | null;
  reporte_simple?: string | null;
  planificada_en?: string | null;
  actualizado_en?: string | null;
  /* Resumen enriquecido (D-75): sector, ruta unificada, dirección corta y
   * contador de órdenes de material. */
  sector_nombre?: string | null;
  cuadrilla_codigo?: string | null;
  cuadrilla_nombre?: string | null;
  ruta?: string | null;
  direccion_corta?: string | null;
  ordenes_count?: number;
  casos_afectos?: number | null;
  /* D-82: datos del reporte de campo desde la APK (ODN · dirección · FAT) y
   * los seriales de hasta 2 fotos de evidencia. */
  odn?: string | null;
  direccion?: string | null;
  fat?: string | null;
  /* D-118: identidad técnica del FAT (OLT + slot + puerto + FAT). */
  olt?: string | null;
  slot?: string | null;
  puerto?: string | null;
  evidencias?: string[];
  /* D-99 · MASIVAS: asociación explícita, cierre y ubicación del FAT. */
  casos_asociados?: number;
  validador_crass?: ValidadorCrassOut | null;
  descripcion_cierre?: string | null;
  evidencias_cierre?: string[];
  cerrada_por?: string | null;
  cerrada_en?: string | null;
  casos_cerrados?: number;
  latitud?: number | null;
  longitud?: number | null;
}

/* ------------------------------------------------------------------ */
/* SEGUIMIENTO, ESPECIALES Y AGENDA (Ciclo 6)                          */
/* ------------------------------------------------------------------ */

export type ClasificacionEspecial = 'REFERIDO' | 'EMPRESA' | 'GOBIERNO';
export type TipoActividadEspecial = 'REPARACION' | 'CONSTRUCCION';
export type PrioridadEspecial = 'ALTA' | 'MEDIA' | 'BAJA';
export type EstadoEspecial = 'ABIERTO' | 'EN_PROCESO' | 'ATENDIDO' | 'CERRADO';
export type CanalSolicitante = 'TELEGRAM' | 'MCP_IA' | 'MANUAL' | 'CORREO';

/* --- Solicitantes ------------------------------------------------- */

export interface Solicitante {
  id_solicitante: number;
  unidad: string;
  nombre: string;
  contacto: string;
  canal: CanalSolicitante | null;
}

export interface SolicitanteCreate {
  unidad: string;
  nombre: string;
  contacto: string;
  canal?: CanalSolicitante;
}

/* --- Casos especiales --------------------------------------------- */

export interface CasoEspecialCreate {
  clasificacion: ClasificacionEspecial;
  tipo_actividad: TipoActividadEspecial;
  prioridad?: PrioridadEspecial;
  descripcion?: string | null;
  requiere_informe?: boolean;
  id_caso?: number | null;
  id_solicitante?: number | null;
  crear_solicitante?: SolicitanteCreate;
  /** Obligatorio cuando `tipo_actividad` es REPARACION (RN-AL-01). */
  id_averia?: string | null;
  nombre_cliente?: string | null;
  contacto_cliente?: string | null;
  /** Teléfono con el identificador de pago (70*) del caso. */
  telefono?: string | null;
  direccion?: string | null;
  /** Obligatorio cuando `tipo_actividad` es REPARACION. */
  tipo_problema?: string | null;
}

export interface CasoEspecialUpdate {
  clasificacion?: ClasificacionEspecial;
  tipo_actividad?: TipoActividadEspecial;
  prioridad?: PrioridadEspecial;
  descripcion?: string | null;
  requiere_informe?: boolean;
  estado?: EstadoEspecial;
  id_solicitante?: number | null;
}

export interface CasoEspecialOut {
  id_caso_especial: number;
  id_caso: number | null;
  id_solicitante: number | null;
  clasificacion: string;
  tipo_actividad: string;
  prioridad: string;
  tiene_id_averia: boolean;
  descripcion: string | null;
  requiere_informe: boolean;
  estado: string;
  creado_en: string | null;
  actualizado_en: string | null;

  /* Resumen del listado (RF-35): los calcula la API. */
  sector_nombre: string | null;
  /** D-103: FAT del caso asociado (acompaña al sector en el listado). */
  fat: string | null;
  solicitante_nombre: string | null;
  solicitante_unidad: string | null;
  /* D-72: Dirección y Nombre tomados del caso asociado. */
  direccion: string | null;
  nombre_cliente: string | null;
  /* RN-AL-01: contacto, identificador de pago y tipo de problema del caso. */
  contacto_cliente: string | null;
  telefono: string | null;
  tipo_problema: string | null;
  pendiente: boolean;
  asignado: boolean;
  citado: boolean;
  gestion: boolean;

  /* D-80: cuadrilla del último despacho del caso asociado. */
  id_cuadrilla: number | null;
  cuadrilla_codigo: string | null;
  cuadrilla_nombre: string | null;
}

/** Filtros del listado de casos especiales (RF-06/RF-35). */
export type CasosEspecialesFiltros = {
  clasificacion?: string;
  estado?: string;
  prioridad?: string;
  /** D-72: Actividad, Solicitante y texto libre sobre todos los renglones. */
  tipo_actividad?: string;
  id_solicitante?: number;
  q?: string;
  solo_pendientes?: boolean;
};

/* --- Agenda de citas ---------------------------------------------- */

export type TipoCita = 'CONTACTO' | 'ATENCION';

export type EstadoCita =
  | 'PROPUESTA'
  | 'CONFIRMADA'
  | 'CUMPLIDA'
  | 'REPROGRAMADA'
  | 'DIFERIDA'
  | 'CANCELADA';

export interface CitaCreate {
  fecha_hora: string;
  tipo?: TipoCita;
  estado?: EstadoCita;
  id_caso?: number | null;
  id_caso_especial?: number | null;
  id_cuadrilla?: number | null;
  observacion?: string | null;
  permitir_solape?: boolean;
}

export interface CitaUpdate {
  fecha_hora?: string;
  tipo?: TipoCita;
  estado?: EstadoCita;
  id_cuadrilla?: number | null;
  observacion?: string | null;
  permitir_solape?: boolean;
}

export interface CitaOut {
  id_cita: number;
  id_caso: number | null;
  id_caso_especial: number | null;
  id_cuadrilla: number | null;
  fecha_hora: string;
  tipo: string;
  estado: string;
  observacion: string | null;
  creado_por: string | null;
  creado_en: string | null;
}

/** Filtros de la agenda (RF-12). `desde`/`hasta` son ISO con hora. */
export type CitasFiltros = {
  desde?: string;
  hasta?: string;
  id_cuadrilla?: number;
  estado?: string;
  /** D-72: Tipo y Clase del caso asociado. */
  tipo_caso?: string;
  categoria?: string;
};

/* --- Seguimiento (RF-34) ------------------------------------------ */

export type EstadoSeguimiento = 'EN_COLA' | 'RESUELTO' | 'DEVUELTO';

export interface SeguimientoCreate {
  id_caso: number;
  instancia_destino: string;
  motivo?: string | null;
  estado?: EstadoSeguimiento;
  observacion?: string | null;
}

export interface SeguimientoUpdate {
  instancia_destino?: string;
  motivo?: string | null;
  estado?: EstadoSeguimiento;
  observacion?: string | null;
  fecha_retorno?: string | null;
}

export interface SeguimientoOut {
  id_seguimiento: number;
  id_caso: number;
  instancia_destino: string;
  motivo: string | null;
  fecha_envio: string | null;
  fecha_retorno: string | null;
  estado: string;
  observacion: string | null;
  usuario: string | null;
}

export type SeguimientoFiltros = {
  id_caso?: number;
  estado?: string;
  instancia_destino?: string;
};

/* ------------------------------------------------------------------ */
/* RESUMEN                                                             */
/* ------------------------------------------------------------------ */

export interface Resumen {
  tablas: number;
  centrales: number;
  roles: number;
  cuadrillas: number;
  causas: number;
  parametros: number;
}

/* ------------------------------------------------------------------ */
/* MONITOREO Y REPORTES (Ciclo 7)                                      */
/* ------------------------------------------------------------------ */

/** Gestión de una jornada (`GET /monitoreo/diario`). */
export interface MonitoreoDiario {
  fecha: string;
  ingresos_nuevos: number;
  resueltos_residencial: number;
  resueltos_empresarial: number;
  resueltos_referidos: number;
  citados: number;
  diferidos: number;
  gestionados: number;
  pendientes_total: number;
}

/** Punto diario del reporte semanal (lunes a sábado). */
export interface MonitoreoDiaSemanal {
  fecha: string;
  asignados: number;
  cerrados: number;
  gestionados: number;
}

export interface MonitoreoSemanal {
  desde: string;
  hasta: string;
  dias: MonitoreoDiaSemanal[];
}

export interface MonitoreoGlobales {
  desde: string;
  hasta: string;
  pendientes: number;
  resueltos: number;
  total: number;
  por_estado: Record<string, number>;
  por_categoria: Record<string, number>;
}

export interface MonitoreoReparacion {
  residenciales_comunes: number;
  residenciales_referidos: number;
  empresariales: number;
  total: number;
}

export interface MonitoreoConstruccion {
  residenciales: number;
  empresariales: number;
  total: number;
}

export interface MonitoreoCuadrillaTotales {
  asignados: number;
  cerrados: number;
  gestionados: number;
}

export interface MonitoreoCuadrilla {
  id_cuadrilla: number;
  codigo: string;
  nombre: string;
  dias: MonitoreoDiaSemanal[];
  totales: MonitoreoCuadrillaTotales;
}

export interface MonitoreoCuadrillaOut {
  desde: string;
  dias: number;
  cuadrillas: MonitoreoCuadrilla[];
}

export interface CapacidadCuadrilla {
  id_cuadrilla: number;
  codigo: string;
  nombre: string;
  es_supervisor: boolean;
  integrantes: number;
  flota: string | null;
  completa: boolean;
}

export interface MonitoreoCapacidad {
  cuadrillas_activas: number;
  cuadrillas: CapacidadCuadrilla[];
  tecnicos_activos: number;
  flota_disponible: number;
  herramientas_disponibles: number;
  sectores_activos: number;
}

/** Identificador de pago con más reportes (D-94). */
export interface IdentificadorTop {
  numero: string;
  casos: number;
  reportes_ventana: number;
  reincidente: boolean;
}

/** D-94: métricas por identificador de pago (RF-54/RF-55). */
export interface MonitoreoIdentificadores {
  ventana_dias: number;
  con_casos: number;
  casos_con_identificador: number;
  casos_sin_identificador: number;
  media_casos: number;
  max_casos: number;
  reincidentes: number;
  top: IdentificadorTop[];
}

/** D-90/D-94: regla REPARACIÓN ⇐ 70* + avería real. */
export interface MonitoreoReclasificaciones {
  reparaciones_validas: number;
  referidos: number;
  reclasificadas: number;
  pendientes_historicos: number;
  pendientes_historicos_en_terminal: number;
  referidos_sin_ficha: number;
  referidos_por_clasificacion: Record<string, number>;
}

/** Periodo del reporte de trabajo (`GET /reportes/trabajo`). */
export type PeriodoReporte = 'diario' | 'semanal' | 'mensual';

/** Reporte consolidado: replica las respuestas de los endpoints de monitoreo. */
export interface ReporteTrabajo {
  periodo: string;
  desde: string;
  hasta: string;
  diario: MonitoreoDiario;
  semanal: MonitoreoSemanal;
  globales: MonitoreoGlobales;
  reparacion: MonitoreoReparacion;
  construccion: MonitoreoConstruccion;
  cuadrilla: MonitoreoCuadrillaOut;
  capacidad: MonitoreoCapacidad;
  reclasificaciones: MonitoreoReclasificaciones;
  identificadores: MonitoreoIdentificadores;
}

/* ------------------------------------------------------------------ */
/* ALERTAS, TELEGRAM Y MCP (Ciclo 9)                                   */
/* ------------------------------------------------------------------ */

export type EstadoFallaMasiva = 'DETECTADA' | 'PLANIFICADA' | 'ATENDIDA' | 'CERRADA';

export type EstadoNotificacion = 'PENDIENTE' | 'ENVIADO' | 'FALLIDO';

/** Reporte manual de falla (`POST /fallas-masivas` · D-118). */
export interface FallaMasivaManual {
  descripcion: string;
  olt: string;
  slot: string;
  puerto: string;
  fat: string;
  direccion: string;
  id_sector?: number | null;
  id_cuadrilla?: number | null;
  origen?: OrigenFallaMasiva;
  odn?: string | null;
  evidencias?: string[];
  /** Casos del mismo FAT que se asocian en el alta (mínimo 1). */
  ids_caso: number[];
}

/** Caso candidato del mismo FAT para el alta/asociación (D-118). */
export interface CasoCandidatoOut {
  id_caso: number;
  id_averia: string;
  estado_actual: string;
  nombre_cliente: string | null;
  direccion: string | null;
  olt: string | null;
  slot: string | null;
  puerto: string | null;
  fat: string | null;
  id_sector: number | null;
  sector_nombre: string | null;
  id_cuadrilla?: number | null;
  cuadrilla_codigo?: string | null;
  cuadrilla_nombre?: string | null;
}

/** Reporte de campo (`POST /fallas-masivas/reporte-campo` · D-118). */
export interface FallaMasivaCampo {
  descripcion: string;
  olt: string;
  slot: string;
  puerto: string;
  fat: string;
  direccion: string;
  odn: string;
  id_sector?: number | null;
  id_cuadrilla?: number | null;
  evidencias?: string[];
}

/* ------------------------------------------------------------------ */
/* D-99 · MÓDULO MASIVAS                                              */
/* ------------------------------------------------------------------ */

/** Personal del CRASS que valida la reparación de una masiva (RF-61). */
export interface ValidadorCrassOut {
  id_solicitante: number;
  nombre: string;
  unidad: string;
  contacto: string | null;
}

/** Caso vinculado a una masiva (CASOS ASOCIADOS de la ficha · RF-59). */
export interface CasoAsociadoOut {
  id_caso: number;
  id_averia: string;
  estado_actual: string;
  nombre_cliente: string | null;
  telefono: string | null;
  direccion: string | null;
  id_sector: number | null;
  sector_nombre: string | null;
  olt: string | null;
  slot: string | null;
  puerto: string | null;
  fat: string | null;
  /** Columna EXTRA del archivo de ingesta: donde viaja la RUTA. */
  extra: string | null;
  ruta: string | null;
  id_cuadrilla: number | null;
  cuadrilla_codigo: string | null;
  cuadrilla_nombre: string | null;
  origen_asociacion: 'AUTO' | 'MANUAL';
}

/** Cierre de la masiva (RF-61/RF-62): descripción, validador y evidencias. */
export interface CierreMasivaRequest {
  descripcion: string;
  id_validador_crass: number;
  evidencias?: string[];
  modo?: 'IVR' | 'COS' | 'SACAS';
  descripcion_caso?: string;
  id_causa?: number | null;
  latitud?: number | null;
  longitud?: number | null;
}

export interface CierreMasivaOut {
  id_falla: number;
  estado: string;
  casos_cerrados: number;
  casos_omitidos: number;
  detalle: { id_caso: number; id_averia?: string; resultado: string; motivo?: string }[];
}

/** Ubicación del FAT afectado para el mapa de MASIVAS (RF-60). */
export interface UbicacionMasivaOut {
  id_falla: number;
  latitud: number | null;
  longitud: number | null;
  direccion: string | null;
  ruta: string | null;
  olt: string | null;
  fat: string | null;
  sector_nombre: string | null;
  origen: string;
  puntos: {
    tipo: string;
    serial?: string;
    latitud: number | null;
    longitud: number | null;
    fecha_hora?: string | null;
  }[];
}

/**
 * Filtros del histórico de masivas de la sección MASIVAS.
 *
 * Es un alias de tipo (no una `interface`) para que `construirQuery` lo acepte:
 * TypeScript solo da índice implícito a los alias de tipo de objeto.
 */
export type MasivasFiltros = {
  estado?: EstadoFallaMasiva | '';
  id_central?: number;
  solo_activas?: boolean;
  origen?: OrigenFallaMasiva | '';
  q?: string;
  desde?: string;
  hasta?: string;
  limite?: number;
};

/** Personal externo: solicitantes de referidos y personal del CRASS (RF-63). */
export type TipoPersonalExterno = 'SOLICITANTE' | 'CRASS' | 'OTRO';

export interface PersonalExterno {
  id_solicitante: number;
  nombre: string;
  unidad: string;
  contacto: string;
  canal?: string | null;
  documento?: string | null;
  tipo: TipoPersonalExterno;
  activo: boolean;
  id_central?: number | null;
}

export interface PersonalExternoCreate {
  nombre: string;
  unidad: string;
  contacto: string;
  documento?: string | null;
  tipo?: TipoPersonalExterno;
  activo?: boolean;
  id_central?: number | null;
}

export type PersonalExternoUpdate = Partial<PersonalExternoCreate>;


/** Cambio de estado o cuadrilla de una falla (RF-09/RF-17). */
export interface FallaMasivaUpdate {
  estado?: EstadoFallaMasiva;
  id_cuadrilla?: number | null;
  id_sector?: number | null;
  descripcion?: string | null;
}

/** Planificación de la atención (RF-17): plan, reporte simple y evidencias. */
export interface PlanificacionFalla {
  planificacion: string;
  reporte_simple?: string | null;
  evidencias?: string[];
  id_cuadrilla?: number | null;
}

/** Solicitud de material de la falla (RF-18). */
export interface MaterialFalla {
  descripcion: string;
  id_cuadrilla?: number | null;
}

export interface OrdenMaterialOut {
  id_orden: number;
  estado: string;
  observacion: string | null;
  id_falla: number | null;
  id_cuadrilla: number | null;
  solicitante_usuario: string | null;
  fecha: string | null;
}

/** Resultado de procesar el outbox de notificaciones (RNF-20). */
export interface ProcesarOutboxOut {
  intentadas: number;
  enviadas: number;
  diferidas: number;
  fallidas: number;
  detalle: Record<string, unknown>[];
}

/** Métricas de negocio y estado de los canales (RNF-19). */
export interface MetricasOut {
  casos_total: number;
  casos_por_estado: Record<string, number>;
  casos_por_categoria: Record<string, number>;
  lotes_ingesta: number;
  casos_ingeridos: number;
  fallas_activas: number;
  notificaciones_pendientes: number;
  notificaciones_enviadas: number;
  notificaciones_fallidas: number;
  canales_configurados: Record<string, boolean>;
}

/* ------------------ SISTEMAS: inspección de la BD (D-69) ----------- */

export interface TablaEstructura {
  tabla: string;
  comentario: string | null;
  columnas: number;
  renglones: number;
  bytes: number;
  kilobytes: number;
  claves_primarias: number;
  claves_foraneas: number;
  unicas: number;
  indices: number;
  disparadores: number;
}

export interface EstructuraBD {
  servidor: string;
  base: string;
  esquema: string;
  usuario: string;
  total_tablas: number;
  total_renglones: number;
  total_bytes: number;
  extensiones: { nombre: string; version: string }[];
  tablas: TablaEstructura[];
}

export interface ColumnaTabla {
  nombre: string;
  tipo: string;
  nulo: boolean;
  por_defecto: string | null;
  comentario: string | null;
  es_clave: boolean;
  sensible: boolean;
}

export interface FichaTabla {
  tabla: string;
  esquema: string;
  comentario: string | null;
  renglones: number;
  columnas: ColumnaTabla[];
  claves_primarias: string[];
  unicas: { nombre: string; columnas: string }[];
  claves_foraneas: { nombre: string; columnas: string; hacia: string; on_delete: string }[];
  referencias_recibidas: { tabla: string; constraint: string }[];
  indices: { nombre: string; definicion: string }[];
  total_columnas: number;
  columnas_ofuscadas: string[];
}

export interface ContenidoTabla {
  tabla: string;
  esquema: string;
  columnas: string[];
  filas: Record<string, unknown>[];
  total: number;
  pagina: number;
  tamano: number;
  paginas: number;
  ofuscadas: string[];
}

/* ---------------- Resolución del caso (D-70) -------------------- */

export type ModoCierre = 'IVR' | 'COS' | 'SACAS';

export interface CierreCaso {
  modo: ModoCierre;
  descripcion: string;
  evidencias: string[];
  id_causa?: number | null;
}

export interface CitaRapida {
  fecha_hora: string;
  tipo: 'CONTACTO' | 'ATENCION';
  observacion?: string | null;
}

export interface EnrutadoCaso {
  destino: string;
  motivo?: string | null;
  id_metodo?: number | null;
}

export interface ResolucionOut {
  accion: string;
  id_actividad: number | null;
  id_cita: number | null;
  id_seguimiento: number | null;
  estado_actual: string;
  mensaje: string;
}

export interface CasoRelacionado {
  id_caso: number;
  id_averia: string;
  fecha_reporte: string | null;
  fecha_cierre: string | null;
  estado_actual: string;
  categoria: string | null;
  problema_reporte: string | null;
  justificacion_cierre: string | null;
  direccion: string | null;
  nombre_cliente: string | null;
}

/* ------------------------------------------------------------------ */
/* Sincronización — log de la APK (D-81 · RF-39 / RF-40)               */
/* ------------------------------------------------------------------ */

export interface SincronizacionItem {
  id_sync_log: number;
  p00: string;
  id_cuadrilla: number | null;
  tipo: string;
  dispositivo_id: string | null;
  version_app: string | null;
  plataforma: string;
  iniciado_en: string;
  finalizado_en: string | null;
  duracion_ms: number | null;
  recibidos: number;
  procesados: number;
  errores: number;
  estado: string;
  detalle: Record<string, unknown> | null;
}

export interface ChecklistPaso {
  paso: string;
  estado: string;
  fecha_hora: string | null;
  detalle: Record<string, unknown> | null;
}

export interface SincronizacionDetalle extends SincronizacionItem {
  checklist: ChecklistPaso[];
}

export interface PaginaSincronizaciones {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: SincronizacionItem[];
}

export interface ResumenSincronizaciones {
  fecha: string;
  total: number;
  ok: number;
  parcial: number;
  error: number;
  en_proceso: number;
  por_estado: Record<string, number>;
  por_cuadrilla: Record<string, number>;
}

export interface ChecklistDispositivo {
  dispositivo_id: string | null;
  p00: string;
  id_sync_log: number;
  iniciado_en: string | null;
  checklist: ChecklistPaso[];
}

export type SincronizacionesFiltros = {
  p00?: string;
  id_cuadrilla?: number;
  dispositivo_id?: string;
  tipo?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  orden?: string;
  page?: number;
  page_size?: number;
};

/* ------------------------------------------------------------------ */
/* Mensajería interna (D-81 · RF-41)                                   */
/* ------------------------------------------------------------------ */

export interface Mensaje {
  id_mensaje: number;
  id_central: number;
  origen_p00: string | null;
  destino_tipo: string;
  id_cuadrilla: number | null;
  id_tecnico: number | null;
  tipo: string;
  cuerpo: string;
  id_caso: number | null;
  creado_en: string;
  expira_en: string;
}

export interface MensajeRecibido extends Mensaje {
  leido: boolean;
}

export interface BandejaMensajes {
  total: number;
  items: Mensaje[];
}

export interface MensajeCreate {
  destino_tipo: 'TODOS' | 'CUADRILLA' | 'TECNICO';
  id_cuadrilla?: number | null;
  id_tecnico?: number | null;
  cuerpo: string;
  id_caso?: number | null;
}

export interface SupervisorMensaje {
  p00: string;
  nombre: string | null;
  apellido: string | null;
}

/* ------------------------------------------------------------------ */
/* Panel de gestión diaria (D-81 · RF-43)                              */
/* ------------------------------------------------------------------ */

export interface CuadrillaGestion {
  id_cuadrilla: number;
  codigo: string;
  nombre: string;
  es_supervisor: boolean;
  asignadas: number;
  cerradas: number;
  porcentaje: number;
}

export interface GestionDiaria {
  fecha: string;
  modo: 'COMUN' | 'REFERIDOS';
  cuadrillas: CuadrillaGestion[];
  totales: { asignadas: number; cerradas: number; porcentaje: number };
}
