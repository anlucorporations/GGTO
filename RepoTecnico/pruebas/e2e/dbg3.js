const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:8090' });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://127.0.0.1:8090/login');
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const el = document.getElementById('p00');
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    return {
      outer: el.outerHTML,
      readonly: el.readOnly, disabled: el.disabled,
      hasReactProps: Object.keys(el).filter(k => k.startsWith('__react')).join(','),
      nativeSetter: !!proto && !!proto.set,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  // Intento con setter nativo + input event
  const r = await page.evaluate(() => {
    const el = document.getElementById('p00');
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    proto.set.call(el, 'E2EADM');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  });
  console.log('tras setter nativo =', JSON.stringify(r));
  await page.waitForTimeout(500);
  console.log('tras espera        =', JSON.stringify(await page.locator('#p00').inputValue()));
  await browser.close();
})();
