import { useCallback, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { CasoOut } from '../api/types';
import BuscadorGlobal from './BuscadorGlobal';
import FichaRapida from './FichaRapida';
import ModalCaso from './ModalCaso';
import { useCerrarDesplegable } from './useCerrarDesplegable';
import {
  IconoAgenda,
  IconoAgregar,
  IconoAyuda,
  IconoCasos,
  IconoChevronAbajo,
  IconoConfig,
  IconoDespacho,
  IconoEspeciales,
  IconoPanel,
  IconoPerfil,
  IconoSalir,
} from './Iconos';

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

/** Roles de gestión: ven CONFIGURACIÓN y DESPACHO (D-72). SUPER tiene acceso total. */
const ROLES_CONFIG = ['SUPER', 'ADMIN', 'SUPERVISOR'];

interface Seccion {
  ruta: string;
  etiqueta: string;
  fin: boolean;
  Icono: Icono;
  /** Roles que ven la sección en la barra; `null` = todos (D-72). */
  roles: string[] | null;
}

/**
 * Secciones principales de la barra superior (RF-33).
 * OPERACIÓN fusiona PANEL, INGESTA, MONITOREO y ALERTAS en una sola página con
 * pestañas (ciclo D-72). DESPACHO no se muestra al rol TECNICO (requisito 5).
 */
const SECCIONES: Seccion[] = [
  { ruta: '/', etiqueta: 'OPERACIÓN', fin: true, Icono: IconoPanel, roles: null },
  { ruta: '/casos', etiqueta: 'CASOS', fin: false, Icono: IconoCasos, roles: null },
  { ruta: '/especiales', etiqueta: 'ESPECIALES', fin: false, Icono: IconoEspeciales, roles: null },
  { ruta: '/agenda', etiqueta: 'AGENDA', fin: false, Icono: IconoAgenda, roles: null },
  { ruta: '/despacho', etiqueta: 'DESPACHO', fin: false, Icono: IconoDespacho, roles: ROLES_CONFIG },
  { ruta: '/ayuda', etiqueta: 'AYUDA', fin: false, Icono: IconoAyuda, roles: null },
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
        <IconoConfig className="nav-icono" />
        <span className="nav-etiqueta">CONFIGURACIÓN</span>
        <IconoChevronAbajo className="nav-chevron" width={14} height={14} />
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
          {/* Perfil y Cuenta (D-72): datos, cambio de clave y palabras. */}
          <Link to="/perfil" role="menuitem" className="usuario-menu-item" onClick={cerrar}>
            <IconoPerfil width={17} height={17} />
            Perfil y Cuenta
          </Link>
          {/* SISTEMAS: el acceso solo se muestra al Super Usuario (D-69). */}
          {usuario?.rol === 'SUPER' && (
            <Link
              to="/sistemas"
              role="menuitem"
              className="usuario-menu-item"
              onClick={cerrar}
            >
              <IconoConfig width={17} height={17} />
              Sistemas
            </Link>
          )}
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
  const [fichaGlobal, setFichaGlobal] = useState<CasoOut | null>(null);
  const rol = usuario?.rol ?? '';
  const puedeConfigurar = ROLES_CONFIG.includes(rol);
  // D-72: DESPACHO (y CONFIGURACIÓN) quedan fuera del alcance del Técnico.
  const seccionesVisibles = SECCIONES.filter((s) => s.roles === null || s.roles.includes(rol));

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="marca" aria-label="GGTO — CANTV, ir al panel">
          <span className="marca-nombre">GGTO</span>
          <span className="marca-sub">— CANTV</span>
        </Link>

        <BuscadorGlobal onAbrirCaso={setFichaGlobal} />

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
          {seccionesVisibles.map((s) => (
            <NavLink
              key={s.ruta}
              to={s.ruta}
              end={s.fin}
              title={s.etiqueta}
              aria-label={s.etiqueta}
              className={({ isActive }) => `nav-item${isActive ? ' activo' : ''}`}
            >
              <s.Icono className="nav-icono" />
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
      {fichaGlobal && (
        <FichaRapida
          idCasoInicial={fichaGlobal.id_caso}
          onCerrar={() => setFichaGlobal(null)}
        />
      )}
    </div>
  );
}
