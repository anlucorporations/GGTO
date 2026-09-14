/*
 * GGTO-v1 - gestion.js
 * Ciclo C3. Bandeja GESTION (CU-13, RF-15): los casos que requieren
 * verificación telefónica antes del trabajo de calle, con reclasificación
 * rápida (clase, nivel, tipo_abonado) y paso a PEND cuando se confirman.
 * Exclusiva del supervisor (matriz de permisos 'gestion.bandeja', D-35,
 * RNF-12); cada cambio deja su línea en el historial inmutable (D-56).
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var A = raiz.GGTO_ALMACEN;

  // ------------------------------------------------------------------ puros

  /** Casos en la bandeja: status = GESTION (RN-03, D-05). */
  function casosEnGestion(casos) {
    return (casos || []).filter(function (c) {
      return String((c || {}).status || '') === 'GESTION';
    });
  }

  /** Orden de la cola: por antigüedad (ingreso/fecha) o por sector. */
  function ordenarGestion(casos, criterio) {
    var lista = (casos || []).slice();
    var c = String(criterio || 'antiguedad');
    var fecha = function (caso) {
      var f = String(caso.ingreso || caso.fecha_reporte || '');
      var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f);
      return m ? m[3] + m[2] + m[1] : '99999999';
    };
    lista.sort(function (a, b) {
      if (c === 'sector') {
        var sa = String(a.sector || 'zzz');
        var sb = String(b.sector || 'zzz');
        if (sa !== sb) return sa < sb ? -1 : 1;
      }
      if (c === 'direccion') {
        var da = String(a.direccion || '');
        var db = String(b.direccion || '');
        if (da !== db) return da < db ? -1 : 1;
      }
      var fa = fecha(a);
      var fb = fecha(b);
      if (fa !== fb) return fa < fb ? -1 : 1;
      return String(a.id_averia || '') < String(b.id_averia || '') ? -1 : 1;
    });
    return lista;
  }

  /** Resumen de la bandeja para la cabecera. */
  function resumenGestion(casos) {
    var lista = casos || [];
    var porSector = {};
    var sinSector = 0;
    var empresariales = 0;
    var referidos = 0;
    lista.forEach(function (c) {
      var s = String((c || {}).sector || '');
      if (s === '') sinSector++; else porSector[s] = (porSector[s] || 0) + 1;
      if (String(c.tipo_abonado || '') === 'EMP') empresariales++;
      if (String(c.nivel || '') === 'REF') referidos++;
    });
    return {
      total: lista.length,
      porSector: porSector,
      sinSector: sinSector,
      empresariales: empresariales,
      referidos: referidos
    };
  }

  /** Reclasificación rápida (RF-07, RF-28, D-06, D-17). */
  function reclasificar(caso, cambios) {
    var original = caso || {};
    var d = cambios || {};
    var nuevo = {};
    Object.keys(original).forEach(function (k) { nuevo[k] = original[k]; });
    var clase = d.clase === undefined ? original.clase : String(d.clase).trim();
    var nivel = d.nivel === undefined ? original.nivel : String(d.nivel).trim();
    var tipo = d.tipo_abonado === undefined ? original.tipo_abonado : String(d.tipo_abonado).trim();
    var validacion = N.validarEdicionCaso({ clase: clase, nivel: nivel, tipo_abonado: tipo });
    if (!validacion.valido) return { valido: false, errores: validacion.errores, campos: validacion.campos };
    nuevo.clase = clase;
    nuevo.nivel = nivel;
    nuevo.tipo_abonado = tipo;
    if (d.pasarAPend) nuevo.status = 'PEND';
    if (d.observaciones !== undefined) nuevo.observaciones = String(d.observaciones).trim();
    return { valido: true, errores: [], caso: nuevo, campos: ['clase', 'nivel', 'tipo_abonado', 'status', 'observaciones'] };
  }

  // -------------------------------------------------------------------- UI

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    if (!ctx.sesion) {
      contenedor.appendChild(ctx.texto('p', 'Identifíquese para usar la bandeja GESTION.', 'aviso aviso-alerta'));
      return;
    }
    var permiso = N.autorizar(ctx.ambito, 'gestion.bandeja');
    if (!permiso.permitido) {
      ctx.registrarLog('gestion | DENEGADO | p00=' + (ctx.sesion.P00 || '') + ' | rol=' + (ctx.ambito.rol || ''));
      contenedor.appendChild(ctx.texto('p', permiso.mensaje, 'aviso aviso-error'));
      return;
    }

    var seccion = ctx.texto('section', null, 'gestion');
    seccion.appendChild(ctx.texto('h2', 'GESTION telefónica'));
    seccion.appendChild(ctx.texto('p',
      'Casos que necesitan verificación telefónica antes del trabajo de calle (RN-03). ' +
      'Al confirmar la clasificación, el caso pasa a PEND y entra al despacho.',
      'resumen-linea'));

    var todos = ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || [];
    var enGestion = casosEnGestion(todos);
    var resumen = resumenGestion(enGestion);
    seccion.appendChild(ctx.texto('p',
      'En bandeja: ' + resumen.total + ' · sin sector: ' + resumen.sinSector +
      ' · empresariales: ' + resumen.empresariales + ' · referidos: ' + resumen.referidos,
      'resumen-linea'));

    if (enGestion.length === 0) {
      seccion.appendChild(ctx.texto('p', N.CONST.MSG.SIN_CASOS, 'aviso aviso-info'));
      contenedor.appendChild(seccion);
      return;
    }

    var orden = 'antiguedad';
    var zona = ctx.texto('div', null, 'zona-gestion');
    var selector = document.createElement('select');
    selector.id = 'gestion-orden';
    [['antiguedad', 'Más antiguos primero'], ['sector', 'Por sector'], ['direccion', 'Por dirección']]
      .forEach(function (o) {
        var opt = document.createElement('option');
        opt.value = o[0]; opt.textContent = o[1];
        selector.appendChild(opt);
      });
    var lab = document.createElement('label');
    lab.setAttribute('for', 'gestion-orden');
    lab.textContent = 'Orden de la cola';
    seccion.appendChild(lab);
    seccion.appendChild(selector);

    function pintar() {
      ctx.limpiar(zona);
      var lista = ordenarGestion(enGestion, orden);
      var tabla = ctx.texto('table', null, 'tabla');
      var thead = ctx.texto('thead');
      var trh = ctx.texto('tr');
      ['Id', 'Ingreso', 'Teléfono', 'Nombre', 'Dirección', 'Problema', 'Tipo', 'Sector', 'Acción']
        .forEach(function (t) { trh.appendChild(ctx.texto('th', t)); });
      thead.appendChild(trh);
      tabla.appendChild(thead);
      var tbody = ctx.texto('tbody');
      lista.forEach(function (caso) {
        var tr = ctx.texto('tr');
        [caso.id_averia, caso.ingreso, caso.telefono, caso.nombre, caso.direccion,
          caso.problema_reporte, (caso.clase || '') + '/' + (caso.nivel || '') + '/' + (caso.tipo_abonado || ''),
          caso.sector || '(cola CU-09)'].forEach(function (v) {
          tr.appendChild(ctx.texto('td', String(v === undefined || v === null || v === '' ? '—' : v)));
        });
        var td = ctx.texto('td');
        td.appendChild(ctx.boton('Clasificar', 'boton-secundario', function () {
          pintarFormulario(ctx, zona, caso);
        }));
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      tabla.appendChild(tbody);
      zona.appendChild(tabla);
    }

    selector.addEventListener('change', function () { orden = selector.value; pintar(); });
    seccion.appendChild(selector ? zona : zona);
    contenedor.appendChild(seccion);
    pintar();
  }

  function pintarFormulario(ctx, zona, caso) {
    ctx.limpiar(zona);
    var caja = ctx.texto('div', null, 'bloque');
    caja.appendChild(ctx.texto('h3', 'Clasificar el caso ' + caso.id_averia));
    caja.appendChild(ctx.texto('p',
      'Guion telefónico: confirme el problema reportado, si el servicio está sin tono o sin datos, ' +
      'y si hay fibras o equipos dañados. Después clasifique y pase el caso a PEND.',
      'resumen-linea'));

    var campos = {};
    [['clase', N.CONST.CLASE, caso.clase], ['nivel', N.CONST.NIVEL, caso.nivel],
      ['tipo_abonado', N.CONST.TIPO_ABONADO, caso.tipo_abonado]].forEach(function (def) {
      var lab = document.createElement('label');
      lab.setAttribute('for', 'gest-' + def[0]);
      lab.textContent = def[0];
      var sel = document.createElement('select');
      sel.id = 'gest-' + def[0];
      def[1].forEach(function (v) {
        var o = document.createElement('option');
        o.value = v; o.textContent = v;
        if (String(def[2] || '') === v) o.selected = true;
        sel.appendChild(o);
      });
      campos[def[0]] = sel;
      caja.appendChild(lab);
      caja.appendChild(sel);
    });

    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = 'gest-pend';
    chk.checked = true;
    var labChk = document.createElement('label');
    labChk.setAttribute('for', 'gest-pend');
    labChk.textContent = 'La verificación confirma el caso: pasarlo a PEND (entra al despacho)';
    caja.appendChild(chk);
    caja.appendChild(labChk);

    var labObs = document.createElement('label');
    labObs.setAttribute('for', 'gest-obs');
    labObs.textContent = 'Observaciones de la llamada';
    var obs = document.createElement('input');
    obs.type = 'text';
    obs.id = 'gest-obs';
    obs.value = String(caso.observaciones || '');
    caja.appendChild(labObs);
    caja.appendChild(obs);

    var estado = ctx.texto('div', null, 'zona-gestion');
    caja.appendChild(ctx.boton('Guardar la clasificación', 'boton-primario', function () {
      var r = reclasificar(caso, {
        clase: campos.clase.value,
        nivel: campos.nivel.value,
        tipo_abonado: campos.tipo_abonado.value,
        pasarAPend: chk.checked,
        observaciones: obs.value
      });
      ctx.limpiar(estado);
      if (!r.valido) {
        var cajaErr = ctx.texto('div', null, 'aviso aviso-error');
        var ul = ctx.texto('ul');
        r.errores.forEach(function (e) { ul.appendChild(ctx.texto('li', e)); });
        cajaErr.appendChild(ul);
        estado.appendChild(cajaErr);
        return;
      }
      var lista = (ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || []).slice();
      var indice = lista.findIndex(function (c) { return String(c.id_averia) === String(caso.id_averia); });
      if (indice < 0) { estado.appendChild(ctx.texto('p', 'El caso ya no está en el maestro.', 'aviso aviso-error')); return; }
      r.caso.usuario_modificacion = ctx.sesion.P00;
      r.caso.fecha_modificacion = N.marcaAhora();
      var lineas = N.lineasDeCambio(lista[indice], r.caso, {
        fecha_hora: r.caso.fecha_modificacion,
        operador: ctx.sesion.P00,
        id_averia: String(caso.id_averia),
        accion: r.caso.status === 'PEND' && lista[indice].status !== 'PEND' ? 'asignacion' : 'edicion',
        campos: ['clase', 'nivel', 'tipo_abonado', 'status', 'observaciones']
      });
      lista[indice] = r.caso;
      ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_MAESTRO, lista, {}).then(function () {
        return ctx.almacen.agregarHistorial(lineas);
      }).then(function (res) {
        ctx.registrarLog('gestion | clasificado | ' + caso.id_averia + ' | p00=' + ctx.sesion.P00 +
          ' | lineas=' + (res ? res.agregadas : 0));
        ctx.avisar('Caso ' + caso.id_averia + ' clasificado' +
          (chk.checked ? ' y pasado a PEND' : '') + '.', 'aviso-info');
        ctx.reactivarPestana();
      }).catch(function (e) {
        if (e && e.tipo === 'conflicto') {
          ctx.manejarConflicto(N.CONST.ARCHIVO_MAESTRO, lista, function () {
            return ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_MAESTRO, lista, { sobrescribir: true })
              .then(function () { return ctx.almacen.agregarHistorial(lineas); })
              .then(function () { ctx.avisar('Clasificación guardada con sobrescritura consciente.', 'aviso-info'); });
          }, e);
          return;
        }
        ctx.avisar('No se pudo guardar: ' + A.errorDe(e), 'aviso-error', { temporal: false });
      });
    }));
    caja.appendChild(estado);
    zona.appendChild(caja);
  }

  var API = {
    ciclo: 'C3',
    casosEnGestion: casosEnGestion,
    ordenarGestion: ordenarGestion,
    resumenGestion: resumenGestion,
    reclasificar: reclasificar,
    render: render
  };

  raiz.GGTO_GESTION = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
