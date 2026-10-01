/** E2E-12 · Sección AYUDA: manual navegable y descarga de PDF (RF-33, D-63). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

test.describe('Ayuda', () => {
  test('el enlace AYUDA abre el manual navegable', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.getByRole('link', { name: 'AYUDA', exact: true }).click();
    await expect(page).toHaveURL(/\/ayuda$/);
    await expect(page.getByRole('heading', { name: 'Ayuda', level: 1 })).toBeVisible();
    await expect(page.getByText(/temas .* secciones .* sub-secciones disponibles/)).toBeVisible();
  });

  test('el índice agrupa temas, secciones y sub-secciones', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/ayuda');
    // 8 temas tras añadir el aviso legal (D-71)
    await expect(page.locator('.ayuda-tema')).toHaveCount(8);
    // 23 secciones: se publicó el aviso legal como tema General (D-71)
    await expect(page.locator('.ayuda-seccion')).toHaveCount(23);
    expect(await page.locator('.ayuda-subsecciones a').count()).toBeGreaterThan(100);
    await expect(page.getByRole('link', { name: 'Abrir manual HTML' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Descargar PDF' }).first()).toBeVisible();
  });

  test('el buscador filtra las secciones', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/ayuda');
    await page.getByLabel('Buscar en los manuales').fill('despacho');
    await expect(page.getByText(/coinciden con «despacho»/)).toBeVisible();
    const visibles = await page.locator('.ayuda-seccion').count();
    expect(visibles).toBeGreaterThan(0);
    expect(visibles).toBeLessThan(22);
  });

  test('el manual HTML y el PDF se sirven sin error', async ({ page, request }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/ayuda');
    const hrefHtml = await page.getByRole('link', { name: 'Abrir manual HTML' }).first().getAttribute('href');
    const hrefPdf = await page.getByRole('link', { name: 'Descargar PDF' }).first().getAttribute('href');
    expect((await request.get(hrefHtml)).status()).toBe(200);
    const pdf = await request.get(hrefPdf);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('pdf');
  });

  test('TECNICO también ve AYUDA', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await expect(page.getByRole('link', { name: 'AYUDA', exact: true })).toBeVisible();
    await page.goto('/ayuda');
    await expect(page.getByRole('heading', { name: 'Ayuda', level: 1 })).toBeVisible();
  });
});
