/**
 * Página OPERACIÓN como **tablero de fichas** (D-103).
 *
 * Antes (D-72) las sub-secciones eran **pestañas**: en pantalla solo se veía una.
 * Ahora cada sub-sección es un **widget dentro de su ficha**, todas en la misma
 * página, con su icono en la cabecera; así el supervisor ve de un vistazo la
 * ingesta, el monitoreo y las alertas sin cambiar de pestaña.
 *
 *  - WIDGET   : búsqueda rápida, reportes y zona de gestión diaria.
 *  - INGESTA  : carga del CSV y zonas de casos. Solo SUPER / ADMIN / SUPERVISOR.
 *  - MONITOREO: fichas de monitoreo (el técnico ve su cuadrilla).
 *  - ALERTAS  : alertas diarias, bandeja y fallas.
 *
 * **Compatibilidad:** las rutas antiguas (`/ingesta`, `/monitoreo`, `/alertas`)
 * siguen redirigiendo aquí con `?pestana=<id>`; ese parámetro ya no oculta nada,
 * solo **desplaza la vista hasta la ficha** pedida. Los identificadores
 * `#ingesta`, `#monitoreo` y `#alertas` se conservan.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconoAlertas, IconoIngesta, IconoMonitoreo, IconoPanel } from '../components/Iconos';
import Widget from './Widget';
import TabIngesta from './TabIngesta';
import Monitoreo from './Monitoreo';
import Alertas from './Alertas';

type PEstanaId = 'widget' | 'ingesta' | 'monitoreo' | 'alertas';

interface PEstana {
  id: PEstanaId;
  etiqueta: string;
  /** Texto de la cabecera de la ficha. */
  descripcion: string;
  Icono: typeof IconoPanel;
  /** Roles que ven la ficha; `null` = todos. */
  roles: string[] | null;
}

const PESTANAS: PEstana[] = [
  {
    id: 'widget',
    etiqueta: 'Widget',
    descripcion: 'Reportes y zona de gestión diaria.',
    Icono: IconoPanel,
    roles: ['SUPER', 'ADMIN', 'SUPERVISOR', 'TECNICO'],
  },
  {
    id: 'ingesta',
    etiqueta: 'Ingesta',
    descripcion: 'Carga del CSV diario, zonas de casos globales y capacidad operativa.',
    Icono: IconoIngesta,
    roles: ['SUPER', 'ADMIN', 'SUPERVISOR'],
  },
  {
    id: 'monitoreo',
    etiqueta: 'Monitoreo',
    descripcion: 'Producción del día: casos, cuadrillas y tendencia semanal.',
    Icono: IconoMonitoreo,
    roles: null,
  },
  {
    id: 'alertas',
    etiqueta: 'Alertas',
    descripcion: 'Avisos del día, bandeja de notificaciones y fallas reportadas.',
    Icono: IconoAlertas,
    roles: null,
  },
];

export default function Operacion() {
  const { usuario } = useAuth();
  const [params] = useSearchParams();
  const rol = usuario?.rol ?? '';
  const solicitada = params.get('pestana') as PEstanaId | null;

  const visibles = PESTANAS.filter((p) => p.roles === null || p.roles.includes(rol));

  // Un enlace con `?pestana=monitoreo` lleva until esa ficha (antes la abría
  // como pestaña). Si la ficha no existe para el rol, no se hace nada.
  useEffect(() => {
    if (!solicitada) return;
    if (!visibles.some((p) => p.id === solicitada)) return;
    const nodo = document.getElementById(solicitada);
    if (nodo) nodo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // `visibles` se recalcula con el rol: basta con vigilar el parámetro y el rol.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitada, rol]);

  return (
    <>
      {visibles.map((p) => (
        <section
          key={p.id}
          className="ficha-operacion"
          id={p.id}
          aria-labelledby={`titulo-${p.id}`}
        >
          <header className="ficha-operacion-cabecera">
            <span className="ficha-operacion-icono" aria-hidden="true">
              <p.Icono width={22} height={22} />
            </span>
            <div className="ficha-operacion-titulo">
              <h2 id={`titulo-${p.id}`}>{p.etiqueta}</h2>
              <p>{p.descripcion}</p>
            </div>
          </header>
          <div className="ficha-operacion-cuerpo">
            {p.id === 'widget' && <Widget />}
            {p.id === 'ingesta' && <TabIngesta />}
            {p.id === 'monitoreo' && <Monitoreo />}
            {p.id === 'alertas' && <Alertas />}
          </div>
        </section>
      ))}
    </>
  );
}
