import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type { Central, Flota as FlotaEntidad, FlotaCreate, FlotaUpdate, StatusFlota } from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

const STATUS: StatusFlota[] = ['DISPONIBLE', 'EN_RUTA', 'MANTENIMIENTO', 'FUERA_SERVICIO'];

interface FlotaForm {
  id_central: string;
  can: string;
  tipo: string;
  marca: string;
  modelo: string;
  placa: string;
  combustible: string;
  status: StatusFlota;
  estado_cauchos: string;
  estado_fluidos: string;
  estado_general: string;
}

const FORM_VACIO: FlotaForm = {
  id_central: '',
  can: '',
  tipo: '',
  marca: '',
  modelo: '',
  placa: '',
  combustible: '',
  status: 'DISPONIBLE',
  estado_cauchos: '',
  estado_fluidos: '',
  estado_general: '',
};

export default function Flota() {
  const { soloLectura } = useAuth();
  const [items, setItems] = useState<FlotaEntidad[]>([]);
  const [centrales, setCentrales] = useState<Central[]>([]);
  const [filtroCentral, setFiltroCentral] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState<FlotaForm>(FORM_VACIO);
  const [editando, setEditando] = useState<FlotaEntidad | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: { id_central?: number } = {};
      if (filtroCentral) filtros.id_central = Number(filtroCentral);
      setItems(await api.listarFlota(filtros));
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al listar la flota.');
    } finally {
      setCargando(false);
    }
  }, [filtroCentral]);

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

  function editar(f: FlotaEntidad) {
    setEditando(f);
    setForm({
      id_central: String(f.id_central),
      can: f.can,
      tipo: f.tipo ?? '',
      marca: f.marca ?? '',
      modelo: f.modelo ?? '',
      placa: f.placa ?? '',
      combustible: f.combustible ?? '',
      status: f.status,
      estado_cauchos: f.estado_cauchos ?? '',
      estado_fluidos: f.estado_fluidos ?? '',
      estado_general: f.estado_general ?? '',
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
    if (!form.can.trim()) {
      setError('Indique el CAN del vehículo.');
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        const payload: FlotaUpdate = {
          id_central: Number(form.id_central),
          can: form.can.trim(),
          tipo: nv(form.tipo),
          marca: nv(form.marca),
          modelo: nv(form.modelo),
          placa: nv(form.placa),
          combustible: nv(form.combustible),
          status: form.status,
          estado_cauchos: nv(form.estado_cauchos),
          estado_fluidos: nv(form.estado_fluidos),
          estado_general: nv(form.estado_general),
        };
        await api.actualizarFlota(editando.id_flota, payload);
        setOk('Vehículo actualizado.');
      } else {
        const payload: FlotaCreate = {
          id_central: Number(form.id_central),
          can: form.can.trim(),
          tipo: nv(form.tipo),
          marca: nv(form.marca),
          modelo: nv(form.modelo),
          placa: nv(form.placa),
          combustible: nv(form.combustible),
          status: form.status,
          estado_cauchos: nv(form.estado_cauchos),
          estado_fluidos: nv(form.estado_fluidos),
          estado_general: nv(form.estado_general),
        };
        await api.crearFlota(payload);
        setOk('Vehículo creado.');
      }
      cerrarModal();
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al guardar el vehículo.');
    } finally {
      setGuardando(false);
    }
  }

  async function retirar(f: FlotaEntidad) {
    if (!window.confirm(`¿Pasar a FUERA_SERVICIO el vehículo CAN ${f.can}?`)) return;
    setError('');
    setOk('');
    try {
      await api.retirarFlota(f.id_flota);
      setOk('Vehículo fuera de servicio.');
      if (editando?.id_flota === f.id_flota) cerrarModal();
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al retirar el vehículo.');
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Flota</h1>
          <p>Vehículos disponibles por central y su estado operativo.</p>
        </div>
        {!soloLectura && (
          <button className="btn" type="button" onClick={nuevo}>
            Nuevo vehículo
          </button>
        )}
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {!soloLectura && modalAbierto && (
        <Modal
          titulo={editando ? `Editar vehículo #${editando.id_flota}` : 'Nuevo vehículo'}
          onCerrar={cerrarModal}
        >
          <form className="formulario modal-formulario" onSubmit={enviar}>
            <div className="campo">
              <label htmlFor="flota-central">Central *</label>
              <select
                id="flota-central"
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
              <label htmlFor="flota-can">CAN *</label>
              <input id="flota-can" value={form.can} onChange={(e) => setForm({ ...form, can: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="flota-tipo">Tipo</label>
              <input id="flota-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="flota-marca">Marca</label>
              <input
                id="flota-marca"
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="flota-modelo">Modelo</label>
              <input
                id="flota-modelo"
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="flota-placa">Placa</label>
              <input
                id="flota-placa"
                value={form.placa}
                onChange={(e) => setForm({ ...form, placa: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="flota-combustible">Combustible</label>
              <input
                id="flota-combustible"
                value={form.combustible}
                onChange={(e) => setForm({ ...form, combustible: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="flota-status">Status</label>
              <select
                id="flota-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StatusFlota })}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="flota-estado-cauchos">Estado cauchos</label>
              <input
                id="flota-estado-cauchos"
                value={form.estado_cauchos}
                onChange={(e) => setForm({ ...form, estado_cauchos: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="flota-estado-fluidos">Estado fluidos</label>
              <input
                id="flota-estado-fluidos"
                value={form.estado_fluidos}
                onChange={(e) => setForm({ ...form, estado_fluidos: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="flota-estado-general">Estado general</label>
              <input
                id="flota-estado-general"
                value={form.estado_general}
                onChange={(e) => setForm({ ...form, estado_general: e.target.value })}
              />
            </div>
            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear vehículo'}
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
          <label htmlFor="flota-filtro-central">Central</label>
          <select id="flota-filtro-central" value={filtroCentral} onChange={(e) => setFiltroCentral(e.target.value)}>
            <option value="">Todas</option>
            {centrales.map((c) => (
              <option key={c.id_central} value={c.id_central}>
                {c.codigo_central} — {c.nombre_central}
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
              <th>CAN</th>
              <th>Tipo</th>
              <th>Marca / Modelo</th>
              <th>Placa</th>
              <th>Combustible</th>
              <th>Status</th>
              <th>Estado general</th>
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
                  No hay vehículos registrados.
                </td>
              </tr>
            ) : (
              items.map((f) => (
                <tr key={f.id_flota}>
                  <td>{f.id_flota}</td>
                  <td>{nombreCentral(f.id_central)}</td>
                  <td className="mono">{f.can}</td>
                  <td>{f.tipo ?? '—'}</td>
                  <td>{[f.marca, f.modelo].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{f.placa ?? '—'}</td>
                  <td>{f.combustible ?? '—'}</td>
                  <td>{f.status}</td>
                  <td>{f.estado_general ?? '—'}</td>
                  {!soloLectura && (
                    <td>
                      <div className="celda-acciones">
                        <button className="btn btn-mini btn-secundario" onClick={() => editar(f)}>
                          Editar
                        </button>
                        <button className="btn btn-mini btn-peligro" onClick={() => retirar(f)}>
                          Fuera de servicio
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
            singular="vehículo"
            plural="vehículos"
            cargando={cargando}
          />
        </table>
      </div>
    </>
  );
}
