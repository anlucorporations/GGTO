import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  CasoOut,
  CategoriaCaso,
  CitaCreate,
  CitaOut,
  CitasFiltros,
  CitaUpdate,
  Cuadrilla,
  EstadoCita,
  TipoCaso,
  TipoCita,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';
import { IconoBuscar, IconoChevronDerecha, IconoChevronIzquierda } from '../components/Iconos';

const TIPOS: TipoCita[] = ['CONTACTO', 'ATENCION'];

// Catálogos de casos para el localizador y los filtros del calendario (D-72).
const TIPOS_CASO: TipoCaso[] = ['AVERIA', 'REPARACION', 'CONSTRUCCION'];
const CLASES_CASO: CategoriaCaso[] = ['RESIDENCIAL', 'EMPRESA', 'REFERIDO', 'GOBIERNO'];

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
  /** Caso localizado en la ficha (D-72): solo se llena vía el localizador. */
  id_caso: string;
  observacion: string;
}

function altaVacia(): CitaForm {
  return {
    fecha_hora: proximaHoraLocal(),
    tipo: 'CONTACTO',
    estado: 'PROPUESTA',
    id_cuadrilla: '',
    id_caso: '',
    observacion: '',
  };
}

/* ----------------------- localizador de caso (D-72) ---------------------- */

type Criterio = 'averia' | 'tipo' | 'numero' | 'clase';

const CRITERIOS: { id: Criterio; etiqueta: string }[] = [
  { id: 'averia', etiqueta: 'Id de Avería' },
  { id: 'tipo', etiqueta: 'Tipo' },
  { id: 'numero', etiqueta: 'Número (teléfono)' },
  { id: 'clase', etiqueta: 'Clase' },
];

interface LocalizadorProps {
  casoSel: CasoOut | null;
  onSeleccionar: (c: CasoOut | null) => void;
}

/**
 * Localiza el caso SOLO por Id de Avería, Tipo, Número o Clase. Al localizarlo
 * y seleccionarlo muestra su información básica en solo lectura.
 */
