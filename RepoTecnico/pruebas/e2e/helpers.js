/**
 * Utilidades compartidas por las pruebas E2E.
 *
 * Requisitos del entorno (ver `run_e2e.sh`): `LD_LIBRARY_PATH` con las librerías
 * del navegador y `FONTCONFIG_FILE` apuntando a una configuración con fuentes.
 * Sin fuentes, Chromium no genera eventos de texto y los encabezados quedan con
 * tamaño cero (falso negativo de visibilidad).
 */

const USUARIOS = {
  admin: { p00: 'E2EADM', clave: 'E2e.Clave.2026', rol: 'ADMIN' },
  supervisor: { p00: 'E2ESUP', clave: 'E2e.Clave.2026', rol: 'SUPERVISOR' },
  tecnico: { p00: 'E2ETEC', clave: 'E2e.Clave.2026', rol: 'TECNICO' },
};

/** Escribe un valor en un input/textarea (`fill`) o elige una opción de un `select`. */
async function rellenar(locator, valor) {
  const etiqueta = await locator.evaluate((el) => el.tagName.toLowerCase());
  if (etiqueta === 'select') {
    await locator.selectOption(String(valor));
    return;
  }
  await locator.fill(String(valor));
}

/** Marca o desmarca una casilla. */
async function marcar(locator, activo = true) {
  if ((await locator.isChecked()) !== activo) await locator.click();
}

/** Rellena el formulario de login y espera a entrar al panel. */
async function iniciarSesion(page, usuario = USUARIOS.admin) {
  await page.goto('/login');
  await rellenar(page.getByLabel('P00'), usuario.p00);
  await rellenar(page.getByLabel('Clave'), usuario.clave);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 40_000 });
}

/** Cierra la sesión desde el menú del usuario. */
async function cerrarSesion(page) {
  await page.getByTitle('Menú del usuario').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.waitForURL(/\/login/);
}

/** Busca en el buscador global y devuelve el desplegable de resultados. */
async function buscarGlobal(page, termino) {
  await rellenar(page.getByPlaceholder('Buscar por incidente o número…'), termino);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  return page.getByRole('listbox', { name: 'Resultados' });
}

module.exports = { USUARIOS, rellenar, marcar, iniciarSesion, cerrarSesion, buscarGlobal };
