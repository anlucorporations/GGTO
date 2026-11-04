/**
 * CUADRO DE LAS MASIVAS (D-111): el listado de la sección con el **estilo de
 * CASOS**.
 *
 * Sección MASIVAS reducida (requisito del usuario): **solo vive este cuadro**,
 * cada fila es clicable y abre el **detalle** de la masiva (ficha flotante).
 *
 *  - mismo contenedor (`tabla-envoltura`) y misma tabla (`tabla-resumen`) que el
 *    listado de CASOS, con `Enter` y `Espacio` abriendo el detalle;
 *  - la columna **INDICADORES** resume con iconos si la masiva está
 *    planificada y tiene materiales solicitados/entregados
 *    (`CeldaIndicadores`); sin columna de acciones: el detalle concentra todo.
 */
import type { FallaMasivaOut } from '../api/types';
import PieTabla from '../components/PieTabla';
import { fechaHora } from '../utils';
import CeldaIndicadores from './CeldaIndicadores';

interface Props {
  /** Masivas a mostrar (las abiertas al entrar; sin el filtro, todas). */
  items: FallaMasivaOut[];
  cargando: boolean;
  /** Abre el detalle (solo lectura) de la masiva pulsada. */
  onAbrir: (masiva: FallaMasivaOut) => void;
}

/** Columnas de la tabla (para el `colSpan` del pie). */
const COLUMNAS = 7;

/** Recorta la descripción a una línea razonable para la celda. */
function truncar(texto: unknown, largo = 60): string {
  const limpio = (texto ?? '').toString().trim();
  if (limpio.length === 0) return '—';
  return limpio.length <= largo ? limpio : `${limpio.slice(0, largo - 1)}…`;
}

export default function CuadroMasivas({ items, cargando, onAbrir }: Props) {
  return (
    <div className="tabla-envoltura">
      <table className="tabla-resumen">
        <thead>
          <tr>
            <th>ID masiva</th>
            <th>Descripción</th>
            <th>Estado</th>
            <th>Sector</th>
            <th>Casos</th>
            <th>Detección</th>
            <th>Indicadores</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr
              key={m.id_falla}
              className="fila-clicable"
              tabIndex={0}
              onClick={() => onAbrir(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAbrir(m);
                }
              }}
              aria-label={`Abrir el detalle de la masiva #${m.id_falla}`}
            >
              <td className="mono">{m.id_falla}</td>
              <td>
                <span className="masiva-descripcion-corta" title={m.descripcion}>
                  {truncar(m.descripcion)}
                </span>
              </td>
              <td>
                <span className="celda-estado-masiva">
                  <span>{m.estado}</span>
                  <span className="celda-secundaria">{m.origen}</span>
                </span>
              </td>
              <td>{m.sector_nombre || '—'}</td>
              <td className="mono">{m.casos_asociados ?? 0}</td>
              <td>{fechaHora(m.fecha_deteccion)}</td>
              <td>
                <CeldaIndicadores falla={m} />
              </td>
            </tr>
          ))}
        </tbody>
        <PieTabla
          colSpan={COLUMNAS}
          total={items.length}
          singular="masiva"
          plural="masivas"
          cargando={cargando}
        />
      </table>
    </div>
  );
}
