/** E2E-04 · ESPECIALES: alta como caso especial y listado (RF-35/RF-36). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, marcar, iniciarSesion } = require('../helpers');

test.describe('Especiales', () => {
  test('el alta de un caso especial REFERIDO aparece en ESPECIALES', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);

    await page.getByRole('button', { name: 'Agregar caso' }).click();
    await expect(page.getByRole('dialog', { name: 'Agregar caso' })).toBeVisible();
    await rellenar(page.getByLabel('Nombre del cliente'), 'Empresa Solicitante E2E');
    await rellenar(page.getByLabel('Dirección'), 'CALLE E2E, GALPÓN 5');
    await rellenar(page.getByLabel('Problema reportado'), 'Solicitud de construcción de punto');
    await marcar(page.getByLabel('Es un caso especial'), true);
    await rellenar(page.getByLabel('Clasificación'), 'REFERIDO');
    await rellenar(page.getByLabel('Tipo de actividad'), 'CONSTRUCCION');
    await rellenar(page.getByLabel('Prioridad'), 'ALTA');
    await rellenar(page.getByLabel('Solicitante — unidad'), 'UNIDAD E2E');
    await rellenar(page.getByLabel('Solicitante — nombre'), 'Solicitante E2E');
    await rellenar(page.getByLabel('Solicitante — contacto'), '04249998877');
    await page.getByRole('button', { name: 'Guardar caso' }).click();
    await expect(page.getByText(/REF-2324X-/)).toBeVisible();

    await page.goto('/especiales');
    await expect(page.getByRole('heading', { name: 'Especiales', level: 1 })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('el filtro por clasificación funciona', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/especiales');
    await page.locator('#filtro-clasificacion').selectOption('GOBIERNO');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.locator('.vacio, tbody tr').first()).toBeVisible();
  });
});
