/**
 * Acciones con **icono** de la sección MASIVAS (D-111).
 *
 * La columna ACCIONES de los listados deja de gastar media tabla en botones de
 * texto («Gestionar», «Reporte», «Ubicación», «Ver»): cada acción pasa a un botón
 * cuadrado con su icono, como ya hace CASOS con la columna REPORTE (D-103).
 *
 * El nombre de la acción **no se pierde** —RNF-09/RNF-23—: va en el `title`
 * (ratón) y en `aria-label` + texto oculto (lectores de pantalla), de modo que
 * `getByRole('button', { name: 'Gestionar' })` sigue funcionando igual.
 */
import type { ComponentType, SVGProps } from 'react';

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

interface Props {
  /** Icono de la acción (los SVG de `components/Iconos.tsx`). */
  Icono: Icono;
  /** Nombre de la acción: es su `title`, su `aria-label` y su texto oculto. */
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  /** Tono: el de la acción principal (abre la ficha) o el de una acción delicada. */
  tono?: 'primario' | 'peligro';
}

export default function BotonIcono({
  Icono,
  etiqueta,
  onClick,
  disabled = false,
  tono,
}: Props) {
  const clases = [
    'btn',
    'btn-mini',
    'btn-icono',
    tono === 'primario' ? 'btn-icono-primario' : '',
    tono === 'peligro' ? 'btn-icono-peligro' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={clases}
      title={etiqueta}
      aria-label={etiqueta}
      onClick={onClick}
      disabled={disabled}
    >
      <Icono width={17} height={17} />
      <span className="visualmente-oculto">{etiqueta}</span>
    </button>
  );
}
