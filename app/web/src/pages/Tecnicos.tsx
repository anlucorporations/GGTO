import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type { Central, StatusTecnico, Tecnico, TecnicoCreate, TecnicoUpdate } from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

const STATUS: StatusTecnico[] = ['ACTIVO', 'INACTIVO', 'VACACIONES', 'SUSPENDIDO'];

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
  const { soloLectura } = useAuth();
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
              {!soloLectura && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={soloLectura ? 8 : 9} className="vacio">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={soloLectura ? 8 : 9} className="vacio">
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
                  {!soloLectura && (
                    <td>
                      <div className="celda-acciones">
                        <button className="btn btn-mini btn-secundario" onClick={() => editar(t)}>
                          Editar
                        </button>
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
            colSpan={soloLectura ? 8 : 9}
            total={items.length}
            singular="técnico"
            plural="técnicos"
            cargando={cargando}
          />
        </table>
      </div>
    </>
  );
}
