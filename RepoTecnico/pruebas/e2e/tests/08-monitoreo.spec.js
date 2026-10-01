/** E2E-08 · MONITOREO (pestaña D-72): fichas de monitoreo de casos (RF-26/RF-28). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

test.describe('Monitoreo (pestaña de OPERACIÓN)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    // D-72: la ruta antigua abre la pestaña MONITOREO de OPERACIÓN.
    await page.goto('/monitoreo');
    await expect(page).toHaveURL(/pestana=monitoreo/);
    await expect(page.getByRole('heading', { name: 'Monitoreo', level: 1 })).toBeVisible();
  });

  test('la pestaña muestra solo las fichas de monitoreo de los casos', async ({ page }) => {
    for (const zona of [
      'Zona gestión semanal',
      'Zona reparación',
      'Zona construcción',
      'Zona cuadrilla',
    ]) {
      await expect(page.getByRole('heading', { name: new RegExp(zona) })).toBeVisible({
        timeout: 60_000,
      });
    }
    // Las fichas movidas a otras pestañas NO deben aparecer aquí.
    await expect(page.getByRole('heading', { name: /Zona gestión diaria/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Zona casos globales' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Zona capacidad operativa' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Reportes' })).toHaveCount(0);
  });

  test('dibuja gráficos SVG propios', async ({ page }) => {
    expect(await page.locator('svg').count()).toBeGreaterThan(0);
  });
});

test.describe('Monitoreo con alcance por rol (D-72)', () => {
  test('el TÉCNICO ve solo los datos de su cuadrilla (requisito 1.3)', async ({ page }) => {
    // Sin sesión previa: el login del técnico entra directo.
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/?pestana=monitoreo');
    await expect(page.getByRole('heading', { name: 'Monitoreo', level: 1 })).toBeVisible();
    await expect(page.getByText('de su cuadrilla', { exact: false }).first()).toBeVisible();
  });

  test('el SUPERVISOR ve los datos globales', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);
    await page.goto('/?pestana=monitoreo');
    await expect(page.getByRole('heading', { name: 'Monitoreo', level: 1 })).toBeVisible();
    await expect(page.getByText('de su cuadrilla', { exact: false })).toHaveCount(0);
  });
});

test.describe('WIDGET (pestaña de OPERACIÓN)', () => {
  test('muestra Búsqueda rápida, Reportes y Gestión diaria (requisito 1.1)', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Widget', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Búsqueda rápida de casos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Zona gestión diaria/ })).toBeVisible({
      timeout: 60_000,
    });
    // Las demás sub-secciones no están en pantalla (pestañas, no apilado).
    await expect(page.getByRole('heading', { name: 'Ingesta', level: 1 })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Alertas', level: 1 })).toHaveCount(0);
  });

  test('genera el reporte de trabajo diario desde WIDGET', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver reporte' }).click();
    await expect(page.getByRole('heading', { name: 'Gestión diaria' }).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: 'Capacidad operativa' }).first()).toBeVisible();
  });
});
