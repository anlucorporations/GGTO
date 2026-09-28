/** E2E-06 · DESPACHO: propuesta, generación y fallas masivas (RF-08/RF-09/RF-24). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('../helpers');

test.describe('Despacho', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    // `Generar despacho` usa window.confirm; se acepta siempre.
    page.on('dialog', (dialogo) => dialogo.accept());
    await page.goto('/despacho');
    await expect(page.getByRole('heading', { name: 'Despacho', level: 1 })).toBeVisible();
  });

  test('simula la propuesta de reparto por cuadrilla', async ({ page }) => {
    await page.getByRole('button', { name: 'Simular propuesta' }).click();
    await expect(page.getByText(/propuesta/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('genera el despacho del día', async ({ page }) => {
    await page.getByRole('button', { name: 'Generar despacho' }).click();
    await expect(page.locator('.aviso-ok, .aviso-error')).toBeVisible({ timeout: 60_000 });
  });

  test('registra una falla masiva manual desde DESPACHO', async ({ page }) => {
    await page.getByRole('button', { name: 'Registrar falla' }).click();
    await expect(page.getByRole('dialog', { name: 'Registrar falla' })).toBeVisible();
    await rellenar(page.getByLabel('Descripción *'), 'Falla E2E reportada desde despacho');
    await page.getByRole('dialog').getByRole('button', { name: 'Registrar falla' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 30_000 });
  });
});
