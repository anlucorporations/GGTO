/** E2E-10 · CONFIGURACIÓN: alta en sectores, técnicos y catálogos (RF-03…RF-05). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('../helpers');

test.describe('Configuración', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
  });

  test('crea un sector', async ({ page }) => {
    await page.goto('/sectores');
    const sufijo = String(Date.now()).slice(-6);
    await page.getByRole('button', { name: 'Nuevo sector' }).click();
    await expect(page.getByRole('dialog', { name: 'Nuevo sector' })).toBeVisible();
    await page.getByLabel('Central *').selectOption({ index: 1 });
    await rellenar(page.getByLabel('Nombre *'), `SECTOR E2E ${sufijo}`);
    await rellenar(page.getByLabel('Código *'), `E2E${sufijo}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Crear sector' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });
  });

  test('crea un técnico', async ({ page }) => {
    await page.goto('/tecnicos');
    const sufijo = String(Date.now()).slice(-6);
    await page.getByRole('button', { name: 'Nuevo técnico' }).click();
    await expect(page.getByRole('dialog', { name: 'Nuevo técnico' })).toBeVisible();
    await page.getByLabel('Central *').selectOption({ index: 1 });
    await rellenar(page.getByLabel('Nombre *'), 'Tecnico');
    await rellenar(page.getByLabel('Apellido'), `E2E ${sufijo}`);
    await rellenar(page.getByLabel('P00 *'), `E2E${sufijo}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Crear técnico' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });
  });

  test('crea una causa en catálogos', async ({ page }) => {
    await page.goto('/catalogos');
    const sufijo = String(Date.now()).slice(-6);
    await page.getByRole('button', { name: 'Nueva causa' }).click();
    await expect(page.getByRole('dialog', { name: 'Nueva causa' })).toBeVisible();
    await rellenar(page.getByLabel('Código *').first(), `E2${sufijo}`.slice(0, 6));
    await rellenar(page.getByLabel('Descripción').first(), `Causa E2E ${sufijo}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Crear causa' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });
  });

  test('los parámetros del sistema se listan y son editables', async ({ page }) => {
    await page.goto('/parametros');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar' }).first()).toBeVisible();
  });
});
