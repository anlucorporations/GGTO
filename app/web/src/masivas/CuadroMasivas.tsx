/**
 * CUADRO DE LAS MASIVAS (D-111): el listado de la sección con el **estilo de
 * CASOS**.
 *
 * Sustituye a los cuadros de texto que vivían dentro de las pestañas:
 *
 *  - mismo contenedor (`tabla-envoltura`) y misma tabla (`tabla-resumen`) que el
 *    listado de CASOS, con las filas **clicables** (`fila-clicable`, `Enter` y
 *    `Espacio` abren la ficha) y el pie con el total (`PieTabla`);
 *  - la columna **INDICADORES** resume con tres iconos si la masiva tiene
 *    Planificación, Materiales y Asignación (`CeldaIndicadores`);
 *  - la columna **ACCIONES** son iconos con nombre accesible (`BotonIcono`):
 *    Gestionar · Reporte · Ubicación · Ver.
 */
import type { FallaMasivaOut } from '../api/types';
import {
  IconoGestion,
  IconoReporte,
  IconoUbicacion,
  IconoVer,
} from '../components/Iconos';
import PieTabla from '../components/PieTabla';
import { fechaHora } from '../utils';
import BotonIcono from './AccionesMasiva';
import CeldaIndicadores from './CeldaIndicadores';
import { claseEstadoMasiva } from './estado';

interface Props {
  /** Masivas a mostrar (el histórico de la sección, más recientes primero). */
  items: FallaMasivaOut[];
  cargando: boolean;
  /** Acción en curso (`reporte-<id>`) para deshabilitar ese icono. */
  ocupado: string;
  onGestionar: (masiva: FallaMasivaOut) => void;
  onReporte: (idFalla: number) => void;
  onUbicacion: (idFalla: number) => void;
  onVer: (masiva: FallaMasivaOut) => void;
}

/** Columnas de la tabla (para el `colSpan` del pie). */
const COLUMNAS = 7;

function txt(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return String(valor);
}

export default function CuadroMasivas({
  items,
  cargando,
  ocupado,
  onGestionar,
  onReporte,
  onUbicacion,
  onVer,
}: Props) {
  return (
    <div className="tabla-envoltura">
      <table className="tabla-resumen">
        <thead>
          <tr>
            <th>ID masiva</th>
            <th>Estado</th>
            <th>Sector</th>
            <th>Casos</th>
            <th>Detección</th>
            <th>Indicadores</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr
              key={m.id_falla}
              className="fila-clicable"
              tabIndex={0}
              onClick={() => onGestionar(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onGestionar(m);
                }
              }}
            >
              <td className="mono">{m.id_falla}</td>
              <td>
                <span className="celda-estado-masiva">
                  <span className={claseEstadoMasiva(m.estado)}>{m.estado}</span>
                  <span className="celda-secundaria">{txt(m.origen)}</span>
                </span>
              </td>
              <td>
                <span className="celda-estado-masiva">
                  <span>{txt(m.sector_nombre)}</span>
                  {m.direccion_corta && (
                    <span className="celda-secundaria" title={m.direccion ?? m.direccion_corta}>
                      {m.direccion_corta}
                    </span>
                  )}
                </span>
              </td>
              <td className="mono">{m.casos_asociados ?? 0}</td>
              <td>{fechaHora(m.fecha_deteccion)}</td>
              <td>
                <CeldaIndicadores falla={m} />
              </td>
              <td>
                {/* Los clics y las teclas de los iconos no deben abrir además la
                    ficha: la fila entera es clicable. */}
                <div
                  className="masiva-personal-acciones masiva-acciones-iconos"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <BotonIcono
                    Icono={IconoGestion}
                    etiqueta="Gestionar"
                    tono="primario"
                    onClick={() => onGestionar(m)}
                  />
                  <BotonIcono
                    Icono={IconoReporte}
                    etiqueta="Reporte"
                    onClick={() => onReporte(m.id_falla)}
                    disabled={ocupado === `reporte-${m.id_falla}`}
                  />
                  <BotonIcono
                    Icono={IconoUbicacion}
                    etiqueta="Ubicación"
                    onClick={() => onUbicacion(m.id_falla)}
                  />
                  <BotonIcono Icono={IconoVer} etiqueta="Ver" onClick={() => onVer(m)} />
                </div>
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
