/*
 * GGTO-v1 · pruebas/pruebas_c3.mjs
 * Pruebas del ciclo C3 (PANEL y bandeja GESTION) con node:test.
 *
 *   Ejecutar:  node --test pruebas/pruebas_c3.mjs
 *
 * Cubre: búsqueda por id_averia y por teléfono (CU-11), alta manual con lista
 * cerrada e id MAN- (CU-14, D-18), actualización de gestión con cierre
 * bloqueante (CU-12, D-20), bandeja GESTION con su orden y reclasificación
 * (CU-13) y la matriz de permisos operador/supervisor (D-35, RNF-12).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(aqui, '..', 'app', 'js');

// nucleo.js publica GGTO_NUCLEO en globalThis al cargarse.
const N = require(path.join(app, 'nucleo.js'));
const P = require(path.join(app, 'panel.js'));
const G = require(path.join(app, 'gestion.js'));

const HOY = '13/09/2026';
const MARCA = '13/09/2026 18:30';
const SECTORES = [{ id: 'S1', nombre: 'Cumbres', vias: ['CALLE FICTICIA'] }];

const CASOS = [
  {
    id_averia: '90000001', telefono: '90000117', nombre: 'ABONADO', direccion: 'CALLE FICTICIA',
    sector: 'S1', status: 'GESTION', clase: 'REP', nivel: 'COM', tipo_abonado: 'RES',
    'Reparador Principal': 'C1', ingreso: '12/09/2026', problema_reporte: 'NAVEGA LENTO',
    resolucion: '', fechaResolucion: '', observaciones: '', sacas: ''
  },
  {
    id_averia: '28516505', telefono: '4000000002', nombre: 'ABONADO DOS', direccion: 'CALLE DEMO',
    sector: '', status: 'PEND', clase: 'REP', nivel: 'REF', tipo_abonado: 'EMP',
    'Reparador Principal': 'C2', ingreso: '10/09/2026', problema_reporte: 'SIN TONO',
    resolucion: '', fechaResolucion: '', observaciones: '', sacas: ''
  },
  {
    id_averia: '28516506', telefono: '4000000002', nombre: 'OTRO CON EL MISMO TELEFONO',
    direccion: 'OTRA DIRECCION', sector: 'S1', status: 'GESTION', clase: 'CNS', nivel: 'COM',
    tipo_abonado: 'RES', 'Reparador Principal': 'C1', ingreso: '11/09/2026',
    problema_reporte: 'FALLA DE FIBRA', resolucion: '', fechaResolucion: '', observaciones: '', sacas: ''
  },
  {
    id_averia: '28516507', telefono: '4120000000', nombre: 'CERRADO', direccion: 'X',
    sector: 'S1', status: 'CERRADO', clase: 'REP', nivel: 'COM', tipo_abonado: 'RES',
    'Reparador Principal': 'C1', ingreso: '09/09/2026', problema_reporte: 'X',
    resolucion: 'IVR', fechaResolucion: '10/09/2026', observaciones: '', sacas: 'SI'
  }
];

// ---------------------------------------------------------------------------
// 1. Búsqueda (CU-11)
// ---------------------------------------------------------------------------

test('busca por id de avería exacto', () => {
  const r = P.buscarCaso(CASOS, '28516505');
  assert.equal(r.encontrado, true);
  assert.equal(r.criterio, 'id_averia');
  assert.equal(r.caso.nombre, 'ABONADO DOS');
});

test('busca por teléfono y avisa si hay varios casos', () => {
  const r = P.buscarCaso(CASOS, '4000000002');
  assert.equal(r.encontrado, true);
  assert.equal(r.criterio, 'telefono');
  assert.equal(r.multiple, true);
  assert.equal(r.coincidencias.length, 2);
});

test('busca por teléfono con formato y sin encontrar', () => {
  assert.equal(P.buscarCaso(CASOS, '701-400.0848').caso.id_averia, '90000001');
  const r = P.buscarCaso(CASOS, '99999999');
  assert.equal(r.encontrado, false);
  assert.ok(r.motivo.length > 0);
  assert.equal(P.buscarCaso(CASOS, '   ').encontrado, false);
});

// ---------------------------------------------------------------------------
// 2. Alta manual (CU-14, D-18)
// ---------------------------------------------------------------------------

test('genera el siguiente id MAN- libre', () => {
  assert.equal(P.siguienteIdManual([]), 'MAN-0001');
  assert.equal(P.siguienteIdManual([{ id_averia: 'MAN-0001' }, { id_averia: '90000001' }]), 'MAN-0002');
  assert.equal(P.siguienteIdManual([{ id_averia: 'MAN-0002' }, { id_averia: 'MAN-0001' }]), 'MAN-0003');
  // Hueco en la numeración: se reutiliza el primero libre.
  assert.equal(P.siguienteIdManual([{ id_averia: 'MAN-0002' }, { id_averia: 'MAN-0003' }]), 'MAN-0001');
});

test('la lista cerrada del alta manual tiene los 11 campos de D-18', () => {
  const campos = P.camposAlta().map((c) => c.campo);
  assert.deepEqual(campos, [
    'fecha_reporte', 'telefono', 'nombre', 'direccion', 'contacto', 'problema_reporte',
    'sector', 'clase', 'nivel', 'tipo_abonado', 'observaciones'
  ]);
});

test('valida un alta manual correcta y arma los 36 campos del maestro', () => {
  const r = P.validarAltaManual({
    id_averia: 'MAN-0001', fecha_reporte: HOY, telefono: '4241234567', nombre: 'Ana',
    direccion: 'Calle 1', problema_reporte: 'Sin tono', sector: 'S1',
    clase: 'REP', nivel: 'COM', tipo_abonado: 'RES', observaciones: 'alta manual'
  }, { hoy: HOY, marca: MARCA, operador: '12345', cuadrilla: 'C1', sectores: SECTORES });
  assert.equal(r.valido, true, JSON.stringify(r.errores));
  assert.equal(Object.keys(r.registro).length, 36);
  assert.equal(r.registro.status, 'PEND');
  assert.equal(r.registro.clase, 'REP');
  assert.equal(r.registro.nivel, 'COM');
  assert.equal(r.registro.tipo_abonado, 'RES');
  assert.equal(r.registro.ingreso, HOY);
  assert.equal(r.registro.usuario_modificacion, '12345');
  assert.equal(r.registro['Reparador Principal'], 'C1');
  assert.equal(r.registro.fecha_asignacion, HOY);
  assert.equal(r.registro.fecha_modificacion, MARCA);
});

test('rechaza el alta manual si faltan obligatorios o hay valores inválidos', () => {
  const base = {
    id_averia: 'MAN-0001', fecha_reporte: HOY, telefono: '4241234567', nombre: 'Ana',
    direccion: 'Calle 1', problema_reporte: 'Sin tono'
  };
  const sinTelefono = P.validarAltaManual(Object.assign({}, base, { telefono: '' }), { hoy: HOY });
  assert.equal(sinTelefono.valido, false);
  assert.ok(sinTelefono.errores.some((e) => /Teléfono/.test(e)));

  const telCorto = P.validarAltaManual(Object.assign({}, base, { telefono: '123' }), { hoy: HOY });
  assert.equal(telCorto.valido, false);

  const sinNombre = P.validarAltaManual(Object.assign({}, base, { nombre: '' }), { hoy: HOY });
  assert.equal(sinNombre.valido, false);

  const fechaMala = P.validarAltaManual(Object.assign({}, base, { fecha_reporte: '31/02/2026' }), { hoy: HOY });
  assert.equal(fechaMala.valido, false);
  assert.ok(fechaMala.errores.some((e) => /Fecha inválida/.test(e)));

  const claseMala = P.validarAltaManual(Object.assign({}, base, { clase: 'XXX' }), { hoy: HOY });
  assert.equal(claseMala.valido, false);

  const sectorMalo = P.validarAltaManual(Object.assign({}, base, { sector: 'S9' }), { hoy: HOY, sectores: SECTORES });
  assert.equal(sectorMalo.valido, false);
  assert.ok(sectorMalo.errores.some((e) => /sector no existe/.test(e)));
});

// ---------------------------------------------------------------------------
// 3. Actualización de gestión y cierre bloqueante (CU-12, D-20)
// ---------------------------------------------------------------------------

test('no permite CERRADO sin resolución ni fecha (cierre bloqueante)', () => {
  const r = P.aplicarGestion(CASOS[0], { status: 'CERRADO' }, { operador: '12345', marca: MARCA, sectores: SECTORES });
  assert.equal(r.valido, false);
  assert.ok(r.errores.some((e) => /resolución/.test(e)));
});

test('cierra un caso con resolución y fecha válidas', () => {
  const r = P.aplicarGestion(CASOS[0], {
    status: 'CERRADO', resolucion: 'IVR', fechaResolucion: HOY, sacas: 'SI', observaciones: 'resuelto'
  }, { operador: '12345', marca: MARCA, sectores: SECTORES });
  assert.equal(r.valido, true, JSON.stringify(r.errores));
  assert.equal(r.caso.status, 'CERRADO');
  assert.equal(r.caso.resolucion, 'IVR');
  assert.equal(r.caso.fechaResolucion, HOY);
  assert.equal(r.accion, 'cierre');
  assert.equal(r.caso.usuario_modificacion, '12345');
  assert.equal(r.caso.fecha_modificacion, MARCA);
});

test('valida enums de estatus, resolución y sacas', () => {
  assert.equal(P.aplicarGestion(CASOS[0], { status: 'LOQUE SEA' }, {}).valido, false);
  const sacasMal = P.aplicarGestion(CASOS[0], { status: 'PEND', sacas: 'TAL VEZ' }, {});
  assert.equal(sacasMal.valido, false);
  const resMal = P.aplicarGestion(CASOS[0], { status: 'CERRADO', resolucion: 'XXX', fechaResolucion: HOY }, { sectores: SECTORES });
  assert.equal(resMal.valido, false);
  // Pasar a GESTION no exige resolución (no es cierre).
  const aGestion = P.aplicarGestion(CASOS[0], { status: 'GESTION' }, { operador: '12345', marca: MARCA, sectores: SECTORES });
  assert.equal(aGestion.valido, true);
  assert.equal(aGestion.accion, 'edicion');
});

// ---------------------------------------------------------------------------
// 4. Bandeja GESTION (CU-13)
// ---------------------------------------------------------------------------

test('la bandeja solo contiene los casos en GESTION', () => {
  const enGestion = G.casosEnGestion(CASOS);
  assert.equal(enGestion.length, 2);
  assert.ok(enGestion.every((c) => c.status === 'GESTION'));
});

test('ordena la cola por antigüedad, sector y dirección', () => {
  const porAntiguedad = G.ordenarGestion(G.casosEnGestion(CASOS), 'antiguedad');
  assert.deepEqual(porAntiguedad.map((c) => c.id_averia), ['28516506', '90000001']);
  // Por sector: los que están en la cola de CU-09 (sin sector) van al final.
  const porSector = G.ordenarGestion([{ sector: 'S2' }, { sector: '' }, { sector: 'S1' }], 'sector');
  assert.deepEqual(porSector.map((c) => c.sector), ['S1', 'S2', '']);
});

test('resume la bandeja por sector, tipo y referidos', () => {
  const r = G.resumenGestion(G.casosEnGestion(CASOS));
  assert.equal(r.total, 2);
  assert.equal(r.sinSector, 0);
  assert.equal(r.empresariales, 0);
  assert.equal(r.referidos, 0);
  const conVacios = G.resumenGestion([{ status: 'GESTION', sector: '', tipo_abonado: 'EMP', nivel: 'REF' }]);
  assert.equal(conVacios.sinSector, 1);
  assert.equal(conVacios.empresariales, 1);
  assert.equal(conVacios.referidos, 1);
});

test('reclasifica y pasa el caso a PEND', () => {
  const r = G.reclasificar(CASOS[0], { clase: 'CNS', nivel: 'REF', tipo_abonado: 'EMP', pasarAPend: true, observaciones: 'verificado' });
  assert.equal(r.valido, true, JSON.stringify(r.errores));
  assert.equal(r.caso.clase, 'CNS');
  assert.equal(r.caso.nivel, 'REF');
  assert.equal(r.caso.tipo_abonado, 'EMP');
  assert.equal(r.caso.status, 'PEND');
  assert.equal(r.caso.observaciones, 'verificado');

  const malo = G.reclasificar(CASOS[0], { clase: 'ZZZ' });
  assert.equal(malo.valido, false);
});

// ---------------------------------------------------------------------------
// 5. Permisos (D-35, RNF-12)
// ---------------------------------------------------------------------------

test('la bandeja GESTION es del supervisor, no del operador', () => {
  const operador = { rol: 'Operador', cuadrilla: 'C1', soloLectura: false };
  const supervisor = { rol: 'Supervisor', cuadrilla: '', soloLectura: false };
  assert.equal(N.autorizar(operador, 'gestion.bandeja').permitido, false);
  assert.equal(N.autorizar(supervisor, 'gestion.bandeja').permitido, true);
});

test('el operador solo cierra los casos de su cuadrilla', () => {
  const operador = { rol: 'Operador', cuadrilla: 'C1', soloLectura: false };
  assert.equal(N.autorizar(operador, 'casos.cerrar', CASOS[0]).permitido, true);  // C1
  assert.equal(N.autorizar(operador, 'casos.cerrar', CASOS[1]).permitido, false); // C2
  const supervisor = { rol: 'Supervisor', cuadrilla: '', soloLectura: false };
  assert.equal(N.autorizar(supervisor, 'casos.cerrar', CASOS[1]).permitido, true);
});

test('el operador puede ingerir y dar de alta, pero no tocar los padrones', () => {
  const operador = { rol: 'Operador', cuadrilla: 'C1', soloLectura: false };
  assert.equal(N.autorizar(operador, 'ingesta.ejecutar').permitido, true);
  assert.equal(N.autorizar(operador, 'casos.alta').permitido, true);
  assert.equal(N.autorizar(operador, 'config.central').permitido, false);
  assert.equal(N.autorizar(operador, 'casos.auditoria').permitido, false);
  assert.equal(N.autorizar(null, 'casos.consultar', CASOS[0]).permitido, false);
});
