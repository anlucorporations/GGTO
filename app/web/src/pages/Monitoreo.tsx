/**
 * MONITOREO (Ciclo 7) — panel de solo lectura con gráficos y reportes.
 *
 * Reúne los indicadores de gestión diaria, semanal, globales, reparación,
 * construcción, cuadrilla y capacidad operativa, más el reporte de trabajo
 * (`/reportes/trabajo`) y su versión imprimible. Todo se dibuja con SVG en
 * línea (ver `components/graficos.tsx`); no se usan librerías de gráficos.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  MonitoreoCapacidad,
  MonitoreoConstruccion,
  MonitoreoCuadrillaOut,
  MonitoreoDiaSemanal,
  MonitoreoDiario,
  MonitoreoGlobales,
  MonitoreoReparacion,
  MonitoreoSemanal,
  PeriodoReporte,
  ReporteTrabajo,
} from '../api/types';
import {
  GraficoBarras,
  GraficoBarrasAgrupadas,
  GraficoLineas,
  GraficoTorta,
  PALETA,
  type DatoBarra,
} from '../components/graficos';
import Mensaje from '../components/Mensaje';
import { fecha } from '../utils';

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const PERIODOS: { valor: PeriodoReporte; etiqueta: string }[] = [
  { valor: 'diario', etiqueta: 'Diario' },
  { valor: 'semanal', etiqueta: 'Semanal' },
  { valor: 'mensual', etiqueta: 'Mensual' },
];

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function aISO(d: Date): string {
  const desfase = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - desfase).toISOString().slice(0, 10);
}

function hoyISO(): string {
  return aISO(new Date());
}

function primerDiaMes(): string {
  const ahora = new Date();
  return aISO(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
}

/** Lunes de la semana a la que pertenece `valor` (la semana corre lun–sáb). */
function lunesDe(valor: string): string {
  const d = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(d.getTime())) return valor;
  const dia = d.getDay();
  d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia));
  return aISO(d);
}

function diaCorto(valor: string): string {
  const d = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha(valor);
  return `${DIAS_CORTOS[d.getDay()]} ${valor.slice(8, 10)}`;
}

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function txt(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return String(valor);
}

