/**
 * SEGUIMIENTO (RF-34): casos derivados a otras instancias o colas.
 *
 * La API existía desde el Ciclo 6, pero la web no tenía la sección: esta página
 * muestra el caso real (avería, cliente, dirección, sector y cuadrilla), permite
 * filtrar y deriva/devuelve/resuelve con la bitácora del seguimiento.
 *
 * D-156: la lectura respeta el alcance por central y cuadrilla; las acciones de
 * escritura quedan para ADMIN/SUPERVISOR (el TÉCNICO solo consulta).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  CasoOut,
  EstadoSeguimiento,
  SeguimientoCreate,
  SeguimientoFiltros,
  SeguimientoOut,
  SeguimientoUpdate,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { fechaHora } from '../utils';

const ESTADOS: EstadoSeguimiento[] = ['EN_COLA', 'RESUELTO', 'DEVUELTO'];

const ROLES_ESCRITURA = ['SUPER', 'ADMIN', 'SUPERVISOR'];

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function estadoClase(estado: string): string {
  if (estado === 'RESUELTO') return 'chip chip-exito';
  if (estado === 'DEVUELTO') return 'chip chip-alerta';
  return 'chip chip-info';
}

interface Filtros {
  q: string;
  estado: EstadoSeguimiento | '';
  instancia_destino: string;
}

const FILTROS_VACIOS: Filtros = { q: '', estado: '', instancia_destino: '' };

interface Edicion {
  instancia_destino: string;
  motivo: string;
  observacion: string;
  estado: EstadoSeguimiento;
}

function aEdicion(item: SeguimientoOut): Edicion {
  return {
    instancia_destino: item.instancia_destino,
    motivo: item.motivo ?? '',
    observacion: item.observacion ?? '',
    estado: (item.estado as EstadoSeguimiento) ?? 'EN_COLA',
  };
}

/* ------------------------------------------------------------------ */
/* Alta de la derivación                                              */
/* ------------------------------------------------------------------ */

