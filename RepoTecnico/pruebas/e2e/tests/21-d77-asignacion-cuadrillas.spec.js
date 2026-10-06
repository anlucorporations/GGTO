/**
 * E2E-21 · D-77/D-78/D-79: asignación manual de casos a una cuadrilla.
 *
 * D-78 movió la asignación de la sección CASOS a la **ficha del caso** (pestaña
 * Despacho) y retiró la selección múltiple del cuadro principal. D-79 hizo lo
 * mismo en ESPECIALES: la asignación vive en la **ficha del especial** y el
 * listado pierde la barra de selección y su columna de casillas. También cubre
 * la cuadrilla 0 en el proceso de despacho.
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

/** Abre la ficha del primer caso del listado y entra en la pestaña Despacho. */
async function abrirDespachoDePrimerCaso(page) {
  await page.goto('/casos');
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('tbody tr').first().click();
  const ficha = page.getByRole('dialog');
  await expect(ficha).toBeVisible({ timeout: 30_000 });
  await ficha.getByRole('tab', { name: 'Despacho' }).click();
  return ficha;
}

test.describe('Asignación de casos a cuadrillas (D-77/D-78)', () => {
  test('CASOS: sin selección masiva en el listado; se asigna desde la ficha', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);
    await page.goto('/casos');
    await expect(page.getByRole('heading', { name: 'Casos', level: 1 })).toBeVisible();

    // D-78: el cuadro principal ya no ofrece casillas ni barra de asignación
    await expect(page.locator('.col-seleccion')).toHaveCount(0);
    await expect(page.locator('#cuadrilla-destino')).toHaveCount(0);

    // La asignación vive en la ficha del caso, pestaña Despacho
    const ficha = await abrirDespachoDePrimerCaso(page);
    const selector = ficha.locator('#ficha-cuadrilla-destino');
    await esperarCuadrillas(selector);
    const etiquetas = await selector.locator('option').allTextContents();
    expect(etiquetas[0]).toBe('— Seleccione —');
    expect(etiquetas.some((t) => t.includes('(supervisor)'))).toBeTruthy();
    const destino = etiquetas.find((t) => t.includes('E2E-C2'));
    expect(destino, 'el seed trae la cuadrilla E2E-C2').toBeTruthy();

    await selector.selectOption({ label: destino });
    await ficha.getByRole('button', { name: 'Asignar a cuadrilla' }).click();
    await expect(ficha.locator('.aviso-ok')).toContainText('E2E-C2', { timeout: 40_000 });

    // Y se puede quitar del despacho del día desde la misma ficha
    await ficha.getByRole('button', { name: 'Quitar del despacho' }).click();
    await expect(ficha.locator('.aviso-ok')).toContainText('fuera del despacho', {
      timeout: 40_000,
    });
  });

  test('CASOS: asignar a la cuadrilla 0 desde la ficha lo marca como GESTIÓN', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    const ficha = await abrirDespachoDePrimerCaso(page);
    const selector = ficha.locator('#ficha-cuadrilla-destino');
    await esperarCuadrillas(selector);
    const etiquetas = await selector.locator('option').allTextContents();
    const cuadrilla0 = etiquetas.find((t) => t.includes('(supervisor)'));
    expect(cuadrilla0).toBeTruthy();

    await selector.selectOption({ label: cuadrilla0 });
    await ficha.getByRole('button', { name: 'Asignar a cuadrilla' }).click();
    await expect(ficha.locator('.aviso-ok')).toContainText('C-00', { timeout: 40_000 });

    // El filtro «Cuadrilla 0 (supervisor)» ya devuelve casos
    await page.keyboard.press('Escape');
    await page.locator('#filtro-cuadrilla').selectOption('gestion');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });

    // D-80: el estado muestra el icono de la cuadrilla con su color, no el de
    // «Asignado»; el chip lleva el código de la cuadrilla y una clase de tono.
    const chip = page.locator('tbody tr').first().locator('[data-testid="chip-cuadrilla"]');
    await expect(chip).toBeVisible({ timeout: 30_000 });
    await expect(chip).toHaveAttribute('data-cuadrilla', /C-?0/);
    await expect(chip).toHaveClass(/tono-/);
  });

  test('ESPECIALES: sin selección masiva; se asigna desde la ficha del especial', async ({
    page,
  }) => {
    await iniciarSesion(page, USUARIOS.supervisor);

    // El seed no trae casos especiales: se crea uno para poder asignarlo
    await page.goto('/casos');
    await page.getByRole('button', { name: 'Agregar caso' }).click();
    const alta = page.getByRole('dialog', { name: 'Agregar caso' });
    await expect(alta).toBeVisible();
    await rellenar(alta.getByLabel('Nombre del cliente'), 'Gobierno E2E D-79');
    await rellenar(alta.getByLabel('Dirección'), 'CALLE E2E, POSTE 79');
    await rellenar(alta.getByLabel('Problema reportado'), 'Poste caído frente a la escuela');
    await marcar(alta.getByLabel('Es un caso especial'), true);
    await rellenar(alta.getByLabel('Clasificación'), 'GOBIERNO');
    await rellenar(alta.getByLabel('Tipo de actividad'), 'REPARACION');
    await rellenar(alta.getByLabel('Prioridad'), 'ALTA');
    await rellenar(alta.getByLabel('Solicitante — unidad'), 'ALCALDIA E2E');
    await rellenar(alta.getByLabel('Solicitante — nombre'), 'Solicitante D79');
    await rellenar(alta.getByLabel('Solicitante — contacto'), '04247778899');
    await alta.getByRole('button', { name: 'Guardar caso' }).click();
    await expect(page.getByText(/REF-2324X-/).first()).toBeVisible({ timeout: 40_000 });

    await page.goto('/especiales');
    await expect(page.getByRole('heading', { name: 'Especiales', level: 1 })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });

    // D-79: el cuadro principal ya no ofrece selección ni barra de asignación
    await expect(page.locator('.col-seleccion')).toHaveCount(0);
    await expect(page.locator('#cuadrilla-destino-esp')).toHaveCount(0);
    await expect(page.locator('.barra-asignacion')).toHaveCount(0);
    await expect(page.locator('tbody tr').first().getByRole('checkbox')).toHaveCount(0);

    // La fila abre la FICHA del especial, donde vive la asignación
    await page.locator('tbody tr', { hasText: 'Gobierno E2E D-79' }).click();
    const ficha = page.getByRole('dialog');
    await expect(ficha).toBeVisible({ timeout: 30_000 });
    await expect(ficha).toContainText('Ficha del caso especial');

    const selector = ficha.locator('#esp-cuadrilla-destino');
    await esperarCuadrillas(selector);
    const etiquetas = await selector.locator('option').allTextContents();
    expect(etiquetas[0]).toBe('— Seleccione —');
    const destino = etiquetas.find((t) => t.includes('E2E-C1'));
    expect(destino, 'el seed trae la cuadrilla E2E-C1').toBeTruthy();

    await selector.selectOption({ label: destino });
    await ficha.getByRole('button', { name: 'Asignar a cuadrilla' }).click();
    // En ESPECIALES el aviso vive en la página, no dentro del modal.
    await expect(page.locator('.aviso-ok')).toContainText('E2E-C1', { timeout: 40_000 });

    // D-80: el listado ya refleja la cuadrilla asignada en el chip de estado.
    await expect(
      page
        .locator('tbody tr', { hasText: 'Gobierno E2E D-79' })
        .locator('[data-testid="chip-cuadrilla"]'),
    ).toHaveAttribute('data-cuadrilla', 'E2E-C1', { timeout: 40_000 });

    // Y se puede quitar del despacho sin cerrar la ficha
    await ficha.getByRole('button', { name: 'Quitar del despacho' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('fuera del despacho', {
      timeout: 40_000,
    });
  });

  test('el TECNICO no ve la asignación en el listado ni en la ficha', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/casos');
    await expect(page.getByText('Modo solo lectura').first()).toBeVisible();
    await expect(page.locator('.col-seleccion')).toHaveCount(0);
    await expect(page.locator('#cuadrilla-destino')).toHaveCount(0);

    // La ficha muestra la pestaña Despacho, pero en solo lectura
    await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('tbody tr').first().click();
    const ficha = page.getByRole('dialog');
    await expect(ficha).toBeVisible({ timeout: 30_000 });
    await ficha.getByRole('tab', { name: 'Despacho' }).click();
    await expect(ficha.locator('#ficha-cuadrilla-destino')).toHaveCount(0);
    await expect(
      ficha.getByText(/solo el Supervisor, el Administrador o el Super Usuario/i),
    ).toBeVisible();
  });
});
