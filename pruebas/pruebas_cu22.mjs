/*
 * GGTO-v1 · pruebas/pruebas_cu22.mjs
 * Pruebas del ciclo C7 para CU-22 (operar en contingencia y diagnosticar el
 * entorno): detección del navegador, verificación del origen de la página,
 * resumen del registro de la aplicación (`incidencias.log`) y última escritura
 * confirmada; más la lectura del log desde el almacén.
 *   Ejecutar:  node --test pruebas/pruebas_cu22.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(aqui, '..', 'app', 'js');

globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ href: '', download: '', click() {}, setAttribute() {}, style: {} }),
  body: { appendChild() {}, removeChild() {} }
};
globalThis.URL.createObjectURL = () => 'blob:prueba';
globalThis.URL.revokeObjectURL = () => {};

const N = require(path.join(app, 'nucleo.js'));
globalThis.GGTO_NUCLEO = N;
require(path.join(app, 'almacen.js'));
const A = globalThis.GGTO_ALMACEN;
const E = require(path.join(app, 'entorno.js'));

const HOY = '13/09/2026';

// --- Simulación mínima de la carpeta autorizada (solo texto) ---------------
class ArchivoFalso {
  constructor(nombre, contenido) { this.name = nombre; this.contenido = contenido; this.lastModified = 1000; }
  async text() { return this.contenido; }
}
class HandleFalso {
  constructor(archivo) { this.archivo = archivo; }
  async getFile() { return this.archivo; }
}
class CarpetaFalsa {
  constructor(archivos) { this.archivos = archivos || new Map(); }
  async getFileHandle(nombre) {
    if (!this.archivos.has(nombre)) {
      const e = new Error('no encontrado');
      e.name = 'NotFoundError';
      throw e;
    }
    return new HandleFalso(this.archivos.get(nombre));
  }
  keys() {
    const nombres = Array.from(this.archivos.keys());
    let i = 0;
    return { next: async () => (i < nombres.length ? { value: nombres[i++], done: false } : { value: undefined, done: true }) };
  }
}

// ===========================================================================
// 1. Detección del navegador (CU-22, paso 2; RNF-03)
// ===========================================================================
test('detecta el navegador y si soporta la escritura directa de los JSON', () => {
  const chrome = E.navegadorDetectado('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
  assert.equal(chrome.nombre, 'Chrome');
  assert.equal(chrome.version, '120.0.0.0');
  assert.equal(chrome.soportado, true);

  const edge = E.navegadorDetectado('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');
  assert.equal(edge.nombre, 'Edge');
  assert.equal(edge.soportado, true);

  assert.equal(E.navegadorDetectado('Mozilla/5.0 Chrome/80.0.0.0 Safari/537.36').soportado, false,
    'Chromium anterior a 86 no soporta la API');
  assert.equal(E.navegadorDetectado('Mozilla/5.0 (Windows NT 10.0; rv:115.0) Gecko/20100101 Firefox/115.0').soportado, false,
    'Firefox no soporta la API: solo modo descarga');
  assert.equal(E.navegadorDetectado('').nombre, 'no identificado');
});

// ===========================================================================
// 2. Origen de la página (CU-22, paso 2; D-15, RT-09)
// ===========================================================================
test('verifica que la página se sirva en http sobre host local', () => {
  const local = E.origenPagina({ protocol: 'http:', hostname: 'localhost', port: '8787' });
  assert.equal(local.correcto, true);
  assert.equal(local.texto, 'http://localhost:8787');

  assert.equal(E.origenPagina({ protocol: 'http:', hostname: '127.0.0.1', port: '8787' }).correcto, true);

  const archivo = E.origenPagina({ protocol: 'file:', hostname: '' });
  assert.equal(archivo.correcto, false);
  assert.match(archivo.motivo, /servir-ggto\.ps1/, 'abrir con doble clic se explica y se desaconseja');

  assert.equal(E.origenPagina({ protocol: 'https:', hostname: 'ejemplo.com' }).correcto, false);
  assert.equal(E.origenPagina(null).texto, 'desconocido');
});

// ===========================================================================
// 3. Registro de la aplicación (CU-22, pasos 4 y 7)
// ===========================================================================
test('resume el registro: total, líneas del día e incidencias del día', () => {
  const log = [
    '13/09/2026 09:00 | sesion | intento fallido | p00=999 | credencial',
    '13/09/2026 10:00 | permiso | DENEGADO | p00=12345 | rol',
    '13/09/2026 11:00 | ingesta | OK | p00=12345',
    '12/09/2026 10:00 | permiso | DENEGADO | p00=22222 | rol'
  ].join('\n') + '\n';

  const r = N.resumirIncidencias(log, HOY);
  assert.equal(r.total, 4);
  assert.equal(r.delDia, 3, 'solo cuentan las líneas del día');
  assert.equal(r.incidenciasDelDia, 2, 'el intento fallido y la acción denegada del día');
  assert.equal(r.ultima, '12/09/2026 10:00 | permiso | DENEGADO | p00=22222 | rol',
    'la última línea del registro es la más reciente escrita');
  assert.equal(r.detalle.length, 2, 'el detalle del día tiene las dos incidencias');
  assert.equal(N.resumirIncidencias('', HOY).total, 0);
  assert.equal(N.resumirIncidencias('   \n\n', HOY).incidenciasDelDia, 0);
});

test('el detalle de incidencias se limita a las 10 últimas', () => {
  const lineas = [];
  for (let i = 1; i <= 15; i++) {
    lineas.push(HOY + ' 08:00 | permiso | DENEGADO | p00=' + i + ' | rol');
  }
  const r = N.resumirIncidencias(lineas.join('\n'), HOY);
  assert.equal(r.incidenciasDelDia, 15);
  assert.equal(r.detalle.length, 10, 'no se vuelca el log entero en pantalla');
  assert.match(r.detalle[9], /p00=15/, 'el detalle conserva las más recientes');
});

test('informa la última escritura confirmada de la sesión', () => {
  assert.equal(E.ultimaModificacion(null), '');
  assert.equal(E.ultimaModificacion({ estado: {} }), '');

  const t1 = new Date(2026, 8, 13, 10, 5).getTime();
  const t2 = new Date(2026, 8, 13, 11, 30).getTime();
  const almacen = {
    estado: {
      'averias.json': { ultimaModificacion: t1 },
      'despacho.json': { ultimaModificacion: t2 },
      'central.json': { ultimaModificacion: null }
    }
  };
  assert.equal(E.ultimaModificacion(almacen), N.marcaAhora(new Date(t2)),
    'toma la marca más reciente, no la última del objeto');
});

// ===========================================================================
// 4. Lectura del log desde el almacén
// ===========================================================================
test('el almacén lee el log de la aplicación y tolera que no exista', async () => {
  const archivos = new Map([['incidencias.log', new ArchivoFalso('incidencias.log',
    HOY + ' 09:00 | sesion | intento fallido | p00=999 | credencial\n')]]);
  const almacen = A.crearAlmacen(new CarpetaFalsa(archivos));
  await almacen.cargar();

  const texto = await almacen.leerIncidencias();
  assert.match(texto, /intento fallido/);
  assert.equal(N.resumirIncidencias(texto, HOY).incidenciasDelDia, 1);

  // Sin el archivo en disco: devuelve cadena vacía, no rompe el diagnóstico.
  const sinLog = A.crearAlmacen(new CarpetaFalsa(new Map()));
  await sinLog.cargar();
  assert.equal(await sinLog.leerIncidencias(), '');
});
