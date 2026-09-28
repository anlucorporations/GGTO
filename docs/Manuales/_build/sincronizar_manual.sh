#!/usr/bin/env bash
# Sincroniza los manuales generados (HTML, PDF e imágenes) con los recursos
# estáticos de la SPA, para que la sección AYUDA de la plataforma los sirva.
#
# Fuentes (canónicas):
#   docs/Manuales/html/**   HTML estilizado de cada manual + index.html
#   docs/Manuales/pdf/**    PDF descargable de cada manual
#   docs/imagenes/**        Imágenes (SVG + PNG) de los manuales
#
# Destino (servido por FastAPI/Vite):
#   app/web/public/manual/**
#
# Los HTML se generan con rutas relativas pensadas para `docs/Manuales/html/`;
# aquí se reescriben para la nueva profundidad dentro de `public/manual/`.
#
# Uso:  docs/Manuales/_build/sincronizar_manual.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SRC_HTML="$RAIZ/docs/Manuales/html"
SRC_PDF="$RAIZ/docs/Manuales/pdf"
SRC_IMG="$RAIZ/docs/imagenes"
DST="$RAIZ/app/web/public/manual"

[ -d "$SRC_HTML" ] || { echo "ERROR: falta $SRC_HTML (ejecuta generar.py)" >&2; exit 1; }
[ -d "$SRC_PDF" ]  || { echo "ERROR: falta $SRC_PDF (ejecuta exportar_pdf.mjs)" >&2; exit 1; }

echo "== 1/4 Limpiando destino =="
rm -rf "$DST"
mkdir -p "$DST/pdf" "$DST/imagenes"

echo "== 2/4 Copiando HTML, PDF e imágenes =="
cp -a "$SRC_HTML/." "$DST/"
cp -a "$SRC_PDF/." "$DST/pdf/"
find "$SRC_IMG" -maxdepth 1 -type f \( -name '*.svg' -o -name '*.png' \) -exec cp -a {} "$DST/imagenes/" \;

echo "== 3/4 Reescribiendo rutas relativas =="
# index.html (vive en public/manual/): sube un nivel menos que en docs/Manuales/html/
sed -i -e 's|\.\./\.\./imagenes/|imagenes/|g' -e 's|\.\./pdf/|pdf/|g' "$DST/index.html"
# <Tema>/<nn>-<nombre>.html (viven en public/manual/<Tema>/)
while IFS= read -r archivo; do
  sed -i -e 's|\.\./\.\./\.\./imagenes/|../imagenes/|g' -e 's|\.\./\.\./pdf/|../pdf/|g' "$archivo"
done < <(find "$DST" -mindepth 2 -name '*.html')

echo "== 4/4 Verificando referencias locales =="
python3 - "$DST" <<'PY'
import pathlib, re, sys

dst = pathlib.Path(sys.argv[1])
patron = re.compile(r'(?:src|href)="([^"#][^"]*)"')
rotas = []
for html in dst.rglob("*.html"):
    for destino in patron.findall(html.read_text(encoding="utf-8")):
        if destino.startswith(("http://", "https://", "mailto:", "data:", "#")):
            continue
        objetivo = (html.parent / destino.split("#")[0]).resolve()
        if not objetivo.exists():
            rotas.append(f"{html.relative_to(dst)} -> {destino}")
if rotas:
    print("REFERENCIAS ROTAS:")
    for r in rotas:
        print("  " + r)
    sys.exit(1)
print(f"OK: sin referencias rotas en {len(list(dst.rglob('*.html')))} HTML")
PY

echo "Sincronizado en $DST"
