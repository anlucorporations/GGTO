import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** CASOS no es una capacidad del Coordinador (DEC-G20). */
export default function RutaCasos() {
  const { usuario } = useAuth();
  if (usuario?.rol === 'COORDINADOR') return <Navigate to="/" replace />;
  return <Outlet />;
}
