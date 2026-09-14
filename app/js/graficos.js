/*
 * GGTO-v1 - graficos.js
 * Ciclo C5. Pestaña GRAFICOS (CU-18, RF-06): las mismas 6 zonas del MONITOREO
 * como gráficos dedicados, con Chart.js local (app/lib/chart.umd.min.js, RT-07):
 *   GESTION DIARIO (barras) · GESTION SEMANAL (barras + línea, Sem 1 a Sem 36,
 *   con selector de semana) · CASOS GLOBALES (barras) · REPARACION (torta) ·
 *   CONSTRUCCION (barras) · CUADRILLA (barras).
 * Cada gráfico lleva su tabla equivalente, para cumplir la accesibilidad
 * (RNF-13, D-40). Las funciones de configuración son puras y se prueban en
 * pruebas/pruebas_c5.mjs sin necesidad de la librería.
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;

  var COLORES = {
    ingreso: '#1f6feb',
    resolucion: '#2ea043',
    pendiente: '#d29922',
    linea: '#f85149',
    comunes: '#1f6feb',
    referidos: '#8250df',
    empresariales: '#d29922'
  };

  // ------------------------------------------------------- configuraciones

  function configGestionDiario(m) {
    return {
      type: 'bar',
      data: {
        labels: ['Ingresos nuevos', 'Resueltos'],
        datasets: [{
          label: 'Gestión diaria',
          data: [m.gestionDiaria.ingresos, m.gestionDiaria.resueltos],
          backgroundColor: [COLORES.ingreso, COLORES.resolucion]
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    };
  }

  function configGlobales(m) {
    return {
      type: 'bar',
      data: {
        labels: ['Pendientes', 'Resueltos'],
        datasets: [{
          label: 'Casos globales',
          data: [m.casosGlobales.pendientes, m.casosGlobales.resueltos],
          backgroundColor: [COLORES.pendiente, COLORES.resolucion]
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    };
  }

  function configReparacion(m) {
    return {
      type: 'pie',
      data: {
        labels: ['Residenciales comunes', 'Residenciales referidos', 'Empresariales'],
        datasets: [{
          label: 'Reparación pendiente',
          data: [m.reparacion.comunes, m.reparacion.referidos, m.reparacion.empresariales],
          backgroundColor: [COLORES.comunes, COLORES.referidos, COLORES.empresariales]
        }]
      },
      options: { responsive: true }
    };
  }

  function configConstruccion(m) {
    return {
      type: 'bar',
      data: {
        labels: ['Residenciales', 'Empresariales'],
        datasets: [{
          label: 'Construcción pendiente',
          data: [m.construccion.residenciales, m.construccion.empresariales],
          backgroundColor: [COLORES.comunes, COLORES.empresariales]
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    };
  }

  function configCuadrilla(m) {
    return {
      type: 'bar',
      data: {
        labels: m.cuadrilla.map(function (c) { return c.cuadrilla; }),
        datasets: [
          { label: 'Asignados', data: m.cuadrilla.map(function (c) { return c.asignados; }), backgroundColor: COLORES.ingreso },
          { label: 'Cerrados', data: m.cuadrilla.map(function (c) { return c.cerrados; }), backgroundColor: COLORES.resolucion },
          { label: 'Gestionados', data: m.cuadrilla.map(function (c) { return c.gestionados; }), backgroundColor: COLORES.pendiente }
        ]
      },
      options: { responsive: true }
    };
  }

  /** Serie semanal: barras de ingresos y reparadas por día, con línea de pendientes (D-34). */
  function configSemanal(serie, etiqueta) {
    return {
      type: 'bar',
      data: {
        labels: serie.map(function (d) { return d.fecha.slice(0, 5); }),
        datasets: [
          { label: 'Ingresos del día', data: serie.map(function (d) { return d.ingresos; }), backgroundColor: COLORES.ingreso },
          { label: 'Reparadas del día', data: serie.map(function (d) { return d.reparadas; }), backgroundColor: COLORES.resolucion },
          {
            label: 'Pendientes al cierre',
            type: 'line',
            data: serie.map(function (d) { return d.pendientes; }),
            borderColor: COLORES.linea,
            backgroundColor: COLORES.linea,
            tension: 0.25,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: etiqueta || 'Gestión semanal' } },
        scales: { y: { beginAtZero: true } }
      }
    };
  }

  /** Las seis zonas con su título, tipo y configuración. */
  function configuraciones(m, serie, etiqueta) {
    return [
      { zona: 'gestion-diario', titulo: 'GESTION DIARIO', config: configGestionDiario(m) },
      { zona: 'gestion-semanal', titulo: 'GESTION SEMANAL', config: configSemanal(serie, etiqueta) },
      { zona: 'casos-globales', titulo: 'CASOS GLOBALES', config: configGlobales(m) },
      { zona: 'reparacion', titulo: 'REPARACION', config: configReparacion(m) },
      { zona: 'construccion', titulo: 'CONSTRUCCION', config: configConstruccion(m) },
      { zona: 'cuadrilla', titulo: 'CUADRILLA', config: configCuadrilla(m) }
    ];
  }

  // -------------------------------------------------------------------- UI

  function claseChart() {
    if (raiz.Chart) return raiz.Chart;
    if (raiz.Chart && raiz.Chart.Chart) return raiz.Chart.Chart;
    return null;
  }

  function tablaEquivalente(ctx, config) {
    var t = ctx.texto('table', null, 'tabla');
    var thead = ctx.texto('thead');
    var trh = ctx.texto('tr');
    trh.appendChild(ctx.texto('th', 'Serie'));
    config.data.labels.forEach(function (l) { trh.appendChild(ctx.texto('th', String(l))); });
    thead.appendChild(trh);
    t.appendChild(thead);
    var tbody = ctx.texto('tbody');
    config.data.datasets.forEach(function (ds) {
      var tr = ctx.texto('tr');
      tr.appendChild(ctx.texto('th', String(ds.label || '')));
      ds.data.forEach(function (v) { tr.appendChild(ctx.texto('td', String(v))); });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    return t;
  }

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    if (!ctx.sesion) {
      contenedor.appendChild(ctx.texto('p', 'Identifíquese para ver los gráficos.', 'aviso aviso-alerta'));
      return;
    }
    var permiso = N.autorizar(ctx.ambito, 'monitoreo.ver');
    if (!permiso.permitido) {
      contenedor.appendChild(ctx.texto('p', permiso.mensaje, 'aviso aviso-error'));
      return;
    }
    var M = raiz.GGTO_METRICAS;
    if (!M) {
      contenedor.appendChild(ctx.texto('p', 'El módulo de métricas no está disponible.', 'aviso aviso-error'));
      return;
    }
    var casos = ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || [];
    var cuadrillas = ctx.almacen.datos['cuadrillas.json'] || [];
    var fecha = String(N.marcaAhora()).split(' ')[0];
    var anio = M.anioDe(fecha) || String(new Date().getFullYear());
    var m = M.tablero(casos, fecha, cuadrillas);
    var resumen = M.resumenPorSemana(casos, anio);
    var conDatos = resumen.filter(function (s) { return s.conDatos; });
    var semana = conDatos.length ? conDatos[conDatos.length - 1].semana : 1;

    var seccion = ctx.texto('section', null, 'graficos');
    seccion.appendChild(ctx.texto('h2', 'GRAFICOS del ' + fecha));

    var controles = ctx.texto('div', null, 'acciones');
    var lab = document.createElement('label');
    lab.setAttribute('for', 'semana-grafico');
    lab.textContent = 'Semana (Sem 1 a Sem 36)';
    var sel = document.createElement('select');
    sel.id = 'semana-grafico';
    resumen.forEach(function (s) {
      var o = document.createElement('option');
      o.value = String(s.semana);
      o.textContent = 'Sem ' + s.semana + (s.conDatos ? ' · ' + s.ingresos + '/' + s.reparadas : '');
      if (s.semana === semana) o.selected = true;
      sel.appendChild(o);
    });
    controles.appendChild(lab);
    controles.appendChild(sel);
    seccion.appendChild(controles);

    var grilla = ctx.texto('div', null, 'grilla-graficos');
    seccion.appendChild(grilla);

    var ChartClase = claseChart();
    var lienzos = {};

    function dibujar() {
      ctx.limpiar(grilla);
      var serie = M.serieDeSemana(casos, anio, Number(sel.value));
      var etiqueta = 'Semana ' + sel.value + ' de ' + anio;
      configuraciones(m, serie, etiqueta).forEach(function (z) {
        var caja = ctx.texto('div', null, 'zona-grafico');
        caja.appendChild(ctx.texto('h3', z.titulo));
        var canvas = document.createElement('canvas');
        canvas.id = 'grafico-' + z.zona;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', z.titulo + ': ' + etiqueta);
        caja.appendChild(canvas);
        caja.appendChild(tablaEquivalente(ctx, z.config));
        grilla.appendChild(caja);
        if (lienzos[z.zona]) { lienzos[z.zona].destroy(); }
        if (ChartClase) {
          lienzos[z.zona] = new ChartClase(canvas, z.config);
        } else {
          caja.appendChild(ctx.texto('p', 'Gráfico no disponible: falta la librería Chart.js en app/lib/. La tabla de al lado tiene los mismos datos.', 'aviso aviso-alerta'));
        }
      });
      const total = document.getElementById('graficos');
      if (total) total.setAttribute('data-semana', String(sel.value));
    }

    sel.addEventListener('change', dibujar);
    dibujar();
    contenedor.appendChild(seccion);
  }

  var API = {
    ciclo: 'C5',
    COLORES: COLORES,
    configGestionDiario: configGestionDiario,
    configGlobales: configGlobales,
    configReparacion: configReparacion,
    configConstruccion: configConstruccion,
    configCuadrilla: configCuadrilla,
    configSemanal: configSemanal,
    configuraciones: configuraciones,
    render: render
  };

  raiz.GGTO_GRAFICOS = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
