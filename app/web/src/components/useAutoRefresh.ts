/**
 * Auto-refresco periódico (RNF-27 · RF-42). Por defecto cada 30 s. Se **pausa**
 * cuando la pestaña no está visible y se reanuda (con refresco inmediato) al volver.
 *
 * La callback se mantiene en un `ref` para no reiniciar el temporizador si cambia.
 */
import { useEffect, useRef } from 'react';

export function useAutoRefresh(callback: () => void, intervaloMs = 30_000) {
  const cb = useRef(callback);
  cb.current = callback;

  useEffect(() => {
    let id: number | null = null;
    const arrancar = () => {
      if (id === null) id = window.setInterval(() => cb.current(), intervaloMs);
    };
    const detener = () => {
      if (id !== null) {
        window.clearInterval(id);
        id = null;
      }
    };
    const visibilidad = () => {
      if (document.hidden) {
        detener();
      } else {
        cb.current();
        arrancar();
      }
    };

    if (!document.hidden) {
      arrancar();
    }
    document.addEventListener('visibilitychange', visibilidad);
    return () => {
      detener();
      document.removeEventListener('visibilitychange', visibilidad);
    };
  }, [intervaloMs]);
}
