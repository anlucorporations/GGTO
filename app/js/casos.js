/*
 * GGTO-v1 - casos.js  (ciclo C1)
 * Tabla maestra con las 7 columnas resumen y sus 6 filtros/agrupaciones (RF-07,
 * RF-21, RF-23), flotante de detalle agrupado por secciones (RF-22), edición
 * manual de clase/nivel/tipo_abonado con escritura verificada y línea de
 * historial (RF-24, RF-28, D-42, D-56), CERRAR CASO con validación bloqueante
 * (RF-22, D-20, RNF-10), ámbito por cuadrilla del operador (D-35, RNF-12) y
 * consulta de la auditoría de cambios leyendo historial.jsonl (CU-15, D-56).
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var A = raiz.GGTO_ALMACEN;
  var CONST = N.CONST;

  // Estado de la vista (se reinicia al reconstruir la pestaña)
  var vista = {
    filtros: { estado: '', cuadrilla: '', tipo: '', clase: '', nivel: '', estatus: '', busqueda: '' },
    agrupar: '',
    orden: { campo: 'id_averia', asc: true },
    seleccion: -1,
    pagina: 1,
    porPagina: 200
  };

  var contextoGlobal = null;

  // ------------------------------------------------------------------
  // Render principal
  // ------------------------------------------------------------------
  function render(contenedor, ctx) {
    contextoGlobal = ctx;
    ctx.limpiar(contenedor);
    var ambito = ctx.ambito;

    var bloque = ctx.texto('div', null, 'bloque');
    bloque.appendChild(ctx.texto('h2', 'CASOS — tabla maestra'));
    var resumenAmbito = ctx.texto('p', 'Ámbito de la sesión: ' + (ambito.rol === 'Supervisor'
      ? 'supervisor (todos los casos).'
      : (ambito.soloLectura
        ? CONST.MSG.SIN_CUADRILLA + ': se ven todos los casos, sin poder editar ni cerrar.'
        : 'operador de la cuadrilla ' + ambito.cuadrilla + ': solo los casos con Reparador Principal = ' + ambito.cuadrilla + '.')));
    bloque.appendChild(resumenAmbito);

    var filtros = ctx.texto('div', null, 'barra-filtros');
    filtros.appendChild(construirFiltros(ctx));
    bloque.appendChild(filtros);

    var conteo = ctx.texto('p', null, 'contador');
    conteo.id = 'casos-conteo';
    conteo.setAttribute('role', 'status');
    conteo.setAttribute('aria-live', 'polite');
    bloque.appendChild(conteo);

    var zonaTabla = ctx.texto('div');
    zonaTabla.id = 'casos-tabla';
    bloque.appendChild(zonaTabla);
    contenedor.appendChild(bloque);
    pintar();
  }

  function actualizarControles(ctx) {
    var v = vista.filtros;
    var ids = { estado: 'f-estado', cuadrilla: 'f-cuadrilla', tipo: 'f-tipo', clase: 'f-clase', nivel: 'f-nivel', estatus: 'f-estatus', busqueda: 'f-busqueda', agrupar: 'f-agrupar' };
    Object.keys(ids).forEach(function (k) {
      var el = document.getElementById(ids[k]);
      if (el) el.value = v[k];
    });
    var pag = document.getElementById('f-pagina');
    if (pag) pag.value = String(vista.pagina);
  }

  // ------------------------------------------------------------------
  // Filtros y agrupación (RF-23, D-23)
  // ------------------------------------------------------------------
  function construirFiltros(ctx) {
    var rejilla = ctx.texto('div', null, 'rejilla');
    var v = vista.filtros;

    var sEstado = ctx.seleccion([
      { valor: '', etiqueta: 'Todos' },
      { valor: 'abiertos', etiqueta: 'Abiertos (status distinto de CERRADO)' },
      { valor: 'cerrados', etiqueta: 'Cerrados (CERRADO)' }
    ], v.estado);
    sEstado.id = 'f-estado';
    rejilla.appendChild(ctx.campo('Abiertos / cerrados', sEstado));

    var cuadrillas = ctx.almacen.datos['cuadrillas.json'] || [];
    var sCuadrilla = ctx.seleccion([{ valor: '', etiqueta: 'Todas' }].concat(cuadrillas.map(function (c) {
      return { valor: String(c.id || ''), etiqueta: (c.id || '') + ' · ' + (c.nombre || '') };
    })), v.cuadrilla);
    sCuadrilla.id = 'f-cuadrilla';
    rejilla.appendChild(ctx.campo('Cuadrilla (Reparador Principal)', sCuadrilla));

    var sTipo = ctx.seleccion([
      { valor: '', etiqueta: 'Todos' },
      { valor: 'REP-COM', etiqueta: 'REP-COM' },
      { valor: 'REP-REF', etiqueta: 'REP-REF' },
      { valor: 'CNS-COM', etiqueta: 'CNS-COM' },
      { valor: 'CNS-REF', etiqueta: 'CNS-REF' }
    ], v.tipo);
    sTipo.id = 'f-tipo';
    rejilla.appendChild(ctx.campo('Tipo (clase + nivel, calculado)', sTipo));

    var sClase = ctx.seleccion([{ valor: '', etiqueta: 'Todas' }].concat(CONST.CLASE.map(function (c) {
      return { valor: c, etiqueta: c };
    })), v.clase);
    sClase.id = 'f-clase';
    rejilla.appendChild(ctx.campo('Clase', sClase));

    var sNivel = ctx.seleccion([{ valor: '', etiqueta: 'Todos' }].concat(CONST.NIVEL.map(function (n) {
      return { valor: n, etiqueta: n };
    })), v.nivel);
    sNivel.id = 'f-nivel';
    rejilla.appendChild(ctx.campo('Nivel', sNivel));

    var sEstatus = ctx.seleccion([{ valor: '', etiqueta: 'Todos' }].concat(CONST.STATUS.map(function (s) {
      return { valor: s, etiqueta: s };
    })), v.estatus);
    sEstatus.id = 'f-estatus';
    rejilla.appendChild(ctx.campo('Estatus', sEstatus));

    var iBusqueda = ctx.entrada('search', v.busqueda);
    iBusqueda.id = 'f-busqueda';
    rejilla.appendChild(ctx.campo('Búsqueda libre', iBusqueda, 'Busca en id_averia, teléfono, nombre y dirección.'));

    var sAgrupar = ctx.seleccion([
      { valor: '', etiqueta: 'Sin agrupar' },
      { valor: 'abierto', etiqueta: 'Agrupar por abierto / cerrado' },
      { valor: 'cuadrilla', etiqueta: 'Agrupar por cuadrilla' },
      { valor: 'tipo', etiqueta: 'Agrupar por tipo (clase + nivel)' },
      { valor: 'clase', etiqueta: 'Agrupar por clase' },
      { valor: 'nivel', etiqueta: 'Agrupar por nivel' },
      { valor: 'estatus', etiqueta: 'Agrupar por estatus' }
    ], v.agrupar);
    sAgrupar.id = 'f-agrupar';
    rejilla.appendChild(ctx.campo('Agrupar', sAgrupar));

    var iPagina = ctx.entrada('number', vista.pagina, { min: '1' });
    iPagina.id = 'f-pagina';
    rejilla.appendChild(ctx.campo('Página (' + vista.porPagina + ' por página)', iPagina,
      'La tabla se pagina para sostener el umbral de 1,5 s (RNF-02, D-24).'));

    var acciones = ctx.texto('div', null, 'rejilla');
    acciones.appendChild(ctx.campo(' ', ctx.boton('Aplicar filtros', 'boton-primario', function () {
      leerFiltros();
      vista.pagina = 1;
      pintar();
    })));
    acciones.appendChild(ctx.campo(' ', ctx.boton('Limpiar filtros', null, function () {
      vista.filtros = { estado: '', cuadrilla: '', tipo: '', clase: '', nivel: '', estatus: '', busqueda: '' };
      vista.agrupar = '';
      vista.orden = { campo: 'id_averia', asc: true };
      vista.pagina = 1;
      actualizarControles(ctx);
      pintar();
    })));
    var cont = ctx.texto('div', null, 'rejilla-ancha');
    cont.appendChild(acciones);
    rejilla.appendChild(cont);
    return rejilla;
  }

  function leerFiltros() {
    var mapa = {
      estado: 'f-estado', cuadrilla: 'f-cuadrilla', tipo: 'f-tipo', clase: 'f-clase',
      nivel: 'f-nivel', estatus: 'f-estatus', busqueda: 'f-busqueda'
    };
    Object.keys(mapa).forEach(function (k) {
      var el = document.getElementById(mapa[k]);
      if (el) vista.filtros[k] = String(el.value || '');
    });
    var ag = document.getElementById('f-agrupar');
    if (ag) vista.agrupar = ag.value;
    var pag = document.getElementById('f-pagina');
    if (pag) {
      var p = parseInt(pag.value, 10);
      vista.pagina = (p && p > 0) ? p : 1;
    }
  }

  function casosVisibles(ctx) {
    var todos = ctx.almacen.datos['averias.json'] || [];
    var ambito = ctx.ambito;
    return todos.filter(function (c) { return N.casoVisible(ambito, c); });
  }

  function aplicarFiltros(lista) {
    var f = vista.filtros;
    var busqueda = String(f.busqueda || '').trim().toLowerCase();
    return lista.filter(function (c) {
      if (f.estado === 'abiertos' && !N.estaAbierto(c)) return false;
      if (f.estado === 'cerrados' && N.estaAbierto(c)) return false;
      if (f.cuadrilla && String(c['Reparador Principal'] || '') !== f.cuadrilla) return false;
      if (f.tipo && N.tipoCalculado(c) !== f.tipo) return false;
      if (f.clase && String(c.clase || '') !== f.clase) return false;
      if (f.nivel && String(c.nivel || '') !== f.nivel) return false;
      if (f.estatus && String(c.status || '') !== f.estatus) return false;
      if (busqueda) {
        var campos = ['id_averia', 'telefono', 'nombre', 'direccion', 'sector', 'plan'];
        var coincide = campos.some(function (k) { return String(c[k] || '').toLowerCase().indexOf(busqueda) !== -1; });
        if (!coincide) return false;
      }
      return true;
    });
  }

  /** Orden: las fechas DD/MM/AAAA se comparan como texto en formato fijo (H-29). */
  function comparar(a, b) {
    var campo = vista.orden.campo;
    var va = a[campo], vb = b[campo];
    var vacioA = !N.obligatorio(va), vacioB = !N.obligatorio(vb);
    if (vacioA && vacioB) return 0;
    if (vacioA) return 1;   // los vacíos van al final, en ambos sentidos
    if (vacioB) return -1;
    var sa = String(va), sb = String(vb);
    var r;
    if (N.esFechaValida(sa) && N.esFechaValida(sb)) {
      r = N.compararTexto(sa.split('/').reverse().join(''), sb.split('/').reverse().join(''));
    } else if (!isNaN(Number(sa)) && !isNaN(Number(sb))) {
      r = Number(sa) - Number(sb);
    } else {
      r = sa.localeCompare(sb, 'es');
    }
    return vista.orden.asc ? r : -r;
  }

  function claveGrupo(caso) {
    if (vista.agrupar === 'abierto') return N.estaAbierto(caso) ? 'Abiertos' : 'Cerrados';
    if (vista.agrupar === 'cuadrilla') return String(caso['Reparador Principal'] || 'Sin asignar');
    if (vista.agrupar === 'tipo') return N.tipoCalculado(caso) || 'Sin tipo';
    if (vista.agrupar === 'clase') return String(caso.clase || 'Sin clase');
    if (vista.agrupar === 'nivel') return String(caso.nivel || 'Sin nivel');
    if (vista.agrupar === 'estatus') return String(caso.status || 'Sin estatus');
    return null;
  }

  // ------------------------------------------------------------------
  // Pintado de la tabla
  // ------------------------------------------------------------------
  function pintar() {
    var ctx = contextoGlobal;
    if (!ctx) return;
    var zona = document.getElementById('casos-tabla');
    if (!zona) return;
    var conteo = document.getElementById('casos-conteo');
    ctx.limpiar(zona);

    var maestrovacio = !(ctx.almacen.datos['averias.json'] || []).length;
    if (maestrovacio) {
      var aviso = ctx.texto('div', null, 'aviso aviso-info');
      aviso.appendChild(ctx.texto('p', 'No hay maestro de casos. La carga del CSV llega en el ciclo C2 y el alta manual en el ciclo C3; ' +
        'mientras tanto la tabla permanece vacía y no se inventan datos.'));
      zona.appendChild(aviso);
      if (conteo) conteo.textContent = '0 casos en el maestro.';
      return;
    }

    var visibles = casosVisibles(ctx);
    var filtrados = aplicarFiltros(visibles).slice().sort(comparar);

    var abiertos = visibles.filter(N.estaAbierto).length;
    if (conteo) {
      conteo.textContent = filtrados.length + ' caso(s) para los filtros aplicados · ' +
        visibles.length + ' visibles en su ámbito (' + abiertos + ' abiertos, ' + (visibles.length - abiertos) + ' cerrados) · ' +
        'página ' + vista.pagina + ' de ' + Math.max(1, Math.ceil(filtrados.length / vista.porPagina));
    }

    if (!filtrados.length) {
      var vacio = ctx.texto('div', null, 'aviso aviso-alerta');
      vacio.appendChild(ctx.texto('p', CONST.MSG.SIN_CASOS + '.'));
      vacio.appendChild(ctx.boton('Limpiar filtros', null, function () {
        vista.filtros = { estado: '', cuadrilla: '', tipo: '', clase: '', nivel: '', estatus: '', busqueda: '' };
        vista.agrupar = '';
        vista.pagina = 1;
        actualizarControles(ctx);
        pintar();
      }));
      zona.appendChild(vacio);
      return;
    }

    var inicio = (vista.pagina - 1) * vista.porPagina;
    var pagina = filtrados.slice(inicio, inicio + vista.porPagina);

    if (vista.agrupar) {
      var grupos = {};
      pagina.forEach(function (c) {
        var k = claveGrupo(c);
        if (!grupos[k]) grupos[k] = [];
        grupos[k].push(c);
      });
      Object.keys(grupos).sort().forEach(function (k) {
        var caja = ctx.texto('div');
        var titulo = ctx.texto('h3', k + ' (' + grupos[k].length + ')');
        caja.appendChild(titulo);
        caja.appendChild(tablaDe(ctx, grupos[k], inicio));
        zona.appendChild(caja);
      });
    } else {
      zona.appendChild(tablaDe(ctx, pagina, inicio));
    }
  }

  function tablaDe(ctx, filas, desplazamiento) {
    var caja = ctx.texto('div', null, 'tabla-caja');
    var t = ctx.texto('table', null, 'tabla');
    var caption = ctx.texto('caption', 'Use Tab para entrar en la tabla, flechas ↑/↓ para moverse y Enter para abrir el detalle (RNF-13).');
    t.appendChild(caption);
    var thead = ctx.texto('thead');
    var trh = ctx.texto('tr');
    CONST.COLUMNAS_TABLA.forEach(function (col) {
      var th = ctx.texto('th');
      th.setAttribute('scope', 'col');
      var b = ctx.texto('button', col + (vista.orden.campo === col ? (vista.orden.asc ? ' ▲' : ' ▼') : ''), 'boton-encabezado');
      b.type = 'button';
      b.setAttribute('aria-label', 'Ordenar por ' + col + (vista.orden.campo === col ? (vista.orden.asc ? ', orden ascendente' : ', orden descendente') : ''));
      b.addEventListener('click', function () {
        if (vista.orden.campo === col) vista.orden.asc = !vista.orden.asc;
        else vista.orden = { campo: col, asc: true };
        pintar();
      });
      th.appendChild(b);
      trh.appendChild(th);
    });
    var thEstado = ctx.texto('th', 'Estatus');
    thEstado.setAttribute('scope', 'col');
    trh.appendChild(thEstado);
    var thAcc = ctx.texto('th', 'Acciones');
    thAcc.setAttribute('scope', 'col');
    trh.appendChild(thAcc);
    thead.appendChild(trh);
    t.appendChild(thead);

    var tbody = ctx.texto('tbody');
    filas.forEach(function (caso, i) {
      var indiceGlobal = desplazamiento + i;
      var tr = ctx.texto('tr');
      tr.tabIndex = 0;
      tr.setAttribute('data-indice', String(indiceGlobal));
      if (indiceGlobal === vista.seleccion) tr.setAttribute('aria-selected', 'true');
      CONST.COLUMNAS_TABLA.forEach(function (col) {
        tr.appendChild(ctx.texto('td', caso[col] === undefined || caso[col] === '' ? '—' : caso[col]));
      });
      var tdEstado = ctx.texto('td');
      var etiqueta = ctx.texto('span', String(caso.status || '—'),
        'etiqueta ' + (N.estaAbierto(caso) ? 'etiqueta-abierto' : 'etiqueta-cerrado'));
      tdEstado.appendChild(etiqueta);
      tr.appendChild(tdEstado);
      var tdAcc = ctx.texto('td');
      tdAcc.appendChild(ctx.boton('Ver detalle', 'boton-pequeno', function () {
        vista.seleccion = indiceGlobal;
        abrirDetalle(ctx, caso);
      }));
      tr.appendChild(tdAcc);
      tr.addEventListener('click', function () {
        vista.seleccion = indiceGlobal;
        pintar();
      });
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          vista.seleccion = indiceGlobal;
          abrirDetalle(ctx, caso);
        } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          var destino = ev.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
          if (destino && destino.tabIndex === 0) destino.focus();
        }
      });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    caja.appendChild(t);
    return caja;
  }

  // ------------------------------------------------------------------
  // Flotante de detalle (CU-11, RF-22)
  // ------------------------------------------------------------------
  var SECCIONES = [
    { titulo: 'Abonado y contacto', campos: ['persona_reporta', 'contacto', 'nombre', 'direccion', 'telefono'] },
    { titulo: 'Red y planta externa', campos: ['olt', 'plan', 'slot', 'puerto', 'fat', 'serial', 'extra', 'ups'] },
    { titulo: 'Diagnóstico', campos: ['ultimo_comentario', 'problema_reporte', 'informacion_1', 'informacion_2', 'codigos_sin_gestion_en_VENAPP'] },
    { titulo: 'Clasificación', campos: ['clase', 'nivel', 'tipo_abonado', 'sector'] },
    { titulo: 'Gestión', campos: ['status', 'resolucion', 'fechaResolucion', 'observaciones', 'sacas'] }
  ];

  function abrirDetalle(ctx, caso) {
    var dialogo = document.getElementById('flotante-caso');
    if (dialogo) dialogo.parentNode.removeChild(dialogo);

    dialogo = document.createElement('dialog');
    dialogo.id = 'flotante-caso';
    dialogo.className = 'flotante';
    dialogo.setAttribute('aria-labelledby', 'flotante-titulo');

    var cabecera = ctx.texto('div', null, 'flotante-cabecera');
    var titulo = ctx.texto('h2', String(caso.id_averia || '') + ' — ' + (caso.nombre || 'sin nombre'));
    titulo.id = 'flotante-titulo';
    cabecera.appendChild(titulo);
    var cerrar = ctx.boton('Cerrar (Esc)', null, function () { cerrarDetalle(dialogo); });
    cabecera.appendChild(cerrar);
    dialogo.appendChild(cabecera);

    var cuerpo = ctx.texto('div', null, 'flotante-cuerpo');
    cuerpo.appendChild(ctx.texto('p', 'Resumen: ' + CONST.COLUMNAS_TABLA.map(function (c) {
      return c + '=' + (caso[c] || '—');
    }).join(' · ')));

    SECCIONES.forEach(function (s) {
      var sec = ctx.texto('section');
      sec.appendChild(ctx.texto('h3', s.titulo));
      var dl = ctx.texto('dl', null, 'lista-datos');
      s.campos.forEach(function (campo) {
        var div = ctx.texto('div');
        div.appendChild(ctx.texto('dt', campo + ':'));
        div.appendChild(ctx.texto('dd', caso[campo] === undefined || caso[campo] === '' ? '—' : String(caso[campo])));
        dl.appendChild(div);
      });
      sec.appendChild(dl);
      cuerpo.appendChild(sec);
    });

    cuerpo.appendChild(seccionEdicion(ctx, caso, dialogo));
    cuerpo.appendChild(seccionCierre(ctx, caso, dialogo));
    cuerpo.appendChild(seccionAuditoria(ctx, caso));
    dialogo.appendChild(cuerpo);
    document.body.appendChild(dialogo);
    if (typeof dialogo.showModal === 'function') dialogo.showModal(); else dialogo.setAttribute('open', 'open');
    cerrar.focus();
  }

  function cerrarDetalle(dialogo) {
    if (typeof dialogo.close === 'function') dialogo.close();
    if (dialogo.parentNode) dialogo.parentNode.removeChild(dialogo);
  }

  function indiceDeCaso(ctx, caso) {
    var lista = ctx.almacen.datos['averias.json'] || [];
    for (var i = 0; i < lista.length; i++) {
      if (String(lista[i].id_averia || '') === String(caso.id_averia || '')) return i;
    }
    return -1;
  }

  // ------------------------------------------------------------------
  // Edición en línea y guardado con historial (RF-24, D-42, D-56)
  // ------------------------------------------------------------------
  function seccionEdicion(ctx, caso, dialogo) {
    var sec = ctx.texto('section');
    sec.appendChild(ctx.texto('h3', 'Edición manual de clasificación (RF-23, RF-28)'));
    var puede = ctx.autorizar('casos.editar', caso);
    if (!puede) {
      sec.appendChild(ctx.texto('p', 'Sin permiso para editar este caso: ' +
        (ctx.ambito.rol === 'Supervisor' ? CONST.MSG.ROL : (ctx.ambito.soloLectura ? CONST.MSG.SIN_CUADRILLA : CONST.MSG.OTRA_CUADRILLA)) + '.', 'aviso aviso-alerta'));
      return sec;
    }
    var rejilla = ctx.texto('div', null, 'rejilla');
    var sClase = ctx.seleccion(CONST.CLASE.map(function (c) { return { valor: c, etiqueta: c }; }), caso.clase);
    sClase.id = 'edit-clase';
    var sNivel = ctx.seleccion(CONST.NIVEL.map(function (n) { return { valor: n, etiqueta: n }; }), caso.nivel);
    sNivel.id = 'edit-nivel';
    var sTipo = ctx.seleccion([{ valor: '', etiqueta: '— sin informar —' }].concat(CONST.TIPO_ABONADO.map(function (t) {
      return { valor: t, etiqueta: t };
    })), caso.tipo_abonado);
    sTipo.id = 'edit-tipo';
    rejilla.appendChild(ctx.campo('Clase', sClase));
    rejilla.appendChild(ctx.campo('Nivel', sNivel));
    rejilla.appendChild(ctx.campo('Tipo de abonado', sTipo));
    sec.appendChild(rejilla);

    var msg = ctx.texto('p', null, 'mensaje');
    msg.setAttribute('role', 'alert');
    sec.appendChild(ctx.boton('Guardar cambios de clasificación', 'boton-primario', function () {
      var cambios = { clase: sClase.value, nivel: sNivel.value, tipo_abonado: sTipo.value };
      var validacion = N.validarEdicionCaso(cambios);
      if (!validacion.valido) { msg.textContent = validacion.errores.join(' · '); return; }
      msg.textContent = '';
      guardarCambiosCaso(ctx, caso, cambios, 'edicion', 'Caso ' + caso.id_averia + ' actualizado', function () {
        cerrarDetalle(dialogo);
        pintar();
      });
    }));
    sec.appendChild(msg);
    return sec;
  }

  /**
   * Guarda un cambio del maestro: escritura verificada (D-42), auditoría del
   * último cambio (D-16) y línea(s) al historial inmutable (D-56).
   */
  function guardarCambiosCaso(ctx, caso, cambios, accion, mensaje, alTerminar, opciones) {
    var opts = opciones || {};
    var indice = indiceDeCaso(ctx, caso);
    if (indice < 0) {
      ctx.avisar('El caso ' + caso.id_averia + ' ya no está en el maestro: recargue los datos.', 'aviso-error', { temporal: false });
      return Promise.resolve(false);
    }
    var anterior = ctx.almacen.datos['averias.json'][indice];
    var nuevo = Object.assign({}, anterior, cambios);
    var marca = N.marcaAhora();
    nuevo.usuario_modificacion = ctx.sesion.P00;
    nuevo.fecha_modificacion = marca;

    var campos = opts.campos || Object.keys(cambios);
    var lineas = N.lineasDeCambio(anterior, nuevo, {
      fecha_hora: marca,
      operador: ctx.sesion.P00,
      id_averia: String(caso.id_averia || ''),
      accion: accion,
      campos: campos
    });
    var lista = ctx.almacen.datos['averias.json'].slice();
    lista[indice] = nuevo;

    var ejecutar = function (sobrescribir) {
      if (ctx.modoDescarga()) {
        return ctx.descargarArchivo('averias.json', lista).then(function () {
          ctx.avisar('Modo descarga: se descargó averias.json con el cambio. Reemplácelo en C:\\GGTO\\datos al terminar.', 'aviso-alerta');
          if (alTerminar) alTerminar();
          return true;
        });
      }
      return ctx.almacen.guardarArchivo('averias.json', lista, { sobrescribir: !!sobrescribir }).then(function () {
        return ctx.almacen.agregarHistorial(lineas);
      }).then(function (r) {
        ctx.registrarLog('casos | ' + accion + ' | ' + caso.id_averia + ' | p00=' + ctx.sesion.P00 +
          ' | campos=' + campos.join(',') + ' | lineas_historial=' + (r ? r.agregadas : 0));
        ctx.avisar((mensaje || 'Caso actualizado') + ' · escritura verificada y ' + (r ? r.agregadas : 0) +
          ' línea(s) añadida(s) al historial', 'aviso-info');
        if (alTerminar) alTerminar();
        return true;
      });
    };

    return ejecutar(false).catch(function (e) {
      if (e && e.tipo === 'conflicto') {
        ctx.manejarConflicto('averias.json', lista, function () { return ejecutar(true); }, e);
        return false;
      }
      if (e && e.tipo === 'restaurado') {
        ctx.avisar(e.message, 'aviso-error', { temporal: false });
        return false;
      }
      ctx.avisar('No se guardó el cambio: ' + A.errorDe(e), 'aviso-error', { temporal: false });
      if (ctx.ambito) pintar();
      return false;
    });
  }

  // ------------------------------------------------------------------
  // Cierre bloqueante (CU-12, D-20) y reapertura
  // ------------------------------------------------------------------
  function seccionCierre(ctx, caso, dialogo) {
    var sec = ctx.texto('section');
    sec.appendChild(ctx.texto('h3', 'Cierre del caso (RF-22, D-20, RNF-10)'));
    var abierto = N.estaAbierto(caso);
    var puede = ctx.autorizar('casos.cerrar', caso);

    if (!abierto) {
      sec.appendChild(ctx.texto('p', 'Caso cerrado el ' + (caso.fechaResolucion || '—') +
        ' con resolución ' + (caso.resolucion || '—') + '. El botón CERRAR CASO queda deshabilitado.'));
      var bReabrir = ctx.boton('Reabrir caso', null, function () {
        if (!puede) { ctx.avisoGlobal(ctx.ambito.soloLectura ? CONST.MSG.SIN_CUADRILLA : CONST.MSG.OTRA_CUADRILLA); return; }
        if (!raiz.confirm('¿Reabrir el caso ' + caso.id_averia + '? Pasará a status GESTION y se conservará el cierre anterior en observaciones.')) return;
        var nota = 'Reapertura ' + N.marcaAhora() + ' por ' + ctx.sesion.P00 +
          ' (cierre anterior: ' + (caso.resolucion || '—') + ' del ' + (caso.fechaResolucion || '—') + ')';
        var obs = (caso.observaciones ? caso.observaciones + ' | ' : '') + nota;
        guardarCambiosCaso(ctx, caso, { status: 'GESTION', observaciones: obs }, 'reapertura',
          'Caso ' + caso.id_averia + ' reabierto', function () { cerrarDetalle(dialogo); pintar(); },
          { campos: ['status', 'observaciones'] });
      });
      if (!puede) bReabrir.disabled = true;
      sec.appendChild(bReabrir);
      return sec;
    }

    if (!puede) {
      sec.appendChild(ctx.texto('p', 'No puede cerrar este caso: ' +
        (ctx.ambito.soloLectura ? CONST.MSG.SIN_CUADRILLA : CONST.MSG.OTRA_CUADRILLA) + '.', 'aviso aviso-alerta'));
      var bBloqueado = ctx.boton('CERRAR CASO', 'boton-primario', function () {});
      bBloqueado.disabled = true;
      sec.appendChild(bBloqueado);
      return sec;
    }

    var rejilla = ctx.texto('div', null, 'rejilla');
    var sResolucion = ctx.seleccion([{ valor: '', etiqueta: '— seleccione —' }].concat(CONST.RESOLUCION.map(function (r) {
      return { valor: r, etiqueta: r };
    })), caso.resolucion);
    sResolucion.id = 'cierre-resolucion';
    var iFecha = ctx.entrada('text', N.formatearFecha(new Date()), { placeholder: 'DD/MM/AAAA' });
    iFecha.id = 'cierre-fecha';
    var sSacas = ctx.seleccion([{ valor: '', etiqueta: '— sin informar —' }, { valor: 'SI', etiqueta: 'SI' }, { valor: 'NO', etiqueta: 'NO' }], caso.sacas);
    sSacas.id = 'cierre-sacas';
    var iObs = document.createElement('textarea');
    iObs.id = 'cierre-observaciones';
    iObs.rows = 3;
    iObs.maxLength = 500;
    iObs.value = caso.observaciones || '';
    rejilla.appendChild(ctx.campo('Resolución (obligatoria)', sResolucion));
    rejilla.appendChild(ctx.campo('Fecha de resolución (obligatoria)', iFecha, 'Formato DD/MM/AAAA con fecha real.'));
    rejilla.appendChild(ctx.campo('Sacas', sSacas));
    rejilla.appendChild(ctx.campo('Observaciones (máx. 500)', iObs, null, 'ancho'));
    sec.appendChild(rejilla);

    var msg = ctx.texto('p', null, 'mensaje');
    msg.setAttribute('role', 'alert');
    sec.appendChild(msg);

    var confirmar = ctx.boton('Confirmar cierre', 'boton-primario', function () {
      var datos = {
        resolucion: sResolucion.value,
        fechaResolucion: iFecha.value,
        sacas: sSacas.value,
        observaciones: iObs.value,
        sector: caso.sector
      };
      var validacion = N.validarCierre(datos, { sectores: ctx.almacen.datos['sectores.json'] || [] });
      if (!validacion.valido) {
        msg.textContent = validacion.errores.join(' · ');
        return;
      }
      msg.textContent = '';
      var cambios = {
        status: 'CERRADO',
        resolucion: datos.resolucion,
        fechaResolucion: datos.fechaResolucion,
        observaciones: datos.observaciones,
        sacas: datos.sacas
      };
      guardarCambiosCaso(ctx, caso, cambios, 'cierre',
        'Caso ' + caso.id_averia + ' cerrado con resolución ' + datos.resolucion,
        function () { cerrarDetalle(dialogo); pintar(); },
        { campos: ['status', 'resolucion', 'fechaResolucion', 'observaciones', 'sacas'] });
    });
    sec.appendChild(confirmar);

    function revisarBoton() {
      var v = N.validarCierre({
        resolucion: sResolucion.value, fechaResolucion: iFecha.value, sacas: sSacas.value,
        observaciones: iObs.value, sector: caso.sector
      }, { sectores: ctx.almacen.datos['sectores.json'] || [] });
      confirmar.disabled = !v.valido;
    }
    [sResolucion, iFecha, sSacas, iObs].forEach(function (el) { el.addEventListener('input', revisarBoton); });
    revisarBoton();
    return sec;
  }

  // ------------------------------------------------------------------
  // Auditoría (CU-15, D-56, D-53)
  // ------------------------------------------------------------------
  function seccionAuditoria(ctx, caso) {
    var sec = ctx.texto('section');
    sec.appendChild(ctx.texto('h3', 'Auditoría de cambios (CU-15, D-56)'));
    if (!N.permite(ctx.sesion.rol, 'casos.auditoria')) {
      sec.appendChild(ctx.texto('p', 'La consulta de auditoría es exclusiva del supervisor: ' + CONST.MSG.ROL + '.', 'aviso aviso-alerta'));
      return sec;
    }
    var caja = ctx.texto('div');
    caja.id = 'auditoria-caso';
    var b = ctx.boton('Ver auditoría', null, function () {
      ctx.limpiar(caja);
      caja.appendChild(construirAuditoria(ctx, caso));
    });
    sec.appendChild(b);
    sec.appendChild(caja);
    return sec;
  }

  function construirAuditoria(ctx, caso) {
    var caja = ctx.texto('div');
    caja.appendChild(ctx.texto('p', 'Último cambio en el maestro: usuario_modificacion = ' +
      (caso.usuario_modificacion || '—') + ' · fecha_modificacion = ' + (caso.fecha_modificacion || '—')));
    caja.appendChild(ctx.texto('p', 'Origen del dato: ' + (caso.usuario_modificacion || '—') +
      ' (rastro limitado a la columna 20 del CSV, D-52/D-53: las columnas 53 y 80 no se persisten ni se muestran).'));

    var textoHistorial = ctx.almacen.historialTexto;
    if (textoHistorial === null || textoHistorial === undefined || textoHistorial === '') {
      caja.appendChild(ctx.texto('p', 'Historial no disponible para ' + caso.id_averia +
        ': falta C:\\GGTO\\datos\\historial.jsonl o todavía no tiene líneas. No se inventa ninguna fila.'));
      return caja;
    }
    var leido = N.historialDeCaso(textoHistorial, caso.id_averia);
    if (leido.corruptas) {
      caja.appendChild(ctx.texto('p', leido.corruptas + ' línea(s) del historial no se pudieron leer ' +
        'y se omiten de la vista; las líneas válidas se conservan íntegras.', 'aviso aviso-alerta'));
    }
    if (!leido.filas.length) {
      caja.appendChild(ctx.texto('p', 'Sin cambios registrados para este caso.'));
      return caja;
    }
    caja.appendChild(tablaAuditoria(ctx, leido.filas));

    var rejilla = ctx.texto('div', null, 'rejilla');
    var iOperador = ctx.entrada('text', '');
    iOperador.id = 'aud-operador';
    var iDesde = ctx.entrada('text', '', { placeholder: 'DD/MM/AAAA' });
    iDesde.id = 'aud-desde';
    var iHasta = ctx.entrada('text', '', { placeholder: 'DD/MM/AAAA' });
    iHasta.id = 'aud-hasta';
    rejilla.appendChild(ctx.campo('Filtrar por operador', iOperador));
    rejilla.appendChild(ctx.campo('Desde (texto DD/MM/AAAA)', iDesde));
    rejilla.appendChild(ctx.campo('Hasta (texto DD/MM/AAAA)', iHasta));
    caja.appendChild(rejilla);
    var resultados = ctx.texto('div');
    caja.appendChild(ctx.boton('Aplicar filtro', null, function () {
      ctx.limpiar(resultados);
      var op = String(iOperador.value || '').trim();
      var desde = String(iDesde.value || '').trim();
      var hasta = String(iHasta.value || '').trim();
      var filtradas = leido.filas.filter(function (f) {
        var fecha = String(f.fecha_hora || '').slice(0, 10);
        if (op && String(f.operador || '') !== op) return false;
        // Comparación de texto en formato fijo DD/MM/AAAA, nunca un rango calculado (H-29).
        if (desde && N.compararTexto(fecha.split('/').reverse().join(''), desde.split('/').reverse().join('')) < 0) return false;
        if (hasta && N.compararTexto(fecha.split('/').reverse().join(''), hasta.split('/').reverse().join('')) > 0) return false;
        return true;
      });
      resultados.appendChild(ctx.texto('p', filtradas.length + ' fila(s) del historial para el filtro aplicado.'));
      resultados.appendChild(tablaAuditoria(ctx, filtradas));
    }));
    caja.appendChild(resultados);
    return caja;
  }

  function tablaAuditoria(ctx, filas) {
    var caja = ctx.texto('div', null, 'tabla-caja');
    var t = ctx.texto('table', null, 'tabla');
    var thead = ctx.texto('thead');
    var trh = ctx.texto('tr');
    ['Fecha y hora', 'Operador', 'Campo', 'Valor anterior', 'Valor nuevo', 'Acción'].forEach(function (c) {
      var th = ctx.texto('th', c);
      th.setAttribute('scope', 'col');
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    t.appendChild(thead);
    var tbody = ctx.texto('tbody');
    if (!filas.length) {
      var trv = ctx.texto('tr', null, 'fila-vacia');
      var tdv = ctx.texto('td', 'Sin líneas para mostrar.');
      tdv.colSpan = 6;
      trv.appendChild(tdv);
      tbody.appendChild(trv);
    }
    filas.forEach(function (f) {
      var tr = ctx.texto('tr');
      [f.fecha_hora, f.operador, f.campo, f.valor_anterior, f.valor_nuevo, f.accion].forEach(function (v) {
        tr.appendChild(ctx.texto('td', v === undefined || v === '' ? '—' : String(v)));
      });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    caja.appendChild(t);
    return caja;
  }

  raiz.GGTO_CASOS = {
    ciclo: 'C1',
    requisitos: 'RF-07, RF-21 a RF-24, RF-28',
    render: render,
    seccionesDetalle: SECCIONES,
    _vista: vista
  };
})(window);
