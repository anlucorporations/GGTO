/**
 * Catálogo de PERSONAL EXTERNO (D-99 · RF-63).
 *
 * Reúne a los dos colectivos que la plataforma necesita fuera de la plantilla
 * propia:
 *
 *  - SOLICITANTE : quien refiere un caso (empresa, gobierno, otro).
 *  - CRASS       : personal que valida la reparación al cerrar una masiva.
 *
 * Es la fuente del desplegable «validador del CRASS» de la ficha de MASIVAS:
 * por eso se expone también como pestaña de la página y avisa al padre con
 * `onCambio` cuando el catálogo se modifica.
 *
 * En la API el teléfono viaja en el campo `contacto`; en la interfaz se
 * etiqueta como «Teléfono» porque es el uso real del dato.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  PersonalExterno,
  PersonalExternoCreate,
  TipoPersonalExterno,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';

const TIPOS: TipoPersonalExterno[] = ['SOLICITANTE', 'CRASS', 'OTRO'];

const ETIQUETA_TIPO: Record<TipoPersonalExterno, string> = {
  SOLICITANTE: 'Solicitante',
  CRASS: 'CRASS',
  OTRO: 'Otro',
};

interface Filtros {
  tipo: string;
  q: string;
  solo_activos: boolean;
}

const FILTROS_VACIOS: Filtros = { tipo: '', q: '', solo_activos: false };

interface Props {
  /** Avisa al padre de que el catálogo cambió (p. ej. nuevos validadores). */
  onCambio?: () => void;
}

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function txt(valor: string | null | undefined): string {
  return valor === null || valor === undefined || valor === '' ? '—' : valor;
}

