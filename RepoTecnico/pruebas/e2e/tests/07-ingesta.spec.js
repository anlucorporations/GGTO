/** E2E-07 · INGESTA: previsualización del CSV diario (RF-01/RF-02). */
const path = require('path');
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

const MUESTRA = path.resolve(
  __dirname,
  '../../../muestras/detalle_averias_gpon_EJEMPLO.csv',
);

test.describe('Ingesta', () => {
  test('la muestra CSV se previsualiza sin errores', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/ingesta');
    await expect(page.getByRole('heading', { name: 'Ingesta', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Cargar archivo diario' }).click();
    await expect(page.getByRole('dialog', { name: 'Cargar archivo diario' })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(MUESTRA);
    await page.getByRole('dialog').getByRole('button', { name: 'Simular (preview)' }).click();
    await expect(page.locator('.aviso-error')).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Historial de lotes' })).toBeVisible();
  });

  test('el historial de lotes se muestra', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/ingesta');
    await page.getByRole('button', { name: 'Recargar' }).click();
    await expect(page.getByRole('heading', { name: 'Historial de lotes' })).toBeVisible();
  });
});
