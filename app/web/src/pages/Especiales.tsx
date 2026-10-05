import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/client';
import type {
  CasoEspecialOut,
  Cuadrilla,
  CasoEspecialUpdate,
  CasosEspecialesFiltros,
  ClasificacionEspecial,
  EstadoEspecial,
  PrioridadEspecial,
  Solicitante,
  TipoActividadEspecial,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import EstadoChips from '../components/EstadoChips';
import { CeldaActividad, CeldaClase, CeldaPrioridad } from '../components/CeldasIcono';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

const CLASIFICACIONES: ClasificacionEspecial[] = ['REFERIDO', 'EMPRESA', 'GOBIERNO'];
const ACTIVIDADES: TipoActividadEspecial[] = ['REPARACION', 'CONSTRUCCION'];
const PRIORIDADES: PrioridadEspecial[] = ['ALTA', 'MEDIA', 'BAJA'];
const ESTADOS: EstadoEspecial[] = ['ABIERTO', 'EN_PROCESO', 'ATENDIDO', 'CERRADO'];

interface Filtros {
  /** D-72: texto libre sobre todos los renglones de la tabla. */
  q: string;
  /** D-72: «Tipo» = clasificación del especial (REFERIDO/EMPRESA/GOBIERNO). */
  clasificacion: string;
  prioridad: string;
  /** D-72: actividad (REPARACION/CONSTRUCCION). */
  tipo_actividad: string;
  /** D-72: solicitante registrado. */
  id_solicitante: string;
  estado: string;
  solo_pendientes: boolean;
}

const FILTROS_VACIOS: Filtros = {
  q: '',
  clasificacion: '',
  prioridad: '',
  tipo_actividad: '',
  id_solicitante: '',
  estado: '',
  solo_pendientes: false,
};

interface EdicionForm {
  prioridad: PrioridadEspecial;
  estado: EstadoEspecial;
  descripcion: string;
  requiere_informe: boolean;
}

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function fechaHora(valor: string | null): string {
  return valor ? valor.replace('T', ' ').slice(0, 19) : '—';
}

function clasePrioridad(prioridad: string): string {
  return `prioridad prioridad-${prioridad.toLowerCase()}`;
}

function aEdicion(c: CasoEspecialOut): EdicionForm {
  return {
    prioridad: c.prioridad as PrioridadEspecial,
    estado: c.estado as EstadoEspecial,
    descripcion: c.descripcion ?? '',
    requiere_informe: c.requiere_informe,
  };
}

export default function Especiales() {
  const { soloLectura } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // D-77: selección múltiple para asignar los especiales a una cuadrilla.
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [cuadrillaDestino, setCuadrillaDestino] = useState('');
  const [asignando, setAsignando] = useState(false);

  // Filtros + listado.
  const [borrador, setBorrador] = useState<Filtros>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VACIOS);
  const [items, setItems] = useState<CasoEspecialOut[]>([]);
  const [cargando, setCargando] = useState(true);
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);

  // Ficha / edición.
  const [seleccion, setSeleccion] = useState<CasoEspecialOut | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [edicion, setEdicion] = useState<EdicionForm>({
    prioridad: 'MEDIA',
    estado: 'ABIERTO',
    descripcion: '',
    requiere_informe: true,
  });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (soloLectura) return;
    api
      .listarCuadrillas({ solo_activas: true })
      .then(setCuadrillas)
      .catch(() => setCuadrillas([]));
  }, [soloLectura]);

  /** D-77: alterna la selección de un caso especial. */
  function alternarSeleccion(idCasoEspecial: number) {
    setMarcados((actual) => {
      const copia = new Set(actual);
      if (copia.has(idCasoEspecial)) copia.delete(idCasoEspecial);
      else copia.add(idCasoEspecial);
      return copia;
    });
  }

  /** D-77: marca o desmarca todos los especiales de la página. */
  function alternarTodos(ids: number[]) {
    setMarcados((actual) => {
      const copia = new Set(actual);
      const todos = ids.every((id) => copia.has(id));
      ids.forEach((id) => (todos ? copia.delete(id) : copia.add(id)));
      return copia;
    });
  }

  /** D-77: asigna los especiales seleccionados a la cuadrilla elegida. */
  async function asignarSeleccion() {
    if (marcados.size === 0 || !cuadrillaDestino) return;
    setAsignando(true);
    setError('');
    setOk('');
    try {
      const r = await api.asignarCasosCuadrilla({
        id_cuadrilla: Number(cuadrillaDestino),
        ids_caso_especial: [...marcados],
      });
      setOk(r.mensaje);
      setMarcados(new Set());
      await cargarLista();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudieron asignar los especiales.');
    } finally {
      setAsignando(false);
    }
  }

  /** D-77: saca los especiales seleccionados del despacho del día. */
  async function quitarSeleccion() {
    if (marcados.size === 0) return;
    setAsignando(true);
    setError('');
    setOk('');
    try {
      const r = await api.quitarCasosCuadrilla({ ids_caso_especial: [...marcados] });
      setOk(r.mensaje);
      setMarcados(new Set());
      await cargarLista();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudieron quitar los especiales.');
    } finally {
      setAsignando(false);
    }
  }

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: CasosEspecialesFiltros = {
        q: aplicados.q,
        clasificacion: aplicados.clasificacion,
        estado: aplicados.estado,
        prioridad: aplicados.prioridad,
        tipo_actividad: aplicados.tipo_actividad,
      };
      if (aplicados.id_solicitante !== '') filtros.id_solicitante = Number(aplicados.id_solicitante);
      if (aplicados.solo_pendientes) filtros.solo_pendientes = true;
      setItems(await api.listarCasosEspeciales(filtros));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al listar los casos especiales.'));
    } finally {
      setCargando(false);
    }
  }, [aplicados]);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  // Solicitantes para el filtro por nombre (D-72).
  useEffect(() => {
    let vivo = true;
    api
      .listarSolicitantes()
      .then((s) => vivo && setSolicitantes(s))
      .catch(() => vivo && setSolicitantes([]));
    return () => {
      vivo = false;
    };
  }, []);

  function filtrar(evento: FormEvent) {
    evento.preventDefault();
    setAplicados({ ...borrador });
  }

  function limpiar() {
    setBorrador(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
    setSeleccion(null);
    setOk('');
    setError('');
  }

  async function abrirFicha(idCasoEspecial: number) {
    setError('');
    setOk('');
    setCargandoDetalle(true);
    try {
      const obj = await api.obtenerCasoEspecial(idCasoEspecial);
      setSeleccion(obj);
      setEdicion(aEdicion(obj));
    } catch (e) {
      setError(detalleDe(e, 'Error al obtener el caso especial.'));
    } finally {
      setCargandoDetalle(false);
    }
  }

  /** Cada registro abre el caso asociado o, si no lo hay, el detalle especial. */
  function abrirRegistro(c: CasoEspecialOut) {
    if (c.id_caso !== null) {
      navigate('/casos', { state: { abrirCaso: c.id_caso } });
      return;
    }
    void abrirFicha(c.id_caso_especial);
  }

  async function guardarEdicion(evento: FormEvent) {
    evento.preventDefault();
    if (!seleccion) return;
    setError('');
    setOk('');

    const payload: CasoEspecialUpdate = {};
    if (edicion.prioridad !== seleccion.prioridad) payload.prioridad = edicion.prioridad;
    if (edicion.estado !== seleccion.estado) payload.estado = edicion.estado;
    if (edicion.descripcion !== (seleccion.descripcion ?? '')) {
      payload.descripcion = nv(edicion.descripcion);
    }
    if (edicion.requiere_informe !== seleccion.requiere_informe) {
      payload.requiere_informe = edicion.requiere_informe;
    }
    if (Object.keys(payload).length === 0) {
      setOk('No hay cambios que guardar.');
      return;
    }

    setGuardando(true);
    try {
      const actualizado = await api.actualizarCasoEspecial(seleccion.id_caso_especial, payload);
      setSeleccion(actualizado);
      setEdicion(aEdicion(actualizado));
      setOk('Caso especial actualizado.');
      await cargarLista();
    } catch (e) {
      setError(detalleDe(e, 'Error al guardar los cambios del caso especial.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Especiales</h1>
          <p>
            Empresas, referidos y gobierno. Use «Agregar caso» en la barra superior para registrar
            uno nuevo.
          </p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {soloLectura && (
        <div className="aviso aviso-info">
          <span>
            Modo solo lectura: su rol TECNICO no permite modificar casos especiales. Puede consultar
            el listado y las fichas.
          </span>
        </div>
      )}

      {/* Filtros + listado */}
      <div className="panel-bloque">
        <h2>Listado de casos especiales</h2>
        <form className="formulario filtros-tabla" onSubmit={filtrar}>
          <div className="campo">
            <label htmlFor="filtro-q">Texto libre</label>
            <input
              id="filtro-q"
              value={borrador.q}
              onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
              placeholder="Busca en todos los renglones: tipo, sector, prioridad, solicitante, dirección, nombre, estado…"
            />
          </div>
          <div className="campo">
            <label htmlFor="filtro-clasificacion">Tipo</label>
            <select
              id="filtro-clasificacion"
              value={borrador.clasificacion}
              onChange={(e) => setBorrador({ ...borrador, clasificacion: e.target.value })}
            >
              <option value="">Todos</option>
              {CLASIFICACIONES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-prioridad">Prioridad</label>
            <select
              id="filtro-prioridad"
              value={borrador.prioridad}
              onChange={(e) => setBorrador({ ...borrador, prioridad: e.target.value })}
            >
              <option value="">Todas</option>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-actividad">Actividad</label>
            <select
              id="filtro-actividad"
              value={borrador.tipo_actividad}
              onChange={(e) => setBorrador({ ...borrador, tipo_actividad: e.target.value })}
            >
              <option value="">Todas</option>
              {ACTIVIDADES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-solicitante">Solicitante</label>
            <select
              id="filtro-solicitante"
              value={borrador.id_solicitante}
              onChange={(e) => setBorrador({ ...borrador, id_solicitante: e.target.value })}
            >
              <option value="">Todos</option>
              {solicitantes.map((s) => (
                <option key={s.id_solicitante} value={s.id_solicitante}>
                  {s.nombre} — {s.unidad}
                </option>
              ))}
            </select>
          </div>
          <div className="campo campo-check">
            <input
              id="filtro-pendientes"
              type="checkbox"
              checked={borrador.solo_pendientes}
              onChange={(e) => setBorrador({ ...borrador, solo_pendientes: e.target.checked })}
            />
            <label htmlFor="filtro-pendientes">Solo pendientes (ABIERTO / EN_PROCESO)</label>
          </div>
          <div className="acciones-form">
            <button className="btn" type="submit" disabled={cargando}>
              {cargando ? 'Filtrando…' : 'Filtrar'}
            </button>
            <button type="button" className="btn btn-secundario" onClick={limpiar}>
              Limpiar
            </button>
          </div>
        </form>

        <div className="barra-paginacion">
          <span className="texto-pequeno">
            {cargando ? 'Cargando…' : `Total: ${items.length} caso(s) especial(es)`}
          </span>
        </div>

        {!soloLectura && items.length > 0 && (
          <div className="barra-asignacion">
            <span className="texto-pequeno">
              {marcados.size === 0
                ? 'Seleccione especiales para asignarlos a una cuadrilla'
                : `${marcados.size} especial(es) seleccionado(s)`}
            </span>
            <label className="texto-pequeno" htmlFor="cuadrilla-destino-esp">
              Cuadrilla
            </label>
            <select
              id="cuadrilla-destino-esp"
              value={cuadrillaDestino}
              onChange={(e) => setCuadrillaDestino(e.target.value)}
            >
              <option value="">— Seleccione —</option>
              {cuadrillas.map((c) => (
                <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
                  {c.codigo}
                  {c.es_supervisor ? ' (supervisor)' : ''} — {c.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-mini"
              disabled={asignando || marcados.size === 0 || !cuadrillaDestino}
              onClick={() => void asignarSeleccion()}
            >
              {asignando ? 'Procesando…' : 'Asignar a cuadrilla'}
            </button>
            <button
              type="button"
              className="btn btn-mini btn-secundario"
              disabled={asignando || marcados.size === 0}
              onClick={() => void quitarSeleccion()}
            >
              Quitar del despacho
            </button>
            {marcados.size > 0 && (
              <button
                type="button"
                className="btn btn-mini btn-secundario"
                onClick={() => setMarcados(new Set())}
              >
                Limpiar selección
              </button>
            )}
          </div>
        )}

        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="vacio">No hay casos especiales que coincidan con los filtros.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla-resumen">
              <thead>
                <tr>
                  {!soloLectura && (
                    <th className="col-seleccion">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && items.every((c) => marcados.has(c.id_caso_especial))}
                        aria-label="Seleccionar todos los especiales de la página"
                        onChange={() => alternarTodos(items.map((c) => c.id_caso_especial))}
                      />
                    </th>
                  )}
                  <th>Tipo</th>
                  <th>Actividad</th>
                  <th>Prioridad</th>
                  <th>Sector</th>
                  <th>Dirección</th>
                  <th>Nombre</th>
                  <th>Solicitante</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr
                    key={c.id_caso_especial}
                    className={`fila-clicable${marcados.has(c.id_caso_especial) ? ' fila-seleccionada' : ''}`}
                    tabIndex={0}
                    onClick={() => abrirRegistro(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        abrirRegistro(c);
                      }
                    }}
                  >
                    {!soloLectura && (
                      <td className="col-seleccion">
                        <input
                          type="checkbox"
                          checked={marcados.has(c.id_caso_especial)}
                          aria-label={`Seleccionar el especial ${c.id_caso_especial}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => alternarSeleccion(c.id_caso_especial)}
                        />
                      </td>
                    )}
                    <td>
                      <CeldaClase valor={c.clasificacion} />
                    </td>
                    <td>
                      <CeldaActividad valor={c.tipo_actividad} />
                    </td>
                    <td>
                      <CeldaPrioridad valor={c.prioridad} />
                    </td>
                    <td>{c.sector_nombre ?? '—'}</td>
                    <td>{c.direccion ?? '—'}</td>
                    <td>{c.nombre_cliente ?? c.solicitante_nombre ?? '—'}</td>
                    <td>
                      {c.solicitante_nombre ?? '—'}
                      {c.solicitante_unidad && (
                        <div className="texto-pequeno">{c.solicitante_unidad}</div>
                      )}
                    </td>
                    <td>
                      <EstadoChips
                        pendiente={c.pendiente}
                        asignado={c.asignado}
                        citado={c.citado}
                        gestion={c.gestion}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <PieTabla
                colSpan={soloLectura ? 8 : 9}
                total={items.length}
                singular="caso"
                plural="casos"
                cargando={cargando}
              />
            </table>
          </div>
        )}
      </div>

      {/* Ficha + edición del caso especial sin caso asociado, en ventana flotante. */}
      {cargandoDetalle && <p className="texto-pequeno">Cargando ficha…</p>}
      {seleccion && (
        <Modal
          titulo={`Ficha del caso especial #${seleccion.id_caso_especial}`}
          onCerrar={() => setSeleccion(null)}
        >
          <div className="tabla-envoltura">
            <table className="tabla-ficha">
              <tbody>
                <tr>
                  <th>ID caso especial</th>
                  <td className="mono">{seleccion.id_caso_especial}</td>
                </tr>
                <tr>
                  <th>ID caso asociado</th>
                  <td>{seleccion.id_caso ?? '—'}</td>
                </tr>
                <tr>
                  <th>ID solicitante</th>
                  <td>{seleccion.id_solicitante ?? '—'}</td>
                </tr>
                <tr>
                  <th>Solicitante</th>
                  <td>
                    {seleccion.solicitante_nombre ?? '—'}
                    {seleccion.solicitante_unidad && ` — ${seleccion.solicitante_unidad}`}
                  </td>
                </tr>
                <tr>
                  <th>Clasificación</th>
                  <td>{seleccion.clasificacion}</td>
                </tr>
                <tr>
                  <th>Tipo de actividad</th>
                  <td>{seleccion.tipo_actividad}</td>
                </tr>
                <tr>
                  <th>Sector</th>
                  <td>{seleccion.sector_nombre ?? '—'}</td>
                </tr>
                <tr>
                  <th>Prioridad</th>
                  <td>
                    <span className={clasePrioridad(seleccion.prioridad)}>
                      {seleccion.prioridad}
                    </span>
                  </td>
                </tr>
                <tr>
                  <th>Estado</th>
                  <td>{seleccion.estado}</td>
                </tr>
                <tr>
                  <th>¿Tiene ID de avería?</th>
                  <td>{seleccion.tiene_id_averia ? 'Sí' : 'No'}</td>
                </tr>
                <tr>
                  <th>¿Requiere informe?</th>
                  <td>{seleccion.requiere_informe ? 'Sí' : 'No'}</td>
                </tr>
                <tr>
                  <th>Descripción</th>
                  <td>{seleccion.descripcion ?? '—'}</td>
                </tr>
                <tr>
                  <th>Creado en</th>
                  <td>{fechaHora(seleccion.creado_en)}</td>
                </tr>
                <tr>
                  <th>Actualizado en</th>
                  <td>{fechaHora(seleccion.actualizado_en)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {!soloLectura && (
            <>
              <h3 className="subtitulo-seccion">Editar caso especial</h3>
              <form className="formulario modal-formulario" onSubmit={(e) => void guardarEdicion(e)}>
                <div className="campo">
                  <label htmlFor="edit-prioridad">Prioridad</label>
                  <select
                    id="edit-prioridad"
                    value={edicion.prioridad}
                    onChange={(e) =>
                      setEdicion({ ...edicion, prioridad: e.target.value as PrioridadEspecial })
                    }
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="edit-estado">Estado</label>
                  <select
                    id="edit-estado"
                    value={edicion.estado}
                    onChange={(e) =>
                      setEdicion({ ...edicion, estado: e.target.value as EstadoEspecial })
                    }
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo campo-check">
                  <input
                    id="edit-informe"
                    type="checkbox"
                    checked={edicion.requiere_informe}
                    onChange={(e) =>
                      setEdicion({ ...edicion, requiere_informe: e.target.checked })
                    }
                  />
                  <label htmlFor="edit-informe">Requiere informe</label>
                </div>
                <div className="campo campo-ancho">
                  <label htmlFor="edit-descripcion">Descripción</label>
                  <textarea
                    id="edit-descripcion"
                    value={edicion.descripcion}
                    onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })}
                  />
                </div>
                <div className="acciones-form">
                  <button className="btn" type="submit" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => setEdicion(aEdicion(seleccion))}
                    disabled={guardando}
                  >
                    Descartar cambios
                  </button>
                </div>
              </form>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
