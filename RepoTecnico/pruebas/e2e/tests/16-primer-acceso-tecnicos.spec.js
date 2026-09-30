/**
 * E2E-16 · Ciclo D-67: primer acceso del técnico (clave + 12 palabras), estado
 * de la cuenta en el resumen de TÉCNICOS y regeneración por el Super Usuario.
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion, cerrarSesion } = require('../helpers');

// P00 y correo únicos por corrida: el seed recrea el esquema, pero se evita
// cualquier resto de ejecuciones previas sobre el mismo esquema.
const SUFIJO = String(Date.now()).slice(-6);
const P00_NUEVO = `E2EAUT${SUFIJO}`;
const CORREO_NUEVO = `autoalta${SUFIJO}@e2e.local`;
const CLAVE_NUEVA = 'Auto.Clave.2026';

test.describe('Primer acceso de técnicos', () => {
  test('el resumen de TÉCNICOS muestra el estado de la cuenta', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/tecnicos');
    await expect(page.getByRole('heading', { name: 'Técnico', level: 1 })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Cuenta' })).toBeVisible();
    await expect(page.locator('.estado-cuenta').first()).toBeVisible();
  });

  test('un técnico nuevo completa su primer acceso y recibe 12 palabras', async ({ page }) => {
    // 1) El supervisor crea el P00 del técnico
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/tecnicos');
    await page.getByRole('button', { name: 'Nuevo técnico' }).click();
    const modal = page.getByRole('dialog', { name: 'Nuevo técnico' });
    await expect(modal).toBeVisible();
    await modal.getByLabel('Central *').selectOption({ index: 1 });
    await rellenar(modal.getByLabel('Nombre *'), 'Autoalta');
    await rellenar(modal.getByLabel('Apellido'), 'E2E');
    await rellenar(modal.getByLabel('P00 *'), P00_NUEVO);
    await modal.getByRole('button', { name: 'Crear técnico' }).click();
    await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 40_000 });

    const fila = page.getByRole('row', { name: new RegExp(P00_NUEVO) });
    await expect(fila.locator('.estado-cuenta')).toHaveText(/sin alta/i);

    // 2) El técnico entra por «Primer acceso» y crea su cuenta
    await cerrarSesion(page);
    await page.getByRole('button', { name: 'Primer acceso (obtener clave)' }).click();
    await rellenar(page.locator('#p00-alta'), P00_NUEVO);
    await page.getByRole('button', { name: 'Comprobar P00' }).click();
    await expect(page.getByText(/aún no tiene cuenta activada/i)).toBeVisible({ timeout: 30_000 });

    await rellenar(page.locator('#alta-correo'), CORREO_NUEVO);
    await rellenar(page.locator('#alta-clave'), CLAVE_NUEVA);
    await rellenar(page.locator('#alta-confirmacion'), CLAVE_NUEVA);
    await page.getByRole('button', { name: 'Crear mi acceso y ver las 12 palabras' }).click();
    // Se espera por la lista real (el aviso puede tardar con Argon2id sobre BD remota)
    await expect(page.locator('.lista-palabras li')).toHaveCount(12, { timeout: 90_000 });

    // 3) Ya puede iniciar sesión con su clave
    await page.getByRole('button', { name: 'Ir al acceso' }).click();
    await page.locator('#p00').fill(P00_NUEVO);
    await page.locator('#clave').fill(CLAVE_NUEVA);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 40_000 });

    // 4) El estado de la cuenta cambió a Activo
    await page.goto('/tecnicos');
    const filaActiva = page.getByRole('row', { name: new RegExp(P00_NUEVO) });
    await expect(filaActiva.locator('.estado-cuenta')).toHaveText(/activo/i);
  });

  test('solo el Super Usuario puede regenerar las palabras de seguridad', async ({ page }) => {
    page.on('dialog', (dialogo) => dialogo.accept());

    // El ADMIN no ve la acción
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/tecnicos');
    await expect(page.getByRole('button', { name: 'Palabras' })).toHaveCount(0);
    await cerrarSesion(page);

    // El SUPER sí, y obtiene 12 palabras nuevas
    await iniciarSesion(page, USUARIOS.super);
    await page.goto('/tecnicos');
    const fila = page.getByRole('row', { name: /E2ETEC/ });
    await fila.getByRole('button', { name: 'Palabras' }).click();

    await expect(page.getByText(/Entregue estas/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.lista-palabras li')).toHaveCount(12, { timeout: 90_000 });
  });
});
