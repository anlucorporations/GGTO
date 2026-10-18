/**
 * Color del estado de una masiva (D-111).
 *
 * Vivía dentro de `pages/Masivas.tsx`; el cuadro de la sección es ahora un
 * componente propio (`CuadroMasivas`) y ambos necesitan la misma clase, así que
 * se comparte desde aquí para no duplicar la regla.
 *
 * La correspondencia es la de D-99: CERRADA y ATENDIDA en verde (trabajo
 * terminado), DETECTADA en rojo (sin planificar, la que urge) y el resto
 * (PLANIFICADA) con el chip neutro.
 */
export function claseEstadoMasiva(estado: string): string {
  if (estado === 'CERRADA' || estado === 'ATENDIDA') return 'chip-estado chip-estado-ok';
  if (estado === 'DETECTADA') return 'chip-estado chip-estado-alerta';
  return 'chip-estado';
}
