/**
 * Página MASIVAS — sección REDUCIDA (requisito del usuario).
 *
 * En esta sección **solo se muestra el cuadro con las masivas declaradas**:
 *
 *  - inicialmente se cargan las **masivas abiertas** (DETECTADA/PLANIFICADA);
 *    la casilla encima del cuadro permite ver también el histórico completo;
 *  - cada **icono** de la columna INDICADORES indica el estado por pares
 *    encendido/apagado: **Planificación** (plan de atención) y **Materiales**
 *    **solicitados** / **entregados** (`CeldaIndicadores`);
 *  - **cada registro abre el DETALLE de la masiva** (ficha flotante): el
 *    detalle concentra Gestionar, Reporte, Ubicación y todo el ciclo de la
 *    masiva con la API de `/fallas-masivas`.
 *
 * Los estilos propios viven en `../masivas/masivas.css`.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { fechaHora } from '../utils';
import * as api from '../api/client';
import { imprimirHtml } from '../utils/imprimir';
import type {
  CasoCandidatoOut,
  Cuadrilla,
  FallaMasivaManual,
  FallaMasivaOut,
  OrigenFallaMasiva,
  Sector,
  UbicacionMasivaOut,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import ListaEvidencias from '../masivas/ListaEvidencias';
import Mensaje from '../components/Mensaje';
import Modal from '../components/Modal';
import CuadroMasivas from '../masivas/CuadroMasivas';
import FichaMasiva from '../masivas/FichaMasiva';
import MapaFat from '../masivas/MapaFat';
import '../masivas/masivas.css';

/** Máximo de seriales de evidencia del reporte manual (RF-16). */
const MAX_EVIDENCIAS_REPORTE = 2;

const ORIGENES_MASIVA: OrigenFallaMasiva[] = ['AUTOMATICA', 'REPORTE_TECNICO', 'MCP'];

function detalleDe(e: unknown, fallback: string): string {
  return e instanceof api.ApiError ? e.message : fallback;
}

