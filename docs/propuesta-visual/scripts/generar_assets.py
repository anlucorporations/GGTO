"""Genera los activos visuales de la propuesta GGTO v2 · CANTV.

Entrada : docs/imagenes/CANTV_logo.svg  (logo institucional oficial)
Salida  : docs/propuesta-visual/assets/*.svg

Genera:
  cantv-logo-blanco.svg              logo monocromo blanco (superficies de marca)
  cantv-logo-tinta.svg               logo monocromo azul electrico (superficies claras)
  patron-trama.svg                   baldosa de trama de puntos (reutilizable en CSS)
  hero-autogestion-vertical.svg      imagen visual vertical 1080x1920 (la referencia, v2)
  hero-web.svg                       cabecera/aparte de marca 1920x520 para la web

Todo es SVG editable: no hay binarios ni fuentes incrustadas.
"""

from __future__ import annotations

import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]          # docs/propuesta-visual -> docs
DOCS = RAIZ.parent
LOGO = DOCS / "docs" / "imagenes" / "CANTV_logo.svg"
ASSETS = Path(__file__).resolve().parents[1] / "assets"

# --------------------------------------------------------------------------- #
# Paleta real medida sobre docs/propuesta-visual/recursos/referencia-autogestion.jpg
# (k-means de 8 grupos; ver recursos/paleta_referencia.json)
# --------------------------------------------------------------------------- #
G = {
    "electrico": "#021FBE",
    "azul": "#0B1BB4",
    "azul2": "#0B20BC",
    "violeta": "#3B1CAD",
    "violeta2": "#7C12AF",
    "purpura": "#9D0BAC",
    "magenta": "#C905A5",
    "fucsia": "#E003A0",
    "fucsia2": "#D003C2",
    "turquesa": "#00B8C4",
    "turquesa-claro": "#5CE1E6",
    "tinta": "#0B1BB4",
    "punto": "#E5DDF8",
}

FUENTE = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
FUENTE_TITULAR = "Archivo, Inter, 'Segoe UI', Arial, sans-serif"


def contenido_logo() -> str:
    """Devuelve los <path>/<polygon> del logo oficial, sin clases de color."""
    svg = LOGO.read_text(encoding="utf-8")
    cuerpo = svg[svg.index(">", svg.index("<svg")) + 1: svg.rindex("</svg>")]
    cuerpo = re.sub(r"<defs>.*?</defs>", "", cuerpo, flags=re.S)
    cuerpo = re.sub(r'\s+class="st\d"', "", cuerpo)
    cuerpo = re.sub(r"\n\s*\n", "\n", cuerpo).strip()
    return cuerpo


CUERPO = contenido_logo()
LOGO_ANCHO, LOGO_ALTO = 600, 250


def marca(color: str, x: float, y: float, ancho: float, opacidad: float = 1.0) -> str:
    """Grupo <g> con el logo escalado a `ancho` y anclado en su esquina (x, y)."""
    escala = ancho / LOGO_ANCHO
    op = f' opacity="{opacidad}"' if opacidad != 1.0 else ""
    return (
        f'<g transform="translate({x:.1f},{y:.1f}) scale({escala:.5f})" fill="{color}"{op}>\n'
        f"{CUERPO}\n</g>"
    )


def defs_comunes(ids: str = "fondo") -> str:
    return f"""  <defs>
    <linearGradient id="{ids}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="{G['electrico']}"/>
      <stop offset="16%" stop-color="{G['azul2']}"/>
      <stop offset="34%" stop-color="{G['violeta']}"/>
      <stop offset="52%" stop-color="{G['violeta2']}"/>
      <stop offset="70%" stop-color="{G['purpura']}"/>
      <stop offset="86%" stop-color="{G['magenta']}"/>
      <stop offset="100%" stop-color="{G['fucsia']}"/>
    </linearGradient>
    <radialGradient id="glow-izq" cx="0.08" cy="0.06" r="0.55">
      <stop offset="0%" stop-color="#3F5BFF" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#3F5BFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-der" cx="0.92" cy="0.98" r="0.6">
      <stop offset="0%" stop-color="{G['fucsia2']}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="{G['fucsia2']}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-punto" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#FF5BD6" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#FF5BD6" stop-opacity="0"/>
    </radialGradient>
    <pattern id="trama" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="2.6" fill="{G['punto']}" opacity="0.55"/>
    </pattern>
    <filter id="suave" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="38"/>
    </filter>
    <filter id="suave2" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="13"/>
    </filter>
    <filter id="ribete" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
  </defs>"""


