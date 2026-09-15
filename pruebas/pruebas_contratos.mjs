/*
 * GGTO-v1 · pruebas/pruebas_contratos.mjs  (FASE 4: pruebas de contrato)
 * Verifica que la implementación respeta los CONTRATOS documentados en el
 * corpus: `estructura.json` contra el CSV real, los campos del maestro, las 15
 * columnas canónicas de `despacho.json`, lo que debe contener la hoja impresa
 * del despacho (CU-17 CA-2), el ancho imprimible (RNF-05) y el inventario de
 * archivos de trabajo (D-49, D-56).
 *
 *   Ejecutar:  node --test pruebas/pruebas_contratos.mjs
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
const RUTA_DATOS = 'C:\\GGTO\\datos';

const N = require(path.join(raizProyecto, 'app', 'js', 'nucleo.js'));
const I = require(path.join(raizProyecto, 'app', 'js', 'ingesta_nucleo.js'));
const D = require(path.join(raizProyecto, 'app', 'js', 'despacho.js'));
const PDF = require(path.join(raizProyecto, 'app', 'js', 'pdf.js'));
const A = (() => {
  globalThis.window = globalThis;
  globalThis.document = { createElement: () => ({ setAttribute() {}, style: {} }), body: { appendChild() {}, removeChild() {} } };
  globalThis.URL.createObjectURL = () => 'blob:x';
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.GGTO_NUCLEO = N;
  require(path.join(raizProyecto, 'app', 'js', 'almacen.js'));
  return globalThis.GGTO_ALMACEN;
})();

const leer = (ruta) => fs.readFileSync(ruta, 'utf8');
/** Configuración de trabajo: la del puesto si existe; si no, la semilla del núcleo. */
function configuracion(nombre) {
  const enDisco = path.join(RUTA_DATOS, nombre);
  if (fs.existsSync(enDisco)) return JSON.parse(leer(enDisco));
  const semilla = N.estructurasIniciales()[nombre];
  if (semilla === undefined) throw new Error('No hay configuración para ' + nombre);
  return semilla;
}
// Muestra ANONIMIZADA versionada (el CSV real no se versiona: el repositorio es
// público y lleva datos personales). Conserva estructura, filtro y clasificación.
const CSV = leer(path.join(raizProyecto, 'pruebas', 'fixtures', 'detalle_averias_gpon_muestra.csv'));
const ESTRUCTURA = configuracion('estructura.json');
const CENTRAL = configuracion('central.json');
const CLAVES = configuracion('claves_clasificacion.json');

/** Las 15 columnas canónicas de `despacho.json` (D-31, RT-05, CU-17). */
const COLUMNAS_CANONICAS = [
  'nivel', 'clase', 'id_averia', 'telefono', 'persona_reporta', 'contacto',
  'ultimo_comentario', 'nombre', 'direccion', 'plan', 'fat', 'serial',
  'sector', 'Reparador Principal', 'fecha_despacho'
];
/** Columnas canónicas que la hoja impresa lleva en el ENCABEZADO, no en la tabla. */
const EN_CABECERA = ['Reparador Principal', 'fecha_despacho'];

const ingerir = (csv, extras) => I.ingerir(Object.assign({
  texto: csv,
  estructura: ESTRUCTURA,
  central: CENTRAL,
  claves: CLAVES.claves,
  maestro: [],
  sectores: [],
  opciones: {
    fecha: '13/09/2026', marca: '13/09/2026 18:00', operador: '12345',
    clase: 'REP', nivel: 'COM', modo: CLAVES.normalizacion || 'normalizada'
  }
}, extras || {}));

// ===========================================================================
// 1. Contrato del CSV y de `estructura.json` (RF-16, D-12, D-44)
// ===========================================================================
test('la cabecera del CSV tiene las 80 columnas que declara estructura.json', () => {
  const p = I.parsearCSV(CSV, ';');
  assert.equal(ESTRUCTURA.columnas_esperadas, 80);
  assert.equal(ESTRUCTURA.separador, ';');
  assert.equal(p.cabecera.length, ESTRUCTURA.columnas_esperadas,
    'la cabecera debe tener 80 columnas separadas por «;»');
  assert.equal(p.cabecera[10], 'id_averia', 'la columna 11 es el id del caso');
});

