import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  Central,
  RolAsignable,
  StatusTecnico,
  Tecnico,
  TecnicoCreate,
  TecnicoUpdate,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

const STATUS: StatusTecnico[] = ['ACTIVO', 'INACTIVO', 'VACACIONES', 'SUSPENDIDO'];

/** Roles asignables desde la ficha (el SUPER no se reparte). */
const ROLES_ASIGNABLES: { valor: RolAsignable; etiqueta: string }[] = [
  { valor: 'TECNICO', etiqueta: 'Técnico' },
  { valor: 'SUPERVISOR', etiqueta: 'Supervisor' },
  { valor: 'ADMIN', etiqueta: 'Administrador' },
];

/** Etiquetas y clases del ciclo de vida de la cuenta (D-67). */
const ETIQUETA_CUENTA: Record<string, string> = {
  ACTIVO: 'Activo',
  SIN_ALTA: 'Sin alta',
  BLOQUEADO: 'Bloqueado',
  REQUIERE_CAMBIO: 'Cambio de clave',
  INACTIVO: 'Inactivo',
};

const CLASE_CUENTA: Record<string, string> = {
  ACTIVO: 'estado-activo',
  SIN_ALTA: 'estado-sin-alta',
  BLOQUEADO: 'estado-bloqueado',
  REQUIERE_CAMBIO: 'estado-requiere-cambio',
  INACTIVO: 'estado-inactivo',
};

interface TecnicoForm {
  id_central: string;
  nombre: string;
  apellido: string;
  cedula: string;
  p00: string;
  telefono: string;
  correo: string;
  especialidad: string;
  status: StatusTecnico;
}

const FORM_VACIO: TecnicoForm = {
  id_central: '',
  nombre: '',
  apellido: '',
  cedula: '',
  p00: '',
  telefono: '',
  correo: '',
  especialidad: '',
  status: 'ACTIVO',
};

