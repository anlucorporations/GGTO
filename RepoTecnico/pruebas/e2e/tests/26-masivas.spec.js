/**
 * E2E-26 · SECCIÓN MASIVAS (D-99).
 *
 * Cubre los seis bloques que pidió el negocio para la web: búsqueda automática,
 * alta manual, gestión, reporte, histórico y ubicación del FAT, además del
 * catálogo de personal externo (validador del CRASS y solicitante).
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

test.describe('Masivas', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    page.on('dialog', (dialogo) => dialogo.accept());
    await page.goto('/masivas');
    await expect(page.getByRole('heading', { name: 'Masivas', level: 1 })).toBeVisible();
  });

  test('la sección declara sus siete bloques', async ({ page }) => {
    const pestanas = page.getByRole('tablist', { name: 'Secciones de Masivas' });
    await expect(pestanas).toBeVisible();
    for (const nombre of [
      'Búsqueda automática',
      'Agregar manual',
      'Gestionar',
      'Generar reporte',
      'Histórico',
      'Ubicación',
      'Personal externo',
    ]) {
      await expect(pestanas.getByRole('tab', { name: nombre })).toBeVisible();
    }
  });

  test('la búsqueda automática dispara la detección por concentración', async ({ page }) => {
    await page.getByRole('tab', { name: 'Búsqueda automática' }).click();
    await page.getByRole('button', { name: 'Detectar masivas' }).click();
    // La detección es idempotente: siempre informa del resultado.
    await expect(page.getByText(/Última detección: \d+ masiva\(s\) nueva\(s\)/)).toBeVisible({
      timeout: 30_000,
    });
  });

  test('registra una masiva manual con ODN, dirección y FAT', async ({ page }) => {
    await page.getByRole('tab', { name: 'Agregar manual' }).click();
    await page.getByRole('button', { name: 'Abrir formulario de reporte manual' }).click();

    const modal = page.getByRole('dialog', { name: 'Agregar masiva manual' });
    await expect(modal).toBeVisible();
    await modal.getByLabel(/Descripción/).fill('Falla masiva E2E desde la sección MASIVAS');
    await modal.getByLabel('ODN').fill('ODN-E2E');
    await modal.getByLabel('FAT').fill('FAT-E2E');
    await modal.getByLabel('Dirección').fill('CALLE E2E, CASA 1');
    await modal.getByRole('button', { name: 'Registrar masiva' }).click();
    // D-99: al crearse, la sección abre la ficha de la masiva recién registrada.
    await expect(
      page.getByRole('dialog', { name: /Masiva #\d+/ }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('el histórico filtra por texto libre y estado', async ({ page }) => {
    await page.getByRole('tab', { name: 'Histórico' }).click();
    await page.getByLabel('Texto libre').fill('E2E');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.locator('.tabla-envoltura').first()).toBeVisible({ timeout: 30_000 });
  });

  test('la ubicación ofrece el mapa o el aviso de FAT sin coordenadas', async ({ page }) => {
    await page.getByRole('tab', { name: 'Ubicación' }).click();
    await expect(page.getByRole('heading', { name: 'Ubicación del FAT' })).toBeVisible();
    await expect(
      page.locator('.masiva-mapa, .masiva-mapa-aviso').first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('el catálogo de personal externo lista los validadores del CRASS', async ({ page }) => {
    await page.getByRole('tab', { name: 'Personal externo' }).click();
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText(/Personal externo/i).first()).toBeVisible();
    await expect(
      panel.getByRole('button', { name: /Agregar|Nuevo|Registrar/i }).first(),
    ).toBeVisible();
  });

  test('el rol TÉCNICO no ve la sección en el menú', async ({ page, context }) => {
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/masivas');
    // `RutaGestion` redirige al panel: el técnico no administra masivas.
    await expect(page).toHaveURL(/\/$/);
  });
});