function LocalizadorCaso({ casoSel, onSeleccionar }: LocalizadorProps) {
  const [criterio, setCriterio] = useState<Criterio>('averia');
  const [valor, setValor] = useState('');
  const [resultados, setResultados] = useState<CasoOut[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');

  async function localizar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    const v = valor.trim();
    if (!v) {
      setError('Indique un valor para localizar el caso.');
      setResultados(null);
      return;
    }
    setBuscando(true);
    try {
      const filtros =
        criterio === 'averia'
          ? { id_averia: v, page_size: 30 }
          : criterio === 'numero'
            ? { telefono: v, page_size: 30 }
            : criterio === 'tipo'
              ? { tipo_caso: v, page_size: 30 }
              : { categoria: v, page_size: 30 };
      const pagina = await api.listarCasos(filtros);
      setResultados(pagina.items);
      if (pagina.items.length === 0) setError('No se localizó ningún caso con ese criterio.');
    } catch (e) {
      setResultados(null);
      setError(detalleDe(e, 'Error al localizar el caso.'));
    } finally {
      setBuscando(false);
    }
  }

  function limpiar() {
    onSeleccionar(null);
    setResultados(null);
    setValor('');
    setError('');
  }

  return (
    <div className="localizador-caso">
      <form className="formulario fila-campos" onSubmit={(e) => void localizar(e)}>
        <div className="campo">
          <label htmlFor="loc-criterio">Criterio</label>
          <select
            id="loc-criterio"
            value={criterio}
            onChange={(e) => {
              setCriterio(e.target.value as Criterio);
              setValor('');
              setResultados(null);
            }}
          >
            {CRITERIOS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="loc-valor">
            {criterio === 'tipo' ? 'Tipo de caso' : criterio === 'clase' ? 'Clase' : 'Valor'}
          </label>
          {criterio === 'tipo' ? (
            <select id="loc-valor" value={valor} onChange={(e) => setValor(e.target.value)}>
              <option value="">Seleccione…</option>
              {TIPOS_CASO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : criterio === 'clase' ? (
            <select id="loc-valor" value={valor} onChange={(e) => setValor(e.target.value)}>
              <option value="">Seleccione…</option>
              {CLASES_CASO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="loc-valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={criterio === 'numero' ? 'Teléfono' : 'ID de avería'}
            />
          )}
        </div>
        <div className="acciones-form">
          <button type="submit" className="btn" disabled={buscando}>
            <IconoBuscar width={16} height={16} /> {buscando ? 'Buscando…' : 'Localizar'}
          </button>
          {casoSel && (
            <button type="button" className="btn btn-secundario" onClick={limpiar}>
              Cambiar
            </button>
          )}
        </div>
      </form>

      {error && <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />}

      {casoSel ? (
        <div className="subpanel">
          <h3 className="subtitulo-seccion">Información del caso (solo lectura)</h3>
          <div className="datos-grid">
            <div className="dato">
              <span className="dato-etiqueta">Id de avería</span>
              <span className="dato-valor mono">{casoSel.id_averia}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Tipo</span>
              <span className="dato-valor">{casoSel.tipo_caso}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Clase</span>
              <span className="dato-valor">{casoSel.categoria}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Cliente</span>
              <span className="dato-valor">{casoSel.nombre_cliente ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Teléfono</span>
              <span className="dato-valor mono">{casoSel.telefono ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Sector</span>
              <span className="dato-valor">{casoSel.sector_nombre ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Dirección</span>
              <span className="dato-valor">{casoSel.direccion ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Estado</span>
              <span className="dato-valor">{casoSel.estado_actual}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">ID caso</span>
              <span className="dato-valor mono">{casoSel.id_caso}</span>
            </div>
          </div>
        </div>
      ) : resultados && resultados.length > 0 ? (
        <div className="tabla-envoltura localizador-resultados">
          <table className="tabla-resumen">
            <thead>
              <tr>
                <th>ID avería</th>
                <th>Tipo</th>
                <th>Clase</th>
                <th>Cliente</th>
                <th>Sector</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((c) => (
                <tr
                  key={c.id_caso}
                  className="fila-clicable"
                  tabIndex={0}
                  onClick={() => onSeleccionar(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSeleccionar(c);
                    }
                  }}
                >
                  <td className="mono">{c.id_averia}</td>
                  <td>{c.tipo_caso}</td>
                  <td>{c.categoria}</td>
                  <td>{c.nombre_cliente ?? '—'}</td>
                  <td>{c.sector_nombre ?? '—'}</td>
                  <td>{c.estado_actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="texto-pequeno">Seleccione un renglón para localizar el caso.</p>
        </div>
      ) : null}
    </div>
  );
}

export default function Agenda() {
  const { usuario, soloLectura } = useAuth();
  const puedeForzar = usuario?.rol === 'SUPER';

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [vista, setVista] = useState<Vista>('SEMANA');
  const [ancla, setAncla] = useState<string>(() => fechaLocal(new Date()));

  const [filtroCuadrilla, setFiltroCuadrilla] = useState('');
  // D-72: el calendario se filtra por Cuadrilla, Tipo y Clase del caso.
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroClase, setFiltroClase] = useState('');
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);

  const [citas, setCitas] = useState<CitaOut[]>([]);
  const [cargando, setCargando] = useState(true);

  const [alta, setAlta] = useState<CitaForm>(altaVacia);
  const [casoSel, setCasoSel] = useState<CasoOut | null>(null);
  const [creando, setCreando] = useState(false);
  const [forzarSolape, setForzarSolape] = useState(false);
  const [modalAlta, setModalAlta] = useState(false);

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
      if (filtroTipo) filtros.tipo_caso = filtroTipo;
      if (filtroClase) filtros.categoria = filtroClase;
      setCitas(await api.listarCitas(filtros));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al listar las citas.'));
    } finally {
      setCargando(false);
    }
  }, [rango, filtroCuadrilla, filtroTipo, filtroClase]);

  useEffect(() => {
    void cargarCitas();
  }, [cargarCitas]);

  // Cuadrillas para los filtros del calendario y la ficha de nueva cita (D-72).
  useEffect(() => {
    let vivo = true;
    api
      .listarCuadrillas({ solo_activas: true })
      .then((c) => vivo && setCuadrillas(c))
      .catch(() => vivo && setCuadrillas([]));
    return () => {
      vivo = false;
    };
  }, []);

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
    // D-72: el caso se localiza en la ficha; id_caso proviene del caso seleccionado.
    if (!casoSel || alta.id_caso.trim() === '') {
      setError('Localice el caso (Id de Avería, Tipo, Número o Clase) antes de agendar.');
      return;
    }
    if (alta.id_cuadrilla.trim() !== '' && !idValido(alta.id_cuadrilla)) {
      setError('Cuadrilla: indique un número entero positivo.');
      return;
    }

    const payload: CitaCreate = {
      fecha_hora: alta.fecha_hora,
      tipo: alta.tipo,
      estado: alta.estado,
      observacion: nv(alta.observacion),
      id_caso: Number(alta.id_caso),
    };
    if (alta.id_cuadrilla.trim() !== '') payload.id_cuadrilla = Number(alta.id_cuadrilla);
    if (puedeForzar && forzarSolape) payload.permitir_solape = true;

    setCreando(true);
    try {
      await api.crearCita(payload);
      setAlta({ ...altaVacia(), fecha_hora: alta.fecha_hora });
      setCasoSel(null);
      setForzarSolape(false);
      setModalAlta(false);
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
        {!soloLectura && (
          <button className="btn" type="button" onClick={() => setModalAlta(true)}>
            Nueva cita
          </button>
        )}
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

        <div className="cal-filtros filtros-tabla">
          <div className="campo">
            <label htmlFor="cal-cuadrilla">Cuadrilla</label>
            <select
              id="cal-cuadrilla"
              value={filtroCuadrilla}
              onChange={(e) => setFiltroCuadrilla(e.target.value)}
            >
              <option value="">Todas</option>
              {cuadrillas.map((c) => (
                <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
                  {c.codigo} — {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="cal-tipo">Tipo</label>
            <select
              id="cal-tipo"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos</option>
              {TIPOS_CASO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="cal-clase">Clase</label>
            <select
              id="cal-clase"
              value={filtroClase}
              onChange={(e) => setFiltroClase(e.target.value)}
            >
              <option value="">Todas</option>
              {CLASES_CASO.map((c) => (
                <option key={c} value={c}>
                  {c}
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

      {/* Detalle de la cita seleccionada, en ventana flotante (requisito de UI 3). */}
      {seleccion && (
        <Modal titulo={`Cita #${seleccion.id_cita}`} onCerrar={() => setSeleccion(null)}>
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
        </Modal>
      )}

      {/* Nueva cita (RF-12), en ventana flotante (requisito de UI 3). */}
      {!soloLectura && modalAlta && (
        <Modal
          titulo="Nueva cita"
          onCerrar={() => {
            setModalAlta(false);
            setCasoSel(null);
          }}
        >
          {/* D-72: el caso se localiza solo por Id de Avería, Tipo, Número o
              Clase. Va FUERA del <form> de la cita (los formularios no se
              anidan en HTML) con su propio formulario de búsqueda. */}
          <div className="localizador-wrap">
            <h3 className="subtitulo-seccion">Localización del caso</h3>
            <LocalizadorCaso
              casoSel={casoSel}
              onSeleccionar={(c) => {
                setCasoSel(c);
                setAlta({ ...alta, id_caso: c ? String(c.id_caso) : '' });
              }}
            />
          </div>
          <form className="formulario modal-formulario" onSubmit={(e) => void crearCita(e)}>
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
            <div className="campo campo-ancho">
              <label htmlFor="cita-cuadrilla">Cuadrilla (opcional)</label>
              <select
                id="cita-cuadrilla"
                value={alta.id_cuadrilla}
                onChange={(e) => setAlta({ ...alta, id_cuadrilla: e.target.value })}
              >
                <option value="">Sin cuadrilla</option>
                {cuadrillas.map((c) => (
                  <option key={c.id_cuadrilla} value={String(c.id_cuadrilla)}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
              </select>
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
            El caso se localiza <strong>solo por Id de Avería, Tipo, Número o Clase</strong>; al
            seleccionarlo se muestra su información básica en solo lectura. Si la cuadrilla ya tiene
            una cita en ese horario, la API responde <strong>409</strong> con el detalle del
            conflicto; solo el Super Usuario puede forzar el solape.
          </p>
        </Modal>
      )}
    </>
  );
}