# --------------------------------------------------------------------------- #
# 1. Logo monocromo blanco
# --------------------------------------------------------------------------- #
def logo_blanco() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 250" width="600" height="250" '
        'role="img" aria-label="CANTV">\n'
        '  <title>Logotipo CANTV (monocromo blanco)</title>\n'
        f"  <g fill=\"#FFFFFF\">\n{CUERPO}\n  </g>\n</svg>\n"
    )


def logo_tinta() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 250" width="600" height="250" '
        'role="img" aria-label="CANTV">\n'
        '  <title>Logotipo CANTV (monocromo azul electrico)</title>\n'
        f'  <g fill="{G["tinta"]}">\n{CUERPO}\n  </g>\n</svg>\n'
    )


# --------------------------------------------------------------------------- #
# 2. Baldosa de trama de puntos
# --------------------------------------------------------------------------- #
def patron_trama() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26" width="26" height="26">
  <title>Trama de puntos de marca (baldosa repetible)</title>
  <circle cx="4" cy="4" r="2.6" fill="{G['punto']}" opacity="0.55"/>
</svg>
"""


# --------------------------------------------------------------------------- #
# 3. Imagen visual vertical 1080x1920
# --------------------------------------------------------------------------- #
def hero_vertical() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920"
     role="img" aria-label="Autogestion de averias CANTV — imagen de marca vertical">
  <title>GGTO · CANTV — Autogestion de averias (vertical 9:16)</title>
{defs_comunes()}
  <rect width="1080" height="1920" fill="url(#fondo)"/>
  <rect width="1080" height="1920" fill="url(#glow-izq)"/>
  <rect width="1080" height="1920" fill="url(#glow-der)"/>

  <!-- Capas organicas: el mismo lenguaje fluido de la referencia -->
  <g filter="url(#suave)">
    <path d="M-120 300 C 220 120, 520 470, 900 250 C 1040 172, 1140 210, 1220 160 L 1220 -120 L -120 -120 Z"
          fill="#2B4BFF" opacity="0.55"/>
    <path d="M-120 880 C 180 640, 470 1000, 780 770 C 960 640, 1090 710, 1220 630 L 1220 1220 L -120 1220 Z"
          fill="{G['violeta2']}" opacity="0.55"/>
    <path d="M-120 1440 C 240 1210, 520 1580, 860 1320 C 1010 1210, 1140 1270, 1220 1210 L 1220 1800 L -120 1800 Z"
          fill="{G['magenta']}" opacity="0.5"/>
  </g>
  <g filter="url(#suave2)">
    <path d="M1080 1580 C 880 1520, 760 1370, 620 1430 C 480 1490, 420 1630, 260 1670 L 260 1920 L 1080 1920 Z"
          fill="#FF3FC0" opacity="0.45"/>
    <path d="M-60 1200 C 140 1160, 300 1060, 470 1110 C 560 1136, 600 1200, 700 1210 L 700 1320 L -60 1320 Z"
          fill="#5B2BE0" opacity="0.45"/>
  </g>

  <!-- Cintas de contorno: los pliegues definidos de la referencia -->
  <g filter="url(#ribete)" fill="none" stroke-linecap="round">
    <path d="M-80 470 C 260 250, 560 640, 900 420 C 1030 336, 1130 372, 1200 330"
          stroke="#FFFFFF" stroke-width="3" opacity="0.16"/>
    <path d="M-80 1050 C 260 830, 560 1220, 900 1000 C 1030 916, 1130 952, 1200 910"
          stroke="#FFFFFF" stroke-width="3" opacity="0.13"/>
    <path d="M-80 1620 C 260 1400, 560 1790, 900 1570 C 1030 1486, 1130 1522, 1200 1480"
          stroke="#FFD9F4" stroke-width="4" opacity="0.2"/>
  </g>
  <circle cx="1080" cy="1700" r="360" fill="url(#glow-punto)"/>

  <!-- Trama de puntos: bloque superior y bloque inferior izquierdo -->
  <rect x="300" y="118" width="312" height="260" fill="url(#trama)"/>
  <rect x="-44" y="1478" width="208" height="234" fill="url(#trama)"/>

  <!-- Hairline diagonal de marca -->
  <path d="M-40 1246 L 210 1010" stroke="#FFFFFF" stroke-width="2" opacity="0.55" fill="none"/>

  <!-- Logotipo institucional (monocromo blanco) -->
{marca("#FFFFFF", 262, 776, 556)}

  <!-- Lockup tipografico -->
  <g text-anchor="middle" font-family="{FUENTE}">
    <text x="540" y="1148" font-size="46" font-weight="700" letter-spacing="14"
          fill="#FFFFFF" opacity="0.96">AUTOGESTIÓN</text>
    <text x="540" y="1214" font-size="31" font-weight="400" letter-spacing="1.5"
          fill="#FFFFFF" opacity="0.86">Reportes de avería y puntos ópticos</text>
    <text x="540" y="1272" font-size="24" font-weight="600" letter-spacing="3"
          fill="{G['turquesa-claro']}" opacity="0.95">GGTO · FRANCISCO SALIAS · ÁREA 4</text>
  </g>
</svg>
"""


