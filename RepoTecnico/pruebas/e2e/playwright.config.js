/**
 * Configuración de Playwright para las pruebas E2E de GGTO (Fase 4).
 *
 * La aplicación bajo prueba se levanta en local contra el esquema aislado
 * `ggto_e2e` (ver `RepoTecnico/pruebas/run_e2e.sh`). No se usa producción.
 */
const { defineConfig, devices } = require('@playwright/test');

const BASE = process.env.GGTO_E2E_URL || 'http://127.0.0.1:8090';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['json', { outputFile: '../logs/e2e-resultados.json' }],
    ['html', { outputFolder: '../logs/e2e-reporte', open: 'never' }],
  ],
  use: {
    baseURL: BASE,
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'es-VE',
    timezoneId: 'America/Caracas',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
