import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import * as api from '../api/client';
import type {
  CanalDespacho,
  CasoAsignadoOut,
  DespachoDetalleOut,
  EnvioOut,
  EstadoDespachoCaso,
  EstadoDespacho,
  FallaMasivaOut,
  NotificacionOut,
  OrigenFallaMasiva,
  PropuestaOut,
  ReporteProduccionOut,
  TipoAsignacionDespacho,
} from '../api/types';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';
import { fecha } from '../utils';

const ESTADOS_CASO: EstadoDespachoCaso[] = [
  'ASIGNADO',
  'GESTIONADO',
  'CERRADO',
  'CITADO',
  'DIFERIDO',
];

const TIPOS_ASIGNACION: TipoAsignacionDespacho[] = [
  'REPARACION',
  'CONSTRUCCION',
  'REFERIDO',
  'EMPRESA',
  'FALLA_MASIVA',
];

const ORIGENES_FALLA = ['REPORTE_TECNICO', 'AUTOMATICA', 'MCP'];

const TOTALES_ETIQUETAS: { clave: string; etiqueta: string }[] = [
  { clave: 'asignados', etiqueta: 'Asignados' },
  { clave: 'cerrados', etiqueta: 'Cerrados' },
  { clave: 'citados', etiqueta: 'Citados' },
  { clave: 'diferidos', etiqueta: 'Diferidos' },
  { clave: 'gestionados', etiqueta: 'Gestionados' },
  { clave: 'referidos', etiqueta: 'Referidos' },
  { clave: 'empresas', etiqueta: 'Empresas' },
];

interface FallaForm {
  descripcion: string;
  id_sector: string;
  origen: string;
}

const FALLA_VACIA: FallaForm = { descripcion: '', id_sector: '', origen: 'REPORTE_TECNICO' };

function hoyISO(): string {
  const ahora = new Date();
  const desfase = ahora.getTimezoneOffset() * 60000;
  return new Date(ahora.getTime() - desfase).toISOString().slice(0, 10);
}

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

function fechaHora(valor: string | null): string {
  return valor ? valor.replace('T', ' ').slice(0, 19) : '—';
}

function num(valor: unknown): number {
  return typeof valor === 'number' ? valor : 0;
}

function txt(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  return String(valor);
}

/** Regla booleana de la propuesta (`true`/`false`); `undefined` si no aplica. */
function reglaBooleana(reglas: Record<string, unknown>, clave: string): boolean | undefined {
  const valor = reglas[clave];
  return typeof valor === 'boolean' ? valor : undefined;
}

function TablaCasosAsignados({ casos }: { casos: CasoAsignadoOut[] }) {
  if (casos.length === 0) return <p className="vacio">Sin casos asignados.</p>;
  return (
    <div className="tabla-envoltura">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>ID avería</th>
            <th>Sector</th>
            <th>Dirección</th>
            <th>Cliente</th>
            <th>Teléfono</th>
            <th>Tipo asignación</th>
            <th>¿Cita?</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {casos.map((c) => (
            <tr key={c.id_caso}>
              <td>{c.orden_visita}</td>
              <td className="mono">{c.id_averia}</td>
              <td>{c.sector_nombre ?? c.id_sector ?? '—'}</td>
              <td>{c.direccion ?? '—'}</td>
              <td>{c.nombre_cliente ?? '—'}</td>
              <td>{c.telefono ?? '—'}</td>
              <td>{c.tipo_asignacion}</td>
              <td>{c.es_cita ? 'Sí' : 'No'}</td>
              <td>{c.estado_actual}</td>
            </tr>
          ))}
        </tbody>
        <PieTabla colSpan={9} total={casos.length} singular="caso" plural="casos" />
      </table>
    </div>
  );
}

function FilaDesglose({ fila }: { fila: Record<string, unknown> }) {
  return (
    <tr>
      <td>{txt(fila.cuadrilla)}</td>
      <td>{txt(fila.nombre)}</td>
      <td>{num(fila.asignados)}</td>
      <td>{num(fila.cerrados)}</td>
      <td>{num(fila.citados)}</td>
      <td>{num(fila.diferidos)}</td>
      <td>{num(fila.gestionados)}</td>
      <td>{num(fila.referidos)}</td>
      <td>{num(fila.empresas)}</td>
    </tr>
  );
}

