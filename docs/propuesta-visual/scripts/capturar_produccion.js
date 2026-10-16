/**
 * GGTO · CANTV — Captura la aplicación DESPLEGADA en Cloud Run.
 *
 * Evidencia de que la propuesta visual está en producción (no solo en local).
 *
 * Uso: node docs/propuesta-visual/scripts/capturar_produccion.js [url]
 *   url por defecto: https://ggto-web-593453426217.europe-west1.run.app
 */
const path = require('path');
const fs = require('fs');

const E2E = path.resolve(__dirname, '../../../RepoTecnico/pruebas/e2e/node_modules');
if (!module.paths.includes(E2E)) module.paths.push(E2E);
const { chromium } = require(path.join(E2E, 'playwright'));

const BASE = process.argv[2] || 'https://ggto-web-593453426217.europe-west1.run.app';
const SALIDA = path.resolve(__dirname, '..', 'capturas');
fs.mkdirSync(SALIDA, { recursive: true });

(async () => {
  const navegador = await chromium.launch();
  for (const [nombre, ancho, alto] of [
    ['produccion-login-escritorio', 1440, 900],
    ['produccion-login-movil', 390, 844],
  ]) {
    const contexto = await navegador.newContext({
      viewport: { width: ancho, height: alto },
      deviceScaleFactor: 2,
    });
    const pagina = await contexto.newPage();
    await pagina.goto(`${BASE}/login`, { waitUntil: 'load' });
    await pagina.waitForTimeout(1200);

    // El aviso de uso restringido se acepta una vez para llegar al formulario.
    const casilla = pagina.locator('#aviso-acepto');
    if (await casilla.count()) {
      await casilla.check();
      await pagina.locator('.aviso-legal-boton').click();
      await pagina.waitForTimeout(600);
    }

    // Comprueba que la superficie de marca está realmente pintada.
    const marcaVisible = await pagina.locator('.login__marca').count();
    const logo = await pagina.locator('.login__logo').getAttribute('src').catch(() => null);
    console.log(`  ${nombre}: .login__marca=${marcaVisible} logo=${logo}`);

    await pagina.evaluate(() => window.scrollTo(0, 0));
    await pagina.waitForTimeout(200);
    await pagina.screenshot({ path: path.join(SALIDA, `${nombre}.png`) });
    console.log(`OK  ${nombre}.png (${ancho}px)`);
    await contexto.close();
  }
  await navegador.close();
})();
