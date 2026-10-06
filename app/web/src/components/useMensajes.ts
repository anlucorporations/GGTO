/**
 * Sondeo de mensajería interna cada 20 s (RNF-26 · RT-15).
 *
 * Es la **única** pieza del sistema que se refresca a 20 s. Sondeo **incremental**
 * por `desde` (último id visto) para que el costo sea mínimo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api/client';
import type { MensajeRecibido } from '../api/types';

export function useMensajes(intervaloMs = 20_000) {
  const [mensajes, setMensajes] = useState<MensajeRecibido[]>([]);
  const [noLeidos, setNoLeidos] = useState(0);
  const ultimoId = useRef(0);
  const enCurso = useRef(false);

  const sondear = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    try {
      const nuevos = await api.listarMensajes(ultimoId.current);
      if (nuevos.length) {
        ultimoId.current = Math.max(...nuevos.map((m) => m.id_mensaje));
        setMensajes((prev) => [...prev, ...nuevos]);
        setNoLeidos((n) => n + nuevos.filter((m) => !m.leido).length);
      }
    } catch {
      // Silencioso: se reintenta en el siguiente ciclo.
    } finally {
      enCurso.current = false;
    }
  }, []);

  useEffect(() => {
    void sondear();
    const t = window.setInterval(() => void sondear(), intervaloMs);
    return () => window.clearInterval(t);
  }, [sondear, intervaloMs]);

  const marcarLeido = useCallback(async (id: number) => {
    setMensajes((prev) => prev.map((m) => (m.id_mensaje === id ? { ...m, leido: true } : m)));
    setNoLeidos((n) => Math.max(0, n - 1));
    try {
      await api.marcarMensajeLeido(id);
    } catch {
      // Best-effort.
    }
  }, []);

  return { mensajes, noLeidos, sondear, marcarLeido };
}
