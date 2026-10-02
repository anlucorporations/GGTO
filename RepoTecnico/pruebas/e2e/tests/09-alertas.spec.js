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

  test('reporta, planifica y pide material desde la ficha con pestañas (D-75)', async ({ page }) => {
    // Alta manual
    await page.getByRole('button', { name: 'Reportar falla' }).click();
    const modalAlta = page.getByRole('dialog', { name: 'Reportar falla masiva' });
    await expect(modalAlta).toBeVisible();
    await rellenar(modalAlta.getByLabel('Descripción *'), 'Falla E2E de prueba integral');
    await modalAlta.getByRole('button', { name: 'Registrar falla' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });

    // La ficha flotante se abre al seleccionar el renglón (ya no hay botones en la fila)
    const fila = page.locator('#alertas tbody tr').first();
    await expect(fila.getByRole('button', { name: 'Planificar' })).toHaveCount(0);
    await fila.click();
    const ficha = page.getByRole('dialog', { name: /Falla masiva #/ });
    await expect(ficha).toBeVisible();
    for (const pestana of ['Masiva', 'Planificar', 'Materiales', 'Cerrar']) {
      await expect(ficha.getByRole('tab', { name: pestana })).toBeVisible();
    }

    // Pestaña MASIVA: sector, ruta y dirección (campos D-75)
    await expect(ficha.getByText('Ruta (T · P · FAT)')).toBeVisible();
    await expect(ficha.getByText('Dirección (corta)')).toBeVisible();

    // Pestaña PLANIFICAR (RF-17)
    await ficha.getByRole('tab', { name: 'Planificar' }).click();
    await rellenar(ficha.getByLabel('Planificación *'), 'Cuadrilla E2E a las 8:00 con fusionadora');
    await rellenar(ficha.getByLabel('Reporte simple'), 'Se atendió el tramo afectado');
    await rellenar(ficha.getByLabel(/Evidencias/), 'IMG-001, IMG-002');
    await ficha.getByRole('button', { name: 'Guardar planificación' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });

    // Pestaña MATERIALES (RF-18): la orden queda ligada a la falla
    await ficha.getByRole('tab', { name: 'Materiales' }).click();
    await rellenar(ficha.getByLabel('Material requerido *'), '50 m de fibra y 4 conectores SC/APC');
    await ficha.getByRole('button', { name: 'Solicitar material' }).click();
    await expect(ficha.getByRole('cell', { name: /50 m de fibra/ })).toBeVisible({ timeout: 40_000 });

    // Pestaña CERRAR: flujo de estados con Cerrar rápido
    await ficha.getByRole('tab', { name: 'Cerrar' }).click();
    await expect(ficha.getByRole('button', { name: 'CERRADA' })).toBeVisible();
  });

  test('la tabla muestra Ruta e Indicadores y ya no la columna Acciones (D-75)', async ({ page }) => {
    await page.getByRole('button', { name: 'Detectar fallas' }).click();
    await expect(page.locator('.aviso-ok, .aviso-error').first()).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('columnheader', { name: 'Ruta' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Indicadores' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Acciones' })).toHaveCount(0);
    // Renglón clicable: cualquier parte abre la ficha
    const fila = page.locator('#alertas tbody tr').first();
    await expect(fila).toHaveClass(/fila-clicable/);
  });

  test('procesa la bandeja de notificaciones (outbox)', async ({ page }) => {
    await page.getByRole('button', { name: 'Procesar outbox' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('heading', { name: 'Bandeja de notificaciones' })).toBeVisible();
  });
});
