/**
 * Pestaña WIDGET (ciclo D-72): sustituye a la antigua ficha PANEL.
 *
 * Muestra solo las fichas «Búsqueda rápida», «Reportes» y «Zona gestión
 * diaria». Las demás fichas se repartieron entre las pestañas INGESTA,
 * MONITOREO y ALERTAS de la página OPERACIÓN.
 */
import { useState, type FormEvent } from 'react';
import Mensaje from '../components/Mensaje';
import FichaRapida from '../components/FichaRapida';
import PanelGestionDiaria from '../components/PanelGestionDiaria';
import { useAuth } from '../auth/AuthContext';
import { BloqueGestionDiaria, BloqueReportes, hoyISO } from './Monitoreo';

export default function Widget() {
  const { usuario } = useAuth();
  const [termino, setTermino] = useState('');
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [fichaTermino, setFichaTermino] = useState<string | null>(null);

  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ');
  // El panel de gestión diaria es para SUPER/ADMIN/SUPERVISOR (D-81 · RF-43).
  const puedePanel = ['SUPER', 'ADMIN', 'SUPERVISOR'].includes(usuario?.rol ?? '');

  function buscarRapido(evento: FormEvent) {
    evento.preventDefault();
    const q = termino.trim();
    if (!q) {
      setErrorBusqueda('Indique un ID de avería o un teléfono para buscar.');
      return;
    }
    setErrorBusqueda('');
    setFichaTermino(q);
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Widget</h1>
          <p>
            Sesión de <strong>{nombreCompleto || usuario?.p00}</strong> · rol {usuario?.rol}
          </p>
        </div>
      </div>

      <Mensaje tipo="error" texto={errorBusqueda} onCerrar={() => setErrorBusqueda('')} />

      <div className="panel-bloque">
        <h2>Búsqueda rápida de casos</h2>
        <form className="formulario" onSubmit={buscarRapido}>
          <div className="campo">
            <label htmlFor="panel-busqueda">ID de avería o teléfono</label>
            <input
              id="panel-busqueda"
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              placeholder="Ej.: 202401234567 o 04141234567"
            />
          </div>
          <div className="acciones-form">
            <button className="btn" type="submit">
              Buscar
            </button>
          </div>
        </form>
        <p className="texto-pequeno">
          La ficha rápida muestra la información del caso en pestañas (Actual, Estado, Contacto y
          Técnico) y su cuadro de texto también permite refinar la búsqueda.
        </p>
      </div>

      {fichaTermino !== null && (
        <FichaRapida terminoInicial={fichaTermino} onCerrar={() => setFichaTermino(null)} />
      )}

      {puedePanel && <PanelGestionDiaria />}

      <BloqueReportes />

      <BloqueGestionDiaria fechaDia={hoyISO()} />
    </>
  );
}
