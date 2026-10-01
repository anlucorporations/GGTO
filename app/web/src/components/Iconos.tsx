/**
 * Iconos SVG en línea (sin dependencias externas).
 *
 * Todos heredan `currentColor` y son decorativos (`aria-hidden`): el texto
 * accesible se aporta con `title`/`aria-label` en el elemento que los envuelve.
 */
import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

const base: Props = {
  viewBox: '0 0 24 24',
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

export function IconoPanel(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="10" width="7" height="11" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function IconoCasos(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function IconoEspeciales(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  );
}

export function IconoAgenda(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

export function IconoDespacho(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6.5h11v9H3z" />
      <path d="M14 9.5h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17.5" cy="18" r="1.8" />
    </svg>
  );
}

export function IconoIngesta(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  );
}

export function IconoMonitoreo(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </svg>
  );
}

export function IconoConfig(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.7l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.6z" />
    </svg>
  );
}

export function IconoBuscar(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </svg>
  );
}

export function IconoAgregar(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconoUsuario(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}

export function IconoSalir(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </svg>
  );
}

export function IconoChevronAbajo(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconoChevronIzquierda(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function IconoChevronDerecha(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconoCerrar(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/* --- Iconos de estado del listado (Pendiente/Asignado/Citado/Gestión) --- */

export function IconoPendiente(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconoAsignado(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.4 2.9-5.5 6.5-5.5" />
      <path d="M14.5 17.5l2 2 3.5-4" />
    </svg>
  );
}

export function IconoCitado(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M9 14.5l2 2 3.5-3.5" />
    </svg>
  );
}

export function IconoGestion(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 12.5h18" />
    </svg>
  );
}

/* --- Ciclo 9: ALERTAS --- */

export function IconoAlertas(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5c0 4-1.5 5.5-1.5 5.5h14s-1.5-1.5-1.5-5.5A5.5 5.5 0 0 0 12 3.5z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconoFalla(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />
    </svg>
  );
}

export function IconoSatelite(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11a8 8 0 0 1 8-8M3 5a14 14 0 0 1 14 14M5.5 17.5a1.5 1.5 0 1 0 0 .01" />
      <circle cx="5.5" cy="17.5" r="1.6" />
    </svg>
  );
}

export function IconoTelegram(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 4 3 11l5 1.8L10 19l2.8-3.4L18 19l3-15z" />
      <path d="M8 12.8 21 4l-9.5 8.6" />
    </svg>
  );
}

/* --- Ayuda (manual del sistema) --- */

export function IconoAyuda(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.4c-.7.3-1 .8-1 1.5v.4" />
      <path d="M12 16.8h.01" />
    </svg>
  );
}

/* --- Edición de la ficha (D-70) --- */

export function IconoEditar(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5V20z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  );
}

/* --- Tipo y Clase de caso; Prioridad y Actividad (D-72) --- */

/** Tipo · AVERÍA: rayo. */
export function IconoAveria(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />
    </svg>
  );
}

/** Tipo/Actividad · REPARACIÓN: llave inglesa. */
export function IconoReparacion(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 6.5a4 4 0 0 0-5.3 5.1L3.5 17.3a1.8 1.8 0 0 0 2.6 2.6l5.7-5.7a4 4 0 0 0 5.1-5.3l-2.4 2.4-2.1-.5-.5-2.1z" />
      <path d="M18.5 14.5 21 17" />
    </svg>
  );
}

/** Tipo/Actividad · CONSTRUCCIÓN: grúa. */
export function IconoConstruccion(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21h8M8 21V6M8 6l10-2.5M8 6l4 3.5" />
      <path d="M18 3.5v5M15.5 8.5h5l-2.5 4z" />
    </svg>
  );
}

/** Clase · RESIDENCIAL: casa. */
export function IconoResidencial(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M10.5 20v-5h3v5" />
    </svg>
  );
}

/** Clase · EMPRESA: edificio de oficinas. */
export function IconoEmpresa(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="3.5" width="9" height="17" rx="1" />
      <path d="M14 9.5h5V20.5H5" />
      <path d="M8 7.5h.01M8 11h.01M8 14.5h.01M11 7.5h.01M11 11h.01M11 14.5h.01" />
    </svg>
  );
}

/** Clase · REFERIDO: dos flechas cruzadas (traspaso). */
export function IconoReferido(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8.5h13l-3-3M20 15.5H7l3 3" />
    </svg>
  );
}

/** Clase · GOBIERNO: edificio público con columnas. */
export function IconoGobierno(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 9 12 4l8.5 5" />
      <path d="M6 9.5V17M10 9.5V17M14 9.5V17M18 9.5V17" />
      <path d="M4 20h16" />
    </svg>
  );
}

/** Prioridad · ALTA: flecha hacia arriba. */
export function IconoPrioridadAlta(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16V8m0 0-3.2 3.2M12 8l3.2 3.2" />
    </svg>
  );
}

/** Prioridad · MEDIA: guion doble. */
export function IconoPrioridadMedia(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10.5h7M8.5 13.5h7" />
    </svg>
  );
}

/** Prioridad · BAJA: flecha hacia abajo. */
export function IconoPrioridadBaja(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8m0 0-3.2-3.2M12 16l3.2-3.2" />
    </svg>
  );
}

/* --- Perfil y Cuenta (D-72) --- */

/** Seguridad: escudo. */
export function IconoEscudo(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 5.8v5.4c0 4.2 2.9 7.3 7 9.3 4.1-2 7-5.1 7-9.3V5.8z" />
      <path d="M9.2 12 11 13.8l3.8-4" />
    </svg>
  );
}

/** Clave: candado. */
export function IconoCandado(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      <path d="M12 14v3" />
    </svg>
  );
}

/** Perfil: usuario con marco (cuenta). */
export function IconoPerfil(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="9.5" r="3.5" />
      <path d="M5.5 19.5c0-3.4 2.9-5.2 6.5-5.2s6.5 1.8 6.5 5.2" />
      <circle cx="12" cy="12" r="9.5" strokeDasharray="2.2 2.6" />
    </svg>
  );
}

/** Actividad genérica (reloj de historial). */
export function IconoActividad(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
