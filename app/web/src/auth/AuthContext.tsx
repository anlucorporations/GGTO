import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as api from '../api/client';
import type { Usuario } from '../api/types';

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  autenticado: boolean;
  /** El rol TECNICO solo puede leer: la API responde 403 en escrituras. */
  soloLectura: boolean;
  iniciarSesion: (p00: string, clave: string) => Promise<Usuario>;
  cerrarSesion: () => void;
  /** Vuelve a leer GET /auth/me (p. ej. tras editar el perfil, D-72). */
  refrescarUsuario: () => Promise<Usuario>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => api.getUsuarioGuardado());
  const [cargando, setCargando] = useState<boolean>(() => Boolean(api.getToken()));

  const cerrarSesion = useCallback(() => {
    api.limpiarSesion();
    setUsuario(null);
  }, []);

  // Al montar: validar el token guardado con GET /auth/me.
  useEffect(() => {
    if (!api.getToken()) {
      setCargando(false);
      return;
    }
    let activo = true;
    api
      .obtenerMe()
      .then((u) => {
        if (!activo) return;
        setUsuario(u);
        api.guardarSesion(api.getToken() ?? '', u);
      })
      .catch(() => {
        if (!activo) return;
        api.limpiarSesion();
        setUsuario(null);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const iniciarSesion = useCallback(async (p00: string, clave: string) => {
    const respuesta = await api.login(p00, clave);
    api.guardarSesion(respuesta.access_token, respuesta.usuario);
    setUsuario(respuesta.usuario);
    return respuesta.usuario;
  }, []);

  const refrescarUsuario = useCallback(async () => {
    const u = await api.obtenerMe();
    api.guardarSesion(api.getToken() ?? '', u);
    setUsuario(u);
    return u;
  }, []);

  const valor = useMemo<AuthContextValue>(
    () => ({
      usuario,
      cargando,
      autenticado: usuario !== null,
      soloLectura: usuario?.rol === 'TECNICO',
      iniciarSesion,
      cerrarSesion,
      refrescarUsuario,
    }),
    [usuario, cargando, iniciarSesion, cerrarSesion, refrescarUsuario],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
