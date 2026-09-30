/**
 * E2E-18 · Ciclo D-70: ficha del caso en pestañas.
 *
 * Verifica el reparto por naturaleza de los datos, la rejilla de hasta 3 campos
 * por línea en PC, el icono de edición del título (edición limitada a Sector,
 * Fecha de cita e Información con 200 caracteres) y la pestaña RESOLUCIÓN con
 * CERRAR / CITA / ENRRUTAR, incluido el cierre con modo IVR/COS/SACAS y el
 * HISTÓRICO de casos relacionados por teléfono.
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('../helpers');


/** Crea un caso desde la interfaz y devuelve su `id_averia` generado por el sistema. */
async function crearCase(page, { cliente, telefono, direccion }) {
  await page.goto('/casos');
  await page.getByRole('button', { name: 'Agregar caso' }).first().click();
  const alta = page.getByRole('dialog', { name: /Agregar caso/ });
  await expect(alta).toBeVisible({ timeout: 30_000 });
  await rellenar(alta.getByLabel('Nombre del cliente'), cliente);
  if (telefono) await rellenar(alta.getByLabel('Teléfono'), telefono);
  await rellenar(alta.getByLabel('Dirección'), direccion);
  await rellenar(alta.getByLabel('Problema reportado'), 'SIN SERVICIO GPON');
  await alta.getByRole('button', { name: 'Guardar caso' }).click();
  await expect(page.locator('.aviso-ok')).toBeVisible({ timeout: 60_000 });
  // Se busca por el nombre de cliente (único por corrida) y se lee el id generado
  await page.locator('#filtro-q').fill(cliente);
  await page.locator('#filtro-q').press('Enter');
  const fila = page.locator('tbody tr', { hasText: 'REF-' }).first();
  await fila.waitFor({ state: 'visible', timeout: 60_000 });
  const idAveria = (await fila.locator('td').first().innerText()).trim();
  if (!/^REF-/.test(idAveria)) throw new Error(`No se leyó el id de avería creado: "${idAveria}"`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  return idAveria;
}

/** Abre la ficha del caso indicado buscándolo por su id de avería. */
async function abrirFichaPorId(page, idAveria) {
  await page.goto('/casos');
  await page.locator('#filtro-q').fill(idAveria);
  await page.locator('#filtro-q').press('Enter');
  const fila = page.locator('tbody tr', { hasText: idAveria }).first();
  await fila.waitFor({ state: 'visible', timeout: 60_000 });
  await fila.getByRole('button', { name: 'Ver ficha' }).click();
  const ficha = page.getByRole('dialog');
  await expect(ficha).toBeVisible({ timeout: 30_000 });
  return ficha;
}

async function abrirPrimeraFicha(page) {
  await page.goto('/casos');
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('tbody tr').first().getByRole('button', { name: 'Ver ficha' }).click();
  const ficha = page.getByRole('dialog');
  await expect(ficha).toBeVisible({ timeout: 30_000 });
  return ficha;
}

test.describe('Ficha del caso en pestañas', () => {
  test('los datos se reparten en pestañas y caben 3 por línea en PC', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);
    const ficha = await abrirPrimeraFicha(page);

    await expect(ficha.getByRole('tab', { name: 'Resumen' })).toBeVisible();
    for (const nombre of ['Contacto', 'Datos técnicos', 'Clasificación', 'Textos',
                          'Resolución', 'Histórico', 'Gestión']) {
      await expect(ficha.getByRole('tab', { name: nombre })).toBeVisible();
    }

    // Rejilla de 3 columnas en PC
    const columnas = await ficha
      .locator('.datos-grid')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columnas).toBe(3);

    // Cada pestaña muestra datos de su naturaleza
    await ficha.getByRole('tab', { name: 'Contacto' }).click();
    await expect(ficha.getByText('Cliente').first()).toBeVisible();
    await expect(ficha.getByText('Teléfono').first()).toBeVisible();
    await ficha.getByRole('tab', { name: 'Datos técnicos' }).click();
    await expect(ficha.getByText('OLT').first()).toBeVisible();
  });

  test('la edición la activa el icono del título y solo cambia sector, cita e información', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);
    const ficha = await abrirPrimeraFicha(page);

    await expect(
      ficha.getByRole('button', { name: 'Activar la edición de la ficha' }),
    ).toBeVisible();
    await ficha.getByRole('button', { name: 'Activar la edición de la ficha' }).click();

    await expect(ficha.locator('#ficha-sector')).toBeVisible({ timeout: 20_000 });
    await expect(ficha.locator('#ficha-fecha-cita')).toBeVisible();
    await expect(ficha.locator('#ficha-informacion')).toHaveAttribute('maxlength', '200');
    // No se exponen el resto de los campos editables
    await expect(ficha.locator('#edit-cliente')).toHaveCount(0);

    await rellenar(ficha.locator('#ficha-informacion'), 'Gestionado desde la ficha en pestanas (D-70)');
    await ficha.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('Cambios guardados', { timeout: 40_000 });

    await ficha.getByRole('tab', { name: 'Textos' }).click();
    await expect(ficha.getByText('Gestionado desde la ficha en pestanas (D-70)').first()).toBeVisible();
  });

  test('RESOLUCIÓN ofrece CERRAR, CITA y ENRRUTAR con sus formularios', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);
    const ficha = await abrirPrimeraFicha(page);
    await ficha.getByRole('tab', { name: 'Resolución' }).click();

    const selector = ficha.locator('#resolucion-accion');
    await expect(selector).toBeVisible();
    await expect(ficha.locator('#resolucion-accion option')).toHaveText([
      '— Seleccione una acción —', 'CERRAR', 'CITA', 'ENRRUTAR',
    ]);

    await selector.selectOption('CERRAR');
    await expect(ficha.locator('#cierre-descripcion')).toBeVisible();
    await expect(ficha.locator('#cierre-evidencias')).toBeVisible();
    await expect(ficha.locator('#cierre-modo option')).toHaveText(['Con IVR', 'Con COS', 'Con SACAS']);

    await selector.selectOption('CITA');
    await expect(ficha.locator('#cita-fecha')).toBeVisible();
    await expect(ficha.locator('#cita-tipo')).toBeVisible();

    await selector.selectOption('ENRRUTAR');
    await expect(ficha.locator('#enrutado-destino')).toBeVisible();
    await expect(ficha.locator('#enrutado-motivo')).toBeVisible();
  });

  test('cerrar un caso registra el modo, las evidencias y el estado CERRADO', async ({ page }) => {
    const sufijo = String(Date.now()).slice(-6);
    await iniciarSesion(page, USUARIOS.supervisor);

    const idAveria = await crearCase(page, {
      cliente: `CIERRE UI ${sufijo}`,
      telefono: `+58212${sufijo}`,
      direccion: `CALLE TST UI ${sufijo}`,
    });

    const ficha = await abrirFichaPorId(page, idAveria);
    await ficha.getByRole('tab', { name: 'Resolución' }).click();
    await ficha.locator('#resolucion-accion').selectOption('CERRAR');
    await ficha.locator('#cierre-modo').selectOption('SACAS');
    await rellenar(ficha.locator('#cierre-descripcion'), 'Se ejecuto la reparacion y se verifico la navegacion');
    await rellenar(ficha.locator('#cierre-evidencias'), 'EVD-UI-01, EVD-UI-02');
    await ficha.getByRole('button', { name: 'Cerrar caso con SACAS' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('Caso cerrado con SACAS', { timeout: 60_000 });

    // La bitácora reflejó el cierre
    await expect(ficha.getByRole('heading', { name: /Historial de estados/ })).toBeVisible();
    await expect(ficha.getByRole('cell', { name: 'CERRADO' }).first()).toBeVisible({ timeout: 30_000 });
  });


  test('HISTÓRICO muestra los antecedentes del mismo teléfono', async ({ page }) => {
    const sufijo = String(Date.now()).slice(-6);
    const telefono = `+58212${sufijo}`;
    await iniciarSesion(page, USUARIOS.admin);

    // Dos casos creados desde la interfaz con el mismo teléfono
    const primero = await crearCase(page, {
      cliente: `ANTECEDENTES A ${sufijo}`, telefono, direccion: 'CALLE TST HISTORICO',
    });
    const segundo = await crearCase(page, {
      cliente: `ANTECEDENTES B ${sufijo}`, telefono, direccion: 'CALLE TST HISTORICO',
    });

    // El primero se cierra con COS
    let ficha = await abrirFichaPorId(page, primero);
    await ficha.getByRole('tab', { name: 'Resolución' }).click();
    await ficha.locator('#resolucion-accion').selectOption('CERRAR');
    await ficha.locator('#cierre-modo').selectOption('COS');
    await rellenar(ficha.locator('#cierre-descripcion'), 'Acometida reconstruida y probada con exito');
    await ficha.getByRole('button', { name: 'Cerrar caso con COS' }).click();
    await expect(page.locator('.aviso-ok')).toContainText('Caso cerrado con COS', { timeout: 60_000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // El segundo debe ver al primero como antecedente, con su justificación
    ficha = await abrirFichaPorId(page, segundo);
    await ficha.getByRole('tab', { name: 'Histórico' }).click();
    await expect(ficha.getByText('Casos anteriores asociados al teléfono')).toBeVisible({ timeout: 30_000 });
    await expect(ficha.getByRole('columnheader', { name: 'ID de avería anterior' })).toBeVisible();
    await expect(ficha.getByRole('cell', { name: primero })).toBeVisible({ timeout: 30_000 });
    await expect(ficha.getByText('Total: 1 antecedente')).toBeVisible();
    await expect(ficha.getByText('Cierre con COS:', { exact: false })).toBeVisible();
  });


  test('el TECNICO no ve el icono de edición ni la resolución', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.tecnico);
    const ficha = await abrirPrimeraFicha(page);
    await expect(
      ficha.getByRole('button', { name: 'Activar la edición de la ficha' }),
    ).toHaveCount(0);
    await ficha.getByRole('tab', { name: 'Resolución' }).click();
    await expect(ficha.getByText(/Solo el Supervisor, el Administrador o el Super Usuario/)).toBeVisible();
    await expect(ficha.locator('#resolucion-accion')).toHaveCount(0);
  });
});
