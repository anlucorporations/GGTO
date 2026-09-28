import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import * as api from '../api/client';
import type {
  CasoEstadoHistOut,
  CasoOut,
  CasosFiltros,
  CasoUpdate,
  CategoriaCaso,
  EstadoCaso,
  PaginaCasos,
  TipoCaso,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import EstadoChips from '../components/EstadoChips';
import { useAuth } from '../auth/AuthContext';
import { fecha, nv } from '../utils';

const ESTADOS: EstadoCaso[] = [
  'NUEVO',
  'ASIGNADO',
  'CONTACTADO',
  'CITADO',
  'DIFERIDO',
  'EN_GESTION',
  'ENRUTADO',
  'CERRADO',
  'CANCELADO',
];

const CATEGORIAS: CategoriaCaso[] = ['RESIDENCIAL', 'EMPRESA', 'REFERIDO', 'GOBIERNO'];
const TIPOS: TipoCaso[] = ['AVERIA', 'REPARACION', 'CONSTRUCCION'];
const ORIGENES = ['INGESTA_CSV', 'MANUAL', 'TELEGRAM', 'MCP_IA'];
const TAMANOS = [10, 25, 50, 100];

interface Filtros {
  q: string;
  estado_actual: string;
  categoria: string;
  tipo_caso: string;
  origen: string;
  en_gestion_supervisor: string;
  desde: string;
  hasta: string;
}

const FILTROS_VACIOS: Filtros = {
  q: '',
  estado_actual: '',
  categoria: '',
  tipo_caso: '',
  origen: '',
  en_gestion_supervisor: '',
  desde: '',
  hasta: '',
};

interface EdicionForm {
  nombre_cliente: string;
  telefono: string;
  direccion: string;
  informacion: string;
  problema_reporte: string;
  ultimo_comentario: string;
  persona_reporta: string;
  contacto_cliente: string;
  tipo_caso: string;
  categoria: string;
  id_sector: string;
  id_causa: string;
  en_gestion_supervisor: boolean;
  es_falla_masiva: boolean;
  fecha_cita: string;
  fecha_compromiso: string;
  tipo_servicio: string;
}

const EDICION_VACIA: EdicionForm = {
  nombre_cliente: '',
  telefono: '',
  direccion: '',
  informacion: '',
  problema_reporte: '',
  ultimo_comentario: '',
  persona_reporta: '',
  contacto_cliente: '',
  tipo_caso: 'AVERIA',
  categoria: 'RESIDENCIAL',
  id_sector: '',
  id_causa: '',
  en_gestion_supervisor: false,
  es_falla_masiva: false,
  fecha_cita: '',
  fecha_compromiso: '',
  tipo_servicio: '',
};

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function soloFecha(valor: string | null): string {
  return valor ? valor.slice(0, 10) : '';
}

function fechaHora(valor: string | null): string {
  return valor ? valor.replace('T', ' ').slice(0, 19) : '—';
}

function aEdicion(c: CasoOut): EdicionForm {
  return {
    nombre_cliente: c.nombre_cliente ?? '',
    telefono: c.telefono ?? '',
    direccion: c.direccion ?? '',
    informacion: c.informacion ?? '',
    problema_reporte: c.problema_reporte ?? '',
    ultimo_comentario: c.ultimo_comentario ?? '',
    persona_reporta: c.persona_reporta ?? '',
    contacto_cliente: c.contacto_cliente ?? '',
    tipo_caso: c.tipo_caso,
    categoria: c.categoria,
    id_sector: c.id_sector === null ? '' : String(c.id_sector),
    id_causa: c.id_causa === null ? '' : String(c.id_causa),
    en_gestion_supervisor: c.en_gestion_supervisor,
    es_falla_masiva: c.es_falla_masiva,
    fecha_cita: soloFecha(c.fecha_cita),
    fecha_compromiso: soloFecha(c.fecha_compromiso),
    tipo_servicio: c.tipo_servicio ?? '',
  };
}

/** Arma el `CasoUpdate` con solo los campos que el usuario modificó. */
function construirPayload(original: CasoOut, form: EdicionForm): CasoUpdate {
  const p: CasoUpdate = {};
  if (form.nombre_cliente !== (original.nombre_cliente ?? '')) p.nombre_cliente = nv(form.nombre_cliente);
  if (form.telefono !== (original.telefono ?? '')) p.telefono = nv(form.telefono);
  if (form.direccion !== (original.direccion ?? '')) p.direccion = nv(form.direccion);
  if (form.informacion !== (original.informacion ?? '')) p.informacion = nv(form.informacion);
  if (form.problema_reporte !== (original.problema_reporte ?? '')) {
    p.problema_reporte = nv(form.problema_reporte);
  }
  if (form.ultimo_comentario !== (original.ultimo_comentario ?? '')) {
    p.ultimo_comentario = nv(form.ultimo_comentario);
  }
  if (form.persona_reporta !== (original.persona_reporta ?? '')) {
    p.persona_reporta = nv(form.persona_reporta);
  }
  if (form.contacto_cliente !== (original.contacto_cliente ?? '')) {
    p.contacto_cliente = nv(form.contacto_cliente);
  }
  if (form.tipo_servicio !== (original.tipo_servicio ?? '')) {
    p.tipo_servicio = nv(form.tipo_servicio);
  }
  if (form.tipo_caso !== original.tipo_caso) p.tipo_caso = form.tipo_caso as TipoCaso;
  if (form.categoria !== original.categoria) p.categoria = form.categoria as CategoriaCaso;

  const sector = form.id_sector.trim();
  if (sector !== '' && sector !== String(original.id_sector ?? '')) p.id_sector = Number(sector);
  const causa = form.id_causa.trim();
  if (causa !== '' && causa !== String(original.id_causa ?? '')) p.id_causa = Number(causa);

  if (form.en_gestion_supervisor !== original.en_gestion_supervisor) {
    p.en_gestion_supervisor = form.en_gestion_supervisor;
  }
  if (form.es_falla_masiva !== original.es_falla_masiva) p.es_falla_masiva = form.es_falla_masiva;

  const cita = form.fecha_cita.trim();
  if (cita !== soloFecha(original.fecha_cita)) p.fecha_cita = cita ? `${cita}T00:00:00` : null;
  const compromiso = form.fecha_compromiso.trim();
  if (compromiso !== soloFecha(original.fecha_compromiso)) {
    p.fecha_compromiso = compromiso ? `${compromiso}T00:00:00` : null;
  }
  return p;
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  const vacio = valor === null || valor === undefined || valor === '';
  return (
    <tr>
      <th>{etiqueta}</th>
      <td>{vacio ? '—' : valor}</td>
    </tr>
  );
}

function Grupo({ titulo }: { titulo: string }) {
  return (
    <tr className="ficha-grupo">
      <th colSpan={2}>{titulo}</th>
    </tr>
  );
}

/** Listado resumido: ID, tipo, clase, sector y los cuatro iconos de estado. */
function TablaCasos({ items, onVer }: { items: CasoOut[]; onVer: (idCaso: number) => void }) {
  return (
    <div className="tabla-envoltura">
      <table className="tabla-resumen">
        <thead>
          <tr>
            <th>ID avería</th>
            <th>Tipo</th>
            <th>Clase</th>
            <th>Sector</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr
              key={c.id_caso}
              className="fila-clicable"
              onClick={() => onVer(c.id_caso)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onVer(c.id_caso);
                }
              }}
            >
              <td className="mono">{c.id_averia}</td>
              <td>{c.tipo_caso}</td>
              <td>{c.categoria}</td>
              <td>{c.sector_nombre ?? '—'}</td>
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
                    onVer(c.id_caso);
                  }}
                >
                  Ver ficha
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <PieTabla colSpan={6} total={items.length} singular="caso" plural="casos" />
      </table>
    </div>
  );
}

