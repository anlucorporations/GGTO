/*
 * GGTO-v1 - configuracion.js  (ciclo C1)
 * CONFIGURACION con seis sub-pestañas: CENTRAL (CU-02), TECNICOS (CU-03),
 * FLOTA (CU-04), CUADRILLA (CU-05), SECTORES (CU-06) y PALABRAS CLAVE (CU-07).
 * Alta, edición y baja de cada archivo de configuración con escritura
 * verificada (D-42, RNF-15) y detección de conflicto (D-41, RNF-14).
 * Solo el supervisor edita (D-35, RNF-12); el operador no ve la pestaña.
 */
(function (raiz) {
  'use strict';

  var N = raiz.GGTO_NUCLEO;
  var A = raiz.GGTO_ALMACEN;
  var CONST = N.CONST;

  var SUBSECCIONES = [
    { id: 'central', etiqueta: 'CENTRAL', archivo: 'central.json' },
    { id: 'tecnicos', etiqueta: 'TECNICOS', archivo: 'tecnicos.json' },
    { id: 'flota', etiqueta: 'FLOTA', archivo: 'flota.json' },
    { id: 'cuadrilla', etiqueta: 'CUADRILLA', archivo: 'cuadrillas.json' },
    { id: 'sectores', etiqueta: 'SECTORES', archivo: 'sectores.json' },
    { id: 'claves', etiqueta: 'PALABRAS CLAVE', archivo: 'claves_clasificacion.json' }
  ];

  var subActiva = 'central';
  var ultimoContexto = null;

  // ------------------------------------------------------------------
  // Render principal
  // ------------------------------------------------------------------
  function render(contenedor, ctx) {
    ultimoContexto = ctx;
    if (!N.permite(ctx.sesion.rol, 'config.central')) {
      ctx.limpiar(contenedor);
      contenedor.appendChild(avisoRol(ctx));
      return;
    }
    ctx.limpiar(contenedor);
    var bloque = ctx.texto('div', null, 'bloque');
    bloque.appendChild(ctx.texto('h2', 'CONFIGURACION'));
    bloque.appendChild(ctx.texto('p', 'Alta, edición y baja de los padrones y catálogos. ' +
      'Cada guardado se verifica por relectura y conserva las 10 últimas versiones .bak del maestro (D-42).'));

    var nav = ctx.texto('div', null, 'subpestanas');
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Sub-pestañas de configuración');
    SUBSECCIONES.forEach(function (s) {
      var b = ctx.boton(s.etiqueta, null, function () {
        subActiva = s.id;
        renderConfig(contenedor, ctx);
      });
      b.id = 'subtab-' + s.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', s.id === subActiva ? 'true' : 'false');
      nav.appendChild(b);
    });
    bloque.appendChild(nav);

    var cuerpo = ctx.texto('div');
    cuerpo.id = 'config-cuerpo';
    cuerpo.setAttribute('role', 'tabpanel');
    bloque.appendChild(cuerpo);
    contenedor.appendChild(bloque);
    renderConfig(contenedor, ctx);
  }

  function renderConfig(contenedor, ctx) {
    var cuerpo = document.getElementById('config-cuerpo');
    if (!cuerpo) return;
    SUBSECCIONES.forEach(function (s) {
      var b = document.getElementById('subtab-' + s.id);
      if (b) b.setAttribute('aria-selected', s.id === subActiva ? 'true' : 'false');
    });
    ctx.limpiar(cuerpo);
    if (subActiva === 'central') renderCentral(cuerpo, ctx);
    else if (subActiva === 'tecnicos') renderTecnicos(cuerpo, ctx);
    else if (subActiva === 'flota') renderFlota(cuerpo, ctx);
    else if (subActiva === 'cuadrilla') renderCuadrillas(cuerpo, ctx);
    else if (subActiva === 'sectores') renderSectores(cuerpo, ctx);
    else renderClaves(cuerpo, ctx);
  }

  function avisoRol(ctx) {
    var caja = ctx.texto('div', null, 'aviso aviso-error');
    caja.appendChild(ctx.texto('p', CONST.MSG.ROL + ': la configuración de padrones es exclusiva del supervisor (D-35, RNF-12).'));
    return caja;
  }

  // ------------------------------------------------------------------
  // Utilidades compartidas
  // ------------------------------------------------------------------
  function leerLista(texto) {
    return String(texto || '').split(/[,;\n]/).map(function (v) { return v.trim(); })
      .filter(function (v) { return v !== ''; });
  }

  function escribirLista(lista) {
    return (Array.isArray(lista) ? lista : []).join(', ');
  }

  function duplicado(lista, campo, valor, indiceExcluido) {
    var v = String(valor || '').trim().toLowerCase();
    for (var i = 0; i < lista.length; i++) {
      if (i === indiceExcluido) continue;
      if (String(lista[i][campo] || '').trim().toLowerCase() === v) return lista[i];
    }
    return null;
  }

  function noVacio(valor) { return N.obligatorio(valor); }

  function guardar(ctx, archivo, datos, mensaje, alTerminar) {
    var promesa;
    if (ctx.modoDescarga()) {
      promesa = ctx.descargarArchivo(archivo, datos);
      ctx.avisar('Modo descarga: se descargó ' + archivo + '. Reemplácela en C:\\GGTO\\datos al terminar.', 'aviso-alerta');
      if (alTerminar) alTerminar();
      return Promise.resolve(true);
    }
    promesa = ctx.almacen.guardarArchivo(archivo, datos, {});
    return promesa.then(function () {
      ctx.registrarLog('config | ' + archivo + ' | p00=' + ctx.sesion.P00 + ' | ' + (mensaje || 'guardado'));
      ctx.avisar(mensaje || (archivo + ' guardado y releído'), 'aviso-info');
      if (alTerminar) alTerminar();
      return true;
    }).catch(function (e) {
      if (e && e.tipo === 'conflicto') {
        ctx.manejarConflicto(archivo, datos, function () {
          return ctx.almacen.guardarArchivo(archivo, datos, { sobrescribir: true }).then(function () {
            ctx.avisar('Guardado con sobrescritura consciente: ' + archivo, 'aviso-info');
            if (alTerminar) alTerminar();
          });
        }, e);
        return false;
      }
      ctx.avisar('No se pudo guardar ' + archivo + ': ' + A.errorDe(e), 'aviso-error', { temporal: false });
      return false;
    });
  }

  function tabla(ctx, columnas, filas, alSeleccionar, indiceSeleccionado) {
    var caja = ctx.texto('div', null, 'tabla-caja');
    var t = ctx.texto('table', null, 'tabla');
    var thead = ctx.texto('thead');
    var trh = ctx.texto('tr');
    columnas.forEach(function (c) { trh.appendChild(ctx.texto('th', c, null)); });
    thead.appendChild(trh);
    t.appendChild(thead);
    var tbody = ctx.texto('tbody');
    if (!filas.length) {
      var trv = ctx.texto('tr', null, 'fila-vacia');
      var tdv = ctx.texto('td', 'Sin registros: use el formulario para agregar el primero.');
      tdv.colSpan = columnas.length;
      trv.appendChild(tdv);
      tbody.appendChild(trv);
    }
    filas.forEach(function (fila, i) {
      var tr = ctx.texto('tr');
      tr.tabIndex = 0;
      if (i === indiceSeleccionado) tr.setAttribute('aria-selected', 'true');
      fila.forEach(function (valor) { tr.appendChild(ctx.texto('td', valor === undefined || valor === null || valor === '' ? '—' : valor)); });
      tr.addEventListener('click', function () { alSeleccionar(i); });
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alSeleccionar(i); }
      });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    caja.appendChild(t);
    return caja;
  }

  // ------------------------------------------------------------------
  // CU-02 CENTRAL: un único registro de 10 campos
  // ------------------------------------------------------------------
  function renderCentral(cuerpo, ctx) {
    var actual = ctx.almacen.datos['central.json'];
    var existe = actual && typeof actual === 'object' && !Array.isArray(actual);
    var datos = existe ? actual : {};
    var campos = [];

    campos.push(ctx.campo('Región', ctx.entrada('text', datos.region)));
    campos.push(ctx.campo('Estado geográfico', ctx.entrada('text', datos.estado_geografico)));
    campos.push(ctx.campo('Capital del estado geográfico', ctx.entrada('text', datos.capital_estado)));
    campos.push(ctx.campo('Municipio', ctx.entrada('text', datos.municipio)));
    campos.push(ctx.campo('Parroquia', ctx.entrada('text', datos.parroquia)));
    campos.push(ctx.campo('Estado operativo', ctx.entrada('text', datos.estado_operativo)));
    campos.push(ctx.campo('Distrito', ctx.entrada('text', datos.distrito)));
    campos.push(ctx.campo('Área', ctx.entrada('text', datos.area)));
    campos.push(ctx.campo('Central', ctx.entrada('text', datos.central)));
    campos.push(ctx.campo('Nombre de la central', ctx.entrada('text', datos.nombre_central)));

    var rejilla = ctx.texto('div', null, 'rejilla');
    campos.forEach(function (c) { rejilla.appendChild(c); });

    var cabecera = ctx.texto('div');
    cabecera.appendChild(ctx.texto('h3', 'CENTRAL — datos operativos de la central (RF-11)'));
    cabecera.appendChild(ctx.texto('p', existe
      ? 'Estos 10 campos filtran el CSV en la ingesta (RT-03).'
      : 'central.json no existe. Complete los 10 campos y pulse «Crear central»; mientras no exista, la ingesta queda bloqueada.'));

    var msg = ctx.texto('p', null, 'mensaje');
    msg.setAttribute('role', 'alert');
    msg.setAttribute('aria-live', 'assertive');

    var guardarBoton = ctx.boton(existe ? 'Guardar' : 'Crear central', 'boton-primario', function () {
      var valores = {};
      var faltan = [];
      var conEspacios = [];
      var controles = rejilla.querySelectorAll('input');
      CONST.CAMPOS_CENTRAL.forEach(function (nombre, i) {
        var bruto = controles[i].value;
        var v = String(bruto).trim();
        if (!noVacio(v)) faltan.push(nombre);
        if (bruto !== v) conEspacios.push(nombre);
        valores[nombre] = v;
      });
      if (faltan.length) {
        msg.className = 'mensaje';
        msg.textContent = 'Complete: ' + faltan.join(', ');
        return;
      }
      if (conEspacios.length) {
        msg.className = 'mensaje';
        msg.textContent = 'Sin espacios al inicio ni al final en: ' + conEspacios.join(', ');
        return;
      }
      msg.className = 'mensaje';
      msg.textContent = '';
      guardar(ctx, 'central.json', valores, 'Central guardada: ' + valores.nombre_central, function () {
        renderConfig(null, ctx);
      });
    });

    cuerpo.appendChild(cabecera);
    cuerpo.appendChild(rejilla);
    var acciones = ctx.texto('p', null, 'acciones');
    acciones.appendChild(guardarBoton);
    cuerpo.appendChild(acciones);
    cuerpo.appendChild(msg);
  }

  // ------------------------------------------------------------------
  // CU-03 TECNICOS: padrón + credencial (hash con sal, D-39)
  // ------------------------------------------------------------------
  function renderTecnicos(cuerpo, ctx) {
    var lista = (ctx.almacen.datos['tecnicos.json'] || []).slice();
    var seleccion = -1;

    cuerpo.appendChild(ctx.texto('h3', 'TECNICOS — padrón de trabajadores y credencial (RF-12, D-39)'));
    cuerpo.appendChild(ctx.texto('p', 'La contraseña nunca se muestra ni se guarda en claro: se almacena como hash SHA-256 con sal propia. ' +
      'Toda alta o restablecimiento obliga a cambiar la contraseña en el siguiente ingreso.'));

    var zona = ctx.texto('div');

    function pintar() {
      ctx.limpiar(zona);
      var filas = lista.map(function (t) {
        return [t.nombre, t.cedula, t.P00, t.telefono, t.correo, t.especialidad, t.status,
          t.clave_fecha_cambio, t.clave_cambio_obligatorio,
          String(N.revisarVigenciaClave(t, new Date()).exigeCambio ? 'Sí' : 'No')];
      });
      zona.appendChild(tabla(ctx,
        ['Nombre', 'Cédula', 'P00', 'Teléfono', 'Correo', 'Especialidad', 'Status',
          'Último cambio de contraseña', 'Cambio obligatorio', '¿Exige cambio?'],
        filas, function (i) { seleccion = i; pintar(); formulario(); }, seleccion));
      zona.appendChild(formulario());
    }

    function formulario() {
      var t = seleccion >= 0 && lista[seleccion] ? lista[seleccion] : {};
      var caja = ctx.texto('div', null, 'bloque');
      caja.appendChild(ctx.texto('h4', seleccion >= 0 ? 'Editar técnico: ' + (t.nombre || '') : 'Nuevo técnico'));
      var rejilla = ctx.texto('div', null, 'rejilla');
      var iNombre = ctx.entrada('text', t.nombre);
      var iCedula = ctx.entrada('text', t.cedula);
      var iP00 = ctx.entrada('text', t.P00);
      var iTel = ctx.entrada('text', t.telefono);
      var iCorreo = ctx.entrada('text', t.correo);
      var iEsp = ctx.entrada('text', t.especialidad);
      var sStatus = ctx.seleccion([{ valor: 'Activo', etiqueta: 'Activo' }, { valor: 'Inactivo', etiqueta: 'Inactivo' }], t.status || 'Activo');
      var sRol = ctx.seleccion([{ valor: 'Operador', etiqueta: 'Operador' }, { valor: 'Supervisor', etiqueta: 'Supervisor' }],
        (t.rol || 'Operador'));
      var iClave = ctx.entrada('password', '', { autocomplete: 'new-password', minlength: '8' });
      var iClave2 = ctx.entrada('password', '', { autocomplete: 'new-password', minlength: '8' });
      rejilla.appendChild(ctx.campo('Nombre', iNombre));
      rejilla.appendChild(ctx.campo('Cédula', iCedula));
      rejilla.appendChild(ctx.campo('P00 (único y obligatorio, D-29)', iP00));
      rejilla.appendChild(ctx.campo('Teléfono', iTel));
      rejilla.appendChild(ctx.campo('Correo', iCorreo));
      rejilla.appendChild(ctx.campo('Especialidad', iEsp));
      rejilla.appendChild(ctx.campo('Status', sStatus, 'Un técnico Inactivo no puede iniciar sesión.'));
      rejilla.appendChild(ctx.campo('Rol', sRol, 'Los dos únicos roles del sistema (D-55).'));
      rejilla.appendChild(ctx.campo('Contraseña (8+ caracteres)', iClave,
        seleccion >= 0 ? 'Déjela vacía para conservar la actual.' : 'Obligatoria en el alta.'));
      rejilla.appendChild(ctx.campo('Repita la contraseña', iClave2));
      caja.appendChild(rejilla);

      var msg = ctx.texto('p', null, 'mensaje');
      msg.setAttribute('role', 'alert');
      var acciones = ctx.texto('p', null, 'acciones');

      acciones.appendChild(ctx.boton(seleccion >= 0 ? 'Guardar cambios' : 'Agregar técnico', 'boton-primario', function () {
        var errores = [];
        if (!noVacio(iNombre.value)) errores.push('Complete: nombre');
        if (!noVacio(iCedula.value)) errores.push('Complete: cédula');
        if (!noVacio(iP00.value)) errores.push('Complete: P00');
        if (!noVacio(sStatus.value)) errores.push('Complete: status');
        var dupCed = duplicado(lista, 'cedula', iCedula.value.trim(), seleccion);
        if (dupCed) errores.push('La cédula ' + iCedula.value.trim() + ' ya existe (técnico: ' + dupCed.nombre + ')');
        var dupP00 = duplicado(lista, 'P00', iP00.value.trim(), seleccion);
        if (dupP00) errores.push('El P00 ' + iP00.value.trim() + ' ya está asignado a ' + dupP00.nombre);
        var cambiarClave = N.obligatorio(iClave.value);
        if (cambiarClave) {
          var v = N.validarCambioClave(iClave.value, iClave2.value);
          if (!v.valido) errores = errores.concat(v.errores);
        } else if (seleccion < 0) {
          errores.push('La contraseña debe tener al menos 8 caracteres');
        }
        if (errores.length) { msg.textContent = errores.join(' · '); return; }
        msg.textContent = '';

        var registro = Object.assign({}, t, {
          nombre: iNombre.value.trim(),
          cedula: iCedula.value.trim(),
          P00: iP00.value.trim(),
          telefono: iTel.value.trim(),
          correo: iCorreo.value.trim(),
          especialidad: iEsp.value.trim(),
          status: sStatus.value,
          rol: sRol.value,
          clave_cambio_obligatorio: t.clave_cambio_obligatorio || 'SI'
        });
        var trabajo;
        if (cambiarClave) {
          var sal = N.generarSal(16, raiz.crypto);
          // Un alta o un cambio de contraseña deja el cambio obligatorio en el
          // siguiente ingreso (CU-03 paso 5, D-39).
          registro.clave_cambio_obligatorio = 'SI';
          trabajo = N.hashClave(iClave.value, sal, raiz.crypto.subtle).then(function (hash) {
            registro.clave_hash = hash;
            registro.clave_sal = sal;
            registro.clave_fecha_cambio = N.formatearFecha(new Date());
          });
        } else {
          trabajo = Promise.resolve();
        }
        trabajo.then(function () {
          var copia = lista.slice();
          if (seleccion >= 0) copia[seleccion] = registro; else copia.push(registro);
          return guardar(ctx, 'tecnicos.json', copia,
            (seleccion >= 0 ? 'Técnico actualizado' : 'Técnico agregado') +
            (cambiarClave ? ' (contraseña con sal nueva; cambio obligatorio en el siguiente ingreso)' : ''),
            function () { lista = copia; seleccion = -1; pintar(); });
        }).catch(function (e) {
          msg.textContent = 'No se pudo procesar la contraseña: ' + A.errorDe(e);
        });
      }));

      if (seleccion >= 0) {
        acciones.appendChild(ctx.boton('Restablecer contraseña', null, function () {
          var nueva = raiz.prompt('Contraseña temporal (8 caracteres o más) para ' + (t.nombre || '') + ':');
          if (nueva === null) return;
          if (String(nueva).length < 8) { msg.textContent = 'La contraseña debe tener al menos 8 caracteres'; return; }
          var repite = raiz.prompt('Repita la contraseña temporal:');
          if (repite !== nueva) { msg.textContent = 'Las contraseñas no coinciden'; return; }
          var sal = N.generarSal(16, raiz.crypto);
          N.hashClave(nueva, sal, raiz.crypto.subtle).then(function (hash) {
            var copia = lista.slice();
            copia[seleccion] = Object.assign({}, t, {
              clave_hash: hash, clave_sal: sal,
              clave_fecha_cambio: N.formatearFecha(new Date()),
              clave_cambio_obligatorio: 'SI'
            });
            return guardar(ctx, 'tecnicos.json', copia,
              'Contraseña restablecida: el técnico deberá cambiarla en el siguiente ingreso',
              function () { lista = copia; pintar(); });
          }).catch(function (e) {
            msg.textContent = 'No se pudo restablecer la contraseña: ' + A.errorDe(e);
          });
        }));
        acciones.appendChild(ctx.boton('Inactivar técnico', null, function () {
          var cuadrillas = (ctx.almacen.datos['cuadrillas.json'] || []).filter(function (c) {
            return String(c.status || '') === 'Activa' && (c.tecnicos || []).some(function (v) {
              return String(v) === String(t.P00) || String(v) === String(t.cedula) || String(v) === String(t.nombre);
            });
          });
          if (cuadrillas.length) {
            var aviso = 'El técnico integra las cuadrillas ' + cuadrillas.map(function (c) { return c.id; }).join(' y ') +
              '. Al inactivarlo quedan incompletas. ¿Confirma la inactivación?';
            if (!raiz.confirm(aviso)) return;
          }
          var copia = lista.slice();
          copia[seleccion] = Object.assign({}, t, { status: 'Inactivo' });
          guardar(ctx, 'tecnicos.json', copia, 'Técnico inactivado (permanece en el padrón)', function () {
            lista = copia; seleccion = -1; pintar();
          });
        }));
        acciones.appendChild(ctx.boton('Baja del padrón', 'boton-peligro', function () {
          if (!raiz.confirm('¿Eliminar del padrón a ' + (t.nombre || '') + '? Se recomienda inactivarlo para no romper el historial.')) return;
          var copia = lista.slice();
          copia.splice(seleccion, 1);
          guardar(ctx, 'tecnicos.json', copia, 'Técnico dado de baja', function () { lista = copia; seleccion = -1; pintar(); });
        }));
        acciones.appendChild(ctx.boton('Nuevo (limpiar formulario)', null, function () { seleccion = -1; pintar(); }));
      }
      caja.appendChild(acciones);
      caja.appendChild(msg);
      return caja;
    }

    cuerpo.appendChild(zona);
    pintar();
  }

  // ------------------------------------------------------------------
  // CU-04 FLOTA
  // ------------------------------------------------------------------
  function renderFlota(cuerpo, ctx) {
    var lista = (ctx.almacen.datos['flota.json'] || []).slice();
    var seleccion = -1;

    cuerpo.appendChild(ctx.texto('h3', 'FLOTA — padrón de vehículos (RF-13)'));
    var zona = ctx.texto('div');

    function pintar() {
      ctx.limpiar(zona);
      zona.appendChild(tabla(ctx,
        ['CAN00', 'Tipo', 'Marca', 'Modelo', 'Placa', 'Combustible', 'Status', 'Cauchos', 'Fluidos', 'Estado general'],
        lista.map(function (v) {
          return [v.CAN00, v.tipo, v.marca, v.modelo, v.placa, v.combustible, v.status, v.estado_cauchos, v.estado_fluidos, v.estado_general];
        }), function (i) { seleccion = i; pintar(); }, seleccion));
      zona.appendChild(formulario());
    }

    function formulario() {
      var v = seleccion >= 0 && lista[seleccion] ? lista[seleccion] : {};
      var caja = ctx.texto('div', null, 'bloque');
      caja.appendChild(ctx.texto('h4', seleccion >= 0 ? 'Editar vehículo: ' + (v.CAN00 || '') : 'Nuevo vehículo'));
      var rejilla = ctx.texto('div', null, 'rejilla');
      var iCan = ctx.entrada('text', v.CAN00);
      var iTipo = ctx.entrada('text', v.tipo);
      var iMarca = ctx.entrada('text', v.marca);
      var iModelo = ctx.entrada('text', v.modelo);
      var iPlaca = ctx.entrada('text', v.placa);
      var iComb = ctx.entrada('text', v.combustible);
      var sStatus = ctx.seleccion(CONST.STATUS_FLOTA.map(function (s) { return { valor: s, etiqueta: s }; }), v.status || 'Operativo');
      var iCauchos = ctx.entrada('text', v.estado_cauchos);
      var iFluidos = ctx.entrada('text', v.estado_fluidos);
      var iGeneral = ctx.entrada('text', v.estado_general);
      rejilla.appendChild(ctx.campo('CAN00 (único)', iCan));
      rejilla.appendChild(ctx.campo('Tipo', iTipo));
      rejilla.appendChild(ctx.campo('Marca', iMarca));
      rejilla.appendChild(ctx.campo('Modelo', iModelo));
      rejilla.appendChild(ctx.campo('Placa (única)', iPlaca));
      rejilla.appendChild(ctx.campo('Combustible', iComb, 'Grafía corregida (RNF-07).'));
      rejilla.appendChild(ctx.campo('Status', sStatus));
      rejilla.appendChild(ctx.campo('Estado de cauchos', iCauchos));
      rejilla.appendChild(ctx.campo('Estado de fluidos', iFluidos));
      rejilla.appendChild(ctx.campo('Estado general', iGeneral));
      caja.appendChild(rejilla);

      var msg = ctx.texto('p', null, 'mensaje');
      msg.setAttribute('role', 'alert');
      var acciones = ctx.texto('p', null, 'acciones');
      acciones.appendChild(ctx.boton(seleccion >= 0 ? 'Guardar cambios' : 'Agregar vehículo', 'boton-primario', function () {
        var errores = [];
        if (!noVacio(iCan.value)) errores.push('Complete: CAN00');
        if (!noVacio(iPlaca.value)) errores.push('Complete: placa');
        if (!N.esEnum(sStatus.value, CONST.STATUS_FLOTA)) errores.push('Status inválido: use Operativo, En mantenimiento o Fuera de servicio');
        var dupCan = duplicado(lista, 'CAN00', iCan.value.trim(), seleccion);
        if (dupCan) errores.push('El CAN00 ' + iCan.value.trim() + ' ya está registrado (placa ' + dupCan.placa + ')');
        var dupPlaca = duplicado(lista, 'placa', iPlaca.value.trim(), seleccion);
        if (dupPlaca) errores.push('La placa ' + iPlaca.value.trim() + ' ya está registrada (CAN00 ' + dupPlaca.CAN00 + ')');
        if (errores.length) { msg.textContent = errores.join(' · '); return; }
        msg.textContent = '';
        var registro = {
          CAN00: iCan.value.trim(), tipo: iTipo.value.trim(), marca: iMarca.value.trim(),
          modelo: iModelo.value.trim(), placa: iPlaca.value.trim(), combustible: iComb.value.trim(),
          status: sStatus.value, estado_cauchos: iCauchos.value.trim(),
          estado_fluidos: iFluidos.value.trim(), estado_general: iGeneral.value.trim()
        };
        var copia = lista.slice();
        if (seleccion >= 0) copia[seleccion] = registro; else copia.push(registro);
        guardar(ctx, 'flota.json', copia, seleccion >= 0 ? 'Vehículo actualizado' : 'Vehículo agregado',
          function () { lista = copia; seleccion = -1; pintar(); });
      }));
      if (seleccion >= 0) {
        acciones.appendChild(ctx.boton('Eliminar vehículo', 'boton-peligro', function () {
          var enUso = (ctx.almacen.datos['cuadrillas.json'] || []).filter(function (c) { return String(c.vehiculo || '') === String(v.CAN00); });
          if (enUso.length && !raiz.confirm('El CAN00 ' + v.CAN00 + ' está asignado a la cuadrilla ' +
            enUso.map(function (c) { return c.id; }).join(', ') + '. ¿Confirma la baja?')) return;
          var copia = lista.slice();
          copia.splice(seleccion, 1);
          guardar(ctx, 'flota.json', copia, 'Vehículo dado de baja', function () { lista = copia; seleccion = -1; pintar(); });
        }));
        acciones.appendChild(ctx.boton('Nuevo (limpiar formulario)', null, function () { seleccion = -1; pintar(); }));
      }
      caja.appendChild(acciones);
      caja.appendChild(msg);
      return caja;
    }

    cuerpo.appendChild(zona);
    pintar();
  }

  // ------------------------------------------------------------------
  // CU-05 CUADRILLA
  // ------------------------------------------------------------------
  function renderCuadrillas(cuerpo, ctx) {
    var lista = (ctx.almacen.datos['cuadrillas.json'] || []).slice();
    var tecnicos = ctx.almacen.datos['tecnicos.json'] || [];
    var flota = ctx.almacen.datos['flota.json'] || [];
    var sectores = ctx.almacen.datos['sectores.json'] || [];
    var seleccion = -1;

    cuerpo.appendChild(ctx.texto('h3', 'CUADRILLA — padrón de cuadrillas (RF-14, D-07, D-37)'));
    cuerpo.appendChild(ctx.texto('p', 'El id de la cuadrilla es el valor que toma «Reparador Principal» en el maestro ' +
      'y determina qué casos puede ver y cerrar cada operador (D-35, D-37).'));

    var zona = ctx.texto('div');

    function pintar() {
      ctx.limpiar(zona);
      zona.appendChild(tabla(ctx,
        ['Id', 'Nombre', 'Técnicos', 'Vehículo', 'Turno', 'Sectores preferentes', 'Status'],
        lista.map(function (c) {
          return [c.id, c.nombre, escribirLista(c.tecnicos), c.vehiculo, c.turno, escribirLista(c.sectores), c.status];
        }), function (i) { seleccion = i; pintar(); }, seleccion));
      zona.appendChild(formulario());
    }

    function formulario() {
      var c = seleccion >= 0 && lista[seleccion] ? lista[seleccion] : {};
      var caja = ctx.texto('div', null, 'bloque');
      caja.appendChild(ctx.texto('h4', seleccion >= 0 ? 'Editar cuadrilla: ' + (c.id || '') : 'Nueva cuadrilla'));
      var rejilla = ctx.texto('div', null, 'rejilla');
      var iId = ctx.entrada('text', c.id);
      var iNombre = ctx.entrada('text', c.nombre);
      var iTurno = ctx.entrada('text', c.turno);
      var listaTecnicos = (c.tecnicos || []).map(String);
      var tecnicosActivos = tecnicos.filter(function (t) { return String(t.status || '') === 'Activo'; });
      var seleccionTecnicos = ctx.seleccion(
        [{ valor: '', etiqueta: '— sin seleccionar —' }].concat(tecnicosActivos.map(function (t) {
          return { valor: String(t.P00 || ''), etiqueta: (t.nombre || '') + ' (' + (t.P00 || '') + ')' };
        })), listaTecnicos[0]);
      seleccionTecnicos.multiple = true;
      seleccionTecnicos.size = Math.min(6, Math.max(2, tecnicosActivos.length));
      seleccionTecnicos.id = 'cuadrilla-tecnicos';
      Array.prototype.slice.call(seleccionTecnicos.options).forEach(function (o) {
        if (o.value && listaTecnicos.indexOf(o.value) !== -1) o.selected = true;
      });
      var vehiculos = flota.filter(function (v) { return String(v.status || '') === 'Operativo'; });
      var sVehiculo = ctx.seleccion([{ valor: '', etiqueta: '— sin vehículo —' }].concat(vehiculos.map(function (v) {
        return { valor: String(v.CAN00 || ''), etiqueta: (v.CAN00 || '') + ' · ' + (v.placa || '') };
      })), c.vehiculo);
      var listaSectores = (c.sectores || []).map(String);
      var sSectores = ctx.seleccion(sectores.map(function (s) {
        return { valor: String(s.id || ''), etiqueta: (s.id || '') + ' · ' + (s.nombre || '') };
      }), null);
      sSectores.multiple = true;
      sSectores.size = Math.min(6, Math.max(2, sectores.length));
      sSectores.id = 'cuadrilla-sectores';
      Array.prototype.slice.call(sSectores.options).forEach(function (o) {
        if (listaSectores.indexOf(o.value) !== -1) o.selected = true;
      });
      var sStatus = ctx.seleccion(CONST.STATUS_CUADRILLA.map(function (s) { return { valor: s, etiqueta: s }; }), c.status || 'Activa');

      rejilla.appendChild(ctx.campo('Id (único)', iId));
      rejilla.appendChild(ctx.campo('Nombre', iNombre));
      var cTecnicos = ctx.campo('Técnicos (Ctrl o Mayús para varios)', seleccionTecnicos, 'Al menos 1 técnico activo.');
      cTecnicos.classList.add('rejilla-ancha');
      rejilla.appendChild(cTecnicos);
      rejilla.appendChild(ctx.campo('Vehículo', sVehiculo, 'Solo vehículos Operativos.'));
      rejilla.appendChild(ctx.campo('Turno', iTurno));
      var cSectores = ctx.campo('Sectores preferentes', sSectores, 'Se usan en el desempate del despacho (D-32).');
      cSectores.classList.add('rejilla-ancha');
      rejilla.appendChild(cSectores);
      rejilla.appendChild(ctx.campo('Status', sStatus, 'Las cuadrillas Inactivas no reciben despacho.'));
      caja.appendChild(rejilla);

      var msg = ctx.texto('p', null, 'mensaje');
      msg.setAttribute('role', 'alert');
      var acciones = ctx.texto('p', null, 'acciones');
      acciones.appendChild(ctx.boton(seleccion >= 0 ? 'Guardar cambios' : 'Agregar cuadrilla', 'boton-primario', function () {
        var errores = [];
        if (!noVacio(iId.value)) errores.push('Complete: id');
        if (!noVacio(iNombre.value)) errores.push('Complete: nombre');
        var dup = duplicado(lista, 'id', iId.value.trim(), seleccion);
        if (dup) errores.push('La cuadrilla ' + iId.value.trim() + ' ya existe');
        var elegidos = Array.prototype.slice.call(seleccionTecnicos.options)
          .filter(function (o) { return o.selected && o.value; }).map(function (o) { return o.value; });
        if (!elegidos.length) errores.push('Seleccione al menos un técnico activo');
        if (sVehiculo.value && !flota.some(function (v) { return String(v.CAN00) === sVehiculo.value; })) {
          errores.push('El CAN00 ' + sVehiculo.value + ' no existe en flota.json');
        }
        var sectoresElegidos = Array.prototype.slice.call(sSectores.options)
          .filter(function (o) { return o.selected && o.value; }).map(function (o) { return o.value; });
        sectoresElegidos.forEach(function (id) {
          if (!sectores.some(function (s) { return String(s.id) === id; })) errores.push('El sector ' + id + ' no existe en sectores.json');
        });
        if (errores.length) { msg.textContent = errores.join(' · '); return; }
        msg.textContent = '';
        var registro = {
          id: iId.value.trim(), nombre: iNombre.value.trim(), tecnicos: elegidos,
          vehiculo: sVehiculo.value, turno: iTurno.value.trim(),
          sectores: sectoresElegidos, status: sStatus.value
        };
        var copia = lista.slice();
        if (seleccion >= 0) copia[seleccion] = registro; else copia.push(registro);
        guardar(ctx, 'cuadrillas.json', copia, seleccion >= 0 ? 'Cuadrilla actualizada' : 'Cuadrilla agregada',
          function () { lista = copia; seleccion = -1; pintar(); });
      }));
      if (seleccion >= 0) {
        acciones.appendChild(ctx.boton('Eliminar cuadrilla', 'boton-peligro', function () {
          var casos = (ctx.almacen.datos['averias.json'] || []).filter(function (a) {
            return String(a['Reparador Principal'] || '') === String(c.id);
          });
          if (casos.length && !raiz.confirm('La cuadrilla ' + c.id + ' tiene ' + casos.length +
            ' caso(s) asignado(s). Se recomienda inactivarla. ¿Confirma la baja?')) return;
          var copia = lista.slice();
          copia.splice(seleccion, 1);
          guardar(ctx, 'cuadrillas.json', copia, 'Cuadrilla dada de baja', function () { lista = copia; seleccion = -1; pintar(); });
        }));
        acciones.appendChild(ctx.boton('Nuevo (limpiar formulario)', null, function () { seleccion = -1; pintar(); }));
      }
      caja.appendChild(acciones);
      caja.appendChild(msg);
      return caja;
    }

    cuerpo.appendChild(zona);
    pintar();
  }

  // ------------------------------------------------------------------
  // CU-06 / RF-29 SECTORES
  // ------------------------------------------------------------------
  function renderSectores(cuerpo, ctx) {
    var lista = (ctx.almacen.datos['sectores.json'] || []).slice();
    var cuadrillas = ctx.almacen.datos['cuadrillas.json'] || [];
    var seleccion = -1;

    cuerpo.appendChild(ctx.texto('h3', 'SECTORES — catálogo de sectores (RF-29, D-03, D-25, D-52)'));
    cuerpo.appendChild(ctx.texto('p', 'El id es texto único asignado por el supervisor y es el valor que guarda ' +
      'averias.sector. Las vías se comparan ignorando mayúsculas, tildes y abreviaturas (Av., Cll., Urb.).'));

    var zona = ctx.texto('div');

    function pintar() {
      ctx.limpiar(zona);
      zona.appendChild(tabla(ctx,
        ['Id (texto)', 'Nombre', 'Nº de vías', 'Vías', 'Cuadrilla sugerida', 'Averías asociadas'],
        lista.map(function (s) {
          var n = (ctx.almacen.datos['averias.json'] || []).filter(function (a) { return String(a.sector || '') === String(s.id); }).length;
          return [s.id, s.nombre, (s.vias || []).length, escribirLista(s.vias), s.cuadrilla_sugerida || '', n];
        }), function (i) { seleccion = i; pintar(); }, seleccion));
      zona.appendChild(formulario());
    }

    function formulario() {
      var s = seleccion >= 0 && lista[seleccion] ? lista[seleccion] : {};
      var caja = ctx.texto('div', null, 'bloque');
      caja.appendChild(ctx.texto('h4', seleccion >= 0 ? 'Editar sector: ' + (s.nombre || '') : 'Nuevo sector'));
      var rejilla = ctx.texto('div', null, 'rejilla');
      var iId = ctx.entrada('text', s.id);
      var iNombre = ctx.entrada('text', s.nombre);
      var iVias = ctx.entrada('text', escribirLista(s.vias));
      iVias.classList.add('rejilla-ancha');
      var sCuadrilla = ctx.seleccion([{ valor: '', etiqueta: '— sin sugerencia —' }].concat(cuadrillas.map(function (c) {
        return { valor: String(c.id || ''), etiqueta: (c.id || '') + ' · ' + (c.nombre || '') };
      })), s.cuadrilla_sugerida);
      rejilla.appendChild(ctx.campo('Id (texto único)', iId));
      rejilla.appendChild(ctx.campo('Nombre', iNombre));
      rejilla.appendChild(ctx.campo('Vías (separadas por coma)', iVias, 'Calles, urbanizaciones o puntos de referencia.'));
      rejilla.appendChild(ctx.campo('Cuadrilla sugerida', sCuadrilla, 'Debe existir en cuadrillas.json.'));
      caja.appendChild(rejilla);

      var msg = ctx.texto('p', null, 'mensaje');
      msg.setAttribute('role', 'alert');
      var acciones = ctx.texto('p', null, 'acciones');
      acciones.appendChild(ctx.boton(seleccion >= 0 ? 'Guardar cambios' : 'Agregar sector', 'boton-primario', function () {
        var errores = [];
        if (!noVacio(iId.value)) errores.push('Complete: id');
        if (!noVacio(iNombre.value)) errores.push('Complete: nombre');
        var vias = leerLista(iVias.value);
        if (!vias.length) errores.push('Complete: al menos una vía');
        var dup = duplicado(lista, 'id', iId.value.trim(), seleccion);
        if (dup) errores.push('El sector ' + iId.value.trim() + ' ya existe (' + dup.nombre + ')');
        if (sCuadrilla.value && !cuadrillas.some(function (c) { return String(c.id) === sCuadrilla.value; })) {
          errores.push('La cuadrilla ' + sCuadrilla.value + ' no existe');
        }
        if (errores.length) { msg.textContent = errores.join(' · '); return; }
        msg.textContent = '';
        var registro = { id: iId.value.trim(), nombre: iNombre.value.trim(), vias: vias, cuadrilla_sugerida: sCuadrilla.value };
        var copia = lista.slice();
        if (seleccion >= 0) copia[seleccion] = registro; else copia.push(registro);
        guardar(ctx, 'sectores.json', copia, seleccion >= 0 ? 'Sector actualizado' : 'Sector agregado',
          function () { lista = copia; seleccion = -1; pintar(); });
      }));
      if (seleccion >= 0) {
        acciones.appendChild(ctx.boton('Eliminar sector', 'boton-peligro', function () {
          var asociadas = (ctx.almacen.datos['averias.json'] || []).filter(function (a) { return String(a.sector || '') === String(s.id); });
          var abiertas = asociadas.filter(N.estaAbierto).length;
          if (asociadas.length) {
            msg.textContent = 'El sector ' + s.id + ' tiene ' + asociadas.length + ' avería(s) (' + abiertas +
              ' abierta(s)). Reasígnelas antes de eliminarlo.';
            return;
          }
          if (!raiz.confirm('¿Eliminar el sector ' + s.id + ' · ' + s.nombre + '?')) return;
          var copia = lista.slice();
          copia.splice(seleccion, 1);
          guardar(ctx, 'sectores.json', copia, 'Sector eliminado', function () { lista = copia; seleccion = -1; pintar(); });
        }));
        acciones.appendChild(ctx.boton('Nuevo (limpiar formulario)', null, function () { seleccion = -1; pintar(); }));
      }
      var p3 = ctx.texto('p', 'El operador no puede dar de alta libre, editar ni eliminar sectores: solo el supervisor (D-35, RNF-12). Se anota además el número de averías asociadas, para avisar antes de una baja.');
      caja.appendChild(acciones);
      caja.appendChild(msg);
      caja.appendChild(p3);
      return caja;
    }

    cuerpo.appendChild(zona);
    pintar();
  }

  // ------------------------------------------------------------------
  // CU-07 PALABRAS CLAVE (RF-27)
  // ------------------------------------------------------------------
  function renderClaves(cuerpo, ctx) {
    var actual = ctx.almacen.datos['claves_clasificacion.json'];
    var datos = (actual && typeof actual === 'object' && !Array.isArray(actual)) ? actual : {};
    var claves = Array.isArray(datos.claves) ? datos.claves.slice() : ['LOSS ROJO', 'FALLA FIBRA', 'FIBRA DAÑADA'];
    var campos = Array.isArray(datos.campos_evaluados) && datos.campos_evaluados.length
      ? datos.campos_evaluados.slice()
      : ['ultimo_comentario', 'problema_reporte', 'informacion_1', 'informacion_2'];

    cuerpo.appendChild(ctx.texto('h3', 'PALABRAS CLAVE — clasificación RN-03 (RF-27, D-11, D-26, D-43)'));
    cuerpo.appendChild(ctx.texto('p', 'La búsqueda es por subcadena sobre el texto normalizado (mayúsculas, sin tildes, ' +
      'espacios colapsados) o literal en el modo estricta. En C1 solo se edita el catálogo: la clasificación de casos ' +
      'y la vista previa del impacto llegan con la ingesta del ciclo C2.'));

    var contenedorClaves = ctx.texto('div', null, 'rejilla');
    function pintarClaves() {
      ctx.limpiar(contenedorClaves);
      claves.forEach(function (clave, i) {
        var iClave = ctx.entrada('text', clave);
        var fila = ctx.texto('p', null, 'campo');
        var label = ctx.texto('label', 'Clave ' + (i + 1));
        label.setAttribute('for', 'clave-' + i);
        iClave.id = 'clave-' + i;
        iClave.addEventListener('input', function () { claves[i] = iClave.value; });
        var quitar = ctx.boton('Quitar', 'boton-peligro boton-pequeno', function () {
          claves.splice(i, 1);
          pintarClaves();
        });
        fila.appendChild(label);
        fila.appendChild(iClave);
        fila.appendChild(quitar);
        contenedorClaves.appendChild(fila);
      });
    }
    pintarClaves();
    cuerpo.appendChild(contenedorClaves);
    cuerpo.appendChild(ctx.boton('Agregar clave', null, function () { claves.push(''); pintarClaves(); }));

    var sModo = ctx.seleccion([
      { valor: 'normalizada', etiqueta: 'normalizada (por defecto)' },
      { valor: 'estricta', etiqueta: 'estricta (literal, con mayúsculas y tildes)' }
    ], datos.normalizacion || 'normalizada');
    var iUmbral = ctx.entrada('number', datos.umbral_concentracion === undefined ? 3 : datos.umbral_concentracion, { min: '2' });
    var camposTexto = ctx.entrada('text', campos.join(', '));
    camposTexto.classList.add('rejilla-ancha');
    var rejilla = ctx.texto('div', null, 'rejilla');
    rejilla.appendChild(ctx.campo('Modo de búsqueda', sModo, 'D-26 normalizada; D-43 estricta.'));
    rejilla.appendChild(ctx.campo('Umbral de avería concentrada', iUmbral, 'Por defecto 3 (D-25); se aplica en el ciclo C6.'));
    rejilla.appendChild(ctx.campo('Campos evaluados', camposTexto, 'Separados por coma.'));
    cuerpo.appendChild(rejilla);

    var msg = ctx.texto('p', null, 'mensaje');
    msg.setAttribute('role', 'alert');
    cuerpo.appendChild(ctx.boton('Guardar claves', 'boton-primario', function () {
      var limpias = claves.map(function (c) { return String(c).trim(); }).filter(function (c) { return c !== ''; });
      var repetida = null;
      limpias.forEach(function (c, i) {
        if (limpias.indexOf(c) !== i && !repetida) repetida = c;
      });
      if (repetida) { msg.textContent = 'La clave ya existe: ' + repetida; return; }
      if (!limpias.length && !raiz.confirm('La lista de claves quedará vacía: todos los casos entrarían en GESTION. ¿Confirma?')) return;
      msg.textContent = '';
      var nuevo = {
        claves: limpias,
        normalizacion: sModo.value,
        campos_evaluados: leerLista(camposTexto.value),
        umbral_concentracion: parseInt(iUmbral.value, 10) || 3
      };
      guardar(ctx, 'claves_clasificacion.json', nuevo, 'Claves guardadas: ' + limpias.length + ' claves activas',
        function () { renderConfig(null, ctx); });
    }));
    cuerpo.appendChild(msg);
  }

  raiz.GGTO_CONFIGURACION = {
    ciclo: 'C1',
    requisitos: 'RF-11 a RF-14, RF-27, RF-29',
    subsecciones: SUBSECCIONES,
    render: render,
    avisoRol: avisoRol,
    subActiva: function (valor) { if (valor) subActiva = valor; return subActiva; }
  };
})(window);
