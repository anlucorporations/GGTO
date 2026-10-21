"""Geocodificación de direcciones para el mapa del FAT (D-145 · RF-60).

La sección MASIVAS muestra el FAT en un mapa. Hasta ahora solo se podía dibujar
cuando la masiva (o una evidencia) traía **coordenadas GPS**; con la dirección
—que casi siempre existe— el mapa quedaba vacío.

Este servicio resuelve la dirección con **Nominatim** (OpenStreetMap), que no
requiere clave. Es *best-effort*:

- timeout corto y una sola consulta por petición;
- si el servicio no responde o no encuentra la dirección devuelve `None` y la
  pantalla ofrece el enlace «buscar en OpenStreetMap» con el texto;
- el llamador decide si persiste o no el resultado (aquí no se escribe en la BD).
"""

from __future__ import annotations

import logging
import os

import httpx

log = logging.getLogger(__name__)

NOMINATIM_URL = os.environ.get(
    "GGTO_NOMINATIM_URL", "https://nominatim.openstreetmap.org/search"
)
#: Nominatim exige identificar la aplicación en el `User-Agent`.
USER_AGENT = os.environ.get(
    "GGTO_NOMINATIM_UA", "GGTO-Tecnico/1.0 (operacion@ggto.local)"
)
TIMEOUT_SEGUNDOS = 6.0


def normalizar_consulta(*partes: str | None) -> str:
    """Une las partes no vacías en una sola consulta legible."""
    trozos = [str(p).strip() for p in partes if p and str(p).strip()]
    return ", ".join(trozos)


def geocodificar(consulta: str, *, pais: str = "ve") -> tuple[float, float] | None:
    """Devuelve `(latitud, longitud)` de la primera coincidencia, o `None`."""
    texto = normalizar_consulta(consulta)
    if not texto:
        return None
    try:
        with httpx.Client(timeout=TIMEOUT_SEGUNDOS, headers={"User-Agent": USER_AGENT}) as cliente:
            respuesta = cliente.get(
                NOMINATIM_URL,
                params={
                    "q": texto,
                    "format": "jsonv2",
                    "limit": 1,
                    "countrycodes": pais,
                    "addressdetails": 0,
                },
            )
        if respuesta.status_code != 200:
            log.info("geocodificar: Nominatim respondió %s", respuesta.status_code)
            return None
        datos = respuesta.json()
    except Exception as exc:  # red, DNS, JSON inesperado…
        log.info("geocodificar: no se pudo consultar Nominatim (%s)", exc)
        return None
    if not isinstance(datos, list) or not datos:
        return None
    primero = datos[0]
    try:
        return float(primero["lat"]), float(primero["lon"])
    except (KeyError, TypeError, ValueError):
        return None


def url_mapa(latitud: float | None, longitud: float | None, zoom: int = 17) -> str | None:
    """Enlace a OpenStreetMap con el marcador (o `None` sin coordenadas)."""
    if latitud is None or longitud is None:
        return None
    return (
        f"https://www.openstreetmap.org/?mlat={latitud:.6f}&mlon={longitud:.6f}"
        f"#map={zoom}/{latitud:.6f}/{longitud:.6f}"
    )


def url_busqueda(consulta: str) -> str | None:
    """Enlace de búsqueda en OpenStreetMap para una dirección."""
    texto = normalizar_consulta(consulta)
    if not texto:
        return None
    from urllib.parse import quote

    return f"https://www.openstreetmap.org/search?query={quote(texto)}"
