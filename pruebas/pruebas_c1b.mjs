/*
 * GGTO-v1 · pruebas/pruebas_c1b.mjs
 * Pruebas de las decisiones D-61 y D-64 con node:test.
 *   Ejecutar:  node --test pruebas/pruebas_c1b.mjs
 *
 *  - D-61: campo `rol` de `tecnicos.json` (`Operador` / `Supervisor`, por
 *    defecto `Operador`) y su efecto en la matriz de permisos (D-35/RNF-12).
 *  - D-62: arranque en frío (el primer supervisor nace con rol Supervisor y
 *    `clave_cambio_obligatorio = SI`).
 *  - D-63: `clave_hash` = SHA-256 hexadecimal (64 caracteres) de
 *    `clave_sal + ":" + contraseña` en UTF-8, con sal aleatoria por técnico.
 *  - D-64: rotación de `C:\GGTO\datos\incidencias.log` a 5 MB × 5 archivos,
 *    verificada con el tamaño parametrizado (sin escribir 5 MB reales).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const N = require(path.join(aqui, '..', 'app', 'js', 'nucleo.js'));
const subtle = webcrypto.subtle;

// --- Simulación mínima de la File System Access API (igual que pruebas_almacen_c1) ---
class ArchivoFalso {
  constructor(nombre, contenido) {
    this.name = nombre;
    this.contenido = contenido;
    this.lastModified = 1000;
  }
  get size() { return this.contenido.length; }
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
  async close() { this.archivo.contenido = this.base; this.archivo.lastModified += 1; }
}

class HandleFalso {
  constructor(archivo) { this.archivo = archivo; }
  async getFile() { return this.archivo; }
  async createWritable() { return new EscrituraFalsa(this.archivo); }
}

class CarpetaFalsa {
  constructor(archivos) { this.archivos = archivos; this.eliminados = []; }
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

globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ href: '', download: '', click() {}, setAttribute() {}, style: {} }),
  body: { appendChild() {}, removeChild() {} }
};
globalThis.URL.createObjectURL = () => 'blob:prueba';
globalThis.URL.revokeObjectURL = () => {};
globalThis.Blob = class { constructor(partes) { this.partes = partes; } };

globalThis.GGTO_NUCLEO = N;
require(path.join(aqui, '..', 'app', 'js', 'almacen.js'));
const A = globalThis.GGTO_ALMACEN;

// ---------------------------------------------------------------------------
// 1. D-61: el campo `rol` de tecnicos.json y la matriz de permisos
// ---------------------------------------------------------------------------
test('D-61: el campo rol admite Operador y Supervisor, con Operador por defecto', () => {
  assert.deepEqual(N.CONST.ROLES, ['Operador', 'Supervisor']);
  assert.ok(N.CONST.CAMPOS_TECNICO.includes('rol'), 'el esquema del padrón declara `rol`');

  // Sin campo `rol` (registro heredado) el rol efectivo es Operador.
  assert.equal(N.resolverRol({ P00: '12345' }), 'Operador');
  assert.equal(N.resolverRol({ P00: '12345', rol: '' }), 'Operador');
  assert.equal(N.resolverRol({ P00: '12345', rol: null }), 'Operador');
  assert.equal(N.resolverRol({ P00: '12345', rol: 'desconocido' }), 'Operador');
  assert.equal(N.resolverRol(null), null);

  // Los dos valores del dominio se resuelven tal como los escribe D-61.
  assert.equal(N.resolverRol({ P00: '00001', rol: 'Operador' }), 'Operador');
  assert.equal(N.resolverRol({ P00: '00001', rol: 'Supervisor' }), 'Supervisor');
  // Tolerante a espacios y a minúsculas al leer el archivo.
  assert.equal(N.resolverRol({ P00: '00001', rol: ' supervisor ' }), 'Supervisor');

  // El rol es lo que abre la matriz D-35/RNF-12: solo el supervisor toca padrones.
  assert.equal(N.permite(N.resolverRol({ rol: 'Operador' }), 'config.tecnicos'), false);
  assert.equal(N.permite(N.resolverRol({ rol: 'Supervisor' }), 'config.tecnicos'), true);
  assert.equal(N.permite('Administrador', 'config.tecnicos'), false, 'no hay rol administrador (D-55)');
});

// ---------------------------------------------------------------------------
// 2. D-62: arranque en frío — el primer supervisor del padrón vacío
// ---------------------------------------------------------------------------
test('D-62: el primer supervisor del arranque en frío queda Supervisor y con cambio obligatorio', async () => {
  // El alta desde la página (app.js crearPrimerSupervisor) escribe estos campos.
  const sal = N.generarSal(16, webcrypto);
  const clave = 'Primera2026';
  const primer = {
    nombre: 'Supervisor Inicial',
    cedula: '00000001',
    P00: '00001',
    clave_hash: await N.hashClave(clave, sal, subtle),
    clave_sal: sal,
    clave_fecha_cambio: N.formatearFecha(new Date()),
    clave_cambio_obligatorio: 'SI',
    telefono: '', correo: '', especialidad: '',
    status: 'Activo',
    rol: 'Supervisor'
  };
  assert.equal(N.resolverRol(primer), 'Supervisor');
  assert.equal(primer.clave_cambio_obligatorio, 'SI');
  assert.equal(N.CONST.CAMPOS_TECNICO.every((c) => c in primer || c === 'telefono'), true);

  // Con el padrón vacío no hay sesión posible; al crearse el supervisor, sí.
  const antes = await N.verificarCredencial([], '00001', clave, { subtle });
  assert.equal(antes.ok, false);
  const despues = await N.verificarCredencial([primer], '00001', clave, { subtle });
  assert.equal(despues.ok, true, 'en cuanto existe un supervisor, la sesión se valida contra el padrón');
  assert.equal(despues.exigeCambio, true, 'el arranque en frío obliga a cambiar la contraseña (D-62)');

  // Un segundo técnico creado desde CONFIGURACION sin rol explícito es Operador.
  const segundo = Object.assign({}, primer, { P00: '00002', nombre: 'Ana Gómez' });
  delete segundo.rol;
  assert.equal(N.resolverRol(segundo), 'Operador');
});

// ---------------------------------------------------------------------------
// 3. D-63: formato de la credencial (SHA-256 hex de sal + ":" + contraseña)
// ---------------------------------------------------------------------------
test('D-63: clave_hash es el SHA-256 hexadecimal de clave_sal + ":" + contraseña en UTF-8', async () => {
  const sal = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const clave = 'Clave2026';
  const hash = await N.hashClave(clave, sal, subtle);
  assert.equal(hash.length, 64, '64 caracteres hexadecimales');
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, hash.toLowerCase());

  // Se recalcula a mano el SHA-256 de la cadena exacta `sal + ":" + clave`.
  const esperado = await subtle.digest('SHA-256', new TextEncoder().encode(sal + ':' + clave));
  const hex = Array.from(new Uint8Array(esperado)).map((b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(hash, hex, 'la cadena sellada es `clave_sal + ":" + contraseña` en UTF-8');

  // Caracteres no ASCII: se codifican en UTF-8 (no en Latin-1).
  const conTilde = await N.hashClave('Contraseña2026', sal, subtle);
  const esperadoTilde = await subtle.digest('SHA-256', new TextEncoder().encode(sal + ':Contraseña2026'));
  const hexTilde = Array.from(new Uint8Array(esperadoTilde)).map((b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(conTilde, hexTilde);

  // Sal aleatoria por técnico: mismo password, sal distinta → hash distinto.
  const salA = N.generarSal(16, webcrypto);
  const salB = N.generarSal(16, webcrypto);
  assert.equal(salA.length, 32);
  assert.notEqual(salA, salB);
  const hA = await N.hashClave(clave, salA, subtle);
  const hB = await N.hashClave(clave, salB, subtle);
  assert.notEqual(hA, hB);
  assert.equal(hA, await N.hashClave(clave, salA, subtle), 'determinista con la misma sal');
});

// ---------------------------------------------------------------------------
// 4. D-64: nombres del log de accesos y su rotación a 5 MB × 5 archivos
// ---------------------------------------------------------------------------
test('D-64: el log de accesos se nombra incidencias.log e incidencias.N.log (1..5)', () => {
  assert.equal(N.CONST.ARCHIVO_INCIDENCIAS, 'incidencias.log');
  assert.equal(N.CONST.LOG_MAX_BYTES, 5 * 1024 * 1024);
  assert.equal(N.CONST.LOG_MAX_ARCHIVOS, 5);

  assert.equal(N.nombreIncidencias(0), 'incidencias.log');
  assert.equal(N.nombreIncidencias(1), 'incidencias.1.log');
  assert.equal(N.nombreIncidencias(5), 'incidencias.5.log');
  assert.equal(N.nombreIncidencias(6), 'incidencias.6.log');

  assert.equal(N.indiceIncidencias('incidencias.log'), 0);
  assert.equal(N.indiceIncidencias('incidencias.1.log'), 1);
  assert.equal(N.indiceIncidencias('incidencias.5.log'), 5);
  assert.equal(N.indiceIncidencias('incidencias.6.log'), -1, '6 archivos rotados están fuera del límite');
  assert.equal(N.indiceIncidencias('historial.jsonl'), -1);
  assert.equal(N.indiceIncidencias('averias.json'), -1);

  assert.deepEqual(N.archivosLogConservados(),
    ['incidencias.log', 'incidencias.1.log', 'incidencias.2.log', 'incidencias.3.log', 'incidencias.4.log', 'incidencias.5.log']);
});

test('D-64: el plan de rotación se dispara por tamaño y desplaza las copias', () => {
  const maximo = 100; // se parametriza el límite para no escribir 5 MB reales

  // Por debajo del límite no se rota nada.
  const sinRotar = N.planRotacionLog('incidencias.log', { tamano: 100, maximo });
  assert.equal(sinRotar.rota, false);
  assert.deepEqual(sinRotar.pasos, []);
  assert.deepEqual(sinRotar.descartados, []);
  assert.equal(sinRotar.archivo, 'incidencias.log');
  assert.equal(sinRotar.destino, 'incidencias.1.log');

  // Justo en el límite tampoco rota: rota cuando lo supera.
  assert.equal(N.planRotacionLog('incidencias.log', { tamano: 101, maximo }).rota, true);

  // Un byte por encima: incidencias.log pasa a incidencias.1.log.
  const primera = N.planRotacionLog('incidencias.log', { tamano: 101, maximo, nombres: ['incidencias.log', 'averias.json'] });
  assert.deepEqual(primera.pasos, [{ desde: 'incidencias.log', hasta: 'incidencias.1.log' }]);
  assert.deepEqual(primera.descartados, []);

  // Con las 5 copias presentes, la cascada desplaza 4→5, 3→4, 2→3, 1→2 y descarta la 5.
  const lleno = N.planRotacionLog('incidencias.log', {
    tamano: 101, maximo,
    nombres: ['incidencias.log', 'incidencias.1.log', 'incidencias.2.log', 'incidencias.3.log', 'incidencias.4.log', 'incidencias.5.log']
  });
  assert.deepEqual(lleno.pasos, [
    { desde: 'incidencias.4.log', hasta: 'incidencias.5.log' },
    { desde: 'incidencias.3.log', hasta: 'incidencias.4.log' },
    { desde: 'incidencias.2.log', hasta: 'incidencias.3.log' },
    { desde: 'incidencias.1.log', hasta: 'incidencias.2.log' },
    { desde: 'incidencias.log', hasta: 'incidencias.1.log' }
  ]);
  assert.deepEqual(lleno.descartados, ['incidencias.5.log'], 'el más antiguo se descarta');
  assert.equal(lleno.pasos.length + lleno.descartados.length, 6, 'cada archivo presente se desplaza o se descarta');
});

// ---------------------------------------------------------------------------
// 5. D-64: la rotación aplicada sobre la carpeta (integración con almacen.js)
// ---------------------------------------------------------------------------
test('D-64: almacen.rotarLogIncidencias desplaza el log y descarta incidencias.5.log', async () => {
  const archivos = new Map();
  archivos.set('incidencias.log', new ArchivoFalso('incidencias.log', 'x'.repeat(200)));
  archivos.set('incidencias.1.log', new ArchivoFalso('incidencias.1.log', 'copia 1'));
  archivos.set('incidencias.5.log', new ArchivoFalso('incidencias.5.log', 'la más antigua'));
  archivos.set('averias.json', new ArchivoFalso('averias.json', '[]\n'));

  const carpeta = new CarpetaFalsa(archivos);
  const almacen = A.crearAlmacen(carpeta);

  const plan = await A.rotarLogIncidencias(almacen, { maximo: 100 });
  assert.equal(plan.rota, true);
  assert.equal(plan.destino, 'incidencias.1.log');
  assert.deepEqual(plan.descartados, ['incidencias.5.log']);
  assert.deepEqual(plan.pasos, [
    { desde: 'incidencias.1.log', hasta: 'incidencias.2.log' },
    { desde: 'incidencias.log', hasta: 'incidencias.1.log' }
  ]);

  assert.equal(archivos.has('incidencias.5.log'), false, 'el más antiguo se descarta');
  assert.equal(archivos.get('incidencias.1.log').contenido, 'x'.repeat(200), 'el log vigente pasa a incidencias.1.log');
  assert.equal(archivos.get('incidencias.2.log').contenido, 'copia 1', 'la copia anterior se desplaza');
  assert.equal(archivos.has('incidencias.log'), false, 'el nombre vigente queda libre para el log nuevo');
  assert.ok(archivos.has('averias.json'), 'los archivos que no son del log no se tocan');
});

test('D-64: por debajo del límite no se rota ni se borra ninguna copia', async () => {
  const archivos = new Map();
  archivos.set('incidencias.log', new ArchivoFalso('incidencias.log', 'una línea de intento fallido\n'));
  archivos.set('incidencias.1.log', new ArchivoFalso('incidencias.1.log', 'copia 1'));
  const carpeta = new CarpetaFalsa(archivos);
  const almacen = A.crearAlmacen(carpeta);

  const plan = await A.rotarLogIncidencias(almacen, { maximo: 1000 });
  assert.equal(plan.rota, false);
  assert.equal(plan.motivo, 'dentro del límite');
  assert.deepEqual(carpeta.eliminados, [], 'no se elimina nada');
  assert.equal(archivos.get('incidencias.log').contenido, 'una línea de intento fallido\n');
  assert.equal(archivos.get('incidencias.1.log').contenido, 'copia 1');
});

test('D-64: el log conserva solo las 5 copias rotadas tras varias rotaciones', async () => {
  const maximo = 50;
  const archivos = new Map();
  archivos.set('incidencias.log', new ArchivoFalso('incidencias.log', 'A'.repeat(60)));
  const carpeta = new CarpetaFalsa(archivos);
  const almacen = A.crearAlmacen(carpeta);

  // Siete rotaciones: cada una deja el log vigente por encima del límite.
  for (let i = 1; i <= 7; i++) {
    await A.rotarLogIncidencias(almacen, { maximo });
    archivos.set('incidencias.log', new ArchivoFalso('incidencias.log', String.fromCharCode(64 + i).repeat(60)));
  }

  const copias = Array.from(archivos.keys()).filter((n) => /^incidencias\.\d+\.log$/.test(n)).sort();
  assert.deepEqual(copias,
    ['incidencias.1.log', 'incidencias.2.log', 'incidencias.3.log', 'incidencias.4.log', 'incidencias.5.log'],
    'nunca hay más de 5 copias rotadas');
  assert.equal(copias.length, N.CONST.LOG_MAX_ARCHIVOS);
  // Tras la 7.ª rotación, la copia 1 es la 7.ª (F) y la 5 es la 3.ª (B).
  assert.equal(archivos.get('incidencias.1.log').contenido, 'F'.repeat(60), 'la copia 1 es la rotación más reciente');
  assert.equal(archivos.get('incidencias.5.log').contenido, 'B'.repeat(60), 'la copia 5 es la más antigua conservada');
});
