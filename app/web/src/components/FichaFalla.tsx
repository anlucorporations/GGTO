/**
 * Ficha flotante de una FALLA MASIVA (ciclo D-75).
 *
 * Se abre al seleccionar cualquier parte del renglón de la tabla y reparte la
 * información en cuatro pestañas, todas con su opción de editar:
 *
 *  - MASIVA    : datos de la concentración (sector, ruta unificada, dirección,
 *                casos afectados) + descripción editable, sector y cuadrilla.
 *  - PLANIFICAR: planificación, reporte simple, evidencias y cuadrilla (RF-17).
 *  - MATERIALES: listado de órdenes de la falla + nueva solicitud (RF-18).
 *  - CERRAR    : cambio de estado (DETECTADA → … → CERRADA) con Cerrar rápido.
 *
 * El rol TECNICO (solo lectura) no obtiene acciones de escritura.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type { Cuadrilla, EstadoFallaMasiva, FallaMasivaOut, OrdenMaterialOut, Sector } from '../api/types';
import Modal from './Modal';
import Mensaje from './Mensaje';
import PieTabla from './PieTabla';
import { IconoCerrado, IconoEditar, IconoMateriales, IconoPlanificado } from './Iconos';
import { fechaHora, nv } from '../utils';
import { useAuth } from '../auth/AuthContext';

type PestanaFalla = 'masiva' | 'planificar' | 'materiales' | 'cerrar';

const PESTANAS: { id: PestanaFalla; etiqueta: string }[] = [
  { id: 'masiva', etiqueta: 'Masiva' },
  { id: 'planificar', etiqueta: 'Planificar' },
  { id: 'materiales', etiqueta: 'Materiales' },
  { id: 'cerrar', etiqueta: 'Cerrar' },
];

const ESTADOS_FALLA: EstadoFallaMasiva[] = ['DETECTADA', 'PLANIFICADA', 'ATENDIDA', 'CERRADA'];

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function txt(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return String(valor);
}

/** Mismo mapeo de chips que la tabla de ALERTAS (D-75). */
function claseEstado(estado: string): string {
  if (estado === 'CERRADA' || estado === 'ATENDIDA') return 'chip-estado chip-estado-ok';
  return 'chip-estado';
}

interface Props {
  falla: FallaMasivaOut;
  onCerrar: () => void;
  /** El padre recarga la tabla con la falla devuelta por la API. */
  onActualizada: (falla: FallaMasivaOut, mensaje: string) => void;
}

