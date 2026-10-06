const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:8090' });
  page.on('console', m => console.log('CONSOLE:', m.type(), m.text()));
  page.on('response', r => { if (r.url().includes('/api/v1/auth')) console.log('RESP', r.status(), r.url()); });
  await page.goto('http://127.0.0.1:8090/login');
  await page.getByLabel('P00').fill('E2EADM');
  await page.getByLabel('Clave').fill('E2e.Clave.2026');
  console.log('p00 value =', await page.getByLabel('P00').inputValue());
  console.log('clave value =', await page.getByLabel('Clave').inputValue());
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForTimeout(5000);
  console.log('URL =', page.url());
  console.log('aviso =', await page.locator('.aviso').allTextContents());
  await browser.close();
})();
