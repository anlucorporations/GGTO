/**
 * Formulario flotante para PROCESAR el despacho (requisito de UI 6, ciclo D-66).
 *
 * Muestra, para la fecha elegida:
 *  - el **checklist de tipos a distribuir** (D-113 · D-114 · D-162): el proceso
 *    considera todo el universo del día —Comunes, Especiales Reparación,
 *    Especiales Construcción, Mantenimiento, Especiales Gobierno y Masivas— y ese
 *    es el predeterminado del formulario; el supervisor puede desmarcar lo que no
 *    quiera distribuir,
 *  - los **sectores** con su total de casos, los **especiales separados** en
 *    Reparación, Construcción y Gobierno (D-114) y una lista desplegable con
 *    las **masivas del sector** para decidir cuáles entran al despacho,
 *  - el **bloque de construcciones** (D-162 · punto 2): REFERIDOS, EMPRESAS y
 *    CONSTRUCCIONES van a una cuadrilla exclusiva, con el total del bloque, los
 *    casos desalojados y la nota de que las masivas son prioritarias,
 *  - las **cuadrillas** con los sectores asignados y el desglose de
 *    especiales, con la opción de modificar la asignación (selector por sector),
 *  - los botones **Procesar despacho** y **Cancelar**.
 *
 * D-99 (RF-67 · RF-68): distingue el **primer procesamiento de la jornada** —en el
 * que la asignación de sectores a las cuadrillas es obligatoria— del **reproceso**,
 * en el que los casos se reasignan según el sector de cada cuadrilla y se avisa a
 * los técnicos con el DESPACHO ACTUALIZADO.
 *
 * D-113: los **casos PENDIENTES** que devolvió el cierre de jornada también
 * entran en el proceso (el backend los incluye aunque sigan vinculados a un
 * despacho ya cerrado).
 *
 * D-114: se elimina la sección «Universo de casos» —el detalle de casos ya no
 * se lista aquí— y los **especiales** dejan de ser un concepto único: el
 * resumen, la tabla de sectores y las tarjetas de cuadrillas muestran
 * Especiales Reparación, Construcción y Gobierno por separado. Cada sector
 * elige con una lista desplegable qué **masivas suyas** se incluyen en el
 * despacho; las no marcadas quedan fuera del proceso.
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

/** D-113 · D-162: selección del checklist cuando la API no la informa.
 *
 * D-162 · punto 1: el proceso considera **todo** el universo del día —la
 * reparación de la ingesta, el mantenimiento y los especiales— y D-162 · punto 4
 * añade las **masivas**, que son prioritarias. El meta del backend manda; este
 * arreglo solo cubre el caso de que la API no devuelva `tipos`.
 */
const TIPOS_POR_DEFECTO = [
  'COMUNES',
  'ESPECIALES_REPARACION',
  'ESPECIALES_CONSTRUCCION',
  'MANTENIMIENTO',
  'ESPECIALES_GOBIERNO',
  'MASIVAS',
];

/** D-162: etiquetas del checklist por defecto (fallback del texto de ayuda). */
const ETIQUETAS_POR_DEFECTO =
  'Comunes, Especiales Reparación, Especiales Construcción, Mantenimiento, Especiales Gobierno y Masivas';

/** D-114: tipos del checklist del caso (Gobierno suma a su actividad). */
function tiposDe(caso: CasoAsignadoOut): string[] {
  if (caso.tipos_distribucion?.length) return caso.tipos_distribucion;
  return [caso.tipo_distribucion ?? 'COMUNES'];
}

/** D-114: conteo de especiales por concepto en un conjunto de casos. */
function contarEspeciales(casos: CasoAsignadoOut[]) {
  let reparacion = 0;
  let construccion = 0;
  let gobierno = 0;
  for (const caso of casos) {
    const tipos = tiposDe(caso);
    if (tipos.includes('ESPECIALES_REPARACION')) reparacion += 1;
    if (tipos.includes('ESPECIALES_CONSTRUCCION')) construccion += 1;
    if (tipos.includes('ESPECIALES_GOBIERNO')) gobierno += 1;
  }
  return { reparacion, construccion, gobierno };
}

