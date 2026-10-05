/**
 * Formulario flotante para PROCESAR el despacho (requisito de UI 6, ciclo D-66).
 *
 * Muestra, para la fecha elegida:
 *  - el **universo de casos** (comunes y especiales),
 *  - los **sectores** con su total de casos,
 *  - las **cuadrillas** con los sectores asignados, con la opción de modificar
 *    la asignación (selector por sector),
 *  - los botones **Procesar despacho** y **Cancelar**.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import type { AsignacionBloque, DespachoDetalleOut, ProcesoDespachoOut } from '../api/types';
import Modal from './Modal';

interface Props {
  fecha: string;
  onCerrar: () => void;
  onProcesado: (creados: DespachoDetalleOut[]) => void;
}

type Filtro = 'TODOS' | 'COMUNES' | 'ESPECIALES';

export default function ProcesarDespacho({ fecha, onCerrar, onProcesado }: Props) {
  const [proceso, setProceso] = useState<ProcesoDespachoOut | null>(null);
  const [asignacion, setAsignacion] = useState<Record<number, number | null>>({});
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await api.obtenerProcesoDespacho({ fecha });
      setProceso(datos);
      setAsignacion(
        Object.fromEntries(datos.sectores.map((s) => [s.id_sector, s.id_cuadrilla ?? null])),
      );
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo cargar el universo de casos.');
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cuadrillas = proceso?.cuadrillas ?? [];
  const sectores = proceso?.sectores ?? [];
  // D-77: la cuadrilla 0 (supervisor) no recibe sectores: solo los casos en
  // GESTIÓN. Por eso no aparece en los selectores de sector.
  const cuadrillasCalle = cuadrillas.filter((c) => !c.es_supervisor);

  const bloques: AsignacionBloque[] = useMemo(
    () =>
      cuadrillas.map((c) => ({
        id_cuadrilla: c.id_cuadrilla,
        ids_sector: sectores
          .filter((s) => asignacion[s.id_sector] === c.id_cuadrilla)
          .map((s) => s.id_sector),
      })),
    [cuadrillas, sectores, asignacion],
  );

  const totalPorCuadrilla = useMemo(() => {
    const mapa: Record<number, number> = {};
    for (const s of sectores) {
      const idc = asignacion[s.id_sector];
      if (idc !== null && idc !== undefined) mapa[idc] = (mapa[idc] ?? 0) + s.total;
    }
    return mapa;
  }, [sectores, asignacion]);

  const casos = proceso?.universo.casos ?? [];
  const visibles = casos.filter((c) =>
    filtro === 'TODOS' ? true : filtro === 'ESPECIALES' ? c.especial : !c.especial,
  );
  const sinAsignarSector = sectores.filter(
    (s) => asignacion[s.id_sector] === null || asignacion[s.id_sector] === undefined,
  );

  async function procesar() {
    setProcesando(true);
    setError('');
    try {
      const creados = await api.procesarDespacho({ fecha, asignaciones: bloques, reemplazar: true });
      onProcesado(creados);
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo procesar el despacho.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <Modal
      titulo={`Procesar despacho — ${fecha}`}
      onCerrar={onCerrar}
      cabeceraExtra={
        proceso ? (
          <span className="texto-pequeno">
            Asignación {proceso.asignacion_origen === 'GUARDADA' ? 'guardada' : 'propuesta automática'}
          </span>
        ) : null
      }
    >
      {error && <p className="aviso aviso-error">{error}</p>}
      {cargando ? (
        <p className="texto-pequeno">Cargando universo de casos…</p>
      ) : (
        <>
          <div className="ficha-tarjetas">
            <div className="ficha-tarjeta">
              <div className="etiqueta">Universo de casos</div>
              <div className="valor">{proceso?.universo.total ?? 0}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Comunes</div>
              <div className="valor">{proceso?.universo.comunes ?? 0}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Especiales</div>
              <div className="valor">{proceso?.universo.especiales ?? 0}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Sin sector</div>
              <div className="valor">{proceso?.universo.sin_sector ?? 0}</div>
            </div>
          </div>

          {/* Universo de casos (comunes y especiales) */}
          <h3 className="subtitulo-seccion">Universo de casos</h3>
          <div className="acciones-form">
            {(['TODOS', 'COMUNES', 'ESPECIALES'] as Filtro[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`btn btn-mini${filtro === f ? '' : ' btn-secundario'}`}
                onClick={() => setFiltro(f)}
              >
                {f === 'TODOS' ? 'Todos' : f === 'COMUNES' ? 'Comunes' : 'Especiales'}
              </button>
            ))}
          </div>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>ID avería</th>
                  <th>Cliente</th>
                  <th>Sector</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Cita</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="vacio">
                      Sin casos en este filtro.
                    </td>
                  </tr>
                ) : (
                  visibles.map((c) => (
                    <tr key={c.id_caso}>
                      <td className="mono">{c.id_averia}</td>
                      <td>{c.nombre_cliente ?? '—'}</td>
                      <td>{c.sector_nombre ?? 'Sin sector'}</td>
                      <td>{c.tipo_asignacion}</td>
                      <td>
                        {c.categoria}
                        {c.especial ? ' · especial' : ''}
                      </td>
                      <td>{c.estado_actual}</td>
                      <td>{c.es_cita ? 'Sí' : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Sectores con su total y la cuadrilla asignada (editable) */}
          <h3 className="subtitulo-seccion">Sectores y cuadrilla asignada</h3>
          {sectores.length === 0 ? (
            <p className="vacio">No hay sectores con casos para esta fecha.</p>
          ) : (
            <div className="tabla-envoltura">
              <table>
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th>Casos</th>
                    <th>Especiales</th>
                    <th>Citados</th>
                    <th>Cuadrilla asignada</th>
                  </tr>
                </thead>
                <tbody>
                  {sectores.map((s) => (
                    <tr key={s.id_sector}>
                      <td>{s.nombre ?? `Sector #${s.id_sector}`}</td>
                      <td>{s.total}</td>
                      <td>{s.especiales}</td>
                      <td>{s.citados}</td>
                      <td>
                        <select
                          aria-label={`Cuadrilla para ${s.nombre ?? `sector ${s.id_sector}`}`}
                          value={asignacion[s.id_sector] ?? ''}
                          onChange={(e) =>
                            setAsignacion({
                              ...asignacion,
                              [s.id_sector]: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                        >
                          <option value="">— Sin asignar —</option>
                          {cuadrillasCalle.map((c) => (
                            <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
                              {c.codigo} — {c.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cuadrillas con sus sectores asignados */}
          <h3 className="subtitulo-seccion">Cuadrillas y sectores asignados</h3>
          {cuadrillas.length === 0 ? (
            <p className="vacio">No hay cuadrillas activas de calle.</p>
          ) : (
            <div className="ficha-tarjetas">
              {cuadrillas.map((c) => {
                const suyos = sectores.filter((s) => asignacion[s.id_sector] === c.id_cuadrilla);
                // La cuadrilla 0 no recibe sectores: sus casos vienen de GESTIÓN
                const enPropuesta =
                  proceso?.grupos.find((g) => g.id_cuadrilla === c.id_cuadrilla)?.total ?? 0;
                return (
                  <div className="ficha-tarjeta" key={c.id_cuadrilla}>
                    <div className="etiqueta">
                      {c.codigo} — {c.nombre}
                      {c.es_supervisor && (
                        <span className="chip chip-estado-ok" style={{ marginLeft: 6 }}>
                          Cuadrilla 0 · casos en gestión
                        </span>
                      )}
                    </div>
                    <div className="valor">
                      {c.es_supervisor
                        ? enPropuesta
                        : (totalPorCuadrilla[c.id_cuadrilla] ?? 0)}{' '}
                      caso(s)
                    </div>
                    <p className="texto-pequeno">
                      {c.es_supervisor
                        ? 'Recibe los casos en gestión (sin sectores)'
                        : suyos.length === 0
                          ? 'Sin sectores asignados'
                          : suyos.map((s) => s.nombre ?? `#${s.id_sector}`).join(' · ')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {sinAsignarSector.length > 0 && (
            <div className="aviso aviso-info">
              <span>
                {sinAsignarSector.length} sector(es) sin cuadrilla: sus casos no se despacharán
                (salvo los citados, que se asignan a la cuadrilla menos cargada).
              </span>
            </div>
          )}

          <div className="acciones-form">
            <button className="btn" type="button" onClick={() => void procesar()} disabled={procesando}>
              {procesando ? 'Procesando…' : 'Procesar despacho'}
            </button>
            <button className="btn btn-secundario" type="button" onClick={onCerrar} disabled={procesando}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
