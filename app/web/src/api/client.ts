/**
 * Cliente HTTP de la API GGTO.
 *
 * - Misma origen: todas las llamadas van a `/api/v1` (Vite lo reenvía en dev).
 * - El token se guarda en `localStorage` y se adjunta como `Bearer`.
 * - Cualquier respuesta no-2xx se convierte en `ApiError` con el `detail`
 *   devuelto por FastAPI (401, 403, 409, 423, 429, …).
 */

import type {
  AsignacionBloque,
  CanalDespacho,
  CasoAgregar,
  CasoEspecialCreate,
  CasoEspecialOut,
  CasoEspecialUpdate,
  CasoEstadoHistOut,
  CasoEstadoUpdate,
  CasoManualCreate,
  CasoOut,
  CasosEspecialesFiltros,
  CasosFiltros,
  CasoUpdate,
  CitaCreate,
  CitaOut,
  CitasFiltros,
  CitaUpdate,
  Causa,
  CausaCreate,
  Central,
  CentralCreate,
  CentralUpdate,
  Cuadrilla,
  CuadrillaCreate,
  CuadrillaIntegrante,
  CuadrillaIntegranteCreate,
  CuadrillaUpdate,
  DespachoDetalleOut,
  DespachoUpdate,
  DominioMetodo,
  EnvioOut,
  FallaMasivaCreate,
  FallaMasivaManual,
  FallaMasivaOut,
  FallaMasivaUpdate,
  MaterialFalla,
  MetricasOut,
  NotificacionOut,
  OrdenMaterialOut,
  PlanificacionFalla,
  PrimerAccesoOut,
  ProcesarOutboxOut,
  ProcesoDespachoOut,
  PropuestaOut,
  RegenerarPalabrasResponse,
  ReporteProduccionOut,
  Flota,
  FlotaCreate,
  FlotaUpdate,
  IngestaLoteOut,
  Metodo,
  MetodoCreate,
  MonitoreoCapacidad,
  MonitoreoConstruccion,
  MonitoreoCuadrillaOut,
  MonitoreoDiario,
  MonitoreoGlobales,
  MonitoreoReparacion,
  MonitoreoSemanal,
  PaginaCasos,
  PalabraPosicion,
  Parametro,
  ParametroUpdate,
  PeriodoReporte,
  Resumen,
  ResumenIngesta,
  ReporteTrabajo,
  Sector,
  SectorCreate,
  SectorDireccion,
  SectorDireccionCreate,
  SectorizacionPendientesOut,
  SectorUpdate,
  SetupResponse,
  SeguimientoCreate,
  SeguimientoFiltros,
  SeguimientoOut,
  SeguimientoUpdate,
  Solicitante,
  SolicitanteCreate,
  Tecnico,
  TecnicoCreate,
  TecnicoUpdate,
  TokenResponse,
  UnlockResponse,
  Usuario,
} from './types';

export const API_BASE = '/api/v1';

const TOKEN_KEY = 'ggto_token';
const USER_KEY = 'ggto_usuario';

/* ------------------------------------------------------------------ */
/* Errores                                                             */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function extraerDetail(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const partes = detail
        .map((item) => {
          if (item && typeof item === 'object') {
            const msg = (item as { msg?: unknown }).msg;
            const loc = (item as { loc?: unknown }).loc;
            const campo = Array.isArray(loc) ? loc[loc.length - 1] : undefined;
            if (typeof msg === 'string') {
              return campo !== undefined ? `${String(campo)}: ${msg}` : msg;
            }
          }
          return typeof item === 'string' ? item : JSON.stringify(item);
        })
        .filter(Boolean);
      if (partes.length) return partes.join('; ');
    }
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Sesión                                                              */
/* ------------------------------------------------------------------ */

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUsuarioGuardado(): Usuario | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Usuario;
  } catch {
    return null;
  }
}

export function guardarSesion(token: string, usuario: Usuario): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(usuario));
}

