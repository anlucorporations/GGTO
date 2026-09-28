import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type { Parametro } from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';
import { nv } from '../utils';

interface ParametroForm {
  valor: string;
  descripcion: string;
}

function valorATexto(valor: unknown): string {
  try {
    return JSON.stringify(valor, null, 2);
  } catch {
    return String(valor);
  }
}

export default function Parametros() {
  const { soloLectura } = useAuth();
  const [items, setItems] = useState<Parametro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<ParametroForm>({ valor: '', descripcion: '' });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await api.listarConfiguracion());
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al listar los parámetros.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function editar(p: Parametro) {
    setEditando(p.clave);
    setForm({ valor: valorATexto(p.valor), descripcion: p.descripcion ?? '' });
    setOk('');
    setError('');
  }

  function cancelar() {
    setEditando(null);
    setForm({ valor: '', descripcion: '' });
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!editando) return;
    setError('');
    setOk('');
    let valor: unknown;
    try {
      valor = JSON.parse(form.valor);
    } catch {
      setError('El valor debe ser JSON válido (por ejemplo 10, "texto", true o {"clave": 1}).');
      return;
    }
    setGuardando(true);
    try {
      await api.actualizarConfiguracion(editando, {
        valor,
        descripcion: nv(form.descripcion),
      });
      setOk('Parámetro actualizado.');
      cancelar();
      await cargar();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al actualizar el parámetro.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Parámetros</h1>
          <p>Configuración global del sistema. El valor se edita como JSON.</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {editando && !soloLectura && (
        <Modal titulo={`Editar parámetro «${editando}»`} onCerrar={cancelar}>
          <form className="formulario" onSubmit={enviar}>
            <div className="campo campo-ancho">
              <label htmlFor="parametro-valor">Valor (JSON)</label>
              <textarea
                id="parametro-valor"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="parametro-descripcion">Descripción</label>
              <input
                id="parametro-descripcion"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secundario" onClick={cancelar}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className="tabla-envoltura">
        <table>
          <thead>
            <tr>
              <th>Clave</th>
              <th>Valor</th>
              <th>Descripción</th>
              <th>Actualizado</th>
              {!soloLectura && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={soloLectura ? 4 : 5} className="vacio">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={soloLectura ? 4 : 5} className="vacio">
                  No hay parámetros registrados.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.clave}>
                  <td className="mono">{p.clave}</td>
                  <td className="mono">{valorATexto(p.valor)}</td>
                  <td>{p.descripcion ?? '—'}</td>
                  <td>{p.actualizado_en ? p.actualizado_en.replace('T', ' ').slice(0, 19) : '—'}</td>
                  {!soloLectura && (
                    <td>
                      <button className="btn btn-mini btn-secundario" onClick={() => editar(p)}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          <PieTabla
            colSpan={soloLectura ? 4 : 5}
            total={items.length}
            singular="parámetro"
            plural="parámetros"
            cargando={cargando}
          />
        </table>
      </div>
    </>
  );
}
