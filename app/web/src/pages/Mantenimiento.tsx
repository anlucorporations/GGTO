/**
 * MANTENIMIENTO: sección para gestionar e incorporar casos de mantenimiento.
 *
 * Reemplaza la sección seguimiento (solicitud 2): en esta sección se guardan
 * todos los casos de tipo MANTENIMIENTO para su gestión, seguimiento e
 * incorporación directa al sistema.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import type {
  CasoEstadoHistOut,
  CasoManualCreate,
  CasoOut,
  Cuadrilla,
  EstadoCaso,
  Sector,
} from '../api/types';
import FichaCaso, { type Pestana as PestanaFicha } from '../components/FichaCaso';
import CeldaSector from '../components/CeldaSector';
import EstadoChips from '../components/EstadoChips';
import { IconoAgregar, IconoEditar } from '../components/Iconos';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';
import { fecha, fechaHora, nv } from '../utils';

const ESTADOS: EstadoCaso[] = [
  'NUEVO',
  'ASIGNADO',
  'CONTACTADO',
  'CITADO',
  'DIFERIDO',
  'EN_GESTION',
  'ENRUTADO',
  'CERRADO',
  'CANCELADO',
];

const ROLES_ESCRITURA = ['SUPER', 'ADMIN', 'SUPERVISOR'];

interface FormNuevo {
  nombre_cliente: string;
  contacto_cliente: string;
  id_pago: string;
  direccion: string;
  id_sector: string;
  problema_reporte: string;
}

const FORM_NUEVO_VACIO: FormNuevo = {
  nombre_cliente: '',
  contacto_cliente: '',
  id_pago: '',
  direccion: '',
  id_sector: '',
  problema_reporte: '',
};

function ModalNuevoMantenimiento({
  sectores,
  onCerrar,
  onCreado,
}: {
  sectores: Sector[];
  onCerrar: () => void;
  onCreado: (caso: CasoOut) => void;
}) {
  const [form, setForm] = useState<FormNuevo>(FORM_NUEVO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form.nombre_cliente.trim()) {
      setError('El nombre del cliente o contacto es obligatorio.');
      return;
    }
    if (!form.contacto_cliente.trim()) {
      setError('El teléfono de contacto es obligatorio.');
      return;
    }
    if (!form.id_pago.trim()) {
      setError('El teléfono con identificador de pago (70*) es obligatorio.');
      return;
    }
    if (!form.direccion.trim()) {
      setError('La dirección del caso de mantenimiento es obligatoria.');
      return;
    }

    setGuardando(true);
    setError('');
    try {
      const payload: CasoManualCreate = {
        tipo_reporte: 'MANTENIMIENTO',
        nombre_cliente: form.nombre_cliente.trim(),
        contacto_cliente: form.contacto_cliente.trim(),
        id_pago: form.id_pago.trim(),
        telefono: form.id_pago.trim(),
        direccion: form.direccion.trim(),
        id_sector: form.id_sector ? Number(form.id_sector) : undefined,
        problema_reporte: form.problema_reporte.trim() || 'Mantenimiento preventivo/correctivo',
      };
      const creado = await api.crearCaso(payload);
      onCreado(creado);
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : 'No se pudo crear el caso de mantenimiento.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nuevo caso de mantenimiento" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="formulario">
        {error && <p className="aviso aviso-error">{error}</p>}

        <label className="campo">
          <span>Nombre del cliente / Contacto *</span>
          <input
            type="text"
            required
            value={form.nombre_cliente}
            onChange={(e) => setForm({ ...form, nombre_cliente: e.target.value })}
            placeholder="Ej. Cantv - Planta / Cliente"
          />
        </label>

        <div className="fila-campos">
          <label className="campo">
            <span>Teléfono de contacto *</span>
            <input
              type="text"
              required
              value={form.contacto_cliente}
              onChange={(e) => setForm({ ...form, contacto_cliente: e.target.value })}
              placeholder="0414..."
            />
          </label>

          <label className="campo">
            <span>Identificador de pago (70*) *</span>
            <input
              type="text"
              required
              value={form.id_pago}
              onChange={(e) => setForm({ ...form, id_pago: e.target.value })}
              placeholder="70XXXXXXXX"
            />
          </label>
        </div>

        <label className="campo">
          <span>Dirección del mantenimiento *</span>
          <input
            type="text"
            required
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            placeholder="Calle, sector, referencia o ubicación del mantenimiento"
          />
        </label>

        <div className="fila-campos">
          <label className="campo">
            <span>Sector</span>
            <select
              value={form.id_sector}
              onChange={(e) => setForm({ ...form, id_sector: e.target.value })}
            >
              <option value="">— Autodetectar por dirección —</option>
              {sectores.map((s) => (
                <option key={s.id_sector} value={s.id_sector}>
                  {s.codigo} · {s.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="campo">
          <span>Detalle / Descripción del mantenimiento</span>
          <textarea
            rows={3}
            value={form.problema_reporte}
            onChange={(e) => setForm({ ...form, problema_reporte: e.target.value })}
            placeholder="Describa los trabajos de mantenimiento requeridos"
          />
        </label>

        <div className="acciones-form">
          <button type="button" className="btn btn-secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Crear caso de mantenimiento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Mantenimiento() {
  const { usuario } = useAuth();
  const rol = usuario?.rol ?? '';
  const puedeEditar = ROLES_ESCRITURA.includes(rol);

  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [idSector, setIdSector] = useState('');
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(25);

  const [items, setItems] = useState<CasoOut[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [sectores, setSectores] = useState<Sector[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);

  const [crearAbierto, setCrearAbierto] = useState(false);
  const [ficha, setFicha] = useState<CasoOut | null>(null);
  const [historial, setHistorial] = useState<CasoEstadoHistOut[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [solicitud, setSolicitud] = useState<{ id: PestanaFicha; secuencia: number }>({
    id: 'resumen',
    secuencia: 0,
  });

  const cargarCatalogos = useCallback(async () => {
    try {
      const [sec, cua] = await Promise.all([api.listarSectores(), api.listarCuadrillas()]);
      setSectores(sec);
      setCuadrillas(cua);
    } catch {
      // tolerante
    }
  }, []);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  const cargarCasos = useCallback(async () => {
    setCargando(true);
    try {
      const resp = await api.listarCasos({
        tipo_caso: 'MANTENIMIENTO',
        q: q.trim() || undefined,
        estado_actual: estado || undefined,
        id_sector: idSector ? Number(idSector) : undefined,
        solo_abiertos: soloAbiertos,
        page: pagina,
        page_size: limite,
      });
      setItems(resp.items);
      setTotal(resp.total);
      setPaginas(resp.pages);
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudieron cargar los casos de mantenimiento.');
    } finally {
      setCargando(false);
    }
  }, [q, estado, idSector, soloAbiertos, pagina, limite]);

  useEffect(() => {
    void cargarCasos();
  }, [cargarCasos]);

  async function abrirFicha(idCaso: number) {
    try {
      const c = await api.obtenerCaso(idCaso);
      setFicha(c);
      setCargandoHistorial(true);
      try {
        setHistorial(await api.obtenerHistorialCaso(idCaso));
      } finally {
        setCargandoHistorial(false);
      }
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo abrir la ficha del caso.');
    }
  }

  function filtrar(e: FormEvent) {
    e.preventDefault();
    setPagina(1);
    void cargarCasos();
  }

  const abiertos = items.filter((i) => !['CERRADO', 'CANCELADO'].includes(i.estado_actual)).length;
  const cerrados = items.filter((i) => i.estado_actual === 'CERRADO').length;
  const asignados = items.filter((i) => i.id_cuadrilla !== null && i.id_cuadrilla !== undefined).length;

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Mantenimiento</h1>
          <p className="texto-pequeno">
            Gestión e incorporación de todos los casos de mantenimiento al sistema.
            Permite registrar nuevos casos, darles seguimiento y asignarlos por sectores a cuadrillas.
          </p>
        </div>
        {puedeEditar && (
          <button className="btn btn-primario" type="button" onClick={() => setCrearAbierto(true)}>
            <IconoAgregar width={16} height={16} />
            Nuevo caso de mantenimiento
          </button>
        )}
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      <section className="panel-bloque">
        <h2>Resumen de mantenimiento</h2>
        <div className="rejilla-tarjetas">
          <article className="tarjeta">
            <span className="valor">{total}</span>
            <span className="etiqueta">Total mantenimiento</span>
          </article>
          <article className="tarjeta">
            <span className="valor">{abiertos}</span>
            <span className="etiqueta">Abiertos (página)</span>
          </article>
          <article className="tarjeta">
            <span className="valor">{asignados}</span>
            <span className="etiqueta">Con cuadrilla asignada</span>
          </article>
          <article className="tarjeta">
            <span className="valor">{cerrados}</span>
            <span className="etiqueta">Cerrados / Resueltos</span>
          </article>
        </div>
      </section>

      <section className="panel-bloque">
        <h2>Casos de mantenimiento</h2>
        <form className="formulario filtros-tabla" onSubmit={filtrar}>
          <div className="fila-filtros">
            <label className="campo">
              <span>Buscar</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Avería, cliente, dirección o contacto"
              />
            </label>
            <label className="campo">
              <span>Estado</span>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                {ESTADOS.map((est) => (
                  <option key={est} value={est}>
                    {est}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Sector</span>
              <select value={idSector} onChange={(e) => setIdSector(e.target.value)}>
                <option value="">Todos los sectores</option>
                {sectores.map((s) => (
                  <option key={s.id_sector} value={s.id_sector}>
                    {s.codigo} · {s.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="casilla-fila" style={{ marginTop: '1.5rem' }}>
              <input
                type="checkbox"
                checked={soloAbiertos}
                onChange={(e) => setSoloAbiertos(e.target.checked)}
              />
              Solo abiertos
            </label>
            <div className="acciones-form">
              <button type="submit" className="btn btn-primario">
                Filtrar
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => {
                  setQ('');
                  setEstado('');
                  setIdSector('');
                  setSoloAbiertos(false);
                  setPagina(1);
                }}
              >
                Limpiar
              </button>
            </div>
          </div>
        </form>

        <div className="tabla-envoltura">
          {cargando ? (
            <p className="texto-pequeno">Cargando casos de mantenimiento…</p>
          ) : items.length === 0 ? (
            <p className="vacio">No hay casos de mantenimiento registrados con los filtros seleccionados.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Avería / Ref</th>
                  <th>Cliente</th>
                  <th>Dirección</th>
                  <th>Sector</th>
                  <th>Cuadrilla</th>
                  <th>Estado</th>
                  <th>Reporte</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id_caso}>
                    <td>
                      <strong>{item.id_averia}</strong>
                    </td>
                    <td>
                      <div>{item.nombre_cliente}</div>
                      <div className="texto-pequeno">
                        {nv(item.contacto_cliente || item.telefono || '—')}
                      </div>
                    </td>
                    <td className="col-direccion">{item.direccion}</td>
                    <td>
                      <CeldaSector sector={item.sector_nombre} fat={item.fat} />
                    </td>
                    <td>
                      {item.cuadrilla_codigo ? (
                        <span className="chip chip-info">{item.cuadrilla_codigo}</span>
                      ) : (
                        <span className="texto-pequeno">—</span>
                      )}
                    </td>
                    <td>
                      <EstadoChips
                        pendiente={item.pendiente}
                        asignado={item.asignado}
                        citado={item.citado}
                        gestion={item.gestion}
                        id_cuadrilla={item.id_cuadrilla}
                        cuadrilla_codigo={item.cuadrilla_codigo}
                        cuadrilla_nombre={item.cuadrilla_nombre}
                      />
                    </td>
                    <td>{fecha(item.fecha_reporte)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-mini btn-secundario"
                        onClick={() => void abrirFicha(item.id_caso)}
                      >
                        Gestionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="barra-paginacion">
          <span className="texto-pequeno">
            {cargando
              ? 'Cargando…'
              : `Total: ${total} caso(s) de mantenimiento · página ${pagina} de ${paginas || 1}`}
          </span>
          <div className="paginacion-controles">
            <label className="texto-pequeno" htmlFor="mant-paginas-tamanio">
              Por página
            </label>
            <select
              id="mant-paginas-tamanio"
              value={limite}
              onChange={(e) => {
                setLimite(Number(e.target.value));
                setPagina(1);
              }}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-mini btn-secundario"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={cargando || pagina <= 1}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn-mini btn-secundario"
              onClick={() => setPagina((p) => p + 1)}
              disabled={cargando || paginas === 0 || pagina >= paginas}
            >
              Siguiente
            </button>
          </div>
        </div>

        <PieTabla colSpan={8} total={total} singular="caso" plural="casos" cargando={cargando} />
      </section>

      {crearAbierto && (
        <ModalNuevoMantenimiento
          sectores={sectores}
          onCerrar={() => setCrearAbierto(false)}
          onCreado={(nuevo) => {
            setCrearAbierto(false);
            setOk(`Caso de mantenimiento ${nuevo.id_averia} incorporado con éxito.`);
            void cargarCasos();
          }}
        />
      )}

      {ficha && (
        <Modal
          titulo={`Ficha del caso de mantenimiento #${ficha.id_caso} — ${ficha.id_averia}`}
          onCerrar={() => setFicha(null)}
          cabeceraExtra={
            puedeEditar ? (
              <button
                type="button"
                className="btn btn-mini btn-secundario"
                title="Activar la edición de la ficha"
                aria-label="Activar la edición de la ficha"
                onClick={() => setSolicitud({ id: 'clasificacion', secuencia: solicitud.secuencia + 1 })}
              >
                <IconoEditar width={16} height={16} />
                Editar
              </button>
            ) : null
          }
        >
          <FichaCaso
            caso={ficha}
            solicitudPestana={solicitud}
            sectores={sectores}
            cuadrillas={cuadrillas}
            puedeEditar={puedeEditar}
            puedeResolver={puedeEditar}
            puedeAsignar={puedeEditar}
            alActivarEdicion={() => undefined}
            onActualizar={(actualizado) => {
              setFicha(actualizado);
              void cargarCasos();
            }}
          />

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
                    <th>Fecha / Hora</th>
                    <th>Estado anterior</th>
                    <th>Estado nuevo</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id_hist}>
                      <td>{fechaHora(h.fecha_hora)}</td>
                      <td>{h.estado_anterior ?? '—'}</td>
                      <td>
                        <EstadoChips
                          pendiente={h.estado_nuevo === 'NUEVO'}
                          asignado={h.estado_nuevo === 'ASIGNADO'}
                          citado={h.estado_nuevo === 'CITADO'}
                          gestion={h.estado_nuevo === 'EN_GESTION'}
                        />
                      </td>
                      <td>{h.motivo ?? '—'}</td>
                      <td>{h.usuario ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
