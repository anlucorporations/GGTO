/*
 * GGTO-v1 - entorno.js  (ciclo C7)
 * Bloque ENTORNO de CONFIGURACION: contingencia y diagnóstico del puesto
 * (CU-22; RNF-03, RNF-04, RNF-08, RNF-10, RNF-16; D-15, D-46, D-49, D-50, D-58).
 *
 *   - Estado verificable del puesto: navegador, soporte de File System Access
 *     API, modo de trabajo, rutas, servidor y versión.
 *   - Informe de los archivos de datos: cuáles faltan y cuáles son ilegibles.
 *   - Registro de la aplicación (`datos/incidencias.log`): qué hay, cuánto es
 *     del día y cuántas incidencias, con descarga del detalle.
 *   - Verificación de cierre de la jornada: última escritura confirmada, último
 *     respaldo y errores registrados en el día (CU-22, paso 7).
 *
 * Solo lectura: no escribe ni modifica ningún archivo. Depende de GGTO_NUCLEO y
 * GGTO_ALMACEN (carga previa por <script>).
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var A = raiz.GGTO_ALMACEN;
  var VERSION = 'GGTO-v1 · ciclos C1 a C7';

  /** Navegador detectado a partir del user agent (CU-22, paso 2). */
  function navegadorDetectado(ua) {
    var texto = String(ua || '');
    // Edge y Opera anuncian también «Chrome»: se buscan primero sus marcas.
    var m = /(Edg|Edge|OPR)\/([\d.]+)/.exec(texto) || /(Chrome|Firefox|Safari)\/([\d.]+)/.exec(texto);
    if (!m) return { nombre: 'no identificado', version: '', soportado: null };
    var nombre = m[1] === 'Edg' ? 'Edge' : (m[1] === 'OPR' ? 'Opera' : m[1]);
    var mayor = parseInt(String(m[2]).split('.')[0], 10);
    return {
      nombre: nombre, version: m[2],
      // La File System Access API existe en Chromium 86 o superior (RNF-03).
      soportado: (nombre === 'Chrome' || nombre === 'Edge') ? mayor >= 86 : false
    };
  }

  /** Origen de la página: debe ser http en host local (D-15, RT-09). */
  function origenPagina(ubicacion) {
    if (!ubicacion || !ubicacion.protocol) return { texto: 'desconocido', correcto: false, motivo: 'no se pudo leer la URL' };
    var protocolo = ubicacion.protocol;
    var host = String(ubicacion.hostname || '');
    var local = host === '127.0.0.1' || host === 'localhost';
    if (protocolo === 'file:') {
      return { texto: 'file:// (apertura directa)', correcto: false, motivo: 'abra la página con servir-ggto.ps1 desde http://localhost:8787' };
    }
    return {
      texto: protocolo + '//' + host + (ubicacion.port ? ':' + ubicacion.port : ''),
      correcto: protocolo === 'http:' && local,
      motivo: protocolo === 'http:' && local ? '' : 'el servidor debe ser local (127.0.0.1 o localhost)'
    };
  }

  function render(contenedor, ctx) {
    ctx.limpiar(contenedor);
    if (!ctx.sesion) {
      contenedor.appendChild(ctx.texto('p', 'Identifíquese para consultar el diagnóstico del puesto.', 'aviso aviso-alerta'));
      return;
    }
    if (!N.autorizar(ctx.ambito, 'entorno.diagnostico').permitido) {
      ctx.registrarLog('entorno | DENEGADO | p00=' + (ctx.sesion.P00 || ''));
      contenedor.appendChild(ctx.texto('p', 'Acción no permitida para su rol.', 'aviso aviso-error'));
      return;
    }

    var almacen = ctx.almacen || {};
    var app = ctx.estado || {};
    var seccion = ctx.texto('section', null, 'entorno');
    seccion.appendChild(ctx.texto('h2', 'ENTORNO y diagnóstico'));
    seccion.appendChild(ctx.texto('p',
      'Estado verificable del puesto (CU-22). Es solo lectura: no escribe ni modifica ningún archivo.',
      'resumen-linea'));

    // --- 1. Puesto y rutas (pasos 1 y 2) ----------------------------------
    var navegador = navegadorDetectado(typeof navigator !== 'undefined' ? navigator.userAgent : '');
    var soportado = typeof A.soportado === 'function' ? A.soportado() : false;
    var origen = origenPagina(typeof location !== 'undefined' ? location : null);
    var modo = ctx.modoDescarga()
      ? 'modo descarga (los cambios se descargan, no se escriben en disco)'
      : (almacen.tipo === 'carpeta' ? 'carpeta autorizada' :
        (almacen.tipo === 'archivos' ? 'archivos elegidos uno a uno' :
          (almacen.tipo === 'ninguno' ? 'sin carpeta de datos autorizada' : 'desconocido')));

    var tablaPuesto = tablaConCabecera(ctx, ['Elemento', 'Valor']);
    agregarFila(ctx, tablaPuesto.tbody, 'Navegador', navegador.nombre + (navegador.version ? ' ' + navegador.version : '') +
      (navegador.soportado === false ? ' — no soporta la escritura directa de los JSON' : ''));
    agregarFila(ctx, tablaPuesto.tbody, 'File System Access API', soportado ? 'disponible' : 'NO disponible (solo modo descarga)');
    agregarFila(ctx, tablaPuesto.tbody, 'Origen de la página', origen.texto + (origen.correcto ? '' : ' — ' + origen.motivo));
    agregarFila(ctx, tablaPuesto.tbody, 'Modo de trabajo', modo);
    agregarFila(ctx, tablaPuesto.tbody, 'Ruta de datos', N.CONST.RUTA_DATOS);
    agregarFila(ctx, tablaPuesto.tbody, 'Ruta controlada de los PDF', N.CONST.RUTA_DESPACHOS +
      (almacen.carpetaDespachos ? ' (autorizada)' : ' (sin autorizar)'));
    agregarFila(ctx, tablaPuesto.tbody, 'Ruta de respaldo', N.CONST.RUTA_RESPALDO);
    agregarFila(ctx, tablaPuesto.tbody, 'Versión', VERSION);
    seccion.appendChild(tablaPuesto.tabla);

    // --- 2. Archivos de datos (paso 3) ------------------------------------
    var resumen = app.resumen || [];
    var faltantes = resumen.filter(function (a) { return !a.existe; });
    var invalidos = resumen.filter(function (a) { return a.invalido; });
    var casos = (almacen.datos && almacen.datos[N.CONST.ARCHIVO_MAESTRO]) || [];
    seccion.appendChild(ctx.texto('h3', 'Archivos de datos'));
    seccion.appendChild(ctx.texto('p',
      'Archivos revisados: ' + resumen.length + ' · legibles: ' + (resumen.length - faltantes.length - invalidos.length) +
      ' · ausentes: ' + faltantes.length + ' · ilegibles: ' + invalidos.length +
      ' · casos en el maestro: ' + casos.length,
      faltantes.length || invalidos.length ? 'aviso aviso-alerta' : 'aviso aviso-ok'));
    if (faltantes.length || invalidos.length) {
      var lista = ctx.texto('ul');
      faltantes.forEach(function (a) { lista.appendChild(ctx.texto('li', a.archivo + ': no existe')); });
      invalidos.forEach(function (a) { lista.appendChild(ctx.texto('li', a.archivo + ': ' + a.invalido)); });
      seccion.appendChild(lista);
    }

    // --- 3. Registro de la aplicación y cierre del día (pasos 4 y 7) -------
    var bloqueLog = ctx.texto('div', null, 'bloque');
    bloqueLog.appendChild(ctx.texto('h3', 'Registro de la aplicación y cierre de la jornada'));
    var salida = ctx.texto('p', 'Consultando el registro…', 'aviso');
    bloqueLog.appendChild(salida);
    seccion.appendChild(bloqueLog);
    contenedor.appendChild(seccion);

    var hoy = String(N.marcaAhora()).split(' ')[0];

    function pintarCierre(textoLog, respaldo) {
      ctx.limpiar(salida);
      var incidencias = N.resumirIncidencias(textoLog, hoy);
      var ultimaEscritura = ultimaModificacion(almacen);
      var alerta = (incidencias.incidenciasDelDia > 0) || !respaldo || !respaldo.hay;
      salida.className = alerta ? 'aviso aviso-alerta' : 'aviso aviso-ok';
      salida.textContent = 'Última escritura confirmada: ' + (ultimaEscritura || 'ninguna en esta sesión') +
        ' · Último respaldo: ' + (respaldo && respaldo.hay ? respaldo.ultima.marca : 'sin respaldos registrados') +
        ' · Incidencias registradas hoy (' + hoy + '): ' + incidencias.incidenciasDelDia +
        ' (líneas del día: ' + incidencias.delDia + ' de ' + incidencias.total + ').';

      if (incidencias.detalle.length) {
        var ul = ctx.texto('ul');
        incidencias.detalle.forEach(function (l) { ul.appendChild(ctx.texto('li', l)); });
        bloqueLog.appendChild(ul);
      }
      if (incidencias.total) {
        bloqueLog.appendChild(ctx.boton('Descargar el detalle del registro', null, function () {
          ctx.descargarArchivo('incidencias.log', textoLog);
          ctx.registrarLog('entorno | DESCARGA DEL LOG | p00=' + ctx.sesion.P00);
        }));
      } else {
        bloqueLog.appendChild(ctx.texto('p', 'El registro está vacío: no hay incidencias registradas.', 'resumen-linea'));
      }
      if (!respaldo || !respaldo.hay) {
        bloqueLog.appendChild(ctx.texto('p',
          'Sin respaldos registrados: el RPO no está cubierto hasta que exista la primera copia de cierre ' +
          '(D-49). Puede crearla en CONFIGURACION → RESPALDO.', 'aviso aviso-alerta'));
      }
    }

    var pedirLog = typeof almacen.leerIncidencias === 'function'
      ? almacen.leerIncidencias().catch(function () { return ''; })
      : Promise.resolve('');
    var pedirRespaldo = typeof almacen.estadoRespaldo === 'function'
      ? almacen.estadoRespaldo().catch(function () { return null; })
      : Promise.resolve(null);
    Promise.all([pedirLog, pedirRespaldo]).then(function (r) { pintarCierre(r[0], r[1]); });
  }

  /** Marca de la escritura verificada más reciente de esta sesión. */
  function ultimaModificacion(almacen) {
    var estado = (almacen && almacen.estado) || {};
    var mayor = null;
    Object.keys(estado).forEach(function (nombre) {
      var marca = estado[nombre] && estado[nombre].ultimaModificacion;
      if (typeof marca === 'number' && (mayor === null || marca > mayor)) mayor = marca;
    });
    return mayor === null ? '' : N.marcaAhora(new Date(mayor));
  }

  function tablaConCabecera(ctx, titulos) {
    var t = ctx.texto('table', null, 'tabla');
    var thead = ctx.texto('thead');
    var tr = ctx.texto('tr');
    (titulos || []).forEach(function (x) { tr.appendChild(ctx.texto('th', x)); });
    thead.appendChild(tr);
    t.appendChild(thead);
    var tbody = ctx.texto('tbody');
    t.appendChild(tbody);
    return { tabla: t, tbody: tbody };
  }

  function agregarFila(ctx, tbody, etiqueta, valor) {
    var tr = ctx.texto('tr');
    tr.appendChild(ctx.texto('th', etiqueta));
    tr.appendChild(ctx.texto('td', String(valor === null || valor === undefined || valor === '' ? '—' : valor)));
    tbody.appendChild(tr);
  }

  var API = {
    ciclo: 'C7',
    VERSION: VERSION,
    navegadorDetectado: navegadorDetectado,
    origenPagina: origenPagina,
    ultimaModificacion: ultimaModificacion,
    render: render
  };

  raiz.GGTO_ENTORNO = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
