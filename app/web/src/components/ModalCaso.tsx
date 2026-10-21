/**
 * Modal flotante «Agregar caso» (RF-32) — **ingesta manual = referido** (D-145).
 *
 * Cambios de D-145:
 *  - El **ID de avería ya no se escribe**: el servidor lo genera con el formato
 *    `REF-(CONS/REP)-######` según el tipo de reporte.
 *  - Todo caso manual queda **tipo REFERIDO** (la actividad —reparación o
 *    construcción— se elige con el *tipo de reporte* y se guarda en la ficha).
 *  - El **solicitante** se elige del catálogo de **personal externo** con tres
 *    listas en cascada: **Unidad → Nombre → Número**. El número seleccionado es
 *    el `id_solicitante` que viaja al servidor.
 *
 * El seguimiento de empresas y gobierno se hace desde ESPECIALES; este modal ya
 * no crea casos especiales.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type { CasoManualCreate, Solicitante, TipoActividadEspecial } from '../api/types';
import Mensaje from './Mensaje';
import { IconoCerrar } from './Iconos';
import { nv } from '../utils';

const TIPOS_REPORTE: TipoActividadEspecial[] = ['REPARACION', 'CONSTRUCCION'];

interface Formulario {
  /** RN-AL-01: datos obligatorios del alta. */
  nombre_cliente: string;
  contacto_cliente: string;
  telefono: string;
  direccion: string;
  tipo_reporte: TipoActividadEspecial;
  tipo_problema: string;
  informacion: string;
  problema_reporte: string;
  fecha_reporte: string;
  /** D-145: personal externo que reporta (cascada unidad → nombre → número). */
  unidad: string;
  nombre_solicitante: string;
  id_solicitante: number | null;
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
    contacto_cliente: '',
    telefono: '',
    direccion: '',
    tipo_reporte: 'REPARACION',
    tipo_problema: '',
    informacion: '',
    problema_reporte: '',
    fecha_reporte: ahoraLocal(),
    unidad: '',
    nombre_solicitante: '',
    id_solicitante: null,
  };
}

interface Resultado {
  id_caso: number | null;
  id_averia: string | null;
}

interface Props {
  onCerrar: () => void;
}

