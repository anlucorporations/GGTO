import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import * as api from '../api/client';
import type {
  CanalDespacho,
  CasoAsignadoOut,
  DespachoDetalleOut,
  EnvioOut,
  EstadoDespachoCaso,
  EstadoDespacho,
  FilaProduccionOut,
  NotificacionOut,
  PropuestaOut,
  RankingEfectividadOut,
  ReporteProduccionOut,
  SeguimientoConstruccionOut,
  TipoAsignacionDespacho,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import ProcesarDespacho from '../components/ProcesarDespacho';
import {
  IconoConstruccion,
  IconoEmpresa,
  IconoReferido,
  IconoReparacion,
} from '../components/Iconos';
import { GraficoTorta, type PorcionTorta } from '../components/graficos';
import { IconoMasiva } from '../masivas/registro';
import { useAuth } from '../auth/AuthContext';
import { fecha } from '../utils';

const ESTADOS_CASO: EstadoDespachoCaso[] = [
  'ASIGNADO',
  'GESTIONADO',
  'CERRADO',
  'CITADO',
  'DIFERIDO',
];

const TIPOS_ASIGNACION: TipoAsignacionDespacho[] = [
  'REPARACION',
  'CONSTRUCCION',
  'REFERIDO',
  'EMPRESA',
  'FALLA_MASIVA',
];

const TOTALES_ETIQUETAS: { clave: string; etiqueta: string }[] = [
  { clave: 'asignados', etiqueta: 'Asignados' },
  { clave: 'abiertos', etiqueta: 'Abiertos' },
  { clave: 'cerrados', etiqueta: 'Cerrados' },
  { clave: 'enrutado', etiqueta: 'Enrutado' },
  { clave: 'citados', etiqueta: 'Citados' },
  { clave: 'diferidos', etiqueta: 'Diferidos' },
  { clave: 'gestionados', etiqueta: 'Gestionados' },
  { clave: 'referidos', etiqueta: 'Referidos' },
  { clave: 'empresas', etiqueta: 'Empresas' },
];

/**
 * Desglose de los casos de un despacho por tipo de asignación (D-110).
 *
 * La columna **Casos** de la ficha del día muestra el total de
 * **Reparaciones Comunes + Reparaciones Referidas + Construcciones** con un icono
 * por tipo; los casos empresariales y de falla masiva, si los hay, se informan
 * aparte para que el total del despacho nunca oculte trabajo.
 */
export interface ConteoCasosTipo {
  comunes: number;
  referidos: number;
  construcciones: number;
  empresas: number;
  masivas: number;
  /** Total de los tres tipos que pide la operación. */
  total: number;
  /** Total real del despacho (incluye empresas y masivas). */
  totalDespacho: number;
}

export function conteoPorTipo(casos: DespachoDetalleOut['casos']): ConteoCasosTipo {
  const contar = (tipo: TipoAsignacionDespacho) =>
    casos.filter((c) => c.tipo_asignacion === tipo).length;
  const comunes = contar('REPARACION');
  const referidos = contar('REFERIDO');
  const construcciones = contar('CONSTRUCCION');
  const empresas = contar('EMPRESA');
  const masivas = contar('FALLA_MASIVA');
  return {
    comunes,
    referidos,
    construcciones,
    empresas,
    masivas,
    total: comunes + referidos + construcciones,
    totalDespacho: casos.length,
  };
}

/**
 * Celda de la columna **Casos**: total de comunes, referidos y construcciones,
 * cada uno con su icono (y los «otros» aparte).
 */
export function CeldaCasosPorTipo({ casos }: { casos: DespachoDetalleOut['casos'] }) {
  const conteo = conteoPorTipo(casos);
  const otros = conteo.empresas + conteo.masivas;
  return (
    <div className="celda-casos-tipo" id="celda-casos-tipo">
      <span
        className="caso-tipo caso-tipo-reparacion"
        title={`Reparaciones comunes: ${conteo.comunes}`}
        aria-label={`Reparaciones comunes: ${conteo.comunes}`}
      >
        <IconoReparacion />
        {conteo.comunes}
      </span>
      <span
        className="caso-tipo caso-tipo-referido"
        title={`Reparaciones referidas: ${conteo.referidos}`}
        aria-label={`Reparaciones referidas: ${conteo.referidos}`}
      >
        <IconoReferido />
        {conteo.referidos}
      </span>
      <span
        className="caso-tipo caso-tipo-construccion"
        title={`Construcciones: ${conteo.construcciones}`}
        aria-label={`Construcciones: ${conteo.construcciones}`}
      >
        <IconoConstruccion />
        {conteo.construcciones}
      </span>
      <strong className="caso-total" title={`Total: ${conteo.total}`}>
        {conteo.total}
      </strong>
      {otros > 0 && (
        <span
          className="caso-tipo caso-tipo-otros"
          title={`Otros: ${conteo.empresas} empresa(s), ${conteo.masivas} de falla masiva`}
        >
          <IconoEmpresa />
          {otros}
        </span>
      )}
    </div>
  );
}

/**
 * Cumplimiento del despacho en un aro (D-99 · RF-70).
 *
 * Las cinco porciones son las que pidió el negocio: ABIERTOS, CERRADOS,
 * ENRUTADO, DIFERIDO y CITADOS. El centro del aro muestra el **porcentaje de
 * cumplimiento** (cerrados / asignados) y la leyenda, los valores absolutos.
 */
const PORCIONES_CUMPLIMIENTO = [
  { clave: 'cerrados', etiqueta: 'Cerrados', color: '#1f7a4d' },
  { clave: 'abiertos', etiqueta: 'Abiertos', color: '#0b4f9c' },
  { clave: 'enrutado', etiqueta: 'Enrutado', color: '#8a6100' },
  { clave: 'citados', etiqueta: 'Citados', color: '#0e7490' },
  { clave: 'diferidos', etiqueta: 'Diferido', color: '#b3261e' },
] as const;

function hoyISO(): string {
  const ahora = new Date();
  const desfase = ahora.getTimezoneOffset() * 60000;
  return new Date(ahora.getTime() - desfase).toISOString().slice(0, 10);
}

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function fechaHora(valor: string | null | undefined): string {
  return valor ? valor.replace('T', ' ').slice(0, 19) : '—';
}

function num(valor: unknown): number {
  return typeof valor === 'number' ? valor : 0;
}

function txt(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  return String(valor);
}

/** Regla booleana de la propuesta (`true`/`false`); `undefined` si no aplica. */
function reglaBooleana(reglas: Record<string, unknown>, clave: string): boolean | undefined {
  const valor = reglas[clave];
  return typeof valor === 'boolean' ? valor : undefined;
}

function TablaCasosAsignados({ casos }: { casos: CasoAsignadoOut[] }) {
  if (casos.length === 0) return <p className="vacio">Sin casos asignados.</p>;
  return (
    <div className="tabla-envoltura">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>ID avería</th>
            <th>Sector</th>
            <th>Dirección</th>
            <th>Cliente</th>
            <th>Identificador de pago (70*)</th>
            <th>Tipo asignación</th>
            <th>¿Cita?</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {casos.map((c) => (
            <tr key={c.id_caso}>
              <td>{c.orden_visita}</td>
              <td className="mono">{c.id_averia}</td>
              <td>{c.sector_nombre ?? c.id_sector ?? '—'}</td>
              <td>{c.direccion ?? '—'}</td>
              <td>{c.nombre_cliente ?? '—'}</td>
              <td>{c.telefono ?? '—'}</td>
              <td>{c.tipo_asignacion}</td>
              <td>{c.es_cita ? 'Sí' : 'No'}</td>
              <td>{c.estado_actual}</td>
            </tr>
          ))}
        </tbody>
        <PieTabla colSpan={9} total={casos.length} singular="caso" plural="casos" />
      </table>
    </div>
  );
}

function FilaDesglose({ fila }: { fila: FilaProduccionOut }) {
  return (
    <tr>
      <td>
        <span className="celda-cuadrilla">
          {fila.cuadrilla}
          {fila.es_masiva && (
            <span
              className="chip-masiva"
              title={
                fila.masivas?.length
                  ? `Falla masiva asignada: #${fila.masivas.join(', #')}`
                  : 'Falla masiva asignada'
              }
            >
              <IconoMasiva className="icono-masiva" />
              MASIVA
            </span>
          )}
        </span>
      </td>
      <td>{fila.nombre}</td>
      <td>{fila.asignados}</td>
      <td>{fila.abiertos}</td>
      <td>{fila.cerrados}</td>
      <td>{fila.enrutado}</td>
      <td>{fila.citados}</td>
      <td>{fila.diferidos}</td>
      <td>{fila.gestionados}</td>
      <td>{fila.referidos}</td>
      <td>{fila.empresas}</td>
      {/* D-143: la construcción se mide aparte. */}
      <td>{fila.construcciones ?? 0}</td>
      <td>{fila.construcciones_cerradas ?? 0}</td>
    </tr>
  );
}

/** Porcentaje de cumplimiento del despacho de una cuadrilla. */
function cumplimientoDe(fila: FilaProduccionOut): number {
  if (!fila.asignados) return 0;
  return Math.round((fila.cerrados / fila.asignados) * 100);
}

/**
 * Aro de cumplimiento de una cuadrilla (D-99 · RF-70).
 *
 * Sustituye al bloque de tarjetas: el negocio pidió ver el reparto ABIERTOS ·
 * CERRADOS · ENRUTADO · DIFERIDO · CITADOS de **cada** cuadrilla de un vistazo.
 */
function AroCumplimiento({ fila }: { fila: FilaProduccionOut }) {
  const porciones: PorcionTorta[] = PORCIONES_CUMPLIMIENTO.map((p) => ({
    etiqueta: p.etiqueta,
    valor: fila[p.clave],
    color: p.color,
  })).filter((p) => p.valor > 0);
  const cumplimiento = cumplimientoDe(fila);
  return (
    <div className="aro-cuadrilla">
      <div className="aro-cuadrilla-cabecera">
        <strong>{fila.cuadrilla}</strong>
        <span className="texto-pequeno">{fila.nombre}</span>
        {fila.es_masiva && (
          <span className="chip-masiva" title="Cuadrilla con falla masiva asignada">
            <IconoMasiva className="icono-masiva" />
            MASIVA
          </span>
        )}
      </div>
      {fila.asignados === 0 ? (
        <p className="vacio">Sin casos asignados.</p>
      ) : (
        <GraficoTorta porciones={porciones} centro={`${cumplimiento}%`} />
      )}
      <p className="texto-pequeno aro-cuadrilla-pie">
        {fila.cerrados} de {fila.asignados} cerrados · cumplimiento {cumplimiento}%
      </p>
    </div>
  );
}


/**
 * D-143: seguimiento **global** de construcciones.
 *
 * Mide cuántas construcciones se realizaron cada día (cerradas) sobre las
 * asignadas, para poder seguir la producción de construcción aparte del resto
 * del despacho. La serie y los totales los calcula el servidor.
 */
function SeguimientoConstrucciones() {
  const [datos, setDatos] = useState<SeguimientoConstruccionOut | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await api.seguimientoConstruccion({}));
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo cargar el seguimiento.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) return <p className="texto-pequeno">Cargando el seguimiento de construcciones…</p>;
  if (error) return <p className="aviso aviso-error">{error}</p>;
  if (!datos) return <p className="vacio">Sin datos de construcción.</p>;

  return (
    <div className="subpanel" id="seguimiento-construcciones">
      <div className="pagina-cabecera">
        <h3>Seguimiento de construcciones</h3>
        <button type="button" className="btn btn-secundario" onClick={() => void cargar()}>
          Recargar
        </button>
      </div>
      <p className="texto-pequeno">
        Del {fecha(datos.desde)} al {fecha(datos.hasta)}: construcciones asignadas y{' '}
        <strong>realizadas</strong> (cerradas) por día.
      </p>
      <div className="rejilla-tarjetas">
        <div className="tarjeta">
          <div className="valor">{num(datos.totales.asignadas)}</div>
          <div className="etiqueta">Construcciones asignadas</div>
        </div>
        <div className="tarjeta">
          <div className="valor">{num(datos.totales.cerradas)}</div>
          <div className="etiqueta">Construcciones realizadas</div>
        </div>
        <div className="tarjeta">
          <div className="valor">{num(datos.totales.abiertas)}</div>
          <div className="etiqueta">Pendientes</div>
        </div>
        <div className="tarjeta">
          <div className="valor">{num(datos.totales.sectores)}</div>
          <div className="etiqueta">Sectores con construcción</div>
        </div>
      </div>

      {datos.por_dia.length === 0 ? (
        <p className="vacio">No hay construcciones despachadas en el periodo.</p>
      ) : (
        <>
          <h4 className="subtitulo-seccion">Por día</h4>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Asignadas</th>
                  <th>Realizadas</th>
                  <th>Pendientes</th>
                </tr>
              </thead>
              <tbody>
                {datos.por_dia.map((dia) => (
                  <tr key={dia.fecha}>
                    <td>{fecha(dia.fecha)}</td>
                    <td>{dia.asignadas}</td>
                    <td>{dia.cerradas}</td>
                    <td>{dia.abiertas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="subtitulo-seccion">Por sector</h4>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Sector</th>
                  <th>Asignadas</th>
                  <th>Realizadas</th>
                </tr>
              </thead>
              <tbody>
                {datos.por_sector.map((s) => (
                  <tr key={s.id_sector ?? 'sin-sector'}>
                    <td>{s.nombre ?? 'Sin sector'}</td>
                    <td>{s.asignadas}</td>
                    <td>{s.cerradas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}


/**
 * D-146: efectividad y **ranking de cuadrillas**.
 *
 * Muestra el puntaje (0-100) con sus componentes y los conteos crudos para que el
 * número se pueda explicar: cierre 45 %, oportunidad 25 %, calidad con evidencia
 * 20 % y ausencia de reaperturas 10 %.
 */
function RankingEfectividad() {
  const [datos, setDatos] = useState<RankingEfectividadOut | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [dias, setDias] = useState(30);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const hasta = new Date();
      const desde = new Date(hasta.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      setDatos(
        await api.efectividadCuadrillas({ desde: iso(desde), hasta: iso(hasta) }),
      );
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo cargar el ranking.');
    } finally {
      setCargando(false);
    }
  }, [dias]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filas = datos?.ranking ?? [];

  return (
    <div className="subpanel" id="ranking-efectividad">
      <div className="pagina-cabecera">
        <h3>Efectividad y ranking de cuadrillas</h3>
        <div className="acciones-form">
          <label className="texto-pequeno" htmlFor="ranking-dias">
            Periodo
          </label>
          <select
            id="ranking-dias"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
          >
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>
                Últimos {d} días
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-secundario" onClick={() => void cargar()}>
            Recargar
          </button>
        </div>
      </div>

      {cargando && <p className="texto-pequeno">Calculando la efectividad…</p>}
      {error && <p className="aviso aviso-error">{error}</p>}

      {!cargando && datos && (
        <>
          <p className="texto-pequeno">
            Del {fecha(datos.desde)} al {fecha(datos.hasta)}. El puntaje pesa{' '}
            <strong>cierre {Math.round((datos.pesos.cierre ?? 0) * 100)} %</strong>,{' '}
            <strong>oportunidad {Math.round((datos.pesos.oportunidad ?? 0) * 100)} %</strong>{' '}
            (cerrado en {datos.dias_oportunidad} día(s) o menos),{' '}
            <strong>calidad {Math.round((datos.pesos.calidad ?? 0) * 100)} %</strong> (con
            evidencia) y{' '}
            <strong>sin reapertura {Math.round((datos.pesos.reapertura ?? 0) * 100)} %</strong>.
            Las cuadrillas con menos de {datos.minimo_muestras} asignaciones se informan sin
            posición.
          </p>

          {filas.length === 0 ? (
            <p className="vacio">No hay cuadrillas con despachos en el periodo.</p>
          ) : (
            <div className="tabla-envoltura">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cuadrilla</th>
                    <th title="Puntaje de 0 a 100">Efectividad</th>
                    <th>Cerrados / asignados</th>
                    <th title="Cerrados dentro del plazo">Oportunidad</th>
                    <th title="Cerrados con evidencia fotográfica">Calidad</th>
                    <th title="Casos devueltos por el cierre de jornada">Devueltos</th>
                    <th title="Casos reabiertos tras cerrarse">Reaperturas</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id_cuadrilla}>
                      <td>{f.posicion ?? '—'}</td>
                      <td>
                        {f.codigo} — {f.nombre}
                        {!f.muestra_suficiente && (
                          <span className="chip" title="Pocos casos para comparar">
                            muestra baja
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="ranking-puntaje">
                          <span className={`estado-cuenta ranking-${f.etiqueta.toLowerCase()}`}>
                            {f.puntaje.toFixed(1)}
                          </span>
                          <span className="texto-pequeno">{f.etiqueta}</span>
                        </div>
                        <div
                          className="ranking-barra"
                          role="img"
                          aria-label={`Efectividad ${f.puntaje} de 100`}
                        >
                          <span style={{ width: `${Math.max(0, Math.min(100, f.puntaje))}%` }} />
                        </div>
                      </td>
                      <td>
                        {f.cerrados} / {f.asignados}
                      </td>
                      <td>
                        {f.cerrados > 0
                          ? `${Math.round((f.en_plazo / f.cerrados) * 100)} %`
                          : '—'}
                      </td>
                      <td>
                        {f.cerrados > 0
                          ? `${Math.round((f.con_evidencia / f.cerrados) * 100)} %`
                          : '—'}
                      </td>
                      <td>{f.devueltos}</td>
                      <td>{f.reaperturas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Reporte({ titulo, reporte }: { titulo: string; reporte: ReporteProduccionOut }) {
  return (
    <div className="subpanel">
      <h3>
        {titulo} — {fecha(reporte.fecha)}
      </h3>
      <div className="rejilla-tarjetas">
        {TOTALES_ETIQUETAS.map((t) => (
          <div className="tarjeta" key={t.clave}>
            <div className="valor">{num(reporte.totales[t.clave])}</div>
            <div className="etiqueta">{t.etiqueta}</div>
          </div>
        ))}
      </div>

      {/* D-143: métrica aparte de construcción (asignadas y realizadas hoy). */}
      <div className="rejilla-tarjetas" id="metricas-construccion">
        <div className="tarjeta">
          <div className="valor">{num(reporte.totales.construcciones)}</div>
          <div className="etiqueta">Construcciones asignadas</div>
        </div>
        <div className="tarjeta">
          <div className="valor">{num(reporte.totales.construcciones_cerradas)}</div>
          <div className="etiqueta">Construcciones realizadas (cerradas)</div>
        </div>
      </div>

      {reporte.por_cuadrilla.length === 0 ? (
        <p className="vacio">Sin producción registrada.</p>
      ) : (
        <>
          {/* D-99 (RF-70): un aro de cumplimiento por cada cuadrilla. */}
          <h4 className="subtitulo-seccion">Cumplimiento por cuadrilla</h4>
          <div className="rejilla-aros">
            {reporte.por_cuadrilla.map((fila) => (
              <AroCumplimiento key={fila.cuadrilla} fila={fila} />
            ))}
          </div>

          <h4 className="subtitulo-seccion">Desglose</h4>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Cuadrilla</th>
                  <th>Nombre</th>
                  <th>Asignados</th>
                  <th>Abiertos</th>
                  <th>Cerrados</th>
                  <th>Enrutado</th>
                  <th>Citados</th>
                  <th>Diferidos</th>
                  <th>Gestionados</th>
                  <th>Referidos</th>
                  <th>Empresas</th>
                  <th title="Construcciones asignadas del día">Constr.</th>
                  <th title="Construcciones cerradas (realizadas) del día">Constr. cerr.</th>
                </tr>
              </thead>
              <tbody>
                {reporte.por_cuadrilla.map((fila) => (
                  <FilaDesglose key={`${fila.cuadrilla}-${fila.id_cuadrilla}`} fila={fila} />
                ))}
              </tbody>
              <PieTabla
                colSpan={13}
                total={reporte.por_cuadrilla.length}
                singular="cuadrilla"
                plural="cuadrillas"
              />
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Box Infos del despacho (D-99 · RF-68).
 *
 * Resume el despacho de un vistazo —cuántos casos tiene, cómo se reparten por
 * desenlace y el porcentaje de cumplimiento— y sustituye al cuadro de información
 * principal, que ahora se dispone en rejilla de datos.
 */
function BoxInfosDespacho({ despacho }: { despacho: DespachoDetalleOut }) {
  const contarEstado = (estado: EstadoDespachoCaso) =>
    despacho.casos.filter((c) => c.estado === estado).length;
  const total = despacho.casos.length;
  const cerrados = contarEstado('CERRADO');
  const citados = contarEstado('CITADO');
  const diferidos = contarEstado('DIFERIDO');
  const gestionados = contarEstado('GESTIONADO');
  const abiertos = total - cerrados - citados - diferidos - gestionados;
  const cumplimiento = total ? Math.round((cerrados / total) * 100) : 0;
  const masivos = despacho.casos.filter((c) => c.tipo_asignacion === 'FALLA_MASIVA').length;

  const conteo = conteoPorTipo(despacho.casos);
  const cajas: { etiqueta: string; valor: number; clase: string }[] = [
    { etiqueta: 'Casos', valor: total, clase: '' },
    { etiqueta: 'Abiertos', valor: abiertos, clase: 'box-info-abierto' },
    { etiqueta: 'Cerrados', valor: cerrados, clase: 'box-info-cerrado' },
    { etiqueta: 'Citados', valor: citados, clase: '' },
    { etiqueta: 'Diferidos', valor: diferidos, clase: '' },
    { etiqueta: 'Gestionados', valor: gestionados, clase: '' },
  ];
  return (
    <div className="box-infos">
      {cajas.map((caja) => (
        <div className={`box-info ${caja.clase}`.trim()} key={caja.etiqueta}>
          <span className="box-info-valor">{caja.valor}</span>
          <span className="box-info-etiqueta">{caja.etiqueta}</span>
        </div>
      ))}
      <div className="box-info box-info-destacado">
        <span className="box-info-valor">{cumplimiento}%</span>
        <span className="box-info-etiqueta">Cumplimiento</span>
      </div>
      {masivos > 0 && (
        <div className="box-info box-info-masiva">
          <span className="box-info-valor">
            <IconoMasiva className="icono-masiva" />
            {masivos}
          </span>
          <span className="box-info-etiqueta">Casos de masiva</span>
        </div>
      )}
      {/* D-110: el reparto por tipo, con los mismos iconos que la columna Casos. */}
      <div className="box-info box-info-tipos" id="box-info-tipos">
        <span className="box-info-valor">
          <CeldaCasosPorTipo casos={despacho.casos} />
        </span>
        <span className="box-info-etiqueta">Comunes · referidos · construcciones</span>
      </div>
    </div>
  );
}

export default function Despacho() {
  const { soloLectura } = useAuth();

  const [fechaSel, setFechaSel] = useState(hoyISO());
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Propuesta (RF-24).
  const [propuesta, setPropuesta] = useState<PropuestaOut | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [modalProcesar, setModalProcesar] = useState(false);

  // Despachos del día.
  const [despachos, setDespachos] = useState<DespachoDetalleOut[]>([]);
  const [cargandoDespachos, setCargandoDespachos] = useState(false);

  // Detalle del despacho seleccionado.
  const [seleccionado, setSeleccionado] = useState<DespachoDetalleOut | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [nuevoCaso, setNuevoCaso] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<TipoAsignacionDespacho | ''>('');
  const [nuevaObservacion, setNuevaObservacion] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [modalAgregarCaso, setModalAgregarCaso] = useState(false);

  // Envío y notificaciones (RF-10).
  const [canal, setCanal] = useState<CanalDespacho>('TELEGRAM');
  const [destinatario, setDestinatario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [envio, setEnvio] = useState<EnvioOut | null>(null);
  const [notificaciones, setNotificaciones] = useState<NotificacionOut[]>([]);
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(false);

  // Reportes (RF-27).
  const [reporteGlobal, setReporteGlobal] = useState<ReporteProduccionOut | null>(null);
  const [reporteSel, setReporteSel] = useState<ReporteProduccionOut | null>(null);

  const cargarDespachos = useCallback(async () => {
    setCargandoDespachos(true);
    try {
      const lista = await api.listarDespachos({ fecha: fechaSel });
      setDespachos(lista);
      setError('');
    } catch (e) {
      setDespachos([]);
      setError(detalleDe(e, 'Error al listar los despachos del día.'));
    } finally {
      setCargandoDespachos(false);
    }
  }, [fechaSel]);

  const cargarReporteGlobal = useCallback(async () => {
    try {
      setReporteGlobal(await api.reporteProduccion(fechaSel));
    } catch (e) {
      setReporteGlobal(null);
      setError(detalleDe(e, 'Error al obtener el reporte de producción.'));
    }
  }, [fechaSel]);

  useEffect(() => {
    void cargarDespachos();
    void cargarReporteGlobal();
  }, [cargarDespachos, cargarReporteGlobal]);

  // Al cambiar de fecha se descarta la propuesta y el detalle anteriores.
  useEffect(() => {
    setPropuesta(null);
    setSeleccionado(null);
    setModalAgregarCaso(false);
    setEnvio(null);
    setNotificaciones([]);
    setReporteSel(null);
  }, [fechaSel]);

  const cargarNotificaciones = useCallback(async (idDespacho: number) => {
    setCargandoNotificaciones(true);
    try {
      setNotificaciones(await api.listarNotificaciones(idDespacho));
    } catch (e) {
      setNotificaciones([]);
      setError(detalleDe(e, 'Error al listar las notificaciones del despacho.'));
    } finally {
      setCargandoNotificaciones(false);
    }
  }, []);

  const abrirDetalle = useCallback(
    async (idDespacho: number) => {
      setCargandoDetalle(true);
      setError('');
      setOk('');
      setEnvio(null);
      setModalAgregarCaso(false);
      try {
        const detalle = await api.obtenerDespacho(idDespacho);
        setSeleccionado(detalle);
        void cargarNotificaciones(idDespacho);
        try {
          setReporteSel(await api.reporteDespacho(idDespacho));
        } catch {
          setReporteSel(null);
        }
      } catch (e) {
        setSeleccionado(null);
        setError(detalleDe(e, 'Error al obtener el detalle del despacho.'));
      } finally {
        setCargandoDetalle(false);
      }
    },
    [cargarNotificaciones],
  );

  /** Cierra la ficha flotante del despacho (y cualquier modal dependiente). */
  function cerrarDetalle() {
    setSeleccionado(null);
    setModalAgregarCaso(false);
  }

  /** Abre el formulario flotante para agregar un caso al despacho abierto. */
  function abrirModalAgregarCaso() {
    setError('');
    setOk('');
    setModalAgregarCaso(true);
  }

  /** Refresca la lista del día y, si se indica, el detalle abierto. */
  const refrescar = useCallback(
    async (idDespacho?: number) => {
      await cargarDespachos();
      if (idDespacho !== undefined) await abrirDetalle(idDespacho);
    },
    [cargarDespachos, abrirDetalle],
  );

  async function simular(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    setSimulando(true);
    try {
      setPropuesta(await api.simularPropuesta(fechaSel));
      setOk('Propuesta simulada. No se guardó ningún despacho.');
    } catch (e) {
      setPropuesta(null);
      setError(detalleDe(e, 'Error al simular la propuesta de despacho.'));
    } finally {
      setSimulando(false);
    }
  }

  /** Resultado de procesar el despacho desde el formulario flotante (D-66). */
  async function alProcesar(creados: DespachoDetalleOut[]) {
    setError('');
    setOk(`Despacho procesado: ${creados.length} cuadrilla(s).`);
    setPropuesta(null);
    setModalProcesar(false);
    await refrescar();
    if (creados.length > 0) await abrirDetalle(creados[0].id_despacho);
  }

  async function cambiarEstadoDespacho(estado: EstadoDespacho) {
    if (!seleccionado) return;
    setError('');
    setOk('');
    setOcupado(true);
    try {
      const actualizado = await api.actualizarDespacho(seleccionado.id_despacho, { estado });
      setSeleccionado(actualizado);
      setOk(`Despacho #${actualizado.id_despacho} marcado como ${estado}.`);
      await refrescar(actualizado.id_despacho);
    } catch (e) {
      setError(detalleDe(e, 'Error al actualizar el estado del despacho.'));
    } finally {
      setOcupado(false);
    }
  }

  async function agregarCaso(evento: FormEvent) {
    evento.preventDefault();
    if (!seleccionado) return;
    setError('');
    setOk('');
    const idCaso = Number(nuevoCaso.trim());
    if (!Number.isInteger(idCaso) || idCaso <= 0) {
      setError('Indique un ID de caso numérico válido.');
      return;
    }
    setAgregando(true);
    try {
      const actualizado = await api.agregarCasoDespacho(seleccionado.id_despacho, {
        id_caso: idCaso,
        tipo_asignacion: nuevoTipo || undefined,
        observacion: nuevaObservacion.trim() || undefined,
      });
      setSeleccionado(actualizado);
      setNuevoCaso('');
      setNuevoTipo('');
      setNuevaObservacion('');
      setModalAgregarCaso(false);
      setOk('Caso agregado al despacho.');
      await refrescar(actualizado.id_despacho);
    } catch (e) {
      setError(detalleDe(e, 'Error al agregar el caso al despacho.'));
    } finally {
      setAgregando(false);
    }
  }

  async function quitarCaso(idCaso: number) {
    if (!seleccionado) return;
    if (!window.confirm(`¿Quitar el caso #${idCaso} del despacho?`)) return;
    setError('');
    setOk('');
    setOcupado(true);
    try {
      const actualizado = await api.quitarCasoDespacho(seleccionado.id_despacho, idCaso);
      setSeleccionado(actualizado);
      setOk('Caso quitado del despacho.');
      await refrescar(actualizado.id_despacho);
    } catch (e) {
      setError(detalleDe(e, 'Error al quitar el caso del despacho.'));
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarEstadoCaso(idCaso: number, estado: EstadoDespachoCaso) {
    if (!seleccionado) return;
    setError('');
    setOk('');
    setOcupado(true);
    try {
      const actualizado = await api.actualizarCasoDespacho(seleccionado.id_despacho, idCaso, {
        estado,
      });
      setSeleccionado(actualizado);
      setOk(`Caso #${idCaso} marcado como ${estado}.`);
      await refrescar(actualizado.id_despacho);
    } catch (e) {
      setError(detalleDe(e, 'Error al cambiar el estado del caso.'));
    } finally {
      setOcupado(false);
    }
  }

  async function imprimir(idDespacho: number) {
    setError('');
    setOk('');
    try {
      const html = await api.obtenerImprimible(idDespacho);
      const ventana = window.open('', '_blank');
      if (!ventana) {
        setError('El navegador bloqueó la pestaña emergente; permita las ventanas emergentes.');
        return;
      }
      ventana.document.open();
      ventana.document.write(html);
      ventana.document.close();
    } catch (e) {
      setError(detalleDe(e, 'Error al obtener la ficha imprimible.'));
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!seleccionado) return;
    setError('');
    setOk('');
    setEnviando(true);
    try {
      const resultado = await api.enviarDespacho(
        seleccionado.id_despacho,
        canal,
        destinatario.trim() || undefined,
      );
      setEnvio(resultado);
      await cargarNotificaciones(seleccionado.id_despacho);
      await refrescar(seleccionado.id_despacho);
    } catch (e) {
      setEnvio(null);
      setError(detalleDe(e, 'Error al enviar el despacho.'));
    } finally {
      setEnviando(false);
    }
  }

  const minReferidosIncumplido = propuesta
    ? reglaBooleana(propuesta.reglas, 'cumple_min_referidos') === false
    : false;
  const minEmpresasIncumplido = propuesta
    ? reglaBooleana(propuesta.reglas, 'cumple_min_empresas') === false
    : false;
  const construccionMultiple = propuesta
    ? reglaBooleana(propuesta.reglas, 'construccion_en_una_sola') === false
    : false;

  function encabezadoRegla(clave: string, etiqueta: string): ReactNode {
    if (!propuesta) return null;
    const valor = propuesta.reglas[clave];
    const alerta =
      (clave === 'construccion_en_una_sola' && valor === false) ||
      (clave === 'cumple_min_referidos' && valor === false) ||
      (clave === 'cumple_min_empresas' && valor === false);
    return (
      <span className={`chip-regla${alerta ? ' regla-alerta' : ''}`} key={clave}>
        {etiqueta}: <strong>{txt(valor)}</strong>
      </span>
    );
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Despacho</h1>
          <p>Propuesta, generación, seguimiento, impresión y envío del despacho diario.</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {soloLectura && (
        <div className="aviso aviso-info">
          <span>
            Modo solo lectura: su rol TECNICO no permite simular, generar, editar ni enviar
            despachos. Puede consultar la información y los reportes.
          </span>
        </div>
      )}

      {/* Fecha + acciones principales */}
      <div className="panel-bloque">
        <h2>Jornada</h2>
        <form className="formulario filtros-tabla" onSubmit={(e) => void simular(e)}>
          <div className="campo">
            <label htmlFor="despacho-fecha">Fecha</label>
            <input
              id="despacho-fecha"
              type="date"
              value={fechaSel}
              onChange={(e) => setFechaSel(e.target.value)}
            />
          </div>
          {!soloLectura && (
            <div className="acciones-form">
              <button type="submit" className="btn btn-secundario" disabled={simulando}>
                {simulando ? 'Simulando…' : 'Simular propuesta'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setModalProcesar(true)}
              >
                Procesar despacho
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Formulario flotante para procesar el despacho (UI 6, D-66) */}
      {modalProcesar && !soloLectura && (
        <ProcesarDespacho
          fecha={fechaSel}
          onCerrar={() => setModalProcesar(false)}
          onProcesado={(creados) => void alProcesar(creados)}
        />
      )}

      {/* Propuesta */}
      {propuesta && (
        <div className="panel-bloque">
          <div className="pagina-cabecera">
            <h2>Propuesta del {fecha(propuesta.fecha)}</h2>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setPropuesta(null)}
            >
              Cerrar propuesta
            </button>
          </div>

          {/* D-113: la simulación muestra todos los tipos; el proceso aplica el
              checklist del formulario (Comunes y Especiales Reparación por defecto). */}
          <p className="texto-pequeno">
            La simulación incluye <strong>todos los tipos</strong> del universo. Al procesar,
            el formulario distribuye los tipos marcados en su checklist (por defecto{' '}
            <strong>Comunes y Especiales Reparación</strong>).
          </p>

          {(construccionMultiple || minReferidosIncumplido || minEmpresasIncumplido) && (
            <div className="aviso aviso-info">
              <span>
                Atención a las reglas:{' '}
                {construccionMultiple && 'la construcción no queda en una sola cuadrilla. '}
                {minReferidosIncumplido && 'no se cumple el mínimo de referidos. '}
                {minEmpresasIncumplido && 'no se cumple el mínimo de empresas.'}
              </span>
            </div>
          )}

          <div className="rejilla-mini">
            <div className="subpanel">
              <h3>Resumen</h3>
              <div className="lista-clave-valor">
                {Object.entries(propuesta.resumen).map(([clave, valor]) => (
                  <div key={clave}>
                    <span className="texto-pequeno">{clave}</span>{' '}
                    <strong>{txt(valor)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="subpanel">
              <h3>Reglas</h3>
              <div className="lista-reglas">
                {encabezadoRegla('construccion_en_una_sola', 'construccion_en_una_sola')}
                {encabezadoRegla('cumple_min_referidos', 'cumple_min_referidos')}
                {encabezadoRegla('cumple_min_empresas', 'cumple_min_empresas')}
                {encabezadoRegla('referidos_asignados', 'referidos_asignados')}
                {encabezadoRegla('min_referidos', 'min_referidos')}
                {encabezadoRegla('empresas_asignadas', 'empresas_asignadas')}
                {encabezadoRegla('min_empresas', 'min_empresas')}
                {encabezadoRegla('cuadrillas_activas', 'cuadrillas_activas')}
              </div>
            </div>
          </div>

          {propuesta.grupos.length === 0 ? (
            <p className="vacio">La propuesta no asignó casos a ninguna cuadrilla.</p>
          ) : (
            propuesta.grupos.map((grupo) => (
              <div className="subpanel" key={grupo.id_cuadrilla}>
                <h3>
                  {grupo.codigo} — {grupo.nombre}{' '}
                  <span className="chip">{grupo.total} caso(s)</span>
                  {/* D-77: la cuadrilla 0 concentra los casos en GESTIÓN */}
                  {grupo.es_supervisor && (
                    <span className="chip chip-estado-ok" style={{ marginLeft: 8 }}>
                      Cuadrilla 0 · casos en gestión
                    </span>
                  )}
                </h3>
                <TablaCasosAsignados casos={grupo.casos} />
              </div>
            ))
          )}

          {propuesta.sin_asignar.length > 0 && (
            <div className="subpanel">
              <h3>Sin asignar ({propuesta.sin_asignar.length})</h3>
              <TablaCasosAsignados casos={propuesta.sin_asignar} />
            </div>
          )}
        </div>
      )}

      {/* Despachos del día */}
      <div className="panel-bloque">
        <div className="pagina-cabecera">
          <h2>Despachos del {fecha(fechaSel)}</h2>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void cargarDespachos()}
            disabled={cargandoDespachos}
          >
            {cargandoDespachos ? 'Cargando…' : 'Recargar'}
          </button>
        </div>
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>Despacho</th>
                <th>Cuadrilla</th>
                <th>Estado</th>
                <th
                  title="Total de reparaciones comunes, reparaciones referidas y construcciones (los demás tipos se informan aparte)"
                >
                  Casos
                </th>
                <th>Canal de envío</th>
                <th>Generado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargandoDespachos ? (
                <tr>
                  <td colSpan={7} className="vacio">
                    Cargando…
                  </td>
                </tr>
              ) : despachos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="vacio">
                    No hay despachos para esa fecha.
                  </td>
                </tr>
              ) : (
                despachos.map((d) => (
                  <tr key={d.id_despacho}>
                    <td>#{d.id_despacho}</td>
                    <td>
                      {d.cuadrilla_codigo ?? d.id_cuadrilla}
                      {d.cuadrilla_nombre ? ` — ${d.cuadrilla_nombre}` : ''}
                    </td>
                    <td>{d.estado}</td>
                    <td>
                      <CeldaCasosPorTipo casos={d.casos} />
                    </td>
                    <td>{d.enviado_canal ?? '—'}</td>
                    <td>{d.generado_auto ? 'Automático' : 'Manual'}</td>
                    <td>
                      <div className="celda-acciones">
                        <button
                          type="button"
                          className="btn btn-mini btn-secundario"
                          onClick={() => void abrirDetalle(d.id_despacho)}
                          disabled={cargandoDetalle}
                        >
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          className="btn btn-mini btn-secundario"
                          onClick={() => void imprimir(d.id_despacho)}
                        >
                          Imprimir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <PieTabla
              colSpan={7}
              total={despachos.length}
              singular="despacho"
              plural="despachos"
              cargando={cargandoDespachos}
            />
          </table>
        </div>
      </div>

      {/* Detalle del despacho, en ventana flotante */}
      {seleccionado && (
        <Modal
          titulo={`Detalle del despacho #${seleccionado.id_despacho} — ${
            seleccionado.cuadrilla_codigo ?? seleccionado.id_cuadrilla
          }`}
          onCerrar={cerrarDetalle}
        >
          {/* D-99 (RF-68): Box Infos con el resumen del despacho. El cuadro de
              información principal se reorganiza debajo en rejilla. */}
          <BoxInfosDespacho despacho={seleccionado} />

          <div className="datos-grid">
            <div className="dato">
              <span className="dato-etiqueta">Central</span>
              <span className="dato-valor">{seleccionado.id_central}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Fecha</span>
              <span className="dato-valor">{fecha(seleccionado.fecha)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Cuadrilla</span>
              <span className="dato-valor">
                {seleccionado.cuadrilla_codigo ?? '—'}
                {seleccionado.cuadrilla_nombre ? ` — ${seleccionado.cuadrilla_nombre}` : ''}
              </span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Estado</span>
              <span className="dato-valor">{seleccionado.estado}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Generado por</span>
              <span className="dato-valor">{seleccionado.usuario_crea ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Canal de envío</span>
              <span className="dato-valor">{seleccionado.enviado_canal ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Enviado en</span>
              <span className="dato-valor">{fechaHora(seleccionado.enviado_en)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Cierre de jornada</span>
              <span className="dato-valor">
                {seleccionado.cerrado_en
                  ? `${fechaHora(seleccionado.cerrado_en)}${
                      seleccionado.cierre_auto ? ' (automático)' : ''
                    }`
                  : 'Pendiente'}
              </span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Último reproceso</span>
              <span className="dato-valor">{fechaHora(seleccionado.reprocesado_en)}</span>
            </div>
          </div>

          {!soloLectura && (
            <div className="acciones-form">
              <button
                type="button"
                className="btn"
                onClick={() => void cambiarEstadoDespacho('PUBLICADO')}
                disabled={ocupado || seleccionado.estado === 'PUBLICADO'}
              >
                Publicar
              </button>
              {/* D-99 (RF-68): el despacho ya NO se cierra a mano desde aquí. El
                  corte es automático a las 23:50 y los casos sin cerrar vuelven a
                  PENDIENTE para la jornada siguiente. */}
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => void imprimir(seleccionado.id_despacho)}
              >
                Imprimir
              </button>
            </div>
          )}

          <p className="texto-pequeno aviso-cierre-jornada">
            El despacho se cierra solo a las 23:50 del día de la jornada (o al entrar
            un supervisor un día después). Los casos que no estén cerrados pasan a
            PENDIENTE para reasignarse en la jornada siguiente.
          </p>

          <div className="pagina-cabecera">
            <h3 className="subtitulo-seccion">Casos del despacho</h3>
            {!soloLectura && (
              <button type="button" className="btn" onClick={abrirModalAgregarCaso}>
                Agregar caso
              </button>
            )}
          </div>
          {seleccionado.casos.length === 0 ? (
            <p className="vacio">El despacho no tiene casos.</p>
          ) : (
            <div className="tabla-envoltura">
              <table>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>ID caso</th>
                    <th>Sector</th>
                    <th>Tipo asignación</th>
                    <th>Estado del caso</th>
                    <th>Observación</th>
                    {!soloLectura && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {seleccionado.casos.map((c) => (
                    <tr key={c.id_despacho_caso}>
                      <td>{c.orden_visita ?? '—'}</td>
                      <td className="mono">{c.id_caso}</td>
                      <td>{c.id_sector ?? '—'}</td>
                      <td>{c.tipo_asignacion ?? '—'}</td>
                      <td>
                        {soloLectura ? (
                          c.estado
                        ) : (
                          <select
                            value={c.estado}
                            disabled={ocupado}
                            onChange={(e) =>
                              void cambiarEstadoCaso(
                                c.id_caso,
                                e.target.value as EstadoDespachoCaso,
                              )
                            }
                          >
                            {ESTADOS_CASO.map((est) => (
                              <option key={est} value={est}>
                                {est}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{c.observacion ?? '—'}</td>
                      {!soloLectura && (
                        <td>
                          <button
                            type="button"
                            className="btn btn-mini btn-peligro"
                            onClick={() => void quitarCaso(c.id_caso)}
                            disabled={ocupado}
                          >
                            Quitar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <PieTabla
                  colSpan={soloLectura ? 6 : 7}
                  total={seleccionado.casos.length}
                  singular="caso"
                  plural="casos"
                />
              </table>
            </div>
          )}

          {/* Envío (RF-10) */}
          <h3 className="subtitulo-seccion">Envío</h3>
          {!soloLectura ? (
            <form className="formulario" onSubmit={(e) => void enviar(e)}>
              <div className="campo">
                <label htmlFor="despacho-canal">Canal</label>
                <select
                  id="despacho-canal"
                  value={canal}
                  onChange={(e) => setCanal(e.target.value as CanalDespacho)}
                >
                  <option value="TELEGRAM">TELEGRAM</option>
                  <option value="CORREO">CORREO</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="despacho-destino">Destinatario</label>
                <input
                  id="despacho-destino"
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                  placeholder="Vacío = destino configurado"
                />
              </div>
              <div className="acciones-form">
                <button type="submit" className="btn" disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </form>
          ) : (
            <p className="texto-pequeno">
              Su rol solo permite consultar el historial de notificaciones.
            </p>
          )}

          {envio && (
            <Mensaje
              tipo={envio.estado === 'FALLIDO' ? 'error' : 'ok'}
              texto={`Envío ${envio.canal}: ${envio.estado}${envio.error ? ` — ${envio.error}` : ''}`}
            />
          )}

          <h3 className="subtitulo-seccion">Notificaciones</h3>
          {cargandoNotificaciones ? (
            <p className="texto-pequeno">Cargando notificaciones…</p>
          ) : notificaciones.length === 0 ? (
            <p className="vacio">No hay notificaciones para este despacho.</p>
          ) : (
            <div className="tabla-envoltura">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Canal</th>
                    <th>Destinatario</th>
                    <th>Estado</th>
                    <th>Error</th>
                    <th>Enviado en</th>
                    <th>Creado en</th>
                  </tr>
                </thead>
                <tbody>
                  {notificaciones.map((n) => (
                    <tr key={n.id_notificacion}>
                      <td>{n.id_notificacion}</td>
                      <td>{n.canal}</td>
                      <td>{n.destinatario ?? '—'}</td>
                      <td>{n.estado}</td>
                      <td>{n.error ?? '—'}</td>
                      <td>{fechaHora(n.enviado_en)}</td>
                      <td>{fechaHora(n.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
                <PieTabla
                  colSpan={7}
                  total={notificaciones.length}
                  singular="notificación"
                  plural="notificaciones"
                />
              </table>
            </div>
          )}
        </Modal>
      )}

      {/* Agregar caso al despacho, en ventana flotante */}
      {seleccionado && !soloLectura && modalAgregarCaso && (        <Modal titulo="Agregar caso" onCerrar={() => setModalAgregarCaso(false)}>
          <form className="formulario modal-formulario" onSubmit={(e) => void agregarCaso(e)}>
            <div className="campo">
              <label htmlFor="despacho-id-caso">ID de caso *</label>
              <input
                id="despacho-id-caso"
                type="number"
                min={1}
                value={nuevoCaso}
                onChange={(e) => setNuevoCaso(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="despacho-tipo">Tipo de asignación</label>
              <select
                id="despacho-tipo"
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value as TipoAsignacionDespacho | '')}
              >
                <option value="">(Automático)</option>
                {TIPOS_ASIGNACION.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="despacho-observacion">Observación</label>
              <input
                id="despacho-observacion"
                value={nuevaObservacion}
                onChange={(e) => setNuevaObservacion(e.target.value)}
              />
            </div>
            <div className="acciones-form">
              <button type="submit" className="btn" disabled={agregando}>
                {agregando ? 'Agregando…' : 'Agregar caso'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reporte de producción (RF-27) */}
      <div className="panel-bloque">
        <div className="pagina-cabecera">
          <h2>Reporte de producción</h2>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void cargarReporteGlobal()}
          >
            Recargar
          </button>
        </div>
        {reporteGlobal ? (
          <Reporte titulo="Global del día" reporte={reporteGlobal} />
        ) : (
          <p className="vacio">Sin reporte global disponible.</p>
        )}
        {seleccionado &&
          (reporteSel ? (
            <Reporte titulo={`Del despacho #${seleccionado.id_despacho}`} reporte={reporteSel} />
          ) : (
            <p className="vacio">Sin reporte para el despacho seleccionado.</p>
          ))}
        {/* D-143: seguimiento global de construcciones. */}
        <SeguimientoConstrucciones />
        {/* D-146: efectividad y ranking de cuadrillas. */}
        <RankingEfectividad />
      </div>

    </>
  );
}
