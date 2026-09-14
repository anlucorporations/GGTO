/*
 * GGTO-v1 - nucleo.js
 * Logica pura (sin DOM, sin disco, sin estado global): validaciones, matriz de
 * permisos, hash de contrasena, generacion de lineas de historial y formateo de
 * fechas. Se carga como script clasico en el navegador (window.GGTO_NUCLEO) y
 * como modulo CommonJS en Node.js (pruebas/pruebas_c1.mjs).
 *
 * Fuentes: documento_tecnico.md (D-01, D-19, D-20, D-23, D-29, D-35, D-39,
 * D-41, D-42, D-45, D-50, D-52, D-56), diccionario_datos.md, casos_uso.md
 * (CU-01 a CU-07, CU-10 a CU-15, CU-21, CU-22), requerimientos.md (RF-11 a
 * RF-14, RF-21 a RF-24, RF-27 a RF-29; RNF-06, RNF-08 a RNF-15).
 */
(function (raiz) {
  'use strict';

  // ------------------------------------------------------------------
  // Constantes del dominio (entornos_globales.md 5)
  // ------------------------------------------------------------------
  var CONST = {
    RUTA_DATOS: 'C:\\GGTO\\datos',
    RUTA_RESPALDO: 'C:\\GGTO\\respaldo',
    RUTA_DESPACHOS: 'C:\\GGTO\\despachos',
    PUERTO_LOCAL: 8787,
    ARCHIVO_MAESTRO: 'averias.json',
    ARCHIVO_DESPACHO: 'despacho.json',
    ARCHIVO_ESTRUCTURA: 'estructura.json',
    ARCHIVO_HISTORIAL: 'historial.jsonl',
    ARCHIVOS_CONFIG: [
      'central.json',
      'tecnicos.json',
      'flota.json',
      'cuadrillas.json',
      'sectores.json',
      'claves_clasificacion.json'
    ],
    FORMATO_FECHA: 'DD/MM/AAAA',
    FORMATO_FECHA_HORA: 'DD/MM/AAAA hh:mm',
    STATUS: ['PEND', 'GESTION', 'CERRADO'],
    RESOLUCION: ['IVR', 'COS', 'COLA'],
    CLASE: ['REP', 'CNS'],
    NIVEL: ['COM', 'REF'],
    SACAS: ['SI', 'NO'],
    TIPO_ABONADO: ['RES', 'EMP'],
    ROLES: ['Operador', 'Supervisor'],
    ACCIONES_HISTORIAL: ['edicion', 'cierre', 'reapertura', 'asignacion', 'ingesta'],
    CAMPOS_HISTORIAL: [
      'status',
      'clase',
      'nivel',
      'tipo_abonado',
      'sector',
      'Reparador Principal',
      'sacas',
      'observaciones'
    ],
    CAMPOS_CIERRE: ['resolucion', 'fechaResolucion'],
    COLUMNAS_TABLA: ['nivel', 'clase', 'sector', 'id_averia', 'nombre', 'direccion', 'plan'],
    CAMPOS_MAESTRO: [
      'ingreso', 'nivel', 'clase', 'sector', 'Reparador Principal', 'id_averia',
      'telefono', 'persona_reporta', 'contacto', 'ultimo_comentario',
      'problema_reporte', 'informacion_1', 'informacion_2', 'nombre', 'direccion',
      'olt', 'plan', 'slot', 'puerto', 'fat', 'serial', 'extra', 'ups',
      'codigos_sin_gestion_en_VENAPP', 'status', 'resolucion', 'fechaResolucion',
      'observaciones', 'sacas', 'tipo_abonado', 'usuario_modificacion',
      'fecha_modificacion', 'fecha_reporte', 'fecha_reporte_original',
      'fecha_cita', 'fecha_asignacion'
    ],
    CAMPOS_TECNICO: [
      'nombre', 'cedula', 'P00', 'clave_hash', 'clave_sal', 'clave_fecha_cambio',
      'clave_cambio_obligatorio', 'telefono', 'correo', 'especialidad', 'status', 'rol'
    ],
    CAMPOS_FLOTA: [
      'CAN00', 'tipo', 'marca', 'modelo', 'placa', 'combustible', 'status',
      'estado_cauchos', 'estado_fluidos', 'estado_general'
    ],
    CAMPOS_CUADRILLA: ['id', 'nombre', 'tecnicos', 'vehiculo', 'turno', 'sectores', 'status'],
    CAMPOS_SECTOR: ['id', 'nombre', 'vias', 'cuadrilla_sugerida'],
    CAMPOS_CENTRAL: [
      'region', 'estado_geografico', 'capital_estado', 'municipio', 'parroquia',
      'estado_operativo', 'distrito', 'area', 'central', 'nombre_central'
    ],
    STATUS_TECNICO: ['Activo', 'Inactivo'],
    STATUS_FLOTA: ['Operativo', 'En mantenimiento', 'Fuera de servicio'],
    STATUS_CUADRILLA: ['Activa', 'Inactiva'],
    // Mensajes normalizados (CU-01, CU-02, CU-10, CU-12)
    MSG: {
      SIN_SESION: 'Identifíquese para editar',
      CLAVE_CORTA: 'La contraseña debe tener al menos 8 caracteres',
      CREDENCIAL: 'P00 o contraseña incorrectos',
      SIN_P00: 'Indique su P00 y su contraseña',
      CADUCADA: 'Su contraseña tiene más de 90 días: debe cambiarla antes de operar',
      CAMBIO_OBLIGATORIO: 'Debe cambiar la contraseña antes de operar: el supervisor la asignó o restableció',
      SIN_CUADRILLA: 'Sin cuadrilla asignada: solo consulta',
      OTRA_CUADRILLA: 'El caso no está asignado a su cuadrilla',
      ROL: 'Acción no permitida para su rol',
      SESION_EXPIRADA: 'Sesión expirada (8 horas): identifíquese de nuevo',
      SIN_PADRON: 'Padrón de técnicos no disponible',
      RESOLUCION_FALTA: 'Indique la resolución (IVR, COS o COLA)',
      FECHA_RESOLUCION_FALTA: 'Indique la fecha de resolución en formato DD/MM/AAAA',
      FECHA_INVALIDA: 'Fecha inválida: use DD/MM/AAAA con una fecha real',
      SACAS_INVALIDO: 'Sacas debe ser SI o NO',
      CLASE_INVALIDA: 'Clase inválida: use REP o CNS',
      NIVEL_INVALIDO: 'Nivel inválido: use COM o REF',
      TIPO_INVALIDO: 'Tipo de abonado inválido: use RES o EMP',
      SECTOR_INEXISTENTE: 'El sector no existe en sectores.json',
      SIN_CASOS: '0 casos para los filtros aplicados',
      NO_APLICA: 'No aplica'
    },
    // Log de accesos (D-58, D-64): intentos fallidos y acciones denegadas
    ARCHIVO_INCIDENCIAS: 'incidencias.log',
    LOG_MAX_BYTES: 5 * 1024 * 1024,
    LOG_MAX_ARCHIVOS: 5,
    MSG_DIAS_CLAVE: 90,
    MSG_HORAS_SESION: 8
  };

  // ------------------------------------------------------------------
  // Fechas: se formatean y comparan SIEMPRE como texto DD/MM/AAAA (RNF-06, H-29)
  // ------------------------------------------------------------------
  function dosDigitos(n) {
    return (n < 10 ? '0' : '') + String(n);
  }

  function formatearFecha(fecha) {
    if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return '';
    return dosDigitos(fecha.getDate()) + '/' + dosDigitos(fecha.getMonth() + 1) + '/' + fecha.getFullYear();
  }

  function formatearFechaHora(fecha) {
    if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return '';
    return formatearFecha(fecha) + ' ' + dosDigitos(fecha.getHours()) + ':' + dosDigitos(fecha.getMinutes());
  }

  function ahora() {
    return new Date();
  }

  function marcaAhora(fecha) {
    return formatearFechaHora(fecha || ahora());
  }

  function esFechaValida(texto) {
    if (typeof texto !== 'string') return false;
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
    if (!m) return false;
    var d = parseInt(m[1], 10), mes = parseInt(m[2], 10), a = parseInt(m[3], 10);
    if (mes < 1 || mes > 12) return false;
    if (d < 1 || d > 31) return false;
    var prueba = new Date(a, mes - 1, d);
    return prueba.getFullYear() === a && prueba.getMonth() === mes - 1 && prueba.getDate() === d;
  }

  function parsearFecha(texto) {
    if (!esFechaValida(texto)) return null;
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  }

  /** Diferencia en dias completos entre dos fechas DD/MM/AAAA (b - a). */
  function diasEntre(a, b) {
    var fa = parsearFecha(a), fb = parsearFecha(b);
    if (!fa || !fb) return null;
    var ua = Date.UTC(fa.getFullYear(), fa.getMonth(), fa.getDate());
    var ub = Date.UTC(fb.getFullYear(), fb.getMonth(), fb.getDate());
    return Math.round((ub - ua) / 86400000);
  }

  /** Comparacion de textos de fecha en formato fijo (nunca rango calculado, H-29). */
  function compararTexto(a, b) {
    var ta = (a === null || a === undefined) ? '' : String(a);
    var tb = (b === null || b === undefined) ? '' : String(b);
    if (ta === tb) return 0;
    return ta < tb ? -1 : 1;
  }

  // ------------------------------------------------------------------
  // Contrasena: SHA-256 con sal por tecnico (D-39)
  // ------------------------------------------------------------------
  function bytesAHex(buffer) {
    var bytes = new Uint8Array(buffer);
    var salida = '';
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      salida += (h.length === 1 ? '0' + h : h);
    }
    return salida;
  }

  /**
   * Deriva el hash de la contrasena. `subtle` es crypto.subtle (navegador) o
   * node:crypto webcrypto.subtle (Node.js) y se inyecta para poder probar la
   * funcion sin DOM.
   */
  function hashClave(clave, sal, subtle) {
    var cripto = subtle || (raiz.crypto && raiz.crypto.subtle);
    if (!cripto) return Promise.reject(new Error('crypto.subtle no disponible'));
    var texto = String(sal) + ':' + String(clave);
    var datos = new TextEncoder().encode(texto);
    return cripto.digest('SHA-256', datos).then(bytesAHex);
  }

  function generarSal(bytes, cripto) {
    var n = bytes || 16;
    var c = cripto || (raiz.crypto && raiz.crypto.getRandomValues ? raiz.crypto : null);
    if (!c) throw new Error('crypto.getRandomValues no disponible');
    var arr = new Uint8Array(n);
    c.getRandomValues(arr);
    return bytesAHex(arr.buffer);
  }

  /** Comparacion en tiempo constante de dos cadenas hex. */
  function hashIgual(a, b) {
    var x = String(a || '').toLowerCase();
    var y = String(b || '').toLowerCase();
    if (x.length !== y.length || x.length === 0) return false;
    var dif = 0;
    for (var i = 0; i < x.length; i++) dif |= (x.charCodeAt(i) ^ y.charCodeAt(i));
    return dif === 0;
  }

  /**
   * Verifica una credencial completa (CU-01 pasos 5 a 7).
   * Devuelve { ok, motivo, mensaje, tecnico }. `motivo` es informativo para el
   * registro del intento; el mensaje mostrado es generico (D-39).
   */
  function verificarCredencial(tecnicos, p00, clave, opciones) {
    var opts = opciones || {};
    var lista = Array.isArray(tecnicos) ? tecnicos : [];
    var resultado = { ok: false, motivo: '', mensaje: '', tecnico: null };
    var id = typeof p00 === 'string' ? p00.trim() : '';
    var pass = typeof clave === 'string' ? clave : '';

    if (id === '' || pass === '') {
      resultado.motivo = 'vacio';
      resultado.mensaje = CONST.MSG.SIN_P00;
      return Promise.resolve(resultado);
    }
    // Paso 5: la longitud se valida ANTES de consultar el padron (D-39).
    if (pass.length < 8) {
      resultado.motivo = 'longitud';
      resultado.mensaje = CONST.MSG.CLAVE_CORTA;
      return Promise.resolve(resultado);
    }
    // Paso 6: coincidencia exacta por P00 con status activo. El nombre NO vale.
    var encontrado = null;
    for (var i = 0; i < lista.length; i++) {
      if (String(lista[i].P00 || '').trim() === id) { encontrado = lista[i]; break; }
    }
    if (!encontrado) {
      resultado.motivo = 'p00';
      resultado.mensaje = CONST.MSG.CREDENCIAL;
      return Promise.resolve(resultado);
    }
    if (String(encontrado.status || '') !== 'Activo') {
      resultado.motivo = 'inactivo';
      resultado.mensaje = CONST.MSG.CREDENCIAL;
      return Promise.resolve(resultado);
    }
    // Paso 7: hash SHA-256 con la sal del tecnico, nunca en claro.
    return hashClave(pass, encontrado.clave_sal, opts.subtle).then(function (h) {
      if (!hashIgual(h, encontrado.clave_hash)) {
        resultado.motivo = 'hash';
        resultado.mensaje = CONST.MSG.CREDENCIAL;
        return resultado;
      }
      resultado.ok = true;
      resultado.tecnico = encontrado;
      var vigencia = revisarVigenciaClave(encontrado, opts.fecha || ahora());
      resultado.exigeCambio = vigencia.exigeCambio;
      resultado.motivoVigencia = vigencia.motivo;
      resultado.mensajeVigencia = vigencia.mensaje;
      return resultado;
    });
  }

  /**
   * Vigencia de la contrasena: 90 dias de caducidad o cambio obligatorio
   * marcado por el supervisor (D-39, CU-01 paso 8 y 8b).
   */
  function revisarVigenciaClave(tecnico, fecha) {
    if (!tecnico) return { exigeCambio: false, motivo: '', mensaje: '', dias: null };
    if (String(tecnico.clave_cambio_obligatorio || '').toUpperCase() === 'SI') {
      return {
        exigeCambio: true,
        motivo: 'cambio_obligatorio',
        mensaje: CONST.MSG.CAMBIO_OBLIGATORIO,
        dias: null
      };
    }
    var hoy = formatearFecha(fecha || ahora());
    var dias = diasEntre(tecnico.clave_fecha_cambio, hoy);
    if (dias !== null && dias > CONST.MSG_DIAS_CLAVE) {
      return { exigeCambio: true, motivo: 'caducada', mensaje: CONST.MSG.CADUCADA, dias: dias };
    }
    return { exigeCambio: false, motivo: '', mensaje: '', dias: dias };
  }

  /** Cambio de contrasena del propio tecnico (CU-01 paso 9). */
  function validarCambioClave(nueva, confirmacion) {
    var errores = [];
    var n = typeof nueva === 'string' ? nueva : '';
    if (n.length < 8) errores.push(CONST.MSG.CLAVE_CORTA);
    if (n !== (typeof confirmacion === 'string' ? confirmacion : '')) errores.push('Las contraseñas no coinciden');
    return { valido: errores.length === 0, errores: errores };
  }

  // ------------------------------------------------------------------
  // Matriz de permisos operador / supervisor (D-35, RNF-12)
  // ------------------------------------------------------------------
  var ACCIONES = {
    'sesion.iniciar': { etiqueta: 'Iniciar sesión (CU-01)', Operador: true, Supervisor: true },
    'casos.consultar': { etiqueta: 'Consultar casos (CU-10, CU-11)', Operador: true, Supervisor: true, ambito: 'cuadrilla' },
    'casos.editar': { etiqueta: 'Editar clase / nivel / tipo_abonado (CU-10)', Operador: true, Supervisor: true, ambito: 'cuadrilla' },
    'casos.cerrar': { etiqueta: 'Cerrar o reabrir un caso (CU-12)', Operador: true, Supervisor: true, ambito: 'cuadrilla' },
    'casos.alta': { etiqueta: 'Alta manual de caso (CU-14)', Operador: true, Supervisor: true },
    'casos.auditoria': { etiqueta: 'Consulta de auditoría (CU-15)', Operador: false, Supervisor: true },
    'ingesta.ejecutar': { etiqueta: 'Ingesta del CSV (CU-08)', Operador: true, Supervisor: true },
    'sector.cola': { etiqueta: 'Resolver direcciones sin sector (CU-09)', Operador: true, Supervisor: true },
    'gestion.bandeja': { etiqueta: 'Bandeja GESTION (CU-13)', Operador: false, Supervisor: true },
    'config.central': { etiqueta: 'Configuración de la central (CU-02)', Operador: false, Supervisor: true },
    'config.tecnicos': { etiqueta: 'Padrón de técnicos (CU-03)', Operador: false, Supervisor: true },
    'config.flota': { etiqueta: 'Padrón de flota (CU-04)', Operador: false, Supervisor: true },
    'config.cuadrillas': { etiqueta: 'Padrón de cuadrillas (CU-05)', Operador: false, Supervisor: true },
    'config.sectores': { etiqueta: 'Sectores: CRUD completo (CU-06)', Operador: false, Supervisor: true },
    'config.claves': { etiqueta: 'Palabras clave (CU-07)', Operador: false, Supervisor: true },
    'clave.restablecer': { etiqueta: 'Restablecer contraseña de un técnico (CU-03)', Operador: false, Supervisor: true },
    'despacho.generar': { etiqueta: 'Generar y ajustar el despacho (CU-16)', Operador: false, Supervisor: true },
    'despacho.pdf': { etiqueta: 'Emitir PDF del despacho (CU-17)', Operador: false, Supervisor: true },
    'monitoreo.ver': { etiqueta: 'MONITOREO, GRAFICOS y reportes (CU-18, CU-19)', Operador: false, Supervisor: true },
    'concentradas.ver': { etiqueta: 'Casos especiales y averías concentradas (CU-20)', Operador: false, Supervisor: true },
    'respaldo.ejecutar': { etiqueta: 'Respaldo y restauración (CU-21)', Operador: false, Supervisor: true },
    'entorno.diagnostico': { etiqueta: 'Contingencia y diagnóstico (CU-22)', Operador: true, Supervisor: true }
  };

  /**
   * Determina el rol de una sesion. Decision de implementacion anotada en el
   * informe: `tecnicos.status` sigue siendo Activo/Inactivo (diccionario_datos.md
   * 5.2) y el rol se lee de un campo `rol` con valor por defecto "Operador";
   * asi una sesion de operador nunca queda habilitada como supervisora por
   * accidente (D-35, RNF-12).
   */
  function resolverRol(tecnico) {
    if (!tecnico) return null;
    var rol = String(tecnico.rol || '').trim().toLowerCase();
    if (rol === 'supervisor') return 'Supervisor';
    return 'Operador';
  }

  function permite(rol, accion) {
    var def = ACCIONES[accion];
    if (!def) return false;
    if (rol !== 'Operador' && rol !== 'Supervisor') return false;
    return def[rol] === true;
  }

  function exigeAmbito(accion) {
    var def = ACCIONES[accion];
    return !!(def && def.ambito === 'cuadrilla');
  }

  /** Devuelve el id de cuadrilla del tecnico, si integra una cuadrilla activa. */
  function cuadrillaDeTecnico(tecnico, cuadrillas) {
    if (!tecnico || !Array.isArray(cuadrillas)) return '';
    var p00 = String(tecnico.P00 || '').trim();
    var cedula = String(tecnico.cedula || '').trim();
    var nombre = String(tecnico.nombre || '').trim();
    for (var i = 0; i < cuadrillas.length; i++) {
      var c = cuadrillas[i];
      if (String(c.status || '') !== 'Activa') continue;
      var lista = Array.isArray(c.tecnicos) ? c.tecnicos : [];
      for (var j = 0; j < lista.length; j++) {
        var v = String(lista[j] === null || lista[j] === undefined ? '' : lista[j]).trim();
        if (v && (v === p00 || v === cedula || v === nombre)) return String(c.id || '');
      }
    }
    return '';
  }

  /**
   * Ambito de la sesion: que casos ve y puede tocar (D-35, D-37, RNF-12).
   * Devuelve { rol, cuadrilla, soloLectura, motivo }.
   */
  function ambitoSesion(sesion, cuadrillas) {
    var rol = sesion && sesion.rol ? sesion.rol : null;
    var cuadrilla = '';
    if (rol === 'Operador' && sesion && sesion.tecnico) {
      cuadrilla = cuadrillaDeTecnico(sesion.tecnico, cuadrillas);
    }
    var soloLectura = rol === 'Operador' && cuadrilla === '';
    return {
      rol: rol,
      cuadrilla: cuadrilla,
      soloLectura: soloLectura,
      motivo: soloLectura ? CONST.MSG.SIN_CUADRILLA : ''
    };
  }

  function casoVisible(ambito, caso) {
    if (!ambito || !caso) return false;
    if (ambito.rol === 'Supervisor') return true;
    if (ambito.rol !== 'Operador') return false;
    if (ambito.soloLectura) return true; // consulta global en solo lectura
    return String(caso['Reparador Principal'] || '') === ambito.cuadrilla;
  }

  function puedeEditarCaso(ambito, caso) {
    if (!ambito || !caso) return false;
    if (ambito.rol === 'Supervisor') return true;
    if (ambito.rol !== 'Operador' || ambito.soloLectura) return false;
    return String(caso['Reparador Principal'] || '') === ambito.cuadrilla;
  }

  /**
   * Autorizacion completa de una accion sobre un caso: rol + ambito.
   * Devuelve { permitido, mensaje }.
   */
  function autorizar(ambito, accion, caso) {
    if (!ambito || !ambito.rol) return { permitido: false, mensaje: CONST.MSG.SIN_SESION };
    if (!permite(ambito.rol, accion)) return { permitido: false, mensaje: CONST.MSG.ROL };
    if (exigeAmbito(accion)) {
      if (accion === 'casos.consultar') {
        if (!casoVisible(ambito, caso)) return { permitido: false, mensaje: CONST.MSG.OTRA_CUADRILLA };
      } else if (!puedeEditarCaso(ambito, caso)) {
        if (ambito.rol === 'Operador' && ambito.soloLectura) {
          return { permitido: false, mensaje: CONST.MSG.SIN_CUADRILLA };
        }
        return { permitido: false, mensaje: CONST.MSG.OTRA_CUADRILLA };
      }
    }
    return { permitido: true, mensaje: '' };
  }

  // ------------------------------------------------------------------
  // Validaciones de campos (RNF-10, D-20)
  // ------------------------------------------------------------------
  function esEnum(valor, permitidos) {
    return permitidos.indexOf(String(valor || '').trim()) !== -1;
  }

  function telefonoValido(texto) {
    var t = String(texto || '').trim();
    if (t === '') return false;
    return /^\d{7,15}$/.test(t);
  }

  function obligatorio(valor) {
    return String(valor === null || valor === undefined ? '' : valor).trim() !== '';
  }

  /**
   * Cierre bloqueante (CU-12, D-20, RNF-10). No permite CERRADO sin
   * `resolucion` ni `fechaResolucion` y valida enums, fecha real, observaciones
   * y que el sector exista.
   */
  function validarCierre(entrada, opciones) {
    var opts = opciones || {};
    var datos = entrada || {};
    var errores = [];
    var campos = {};
    var resolucion = String(datos.resolucion || '').trim();
    var fecha = String(datos.fechaResolucion || '').trim();
    var sacas = String(datos.sacas || '').trim();
    var observaciones = String(datos.observaciones === null || datos.observaciones === undefined ? '' : datos.observaciones);

    if (resolucion === '') {
      errores.push(CONST.MSG.RESOLUCION_FALTA);
      campos.resolucion = CONST.MSG.RESOLUCION_FALTA;
    } else if (!esEnum(resolucion, CONST.RESOLUCION)) {
      errores.push('Resolución inválida: use IVR, COS o COLA');
      campos.resolucion = 'Resolución inválida: use IVR, COS o COLA';
    }
    if (fecha === '') {
      errores.push(CONST.MSG.FECHA_RESOLUCION_FALTA);
      campos.fechaResolucion = CONST.MSG.FECHA_RESOLUCION_FALTA;
    } else if (!esFechaValida(fecha)) {
      errores.push(CONST.MSG.FECHA_INVALIDA);
      campos.fechaResolucion = CONST.MSG.FECHA_INVALIDA;
    }
    if (sacas !== '' && !esEnum(sacas, CONST.SACAS)) {
      errores.push(CONST.MSG.SACAS_INVALIDO);
      campos.sacas = CONST.MSG.SACAS_INVALIDO;
    }
    if (observaciones.length > 500) {
      errores.push('Las observaciones admiten hasta 500 caracteres');
      campos.observaciones = 'Las observaciones admiten hasta 500 caracteres';
    }
    var sectores = opts.sectores;
    if (Array.isArray(sectores)) {
      var sector = String(datos.sector || '').trim();
      if (sector !== '') {
        var existe = sectores.some(function (s) { return String(s.id || '') === sector; });
        if (!existe) {
          errores.push(CONST.MSG.SECTOR_INEXISTENTE);
          campos.sector = CONST.MSG.SECTOR_INEXISTENTE;
        }
      }
    }
    return { valido: errores.length === 0, errores: errores, campos: campos };
  }

  /** Validacion de la edicion en linea de CASOS (CU-10 paso 9). */
  function validarEdicionCaso(cambios) {
    var errores = [];
    var campos = {};
    var c = cambios || {};
    if (c.clase !== undefined && !esEnum(c.clase, CONST.CLASE)) {
      errores.push(CONST.MSG.CLASE_INVALIDA); campos.clase = CONST.MSG.CLASE_INVALIDA;
    }
    if (c.nivel !== undefined && !esEnum(c.nivel, CONST.NIVEL)) {
      errores.push(CONST.MSG.NIVEL_INVALIDO); campos.nivel = CONST.MSG.NIVEL_INVALIDO;
    }
    if (c.tipo_abonado !== undefined && c.tipo_abonado !== '' && !esEnum(c.tipo_abonado, CONST.TIPO_ABONADO)) {
      errores.push(CONST.MSG.TIPO_INVALIDO); campos.tipo_abonado = CONST.MSG.TIPO_INVALIDO;
    }
    return { valido: errores.length === 0, errores: errores, campos: campos };
  }

  /** «tipo» de D-23: combinacion clase + nivel calculada en pantalla. */
  function tipoCalculado(caso) {
    var clase = String((caso && caso.clase) || '').trim();
    var nivel = String((caso && caso.nivel) || '').trim();
    if (!clase && !nivel) return '';
    return clase + '-' + nivel;
  }

  function estaAbierto(caso) {
    return String((caso && caso.status) || '') !== 'CERRADO';
  }

  // ------------------------------------------------------------------
  // Historial inmutable (D-56, RNF-09)
  // ------------------------------------------------------------------
  /**
   * Genera la linea JSONL de un cambio. La salida no lleva salto de linea: el
   * llamador la añade. El operador sale de la sesion y jamas la contrasena.
   */
  function lineaHistorial(datos) {
    var d = datos || {};
    var accion = String(d.accion || '').trim();
    if (CONST.ACCIONES_HISTORIAL.indexOf(accion) === -1) {
      throw new Error('accion de historial invalida: ' + accion);
    }
    var linea = {
      fecha_hora: String(d.fecha_hora || ''),
      operador: String(d.operador || ''),
      id_averia: String(d.id_averia || ''),
      campo: String(d.campo || ''),
      valor_anterior: d.valor_anterior === null || d.valor_anterior === undefined ? '' : String(d.valor_anterior),
      valor_nuevo: d.valor_nuevo === null || d.valor_nuevo === undefined ? '' : String(d.valor_nuevo),
      accion: accion
    };
    return JSON.stringify(linea);
  }

  /**
   * Lineas de historial de un cambio de caso: una por campo modificado
   * (CU-10 paso 9, CU-12 paso 7, CU-13 paso 5, CU-15 EARS).
   */
  function lineasDeCambio(anterior, nuevo, contexto) {
    var ctx = contexto || {};
    var accion = ctx.accion || 'edicion';
    var cambios = ctx.campos || CONST.CAMPOS_HISTORIAL.concat(CONST.CAMPOS_CIERRE);
    var lineas = [];
    for (var i = 0; i < cambios.length; i++) {
      var campo = cambios[i];
      if (campo === 'status' && !accion) continue;
      var va = anterior ? (anterior[campo] === undefined ? '' : anterior[campo]) : '';
      var vn = nuevo ? (nuevo[campo] === undefined ? '' : nuevo[campo]) : '';
      if (String(va) === String(vn)) continue;
      lineas.push(lineaHistorial({
        fecha_hora: ctx.fecha_hora,
        operador: ctx.operador,
        id_averia: ctx.id_averia,
        campo: campo,
        valor_anterior: va,
        valor_nuevo: vn,
        accion: accion
      }));
    }
    return lineas;
  }

  /**
   * Lectura tolerante del historial: cada linea es un JSON independiente y una
   * linea corrupta no invalida las demas (D-56). Devuelve los registros
   * validos y el numero de lineas ilegibles.
   */
  function parsearHistorial(texto) {
    var registros = [];
    var corruptas = 0;
    var lineas = String(texto || '').split('\n');
    for (var i = 0; i < lineas.length; i++) {
      var linea = lineas[i].trim();
      if (linea === '') continue;
      try {
        var obj = JSON.parse(linea);
        if (obj && typeof obj === 'object') registros.push(obj);
        else corruptas++;
      } catch (e) {
        corruptas++;
      }
    }
    return { registros: registros, corruptas: corruptas };
  }

  function historialDeCaso(texto, idAveria) {
    var leido = parsearHistorial(texto);
    var id = String(idAveria || '');
    var filas = leido.registros.filter(function (r) { return String(r.id_averia || '') === id; });
    filas.sort(function (a, b) { return compararTexto(a.fecha_hora, b.fecha_hora); });
    return { filas: filas, corruptas: leido.corruptas };
  }

  // ------------------------------------------------------------------
  // Nombres de respaldo y utilidades de archivo (D-42, D-49)
  // ------------------------------------------------------------------
  function marcaArchivo(fecha) {
    var f = fecha || ahora();
    return String(f.getFullYear()) + '-' + dosDigitos(f.getMonth() + 1) + '-' + dosDigitos(f.getDate()) +
      '_' + dosDigitos(f.getHours()) + dosDigitos(f.getMinutes());
  }

  function nombreRespaldo(fecha) {
    return 'averias_' + marcaArchivo(fecha) + '.bak';
  }

  function nombreCopiaCierre(fecha) {
    return 'averias_' + marcaArchivo(fecha) + '.json';
  }

  /** ¿El nombre es una copia de cierre 'averias_AAAA-MM-DD_HHMM.json'? (D-49) */
  function esCopiaCierre(nombre) {
    return /^averias_\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(String(nombre || ''));
  }

  /** 'DD/MM/AAAA HH:MM' de una copia de cierre; '' si el nombre no lo es. */
  function marcaDeCopia(nombre) {
    var m = /^averias_(\d{4})-(\d{2})-(\d{2})_(\d{4})\.json$/.exec(String(nombre || ''));
    if (!m) return '';
    var hhmm = String(m[4]);
    return m[3] + '/' + m[2] + '/' + m[1] + ' ' + hhmm.slice(0, 2) + ':' + hhmm.slice(2);
  }

  /** ¿El nombre es un PDF de despacho de la ruta controlada (D-27, D-67)? */
  function esSalidaDespacho(nombre) {
    return /^Despacho_Cuadrilla_.+_\d{8}(_r\d+)?\.pdf$/.test(String(nombre || ''));
  }

  /** Conserva solo las 10 ultimas copias .bak del maestro (D-42, RNF-15). */
  function respaldosAExpedir(nombres) {
    var baks = (nombres || []).filter(function (n) {
      return /^averias_\d{4}-\d{2}-\d{2}_\d{4}\.bak$/.test(String(n));
    });
    baks.sort();
    var sobran = baks.length - 10;
    return sobran > 0 ? baks.slice(0, sobran) : [];
  }

  function serializarJSON(datos) {
    return JSON.stringify(datos, null, 2) + '\n';
  }

  // ------------------------------------------------------------------
  // Log de accesos `incidencias.log`: rotacion 5 MB x 5 archivos (D-58, D-64)
  // ------------------------------------------------------------------
  /**
   * Nombre de una copia rotada. Indice 0 es el archivo vigente; 1..N las
   * copias `incidencias.1.log` ... `incidencias.5.log` (D-64).
   */
  function nombreIncidencias(indice) {
    var n = parseInt(indice, 10);
    if (!isFinite(n) || n <= 0) return CONST.ARCHIVO_INCIDENCIAS;
    return 'incidencias.' + n + '.log';
  }

  /** Indice de una copia rotada, o 0 si el nombre no es del log de accesos. */
  function indiceIncidencias(nombre) {
    var texto = String(nombre || '');
    if (texto === CONST.ARCHIVO_INCIDENCIAS) return 0;
    var m = /^incidencias\.(\d+)\.log$/.exec(texto);
    if (!m) return -1;
    var n = parseInt(m[1], 10);
    if (n < 1 || n > CONST.LOG_MAX_ARCHIVOS) return -1;
    return n;
  }

  /**
   * Decide si el log vigente debe rotar y como.
   * `opciones.tamano` (bytes) y `opciones.maximo` (bytes) permiten probar la
   * rotacion sin escribir 5 MB reales; `opciones.nombres` es el catalogo de
   * archivos presentes en `datos/`.
   * Devuelve { rota, tamano, maximo, archivo, destino, pasos, descartados },
   * donde `pasos` es la lista ordenada de renombrados y `descartados` los
   * archivos que se eliminan (el mas antiguo, D-64).
   */
  function planRotacionLog(entrada, opciones) {
    var opts = opciones || {};
    var tamano = Number(opts.tamano);
    if (!isFinite(tamano) || tamano < 0) tamano = 0;
    var maximo = Number(opts.maximo);
    if (!isFinite(maximo) || maximo <= 0) maximo = CONST.LOG_MAX_BYTES;
    var nombres = Array.isArray(opts.nombres) ? opts.nombres : [];
    var indice = indiceIncidencias(entrada === undefined || entrada === null ? CONST.ARCHIVO_INCIDENCIAS : entrada);
    var archivo = indice > 0 ? nombreIncidencias(indice) : CONST.ARCHIVO_INCIDENCIAS;
    var pasos = [];
    var descartados = [];
    if (tamano > maximo) {
      // Cascada de mayor a menor: la copia N se descarta y cada N-1 pasa a N
      // (`incidencias.4.log` -> `incidencias.5.log`), para que 1 quede libre.
      var indices = nombres.map(indiceIncidencias).filter(function (n) { return n >= 1; });
      indices.sort(function (a, b) { return b - a; });
      indices.forEach(function (n) {
        if (n >= CONST.LOG_MAX_ARCHIVOS) {
          descartados.push(nombreIncidencias(n));
          return;
        }
        pasos.push({ desde: nombreIncidencias(n), hasta: nombreIncidencias(n + 1) });
      });
      pasos.push({ desde: archivo, hasta: nombreIncidencias(1) });
    }
    return {
      rota: tamano > maximo,
      tamano: tamano,
      maximo: maximo,
      archivo: archivo,
      destino: nombreIncidencias(1),
      pasos: pasos,
      descartados: descartados
    };
  }

  /** Lineas de log que se conservan: el vigente y las 5 copias rotadas (D-64). */
  function archivosLogConservados() {
    var lista = [CONST.ARCHIVO_INCIDENCIAS];
    for (var i = 1; i <= CONST.LOG_MAX_ARCHIVOS; i++) lista.push(nombreIncidencias(i));
    return lista;
  }

  // ------------------------------------------------------------------
  // Estructuras iniciales vacias (Paso 2.6 y 2.8: sin datos inventados)
  // ------------------------------------------------------------------
  function estructurasIniciales() {
    return {
      'averias.json': [],
      'despacho.json': [],
      'estructura.json': {
        version: 1,
        columnas_esperadas: 80,
        separador: ';',
        codificacion: 'UTF-8',
        campos: [
          { json: 'id_averia', columna: 11, tipo: 'T', obligatorio: true },
          { json: 'telefono', columna: 14, tipo: 'T', obligatorio: true },
          { json: 'persona_reporta', columna: 16, tipo: 'T', obligatorio: false },
          { json: 'contacto', columna: 17, tipo: 'T', obligatorio: false },
          { json: 'fecha_cita', columna: 19, tipo: 'F', obligatorio: false },
          { json: 'ultimo_comentario', columna: 21, tipo: 'T', obligatorio: false },
          { json: 'problema_reporte', columna: 28, tipo: 'T', obligatorio: false },
          { json: 'informacion_1', columna: 31, tipo: 'T', obligatorio: false },
          { json: 'informacion_2', columna: 32, tipo: 'T', obligatorio: false },
          { json: 'nombre', columna: 33, tipo: 'T', obligatorio: false },
          { json: 'direccion', columna: 34, tipo: 'T', obligatorio: true },
          { json: 'olt', columna: 36, tipo: 'T', obligatorio: false },
          { json: 'plan', columna: 39, tipo: 'T', obligatorio: false },
          { json: 'slot', columna: 40, tipo: 'T', obligatorio: false },
          { json: 'puerto', columna: 41, tipo: 'T', obligatorio: false },
          { json: 'fat', columna: 43, tipo: 'T', obligatorio: false },
          { json: 'serial', columna: 44, tipo: 'T', obligatorio: false },
          { json: 'extra', columna: 46, tipo: 'T', obligatorio: false },
          { json: 'ups', columna: 62, tipo: 'T', obligatorio: false },
          { json: 'codigos_sin_gestion_en_VENAPP', columna: 64, tipo: 'T', obligatorio: false }
        ],
        filtro_central: { columnas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
      },
      'central.json': {
        // `region` queda vacío: es el único de los 10 campos cuyo valor real no
        // consta en la documentación y no se inventa (Paso 2.6/2.8).
        region: '',
        estado_geografico: 'BOLIVARIANO MIRANDA',
        capital_estado: 'LOS TEQUES',
        municipio: 'BARUTA',
        parroquia: 'BARUTA',
        estado_operativo: 'MIRANDA-2',
        distrito: '10204',
        area: 'AREA 4',
        central: '2324X',
        nombre_central: 'FRANCISCO SALIAS'
      },
      'tecnicos.json': [],
      'flota.json': [],
      'cuadrillas.json': [],
      'sectores.json': [],
      'claves_clasificacion.json': {
        claves: ['LOSS ROJO', 'FALLA FIBRA', 'FIBRA DAÑADA'],
        normalizacion: 'normalizada',
        campos_evaluados: ['ultimo_comentario', 'problema_reporte', 'informacion_1', 'informacion_2'],
        umbral_concentracion: 3
      },
      'historial.jsonl': ''
    };
  }

  var NUCLEO = {
    CONST: CONST,
    ACCIONES: ACCIONES,
    formatearFecha: formatearFecha,
    formatearFechaHora: formatearFechaHora,
    ahora: ahora,
    marcaAhora: marcaAhora,
    esFechaValida: esFechaValida,
    parsearFecha: parsearFecha,
    diasEntre: diasEntre,
    compararTexto: compararTexto,
    hashClave: hashClave,
    generarSal: generarSal,
    hashIgual: hashIgual,
    verificarCredencial: verificarCredencial,
    revisarVigenciaClave: revisarVigenciaClave,
    validarCambioClave: validarCambioClave,
    resolverRol: resolverRol,
    permite: permite,
    exigeAmbito: exigeAmbito,
    cuadrillaDeTecnico: cuadrillaDeTecnico,
    ambitoSesion: ambitoSesion,
    casoVisible: casoVisible,
    puedeEditarCaso: puedeEditarCaso,
    autorizar: autorizar,
    esEnum: esEnum,
    telefonoValido: telefonoValido,
    obligatorio: obligatorio,
    validarCierre: validarCierre,
    validarEdicionCaso: validarEdicionCaso,
    tipoCalculado: tipoCalculado,
    estaAbierto: estaAbierto,
    lineaHistorial: lineaHistorial,
    lineasDeCambio: lineasDeCambio,
    parsearHistorial: parsearHistorial,
    historialDeCaso: historialDeCaso,
    marcaArchivo: marcaArchivo,
    nombreRespaldo: nombreRespaldo,
    nombreCopiaCierre: nombreCopiaCierre,
    esCopiaCierre: esCopiaCierre,
    marcaDeCopia: marcaDeCopia,
    esSalidaDespacho: esSalidaDespacho,
    respaldosAExpedir: respaldosAExpedir,
    serializarJSON: serializarJSON,
    nombreIncidencias: nombreIncidencias,
    indiceIncidencias: indiceIncidencias,
    planRotacionLog: planRotacionLog,
    archivosLogConservados: archivosLogConservados,
    estructurasIniciales: estructurasIniciales
  };

  raiz.GGTO_NUCLEO = NUCLEO;
  if (typeof module !== 'undefined' && module.exports) module.exports = NUCLEO;
})(typeof globalThis !== 'undefined' ? globalThis : this);
