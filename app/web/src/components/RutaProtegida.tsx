import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Bloquea el acceso a las rutas privadas mientras no haya sesión válida. */
export default function RutaProtegida() {
  const { autenticado, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="pantalla-carga">
        <div className="spinner" aria-hidden="true" />
        <p>Validando sesión…</p>
      </div>
    );
  }

  if (!autenticado) return <Navigate to="/login" replace />;
  return <Outlet />;
}