export default function ProcesarDespacho({ fecha, onCerrar, onProcesado }: Props) {
  const [proceso, setProceso] = useState<ProcesoDespachoOut | null>(null);
  const [asignacion, setAsignacion] = useState<Record<number, number | null>>({});
  /** D-113: tipos marcados en el checklist. */
  const [tipos, setTipos] = useState<string[]>(TIPOS_POR_DEFECTO);
  /** D-113: `id_falla -> id_cuadrilla` elegido para cada masiva. */
  const [masivas, setMasivas] = useState<Record<number, number | null>>({});
  /** D-114: `id_falla -> incluida`; lo controla la lista desplegable del sector. */
  const [masivasIncluidas, setMasivasIncluidas] = useState<Record<number, boolean>>({});
  /** D-143: cuadrilla que atiende **toda** la construcción (una sola). */
  const [construccionCuadrilla, setConstruccionCuadrilla] = useState<number | null>(null);
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
      // D-113: el predeterminado (Comunes y Especiales Reparación) lo declara la API.
      const meta = datos.tipos ?? [];
      setTipos(
        meta.length
          ? meta.filter((t) => t.por_defecto).map((t) => t.clave)
          : TIPOS_POR_DEFECTO,
      );
      setMasivas(
        Object.fromEntries(datos.masivas.map((m) => [m.id_falla, m.id_cuadrilla ?? null])),
      );
      // D-114: todas las masivas del sector arrancan incluidas en el despacho.
      setMasivasIncluidas(
        Object.fromEntries(datos.masivas.map((m) => [m.id_falla, m.incluida ?? true])),
      );
      // D-143: la construcción arranca con la cuadrilla que sugiere el servidor.
      setConstruccionCuadrilla(datos.construccion?.id_cuadrilla ?? null);
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo cargar el proceso de despacho.');
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

  /** D-114: masivas asociadas a un sector (por `id_sector` del backend). */
  const masivasDelSector = useCallback(
    (idSector: number) => masivasActivas.filter((m) => m.id_sector === idSector),
    [masivasActivas],
  );

  /** D-114: `id_caso -> [id_falla]` para saber si su masiva quedó incluida. */
  const masivasPorCaso = useMemo(() => {
    const mapa: Record<number, number[]> = {};
    for (const m of masivasActivas) {
      for (const idCaso of m.ids_caso ?? []) (mapa[idCaso] ??= []).push(m.id_falla);
    }
    return mapa;
  }, [masivasActivas]);

  /** D-114: un caso entra si su masiva está incluida (o no pertenece a ninguna). */
  const incluidoPorMasiva = useCallback(
    (caso: CasoAsignadoOut) => {
      const fallas = masivasPorCaso[caso.id_caso];
      if (!fallas?.length) return true;
      return fallas.some((idFalla) => masivasIncluidas[idFalla] !== false);
    },
    [masivasPorCaso, masivasIncluidas],
  );

  /** D-113: casos del universo que el checklist manda distribuir (D-114: y cuya
   * masiva el sector no dejó fuera). */
  const casosSeleccionados = useMemo(
    () =>
      casosUniverso.filter(
        (c) => tiposDe(c).some((t) => tipos.includes(t)) && incluidoPorMasiva(c),
      ),
    [casosUniverso, tipos, incluidoPorMasiva],
  );

  /** D-113: cuadrilla forzada por la masiva de cada caso asociado. */
  const cuadrillaPorCaso = useMemo(() => {
    const mapa: Record<number, number> = {};
    for (const m of masivasActivas) {
      // D-114: una masiva que el sector no incluyó no fuerza la cuadrilla.
      if (masivasIncluidas[m.id_falla] === false) continue;
      const destino = masivas[m.id_falla];
      if (destino === null || destino === undefined) continue;
      for (const idCaso of m.ids_caso ?? []) mapa[idCaso] = destino;
    }
    return mapa;
  }, [masivasActivas, masivas, masivasIncluidas]);

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
   * D-113 · D-114: los sectores se recalculan con los tipos marcados y con las
   * masivas incluidas (la API informa el universo completo). `asignables`
   * excluye los casos que ya van con su masiva, porque esos no dependen del sector.
   */
  const sectores = useMemo(
    () =>
      sectoresBase
        .map((s) => {
          const propios = casosSeleccionados.filter((c) => c.id_sector === s.id_sector);
          const asignables = propios.filter(
            (c) => !c.en_gestion && cuadrillaPorCaso[c.id_caso] === undefined,
          ).length;
          const especiales = contarEspeciales(propios);
          return {
            ...s,
            total: propios.length,
            asignables,
            especiales: propios.filter((c) => c.especial).length,
            especiales_reparacion: especiales.reparacion,
            especiales_construccion: especiales.construccion,
            especiales_gobierno: especiales.gobierno,
            citados: propios.filter((c) => c.es_cita).length,
          };
        })
        .filter((s) => s.total > 0 || masivasDelSector(s.id_sector).length > 0),
    [sectoresBase, casosSeleccionados, cuadrillaPorCaso, masivasDelSector],
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

  /** D-114: resumen principal con los especiales separados. */
  const resumenPrincipal = useMemo(() => {
    const especiales = contarEspeciales(casosSeleccionados);
    return {
      // D-114: «Comunes» es el tipo del checklist (los casos de masiva van a
      // MASIVAS), no simplemente «todo lo que no es especial».
      comunes: casosSeleccionados.filter((c) => tiposDe(c).includes('COMUNES')).length,
      ...especiales,
      sinSector: casosSeleccionados.filter(
        (c) => c.id_sector === null || c.id_sector === undefined,
      ).length,
      total: casosSeleccionados.length,
    };
  }, [casosSeleccionados]);

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
      if (masivasIncluidas[m.id_falla] === false) continue;
      const destino = masivas[m.id_falla];
      if (destino === null || destino === undefined) continue;
      (mapa[destino] ??= []).push({ id_falla: m.id_falla, descripcion: m.descripcion });
    }
    return mapa;
  }, [masivasActivas, masivas, masivasIncluidas]);

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

  /** D-114: incluye o excluye del despacho las masivas marcadas en un sector. */
  function cambiarMasivasDelSector(idSector: number, valores: string[]) {
    const opciones = masivasDelSector(idSector);
    const elegidas = new Set(valores.map(Number));
    setMasivasIncluidas((previo) => {
      const nuevo = { ...previo };
      for (const m of opciones) nuevo[m.id_falla] = elegidas.has(m.id_falla);
      return nuevo;
    });
  }

  /** D-114: total de un tipo en el universo, descontando las masivas excluidas. */
  function totalTipo(clave: string) {
    return casosUniverso.filter(
      (c) => incluidoPorMasiva(c) && tiposDe(c).includes(clave),
    ).length;
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
        incluida: masivasIncluidas[m.id_falla] !== false,
      }));
      const creados = await api.procesarDespacho({
        fecha,
        asignaciones: bloques,
        tipos,
        masivas: masivasPayload,
        // D-143: toda la construcción a la cuadrilla elegida.
        construccion_cuadrilla: construccionCuadrilla,
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
        <p className="texto-pequeno">Cargando el proceso de despacho…</p>
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

          {/* D-114: resumen principal con los especiales separados. */}
          <div className="ficha-tarjetas">
            <div className="ficha-tarjeta">
              <div className="etiqueta">Comunes</div>
              <div className="valor">{resumenPrincipal.comunes}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Especiales Reparación</div>
              <div className="valor">{resumenPrincipal.reparacion}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Especiales Construcción</div>
              <div className="valor">{resumenPrincipal.construccion}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Especiales Gobierno</div>
              <div className="valor">{resumenPrincipal.gobierno}</div>
            </div>
            <div className="ficha-tarjeta">
              <div className="etiqueta">Sin sector</div>
              <div className="valor">{resumenPrincipal.sinSector}</div>
            </div>
            {/* D-113: cuántos de esos casos se van a distribuir con el checklist. */}
            <div className="ficha-tarjeta">
              <div className="etiqueta">A distribuir</div>
              <div className="valor">{resumenPrincipal.total}</div>
            </div>
          </div>

          {/* D-113 · D-114: checklist de tipos a distribuir */}
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
                <span className="chip">{totalTipo(t.clave)} caso(s)</span>
                {t.por_defecto && <span className="texto-pequeno">predeterminado</span>}
              </label>
            ))}
          </div>
          <p className="texto-pequeno">
            Predeterminado:{' '}
            <strong>
              {(proceso?.tipos ?? [])
                .filter((t) => t.por_defecto)
                .map((t) => t.etiqueta)
                .join(', ') || ETIQUETAS_POR_DEFECTO}
            </strong>
            . Los tipos sin marcar no se distribuyen (quedan para otro procesamiento).
          </p>

          {/* D-162 · puntos 3 y 4: reglas del proceso completo que el supervisor
              debe conocer antes de procesar. El backend las informa en `reglas`. */}
          {(proceso?.reglas.masivas_prioritarias ||
            proceso?.reglas.mantenimientos_por_sector) && (
            <div className="aviso aviso-info" id="reglas-proceso-d162">
              <span>
                {proceso?.reglas.masivas_prioritarias && (
                  <>
                    <strong>Masivas prioritarias:</strong> las averías masivas van
                    primero en el orden de visita de cada cuadrilla. Posteriormente
                    se atienden los citados y el resto por sector.{' '}
                  </>
                )}
                {proceso?.reglas.mantenimientos_por_sector && (
                  <>
                    <strong>Mantenimiento por sector:</strong> se reparte a la
                    cuadrilla asignada al sector de cada caso; no tiene bloque propio
                    como la construcción.
                  </>
                )}
              </span>
            </div>
          )}

          {sinTipos && (
            <div className="aviso aviso-error">
              <span>Marque al menos un tipo de caso para poder procesar el despacho.</span>
            </div>
          )}
          {sinCasos && !sinTipos && casosUniverso.length > 0 && (
            <div className="aviso aviso-info">
              <span>No hay casos para los tipos marcados.</span>
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

          {/* D-114: sectores con sus especiales separados y sus masivas */}
          <h3 className="subtitulo-seccion">Sectores y cuadrilla asignada</h3>
          {sectores.length === 0 ? (
            <p className="vacio">No hay sectores con casos para los tipos marcados.</p>
          ) : (
            <>
              <div className="tabla-envoltura">
                <table>
                  <thead>
                    <tr>
                      <th>Sector</th>
                      <th>Casos</th>
                      <th>Esp. Reparación</th>
                      <th>Esp. Construcción</th>
                      <th>Esp. Gobierno</th>
                      <th>Citados</th>
                      <th>Cuadrilla asignada</th>
                      <th>Masivas del sector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectores.map((s) => {
                      const opciones = masivasDelSector(s.id_sector);
                      const elegidas = opciones
                        .filter((m) => masivasIncluidas[m.id_falla] !== false)
                        .map((m) => String(m.id_falla));
                      return (
                        <tr key={s.id_sector}>
                          <td>{s.nombre ?? `Sector #${s.id_sector}`}</td>
                          <td>{s.total}</td>
                          <td>{s.especiales_reparacion}</td>
                          <td>{s.especiales_construccion}</td>
                          <td>{s.especiales_gobierno}</td>
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
                          <td>
                            {opciones.length === 0 ? (
                              <span className="texto-pequeno">—</span>
                            ) : (
                              <select
                                className="selector-masivas"
                                multiple
                                size={Math.min(Math.max(opciones.length, 2), 4)}
                                aria-label={`Masivas para ${s.nombre ?? `sector ${s.id_sector}`}`}
                                value={elegidas}
                                onChange={(e) =>
                                  cambiarMasivasDelSector(
                                    s.id_sector,
                                    Array.from(e.target.selectedOptions, (o) => o.value),
                                  )
                                }
                              >
                                {opciones.map((m) => (
                                  <option key={m.id_falla} value={m.id_falla}>
                                    {m.id_falla} — {m.descripcion} ({m.casos ?? 0})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="texto-pequeno">
                En <strong>Masivas del sector</strong>, use Ctrl (o ⌘ en Mac) para marcar
                varias: las masivas marcadas entran al despacho; las demás quedan fuera
                de este procesamiento.
              </p>
            </>
          )}

          {/* D-143 · D-162 · punto 2: la CONSTRUCCIÓN se procesa aparte, con sus
              sectores y una sola cuadrilla para todo el bloque. El «bloque de
              construcciones» suma REFERIDOS, EMPRESAS y CONSTRUCCIONES, y la
              cuadrilla que lo atiende queda exclusiva (sin reparaciones ni
              mantenimiento): los casos desalojados se informan aquí. */}
          <h3 className="subtitulo-seccion">Construcción (se procesa aparte)</h3>
          {(() => {
            const construccion = proceso?.construccion;
            const totalConstruccion = construccion?.total ?? 0;
            // D-162 · punto 2: el bloque completo puede superar el tipo CONSTRUCCIÓN
            // (incluye REFERIDOS y EMPRESAS); con solo la construcción se perdía.
            const bloqueTotal = construccion?.bloque_total ?? totalConstruccion;
            const desalojados = construccion?.desalojados ?? 0;
            const excluyeReparaciones = construccion?.excluye_reparaciones ?? false;
            const incluidaEnChecklist =
              tipos.includes('COMUNES') || tipos.includes('ESPECIALES_CONSTRUCCION');
            if (bloqueTotal === 0 && totalConstruccion === 0) {
              return (
                <p className="vacio">
                  No hay construcciones para esa fecha. El bloque queda vacío y no se
                  asigna ninguna cuadrilla.
                </p>
              );
            }
            return (
              <div className="panel-construccion" id="proceso-construccion">
                <div className="ficha-tarjetas">
                  <div className="ficha-tarjeta">
                    <div className="etiqueta">Bloque de construcciones</div>
                    <div className="valor">{bloqueTotal}</div>
                    <p className="texto-pequeno">Construcciones + referidos + empresas</p>
                  </div>
                  <div className="ficha-tarjeta">
                    <div className="etiqueta">Construcciones (tipo)</div>
                    <div className="valor">{totalConstruccion}</div>
                    <p className="texto-pequeno">Casos del tipo CONSTRUCCIÓN</p>
                  </div>
                  <div className="ficha-tarjeta">
                    <div className="etiqueta">Excluye reparaciones</div>
                    <div className="valor">{excluyeReparaciones ? 'Sí' : 'No'}</div>
                    <p className="texto-pequeno">Cuadrilla exclusiva del bloque</p>
                  </div>
                  <div className="ficha-tarjeta">
                    <div className="etiqueta">Desalojados</div>
                    <div className="valor">{desalojados}</div>
                    <p className="texto-pequeno">Reparaciones/mantenimiento a otra cuadrilla</p>
                  </div>
                </div>
                <div className="tabla-envoltura">
                  <table>
                    <thead>
                      <tr>
                        <th>Sector</th>
                        <th>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(construccion?.por_sector ?? []).map((s) => (
                        <tr key={s.id_sector}>
                          <td>{s.nombre ?? `Sector #${s.id_sector}`}</td>
                          <td>{s.cantidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="texto-pequeno">
                  La tabla cuenta solo las construcciones del tipo CONSTRUCCIÓN; el
                  bloque completo incluye además los <strong>referidos</strong> y las{' '}
                  <strong>empresas</strong> del día.
                </p>
                <label className="casilla-fila" htmlFor="construccion-cuadrilla">
                  Cuadrilla que atiende toda la construcción
                  <select
                    id="construccion-cuadrilla"
                    aria-label="Cuadrilla que atiende toda la construcción"
                    value={construccionCuadrilla ?? ''}
                    onChange={(e) =>
                      setConstruccionCuadrilla(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">— Sin asignar (regla automática) —</option>
                    {cuadrillasCalle.map((c) => (
                      <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
                        {c.codigo} — {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="texto-pequeno">
                  Todo el bloque de construcciones va a la cuadrilla elegida, aunque sus
                  sectores estén asignados a otra. Sin elección, se usa la regla
                  automática (la cuadrilla con más sectores de construcción).
                </p>
                {excluyeReparaciones ? (
                  <div className="aviso aviso-info" id="construccion-exclusiva-d162">
                    <span>
                      <strong>La cuadrilla de construcción queda exclusiva:</strong> no
                      recibe reparaciones ni mantenimiento y los casos que le tocaban se
                      desalojan a otra cuadrilla. Las <strong>masivas se conservan</strong>{' '}
                      porque son prioritarias.
                    </span>
                  </div>
                ) : (
                  <p className="texto-pequeno">
                    La exclusividad de la cuadrilla es automática; con una sola cuadrilla
                    de calle no se puede aplicar y esos casos se citan.
                  </p>
                )}
                {desalojados > 0 && (
                  <p className="texto-pequeno" id="construccion-desalojados-d162">
                    Se desalojaron <strong>{desalojados}</strong> caso(s) de
                    reparación/mantenimiento de la cuadrilla de construcción.
                  </p>
                )}
                {!incluidaEnChecklist && (
                  <div className="aviso aviso-info">
                    <span>
                      La construcción está fuera del checklist: marque{' '}
                      <strong>Comunes</strong> (o Especiales Construcción) para que se
                      distribuya.
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Cuadrillas con sus sectores asignados y el desglose de especiales */}
          <h3 className="subtitulo-seccion">Cuadrillas y sectores asignados</h3>
          {cuadrillas.length === 0 ? (
            <p className="vacio">No hay cuadrillas activas de calle.</p>
          ) : (
            <div className="ficha-tarjetas">
              {cuadrillas.map((c) => {
                const suyos = sectores.filter((s) => asignacion[s.id_sector] === c.id_cuadrilla);
                const desglose = suyos.reduce(
                  (total, s) => ({
                    reparacion: total.reparacion + s.especiales_reparacion,
                    construccion: total.construccion + s.especiales_construccion,
                    gobierno: total.gobierno + s.especiales_gobierno,
                  }),
                  { reparacion: 0, construccion: 0, gobierno: 0 },
                );
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
                    <p className="texto-pequeno">
                      Especiales: {desglose.reparacion} reparación ·{' '}
                      {desglose.construccion} construcción · {desglose.gobierno} gobierno
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
