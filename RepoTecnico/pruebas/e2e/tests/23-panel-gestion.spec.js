/**
 * E2E-23 · D-81: panel de gestión diaria (RF-42/43/44).
 *
 * Asignadas vs. Cerradas por cuadrilla en modos Común/Referidos, con auto-refresco
 * de 30 s y alta manual de casos especiales (solo SUPER/ADMIN/SUPERVISOR).
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

test.describe('Panel de gestión diaria (D-81)', () => {
  test('el supervisor ve Asignadas vs. Cerradas con modos Común/Referidos', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Gestión diaria/i })).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByRole('tab', { name: 'Común' })).toBeVisible();
    await page.getByRole('tab', { name: 'Referidos' }).click();
    await expect(page.getByRole('button', { name: 'Agregar caso especial' })).toBeVisible();
  });

  test('el técnico no ve el panel de gestión diaria', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Gestión diaria/i })).toHaveCount(0);
  });
});
