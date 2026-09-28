/**
 * Modal genérico de la plataforma (requisito de UI 3).
 *
 * Todos los formularios de inserción/edición y las fichas de detalle se
 * muestran en modo flotante, ocupando el **90 % de la ventana** del navegador,
 * con el título alineado en la parte superior y el icono de cerrar a la derecha.
 * El cuerpo hace scroll propio cuando el contenido no cabe.
 *
 * Cierra con el botón ✕, con `Escape` o pulsando el fondo.
 */
import { useEffect, type ReactNode } from 'react';
import { IconoCerrar } from './Iconos';

interface Props {
  /** Título del formulario o de la ficha (encabezado superior). */
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  /** Contenido opcional junto al título (p. ej. el buscador de la ficha rápida). */
  cabeceraExtra?: ReactNode;
}

export default function Modal({ titulo, onCerrar, children, cabeceraExtra }: Props) {
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar();
    }
    document.addEventListener('keydown', alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  return (
    <div className="modal-fondo" onMouseDown={onCerrar}>
      <div
        className="modal-caja"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-cabecera">
          <h2>{titulo}</h2>
          {cabeceraExtra}
          <button
            type="button"
            className="modal-cerrar"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={onCerrar}
          >
            <IconoCerrar />
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
