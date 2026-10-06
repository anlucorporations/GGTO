#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sincroniza los manuales generados con los recursos estáticos de la SPA.

Equivalente en Python de `sincronizar_manual.sh`, pensado para **Windows**, donde
no hay `bash` y donde manipular UTF-8 con PowerShell 5.1 corrompe los acentos
(lee como cp1252 y reescribe con BOM).

Fuentes (canónicas):
    docs/Manuales/html/**   HTML estilizado de cada manual + index.html
    docs/Manuales/pdf/**    PDF descargable de cada manual
    docs/imagenes/**        Imágenes (SVG + PNG) de los manuales

Destino (servido por FastAPI/Vite):
    app/web/public/manual/**

Los HTML se generan con rutas relativas pensadas para `docs/Manuales/html/`; aquí
se reescriben para la nueva profundidad dentro de `public/manual/`. Al final se
comprueba que **no queden referencias locales rotas** y que los archivos sigan
siendo UTF-8 sin BOM.

Uso:
    python docs/Manuales/_build/sincronizar_manual.py
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
SRC_HTML = RAIZ / "docs" / "Manuales" / "html"
SRC_PDF = RAIZ / "docs" / "Manuales" / "pdf"
SRC_IMG = RAIZ / "docs" / "imagenes"
DST = RAIZ / "app" / "web" / "public" / "manual"

# Rutas relativas tal como las emite `generar.py` y como deben quedar en la SPA.
REEMPLAZOS_INDEX = (("../../imagenes/", "imagenes/"), ("../pdf/", "pdf/"))
REEMPLAZOS_MANUAL = (("../../../imagenes/", "../imagenes/"), ("../../pdf/", "../pdf/"))

PATRON_REF = re.compile(r'(?:src|href)="([^"#][^"]*)"')
EXTERNAS = ("http://", "https://", "mailto:", "data:", "#")


def _limpiar_destino() -> None:
    if DST.exists():
        shutil.rmtree(DST)
    (DST / "pdf").mkdir(parents=True, exist_ok=True)
    (DST / "imagenes").mkdir(parents=True, exist_ok=True)


def _copiar() -> None:
    shutil.copytree(SRC_HTML, DST, dirs_exist_ok=True)
    shutil.copytree(SRC_PDF, DST / "pdf", dirs_exist_ok=True)
    for imagen in sorted(SRC_IMG.glob("*.svg")) + sorted(SRC_IMG.glob("*.png")):
        shutil.copy2(imagen, DST / "imagenes" / imagen.name)


def _reescribir_rutas() -> int:
    """Reescribe las rutas relativas; devuelve cuántos HTML se tocaron."""
    tocados = 0
    for html in sorted(DST.rglob("*.html")):
        texto = html.read_text(encoding="utf-8")
        original = texto
        reemplazos = REEMPLAZOS_INDEX if html == DST / "index.html" else REEMPLAZOS_MANUAL
        for viejo, nuevo in reemplazos:
            texto = texto.replace(viejo, nuevo)
        if texto != original:
            html.write_text(texto, encoding="utf-8", newline="")
            tocados += 1
    return tocados


def _verificar() -> int:
    """Comprueba referencias locales y que no haya mojibake ni BOM."""
    rotas: list[str] = []
    problemas: list[str] = []
    for html in sorted(DST.rglob("*.html")):
        # 1) Referencias locales existentes.
        for destino in PATRON_REF.findall(html.read_text(encoding="utf-8")):
            if destino.startswith(EXTERNAS):
                continue
            if not (html.parent / destino.split("#")[0]).resolve().exists():
                rotas.append(f"{html.relative_to(DST)} -> {destino}")
        # 2) Codificación: UTF-8 sin BOM y sin dobles codificaciones.
        crudo = html.read_bytes()
        if crudo[:3] == b"\xef\xbb\xbf":
            problemas.append(f"{html.relative_to(DST)}: BOM inesperado")
        texto = crudo.decode("utf-8", errors="replace")
        if any(s in texto for s in ("Ã©", "Ã³", "Ã¡", "â€”", "Â«", "Ã±")):
            problemas.append(f"{html.relative_to(DST)}: acentos mal codificados")

    if rotas:
        print("REFERENCIAS ROTAS:")
        for r in rotas[:20]:
            print("  " + r)
    if problemas:
        print("CODIFICACION INCORRECTA:")
        for p in problemas[:20]:
            print("  " + p)
    if rotas or problemas:
        return 1
    total = len(list(DST.rglob("*.html")))
    print(f"OK: {total} HTML sin referencias rotas ni problemas de codificación")
    return 0


def main() -> int:
    if not SRC_HTML.is_dir():
        print(f"ERROR: falta {SRC_HTML} (ejecuta generar.py)", file=sys.stderr)
        return 2
    if not SRC_PDF.is_dir():
        print(f"ERROR: falta {SRC_PDF} (ejecuta exportar_pdf.mjs)", file=sys.stderr)
        return 2

    print("== 1/4 Limpiando destino ==")
    _limpiar_destino()
    print("== 2/4 Copiando HTML, PDF e imágenes ==")
    _copiar()
    print("== 3/4 Reescribiendo rutas relativas ==")
    print(f"  {_reescribir_rutas()} HTML reescritos")
    print("== 4/4 Verificando referencias y codificación ==")
    codigo = _verificar()
    if codigo == 0:
        print(f"Sincronizado en {DST}")
    return codigo


if __name__ == "__main__":
    sys.exit(main())