export function limpiarSesion(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/* ------------------------------------------------------------------ */
/* Núcleo HTTP                                                         */
/* ------------------------------------------------------------------ */

function construirQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue;
    search.set(clave, String(valor));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  // `FormData` fija su propio `Content-Type` (con boundary); no lo pisamos.
  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, 'No se pudo contactar con el servidor. Verifique su conexión.');
  }

  if (!respuesta.ok) {
    let payload: unknown = null;
    try {
      payload = await respuesta.json();
    } catch {
      payload = null;
    }
    throw new ApiError(
      respuesta.status,
      extraerDetail(payload, `Error ${respuesta.status} del servidor`),
    );
  }

  if (respuesta.status === 204) return undefined as T;
  const texto = await respuesta.text();
  if (!texto) return undefined as T;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return undefined as T;
  }
}

function conCuerpo<T>(path: string, method: string, data: unknown): Promise<T> {
  return request<T>(path, { method, body: JSON.stringify(data) });
}

/**
 * Como `request`, pero devuelve el cuerpo sin parsear (p. ej. el HTML del
 * despacho imprimible, RT-08).
 */
async function requestTexto(path: string): Promise<string> {
  const headers = new Headers();
  headers.set('Accept', 'text/html, application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_BASE}${path}`, { headers });
  } catch {
    throw new ApiError(0, 'No se pudo contactar con el servidor. Verifique su conexión.');
  }
  if (!respuesta.ok) {
    let payload: unknown = null;
    try {
      payload = await respuesta.json();
    } catch {
      payload = null;
    }
    throw new ApiError(
      respuesta.status,
      extraerDetail(payload, `Error ${respuesta.status} del servidor`),
    );
  }
  return respuesta.text();
}

/* ------------------------------------------------------------------ */
/* Autenticación                                                       */
/* ------------------------------------------------------------------ */

export function login(p00: string, clave: string): Promise<TokenResponse> {
  return conCuerpo<TokenResponse>('/auth/login', 'POST', { p00, clave });
}

export function obtenerMe(): Promise<Usuario> {
  return request<Usuario>('/auth/me');
}

export function desbloquear(p00: string, palabras: PalabraPosicion[]): Promise<UnlockResponse> {
  return conCuerpo<UnlockResponse>('/auth/unlock', 'POST', { p00, palabras });
}

/** Comprueba si un P00 está registrado y si ya activó su cuenta (D-67). */
export function primerAcceso(p00: string): Promise<PrimerAccesoOut> {
  return request<PrimerAccesoOut>(`/auth/primer-acceso${construirQuery({ p00 })}`);
}

/** Primer acceso: fija la clave y devuelve las 12 palabras (una sola vez). */
export function completarSetup(datos: {
  p00: string;
  correo: string;
  clave: string;
  confirmacion: string;
}): Promise<SetupResponse> {
  return conCuerpo<SetupResponse>('/auth/setup', 'POST', datos);
}

/** Super Usuario: regenera las 12 palabras de seguridad de un P00 (D-67). */
export function regenerarPalabras(p00: string): Promise<RegenerarPalabrasResponse> {
  return conCuerpo<RegenerarPalabrasResponse>(
    `/auth/palabras/${encodeURIComponent(p00)}/regenerar`,
    'POST',
    {},
  );
}

/* ------------------------------------------------------------------ */
/* CENTRAL                                                             */
/* ------------------------------------------------------------------ */

export function listarCentral(soloActivas = false): Promise<Central[]> {
  return request<Central[]>(`/central${construirQuery({ solo_activas: soloActivas })}`);
}

export function crearCentral(data: CentralCreate): Promise<Central> {
  return conCuerpo<Central>('/central', 'POST', data);
}

export function obtenerCentral(id: number): Promise<Central> {
  return request<Central>(`/central/${id}`);
}

export function actualizarCentral(id: number, data: CentralUpdate): Promise<Central> {
  return conCuerpo<Central>(`/central/${id}`, 'PATCH', data);
}

export function desactivarCentral(id: number): Promise<void> {
  return request<void>(`/central/${id}`, { method: 'DELETE' });
}

/* ------------------------------------------------------------------ */
/* SECTORES                                                            */
/* ------------------------------------------------------------------ */

export function listarSectores(
  params: { id_central?: number; solo_activos?: boolean } = {},
): Promise<Sector[]> {
  return request<Sector[]>(`/sectores${construirQuery(params)}`);
}

