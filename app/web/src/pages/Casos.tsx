import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import * as api from '../api/client';
import type {
  CasoEstadoHistOut,
  CasoOut,
  CasosFiltros,
  CasoUpdate,
  CategoriaCaso,
  Cuadrilla,
  EstadoCaso,
  PaginaCasos,
  Sector,
  TipoCaso,
} from '../api/types';
import FichaCaso, { type Pestana as PestanaFicha } from '../components/FichaCaso';
import { CeldaClase, CeldaTipoCaso } from '../components/CeldasIcono';
import { IconoEditar } from '../components/Iconos';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import EstadoChips from '../components/EstadoChips';
import { useAuth } from '../auth/AuthContext';
import { fecha, fechaHora, nv } from '../utils';

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
const TAMANOS = [10, 25, 50, 100];

interface Filtros {
  q: string;
  estado_actual: string;
  categoria: string;
  tipo_caso: string;
  id_sector: string;
  /** Cuadrilla: '', 'gestion' (Cuadrilla 0 del supervisor) o 'id:<n>'. */
  cuadrilla: string;
}

const FILTROS_VACIOS: Filtros = {
  q: '',
  estado_actual: '',
  categoria: '',
  tipo_caso: '',
  id_sector: '',
  cuadrilla: '',
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

/** Listado resumido: ID, iconos de Tipo/Clase, Sector, Dirección, Nombre y estado. */
function TablaCasos({
  items,
  onVer,
}: {
  items: CasoOut[];
  onVer: (idCaso: number) => void;
}) {
  return (
    <div className="tabla-envoltura">
      <table className="tabla-resumen">
        <thead>
          <tr>
            <th>ID avería</th>
            <th>Tipo</th>
            <th>Clase</th>
            <th>Sector</th>
            <th>Dirección</th>
            <th>Nombre</th>
            <th>Estado</th>
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
              <td>
                <CeldaTipoCaso valor={c.tipo_caso} />
              </td>
              <td>
                <CeldaClase valor={c.categoria} />
              </td>
              <td>{c.sector_nombre ?? '—'}</td>
              <td>{c.direccion ?? '—'}</td>
              <td>{c.nombre_cliente ?? '—'}</td>
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
        <PieTabla colSpan={7} total={items.length} singular="caso" plural="casos" />
      </table>
    </div>
  );
}

export default function Casos() {
  const { soloLectura } = useAuth();
  // Edición de la ficha: ADMIN, SUPERVISOR y Super Usuario (D-70/D-76).
  const puedeEditarCaso = !soloLectura;
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  // Señal para que la ficha salte a una pestaña (el icono de edición del título).
  const [solicitud, setSolicitud] = useState<{ id: PestanaFicha; secuencia: number }>({
    id: 'resumen',
    secuencia: 0,
  });
  const { secuencia } = solicitud;
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
        page,
        page_size: tamanio,
      };
      if (aplicados.id_sector !== '') params.id_sector = Number(aplicados.id_sector);
      // D-72: «Cuadrilla 0» = casos en gestión del supervisor; el resto se
      // filtra por la cuadrilla del último despacho que incluyó el caso.
      if (aplicados.cuadrilla === 'gestion') params.en_gestion_supervisor = true;
      else if (aplicados.cuadrilla.startsWith('id:'))
        params.id_cuadrilla = Number(aplicados.cuadrilla.slice(3));
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

  // Catálogos de filtros (D-72): sectores y cuadrillas para poblar los selects.
  useEffect(() => {
    let vivo = true;
    api
      .listarSectores({ solo_activos: true })
      .then((s) => vivo && setSectores(s))
      .catch(() => vivo && setSectores([]));
    api
      .listarCuadrillas({ solo_activas: true })
      .then((c) => vivo && setCuadrillas(c))
      .catch(() => vivo && setCuadrillas([]));
    return () => {
      vivo = false;
    };
  }, []);

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
            Modo solo lectura: su rol TECNICO no permite crear ni editar los casos. Puede consultar
            la información y la bitácora.
          </span>
        </div>
      )}

      {/* Filtros + listado (RF-33) */}
      <div className="panel-bloque">
        <h2>Listado de casos</h2>
        <form className="formulario filtros-tabla" onSubmit={filtrar}>
          <div className="campo">
            <label htmlFor="filtro-q">Texto libre</label>
            <input
              id="filtro-q"
              value={borrador.q}
              onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
              placeholder="Busca en todos los renglones: avería, tipo, clase, sector, dirección, nombre, estado…"
            />
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
            <label htmlFor="filtro-sector">Sector</label>
            <select
              id="filtro-sector"
              value={borrador.id_sector}
              onChange={(e) => setBorrador({ ...borrador, id_sector: e.target.value })}
            >
              <option value="">Todos</option>
              {sectores.map((s) => (
                <option key={s.id_sector} value={s.id_sector}>
                  {s.nombre}
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
            <label htmlFor="filtro-cuadrilla">Cuadrilla</label>
            <select
              id="filtro-cuadrilla"
              value={borrador.cuadrilla}
              onChange={(e) => setBorrador({ ...borrador, cuadrilla: e.target.value })}
            >
              <option value="">Todas</option>
              <option value="gestion">Cuadrilla 0 (supervisor)</option>
              {cuadrillas
                .filter((c) => !c.es_supervisor)
                .map((c) => (
                  <option key={c.id_cuadrilla} value={`id:${c.id_cuadrilla}`}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
            </select>
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
          cabeceraExtra={
            puedeEditarCaso ? (
              <button
                type="button"
                className="btn btn-mini btn-secundario"
                title="Activar la edición de la ficha"
                aria-label="Activar la edición de la ficha"
                onClick={() => setSolicitud({ id: 'clasificacion', secuencia: secuencia + 1 })}
              >
                <IconoEditar width={16} height={16} />
                Editar
              </button>
            ) : null
          }
        >
          <FichaCaso
            caso={ficha}
            solicitudPestana={solicitud}
            sectores={sectores}
            cuadrillas={cuadrillas}
            puedeEditar={puedeEditarCaso}
            puedeResolver={puedeEditarCaso}
            puedeAsignar={puedeEditarCaso}
            alActivarEdicion={() => undefined}
            onActualizar={(actualizado) => {
              setFicha(actualizado);
              setEdicion(aEdicion(actualizado));
              void cargarHistorial(actualizado.id_caso);
              void cargarLista();
            }}
          />

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
