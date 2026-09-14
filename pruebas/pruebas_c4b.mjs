/*
 * GGTO-v1 · pruebas/pruebas_c4b.mjs
 * Pruebas de la RUTA CONTROLADA de los PDF del despacho (CU-17, RF-10; D-27,
 * D-67; RNF-11): el PDF se guarda en `C:\GGTO\despachos` y no en la carpeta de
 * Descargas, con verificación por relectura; las reemisiones del mismo día
 * conservan la versión anterior (CU-17, flujo 6a).
 *   Ejecutar:  node --test pruebas/pruebas_c4b.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(aqui, '..', 'app', 'js');

// --- Simulación de la File System Access API, con bytes --------------------
const aBytes = (datos) => (datos instanceof Uint8Array ? datos : new TextEncoder().encode(String(datos)));

class ArchivoFalso {
  constructor(nombre, contenido) {
    this.name = nombre;
    this.bytes = aBytes(contenido === undefined ? '' : contenido);
    this.lastModified = 1000;
  }
  get size() { return this.bytes.length; }
  async text() { return new TextDecoder().decode(this.bytes); }
  async arrayBuffer() { return this.bytes.slice().buffer; }
}

class EscrituraFalsa {
  // createWritable() sin keepExistingData trunca el archivo: se reemplaza entero.
  constructor(archivo) { this.archivo = archivo; this.base = new Uint8Array(0); }
  async write(datos) { this.base = aBytes(datos); return undefined; }
  async seek() { return undefined; }
  async truncate(t) { this.base = this.base.slice(0, t === undefined ? 0 : t); return undefined; }
  async close() { this.archivo.bytes = this.base; this.archivo.lastModified += 1; }
}

class HandleFalso {
  constructor(archivo) { this.archivo = archivo; }
  async getFile() { return this.archivo; }
  async createWritable() { return new EscrituraFalsa(this.archivo); }
}

class CarpetaFalsa {
  constructor(archivos) { this.archivos = archivos || new Map(); }
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
  async removeEntry(nombre) { this.archivos.delete(nombre); }
  keys() {
    const nombres = Array.from(this.archivos.keys());
    let i = 0;
    return { next: async () => (i < nombres.length ? { value: nombres[i++], done: false } : { value: undefined, done: true }) };
  }
}

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
const PDF = require(path.join(app, 'pdf.js'));
const jspdf = require(path.join(aqui, '..', 'app', 'lib', 'jspdf.umd.min.js'));

// `doc.save` escribe en disco: se envuelve la clase para interceptarlo y poder
// comprobar cuándo la página cae en la descarga (fuera de la ruta controlada).
// Los métodos reales de jsPDF se siguen usando (el PDF es de verdad).
const descargas = [];
function jsPDFEspia(opciones) {
  const real = new jspdf.jsPDF(opciones);
  return new Proxy(real, {
    get(objetivo, prop) {
      if (prop === 'save') return (nombre) => { descargas.push(nombre); };
      const valor = objetivo[prop];
      return typeof valor === 'function' ? valor.bind(objetivo) : valor;
    }
  });
}
globalThis.jspdf = { jsPDF: jsPDFEspia };

const HOY = '13/09/2026';
const BLOQUE = {
  cuadrilla: { id: 'C1', nombre: 'Cuadrilla 1' },
  asignaciones: [{
    caso: { id_averia: 'A-1', telefono: '4241234567', contacto: 'Ana', nombre: 'Abonado Uno',
      direccion: 'CALLE 1', plan: 'ABA', fat: 'FAT1', serial: 'S1', ultimo_comentario: 'comentario' },
    motivo: 'reparación'
  }]
};

const DATOS_ARCHIVOS = new Map([['averias.json', new ArchivoFalso('averias.json', '[]\n')]]);

async function almacenConSalidas(archivosDespachos) {
  const carpetaDespachos = new CarpetaFalsa(archivosDespachos || new Map());
  const almacen = A.crearAlmacen(new CarpetaFalsa(DATOS_ARCHIVOS));
  await almacen.cargar();
  await almacen.autorizarDespachos(carpetaDespachos);
  almacen.carpetaDespachosFalsa = carpetaDespachos;
  return almacen;
}

const CTX = (almacen) => ({
  sesion: { P00: '12345' },
  almacen: almacen,
  modoDescarga: () => false,
  registrarLog: (linea) => { CTX.log.push(linea); },
  avisar: (msg, tipo) => { CTX.avisos.push({ msg: msg, tipo: tipo }); },
  limpiar: () => {},
  texto: () => ({ appendChild() {}, setAttribute() {}, textContent: '' })
});
CTX.log = [];
CTX.avisos = [];

// ===========================================================================
// 1. Nombre del archivo y reconocimiento en la ruta controlada
// ===========================================================================
test('la ruta controlada es C:\\GGTO\\despachos y el nombre del PDF es el acordado', () => {
  assert.equal(N.CONST.RUTA_DESPACHOS, 'C:\\GGTO\\despachos');
  assert.equal(PDF.nombreArchivo(BLOQUE, HOY), 'Despacho_Cuadrilla_C1_20260913.pdf');
  assert.equal(PDF.nombreArchivo(BLOQUE, HOY, 1), 'Despacho_Cuadrilla_C1_20260913.pdf');
  assert.equal(PDF.nombreArchivo(BLOQUE, HOY, 2), 'Despacho_Cuadrilla_C1_20260913_r2.pdf');

  assert.equal(N.esSalidaDespacho('Despacho_Cuadrilla_C1_20260913.pdf'), true);
  assert.equal(N.esSalidaDespacho('Despacho_Cuadrilla_C1_20260913_r3.pdf'), true);
  assert.equal(N.esSalidaDespacho('averias.json'), false);
  assert.equal(N.esSalidaDespacho('Despacho_Cuadrilla_C1.pdf'), false);
});

// ===========================================================================
// 2. Escritura en la ruta controlada con verificación por relectura
// ===========================================================================
test('guarda el PDF en C:\\GGTO\\despachos y lo verifica releyéndolo', async () => {
  const almacen = await almacenConSalidas();
  const armado = PDF.construirPDF(BLOQUE, HOY, 1, { jsPDFClase: jspdf.jsPDF });
  const bytes = armado.doc.output('arraybuffer');

  const res = await almacen.guardarSalida('Despacho_Cuadrilla_C1_20260913.pdf', bytes);
  assert.equal(res.verificado, true, 'la relectura debe coincidir con lo escrito');
  assert.equal(res.ruta, 'C:\\GGTO\\despachos');
  assert.ok(res.bytes > 1000, 'el PDF tiene contenido');
  assert.equal(res.tamano, res.bytes, 'el tamaño en disco coincide con lo escrito');

  const guardado = almacen.carpetaDespachosFalsa.archivos.get('Despacho_Cuadrilla_C1_20260913.pdf');
  assert.ok(guardado, 'el archivo está en la ruta controlada');
  assert.equal(guardado.bytes.length, bytes.byteLength);
  // Y no se escribió en la carpeta de datos.
  assert.equal(DATOS_ARCHIVOS.has('Despacho_Cuadrilla_C1_20260913.pdf'), false);
});

test('sin la ruta controlada autorizada no se escribe nada (tipo sinDespachos)', async () => {
  const almacen = A.crearAlmacen(new CarpetaFalsa(DATOS_ARCHIVOS));
  await almacen.cargar();
  await assert.rejects(
    () => almacen.guardarSalida('Despacho_Cuadrilla_C1_20260913.pdf', 'x'),
    (e) => e.tipo === 'sinDespachos' && /despachos/.test(e.message)
  );
});

test('si la relectura no coincide, la escritura se marca como no verificada', async () => {
  const almacen = await almacenConSalidas();
  const carpeta = almacen.carpetaDespachosFalsa;
  const original = carpeta.getFileHandle.bind(carpeta);
  // Al releer, se altera el contenido en disco: la verificación debe fallar.
  carpeta.getFileHandle = async (nombre, opciones) => {
    const h = await original(nombre, opciones);
    if (!opciones) {
      const archivo = carpeta.archivos.get(nombre);
      if (archivo && archivo.bytes.length) archivo.bytes[0] = archivo.bytes[0] ^ 0xff;
    }
    return h;
  };
  await assert.rejects(
    () => almacen.guardarSalida('Despacho_Cuadrilla_C1_20260913.pdf', 'contenido'),
    (e) => e.tipo === 'verificacion' && /no coincide/.test(e.message)
  );
});

test('lista solo los PDF de la ruta controlada, con su tamaño', async () => {
  const archivos = new Map([
    ['Despacho_Cuadrilla_C1_20260913.pdf', new ArchivoFalso('Despacho_Cuadrilla_C1_20260913.pdf', 'pdf1')],
    ['Despacho_Cuadrilla_C2_20260913_r2.pdf', new ArchivoFalso('Despacho_Cuadrilla_C2_20260913_r2.pdf', 'pdf2')],
    ['notas.txt', new ArchivoFalso('notas.txt', 'no es un pdf')]
  ]);
  const almacen = await almacenConSalidas(archivos);
  const lista = await almacen.listarSalidas();
  assert.equal(lista.length, 2);
  assert.deepEqual(lista.map((s) => s.nombre).sort(), [
    'Despacho_Cuadrilla_C1_20260913.pdf', 'Despacho_Cuadrilla_C2_20260913_r2.pdf'
  ]);
  assert.equal(lista[0].tamano > 0, true, 'informa el tamaño');
  assert.equal(lista[0].ruta, 'C:\\GGTO\\despachos');
});

// ===========================================================================
// 3. Generación del PDF desde la interfaz (CU-17)
// ===========================================================================
test('generar guarda en la ruta controlada, registra la ruta y NO descarga (D-27)', async () => {
  const almacen = await almacenConSalidas();
  const ctx = CTX(almacen);
  ctx.almacen = almacen;
  const antes = descargas.length / 1;
  descargas.length = 0;
  CTX.log.length = 0;

  PDF.generar(ctx, BLOQUE, HOY, 1);
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(descargas.length, 0, 'no debe caer en la carpeta de Descargas');
  const guardado = almacen.carpetaDespachosFalsa.archivos.get('Despacho_Cuadrilla_C1_20260913.pdf');
  assert.ok(guardado, 'el PDF quedó en C:\\GGTO\\despachos');
  const linea = CTX.log.join('\n');
  assert.match(linea, /ruta=C:\\GGTO\\despachos\\Despacho_Cuadrilla_C1_20260913\.pdf/);
  assert.match(linea, /ENTREGA PDF/);
  assert.equal(antes, 0);
});

test('una reemisión del mismo día conserva la versión anterior (CU-17, 6a)', async () => {
  const almacen = await almacenConSalidas();
  const ctx = CTX(almacen);
  descargas.length = 0;

  PDF.generar(ctx, BLOQUE, HOY, 1);
  await new Promise((r) => setTimeout(r, 60));
  PDF.generar(ctx, BLOQUE, HOY, 1);
  await new Promise((r) => setTimeout(r, 60));

  const archivos = Array.from(almacen.carpetaDespachosFalsa.archivos.keys()).sort();
  assert.deepEqual(archivos, [
    'Despacho_Cuadrilla_C1_20260913.pdf',
    'Despacho_Cuadrilla_C1_20260913_r2.pdf'
  ]);
  assert.equal(descargas.length, 0);
});

test('sin ruta controlada autorizada, la página descarga y lo advierte', async () => {
  const almacen = A.crearAlmacen(new CarpetaFalsa(DATOS_ARCHIVOS));
  await almacen.cargar();
  const ctx = CTX(almacen);
  descargas.length = 0;
  CTX.avisos.length = 0;

  PDF.generar(ctx, BLOQUE, HOY, 1);
  await new Promise((r) => setTimeout(r, 30));

  assert.deepEqual(descargas, ['Despacho_Cuadrilla_C1_20260913.pdf'],
    'sin autorización el archivo se descarga…');
  const aviso = CTX.avisos.map((a) => a.msg).join(' ');
  assert.match(aviso, /NO en la ruta controlada/, '…y la página lo advierte expresamente');
  assert.match(aviso, /C:\\GGTO\\despachos/);
  assert.equal(CTX.log.join(' ').includes('ruta=DESCARGA'), true, 'queda registrado en el log');
});

// ===========================================================================
// 4. Control documental del día (CU-17, D-27, D-68)
//    El estado es de SESIÓN: no se persiste y el soporte oficial es el papel.
// ===========================================================================
const OPERADOR = '12345';

test('el control documental arranca con todas las cuadrillas pendientes de entrega', () => {
  const c = N.controlVacio(HOY, ['C1', 'C2', 'C3']);
  const r = N.controlResumen(c);
  assert.equal(r.total, 3);
  assert.equal(r.cerrado, false);
  assert.deepEqual(r.sinEntregar, ['C1', 'C2', 'C3']);
  assert.equal(r.mensaje, 'Pendiente de entrega: C1, C2, C3');
  assert.equal(N.controlResumen(N.controlVacio(HOY, [])).cerrado, false,
    'un día sin cuadrillas no se da por cerrado');
});

test('la secuencia entrega → recogida → destrucción cierra el día (CA-4, CA-5, CA-5b)', () => {
  let c = N.controlVacio(HOY, ['C1', 'C2']);

  c = N.controlEntregar(c, 'C1', { fecha_hora: '13/09/2026 10:05', operador: OPERADOR, receptor: 'Jefe C1', copias: 1 });
  c = N.controlEntregar(c, 'C2', { fecha_hora: '13/09/2026 10:06', operador: OPERADOR, copias: 1 });
  let r = N.controlResumen(c);
  assert.equal(r.entregadas, 2);
  assert.equal(r.mensaje, 'Faltan hojas: C1, C2', 'tras entregar, falta recoger');
  assert.equal(c.cuadrillas.C1.entrega.receptor, 'Jefe C1', 'la entrega asienta el receptor');

  c = N.controlRecoger(c, 'C1', { fecha_hora: '13/09/2026 18:10', operador: OPERADOR, hojas: 1 });
  c = N.controlRecoger(c, 'C2', { fecha_hora: '13/09/2026 18:11', operador: OPERADOR, hojas: 1 });
  r = N.controlResumen(c);
  assert.equal(r.recogidas, 2);
  assert.equal(r.mensaje, 'Pendiente de destruir: 2 hoja(s)', 'tras recoger, falta destruir');
  assert.equal(r.cerrado, false, 'recoger no cierra el día');

  c = N.controlDestruir(c, 'C1', { fecha_hora: '13/09/2026 18:12', operador: OPERADOR, hojas: 1 });
  assert.equal(N.controlResumen(c).cerrado, false, 'con una cuadrilla sin destruir no cierra');
  c = N.controlDestruir(c, 'C2', { fecha_hora: '13/09/2026 18:13', operador: OPERADOR, hojas: 1 });
  r = N.controlResumen(c);
  assert.equal(r.destruidas, 2);
  assert.equal(r.cerrado, true);
  assert.equal(r.mensaje, 'Hojas destruidas: 2 de 2 cuadrillas');
  assert.equal(c.cuadrillas.C2.destruccion.hojas, 1);
});

test('las transiciones no mutan el estado anterior (el bloque puede repintarse)', () => {
  const inicial = N.controlVacio(HOY, ['C1']);
  const trasEntrega = N.controlEntregar(inicial, 'C1', { fecha_hora: 'x', operador: OPERADOR });
  assert.equal(inicial.cuadrillas.C1.entrega, null, 'el estado original queda intacto');
  assert.ok(trasEntrega.cuadrillas.C1.entrega, 'el nuevo estado sí lo lleva');
  assert.notEqual(inicial, trasEntrega);
});

test('una hoja no entregada se puede justificar y así el día cierra (flujo 7a)', () => {
  let c = N.controlVacio(HOY, ['C1', 'C2']);
  c = N.controlEntregar(c, 'C1', { fecha_hora: 'x', operador: OPERADOR });
  c = N.controlRecoger(c, 'C1', { fecha_hora: 'x', operador: OPERADOR, hojas: 1 });
  c = N.controlDestruir(c, 'C1', { fecha_hora: 'x', operador: OPERADOR, hojas: 1 });
  assert.equal(N.controlResumen(c).cerrado, false, 'C2 todavía bloquea');
  c = N.controlJustificar(c, 'C2', { fecha_hora: '13/09/2026 19:00', operador: OPERADOR, motivo: 'hoja no entregada' });
  const r = N.controlResumen(c);
  assert.deepEqual(r.sinEntregar, [], 'la justificada ya no bloquea');
  assert.deepEqual(r.justificadas, ['C2']);
  assert.equal(r.cerrado, true, 'con la falta justificada el control puede cerrarse');
  assert.match(r.mensaje, /justificada/);
});

test('destruir sin haber entregado no da el día por cerrado (orden de los asientos)', () => {
  let c = N.controlVacio(HOY, ['C1']);
  c = N.controlDestruir(c, 'C1', { fecha_hora: 'x', operador: OPERADOR, hojas: 1 });
  const r = N.controlResumen(c);
  assert.equal(r.cerrado, false);
  assert.deepEqual(r.sinEntregar, ['C1'], 'sin entrega sigue pendiente de entrega');
  assert.deepEqual(r.sinDestruir, []);
});