export function crearSector(data: SectorCreate): Promise<Sector> {
  return conCuerpo<Sector>('/sectores', 'POST', data);
}

export function obtenerSector(id: number): Promise<Sector> {
  return request<Sector>(`/sectores/${id}`);
}

export function actualizarSector(id: number, data: SectorUpdate): Promise<Sector> {
  return conCuerpo<Sector>(`/sectores/${id}`, 'PATCH', data);
}

export function desactivarSector(id: number): Promise<void> {
  return request<void>(`/sectores/${id}`, { method: 'DELETE' });
}

export function agregarDireccionSector(
  idSector: number,
  data: SectorDireccionCreate,
): Promise<SectorDireccion> {
  return conCuerpo<SectorDireccion>(`/sectores/${idSector}/direcciones`, 'POST', data);
}

export function eliminarDireccionSector(idSector: number, idDireccion: number): Promise<void> {
  return request<void>(`/sectores/${idSector}/direcciones/${idDireccion}`, { method: 'DELETE' });
}

/* ------------------------------------------------------------------ */
/* TÉCNICOS                                                            */
/* ------------------------------------------------------------------ */

export function listarTecnicos(
  params: { id_central?: number; status?: string } = {},
): Promise<Tecnico[]> {
  return request<Tecnico[]>(`/tecnicos${construirQuery(params)}`);
}

export function crearTecnico(data: TecnicoCreate): Promise<Tecnico> {
  return conCuerpo<Tecnico>('/tecnicos', 'POST', data);
}

export function obtenerTecnico(id: number): Promise<Tecnico> {
  return request<Tecnico>(`/tecnicos/${id}`);
}

export function actualizarTecnico(id: number, data: TecnicoUpdate): Promise<Tecnico> {
  return conCuerpo<Tecnico>(`/tecnicos/${id}`, 'PATCH', data);
}

export function desactivarTecnico(id: number): Promise<void> {
  return request<void>(`/tecnicos/${id}`, { method: 'DELETE' });
}

/* ------------------------------------------------------------------ */
/* FLOTA                                                               */
/* ------------------------------------------------------------------ */

export function listarFlota(params: { id_central?: number } = {}): Promise<Flota[]> {
  return request<Flota[]>(`/flota${construirQuery(params)}`);
}

export function crearFlota(data: FlotaCreate): Promise<Flota> {
  return conCuerpo<Flota>('/flota', 'POST', data);
}

export function obtenerFlota(id: number): Promise<Flota> {
  return request<Flota>(`/flota/${id}`);
}

export function actualizarFlota(id: number, data: FlotaUpdate): Promise<Flota> {
  return conCuerpo<Flota>(`/flota/${id}`, 'PATCH', data);
}

export function retirarFlota(id: number): Promise<void> {
  return request<void>(`/flota/${id}`, { method: 'DELETE' });
}

/* ------------------------------------------------------------------ */
/* CUADRILLAS                                                          */
/* ------------------------------------------------------------------ */

export function listarCuadrillas(
  params: { id_central?: number; solo_activas?: boolean } = {},
): Promise<Cuadrilla[]> {
  return request<Cuadrilla[]>(`/cuadrillas${construirQuery(params)}`);
}

export function crearCuadrilla(data: CuadrillaCreate): Promise<Cuadrilla> {
  return conCuerpo<Cuadrilla>('/cuadrillas', 'POST', data);
}

export function obtenerCuadrilla(id: number): Promise<Cuadrilla> {
  return request<Cuadrilla>(`/cuadrillas/${id}`);
}

export function actualizarCuadrilla(id: number, data: CuadrillaUpdate): Promise<Cuadrilla> {
  return conCuerpo<Cuadrilla>(`/cuadrillas/${id}`, 'PATCH', data);
}

export function agregarIntegrante(
  idCuadrilla: number,
  data: CuadrillaIntegranteCreate,
): Promise<CuadrillaIntegrante> {
  return conCuerpo<CuadrillaIntegrante>(`/cuadrillas/${idCuadrilla}/integrantes`, 'POST', data);
}

