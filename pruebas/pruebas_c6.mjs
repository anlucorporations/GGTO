/*
 * GGTO-v1 · pruebas/pruebas_c6.mjs
 * Pruebas del ciclo C6 (reportes y seguimiento) con node:test.
 *
 *   Ejecutar:  node --test pruebas/pruebas_c6.mjs
 *
 * Cubre: casos especiales EMP/REF abiertos (D-33), averías concentradas por
 * sector con umbral editable (D-25) sobre la semana operativa (D-66), el parte
 * de trabajo diario (RF-25) y el conteo de cambios desde la última emisión.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(aqui, '..', 'app', 'js');

const N = require(path.join(app, 'nucleo.js'));
const M = require(path.join(app, 'metricas.js'));
const R = require(path.join(app, 'reportes.js'));

const CUADRILLAS = [{ id: 'C1', nombre: 'Cuadrilla 1' }, { id: 'C2', nombre: 'Cuadrilla 2' }];
const SECTORES = [{ id: 'S1', nombre: 'Cumbres' }, { id: 'S2', nombre: 'Prados' }];

function caso(id, extra) {
  return Object.assign({
    id_averia: String(id), status: 'PEND', clase: 'REP', nivel: 'COM', tipo_abonado: 'RES',
    'Reparador Principal': '', ingreso: '', fechaResolucion: '', fecha_asignacion: '',
    fecha_modificacion: '', sector: 'S1', direccion: 'DIR ' + id
  }, extra || {});
}

const CASOS = [
  caso(1, { nivel: 'REF', ingreso: '07/09/2026', sector: 'S1', 'Reparador Principal': 'C1' }),
  caso(2, { tipo_abonado: 'EMP', ingreso: '08/09/2026', sector: 'S1', 'Reparador Principal': 'C1' }),
  caso(3, { ingreso: '09/09/2026', sector: 'S1' }),
  caso(4, { clase: 'CNS', ingreso: '09/09/2026', sector: 'S1' }),
  caso(5, { nivel: 'REF', tipo_abonado: 'EMP', ingreso: '10/09/2026', sector: 'S2', 'Reparador Principal': 'C2' }),
  caso(6, { ingreso: '11/09/2026', sector: 'S2' }),
  caso(7, { nivel: 'REF', status: 'CERRADO', ingreso: '11/09/2026', fechaResolucion: '12/09/2026', sector: 'S2' }),
  caso(8, { nivel: 'REF', ingreso: '01/06/2026', sector: 'S1' })
];

const SEMANA = (() => {
  for (let s = 1; s <= 36; s++) {
    if (M.diasDeSemana('2026', s)[0].fecha === '07/09/2026') return s;
  }
  return 0;
})();

// ---------------------------------------------------------------------------
// 1. Casos especiales (D-33)
// ---------------------------------------------------------------------------

test('los casos especiales son los EMP o REF que siguen abiertos', () => {
  const lista = R.casosEspeciales(CASOS);
  assert.deepEqual(lista.map((c) => c.id_averia), ['1', '2', '5', '8']);
  // El cerrado (7) y los normales (3, 4, 6) quedan fuera.
  assert.ok(!lista.some((c) => c.id_averia === '7'));
});

test('resume los casos especiales por motivo, sector y cuadrilla', () => {
  const r = R.resumenEspeciales(CASOS);
  assert.equal(r.total, 4);
  assert.equal(r.referidos, 3);       // 1, 5 y 8
  assert.equal(r.empresariales, 2);   // 2 y 5
  assert.equal(r.porSector.S1, 3);    // 1 y 8 (referidos) + 2 (empresarial)
  assert.equal(r.porSector.S2, 1);    // 5
  assert.equal(r.porCuadrilla.C1, 2); // 1 y 2
  assert.equal(r.porCuadrilla.C2, 1); // 5
  assert.equal(r.porCuadrilla['(sin asignar)'], 1); // 8
});

test('los casos sin sector se agrupan en la cola de CU-09', () => {
  const r = R.resumenEspeciales([caso(50, { nivel: 'REF', sector: '' })]);
  assert.equal(r.porSector['(cola CU-09)'], 1);
});

// ---------------------------------------------------------------------------
// 2. Averías concentradas (D-25, D-66)
// ---------------------------------------------------------------------------

test('cuenta los casos abiertos de la semana por sector', () => {
  const r = R.averiasConcentradas(CASOS, SECTORES, 3, '2026', SEMANA);
  assert.equal(r.semana, SEMANA);
  assert.equal(r.desde, '07/09/2026');
  assert.equal(r.hasta, '12/09/2026');
  const s1 = r.sectores.filter((s) => s.sector === 'S1')[0];
  const s2 = r.sectores.filter((s) => s.sector === 'S2')[0];
  assert.equal(s1.total, 4);        // 1, 2, 3 y 4 (el 8 es de junio)
  assert.equal(s1.construccion, 1); // el 4
  assert.equal(s2.total, 2);        // 5 y 6 (el 7 está cerrado)
  assert.deepEqual(r.sectores.map((s) => s.sector), ['S1', 'S2']); // ordenado por volumen
});

test('marca como concentrado el sector que alcanza el umbral', () => {
  const r = R.averiasConcentradas(CASOS, SECTORES, 3, '2026', SEMANA);
  assert.equal(r.umbral, 3);
  assert.deepEqual(r.concentradas.map((s) => s.sector), ['S1']);
  const s1 = r.sectores.filter((s) => s.sector === 'S1')[0];
  assert.equal(s1.concentrada, true);
  const s2 = r.sectores.filter((s) => s.sector === 'S2')[0];
  assert.equal(s2.concentrada, false);
});

test('el umbral es configurable (D-25)', () => {
  const conCinco = R.averiasConcentradas(CASOS, SECTORES, 5, '2026', SEMANA);
  assert.equal(conCinco.umbral, 5);
  assert.equal(conCinco.concentradas.length, 0);
  const conDos = R.averiasConcentradas(CASOS, SECTORES, 2, '2026', SEMANA);
  assert.deepEqual(conDos.concentradas.map((s) => s.sector), ['S1', 'S2']);
  // Sin valor válido se usa el 3 por defecto.
  assert.equal(R.averiasConcentradas(CASOS, SECTORES, 0, '2026', SEMANA).umbral, 3);
});

test('las direcciones sin sector se vigilan aparte', () => {
  const casos = [caso(60, { sector: '', ingreso: '08/09/2026' }), caso(61, { sector: '', ingreso: '09/09/2026' })];
  const r = R.averiasConcentradas(casos, SECTORES, 2, '2026', SEMANA);
  const cola = r.sectores.filter((s) => s.sector === '(cola CU-09)')[0];
  assert.equal(cola.total, 2);
  assert.equal(cola.concentrada, true);
});

// ---------------------------------------------------------------------------
// 3. Parte diario y cambios desde la última emisión
// ---------------------------------------------------------------------------

test('el parte del día reúne gestión, pendientes y especiales', () => {
  const p = R.parteDiario(CASOS, '12/09/2026', CUADRILLAS);
  assert.equal(p.fecha, '12/09/2026');
  assert.equal(p.ingresos, 0);      // nada ingresó el 12/09
  assert.equal(p.resueltos, 1);     // el caso 7 se resolvió el 12/09
  assert.equal(p.resueltosReferido, 1);
  assert.equal(p.total, 8);
  assert.equal(p.pendientes, 7);
  assert.equal(p.especiales, 4);
  assert.equal(p.cuadrillas.length, 2);
});

test('cuenta los cambios del historial posteriores a la última emisión', () => {
  const lineas = [
    N.lineaHistorial({ fecha_hora: '12/09/2026 09:00', operador: '12345', id_averia: '1', campo: 'status', valor_anterior: 'PEND', valor_nuevo: 'GESTION', accion: 'edicion' }),
    N.lineaHistorial({ fecha_hora: '12/09/2026 11:00', operador: '12345', id_averia: '2', campo: 'clase', valor_anterior: 'REP', valor_nuevo: 'CNS', accion: 'edicion' }),
    N.lineaHistorial({ fecha_hora: '12/09/2026 18:30', operador: '54321', id_averia: '3', campo: 'status', valor_anterior: 'PEND', valor_nuevo: 'CERRADO', accion: 'cierre' })
  ].join('\n');

  assert.equal(R.cambiosDesde(lineas, '').total, 3);
  assert.equal(R.cambiosDesde(lineas, '12/09/2026 10:00').total, 2);
  assert.equal(R.cambiosDesde(lineas, '12/09/2026 18:30').total, 0);
  assert.equal(R.cambiosDesde(lineas, '13/09/2026').total, 0);
  assert.equal(R.cambiosDesde('', '01/01/2026').total, 0);
});
