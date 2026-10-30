/**
 * Celdas con icono semántico para los listados (ciclo D-72 · D-103).
 *
 * «Cambia a iconos Tipo, Clase» (CASOS) y «Tipo, Actividad, Prioridad»
 * (ESPECIALES). Desde **D-103** los listados muestran los iconos del reporte
 * **juntos en una sola columna** (`CeldaReporte`) y **sin texto visible**, para
 * devolverle ancho a la Dirección; el nombre de cada valor no se pierde: va en el
 * `title` (ratón) y en el `aria-label` + texto oculto (lectores de pantalla),
 * como exigen RNF-09/RNF-23.
 *
 * Las variantes con etiqueta visible (`CeldaTipoCaso`, `CeldaClase`,
 * `CeldaActividad`, `CeldaPrioridad`) siguen disponibles para las vistas donde
 * hay espacio de sobra.
 */
import type { ComponentType, SVGProps } from 'react';
import {
  IconoActividad,
  IconoAveria,
  IconoConstruccion,
  IconoEmpresa,
  IconoGobierno,
  IconoPrioridadAlta,
  IconoPrioridadBaja,
  IconoPrioridadMedia,
  IconoReparacion,
  IconoReferido,
  IconoResidencial,
} from './Iconos';

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

/** Aspecto de un valor: clase CSS del color, nombre accesible y etiqueta corta. */
export interface AspectoIcono {
  clase: string;
  titulo: string;
  texto: string;
  Icono: Icono;
}

function conEtiqueta(etiqueta: string, { clase, texto, Icono }: AspectoIcono) {
  return (
    <span className={`celda-icono ${clase}`} title={`${etiqueta}: ${texto.toLowerCase()}`}>
      <Icono width={17} height={17} />
      <span className="etiqueta-icono">{texto}</span>
    </span>
  );
}

/** Icono solo: el texto va oculto para quien navega con lector de pantalla. */
function iconoSolo(aspecto: AspectoIcono) {
  const { clase, titulo, Icono: Ico } = aspecto;
  return (
    <span
      key={clase}
      className={`celda-icono celda-icono-solo ${clase}`}
      title={titulo}
      role="img"
      aria-label={titulo}
    >
      <Ico width={18} height={18} />
      <span className="visualmente-oculto">{titulo}</span>
    </span>
  );
}

/* ------------------------------ Aspectos ----------------------------- */

/** Tipo de caso: AVERÍA / REPARACIÓN / CONSTRUCCIÓN. */
export function aspectoTipoCaso(valor: string): AspectoIcono | null {
  switch (valor) {
    case 'AVERIA':
      return { clase: 'ci-tipo-AVERIA', titulo: 'Tipo: avería', texto: 'Avería', Icono: IconoAveria };
    case 'REPARACION':
      return {
        clase: 'ci-tipo-REPARACION',
        titulo: 'Tipo: reparación',
        texto: 'Reparación',
        Icono: IconoReparacion,
      };
    case 'CONSTRUCCION':
      return {
        clase: 'ci-tipo-CONSTRUCCION',
        titulo: 'Tipo: construcción',
        texto: 'Construcción',
        Icono: IconoConstruccion,
      };
    case 'MANTENIMIENTO':
      return {
        clase: 'ci-tipo-MANTENIMIENTO',
        titulo: 'Tipo: mantenimiento',
        texto: 'Mantenimiento',
        Icono: IconoActividad,
      };
    default:
      return null;
  }
}

/** Clase (categoría) del caso: RESIDENCIAL / EMPRESA / REFERIDO / GOBIERNO. */
export function aspectoClase(valor: string): AspectoIcono | null {
  switch (valor) {
    case 'RESIDENCIAL':
      return {
        clase: 'ci-clase-RESIDENCIAL',
        titulo: 'Clase: residencial',
        texto: 'Residencial',
        Icono: IconoResidencial,
      };
    case 'EMPRESA':
      return { clase: 'ci-clase-EMPRESA', titulo: 'Clase: empresa', texto: 'Empresa', Icono: IconoEmpresa };
    case 'REFERIDO':
      return { clase: 'ci-clase-REFERIDO', titulo: 'Clase: referido', texto: 'Referido', Icono: IconoReferido };
    case 'GOBIERNO':
      return {
        clase: 'ci-clase-GOBIERNO',
        titulo: 'Clase: gobierno',
        texto: 'Gobierno',
        Icono: IconoGobierno,
      };
    default:
      return null;
  }
}

/** Actividad del caso especial: REPARACIÓN / CONSTRUCCIÓN. */
export function aspectoActividad(valor: string): AspectoIcono | null {
  switch (valor) {
    case 'REPARACION':
      return {
        clase: 'ci-actividad-REPARACION',
        titulo: 'Actividad: reparación',
        texto: 'Reparación',
        Icono: IconoReparacion,
      };
    case 'CONSTRUCCION':
      return {
        clase: 'ci-actividad-CONSTRUCCION',
        titulo: 'Actividad: construcción',
        texto: 'Construcción',
        Icono: IconoConstruccion,
      };
    default:
      return null;
  }
}

/** Prioridad de un caso especial: ALTA / MEDIA / BAJA. */
export function aspectoPrioridad(valor: string): AspectoIcono | null {
  switch (valor) {
    case 'ALTA':
      return {
        clase: 'ci-prioridad-ALTA',
        titulo: 'Prioridad: alta',
        texto: 'Alta',
        Icono: IconoPrioridadAlta,
      };
    case 'MEDIA':
      return {
        clase: 'ci-prioridad-MEDIA',
        titulo: 'Prioridad: media',
        texto: 'Media',
        Icono: IconoPrioridadMedia,
      };
    case 'BAJA':
      return {
        clase: 'ci-prioridad-BAJA',
        titulo: 'Prioridad: baja',
        texto: 'Baja',
        Icono: IconoPrioridadBaja,
      };
    default:
      return null;
  }
}

/* --------------------------- Celdas listas --------------------------- */

/**
 * Columna **REPORTE** (D-103): los iconos que describen el reporte juntos y sin
 * texto, para dejar el ancho a Dirección y Sector.
 */
export function CeldaReporte({ aspectos }: { aspectos: (AspectoIcono | null)[] }) {
  const items = aspectos.filter((a): a is AspectoIcono => a !== null);
  if (items.length === 0) return <span className="tenue">—</span>;
  return <span className="celda-reporte">{items.map(iconoSolo)}</span>;
}

/* ------------------------ Variantes con etiqueta --------------------- */

export function CeldaTipoCaso({ valor }: { valor: string }) {
  const aspecto = aspectoTipoCaso(valor);
  return aspecto ? conEtiqueta('Tipo', aspecto) : <span className="celda-icono">{valor}</span>;
}

export function CeldaClase({ valor }: { valor: string }) {
  const aspecto = aspectoClase(valor);
  return aspecto ? conEtiqueta('Clase', aspecto) : <span className="celda-icono">{valor}</span>;
}

export function CeldaActividad({ valor }: { valor: string }) {
  const aspecto = aspectoActividad(valor);
  return aspecto ? conEtiqueta('Actividad', aspecto) : <span className="celda-icono">{valor}</span>;
}

export function CeldaPrioridad({ valor }: { valor: string }) {
  const aspecto = aspectoPrioridad(valor);
  return aspecto ? conEtiqueta('Prioridad', aspecto) : <span className="celda-icono">{valor}</span>;
}
