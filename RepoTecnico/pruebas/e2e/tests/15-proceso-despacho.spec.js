/**
 * E2E-15 · Ciclo D-66: formulario flotante de proceso del despacho, asignación
 * dinámica de sectores por cuadrilla y casos especiales en el universo.
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

test.describe('Proceso de despacho', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    page.on('dialog', (dialogo) => dialogo.accept());
    await page.goto('/despacho');
    await expect(page.getByRole('heading', { name: 'Despacho', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Procesar despacho' }).click();
    await expect(page.getByRole('dialog', { name: /Procesar despacho/ })).toBeVisible();
  });

  test('muestra el universo (comunes y especiales), los sectores y las cuadrillas', async ({
    page,
  }) => {
    const modal = page.getByRole('dialog', { name: /Procesar despacho/ });
    await expect(modal.getByText('Universo de casos')).toBeVisible({ timeout: 30_000 });
    await expect(modal.getByText('Comunes', { exact: true }).first()).toBeVisible();
    await expect(modal.getByText('Especiales', { exact: true }).first()).toBeVisible();
    await expect(
      modal.getByRole('heading', { name: 'Sectores y cuadrilla asignada' }),
    ).toBeVisible();
    await expect(
      modal.getByRole('heading', { name: 'Cuadrillas y sectores asignados' }),
    ).toBeVisible();

    // El sector con casos aparece con su total (la columna Sector del universo
    // repite el nombre, por eso se toma la primera coincidencia)
    await expect(modal.getByRole('cell', { name: 'SECTOR E2E' }).first()).toBeVisible();
    // Las dos cuadrillas de calle están disponibles (tarjetas, no los <option>)
    await expect(modal.locator('.ficha-tarjeta', { hasText: 'E2E-C1' })).toBeVisible();
    await expect(modal.locator('.ficha-tarjeta', { hasText: 'E2E-C2' })).toBeVisible();

    // Filtro del universo: los especiales son REFERIDO/EMPRESA/GOBIERNO
    await modal.getByRole('button', { name: 'Especiales' }).click();
    await expect(modal.getByRole('cell', { name: 'E2E-0006' })).toBeVisible();
    await expect(modal.getByRole('cell', { name: 'E2E-0008' })).toBeVisible();
    await expect(modal.getByRole('cell', { name: 'E2E-0001' })).toHaveCount(0);
  });

  test('permite cambiar la asignación de sector y procesar el despacho', async ({ page }) => {
    const modal = page.getByRole('dialog', { name: /Procesar despacho/ });
    await expect(modal.getByLabel('Cuadrilla para SECTOR E2E')).toBeVisible({ timeout: 30_000 });

    // Reasignar el sector de la cuadrilla por defecto a E2E-C2
    const selector = modal.getByLabel('Cuadrilla para SECTOR E2E');
    const opciones = await selector.locator('option').allTextContents();
    const destino = opciones.find((t) => t.includes('E2E-C2'));
    expect(destino).toBeTruthy();
    await selector.selectOption({ label: destino });

    // La tarjeta de la cuadrilla refleja el sector asignado
    const tarjeta = modal.locator('.ficha-tarjeta', { hasText: 'E2E-C2' });
    await expect(tarjeta).toContainText('SECTOR E2E');

    await modal.getByRole('button', { name: 'Procesar despacho' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 60_000 });

    // El detalle se abre solo; se cierra para mirar el listado del día
    await page.keyboard.press('Escape');
    const panel = page.locator('.panel-bloque').filter({ hasText: 'Despachos del' });
    await expect(panel.locator('tbody')).toContainText('E2E-C2');
  });

  test('cancelar cierra el formulario sin procesar', async ({ page }) => {
    const modal = page.getByRole('dialog', { name: /Procesar despacho/ });
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog', { name: /Procesar despacho/ })).toHaveCount(0);
  });
});
