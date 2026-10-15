/**
 * GGTO · CANTV — Rasteriza los activos de la propuesta visual y captura los mockups.
 *
 * Uso (desde la raíz del repositorio):
 *   node docs/propuesta-visual/scripts/capturar.js svg      -> PNG de los SVG de assets/
 *   node docs/propuesta-visual/scripts/capturar.js web      -> PNG de los mockups HTML
 *   node docs/propuesta-visual/scripts/capturar.js          -> ambos
 *
 * Requiere Playwright (disponible en RepoTecnico/pruebas/e2e/node_modules).
 * NODE_PATH debe apuntar a esa carpeta (lo fija el propio script si hace falta).
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const E2E = path.resolve(__dirname, '../../../RepoTecnico/pruebas/e2e/node_modules');
if (!module.paths.includes(E2E)) module.paths.push(E2E);
const { chromium } = require(path.join(E2E, 'playwright'));

const BASE = path.resolve(__dirname, '..');
const ASSETS = path.join(BASE, 'assets');
const MOCKUP = path.join(BASE, 'mockup');
const SALIDA = path.join(BASE, 'capturas');
fs.mkdirSync(SALIDA, { recursive: true });

const SVG = [
  { archivo: 'hero-autogestion-vertical.svg', ancho: 1080, alto: 1920, escala: 1 },
  { archivo: 'hero-web.svg', ancho: 1920, alto: 600, escala: 1 },
  { archivo: 'cantv-logo-blanco.svg', ancho: 600, alto: 250, escala: 2, fondo: '#0B1BB4' },
  { archivo: 'cantv-logo-tinta.svg', ancho: 600, alto: 250, escala: 2, fondo: '#FFFFFF' },
];

const PANTALLAS = [
  { archivo: '01-sistema.html', nombre: 'sistema-diseno', ancho: 1440, alto: null, completa: true },
  { archivo: '02-login.html', nombre: 'login-escritorio', ancho: 1440, alto: 900 },
  { archivo: '02-login.html', nombre: 'login-movil', ancho: 390, alto: 844 },
  { archivo: '03-panel.html', nombre: 'panel-escritorio', ancho: 1440, alto: 900 },
  { archivo: '03-panel.html', nombre: 'panel-tableta', ancho: 768, alto: 1024 },
  { archivo: '03-panel.html', nombre: 'panel-movil', ancho: 390, alto: 844 },
];

async function svgAPng(navegador) {
  const pagina = await navegador.newPage();
  for (const item of SVG) {
    const svg = fs.readFileSync(path.join(ASSETS, item.archivo), 'utf8');
    const fondo = item.fondo || 'transparent';
    await pagina.setViewportSize({ width: item.ancho * item.escala, height: item.alto * item.escala });
    await pagina.setContent(
      '<!doctype html><html><head><meta charset="utf-8"><style>' +
        `html,body{margin:0;padding:0;background:${fondo};}` +
        `svg{display:block;width:${item.ancho * item.escala}px;height:${item.alto * item.escala}px;}` +
        '</style></head><body>' + svg + '</body></html>',
      { waitUntil: 'load' }
    );
    await pagina.waitForTimeout(150);
    const destino = path.join(SALIDA, item.archivo.replace(/\.svg$/, '.png'));
    await pagina.screenshot({ path: destino });
    console.log('OK svg   ' + path.basename(destino) + ` (${item.ancho * item.escala}x${item.alto * item.escala})`);
  }
  await pagina.close();
}

async function webAPng(navegador) {
  for (const p of PANTALLAS) {
    const contexto = await navegador.newContext({
      viewport: { width: p.ancho, height: p.alto || 900 },
      deviceScaleFactor: 2,
    });
    const pagina = await contexto.newPage();
    await pagina.goto(pathToFileURL(path.join(MOCKUP, p.archivo)).href, { waitUntil: 'load' });
    await pagina.waitForTimeout(350);
    await pagina.evaluate(() => document.fonts && document.fonts.ready);
    const destino = path.join(SALIDA, `${p.nombre}.png`);
    if (p.completa) {
      await pagina.screenshot({ path: destino, fullPage: true });
    } else {
      await pagina.screenshot({ path: destino });
    }
    console.log('OK web   ' + path.basename(destino) + ` (${p.ancho}px)`);
    await contexto.close();
  }
}

(async () => {
  const modo = process.argv[2] || 'todo';
  const navegador = await chromium.launch();
  if (modo === 'svg' || modo === 'todo') await svgAPng(navegador);
  if (modo === 'web' || modo === 'todo') await webAPng(navegador);
  await navegador.close();
})();
