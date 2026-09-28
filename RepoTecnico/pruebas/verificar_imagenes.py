#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verifica la coherencia entre los marcadores GENERAR_IMAGEN de los manuales
literales (docs/Manuales/**/*.md) y los archivos de docs/imagenes/.

Comprueba tres cosas:
  1. Cada marcador tiene su <nombre>.svg y su <nombre>.png.
  2. Cada SVG es XML valido (xml.etree.ElementTree).
  3. No hay imagenes huerfanas (imagen sin marcador).

Uso: python3 RepoTecnico/pruebas/verificar_imagenes.py
Salida: informe por pantalla y codigo de salida 1 si algo falla.
"""
import glob
import os
import re
import sys
import xml.etree.ElementTree as ET

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MANUALES = os.path.join(RAIZ, "docs", "Manuales")
IMAGENES = os.path.join(RAIZ, "docs", "imagenes")
RX = re.compile(r"<!--\s*GENERAR_IMAGEN:\s*([A-Za-z0-9._-]+\.svg)\s*-->")


def marcadores():
    encontrados = {}
    for ruta in sorted(glob.glob(os.path.join(MANUALES, "**", "*.md"), recursive=True)):
        if os.sep + "_build" + os.sep in ruta:
            continue
        with open(ruta, encoding="utf-8") as f:
            for num, linea in enumerate(f, 1):
                for nombre in RX.findall(linea):
                    encontrados.setdefault(nombre, []).append(
                        (os.path.relpath(ruta, MANUALES), num))
    return encontrados


def main():
    marcas = marcadores()
    fallos = []

    print("1) Marcadores con SVG y PNG")
    faltan = []
    for nombre in sorted(marcas):
        lugar = marcas[nombre][0]
        svg = os.path.join(IMAGENES, nombre)
        png = os.path.join(IMAGENES, nombre[:-4] + ".png")
        ok_svg, ok_png = os.path.isfile(svg), os.path.isfile(png)
        if not (ok_svg and ok_png):
            faltan.append((nombre, ok_svg, ok_png))
            fallos.append(nombre)
        estado = "OK" if (ok_svg and ok_png) else "FALTA " + \
            ("svg " if not ok_svg else "") + ("png" if not ok_png else "")
        print("   %-34s %-8s %s:%d" % (nombre, estado, lugar[0], lugar[1]))
    print("   marcadores: %d | faltantes: %d" % (len(marcas), len(faltan)))

    print("\n2) Validez XML de cada SVG")
    malos = []
    svgs = sorted(glob.glob(os.path.join(IMAGENES, "*.svg")))
    for svg in svgs:
        try:
            ET.parse(svg)
        except ET.ParseError as exc:
            malos.append(os.path.basename(svg))
            fallos.append(os.path.basename(svg))
            print("   XML INVALIDO %s: %s" % (os.path.basename(svg), exc))
    print("   SVG revisados: %d | XML invalidos: %d" % (len(svgs), len(malos)))

    print("\n3) Imagenes huerfanas (sin marcador)")
    huerfanas = []
    for archivo in sorted(os.listdir(IMAGENES)):
        if not archivo.lower().endswith((".svg", ".png")):
            continue
        nombre = archivo[:-4] + ".svg"
        if nombre not in marcas:
            huerfanas.append(archivo)
            fallos.append(archivo)
    print("   huerfanas: %d %s" % (len(huerfanas), huerfanas if huerfanas else ""))

    print("\nRESULTADO: %s" % ("TODO OK" if not fallos else "FALLOS: %s" % sorted(set(fallos))))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
