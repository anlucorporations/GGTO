import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  CanalSolicitante,
  CasoEspecialCreate,
  CasoEspecialOut,
  CasoEspecialUpdate,
  CasosEspecialesFiltros,
  ClasificacionEspecial,
  EstadoEspecial,
  PrioridadEspecial,
  TipoActividadEspecial,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

const CLASIFICACIONES: ClasificacionEspecial[] = ['REFERIDO', 'EMPRESA', 'GOBIERNO'];
const TIPOS_ACTIVIDAD: TipoActividadEspecial[] = ['REPARACION', 'CONSTRUCCION'];
const PRIORIDADES: PrioridadEspecial[] = ['ALTA', 'MEDIA', 'BAJA'];
const ESTADOS: EstadoEspecial[] = ['ABIERTO', 'EN_PROCESO', 'ATENDIDO', 'CERRADO'];
const CANALES: CanalSolicitante[] = ['MANUAL', 'TELEGRAM', 'MCP_IA', 'CORREO'];

interface Filtros {
  clasificacion: string;
  estado: string;
  prioridad: string;
  solo_pendientes: boolean;
}

const FILTROS_VACIOS: Filtros = {
  clasificacion: '',
  estado: '',
  prioridad: '',
  solo_pendientes: false,
};

interface AltaForm {
  clasificacion: ClasificacionEspecial;
  tipo_actividad: TipoActividadEspecial;
  prioridad: PrioridadEspecial;
  descripcion: string;
  requiere_informe: boolean;
  id_caso: string;
  nombre_cliente: string;
  telefono: string;
  direccion: string;
  sol_unidad: string;
  sol_nombre: string;
  sol_contacto: string;
  sol_canal: CanalSolicitante;
}

const ALTA_VACIA: AltaForm = {
  clasificacion: 'REFERIDO',
  tipo_actividad: 'REPARACION',
  prioridad: 'MEDIA',
  descripcion: '',
  requiere_informe: true,
  id_caso: '',
  nombre_cliente: '',
  telefono: '',
  direccion: '',
  sol_unidad: '',
  sol_nombre: '',
  sol_contacto: '',
  sol_canal: 'MANUAL',
};

interface EdicionForm {
  prioridad: PrioridadEspecial;
  estado: EstadoEspecial;
  descripcion: string;
  requiere_informe: boolean;
}

