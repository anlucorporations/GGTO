import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/client';
import type {
  CasoEspecialOut,
  CasoEspecialUpdate,
  CasosEspecialesFiltros,
  ClasificacionEspecial,
  EstadoEspecial,
  PrioridadEspecial,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import EstadoChips from '../components/EstadoChips';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

const CLASIFICACIONES: ClasificacionEspecial[] = ['REFERIDO', 'EMPRESA', 'GOBIERNO'];
const PRIORIDADES: PrioridadEspecial[] = ['ALTA', 'MEDIA', 'BAJA'];
const ESTADOS: EstadoEspecial[] = ['ABIERTO', 'EN_PROCESO', 'ATENDIDO', 'CERRADO'];

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

  // Filtros + listado.
  const [borrador, setBorrador] = useState<Filtros>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VACIOS);
  const [items, setItems] = useState<CasoEspecialOut[]>([]);
  const [cargando, setCargando] = useState(true);

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
            <table className="tabla-resumen">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Sector</th>
                  <th>Prioridad</th>
                  <th>Solicitante</th>
                  <th>Estado</th>
                  <th>Acción</th>
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
                    <td>{c.tipo_actividad}</td>
                    <td>{c.sector_nombre ?? '—'}</td>
                    <td>
                      <span className={clasePrioridad(c.prioridad)}>{c.prioridad}</span>
                    </td>
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
                    <td>
                      <button
                        type="button"
                        className="btn btn-mini btn-secundario"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirRegistro(c);
                        }}
                      >
                        {c.id_caso !== null ? 'Ver caso' : soloLectura ? 'Ver' : 'Ver/Editar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ficha + edición del caso especial sin caso asociado */}
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