export default function ModalCaso({ onCerrar }: Props) {
  const [form, setForm] = useState<Formulario>(formularioVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
  const cajaRef = useRef<HTMLDivElement>(null);

  // Catálogo de personal externo para la cascada de solicitantes (D-145).
  useEffect(() => {
    let vivo = true;
    api
      .listarSolicitantes()
      .then((lista) => vivo && setSolicitantes(lista))
      .catch(() => vivo && setSolicitantes([]));
    return () => {
      vivo = false;
    };
  }, []);

  /** Unidades del catálogo, ordenadas y sin repetir. */
  const unidades = useMemo(
    () => Array.from(new Set(solicitantes.map((s) => s.unidad.trim()))).filter(Boolean).sort(),
    [solicitantes],
  );

  /** Nombres de la unidad elegida. */
  const nombres = useMemo(() => {
    if (!form.unidad) return [];
    return Array.from(
      new Set(
        solicitantes
          .filter((s) => s.unidad.trim() === form.unidad)
          .map((s) => s.nombre.trim()),
      ),
    )
      .filter(Boolean)
      .sort();
  }, [solicitantes, form.unidad]);

  /** Números (contactos) del nombre elegido dentro de la unidad. */
  const numeros = useMemo(() => {
    if (!form.unidad || !form.nombre_solicitante) return [];
    return solicitantes.filter(
      (s) => s.unidad.trim() === form.unidad && s.nombre.trim() === form.nombre_solicitante,
    );
  }, [solicitantes, form.unidad, form.nombre_solicitante]);

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

    const nombreCliente = form.nombre_cliente.trim();
    const contactoCliente = form.contacto_cliente.trim();
    const telefonoPago = form.telefono.trim();
    const direccion = form.direccion.trim();
    const tipoProblema = form.tipo_problema.trim();

    if (!nombreCliente || !contactoCliente || !telefonoPago || !direccion) {
      setError(
        'Complete los datos obligatorios: nombre y teléfono de contacto, dirección ' +
          'del inmueble y teléfono con el identificador de pago (70*).',
      );
      return;
    }
    if (form.tipo_reporte === 'REPARACION' && !tipoProblema) {
      setError('En un reporte de REPARACIÓN es obligatorio el tipo de problema.');
      return;
    }
    if (form.id_solicitante === null) {
      setError(
        'Seleccione el solicitante del personal externo: unidad, nombre y número.',
      );
      return;
    }

    const payload: CasoManualCreate = {
      tipo_reporte: form.tipo_reporte,
      // D-145: toda la ingesta manual es un referido.
      categoria: 'REFERIDO',
      // D-145: el servidor genera el ID (`REF-REP-…` / `REF-CONS-…`).
      nombre_cliente: nombreCliente,
      contacto_cliente: contactoCliente,
      id_pago: telefonoPago,
      direccion,
      tipo_problema: tipoProblema || null,
      informacion: nv(form.informacion),
      problema_reporte: nv(form.problema_reporte),
      fecha_reporte: form.fecha_reporte ? form.fecha_reporte : null,
      id_solicitante: form.id_solicitante,
    };
    setGuardando(true);
    try {
      const creado = await api.crearCaso(payload);
      setResultado({ id_caso: creado.id_caso, id_averia: creado.id_averia });
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

        <div className="modal-cuerpo">
          {resultado ? (
            <div className="modal-resultado">
              <Mensaje tipo="ok" texto="Registro creado correctamente." />
              <p>
                ID de avería:{' '}
                <strong
                  className={resultado.id_averia?.startsWith('REF-') ? 'mono id-ref' : 'mono'}
                >
                  {resultado.id_averia ?? '—'}
                </strong>
              </p>
              <p className="texto-pequeno">
                El caso quedó registrado como <strong>REFERIDO</strong>. Para empresas,
                gobierno o el seguimiento del referido use la sección{' '}
                <strong>Especiales</strong>.
              </p>
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

              <div className="aviso aviso-info campo-ancho">
                <span>
                  El <strong>ID de avería se genera automáticamente</strong> con el formato{' '}
                  <span className="mono">REF-REP-######</span> (reparación) o{' '}
                  <span className="mono">REF-CONS-######</span> (construcción). Todos los
                  casos de ingesta manual quedan como <strong>REFERIDO</strong>.
                </span>
              </div>

              <div className="campo campo-ancho">
                <label htmlFor="nc-nombre">Nombre de contacto *</label>
                <input
                  id="nc-nombre"
                  required
                  value={form.nombre_cliente}
                  onChange={(e) => setForm({ ...form, nombre_cliente: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="nc-contacto">Teléfono de contacto *</label>
                <input
                  id="nc-contacto"
                  required
                  type="tel"
                  value={form.contacto_cliente}
                  onChange={(e) => setForm({ ...form, contacto_cliente: e.target.value })}
                  placeholder="04142223344"
                />
              </div>
              <div className="campo">
                <label htmlFor="nc-telefono">Teléfono — identificador de pago (70*) *</label>
                <input
                  id="nc-telefono"
                  required
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="7014000848"
                />
              </div>
              <div className="campo">
                <label htmlFor="nc-reporte">Tipo de reporte *</label>
                <select
                  id="nc-reporte"
                  value={form.tipo_reporte}
                  onChange={(e) =>
                    setForm({ ...form, tipo_reporte: e.target.value as TipoActividadEspecial })
                  }
                >
                  {TIPOS_REPORTE.map((t) => (
                    <option key={t} value={t}>
                      {t === 'REPARACION' ? 'Reparación' : 'Construcción'}
                    </option>
                  ))}
                </select>
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
                <label htmlFor="nc-direccion">Dirección del inmueble *</label>
                <input
                  id="nc-direccion"
                  required
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                />
              </div>
              {form.tipo_reporte === 'REPARACION' && (
                <div className="campo">
                  <label htmlFor="nc-tipo-problema">Tipo de problema *</label>
                  <input
                    id="nc-tipo-problema"
                    required
                    maxLength={20}
                    value={form.tipo_problema}
                    onChange={(e) => setForm({ ...form, tipo_problema: e.target.value })}
                  />
                </div>
              )}
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

              {/* D-145: solicitante del catálogo de personal externo, en cascada. */}
              <div className="subpanel campo-ancho bloque-especial">
                <h3 className="subtitulo-seccion">Solicitante (personal externo) *</h3>
                <div className="formulario">
                  <div className="campo">
                    <label htmlFor="nc-sol-unidad">Unidad que solicita *</label>
                    <select
                      id="nc-sol-unidad"
                      required
                      value={form.unidad}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          unidad: e.target.value,
                          nombre_solicitante: '',
                          id_solicitante: null,
                        })
                      }
                    >
                      <option value="">— Seleccione la unidad —</option>
                      {unidades.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    {unidades.length === 0 && (
                      <p className="texto-pequeno">
                        No hay personal externo cargado. Regístrelo en{' '}
                        <strong>Técnicos → Personal externo</strong>.
                      </p>
                    )}
                  </div>
                  <div className="campo">
                    <label htmlFor="nc-sol-nombre">Nombre del solicitante *</label>
                    <select
                      id="nc-sol-nombre"
                      required
                      value={form.nombre_solicitante}
                      disabled={!form.unidad}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          nombre_solicitante: e.target.value,
                          id_solicitante: null,
                        })
                      }
                    >
                      <option value="">— Seleccione el nombre —</option>
                      {nombres.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor="nc-sol-numero">Número del solicitante *</label>
                    <select
                      id="nc-sol-numero"
                      required
                      value={form.id_solicitante ?? ''}
                      disabled={!form.nombre_solicitante}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          id_solicitante: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">— Seleccione el número —</option>
                      {numeros.map((s) => (
                        <option key={s.id_solicitante} value={s.id_solicitante}>
                          {s.contacto}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

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
    </div>
  );
}
