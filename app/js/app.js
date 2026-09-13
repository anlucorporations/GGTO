/*
 * GGTO-v1 - app.js
 * Arranque, enrutado de las 7 pestañas (RF-01), estado global de sesión
 * (D-29, D-39, D-45), bloqueo total sin sesión válida (D-50, RNF-08), matriz de
 * permisos (D-35, RNF-12), accesibilidad (D-40, RNF-13) y diagnóstico del
 * entorno (CU-22). Depende de GGTO_NUCLEO, GGTO_ALMACEN y de los módulos.
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var A = raiz.GGTO_ALMACEN;
  var CONST = N.CONST;

  // ------------------------------------------------------------------
  // Estado global de sesión
  // ------------------------------------------------------------------
  var estado = {
    almacen: null,
    cargado: false,
    resumen: [],
    archivosFaltantes: [],
    archivosInvalidos: [],
    sesion: null,
    tab: null,
    pestanaSolicitada: null,
    intentos: 0,
    cliente: {},
    modoDescarga: false,
    modoPorArchivo: false,
    avisoSinIngesta: false
  };

  var PESTANAS = [
    { id: 'panel', etiqueta: 'PANEL', modulo: 'GGTO_PANEL', accion: null },
    { id: 'monitoreo', etiqueta: 'MONITOREO', modulo: 'GGTO_METRICAS', accion: 'monitoreo.ver' },
    { id: 'graficos', etiqueta: 'GRAFICOS', modulo: 'GGTO_GRAFICOS', accion: 'monitoreo.ver' },
    { id: 'casos', etiqueta: 'CASOS', modulo: 'GGTO_CASOS', accion: null },
    { id: 'despacho', etiqueta: 'DESPACHO', modulo: 'GGTO_DESPACHO', accion: 'despacho.generar' },
    { id: 'configuracion', etiqueta: 'CONFIGURACION', modulo: 'GGTO_CONFIGURACION', accion: 'config.central' },
    { id: 'gestion', etiqueta: 'GESTION', modulo: 'GGTO_GESTION', accion: 'gestion.bandeja' }
  ];

  var CLAVE_SESION = 'ggto.sesion.inicio';

  // ------------------------------------------------------------------
  // Utilidades de interfaz
  // ------------------------------------------------------------------
  function $(sel, raizBusqueda) { return (raizBusqueda || document).querySelector(sel); }
  function $$(sel, raizBusqueda) {
    return Array.prototype.slice.call((raizBusqueda || document).querySelectorAll(sel));
  }
  function limpiar(nodo) { while (nodo && nodo.firstChild) nodo.removeChild(nodo.firstChild); return nodo; }
  function texto(tag, contenido, clase) {
    var el = document.createElement(tag);
    if (contenido !== undefined && contenido !== null) el.textContent = String(contenido);
    if (clase) el.className = clase;
    return el;
  }
  function campo(etiquetaTexto, control, ayuda, ancho) {
    var p = document.createElement('p');
    p.className = 'campo' + (ancho === 'ancho' ? ' rejilla-ancha' : '');
    var id = control.id || ('c' + Math.random().toString(36).slice(2, 9));
    control.id = id;
    var label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = etiquetaTexto;
    p.appendChild(label);
    p.appendChild(control);
    if (ayuda) {
      var s = texto('span', ayuda, 'ayuda');
      var idAyuda = id + '-ayuda';
      s.id = idAyuda;
      control.setAttribute('aria-describedby', idAyuda);
      p.appendChild(s);
    }
    return p;
  }
  function entrada(tipo, valor, extra) {
    var i = document.createElement('input');
    i.type = tipo;
    if (valor !== undefined && valor !== null) i.value = String(valor);
    if (extra) Object.keys(extra).forEach(function (k) { i.setAttribute(k, extra[k]); });
    return i;
  }
  function seleccion(opciones, valor, extra) {
    var s = document.createElement('select');
    if (extra) Object.keys(extra).forEach(function (k) { s.setAttribute(k, extra[k]); });
    opciones.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.valor;
      op.textContent = o.etiqueta;
      if (String(o.valor) === String(valor === undefined || valor === null ? '' : valor)) op.selected = true;
      s.appendChild(op);
    });
    return s;
  }
  function boton(etiqueta, clase, alPulsar) {
    var b = texto('button', etiqueta, 'boton' + (clase ? ' ' + clase : ''));
    b.type = 'button';
    if (alPulsar) b.addEventListener('click', alPulsar);
    return b;
  }

  /** Aviso flotante accesible (aria-live en #avisos). */
  function avisar(mensaje, clase, opciones) {
    var opts = opciones || {};
    var contenedor = $('#avisos');
    var caja = texto('div', null, 'aviso ' + (clase || 'aviso-info'));
    caja.appendChild(texto('span', mensaje));
    if (opts.accion && opts.accion.etiqueta) {
      caja.appendChild(boton(opts.accion.etiqueta, 'boton-pequeno', function () {
        contenedor.removeChild(caja);
        opts.accion.alPulsar();
      }));
    }
    if (opts.temporal !== false) {
      setTimeout(function () { if (caja.parentNode) caja.parentNode.removeChild(caja); }, opts.ms || 8000);
    }
    contenedor.appendChild(caja);
    return caja;
  }

  function avisoGlobal(mensaje, clase) {
    var caja = $('#aviso-global');
    if (!mensaje) { caja.hidden = true; caja.textContent = ''; return; }
    caja.className = 'aviso ' + (clase || 'aviso-alerta');
    caja.textContent = mensaje;
    caja.hidden = false;
  }

  // ------------------------------------------------------------------
  // Registro de intentos y errores (D-57, D-58, D-64): sin datos personales
  // ------------------------------------------------------------------
  function registrarLog(entradaLog) {
    var linea = N.marcaAhora() + ' | ' + entradaLog + '\n';
    raiz.console && raiz.console.info && raiz.console.info('GGTO log:', linea.trim());
    if (!(estado.almacen && estado.almacen.tipo === 'carpeta' && estado.almacen.carpeta)) return;
    // D-64: si `incidencias.log` supera 5 MB se rota a `incidencias.1.log`
    // (hasta `incidencias.5.log`); el mas antiguo se descarta.
    A.rotarLogIncidencias(estado.almacen).catch(function () { return null; }).then(function () {
      return estado.almacen.carpeta.getFileHandle(CONST.ARCHIVO_INCIDENCIAS, { create: true });
    }).then(function (handle) {
      return handle.getFile().then(function (archivo) {
        return archivo.text().then(function (previo) {
          return handle.createWritable().then(function (w) {
            return w.write(previo + linea).then(function () { return w.close(); });
          });
        });
      });
    }).catch(function () { /* el log nunca interrumpe la operación */ });
  }

  // ------------------------------------------------------------------
  // Arranque y diagnóstico del entorno (CU-22)
  // ------------------------------------------------------------------
  function iniciar() {
    estado.cliente = detectarCliente();
    var aviso = $('#aviso-contexto');
    aviso.hidden = true;

    if (raiz.location.protocol === 'file:') {
      aviso.hidden = false;
      aviso.className = 'aviso aviso-error';
      aviso.textContent = 'Abra la página con servir-ggto.ps1 (http://localhost:8787). ' +
        'Desde file:// no se pueden leer ni escribir los JSON.';
      $('#btn-autorizar').disabled = true;
      $('#btn-archivos').disabled = true;
      $('#btn-descarga').disabled = true;
      mostrarPaso('paso-carpeta');
      return;
    }

    if (!A.soportado()) {
      $('#modo-descarga-aviso').hidden = false;
      $('#btn-autorizar').disabled = true;
      $('#btn-archivos').disabled = true;
      aviso.hidden = false;
      aviso.className = 'aviso aviso-alerta';
      aviso.textContent = 'Este navegador no permite escribir los JSON: use Edge o Chrome 86+. ' +
        'Se habilita el modo descarga, que exige sesión válida.';
    } else if (!estado.cliente.soportado) {
      aviso.hidden = false;
      aviso.className = 'aviso aviso-alerta';
      aviso.textContent = 'Navegador ' + estado.cliente.nombre + ' ' + estado.cliente.version +
        ': se recomienda Edge o Chrome 86 o superior.';
    }

    mostrarPaso('paso-carpeta');
    conectarEventos();
  }

  function detectarCliente() {
    var ua = raiz.navigator.userAgent || '';
    var nombre = 'desconocido';
    var version = '';
    var m = /Edg\/(\d+)/.exec(ua);
    if (m) { nombre = 'Edge'; version = m[1]; }
    else if ((m = /Chrome\/(\d+)/.exec(ua))) { nombre = 'Chrome'; version = m[1]; }
    else if ((m = /Firefox\/(\d+)/.exec(ua))) { nombre = 'Firefox'; version = m[1]; }
    else if ((m = /Version\/(\d+).*Safari/.exec(ua))) { nombre = 'Safari'; version = m[1]; }
    var mayor = parseInt(version, 10);
    var soportado = (nombre === 'Edge' || nombre === 'Chrome') && mayor >= 86;
    return {
      nombre: nombre, version: version, soportado: soportado,
      fs: A.soportado(), dialogo: typeof HTMLDialogElement !== 'undefined'
    };
  }

  function mostrarPaso(id) {
    ['paso-carpeta', 'paso-primer-supervisor', 'paso-sesion', 'paso-cambio'].forEach(function (p) {
      var el = document.getElementById(p);
      if (el) el.hidden = (p !== id);
    });
    var focos = {
      'paso-carpeta': '#btn-autorizar',
      'paso-primer-supervisor': '#ps-nombre',
      'paso-sesion': '#login-p00',
      'paso-cambio': '#nueva-clave'
    };
    var foco = $(focos[id]);
    if (foco && !foco.disabled) foco.focus();
  }

  function conectarEventos() {
    $('#btn-autorizar').addEventListener('click', function () {
      A.abrirCarpeta().then(function (almacen) {
        estado.almacen = almacen;
        estado.modoPorArchivo = false;
        $('#estado-carpeta').textContent = 'Carpeta autorizada: ' + almacen.describir();
        return cargarDatos();
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return;
        $('#estado-carpeta').textContent = 'No se pudo autorizar la carpeta: ' + A.errorDe(e);
      });
    });

    $('#btn-archivos').addEventListener('click', function () {
      A.abrirArchivos().then(function (almacen) {
        estado.almacen = almacen;
        estado.modoPorArchivo = true;
        $('#estado-carpeta').textContent = 'Archivos autorizados uno a uno: ' + almacen.describir();
        return cargarDatos();
      }).catch(function (e) {
        $('#estado-carpeta').textContent = 'No se pudieron autorizar los archivos: ' + A.errorDe(e);
      });
    });

    $('#form-acceso').addEventListener('submit', function (ev) {
      ev.preventDefault();
      intentarSesion();
    });

    $('#form-cambio').addEventListener('submit', function (ev) {
      ev.preventDefault();
      guardarClaveNueva();
    });
    $('#form-primer-supervisor').addEventListener('submit', function (ev) {
      ev.preventDefault();
      crearPrimerSupervisor();
    });
    $('#btn-cancelar-cambio').addEventListener('click', function () {
      cancelarCambioClave();
    });

    $('#btn-descarga').addEventListener('click', function () {
      activarModoDescarga();
    });

    $('#btn-cerrar-sesion').addEventListener('click', function () {
      cerrarSesion('La sesión se cerró. Lo ya guardado no se pierde.');
    });

    raiz.addEventListener('beforeunload', function (ev) {
      if (estado.sesion) {
        ev.preventDefault();
        ev.returnValue = '';
      }
    });

    setInterval(vigilarSesion, 30000);
  }

  function cargarDatos() {
    return estado.almacen.cargar().then(function (res) {
      estado.cargado = true;
      estado.resumen = res.archivos;
      estado.archivosFaltantes = res.archivos.filter(function (a) { return !a.existe; }).map(function (a) { return a.archivo; });
      estado.archivosInvalidos = res.archivos.filter(function (a) { return a.invalido; });
      var estadoCaja = $('#estado-carpeta');
      var detalle = 'Archivos presentes: ' + (res.archivos.length - estado.archivosFaltantes.length) + ' de ' + res.archivos.length + '.';
      if (estado.archivosFaltantes.length) {
        detalle += ' Faltan: ' + estado.archivosFaltantes.join(', ') + '. Puede crearlos vacíos con la estructura correcta.';
      }
      estadoCaja.textContent = detalle;
      if (estado.archivosFaltantes.length || estado.archivosInvalidos.length) {
        prepararCreacionEstructura();
      } else {
        $('#paso-sesion').hidden = false;
        $('#boton-crear-estructura') && $('#boton-crear-estructura').remove();
      }
      // Sin ningún técnico en el padrón nadie podría abrir sesión ni crear los
      // padrones (D-35 + D-50): se ofrece el alta del primer supervisor.
      var tecnicos = estado.almacen.datos['tecnicos.json'];
      if (!estado.archivosFaltantes.length && Array.isArray(tecnicos) && tecnicos.length === 0) {
        mostrarPaso('paso-primer-supervisor');
        return res;
      }
      mostrarPaso('paso-sesion');
      return res;
    }).catch(function (e) {
      $('#estado-carpeta').textContent = 'Error al leer los archivos: ' + A.errorDe(e);
      throw e;
    });
  }

  /** Estados vacíos y errores (Paso 2.6): explica y ofrece crear la estructura. */
  function prepararCreacionEstructura() {
    var paso = $('#paso-carpeta');
    var existente = document.getElementById('boton-crear-estructura');
    if (existente) existente.parentNode.removeChild(existente);
    var caja = texto('div', null, 'aviso aviso-alerta');
    caja.id = 'boton-crear-estructura';
    var detalle = [];
    if (estado.archivosFaltantes.length) detalle.push('faltan ' + estado.archivosFaltantes.length + ' archivo(s): ' + estado.archivosFaltantes.join(', '));
    estado.archivosInvalidos.forEach(function (a) { detalle.push(a.archivo + ' (' + a.invalido + ')'); });
    caja.appendChild(texto('p', 'No se puede trabajar todavía: ' + detalle.join(' · ') + '. ' +
      'Puede crearlos con la estructura correcta y vacíos de casos (no se inventa ningún dato).'));
    caja.appendChild(boton('Crear los archivos que faltan', 'boton-primario', function () {
      var seleccion = estado.archivosFaltantes.slice();
      if (!seleccion.length) seleccion = null;
      estado.almacen.crearEstructura(seleccion).then(function (r) {
        avisar('Archivos creados y verificados: ' + r.creados.join(', '), 'aviso-info');
        return cargarDatos();
      }).catch(function (e) {
        avisar('No se pudieron crear los archivos: ' + A.errorDe(e), 'aviso-error', { temporal: false });
      });
    }));
    paso.appendChild(caja);
  }

  // ------------------------------------------------------------------
  // Primera ejecución: alta del primer supervisor (bootstrap del padrón)
  // ------------------------------------------------------------------
  function crearPrimerSupervisor() {
    var msg = $('#msg-primer-supervisor');
    var nombre = $('#ps-nombre').value;
    var cedula = $('#ps-cedula').value;
    var p00 = $('#ps-p00').value;
    var clave = $('#ps-clave').value;
    var clave2 = $('#ps-clave2').value;
    var errores = [];
    if (!N.obligatorio(nombre)) errores.push('Complete: nombre');
    if (!N.obligatorio(cedula)) errores.push('Complete: cédula');
    if (!N.obligatorio(p00)) errores.push('Complete: P00');
    var v = N.validarCambioClave(clave, clave2);
    if (!v.valido) errores = errores.concat(v.errores);
    if (errores.length) { msg.textContent = errores.join(' · '); return; }
    msg.textContent = '';

    var sal = N.generarSal(16, raiz.crypto);
    N.hashClave(clave, sal, raiz.crypto.subtle).then(function (hash) {
      var tecnico = {
        nombre: String(nombre).trim(),
        cedula: String(cedula).trim(),
        P00: String(p00).trim(),
        clave_hash: hash,
        clave_sal: sal,
        clave_fecha_cambio: N.formatearFecha(new Date()),
        clave_cambio_obligatorio: 'SI',
        telefono: '', correo: '', especialidad: '',
        status: 'Activo',
        rol: 'Supervisor'
      };
      var lista = [tecnico];
      var escribir = function (opciones) {
        if (estado.modoDescarga) {
          return descargarArchivo('tecnicos.json', lista).then(function () {
            avisar('Modo descarga: se descargó tecnicos.json. Reemplácela en C:\\GGTO\\datos y vuelva a abrir la página.', 'aviso-alerta', { temporal: false });
          });
        }
        return estado.almacen.guardarArchivo('tecnicos.json', lista, opciones || {}).then(function () {
          avisar('Supervisor creado: entre con el P00 ' + tecnico.P00 + '; deberá cambiar la contraseña (D-39).', 'aviso-info', { temporal: false });
        });
      };
      return escribir({}).then(function () {
        registrarLog('bootstrap | primer supervisor creado | p00=' + tecnico.P00);
        estado.almacen.datos['tecnicos.json'] = lista;
        $('#ps-nombre').value = ''; $('#ps-cedula').value = ''; $('#ps-p00').value = '';
        $('#ps-clave').value = ''; $('#ps-clave2').value = '';
        mostrarPaso('paso-sesion');
      }).catch(function (e) {
        if (e && e.tipo === 'conflicto') {
          manejarConflicto('tecnicos.json', lista, function () {
            return escribir({ sobrescribir: true }).then(function () {
              estado.almacen.datos['tecnicos.json'] = lista;
              mostrarPaso('paso-sesion');
            });
          }, e);
          return;
        }
        throw e;
      });
    }).catch(function (e) {
      msg.textContent = 'No se pudo crear el supervisor: ' + A.errorDe(e);
    });
  }

  // ------------------------------------------------------------------
  // Sesión (CU-01)
  // ------------------------------------------------------------------
  function intentarSesion() {
    var p00 = $('#login-p00').value;
    var clave = $('#login-clave').value;
    var msg = $('#msg-acceso');
    msg.className = 'mensaje';
    msg.textContent = '';

    var tecnicos = estado.almacen && estado.almacen.datos ? estado.almacen.datos['tecnicos.json'] : null;
    if (!tecnicos || !Array.isArray(tecnicos) || tecnicos.length === 0) {
      msg.textContent = CONST.MSG.SIN_PADRON + ': revise C:\\GGTO\\datos\\tecnicos.json (puede crearlo el supervisor en CONFIGURACION).';
      registrarLog('sesion | padron de tecnicos no disponible');
      return;
    }

    N.verificarCredencial(tecnicos, p00, clave, { subtle: raiz.crypto && raiz.crypto.subtle }).then(function (resultado) {
      if (!resultado.ok) {
        estado.intentos++;
        $('#contador-intentos').textContent = 'Intentos fallidos: ' + estado.intentos +
          ' (la cuenta no se bloquea; el intento queda registrado, D-57)';
        msg.textContent = resultado.mensaje;
        registrarLog('sesion | intento fallido | motivo=' + resultado.motivo + ' | p00_intentado=' + String(p00).trim());
        $('#login-clave').value = '';
        $('#login-clave').focus();
        return;
      }
      estado.tecnicoPendiente = resultado.tecnico;
      if (resultado.exigeCambio) {
        $('#msg-cambio').textContent = resultado.mensajeVigencia;
        mostrarPaso('paso-cambio');
        return;
      }
      abrirSesion(resultado.tecnico);
    }).catch(function (e) {
      msg.textContent = 'No se pudo verificar la credencial: ' + A.errorDe(e);
    });
  }

  function guardarClaveNueva() {
    var tecnico = estado.tecnicoPendiente;
    if (!tecnico) { mostrarPaso('paso-sesion'); return; }
    var nueva = $('#nueva-clave').value;
    var conf = $('#confirmar-clave').value;
    var validacion = N.validarCambioClave(nueva, conf);
    var msg = $('#msg-cambio-error');
    if (!validacion.valido) {
      msg.textContent = validacion.errores.join(' · ');
      return;
    }
    msg.textContent = '';
    guardarClaveDeTecnico(tecnico, nueva, {}).then(function (copia) {
      $('#nueva-clave').value = '';
      $('#confirmar-clave').value = '';
      registrarLog('sesion | cambio de contrasena | p00=' + copia.P00);
      abrirSesion(copia);
    }).catch(function (e) {
      if (e && e.tipo === 'conflicto') {
        manejarConflicto('tecnicos.json', null, function () {
          return guardarClaveDeTecnico(tecnico, nueva, { sobrescribir: true });
        }, e);
        return;
      }
      msg.textContent = 'No se pudo guardar la contraseña: ' + A.errorDe(e);
    });
  }

  /** Regenera sal y hash y persiste la credencial del técnico (D-39). */
  function guardarClaveDeTecnico(tecnico, nuevaClave, opciones) {
    var sal = N.generarSal(16, raiz.crypto);
    return N.hashClave(nuevaClave, sal, raiz.crypto.subtle).then(function (hash) {
      var lista = (estado.almacen.datos['tecnicos.json'] || []).slice();
      var indice = -1;
      for (var i = 0; i < lista.length; i++) {
        if (String(lista[i].P00 || '') === String(tecnico.P00 || '')) { indice = i; break; }
      }
      var copia = Object.assign({}, tecnico, {
        clave_hash: hash,
        clave_sal: sal,
        clave_fecha_cambio: N.formatearFecha(new Date()),
        clave_cambio_obligatorio: 'NO'
      });
      if (indice >= 0) lista[indice] = copia; else lista.push(copia);
      return estado.almacen.guardarArchivo('tecnicos.json', lista, opciones || {}).then(function () {
        return copia;
      });
    });
  }

  function cancelarCambioClave() {
    estado.tecnicoPendiente = null;
    $('#nueva-clave').value = '';
    $('#confirmar-clave').value = '';
    $('#msg-cambio-error').textContent = '';
    $('#msg-acceso').textContent = 'La sesión no se abrió: debe cambiar la contraseña antes de operar.';
    mostrarPaso('paso-sesion');
  }

  function abrirSesion(tecnico) {
    var cuadrillas = estado.almacen.datos['cuadrillas.json'] || [];
    var rol = N.resolverRol(tecnico);
    var ambito = N.ambitoSesion({ rol: rol, tecnico: tecnico }, cuadrillas);
    estado.sesion = {
      tecnico: tecnico,
      P00: String(tecnico.P00 || ''),
      nombre: String(tecnico.nombre || ''),
      cedula: String(tecnico.cedula || ''),
      rol: rol,
      cuadrilla: ambito.cuadrilla,
      soloLectura: ambito.soloLectura,
      inicio: new Date().getTime()
    };
    try { raiz.sessionStorage.setItem(CLAVE_SESION, String(estado.sesion.inicio)); } catch (e) { /* sin sessionStorage */ }
    estado.tecnicoPendiente = null;
    estado.intentos = 0;
    $('#contador-intentos').textContent = 'Intentos fallidos: 0';
    $('#login-clave').value = '';
    $('#acceso').hidden = true;
    $('#app').hidden = false;
    $('#sesion-datos').textContent = 'Sesión: ' + estado.sesion.nombre + ' · ' + estado.sesion.P00 +
      ' · cédula ' + (estado.sesion.cedula || '—') + ' · ' + estado.sesion.rol;
    $('#sesion-cuadrilla').textContent = estado.sesion.rol === 'Supervisor'
      ? 'Supervisor: todas las cuadrillas y todos los padrones.'
      : (estado.sesion.cuadrilla ? 'Cuadrilla: ' + estado.sesion.cuadrilla : CONST.MSG.SIN_CUADRILLA);
    registrarLog('sesion | inicio | p00=' + estado.sesion.P00 + ' | rol=' + rol + ' | cuadrilla=' + (estado.sesion.cuadrilla || '-'));
    construirPestanas();
    avisoSinIngesta();
    var destino = estado.pestanaSolicitada || 'panel';
    estado.pestanaSolicitada = null;
    activarPestana(destino);
  }

  function cerrarSesion(mensaje) {
    estado.sesion = null;
    estado.tab = null;
    try { raiz.sessionStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada */ }
    // Ocultar de inmediato los datos ya mostrados (D-50, RNF-08).
    $('#app').hidden = true;
    PESTANAS.forEach(function (p) {
      var seccion = document.getElementById('seccion-' + p.id);
      if (seccion) limpiar(seccion);
    });
    limpiar($('#pestanas'));
    PESTANAS.forEach(function (p) {
      var seccion = document.getElementById('seccion-' + p.id);
      if (seccion) seccion.hidden = true;
    });
    avisoGlobal('');
    limpiar($('#avisos'));
    $('#acceso').hidden = false;
    $('#msg-acceso').textContent = mensaje || '';
    mostrarPaso('paso-sesion');
    if (mensaje) registrarLog('sesion | cierre | ' + mensaje);
  }

  function vigilarSesion() {
    if (!estado.sesion) return;
    var transcurrido = new Date().getTime() - estado.sesion.inicio;
    if (transcurrido > CONST.MSG_HORAS_SESION * 3600 * 1000) {
      cerrarSesion(CONST.MSG.SESION_EXPIRADA);
    }
  }

  function exigirSesion() {
    if (estado.sesion) return true;
    avisoGlobal(CONST.MSG.SIN_SESION);
    $('#acceso').hidden = false;
    mostrarPaso('paso-sesion');
    return false;
  }

  /** Autorización por rol y ámbito; registra las denegaciones (D-35, RNF-12). */
  function autorizar(accion, caso) {
    if (!exigirSesion()) return false;
    var ambito = N.ambitoSesion(estado.sesion, estado.almacen.datos['cuadrillas.json'] || []);
    var r = N.autorizar(ambito, accion, caso);
    if (!r.permitido) {
      avisoGlobal(r.mensaje);
      registrarLog('permiso | accion=' + accion + ' | p00=' + estado.sesion.P00 + ' | resultado=denegado | ' + r.mensaje);
      return false;
    }
    avisoGlobal('');
    return true;
  }

  function ambito() {
    if (!estado.sesion) return null;
    return N.ambitoSesion(estado.sesion, estado.almacen.datos['cuadrillas.json'] || []);
  }

  // ------------------------------------------------------------------
  // Modo descarga (RNF-03, CU-22): exige sesión válida
  // ------------------------------------------------------------------
  function activarModoDescarga() {
    if (estado.sesion) { modoDescargaListo(); return; }
    var p00 = $('#login-p00').value;
    var clave = $('#login-clave').value;
    var tecnicos = estado.almacen && estado.almacen.datos ? estado.almacen.datos['tecnicos.json'] : null;
    if (!tecnicos || !Array.isArray(tecnicos)) {
      $('#msg-acceso').textContent = 'Identifíquese para operar en modo descarga: ' + CONST.MSG.SIN_PADRON;
      return;
    }
    N.verificarCredencial(tecnicos, p00, clave, { subtle: raiz.crypto.subtle }).then(function (r) {
      if (!r.ok) {
        $('#msg-acceso').textContent = 'Identifíquese para operar en modo descarga. ' + r.mensaje;
        registrarLog('sesion | modo descarga denegado | motivo=' + r.motivo);
        return;
      }
      if (r.exigeCambio) {
        estado.tecnicoPendiente = r.tecnico;
        $('#msg-cambio').textContent = r.mensajeVigencia;
        mostrarPaso('paso-cambio');
        return;
      }
      estado.sesionPendienteDescarga = r.tecnico;
      modoDescargaListo();
    });
  }

  function modoDescargaListo() {
    estado.modoDescarga = true;
    if (!estado.sesion) {
      avisar('Modo descarga listo. Cada guardado descargará el JSON completo: reemplace el archivo en C:\\GGTO\\datos al terminar.',
        'aviso-alerta', { temporal: false });
    } else {
      avisar('Modo descarga: reemplace el archivo en C:\\GGTO\\datos al terminar.', 'aviso-alerta', { temporal: false });
    }
    var ruta = $('#estado-carpeta');
    if (ruta) ruta.textContent = 'Modo descarga: los cambios se guardarán como archivo descargado, no en disco.';
  }

  function descargarArchivo(nombre, datos) {
    var contenido = nombre === CONST.ARCHIVO_HISTORIAL ? String(datos) : N.serializarJSON(datos);
    return A.descargar(nombre, contenido);
  }

  // ------------------------------------------------------------------
  // Pestañas (RF-01, D-35, RNF-12)
  // ------------------------------------------------------------------
  function construirPestanas() {
    var nav = limpiar($('#pestanas'));
    var ambitoActual = ambito();
    PESTANAS.forEach(function (p) {
      var permitida = !p.accion || N.permite(estado.sesion.rol, p.accion);
      var b = texto('button', p.etiqueta);
      b.type = 'button';
      b.id = 'tab-' + p.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'seccion-' + p.id);
      b.setAttribute('aria-selected', 'false');
      b.tabIndex = -1;
      if (!permitida) {
        b.disabled = true;
        b.title = CONST.MSG.ROL;
        b.setAttribute('aria-disabled', 'true');
      } else {
        b.addEventListener('click', function () { activarPestana(p.id); });
        b.addEventListener('keydown', function (ev) { navegarPestanas(ev, p.id); });
      }
      nav.appendChild(b);
    });
    if (ambitoActual && ambitoActual.soloLectura) {
      avisoGlobal(CONST.MSG.SIN_CUADRILLA + '. Solicite su inclusión en CONFIGURACION/CUADRILLA.');
    }
  }

  function navegarPestanas(ev, id) {
    var habilitadas = PESTANAS.filter(function (p) {
      return !p.accion || N.permite(estado.sesion.rol, p.accion);
    }).map(function (p) { return p.id; });
    var i = habilitadas.indexOf(id);
    var destino = null;
    if (ev.key === 'ArrowRight') destino = habilitadas[(i + 1) % habilitadas.length];
    else if (ev.key === 'ArrowLeft') destino = habilitadas[(i - 1 + habilitadas.length) % habilitadas.length];
    else if (ev.key === 'Home') destino = habilitadas[0];
    else if (ev.key === 'End') destino = habilitadas[habilitadas.length - 1];
    if (!destino) return;
    ev.preventDefault();
    activarPestana(destino);
    var b = document.getElementById('tab-' + destino);
    if (b) b.focus();
  }

  function activarPestana(id) {
    if (!estado.sesion) { estado.pestanaSolicitada = id; exigirSesion(); return; }
    var def = null;
    for (var i = 0; i < PESTANAS.length; i++) if (PESTANAS[i].id === id) def = PESTANAS[i];
    if (!def) return;
    if (def.accion && !N.permite(estado.sesion.rol, def.accion)) {
      avisoGlobal(CONST.MSG.ROL);
      registrarLog('permiso | pestana=' + id + ' | p00=' + estado.sesion.P00 + ' | resultado=denegado');
      return;
    }
    estado.tab = id;
    PESTANAS.forEach(function (p) {
      var seccion = document.getElementById('seccion-' + p.id);
      var b = document.getElementById('tab-' + p.id);
      var activo = p.id === id;
      if (seccion) seccion.hidden = !activo;
      if (b) {
        b.setAttribute('aria-selected', activo ? 'true' : 'false');
        b.tabIndex = activo ? 0 : -1;
      }
    });
    var contenedor = document.getElementById('seccion-' + id);
    var modulo = raiz[def.modulo];
    if (!modulo || typeof modulo.render !== 'function') {
      limpiar(contenedor);
      contenedor.appendChild(texto('p', 'Módulo no disponible: ' + def.modulo, 'aviso aviso-error'));
      return;
    }
    modulo.render(contenedor, contexto());
    contenedor.setAttribute('aria-labelledby', 'tab-' + id);
  }

  function contexto() {
    return {
      estado: estado,
      nucleo: N,
      almacen: A,
      sesion: estado.sesion,
      ambito: ambito(),
      autorizar: autorizar,
      avisar: avisar,
      avisoGlobal: avisoGlobal,
      registrarLog: registrarLog,
      limpiar: limpiar,
      texto: texto,
      campo: campo,
      entrada: entrada,
      seleccion: seleccion,
      boton: boton,
      $: $,
      $$: $$,
      descargarArchivo: descargarArchivo,
      recargarDatos: recargarDatos,
      manejarConflicto: manejarConflicto,
      modoDescarga: function () { return estado.modoDescarga; },
      reactivarPestana: function () { activarPestana(estado.tab || 'panel'); }
    };
  }

  function recargarDatos() {
    if (!estado.almacen) return Promise.resolve(null);
    return estado.almacen.cargar().then(function (res) {
      estado.resumen = res.archivos;
      estado.archivosFaltantes = res.archivos.filter(function (a) { return !a.existe; }).map(function (a) { return a.archivo; });
      avisar('Datos recargados desde disco: ' + N.marcaAhora(), 'aviso-info');
      if (estado.tab) activarPestana(estado.tab);
      return res;
    });
  }

  /**
   * Conflicto de concurrencia (D-41, RNF-14): detiene el guardado y ofrece
   * «Recargar» o «Sobrescribir» mostrando quién y cuándo modificó.
   */
  function manejarConflicto(nombre, datos, alGuardarSobrescribiendo, errorConflicto) {
    var detalle = (errorConflicto && errorConflicto.detalle) || {};
    var mensaje = 'Conflicto: el archivo ' + nombre + ' fue modificado por ' +
      (detalle.usuario_modificacion || 'otro usuario') + ' el ' +
      (detalle.fecha_modificacion || 'fecha desconocida') + '. Recargue o sobrescriba.';
    var caja = avisar(mensaje, 'aviso-error', {
      temporal: false,
      accion: {
        etiqueta: 'Recargar',
        alPulsar: function () { recargarDatos(); }
      }
    });
    caja.appendChild(boton('Sobrescribir', 'boton-peligro boton-pequeno', function () {
      caja.parentNode.removeChild(caja);
      var accion = alGuardarSobrescribiendo || function () {
        return estado.almacen.guardarArchivo(nombre, datos, { sobrescribir: true });
      };
      accion().then(function () {
        registrarLog('conflicto | ' + nombre + ' | p00=' + (estado.sesion ? estado.sesion.P00 : '-') + ' | decision=sobrescribir');
        avisar('Guardado con sobrescritura consciente: ' + nombre, 'aviso-info');
        if (estado.tab) activarPestana(estado.tab);
      }).catch(function (err) {
        avisar('No se pudo guardar ' + nombre + ': ' + A.errorDe(err), 'aviso-error', { temporal: false });
      });
    }));
    registrarLog('conflicto | ' + nombre + ' | p00=' + (estado.sesion ? estado.sesion.P00 : '-'));
  }

  function avisoSinIngesta() {
    var hoy = N.formatearFecha(new Date());
    var casos = estado.almacen.datos['averias.json'] || [];
    var deHoy = Array.isArray(casos) && casos.some(function (c) { return String(c.ingreso || '') === hoy; });
    if (!deHoy && Array.isArray(casos) && casos.length === 0) {
      avisoGlobal('Sin ingesta: el maestro está vacío. La carga del CSV llega en el ciclo C2; ' +
        'en C1 puede crear casos solo con el alta manual del ciclo C3.');
    }
  }

  // ------------------------------------------------------------------
  // API interna compartida por los módulos
  // ------------------------------------------------------------------
  raiz.GGTO = {
    estado: estado,
    iniciar: iniciar,
    contexto: contexto,
    autorizar: autorizar,
    avisar: avisar,
    avisoGlobal: avisoGlobal,
    limpiar: limpiar,
    texto: texto,
    campo: campo,
    entrada: entrada,
    seleccion: seleccion,
    boton: boton,
    registrarLog: registrarLog,
    recargarDatos: recargarDatos,
    manejarConflicto: manejarConflicto,
    activarPestana: activarPestana,
    PESTANAS: PESTANAS,
    $: $,
    $$: $$
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
