/*
 * GGTO-v1 · pruebas/interfaz.mjs
 * Comprobación de INTERFAZ de la página completa: carga `app/index.html` real en
 * Chrome/Edge headless, sustituye la carpeta de datos por un almacén simulado y
 * renderiza las 8 vistas (las 7 pestañas de RF-01 y la sub-pestaña REPORTES de
 * MONITOREO, D-76) con el `contexto()` **real** de `app.js`.
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
import http from 'node:http';
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
  var errores = [];
  window.addEventListener('error', function (ev) { errores.push(String(ev.message)); });
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
  // Las secciones NO se fabrican: si falta la sección real de una pestaña, la
  // comprobación lo registra como fallo. Se devuelve un contenedor suelto para
  // que la comprobación continúe y no se pierdan las demás verificaciones.
  function seccion(id) {
    var c = document.getElementById('seccion-' + id);
    if (c) return c;
    lineas.push('FAIL :: falta la sección real #seccion-' + id + ' en index.html');
    var suelto = document.createElement('div');
    suelto.id = 'seccion-' + id + '-ausente';
    document.body.appendChild(suelto);
    return suelto;
  }
  function botonesDe(raiz, texto) {
    var todos = raiz.querySelectorAll('button');
    var salida = [];
    for (var i = 0; i < todos.length; i++) {
      if ((todos[i].textContent || '').indexOf(texto) >= 0) salida.push(todos[i]);
    }
    return salida;
  }
  /** Mapa etiqueta -> valor de las tablas de resumen de un contenedor. */
  function tablaPlana(raiz) {
    var mapa = {};
    var filas = raiz.querySelectorAll('tr');
    for (var i = 0; i < filas.length; i++) {
      var th = filas[i].querySelector('th');
      var td = filas[i].querySelector('td');
      if (th && td) mapa[(th.textContent || '').trim()] = (td.textContent || '').trim();
    }
    return mapa;
  }
  function serie(pasos) {
    var i = 0;
    function siguiente() {
      if (i >= pasos.length) { publicar(); return; }
      var paso = pasos[i++];
      try { paso(siguiente); } catch (e) {
        lineas.push('FAIL :: excepción en un paso: ' + (e && e.name) + ': ' + (e && e.message));
        siguiente();
      }
    }
    siguiente();
  }

  setTimeout(function () {
    try {
      window.prompt = function () { return ''; };
      var N = window.GGTO_NUCLEO;
      // Contenido del CSV real y de los archivos de trabajo, inyectados por el
      // lanzador (Node) para poder probar la ingesta de verdad.
      var CSV = "__CSV__";
      var DATOS_REALES = __DATOS_REALES__;
      lineas.push('INFO :: CSV de la comprobacion: ' + __FUENTE_CSV__);

      var base = N.estructurasIniciales();
      var datos = {};
      Object.keys(base).forEach(function (k) { datos[k] = base[k]; });
      // Archivos REALES de trabajo cuando están disponibles: hacen que la ingesta
      // del CSV del día se compruebe con el contrato y las claves de verdad.
      if (DATOS_REALES) {
        datos['estructura.json'] = __ESTRUCTURA__;
        datos['central.json'] = __CENTRAL__;
        datos['claves_clasificacion.json'] = __CLAVES__;
      }
      datos['tecnicos.json'] = [{ P00: '12345', nombre: 'Supervisor', rol: 'Supervisor', status: 'Activo', cuadrillas: [] }];
      datos['cuadrillas.json'] = [{ id: 'C1', nombre: 'Cuadrilla 1', status: 'Activa', tecnicos: ['12345'], sectores: ['S1'], vehiculo: 'V1', turno: 'Diurno' }];
      datos['sectores.json'] = [{ id: 'S1', nombre: 'Cumbres', vias: ['CUMBRES'], cuadrilla_sugerida: 'C1' }];
      datos['averias.json'] = [{ id_averia: 'A-1', telefono: '4241234567', nombre: 'Abonado Uno', direccion: 'CALLE 1', sector: 'S1', status: 'PEND', clase: 'REP', nivel: 'COM', tipo_abonado: 'RES', 'Reparador Principal': '', fecha_cita: '13/09/2026', ingreso: '13/09/2026', fecha_reporte: '13/09/2026', plan: 'ABA', fat: 'FAT1', serial: 'S1', ultimo_comentario: 'comentario' }];

      var salidas = { registradas: [] };
      var copias = { n: 0 };
      var logIncidencias = '13/09/2026 09:00 | sesion | intento fallido | p00=999 | credencial' + NL;
      window.GGTO.estado.resumen = [{ archivo: 'averias.json', existe: true, invalido: null, registros: 1 }];
      window.GGTO.estado.almacen = {
        tipo: 'carpeta', carpeta: {}, carpetaRespaldo: null, carpetaDespachos: {},
        handles: {}, estado: {}, datos: datos, historialTexto: '',
        cargar: function () { return Promise.resolve({ archivos: [] }); },
        guardarArchivo: function () { return Promise.resolve(null); },
        agregarHistorial: function () { return Promise.resolve({ agregadas: 0, verificadas: 0 }); },
        crearEstructura: function () { return Promise.resolve({ creados: [] }); },
        estadoRespaldo: function () {
          return Promise.resolve({
            autorizada: !!window.GGTO.estado.almacen.carpetaRespaldo, hay: false, copias: [],
            total: 0, ruta: N.CONST.RUTA_RESPALDO
          });
        },
        guardarCopiaCierre: function () {
          copias.n++;
          return Promise.resolve({
            marca: '13/09/2026 18:00', fecha: '13/09/2026', hora: '18:00',
            nombreMaestro: 'averias_2026-09-13_1800.json', ruta: N.CONST.RUTA_RESPALDO,
            archivos: [{ archivo: 'averias_2026-09-13_1800.json', tamano: 10 }],
            verificados: 10, total: 10, fallos: [], cifrado: false
          });
        },
        listarSalidas: function () { return Promise.resolve(salidas.registradas); },
        guardarSalida: function (nombre, bytes) {
          salidas.registradas.push({ nombre: nombre, tamano: bytes.byteLength });
          return Promise.resolve({ nombre: nombre, ruta: N.CONST.RUTA_DESPACHOS, bytes: bytes.byteLength, verificado: true });
        },
        leerIncidencias: function () { return Promise.resolve(logIncidencias); },
        describir: function () { return 'simulado'; }
      };
      window.GGTO.estado.sesion = { P00: '12345', rol: 'Supervisor' };

      var logs = [];
      var avisos = [];
      function nuevoCtx() {
        var c = window.GGTO.contexto();
        c.registrarLog = function (l) { logs.push(String(l)); };
        c.avisar = function (m) { avisos.push(String(m)); };
        return c;
      }
      var ctx = nuevoCtx();

      // --- contrato de contexto (el defecto que rompía todas las pestañas) ---
      ok('ctx.almacen entrega la instancia y no el módulo', ctx.almacen !== window.GGTO_ALMACEN);
      ok('ctx.almacen.datos está disponible', typeof ctx.almacen.datos === 'object' && ctx.almacen.datos !== null);
      ok('ctx.almacen expone guardarArchivo', typeof ctx.almacen.guardarArchivo === 'function');

      // --- librerías locales que index.html debe cargar (RT-07) ---
      ok('Chart.js cargado por la página (RT-07)', typeof window.Chart !== 'undefined');
      ok('jsPDF cargado por la página (RT-07)', !!(window.jspdf && window.jspdf.jsPDF));
      ok('entorno.js cargado por la página (CU-22)', !!(window.GGTO_ENTORNO && window.GGTO_ENTORNO.render));

      // --- las 8 vistas renderizan con el contexto real ---
      // Siete son pestañas (RF-01) y la octava, REPORTES, es una sub-pestaña de
      // MONITOREO (D-76): se comprueba navegando, no fabricando la sección.
      var modulos = [
        ['CASOS', 'GGTO_CASOS', 'casos'], ['PANEL', 'GGTO_PANEL', 'panel'],
        ['GESTION', 'GGTO_GESTION', 'gestion'], ['DESPACHO', 'GGTO_DESPACHO', 'despacho'],
        ['MONITOREO', 'GGTO_METRICAS', 'monitoreo'], ['GRAFICOS', 'GGTO_GRAFICOS', 'graficos'],
        ['CONFIGURACION', 'GGTO_CONFIGURACION', 'configuracion']
      ];
      var idsPestanas = ['panel', 'monitoreo', 'graficos', 'casos', 'despacho', 'configuracion', 'gestion'];
      ok('cada pestaña de RF-01 tiene su sección real en index.html',
        idsPestanas.every(function (id) { return !!document.getElementById('seccion-' + id); }));
      modulos.forEach(function (m) {
        var cont = seccion(m[2]);
        var mod = window[m[1]];
        if (!mod || typeof mod.render !== 'function') { ok('render ' + m[0], false); return; }
        var err = null;
        try { mod.render(cont, nuevoCtx()); } catch (e) { err = e.name + ': ' + e.message; }
        ok('render ' + m[0] + (err ? ' -> ' + err : ''), err === null);
      });
      // REPORTES: la ruta real es MONITOREO → sub-pestaña «REPORTES y seguimiento».
      var contMon = seccion('monitoreo');
      window.GGTO_METRICAS.render(contMon, nuevoCtx());
      var subReportes = document.getElementById('subtab-monitoreo-reportes');
      ok('MONITOREO aloja la sub-pestaña REPORTES (CU-19/CU-20, D-76)', !!subReportes);
      if (subReportes) subReportes.click();
      ok('la sub-pestaña REPORTES renderiza con la ruta real de la aplicación',
        botonesDe(contMon, 'Emitir el parte del día').length === 1);
      ok('GRAFICOS dibuja los 6 lienzos',
        seccion('graficos').querySelectorAll('canvas').length === 6);
      var subids = (window.GGTO_CONFIGURACION.subsecciones || []).map(function (s) { return s.id; });
      ok('CONFIGURACION tiene 8 sub-pestañas (RESPALDO y ENTORNO incluidas)',
        subids.length === 8 && subids.indexOf('respaldo') >= 0 && subids.indexOf('entorno') >= 0);

      // --- ruta controlada de los PDF (D-27, D-67) ---
      var bloque = { cuadrilla: { id: 'C1', nombre: 'Cuadrilla 1' },
        asignaciones: [{ caso: { id_averia: 'A-1', telefono: '4241234567', contacto: 'Ana', nombre: 'Abonado Uno',
          direccion: 'CALLE 1', plan: 'ABA', fat: 'FAT1', serial: 'S1', ultimo_comentario: 'x' }, motivo: 'reparación' }] };

      serie([
        function (sig) {
          window.GGTO_PDF.generar(nuevoCtx(), bloque, '13/09/2026', 1);
          setTimeout(function () {
            ok('el PDF se guarda en la ruta controlada', salidas.registradas.length === 1 &&
              salidas.registradas[0].nombre === 'Despacho_Cuadrilla_C1_20260913.pdf');
            ok('el log registra la ruta controlada del PDF',
              logs.join(' ').indexOf(N.CONST.RUTA_DESPACHOS + BS + 'Despacho_Cuadrilla_C1_20260913.pdf') >= 0);
            sig();
          }, 160);
        },
        function (sig) {
          window.GGTO_PDF.generar(nuevoCtx(), bloque, '13/09/2026', 1);
          setTimeout(function () {
            ok('la reemisión conserva la versión anterior', salidas.registradas.length === 2 &&
              salidas.registradas[1].nombre === 'Despacho_Cuadrilla_C1_20260913_r2.pdf');
            sig();
          }, 160);
        },
        function (sig) {
          window.GGTO.estado.almacen.carpetaDespachos = null;
          var cont = seccion('despacho');
          window.GGTO_DESPACHO.render(cont, nuevoCtx());
          var t = cont.textContent || '';
          ok('sin ruta controlada la vista DESPACHO lo advierte', t.indexOf('no está autorizada') >= 0);
          ok('la vista DESPACHO ofrece autorizar la carpeta', t.indexOf('Autorizar carpeta') >= 0);
          window.GGTO.estado.almacen.carpetaDespachos = {};
          sig();
        },
        // --- ENTORNO: diagnóstico del puesto (CU-22) ---
        function (sig) {
          window.GGTO_CONFIGURACION.subActiva('entorno');
          var cont = seccion('configuracion');
          window.GGTO_CONFIGURACION.render(cont, nuevoCtx());
          setTimeout(function () {
            var t = cont.textContent || '';
            var bien = t.indexOf('ENTORNO y diagnóstico') >= 0;
            ok('ENTORNO renderiza el diagnóstico' +
              (bien ? '' : ' [' + t.slice(-160).replace(/\s+/g, ' ') + ']'), bien);
            ok('ENTORNO informa las rutas y el modo de trabajo',
              t.indexOf('Ruta controlada de los PDF') >= 0 && t.indexOf('Modo de trabajo') >= 0);
            ok('ENTORNO resume el registro de la aplicación', t.indexOf('Incidencias registradas hoy') >= 0);
            ok('ENTORNO verifica el cierre de la jornada',
              t.indexOf('Última escritura confirmada') >= 0 && t.indexOf('Último respaldo') >= 0);
            sig();
          }, 160);
        },
        // --- Control documental del despacho (CU-17) ---
        function (sig) {
          window.GGTO_DESPACHO.reiniciarControl();
          var cont = seccion('despacho');
          window.GGTO_DESPACHO.render(cont, nuevoCtx());
          var generar = botonesDe(cont, 'Generar el despacho')[0];
          ok('la vista DESPACHO ofrece generar el despacho', !!generar);
          if (generar) generar.click();
          setTimeout(function () {
            var t = cont.textContent || '';
            ok('el control documental arranca pendiente de entrega', t.indexOf('Pendiente de entrega: C1') >= 0);
            var cierre = botonesDe(cont, 'Dar el control documental del día por cerrado')[0];
            ok('el día no se puede cerrar con hojas pendientes', !!cierre && cierre.disabled === true);
            sig();
          }, 160);
        },
        function (sig) {
          var cont = seccion('despacho');
          botonesDe(cont, 'Registrar entrega').forEach(function (b) { b.click(); });
          setTimeout(function () {
            var t = cont.textContent || '';
            ok('tras entregar, el control pide recoger las hojas', t.indexOf('Faltan hojas: C1') >= 0);
            sig();
          }, 160);
        },
        function (sig) {
          var cont = seccion('despacho');
          botonesDe(cont, 'Recoger hojas').forEach(function (b) { b.click(); });
          setTimeout(function () {
            var t = cont.textContent || '';
            ok('tras recoger, el control pide destruir', t.indexOf('Pendiente de destruir') >= 0);
            sig();
          }, 160);
        },
        function (sig) {
          var cont = seccion('despacho');
          botonesDe(cont, 'Registrar destrucción').forEach(function (b) { b.click(); });
          setTimeout(function () {
            var t = cont.textContent || '';
            ok('tras destruir, el control da el día por completo', t.indexOf('Hojas destruidas: 1 de 1') >= 0);
            var cierre = botonesDe(cont, 'Dar el control documental del día por cerrado')[0];
            ok('con todo destruido el cierre se habilita', !!cierre && cierre.disabled === false);
            if (cierre) cierre.click();
            setTimeout(function () {
              ok('el cierre del control queda asentado en el log',
                logs.join(' ').indexOf('CONTROL DOCUMENTAL CERRADO') >= 0);
              ok('las acciones del control dejan asiento en el log',
                logs.join(' ').indexOf('ENTREGA HOJA') >= 0 &&
                logs.join(' ').indexOf('RECOGIDA HOJA') >= 0 &&
                logs.join(' ').indexOf('DESTRUCCION HOJA') >= 0);
              sig();
            }, 80);
          }, 160);
        },
        // --- RESPALDO: copia de cierre (CU-21) ---
        function (sig) {
          window.GGTO.estado.almacen.carpetaRespaldo = {};
          var cont = seccion('configuracion');
          window.GGTO_CONFIGURACION.subActiva('respaldo');
          window.GGTO_CONFIGURACION.render(cont, nuevoCtx());
          // El bloque consulta el estado del respaldo de forma asíncrona.
          setTimeout(function () {
            var boton = botonesDe(cont, 'Respaldar ahora')[0];
            ok('la subpestaña RESPALDO ofrece la copia de cierre', !!boton);
            if (boton) boton.click();
            setTimeout(function () {
              ok('la copia de cierre se ejecuta y se verifica', copias.n === 1);
              ok('el respaldo queda asentado en el log',
                logs.join(' ').indexOf('COPIA DE CIERRE') >= 0);
              sig();
            }, 220);
          }, 220);
        },
        // --- REPORTES: emisión del parte del día (CU-19) por su ruta real ---
        function (sig) {
          var cont = seccion('monitoreo');
          window.GGTO_METRICAS.render(cont, nuevoCtx());
          var sub = document.getElementById('subtab-monitoreo-reportes');
          if (sub) sub.click();
          var boton = botonesDe(cont, 'Emitir el parte del día')[0];
          ok('REPORTES ofrece emitir el parte del día', !!boton);
          var antes = logs.length;
          if (boton) boton.click();
          setTimeout(function () {
            ok('la emisión del parte queda asentada en el log', logs.length > antes);
            sig();
          }, 180);
        },
        // --- Sesión con credencial real (CU-01) ---
        function (sig) {
          var sal = 'a1b2c3d4e5f6a7b8';
          window.GGTO_NUCLEO.hashClave('ClaveSegura123', sal, window.crypto.subtle).then(function (hash) {
            window.GGTO.estado.almacen.datos['tecnicos.json'] = [{
              P00: '12345', nombre: 'Supervisor Uno', cedula: '1', rol: 'Supervisor', status: 'Activo',
              clave_sal: sal, clave_hash: hash, clave_cambio_obligatorio: 'NO', clave_fecha_cambio: '13/09/2026'
            }];
            window.GGTO.estado.sesion = null;
            document.getElementById('paso-carpeta').hidden = true;
            document.getElementById('paso-sesion').hidden = false;

            // 1) contraseña incorrecta: la sesión no se abre y el intento se registra.
            document.getElementById('login-p00').value = '12345';
            document.getElementById('login-clave').value = 'ClaveIncorrecta1';
            document.getElementById('form-acceso').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            setTimeout(function () {
              ok('la sesión NO se abre con la contraseña incorrecta', !window.GGTO.estado.sesion);
              var contador = document.getElementById('contador-intentos');
              ok('el intento fallido queda registrado',
                !!contador && /Intentos fallidos: 1/.test(contador.textContent || ''));

              // 2) credencial válida: se abre la sesión y se habilitan las pestañas.
              document.getElementById('login-p00').value = '12345';
              document.getElementById('login-clave').value = 'ClaveSegura123';
              document.getElementById('form-acceso').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
              setTimeout(function () {
                var ses = window.GGTO.estado.sesion;
                var msg = document.getElementById('msg-acceso');
                var pista = ses ? '' : ' [msg="' + ((msg && msg.textContent) || '') +
                  '" errores="' + errores.join(' | ') + '"]';
                ok('la sesión se abre con la credencial válida (P00 + contraseña con hash)' + pista,
                  !!ses && ses.P00 === '12345');
                ok('el armazón construye las 7 pestañas',
                  document.querySelectorAll('#pestanas button').length === 7);
                var desp = document.getElementById('tab-despacho');
                var conf = document.getElementById('tab-configuracion');
                ok('el supervisor tiene habilitadas DESPACHO y CONFIGURACION',
                  !!desp && desp.disabled === false && !!conf && conf.disabled === false);
                sig();
              }, 350);
            }, 250);
          }).catch(function (e) {
            ok('no se pudo preparar la credencial: ' + (e && e.message), false);
            sig();
          });
        },
        // --- Ingesta del CSV REAL desde el bloque del PANEL (CU-08) ---
        function (sig) {
          var cont = seccion('panel');
          window.GGTO_PANEL.render(cont, nuevoCtx());
          var entrada = document.getElementById('archivo-csv');
          ok('el PANEL aloja el bloque INGESTA del CSV (CU-08)', !!entrada);
          if (!entrada) { sig(); return; }
          if (!DATOS_REALES) {
            lineas.push('SKIP :: ingesta del CSV real (faltan los archivos de C:' + BS + 'GGTO' + BS + 'datos)');
            sig();
            return;
          }
          var dt = new DataTransfer();
          dt.items.add(new File([CSV], 'detalle_averias_gpon 12_09_2026.csv', { type: 'text/csv' }));
          entrada.files = dt.files;
          entrada.dispatchEvent(new Event('change', { bubbles: true }));
          setTimeout(function () {
            var filas = tablaPlana(cont);
            ok('la revisión lee las 56 filas del archivo real', filas['Filas leídas'] === '56');
            ok('descarta los 5 registros de otras centrales',
              filas['Descartadas por no ser de la central'] === '5');
            ok('quedan 51 casos nuevos de Francisco Salias',
              filas['Casos nuevos a insertar'] === '51');
            ok('el reparto es 18 PEND + 33 GESTION',
              filas['Quedarían en PEND'] === '18' &&
              filas['Quedarían en GESTION (bandeja telefónica)'] === '33');
            ok('la revisión NO escribe el maestro',
              (window.GGTO.estado.almacen.datos['averias.json'] || []).length === 1);
            sig();
          }, 600);
        }
      ]);
    } catch (e) {
      lineas.push('FAIL :: excepción de la comprobación: ' + (e && e.name) + ': ' + (e && e.message));
      publicar();
    }
  }, 500);
})();
</script>
`;

// --- 3. Página de comprobación y ejecución ---------------------------------
const RUTA_DATOS = 'C:\\GGTO\\datos';
function leerSiExiste(ruta) {
  try { return fs.readFileSync(ruta, 'utf8'); } catch { return null; }
}
// CSV de la comprobación. Se prefiere la muestra real del 12/09/2026 cuando está
// en la raíz (el archivo que documenta el reparto 56/5/51 y 18 PEND + 33 GESTION);
// si no está —no se versiona, D-71— se usa la MUESTRA ANONIMIZADA versionada, que
// reproduce ese mismo contrato. Así la comprobación de la ingesta NUNCA se salta:
// antes, al retirar el archivo real, el paso quedaba en SKIP silencioso.
const rutaCsvReal = path.join(raiz, 'detalle_averias_gpon 12_09_2026.csv');
const rutaFixture = path.join(raiz, 'pruebas', 'fixtures', 'detalle_averias_gpon_muestra.csv');
const csvReal = leerSiExiste(rutaCsvReal);
const csvCrudo = csvReal || leerSiExiste(rutaFixture);
const fuenteCsv = csvReal ? 'muestra real del 12/09/2026' : 'muestra anonimizada versionada (pruebas/fixtures)';
const estructuraCruda = leerSiExiste(path.join(RUTA_DATOS, 'estructura.json'));
const centralCruda = leerSiExiste(path.join(RUTA_DATOS, 'central.json'));
const clavesCruda = leerSiExiste(path.join(RUTA_DATOS, 'claves_clasificacion.json'));
const datosReales = !!(csvCrudo && estructuraCruda && centralCruda && clavesCruda);
if (!csvCrudo) console.error('Aviso: no hay CSV de comprobación (ni real ni muestra anonimizada).');

const html = fs.readFileSync(indexHtml, 'utf8');
if (!html.includes('</body>')) {
  console.error('No se encontró </body> en app/index.html');
  process.exit(1);
}
// El CSV se inyecta como literal de JavaScript (JSON lo escapa por nosotros).
const sondaFinal = sonda
  .replace('"__CSV__"', JSON.stringify(csvCrudo || ''))
  .replace('__FUENTE_CSV__', JSON.stringify(fuenteCsv))
  .replace('__ESTRUCTURA__', estructuraCruda || 'null')
  .replace('__CENTRAL__', centralCruda || 'null')
  .replace('__CLAVES__', clavesCruda || 'null')
  .replace('__DATOS_REALES__', datosReales ? 'true' : 'false');

const pagina = path.join(raiz, 'app', '_interfaz_check.html');
fs.writeFileSync(pagina, html.replace('</body>', sondaFinal + '\n</body>'), 'utf8');

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'ggto-ui-'));
const salida = path.join(perfil, 'dom.txt');

// La comprobación se sirve por HTTP (no por file://): en file:// el arranque de
// la página se aborta a propósito y no se conectan los eventos de la interfaz,
// así que no se podría probar ni la sesión ni la ingesta.
const raizApp = path.join(raiz, 'app');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};
const servidor = http.createServer((peticion, respuesta) => {
  const limpio = decodeURIComponent(String(peticion.url || '/').split('?')[0]);
  const relativo = path.normalize(limpio === '/' ? '/index.html' : limpio).replace(/^[/\\]+/, '');
  const destino = path.join(raizApp, relativo);
  if (!destino.startsWith(raizApp)) { respuesta.writeHead(403); respuesta.end('fuera del alcance'); return; }
  fs.readFile(destino, (err, datos) => {
    if (err) { respuesta.writeHead(404); respuesta.end('no encontrado'); return; }
    respuesta.writeHead(200, { 'Content-Type': TIPOS[path.extname(destino)] || 'application/octet-stream' });
    respuesta.end(datos);
  });
});
await new Promise((listo) => servidor.listen(0, '127.0.0.1', listo));
const url = 'http://127.0.0.1:' + servidor.address().port + '/_interfaz_check.html';

const argumentos = [
  '--headless=new', '--disable-gpu', '--no-first-run',
  '--user-data-dir=' + path.join(perfil, 'perfil'),
  '--virtual-time-budget=9000',
  '--dump-dom',
  url
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
servidor.close();

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
// El recuento cuenta solo comprobaciones evaluadas (PASS/FAIL): las lineas INFO y
// SKIP se informan pero no inflan el total, que es lo que se cita en el corpus.
const evaluadas = lineas.filter((l) => /^(PASS|FAIL) ::/.test(l));
const fallos = evaluadas.filter((l) => l.startsWith('FAIL')).length;
console.log('\nComprobación de interfaz: ' + (evaluadas.length - fallos) + '/' + evaluadas.length + ' correctas.');
process.exit(fallos === 0 ? 0 : 1);
