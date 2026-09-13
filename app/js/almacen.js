/*
 * GGTO-v1 - almacen.js
 * Persistencia con File System Access API sobre C:\GGTO\datos (D-01, D-19):
 *  - lectura de los 10 archivos de trabajo (9 JSON + historial.jsonl);
 *  - escritura verificada: .bak previo (10 ultimas), archivo temporal,
 *    relectura comparada y confirmacion (D-42, RNF-15);
 *  - deteccion de conflicto por marca de modificacion (D-41, RNF-14);
 *  - historial inmutable append-only (D-56, RNF-09);
 *  - modo descarga para navegadores sin la API (RNF-03), exigiendo sesion.
 *
 * Depende de GGTO_NUCLEO (carga previa por <script>).
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var CONST = N.CONST;

  var NOMBRES_JSON = [
    'averias.json', 'despacho.json', 'estructura.json',
    'central.json', 'tecnicos.json', 'flota.json', 'cuadrillas.json',
    'sectores.json', 'claves_clasificacion.json'
  ];
  var NOMBRES = NOMBRES_JSON.concat(['historial.jsonl']);

  function soportado() {
    return typeof raiz.showDirectoryPicker === 'function' && typeof raiz.FileSystemFileHandle === 'function';
  }

  function errorDe(e) {
    if (!e) return 'error desconocido';
    return e.name ? (e.name + ': ' + (e.message || '')) : String(e.message || e);
  }

  /** Pide autorizacion al operador y devuelve un objeto de trabajo sobre datos/. */
  function abrirCarpeta() {
    if (!soportado()) return Promise.reject(new Error('File System Access API no disponible'));
    return raiz.showDirectoryPicker({ id: 'ggto-datos', mode: 'readwrite' }).then(function (dir) {
      return crearAlmacen(dir);
    });
  }

  /** Alternativa por archivo (showOpenFilePicker) cuando no se quiere autorizar la carpeta. */
  function abrirArchivos() {
    if (typeof raiz.showOpenFilePicker !== 'function') {
      return Promise.reject(new Error('showOpenFilePicker no disponible'));
    }
    var manejadores = {};
    var pendientes = [];
    NOMBRES.forEach(function (nombre) {
      pendientes.push(function () {
        return raiz.showOpenFilePicker({
          multiple: false,
          types: [{ description: 'Archivos de datos GGTO', accept: { 'application/json': ['.json', '.jsonl'] } }]
        }).then(function (lista) {
          manejadores[nombre] = lista[0];
        }).catch(function () {
          manejadores[nombre] = null;
        });
      });
    });
    return pendientes.reduce(function (p, tarea) { return p.then(tarea); }, Promise.resolve()).then(function () {
      return crearAlmacenPorArchivos(manejadores);
    });
  }

  function leerTexto(handle) {
    return handle.getFile().then(function (archivo) {
      return archivo.text().then(function (texto) {
        return { texto: texto, ultimaModificacion: archivo.lastModified };
      });
    });
  }

  function crearAlmacen(dir) {
    return {
      tipo: 'carpeta',
      carpeta: dir,
      handles: {},
      estado: {},
      datos: {},
      historialTexto: '',
      cargar: cargarCarpeta,
      guardarArchivo: guardarCarpeta,
      agregarHistorial: agregarHistorialCarpeta,
      crearEstructura: crearEstructuraCarpeta,
      guardarCopiaCierre: guardarCopiaCierreCarpeta,
      describir: function () { return CONST.RUTA_DATOS + ' (carpeta autorizada)'; }
    };
  }

  function crearAlmacenPorArchivos(manejadores) {
    var almacen = {
      tipo: 'archivos',
      carpeta: null,
      handles: manejadores,
      estado: {},
      datos: {},
      historialTexto: '',
      cargar: cargarArchivos,
      guardarArchivo: guardarArchivoSuelto,
      agregarHistorial: agregarHistorialArchivo,
      crearEstructura: crearEstructuraArchivos,
      guardarCopiaCierre: function () {
        return Promise.reject(new Error('El modo por archivo no crea la copia fechada de cierre'));
      },
      describir: function () { return CONST.RUTA_DATOS + ' (archivos elegidos uno a uno)'; }
    };
    return almacen;
  }

  // ------------------------------------------------------------------
  // Lectura
  // ------------------------------------------------------------------
  function normalizarResultado(almacen, nombre, lectura, error) {
    var faltante = false;
    var invalido = null;
    var valor = null;
    if (error) {
      faltante = true;
    } else if (nombre === CONST.ARCHIVO_HISTORIAL) {
      var leido = N.parsearHistorial(lectura.texto);
      almacen.historialTexto = lectura.texto;
      valor = leido.registros;
      if (leido.corruptas > 0) invalido = leido.corruptas + ' línea(s) ilegible(s), se conservan intactas';
    } else {
      try {
        valor = JSON.parse(lectura.texto);
      } catch (e) {
        invalido = 'JSON inválido: ' + errorDe(e);
        valor = null;
      }
    }
    almacen.datos[nombre] = valor;
    almacen.estado[nombre] = {
      existe: !faltante,
      invalido: invalido,
      ultimaModificacion: lectura ? lectura.ultimaModificacion : null,
      tamano: lectura ? lectura.texto.length : 0
    };
    return {
      archivo: nombre,
      existe: !faltante,
      invalido: invalido,
      registros: Array.isArray(valor) ? valor.length : null
    };
  }

  function cargarCarpeta() {
    var almacen = this;
    var resumen = [];
    var cadena = Promise.resolve();
    NOMBRES.forEach(function (nombre) {
      cadena = cadena.then(function () {
        return almacen.carpeta.getFileHandle(nombre).then(function (handle) {
          almacen.handles[nombre] = handle;
          return leerTexto(handle).then(function (lectura) {
            resumen.push(normalizarResultado(almacen, nombre, lectura, null));
          });
        }).catch(function () {
          almacen.handles[nombre] = null;
          resumen.push(normalizarResultado(almacen, nombre, null, true));
        });
      });
    });
    return cadena.then(function () { return { archivos: resumen }; });
  }

  function cargarArchivos() {
    var almacen = this;
    var resumen = [];
    var cadena = Promise.resolve();
    NOMBRES.forEach(function (nombre) {
      cadena = cadena.then(function () {
        var handle = almacen.handles[nombre];
        if (!handle) {
          resumen.push(normalizarResultado(almacen, nombre, null, true));
          return null;
        }
        return leerTexto(handle).then(function (lectura) {
          resumen.push(normalizarResultado(almacen, nombre, lectura, null));
        }).catch(function () {
          resumen.push(normalizarResultado(almacen, nombre, null, true));
        });
      });
    });
    return cadena.then(function () { return { archivos: resumen }; });
  }

  /** Marca de modificacion vigente en disco: sirve para detectar conflicto (D-41). */
  function marcaActual(almacen, nombre) {
    var handle = almacen.handles[nombre];
    if (!handle || typeof handle.getFile !== 'function') return Promise.resolve(null);
    return handle.getFile().then(function (archivo) {
      return archivo.lastModified;
    }).catch(function () { return null; });
  }

  function detectarConflicto(almacen, nombre) {
    var marca = almacen.estado[nombre] ? almacen.estado[nombre].ultimaModificacion : null;
    return marcaActual(almacen, nombre).then(function (actual) {
      if (marca === null || actual === null) return { conflicto: false };
      if (actual === marca) return { conflicto: false };
      var quien = '';
      var cuando = '';
      if (nombre === CONST.ARCHIVO_MAESTRO && Array.isArray(almacen.datos[nombre])) {
        var casos = almacen.datos[nombre];
        for (var i = casos.length - 1; i >= 0; i--) {
          if (N.obligatorio(casos[i].fecha_modificacion)) {
            quien = String(casos[i].usuario_modificacion || '');
            cuando = String(casos[i].fecha_modificacion || '');
            break;
          }
        }
      }
      return { conflicto: true, usuario_modificacion: quien, fecha_modificacion: cuando };
    });
  }

  // ------------------------------------------------------------------
  // Escritura verificada (D-42, RNF-15)
  // ------------------------------------------------------------------
  function escribirTemporal(almacen, nombre, contenido) {
    var handle = almacen.handles[nombre];
    if (!handle) return Promise.reject(new Error('No hay autorización de escritura para ' + nombre));
    return handle.createWritable().then(function (w) {
      return w.write(contenido).then(function () { return w.close(); });
    });
  }

  function esMaestro(nombre) {
    return nombre === CONST.ARCHIVO_MAESTRO;
  }

  /**
   * Guarda `datos` en `nombre` con la secuencia obligatoria:
   * conflicto -> .bak (10 ultimas) -> escritura -> relectura comparada -> limpieza.
   * `opciones.sobrescribir === true` es la decision consciente del operador
   * ante el conflicto de D-41.
   */
  function guardarCarpeta(nombre, datos, opciones) {
    var almacen = this;
    var opts = opciones || {};
    var contenido = nombre === CONST.ARCHIVO_HISTORIAL
      ? String(datos)
      : N.serializarJSON(datos);
    var marcaRespaldo = N.nombreRespaldo(new Date());
    var huboRespaldo = false;

    return detectarConflicto(almacen, nombre).then(function (conflicto) {
      if (conflicto.conflicto && opts.sobrescribir !== true) {
        var e = new Error('Conflicto: el archivo fue modificado por ' +
          (conflicto.usuario_modificacion || 'otro usuario') + ' el ' +
          (conflicto.fecha_modificacion || 'fecha desconocida') + '. Recargue o sobrescriba');
        e.tipo = 'conflicto';
        e.detalle = conflicto;
        throw e;
      }
      if (!almacen.handles[nombre]) throw new Error('No hay autorización de escritura para ' + nombre);
      // Paso 1: copia previa .bak (solo el maestro conserva versiones, D-42).
      if (esMaestro(nombre) && almacen.estado[nombre] && almacen.estado[nombre].existe) {
        return leerTexto(almacen.handles[nombre]).then(function (lectura) {
          return almacen.carpeta.getFileHandle(marcaRespaldo, { create: true }).then(function (bk) {
            return bk.createWritable().then(function (w) {
              return w.write(lectura.texto).then(function () { return w.close(); });
            });
          });
        }).then(function () {
          huboRespaldo = true;
          return leerTexto(almacen.handles[nombre]);
        }).then(function (previo) {
          return previo.texto;
        });
      }
      return null;
    }).then(function (previo) {
      // Pasos 2 y 3: escribir y releer comparando.
      return escribirTemporal(almacen, nombre, contenido).then(function () {
        return leerTexto(almacen.handles[nombre]);
      }).then(function (lectura) {
        if (lectura.texto !== contenido) {
          var e = new Error('La relectura no coincide con lo enviado');
          e.tipo = 'verificacion';
          throw e;
        }
        almacen.datos[nombre] = nombre === CONST.ARCHIVO_HISTORIAL ? N.parsearHistorial(contenido).registros : datos;
        if (nombre === CONST.ARCHIVO_HISTORIAL) almacen.historialTexto = contenido;
        almacen.estado[nombre] = {
          existe: true,
          invalido: null,
          ultimaModificacion: lectura.ultimaModificacion,
          tamano: contenido.length
        };
        if (esMaestro(nombre)) return limpiarRespaldos(almacen, marcaRespaldo);
        return null;
      }).catch(function (e) {
        // Ante fallo: restaurar el respaldo previo y avisar (D-42 paso 5).
        if (huboRespaldo && previo !== null) {
          return escribirTemporal(almacen, nombre, previo).then(function () {
            var err = new Error('No se pudo verificar la escritura de ' + nombre +
              ': se restauró el maestro del ' + marcaRespaldo);
            err.tipo = 'restaurado';
            err.causa = e;
            throw err;
          });
        }
        throw e;
      });
    });
  }

  function limpiarRespaldos(almacen, marcaRespaldo) {
    if (!almacen.carpeta || typeof almacen.carpeta.keys !== 'function') return Promise.resolve([]);
    var nombres = [];
    var iterador = almacen.carpeta.keys();
    function paso() {
      return iterador.next().then(function (r) {
        if (r.done) return nombres;
        nombres.push(r.value);
        return paso();
      });
    }
    return paso().then(function (todos) {
      var sobran = N.respaldosAExpedir(todos);
      var cadena = Promise.resolve();
      sobran.forEach(function (nombre) {
        if (nombre === marcaRespaldo) return;
        cadena = cadena.then(function () {
          return almacen.carpeta.removeEntry(nombre).catch(function () { return null; });
        });
      });
      return cadena.then(function () { return sobran; });
    }).catch(function () { return []; });
  }

  /** Modo por archivo: se conserva la misma verificacion, sin .bak por carpeta. */
  function guardarArchivoSuelto(nombre, datos, opciones) {
    var almacen = this;
    var opts = opciones || {};
    var contenido = nombre === CONST.ARCHIVO_HISTORIAL ? String(datos) : N.serializarJSON(datos);
    return detectarConflicto(almacen, nombre).then(function (conflicto) {
      if (conflicto.conflicto && opts.sobrescribir !== true) {
        var e = new Error('Conflicto: el archivo fue modificado por ' +
          (conflicto.usuario_modificacion || 'otro usuario') + ' el ' +
          (conflicto.fecha_modificacion || 'fecha desconocida') + '. Recargue o sobrescriba');
        e.tipo = 'conflicto';
        e.detalle = conflicto;
        throw e;
      }
      return escribirTemporal(almacen, nombre, contenido).then(function () {
        return leerTexto(almacen.handles[nombre]);
      }).then(function (lectura) {
        if (lectura.texto !== contenido) {
          var err = new Error('La relectura no coincide con lo enviado');
          err.tipo = 'verificacion';
          throw err;
        }
        almacen.datos[nombre] = nombre === CONST.ARCHIVO_HISTORIAL ? N.parsearHistorial(contenido).registros : datos;
        almacen.estado[nombre] = {
          existe: true, invalido: null,
          ultimaModificacion: lectura.ultimaModificacion, tamano: contenido.length
        };
        return null;
      });
    });
  }

  // ------------------------------------------------------------------
  // Historial inmutable: solo se añade al final (D-56)
  // ------------------------------------------------------------------
  function agregarHistorialCarpeta(lineas) {
    var almacen = this;
    var lote = (Array.isArray(lineas) ? lineas : [lineas]).filter(function (l) { return N.obligatorio(l); });
    if (lote.length === 0) return Promise.resolve({ agregadas: 0, verificadas: 0 });
    var bloque = lote.join('\n') + '\n';
    var handle = almacen.handles[CONST.ARCHIVO_HISTORIAL];
    if (!handle) return Promise.reject(new Error('No hay autorización de escritura para ' + CONST.ARCHIVO_HISTORIAL));
    var previo = '';
    return leerTexto(handle).then(function (lectura) {
      previo = lectura.texto;
      return handle.createWritable({ keepExistingData: true }).then(function (w) {
        return w.seek(previo.length).then(function () {
          return w.write(bloque);
        }).then(function () { return w.close(); });
      });
    }).then(function () {
      return leerTexto(handle);
    }).then(function (lectura) {
      var esperado = previo + bloque;
      if (lectura.texto !== esperado) {
        var e = new Error('No se pudo verificar la escritura del historial: ' +
          'se conservan las líneas anteriores');
        e.tipo = 'historial';
        throw e;
      }
      almacen.historialTexto = esperado;
      almacen.datos[CONST.ARCHIVO_HISTORIAL] = N.parsearHistorial(esperado).registros;
      almacen.estado[CONST.ARCHIVO_HISTORIAL] = {
        existe: true, invalido: null,
        ultimaModificacion: lectura.ultimaModificacion, tamano: esperado.length
      };
      return { agregadas: lote.length, verificadas: lote.length };
    });
  }

  function agregarHistorialArchivo(lineas) {
    var almacen = this;
    var lote = (Array.isArray(lineas) ? lineas : [lineas]).filter(function (l) { return N.obligatorio(l); });
    if (lote.length === 0) return Promise.resolve({ agregadas: 0, verificadas: 0 });
    var bloque = lote.join('\n') + '\n';
    var handle = almacen.handles[CONST.ARCHIVO_HISTORIAL];
    if (!handle) {
      // Sin autorizacion del historial se degrada a descarga, nunca se pierde el cambio.
      return Promise.reject(new Error('No hay autorización de escritura para ' + CONST.ARCHIVO_HISTORIAL));
    }
    var previo = almacen.historialTexto || '';
    return handle.createWritable({ keepExistingData: true }).then(function (w) {
      return w.seek(previo.length).then(function () { return w.write(bloque); }).then(function () { return w.close(); });
    }).then(function () {
      return leerTexto(handle);
    }).then(function (lectura) {
      var esperado = previo + bloque;
      if (lectura.texto !== esperado) throw new Error('No se pudo verificar la escritura del historial');
      almacen.historialTexto = esperado;
      almacen.datos[CONST.ARCHIVO_HISTORIAL] = N.parsearHistorial(esperado).registros;
      return { agregadas: lote.length, verificadas: lote.length };
    });
  }

  // ------------------------------------------------------------------
  // Creacion de la estructura inicial (Paso 2.6, sin datos inventados)
  // ------------------------------------------------------------------
  function crearEstructuraCarpeta(seleccion) {
    var almacen = this;
    var base = N.estructurasIniciales();
    var nombres = seleccion && seleccion.length ? seleccion : Object.keys(base);
    var creados = [];
    var cadena = Promise.resolve();
    nombres.forEach(function (nombre) {
      if (!(nombre in base)) return;
      var contenido = nombre === CONST.ARCHIVO_HISTORIAL ? '' : N.serializarJSON(base[nombre]);
      cadena = cadena.then(function () {
        return almacen.carpeta.getFileHandle(nombre, { create: true }).then(function (handle) {
          almacen.handles[nombre] = handle;
          return handle.createWritable().then(function (w) {
            return w.write(contenido).then(function () { return w.close(); });
          });
        }).then(function () {
          return leerTexto(almacen.handles[nombre]);
        }).then(function (lectura) {
          if (lectura.texto !== contenido) throw new Error('Verificación fallida al crear ' + nombre);
          almacen.datos[nombre] = nombre === CONST.ARCHIVO_HISTORIAL ? [] : base[nombre];
          if (nombre === CONST.ARCHIVO_HISTORIAL) almacen.historialTexto = '';
          almacen.estado[nombre] = {
            existe: true, invalido: null,
            ultimaModificacion: lectura.ultimaModificacion, tamano: contenido.length
          };
          creados.push(nombre);
        });
      });
    });
    return cadena.then(function () { return { creados: creados }; });
  }

  function crearEstructuraArchivos(seleccion) {
    var almacen = this;
    var base = N.estructurasIniciales();
    var nombres = seleccion && seleccion.length ? seleccion : Object.keys(base);
    var creados = [];
    if (typeof raiz.showSaveFilePicker !== 'function') {
      return Promise.reject(new Error('El navegador no permite crear archivos: active el modo descarga'));
    }
    var cadena = Promise.resolve();
    nombres.forEach(function (nombre) {
      if (!(nombre in base)) return;
      var contenido = nombre === CONST.ARCHIVO_HISTORIAL ? '' : N.serializarJSON(base[nombre]);
      cadena = cadena.then(function () {
        return raiz.showSaveFilePicker({ suggestedName: nombre }).then(function (handle) {
          almacen.handles[nombre] = handle;
          return handle.createWritable().then(function (w) {
            return w.write(contenido).then(function () { return w.close(); });
          });
        }).then(function () {
          return leerTexto(almacen.handles[nombre]);
        }).then(function (lectura) {
          if (lectura.texto !== contenido) throw new Error('Verificación fallida al crear ' + nombre);
          almacen.datos[nombre] = nombre === CONST.ARCHIVO_HISTORIAL ? [] : base[nombre];
          creados.push(nombre);
        });
      });
    });
    return cadena.then(function () { return { creados: creados }; });
  }

  /** Copia fechada con hora del maestro en C:\GGTO\respaldo\ (D-49, RNF-16). */
  function guardarCopiaCierreCarpeta() {
    var almacen = this;
    var handle = almacen.handles[CONST.ARCHIVO_MAESTRO];
    if (!handle) return Promise.reject(new Error('No hay maestro cargado para respaldar'));
    return leerTexto(handle).then(function (lectura) {
      var nombre = N.nombreCopiaCierre(new Date());
      return descargar(nombre, lectura.texto).then(function () {
        return { nombre: nombre, tamano: lectura.texto.length };
      });
    });
  }

  // ------------------------------------------------------------------
  // Modo descarga (RNF-03, CU-22): se exige sesion valida antes de usarlo
  // ------------------------------------------------------------------
  function descargar(nombre, texto) {
    var blob = new Blob([texto], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return Promise.resolve(true);
  }

  raiz.GGTO_ALMACEN = {
    NOMBRES: NOMBRES,
    NOMBRES_JSON: NOMBRES_JSON,
    soportado: soportado,
    abrirCarpeta: abrirCarpeta,
    abrirArchivos: abrirArchivos,
    detectarConflicto: detectarConflicto,
    descargar: descargar,
    errorDe: errorDe
  };
})(typeof window !== 'undefined' ? window : globalThis);
