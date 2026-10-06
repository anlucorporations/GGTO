"""Genera las versiones del aviso de uso (disclaimer) en texto plano.

Fuente canónica: `app/web/public/disclaimer.md`.
Salida:
  - `app/web/public/disclaimer.txt`  (texto plano, ISO de facto UTF-8, para la APK)
  - `app_movil/assets/disclaimer.txt` (copia empaquetada en la APK)

Uso:
    python scripts/generar_disclaimer.py            # escribe los archivos
    python scripts/generar_disclaimer.py --check    # solo verifica que estén al día
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "app" / "web" / "public" / "disclaimer.md"
DESTINOS = [
    RAIZ / "app" / "web" / "public" / "disclaimer.txt",
    RAIZ / "app_movil" / "assets" / "disclaimer.txt",
]

ANCHO = 100


def _a_texto(markdown: str) -> str:
    """Convierte el Markdown del aviso en texto plano legible."""
    lineas: list[str] = []
    for cruda in markdown.splitlines():
        linea = cruda.rstrip()

        # Enlaces markdown -> texto con la URL.
        linea = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", linea)
        # Negritas y cursivas.
        linea = linea.replace("**", "").replace("__", "")
        # Separadores de tabla.
        if re.fullmatch(r"\s*\|[\s:|-]+\|\s*", linea):
            continue
        # Citas.
        if linea.lstrip().startswith(">"):
            linea = linea.lstrip()[1:].strip()
        # Filas de tabla -> columnas separadas.
        if linea.startswith("|") and linea.endswith("|"):
            celdas = [c.strip() for c in linea.strip("|").split("|")]
            linea = "  ".join(c for c in celdas if c)
        # Encabezados -> texto con línea subrayada.
        if linea.startswith("#"):
            nivel = len(linea) - len(linea.lstrip("#"))
            titulo = linea[nivel:].strip()
            if nivel == 1:
                lineas.extend(["=" * min(len(titulo) or ANCHO, ANCHO), titulo,
                               "=" * min(len(titulo) or ANCHO, ANCHO), ""])
            else:
                lineas.extend([titulo, "-" * min(len(titulo) or 20, ANCHO), ""])
            continue
        # Viñetas markdown -> guiones.
        if re.match(r"^\s*[-*]\s+", linea):
            linea = re.sub(r"^(\s*)[-*]\s+", r"\1- ", linea)

        lineas.append(linea)

    texto = "\n".join(lineas)
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    return texto.strip() + "\n"


def main() -> int:
    solo_verificar = "--check" in sys.argv
    if not FUENTE.is_file():
        print(f"ERROR: no existe la fuente {FUENTE}")
        return 1

    contenido = _a_texto(FUENTE.read_text(encoding="utf-8"))
    desactualizados: list[Path] = []

    for destino in DESTINOS:
        actual = destino.read_text(encoding="utf-8") if destino.is_file() else None
        if actual == contenido:
            print(f"OK    {destino.relative_to(RAIZ)} (al día)")
            continue
        desactualizados.append(destino)
        if not solo_verificar:
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_text(contenido, encoding="utf-8")
            print(f"WRITE {destino.relative_to(RAIZ)} ({len(contenido)} caracteres)")

    if solo_verificar and desactualizados:
        print("\nLos siguientes archivos NO están al día:")
        for destino in desactualizados:
            print(f"  - {destino.relative_to(RAIZ)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
