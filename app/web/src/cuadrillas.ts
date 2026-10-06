/**
 * D-80: color e identificación de la cuadrilla en los listados.
 *
 * El icono de «Asignado» se sustituye por el icono de la **cuadrilla** a la que
 * el caso fue asignado, pintado con su color. El número de cuadrilla se toma del
 * **último grupo numérico de su código** (`C-00` → 0, `C-01` → 1, `E2E-C1` → 1,
 * `TCD12` → 12); si el código no trae números se usa `id_cuadrilla` como respaldo.
 */

/** Tonos por número de cuadrilla: 0 verde · 1 amarillo · 2 azul · 3 morado… */
export const TONOS_CUADRILLA = [
  'verde',
  'ambar',
  'azul',
  'morado',
  'naranja',
  'cian',
  'rosa',
  'pizarra',
  'marron',
  'indigo',
] as const;

export type TonoCuadrilla = (typeof TONOS_CUADRILLA)[number];

/**
 * Número de la cuadrilla a partir de su código.
 *
 * Se usa el **último** grupo de dígitos para que códigos con números en el
 * prefijo (`E2E-C1`, `TCD2`) den la cuadrilla correcta y no «21».
 */
export function numeroDeCuadrilla(codigo?: string | null): number | null {
  if (!codigo) return null;
  const grupos = codigo.match(/\d+/g);
  if (!grupos || grupos.length === 0) return null;
  const ultimo = grupos[grupos.length - 1];
  const numero = Number.parseInt(ultimo, 10);
  return Number.isNaN(numero) ? null : numero;
}

/**
 * Índice dentro de la paleta: el número de la cuadrilla o, si el código no lo
 * trae, el `id_cuadrilla` como respaldo estable.
 */
export function indiceDeCuadrilla(
  codigo?: string | null,
  idCuadrilla?: number | null,
): number | null {
  const numero = numeroDeCuadrilla(codigo);
  if (numero !== null) return numero;
  return typeof idCuadrilla === 'number' ? idCuadrilla : null;
}

/** Tono de color que le corresponde a la cuadrilla. */
export function tonoDeCuadrilla(
  codigo?: string | null,
  idCuadrilla?: number | null,
): TonoCuadrilla | null {
  const indice = indiceDeCuadrilla(codigo, idCuadrilla);
  if (indice === null) return null;
  return TONOS_CUADRILLA[indice % TONOS_CUADRILLA.length];
}

/**
 * Etiqueta corta para el chip: `C-00` → `C0`, `C-12` → `C12`, `E2E-C1` → `C1`.
 * Un código sin número reconocible se devuelve tal cual (recortado).
 */
export function etiquetaCuadrilla(codigo?: string | null): string {
  if (!codigo) return '';
  const numero = numeroDeCuadrilla(codigo);
  if (numero !== null) return `C${numero}`;
  return codigo.length > 6 ? `${codigo.slice(0, 6)}…` : codigo;
}

/** Texto para `title`/`aria-label`: «Cuadrilla C-00 — Gestión (Supervisor)». */
export function descripcionCuadrilla(
  codigo?: string | null,
  nombre?: string | null,
): string {
  if (!codigo && !nombre) return 'Sin cuadrilla asignada';
  const partes = [codigo ? `Cuadrilla ${codigo}` : 'Cuadrilla'];
  if (nombre) partes.push(nombre);
  return partes.join(' — ');
}
