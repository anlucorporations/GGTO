/**
 * Pie de tabla con el conteo total de registros (requisito de UI 4).
 *
 * Se coloca como última fila del listado (`<tfoot>`), alineado en la parte
 * inferior de la tabla, e informa cuántos registros se están mostrando
 * (respetando los filtros activos).
 */
interface Props {
  /** Número de columnas de la tabla (para el `colSpan` de la fila). */
  colSpan: number;
  /** Cantidad total de registros mostrados. */
  total: number;
  /** Nombre en singular del registro (por defecto «registro»). */
  singular?: string;
  /** Nombre en plural del registro (por defecto «registros»). */
  plural?: string;
  /** Muestra «Cargando…» mientras se obtiene el listado. */
  cargando?: boolean;
}

export default function PieTabla({
  colSpan,
  total,
  singular = 'registro',
  plural = 'registros',
  cargando = false,
}: Props) {
  return (
    <tfoot>
      <tr>
        <td className="tabla-pie" colSpan={colSpan}>
          {cargando ? 'Cargando…' : `Total: ${total} ${total === 1 ? singular : plural}`}
        </td>
      </tr>
    </tfoot>
  );
}
