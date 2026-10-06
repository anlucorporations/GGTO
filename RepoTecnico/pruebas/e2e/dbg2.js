const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:8090' });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => console.log('CONSOLE:', m.type(), m.text()));
  await page.goto('http://127.0.0.1:8090/login');
  const p00 = page.locator('#p00');
  await p00.click();
  await p00.pressSequentially('E2EADM', { delay: 50 });
  console.log('tras teclado  =', JSON.stringify(await p00.inputValue()));
  await page.waitForTimeout(500);
  console.log('tras espera   =', JSON.stringify(await p00.inputValue()));
  await browser.close();
})();
