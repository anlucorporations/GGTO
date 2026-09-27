/**
 * Chips de los cuatro iconos de estado del listado (Pendiente, Asignado,
 * Citado y Gestión). Los booleanos los calcula la API; un icono inactivo se
 * muestra atenuado.
 */
import { IconoAsignado, IconoCitado, IconoGestion, IconoPendiente } from './Iconos';

export interface EstadoChipsProps {
  pendiente: boolean;
  asignado: boolean;
  citado: boolean;
  gestion: boolean;
}

const DEFINICIONES = [
  { clave: 'pendiente', etiqueta: 'Pendiente', Icono: IconoPendiente, activo: 'activo-pendiente' },
  { clave: 'asignado', etiqueta: 'Asignado', Icono: IconoAsignado, activo: 'activo-asignado' },
  { clave: 'citado', etiqueta: 'Citado', Icono: IconoCitado, activo: 'activo-citado' },
  { clave: 'gestion', etiqueta: 'Gestión', Icono: IconoGestion, activo: 'activo-gestion' },
] as const;

export default function EstadoChips({ pendiente, asignado, citado, gestion }: EstadoChipsProps) {
  const valores: Record<(typeof DEFINICIONES)[number]['clave'], boolean> = {
    pendiente,
    asignado,
    citado,
    gestion,
  };
  return (
    <div className="chips-estado">
      {DEFINICIONES.map(({ clave, etiqueta, Icono, activo }) => {
        const on = valores[clave];
        return (
          <span
            key={clave}
            role="img"
            className={`chip-icono ${on ? `activo ${activo}` : 'inactivo'}`}
            title={`${etiqueta}: ${on ? 'sí' : 'no'}`}
            aria-label={`${etiqueta}: ${on ? 'sí' : 'no'}`}
          >
            <Icono width={16} height={16} />
          </span>
        );
      })}
    </div>
  );
}
