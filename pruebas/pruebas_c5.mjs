/*
 * GGTO-v1 · pruebas/pruebas_c5.mjs
 * Pruebas del ciclo C5 (MONITOREO y GRAFICOS) con node:test.
 *
 *   Ejecutar:  node --test pruebas/pruebas_c5.mjs
 *
 * Cubre las seis zonas de RF-05 (gestión diaria, casos globales, reparación,
 * construcción, cuadrilla y serie semanal), la semana operativa de lunes a
 * sábado (RN-08) con el pendiente al cierre de cada día (D-34), el selector de
 * Sem 1 a Sem 36 y las configuraciones de los gráficos de RF-06.
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
const M = require(path.join(app, 'metricas.js'));
const G = require(path.join(app, 'graficos.js'));

const CUADRILLAS = [{ id: 'C1', nombre: 'Cuadrilla 1' }, { id: 'C2', nombre: 'Cuadrilla 2' }];

function caso(id, extra) {
  return Object.assign({
    id_averia: String(id), status: 'PEND', clase: 'REP', nivel: 'COM', tipo_abonado: 'RES',
    'Reparador Principal': '', ingreso: '', fechaResolucion: '', fecha_asignacion: '',
    fecha_modificacion: '', fecha_reporte: ''
  }, extra || {});
}

const CASOS = [
  caso(1, { ingreso: '07/09/2026', fechaResolucion: '08/09/2026', status: 'CERRADO', nivel: 'REF', 'Reparador Principal': 'C1', fecha_asignacion: '07/09/2026', fecha_modificacion: '08/09/2026' }),
  caso(2, { ingreso: '08/09/2026', 'Reparador Principal': 'C1', fecha_asignacion: '08/09/2026', fecha_modificacion: '08/09/2026' }),
  caso(3, { ingreso: '09/09/2026', fechaResolucion: '12/09/2026', status: 'CERRADO', tipo_abonado: 'EMP', 'Reparador Principal': 'C2', fecha_asignacion: '09/09/2026', fecha_modificacion: '12/09/2026' }),
  caso(4, { ingreso: '10/09/2026', clase: 'CNS', 'Reparador Principal': 'C2', fecha_asignacion: '10/09/2026', fecha_modificacion: '10/09/2026' }),
  caso(5, { ingreso: '11/09/2026', clase: 'CNS', tipo_abonado: 'EMP' }),
  caso(6, { ingreso: '12/09/2026', nivel: 'REF' })
];

// La semana operativa que contiene el 07/09/2026.
const SEMANA = (() => {
  for (let s = 1; s <= 36; s++) {
    if (M.diasDeSemana('2026', s)[0].fecha === '07/09/2026') return s;
  }
  return 0;
})();

// ---------------------------------------------------------------------------
// 1. Fechas y semana operativa
// ---------------------------------------------------------------------------

test('normaliza fechas y descarta las inválidas', () => {
  assert.equal(M.claveFecha('12/09/2026'), '20260912');
  assert.equal(M.claveFecha('31/02/2026'), '');
  assert.equal(M.claveFecha(''), '');
  assert.equal(M.claveFecha(undefined), '');
  assert.equal(M.anioDe('12/09/2026'), '2026');
});

test('la semana operativa va de lunes a sábado (RN-08)', () => {
  assert.ok(SEMANA > 0, 'no se encontró la semana del 07/09/2026');
  const dias = M.diasDeSemana('2026', SEMANA);
  assert.equal(dias.length, 6);
  assert.deepEqual(dias.map((d) => d.fecha),
    ['07/09/2026', '08/09/2026', '09/09/2026', '10/09/2026', '11/09/2026', '12/09/2026']);
});

test('el resumen cubre las 36 semanas del año', () => {
  const resumen = M.resumenPorSemana(CASOS, '2026');
  assert.equal(resumen.length, 36);
  assert.equal(resumen[0].semana, 1);
  assert.equal(resumen[35].semana, 36);
  const conDatos = resumen.filter((s) => s.conDatos);
  assert.equal(conDatos.length, 1);
  assert.equal(conDatos[0].semana, SEMANA);
  assert.equal(conDatos[0].ingresos, 6);
  assert.equal(conDatos[0].reparadas, 2);
});

// ---------------------------------------------------------------------------
// 2. Gestión diaria y casos globales
// ---------------------------------------------------------------------------

test('gestiona el día: ingresos y resueltos por tipo', () => {
  const r = M.gestionDiaria(CASOS, '12/09/2026');
  assert.equal(r.ingresos, 1);          // caso 6
  assert.equal(r.resueltos, 1);         // caso 3
  assert.equal(r.resueltosEmpresarial, 1);
  assert.equal(r.resueltosResidencial, 0);
  assert.equal(r.resueltosReferido, 0);

  const otro = M.gestionDiaria(CASOS, '08/09/2026');
  assert.equal(otro.ingresos, 1);       // caso 2
  assert.equal(otro.resueltos, 1);      // caso 1, referido
  assert.equal(otro.resueltosReferido, 1);
});

test('casos globales: pendientes contra resueltos', () => {
  const r = M.casosGlobales(CASOS);
  assert.equal(r.total, 6);
  assert.equal(r.resueltos, 2);
  assert.equal(r.pendientes, 4);
});

// ---------------------------------------------------------------------------
// 3. Reparación, construcción y cuadrillas
// ---------------------------------------------------------------------------

test('pendientes de reparación por tipo, sin contar construcción ni cerrados', () => {
  const r = M.reparacionPendiente(CASOS);
  assert.equal(r.total, 2);             // casos 2 (común) y 6 (referido)
  assert.equal(r.comunes, 1);
  assert.equal(r.referidos, 1);
  assert.equal(r.empresariales, 0);
});

test('pendientes de construcción por tipo', () => {
  const r = M.construccionPendiente(CASOS);
  assert.equal(r.total, 2);             // casos 4 y 5
  assert.equal(r.residenciales, 1);
  assert.equal(r.empresariales, 1);
});

test('cuadrillas del día: asignados, cerrados y gestionados', () => {
  const r = M.cuadrillaDelDia(CASOS, '10/09/2026', CUADRILLAS);
  assert.equal(r.length, 2);
  const c1 = r.filter((x) => x.cuadrilla === 'C1')[0];
  const c2 = r.filter((x) => x.cuadrilla === 'C2')[0];
  assert.deepEqual(c1, { cuadrilla: 'C1', asignados: 0, cerrados: 0, gestionados: 0 });
  assert.deepEqual(c2, { cuadrilla: 'C2', asignados: 1, cerrados: 0, gestionados: 1 });

  const cierre = M.cuadrillaDelDia(CASOS, '12/09/2026', CUADRILLAS);
  const c2cierre = cierre.filter((x) => x.cuadrilla === 'C2')[0];
  assert.equal(c2cierre.cerrados, 1);
  assert.equal(c2cierre.gestionados, 1);
});

// ---------------------------------------------------------------------------
// 4. Serie semanal (D-34)
// ---------------------------------------------------------------------------

test('la serie de la semana da ingresos, reparadas y pendiente al cierre por día', () => {
  const serie = M.serieDeSemana(CASOS, '2026', SEMANA);
  assert.equal(serie.length, 6);
  assert.deepEqual(serie.map((d) => d.ingresos), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(serie.map((d) => d.reparadas), [0, 1, 0, 0, 0, 1]);
  // Pendientes al cerrar cada día: el caso 2 sigue abierto toda la semana.
  assert.deepEqual(serie.map((d) => d.pendientes), [1, 1, 2, 3, 4, 4]);
  assert.equal(serie[5].fecha, '12/09/2026');
});

test('una semana sin datos queda a cero', () => {
  const serie = M.serieDeSemana(CASOS, '2026', 1);
  assert.equal(serie.length, 6);
  assert.ok(serie.every((d) => d.ingresos === 0 && d.reparadas === 0));
});

test('el tablero reúne las seis zonas', () => {
  const t = M.tablero(CASOS, '12/09/2026', CUADRILLAS);
  assert.deepEqual(Object.keys(t).sort(),
    ['casosGlobales', 'construccion', 'cuadrilla', 'fecha', 'gestionDiaria', 'reparacion']);
  assert.equal(t.fecha, '12/09/2026');
});

// ---------------------------------------------------------------------------
// 5. Gráficos (RF-06)
// ---------------------------------------------------------------------------

test('las seis zonas se configuran con su tipo de gráfico', () => {
  const t = M.tablero(CASOS, '12/09/2026', CUADRILLAS);
  const serie = M.serieDeSemana(CASOS, '2026', SEMANA);
  const zonas = G.configuraciones(t, serie, 'Semana de prueba');
  assert.deepEqual(zonas.map((z) => z.zona), [
    'gestion-diario', 'gestion-semanal', 'casos-globales', 'reparacion', 'construccion', 'cuadrilla'
  ]);
  assert.equal(zonas[0].config.type, 'bar');
  assert.equal(zonas[1].config.type, 'bar');
  assert.equal(zonas[2].config.type, 'bar');
  assert.equal(zonas[3].config.type, 'pie');
  assert.equal(zonas[4].config.type, 'bar');
  assert.equal(zonas[5].config.type, 'bar');
});

test('el gráfico diario y el de globales usan los números de las tablas', () => {
  const t = M.tablero(CASOS, '12/09/2026', CUADRILLAS);
  assert.deepEqual(G.configGestionDiario(t).data.datasets[0].data, [1, 1]);
  assert.deepEqual(G.configGlobales(t).data.datasets[0].data, [4, 2]);
  assert.deepEqual(G.configReparacion(t).data.datasets[0].data, [1, 1, 0]);
  assert.deepEqual(G.configConstruccion(t).data.datasets[0].data, [1, 1]);
  const cuad = G.configCuadrilla(t);
  assert.deepEqual(cuad.data.labels, ['C1', 'C2']);
  assert.deepEqual(cuad.data.datasets[0].data, [0, 0]); // asignados del 12/09
  assert.deepEqual(cuad.data.datasets[1].data, [0, 1]); // cerrados del 12/09
});

test('el gráfico semanal combina barras con la línea de pendientes (D-34)', () => {
  const serie = M.serieDeSemana(CASOS, '2026', SEMANA);
  const c = G.configSemanal(serie, 'Semana ' + SEMANA);
  assert.equal(c.data.labels.length, 6);
  assert.equal(c.data.datasets.length, 3);
  assert.equal(c.data.datasets[0].label, 'Ingresos del día');
  assert.equal(c.data.datasets[1].label, 'Reparadas del día');
  assert.equal(c.data.datasets[2].label, 'Pendientes al cierre');
  assert.equal(c.data.datasets[2].type, 'line');
  assert.deepEqual(c.data.datasets[2].data, [1, 1, 2, 3, 4, 4]);
  assert.ok(/Semana/.test(c.options.plugins.title.text));
});

test('la librería Chart.js está fijada localmente (RT-07)', () => {
  const ruta = path.join(aqui, '..', 'app', 'lib', 'chart.umd.min.js');
  assert.ok(fs.existsSync(ruta), 'falta app/lib/chart.umd.min.js');
  const contenido = fs.readFileSync(ruta, 'utf8');
  assert.ok(/Chart\.js v4\.4\.7/.test(contenido), 'la versión de Chart.js debe estar fijada');
});
