#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GGTO · CANTV — Generador de la versión HTML estilizada de los manuales literales.

Lee   : docs/Manuales/<Tema>/<nn>-<nombre>.md
Escribe: docs/Manuales/html/<Tema>/<nn>-<nombre>.html   (+ html/index.html)

El HTML resultante es autocontenido (CSS y paginador embebidos), embebe las
imágenes de docs/imagenes/ por ruta relativa y sirve de base para la
exportación a PDF (docs/Manuales/_build/exportar_pdf.mjs).
"""

from __future__ import annotations

import html as html_mod
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

from markdown_it import MarkdownIt

# ---------------------------------------------------------------- rutas

BASE = Path(__file__).resolve().parent          # docs/Manuales/_build
MANUALES = BASE.parent                          # docs/Manuales
DOCS = MANUALES.parent                          # docs
IMAGENES = DOCS / "imagenes"
HTML_DIR = MANUALES / "html"
PDF_DIR = MANUALES / "pdf"

PRODUCTO = "GGTO"
SISTEMA = ("Sistema de administración de reportes de avería y construcción "
           "de puntos ópticos")
CLIENTE = "CANTV C.A. — Central Francisco Salias (Área 4)"
VERSION_SISTEMA = "0.9.0"

TEMAS = {
    "01-Tecnologia": "Tecnología",
    "02-Dependencias": "Dependencias",
    "03-Implementacion": "Implementación",
    "04-Despliegue": "Despliegue",
    "05-Diccionario-de-Datos": "Diccionario de Datos",
    "06-Diagrama-Relacional": "Diagrama Relacional",
    "07-Operacion": "Operación",
}

# Nombres de marcador que no coinciden literalmente con el archivo generado.
ALIAS_IMAGEN = {
    "rbac-roles": "roles-rbac",
    "flujo-caso-estados": "flujo-estados-caso",
}

# ---------------------------------------------------------------- iconos

def _icono(nombre: str, color: str, interior: str) -> str:
    return (
        f'<span class="ico ico-{nombre}" role="img" aria-label="{nombre}">'
        f'<svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" focusable="false">'
        f'<circle cx="8" cy="8" r="7.3" fill="{color}"/>{interior}</svg></span>'
    )


ICONOS = {
    "ok": _icono(
        "ok", "#1f7a4d",
        '<path d="M4.3 8.4l2.4 2.4 5-5.2" fill="none" stroke="#fff" '
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
    "no": _icono(
        "no", "#b3261e",
        '<path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" fill="none" stroke="#fff" '
        'stroke-width="2" stroke-linecap="round"/>',
    ),
    "wait": _icono(
        "wait", "#8a6100",
        '<path d="M8 3.7v4.5l3.1 1.9" fill="none" stroke="#fff" stroke-width="1.8" '
        'stroke-linecap="round" stroke-linejoin="round"/>',
    ),
    "warn": (
        '<span class="ico ico-warn" role="img" aria-label="atención">'
        '<svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" focusable="false">'
        '<path d="M8 1.1l7.2 12.9H.8z" fill="#8a6100"/>'
        '<path d="M8 5.3v4.1" fill="none" stroke="#fff" stroke-width="1.8" '
        'stroke-linecap="round"/><circle cx="8" cy="11.8" r="1.05" fill="#fff"/></svg></span>'
    ),
}

REEMPLAZOS_ICONO = [
    ("\u2705", "[[ICO:ok]]"),      # ✅
    ("\u274c", "[[ICO:no]]"),      # ❌
    ("\u23f3", "[[ICO:wait]]"),    # ⏳
    ("\u26a0\ufe0f", "[[ICO:warn]]"),
    ("\u26a0", "[[ICO:warn]]"),    # ⚠
]

# ---------------------------------------------------------------- markdown

MD = MarkdownIt("gfm-like", {"linkify": False, "html": False})
MD_TEXTO = MarkdownIt("commonmark", {"html": False})

RE_MARCADOR = re.compile(r"^<!--\s*GENERAR_IMAGEN:\s*([^\s>]+?)\s*-->\s*$")
RE_APERTURA = re.compile(r"^```([A-Za-z0-9_+-]*)\s*$")
RE_CIERRE = re.compile(r"^```\s*$")
RE_H1 = re.compile(r"^#\s+(.*?)\s*$")
RE_ENCABEZADO = re.compile(r"<h([234])>(.*?)</h\1>", re.S)
RE_TABLA = re.compile(r"<table>.*?</table>", re.S)
RE_PRE = re.compile(r"<pre><code([^>]*)>", re.S)
RE_BLOQUE_PROTEGIDO = re.compile(r"<pre[^>]*>.*?</pre>|<code[^>]*>.*?</code>", re.S)


def sin_etiquetas(texto: str) -> str:
    return html_mod.unescape(re.sub(r"<[^>]+>", "", texto)).strip()


def _lang_de(atributos: str) -> str:
    m = re.search(r'class="language-([A-Za-z0-9_+-]+)"', atributos or "")
    return m.group(1) if m else "texto"


def slug(texto: str) -> str:
    base = unicodedata.normalize("NFKD", sin_etiquetas(texto))
    base = "".join(c for c in base if not unicodedata.combining(c))
    base = re.sub(r"[^a-zA-Z0-9]+", "-", base).strip("-").lower()
    return (base or "seccion")[:60]


# ---------------------------------------------------------------- figuras

class Figura:
    def __init__(self, indice: int, marcador: str | None):
        self.indice = indice
        self.marcador = marcador            # p.ej. "arquitectura-general.svg"
        self.base = None                    # nombre sin extensión
        self.ruta = None                    # Path del PNG/SVG encontrado
        self.codigo = None                  # texto mermaid
        self.lang = "mermaid"


def resolver_imagen(nombre: str | None) -> Path | None:
    """Busca la imagen del marcador en docs/imagenes (png preferido)."""
    if not nombre:
        return None
    clave = Path(nombre).stem
    candidatos = [clave]
    if clave in ALIAS_IMAGEN:
        candidatos.append(ALIAS_IMAGEN[clave])
    for cand in candidatos:
        for ext in (".png", ".svg"):
            ruta = IMAGENES / f"{cand}{ext}"
            if ruta.exists():
                return ruta
    return None


def preparar_figuras(texto: str) -> tuple[str, list[Figura]]:
    """Extrae los marcadores de imagen y los bloques mermaid."""
    lineas = texto.split("\n")
    salida: list[str] = []
    figuras: list[Figura] = []
    pendiente: Figura | None = None
    i = 0

    def emitir_figura(fig: Figura) -> None:
        if salida and salida[-1].strip():
            salida.append("")
        salida.append(f"[[FIG:{fig.indice}]]")
        salida.append("")

    while i < len(lineas):
        linea = lineas[i]
        m = RE_MARCADOR.match(linea)
        if m:
            if pendiente is not None:
                emitir_figura(pendiente)
            fig = Figura(len(figuras), m.group(1))
            fig.base = Path(m.group(1)).stem
            fig.ruta = resolver_imagen(m.group(1))
            figuras.append(fig)
            pendiente = fig
            i += 1
            continue

        apertura = RE_APERTURA.match(linea)
        if apertura:
            lang = apertura.group(1)
            cuerpo: list[str] = []
            i += 1
            while i < len(lineas) and not RE_CIERRE.match(lineas[i]):
                cuerpo.append(lineas[i])
                i += 1
            i += 1  # cierre
            if lang == "mermaid":
                if pendiente is not None and pendiente.codigo is None:
                    pendiente.codigo = "\n".join(cuerpo)
                    pendiente = None
                    emitir_figura(figuras[-1])
                else:
                    fig = Figura(len(figuras), None)
                    fig.codigo = "\n".join(cuerpo)
                    figuras.append(fig)
                    emitir_figura(fig)
            else:
                salida.append("```" + lang)
                salida.extend(cuerpo)
                salida.append("```")
            continue

        salida.append(linea)
        i += 1

    if pendiente is not None:
        emitir_figura(pendiente)

    return "\n".join(salida), figuras


def html_figura(fig: Figura, rel_imagenes: str) -> str:
    if fig.ruta is not None:
        src = f"{rel_imagenes}/{fig.ruta.name}"
        alt = fig.base.replace("-", " ")
        pie = f"Figura {fig.indice + 1} · {fig.ruta.name}"
        detalle = ""
        if fig.codigo:
            detalle = (
                '<details><summary>Código del gráfico (Mermaid)</summary>'
                f'<pre data-lang="mermaid"><code class="language-mermaid">'
                f"{html_mod.escape(fig.codigo)}</code></pre></details>"
            )
        return (
            f'<figure id="fig-{fig.indice}">'
            f'<img src="{src}" alt="{html_mod.escape(alt)}">'
            f"<figcaption>{html_mod.escape(pie)}</figcaption>{detalle}</figure>"
        )
    titulo = (
        f"Diagrama {fig.indice + 1} (código Mermaid"
        + (f" · imagen pendiente: {fig.marcador}" if fig.marcador else "")
        + ")"
    )
    codigo = html_mod.escape(fig.codigo or "")
    return (
        f'<div class="grafico-pendiente" id="fig-{fig.indice}">'
        f'<p class="gp-titulo">{html_mod.escape(titulo)}</p>'
        f'<pre data-lang="mermaid"><code class="language-mermaid">{codigo}</code></pre></div>'
    )


# ---------------------------------------------------------------- post-proceso

def reemplazar_fuera_de_codigo(texto: str, reemplazos: list[tuple[str, str]]) -> str:
    partes: list[str] = []
    ultimo = 0
    for m in RE_BLOQUE_PROTEGIDO.finditer(texto):
        partes.append(_aplicar(texto[ultimo:m.start()], reemplazos))
        partes.append(m.group(0))
        ultimo = m.end()
    partes.append(_aplicar(texto[ultimo:], reemplazos))
    return "".join(partes)


def _aplicar(texto: str, reemplazos: list[tuple[str, str]]) -> str:
    for viejo, nuevo in reemplazos:
        texto = texto.replace(viejo, nuevo)
    return texto


class Manual:
    def __init__(self, ruta: Path):
        self.ruta = ruta
        self.tema_clave = ruta.parent.name
        self.tema = TEMAS.get(self.tema_clave, self.tema_clave.replace("-", " "))
        self.stem = ruta.stem
        self.titulo = self.stem
        self.resumen_md = ""
        self.resumen = ""
        self.html_cuerpo = ""
        self.toc: list[tuple[int, str, str, str]] = []
        self.figuras: list[Figura] = []
        self.fecha_fuente = ""

    # ---------- construcción ----------

    def construir(self) -> None:
        crudo = self.ruta.read_text(encoding="utf-8")
        self.fecha_fuente = datetime.fromtimestamp(
            self.ruta.stat().st_mtime).strftime("%d/%m/%Y")

        lineas = crudo.split("\n")
        # 1. título (primer H1)
        for i, linea in enumerate(lineas):
            m = RE_H1.match(linea)
            if m:
                self.titulo = sin_etiquetas(m.group(1))
                lineas.pop(i)
                break
        texto = "\n".join(lineas).lstrip("\n")

        # 2. resumen: primera cita del documento
        lineas = texto.split("\n")
        inicio = None
        for i, linea in enumerate(lineas):
            if linea.startswith(">"):
                inicio = i
                break
        if inicio is not None:
            fin = inicio
            while fin < len(lineas):
                actual = lineas[fin]
                if actual.startswith(">"):
                    fin += 1
                    continue
                if not actual.strip() and fin + 1 < len(lineas) and lineas[fin + 1].startswith(">"):
                    fin += 1
                    continue
                break
            cita = "\n".join(lineas[inicio:fin])
            self.resumen_md = "\n".join(
                re.sub(r"^>\s?", "", l) for l in cita.split("\n")
            ).strip()

        # 3. figuras y emojis
        texto, self.figuras = preparar_figuras(texto)
        for viejo, nuevo in REEMPLAZOS_ICONO:
            texto = texto.replace(viejo, nuevo)

        # 4. markdown -> html
        cuerpo = MD.render(texto)

        # 5. tablas envueltas para desplazamiento horizontal
        cuerpo = RE_TABLA.sub(lambda m: f'<div class="tabla-scroll">{m.group(0)}</div>', cuerpo)

        # 6. lenguaje de los bloques de código
        cuerpo = RE_PRE.sub(
            lambda m: (
                f'<pre data-lang="{_lang_de(m.group(1))}"><code{m.group(1)}>'
            ),
            cuerpo,
        )

        # 7. numeración y anclas de los encabezados
        cuerpo = self._numerar(cuerpo)

        # 8. figuras e iconos
        cuerpo = re.sub(
            r"<p>\[\[FIG:(\d+)\]\]</p>",
            lambda m: html_figura(self.figuras[int(m.group(1))], self.rel_imagenes),
            cuerpo,
        )
        cuerpo = reemplazar_fuera_de_codigo(
            cuerpo, [(f"[[ICO:{k}]]", v) for k, v in ICONOS.items()]
        )
        sobrantes = re.findall(r"\[\[(?:FIG|ICO):[^\]]+\]\]", cuerpo)
        cuerpo = re.sub(r"\[\[FIG:\d+\]\]", "", cuerpo)

        self.html_cuerpo = cuerpo
        self.resumen = sin_etiquetas(MD_TEXTO.renderInline(self.resumen_md)) if self.resumen_md else ""
        if sobrantes:
            print(f"  aviso: marcadores sin resolver en {self.ruta.name}: {sobrantes[:3]}")

    def _numerar(self, cuerpo: str) -> str:
        contadores = [0, 0, 0]
        vistas: dict[str, int] = {}
        toc: list[tuple[int, str, str, str]] = []

        def repl(m: re.Match) -> str:
            nivel = int(m.group(1))
            interior = m.group(2)
            idx = nivel - 2
            contadores[idx] += 1
            for k in range(idx + 1, 3):
                contadores[k] = 0
            numero = ".".join(str(c) for c in contadores[: idx + 1])
            base = slug(interior)
            vistas[base] = vistas.get(base, 0) + 1
            ident = base if vistas[base] == 1 else f"{base}-{vistas[base]}"
            toc.append((nivel, numero, interior, ident))
            return (
                f'<h{nivel} id="{ident}">'
                f'<span class="sec-num">{numero}</span>{interior}</h{nivel}>'
            )

        cuerpo = RE_ENCABEZADO.sub(repl, cuerpo)
        self.toc = toc
        return cuerpo

    # ---------- rutas relativas ----------

    @property
    def rel_imagenes(self) -> str:
        return "../../../imagenes"

    @property
    def rel_pdf(self) -> str:
        return f"../../pdf/{self.tema_clave}/{self.stem}.pdf"

    @property
    def rel_html(self) -> str:
        return f"../{self.tema_clave}/{self.stem}.html"

    @property
    def ruta_html(self) -> Path:
        return HTML_DIR / self.tema_clave / f"{self.stem}.html"

    @property
    def ruta_pdf(self) -> Path:
        return PDF_DIR / self.tema_clave / f"{self.stem}.pdf"

    @property
    def titulo_corto(self) -> str:
        return self.titulo if len(self.titulo) <= 68 else self.titulo[:65].rstrip() + "…"

    @property
    def resumen_portada(self) -> str:
        texto = re.sub(r"\s+", " ", self.resumen).strip()
        if len(texto) <= 560:
            return texto
        corte = texto[:560].rsplit(" ", 1)[0]
        return corte + " […]"


# ---------------------------------------------------------------- plantillas

def portada(m: Manual, fecha: str) -> str:
    return f"""      <section class="portada" id="portada">
        <div class="portada-franja"></div>
        <div class="portada-cuerpo">
          <div class="portada-marca">GGTO <span>· CANTV</span></div>
          <p class="portada-sistema">{html_mod.escape(SISTEMA)}</p>
          <span class="portada-etiqueta">Manual literal · {html_mod.escape(m.tema)}</span>
          <h1 class="portada-titulo">{html_mod.escape(m.titulo)}</h1>
          <p class="portada-resumen">{html_mod.escape(m.resumen_portada)}</p>
          <dl class="portada-meta">
            <div><dt>Producto</dt><dd>{PRODUCTO} · versión {VERSION_SISTEMA}</dd></div>
            <div><dt>Cliente</dt><dd>{html_mod.escape(CLIENTE)}</dd></div>
            <div><dt>Colección</dt><dd>Manuales literales · {html_mod.escape(m.tema)}</dd></div>
            <div><dt>Documento</dt><dd>docs/Manuales/{m.tema_clave}/{m.stem}.md</dd></div>
            <div><dt>Público</dt><dd>Todo público (lenguaje sencillo)</dd></div>
            <div><dt>Actualización de la fuente</dt><dd>{m.fecha_fuente}</dd></div>
          </dl>
        </div>
        <div class="portada-pie">
          <span>{html_mod.escape(CLIENTE)}</span>
          <span>Edición HTML y PDF generada el {fecha}</span>
        </div>
      </section>"""


def toc_html(m: Manual) -> str:
    arbol: list[dict] = []
    pila: list[tuple[int, list]] = [(-1, arbol)]
    for nivel, numero, interior, ident in m.toc:
        nodo = {"nivel": nivel, "num": numero, "html": interior, "id": ident, "hijos": []}
        while pila and pila[-1][0] >= nivel:
            pila.pop()
        pila[-1][1].append(nodo)
        pila.append((nivel, nodo["hijos"]))

    def render(nodos: list[dict]) -> str:
        partes: list[str] = []
        for n in nodos:
            partes.append(
                f'<li class="n{n["nivel"]}">'
                f'<a href="#{n["id"]}" data-target="{n["id"]}">'
                f'<span class="tn">{n["num"]}</span> {n["html"]}</a>'
                f'<span class="pag"></span>'
            )
            if n["hijos"]:
                partes.append(f'<ul>{render(n["hijos"])}</ul>')
            partes.append("</li>")
        return "".join(partes)

    return render(arbol)


def documento(m: Manual, todos: list[Manual], css: str, js: str, fecha: str) -> str:
    indice = todos.index(m)
    anterior = todos[indice - 1] if indice > 0 else None
    siguiente = todos[indice + 1] if indice + 1 < len(todos) else None

    def enlace(nav: Manual | None, clase: str, etiqueta: str) -> str:
        if not nav:
            return f'<span class="{clase}"></span>'
        return (f'<a class="{clase}" href="../{nav.tema_clave}/{nav.stem}.html">'
                f'{etiqueta}: {html_mod.escape(nav.titulo_corto)}</a>')

    pie_nav = (
        '<nav class="pie-nav">'
        + enlace(anterior, "izq", "← Manual anterior")
        + '<a href="../index.html">Índice general</a>'
        + enlace(siguiente, "der", "Manual siguiente →")
        + "</nav>"
    )

    config = {
        "cabeceraIzq": "GGTO · CANTV — Manual literal",
        "cabeceraDer": f"{m.tema} · {m.stem}",
        "pieIzq": m.titulo_corto,
        "pieCentro": "CANTV C.A. · Central Francisco Salias (Área 4)",
        "titulo": m.titulo,
    }

    figura_principal = next(
        (f for f in m.figuras if f.ruta is not None), None
    )
    og = ""
    if figura_principal is not None:
        og = (f'<meta property="og:image" content="../../../imagenes/'
              f'{figura_principal.ruta.name}">')

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html_mod.escape(m.titulo)} — Manual {PRODUCTO} (CANTV)</title>
<meta name="author" content="{PRODUCTO} · CANTV">
<meta name="description" content="{html_mod.escape(m.resumen_portada[:200])}">
{og}
<style>
{css}
</style>
</head>
<body>
<header class="doc-topbar">
  <a class="marca" href="../index.html"><b>GGTO</b><span>&nbsp;· CANTV</span></a>
  <span class="chip">{html_mod.escape(m.tema)}</span>
  <span class="topbar-sep"></span>
  <a class="boton" href="{m.rel_pdf}">Descargar PDF</a>
  <a class="boton" href="../index.html">Índice general</a>
</header>

<div class="doc-layout">
  <nav class="doc-nav" aria-label="Índice del manual">
    <p class="toc-titulo">Índice del manual</p>
    <ol class="toc-lista">{toc_html(m)}</ol>
  </nav>
  <main class="doc-main">
    <article class="contenido" id="contenido">
{portada(m, fecha)}
{m.html_cuerpo}
{pie_nav}
    </article>
  </main>
</div>

<footer class="doc-pie">
  <div><strong>{PRODUCTO}</strong> — {html_mod.escape(SISTEMA)}</div>
  <div class="pie-nav">
    <span>{html_mod.escape(CLIENTE)}</span>
    <span>Manual literal · {html_mod.escape(m.tema)}</span>
    <span>Generado el {fecha}</span>
  </div>
</footer>

<script>
window.GGTO_MANUAL = {json.dumps(config, ensure_ascii=False)};
</script>
<script>
{js}
</script>
</body>
</html>
"""


