import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type { CitaCreate, CitaOut, CitasFiltros, CitaUpdate, EstadoCita, TipoCita } from '../api/types';
import Mensaje from '../components/Mensaje';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';
import {
  IconoChevronDerecha,
  IconoChevronIzquierda,
  IconoCerrar,
} from '../components/Iconos';

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

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

type Vista = 'DIA' | 'SEMANA' | 'MES';

/* --------------------------- utilidades de fecha --------------------------- */

function fechaLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseLocal(valor: string): Date {
  const [y, m, d] = valor.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function sumarDias(d: Date, dias: number): Date {
  const copia = new Date(d);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/** Lunes de la semana que contiene `d`. */
function inicioSemana(d: Date): Date {
  const copia = new Date(d);
  const desplazamiento = (copia.getDay() + 6) % 7;
  copia.setDate(copia.getDate() - desplazamiento);
  return copia;
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function proximaHoraLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${fechaLocal(d)}T${String(d.getHours()).padStart(2, '0')}:00`;
}

function hora(valor: string): string {
  return valor.length >= 16 ? valor.slice(11, 16) : valor;
}

function idValido(valor: string): boolean {
  return /^[1-9]\d*$/.test(valor.trim());
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

/* --------------------------------- subvistas ------------------------------- */

interface TarjetaProps {
  cita: CitaOut;
  compacta?: boolean;
  onAbrir: (c: CitaOut) => void;
}

function TarjetaCita({ cita, compacta = false, onAbrir }: TarjetaProps) {
  const referencia =
    cita.id_caso !== null
      ? `Caso #${cita.id_caso}`
      : cita.id_caso_especial !== null
        ? `Especial #${cita.id_caso_especial}`
        : 'Sin caso';
  const titulo = `${hora(cita.fecha_hora)} · ${cita.tipo} · ${cita.estado} · ${referencia}`;
  return (
    <button
      type="button"
      className={`cita cita-${cita.estado.toLowerCase()}${compacta ? ' cita-compacta' : ''}`}
      onClick={() => onAbrir(cita)}
      title={titulo}
      aria-label={titulo}
    >
      <span className="cita-hora mono">{hora(cita.fecha_hora)}</span>
      <span className="cita-tipo">{cita.tipo}</span>
      <span className="cita-estado">{cita.estado}</span>
      {!compacta && (
        <>
          <span className="cita-meta">
            Cuadrilla: {cita.id_cuadrilla ?? '—'}
          </span>
          <span className="cita-meta mono">{referencia}</span>
        </>
      )}
    </button>
  );
}

/* ---------------------------------- página -------------------------------- */

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

  const [vista, setVista] = useState<Vista>('SEMANA');
  const [ancla, setAncla] = useState<string>(() => fechaLocal(new Date()));

  const [filtroCuadrilla, setFiltroCuadrilla] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const [citas, setCitas] = useState<CitaOut[]>([]);
  const [cargando, setCargando] = useState(true);

  const [alta, setAlta] = useState<CitaForm>(altaVacia);
  const [creando, setCreando] = useState(false);
  const [forzarSolape, setForzarSolape] = useState(false);

  const [seleccion, setSeleccion] = useState<CitaOut | null>(null);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [reprogFecha, setReprogFecha] = useState('');

  const base = useMemo(() => parseLocal(ancla), [ancla]);

  /** Rango visible según la vista (día, semana lun-dom o rejilla mensual). */
  const rango = useMemo(() => {
    if (vista === 'DIA') return { desde: ancla, hasta: ancla };
    if (vista === 'SEMANA') {
      const lunes = inicioSemana(base);
      return { desde: fechaLocal(lunes), hasta: fechaLocal(sumarDias(lunes, 6)) };
    }
    const primero = new Date(base.getFullYear(), base.getMonth(), 1);
    const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const lunes = inicioSemana(primero);
    return { desde: fechaLocal(lunes), hasta: fechaLocal(sumarDias(inicioSemana(ultimo), 6)) };
  }, [vista, ancla, base]);

  const cargarCitas = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: CitasFiltros = {
        desde: `${rango.desde}T00:00:00`,
        hasta: `${rango.hasta}T23:59:59`,
      };
      if (idValido(filtroCuadrilla)) filtros.id_cuadrilla = Number(filtroCuadrilla);
      if (filtroEstado) filtros.estado = filtroEstado;
      setCitas(await api.listarCitas(filtros));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al listar las citas.'));
    } finally {
      setCargando(false);
    }
  }, [rango, filtroCuadrilla, filtroEstado]);

  useEffect(() => {
    void cargarCitas();
  }, [cargarCitas]);

  const citasPorDia = useMemo(() => {
    const mapa = new Map<string, CitaOut[]>();
    for (const c of citas) {
      const dia = c.fecha_hora.slice(0, 10);
      const lista = mapa.get(dia) ?? [];
      lista.push(c);
      mapa.set(dia, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
    }
    return mapa;
  }, [citas]);

  const diasSemana = useMemo(() => {
    const lunes = inicioSemana(base);
    return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  }, [base]);

  const diasMes = useMemo(() => {
    const primero = new Date(base.getFullYear(), base.getMonth(), 1);
    const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const inicio = inicioSemana(primero);
    const fin = sumarDias(inicioSemana(ultimo), 6);
    const dias: Date[] = [];
    for (let d = new Date(inicio); d <= fin; d = sumarDias(d, 1)) dias.push(new Date(d));
    return dias;
  }, [base]);

  const hoy = useMemo(() => new Date(), []);
  const hoyKey = fechaLocal(hoy);

  function etiquetaRango(): string {
    if (vista === 'DIA') {
      const d = base;
      return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
    }
    if (vista === 'SEMANA') {
      const a = diasSemana[0];
      const b = diasSemana[6];
      return `${a.getDate()} ${MESES[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MESES[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
    }
    return `${MESES[base.getMonth()]} ${base.getFullYear()}`;
  }

  function mover(paso: number) {
    const nueva = parseLocal(ancla);
    if (vista === 'DIA') nueva.setDate(nueva.getDate() + paso);
    else if (vista === 'SEMANA') nueva.setDate(nueva.getDate() + 7 * paso);
    else nueva.setMonth(nueva.getMonth() + paso);
    setAncla(fechaLocal(nueva));
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
      const actualizada = await api.actualizarCita(cita.id_cita, { estado });
      setOk(`Cita #${cita.id_cita} actualizada a ${estado}.`);
      setSeleccion(actualizada);
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
      const actualizada = await api.actualizarCita(cita.id_cita, payload);
      setOk(`Cita #${cita.id_cita} reprogramada.`);
      setSeleccion(actualizada);
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
      setSeleccion(null);
      await cargarCitas();
    } catch (e) {
      setError(msjCita(e, 'Error al eliminar la cita.'));
    } finally {
      setGuardandoId(null);
    }
  }

  function abrirSeleccion(c: CitaOut) {
    setSeleccion(c);
    setReprogFecha(c.fecha_hora.slice(0, 16));
    setError('');
    setOk('');
  }

  const totalRango = citas.length;

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Agenda</h1>
          <p>Calendario de citas por día, semana o mes, con control de solapamiento por cuadrilla.</p>
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

      {/* Calendario (RF-12): vistas Día / Semana / Mes */}
      <div className="panel-bloque">
        <div className="cal-barra">
          <div className="cal-barra-izq">
            <button
              type="button"
              className="btn btn-mini btn-secundario"
              onClick={() => mover(-1)}
              aria-label="Anterior"
              title="Anterior"
            >
              <IconoChevronIzquierda width={16} height={16} />
            </button>
            <button
              type="button"
              className="btn btn-mini btn-secundario"
              onClick={() => mover(1)}
              aria-label="Siguiente"
              title="Siguiente"
            >
              <IconoChevronDerecha width={16} height={16} />
            </button>
            <button type="button" className="btn btn-mini" onClick={() => setAncla(hoyKey)}>
              Hoy
            </button>
            <strong className="cal-rango">{etiquetaRango()}</strong>
          </div>

          <div className="cal-segmento" role="group" aria-label="Vista del calendario">
            {(['DIA', 'SEMANA', 'MES'] as Vista[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`cal-segmento-btn${vista === v ? ' activo' : ''}`}
                aria-pressed={vista === v}
                onClick={() => setVista(v)}
              >
                {v === 'DIA' ? 'Día' : v === 'SEMANA' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>

        <div className="cal-filtros">
          <div className="campo">
            <label htmlFor="cal-cuadrilla">Cuadrilla</label>
            <input
              id="cal-cuadrilla"
              type="number"
              min="1"
              value={filtroCuadrilla}
              onChange={(e) => setFiltroCuadrilla(e.target.value)}
              placeholder="Todas"
            />
          </div>
          <div className="campo">
            <label htmlFor="cal-estado">Estado</label>
            <select
              id="cal-estado"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <span className="texto-pequeno cal-contador">
            {cargando ? 'Cargando…' : `${totalRango} cita(s) en el rango visible`}
          </span>
        </div>

        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : vista === 'DIA' ? (
          <div className="cal-dia-lista">
            {Array.from({ length: 24 }, (_, h) => {
              const etiqueta = `${String(h).padStart(2, '0')}:00`;
              const lista = (citasPorDia.get(ancla) ?? []).filter(
                (c) => c.fecha_hora.slice(11, 13) === String(h).padStart(2, '0'),
              );
              return (
                <div className="cal-hora" key={h}>
                  <span className="cal-hora-etiqueta mono">{etiqueta}</span>
                  <div className="cal-hora-citas">
                    {lista.length === 0 ? (
                      <span className="cal-hora-vacia">—</span>
                    ) : (
                      lista.map((c) => (
                        <TarjetaCita key={c.id_cita} cita={c} onAbrir={abrirSeleccion} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : vista === 'SEMANA' ? (
          <div className="cal-semana">
            {diasSemana.map((d) => (
              <div
                key={fechaLocal(d)}
                className={`cal-semana-cabecera${mismoDia(d, hoy) ? ' hoy' : ''}`}
              >
                <span className="cal-dia-nombre">{DIAS_CORTOS[(d.getDay() + 6) % 7]}</span>
                <span className="cal-dia-fecha">{d.getDate()}</span>
              </div>
            ))}
            {diasSemana.map((d) => {
              const lista = citasPorDia.get(fechaLocal(d)) ?? [];
              return (
                <div key={`col-${fechaLocal(d)}`} className="cal-semana-columna">
                  {lista.length === 0 ? (
                    <span className="cal-hora-vacia">—</span>
                  ) : (
                    lista.map((c) => (
                      <TarjetaCita key={c.id_cita} cita={c} onAbrir={abrirSeleccion} />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="cal-mes">
            {DIAS_CORTOS.map((d) => (
              <div key={d} className="cal-mes-cabecera">
                {d}
              </div>
            ))}
            {diasMes.map((d) => {
              const clave = fechaLocal(d);
              const lista = citasPorDia.get(clave) ?? [];
              const otroMes = d.getMonth() !== base.getMonth();
              return (
                <div
                  key={clave}
                  className={`cal-mes-dia${otroMes ? ' otro-mes' : ''}${
                    mismoDia(d, hoy) ? ' hoy' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="cal-mes-num"
                    title={`Ver el día ${clave}`}
                    aria-label={`Ver el día ${clave}`}
                    onClick={() => {
                      setAncla(clave);
                      setVista('DIA');
                    }}
                  >
                    {d.getDate()}
                  </button>
                  <div className="cal-mes-citas">
                    {lista.slice(0, 3).map((c) => (
                      <TarjetaCita key={c.id_cita} cita={c} compacta onAbrir={abrirSeleccion} />
                    ))}
                    {lista.length > 3 && (
                      <span className="texto-pequeno">+{lista.length - 3} más</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalle / edición de la cita seleccionada */}
      {seleccion && (
        <div className="panel-bloque">
          <div className="pagina-cabecera">
            <h2>Cita #{seleccion.id_cita}</h2>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setSeleccion(null)}
              aria-label="Cerrar detalle"
            >
              <IconoCerrar width={16} height={16} />
            </button>
          </div>

          <div className="tabla-envoltura">
            <table className="tabla-ficha">
              <tbody>
                <tr>
                  <th>Fecha y hora</th>
                  <td className="mono">{seleccion.fecha_hora.replace('T', ' ').slice(0, 16)}</td>
                </tr>
                <tr>
                  <th>Tipo</th>
                  <td>{seleccion.tipo}</td>
                </tr>
                <tr>
                  <th>Estado</th>
                  <td>{seleccion.estado}</td>
                </tr>
                <tr>
                  <th>Cuadrilla</th>
                  <td>{seleccion.id_cuadrilla ?? '—'}</td>
                </tr>
                <tr>
                  <th>Caso</th>
                  <td>{seleccion.id_caso ?? '—'}</td>
                </tr>
                <tr>
                  <th>Caso especial</th>
                  <td>{seleccion.id_caso_especial ?? '—'}</td>
                </tr>
                <tr>
                  <th>Observación</th>
                  <td>{seleccion.observacion ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {!soloLectura && (
            <>
              <h3 className="subtitulo-seccion">Cambiar estado</h3>
              <div className="celda-acciones">
                {ACCIONES.map((a) => (
                  <button
                    key={a.estado}
                    type="button"
                    className="btn btn-mini btn-secundario"
                    disabled={seleccion.estado === a.estado || guardandoId === seleccion.id_cita}
                    onClick={() => void cambiarEstado(seleccion, a.estado)}
                  >
                    {a.etiqueta}
                  </button>
                ))}
              </div>

              <h3 className="subtitulo-seccion">Reprogramar</h3>
              <div className="cal-reprogramar">
                <input
                  type="datetime-local"
                  value={reprogFecha}
                  onChange={(e) => setReprogFecha(e.target.value)}
                  aria-label="Nueva fecha y hora"
                />
                {puedeForzar && (
                  <label className="campo-check cal-check-inline">
                    <input
                      type="checkbox"
                      checked={forzarSolape}
                      onChange={(e) => setForzarSolape(e.target.checked)}
                    />
                    Forzar solape
                  </label>
                )}
                <button
                  type="button"
                  className="btn btn-mini"
                  disabled={guardandoId === seleccion.id_cita}
                  onClick={() => void reprogramar(seleccion)}
                >
                  Guardar nueva fecha
                </button>
                <button
                  type="button"
                  className="btn btn-mini btn-peligro"
                  disabled={guardandoId === seleccion.id_cita}
                  onClick={() => void eliminarCita(seleccion)}
                >
                  Eliminar
                </button>
              </div>
            </>
          )}
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
    </>
  );
}
