/** E2E-06 · DESPACHO: propuesta, generación y ficha del despacho (RF-08/RF-24 · D-99). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

test.describe('Despacho', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    // `Generar despacho` usa window.confirm; se acepta siempre.
    page.on('dialog', (dialogo) => dialogo.accept());
    await page.goto('/despacho');
    await expect(page.getByRole('heading', { name: 'Despacho', level: 1 })).toBeVisible();
  });

  test('simula la propuesta de reparto por cuadrilla', async ({ page }) => {
    await page.getByRole('button', { name: 'Simular propuesta' }).click();
    await expect(page.getByText(/propuesta/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('procesa el despacho del día desde el formulario flotante', async ({ page }) => {
    await page.getByRole('button', { name: 'Procesar despacho' }).click();
    const modal = page.getByRole('dialog', { name: /Procesar despacho/ });
    await expect(modal).toBeVisible();
    // D-114: la sección «Universo de casos» se eliminó; el formulario se apoya
    // en el cuadro de sectores y cuadrillas.
    await expect(
      modal.getByRole('heading', { name: 'Sectores y cuadrilla asignada' }),
    ).toBeVisible({ timeout: 30_000 });
    // D-99: el formulario distingue el primer procesamiento del reproceso.
    await expect(
      modal.getByText(/Primer procesamiento de la jornada|Reproceso de la jornada/),
    ).toBeVisible();
    await modal.getByRole('button', { name: /Procesar despacho|Reprocesar despacho/ }).click();
    await expect(page.locator('.aviso-ok, .aviso-error')).toBeVisible({ timeout: 60_000 });
  });

  /**
   * D-99 (RF-68 · DEC-MA-7): la ficha flotante del despacho ya NO cierra el
   * despacho a mano. El corte es automático a las 23:50 y los casos sin cerrar
   * vuelven a PENDIENTE para la jornada siguiente.
   */
  test('la ficha del despacho no ofrece cerrar el despacho y muestra los Box Infos', async ({
    page,
  }) => {
    const verDetalle = page.getByRole('button', { name: 'Ver detalle' }).first();
    test.skip((await verDetalle.count()) === 0, 'La jornada no tiene despachos que detallar');
    await verDetalle.click();

    const modal = page.getByRole('dialog', { name: /Detalle del despacho/ });
    await expect(modal).toBeVisible();

    // Box Infos del resumen.
    await expect(modal.locator('.box-infos')).toBeVisible();
    await expect(modal.locator('.box-info', { hasText: 'Cumplimiento' })).toBeVisible();

    // Aviso del corte automático.
    await expect(modal.getByText(/se cierra solo a las/)).toBeVisible();

    // La zona de acciones conserva Publicar e Imprimir, pero no Cerrar.
    // (El ✕ del modal vive en la cabecera, fuera de `.acciones-form`.)
    await expect(modal.locator('.acciones-form').getByRole('button', { name: 'Publicar' }))
      .toBeVisible();
    await expect(
      modal.locator('.acciones-form').getByRole('button', { name: 'Cerrar', exact: true }),
    ).toHaveCount(0);
  });

  /**
   * D-99 (RF-70): el reporte de producción se presenta como un aro de
   * cumplimiento por cuadrilla, no como una tabla de tarjetas.
   */
  test('el reporte de producción dibuja un aro por cuadrilla', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reporte de producción' })).toBeVisible();
    await expect(page.getByText('Cumplimiento por cuadrilla')).toBeVisible();
    await expect(page.locator('.rejilla-aros .aro-cuadrilla').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  /**
   * D-99 (RF-60 · punto 2.5): la ficha «Fallas masivas» desapareció de DESPACHO:
   * su contenido vive en la sección MASIVAS.
   */
  test('DESPACHO ya no incluye la ficha de fallas masivas', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Fallas masivas' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Registrar falla' })).toHaveCount(0);
  });
});
