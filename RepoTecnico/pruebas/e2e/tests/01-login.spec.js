/** E2E-01 · Autenticación (RF-20, RNF-21/22). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion, cerrarSesion } = require('../helpers');

test.describe('Login', () => {
  test('credenciales válidas entran al panel', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();
    await expect(page.getByText('GGTO', { exact: false }).first()).toBeVisible();
  });

  test('clave incorrecta muestra error y no entra', async ({ page }) => {
    await page.goto('/login');
    await rellenar(page.getByLabel('P00'), USUARIOS.admin.p00);
    await rellenar(page.getByLabel('Clave'), 'clave-incorrecta');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.locator('.aviso-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('P00 inexistente muestra error', async ({ page }) => {
    await page.goto('/login');
    await rellenar(page.getByLabel('P00'), 'NOEXISTE');
    await rellenar(page.getByLabel('Clave'), 'cualquiera');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.locator('.aviso-error')).toBeVisible();
  });

  test('una ruta protegida sin sesión redirige a login', async ({ page }) => {
    await page.goto('/casos');
    await expect(page).toHaveURL(/\/login/);
  });

  test('cerrar sesión vuelve al login', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);
    await cerrarSesion(page);
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('el menú del usuario muestra P00 y rol', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.getByTitle('Menú del usuario').click();
    const menu = page.getByRole('menu', { name: 'Sesión' });
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('E2ETEC');
    await expect(menu).toContainText('TECNICO');
  });
});
