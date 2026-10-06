const { chromium } = require('@playwright/test');
const { rellenar } = require('./helpers');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:8090', viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8090/login');
  await rellenar(page.getByLabel('P00'), 'E2EADM');
  await rellenar(page.getByLabel('Clave'), 'E2e.Clave.2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 40000 });
  await page.waitForTimeout(4000);
  const sel = ['html','body','#root','.app-shell','.topbar','.app-contenido','.pagina-cabecera','.pagina-cabecera h1','.panel-bloque'];
  const out = await page.evaluate((sels) => sels.map(s => {
    const el = document.querySelector(s); if (!el) return { s, falta: true };
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return { s, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y),
             display: cs.display, position: cs.position, overflow: cs.overflow, flex: cs.flex };
  }), sel);
  console.log(JSON.stringify(out, null, 2));
  console.log('viewport =', JSON.stringify(page.viewportSize()));
  await browser.close();
})();
