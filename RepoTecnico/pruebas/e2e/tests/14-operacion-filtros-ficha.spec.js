/**
 * E2E-14 · Ciclo D-65: filtros en una fila, fusión de OPERACIÓN y ficha rápida
 * con pestañas (Actual · Estado · Contacto · Técnico).
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('../helpers');

test.describe('Ciclo de UI D-65', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
  });

  test('los filtros de CASOS quedan en una sola fila y sin Origen ni rango de fechas', async ({
    page,
  }) => {
    await page.goto('/casos');
    await expect(page.getByRole('heading', { name: 'Casos', level: 1 })).toBeVisible();

    // Filtros eliminados.
    await expect(page.locator('#filtro-origen')).toHaveCount(0);
    await expect(page.locator('#filtro-desde')).toHaveCount(0);
    await expect(page.locator('#filtro-hasta')).toHaveCount(0);

    // Todos los campos comparten la misma fila (bordes inferiores alineados;
    // el superior puede variar si una etiqueta ocupa dos líneas).
    const cajas = await page.locator('.filtros-tabla > .campo').evaluateAll((nodos) =>
      nodos.map((n) => n.getBoundingClientRect().bottom),
    );
    expect(cajas.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...cajas) - Math.min(...cajas)).toBeLessThanOrEqual(2);
  });

  test('la barra tiene OPERACIÓN y ya no las secciones fusionadas', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'OPERACIÓN', exact: true })).toBeVisible();
    for (const vieja of ['INGESTA', 'MONITOREO', 'ALERTAS']) {
      await expect(page.getByRole('link', { name: vieja, exact: true })).toHaveCount(0);
    }
  });

  test('OPERACIÓN reúne las cuatro secciones y las rutas antiguas redirigen', async ({ page }) => {
    await page.goto('/');
    for (const ancla of ['#panel', '#ingesta', '#monitoreo', '#alertas']) {
      await expect(page.locator(ancla)).toBeAttached();
    }
    await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ingesta', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Monitoreo', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alertas', level: 1 })).toBeVisible();

    for (const vieja of ['/ingesta', '/monitoreo', '/alertas']) {
      await page.goto(vieja);
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test('la ficha rápida abre con el buscador junto al título y pestañas', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('#panel');
    await rellenar(panel.getByLabel('ID de avería o teléfono'), 'E2E-0001');
    await panel.getByRole('button', { name: 'Buscar', exact: true }).click();

    const ficha = page.getByRole('dialog');
    await expect(ficha).toBeVisible();
    const buscador = ficha.getByLabel('ID de avería o teléfono');
    await expect(buscador).toBeVisible();

    for (const pestana of ['Actual', 'Estado', 'Contacto', 'Técnico']) {
      await expect(ficha.getByRole('tab', { name: pestana })).toBeVisible();
    }

    // El cuadro de texto está en la misma fila que el título de la ficha.
    const titulo = await ficha.getByRole('heading', { level: 2 }).boundingBox();
    const caja = await buscador.boundingBox();
    expect(Math.abs(titulo.y - caja.y)).toBeLessThanOrEqual(40);

    // Cada pestaña muestra su información.
    await expect(ficha.getByRole('tabpanel', { name: 'Actual' })).toContainText('Último comentario');
    await ficha.getByRole('tab', { name: 'Contacto' }).click();
    await expect(ficha.getByRole('tabpanel', { name: 'Contacto' })).toContainText('Cliente');
    await ficha.getByRole('tab', { name: 'Técnico' }).click();
    await expect(ficha.getByRole('tabpanel', { name: 'Técnico' })).toContainText('Reparador principal');
    await ficha.getByRole('tab', { name: 'Estado' }).click();
    await expect(ficha.getByRole('tabpanel', { name: 'Estado' })).toContainText('Historial de estados');
  });
});
