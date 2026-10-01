import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as api from '../api/client';
import type { PrimerAccesoOut } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import AvisoLegal from '../components/AvisoLegal';
import Mensaje from '../components/Mensaje';
import { aceptacionPrevia, registrarAceptacion } from '../disclaimer';

interface PalabraForm {
  pos: number;
  valor: string;
}

export default function Login() {
  const { iniciarSesion, autenticado } = useAuth();
  const navigate = useNavigate();

  // D-71: el aviso legal se acepta antes de mostrar el formulario de acceso.
  const [aceptado, setAceptado] = useState<boolean>(() => aceptacionPrevia());

  const [p00, setP00] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [mostrarDesbloqueo, setMostrarDesbloqueo] = useState(false);
  const [p00Desbloqueo, setP00Desbloqueo] = useState('');
  const [palabras, setPalabras] = useState<PalabraForm[]>([
    { pos: 1, valor: '' },
    { pos: 2, valor: '' },
    { pos: 3, valor: '' },
  ]);
  const [errorDesbloqueo, setErrorDesbloqueo] = useState('');
  const [okDesbloqueo, setOkDesbloqueo] = useState('');
  const [desbloqueando, setDesbloqueando] = useState(false);

  // Primer acceso (D-67): el técnico recibe su clave y sus 12 palabras.
  const [mostrarPrimerAcceso, setMostrarPrimerAcceso] = useState(false);
  const [p00Alta, setP00Alta] = useState('');
  const [infoAlta, setInfoAlta] = useState<PrimerAccesoOut | null>(null);
  const [correoAlta, setCorreoAlta] = useState('');
  const [claveAlta, setClaveAlta] = useState('');
  const [confirmacionAlta, setConfirmacionAlta] = useState('');
  const [palabrasGeneradas, setPalabrasGeneradas] = useState<string[] | null>(null);
  const [errorAlta, setErrorAlta] = useState('');
  const [okAlta, setOkAlta] = useState('');
  const [verificandoAlta, setVerificandoAlta] = useState(false);
  const [registrandoAlta, setRegistrandoAlta] = useState(false);

  if (autenticado) return <Navigate to="/" replace />;

  async function enviarLogin(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    if (!p00.trim() || !clave) {
      setError('Indique P00 y clave.');
      return;
    }
    setEnviando(true);
    try {
      const usuario = await iniciarSesion(p00.trim(), clave);
      setOk(`Bienvenido, ${usuario.p00}`);
      navigate('/', { replace: true });
    } catch (e) {
      if (e instanceof api.ApiError) {
        // 401 credenciales inválidas · 423 bloqueado · 429 demasiados intentos
        const prefijo =
          e.status === 423
            ? 'Cuenta bloqueada: '
            : e.status === 429
              ? 'Demasiados intentos: '
              : e.status === 401
                ? 'Credenciales inválidas: '
                : '';
        setError(`${prefijo}${e.message}`);
      } else {
        setError('Error inesperado al iniciar sesión.');
      }
    } finally {
      setEnviando(false);
    }
  }

  function cambiarPalabra(indice: number, campo: keyof PalabraForm, valor: string) {
    setPalabras((actual) =>
      actual.map((p, i) =>
        i === indice
          ? { ...p, [campo]: campo === 'pos' ? Number(valor) : valor }
          : p,
      ),
    );
  }

  async function enviarDesbloqueo(evento: FormEvent) {
    evento.preventDefault();
    setErrorDesbloqueo('');
    setOkDesbloqueo('');
    if (!p00Desbloqueo.trim()) {
      setErrorDesbloqueo('Indique el P00 a desbloquear.');
      return;
    }
    if (palabras.some((p) => !p.valor.trim())) {
      setErrorDesbloqueo('Complete las tres palabras de seguridad.');
      return;
    }
    setDesbloqueando(true);
    try {
      const respuesta = await api.desbloquear(p00Desbloqueo.trim(), palabras);
      setOkDesbloqueo(respuesta.mensaje ?? 'Usuario desbloqueado.');
      setP00(p00Desbloqueo.trim());
    } catch (e) {
      setErrorDesbloqueo(
        e instanceof api.ApiError ? e.message : 'Error inesperado al desbloquear.',
      );
    } finally {
      setDesbloqueando(false);
    }
  }

  /** Comprueba si el P00 está dado de alta por el supervisor (D-67). */
  async function verificarP00(evento: FormEvent) {
    evento.preventDefault();
    setErrorAlta('');
    setOkAlta('');
    setPalabrasGeneradas(null);
    if (!p00Alta.trim()) {
      setErrorAlta('Indique su P00.');
      return;
    }
    setVerificandoAlta(true);
    try {
      setInfoAlta(await api.primerAcceso(p00Alta.trim()));
    } catch (e) {
      setInfoAlta(null);
      setErrorAlta(
        e instanceof api.ApiError ? e.message : 'No se pudo comprobar el P00.',
      );
    } finally {
      setVerificandoAlta(false);
    }
  }

  /** Crea la cuenta, fija la clave y muestra las 12 palabras una sola vez. */
  async function crearAcceso(evento: FormEvent) {
    evento.preventDefault();
    setErrorAlta('');
    setOkAlta('');
    if (claveAlta !== confirmacionAlta) {
      setErrorAlta('La clave y su confirmación no coinciden.');
      return;
    }
    if (claveAlta.length < 8) {
      setErrorAlta('La clave debe tener al menos 8 caracteres.');
      return;
    }
    if (!correoAlta.trim() || correoAlta.trim().length < 5) {
      setErrorAlta('Indique un correo válido.');
      return;
    }
    setRegistrandoAlta(true);
    try {
      const respuesta = await api.completarSetup({
        p00: p00Alta.trim(),
        correo: correoAlta.trim(),
        clave: claveAlta,
        confirmacion: confirmacionAlta,
      });
      setPalabrasGeneradas(respuesta.palabras);
      setOkAlta('¡Cuenta creada! Anote sus 12 palabras de seguridad.');
      setClaveAlta('');
      setConfirmacionAlta('');
    } catch (e) {
      setErrorAlta(
        e instanceof api.ApiError ? e.message : 'No se pudo crear el acceso.',
      );
    } finally {
      setRegistrandoAlta(false);
    }
  }

  return (
    <div className="login-fondo">      <div className="login-caja">
        <h1>GGTO</h1>
        <p className="subtitulo">Plataforma de gestión de averías — CANTV</p>

        {!aceptado ? (
          <AvisoLegal
            onAceptar={() => {
              registrarAceptacion();
              setAceptado(true);
            }}
          />
        ) : (
          <>
            <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
        <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

        <form onSubmit={enviarLogin}>
          <div className="campo">
            <label htmlFor="p00">P00</label>
            <input
              id="p00"
              type="text"
              autoComplete="username"
              value={p00}
              onChange={(e) => setP00(e.target.value)}
              placeholder="Ej. 2324X001"
            />
          </div>
          <div className="campo">
            <label htmlFor="clave">Clave</label>
            <input
              id="clave"
              type="password"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

          </>
        )}

        {aceptado && (
        <div className="login-pie">
          <button
            type="button"
            className="enlace"
            onClick={() => setMostrarDesbloqueo((v) => !v)}
          >
            {mostrarDesbloqueo ? 'Ocultar desbloqueo' : 'Desbloquear con 3 palabras'}
          </button>

          {mostrarDesbloqueo && (
            <div className="subpanel" style={{ marginTop: 14 }}>
              <Mensaje
                tipo="error"
                texto={errorDesbloqueo}
                onCerrar={() => setErrorDesbloqueo('')}
              />
              <Mensaje
                tipo="ok"
                texto={okDesbloqueo}
                onCerrar={() => setOkDesbloqueo('')}
              />
              <form onSubmit={enviarDesbloqueo}>
                <div className="campo" style={{ marginBottom: 10 }}>
                  <label htmlFor="p00-unlock">P00</label>
                  <input
                    id="p00-unlock"
                    type="text"
                    value={p00Desbloqueo}
                    onChange={(e) => setP00Desbloqueo(e.target.value)}
                  />
                </div>
                <div className="palabras">
                  {palabras.map((palabra, indice) => (
                    <div className="palabra-fila" key={indice}>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={palabra.pos}
                        onChange={(e) => cambiarPalabra(indice, 'pos', e.target.value)}
                        aria-label={`Posición ${indice + 1}`}
                      />
                      <input
                        type="password"
                        value={palabra.valor}
                        placeholder={`Palabra ${indice + 1}`}
                        onChange={(e) => cambiarPalabra(indice, 'valor', e.target.value)}
                        aria-label={`Valor ${indice + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <button className="btn" type="submit" disabled={desbloqueando}>
                  {desbloqueando ? 'Desbloqueando…' : 'Desbloquear'}
                </button>
              </form>
            </div>
          )}

          <button
            type="button"
            className="enlace"
            onClick={() => {
              setMostrarPrimerAcceso((v) => !v);
              setInfoAlta(null);
              setPalabrasGeneradas(null);
              setErrorAlta('');
              setOkAlta('');
            }}
          >
            {mostrarPrimerAcceso ? 'Ocultar primer acceso' : 'Primer acceso (obtener clave)'}
          </button>

          {mostrarPrimerAcceso && (
            <div className="subpanel" style={{ marginTop: 14 }}>
              <Mensaje tipo="error" texto={errorAlta} onCerrar={() => setErrorAlta('')} />
              <Mensaje tipo="ok" texto={okAlta} onCerrar={() => setOkAlta('')} />

              {palabrasGeneradas ? (
                <>
                  <p className="texto-pequeno">
                    Guarde estas <strong>12 palabras de seguridad</strong> en un lugar seguro: no se
                    volverán a mostrar. Con 3 de ellas puede desbloquear su cuenta o restablecer la
                    clave. Si las pierde, el Super Usuario puede generar un juego nuevo.
                  </p>
                  <ol className="lista-palabras">
                    {palabrasGeneradas.map((palabra, indice) => (
                      <li key={indice}>
                        <span className="mono">{palabra}</span>
                      </li>
                    ))}
                  </ol>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setP00(p00Alta.trim());
                      setMostrarPrimerAcceso(false);
                      setInfoAlta(null);
                      setPalabrasGeneradas(null);
                    }}
                  >
                    Ir al acceso
                  </button>
                </>
              ) : (
                <>
                  <form onSubmit={(e) => void verificarP00(e)}>
                    <div className="campo" style={{ marginBottom: 10 }}>
                      <label htmlFor="p00-alta">P00</label>
                      <input
                        id="p00-alta"
                        type="text"
                        value={p00Alta}
                        onChange={(e) => setP00Alta(e.target.value)}
                        placeholder="Su código de personal"
                      />
                    </div>
                    <button className="btn btn-secundario" type="submit" disabled={verificandoAlta}>
                      {verificandoAlta ? 'Comprobando…' : 'Comprobar P00'}
                    </button>
                  </form>

                  {infoAlta && (
                    <div style={{ marginTop: 12 }}>
                      <p className="texto-pequeno">{infoAlta.mensaje}</p>
                      {infoAlta.puede_registrarse && (
                        <form onSubmit={(e) => void crearAcceso(e)}>
                          <div className="campo" style={{ marginBottom: 10 }}>
                            <label htmlFor="alta-correo">Correo</label>
                            <input
                              id="alta-correo"
                              type="email"
                              value={correoAlta}
                              onChange={(e) => setCorreoAlta(e.target.value)}
                            />
                          </div>
                          <div className="campo" style={{ marginBottom: 10 }}>
                            <label htmlFor="alta-clave">Clave (mínimo 8 caracteres)</label>
                            <input
                              id="alta-clave"
                              type="password"
                              value={claveAlta}
                              onChange={(e) => setClaveAlta(e.target.value)}
                            />
                          </div>
                          <div className="campo" style={{ marginBottom: 10 }}>
                            <label htmlFor="alta-confirmacion">Confirmar clave</label>
                            <input
                              id="alta-confirmacion"
                              type="password"
                              value={confirmacionAlta}
                              onChange={(e) => setConfirmacionAlta(e.target.value)}
                            />
                          </div>
                          <button className="btn" type="submit" disabled={registrandoAlta}>
                            {registrandoAlta
                              ? 'Creando…'
                              : 'Crear mi acceso y ver las 12 palabras'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        )}

      </div>
    </div>
  );
}
