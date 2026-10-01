/**
 * Celdas con icono semántico para los listados (ciclo D-72).
 *
 * «Cambia a iconos Tipo, Clase» (CASOS) y «Tipo, Prioridad, Actividad»
 * (ESPECIALES): el valor se representa con su icono + etiqueta breve para no
 * perder legibilidad ni accesibilidad (RNF-09/RNF-23).
 */
import type { ComponentType, SVGProps } from 'react';
import {
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

function Celda({
  clase,
  titulo,
  texto,
  Icono: Ico,
}: {
  clase: string;
  titulo: string;
  texto: string;
  Icono: Icono;
}) {
  return (
    <span className={`celda-icono ${clase}`} title={titulo}>
      <Ico width={17} height={17} />
      <span className="etiqueta-icono">{texto}</span>
    </span>
  );
}

/** Tipo de caso: AVERÍA / REPARACIÓN / CONSTRUCCIÓN. */
export function CeldaTipoCaso({ valor }: { valor: string }) {
  if (valor === 'AVERIA')
    return <Celda clase="ci-tipo-AVERIA" titulo="Tipo: avería" texto="Avería" Icono={IconoAveria} />;
  if (valor === 'REPARACION')
    return (
      <Celda
        clase="ci-tipo-REPARACION"
        titulo="Tipo: reparación"
        texto="Reparación"
        Icono={IconoReparacion}
      />
    );
  if (valor === 'CONSTRUCCION')
    return (
      <Celda
        clase="ci-tipo-CONSTRUCCION"
        titulo="Tipo: construcción"
        texto="Construcción"
        Icono={IconoConstruccion}
      />
    );
  return <span className="celda-icono">{valor}</span>;
}

/** Clase (categoría) del caso: RESIDENCIAL / EMPRESA / REFERIDO / GOBIERNO. */
export function CeldaClase({ valor }: { valor: string }) {
  if (valor === 'RESIDENCIAL')
    return (
      <Celda
        clase="ci-clase-RESIDENCIAL"
        titulo="Clase: residencial"
        texto="Residencial"
        Icono={IconoResidencial}
      />
    );
  if (valor === 'EMPRESA')
    return <Celda clase="ci-clase-EMPRESA" titulo="Clase: empresa" texto="Empresa" Icono={IconoEmpresa} />;
  if (valor === 'REFERIDO')
    return (
      <Celda clase="ci-clase-REFERIDO" titulo="Clase: referido" texto="Referido" Icono={IconoReferido} />
    );
  if (valor === 'GOBIERNO')
    return (
      <Celda
        clase="ci-clase-GOBIERNO"
        titulo="Clase: gobierno"
        texto="Gobierno"
        Icono={IconoGobierno}
      />
    );
  return <span className="celda-icono">{valor}</span>;
}

/** Prioridad de un caso especial: ALTA / MEDIA / BAJA. */
export function CeldaPrioridad({ valor }: { valor: string }) {
  if (valor === 'ALTA')
    return (
      <Celda
        clase="ci-prioridad-ALTA"
        titulo="Prioridad: alta"
        texto="Alta"
        Icono={IconoPrioridadAlta}
      />
    );
  if (valor === 'MEDIA')
    return (
      <Celda
        clase="ci-prioridad-MEDIA"
        titulo="Prioridad: media"
        texto="Media"
        Icono={IconoPrioridadMedia}
      />
    );
  if (valor === 'BAJA')
    return (
      <Celda
        clase="ci-prioridad-BAJA"
        titulo="Prioridad: baja"
        texto="Baja"
        Icono={IconoPrioridadBaja}
      />
    );
  return <span className="celda-icono">{valor}</span>;
}

/** Actividad del caso especial: REPARACIÓN / CONSTRUCCIÓN. */
export function CeldaActividad({ valor }: { valor: string }) {
  if (valor === 'REPARACION')
    return (
      <Celda
        clase="ci-actividad-REPARACION"
        titulo="Actividad: reparación"
        texto="Reparación"
        Icono={IconoReparacion}
      />
    );
  if (valor === 'CONSTRUCCION')
    return (
      <Celda
        clase="ci-actividad-CONSTRUCCION"
        titulo="Actividad: construcción"
        texto="Construcción"
        Icono={IconoConstruccion}
      />
    );
  return <span className="celda-icono">{valor}</span>;
}