export default function Casos() {
  const { soloLectura } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Término inicial: query string `?q=` o el `state` que envía el PANEL.
  const estadoNav = location.state as { q?: unknown; abrirCaso?: unknown } | null;
  const terminoInicial = (
    searchParams.get('q') ?? (typeof estadoNav?.q === 'string' ? estadoNav.q : '')
  ).trim();
  const idAbrirInicial =
    typeof estadoNav?.abrirCaso === 'number'
      ? estadoNav.abrirCaso
      : typeof estadoNav?.abrirCaso === 'string' && /^\d+$/.test(estadoNav.abrirCaso)
        ? Number(estadoNav.abrirCaso)
        : null;

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Filtros + listado (RF-33).
  const [borrador, setBorrador] = useState<Filtros>(() => ({
    ...FILTROS_VACIOS,
    q: terminoInicial,
  }));
  const [aplicados, setAplicados] = useState<Filtros>(() => ({
    ...FILTROS_VACIOS,
    q: terminoInicial,
  }));
  const [page, setPage] = useState(1);
  const [tamanio, setTamanio] = useState(25);
  const [resultado, setResultado] = useState<PaginaCasos | null>(null);
  const [cargandoLista, setCargandoLista] = useState(true);

  // Ficha (RF-31) e historial (RNF-12).
  const [ficha, setFicha] = useState<CasoOut | null>(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [edicion, setEdicion] = useState<EdicionForm>(EDICION_VACIA);
  const [guardando, setGuardando] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<string>('');
  const [motivoEstado, setMotivoEstado] = useState('');
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [historial, setHistorial] = useState<CasoEstadoHistOut[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const cargarLista = useCallback(async () => {
    setCargandoLista(true);
    try {
      const params: CasosFiltros = {
        q: aplicados.q,
        estado_actual: aplicados.estado_actual,
        categoria: aplicados.categoria,
        tipo_caso: aplicados.tipo_caso,
        origen: aplicados.origen,
        desde: aplicados.desde,
        hasta: aplicados.hasta,
        page,
        page_size: tamanio,
      };
      if (aplicados.en_gestion_supervisor !== '') {
        params.en_gestion_supervisor = aplicados.en_gestion_supervisor === 'true';
      }
      setResultado(await api.listarCasos(params));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al listar los casos.'));
    } finally {
      setCargandoLista(false);
    }
  }, [aplicados, page, tamanio]);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  const cargarHistorial = useCallback(async (idCaso: number) => {
    setCargandoHistorial(true);
    try {
      setHistorial(await api.obtenerHistorialCaso(idCaso));
    } catch (e) {
      setHistorial([]);
      setError(detalleDe(e, 'Error al obtener el historial del caso.'));
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  const abrirFicha = useCallback(
    async (idCaso: number) => {
      setCargandoFicha(true);
      setError('');
      setOk('');
      try {
        const caso = await api.obtenerCaso(idCaso);
        setFicha(caso);
        setEdicion(aEdicion(caso));
        setNuevoEstado(caso.estado_actual);
        setMotivoEstado('');
        await cargarHistorial(idCaso);
      } catch (e) {
        setError(detalleDe(e, 'Error al obtener la ficha del caso.'));
      } finally {
        setCargandoFicha(false);
      }
    },
    [cargarHistorial],
  );

  // Abre la ficha cuando se llega desde el buscador global o el PANEL.
  useEffect(() => {
    if (idAbrirInicial !== null) void abrirFicha(idAbrirInicial);
  }, [idAbrirInicial, location.key, abrirFicha]);

  function filtrar(evento: FormEvent) {
    evento.preventDefault();
    setPage(1);
    setAplicados({ ...borrador });
  }

  function limpiar() {
    setBorrador(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
    setPage(1);
    setOk('');
    setError('');
  }

  async function guardarEdicion(evento: FormEvent) {
    evento.preventDefault();
    if (!ficha) return;
    const payload = construirPayload(ficha, edicion);
    setError('');
    setOk('');
    if (Object.keys(payload).length === 0) {
      setOk('No hay cambios que guardar.');
      return;
    }
    setGuardando(true);
    try {
      const actualizado = await api.actualizarCaso(ficha.id_caso, payload);
      setFicha(actualizado);
      setEdicion(aEdicion(actualizado));
      setOk('Caso actualizado.');
      await cargarLista();
    } catch (e) {
      setError(detalleDe(e, 'Error al guardar los cambios del caso.'));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(evento: FormEvent) {
    evento.preventDefault();
    if (!ficha) return;
    setError('');
    setOk('');
    if (!nuevoEstado) {
      setError('Seleccione el nuevo estado del caso.');
      return;
    }
    if (nuevoEstado === ficha.estado_actual) {
      setError('El nuevo estado debe ser distinto del estado actual.');
      return;
    }
    setCambiandoEstado(true);
    try {
      const actualizado = await api.actualizarCaso(ficha.id_caso, {
        estado_actual: nuevoEstado as EstadoCaso,
        motivo_estado: nv(motivoEstado),
      });
      setFicha(actualizado);
      setEdicion(aEdicion(actualizado));
      setNuevoEstado(actualizado.estado_actual);
      setMotivoEstado('');
      setOk('Estado actualizado y registrado en la bitácora.');
      await cargarHistorial(actualizado.id_caso);
      await cargarLista();
    } catch (e) {
      setError(detalleDe(e, 'Error al cambiar el estado del caso.'));
    } finally {
      setCambiandoEstado(false);
    }
  }

  const items = resultado?.items ?? [];
  const total = resultado?.total ?? 0;
  const pages = resultado?.pages ?? 0;

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Casos</h1>
          <p>
            Listado con filtros y ficha completa. Para buscar por incidente o número use el buscador
            global de la barra superior.
          </p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {soloLectura && (
        <div className="aviso aviso-info">
          <span>
            Modo solo lectura: su rol TECNICO no permite crear, editar ni cambiar el estado de los
            casos. Puede consultar la información y la bitácora.
          </span>
        </div>
      )}

      {/* Filtros + listado (RF-33) */}
      <div className="panel-bloque">
        <h2>Listado de casos</h2>
        <form className="formulario" onSubmit={filtrar}>
          <div className="campo">
            <label htmlFor="filtro-q">Texto libre</label>
            <input
              id="filtro-q"
              value={borrador.q}
              onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
              placeholder="Avería, teléfono, cliente o dirección"
            />
          </div>
          <div className="campo">
            <label htmlFor="filtro-estado">Estado</label>
            <select
              id="filtro-estado"
              value={borrador.estado_actual}
              onChange={(e) => setBorrador({ ...borrador, estado_actual: e.target.value })}
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
            <label htmlFor="filtro-categoria">Clase</label>
            <select
              id="filtro-categoria"
              value={borrador.categoria}
              onChange={(e) => setBorrador({ ...borrador, categoria: e.target.value })}
            >
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-tipo">Tipo</label>
            <select
              id="filtro-tipo"
              value={borrador.tipo_caso}
              onChange={(e) => setBorrador({ ...borrador, tipo_caso: e.target.value })}
            >
              <option value="">Todos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-origen">Origen</label>
            <select
              id="filtro-origen"
              value={borrador.origen}
              onChange={(e) => setBorrador({ ...borrador, origen: e.target.value })}
            >
              <option value="">Todos</option>
              {ORIGENES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-gestion">Cuadrilla 0 (supervisor)</label>
            <select
              id="filtro-gestion"
              value={borrador.en_gestion_supervisor}
              onChange={(e) => setBorrador({ ...borrador, en_gestion_supervisor: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-desde">Reporte desde</label>
            <input
              id="filtro-desde"
              type="date"
              value={borrador.desde}
              onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
            />
          </div>
          <div className="campo">
            <label htmlFor="filtro-hasta">Reporte hasta</label>
            <input
              id="filtro-hasta"
              type="date"
              value={borrador.hasta}
              onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
            />
          </div>
          <div className="acciones-form">
            <button className="btn" type="submit" disabled={cargandoLista}>
              {cargandoLista ? 'Filtrando…' : 'Filtrar'}
            </button>
            <button type="button" className="btn btn-secundario" onClick={limpiar}>
              Limpiar
            </button>
          </div>
        </form>

        <div className="barra-paginacion">
          <span className="texto-pequeno">
            {cargandoLista ? 'Cargando…' : `Total: ${total} caso(s) · página ${page} de ${pages || 1}`}
          </span>
          <div className="paginacion-controles">
            <label className="texto-pequeno" htmlFor="pagina-tamanio">
              Por página
            </label>
            <select
              id="pagina-tamanio"
              value={tamanio}
              onChange={(e) => {
                setTamanio(Number(e.target.value));
                setPage(1);
              }}
            >
              {TAMANOS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-mini btn-secundario"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={cargandoLista || page <= 1}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn-mini btn-secundario"
              onClick={() => setPage((p) => p + 1)}
              disabled={cargandoLista || pages === 0 || page >= pages}
            >
              Siguiente
            </button>
          </div>
        </div>

        {cargandoFicha && <p className="texto-pequeno">Cargando ficha…</p>}

        {cargandoLista ? (
          <p className="vacio">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="vacio">No hay casos que coincidan con los filtros.</p>
        ) : (
          <TablaCasos items={items} onVer={(id) => void abrirFicha(id)} />
        )}
      </div>

      {/* Ficha del caso (RF-31) + estado + historial (RNF-12), en ventana flotante. */}
      {ficha && (
        <Modal
          titulo={`Ficha del caso #${ficha.id_caso} — ${ficha.id_averia}`}
          onCerrar={() => setFicha(null)}
        >
          <div className="tabla-envoltura">
            <table className="tabla-ficha">
              <tbody>
                <Grupo titulo="Identificación" />
                <Fila etiqueta="ID caso" valor={ficha.id_caso} />
                <Fila etiqueta="ID avería" valor={<span className="mono">{ficha.id_averia}</span>} />
                <Fila
                  etiqueta="Central"
                  valor={
                    ficha.nombre_central
                      ? `${ficha.codigo_central ?? ''} — ${ficha.nombre_central}`.trim()
                      : ficha.id_central
                  }
                />
                <Fila etiqueta="Origen" valor={ficha.origen} />
                <Fila etiqueta="Estado actual" valor={ficha.estado_actual} />
                <Fila etiqueta="Cuadrilla 0 (supervisor)" valor={ficha.en_gestion_supervisor ? 'Sí' : 'No'} />
                <Fila etiqueta="Falla masiva" valor={ficha.es_falla_masiva ? 'Sí' : 'No'} />
                <Fila etiqueta="Lote de ingesta" valor={ficha.id_lote_ingesta} />
                <Fila etiqueta="Creado en" valor={fechaHora(ficha.creado_en)} />
                <Fila etiqueta="Actualizado en" valor={fechaHora(ficha.actualizado_en)} />

                <Grupo titulo="Contacto" />
                <Fila etiqueta="Cliente" valor={ficha.nombre_cliente} />
                <Fila etiqueta="Teléfono" valor={ficha.telefono} />
                <Fila etiqueta="Dirección" valor={ficha.direccion} />
                <Fila etiqueta="Persona que reporta" valor={ficha.persona_reporta} />
                <Fila etiqueta="Contacto del cliente" valor={ficha.contacto_cliente} />

                <Grupo titulo="Fechas" />
                <Fila etiqueta="Fecha de reporte" valor={fechaHora(ficha.fecha_reporte)} />
                <Fila etiqueta="Fecha de compromiso" valor={fechaHora(ficha.fecha_compromiso)} />
                <Fila etiqueta="Fecha de cita" valor={fechaHora(ficha.fecha_cita)} />

                <Grupo titulo="Textos" />
                <Fila etiqueta="Problema reportado" valor={ficha.problema_reporte} />
                <Fila etiqueta="Último comentario" valor={ficha.ultimo_comentario} />
                <Fila etiqueta="Información" valor={ficha.informacion} />
                <Fila etiqueta="Results" valor={ficha.results} />
                <Fila etiqueta="Estatus de origen" valor={ficha.estatus_origen} />

                <Grupo titulo="Datos técnicos" />
                <Fila etiqueta="OLT" valor={ficha.olt} />
                <Fila etiqueta="Plan" valor={ficha.plan} />
                <Fila etiqueta="Slot" valor={ficha.slot} />
                <Fila etiqueta="Puerto" valor={ficha.puerto} />
                <Fila etiqueta="FAT" valor={ficha.fat} />
                <Fila etiqueta="Serial" valor={ficha.serial} />
                <Fila etiqueta="Tipo de servicio" valor={ficha.tipo_servicio} />
                <Fila etiqueta="Tipo de problema" valor={ficha.tipo_problema} />
                <Fila etiqueta="Área de trabajo" valor={ficha.area_trabajo} />
                <Fila etiqueta="Unidad de negocio" valor={ficha.unidad_negocio} />
                <Fila etiqueta="Reparador principal" valor={ficha.reparador_principal} />
                <Fila etiqueta="Cuadrilla externa" valor={ficha.cuadrilla_externa} />
                <Fila etiqueta="Flota CAN" valor={ficha.flota_can} />
                <Fila
                  etiqueta="Ayudantes"
                  valor={ficha.ayudantes.length > 0 ? ficha.ayudantes.map(String).join(', ') : ''}
                />

                <Grupo titulo="Clasificación y geografía" />
                <Fila etiqueta="Clase" valor={ficha.categoria} />
                <Fila etiqueta="Tipo" valor={ficha.tipo_caso} />
                <Fila etiqueta="Sector" valor={ficha.sector_nombre ?? ficha.id_sector} />
                <Fila etiqueta="ID causa" valor={ficha.id_causa} />
                <Fila etiqueta="Región" valor={ficha.region} />
                <Fila etiqueta="Estado geográfico" valor={ficha.estado_geografico} />
                <Fila etiqueta="Municipio" valor={ficha.municipio} />
                <Fila etiqueta="Parroquia" valor={ficha.parroquia} />
                <Fila etiqueta="Área" valor={ficha.area} />
              </tbody>
            </table>
          </div>

          {!soloLectura && (
            <>
              <h3 className="subtitulo-seccion">Editar caso</h3>
              <form
                className="formulario modal-formulario"
                onSubmit={(e) => void guardarEdicion(e)}
              >
                <div className="campo">
                  <label htmlFor="edit-cliente">Nombre del cliente</label>
                  <input
                    id="edit-cliente"
                    value={edicion.nombre_cliente}
                    onChange={(e) => setEdicion({ ...edicion, nombre_cliente: e.target.value })}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="edit-telefono">Teléfono</label>
                  <input
                    id="edit-telefono"
                    value={edicion.telefono}
                    onChange={(e) => setEdicion({ ...edicion, telefono: e.target.value })}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="edit-persona">Persona que reporta</label>
                  <input
                    id="edit-persona"
                    value={edicion.persona_reporta}
                    onChange={(e) => setEdicion({ ...edicion, persona_reporta: e.target.value })}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="edit-contacto">Contacto del cliente</label>
                  <input
                    id="edit-contacto"
                    value={edicion.contacto_cliente}
                    onChange={(e) => setEdicion({ ...edicion, contacto_cliente: e.target.value })}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="edit-categoria">Clase</label>
                  <select
                    id="edit-categoria"
                    value={edicion.categoria}
                    onChange={(e) =>
                      setEdicion({ ...edicion, categoria: e.target.value as CategoriaCaso })
                    }
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="edit-tipo">Tipo</label>
                  <select
                    id="edit-tipo"
                    value={edicion.tipo_caso}
                    onChange={(e) => setEdicion({ ...edicion, tipo_caso: e.target.value as TipoCaso })}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="edit-sector">ID sector</label>
                  <input
                    id="edit-sector"
                    type="number"
                    value={edicion.id_sector}
                    onChange={(e) => setEdicion({ ...edicion, id_sector: e.target.value })}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="edit-causa">ID causa</label>
                  <input
                    id="edit-causa"
                    type="number"
                    value={edicion.id_causa}
                    onChange={(e) => setEdicion({ ...edicion, id_causa: e.target.value })}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="edit-servicio">Tipo de servicio</label>
                  <input
                    id="edit-servicio"
                    value={edicion.tipo_servicio}
                    onChange={(e) => setEdicion({ ...edicion, tipo_servicio: e.target.value })}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="edit-cita">Fecha de cita</label>
                  <input
                    id="edit-cita"
                    type="date"
                    value={edicion.fecha_cita}
                    onChange={(e) => setEdicion({ ...edicion, fecha_cita: e.target.value })}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="edit-compromiso">Fecha de compromiso</label>
                  <input
                    id="edit-compromiso"
                    type="date"
                    value={edicion.fecha_compromiso}
                    onChange={(e) => setEdicion({ ...edicion, fecha_compromiso: e.target.value })}
                  />
                </div>
                <div className="campo campo-check">
                  <input
                    id="edit-gestion"
                    type="checkbox"
                    checked={edicion.en_gestion_supervisor}
                    onChange={(e) =>
                      setEdicion({ ...edicion, en_gestion_supervisor: e.target.checked })
                    }
                  />
                  <label htmlFor="edit-gestion">Cuadrilla 0 (supervisor)</label>
                </div>
                <div className="campo campo-check">
                  <input
                    id="edit-masiva"
                    type="checkbox"
                    checked={edicion.es_falla_masiva}
                    onChange={(e) => setEdicion({ ...edicion, es_falla_masiva: e.target.checked })}
                  />
                  <label htmlFor="edit-masiva">Falla masiva</label>
                </div>
                <div className="campo campo-ancho">
                  <label htmlFor="edit-direccion">Dirección</label>
                  <input
                    id="edit-direccion"
                    value={edicion.direccion}
                    onChange={(e) => setEdicion({ ...edicion, direccion: e.target.value })}
                  />
                </div>
                <div className="campo campo-ancho">
                  <label htmlFor="edit-problema">Problema reportado</label>
                  <textarea
                    id="edit-problema"
                    value={edicion.problema_reporte}
                    onChange={(e) => setEdicion({ ...edicion, problema_reporte: e.target.value })}
                  />
                </div>
                <div className="campo campo-ancho">
                  <label htmlFor="edit-comentario">Último comentario</label>
                  <textarea
                    id="edit-comentario"
                    value={edicion.ultimo_comentario}
                    onChange={(e) => setEdicion({ ...edicion, ultimo_comentario: e.target.value })}
                  />
                </div>
                <div className="campo campo-ancho">
                  <label htmlFor="edit-informacion">Información</label>
                  <textarea
                    id="edit-informacion"
                    value={edicion.informacion}
                    onChange={(e) => setEdicion({ ...edicion, informacion: e.target.value })}
                  />
                </div>
                <div className="acciones-form">
                  <button className="btn" type="submit" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => setEdicion(aEdicion(ficha))}
                    disabled={guardando}
                  >
                    Descartar cambios
                  </button>
                </div>
              </form>

              <h3 className="subtitulo-seccion">Cambiar estado</h3>
              <form
                className="formulario modal-formulario"
                onSubmit={(e) => void cambiarEstado(e)}
              >
                <div className="campo">
                  <label htmlFor="estado-nuevo">Nuevo estado</label>
                  <select
                    id="estado-nuevo"
                    value={nuevoEstado}
                    onChange={(e) => setNuevoEstado(e.target.value)}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="estado-motivo">Motivo</label>
                  <input
                    id="estado-motivo"
                    value={motivoEstado}
                    onChange={(e) => setMotivoEstado(e.target.value)}
                    placeholder="Motivo del cambio (queda en la bitácora)"
                  />
                </div>
                <div className="acciones-form">
                  <button className="btn" type="submit" disabled={cambiandoEstado}>
                    {cambiandoEstado ? 'Cambiando…' : 'Cambiar estado'}
                  </button>
                </div>
              </form>
            </>
          )}

          <h3 className="subtitulo-seccion">Historial de estados (bitácora)</h3>
          {cargandoHistorial ? (
            <p className="texto-pequeno">Cargando historial…</p>
          ) : historial.length === 0 ? (
            <p className="vacio">No hay movimientos registrados.</p>
          ) : (
            <div className="tabla-envoltura">
              <table>
                <thead>
                  <tr>
                    <th>Estado anterior</th>
                    <th>Estado nuevo</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                    <th>Fecha y hora</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id_hist}>
                      <td>{h.estado_anterior ?? '—'}</td>
                      <td>{h.estado_nuevo}</td>
                      <td>{h.motivo ?? '—'}</td>
                      <td>{h.usuario ?? '—'}</td>
                      <td>{fechaHora(h.fecha_hora)}</td>
                    </tr>
                  ))}
                </tbody>
                <PieTabla
                  colSpan={5}
                  total={historial.length}
                  singular="movimiento"
                  plural="movimientos"
                  cargando={cargandoHistorial}
                />
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
