import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  CitaCreate,
  CitaOut,
  CitasFiltros,
  CitaUpdate,
  EstadoCita,
  TipoCita,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

const TIPOS: TipoCita[] = ['CONTACTO', 'ATENCION'];

const ESTADOS: EstadoCita[] = [
  'PROPUESTA',
  'CONFIRMADA',
  'CUMPLIDA',
  'REPROGRAMADA',
  'DIFERIDA',
  'CANCELADA',
];

const ACCIONES: { estado: EstadoCita; etiqueta: string }[] = [
  { estado: 'CONFIRMADA', etiqueta: 'Confirmar' },
  { estado: 'CUMPLIDA', etiqueta: 'Cumplir' },
  { estado: 'DIFERIDA', etiqueta: 'Diferir' },
  { estado: 'CANCELADA', etiqueta: 'Cancelar' },
];

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function fechaLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Lunes y domingo (fecha local, sin hora) de la semana en curso. */
function rangoSemanaActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const desplazamiento = (hoy.getDay() + 6) % 7;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - desplazamiento);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return { desde: fechaLocal(lunes), hasta: fechaLocal(domingo) };
}

/** Valor para `datetime-local`: la próxima hora en punto. */
function proximaHoraLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${fechaLocal(d)}T${String(d.getHours()).padStart(2, '0')}:00`;
}

function etiquetaDia(dia: string): string {
  const d = new Date(`${dia}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dia;
  return `${DIAS_SEMANA[d.getDay()]} ${dia}`;
}

function hora(valor: string): string {
  return valor.length >= 16 ? valor.slice(11, 16) : valor;
}

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

/** Mensaje explícito para los códigos de la agenda (409 solape, 403 permisos). */
function msjCita(e: unknown, fallback: string): string {
  if (e instanceof api.ApiError) {
    if (e.status === 409) return `Solapamiento: ${e.message}`;
    if (e.status === 403) return `Sin permiso: ${e.message}`;
    return e.message;
  }
  return fallback;
}

function idValido(valor: string): boolean {
  return /^[1-9]\d*$/.test(valor.trim());
}

const SEMANA = rangoSemanaActual();

interface Filtros {
  desde: string;
  hasta: string;
  id_cuadrilla: string;
  estado: string;
}

const FILTROS_INICIALES: Filtros = {
  desde: SEMANA.desde,
  hasta: SEMANA.hasta,
  id_cuadrilla: '',
  estado: '',
};

interface CitaForm {
  fecha_hora: string;
  tipo: TipoCita;
  estado: EstadoCita;
  id_cuadrilla: string;
  id_caso: string;
  id_caso_especial: string;
  observacion: string;
}

function altaVacia(): CitaForm {
  return {
    fecha_hora: proximaHoraLocal(),
    tipo: 'CONTACTO',
    estado: 'PROPUESTA',
    id_cuadrilla: '',
    id_caso: '',
    id_caso_especial: '',
    observacion: '',
  };
}

