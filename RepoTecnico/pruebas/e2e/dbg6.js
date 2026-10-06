const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:8090' });
  await page.goto('http://127.0.0.1:8090/login');
  await page.waitForTimeout(1000);
  const p00 = page.locator('#p00');
  await p00.fill('E2EADM');
  await page.locator('#clave').fill('E2e.Clave.2026');
  console.log('p00 =', JSON.stringify(await p00.inputValue()));
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForTimeout(6000);
  console.log('URL final =', page.url());
  await browser.close();
})();
