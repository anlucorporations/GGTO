/**
 * Muro de aceptación del aviso legal (D-71).
 *
 * Se muestra **antes del login**: mientras el usuario no marque la casilla de
 * aceptación no se renderiza el formulario de acceso. Incluye los enlaces al
 * documento completo (HTML), al PDF y a la AYUDA.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACEPTAR_TEXTO,
  CLAUSULAS,
  DISCLAIMER_AUTOR,
  DISCLAIMER_ENLACES,
  DISCLAIMER_TITULO,
  DISCLAIMER_VERSION,
} from '../disclaimer';

export default function AvisoLegal({ onAceptar }: { onAceptar: () => void }) {
  const [acepto, setAcepto] = useState(false);

  return (
    <div className="aviso-legal">
      <header className="aviso-legal-cabecera">
        <h2>{DISCLAIMER_TITULO}</h2>
        <p className="texto-pequeno">
          {DISCLAIMER_AUTOR} · {DISCLAIMER_VERSION}
        </p>
      </header>

      <p className="aviso-legal-resumen">
        Esta aplicación es un <strong>proyecto de experimento de carácter académico</strong>. Antes de
        continuar debes conocer y aceptar las condiciones de uso.
      </p>

      <ul className="aviso-legal-lista">
        {CLAUSULAS.map((c) => (
          <li key={c.titulo}>
            <strong>{c.titulo}.</strong> {c.texto}
          </li>
        ))}
      </ul>

      <nav className="aviso-legal-enlaces" aria-label="Documentos del aviso">
        <a href={DISCLAIMER_ENLACES.documento} target="_blank" rel="noreferrer">
          Leer el aviso completo
        </a>
        <a href={DISCLAIMER_ENLACES.pdf} target="_blank" rel="noreferrer">
          Descargar PDF
        </a>
        <Link to={DISCLAIMER_ENLACES.ayuda}>Ir a la Ayuda</Link>
      </nav>

      <label className="aviso-legal-check" htmlFor="aviso-acepto">
        <input
          id="aviso-acepto"
          type="checkbox"
          checked={acepto}
          onChange={(e) => setAcepto(e.target.checked)}
        />
        <span>{ACEPTAR_TEXTO}</span>
      </label>

      <button className="btn aviso-legal-boton" type="button" disabled={!acepto} onClick={onAceptar}>
        Aceptar e ingresar
      </button>
      {!acepto && (
        <p className="texto-pequeno aviso-legal-ayuda">
          Marca la casilla para habilitar el acceso.
        </p>
      )}
    </div>
  );
}
