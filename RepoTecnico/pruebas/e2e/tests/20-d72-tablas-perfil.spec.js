/**
 * E2E-20 · Ciclo D-72: tablas con iconos y sin columna Acción (CASOS y
 * ESPECIALES), apertura de la ficha al seleccionar el renglón y la sección
 * Perfil y Cuenta del menú de usuario.
 */
const { test, expect } = require('@playwright/test');
const { USUARIOS, rellenar, iniciarSesion } = require('../helpers');

test.describe('CASOS (D-72)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/casos');
    await expect(page.getByRole('heading', { name: 'Casos', level: 1 })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
  });

  test('la tabla muestra Dirección y Nombre y ya no tiene la columna Acción', async ({ page }) => {
    for (const col of ['ID avería', 'Tipo', 'Clase', 'Sector', 'Dirección', 'Nombre', 'Estado']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
    await expect(page.getByRole('columnheader', { name: 'Acción' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ver ficha' })).toHaveCount(0);
    // Datos reales en las columnas nuevas.
    await expect(page.getByRole('cell', { name: /CALLE E2E/ }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Cliente E2E 5' }).first()).toBeVisible();
  });

  test('Tipo y Clase se muestran como iconos con etiqueta', async ({ page }) => {
    const fila = page.getByRole('row', { name: /E2E-0001/ });
    await expect(fila.locator('.celda-icono svg').first()).toBeVisible();
    await expect(fila.getByText('Avería').first()).toBeVisible();
    await expect(fila.getByText('Residencial').first()).toBeVisible();
  });

  test('al seleccionar cualquier parte del renglón se abre la ficha del caso', async ({ page }) => {
    await page.getByRole('row', { name: /E2E-0002/ }).locator('td').nth(4).click();
    const ficha = page.getByRole('dialog', { name: /Ficha del caso/ });
    await expect(ficha).toBeVisible({ timeout: 30_000 });
    await expect(ficha.getByRole('heading', { name: /E2E-0002/ })).toBeVisible();
  });

  test('el filtro por texto busca en todos los renglones', async ({ page }) => {
    // «CONSTRUCCION» solo aparece en columnas visibles de la tabla (Tipo), no en
    // la avería: demuestra la búsqueda integral. (Otros casos CONSTRUCCION
    // pueden existir por altas de otras specs: se comprueba inclusión/exclusión.)
    await page.locator('#filtro-q').fill('CONSTRUCCION');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.getByRole('cell', { name: 'E2E-0008', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'E2E-0001', exact: true })).toHaveCount(0);
    // Búsqueda por estado (columna visible, no texto libre de la avería).
    await page.locator('#filtro-q').fill('CITADO');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.getByRole('cell', { name: 'E2E-0006', exact: true })).toBeVisible();
  });

  test('los filtros incluyen Sector y Cuadrilla', async ({ page }) => {
    await expect(page.locator('#filtro-sector')).toBeVisible();
    await expect(page.locator('#filtro-cuadrilla')).toBeVisible();
    // Cuadrilla 0 (supervisor) sigue disponible como opción del filtro.
    await expect(page.locator('#filtro-cuadrilla option[value="gestion"]')).toBeAttached();
  });
});

test.describe('ESPECIALES (D-72)', () => {
  test('crear un especial y abrirlo desde el renglón', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.admin);
    await page.getByRole('button', { name: 'Agregar caso' }).click();
    const modal = page.getByRole('dialog', { name: 'Agregar caso' });
    await rellenar(modal.getByLabel('Nombre del cliente'), 'Gobernación E2E D72');
    await rellenar(modal.getByLabel('Dirección'), 'AV E2E, GOBERNACIÓN 1');
    await rellenar(modal.getByLabel('Problema reportado'), 'Enlace dedicado solicitado');
    await page.getByLabel('Es un caso especial').check();
    await rellenar(modal.getByLabel('Clasificación'), 'GOBIERNO');
    await rellenar(modal.getByLabel('Tipo de actividad'), 'REPARACION');
    await rellenar(modal.getByLabel('Prioridad'), 'MEDIA');
    await rellenar(modal.getByLabel('Solicitante — unidad'), 'UNIDAD D72');
    await rellenar(modal.getByLabel('Solicitante — nombre'), 'Solicitante D72');
    await rellenar(modal.getByLabel('Solicitante — contacto'), '04241231231');
    await modal.getByRole('button', { name: 'Guardar caso' }).click();
    await expect(page.getByText(/REF-2324X-/).first()).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto('/especiales');
    const fila = page.getByRole('row', { name: /Gobernación E2E D72/ }).first();
    await expect(fila).toBeVisible({ timeout: 30_000 });
    // Iconos de Prioridad y Actividad en la tabla.
    await expect(fila.locator('.celda-icono svg').first()).toBeVisible();
    // El renglón se abre con un clic en cualquier parte.
    await fila.click();
    await expect(page.getByRole('dialog', { name: /Ficha del caso/ })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('filtros y columnas nuevas', async ({ page }) => {
    // Se ejecuta después de crear el especial anterior: la tabla tiene filas.
    await iniciarSesion(page, USUARIOS.admin);
    await page.goto('/especiales');
    await expect(page.getByRole('heading', { name: 'Especiales', level: 1 })).toBeVisible();

    for (const id of ['filtro-q', 'filtro-clasificacion', 'filtro-prioridad',
                      'filtro-actividad', 'filtro-solicitante']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.getByLabel('Clasificación', { exact: true })).toHaveCount(0);

    for (const col of ['Tipo', 'Actividad', 'Prioridad', 'Dirección', 'Nombre']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
    await expect(page.getByRole('columnheader', { name: 'Acción' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Ver\/Editar|Ver caso/ })).toHaveCount(0);
  });
});

test.describe('Perfil y Cuenta (D-72)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.supervisor);
  });

  async function abrirPerfil(page) {
    await page.getByTitle('Menú del usuario').click();
    await page.getByRole('menuitem', { name: /Perfil y Cuenta/ }).click();
    await expect(page).toHaveURL(/\/perfil/);
    await expect(page.getByRole('heading', { name: /Perfil y Cuenta/ })).toBeVisible();
  }

  test('el menú de usuario lleva a Perfil y Cuenta', async ({ page }) => {
    await abrirPerfil(page);
    await expect(page.getByLabel('Correo')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cuenta', exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Palabras de seguridad/ }),
    ).toBeVisible();
  });

  test('mi-seguridad muestra el estado sin los valores', async ({ page }) => {
    await abrirPerfil(page);
    const ficha = page.locator('.panel-bloque', { hasText: 'Palabras de seguridad' });
    // Los usuarios sembrados no activaron palabras: se muestra el estado, nunca valores.
    await expect(ficha.getByText('Sin activar')).toBeVisible();
    await expect(ficha.getByText('no se pueden consultar')).toBeVisible();
    // No hay botón de regenerar para un SUPERVISOR (solo SUPER).
    await expect(ficha.getByRole('button', { name: /Regenerar/ })).toHaveCount(0);
  });

  test('el cambio de clave rechaza datos inválidos', async ({ page }) => {
    await abrirPerfil(page);
    const ficha = page.locator('.panel-bloque', { hasText: 'Cambiar clave' });
    await ficha.getByLabel('Clave actual').fill('clave-incorrecta');
    await ficha.getByLabel('Clave nueva (mínimo 8)').fill('nueva123456');
    await ficha.getByLabel('Confirmar clave nueva').fill('nueva123456');
    await ficha.getByRole('button', { name: 'Cambiar clave' }).click();
    await expect(page.getByText('La clave actual no es correcta')).toBeVisible({
      timeout: 30_000,
    });
  });

  test('cambiar la clave y restaurarla', async ({ page }) => {
    await abrirPerfil(page);
    const ficha = page.locator('.panel-bloque', { hasText: 'Cambiar clave' });
    await ficha.getByLabel('Clave actual').fill(USUARIOS.supervisor.clave);
    await ficha.getByLabel('Clave nueva (mínimo 8)').fill('cambiada12345');
    await ficha.getByLabel('Confirmar clave nueva').fill('cambiada12345');
    await ficha.getByRole('button', { name: 'Cambiar clave' }).click();
    await expect(page.getByText('Clave actualizada')).toBeVisible({ timeout: 30_000 });

    // Se restaura para no afectar al resto de la suite.
    await ficha.getByLabel('Clave actual').fill('cambiada12345');
    await ficha.getByLabel('Clave nueva (mínimo 8)').fill(USUARIOS.supervisor.clave);
    await ficha.getByLabel('Confirmar clave nueva').fill(USUARIOS.supervisor.clave);
    await ficha.getByRole('button', { name: 'Cambiar clave' }).click();
    await expect(page.getByText('Clave actualizada').last()).toBeVisible({ timeout: 30_000 });
  });
});
