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

  test('muestra los especiales separados, los sectores y las cuadrillas', async ({
    page,
  }) => {
    const modal = page.getByRole('dialog', { name: /Procesar despacho/ });
    // D-114: la sección «Universo de casos» ya no existe; el formulario arranca
    // en el checklist y el cuadro de sectores.
    await expect(
      modal.getByRole('heading', { name: 'Sectores y cuadrilla asignada' }),
    ).toBeVisible({ timeout: 30_000 });

    // D-114: el resumen principal separa los tres conceptos de especiales.
    await expect(modal.getByText('Especiales Reparación', { exact: true }).first()).toBeVisible();
    await expect(modal.getByText('Especiales Construcción', { exact: true }).first()).toBeVisible();
    await expect(modal.getByText('Especiales Gobierno', { exact: true }).first()).toBeVisible();

    // D-114: la tabla de sectores trae la lista desplegable de masivas del sector.
    await expect(
      modal.getByRole('columnheader', { name: 'Masivas del sector' }),
    ).toBeVisible();
    await expect(
      modal.getByRole('heading', { name: 'Cuadrillas y sectores asignados' }),
    ).toBeVisible();

    // El sector con casos aparece con su total.
    await expect(modal.getByRole('cell', { name: 'SECTOR E2E' }).first()).toBeVisible();
    // Las dos cuadrillas de calle están disponibles (tarjetas, no los <option>)
    await expect(modal.locator('.ficha-tarjeta', { hasText: 'E2E-C1' })).toBeVisible();
    await expect(modal.locator('.ficha-tarjeta', { hasText: 'E2E-C2' })).toBeVisible();
    // D-77: la cuadrilla 0 (supervisor) también aparece, sin sectores
    const tarjetaC0 = modal.locator('.ficha-tarjeta', { hasText: 'C-00' });
    await expect(tarjetaC0).toBeVisible();
    await expect(tarjetaC0).toContainText('Cuadrilla 0');
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