/** Convierte `Record<string, number>` en filas ordenadas de mayor a menor. */
function entradas(registro: Record<string, number>): { clave: string; valor: number }[] {
  return Object.entries(registro)
    .map(([clave, valor]) => ({ clave, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function tarjetasDiario(d: MonitoreoDiario): DatoBarra[] {
  return [
    { etiqueta: 'Ingresos nuevos', valor: d.ingresos_nuevos },
    { etiqueta: 'Resueltos residencial', valor: d.resueltos_residencial, color: PALETA[0] },
    { etiqueta: 'Resueltos empresarial', valor: d.resueltos_empresarial, color: PALETA[1] },
    { etiqueta: 'Resueltos referidos', valor: d.resueltos_referidos, color: PALETA[2] },
    { etiqueta: 'Citados', valor: d.citados, color: PALETA[3] },
    { etiqueta: 'Diferidos', valor: d.diferidos, color: PALETA[4] },
    { etiqueta: 'Gestionados', valor: d.gestionados, color: PALETA[5] },
    { etiqueta: 'Pendientes totales', valor: d.pendientes_total, color: PALETA[0] },
  ];
}

function tarjetasGlobales(g: MonitoreoGlobales): DatoBarra[] {
  return [
    { etiqueta: 'Pendientes', valor: g.pendientes, color: PALETA[3] },
    { etiqueta: 'Resueltos', valor: g.resueltos, color: PALETA[1] },
    { etiqueta: 'Total', valor: g.total, color: PALETA[0] },
  ];
}

function tarjetasCapacidad(c: MonitoreoCapacidad): DatoBarra[] {
  return [
    { etiqueta: 'Cuadrillas activas', valor: c.cuadrillas_activas },
    { etiqueta: 'Técnicos activos', valor: c.tecnicos_activos },
    { etiqueta: 'Flota disponible', valor: c.flota_disponible },
    { etiqueta: 'Herramientas disponibles', valor: c.herramientas_disponibles },
    { etiqueta: 'Sectores activos', valor: c.sectores_activos },
  ];
}

/* ------------------------------------------------------------------ */
/* Subcomponentes de presentación                                      */
/* ------------------------------------------------------------------ */

function Tarjetas({ datos }: { datos: DatoBarra[] }) {
  return (
    <div className="rejilla-tarjetas">
      {datos.map((t) => (
        <div className="tarjeta" key={t.etiqueta}>
          <div className="valor">{t.valor}</div>
          <div className="etiqueta">{t.etiqueta}</div>
        </div>
      ))}
    </div>
  );
}

function TablaDesglose({
  titulo,
  columna,
  datos,
}: {
  titulo: string;
  columna: string;
  datos: { clave: string; valor: number }[];
}) {
  if (datos.length === 0) return <p className="vacio">Sin datos de {titulo.toLowerCase()}.</p>;
  return (
    <div className="tabla-envoltura">
      <table>
        <thead>
          <tr>
            <th>{titulo}</th>
            <th>{columna}</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((d) => (
            <tr key={d.clave}>
              <td>{d.clave}</td>
              <td>{d.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaSemanal({ dias }: { dias: MonitoreoDiaSemanal[] }) {
  if (dias.length === 0) return <p className="vacio">Sin datos semanales.</p>;
  const totales = dias.reduce(
    (acc, d) => ({
      asignados: acc.asignados + d.asignados,
      cerrados: acc.cerrados + d.cerrados,
      gestionados: acc.gestionados + d.gestionados,
    }),
    { asignados: 0, cerrados: 0, gestionados: 0 },
  );
  return (
    <div className="tabla-envoltura">
      <table>
        <thead>
          <tr>
            <th>Día</th>
            <th>Asignados</th>
            <th>Cerrados</th>
            <th>Gestionados</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.fecha}>
              <td>
                {diaCorto(d.fecha)} · <span className="mono">{fecha(d.fecha)}</span>
              </td>
              <td>{d.asignados}</td>
              <td>{d.cerrados}</td>
              <td>{d.gestionados}</td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>Total</strong>
            </td>
            <td>
              <strong>{totales.asignados}</strong>
            </td>
            <td>
              <strong>{totales.cerrados}</strong>
            </td>
            <td>
              <strong>{totales.gestionados}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TablaCuadrillas({ data }: { data: MonitoreoCuadrillaOut }) {
  if (data.cuadrillas.length === 0) return <p className="vacio">Sin cuadrillas con producción.</p>;
  return (
    <div className="tabla-envoltura">
      <table>
        <thead>
          <tr>
            <th>Cuadrilla</th>
            <th>Nombre</th>
            <th>Asignados</th>
            <th>Cerrados</th>
            <th>Gestionados</th>
          </tr>
        </thead>
        <tbody>
          {data.cuadrillas.map((c) => (
            <tr key={c.id_cuadrilla}>
              <td className="mono">{c.codigo}</td>
              <td>{c.nombre}</td>
              <td>{c.totales.asignados}</td>
              <td>{c.totales.cerrados}</td>
              <td>{c.totales.gestionados}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaCapacidad({ data }: { data: MonitoreoCapacidad }) {
  if (data.cuadrillas.length === 0) {
    return <p className="vacio">Sin cuadrillas activas registradas.</p>;
  }
  return (
    <div className="tabla-envoltura">
      <table>
        <thead>
          <tr>
            <th>Cuadrilla</th>
            <th>Nombre</th>
            <th>Integrantes</th>
            <th>Flota</th>
            <th>¿Completa?</th>
          </tr>
        </thead>
        <tbody>
          {data.cuadrillas.map((c) => (
            <tr key={c.id_cuadrilla}>
              <td className="mono">{c.codigo}</td>
              <td>
                {c.nombre}
                {c.es_supervisor ? ' (supervisor)' : ''}
              </td>
              <td>{c.integrantes}</td>
              <td>{txt(c.flota)}</td>
              <td>
                <span className={`chip-estado${c.completa ? ' chip-estado-ok' : ' chip-estado-alerta'}`}>
                  {c.completa ? 'Sí' : 'No'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Resumen compacto del reporte de trabajo consolidado. */
function ResumenReporte({ reporte }: { reporte: ReporteTrabajo }) {
  return (
    <>
      <div className="lista-clave-valor">
        <div>
          <span className="texto-pequeno">Periodo</span> <strong>{reporte.periodo}</strong>
        </div>
        <div>
          <span className="texto-pequeno">Desde</span> <strong>{fecha(reporte.desde)}</strong>{' '}
          <span className="texto-pequeno">Hasta</span> <strong>{fecha(reporte.hasta)}</strong>
        </div>
      </div>

      <h3 className="subtitulo-seccion">Gestión diaria</h3>
      <Tarjetas datos={tarjetasDiario(reporte.diario)} />

      <h3 className="subtitulo-seccion">Casos globales</h3>
      <Tarjetas datos={tarjetasGlobales(reporte.globales)} />

      <div className="rejilla-mini">
        <div className="subpanel">
          <h3>Reparación</h3>
          <div className="lista-clave-valor">
            <div>
              <span className="texto-pequeno">Residenciales comunes</span>{' '}
              <strong>{reporte.reparacion.residenciales_comunes}</strong>
            </div>
            <div>
              <span className="texto-pequeno">Residenciales referidos</span>{' '}
              <strong>{reporte.reparacion.residenciales_referidos}</strong>
            </div>
            <div>
              <span className="texto-pequeno">Empresariales</span>{' '}
              <strong>{reporte.reparacion.empresariales}</strong>
            </div>
            <div>
              <span className="texto-pequeno">Total</span>{' '}
              <strong>{reporte.reparacion.total}</strong>
            </div>
          </div>
        </div>
        <div className="subpanel">
          <h3>Construcción</h3>
          <div className="lista-clave-valor">
            <div>
              <span className="texto-pequeno">Residenciales</span>{' '}
              <strong>{reporte.construccion.residenciales}</strong>
            </div>
            <div>
              <span className="texto-pequeno">Empresariales</span>{' '}
              <strong>{reporte.construccion.empresariales}</strong>
            </div>
            <div>
              <span className="texto-pequeno">Total</span>{' '}
              <strong>{reporte.construccion.total}</strong>
            </div>
          </div>
        </div>
        <div className="subpanel">
          <h3>Capacidad operativa</h3>
          <div className="lista-clave-valor">
            <div>
              <span className="texto-pequeno">Cuadrillas activas</span>{' '}
              <strong>{reporte.capacidad.cuadrillas_activas}</strong>
            </div>
            <div>
              <span className="texto-pequeno">Técnicos activos</span>{' '}
              <strong>{reporte.capacidad.tecnicos_activos}</strong>
            </div>
            <div>
              <span className="texto-pequeno">Flota disponible</span>{' '}
              <strong>{reporte.capacidad.flota_disponible}</strong>
            </div>
            <div>
              <span className="texto-pequeno">Herramientas disponibles</span>{' '}
              <strong>{reporte.capacidad.herramientas_disponibles}</strong>
            </div>
            <div>
              <span className="texto-pequeno">Sectores activos</span>{' '}
              <strong>{reporte.capacidad.sectores_activos}</strong>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Monitoreo() {
  const [fechaSel, setFechaSel] = useState(hoyISO());
  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoyISO());

  const [diario, setDiario] = useState<MonitoreoDiario | null>(null);
  const [semanal, setSemanal] = useState<MonitoreoSemanal | null>(null);
  const [globales, setGlobales] = useState<MonitoreoGlobales | null>(null);
  const [reparacion, setReparacion] = useState<MonitoreoReparacion | null>(null);
  const [construccion, setConstruccion] = useState<MonitoreoConstruccion | null>(null);
  const [cuadrilla, setCuadrilla] = useState<MonitoreoCuadrillaOut | null>(null);
  const [capacidad, setCapacidad] = useState<MonitoreoCapacidad | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [periodo, setPeriodo] = useState<PeriodoReporte>('diario');
  const [reporte, setReporte] = useState<ReporteTrabajo | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);

  const lunes = useMemo(() => lunesDe(fechaSel), [fechaSel]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    setOk('');
    const resultados = await Promise.allSettled([
      api.monitoreoDiario(fechaSel),
      api.monitoreoSemanal(lunesDe(fechaSel)),
      api.monitoreoGlobales(desde, hasta),
      api.monitoreoReparacion(),
      api.monitoreoConstruccion(),
      api.monitoreoCuadrilla(lunesDe(fechaSel), 6),
      api.monitoreoCapacidad(),
    ]);

    setDiario(resultados[0].status === 'fulfilled' ? resultados[0].value : null);
    setSemanal(resultados[1].status === 'fulfilled' ? resultados[1].value : null);
    setGlobales(resultados[2].status === 'fulfilled' ? resultados[2].value : null);
    setReparacion(resultados[3].status === 'fulfilled' ? resultados[3].value : null);
    setConstruccion(resultados[4].status === 'fulfilled' ? resultados[4].value : null);
    setCuadrilla(resultados[5].status === 'fulfilled' ? resultados[5].value : null);
    setCapacidad(resultados[6].status === 'fulfilled' ? resultados[6].value : null);

    const fallo = resultados.find((r) => r.status === 'rejected');
    if (fallo && fallo.status === 'rejected') {
      setError(detalleDe(fallo.reason, 'Error al cargar los indicadores de monitoreo.'));
    }
    setCargando(false);
  }, [fechaSel, desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function actualizar(evento: FormEvent) {
    evento.preventDefault();
    void cargar();
  }

  async function verReporte(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    setCargandoReporte(true);
    try {
      const datos = await api.reporteTrabajo(periodo, fechaSel);
      setReporte(datos);
      setOk(`Reporte ${datos.periodo} obtenido (${fecha(datos.desde)} — ${fecha(datos.hasta)}).`);
    } catch (e) {
      setReporte(null);
      setError(detalleDe(e, 'Error al obtener el reporte de trabajo.'));
    } finally {
      setCargandoReporte(false);
    }
  }

  async function imprimir() {
    setError('');
    setOk('');
    setImprimiendo(true);
    try {
      const html = await api.obtenerReporteTrabajoImprimible(periodo, fechaSel);
      const ventana = window.open('', '_blank');
      if (!ventana) {
        setError('El navegador bloqueó la pestaña emergente; permita las ventanas emergentes.');
        return;
      }
      ventana.document.open();
      ventana.document.write(html);
      ventana.document.close();
    } catch (e) {
      setError(detalleDe(e, 'Error al obtener el reporte imprimible.'));
    } finally {
      setImprimiendo(false);
    }
  }

  const datosSemanal = semanal?.dias ?? [];

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Monitoreo</h1>
          <p>Indicadores de gestión, gráficos y reportes de trabajo (solo lectura).</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {/* Filtros */}
      <div className="panel-bloque">
        <h2>Parámetros de consulta</h2>
        <form className="formulario" onSubmit={actualizar}>
          <div className="campo">
            <label htmlFor="monitoreo-fecha">Fecha (diario y semana)</label>
            <input
              id="monitoreo-fecha"
              type="date"
              value={fechaSel}
              onChange={(e) => setFechaSel(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="monitoreo-desde">Globales desde</label>
            <input
              id="monitoreo-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="monitoreo-hasta">Globales hasta</label>
            <input
              id="monitoreo-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <div className="acciones-form">
            <button type="submit" className="btn" disabled={cargando}>
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
            <span className="texto-pequeno">
              Semana del <strong>{fecha(lunes)}</strong> (lunes a sábado).
            </span>
          </div>
        </form>
      </div>

      {/* Reportes */}
      <div className="panel-bloque">
        <h2>Reportes</h2>
        <form className="formulario" onSubmit={(e) => void verReporte(e)}>
          <div className="campo">
            <label htmlFor="monitoreo-periodo">Periodo</label>
            <select
              id="monitoreo-periodo"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as PeriodoReporte)}
            >
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="acciones-form">
            <button type="submit" className="btn" disabled={cargandoReporte}>
              {cargandoReporte ? 'Generando…' : 'Ver reporte'}
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => void imprimir()}
              disabled={imprimiendo}
            >
              {imprimiendo ? 'Preparando…' : 'Imprimir / PDF'}
            </button>
          </div>
        </form>
        {reporte ? (
          <div className="subpanel">
            <ResumenReporte reporte={reporte} />
          </div>
        ) : (
          <p className="vacio">Genere un reporte para ver el resumen consolidado.</p>
        )}
      </div>

      {/* Fila superior: diario (izquierda) + globales (derecha) */}
      <div className="monitoreo-columnas">
        <div className="panel-bloque">
          <h2>Zona gestión diaria — {fecha(fechaSel)}</h2>
          {diario ? (
            <>
              <Tarjetas datos={tarjetasDiario(diario)} />
              <h3 className="subtitulo-seccion">Gráfico de barras</h3>
              <GraficoBarras datos={tarjetasDiario(diario)} />
            </>
          ) : (
            <p className="vacio">Sin datos para la fecha indicada.</p>
          )}
        </div>

        <div className="panel-bloque">
          <h2>
            Zona casos globales ({fecha(globales?.desde ?? desde)} — {fecha(globales?.hasta ?? hasta)})
          </h2>
          {globales ? (
            <>
              <Tarjetas datos={tarjetasGlobales(globales)} />
              <h3 className="subtitulo-seccion">Pendientes vs resueltos</h3>
              <GraficoBarras
                datos={[
                  { etiqueta: 'Pendientes', valor: globales.pendientes, color: PALETA[3] },
                  { etiqueta: 'Resueltos', valor: globales.resueltos, color: PALETA[1] },
                ]}
                alto={220}
              />
              <h3 className="subtitulo-seccion">Por estado</h3>
              <TablaDesglose
                titulo="Estado"
                columna="Casos"
                datos={entradas(globales.por_estado)}
              />
              <h3 className="subtitulo-seccion">Por categoría</h3>
              <TablaDesglose
                titulo="Categoría"
                columna="Casos"
                datos={entradas(globales.por_categoria)}
              />
            </>
          ) : (
            <p className="vacio">Sin datos globales para el rango indicado.</p>
          )}
        </div>
      </div>

      {/* Semanal */}
      <div className="panel-bloque">
        <h2>Zona gestión semanal — semana del {fecha(semanal?.desde ?? lunes)}</h2>
        {datosSemanal.length > 0 ? (
          <>
            <GraficoLineas
              etiquetas={datosSemanal.map((d) => diaCorto(d.fecha))}
              series={[
                {
                  nombre: 'Asignados',
                  color: PALETA[0],
                  valores: datosSemanal.map((d) => d.asignados),
                },
                {
                  nombre: 'Cerrados',
                  color: PALETA[1],
                  valores: datosSemanal.map((d) => d.cerrados),
                },
                {
                  nombre: 'Gestionados',
                  color: PALETA[2],
                  valores: datosSemanal.map((d) => d.gestionados),
                },
              ]}
            />
            <h3 className="subtitulo-seccion">Detalle diario</h3>
            <TablaSemanal dias={datosSemanal} />
          </>
        ) : (
          <p className="vacio">Sin datos semanales para la fecha indicada.</p>
        )}
      </div>

      {/* Reparación + construcción */}
      <div className="monitoreo-columnas">
        <div className="panel-bloque">
          <h2>Zona reparación</h2>
          {reparacion ? (
            <GraficoTorta
              porciones={[
                {
                  etiqueta: 'Residenciales comunes',
                  valor: reparacion.residenciales_comunes,
                  color: PALETA[0],
                },
                {
                  etiqueta: 'Residenciales referidos',
                  valor: reparacion.residenciales_referidos,
                  color: PALETA[2],
                },
                { etiqueta: 'Empresariales', valor: reparacion.empresariales, color: PALETA[1] },
              ]}
              centro={String(reparacion.total)}
            />
          ) : (
            <p className="vacio">Sin datos de reparación.</p>
          )}
        </div>

        <div className="panel-bloque">
          <h2>Zona construcción</h2>
          {construccion ? (
            <>
              <Tarjetas
                datos={[
                  { etiqueta: 'Residenciales', valor: construccion.residenciales },
                  { etiqueta: 'Empresariales', valor: construccion.empresariales },
                  { etiqueta: 'Total', valor: construccion.total },
                ]}
              />
              <h3 className="subtitulo-seccion">Gráfico de barras</h3>
              <GraficoBarras
                datos={[
                  {
                    etiqueta: 'Residenciales',
                    valor: construccion.residenciales,
                    color: PALETA[0],
                  },
                  {
                    etiqueta: 'Empresariales',
                    valor: construccion.empresariales,
                    color: PALETA[1],
                  },
                ]}
                alto={220}
              />
            </>
          ) : (
            <p className="vacio">Sin datos de construcción.</p>
          )}
        </div>
      </div>

      {/* Cuadrilla */}
      <div className="panel-bloque">
        <h2>Zona cuadrilla — semana del {fecha(cuadrilla?.desde ?? lunes)}</h2>
        {cuadrilla && cuadrilla.cuadrillas.length > 0 ? (
          <>
            <GraficoBarrasAgrupadas
              grupos={cuadrilla.cuadrillas.map((c) => ({
                etiqueta: c.codigo,
                valores: [
                  c.totales.asignados,
                  c.totales.cerrados,
                  c.totales.gestionados,
                ],
              }))}
              series={['Asignados', 'Cerrados', 'Gestionados']}
            />
            <h3 className="subtitulo-seccion">Totales por cuadrilla</h3>
            <TablaCuadrillas data={cuadrilla} />
          </>
        ) : (
          <p className="vacio">Sin producción por cuadrilla en el periodo.</p>
        )}
      </div>

      {/* Capacidad operativa */}
      <div className="panel-bloque">
        <h2>Zona capacidad operativa</h2>
        {capacidad ? (
          <>
            <Tarjetas datos={tarjetasCapacidad(capacidad)} />
            <h3 className="subtitulo-seccion">Detalle de cuadrillas</h3>
            <TablaCapacidad data={capacidad} />
          </>
        ) : (
          <p className="vacio">Sin datos de capacidad operativa.</p>
        )}
      </div>
    </>
  );
}