CSS_INDICE = """
.portada { margin-bottom: 26px; }
.grupo { margin: 0 0 34px; }
.grupo h2 { font-size: 21px; margin: 0 0 14px; padding-bottom: 6px;
  border-bottom: 2px solid var(--azul); color: var(--azul-oscuro); }
.rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.tarjeta { background:#fff; border:1px solid var(--gris-borde); border-radius: var(--radio);
  box-shadow: var(--sombra); padding: 16px; display:flex; flex-direction:column;
  margin: 0 0 16px; }
.rejilla .tarjeta { margin: 0; }
.tarjeta h3 { margin: 0 0 8px; font-size: 16px; color: var(--azul-oscuro); }
.tarjeta p { margin: 0 0 12px; font-size: 13px; color: var(--gris-texto); }
.tarjeta-enlaces { margin-top: auto; display:flex; gap: 14px; }
.tarjeta-enlaces a { font-weight: 600; font-size: 13px; }
.tarjeta-mini { width: 100%; height: 128px; object-fit: cover; object-position: top;
  border:1px solid var(--gris-borde); border-radius: 6px; margin-bottom: 12px; }
"""


def indice_general(todos: list[Manual], css: str, fecha: str) -> str:
    por_tema: dict[str, list[Manual]] = {}
    for m in todos:
        por_tema.setdefault(m.tema_clave, []).append(m)

    bloques: list[str] = []
    for clave, lista in por_tema.items():
        tema = TEMAS.get(clave, clave)
        filas = []
        for m in lista:
            miniatura = next((f for f in m.figuras if f.ruta is not None), None)
            img = (
                f'<img class="tarjeta-mini" src="../../imagenes/{miniatura.ruta.name}" '
                f'alt="Figura de {html_mod.escape(m.titulo)}">'
                if miniatura else ""
            )
            filas.append(f"""        <article class="tarjeta">
          {img}
          <h3>{html_mod.escape(m.titulo)}</h3>
          <p>{html_mod.escape(m.resumen_portada[:230])}</p>
          <p class="tarjeta-enlaces">
            <a href="{m.tema_clave}/{m.stem}.html">Ver en HTML</a>
            <a href="../pdf/{m.tema_clave}/{m.stem}.pdf">Descargar PDF</a>
          </p>
        </article>""")
        tarjetas = "\n".join(filas)
        bloques.append(
            f'      <section class="grupo">\n'
            f'        <h2>{html_mod.escape(tema)} '
            f'<span class="chip">{len(lista)} manual(es)</span></h2>\n'
            f'        <div class="rejilla">\n{tarjetas}\n        </div>\n'
            f'      </section>'
        )

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manuales {PRODUCTO} — CANTV · Central Francisco Salias</title>
<style>
{css}
{CSS_INDICE}
</style>
</head>
<body>
<header class="doc-topbar">
  <a class="marca" href="index.html"><b>GGTO</b><span>&nbsp;· CANTV</span></a>
  <span class="chip">Manuales literales</span>
  <span class="topbar-sep"></span>
  <span class="chip">Edición {fecha}</span>
