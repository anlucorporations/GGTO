import { Link } from 'react-router-dom';
import {
  ARCHIVO_DISCLAIMER_MD,
  ARCHIVO_DISCLAIMER_TXT,
  MarkdownDisclaimer,
  seccionesDe,
  useAviso,
} from '../components/Aviso';

/**
 * Página `/disclaimer`: aviso de uso restringido y descargo de responsabilidad.
 *
 * El texto se sirve desde `app/web/public/disclaimer.md` (el mismo contenido que
 * `disclaimer.md` de la raíz del repositorio y que `disclaimer.txt` de la APK).
 */
export default function Disclaimer() {
  const { markdown, error } = useAviso();
  const secciones = markdown ? seccionesDe(markdown) : [];

  return (
    <section className="pagina pagina-aviso">
      <header className="pagina-cabecera">
        <div>
          <h2>Aviso de uso restringido</h2>
          <p className="texto-pequeno">
            Documento de uso restringido — proyecto experimental de carácter académico del
            Ing. Angel H. Lucci. Prohibida su divulgación, publicación o distribución.
          </p>
        </div>
        <div className="acciones-aviso">
          <a
            className="btn btn-secundario"
            href={ARCHIVO_DISCLAIMER_MD}
            target="_blank"
            rel="noreferrer"
          >
            Abrir original (.md)
          </a>
          <a className="btn btn-secundario" href={ARCHIVO_DISCLAIMER_TXT} download>
            Descargar texto (.txt)
          </a>
        </div>
      </header>

      {error && (
        <div className="aviso aviso-error">
          {error} Descárguelo en su formato original:{' '}
          <a href={ARCHIVO_DISCLAIMER_TXT} download>
            disclaimer.txt
          </a>
          .
        </div>
      )}

      {secciones.length > 0 && (
        <nav className="indice-aviso" aria-label="Índice del aviso">
          <h3>Contenido</h3>
          <ol>
            {secciones.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.titulo}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <article className="documento-aviso">
        {markdown ? (
          <MarkdownDisclaimer markdown={markdown} />
        ) : (
          !error && <p className="texto-pequeno">Cargando el aviso…</p>
        )}
      </article>

      <footer className="pie-aviso">
        <p className="texto-pequeno">
          Si no acepta estas condiciones, debe abstenerse de usar la aplicación y eliminar cualquier
          copia en su poder. Volver a <Link to="/">OPERACIÓN</Link> o a{' '}
          <Link to="/ayuda">AYUDA</Link>.
        </p>
      </footer>
    </section>
  );
}
