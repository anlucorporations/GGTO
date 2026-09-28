import { useCallback, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import BuscadorGlobal from './BuscadorGlobal';
import ModalCaso from './ModalCaso';
import { useCerrarDesplegable } from './useCerrarDesplegable';
import {
  IconoAgenda,
  IconoAgregar,
  IconoAlertas,
  IconoAyuda,
  IconoCasos,
  IconoChevronAbajo,
  IconoConfig,
  IconoDespacho,
  IconoEspeciales,
  IconoIngesta,
  IconoMonitoreo,
  IconoPanel,
  IconoSalir,
} from './Iconos';

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

interface Seccion {
  ruta: string;
  etiqueta: string;
  fin: boolean;
  Icono: Icono;
}

/** Secciones principales de la barra superior (RF-33 y Ciclos 4-7). */
const SECCIONES: Seccion[] = [
  { ruta: '/', etiqueta: 'PANEL', fin: true, Icono: IconoPanel },
  { ruta: '/casos', etiqueta: 'CASOS', fin: false, Icono: IconoCasos },
  { ruta: '/especiales', etiqueta: 'ESPECIALES', fin: false, Icono: IconoEspeciales },
  { ruta: '/agenda', etiqueta: 'AGENDA', fin: false, Icono: IconoAgenda },
  { ruta: '/despacho', etiqueta: 'DESPACHO', fin: false, Icono: IconoDespacho },
  { ruta: '/ingesta', etiqueta: 'INGESTA', fin: false, Icono: IconoIngesta },
  { ruta: '/monitoreo', etiqueta: 'MONITOREO', fin: false, Icono: IconoMonitoreo },
  { ruta: '/alertas', etiqueta: 'ALERTAS', fin: false, Icono: IconoAlertas },
  { ruta: '/ayuda', etiqueta: 'AYUDA', fin: false, Icono: IconoAyuda },
];

const CONFIGURACION: { ruta: string; etiqueta: string }[] = [
  { ruta: '/central', etiqueta: 'Central' },
  { ruta: '/sectores', etiqueta: 'Sectores' },
  { ruta: '/tecnicos', etiqueta: 'Técnicos' },
  { ruta: '/flota', etiqueta: 'Flota' },
  { ruta: '/cuadrillas', etiqueta: 'Cuadrillas' },
  { ruta: '/catalogos', etiqueta: 'Catálogos' },
  { ruta: '/parametros', etiqueta: 'Parámetros' },
];

const ROLES_CONFIG = ['SUPER', 'ADMIN', 'SUPERVISOR'];

/** Desplegable CONFIGURACIÓN (3.1), solo para SUPER, ADMIN y SUPERVISOR. */
function MenuConfiguracion() {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  useCerrarDesplegable(ref, abierto, cerrar);

  return (
    <div className="nav-desplegable" ref={ref}>
      <button
        type="button"
        className="nav-item nav-item-boton"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Configuración"
        title="Configuración"
        onClick={() => setAbierto((v) => !v)}
      >
        <IconoConfig />
        <span className="nav-etiqueta">CONFIGURACIÓN</span>
        <IconoChevronAbajo width={14} height={14} />
      </button>
      {abierto && (
        <div className="desplegable nav-menu" role="menu" aria-label="Configuración">
          {CONFIGURACION.map((s) => (
            <NavLink
              key={s.ruta}
              to={s.ruta}
              role="menuitem"
              className={({ isActive }) => `nav-menu-item${isActive ? ' activo' : ''}`}
              onClick={cerrar}
            >
              {s.etiqueta}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/** Menú del usuario (derecha): datos de la sesión y cierre de sesión. */
function MenuUsuario() {
  const { usuario, cerrarSesion, soloLectura } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  useCerrarDesplegable(ref, abierto, cerrar);

  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ');
  const visible = usuario?.nombre ?? usuario?.p00 ?? 'Usuario';
  const inicial = visible.charAt(0).toUpperCase();

  return (
    <div className="usuario-caja" ref={ref}>
      <button
        type="button"
        className="usuario-boton"
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Menú del usuario"
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="usuario-avatar" aria-hidden="true">
          {inicial}
        </span>
        <span className="usuario-texto">
          <span className="usuario-nombre">{visible}</span>
          <span className="usuario-rol">{usuario?.rol ?? ''}</span>
        </span>
        {soloLectura && <span className="insignia-lectura">solo lectura</span>}
        <IconoChevronAbajo width={16} height={16} />
      </button>
      {abierto && (
        <div className="desplegable usuario-menu" role="menu" aria-label="Sesión">
          <p className="usuario-menu-titulo">{nombreCompleto || usuario?.p00}</p>
          <dl className="usuario-menu-datos">
            <div>
              <dt>P00</dt>
              <dd className="mono">{usuario?.p00 ?? '—'}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{usuario?.correo ?? '—'}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{usuario?.rol ?? '—'}</dd>
            </div>
            <div>
              <dt>Central</dt>
              <dd>{usuario?.id_central ?? '—'}</dd>
            </div>
          </dl>
          {soloLectura && <p className="insignia-lectura insignia-lectura-bloque">solo lectura</p>}
          <button
            type="button"
            className="usuario-menu-salir"
            onClick={() => {
              cerrar();
              cerrarSesion();
            }}
          >
            <IconoSalir width={17} height={17} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { usuario, soloLectura } = useAuth();
  const [modalAbierto, setModalAbierto] = useState(false);
  const puedeConfigurar = ROLES_CONFIG.includes(usuario?.rol ?? '');

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="marca" aria-label="GGTO — CANTV, ir al panel">
          <span className="marca-nombre">GGTO</span>
          <span className="marca-sub">— CANTV</span>
        </Link>

        <BuscadorGlobal />

        <button
          type="button"
          className="btn btn-agregar"
          onClick={() => setModalAbierto(true)}
          disabled={soloLectura}
          aria-label="Agregar caso"
          title={soloLectura ? 'Solo lectura: su rol no permite crear casos' : 'Agregar caso'}
        >
          <IconoAgregar width={18} height={18} />
          <span className="btn-agregar-texto">Agregar caso</span>
        </button>

        <nav className="topbar-nav" aria-label="Secciones">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.ruta}
              to={s.ruta}
              end={s.fin}
              title={s.etiqueta}
              aria-label={s.etiqueta}
              className={({ isActive }) => `nav-item${isActive ? ' activo' : ''}`}
            >
              <s.Icono />
              <span className="nav-etiqueta">{s.etiqueta}</span>
            </NavLink>
          ))}
          {puedeConfigurar && <MenuConfiguracion />}
        </nav>

        <MenuUsuario />
      </header>

      <main className="app-contenido">
        {soloLectura && (
          <div className="aviso aviso-info">
            <span>
              Modo solo lectura: su rol TECNICO no permite crear ni modificar registros.
            </span>
          </div>
        )}
        <Outlet />
      </main>

      {modalAbierto && <ModalCaso onCerrar={() => setModalAbierto(false)} />}
    </div>
  );
}
