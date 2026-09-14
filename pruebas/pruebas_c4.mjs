/*
 * GGTO-v1 · pruebas/pruebas_c4.mjs
 * Pruebas del ciclo C4 (DESPACHO y PDF por cuadrilla) con node:test.
 *
 *   Ejecutar:  node --test pruebas/pruebas_c4.mjs
 *
 * Cubre: casos despachables (D-23), citados del día (D-30), reglas RN-05
 * (citados + 1 referido + 1 empresa por cuadrilla), RN-06 con desempate D-32
 * (la construcción de un sector va a una sola cuadrilla: zona preferente →
 * menor carga → id menor), escritura de `Reparador Principal` y
 * `fecha_asignacion` (D-37), proyección de `despacho.json` (D-31) y el PDF en
 * carta horizontal con paginación (RNF-05, RNF-11, D-27).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(aqui, '..', 'app', 'js');

const N = require(path.join(app, 'nucleo.js'));
const D = require(path.join(app, 'despacho.js'));
const PDF = require(path.join(app, 'pdf.js'));
const jspdf = require(path.join(aqui, '..', 'app', 'lib', 'jspdf.umd.min.js'));

const HOY = '13/09/2026';
const MARCA = '13/09/2026 19:00';

const CUADRILLAS = [
  { id: 'C1', nombre: 'Cuadrilla 1', status: 'Activa', sectores: ['S1'], tecnicos: ['12345'] },
  { id: 'C2', nombre: 'Cuadrilla 2', status: 'Activa', sectores: ['S2'], tecnicos: ['22222'] },
  { id: 'C3', nombre: 'Cuadrilla 3', status: 'Inactiva', sectores: ['S1'] }
];

const SECTORES = [
  { id: 'S1', nombre: 'Cumbres', vias: ['CUMBRES'], cuadrilla_sugerida: '' },
  { id: 'S2', nombre: 'Prados', vias: ['PRADO'], cuadrilla_sugerida: '' }
];

function caso(id, extra) {
  return Object.assign({
    id_averia: String(id), telefono: '42400000' + id, nombre: 'Abonado ' + id,
    direccion: 'DIRECCION ' + id, sector: 'S1', status: 'PEND', clase: 'REP', nivel: 'COM',
    tipo_abonado: 'RES', 'Reparador Principal': '', fecha_cita: '', ingreso: HOY,
    fecha_reporte: HOY, plan: 'ABA', fat: 'FAT1', serial: 'SER' + id, ultimo_comentario: 'comentario ' + id
  }, extra || {});
}

const CASOS = [
  caso(1, { nivel: 'REF', fecha_cita: HOY }),          // citado + referido, S1
  caso(2, { tipo_abonado: 'EMP' }),                    // empresa, S1
  caso(3, { sector: 'S2', nivel: 'REF' }),             // referido, S2
  caso(4, { sector: 'S2', tipo_abonado: 'EMP' }),      // empresa, S2
  caso(5, { clase: 'CNS' }),                           // construcción, S1
  caso(6, { sector: 'S2', clase: 'CNS' }),             // construcción, S2
  caso(7, { status: 'CERRADO' })                       // no despachable
];

// ---------------------------------------------------------------------------
// 1. Casos despachables y citados
// ---------------------------------------------------------------------------

test('solo se despachan los casos abiertos (D-23)', () => {
  const lista = D.casosDespachables(CASOS);
  assert.equal(lista.length, 6);
  assert.ok(lista.every((c) => c.status !== 'CERRADO'));
});

test('un caso es citado si su fecha_cita es la del despacho (D-30)', () => {
  assert.equal(D.esCitado(CASOS[0], HOY), true);
  assert.equal(D.esCitado(CASOS[1], HOY), false);
  assert.equal(D.esCitado({ fecha_cita: '' }, HOY), false);
  assert.equal(D.esCitado({ fecha_cita: '14/09/2026' }, HOY), false);
});

test('solo se usan cuadrillas activas', () => {
  const activas = D.cuadrillasActivas(CUADRILLAS);
  assert.deepEqual(activas.map((c) => c.id), ['C1', 'C2']);
});

// ---------------------------------------------------------------------------
// 2. Reglas del reparto (RN-05, RN-06, D-32)
// ---------------------------------------------------------------------------

test('reparte todos los casos abiertos entre las cuadrillas activas', () => {
  const r = D.generarReparto(CASOS, CUADRILLAS, SECTORES, HOY);
  assert.equal(r.resumen.casos, 6);
  assert.equal(r.resumen.asignados, 6);
  assert.equal(r.resumen.cuadrillas, 2);
  assert.equal(r.sinAsignar.length, 0);
  // Ni un caso perdido ni duplicado.
  const ids = [];
  r.reparto.forEach((b) => b.asignaciones.forEach((a) => ids.push(a.caso.id_averia)));
  assert.equal(new Set(ids).size, 6);
});

test('cada cuadrilla recibe los citados y al menos 1 referido y 1 empresa (RN-05)', () => {
  const r = D.generarReparto(CASOS, CUADRILLAS, SECTORES, HOY);
  r.reparto.forEach((b) => {
    assert.ok(b.referidos >= 1, 'la cuadrilla ' + b.cuadrilla.id + ' sin referido');
    assert.ok(b.empresas >= 1, 'la cuadrilla ' + b.cuadrilla.id + ' sin empresa');
  });
  const citados = r.reparto.reduce((t, b) => t + b.citados, 0);
  assert.equal(citados, 1);
  const conCitado = r.reparto.filter((b) => b.citados > 0);
  assert.equal(conCitado.length, 1);
  assert.equal(conCitado[0].cuadrilla.id, 'C1'); // el citado es de S1 → C1
});

test('la construcción de cada sector va a UNA sola cuadrilla (RN-06)', () => {
  const r = D.generarReparto(CASOS, CUADRILLAS, SECTORES, HOY);
  const cns = [];
  r.reparto.forEach((b) => b.asignaciones.forEach((a) => {
    if (a.motivo === 'construccion') cns.push({ id: a.caso.id_averia, sector: a.caso.sector, cuadrilla: b.cuadrilla.id });
  }));
  assert.equal(cns.length, 2);
  const porSector = {};
  cns.forEach((x) => {
    if (porSector[x.sector]) assert.equal(porSector[x.sector], x.cuadrilla, 'dos cuadrillas para el sector ' + x.sector);
    porSector[x.sector] = x.cuadrilla;
  });
  assert.equal(porSector.S1, 'C1'); // C1 tiene las reparaciones de S1
  assert.equal(porSector.S2, 'C2');
});

test('desempata por zona preferente, luego carga y luego id (D-32)', () => {
  const c1 = { id: 'C1', sectores: ['S1'] };
  const c2 = { id: 'C2', sectores: [] };
  const c3 = { id: 'C3', sectores: ['S1'] };
  // 1) La zona preferente manda sobre la carga.
  assert.equal(D.ordenarCandidatas([c2, c1], 'S1', { C2: 0, C1: 9 })[0].id, 'C1');
  // 2) Sin zona preferente, gana la de menor carga.
  assert.equal(D.ordenarCandidatas([c2, { id: 'C9', sectores: [] }], 'S1', { C2: 5, C9: 2 })[0].id, 'C9');
  // 3) En empate de carga, el id menor.
  assert.equal(D.ordenarCandidatas([c2, { id: 'C0', sectores: [] }], 'S1', { C2: 3, C0: 3 })[0].id, 'C0');
  // 4) Dos con zona preferente: decide la carga.
  assert.equal(D.ordenarCandidatas([c3, c1], 'S1', { C3: 1, C1: 4 })[0].id, 'C3');
});

test('sin cuadrillas activas avisa y no asigna nada', () => {
  const r = D.generarReparto(CASOS, [{ id: 'C9', status: 'Inactiva' }], SECTORES, HOY);
  assert.equal(r.resumen.asignados, 0);
  assert.equal(r.sinAsignar.length, 6);
  assert.ok(r.avisos.length > 0);
});

// ---------------------------------------------------------------------------
// 3. Escritura en el maestro y proyección del despacho (D-37, D-31)
// ---------------------------------------------------------------------------

test('aplica el reparto al maestro con cuadrilla y fecha de asignación', () => {
  const r = D.generarReparto(CASOS, CUADRILLAS, SECTORES, HOY);
  const aplicado = D.aplicarReparto(CASOS, r, HOY, '12345', MARCA);
  assert.equal(aplicado.asignados, 6);
  assert.equal(aplicado.lineas.length, 6);
  aplicado.lineas.forEach((linea) => {
    const obj = JSON.parse(linea);
    assert.equal(obj.accion, 'asignacion');
    assert.equal(obj.campo, 'Reparador Principal');
    assert.equal(obj.operador, '12345');
    assert.equal(obj.fecha_hora, MARCA);
  });
  const c1 = aplicado.casos.filter((c) => c.id_averia === '1')[0];
  assert.equal(c1['Reparador Principal'], 'C1');
  assert.equal(c1.fecha_asignacion, HOY);
  // El caso cerrado no se toca.
  const cerrado = aplicado.casos.filter((c) => c.id_averia === '7')[0];
  assert.equal(cerrado['Reparador Principal'], '');
});

test('aplicar el reparto dos veces no vuelve a escribir ni a generar historial', () => {
  const r1 = D.generarReparto(CASOS, CUADRILLAS, SECTORES, HOY);
  const primera = D.aplicarReparto(CASOS, r1, HOY, '12345', MARCA);
  assert.equal(primera.asignados, 6);
  // Segunda vuelta sobre el maestro ya asignado: el reparto es determinista.
  const r2 = D.generarReparto(primera.casos, CUADRILLAS, SECTORES, HOY);
  const segunda = D.aplicarReparto(primera.casos, r2, HOY, '12345', MARCA);
  assert.equal(segunda.asignados, 0);
  assert.equal(segunda.lineas.length, 0);
});

test('proyecta despacho.json con las 15 columnas de D-31', () => {
  const r = D.generarReparto(CASOS, CUADRILLAS, SECTORES, HOY);
  const filas = D.filasDespacho(r, HOY);
  assert.equal(filas.length, 6);
  const columnas = Object.keys(filas[0]);
  assert.deepEqual(columnas, [
    'nivel', 'clase', 'id_averia', 'telefono', 'persona_reporta', 'contacto', 'ultimo_comentario',
    'nombre', 'direccion', 'plan', 'fat', 'serial', 'sector', 'Reparador Principal', 'fecha_despacho'
  ]);
  assert.equal(filas[0].fecha_despacho, HOY);
  assert.ok(filas.every((f) => f['Reparador Principal'] !== '' && f.sector !== ''));
});

test('las columnas del despacho son las 15 canónicas (RF-20, CU-17)', () => {
  assert.deepEqual(D.COLUMNAS_DESPACHO, [
    'nivel', 'clase', 'id_averia', 'telefono', 'persona_reporta', 'contacto',
    'ultimo_comentario', 'nombre', 'direccion', 'plan', 'fat', 'serial',
    'sector', 'Reparador Principal', 'fecha_despacho'
  ]);
});

// ---------------------------------------------------------------------------
// 4. PDF del despacho (RNF-05, RNF-11, D-27)
// ---------------------------------------------------------------------------

test('genera un PDF válido en carta horizontal', () => {
  const r = D.generarReparto(CASOS, CUADRILLAS, SECTORES, HOY);
  const bloque = r.reparto.filter((b) => b.cuadrilla.id === 'C1')[0];
  const armado = PDF.construirPDF(bloque, HOY, 1, { jsPDFClase: jspdf.jsPDF, receptor: 'Supervisor PDE' });
  assert.ok(armado, 'no se pudo construir el PDF');
  assert.equal(armado.filas, bloque.asignaciones.length);
  const bytes = new Uint8Array(armado.doc.output('arraybuffer'));
  const cabecera = String.fromCharCode.apply(null, bytes.slice(0, 5));
  assert.equal(cabecera, '%PDF-');
  const ancho = armado.doc.internal.pageSize.getWidth();
  const alto = armado.doc.internal.pageSize.getHeight();
  assert.ok(ancho > alto, 'la página debe ser horizontal');
  assert.ok(Math.abs(ancho - PDF.PAGINA.ancho) < 1 && Math.abs(alto - PDF.PAGINA.alto) < 1, 'debe ser carta');
});

test('pagina cuando hay más casos de los que caben en una hoja', () => {
  const muchos = [];
  for (let i = 0; i < 120; i++) muchos.push({ caso: caso(1000 + i), motivo: 'reparacion' });
  const bloque = { cuadrilla: { id: 'C1', nombre: 'Cuadrilla 1' }, asignaciones: muchos };
  const armado = PDF.construirPDF(bloque, HOY, 1, { jsPDFClase: jspdf.jsPDF });
  const porPagina = PDF.filasPorPagina();
  assert.ok(porPagina > 10, 'deben caber más de 10 filas por hoja');
  assert.equal(armado.paginas, Math.ceil(120 / porPagina));
  assert.ok(armado.paginas > 1);
  const bytes = new Uint8Array(armado.doc.output('arraybuffer'));
  assert.equal(String.fromCharCode.apply(null, bytes.slice(0, 5)), '%PDF-');
});

test('una cuadrilla sin casos produce una hoja con el aviso', () => {
  const armado = PDF.construirPDF({ cuadrilla: { id: 'C9' }, asignaciones: [] }, HOY, 1, { jsPDFClase: jspdf.jsPDF });
  assert.equal(armado.paginas, 1);
  assert.equal(armado.filas, 0);
  assert.ok(armado.doc.output('arraybuffer').byteLength > 0);
});

test('nombre del archivo y registro de entrega (RNF-11, D-27)', () => {
  const bloque = { cuadrilla: { id: 'C1', nombre: 'Cuadrilla 1' }, asignaciones: [] };
  assert.equal(PDF.nombreArchivo(bloque, HOY), 'Despacho_Cuadrilla_C1_20260913.pdf');
  const linea = PDF.registroEntrega(HOY, bloque, 2, 'Supervisor PDE', '12345', MARCA);
  assert.ok(/ENTREGA PDF/.test(linea));
  assert.ok(/cuadrilla=C1/.test(linea));
  assert.ok(/copias=2/.test(linea));
  assert.ok(/receptor=Supervisor PDE/.test(linea));
  assert.ok(/recoger y destruir al cierre \(D-27\)/.test(linea));
});

test('la librería jsPDF está fijada localmente (RT-07)', () => {
  const ruta = path.join(aqui, '..', 'app', 'lib', 'jspdf.umd.min.js');
  assert.ok(fs.existsSync(ruta), 'falta app/lib/jspdf.umd.min.js');
  const contenido = fs.readFileSync(ruta, 'utf8');
  assert.ok(/Version 2\.5\.2/.test(contenido), 'la versión de jsPDF debe estar fijada');
});
