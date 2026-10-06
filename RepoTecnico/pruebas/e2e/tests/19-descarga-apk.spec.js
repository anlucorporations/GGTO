/**
 * E2E-19 · Descarga de la APK y sugerencia de instalación en móvil (D-72).
 *
 * El APK se sirve desde `/apk/` (publicado con `scripts/publicar_apk.py`).
 * La sugerencia solo aparece en móvil y es descartable de forma persistente.
 */
const { test, expect, devices } = require('@playwright/test');
const { aceptarAviso } = require('../helpers');

/** Abre el acceso en un Android emulado (la UA real determina la sugerencia). */
async function abrirEnAndroid(page) {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.setExtraHTTPHeaders({ 'User-Agent': devices['Pixel 5'].userAgent });
  await page.addInitScript((ua) => {
    Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true });
  }, devices['Pixel 5'].userAgent);
  await page.goto('/login');
  await aceptarAviso(page);
  await page.goto('/login');
}

/** Abre el acceso con una UA de escritorio (sin sugerencia). */
async function abrirEnEscritorio(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ 'User-Agent': devices['Desktop Chrome'].userAgent });
  await page.addInitScript((ua) => {
    Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true });
  }, devices['Desktop Chrome'].userAgent);
  await page.goto('/login');
  await aceptarAviso(page);
  await page.goto('/login');
}

test.describe('Descarga de la APK', () => {
  test('el APK publicado se puede descargar y sus metadatos son válidos', async ({ page, request }) => {
    const meta = await request.get('/apk/apk.json');
    expect(meta.ok()).toBeTruthy();
    const datos = await meta.json();
    expect(datos.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(datos.bytes).toBeGreaterThan(1_000_000);
    expect(datos.sha256).toMatch(/^[0-9a-f]{64}$/);

    const apk = await request.get('/apk/ggto-tecnico.apk', { headers: { Range: 'bytes=0-3' } });
    expect(apk.status()).toBeLessThan(400);

    await abrirEnEscritorio(page);
    await expect(page.getByTestId('descargar-apk')).toBeVisible();
    await expect(page.getByText(/Aplicación móvil · GGTO Técnico/)).toBeVisible();
    await expect(page.getByText(new RegExp(`Versión ${datos.version.replace('+', '\\+')}`))).toBeVisible();
  });

  test('en escritorio no se sugiere la instalación', async ({ page }) => {
    await abrirEnEscritorio(page);
    await expect(page.getByTestId('sugerencia-apk')).toHaveCount(0);
  });

  test('en móvil sugiere instalar la APK y se puede omitir', async ({ page }) => {
    await abrirEnAndroid(page);

    const sugerencia = page.getByTestId('sugerencia-apk');
    await expect(sugerencia).toBeVisible();
    await expect(sugerencia).toContainText('Está usando un dispositivo móvil');
    await expect(sugerencia).toContainText('sin conexión');

    // El enlace apunta a la página de descarga y descarga el archivo.
    const enlace = page.getByTestId('instalar-apk');
    await expect(enlace).toHaveAttribute('href', '/apk/');
    await expect(enlace).toHaveAttribute('download', '');

    // Se puede omitir y el descarte se recuerda.
    await page.getByTestId('cerrar-sugerencia').click();
    await expect(page.getByTestId('sugerencia-apk')).toHaveCount(0);
    await page.goto('/login');
    await expect(page.getByTestId('sugerencia-apk')).toHaveCount(0);
    // La descarga manual sigue disponible tras omitir.
    await expect(page.getByTestId('descargar-apk')).toBeVisible();
  });

  test('la página de descarga explica la instalación', async ({ page }) => {
    await page.goto('/apk/');
    await expect(page.getByRole('heading', { name: 'GGTO Técnico — APK' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Descargar la APK' })).toBeVisible();
    await expect(page.getByText(/Instalar aplicaciones desconocidas/)).toBeVisible();
    await expect(page.getByText(/SHA-256/)).toBeVisible();
  });
});
