/**
 * Ficha rápida de caso (requisito de UI 3 del ciclo D-65).
 *
 * Se abre por **avería o teléfono** desde el PANEL (búsqueda rápida) o desde el
 * buscador global. Es un modal flotante al 90 % cuyo encabezado lleva el cuadro
 * de texto **al lado del título** y cuyo cuerpo muestra la información en
 * pestañas: **Actual · Estado · Contacto · Técnico**.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import * as api from '../api/client';
import type { CasoEstadoHistOut, CasoOut } from '../api/types';
import Modal from './Modal';

interface Props {
  /** Término con el que se abre (avería o teléfono). */
  terminoInicial?: string;
  /** Si se abre con un caso ya identificado (p. ej. desde el buscador global). */
  idCasoInicial?: number | null;
  onCerrar: () => void;
}

type Pestana = 'ACTUAL' | 'ESTADO' | 'CONTACTO' | 'TECNICO';

const PESTANAS: { clave: Pestana; etiqueta: string }[] = [
  { clave: 'ACTUAL', etiqueta: 'Actual' },
  { clave: 'ESTADO', etiqueta: 'Estado' },
  { clave: 'CONTACTO', etiqueta: 'Contacto' },
  { clave: 'TECNICO', etiqueta: 'Técnico' },
];

function fechaHora(valor: string | null | undefined): string {
  return valor ? valor.replace('T', ' ').slice(0, 19) : '—';
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  const vacio = valor === null || valor === undefined || valor === '';
  return (
    <tr>
      <th>{etiqueta}</th>
      <td>{vacio ? '—' : valor}</td>
    </tr>
  );
}

function Grupo({ titulo }: { titulo: string }) {
  return (
    <tr className="ficha-grupo">
      <th colSpan={2}>{titulo}</th>
    </tr>
  );
}

