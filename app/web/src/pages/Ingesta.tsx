import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import type { IngestaLoteOut, ResumenIngesta } from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';
import { fecha } from '../utils';

/** Convierte el texto del campo «ID de central» en número o error. */
function parsearCentral(texto: string): { valor: number | null; error?: string } {
  const limpio = texto.trim();
  if (limpio === '') return { valor: null };
  const numero = Number(limpio);
  if (!Number.isInteger(numero) || numero <= 0) {
    return { valor: null, error: 'El ID de central debe ser un número entero positivo.' };
  }
  return { valor: numero };
}

export default function Ingesta() {
  const { soloLectura } = useAuth();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [idCentral, setIdCentral] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [resumen, setResumen] = useState<ResumenIngesta | null>(null);
  const [lotes, setLotes] = useState<IngestaLoteOut[]>([]);
  const [cargandoLotes, setCargandoLotes] = useState(true);
  const [detalle, setDetalle] = useState<IngestaLoteOut | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [modalCarga, setModalCarga] = useState(false);

  const cargarLotes = useCallback(async () => {
    setCargandoLotes(true);
    try {
      setLotes(await api.listarLotes(50));
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al listar el historial de lotes.');
    } finally {
      setCargandoLotes(false);
    }
  }, []);

  useEffect(() => {
    void cargarLotes();
  }, [cargarLotes]);

  /** Abre el formulario de carga en ventana flotante (requisito de UI 3). */
  function abrirCarga() {
    setError('');
    setOk('');
    setModalCarga(true);
  }

  function cerrarCarga() {
    setModalCarga(false);
  }

  /** Prepara el archivo y el id_central, o devuelve null si falta algo. */
  function prepararEntrada(): { archivo: File; idCentral: number | null } | null {
    setError('');
    setOk('');
    if (!archivo) {
      setError('Seleccione un archivo CSV (.csv) antes de continuar.');
      return null;
    }
    const central = parsearCentral(idCentral);
    if (central.error) {
      setError(central.error);
      return null;
    }
    return { archivo, idCentral: central.valor };
  }

  async function simular() {
    const entrada = prepararEntrada();
    if (!entrada) {
      setModalCarga(false);
      return;
    }
    setProcesando(true);
    try {
      const resultado = await api.previewIngesta(entrada.archivo, entrada.idCentral);
      setResumen(resultado);
      setOk('Simulación completada. No se guardó ningún dato.');
      setDetalle(null);
      setModalCarga(false);
    } catch (e) {
      setResumen(null);
      setError(e instanceof api.ApiError ? e.message : 'Error al simular la ingesta.');
      setModalCarga(false);
    } finally {
      setProcesando(false);
    }
  }

  async function cargar() {
    const entrada = prepararEntrada();
    if (!entrada) {
      setModalCarga(false);
      return;
    }
    if (
      !window.confirm(
        `¿Cargar «${entrada.archivo.name}» y guardar los casos nuevos? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setProcesando(true);
    try {
      const resultado = await api.cargarIngesta(entrada.archivo, entrada.idCentral);
      setResumen(resultado);
      setOk(
        resultado.id_lote !== null
          ? `Carga completada: lote #${resultado.id_lote} registrado.`
          : 'Carga completada.',
      );
      setDetalle(null);
      setModalCarga(false);
      await cargarLotes();
    } catch (e) {
      setResumen(null);
      setError(e instanceof api.ApiError ? e.message : 'Error al cargar el archivo.');
      setModalCarga(false);
    } finally {
      setProcesando(false);
    }
  }

  async function verDetalle(idLote: number) {
    setError('');
    setOk('');
    setCargandoDetalle(true);
    try {
      setDetalle(await api.obtenerLote(idLote));
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al obtener el detalle del lote.');
    } finally {
      setCargandoDetalle(false);
    }
  }

  const metricas: { etiqueta: string; valor: number }[] = resumen
    ? [
        { etiqueta: 'Filas leídas', valor: resumen.filas_leidas },
        { etiqueta: 'Filas de la central', valor: resumen.filas_central },
        { etiqueta: 'Casos nuevos', valor: resumen.casos_nuevos },
        { etiqueta: 'Duplicados', valor: resumen.casos_duplicados },
        { etiqueta: 'Descartados', valor: resumen.casos_descartados },
        { etiqueta: 'Sectorizados', valor: resumen.sectorizados },
        { etiqueta: 'Sin sector', valor: resumen.sin_sector },
        { etiqueta: 'Cuadrilla 0', valor: resumen.cuadrilla0 },
      ]
    : [];

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Ingesta</h1>
          <p>Carga del archivo diario de averías (CSV): simulacro previo y registro de lotes.</p>
        </div>
        {!soloLectura && (
          <button className="btn" type="button" onClick={abrirCarga}>
            Cargar archivo diario
          </button>
        )}
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {soloLectura && (
        <div className="aviso aviso-info">
          <span>
            Modo solo lectura: su rol TECNICO no permite simular ni cargar archivos. Puede consultar el
            historial de lotes.
          </span>
        </div>
      )}

      {/* Formulario de inserción, en ventana flotante (requisito de UI 3). */}
      {!soloLectura && modalCarga && (
        <Modal titulo="Cargar archivo diario" onCerrar={cerrarCarga}>
          <div className="formulario modal-formulario">
            <div className="campo">
              <label htmlFor="ingesta-archivo">Archivo CSV *</label>
              <input
                id="ingesta-archivo"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="campo">
              <label htmlFor="ingesta-central">ID de central</label>
              <input
                id="ingesta-central"
                type="number"
                min={1}
                placeholder="Vacío = central configurada"
                value={idCentral}
                onChange={(e) => setIdCentral(e.target.value)}
              />
            </div>
            <div className="acciones-form">
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => void simular()}
                disabled={procesando}
              >
                {procesando ? 'Procesando…' : 'Simular (preview)'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void cargar()}
                disabled={procesando}
              >
                {procesando ? 'Procesando…' : 'Cargar archivo'}
              </button>
            </div>
          </div>
          <p className="texto-pequeno">
            «Simular» no guarda nada; «Cargar archivo» inserta los casos nuevos y registra el lote.
          </p>
        </Modal>
      )}

      {/* Resumen del resultado, en ventana flotante (requisito de UI 3). */}
      {resumen && (
        <Modal
          titulo={`Resumen de la ingesta — ${resumen.archivo}`}
          onCerrar={() => setResumen(null)}
        >
          {resumen.id_lote !== null && (
            <Mensaje tipo="ok" texto={`Lote registrado: #${resumen.id_lote}`} />
          )}

          <div className="rejilla-tarjetas">
            {metricas.map((m) => (
              <div className="tarjeta" key={m.etiqueta}>
                <div className="valor">{m.valor}</div>
                <div className="etiqueta">{m.etiqueta}</div>
              </div>
            ))}
          </div>

          {resumen.avisos.length > 0 && (
            <div className="avisos-ingesta">
              {resumen.avisos.map((aviso, indice) => (
                <Mensaje key={indice} tipo="error" texto={aviso} />
              ))}
            </div>
          )}

          {resumen.ejemplos.length > 0 && (
            <>
              <h3 className="subtitulo-seccion">Ejemplos de casos nuevos</h3>
              <div className="tabla-envoltura">
                <table>
                  <thead>
                    <tr>
                      <th>ID avería</th>
                      <th>Dirección</th>
                      <th>Sector</th>
                      <th>¿Cuadrilla 0?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.ejemplos.map((ejemplo) => (
                      <tr key={ejemplo.id_averia}>
                        <td className="mono">{ejemplo.id_averia}</td>
                        <td>{ejemplo.direccion ?? '—'}</td>
                        <td>{ejemplo.sector ?? '—'}</td>
                        <td>{ejemplo.cuadrilla0 ? 'Sí' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <PieTabla
                    colSpan={4}
                    total={resumen.ejemplos.length}
                    singular="lote"
                    plural="lotes"
                  />
                </table>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Ficha del lote, en ventana flotante (requisito de UI 3). */}
      {detalle && (
        <Modal titulo={`Detalle del lote #${detalle.id_lote}`} onCerrar={() => setDetalle(null)}>
          <div className="tabla-envoltura">
            <table>
              <tbody>
                <tr>
                  <th>Archivo</th>
                  <td>{detalle.archivo}</td>
                </tr>
                <tr>
                  <th>Estado</th>
                  <td>{detalle.estado}</td>
                </tr>
                <tr>
                  <th>Fecha del archivo</th>
                  <td>{fecha(detalle.fecha_archivo)}</td>
                </tr>
                <tr>
                  <th>ID de central</th>
                  <td>{detalle.id_central ?? '—'}</td>
                </tr>
                <tr>
                  <th>Filas leídas</th>
                  <td>{detalle.filas_leidas}</td>
                </tr>
                <tr>
                  <th>Filas de la central</th>
                  <td>{detalle.filas_central}</td>
                </tr>
                <tr>
                  <th>Casos nuevos</th>
                  <td>{detalle.casos_nuevos}</td>
                </tr>
                <tr>
                  <th>Duplicados</th>
                  <td>{detalle.casos_duplicados}</td>
                </tr>
                <tr>
                  <th>Descartados</th>
                  <td>{detalle.casos_descartados}</td>
                </tr>
                <tr>
                  <th>Usuario</th>
                  <td>{detalle.usuario ?? '—'}</td>
                </tr>
                <tr>
                  <th>Creado en</th>
                  <td>
                    {detalle.creado_en ? detalle.creado_en.replace('T', ' ').slice(0, 19) : '—'}
                  </td>
                </tr>
                <tr>
                  <th>Detalle de error</th>
                  <td>{detalle.detalle_error ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      <div className="panel-bloque">
        <div className="pagina-cabecera">
          <h2>Historial de lotes</h2>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void cargarLotes()}
            disabled={cargandoLotes}
          >
            {cargandoLotes ? 'Cargando…' : 'Recargar'}
          </button>
        </div>
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>Lote</th>
                <th>Archivo</th>
                <th>Fecha archivo</th>
                <th>Central</th>
                <th>Leídas</th>
                <th>De la central</th>
                <th>Nuevos</th>
                <th>Duplicados</th>
                <th>Descartados</th>
                <th>Estado</th>
                <th>Usuario</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargandoLotes ? (
                <tr>
                  <td colSpan={13} className="vacio">
                    Cargando…
                  </td>
                </tr>
              ) : lotes.length === 0 ? (
                <tr>
                  <td colSpan={13} className="vacio">
                    No hay lotes de ingesta registrados.
                  </td>
                </tr>
              ) : (
                lotes.map((lote) => (
                  <tr key={lote.id_lote}>
                    <td>{lote.id_lote}</td>
                    <td>{lote.archivo}</td>
                    <td>{fecha(lote.fecha_archivo)}</td>
                    <td>{lote.id_central ?? '—'}</td>
                    <td>{lote.filas_leidas}</td>
                    <td>{lote.filas_central}</td>
                    <td>{lote.casos_nuevos}</td>
                    <td>{lote.casos_duplicados}</td>
                    <td>{lote.casos_descartados}</td>
                    <td>{lote.estado}</td>
                    <td>{lote.usuario ?? '—'}</td>
                    <td>
                      {lote.creado_en ? lote.creado_en.replace('T', ' ').slice(0, 19) : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-mini btn-secundario"
                        onClick={() => void verDetalle(lote.id_lote)}
                        disabled={cargandoDetalle}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <PieTabla
              colSpan={13}
              total={lotes.length}
              singular="lote"
              plural="lotes"
              cargando={cargandoLotes}
            />
          </table>
        </div>
      </div>
    </>
  );
}
