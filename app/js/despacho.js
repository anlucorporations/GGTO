/*
 * GGTO-v1 - despacho.js
 * Ciclo C4. DESPACHO del día (CU-16, RF-08, RF-09, RF-20):
 *   - Reparte los casos abiertos entre las cuadrillas activas agrupando por
 *     sector (RF-08), respetando el ámbito de cada cuadrilla.
 *   - Reglas RN-05: cada cuadrilla recibe los citados del día (`fecha_cita`,
 *     D-30), al menos 1 reparación de referidos (nivel REF) y 1 de empresas
 *     (tipo_abonado EMP).
 *   - Regla RN-06 con desempate D-32: la construcción (clase CNS) de un sector
 *     se asigna a UNA sola cuadrilla: la que tenga reparaciones en ese sector;
 *     si hay varias, la que lo tenga como zona preferente, luego la de menor
 *     carga y, en empate, la de `id` menor.
 *   - La asignación se escribe en `averias.json` (`Reparador Principal` y
 *     `fecha_asignacion`, D-37) y se proyecta en `despacho.json` con `sector`,
 *     `Reparador Principal` y `fecha_despacho` (D-31).
 *   - Cada asignación deja su línea en `historial.jsonl` (D-56).
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var A = raiz.GGTO_ALMACEN;

  // ------------------------------------------------------------------ puros

  /** Casos despachables: abiertos (D-23). */
  function casosDespachables(casos) {
    return (casos || []).filter(function (c) { return N.estaAbierto(c); });
  }

  function cuadrillasActivas(cuadrillas) {
    return (cuadrillas || []).filter(function (c) {
      return String((c || {}).status || 'Activa') === 'Activa' && N.obligatorio(c && c.id);
    });
  }

  /** Un caso es citado si su `fecha_cita` es la fecha del despacho (D-30). */
  function esCitado(caso, fecha) {
    return String((caso || {}).fecha_cita || '').trim() === String(fecha || '').trim() &&
      String(fecha || '').trim() !== '';
  }

  function cubreSector(cuadrilla, sector) {
    var lista = (cuadrilla && cuadrilla.sectores) || [];
    for (var i = 0; i < lista.length; i++) {
      if (String(lista[i]) === String(sector)) return true;
    }
    return false;
  }

  function sectorDe(sectores, id) {
    for (var i = 0; i < (sectores || []).length; i++) {
      if (String(sectores[i].id) === String(id)) return sectores[i];
    }
    return null;
  }

  /**
   * Orden de preferencia para asignar un sector (D-32):
   *   1) que el sector sea zona preferente de la cuadrilla (`cuadrillas.sectores`),
   *   2) menor carga de trabajo del día,
   *   3) `id` menor.
   * `cargas` es un mapa id → número de casos ya asignados.
   */
  function ordenarCandidatas(candidatas, sector, cargas) {
    var c = cargas || {};
    return (candidatas || []).slice().sort(function (a, b) {
      var pa = cubreSector(a, sector) ? 0 : 1;
      var pb = cubreSector(b, sector) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      var ca = c[String(a.id)] || 0;
      var cb = c[String(b.id)] || 0;
      if (ca !== cb) return ca - cb;
      return String(a.id) < String(b.id) ? -1 : 1;
    });
  }

  /**
   * Genera el reparto del día.
   * Devuelve { reparto[], sinAsignar[], avisos[], resumen }.
   * Cada asignación lleva { caso, motivo } donde motivo ∈
   * {citado, referido, empresa, reparacion, construccion, manual}.
   */
  function generarReparto(casos, cuadrillas, sectores, fecha) {
    var activas = cuadrillasActivas(cuadrillas);
    var avisos = [];
    var despachables = casosDespachables(casos);

    var reparto = {};
    activas.forEach(function (c) {
      reparto[String(c.id)] = { cuadrilla: c, asignaciones: [] };
    });
    var sinAsignar = [];

    if (activas.length === 0) {
      return {
        reparto: [], sinAsignar: despachables.slice(), avisos: ['No hay cuadrillas activas: no se puede despachar.'],
        resumen: { casos: despachables.length, asignados: 0, sinAsignar: despachables.length }
      };
    }

    // --- reparaciones por sector (RN-05, RF-08) ---------------------------
    var reparaciones = despachables.filter(function (c) { return String(c.clase || '') !== 'CNS'; });
    var construcciones = despachables.filter(function (c) { return String(c.clase || '') === 'CNS'; });

    function carga(id) { return reparto[id] ? reparto[id].asignaciones.length : 0; }

    function cuadrillaParaSector(sector, candidatas) {
      var s = sectorDe(sectores, sector);
      if (s && N.obligatorio(s.cuadrilla_sugerida) && reparto[String(s.cuadrilla_sugerida)]) {
        return String(s.cuadrilla_sugerida);
      }
      var lista = (candidatas || activas).filter(function (c) {
        return String(sector || '') === '' ? true : cubreSector(c, sector);
      });
      if (lista.length === 0) lista = activas;
      var cargas = {};
      Object.keys(reparto).forEach(function (id) { cargas[id] = carga(id); });
      return String(ordenarCandidatas(lista, sector, cargas)[0].id);
    }

    reparaciones.forEach(function (caso) {
      var destino = cuadrillaParaSector(caso.sector, activas);
      var motivo = esCitado(caso, fecha) ? 'citado'
        : (String(caso.nivel) === 'REF' ? 'referido'
          : (String(caso.tipo_abonado) === 'EMP' ? 'empresa' : 'reparacion'));
      reparto[destino].asignaciones.push({ caso: caso, motivo: motivo });
    });

    // --- RN-05: cada cuadrilla con al menos 1 referido y 1 empresa -------
    function faltaCuota(destino, predicado) {
      return !reparto[destino].asignaciones.some(function (a) { return predicado(a.caso); });
    }
    function prestar(destino, predicado, etiqueta) {
      if (!faltaCuota(destino, predicado)) return;
      var origen = null;
      Object.keys(reparto).forEach(function (id) {
        if (id === destino || origen) return;
        var sobra = reparto[id].asignaciones.filter(function (a) { return predicado(a.caso); }).length;
        if (sobra > 1) origen = id;
      });
      if (!origen) {
        // No hay excedente: se toma de otra cuadrilla si existe el caso.
        Object.keys(reparto).forEach(function (id) {
          if (id === destino || origen) return;
          if (reparto[id].asignaciones.some(function (a) { return predicado(a.caso); })) origen = id;
        });
      }
      if (!origen) {
        avisos.push('La cuadrilla ' + destino + ' queda sin ' + etiqueta + ': no hay casos disponibles.');
        return;
      }
      var i = reparto[origen].asignaciones.findIndex(function (a) { return predicado(a.caso); });
      var movido = reparto[origen].asignaciones.splice(i, 1)[0];
      movido.motivo = etiqueta === 'referido' ? 'referido' : (etiqueta === 'empresa' ? 'empresa' : movido.motivo);
      reparto[destino].asignaciones.push(movido);
    }
    var ids = Object.keys(reparto);
    ids.forEach(function (id) {
      prestar(id, function (c) { return String(c.nivel || '') === 'REF'; }, 'referido');
      prestar(id, function (c) { return String(c.tipo_abonado || '') === 'EMP'; }, 'empresa');
    });

    // --- construcción: una sola cuadrilla por sector (RN-06, D-32) -------
    var porSector = {};
    construcciones.forEach(function (caso) {
      var s = String(caso.sector || '');
      if (!porSector[s]) porSector[s] = [];
      porSector[s].push(caso);
    });
    Object.keys(porSector).forEach(function (sector) {
      var candidatas = activas.filter(function (c) {
        return reparto[String(c.id)].asignaciones.some(function (a) {
          return String(a.caso.sector || '') === sector && String(a.caso.clase || '') !== 'CNS';
        });
      });
      var pool = candidatas.length ? candidatas : activas;
      var cargasCns = {};
      Object.keys(reparto).forEach(function (id) { cargasCns[id] = carga(id); });
      var destino = String(ordenarCandidatas(pool, sector, cargasCns)[0].id);
      porSector[sector].forEach(function (caso) {
        reparto[destino].asignaciones.push({ caso: caso, motivo: 'construccion' });
      });
    });

    var lista = ids.map(function (id) { return reparto[id]; });
    var asignados = lista.reduce(function (t, r) { return t + r.asignaciones.length; }, 0);
    // Las cuotas se cuentan por las PROPIEDADES del caso: un caso puede ser a la
    // vez citado y referido, y ambas cosas deben contarse (RN-05, D-30).
    lista.forEach(function (r) {
      r.citados = r.asignaciones.filter(function (a) { return esCitado(a.caso, fecha); }).length;
      r.referidos = r.asignaciones.filter(function (a) { return String(a.caso.nivel || '') === 'REF'; }).length;
      r.empresas = r.asignaciones.filter(function (a) { return String(a.caso.tipo_abonado || '') === 'EMP'; }).length;
      r.construccion = r.asignaciones.filter(function (a) { return String(a.caso.clase || '') === 'CNS'; }).length;
      r.reparaciones = r.asignaciones.length - r.construccion;
    });

    return {
      reparto: lista,
      sinAsignar: sinAsignar,
      avisos: avisos,
      resumen: {
        casos: despachables.length,
        reparaciones: reparaciones.length,
        construcciones: construcciones.length,
        asignados: asignados,
        sinAsignar: sinAsignar.length,
        cuadrillas: lista.length
      }
    };
  }

  /** Escribe la asignación en el maestro (D-37) y devuelve las líneas de historial. */
  function aplicarReparto(casos, resultado, fecha, operador, marca) {
    var destino = {};
    (resultado.reparto || []).forEach(function (r) {
      r.asignaciones.forEach(function (a) {
        destino[String(a.caso.id_averia)] = { cuadrilla: String(r.cuadrilla.id), motivo: a.motivo };
      });
    });
    var lineas = [];
    var actualizados = (casos || []).map(function (caso) {
      var d = destino[String(caso.id_averia)];
      if (!d) return caso;
      if (String(caso['Reparador Principal'] || '') === d.cuadrilla) return caso;
      var nuevo = {};
      Object.keys(caso).forEach(function (k) { nuevo[k] = caso[k]; });
      var anterior = nuevo['Reparador Principal'] || '';
      nuevo['Reparador Principal'] = d.cuadrilla;
      nuevo.fecha_asignacion = fecha;
      nuevo.usuario_modificacion = operador;
      nuevo.fecha_modificacion = marca;
      lineas.push(N.lineaHistorial({
        fecha_hora: marca, operador: operador, id_averia: String(caso.id_averia),
        campo: 'Reparador Principal', valor_anterior: anterior, valor_nuevo: d.cuadrilla, accion: 'asignacion'
      }));
      return nuevo;
    });
    return { casos: actualizados, lineas: lineas, asignados: lineas.length };
  }

  /** Filas de `despacho.json` (D-31: las 12 del fuente más sector, cuadrilla y fecha). */
  function filasDespacho(resultado, fecha) {
    var filas = [];
    (resultado.reparto || []).forEach(function (r) {
      r.asignaciones.forEach(function (a) {
        var c = a.caso;
        filas.push({
          nivel: c.nivel || '',
          clase: c.clase || '',
          id_averia: c.id_averia || '',
          telefono: c.telefono || '',
          persona_reporta: c.persona_reporta || '',
          contacto: c.contacto || '',
          ultimo_comentario: c.ultimo_comentario || '',
          nombre: c.nombre || '',
          direccion: c.direccion || '',
          plan: c.plan || '',
          fat: c.fat || '',
          serial: c.serial || '',
          sector: c.sector || '',
          'Reparador Principal': String(r.cuadrilla.id),
          fecha_despacho: fecha
        });
      });
    });
    return filas;
  }

  var COLUMNAS_DESPACHO = [
    'id_averia', 'telefono', 'persona_reporta', 'contacto', 'nombre', 'direccion',
    'plan', 'fat', 'serial', 'ultimo_comentario'
  ];

  // -------------------------------------------------------------------- UI

  var vista = { resultado: null, movimientos: {} };

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    vista = { resultado: null, movimientos: {} };
    if (!ctx.sesion) {
      contenedor.appendChild(ctx.texto('p', 'Identifíquese para generar el despacho.', 'aviso aviso-alerta'));
      return;
    }
    var permiso = N.autorizar(ctx.ambito, 'despacho.generar');
    if (!permiso.permitido) {
      ctx.registrarLog('despacho | DENEGADO | p00=' + (ctx.sesion.P00 || ''));
      contenedor.appendChild(ctx.texto('p', permiso.mensaje, 'aviso aviso-error'));
      return;
    }

    var datos = ctx.almacen.datos;
    var fecha = String(N.marcaAhora()).split(' ')[0];
    var seccion = ctx.texto('section', null, 'despacho');
    seccion.appendChild(ctx.texto('h2', 'DESPACHO del día ' + fecha));
    seccion.appendChild(ctx.texto('p',
      'Cuadrillas activas: ' + cuadrillasActivas(datos['cuadrillas.json'] || []).length +
      ' · casos abiertos: ' + casosDespachables(datos[N.CONST.ARCHIVO_MAESTRO] || []).length,
      'resumen-linea'));

    var zona = ctx.texto('div', null, 'zona-despacho');
    seccion.appendChild(ctx.boton('Generar el despacho', 'boton-primario', function () {
      var r = generarReparto(
        datos[N.CONST.ARCHIVO_MAESTRO] || [],
        datos['cuadrillas.json'] || [],
        datos['sectores.json'] || [],
        fecha
      );
      vista.resultado = r;
      pintar(ctx, zona, fecha);
    }));
    seccion.appendChild(zona);
    contenedor.appendChild(seccion);
  }

  function pintar(ctx, zona, fecha) {
    ctx.limpiar(zona);
    var r = vista.resultado;
    if (!r) return;
    zona.appendChild(ctx.texto('h3', 'Reparto propuesto'));
    zona.appendChild(ctx.texto('p',
      'Casos abiertos: ' + r.resumen.casos + ' (reparaciones ' + r.resumen.reparaciones +
      ', construcciones ' + r.resumen.construcciones + ') · asignados: ' + r.resumen.asignados +
      ' · cuadrillas: ' + r.resumen.cuadrillas, 'resumen-linea'));

    r.avisos.forEach(function (a) {
      zona.appendChild(ctx.texto('p', a, 'aviso aviso-alerta'));
    });

    r.reparto.forEach(function (bloque) {
      var caja = ctx.texto('div', null, 'bloque');
      caja.appendChild(ctx.texto('h3', 'Cuadrilla ' + bloque.cuadrilla.id + ' — ' +
        (bloque.cuadrilla.nombre || '') + ' · ' + bloque.asignaciones.length + ' casos (' +
        bloque.citados + ' citados, ' + bloque.referidos + ' referidos, ' + bloque.empresas +
        ' empresas, ' + bloque.construccion + ' construcción)'));
      var tabla = ctx.texto('table', null, 'tabla');
      var thead = ctx.texto('thead');
      var trh = ctx.texto('tr');
      ['Id', 'Sector', 'Clase/Nivel', 'Dirección', 'Motivo', 'Mover a'].forEach(function (t) {
        trh.appendChild(ctx.texto('th', t));
      });
      thead.appendChild(trh);
      tabla.appendChild(thead);
      var tbody = ctx.texto('tbody');
      bloque.asignaciones.forEach(function (a) {
        var tr = ctx.texto('tr');
        [a.caso.id_averia, a.caso.sector || '(cola)', (a.caso.clase || '') + '/' + (a.caso.nivel || ''),
          a.caso.direccion, a.motivo].forEach(function (v) {
          tr.appendChild(ctx.texto('td', String(v === undefined || v === '' ? '—' : v)));
        });
        var td = ctx.texto('td');
        var sel = document.createElement('select');
        var opt0 = document.createElement('option');
        opt0.value = ''; opt0.textContent = '(sin cambio)';
        sel.appendChild(opt0);
        r.reparto.forEach(function (otro) {
          var o = document.createElement('option');
          o.value = String(otro.cuadrilla.id);
          o.textContent = String(otro.cuadrilla.id);
          if (String(otro.cuadrilla.id) === String(bloque.cuadrilla.id)) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', function () {
          vista.movimientos[String(a.caso.id_averia)] = sel.value;
        });
        td.appendChild(sel);
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      tabla.appendChild(tbody);
      caja.appendChild(tabla);
      zona.appendChild(caja);
    });

    var acciones = ctx.texto('div', null, 'acciones');
    acciones.appendChild(ctx.boton('Guardar el despacho', 'boton-primario', function () {
      guardar(ctx, fecha);
    }));
    r.reparto.forEach(function (bloque) {
      acciones.appendChild(ctx.boton('PDF ' + bloque.cuadrilla.id, 'boton-secundario', function () {
        if (typeof raiz.GGTO_PDF === 'undefined' || !raiz.GGTO_PDF.generar) {
          ctx.avisar('El módulo de PDF no está disponible.', 'aviso-error');
          return;
        }
        raiz.GGTO_PDF.generar(ctx, bloque, fecha, 1);
      }));
    });
    zona.appendChild(acciones);
  }

  function guardar(ctx, fecha) {
    var r = vista.resultado;
    if (!r) return;
    // Aplica los movimientos manuales antes de guardar (RN-06 permite ajuste).
    Object.keys(vista.movimientos).forEach(function (id) {
      var destino = vista.movimientos[id];
      if (!destino) return;
      var asignacion = null;
      r.reparto.forEach(function (bloque) {
        bloque.asignaciones.forEach(function (a) {
          if (String(a.caso.id_averia) === String(id) && !asignacion) {
            asignacion = { bloque: bloque, a: a };
          }
        });
      });
      if (!asignacion || String(asignacion.bloque.cuadrilla.id) === String(destino)) return;
      var idx = asignacion.bloque.asignaciones.indexOf(asignacion.a);
      asignacion.bloque.asignaciones.splice(idx, 1);
      asignacion.a.motivo = 'manual';
      var destinoBloque = r.reparto.filter(function (b) { return String(b.cuadrilla.id) === String(destino); })[0];
      if (destinoBloque) destinoBloque.asignaciones.push(asignacion.a);
    });
    vista.movimientos = {};

    var maestro = ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || [];
    var aplicado = aplicarReparto(maestro, r, fecha, ctx.sesion.P00, N.marcaAhora());
    var filas = filasDespacho(r, fecha);
    var lineas = aplicado.lineas;

    function terminar() {
      ctx.registrarLog('despacho | ' + fecha + ' | p00=' + ctx.sesion.P00 +
        ' | asignados=' + aplicado.asignados + ' | filas=' + filas.length);
      ctx.avisar('Despacho guardado: ' + aplicado.asignados + ' asignaciones y ' + filas.length +
        ' filas en despacho.json.', 'aviso-info', { temporal: false });
      if (typeof ctx.recargarDatos === 'function') ctx.recargarDatos();
    }

    if (ctx.modoDescarga()) {
      ctx.descargarArchivo(N.CONST.ARCHIVO_MAESTRO, aplicado.casos).then(function () {
        return ctx.descargarArchivo(N.CONST.ARCHIVO_DESPACHO, filas);
      }).then(function () {
        ctx.avisar('Modo descarga: se descargaron el maestro y el despacho. El historial no se puede escribir.',
          'aviso-alerta', { temporal: false });
      });
      return;
    }

    ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_DESPACHO, filas, {}).then(function () {
      return ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_MAESTRO, aplicado.casos, {});
    }).then(function () {
      return ctx.almacen.agregarHistorial(lineas);
    }).then(function () {
      terminar();
    }).catch(function (e) {
      if (e && e.tipo === 'conflicto') {
        ctx.manejarConflicto(N.CONST.ARCHIVO_MAESTRO, aplicado.casos, function () {
          return ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_DESPACHO, filas, { sobrescribir: true })
            .then(function () { return ctx.almacen.guardarArchivo(N.CONST.ARCHIVO_MAESTRO, aplicado.casos, { sobrescribir: true }); })
            .then(function () { return ctx.almacen.agregarHistorial(lineas); })
            .then(function () { ctx.avisar('Despacho guardado con sobrescritura consciente.', 'aviso-info'); });
        }, e);
        return;
      }
      ctx.avisar('No se pudo guardar el despacho: ' + A.errorDe(e), 'aviso-error', { temporal: false });
    });
  }

  var API = {
    ciclo: 'C4',
    COLUMNAS_DESPACHO: COLUMNAS_DESPACHO,
    casosDespachables: casosDespachables,
    cuadrillasActivas: cuadrillasActivas,
    esCitado: esCitado,
    ordenarCandidatas: ordenarCandidatas,
    generarReparto: generarReparto,
    aplicarReparto: aplicarReparto,
    filasDespacho: filasDespacho,
    render: render
  };

  raiz.GGTO_DESPACHO = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