export default function Agenda() {
  const { usuario, soloLectura } = useAuth();
  const puedeForzar = usuario?.rol === 'SUPER';

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [borrador, setBorrador] = useState<Filtros>(FILTROS_INICIALES);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_INICIALES);
  const [citas, setCitas] = useState<CitaOut[]>([]);
  const [cargando, setCargando] = useState(true);

  const [alta, setAlta] = useState<CitaForm>(altaVacia);
  const [creando, setCreando] = useState(false);
  const [forzarSolape, setForzarSolape] = useState(false);

  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [reprogId, setReprogId] = useState<number | null>(null);
  const [reprogFecha, setReprogFecha] = useState('');

  const cargarCitas = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: CitasFiltros = {};
      if (aplicados.desde) filtros.desde = `${aplicados.desde}T00:00:00`;
      if (aplicados.hasta) filtros.hasta = `${aplicados.hasta}T23:59:59`;
      if (idValido(aplicados.id_cuadrilla)) filtros.id_cuadrilla = Number(aplicados.id_cuadrilla);
      if (aplicados.estado) filtros.estado = aplicados.estado;
      setCitas(await api.listarCitas(filtros));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al listar las citas.'));
    } finally {
      setCargando(false);
    }
  }, [aplicados]);

  useEffect(() => {
    void cargarCitas();
  }, [cargarCitas]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, CitaOut[]>();
    for (const c of citas) {
      const dia = c.fecha_hora.slice(0, 10);
      const lista = mapa.get(dia) ?? [];
      lista.push(c);
      mapa.set(dia, lista);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, lista]) => ({
        dia,
        items: [...lista].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora)),
      }));
  }, [citas]);

  function filtrar(evento: FormEvent) {
    evento.preventDefault();
    if (borrador.id_cuadrilla.trim() !== '' && !idValido(borrador.id_cuadrilla)) {
      setError('La cuadrilla debe ser un número entero positivo.');
      return;
    }
    setAplicados({ ...borrador });
  }

  function limpiar() {
    setBorrador(FILTROS_INICIALES);
    setAplicados(FILTROS_INICIALES);
    setOk('');
    setError('');
  }

  async function crearCita(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');

    if (!alta.fecha_hora) {
      setError('Indique la fecha y hora de la cita.');
      return;
    }
    const idCaso = alta.id_caso.trim();
    const idEspecial = alta.id_caso_especial.trim();
    if (idCaso === '' && idEspecial === '') {
      setError('La cita requiere un ID de caso o un ID de caso especial (al menos uno).');
      return;
    }
    if (idCaso !== '' && !idValido(idCaso)) {
      setError('ID de caso: indique un número entero positivo.');
      return;
    }
    if (idEspecial !== '' && !idValido(idEspecial)) {
      setError('ID de caso especial: indique un número entero positivo.');
      return;
    }
    if (alta.id_cuadrilla.trim() !== '' && !idValido(alta.id_cuadrilla)) {
      setError('ID de cuadrilla: indique un número entero positivo.');
      return;
    }

    const payload: CitaCreate = {
      fecha_hora: alta.fecha_hora,
      tipo: alta.tipo,
      estado: alta.estado,
      observacion: nv(alta.observacion),
    };
    if (idCaso !== '') payload.id_caso = Number(idCaso);
    if (idEspecial !== '') payload.id_caso_especial = Number(idEspecial);
    if (alta.id_cuadrilla.trim() !== '') payload.id_cuadrilla = Number(alta.id_cuadrilla);
    if (puedeForzar && forzarSolape) payload.permitir_solape = true;

    setCreando(true);
    try {
      await api.crearCita(payload);
      setAlta({ ...altaVacia(), fecha_hora: alta.fecha_hora });
      setForzarSolape(false);
      setOk('Cita agendada correctamente.');
      await cargarCitas();
    } catch (e) {
      setError(msjCita(e, 'Error al agendar la cita.'));
    } finally {
      setCreando(false);
    }
  }

  async function cambiarEstado(cita: CitaOut, estado: EstadoCita) {
    setError('');
    setOk('');
    setGuardandoId(cita.id_cita);
    try {
      await api.actualizarCita(cita.id_cita, { estado });
      setOk(`Cita #${cita.id_cita} actualizada a ${estado}.`);
      await cargarCitas();
    } catch (e) {
      setError(msjCita(e, 'Error al actualizar la cita.'));
    } finally {
      setGuardandoId(null);
    }
  }

  async function reprogramar(cita: CitaOut) {
    setError('');
    setOk('');
    if (!reprogFecha) {
      setError('Indique la nueva fecha y hora para reprogramar.');
      return;
    }
    const payload: CitaUpdate = { fecha_hora: reprogFecha };
    if (puedeForzar && forzarSolape) payload.permitir_solape = true;
    setGuardandoId(cita.id_cita);
    try {
      await api.actualizarCita(cita.id_cita, payload);
      setOk(`Cita #${cita.id_cita} reprogramada.`);
      setReprogId(null);
      setReprogFecha('');
      await cargarCitas();
    } catch (e) {
      setError(msjCita(e, 'Error al reprogramar la cita.'));
    } finally {
      setGuardandoId(null);
    }
  }

  async function eliminarCita(cita: CitaOut) {
    if (!window.confirm(`¿Eliminar (cancelar) la cita #${cita.id_cita}?`)) return;
    setError('');
    setOk('');
    setGuardandoId(cita.id_cita);
    try {
      await api.eliminarCita(cita.id_cita);
      setOk(`Cita #${cita.id_cita} eliminada (pasa a CANCELADA).`);
      await cargarCitas();
    } catch (e) {
      setError(msjCita(e, 'Error al eliminar la cita.'));
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Agenda</h1>
          <p>Agenda de citas por día, con control de solapamiento por cuadrilla.</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {soloLectura && (
        <div className="aviso aviso-info">
          <span>
            Modo solo lectura: su rol TECNICO no permite agendar, reprogramar ni cancelar citas.
            Puede consultar la agenda.
          </span>
        </div>
      )}

      {/* Nueva cita (RF-12) */}
      {!soloLectura && (
        <div className="panel-bloque">
          <h2>Nueva cita</h2>
          <form className="formulario" onSubmit={(e) => void crearCita(e)}>
            <div className="campo">
              <label htmlFor="cita-fecha">Fecha y hora</label>
              <input
                id="cita-fecha"
                type="datetime-local"
                value={alta.fecha_hora}
                onChange={(e) => setAlta({ ...alta, fecha_hora: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="cita-tipo">Tipo</label>
              <select
                id="cita-tipo"
                value={alta.tipo}
                onChange={(e) => setAlta({ ...alta, tipo: e.target.value as TipoCita })}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="cita-estado">Estado</label>
              <select
                id="cita-estado"
                value={alta.estado}
                onChange={(e) => setAlta({ ...alta, estado: e.target.value as EstadoCita })}
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="cita-cuadrilla">ID cuadrilla (opcional)</label>
              <input
                id="cita-cuadrilla"
                type="number"
                min="1"
                value={alta.id_cuadrilla}
                onChange={(e) => setAlta({ ...alta, id_cuadrilla: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="cita-caso">ID caso</label>
              <input
                id="cita-caso"
                type="number"
                min="1"
                value={alta.id_caso}
                onChange={(e) => setAlta({ ...alta, id_caso: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="cita-especial">ID caso especial</label>
              <input
                id="cita-especial"
                type="number"
                min="1"
                value={alta.id_caso_especial}
                onChange={(e) => setAlta({ ...alta, id_caso_especial: e.target.value })}
              />
            </div>
            <div className="campo campo-check">
              <input
                id="cita-solape"
                type="checkbox"
                checked={forzarSolape}
                disabled={!puedeForzar}
                onChange={(e) => setForzarSolape(e.target.checked)}
              />
              <label htmlFor="cita-solape">Forzar solape (solo Super Usuario)</label>
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="cita-observacion">Observación</label>
              <textarea
                id="cita-observacion"
                value={alta.observacion}
                onChange={(e) => setAlta({ ...alta, observacion: e.target.value })}
              />
            </div>
            <div className="acciones-form">
              <button className="btn" type="submit" disabled={creando}>
                {creando ? 'Agendando…' : 'Agendar cita'}
              </button>
            </div>
          </form>
          <p className="texto-pequeno">
            Se exige al menos un ID de caso o de caso especial. Si la cuadrilla ya tiene una cita en
            ese horario, la API responde <strong>409</strong> con el detalle del conflicto; solo el
            Super Usuario puede forzar el solape.
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="panel-bloque">
        <h2>Filtros de la agenda</h2>
        <form className="formulario" onSubmit={filtrar}>
          <div className="campo">
            <label htmlFor="filtro-desde">Desde</label>
            <input
              id="filtro-desde"
              type="date"
              value={borrador.desde}
              onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
            />
          </div>
          <div className="campo">
            <label htmlFor="filtro-hasta">Hasta</label>
            <input
              id="filtro-hasta"
              type="date"
              value={borrador.hasta}
              onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
            />
          </div>
          <div className="campo">
            <label htmlFor="filtro-cuadrilla">Cuadrilla</label>
            <input
              id="filtro-cuadrilla"
              type="number"
              min="1"
              value={borrador.id_cuadrilla}
              onChange={(e) => setBorrador({ ...borrador, id_cuadrilla: e.target.value })}
              placeholder="Todas"
            />
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
          <div className="acciones-form">
            <button className="btn" type="submit" disabled={cargando}>
              {cargando ? 'Filtrando…' : 'Filtrar'}
            </button>
            <button type="button" className="btn btn-secundario" onClick={limpiar}>
              Semana actual
            </button>
          </div>
        </form>
        <p className="texto-pequeno">
          Total: {citas.length} cita(s) en {grupos.length} día(s).
        </p>
      </div>

      {/* Vista de agenda agrupada por día */}
      <div className="panel-bloque">
        <h2>Agenda</h2>
        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : grupos.length === 0 ? (
          <p className="vacio">No hay citas en el rango seleccionado.</p>
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.dia} className="agenda-dia">
              <h3 className="agenda-dia-titulo">{etiquetaDia(grupo.dia)}</h3>
              <div className="tabla-envoltura">
                <table>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Cuadrilla</th>
                      <th>Caso</th>
                      <th>Caso especial</th>
                      <th>Observación</th>
                      {!soloLectura && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.items.map((c) => (
                      <tr key={c.id_cita}>
                        <td className="mono">{hora(c.fecha_hora)}</td>
                        <td>{c.tipo}</td>
                        <td>{c.estado}</td>
                        <td>{c.id_cuadrilla ?? '—'}</td>
                        <td>{c.id_caso ?? '—'}</td>
                        <td>{c.id_caso_especial ?? '—'}</td>
                        <td>{c.observacion ?? '—'}</td>
                        {!soloLectura && (
                          <td>
                            <div className="celda-acciones">
                              {ACCIONES.map((a) => (
                                <button
                                  key={a.estado}
                                  type="button"
                                  className="btn btn-mini btn-secundario"
                                  disabled={c.estado === a.estado || guardandoId === c.id_cita}
                                  onClick={() => void cambiarEstado(c, a.estado)}
                                >
                                  {a.etiqueta}
                                </button>
                              ))}
                              {reprogId === c.id_cita ? (
                                <>
                                  <input
                                    type="datetime-local"
                                    className="input-inline"
                                    value={reprogFecha}
                                    onChange={(e) => setReprogFecha(e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-mini"
                                    disabled={guardandoId === c.id_cita}
                                    onClick={() => void reprogramar(c)}
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-mini btn-secundario"
                                    onClick={() => {
                                      setReprogId(null);
                                      setReprogFecha('');
                                    }}
                                  >
                                    Cerrar
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-mini btn-secundario"
                                  onClick={() => {
                                    setReprogId(c.id_cita);
                                    setReprogFecha(c.fecha_hora.slice(0, 16));
                                  }}
                                >
                                  Reprogramar
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-mini btn-peligro"
                                disabled={guardandoId === c.id_cita}
                                onClick={() => void eliminarCita(c)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
