/**
 * Lista editable de evidencias (seriales) del módulo MASIVAS (D-99).
 *
 * Se usa en dos sitios con límites distintos:
 *
 *  - Reporte manual de una masiva: hasta 2 seriales (RF-16).
 *  - Cierre de la masiva: hasta 20 seriales (RF-61/RF-62).
 *
 * El componente es controlado: el padre es dueño del arreglo y recibe cada
 * cambio por `onCambiar`.
 */
import { useState } from 'react';
import Mensaje from '../components/Mensaje';

interface Props {
  valores: string[];
  onCambiar: (valores: string[]) => void;
  /** Número máximo de seriales admitidos. */
  maximo: number;
  /** Texto del campo (por defecto «Serial o evidencia»). */
  etiqueta?: string;
  /** Ejemplo del campo de texto. */
  marcador?: string;
  /** Prefijo de los `id`/`htmlFor` para no repetir identificadores. */
  idBase: string;
  deshabilitado?: boolean;
}

export default function ListaEvidencias({
  valores,
  onCambiar,
  maximo,
  etiqueta = 'Serial o evidencia',
  marcador = 'Ej.: FHTT12345678',
  idBase,
  deshabilitado = false,
}: Props) {
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState('');

  function agregar() {
    const limpio = nuevo.trim();
    if (limpio === '') {
      setError('Escriba el serial antes de añadirlo.');
      return;
    }
    if (valores.includes(limpio)) {
      setError('Ese serial ya está en la lista.');
      return;
    }
    if (valores.length >= maximo) {
      setError(`Solo se admiten ${maximo} evidencia(s).`);
      return;
    }
    setError('');
    onCambiar([...valores, limpio]);
    setNuevo('');
  }

  function quitar(indice: number) {
    onCambiar(valores.filter((_, i) => i !== indice));
  }

  const lleno = valores.length >= maximo;

  return (
    <div className="campo campo-ancho">
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <label htmlFor={`${idBase}-nuevo`}>
        {etiqueta} <span className="masiva-contador">({valores.length}/{maximo})</span>
      </label>
      <div className="masiva-evidencia-fila">
        <input
          id={`${idBase}-nuevo`}
          value={nuevo}
          maxLength={120}
          placeholder={marcador}
          disabled={deshabilitado || lleno}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-secundario"
          onClick={agregar}
          disabled={deshabilitado || lleno}
        >
          Añadir
        </button>
      </div>
      {lleno && (
        <span className="texto-pequeno">
          Se alcanzó el máximo de {maximo} evidencia(s); quite una para añadir otra.
        </span>
      )}
      {valores.length > 0 && (
        <ul className="masiva-evidencia-lista">
          {valores.map((valor, indice) => (
            <li key={`${valor}-${indice}`} className="masiva-evidencia-fila">
              <span className="mono">{valor}</span>
              <button
                type="button"
                className="btn btn-mini btn-peligro"
                onClick={() => quitar(indice)}
                disabled={deshabilitado}
                aria-label={`Quitar ${valor}`}
                title={`Quitar ${valor}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
