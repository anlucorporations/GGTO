/** E2E-11 · RBAC: TECNICO en modo solo lectura y sin CONFIGURACIÓN (RNF-21). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

test.describe('RBAC', () => {
  test('el TECNICO ve el aviso de solo lectura y no puede crear casos', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await expect(page.getByText('Modo solo lectura').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar caso' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Configuración' })).toHaveCount(0);
  });

  test('el TECNICO puede consultar el listado de casos', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/casos');
    await expect(page.getByRole('heading', { name: 'Casos', level: 1 })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('el TECNICO no puede operar ALERTAS de escritura', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/alertas');
    await expect(page.getByRole('button', { name: 'Detectar fallas' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reportar falla' })).toBeDisabled();
  });

  test('el ADMIN sí puede operar ALERTAS', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/alertas');
    await expect(page.getByRole('button', { name: 'Detectar fallas' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Reportar falla' })).toBeEnabled();
  });
});
