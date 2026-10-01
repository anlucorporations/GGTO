/**
 * Guard de rutas de gestión (ciclo D-72).
 *
 * DESPACHO y CONFIGURACIÓN no se muestran a los Técnicos: además de ocultarlas
 * en la barra (Layout), la navegación directa por URL redirige al Técnico a la
 * página OPERACIÓN.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function RutaGestion() {
  const { usuario } = useAuth();
  if (usuario?.rol === 'TECNICO') return <Navigate to="/" replace />;
  return <Outlet />;
}
