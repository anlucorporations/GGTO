/** E2E-13 · Requisitos de UI: barra por dispositivo, modales al 90 % y pie de tabla. */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

const TOLERANCIA = 10; // px de holgura para las medidas del 90 %

test.describe('Requisitos de UI', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
  });

  test('en PC la barra muestra solo los nombres de las secciones', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    const etiqueta = page.locator('.topbar-nav .nav-item .nav-etiqueta').first();
    const icono = page.locator('.topbar-nav .nav-item .nav-icono').first();
    await expect(etiqueta).toBeVisible();
    await expect(etiqueta).not.toBeEmpty();
    await expect(icono).toBeHidden();
  });

  test('en móvil la barra muestra solo los iconos de las secciones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.topbar-nav .nav-item .nav-etiqueta').first()).toBeHidden();
    await expect(page.locator('.topbar-nav .nav-item .nav-icono').first()).toBeVisible();
    // Las secciones siguen siendo accesibles por su nombre accesible.
    await expect(page.getByRole('link', { name: 'CASOS' })).toBeVisible();
  });

  test('los formularios se abren en un modal del 90 % con título y cerrar', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/central');
    await page.getByRole('button', { name: 'Nueva central' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Nueva central' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole('heading', { name: 'Nueva central' })).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Cerrar' })).toBeVisible();

    const vp = page.viewportSize();
    const caja = await dialogo.boundingBox();
    expect(Math.abs(caja.width - vp.width * 0.9)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(caja.height - vp.height * 0.9)).toBeLessThanOrEqual(TOLERANCIA);

    // El icono de cerrar cierra el modal.
    await dialogo.getByRole('button', { name: 'Cerrar' }).click();
    await expect(dialogo).toHaveCount(0);
  });

  test('las fichas de detalle también son modales', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/casos');
    await page.getByRole('row', { name: /E2E-0005/ }).getByRole('button', { name: 'Ver ficha' }).click();
    const dialogo = page.getByRole('dialog', { name: /Ficha del caso/ });
    await expect(dialogo).toBeVisible();
    const vp = page.viewportSize();
    const caja = await dialogo.boundingBox();
    expect(Math.abs(caja.width - vp.width * 0.9)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(caja.height - vp.height * 0.9)).toBeLessThanOrEqual(TOLERANCIA);
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
  });

  test('las tablas ocupan el 90 % y llevan el pie con el conteo total', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/central');
    const envoltura = page.locator('.tabla-envoltura').first();
    await expect(envoltura).toBeVisible();
    const vp = page.viewportSize();
    const caja = await envoltura.boundingBox();
    expect(Math.abs(caja.width - Math.min(vp.width * 0.9, vp.width))).toBeLessThanOrEqual(TOLERANCIA);

    const pie = envoltura.locator('tfoot .tabla-pie');
    await expect(pie).toBeVisible();
    await expect(pie).not.toContainText('Cargando', { timeout: 30_000 });
    await expect(pie).toContainText('Total:');
    const filas = await envoltura.locator('tbody tr').count();
    await expect(pie).toContainText(String(filas));
  });
});
