/*
 * GGTO-v1 - metricas.js
 * Ciclo C5. Agregaciones del MONITOREO (CU-18, RF-05) y del seguimiento
 * semanal estadístico (D-34):
 *   - Gestión diaria: ingresos del día y resueltos por tipo.
 *   - Casos globales: pendientes vs. resueltos.
 *   - Reparación: pendientes por tipo (comunes, referidos, empresariales).
 *   - Construcción: pendientes residenciales y empresariales.
 *   - Cuadrilla: asignados vs. cerrados vs. gestionados del día.
 *   - Serie semanal: por día (lunes a sábado, RN-08) ingresos vs. reparadas y
 *     línea de pendientes al cierre, dimensionada por semana (Sem 1 a Sem 36).
 * Toda la lógica es pura (probada en pruebas/pruebas_c5.mjs); el dibujo vive en
 * graficos.js.
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;

  // ------------------------------------------------------------------ fechas

  /** 'DD/MM/AAAA' → 'AAAAMMDD' para comparar ('' si no es válida). */
  function claveFecha(fecha) {
    var t = String(fecha === null || fecha === undefined ? '' : fecha).trim();
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
    if (!m) return '';
    if (!N.esFechaValida(t)) return '';
    return m[3] + m[2] + m[1];
  }

  function anioDe(fecha) {
    var c = claveFecha(fecha);
    return c ? c.slice(0, 4) : '';
  }

  /**
   * Lunes de la semana `sem` del año operativo.
   * Convención (D-34): **Sem 1 = la semana que empieza el primer lunes del año**
   * y la semana operativa va de lunes a sábado (RN-08). Con el año 2026, la
   * Sem 1 empieza el 05/01/2026 y la Sem 36 es la del 07/09 al 12/09 de 2026,
   * que es la de la muestra real del CSV.
   */
  function lunesDeSemana(anio, sem) {
    var primero = new Date(Number(anio), 0, 1);
    var dia = primero.getDay();                       // 0 = domingo
    var hastaLunes = dia === 0 ? 1 : (8 - dia) % 7;   // al primer lunes del año
    var lunes = new Date(primero);
    lunes.setDate(primero.getDate() + hastaLunes + (Number(sem) - 1) * 7);
    return lunes;
  }

  function formatear(fecha) {
    return N.formatearFecha ? N.formatearFecha(fecha) : N.marcaAhora(fecha).split(' ')[0];
  }

  /** Días de la semana operativa (lunes a sábado) de `sem`. */
  function diasDeSemana(anio, sem) {
    var dias = [];
    for (var i = 0; i < 6; i++) {
      var d = lunesDeSemana(anio, sem);
      d.setDate(d.getDate() + i);
      dias.push({ fecha: formatear(d), clave: claveFecha(formatear(d)), dia: i });
    }
    return dias;
  }

  function resolvioHasta(caso, claveDia) {
    var c = claveFecha((caso || {}).fechaResolucion);
    return c !== '' && claveDia !== '' && c <= claveDia;
  }

  function abiertoAlCierre(caso, claveDia) {
    var ing = claveFecha((caso || {}).ingreso || (caso || {}).fecha_reporte);
    if (ing === '' || claveDia === '' || ing > claveDia) return false;
    return !resolvioHasta(caso, claveDia);
  }

  // ----------------------------------------------------------------- metricas

  /** Gestión del día: ingresos y resueltos, con el desglose del reporte. */
  function gestionDiaria(casos, fecha) {
    var clave = claveFecha(fecha);
    var r = { fecha: fecha, ingresos: 0, resueltos: 0, resueltosResidencial: 0, resueltosEmpresarial: 0, resueltosReferido: 0 };
    (casos || []).forEach(function (c) {
      if (claveFecha(c.ingreso) === clave) r.ingresos++;
      if (claveFecha(c.fechaResolucion) === clave) {
        r.resueltos++;
        if (String(c.nivel || '') === 'REF') r.resueltosReferido++;
        else if (String(c.tipo_abonado || '') === 'EMP') r.resueltosEmpresarial++;
        else r.resueltosResidencial++;
      }
    });
    return r;
  }

  /** Casos globales: pendientes contra resueltos. */
  function casosGlobales(casos) {
    var lista = casos || [];
    var pendientes = lista.filter(function (c) { return N.estaAbierto(c); }).length;
    return { total: lista.length, pendientes: pendientes, resueltos: lista.length - pendientes };
  }

  /** Pendientes de reparación por tipo (clase REP). */
  function reparacionPendiente(casos) {
    var r = { comunes: 0, referidos: 0, empresariales: 0, total: 0 };
    (casos || []).forEach(function (c) {
      if (String(c.clase || '') === 'CNS' || !N.estaAbierto(c)) return;
      r.total++;
      if (String(c.nivel || '') === 'REF') r.referidos++;
      else if (String(c.tipo_abonado || '') === 'EMP') r.empresariales++;
      else r.comunes++;
    });
    return r;
  }

  /** Pendientes de construcción por tipo (clase CNS). */
  function construccionPendiente(casos) {
    var r = { residenciales: 0, empresariales: 0, total: 0 };
    (casos || []).forEach(function (c) {
      if (String(c.clase || '') !== 'CNS' || !N.estaAbierto(c)) return;
      r.total++;
      if (String(c.tipo_abonado || '') === 'EMP') r.empresariales++;
      else r.residenciales++;
    });
    return r;
  }

  /**
   * Cuadrillas del día (RF-05, zona CUADRILLA):
   *   asignados  = casos con `fecha_asignacion` del día (D-48),
   *   cerrados   = casos con `fechaResolucion` del día,
   *   gestionados = casos tocados ese día (`fecha_modificacion` del día).
   */
  function cuadrillaDelDia(casos, fecha, cuadrillas) {
    var clave = claveFecha(fecha);
    var ids = [];
    (cuadrillas || []).forEach(function (c) { ids.push(String(c.id)); });
    (casos || []).forEach(function (c) {
      var id = String(c['Reparador Principal'] || '');
      if (id !== '' && ids.indexOf(id) < 0) ids.push(id);
    });
    return ids.map(function (id) {
      var fila = { cuadrilla: id, asignados: 0, cerrados: 0, gestionados: 0 };
      (casos || []).forEach(function (c) {
        if (String(c['Reparador Principal'] || '') !== id) return;
        if (claveFecha(c.fecha_asignacion) === clave) fila.asignados++;
        if (claveFecha(c.fechaResolucion) === clave) fila.cerrados++;
        if (claveFecha(c.fecha_modificacion) === clave) fila.gestionados++;
      });
      return fila;
    });
  }

  /** Serie de la semana operativa: lunes a sábado con ingresos, reparadas y pendiente al cierre. */
  function serieDeSemana(casos, anio, sem) {
    return diasDeSemana(anio, sem).map(function (d) {
      var ingresos = 0;
      var reparadas = 0;
      var pendientes = 0;
      (casos || []).forEach(function (c) {
        if (claveFecha(c.ingreso) === d.clave) ingresos++;
        if (claveFecha(c.fechaResolucion) === d.clave) reparadas++;
        if (abiertoAlCierre(c, d.clave)) pendientes++;
      });
      return { fecha: d.fecha, clave: d.clave, ingresos: ingresos, reparadas: reparadas, pendientes: pendientes };
    });
  }

  /** Resumen de las 36 semanas del año para el selector y el gráfico de conjunto. */
  function resumenPorSemana(casos, anio, semanas) {
    var total = semanas || 36;
    var lista = [];
    for (var s = 1; s <= total; s++) {
      var serie = serieDeSemana(casos, anio, s);
      var ingresos = serie.reduce(function (t, d) { return t + d.ingresos; }, 0);
      var reparadas = serie.reduce(function (t, d) { return t + d.reparadas; }, 0);
      var ultimo = serie[serie.length - 1];
      lista.push({
        semana: s,
        ingresos: ingresos,
        reparadas: reparadas,
        pendienteFinal: ultimo ? ultimo.pendientes : 0,
        conDatos: ingresos + reparadas > 0
      });
    }
    return lista;
  }

  /** Todas las métricas de una fecha, listas para las tablas y los gráficos. */
  function tablero(casos, fecha, cuadrillas) {
    return {
      fecha: fecha,
      gestionDiaria: gestionDiaria(casos, fecha),
      casosGlobales: casosGlobales(casos),
      reparacion: reparacionPendiente(casos),
      construccion: construccionPendiente(casos),
      cuadrilla: cuadrillaDelDia(casos, fecha, cuadrillas)
    };
  }

  // -------------------------------------------------------------------- UI

  function tabla(ctx, titulo, filas) {
    var caja = ctx.texto('div', null, 'zona-monitoreo');
    caja.appendChild(ctx.texto('h3', titulo));
    var t = ctx.texto('table', null, 'tabla');
    var tbody = ctx.texto('tbody');
    filas.forEach(function (f) {
      var tr = ctx.texto('tr');
      tr.appendChild(ctx.texto('th', f[0]));
      tr.appendChild(ctx.texto('td', String(f[1])));
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    caja.appendChild(t);
    return caja;
  }

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    if (!ctx.sesion) {
      contenedor.appendChild(ctx.texto('p', 'Identifíquese para ver el MONITOREO.', 'aviso aviso-alerta'));
      return;
    }
    var permiso = N.autorizar(ctx.ambito, 'monitoreo.ver');
    if (!permiso.permitido) {
      contenedor.appendChild(ctx.texto('p', permiso.mensaje, 'aviso aviso-error'));
      return;
    }
    var casos = ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || [];
    var cuadrillas = ctx.almacen.datos['cuadrillas.json'] || [];
    var fecha = String(N.marcaAhora()).split(' ')[0];
    var m = tablero(casos, fecha, cuadrillas);

    var seccion = ctx.texto('section', null, 'monitoreo');
    seccion.appendChild(ctx.texto('h2', 'MONITOREO del ' + fecha));
    seccion.appendChild(ctx.texto('p', 'Casos en el maestro: ' + m.casosGlobales.total +
      ' · pendientes: ' + m.casosGlobales.pendientes + ' · resueltos: ' + m.casosGlobales.resueltos,
      'resumen-linea'));

    var grilla = ctx.texto('div', null, 'grilla-monitoreo');
    grilla.appendChild(tabla(ctx, 'Gestión diaria', [
      ['Ingresos nuevos', m.gestionDiaria.ingresos],
      ['Resueltos del día', m.gestionDiaria.resueltos],
      ['Resueltos residenciales', m.gestionDiaria.resueltosResidencial],
      ['Resueltos empresariales', m.gestionDiaria.resueltosEmpresarial],
      ['Resueltos referidos', m.gestionDiaria.resueltosReferido]
    ]));
    grilla.appendChild(tabla(ctx, 'Casos globales', [
      ['Total', m.casosGlobales.total],
      ['Pendientes', m.casosGlobales.pendientes],
      ['Resueltos', m.casosGlobales.resueltos]
    ]));
    grilla.appendChild(tabla(ctx, 'Reparación pendiente', [
      ['Residenciales comunes', m.reparacion.comunes],
      ['Residenciales referidos', m.reparacion.referidos],
      ['Empresariales', m.reparacion.empresariales],
      ['Total', m.reparacion.total]
    ]));
    grilla.appendChild(tabla(ctx, 'Construcción pendiente', [
      ['Residenciales', m.construccion.residenciales],
      ['Empresariales', m.construccion.empresariales],
      ['Total', m.construccion.total]
    ]));

    var cajaCuadrilla = ctx.texto('div', null, 'zona-monitoreo');
    cajaCuadrilla.appendChild(ctx.texto('h3', 'Cuadrillas del día'));
    var t = ctx.texto('table', null, 'tabla');
    var thead = ctx.texto('thead');
    var trh = ctx.texto('tr');
    ['Cuadrilla', 'Asignados', 'Cerrados', 'Gestionados'].forEach(function (x) { trh.appendChild(ctx.texto('th', x)); });
    thead.appendChild(trh);
    t.appendChild(thead);
    var tbody = ctx.texto('tbody');
    m.cuadrilla.forEach(function (f) {
      var tr = ctx.texto('tr');
      [f.cuadrilla, f.asignados, f.cerrados, f.gestionados].forEach(function (v) {
        tr.appendChild(ctx.texto('td', String(v)));
      });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    cajaCuadrilla.appendChild(t);
    grilla.appendChild(cajaCuadrilla);

    var cajaSemana = ctx.texto('div', null, 'zona-monitoreo');
    cajaSemana.appendChild(ctx.texto('h3', 'Gestión semanal (lunes a sábado)'));
    var anio = anioDe(fecha) || String(new Date().getFullYear());
    var resumen = resumenPorSemana(casos, anio);
    var conDatos = resumen.filter(function (s) { return s.conDatos; });
    var actual = conDatos.length ? conDatos[conDatos.length - 1].semana : 1;
    var serie = serieDeSemana(casos, anio, actual);
    var t2 = ctx.texto('table', null, 'tabla');
    var th2 = ctx.texto('thead');
    var trh2 = ctx.texto('tr');
    ['Día', 'Ingresos', 'Reparadas', 'Pendientes al cierre'].forEach(function (x) { trh2.appendChild(ctx.texto('th', x)); });
    th2.appendChild(trh2);
    t2.appendChild(th2);
    var tb2 = ctx.texto('tbody');
    serie.forEach(function (d) {
      var tr = ctx.texto('tr');
      [d.fecha, d.ingresos, d.reparadas, d.pendientes].forEach(function (v) {
        tr.appendChild(ctx.texto('td', String(v)));
      });
      tb2.appendChild(tr);
    });
    t2.appendChild(tb2);
    cajaSemana.appendChild(ctx.texto('p', 'Semana ' + actual + ' del ' + anio +
      ' (el gráfico con el selector de Sem 1 a Sem 36 está en la pestaña GRAFICOS).', 'resumen-linea'));
    cajaSemana.appendChild(t2);
    grilla.appendChild(cajaSemana);

    seccion.appendChild(grilla);
    contenedor.appendChild(seccion);
  }

  var API = {
    ciclo: 'C5',
    claveFecha: claveFecha,
    anioDe: anioDe,
    lunesDeSemana: lunesDeSemana,
    diasDeSemana: diasDeSemana,
    abiertoAlCierre: abiertoAlCierre,
    gestionDiaria: gestionDiaria,
    casosGlobales: casosGlobales,
    reparacionPendiente: reparacionPendiente,
    construccionPendiente: construccionPendiente,
    cuadrillaDelDia: cuadrillaDelDia,
    serieDeSemana: serieDeSemana,
    resumenPorSemana: resumenPorSemana,
    tablero: tablero,
    render: render
  };

  raiz.GGTO_METRICAS = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