function Reporte({ titulo, reporte }: { titulo: string; reporte: ReporteProduccionOut }) {
  return (
    <div className="subpanel">
      <h3>
        {titulo} — {fecha(reporte.fecha)}
      </h3>
      <div className="rejilla-tarjetas">
        {TOTALES_ETIQUETAS.map((t) => (
          <div className="tarjeta" key={t.clave}>
            <div className="valor">{num(reporte.totales[t.clave])}</div>
            <div className="etiqueta">{t.etiqueta}</div>
          </div>
        ))}
      </div>
      {reporte.por_cuadrilla.length === 0 ? (
        <p className="vacio">Sin producción registrada.</p>
      ) : (
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>Cuadrilla</th>
                <th>Nombre</th>
                <th>Asignados</th>
                <th>Cerrados</th>
                <th>Citados</th>
                <th>Diferidos</th>
                <th>Gestionados</th>
                <th>Referidos</th>
                <th>Empresas</th>
              </tr>
            </thead>
            <tbody>
              {reporte.por_cuadrilla.map((fila, indice) => (
                <FilaDesglose key={`${txt(fila.cuadrilla)}-${indice}`} fila={fila} />
              ))}
            </tbody>
            <PieTabla
              colSpan={9}
              total={reporte.por_cuadrilla.length}
              singular="cuadrilla"
              plural="cuadrillas"
            />
          </table>
        </div>
      )}
    </div>
  );
}

