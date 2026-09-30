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

export interface CasoManualCreate {
  id_central?: number | null;
  id_averia?: string | null;
  categoria?: CategoriaCaso;
  tipo_caso?: TipoCaso;
  nombre_cliente?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  informacion?: string | null;
  problema_reporte?: string | null;
  persona_reporta?: string | null;
  contacto_cliente?: string | null;
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

/** Parámetros del listado paginado de casos (RF-33). */
export type CasosFiltros = {
  q?: string;
  id_averia?: string;
  telefono?: string;
  id_central?: number;
  id_sector?: number;
  id_causa?: number;
  id_lote_ingesta?: number;
  estado_actual?: string;
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
}

/* ------------------ Proceso de despacho (D-66) --------------------- */

export interface SectorProcesoOut {
  id_sector: number;
  nombre: string | null;
  total: number;
  especiales: number;
  citados: number;
  id_cuadrilla: number | null;
}

export interface CuadrillaProcesoOut {
  id_cuadrilla: number;
  codigo: string;
  nombre: string;
  ids_sector: number[];
  total: number;
}

export interface UniversoOut {
  total: number;
  comunes: number;
  especiales: number;
  sin_sector: number;
  casos: CasoAsignadoOut[];
}

export interface AsignacionBloque {
  id_cuadrilla: number;
  ids_sector: number[];
}

export interface ProcesoDespachoOut {
  fecha: string;
  id_central: number;
  asignacion_origen: string;
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
  casos: CasoAsignadoOut[];
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
  por_cuadrilla: Record<string, unknown>[];
  totales: Record<string, number>;
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
  id_averia?: string | null;
  nombre_cliente?: string | null;
  telefono?: string | null;
  direccion?: string | null;
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
  solicitante_nombre: string | null;
  solicitante_unidad: string | null;
  pendiente: boolean;
  asignado: boolean;
  citado: boolean;
  gestion: boolean;
}

/** Filtros del listado de casos especiales (RF-06/RF-35). */
export type CasosEspecialesFiltros = {
  clasificacion?: string;
  estado?: string;
  prioridad?: string;
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
}

/* ------------------------------------------------------------------ */
/* ALERTAS, TELEGRAM Y MCP (Ciclo 9)                                   */
/* ------------------------------------------------------------------ */

export type EstadoFallaMasiva = 'DETECTADA' | 'PLANIFICADA' | 'ATENDIDA' | 'CERRADA';

export type EstadoNotificacion = 'PENDIENTE' | 'ENVIADO' | 'FALLIDO';

/** Reporte manual de falla (`POST /fallas-masivas`). */
export interface FallaMasivaManual {
  descripcion: string;
  id_sector?: number | null;
  id_cuadrilla?: number | null;
  origen?: OrigenFallaMasiva;
}

/** Cambio de estado o cuadrilla de una falla (RF-09/RF-17). */
export interface FallaMasivaUpdate {
  estado?: EstadoFallaMasiva;
  id_cuadrilla?: number | null;
  id_sector?: number | null;
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
  observacion: string;
  id_falla: number;
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