export function retirarIntegrante(idCuadrilla: number, idTecnico: number): Promise<void> {
  return request<void>(`/cuadrillas/${idCuadrilla}/integrantes/${idTecnico}`, {
    method: 'DELETE',
  });
}

/* ------------------------------------------------------------------ */
/* CATÁLOGOS                                                           */
/* ------------------------------------------------------------------ */

export function listarCausas(soloActivos = true): Promise<Causa[]> {
  return request<Causa[]>(`/catalogos/causas${construirQuery({ solo_activos: soloActivos })}`);
}

export function crearCausa(data: CausaCreate): Promise<Causa> {
  return conCuerpo<Causa>('/catalogos/causas', 'POST', data);
}

export function desactivarCausa(id: number): Promise<void> {
  return request<void>(`/catalogos/causas/${id}`, { method: 'DELETE' });
}

export function listarMetodos(dominio?: DominioMetodo): Promise<Metodo[]> {
  return request<Metodo[]>(`/catalogos/metodos${construirQuery({ dominio })}`);
}

export function crearMetodo(data: MetodoCreate): Promise<Metodo> {
  return conCuerpo<Metodo>('/catalogos/metodos', 'POST', data);
}

/* ------------------------------------------------------------------ */
/* PARÁMETROS                                                          */
/* ------------------------------------------------------------------ */

export function listarConfiguracion(): Promise<Parametro[]> {
  return request<Parametro[]>('/configuracion');
}

export function actualizarConfiguracion(
  clave: string,
  data: ParametroUpdate,
): Promise<Parametro> {
  return conCuerpo<Parametro>(`/configuracion/${encodeURIComponent(clave)}`, 'PUT', data);
}

/* ------------------------------------------------------------------ */
/* INGESTA                                                             */
/* ------------------------------------------------------------------ */

function subirCsv(
  path: string,
  archivo: File,
  idCentral: number | null,
): Promise<ResumenIngesta> {
  const datos = new FormData();
  datos.append('archivo', archivo);
  if (idCentral !== null) datos.append('id_central', String(idCentral));
  return request<ResumenIngesta>(path, { method: 'POST', body: datos });
}

/** Simula la carga del CSV diario sin guardar nada. */
export function previewIngesta(archivo: File, idCentral: number | null = null): Promise<ResumenIngesta> {
  return subirCsv('/ingesta/preview', archivo, idCentral);
}

/** Carga real del CSV diario: inserta los casos nuevos y registra el lote. */
export function cargarIngesta(archivo: File, idCentral: number | null = null): Promise<ResumenIngesta> {
  return subirCsv('/ingesta', archivo, idCentral);
}

/** Historial de cargas, más recientes primero. */
export function listarLotes(limite = 50): Promise<IngestaLoteOut[]> {
  return request<IngestaLoteOut[]>(`/ingesta/lotes${construirQuery({ limite })}`);
}

export function obtenerLote(idLote: number): Promise<IngestaLoteOut> {
  return request<IngestaLoteOut>(`/ingesta/lotes/${idLote}`);
}

/** Re-sectoriza los casos sin sector tras agregar direcciones nuevas (D-66). */
export function sectorizarPendientes(idCentral: number | null = null): Promise<SectorizacionPendientesOut> {
  return request<SectorizacionPendientesOut>(
    `/ingesta/sectorizar-pendientes${construirQuery({ id_central: idCentral })}`,
    { method: 'POST' },
  );
}

/* ------------------------------------------------------------------ */
/* CASOS (Ciclo 4)                                                     */
/* ------------------------------------------------------------------ */

/** Listado paginado con filtros (RF-33). */
export function listarCasos(filtros: CasosFiltros = {}): Promise<PaginaCasos> {
  return request<PaginaCasos>(`/casos${construirQuery(filtros)}`);
}

/**
 * Búsqueda directa (RF-30). `q` busca por id de avería, teléfono, cliente o
 * dirección; también se aceptan los filtros exactos `id_averia`/`telefono`.
 */
export function buscarCasos(params: {
  q?: string;
  id_averia?: string;
  telefono?: string;
  limite?: number;
}): Promise<CasoOut[]> {
  return request<CasoOut[]>(`/casos/buscar${construirQuery(params)}`);
}

