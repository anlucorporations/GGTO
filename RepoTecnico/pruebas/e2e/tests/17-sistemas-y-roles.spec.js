/**
 * E2E-17 · Ciclo D-68/D-69: sección SISTEMAS solo para el Super Usuario,
 * ficha de tabla con contenido ofuscado, cambio de rol en TÉCNICOS y
 * gestión del estado del caso por el rol TECNICO.
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('../helpers');

test.describe('Sistemas y roles', () => {
  test('el acceso a SISTEMAS solo aparece en el menú del Super Usuario', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.getByTitle('Menú del usuario').click();
    await expect(page.getByRole('menuitem', { name: 'Sistemas' })).toHaveCount(0);

    await page.goto('/sistemas');
    await expect(page.getByText('exclusiva del Super Usuario')).toBeVisible({ timeout: 30_000 });
  });

  test('el Super Usuario analiza la estructura e inspecciona una tabla', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.super);
    await page.getByTitle('Menú del usuario').click();
    await page.getByRole('menuitem', { name: 'Sistemas' }).click();
    await expect(page).toHaveURL(/\/sistemas$/);

    // El arranque en frío y la BD remota tardan: se espera por el contenido real
    await expect(
      page.getByRole('heading', { name: 'Análisis de la estructura de la base de datos' }),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/pg_trgm|plpgsql/i).first()).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('.tabla-envoltura').first().locator('tbody tr').first()).toBeVisible();

    // Ficha de una tabla concreta con contenido paginado
    await page.selectOption('#sistemas-tabla', 'usuario');
    await expect(page.getByRole('heading', { name: 'Estructura de usuario' })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText('Columnas ofuscadas por seguridad')).toBeVisible();
    await expect(page.getByRole('cell', { name: /^•••• hash no reversible/ }).first()).toBeVisible();
    // La clave real nunca se muestra
    await expect(page.locator('td.mono', { hasText: '$argon2id' })).toHaveCount(0);
  });

  test('el Super Usuario cambia el rol de un técnico desde su ficha', async ({ page }) => {
    const sufijo = String(Date.now()).slice(-6);
    const p00 = `E2EROL${sufijo}`;

    await iniciarSesion(page, USUARIOS.super);
    await page.goto('/tecnicos');
    await page.getByRole('button', { name: 'Nuevo técnico' }).click();
    const modal = page.getByRole('dialog', { name: 'Nuevo técnico' });
    await modal.getByLabel('Central *').selectOption({ index: 1 });
    await rellenar(modal.getByLabel('Nombre *'), 'Cambio');
    await rellenar(modal.getByLabel('P00 *'), p00);
    await modal.getByRole('button', { name: 'Crear técnico' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });

    // Editar y asignar rol
    const fila = page.getByRole('row', { name: new RegExp(p00) });
    await expect(fila.locator('.estado-cuenta')).toHaveText(/sin alta/i);
    await fila.getByRole('button', { name: 'Editar' }).click();
    const edicion = page.getByRole('dialog', { name: /Editar técnico/ });
    await expect(edicion).toBeVisible();
    await edicion.getByLabel('Rol de acceso').selectOption('SUPERVISOR');
    await edicion.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('rol asignado', { timeout: 40_000 });

    const filaRol = page.getByRole('row', { name: new RegExp(p00) });
    await expect(filaRol).toContainText('SUPERVISOR');
  });

  test('el ADMIN no ve el selector de rol en la ficha del técnico', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/tecnicos');
    await page.locator('tbody tr').first().getByRole('button', { name: 'Editar' }).click();
    const edicion = page.getByRole('dialog', { name: /Editar técnico/ });
    await expect(edicion).toBeVisible();
    await expect(edicion.getByLabel('Rol de acceso')).toHaveCount(0);
  });

  test('el TECNICO no tiene la pestaña Gestión ni cambia el estado desde la ficha (D-76)', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/casos');
    await expect(page.getByText('Modo solo lectura').first()).toBeVisible();

    await page.locator('tbody tr').first().click();
    const ficha = page.getByRole('dialog');
    await expect(ficha).toBeVisible();

    // D-76: la pestaña GESTIÓN se eliminó, junto con «Cambiar estado»
    await expect(ficha.getByRole('tab', { name: 'Gestión' })).toHaveCount(0);
    await expect(ficha.getByRole('button', { name: 'Cambiar estado' })).toHaveCount(0);
    // El TECNICO tampoco obtiene la edición ligera (sector, cita, información)
    await expect(
      ficha.getByRole('button', { name: 'Activar la edición de la ficha' }),
    ).toHaveCount(0);
    await ficha.getByRole('tab', { name: 'Clasificación' }).click();
    await expect(ficha.locator('#ficha-sector')).toHaveCount(0);

    // La bitácora de estados sigue visible para consulta
    await expect(ficha.getByRole('heading', { name: /Historial de estados/ })).toBeVisible();
  });
});
