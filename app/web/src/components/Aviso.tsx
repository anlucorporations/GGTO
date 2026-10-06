import { useEffect, useState } from 'react';

/**
 * Aviso de uso restringido y descargo de responsabilidad.
 *
 * Fuente única del texto: `app/web/public/disclaimer.md` (idéntico a
 * `disclaimer.md` de la raíz del repositorio).
 */

export const RUTA_DISCLAIMER = '/disclaimer';
export const ARCHIVO_DISCLAIMER_MD = '/disclaimer.md';
export const ARCHIVO_DISCLAIMER_TXT = '/disclaimer.txt';
/** Clave de `localStorage` donde se registra la aceptación del aviso. */
export const CLAVE_ACEPTACION = 'ggto_disclaimer_aceptado';
/** Versión del aviso aceptado: si cambia, se vuelve a exigir la aceptación. */
export const VERSION_DISCLAIMER = 'v1';

// --------------------------------------------------------------------------- //
// Render de Markdown (subconjunto: títulos, párrafos, listas, citas y tablas)
// --------------------------------------------------------------------------- //

/** Convierte `**negrita**` y `` `código` `` en nodos de React. */
function conFormato(texto: string, clave: string) {
  const nodos: React.ReactNode[] = [];
  texto.split('`').forEach((trozo, i) => {
    if (i % 2 === 1) {
      nodos.push(<code key={`${clave}-c${i}`}>{trozo}</code>);
      return;
    }
    trozo.split('**').forEach((parte, j) => {
      if (j % 2 === 1) nodos.push(<strong key={`${clave}-b${i}-${j}`}>{parte}</strong>);
      else if (parte) nodos.push(parte);
    });
  });
  return nodos;
}

/** Identificador estable para las anclas del índice. */
export function anclaDe(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SeccionAviso {
  id: string;
  titulo: string;
}

/** Extrae los títulos de nivel 2 para construir el índice. */
export function seccionesDe(markdown: string): SeccionAviso[] {
  return markdown
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => {
      const titulo = l.slice(3).trim();
      return { id: anclaDe(titulo), titulo };
    });
}

function TablaMd({ filas, clave }: { filas: string[][]; clave: string }) {
  const [cabecera, ...cuerpo] = filas;
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            {cabecera.map((c, i) => (
              <th key={`${clave}-h${i}`}>{conFormato(c, `${clave}-h${i}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cuerpo.map((fila, f) => (
            <tr key={`${clave}-f${f}`}>
              {fila.map((celda, c) => (
                <td key={`${clave}-f${f}c${c}`}>{conFormato(celda, `${clave}-f${f}c${c}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renderiza el Markdown del aviso como elementos de React (sin HTML crudo). */
export function MarkdownDisclaimer({ markdown }: { markdown: string }) {
  const bloques: React.ReactNode[] = [];
  const lineas = markdown.split('\n');
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];

    if (!linea.trim() || /^\s*\|[\s:|-]+\|\s*$/.test(linea)) {
      i += 1;
      continue;
    }

    if (linea.startsWith('#')) {
      const nivel = linea.length - linea.replace(/^#+/, '').length;
      const titulo = linea.slice(nivel).trim();
      if (nivel === 1) bloques.push(<h1 key={`h${i}`}>{titulo}</h1>);
      else if (nivel === 2)
        bloques.push(
          <h2 key={`h${i}`} id={anclaDe(titulo)}>
            {titulo}
          </h2>,
        );
      else bloques.push(<h3 key={`h${i}`}>{titulo}</h3>);
      i += 1;
      continue;
    }

    if (/^-{3,}$/.test(linea.trim())) {
      bloques.push(<hr key={`hr${i}`} />);
      i += 1;
      continue;
    }

    if (linea.startsWith('>')) {
      const cita: string[] = [];
      while (i < lineas.length && lineas[i].startsWith('>')) {
        cita.push(lineas[i].replace(/^>\s?/, ''));
        i += 1;
      }
      bloques.push(<blockquote key={`q${i}`}>{conFormato(cita.join(' '), `q${i}`)}</blockquote>);
      continue;
    }

    if (linea.startsWith('|')) {
      const filas: string[][] = [];
      while (i < lineas.length && lineas[i].startsWith('|')) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lineas[i])) {
          filas.push(
            lineas[i]
              .trim()
              .replace(/^\||\|$/g, '')
              .split('|')
              .map((c) => c.trim()),
          );
        }
        i += 1;
      }
      if (filas.length) bloques.push(<TablaMd key={`t${i}`} filas={filas} clave={`t${i}`} />);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*\d+\.\s+/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      bloques.push(
        <ol key={`ol${i}`} className="lista-aviso">
          {items.map((t, k) => (
            <li key={`ol${i}-${k}`}>{conFormato(t, `ol${i}-${k}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*[-*]\s+/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      bloques.push(
        <ul key={`ul${i}`} className="lista-aviso">
          {items.map((t, k) => (
            <li key={`ul${i}-${k}`}>{conFormato(t, `ul${i}-${k}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const parrafo: string[] = [];
    while (
      i < lineas.length &&
      lineas[i].trim() &&
      !lineas[i].startsWith('#') &&
      !lineas[i].startsWith('|') &&
      !lineas[i].startsWith('>') &&
      !/^\s*([-*]|\d+\.)\s+/.test(lineas[i]) &&
      !/^-{3,}$/.test(lineas[i].trim())
    ) {
      parrafo.push(lineas[i]);
      i += 1;
    }
    bloques.push(<p key={`p${i}`}>{conFormato(parrafo.join(' '), `p${i}`)}</p>);
  }

  return <>{bloques}</>;
}

// --------------------------------------------------------------------------- //
// Carga y aceptación
// --------------------------------------------------------------------------- //

/** Descarga el texto íntegro del aviso desde el propio sitio. */
export async function cargarAviso(): Promise<string> {
  const respuesta = await fetch(ARCHIVO_DISCLAIMER_MD, {
    headers: { Accept: 'text/markdown, text/plain, */*' },
  });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta.text();
}

/** Hook de lectura del aviso. */
export function useAviso() {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    cargarAviso()
      .then((texto) => {
        if (activo) setMarkdown(texto);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el aviso.');
      });
    return () => {
      activo = false;
    };
  }, []);

  return { markdown, error };
}

/** ¿El usuario ya aceptó esta versión del aviso en este navegador? */
export function yaAceptado(): boolean {
  try {
    return localStorage.getItem(CLAVE_ACEPTACION) === VERSION_DISCLAIMER;
  } catch {
    return false;
  }
}

/** Registra la aceptación del aviso en este navegador. */
export function registrarAceptacion(): void {
  try {
    localStorage.setItem(CLAVE_ACEPTACION, VERSION_DISCLAIMER);
  } catch {
    /* almacenamiento no disponible: la aceptación vale para la sesión actual */
  }
}

/** Borra la aceptación registrada (útil para volver a mostrarla). */
export function borrarAceptacion(): void {
  try {
    localStorage.removeItem(CLAVE_ACEPTACION);
  } catch {
    /* sin almacenamiento no hay nada que borrar */
  }
}
