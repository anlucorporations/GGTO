import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/client';
import type { Resumen } from '../api/types';
import Mensaje from '../components/Mensaje';
import { useAuth } from '../auth/AuthContext';

const TARJETAS: { clave: keyof Resumen; etiqueta: string }[] = [
  { clave: 'tablas', etiqueta: 'Tablas' },
  { clave: 'centrales', etiqueta: 'Centrales' },
  { clave: 'roles', etiqueta: 'Roles' },
  { clave: 'cuadrillas', etiqueta: 'Cuadrillas' },
  { clave: 'causas', etiqueta: 'Causas' },
  { clave: 'parametros', etiqueta: 'Parámetros' },
];

export default function Panel() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [termino, setTermino] = useState('');
  const [errorBusqueda, setErrorBusqueda] = useState('');

  useEffect(() => {
    let activo = true;
    api
      .obtenerResumen()
      .then((r) => {
        if (activo) setResumen(r);
      })
      .catch((e) => {
        if (activo) setError(e instanceof api.ApiError ? e.message : 'Error al cargar el resumen.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ');

  function buscarRapido(evento: FormEvent) {
    evento.preventDefault();
    const q = termino.trim();
    if (!q) {
      setErrorBusqueda('Indique un ID de avería o un teléfono para buscar.');
      return;
    }
    setErrorBusqueda('');
    navigate('/casos', { state: { q } });
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Panel</h1>
          <p>
            Sesión de <strong>{nombreCompleto || usuario?.p00}</strong> · rol {usuario?.rol}
          </p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="error" texto={errorBusqueda} onCerrar={() => setErrorBusqueda('')} />

      <div className="panel-bloque">
        <h2>Búsqueda rápida de casos</h2>
        <form className="formulario" onSubmit={buscarRapido}>
          <div className="campo">
            <label htmlFor="panel-busqueda">ID de avería o teléfono</label>
            <input
              id="panel-busqueda"
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              placeholder="Ej.: 202401234567 o 04141234567"
            />
          </div>
          <div className="acciones-form">
            <button className="btn" type="submit">
              Buscar
            </button>
          </div>
        </form>
        <p className="texto-pequeno">La búsqueda se abre en la página CASOS con el término aplicado.</p>
      </div>

      {cargando ? (
        <p className="texto-pequeno">Cargando resumen…</p>
      ) : (
        <div className="rejilla-tarjetas">
          {TARJETAS.map((t) => (
            <div className="tarjeta" key={t.clave}>
              <div className="valor">{resumen ? resumen[t.clave] : '—'}</div>
              <div className="etiqueta">{t.etiqueta}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
