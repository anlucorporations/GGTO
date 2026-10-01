/** E2E-03 · CASOS: listado, filtros, búsqueda, ficha y alta manual (RF-30…RF-33). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion, buscarGlobal } = require('../helpers');

test.describe('Casos', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/casos');
    await expect(page.getByRole('heading', { name: 'Casos', level: 1 })).toBeVisible();
  });

  test('el listado muestra los casos sembrados', async ({ page }) => {
    await expect(page.locator('tbody tr')).toHaveCount(8);
    await expect(page.getByRole('cell', { name: 'E2E-0001' })).toBeVisible();
  });

  test('el filtro por estado acota el listado', async ({ page }) => {
    await page.locator('#filtro-estado').selectOption('CITADO');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByRole('cell', { name: 'E2E-0006' })).toBeVisible();
  });

  test('la búsqueda por ID de avería ofrece el caso y abre su ficha rápida', async ({ page }) => {
    const resultados = await buscarGlobal(page, 'E2E-0002');
    await expect(resultados).toBeVisible();
    await expect(resultados.getByRole('option')).toHaveCount(1);
    await resultados.getByRole('option', { name: /E2E-0002/ }).click();
    const ficha = page.getByRole('dialog', { name: /Ficha del caso .* E2E-0002/ });
    await expect(ficha).toBeVisible();
    // La ficha rápida muestra las pestañas Actual · Estado · Contacto · Técnico (UI 3).
    for (const pestana of ['Actual', 'Estado', 'Contacto', 'Técnico']) {
      await expect(ficha.getByRole('tab', { name: pestana })).toBeVisible();
    }
  });

  test('la búsqueda por teléfono encuentra el caso', async ({ page }) => {
    const resultados = await buscarGlobal(page, '04140000003');
    await expect(resultados.getByRole('option', { name: /E2E-0004/ })).toBeVisible();
  });

  test('al seleccionar el renglón se abre la ficha del caso (D-72)', async ({ page }) => {
    await page.getByRole('row', { name: /E2E-0005/ }).click();
    const ficha = page.getByRole('dialog');
    await expect(ficha.getByRole('heading', { name: /Ficha del caso/ })).toBeVisible();
    // D-70: los datos se reparten en pestañas; el cliente vive en CONTACTO
    await ficha.getByRole('tab', { name: 'Contacto' }).click();
    await expect(ficha.getByText('Cliente E2E 5')).toBeVisible();
  });

  test('el alta manual genera un caso REF- y lo lista', async ({ page }) => {
    await page.getByRole('button', { name: 'Agregar caso' }).click();
    await expect(page.getByRole('dialog', { name: 'Agregar caso' })).toBeVisible();
    await rellenar(page.getByLabel('Nombre del cliente'), 'Cliente Manual E2E');
    await rellenar(page.getByLabel('Teléfono'), '04149998877');
    await rellenar(page.getByLabel('Dirección'), 'CALLE E2E, CASA 99');
    await rellenar(page.getByLabel('Problema reportado'), 'FALLA FIBRA reportada en campo');
    await page.getByRole('button', { name: 'Guardar caso' }).click();
    await expect(page.getByText(/REF-2324X-/)).toBeVisible();
  });
});
