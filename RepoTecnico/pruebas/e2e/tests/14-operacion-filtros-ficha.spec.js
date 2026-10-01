/**
 * E2E-14 · Ciclo D-65/D-72: pestañas de OPERACIÓN (WIDGET/INGESTA/MONITOREO/
 * ALERTAS), filtros de CASOS en una fila y ficha rápida con pestañas.
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('../helpers');

test.describe('OPERACIÓN por pestañas (D-72)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
  });

  test('la barra tiene OPERACIÓN y ya no las secciones fusionadas', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'OPERACIÓN', exact: true })).toBeVisible();
    for (const vieja of ['INGESTA', 'MONITOREO', 'ALERTAS']) {
      await expect(page.getByRole('link', { name: vieja, exact: true })).toHaveCount(0);
    }
  });

  test('OPERACIÓN muestra pestañas y solo la información de la activa', async ({ page }) => {
    await page.goto('/');
    for (const nombre of ['Widget', 'Ingesta', 'Monitoreo', 'Alertas']) {
      await expect(page.getByRole('tab', { name: nombre })).toBeVisible();
    }
    // WIDGET activa por defecto: h1 'Widget' visible y las demás secciones NO.
    await expect(page.getByRole('heading', { name: 'Widget', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ingesta', level: 1 })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Monitoreo', level: 1 })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Alertas', level: 1 })).toHaveCount(0);

    // Cambiar de pestaña muestra solo su contenido (requisito 1).
    await page.getByRole('tab', { name: 'Alertas' }).click();
    await expect(page.getByRole('heading', { name: 'Alertas', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Widget', level: 1 })).toHaveCount(0);
    await expect(page).toHaveURL(/pestana=alertas/);
  });

  test('las rutas antiguas redirigen a la pestaña correspondiente', async ({ page }) => {
    await page.goto('/ingesta');
    await expect(page).toHaveURL(/pestana=ingesta/);
    await page.goto('/monitoreo');
    await expect(page).toHaveURL(/pestana=monitoreo/);
    await page.goto('/alertas');
    await expect(page).toHaveURL(/pestana=alertas/);
    await page.goto('/panel');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Widget', level: 1 })).toBeVisible();
  });

  test('la ficha rápida abre desde WIDGET con el buscador junto al título', async ({ page }) => {
    await page.goto('/');
    const widget = page.locator('#widget');
    await expect(widget.getByRole('heading', { name: 'Búsqueda rápida de casos' })).toBeVisible();
    await rellenar(widget.getByLabel('ID de avería o teléfono'), 'E2E-0001');
    await widget.getByRole('button', { name: 'Buscar', exact: true }).click();

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
  });
});

test.describe('Filtros de CASOS (D-65/D-72)', () => {
  test('los filtros quedan en una sola fila con Clase, Sector, Tipo, Cuadrilla y Estado', async ({
    page,
  }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/casos');
    await expect(page.getByRole('heading', { name: 'Casos', level: 1 })).toBeVisible();

    // Filtros eliminados (D-65).
    await expect(page.locator('#filtro-origen')).toHaveCount(0);
    await expect(page.locator('#filtro-desde')).toHaveCount(0);
    await expect(page.locator('#filtro-hasta')).toHaveCount(0);

    // D-72: los cinco filtros pedidos + texto libre.
    for (const id of ['filtro-q', 'filtro-categoria', 'filtro-sector', 'filtro-tipo',
                      'filtro-cuadrilla', 'filtro-estado']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }

    // Todos los campos comparten la misma fila.
    const cajas = await page.locator('.filtros-tabla > .campo').evaluateAll((nodos) =>
      nodos.map((n) => n.getBoundingClientRect().bottom),
    );
    expect(cajas.length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...cajas) - Math.min(...cajas)).toBeLessThanOrEqual(2);
  });
});