export default function Tecnicos() {
  const { soloLectura, usuario } = useAuth();
  const esSuper = usuario?.rol === 'SUPER';
  // Cambiar el rol de una cuenta: solo el Super Usuario y el Supervisor (D-68).
  const puedeCambiarRol = ['SUPER', 'SUPERVISOR'].includes(usuario?.rol ?? '');
  const [items, setItems] = useState<Tecnico[]>([]);
  const [centrales, setCentrales] = useState<Central[]>([]);
  const [filtroCentral, setFiltroCentral] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState<TecnicoForm>(FORM_VACIO);
  const [editando, setEditando] = useState<Tecnico | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [rolSeleccionado, setRolSeleccionado] = useState<RolAsignable | ''>('');

  // Recuperación de seguridad: el Super Usuario regenera las 12 palabras (D-67).
  const [palabrasP00, setPalabrasP00] = useState<string | null>(null);
  const [palabrasNuevas, setPalabrasNuevas] = useState<string[] | null>(null);
  const [errorPalabras, setErrorPalabras] = useState('');
  const [regenerando, setRegenerando] = useState(false);

  async function regenerarPalabras(t: Tecnico) {
    if (
      !window.confirm(
        `¿Generar 12 palabras de seguridad NUEVAS para ${t.nombre} (${t.p00})?\n\n` +
          'Las anteriores dejarán de funcionar y las nuevas solo se muestran una vez.',
      )
    ) {
      return;
    }
    setErrorPalabras('');
    setPalabrasNuevas(null);
    setPalabrasP00(t.p00);
    setRegenerando(true);
    try {
      const respuesta = await api.regenerarPalabras(t.p00);
      setPalabrasNuevas(respuesta.palabras);
      setOk(`Palabras regeneradas para ${t.p00}.`);
    } catch (e) {
      setErrorPalabras(
        e instanceof api.ApiError ? e.message : 'No se pudieron regenerar las palabras.',
      );
    } finally {
      setRegenerando(false);
    }
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: { id_central?: number; status?: string } = {};
      if (filtroCentral) filtros.id_central = Number(filtroCentral);
      if (filtroStatus) filtros.status = filtroStatus;
      setItems(await api.listarTecnicos(filtros));
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al listar los técnicos.');
    } finally {
      setCargando(false);
    }
  }, [filtroCentral, filtroStatus]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    api
      .listarCentral(true)
      .then(setCentrales)
      .catch(() => setCentrales([]));
  }, []);

  function nombreCentral(id: number): string {
    const c = centrales.find((x) => x.id_central === id);
    return c ? `${c.codigo_central} — ${c.nombre_central}` : `#${id}`;
  }

  function limpiarFormulario() {
    setForm(FORM_VACIO);
    setEditando(null);
    setRolSeleccionado('');
  }

  function cerrarModal() {
    setModalAbierto(false);
    limpiarFormulario();
  }

  function nuevo() {
    limpiarFormulario();
    setOk('');
    setError('');
    setModalAbierto(true);
  }

  function editar(t: Tecnico) {
    setEditando(t);
    setForm({
      id_central: String(t.id_central),
      nombre: t.nombre,
      apellido: t.apellido ?? '',
      cedula: t.cedula ?? '',
      p00: t.p00,
      telefono: t.telefono ?? '',
      correo: t.correo ?? '',
      especialidad: t.especialidad ?? '',
      status: t.status,
    });
    // Rol actual de la cuenta ('' si aún no tiene cuenta de acceso).
    setRolSeleccionado(
      t.rol && t.rol !== 'SUPER' ? (t.rol as RolAsignable) : '',
    );
    setOk('');
    setError('');
    setModalAbierto(true);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    if (!form.id_central) {
      setError('Seleccione la central.');
      return;
    }
    if (!form.nombre.trim() || !form.p00.trim()) {
      setError('Indique nombre y P00 del técnico.');
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        const payload: TecnicoUpdate = {
          id_central: Number(form.id_central),
          nombre: form.nombre.trim(),
          apellido: nv(form.apellido),
          cedula: nv(form.cedula),
          telefono: nv(form.telefono),
          correo: nv(form.correo),
          especialidad: nv(form.especialidad),
          status: form.status,
        };
        await api.actualizarTecnico(editando.id_tecnico, payload);
        setOk('Técnico actualizado.');
        // Rol de la cuenta: solo SUPER/SUPERVISOR y si cambió (D-68).
        if (
          puedeCambiarRol &&
          rolSeleccionado &&
          rolSeleccionado !== editando.rol
        ) {
          await api.cambiarRolTecnico(editando.id_tecnico, rolSeleccionado);
          setOk(`Técnico actualizado y rol asignado: ${rolSeleccionado}.`);
        }
        cerrarModal();
      } else {
        const payload: TecnicoCreate = {
          id_central: Number(form.id_central),
          nombre: form.nombre.trim(),
          apellido: nv(form.apellido),
          cedula: nv(form.cedula),
          p00: form.p00.trim(),
          telefono: nv(form.telefono),
          correo: nv(form.correo),
          especialidad: nv(form.especialidad),
          status: form.status,
        };
        await api.crearTecnico(payload);
        setOk('Técnico creado.');
        cerrarModal();
      }
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al guardar el técnico.');
    } finally {
      setGuardando(false);
    }
  }

  async function desactivar(t: Tecnico) {
    if (!window.confirm(`¿Desactivar al técnico ${t.nombre} (${t.p00})?`)) return;
    setError('');
    setOk('');
    try {
      await api.desactivarTecnico(t.id_tecnico);
      setOk('Técnico desactivado.');
      if (editando?.id_tecnico === t.id_tecnico) cerrarModal();
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al desactivar el técnico.');
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Técnicos</h1>
          <p>Personal técnico asignado a cada central.</p>
        </div>
        {!soloLectura && (
          <button className="btn" type="button" onClick={nuevo}>
            Nuevo técnico
          </button>
        )}
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {!soloLectura && modalAbierto && (
        <Modal
          titulo={editando ? `Editar técnico #${editando.id_tecnico}` : 'Nuevo técnico'}
          onCerrar={cerrarModal}
        >
          <form className="formulario modal-formulario" onSubmit={enviar}>
            <div className="campo">
              <label htmlFor="tecnico-central">Central *</label>
              <select
                id="tecnico-central"
                value={form.id_central}
                onChange={(e) => setForm({ ...form, id_central: e.target.value })}
              >
                <option value="">— Seleccione —</option>
                {centrales.map((c) => (
                  <option key={c.id_central} value={c.id_central}>
                    {c.codigo_central} — {c.nombre_central}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="tecnico-nombre">Nombre *</label>
              <input
                id="tecnico-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="tecnico-apellido">Apellido</label>
              <input
                id="tecnico-apellido"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="tecnico-cedula">Cédula</label>
              <input
                id="tecnico-cedula"
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="tecnico-p00">P00 *</label>
              <input
                id="tecnico-p00"
                value={form.p00}
                disabled={Boolean(editando)}
                onChange={(e) => setForm({ ...form, p00: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="tecnico-telefono">Teléfono</label>
              <input
                id="tecnico-telefono"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="tecnico-correo">Correo</label>
              <input
                id="tecnico-correo"
                type="email"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="tecnico-especialidad">Especialidad</label>
              <input
                id="tecnico-especialidad"
                value={form.especialidad}
                onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="tecnico-status">Status</label>
              <select
                id="tecnico-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StatusTecnico })}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {/* Rol de la cuenta de acceso: solo SUPER y SUPERVISOR (D-68) */}
            {editando && puedeCambiarRol && (
              <div className="campo">
                <label htmlFor="tecnico-rol">Rol de acceso</label>
                <select
                  id="tecnico-rol"
                  value={rolSeleccionado}
                  onChange={(e) =>
                    setRolSeleccionado(e.target.value ? (e.target.value as RolAsignable) : '')
                  }
                  disabled={editando.rol === 'SUPER'}
                >
                  <option value="">
                    {editando.rol === 'SUPER' ? 'Super Usuario (no modificable)' : 'Sin cambiar'}
                  </option>
                  {ROLES_ASIGNABLES.map((r) => (
                    <option key={r.valor} value={r.valor}>
                      {r.etiqueta} ({r.valor})
                    </option>
                  ))}
                </select>
                <span className="texto-pequeno">
                  {editando.rol
                    ? `Rol actual: ${editando.rol}.`
                    : 'El técnico aún no tiene cuenta; al asignar un rol se pre-registra y él fijará su clave en el primer acceso.'}
                </span>
              </div>
            )}
            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear técnico'}
              </button>
              {editando && (
                <button type="button" className="btn btn-secundario" onClick={cerrarModal}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}

      <div className="fila-filtros">
        <div className="campo">
          <label htmlFor="tecnico-filtro-central">Central</label>
          <select id="tecnico-filtro-central" value={filtroCentral} onChange={(e) => setFiltroCentral(e.target.value)}>
            <option value="">Todas</option>
            {centrales.map((c) => (
              <option key={c.id_central} value={c.id_central}>
                {c.codigo_central} — {c.nombre_central}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="tecnico-filtro-status">Status</label>
          <select id="tecnico-filtro-status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="tabla-envoltura">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Central</th>
              <th>Nombre</th>
              <th>P00</th>
              <th>Cédula</th>
              <th>Teléfono</th>
              <th>Especialidad</th>
              <th>Status</th>
              <th>Cuenta</th>
              {!soloLectura && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={soloLectura ? 9 : 10} className="vacio">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={soloLectura ? 9 : 10} className="vacio">
                  No hay técnicos registrados.
                </td>
              </tr>
            ) : (
              items.map((t) => (
                <tr key={t.id_tecnico}>
                  <td>{t.id_tecnico}</td>
                  <td>{nombreCentral(t.id_central)}</td>
                  <td>{[t.nombre, t.apellido].filter(Boolean).join(' ')}</td>
                  <td className="mono">{t.p00}</td>
                  <td>{t.cedula ?? '—'}</td>
                  <td>{t.telefono ?? '—'}</td>
                  <td>{t.especialidad ?? '—'}</td>
                  <td>{t.status}</td>
                  <td>
                    <span
                      className={`estado-cuenta ${CLASE_CUENTA[t.estado_cuenta ?? 'SIN_ALTA'] ?? ''}`}
                      title="Estado de la cuenta de acceso"
                    >
                      {ETIQUETA_CUENTA[t.estado_cuenta ?? 'SIN_ALTA'] ?? t.estado_cuenta}
                    </span>
                    {/* Rol efectivo de la cuenta (D-68) */}
                    {t.rol && <div className="texto-pequeno">{t.rol}</div>}
                  </td>
                  {!soloLectura && (
                    <td>
                      <div className="celda-acciones">
                        <button className="btn btn-mini btn-secundario" onClick={() => editar(t)}>
                          Editar
                        </button>
                        {esSuper && (
                          <button
                            className="btn btn-mini btn-secundario"
                            title="Generar 12 palabras de seguridad nuevas (solo Super Usuario)"
                            onClick={() => void regenerarPalabras(t)}
                            disabled={regenerando}
                          >
                            Palabras
                          </button>
                        )}
                        <button className="btn btn-mini btn-peligro" onClick={() => desactivar(t)}>
                          Desactivar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          <PieTabla
            colSpan={soloLectura ? 9 : 10}
            total={items.length}
            singular="técnico"
            plural="técnicos"
            cargando={cargando}
          />
        </table>
      </div>

      {/* Recuperación de seguridad: palabras nuevas (una sola vez) — solo SUPER */}
      {palabrasP00 && (
        <Modal
          titulo={`Palabras de seguridad de ${palabrasP00}`}
          onCerrar={() => {
            setPalabrasP00(null);
            setPalabrasNuevas(null);
            setErrorPalabras('');
          }}
        >
          <Mensaje tipo="error" texto={errorPalabras} onCerrar={() => setErrorPalabras('')} />
          {regenerando && <p className="texto-pequeno">Generando…</p>}
          {palabrasNuevas && (
            <>
              <p className="texto-pequeno">
                Entregue estas <strong>12 palabras</strong> al técnico por un canal seguro. No se
                volverán a mostrar y las anteriores dejan de funcionar. Con 3 de ellas podrá
                desbloquear la cuenta o restablecer su clave.
              </p>
              <ol className="lista-palabras">
                {palabrasNuevas.map((palabra, indice) => (
                  <li key={indice}>
                    <span className="mono">{palabra}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          <div className="acciones-form">
            <button
              className="btn"
              type="button"
              onClick={() => {
                setPalabrasP00(null);
                setPalabrasNuevas(null);
              }}
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
