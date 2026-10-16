"""Prepara los recursos de la APK a partir de las rasterizaciones.

Toma los PNG de `capturas/` y escribe en `assets/apk/` los WebP (y el PNG de la
trama) con el tamaño y la transparencia que necesita Android, listos para copiar
a `app_movil/assets/marca/`.

Uso:
  1) node docs/propuesta-visual-apk/scripts/capturar_apk.js svg
  2) python docs/propuesta-visual-apk/scripts/preparar_apk.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[1]
CAPTURAS = RAIZ / "capturas"
SALIDA = RAIZ / "assets" / "apk"

# (origen, destino, ancho final, conservar transparencia)
RECURSOS = [
    ("cantv-logo-blanco.png", "logo_blanco.webp", 900, True),
    ("cantv-logo-tinta.png", "logo_tinta.webp", 600, True),
    ("banda-acceso.png", "banda_acceso.webp", 1080, False),
    ("simbolo-cantv-alpha.png", "splash_simbolo.webp", 512, True),
    ("icono-app-primer-plano-alpha.png", "icono_frente.webp", 432, True),
]

# Iconos del lanzador: carpeta de recursos y lado en píxeles.
MIPMAPS = [
    ("mipmap-mdpi", 48),
    ("mipmap-hdpi", 72),
    ("mipmap-xhdpi", 96),
    ("mipmap-xxhdpi", 144),
    ("mipmap-xxxhdpi", 192),
]


def main() -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    for origen, destino, ancho, alfa in RECURSOS:
        ruta = CAPTURAS / origen
        if not ruta.exists():
            print(f"OMITO {destino}: falta {origen} (ejecute capturar_apk.js svg)")
            continue
        imagen = Image.open(ruta)
        modo = "RGBA" if alfa else "RGB"
        imagen = imagen.convert(modo)
        alto = round(imagen.size[1] * ancho / imagen.size[0])
        imagen = imagen.resize((ancho, alto), Image.LANCZOS)
        imagen.save(SALIDA / destino, "WEBP", quality=88, method=6)
        kb = (SALIDA / destino).stat().st_size / 1024
        print(f"OK  {destino:<26} {ancho}x{alto:<5} {kb:7.1f} KB")

    # La trama es una baldosa de 26 px: PNG, sin escalado.
    import shutil  # noqa: PLC0415  (import local: solo se usa aquí)

    trama = CAPTURAS / "patron-trama.png"
    if trama.exists():
        shutil.copyfile(trama, SALIDA / "trama_26.png")
        print(f"OK  {'trama_26.png':<26} 26x26      {(SALIDA / 'trama_26.png').stat().st_size / 1024:7.1f} KB")
    else:
        print("OMITO trama_26.png: falta patron-trama.png")

    # Iconos del lanzador (mipmaps) desde el icono compuesto de 1024 px.
    icono = CAPTURAS / "icono-app.png"
    if icono.exists():
        base = Image.open(icono).convert("RGBA")
        for carpeta, lado in MIPMAPS:
            destino = SALIDA / carpeta / "ic_launcher.png"
            destino.parent.mkdir(parents=True, exist_ok=True)
            base.resize((lado, lado), Image.LANCZOS).save(destino, "PNG", optimize=True)
            print(f"OK  {carpeta + '/ic_launcher.png':<34} {lado}x{lado}")
    else:
        print("OMITO mipmaps: falta icono-app.png")

    print(f"\nDestino en la app: app_movil/assets/marca/  (desde {SALIDA.relative_to(RAIZ.parent.parent)})")


if __name__ == "__main__":
    main()
