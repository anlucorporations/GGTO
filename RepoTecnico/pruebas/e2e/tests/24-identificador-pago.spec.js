/**
 * E2E-24 · Ciclo D-92 (web) — el identificador de pago (70*) como eje.
 *
 * Verifica, contra la aplicación real:
 *  - los rótulos «Identificador de pago (70*)» y «Número de contacto» (RF-53);
 *  - el histórico por **identificador de pago** con el indicador de reincidencia
 *    (RF-48/RF-54, CU-D89-03), y que un número de contacto no agrupa antecedentes;
 *  - la búsqueda con **grupos separados** por el dato que coincidió (CU-D89-04);
 *  - el chip «Reclasificar a REFERIDO» de la marca derivada (RF-50/D-90), con su
 *    motivo, y su ausencia en una reparación válida.
 *
 * Las fixtures se crean por API (dos reportes del mismo identificador) y el chip de
 * reclasificación se comprueba interceptando la respuesta de la ficha, porque en un
 * esquema nuevo la base **no permite** crear una REPARACIÓN marcada (D-89).
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion, buscarGlobal } = require('../helpers');

const IDENTIFICADOR = '7014000848';
const CONTACTO = '4223109000';
const ID_A1 = 'TSTIP24-A1';
const ID_A2 = 'TSTIP24-A2';

/** Inicia sesión por API y devuelve la cabecera de autorización. */
async function tokenAdmin(request) {
  const r = await request.post('/api/v1/auth/login', {
    data: { p00: USUARIOS.admin.p00, clave: USUARIOS.admin.clave },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  const { access_token: token } = await r.json();
  return { Authorization: `Bearer ${token}` };
}

/** Crea (o reutiliza) un caso de prueba por API. */
async function crearCaso(request, headers, cuerpo) {
  const r = await request.post('/api/v1/casos', { headers, data: cuerpo });
  // 409 = ya existía de una corrida anterior: se acepta y se sigue.
  expect([201, 409]).toContain(r.status());
  return r.ok() ? r.json() : null;
}

/**
 * Abre la **ficha completa** (pestañas Resumen · Contacto · … · Histórico): se
 * localiza el caso con el filtro de CASOS y se pulsa su renglón. El buscador
 * global abre la ficha rápida, que no tiene pestaña Histórico.
 */
async function abrirFichaCompleta(page, idAveria) {
  await page.goto('/casos');
  await page.locator('#filtro-q').fill(idAveria);
  await page.locator('#filtro-q').press('Enter');
  const fila = page.locator('tbody tr', { hasText: idAveria }).first();
  await fila.waitFor({ state: 'visible', timeout: 60_000 });
  await fila.click();
  const ficha = page.getByRole('dialog');
  await expect(ficha).toBeVisible({ timeout: 30_000 });
  return ficha;
}

test.describe('Identificador de pago (D-92)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    // El buscador global es único fuera de OPERACIÓN (el WIDGET tiene el suyo).
    await page.goto('/casos');
  });

  test.beforeAll(async ({ request }) => {
    const headers = await tokenAdmin(request);
    // Dos reportes del MISMO identificador y un contacto en el primero.
    // RN-AL-01: el alta manual exige los datos de contacto, la dirección, el 70*
    // y el tipo de reporte (con id de avería y tipo de problema si es REPARACIÓN).
    await crearCaso(request, headers, {
      id_averia: ID_A1,
      nombre_cliente: 'CLIENTE IP A1',
      id_pago: IDENTIFICADOR,
      contacto_cliente: `0${CONTACTO}`,
      direccion: 'CALLE E2E IP, CASA 1',
      tipo_reporte: 'REPARACION',
      tipo_problema: 'SIN_SERVICIO',
    });
    await crearCaso(request, headers, {
      id_averia: ID_A2,
      nombre_cliente: 'CLIENTE IP A2',
      id_pago: `701-400.0848`, // mismo número con separadores
      direccion: 'CALLE E2E IP, CASA 2',
      contacto_cliente: `0${CONTACTO}`,
      tipo_reporte: 'REPARACION',
      tipo_problema: 'SIN_SERVICIO',
    });
  });

  test('la ficha rotula el identificador de pago y el número de contacto', async ({ page }) => {
    const ficha = await abrirFichaCompleta(page, ID_A1);
    await ficha.getByRole('tab', { name: 'Contacto' }).click();
    await expect(ficha.locator('#ficha-identificador-pago')).toHaveText(IDENTIFICADOR);
    await expect(ficha.locator('#ficha-numero-contacto')).toHaveText(CONTACTO);
    await expect(ficha.getByText('Identificador de pago (70*)')).toBeVisible();
    await expect(ficha.getByText('Número de contacto')).toBeVisible();
  });

  test('el histórico se arma por identificador y marca la reincidencia', async ({ page }) => {
    const ficha = await abrirFichaCompleta(page, ID_A2);
    await ficha.getByRole('tab', { name: 'Histórico' }).click();
    await expect(ficha.locator('#historico-identificador')).toHaveText(IDENTIFICADOR);
    await expect(ficha.locator('#historico-reincidencia')).toContainText('2');
    await expect(ficha.getByRole('cell', { name: ID_A1 })).toBeVisible({ timeout: 30_000 });
  });

  test('el alta manual exige el identificador de pago (RN-AL-01)', async ({ page }) => {
    // Un caso sin 70* ya no se puede dar de alta: la sección CASOS de la web y la
    // API comparten la regla de los datos obligatorios.
    const headers = await tokenAdmin(page.request);
    const r = await page.request.post('/api/v1/casos', {
      headers,
      data: {
        id_averia: 'TSTIP24-C1',
        nombre_cliente: 'CLIENTE IP C1',
        telefono: '04142223344',
        direccion: 'CALLE E2E IP, CASA 3',
        tipo_reporte: 'CONSTRUCCION',
      },
    });
    expect(r.status()).toBe(422);
  });

  test('la búsqueda separa identificador de pago y número de contacto', async ({ page }) => {

    // Por identificador: grupo propio con los dos reportes del 70*.
    let resultados = await buscarGlobal(page, IDENTIFICADOR);
    const grupoIp = resultados.locator('[data-grupo="identificador"]');
    await expect(grupoIp).toBeVisible();
    await expect(grupoIp.getByText('Identificador de pago (70*)')).toBeVisible();
    await expect(grupoIp.getByRole('option')).toHaveCount(2);
    await expect(resultados.locator('[data-grupo="contacto"]')).toHaveCount(0);

    // Por número de contacto: su propio grupo y sin filas del identificador.
    await rellenar(page.getByPlaceholder('Buscar por incidente o número…'), '');
    resultados = await buscarGlobal(page, CONTACTO);
    const grupoContacto = resultados.locator('[data-grupo="contacto"]');
    await expect(grupoContacto).toBeVisible();
    await expect(grupoContacto.getByText('Número de contacto')).toBeVisible();
    await expect(grupoContacto.getByRole('option', { name: new RegExp(ID_A1) })).toBeVisible();
    await expect(resultados.locator('[data-grupo="identificador"]')).toHaveCount(0);
  });

  test('la ficha muestra el chip de reclasificación con su motivo', async ({ page }) => {

    // Se intercepta la ficha para simular una REPARACIÓN marcada (estado que la
    // base ya no permite crear: D-89 la convierte en REFERIDO al guardar).
    await page.route(/\/api\/v1\/casos\/\d+$/, async (route) => {
      const respuesta = await route.fetch();
      const json = await respuesta.json();
      json.marcado_reclasificar = true;
      json.motivo_marca = 'SIN_IDENTIFICADOR_PAGO';
      await route.fulfill({ response: respuesta, json });
    });

    const ficha = await abrirFichaCompleta(page, ID_A1);
    const chip = ficha.locator('#ficha-marca-reclasificar');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('Reclasificar a REFERIDO');
    await expect(chip).toContainText('falta el identificador de pago (70*)');
  });

  test('una reparación válida no muestra el chip', async ({ page }) => {
    const headers = await tokenAdmin(page.request);
    await crearCaso(page.request, headers, {
      id_averia: 'TSTIP24-R1',
      nombre_cliente: 'CLIENTE IP R1',
      tipo_reporte: 'REPARACION',
      tipo_problema: 'SIN_SERVICIO',
      id_pago: '7014000849',
      contacto_cliente: `0${CONTACTO}`,
      direccion: 'CALLE E2E IP, CASA 4',
    });

    const ficha = await abrirFichaCompleta(page, 'TSTIP24-R1');
    await expect(ficha.locator('#ficha-marca-reclasificar')).toHaveCount(0);
  });
});
