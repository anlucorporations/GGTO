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
}

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
  id_lote: number | null;
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
  id_causa: number | null;
  id_lote_ingesta: number | null;
  en_gestion_supervisor: boolean;
  es_falla_masiva: boolean;

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
