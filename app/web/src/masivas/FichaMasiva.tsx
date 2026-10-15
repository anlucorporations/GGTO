/**
 * Ficha flotante de gestión de una MASIVA (D-99).
 *
 * Envuelve todo el ciclo de vida de la falla masiva en cinco pestañas:
 *
 *  - MASIVA     : resumen completo (concentración, RUTA, FAT, casos, cierre…)
 *                 y edición de estado, cuadrilla, sector y descripción.
 *  - CASOS      : casos asociados con sus datos técnicos (incluida la RUTA que
 *                 viaja en la columna EXTRA de la ingesta), alta y baja manual.
 *  - PLANIFICAR : plan de atención, reporte simple, evidencias y cuadrilla.
 *  - MATERIALES : órdenes de la masiva y nueva solicitud de material.
 *  - CERRAR     : cierre masivo **de todos** los casos, con validador del CRASS,
 *                 evidencias, modo de cierre (IVR/COS/SACAS) y resumen final.
 *
 * El cierre exige un validador del CRASS activo; si el catálogo no tiene
 * ninguno, se avisa y se ofrece el enlace a la pestaña PERSONAL EXTERNO.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  CasoAsociadoOut,
  CierreMasivaOut,
  Cuadrilla,
  EstadoFallaMasiva,
  FallaMasivaOut,
  ModoCierre,
  OrdenMaterialOut,
  PersonalExterno,
  Sector,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { fechaHora, nv } from '../utils';
import ListaEvidencias from './ListaEvidencias';

type PestanaMasiva = 'masiva' | 'casos' | 'planificar' | 'materiales' | 'cerrar';

const PESTANAS: { id: PestanaMasiva; etiqueta: string }[] = [
  { id: 'masiva', etiqueta: 'Masiva' },
  { id: 'casos', etiqueta: 'Casos asociados' },
  { id: 'planificar', etiqueta: 'Planificar' },
  { id: 'materiales', etiqueta: 'Materiales' },
  { id: 'cerrar', etiqueta: 'Cerrar' },
];

const ESTADOS_MASIVA: EstadoFallaMasiva[] = ['DETECTADA', 'PLANIFICADA', 'ATENDIDA', 'CERRADA'];
const MODOS_CIERRE: ModoCierre[] = ['IVR', 'COS', 'SACAS'];

/** Máximo de seriales de evidencia en el cierre de la masiva. */
const MAX_EVIDENCIAS_CIERRE = 20;
/** Máximo de seriales de evidencia en la planificación de la atención. */
const MAX_EVIDENCIAS_PLAN = 10;
/** Descripción que queda en cada caso al cerrar (valor por defecto de RF-62). */
const TEXTO_CIERRE_CASO = 'Reparado en FDT';

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function txt(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return String(valor);
}

function claseEstado(estado: string): string {
  if (estado === 'CERRADA') return 'chip-estado chip-estado-ok';
  if (estado === 'ATENDIDA') return 'chip-estado chip-estado-ok';
  return 'chip-estado';
}

/** Valores distintos no vacíos, en el orden en que aparecen. */
function unicos(valores: (string | null)[]): string[] {
  const salida: string[] = [];
  for (const valor of valores) {
    if (valor === null) continue;
    const limpio = valor.trim();
    if (limpio === '' || salida.includes(limpio)) continue;
    salida.push(limpio);
  }
  return salida;
}

interface Props {
  falla: FallaMasivaOut;
  onCerrar: () => void;
  /** El padre recarga su tabla con la masiva devuelta por la API. */
  onActualizada: (falla: FallaMasivaOut, mensaje: string) => void;
  /** Salta a la pestaña PERSONAL EXTERNO de la página (alta de validadores). */
  onIrAPersonalExterno?: () => void;
}

