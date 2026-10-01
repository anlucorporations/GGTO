/** E2E-05 · AGENDA: vistas día/semana/mes y alta de cita (RF-12 / RNF-04). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('./../helpers');

test.describe('Agenda', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/agenda');
    await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
  });

  const CLASES = { Día: '.cal-dia-lista', Semana: '.cal-semana', Mes: '.cal-mes' };
  for (const vista of ['Día', 'Semana', 'Mes']) {
    test(`la vista ${vista} se renderiza`, async ({ page }) => {
      await page.getByRole('button', { name: vista, exact: true }).click();
      await expect(page.locator(CLASES[vista])).toBeVisible();
    });
  }

  test('navega al día de hoy', async ({ page }) => {
    await page.getByRole('button', { name: 'Hoy' }).click();
    await expect(page.getByRole('button', { name: 'Hoy' })).toBeVisible();
  });

  test('crea una cita localizando el caso por Id de Avería (D-72)', async ({ page }) => {
    const manana = new Date(Date.now() + 24 * 3600 * 1000);
    const valor = `${manana.toISOString().slice(0, 10)}T09:30`;
    await page.getByRole('button', { name: 'Nueva cita' }).click();
    await expect(page.getByRole('dialog', { name: 'Nueva cita' })).toBeVisible();
    // D-72: el caso se localiza SOLO por Id de Avería, Tipo, Número o Clase.
    await expect(page.getByLabel('ID caso', { exact: true })).toHaveCount(0);
    await page.getByLabel('Criterio').selectOption('averia');
    await rellenar(page.getByLabel('Valor'), 'E2E-0001');
    await page.getByRole('button', { name: 'Localizar' }).click();
    await page.getByRole('row', { name: /E2E-0001/ }).click();
    await expect(page.getByText('Información del caso (solo lectura)')).toBeVisible();
    await rellenar(page.getByLabel('Fecha y hora'), valor);
    await page.getByRole('dialog').getByRole('button', { name: 'Agendar cita' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 30_000 });
  });

  test('el calendario se filtra por Cuadrilla, Tipo y Clase (D-72)', async ({ page }) => {
    await expect(page.getByLabel('Cuadrilla', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Tipo', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Clase', { exact: true })).toBeVisible();
    await page.getByLabel('Tipo', { exact: true }).selectOption('CONSTRUCCION');
    await expect(page.getByText(/cita\(s\) en el rango visible/)).toBeVisible();
  });
});
