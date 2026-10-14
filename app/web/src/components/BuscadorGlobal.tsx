import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/client';
import type { CasoOut } from '../api/types';
import { IconoBuscar, IconoCerrar } from './Iconos';
import { useCerrarDesplegable } from './useCerrarDesplegable';

/** ¿El caso coincidió por el identificador de pago o por el número de contacto? */
function grupoDe(caso: CasoOut, termino: string): 'identificador' | 'contacto' | 'otros' {
  const t = termino.trim();
  if (t && (caso.telefono ?? '').includes(t)) return 'identificador';
  if (t && (caso.contacto_cliente ?? '').includes(t)) return 'contacto';
  return 'otros';
}

/**
 * D-92/CU-D89-04: los resultados se muestran en **grupos separados** según el dato
 * por el que coincidieron (identificador de pago o número de contacto), sin
 * mezclarlos; el resto (avería, cliente, dirección) va en «Otros datos».
 */
export function agruparResultados(
  resultados: CasoOut[],
  termino: string,
): { clave: 'identificador' | 'contacto' | 'otros'; titulo: string; casos: CasoOut[] }[] {
  const identificador: CasoOut[] = [];
  const contacto: CasoOut[] = [];
  const otros: CasoOut[] = [];
  for (const caso of resultados) {
    const grupo = grupoDe(caso, termino);
    if (grupo === 'identificador') identificador.push(caso);
    else if (grupo === 'contacto') contacto.push(caso);
    else otros.push(caso);
  }
  return [
    { clave: 'identificador', titulo: 'Identificador de pago (70*)', casos: identificador },
    { clave: 'contacto', titulo: 'Número de contacto', casos: contacto },
    { clave: 'otros', titulo: 'Otros datos (avería, cliente, dirección)', casos: otros },
  ].filter((g) => g.casos.length > 0) as {
    clave: 'identificador' | 'contacto' | 'otros';
    titulo: string;
    casos: CasoOut[];
  }[];
}

/**
 * Buscador global de la barra superior (RF-30): un único cuadro que consulta
 * `/casos/buscar?q=` y muestra hasta 8 coincidencias en un desplegable.
 * Al elegir una se abre la ficha (rápida, con pestañas) del caso.
 */
export default function BuscadorGlobal({
  onAbrirCaso,
}: {
  /** Si se define, abre la ficha rápida; si no, navega a CASOS. */
  onAbrirCaso?: (caso: CasoOut) => void;
}) {
  const navigate = useNavigate();
  const cajaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<CasoOut[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [movilAbierto, setMovilAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');

  const cerrarTodo = useCallback(() => {
    setAbierto(false);
    setMovilAbierto(false);
  }, []);

  useCerrarDesplegable(cajaRef, abierto || movilAbierto, cerrarTodo);

  async function buscar(evento: FormEvent) {
    evento.preventDefault();
    const q = texto.trim();
    setError('');
    if (!q) {
      setResultados(null);
      setAbierto(false);
      setError('Escriba un incidente, teléfono, cliente o dirección.');
      return;
    }
    setBuscando(true);
    try {
      const lista = await api.buscarCasos({ q, limite: 8 });
      setResultados(lista);
      setAbierto(true);
    } catch (e) {
      setResultados([]);
      setAbierto(true);
      setError(e instanceof api.ApiError ? e.message : 'Error en la búsqueda.');
    } finally {
      setBuscando(false);
    }
  }

  function abrirCaso(caso: CasoOut) {
    cerrarTodo();
    if (onAbrirCaso) {
      onAbrirCaso(caso);
      return;
    }
    navigate('/casos', { state: { abrirCaso: caso.id_caso } });
  }

  function alternarMovil() {
    setMovilAbierto((v) => {
      const nuevo = !v;
      if (nuevo) window.setTimeout(() => inputRef.current?.focus(), 0);
      else setAbierto(false);
      return nuevo;
    });
  }

  return (
    <div ref={cajaRef} className={`buscador-global${movilAbierto ? ' movil-abierto' : ''}`}>
      <form className="buscador-form" role="search" onSubmit={(e) => void buscar(e)}>
        <button
          type="button"
          className="buscador-lupa"
          aria-label="Abrir buscador"
          title="Buscar"
          aria-expanded={movilAbierto}
          onClick={alternarMovil}
        >
          <IconoBuscar />
        </button>
        <input
          ref={inputRef}
          type="search"
          className="buscador-campo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por incidente o número…"
          aria-label="Buscar por incidente o número"
          onFocus={() => resultados !== null && setAbierto(true)}
        />
        {texto && (
          <button
            type="button"
            className="buscador-limpiar"
            aria-label="Limpiar búsqueda"
            title="Limpiar"
            onClick={() => {
              setTexto('');
              setResultados(null);
              setAbierto(false);
              inputRef.current?.focus();
            }}
          >
            <IconoCerrar width={15} height={15} />
          </button>
        )}
        <button type="submit" className="btn btn-mini buscador-enviar" disabled={buscando}>
          {buscando ? '…' : 'Buscar'}
        </button>
      </form>

      {error && <p className="buscador-error texto-pequeno">{error}</p>}

      {abierto && resultados !== null && (
        <div className="desplegable buscador-resultados" role="listbox" aria-label="Resultados">
          {resultados.length === 0 ? (
            <p className="buscador-vacio">Sin coincidencias</p>
          ) : (
            <div className="buscador-grupos">
              {agruparResultados(resultados, texto).map((grupo) => (
                <div key={grupo.clave} className="buscador-grupo" data-grupo={grupo.clave}>
                  <p className="buscador-grupo-titulo texto-pequeno">{grupo.titulo}</p>
                  <ul>
                    {grupo.casos.map((c) => (
                      <li key={c.id_caso}>
                        <button
                          type="button"
                          role="option"
                          aria-selected="false"
                          className="buscador-item"
                          onClick={() => abrirCaso(c)}
                        >
                          <span className="mono">{c.id_averia}</span>
                          <span className="buscador-item-datos">
                            <span>{c.nombre_cliente ?? 'Cliente sin nombre'}</span>
                            <span className="texto-pequeno">
                              {c.telefono ?? 'sin identificador de pago'} · {c.estado_actual}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
