import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  CanalSolicitante,
  CasoManualCreate,
  ClasificacionEspecial,
  PrioridadEspecial,
  TipoActividadEspecial,
} from '../api/types';
import Mensaje from './Mensaje';
import { IconoCerrar } from './Iconos';
import { nv } from '../utils';

const CLASIFICACIONES: ClasificacionEspecial[] = ['REFERIDO', 'EMPRESA', 'GOBIERNO'];
const TIPOS_ACTIVIDAD: TipoActividadEspecial[] = ['REPARACION', 'CONSTRUCCION'];
const PRIORIDADES: PrioridadEspecial[] = ['ALTA', 'MEDIA', 'BAJA'];
const CANALES: CanalSolicitante[] = ['TELEGRAM', 'MCP_IA', 'MANUAL', 'CORREO'];

interface Formulario {
  nombre_cliente: string;
  telefono: string;
  direccion: string;
  informacion: string;
  problema_reporte: string;
  fecha_reporte: string;
  es_especial: boolean;
  clasificacion: ClasificacionEspecial;
  tipo_actividad: TipoActividadEspecial;
  prioridad: PrioridadEspecial;
  requiere_informe: boolean;
  sol_unidad: string;
  sol_nombre: string;
  sol_contacto: string;
  sol_canal: CanalSolicitante;
}

