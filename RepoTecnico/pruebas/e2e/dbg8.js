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
  console.log('URL =', page.url());
  const info = await page.evaluate(() => Array.from(document.querySelectorAll('h1')).map(h => {
    const r = h.getBoundingClientRect(); const cs = getComputedStyle(h);
    return { texto: h.textContent, display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
             w: Math.round(r.width), h: Math.round(r.height), padres: (() => { let n=h.parentElement, out=[]; while(n && out.length<4){ const c=getComputedStyle(n); out.push(`${n.className||n.tagName}:${c.display}/${c.visibility}`); n=n.parentElement;} return out; })() };
  }));
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
