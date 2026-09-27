import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const SECCIONES = [
  { ruta: '/', etiqueta: 'PANEL', fin: true },
  { ruta: '/ingesta', etiqueta: 'INGESTA', fin: false },
  { ruta: '/casos', etiqueta: 'CASOS', fin: false },
  { ruta: '/despacho', etiqueta: 'DESPACHO', fin: false },
  { ruta: '/especiales', etiqueta: 'ESPECIALES', fin: false },
  { ruta: '/agenda', etiqueta: 'AGENDA', fin: false },
  { ruta: '/central', etiqueta: 'CENTRAL', fin: false },
  { ruta: '/sectores', etiqueta: 'SECTORES', fin: false },
  { ruta: '/tecnicos', etiqueta: 'TÉCNICOS', fin: false },
  { ruta: '/flota', etiqueta: 'FLOTA', fin: false },
  { ruta: '/cuadrillas', etiqueta: 'CUADRILLAS', fin: false },
  { ruta: '/catalogos', etiqueta: 'CATÁLOGOS', fin: false },
  { ruta: '/parametros', etiqueta: 'PARÁMETROS', fin: false },
];

export default function Layout() {
  const { usuario, cerrarSesion, soloLectura } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="marca">
          <span className="marca-nombre">GGTO</span>
          <span className="marca-sub">— CANTV</span>
        </div>
        <div className="usuario-caja">
          <div className="usuario-datos">
            <span className="usuario-p00">{usuario?.p00}</span>
            <span className="chip">{usuario?.rol}</span>
          </div>
          <button type="button" className="btn btn-borde" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="app-cuerpo">
        <aside className="app-menu">
          <nav>
            {SECCIONES.map((s) => (
              <NavLink
                key={s.ruta}
                to={s.ruta}
                end={s.fin}
                className={({ isActive }) => `menu-item${isActive ? ' activo' : ''}`}
              >
                {s.etiqueta}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="app-contenido">
          {soloLectura && (
            <div className="aviso aviso-info">
              <span>Modo solo lectura: su rol TECNICO no permite crear ni modificar registros.</span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
