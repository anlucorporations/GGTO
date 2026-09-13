/*
 * GGTO-v1 · pruebas/pruebas_c1.mjs
 * Pruebas de la lógica pura del ciclo C1 con node:test.
 *   Ejecutar:  node --test pruebas/pruebas_c1.mjs
 * Cubre: contraseña < 8, verificación correcta/incorrecta, caducidad de 90
 * días, cierre sin resolución rechazado, permisos operador vs supervisor,
 * generación de la línea de historial y formato de fecha DD/MM/AAAA.
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

// ---------------------------------------------------------------------------
// Utilidades de prueba
// ---------------------------------------------------------------------------
async function tecnicoDePrueba(extra) {
  const sal = N.generarSal(16, webcrypto);
  const hash = await N.hashClave('Clave2026', sal, subtle);
  return Object.assign({
    nombre: 'Luis Pérez',
    cedula: '12345678',
    P00: '12345',
    clave_hash: hash,
    clave_sal: sal,
    clave_fecha_cambio: N.formatearFecha(new Date()),
    clave_cambio_obligatorio: 'NO',
    status: 'Activo',
    rol: 'Operador'
  }, extra || {});
}

function sumarDias(fecha, dias) {
  const f = new Date(fecha.getTime());
  f.setDate(f.getDate() + dias);
  return f;
}

// ---------------------------------------------------------------------------
// 1. Contraseña de menos de 8 caracteres: se rechaza sin consultar el padrón
// ---------------------------------------------------------------------------
test('rechaza una contraseña de menos de 8 caracteres sin consultar el padrón', async () => {
  assert.equal(N.validarCambioClave('Clave26', 'Clave26').valido, false);
  assert.ok(N.validarCambioClave('Clave26', 'Clave26').errores.includes(N.CONST.MSG.CLAVE_CORTA));
  assert.equal(N.validarCambioClave('Clave2026', 'Clave2026').valido, true);
  assert.ok(N.validarCambioClave('Clave2026', 'Otra2026').errores.includes('Las contraseñas no coinciden'));

  const tecnico = await tecnicoDePrueba();
  // Se pasa un padrón inexistente a propósito: si la longitud se validara después
  // del hash, el resultado cambiaría; el mensaje debe ser el de longitud.
  const r = await N.verificarCredencial([], '12345', 'Clave26', { subtle });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'longitud');
  assert.equal(r.mensaje, N.CONST.MSG.CLAVE_CORTA);

  const r2 = await N.verificarCredencial([tecnico], '12345', 'Clave26', { subtle });
  assert.equal(r2.motivo, 'longitud');
  assert.equal(r2.mensaje, N.CONST.MSG.CLAVE_CORTA);
});

// ---------------------------------------------------------------------------
// 2. Verificación correcta / incorrecta (D-29, D-39)
// ---------------------------------------------------------------------------
test('verifica correctamente la credencial y rechaza la incorrecta con mensaje genérico', async () => {
  const tecnico = await tecnicoDePrueba();
  const padron = [tecnico, await tecnicoDePrueba({ P00: '4321', cedula: '87654321', nombre: 'Ana Gómez' })];

  const ok = await N.verificarCredencial(padron, '12345', 'Clave2026', { subtle });
  assert.equal(ok.ok, true);
  assert.equal(ok.tecnico.P00, '12345');
  assert.equal(ok.exigeCambio, false);
  assert.equal(ok.mensaje, '');

  const malaClave = await N.verificarCredencial(padron, '12345', 'OtraClave9', { subtle });
  assert.equal(malaClave.ok, false);
  assert.equal(malaClave.mensaje, N.CONST.MSG.CREDENCIAL);

  const p00Inexistente = await N.verificarCredencial(padron, '99999', 'Clave2026', { subtle });
  assert.equal(p00Inexistente.ok, false);
  assert.equal(p00Inexistente.mensaje, N.CONST.MSG.CREDENCIAL);

  // El nombre no es identificador válido (D-29).
  const porNombre = await N.verificarCredencial(padron, 'Luis Pérez', 'Clave2026', { subtle });
  assert.equal(porNombre.ok, false);
  assert.equal(porNombre.motivo, 'p00');
  assert.equal(porNombre.mensaje, N.CONST.MSG.CREDENCIAL);

  // Técnico inactivo: mismo mensaje genérico.
  const inactivo = await tecnicoDePrueba({ P00: '555', status: 'Inactivo' });
  const rInactivo = await N.verificarCredencial([inactivo], '555', 'Clave2026', { subtle });
  assert.equal(rInactivo.ok, false);
  assert.equal(rInactivo.mensaje, N.CONST.MSG.CREDENCIAL);

  // Campos vacíos.
  const vacio = await N.verificarCredencial(padron, '', '', { subtle });
  assert.equal(vacio.motivo, 'vacio');
  assert.equal(vacio.mensaje, N.CONST.MSG.SIN_P00);

  // El hash nunca es la contraseña en claro.
  assert.equal(tecnico.clave_hash.length, 64);
  assert.notEqual(tecnico.clave_hash, 'Clave2026');
  assert.ok(!JSON.stringify(padron).includes('Clave2026'));
});

// ---------------------------------------------------------------------------
// 3. Caducidad de 90 días y cambio obligatorio (D-39)
// ---------------------------------------------------------------------------
test('exige el cambio de contraseña a los 90 días o con clave_cambio_obligatorio = SI', async () => {
  const hoy = new Date(2026, 8, 14); // 14/09/2026
  const tecnico = await tecnicoDePrueba({ clave_fecha_cambio: '01/05/2026' });
  const r = await N.verificarCredencial([tecnico], '12345', 'Clave2026', { subtle, fecha: hoy });
  assert.equal(r.ok, true);
  assert.equal(r.exigeCambio, true);
  assert.equal(r.mensajeVigencia, N.CONST.MSG.CADUCADA);

  // Justo 90 días: todavía vigente.
  const alLimite = await tecnicoDePrueba({ clave_fecha_cambio: '16/06/2026' });
  assert.equal(N.diasEntre('16/06/2026', '14/09/2026'), 90);
  assert.equal(N.revisarVigenciaClave(alLimite, hoy).exigeCambio, false);

  // 91 días: caducada.
  const caducada = await tecnicoDePrueba({ clave_fecha_cambio: '15/06/2026' });
  assert.equal(N.diasEntre('15/06/2026', '14/09/2026'), 91);
  const v = N.revisarVigenciaClave(caducada, hoy);
  assert.equal(v.exigeCambio, true);
  assert.equal(v.motivo, 'caducada');

  // Cambio obligatorio por restablecimiento del supervisor, aunque la fecha sea de hoy.
  const obligada = await tecnicoDePrueba({
    clave_cambio_obligatorio: 'SI',
    clave_fecha_cambio: '14/09/2026'
  });
  const o = await N.verificarCredencial([obligada], '12345', 'Clave2026', { subtle, fecha: hoy });
  assert.equal(o.ok, true);
  assert.equal(o.exigeCambio, true);
  assert.equal(o.mensajeVigencia, N.CONST.MSG.CAMBIO_OBLIGATORIO);

  // Fecha incoherente: no se fuerza el cambio por un valor que no es fecha.
  const sinFecha = await tecnicoDePrueba({ clave_fecha_cambio: '' });
  assert.equal(N.revisarVigenciaClave(sinFecha, hoy).exigeCambio, false);
});

// ---------------------------------------------------------------------------
// 4. Cierre bloqueante: sin resolucion ni fechaResolucion (D-20, RNF-10)
// ---------------------------------------------------------------------------
test('rechaza el cierre sin resolución y sin fecha de resolución', () => {
  const sector = [{ id: '1', nombre: 'Prados del Este', vias: ['Av. Principal'] }];

  const sinNada = N.validarCierre({}, { sectores: sector });
  assert.equal(sinNada.valido, false);
  assert.ok(sinNada.errores.includes(N.CONST.MSG.RESOLUCION_FALTA));
  assert.ok(sinNada.errores.includes(N.CONST.MSG.FECHA_RESOLUCION_FALTA));

  const soloResolucion = N.validarCierre({ resolucion: 'COS' }, { sectores: sector });
  assert.equal(soloResolucion.valido, false);
  assert.ok(soloResolucion.errores.includes(N.CONST.MSG.FECHA_RESOLUCION_FALTA));
  assert.equal(soloResolucion.errores.includes(N.CONST.MSG.RESOLUCION_FALTA), false);

  const fechaImposible = N.validarCierre({ resolucion: 'COS', fechaResolucion: '31/02/2026' }, { sectores: sector });
  assert.equal(fechaImposible.valido, false);
  assert.ok(fechaImposible.errores.includes(N.CONST.MSG.FECHA_INVALIDA));

  const enumMalo = N.validarCierre({ resolucion: 'XXX', fechaResolucion: '13/09/2026' }, { sectores: sector });
  assert.equal(enumMalo.valido, false);

  const sacasMalo = N.validarCierre({ resolucion: 'COS', fechaResolucion: '13/09/2026', sacas: 'TAL VEZ' }, { sectores: sector });
  assert.equal(sacasMalo.valido, false);
  assert.ok(sacasMalo.errores.includes(N.CONST.MSG.SACAS_INVALIDO));

  const sectorInexistente = N.validarCierre({ resolucion: 'COS', fechaResolucion: '13/09/2026', sector: '7' }, { sectores: sector });
  assert.equal(sectorInexistente.valido, false);
  assert.ok(sectorInexistente.errores.includes(N.CONST.MSG.SECTOR_INEXISTENTE));

  const observacionesLargas = N.validarCierre({
    resolucion: 'COS', fechaResolucion: '13/09/2026', sector: '1', observaciones: 'x'.repeat(501)
  }, { sectores: sector });
  assert.equal(observacionesLargas.valido, false);

  const correcto = N.validarCierre({
    resolucion: 'COS', fechaResolucion: '13/09/2026', sacas: 'NO',
    observaciones: 'Reparado en sitio', sector: '1'
  }, { sectores: sector });
  assert.equal(correcto.valido, true);
  assert.deepEqual(correcto.errores, []);

  // Edición en línea: enums de clase, nivel y tipo_abonado.
  assert.equal(N.validarEdicionCaso({ clase: 'REP', nivel: 'COM', tipo_abonado: 'EMP' }).valido, true);
  assert.equal(N.validarEdicionCaso({ nivel: 'EMP' }).valido, false);
  assert.equal(N.validarEdicionCaso({ clase: 'XXX' }).valido, false);
  assert.equal(N.validarEdicionCaso({ tipo_abonado: 'XXX' }).valido, false);
});

// ---------------------------------------------------------------------------
// 5. Permisos y ámbito: operador vs supervisor (D-35, RNF-12)
// ---------------------------------------------------------------------------
test('aplica la matriz de permisos y el ámbito de cuadrilla', async () => {
  const cuadrillas = [
    { id: 'C1', nombre: 'Cuadrilla 1', tecnicos: ['12345'], status: 'Activa' },
    { id: 'C2', nombre: 'Cuadrilla 2', tecnicos: ['4321'], status: 'Activa' },
    { id: 'C3', nombre: 'Cuadrilla 3', tecnicos: ['777'], status: 'Inactiva' }
  ];
  const casoC1 = { id_averia: 'A-1', 'Reparador Principal': 'C1', status: 'PEND' };
  const casoC2 = { id_averia: 'A-2', 'Reparador Principal': 'C2', status: 'PEND' };

  // Rol por defecto y rol explícito.
  assert.equal(N.resolverRol({ P00: '12345' }), 'Operador');
  assert.equal(N.resolverRol({ P00: '00001', rol: 'Supervisor' }), 'Supervisor');
  assert.equal(N.resolverRol(null), null);

  // La matriz: prohibido para el operador, permitido para el supervisor.
  ['config.central', 'config.tecnicos', 'config.flota', 'config.cuadrillas',
    'config.sectores', 'config.claves', 'gestion.bandeja', 'despacho.generar',
    'respaldo.ejecutar', 'casos.auditoria', 'monitoreo.ver'].forEach((accion) => {
    assert.equal(N.permite('Operador', accion), false, accion + ' debe estar prohibida al operador');
    assert.equal(N.permite('Supervisor', accion), true, accion + ' debe estar permitida al supervisor');
  });
  ['sesion.iniciar', 'casos.consultar', 'casos.editar', 'casos.cerrar', 'casos.alta',
    'ingesta.ejecutar', 'sector.cola', 'entorno.diagnostico'].forEach((accion) => {
    assert.equal(N.permite('Operador', accion), true, accion + ' debe estar permitida al operador');
  });
  assert.equal(N.permite('Administrador', 'config.central'), false);
  assert.equal(N.permite(null, 'casos.consultar'), false);

  // Ámbito del operador con cuadrilla C1.
  const ambitoOperador = N.ambitoSesion({ rol: 'Operador', tecnico: { P00: '12345' } }, cuadrillas);
  assert.equal(ambitoOperador.cuadrilla, 'C1');
  assert.equal(ambitoOperador.soloLectura, false);
  assert.equal(N.casoVisible(ambitoOperador, casoC1), true);
  assert.equal(N.casoVisible(ambitoOperador, casoC2), false);
  assert.equal(N.autorizar(ambitoOperador, 'casos.cerrar', casoC1).permitido, true);
  const negado = N.autorizar(ambitoOperador, 'casos.cerrar', casoC2);
  assert.equal(negado.permitido, false);
  assert.equal(negado.mensaje, N.CONST.MSG.OTRA_CUADRILLA);
  assert.equal(N.autorizar(ambitoOperador, 'config.central', casoC1).mensaje, N.CONST.MSG.ROL);

  // Operador sin cuadrilla activa: consulta global en solo lectura.
  const sinCuadrilla = N.ambitoSesion({ rol: 'Operador', tecnico: { P00: '000' } }, cuadrillas);
  assert.equal(sinCuadrilla.soloLectura, true);
  assert.equal(sinCuadrilla.motivo, N.CONST.MSG.SIN_CUADRILLA);
  assert.equal(N.casoVisible(sinCuadrilla, casoC2), true);
  assert.equal(N.puedeEditarCaso(sinCuadrilla, casoC2), false);
  assert.equal(N.autorizar(sinCuadrilla, 'casos.editar', casoC2).mensaje, N.CONST.MSG.SIN_CUADRILLA);

  // La cuadrilla inactiva no cuenta.
  const ambitoInactiva = N.ambitoSesion({ rol: 'Operador', tecnico: { P00: '777' } }, cuadrillas);
  assert.equal(ambitoInactiva.cuadrilla, '');
  assert.equal(ambitoInactiva.soloLectura, true);

  // Supervisor: todo visible y editable.
  const ambitoSupervisor = N.ambitoSesion({ rol: 'Supervisor', tecnico: { P00: '00001' } }, cuadrillas);
  assert.equal(N.casoVisible(ambitoSupervisor, casoC2), true);
  assert.equal(N.puedeEditarCaso(ambitoSupervisor, casoC2), true);
  assert.equal(N.autorizar(ambitoSupervisor, 'casos.cerrar', casoC2).permitido, true);

  // Sin sesión, nada.
  assert.equal(N.autorizar(null, 'casos.consultar', casoC1).permitido, false);
  assert.equal(N.autorizar(null, 'casos.consultar', casoC1).mensaje, N.CONST.MSG.SIN_SESION);
});

// ---------------------------------------------------------------------------
// 6. Historial inmutable (D-56, RNF-09)
// ---------------------------------------------------------------------------
test('genera la línea de historial y las líneas de un cambio de caso', () => {
  const linea = N.lineaHistorial({
    fecha_hora: '13/09/2026 10:05',
    operador: '12345',
    id_averia: '2026-00123',
    campo: 'status',
    valor_anterior: 'PEND',
    valor_nuevo: 'CERRADO',
    accion: 'cierre'
  });
  assert.equal(linea.indexOf('\n'), -1, 'la línea no lleva salto interno');
  const obj = JSON.parse(linea);
  assert.deepEqual(Object.keys(obj),
    ['fecha_hora', 'operador', 'id_averia', 'campo', 'valor_anterior', 'valor_nuevo', 'accion']);
  assert.equal(obj.fecha_hora, '13/09/2026 10:05');
  assert.equal(obj.operador, '12345');
  assert.equal(obj.accion, 'cierre');
  assert.equal(linea, '{"fecha_hora":"13/09/2026 10:05","operador":"12345","id_averia":"2026-00123",' +
    '"campo":"status","valor_anterior":"PEND","valor_nuevo":"CERRADO","accion":"cierre"}');

  assert.throws(() => N.lineaHistorial({ accion: 'borrado', campo: 'status' }),
    /accion de historial invalida/);

  // Una línea por campo modificado, con valor anterior y nuevo.
  const anterior = { status: 'PEND', clase: 'CNS', nivel: 'COM', observaciones: '' };
  const nuevo = { status: 'CERRADO', clase: 'REP', nivel: 'COM', observaciones: 'Reparado' };
  const lineas = N.lineasDeCambio(anterior, nuevo, {
    fecha_hora: '13/09/2026 10:05', operador: '12345', id_averia: '2026-00123', accion: 'cierre'
  });
  assert.equal(lineas.length, 3);
  assert.equal(JSON.parse(lineas[0]).campo, 'status');
  assert.equal(JSON.parse(lineas[0]).valor_anterior, 'PEND');
  assert.equal(JSON.parse(lineas[0]).valor_nuevo, 'CERRADO');
  assert.equal(JSON.parse(lineas[0]).accion, 'cierre');
  assert.equal(JSON.parse(lineas[1]).campo, 'clase');
  assert.equal(JSON.parse(lineas[2]).campo, 'observaciones');
  assert.equal(JSON.parse(lineas[2]).valor_nuevo, 'Reparado');

  // Sin cambios no hay líneas (nunca se inventa una fila).
  assert.deepEqual(N.lineasDeCambio(anterior, anterior, { accion: 'edicion', operador: '1', id_averia: 'X' }), []);

  // Lectura tolerante: una línea corrupta no invalida las demás (D-56).
  const jsonl = linea + '\n{esto no es json}\n' + N.lineaHistorial({
    fecha_hora: '13/09/2026 11:00', operador: '67890', id_averia: '2026-00456',
    campo: 'clase', valor_anterior: 'REP', valor_nuevo: 'CNS', accion: 'edicion'
  });
  const leido = N.parsearHistorial(jsonl);
  assert.equal(leido.registros.length, 2);
  assert.equal(leido.corruptas, 1);
  const deCaso = N.historialDeCaso(jsonl, '2026-00123');
  assert.equal(deCaso.filas.length, 1);
  assert.equal(deCaso.filas[0].campo, 'status');

  // Solo se añade: el resultado es el texto previo más el bloque nuevo.
  const previo = 'l1\n';
  const bloque = N.lineaHistorial({
    fecha_hora: '13/09/2026 12:00', operador: '1', id_averia: 'X', campo: 'nivel',
    valor_anterior: 'COM', valor_nuevo: 'REF', accion: 'edicion'
  }) + '\n';
  assert.ok((previo + bloque).startsWith(previo));
});

// ---------------------------------------------------------------------------
// 7. Formato de fechas DD/MM/AAAA y nombres de respaldo (RNF-06, D-42, D-49)
// ---------------------------------------------------------------------------
test('formatea y valida fechas en DD/MM/AAAA y compone los nombres de respaldo', () => {
  assert.equal(N.formatearFecha(new Date(2026, 8, 3)), '03/09/2026');
  assert.equal(N.formatearFechaHora(new Date(2026, 8, 3, 9, 5)), '03/09/2026 09:05');
  assert.equal(N.formatearFecha('no es fecha'), '');

  assert.equal(N.esFechaValida('13/09/2026'), true);
  assert.equal(N.esFechaValida('31/02/2026'), false);
  assert.equal(N.esFechaValida('2026-09-13'), false);
  assert.equal(N.esFechaValida('1/9/2026'), false);
  assert.equal(N.esFechaValida(''), false);
  assert.equal(N.esFechaValida(null), false);
  assert.equal(N.parsearFecha('13/09/2026').getDate(), 13);

  // Comparación por texto en formato fijo (H-29), no por rango calculado.
  assert.equal(N.compararTexto('01/09/2026', '13/09/2026'), -1);
  assert.equal(N.compararTexto('20/09/2026', '13/09/2026'), 1);
  assert.equal(N.compararTexto('13/09/2026', '13/09/2026'), 0);

  const fecha = new Date(2026, 8, 13, 9, 5);
  assert.equal(N.marcaArchivo(fecha), '2026-09-13_0905');
  assert.equal(N.nombreRespaldo(fecha), 'averias_2026-09-13_0905.bak');
  assert.equal(N.nombreCopiaCierre(fecha), 'averias_2026-09-13_0905.json');

  // Se conservan las 10 últimas versiones .bak (D-42).
  const nombres = [];
  for (let i = 1; i <= 13; i++) {
    nombres.push('averias_2026-09-' + String(i).padStart(2, '0') + '_0900.bak');
  }
  nombres.push('central.json');
  nombres.push('averias_2026-09-14_0900.tmp');
  const sobran = N.respaldosAExpedir(nombres);
  assert.equal(sobran.length, 3);
  assert.deepEqual(sobran, ['averias_2026-09-01_0900.bak', 'averias_2026-09-02_0900.bak', 'averias_2026-09-03_0900.bak']);
  assert.equal(N.respaldosAExpedir(nombres.slice(3)).length, 0);
});

// ---------------------------------------------------------------------------
// 8. Auxiliares: enums, teléfono, tipo calculado y estructuras iniciales vacías
// ---------------------------------------------------------------------------
test('valida enums, teléfono, tipo calculado y estructuras iniciales', () => {
  assert.equal(N.esEnum('REP', N.CONST.CLASE), true);
  assert.equal(N.esEnum('rep', N.CONST.CLASE), false);
  assert.equal(N.telefonoValido('04141234567'), true);
  assert.equal(N.telefonoValido('123456'), false);
  assert.equal(N.telefonoValido('0414-1234567'), false);

  assert.equal(N.tipoCalculado({ clase: 'REP', nivel: 'COM' }), 'REP-COM');
  assert.equal(N.tipoCalculado({ clase: 'CNS', nivel: 'REF' }), 'CNS-REF');
  assert.equal(N.tipoCalculado({}), '');

  assert.equal(N.estaAbierto({ status: 'PEND' }), true);
  assert.equal(N.estaAbierto({ status: 'GESTION' }), true);
  assert.equal(N.estaAbierto({ status: 'CERRADO' }), false);

  // Sin datos inventados: los padrones se inicializan vacíos.
  const base = N.estructurasIniciales();
  assert.deepEqual(base['averias.json'], []);
  assert.deepEqual(base['tecnicos.json'], []);
  assert.deepEqual(base['flota.json'], []);
  assert.deepEqual(base['cuadrillas.json'], []);
  assert.deepEqual(base['sectores.json'], []);
  assert.deepEqual(base['despacho.json'], []);
  assert.equal(base['historial.jsonl'], '');
  assert.equal(base['central.json'].nombre_central, 'FRANCISCO SALIAS');
  assert.equal(base['central.json'].area, 'AREA 4');
  assert.equal(base['central.json'].central, '2324X');
  assert.equal(base['central.json'].municipio, 'BARUTA');
  assert.equal(base['central.json'].parroquia, 'BARUTA');
  assert.equal(base['central.json'].estado_geografico, 'BOLIVARIANO MIRANDA');
  assert.equal(base['central.json'].capital_estado, 'LOS TEQUES');
  assert.equal(base['central.json'].distrito, '10204');
  assert.equal(base['central.json'].estado_operativo, 'MIRANDA-2');
  assert.equal(base['claves_clasificacion.json'].claves.length, 3);
  assert.equal(base['claves_clasificacion.json'].normalizacion, 'normalizada');
  assert.equal(base['claves_clasificacion.json'].umbral_concentracion, 3);
  assert.equal(base['estructura.json'].columnas_esperadas, 80);

  // Serialización estable con salto de línea final (UTF-8 sin BOM).
  const serializado = N.serializarJSON(base['central.json']);
  assert.ok(serializado.endsWith('\n'));
  assert.equal(serializado.charCodeAt(0), '{'.charCodeAt(0));
});

// ---------------------------------------------------------------------------
// 10. Alta del primer supervisor (bootstrap del padrón) y su credencial
// ---------------------------------------------------------------------------
test('el primer supervisor creado queda con rol Supervisor y credencial válida', async () => {
  // El alta desde la página escribe exactamente estos campos (app.js).
  const sal = N.generarSal(16, webcrypto);
  const clave = 'Primera2026';
  const registro = {
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
  assert.equal(N.resolverRol(registro), 'Supervisor');
  assert.ok(N.permite(N.resolverRol(registro), 'config.tecnicos'));
  assert.ok(N.permite(N.resolverRol(registro), 'config.central'));

  const r = await N.verificarCredencial([registro], '00001', clave, { subtle });
  assert.equal(r.ok, true);
  assert.equal(r.exigeCambio, true, 'el alta obliga a cambiar la contraseña (D-39)');
  assert.equal(r.mensajeVigencia, N.CONST.MSG.CAMBIO_OBLIGATORIO);

  // Tras el cambio obligatorio el rol no se degrada por accidente.
  const actualizado = Object.assign({}, registro, { clave_cambio_obligatorio: 'NO' });
  assert.equal(N.resolverRol(actualizado), 'Supervisor');
  assert.equal((await N.verificarCredencial([actualizado], '00001', clave, { subtle })).exigeCambio, false);

  // Un técnico sin campo `rol` es Operador (nunca supervisor por accidente).
  const sinRol = Object.assign({}, registro, { rol: undefined, P00: '00002' });
  assert.equal(N.resolverRol(sinRol), 'Operador');
  assert.equal(N.permite(N.resolverRol(sinRol), 'config.tecnicos'), false);
});

test('define la sesión de la jornada en 8 horas y el hash con sal de 64 hex', async () => {
  assert.equal(N.CONST.MSG_HORAS_SESION, 8);
  assert.equal(N.CONST.MSG_DIAS_CLAVE, 90);

  const salA = N.generarSal(16, webcrypto);
  const salB = N.generarSal(16, webcrypto);
  assert.equal(salA.length, 32);
  assert.notEqual(salA, salB);
  const h1 = await N.hashClave('Clave2026', salA, subtle);
  const h2 = await N.hashClave('Clave2026', salA, subtle);
  const h3 = await N.hashClave('Clave2026', salB, subtle);
  assert.equal(h1, h2, 'misma sal y misma clave producen el mismo hash');
  assert.notEqual(h1, h3, 'con sal distinta el hash cambia');
  assert.equal(h1.length, 64);
  assert.equal(N.hashIgual(h1, h1), true);
  assert.equal(N.hashIgual(h1, h3), false);
  assert.equal(N.hashIgual(h1.toUpperCase(), h1), true);
});