/** Ficha completa de un caso (RF-31). */
export function obtenerCaso(idCaso: number): Promise<CasoOut> {
  return request<CasoOut>(`/casos/${idCaso}`);
}

/** Alta manual (RF-32). Si no se envía `id_averia` el backend genera `REF-…`. */
export function crearCaso(data: CasoManualCreate): Promise<CasoOut> {
  return conCuerpo<CasoOut>('/casos', 'POST', data);
}

/** Edición parcial (RF-31); el cambio de estado registra bitácora. */
export function actualizarCaso(idCaso: number, data: CasoUpdate): Promise<CasoOut> {
  return conCuerpo<CasoOut>(`/casos/${idCaso}`, 'PATCH', data);
}

/** Bitácora de cambios de estado, más reciente primero (RNF-12). */
export function obtenerHistorialCaso(idCaso: number): Promise<CasoEstadoHistOut[]> {
  return request<CasoEstadoHistOut[]>(`/casos/${idCaso}/historial`);
}

/* ------------------------------------------------------------------ */
/* DESPACHO (Ciclo 5)                                                  */
/* ------------------------------------------------------------------ */

/** Simula el despacho del día sin guardar nada (RF-24). */
export function simularPropuesta(
  fecha: string,
  idCentral?: number,
): Promise<PropuestaOut> {
  return request<PropuestaOut>(
    `/despachos/propuesta${construirQuery({ fecha, id_central: idCentral })}`,
    { method: 'POST' },
  );
}

/** Genera y guarda el despacho del día; `409` si ya existe (salvo `reemplazar`). */
export function generarDespacho(
  fecha: string,
  reemplazar = false,
  idCentral?: number,
): Promise<DespachoDetalleOut[]> {
  return request<DespachoDetalleOut[]>(
    `/despachos${construirQuery({ fecha, reemplazar, id_central: idCentral })}`,
    { method: 'POST' },
  );
}

/** Despachos de una fecha (RF-24). */
export function listarDespachos(
  params: { fecha?: string; id_central?: number } = {},
): Promise<DespachoDetalleOut[]> {
  return request<DespachoDetalleOut[]>(`/despachos${construirQuery(params)}`);
}

export function obtenerDespacho(idDespacho: number): Promise<DespachoDetalleOut> {
  return request<DespachoDetalleOut>(`/despachos/${idDespacho}`);
}

/* ------------------------------------------------------------------ */
/* Proceso de despacho con asignación de sectores (D-66)               */
/* ------------------------------------------------------------------ */

/** Universo de casos, sectores y asignación por cuadrilla del día. */
export function obtenerProcesoDespacho(
  params: { fecha?: string; id_central?: number } = {},
): Promise<ProcesoDespachoOut> {
  return request<ProcesoDespachoOut>(`/despachos/proceso${construirQuery(params)}`);
}

/** Guarda la asignación de sectores por cuadrilla del día. */
export function guardarAsignacionDespacho(datos: {
  fecha: string;
  id_central?: number;
  asignaciones: AsignacionBloque[];
}): Promise<ProcesoDespachoOut> {
  return conCuerpo<ProcesoDespachoOut>('/despachos/asignacion', 'PUT', datos);
}

/** Procesa el despacho del día con la asignación indicada. */
export function procesarDespacho(datos: {
  fecha: string;
  id_central?: number;
  asignaciones: AsignacionBloque[];
  reemplazar?: boolean;
}): Promise<DespachoDetalleOut[]> {
  return conCuerpo<DespachoDetalleOut[]>('/despachos/procesar', 'POST', datos);
}

/** Publica, cierra o marca el canal del despacho (RF-25). */
export function actualizarDespacho(
  idDespacho: number,
  data: DespachoUpdate,
): Promise<DespachoDetalleOut> {
  return conCuerpo<DespachoDetalleOut>(`/despachos/${idDespacho}`, 'PATCH', data);
}

export function agregarCasoDespacho(
  idDespacho: number,
  data: CasoAgregar,
): Promise<DespachoDetalleOut> {
  return conCuerpo<DespachoDetalleOut>(`/despachos/${idDespacho}/casos`, 'POST', data);
}

