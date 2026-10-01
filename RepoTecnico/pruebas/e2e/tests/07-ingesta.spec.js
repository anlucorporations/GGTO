/** E2E-07 · INGESTA (pestaña de OPERACIÓN): CSV diario y fichas D-72 (RF-01/RF-02). */
const path = require('path');
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

const MUESTRA = path.resolve(
  __dirname,
  '../../../muestras/detalle_averias_gpon_EJEMPLO.csv',
);

test.describe('Ingesta (pestaña de OPERACIÓN)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    // D-72: la ruta antigua redirige a OPERACIÓN con la pestaña INGESTA activa.
    await page.goto('/ingesta');
    await expect(page).toHaveURL(/pestana=ingesta/);
    await expect(page.getByRole('heading', { name: 'Ingesta', level: 1 })).toBeVisible({
      timeout: 60_000,
    });
  });

  test('la muestra CSV se previsualiza sin errores', async ({ page }) => {
    await page.getByRole('button', { name: 'Cargar archivo diario' }).click();
    await expect(page.getByRole('dialog', { name: 'Cargar archivo diario' })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(MUESTRA);
    await page.getByRole('dialog').getByRole('button', { name: 'Simular (preview)' }).click();
    await expect(page.locator('.aviso-error')).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Historial de lotes' })).toBeVisible();
  });

  test('la pestaña muestra Ingesta, Zona casos globales y Zona capacidad operativa (D-72)', async ({
    page,
  }) => {
    for (const ficha of ['Zona casos globales', 'Zona capacidad operativa']) {
      await expect(page.getByRole('heading', { name: new RegExp(ficha) })).toBeVisible();
    }
  });

  test('el historial de lotes se recarga', async ({ page }) => {
    await page.getByRole('button', { name: 'Recargar' }).click();
    await expect(page.getByRole('heading', { name: 'Historial de lotes' })).toBeVisible();
  });

  test('el TÉCNICO no ve la pestaña INGESTA (requisito 1.2)', async ({ page }) => {
    // El beforeEach abrió sesión de ADMIN: se cierra antes de entrar como técnico.
    await page.getByTitle('Menú del usuario').click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForURL(/\/login/);
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'INGESTA' })).toHaveCount(0);
    await page.goto('/ingesta');
    // Si intenta entrar por URL, cae en WIDGET (primera pestaña visible).
    await expect(page.getByRole('heading', { name: 'Widget', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cargar archivo diario' })).toHaveCount(0);
  });
});
