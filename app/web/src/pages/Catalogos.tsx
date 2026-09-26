import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type { Causa, CausaCreate, DominioMetodo, Metodo, MetodoCreate } from '../api/types';
import Mensaje from '../components/Mensaje';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

const DOMINIOS: DominioMetodo[] = ['CIERRE', 'ENRUTE', 'DIFERIDO', 'CONTACTO'];

interface CausaForm {
  codigo_causa: string;
  subcodigo_causa: string;
  descripcion: string;
  descripcion_subcodigo: string;
  tipo: string;
  activo: boolean;
}

interface MetodoForm {
  dominio: DominioMetodo;
  codigo: string;
  nombre: string;
  activo: boolean;
}

const CAUSA_VACIA: CausaForm = {
  codigo_causa: '',
  subcodigo_causa: '',
  descripcion: '',
  descripcion_subcodigo: '',
  tipo: '',
  activo: true,
};

const METODO_VACIO: MetodoForm = {
  dominio: 'CIERRE',
  codigo: '',
  nombre: '',
  activo: true,
};

export default function Catalogos() {
  const { soloLectura } = useAuth();
  const [causas, setCausas] = useState<Causa[]>([]);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [filtroDominio, setFiltroDominio] = useState('');
  const [cargandoCausas, setCargandoCausas] = useState(true);
  const [cargandoMetodos, setCargandoMetodos] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [causaForm, setCausaForm] = useState<CausaForm>(CAUSA_VACIA);
  const [metodoForm, setMetodoForm] = useState<MetodoForm>(METODO_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargarCausas = useCallback(async () => {
    setCargandoCausas(true);
    try {
      setCausas(await api.listarCausas(true));
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al listar las causas.');
    } finally {
      setCargandoCausas(false);
    }
  }, []);

  const cargarMetodos = useCallback(async () => {
    setCargandoMetodos(true);
    try {
      setMetodos(await api.listarMetodos(filtroDominio ? (filtroDominio as DominioMetodo) : undefined));
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al listar los métodos.');
    } finally {
      setCargandoMetodos(false);
    }
  }, [filtroDominio]);

  useEffect(() => {
    void cargarCausas();
  }, [cargarCausas]);

  useEffect(() => {
    void cargarMetodos();
  }, [cargarMetodos]);

  async function enviarCausa(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    if (!causaForm.codigo_causa.trim()) {
      setError('Indique el código de la causa.');
      return;
    }
    setGuardando(true);
    try {
      const payload: CausaCreate = {
        codigo_causa: causaForm.codigo_causa.trim(),
        subcodigo_causa: causaForm.subcodigo_causa.trim(),
        descripcion: nv(causaForm.descripcion),
        descripcion_subcodigo: nv(causaForm.descripcion_subcodigo),
        tipo: nv(causaForm.tipo),
        activo: causaForm.activo,
      };
      await api.crearCausa(payload);
      setCausaForm(CAUSA_VACIA);
      setOk('Causa registrada.');
      await cargarCausas();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al crear la causa.');
    } finally {
      setGuardando(false);
    }
  }

  async function desactivarCausa(c: Causa) {
    if (!window.confirm(`¿Desactivar la causa ${c.codigo_causa}/${c.subcodigo_causa}?`)) return;
    setError('');
    setOk('');
    try {
      await api.desactivarCausa(c.id_causa);
      setOk('Causa desactivada.');
      await cargarCausas();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al desactivar la causa.');
    }
  }

  async function enviarMetodo(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    if (!metodoForm.codigo.trim() || !metodoForm.nombre.trim()) {
      setError('Indique código y nombre del método.');
      return;
    }
    setGuardando(true);
    try {
      const payload: MetodoCreate = {
        dominio: metodoForm.dominio,
        codigo: metodoForm.codigo.trim(),
        nombre: metodoForm.nombre.trim(),
        activo: metodoForm.activo,
      };
      await api.crearMetodo(payload);
      setMetodoForm({ ...METODO_VACIO, dominio: metodoForm.dominio });
      setOk('Método registrado.');
      await cargarMetodos();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al crear el método.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Catálogos</h1>
          <p>Causas de avería y métodos de trabajo por dominio.</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      <div className="panel-bloque">
        <h2>Causas</h2>
        {!soloLectura && (
          <form className="formulario" onSubmit={enviarCausa} style={{ marginBottom: 16 }}>
            <div className="campo">
              <label>Código *</label>
              <input
                value={causaForm.codigo_causa}
                onChange={(e) => setCausaForm({ ...causaForm, codigo_causa: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Subcódigo</label>
              <input
                value={causaForm.subcodigo_causa}
                onChange={(e) => setCausaForm({ ...causaForm, subcodigo_causa: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Tipo</label>
              <input
                value={causaForm.tipo}
                onChange={(e) => setCausaForm({ ...causaForm, tipo: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Descripción</label>
              <input
                value={causaForm.descripcion}
                onChange={(e) => setCausaForm({ ...causaForm, descripcion: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Descripción del subcódigo</label>
              <input
                value={causaForm.descripcion_subcodigo}
                onChange={(e) =>
                  setCausaForm({ ...causaForm, descripcion_subcodigo: e.target.value })
                }
              />
            </div>
            <div className="campo campo-check">
              <input
                id="causa-activo"
                type="checkbox"
                checked={causaForm.activo}
                onChange={(e) => setCausaForm({ ...causaForm, activo: e.target.checked })}
              />
              <label htmlFor="causa-activo">Activa</label>
            </div>
            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardando}>
                Crear causa
              </button>
            </div>
          </form>
        )}

        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Subcódigo</th>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Activa</th>
                {!soloLectura && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {cargandoCausas ? (
                <tr>
                  <td colSpan={soloLectura ? 6 : 7} className="vacio">
                    Cargando…
                  </td>
                </tr>
              ) : causas.length === 0 ? (
                <tr>
                  <td colSpan={soloLectura ? 6 : 7} className="vacio">
                    No hay causas registradas.
                  </td>
                </tr>
              ) : (
                causas.map((c) => (
                  <tr key={c.id_causa}>
                    <td>{c.id_causa}</td>
                    <td className="mono">{c.codigo_causa}</td>
                    <td className="mono">{c.subcodigo_causa || '—'}</td>
                    <td>{c.descripcion ?? c.descripcion_subcodigo ?? '—'}</td>
                    <td>{c.tipo ?? '—'}</td>
                    <td>{c.activo ? 'Sí' : 'No'}</td>
                    {!soloLectura && (
                      <td>
                        <button
                          className="btn btn-mini btn-peligro"
                          onClick={() => desactivarCausa(c)}
                        >
                          Desactivar
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-bloque">
        <h2>Métodos</h2>
        {!soloLectura && (
          <form className="formulario" onSubmit={enviarMetodo} style={{ marginBottom: 16 }}>
            <div className="campo">
              <label>Dominio *</label>
              <select
                value={metodoForm.dominio}
                onChange={(e) =>
                  setMetodoForm({ ...metodoForm, dominio: e.target.value as DominioMetodo })
                }
              >
                {DOMINIOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label>Código *</label>
              <input
                value={metodoForm.codigo}
                onChange={(e) => setMetodoForm({ ...metodoForm, codigo: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Nombre *</label>
              <input
                value={metodoForm.nombre}
                onChange={(e) => setMetodoForm({ ...metodoForm, nombre: e.target.value })}
              />
            </div>
            <div className="campo campo-check">
              <input
                id="metodo-activo"
                type="checkbox"
                checked={metodoForm.activo}
                onChange={(e) => setMetodoForm({ ...metodoForm, activo: e.target.checked })}
              />
              <label htmlFor="metodo-activo">Activo</label>
            </div>
            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardando}>
                Crear método
              </button>
            </div>
          </form>
        )}

        <div className="fila-filtros">
          <div className="campo">
            <label>Dominio</label>
            <select value={filtroDominio} onChange={(e) => setFiltroDominio(e.target.value)}>
              <option value="">Todos</option>
              {DOMINIOS.map((d) => (
                <option key={d} value={d}>
                  {d}
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
                <th>Dominio</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Activo</th>
              </tr>
            </thead>
            <tbody>
              {cargandoMetodos ? (
                <tr>
                  <td colSpan={5} className="vacio">
                    Cargando…
                  </td>
                </tr>
              ) : metodos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="vacio">
                    No hay métodos registrados.
                  </td>
                </tr>
              ) : (
                metodos.map((m) => (
                  <tr key={m.id_metodo}>
                    <td>{m.id_metodo}</td>
                    <td>{m.dominio}</td>
                    <td className="mono">{m.codigo}</td>
                    <td>{m.nombre}</td>
                    <td>{m.activo ? 'Sí' : 'No'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
