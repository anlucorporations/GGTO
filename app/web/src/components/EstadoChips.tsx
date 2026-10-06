/**
 * Chips de los cuatro iconos de estado del listado (Pendiente, Asignado/Cuadrilla,
 * Citado y Gestión). Los booleanos los calcula la API; un icono inactivo se
 * muestra atenuado.
 *
 * D-80: cuando el caso tiene cuadrilla asignada, el chip de «Asignado» se
 * sustituye por el **icono de la cuadrilla** pintado con su color.
 */
import { IconoAsignado, IconoCitado, IconoCuadrilla, IconoGestion, IconoPendiente } from './Iconos';
import { descripcionCuadrilla, etiquetaCuadrilla, tonoDeCuadrilla } from '../cuadrillas';

export interface EstadoChipsProps {
  pendiente: boolean;
  asignado: boolean;
  citado: boolean;
  gestion: boolean;
  /** D-80: datos de la cuadrilla para pintar el chip con su color. */
  id_cuadrilla?: number | null;
  cuadrilla_codigo?: string | null;
  cuadrilla_nombre?: string | null;
}

const DEFINICIONES = [
  { clave: 'pendiente', etiqueta: 'Pendiente', Icono: IconoPendiente, activo: 'activo-pendiente' },
  { clave: 'citado', etiqueta: 'Citado', Icono: IconoCitado, activo: 'activo-citado' },
  { clave: 'gestion', etiqueta: 'GestiÃ³n', Icono: IconoGestion, activo: 'activo-gestion' },
] as const;

export default function EstadoChips({
  pendiente,
  asignado,
  citado,
  gestion,
  id_cuadrilla,
  cuadrilla_codigo,
  cuadrilla_nombre,
}: EstadoChipsProps) {
  const valores: Record<(typeof DEFINICIONES)[number]['clave'], boolean> = {
    pendiente,
    citado,
    gestion,
  };

  const tono = tonoDeCuadrilla(cuadrilla_codigo, id_cuadrilla);
  const etiqueta = etiquetaCuadrilla(cuadrilla_codigo);
  const desc = descripcionCuadrilla(cuadrilla_codigo, cuadrilla_nombre);
  const tieneCuadrilla = id_cuadrilla != null && id_cuadrilla > 0;

  return (
    <div className="chips-estado">
      {DEFINICIONES.map(({ clave, etiqueta: lbl, Icono, activo }) => {
        const on = valores[clave];
        return (
          <span
            key={clave}
            role="img"
            className={`chip-icono ${on ? `activo ${activo}` : 'inactivo'}`}
            title={`${lbl}: ${on ? 'sÃ­' : 'no'}`}
            aria-label={`${lbl}: ${on ? 'sÃ­' : 'no'}`}
          >
            <Icono width={16} height={16} />
          </span>
        );
      })}

      {/* D-80: chip de Asignado o de Cuadrilla (Ãºltimo para mantener el orden visual) */}
      {tieneCuadrilla ? (
        <span
          role="img"
          className={`chip-icono activo tono-${tono}`}
          data-cuadrilla={etiqueta}
          title={desc}
          aria-label={desc}
        >
          <IconoCuadrilla width={16} height={16} />
          <span className="chip-etiqueta">{etiqueta}</span>
        </span>
      ) : (
        <span
          role="img"
          className={`chip-icono ${asignado ? 'activo activo-asignado' : 'inactivo'}`}
          title={`Asignado: ${asignado ? 'sÃ­' : 'no'}`}
          aria-label={`Asignado: ${asignado ? 'sÃ­' : 'no'}`}
        >
          <IconoAsignado width={16} height={16} />
        </span>
      )}
    </div>
  );
}
