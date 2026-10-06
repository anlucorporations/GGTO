/**
 * Pantalla principal del panel (D-81 · RF-42/43/44).
 *
 * Gestión diaria: **Asignadas vs. Cerradas por cuadrilla**, en modos **Común**
 * (`categoria=RESIDENCIAL`) y **Referidos**. Se **auto-refresca cada 30 s**
 * (pausa en segundo plano) y permite **agregar un caso especial** manualmente.
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import type { ClasificacionEspecial, GestionDiaria, PrioridadEspecial, TipoActividadEspecial } from '../api/types';
import Mensaje from './Mensaje';
import Modal from './Modal';
import { useAutoRefresh } from './useAutoRefresh';

export default function PanelGestionDiaria() {
  const [modo, setModo] = useState<'COMUN' | 'REFERIDOS'>('COMUN');
  const [datos, setDatos] = useState<GestionDiaria | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [altaAbierta, setAltaAbierta] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await api.gestionDiaria(undefined, modo));
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo leer la gestión diaria.');
    }
  }, [modo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // RF-42: auto-refresco cada 30 s (con pausa en segundo plano).
  useAutoRefresh(cargar, 30_000);

  return (
    <div className="panel-bloque">
      <div className="pagina-cabecera">
        <div>
          <h2>Gestión diaria — Asignadas vs. Cerradas por cuadrilla</h2>
          <p className="texto-pequeno">
            Se actualiza automáticamente cada 30 s.{datos ? ` Fecha: ${datos.fecha}.` : ''}
          </p>
        </div>
        <button className="btn" type="button" onClick={() => setAltaAbierta(true)}>
          Agregar caso especial
        </button>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      <div className="operacion-pestanas" role="tablist" aria-label="Modo de gestión">
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'COMUN'}
          className={`operacion-pestana${modo === 'COMUN' ? ' activa' : ''}`}
          onClick={() => setModo('COMUN')}
        >
          Común
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'REFERIDOS'}
          className={`operacion-pestana${modo === 'REFERIDOS' ? ' activa' : ''}`}
          onClick={() => setModo('REFERIDOS')}
        >
          Referidos
        </button>
      </div>

      {!datos ? (
        <p className="vacio">Cargando gestión diaria…</p>
      ) : (
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>Cuadrilla</th>
                <th>Asignadas</th>
                <th>Cerradas</th>
                <th>% cerrado</th>
              </tr>
            </thead>
            <tbody>
              {datos.cuadrillas.map((c) => (
                <tr key={c.id_cuadrilla}>
                  <td>
                    <strong>{c.codigo}</strong> · {c.nombre}
                    {c.es_supervisor ? ' (supervisor)' : ''}
                  </td>
                  <td>{c.asignadas}</td>
                  <td>{c.cerradas}</td>
                  <td>{c.porcentaje.toFixed(1)} %</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{datos.totales.asignadas}</strong>
                </td>
                <td>
                  <strong>{datos.totales.cerradas}</strong>
                </td>
                <td>
                  <strong>{datos.totales.porcentaje.toFixed(1)} %</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {altaAbierta && (
        <AltaCasoEspecial
          onCerrar={() => setAltaAbierta(false)}
          onCreado={(id) => {
            setAltaAbierta(false);
            setOk(id ? `Caso especial creado (#${id}).` : 'Caso especial creado.');
            void cargar();
          }}
        />
      )}
    </div>
  );
}

/** Formulario de alta manual de un caso especial (RF-44). */
function AltaCasoEspecial({
  onCerrar,
  onCreado,
}: {
  onCerrar: () => void;
  onCreado: (idCaso: number | null) => void;
}) {
  const [clasificacion, setClasificacion] = useState<ClasificacionEspecial>('REFERIDO');
  const [actividad, setActividad] = useState<TipoActividadEspecial>('REPARACION');
  const [prioridad, setPrioridad] = useState<PrioridadEspecial>('MEDIA');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setEnviando(true);
    setError('');
    try {
      const r = await api.crearCasoEspecial({
        clasificacion,
        tipo_actividad: actividad,
        prioridad,
        nombre_cliente: nombre || null,
        telefono: telefono || null,
        direccion: direccion || null,
      });
      onCreado(r.id_caso);
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo crear el caso especial.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Agregar caso especial" onCerrar={onCerrar}>
      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />
      <div className="formulario">
        <div className="campo">
          <label htmlFor="esp-clasificacion">Clasificación *</label>
          <select
            id="esp-clasificacion"
            value={clasificacion}
            onChange={(e) => setClasificacion(e.target.value as ClasificacionEspecial)}
          >
            <option value="REFERIDO">Referido</option>
            <option value="EMPRESA">Empresa</option>
            <option value="GOBIERNO">Gobierno</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="esp-actividad">Tipo de actividad *</label>
          <select
            id="esp-actividad"
            value={actividad}
            onChange={(e) => setActividad(e.target.value as TipoActividadEspecial)}
          >
            <option value="REPARACION">Reparación</option>
            <option value="CONSTRUCCION">Construcción</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="esp-prioridad">Prioridad</label>
          <select
            id="esp-prioridad"
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as PrioridadEspecial)}
          >
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="esp-nombre">Nombre del solicitante/cliente</label>
          <input id="esp-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="esp-telefono">Teléfono</label>
          <input id="esp-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="esp-direccion">Dirección</label>
          <input
            id="esp-direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </div>
        <div className="acciones-form">
          <button className="btn" type="button" onClick={() => void guardar()} disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear caso especial'}
          </button>
          <button className="btn btn-secundario" type="button" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
