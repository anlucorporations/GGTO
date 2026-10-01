/**
 * E2E-19 · Ciclo D-71: aviso legal antes del acceso.
 *
 * Comprueba que el muro aparece en `/login`, que oculta el formulario hasta
 * aceptar, que los enlaces al documento (HTML), al PDF y a la Ayuda resuelven,
 * y que la aceptación persiste en el dispositivo.
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

test.describe('Aviso legal previo al acceso', () => {
  test('el muro bloquea el formulario hasta aceptar y sus enlaces resuelven', async ({ page }) => {
    await page.goto('/login');
    const muro = page.locator('.aviso-legal');
    await expect(muro).toBeVisible({ timeout: 30_000 });

    // El acceso está oculto mientras no se acepte
    await expect(page.locator('#p00')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Desbloquear con 3 palabras' })).toHaveCount(0);

    // Enlaces del aviso
    await expect(muro.getByRole('link', { name: 'Leer el aviso completo' })).toHaveAttribute(
      'href',
      '/manual/00-General/01-aviso-legal.html',
    );
    await expect(muro.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute(
      'href',
      '/manual/pdf/00-General/01-aviso-legal.pdf',
    );
    await expect(muro.getByRole('link', { name: 'Ir a la Ayuda' })).toHaveCount(1);

    // El botón permanece deshabilitado sin la casilla
    const aceptar = page.getByRole('button', { name: 'Aceptar e ingresar' });
    await expect(aceptar).toBeDisabled();
    await expect(page.getByText('Marca la casilla para habilitar el acceso')).toBeVisible();

    // Verificar que los documentos existen (no devuelven 404)
    for (const ruta of [
      '/manual/00-General/01-aviso-legal.html',
      '/manual/pdf/00-General/01-aviso-legal.pdf',
    ]) {
      const respuesta = await page.request.get(ruta);
      expect(respuesta.ok()).toBeTruthy();
    }

    // Aceptar habilita el acceso
    await page.locator('#aviso-acepto').check();
    await expect(aceptar).toBeEnabled();
    await aceptar.click();
    await expect(page.locator('#p00')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.aviso-legal')).toHaveCount(0);
  });

  test('la aceptación persiste y permite iniciar sesión', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#aviso-acepto').check();
    await page.getByRole('button', { name: 'Aceptar e ingresar' }).click();
    await expect(page.locator('#p00')).toBeVisible({ timeout: 20_000 });

    // Recargar: no vuelve a pedir el aviso
    await page.reload();
    await expect(page.locator('#p00')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.aviso-legal')).toHaveCount(0);

    // Y el acceso funciona con normalidad
    await page.locator('#p00').fill(USUARIOS.admin.p00);
    await page.locator('#clave').fill(USUARIOS.admin.clave);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90_000 });
  });

  test('la Ayuda publica el aviso como tema General', async ({ page }) => {
    // AYUDA es una ruta protegida: hay que iniciar sesión antes de abrirla.
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/ayuda');
    await expect(page.getByText('Aviso legal y de confidencialidad').first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
