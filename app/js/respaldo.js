/*
 * GGTO-v1 - respaldo.js  (ciclo C7)
 * Bloque RESPALDO de CONFIGURACION: copia de cierre y restauracion (CU-21, RF-24;
 * RNF-15, RNF-16; D-36, D-41, D-42, D-49, D-56).
 *
 *   - Copia de cierre: copia los 9 JSON de trabajo y `historial.jsonl` a
 *     `C:\GGTO\respaldo\`, con el maestro fechado con hora
 *     (`averias_AAAA-MM-DD_HHMM.json`) para que dos respaldos del mismo dia no
 *     colisionen, y verifica cada copia releyendola y comparando el contenido.
 *     Objetivo: RTO de 1 hora y RPO del cierre del dia anterior (D-49).
 *   - Restauracion: el supervisor elige una copia, el sistema la valida y
 *     muestra el impacto antes de confirmar; al confirmar escribe el maestro con
 *     el protocolo verificado de D-42 (respaldo previo `.bak`) y registra la hora
 *     de inicio y de fin para poder comprobar el RTO.
 *
 * Solo el rol supervisor puede ver y ejecutar este bloque (D-35, RNF-12).
 * Depende de GGTO_NUCLEO y GGTO_ALMACEN (carga previa por <script>).
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var A = raiz.GGTO_ALMACEN;
  var CONST = N.CONST;

  /** Palabra que el supervisor debe escribir para confirmar una restauracion destructiva. */
  var PALABRA_CONFIRMACION = 'RESTAURAR';

  // ------------------------------------------------------------------ puros

  /** Valida el contenido de una copia de cierre (CU-21, flujo 6a). */
  function validarCopia(texto) {
    var errores = [];
    var casos = null;
    try {
      casos = JSON.parse(String(texto || ''));
    } catch (e) {
      errores.push('El archivo no es un JSON válido.');
    }
    if (casos !== null && !Array.isArray(casos)) {
      errores.push('La copia debe contener una lista de casos.');
      casos = null;
    }
    if (Array.isArray(casos)) {
      var sinId = 0;
      var vistos = {};
      var repetidos = 0;
      casos.forEach(function (c) {
        var id = String((c || {}).id_averia || '');
        if (id === '') sinId++;
        else if (vistos[id]) repetidos++;
        else vistos[id] = true;
      });
      if (sinId > 0) errores.push(sinId + ' caso(s) sin id_averia.');
      if (repetidos > 0) errores.push(repetidos + ' id_averia repetido(s).');
      if (casos.length === 0) errores.push('La copia está vacía (0 casos).');
    }
    return {
      valida: errores.length === 0,
      errores: errores,
      casos: casos || [],
      total: (casos || []).length
    };
  }

  /** Impacto de restaurar una copia sobre el maestro actual. */
  function resumenRestauracion(copia, maestro) {
    var actual = {};
    (maestro || []).forEach(function (c) { actual[String((c || {}).id_averia || '')] = c; });
    var r = {
      enCopia: (copia || []).length, enMaestro: (maestro || []).length,
      nuevos: 0, distintos: 0, iguales: 0, soloEnMaestro: 0, ejemplos: []
    };
    var vistos = {};
    (copia || []).forEach(function (c) {
      var id = String((c || {}).id_averia || '');
      vistos[id] = true;
      if (!actual[id]) {
        r.nuevos++;
        if (r.ejemplos.length < 5) r.ejemplos.push({ id: id, efecto: 'se recuperaría (ya no está en el maestro)' });
        return;
      }
      if (JSON.stringify(actual[id]) === JSON.stringify(c)) r.iguales++;
      else {
        r.distintos++;
        if (r.ejemplos.length < 5) r.ejemplos.push({ id: id, efecto: 'volvería al estado de la copia' });
      }
    });
    (maestro || []).forEach(function (c) {
      var id = String((c || {}).id_averia || '');
      if (!vistos[id]) r.soloEnMaestro++;
    });
    // La copia pierde informacion respecto del maestro: exige confirmacion escrita (CU-21, 6b).
    r.pierdeCasos = r.enCopia < r.enMaestro;
    r.requiereConfirmacionEscrita = r.pierdeCasos || r.soloEnMaestro > 0;
    return r;
  }

  // -------------------------------------------------------------------- UI

  function render(contenedor, ctx) {
    ctx.limpiar(contenedor);
    if (!ctx.sesion) {
      contenedor.appendChild(ctx.texto('p', 'Identifíquese para respaldar o restaurar.', 'aviso aviso-alerta'));
      return;
    }
    var permiso = N.autorizar(ctx.ambito, 'respaldo.ejecutar');
    if (!permiso.permitido) {
      // Flujo 2a: el operador no ve el bloque ni puede ejecutarlo (D-35, RNF-12).
      ctx.registrarLog('respaldo | DENEGADO | p00=' + (ctx.sesion.P00 || ''));
      contenedor.appendChild(ctx.texto('p', CONST.MSG.ROL +
        ': el respaldo y la restauración son exclusivos del supervisor (D-35, RNF-12).', 'aviso aviso-error'));
      return;
    }

    var descarga = ctx.modoDescarga();
    var resumenEstado = null;
    var copiaEnFoco = null;

    var seccion = ctx.texto('section', null, 'respaldo');
    seccion.appendChild(ctx.texto('h2', 'RESPALDO y restauración'));
    var zonaEstado = ctx.texto('div', null, 'estado-respaldo');
    var zonaCopia = ctx.texto('div', null, 'zona-copia');
    var zonaRestauracion = ctx.texto('div', null, 'zona-restauracion');
    seccion.appendChild(zonaEstado);
    seccion.appendChild(zonaCopia);
    seccion.appendChild(zonaRestauracion);
    contenedor.appendChild(seccion);

    function casos() { return ctx.almacen.datos[CONST.ARCHIVO_MAESTRO] || []; }

    function refrescar() {
      leerEstado().then(function (e) {
        resumenEstado = e;
        pintarEstado();
        pintarCopia();
        pintarRestauracion();
      });
    }

    // ---- estado del respaldo (paso 1, CA-6 y flujo 1a) -------------------
    function leerEstado() {
      if (descarga || typeof ctx.almacen.estadoRespaldo !== 'function') {
        return Promise.resolve({ autorizada: false, hay: false, copias: [], total: 0, ruta: CONST.RUTA_RESPALDO, noDisponible: true });
      }
      return ctx.almacen.estadoRespaldo().catch(function (e) {
        ctx.avisar('No se pudo consultar la carpeta de respaldo: ' + A.errorDe(e), 'aviso-error', { temporal: false });
        return { autorizada: !!ctx.almacen.carpetaRespaldo, hay: false, copias: [], total: 0, ruta: CONST.RUTA_RESPALDO };
      });
    }

    function pintarEstado() {
      ctx.limpiar(zonaEstado);
      zonaEstado.appendChild(ctx.texto('p',
        'Casos en el maestro: ' + casos().length + ' · Destino: ' + CONST.RUTA_RESPALDO +
        ' · Copia de cierre de hoy: ' + N.nombreCopiaCierre(new Date()) +
        ' · Objetivo: recuperar en 1 hora (RTO) con los datos del cierre del día anterior (RPO).',
        'resumen-linea'));
      if (resumenEstado && resumenEstado.noDisponible) {
        zonaEstado.appendChild(ctx.texto('p',
          'Modo descarga: este navegador no puede escribir en ' + CONST.RUTA_RESPALDO +
          '. La copia se descarga y usted la guarda en esa carpeta (D-49).', 'aviso aviso-alerta'));
        return;
      }
      if (!resumenEstado || !resumenEstado.hay) {
        zonaEstado.appendChild(ctx.texto('p',
          'Sin respaldos registrados. El RPO no está cubierto hasta que exista la primera copia de cierre (D-49).',
          'aviso aviso-alerta'));
        return;
      }
      zonaEstado.appendChild(ctx.texto('p',
        'Último respaldo: ' + resumenEstado.ultima.marca + ' · ' + resumenEstado.ultima.nombre +
        ' (' + resumenEstado.ultima.tamano + ' caracteres) · ' + resumenEstado.total +
        ' copia(s) en ' + resumenEstado.ruta, 'aviso aviso-ok'));
      var t = ctx.texto('table', null, 'tabla');
      var tb = ctx.texto('tbody');
      resumenEstado.copias.forEach(function (c) {
        var tr = ctx.texto('tr');
        tr.appendChild(ctx.texto('th', c.nombre));
        tr.appendChild(ctx.texto('td', c.marca + ' · ' + c.tamano + ' caracteres'));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      zonaEstado.appendChild(t);
    }

    // ---- copia de cierre (pasos 2 a 4; flujos 3a y 4a) -------------------
    function pintarCopia() {
      ctx.limpiar(zonaCopia);
      var bloque = ctx.texto('div', null, 'bloque');
      bloque.appendChild(ctx.texto('h3', '1. Copiar los archivos al cierre de la jornada'));

      if (!descarga && resumenEstado && !resumenEstado.autorizada) {
        bloque.appendChild(ctx.texto('p',
          'Autorice la carpeta ' + CONST.RUTA_RESPALDO + ' para que la página pueda escribir y ' +
          'verificar la copia (el navegador concede cada carpeta por separado).', 'aviso aviso-alerta'));
        bloque.appendChild(ctx.boton('Autorizar carpeta ' + CONST.RUTA_RESPALDO, null, function () {
          A.abrirCarpetaRespaldo().then(function (dir) {
            return ctx.almacen.autorizarRespaldo(dir);
          }).then(function () {
            ctx.avisar('Carpeta de respaldo autorizada: ' + CONST.RUTA_RESPALDO, 'aviso-info');
            refrescar();
          }).catch(function (e) {
            if (e && e.name === 'AbortError') return;
            ctx.avisar('No se pudo autorizar la carpeta de respaldo: ' + A.errorDe(e), 'aviso-error', { temporal: false });
          });
        }));
      }

      bloque.appendChild(ctx.texto('p',
        'La copia incluye los 9 JSON de trabajo y el historial historial.jsonl, que se copia íntegro ' +
        'y no se recorta (D-56). No se cifra (D-49).', 'resumen-linea'));

      var salida = ctx.texto('div', null, 'salida-copia');
      bloque.appendChild(salida);
      bloque.appendChild(ctx.boton('Respaldar ahora', 'boton-primario', function () {
        ctx.limpiar(salida);
        if (typeof ctx.almacen.guardarCopiaCierre !== 'function') {
          ctx.avisar('Este navegador no permite crear la copia de cierre.', 'aviso-error', { temporal: false });
          return;
        }
        ctx.almacen.guardarCopiaCierre().then(function (res) {
          ctx.registrarLog('respaldo | COPIA DE CIERRE | ' + res.marca + ' | archivos=' +
            res.verificados + '/' + res.total + ' | p00=' + ctx.sesion.P00);
          if (res.fallos && res.fallos.length) {
            // Flujo 3a/4a: la copia no se marca como exitosa.
            var caja = ctx.texto('div', null, 'aviso aviso-error');
            caja.appendChild(ctx.texto('p', 'El respaldo no se completó: ' +
              res.verificados + ' de ' + res.total + ' archivos verificados.'));
            var ul = ctx.texto('ul');
            res.fallos.forEach(function (f) { ul.appendChild(ctx.texto('li', f.archivo + ': ' + f.motivo)); });
            caja.appendChild(ul);
            caja.appendChild(ctx.texto('p', 'Vuelva a intentarlo. El respaldo no se registra como exitoso.'));
            salida.appendChild(caja);
            return;
          }
          salida.appendChild(ctx.texto('p', 'Respaldo verificado: ' + res.verificados + ' archivos · ' +
            res.nombreMaestro + ' · ' + res.marca + ' · sin cifrado.', 'aviso aviso-ok'));
        }).catch(function (e) {
          if (e && e.tipo === 'sinRespaldo' && !ctx.modoDescarga()) {
            // Sin carpeta autorizada se degrada a descarga, nunca se pierde la copia.
            ctx.descargarArchivo(N.nombreCopiaCierre(new Date()), casos()).then(function () {
              ctx.avisar('Modo descarga: se descargó la copia de cierre. Guárdela en ' +
                CONST.RUTA_RESPALDO + ' (D-49).', 'aviso-alerta', { temporal: false });
            });
            return;
          }
          ctx.registrarLog('respaldo | FALLO | ' + A.errorDe(e) + ' | p00=' + ctx.sesion.P00);
          ctx.avisar('No se pudo crear la copia: ' + A.errorDe(e) +
            ' (registrado en el log con fecha y hora).', 'aviso-error', { temporal: false });
        });
      }));
      zonaCopia.appendChild(bloque);
    }

    // ---- restauracion (pasos 5 a 7; flujos 6a, 6b y 8b) ------------------
    function pintarRestauracion() {
      ctx.limpiar(zonaRestauracion);
      var bloque = ctx.texto('div', null, 'bloque');
      bloque.appendChild(ctx.texto('h3', '2. Restaurar el maestro desde una copia'));
      bloque.appendChild(ctx.texto('p',
        'Al confirmar, el maestro se reemplaza por la copia y el sistema respalda antes el estado actual ' +
        'con el protocolo verificado (D-42). Se registran la hora de inicio y de fin para comprobar el RTO (D-49).',
        'resumen-linea'));

      var salida = ctx.texto('div', null, 'salida-restauracion');

      if (!descarga && resumenEstado && resumenEstado.autorizada && resumenEstado.hay) {
        var lab = document.createElement('label');
        lab.setAttribute('for', 'copia-cierre');
        lab.textContent = 'Elija la copia de ' + CONST.RUTA_RESPALDO;
        var sel = document.createElement('select');
        sel.id = 'copia-cierre';
        resumenEstado.copias.forEach(function (c) {
          var o = document.createElement('option');
          o.value = c.nombre;
          o.textContent = c.nombre + ' (' + c.marca + ', ' + c.tamano + ' caracteres)';
          sel.appendChild(o);
        });
        bloque.appendChild(lab);
        bloque.appendChild(sel);
        bloque.appendChild(ctx.boton('Revisar la copia elegida', null, function () {
          analizarCopiaDesdeCarpeta(sel.value, salida);
        }));
      } else {
        var lab2 = document.createElement('label');
        lab2.setAttribute('for', 'archivo-copia');
        lab2.textContent = 'Elija el archivo de copia (por ejemplo ' + N.nombreCopiaCierre(new Date()) + ')';
        var entrada = document.createElement('input');
        entrada.type = 'file';
        entrada.id = 'archivo-copia';
        entrada.accept = '.json,application/json';
        bloque.appendChild(lab2);
        bloque.appendChild(entrada);
        entrada.addEventListener('change', function () {
          var archivo = entrada.files && entrada.files[0];
          if (!archivo) return;
          var leer = typeof archivo.text === 'function' ? archivo.text() : Promise.reject(new Error('lectura no disponible'));
          leer.then(function (texto) {
            var v = validarCopia(texto);
            if (!v.valida) {
              mostrarCopiaInvalida(salida, v.errores);
              return;
            }
            copiaEnFoco = { nombre: archivo.name, casos: v.casos };
            mostrarImpacto(salida, archivo.name, v.casos);
          }).catch(function (e) {
            ctx.avisar('No se pudo leer la copia: ' + A.errorDe(e), 'aviso-error', { temporal: false });
          });
        });
      }

      bloque.appendChild(salida);
      zonaRestauracion.appendChild(bloque);
    }

    function analizarCopiaDesdeCarpeta(nombre, salida) {
      ctx.limpiar(salida);
      ctx.almacen.leerCopiaRespaldo(nombre).then(function (copia) {
        copiaEnFoco = { nombre: nombre, casos: copia.casos };
        mostrarImpacto(salida, nombre, copia.casos);
      }).catch(function (e) {
        if (e && e.tipo === 'copiaInvalida') {
          // Flujo 6a: no se reemplaza nada.
          mostrarCopiaInvalida(salida, ['El archivo no es un JSON válido con una lista de casos.']);
          return;
        }
        ctx.avisar('No se pudo leer la copia: ' + A.errorDe(e), 'aviso-error', { temporal: false });
      });
    }

    function mostrarCopiaInvalida(salida, errores) {
      ctx.limpiar(salida);
      var caja = ctx.texto('div', null, 'aviso aviso-error');
      caja.appendChild(ctx.texto('p', 'Respaldo inválido: no se reemplaza ningún archivo.'));
      var ul = ctx.texto('ul');
      errores.forEach(function (x) { ul.appendChild(ctx.texto('li', x)); });
      caja.appendChild(ul);
      salida.appendChild(caja);
    }

    function mostrarImpacto(salida, nombre, lista) {
      ctx.limpiar(salida);
      var r = resumenRestauracion(lista, casos());
      var t = ctx.texto('table', null, 'tabla');
      var tb = ctx.texto('tbody');
      [
        ['Casos en la copia', r.enCopia],
        ['Casos en el maestro', r.enMaestro],
        ['Volverían al estado de la copia', r.distintos],
        ['Se recuperarían (ya no están)', r.nuevos],
        ['Sin cambios', r.iguales],
        ['Están en el maestro y no en la copia (se perderían)', r.soloEnMaestro]
      ].forEach(function (f) {
        var tr = ctx.texto('tr');
        tr.appendChild(ctx.texto('th', f[0]));
        tr.appendChild(ctx.texto('td', String(f[1])));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      salida.appendChild(t);
      salida.appendChild(ctx.texto('p', 'Marca de la copia: ' +
        (N.marcaDeCopia(nombre) || 'no reconocida') + '.', 'resumen-linea'));

      var entradaTexto = null;
      if (r.requiereConfirmacionEscrita) {
        // Flujo 6b: la copia tiene menos registros que el maestro; confirmación escrita.
        salida.appendChild(ctx.texto('p', 'La copia tiene ' + r.enCopia + ' casos y el maestro ' + r.enMaestro +
          '. Se perderían ' + r.soloEnMaestro + ' caso(s). Escriba ' + PALABRA_CONFIRMACION + ' para confirmar el reemplazo.',
          'aviso aviso-alerta'));
        var lab = document.createElement('label');
        lab.setAttribute('for', 'confirmacion-escrita');
        lab.textContent = 'Confirmación escrita';
        entradaTexto = document.createElement('input');
        entradaTexto.type = 'text';
        entradaTexto.id = 'confirmacion-escrita';
        salida.appendChild(lab);
        salida.appendChild(entradaTexto);
      } else {
        salida.appendChild(ctx.texto('p', 'Al confirmar, el maestro se reemplaza por esta copia.', 'aviso aviso-alerta'));
      }

      var botonConfirmar = ctx.boton('Confirmar la restauración', 'boton-primario', function () {
        if (r.requiereConfirmacionEscrita &&
            String(entradaTexto && entradaTexto.value || '').trim().toUpperCase() !== PALABRA_CONFIRMACION) {
          ctx.avisar('Escriba ' + PALABRA_CONFIRMACION + ' para confirmar el reemplazo.', 'aviso-alerta', { temporal: false });
          return;
        }
        ejecutarRestauracion(nombre, lista);
      });
      if (r.requiereConfirmacionEscrita) botonConfirmar.disabled = true;
      salida.appendChild(botonConfirmar);

      if (entradaTexto) {
        entradaTexto.addEventListener('input', function () {
          botonConfirmar.disabled =
            String(entradaTexto.value || '').trim().toUpperCase() !== PALABRA_CONFIRMACION;
        });
      }
    }

    function ejecutarRestauracion(nombre, lista) {
      var inicio = new Date();
      var escribir;
      if (!descarga && typeof ctx.almacen.restaurarCopia === 'function' &&
          ctx.almacen.carpetaRespaldo && N.esCopiaCierre(nombre)) {
        escribir = function (opts) { return ctx.almacen.restaurarCopia(nombre, opts); };
      } else {
        escribir = function (opts) {
          return ctx.almacen.guardarArchivo(CONST.ARCHIVO_MAESTRO, lista, opts).then(function () {
            var fin = new Date();
            return {
              copia: nombre, marcaCopia: N.marcaDeCopia(nombre), casos: lista.length,
              inicio: N.marcaAhora(inicio), fin: N.marcaAhora(fin),
              duracionMs: fin.getTime() - inicio.getTime(),
              rtoCumplido: (fin.getTime() - inicio.getTime()) <= 3600000
            };
          });
        };
      }
      escribir({}).then(function (res) {
        ctx.registrarLog('respaldo | RESTAURACION | ' + nombre + ' | casos=' + res.casos +
          ' | inicio=' + res.inicio + ' | fin=' + res.fin + ' | p00=' + ctx.sesion.P00);
        ctx.avisar('Restauración completada desde el respaldo del ' + (res.marcaCopia || nombre) +
          '. Inicio ' + res.inicio + ', fin ' + res.fin +
          ' (RTO de 1 hora ' + (res.rtoCumplido ? 'cumplido' : 'excedido') + ').', 'aviso-info', { temporal: false });
        if (typeof ctx.recargarDatos === 'function') ctx.recargarDatos();
        else refrescar();
      }).catch(function (e) {
        if (e && e.tipo === 'conflicto') {
          // Flujo 8b: conflicto de concurrencia (D-41, RNF-14).
          ctx.registrarLog('respaldo | CONFLICTO | ' + nombre + ' | p00=' + ctx.sesion.P00);
          ctx.manejarConflicto(CONST.ARCHIVO_MAESTRO, lista, function () {
            return escribir({ sobrescribir: true }).then(function () {
              ctx.avisar('Restauración completada con sobrescritura consciente desde ' + nombre + '.',
                'aviso-info', { temporal: false });
              if (typeof ctx.recargarDatos === 'function') ctx.recargarDatos();
            });
          }, e);
          return;
        }
        ctx.registrarLog('respaldo | FALLO RESTAURACION | ' + A.errorDe(e) + ' | p00=' + ctx.sesion.P00);
        ctx.avisar('No se pudo restaurar: ' + A.errorDe(e), 'aviso-error', { temporal: false });
      });
    }

    refrescar();
  }

  var API = {
    ciclo: 'C7',
    PALABRA_CONFIRMACION: PALABRA_CONFIRMACION,
    validarCopia: validarCopia,
    resumenRestauracion: resumenRestauracion,
    render: render
  };

  raiz.GGTO_RESPALDO = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
