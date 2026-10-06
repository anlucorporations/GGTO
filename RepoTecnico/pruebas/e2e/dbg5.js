const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:8090' });
  await page.goto('http://127.0.0.1:8090/login');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.__cnt = { keydown: 0, input: 0, beforeinput: 0 };
    document.getElementById('p00').addEventListener('keydown', () => window.__cnt.keydown++);
    document.getElementById('p00').addEventListener('input', () => window.__cnt.input++);
    document.getElementById('p00').addEventListener('beforeinput', () => window.__cnt.beforeinput++);
  });
  const p00 = page.locator('#p00');
  await p00.focus();
  await page.keyboard.type('AB', { delay: 50 });
  console.log('contadores =', JSON.stringify(await page.evaluate(() => window.__cnt)));
  console.log('activo =', await page.evaluate(() => document.activeElement.id));
  console.log('valor =', JSON.stringify(await p00.inputValue()));
  await browser.close();
})();
