/**
 * Página OPERACIÓN (requisito de UI 2 del ciclo D-65).
 *
 * Fusiona las antiguas secciones PANEL, INGESTA, MONITOREO y ALERTAS en una
 * sola página con las cuatro apiladas y una barra de anclas para saltar entre
 * ellas. Las rutas antiguas (`/ingesta`, `/monitoreo`, `/alertas`) redirigen
 * aquí para no romper enlaces.
 */
import Panel from './Panel';
import Ingesta from './Ingesta';
import Monitoreo from './Monitoreo';
import Alertas from './Alertas';

const ANCLAS = [
  { id: 'panel', etiqueta: 'Panel' },
  { id: 'ingesta', etiqueta: 'Ingesta' },
  { id: 'monitoreo', etiqueta: 'Monitoreo' },
  { id: 'alertas', etiqueta: 'Alertas' },
];

export default function Operacion() {
  return (
    <>
      <nav className="operacion-anclas" aria-label="Secciones de Operación">
        {ANCLAS.map((a) => (
          <a key={a.id} href={`#${a.id}`}>
            {a.etiqueta}
          </a>
        ))}
      </nav>

      <section id="panel" className="operacion-seccion" aria-label="Panel">
        <Panel />
      </section>

      <section id="ingesta" className="operacion-seccion" aria-label="Ingesta">
        <Ingesta />
      </section>

      <section id="monitoreo" className="operacion-seccion" aria-label="Monitoreo">
        <Monitoreo />
      </section>

      <section id="alertas" className="operacion-seccion" aria-label="Alertas">
        <Alertas />
      </section>
    </>
  );
}
