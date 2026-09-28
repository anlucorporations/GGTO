import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire('/home/dsh/workspace/CANTV_PDE/RepoTecnico/pruebas/e2e/package.json')
const { chromium } = require('playwright')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;padding:24px;font-size:15px}
</style></head><body>
<h1>Prueba de fuentes — GGTO</h1>
<p>áéíóú ñ Ñ ¿? ¡! « » — … · → ↔ ≤ ≥ − ×</p>
<p>Emoji: ✅ ❌ ⚠️ ⏳</p>
<p>Alternativas: ✔ ✘ ⚠ ⧗ ✓ ✗ ☑ ☒ ● ▲</p>
<table border="1" cellpadding="6"><tr><th>A</th><th>B</th></tr><tr><td>✅ Sí</td><td>❌ No</td></tr></table>
</body></html>`
fs.writeFileSync('/tmp/smoke.html', html)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
await page.goto('file:///tmp/smoke.html')
await page.screenshot({ path: '/tmp/smoke.png', fullPage: true })
await page.pdf({ path: '/tmp/smoke.pdf', format: 'A4', printBackground: true })
await browser.close()
console.log('OK')