function ModalDerivar({
  onCerrar,
  onCreado,
}: {
  onCerrar: () => void;
  onCreado: (item: SeguimientoOut) => void;
}) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<CasoOut[]>([]);
  const [caso, setCaso] = useState<CasoOut | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [instancia, setInstancia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacion, setObservacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function buscar(evento: FormEvent) {
    evento.preventDefault();
    const q = texto.trim();
    if (!q) {
      setError('Indique el id de avería, el cliente o la dirección del caso.');
      return;
    }
    setBuscando(true);
    setError('');
    try {
      const encontrados = await api.buscarCasos({ q, limite: 10 });
      setResultados(encontrados);
      if (encontrados.length === 0) setError('No se localizó ningún caso con ese criterio.');
    } catch (e) {
      setResultados([]);
      setError(detalleDe(e, 'No se pudo buscar el caso.'));
    } finally {
      setBuscando(false);
    }
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    if (!caso) {
      setError('Seleccione el caso que se derivará.');
      return;
    }
    if (!instancia.trim()) {
      setError('Indique la instancia o cola de destino.');
      return;
    }
    setGuardando(true);
    setError('');
    const datos: SeguimientoCreate = {
      id_caso: caso.id_caso,
      instancia_destino: instancia.trim(),
      motivo: motivo.trim() || null,
      observacion: observacion.trim() || null,
    };
    try {
      const creado = await api.crearSeguimiento(datos);
      onCreado(creado);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo derivar el caso.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Derivar un caso a otra instancia" onCerrar={onCerrar}>
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <form className="formulario" onSubmit={buscar}>
        <div className="fila-filtros">
          <label className="campo">
            <span>Buscar caso</span>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Id de avería, cliente o dirección"
              autoFocus
            />
          </label>
          <div className="acciones-form">
            <button className="btn" type="submit" disabled={buscando}>
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
        </div>
      </form>

      {resultados.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla-resumen">
            <thead>
              <tr>
                <th>Id avería</th>
                <th>Cliente</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th>Selección</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((c) => (
                <tr key={c.id_caso} className={caso?.id_caso === c.id_caso ? 'fila-activa' : ''}>
                  <td className="mono">{c.id_averia}</td>
                  <td>{c.nombre_cliente ?? '—'}</td>
                  <td>{c.direccion ?? '—'}</td>
                  <td>{c.estado_actual}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secundario"
                      onClick={() => {
                        setCaso(c);
                        setError('');
                      }}
                    >
                      {caso?.id_caso === c.id_caso ? 'Seleccionado' : 'Seleccionar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="formulario" onSubmit={crear}>
        <div className="panel-bloque">
          <h2>Caso seleccionado</h2>
          {caso ? (
            <p className="texto-pequeno">
              <strong className="mono">{caso.id_averia}</strong> · {caso.nombre_cliente ?? 'Sin cliente'} ·{' '}
              {caso.direccion ?? 'Sin dirección'}
            </p>
          ) : (
            <p className="texto-pequeno">Busque y seleccione un caso para continuar.</p>
          )}
        </div>

        <div className="fila-filtros">
          <label className="campo">
            <span>Instancia o cola destino *</span>
            <input
              value={instancia}
              onChange={(e) => setInstancia(e.target.value)}
              maxLength={120}
              placeholder="Ej.: COLA PLANTA EXTERNA"
            />
          </label>
          <label className="campo">
            <span>Motivo</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
        </div>
        <label className="campo">
          <span>Observación</span>
          <textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={3}
          />
        </label>
        <div className="acciones-form">
          <button className="btn btn-secundario" type="button" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={guardando || !caso}>
            {guardando ? 'Derivando…' : 'Derivar caso'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Ficha / edición del seguimiento                                    */
/* ------------------------------------------------------------------ */

function ModalDetalle({
  item,
  puedeEditar,
  onCerrar,
  onGuardado,
}: {
  item: SeguimientoOut;
  puedeEditar: boolean;
  onCerrar: () => void;
  onGuardado: (item: SeguimientoOut) => void;
}) {
  const [edicion, setEdicion] = useState<Edicion>(aEdicion(item));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!edicion.instancia_destino.trim()) {
      setError('La instancia o cola destino no puede quedar vacía.');
      return;
    }
    const payload: SeguimientoUpdate = {};
    if (edicion.instancia_destino.trim() !== item.instancia_destino) {
      payload.instancia_destino = edicion.instancia_destino.trim();
    }
    if (edicion.motivo.trim() !== (item.motivo ?? '')) {
      payload.motivo = edicion.motivo.trim() || null;
    }
    if (edicion.observacion.trim() !== (item.observacion ?? '')) {
      payload.observacion = edicion.observacion.trim() || null;
    }
    if (edicion.estado !== item.estado) payload.estado = edicion.estado;

    if (Object.keys(payload).length === 0) {
      onCerrar();
      return;
    }
    setGuardando(true);
    setError('');
    try {
      onGuardado(await api.actualizarSeguimiento(item.id_seguimiento, payload));
    } catch (e) {
      setError(detalleDe(e, 'No se pudo actualizar el seguimiento.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Seguimiento #${item.id_seguimiento}`} onCerrar={onCerrar}>
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <div className="rejilla-tarjetas">
        <article className="tarjeta">
          <span className="valor mono">{item.id_averia ?? `#${item.id_caso}`}</span>
          <span className="etiqueta">Caso</span>
        </article>
        <article className="tarjeta">
          <span className="valor">{item.estado}</span>
          <span className="etiqueta">Estado del seguimiento</span>
        </article>
        <article className="tarjeta">
          <span className="valor">{item.estado_caso ?? '—'}</span>
          <span className="etiqueta">Estado del caso</span>
        </article>
      </div>

      <div className="ficha-tarjetas">
        <div className="ficha-tarjeta">
          <span className="etiqueta">Cliente</span>
          <span className="valor">{item.nombre_cliente ?? '—'}</span>
        </div>
        <div className="ficha-tarjeta">
          <span className="etiqueta">Dirección</span>
          <span className="valor">{item.direccion ?? '—'}</span>
        </div>
        <div className="ficha-tarjeta">
          <span className="etiqueta">Sector</span>
          <span className="valor">{item.sector_nombre ?? '—'}</span>
        </div>
        <div className="ficha-tarjeta">
          <span className="etiqueta">Cuadrilla</span>
          <span className="valor">
            {item.cuadrilla_codigo
              ? `${item.cuadrilla_codigo} — ${item.cuadrilla_nombre ?? ''}`
              : '—'}
          </span>
        </div>
        <div className="ficha-tarjeta">
          <span className="etiqueta">Enviado</span>
          <span className="valor">{fechaHora(item.fecha_envio)}</span>
        </div>
        <div className="ficha-tarjeta">
          <span className="etiqueta">Retorno</span>
          <span className="valor">{fechaHora(item.fecha_retorno)}</span>
        </div>
      </div>

      {puedeEditar ? (
        <form className="formulario" onSubmit={guardar}>
          <div className="fila-filtros">
            <label className="campo">
              <span>Instancia o cola destino</span>
              <input
                value={edicion.instancia_destino}
                onChange={(e) => setEdicion({ ...edicion, instancia_destino: e.target.value })}
                maxLength={120}
              />
            </label>
            <label className="campo">
              <span>Estado</span>
              <select
                value={edicion.estado}
                onChange={(e) =>
                  setEdicion({ ...edicion, estado: e.target.value as EstadoSeguimiento })
                }
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="campo">
            <span>Motivo</span>
            <input
              value={edicion.motivo}
              onChange={(e) => setEdicion({ ...edicion, motivo: e.target.value })}
            />
          </label>
          <label className="campo">
            <span>Observación</span>
            <textarea
              value={edicion.observacion}
              onChange={(e) => setEdicion({ ...edicion, observacion: e.target.value })}
              rows={3}
            />
          </label>
          <p className="texto-pequeno">
            Al marcar DEVUELTO el caso vuelve a NUEVO y regresa al despacho. RESUELTO
            sella la fecha de retorno; el cierre formal conserva su vía normal.
          </p>
          <div className="acciones-form">
            <button className="btn btn-secundario" type="button" onClick={onCerrar}>
              Cerrar
            </button>
            <button className="btn" type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      ) : (
        <div className="panel-bloque">
          <h2>Detalle</h2>
          <p><strong>Instancia:</strong> {item.instancia_destino}</p>
          <p><strong>Motivo:</strong> {item.motivo ?? '—'}</p>
          <p><strong>Observación:</strong> {item.observacion ?? '—'}</p>
          <p><strong>Registrado por:</strong> {item.usuario ?? '—'}</p>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Seguimiento() {
  const { usuario } = useAuth();
  const rol = usuario?.rol ?? '';
  const puedeEditar = ROLES_ESCRITURA.includes(rol);

  const [borrador, setBorrador] = useState<Filtros>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VACIOS);
  const [items, setItems] = useState<SeguimientoOut[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [seleccion, setSeleccion] = useState<SeguimientoOut | null>(null);
  const [crearAbierto, setCrearAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: SeguimientoFiltros = {};
      if (aplicados.q.trim()) filtros.q = aplicados.q.trim();
      if (aplicados.estado) filtros.estado = aplicados.estado;
      if (aplicados.instancia_destino.trim()) {
        filtros.instancia_destino = aplicados.instancia_destino.trim();
      }
      setItems(await api.listarSeguimiento(filtros));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al listar el seguimiento.'));
    } finally {
      setCargando(false);
    }
  }, [aplicados]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function filtrar(evento: FormEvent) {
    evento.preventDefault();
    setAplicados({ ...borrador });
  }

  function limpiar() {
    setBorrador(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
    setError('');
    setOk('');
  }

  function actualizado(item: SeguimientoOut) {
    setSeleccion(null);
    setOk(`Seguimiento #${item.id_seguimiento} actualizado.`);
    void cargar();
  }

  const enCola = items.filter((i) => i.estado === 'EN_COLA').length;
  const resueltos = items.filter((i) => i.estado === 'RESUELTO').length;
  const devueltos = items.filter((i) => i.estado === 'DEVUELTO').length;

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Seguimiento</h1>
          <p className="texto-pequeno">
            Casos derivados a otras instancias o colas (RF-34). El caso sale del despacho
            de calle mientras permanece en cola y vuelve al marcarlo como devuelto.
          </p>
        </div>
        {puedeEditar && (
          <button className="btn" type="button" onClick={() => setCrearAbierto(true)}>
            Derivar caso
          </button>
        )}
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      <section className="panel-bloque">
        <h2>Resumen</h2>
        <div className="rejilla-tarjetas">
          <article className="tarjeta">
            <span className="valor">{enCola}</span>
            <span className="etiqueta">En cola</span>
          </article>
          <article className="tarjeta">
            <span className="valor">{resueltos}</span>
            <span className="etiqueta">Resueltos</span>
          </article>
          <article className="tarjeta">
            <span className="valor">{devueltos}</span>
            <span className="etiqueta">Devueltos</span>
          </article>
        </div>
      </section>

      <section className="panel-bloque">
        <h2>Derivaciones</h2>
        <form className="formulario filtros-tabla" onSubmit={filtrar}>
          <div className="fila-filtros">
            <label className="campo">
              <span>Buscar</span>
              <input
                value={borrador.q}
                onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
                placeholder="Avería, cliente, dirección, sector o instancia"
              />
            </label>
            <label className="campo">
              <span>Estado</span>
              <select
                value={borrador.estado}
                onChange={(e) =>
                  setBorrador({ ...borrador, estado: e.target.value as Filtros['estado'] })
                }
              >
                <option value="">Todos</option>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Instancia</span>
              <input
                value={borrador.instancia_destino}
                onChange={(e) =>
                  setBorrador({ ...borrador, instancia_destino: e.target.value })
                }
              />
            </label>
            <div className="acciones-form">
              <button className="btn" type="submit">Filtrar</button>
              <button className="btn btn-secundario" type="button" onClick={limpiar}>
                Limpiar
              </button>
            </div>
          </div>
        </form>

        <div className="tabla-envoltura">
          <table className="tabla-resumen">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Cliente</th>
                <th>Dirección</th>
                <th>Sector</th>
                <th>Instancia destino</th>
                <th>Enviado</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id_seguimiento}>
                  <td className="mono">{item.id_averia ?? `#${item.id_caso}`}</td>
                  <td>{item.nombre_cliente ?? '—'}</td>
                  <td>{item.direccion ?? '—'}</td>
                  <td>{item.sector_nombre ?? '—'}</td>
                  <td>{item.instancia_destino}</td>
                  <td>{fechaHora(item.fecha_envio)}</td>
                  <td>
                    <span className={estadoClase(item.estado)}>{item.estado}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secundario"
                      onClick={() => setSeleccion(item)}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <PieTabla
              colSpan={8}
              total={items.length}
              singular="derivación"
              plural="derivaciones"
              cargando={cargando}
            />
          </table>
        </div>
      </section>

      {crearAbierto && (
        <ModalDerivar
          onCerrar={() => setCrearAbierto(false)}
          onCreado={(item) => {
            setCrearAbierto(false);
            setOk(`Caso ${item.id_averia ?? item.id_caso} derivado a ${item.instancia_destino}.`);
            void cargar();
          }}
        />
      )}

      {seleccion && (
        <ModalDetalle
          item={seleccion}
          puedeEditar={puedeEditar}
          onCerrar={() => setSeleccion(null)}
          onGuardado={actualizado}
        />
      )}
    </>
  );
}
