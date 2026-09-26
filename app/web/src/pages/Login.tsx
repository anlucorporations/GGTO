import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Mensaje from '../components/Mensaje';

interface PalabraForm {
  pos: number;
  valor: string;
}

export default function Login() {
  const { iniciarSesion, autenticado } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="login-fondo">
      <div className="login-caja">
        <h1>GGTO</h1>
        <p className="subtitulo">Plataforma de gestión de averías — CANTV</p>

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
        </div>
      </div>
    </div>
  );
}
