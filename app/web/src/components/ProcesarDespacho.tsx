/**
 * Formulario flotante para PROCESAR el despacho (requisito de UI 6, ciclo D-66).
 *
 * Muestra, para la fecha elegida:
 *  - el **universo de casos** (comunes y especiales),
 *  - el **checklist de tipos a distribuir** (D-113): Comunes y Referidos por
 *    defecto; Construcciones, Empresas y Masivas se marcan si se quieren,
 *  - las **fallas masivas** con la cuadrilla que las atiende, reasignable
 *    (D-113): sus casos se despachan a esa cuadrilla aunque el sector esté en
 *    otra,
 *  - los **sectores** con su total de casos,
 *  - las **cuadrillas** con los sectores asignados, con la opción de modificar
 *    la asignación (selector por sector),
 *  - los botones **Procesar despacho** y **Cancelar**.
 *
 * D-99 (RF-67 · RF-68): distingue el **primer procesamiento de la jornada** —en el
 * que la asignación de sectores a las cuadrillas es obligatoria— del **reproceso**,
 * en el que los casos se reasignan según el sector de cada cuadrilla y se avisa a
 * los técnicos con el DESPACHO ACTUALIZADO.
 *
 * D-113: los **casos PENDIENTES** que devolvió el cierre de jornada también
 * entran en el universo (el backend los incluye aunque sigan vinculados a un
 * despacho ya cerrado).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import type {
  AsignacionBloque,
  AsignacionMasiva,
  CasoAsignadoOut,
  DespachoDetalleOut,
  ProcesoDespachoOut,
} from '../api/types';
import Modal from './Modal';
import { IconoMasiva } from '../masivas/registro';

interface Props {
  fecha: string;
  onCerrar: () => void;
  onProcesado: (creados: DespachoDetalleOut[]) => void;
}

type Filtro = 'TODOS' | 'COMUNES' | 'ESPECIALES';

/** D-113: selección del checklist cuando la API no la informa. */
const TIPOS_POR_DEFECTO = ['COMUNES', 'REFERIDOS'];

/** D-113: tipo del checklist al que pertenece un caso del universo. */
function tipoDe(caso: CasoAsignadoOut): string {
  return caso.tipo_distribucion ?? 'COMUNES';
}

