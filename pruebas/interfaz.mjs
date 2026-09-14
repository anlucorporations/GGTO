/*
 * GGTO-v1 · pruebas/interfaz.mjs
 * Comprobación de INTERFAZ de la página completa: carga `app/index.html` real en
 * Chrome/Edge headless, sustituye la carpeta de datos por un almacén simulado y
 * renderiza las 8 vistas con el `contexto()` **real** de `app.js`.
 *
 * Existe porque `node --test` valida los módulos por separado y no ve los
 * defectos del contrato entre `app.js` y los módulos: así se detectaron (a) que
 * `ctx.almacen` entregaba el módulo en lugar de la instancia —`TypeError` al
 * renderizar cualquier pestaña— y (b) que Chart.js no se cargaba en index.html.
 *
 *   Ejecutar:  node pruebas/interfaz.mjs
 * Sale con código 1 si alguna comprobación falla; avisa y sale con 0 si no hay
 * navegador Chromium disponible. Con GGTO_KEEP=1 conserva la página generada.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const indexHtml = path.join(raiz, 'app', 'index.html');
const marcaInicio = '<pre id="resultado-interfaz">';
const marcaFin = 'FIN-INTERFAZ';

// --- 1. Localizar el navegador ---------------------------------------------
function buscarNavegador() {
  const candidatos = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  return candidatos.find((c) => { try { return fs.existsSync(c); } catch { return false; } }) || null;
}

const navegador = buscarNavegador();
if (!navegador) {
  console.log('AVISO: no se encontró Chrome ni Edge; se omite la comprobación de interfaz.');
  process.exit(0);
}

// --- 2. Sonda que se inyecta en la página real -----------------------------
// Sin barras invertidas literales (se usan con String.fromCharCode(92)) y sin
// `prompt` ni descargas reales: `window.prompt` se anula porque un diálogo modal
// deja bloqueado a Chrome headless.
const sonda = `
<script>
(function () {
  var BS = String.fromCharCode(92);
  var NL = String.fromCharCode(10);
  var lineas = [];
  function ok(nombre, condicion) { lineas.push((condicion ? 'PASS' : 'FAIL') + ' :: ' + nombre); }
  function publicar() {
    var pre = document.createElement('pre');
    pre.id = 'resultado-interfaz';
    pre.textContent = lineas.join(NL);
    document.body.appendChild(pre);
    var fin = document.createElement('span');
    fin.id = 'fin-interfaz';
    fin.textContent = 'FIN-INTERFAZ';
    document.body.appendChild(fin);
  }
  function seccion(id) {
    var c = document.getElementById('seccion-' + id);
    if (!c) { c = document.createElement('div'); c.id = 'seccion-' + id; document.body.appendChild(c); }
    return c;
  }

  setTimeout(function () {
    try {
      window.prompt = function () { return ''; };
      var N = window.GGTO_NUCLEO;

      var base = N.estructurasIniciales();
      var datos = {};
      Object.keys(base).forEach(function (k) { datos[k] = base[k]; });
      datos['tecnicos.json'] = [{ P00: '12345', nombre: 'Supervisor', rol: 'Supervisor', status: 'Activo', cuadrillas: [] }];
      datos['cuadrillas.json'] = [{ id: 'C1', nombre: 'Cuadrilla 1', status: 'Activa', tecnicos: ['12345'], sectores: ['S1'], vehiculo: 'V1', turno: 'Diurno' }];
      datos['sectores.json'] = [{ id: 'S1', nombre: 'Cumbres', vias: ['CUMBRES'], cuadrilla_sugerida: 'C1' }];
      datos['averias.json'] = [{ id_averia: 'A-1', telefono: '4241234567', nombre: 'Abonado Uno', direccion: 'CALLE 1', sector: 'S1', status: 'PEND', clase: 'REP', nivel: 'COM', tipo_abonado: 'RES', 'Reparador Principal': '', fecha_cita: '13/09/2026', ingreso: '13/09/2026', fecha_reporte: '13/09/2026', plan: 'ABA', fat: 'FAT1', serial: 'S1', ultimo_comentario: 'comentario' }];

      var salidas = { registradas: [] };
      window.GGTO.estado.almacen = {
        tipo: 'carpeta', carpeta: {}, carpetaRespaldo: null, carpetaDespachos: {},
        handles: {}, estado: {}, datos: datos, historialTexto: '',
        cargar: function () { return Promise.resolve({ archivos: [] }); },
        guardarArchivo: function () { return Promise.resolve(null); },
        agregarHistorial: function () { return Promise.resolve({ agregadas: 0, verificadas: 0 }); },
        crearEstructura: function () { return Promise.resolve({ creados: [] }); },
        estadoRespaldo: function () { return Promise.resolve({ autorizada: false, hay: false, copias: [], total: 0, ruta: N.CONST.RUTA_RESPALDO }); },
        listarSalidas: function () { return Promise.resolve(salidas.registradas); },
        guardarSalida: function (nombre, bytes) {
          salidas.registradas.push({ nombre: nombre, tamano: bytes.byteLength });
          return Promise.resolve({ nombre: nombre, ruta: N.CONST.RUTA_DESPACHOS, bytes: bytes.byteLength, verificado: true });
        },
        describir: function () { return 'simulado'; }
      };
      window.GGTO.estado.sesion = { P00: '12345', rol: 'Supervisor' };

      var logs = [];
      var avisos = [];
      var ctx = window.GGTO.contexto();
      ctx.registrarLog = function (l) { logs.push(String(l)); };
      ctx.avisar = function (m) { avisos.push(String(m)); };

      // --- contrato de contexto (el defecto que rompía todas las pestañas) ---
      ok('ctx.almacen entrega la instancia y no el módulo', ctx.almacen !== window.GGTO_ALMACEN);
      ok('ctx.almacen.datos está disponible', typeof ctx.almacen.datos === 'object' && ctx.almacen.datos !== null);
      ok('ctx.almacen expone guardarArchivo', typeof ctx.almacen.guardarArchivo === 'function');

      // --- librerías locales que index.html debe cargar (RT-07) ---
      ok('Chart.js cargado por la página (RT-07)', typeof window.Chart !== 'undefined');
      ok('jsPDF cargado por la página (RT-07)', !!(window.jspdf && window.jspdf.jsPDF));

      // --- las 8 vistas renderizan con el contexto real ---
      var modulos = [
        ['CASOS', 'GGTO_CASOS', 'casos'], ['PANEL', 'GGTO_PANEL', 'panel'],
        ['GESTION', 'GGTO_GESTION', 'gestion'], ['DESPACHO', 'GGTO_DESPACHO', 'despacho'],
        ['MONITOREO', 'GGTO_METRICAS', 'monitoreo'], ['GRAFICOS', 'GGTO_GRAFICOS', 'graficos'],
        ['REPORTES', 'GGTO_REPORTES', 'reportes'], ['CONFIGURACION', 'GGTO_CONFIGURACION', 'configuracion']
      ];
      modulos.forEach(function (m) {
        var cont = seccion(m[2]);
        var mod = window[m[1]];
        if (!mod || typeof mod.render !== 'function') { ok('render ' + m[0], false); return; }
        var err = null;
        try { mod.render(cont, window.GGTO.contexto()); } catch (e) { err = e.name + ': ' + e.message; }
        ok('render ' + m[0] + (err ? ' -> ' + err : ''), err === null);
      });
      ok('GRAFICOS dibuja los 6 lienzos',
        seccion('graficos').querySelectorAll('canvas').length === 6);

      // --- ruta controlada de los PDF (D-27, D-67) ---
      var bloque = { cuadrilla: { id: 'C1', nombre: 'Cuadrilla 1' },
        asignaciones: [{ caso: { id_averia: 'A-1', telefono: '4241234567', contacto: 'Ana', nombre: 'Abonado Uno',
          direccion: 'CALLE 1', plan: 'ABA', fat: 'FAT1', serial: 'S1', ultimo_comentario: 'x' }, motivo: 'reparación' }] };

      var ctxPdf = window.GGTO.contexto();
      ctxPdf.registrarLog = function (l) { logs.push(String(l)); };
      ctxPdf.avisar = function (m) { avisos.push(String(m)); };
      window.GGTO_PDF.generar(ctxPdf, bloque, '13/09/2026', 1);

      setTimeout(function () {
        ok('el PDF se guarda en la ruta controlada', salidas.registradas.length === 1 &&
          salidas.registradas[0].nombre === 'Despacho_Cuadrilla_C1_20260913.pdf');
        ok('el log registra la ruta controlada del PDF',
          logs.join(' ').indexOf(N.CONST.RUTA_DESPACHOS + BS + 'Despacho_Cuadrilla_C1_20260913.pdf') >= 0);

        window.GGTO_PDF.generar(ctxPdf, bloque, '13/09/2026', 1);
        setTimeout(function () {
          ok('la reemisión conserva la versión anterior', salidas.registradas.length === 2 &&
            salidas.registradas[1].nombre === 'Despacho_Cuadrilla_C1_20260913_r2.pdf');

          // Sin ruta controlada: la vista DESPACHO debe advertirlo y ofrecer autorizarla.
          window.GGTO.estado.almacen.carpetaDespachos = null;
          var contDesp = seccion('despacho');
          window.GGTO_DESPACHO.render(contDesp, window.GGTO.contexto());
          var t = contDesp.textContent || '';
          ok('sin ruta controlada la vista DESPACHO lo advierte', t.indexOf('no está autorizada') >= 0);
          ok('la vista DESPACHO ofrece autorizar la carpeta', t.indexOf('Autorizar carpeta') >= 0);
          publicar();
        }, 150);
      }, 150);
    } catch (e) {
      lineas.push('FAIL :: excepción de la comprobación: ' + (e && e.name) + ': ' + (e && e.message));
      publicar();
    }
  }, 500);
})();
</script>
`;

// --- 3. Página de comprobación y ejecución ---------------------------------
const html = fs.readFileSync(indexHtml, 'utf8');
if (!html.includes('</body>')) {
  console.error('No se encontró </body> en app/index.html');
  process.exit(1);
}
const pagina = path.join(raiz, 'app', '_interfaz_check.html');
fs.writeFileSync(pagina, html.replace('</body>', sonda + '\n</body>'), 'utf8');

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'ggto-ui-'));
const salida = path.join(perfil, 'dom.txt');
const argumentos = [
  '--headless=new', '--disable-gpu', '--no-first-run',
  '--user-data-dir=' + path.join(perfil, 'perfil'),
  '--virtual-time-budget=9000',
  '--dump-dom',
  'file:///' + pagina.replace(/\\/g, '/')
];

// Salida a ARCHIVO con espera por sondeo: las tuberías no devuelven nada en este
// entorno y no se puede depender de que Chrome cierre el descriptor, porque sus
// procesos hijo lo heredan (es lo que bloquea a `spawnSync`).
const fd = fs.openSync(salida, 'w');
const hijo = spawn(navegador, argumentos, { stdio: ['ignore', fd, 'ignore'], windowsHide: true });
let dom = '';
let desenlace = 'timeout';
const limite = Date.now() + 60000;
while (Date.now() < limite) {
  await new Promise((r) => setTimeout(r, 250));
  try { dom = fs.readFileSync(salida, 'utf8'); } catch { dom = ''; }
  if (dom.indexOf(marcaFin) >= 0) { desenlace = 'publicado'; break; }
  if (hijo.exitCode !== null || hijo.signalCode !== null) { desenlace = 'exit'; break; }
}
try { hijo.kill(); } catch { /* ya terminó */ }
try { fs.closeSync(fd); } catch { /* ya cerrado */ }

function limpiar(ruta) {
  try { fs.rmSync(ruta, { recursive: true, force: true }); } catch { /* Chrome aún lo retiene */ }
}
// GGTO_KEEP=1 conserva la página de comprobación y el perfil para diagnosticar.
if (!process.env.GGTO_KEEP) {
  limpiar(pagina);
  limpiar(perfil);
}

const desde = dom.indexOf(marcaInicio);
if (!dom || desde < 0) {
  console.error('La comprobación de interfaz no produjo resultado (' + desenlace + ').');
  process.exit(1);
}
const hasta = dom.indexOf('</pre>', desde);
const crudo = dom.slice(desde + marcaInicio.length, hasta);
const texto = crudo
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
lineas.forEach((l) => console.log(l));
const fallos = lineas.filter((l) => l.startsWith('FAIL')).length;
console.log('\nComprobación de interfaz: ' + (lineas.length - fallos) + '/' + lineas.length + ' correctas.');
process.exit(fallos === 0 ? 0 : 1);
