/**
 * E2E-25 · Ciclo D-94 (informes) — MONITOREO desde el identificador de pago.
 *
 * Verifica contra la aplicación real que la pestaña MONITOREO muestra la
 * **zona del identificador de pago**: cuántos hay, los reincidentes de la ventana
 * (RF-54), los casos con y sin 70* y el estado de la regla
 * REPARACIÓN ⇐ 70* + avería real (D-90/RF-55). El TÉCNICO no ve esta zona.
 *
 * Las fixtures se crean por API: dos reportes del mismo identificador lo vuelven
 * reincidente sin depender de los datos sembrados ni del orden de los especímenes.
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, iniciarSesion } = require('../helpers');

const IDENTIFICADOR = '7014000850';
const ZONA = '#zona-identificador-pago';
const TABLA = '#tabla-identificadores-pago';

/** Inicia sesión por API y devuelve la cabecera de autorización. */
async function tokenDe(request, usuario) {
  const r = await request.post('/api/v1/auth/login', {
    data: { p00: usuario.p00, clave: usuario.clave },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  const { access_token: token } = await r.json();
  return { Authorization: `Bearer ${token}` };
}

async function crearCaso(request, headers, cuerpo) {
  const r = await request.post('/api/v1/casos', { headers, data: cuerpo });
  expect([201, 409]).toContain(r.status());
}

test.describe('MONITOREO por identificador de pago (D-94)', () => {
  test.beforeAll(async ({ request }) => {
    const headers = await tokenDe(request, USUARIOS.admin);
    // Dos reportes del mismo 70*: el identificador pasa a ser reincidente.
    // RN-AL-01: el alta manual exige contacto, dirección, 70* y tipo de reporte.
    await crearCaso(request, headers, {
      id_averia: 'TSTD94-M1',
      nombre_cliente: 'CLIENTE MONITOREO D94',
      id_pago: IDENTIFICADOR,
      contacto_cliente: '04141112233',
      direccion: 'CALLE E2E D94, CASA 1',
      tipo_reporte: 'REPARACION',
      tipo_problema: 'SIN_SERVICIO',
    });
    await crearCaso(request, headers, {
      id_averia: 'TSTD94-M2',
      nombre_cliente: 'CLIENTE MONITOREO D94',
      id_pago: IDENTIFICADOR,
      contacto_cliente: '04141112233',
      direccion: 'CALLE E2E D94, CASA 2',
      tipo_reporte: 'REPARACION',
      tipo_problema: 'SIN_SERVICIO',
    });
  });

  test('la zona del identificador muestra reincidencia y la regla', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/monitoreo');

    const zona = page.locator(ZONA);
    await expect(zona).toBeVisible({ timeout: 30_000 });
    await expect(zona.getByRole('heading', { name: /identificador de pago/i })).toBeVisible();

    // Tarjetas de la zona (RF-54/RF-55).
    await expect(zona.getByText('Identificadores con casos')).toBeVisible();
    await expect(zona.getByText(/^Reincidentes \(/)).toBeVisible();
    await expect(zona.getByText('Casos sin 70*')).toBeVisible();

    // El identificador con dos reportes aparece como reincidente.
    const fila = page.locator(`${TABLA} tbody tr`, { hasText: IDENTIFICADOR });
    await expect(fila).toBeVisible({ timeout: 30_000 });
    await expect(fila).toContainText('Sí');
    await expect(fila.locator('td').nth(1)).toHaveText('2');

    // La regla REPARACIÓN ⇐ 70* + avería real también se informa.
    await expect(zona.getByText(/Regla REPARACIÓN/)).toBeVisible();
    await expect(zona.getByText('Reparaciones válidas')).toBeVisible();
  });

  test('el TÉCNICO no ve la zona del identificador', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    await page.goto('/monitoreo');
    await expect(page.getByRole('heading', { name: 'Monitoreo' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(ZONA)).toHaveCount(0);
  });
});
