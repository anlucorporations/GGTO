/*
 * GGTO-v1 · pruebas/pruebas_c2.mjs
 * Pruebas del ciclo C2 (ingesta del CSV) con el archivo REAL del 12/09/2026.
 *
 *   Ejecutar:  node --test pruebas/pruebas_c2.mjs
 *
 * Comprueba el contrato posicional (D-12, D-44), el filtro por central
 * (RF-16), la clasificación (RN-03, D-38), la deduplicación (RN-01), el
 * mapeo campo a campo, las fechas (D-21), el tipo de abonado (D-17) y el
 * umbral de rendimiento S-RNF-02b (< 3 s).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizProyecto = path.join(aqui, '..');
const RUTA_CSV = path.join(raizProyecto, 'detalle_averias_gpon 12_09_2026.csv');
const RUTA_DATOS = 'C:\\GGTO\\datos';

const I = require(path.join(raizProyecto, 'app', 'js', 'ingesta_nucleo.js'));

function leer(ruta) {
  if (!fs.existsSync(ruta)) throw new Error('Falta el archivo requerido: ' + ruta);
  return fs.readFileSync(ruta, 'utf8');
}

const CSV = leer(RUTA_CSV);
const ESTRUCTURA = JSON.parse(leer(path.join(RUTA_DATOS, 'estructura.json')));
const CENTRAL = JSON.parse(leer(path.join(RUTA_DATOS, 'central.json')));
const CLAVES = JSON.parse(leer(path.join(RUTA_DATOS, 'claves_clasificacion.json')));

const FECHA = '13/09/2026';
const MARCA = '13/09/2026 18:00';
const OPCIONES = { fecha: FECHA, marca: MARCA, operador: '12345', clase: 'REP', nivel: 'COM' };

function ingerir(texto, extras) {
  const base = {
    texto: texto,
    estructura: ESTRUCTURA,
    central: CENTRAL,
    claves: CLAVES.claves,
    maestro: [],
    sectores: [],
    opciones: Object.assign({}, OPCIONES, { modo: CLAVES.normalizacion || 'normalizada' })
  };
  return I.ingerir(Object.assign(base, extras || {}));
}

// ---------------------------------------------------------------------------
// 1. Parseo y contrato posicional
// ---------------------------------------------------------------------------

test('parsea el CSV real: 56 registros y 80 columnas', () => {
  const p = I.parsearCSV(CSV, ';');
  assert.equal(p.cabecera.length, 80);
  assert.equal(p.filas.length, 56);
  assert.equal(p.cabecera[10], 'id_averia');
  assert.equal(p.cabecera[26], 'estatus');
  assert.equal(p.cabecera[79], 'Fecha Hora Asignacion');
});

test('el contrato estructura.json declara 80 columnas y las necesarias', () => {
  assert.equal(ESTRUCTURA.columnas_esperadas, 80);
  assert.equal(ESTRUCTURA.separador, ';');
  assert.ok(ESTRUCTURA.campos.length >= 20, 'debe declarar al menos 20 columnas');
  const porJson = {};
  ESTRUCTURA.campos.forEach((c) => { porJson[c.json] = c.columna; });
  assert.equal(porJson.id_averia, 11);
  assert.equal(porJson.estatus, 27);
  assert.equal(porJson['Reparador Principal'], 65);
  assert.deepEqual(ESTRUCTURA.no_se_persisten, [18, 53, 80]);
});

test('valida el contrato posicional del archivo real', () => {
  const p = I.parsearCSV(CSV, ';');
  const v = I.validarEstructura(p.cabecera, ESTRUCTURA);
  assert.equal(v.ok, true, JSON.stringify(v.errores));
  assert.equal(v.errores.length, 0);
});

// ---------------------------------------------------------------------------
// 2. Validación bloqueante (D-44)
// ---------------------------------------------------------------------------

test('aborta sin escribir si falta una columna', () => {
  const p = I.parsearCSV(CSV, ';');
  const mutilada = p.cabecera.slice(0, 79);
  const v = I.validarEstructura(mutilada, ESTRUCTURA);
  assert.equal(v.ok, false);
  assert.ok(v.errores.some((e) => e.tipo === 'columnas'));

  const texto = [mutilada.join(';')].concat(p.filas.map((f) => f.slice(0, 79).join(';'))).join('\n');
  const r = ingerir(texto);
  assert.equal(r.ok, false);
  assert.equal(r.casos.length, 0, 'no debe devolver casos cuando la validación falla');
  assert.equal(r.resumen.insertadas, 0);
});

test('aborta si una columna declarada cambió de nombre', () => {
  const p = I.parsearCSV(CSV, ';');
  const cabecera = p.cabecera.slice();
  cabecera[10] = 'identificador_raro';
  const v = I.validarEstructura(cabecera, ESTRUCTURA);
  assert.equal(v.ok, false);
  assert.ok(v.errores.some((e) => e.tipo === 'nombre' && e.columna === 11));
});

test('aborta si el archivo solo tiene el encabezado', () => {
  const p = I.parsearCSV(CSV, ';');
  const r = ingerir(p.cabecera.join(';') + '\n');
  assert.equal(r.ok, false);
  assert.equal(r.casos.length, 0);
  assert.ok(r.errores.some((e) => e.tipo === 'sin_datos'));
});

// ---------------------------------------------------------------------------
// 3. Filtro por central, clasificación y totales (los números del 12/09)
// ---------------------------------------------------------------------------

test('filtra por central: 51 de Francisco Salias y 5 descartadas', () => {
  const r = ingerir(CSV);
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.resumen.leidas, 56);
  assert.equal(r.resumen.fueraDeCentral, 5);
  assert.equal(r.resumen.insertadas, 51);
});

test('clasifica: 17 con palabras clave y 34 sin ellas', () => {
  // Con el catálogo de claves configurado, que incluye las variantes que usa
  // realmente el CSV («LOS ROJO» y «FALLA DE FIBRA»): el fuente escribe
  // «LOSS ROJO» y «FALLA FIBRA», que no aparecen en el archivo.
  const r = ingerir(CSV);
  assert.equal(r.resumen.conClaves, 17);
  assert.equal(r.resumen.sinClaves, 34);
  assert.equal(r.resumen.conClaves + r.resumen.sinClaves, 51);
});

test('ingiere 51 casos: 18 PEND y 33 GESTION (ASGN entra como PEND)', () => {
  const r = ingerir(CSV);
  assert.equal(r.resumen.pend, 18);
  assert.equal(r.resumen.gestion, 33);
  assert.equal(r.resumen.pend + r.resumen.gestion, 51);
  assert.equal(r.resumen.insertadas, 51);
  // Los 3 ASGN del archivo quedan como PEND.
  const asgn = r.casos.filter((c) => c.status === 'PEND').length;
  assert.equal(asgn, 18);
});

test('ninguna dirección tiene sector si no hay catálogo (cola de CU-09)', () => {
  const r = ingerir(CSV);
  assert.equal(r.resumen.conSector, 0);
  assert.equal(r.resumen.sinSector, 51);
  assert.equal(r.sinSector.length, 51);
});

test('la ingesta del día tarda menos de 3 s (S-RNF-02b)', () => {
  const r = ingerir(CSV);
  assert.ok(r.resumen.ms < 3000, 'tardó ' + r.resumen.ms + ' ms');
});

// ---------------------------------------------------------------------------
// 4. Mapeo campo a campo
// ---------------------------------------------------------------------------

test('mapea el primer registro insertado campo a campo', () => {
  const r = ingerir(CSV);
  const c = r.casos[0];
  assert.equal(c.id_averia, '90000001');
  assert.equal(c.telefono, '90000117');
  assert.equal(c.nombre, 'ABONADO');
  assert.equal(c.persona_reporta, 'ABONADO');
  assert.equal(c.contacto, '90000097');
  assert.equal(c.olt, 'olt-ficticia');
  assert.equal(c.plan, 'PLAN FICTICIO');
  assert.equal(c.slot, '1');
  assert.equal(c.puerto, '7');
  assert.equal(c.serial, 'SERIALFICTICIO');
  assert.equal(c.status, 'GESTION');
  assert.equal(c.clase, 'REP');
  assert.equal(c.nivel, 'COM');
  assert.equal(c.ingreso, FECHA);
  assert.equal(c.fecha_modificacion, MARCA);
  assert.equal(c.usuario_modificacion, 'OPERADOR01');
  assert.equal(c.tipo_abonado, 'RES');
  assert.equal(c.fecha_reporte, '17/07/2026');
  assert.equal(c.fecha_reporte_original, '17/07/2026 11:38:20 a.m.');
  assert.equal(c.resolucion, '');
  assert.equal(c.fechaResolucion, '');
  assert.equal(c.sector, '');
  // El maestro tiene los 36 campos: ni uno más, ni uno menos.
  assert.equal(Object.keys(c).length, 36, 'campos: ' + Object.keys(c).join(', '));
});

test('deduce el tipo de abonado (D-17)', () => {
  assert.equal(I.tipoAbonado('CANTV RESIDENCIAL', 'RES'), 'RES');
  assert.equal(I.tipoAbonado('CANTV EMPRESAS', 'NRES'), 'EMP');
  assert.equal(I.tipoAbonado('', 'NRES'), 'EMP');
  assert.equal(I.tipoAbonado('cualquiera', ''), 'RES');
});

test('recorta las fechas y conserva el original (D-21)', () => {
  assert.equal(I.recortarFecha('17/07/2026 11:38:20 a.m.'), '17/07/2026');
  assert.equal(I.recortarFecha('1/7/26'), '01/07/2026');
  assert.equal(I.recortarFecha(''), '');
  assert.equal(I.recortarFecha('sin fecha'), '');
});

// ---------------------------------------------------------------------------
// 5. Deduplicación (RN-01)
// ---------------------------------------------------------------------------

test('la segunda ingesta del mismo archivo no inserta nada', () => {
  const primera = ingerir(CSV);
  const segunda = ingerir(CSV, { maestro: primera.casos });
  assert.equal(segunda.resumen.insertadas, 0);
  assert.equal(segunda.resumen.duplicadasEnMaestro, 51);
  assert.equal(segunda.casos.length, 0);
});

test('detecta duplicados dentro del mismo lote', () => {
  const p = I.parsearCSV(CSV, ';');
  const filas = p.filas.slice();
  const repetida = filas[0];
  const texto = [p.cabecera.join(';')]
    .concat(filas.map((f) => f.join(';')))
    .concat([repetida.join(';')])
    .join('\n');
  const r = ingerir(texto);
  assert.equal(r.resumen.duplicadasEnLote, 1);
  assert.equal(r.resumen.insertadas, 51);
});

test('rechaza las filas con id_averia vacío', () => {
  const p = I.parsearCSV(CSV, ';');
  const fila = p.filas[0].slice();
  fila[10] = '';
  const texto = [p.cabecera.join(';'), fila.join(';')].join('\n');
  const r = ingerir(texto);
  assert.equal(r.resumen.rechazadas.length, 1);
  assert.equal(r.resumen.rechazadas[0].motivo, 'id_averia vacio');
  assert.equal(r.resumen.insertadas, 0);
});

// ---------------------------------------------------------------------------
// 6. Palabras clave y sectores
// ---------------------------------------------------------------------------

test('busca palabras clave en modo normalizada y estricta', () => {
  const claves = ['LOSS ROJO', 'FALLA FIBRA', 'FIBRA DAÑADA'];
  assert.equal(I.contieneClaves(['reporta fibra danada en la calle'], claves, 'normalizada'), true);
  assert.equal(I.contieneClaves(['reporta FIBRA DAÑADA'], claves, 'normalizada'), true);
  assert.equal(I.contieneClaves(['reporta FIBRA DAÑADA'], claves, 'estricta'), true);
  assert.equal(I.contieneClaves(['reporta fibra danada'], claves, 'estricta'), false);
  assert.equal(I.contieneClaves(['navega lento'], claves, 'normalizada'), false);
});

test('clasifica respetando el estatus del CSV', () => {
  const claves = ['FALLA FIBRA'];
  assert.equal(I.clasificar('ASGN', ['navega lento'], claves, 'normalizada'), 'PEND');
  assert.equal(I.clasificar('PEND', ['FALLA FIBRA en el poste'], claves, 'normalizada'), 'PEND');
  assert.equal(I.clasificar('PEND', ['navega lento'], claves, 'normalizada'), 'GESTION');
});

test('asigna sector por coincidencia de vías', () => {
  const sectores = [
    { id: 'S1', nombre: 'Cumbres', vias: ['CALLE FICTICIA'] },
    { id: 'S2', nombre: 'Prados', vias: ['CALLE DEMO', 'Av. Principal'] }
  ];
  const a = I.asignarSector('CALLE FICTICIA AVENIDA PRINCIPAL CALLE FICTICIA', sectores);
  assert.equal(a.id, 'S1');
  assert.equal(I.asignarSector('CALLE QUE NO EXISTE 123', sectores), null);

  const r = ingerir(CSV, { sectores: sectores });
  assert.ok(r.resumen.conSector >= 1);
  assert.equal(r.resumen.conSector + r.resumen.sinSector, 51);
});
