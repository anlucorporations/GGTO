#!/usr/bin/env python3
"""Genera las fotos de internet que usa la prueba de campo (D-112).

La prueba de campo de la APK inyecta **fotos reales y de poco peso** en el
selector de imágenes (doble de `image_picker`), de modo que la app las guarda,
las sube y el servidor recibe archivos de verdad. Este script las descarga y las
deja embebidas en `app_movil/integration_test/fotos_internet.dart`, para que la
prueba no dependa de la red al ejecutarse.

USO
    python RepoTecnico/pruebas/generar_fotos_prueba.py

Las imágenes vienen de `picsum.photos` (fotos de dominio público, 320×240) y
pesan entre 10 y 20 KB: es lo que pidió la prueba («imágenes de internet con
poco peso»).
"""

from __future__ import annotations

import base64
import sys
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "app_movil" / "integration_test" / "fotos_internet.dart"
FUENTES = [
    "https://picsum.photos/seed/ggto-campo-1/320/240.jpg",
    "https://picsum.photos/seed/ggto-campo-2/320/240.jpg",
    "https://picsum.photos/seed/ggto-campo-3/320/240.jpg",
]
MAXIMO_BYTES = 60 * 1024


def descargar(url: str) -> bytes:
    peticion = urllib.request.Request(url, headers={"User-Agent": "GGTO-prueba-campo"})
    with urllib.request.urlopen(peticion, timeout=60) as respuesta:  # noqa: S310
        datos = respuesta.read()
    if not datos.startswith(b"\xff\xd8"):
        raise SystemExit(f"{url} no devolvió un JPEG válido")
    if len(datos) > MAXIMO_BYTES:
        raise SystemExit(f"{url} pesa {len(datos)} bytes (máximo {MAXIMO_BYTES})")
    return datos


def main() -> int:
    fotos: list[tuple[str, int, str]] = []
    for url in FUENTES:
        try:
            datos = descargar(url)
        except Exception as error:  # noqa: BLE001 - se informa y se aborta
            print(f"ERROR al descargar {url}: {error}", file=sys.stderr)
            return 1
        fotos.append((url, len(datos), base64.b64encode(datos).decode("ascii")))
        print(f"  {url} · {len(datos)} bytes")

    lineas = [
        "// GENERADO por RepoTecnico/pruebas/generar_fotos_prueba.py — no editar a mano.",
        "//",
        "// Fotos de internet de poco peso (picsum.photos, 320×240) que la prueba de",
        "// campo inyecta como evidencias de la APK (D-112).",
        "",
        "/// Fotos en base64, en el orden en que se usan.",
        "const List<String> fotosInternetBase64 = <String>[",
    ]
    for url, tamano, b64 in fotos:
        lineas.append(f"  // {url} · {tamano} bytes")
        trozos = [b64[i:i + 100] for i in range(0, len(b64), 100)]
        # Cada foto es **un** elemento de la lista: los trozos se concatenan
        # (literales adyacentes) y se cierra con coma para separar de la siguiente.
        for indice, trozo in enumerate(trozos):
            sufijo = "," if indice == len(trozos) - 1 else ""
            lineas.append(f"  '{trozo}'{sufijo}")
    lineas += ["];", ""]
    DESTINO.write_text("\n".join(lineas), encoding="utf-8")
    print(f"Escrito {DESTINO} ({DESTINO.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
