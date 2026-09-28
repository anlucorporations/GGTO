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

  test('crea una cita de contacto para un caso', async ({ page }) => {
    const manana = new Date(Date.now() + 24 * 3600 * 1000);
    const valor = `${manana.toISOString().slice(0, 10)}T09:30`;
    await rellenar(page.getByLabel('ID caso', { exact: true }), '1');
    await rellenar(page.getByLabel('Fecha y hora'), valor);
    await page.getByRole('button', { name: 'Agendar cita' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 30_000 });
  });
});
