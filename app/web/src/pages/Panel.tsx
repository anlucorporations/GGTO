import { useEffect, useState } from 'react';
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
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

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
