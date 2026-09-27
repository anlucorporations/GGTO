import { useEffect, type RefObject } from 'react';

/**
 * Cierra un desplegable (menú, buscador) al pulsar fuera de su contenedor o
 * al presionar `Escape`. `cerrar` debería ser estable (`useCallback`).
 */
export function useCerrarDesplegable(
  ref: RefObject<HTMLElement | null>,
  abierto: boolean,
  cerrar: () => void,
): void {
  useEffect(() => {
    if (!abierto) return;
    function alPulsar(evento: MouseEvent) {
      const caja = ref.current;
      if (caja && !caja.contains(evento.target as Node)) cerrar();
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') cerrar();
    }
    document.addEventListener('mousedown', alPulsar);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alPulsar);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [ref, abierto, cerrar]);
}
