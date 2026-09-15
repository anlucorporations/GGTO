/*
 * GGTO-v1 - almacen.js
 * Persistencia con File System Access API sobre C:\GGTO\datos (D-01, D-19):
 *  - lectura de los 10 archivos de trabajo (9 JSON + historial.jsonl);
 *  - escritura verificada: .bak previo (10 ultimas), archivo temporal,
 *    relectura comparada y confirmacion (D-42, RNF-15);
 *  - deteccion de conflicto por marca de modificacion (D-41, RNF-14);
 *  - historial inmutable append-only (D-56, RNF-09);
 *  - copia de cierre de la jornada en C:\GGTO\respaldo verificada por
 *    relectura, y restauracion del maestro desde una copia fechada
 *    (C7: CU-21, D-49, RNF-16);
 *  - ruta controlada de las salidas C:\GGTO\despachos para los PDF del
 *    despacho, con relectura verificada (C4: CU-17, D-27, D-67);
 *  - CSV de ingesta de la carpeta de datos: listarlos (nombre, tamano y fecha) y
 *    leer el elegido, sin pasar por el selector del navegador (D-78, D-79);
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

  /**
   * Pide autorizacion de la carpeta de respaldo `C:\GGTO\respaldo` (D-49).
   * Es una autorizacion aparte de la de datos: el navegador exige conceder
   * cada carpeta por separado y la pagina no puede escribir fuera de la
   * carpeta autorizada.
   */
  function abrirCarpetaRespaldo() {
    if (!soportado()) return Promise.reject(new Error('File System Access API no disponible'));
    return raiz.showDirectoryPicker({ id: 'ggto-respaldo', mode: 'readwrite' });
  }

  /**
   * Pide autorizacion de la ruta controlada de las salidas
   * `C:\GGTO\despachos`, donde se guardan los PDF del despacho (D-27, D-67).
   */
  function abrirCarpetaDespachos() {
    if (!soportado()) return Promise.reject(new Error('File System Access API no disponible'));
    return raiz.showDirectoryPicker({ id: 'ggto-despachos', mode: 'readwrite' });
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
      carpetaRespaldo: null,
      carpetaDespachos: null,
      handles: {},
      estado: {},
      datos: {},
      historialTexto: '',
      cargar: cargarCarpeta,
      guardarArchivo: guardarCarpeta,
      agregarHistorial: agregarHistorialCarpeta,
      crearEstructura: crearEstructuraCarpeta,
      autorizarRespaldo: autorizarRespaldoCarpeta,
      guardarCopiaCierre: guardarCopiaCierreCarpeta,
      estadoRespaldo: estadoRespaldoCarpeta,
      listarCopiasRespaldo: listarCopiasRespaldoCarpeta,
      leerCopiaRespaldo: leerCopiaRespaldoCarpeta,
      restaurarCopia: restaurarCopiaCarpeta,
      autorizarDespachos: autorizarDespachosCarpeta,
      guardarSalida: guardarSalidaCarpeta,
      listarSalidas: listarSalidasCarpeta,
      listarCSV: listarCSVCarpeta,
      leerTextoDeDatos: leerTextoDeDatos,
      leerIncidencias: leerIncidenciasCarpeta,
      describir: function () { return CONST.RUTA_DATOS + ' (carpeta autorizada)'; }
    };
  }

  function crearAlmacenPorArchivos(manejadores) {
    var almacen = {
      tipo: 'archivos',
      carpeta: null,
      carpetaRespaldo: null,
      carpetaDespachos: null,
      handles: manejadores,
      estado: {},
      datos: {},
      historialTexto: '',
      cargar: cargarArchivos,
      guardarArchivo: guardarArchivoSuelto,
      agregarHistorial: agregarHistorialArchivo,
      crearEstructura: crearEstructuraArchivos,
      autorizarRespaldo: autorizarRespaldoCarpeta,
      // La copia de cierre solo necesita leer los archivos de origen (ya
      // autorizados uno a uno) y la carpeta de respaldo: funciona igual.
      guardarCopiaCierre: guardarCopiaCierreCarpeta,
      estadoRespaldo: estadoRespaldoCarpeta,
      listarCopiasRespaldo: listarCopiasRespaldoCarpeta,
      leerCopiaRespaldo: leerCopiaRespaldoCarpeta,
      restaurarCopia: restaurarCopiaCarpeta,
      // La ruta controlada de los PDF es una carpeta propia, independiente de
      // cómo se haya autorizado la carpeta de datos (D-27, D-67).
      autorizarDespachos: autorizarDespachosCarpeta,
      guardarSalida: guardarSalidaCarpeta,
      listarSalidas: listarSalidasCarpeta,
      // Los archivos se autorizaron uno a uno: no hay carpeta que listar.
      listarCSV: listarCSVCarpeta,
      leerTextoDeDatos: leerTextoDeDatos,
      leerIncidencias: leerIncidenciasCarpeta,
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
  // Log de accesos: rotacion 5 MB x 5 archivos (D-58, D-64)
  // ------------------------------------------------------------------
  /** Lista los nombres de archivo presentes en la carpeta autorizada. */
  function nombresDeCarpeta(carpeta) {
    if (!carpeta || typeof carpeta.keys !== 'function') return Promise.resolve([]);
    var nombres = [];
    var iterador = carpeta.keys();
    function paso() {
      return iterador.next().then(function (r) {
        if (r.done) return nombres;
        nombres.push(r.value);
        return paso();
      });
    }
    return paso().catch(function () { return nombres; });
  }

  function tamanoDe(carpeta, nombre) {
    return carpeta.getFileHandle(nombre).then(function (h) {
      return h.getFile();
    }).then(function (archivo) {
      return archivo.size === undefined || archivo.size === null
        ? archivo.text().then(function (t) { return t.length; })
        : archivo.size;
    }).catch(function () { return 0; });
  }

  /** Tamano y fecha de modificacion de un archivo de una carpeta autorizada. */
  function datosDeArchivo(carpeta, nombre) {
    return carpeta.getFileHandle(nombre).then(function (h) {
      return h.getFile();
    }).then(function (archivo) {
      var tamano = (archivo.size === undefined || archivo.size === null)
        ? archivo.text().then(function (t) { return t.length; })
        : Promise.resolve(archivo.size);
      return tamano.then(function (t) {
        return {
          tamano: t,
          modificado: archivo.lastModified === undefined ? null : archivo.lastModified
        };
      });
    }).catch(function () { return { tamano: 0, modificado: null }; });
  }

  // ------------------------------------------------------------------
  // CSV de ingesta de la carpeta de datos (D-78, D-79)
  // ------------------------------------------------------------------
  /** Un archivo de ingesta es cualquier `*.csv` de la carpeta de datos. */
  function esCSVDeIngesta(nombre) {
    return /\.csv$/i.test(String(nombre || ''));
  }

  /**
   * Los `*.csv` presentes en la carpeta de datos autorizada (D-78), con su tamano
   * y su fecha, del mas reciente al mas antiguo. **Solo mira nombre, tamano y
   * fecha: no abre ni interpreta el contenido.** Devuelve [] si la carpeta no
   * esta autorizada (modo por archivos o modo descarga).
   */
  function listarCSVCarpeta() {
    var almacen = this;
    if (!almacen.carpeta) return Promise.resolve([]);
    return nombresDeCarpeta(almacen.carpeta).then(function (nombres) {
      var lista = [];
      var cadena = Promise.resolve();
      nombres.filter(esCSVDeIngesta).forEach(function (nombre) {
        cadena = cadena.then(function () {
          return datosDeArchivo(almacen.carpeta, nombre).then(function (d) {
            lista.push({ nombre: nombre, tamano: d.tamano, modificado: d.modificado, ruta: CONST.RUTA_DATOS });
          });
        });
      });
      return cadena.then(function () {
        lista.sort(function (a, b) {
          if (a.modificado !== b.modificado) return (b.modificado || 0) - (a.modificado || 0);
          return a.nombre < b.nombre ? 1 : -1;
        });
        return lista;
      });
    }).catch(function () { return []; });
  }

  /**
   * Lee el texto de un archivo de la carpeta de datos autorizada: es la via por la
   * que la INGESTA toma el CSV elegido de la lista, sin pasar por el selector del
   * navegador (D-79). Rechaza con `tipo = 'sinCarpeta'` si no hay carpeta.
   */
  function leerTextoDeDatos(nombre) {
    var almacen = this;
    if (!almacen.carpeta) {
      var e = new Error('La carpeta de datos ' + CONST.RUTA_DATOS + ' no está autorizada');
      e.tipo = 'sinCarpeta';
      return Promise.reject(e);
    }
    return leerDeCarpeta(almacen.carpeta, nombre).then(function (lectura) { return lectura.texto; });
  }

  /**
   * Aplica la rotacion del log de accesos si el archivo vigente supera el
   * limite (5 MB por defecto, D-58/D-64): `incidencias.log` pasa a
   * `incidencias.1.log` y la cascada desplaza hasta `incidencias.5.log`,
   * descartando el mas antiguo. Devuelve el plan aplicado.
   */
  function rotarLogIncidencias(almacen, opciones) {
    var opts = opciones || {};
    var carpeta = almacen.carpeta;
    if (!carpeta || typeof carpeta.removeEntry !== 'function') {
      return Promise.resolve({ rota: false, motivo: 'sin carpeta autorizada' });
    }
    return nombresDeCarpeta(carpeta).then(function (nombres) {
      return tamanoDe(carpeta, CONST.ARCHIVO_INCIDENCIAS).then(function (tamano) {
        var plan = N.planRotacionLog(CONST.ARCHIVO_INCIDENCIAS, {
          tamano: tamano, maximo: opts.maximo, nombres: nombres
        });
        plan.motivo = plan.rota ? 'límite superado' : 'dentro del límite';
        if (!plan.rota) return plan;
        var cadena = Promise.resolve();
        plan.descartados.forEach(function (nombre) {
          cadena = cadena.then(function () {
            return carpeta.removeEntry(nombre).catch(function () { return null; });
          });
        });
        plan.pasos.forEach(function (paso) {
          cadena = cadena.then(function () {
            return carpeta.removeEntry(paso.hasta).catch(function () { return null; }).then(function () {
              return carpeta.getFileHandle(paso.desde).then(function (h) {
                return h.getFile();
              }).then(function (archivo) {
                return archivo.text();
              }).then(function (texto) {
                return carpeta.getFileHandle(paso.hasta, { create: true }).then(function (destino) {
                  return destino.createWritable().then(function (w) {
                    return w.write(texto).then(function () { return w.close(); });
                  });
                });
              }).then(function () {
                return carpeta.removeEntry(paso.desde).catch(function () { return null; });
              });
            });
          });
        });
        return cadena.then(function () { return plan; });
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

  // ------------------------------------------------------------------
  // Copia de cierre y restauracion (C7: CU-21, RF-24, D-42, D-49, D-56)
  // ------------------------------------------------------------------
  /** Escribe `texto` en `nombre` dentro de la carpeta de respaldo. */
  function escribirEnCarpeta(carpeta, nombre, texto) {
    return carpeta.getFileHandle(nombre, { create: true }).then(function (h) {
      return h.createWritable().then(function (w) {
        return w.write(texto).then(function () { return w.close(); });
      });
    });
  }

  /** Lee el archivo `nombre` de la carpeta de respaldo. */
  function leerDeCarpeta(carpeta, nombre) {
    return carpeta.getFileHandle(nombre).then(function (h) { return leerTexto(h); });
  }

  /** Líneas con contenido: comprueba que el historial no se recorta (D-56). */
  function lineasConContenido(texto) {
    return String(texto || '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; }).length;
  }

  /** Autoriza la carpeta de respaldo `C:\GGTO\respaldo` en esta sesión (D-49). */
  function autorizarRespaldoCarpeta(dir) {
    if (!dir) return Promise.reject(new Error('No se recibió la carpeta de respaldo'));
    this.carpetaRespaldo = dir;
    return Promise.resolve({ autorizada: true, ruta: CONST.RUTA_RESPALDO });
  }

  /**
   * Copia de cierre de la jornada (CU-21 pasos 3 y 4; D-49, D-56, RNF-16):
   * copia los 9 JSON de trabajo y `historial.jsonl` a `C:\GGTO\respaldo`, con
   * el maestro fechado con hora (`averias_AAAA-MM-DD_HHMM.json`) para que dos
   * respaldos del mismo día no colisionen, y verifica cada copia **releyéndola
   * y comparando el contenido** con el original. El historial se copia íntegro,
   * sin truncar ni filtrar. Devuelve el resumen con verificados y fallos.
   */
  function guardarCopiaCierreCarpeta() {
    var almacen = this;
    if (!almacen.carpetaRespaldo) {
      var e = new Error('No está autorizada la carpeta de respaldo ' + CONST.RUTA_RESPALDO);
      e.tipo = 'sinRespaldo';
      return Promise.reject(e);
    }
    var ahora = new Date();
    var nombreMaestro = N.nombreCopiaCierre(ahora);
    var archivos = [];
    var fallos = [];
    var cadena = Promise.resolve();
    NOMBRES.forEach(function (nombre) {
      cadena = cadena.then(function () {
        var destino = nombre === CONST.ARCHIVO_MAESTRO ? nombreMaestro : nombre;
        var origen = almacen.handles[nombre];
        if (!origen) {
          fallos.push({ archivo: destino, motivo: 'el archivo de origen no está disponible' });
          return null;
        }
        return leerTexto(origen).then(function (lectura) {
          return escribirEnCarpeta(almacen.carpetaRespaldo, destino, lectura.texto).then(function () {
            return leerDeCarpeta(almacen.carpetaRespaldo, destino);
          }).then(function (copia) {
            if (copia.texto !== lectura.texto) {
              fallos.push({ archivo: destino, motivo: 'la copia releída no coincide con el original' });
              return null;
            }
            if (nombre === CONST.ARCHIVO_HISTORIAL &&
                lineasConContenido(copia.texto) !== lineasConContenido(lectura.texto)) {
              fallos.push({ archivo: destino, motivo: 'el historial copiado no conserva todas sus líneas' });
              return null;
            }
            archivos.push({ archivo: destino, tamano: lectura.texto.length });
            return null;
          });
        }).catch(function (err) {
          fallos.push({ archivo: destino, motivo: errorDe(err) });
          return null;
        });
      });
    });
    return cadena.then(function () {
      var marca = N.marcaAhora(ahora);
      return {
        marca: marca,
        fecha: String(marca).split(' ')[0],
        hora: String(marca).split(' ')[1] || '',
        nombreMaestro: nombreMaestro,
        ruta: CONST.RUTA_RESPALDO,
        archivos: archivos,
        verificados: archivos.length,
        total: NOMBRES.length,
        fallos: fallos,
        cifrado: false
      };
    });
  }

  /** Copias de cierre de la carpeta de respaldo, de la más nueva a la más antigua. */
  function listarCopiasRespaldoCarpeta() {
    var almacen = this;
    if (!almacen.carpetaRespaldo) return Promise.resolve([]);
    return nombresDeCarpeta(almacen.carpetaRespaldo).then(function (nombres) {
      var copias = nombres.filter(N.esCopiaCierre).sort().reverse();
      var lista = [];
      var cadena = Promise.resolve();
      copias.forEach(function (nombre) {
        cadena = cadena.then(function () {
          return tamanoDe(almacen.carpetaRespaldo, nombre).then(function (tamano) {
            lista.push({ nombre: nombre, marca: N.marcaDeCopia(nombre), tamano: tamano, ruta: CONST.RUTA_RESPALDO });
          });
        });
      });
      return cadena.then(function () { return lista; });
    });
  }

  /** Estado del respaldo (CU-21 paso 1 y CA-6): última copia, listado y ruta. */
  function estadoRespaldoCarpeta() {
    var almacen = this;
    return listarCopiasRespaldoCarpeta.call(almacen).then(function (copias) {
      return {
        autorizada: !!almacen.carpetaRespaldo,
        ruta: CONST.RUTA_RESPALDO,
        hay: copias.length > 0,
        copias: copias,
        ultima: copias.length ? copias[0] : null,
        total: copias.length
      };
    });
  }

  /** Lee y valida una copia de cierre de la carpeta de respaldo (CU-21, flujo 6a). */
  function leerCopiaRespaldoCarpeta(nombre) {
    var almacen = this;
    if (!almacen.carpetaRespaldo) {
      var e = new Error('No está autorizada la carpeta de respaldo ' + CONST.RUTA_RESPALDO);
      e.tipo = 'sinRespaldo';
      return Promise.reject(e);
    }
    return leerDeCarpeta(almacen.carpetaRespaldo, nombre).then(function (lectura) {
      var casos = null;
      try {
        casos = JSON.parse(lectura.texto);
      } catch (err) {
        casos = null;
      }
      if (!Array.isArray(casos)) {
        var invalido = new Error('Respaldo inválido: ' + nombre);
        invalido.tipo = 'copiaInvalida';
        throw invalido;
      }
      return {
        nombre: nombre, marca: N.marcaDeCopia(nombre), casos: casos,
        texto: lectura.texto, tamano: lectura.texto.length
      };
    });
  }

  /**
   * Restaura el maestro desde una copia de cierre (CU-21 pasos 5 a 7): valida la
   * copia y escribe el maestro con el protocolo de D-42 —respaldo previo `.bak`,
   * escritura, relectura comparada y restauración automática ante fallo—, con la
   * detección de conflicto de D-41. Devuelve las horas de inicio y fin para poder
   * comprobar el RTO de 1 hora (D-49, RNF-16).
   */
  function restaurarCopiaCarpeta(nombre, opciones) {
    var almacen = this;
    var inicio = new Date();
    return leerCopiaRespaldoCarpeta.call(almacen, nombre).then(function (copia) {
      return almacen.guardarArchivo(CONST.ARCHIVO_MAESTRO, copia.casos, opciones || {}).then(function () {
        var fin = new Date();
        var ms = fin.getTime() - inicio.getTime();
        return {
          copia: nombre,
          marcaCopia: copia.marca,
          casos: copia.casos.length,
          inicio: N.marcaAhora(inicio),
          fin: N.marcaAhora(fin),
          duracionMs: ms,
          rtoCumplido: ms <= 3600000
        };
      });
    });
  }

  // ------------------------------------------------------------------
  // Log de la aplicacion: lectura para el diagnostico (CU-22, paso 4)
  // ------------------------------------------------------------------
  /** Devuelve el texto del log `datos/incidencias.log` (vacio si no existe). */
  function leerIncidenciasCarpeta() {
    var almacen = this;
    function leer(handle) {
      return leerTexto(handle).then(function (l) { return l.texto; }).catch(function () { return ''; });
    }
    if (almacen.handles[CONST.ARCHIVO_INCIDENCIAS]) {
      return leer(almacen.handles[CONST.ARCHIVO_INCIDENCIAS]);
    }
    if (!almacen.carpeta || typeof almacen.carpeta.getFileHandle !== 'function') return Promise.resolve('');
    return almacen.carpeta.getFileHandle(CONST.ARCHIVO_INCIDENCIAS).then(function (h) {
      almacen.handles[CONST.ARCHIVO_INCIDENCIAS] = h;
      return leer(h);
    }).catch(function () { return ''; });
  }

  // ------------------------------------------------------------------
  // Ruta controlada de las salidas: PDF de despacho (CU-17, D-27, D-67)
  // ------------------------------------------------------------------
  /** Convierte lo que se va a escribir en bytes. */
  function bytesDe(datos) {
    if (datos instanceof Uint8Array) return datos;
    if (typeof ArrayBuffer !== 'undefined' && datos instanceof ArrayBuffer) return new Uint8Array(datos);
    if (datos && datos.buffer && typeof datos.byteLength === 'number') return new Uint8Array(datos.buffer);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(datos));
    var texto = String(datos);
    var bytes = new Uint8Array(texto.length);
    for (var i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i) & 0xff;
    return bytes;
  }

  /** Suma de control FNV-1a de 32 bits: verifica el contenido leído byte a byte. */
  function sumaControl(datos) {
    var bytes = bytesDe(datos);
    var h = 2166136261;
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /** Autoriza la ruta controlada `C:\GGTO\despachos` en esta sesión (D-67). */
  function autorizarDespachosCarpeta(dir) {
    if (!dir) return Promise.reject(new Error('No se recibió la carpeta de despachos'));
    this.carpetaDespachos = dir;
    return Promise.resolve({ autorizada: true, ruta: CONST.RUTA_DESPACHOS });
  }

  /**
   * Guarda una salida (el PDF del despacho) en la **ruta controlada**
   * `C:\GGTO\despachos` —nunca en la carpeta de Descargas— (CU-17, D-27, D-67)
   * y la **relee para verificar** que el contenido escrito coincide: mismo
   * tamaño y misma suma de control.
   */
  function guardarSalidaCarpeta(nombre, datos) {
    var almacen = this;
    if (!almacen.carpetaDespachos) {
      var e = new Error('No está autorizada la ruta controlada ' + CONST.RUTA_DESPACHOS);
      e.tipo = 'sinDespachos';
      return Promise.reject(e);
    }
    var bytes = bytesDe(datos);
    var control = sumaControl(bytes);
    return escribirEnCarpeta(almacen.carpetaDespachos, nombre, bytes).then(function () {
      return almacen.carpetaDespachos.getFileHandle(nombre);
    }).then(function (h) {
      return h.getFile();
    }).then(function (archivo) {
      var tamano = typeof archivo.size === 'number' ? archivo.size : null;
      if (typeof archivo.arrayBuffer !== 'function') {
        return { nombre: nombre, bytes: bytes.length, tamano: tamano, control: control, verificado: null, ruta: CONST.RUTA_DESPACHOS };
      }
      return archivo.arrayBuffer().then(function (buf) {
        var leidos = new Uint8Array(buf);
        var coincide = leidos.length === bytes.length && sumaControl(leidos) === control;
        if (!coincide) {
          var err = new Error('La relectura de ' + nombre + ' no coincide con lo escrito');
          err.tipo = 'verificacion';
          throw err;
        }
        return { nombre: nombre, bytes: bytes.length, tamano: tamano, control: control, verificado: true, ruta: CONST.RUTA_DESPACHOS };
      });
    });
  }

  /** Salidas de la ruta controlada presentes en disco (CU-17, paso 5). */
  function listarSalidasCarpeta() {
    var almacen = this;
    if (!almacen.carpetaDespachos) return Promise.resolve([]);
    return nombresDeCarpeta(almacen.carpetaDespachos).then(function (nombres) {
      var salidas = nombres.filter(N.esSalidaDespacho).sort();
      var lista = [];
      var cadena = Promise.resolve();
      salidas.forEach(function (nombre) {
        cadena = cadena.then(function () {
          return tamanoDe(almacen.carpetaDespachos, nombre).then(function (tamano) {
            lista.push({ nombre: nombre, tamano: tamano, ruta: CONST.RUTA_DESPACHOS });
          });
        });
      });
      return cadena.then(function () { return lista; });
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
    abrirCarpetaRespaldo: abrirCarpetaRespaldo,
    abrirCarpetaDespachos: abrirCarpetaDespachos,
    detectarConflicto: detectarConflicto,
    rotarLogIncidencias: rotarLogIncidencias,
    descargar: descargar,
    errorDe: errorDe,
    // Punto de entrada para las pruebas de Node.js: permite inyectar una
    // carpeta simulada con la misma forma que FileSystemDirectoryHandle.
    crearAlmacen: crearAlmacen
  };
})(typeof window !== 'undefined' ? window : globalThis);