export function quitarCasoDespacho(
  idDespacho: number,
  idCaso: number,
): Promise<DespachoDetalleOut> {
  return request<DespachoDetalleOut>(`/despachos/${idDespacho}/casos/${idCaso}`, {
    method: 'DELETE',
  });
}

export function actualizarCasoDespacho(
  idDespacho: number,
  idCaso: number,
  data: CasoEstadoUpdate,
): Promise<DespachoDetalleOut> {
  return conCuerpo<DespachoDetalleOut>(
    `/despachos/${idDespacho}/casos/${idCaso}`,
    'PATCH',
    data,
  );
}

/**
 * Devuelve el HTML de la ficha imprimible (RT-08). Se pide con `Bearer` y se
 * abre en una pestaña nueva; la URL directa no puede llevar la cabecera.
 */
export function obtenerImprimible(idDespacho: number): Promise<string> {
  return requestTexto(`/despachos/${idDespacho}/imprimible`);
}

/** Reporte de producción global del día (RF-27). */
export function reporteProduccion(
  fecha: string,
  idCentral?: number,
): Promise<ReporteProduccionOut> {
  return request<ReporteProduccionOut>(
    `/despachos/reporte/produccion${construirQuery({ fecha, id_central: idCentral })}`,
  );
}

/** Reporte de producción del despacho seleccionado (RF-27). */
export function reporteDespacho(idDespacho: number): Promise<ReporteProduccionOut> {
  return request<ReporteProduccionOut>(`/despachos/${idDespacho}/reporte`);
}

/** Envía la ficha por Telegram o correo (RF-10). */
export function enviarDespacho(
  idDespacho: number,
  canal: CanalDespacho,
  destinatario?: string,
): Promise<EnvioOut> {
  return request<EnvioOut>(
    `/despachos/${idDespacho}/enviar${construirQuery({ canal, destinatario })}`,
    { method: 'POST' },
  );
}

export function listarNotificaciones(idDespacho: number): Promise<NotificacionOut[]> {
  return request<NotificacionOut[]>(`/despachos/${idDespacho}/notificaciones`);
}

export function crearFallaMasiva(
  data: FallaMasivaCreate,
  idCentral?: number,
): Promise<FallaMasivaOut> {
  return conCuerpo<FallaMasivaOut>(
    `/despachos/fallas-masivas${construirQuery({ id_central: idCentral })}`,
    'POST',
    data,
  );
}

export function listarFallasMasivas(): Promise<FallaMasivaOut[]> {
  return request<FallaMasivaOut[]>('/despachos/fallas-masivas');
}

/* ------------------------------------------------------------------ */
/* RESUMEN                                                             */
/* ------------------------------------------------------------------ */

export function obtenerResumen(): Promise<Resumen> {
  return request<Resumen>('/resumen');
}

/* ------------------------------------------------------------------ */
/* SEGUIMIENTO, ESPECIALES Y AGENDA (Ciclo 6)                          */
/* ------------------------------------------------------------------ */

/* --- Solicitantes ------------------------------------------------- */

export function listarSolicitantes(): Promise<Solicitante[]> {
  return request<Solicitante[]>('/solicitantes');
}

export function crearSolicitante(data: SolicitanteCreate): Promise<Solicitante> {
  return conCuerpo<Solicitante>('/solicitantes', 'POST', data);
}

/* --- Casos especiales (RF-06/RF-35) ------------------------------- */

/**
 * Listado de casos especiales (empresas/referidos/gobierno). Si no se envía
 * `id_caso` al crear, el backend genera un caso con `REF-<central>-<NNNNNN>`.
 */
export function listarCasosEspeciales(
  filtros: CasosEspecialesFiltros = {},
): Promise<CasoEspecialOut[]> {
  return request<CasoEspecialOut[]>(`/casos-especiales${construirQuery(filtros)}`);
}

export function crearCasoEspecial(data: CasoEspecialCreate): Promise<CasoEspecialOut> {
  return conCuerpo<CasoEspecialOut>('/casos-especiales', 'POST', data);
}

export function obtenerCasoEspecial(idCasoEspecial: number): Promise<CasoEspecialOut> {
  return request<CasoEspecialOut>(`/casos-especiales/${idCasoEspecial}`);
}

