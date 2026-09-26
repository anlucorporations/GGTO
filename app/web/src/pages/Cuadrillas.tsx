import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  Central,
  Cuadrilla,
  CuadrillaCreate,
  CuadrillaUpdate,
  Flota,
  RolCuadrilla,
  Tecnico,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import { useAuth } from '../auth/AuthContext';
import { fecha } from '../utils';

const ROLES: RolCuadrilla[] = ['REPARADOR_PRINCIPAL', 'AYUDANTE', 'SUPERVISOR'];

interface IntegranteForm {
  id_tecnico: string;
  rol_cuadrilla: RolCuadrilla;
}

interface CuadrillaForm {
  id_central: string;
  codigo: string;
  nombre: string;
  id_flota: string;
  es_supervisor: boolean;
  activa: boolean;
}

const FORM_VACIO: CuadrillaForm = {
  id_central: '',
  codigo: '',
  nombre: '',
  id_flota: '',
  es_supervisor: false,
  activa: true,
};

export default function Cuadrillas() {
  const { soloLectura } = useAuth();
  const [items, setItems] = useState<Cuadrilla[]>([]);
  const [centrales, setCentrales] = useState<Central[]>([]);
  const [flotas, setFlotas] = useState<Flota[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [filtroCentral, setFiltroCentral] = useState('');
  const [soloActivas, setSoloActivas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState<CuadrillaForm>(FORM_VACIO);
  const [integrantes, setIntegrantes] = useState<IntegranteForm[]>([]);
  const [herramientasTexto, setHerramientasTexto] = useState('');
  const [editando, setEditando] = useState<Cuadrilla | null>(null);
  const [nuevoIntegrante, setNuevoIntegrante] = useState<IntegranteForm>({
    id_tecnico: '',
    rol_cuadrilla: 'REPARADOR_PRINCIPAL',
  });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: { id_central?: number; solo_activas?: boolean } = { solo_activas: soloActivas };
      if (filtroCentral) filtros.id_central = Number(filtroCentral);
      setItems(await api.listarCuadrillas(filtros));
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al listar las cuadrillas.');
    } finally {
      setCargando(false);
    }
  }, [filtroCentral, soloActivas]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    Promise.all([api.listarCentral(true), api.listarFlota(), api.listarTecnicos()])
      .then(([c, f, t]) => {
        setCentrales(c);
        setFlotas(f);
        setTecnicos(t);
      })
      .catch(() => {
        setCentrales([]);
      });
  }, []);

  function nombreCentral(id: number): string {
    const c = centrales.find((x) => x.id_central === id);
    return c ? `${c.codigo_central} — ${c.nombre_central}` : `#${id}`;
  }

  function nombreTecnico(id: number): string {
    const t = tecnicos.find((x) => x.id_tecnico === id);
    return t ? `${t.nombre} ${t.apellido ?? ''}`.trim() : `Técnico #${id}`;
  }

  function placaFlota(id: number | null): string {
    if (id === null) return '—';
    const f = flotas.find((x) => x.id_flota === id);
    return f ? `${f.can} (${f.placa ?? 'sin placa'})` : `#${id}`;
  }

  function limpiarFormulario() {
    setForm(FORM_VACIO);
    setIntegrantes([]);
    setHerramientasTexto('');
    setNuevoIntegrante({ id_tecnico: '', rol_cuadrilla: 'REPARADOR_PRINCIPAL' });
    setEditando(null);
  }

  function editar(c: Cuadrilla) {
    setEditando(c);
    setForm({
      id_central: String(c.id_central),
      codigo: c.codigo,
      nombre: c.nombre,
      id_flota: c.id_flota !== null ? String(c.id_flota) : '',
      es_supervisor: c.es_supervisor,
      activa: c.activa,
    });
    setIntegrantes([]);
    setHerramientasTexto('');
    setOk('');
    setError('');
  }

  const flotasDeCentral = flotas.filter(
    (f) => !form.id_central || f.id_central === Number(form.id_central),
  );
  const tecnicosDeCentral = tecnicos.filter(
    (t) => !form.id_central || t.id_central === Number(form.id_central),
  );

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    if (!form.id_central) {
      setError('Seleccione la central.');
      return;
    }
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setError('Indique código y nombre de la cuadrilla.');
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        const payload: CuadrillaUpdate = {
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          id_flota: form.id_flota ? Number(form.id_flota) : null,
          es_supervisor: form.es_supervisor,
          activa: form.activa,
        };
        await api.actualizarCuadrilla(editando.id_cuadrilla, payload);
        const actualizada = await api.obtenerCuadrilla(editando.id_cuadrilla);
        setEditando(actualizada);
        setOk('Cuadrilla actualizada.');
      } else {
        const herramientas = herramientasTexto
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((n) => Number.isFinite(n) && n > 0);
        const payload: CuadrillaCreate = {
          id_central: Number(form.id_central),
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          id_flota: form.id_flota ? Number(form.id_flota) : null,
          es_supervisor: form.es_supervisor,
          activa: form.activa,
          integrantes: integrantes
            .filter((i) => i.id_tecnico !== '')
            .map((i) => ({
              id_tecnico: Number(i.id_tecnico),
              rol_cuadrilla: i.rol_cuadrilla,
            })),
          herramientas,
        };
        await api.crearCuadrilla(payload);
        setOk('Cuadrilla creada.');
        limpiarFormulario();
      }
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al guardar la cuadrilla.');
    } finally {
      setGuardando(false);
    }
  }

  async function agregarIntegranteExistente(evento: FormEvent) {
    evento.preventDefault();
    if (!editando) return;
    if (!nuevoIntegrante.id_tecnico) {
      setError('Seleccione el técnico a incorporar.');
      return;
    }
    setError('');
    setOk('');
    try {
      await api.agregarIntegrante(editando.id_cuadrilla, {
        id_tecnico: Number(nuevoIntegrante.id_tecnico),
        rol_cuadrilla: nuevoIntegrante.rol_cuadrilla,
      });
      setNuevoIntegrante({ id_tecnico: '', rol_cuadrilla: 'REPARADOR_PRINCIPAL' });
      const actualizada = await api.obtenerCuadrilla(editando.id_cuadrilla);
      setEditando(actualizada);
      setOk('Integrante agregado.');
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al agregar el integrante.');
    }
  }

  async function retirarIntegrante(idTecnico: number) {
    if (!editando) return;
    if (!window.confirm(`¿Retirar a ${nombreTecnico(idTecnico)} de la cuadrilla?`)) return;
    setError('');
    setOk('');
    try {
      await api.retirarIntegrante(editando.id_cuadrilla, idTecnico);
      const actualizada = await api.obtenerCuadrilla(editando.id_cuadrilla);
      setEditando(actualizada);
      setOk('Integrante retirado.');
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al retirar el integrante.');
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Cuadrillas</h1>
          <p>Composición de cuadrillas, vehículo asignado e integrantes.</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {!soloLectura && (
        <div className="panel-bloque">
          <h2>{editando ? `Editar cuadrilla #${editando.id_cuadrilla}` : 'Nueva cuadrilla'}</h2>
          <form className="formulario" onSubmit={enviar}>
            <div className="campo">
              <label>Central *</label>
              <select
                value={form.id_central}
                disabled={Boolean(editando)}
                onChange={(e) =>
                  setForm({ ...form, id_central: e.target.value, id_flota: '' })
                }
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
              <label>Código *</label>
              <input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Nombre *</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Vehículo (flota)</label>
              <select
                value={form.id_flota}
                onChange={(e) => setForm({ ...form, id_flota: e.target.value })}
              >
                <option value="">— Sin vehículo —</option>
                {flotasDeCentral.map((f) => (
                  <option key={f.id_flota} value={f.id_flota}>
                    {f.can} — {f.placa ?? 'sin placa'} ({f.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="campo campo-check">
              <input
                id="cuadrilla-supervisor"
                type="checkbox"
                checked={form.es_supervisor}
                onChange={(e) => setForm({ ...form, es_supervisor: e.target.checked })}
              />
              <label htmlFor="cuadrilla-supervisor">Es supervisora</label>
            </div>
            <div className="campo campo-check">
              <input
                id="cuadrilla-activa"
                type="checkbox"
                checked={form.activa}
                onChange={(e) => setForm({ ...form, activa: e.target.checked })}
              />
              <label htmlFor="cuadrilla-activa">Activa</label>
            </div>

            {!editando && (
              <>
                <div className="campo campo-ancho">
                  <label>Herramientas (IDs separados por coma)</label>
                  <input
                    value={herramientasTexto}
                    placeholder="Ej. 1, 4, 7"
                    onChange={(e) => setHerramientasTexto(e.target.value)}
                  />
                </div>
                <div className="subpanel campo-ancho">
                  <h3 className="texto-pequeno">Integrantes a incluir</h3>
                  {integrantes.length === 0 && (
                    <p className="texto-pequeno">Sin integrantes. Puede agregar varios.</p>
                  )}
                  {integrantes.map((i, indice) => (
                    <div className="fila-integrante" key={indice}>
                      <select
                        value={i.id_tecnico}
                        onChange={(e) =>
                          setIntegrantes((actual) =>
                            actual.map((x, j) =>
                              j === indice ? { ...x, id_tecnico: e.target.value } : x,
                            ),
                          )
                        }
                      >
                        <option value="">— Técnico —</option>
                        {tecnicosDeCentral.map((t) => (
                          <option key={t.id_tecnico} value={t.id_tecnico}>
                            {t.nombre} {t.apellido ?? ''} ({t.p00})
                          </option>
                        ))}
                      </select>
                      <select
                        value={i.rol_cuadrilla}
                        onChange={(e) =>
                          setIntegrantes((actual) =>
                            actual.map((x, j) =>
                              j === indice
                                ? { ...x, rol_cuadrilla: e.target.value as RolCuadrilla }
                                : x,
                            ),
                          )
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-mini btn-peligro"
                        onClick={() =>
                          setIntegrantes((actual) => actual.filter((_, j) => j !== indice))
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-mini btn-secundario"
                    onClick={() =>
                      setIntegrantes((actual) => [
                        ...actual,
                        { id_tecnico: '', rol_cuadrilla: 'REPARADOR_PRINCIPAL' },
                      ])
                    }
                  >
                    + Añadir integrante
                  </button>
                </div>
              </>
            )}

            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear cuadrilla'}
              </button>
              {editando && (
                <button type="button" className="btn btn-secundario" onClick={limpiarFormulario}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {editando && (
            <div className="subpanel">
              <h3 className="texto-pequeno">Integrantes de la cuadrilla #{editando.id_cuadrilla}</h3>
              <ul className="lista-integrantes">
                {editando.integrantes.filter((i) => i.hasta === null).length === 0 && (
                  <li>Sin integrantes activos.</li>
                )}
                {editando.integrantes
                  .filter((i) => i.hasta === null)
                  .map((i) => (
                    <li key={i.id_tecnico}>
                      <span>
                        {nombreTecnico(i.id_tecnico)} · <strong>{i.rol_cuadrilla}</strong> · desde{' '}
                        {fecha(i.desde)}
                      </span>
                      <button
                        type="button"
                        className="btn btn-mini btn-peligro"
                        onClick={() => retirarIntegrante(i.id_tecnico)}
                      >
                        Retirar
                      </button>
                    </li>
                  ))}
              </ul>
              <form className="fila-integrante" onSubmit={agregarIntegranteExistente}>
                <select
                  value={nuevoIntegrante.id_tecnico}
                  onChange={(e) =>
                    setNuevoIntegrante({ ...nuevoIntegrante, id_tecnico: e.target.value })
                  }
                >
                  <option value="">— Técnico —</option>
                  {tecnicosDeCentral.map((t) => (
                    <option key={t.id_tecnico} value={t.id_tecnico}>
                      {t.nombre} {t.apellido ?? ''} ({t.p00})
                    </option>
                  ))}
                </select>
                <select
                  value={nuevoIntegrante.rol_cuadrilla}
                  onChange={(e) =>
                    setNuevoIntegrante({
                      ...nuevoIntegrante,
                      rol_cuadrilla: e.target.value as RolCuadrilla,
                    })
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button className="btn btn-mini" type="submit">
                  Incorporar
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
            id="solo-activas-cuadrilla"
            type="checkbox"
            checked={soloActivas}
            onChange={(e) => setSoloActivas(e.target.checked)}
          />
          <label htmlFor="solo-activas-cuadrilla">Solo activas</label>
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
              <th>Vehículo</th>
              <th>Supervisora</th>
              <th>Integrantes</th>
              <th>Activa</th>
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
                  No hay cuadrillas registradas.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id_cuadrilla}>
                  <td>{c.id_cuadrilla}</td>
                  <td>{nombreCentral(c.id_central)}</td>
                  <td>{c.codigo}</td>
                  <td>{c.nombre}</td>
                  <td>{placaFlota(c.id_flota)}</td>
                  <td>{c.es_supervisor ? 'Sí' : 'No'}</td>
                  <td>{c.integrantes.filter((i) => i.hasta === null).length}</td>
                  <td>{c.activa ? 'Sí' : 'No'}</td>
                  {!soloLectura && (
                    <td>
                      <div className="celda-acciones">
                        <button className="btn btn-mini btn-secundario" onClick={() => editar(c)}>
                          Editar / integrantes
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
