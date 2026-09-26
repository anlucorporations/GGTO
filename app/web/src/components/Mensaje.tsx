interface MensajeProps {
  tipo: 'error' | 'ok';
  texto: string;
  onCerrar?: () => void;
}

/** Banda de aviso reutilizable: muestra el `detail` de la API o el éxito. */
export default function Mensaje({ tipo, texto, onCerrar }: MensajeProps) {
  if (!texto) return null;
  return (
    <div className={`aviso aviso-${tipo}`} role="status">
      <span>{texto}</span>
      {onCerrar && (
        <button type="button" className="aviso-cerrar" onClick={onCerrar} aria-label="Cerrar">
          ×
        </button>
      )}
    </div>
  );
}
