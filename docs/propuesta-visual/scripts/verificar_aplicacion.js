/**
 * GGTO · CANTV — Verificación visual de la propuesta aplicada.
 *
 * Levanta un servidor estático sobre `app/web/dist` (el paquete ya compilado),
 * responde los endpoints de la API con datos de muestra y captura con
 * Playwright las pantallas reales de la aplicación:
 *
 *   aplicado-login-escritorio.png   · /login a 1440 px
 *   aplicado-login-movil.png        · /login a 390 px
 *   aplicado-casos-escritorio.png   · /casos a 1440 px (sesión simulada)
 *   aplicado-casos-movil.png        · /casos a 390 px
 *
 * Uso (desde la raíz del repositorio):
 *   node docs/propuesta-visual/scripts/verificar_aplicacion.js
 *
 * No modifica la aplicación: solo la sirve y la fotografía.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const E2E = path.resolve(__dirname, '../../../RepoTecnico/pruebas/e2e/node_modules');
if (!module.paths.includes(E2E)) module.paths.push(E2E);
const { chromium } = require(path.join(E2E, 'playwright'));

const RAIZ = path.resolve(__dirname, '../../..');
const DIST = path.join(RAIZ, 'app', 'web', 'dist');
const SALIDA = path.join(RAIZ, 'docs', 'propuesta-visual', 'capturas');
const PUERTO = 4179;

const USUARIO = {
  p00: 'TSTCDPB',
  correo: 'ana.rodriguez@cantv.com.ve',
  rol: 'SUPERVISOR',
  id_rol: 3,
  id_central: 4,
  nombre: 'Ana',
  apellido: 'Rodríguez',
};

const CASO = (i, extra = {}) => ({
  id_caso: i,
  id_averia: `2026101${100 + i}`,
  id_central: 4,
  origen: 'CSV',
  tipo_caso: 'AVERIA',
  categoria: 'RESIDENCIAL',
  estado_actual: 'EN_DESPACHO',
  id_sector: 12,
  sector_nombre: 'Los Chaguaramos',
  id_causa: null,
  id_lote_ingesta: 88,
  en_gestion_supervisor: false,
  es_falla_masiva: false,
  pendiente: true,
  asignado: true,
  citado: false,
  gestion: false,
  id_cuadrilla: 3,
  cuadrilla_codigo: 'C-03',
  cuadrilla_nombre: 'Cuadrilla 3',
  region: 'Capital',
  estado_geografico: 'Distrito Capital',
  municipio: 'Libertador',
  parroquia: 'San Pedro',
  area: 'Área 4',
  codigo_central: 'FSL',
  nombre_central: 'Francisco Salias',
  telefono: '70*4821',
  nombre_cliente: 'Cliente enmascarado',
  direccion: 'Av. Principal, Res. Los Chaguaramos, piso 3',
  persona_reporta: 'Titular',
  contacto_cliente: null,
  id_pago: 704821,
  marcado_reclasificar: false,
  motivo_marca: null,
  tiene_identificador_pago: true,
  tiene_id_averia_real: true,
  fecha_reporte: '2026-10-11T08:12:00',
  fecha_compromiso: '2026-10-13T12:00:00',
  fecha_cita: null,
  problema_reporte: 'NAVEGACION LENTA',
  ultimo_comentario: 'ONT intermitente',
  informacion: 'Se contactó al suscriptor',
  results: null,
  estatus_origen: 'PENDIENTE',
  olt: 'OLT-FSL-01',
  plan: 'FIBRA 200',
  slot: '3',
  puerto: '12',
  ...extra,
});

const CASOS = [
  CASO(48213),
  CASO(48207, {
    estado_actual: 'EN_ESPERA',
    pendiente: true,
    asignado: false,
    id_cuadrilla: null,
    cuadrilla_codigo: null,
    cuadrilla_nombre: null,
    sector_nombre: 'Santa Mónica',
    problema_reporte: 'FALLA FIBRA',
    ultimo_comentario: 'caja terminal 12',
  }),
  CASO(48190, {
    estado_actual: 'EJECUTADO',
    pendiente: false,
    gestion: true,
    sector_nombre: 'El Valle',
    problema_reporte: 'LOSS ROJO',
    ultimo_comentario: 'requiere maniobra en casa',
    en_gestion_supervisor: true,
  }),
];

/** Respuestas de la API para la sesión simulada. */
function respuestaApi(ruta) {
  if (ruta.startsWith('/api/v1/auth/me')) return USUARIO;
  if (ruta.startsWith('/api/v1/mensajes/no-leidos')) return { total: 2 };
  if (ruta.startsWith('/api/v1/mensajes/bandeja')) return { items: [], total: 0 };
  if (ruta.startsWith('/api/v1/mensajes')) return [];
  if (ruta.startsWith('/api/v1/casos/buscar')) return CASOS;
  if (ruta.startsWith('/api/v1/casos')) {
    return { items: CASOS, total: CASOS.length, page: 1, page_size: 25, pages: 1 };
  }
  if (ruta.startsWith('/api/v1/resumen')) {
    return { total_casos: CASOS.length, pendientes: 1, gestionados: 1, con_cuadrilla: 2 };
  }
  if (ruta.startsWith('/api/v1/central')) return [{ id_central: 4, nombre: 'Francisco Salias' }];
  if (ruta.startsWith('/api/v1/sectores')) return [{ id_sector: 12, nombre: 'Los Chaguaramos' }];
  if (ruta.startsWith('/api/v1/cuadrillas')) {
    return [{ id_cuadrilla: 3, codigo: 'C-03', nombre: 'Cuadrilla 3' }];
  }
  if (ruta.startsWith('/api/v1/tecnicos')) return [];
  if (ruta.startsWith('/api/v1/configuracion')) return {};
  if (ruta.startsWith('/api/v1/seguimiento')) return { cuadrillas: [], total: 0 };
  // Resto: lista vacía (es la forma que mejor toleran las vistas: `.map`,
  // `.length` y accesos a propiedades devuelven valores válidos o vacíos).
  return [];
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function servir() {
  return new Promise((listo) => {
    const servidor = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${PUERTO}`);
      if (url.pathname.startsWith('/api/')) {
        const cuerpo = JSON.stringify(respuestaApi(url.pathname));
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(cuerpo);
        return;
      }
      let archivo = path.join(DIST, decodeURIComponent(url.pathname));
      if (!archivo.startsWith(DIST) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
        archivo = path.join(DIST, 'index.html'); // SPA: cualquier ruta cae al shell
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(archivo)] || 'application/octet-stream' });
      fs.createReadStream(archivo).pipe(res);
    });
    servidor.listen(PUERTO, '127.0.0.1', () => listo(servidor));
  });
}

(async () => {
  if (!fs.existsSync(DIST)) {
    console.error('Falta app/web/dist: ejecute `npm run build` en app/web.');
    process.exit(1);
  }
  fs.mkdirSync(SALIDA, { recursive: true });
  const servidor = await servir();
  const navegador = await chromium.launch();
  const base = `http://127.0.0.1:${PUERTO}`;

  // --- Acceso (sin sesión) -----------------------------------------
  for (const [nombre, ancho, alto] of [
    ['aplicado-login-escritorio', 1440, 900],
    ['aplicado-login-movil', 390, 844],
  ]) {
    const contexto = await navegador.newContext({
      viewport: { width: ancho, height: alto },
      deviceScaleFactor: 2,
    });
    const pagina = await contexto.newPage();
    await pagina.goto(`${base}/login`, { waitUntil: 'load' });
    await pagina.waitForTimeout(500);
    // El aviso legal se acepta una vez para llegar al formulario.
    const casilla = pagina.locator('#aviso-acepto');
    if (await casilla.count()) {
      await casilla.check();
      await pagina.locator('.aviso-legal-boton').click();
      await pagina.waitForTimeout(400);
    }
    // El foco del aviso legal puede dejar la vista desplazada: se vuelve arriba.
    await pagina.evaluate(() => window.scrollTo(0, 0));
    await pagina.waitForTimeout(150);
    await pagina.screenshot({ path: path.join(SALIDA, `${nombre}.png`) });
    console.log(`OK  ${nombre}.png (${ancho}px)`);
    await contexto.close();
  }

  // --- Sesión simulada: listado de casos ---------------------------
  // Nota: la pantalla de OPERACIÓN no se captura aquí porque agrega gráficos
  // de varios endpoints (`/monitoreo/*`, `/panel/gestion-diaria`); con datos de
  // muestra incompletos revienta por forma de dato, no por la interfaz. Para
  // esa pantalla hace falta la API real.
  for (const [nombre, ancho, alto, ruta] of [
    ['aplicado-casos-escritorio', 1440, 900, '/casos'],
    ['aplicado-casos-movil', 390, 844, '/casos'],
  ]) {
    const contexto = await navegador.newContext({
      viewport: { width: ancho, height: alto },
      deviceScaleFactor: 2,
    });
    await contexto.addInitScript(
      ([usuario]) => {
        window.localStorage.setItem('ggto_token', 'token-de-verificacion');
        window.localStorage.setItem('ggto_usuario', JSON.stringify(usuario));
        window.localStorage.setItem('ggto.disclaimer.aceptado', 'verificacion');
      },
      [USUARIO],
    );
    const pagina = await contexto.newPage();
    // Los errores de la página se reportan: permiten distinguir un fallo real
    // de una respuesta de muestra incompleta.
    pagina.on('pageerror', (e) => console.log(`    error en ${ruta}: ${e.message}`));
    pagina.on('console', (m) => {
      if (m.type() === 'error') console.log(`    consola ${ruta}: ${m.text().slice(0, 200)}`);
    });
    await pagina.goto(`${base}${ruta}`, { waitUntil: 'load' });
    await pagina.waitForTimeout(1500);
    await pagina.screenshot({ path: path.join(SALIDA, `${nombre}.png`) });
    console.log(`OK  ${nombre}.png (${ancho}px)`);
    await contexto.close();
  }

  await navegador.close();
  servidor.close();
})();
