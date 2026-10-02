/**
 * Ficha de detalle del caso en pestañas (D-70, reorganizada en D-76).
 *
 * - Los datos se reparten por naturaleza: RESUMEN, CONTACTO, DATOS TÉCNICOS,
 *   CLASIFICACIÓN, TEXTOS, RESOLUCIÓN e HISTÓRICO.
 * - En PC cada pestaña muestra hasta **3 datos por línea**; en móvil cae a 1.
 * - La edición la activa el **icono de edición del título** y solo la ven
 *   ADMIN, SUPERVISOR y Super Usuario; se limita a **Sector** (el Supervisor
 *   puede asignarlo o cambiarlo), Fecha de cita e Información (200 caracteres).
 *   El bloque vive ahora en CLASIFICACIÓN: la pestaña GESTIÓN se eliminó.
 * - RESOLUCIÓN permite elegir CERRAR / CITA / ENRUTAR con su formulario.
 * - HISTÓRICO lista los casos relacionados por el teléfono del caso.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from '../api/client';
import type { CasoOut, CasoRelacionado, ModoCierre, Sector } from '../api/types';
import Mensaje from '../components/Mensaje';
import PieTabla from '../components/PieTabla';
import { fechaHora, nv } from '../utils';

export type Pestana =
  | 'resumen'
  | 'contacto'
  | 'tecnico'
  | 'clasificacion'
  | 'texto'
  | 'resolucion'
  | 'historico';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'contacto', etiqueta: 'Contacto' },
  { id: 'tecnico', etiqueta: 'Datos técnicos' },
  { id: 'clasificacion', etiqueta: 'Clasificación' },
  { id: 'texto', etiqueta: 'Textos' },
  { id: 'resolucion', etiqueta: 'Resolución' },
  { id: 'historico', etiqueta: 'Histórico' },
];

const MODOS_CIERRE: { valor: ModoCierre; etiqueta: string }[] = [
  { valor: 'IVR', etiqueta: 'Con IVR' },
  { valor: 'COS', etiqueta: 'Con COS' },
  { valor: 'SACAS', etiqueta: 'Con SACAS' },
];

const ACCION_RESOLUCION = [
  { valor: '', etiqueta: '— Seleccione una acción —' },
  { valor: 'CERRAR', etiqueta: 'CERRAR' },
  { valor: 'CITA', etiqueta: 'CITA' },
  { valor: 'ENRRUTAR', etiqueta: 'ENRRUTAR' },
];

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  const vacio = valor === null || valor === undefined || valor === '';
  return (
    <div className="dato">
      <span className="dato-etiqueta">{etiqueta}</span>
      <span className={`dato-valor${vacio ? ' vacio' : ''}`}>{vacio ? '—' : valor}</span>
    </div>
  );
}

export default function FichaCaso({
  caso,
  sectores,
  puedeEditar,
  puedeResolver,
  onActualizar,
  solicitudPestana,
  alActivarEdicion,
}: {
  caso: CasoOut;
  sectores: Sector[];
  puedeEditar: boolean;
  puedeResolver: boolean;
  onActualizar: (actualizado: CasoOut) => void;
  /** Señal del padre para saltar a una pestaña (el icono de edición del título). */
  solicitudPestana?: { id: Pestana; secuencia: number } | null;
  alActivarEdicion?: (activa: boolean) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [editando, setEditando] = useState(false);

  // Edición ligera: sector, fecha de cita e información (máx. 200 caracteres)
  const [sector, setSector] = useState<string>(caso.id_sector ? String(caso.id_sector) : '');
  const [fechaCita, setFechaCita] = useState<string>(
    caso.fecha_cita ? caso.fecha_cita.slice(0, 16) : '',
  );
  const [informacion, setInformacion] = useState<string>((caso.informacion ?? '').slice(0, 200));
  const [guardando, setGuardando] = useState(false);

  // Resolución
  const [accion, setAccion] = useState('');
  const [modo, setModo] = useState<ModoCierre>('COS');
  const [descripcion, setDescripcion] = useState('');
  const [evidencias, setEvidencias] = useState('');
  const [tipoCita, setTipoCita] = useState<'CONTACTO' | 'ATENCION'>('ATENCION');
  const [fechaCitaNueva, setFechaCitaNueva] = useState('');
  const [observacionCita, setObservacionCita] = useState('');
  const [destino, setDestino] = useState('');
  const [motivoEnrutado, setMotivoEnrutado] = useState('');
  const [ejecutando, setEjecutando] = useState(false);

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Histórico por teléfono
  const [relacionados, setRelacionados] = useState<CasoRelacionado[] | null>(null);
  const [cargandoRel, setCargandoRel] = useState(false);

  useEffect(() => {
    setSector(caso.id_sector ? String(caso.id_sector) : '');
    setFechaCita(caso.fecha_cita ? caso.fecha_cita.slice(0, 16) : '');
    setInformacion((caso.informacion ?? '').slice(0, 200));
    setEditando(false);
  }, [caso]);

  // El icono «Editar» del título abre CLASIFICACIÓN y habilita la edición.
  // Se reacciona a `secuencia` (no a la pestaña) para que pulsar de nuevo el
  // icono reabra el formulario aunque ya se esté en esa pestaña: al guardar se
  // cierra el modo edición y antes no había forma de reactivarlo sin cambiar
  // de pestaña (D-76).
  useEffect(() => {
    if (!solicitudPestana) return;
    setPestana(solicitudPestana.id);
    if (solicitudPestana.id === 'clasificacion' && puedeEditar) {
      setEditando(true);
      alActivarEdicion?.(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudPestana?.secuencia]);

  useEffect(() => {
    if (pestana !== 'historico' || relacionados !== null) return;
    setCargandoRel(true);
    api
      .casosRelacionados(caso.id_caso)
      .then(setRelacionados)
      .catch((e) => setError(e instanceof api.ApiError ? e.message : 'No se pudo leer el histórico.'))
      .finally(() => setCargandoRel(false));
    // Se consulta una sola vez por caso abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestana, caso.id_caso]);

  const telefonoReferencia = useMemo(
    () => caso.telefono || caso.contacto_cliente || '',
    [caso.telefono, caso.contacto_cliente],
  );

  async function guardarEdicion() {
    setError('');
    setOk('');
    setGuardando(true);
    try {
      const actualizado = await api.actualizarCaso(caso.id_caso, {
        id_sector: sector ? Number(sector) : null,
        fecha_cita: fechaCita ? new Date(fechaCita).toISOString() : null,
        informacion: informacion.slice(0, 200),
      });
      onActualizar(actualizado);
      setEditando(false);
      setOk('Cambios guardados en la ficha.');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Error al guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  async function resolver(evento: React.FormEvent) {
    evento.preventDefault();
    setError('');
    setOk('');
    setEjecutando(true);
    try {
      let resultado;
      if (accion === 'CERRAR') {
        const serializadas = evidencias
          .split(/[\n,]/)
          .map((x) => x.trim())
          .filter(Boolean);
        resultado = await api.cerrarCaso(caso.id_caso, {
          modo,
          descripcion,
          evidencias: serializadas,
        });
      } else if (accion === 'CITA') {
        resultado = await api.agendarCitaCaso(caso.id_caso, {
          fecha_hora: new Date(fechaCitaNueva).toISOString(),
          tipo: tipoCita,
          observacion: nv(observacionCita),
        });
      } else if (accion === 'ENRRUTAR') {
        resultado = await api.enrutarCaso(caso.id_caso, {
          destino,
          motivo: nv(motivoEnrutado),
        });
      } else {
        setError('Seleccione la acción a realizar.');
        return;
      }
      setOk(resultado.mensaje);
      setDescripcion('');
      setEvidencias('');
      setObservacionCita('');
      setDestino('');
      setMotivoEnrutado('');
      const refrescado = await api.obtenerCaso(caso.id_caso);
      onActualizar(refrescado);
      setRelacionados(null);
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo completar la acción.');
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <div className="ficha-pestanas">
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      <div className="ficha-tabs" role="tablist" aria-label="Secciones de la ficha">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            className={`ficha-tab${pestana === p.id ? ' activa' : ''}`}
            onClick={() => setPestana(p.id)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {/* ------------------------------ RESUMEN ------------------------------ */}
      {pestana === 'resumen' && (
        <div className="datos-grid">
          <Dato etiqueta="ID caso" valor={caso.id_caso} />
          <Dato etiqueta="ID avería" valor={<span className="mono">{caso.id_averia}</span>} />
          <Dato
            etiqueta="Central"
            valor={
              caso.nombre_central
                ? `${caso.codigo_central ?? ''} — ${caso.nombre_central}`.trim()
                : caso.id_central
            }
          />
          <Dato etiqueta="Origen" valor={caso.origen} />
          <Dato etiqueta="Estado actual" valor={caso.estado_actual} />
          <Dato etiqueta="Cuadrilla 0 (supervisor)" valor={caso.en_gestion_supervisor ? 'Sí' : 'No'} />
          <Dato etiqueta="Falla masiva" valor={caso.es_falla_masiva ? 'Sí' : 'No'} />
          <Dato etiqueta="Lote de ingesta" valor={caso.id_lote_ingesta} />
          <Dato etiqueta="Creado en" valor={fechaHora(caso.creado_en)} />
          <Dato etiqueta="Actualizado en" valor={fechaHora(caso.actualizado_en)} />
          <Dato etiqueta="Fecha de reporte" valor={fechaHora(caso.fecha_reporte)} />
          <Dato etiqueta="Fecha de compromiso" valor={fechaHora(caso.fecha_compromiso)} />
          <Dato etiqueta="Fecha de cita" valor={fechaHora(caso.fecha_cita)} />
        </div>
      )}

      {/* ------------------------------ CONTACTO ----------------------------- */}
      {pestana === 'contacto' && (
        <div className="datos-grid">
          <Dato etiqueta="Cliente" valor={caso.nombre_cliente} />
          <Dato etiqueta="Teléfono" valor={caso.telefono ? <span className="mono">{caso.telefono}</span> : ''} />
          <Dato etiqueta="Dirección" valor={caso.direccion} />
          <Dato etiqueta="Persona que reporta" valor={caso.persona_reporta} />
          <Dato etiqueta="Contacto del cliente" valor={caso.contacto_cliente} />
        </div>
      )}

      {/* --------------------------- DATOS TÉCNICOS -------------------------- */}
      {pestana === 'tecnico' && (
        <div className="datos-grid">
          <Dato etiqueta="OLT" valor={caso.olt} />
          <Dato etiqueta="Plan" valor={caso.plan} />
          <Dato etiqueta="Slot" valor={caso.slot} />
          <Dato etiqueta="Puerto" valor={caso.puerto} />
          <Dato etiqueta="FAT" valor={caso.fat} />
          <Dato etiqueta="Serial" valor={caso.serial} />
          <Dato etiqueta="Tipo de servicio" valor={caso.tipo_servicio} />
          <Dato etiqueta="Tipo de problema" valor={caso.tipo_problema} />
          <Dato etiqueta="Área de trabajo" valor={caso.area_trabajo} />
          <Dato etiqueta="Unidad de negocio" valor={caso.unidad_negocio} />
          <Dato etiqueta="Reparador principal" valor={caso.reparador_principal} />
          <Dato etiqueta="Cuadrilla externa" valor={caso.cuadrilla_externa} />
          <Dato etiqueta="Flota CAN" valor={caso.flota_can} />
          <Dato
            etiqueta="Ayudantes"
            valor={caso.ayudantes.length > 0 ? caso.ayudantes.map(String).join(', ') : ''}
          />
        </div>
      )}

      {/* --------------------------- CLASIFICACIÓN --------------------------- */}
      {pestana === 'clasificacion' && (
        <div className="datos-columna">
          <div className="datos-grid">
            <Dato etiqueta="Clase" valor={caso.categoria} />
            <Dato etiqueta="Tipo" valor={caso.tipo_caso} />
            <Dato etiqueta="Sector" valor={caso.sector_nombre ?? caso.id_sector} />
            <Dato etiqueta="ID causa" valor={caso.id_causa} />
            <Dato etiqueta="Región" valor={caso.region} />
            <Dato etiqueta="Estado geográfico" valor={caso.estado_geografico} />
            <Dato etiqueta="Municipio" valor={caso.municipio} />
            <Dato etiqueta="Parroquia" valor={caso.parroquia} />
            <Dato etiqueta="Área" valor={caso.area} />
          </div>

          {/* Edición ligera (D-70, reubicada en D-76 al eliminar la pestaña
              Gestión): la habilita el icono de edición del título y se limita a
              Sector, Fecha de cita e Información. */}
          {!puedeEditar ? (
            <p className="vacio">Solo el Supervisor, el Administrador o el Super Usuario pueden editar la ficha.</p>
          ) : !editando ? (
            <p className="texto-pequeno">
              Use el icono de edición del título de la ficha para habilitar los cambios.
            </p>
          ) : (
            <div className="formulario modal-formulario">
              <div className="fila-campos">
                <div className="campo">
                  <label htmlFor="ficha-sector">Sector</label>
                  <select id="ficha-sector" value={sector} onChange={(e) => setSector(e.target.value)}>
                    <option value="">Sin sector</option>
                    {sectores.map((s) => (
                      <option key={s.id_sector} value={s.id_sector}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="ficha-fecha-cita">Fecha de cita</label>
                  <input
                    id="ficha-fecha-cita"
                    type="datetime-local"
                    value={fechaCita}
                    onChange={(e) => setFechaCita(e.target.value)}
                  />
                </div>
              </div>
              <div className="campo">
                <label htmlFor="ficha-informacion">Información ({informacion.length}/200)</label>
                <textarea
                  id="ficha-informacion"
                  value={informacion}
                  maxLength={200}
                  rows={3}
                  onChange={(e) => setInformacion(e.target.value.slice(0, 200))}
                />
              </div>
              <div className="acciones-form">
                <button className="btn" type="button" disabled={guardando} onClick={() => void guardarEdicion()}>
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button
                  className="btn btn-secundario"
                  type="button"
                  onClick={() => {
                    setEditando(false);
                    setSector(caso.id_sector ? String(caso.id_sector) : '');
                    setFechaCita(caso.fecha_cita ? caso.fecha_cita.slice(0, 16) : '');
                    setInformacion((caso.informacion ?? '').slice(0, 200));
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------- TEXTOS ------------------------------ */}
      {pestana === 'texto' && (
        <div className="datos-grid datos-grid-ancha">
          <Dato etiqueta="Problema reportado" valor={caso.problema_reporte} />
          <Dato etiqueta="Último comentario" valor={caso.ultimo_comentario} />
          <Dato etiqueta="Results" valor={caso.results} />
          <Dato etiqueta="Estatus de origen" valor={caso.estatus_origen} />
          <Dato etiqueta="Información" valor={caso.informacion} />
        </div>
      )}

      {/* ----------------------------- RESOLUCIÓN ---------------------------- */}
      {pestana === 'resolucion' && (
        <div className="datos-columna">
          {!puedeResolver ? (
            <p className="vacio">
              Solo el Supervisor, el Administrador o el Super Usuario pueden cerrar, agendar o enrutar el caso.
            </p>
          ) : (
            <>
              <div className="fila-campos">
                <div className="campo">
                  <label htmlFor="resolucion-accion">Acción de resolución</label>
                  <select
                    id="resolucion-accion"
                    value={accion}
                    onChange={(e) => setAccion(e.target.value)}
                  >
                    {ACCION_RESOLUCION.map((a) => (
                      <option key={a.valor} value={a.valor}>
                        {a.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <Dato etiqueta="Estado actual" valor={caso.estado_actual} />
              </div>

              {accion === 'CERRAR' && (
                <form className="formulario modal-formulario cierre-formulario" onSubmit={(e) => void resolver(e)}>
                  <div className="fila-campos fila-campos-medias">
                    <div className="campo">
                      <label htmlFor="cierre-modo">Modo de cierre *</label>
                      <select
                        id="cierre-modo"
                        value={modo}
                        onChange={(e) => setModo(e.target.value as ModoCierre)}
                      >
                        {MODOS_CIERRE.map((m) => (
                          <option key={m.valor} value={m.valor}>
                            {m.etiqueta}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="campo campo-ancho">
                    <label htmlFor="cierre-descripcion">Descripción de lo realizado *</label>
                    <textarea
                      id="cierre-descripcion"
                      value={descripcion}
                      rows={3}
                      maxLength={2000}
                      required
                      minLength={10}
                      placeholder="Qué se hizo para resolver el caso…"
                      onChange={(e) => setDescripcion(e.target.value)}
                    />
                  </div>
                  <div className="campo campo-ancho">
                    <label htmlFor="cierre-evidencias">Evidencias (una por línea o separadas por coma)</label>
                    <textarea
                      id="cierre-evidencias"
                      value={evidencias}
                      rows={3}
                      placeholder="EVD-001, EVD-002…"
                      onChange={(e) => setEvidencias(e.target.value)}
                    />
                    <span className="texto-pequeno">
                      Seriales o rutas de las fotos cargadas; se registran junto al cierre.
                    </span>
                  </div>
                  <div className="acciones-form">
                    <button className="btn" type="submit" disabled={ejecutando}>
                      {ejecutando ? 'Cerrando…' : `Cerrar caso con ${modo}`}
                    </button>
                  </div>
                </form>
              )}

              {accion === 'CITA' && (
                <form className="formulario modal-formulario" onSubmit={(e) => void resolver(e)}>
                  <div className="fila-campos">
                    <div className="campo">
                      <label htmlFor="cita-fecha">Fecha y hora de la cita *</label>
                      <input
                        id="cita-fecha"
                        type="datetime-local"
                        value={fechaCitaNueva}
                        required
                        onChange={(e) => setFechaCitaNueva(e.target.value)}
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor="cita-tipo">Tipo</label>
                      <select
                        id="cita-tipo"
                        value={tipoCita}
                        onChange={(e) => setTipoCita(e.target.value as 'CONTACTO' | 'ATENCION')}
                      >
                        <option value="ATENCION">ATENCION</option>
                        <option value="CONTACTO">CONTACTO</option>
                      </select>
                    </div>
                  </div>
                  <div className="campo">
                    <label htmlFor="cita-observacion">Observación</label>
                    <textarea
                      id="cita-observacion"
                      value={observacionCita}
                      rows={2}
                      maxLength={500}
                      onChange={(e) => setObservacionCita(e.target.value)}
                    />
                  </div>
                  <div className="acciones-form">
                    <button className="btn" type="submit" disabled={ejecutando || !fechaCitaNueva}>
                      {ejecutando ? 'Agendando…' : 'Agendar cita'}
                    </button>
                  </div>
                </form>
              )}

              {accion === 'ENRRUTAR' && (
                <form className="formulario modal-formulario" onSubmit={(e) => void resolver(e)}>
                  <div className="fila-campos">
                    <div className="campo">
                      <label htmlFor="enrutado-destino">Instancia destino *</label>
                      <input
                        id="enrutado-destino"
                        value={destino}
                        required
                        minLength={3}
                        maxLength={120}
                        placeholder="Planta externa, cola de seguimiento…"
                        onChange={(e) => setDestino(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="campo">
                    <label htmlFor="enrutado-motivo">Motivo</label>
                    <textarea
                      id="enrutado-motivo"
                      value={motivoEnrutado}
                      rows={2}
                      maxLength={500}
                      onChange={(e) => setMotivoEnrutado(e.target.value)}
                    />
                  </div>
                  <div className="acciones-form">
                    <button className="btn" type="submit" disabled={ejecutando || !destino}>
                      {ejecutando ? 'Enrutando…' : 'Enrutar caso'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}

      {/* ------------------------------ HISTÓRICO ---------------------------- */}
      {pestana === 'historico' && (
        <div className="datos-columna">
          <p className="texto-pequeno">
            Casos anteriores asociados al teléfono <strong className="mono">{telefonoReferencia || 'sin dato'}</strong>{' '}
            del ID de avería.
          </p>
          {cargandoRel ? (
            <p className="texto-pequeno">Buscando antecedentes…</p>
          ) : !telefonoReferencia ? (
            <p className="vacio">El caso no tiene teléfono de referencia para buscar antecedentes.</p>
          ) : relacionados && relacionados.length === 0 ? (
            <p className="vacio">No hay casos anteriores con ese teléfono.</p>
          ) : (
            <div className="tabla-envoltura">
              <table>
                <thead>
                  <tr>
                    <th>ID de avería anterior</th>
                    <th>Fecha de cierre</th>
                    <th>Problema reportado</th>
                    <th>Justificación de cierre</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(relacionados ?? []).map((r) => (
                    <tr key={r.id_caso}>
                      <td className="mono">{r.id_averia}</td>
                      <td>{r.fecha_cierre ? fechaHora(r.fecha_cierre) : 'sin cierre'}</td>
                      <td>{r.problema_reporte ?? '—'}</td>
                      <td>{r.justificacion_cierre ?? '—'}</td>
                      <td>{r.estado_actual}</td>
                    </tr>
                  ))}
                </tbody>
                <PieTabla
                  colSpan={5}
                  total={(relacionados ?? []).length}
                  singular="antecedente"
                  plural="antecedentes"
                />
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
