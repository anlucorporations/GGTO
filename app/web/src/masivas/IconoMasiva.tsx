/**
 * Icono de la sección MASIVAS (D-99).
 *
 * Antena con ondas de radio: representa la concentración de servicios sobre un
 * mismo punto de la red (FAT/OLT/sector). Sigue el estilo de
 * `components/Iconos.tsx` — 24×24, `stroke="currentColor"`, `fill="none"` y
 * `strokeWidth` 1.8 — pero vive aquí para no tocar `Iconos.tsx`, que tiene otro
 * cambio en vuelo.
 */

interface Props {
  className?: string;
}

export default function IconoMasiva({ className }: Props): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Antena central */}
      <circle cx="12" cy="10" r="2.4" />
      <path d="M12 21v-8.6" />
      <path d="M8.5 21h7" />
      {/* Ondas interiores */}
      <path d="M7.6 5.1Q4.6 10 7.6 14.9" />
      <path d="M16.4 5.1Q19.4 10 16.4 14.9" />
      {/* Ondas exteriores */}
      <path d="M4.9 2.4Q1.6 10 4.9 17.6" />
      <path d="M19.1 2.4Q22.4 10 19.1 17.6" />
    </svg>
  );
}
