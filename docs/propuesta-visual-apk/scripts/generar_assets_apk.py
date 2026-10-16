"""Genera los activos visuales de la propuesta para la APK (GGTO Técnico · CANTV).

Entrada : docs/imagenes/CANTV_logo.svg  (logo institucional oficial)
Salida  : docs/propuesta-visual-apk/assets/*.svg

Genera:
  cantv-logo-blanco.svg      lockup monocromo blanco (superficies de marca)
  cantv-logo-tinta.svg       lockup monocromo azul (superficies claras)
  simbolo-cantv.svg          SOLO la cinta de estrellas (símbolo para icono y splash)
  splash-nativo.svg          arranque Android 12+: símbolo centrado sobre el degradado
  banda-acceso.svg           banda de marca para la pantalla de acceso (1080x620)
  icono-app-fondo.svg        capa de fondo del icono adaptativo (1024x1024)
  icono-app-primer-plano.svg capa frontal del icono adaptativo (1024x1024, zona segura)
  icono-app.svg              icono compuesto (vista previa / iOS / stores)
  patron-trama.svg           baldosa de trama de puntos

Nota de plataforma: Flutter no dibuja SVG sin añadir `flutter_svg`, así que estos
vectores son la FUENTE; `preparar_apk.py` los rasteriza a WebP por densidad,
igual que el actual `assets/logo_CANTV.webp`.
"""

from __future__ import annotations

import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]          # docs/propuesta-visual-apk -> docs
DOCS = RAIZ.parent
LOGO = DOCS / "docs" / "imagenes" / "CANTV_logo.svg"
ASSETS = Path(__file__).resolve().parents[1] / "assets"

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

FUENTE = "Roboto, Inter, 'Segoe UI', Arial, sans-serif"


def leer_logo() -> str:
    return LOGO.read_text(encoding="utf-8")


def cuerpo_logo() -> str:
    """Devuelve los <path>/<polygon> del logo oficial, sin clases de color."""
    svg = leer_logo()
    cuerpo = svg[svg.index(">", svg.index("<svg")) + 1: svg.rindex("</svg>")]
    cuerpo = re.sub(r"<defs>.*?</defs>", "", cuerpo, flags=re.S)
    cuerpo = re.sub(r'\s+class="st\d"', "", cuerpo)
    return re.sub(r"\n\s*\n", "\n", cuerpo).strip()


def cuerpo_simbolo() -> str:
    """Devuelve la cinta de estrellas: los tres primeros <path> del logo + sus estrellas.

    En el SVG oficial los tres primeros trazados son las cintas (amarilla, roja y
    azul) y los <polygon class="st0"> son las estrellas que las acompañan. Se
    extraen por posición y se verifica el ancla para detectar un reexport distinto.
    """
    svg = leer_logo()
    cuerpo = svg[svg.index(">", svg.index("<svg")) + 1: svg.rindex("</svg>")]
    cuerpo = re.sub(r"<defs>.*?</defs>", "", cuerpo, flags=re.S)

    paths = re.findall(r"<path class=\"st\d\" d=\"(.*?)\"/>\s*(?=<|$)", cuerpo, flags=re.S)
    if len(paths) < 3 or not all(p.lstrip().startswith("M7") for p in paths[:3]):
        raise SystemExit("CANTV_logo.svg cambió de estructura: revise cuerpo_simbolo()")

    cintas = "".join(
        f'  <path d="{p.strip()}"/>\n' for p in paths[:3]
    )
    estrellas = re.findall(r'<polygon class="st0" points="([^"]+)"/>', cuerpo)
    if not estrellas:
        raise SystemExit("No se encontraron estrellas (polygon st0) en el logo")
    poligonos = "".join(f'  <polygon points="{pts}"/>\n' for pts in estrellas)
    return cintas + poligonos


CUERPO = cuerpo_logo()
SIMBOLO = cuerpo_simbolo()
LOGO_ANCHO, LOGO_ALTO = 600, 250


def marca(color: str, x: float, y: float, ancho: float) -> str:
    """Grupo <g> con el logo escalado a `ancho` y anclado en su esquina (x, y)."""
    return (
        f'<g transform="translate({x:.1f},{y:.1f}) scale({ancho / LOGO_ANCHO:.5f})" fill="{color}">\n'
        f"{CUERPO}\n</g>"
    )


def defs() -> str:
    return f"""  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0.35" y2="1">
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
    <pattern id="trama" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="2.6" fill="{G['punto']}" opacity="0.5"/>
    </pattern>
    <filter id="suave" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="38"/>
    </filter>
    <filter id="suave2" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="13"/>
    </filter>
  </defs>"""


def logo_blanco(color: str = "#FFFFFF", titulo: str = "monocromo blanco") -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 250" width="600" height="250" '
        'role="img" aria-label="CANTV">\n'
        f'  <title>Logotipo CANTV ({titulo})</title>\n'
        f'  <g fill="{color}">\n{CUERPO}\n  </g>\n</svg>\n'
    )


def simbolo(color: str = "#FFFFFF") -> str:
    # La cinta ocupa, en el viewBox del logo, x: 75,6-591,2 e y: 0-250 con las estrellas.
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 0 540 260" width="540" height="260" '
        'role="img" aria-label="CANTV">\n'
        '  <title>Símbolo CANTV (cinta y estrellas)</title>\n'
        f'  <g fill="{color}">\n{SIMBOLO}\n  </g>\n</svg>\n'
    )