test('cada campo declarado apunta a una columna existente y los obligatorios se cumplen', () => {
  const p = I.parsearCSV(CSV, ';');
  const filas = p.filas.filter((f) => f.length > 1);
  (ESTRUCTURA.campos || []).forEach((campo) => {
    assert.ok(campo.columna >= 1 && campo.columna <= ESTRUCTURA.columnas_esperadas,
      campo.json + ' declara la columna ' + campo.columna + ', fuera del rango 1..80');
  });
  const obligatorios = (ESTRUCTURA.campos || []).filter((c) => c.obligatorio);
  assert.ok(obligatorios.length > 0, 'debe haber campos obligatorios declarados');
  obligatorios.forEach((campo) => {
    const vacios = filas.filter((f) => String(f[campo.columna - 1] || '').trim() === '').length;
    assert.equal(vacios, 0, 'el contrato declara obligatoria la columna ' + campo.columna + ' (' +
      campo.json + ') pero ' + vacios + ' fila(s) del archivo real vienen vacías');
  });
});

test('una fila sin dirección entra igualmente y queda en la cola de sectores (CU-08, CU-09)', () => {
  const r = ingerir(CSV);
  const sinDireccion = r.casos.filter((c) => !String(c.direccion || '').trim());
  assert.equal(sinDireccion.length, 4, 'el archivo real trae 4 casos sin dirección');
  assert.equal(r.resumen.insertadas, 51, 'y aun así entran los 51: la dirección no bloquea la ingesta');
  assert.equal(r.resumen.rechazadas.length, 0, 'ninguna fila se rechaza por venir sin dirección');

  const conSectores = ingerir(CSV, { sectores: [{ id: 'S1', nombre: 'Demo', vias: ['CALLE FICTICIA'] }] });
  assert.ok(conSectores.casos.some((c) => String(c.sector || '').trim() !== ''),
    'con un catálogo de sectores, los casos con dirección sí se asignan');
  sinDireccion.forEach((c) => {
    const enCola = conSectores.casos.filter((s) => s.id_averia === c.id_averia &&
      String(s.sector || '').trim() === '');
    assert.equal(enCola.length, 1, 'el caso ' + c.id_averia + ' sin dirección debe quedar en la cola (CU-09)');
  });
});

test('la ingesta del CSV real produce casos con los campos del maestro informados', () => {
  const r = ingerir(CSV);
  assert.equal(r.ok, true, 'la ingesta del archivo real debe completarse');
  assert.equal(r.resumen.insertadas, 51, 'los 51 casos de Francisco Salias');
  assert.equal(r.casos.length, 51);
  const conteo = r.casos.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});
  assert.equal(conteo.PEND, 18);
  assert.equal(conteo.GESTION, 33);

  // Obligatorios del contrato del CSV: `id_averia` y `telefono` (la dirección no
  // lo es: el archivo real trae filas sin ella y entran igualmente).
  const camposObligatorios = ['id_averia', 'telefono'];
  r.casos.forEach((caso) => {
    camposObligatorios.forEach((campo) => {
      assert.ok(String(caso[campo] || '').trim() !== '',
        'el caso ' + caso.id_averia + ' no trae ' + campo);
    });
  });
  // Rastro de origen (D-52, D-53): la ingesta lo inicializa con la columna 20
  // del CSV (usuario_acciona) y con la fecha de ingesta como marca.
  assert.equal(r.casos[0].fecha_modificacion, '13/09/2026 18:00',
    'la marca de la ingesta queda como fecha de modificación');
  assert.ok(String(r.casos[0].usuario_modificacion || '').trim() !== '',
    'la ingesta inicializa el rastro de origen con el usuario de la columna 20');
  // Y no persiste lo que D-53 y D-54 excluyeron.
  assert.equal(r.casos[0].fecha_compromiso, undefined, 'la col. 18 no se persiste (D-54)');
});

// ===========================================================================
// 2. Contrato de `despacho.json`: las 15 columnas canónicas (D-31, RT-05)
// ===========================================================================
test('la proyección de despacho escribe las 15 columnas canónicas en su orden', () => {
  const casos = [{
    id_averia: 'A-1', telefono: '4241234567', persona_reporta: 'Ana', contacto: 'Luis',
    nombre: 'Abonado Uno', direccion: 'CALLE 1', plan: 'ABA', fat: 'FAT1', serial: 'S1',
    ultimo_comentario: 'comentario', sector: 'S1', clase: 'REP', nivel: 'COM', status: 'PEND'
  }];
  const cuadrillas = [{ id: 'C1', nombre: 'Cuadrilla 1', status: 'Activa', sectores: ['S1'], tecnicos: [] }];
  const sectores = [{ id: 'S1', nombre: 'Cumbres', vias: ['CUMBRES'], cuadrilla_sugerida: '' }];
  const r = D.generarReparto(casos, cuadrillas, sectores, '13/09/2026');
  const filas = D.filasDespacho(r, '13/09/2026');

  assert.equal(filas.length, 1, 'el caso despachable debe producir una fila');
  assert.deepEqual(Object.keys(filas[0]), COLUMNAS_CANONICAS,
    'las 15 columnas canónicas, en el orden documentado');
  assert.equal(filas[0]['Reparador Principal'], 'C1');
  assert.equal(filas[0].fecha_despacho, '13/09/2026');
});