interface CreadoInfo {
  id_caso_especial: number;
  id_caso: number | null;
  id_averia: string | null;
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

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Filtros + listado.
  const [borrador, setBorrador] = useState<Filtros>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VACIOS);
  const [items, setItems] = useState<CasoEspecialOut[]>([]);
  const [cargando, setCargando] = useState(true);

  // Alta.
  const [alta, setAlta] = useState<AltaForm>(ALTA_VACIA);
  const [creando, setCreando] = useState(false);
  const [creado, setCreado] = useState<CreadoInfo | null>(null);

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

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: CasosEspecialesFiltros = {
        clasificacion: aplicados.clasificacion,
        estado: aplicados.estado,
        prioridad: aplicados.prioridad,
      };
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

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    setCreado(null);

    const unidad = alta.sol_unidad.trim();
    const nombre = alta.sol_nombre.trim();
    const contacto = alta.sol_contacto.trim();
    const algunSolicitante = Boolean(unidad || nombre || contacto);
    if (algunSolicitante && !(unidad && nombre && contacto)) {
      setError(
        'Para registrar al solicitante complete unidad, nombre y contacto (o deje los tres vacíos).',
      );
      return;
    }

    const idCaso = alta.id_caso.trim();
    if (idCaso !== '' && (!Number.isInteger(Number(idCaso)) || Number(idCaso) <= 0)) {
      setError('El ID de caso debe ser un número entero positivo.');
      return;
    }

    const payload: CasoEspecialCreate = {
      clasificacion: alta.clasificacion,
      tipo_actividad: alta.tipo_actividad,
      prioridad: alta.prioridad,
      descripcion: nv(alta.descripcion),
      requiere_informe: alta.requiere_informe,
      nombre_cliente: nv(alta.nombre_cliente),
      telefono: nv(alta.telefono),
      direccion: nv(alta.direccion),
    };
    if (idCaso !== '') payload.id_caso = Number(idCaso);
    if (algunSolicitante) {
      payload.crear_solicitante = { unidad, nombre, contacto, canal: alta.sol_canal };
    }

    setCreando(true);
    try {
      const creadoObj = await api.crearCasoEspecial(payload);
      let idAveria: string | null = null;
      if (creadoObj.id_caso !== null) {
        try {
          idAveria = (await api.obtenerCaso(creadoObj.id_caso)).id_averia;
        } catch {
          idAveria = null;
        }
      }
      setCreado({
        id_caso_especial: creadoObj.id_caso_especial,
        id_caso: creadoObj.id_caso,
        id_averia: idAveria,
      });
      setAlta(ALTA_VACIA);
      setOk('Caso especial creado correctamente.');
      await cargarLista();
    } catch (e) {
      setError(detalleDe(e, 'Error al crear el caso especial.'));
    } finally {
      setCreando(false);
    }
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
          <p>Empresas, referidos y gobierno: alta, seguimiento y edición de casos especiales.</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {soloLectura && (
        <div className="aviso aviso-info">
          <span>
            Modo solo lectura: su rol TECNICO no permite crear ni modificar casos especiales. Puede
            consultar el listado y las fichas.
          </span>
        </div>
      )}

      {creado && (
        <div className="aviso aviso-ok" role="status">
          <span>
            Caso especial #{creado.id_caso_especial} creado.
            {creado.id_caso !== null && (
              <>
                {' '}
                Caso asociado: <strong className="mono">{creado.id_caso}</strong>
              </>
            )}
            {creado.id_averia && (
              <>
                {' '}
                — identificador:{' '}
                <strong className={creado.id_averia.startsWith('REF-') ? 'mono id-ref' : 'mono'}>
                  {creado.id_averia}
                </strong>
              </>
            )}
          </span>
        </div>
      )}

      {/* Alta (RF-06/RF-35) */}
      {!soloLectura && (
        <div className="panel-bloque">
          <h2>Alta de caso especial</h2>
          <form className="formulario" onSubmit={(e) => void crear(e)}>
            <div className="campo">
              <label htmlFor="esp-clasificacion">Clasificación</label>
              <select
                id="esp-clasificacion"
                value={alta.clasificacion}
                onChange={(e) =>
                  setAlta({ ...alta, clasificacion: e.target.value as ClasificacionEspecial })
                }
              >
                {CLASIFICACIONES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="esp-tipo">Tipo de actividad</label>
              <select
                id="esp-tipo"
                value={alta.tipo_actividad}
                onChange={(e) =>
                  setAlta({ ...alta, tipo_actividad: e.target.value as TipoActividadEspecial })
                }
              >
                {TIPOS_ACTIVIDAD.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="esp-prioridad">Prioridad</label>
              <select
                id="esp-prioridad"
                value={alta.prioridad}
                onChange={(e) =>
                  setAlta({ ...alta, prioridad: e.target.value as PrioridadEspecial })
                }
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo campo-check">
              <input
                id="esp-informe"
                type="checkbox"
                checked={alta.requiere_informe}
                onChange={(e) => setAlta({ ...alta, requiere_informe: e.target.checked })}
              />
              <label htmlFor="esp-informe">Requiere informe</label>
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="esp-descripcion">Descripción</label>
              <textarea
                id="esp-descripcion"
                value={alta.descripcion}
                onChange={(e) => setAlta({ ...alta, descripcion: e.target.value })}
              />
            </div>

            <div className="campo campo-ancho">
              <label htmlFor="esp-id-caso">
                Adjuntar a caso existente (ID de caso) — opcional
              </label>
              <input
                id="esp-id-caso"
                type="number"
                min="1"
                value={alta.id_caso}
                onChange={(e) => setAlta({ ...alta, id_caso: e.target.value })}
                placeholder="Vacío: se crea un caso con REF-…"
              />
            </div>

            <div className="campo">
              <label htmlFor="esp-cliente">Nombre del cliente</label>
              <input
                id="esp-cliente"
                value={alta.nombre_cliente}
                onChange={(e) => setAlta({ ...alta, nombre_cliente: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="esp-telefono">Teléfono</label>
              <input
                id="esp-telefono"
                value={alta.telefono}
                onChange={(e) => setAlta({ ...alta, telefono: e.target.value })}
              />
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="esp-direccion">Dirección</label>
              <input
                id="esp-direccion"
                value={alta.direccion}
                onChange={(e) => setAlta({ ...alta, direccion: e.target.value })}
              />
            </div>

            <div className="campo">
              <label htmlFor="esp-sol-unidad">Solicitante — unidad</label>
              <input
                id="esp-sol-unidad"
                value={alta.sol_unidad}
                onChange={(e) => setAlta({ ...alta, sol_unidad: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="esp-sol-nombre">Solicitante — nombre</label>
              <input
                id="esp-sol-nombre"
                value={alta.sol_nombre}
                onChange={(e) => setAlta({ ...alta, sol_nombre: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="esp-sol-contacto">Solicitante — contacto</label>
              <input
                id="esp-sol-contacto"
                value={alta.sol_contacto}
                onChange={(e) => setAlta({ ...alta, sol_contacto: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="esp-sol-canal">Solicitante — canal</label>
              <select
                id="esp-sol-canal"
                value={alta.sol_canal}
                onChange={(e) =>
                  setAlta({ ...alta, sol_canal: e.target.value as CanalSolicitante })
                }
              >
                {CANALES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="acciones-form">
              <button className="btn" type="submit" disabled={creando}>
                {creando ? 'Creando…' : 'Crear caso especial'}
              </button>
            </div>
          </form>
          <p className="texto-pequeno">
            Si deja el ID de caso vacío, el sistema crea un caso y le asigna un identificador
            «REF-&lt;central&gt;-&lt;NNNNNN&gt;». Los tres campos del solicitante se envían juntos o
            se omiten.
          </p>
        </div>
      )}

      {/* Filtros + listado */}
      <div className="panel-bloque">
        <h2>Listado de casos especiales</h2>
        <form className="formulario" onSubmit={filtrar}>
          <div className="campo">
            <label htmlFor="filtro-clasificacion">Clasificación</label>
            <select
              id="filtro-clasificacion"
              value={borrador.clasificacion}
              onChange={(e) => setBorrador({ ...borrador, clasificacion: e.target.value })}
            >
              <option value="">Todas</option>
              {CLASIFICACIONES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-estado">Estado</label>
            <select
              id="filtro-estado"
              value={borrador.estado}
              onChange={(e) => setBorrador({ ...borrador, estado: e.target.value })}
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
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
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Clasificación</th>
                  <th>Tipo de actividad</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Descripción</th>
                  <th>ID avería</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id_caso_especial}>
                    <td className="mono">{c.id_caso_especial}</td>
                    <td>{c.clasificacion}</td>
                    <td>{c.tipo_actividad}</td>
                    <td>
                      <span className={clasePrioridad(c.prioridad)}>{c.prioridad}</span>
                    </td>
                    <td>{c.estado}</td>
                    <td>{c.descripcion ?? '—'}</td>
                    <td>{c.tiene_id_averia ? 'Sí' : 'No'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-mini btn-secundario"
                        onClick={() => void abrirFicha(c.id_caso_especial)}
                      >
                        {soloLectura ? 'Ver' : 'Ver/Editar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ficha + edición */}
      {cargandoDetalle && <p className="texto-pequeno">Cargando ficha…</p>}
      {seleccion && (
        <div className="panel-bloque">
          <div className="pagina-cabecera">
            <h2>Ficha del caso especial #{seleccion.id_caso_especial}</h2>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setSeleccion(null)}
            >
              Cerrar ficha
            </button>
          </div>

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
                  <th>Clasificación</th>
                  <td>{seleccion.clasificacion}</td>
                </tr>
                <tr>
                  <th>Tipo de actividad</th>
                  <td>{seleccion.tipo_actividad}</td>
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
              <form className="formulario" onSubmit={(e) => void guardarEdicion(e)}>
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
        </div>
      )}
    </>
  );
}
