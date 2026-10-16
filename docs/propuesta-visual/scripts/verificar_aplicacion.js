/**
 * GGTO · CANTV — Verificación visual de la propuesta aplicada y de los cambios
 * de interfaz (D-103).
 *
 * Levanta un servidor estático sobre `app/web/dist` (el paquete ya compilado),
 * responde los endpoints de la API con datos de muestra y captura con Playwright
 * las pantallas reales de la aplicación:
 *
 *   aplicado-login-{escritorio,movil}.png       · /login
 *   aplicado-casos-{escritorio,movil}.png       · /casos (columna REPORTE y FAT)
 *   aplicado-especiales-escritorio.png          · /especiales
 *   aplicado-operacion-{escritorio,completo}.png · / (fichas del Panel)
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
  // D-103: el FAT acompaña al sector en los listados.
  fat: '2324-04-04.1-20-FAT60 EG8245H5',
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
    fat: '2324-04-04.1-20.1-FAT133 EG8145V5',
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

/** Casos especiales de muestra (D-103: incluyen el FAT del caso asociado). */
const ESPECIALES = [
  {
    id_caso_especial: 91,
    id_caso: 48213,
    id_solicitante: 3,
    clasificacion: 'RESIDENCIAL',
    tipo_actividad: 'REPARACION',
    prioridad: 'ALTA',
    tiene_id_averia: true,
    descripcion: 'Reubicación de ONT solicitada por el suscriptor.',
    requiere_informe: true,
    estado: 'ABIERTO',
    creado_en: '2026-10-11T09:00:00',
    actualizado_en: '2026-10-12T10:30:00',
    sector_nombre: 'Los Chaguaramos',
    fat: '2324-04-04.1-20-FAT60 EG8245H5',
    solicitante_nombre: 'Unidad de Masivos',
    solicitante_unidad: 'Masivos',
    direccion: 'Av. Principal, Res. Los Chaguaramos, piso 3',
    nombre_cliente: 'Cliente enmascarado',
    contacto_cliente: '04141234567',
    telefono: '70*4821',
    tipo_problema: 'NAVEGACION LENTA',
    pendiente: true,
    asignado: false,
    citado: false,
    gestion: false,
    id_cuadrilla: null,
    cuadrilla_codigo: null,
    cuadrilla_nombre: null,
  },
  {
    id_caso_especial: 92,
    id_caso: null,
    id_solicitante: 4,
    clasificacion: 'GOBIERNO',
    tipo_actividad: 'CONSTRUCCION',
    prioridad: 'MEDIA',
    tiene_id_averia: false,
    descripcion: 'Construcción de punto óptico en sede administrativa.',
    requiere_informe: false,
    estado: 'EN_PROCESO',
    creado_en: '2026-10-10T08:15:00',
    actualizado_en: '2026-10-12T11:00:00',
    sector_nombre: 'El Valle',
    fat: '2324-04-04.1-20.3-FAT133 EG8145V5',
    solicitante_nombre: 'Alcaldía',
    solicitante_unidad: 'Institucional',
    direccion: 'Calle 5, edificio administrativo',
    nombre_cliente: 'Institución',
    contacto_cliente: null,
    telefono: null,
    tipo_problema: 'CONSTRUCCION',
    pendiente: true,
    asignado: true,
    citado: false,
    gestion: false,
    id_cuadrilla: 3,
    cuadrilla_codigo: 'C-03',
    cuadrilla_nombre: 'Cuadrilla 3',
  },
];

