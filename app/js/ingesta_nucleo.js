/*
 * GGTO-v1 - ingesta_nucleo.js
 * Logica pura del ciclo C2: ingesta diaria del CSV (RF-16 a RF-19, RF-27).
 * Reglas: RN-01 a RN-04; decisiones D-12 (mapa posicional), D-17 (tipo de
 * abonado), D-21 y D-38 (fechas y estatus), D-26 y D-43 (palabras clave),
 * D-44 (validacion bloqueante), D-53 y D-54 (columnas que no se persisten).
 *
 * No toca el DOM ni el disco: se carga como script clasico en el navegador
 * (window.GGTO_INGESTA_NUCLEO) y se exporta para las pruebas de Node.js.
 */
(function (raiz) {
  'use strict';

  var RE_TILDES = /[\u0300-\u036f]/g;

  // -------------------------------------------------------------------------
  // Normalizacion de texto (D-03, D-26): mayusculas, sin tildes, espacios
  // colapsados. Es la base de todas las comparaciones tolerantes.
  // -------------------------------------------------------------------------
  function sinTildes(texto) {
    var t = String(texto == null ? '' : texto);
    if (typeof t.normalize === 'function') {
      t = t.normalize('NFD').replace(RE_TILDES, '');
    }
    return t;
  }

  function normalizar(texto) {
    return sinTildes(texto).toUpperCase().replace(/\s+/g, ' ').trim();
  }

  // -------------------------------------------------------------------------
  // Parseo del CSV con separador ';' (RT-02). Sin dependencias externas:
  // respeta comillas dobles y el escape "" dentro de un campo entrecomillado.
  // -------------------------------------------------------------------------
  function parsearCSV(texto, delimitador) {
    var delim = delimitador || ';';
    var t = String(texto == null ? '' : texto).replace(/^\uFEFF/, '');
    var filas = [];
    var fila = [];
    var campo = '';
    var entreComillas = false;
    var i;

    for (i = 0; i < t.length; i++) {
      var c = t.charAt(i);
      if (entreComillas) {
        if (c === '"') {
          if (t.charAt(i + 1) === '"') { campo += '"'; i++; }
          else { entreComillas = false; }
        } else {
          campo += c;
        }
        continue;
      }
      if (c === '"') { entreComillas = true; continue; }
      if (c === delim) { fila.push(campo); campo = ''; continue; }
      if (c === '\r') { continue; }
      if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue; }
      campo += c;
    }
    if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila); }

    // Se descartan las lineas completamente vacias del final del archivo.
    while (filas.length > 0) {
      var ultima = filas[filas.length - 1];
      var vacia = ultima.length === 1 && String(ultima[0]).trim() === '';
      if (!vacia) break;
      filas.pop();
    }

    var cabecera = filas.length > 0 ? filas[0].map(function (h) { return String(h).trim(); }) : [];
    var datos = filas.slice(1).filter(function (f) {
      return !(f.length === 1 && String(f[0]).trim() === '');
    });

    return { cabecera: cabecera, filas: datos, totalLineas: filas.length };
  }

  // -------------------------------------------------------------------------
  // Validacion bloqueante del contrato posicional (D-12, D-44).
  // Devuelve {ok, errores[]} y NUNCA lanza: quien ingiere decide que hacer.
  // -------------------------------------------------------------------------
  function validarEstructura(cabecera, estructura) {
    var errores = [];
    var esperadas = (estructura && estructura.columnas_esperadas) || 0;
    var obtenidas = (cabecera || []).length;

    if (esperadas && obtenidas !== esperadas) {
      errores.push({
        tipo: 'columnas',
        motivo: 'El archivo tiene ' + obtenidas + ' columnas y el contrato exige ' + esperadas + '.',
        esperado: esperadas,
        obtenido: obtenidas
      });
    }
    if (obtenidas === 0) {
      errores.push({ tipo: 'vacio', motivo: 'El archivo no tiene fila de encabezado.' });
      return { ok: false, errores: errores };
    }
    if ((estructura && estructura.filas_esperadas_min) && (estructura.filas_esperadas_min > 0)) { /* reservado */ }

    var campos = (estructura && estructura.campos) || [];
    campos.forEach(function (campo) {
      var pos = campo.columna;
      var obtenido = pos >= 1 && pos <= obtenidas ? String(cabecera[pos - 1]).trim() : null;
      if (obtenido === null || obtenido === '') {
        errores.push({
          tipo: 'posicion',
          columna: pos,
          json: campo.json,
          motivo: 'La columna ' + pos + ' (' + campo.json + ') no existe en el archivo.',
          esperado: campo.cabecera || null,
          obtenido: obtenido
        });
        return;
      }
      if (campo.cabecera && normalizar(obtenido) !== normalizar(campo.cabecera)) {
        errores.push({
          tipo: 'nombre',
          columna: pos,
          json: campo.json,
          motivo: 'La columna ' + pos + ' deberia llamarse «' + campo.cabecera + '» y se llama «' + obtenido + '».',
          esperado: campo.cabecera,
          obtenido: obtenido
        });
      }
    });

    return { ok: errores.length === 0, errores: errores };
  }

  // -------------------------------------------------------------------------
  // Filtro por central (RF-16, RT-03): columnas 1 a 10 contra central.json.
  // Una clave vacia en la configuracion no filtra por ese campo.
  // -------------------------------------------------------------------------
  var CLAVES_CENTRAL = [
    'region', 'estado_geografico', 'capital_estado', 'municipio', 'parroquia',
    'estado_operativo', 'distrito', 'area', 'central', 'nombre_central'
  ];

  function filaDeCentral(fila, central, columnasFiltro) {
    var columnas = columnasFiltro || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    var conf = central || {};
    for (var i = 0; i < columnas.length; i++) {
      var clave = CLAVES_CENTRAL[i] || null;
      if (!clave) continue;
      var deseado = normalizar(conf[clave]);
      if (deseado === '') continue;
      var valor = normalizar(fila[columnas[i] - 1]);
      if (valor !== deseado) return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Fechas (D-21): el CSV trae «17/07/2026 11:38:20 a.m.» y el maestro guarda
  // DD/MM/AAAA. Se conserva el texto original aparte.
  // -------------------------------------------------------------------------
  function recortarFecha(valor) {
    var t = String(valor == null ? '' : valor).trim();
    if (t === '') return '';
    var m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (!m) return '';
    var d = m[1].length === 1 ? '0' + m[1] : m[1];
    var mes = m[2].length === 1 ? '0' + m[2] : m[2];
    var a = m[3].length === 2 ? '20' + m[3] : m[3];
    return d + '/' + mes + '/' + a;
  }

  // -------------------------------------------------------------------------
  // Tipo de abonado (D-17): de unidad_negocio (col. 61) y ups (col. 62).
  // -------------------------------------------------------------------------
  function tipoAbonado(unidadNegocio, ups) {
    var u = normalizar(unidadNegocio);
    var s = normalizar(ups);
    if (u.indexOf('EMPRESA') >= 0 || s === 'NRES' || s === 'NO RESIDENCIAL') return 'EMP';
    return 'RES';
  }

  // -------------------------------------------------------------------------
  // Palabras clave (RN-03, D-26, D-43).
  //   modo 'normalizada' (por defecto): subcadena sobre texto normalizado.
  //   modo 'estricta': subcadena literal, sensible a mayusculas y tildes.
  // -------------------------------------------------------------------------
  function contieneClaves(textos, claves, modo) {
    var lista = claves || [];
    var estricto = normalizar(modo) === 'ESTRICTA';
    var campos = textos || [];
    for (var i = 0; i < lista.length; i++) {
      var clave = String(lista[i] == null ? '' : lista[i]);
      if (clave.trim() === '') continue;
      var buscada = estricto ? clave : normalizar(clave);
      for (var j = 0; j < campos.length; j++) {
        var texto = estricto ? String(campos[j] == null ? '' : campos[j])
                             : normalizar(campos[j]);
        if (texto.indexOf(buscada) >= 0) return true;
      }
    }
    return false;
  }

  // Regla de clasificacion: ASGN del CSV prevalece y entra como PEND (D-38);
  // con palabras clave -> PEND; sin ellas -> GESTION (D-05, D-21).
  function clasificar(estatusCSV, textos, claves, modo) {
    if (normalizar(estatusCSV) === 'ASGN') return 'PEND';
    return contieneClaves(textos, claves, modo) ? 'PEND' : 'GESTION';
  }

  // -------------------------------------------------------------------------
  // Mapeo posicional (D-12): construye el registro del maestro.
  // -------------------------------------------------------------------------
  function valorDe(fila, columna) {
    if (!fila || columna < 1 || columna > fila.length) return '';
    return String(fila[columna - 1] == null ? '' : fila[columna - 1]).trim();
  }

  function campoPorJson(estructura, json) {
    var campos = (estructura && estructura.campos) || [];
    for (var i = 0; i < campos.length; i++) {
      if (campos[i].json === json) return campos[i];
    }
    return null;
  }

  function valorCampo(fila, estructura, json) {
    var campo = campoPorJson(estructura, json);
    return campo ? valorDe(fila, campo.columna) : '';
  }

  function mapearRegistro(fila, estructura, opciones) {
    var op = opciones || {};
    var claves = op.claves || [];
    var modo = op.modo || 'normalizada';
    var textos = [
      valorCampo(fila, estructura, 'ultimo_comentario'),
      valorCampo(fila, estructura, 'problema_reporte'),
      valorCampo(fila, estructura, 'informacion_1'),
      valorCampo(fila, estructura, 'informacion_2')
    ];
    var estatus = valorCampo(fila, estructura, 'estatus');
    var fechaOriginal = valorCampo(fila, estructura, 'fecha_reporte');

    return {
      ingreso: op.fecha || '',
      nivel: op.nivel || 'COM',
      clase: op.clase || 'REP',
      sector: '',
      'Reparador Principal': valorCampo(fila, estructura, 'Reparador Principal'),
      id_averia: valorCampo(fila, estructura, 'id_averia'),
      telefono: valorCampo(fila, estructura, 'telefono'),
      persona_reporta: valorCampo(fila, estructura, 'persona_reporta'),
      contacto: valorCampo(fila, estructura, 'contacto'),
      ultimo_comentario: valorCampo(fila, estructura, 'ultimo_comentario'),
      problema_reporte: valorCampo(fila, estructura, 'problema_reporte'),
      informacion_1: valorCampo(fila, estructura, 'informacion_1'),
      informacion_2: valorCampo(fila, estructura, 'informacion_2'),
      nombre: valorCampo(fila, estructura, 'nombre'),
      direccion: valorCampo(fila, estructura, 'direccion'),
      olt: valorCampo(fila, estructura, 'olt'),
      plan: valorCampo(fila, estructura, 'plan'),
      slot: valorCampo(fila, estructura, 'slot'),
      puerto: valorCampo(fila, estructura, 'puerto'),
      fat: valorCampo(fila, estructura, 'fat'),
      serial: valorCampo(fila, estructura, 'serial'),
      extra: valorCampo(fila, estructura, 'extra'),
      ups: valorCampo(fila, estructura, 'ups'),
      codigos_sin_gestion_en_VENAPP: valorCampo(fila, estructura, 'codigos_sin_gestion_en_VENAPP'),
      status: clasificar(estatus, textos, claves, modo),
      resolucion: '',
      fechaResolucion: '',
      observaciones: '',
      sacas: '',
      tipo_abonado: tipoAbonado(valorCampo(fila, estructura, 'unidad_negocio'),
                                valorCampo(fila, estructura, 'ups')),
      fecha_reporte: recortarFecha(fechaOriginal),
      fecha_reporte_original: fechaOriginal,
      fecha_cita: recortarFecha(valorCampo(fila, estructura, 'fecha_cita')),
      fecha_asignacion: '',
      usuario_modificacion: valorCampo(fila, estructura, 'ultimo_usuario') || op.operador || '',
      fecha_modificacion: op.marca || op.fecha || '',
      _estatus_csv: estatus,
      _claves: contieneClaves(textos, claves, modo)
    };
  }

  // -------------------------------------------------------------------------
  // Asignacion de sector (RF-18, RN-04, D-03): coincidencia de la direccion
  // con las vias declaradas en sectores.json, por texto normalizado.
  // -------------------------------------------------------------------------
  function asignarSector(direccion, sectores) {
    var dir = normalizar(direccion);
    if (dir === '') return null;
    var lista = sectores || [];
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i] || {};
      var vias = s.vias || s.calles || [];
      for (var j = 0; j < vias.length; j++) {
        var via = normalizar(vias[j]);
        if (via === '') continue;
        if (dir.indexOf(via) >= 0) {
          return { id: String(s.id == null ? '' : s.id), nombre: s.nombre || '', via: vias[j] };
        }
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Pipeline completo. `entrada`:
  //   { texto, estructura, central, claves, maestro, sectores,
  //     opciones: { fecha, marca, operador, clase, nivel } }
  // Devuelve { ok, errores, resumen, casos, sinSector, conClaves, sinClaves }.
  // -------------------------------------------------------------------------
  function ingerir(entrada) {
    var e = entrada || {};
    var estructura = e.estructura || {};
    var opciones = e.opciones || {};
    var inicio = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;

    var parseado = parsearCSV(e.texto, (estructura && estructura.separador) || ';');
    var validacion = validarEstructura(parseado.cabecera, estructura);

    var resumen = {
      columnas: parseado.cabecera.length,
      leidas: parseado.filas.length,
      fueraDeCentral: 0,
      duplicadasEnMaestro: 0,
      duplicadasEnLote: 0,
      rechazadas: [],
      insertadas: 0,
      pend: 0,
      gestion: 0,
      conClaves: 0,
      sinClaves: 0,
      conSector: 0,
      sinSector: 0,
      ms: 0
    };

    if (!validacion.ok) {
      resumen.ms = ((typeof Date !== 'undefined' && Date.now) ? Date.now() : 0) - inicio;
      return { ok: false, errores: validacion.errores, resumen: resumen, casos: [], sinSector: [] };
    }

    // Un archivo con solo el encabezado no debe confirmarse como ingesta
    // completada: aborta sin escribir (CU-08 2d, D-44).
    if (parseado.filas.length === 0) {
      resumen.ms = ((typeof Date !== 'undefined' && Date.now) ? Date.now() : 0) - inicio;
      return {
        ok: false,
        errores: [{ tipo: 'sin_datos', motivo: 'El archivo no tiene registros: solo la fila de encabezado.' }],
        resumen: resumen,
        casos: [],
        sinSector: []
      };
    }

    var existentes = {};
    (e.maestro || []).forEach(function (c) {
      if (c && c.id_averia != null) existentes[String(c.id_averia)] = true;
    });

    var vistos = {};
    var casos = [];
    var sinSector = [];
    var claves = e.claves || [];

    parseado.filas.forEach(function (fila, indice) {
      var numeroFila = indice + 2; // 1 = encabezado
      if (!filaDeCentral(fila, e.central, (estructura.filtro_central || {}).columnas)) {
        resumen.fueraDeCentral++;
        return;
      }
      var id = valorCampo(fila, estructura, 'id_averia');
      if (id === '') {
        resumen.rechazadas.push({ fila: numeroFila, motivo: 'id_averia vacio' });
        return;
      }
      if (existentes[id]) { resumen.duplicadasEnMaestro++; return; }
      if (vistos[id]) { resumen.duplicadasEnLote++; return; }

      var registro = mapearRegistro(fila, estructura, {
        fecha: opciones.fecha || '',
        marca: opciones.marca || '',
        operador: opciones.operador || '',
        clase: opciones.clase || 'REP',
        nivel: opciones.nivel || 'COM',
        claves: claves,
        modo: opciones.modo || (e.clavesConfig && e.clavesConfig.modo) || 'normalizada'
      });

      var sector = asignarSector(registro.direccion, e.sectores);
      if (sector) {
        registro.sector = sector.id;
        resumen.conSector++;
      } else {
        resumen.sinSector++;
        sinSector.push({ fila: numeroFila, id_averia: id, direccion: registro.direccion });
      }
      if (registro._claves) resumen.conClaves++; else resumen.sinClaves++;
      if (registro.status === 'PEND') resumen.pend++; else resumen.gestion++;

      // Los campos internos no forman parte del maestro (36 campos).
      delete registro._claves;
      delete registro._estatus_csv;

      vistos[id] = true;
      casos.push(registro);
    });

    resumen.insertadas = casos.length;
    resumen.ms = ((typeof Date !== 'undefined' && Date.now) ? Date.now() : 0) - inicio;

    return {
      ok: true,
      errores: [],
      resumen: resumen,
      casos: casos,
      sinSector: sinSector,
      columnas: parseado.cabecera
    };
  }

  var API = {
    normalizar: normalizar,
    sinTildes: sinTildes,
    parsearCSV: parsearCSV,
    validarEstructura: validarEstructura,
    filaDeCentral: filaDeCentral,
    recortarFecha: recortarFecha,
    tipoAbonado: tipoAbonado,
    contieneClaves: contieneClaves,
    clasificar: clasificar,
    valorDe: valorDe,
    valorCampo: valorCampo,
    campoPorJson: campoPorJson,
    mapearRegistro: mapearRegistro,
    asignarSector: asignarSector,
    ingerir: ingerir,
    CLAVES_CENTRAL: CLAVES_CENTRAL
  };

  raiz.GGTO_INGESTA_NUCLEO = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