export function actualizarCasoEspecial(
  idCasoEspecial: number,
  data: CasoEspecialUpdate,
): Promise<CasoEspecialOut> {
  return conCuerpo<CasoEspecialOut>(`/casos-especiales/${idCasoEspecial}`, 'PATCH', data);
}

/* --- Agenda de citas (RF-12 / RNF-04) ----------------------------- */

/** Citas en un rango. `409` no aplica aquí; el `detail` llega en el alta/edición. */
export function listarCitas(filtros: CitasFiltros = {}): Promise<CitaOut[]> {
  return request<CitaOut[]>(`/citas${construirQuery(filtros)}`);
}

/** Crea una cita. Responde `409` si la cuadrilla ya tiene una cita en ese hueco. */
export function crearCita(data: CitaCreate): Promise<CitaOut> {
  return conCuerpo<CitaOut>('/citas', 'POST', data);
}

/** Reprograma o cambia el estado; valida solapamiento al cambiar fecha/cuadrilla. */
export function actualizarCita(idCita: number, data: CitaUpdate): Promise<CitaOut> {
  return conCuerpo<CitaOut>(`/citas/${idCita}`, 'PATCH', data);
}

/** `DELETE` lógico: la cita pasa a CANCELADA (responde `204`). */
export function eliminarCita(idCita: number): Promise<void> {
  return request<void>(`/citas/${idCita}`, { method: 'DELETE' });
}

/* --- Seguimiento (RF-34) ------------------------------------------ */

export function listarSeguimiento(
  filtros: SeguimientoFiltros = {},
): Promise<SeguimientoOut[]> {
  return request<SeguimientoOut[]>(`/seguimiento${construirQuery(filtros)}`);
}

/** Al crear en `EN_COLA`, el caso pasa a ENRUTADO y sale del despacho de calle. */
export function crearSeguimiento(data: SeguimientoCreate): Promise<SeguimientoOut> {
  return conCuerpo<SeguimientoOut>('/seguimiento', 'POST', data);
}

/** Con estado `DEVUELTO` el caso vuelve a NUEVO. */
export function actualizarSeguimiento(
  idSeguimiento: number,
  data: SeguimientoUpdate,
): Promise<SeguimientoOut> {
  return conCuerpo<SeguimientoOut>(`/seguimiento/${idSeguimiento}`, 'PATCH', data);
}

export function obtenerSeguimiento(idSeguimiento: number): Promise<SeguimientoOut> {
  return request<SeguimientoOut>(`/seguimiento/${idSeguimiento}`);
}

/* ------------------------------------------------------------------ */
/* MONITOREO Y REPORTES (Ciclo 7) — solo lectura                       */
/* ------------------------------------------------------------------ */

/** Gestión de una jornada: ingresos, resoluciones, citas, diferidos y pendientes. */
export function monitoreoDiario(fecha: string): Promise<MonitoreoDiario> {
  return request<MonitoreoDiario>(`/monitoreo/diario${construirQuery({ fecha })}`);
}

/** Reporte semanal (6 puntos, lunes a sábado) a partir de `desde`. */
export function monitoreoSemanal(desde: string): Promise<MonitoreoSemanal> {
  return request<MonitoreoSemanal>(`/monitoreo/semanal${construirQuery({ desde })}`);
}

/** Totales globales de casos en el rango, con desglose por estado y categoría. */
export function monitoreoGlobales(desde: string, hasta: string): Promise<MonitoreoGlobales> {
  return request<MonitoreoGlobales>(`/monitoreo/globales${construirQuery({ desde, hasta })}`);
}

/** Reparaciones del periodo por tipo. */
export function monitoreoReparacion(): Promise<MonitoreoReparacion> {
  return request<MonitoreoReparacion>('/monitoreo/reparacion');
}

/** Construcciones del periodo por tipo. */
export function monitoreoConstruccion(): Promise<MonitoreoConstruccion> {
  return request<MonitoreoConstruccion>('/monitoreo/construccion');
}

