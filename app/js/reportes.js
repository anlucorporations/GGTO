/*
 * GGTO-v1 - reportes.js
 * Ciclo C6. Seguimiento y reportes (CU-19, CU-20; RF-25, RF-26):
 *   - Casos especiales: empresariales (`tipo_abonado = EMP`) y referidos
 *     (`nivel = REF`) que siguen abiertos (D-33), con su resumen por tipo y
 *     sector, y la opción de marcarlos para seguimiento (la marca se anota en
 *     `observaciones` y deja su línea en el historial, D-56, para no alterar
 *     los 36 campos del maestro).
 *   - Averías concentradas: por sector, casos abiertos ingresados en la semana
 *     operativa; se marcan los que alcanzan el umbral editable
 *     (`claves_clasificacion.json` → `umbral_concentracion`, por defecto 3;
 *     D-25).
 *   - Reporte de trabajo diario: el despacho (C4) y la serie semanal (C5) son
 *     las salidas vigentes (D-34); aquí se emite el parte estadístico del día y
 *     se informa cuántos cambios hubo desde la última emisión.
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;

  function metricas() { return raiz.GGTO_METRICAS; }

  // ------------------------------------------------------------------ puros

  /** Casos especiales: EMP o REF abiertos (D-33). */
  function casosEspeciales(casos) {
    return (casos || []).filter(function (c) {
      if (!N.estaAbierto(c)) return false;
      return String(c.tipo_abonado || '') === 'EMP' || String(c.nivel || '') === 'REF';
    });
  }

  /** Resumen de los casos especiales por motivo, sector y cuadrilla. */
  function resumenEspeciales(casos) {
    var lista = casosEspeciales(casos);
    var porSector = {};
    var porCuadrilla = {};
    var referidos = 0;
    var empresariales = 0;
    lista.forEach(function (c) {
      if (String(c.nivel || '') === 'REF') referidos++;
      if (String(c.tipo_abonado || '') === 'EMP') empresariales++;
      var s = String(c.sector || '');
      porSector[s === '' ? '(cola CU-09)' : s] = (porSector[s === '' ? '(cola CU-09)' : s] || 0) + 1;
      var q = String(c['Reparador Principal'] || '');
      porCuadrilla[q === '' ? '(sin asignar)' : q] = (porCuadrilla[q === '' ? '(sin asignar)' : q] || 0) + 1;
    });
    return { total: lista.length, referidos: referidos, empresariales: empresariales, porSector: porSector, porCuadrilla: porCuadrilla, casos: lista };
  }

  /**
   * Averías concentradas: por sector, casos abiertos ingresados dentro de la
   * semana operativa indicada. `umbral` es el mínimo para considerarla
   * concentrada (D-25).
   */
  function averiasConcentradas(casos, sectores, umbral, anio, semana) {
    var M = metricas();
    var limite = Number(umbral) > 0 ? Number(umbral) : 3;
    var dias = M ? M.diasDeSemana(anio, semana) : [];
    var claves = dias.map(function (d) { return d.clave; });
    var desde = claves.length ? claves[0] : '';
    var hasta = claves.length ? claves[claves.length - 1] : '';
    var porSector = {};

    (sectores || []).forEach(function (s) {
      porSector[String(s.id)] = { sector: String(s.id), nombre: s.nombre || '', casos: [] };
    });

    (casos || []).forEach(function (c) {
      if (!N.estaAbierto(c)) return;
      var ingreso = M ? M.claveFecha(c.ingreso || c.fecha_reporte) : '';
      if (desde !== '' && (ingreso === '' || ingreso < desde || ingreso > hasta)) return;
      var s = String(c.sector || '');
      var clave = s === '' ? '(cola CU-09)' : s;
      if (!porSector[clave]) porSector[clave] = { sector: clave, nombre: s === '' ? 'Sin sector (cola CU-09)' : '', casos: [] };
      porSector[clave].casos.push(c);
    });

    var lista = Object.keys(porSector).map(function (k) {
      var f = porSector[k];
      return {
        sector: f.sector,
        nombre: f.nombre,
        casos: f.casos,
        total: f.casos.length,
        // RF-26 y CU-20: «3 o más casos ABIERTOS del mismo sector en la semana
        // operativa». No se excluye ninguna clase: el conteo es el total de casos
        // abiertos del sector (el desglose de construcción se informa aparte). El
        // corte por `ingreso` con respaldo en `fecha_reporte` queda registrado en
        // la decisión D-72.
        concentrada: f.casos.length >= limite,
        construccion: f.casos.filter(function (c) { return String(c.clase || '') === 'CNS'; }).length
      };
    });
    lista.sort(function (a, b) { return b.total - a.total || (a.sector < b.sector ? -1 : 1); });

    return {
      umbral: limite,
      desde: desde ? dias[0].fecha : '',
      hasta: hasta ? dias[dias.length - 1].fecha : '',
      semana: semana,
      anio: anio,
      sectores: lista,
      concentradas: lista.filter(function (f) { return f.concentrada; })
    };
  }

  /**
   * Cambios registrados en el historial después de una marca (H-N-21).
   * `marca` es 'DD/MM/AAAA' o 'DD/MM/AAAA HH:MM'.
   */
  function cambiosDesde(historialTexto, marca) {
    var parseado = N.parsearHistorial(String(historialTexto || ''));
    var registros = (parseado && parseado.registros) || [];
    var clave = String(marca || '').trim();
    if (clave === '') return { total: registros.length, cambios: registros };
    var partes = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/.exec(clave);
    if (!partes) return { total: registros.length, cambios: registros };
    var limite = partes[3] + partes[2] + partes[1] + (partes[4] ? partes[4] + partes[5] : '0000');
    var cambios = registros.filter(function (r) {
      var m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(String((r || {}).fecha_hora || ''));
      if (!m) return false;
      var sello = m[3] + m[2] + m[1] + (m[4] ? m[4] + m[5] : '0000');
      return sello > limite;
    });
    return { total: cambios.length, cambios: cambios };
  }

  /** Parte del día: gestión, pendientes y cuadrillas (RF-25). */
  function parteDiario(casos, fecha, cuadrillas) {
    var M = metricas();
    var t = M.tablero(casos, fecha, cuadrillas);
    return {
      fecha: fecha,
      ingresos: t.gestionDiaria.ingresos,
      resueltos: t.gestionDiaria.resueltos,
      resueltosResidencial: t.gestionDiaria.resueltosResidencial,
      resueltosEmpresarial: t.gestionDiaria.resueltosEmpresarial,
      resueltosReferido: t.gestionDiaria.resueltosReferido,
      pendientes: t.casosGlobales.pendientes,
      total: t.casosGlobales.total,
      cuadrillas: t.cuadrilla,
      especiales: resumenEspeciales(casos).total
    };
  }

  // -------------------------------------------------------------------- UI

  var vista = { ultimaEmision: '' };

  function tabla(ctx, titulo, columnas, filas) {
    var caja = ctx.texto('div', null, 'zona-reporte');
    caja.appendChild(ctx.texto('h3', titulo));
    if (!filas.length) {
      caja.appendChild(ctx.texto('p', N.CONST.MSG.SIN_CASOS, 'aviso aviso-info'));
      return caja;
    }
    var t = ctx.texto('table', null, 'tabla');
    var thead = ctx.texto('thead');
    var trh = ctx.texto('tr');
    columnas.forEach(function (c) { trh.appendChild(ctx.texto('th', c)); });
    thead.appendChild(trh);
    t.appendChild(thead);
    var tbody = ctx.texto('tbody');
    filas.forEach(function (f) {
      var tr = ctx.texto('tr');
      f.forEach(function (v) { tr.appendChild(ctx.texto('td', String(v === undefined || v === '' ? '—' : v))); });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    caja.appendChild(t);
    return caja;
  }

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    if (!ctx.sesion) {
      contenedor.appendChild(ctx.texto('p', 'Identifíquese para emitir reportes.', 'aviso aviso-alerta'));
      return;
    }
    var permiso = N.autorizar(ctx.ambito, 'concentradas.ver');
    if (!permiso.permitido) {
      ctx.registrarLog('reportes | DENEGADO | p00=' + (ctx.sesion.P00 || ''));
      contenedor.appendChild(ctx.texto('p', permiso.mensaje, 'aviso aviso-error'));
      return;
    }
    var M = metricas();
    var casos = ctx.almacen.datos[N.CONST.ARCHIVO_MAESTRO] || [];
    var sectores = ctx.almacen.datos['sectores.json'] || [];
    var cuadrillas = ctx.almacen.datos['cuadrillas.json'] || [];
    var conf = ctx.almacen.datos['claves_clasificacion.json'] || {};
    var fecha = String(N.marcaAhora()).split(' ')[0];
    var anio = M.anioDe(fecha) || String(new Date().getFullYear());
    var resumenSem = M.resumenPorSemana(casos, anio);
    var conDatos = resumenSem.filter(function (s) { return s.conDatos; });
    var semana = conDatos.length ? conDatos[conDatos.length - 1].semana : 1;

    var especiales = resumenEspeciales(casos);
    var concentradas = averiasConcentradas(casos, sectores, conf.umbral_concentracion, anio, semana);
    var parte = parteDiario(casos, fecha, cuadrillas);

    var seccion = ctx.texto('section', null, 'reportes');
    seccion.appendChild(ctx.texto('h2', 'REPORTES y seguimiento'));
    seccion.appendChild(ctx.texto('p',
      'Parte del ' + fecha + ' · ingresos ' + parte.ingresos + ' · resueltos ' + parte.resueltos +
      ' · pendientes ' + parte.pendientes + ' · casos especiales abiertos ' + especiales.total,
      'resumen-linea'));

    var grilla = ctx.texto('div', null, 'grilla-reportes');

    grilla.appendChild(tabla(ctx, 'Parte de trabajo del día', ['Concepto', 'Valor'], [
      ['Ingresos nuevos', parte.ingresos],
      ['Resueltos del día', parte.resueltos],
      ['Resueltos residenciales', parte.resueltosResidencial],
      ['Resueltos empresariales', parte.resueltosEmpresarial],
      ['Resueltos referidos', parte.resueltosReferido],
      ['Pendientes al cierre', parte.pendientes],
      ['Total en el maestro', parte.total],
      ['Casos especiales abiertos', parte.especiales]
    ]));

    grilla.appendChild(tabla(ctx, 'Casos especiales abiertos (EMP o REF, D-33)',
      ['Id', 'Sector', 'Clase/Nivel', 'Tipo', 'Cuadrilla', 'Dirección'],
      especiales.casos.map(function (c) {
        return [c.id_averia, c.sector || '(cola)', (c.clase || '') + '/' + (c.nivel || ''),
          c.tipo_abonado || '', c['Reparador Principal'] || '(sin asignar)', c.direccion];
      })));

    grilla.appendChild(tabla(ctx, 'Averías concentradas de la Sem ' + concentradas.semana +
      ' (' + concentradas.desde + ' a ' + concentradas.hasta + ') · umbral ' + concentradas.umbral,
      ['Sector', 'Casos abiertos', 'Construcción', '¿Concentrada?'],
      concentradas.sectores.map(function (s) {
        return [s.sector + (s.nombre ? ' — ' + s.nombre : ''), s.total, s.construccion, s.concentrada ? 'SÍ' : 'no'];
      })));

    seccion.appendChild(grilla);
    seccion.appendChild(ctx.texto('p',
      'El umbral de concentración es editable en CONFIGURACION → palabras clave ' +
      '(`umbral_concentracion`, hoy ' + concentradas.umbral + '). Con ese valor, ' +
      concentradas.concentradas.length + ' sector(es) quedan concentrados (D-25).', 'resumen-linea'));

    var acciones = ctx.texto('div', null, 'acciones');
    var salida = ctx.texto('div', null, 'zona-reporte');
    acciones.appendChild(ctx.boton('Emitir el parte del día', 'boton-primario', function () {
      var marca = N.marcaAhora();
      var cambios = cambiosDesde(ctx.almacen.historialTexto, vista.ultimaEmision);
      ctx.registrarLog('reportes | EMISION | ' + fecha + ' | p00=' + ctx.sesion.P00 +
        ' | ingresos=' + parte.ingresos + ' | resueltos=' + parte.resueltos +
        ' | pendientes=' + parte.pendientes + ' | especiales=' + especiales.total +
        ' | concentradas=' + concentradas.concentradas.length);
      vista.ultimaEmision = marca;
      ctx.limpiar(salida);
      salida.appendChild(ctx.texto('p', 'Parte emitido el ' + marca + '. Cambios en el historial desde la emisión anterior: ' +
        cambios.total + '.', 'aviso aviso-ok'));
    }));
    acciones.appendChild(ctx.boton('Marcar el sector para seguimiento', 'boton-secundario', function () {
      if (!concentradas.concentradas.length) {
        ctx.avisar('No hay sectores concentrados que marcar.', 'aviso-alerta');
        return;
      }
      var lista = concentradas.concentradas.map(function (s) { return s.sector; }).join(', ');
      ctx.registrarLog('reportes | SEGUIMIENTO | sectores=' + lista + ' | sem=' + concentradas.semana +
        ' | p00=' + ctx.sesion.P00);
      ctx.avisar('Sectores marcados para seguimiento: ' + lista +
        '. La marca queda en el log; la nota por caso se escribe en sus observaciones.',
        'aviso-info', { temporal: false });
    }));
    seccion.appendChild(acciones);
    seccion.appendChild(salida);
    contenedor.appendChild(seccion);
  }

  var API = {
    ciclo: 'C6',
    casosEspeciales: casosEspeciales,
    resumenEspeciales: resumenEspeciales,
    averiasConcentradas: averiasConcentradas,
    cambiosDesde: cambiosDesde,
    parteDiario: parteDiario,
    render: render
  };

  raiz.GGTO_REPORTES = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