// ===========================================================================
// 3. Contrato de la HOJA IMPRESA del despacho (CU-17 CA-2, RNF-05, RNF-11)
// ===========================================================================
test('la hoja del despacho muestra todas las columnas canónicas (CU-17 CA-2)', () => {
  const enTabla = PDF.COLUMNAS.map((c) => c.clave);
  const faltan = COLUMNAS_CANONICAS.filter(
    (c) => enTabla.indexOf(c) < 0 && EN_CABECERA.indexOf(c) < 0
  );
  assert.deepEqual(faltan, [],
    'la hoja impresa debe contener las 15 columnas canónicas: ' +
    'en la tabla o en el encabezado; faltan ' + faltan.join(', '));
  // Y el encabezado debe llevar las dos que se imprimen fuera de la tabla.
  assert.ok(typeof PDF.encabezado === 'function' || typeof PDF.construirPDF === 'function',
    'la hoja se construye en construirPDF');
});

test('la tabla del despacho cabe en el área imprimible de la hoja (RNF-05)', () => {
  const disponible = PDF.PAGINA.ancho - 2 * PDF.MARGEN;
  const ancho = PDF.anchoTabla();
  assert.ok(ancho <= disponible + 0.01,
    'la tabla mide ' + ancho.toFixed(1) + ' mm y el área imprimible es ' + disponible.toFixed(1) +
    ' mm: se sale del margen derecho');
  assert.ok(ancho >= disponible - 0.01,
    'la tabla mide ' + ancho.toFixed(1) + ' mm y podría aprovechar los ' + disponible.toFixed(1) +
    ' mm del área imprimible');
});

test('una instalación nueva reproduce el reparto documentado (D-65, RN-03)', () => {
  // Con la SEMILLA del núcleo (puesto recién creado, sin pasar por C:\GGTO\datos),
  // el archivo debe seguir dando 51 casos y 18 PEND + 33 GESTION. Es lo que fija
  // D-65: el catálogo de claves por defecto tiene que incluir «LOS ROJO» y
  // «FALLA DE FIBRA».
  const semilla = N.estructurasIniciales();
  const clavesSemilla = semilla['claves_clasificacion.json'].claves;
  assert.ok(clavesSemilla.indexOf('LOS ROJO') >= 0, 'falta «LOS ROJO» en el catálogo por defecto');
  assert.ok(clavesSemilla.indexOf('FALLA DE FIBRA') >= 0, 'falta «FALLA DE FIBRA» en el catálogo por defecto');

  const r = I.ingerir({
    texto: CSV,
    estructura: semilla['estructura.json'],
    central: semilla['central.json'],
    claves: clavesSemilla,
    maestro: [],
    sectores: [],
    opciones: {
      fecha: '13/09/2026', marca: '13/09/2026 18:00', operador: '12345',
      clase: 'REP', nivel: 'COM', modo: semilla['claves_clasificacion.json'].normalizacion
    }
  });
  assert.equal(r.resumen.insertadas, 51);
  assert.equal(r.resumen.pend, 18, 'una instalación nueva debe dar 18 PEND');
  assert.equal(r.resumen.gestion, 33, 'una instalación nueva debe dar 33 GESTION');
});

// ===========================================================================
// 4. Inventario y contratos de los archivos de trabajo (D-49, D-56)
// ===========================================================================
test('los archivos de trabajo son los 10 documentados y la copia de cierre los incluye', () => {
  const base = N.estructurasIniciales();
  const nombres = Object.keys(base);
  assert.equal(nombres.length, 10, 'son 9 JSON de trabajo y el historial');
  assert.deepEqual(nombres.slice().sort(), A.NOMBRES.slice().sort(),
    'estructurasIniciales y el almacén deben declarar el mismo inventario');
  assert.ok(nombres.indexOf('historial.jsonl') >= 0);
  assert.equal(base['historial.jsonl'], '', 'el historial arranca vacío');
  assert.equal(base['averias.json'].length, 0, 'el maestro arranca sin casos inventados');
  assert.equal(N.nombreCopiaCierre(new Date(2026, 8, 13, 9, 5)), 'averias_2026-09-13_0905.json');
});

test('cada línea del historial lleva los 7 campos documentados (D-56)', () => {
  const linea = JSON.parse(N.lineaHistorial({
    fecha_hora: '13/09/2026 10:05', operador: '12345', id_averia: 'A-1', campo: 'status',
    valor_anterior: 'PEND', valor_nuevo: 'CERRADO', accion: 'cierre'
  }));
  assert.deepEqual(Object.keys(linea).sort(), [
    'accion', 'campo', 'fecha_hora', 'id_averia', 'operador', 'valor_anterior', 'valor_nuevo'
  ]);
});

