/*
 * GGTO-v1 - pdf.js
 * Ciclo C4. PDF del despacho por cuadrilla (CU-17, RF-10):
 *   - Una hoja por cuadrilla, en CARTA HORIZONTAL, ajustada al área imprimible
 *     (RNF-05), con paginación cuando hay más casos de los que caben. La tabla
 *     ocupa exactamente el ancho imprimible y, con el encabezado, cubre las
 *     **15 columnas canónicas** de `despacho.json` (CU-17 CA-2, D-31).
 *   - Marca de fecha, cuadrilla y número de copia, y pie con la instrucción de
 *     recoger y destruir las hojas al cierre del día (RNF-11, D-27).
 *   - Se guarda en la RUTA CONTROLADA `C:\GGTO\despachos` (D-27, D-67), nunca en
 *     Descargas, verificando la escritura por relectura; las reemisiones del
 *     mismo día conservan la versión anterior (CU-17, 6a).
 *   - Registro de entrega en el log de la aplicación (D-58).
 * Usa jsPDF local en `app/lib/` (RT-07, versión fijada).
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;

  // Carta horizontal (letter landscape): 279,4 x 215,9 mm.
  var PAGINA = { ancho: 279.4, alto: 215.9 };
  var MARGEN = 8;
  var ALTO_FILA = 6;
  /** Milímetros por punto tipográfico: el tamaño de letra viene en puntos. */
  var MM_POR_PUNTO = 0.3528;
  /**
   * Columnas de la tabla impresa. Entre la tabla y el encabezado se cubren las
   * **15 columnas canónicas** de `despacho.json` (CU-17 CA-2, D-31): la tabla
   * lleva estas 13 y el encabezado lleva `Reparador Principal` (cuadrilla) y
   * `fecha_despacho` (fecha). La última columna es elástica: absorbe el resto del
   * área imprimible, de modo que el ancho total es exactamente el disponible
   * (RNF-05).
   */
  var COLUMNAS = [
    { clave: 'nivel', titulo: 'Nivel', ancho: 11 },
    { clave: 'clase', titulo: 'Clase', ancho: 11 },
    { clave: 'id_averia', titulo: 'Id avería', ancho: 19 },
    { clave: 'telefono', titulo: 'Teléfono', ancho: 18 },
    { clave: 'persona_reporta', titulo: 'Reporta', ancho: 19 },
    { clave: 'contacto', titulo: 'Contacto', ancho: 19 },
    { clave: 'nombre', titulo: 'Nombre', ancho: 27 },
    { clave: 'direccion', titulo: 'Dirección', ancho: 44 },
    { clave: 'plan', titulo: 'Plan', ancho: 14 },
    { clave: 'fat', titulo: 'FAT', ancho: 12 },
    { clave: 'serial', titulo: 'Serial', ancho: 15 },
    { clave: 'sector', titulo: 'Sector', ancho: 14 },
    { clave: 'ultimo_comentario', titulo: 'Comentario', ancho: 0 } // el resto
  ];

  /** Anchos efectivos: la última columna absorbe lo que queda del área. */
  function anchosColumnas() {
    var anchos = COLUMNAS.map(function (c) { return c.ancho; });
    var fijos = anchos.reduce(function (t, a) { return t + a; }, 0);
    var resto = PAGINA.ancho - MARGEN * 2 - fijos;
    anchos[anchos.length - 1] = resto > 0 ? resto : 0;
    return anchos;
  }

  /** Ancho total de la tabla impresa (RNF-05: área máxima imprimible). */
  function anchoTabla() {
    return anchosColumnas().reduce(function (t, a) { return t + a; }, 0);
  }

  function claseJsPDF(opciones) {
    var opts = opciones || {};
    if (opts.jsPDFClase) return opts.jsPDFClase;
    if (raiz.jspdf && raiz.jspdf.jsPDF) return raiz.jspdf.jsPDF;
    return null;
  }

  /** Cuántas filas caben en una página (RNF-05: área imprimible). */
  function filasPorPagina() {
    var util = PAGINA.alto - MARGEN * 2 - 26; // cabecera + pie
    return Math.max(1, Math.floor(util / ALTO_FILA));
  }

  /**
   * Recorta el texto al ancho disponible. `ancho` va en milímetros y
   * `tamanoLetra` en puntos: se convierten para no cortar de más (el ancho medio
   * de un carácter es la mitad del cuerpo, ya en milímetros).
   */
  function truncar(texto, ancho, tamanoLetra) {
    var t = String(texto === null || texto === undefined ? '' : texto);
    var porCaracter = Math.max(0.5, Number(tamanoLetra) * 0.5 * MM_POR_PUNTO);
    var max = Math.max(3, Math.floor((ancho - 2) / porCaracter));
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  /**
   * Construye el PDF de una cuadrilla.
   * `bloque` es el bloque del reparto: { cuadrilla, asignaciones }.
   * Devuelve { doc, paginas, filas } o null si falta jsPDF.
   */
  function construirPDF(bloque, fecha, numeroCopia, opciones) {
    var opts = opciones || {};
    var Clase = claseJsPDF(opts);
    if (!Clase) return null;

    var doc = new Clase({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    var cuadrilla = (bloque && bloque.cuadrilla) || {};
    var asignaciones = (bloque && bloque.asignaciones) || [];
    var porPagina = filasPorPagina();
    var paginas = Math.max(1, Math.ceil(asignaciones.length / porPagina));
    var anchos = anchosColumnas();
    var totalAncho = anchoTabla();

    function cabecera(pagina) {
      doc.setFontSize(13);
      doc.text('CANTV · Despacho diario — Central Francisco Salias (Área 4)', MARGEN, MARGEN + 5);
      doc.setFontSize(10);
      doc.text('Fecha: ' + fecha + '   ·   Cuadrilla: ' + String(cuadrilla.id || '') +
        (cuadrilla.nombre ? ' (' + cuadrilla.nombre + ')' : '') +
        '   ·   Copia n.º ' + numeroCopia + (opts.receptor ? '   ·   Entregada a: ' + opts.receptor : ''),
        MARGEN, MARGEN + 11);
      doc.text('Casos: ' + asignaciones.length + '   ·   Página ' + pagina + ' de ' + paginas +
        '   ·   Recoger y destruir las hojas al cierre del día (D-27)', MARGEN, MARGEN + 16);
    }

    function encabezadoTabla(y) {
      doc.setFontSize(8);
      var x = MARGEN;
      COLUMNAS.forEach(function (col, i) {
        doc.rect(x, y, anchos[i], ALTO_FILA);
        doc.text(truncar(col.titulo, anchos[i], 8), x + 1, y + 4);
        x += anchos[i];
      });
      return y + ALTO_FILA;
    }

    var fila = 0;
    var pagina = 1;
    var y = 0;

    if (asignaciones.length === 0) {
      cabecera(1);
      doc.setFontSize(10);
      doc.text('Sin casos asignados a esta cuadrilla.', MARGEN, MARGEN + 30);
      return { doc: doc, paginas: 1, filas: 0, anchoTabla: totalAncho };
    }

    while (fila < asignaciones.length) {
      cabecera(pagina);
      y = encabezadoTabla(MARGEN + 20);
      var enEstaPagina = 0;
      while (fila < asignaciones.length && enEstaPagina < porPagina) {
        var caso = asignaciones[fila].caso || {};
        var x = MARGEN;
        doc.setFontSize(7.5);
        COLUMNAS.forEach(function (col, i) {
          doc.rect(x, y, anchos[i], ALTO_FILA);
          var valor = caso[col.clave];
          if (col.clave === 'fat') valor = caso.fat;
          doc.text(truncar(valor, anchos[i] - 1, 7.5), x + 1, y + 4);
          x += anchos[i];
        });
        y += ALTO_FILA;
        fila++;
        enEstaPagina++;
      }
      pagina++;
      if (fila < asignaciones.length) doc.addPage('letter', 'landscape');
    }

    return { doc: doc, paginas: paginas, filas: asignaciones.length, anchoTabla: totalAncho };
  }

  /**
   * Línea de registro de entrega para el log (RNF-11, D-27, D-58).
   * NO incluye el nombre del receptor: `incidencias.log` se declara **sin datos
   * personales** (D-58, §12 de entornos) y el receptor queda en la hoja impresa
   * y en el control documental de la sesión, no en el log (RN-05).
   */
  function registroEntrega(fecha, bloque, numeroCopia, operador, marca) {
    var cuadrilla = (bloque && bloque.cuadrilla) || {};
    return 'despacho | ENTREGA PDF | ' + fecha + ' | cuadrilla=' + String(cuadrilla.id || '') +
      ' | copias=' + numeroCopia +
      ' | p00=' + String(operador || '') + ' | ' + String(marca || '') +
      ' | receptor en la hoja impresa (D-58: el log no lleva datos personales)' +
      ' | recoger y destruir al cierre (D-27)';
  }

  /**
   * Nombre del archivo. Las reemisiones del mismo día llevan sufijo `_rN` para
   * **conservar la anterior** (CU-17, flujo 6a).
   */
  function nombreArchivo(bloque, fecha, reemision) {
    var id = String(((bloque || {}).cuadrilla || {}).id || 'X');
    var f = String(fecha || '').split('/');
    var iso = f.length === 3 ? f[2] + f[1] + f[0] : 'sinfecha';
    var n = Number(reemision) || 0;
    return 'Despacho_Cuadrilla_' + id + '_' + iso + (n > 1 ? '_r' + n : '') + '.pdf';
  }

  /**
   * Genera el PDF de una cuadrilla y lo guarda en la **ruta controlada**
   * `C:\GGTO\despachos` (D-27, D-67), nunca en Descargas, verificando la
   * escritura por relectura. Si la carpeta no está autorizada (o falla la
   * escritura) descarga el archivo y lo advierte expresamente.
   */
  function generar(ctx, bloque, fecha, copias, reemision) {
    var receptor = raiz.prompt ? (raiz.prompt('¿A quién se entrega la copia impresa de la cuadrilla ' +
      String(((bloque || {}).cuadrilla || {}).id || '') + '? (opcional)') || '') : '';
    var armado = construirPDF(bloque, fecha, copias || 1, { receptor: receptor });
    if (!armado) {
      ctx.avisar('No se pudo generar el PDF: falta la librería jsPDF en app/lib/.', 'aviso-error', { temporal: false });
      return;
    }
    var almacen = ctx.almacen || {};
    var marca = N.marcaAhora();
    var operador = ctx.sesion ? ctx.sesion.P00 : '';

    function registrar(ruta) {
      ctx.registrarLog(registroEntrega(fecha, bloque, copias || 1, operador, marca) +
        (ruta ? ' | ruta=' + ruta : ' | ruta=DESCARGA (fuera de la ruta controlada)'));
    }

    function exito(rutaTexto, verificado, n) {
      registrar(rutaTexto);
      ctx.avisar('PDF en la ruta controlada: ' + rutaTexto + ' (' + armado.paginas + ' página(s), ' +
        armado.filas + ' casos' + (verificado === false ? ', sin poder verificar la relectura' : ', verificado') + ')' +
        (n > 1 ? '. Reemisión n.º ' + n + ': se conserva la versión anterior' : '') +
        '. Registre la entrega y recoja las hojas al cierre del día (D-27).', 'aviso-info', { temporal: false });
    }

    function descargar(motivo) {
      armado.doc.save(nombreArchivo(bloque, fecha, reemision));
      registrar('');
      ctx.avisar(motivo + ' Se descargó el PDF, NO en la ruta controlada: guárdelo en ' +
        N.CONST.RUTA_DESPACHOS + ' o autorice esa carpeta para cumplir D-27.', 'aviso-alerta', { temporal: false });
    }

    var bytes = typeof armado.doc.output === 'function' ? armado.doc.output('arraybuffer') : null;
    var puedeEscribir = bytes && typeof almacen.guardarSalida === 'function' && almacen.carpetaDespachos;
    if (!puedeEscribir) {
      descargar('La ruta controlada ' + N.CONST.RUTA_DESPACHOS + ' no está autorizada.');
      return;
    }

    var base = nombreArchivo(bloque, fecha, 1).replace(/\.pdf$/, '');
    var listar = typeof almacen.listarSalidas === 'function' ? almacen.listarSalidas() : Promise.resolve([]);
    listar.then(function (salidas) {
      var previas = (salidas || []).filter(function (s) {
        return String((s || {}).nombre || '').indexOf(base) === 0;
      }).length;
      var n = Math.max(Number(reemision) || 1, previas + 1);
      var archivo = nombreArchivo(bloque, fecha, n);
      return almacen.guardarSalida(archivo, bytes).then(function (res) {
        exito(res.ruta + '\\' + archivo, res.verificado, n);
      });
    }).catch(function (e) {
      descargar('No se pudo escribir en ' + N.CONST.RUTA_DESPACHOS + ' (' +
        (e && e.message ? e.message : e) + ').');
    });
  }

  var API = {
    ciclo: 'C4',
    PAGINA: PAGINA,
    MARGEN: MARGEN,
    COLUMNAS: COLUMNAS,
    filasPorPagina: filasPorPagina,
    anchosColumnas: anchosColumnas,
    anchoTabla: anchoTabla,
    truncar: truncar,
    construirPDF: construirPDF,
    registroEntrega: registroEntrega,
    nombreArchivo: nombreArchivo,
    generar: generar
  };

  raiz.GGTO_PDF = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
