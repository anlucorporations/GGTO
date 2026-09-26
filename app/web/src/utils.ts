/** Convierte cadenas vacías en `null` (los campos opcionales de la API). */
export function nv(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

/** Formatea una fecha ISO (YYYY-MM-DD) o marca la ausencia de valor. */
export function fecha(valor: string | null | undefined): string {
  if (!valor) return '—';
  return valor.length >= 10 ? valor.slice(0, 10) : valor;
}