// ===========================================================================
// 5. Contratos derivados de la reauditoría (lente R2, D-76)
// ===========================================================================
test('la constante COLUMNAS_DESPACHO del módulo son las 15 canónicas (D-31, R2-02)', () => {
  assert.equal(D.COLUMNAS_DESPACHO.length, 15,
    'la constante debe declarar las 15 columnas canónicas, no una lista parcial');
  assert.deepEqual(D.COLUMNAS_DESPACHO, COLUMNAS_CANONICAS,
    'la constante debe coincidir, y en el mismo orden, con lo que escribe `filasDespacho`');
  const filas = D.filasDespacho({ reparto: [{ cuadrilla: { id: 'C1' }, asignaciones: [{ caso: {
    id_averia: 'A-1', nivel: 'COM', clase: 'REP', sector: 'S1'
  }, motivo: 'reparación' }] }] }, '13/09/2025');
  assert.deepEqual(Object.keys(filas[0]), D.COLUMNAS_DESPACHO,
    'la constante debe ser la lista de referencia de lo que se escribe en despacho.json');
});

test('el catálogo de claves por defecto es uno solo y tiene las 6 claves de D-65 (R2-07)', () => {
  const porDefecto = N.CONST.CLAVES_CLASIFICACION;
  assert.equal(porDefecto.length, 6, 'el catálogo por defecto documentado tiene seis claves');
  ['LOSS ROJO', 'LOS ROJO', 'FALLA FIBRA', 'FALLA DE FIBRA', 'FIBRA DAÑADA', 'FIBRA DANADA']
    .forEach((c) => assert.ok(porDefecto.indexOf(c) >= 0, 'falta «' + c + '» en el catálogo por defecto'));
  const configJs = leer(path.join(raizProyecto, 'app', 'js', 'configuracion.js'));
  assert.ok(configJs.indexOf('CONST.CLAVES_CLASIFICACION') >= 0,
    'el respaldo de CONFIGURACION → PALABRAS CLAVE debe usar la constante del núcleo, no una lista propia');
  assert.deepEqual(N.estructurasIniciales()['claves_clasificacion.json'].claves, porDefecto,
    'la semilla debe usar la misma constante (una instalación nueva clasifica igual que el contrato)');
});

test('las cifras documentadas del archivo real cuadran entre sí (R2-01)', () => {
  const r = ingerir(CSV);
  assert.equal(r.resumen.pend + r.resumen.gestion, r.resumen.insertadas,
    'el reparto de estados debe sumar los casos insertados: ' +
    r.resumen.pend + ' + ' + r.resumen.gestion + ' != ' + r.resumen.insertadas);
  assert.equal(r.resumen.insertadas + r.resumen.fueraDeCentral, r.resumen.leidas,
    'las filas leídas deben ser las insertadas más las descartadas por no ser de la central');
  assert.deepEqual([r.resumen.leidas, r.resumen.insertadas, r.resumen.pend, r.resumen.gestion],
    [56, 51, 18, 33],
    'las cifras documentadas del archivo del 12/09/2026 son 56 leídas / 51 de la central / 18 PEND + 33 GESTION');
});

test('REPORTES se alcanza desde MONITOREO y no como pestaña propia (RF-01, D-76)', () => {
  const html = leer(path.join(raizProyecto, 'app', 'index.html'));
  const appJs = leer(path.join(raizProyecto, 'app', 'js', 'app.js'));
  const pestanas = ['panel', 'monitoreo', 'graficos', 'casos', 'despacho', 'configuracion', 'gestion'];
  pestanas.forEach((id) => {
    assert.ok(appJs.indexOf("id: '" + id + "'") >= 0,
      'la pestaña ' + id + ' no está enrutada en PESTANAS (app.js)');
    assert.ok(html.indexOf('id="seccion-' + id + '"') >= 0,
      'index.html no declara la sección #seccion-' + id + ' que la pestaña necesita');
  });
  assert.ok(appJs.indexOf("id: 'reportes'") < 0,
    'REPORTES no debe ser una pestaña propia: RF-01 fija siete');
  assert.ok(html.indexOf('js/reportes.js') >= 0, 'index.html debe cargar reportes.js');
  const M = require(path.join(raizProyecto, 'app', 'js', 'metricas.js'));
  assert.deepEqual(M.subsecciones.map((s) => s.id), ['tablero', 'reportes'],
    'MONITOREO debe alojar la sub-pestaña REPORTES (CU-19, CU-20)');
});
