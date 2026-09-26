import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  Central,
  Sector,
  SectorCreate,
  SectorDireccionCreate,
  SectorUpdate,
  TipoCoincidencia,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

interface DireccionForm {
  patron: string;
  tipo_coincidencia: TipoCoincidencia;
  normalizar: boolean;
  activo: boolean;
}

interface SectorForm {
  id_central: string;
  nombre: string;
  codigo: string;
  descripcion: string;
  prioridad: string;
  activo: boolean;
}

const DIR_VACIA: DireccionForm = {
  patron: '',
  tipo_coincidencia: 'CONTIENE',
  normalizar: true,
  activo: true,
};

const FORM_VACIO: SectorForm = {
  id_central: '',
  nombre: '',
  codigo: '',
  descripcion: '',
  prioridad: '100',
  activo: true,
};

const TIPOS: TipoCoincidencia[] = ['CONTIENE', 'EXACTO', 'REGEX'];

export default function Sectores() {
  const { soloLectura } = useAuth();
  const [items, setItems] = useState<Sector[]>([]);
  const [centrales, setCentrales] = useState<Central[]>([]);
  const [filtroCentral, setFiltroCentral] = useState('');
  const [soloActivos, setSoloActivos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState<SectorForm>(FORM_VACIO);
  const [direcciones, setDirecciones] = useState<DireccionForm[]>([]);
  const [editando, setEditando] = useState<Sector | null>(null);
  const [dirNueva, setDirNueva] = useState<DireccionForm>(DIR_VACIA);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: { id_central?: number; solo_activos?: boolean } = { solo_activos: soloActivos };
      if (filtroCentral) filtros.id_central = Number(filtroCentral);
      setItems(await api.listarSectores(filtros));
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al listar los sectores.');
    } finally {
      setCargando(false);
    }
  }, [filtroCentral, soloActivos]);

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
    setDirecciones([]);
    setDirNueva(DIR_VACIA);
    setEditando(null);
  }

  function editar(s: Sector) {
    setEditando(s);
    setForm({
      id_central: String(s.id_central),
      nombre: s.nombre,
      codigo: s.codigo,
      descripcion: s.descripcion ?? '',
      prioridad: String(s.prioridad),
      activo: s.activo,
    });
    setDirecciones([]);
    setOk('');
    setError('');
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    if (!form.id_central) {
      setError('Seleccione la central.');
      return;
    }
    if (!form.nombre.trim() || !form.codigo.trim()) {
      setError('Indique nombre y código del sector.');
      return;
    }
    const prioridad = Number(form.prioridad);
    if (!Number.isFinite(prioridad) || prioridad < 1 || prioridad > 999) {
      setError('La prioridad debe ser un número entre 1 y 999.');
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        const payload: SectorUpdate = {
          nombre: form.nombre.trim(),
          codigo: form.codigo.trim(),
          descripcion: nv(form.descripcion),
          prioridad,
          activo: form.activo,
        };
        await api.actualizarSector(editando.id_sector, payload);
        const actualizado = await api.obtenerSector(editando.id_sector);
        setEditando(actualizado);
        setOk('Sector actualizado.');
      } else {
        const payload: SectorCreate = {
          id_central: Number(form.id_central),
          nombre: form.nombre.trim(),
          codigo: form.codigo.trim(),
          descripcion: nv(form.descripcion),
          prioridad,
          activo: form.activo,
          direcciones: direcciones
            .filter((d) => d.patron.trim() !== '')
            .map((d) => ({
              patron: d.patron.trim(),
              tipo_coincidencia: d.tipo_coincidencia,
              normalizar: d.normalizar,
              activo: d.activo,
            })),
        };
        await api.crearSector(payload);
        setOk('Sector creado.');
        limpiarFormulario();
      }
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al guardar el sector.');
    } finally {
      setGuardando(false);
    }
  }

  async function desactivar(s: Sector) {
    if (!window.confirm(`¿Desactivar el sector ${s.codigo} — ${s.nombre}?`)) return;
    setError('');
    setOk('');
    try {
      await api.desactivarSector(s.id_sector);
      setOk('Sector desactivado.');
      if (editando?.id_sector === s.id_sector) limpiarFormulario();
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al desactivar el sector.');
    }
  }

  function actualizarDireccion(indice: number, cambios: Partial<DireccionForm>) {
    setDirecciones((actual) =>
      actual.map((d, i) => (i === indice ? { ...d, ...cambios } : d)),
    );
  }

  async function agregarDireccionExistente(evento: FormEvent) {
    evento.preventDefault();
    if (!editando) return;
    if (!dirNueva.patron.trim()) {
      setError('Indique el patrón de la dirección.');
      return;
    }
    setError('');
    setOk('');
    try {
      const payload: SectorDireccionCreate = {
        patron: dirNueva.patron.trim(),
        tipo_coincidencia: dirNueva.tipo_coincidencia,
        normalizar: dirNueva.normalizar,
        activo: dirNueva.activo,
      };
      await api.agregarDireccionSector(editando.id_sector, payload);
      setDirNueva(DIR_VACIA);
      const actualizado = await api.obtenerSector(editando.id_sector);
      setEditando(actualizado);
      setOk('Dirección agregada.');
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al agregar la dirección.');
    }
  }

  async function quitarDireccion(idDireccion: number) {
    if (!editando) return;
    if (!window.confirm('¿Quitar esta dirección del sector?')) return;
    setError('');
    setOk('');
    try {
      await api.eliminarDireccionSector(editando.id_sector, idDireccion);
      const actualizado = await api.obtenerSector(editando.id_sector);
      setEditando(actualizado);
      setOk('Dirección eliminada.');
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al eliminar la dirección.');
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Sectores</h1>
          <p>Sectores de atención con sus patrones de dirección por central.</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {!soloLectura && (
        <div className="panel-bloque">
          <h2>{editando ? `Editar sector #${editando.id_sector}` : 'Nuevo sector'}</h2>
          <form className="formulario" onSubmit={enviar}>
            <div className="campo">
              <label>Central *</label>
              <select
                value={form.id_central}
                disabled={Boolean(editando)}
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
              <label>Nombre *</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Código *</label>
              <input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Prioridad (1–999)</label>
              <input
                type="number"
                min={1}
                max={999}
                value={form.prioridad}
                onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
              />
            </div>
            <div className="campo campo-ancho">
              <label>Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
            <div className="campo campo-check">
              <input
                id="sector-activo"
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              <label htmlFor="sector-activo">Activo</label>
            </div>
            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear sector'}
              </button>
              {editando && (
                <button type="button" className="btn btn-secundario" onClick={limpiarFormulario}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {!editando && (
            <div className="subpanel">
              <h3 className="texto-pequeno">Direcciones / patrones a incluir</h3>
              {direcciones.length === 0 && (
                <p className="texto-pequeno">Sin direcciones. Puede agregar varias.</p>
              )}
              {direcciones.map((d, i) => (
                <div className="fila-integrante" key={i}>
                  <input
                    placeholder="Patrón (ej. AV. BOLÍVAR)"
                    value={d.patron}
                    onChange={(e) => actualizarDireccion(i, { patron: e.target.value })}
                  />
                  <select
                    value={d.tipo_coincidencia}
                    onChange={(e) =>
                      actualizarDireccion(i, {
                        tipo_coincidencia: e.target.value as TipoCoincidencia,
                      })
                    }
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-mini btn-peligro"
                    onClick={() => setDirecciones((actual) => actual.filter((_, j) => j !== i))}
                  >
                    Quitar
                  </button>
                  <div className="campo-check" style={{ gridColumn: '1 / -1' }}>
                    <input
                      id={`dir-normalizar-${i}`}
                      type="checkbox"
                      checked={d.normalizar}
                      onChange={(e) => actualizarDireccion(i, { normalizar: e.target.checked })}
                    />
                    <label htmlFor={`dir-normalizar-${i}`}>Normalizar</label>
                    <input
                      id={`dir-activo-${i}`}
                      type="checkbox"
                      checked={d.activo}
                      onChange={(e) => actualizarDireccion(i, { activo: e.target.checked })}
                    />
                    <label htmlFor={`dir-activo-${i}`}>Activa</label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secundario btn-mini"
                onClick={() => setDirecciones((actual) => [...actual, { ...DIR_VACIA }])}
              >
                + Añadir dirección
              </button>
            </div>
          )}

          {editando && (
            <div className="subpanel">
              <h3 className="texto-pequeno">Direcciones del sector #{editando.id_sector}</h3>
              <ul className="lista-integrantes">
                {editando.direcciones.length === 0 && <li>Sin direcciones.</li>}
                {editando.direcciones.map((d) => (
                  <li key={d.id_sector_direccion}>
                    <span className="mono">
                      {d.patron} · {d.tipo_coincidencia} · {d.normalizar ? 'normaliza' : 'literal'} ·{' '}
                      {d.activo ? 'activa' : 'inactiva'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-mini btn-peligro"
                      onClick={() => quitarDireccion(d.id_sector_direccion)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
              <form className="fila-integrante" onSubmit={agregarDireccionExistente}>
                <input
                  placeholder="Nuevo patrón"
                  value={dirNueva.patron}
                  onChange={(e) => setDirNueva({ ...dirNueva, patron: e.target.value })}
                />
                <select
                  value={dirNueva.tipo_coincidencia}
                  onChange={(e) =>
                    setDirNueva({
                      ...dirNueva,
                      tipo_coincidencia: e.target.value as TipoCoincidencia,
                    })
                  }
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button className="btn btn-mini" type="submit">
                  Añadir
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      <div className="fila-filtros">
        <div className="campo">
          <label>Central</label>
          <select value={filtroCentral} onChange={(e) => setFiltroCentral(e.target.value)}>
            <option value="">Todas</option>
            {centrales.map((c) => (
              <option key={c.id_central} value={c.id_central}>
                {c.codigo_central} — {c.nombre_central}
              </option>
            ))}
          </select>
        </div>
        <div className="campo campo-check">
          <input
            id="solo-activos-sector"
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          <label htmlFor="solo-activos-sector">Solo activos</label>
        </div>
      </div>

      <div className="tabla-envoltura">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Central</th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Prioridad</th>
              <th>Direcciones</th>
              <th>Activo</th>
              {!soloLectura && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={soloLectura ? 7 : 8} className="vacio">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={soloLectura ? 7 : 8} className="vacio">
                  No hay sectores registrados.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id_sector}>
                  <td>{s.id_sector}</td>
                  <td>{nombreCentral(s.id_central)}</td>
                  <td>{s.codigo}</td>
                  <td>{s.nombre}</td>
                  <td>{s.prioridad}</td>
                  <td>{s.direcciones.length}</td>
                  <td>{s.activo ? 'Sí' : 'No'}</td>
                  {!soloLectura && (
                    <td>
                      <div className="celda-acciones">
                        <button className="btn btn-mini btn-secundario" onClick={() => editar(s)}>
                          Editar
                        </button>
                        <button className="btn btn-mini btn-peligro" onClick={() => desactivar(s)}>
                          Desactivar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
