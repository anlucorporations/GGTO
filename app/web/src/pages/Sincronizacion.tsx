/**
 * SINCRONIZACIÓN (D-81 · RF-39 / RF-40) — log de las sesiones de la APK.
 *
 * Se muestra como pestaña dentro de SISTEMAS para ADMIN/SUPERVISOR/SUPER. Incluye
 * los KPIs del día, un listado filtrable y la ficha de cada sesión con su
 * **checklist por paso** (conexión · login · descarga · carga).
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import type {
  ResumenSincronizaciones,
  SincronizacionDetalle,
  SincronizacionItem,
  SincronizacionesFiltros,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';

const TAMANO = 20;

function fecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

function duracion(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function colorEstado(estado: string): string {
  switch (estado) {
    case 'OK':
      return 'var(--ok, #1f9d55)';
    case 'PARCIAL':
      return 'var(--aviso, #c47f00)';
    case 'ERROR':
      return 'var(--error, #c0392b)';
    default:
      return '#8a8a8a';
  }
}

export default function Sincronizacion() {
  const [resumen, setResumen] = useState<ResumenSincronizaciones | null>(null);
  const [pagina, setPagina] = useState(1);
  const [items, setItems] = useState<SincronizacionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(0);
  const [filtros, setFiltros] = useState<SincronizacionesFiltros>({});
  const [detalle, setDetalle] = useState<SincronizacionDetalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [pag, res] = await Promise.all([
        api.listarSincronizaciones({ ...filtros, page: pagina, page_size: TAMANO }),
        api.resumenSincronizaciones(),
      ]);
      setItems(pag.items);
      setTotal(pag.total);
      setPaginas(pag.pages);
      setResumen(res);
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo leer el log de sincronización.');
    } finally {
      setCargando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function abrirFicha(id: number) {
    try {
      setDetalle(await api.obtenerSincronizacion(id));
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo abrir la ficha.');
    }
  }

  return (
    <>
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />

      {resumen && (
        <div className="ficha-tarjetas">
          <div className="ficha-tarjeta">
            <div className="etiqueta">Sincronizaciones hoy</div>
            <div className="valor">{resumen.total}</div>
          </div>
          <div className="ficha-tarjeta">
            <div className="etiqueta">OK</div>
            <div className="valor" style={{ color: colorEstado('OK') }}>{resumen.ok}</div>
          </div>
          <div className="ficha-tarjeta">
            <div className="etiqueta">Parcial</div>
            <div className="valor" style={{ color: colorEstado('PARCIAL') }}>{resumen.parcial}</div>
          </div>
          <div className="ficha-tarjeta">
            <div className="etiqueta">Error</div>
            <div className="valor" style={{ color: colorEstado('ERROR') }}>{resumen.error}</div>
          </div>
          <div className="ficha-tarjeta">
            <div className="etiqueta">En proceso</div>
            <div className="valor">{resumen.en_proceso}</div>
          </div>
        </div>
      )}

      <div className="panel-bloque">
        <div className="filtros-tabla">
          <div className="campo">
            <label htmlFor="sync-estado">Estado</label>
            <select
              id="sync-estado"
              value={filtros.estado ?? ''}
              onChange={(e) => {
                setPagina(1);
                setFiltros((f) => ({ ...f, estado: e.target.value || undefined }));
              }}
            >
              <option value="">Todos</option>
              <option value="OK">OK</option>
              <option value="PARCIAL">Parcial</option>
              <option value="ERROR">Error</option>
              <option value="EN_PROCESO">En proceso</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="sync-tipo">Tipo</label>
            <select
              id="sync-tipo"
              value={filtros.tipo ?? ''}
              onChange={(e) => {
                setPagina(1);
                setFiltros((f) => ({ ...f, tipo: e.target.value || undefined }));
              }}
            >
              <option value="">Todos</option>
              <option value="DESCARGA">Descarga</option>
              <option value="CARGA">Carga</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="sync-p00">P00</label>
            <input
              id="sync-p00"
              value={filtros.p00 ?? ''}
              onChange={(e) => {
                setPagina(1);
                setFiltros((f) => ({ ...f, p00: e.target.value || undefined }));
              }}
              placeholder="Buscar por P00…"
            />
          </div>
        </div>

        {cargando ? (
          <p className="texto-pequeno">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="vacio">No hay sincronizaciones para los filtros indicados.</p>
        ) : (
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Inicio</th>
                  <th>P00</th>
                  <th>Tipo</th>
                  <th>Dispositivo</th>
                  <th>Duración</th>
                  <th>Recibidos</th>
                  <th>Procesados</th>
                  <th>Errores</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr
                    key={s.id_sync_log}
                    className="fila-clicable"
                    onClick={() => void abrirFicha(s.id_sync_log)}
                  >
                    <td>{fecha(s.iniciado_en)}</td>
                    <td className="mono">{s.p00}</td>
                    <td>{s.tipo}</td>
                    <td className="texto-pequeno">{s.dispositivo_id ?? '—'}</td>
                    <td>{duracion(s.duracion_ms)}</td>
                    <td>{s.recibidos}</td>
                    <td>{s.procesados}</td>
                    <td>{s.errores}</td>
                    <td style={{ color: colorEstado(s.estado), fontWeight: 600 }}>{s.estado}</td>
                  </tr>
                ))}
              </tbody>
              <PieTabla colSpan={9} total={total} singular="sesión" plural="sesiones" />
            </table>
          </div>
        )}

        <div className="barra-paginacion">
          <span className="texto-pequeno">
            Total: {total} · página {pagina} de {paginas || 1}
          </span>
          <div className="paginacion-controles">
            <button
              className="btn btn-mini btn-secundario"
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1 || cargando}
            >
              Anterior
            </button>
            <button
              className="btn btn-mini btn-secundario"
              type="button"
              onClick={() => setPagina((p) => p + 1)}
              disabled={pagina >= paginas || cargando}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {detalle && (
        <Modal titulo={`Sesión #${detalle.id_sync_log} · ${detalle.p00}`} onCerrar={() => setDetalle(null)}>
          <div className="ficha-tarjetas">
            <div className="ficha-tarjeta">
              <div className="etiqueta">Tipo</div>
              <div className="valor">{detalle.tipo}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Estado</div>
              <div className="valor" style={{ color: colorEstado(detalle.estado) }}>{detalle.estado}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Dispositivo</div>
              <div className="valor">{detalle.dispositivo_id ?? '—'}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Duración</div>
              <div className="valor">{duracion(detalle.duracion_ms)}</div>
            </div>
          </div>

          <h3 className="subtitulo-seccion">Checklist (sincronización)</h3>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Paso</th>
                  <th>Estado</th>
                  <th>Hora</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {detalle.checklist.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="vacio">Sin checklist registrado.</td>
                  </tr>
                ) : (
                  detalle.checklist.map((p) => (
                    <tr key={p.paso}>
                      <td className="mono">{p.paso}</td>
                      <td style={{ color: colorEstado(p.estado), fontWeight: 600 }}>{p.estado}</td>
                      <td>{fecha(p.fecha_hora)}</td>
                      <td className="texto-pequeno">
                        {p.detalle ? JSON.stringify(p.detalle) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}