export default function FichaFalla({ falla, onCerrar, onActualizada }: Props) {
  const { soloLectura } = useAuth();
  const [pestana, setPestana] = useState<PestanaFalla>('masiva');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState('');

  // Catálogos para las ediciones de la pestaña MASIVA.
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [editando, setEditando] = useState(false);
  const [descripcion, setDescripcion] = useState(falla.descripcion);
  const [idSector, setIdSector] = useState<string>(
    falla.id_sector === null ? '' : String(falla.id_sector),
  );
  const [idCuadrilla, setIdCuadrilla] = useState<string>(
    falla.id_cuadrilla === null ? '' : String(falla.id_cuadrilla),
  );

  // Planificar.
  const [planificacion, setPlanificacion] = useState(falla.planificacion ?? '');
  const [reporte, setReporte] = useState(falla.reporte_simple ?? '');
  const [evidencias, setEvidencias] = useState('');

  // Materiales.
  const [ordenes, setOrdenes] = useState<OrdenMaterialOut[]>([]);
  const [cargandoOrdenes, setCargandoOrdenes] = useState(false);
  const [materialNuevo, setMaterialNuevo] = useState('');

  useEffect(() => {
    let vivo = true;
    Promise.all([api.listarSectores({ solo_activos: true }), api.listarCuadrillas({ solo_activas: true })])
      .then(([sec, cua]) => {
        if (!vivo) return;
        setSectores(sec);
        setCuadrillas(cua);
      })
      .catch(() => {
        /* selects vacíos: la ficha sigue siendo util en lectura */
      });
    return () => {
      vivo = false;
    };
  }, []);

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
    if (pestana === 'materiales') void cargarOrdenes();
  }, [pestana, cargarOrdenes]);

  // Sincroniza los formularios cuando el padre entrega una falla nueva.
  useEffect(() => {
    setDescripcion(falla.descripcion);
    setIdSector(falla.id_sector === null ? '' : String(falla.id_sector));
    setIdCuadrilla(falla.id_cuadrilla === null ? '' : String(falla.id_cuadrilla));
    setPlanificacion(falla.planificacion ?? '');
    setReporte(falla.reporte_simple ?? '');
    setEditando(false);
  }, [falla]);

  async function guardarMasiva(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOcupado('masiva');
    try {
      const actualizada = await api.actualizarFallaMasiva(falla.id_falla, {
        descripcion: nv(descripcion) ?? undefined,
        id_sector: idSector === '' ? null : Number(idSector),
        id_cuadrilla: idCuadrilla === '' ? null : Number(idCuadrilla),
      });
      onActualizada(actualizada, `Falla #${falla.id_falla} actualizada.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo guardar la ficha de la falla.'));
    } finally {
      setOcupado('');
    }
  }

  async function guardarPlanificacion(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOcupado('plan');
    try {
      const lista = evidencias
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const actualizada = await api.planificarFallaMasiva(falla.id_falla, {
        planificacion: planificacion.trim(),
        reporte_simple: reporte.trim() || null,
        evidencias: lista,
      });
      onActualizada(actualizada, `Planificación de la falla #${falla.id_falla} guardada (RF-17).`);
      setPestana('masiva');
    } catch (e) {
      setError(detalleDe(e, 'No se pudo guardar la planificación.'));
    } finally {
      setOcupado('');
    }
  }

  async function solicitarMaterial(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOcupado('material');
    try {
      await api.solicitarMaterialFalla(falla.id_falla, { descripcion: materialNuevo.trim() });
      setMaterialNuevo('');
      await cargarOrdenes();
      onActualizada(
        { ...falla, ordenes_count: (falla.ordenes_count ?? 0) + 1 },
        `Orden de material solicitada para la falla #${falla.id_falla} (RF-18).`,
      );
    } catch (e) {
      setError(detalleDe(e, 'No se pudo solicitar el material.'));
    } finally {
      setOcupado('');
    }
  }

  async function cambiarEstado(estado: EstadoFallaMasiva) {
    setError('');
    setOcupado(`estado-${estado}`);
    try {
      const actualizada = await api.actualizarFallaMasiva(falla.id_falla, { estado });
      onActualizada(actualizada, `Falla #${falla.id_falla} actualizada a ${estado}.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo cambiar el estado de la falla.'));
    } finally {
      setOcupado('');
    }
  }

  return (
    <Modal
      titulo={`Falla masiva #${falla.id_falla}`}
      onCerrar={onCerrar}
      cabeceraExtra={
        <span className={claseEstado(falla.estado)}>{falla.estado}</span>
      }
    >
      <div className="falla-pestanas" role="tablist" aria-label="Secciones de la falla">
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

      {pestana === 'masiva' && (
        <div className="falla-panel" role="tabpanel">
          {!editando ? (
            <>
              <div className="datos-grid">
                <div className="dato">
                  <span className="dato-etiqueta">Sector</span>
                  <span className="dato-valor">{txt(falla.sector_nombre)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Dirección (corta)</span>
                  <span className="dato-valor">{txt(falla.direccion_corta)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Ruta (T · P · FAT)</span>
                  <span className="dato-valor mono">{txt(falla.ruta)}</span>
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
                  <span className="dato-etiqueta">Concentración</span>
                  <span className="dato-valor mono">{txt(falla.clave_concentracion)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Casos afectados</span>
                  <span className="dato-valor">{txt(falla.casos_afectos)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Origen</span>
                  <span className="dato-valor">{falla.origen}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Detectada</span>
                  <span className="dato-valor">{fechaHora(falla.fecha_deteccion)}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Actualizada</span>
                  <span className="dato-valor">{fechaHora(falla.actualizado_en)}</span>
                </div>
                <div className="dato dato-ancha">
                  <span className="dato-etiqueta">Descripción</span>
                  <span className="dato-valor">{falla.descripcion}</span>
                </div>
                {falla.planificacion && (
                  <div className="dato dato-ancha">
                    <span className="dato-etiqueta">Planificación vigente</span>
                    <span className="dato-valor">{falla.planificacion}</span>
                  </div>
                )}
              </div>
              {!soloLectura && (
                <div className="acciones-form">
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => setEditando(true)}
                  >
                    <IconoEditar width={16} height={16} /> Editar
                  </button>
                </div>
              )}
            </>
          ) : (
            <form className="formulario modal-formulario" onSubmit={(e) => void guardarMasiva(e)}>
              <div className="campo campo-ancho">
                <label htmlFor="falla-edit-descripcion">Descripción *</label>
                <textarea
                  id="falla-edit-descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="campo">
                <label htmlFor="falla-edit-sector">Sector</label>
                <select
                  id="falla-edit-sector"
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
                <label htmlFor="falla-edit-cuadrilla">Cuadrilla</label>
                <select
                  id="falla-edit-cuadrilla"
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
              <div className="acciones-form">
                <button type="submit" className="btn" disabled={ocupado === 'masiva'}>
                  {ocupado === 'masiva' ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => {
                    setEditando(false);
                    setDescripcion(falla.descripcion);
                    setIdSector(falla.id_sector === null ? '' : String(falla.id_sector));
                    setIdCuadrilla(falla.id_cuadrilla === null ? '' : String(falla.id_cuadrilla));
                  }}
                  disabled={ocupado === 'masiva'}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {pestana === 'planificar' && (
        <form
          className="formulario modal-formulario"
          role="tabpanel"
          onSubmit={(e) => void guardarPlanificacion(e)}
        >
          <div className="campo campo-ancho">
            <label htmlFor="falla-plan-texto">Planificación *</label>
            <textarea
              id="falla-plan-texto"
              value={planificacion}
              onChange={(e) => setPlanificacion(e.target.value)}
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              placeholder="Ej.: cuadrilla 1 a las 8:00 con fusionadora y 100 m de fibra"
              disabled={soloLectura}
            />
          </div>
          <div className="campo campo-ancho">
            <label htmlFor="falla-plan-reporte">Reporte simple</label>
            <textarea
              id="falla-plan-reporte"
              value={reporte}
              onChange={(e) => setReporte(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Resumen de la atención para el reporte"
              disabled={soloLectura}
            />
          </div>
          <div className="campo campo-ancho">
            <label htmlFor="falla-plan-evidencias">
              Evidencias (seriales o rutas, separados por coma)
            </label>
            <input
              id="falla-plan-evidencias"
              value={evidencias}
              onChange={(e) => setEvidencias(e.target.value)}
              placeholder="IMG-001, IMG-002"
              disabled={soloLectura}
            />
          </div>
          <div className="acciones-form">
            <button
              type="submit"
              className="btn"
              disabled={soloLectura || ocupado === 'plan' || planificacion.trim().length < 5}
            >
              {ocupado === 'plan' ? 'Guardando…' : 'Guardar planificación'}
            </button>
          </div>
        </form>
      )}

      {pestana === 'materiales' && (
        <div className="falla-panel" role="tabpanel">
          {!soloLectura && (
            <form
              className="formulario filtros-tabla"
              onSubmit={(e) => void solicitarMaterial(e)}
            >
              <div className="campo">
                <label htmlFor="falla-material-nuevo">Material requerido *</label>
                <input
                  id="falla-material-nuevo"
                  value={materialNuevo}
                  onChange={(e) => setMaterialNuevo(e.target.value)}
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="Ej.: 50 m de fibra y 4 conectores SC/APC"
                />
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
                      Sin órdenes de material para esta falla.
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

      {pestana === 'cerrar' && (
        <div className="falla-panel" role="tabpanel">
          <h3 className="subtitulo-seccion">
            <IconoPlanificado width={16} height={16} /> Flujo de atención (RF-09/RF-17)
          </h3>
          <p className="texto-pequeno">
            Detectada → Planificada → Atendida → <strong>Cerrada</strong>. La planificación queda
            registrada al guardar la pestaña anterior; cerrar la falla la retira de las activas.
          </p>
          {falla.planificacion && (
            <p className="texto-pequeno">
              <IconoCerrado width={14} height={14} /> Plan vigente:{' '}
              <strong>{falla.planificacion.slice(0, 120)}</strong>
              {falla.planificada_en && ` · ${fechaHora(falla.planificada_en)}`}
            </p>
          )}
          <div className="acciones-form">
            {ESTADOS_FALLA.map((estado) => (
              <button
                key={estado}
                type="button"
                className={`btn btn-mini${estado === 'CERRADA' ? ' btn-peligro' : ' btn-secundario'}`}
                disabled={soloLectura || falla.estado === estado || ocupado !== ''}
                onClick={() => void cambiarEstado(estado)}
              >
                {ocupado === `estado-${estado}` ? 'Guardando…' : estado}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Iconos de estado para la columna «Indicadores» de la tabla (D-75). */
export function IndicadoresFalla({ falla }: { falla: FallaMasivaOut }) {
  const items = [
    {
      clave: 'plan',
      activo: Boolean(falla.planificacion),
      titulo: falla.planificacion ? 'Planificada' : 'Sin planificación',
      Icono: IconoPlanificado,
    },
    {
      clave: 'mat',
      activo: (falla.ordenes_count ?? 0) > 0,
      titulo:
        (falla.ordenes_count ?? 0) > 0
          ? `${falla.ordenes_count} orden(es) de material`
          : 'Sin materiales solicitados',
      Icono: IconoMateriales,
    },
    {
      clave: 'cierre',
      activo: falla.estado === 'CERRADA',
      titulo: falla.estado === 'CERRADA' ? 'Falla cerrada' : 'Falla abierta',
      Icono: IconoCerrado,
    },
  ];
  return (
    <span className="celda-indicadores">
      {items.map((i) => (
        <span
          key={i.clave}
          className={`indicador${i.activo ? ' indicador-on' : ''}`}
          title={i.titulo}
          aria-label={i.titulo}
        >
          <i.Icono width={16} height={16} />
        </span>
      ))}
    </span>
  );
}
