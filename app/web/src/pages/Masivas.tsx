/**
 * Página MASIVAS (D-99 · RF-59 a RF-63).
 *
 * Encima de las pestañas, el **cuadro de las masivas** (D-111) muestra el
 * listado completo con el estilo de CASOS: filas clicables, columna de
 * **indicadores** (Planificación · Materiales · Asignación) y **acciones con
 * icono**.
 *
 * Debajo, las pestañas reúnen todo el ciclo de una falla masiva, con la API de
 * `/fallas-masivas`:
 *
 *  1. BÚSQUEDA AUTOMÁTICA : dispara la detección por concentración.
 *  2. AGREGAR MANUAL      : reporte manual (modal) con ODN, FAT, sector…
 *  3. GESTIONAR           : abre la ficha flotante de cada masiva activa.
 *  4. GENERAR REPORTE     : HTML imprimible de la masiva en una pestaña nueva.
 *  5. HISTÓRICO           : listado filtrable con todas las acciones.
 *  6. UBICACIÓN           : mapa Leaflet del FAT y de los GPS de las evidencias.
 *  7. PERSONAL EXTERNO    : catálogo de solicitantes y validadores del CRASS.
 *
 * Los estilos propios viven en `../masivas/masivas.css` (no se toca
 * `styles.css`, salvo las pestañas compartidas que se restauran aquí).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  CasoCandidatoOut,
  Cuadrilla,
  EstadoFallaMasiva,
  FallaMasivaManual,
  FallaMasivaOut,
  MasivasFiltros,
  OrigenFallaMasiva,
  Sector,
  UbicacionMasivaOut,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import {
  IconoGestion,
  IconoReporte,
  IconoUbicacion,
  IconoVer,
} from '../components/Iconos';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { fechaHora } from '../utils';
import BotonIcono from '../masivas/AccionesMasiva';
import CeldaIndicadores from '../masivas/CeldaIndicadores';
import CuadroMasivas from '../masivas/CuadroMasivas';
import { claseEstadoMasiva } from '../masivas/estado';
import FichaMasiva from '../masivas/FichaMasiva';
import ListaEvidencias from '../masivas/ListaEvidencias';
import MapaFat from '../masivas/MapaFat';
import '../masivas/masivas.css';

type PestanaMasivas =
  | 'automatica'
  | 'manual'
  | 'gestion'
  | 'reporte'
  | 'historico'
  | 'ubicacion';

const PESTANAS: { id: PestanaMasivas; etiqueta: string }[] = [
  { id: 'automatica', etiqueta: 'Búsqueda automática' },
  { id: 'manual', etiqueta: 'Agregar manual' },
  { id: 'gestion', etiqueta: 'Gestionar' },
  { id: 'reporte', etiqueta: 'Generar reporte' },
  { id: 'historico', etiqueta: 'Histórico' },
  { id: 'ubicacion', etiqueta: 'Ubicación' },
];

const ESTADOS_MASIVA: EstadoFallaMasiva[] = ['DETECTADA', 'PLANIFICADA', 'ATENDIDA', 'CERRADA'];
const ORIGENES_MASIVA: OrigenFallaMasiva[] = ['AUTOMATICA', 'REPORTE_TECNICO', 'MCP'];

/** Máximo de seriales de evidencia del reporte manual (RF-16). */
const MAX_EVIDENCIAS_REPORTE = 2;

interface Filtros {
  estado: string;
  origen: string;
  q: string;
  desde: string;
  hasta: string;
}

const FILTROS_VACIOS: Filtros = { estado: '', origen: '', q: '', desde: '', hasta: '' };

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function txt(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return String(valor);
}

function truncar(texto: string, largo = 60): string {
  return texto.length <= largo ? texto : `${texto.slice(0, largo - 1)}…`;
}

