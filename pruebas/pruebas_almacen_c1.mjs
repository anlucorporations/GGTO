/*
 * GGTO-v1 · pruebas/pruebas_almacen_c1.mjs
 * Pruebas del almacén (app/js/almacen.js) en Node con la File System Access API
 * simulada: escritura verificada con .bak previo y 10 versiones, relectura
 * comparada, detección de conflicto (D-41) e historial append-only (D-56).
 *   Ejecutar:  node --test pruebas/pruebas_almacen_c1.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));

// --- Simulación mínima de la File System Access API -------------------------
class ArchivoFalso {
  constructor(nombre, contenido) {
    this.name = nombre;
    this.contenido = contenido;
    this.lastModified = 1000;
  }
  async text() { return this.contenido; }
}

class EscrituraFalsa {
  constructor(archivo) {
    this.archivo = archivo;
    this.base = archivo.contenido;
    this.posicion = 0;
  }
  async write(datos) {
    const texto = typeof datos === 'string' ? datos : String(datos);
    const antes = this.base.slice(0, this.posicion);
    const despues = this.base.slice(this.posicion + texto.length);
    this.base = antes + texto + despues;
    return undefined;
  }
  async seek(p) { this.posicion = p; return undefined; }
  async truncate(t) { this.base = this.base.slice(0, t === undefined ? this.posicion : t); return undefined; }
  async close() {
    this.archivo.contenido = this.base;
    this.archivo.lastModified += 1;
  }
}

class HandleFalso {
  constructor(archivo) { this.archivo = archivo; }
  async getFile() { return this.archivo; }
  async createWritable() { return new EscrituraFalsa(this.archivo); }
}

class CarpetaFalsa {
  constructor(archivos) {
    this.archivos = archivos; // Map nombre -> ArchivoFalso
    this.eliminados = [];
  }
  async getFileHandle(nombre, opciones) {
    if (!this.archivos.has(nombre)) {
      if (!opciones || !opciones.create) {
        const e = new Error('no encontrado');
        e.name = 'NotFoundError';
        throw e;
      }
      this.archivos.set(nombre, new ArchivoFalso(nombre, ''));
    }
    return new HandleFalso(this.archivos.get(nombre));
  }
  async removeEntry(nombre) {
    this.archivos.delete(nombre);
    this.eliminados.push(nombre);
  }
  keys() {
    const nombres = Array.from(this.archivos.keys());
    let i = 0;
    return { next: async () => (i < nombres.length ? { value: nombres[i++], done: false } : { value: undefined, done: true }) };
  }
}

// El módulo se carga como script de navegador: necesita window y document.
globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ href: '', download: '', click() {}, setAttribute() {}, style: {} }),
  body: { appendChild() {}, removeChild() {} }
};
globalThis.URL.createObjectURL = () => 'blob:prueba';
globalThis.URL.revokeObjectURL = () => {};
globalThis.Blob = class { constructor(partes) { this.partes = partes; } };

const N = require(path.join(aqui, '..', 'app', 'js', 'nucleo.js'));
globalThis.GGTO_NUCLEO = N;
require(path.join(aqui, '..', 'app', 'js', 'almacen.js'));
// almacen.js es un script de navegador: publica sus funciones en GGTO_ALMACEN.
const A = globalThis.GGTO_ALMACEN;

// ---------------------------------------------------------------------------
// 1. Escritura verificada del maestro con .bak previo (D-42, RNF-15)
// ---------------------------------------------------------------------------
test('guarda el maestro con .bak previo, relectura comparada y limpieza de las 10 últimas', async () => {
  const archivos = new Map();
  archivos.set('averias.json', new ArchivoFalso('averias.json', '[]\n'));
  archivos.set('tecnicos.json', new ArchivoFalso('tecnicos.json', 'null\n'));
  const almacen = A.crearAlmacen(new CarpetaFalsa(archivos));

  await almacen.cargar();
  const casos = [{ id_averia: 'MAN-0001', status: 'GESTION' }];
  await almacen.guardarArchivo('averias.json', casos, {});

  assert.equal(archivos.get('averias.json').contenido, N.serializarJSON(casos));
  const baks = Array.from(archivos.keys()).filter((n) => /^averias_\d{4}-\d{2}-\d{2}_\d{4}\.bak$/.test(n));
  assert.equal(baks.length, 1, 'se creó una copia .bak con la marca de fecha y hora');
  assert.equal(archivos.get(baks[0]).contenido, '[]\n', 'el .bak conserva el contenido anterior');
  assert.deepEqual(almacen.datos['averias.json'], casos);
});

// ---------------------------------------------------------------------------
// 2. Detección de conflicto (D-41, RNF-14)
// ---------------------------------------------------------------------------
test('bloquea el guardado cuando la marca de modificación cambió desde la carga', async () => {
  const archivos = new Map();
  archivos.set('averias.json', new ArchivoFalso('averias.json', '[]\n'));
  const almacen = A.crearAlmacen(new CarpetaFalsa(archivos));
  await almacen.cargar();

  // Otra ventana modifica el archivo después de la carga
  archivos.get('averias.json').contenido = '[{"id_averia":"2026-9999"}]\n';
  archivos.get('averias.json').lastModified += 50;

  const nuevos = [{ id_averia: 'MAN-0001' }];
  await assert.rejects(
    () => almacen.guardarArchivo('averias.json', nuevos, {}),
    (e) => e.tipo === 'conflicto' && /Recargue o sobrescriba/.test(e.message)
  );
  assert.equal(archivos.get('averias.json').contenido, '[{"id_averia":"2026-9999"}]\n',
    'el archivo ajeno NO se sobrescribe');

  // Con la decisión consciente de sobrescribir, el guardado procede
  await almacen.guardarArchivo('averias.json', nuevos, { sobrescribir: true });
  assert.equal(archivos.get('averias.json').contenido, N.serializarJSON(nuevos));
});

// ---------------------------------------------------------------------------
// 3. Historial append-only (D-56, RNF-09)
// ---------------------------------------------------------------------------
test('agrega líneas al historial sin borrar ni reescribir las anteriores', async () => {
  const archivos = new Map();
  const inicial = '{"fecha_hora":"13/09/2026 09:10","operador":"12345","id_averia":"A-1",' +
    '"campo":"clase","valor_anterior":"CNS","valor_nuevo":"REP","accion":"edicion"}\n';
  archivos.set('historial.jsonl', new ArchivoFalso('historial.jsonl', inicial));
  const almacen = A.crearAlmacen(new CarpetaFalsa(archivos));
  await almacen.cargar();
  assert.equal(almacen.historialTexto, inicial);

  const linea = N.lineaHistorial({
    fecha_hora: '13/09/2026 10:05', operador: '12345', id_averia: 'A-1', campo: 'status',
    valor_anterior: 'PEND', valor_nuevo: 'CERRADO', accion: 'cierre'
  });
  const r = await almacen.agregarHistorial([linea]);
  assert.equal(r.agregadas, 1);
  assert.equal(r.verificadas, 1);

  const final = archivos.get('historial.jsonl').contenido;
  assert.ok(final.startsWith(inicial), 'las líneas anteriores se conservan íntegras');
  assert.equal(final, inicial + linea + '\n');
  assert.equal(final.split('\n').filter(Boolean).length, 2);
  assert.equal(almacen.datos['historial.jsonl'].length, 2);
});

// ---------------------------------------------------------------------------
// 4. Creación de la estructura inicial vacía (sin datos inventados)
// ---------------------------------------------------------------------------
test('crea los 10 archivos de trabajo con estructura válida y vacíos de casos', async () => {
  const archivos = new Map();
  const almacen = A.crearAlmacen(new CarpetaFalsa(archivos));
  const r = await almacen.crearEstructura(null);
  assert.equal(r.creados.length, 10);
  assert.deepEqual(Array.from(archivos.keys()).sort(), A.NOMBRES.slice().sort());
  assert.equal(archivos.get('averias.json').contenido, '[]\n');
  assert.equal(archivos.get('historial.jsonl').contenido, '');
  const central = JSON.parse(archivos.get('central.json').contenido);
  assert.equal(central.nombre_central, 'FRANCISCO SALIAS');
  assert.equal(central.central, '2324X');
  assert.equal(central.area, 'AREA 4');
  const estructura = JSON.parse(archivos.get('estructura.json').contenido);
  assert.equal(estructura.columnas_esperadas, 80);
  assert.equal(estructura.separador, ';');
});

// ---------------------------------------------------------------------------
// 5. Lectura tolerante: archivos ausentes se informan, no rompen la carga
// ---------------------------------------------------------------------------
test('informa los archivos ausentes sin interrumpir la carga', async () => {
  const archivos = new Map();
  archivos.set('tecnicos.json', new ArchivoFalso('tecnicos.json', '[]\n'));
  const almacen = A.crearAlmacen(new CarpetaFalsa(archivos));
  const res = await almacen.cargar();
  assert.equal(res.archivos.length, 10);
  const faltantes = res.archivos.filter((a) => !a.existe).map((a) => a.archivo);
  assert.equal(faltantes.length, 9);
  assert.ok(faltantes.includes('averias.json'));
  assert.equal(almacen.datos['tecnicos.json'].length, 0);
});

// ---------------------------------------------------------------------------
// 6. Rotación: solo se conservan las 10 últimas versiones .bak
// ---------------------------------------------------------------------------
test('expide las versiones .bak más antiguas para conservar las 10 últimas', async () => {
  const archivos = new Map();
  archivos.set('averias.json', new ArchivoFalso('averias.json', '[]\n'));
  for (let i = 1; i <= 12; i++) {
    const nombre = 'averias_2026-09-' + String(i).padStart(2, '0') + '_0900.bak';
    archivos.set(nombre, new ArchivoFalso(nombre, '[]\n'));
  }
  archivos.set('central.json', new ArchivoFalso('central.json', '{}'));
  const almacen = A.crearAlmacen(new CarpetaFalsa(archivos));
  await almacen.cargar();

  const antes = Array.from(archivos.keys()).filter((n) => n.endsWith('.bak')).length;
  assert.equal(antes, 12);
  await almacen.guardarArchivo('averias.json', [{ id_averia: 'X' }], {});
  const despues = Array.from(archivos.keys()).filter((n) => n.endsWith('.bak'));
  assert.ok(despues.length <= 10, 'quedan como máximo 10 versiones .bak, hay ' + despues.length);
  assert.ok(despues.includes('averias_2026-09-12_0900.bak'), 'las más recientes se conservan');
  assert.ok(!despues.includes('averias_2026-09-01_0900.bak'), 'la más antigua se expide');
  assert.ok(archivos.has('central.json'), 'los archivos que no son .bak no se tocan');
});

// ---------------------------------------------------------------------------
// 7. CSV de ingesta de la carpeta de datos (D-78, D-79)
// ---------------------------------------------------------------------------
test('lista solo los .csv de la carpeta de datos y lee el elegido', async () => {
  const archivos = new Map();
  archivos.set('averias.json', new ArchivoFalso('averias.json', '[]\n'));
  archivos.set('historial.jsonl', new ArchivoFalso('historial.jsonl', ''));
  archivos.set('detalle_averias_gpon 12_09_2026.csv',
    new ArchivoFalso('detalle_averias_gpon 12_09_2026.csv', 'a;b\n1;2\n'));
  archivos.set('OTRO.CSV', new ArchivoFalso('OTRO.CSV', 'x'));
  archivos.set('notas.txt', new ArchivoFalso('notas.txt', 'hola'));
  archivos.set('averias_2026-09-15_0900.bak', new ArchivoFalso('averias_2026-09-15_0900.bak', '[]'));
  const almacen = A.crearAlmacen(new CarpetaFalsa(archivos));
  await almacen.cargar();

  const lista = await almacen.listarCSV();
  assert.deepEqual(lista.map((f) => f.nombre).sort(),
    ['OTRO.CSV', 'detalle_averias_gpon 12_09_2026.csv'],
    'solo los .csv de la carpeta, sin distinguir mayúsculas ni confundir .bak o .txt');
  const principal = lista.filter((f) => f.nombre === 'detalle_averias_gpon 12_09_2026.csv')[0];
  assert.equal(principal.tamano, 8, 'informa del tamaño del archivo');
  assert.equal(principal.ruta, N.CONST.RUTA_DATOS);
  assert.ok('modificado' in principal, 'informa de la fecha de modificación');

  assert.equal(await almacen.leerTextoDeDatos('detalle_averias_gpon 12_09_2026.csv'), 'a;b\n1;2\n',
    'lee el texto del CSV elegido sin pasar por el selector del navegador');
  await assert.rejects(() => almacen.leerTextoDeDatos('no-existe.csv'),
    'un archivo que no está en la carpeta no se puede leer');
});

test('sin carpeta autorizada no hay lista de CSV y la lectura se rechaza', async () => {
  const almacen = A.crearAlmacen(new CarpetaFalsa(new Map()));
  almacen.carpeta = null;
  assert.deepEqual(await almacen.listarCSV(), [],
    'sin carpeta de datos la lista es vacía (no se rompe la INGESTA)');
  await assert.rejects(() => almacen.leerTextoDeDatos('x.csv'), /autorizada/,
    'sin carpeta la lectura se rechaza con un mensaje claro');
});