</header>
<div class="doc-layout" style="display:block">
  <main class="doc-main">
    <section class="portada">
      <div class="portada-franja"></div>
      <div class="portada-cuerpo">
        <div class="portada-marca">GGTO <span>· CANTV</span></div>
        <p class="portada-sistema">{html_mod.escape(SISTEMA)}</p>
        <span class="portada-etiqueta">Colección de manuales</span>
        <h1 class="portada-titulo">Manuales de GGTO</h1>
        <p class="portada-resumen">Versión HTML navegable de los manuales literales del sistema.
        Cada manual tiene su portada, su índice, sus gráficos y su versión descargable en PDF.
        Los textos son los mismos que están en <code>docs/Manuales/</code>: esta edición solo
        cambia la presentación.</p>
        <dl class="portada-meta">
          <div><dt>Manuales</dt><dd>{len(todos)}</dd></div>
          <div><dt>Temas</dt><dd>{len(por_tema)}</dd></div>
          <div><dt>Cliente</dt><dd>{html_mod.escape(CLIENTE)}</dd></div>
          <div><dt>Producto</dt><dd>{PRODUCTO} · versión {VERSION_SISTEMA}</dd></div>
          <div><dt>PDF</dt><dd>Carpeta <code>docs/Manuales/pdf/</code></dd></div>
          <div><dt>Generado</dt><dd>{fecha}</dd></div>
        </dl>
      </div>
    </section>
{chr(10).join(bloques)}
  </main>
