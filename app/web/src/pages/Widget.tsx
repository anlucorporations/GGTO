/**
 * Pestaña WIDGET (ciclo D-72): sustituye a la antigua ficha PANEL.
 *
 * Muestra las fichas «Reportes» y «Zona gestión diaria». La búsqueda rápida se
 * retiró de OPERACIÓN: el listado de CASOS ya ofrece la búsqueda y la ficha
 * completa, sin duplicar formularios.
 */
import { useAuth } from '../auth/AuthContext';
import PanelGestionDiaria from '../components/PanelGestionDiaria';
import { BloqueGestionDiaria, BloqueReportes, hoyISO } from './Monitoreo';

export default function Widget() {
  const { usuario } = useAuth();

  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ');
  // El panel de gestión diaria es para SUPER/ADMIN/SUPERVISOR (D-81 · RF-43).
  const puedePanel = ['SUPER', 'ADMIN', 'SUPERVISOR'].includes(usuario?.rol ?? '');

  return (
    <>
      {/* Portada de marca (fase 4 de la propuesta visual): la banda lleva el
          logotipo CANTV y la trama; el titular lo sigue poniendo la página. */}
      <img
        className="banda-marca"
        src="/marca/banda-widget.svg"
        alt="GGTO · CANTV — gestión de averías y puntos ópticos de la Central Francisco Salias"
        width={1920}
        height={220}
      />

      <div className="pagina-cabecera">
        <div>
          <h1>Widget</h1>
          <p>
            Sesión de <strong>{nombreCompleto || usuario?.p00}</strong> · rol {usuario?.rol}
          </p>
        </div>
      </div>

      {puedePanel && <PanelGestionDiaria />}

      <BloqueReportes />

      <BloqueGestionDiaria fechaDia={hoyISO()} />
    </>
  );
}
