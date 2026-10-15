"""Optimiza las capturas de la propuesta GGTO · CANTV.

- Convierte las imágenes de marca a WebP (rendimiento: 1 075 KB -> ~42 KB).
- Genera una vista previa ligera de la página completa del sistema de diseño.

Uso: python docs/propuesta-visual/scripts/optimizar.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

CAPTURAS = Path(__file__).resolve().parents[1] / "capturas"

WEBP = ["hero-autogestion-vertical", "hero-web"]
PREVIEW = ("sistema-diseno.png", "sistema-diseno-preview.png", 1200)


def main() -> None:
    for nombre in WEBP:
        origen = CAPTURAS / f"{nombre}.png"
        if not origen.exists():
            print(f"OMITO {nombre}: no existe el PNG de origen")
            continue
        destino = CAPTURAS / f"{nombre}.webp"
        Image.open(origen).convert("RGB").save(destino, "WEBP", quality=82, method=6)
        kb = destino.stat().st_size / 1024
        original = origen.stat().st_size / 1024
        print(f"OK  {destino.name:<34} {kb:8.1f} KB  (-{100 - 100 * kb / original:.0f} % sobre {original:.0f} KB)")

    archivo, salida, ancho = PREVIEW
    origen = CAPTURAS / archivo
    if origen.exists():
        imagen = Image.open(origen)
        alto = int(imagen.size[1] * ancho / imagen.size[0])
        imagen.resize((ancho, alto), Image.LANCZOS).save(CAPTURAS / salida, optimize=True)
        print(f"OK  {salida:<34} {ancho}x{alto}")
    else:
        print(f"OMITO {salida}: no existe {archivo}")


if __name__ == "__main__":
    main()
