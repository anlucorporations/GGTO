/**
 * Perfil y Cuenta (ciclo D-72): accesible desde el menú del usuario.
 *
 * Permite:
 *  - Ver los datos de la sesión y editar el propio correo (PATCH /auth/me).
 *  - Cambiar la clave con verificación de la actual (POST /auth/cambio-clave).
 *  - Ver el ESTADO de las 12 palabras de seguridad (GET /auth/mi-seguridad):
 *    los valores se guardan hasheados y nunca se muestran; la regeneración
 *    corresponde al Super Usuario (D-67), que además puede regenerar la suya
 *    propia desde esta ficha.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type { MiSeguridad } from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import { fechaHora, nv } from '../utils';
import { IconoCandado, IconoEscudo, IconoPerfil } from '../components/Iconos';

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

export default function Perfil() {
  const { usuario, refrescarUsuario } = useAuth();
  const puedeRegenerar = usuario?.rol === 'SUPER';

  const [seguridad, setSeguridad] = useState<MiSeguridad | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Correo.
  const [correo, setCorreo] = useState('');
  const [guardandoCorreo, setGuardandoCorreo] = useState(false);

  // Clave.
  const [claveActual, setClaveActual] = useState('');
  const [claveNueva, setClaveNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [guardandoClave, setGuardandoClave] = useState(false);

  // Regeneración (solo SUPER).
  const [regenerando, setRegenerando] = useState(false);
  const [palabras, setPalabras] = useState<string[] | null>(null);
  const [palabrasAviso, setPalabrasAviso] = useState('');

  const cargarSeguridad = useCallback(async () => {
    try {
      setSeguridad(await api.obtenerMiSeguridad());
    } catch (e) {
      setError(detalleDe(e, 'Error al obtener el estado de seguridad de la cuenta.'));
    }
  }, []);

  useEffect(() => {
    setCorreo(usuario?.correo ?? '');
    void cargarSeguridad();
  }, [usuario?.correo, cargarSeguridad]);

  async function guardarCorreo(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    if (correo.trim() === (usuario?.correo ?? '')) {
      setOk('No hay cambios que guardar.');
      return;
    }
    setGuardandoCorreo(true);
    try {
      await api.actualizarPerfilMe(correo.trim());
      await refrescarUsuario();
      setOk('Correo actualizado.');
    } catch (e) {
      setError(detalleDe(e, 'Error al actualizar el correo.'));
    } finally {
      setGuardandoCorreo(false);
    }
  }

  async function guardarClave(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    if (claveNueva.length < 8) {
      setError('La clave nueva debe tener al menos 8 caracteres.');
      return;
    }
    if (claveNueva !== confirmacion) {
      setError('La clave nueva y su confirmación no coinciden.');
      return;
    }
    setGuardandoClave(true);
    try {
      const r = await api.cambiarClave({
        clave_actual: claveActual,
        clave_nueva: claveNueva,
        confirmacion,
      });
      setOk(r.mensaje);
      setClaveActual('');
      setClaveNueva('');
      setConfirmacion('');
      await cargarSeguridad();
    } catch (e) {
      setError(detalleDe(e, 'Error al cambiar la clave.'));
    } finally {
      setGuardandoClave(false);
    }
  }

  async function regenerar() {
    if (!usuario) return;
    if (
      !window.confirm(
        '¿Regenerar SUS 12 palabras de seguridad? Las anteriores quedarán invalidadas de inmediato.',
      )
    )
      return;
    setError('');
    setOk('');
    setRegenerando(true);
    try {
      const r = await api.regenerarPalabras(usuario.p00);
      setPalabras(r.palabras);
      setPalabrasAviso(r.aviso);
      await cargarSeguridad();
    } catch (e) {
      setError(detalleDe(e, 'Error al regenerar las palabras de seguridad.'));
    } finally {
      setRegenerando(false);
    }
  }

  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ');

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>
            <IconoPerfil width={22} height={22} /> Perfil y Cuenta
          </h1>
          <p>Datos de la sesión, cambio de clave y estado de las palabras de seguridad.</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {seguridad?.requiere_cambio_clave && (
        <div className="aviso aviso-info">
          <span>Su cuenta está marcada para cambio de clave obligatorio: aproveche esta ficha.</span>
        </div>
      )}
      {seguridad?.bloqueado && (
        <div className="aviso aviso-error">
          <span>La cuenta está bloqueada por intentos fallidos; use la recuperación del acceso.</span>
        </div>
      )}

      <div className="rejilla-perfil">
        {/* Ficha 1: datos de la cuenta */}
        <div className="panel-bloque">
          <h2>Cuenta</h2>
          <div className="tabla-envoltura">
            <table className="tabla-ficha">
              <tbody>
                <tr>
                  <th>P00</th>
                  <td className="mono">{usuario?.p00 ?? '—'}</td>
                </tr>
                <tr>
                  <th>Nombre</th>
                  <td>{nombreCompleto || '—'}</td>
                </tr>
                <tr>
                  <th>Rol</th>
                  <td>{usuario?.rol ?? '—'}</td>
                </tr>
                <tr>
                  <th>Central</th>
                  <td>{usuario?.id_central ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <h3 className="subtitulo-seccion">Editar correo</h3>
          <form className="formulario" onSubmit={(e) => void guardarCorreo(e)}>
            <div className="campo">
              <label htmlFor="perfil-correo">Correo</label>
              <input
                id="perfil-correo"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="su.correo@ejemplo.com"
              />
            </div>
            <div className="acciones-form">
              <button className="btn" type="submit" disabled={guardandoCorreo || nv(correo) === null}>
                {guardandoCorreo ? 'Guardando…' : 'Guardar correo'}
              </button>
            </div>
          </form>
        </div>

        {/* Ficha 2: cambio de clave */}
        <div className="panel-bloque">
          <h2>
            <IconoCandado width={18} height={18} /> Cambiar clave
          </h2>
          <form className="formulario" onSubmit={(e) => void guardarClave(e)}>
            <div className="campo">
              <label htmlFor="perfil-clave-actual">Clave actual *</label>
              <input
                id="perfil-clave-actual"
                type="password"
                autoComplete="current-password"
                value={claveActual}
                onChange={(e) => setClaveActual(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="perfil-clave-nueva">Clave nueva (mínimo 8) *</label>
              <input
                id="perfil-clave-nueva"
                type="password"
                autoComplete="new-password"
                value={claveNueva}
                onChange={(e) => setClaveNueva(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="perfil-clave-confirmar">Confirmar clave nueva *</label>
              <input
                id="perfil-clave-confirmar"
                type="password"
                autoComplete="new-password"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
              />
            </div>
            <div className="acciones-form">
              <button
                className="btn"
                type="submit"
                disabled={guardandoClave || !claveActual || !claveNueva || !confirmacion}
              >
                {guardandoClave ? 'Guardando…' : 'Cambiar clave'}
              </button>
            </div>
          </form>
        </div>

        {/* Ficha 3: palabras de seguridad */}
        <div className="panel-bloque">
          <h2>
            <IconoEscudo width={18} height={18} /> Palabras de seguridad
          </h2>
          {seguridad ? (
            <div className="tabla-envoltura">
              <table className="tabla-ficha">
                <tbody>
                  <tr>
                    <th>Estado</th>
                    <td>{seguridad.tiene_palabras ? 'Activadas' : 'Sin activar'}</td>
                  </tr>
                  <tr>
                    <th>Cantidad</th>
                    <td>{seguridad.cantidad}</td>
                  </tr>
                  <tr>
                    <th>Versión</th>
                    <td>{seguridad.version ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Actualizado</th>
                    <td>{fechaHora(seguridad.actualizado_en)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vacio">Cargando estado…</p>
          )}
          <p className="texto-pequeno">
            Los valores de las 12 palabras <strong>no se pueden consultar</strong>: se guardan
            cifrados con hash. Sirven para desbloquear la cuenta o restablecer la clave desde la
            pantalla de acceso. Para obtener un juego nuevo, el Super Usuario debe regenerarlas
            (menú TÉCNICOS o el botón de esta ficha, solo para él).
          </p>
          {puedeRegenerar && (
            <div className="acciones-form">
              <button
                type="button"
                className="btn btn-peligro"
                onClick={() => void regenerar()}
                disabled={regenerando}
              >
                {regenerando ? 'Generando…' : 'Regenerar mis 12 palabras'}
              </button>
            </div>
          )}
        </div>
      </div>

      {palabras && (
        <Modal titulo="Nuevas palabras de seguridad" onCerrar={() => setPalabras(null)}>
          <p className="texto-pequeno">{palabrasAviso}</p>
          <ol className="lista-palabras">
            {palabras.map((p, i) => (
              <li key={`${p}-${i}`}>
                <span className="num-palabra">{i + 1}</span>
                <span className="mono">{p}</span>
              </li>
            ))}
          </ol>
          <div className="acciones-form">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPalabras(null);
                setOk('Palabras regeneradas: guárdelas en un lugar seguro.');
              }}
            >
              Las he copiado
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
