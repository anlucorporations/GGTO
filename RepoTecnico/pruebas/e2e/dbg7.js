const { chromium } = require('@playwright/test');
(async () => {
  for (const opts of [
    { label: 'shell', o: {} },
    { label: 'full-new', o: { executablePath: '/home/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' } },
  ]) {
    try {
      const browser = await chromium.launch(opts.o);
      const page = await browser.newPage();
      await page.goto('http://127.0.0.1:8090/login');
      await page.waitForTimeout(800);
      await page.locator('#p00').focus();
      await page.keyboard.insertText('XYZ');
      await page.waitForTimeout(300);
      console.log(opts.label, 'insertText ->', JSON.stringify(await page.locator('#p00').inputValue()));
      await browser.close();
    } catch (e) { console.log(opts.label, 'ERROR', e.message.split('\n')[0]); }
  }
})();
