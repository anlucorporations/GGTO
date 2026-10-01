/**
 * Página OPERACIÓN reorganizada en pestañas (ciclo D-72).
 *
 * Antes (D-65) las cuatro sub-secciones estaban apiladas con anclas. Ahora son
 * **pestañas**: en pantalla solo aparece la información de la sub-sección
 * seleccionada.
 *
 *  - WIDGET   : las 3 fichas del antiguo PANEL (búsqueda, resumen y tarjetas).
 *  - INGESTA  : carga del CSV + zonas de casos globales y capacidad operativa.
 *               Solo SUPER / ADMIN / SUPERVISOR (RF: requisito 1.2 del D-72).
 *  - MONITOREO: fichas de monitoreo de casos (el técnico ve solo su cuadrilla,
 *               el supervisor ve lo global).
 *  - ALERTAS  : fichas de alertas diarias, bandeja de notificaciones y fallas.
 *
 * Las rutas antiguas (`/ingesta`, `/monitoreo`, `/alertas`) siguen redirigiendo
 * aquí en `App.tsx`, ahora seleccionando la pestaña mediante la consulta
 * `?pestana=` para no romper enlaces.
 */
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Widget from './Widget';
import TabIngesta from './TabIngesta';
import Monitoreo from './Monitoreo';
import Alertas from './Alertas';

type PEstanaId = 'widget' | 'ingesta' | 'monitoreo' | 'alertas';

interface PEstana {
  id: PEstanaId;
  etiqueta: string;
  /** Roles que ven la pestaña; `null` = todos. */
  roles: string[] | null;
}

const PESTANAS: PEstana[] = [
  { id: 'widget', etiqueta: 'Widget', roles: null },
  { id: 'ingesta', etiqueta: 'Ingesta', roles: ['SUPER', 'ADMIN', 'SUPERVISOR'] },
  { id: 'monitoreo', etiqueta: 'Monitoreo', roles: null },
  { id: 'alertas', etiqueta: 'Alertas', roles: null },
];

export default function Operacion() {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const rol = usuario?.rol ?? '';

  const visibles = PESTANAS.filter((p) => p.roles === null || p.roles.includes(rol));

  const solicitado = params.get('pestana') as PEstanaId | null;
  // La pestaña activa debe ser una visible; si se pidió una restringida (p. ej.
  // ingesta para un técnico) se cae a la primera visible.
  const activa =
    solicitado && visibles.some((p) => p.id === solicitado) ? solicitado : visibles[0].id;

  function seleccionar(id: PEstanaId) {
    const siguiente = new URLSearchParams(params);
    siguiente.set('pestana', id);
    setParams(siguiente, { replace: true });
  }

  return (
    <>
      <nav className="operacion-pestanas" role="tablist" aria-label="Sub-secciones de Operación">
        {visibles.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={activa === p.id}
            className={`operacion-pestana${activa === p.id ? ' activa' : ''}`}
            onClick={() => seleccionar(p.id)}
          >
            {p.etiqueta}
          </button>
        ))}
      </nav>

      {/* El id reproduce los anclajes históricos (#ingesta/#monitoreo/#alertas)
          para enlaces y pruebas E2E anteriores (D-72). */}
      <div className="operacion-panel" role="tabpanel" id={activa}>
        {activa === 'widget' && <Widget />}
        {activa === 'ingesta' && <TabIngesta />}
        {activa === 'monitoreo' && <Monitoreo />}
        {activa === 'alertas' && <Alertas />}
      </div>
    </>
  );
}