export default function CatalogoPersonalExterno({ onCambio }: Props) {
  const { soloLectura } = useAuth();

  const [borrador, setBorrador] = useState<Filtros>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VACIOS);
  const [items, setItems] = useState<PersonalExterno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  /** Registro en edición; `null` con el editor abierto significa alta nueva. */
  const [editorAbierto, setEditorAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<PersonalExterno | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(
        await api.listarPersonalExterno({
          tipo: aplicados.tipo === '' ? undefined : (aplicados.tipo as TipoPersonalExterno),
          q: aplicados.q.trim() === '' ? undefined : aplicados.q.trim(),
          solo_activos: aplicados.solo_activos ? true : undefined,
        }),
      );
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al listar el personal externo.'));
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
    setOk('');
    setError('');
  }

  async function guardar(datos: PersonalExternoCreate, id: number | null) {
    setOcupado(true);
    setError('');
    setOk('');
    try {
      if (id === null) {
        const creado = await api.crearPersonalExterno(datos);
        setOk(`Personal externo «${creado.nombre}» registrado.`);
      } else {
        const actualizado = await api.actualizarPersonalExterno(id, datos);
        setOk(`Personal externo «${actualizado.nombre}» actualizado.`);
      }
      setEditorAbierto(false);
      setEnEdicion(null);
      await cargar();
      onCambio?.();
    } catch (e) {
      setError(detalleDe(e, 'No se pudo guardar el personal externo.'));
    } finally {
      setOcupado(false);
    }
  }

  async function borrar(registro: PersonalExterno) {
    const confirmado = window.confirm(
      `¿Dar de baja a «${registro.nombre}» (${registro.unidad})? ` +
        'El registro dejará de aparecer como validador disponible.',
    );
    if (!confirmado) return;
    setOcupado(true);
    setError('');
    setOk('');
    try {
      await api.borrarPersonalExterno(registro.id_solicitante);
      setOk(`Personal externo «${registro.nombre}» dado de baja.`);
      await cargar();
      onCambio?.();
    } catch (e) {
      setError(detalleDe(e, 'No se pudo dar de baja al personal externo.'));
    } finally {
      setOcupado(false);
    }
  }

  async function reactivar(registro: PersonalExterno) {
    setOcupado(true);
    setError('');
    setOk('');
    try {
      await api.actualizarPersonalExterno(registro.id_solicitante, { activo: true });
      setOk(`Personal externo «${registro.nombre}» reactivado.`);
      await cargar();
      onCambio?.();
    } catch (e) {
      setError(detalleDe(e, 'No se pudo reactivar al personal externo.'));
    } finally {
      setOcupado(false);
    }
  }

  function abrirAlta() {
    setEnEdicion(null);
    setEditorAbierto(true);
    setError('');
  }

  function abrirEdicion(registro: PersonalExterno) {
    setEnEdicion(registro);
    setEditorAbierto(true);
    setError('');
  }

  const validadoresCrass = items.filter((i) => i.tipo === 'CRASS' && i.activo).length;

  return (
    <div className="masiva-panel">
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      <div className="masiva-nota">
        El personal externo alimenta dos usos: los <strong>solicitantes</strong> que
        refieren casos y el personal del <strong>CRASS</strong> que valida la reparación
        al cerrar una masiva. Solo los CRASS activos aparecen en el desplegable de
        validación. En este catálogo, «Teléfono» se guarda en el campo{' '}
        <span className="mono">contacto</span> de la API.
      </div>

      <div className="panel-bloque">
        <h2>Catálogo de personal externo</h2>

        <form className="formulario filtros-tabla" onSubmit={filtrar}>
          <div className="campo">
            <label htmlFor="pe-q">Búsqueda</label>
            <input
              id="pe-q"
              value={borrador.q}
              onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
              placeholder="Nombre, unidad, teléfono o documento…"
            />
          </div>
          <div className="campo">
            <label htmlFor="pe-tipo">Tipo</label>
            <select
              id="pe-tipo"
              value={borrador.tipo}
              onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value })}
            >
              <option value="">Todos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="campo campo-check">
            <input
              id="pe-activos"
              type="checkbox"
              checked={borrador.solo_activos}
              onChange={(e) => setBorrador({ ...borrador, solo_activos: e.target.checked })}
            />
            <label htmlFor="pe-activos">Solo activos</label>
          </div>
          <div className="acciones-form">
            <button className="btn" type="submit" disabled={cargando}>
              {cargando ? 'Filtrando…' : 'Filtrar'}
            </button>
            <button type="button" className="btn btn-secundario" onClick={limpiar}>
              Limpiar
            </button>
            {!soloLectura && (
              <button type="button" className="btn" onClick={abrirAlta}>
                Agregar personal externo
              </button>
            )}
          </div>
        </form>

        <p className="texto-pequeno">
          {cargando
            ? 'Cargando…'
            : `${items.length} registro(s) · ${validadoresCrass} validador(es) CRASS activo(s) en la vista actual`}
        </p>

        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="vacio">No hay personal externo que coincida con los filtros.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla-resumen">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Unidad</th>
                  <th>Teléfono</th>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id_solicitante}>
                    <td className="mono">{p.id_solicitante}</td>
                    <td>{p.nombre}</td>
                    <td>{p.unidad}</td>
                    <td className="mono">{txt(p.contacto)}</td>
                    <td className="mono">{txt(p.documento)}</td>
                    <td>
                      <span
                        className={`masiva-chip ${
                          p.tipo === 'CRASS' ? 'masiva-chip-info' : ''
                        }`}
                      >
                        {ETIQUETA_TIPO[p.tipo]}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`masiva-chip ${p.activo ? 'masiva-chip-ok' : 'masiva-chip-alerta'}`}
                      >
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="masiva-personal-acciones">
                        {!soloLectura && (
                          <button
                            type="button"
                            className="btn btn-mini btn-secundario"
                            onClick={() => abrirEdicion(p)}
                            disabled={ocupado}
                          >
                            Editar
                          </button>
                        )}
                        {!soloLectura && p.activo && (
                          <button
                            type="button"
                            className="btn btn-mini btn-peligro"
                            onClick={() => void borrar(p)}
                            disabled={ocupado}
                          >
                            Baja
                          </button>
                        )}
                        {!soloLectura && !p.activo && (
                          <button
                            type="button"
                            className="btn btn-mini"
                            onClick={() => void reactivar(p)}
                            disabled={ocupado}
                          >
                            Reactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <PieTabla
                colSpan={8}
                total={items.length}
                singular="registro"
                plural="registros"
                cargando={cargando}
              />
            </table>
          </div>
        )}
      </div>

      {editorAbierto && (
        <Modal
          titulo={enEdicion ? `Editar personal externo #${enEdicion.id_solicitante}` : 'Agregar personal externo'}
          onCerrar={() => {
            setEditorAbierto(false);
            setEnEdicion(null);
          }}
        >
          <FormularioPersonalExterno
            registro={enEdicion}
            guardando={ocupado}
            onCancelar={() => {
              setEditorAbierto(false);
              setEnEdicion(null);
            }}
            onGuardar={(datos) => void guardar(datos, enEdicion?.id_solicitante ?? null)}
          />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulario de alta y edición                                        */
/* ------------------------------------------------------------------ */

function FormularioPersonalExterno({
  registro,
  guardando,
  onCancelar,
  onGuardar,
}: {
  registro: PersonalExterno | null;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (datos: PersonalExternoCreate) => void;
}) {
  const [nombre, setNombre] = useState(registro?.nombre ?? '');
  const [unidad, setUnidad] = useState(registro?.unidad ?? '');
  const [contacto, setContacto] = useState(registro?.contacto ?? '');
  const [documento, setDocumento] = useState(registro?.documento ?? '');
  const [tipo, setTipo] = useState<TipoPersonalExterno>(registro?.tipo ?? 'SOLICITANTE');
  const [activo, setActivo] = useState(registro?.activo ?? true);
  const [error, setError] = useState('');

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (nombre.trim() === '' || unidad.trim() === '' || contacto.trim() === '') {
      setError('NOMBRE, UNIDAD y TELÉFONO son obligatorios.');
      return;
    }
    setError('');
    onGuardar({
      nombre: nombre.trim(),
      unidad: unidad.trim(),
      contacto: contacto.trim(),
      documento: documento.trim() === '' ? null : documento.trim(),
      tipo,
      activo,
    });
  }

  return (
    <form className="formulario modal-formulario masiva-form-personal" onSubmit={enviar}>
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />

      <div className="campo">
        <label htmlFor="pe-form-nombre">Nombre *</label>
        <input
          id="pe-form-nombre"
          required
          minLength={3}
          maxLength={120}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: José Pérez"
        />
      </div>
      <div className="campo">
        <label htmlFor="pe-form-unidad">Unidad *</label>
        <input
          id="pe-form-unidad"
          required
          minLength={2}
          maxLength={120}
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          placeholder="Ej.: CRASS Zona Centro"
        />
      </div>
      <div className="campo">
        <label htmlFor="pe-form-contacto">Teléfono *</label>
        <input
          id="pe-form-contacto"
          required
          type="tel"
          maxLength={40}
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="Ej.: 04140000000"
        />
      </div>
      <div className="campo">
        <label htmlFor="pe-form-documento">Documento</label>
        <input
          id="pe-form-documento"
          maxLength={40}
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          placeholder="Cédula o código interno (opcional)"
        />
      </div>
      <div className="campo">
        <label htmlFor="pe-form-tipo">Tipo</label>
        <select
          id="pe-form-tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoPersonalExterno)}
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="campo campo-check">
        <input
          id="pe-form-activo"
          type="checkbox"
          checked={activo}
          onChange={(e) => setActivo(e.target.checked)}
        />
        <label htmlFor="pe-form-activo">Activo</label>
      </div>

      <div className="acciones-form">
        <button type="submit" className="btn" disabled={guardando}>
          {guardando ? 'Guardando…' : registro ? 'Guardar cambios' : 'Agregar'}
        </button>
        <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
