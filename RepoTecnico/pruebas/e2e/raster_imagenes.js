// Rasteriza los SVG de docs/imagenes a PNG con Playwright Chromium.
// Uso: node raster.js [nombre1.svg nombre2.svg ...]   (sin argumentos: todos)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIR = '/home/dsh/workspace/CANTV_PDE/docs/imagenes';

(async () => {
  const args = process.argv.slice(2);
  let files = fs.readdirSync(DIR).filter(f => f.endsWith('.svg'));
  if (args.length) files = files.filter(f => args.includes(f));
  files.sort();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  let ok = 0, fail = 0;
  for (const f of files) {
    const svgPath = path.join(DIR, f);
    const pngPath = svgPath.replace(/\.svg$/, '.png');
    try {
      const svg = fs.readFileSync(svgPath, 'utf8');
      const m = svg.match(/width="(\d+)"\s+height="(\d+)"/);
      if (!m) throw new Error('sin width/height en el SVG');
      const w = parseInt(m[1], 10), h = parseInt(m[2], 10);
      await page.setViewportSize({ width: w, height: h });
      await page.setContent(
        '<!doctype html><html><head><meta charset="utf-8"><style>' +
        'html,body{margin:0;padding:0;background:#fff;}svg{display:block;}</style></head>' +
        '<body>' + svg + '</body></html>',
        { waitUntil: 'load' }
      );
      await page.waitForTimeout(200);
      await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: w, height: h } });
      ok++;
      console.log('OK   ' + f + ' -> ' + path.basename(pngPath) + ' (' + w + 'x' + h + ')');
    } catch (e) {
      fail++;
      console.log('FALLA ' + f + ': ' + e.message);
    }
  }
  await browser.close();
  console.log('---\nSVG procesados: ' + files.length + ' | PNG ok: ' + ok + ' | fallos: ' + fail);
  process.exit(fail ? 1 : 0);
})();
