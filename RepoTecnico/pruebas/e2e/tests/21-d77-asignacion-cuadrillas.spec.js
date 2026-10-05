/**
 * E2E-21 · Ciclo D-77: asignación manual de casos (comunes y especiales) a una
 * cuadrilla desde CASOS y ESPECIALES, y cuadrilla 0 en el proceso de despacho.
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, marcar, iniciarSesion } = require('../helpers');

/** Espera a que el selector tenga cargado el catálogo de cuadrillas. */
async function esperarCuadrillas(selector) {
  await expect(selector).toBeVisible({ timeout: 30_000 });
  await expect(selector.locator('option', { hasText: 'E2E-C1' })).toHaveCount(1, {
    timeout: 30_000,
  });
}

test.describe('Asignación de casos a cuadrillas (D-77)', () => {
  test('CASOS: selecciona, asigna a una cuadrilla y quita del despacho', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);
    await page.goto('/casos');
    await expect(page.getByRole('heading', { name: 'Casos', level: 1 })).toBeVisible();

    // La barra de asignación ofrece las cuadrillas, incluida la 0 (supervisor)
    const selector = page.locator('#cuadrilla-destino');
    await esperarCuadrillas(selector);
    const etiquetas = await selector.locator('option').allTextContents();
    expect(etiquetas[0]).toBe('— Seleccione —');
    expect(etiquetas.some((t) => t.includes('(supervisor)'))).toBeTruthy();
    const destino = etiquetas.find((t) => t.includes('E2E-C2'));
    expect(destino, 'el seed trae la cuadrilla E2E-C2').toBeTruthy();

    // Selecciona el primer caso del listado
    await page.locator('tbody tr').first().getByRole('checkbox').check();
    await expect(page.getByText(/1 caso\(s\) seleccionado\(s\)/)).toBeVisible();

    await selector.selectOption({ label: destino });
    await page.getByRole('button', { name: 'Asignar a cuadrilla' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('E2E-C2', { timeout: 40_000 });
    // La selección se limpia tras asignar
    await expect(page.getByText(/Seleccione casos para asignarlos/)).toBeVisible();

    // Y se puede desasignar: vuelve a marcar y quita del despacho del día
    await page.locator('tbody tr').first().getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Quitar del despacho' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('fuera del despacho', { timeout: 40_000 });
    await expect(page.getByText(/Seleccione casos para asignarlos/)).toBeVisible();
  });

  test('CASOS: asignar a la cuadrilla 0 marca el caso como GESTIÓN', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/casos');
    const selector = page.locator('#cuadrilla-destino');
    await esperarCuadrillas(selector);
    const etiquetas = await selector.locator('option').allTextContents();
    const cuadrilla0 = etiquetas.find((t) => t.includes('(supervisor)'));
    expect(cuadrilla0).toBeTruthy();

    await page.locator('tbody tr').first().getByRole('checkbox').check();
    await selector.selectOption({ label: cuadrilla0 });
    await page.getByRole('button', { name: 'Asignar a cuadrilla' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('C-00', { timeout: 40_000 });

    // El filtro «Cuadrilla 0 (supervisor)» ya devuelve casos
    await page.locator('#filtro-cuadrilla').selectOption('gestion');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
  });

  test('ESPECIALES: selecciona y asigna un caso especial a una cuadrilla', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);

    // El seed no trae casos especiales: se crea uno para poder asignarlo
    await page.goto('/casos');
    await page.getByRole('button', { name: 'Agregar caso' }).click();
    const alta = page.getByRole('dialog', { name: 'Agregar caso' });
    await expect(alta).toBeVisible();
    await rellenar(alta.getByLabel('Nombre del cliente'), 'Gobierno E2E D-77');
    await rellenar(alta.getByLabel('Dirección'), 'CALLE E2E, POSTE 77');
    await rellenar(alta.getByLabel('Problema reportado'), 'Poste caído frente a la escuela');
    await marcar(alta.getByLabel('Es un caso especial'), true);
    await rellenar(alta.getByLabel('Clasificación'), 'GOBIERNO');
    await rellenar(alta.getByLabel('Tipo de actividad'), 'REPARACION');
    await rellenar(alta.getByLabel('Prioridad'), 'ALTA');
    await rellenar(alta.getByLabel('Solicitante — unidad'), 'ALCALDIA E2E');
    await rellenar(alta.getByLabel('Solicitante — nombre'), 'Solicitante D77');
    await rellenar(alta.getByLabel('Solicitante — contacto'), '04247778899');
    await alta.getByRole('button', { name: 'Guardar caso' }).click();
    await expect(page.getByText(/REF-2324X-/).first()).toBeVisible({ timeout: 40_000 });

    await page.goto('/especiales');
    await expect(page.getByRole('heading', { name: 'Especiales', level: 1 })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });

    const selector = page.locator('#cuadrilla-destino-esp');
    await esperarCuadrillas(selector);
    const etiquetas = await selector.locator('option').allTextContents();
    const destino = etiquetas.find((t) => t.includes('E2E-C1'));
    expect(destino, 'el seed trae la cuadrilla E2E-C1').toBeTruthy();

    await page.locator('tbody tr').first().getByRole('checkbox').check();
    await expect(page.getByText(/1 especial\(es\) seleccionado\(s\)/)).toBeVisible();
    await selector.selectOption({ label: destino });
    await page.getByRole('button', { name: 'Asignar a cuadrilla' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('E2E-C1', { timeout: 40_000 });

    // Y se puede quitar del despacho
    await page.locator('tbody tr').first().getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Quitar del despacho' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('fuera del despacho', { timeout: 40_000 });
  });

  test('el TECNICO no ve la selección ni las acciones de cuadrilla', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/casos');
    await expect(page.getByText('Modo solo lectura').first()).toBeVisible();
    await expect(page.locator('#cuadrilla-destino')).toHaveCount(0);
    await expect(page.locator('.col-seleccion')).toHaveCount(0);
  });
});
