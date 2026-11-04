/**
 * Columna **INDICADORES** de la sección MASIVAS (D-111).
 *
 * Una sola celda resume, con **tres iconos**, lo que el supervisor necesita ver
 * de un vistazo en el cuadro de masivas (requisito de la sección reducida):
 *
 *  - **Planificación**: la masiva ya tiene plan de atención (`planificacion`).
 *  - **Materiales solicitados**: pedidas a almacén (`SOLICITADA`/`APROBADA`).
 *  - **Materiales entregados**: ya recibidas por la cuadrilla (`ENTREGADA`).
 *
 * El icono **encendido** (color de marca sobre su fondo claro) significa «sí»;
 * el **apagado** (gris punteado) significa «todavía no». Como el icono no lleva
 * texto visible, el estado no se pierde —RNF-09/RNF-23—: va en el `title`
 * (ratón) y en `aria-label` + texto oculto (lectores de pantalla).
 */
import type { ComponentType, SVGProps } from 'react';
import type { FallaMasivaOut } from '../api/types';
import { IconoMateriales, IconoPlanificado } from '../components/Iconos';

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

/** Clave estable de cada indicador (también es su clase CSS). */
export type ClaveIndicador =
  | 'planificacion'
  | 'materiales-solicitados'
  | 'materiales-entregados';

export interface IndicadorMasiva {
  clave: ClaveIndicador;
  /** ¿La masiva ya cumple el requisito? */
  activo: boolean;
  /** Nombre accesible: «Planificación: sin planificar», «Materiales: 2 orden(es)»… */
  titulo: string;
  Icono: Icono;
}

/** Texto corto y en una línea para el `title` (la planificación es libre). */
function recortar(texto: string, largo = 48): string {
  return texto.length <= largo ? texto : `${texto.slice(0, largo - 1)}…`;
}

/**
 * Los tres indicadores de una masiva (función pura: se puede probar sin DOM).
 *
 * Las reglas salen de los campos que la API entrega en el listado:
 * `planificacion`, `ordenes_solicitadas` y `ordenes_entregadas`.
 */
export function indicadoresDeMasiva(falla: FallaMasivaOut): IndicadorMasiva[] {
  const planificacion = (falla.planificacion ?? '').trim();
  const solicitadas = falla.ordenes_solicitadas ?? 0;
  const entregadas = falla.ordenes_entregadas ?? 0;

  return [
    {
      clave: 'planificacion',
      activo: planificacion !== '',
      titulo:
        planificacion === ''
          ? 'Planificación: sin planificar'
          : `Planificación: ${recortar(planificacion)}`,
      Icono: IconoPlanificado,
    },
    {
      clave: 'materiales-solicitados',
      activo: solicitadas > 0,
      titulo:
        solicitadas > 0
          ? `Materiales: ${solicitadas} orden(es) solicitada(s)`
          : 'Materiales: sin órdenes solicitadas',
      Icono: IconoMateriales,
    },
    {
      clave: 'materiales-entregados',
      activo: entregadas > 0,
      titulo:
        entregadas > 0
          ? `Materiales: ${entregadas} orden(es) entregada(s)`
          : 'Materiales: material sin entregar',
      Icono: IconoMateriales,
    },
  ];
}

/** Celda de la columna INDICADORES. */
export default function CeldaIndicadores({ falla }: { falla: FallaMasivaOut }) {
  return (
    <span className="celda-indicadores">
      {indicadoresDeMasiva(falla).map(({ clave, activo, titulo, Icono }) => (
        <span
          key={clave}
          className={`indicador indicador-${clave} ${activo ? 'indicador-on' : 'indicador-off'}`}
          title={titulo}
          role="img"
          aria-label={titulo}
        >
          <Icono width={17} height={17} />
          <span className="visualmente-oculto">{titulo}</span>
        </span>
      ))}
    </span>
  );
}
