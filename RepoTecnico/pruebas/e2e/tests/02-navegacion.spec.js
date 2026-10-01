/** E2E-02 · Navegación, barra superior y menús (RF-33, D-57/D-58). */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

const SECCIONES = [
  { ruta: '/', titulo: 'Operación' },
  { ruta: '/casos', titulo: 'Casos' },
  { ruta: '/especiales', titulo: 'Especiales' },
  { ruta: '/agenda', titulo: 'Agenda' },
  { ruta: '/despacho', titulo: 'Despacho' },
];

const CONFIGURACION = [
  { ruta: '/central', titulo: 'Central' },
  { ruta: '/sectores', titulo: 'Sectores' },
  { ruta: '/tecnicos', titulo: 'Técnicos' },
  { ruta: '/flota', titulo: 'Flota' },
  { ruta: '/cuadrillas', titulo: 'Cuadrillas' },
  { ruta: '/catalogos', titulo: 'Catálogos' },
  { ruta: '/parametros', titulo: 'Parámetros' },
];

test.describe('Navegación', () => {
  test('las 5 secciones de la barra superior cargan', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    for (const seccion of SECCIONES) {
      await page.getByRole('link', { name: seccion.titulo.toUpperCase(), exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${seccion.ruta === '/' ? '/$' : seccion.ruta}$`));
      if (seccion.ruta === '/') {
        // OPERACIÓN muestra sus sub-secciones como pestañas (D-72):
        // WIDGET, INGESTA, MONITOREO y ALERTAS.
        for (const nombre of ['Widget', 'Ingesta', 'Monitoreo', 'Alertas']) {
          await expect(
            page.getByRole('tab', { name: nombre }),
          ).toBeVisible();
        }
        await expect(page.getByRole('heading', { name: 'Widget', level: 1 })).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: seccion.titulo, level: 1 })).toBeVisible();
      }
    }
  });

  test('el menú CONFIGURACIÓN agrupa las subsecciones (ADMIN)', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.getByRole('button', { name: 'Configuración' }).click();
    for (const item of CONFIGURACION) {
      await expect(page.getByRole('menuitem', { name: item.titulo })).toBeVisible();
    }
  });

  test('todas las subsecciones de CONFIGURACIÓN cargan (ADMIN)', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    for (const item of CONFIGURACION) {
      await page.goto(item.ruta);
      await expect(page.getByRole('heading', { name: item.titulo, level: 1 })).toBeVisible();
    }
  });

  test('TECNICO no ve CONFIGURACIÓN ni DESPACHO (D-72)', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await expect(page.getByRole('button', { name: 'Configuración' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'DESPACHO', exact: true })).toHaveCount(0);
    await expect(page.getByText('Modo solo lectura').first()).toBeVisible();
    // Requisito 5: la navegación directa tampoco está disponible para el Técnico.
    await page.goto('/despacho');
    await expect(page).toHaveURL(/\/(\?pestana=widget)?$/);
    await expect(page.getByRole('heading', { name: 'Despacho', level: 1 })).toHaveCount(0);
    await page.goto('/central');
    await expect(page.getByRole('heading', { name: 'Central', level: 1 })).toHaveCount(0);
  });

  test('SUPERVISOR sí ve CONFIGURACIÓN', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);
    await expect(page.getByRole('button', { name: 'Configuración' })).toBeVisible();
  });

  test('en móvil la barra muestra las secciones como iconos', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await iniciarSesion(page, USUARIOS.admin);
    const etiqueta = page.locator('.nav-etiqueta').first();
    await expect(etiqueta).toBeHidden();
    for (const seccion of SECCIONES) {
      await expect(page.getByRole('link', { name: seccion.titulo.toUpperCase(), exact: true })).toBeVisible();
    }
  });

  test('el buscador global y el alta de caso están en la barra', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await expect(page.getByPlaceholder('Buscar por incidente o número…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar caso' })).toBeVisible();
  });
});