export default function ProcesarDespacho({ fecha, onCerrar, onProcesado }: Props) {
  const [proceso, setProceso] = useState<ProcesoDespachoOut | null>(null);
  const [asignacion, setAsignacion] = useState<Record<number, number | null>>({});
  /** D-113: tipos marcados en el checklist. */
  const [tipos, setTipos] = useState<string[]>(TIPOS_POR_DEFECTO);
  /** D-113: `id_falla -> id_cuadrilla` elegido para cada masiva. */
  const [masivas, setMasivas] = useState<Record<number, number | null>>({});
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
      // D-113: el predeterminado (Comunes y Referidos) lo declara la API.
      const meta = datos.tipos ?? [];
      setTipos(
        meta.length
          ? meta.filter((t) => t.por_defecto).map((t) => t.clave)
          : TIPOS_POR_DEFECTO,
      );
      setMasivas(
        Object.fromEntries(datos.masivas.map((m) => [m.id_falla, m.id_cuadrilla ?? null])),
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
  const sectoresBase = proceso?.sectores ?? [];
  // D-77: la cuadrilla 0 (supervisor) no recibe sectores ni masivas: solo los
  // casos en GESTIÓN. Por eso no aparece en los selectores.
  const cuadrillasCalle = cuadrillas.filter((c) => !c.es_supervisor);
  const idSupervisor = cuadrillas.find((c) => c.es_supervisor)?.id_cuadrilla ?? null;
  const masivasActivas = proceso?.masivas ?? [];
  const casosUniverso = proceso?.universo.casos ?? [];

  const etiquetaTipo = useCallback(
    (clave: string) =>
      (proceso?.tipos ?? []).find((t) => t.clave === clave)?.etiqueta ?? clave,
    [proceso],
  );

  /** D-113: casos del universo que el checklist manda distribuir. */
  const casosSeleccionados = useMemo(
    () => casosUniverso.filter((c) => tipos.includes(tipoDe(c))),
    [casosUniverso, tipos],
  );

  /** D-113: cuadrilla forzada por la masiva de cada caso asociado. */
  const cuadrillaPorCaso = useMemo(() => {
    const mapa: Record<number, number> = {};
    for (const m of masivasActivas) {
      const destino = masivas[m.id_falla];
      if (destino === null || destino === undefined) continue;
      for (const idCaso of m.ids_caso ?? []) mapa[idCaso] = destino;
    }
    return mapa;
  }, [masivasActivas, masivas]);

  /** Cuadrilla que atenderá el caso: gestión, la de su masiva o la de su sector. */
  const destinoDe = useCallback(
    (caso: CasoAsignadoOut): number | null => {
      if (caso.en_gestion && idSupervisor !== null) return idSupervisor;
      const forzado = cuadrillaPorCaso[caso.id_caso];
      if (forzado !== undefined) return forzado;
      if (caso.id_sector === null || caso.id_sector === undefined) return null;
      const delSector = asignacion[caso.id_sector];
      return delSector ?? null;
    },
    [idSupervisor, cuadrillaPorCaso, asignacion],
  );

  /**
   * D-113: los sectores se recalculan con los tipos marcados (la API informa el
   * universo completo). `asignables` excluye los casos que ya van con su masiva,
   * porque esos no dependen del sector.
   */
  const sectores = useMemo(
    () =>
      sectoresBase
        .map((s) => {
          const propios = casosSeleccionados.filter((c) => c.id_sector === s.id_sector);
          const asignables = propios.filter(
            (c) => !c.en_gestion && cuadrillaPorCaso[c.id_caso] === undefined,
          ).length;
          return {
            ...s,
            total: propios.length,
            asignables,
            especiales: propios.filter((c) => c.especial).length,
            citados: propios.filter((c) => c.es_cita).length,
          };
        })
        .filter((s) => s.total > 0),
    [sectoresBase, casosSeleccionados, cuadrillaPorCaso],
  );

  const bloques: AsignacionBloque[] = useMemo(
    () =>
      cuadrillas.map((c) => ({
        id_cuadrilla: c.id_cuadrilla,
        ids_sector: sectoresBase
          .filter((s) => asignacion[s.id_sector] === c.id_cuadrilla)
          .map((s) => s.id_sector),
      })),
    [cuadrillas, sectoresBase, asignacion],
  );

  const totalPorCuadrilla = useMemo(() => {
    const mapa: Record<number, number> = {};
    for (const c of casosSeleccionados) {
      const idc = destinoDe(c);
      if (idc !== null) mapa[idc] = (mapa[idc] ?? 0) + 1;
    }
    return mapa;
  }, [casosSeleccionados, destinoDe]);

  const visibles = casosUniverso.filter((c) =>
    filtro === 'TODOS' ? true : filtro === 'ESPECIALES' ? c.especial : !c.especial,
  );
  // Un sector solo es obligatorio si tiene casos que dependen de él.
  const sectoresQueFaltan = sectores.filter(
    (s) => s.asignables > 0 && (asignacion[s.id_sector] === null || asignacion[s.id_sector] === undefined),
  );
  const sinDestino = casosSeleccionados.filter((c) => destinoDe(c) === null).length;
  // D-99 (RF-67): en el primer procesamiento de la jornada hay que asignar los
  // sectores antes de procesar; en un reproceso la reasignación es por sector.
  const primeraVez = proceso?.primera_vez ?? false;
  const reproceso = proceso?.reproceso ?? false;
  const faltanSectores = primeraVez && sectoresQueFaltan.length > 0;
  const masivasPorCuadrilla = useMemo(() => {
    const mapa: Record<number, { id_falla: number; descripcion: string }[]> = {};
    for (const m of masivasActivas) {
      const destino = masivas[m.id_falla];
      if (destino === null || destino === undefined) continue;
      (mapa[destino] ??= []).push({ id_falla: m.id_falla, descripcion: m.descripcion });
    }
    return mapa;
  }, [masivasActivas, masivas]);

  /** D-113: alterna un tipo conservando el orden canónico del checklist. */
  function alternarTipo(clave: string, marcado: boolean) {
    const orden = (proceso?.tipos ?? []).map((t) => t.clave);
    const conjunto = new Set(tipos);
    if (marcado) conjunto.add(clave);
    else conjunto.delete(clave);
    setTipos(
      orden.length
        ? orden.filter((c) => conjunto.has(c))
        : Array.from(conjunto),
    );
  }

  function cambiarMasiva(idFalla: number, valor: string) {
    setMasivas((previo) => ({
      ...previo,
      [idFalla]: valor === '' ? null : Number(valor),
    }));
  }

  const sinTipos = tipos.length === 0;
  const sinCasos = !cargando && casosSeleccionados.length === 0;
  const puedeProcesar =
    !procesando && !faltanSectores && !sinTipos && !sinCasos && casosUniverso.length > 0;

  async function procesar() {
    setProcesando(true);
    setError('');
    try {
      const masivasPayload: AsignacionMasiva[] = masivasActivas.map((m) => ({
        id_falla: m.id_falla,
        id_cuadrilla: masivas[m.id_falla] ?? null,
      }));
      const creados = await api.procesarDespacho({
        fecha,
        asignaciones: bloques,
        tipos,
        masivas: masivasPayload,
        reemplazar: true,
      });
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
          {/* D-99 (RF-67/RF-68): el paso que toca en esta jornada. */}
          <div className={`aviso ${primeraVez ? 'aviso-info' : 'aviso-ok'}`}>
            <span>
              {primeraVez ? (
                <>
                  <strong>Primer procesamiento de la jornada.</strong> Asigne a cada
                  cuadrilla los sectores que va a cubrir: los casos se reparten según
                  el sector. Sin asignación, esos casos no se despachan.
                </>
              ) : (
                <>
                  <strong>Reproceso de la jornada.</strong> Los casos se vuelven a
                  asignar a las cuadrillas según el sector de cada una y se avisa a los
                  técnicos con el <strong>DESPACHO ACTUALIZADO</strong>.
                  {reproceso && ' Este despacho ya existía y se reemplaza.'}
                </>
              )}
            </span>
          </div>

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
            {/* D-113: cuántos de esos casos se van a distribuir con el checklist. */}
            <div className="ficha-tarjeta">
              <div className="etiqueta">A distribuir</div>
              <div className="valor">{casosSeleccionados.length}</div>
            </div>
          </div>

          {/* D-113: checklist de tipos a distribuir */}
          <h3 className="subtitulo-seccion">Tipos de casos a distribuir</h3>
          <div className="lista-casillas" id="tipos-a-distribuir">
            {(proceso?.tipos ?? []).map((t) => (
              <label className="casilla-fila" key={t.clave} htmlFor={`tipo-${t.clave}`}>
                <input
                  id={`tipo-${t.clave}`}
                  type="checkbox"
                  checked={tipos.includes(t.clave)}
                  onChange={(e) => alternarTipo(t.clave, e.target.checked)}
                />
                {t.etiqueta}
                <span className="chip">{t.total} caso(s)</span>
                {t.por_defecto && <span className="texto-pequeno">predeterminado</span>}
              </label>
            ))}
          </div>
          <p className="texto-pequeno">
            Predeterminado: <strong>Comunes y Referidos</strong>. Los tipos sin marcar no se
            distribuyen (quedan para otro procesamiento).
          </p>

          {sinTipos && (
            <div className="aviso aviso-error">
              <span>Marque al menos un tipo de caso para poder procesar el despacho.</span>
            </div>
          )}
          {sinCasos && !sinTipos && casosUniverso.length > 0 && (
            <div className="aviso aviso-info">
              <span>No hay casos en el universo para los tipos marcados.</span>
            </div>
          )}
          {casosUniverso.length === 0 && (
            <div className="aviso aviso-info">
              <span>
                No hay casos para despachar en esa fecha (ni pendientes del cierre de
                jornada).
              </span>
            </div>
          )}

          {/* D-113: fallas masivas y su cuadrilla (reasignable) */}
          {masivasActivas.length > 0 && (
            <>
              <h3 className="subtitulo-seccion">Fallas masivas y su cuadrilla</h3>
              <div className="tabla-envoltura">
                <table>
                  <thead>
                    <tr>
                      <th>Masiva</th>
                      <th>Descripción</th>
                      <th>Casos</th>
                      <th>Cuadrilla asignada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masivasActivas.map((m) => (
                      <tr key={m.id_falla}>
                        <td>
                          <span className="mono">#{m.id_falla}</span>{' '}
                          <span className="chip-masiva" title="Falla masiva">
                            <IconoMasiva className="icono-masiva" />
                            MASIVA
                          </span>
                        </td>
                        <td>{m.descripcion}</td>
                        <td>{m.casos ?? m.ids_caso?.length ?? 0}</td>
                        <td>
                          <select
                            aria-label={`Cuadrilla de la masiva ${m.id_falla}`}
                            value={masivas[m.id_falla] ?? ''}
                            onChange={(e) => cambiarMasiva(m.id_falla, e.target.value)}
                          >
                            <option value="">— Sin cuadrilla —</option>
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
              <p className="texto-pequeno">
                Al cambiar la cuadrilla de una masiva, sus casos se despachan a esa
                cuadrilla aunque su sector esté asignado a otra.
              </p>
            </>
          )}

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
                      <td>
                        <span className="chip">{etiquetaTipo(tipoDe(c))}</span>
                        {!tipos.includes(tipoDe(c)) && (
                          <span className="texto-pequeno"> · no se distribuye</span>
                        )}
                      </td>
                      <td>
                        {c.categoria}
                        {c.especial ? ' · especial' : ''}
                      </td>
                      <td>{c.estado_actual}{c.en_gestion ? ' · gestión' : ''}</td>
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
            <p className="vacio">No hay sectores con casos para los tipos marcados.</p>
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
                      {totalPorCuadrilla[c.id_cuadrilla] ?? 0} caso(s)
                    </div>
                    <p className="texto-pequeno">
                      {c.es_supervisor
                        ? 'Recibe los casos en gestión (sin sectores)'
                        : suyos.length === 0
                          ? 'Sin sectores asignados'
                          : suyos.map((s) => s.nombre ?? `#${s.id_sector}`).join(' · ')}
                    </p>
                    {/* D-99 (RF-71) · D-113: la masiva asignada se marca y se
                        puede cambiar desde la tabla de arriba. */}
                    {(masivasPorCuadrilla[c.id_cuadrilla] ?? []).map((m) => (
                      <span
                        className="chip-masiva"
                        key={m.id_falla}
                        title={m.descripcion}
                      >
                        <IconoMasiva className="icono-masiva" />
                        Masiva #{m.id_falla}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {faltanSectores && (
            <div className="aviso aviso-error">
              <span>
                Asigne todos los sectores antes del primer procesamiento de la jornada
                ({sectoresQueFaltan.length} pendiente(s)).
              </span>
            </div>
          )}

          {sinDestino > 0 && !faltanSectores && (
            <div className="aviso aviso-info">
              <span>
                {sinDestino} caso(s) de los tipos marcados quedarán sin cuadrilla:
                asigne su sector (los citados se colocan en la cuadrilla menos cargada).
              </span>
            </div>
          )}

          <div className="acciones-form">
            <button
              className="btn"
              type="button"
              onClick={() => void procesar()}
              disabled={!puedeProcesar}
            >
              {procesando
                ? 'Procesando…'
                : primeraVez
                  ? 'Procesar despacho'
                  : 'Reprocesar despacho'}
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