/** Producción por cuadrilla a partir de `desde` durante `dias` (por defecto 6). */
export function monitoreoCuadrilla(
  desde: string,
  dias = 6,
): Promise<MonitoreoCuadrillaOut> {
  return request<MonitoreoCuadrillaOut>(`/monitoreo/cuadrilla${construirQuery({ desde, dias })}`);
}

/** Capacidad operativa: cuadrillas, técnicos, flota, herramientas y sectores. */
export function monitoreoCapacidad(): Promise<MonitoreoCapacidad> {
  return request<MonitoreoCapacidad>('/monitoreo/capacidad');
}

/** Reporte consolidado de trabajo (diario, semanal o mensual). */
export function reporteTrabajo(
  periodo: PeriodoReporte,
  fecha: string,
): Promise<ReporteTrabajo> {
  return request<ReporteTrabajo>(`/reportes/trabajo${construirQuery({ periodo, fecha })}`);
}

/**
 * HTML del reporte imprimible (misma mecánica que el despacho RT-08): se pide
 * con `Bearer` y se abre en una pestaña nueva, porque la URL directa no puede
 * llevar la cabecera de autorización.
 */
export function obtenerReporteTrabajoImprimible(
  periodo: PeriodoReporte,
  fecha: string,
): Promise<string> {
  return requestTexto(`/reportes/trabajo/imprimible${construirQuery({ periodo, fecha })}`);
}

/* ------------------------------------------------------------------ */
/* ALERTAS, FALLAS MASIVAS Y OUTBOX (Ciclo 9) — RNF-19, RNF-20         */
/* ------------------------------------------------------------------ */

/** Fallas masivas registradas; `soloActivas` filtra DETECTADA/PLANIFICADA. */
export function listarFallasMasivasAlertas(
  filtros: { estado?: string; solo_activas?: boolean } = {},
): Promise<FallaMasivaOut[]> {
  return request<FallaMasivaOut[]>(`/fallas-masivas${construirQuery(filtros)}`);
}

/** Fuerza la detección automática por concentración (RF-09). Idempotente. */
export function detectarFallasMasivas(): Promise<FallaMasivaOut[]> {
  return request<FallaMasivaOut[]>('/fallas-masivas/detectar', { method: 'POST' });
}

/** Reporte manual de una falla masiva (RF-16). */
export function reportarFallaManual(data: FallaMasivaManual): Promise<FallaMasivaOut> {
  return conCuerpo<FallaMasivaOut>('/fallas-masivas', 'POST', data);
}

/** Cambia estado o cuadrilla de la falla (RF-09). */
export function actualizarFallaMasiva(
  idFalla: number,
  data: FallaMasivaUpdate,
): Promise<FallaMasivaOut> {
  return conCuerpo<FallaMasivaOut>(`/fallas-masivas/${idFalla}`, 'PATCH', data);
}

/** Documenta la planificación de la atención (RF-17). */
export function planificarFallaMasiva(
  idFalla: number,
  data: PlanificacionFalla,
): Promise<FallaMasivaOut> {
  return conCuerpo<FallaMasivaOut>(`/fallas-masivas/${idFalla}/planificacion`, 'POST', data);
}

/** Solicita material asociado a la falla (RF-18). */
export function solicitarMaterialFalla(
  idFalla: number,
  data: MaterialFalla,
): Promise<OrdenMaterialOut> {
  return conCuerpo<OrdenMaterialOut>(`/fallas-masivas/${idFalla}/material`, 'POST', data);
}

/** Bandeja del outbox de notificaciones. */
export function listarOutbox(
  filtros: { estado?: string; canal?: string; limite?: number } = {},
): Promise<NotificacionOut[]> {
  return request<NotificacionOut[]>(`/notificaciones${construirQuery(filtros)}`);
}

/** Procesa el outbox (reintentos con backoff). */
export function procesarOutbox(limite = 50): Promise<ProcesarOutboxOut> {
  return request<ProcesarOutboxOut>(
    `/notificaciones/procesar${construirQuery({ limite })}`,
    { method: 'POST' },
  );
}

/** Métricas de negocio y estado de los canales (RNF-19). */
export function obtenerMetricas(): Promise<MetricasOut> {
  return request<MetricasOut>('/metricas');
}