# --------------------------------------------------------------------------- #
# 4. Cabecera de marca para la web 1920x520
# --------------------------------------------------------------------------- #
def hero_web() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 600" width="1920" height="600"
     role="img" aria-label="GGTO CANTV — cabecera de marca para la web">
  <title>GGTO · CANTV — cabecera de marca (web, 1920x600)</title>
{defs_comunes()}
  <rect width="1920" height="600" fill="url(#fondo)"/>
  <rect width="1920" height="600" fill="url(#glow-izq)"/>
  <rect width="1920" height="600" fill="url(#glow-der)"/>
  <g filter="url(#suave)">
    <path d="M-100 -80 C 320 -40, 560 250, 980 150 C 1240 90, 1420 200, 1700 120 L 2100 120 L 2100 -160 L -100 -160 Z"
          fill="#2B4BFF" opacity="0.5"/>
    <path d="M-100 470 C 300 340, 640 580, 1020 450 C 1300 350, 1560 490, 2020 380 L 2020 700 L -100 700 Z"
          fill="{G['violeta2']}" opacity="0.5"/>
  </g>
  <g filter="url(#suave2)">
    <path d="M900 600 C 1040 490, 1260 540, 1400 440 C 1560 330, 1780 380, 2060 300 L 2060 700 L 900 700 Z"
          fill="#FF3FC0" opacity="0.4"/>
  </g>
  <g filter="url(#ribete)" fill="none" stroke-linecap="round">
    <path d="M-80 210 C 420 60, 900 330, 1400 180 C 1640 110, 1800 150, 2000 100"
          stroke="#FFFFFF" stroke-width="3" opacity="0.14"/>
    <path d="M-80 560 C 420 410, 900 680, 1400 530 C 1640 460, 1800 500, 2000 450"
          stroke="#FFD9F4" stroke-width="4" opacity="0.18"/>
  </g>

  <!-- Trama de puntos: solo arriba a la derecha, lejos del texto -->
  <rect x="1500" y="54" width="286" height="182" fill="url(#trama)"/>

  <!-- Logotipo institucional (monocromo blanco) -->
{marca("#FFFFFF", 104, 70, 300)}

  <g font-family="{FUENTE}" fill="#FFFFFF">
    <text x="108" y="330" font-size="62" font-weight="700" font-family="{FUENTE_TITULAR}">
      Un solo tablero para la avería
    </text>
    <text x="108" y="400" font-size="62" font-weight="700" font-family="{FUENTE_TITULAR}">
      y el punto óptico
    </text>
    <text x="110" y="452" font-size="25" font-weight="400" opacity="0.9">
      Ingesta diaria del CSV, despacho por cuadrilla, seguimiento y métricas de la Central Francisco Salias.
    </text>
  </g>
  <g font-family="{FUENTE}">
    <rect x="108" y="492" width="322" height="64" rx="32" fill="#FFFFFF"/>
    <text x="269" y="533" font-size="23" font-weight="700" text-anchor="middle" fill="{G['tinta']}">
      Entrar a la plataforma
    </text>
    <rect x="450" y="492" width="250" height="64" rx="32" fill="none" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="2"/>
    <text x="575" y="533" font-size="23" font-weight="600" text-anchor="middle" fill="#FFFFFF">
      Ver manuales
    </text>
  </g>
</svg>
"""


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    salidas = {
        "cantv-logo-blanco.svg": logo_blanco(),
        "cantv-logo-tinta.svg": logo_tinta(),
        "patron-trama.svg": patron_trama(),
        "hero-autogestion-vertical.svg": hero_vertical(),
        "hero-web.svg": hero_web(),
    }
    for nombre, contenido in salidas.items():
        destino = ASSETS / nombre
        destino.write_text(contenido, encoding="utf-8")
        print(f"OK  {nombre:<34} {len(contenido):>7} bytes")


if __name__ == "__main__":
    main()
