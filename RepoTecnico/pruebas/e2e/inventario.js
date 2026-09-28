const { chromium } = require('@playwright/test');
const { rellenar } = require('./helpers');
const RUTAS = ['/', '/casos', '/especiales', '/agenda', '/despacho', '/ingesta', '/monitoreo', '/alertas', '/central', '/sectores', '/tecnicos', '/flota', '/cuadrillas', '/catalogos', '/parametros'];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:8090', viewport: { width: 1440, height: 1200 } });
  await page.goto('http://127.0.0.1:8090/login');
  await rellenar(page.getByLabel('P00'), 'E2EADM');
  await rellenar(page.getByLabel('Clave'), 'E2e.Clave.2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 40000 });
  for (const r of RUTAS) {
    await page.goto('http://127.0.0.1:8090' + r);
    await page.waitForTimeout(3500);
    const d = await page.evaluate(() => ({
      h1: Array.from(document.querySelectorAll('h1')).map(e => e.textContent.trim()),
      h2: Array.from(document.querySelectorAll('h2')).map(e => e.textContent.trim()),
      botones: Array.from(document.querySelectorAll('button')).map(b => (b.textContent || b.getAttribute('aria-label') || '').trim()).filter(Boolean),
      campos: Array.from(document.querySelectorAll('label')).map(l => l.textContent.trim()),
      selecciones: Array.from(document.querySelectorAll('select')).map(s => ({ id: s.id, opciones: Array.from(s.options).map(o => o.textContent.trim()) })),
      tablas: Array.from(document.querySelectorAll('table')).map(t => Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim())),
      filas: document.querySelectorAll('tbody tr').length,
    }));
    console.log('\n### ' + r);
    console.log(JSON.stringify(d));
  }
  await browser.close();
})();