def splash_nativo() -> str:
    """Lo que muestra Android 12+ al arrancar: símbolo centrado sobre el color de marca."""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920"
     role="img" aria-label="Arranque de GGTO Técnico con el símbolo CANTV">
  <title>Splash nativo — símbolo dentro de la zona segura</title>
{defs()}
  <rect width="1080" height="1920" fill="url(#fondo)"/>
  <rect width="1080" height="1920" fill="url(#glow-izq)"/>
  <rect width="1080" height="1920" fill="url(#glow-der)"/>
  <g filter="url(#suave)">
    <path d="M-120 420 C 220 240, 520 590, 900 370 C 1040 292, 1140 330, 1220 280 L 1220 -120 L -120 -120 Z"
          fill="#2B4BFF" opacity="0.5"/>
    <path d="M-120 1520 C 240 1290, 520 1660, 860 1400 C 1010 1290, 1140 1350, 1220 1290 L 1220 2000 L -120 2000 Z"
          fill="{G['magenta']}" opacity="0.45"/>
  </g>
  <rect x="300" y="150" width="312" height="234" fill="url(#trama)"/>
  <!-- Zona segura del icono (66 % del ancho): el símbolo va centrado aquí. -->
  <g transform="translate(540,960) scale(1.16) translate(-330,-130)">
    <g fill="#FFFFFF">
{SIMBOLO}
    </g>
  </g>
  <g text-anchor="middle" font-family="{FUENTE}">
    <text x="540" y="1250" font-size="52" font-weight="700" letter-spacing="6" fill="#FFFFFF">GGTO TÉCNICO</text>
    <text x="540" y="1310" font-size="28" letter-spacing="2" fill="#FFFFFF" opacity="0.86">Planta Externa GPON · Central Francisco Salias</text>
  </g>
</svg>
"""


def banda_acceso() -> str:
    """Banda de marca que encabeza la pantalla de acceso (1080 x 620)."""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 620" width="1080" height="620"
     role="img" aria-label="Banda de marca para el acceso de GGTO Técnico">
  <title>Banda de marca del acceso (1080 x 620)</title>
{defs()}
  <rect width="1080" height="620" fill="url(#fondo)"/>
  <rect width="1080" height="620" fill="url(#glow-izq)"/>
  <g filter="url(#suave2)">
    <path d="M-80 560 C 240 420, 520 700, 900 520 C 1000 470, 1100 500, 1180 460 L 1180 700 L -80 700 Z"
          fill="{G['violeta2']}" opacity="0.55"/>
  </g>
  <rect x="806" y="64" width="208" height="156" fill="url(#trama)"/>
{marca("#FFFFFF", 96, 150, 420)}
  <g font-family="{FUENTE}" fill="#FFFFFF">
    <text x="100" y="470" font-size="34" font-weight="700" letter-spacing="4">PLANTA EXTERNA GPON</text>
    <text x="100" y="516" font-size="24" opacity="0.88">Sistema de averías y puntos ópticos</text>
  </g>
</svg>
"""


def icono_fondo() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <title>Icono adaptativo — capa de fondo</title>
{defs()}
  <rect width="1024" height="1024" fill="url(#fondo)"/>
  <rect width="1024" height="1024" fill="url(#glow-izq)"/>
  <rect width="1024" height="1024" fill="url(#glow-der)"/>
  <rect x="640" y="96" width="260" height="200" fill="url(#trama)"/>
</svg>
"""


def icono_primer_plano() -> str:
    # Zona segura de Android: el símbolo cabe dentro del 66 % central del lienzo.
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <title>Icono adaptativo — capa frontal (símbolo dentro de la zona segura)</title>
  <g transform="translate(512,500) scale(1.02) translate(-333,-125)">
    <g fill="#FFFFFF">
{SIMBOLO}
    </g>
  </g>
</svg>
"""


def icono_compuesto() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"
     role="img" aria-label="Icono de la aplicación GGTO Técnico">
  <title>Icono de la aplicación (vista compuesta)</title>
{defs()}
  <defs>
    <clipPath id="redondeo"><rect width="1024" height="1024" rx="224" ry="224"/></clipPath>
  </defs>
  <g clip-path="url(#redondeo)">
    <rect width="1024" height="1024" fill="url(#fondo)"/>
    <rect width="1024" height="1024" fill="url(#glow-izq)"/>
    <rect width="1024" height="1024" fill="url(#glow-der)"/>
    <rect x="640" y="96" width="260" height="200" fill="url(#trama)"/>
    <g transform="translate(512,500) scale(1.02) translate(-333,-125)">
      <g fill="#FFFFFF">
{SIMBOLO}
      </g>
    </g>
  </g>
</svg>
"""


def patron_trama() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26" width="26" height="26">
  <title>Trama de puntos de marca (baldosa repetible, 26 x 26)</title>
  <circle cx="4" cy="4" r="2.6" fill="{G['punto']}" opacity="0.5"/>
</svg>
"""


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    salidas = {
        "cantv-logo-blanco.svg": logo_blanco(),
        "cantv-logo-tinta.svg": logo_blanco(G["tinta"], "monocromo azul"),
        "simbolo-cantv.svg": simbolo(),
        "simbolo-cantv-azul.svg": simbolo(G["tinta"]),
        "splash-nativo.svg": splash_nativo(),
        "banda-acceso.svg": banda_acceso(),
        "icono-app-fondo.svg": icono_fondo(),
        "icono-app-primer-plano.svg": icono_primer_plano(),
        "icono-app.svg": icono_compuesto(),
        "patron-trama.svg": patron_trama(),
    }
    for nombre, contenido in salidas.items():
        (ASSETS / nombre).write_text(contenido, encoding="utf-8")
        print(f"OK  {nombre:<32} {len(contenido):>7} bytes")


if __name__ == "__main__":
    main()
