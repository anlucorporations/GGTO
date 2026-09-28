import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type { Central, CentralCreate } from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

interface CentralForm {
  region: string;
  estado_geografico: string;
  capital_estado: string;
  municipio: string;
  parroquia: string;
  estado_operativo: string;
  distrito: string;
  area: string;
  codigo_central: string;
  nombre_central: string;
  activa: boolean;
}

const FORM_VACIO: CentralForm = {
  region: '',
  estado_geografico: '',
  capital_estado: '',
  municipio: '',
  parroquia: '',
  estado_operativo: '',
  distrito: '',
  area: '',
  codigo_central: '',
  nombre_central: '',
  activa: true,
};

function aFormulario(c: Central): CentralForm {
  return {
    region: c.region,
    estado_geografico: c.estado_geografico,
    capital_estado: c.capital_estado ?? '',
    municipio: c.municipio,
    parroquia: c.parroquia,
    estado_operativo: c.estado_operativo ?? '',
    distrito: c.distrito ?? '',
    area: c.area,
    codigo_central: c.codigo_central,
    nombre_central: c.nombre_central,
    activa: c.activa,
  };
}

export default function Centrales() {
  const { soloLectura } = useAuth();
  const [items, setItems] = useState<Central[]>([]);
  const [soloActivas, setSoloActivas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState<CentralForm>(FORM_VACIO);
  const [editando, setEditando] = useState<Central | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await api.listarCentral(soloActivas));
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al listar las centrales.');
    } finally {
      setCargando(false);
    }
  }, [soloActivas]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function limpiarFormulario() {
    setForm(FORM_VACIO);
    setEditando(null);
  }

  function cerrarModal() {
    setModalAbierto(false);
    limpiarFormulario();
  }

  function nueva() {
    limpiarFormulario();
    setOk('');
    setError('');
    setModalAbierto(true);
  }

  function editar(c: Central) {
    setEditando(c);
    setForm(aFormulario(c));
    setOk('');
    setError('');
    setModalAbierto(true);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    const payload: CentralCreate = {
      region: form.region.trim(),
      estado_geografico: form.estado_geografico.trim(),
      capital_estado: nv(form.capital_estado),
      municipio: form.municipio.trim(),
      parroquia: form.parroquia.trim(),
      estado_operativo: nv(form.estado_operativo),
      distrito: nv(form.distrito),
      area: form.area.trim(),
      codigo_central: form.codigo_central.trim(),
      nombre_central: form.nombre_central.trim(),
      activa: form.activa,
    };
    if (
      !payload.region ||
      !payload.estado_geografico ||
      !payload.municipio ||
      !payload.parroquia ||
      !payload.area ||
      !payload.codigo_central ||
      !payload.nombre_central
    ) {
      setError('Complete los campos obligatorios: región, estado, municipio, parroquia, área, código y nombre.');
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await api.actualizarCentral(editando.id_central, payload);
        setOk('Central actualizada.');
      } else {
        await api.crearCentral(payload);
        setOk('Central creada.');
      }
      cerrarModal();
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al guardar la central.');
    } finally {
      setGuardando(false);
    }
  }

  async function desactivar(c: Central) {
    if (!window.confirm(`¿Desactivar la central ${c.codigo_central} — ${c.nombre_central}?`)) return;
    setError('');
    setOk('');
    try {
      await api.desactivarCentral(c.id_central);
      setOk('Central desactivada.');
      if (editando?.id_central === c.id_central) cerrarModal();
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al desactivar la central.');
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Central</h1>
          <p>Registro de centrales telefónicas y su ubicación geográfica.</p>
        </div>
        {!soloLectura && (
          <button className="btn" type="button" onClick={nueva}>
            Nueva central
          </button>
        )}
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {!soloLectura && modalAbierto && (
        <Modal
          titulo={editando ? `Editar central #${editando.id_central}` : 'Nueva central'}
          onCerrar={cerrarModal}
        >
          <form className="formulario modal-formulario" onSubmit={enviar}>
            <div className="campo">
              <label htmlFor="central-region">Región *</label>
              <input id="central-region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="central-estado-geografico">Estado geográfico *</label>
              <input
                id="central-estado-geografico"
                value={form.estado_geografico}
                onChange={(e) => setForm({ ...form, estado_geografico: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="central-capital">Capital del estado</label>
              <input
                id="central-capital"
                value={form.capital_estado}
                onChange={(e) => setForm({ ...form, capital_estado: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="central-municipio">Municipio *</label>
              <input
                id="central-municipio"
                value={form.municipio}
                onChange={(e) => setForm({ ...form, municipio: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="central-parroquia">Parroquia *</label>
              <input
                id="central-parroquia"
                value={form.parroquia}
                onChange={(e) => setForm({ ...form, parroquia: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="central-estado-operativo">Estado operativo</label>
              <input
                id="central-estado-operativo"
                value={form.estado_operativo}
                onChange={(e) => setForm({ ...form, estado_operativo: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="central-distrito">Distrito</label>
              <input
                id="central-distrito"
                value={form.distrito}
                onChange={(e) => setForm({ ...form, distrito: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="central-area">Área *</label>
              <input id="central-area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="central-codigo">Código de central *</label>
              <input
                id="central-codigo"
                value={form.codigo_central}
                onChange={(e) => setForm({ ...form, codigo_central: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="central-nombre">Nombre de la central *</label>
              <input
                id="central-nombre"
                value={form.nombre_central}
                onChange={(e) => setForm({ ...form, nombre_central: e.target.value })}
              />
            </div>
            <div className="campo campo-check">
              <input
                id="central-activa"
                type="checkbox"
                checked={form.activa}
                onChange={(e) => setForm({ ...form, activa: e.target.checked })}
              />
              <label htmlFor="central-activa">Activa</label>
            </div>
            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear central'}
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
        <div className="campo campo-check">
          <input
            id="solo-activas-central"
            type="checkbox"
            checked={soloActivas}
            onChange={(e) => setSoloActivas(e.target.checked)}
          />
          <label htmlFor="solo-activas-central">Solo activas</label>
        </div>
      </div>

      <div className="tabla-envoltura">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Región</th>
              <th>Estado</th>
              <th>Municipio</th>
              <th>Parroquia</th>
              <th>Área</th>
              <th>Activa</th>
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
                  No hay centrales registradas.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id_central}>
                  <td>{c.id_central}</td>
                  <td>{c.codigo_central}</td>
                  <td>{c.nombre_central}</td>
                  <td>{c.region}</td>
                  <td>{c.estado_geografico}</td>
                  <td>{c.municipio}</td>
                  <td>{c.parroquia}</td>
                  <td>{c.area}</td>
                  <td>{c.activa ? 'Sí' : 'No'}</td>
                  {!soloLectura && (
                    <td>
                      <div className="celda-acciones">
                        <button className="btn btn-mini btn-secundario" onClick={() => editar(c)}>
                          Editar
                        </button>
                        <button className="btn btn-mini btn-peligro" onClick={() => desactivar(c)}>
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
            singular="central"
            plural="centrales"
            cargando={cargando}
          />
        </table>
      </div>
    </>
  );
}
