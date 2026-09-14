/*
 * GGTO-v1 - panel.js
 * Ciclo C3. PANEL de la central:
 *   - Busqueda de un caso por id_averia o por telefono (CU-11, RF-02).
 *   - Actualizacion de la gestion: status, resolucion, fechaResolucion,
 *     observaciones y sacas, con cierre bloqueante (CU-12, RF-03, D-20).
 *   - Alta manual con lista CERRADA de campos e id_averia MAN- (CU-14, RF-04,
 *     D-18, D-62).
 * Toda escritura pasa por el protocolo verificado de C1 (D-41, D-42) y deja su
 * linea en el historial inmutable (D-56).
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var A = raiz.GGTO_ALMACEN;

  // ------------------------------------------------------------------ puros

  /** Campos de la lista cerrada del alta manual (D-18, D-47). */
  function camposAlta() {
    return [
      { campo: 'fecha_reporte', etiqueta: 'Fecha del caso (DD/MM/AAAA)', obligatorio: true, tipo: 'fecha' },
      { campo: 'telefono', etiqueta: 'Teléfono', obligatorio: true, tipo: 'texto' },
      { campo: 'nombre', etiqueta: 'Nombre del abonado', obligatorio: true, tipo: 'texto' },
      { campo: 'direccion', etiqueta: 'Dirección', obligatorio: true, tipo: 'texto' },
      { campo: 'contacto', etiqueta: 'Contacto', obligatorio: false, tipo: 'texto' },
      { campo: 'problema_reporte', etiqueta: 'Problema reportado', obligatorio: true, tipo: 'texto' },
      { campo: 'sector', etiqueta: 'Sector', obligatorio: false, tipo: 'sector' },
      { campo: 'clase', etiqueta: 'Clase (REP/CNS)', obligatorio: false, tipo: 'lista', valores: ['REP', 'CNS'], porDefecto: 'REP' },
      { campo: 'nivel', etiqueta: 'Nivel (COM/REF)', obligatorio: false, tipo: 'lista', valores: ['COM', 'REF'], porDefecto: 'COM' },
      { campo: 'tipo_abonado', etiqueta: 'Tipo de abonado (RES/EMP)', obligatorio: false, tipo: 'lista', valores: ['RES', 'EMP'], porDefecto: 'RES' },
      { campo: 'observaciones', etiqueta: 'Observaciones', obligatorio: false, tipo: 'texto' }
    ];
  }

  /** Busca por id_averia exacto o por telefono (CU-11, RF-02). */
  function buscarCaso(casos, criterio) {
    var c = String(criterio === null || criterio === undefined ? '' : criterio).trim();
    if (c === '') return { encontrado: false, motivo: 'Indique el id de avería o el teléfono' };
    var lista = casos || [];
    var digitos = c.replace(/\D/g, '');
    var porId = null;
    var porTelefono = [];
    for (var i = 0; i < lista.length; i++) {
      var caso = lista[i] || {};
      if (String(caso.id_averia || '') === c && !porId) porId = { indice: i, caso: caso };
      var tel = String(caso.telefono || '').replace(/\D/g, '');
      if (tel !== '' && digitos !== '' && tel === digitos) porTelefono.push({ indice: i, caso: caso });
    }
    if (porId) {
      return { encontrado: true, criterio: 'id_averia', indice: porId.indice, caso: porId.caso, coincidencias: [porId] };
    }
    if (porTelefono.length > 0) {
      return {
        encontrado: true,
        criterio: 'telefono',
        indice: porTelefono[0].indice,
        caso: porTelefono[0].caso,
        coincidencias: porTelefono,
        multiple: porTelefono.length > 1
      };
    }
    return { encontrado: false, motivo: 'No hay ningún caso con ese id de avería ni con ese teléfono' };
  }

  /** Siguiente id_averia libre con prefijo MAN- (D-18). */
  function siguienteIdManual(casos) {
    var usados = {};
    (casos || []).forEach(function (c) {
      var id = String((c || {}).id_averia || '');
      var m = /^MAN-(\d+)$/.exec(id);
      if (m) usados[parseInt(m[1], 10)] = true;
    });
    var n = 1;
    while (usados[n]) n++;
    var relleno = String(n);
    while (relleno.length < 4) relleno = '0' + relleno;
    return 'MAN-' + relleno;
  }

  /**
   * Valida el alta manual y devuelve el registro completo del maestro.
   * `opciones`: { hoy, marca, operador, sectores, clase, nivel, tipo_abonado }
   */
  function validarAltaManual(datos, opciones) {
    var opts = opciones || {};
    var d = datos || {};
    var errores = [];
    var campos = {};

    camposAlta().forEach(function (def) {
      var valor = d[def.campo];
      var vacio = !N.obligatorio(valor);
      if (def.obligatorio && vacio) {
        errores.push('Falta: ' + def.etiqueta);
        campos[def.campo] = 'Falta: ' + def.etiqueta;
      }
    });

    if (N.obligatorio(d.telefono) && !N.telefonoValido(d.telefono)) {
      errores.push('Teléfono inválido: use entre 7 y 15 dígitos');
      campos.telefono = 'Teléfono inválido';
    }
    if (N.obligatorio(d.fecha_reporte) && !N.esFechaValida(String(d.fecha_reporte).trim())) {
      errores.push(N.CONST.MSG.FECHA_INVALIDA);
      campos.fecha_reporte = N.CONST.MSG.FECHA_INVALIDA;
    }
    var edicion = N.validarEdicionCaso({
      clase: d.clase === '' || d.clase === undefined ? opts.clase || 'REP' : d.clase,
      nivel: d.nivel === '' || d.nivel === undefined ? opts.nivel || 'COM' : d.nivel,
      tipo_abonado: d.tipo_abonado === '' || d.tipo_abonado === undefined ? opts.tipo_abonado || 'RES' : d.tipo_abonado
    });
    if (!edicion.valido) {
      edicion.errores.forEach(function (e) { errores.push(e); });
      Object.keys(edicion.campos).forEach(function (k) { campos[k] = edicion.campos[k]; });
    }
    var sector = String(d.sector === null || d.sector === undefined ? '' : d.sector).trim();
    if (sector !== '') {
      var existe = (opts.sectores || []).some(function (s) { return String((s || {}).id) === sector; });
      if (!existe) {
        errores.push(N.CONST.MSG.SECTOR_INEXISTENTE);
        campos.sector = N.CONST.MSG.SECTOR_INEXISTENTE;
      }
    }

    var hoy = opts.hoy || String(N.marcaAhora()).split(' ')[0];
    var marca = opts.marca || N.marcaAhora();
    var telefono = String(d.telefono || '').trim();
    var registro = {
      ingreso: hoy,
      nivel: String(d.nivel || opts.nivel || 'COM').trim(),
      clase: String(d.clase || opts.clase || 'REP').trim(),
      sector: sector,
      'Reparador Principal': String(opts.cuadrilla || '').trim(),
      id_averia: String(d.id_averia || '').trim(),
      telefono: telefono,
      persona_reporta: String(d.persona_reporta || '').trim(),
      contacto: String(d.contacto || '').trim(),
      ultimo_comentario: '',
      problema_reporte: String(d.problema_reporte || '').trim(),
      informacion_1: String(d.informacion_1 || '').trim(),
      informacion_2: String(d.informacion_2 || '').trim(),
      nombre: String(d.nombre || '').trim(),
      direccion: String(d.direccion || '').trim(),
      olt: '',
      plan: '',
      slot: '',
      puerto: '',
      fat: '',
      serial: '',
      extra: '',
      ups: String(d.tipo_abonado || opts.tipo_abonado || 'RES').trim() === 'EMP' ? 'NRES' : 'RES',
      codigos_sin_gestion_en_VENAPP: '',
      status: 'PEND',
      resolucion: '',
      fechaResolucion: '',
      observaciones: String(d.observaciones || '').trim(),
      sacas: '',
      tipo_abonado: String(d.tipo_abonado || opts.tipo_abonado || 'RES').trim(),
      fecha_reporte: String(d.fecha_reporte || hoy).trim(),
      fecha_reporte_original: String(d.fecha_reporte || hoy).trim(),
      fecha_cita: '',
      fecha_asignacion: String(opts.cuadrilla || '').trim() === '' ? '' : hoy,
      usuario_modificacion: String(opts.operador || '').trim(),
      fecha_modificacion: marca
    };

    return { valido: errores.length === 0, errores: errores, campos: campos, registro: registro };
  }

  /** Aplica una actualizacion de gestion sobre un caso (CU-12, RF-03). */
  function aplicarGestion(caso, datos, opciones) {
    var opts = opciones || {};
    var original = caso || {};
    var d = datos || {};
    var nuevo = {};
    Object.keys(original).forEach(function (k) { nuevo[k] = original[k]; });

    var status = String(d.status === undefined ? original.status : d.status).trim() || 'PEND';
    if (!N.esEnum(status, N.CONST.STATUS)) {
      return { valido: false, errores: ['Estatus inválido: use PEND, GESTION o CERRADO'], campos: { status: 'inválido' } };
    }
    nuevo.status = status;
    nuevo.resolucion = String(d.resolucion === undefined ? original.resolucion : d.resolucion || '').trim();
    nuevo.fechaResolucion = String(d.fechaResolucion === undefined ? original.fechaResolucion : d.fechaResolucion || '').trim();
    nuevo.observaciones = String(d.observaciones === undefined ? original.observaciones : d.observaciones || '').trim();
    nuevo.sacas = String(d.sacas === undefined ? original.sacas : d.sacas || '').trim();

    if (status === 'CERRADO') {
      var cierre = N.validarCierre({
        resolucion: nuevo.resolucion,
        fechaResolucion: nuevo.fechaResolucion,
        sacas: nuevo.sacas,
        observaciones: nuevo.observaciones,
        sector: nuevo.sector
      }, { sectores: opts.sectores || [] });
      if (!cierre.valido) return { valido: false, errores: cierre.errores, campos: cierre.campos };
    } else if (nuevo.sacas !== '' && !N.esEnum(nuevo.sacas, N.CONST.SACAS)) {
      return { valido: false, errores: [N.CONST.MSG.SACAS_INVALIDO], campos: { sacas: N.CONST.MSG.SACAS_INVALIDO } };
    }

    nuevo.usuario_modificacion = String(opts.operador || '').trim();
    nuevo.fecha_modificacion = opts.marca || N.marcaAhora();
    return { valido: true, errores: [], caso: nuevo, accion: status === 'CERRADO' ? 'cierre' : 'edicion' };
  }

  // -------------------------------------------------------------------- UI

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    if (!ctx.sesion) {
      contenedor.appendChild(ctx.texto('p', 'Identifíquese para usar el PANEL.', 'aviso aviso-alerta'));
      return;
    }
    var maestrovacio = !(ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || []).length;

    var seccion = ctx.texto('section', null, 'panel');
    seccion.appendChild(ctx.texto('h2', 'PANEL'));
    seccion.appendChild(ctx.texto('p',
      'Casos en el maestro: ' + (ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || []).length +
      ' · Rol: ' + (ctx.ambito.rol || 'sin sesión') +
      (ctx.ambito.cuadrilla ? ' · Cuadrilla: ' + ctx.ambito.cuadrilla : ''),
      'resumen-linea'));

    // --- tarjeta 1: buscar ------------------------------------------------
    var buscar = ctx.texto('div', null, 'bloque');
    buscar.appendChild(ctx.texto('h3', '1. Buscar un caso'));
    var entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.id = 'panel-criterio';
    entrada.placeholder = 'id de avería o teléfono';
    var etiqueta = document.createElement('label');
    etiqueta.setAttribute('for', 'panel-criterio');
    etiqueta.textContent = 'Id de avería (por ejemplo 90000001) o teléfono';
    buscar.appendChild(etiqueta);
    buscar.appendChild(entrada);
    var zona = ctx.texto('div', null, 'zona-panel');
    buscar.appendChild(ctx.boton('Buscar', 'boton-primario', function () {
      var r = buscarCaso(ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || [], entrada.value);
      pintarFicha(ctx, zona, r);
    }));
    seccion.appendChild(buscar);
    seccion.appendChild(zona);

    // --- tarjeta 2: alta manual ------------------------------------------
    var alta = ctx.texto('div', null, 'bloque');
    alta.appendChild(ctx.texto('h3', '2. Alta manual de un caso'));
    var permisoAlta = N.autorizar(ctx.ambito, 'casos.alta');
    if (!permisoAlta.permitido) {
      alta.appendChild(ctx.texto('p', permisoAlta.mensaje, 'aviso aviso-error'));
    } else {
      var campos = {};
      var idSugerido = siguienteIdManual(ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || []);
      alta.appendChild(ctx.texto('p', 'El id de avería se generará automáticamente: ' + idSugerido +
        ' (D-18). Los campos marcados con * son obligatorios.', 'resumen-linea'));
      camposAlta().forEach(function (def) {
        var lab = document.createElement('label');
        lab.setAttribute('for', 'alta-' + def.campo);
        lab.textContent = def.etiqueta + (def.obligatorio ? ' *' : '');
        var ctrl;
        if (def.tipo === 'lista') {
          ctrl = document.createElement('select');
          def.valores.forEach(function (v) {
            var o = document.createElement('option');
            o.value = v; o.textContent = v;
            if (v === def.porDefecto) o.selected = true;
            ctrl.appendChild(o);
          });
        } else if (def.tipo === 'sector') {
          ctrl = document.createElement('select');
          var vacio = document.createElement('option');
          vacio.value = ''; vacio.textContent = '(sin sector: queda en la cola de CU-09)';
          ctrl.appendChild(vacio);
          (ctx.almacen.datos['sectores.json'] || []).forEach(function (s) {
            var o = document.createElement('option');
            o.value = String(s.id); o.textContent = s.nombre + ' (' + s.id + ')';
            ctrl.appendChild(o);
          });
        } else {
          ctrl = document.createElement('input');
          ctrl.type = def.tipo === 'fecha' ? 'text' : 'text';
          if (def.tipo === 'fecha') ctrl.placeholder = 'DD/MM/AAAA';
        }
        ctrl.id = 'alta-' + def.campo;
        ctrl.name = def.campo;
        campos[def.campo] = ctrl;
        alta.appendChild(lab);
        alta.appendChild(ctrl);
      });
      var zonaAlta = ctx.texto('div', null, 'zona-alta');
      alta.appendChild(ctx.boton('Agregar el caso', 'boton-primario', function () {
        ejecutarAlta(ctx, campos, zonaAlta);
      }));
      alta.appendChild(zonaAlta);
    }
    seccion.appendChild(alta);
    contenedor.appendChild(seccion);

    if (maestrovacio) {
      seccion.insertBefore(ctx.texto('p',
        'El maestro está vacío: puede dar de alta un caso a mano o ejecutar la ingesta del CSV (C2).',
        'aviso aviso-info'), seccion.firstChild.nextSibling);
    }
  }

  function pintarFicha(ctx, zona, r) {
    ctx.limpiar(zona);
    if (!r.encontrado) {
      zona.appendChild(ctx.texto('p', r.motivo, 'aviso aviso-alerta'));
      return;
    }
    if (r.multiple) {
      zona.appendChild(ctx.texto('p', 'El teléfono aparece en ' + r.coincidencias.length +
        ' casos: se muestra el primero.', 'aviso aviso-info'));
    }
    var caso = r.caso;
    var autorizado = N.autorizar(ctx.ambito, 'casos.consultar', caso);
    if (!autorizado.permitido) {
      zona.appendChild(ctx.texto('p', autorizado.mensaje, 'aviso aviso-error'));
      return;
    }
    var tabla = ctx.texto('table', null, 'tabla');
    var tbody = ctx.texto('tbody');
    [
      ['Id de avería', caso.id_averia], ['Nivel', caso.nivel], ['Clase', caso.clase],
      ['Sector', caso.sector], ['Nombre', caso.nombre], ['Dirección', caso.direccion],
      ['Teléfono', caso.telefono], ['Plan', caso.plan], ['FAT', caso.fat], ['Serial', caso.serial],
      ['Estatus', caso.status], ['Resolución', caso.resolucion], ['Fecha de resolución', caso.fechaResolucion],
      ['Ingreso', caso.ingreso], ['Tipo de abonado', caso.tipo_abonado],
      ['Cuadrilla', caso['Reparador Principal']], ['Observaciones', caso.observaciones]
    ].forEach(function (f) {
      var tr = ctx.texto('tr');
      tr.appendChild(ctx.texto('th', f[0]));
      tr.appendChild(ctx.texto('td', String(f[1] === undefined || f[1] === null || f[1] === '' ? '—' : f[1])));
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
    zona.appendChild(tabla);

    var puedeCerrar = N.autorizar(ctx.ambito, 'casos.cerrar', caso);
    if (!puedeCerrar.permitido) {
      zona.appendChild(ctx.texto('p', puedeCerrar.mensaje, 'aviso aviso-error'));
      return;
    }

    // Formulario de gestión
    var caja = ctx.texto('div', null, 'bloque');
    caja.appendChild(ctx.texto('h3', '3. Actualizar la gestión'));
    var campos = {};
    ['status', 'resolucion', 'fechaResolucion', 'observaciones', 'sacas'].forEach(function (campo) {
      var lab = document.createElement('label');
      lab.setAttribute('for', 'gestion-' + campo);
      lab.textContent = campo;
      var ctrl;
      if (campo === 'status' || campo === 'resolucion' || campo === 'sacas') {
        ctrl = document.createElement('select');
        var opciones = campo === 'status' ? N.CONST.STATUS : (campo === 'resolucion' ? N.CONST.RESOLUCION : N.CONST.SACAS);
        var vacia = document.createElement('option');
        vacia.value = ''; vacia.textContent = '(sin informar)';
        if (campo !== 'status') ctrl.appendChild(vacia);
        opciones.forEach(function (v) {
          var o = document.createElement('option');
          o.value = v; o.textContent = v;
          if (String(caso[campo] || '') === v) o.selected = true;
          ctrl.appendChild(o);
        });
        if (campo === 'status' && !caso.status) ctrl.value = 'PEND';
      } else {
        ctrl = document.createElement('input');
        ctrl.type = 'text';
        ctrl.value = String(caso[campo] || '');
        if (campo === 'fechaResolucion') ctrl.placeholder = 'DD/MM/AAAA';
      }
      ctrl.id = 'gestion-' + campo;
      campos[campo] = ctrl;
      caja.appendChild(lab);
      caja.appendChild(ctrl);
    });
    var estado = ctx.texto('div', null, 'zona-gestion');
    caja.appendChild(ctx.boton('Guardar la gestión', 'boton-primario', function () {
      ejecutarGestion(ctx, caso, campos, estado);
    }));
    caja.appendChild(estado);
    zona.appendChild(caja);

    zona.appendChild(ctx.texto('p',
      'Cerrar un caso exige resolución (IVR, COS o COLA) y fecha de resolución: el guardado se bloquea si faltan (D-20, RNF-10).',
      'resumen-linea'));
  }

  function guardarMaestro(ctx, lista, lineas, mensaje, alTerminar) {
    if (ctx.modoDescarga()) {
      ctx.descargarArchivo(N.CONST.ARCHIVO_MAESTRO, lista).then(function () {
        ctx.avisar('Modo descarga: se descargó ' + N.CONST.ARCHIVO_MAESTRO +
          '. El historial no se puede escribir en este modo.', 'aviso-alerta', { temporal: false });
        if (alTerminar) alTerminar();
      });
      return;
    }
    ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_MAESTRO, lista, {}).then(function () {
      return ctx.almacen.agregarHistorial(lineas);
    }).then(function (res) {
      ctx.registrarLog('panel | ' + mensaje + ' | p00=' + ctx.sesion.P00);
      ctx.avisar(mensaje + ' · líneas de historial: ' + (res ? res.agregadas : 0), 'aviso-info');
      if (alTerminar) alTerminar();
    }).catch(function (e) {
      if (e && e.tipo === 'conflicto') {
        ctx.manejarConflicto(N.CONST.ARCHIVO_MAESTRO, lista, function () {
          return ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_MAESTRO, lista, { sobrescribir: true })
            .then(function () { return ctx.almacen.agregarHistorial(lineas); })
            .then(function () { ctx.avisar('Guardado con sobrescritura consciente.', 'aviso-info'); });
        }, e);
        return;
      }
      ctx.avisar('No se pudo guardar: ' + A.errorDe(e), 'aviso-error', { temporal: false });
    });
  }

  function ejecutarGestion(ctx, caso, campos, estado) {
    var r = aplicarGestion(caso, {
      status: campos.status.value,
      resolucion: campos.resolucion.value,
      fechaResolucion: campos.fechaResolucion.value,
      observaciones: campos.observaciones.value,
      sacas: campos.sacas.value
    }, {
      operador: ctx.sesion.P00,
      marca: N.marcaAhora(),
      sectores: ctx.almacen.datos['sectores.json'] || []
    });
    ctx.limpiar(estado);
    if (!r.valido) {
      var caja = ctx.texto('div', null, 'aviso aviso-error');
      var ul = ctx.texto('ul');
      r.errores.forEach(function (e) { ul.appendChild(ctx.texto('li', e)); });
      caja.appendChild(ul);
      estado.appendChild(caja);
      return;
    }
    var lista = (ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || []).slice();
    var indice = lista.findIndex(function (c) { return String(c.id_averia) === String(caso.id_averia); });
    if (indice < 0) { estado.appendChild(ctx.texto('p', 'El caso ya no está en el maestro.', 'aviso aviso-error')); return; }
    var camposCambiados = N.CONST.CAMPOS_HISTORIAL.concat(N.CONST.CAMPOS_CIERRE);
    var lineas = N.lineasDeCambio(lista[indice], r.caso, {
      fecha_hora: r.caso.fecha_modificacion,
      operador: ctx.sesion.P00,
      id_averia: String(caso.id_averia),
      accion: r.accion,
      campos: camposCambiados
    });
    lista[indice] = r.caso;
    guardarMaestro(ctx, lista, lineas,
      (r.accion === 'cierre' ? 'Caso cerrado ' : 'Gestión actualizada ') + caso.id_averia,
      function () { ctx.reactivarPestana(); });
  }

  function ejecutarAlta(ctx, campos, zonaAlta) {
    var datos = {};
    Object.keys(campos).forEach(function (k) { datos[k] = campos[k].value; });
    var maestro = ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || [];
    datos.id_averia = siguienteIdManual(maestro);
    var r = validarAltaManual(datos, {
      hoy: String(N.marcaAhora()).split(' ')[0],
      marca: N.marcaAhora(),
      operador: ctx.sesion.P00,
      cuadrilla: ctx.ambito.cuadrilla || '',
      sectores: ctx.almacen.datos['sectores.json'] || []
    });
    ctx.limpiar(zonaAlta);
    if (!r.valido) {
      var caja = ctx.texto('div', null, 'aviso aviso-error');
      var ul = ctx.texto('ul');
      r.errores.forEach(function (e) { ul.appendChild(ctx.texto('li', e)); });
      caja.appendChild(ul);
      zonaAlta.appendChild(caja);
      return;
    }
    if (maestro.some(function (c) { return String(c.id_averia) === r.registro.id_averia; })) {
      zonaAlta.appendChild(ctx.texto('p', 'El id ' + r.registro.id_averia + ' ya existe: vuelva a intentarlo.', 'aviso aviso-error'));
      return;
    }
    var lineas = [N.lineaHistorial({
      fecha_hora: r.registro.fecha_modificacion,
      operador: ctx.sesion.P00,
      id_averia: r.registro.id_averia,
      campo: 'status',
      valor_anterior: '',
      valor_nuevo: r.registro.status,
      accion: 'edicion'
    })];
    if (r.registro['Reparador Principal']) {
      lineas.push(N.lineaHistorial({
        fecha_hora: r.registro.fecha_modificacion,
        operador: ctx.sesion.P00,
        id_averia: r.registro.id_averia,
        campo: 'Reparador Principal',
        valor_anterior: '',
        valor_nuevo: r.registro['Reparador Principal'],
        accion: 'asignacion'
      }));
    }
    var lista = maestro.slice();
    lista.push(r.registro);
    guardarMaestro(ctx, lista, lineas, 'Caso ' + r.registro.id_averia + ' dado de alta', function () {
      ctx.reactivarPestana();
    });
  }

  var API = {
    ciclo: 'C3',
    camposAlta: camposAlta,
    buscarCaso: buscarCaso,
    siguienteIdManual: siguienteIdManual,
    validarAltaManual: validarAltaManual,
    aplicarGestion: aplicarGestion,
    render: render
  };

  raiz.GGTO_PANEL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
