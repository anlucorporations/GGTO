# Generación de los manuales HTML y PDF — GGTO · CANTV

Herramientas que convierten los **manuales literales** (`docs/Manuales/<Tema>/<nn>-<nombre>.md`)
en la **edición HTML estilizada** (`docs/Manuales/html/`) y en los **PDF descargables**
(`docs/Manuales/pdf/`), con la paleta y la tipografía de la web del proyecto
(`app/web/src/styles.css`).

```
docs/Manuales/
├── 01-Tecnologia/01-plataforma.md      ← fuente (no se modifica)
├── html/01-Tecnologia/01-plataforma.html   ← salida HTML (mismo árbol)
├── pdf/01-Tecnologia/01-plataforma.pdf     ← salida PDF (mismo árbol)
└── _build/
    ├── generar.py          MD → HTML estilizado
    ├── manual.css          estilos (se embeben en cada HTML)
    ├── paginar.js          reparte el contenido en hojas A4 y numera el índice
    ├── exportar_pdf.mjs    HTML → PDF con Playwright/Chromium
    ├── verificar_pdf.py    comprueba páginas, índice y marcadores
    └── informe_exportacion.json   resultado de la última exportación
```

## Requisitos del entorno

Playwright 1.63 + Chromium ya están instalados en
`RepoTecnico/pruebas/e2e/node_modules`. Chromium headless necesita:

```bash
export LD_LIBRARY_PATH="/home/dsh/tools/libs/usr/lib/x86_64-linux-gnu:/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu"
export FONTCONFIG_FILE="$HOME/.config/fontconfig/fonts.conf"
```

Sin `FONTCONFIG_FILE` el navegador no pinta texto. Para que los bloques de código
se vean en ancho fijo se instalaron las fuentes **DejaVu Sans Mono** en `~/.fonts`
(el directorio de fuentes que declara `fonts.conf`); sin ellas Chromium no tiene
ninguna fuente monoespaciada.

Extra para la verificación (opcional, no hace falta para generar):

```bash
python3 -m pip install --target /tmp/pdflib pypdf
```

## Regenerar todo

```bash
cd /home/dsh/workspace/CANTV_PDE/docs/Manuales/_build

# 1) Markdown → HTML estilizado (22 manuales + índice general)
python3 generar.py

# 2) HTML → PDF
export LD_LIBRARY_PATH="/home/dsh/tools/libs/usr/lib/x86_64-linux-gnu:/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu"
export FONTCONFIG_FILE="$HOME/.config/fontconfig/fonts.conf"
node exportar_pdf.mjs              # todos
node exportar_pdf.mjs --solo 05-Diccionario   # solo los que coincidan

# 3) Verificación (páginas, índice y marcadores)
python3 verificar_pdf.py

# 4) Publicar en la SPA (copia HTML+PDF+imágenes a app/web/public/manual)
./sincronizar_manual.sh
cd ../../../app/web && npm run build
```

`sincronizar_manual.sh` reescribe las rutas relativas de los HTML para la nueva
profundidad y comprueba que no quede ninguna referencia rota antes de terminar.

`exportar_pdf.mjs` acepta también `--capturas N --salida <carpeta>` para guardar
imágenes PNG de las primeras hojas del primer manual procesado (revisión visual).

## Cómo funciona la edición HTML

- **Portada** con la marca «GGTO · CANTV», el título del manual, el resumen de
  entrada y una ficha (producto, cliente, colección, documento, público, fecha).
- **Índice** lateral en pantalla y página de índice en el PDF, con la jerarquía
  tema → sección → sub-sección y el número de sección (`1`, `1.2`, `1.2.3`).
- **Cabecera y pie** en cada hoja del PDF (marca, tema, título corto, cliente y
  «Página X de Y»); en pantalla, barra fija superior y pie con la colección.
- **Imágenes**: los marcadores `<!-- GENERAR_IMAGEN: <nombre>.svg -->` embeben el
  PNG/ SVG correspondiente de `docs/imagenes/` por ruta relativa. Los diagramas
  que aún no tienen imagen se muestran como bloque «código Mermaid».
- El HTML es **autocontenido** (CSS y paginador embebidos) y se puede abrir con
  doble clic; no necesita servidor.

## Cómo funciona el PDF

`exportar_pdf.mjs` abre el HTML, espera a que carguen las imágenes, activa el
modo papel (`html.pdf-mode`), llama a `window.ggtoPaginar()` y vuelca con
`page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })`.

El paginador (incluido en cada HTML) reparte los bloques del manual en hojas A4
reales, mide si cada bloque cabe, abre hoja nueva en cada capítulo y **divide**
tablas, listas, párrafos y bloques de código demasiado altos. Después numera las
hojas y escribe en el índice la página exacta de cada sección.

## Notas

- Los manuales no se modifican: la edición HTML/PDF es solo de presentación.
- Si se cambia el contenido de un `.md`, hay que repetir los pasos 1 y 2.
- `paginador` y estilos viven en `paginar.js` y `manual.css`: al editarlos hay
  que regenerar el HTML (los archivos los llevan embebidos).
