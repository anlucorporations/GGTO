/**
 * Columna **INDICADORES** de la sección MASIVAS (D-111).
 *
 * Una sola celda resume, con **tres iconos**, lo que el supervisor necesita ver
 * de un vistazo en el cuadro de masivas:
 *
 *  - **Planificación**: la masiva ya tiene plan de atención (`planificacion`).
 *  - **Materiales**: tiene al menos una orden de material (`ordenes_count`).
 *  - **Asignación**: tiene cuadrilla asignada (`id_cuadrilla`/`cuadrilla_codigo`).
 *
 * El icono **encendido** (color de marca sobre su fondo claro) significa «sí»;
 * el **apagado** (gris punteado) significa «todavía no». Como el icono no lleva
 * texto visible, el estado no se pierde —RNF-09/RNF-23—: va en el `title`
 * (ratón) y en `aria-label` + texto oculto (lectores de pantalla).
 */
import type { ComponentType, SVGProps } from 'react';
import type { FallaMasivaOut } from '../api/types';
import { IconoCuadrilla, IconoMateriales, IconoPlanificado } from '../components/Iconos';

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

/** Clave estable de cada indicador (también es su clase CSS). */
export type ClaveIndicador = 'planificacion' | 'materiales' | 'asignacion';

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

/** Código o, si no vino, nombre de la cuadrilla asignada. */
function cuadrillaDe(falla: FallaMasivaOut): string {
  return (falla.cuadrilla_codigo ?? falla.cuadrilla_nombre ?? '').trim();
}

/**
 * Los tres indicadores de una masiva (función pura: se puede probar sin DOM).
 *
 * Las reglas salen de los campos que la API entrega en el listado:
 * `planificacion`, `ordenes_count` e `id_cuadrilla`/`cuadrilla_codigo`.
 */
export function indicadoresDeMasiva(falla: FallaMasivaOut): IndicadorMasiva[] {
  const planificacion = (falla.planificacion ?? '').trim();
  const ordenes = falla.ordenes_count ?? 0;
  const cuadrilla = cuadrillaDe(falla);
  const asignada = (falla.id_cuadrilla ?? 0) > 0 || cuadrilla !== '';

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
      clave: 'materiales',
      activo: ordenes > 0,
      titulo:
        ordenes > 0
          ? `Materiales: ${ordenes} orden(es) de material`
          : 'Materiales: sin órdenes de material',
      Icono: IconoMateriales,
    },
    {
      clave: 'asignacion',
      activo: asignada,
      titulo: asignada
        ? `Asignación: cuadrilla ${cuadrilla === '' ? `#${falla.id_cuadrilla}` : cuadrilla}`
        : 'Asignación: sin cuadrilla',
      Icono: IconoCuadrilla,
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
