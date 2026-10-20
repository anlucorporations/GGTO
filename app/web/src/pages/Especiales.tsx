import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/client';
import type {
  CasoEspecialCreate,
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
import { CeldaPrioridad, CeldaReporte, aspectoActividad, aspectoClase } from '../components/CeldasIcono';
import CeldaSector from '../components/CeldaSector';
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
  // D-133 · H-16: informe de atención (obligatorio al cerrar si requiere_informe).
  informe: string;
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
    informe: c.informe ?? '',
  };
}

export default function Especiales() {
  const { soloLectura, usuario } = useAuth();
  const navigate = useNavigate();
  const rol = usuario?.rol ?? '';
  const puedeGestionar = ['ADMIN', 'SUPERVISOR'].includes(rol);
  const puedeCrear = ['ADMIN', 'SUPERVISOR', 'COORDINADOR'].includes(rol);

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // D-79: cuadrillas para el bloque Despacho de la ficha.
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
    informe: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [crearAbierto, setCrearAbierto] = useState(false);

  useEffect(() => {
    if (!puedeGestionar) return;
    api
      .listarCuadrillas({ solo_activas: true })
      .then(setCuadrillas)
      .catch(() => setCuadrillas([]));
  }, [puedeGestionar]);

  /** D-79: asigna el especial abierto a la cuadrilla elegida (despacho de hoy). */
  async function asignarCuadrilla() {
    if (!seleccion || !cuadrillaDestino) return;
    setAsignando(true);
    setError('');
    setOk('');
    try {
      const r = await api.asignarCasosCuadrilla({
        id_cuadrilla: Number(cuadrillaDestino),
        ids_caso_especial: [seleccion.id_caso_especial],
      });
      setOk(r.mensaje);
      setCuadrillaDestino('');
      // Refrescar la ficha y el listado
      const actualizado = await api.obtenerCasoEspecial(seleccion.id_caso_especial);
      setSeleccion(actualizado);
      await cargarLista();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo asignar el especial.');
    } finally {
      setAsignando(false);
    }
  }

  /** D-79: retira el especial abierto del despacho del día. */
  async function quitarCuadrilla() {
    if (!seleccion) return;
    setAsignando(true);
    setError('');
    setOk('');
    try {
      const r = await api.quitarCasosCuadrilla({ ids_caso_especial: [seleccion.id_caso_especial] });
      setOk(r.mensaje);
      const actualizado = await api.obtenerCasoEspecial(seleccion.id_caso_especial);
      setSeleccion(actualizado);
      await cargarLista();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo quitar el especial del despacho.');
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

  async function crearEspecial(datos: CasoEspecialCreate) {
    setGuardando(true);
    setError('');
    try {
      const creado = await api.crearCasoEspecial(datos);
      setCrearAbierto(false);
      // D-122: si la jornada ya está publicada (o el sector no tiene cuadrilla),
      // el especial no llega hoy a la APK: se dice expresamente.
      setOk(
        creado.aviso
          ? `Caso especial creado. ${creado.aviso}`
          : 'Caso especial creado.',
      );
      await cargarLista();
    } catch (e) {
      setError(detalleDe(e, 'No se pudo crear el caso especial.'));
    } finally {
      setGuardando(false);
    }
  }

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

  /** D-79: la fila abre siempre la ficha del especial (no salta a CASOS). */
  function abrirRegistro(c: CasoEspecialOut) {
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
    if (edicion.informe !== (seleccion.informe ?? '')) {
      payload.informe = nv(edicion.informe);
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
          <p>Empresas, referidos y gobierno.</p>
        </div>
        {puedeCrear && (
          <button type="button" className="btn" onClick={() => setCrearAbierto(true)}>
            Crear caso especial
          </button>
        )}
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



        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="vacio">No hay casos especiales que coincidan con los filtros.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla-resumen">
              <thead>
                <tr>
                  {/* D-103: Tipo y Actividad se unen en REPORTE (solo iconos)
                      para dar más ancho a Dirección. */}
                  <th>Reporte</th>
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
                    className="fila-clicable"
                    tabIndex={0}
                    onClick={() => abrirRegistro(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        abrirRegistro(c);
                      }
                    }}
                  >
                    <td>
                      <CeldaReporte
                        aspectos={[
                          aspectoClase(c.clasificacion),
                          aspectoActividad(c.tipo_actividad),
                        ]}
                      />
                    </td>
                    <td>
                      <CeldaPrioridad valor={c.prioridad} />
                    </td>
                    <td>
                      <CeldaSector sector={c.sector_nombre} fat={c.fat} />
                    </td>
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
                        id_cuadrilla={c.id_cuadrilla}
                        cuadrilla_codigo={c.cuadrilla_codigo}
                        cuadrilla_nombre={c.cuadrilla_nombre}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <PieTabla
                colSpan={8}
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
                <tr>
                  <th>Cuadrilla actual</th>
                  <td>
                    {seleccion.cuadrilla_codigo
                      ? `${seleccion.cuadrilla_codigo}${seleccion.cuadrilla_nombre ? ` — ${seleccion.cuadrilla_nombre}` : ''}`
                      : 'Sin despacho'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* D-79: enlace al caso asociado si existe */}
          {seleccion.id_caso !== null && (
            <div className="acciones-form" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => navigate('/casos', { state: { abrirCaso: seleccion.id_caso } })}
              >
                Abrir en CASOS
              </button>
            </div>
          )}

          {/* D-79: bloque Despacho para asignar/quitar el especial */}
          {puedeGestionar && (
            <>
              <h3 className="subtitulo-seccion">Despacho</h3>
              <div className="formulario modal-formulario">
                <div className="fila-campos">
                  <div className="campo">
                    <label htmlFor="esp-cuadrilla-destino">Cuadrilla destino</label>
                    <select
                      id="esp-cuadrilla-destino"
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
                  </div>
                </div>
                <div className="acciones-form">
                  <button
                    type="button"
                    className="btn"
                    disabled={asignando || !cuadrillaDestino}
                    onClick={() => void asignarCuadrilla()}
                  >
                    {asignando ? 'Procesando…' : 'Asignar a cuadrilla'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    disabled={asignando}
                    onClick={() => void quitarCuadrilla()}
                  >
                    Quitar del despacho
                  </button>
                </div>
                <span className="texto-pequeno">
                  La asignación se aplica al despacho de hoy. Asignar a la cuadrilla 0 deja el caso
                  como gestión del supervisor.
                </span>
              </div>
            </>
          )}

          {puedeGestionar && (
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
                  {edicion.requiere_informe && (
                    <div style={{ marginTop: 8 }}>
                      <label htmlFor="edit-informe-texto">Informe de atención</label>
                      <textarea
                        id="edit-informe-texto"
                        value={edicion.informe}
                        onChange={(e) => setEdicion({ ...edicion, informe: e.target.value })}
                        placeholder="Obligatorio al cerrar: mínimo 20 caracteres (D-133)"
                        rows={3}
                      />
                    </div>
                  )}
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
      {crearAbierto && (
        <Modal titulo="Crear caso especial" onCerrar={() => setCrearAbierto(false)}>
          <FormularioCrearEspecial
            solicitantes={solicitantes}
            guardando={guardando}
            onCancelar={() => setCrearAbierto(false)}
            onCrear={(datos) => void crearEspecial(datos)}
          />
        </Modal>
      )}
    </>
  );
}

function FormularioCrearEspecial({
  solicitantes,
  guardando,
  onCancelar,
  onCrear,
}: {
  solicitantes: Solicitante[];
  guardando: boolean;
  onCancelar: () => void;
  onCrear: (datos: CasoEspecialCreate) => void;
}) {
  const [clasificacion, setClasificacion] = useState<ClasificacionEspecial>('REFERIDO');
  const [actividad, setActividad] = useState<TipoActividadEspecial>('REPARACION');
  const [prioridad, setPrioridad] = useState<PrioridadEspecial>('MEDIA');
  const [idSolicitante, setIdSolicitante] = useState('');
  const [nuevoSolicitante, setNuevoSolicitante] = useState(false);
  const [solUnidad, setSolUnidad] = useState('');
  const [solNombre, setSolNombre] = useState('');
  const [solContacto, setSolContacto] = useState('');
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [averia, setAveria] = useState('');
  const [tipoProblema, setTipoProblema] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [requiereInforme, setRequiereInforme] = useState(true);
  const [error, setError] = useState('');

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    // RN-AL-01: los datos del alta y del solicitante son obligatorios.
    const faltaSolicitante = nuevoSolicitante
      ? !solUnidad.trim() || !solNombre.trim() || !solContacto.trim()
      : !idSolicitante;
    if (faltaSolicitante) {
      setError(
        'Datos del solicitante obligatorios: indique uno registrado o complete ' +
          'unidad, nombre y contacto del nuevo.',
      );
      return;
    }
    if (
      !nombre.trim() ||
      !contacto.trim() ||
      !telefono.trim() ||
      !direccion.trim()
    ) {
      setError(
        'Complete nombre y teléfono de contacto, dirección del inmueble y el ' +
          'teléfono con el identificador de pago (70*).',
      );
      return;
    }
    if (actividad === 'REPARACION' && (!averia.trim() || !tipoProblema.trim())) {
      setError(
        'En un reporte de REPARACIÓN son obligatorios el ID de avería y el tipo de problema.',
      );
      return;
    }
    setError('');
    onCrear({
      clasificacion,
      tipo_actividad: actividad,
      prioridad,
      requiere_informe: requiereInforme,
      id_solicitante: nuevoSolicitante ? null : Number(idSolicitante),
      crear_solicitante: nuevoSolicitante
        ? {
            unidad: solUnidad.trim(),
            nombre: solNombre.trim(),
            contacto: solContacto.trim(),
            canal: 'MANUAL',
          }
        : undefined,
      nombre_cliente: nombre.trim(),
      contacto_cliente: contacto.trim(),
      id_averia: averia.trim() || null,
      tipo_problema: tipoProblema.trim() || null,
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      descripcion: descripcion.trim() || null,
    });
  }

  return (
    <form className="formulario modal-formulario" onSubmit={enviar}>
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <div className="campo">
        <label htmlFor="esp-nuevo-clasificacion">Clasificación</label>
        <select id="esp-nuevo-clasificacion" value={clasificacion}
          onChange={(e) => setClasificacion(e.target.value as ClasificacionEspecial)}>
          {CLASIFICACIONES.map((valor) => <option key={valor}>{valor}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="esp-nuevo-actividad">Tipo de reporte *</label>
        <select id="esp-nuevo-actividad" value={actividad}
          onChange={(e) => setActividad(e.target.value as TipoActividadEspecial)}>
          {ACTIVIDADES.map((valor) => (
            <option key={valor} value={valor}>
              {valor === 'REPARACION' ? 'Reparación' : 'Construcción'}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="esp-nuevo-prioridad">Prioridad</label>
        <select id="esp-nuevo-prioridad" value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as PrioridadEspecial)}>
          {PRIORIDADES.map((valor) => <option key={valor}>{valor}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="esp-nuevo-solicitante">Solicitante registrado *</label>
        <select id="esp-nuevo-solicitante" value={idSolicitante}
          disabled={nuevoSolicitante}
          onChange={(e) => setIdSolicitante(e.target.value)}>
          <option value="">Seleccione un solicitante…</option>
          {solicitantes.map((s) => (
            <option key={s.id_solicitante} value={s.id_solicitante}>
              {s.nombre} — {s.unidad}
            </option>
          ))}
        </select>
      </div>
      <div className="campo campo-check">
        <input id="esp-nuevo-sol-nuevo" type="checkbox" checked={nuevoSolicitante}
          onChange={(e) => setNuevoSolicitante(e.target.checked)} />
        <label htmlFor="esp-nuevo-sol-nuevo">Registrar un solicitante nuevo</label>
      </div>
      {nuevoSolicitante && (
        <>
          <div className="campo">
            <label htmlFor="esp-nuevo-sol-unidad">Solicitante — unidad *</label>
            <input id="esp-nuevo-sol-unidad" required value={solUnidad}
              onChange={(e) => setSolUnidad(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="esp-nuevo-sol-nombre">Solicitante — nombre *</label>
            <input id="esp-nuevo-sol-nombre" required value={solNombre}
              onChange={(e) => setSolNombre(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="esp-nuevo-sol-contacto">Solicitante — contacto *</label>
            <input id="esp-nuevo-sol-contacto" required value={solContacto}
              onChange={(e) => setSolContacto(e.target.value)} />
          </div>
        </>
      )}
      <div className="campo">
        <label htmlFor="esp-nuevo-cliente">Nombre de contacto *</label>
        <input id="esp-nuevo-cliente" required value={nombre}
          onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="esp-nuevo-contacto">Teléfono de contacto *</label>
        <input id="esp-nuevo-contacto" required type="tel" value={contacto}
          onChange={(e) => setContacto(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="esp-nuevo-averia">ID de avería {actividad === 'REPARACION' ? '*' : ''}</label>
        <input id="esp-nuevo-averia" required={actividad === 'REPARACION'} value={averia}
          onChange={(e) => setAveria(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="esp-nuevo-tipo-problema">
          Tipo de problema {actividad === 'REPARACION' ? '*' : ''}
        </label>
        <input id="esp-nuevo-tipo-problema" maxLength={20}
          required={actividad === 'REPARACION'} value={tipoProblema}
          onChange={(e) => setTipoProblema(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="esp-nuevo-telefono">Teléfono — identificador de pago (70*) *</label>
        <input id="esp-nuevo-telefono" required value={telefono}
          placeholder="7014000848" onChange={(e) => setTelefono(e.target.value)} />
      </div>
      <div className="campo campo-ancho">
        <label htmlFor="esp-nuevo-direccion">Dirección del inmueble *</label>
        <input id="esp-nuevo-direccion" required value={direccion}
          onChange={(e) => setDireccion(e.target.value)} />
      </div>
      <div className="campo campo-ancho">
        <label htmlFor="esp-nuevo-descripcion">Descripción</label>
        <textarea id="esp-nuevo-descripcion" value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)} rows={3} />
      </div>
      <label className="campo campo-check">
        <input type="checkbox" checked={requiereInforme}
          onChange={(e) => setRequiereInforme(e.target.checked)} />
        Requiere informe
      </label>
      <div className="acciones-form">
        <button type="submit" className="btn" disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear caso especial'}
        </button>
        <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
