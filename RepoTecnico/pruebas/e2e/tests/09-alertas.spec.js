/** E2E-09 · ALERTAS: métricas, detección RF-09, RF-16/RF-17/RF-18 y outbox RNF-20. */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('../helpers');

test.describe('Alertas', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/alertas');
    await expect(page.getByRole('heading', { name: 'Alertas', level: 1 })).toBeVisible();
  });

  test('muestra las métricas de alertas y canales', async ({ page }) => {
    await expect(page.getByText('Fallas activas')).toBeVisible();
    await expect(page.getByText('Notificaciones pendientes')).toBeVisible();
    await expect(page.getByText('Canal Telegram')).toBeVisible();
  });

  test('detecta fallas masivas por concentración (idempotente)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Fallas masivas' })).toBeVisible();
    await page.getByRole('button', { name: 'Detectar fallas' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });
    // Segunda ejecución: idempotente, no debe duplicar ni fallar
    await page.getByRole('button', { name: 'Detectar fallas' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });
  });

  test('reporta, planifica y pide material para una falla', async ({ page }) => {
    // Alta manual
    await page.getByRole('button', { name: 'Reportar falla' }).click();
    const modalAlta = page.getByRole('dialog', { name: 'Reportar falla masiva' });
    await expect(modalAlta).toBeVisible();
    await rellenar(modalAlta.getByLabel('Descripción *'), 'Falla E2E de prueba integral');
    await modalAlta.getByRole('button', { name: 'Registrar falla' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });

    // Planificación (RF-17)
    await page.locator('#alertas tbody tr').first().getByRole('button', { name: 'Planificar' }).click();
    const modalPlan = page.getByRole('dialog', { name: /Planificar falla/ });
    await expect(modalPlan).toBeVisible();
    await rellenar(modalPlan.getByLabel('Planificación *'), 'Cuadrilla E2E a las 8:00 con fusionadora');
    await rellenar(modalPlan.getByLabel('Reporte simple'), 'Se atendió el tramo afectado');
    await rellenar(modalPlan.getByLabel(/Evidencias/), 'IMG-001, IMG-002');
    await modalPlan.getByRole('button', { name: 'Guardar planificación' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });

    // Material (RF-18)
    await page.locator('#alertas tbody tr').first().getByRole('button', { name: 'Material' }).click();
    const modalMat = page.getByRole('dialog', { name: /Material para la falla/ });
    await expect(modalMat).toBeVisible();
    await rellenar(modalMat.getByLabel('Material requerido *'), '50 m de fibra y 4 conectores SC/APC');
    await modalMat.getByRole('button', { name: 'Solicitar material' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });
  });

  test('procesa la bandeja de notificaciones (outbox)', async ({ page }) => {
    await page.getByRole('button', { name: 'Procesar outbox' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('heading', { name: 'Bandeja de notificaciones' })).toBeVisible();
  });
});