export default function Masivas() {
  const { soloLectura } = useAuth();

  const [pestana, setPestana] = useState<PestanaMasivas>('automatica');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState('');

  // Detección automática.
  const [detectadas, setDetectadas] = useState<FallaMasivaOut[] | null>(null);

  // Listado del histórico (con filtros) y listado de activas.
  const [borrador, setBorrador] = useState<Filtros>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VACIOS);
  const [items, setItems] = useState<FallaMasivaOut[]>([]);
  const [activas, setActivas] = useState<FallaMasivaOut[]>([]);
  const [cargando, setCargando] = useState(true);

  // Ventanas flotantes.
  const [manualAbierto, setManualAbierto] = useState(false);
  const [ficha, setFicha] = useState<FallaMasivaOut | null>(null);
  const [detalle, setDetalle] = useState<FallaMasivaOut | null>(null);

  // Ubicación (RF-60).
  const [idUbicacion, setIdUbicacion] = useState('');
  const [ubicacion, setUbicacion] = useState<UbicacionMasivaOut | null>(null);
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  // D-145: resolución de la dirección para el mapa del FAT.
  const [geocodificando, setGeocodificando] = useState(false);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: MasivasFiltros = {};
      if (aplicados.estado !== '') filtros.estado = aplicados.estado as EstadoFallaMasiva;
      if (aplicados.origen !== '') filtros.origen = aplicados.origen as OrigenFallaMasiva;
      if (aplicados.q.trim() !== '') filtros.q = aplicados.q.trim();
      if (aplicados.desde !== '') filtros.desde = aplicados.desde;
      if (aplicados.hasta !== '') filtros.hasta = aplicados.hasta;
      setItems(await api.listarMasivas(filtros));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al listar las masivas.'));
    } finally {
      setCargando(false);
    }
  }, [aplicados]);

  const cargarActivas = useCallback(async () => {
    try {
      setActivas(await api.listarMasivas({ solo_activas: true }));
    } catch {
      setActivas([]);
    }
  }, []);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  useEffect(() => {
    void cargarActivas();
  }, [cargarActivas]);

  /** Refresca histórico, activas y la masiva abierta en la ficha. */
  const refrescarTodo = useCallback(async () => {
    await Promise.all([cargarLista(), cargarActivas()]);
  }, [cargarLista, cargarActivas]);

  /* --------------------------- Acciones --------------------------- */

  async function detectar() {
    setOcupado('detectar');
    setError('');
    setOk('');
    try {
      const creadas = await api.detectarFallasMasivas();
      setDetectadas(creadas);
      setOk(
        creadas.length === 0
          ? 'Detección completada: ninguna concentración superó el umbral configurado.'
          : `Detección completada: ${creadas.length} masiva(s) nueva(s).`,
      );
      await refrescarTodo();
    } catch (e) {
      setError(detalleDe(e, 'No se pudo ejecutar la detección automática.'));
    } finally {
      setOcupado('');
    }
  }

  async function generarReporte(idFalla: number) {
    setOcupado(`reporte-${idFalla}`);
    setError('');
    setOk('');
    try {
      const html = await api.reporteMasiva(idFalla);
      const ventana = window.open('', '_blank');
      if (!ventana) {
        setError('El navegador bloqueó la pestaña emergente; permita las ventanas emergentes.');
        return;
      }
      ventana.document.open();
      ventana.document.write(html);
      ventana.document.close();
      setOk(`Reporte de la masiva #${idFalla} generado en una pestaña nueva.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo obtener el reporte de la masiva.'));
    } finally {
      setOcupado('');
    }
  }

  async function cargarUbicacion(idFalla: number) {
    setCargandoUbicacion(true);
    setError('');
    try {
      setUbicacion(await api.ubicacionMasiva(idFalla));
    } catch (e) {
      setUbicacion(null);
      setError(detalleDe(e, 'No se pudo obtener la ubicación del FAT.'));
    } finally {
      setCargandoUbicacion(false);
    }
  }

  /** D-145: ubica el FAT por su dirección cuando no hay coordenadas GPS. */
  async function ubicarPorDireccion() {
    if (idUbicacion === '') return;
    setGeocodificando(true);
    setError('');
    try {
      setUbicacion(await api.ubicacionMasiva(Number(idUbicacion), { geocodificar: true }));
    } catch (e) {
      setError(detalleDe(e, 'No se pudo ubicar la dirección del FAT.'));
    } finally {
      setGeocodificando(false);
    }
  }

  function irAUbicacion(idFalla: number) {
    setPestana('ubicacion');
    setIdUbicacion(String(idFalla));
    void cargarUbicacion(idFalla);
  }

  function abrirGestion(masiva: FallaMasivaOut) {
    setFicha(masiva);
    setError('');
    setOk('');
  }

  function masivaActualizada(actualizada: FallaMasivaOut, mensaje: string) {
    setFicha(actualizada);
    setOk(mensaje);
    void refrescarTodo();
  }

  function filtrar(evento: FormEvent) {
    evento.preventDefault();
    setAplicados({ ...borrador });
  }

  function limpiarFiltros() {
    setBorrador(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
    setOk('');
    setError('');
  }

  /** Masivas conocidas (histórico + activas) sin duplicados, para el selector. */
  const opciones: FallaMasivaOut[] = [];
  for (const m of [...items, ...activas]) {
    if (!opciones.some((o) => o.id_falla === m.id_falla)) opciones.push(m);
  }
  opciones.sort((a, b) => b.id_falla - a.id_falla);

  /* ---------------------------- Render ---------------------------- */

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Masivas</h1>
        </div>
        <div className="acciones-form">
          <button
            type="button"
            className="btn"
            onClick={() => void detectar()}
            disabled={soloLectura || ocupado !== ''}
          >
            {ocupado === 'detectar' ? 'Detectando…' : 'Detectar masivas'}
          </button>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => setManualAbierto(true)}
            disabled={soloLectura}
          >
            Agregar masiva manual
          </button>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {soloLectura && (
        <div className="aviso aviso-info">
          <span>
            Modo solo lectura: su rol TECNICO puede consultar masivas, casos asociados y reportes,
            pero no modificarlos.
          </span>
        </div>
      )}

      {/* ---------------- CUADRO DE LAS MASIVAS (D-111) ---------------- */}
      <div className="panel-bloque">
        <h2>Listado de masivas</h2>
        {items.length === 0 ? (
          <p className="vacio">
            {cargando ? 'Cargando…' : 'No hay masivas registradas.'}
          </p>
        ) : (
          <CuadroMasivas
            items={items}
            cargando={cargando}
            ocupado={ocupado}
            onGestionar={abrirGestion}
            onReporte={(idFalla) => void generarReporte(idFalla)}
            onUbicacion={irAUbicacion}
            onVer={(masiva) => setDetalle(masiva)}
          />
        )}
      </div>

      <nav className="operacion-pestanas" role="tablist" aria-label="Secciones de Masivas">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            className={`operacion-pestana${pestana === p.id ? ' activa' : ''}`}
            onClick={() => {
              setPestana(p.id);
              setError('');
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </nav>

      <div className="operacion-panel masiva-panel" role="tabpanel">
        {/* --------------------- BÚSQUEDA AUTOMÁTICA --------------------- */}
        {pestana === 'automatica' && (
          <div className="panel-bloque">
            <h2>Búsqueda automática de masivas</h2>
            <div className="masiva-intro">
              <div className="acciones-form">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void detectar()}
                  disabled={soloLectura || ocupado !== ''}
                >
                  {ocupado === 'detectar' ? 'Detectando…' : 'Detectar masivas'}
                </button>
              </div>
              {detectadas && (
                <div className="masiva-resultado-deteccion">
                  <strong>
                    Última detección: {detectadas.length} masiva(s) nueva(s).
                  </strong>
                  {detectadas.length > 0 && (
                    <div className="tabla-envoltura">
                      <table className="tabla-resumen">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Concentración</th>
                            <th>Descripción</th>
                            <th>Sector</th>
                            <th>RUTA</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detectadas.map((m) => (
                            <tr key={m.id_falla}>
                              <td className="mono">{m.id_falla}</td>
                              <td className="mono">{txt(m.clave_concentracion)}</td>
                              <td>{truncar(m.descripcion)}</td>
                              <td>{txt(m.sector_nombre)}</td>
                              <td className="mono">{txt(m.ruta)}</td>
                              <td>
                                <BotonIcono
                                  Icono={IconoGestion}
                                  etiqueta="Gestionar"
                                  tono="primario"
                                  onClick={() => abrirGestion(m)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------ AGREGAR MANUAL ---------------------- */}
        {pestana === 'manual' && (
          <div className="panel-bloque">
            <h2>Agregar masiva manual</h2>
            <div className="acciones-form">
              <button
                type="button"
                className="btn"
                onClick={() => setManualAbierto(true)}
                disabled={soloLectura}
              >
                Abrir formulario de reporte manual
              </button>
            </div>
          </div>
        )}

        {/* -------------------------- GESTIONAR ------------------------- */}
        {pestana === 'gestion' && (
          <div className="panel-bloque">
            <h2>Gestionar masiva</h2>
            <div className="acciones-form">
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => void refrescarTodo()}
                disabled={cargando}
              >
                {cargando ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>
            {activas.length === 0 ? (
              <p className="vacio">No hay masivas activas.</p>
            ) : (
              <div className="tabla-envoltura">
                <table className="tabla-resumen">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Estado</th>
                      <th>Origen</th>
                      <th>Descripción</th>
                      <th>Sector</th>
                      <th>Cuadrilla</th>
                      <th>RUTA</th>
                      <th>Detección</th>
                      <th>Indicadores</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activas.map((m) => (
                      <tr key={m.id_falla}>
                        <td className="mono">{m.id_falla}</td>
                        <td>
                          <span className={claseEstadoMasiva(m.estado)}>{m.estado}</span>
                        </td>
                        <td>{m.origen}</td>
                        <td>
                          <span className="masiva-descripcion-corta" title={m.descripcion}>
                            {truncar(m.descripcion)}
                          </span>
                        </td>
                        <td>{txt(m.sector_nombre)}</td>
                        <td>{txt(m.cuadrilla_codigo ?? m.cuadrilla_nombre)}</td>
                        <td className="mono">{txt(m.ruta)}</td>
                        <td>{fechaHora(m.fecha_deteccion)}</td>
                        <td>
                          <CeldaIndicadores falla={m} />
                        </td>
                        <td>
                          <div className="masiva-personal-acciones masiva-acciones-iconos">
                            <BotonIcono
                              Icono={IconoGestion}
                              etiqueta="Gestionar"
                              tono="primario"
                              onClick={() => abrirGestion(m)}
                            />
                            <BotonIcono
                              Icono={IconoReporte}
                              etiqueta="Reporte"
                              onClick={() => void generarReporte(m.id_falla)}
                              disabled={ocupado === `reporte-${m.id_falla}`}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <PieTabla
                    colSpan={10}
                    total={activas.length}
                    singular="masiva"
                    plural="masivas"
                    cargando={cargando}
                  />
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------ GENERAR REPORTE --------------------- */}
        {pestana === 'reporte' && (
          <div className="panel-bloque">
            <h2>Generar reporte</h2>
            {items.length === 0 ? (
              <p className="vacio">No hay masivas que coincidan con los filtros del histórico.</p>
            ) : (
              <div className="tabla-envoltura">
                <table className="tabla-resumen">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Estado</th>
                      <th>Concentración</th>
                      <th>Descripción</th>
                      <th>Sector</th>
                      <th>Detección</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.id_falla}>
                        <td className="mono">{m.id_falla}</td>
                        <td>
                          <span className={claseEstadoMasiva(m.estado)}>{m.estado}</span>
                        </td>
                        <td className="mono">{txt(m.clave_concentracion)}</td>
                        <td>{truncar(m.descripcion)}</td>
                        <td>{txt(m.sector_nombre)}</td>
                        <td>{fechaHora(m.fecha_deteccion)}</td>
                        <td>
                          <div className="masiva-personal-acciones masiva-acciones-iconos">
                            <BotonIcono
                              Icono={IconoReporte}
                              etiqueta="Generar reporte"
                              onClick={() => void generarReporte(m.id_falla)}
                              disabled={ocupado === `reporte-${m.id_falla}`}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <PieTabla
                    colSpan={7}
                    total={items.length}
                    singular="masiva"
                    plural="masivas"
                    cargando={cargando}
                  />
                </table>
              </div>
            )}
          </div>
        )}

        {/* --------------------------- HISTÓRICO ------------------------ */}
        {pestana === 'historico' && (
          <div className="panel-bloque">
            <h2>Histórico de masivas</h2>
            <form className="formulario filtros-tabla" onSubmit={filtrar}>
              <div className="campo">
                <label htmlFor="mas-f-q">Texto libre</label>
                <input
                  id="mas-f-q"
                  value={borrador.q}
                  onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
                  placeholder="Descripción, RUTA, FAT, sector, dirección…"
                />
              </div>
              <div className="campo">
                <label htmlFor="mas-f-estado">Estado</label>
                <select
                  id="mas-f-estado"
                  value={borrador.estado}
                  onChange={(e) => setBorrador({ ...borrador, estado: e.target.value })}
                >
                  <option value="">Todos</option>
                  {ESTADOS_MASIVA.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="mas-f-origen">Origen</label>
                <select
                  id="mas-f-origen"
                  value={borrador.origen}
                  onChange={(e) => setBorrador({ ...borrador, origen: e.target.value })}
                >
                  <option value="">Todos</option>
                  {ORIGENES_MASIVA.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="mas-f-desde">Detectada desde</label>
                <input
                  id="mas-f-desde"
                  type="date"
                  value={borrador.desde}
                  onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="mas-f-hasta">Detectada hasta</label>
                <input
                  id="mas-f-hasta"
                  type="date"
                  value={borrador.hasta}
                  onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
                />
              </div>
              <div className="acciones-form">
                <button className="btn" type="submit" disabled={cargando}>
                  {cargando ? 'Filtrando…' : 'Filtrar'}
                </button>
                <button type="button" className="btn btn-secundario" onClick={limpiarFiltros}>
                  Limpiar
                </button>
              </div>
            </form>

            {items.length === 0 ? (
              <p className="vacio">No hay masivas que coincidan con los filtros.</p>
            ) : (
              <div className="tabla-envoltura">
                <table className="tabla-resumen">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Estado</th>
                      <th>Origen</th>
                      <th>Descripción</th>
                      <th>Sector</th>
                      <th>Cuadrilla</th>
                      <th>RUTA</th>
                      <th>Detección</th>
                      <th>Casos</th>
                      <th>Indicadores</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.id_falla}>
                        <td className="mono">{m.id_falla}</td>
                        <td>
                          <span className={claseEstadoMasiva(m.estado)}>{m.estado}</span>
                        </td>
                        <td>{m.origen}</td>
                        <td>
                          <span className="masiva-descripcion-corta" title={m.descripcion}>
                            {truncar(m.descripcion)}
                          </span>
                        </td>
                        <td>
                          {txt(m.sector_nombre)}
                          {m.direccion_corta && (
                            <div className="texto-pequeno">{m.direccion_corta}</div>
                          )}
                        </td>
                        <td>{txt(m.cuadrilla_codigo ?? m.cuadrilla_nombre)}</td>
                        <td className="mono">{txt(m.ruta)}</td>
                        <td>{fechaHora(m.fecha_deteccion)}</td>
                        <td>{txt(m.casos_asociados)}</td>
                        <td>
                          <CeldaIndicadores falla={m} />
                        </td>
                        <td>
                          <div className="masiva-personal-acciones masiva-acciones-iconos">
                            <BotonIcono
                              Icono={IconoGestion}
                              etiqueta="Gestionar"
                              tono="primario"
                              onClick={() => abrirGestion(m)}
                            />
                            <BotonIcono
                              Icono={IconoReporte}
                              etiqueta="Reporte"
                              onClick={() => void generarReporte(m.id_falla)}
                              disabled={ocupado === `reporte-${m.id_falla}`}
                            />
                            <BotonIcono
                              Icono={IconoUbicacion}
                              etiqueta="Ubicación"
                              onClick={() => irAUbicacion(m.id_falla)}
                            />
                            <BotonIcono
                              Icono={IconoVer}
                              etiqueta="Ver"
                              onClick={() => setDetalle(m)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <PieTabla
                    colSpan={11}
                    total={items.length}
                    singular="masiva"
                    plural="masivas"
                    cargando={cargando}
                  />
                </table>
              </div>
            )}
          </div>
        )}

        {/* --------------------------- UBICACIÓN ------------------------ */}
        {pestana === 'ubicacion' && (
          <div className="panel-bloque">
            <h2>Ubicación del FAT</h2>
            <div className="formulario filtros-tabla">
              <div className="campo">
                <label htmlFor="mas-u-masiva">Masiva</label>
                <select
                  id="mas-u-masiva"
                  value={idUbicacion}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setIdUbicacion(valor);
                    if (valor === '') {
                      setUbicacion(null);
                      return;
                    }
                    void cargarUbicacion(Number(valor));
                  }}
                >
                  <option value="">— Seleccione una masiva —</option>
                  {opciones.map((m) => (
                    <option key={m.id_falla} value={m.id_falla}>
                      #{m.id_falla} · {m.estado} · {truncar(m.descripcion, 40)}
                    </option>
                  ))}
                </select>
              </div>
              {idUbicacion !== '' && (
                <div className="acciones-form">
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => void cargarUbicacion(Number(idUbicacion))}
                    disabled={cargandoUbicacion}
                  >
                    {cargandoUbicacion ? 'Cargando…' : 'Recargar ubicación'}
                  </button>
                </div>
              )}
            </div>

            {cargandoUbicacion && <p className="vacio">Cargando la ubicación del FAT…</p>}

            {!cargandoUbicacion && ubicacion === null && (
              <p className="vacio">
                Seleccione una masiva para ver en el mapa el FAT afectado y los puntos GPS de sus
                evidencias.
              </p>
            )}

            {!cargandoUbicacion && ubicacion !== null && (
              <>
                <div className="datos-grid">
                  <div className="dato">
                    <span className="dato-etiqueta">Masiva</span>
                    <span className="dato-valor mono">#{ubicacion.id_falla}</span>
                  </div>
                  <div className="dato">
                    <span className="dato-etiqueta">Origen</span>
                    <span className="dato-valor">{txt(ubicacion.origen)}</span>
                  </div>
                  <div className="dato">
                    <span className="dato-etiqueta">OLT</span>
                    <span className="dato-valor mono">{txt(ubicacion.olt)}</span>
                  </div>
                  <div className="dato">
                    <span className="dato-etiqueta">FAT</span>
                    <span className="dato-valor mono">{txt(ubicacion.fat)}</span>
                  </div>
                  <div className="dato">
                    <span className="dato-etiqueta">RUTA</span>
                    <span className="dato-valor mono">{txt(ubicacion.ruta)}</span>
                  </div>
                  <div className="dato">
                    <span className="dato-etiqueta">Sector</span>
                    <span className="dato-valor">{txt(ubicacion.sector_nombre)}</span>
                  </div>
                  <div className="dato dato-ancha">
                    <span className="dato-etiqueta">Dirección</span>
                    <span className="dato-valor">{txt(ubicacion.direccion)}</span>
                  </div>
                </div>

                <MapaFat
                  latitud={ubicacion.latitud}
                  longitud={ubicacion.longitud}
                  etiqueta={`Masiva #${ubicacion.id_falla} · FAT ${ubicacion.fat ?? 'sin identificar'}`}
                  puntos={ubicacion.puntos}
                  // D-145: si el FAT no tiene GPS, se ubica por su dirección.
                  direccion={ubicacion.direccion}
                  urlBusqueda={ubicacion.url_busqueda}
                  geocodificando={geocodificando}
                  onGeocodificar={() => void ubicarPorDireccion()}
                />
              </>
            )}
          </div>
        )}

      </div>

      {/* Formulario de reporte manual */}
      {manualAbierto && (
        <Modal
          titulo="Agregar masiva manual"
          onCerrar={() => setManualAbierto(false)}
        >
          <FormularioMasivaManual
            onCancelar={() => setManualAbierto(false)}
            onCreada={(creada, mensaje) => {
              setManualAbierto(false);
              setOk(mensaje);
              setPestana('gestion');
              setFicha(creada);
              void refrescarTodo();
            }}
          />
        </Modal>
      )}

      {/* Ficha flotante de gestión */}
      {ficha && (
        <FichaMasiva
          falla={ficha}
          onCerrar={() => setFicha(null)}
          onActualizada={masivaActualizada}
        />
      )}

      {/* Detalle de solo lectura de la masiva */}
      {detalle && (
        <Modal titulo={`Masiva #${detalle.id_falla}`} onCerrar={() => setDetalle(null)}>
          <div className="datos-grid">
            <div className="dato">
              <span className="dato-etiqueta">Estado</span>
              <span className="dato-valor">{detalle.estado}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Origen</span>
              <span className="dato-valor">{detalle.origen}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Concentración</span>
              <span className="dato-valor mono">{txt(detalle.clave_concentracion)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">ODN</span>
              <span className="dato-valor mono">{txt(detalle.odn)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">FAT</span>
              <span className="dato-valor mono">{txt(detalle.fat)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">RUTA</span>
              <span className="dato-valor mono">{txt(detalle.ruta)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Sector</span>
              <span className="dato-valor">{txt(detalle.sector_nombre)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Cuadrilla</span>
              <span className="dato-valor">
                {detalle.cuadrilla_codigo
                  ? `${detalle.cuadrilla_codigo} — ${detalle.cuadrilla_nombre ?? ''}`
                  : '—'}
              </span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Casos asociados</span>
              <span className="dato-valor">{txt(detalle.casos_asociados)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Casos cerrados</span>
              <span className="dato-valor">{txt(detalle.casos_cerrados)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Órdenes de material</span>
              <span className="dato-valor">{txt(detalle.ordenes_count)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Detección</span>
              <span className="dato-valor">{fechaHora(detalle.fecha_deteccion)}</span>
            </div>
            <div className="dato dato-ancha">
              <span className="dato-etiqueta">Descripción</span>
              <span className="dato-valor">{txt(detalle.descripcion)}</span>
            </div>
            <div className="dato dato-ancha">
              <span className="dato-etiqueta">Dirección</span>
              <span className="dato-valor">{txt(detalle.direccion ?? detalle.direccion_corta)}</span>
            </div>
            <div className="dato dato-ancha">
              <span className="dato-etiqueta">Planificación</span>
              <span className="dato-valor">{txt(detalle.planificacion)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Validador del CRASS</span>
              <span className="dato-valor">
                {detalle.validador_crass
                  ? `${detalle.validador_crass.nombre} — ${detalle.validador_crass.unidad}`
                  : '—'}
              </span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Cerrada por</span>
              <span className="dato-valor">{txt(detalle.cerrada_por)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Cerrada en</span>
              <span className="dato-valor">{fechaHora(detalle.cerrada_en)}</span>
            </div>
            <div className="dato dato-ancha">
              <span className="dato-etiqueta">Descripción del cierre</span>
              <span className="dato-valor">{txt(detalle.descripcion_cierre)}</span>
            </div>
            <div className="dato dato-ancha">
              <span className="dato-etiqueta">Evidencias</span>
              <span className="dato-valor mono">
                {(detalle.evidencias?.length ?? 0) > 0 ? detalle.evidencias?.join(' · ') : '—'}
              </span>
            </div>
          </div>
          <div className="acciones-form">
            <button
              type="button"
              className="btn"
              onClick={() => {
                const masiva = detalle;
                setDetalle(null);
                abrirGestion(masiva);
              }}
            >
              Gestionar
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => void generarReporte(detalle.id_falla)}
            >
              Generar reporte
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => {
                const id = detalle.id_falla;
                setDetalle(null);
                irAUbicacion(id);
              }}
            >
              Ver ubicación
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Formulario de reporte manual (RF-16)                                */
/* ------------------------------------------------------------------ */

function FormularioMasivaManual({
  onCancelar,
  onCreada,
}: {
  onCancelar: () => void;
  onCreada: (falla: FallaMasivaOut, mensaje: string) => void;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [odn, setOdn] = useState('');
  const [olt, setOlt] = useState('');
  const [slot, setSlot] = useState('');
  const [puerto, setPuerto] = useState('');
  const [direccion, setDireccion] = useState('');
  const [fat, setFat] = useState('');
  const [idSector, setIdSector] = useState('');
  const [idCuadrilla, setIdCuadrilla] = useState('');
  const [origen, setOrigen] = useState<OrigenFallaMasiva>('REPORTE_TECNICO');
  const [evidencias, setEvidencias] = useState<string[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [candidatos, setCandidatos] = useState<CasoCandidatoOut[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.allSettled([
      api.listarSectores({ solo_activos: true }),
      api.listarCuadrillas({ solo_activas: true }),
    ]).then(([sec, cua]) => {
      if (!vivo) return;
      setSectores(sec.status === 'fulfilled' ? sec.value : []);
      setCuadrillas(cua.status === 'fulfilled' ? cua.value : []);
      setCargandoCatalogos(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function buscarCandidatos() {
    if (!olt.trim() || !slot.trim() || !puerto.trim() || !fat.trim()) {
      setError('Complete OLT, SLOT, PUERTO y FAT para buscar los casos.');
      return;
    }
    setError('');
    setBuscando(true);
    try {
      const casos = await api.buscarCasosCandidatos({
        olt: olt.trim(),
        slot: slot.trim(),
        puerto: puerto.trim(),
        fat: fat.trim(),
      });
      setCandidatos(casos);
      setSeleccionados([]);
      if (casos.length === 0) {
        setError('No hay casos de ese FAT. Verifique OLT, SLOT, PUERTO y FAT.');
      }
    } catch (e) {
      setError(detalleDe(e, 'No se pudieron buscar los casos de ese FAT.'));
    } finally {
      setBuscando(false);
    }
  }

  function alternarCaso(idCaso: number) {
    setSeleccionados((previo) =>
      previo.includes(idCaso)
        ? previo.filter((id) => id !== idCaso)
        : [...previo, idCaso],
    );
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (descripcion.trim().length < 5) {
      setError('La descripción es obligatoria y debe tener al menos 5 caracteres.');
      return;
    }
    if (!olt.trim() || !slot.trim() || !puerto.trim() || !fat.trim()) {
      setError('OLT, SLOT, PUERTO y FAT son obligatorios.');
      return;
    }
    if (direccion.trim().length < 5) {
      setError('Indique la dirección (mínimo 5 caracteres).');
      return;
    }
    if (seleccionados.length === 0) {
      setError('Asocie al menos un caso del FAT a la masiva.');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      const datos: FallaMasivaManual = {
        descripcion: descripcion.trim(),
        olt: olt.trim(),
        slot: slot.trim(),
        puerto: puerto.trim(),
        fat: fat.trim(),
        direccion: direccion.trim(),
        origen,
        odn: odn.trim() === '' ? null : odn.trim(),
        id_sector: idSector === '' ? null : Number(idSector),
        id_cuadrilla: idCuadrilla === '' ? null : Number(idCuadrilla),
        evidencias,
        ids_caso: seleccionados,
      };
      const creada = await api.reportarFallaManual(datos);
      onCreada(creada, `Masiva #${creada.id_falla} registrada manualmente.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo registrar la masiva manual.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="formulario modal-formulario" onSubmit={(e) => void enviar(e)}>
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />

      <div className="campo campo-ancho">
        <label htmlFor="mas-manual-descripcion">Descripción * (mín. 5)</label>
        <textarea
          id="mas-manual-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
          minLength={5}
          maxLength={500}
          rows={3}
          placeholder="Ej.: corte de fibra en el FAT F-12, 24 servicios afectados"
        />
      </div>

      <div className="campo">
        <label htmlFor="mas-manual-olt">OLT *</label>
        <input
          id="mas-manual-olt"
          value={olt}
          onChange={(e) => setOlt(e.target.value)}
          required
          maxLength={60}
          placeholder="Ej.: OLT-NORTE-01"
        />
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-slot">SLOT *</label>
        <input
          id="mas-manual-slot"
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          required
          maxLength={20}
          placeholder="Ej.: 3"
        />
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-puerto">PUERTO *</label>
        <input
          id="mas-manual-puerto"
          value={puerto}
          onChange={(e) => setPuerto(e.target.value)}
          required
          maxLength={20}
          placeholder="Ej.: 7"
        />
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-fat">FAT *</label>
        <input
          id="mas-manual-fat"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
          required
          maxLength={60}
          placeholder="Ej.: F-12"
        />
      </div>
      <div className="campo campo-ancho">
        <label htmlFor="mas-manual-direccion">Dirección * (mín. 5)</label>
        <input
          id="mas-manual-direccion"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          required
          minLength={5}
          maxLength={200}
          placeholder="Ej.: Av. Bolívar, entre calle 3 y 4"
        />
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-odn">ODN (opcional)</label>
        <input
          id="mas-manual-odn"
          value={odn}
          onChange={(e) => setOdn(e.target.value)}
          maxLength={60}
          placeholder="Ej.: ODN-01-02-03"
        />
      </div>

      <div className="campo campo-ancho">
        <div className="acciones-form">
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void buscarCandidatos()}
            disabled={buscando || !olt.trim() || !slot.trim() || !puerto.trim() || !fat.trim()}
          >
            {buscando ? 'Buscando…' : 'Buscar casos de ese FAT'}
          </button>
          <span className="texto-pequeno">
            {seleccionados.length} caso(s) seleccionado(s)
          </span>
        </div>
        {candidatos.length > 0 && (
          <div className="tabla-envoltura">
            <table className="masiva-tabla-densa">
              <thead>
                <tr>
                  <th>Asociar</th>
                  <th>Avería</th>
                  <th>Estado</th>
                  <th>OLT</th>
                  <th>Slot/Puerto</th>
                  <th>FAT</th>
                  <th>Dirección</th>
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c) => (
                  <tr key={c.id_caso}>
                    <td>
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(c.id_caso)}
                        onChange={() => alternarCaso(c.id_caso)}
                        aria-label={`Asociar el caso ${c.id_averia}`}
                      />
                    </td>
                    <td className="mono">{c.id_averia}</td>
                    <td>{c.estado_actual}</td>
                    <td className="mono">{c.olt ?? '—'}</td>
                    <td className="mono">
                      {[c.slot, c.puerto].filter(Boolean).join('/') || '—'}
                    </td>
                    <td className="mono">{c.fat ?? '—'}</td>
                    <td>{c.direccion ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="campo">
        <label htmlFor="mas-manual-sector">Sector</label>
        <select
          id="mas-manual-sector"
          value={idSector}
          onChange={(e) => setIdSector(e.target.value)}
          disabled={cargandoCatalogos}
        >
          <option value="">Sin sector</option>
          {sectores.map((s) => (
            <option key={s.id_sector} value={s.id_sector}>
              {s.nombre} ({s.codigo})
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-cuadrilla">Cuadrilla</label>
        <select
          id="mas-manual-cuadrilla"
          value={idCuadrilla}
          onChange={(e) => setIdCuadrilla(e.target.value)}
          disabled={cargandoCatalogos}
        >
          <option value="">Sin cuadrilla</option>
          {cuadrillas.map((c) => (
            <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
              {c.codigo} — {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="mas-manual-origen">Origen</label>
        <select
          id="mas-manual-origen"
          value={origen}
          onChange={(e) => setOrigen(e.target.value as OrigenFallaMasiva)}
        >
          {ORIGENES_MASIVA.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <ListaEvidencias
        idBase="mas-manual"
        etiqueta="Evidencias (seriales)"
        valores={evidencias}
        onCambiar={setEvidencias}
        maximo={MAX_EVIDENCIAS_REPORTE}
      />

      <div className="acciones-form">
        <button
          type="submit"
          className="btn"
          disabled={
            enviando ||
            descripcion.trim().length < 5 ||
            !olt.trim() ||
            !slot.trim() ||
            !puerto.trim() ||
            !fat.trim() ||
            direccion.trim().length < 5 ||
            seleccionados.length === 0
          }
        >
          {enviando ? 'Registrando…' : 'Registrar masiva'}
        </button>
        <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
