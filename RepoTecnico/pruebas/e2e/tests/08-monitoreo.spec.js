/** E2E-08 · MONITOREO: zonas, gráficos y reporte de trabajo (RF-26/RF-28). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

test.describe('Monitoreo', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/monitoreo');
    await expect(page.getByRole('heading', { name: 'Monitoreo', level: 1 })).toBeVisible();
    await expect(page.getByText('Actualizando…')).toHaveCount(0, { timeout: 60_000 });
  });

  test('se renderizan las zonas del tablero', async ({ page }) => {
    for (const zona of [
      'Zona gestión diaria',
      'Zona casos globales',
      'Zona gestión semanal',
      'Zona reparación',
      'Zona construcción',
      'Zona cuadrilla',
      'Zona capacidad operativa',
    ]) {
      await expect(page.getByRole('heading', { name: new RegExp(zona) })).toBeVisible();
    }
  });

  test('dibuja gráficos SVG propios', async ({ page }) => {
    expect(await page.locator('svg').count()).toBeGreaterThan(0);
  });

  test('genera el reporte de trabajo diario', async ({ page }) => {
    await page.getByRole('button', { name: 'Ver reporte' }).click();
    await expect(page.getByText('Gestión diaria').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Capacidad operativa').first()).toBeVisible();
  });
});