export default function Despacho() {
  const { soloLectura } = useAuth();

  const [fechaSel, setFechaSel] = useState(hoyISO());
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Propuesta (RF-24).
  const [propuesta, setPropuesta] = useState<PropuestaOut | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [generando, setGenerando] = useState(false);

  // Despachos del día.
  const [despachos, setDespachos] = useState<DespachoDetalleOut[]>([]);
  const [cargandoDespachos, setCargandoDespachos] = useState(false);

  // Detalle del despacho seleccionado.
  const [seleccionado, setSeleccionado] = useState<DespachoDetalleOut | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [nuevoCaso, setNuevoCaso] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<TipoAsignacionDespacho | ''>('');
  const [nuevaObservacion, setNuevaObservacion] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [modalAgregarCaso, setModalAgregarCaso] = useState(false);

  // Envío y notificaciones (RF-10).
  const [canal, setCanal] = useState<CanalDespacho>('TELEGRAM');
  const [destinatario, setDestinatario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [envio, setEnvio] = useState<EnvioOut | null>(null);
  const [notificaciones, setNotificaciones] = useState<NotificacionOut[]>([]);
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(false);

  // Reportes (RF-27).
  const [reporteGlobal, setReporteGlobal] = useState<ReporteProduccionOut | null>(null);
  const [reporteSel, setReporteSel] = useState<ReporteProduccionOut | null>(null);

  // Fallas masivas (RF-09).
  const [fallas, setFallas] = useState<FallaMasivaOut[]>([]);
  const [cargandoFallas, setCargandoFallas] = useState(true);
  const [fallaForm, setFallaForm] = useState<FallaForm>(FALLA_VACIA);
  const [creandoFalla, setCreandoFalla] = useState(false);
  const [modalFalla, setModalFalla] = useState(false);

  const cargarDespachos = useCallback(async () => {
    setCargandoDespachos(true);
    try {
      const lista = await api.listarDespachos({ fecha: fechaSel });
      setDespachos(lista);
      setError('');
    } catch (e) {
      setDespachos([]);
      setError(detalleDe(e, 'Error al listar los despachos del día.'));
    } finally {
      setCargandoDespachos(false);
    }
  }, [fechaSel]);

  const cargarReporteGlobal = useCallback(async () => {
    try {
      setReporteGlobal(await api.reporteProduccion(fechaSel));
    } catch (e) {
      setReporteGlobal(null);
      setError(detalleDe(e, 'Error al obtener el reporte de producción.'));
    }
  }, [fechaSel]);

  const cargarFallas = useCallback(async () => {
    setCargandoFallas(true);
    try {
      setFallas(await api.listarFallasMasivas());
    } catch (e) {
      setFallas([]);
      setError(detalleDe(e, 'Error al listar las fallas masivas.'));
    } finally {
      setCargandoFallas(false);
    }
  }, []);

  useEffect(() => {
    void cargarDespachos();
    void cargarReporteGlobal();
  }, [cargarDespachos, cargarReporteGlobal]);

  useEffect(() => {
    void cargarFallas();
  }, [cargarFallas]);

  // Al cambiar de fecha se descarta la propuesta y el detalle anteriores.
  useEffect(() => {
    setPropuesta(null);
    setSeleccionado(null);
    setModalAgregarCaso(false);
    setEnvio(null);
    setNotificaciones([]);
    setReporteSel(null);
  }, [fechaSel]);

  const cargarNotificaciones = useCallback(async (idDespacho: number) => {
    setCargandoNotificaciones(true);
    try {
      setNotificaciones(await api.listarNotificaciones(idDespacho));
    } catch (e) {
      setNotificaciones([]);
      setError(detalleDe(e, 'Error al listar las notificaciones del despacho.'));
    } finally {
      setCargandoNotificaciones(false);
    }
  }, []);

  const abrirDetalle = useCallback(
    async (idDespacho: number) => {
      setCargandoDetalle(true);
      setError('');
      setOk('');
      setEnvio(null);
      setModalAgregarCaso(false);
      try {
        const detalle = await api.obtenerDespacho(idDespacho);
        setSeleccionado(detalle);
        void cargarNotificaciones(idDespacho);
        try {
          setReporteSel(await api.reporteDespacho(idDespacho));
        } catch {
          setReporteSel(null);
        }
      } catch (e) {
        setSeleccionado(null);
        setError(detalleDe(e, 'Error al obtener el detalle del despacho.'));
      } finally {
        setCargandoDetalle(false);
      }
    },
    [cargarNotificaciones],
  );

  /** Cierra la ficha flotante del despacho (y cualquier modal dependiente). */
  function cerrarDetalle() {
    setSeleccionado(null);
    setModalAgregarCaso(false);
  }

  /** Abre el formulario flotante para agregar un caso al despacho abierto. */
  function abrirModalAgregarCaso() {
    setError('');
    setOk('');
    setModalAgregarCaso(true);
  }

  /** Refresca la lista del día y, si se indica, el detalle abierto. */
  const refrescar = useCallback(
    async (idDespacho?: number) => {
      await cargarDespachos();
      if (idDespacho !== undefined) await abrirDetalle(idDespacho);
    },
    [cargarDespachos, abrirDetalle],
  );

  async function simular(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    setSimulando(true);
    try {
      setPropuesta(await api.simularPropuesta(fechaSel));
      setOk('Propuesta simulada. No se guardó ningún despacho.');
    } catch (e) {
      setPropuesta(null);
      setError(detalleDe(e, 'Error al simular la propuesta de despacho.'));
    } finally {
      setSimulando(false);
    }
  }

  async function generar(reemplazar: boolean) {
    setError('');
    setOk('');
    if (
      !reemplazar &&
      !window.confirm(
        `¿Generar y guardar el despacho del ${fechaSel}? Si ya existe se rechazará la operación.`,
      )
    ) {
      return;
    }
    setGenerando(true);
    try {
      const creados = await api.generarDespacho(fechaSel, reemplazar);
      setOk(
        reemplazar
          ? `Despacho regenerado: ${creados.length} cuadrilla(s).`
          : `Despacho generado: ${creados.length} cuadrilla(s).`,
      );
      setPropuesta(null);
      await refrescar();
      if (creados.length > 0) await abrirDetalle(creados[0].id_despacho);
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 409 && !reemplazar) {
        const confirmar = window.confirm(
          `${e.message}\n\n¿Desea reemplazar los borradores existentes y volver a generar?`,
        );
        if (confirmar) {
          setGenerando(false);
          await generar(true);
          return;
        }
      }
      setError(detalleDe(e, 'Error al generar el despacho.'));
    } finally {
      setGenerando(false);
    }
  }

  async function cambiarEstadoDespacho(estado: EstadoDespacho) {
    if (!seleccionado) return;
    setError('');
    setOk('');
    setOcupado(true);
    try {
      const actualizado = await api.actualizarDespacho(seleccionado.id_despacho, { estado });
      setSeleccionado(actualizado);
      setOk(`Despacho #${actualizado.id_despacho} marcado como ${estado}.`);
      await refrescar(actualizado.id_despacho);
    } catch (e) {
      setError(detalleDe(e, 'Error al actualizar el estado del despacho.'));
    } finally {
      setOcupado(false);
    }
  }

  async function agregarCaso(evento: FormEvent) {
    evento.preventDefault();
    if (!seleccionado) return;
    setError('');
    setOk('');
    const idCaso = Number(nuevoCaso.trim());
    if (!Number.isInteger(idCaso) || idCaso <= 0) {
      setError('Indique un ID de caso numérico válido.');
      return;
    }
    setAgregando(true);
    try {
      const actualizado = await api.agregarCasoDespacho(seleccionado.id_despacho, {
        id_caso: idCaso,
        tipo_asignacion: nuevoTipo || undefined,
        observacion: nuevaObservacion.trim() || undefined,
      });
      setSeleccionado(actualizado);
      setNuevoCaso('');
      setNuevoTipo('');
      setNuevaObservacion('');
      setModalAgregarCaso(false);
      setOk('Caso agregado al despacho.');
      await refrescar(actualizado.id_despacho);
    } catch (e) {
      setError(detalleDe(e, 'Error al agregar el caso al despacho.'));
    } finally {
      setAgregando(false);
    }
  }

  async function quitarCaso(idCaso: number) {
    if (!seleccionado) return;
    if (!window.confirm(`¿Quitar el caso #${idCaso} del despacho?`)) return;
    setError('');
    setOk('');
    setOcupado(true);
    try {
      const actualizado = await api.quitarCasoDespacho(seleccionado.id_despacho, idCaso);
      setSeleccionado(actualizado);
      setOk('Caso quitado del despacho.');
      await refrescar(actualizado.id_despacho);
    } catch (e) {
      setError(detalleDe(e, 'Error al quitar el caso del despacho.'));
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarEstadoCaso(idCaso: number, estado: EstadoDespachoCaso) {
    if (!seleccionado) return;
    setError('');
    setOk('');
    setOcupado(true);
    try {
      const actualizado = await api.actualizarCasoDespacho(seleccionado.id_despacho, idCaso, {
        estado,
      });
      setSeleccionado(actualizado);
      setOk(`Caso #${idCaso} marcado como ${estado}.`);
      await refrescar(actualizado.id_despacho);
    } catch (e) {
      setError(detalleDe(e, 'Error al cambiar el estado del caso.'));
    } finally {
      setOcupado(false);
    }
  }

  async function imprimir(idDespacho: number) {
    setError('');
    setOk('');
    try {
      const html = await api.obtenerImprimible(idDespacho);
      const ventana = window.open('', '_blank');
      if (!ventana) {
        setError('El navegador bloqueó la pestaña emergente; permita las ventanas emergentes.');
        return;
      }
      ventana.document.open();
      ventana.document.write(html);
      ventana.document.close();
    } catch (e) {
      setError(detalleDe(e, 'Error al obtener la ficha imprimible.'));
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!seleccionado) return;
    setError('');
    setOk('');
    setEnviando(true);
    try {
      const resultado = await api.enviarDespacho(
        seleccionado.id_despacho,
        canal,
        destinatario.trim() || undefined,
      );
      setEnvio(resultado);
      await cargarNotificaciones(seleccionado.id_despacho);
      await refrescar(seleccionado.id_despacho);
    } catch (e) {
      setEnvio(null);
      setError(detalleDe(e, 'Error al enviar el despacho.'));
    } finally {
      setEnviando(false);
    }
  }

  async function reportarFalla(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    const descripcion = fallaForm.descripcion.trim();
    if (!descripcion) {
      setError('Indique la descripción de la falla masiva.');
      return;
    }
    const sector = fallaForm.id_sector.trim();
    setCreandoFalla(true);
    try {
      await api.crearFallaMasiva({
        descripcion,
        id_sector: sector ? Number(sector) : null,
        origen: fallaForm.origen as OrigenFallaMasiva,
      });
      setFallaForm(FALLA_VACIA);
      setModalFalla(false);
      setOk('Falla masiva registrada.');
      await cargarFallas();
    } catch (e) {
      setError(detalleDe(e, 'Error al registrar la falla masiva.'));
    } finally {
      setCreandoFalla(false);
    }
  }

  const minReferidosIncumplido = propuesta
    ? reglaBooleana(propuesta.reglas, 'cumple_min_referidos') === false
    : false;
  const minEmpresasIncumplido = propuesta
    ? reglaBooleana(propuesta.reglas, 'cumple_min_empresas') === false
    : false;
  const construccionMultiple = propuesta
    ? reglaBooleana(propuesta.reglas, 'construccion_en_una_sola') === false
    : false;

  function encabezadoRegla(clave: string, etiqueta: string): ReactNode {
    if (!propuesta) return null;
    const valor = propuesta.reglas[clave];
    const alerta =
      (clave === 'construccion_en_una_sola' && valor === false) ||
      (clave === 'cumple_min_referidos' && valor === false) ||
      (clave === 'cumple_min_empresas' && valor === false);
    return (
      <span className={`chip-regla${alerta ? ' regla-alerta' : ''}`} key={clave}>
        {etiqueta}: <strong>{txt(valor)}</strong>
      </span>
    );
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Despacho</h1>
          <p>Propuesta, generación, seguimiento, impresión y envío del despacho diario.</p>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {soloLectura && (
        <div className="aviso aviso-info">
          <span>
            Modo solo lectura: su rol TECNICO no permite simular, generar, editar ni enviar
            despachos. Puede consultar la información y los reportes.
          </span>
        </div>
      )}

      {/* Fecha + acciones principales */}
      <div className="panel-bloque">
        <h2>Jornada</h2>
        <form className="formulario" onSubmit={(e) => void simular(e)}>
          <div className="campo">
            <label htmlFor="despacho-fecha">Fecha</label>
            <input
              id="despacho-fecha"
              type="date"
              value={fechaSel}
              onChange={(e) => setFechaSel(e.target.value)}
            />
          </div>
          {!soloLectura && (
            <div className="acciones-form">
              <button type="submit" className="btn btn-secundario" disabled={simulando}>
                {simulando ? 'Simulando…' : 'Simular propuesta'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void generar(false)}
                disabled={generando}
              >
                {generando ? 'Generando…' : 'Generar despacho'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Propuesta */}
      {propuesta && (
        <div className="panel-bloque">
          <div className="pagina-cabecera">
            <h2>Propuesta del {fecha(propuesta.fecha)}</h2>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setPropuesta(null)}
            >
              Cerrar propuesta
            </button>
          </div>

          {(construccionMultiple || minReferidosIncumplido || minEmpresasIncumplido) && (
            <div className="aviso aviso-info">
              <span>
                Atención a las reglas:{' '}
                {construccionMultiple && 'la construcción no queda en una sola cuadrilla. '}
                {minReferidosIncumplido && 'no se cumple el mínimo de referidos. '}
                {minEmpresasIncumplido && 'no se cumple el mínimo de empresas.'}
              </span>
            </div>
          )}

          <div className="rejilla-mini">
            <div className="subpanel">
              <h3>Resumen</h3>
              <div className="lista-clave-valor">
                {Object.entries(propuesta.resumen).map(([clave, valor]) => (
                  <div key={clave}>
                    <span className="texto-pequeno">{clave}</span>{' '}
                    <strong>{txt(valor)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="subpanel">
              <h3>Reglas</h3>
              <div className="lista-reglas">
                {encabezadoRegla('construccion_en_una_sola', 'construccion_en_una_sola')}
                {encabezadoRegla('cumple_min_referidos', 'cumple_min_referidos')}
                {encabezadoRegla('cumple_min_empresas', 'cumple_min_empresas')}
                {encabezadoRegla('referidos_asignados', 'referidos_asignados')}
                {encabezadoRegla('min_referidos', 'min_referidos')}
                {encabezadoRegla('empresas_asignadas', 'empresas_asignadas')}
                {encabezadoRegla('min_empresas', 'min_empresas')}
                {encabezadoRegla('cuadrillas_activas', 'cuadrillas_activas')}
              </div>
            </div>
          </div>

          {propuesta.grupos.length === 0 ? (
            <p className="vacio">La propuesta no asignó casos a ninguna cuadrilla.</p>
          ) : (
            propuesta.grupos.map((grupo) => (
              <div className="subpanel" key={grupo.id_cuadrilla}>
                <h3>
                  {grupo.codigo} — {grupo.nombre}{' '}
                  <span className="chip">{grupo.total} caso(s)</span>
                </h3>
                <TablaCasosAsignados casos={grupo.casos} />
              </div>
            ))
          )}

          {propuesta.sin_asignar.length > 0 && (
            <div className="subpanel">
              <h3>Sin asignar ({propuesta.sin_asignar.length})</h3>
              <TablaCasosAsignados casos={propuesta.sin_asignar} />
            </div>
          )}
        </div>
      )}

      {/* Despachos del día */}
      <div className="panel-bloque">
        <div className="pagina-cabecera">
          <h2>Despachos del {fecha(fechaSel)}</h2>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void cargarDespachos()}
            disabled={cargandoDespachos}
          >
            {cargandoDespachos ? 'Cargando…' : 'Recargar'}
          </button>
        </div>
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>Despacho</th>
                <th>Cuadrilla</th>
                <th>Estado</th>
                <th>Casos</th>
                <th>Canal de envío</th>
                <th>Generado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargandoDespachos ? (
                <tr>
                  <td colSpan={7} className="vacio">
                    Cargando…
                  </td>
                </tr>
              ) : despachos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="vacio">
                    No hay despachos para esa fecha.
                  </td>
                </tr>
              ) : (
                despachos.map((d) => (
                  <tr key={d.id_despacho}>
                    <td>#{d.id_despacho}</td>
                    <td>
                      {d.cuadrilla_codigo ?? d.id_cuadrilla}
                      {d.cuadrilla_nombre ? ` — ${d.cuadrilla_nombre}` : ''}
                    </td>
                    <td>{d.estado}</td>
                    <td>{d.casos.length}</td>
                    <td>{d.enviado_canal ?? '—'}</td>
                    <td>{d.generado_auto ? 'Automático' : 'Manual'}</td>
                    <td>
                      <div className="celda-acciones">
                        <button
                          type="button"
                          className="btn btn-mini btn-secundario"
                          onClick={() => void abrirDetalle(d.id_despacho)}
                          disabled={cargandoDetalle}
                        >
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          className="btn btn-mini btn-secundario"
                          onClick={() => void imprimir(d.id_despacho)}
                        >
                          Imprimir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <PieTabla
              colSpan={7}
              total={despachos.length}
              singular="despacho"
              plural="despachos"
              cargando={cargandoDespachos}
            />
          </table>
        </div>
      </div>

      {/* Detalle del despacho, en ventana flotante */}
      {seleccionado && (
        <Modal
          titulo={`Detalle del despacho #${seleccionado.id_despacho} — ${
            seleccionado.cuadrilla_codigo ?? seleccionado.id_cuadrilla
          }`}
          onCerrar={cerrarDetalle}
        >

          <div className="tabla-envoltura">
            <table className="tabla-ficha">
              <tbody>
                <tr>
                  <th>Central</th>
                  <td>{seleccionado.id_central}</td>
                </tr>
                <tr>
                  <th>Fecha</th>
                  <td>{fecha(seleccionado.fecha)}</td>
                </tr>
                <tr>
                  <th>Cuadrilla</th>
                  <td>
                    {seleccionado.cuadrilla_codigo ?? '—'}
                    {seleccionado.cuadrilla_nombre ? ` — ${seleccionado.cuadrilla_nombre}` : ''}
                  </td>
                </tr>
                <tr>
                  <th>Estado</th>
                  <td>{seleccionado.estado}</td>
                </tr>
                <tr>
                  <th>Canal de envío</th>
                  <td>{seleccionado.enviado_canal ?? '—'}</td>
                </tr>
                <tr>
                  <th>Enviado en</th>
                  <td>{fechaHora(seleccionado.enviado_en)}</td>
                </tr>
                <tr>
                  <th>Generado por</th>
                  <td>{seleccionado.usuario_crea ?? '—'}</td>
                </tr>
                <tr>
                  <th>Casos</th>
                  <td>{seleccionado.casos.length}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {!soloLectura && (
            <div className="acciones-form">
              <button
                type="button"
                className="btn"
                onClick={() => void cambiarEstadoDespacho('PUBLICADO')}
                disabled={ocupado || seleccionado.estado === 'PUBLICADO'}
              >
                Publicar
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => void cambiarEstadoDespacho('CERRADO')}
                disabled={ocupado || seleccionado.estado === 'CERRADO'}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => void imprimir(seleccionado.id_despacho)}
              >
                Imprimir
              </button>
            </div>
          )}

          <div className="pagina-cabecera">
            <h3 className="subtitulo-seccion">Casos del despacho</h3>
            {!soloLectura && (
              <button type="button" className="btn" onClick={abrirModalAgregarCaso}>
                Agregar caso
              </button>
            )}
          </div>
          {seleccionado.casos.length === 0 ? (
            <p className="vacio">El despacho no tiene casos.</p>
          ) : (
            <div className="tabla-envoltura">
              <table>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>ID caso</th>
                    <th>Sector</th>
                    <th>Tipo asignación</th>
                    <th>Estado del caso</th>
                    <th>Observación</th>
                    {!soloLectura && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {seleccionado.casos.map((c) => (
                    <tr key={c.id_despacho_caso}>
                      <td>{c.orden_visita ?? '—'}</td>
                      <td className="mono">{c.id_caso}</td>
                      <td>{c.id_sector ?? '—'}</td>
                      <td>{c.tipo_asignacion ?? '—'}</td>
                      <td>
                        {soloLectura ? (
                          c.estado
                        ) : (
                          <select
                            value={c.estado}
                            disabled={ocupado}
                            onChange={(e) =>
                              void cambiarEstadoCaso(
                                c.id_caso,
                                e.target.value as EstadoDespachoCaso,
                              )
                            }
                          >
                            {ESTADOS_CASO.map((est) => (
                              <option key={est} value={est}>
                                {est}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{c.observacion ?? '—'}</td>
                      {!soloLectura && (
                        <td>
                          <button
                            type="button"
                            className="btn btn-mini btn-peligro"
                            onClick={() => void quitarCaso(c.id_caso)}
                            disabled={ocupado}
                          >
                            Quitar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <PieTabla
                  colSpan={soloLectura ? 6 : 7}
                  total={seleccionado.casos.length}
                  singular="caso"
                  plural="casos"
                />
              </table>
            </div>
          )}

          {/* Envío (RF-10) */}
          <h3 className="subtitulo-seccion">Envío</h3>
          {!soloLectura ? (
            <form className="formulario" onSubmit={(e) => void enviar(e)}>
              <div className="campo">
                <label htmlFor="despacho-canal">Canal</label>
                <select
                  id="despacho-canal"
                  value={canal}
                  onChange={(e) => setCanal(e.target.value as CanalDespacho)}
                >
                  <option value="TELEGRAM">TELEGRAM</option>
                  <option value="CORREO">CORREO</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="despacho-destino">Destinatario</label>
                <input
                  id="despacho-destino"
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                  placeholder="Vacío = destino configurado"
                />
              </div>
              <div className="acciones-form">
                <button type="submit" className="btn" disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </form>
          ) : (
            <p className="texto-pequeno">
              Su rol solo permite consultar el historial de notificaciones.
            </p>
          )}

          {envio && (
            <Mensaje
              tipo={envio.estado === 'FALLIDO' ? 'error' : 'ok'}
              texto={`Envío ${envio.canal}: ${envio.estado}${envio.error ? ` — ${envio.error}` : ''}`}
            />
          )}

          <h3 className="subtitulo-seccion">Notificaciones</h3>
          {cargandoNotificaciones ? (
            <p className="texto-pequeno">Cargando notificaciones…</p>
          ) : notificaciones.length === 0 ? (
            <p className="vacio">No hay notificaciones para este despacho.</p>
          ) : (
            <div className="tabla-envoltura">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Canal</th>
                    <th>Destinatario</th>
                    <th>Estado</th>
                    <th>Error</th>
                    <th>Enviado en</th>
                    <th>Creado en</th>
                  </tr>
                </thead>
                <tbody>
                  {notificaciones.map((n) => (
                    <tr key={n.id_notificacion}>
                      <td>{n.id_notificacion}</td>
                      <td>{n.canal}</td>
                      <td>{n.destinatario ?? '—'}</td>
                      <td>{n.estado}</td>
                      <td>{n.error ?? '—'}</td>
                      <td>{fechaHora(n.enviado_en)}</td>
                      <td>{fechaHora(n.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
                <PieTabla
                  colSpan={7}
                  total={notificaciones.length}
                  singular="notificación"
                  plural="notificaciones"
                />
              </table>
            </div>
          )}
        </Modal>
      )}

      {/* Agregar caso al despacho, en ventana flotante */}
      {seleccionado && !soloLectura && modalAgregarCaso && (
        <Modal titulo="Agregar caso" onCerrar={() => setModalAgregarCaso(false)}>
          <form className="formulario modal-formulario" onSubmit={(e) => void agregarCaso(e)}>
            <div className="campo">
              <label htmlFor="despacho-id-caso">ID de caso *</label>
              <input
                id="despacho-id-caso"
                type="number"
                min={1}
                value={nuevoCaso}
                onChange={(e) => setNuevoCaso(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="despacho-tipo">Tipo de asignación</label>
              <select
                id="despacho-tipo"
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value as TipoAsignacionDespacho | '')}
              >
                <option value="">(Automático)</option>
                {TIPOS_ASIGNACION.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="despacho-observacion">Observación</label>
              <input
                id="despacho-observacion"
                value={nuevaObservacion}
                onChange={(e) => setNuevaObservacion(e.target.value)}
              />
            </div>
            <div className="acciones-form">
              <button type="submit" className="btn" disabled={agregando}>
                {agregando ? 'Agregando…' : 'Agregar caso'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reporte de producción (RF-27) */}
      <div className="panel-bloque">
        <div className="pagina-cabecera">
          <h2>Reporte de producción</h2>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void cargarReporteGlobal()}
          >
            Recargar
          </button>
        </div>
        {reporteGlobal ? (
          <Reporte titulo="Global del día" reporte={reporteGlobal} />
        ) : (
          <p className="vacio">Sin reporte global disponible.</p>
        )}
        {seleccionado &&
          (reporteSel ? (
            <Reporte titulo={`Del despacho #${seleccionado.id_despacho}`} reporte={reporteSel} />
          ) : (
            <p className="vacio">Sin reporte para el despacho seleccionado.</p>
          ))}
      </div>

      {/* Fallas masivas (RF-09) */}
      <div className="panel-bloque">
        <div className="pagina-cabecera">
          <h2>Fallas masivas</h2>
          {!soloLectura && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setError('');
                setOk('');
                setModalFalla(true);
              }}
            >
              Registrar falla
            </button>
          )}
        </div>

        {!soloLectura && modalFalla && (
          <Modal titulo="Registrar falla" onCerrar={() => setModalFalla(false)}>
            <form className="formulario modal-formulario" onSubmit={(e) => void reportarFalla(e)}>
              <div className="campo campo-ancho">
                <label htmlFor="falla-descripcion">Descripción *</label>
                <input
                  id="falla-descripcion"
                  value={fallaForm.descripcion}
                  onChange={(e) => setFallaForm({ ...fallaForm, descripcion: e.target.value })}
                  placeholder="Ej.: Corte de fibra sector Alfa"
                />
              </div>
              <div className="campo">
                <label htmlFor="falla-sector">ID de sector (opcional)</label>
                <input
                  id="falla-sector"
                  type="number"
                  min={1}
                  value={fallaForm.id_sector}
                  onChange={(e) => setFallaForm({ ...fallaForm, id_sector: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="falla-origen">Origen</label>
                <select
                  id="falla-origen"
                  value={fallaForm.origen}
                  onChange={(e) => setFallaForm({ ...fallaForm, origen: e.target.value })}
                >
                  {ORIGENES_FALLA.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="acciones-form">
                <button type="submit" className="btn" disabled={creandoFalla}>
                  {creandoFalla ? 'Registrando…' : 'Registrar falla'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        <h3 className="subtitulo-seccion">Registradas</h3>
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Central</th>
                <th>Descripción</th>
                <th>Detección</th>
                <th>Origen</th>
                <th>Sector</th>
                <th>Cuadrilla</th>
                <th>Estado</th>
                <th>Planificación</th>
              </tr>
            </thead>
            <tbody>
              {cargandoFallas ? (
                <tr>
                  <td colSpan={9} className="vacio">
                    Cargando…
                  </td>
                </tr>
              ) : fallas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="vacio">
                    No hay fallas masivas registradas.
                  </td>
                </tr>
              ) : (
                fallas.map((f) => (
                  <tr key={f.id_falla}>
                    <td>{f.id_falla}</td>
                    <td>{f.id_central}</td>
                    <td>{f.descripcion}</td>
                    <td>{fechaHora(f.fecha_deteccion)}</td>
                    <td>{f.origen}</td>
                    <td>{f.id_sector ?? '—'}</td>
                    <td>{f.id_cuadrilla ?? '—'}</td>
                    <td>{f.estado}</td>
                    <td>{f.planificacion ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
            <PieTabla
              colSpan={9}
              total={fallas.length}
              singular="falla"
              plural="fallas"
              cargando={cargandoFallas}
            />
          </table>
        </div>
      </div>
    </>
  );
}
