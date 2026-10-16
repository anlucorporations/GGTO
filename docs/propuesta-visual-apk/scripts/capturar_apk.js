/**
 * GGTO Técnico · CANTV — Rasteriza los activos y captura las pantallas de la APK.
 *
 * Uso (desde la raíz del repositorio):
 *   node docs/propuesta-visual-apk/scripts/capturar_apk.js svg    -> PNG de assets/
 *   node docs/propuesta-visual-apk/scripts/capturar_apk.js web    -> PNG de mockup/
 *   node docs/propuesta-visual-apk/scripts/capturar_apk.js        -> ambos
 *
 * Requiere Playwright (RepoTecnico/pruebas/e2e/node_modules).
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
  { archivo: 'splash-nativo.svg', ancho: 1080, alto: 1920 },
  { archivo: 'banda-acceso.svg', ancho: 1080, alto: 620 },
  { archivo: 'icono-app.svg', ancho: 1024, alto: 1024 },
  { archivo: 'icono-app-fondo.svg', ancho: 1024, alto: 1024 },
  { archivo: 'icono-app-primer-plano.svg', ancho: 1024, alto: 1024, fondo: '#0B1BB4' },
  { archivo: 'simbolo-cantv.svg', ancho: 540, alto: 260, escala: 2, fondo: '#0B1BB4' },
  { archivo: 'cantv-logo-blanco.svg', ancho: 600, alto: 250, escala: 2, fondo: '#0B1BB4' },
  { archivo: 'cantv-logo-tinta.svg', ancho: 600, alto: 250, escala: 2, fondo: '#FFFFFF' },
  { archivo: 'patron-trama.svg', ancho: 26, alto: 26, fondo: '#0B1BB4' },
  // Versiones con transparencia: son las que se convierten a WebP para la APK.
  { archivo: 'simbolo-cantv.svg', ancho: 512, alto: 246, transparente: true, salida: 'simbolo-cantv-alpha.png' },
  { archivo: 'icono-app-primer-plano.svg', ancho: 432, alto: 432, transparente: true, salida: 'icono-app-primer-plano-alpha.png' },
];

/** Pantallas: cada teléfono es un nodo con id dentro del tablero. */
const PANTALLAS = [
  { id: 'p-acceso', nombre: 'apk-acceso' },
  { id: 'p-casos', nombre: 'apk-casos' },
  { id: 'p-ficha', nombre: 'apk-ficha-caso' },
  { id: 'p-evidencias', nombre: 'apk-evidencias' },
  { id: 'p-sync', nombre: 'apk-sincronizacion' },
  { id: 'p-gestion', nombre: 'apk-inicio-gestion' },
  { id: 'p-monitoreo', nombre: 'apk-monitoreo' },
];

const HOJAS = [
  { archivo: 'apk.html', nombre: 'apk-sistema-diseno', selector: '#hoja-sistema' },
  { archivo: 'apk.html', nombre: 'apk-tablero-pantallas', selector: '#tablero' },
];

async function svgAPng(navegador) {
  const pagina = await navegador.newPage();
  for (const item of SVG) {
    const escala = item.escala || 1;
    const svg = fs.readFileSync(path.join(ASSETS, item.archivo), 'utf8');
    await pagina.setViewportSize({ width: item.ancho * escala, height: item.alto * escala });
    await pagina.setContent(
      '<!doctype html><html><head><meta charset="utf-8"><style>' +
        `html,body{margin:0;padding:0;background:${item.fondo || 'transparent'};}` +
        `svg{display:block;width:${item.ancho * escala}px;height:${item.alto * escala}px;}` +
        '</style></head><body>' + svg + '</body></html>',
      { waitUntil: 'load' }
    );
    await pagina.waitForTimeout(120);
    const destino = item.salida || item.archivo.replace(/\.svg$/, '.png');
    await pagina.screenshot({
      path: path.join(SALIDA, destino),
      omitBackground: Boolean(item.transparente),
    });
    console.log(`OK svg   ${destino}`);
  }
  await pagina.close();
}

async function hojasAPng(navegador) {
  for (const hoja of HOJAS) {
    const contexto = await navegador.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const pagina = await contexto.newPage();
    await pagina.goto(pathToFileURL(path.join(MOCKUP, hoja.archivo)).href, { waitUntil: 'load' });
    await pagina.waitForTimeout(300);
    if (hoja.selector) {
      await pagina.locator(hoja.selector).screenshot({
        path: path.join(SALIDA, `${hoja.nombre}.png`),
      });
    } else {
      await pagina.screenshot({ path: path.join(SALIDA, `${hoja.nombre}.png`), fullPage: true });
    }
    console.log(`OK hoja  ${hoja.nombre}.png`);
    await contexto.close();
  }
}

async function pantallasAPng(navegador) {
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const pagina = await contexto.newPage();
  await pagina.goto(pathToFileURL(path.join(MOCKUP, 'apk.html')).href, { waitUntil: 'load' });
  await pagina.waitForTimeout(300);
  for (const p of PANTALLAS) {
    const nodo = pagina.locator(`#${p.id}`);
    if ((await nodo.count()) === 0) {
      console.log(`OMITO ${p.nombre}: no existe #${p.id}`);
      continue;
    }
    await nodo.screenshot({ path: path.join(SALIDA, `${p.nombre}.png`) });
    console.log(`OK telf  ${p.nombre}.png`);
  }
  await contexto.close();
}

(async () => {
  const modo = process.argv[2] || 'todo';
  const navegador = await chromium.launch();
  if (modo === 'svg' || modo === 'todo') await svgAPng(navegador);
  if (modo === 'web' || modo === 'todo') {
    await hojasAPng(navegador);
    await pantallasAPng(navegador);
  }
  await navegador.close();
})();
