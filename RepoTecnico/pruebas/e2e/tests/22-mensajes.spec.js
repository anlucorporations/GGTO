/**
 * E2E-22 · D-81: mensajería interna (RF-41).
 *
 * El supervisor envía un mensaje y el técnico lo recibe en su bandeja; el sondeo
 * es cada 20 s (única pieza del sistema con ese periodo).
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('../helpers');

test.describe('Mensajería interna (D-81)', () => {
  test('el supervisor envía un mensaje a todos los técnicos', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.getByTitle('Menú del usuario').click();
    await page.getByRole('menuitem', { name: 'Mensajes' }).click();
    await expect(page).toHaveURL(/\/mensajes$/);

    await page.getByLabel('Destino').selectOption('TODOS');
    await rellenar(page.getByLabel(/Mensaje/), 'Mensaje E2E del supervisor');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 30_000 });
  });

  test('el técnico abre su bandeja de mensajes', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.getByTitle('Menú del usuario').click();
    await page.getByRole('menuitem', { name: 'Mensajes' }).click();
    await expect(page.getByRole('heading', { name: 'Mensajes' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('tab', { name: 'Recibidos' })).toBeVisible();
  });
});
