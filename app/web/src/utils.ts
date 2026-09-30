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

/** Formatea una marca de tiempo ISO (`2026-09-30T18:04:00...` → `2026-09-30 18:04:00`). */
export function fechaHora(valor: string | null | undefined): string {
  return valor ? valor.replace('T', ' ').slice(0, 19) : '—';
}