function Tarjeta({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  const vacio = valor === null || valor === undefined || valor === '';
  return (
    <div className="ficha-tarjeta">
      <div className="etiqueta">{etiqueta}</div>
      <div className="valor">{vacio ? '—' : valor}</div>
    </div>
  );
}

export default function FichaRapida({ terminoInicial = '', idCasoInicial = null, onCerrar }: Props) {
  const [termino, setTermino] = useState(terminoInicial);
  const [resultados, setResultados] = useState<CasoOut[] | null>(null);
  const [caso, setCaso] = useState<CasoOut | null>(null);
  const [historial, setHistorial] = useState<CasoEstadoHistOut[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<Pestana>('ACTUAL');

  const cargarHistorial = useCallback(async (idCaso: number) => {
    setCargandoHistorial(true);
    try {
      setHistorial(await api.obtenerHistorialCaso(idCaso));
    } catch {
      setHistorial([]);
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  const seleccionar = useCallback(
    async (detalle: CasoOut) => {
      setCaso(detalle);
      setResultados(null);
      setPestana('ACTUAL');
      await cargarHistorial(detalle.id_caso);
    },
    [cargarHistorial],
  );

  // Apertura con un caso ya identificado (buscador global).
  useEffect(() => {
    if (idCasoInicial === null) return;
    let activo = true;
    setBuscando(true);
    api
      .obtenerCaso(idCasoInicial)
      .then((detalle) => {
        if (activo) void seleccionar(detalle);
      })
      .catch((e) => {
        if (activo) setError(e instanceof api.ApiError ? e.message : 'Error al abrir la ficha.');
      })
      .finally(() => {
        if (activo) setBuscando(false);
      });
    return () => {
      activo = false;
    };
  }, [idCasoInicial, seleccionar]);

  // Apertura con un término (búsqueda rápida del PANEL).
  useEffect(() => {
    const q = terminoInicial.trim();
    if (idCasoInicial !== null || !q) return;
    let activo = true;
    setBuscando(true);
    api
      .buscarCasos({ q, limite: 8 })
      .then((lista) => {
        if (!activo) return;
        if (lista.length === 1) void seleccionar(lista[0]);
        else setResultados(lista);
      })
      .catch((e) => {
        if (activo) setError(e instanceof api.ApiError ? e.message : 'Error en la búsqueda.');
      })
      .finally(() => {
        if (activo) setBuscando(false);
      });
    return () => {
      activo = false;
    };
    // Solo al montar: el término se edita luego con el buscador de la cabecera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscar(evento: FormEvent) {
    evento.preventDefault();
    const q = termino.trim();
    setError('');
    if (!q) {
      setError('Escriba un ID de avería o un teléfono.');
      return;
    }
    setBuscando(true);
    try {
      const lista = await api.buscarCasos({ q, limite: 8 });
      if (lista.length === 1) {
        await seleccionar(lista[0]);
      } else {
        setCaso(null);
        setResultados(lista);
      }
    } catch (e) {
      setResultados([]);
      setCaso(null);
      setError(e instanceof api.ApiError ? e.message : 'Error en la búsqueda.');
    } finally {
      setBuscando(false);
    }
  }

  const titulo = caso
    ? `Ficha del caso #${caso.id_caso} — ${caso.id_averia}`
    : 'Búsqueda rápida por avería o teléfono';

  return (
    <Modal
      titulo={titulo}
      onCerrar={onCerrar}
      cabeceraExtra={
        <form className="modal-cabecera-busqueda" role="search" onSubmit={(e) => void buscar(e)}>
          <input
            id="ficha-rapida-q"
            type="search"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder="ID de avería o teléfono…"
            aria-label="ID de avería o teléfono"
            autoComplete="off"
          />
          <button className="btn btn-mini" type="submit" disabled={buscando}>
            {buscando ? '…' : 'Buscar'}
          </button>
        </form>
      }
    >
      {error && <p className="aviso aviso-error">{error}</p>}

      {!caso && buscando && <p className="texto-pequeno">Buscando…</p>}

      {!caso && !buscando && resultados !== null && (
        resultados.length === 0 ? (
          <p className="vacio">Sin coincidencias para «{termino}».</p>
        ) : (
          <ul className="ficha-resultados">
            {resultados.map((c) => (
              <li key={c.id_caso}>
                <button type="button" onClick={() => void seleccionar(c)}>
                  <span className="mono">{c.id_averia}</span>{' '}
                  <strong>{c.nombre_cliente ?? 'Cliente sin nombre'}</strong>
                  <span className="texto-pequeno">
                    {' '}
                    · {c.telefono ?? 'sin teléfono'} · {c.estado_actual}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {caso && (
        <>
          <div className="ficha-tabs" role="tablist" aria-label="Información del caso">
            {PESTANAS.map((p) => (
              <button
                key={p.clave}
                type="button"
                role="tab"
                aria-selected={pestana === p.clave}
                className={`ficha-tab${pestana === p.clave ? ' activo' : ''}`}
                onClick={() => setPestana(p.clave)}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>

          {pestana === 'ACTUAL' && (
            <div role="tabpanel" aria-label="Actual">
              <div className="ficha-tarjetas">
                <Tarjeta etiqueta="Estado" valor={caso.estado_actual} />
                <Tarjeta etiqueta="Asignación" valor={textoAsignacion(caso)} />
                <Tarjeta etiqueta="Fecha de ingreso" valor={fechaHora(caso.creado_en)} />
                <Tarjeta
                  etiqueta="Fecha de reporte"
                  valor={fechaHora(caso.fecha_reporte)}
                />
              </div>
              <div className="tabla-envoltura">
                <table className="tabla-ficha">
                  <tbody>
                    <Grupo titulo="Asignación" />
                    <Fila etiqueta="Reparador principal" valor={caso.reparador_principal} />
                    <Fila etiqueta="Cuadrilla externa" valor={caso.cuadrilla_externa} />
                    <Fila etiqueta="Sector" valor={caso.sector_nombre ?? caso.id_sector} />
                    <Fila
                      etiqueta="Cuadrilla 0 (supervisor)"
                      valor={caso.en_gestion_supervisor ? 'Sí' : 'No'}
                    />
                    <Grupo titulo="Bitácora" />
                    <Fila etiqueta="Último comentario" valor={caso.ultimo_comentario} />
                    <Fila etiqueta="Actualizado en" valor={fechaHora(caso.actualizado_en)} />
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pestana === 'ESTADO' && (
            <div role="tabpanel" aria-label="Estado">
              <div className="tabla-envoltura">
                <table className="tabla-ficha">
                  <tbody>
                    <Grupo titulo="Estado del caso" />
                    <Fila etiqueta="Estado actual" valor={caso.estado_actual} />
                    <Fila etiqueta="Falla masiva" valor={caso.es_falla_masiva ? 'Sí' : 'No'} />
                    <Fila
                      etiqueta="Cuadrilla 0 (supervisor)"
                      valor={caso.en_gestion_supervisor ? 'Sí' : 'No'}
                    />
                    <Fila etiqueta="Origen" valor={caso.origen} />
                    <Grupo titulo="Fechas" />
                    <Fila etiqueta="Fecha de reporte" valor={fechaHora(caso.fecha_reporte)} />
                    <Fila etiqueta="Fecha de compromiso" valor={fechaHora(caso.fecha_compromiso)} />
                    <Fila etiqueta="Fecha de cita" valor={fechaHora(caso.fecha_cita)} />
                  </tbody>
                </table>
              </div>

              <h3 className="subtitulo-seccion">Historial de estados (bitácora)</h3>
              {cargandoHistorial ? (
                <p className="texto-pequeno">Cargando historial…</p>
              ) : historial.length === 0 ? (
                <p className="vacio">No hay movimientos registrados.</p>
              ) : (
                <div className="tabla-envoltura">
                  <table>
                    <thead>
                      <tr>
                        <th>Estado anterior</th>
                        <th>Estado nuevo</th>
                        <th>Motivo</th>
                        <th>Usuario</th>
                        <th>Fecha y hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((h) => (
                        <tr key={h.id_hist}>
                          <td>{h.estado_anterior ?? '—'}</td>
                          <td>{h.estado_nuevo}</td>
                          <td>{h.motivo ?? '—'}</td>
                          <td>{h.usuario ?? '—'}</td>
                          <td>{fechaHora(h.fecha_hora)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {pestana === 'CONTACTO' && (
            <div role="tabpanel" aria-label="Contacto">
              <div className="tabla-envoltura">
                <table className="tabla-ficha">
                  <tbody>
                    <Grupo titulo="Cliente" />
                    <Fila etiqueta="Nombre" valor={caso.nombre_cliente} />
                    <Fila etiqueta="Teléfono" valor={caso.telefono} />
                    <Fila etiqueta="Dirección" valor={caso.direccion} />
                    <Fila etiqueta="Persona que reporta" valor={caso.persona_reporta} />
                    <Fila etiqueta="Contacto del cliente" valor={caso.contacto_cliente} />
                    <Grupo titulo="Ubicación" />
                    <Fila etiqueta="Sector" valor={caso.sector_nombre ?? caso.id_sector} />
                    <Fila etiqueta="Municipio" valor={caso.municipio} />
                    <Fila etiqueta="Parroquia" valor={caso.parroquia} />
                    <Fila etiqueta="Área" valor={caso.area} />
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pestana === 'TECNICO' && (
            <div role="tabpanel" aria-label="Técnico">
              <div className="tabla-envoltura">
                <table className="tabla-ficha">
                  <tbody>
                    <Grupo titulo="Asignación de campo" />
                    <Fila etiqueta="Reparador principal" valor={caso.reparador_principal} />
                    <Fila etiqueta="Cuadrilla externa" valor={caso.cuadrilla_externa} />
                    <Fila
                      etiqueta="Ayudantes"
                      valor={caso.ayudantes.length > 0 ? caso.ayudantes.map(String).join(', ') : ''}
                    />
                    <Fila etiqueta="Flota CAN" valor={caso.flota_can} />
                    <Grupo titulo="Datos de trabajo" />
                    <Fila etiqueta="Área de trabajo" valor={caso.area_trabajo} />
                    <Fila etiqueta="Unidad de negocio" valor={caso.unidad_negocio} />
                    <Fila etiqueta="OLT" valor={caso.olt} />
                    <Fila etiqueta="Plan" valor={caso.plan} />
                    <Fila etiqueta="Slot" valor={caso.slot} />
                    <Fila etiqueta="Puerto" valor={caso.puerto} />
                    <Fila etiqueta="FAT" valor={caso.fat} />
                    <Fila etiqueta="Serial" valor={caso.serial} />
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/** Texto corto de asignación para la pestaña «Actual». */
function textoAsignacion(caso: CasoOut): string {
  const partes = [caso.reparador_principal, caso.cuadrilla_externa].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : 'Sin asignar';
}
