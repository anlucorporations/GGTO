/* ==================================================================
   GGTO · CANTV — Exportación de los manuales HTML a PDF
   ------------------------------------------------------------------
   Uso (desde cualquier carpeta):
     node docs/Manuales/_build/exportar_pdf.mjs [opciones]

   Opciones:
     --solo <texto>      procesa solo los HTML cuyo nombre contenga <texto>
     --capturas <n>      guarda además <n> capturas PNG de las primeras
                         hojas del primer manual procesado (para revisión)
     --salida <carpeta>  carpeta de capturas (por defecto /tmp/ggto-manual)

   Requiere Playwright/Chromium del proyecto y las variables:
     LD_LIBRARY_PATH y FONTCONFIG_FILE (ver README de la carpeta pdf/).
   ================================================================== */

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const require = createRequire('/home/dsh/workspace/CANTV_PDE/RepoTecnico/pruebas/e2e/package.json')
const { chromium } = require('playwright')

const BASE = path.resolve('/home/dsh/workspace/CANTV_PDE/docs/Manuales')
const HTML_DIR = path.join(BASE, 'html')
const PDF_DIR = path.join(BASE, 'pdf')
const BUILD_DIR = path.join(BASE, '_build')

/* ------------------------------------------------------------ argumentos */

const args = process.argv.slice(2)
function opcion(nombre, porDefecto = null) {
  const i = args.indexOf(nombre)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : porDefecto
}
const solo = opcion('--solo')
const capturas = Number(opcion('--capturas', '0')) || 0
const salidaCapturas = opcion('--salida', '/tmp/ggto-manual')

/* ------------------------------------------------------------ utilidades */

function listarHtml(dir) {
  const salida = []
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) { salida.push(...listarHtml(completo)) }
    else if (entrada.name.endsWith('.html') && entrada.name !== 'index.html') { salida.push(completo) }
  }
  return salida.sort()
}

const esperarImagenes = async (page) => {
  await page.evaluate(async () => {
    const pendientes = Array.from(document.images).filter((i) => !i.complete)
    await Promise.all(pendientes.map((i) => i.decode().catch(() => {})))
  })
}

/* ------------------------------------------------------------ proceso */

const archivos = listarHtml(HTML_DIR).filter((a) => !solo || a.includes(solo))
if (!archivos.length) {
  console.error('No se encontraron manuales HTML que procesar.')
  process.exit(1)
}

fs.mkdirSync(PDF_DIR, { recursive: true })
const navegador = await chromium.launch({ headless: true })
const pagina = await navegador.newPage({ viewport: { width: 1240, height: 1754 } })

const informe = []
let capturado = false

for (const archivo of archivos) {
  const relativa = path.relative(HTML_DIR, archivo)
  const destino = path.join(PDF_DIR, relativa.replace(/\.html$/, '.pdf'))
  fs.mkdirSync(path.dirname(destino), { recursive: true })

  await pagina.goto('file://' + archivo, { waitUntil: 'load' })
  await esperarImagenes(pagina)

  const reporte = await pagina.evaluate(() => {
    document.documentElement.classList.add('pdf-mode')
    return window.ggtoPaginar()
  })

  await pagina.pdf({
    path: destino,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  })

  const kb = (fs.statSync(destino).size / 1024).toFixed(0)
  const avisos = reporte.avisos || []
  informe.push({ manual: relativa, pdf: path.relative(BASE, destino), ...reporte })
  console.log(
    `PDF   ${path.relative(BASE, destino)}  ` +
    `(${reporte.paginas} páginas, ${reporte.entradasToc} entradas de índice, ${kb} KB)` +
    (avisos.length ? `  ⚠ ${avisos.length} aviso(s)` : '')
  )
  avisos.forEach((a) => console.log(`        · ${a}`))

  if (capturas && !capturado) {
    capturado = true
    fs.mkdirSync(salidaCapturas, { recursive: true })
    const total = Math.min(capturas, reporte.paginas)
    for (let i = 1; i <= total; i++) {
      const hoja = pagina.locator('.print-root > .page').nth(i - 1)
      await hoja.screenshot({ path: path.join(salidaCapturas, `hoja-${String(i).padStart(2, '0')}.png`) })
    }
    console.log(`      capturas: ${total} en ${salidaCapturas}`)
  }
}

await navegador.close()

const archivoInforme = path.join(BUILD_DIR, 'informe_exportacion.json')
fs.writeFileSync(archivoInforme, JSON.stringify(informe, null, 2), 'utf8')

const totalPaginas = informe.reduce((s, i) => s + (i.paginas || 0), 0)
const totalAvisos = informe.reduce((s, i) => s + ((i.avisos || []).length), 0)
console.log(`\n${informe.length} PDF · ${totalPaginas} páginas · ${totalAvisos} aviso(s)`)
console.log(`Informe: ${archivoInforme}`)
