#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GGTO · CANTV — Verificación de los PDF generados.

Comprueba, para cada manual:
  1. que el PDF existe y su número de páginas coincide con el que reportó
     el paginador;
  2. que cada sección del índice está realmente en la página indicada
     (primera aparición del título en el texto del PDF);
  3. que no quedaron marcadores de plantilla sin resolver.

Requiere pypdf (se usa solo para la verificación):
    python3 -m pip install --target /tmp/pdflib pypdf
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, "/tmp/pdflib")
try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    print("Falta pypdf. Instale con: python3 -m pip install --target /tmp/pdflib pypdf")
    raise SystemExit(2)

BASE = Path(__file__).resolve().parent
MANUALES = BASE.parent
INFORME = BASE / "informe_exportacion.json"
CACHE = BASE / ".cache_textos"


def texto_de_paginas(ruta: Path) -> list[str]:
    """Extrae el texto de cada página, con caché en disco por fecha del PDF."""
    CACHE.mkdir(exist_ok=True)
    destino = CACHE / (ruta.stem + "-" + str(int(ruta.stat().st_mtime)) + ".json")
    if destino.exists():
        return json.loads(destino.read_text(encoding="utf-8"))
    lector = PdfReader(str(ruta))
    textos = [normalizar(p.extract_text() or "") for p in lector.pages]
    destino.write_text(json.dumps(textos, ensure_ascii=False), encoding="utf-8")
    return textos


def normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return re.sub(r"\s+", "", texto).lower()


def main() -> int:
    informe = json.loads(INFORME.read_text(encoding="utf-8"))
    problemas: list[str] = []
    revisados = 0
    anclas_total = 0

    for item in informe:
        ruta = MANUALES / item["pdf"]
        if not ruta.exists():
            problemas.append(f"{item['pdf']}: no existe el PDF")
            continue
        lector = PdfReader(str(ruta))
        paginas = len(lector.pages)
        if paginas != item["paginas"]:
            problemas.append(
                f"{item['pdf']}: el PDF tiene {paginas} páginas y el paginador "
                f"informó {item['paginas']}"
            )
        revisados += 1

        textos = texto_de_paginas(ruta)
        toc_paginas = paginas - item["hojasContenido"] - 1
        primera = 1 + toc_paginas  # índice 0-based de la primera hoja de contenido

        anclas = item.get("anclas") or {}
        for ancla, datos in anclas.items():
            esperada = datos.get("pagina") if isinstance(datos, dict) else datos
            texto = datos.get("texto", "") if isinstance(datos, dict) else ""
            if esperada is None:
                problemas.append(f"{item['pdf']}: sin página para el ancla {ancla}")
                continue
            anclas_total += 1
            buscado = normalizar(texto)
            if len(buscado) < 4:
                continue
            # Algunos títulos muy largos se extraen truncados: se prueban
            # prefijos cada vez más cortos antes de darlos por ausentes.
            encontradas: list[int] = []
            for corte in (len(buscado), int(len(buscado) * 0.75), int(len(buscado) * 0.5), 40, 24):
                clave = buscado[:corte]
                if len(clave) < 4:
                    continue
                encontradas = [
                    i + 1 for i, contenido in enumerate(textos)
                    if i >= primera and clave in contenido
                ]
                if encontradas:
                    break
            if not encontradas:
                problemas.append(
                    f"{item['pdf']}: no se encontró el título «{texto[:48]}» en el PDF"
                )
            elif encontradas[0] != esperada:
                problemas.append(
                    f"{item['pdf']}: «{texto[:48]}» está en la página "
                    f"{encontradas[0]} pero el índice dice {esperada}"
                )

        # Comprobación de marcadores sin resolver en el texto de las páginas.
        for i, contenido in enumerate(textos):
            for marca in ("[[fig", "[[ico", "generar_imagen"):
                if marca in contenido:
                    problemas.append(
                        f"{item['pdf']}: marcador sin resolver en la página {i + 1}"
                    )
                    break

    print(f"PDF verificados: {revisados}/{len(informe)}")
    print(f"Anclas de sección revisadas: {anclas_total}")
    if problemas:
        print("\nHallazgos:")
        for p in problemas[:40]:
            print("  ·", p)
        return 1
    print("Sin hallazgos: número de páginas y marcadores correctos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