</div>
<footer class="doc-pie">
  <div><strong>{PRODUCTO}</strong> — {html_mod.escape(SISTEMA)}</div>
  <div class="pie-nav"><span>{html_mod.escape(CLIENTE)}</span><span>Generado el {fecha}</span></div>
</footer>
</body>
</html>
"""


# ---------------------------------------------------------------- main

def main() -> None:
    css = (BASE / "manual.css").read_text(encoding="utf-8")
    js = (BASE / "paginar.js").read_text(encoding="utf-8")
    fecha = datetime.now().strftime("%d/%m/%Y")

    rutas = sorted(MANUALES.glob("*/*.md"))
    rutas = [r for r in rutas if r.parent.name != "_build"]
    manuales = [Manual(r) for r in rutas]
    manuales = [m for m in manuales if m.tema_clave in TEMAS]
    manuales.sort(key=lambda m: (m.tema_clave, m.stem))

    for m in manuales:
        m.construir()

    HTML_DIR.mkdir(parents=True, exist_ok=True)
    for m in manuales:
        m.ruta_html.parent.mkdir(parents=True, exist_ok=True)
        m.ruta_html.write_text(documento(m, manuales, css, js, fecha), encoding="utf-8")
        print(f"HTML  {m.ruta_html.relative_to(DOCS)}"
              f"  ({len(m.toc)} secciones, {len(m.figuras)} gráficos)")

    indice = HTML_DIR / "index.html"
    indice.write_text(indice_general(manuales, css, fecha), encoding="utf-8")
    print(f"HTML  {indice.relative_to(DOCS)}")
    print(f"\nTotal: {len(manuales)} manuales -> {HTML_DIR}")


if __name__ == "__main__":
    main()