/** Respuestas de la API para la sesión simulada. */
function respuestaApi(ruta) {
  if (ruta.startsWith('/api/v1/auth/me')) return USUARIO;
  if (ruta.startsWith('/api/v1/mensajes/no-leidos')) return { total: 2 };
  if (ruta.startsWith('/api/v1/mensajes/bandeja')) return { items: [], total: 0 };
  if (ruta.startsWith('/api/v1/mensajes')) return [];
  if (ruta.startsWith('/api/v1/casos-especiales')) return ESPECIALES;
  if (ruta.startsWith('/api/v1/solicitantes')) {
    return [{ id_solicitante: 3, nombre: 'Unidad de Masivos', unidad: 'Masivos' }];
  }
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

  // --- Panel/Operación (D-103): formas completas para que las fichas pinten ---
  if (ruta.startsWith('/api/v1/panel/gestion-diaria')) {
    return {
      fecha: '2026-10-15',
      modo: 'COMUN',
      cuadrillas: [],
      totales: { asignadas: 0, cerradas: 0, porcentaje: 0 },
    };
  }
  if (ruta.startsWith('/api/v1/monitoreo/diario')) {
    return {
      fecha: '2026-10-15',
      ingresos_nuevos: 0,
      resueltos_residencial: 0,
      resueltos_empresarial: 0,
      resueltos_referidos: 0,
      citados: 0,
      diferidos: 0,
      gestionados: 0,
      pendientes_total: 0,
    };
  }
  if (ruta.startsWith('/api/v1/monitoreo/semanal')) return { desde: '', hasta: '', dias: [] };
  if (ruta.startsWith('/api/v1/monitoreo/cuadrilla')) {
    return { desde: '', hasta: '', dias: [], cuadrillas: [] };
  }
  if (ruta.startsWith('/api/v1/monitoreo/globales')) {
    return {
      desde: '',
      hasta: '',
      pendientes: 0,
      resueltos: 0,
      total: 0,
      por_estado: {},
      por_categoria: {},
    };
  }
  if (ruta.startsWith('/api/v1/monitoreo/reparacion')) {
    return {
      residenciales_comunes: 0,
      residenciales_referidos: 0,
      empresariales: 0,
      total: 0,
      cuadrillas: [],
    };
  }
  if (ruta.startsWith('/api/v1/monitoreo/construccion')) {
    return {
      residenciales: 0,
      empresariales: 0,
      total: 0,
      asignados: 0,
      cerrados: 0,
      gestionados: 0,
      cuadrillas: [],
    };
  }
  if (ruta.startsWith('/api/v1/monitoreo/capacidad')) {
    return {
      cuadrillas_activas: 0,
      cuadrillas: [],
      tecnicos_activos: 0,
      flota_disponible: 0,
      herramientas_disponibles: 0,
      sectores_activos: 0,
    };
  }
  if (ruta.startsWith('/api/v1/monitoreo/identificadores')) {
    return {
      ventana_dias: 30,
      con_casos: 0,
      casos_con_identificador: 0,
      casos_sin_identificador: 0,
      media_casos: 0,
      max_casos: 0,
      reincidentes: 0,
      top: [],
      reparaciones_validas: 0,
      referidos: 0,
    };
  }
  if (ruta.startsWith('/api/v1/monitoreo/reclasificaciones')) {
    return {
      reparaciones_validas: 0,
      referidos: 0,
      reclasificadas: 0,
      pendientes_historicos: 0,
      pendientes_historicos_en_terminal: 0,
      referidos_sin_ficha: 0,
      referidos_por_clasificacion: {},
    };
  }
  if (ruta.startsWith('/api/v1/monitoreo')) return { total: 0, filas: [], por_estado: {} };
  if (ruta.startsWith('/api/v1/metricas')) {
    return {
      casos_total: 0,
      casos_por_estado: {},
      casos_por_categoria: {},
      lotes_ingesta: 0,
      casos_ingeridos: 0,
      fallas_activas: 0,
      notificaciones_pendientes: 0,
      notificaciones_enviadas: 0,
      notificaciones_fallidas: 0,
      canales_configurados: {},
    };
  }
  if (ruta.startsWith('/api/v1/fallas-masivas')) return [];
  if (ruta.startsWith('/api/v1/notificaciones')) return [];
  if (ruta.startsWith('/api/v1/ingesta/lotes')) return [];
  if (ruta.startsWith('/api/v1/ingesta')) return {};

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

  // --- Sesión simulada: listados y Panel ---------------------------
  for (const [nombre, ancho, alto, ruta, completa] of [
    ['aplicado-casos-escritorio', 1440, 900, '/casos'],
    ['aplicado-casos-movil', 390, 844, '/casos'],
    ['aplicado-especiales-escritorio', 1440, 900, '/especiales'],
    ['aplicado-operacion-escritorio', 1440, 1200, '/'],
    ['aplicado-operacion-completo', 1440, 1000, '/', true],
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
    // Los errores de la página se reportan: permiten distinguir un fallo real de
    // una respuesta de muestra incompleta.
    pagina.on('pageerror', (e) => console.log(`    error en ${ruta}: ${e.message}`));
    pagina.on('console', (m) => {
      if (m.type() === 'error') console.log(`    consola ${ruta}: ${m.text().slice(0, 200)}`);
    });
    await pagina.goto(`${base}${ruta}`, { waitUntil: 'load' });
    await pagina.waitForTimeout(1500);
    await pagina.screenshot({
      path: path.join(SALIDA, `${nombre}.png`),
      fullPage: completa === true,
    });
    console.log(`OK  ${nombre}.png (${ancho}px)`);
    await contexto.close();
  }

  await navegador.close();
  servidor.close();
})();
