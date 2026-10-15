/**
 * Registro de la sección MASIVAS (D-99) para la web.
 *
 * Este módulo **no** modifica `App.tsx`, `Layout.tsx` ni `Iconos.tsx` (hay otro
 * cambio en vuelo sobre ellos): solo expone lo que el agente padre debe
 * enganchar. Compila por sí solo.
 *
 * Conexión pendiente (a cargo del agente padre):
 *
 * ```tsx
 * // App.tsx — dentro de <Route element={<RutaGestion />}>:
 * import { RUTA_MASIVAS, PaginaMasivas } from './masivas/registro';
 * <Route path={RUTA_MASIVAS} element={<PaginaMasivas />} />
 *
 * // Layout.tsx — entrada de la barra superior:
 * import { RUTA_MASIVAS, ETIQUETA_MASIVAS, ROLES_MASIVAS, IconoMasiva } from '../masivas/registro';
 * const SECCIONES: Seccion[] = [
 *   // …
 *   {
 *     ruta: RUTA_MASIVAS,
 *     etiqueta: ETIQUETA_MASIVAS,
 *     fin: false,
 *     Icono: IconoMasiva,
 *     roles: [...ROLES_MASIVAS],
 *   },
 * ];
 * ```
 *
 * Nota: el icono vive en `IconoMasiva.tsx` porque un archivo `.ts` no admite
 * sintaxis JSX; aquí solo se reexporta con el nombre requerido.
 */

/** Ruta de la sección en el enrutador. */
export const RUTA_MASIVAS = '/masivas';

/** Etiqueta de la sección en la barra superior. */
export const ETIQUETA_MASIVAS = 'MASIVAS';

/** Roles con acceso (mismo criterio que DESPACHO: exclusión del rol TÉCNICO). */
export const ROLES_MASIVAS = ['SUPER', 'ADMIN', 'SUPERVISOR'] as const;

/** Icono SVG propio (24×24, `currentColor`) para la barra de navegación. */
export { default as IconoMasiva } from './IconoMasiva';

/** Página completa de la sección MASIVAS, con sus pestañas. */
export { default as PaginaMasivas } from '../pages/Masivas';