export default function FichaMasiva({
  falla,
  onCerrar,
  onActualizada,
  onIrAPersonalExterno,
}: Props) {
  const { soloLectura } = useAuth();
  const [pestana, setPestana] = useState<PestanaMasiva>('masiva');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState('');

  // --- Catálogos para las ediciones ---------------------------------
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [validadores, setValidadores] = useState<PersonalExterno[]>([]);
  const [cargandoValidadores, setCargandoValidadores] = useState(true);

  // --- Pestaña MASIVA (resumen + edición) ---------------------------
  const [editando, setEditando] = useState(false);
  const [estado, setEstado] = useState<EstadoFallaMasiva>(falla.estado as EstadoFallaMasiva);
  const [descripcion, setDescripcion] = useState(falla.descripcion);
  const [idSector, setIdSector] = useState(falla.id_sector === null ? '' : String(falla.id_sector));
  const [idCuadrilla, setIdCuadrilla] = useState(
    falla.id_cuadrilla === null ? '' : String(falla.id_cuadrilla),
  );

  // --- CASOS ASOCIADOS ----------------------------------------------
  const [casos, setCasos] = useState<CasoAsociadoOut[]>([]);
  const [cargandoCasos, setCargandoCasos] = useState(false);
  const [idsAgregar, setIdsAgregar] = useState('');

  // --- PLANIFICAR ---------------------------------------------------
  const [planificacion, setPlanificacion] = useState(falla.planificacion ?? '');
  const [reporteSimple, setReporteSimple] = useState(falla.reporte_simple ?? '');
  const [evidenciasPlan, setEvidenciasPlan] = useState<string[]>([]);
  const [idCuadrillaPlan, setIdCuadrillaPlan] = useState(
    falla.id_cuadrilla === null ? '' : String(falla.id_cuadrilla),
  );

  // --- MATERIALES ---------------------------------------------------
  const [ordenes, setOrdenes] = useState<OrdenMaterialOut[]>([]);
  const [cargandoOrdenes, setCargandoOrdenes] = useState(false);
  const [materialNuevo, setMaterialNuevo] = useState('');
  const [idCuadrillaMaterial, setIdCuadrillaMaterial] = useState('');

  // --- CERRAR -------------------------------------------------------
  const [descripcionCierre, setDescripcionCierre] = useState('');
  const [idValidador, setIdValidador] = useState('');
  const [evidenciasCierre, setEvidenciasCierre] = useState<string[]>([]);
  const [modo, setModo] = useState<ModoCierre>('IVR');
  const [descripcionCaso, setDescripcionCaso] = useState(TEXTO_CIERRE_CASO);
  const [resultado, setResultado] = useState<CierreMasivaOut | null>(null);

  /** Cuadrillas, sectores y validadores del CRASS activos. */
  const cargarCatalogos = useCallback(async () => {
    setCargandoValidadores(true);
    const [sec, cua, val] = await Promise.allSettled([
      api.listarSectores({ solo_activos: true }),
      api.listarCuadrillas({ solo_activas: true }),
      api.listarPersonalExterno({ tipo: 'CRASS', solo_activos: true }),
    ]);
    setSectores(sec.status === 'fulfilled' ? sec.value : []);
    setCuadrillas(cua.status === 'fulfilled' ? cua.value : []);
    setValidadores(val.status === 'fulfilled' ? val.value : []);
    setCargandoValidadores(false);
  }, []);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  // Si solo hay un validador del CRASS activo se preselecciona: el operador
  // igualmente debe confirmarlo antes de cerrar.
  useEffect(() => {
    if (idValidador === '' && validadores.length === 1) {
      setIdValidador(String(validadores[0].id_solicitante));
    }
  }, [validadores, idValidador]);

  const cargarCasos = useCallback(async () => {
    setCargandoCasos(true);
    try {
      setCasos(await api.casosAsociadosMasiva(falla.id_falla));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al cargar los casos asociados.'));
    } finally {
      setCargandoCasos(false);
    }
  }, [falla.id_falla]);

  const cargarOrdenes = useCallback(async () => {
    setCargandoOrdenes(true);
    try {
      setOrdenes(await api.listarOrdenesFalla(falla.id_falla));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al cargar las órdenes de material.'));
    } finally {
      setCargandoOrdenes(false);
    }
  }, [falla.id_falla]);

  useEffect(() => {
    if (pestana === 'casos') void cargarCasos();
  }, [pestana, cargarCasos]);

  useEffect(() => {
    if (pestana === 'materiales') void cargarOrdenes();
  }, [pestana, cargarOrdenes]);

  // El padre puede entregar una masiva nueva (tras guardar): se resincroniza.
  useEffect(() => {
    setEstado(falla.estado as EstadoFallaMasiva);
    setDescripcion(falla.descripcion);
    setIdSector(falla.id_sector === null ? '' : String(falla.id_sector));
    setIdCuadrilla(falla.id_cuadrilla === null ? '' : String(falla.id_cuadrilla));
    setIdCuadrillaPlan(falla.id_cuadrilla === null ? '' : String(falla.id_cuadrilla));
    setPlanificacion(falla.planificacion ?? '');
    setReporteSimple(falla.reporte_simple ?? '');
    setEditando(false);
  }, [falla]);

  /** Refresca la ficha desde la API y avisa al padre. */
  async function refrescar(mensaje: string) {
    const actualizada = await api.obtenerFallaMasiva(falla.id_falla);
    onActualizada(actualizada, mensaje);
  }

  /* --------------------------- Acciones --------------------------- */

  async function guardarMasiva(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    setOcupado('masiva');
    try {
      const actualizada = await api.actualizarFallaMasiva(falla.id_falla, {
        estado,
        descripcion: nv(descripcion) ?? undefined,
        id_sector: idSector === '' ? null : Number(idSector),
        id_cuadrilla: idCuadrilla === '' ? null : Number(idCuadrilla),
      });
      setEditando(false);
      onActualizada(actualizada, `Masiva #${falla.id_falla} actualizada.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo guardar la masiva.'));
    } finally {
      setOcupado('');
    }
  }

  async function agregarCasos(evento: FormEvent) {
    evento.preventDefault();
    const ids = idsAgregar
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      setError('Indique al menos un id de caso o de avería válido (números separados por coma).');
      return;
    }
    setError('');
    setOk('');
    setOcupado('casos-agregar');
    try {
      setCasos(await api.asociarCasosMasiva(falla.id_falla, ids));
      setIdsAgregar('');
      setOk(`${ids.length} caso(s) asociado(s) a la masiva #${falla.id_falla}.`);
      await refrescar(`Casos asociados actualizados en la masiva #${falla.id_falla}.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudieron asociar los casos.'));
    } finally {
      setOcupado('');
    }
  }

  async function quitarCaso(caso: CasoAsociadoOut) {
    setError('');
    setOk('');
    setOcupado(`caso-${caso.id_caso}`);
    try {
      setCasos(await api.quitarCasosMasiva(falla.id_falla, [caso.id_caso]));
      setOk(`Caso ${caso.id_averia} (${caso.id_caso}) quitado de la masiva.`);
      await refrescar(`Caso ${caso.id_averia} quitado de la masiva #${falla.id_falla}.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo quitar el caso de la masiva.'));
    } finally {
      setOcupado('');
    }
  }

  async function guardarPlanificacion(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    setOcupado('planificar');
    try {
      const actualizada = await api.planificarFallaMasiva(falla.id_falla, {
        planificacion: planificacion.trim(),
        reporte_simple: nv(reporteSimple),
        evidencias: evidenciasPlan,
        id_cuadrilla: idCuadrillaPlan === '' ? null : Number(idCuadrillaPlan),
      });
      onActualizada(actualizada, `Planificación de la masiva #${falla.id_falla} guardada.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo guardar la planificación.'));
    } finally {
      setOcupado('');
    }
  }

  async function solicitarMaterial(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    setOcupado('material');
    try {
      await api.solicitarMaterialFalla(falla.id_falla, {
        descripcion: materialNuevo.trim(),
        id_cuadrilla: idCuadrillaMaterial === '' ? null : Number(idCuadrillaMaterial),
      });
      setMaterialNuevo('');
      await cargarOrdenes();
      setOk(`Orden de material solicitada para la masiva #${falla.id_falla}.`);
      await refrescar(`Material solicitado para la masiva #${falla.id_falla}.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo solicitar el material.'));
    } finally {
      setOcupado('');
    }
  }

  async function cerrarMasiva(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    if (descripcionCierre.trim().length < 10) {
      setError('La descripción del trabajo es obligatoria y debe tener al menos 10 caracteres.');
      return;
    }
    if (idValidador === '') {
      setError('Seleccione el personal del CRASS que valida la reparación.');
      return;
    }
    setOcupado('cerrar');
    try {
      const cierre = await api.cerrarMasiva(falla.id_falla, {
        descripcion: descripcionCierre.trim(),
        id_validador_crass: Number(idValidador),
        evidencias: evidenciasCierre,
        modo,
        descripcion_caso: descripcionCaso.trim() === '' ? undefined : descripcionCaso.trim(),
      });
      setResultado(cierre);
      setOk(
        `Masiva #${falla.id_falla} cerrada: ${cierre.casos_cerrados} caso(s) cerrado(s) y ` +
          `${cierre.casos_omitidos} omitido(s).`,
      );
      await refrescar(`Masiva #${falla.id_falla} cerrada (${cierre.casos_cerrados} casos).`);
      await cargarCasos();
    } catch (e) {
      setError(detalleDe(e, 'No se pudo cerrar la masiva.'));
    } finally {
      setOcupado('');
    }
  }

  /** La ficha abandona la pestaña de cierre sin validadores activos. */
  function irAPersonalExterno() {
    onCerrar();
    onIrAPersonalExterno?.();
  }

  /* --------------------------- Derivados -------------------------- */

  const sinValidadores = !cargandoValidadores && validadores.length === 0;
  const casosAsociados = falla.casos_asociados ?? casos.length;
  const resumenOlt = unicos(casos.map((c) => c.olt));
  const resumenFat = unicos(casos.map((c) => c.fat));
  const resumenRuta = unicos(casos.map((c) => c.ruta));
  const resumenSlotPuerto = unicos(
    casos.map((c) => [c.slot, c.puerto].filter(Boolean).join('/')),
  );

  return (
    <Modal
      titulo={`Masiva #${falla.id_falla}`}
      onCerrar={onCerrar}
      cabeceraExtra={<span className={claseEstado(falla.estado)}>{falla.estado}</span>}
    >
      <div className="falla-pestanas" role="tablist" aria-label="Secciones de la masiva">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            className={`falla-pestana${pestana === p.id ? ' activa' : ''}`}
            onClick={() => {
              setPestana(p.id);
              setError('');
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {/* ------------------------------ MASIVA ------------------------------ */}
      {pestana === 'masiva' && (
        <div className="falla-panel" role="tabpanel">
          {!editando ? (
            <>
              <div className="datos-grid">
                <div className="dato">
                  <span className="dato-etiqueta">Estado</span>
                  <span className="dato-valor">{falla.estado}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Origen</span>
                  <span className="dato-valor">{falla.origen}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Concentración</span>
                  <span className="dato-valor mono">{txt(falla.clave_concentracion)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">ODN</span>
                  <span className="dato-valor mono">{txt(falla.odn)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">FAT</span>
                  <span className="dato-valor mono">{txt(falla.fat)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">RUTA</span>
                  <span className="dato-valor mono">{txt(falla.ruta)}</span>
                </div>
                <div className="dato dato-ancha">
                  <span className="dato-etiqueta">Dirección</span>
                  <span className="dato-valor">
                    {txt(falla.direccion ?? falla.direccion_corta)}
                  </span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Sector</span>
                  <span className="dato-valor">{txt(falla.sector_nombre)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Cuadrilla</span>
                  <span className="dato-valor">
                    {falla.cuadrilla_codigo
                      ? `${falla.cuadrilla_codigo} — ${falla.cuadrilla_nombre ?? ''}`
                      : '—'}
                  </span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Casos asociados</span>
                  <span className="dato-valor">{txt(casosAsociados)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Casos cerrados</span>
                  <span className="dato-valor">{txt(falla.casos_cerrados)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Órdenes de material</span>
                  <span className="dato-valor">{txt(falla.ordenes_count)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Detección</span>
                  <span className="dato-valor">{fechaHora(falla.fecha_deteccion)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Actualizada</span>
                  <span className="dato-valor">{fechaHora(falla.actualizado_en)}</span>
                </div>
                <div className="dato dato-ancha">
                  <span className="dato-etiqueta">Descripción</span>
                  <span className="dato-valor">{txt(falla.descripcion)}</span>
                </div>
                <div className="dato dato-ancha">
                  <span className="dato-etiqueta">Planificación</span>
                  <span className="dato-valor">{txt(falla.planificacion)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Validador del CRASS</span>
                  <span className="dato-valor">
                    {falla.validador_crass
                      ? `${falla.validador_crass.nombre} — ${falla.validador_crass.unidad}`
                      : '—'}
                  </span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Cierre — quién</span>
                  <span className="dato-valor">{txt(falla.cerrada_por)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Cierre — cuándo</span>
                  <span className="dato-valor">{fechaHora(falla.cerrada_en)}</span>
                </div>
                <div className="dato dato-ancha">
                  <span className="dato-etiqueta">Descripción del cierre</span>
                  <span className="dato-valor">{txt(falla.descripcion_cierre)}</span>
                </div>
                <div className="dato dato-ancha">
                  <span className="dato-etiqueta">Evidencias del cierre</span>
                  <span className="dato-valor mono">
                    {(falla.evidencias_cierre?.length ?? 0) > 0
                      ? falla.evidencias_cierre?.join(' · ')
                      : '—'}
                  </span>
                </div>
                <div className="dato dato-ancha">
                  <span className="dato-etiqueta">Evidencias del reporte</span>
                  <span className="dato-valor mono">
                    {(falla.evidencias?.length ?? 0) > 0 ? falla.evidencias?.join(' · ') : '—'}
                  </span>
                </div>
              </div>
              {!soloLectura && (
                <div className="acciones-form">
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => setEditando(true)}
                  >
                    Editar masiva
                  </button>
                </div>
              )}
            </>
          ) : (
            <form className="formulario modal-formulario" onSubmit={(e) => void guardarMasiva(e)}>
              <div className="campo">
                <label htmlFor="mas-edit-estado">Estado</label>
                <select
                  id="mas-edit-estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoFallaMasiva)}
                >
                  {ESTADOS_MASIVA.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="mas-edit-sector">Sector</label>
                <select
                  id="mas-edit-sector"
                  value={idSector}
                  onChange={(e) => setIdSector(e.target.value)}
                >
                  <option value="">Sin sector</option>
                  {sectores.map((s) => (
                    <option key={s.id_sector} value={s.id_sector}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="mas-edit-cuadrilla">Cuadrilla</label>
                <select
                  id="mas-edit-cuadrilla"
                  value={idCuadrilla}
                  onChange={(e) => setIdCuadrilla(e.target.value)}
                >
                  <option value="">Sin cuadrilla</option>
                  {cuadrillas.map((c) => (
                    <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
                      {c.codigo} — {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo campo-ancho">
                <label htmlFor="mas-edit-descripcion">Descripción *</label>
                <textarea
                  id="mas-edit-descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="acciones-form">
                <button type="submit" className="btn" disabled={ocupado === 'masiva'}>
                  {ocupado === 'masiva' ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => {
                    setEditando(false);
                    setEstado(falla.estado as EstadoFallaMasiva);
                    setDescripcion(falla.descripcion);
                    setIdSector(falla.id_sector === null ? '' : String(falla.id_sector));
                    setIdCuadrilla(falla.id_cuadrilla === null ? '' : String(falla.id_cuadrilla));
                  }}
                  disabled={ocupado === 'masiva'}
                >
                  Descartar cambios
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* -------------------------- CASOS ASOCIADOS ------------------------- */}
      {pestana === 'casos' && (
        <div className="falla-panel" role="tabpanel">
          <div className="masiva-nota">
            Datos técnicos del FAT: OLT <span className="mono">{txt(resumenOlt.join(' · '))}</span> ·
            FAT <span className="mono">{txt(resumenFat.join(' · '))}</span> · RUTA{' '}
            <span className="mono">{txt(resumenRuta.join(' · '))}</span> · Slot/Puerto{' '}
            <span className="mono">{txt(resumenSlotPuerto.join(' · '))}</span>
          </div>

          {!soloLectura && (
            <form className="formulario filtros-tabla" onSubmit={(e) => void agregarCasos(e)}>
              <div className="campo">
                <label htmlFor="mas-casos-agregar">
                  Asociar casos por id de caso o de avería (separados por coma)
                </label>
                <input
                  id="mas-casos-agregar"
                  value={idsAgregar}
                  onChange={(e) => setIdsAgregar(e.target.value)}
                  placeholder="Ej.: 1024, 1025, 20881"
                />
              </div>
              <div className="acciones-form">
                <button
                  type="submit"
                  className="btn"
                  disabled={ocupado === 'casos-agregar' || idsAgregar.trim() === ''}
                >
                  {ocupado === 'casos-agregar' ? 'Asociando…' : 'Asociar casos'}
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => void cargarCasos()}
                  disabled={cargandoCasos}
                >
                  {cargandoCasos ? 'Cargando…' : 'Recargar'}
                </button>
              </div>
            </form>
          )}

          <div className="tabla-envoltura">
            <table className="masiva-tabla-densa">
              <thead>
                <tr>
                  <th>Avería</th>
                  <th>Estado</th>
                  <th>RUTA</th>
                  <th>OLT</th>
                  <th>Slot/Puerto</th>
                  <th>FAT</th>
                  <th>Sector</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Cuadrilla</th>
                  <th>Asociación</th>
                  {!soloLectura && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {cargandoCasos ? (
                  <tr>
                    <td colSpan={soloLectura ? 11 : 12} className="vacio">
                      Cargando…
                    </td>
                  </tr>
                ) : casos.length === 0 ? (
                  <tr>
                    <td colSpan={soloLectura ? 11 : 12} className="vacio">
                      La masiva no tiene casos asociados.
                    </td>
                  </tr>
                ) : (
                  casos.map((c) => (
                    <tr key={c.id_caso}>
                      <td className="mono">{c.id_averia}</td>
                      <td>{c.estado_actual}</td>
                      <td className="mono">{txt(c.ruta)}</td>
                      <td className="mono">{txt(c.olt)}</td>
                      <td className="mono">
                        {txt([c.slot, c.puerto].filter(Boolean).join('/'))}
                      </td>
                      <td className="mono">{txt(c.fat)}</td>
                      <td>{txt(c.sector_nombre)}</td>
                      <td>{txt(c.nombre_cliente)}</td>
                      <td className="mono">{txt(c.telefono)}</td>
                      <td>{txt(c.cuadrilla_codigo ?? c.cuadrilla_nombre)}</td>
                      <td>
                        <span
                          className={`masiva-chip ${
                            c.origen_asociacion === 'AUTO' ? 'masiva-chip-info' : 'masiva-chip-ambar'
                          }`}
                        >
                          {c.origen_asociacion}
                        </span>
                      </td>
                      {!soloLectura && (
                        <td>
                          <button
                            type="button"
                            className="btn btn-mini btn-peligro"
                            onClick={() => void quitarCaso(c)}
                            disabled={ocupado === `caso-${c.id_caso}`}
                          >
                            {ocupado === `caso-${c.id_caso}` ? 'Quitando…' : 'Quitar'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              <PieTabla
                colSpan={soloLectura ? 11 : 12}
                total={casos.length}
                singular="caso"
                plural="casos"
                cargando={cargandoCasos}
              />
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------- PLANIFICAR --------------------------- */}
      {pestana === 'planificar' && (
        <form
          className="formulario modal-formulario"
          role="tabpanel"
          onSubmit={(e) => void guardarPlanificacion(e)}
        >
          <div className="campo campo-ancho">
            <label htmlFor="mas-plan-texto">Planificación *</label>
            <textarea
              id="mas-plan-texto"
              value={planificacion}
              onChange={(e) => setPlanificacion(e.target.value)}
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              placeholder="Ej.: cuadrilla 3 a las 7:00 con 120 m de fibra y 8 conectores"
              disabled={soloLectura}
            />
          </div>
          <div className="campo campo-ancho">
            <label htmlFor="mas-plan-reporte">Reporte simple</label>
            <textarea
              id="mas-plan-reporte"
              value={reporteSimple}
              onChange={(e) => setReporteSimple(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Resumen de la atención para el reporte"
              disabled={soloLectura}
            />
          </div>
          <ListaEvidencias
            idBase="mas-plan"
            etiqueta="Evidencias de la planificación"
            valores={evidenciasPlan}
            onCambiar={setEvidenciasPlan}
            maximo={MAX_EVIDENCIAS_PLAN}
            deshabilitado={soloLectura}
          />
          <div className="campo">
            <label htmlFor="mas-plan-cuadrilla">Cuadrilla asignada</label>
            <select
              id="mas-plan-cuadrilla"
              value={idCuadrillaPlan}
              onChange={(e) => setIdCuadrillaPlan(e.target.value)}
              disabled={soloLectura}
            >
              <option value="">Sin cuadrilla</option>
              {cuadrillas.map((c) => (
                <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
                  {c.codigo} — {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="acciones-form">
            <button
              type="submit"
              className="btn"
              disabled={soloLectura || ocupado === 'planificar' || planificacion.trim().length < 5}
            >
              {ocupado === 'planificar' ? 'Guardando…' : 'Guardar planificación'}
            </button>
          </div>
        </form>
      )}

      {/* ----------------------------- MATERIALES --------------------------- */}
      {pestana === 'materiales' && (
        <div className="falla-panel" role="tabpanel">
          {!soloLectura && (
            <form className="formulario filtros-tabla" onSubmit={(e) => void solicitarMaterial(e)}>
              <div className="campo">
                <label htmlFor="mas-material-nuevo">Material requerido *</label>
                <input
                  id="mas-material-nuevo"
                  value={materialNuevo}
                  onChange={(e) => setMaterialNuevo(e.target.value)}
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="Ej.: 120 m de fibra y 8 conectores SC/APC"
                />
              </div>
              <div className="campo">
                <label htmlFor="mas-material-cuadrilla">Cuadrilla</label>
                <select
                  id="mas-material-cuadrilla"
                  value={idCuadrillaMaterial}
                  onChange={(e) => setIdCuadrillaMaterial(e.target.value)}
                >
                  <option value="">Sin cuadrilla</option>
                  {cuadrillas.map((c) => (
                    <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
                      {c.codigo} — {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="acciones-form">
                <button
                  type="submit"
                  className="btn"
                  disabled={ocupado === 'material' || materialNuevo.trim().length < 3}
                >
                  {ocupado === 'material' ? 'Solicitando…' : 'Solicitar material'}
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => void cargarOrdenes()}
                  disabled={cargandoOrdenes}
                >
                  {cargandoOrdenes ? 'Cargando…' : 'Recargar'}
                </button>
              </div>
            </form>
          )}

          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Estado</th>
                  <th>Solicitante</th>
                  <th>Fecha</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {cargandoOrdenes ? (
                  <tr>
                    <td colSpan={5} className="vacio">
                      Cargando…
                    </td>
                  </tr>
                ) : ordenes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="vacio">
                      Sin órdenes de material para esta masiva.
                    </td>
                  </tr>
                ) : (
                  ordenes.map((o) => (
                    <tr key={o.id_orden}>
                      <td className="mono">{o.id_orden}</td>
                      <td>{o.estado}</td>
                      <td>{txt(o.solicitante_usuario)}</td>
                      <td>{fechaHora(o.fecha)}</td>
                      <td>{txt(o.observacion)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <PieTabla
                colSpan={5}
                total={ordenes.length}
                singular="orden"
                plural="ordenes"
                cargando={cargandoOrdenes}
              />
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------- CERRAR ---------------------------- */}
      {pestana === 'cerrar' && (
        <div className="falla-panel" role="tabpanel">
          <div className="masiva-aviso-cierre">
            <strong>Atención:</strong> cerrar la masiva cierra <strong>TODOS</strong> los casos
            asociados con el mismo modo y la misma descripción. Verifique el listado de CASOS
            ASOCIADOS antes de continuar; la operación no se deshace caso por caso.
          </div>

          {sinValidadores && (
            <div className="aviso aviso-error">
              <span>
                No hay personal del CRASS activo en el catálogo, y la API exige un validador para
                cerrar la masiva. Registre o active un validador en la pestaña PERSONAL EXTERNO.
              </span>
              {onIrAPersonalExterno && (
                <button type="button" className="btn btn-mini" onClick={irAPersonalExterno}>
                  Ir a PERSONAL EXTERNO
                </button>
              )}
            </div>
          )}

          <form className="formulario modal-formulario" onSubmit={(e) => void cerrarMasiva(e)}>
            <div className="campo campo-ancho">
              <label htmlFor="mas-cierre-descripcion">Descripción del trabajo * (mín. 10)</label>
              <textarea
                id="mas-cierre-descripcion"
                value={descripcionCierre}
                onChange={(e) => setDescripcionCierre(e.target.value)}
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                placeholder="Ej.: se reemplazó el splitter del FAT y se repotenciaron los hilos afectados"
                disabled={soloLectura}
              />
            </div>

            <div className="campo">
              <label htmlFor="mas-cierre-validador">
                Personal del CRASS que valida la reparación *
              </label>
              <select
                id="mas-cierre-validador"
                value={idValidador}
                onChange={(e) => setIdValidador(e.target.value)}
                disabled={soloLectura || sinValidadores}
                required
              >
                <option value="">
                  {cargandoValidadores ? 'Cargando…' : '— Seleccione el validador —'}
                </option>
                {validadores.map((v) => (
                  <option key={v.id_solicitante} value={v.id_solicitante}>
                    {v.nombre} — {v.unidad}
                    {v.contacto ? ` (${v.contacto})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <ListaEvidencias
              idBase="mas-cierre"
              etiqueta="Evidencias del cierre (seriales)"
              valores={evidenciasCierre}
              onCambiar={setEvidenciasCierre}
              maximo={MAX_EVIDENCIAS_CIERRE}
              deshabilitado={soloLectura}
            />

            <div className="campo">
              <label htmlFor="mas-cierre-modo">Modo de cierre</label>
              <select
                id="mas-cierre-modo"
                value={modo}
                onChange={(e) => setModo(e.target.value as ModoCierre)}
                disabled={soloLectura}
              >
                {MODOS_CIERRE.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="texto-pequeno">
                IVR es el modo por defecto; COS y SACAS se usan en los cierres administrativos.
              </span>
            </div>

            <div className="campo campo-ancho">
              <label htmlFor="mas-cierre-descripcion-caso">
                Descripción que quedará en cada caso
              </label>
              <input
                id="mas-cierre-descripcion-caso"
                value={descripcionCaso}
                onChange={(e) => setDescripcionCaso(e.target.value)}
                maxLength={200}
                disabled={soloLectura}
              />
            </div>

            <div className="acciones-form">
              <button
                type="submit"
                className="btn btn-peligro"
                disabled={
                  soloLectura ||
                  ocupado === 'cerrar' ||
                  sinValidadores ||
                  descripcionCierre.trim().length < 10 ||
                  idValidador === ''
                }
              >
                {ocupado === 'cerrar' ? 'Cerrando…' : 'Cerrar masiva y todos sus casos'}
              </button>
            </div>
          </form>

          {resultado && (
            <div className="masiva-resumen-cierre">
              <h3 className="subtitulo-seccion">Resumen del cierre</h3>
              <div className="masiva-totales-cierre">
                <div className="masiva-total">
                  <span className="valor">{resultado.casos_cerrados}</span>
                  <span className="etiqueta">Casos cerrados</span>
                </div>
                <div className="masiva-total">
                  <span className="valor">{resultado.casos_omitidos}</span>
                  <span className="etiqueta">Casos omitidos</span>
                </div>
                <div className="masiva-total">
                  <span className="valor">{resultado.estado}</span>
                  <span className="etiqueta">Estado de la masiva</span>
                </div>
              </div>
              <div className="tabla-envoltura">
                <table className="masiva-tabla-densa">
                  <thead>
                    <tr>
                      <th>Caso</th>
                      <th>Avería</th>
                      <th>Resultado</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.detalle.map((d) => (
                      <tr key={d.id_caso}>
                        <td className="mono">{d.id_caso}</td>
                        <td className="mono">{txt(d.id_averia)}</td>
                        <td>{d.resultado}</td>
                        <td>{txt(d.motivo)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <PieTabla
                    colSpan={4}
                    total={resultado.detalle.length}
                    singular="caso"
                    plural="casos"
                  />
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * Chips compactos de una masiva para la columna de indicadores de las tablas.
 * Resumen: estado, nº de casos asociados, órdenes de material y validador.
 */
export function IndicadoresMasiva({ falla }: { falla: FallaMasivaOut }) {
  const casos = falla.casos_asociados ?? 0;
  const ordenes = falla.ordenes_count ?? 0;
  return (
    <span className="masiva-chips">
      <span className={`masiva-chip ${falla.estado === 'CERRADA' ? 'masiva-chip-ok' : 'masiva-chip-info'}`}>
        {falla.estado}
      </span>
      <span className="masiva-chip" title={`${casos} caso(s) asociado(s)`}>
        {casos} caso(s)
      </span>
      <span
        className={`masiva-chip ${ordenes > 0 ? 'masiva-chip-ambar' : ''}`}
        title={ordenes > 0 ? `${ordenes} orden(es) de material` : 'Sin órdenes de material'}
      >
        {ordenes > 0 ? `${ordenes} material(es)` : 'sin material'}
      </span>
      <span
        className={`masiva-chip ${falla.validador_crass ? 'masiva-chip-ok' : ''}`}
        title={
          falla.validador_crass
            ? `Valida: ${falla.validador_crass.nombre} — ${falla.validador_crass.unidad}`
            : 'Sin validador del CRASS'
        }
      >
        {falla.validador_crass ? 'validada CRASS' : 'sin validador'}
      </span>
    </span>
  );
}
