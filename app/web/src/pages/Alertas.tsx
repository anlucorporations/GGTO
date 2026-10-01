/**
 * ALERTAS (Ciclo 9) — fallas masivas, outbox de notificaciones y métricas.
 *
 * Cubre RF-09 (detección automática por concentración), RF-16 (reporte manual
 * desde Telegram), RF-17 (planificación de la atención), RF-18 (solicitud de
 * material) y RNF-19/RNF-20 (métricas y outbox con reintentos).
 *
 * El envío real lo hace el backend: Telegram y el correo se habilitan al
 * configurar `TELEGRAM_BOT_TOKEN` / `SMTP_HOST`; hasta entonces las
 * notificaciones permanecen PENDIENTES en la bandeja (no se pierden).
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  EstadoFallaMasiva,
  FallaMasivaOut,
  MetricasOut,
  NotificacionOut,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { IconoAlertas, IconoFalla, IconoTelegram } from '../components/Iconos';

const ESTADOS_FALLA: EstadoFallaMasiva[] = ['DETECTADA', 'PLANIFICADA', 'ATENDIDA', 'CERRADA'];

const ESTADOS_NOTIFICACION = ['PENDIENTE', 'ENVIADO', 'FALLIDO'];

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function txt(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return String(valor);
}

function fechaHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return txt(valor);
  return d.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

function claseEstado(estado: string): string {
  if (estado === 'CERRADA' || estado === 'ENVIADO' || estado === 'ATENDIDA') return 'chip-estado-ok';
  if (estado === 'FALLIDO') return 'chip-estado-alerta';
  return '';
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Alertas() {
  const { soloLectura } = useAuth();
  const [metricas, setMetricas] = useState<MetricasOut | null>(null);
  const [fallas, setFallas] = useState<FallaMasivaOut[]>([]);
  const [notificaciones, setNotificaciones] = useState<NotificacionOut[]>([]);
  const [soloActivas, setSoloActivas] = useState(true);
  const [estadoNotif, setEstadoNotif] = useState('');

  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [modalManual, setModalManual] = useState(false);
  const [planificar, setPlanificar] = useState<FallaMasivaOut | null>(null);
  const [material, setMaterial] = useState<FallaMasivaOut | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const resultados = await Promise.allSettled([
      api.obtenerMetricas(),
      api.listarFallasMasivasAlertas({ solo_activas: soloActivas }),
      api.listarOutbox({ estado: estadoNotif || undefined }),
    ]);
    setMetricas(resultados[0].status === 'fulfilled' ? resultados[0].value : null);
    setFallas(resultados[1].status === 'fulfilled' ? resultados[1].value : []);
    setNotificaciones(resultados[2].status === 'fulfilled' ? resultados[2].value : []);
    const fallo = resultados.find((r) => r.status === 'rejected');
    if (fallo && fallo.status === 'rejected') {
      setError(detalleDe(fallo.reason, 'Error al cargar las alertas.'));
    }
    setCargando(false);
  }, [soloActivas, estadoNotif]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function ejecutar(clave: string, accion: () => Promise<string>) {
    setOcupado(clave);
    setError('');
    setOk('');
    try {
      setOk(await accion());
      await cargar();
    } catch (e) {
      setError(detalleDe(e, 'No se pudo completar la operación.'));
    } finally {
      setOcupado('');
    }
  }

  const detectar = () =>
    ejecutar('detectar', async () => {
      const creadas = await api.detectarFallasMasivas();
      return creadas.length === 0
        ? 'Detección completada: no hay nuevas concentraciones que superen el umbral.'
        : `Detección completada: ${creadas.length} falla(s) masiva(s) nueva(s).`;
    });

  const procesar = () =>
    ejecutar('procesar', async () => {
      const r = await api.procesarOutbox();
      return (
        `Outbox procesado: ${r.enviadas} enviada(s), ${r.diferidas} diferida(s) ` +
        `y ${r.fallidas} fallida(s) de ${r.intentadas} intento(s).`
      );
    });

  const cambiarEstado = (falla: FallaMasivaOut, estado: EstadoFallaMasiva) =>
    ejecutar(`estado-${falla.id_falla}`, async () => {
      await api.actualizarFallaMasiva(falla.id_falla, { estado });
      return `Falla #${falla.id_falla} actualizada a ${estado}.`;
    });

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Alertas</h1>
          <p>
            Fallas masivas, bot de Telegram y bandeja de notificaciones con reintentos
            (Ciclo 9).
          </p>
        </div>
        <div className="acciones-form">
          <button
            type="button"
            className="btn"
            onClick={() => void detectar()}
            disabled={soloLectura || ocupado !== ''}
          >
            <IconoFalla width={17} height={17} /> {ocupado === 'detectar' ? 'Detectando…' : 'Detectar fallas'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setModalManual(true)}
            disabled={soloLectura}
          >
            Reportar falla
          </button>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {/* Alertas Diarias (RNF-19) */}
      <div className="panel-bloque">
        <h2>
          <IconoAlertas width={18} height={18} /> Alertas Diarias
        </h2>
        {metricas ? (
          <>
            <div className="rejilla-tarjetas">
              <div className="tarjeta">
                <div className="valor">{metricas.fallas_activas}</div>
                <div className="etiqueta">Fallas activas</div>
              </div>
              <div className="tarjeta">
                <div className="valor">{metricas.notificaciones_pendientes}</div>
                <div className="etiqueta">Notificaciones pendientes</div>
              </div>
              <div className="tarjeta">
                <div className="valor">{metricas.notificaciones_enviadas}</div>
                <div className="etiqueta">Notificaciones enviadas</div>
              </div>
              <div className="tarjeta">
                <div className="valor">{metricas.notificaciones_fallidas}</div>
                <div className="etiqueta">Notificaciones fallidas</div>
              </div>
              <div className="tarjeta">
                <div className="valor">{metricas.casos_total}</div>
                <div className="etiqueta">Casos totales</div>
              </div>
            </div>
            <div className="lista-clave-valor">
              <div>
                <span className="texto-pequeno">Canal Telegram</span>{' '}
                <strong>
                  {metricas.canales_configurados.telegram ? 'configurado' : 'sin configurar'}
                </strong>
              </div>
              <div>
                <span className="texto-pequeno">Canal correo</span>{' '}
                <strong>
                  {metricas.canales_configurados.correo ? 'configurado' : 'sin configurar'}
                </strong>
              </div>
            </div>
          </>
        ) : (
          <p className="vacio">Sin métricas disponibles.</p>
        )}
      </div>

      {/* Fallas masivas (RF-09, RF-16, RF-17, RF-18) */}
      <div className="panel-bloque">
        <h2>Fallas masivas</h2>
        <div className="acciones-form">
          <label className="casilla-fila">
            <input
              type="checkbox"
              checked={soloActivas}
              onChange={(e) => setSoloActivas(e.target.checked)}
            />
            Mostrar solo activas (DETECTADA / PLANIFICADA)
          </label>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void cargar()}
            disabled={cargando}
          >
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {fallas.length === 0 ? (
          <p className="vacio">No hay fallas masivas que mostrar.</p>
        ) : (
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Origen</th>
                  <th>Concentración</th>
                  <th>Descripción</th>
                  <th>Sector</th>
                  <th>Cuadrilla</th>
                  <th>Estado</th>
                  <th>Detectada</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {fallas.map((f) => (
                  <tr key={f.id_falla}>
                    <td className="mono">{f.id_falla}</td>
                    <td>{f.origen}</td>
                    <td className="mono">{txt(f.clave_concentracion)}</td>
                    <td>
                      {f.descripcion}
                      {f.planificacion && (
                        <div className="texto-pequeno">Plan: {f.planificacion}</div>
                      )}
                      {f.reporte_simple && (
                        <div className="texto-pequeno">Reporte: {f.reporte_simple}</div>
                      )}
                    </td>
                    <td>{txt(f.id_sector)}</td>
                    <td>{txt(f.id_cuadrilla)}</td>
                    <td>
                      <span className={`chip-estado ${claseEstado(f.estado)}`}>{f.estado}</span>
                    </td>
                    <td>{fechaHora(f.fecha_deteccion)}</td>
                    <td>
                      <div className="acciones-fila">
                        <button
                          type="button"
                          className="btn btn-mini btn-secundario"
                          onClick={() => setPlanificar(f)}
                          disabled={soloLectura}
                        >
                          Planificar
                        </button>
                        <button
                          type="button"
                          className="btn btn-mini btn-secundario"
                          onClick={() => setMaterial(f)}
                          disabled={soloLectura}
                        >
                          Material
                        </button>
                        <select
                          value={f.estado}
                          disabled={soloLectura || ocupado === `estado-${f.id_falla}`}
                          onChange={(e) =>
                            void cambiarEstado(f, e.target.value as EstadoFallaMasiva)
                          }
                          aria-label={`Estado de la falla ${f.id_falla}`}
                        >
                          {ESTADOS_FALLA.map((estado) => (
                            <option key={estado} value={estado}>
                              {estado}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <PieTabla
                colSpan={9}
                total={fallas.length}
                singular="falla"
                plural="fallas"
                cargando={cargando}
              />
            </table>
          </div>
        )}
      </div>

      {/* Outbox de notificaciones (RNF-20) */}
      <div className="panel-bloque">
        <h2>
          <IconoTelegram width={18} height={18} /> Bandeja de notificaciones
        </h2>
        <div className="acciones-form">
          <div className="campo">
            <label htmlFor="notif-estado">Estado</label>
            <select
              id="notif-estado"
              value={estadoNotif}
              onChange={(e) => setEstadoNotif(e.target.value)}
            >
              <option value="">Todos</option>
              {ESTADOS_NOTIFICACION.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => void procesar()}
            disabled={soloLectura || ocupado !== ''}
          >
            {ocupado === 'procesar' ? 'Procesando…' : 'Procesar outbox'}
          </button>
        </div>

        {notificaciones.length === 0 ? (
          <p className="vacio">La bandeja de notificaciones está vacía.</p>
        ) : (
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Canal</th>
                  <th>Destinatario</th>
                  <th>Asunto</th>
                  <th>Estado</th>
                  <th>Intentos</th>
                  <th>Próximo intento</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {notificaciones.map((n) => (
                  <tr key={n.id_notificacion}>
                    <td className="mono">{n.id_notificacion}</td>
                    <td>{n.canal}</td>
                    <td className="mono">{txt(n.destinatario)}</td>
                    <td>
                      {txt(n.asunto)}
                      {n.cuerpo && <div className="texto-pequeno">{n.cuerpo}</div>}
                    </td>
                    <td>
                      <span className={`chip-estado ${claseEstado(n.estado)}`}>{n.estado}</span>
                    </td>
                    <td>{n.intentos ?? 0}</td>
                    <td>{fechaHora(n.proximo_intento)}</td>
                    <td className="texto-pequeno">{txt(n.error)}</td>
                  </tr>
                ))}
              </tbody>
              <PieTabla
                colSpan={8}
                total={notificaciones.length}
                singular="notificación"
                plural="notificaciones"
                cargando={cargando}
              />
            </table>
          </div>
        )}
      </div>

      {modalManual && (
        <ModalManual
          onCerrar={() => setModalManual(false)}
          onListo={(texto) => {
            setModalManual(false);
            setOk(texto);
            void cargar();
          }}
        />
      )}

      {planificar && (
        <ModalPlanificacion
          falla={planificar}
          onCerrar={() => setPlanificar(null)}
          onListo={(texto) => {
            setPlanificar(null);
            setOk(texto);
            void cargar();
          }}
        />
      )}

      {material && (
        <ModalMaterial
          falla={material}
          onCerrar={() => setMaterial(null)}
          onListo={(texto) => {
            setMaterial(null);
            setOk(texto);
            void cargar();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Formularios flotantes                                               */
/* ------------------------------------------------------------------ */

function ModalManual({
  onCerrar,
  onListo,
}: {
  onCerrar: () => void;
  onListo: (texto: string) => void;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [idSector, setIdSector] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const falla = await api.reportarFallaManual({
        descripcion: descripcion.trim(),
        id_sector: idSector === '' ? null : Number(idSector),
        origen: 'REPORTE_TECNICO',
      });
      onListo(`Falla masiva #${falla.id_falla} registrada y alerta encolada.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo registrar la falla.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Reportar falla masiva" onCerrar={onCerrar}>
      <form className="formulario modal-formulario" onSubmit={(e) => void enviar(e)}>
        <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
        <div className="campo campo-ancho">
          <label htmlFor="falla-descripcion">Descripción *</label>
          <textarea
            id="falla-descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
            minLength={5}
            maxLength={500}
            rows={3}
            placeholder="Ej.: corte total de fibra en el sector Alfa, 20 servicios afectados"
          />
        </div>
        <div className="campo">
          <label htmlFor="falla-sector">Sector (opcional)</label>
          <input
            id="falla-sector"
            type="number"
            min={1}
            value={idSector}
            onChange={(e) => setIdSector(e.target.value)}
            placeholder="Id del sector"
          />
        </div>
        <div className="acciones-form">
          <button type="submit" className="btn" disabled={enviando}>
            {enviando ? 'Registrando…' : 'Registrar falla'}
          </button>
          <button type="button" className="btn btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalPlanificacion({
  falla,
  onCerrar,
  onListo,
}: {
  falla: FallaMasivaOut;
  onCerrar: () => void;
  onListo: (texto: string) => void;
}) {
  const [planificacion, setPlanificacion] = useState(falla.planificacion ?? '');
  const [reporte, setReporte] = useState(falla.reporte_simple ?? '');
  const [evidencias, setEvidencias] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const lista = evidencias
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.planificarFallaMasiva(falla.id_falla, {
        planificacion: planificacion.trim(),
        reporte_simple: reporte.trim() || null,
        evidencias: lista,
      });
      onListo(`Planificación de la falla #${falla.id_falla} guardada (RF-17).`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo guardar la planificación.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={`Planificar falla #${falla.id_falla}`} onCerrar={onCerrar}>
      <form className="formulario modal-formulario" onSubmit={(e) => void enviar(e)}>
        <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
        <div className="campo campo-ancho">
          <label htmlFor="plan-texto">Planificación *</label>
          <textarea
            id="plan-texto"
            value={planificacion}
            onChange={(e) => setPlanificacion(e.target.value)}
            required
            minLength={5}
            maxLength={2000}
            rows={3}
            placeholder="Ej.: cuadrilla 1 a las 8:00 con fusionadora y 100 m de fibra"
          />
        </div>
        <div className="campo campo-ancho">
          <label htmlFor="plan-reporte">Reporte simple</label>
          <textarea
            id="plan-reporte"
            value={reporte}
            onChange={(e) => setReporte(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Resumen de la atención para el reporte"
          />
        </div>
        <div className="campo campo-ancho">
          <label htmlFor="plan-evidencias">Evidencias (separadas por coma)</label>
          <input
            id="plan-evidencias"
            value={evidencias}
            onChange={(e) => setEvidencias(e.target.value)}
            placeholder="Seriales o rutas: IMG-001, IMG-002"
          />
        </div>
        <div className="acciones-form">
          <button type="submit" className="btn" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar planificación'}
          </button>
          <button type="button" className="btn btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalMaterial({
  falla,
  onCerrar,
  onListo,
}: {
  falla: FallaMasivaOut;
  onCerrar: () => void;
  onListo: (texto: string) => void;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const orden = await api.solicitarMaterialFalla(falla.id_falla, {
        descripcion: descripcion.trim(),
      });
      onListo(`Orden de material #${orden.id_orden} creada para la falla #${falla.id_falla} (RF-18).`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo solicitar el material.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={`Material para la falla #${falla.id_falla}`} onCerrar={onCerrar}>
      <form className="formulario modal-formulario" onSubmit={(e) => void enviar(e)}>
        <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
        <div className="campo campo-ancho">
          <label htmlFor="mat-descripcion">Material requerido *</label>
          <textarea
            id="mat-descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
            minLength={3}
            maxLength={500}
            rows={2}
            placeholder="Ej.: 50 m de fibra y 4 conectores SC/APC"
          />
        </div>
        <div className="acciones-form">
          <button type="submit" className="btn" disabled={enviando}>
            {enviando ? 'Solicitando…' : 'Solicitar material'}
          </button>
          <button type="button" className="btn btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
