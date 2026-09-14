/*
 * GGTO-v1 · pruebas/pruebas_c7.mjs
 * Pruebas del ciclo C7 (CU-21, RF-24; RNF-15, RNF-16; D-42, D-49, D-56):
 *   - copia de cierre de los 10 archivos en C:\GGTO\respaldo con el maestro
 *     fechado con hora, verificada por relectura y con el historial íntegro;
 *   - restauración desde una copia fechada con respaldo previo y detección de
 *     conflicto (D-41);
 *   - funciones puras del bloque RESPALDO (validación e impacto).
 *   Ejecutar:  node --test pruebas/pruebas_c7.mjs
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
    /** Si se define, corrompe el contenido al escribir ese nombre. */
    this.corromper = null;
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
    if (this.corromper && this.corromper === nombre) {
      return new HandleFalso(this.archivos.get(nombre));
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
const A = globalThis.GGTO_ALMACEN;
const R = require(path.join(aqui, '..', 'app', 'js', 'respaldo.js'));

// --- Utilidades -------------------------------------------------------------
const CASO = (id, status, extra) => Object.assign({
  id_averia: id, status: status, clase: 'REP', nivel: 'N1', tipo_abonado: 'RES'
}, extra || {});

/** Carpeta de datos con los 10 archivos; `casos` y `historial` opcionales. */
function datosIniciales(casos, historial) {
  const archivos = new Map();
  const base = N.estructurasIniciales();
  Object.keys(base).forEach((nombre) => {
    const contenido = nombre === 'historial.jsonl' ? '' : N.serializarJSON(base[nombre]);
    archivos.set(nombre, new ArchivoFalso(nombre, contenido));
  });
  if (casos) archivos.set('averias.json', new ArchivoFalso('averias.json', N.serializarJSON(casos)));
  if (historial) archivos.set('historial.jsonl', new ArchivoFalso('historial.jsonl', historial));
  return archivos;
}

const LINEA = (id, campo, antes, despues) => N.lineaHistorial({
  fecha_hora: '13/09/2026 09:10', operador: '12345', id_averia: id, campo: campo,
  valor_anterior: antes, valor_nuevo: despues, accion: 'edicion'
}) + '\n';

/** Almacén con la carpeta de datos y la de respaldo ya autorizadas. */
async function almacenConRespaldo(archivosDatos, archivosRespaldo) {
  const carpetaRespaldo = new CarpetaFalsa(archivosRespaldo || new Map());
  const almacen = A.crearAlmacen(new CarpetaFalsa(archivosDatos));
  await almacen.cargar();
  await almacen.autorizarRespaldo(carpetaRespaldo);
  almacen.carpetaRespaldoFalsa = carpetaRespaldo;
  return almacen;
}

// ===========================================================================
// 1. Bloque RESPALDO: validación e impacto (funciones puras)
// ===========================================================================
test('validarCopia rechaza JSON inválido, listas no válidas y copias vacías', () => {
  assert.equal(R.validarCopia('{no json').valida, false);
  assert.equal(R.validarCopia('{"a":1}').valida, false);
  assert.equal(R.validarCopia('[]').valida, false, 'una copia sin casos no es restaurable');

  const sinId = R.validarCopia('[{"status":"PEND"},{"id_averia":"A-1"}]');
  assert.equal(sinId.valida, false);
  assert.ok(sinId.errores.some((e) => /sin id_averia/.test(e)));

  const repetido = R.validarCopia('[{"id_averia":"A-1"},{"id_averia":"A-1"}]');
  assert.equal(repetido.valida, false);
  assert.ok(repetido.errores.some((e) => /repetido/.test(e)));

  const buena = R.validarCopia('[{"id_averia":"A-1"},{"id_averia":"A-2"}]');
  assert.equal(buena.valida, true);
  assert.equal(buena.total, 2);
});

test('resumenRestauracion cuenta el impacto y exige confirmación cuando la copia pierde casos', () => {
  const maestro = [CASO('A-1', 'PEND'), CASO('A-2', 'GESTION'), CASO('A-3', 'CERRADO')];
  const copia = [CASO('A-1', 'PEND'), CASO('A-2', 'CERRADO'), CASO('A-9', 'PEND')];

  const r = R.resumenRestauracion(copia, maestro);
  assert.equal(r.enCopia, 3);
  assert.equal(r.enMaestro, 3);
  assert.equal(r.iguales, 1, 'A-1 no cambia');
  assert.equal(r.distintos, 1, 'A-2 vuelve al estado de la copia');
  assert.equal(r.nuevos, 1, 'A-9 se recuperaría');
  assert.equal(r.soloEnMaestro, 1, 'A-3 se perdería');
  assert.equal(r.requiereConfirmacionEscrita, true);

  const menor = R.resumenRestauracion([CASO('A-1', 'PEND')], maestro);
  assert.equal(menor.pierdeCasos, true, 'una copia con menos casos pierde información');
  assert.equal(menor.requiereConfirmacionEscrita, true);

  const igual = R.resumenRestauracion(maestro.slice(), maestro);
  assert.equal(igual.requiereConfirmacionEscrita, false, 'restaurar lo mismo no exige confirmación escrita');
});

test('las copias de cierre se reconocen por su nombre fechado con hora (D-49)', () => {
  assert.equal(N.esCopiaCierre('averias_2026-09-13_0905.json'), true);
  assert.equal(N.esCopiaCierre('averias_2026-09-13_0905.bak'), false);
  assert.equal(N.esCopiaCierre('despacho.json'), false);
  assert.equal(N.marcaDeCopia('averias_2026-09-13_0905.json'), '13/09/2026 09:05');
  assert.equal(N.marcaDeCopia('averias.json'), '');
  // Dos respaldos del mismo día en minutos distintos no comparten nombre (H-N-08).
  assert.notEqual(N.nombreCopiaCierre(new Date(2026, 8, 13, 9, 5)),
    N.nombreCopiaCierre(new Date(2026, 8, 13, 9, 6)));
});

// ===========================================================================
// 2. Copia de cierre (CU-21, pasos 3 y 4; RNF-16)
// ===========================================================================
test('crea la copia de cierre de los 10 archivos, verificada por relectura y sin cifrar', async () => {
  const casos = [CASO('A-1', 'PEND'), CASO('A-2', 'GESTION')];
  const historial = LINEA('A-1', 'status', 'PEND', 'CERRADO');
  const archivosDatos = datosIniciales(casos, historial);
  const almacen = await almacenConRespaldo(archivosDatos);

  const res = await almacen.guardarCopiaCierre();
  assert.equal(res.verificados, 10, 'se verifican los 10 archivos de trabajo');
  assert.equal(res.total, 10);
  assert.deepEqual(res.fallos, []);
  assert.equal(res.cifrado, false, 'la copia no se cifra (D-49)');
  assert.equal(res.ruta, N.CONST.RUTA_RESPALDO);
  assert.equal(N.esCopiaCierre(res.nombreMaestro), true, 'el maestro se copia fechado con hora');

  const destino = almacen.carpetaRespaldoFalsa.archivos;
  // El maestro va con nombre fechado y su contenido es idéntico al original.
  assert.equal(destino.get(res.nombreMaestro).contenido, N.serializarJSON(casos));
  // Los otros 9 archivos conservan su nombre y su contenido íntegro.
  A.NOMBRES.filter((n) => n !== 'averias.json').forEach((nombre) => {
    assert.ok(destino.has(nombre), 'falta la copia de ' + nombre);
    assert.equal(destino.get(nombre).contenido, archivosDatos.get(nombre).contenido,
      'la copia de ' + nombre + ' debe ser idéntica al original');
  });
  // El historial se copia íntegro, sin truncar (D-56).
  assert.equal(destino.get('historial.jsonl').contenido, historial);
  assert.equal(destino.get('historial.jsonl').contenido.split('\n').filter(Boolean).length, 1);
});

test('informa el fallo cuando un archivo de origen no está disponible', async () => {
  const archivos = datosIniciales([CASO('A-1', 'PEND')], '');
  archivos.delete('flota.json');
  const almacen = await almacenConRespaldo(archivos);

  const res = await almacen.guardarCopiaCierre();
  assert.equal(res.verificados, 9);
  assert.equal(res.fallos.length, 1);
  assert.equal(res.fallos[0].archivo, 'flota.json');
  assert.equal(N.esCopiaCierre(res.nombreMaestro), true);
});

test('marca el respaldo como fallido si la copia releída no coincide con el original', async () => {
  const casos = [CASO('A-1', 'PEND')];
  const almacen = await almacenConRespaldo(datosIniciales(casos, ''));
  const carpeta = almacen.carpetaRespaldoFalsa;
  // Se corrompe el archivo justo después de escribirlo en la carpeta de respaldo.
  const original = carpeta.getFileHandle.bind(carpeta);
  carpeta.getFileHandle = async (nombre, opciones) => {
    const h = await original(nombre, opciones);
    if (nombre !== 'averias.json' && !opciones) {
      const archivo = carpeta.archivos.get(nombre);
      if (archivo && archivo.contenido) archivo.contenido = archivo.contenido + ' ';
    }
    return h;
  };

  const res = await almacen.guardarCopiaCierre();
  assert.ok(res.verificados < 10, 'no se marca como exitoso');
  assert.ok(res.fallos.length > 0);
  assert.ok(res.fallos.some((f) => /no coincide con el original/.test(f.motivo)));
});

test('exige la carpeta de respaldo autorizada antes de copiar', async () => {
  const almacen = A.crearAlmacen(new CarpetaFalsa(datosIniciales([], '')));
  await almacen.cargar();
  await assert.rejects(
    () => almacen.guardarCopiaCierre(),
    (e) => e.tipo === 'sinRespaldo' && /respaldo/.test(e.message)
  );
});

test('dos copias del mismo día no se sobrescriben y se listan de la más nueva a la más antigua', async () => {
  const casos = [CASO('A-1', 'PEND')];
  const previa = 'averias_2026-09-13_0905.json';
  const archivosRespaldo = new Map([[previa, new ArchivoFalso(previa, '[]\n')]]);
  const almacen = await almacenConRespaldo(datosIniciales(casos, ''), archivosRespaldo);

  const res = await almacen.guardarCopiaCierre();
  assert.ok(almacen.carpetaRespaldoFalsa.archivos.has(previa), 'la copia anterior se conserva');

  const copias = await almacen.listarCopiasRespaldo();
  assert.equal(copias.length, 2);
  assert.equal(copias[0].marca >= copias[1].marca, true, 'ordenadas de la más nueva a la más antigua');
  assert.ok(copias.some((c) => c.nombre === res.nombreMaestro));

  const estado = await almacen.estadoRespaldo();
  assert.equal(estado.hay, true);
  assert.equal(estado.autorizada, true);
  assert.equal(estado.total, 2);
  assert.equal(estado.ultima.nombre, copias[0].nombre);
  assert.equal(estado.ruta, N.CONST.RUTA_RESPALDO);
});

test('sin copias informa «Sin respaldos registrados» (flujo 1a)', async () => {
  const almacen = await almacenConRespaldo(datosIniciales([], ''));
  const estado = await almacen.estadoRespaldo();
  assert.equal(estado.hay, false);
  assert.equal(estado.ultima, null);
  assert.deepEqual(estado.copias, []);
});

// ===========================================================================
// 3. Restauración (CU-21, pasos 5 a 7; flujos 6a, 6b y 8b)
// ===========================================================================
test('restaura el maestro desde una copia fechada y respalda el estado anterior (CA-2, CA-7)', async () => {
  const antes = [CASO('A-1', 'PEND'), CASO('A-2', 'GESTION')];
  const copia = [CASO('A-1', 'PEND'), CASO('A-2', 'CERRADO'), CASO('A-3', 'PEND')];
  const nombreCopia = 'averias_2026-09-13_0905.json';
  const archivosRespaldo = new Map([[nombreCopia, new ArchivoFalso(nombreCopia, N.serializarJSON(copia))]]);
  const archivosDatos = datosIniciales(antes, '');
  const almacen = await almacenConRespaldo(archivosDatos, archivosRespaldo);

  const res = await almacen.restaurarCopia(nombreCopia);
  assert.equal(res.casos, 3);
  assert.equal(res.marcaCopia, '13/09/2026 09:05');
  assert.equal(archivosDatos.get('averias.json').contenido, N.serializarJSON(copia),
    'el maestro queda con el contenido de la copia');
  assert.deepEqual(almacen.datos['averias.json'].map((c) => c.id_averia), ['A-1', 'A-2', 'A-3']);
  assert.equal(res.rtoCumplido, true, 'la restauración cabe en el RTO de 1 hora');
  assert.ok(res.inicio && res.fin, 'se registran la hora de inicio y de fin');

  // CA-7: existe un respaldo del estado anterior y coincide con el maestro previo.
  const baks = Array.from(archivosDatos.keys()).filter((n) => /^averias_\d{4}-\d{2}-\d{2}_\d{4}\.bak$/.test(n));
  assert.equal(baks.length, 1, 'se creó el respaldo previo con el protocolo de D-42');
  assert.equal(archivosDatos.get(baks[0]).contenido, N.serializarJSON(antes));
});

test('no reemplaza nada cuando la copia es inválida (flujo 6a)', async () => {
  const antes = [CASO('A-1', 'PEND')];
  const nombre = 'averias_2026-09-13_0905.json';
  const archivosRespaldo = new Map([[nombre, new ArchivoFalso(nombre, '{roto')]]);
  const archivosDatos = datosIniciales(antes, '');
  const almacen = await almacenConRespaldo(archivosDatos, archivosRespaldo);

  await assert.rejects(
    () => almacen.restaurarCopia(nombre),
    (e) => e.tipo === 'copiaInvalida' && /inválido/.test(e.message)
  );
  assert.equal(archivosDatos.get('averias.json').contenido, N.serializarJSON(antes),
    'el maestro conserva sus datos');
});

test('detecta el conflicto de concurrencia y no escribe sin decisión explícita (flujo 8b, D-41)', async () => {
  const antes = [CASO('A-1', 'PEND')];
  const copia = [CASO('A-1', 'CERRADO')];
  const nombre = 'averias_2026-09-13_0905.json';
  const archivosRespaldo = new Map([[nombre, new ArchivoFalso(nombre, N.serializarJSON(copia))]]);
  const archivosDatos = datosIniciales(antes, '');
  const almacen = await almacenConRespaldo(archivosDatos, archivosRespaldo);

  // Otra ventana modifica el maestro después de la carga.
  archivosDatos.get('averias.json').contenido = N.serializarJSON([CASO('A-7', 'PEND')]);
  archivosDatos.get('averias.json').lastModified += 50;

  await assert.rejects(
    () => almacen.restaurarCopia(nombre),
    (e) => e.tipo === 'conflicto' && /Recargue o sobrescriba/.test(e.message)
  );
  assert.equal(archivosDatos.get('averias.json').contenido, N.serializarJSON([CASO('A-7', 'PEND')]),
    'el cambio ajeno no se sobrescribe');

  // Con la decisión consciente de sobrescribir, la restauración procede.
  await almacen.restaurarCopia(nombre, { sobrescribir: true });
  assert.equal(archivosDatos.get('averias.json').contenido, N.serializarJSON(copia));
});
