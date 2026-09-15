/*
 * GGTO-v1 · pruebas/herramientas/anonimizar_csv.mjs
 *
 * Genera la MUESTRA ANONIMIZADA del CSV diario que se versiona en el repositorio
 * (`pruebas/fixtures/detalle_averias_gpon_muestra.csv`), a partir del archivo
 * real. El repositorio es público y el archivo real lleva datos personales de
 * abonados (nombre, teléfono, dirección, C.I., correo), así que **no se sube**:
 * lo que se versiona es esta muestra, que conserva lo que las pruebas necesitan
 * —la cabecera de 80 columnas, el filtro por central, el `estatus` (PEND/ASGN),
 * `unidad_negocio`/`ups`, las fechas y **las palabras clave que deciden la
 * clasificación RN-03**— y sustituye todo lo demás por valores ficticios.
 *
 *   Uso:  node pruebas/herramientas/anonimizar_csv.mjs "<ruta del CSV real>"
 *
 * Comprueba al final que la muestra reproduce el resumen documentado
 * (56 leídas · 5 fuera de central · 51 casos · 18 PEND + 33 GESTION).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..', '..');

const I = require(path.join(raiz, 'app', 'js', 'ingesta_nucleo.js'));

const origen = process.argv[2] || path.join(raiz, 'detalle_averias_gpon 12_09_2026.csv');
const destino = path.join(raiz, 'pruebas', 'fixtures', 'detalle_averias_gpon_muestra.csv');

// Catálogo de claves y configuración reales: solo se usan para saber QUÉ claves
// coinciden en cada fila; la muestra lleva esas claves y nada más del texto.
const RUTA_DATOS = 'C:\\GGTO\\datos';
const claves = JSON.parse(fs.readFileSync(path.join(RUTA_DATOS, 'claves_clasificacion.json'), 'utf8')).claves || [];
const estructura = JSON.parse(fs.readFileSync(path.join(RUTA_DATOS, 'estructura.json'), 'utf8'));
const central = JSON.parse(fs.readFileSync(path.join(RUTA_DATOS, 'central.json'), 'utf8'));

// Columnas que se conservan tal cual (no llevan datos personales).
const CONSERVAR = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 27, 61, 62]);
// Columnas de texto libre que se reescriben conservando solo las claves que casan.
const TEXTO_CLAVES = [21, 28, 31, 32];
// Columnas con valor sintético por tipo.
const ES_FECHA = /^\d{2}\/\d{2}\/\d{4}/;

const p = I.parsearCSV(fs.readFileSync(origen, 'utf8'), ';');
const cabecera = p.cabecera;
const filas = p.filas;

const pad = (n) => String(n).padStart(4, '0');
const soloDigitos = (valor) => String(valor).replace(/\d/g, '9');
const textoFicticio = (valor, col, i) => (String(valor).trim() === '' ? '' : 'DATO' + col + '-' + pad(i));

function clavesDe(fila) {
  const textos = TEXTO_CLAVES.map((c) => fila[c - 1] || '');
  const halladas = [];
  claves.forEach((clave) => {
    if (I.contieneClaves(textos, [clave], 'normalizada')) halladas.push(clave);
  });
  return halladas;
}

const salida = [];
salida.push(cabecera.map((c) => String(c == null ? '' : c)).join(';'));

// Contadores informativos: se calculan sobre el archivo REAL antes de anonimizar.
const filasDeLaCentral = filas.filter((f) => I.filaDeCentral(f, central));
const sinDireccionReal = filasDeLaCentral.filter((f) => String(f[33] || '').trim() === '').length;
const conClavesReal = filasDeLaCentral.filter((f) => clavesDe(f).length > 0).length;

filas.forEach((fila, i) => {
  const nueva = fila.map((valor, indice) => {
    const col = indice + 1;
    const texto = String(valor == null ? '' : valor);

    // Las palabras clave que deciden la clasificación se conservan; el resto del
    // texto libre se descarta.
    if (TEXTO_CLAVES.indexOf(col) >= 0) {
      const halladas = clavesDe(fila);
      const esPortador = col === TEXTO_CLAVES[0];
      if (halladas.length && esPortador) return 'REPORTE FICTICIO: ' + halladas.join(' / ');
      return texto.trim() === '' ? '' : 'SIN NOVEDAD FICTICIA';
    }
    if (CONSERVAR.has(col)) return texto;              // filtro por central, estatus, tipo
    if (texto.trim() === '') return '';                // los vacíos se conservan (hay 4 sin dirección)
    if (ES_FECHA.test(texto)) return texto;            // las fechas no son datos personales
    if (col === 11) return '9000' + String(1000 + i);  // id_averia único
    if (col === 14) return '7000000' + String(100 + i); // teléfono
    if (col === 17) return '4000000' + String(100 + i); // contacto
    if (col === 16 || col === 33) return 'ABONADO' + pad(i); // nombre / persona que reporta
    if (col === 34) return 'CALLE FICTICIA ' + pad(i) + ' RESIDENCIA DEMO';
    if (col === 20 || col === 53) return 'OPERADOR' + pad(i); // rastro de origen (personal interno)
    if (/^\d+$/.test(texto)) return soloDigitos(texto); // cualquier otro numérico
    return textoFicticio(texto, col, i);
  });

  salida.push(nueva.join(';'));
});

fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, salida.join('\r\n') + '\r\n', 'utf8');

// --- Verificación: la muestra debe reproducir el resumen documentado ---------
const muestra = fs.readFileSync(destino, 'utf8');
const r = I.ingerir({
  texto: muestra, estructura, central, claves: claves,
  maestro: [], sectores: [],
  opciones: { fecha: '13/09/2026', marca: '13/09/2026 18:00', operador: '12345', clase: 'REP', nivel: 'COM', modo: 'normalizada' }
});
const esperado = { leidas: 56, fueraDeCentral: 5, insertadas: 51, pend: 18, gestion: 33, conClaves: 17, sinClaves: 34 };
const obtenido = r.resumen;
const fallos = Object.keys(esperado).filter((k) => obtenido[k] !== esperado[k]);

console.log('Muestra escrita en: ' + destino);
console.log('Filas: ' + filas.length + ' · de la central: ' + filasDeLaCentral.length +
  ' · sin dirección: ' + sinDireccionReal + ' · con claves: ' + conClavesReal);
console.log('Resumen obtenido: ' + JSON.stringify(obtenido));
if (fallos.length) {
  console.error('NO reproduce el resumen esperado. Diferencias: ' +
    fallos.map((k) => k + ' ' + obtenido[k] + '≠' + esperado[k]).join(', '));
  process.exit(1);
}
console.log('OK: la muestra reproduce 56/5/51 y 18 PEND + 33 GESTION sin datos personales.');