/** Valor para `datetime-local` con la fecha y hora actuales. */
function ahoraLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${dd}T${hh}:${mm}`;
}

function formularioVacio(): Formulario {
  return {
    nombre_cliente: '',
    telefono: '',
    direccion: '',
    informacion: '',
    problema_reporte: '',
    fecha_reporte: ahoraLocal(),
    es_especial: false,
    clasificacion: 'REFERIDO',
    tipo_actividad: 'REPARACION',
    prioridad: 'MEDIA',
    requiere_informe: true,
    sol_unidad: '',
    sol_nombre: '',
    sol_contacto: '',
    sol_canal: 'MANUAL',
  };
}

interface Resultado {
  tipo: 'normal' | 'especial';
  id_caso: number | null;
  id_caso_especial: number | null;
  id_averia: string | null;
}

interface Props {
  onCerrar: () => void;
}

/**
 * Modal flotante «Agregar caso» (RF-32/RF-06): da de alta un caso normal o,
 * al marcar «Es un caso especial», un caso especial con solicitante externo.
 */
export default function ModalCaso({ onCerrar }: Props) {
  const [form, setForm] = useState<Formulario>(formularioVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const cajaRef = useRef<HTMLDivElement>(null);

  // Foco inicial + cierre con Escape + foco encerrado en el modal.
  useEffect(() => {
    const primero = cajaRef.current?.querySelector<HTMLElement>('input, select, textarea, button');
    primero?.focus();

    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        onCerrar();
        return;
      }
      if (evento.key !== 'Tab') return;
      const caja = cajaRef.current;
      if (!caja) return;
      const focusables = Array.from(
        caja.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]',
        ),
      );
      if (focusables.length === 0) return;
      const primeroF = focusables[0];
      const ultimoF = focusables[focusables.length - 1];
      if (evento.shiftKey && document.activeElement === primeroF) {
        evento.preventDefault();
        ultimoF.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimoF) {
        evento.preventDefault();
        primeroF.focus();
      }
    }

    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError('');

    if (form.es_especial) {
      const unidad = form.sol_unidad.trim();
      const nombre = form.sol_nombre.trim();
      const contacto = form.sol_contacto.trim();
      if (!unidad || !nombre || !contacto) {
        setError(
          'Para un caso especial complete los datos del solicitante: unidad, nombre y contacto.',
        );
        return;
      }
      setGuardando(true);
      try {
        const creado = await api.crearCasoEspecial({
          clasificacion: form.clasificacion,
          tipo_actividad: form.tipo_actividad,
          prioridad: form.prioridad,
          requiere_informe: form.requiere_informe,
          descripcion: nv(form.informacion),
          nombre_cliente: nv(form.nombre_cliente),
          telefono: nv(form.telefono),
          direccion: nv(form.direccion),
          crear_solicitante: { unidad, nombre, contacto, canal: form.sol_canal },
        });
        let idAveria: string | null = null;
        if (creado.id_caso !== null) {
          try {
            idAveria = (await api.obtenerCaso(creado.id_caso)).id_averia;
          } catch {
            idAveria = null;
          }
        }
        setResultado({
          tipo: 'especial',
          id_caso: creado.id_caso,
          id_caso_especial: creado.id_caso_especial,
          id_averia: idAveria,
        });
      } catch (e) {
        setError(e instanceof api.ApiError ? e.message : 'Error al crear el caso especial.');
      } finally {
        setGuardando(false);
      }
      return;
    }

    const payload: CasoManualCreate = {
      nombre_cliente: nv(form.nombre_cliente),
      telefono: nv(form.telefono),
      direccion: nv(form.direccion),
      informacion: nv(form.informacion),
      problema_reporte: nv(form.problema_reporte),
      fecha_reporte: form.fecha_reporte ? form.fecha_reporte : null,
    };
    if (
      !payload.nombre_cliente &&
      !payload.telefono &&
      !payload.direccion &&
      !payload.problema_reporte
    ) {
      setError('Complete al menos nombre, teléfono, dirección o problema reportado.');
      return;
    }
    setGuardando(true);
    try {
      const creado = await api.crearCaso(payload);
      setResultado({
        tipo: 'normal',
        id_caso: creado.id_caso,
        id_caso_especial: null,
        id_averia: creado.id_averia,
      });
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al crear el caso.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo" onMouseDown={onCerrar}>
      <div
        ref={cajaRef}
        className="modal-caja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-caso-titulo"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-cabecera">
          <h2 id="modal-caso-titulo">Agregar caso</h2>
          <button
            type="button"
            className="modal-cerrar"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={onCerrar}
          >
            <IconoCerrar />
          </button>
        </div>

        {resultado ? (
          <div className="modal-resultado">
            <Mensaje tipo="ok" texto="Registro creado correctamente." />
            {resultado.tipo === 'normal' ? (
              <p>
                ID de avería:{' '}
                <strong
                  className={
                    resultado.id_averia?.startsWith('REF-') ? 'mono id-ref' : 'mono'
                  }
                >
                  {resultado.id_averia ?? '—'}
                </strong>
              </p>
            ) : (
              <>
                <p>
                  Caso especial:{' '}
                  <strong className="mono">#{resultado.id_caso_especial}</strong>
                </p>
                <p>
                  Caso asociado:{' '}
                  <strong className="mono">{resultado.id_caso ?? '—'}</strong>
                </p>
                <p>
                  Identificador generado:{' '}
                  <strong
                    className={
                      resultado.id_averia?.startsWith('REF-') ? 'mono id-ref' : 'mono'
                    }
                  >
                    {resultado.id_averia ?? '—'}
                  </strong>
                </p>
              </>
            )}
            <div className="acciones-form">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setResultado(null);
                  setForm(formularioVacio());
                }}
              >
                Agregar otro
              </button>
              <button type="button" className="btn btn-secundario" onClick={onCerrar}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form className="formulario modal-formulario" onSubmit={(e) => void guardar(e)}>
            <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />

            <div className="campo campo-ancho">
              <label htmlFor="nc-nombre">Nombre del cliente</label>
              <input
                id="nc-nombre"
                value={form.nombre_cliente}
                onChange={(e) => setForm({ ...form, nombre_cliente: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="nc-telefono">Teléfono</label>
              <input
                id="nc-telefono"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="nc-fecha">Fecha de reporte</label>
              <input
                id="nc-fecha"
                type="datetime-local"
                value={form.fecha_reporte}
                onChange={(e) => setForm({ ...form, fecha_reporte: e.target.value })}
              />
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="nc-direccion">Dirección</label>
              <input
                id="nc-direccion"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="nc-problema">Problema reportado</label>
              <textarea
                id="nc-problema"
                value={form.problema_reporte}
                onChange={(e) => setForm({ ...form, problema_reporte: e.target.value })}
              />
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="nc-informacion">Información adicional</label>
              <textarea
                id="nc-informacion"
                value={form.informacion}
                onChange={(e) => setForm({ ...form, informacion: e.target.value })}
              />
            </div>

            <div className="campo campo-check campo-ancho">
              <input
                id="nc-especial"
                type="checkbox"
                checked={form.es_especial}
                onChange={(e) => setForm({ ...form, es_especial: e.target.checked })}
              />
              <label htmlFor="nc-especial">Es un caso especial</label>
            </div>

            {form.es_especial && (
              <div className="subpanel campo-ancho bloque-especial">
                <div className="formulario">
                  <div className="campo">
                    <label htmlFor="nc-clasificacion">Clasificación</label>
                    <select
                      id="nc-clasificacion"
                      value={form.clasificacion}
                      onChange={(e) =>
                        setForm({ ...form, clasificacion: e.target.value as ClasificacionEspecial })
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
                    <label htmlFor="nc-actividad">Tipo de actividad</label>
                    <select
                      id="nc-actividad"
                      value={form.tipo_actividad}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          tipo_actividad: e.target.value as TipoActividadEspecial,
                        })
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
                    <label htmlFor="nc-prioridad">Prioridad</label>
                    <select
                      id="nc-prioridad"
                      value={form.prioridad}
                      onChange={(e) =>
                        setForm({ ...form, prioridad: e.target.value as PrioridadEspecial })
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
                      id="nc-informe"
                      type="checkbox"
                      checked={form.requiere_informe}
                      onChange={(e) => setForm({ ...form, requiere_informe: e.target.checked })}
                    />
                    <label htmlFor="nc-informe">Requiere informe</label>
                  </div>
                  <div className="campo">
                    <label htmlFor="nc-sol-unidad">Solicitante — unidad</label>
                    <input
                      id="nc-sol-unidad"
                      value={form.sol_unidad}
                      onChange={(e) => setForm({ ...form, sol_unidad: e.target.value })}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="nc-sol-nombre">Solicitante — nombre</label>
                    <input
                      id="nc-sol-nombre"
                      value={form.sol_nombre}
                      onChange={(e) => setForm({ ...form, sol_nombre: e.target.value })}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="nc-sol-contacto">Solicitante — contacto</label>
                    <input
                      id="nc-sol-contacto"
                      value={form.sol_contacto}
                      onChange={(e) => setForm({ ...form, sol_contacto: e.target.value })}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="nc-sol-canal">Solicitante — canal</label>
                    <select
                      id="nc-sol-canal"
                      value={form.sol_canal}
                      onChange={(e) =>
                        setForm({ ...form, sol_canal: e.target.value as CanalSolicitante })
                      }
                    >
                      {CANALES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar caso'}
              </button>
              <button type="button" className="btn btn-secundario" onClick={onCerrar}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
