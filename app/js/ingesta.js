/*
 * GGTO-v1 - ingesta.js
 * Ciclo C2: ingesta diaria del CSV (RF-16 a RF-19, RF-27).
 *   - Carga del archivo con separador «;» y validacion POSICIONAL bloqueante
 *     (D-12, D-44): si algo no cuadra, no se escribe nada.
 *   - Filtro por central contra central.json (RF-16, RT-03).
 *   - Mapeo a los campos del maestro segun estructura.json (D-12).
 *   - Deduplicacion por id_averia, duplicados en lote e id vacio (RN-01).
 *   - Clasificacion RN-03 con la lista editable (D-05, D-21, D-26, D-38, D-43).
 *   - Asignacion de sector por vias y cola de pendientes (RF-18, RN-04, D-03).
 *   - Escritura con el protocolo verificado de C1 (D-41, D-42) y linea de
 *     historial inmutable por caso (D-56).
 *   - Si el CSV del dia no llega, se registra la novedad sin bloquear (D-46).
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var A = raiz.GGTO_ALMACEN;
  var IN = raiz.GGTO_INGESTA_NUCLEO;

  // Estado de la pantalla (se reinicia en cada render).
  var vista = {
    nombreArchivo: '',
    texto: '',
    resultado: null,
    ingiriendo: false
  };

  function esSupervisor(ctx) {
    return N.resolverRol(ctx.sesion) === 'Supervisor';
  }

  /** La matriz de permisos manda: el operador también puede ingerir (CU-08). */
  function puedeIngerir(ctx) {
    return N.autorizar(ctx.ambito, 'ingesta.ejecutar').permitido;
  }

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    vista = { nombreArchivo: '', texto: '', resultado: null, ingiriendo: false };

    if (!ctx.sesion) {
      contenedor.appendChild(ctx.texto('p', 'Identifíquese para ingresar el archivo del día.', 'aviso aviso-alerta'));
      return;
    }
    if (!puedeIngerir(ctx)) {
      contenedor.appendChild(ctx.texto('p',
        N.autorizar(ctx.ambito, 'ingesta.ejecutar').mensaje || 'Acción no permitida para su rol',
        'aviso aviso-error'));
      return;
    }

    var seccion = ctx.texto('section', null, 'ingesta');
    seccion.appendChild(ctx.texto('h2', 'INGESTA del CSV diario'));

    var maestro = ctx.almacen.datos[CONST_MAESTRO()] || [];
    seccion.appendChild(ctx.texto('p',
      'Casos en el maestro: ' + maestro.length + ' · Hoy: ' + N.marcaAhora() +
      ' · Central: ' + ((ctx.almacen.datos['central.json'] || {}).nombre_central || 'sin configurar'),
      'resumen-linea'));

    // --- paso 1: elegir el archivo -----------------------------------------
    var bloque = ctx.texto('div', null, 'bloque');
    bloque.appendChild(ctx.texto('h3', '1. Elegir el archivo del día'));

    var zona = ctx.texto('div', null, 'zona-ingesta');
    var acciones = ctx.texto('div', null, 'acciones');
    var botonIngerir = ctx.boton('Ingestar los casos nuevos', 'boton-primario', function () {
      ejecutarIngesta(ctx, zona, botonIngerir);
    });
    botonIngerir.disabled = true;

    // --- via 1: los CSV que ya estan en la carpeta de datos (D-78, D-79) ----
    // Es el camino normal: el archivo del dia vive en C:\GGTO\datos, que es la
    // carpeta que la pagina ya tiene autorizada, asi que no hace falta navegar
    // por el explorador de Windows.
    var cajaDatos = ctx.texto('div', null, 'entrada-desde-datos');
    cajaDatos.appendChild(ctx.texto('h4', 'Desde la carpeta de datos ' + RUTA_DATOS()));
    var zonaLista = ctx.texto('div', null, 'lista-csv');
    cajaDatos.appendChild(zonaLista);
    bloque.appendChild(cajaDatos);

    // --- via 2: el selector del navegador (archivo fuera de la carpeta) ----
    var cajaArchivo = ctx.texto('div', null, 'entrada-desde-archivo');
    cajaArchivo.appendChild(ctx.texto('h4', 'Desde este equipo'));
    cajaArchivo.appendChild(ctx.texto('p',
      'Para un archivo que todavía no está en ' + RUTA_DATOS() +
      ' (un pendrive, la red…): lo normal es copiarlo antes a esa carpeta (D-78).', 'ayuda'));

    var entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = '.csv,text/csv';
    entrada.id = 'archivo-csv';
    entrada.className = 'entrada-archivo';

    var etiqueta = document.createElement('label');
    etiqueta.setAttribute('for', 'archivo-csv');
    etiqueta.textContent = 'Archivo CSV (separador «;», 80 columnas)';

    cajaArchivo.appendChild(etiqueta);
    cajaArchivo.appendChild(entrada);
    bloque.appendChild(cajaArchivo);
    seccion.appendChild(bloque);

    seccion.appendChild(zona);
    acciones.appendChild(botonIngerir);
    acciones.appendChild(ctx.boton('Registrar que el CSV no llegó', 'boton-secundario', function () {
      registrarSinIngesta(ctx, zona);
    }));
    seccion.appendChild(acciones);

    contenedor.appendChild(seccion);

    /** Revisa un texto ya leído, venga de la lista o del selector. */
    function revisar(ctx2, nombre, texto, zonaDestino, boton) {
      vista.nombreArchivo = nombre;
      vista.texto = texto;
      vista.resultado = calcular(ctx2, texto);
      pintarResultado(ctx2, zonaDestino, vista.resultado);
      boton.disabled = !(vista.resultado && vista.resultado.ok && vista.resultado.casos.length > 0);
    }

    // Pinta la lista de CSV de la carpeta de datos (o explica por qué no hay).
    function pintarLista() {
      ctx.limpiar(zonaLista);
      zonaLista.appendChild(ctx.texto('p', 'Buscando archivos .csv…', 'ayuda'));
      var listar = ctx.almacen && typeof ctx.almacen.listarCSV === 'function'
        ? ctx.almacen.listarCSV()
        : Promise.resolve([]);
      listar.then(function (lista) {
        ctx.limpiar(zonaLista);
        if (!lista.length) {
          zonaLista.appendChild(ctx.texto('p',
            'No hay ningún archivo .csv en esa carpeta: copie ahí el que entrega el emisor y pulse ' +
            '«Actualizar la lista», o use el selector de abajo.', 'aviso aviso-alerta'));
          return;
        }
        var seleccion = document.createElement('select');
        seleccion.id = 'csv-datos';
        seleccion.className = 'seleccion-archivo';
        var deHoy = null;
        lista.forEach(function (f, i) {
          var opcion = document.createElement('option');
          opcion.value = f.nombre;
          opcion.textContent = f.nombre + '  (' + tamanoLegible(f.tamano) +
            (f.modificado ? ', ' + fechaLegible(f.modificado) : '') + ')';
          if (esDeHoy(f.nombre)) { opcion.textContent += '  ← el de hoy'; deHoy = f.nombre; }
          seleccion.appendChild(opcion);
        });
        // Se preselecciona el archivo del día si está; si no, el más reciente.
        seleccion.value = deHoy || lista[0].nombre;
        zonaLista.appendChild(seleccion);

        var botonRevisar = ctx.boton('Revisar el archivo elegido', 'boton-primario', function () {
          var elegido = seleccion.value;
          botonRevisar.disabled = true;
          ctx.almacen.leerTextoDeDatos(elegido).then(function (texto) {
            revisar(ctx, elegido, texto, zona, botonIngerir);
          }).catch(function (e) {
            ctx.avisar('No se pudo leer ' + elegido + ': ' +
              (e && e.message ? e.message : e), 'aviso-error', { temporal: false });
          }).then(function () { botonRevisar.disabled = false; });
        });
        zonaLista.appendChild(botonRevisar);

        if (deHoy) {
          zonaLista.appendChild(ctx.texto('p',
            'El archivo del día (' + deHoy + ') está en la carpeta de datos.', 'aviso aviso-ok'));
        } else {
          zonaLista.appendChild(ctx.texto('p',
            'Ninguno de los archivos de la carpeta corresponde a hoy (' + nombreDeHoy() + ').', 'aviso aviso-alerta'));
        }
      }).catch(function (e) {
        ctx.limpiar(zonaLista);
        zonaLista.appendChild(ctx.texto('p',
          'No se pudo consultar la carpeta de datos: ' + (e && e.message ? e.message : e) +
          '. Use el selector de abajo.', 'aviso aviso-alerta'));
      });
    }

    cajaDatos.appendChild(ctx.boton('Actualizar la lista', 'boton-secundario', function () { pintarLista(); }));
    pintarLista();

    entrada.addEventListener('change', function () {
      var archivo = entrada.files && entrada.files[0];
      if (!archivo) return;
      leerArchivo(archivo).then(function (texto) {
        revisar(ctx, archivo.name, texto, zona, botonIngerir);
      }).catch(function (e) {
        ctx.avisar('No se pudo leer el archivo: ' + (e && e.message ? e.message : e), 'aviso-error', { temporal: false });
      });
    });
  }

  function CONST_MAESTRO() { return N.CONST.ARCHIVO_MAESTRO; }

  function RUTA_DATOS() { return N.CONST.RUTA_DATOS; }

  /** `detalle_averias_gpon DD_MM_AAAA.csv` del día de hoy. */
  function nombreDeHoy() {
    var partes = fechaDeHoy().split('/');
    return 'detalle_averias_gpon ' + partes[0] + '_' + partes[1] + '_' + partes[2] + '.csv';
  }

  /** ¿El nombre corresponde al archivo del día (DD_MM_AAAA)? */
  function esDeHoy(nombre) {
    var partes = fechaDeHoy().split('/');
    return String(nombre || '').indexOf(partes[0] + '_' + partes[1] + '_' + partes[2]) >= 0;
  }

  function tamanoLegible(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    return Math.round(n / 1024) + ' KB';
  }

  function fechaLegible(marca) {
    var d = new Date(Number(marca));
    if (isNaN(d.getTime())) return '';
    var p = function (x) { return String(x).length < 2 ? '0' + x : String(x); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function leerArchivo(archivo) {
    if (typeof archivo.text === 'function') return archivo.text();
    return new Promise(function (resolve, reject) {
      var lector = new FileReader();
      lector.onload = function () { resolve(String(lector.result || '')); };
      lector.onerror = function () { reject(new Error('lectura fallida')); };
      lector.readAsText(archivo, 'UTF-8');
    });
  }

  /** Calcula el resultado sin escribir nada (dry run). */
  function calcular(ctx, texto) {
    var datos = ctx.almacen.datos;
    var conf = datos['claves_clasificacion.json'] || {};
    return IN.ingerir({
      texto: texto,
      estructura: datos[N.CONST.ARCHIVO_ESTRUCTURA] || {},
      central: datos['central.json'] || {},
      claves: conf.claves || [],
      maestro: datos[N.CONST.ARCHIVO_MAESTRO] || [],
      sectores: datos['sectores.json'] || [],
      opciones: {
        fecha: fechaDeHoy(),
        marca: N.marcaAhora(),
        operador: ctx.sesion.P00,
        clase: 'REP',
        nivel: 'COM',
        modo: conf.normalizacion || 'normalizada'
      }
    });
  }

  function fechaDeHoy() {
    var marca = N.marcaAhora();
    return marca.split(' ')[0];
  }

  function pintarResultado(ctx, zona, r) {
    ctx.limpiar(zona);
    if (!r) return;

    zona.appendChild(ctx.texto('h3', '2. Resultado de la revisión'));
    zona.appendChild(ctx.texto('p', 'Archivo: ' + (vista.nombreArchivo || '(sin nombre)') +
      ' · columnas: ' + r.resumen.columnas + ' · ' + r.resumen.ms + ' ms', 'resumen-linea'));

    if (!r.ok) {
      var cajaErr = ctx.texto('div', null, 'aviso aviso-error');
      cajaErr.appendChild(ctx.texto('p', 'Ingesta abortada: no se ha escrito nada.'));
      var ul = ctx.texto('ul');
      r.errores.forEach(function (e) {
        ul.appendChild(ctx.texto('li', (e.columna ? 'Columna ' + e.columna + ': ' : '') + e.motivo));
      });
      cajaErr.appendChild(ul);
      zona.appendChild(cajaErr);
      return;
    }

    var tabla = ctx.texto('table', null, 'tabla');
    var filas = [
      ['Filas leídas', r.resumen.leidas],
      ['Descartadas por no ser de la central', r.resumen.fueraDeCentral],
      ['Ya existentes en el maestro (duplicadas)', r.resumen.duplicadasEnMaestro],
      ['Duplicadas dentro del archivo', r.resumen.duplicadasEnLote],
      ['Rechazadas (con motivo)', r.resumen.rechazadas.length],
      ['Casos nuevos a insertar', r.resumen.insertadas],
      ['Quedarían en PEND', r.resumen.pend],
      ['Quedarían en GESTION (bandeja telefónica)', r.resumen.gestion],
      ['Con palabras clave de fibra', r.resumen.conClaves],
      ['Sin palabras clave', r.resumen.sinClaves],
      ['Con sector asignado', r.resumen.conSector],
      ['A la cola de sectores (CU-09)', r.resumen.sinSector]
    ];
    var tbody = ctx.texto('tbody');
    filas.forEach(function (f) {
      var tr = ctx.texto('tr');
      tr.appendChild(ctx.texto('th', f[0]));
      tr.appendChild(ctx.texto('td', String(f[1])));
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
    zona.appendChild(tabla);

    if (r.resumen.rechazadas.length) {
      var rech = ctx.texto('div', null, 'aviso aviso-alerta');
      rech.appendChild(ctx.texto('p', 'Filas rechazadas:'));
      var ul2 = ctx.texto('ul');
      r.resumen.rechazadas.slice(0, 20).forEach(function (x) {
        ul2.appendChild(ctx.texto('li', 'Fila ' + x.fila + ': ' + x.motivo));
      });
      rech.appendChild(ul2);
      zona.appendChild(rech);
    }

    if (r.resumen.sinSector) {
      zona.appendChild(ctx.texto('p',
        r.resumen.sinSector + ' dirección(es) sin sector quedarán en la cola de CU-09: el operador propone el sector y el supervisor lo aprueba (D-60).',
        'aviso aviso-info'));
    }

    if (r.resumen.ms > 3000) {
      zona.appendChild(ctx.texto('p',
        'Aviso de rendimiento: la revisión tardó ' + r.resumen.ms + ' ms (el umbral S-RNF-02b es 3000 ms).',
        'aviso aviso-alerta'));
    }
  }

  /** Escribe el maestro y el historial. */
  function ejecutarIngesta(ctx, zona, boton) {
    var r = vista.resultado;
    if (!r || !r.ok || !r.casos.length) return;
    boton.disabled = true;
    vista.ingiriendo = true;

    var marca = N.marcaAhora();
    var lista = (ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || []).slice().concat(r.casos);
    var lineas = r.casos.map(function (c) {
      return N.lineaHistorial({
        fecha_hora: marca,
        operador: ctx.sesion.P00,
        id_averia: c.id_averia,
        campo: 'status',
        valor_anterior: '',
        valor_nuevo: c.status,
        accion: 'ingesta'
      });
    });

    function terminar() {
      ctx.registrarLog('ingesta | ' + vista.nombreArchivo + ' | p00=' + ctx.sesion.P00 +
        ' | insertadas=' + r.resumen.insertadas + ' | pend=' + r.resumen.pend +
        ' | gestion=' + r.resumen.gestion + ' | sin_sector=' + r.resumen.sinSector);
      ctx.avisar('Ingesta completada: ' + r.resumen.insertadas + ' casos nuevos (' +
        r.resumen.pend + ' PEND, ' + r.resumen.gestion + ' GESTION).', 'aviso-info', { temporal: false });
      vista.ingiriendo = false;
      if (typeof ctx.recargarDatos === 'function') ctx.recargarDatos();
    }

    if (ctx.modoDescarga()) {
      ctx.descargarArchivo(N.CONST.ARCHIVO_MAESTRO, lista).then(function () {
        ctx.avisar('Modo descarga: se descargó ' + N.CONST.ARCHIVO_MAESTRO +
          ' con los casos nuevos. Reemplácelo en C:\\GGTO\\datos al terminar. El historial no se puede escribir en este modo.',
          'aviso-alerta', { temporal: false });
        vista.ingiriendo = false;
      });
      return;
    }

    ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_MAESTRO, lista, {}).then(function () {
      return ctx.almacen.agregarHistorial(lineas);
    }).then(function (res) {
      terminar();
      zona.appendChild(ctx.texto('p',
        'Guardado y releído. Líneas añadidas al historial: ' + (res ? res.agregadas : 0), 'aviso aviso-ok'));
    }).catch(function (e) {
      if (e && e.tipo === 'conflicto') {
        ctx.manejarConflicto(N.CONST.ARCHIVO_MAESTRO, lista, function () {
          return ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_MAESTRO, lista, { sobrescribir: true })
            .then(function () { return ctx.almacen.agregarHistorial(lineas); })
            .then(function () {
              ctx.avisar('Ingesta guardada con sobrescritura consciente.', 'aviso-info');
              terminar();
            });
        }, e);
        boton.disabled = false;
        vista.ingiriendo = false;
        return;
      }
      ctx.avisar('No se pudo guardar la ingesta: ' + A.errorDe(e), 'aviso-error', { temporal: false });
      boton.disabled = false;
      vista.ingiriendo = false;
    });
  }

  /** D-46: el archivo del día no llegó. */
  function registrarSinIngesta(ctx, zona) {
    var marca = N.marcaAhora();
    ctx.registrarLog('ingesta | SIN INGESTA | p00=' + ctx.sesion.P00 + ' | fecha=' + marca +
      ' | no llegó el archivo del día');
    ctx.avisar('Novedad registrada: sin ingesta el ' + marca + '. La consulta y el despacho siguen disponibles.',
      'aviso-alerta', { temporal: false });
    if (zona) {
      ctx.limpiar(zona);
      zona.appendChild(ctx.texto('p', 'Sin ingesta registrada el ' + marca +
        '. No se modificó el maestro.', 'aviso aviso-alerta'));
    }
  }

  raiz.GGTO_INGESTA = {
    ciclo: 'C2',
    requisitos: 'RF-16 a RF-19, RF-27',
    render: render,
    calcular: calcular,
    registrarSinIngesta: registrarSinIngesta
  };
})(window);
