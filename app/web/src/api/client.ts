/**
 * Cliente HTTP de la API GGTO.
 *
 * - Misma origen: todas las llamadas van a `/api/v1` (Vite lo reenvía en dev).
 * - El token se guarda en `localStorage` y se adjunta como `Bearer`.
 * - Cualquier respuesta no-2xx se convierte en `ApiError` con el `detail`
 *   devuelto por FastAPI (401, 403, 409, 423, 429, …).
 */

import type {
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
  DominioMetodo,
  Flota,
  FlotaCreate,
  FlotaUpdate,
  IngestaLoteOut,
  Metodo,
  MetodoCreate,
  PalabraPosicion,
  Parametro,
  ParametroUpdate,
  Resumen,
  ResumenIngesta,
  Sector,
  SectorCreate,
  SectorDireccion,
  SectorDireccionCreate,
  SectorUpdate,
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

/* ------------------------------------------------------------------ */
/* RESUMEN                                                             */
/* ------------------------------------------------------------------ */

export function obtenerResumen(): Promise<Resumen> {
  return request<Resumen>('/resumen');
}
