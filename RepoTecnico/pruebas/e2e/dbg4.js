const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:8090' });
  await page.goto('http://127.0.0.1:8090/login');
  await page.waitForTimeout(1000);
  const p00 = page.locator('#p00');
  await p00.focus();
  console.log('focused =', await page.evaluate(() => document.activeElement && document.activeElement.id));
  await page.keyboard.type('E2EADM', { delay: 30 });
  console.log('keyboard.type =', JSON.stringify(await p00.inputValue()));
  await page.locator('#clave').focus();
  await page.keyboard.type('E2e.Clave.2026', { delay: 20 });
  console.log('clave =', JSON.stringify(await page.locator('#clave').inputValue()));
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForTimeout(6000);
  console.log('URL final =', page.url());
  await browser.close();
})();