export default function Masivas() {
  const { soloLectura } = useAuth();

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState('');

  // El cuadro: por defecto **solo las masivas abiertas**; la casilla pasa al
  // histórico completo.
  const [soloAbiertas, setSoloAbiertas] = useState(true);
  const [items, setItems] = useState<FallaMasivaOut[]>([]);
  const [cargando, setCargando] = useState(true);

  // Ventanas flotantes: alta manual, gestión (ficha), detalle y mapa.
  const [manualAbierto, setManualAbierto] = useState(false);
  const [ficha, setFicha] = useState<FallaMasivaOut | null>(null);
  const [detalle, setDetalle] = useState<FallaMasivaOut | null>(null);
  const [mapa, setMapa] = useState<UbicacionMasivaOut | null>(null);
  const [cargandoMapa, setCargandoMapa] = useState(false);
  // D-145: resolución de la dirección para el mapa del FAT.
  const [geocodificando, setGeocodificando] = useState(false);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await api.listarMasivas({ solo_activas: soloAbiertas }));
      setError('');
    } catch (e) {
      setError(detalleDe(e, 'Error al listar las masivas.'));
    } finally {
      setCargando(false);
    }
  }, [soloAbiertas]);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  /** Refresca el cuadro y la masiva abierta en la ficha de gestión. */
  const refrescarTodo = useCallback(async () => {
    await cargarLista();
  }, [cargarLista]);

  /* ------------------------- Acciones ------------------------- */

  async function detectar() {
    setOcupado('detectar');
    setError('');
    setOk('');
    try {
      const creadas = await api.detectarFallasMasivas();
      setOk(
        creadas.length === 0
          ? 'Detección completada: ninguna concentración superó el umbral configurado.'
          : `Detección completada: ${creadas.length} masiva(s) nueva(s).`,
      );
      await refrescarTodo();
    } catch (e) {
      setError(detalleDe(e, 'No se pudo ejecutar la detección automática.'));
    } finally {
      setOcupado('');
    }
  }

  async function generarReporte(idFalla: number) {
    setOcupado(`reporte-${idFalla}`);
    setError('');
    setOk('');
    try {
      const html = await api.reporteMasiva(idFalla);
      imprimirHtml(html);
      setOk(`Reporte de la masiva #${idFalla} generado y listo para imprimir.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo obtener el reporte de la masiva.'));
    } finally {
      setOcupado('');
    }
  }

  async function abrirMapa(idFalla: number, geocodificar = false) {
    setCargandoMapa(true);
    if (geocodificar) setGeocodificando(true);
    setError('');
    try {
      setMapa(await api.ubicacionMasiva(idFalla, { geocodificar }));
    } catch (e) {
      setMapa(null);
      setError(detalleDe(e, 'No se pudo obtener la ubicación del FAT.'));
    } finally {
      setCargandoMapa(false);
      setGeocodificando(false);
    }
  }

  function ubicarPorDireccion() {
    if (mapa) void abrirMapa(mapa.id_falla, true);
  }

  function abrirDetalle(masiva: FallaMasivaOut) {
    setDetalle(masiva);
    setError('');
    setOk('');
  }

  function abrirGestion(masiva: FallaMasivaOut) {
    setFicha(masiva);
    setError('');
    setOk('');
  }

  function masivaActualizada(actualizada: FallaMasivaOut, mensaje: string) {
    setFicha(actualizada);
    setOk(mensaje);
    void refrescarTodo();
  }

  /* ---------------------------- Render ---------------------------- */

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Masivas</h1>
          <p className="texto-pequeno">
            Cuadro de las masivas declaradas: cada registro abre su detalle con el
            ciclo completo (planificación, materiales, casos, cierre y ubicación).
          </p>
        </div>
        <div className="acciones-form">
          <button
            type="button"
            className="btn"
            onClick={() => void detectar()}
            disabled={soloLectura || ocupado !== ''}
          >
            {ocupado === 'detectar' ? 'Detectando…' : 'Detectar masivas'}
          </button>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => setManualAbierto(true)}
            disabled={soloLectura}
          >
            Agregar masiva manual
          </button>
        </div>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {soloLectura && (
        <div className="aviso aviso-info">
          <span>
            Modo solo lectura: su rol TECNICO puede consultar masivas, casos asociados y
            reportes, pero no modificarlos.
          </span>
        </div>
      )}

      {/* ---------------- CUADRO DE LAS MASIVAS (D-111) ---------------- */}
      <div className="panel-bloque">
        <div className="formulario filtros-tabla">
          <label className="casilla-fila">
            <input
              type="checkbox"
              checked={soloAbiertas}
              onChange={(e) => setSoloAbiertas(e.target.checked)}
            />
            Solo masivas abiertas
          </label>
        </div>
        {items.length === 0 ? (
          <p className="vacio">
            {cargando
              ? 'Cargando…'
              : soloAbiertas
                ? 'No hay masivas abiertas (use «Detectar masivas», declare una manual o '
                  + 'destace «Solo masivas abiertas» para ver el histórico).'
                : 'No hay masivas registradas.'}
          </p>
        ) : (
          <CuadroMasivas
            items={items}
            cargando={cargando}
            onAbrir={abrirDetalle}
          />
        )}
      </div>

      {/* Formulario de reporte manual */}
      {manualAbierto && (
        <Modal
          titulo="Agregar masiva manual"
          onCerrar={() => setManualAbierto(false)}
        >
          <FormularioMasivaManual
            onCancelar={() => setManualAbierto(false)}
            onCreada={(creada, mensaje) => {
              setManualAbierto(false);
              setOk(mensaje);
              setFicha(creada);
              setSoloAbiertas(true);
              void refrescarTodo();
            }}
          />
        </Modal>
      )}

      {/* Ficha flotante de gestión */}
      {ficha && (
        <FichaMasiva
          falla={ficha}
          onCerrar={() => setFicha(null)}
          onActualizada={masivaActualizada}
        />
      )}

      {/* Detalle de la masiva: el registro del cuadro abrirá SIEMPRE este. */}
      {detalle && (
        <Modal titulo={`Masiva #${detalle.id_falla}`} onCerrar={() => setDetalle(null)}>
          <div className="datos-grid">
            <div className="dato">
              <span className="dato-etiqueta">Estado</span>
              <span className="dato-valor">{detalle.estado}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Origen</span>
              <span className="dato-valor">{detalle.origen}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Concentración</span>
              <span className="dato-valor mono">{detalle.clave_concentracion ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">OLT</span>
              <span className="dato-valor mono">{detalle.olt ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">SLOT/PUERTO</span>
              <span className="dato-valor mono">
                {[detalle.slot, detalle.puerto].filter(Boolean).join('/') || '—'}
              </span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">FAT</span>
              <span className="dato-valor mono">{detalle.fat ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">EXTRA</span>
              <span className="dato-valor mono">{detalle.extra ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">ODN</span>
              <span className="dato-valor mono">{detalle.odn ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">RUTA</span>
              <span className="dato-valor mono">{detalle.ruta ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Sector</span>
              <span className="dato-valor">{detalle.sector_nombre ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Cuadrilla</span>
              <span className="dato-valor">
                {detalle.cuadrilla_codigo
                  ? `${detalle.cuadrilla_codigo} — ${detalle.cuadrilla_nombre ?? ''}`
                  : '—'}
              </span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Casos asociados</span>
              <span className="dato-valor">{detalle.casos_asociados ?? 0}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Casos cerrados</span>
              <span className="dato-valor">{detalle.casos_cerrados ?? 0}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Órdenes de material</span>
              <span className="dato-valor">
                {detalle.ordenes_solicitadas ? `${detalle.ordenes_solicitadas} solicitadas · ` : ''}
                {detalle.ordenes_entregadas ? `${detalle.ordenes_entregadas} entregadas · ` : ''}
                {detalle.ordenes_count ?? 0} en total
              </span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Detección</span>
              <span className="dato-valor">{fechaHora(detalle.fecha_deteccion)}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Planificación</span>
              <span className="dato-valor">{detalle.planificacion ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Validador del CRASS</span>
              <span className="dato-valor">
                {detalle.validador_crass
                  ? `${detalle.validador_crass.nombre} — ${detalle.validador_crass.unidad}`
                  : '—'}
              </span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Cerrada por</span>
              <span className="dato-valor">{detalle.cerrada_por ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="dato-etiqueta">Cerrada en</span>
              <span className="dato-valor">{fechaHora(detalle.cerrada_en)}</span>
            </div>
            <div className="dato dato-ancha">
              <span className="dato-etiqueta">Descripción</span>
              <span className="dato-valor">{detalle.descripcion}</span>
            </div>
            <div className="dato dato-ancha">
              <span className="dato-etiqueta">Dirección</span>
              <span className="dato-valor">{detalle.direccion ?? detalle.direccion_corta ?? '—'}</span>
            </div>
            <div className="dato dato-ancha">
              <span className="dato-etiqueta">Descripción del cierre</span>
              <span className="dato-valor">{detalle.descripcion_cierre ?? '—'}</span>
            </div>
            <div className="dato dato-ancha">
              <span className="dato-etiqueta">Evidencias</span>
              <span className="dato-valor mono">
                {(detalle.evidencias?.length ?? 0) > 0 ? detalle.evidencias?.join(' · ') : '—'}
              </span>
            </div>
          </div>
          <div className="acciones-form">
            <button
              type="button"
              className="btn"
              onClick={() => {
                const masiva = detalle;
                setDetalle(null);
                abrirGestion(masiva);
              }}
            >
              Gestionar
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => void generarReporte(detalle.id_falla)}
              disabled={ocupado === `reporte-${detalle.id_falla}`}
            >
              Generar reporte
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => void abrirMapa(detalle.id_falla)}
            >
              Ver ubicación
            </button>
          </div>
        </Modal>
      )}

      {/* Detalle (mapa) de la ubicación del FAT */}
      {mapa && (
        <Modal
          titulo={`Ubicación del FAT · Masiva #${mapa.id_falla}`}
          onCerrar={() => setMapa(null)}
        >
          {cargandoMapa ? (
            <p className="vacio">Cargando la ubicación del FAT…</p>
          ) : (
            <>
              <div className="datos-grid">
                <div className="dato">
                  <span className="dato-etiqueta">OLT</span>
                  <span className="dato-valor mono">{mapa.olt ?? '—'}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">FAT</span>
                  <span className="dato-valor mono">{mapa.fat ?? '—'}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">RUTA</span>
                  <span className="dato-valor mono">{mapa.ruta ?? '—'}</span>
                </div>
                <div className="dato">
                  <span className="dato-etiqueta">Sector</span>
                  <span className="dato-valor">{mapa.sector_nombre ?? '—'}</span>
                </div>
                <div className="dato dato-ancha">
                  <span className="dato-etiqueta">Dirección</span>
                  <span className="dato-valor">{mapa.direccion ?? '—'}</span>
                </div>
              </div>
              <MapaFat
                latitud={mapa.latitud}
                longitud={mapa.longitud}
                etiqueta={`Masiva #${mapa.id_falla} · FAT ${mapa.fat ?? 'sin identificar'}`}
                puntos={mapa.puntos}
                // D-145: si el FAT no tiene GPS, se ubica por su dirección.
                direccion={mapa.direccion}
                urlBusqueda={mapa.url_busqueda}
                geocodificando={geocodificando}
                onGeocodificar={ubicarPorDireccion}
              />
            </>
          )}
          <div className="acciones-form">
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => void abrirMapa(mapa.id_falla)}
              disabled={cargandoMapa}
            >
              {cargandoMapa ? 'Cargando…' : 'Recargar ubicación'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Formulario de reporte manual (RF-16)                                */
/* ------------------------------------------------------------------ */

function FormularioMasivaManual({
  onCancelar,
  onCreada,
}: {
  onCancelar: () => void;
  onCreada: (falla: FallaMasivaOut, mensaje: string) => void;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [odn, setOdn] = useState('');
  const [olt, setOlt] = useState('');
  const [slot, setSlot] = useState('');
  const [puerto, setPuerto] = useState('');
  const [direccion, setDireccion] = useState('');
  const [fat, setFat] = useState('');
  const [extra, setExtra] = useState('');
  const [idSector, setIdSector] = useState('');
  const [idCuadrilla, setIdCuadrilla] = useState('');
  const [origen, setOrigen] = useState<OrigenFallaMasiva>('REPORTE_TECNICO');
  const [evidencias, setEvidencias] = useState<string[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [candidatos, setCandidatos] = useState<CasoCandidatoOut[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.allSettled([
      api.listarSectores({ solo_activos: true }),
      api.listarCuadrillas({ solo_activas: true }),
    ]).then(([sec, cua]) => {
      if (!vivo) return;
      setSectores(sec.status === 'fulfilled' ? sec.value : []);
      setCuadrillas(cua.status === 'fulfilled' ? cua.value : []);
      setCargandoCatalogos(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function buscarCandidatos() {
    if (!olt.trim() || !slot.trim() || !puerto.trim() || !fat.trim()) {
      setError('Complete OLT, SLOT, PUERTO y FAT para buscar los casos.');
      return;
    }
    setError('');
    setBuscando(true);
    try {
      const casos = await api.buscarCasosCandidatos({
        olt: olt.trim(),
        slot: slot.trim(),
        puerto: puerto.trim(),
        fat: fat.trim(),
        // D-168: si se indica el EXTRA (ruta), el buscador la exige idéntica.
        extra: extra.trim() === '' ? null : extra.trim(),
      });
      setCandidatos(casos);
      setSeleccionados([]);
      if (casos.length === 0) {
        setError('No hay casos de ese FAT. Verifique OLT, SLOT, PUERTO y FAT.');
      }
    } catch (e) {
      setError(detalleDe(e, 'No se pudieron buscar los casos de ese FAT.'));
    } finally {
      setBuscando(false);
    }
  }

  function alternarCaso(idCaso: number) {
    setSeleccionados((previo) =>
      previo.includes(idCaso)
        ? previo.filter((id) => id !== idCaso)
        : [...previo, idCaso],
    );
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (descripcion.trim().length < 5) {
      setError('La descripción es obligatoria y debe tener al menos 5 caracteres.');
      return;
    }
    if (!olt.trim() || !slot.trim() || !puerto.trim() || !fat.trim()) {
      setError('OLT, SLOT, PUERTO y FAT son obligatorios.');
      return;
    }
    if (direccion.trim().length < 5) {
      setError('Indique la dirección (mínimo 5 caracteres).');
      return;
    }
    if (seleccionados.length === 0) {
      setError('Asocie al menos un caso del FAT a la masiva.');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      const datos: FallaMasivaManual = {
        descripcion: descripcion.trim(),
        olt: olt.trim(),
        slot: slot.trim(),
        puerto: puerto.trim(),
        fat: fat.trim(),
        // D-168: quinto campo de la identidad técnica (ruta de la ingesta).
        extra: extra.trim() === '' ? null : extra.trim(),
        direccion: direccion.trim(),
        origen,
        odn: odn.trim() === '' ? null : odn.trim(),
        id_sector: idSector === '' ? null : Number(idSector),
        id_cuadrilla: idCuadrilla === '' ? null : Number(idCuadrilla),
        evidencias,
        ids_caso: seleccionados,
      };
      const creada = await api.reportarFallaManual(datos);
      onCreada(creada, `Masiva #${creada.id_falla} registrada manualmente.`);
    } catch (e) {
      setError(detalleDe(e, 'No se pudo registrar la masiva manual.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="formulario modal-formulario" onSubmit={(e) => void enviar(e)}>
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />

      <div className="campo campo-ancho">
        <label htmlFor="mas-manual-descripcion">Descripción * (mín. 5)</label>
        <textarea
          id="mas-manual-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
          minLength={5}
          maxLength={500}
          rows={3}
          placeholder="Ej.: corte de fibra en el FAT F-12, 24 servicios afectados"
        />
      </div>

      <div className="campo">
        <label htmlFor="mas-manual-olt">OLT *</label>
        <input
          id="mas-manual-olt"
          value={olt}
          onChange={(e) => setOlt(e.target.value)}
          required
          maxLength={60}
          placeholder="Ej.: OLT-NORTE-01"
        />
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-slot">SLOT *</label>
        <input
          id="mas-manual-slot"
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          required
          maxLength={20}
          placeholder="Ej.: 3"
        />
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-puerto">PUERTO *</label>
        <input
          id="mas-manual-puerto"
          value={puerto}
          onChange={(e) => setPuerto(e.target.value)}
          required
          maxLength={20}
          placeholder="Ej.: 7"
        />
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-fat">FAT *</label>
        <input
          id="mas-manual-fat"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
          required
          maxLength={60}
          placeholder="Ej.: F-12"
        />
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-extra">EXTRA (ruta de la ingesta · D-168)</label>
        <input
          id="mas-manual-extra"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          maxLength={120}
          placeholder="Ej.: TARJETA 3 / PUERTO 7 / FAT F-12"
        />
      </div>
      <div className="campo campo-ancho">
        <label htmlFor="mas-manual-direccion">Dirección * (mín. 5)</label>
        <input
          id="mas-manual-direccion"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          required
          minLength={5}
          maxLength={200}
          placeholder="Ej.: Av. Bolívar, entre calle 3 y 4"
        />
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-odn">ODN (opcional)</label>
        <input
          id="mas-manual-odn"
          value={odn}
          onChange={(e) => setOdn(e.target.value)}
          maxLength={60}
          placeholder="Ej.: ODN-01-02-03"
        />
      </div>

      <div className="campo campo-ancho">
        <div className="acciones-form">
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void buscarCandidatos()}
            disabled={buscando || !olt.trim() || !slot.trim() || !puerto.trim() || !fat.trim()}
          >
            {buscando ? 'Buscando…' : 'Buscar casos de ese FAT'}
          </button>
          <span className="texto-pequeno">
            {seleccionados.length} caso(s) seleccionado(s)
          </span>
        </div>
        {candidatos.length > 0 && (
          <div className="tabla-envoltura">
            <table className="masiva-tabla-densa">
              <thead>
                <tr>
                  <th>Asociar</th>
                  <th>Avería</th>
                  <th>Estado</th>
                  <th>OLT</th>
                  <th>Slot/Puerto</th>
                  <th>FAT</th>
                  <th>EXTRA</th>
                  <th>Dirección</th>
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c) => (
                  <tr key={c.id_caso}>
                    <td>
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(c.id_caso)}
                        onChange={() => alternarCaso(c.id_caso)}
                        aria-label={`Asociar el caso ${c.id_averia}`}
                      />
                    </td>
                    <td className="mono">{c.id_averia}</td>
                    <td>{c.estado_actual}</td>
                    <td className="mono">{c.olt ?? '—'}</td>
                    <td className="mono">
                      {[c.slot, c.puerto].filter(Boolean).join('/') || '—'}
                    </td>
                    <td className="mono">{c.fat ?? '—'}</td>
                    <td className="mono">{c.extra ?? '—'}</td>
                    <td>{c.direccion ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="campo">
        <label htmlFor="mas-manual-sector">Sector</label>
        <select
          id="mas-manual-sector"
          value={idSector}
          onChange={(e) => setIdSector(e.target.value)}
          disabled={cargandoCatalogos}
        >
          <option value="">Sin sector</option>
          {sectores.map((s) => (
            <option key={s.id_sector} value={s.id_sector}>
              {s.nombre} ({s.codigo})
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="mas-manual-cuadrilla">Cuadrilla</label>
        <select
          id="mas-manual-cuadrilla"
          value={idCuadrilla}
          onChange={(e) => setIdCuadrilla(e.target.value)}
          disabled={cargandoCatalogos}
        >
          <option value="">Sin cuadrilla</option>
          {cuadrillas.map((c) => (
            <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
              {c.codigo} — {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="mas-manual-origen">Origen</label>
        <select
          id="mas-manual-origen"
          value={origen}
          onChange={(e) => setOrigen(e.target.value as OrigenFallaMasiva)}
        >
          {ORIGENES_MASIVA.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <ListaEvidencias
        idBase="mas-manual"
        etiqueta="Evidencias (seriales)"
        valores={evidencias}
        onCambiar={setEvidencias}
        maximo={MAX_EVIDENCIAS_REPORTE}
      />

      <div className="acciones-form">
        <button
          type="submit"
          className="btn"
          disabled={
            enviando ||
            descripcion.trim().length < 5 ||
            !olt.trim() ||
            !slot.trim() ||
            !puerto.trim() ||
            !fat.trim() ||
            direccion.trim().length < 5 ||
            seleccionados.length === 0
          }
        >
          {enviando ? 'Registrando…' : 'Registrar masiva'}
        </button>
        <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
