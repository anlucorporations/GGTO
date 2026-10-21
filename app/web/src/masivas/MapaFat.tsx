/**
 * Mapa Leaflet del FAT afectado por una masiva (D-99 · RF-60).
 *
 * Dibuja en OpenStreetMap la ubicación del FAT (marcador rojo) y, si la API
 * devuelve puntos GPS tomados de las evidencias de la APK, un marcador azul
 * por cada uno.
 *
 * Los iconos se construyen con `L.divIcon` (HTML propio) en lugar de las
 * imágenes que trae Leaflet por defecto: con Vite esas rutas relativas se
 * rompen al compilar. Así no se depende de ningún asset binario.
 *
 * Si la masiva no tiene coordenadas se muestra un aviso en vez del mapa.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Punto GPS adicional (evidencias) que dibuja la API en `/ubicacion`. */
export interface PuntoMasiva {
  tipo: string;
  latitud: number | null;
  longitud: number | null;
  serial?: string;
  fecha_hora?: string | null;
}

interface Props {
  latitud: number | null;
  longitud: number | null;
  /** Texto del globo del marcador principal (por defecto «FAT»). */
  etiqueta?: string;
  /** Puntos GPS de las evidencias. */
  puntos?: PuntoMasiva[];
  /** D-145: dirección del FAT (se usa cuando no hay coordenadas). */
  direccion?: string | null;
  /** D-145: enlace de búsqueda en OpenStreetMap calculado por el servidor. */
  urlBusqueda?: string | null;
  /** D-145: resolver la dirección y redibujar el mapa (lo hace el contenedor). */
  onGeocodificar?: () => void;
  /** ¿Se está resolviendo la dirección? */
  geocodificando?: boolean;
}

/** Quita los caracteres que podrían inyectar HTML en el globo del marcador. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function MapaFat({
  latitud,
  longitud,
  etiqueta,
  puntos = [],
  direccion = null,
  urlBusqueda = null,
  onGeocodificar,
  geocodificando = false,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);

  // El arreglo `puntos` suele recrearse en cada render del padre: se usa su
  // contenido serializado como dependencia para no reconstruir el mapa.
  const clavePuntos = JSON.stringify(puntos);

  useEffect(() => {
    if (latitud === null || longitud === null) return;
    const nodo = contenedor.current;
    if (!nodo) return;

    const mapa = L.map(nodo, { scrollWheelZoom: false }).setView([latitud, longitud], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);

    const iconoFat = L.divIcon({
      className: 'masiva-marcador',
      html: '<span></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
    L.marker([latitud, longitud], { icon: iconoFat, title: etiqueta ?? 'FAT' })
      .addTo(mapa)
      .bindPopup(escapar(etiqueta && etiqueta.trim() !== '' ? etiqueta : 'FAT afectado'));

    const iconoPunto = L.divIcon({
      className: 'masiva-marcador masiva-marcador-punto',
      html: '<span></span>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -8],
    });
    for (const punto of puntos) {
      if (punto.latitud === null || punto.longitud === null) continue;
      const partes = [punto.tipo];
      if (punto.serial) partes.push(`Serial: ${punto.serial}`);
      if (punto.fecha_hora) partes.push(punto.fecha_hora.replace('T', ' ').slice(0, 19));
      L.marker([punto.latitud, punto.longitud], { icon: iconoPunto })
        .addTo(mapa)
        .bindPopup(escapar(partes.join(' · ')));
    }

    return () => {
      mapa.remove();
    };
    // `clavePuntos` resume el contenido de `puntos` para evitar reconstrucciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitud, longitud, etiqueta, clavePuntos]);

  if (latitud === null || longitud === null) {
    // D-145: sin coordenadas se ofrece ubicar el FAT **por la dirección**.
    return (
      <div className="masiva-mapa-aviso" role="status">
        <span>
          Sin coordenadas registradas para el FAT.
          {direccion
            ? ' Se puede ubicar en el mapa a partir de su dirección.'
            : ' La ubicación se completa cuando la cuadrilla reporta el GPS desde la aplicación móvil o al registrar la evidencia.'}
        </span>
        {direccion && (
          <div className="acciones-form">
            {onGeocodificar && (
              <button
                type="button"
                className="btn btn-secundario"
                onClick={onGeocodificar}
                disabled={geocodificando}
              >
                {geocodificando ? 'Ubicando…' : 'Ubicar por la dirección'}
              </button>
            )}
            {urlBusqueda && (
              <a className="btn btn-secundario" href={urlBusqueda} target="_blank" rel="noreferrer">
                Buscar en OpenStreetMap
              </a>
            )}
          </div>
        )}
        {direccion && (
          <p className="texto-pequeno">
            Dirección del FAT: <strong>{direccion}</strong>
          </p>
        )}
      </div>
    );
  }

  const conPunto = puntos.filter((p) => p.latitud !== null && p.longitud !== null);

  return (
    <>
      <div className="masiva-mapa" ref={contenedor} aria-label="Mapa del FAT afectado" />
      <div className="masiva-mapa-pie">
        <span className="masiva-leyenda">
          <span className="masiva-leyenda-punto fat" aria-hidden="true" /> FAT afectado
        </span>
        {conPunto.length > 0 && (
          <span className="masiva-leyenda">
            <span className="masiva-leyenda-punto evidencia" aria-hidden="true" />
            {conPunto.length} evidencia(s) con GPS
          </span>
        )}
        <span>
          Coordenadas: <span className="mono">{latitud.toFixed(6)}</span>,{' '}
          <span className="mono">{longitud.toFixed(6)}</span>
        </span>
        <a
          className="texto-pequeno"
          href={`https://www.openstreetmap.org/?mlat=${latitud.toFixed(6)}&mlon=${longitud.toFixed(
            6,
          )}#map=17/${latitud.toFixed(6)}/${longitud.toFixed(6)}`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir en OpenStreetMap
        </a>
      </div>
    </>
  );
}
