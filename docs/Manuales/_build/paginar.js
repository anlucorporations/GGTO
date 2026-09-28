/* ==================================================================
   GGTO · CANTV — Paginador para la exportación a PDF
   ------------------------------------------------------------------
   Toma el contenido del manual (#contenido), lo reparte en hojas A4
   (.page) y calcula el número de página de cada sección para rellenar
   el índice. Se ejecuta solo cuando <html> lleva la clase `pdf-mode`.
   ================================================================== */

(function () {
  'use strict';

  var CFG = window.GGTO_MANUAL || {};
  var UMBRAL_TITULO = 56; // px que se exigen debajo de un título para dejarlo en la hoja

  function esEncabezado(el) {
    return /^H[234]$/.test(el.tagName);
  }

  function descripcion(el) {
    var t = (el.textContent || el.tagName).replace(/\s+/g, ' ').trim();
    return el.tagName.toLowerCase() + ' “' + t.slice(0, 48) + '”';
  }

  window.ggtoPaginar = function () {
    var avisos = [];
    var contenido = document.getElementById('contenido');
    if (!contenido) { return { paginas: 0, avisos: ['No se encontró #contenido'] }; }

    var portadaSrc = contenido.querySelector('.portada');
    var pieNav = contenido.querySelector('.pie-nav');
    var bloques = Array.prototype.filter.call(contenido.children, function (el) {
      return el !== portadaSrc && el !== pieNav;
    });

    var root = document.createElement('div');
    root.className = 'print-root';
    document.body.appendChild(root);

    /* ---------------- construcción de hojas ---------------- */

    function hoja(clase) {
      var s = document.createElement('section');
      s.className = 'page' + (clase ? ' ' + clase : '');
      var cab = document.createElement('header');
      cab.className = 'page-header';
      cab.innerHTML = '<span class="ph-izq"></span><span class="ph-der"></span>';
      cab.querySelector('.ph-izq').textContent = CFG.cabeceraIzq || 'GGTO · CANTV';
      cab.querySelector('.ph-der').textContent = CFG.cabeceraDer || '';
      var cuerpo = document.createElement('div');
      cuerpo.className = 'page-body contenido';
      var pie = document.createElement('footer');
      pie.className = 'page-footer';
      pie.innerHTML = '<span class="pf-izq"></span><span class="pf-centro"></span>' +
        '<span class="pf-der">Página <b class="pn"></b> de <b class="pt"></b></span>';
      pie.querySelector('.pf-izq').textContent = CFG.pieIzq || '';
      pie.querySelector('.pf-centro').textContent = CFG.pieCentro || '';
      s.appendChild(cab);
      s.appendChild(cuerpo);
      s.appendChild(pie);
      root.appendChild(s);
      return s;
    }

    /* Hoja oculta que se usa para medir si un trozo cabe en una hoja vacía. */
    var medidor = null;
    function cuerpoMedidor() {
      if (!medidor) {
        medidor = hoja('page-medidor');
        medidor.style.position = 'absolute';
        medidor.style.left = '-9999mm';
        medidor.style.top = '0';
        medidor.style.zIndex = '-1';
      }
      return medidor.querySelector('.page-body');
    }

    /* ---------------- portada ---------------- */

    if (portadaSrc) {
      var pPortada = document.createElement('section');
      pPortada.className = 'page page-portada';
      pPortada.innerHTML = portadaSrc.innerHTML;
      root.appendChild(pPortada);
    }

    /* ---------------- índice ---------------- */

    function aplanar(ul, nivel, salida) {
      Array.prototype.forEach.call(ul.children, function (li) {
        var a = li.querySelector(':scope > a');
        var sub = li.querySelector(':scope > ul');
        if (a) {
          salida.push({ nivel: nivel, html: a.innerHTML, target: a.getAttribute('data-target') || '' });
        }
        if (sub) { aplanar(sub, nivel + 1, salida); }
      });
    }

    var entradasToc = [];
    var tocSrc = document.querySelector('.doc-nav .toc-lista');
    if (tocSrc) { aplanar(tocSrc, 2, entradasToc); }

    var refsToc = [];
    if (entradasToc.length) {
      var pToc = hoja('page-toc');
      var cToc = pToc.querySelector('.page-body');
      cToc.appendChild(tituloIndice('Índice', entradasToc.length));
      var lista = document.createElement('ul');
      lista.className = 'toc-plano';
      cToc.appendChild(lista);
      entradasToc.forEach(function (e) {
        var li = document.createElement('li');
        li.className = 'toc-n' + e.nivel;
        var a = document.createElement('a');
        a.setAttribute('href', '#' + e.target);
        a.innerHTML = e.html;
        var pag = document.createElement('span');
        pag.className = 'pag';
        pag.textContent = '';
        li.appendChild(pag);
        li.appendChild(a);
        lista.appendChild(li);
        refsToc.push({ li: li, target: e.target, pag: pag });
        if (cToc.scrollHeight > cToc.clientHeight + 1) {
          lista.removeChild(li);
          pToc = hoja('page-toc');
          cToc = pToc.querySelector('.page-body');
          cToc.appendChild(tituloIndice('Índice (continuación)', entradasToc.length));
          lista = document.createElement('ul');
          lista.className = 'toc-plano';
          cToc.appendChild(lista);
          lista.appendChild(li);
        }
      });
    }

    function tituloIndice(texto) {
      var h = document.createElement('h2');
      h.className = 'toc-titulo toc-titulo-papel';
      h.textContent = texto;
      return h;
    }

    /* ---------------- división de bloques grandes ---------------- */

    function clonarTabla(modelo, filas) {
      var t = document.createElement('table');
      if (modelo.className) { t.className = modelo.className; }
      var thead = modelo.querySelector('thead');
      if (thead) { t.appendChild(thead.cloneNode(true)); }
      var tb = document.createElement('tbody');
      filas.forEach(function (f) { tb.appendChild(f.cloneNode(true)); });
      t.appendChild(tb);
      var cont = document.createElement('div');
      cont.className = 'tabla-scroll';
      cont.appendChild(t);
      return cont;
    }

    function dividirTabla(env) {
      var tabla = env.tagName === 'TABLE' ? env : env.querySelector('table');
      if (!tabla) { return [env]; }
      var filas = Array.prototype.slice.call(tabla.querySelectorAll('tbody > tr'));
      if (filas.length < 2) { return [env]; }
      var partes = [];
      var i = 0;
      var guardia = 0;
      while (i < filas.length && guardia++ < 500) {
        var cm = cuerpoMedidor();
        var usadas = [];
        var cont = clonarTabla(tabla, usadas);
        cm.appendChild(cont);
        var tb = cont.querySelector('tbody');
        while (i < filas.length) {
          tb.appendChild(filas[i].cloneNode(true));
          if (cm.scrollHeight <= cm.clientHeight + 1) {
            usadas.push(filas[i]); i++;
          } else {
            tb.removeChild(tb.lastChild);
            break;
          }
        }
        if (!usadas.length) { usadas.push(filas[i]); i++; } // una sola fila no cabe: se acepta
        partes.push(clonarTabla(tabla, usadas));
        cm.textContent = '';
      }
      return partes.length > 1 ? partes : [env];
    }

    function dividirLista(lista) {
      var items = Array.prototype.slice.call(lista.children);
      if (items.length < 2) { return [lista]; }
      var partes = [];
      var i = 0;
      var guardia = 0;
      while (i < items.length && guardia++ < 500) {
        var cm = cuerpoMedidor();
        var nueva = document.createElement(lista.tagName);
        nueva.className = lista.className;
        cm.appendChild(nueva);
        var puestas = 0;
        while (i < items.length) {
          nueva.appendChild(items[i].cloneNode(true));
          if (cm.scrollHeight <= cm.clientHeight + 1) { i++; puestas++; }
          else { nueva.removeChild(nueva.lastChild); break; }
        }
        if (!puestas) { nueva.appendChild(items[i].cloneNode(true)); i++; }
        partes.push(nueva);
        cm.textContent = '';
      }
      return partes.length > 1 ? partes : [lista];
    }

    function dividirPre(pre) {
      var lineas = (pre.textContent || '').replace(/\n$/, '').split('\n');
      if (lineas.length < 3) { return [pre]; }
      var clases = ['language-' + (pre.dataset.lang || 'texto')];
      var partes = [];
      var i = 0;
      var guardia = 0;
      while (i < lineas.length && guardia++ < 800) {
        var cm = cuerpoMedidor();
        var bloque = document.createElement('pre');
        var cod = document.createElement('code');
        cod.className = clases[0];
        bloque.appendChild(cod);
        cm.appendChild(bloque);
        var puestas = 0;
        while (i < lineas.length) {
          cod.textContent += (puestas ? '\n' : '') + lineas[i];
          if (cm.scrollHeight <= cm.clientHeight + 1) { i++; puestas++; }
          else {
            cod.textContent = cod.textContent.slice(0, cod.textContent.length - lineas[i].length - 1);
            break;
          }
        }
        if (!puestas) { cod.textContent = lineas[i]; i++; }
        partes.push(bloque);
        cm.textContent = '';
      }
      return partes.length > 1 ? partes : [pre];
    }

    function dividirCita(cita) {
      var hijos = Array.prototype.slice.call(cita.children);
      if (hijos.length < 2) { return [cita]; }
      var partes = [];
      var i = 0;
      var guardia = 0;
      while (i < hijos.length && guardia++ < 300) {
        var cm = cuerpoMedidor();
        var nueva = document.createElement('blockquote');
        cm.appendChild(nueva);
        var puestas = 0;
        while (i < hijos.length) {
          nueva.appendChild(hijos[i].cloneNode(true));
          if (cm.scrollHeight <= cm.clientHeight + 1) { i++; puestas++; }
          else { nueva.removeChild(nueva.lastChild); break; }
        }
        if (!puestas) { nueva.appendChild(hijos[i].cloneNode(true)); i++; }
        partes.push(nueva);
        cm.textContent = '';
      }
      return partes.length > 1 ? partes : [cita];
    }

    function dividirParrafo(p) {
      var palabras = (p.textContent || '').split(/(\s+)/);
      if (palabras.length < 12) { return [p]; }
      var partes = [];
      var i = 0;
      var guardia = 0;
      while (i < palabras.length && guardia++ < 400) {
        var cm = cuerpoMedidor();
        var nueva = document.createElement('p');
        if (p.className) { nueva.className = p.className; }
        cm.appendChild(nueva);
        var puestas = 0;
        while (i < palabras.length) {
          nueva.textContent += palabras[i];
          if (cm.scrollHeight <= cm.clientHeight + 1) { i++; puestas++; }
          else {
            nueva.textContent = nueva.textContent.slice(0, nueva.textContent.length - palabras[i].length);
            break;
          }
        }
        if (!puestas) { nueva.textContent = palabras[i]; i++; }
        partes.push(nueva);
        cm.textContent = '';
      }
      return partes.length > 1 ? partes : [p];
    }

    /* Bloques de diagrama pendiente (título + código mermaid): se reparten
       por líneas de código, repitiendo el título en cada hoja. */
    function dividirGrafico(div) {
      var pre = div.querySelector('pre');
      if (!pre) { return [div]; }
      var lineas = (pre.textContent || '').replace(/\n$/, '').split('\n');
      if (lineas.length < 3) { return [div]; }
      var lang = pre.dataset.lang || 'mermaid';
      var titulo = (div.querySelector('.gp-titulo') || {}).textContent || 'Diagrama';
      var partes = [];
      var i = 0;
      var guardia = 0;
      while (i < lineas.length && guardia++ < 800) {
        var cm = cuerpoMedidor();
        var nuevo = document.createElement('div');
        nuevo.className = div.className;
        var t = document.createElement('p');
        t.className = 'gp-titulo';
        t.textContent = titulo + (partes.length ? ' (continuación)' : '');
        var bloque = document.createElement('pre');
        bloque.dataset.lang = lang;
        var cod = document.createElement('code');
        cod.className = 'language-' + lang;
        bloque.appendChild(cod);
        nuevo.appendChild(t);
        nuevo.appendChild(bloque);
        cm.appendChild(nuevo);
        var puestas = 0;
        while (i < lineas.length) {
          cod.textContent += (puestas ? '\n' : '') + lineas[i];
          if (cm.scrollHeight <= cm.clientHeight + 1) { i++; puestas++; }
          else {
            cod.textContent = cod.textContent.slice(0, cod.textContent.length - lineas[i].length - 1);
            break;
          }
        }
        if (!puestas) { cod.textContent = lineas[i]; i++; }
        partes.push(nuevo);
        cm.textContent = '';
      }
      return partes.length > 1 ? partes : [div];
    }

    function dividirBloque(el) {
      var partes = [el];
      try {
        if (el.tagName === 'TABLE' || el.classList.contains('tabla-scroll')) {
          partes = dividirTabla(el);
        } else if (el.classList.contains('grafico-pendiente')) {
          partes = dividirGrafico(el);
        } else if (el.tagName === 'UL' || el.tagName === 'OL') {
          partes = dividirLista(el);
        } else if (el.tagName === 'PRE') {
          partes = dividirPre(el);
        } else if (el.tagName === 'BLOCKQUOTE') {
          partes = dividirCita(el);
        } else if (el.tagName === 'P') {
          partes = dividirParrafo(el);
        }
      } catch (e) {
        avisos.push('error al dividir ' + descripcion(el) + ': ' + e.message);
        partes = [el];
      }
      if (partes.length < 2) { return [el]; }
      partes.forEach(function (p) { p.dataset.ggtoSplit = '1'; });
      return partes;
    }

    /* ---------------- reparto del contenido ---------------- */

    var anclaDeHoja = {};   // ancla -> elemento de hoja
    var textoDeAncla = {};  // ancla -> texto del título (para verificación)
    var hojasContenido = [];
    var pagina, cuerpo, cola;

    function nuevaHoja() {
      pagina = hoja('page-contenido');
      cuerpo = pagina.querySelector('.page-body');
      hojasContenido.push(pagina);
      return pagina;
    }

    function hayEspacio() {
      return cuerpo.scrollHeight <= cuerpo.clientHeight + 1;
    }

    /* Altura realmente ocupada por el contenido de la hoja actual.
       (scrollHeight no sirve para saber cuán llena está: en una caja con
       altura definida siempre vale, como mínimo, la altura de la caja.) */
    function alturaUsada() {
      if (!cuerpo.children.length) { return 0; }
      var ultimo = cuerpo.lastElementChild;
      var caja = cuerpo.getBoundingClientRect();
      var fin = ultimo.getBoundingClientRect().bottom - caja.top;
      var margen = parseFloat(window.getComputedStyle(ultimo).marginBottom) || 0;
      return fin + margen;
    }

    function hojaVacia() {
      return cuerpo.children.length === 0;
    }

    nuevaHoja();
    cola = bloques.slice();
    var guardia = 0;

    while (cola.length) {
      if (guardia++ > 30000) {
        avisos.push('Se detuvo el reparto por seguridad (demasiadas iteraciones).');
        break;
      }
      var el = cola.shift();

      // Cada capítulo (h2) empieza en hoja nueva, salvo que la hoja
      // actual esté casi vacía (así el texto de entrada no deja una
      // hoja con un solo párrafo).
      if (el.tagName === 'H2' && !hojaVacia() &&
          alturaUsada() > cuerpo.clientHeight * 0.28) {
        nuevaHoja();
      }

      cuerpo.appendChild(el);

      if (!hayEspacio()) {
        if (hojaVacia()) {
          cuerpo.removeChild(el);
          if (!el.dataset.ggtoSplit) {
            var partes = dividirBloque(el);
            if (partes.length > 1) {
              cola = partes.concat(cola);
              continue;
            }
          }
          cuerpo.appendChild(el);
          avisos.push('Bloque más alto que una hoja (se recorta): ' + descripcion(el));
        } else {
          cuerpo.removeChild(el);
          nuevaHoja();
          cuerpo.appendChild(el);
          if (!hayEspacio() && !el.dataset.ggtoSplit) {
            cuerpo.removeChild(el);
            var partes2 = dividirBloque(el);
            if (partes2.length > 1) { cola = partes2.concat(cola); continue; }
            cuerpo.appendChild(el);
            avisos.push('Bloque más alto que una hoja (se recorta): ' + descripcion(el));
          }
        }
      }

      // Un título no debe quedar solo al final de la hoja.
      if (esEncabezado(el) && cuerpo.children.length > 1 && !hayEspacioDespues()) {
        cuerpo.removeChild(el);
        nuevaHoja();
        cuerpo.appendChild(el);
      }

      if (el.id && esEncabezado(el)) {
        anclaDeHoja[el.id] = pagina;
        textoDeAncla[el.id] = el.textContent || '';
      }
    }

    function hayEspacioDespues() {
      var sobra = cuerpo.clientHeight - alturaUsada();
      return sobra > UMBRAL_TITULO;
    }

    /* ---------------- numeración y enlaces del índice ---------------- */

    if (medidor && medidor.parentNode) { medidor.parentNode.removeChild(medidor); }
    medidor = null;

    var hojas = Array.prototype.slice.call(root.children);
    hojas.forEach(function (h, indice) {
      var pn = h.querySelector('.pn');
      var pt = h.querySelector('.pt');
      if (pn) { pn.textContent = String(indice + 1); }
      if (pt) { pt.textContent = String(hojas.length); }
    });

    var sinPagina = 0;
    refsToc.forEach(function (ref) {
      var destino = anclaDeHoja[ref.target];
      if (destino) {
        var pn = destino.querySelector('.pn');
        ref.pag.textContent = pn ? pn.textContent : '';
      } else {
        ref.pag.textContent = '';
        sinPagina++;
      }
    });

    if (!refsToc.length) { avisos.push('El manual no tiene entradas de índice.'); }
    if (sinPagina) { avisos.push('Entradas de índice sin página: ' + sinPagina); }

    var anclasSalida = {};
    Object.keys(anclaDeHoja).forEach(function (clave) {
      var pn = anclaDeHoja[clave].querySelector('.pn');
      anclasSalida[clave] = {
        pagina: pn ? Number(pn.textContent) : null,
        texto: (textoDeAncla[clave] || '').replace(/\s+/g, ' ').trim()
      };
    });

    return {
      paginas: hojas.length,
      hojasContenido: hojasContenido.length,
      entradasToc: refsToc.length,
      anclas: anclasSalida,
      avisos: avisos
    };
  };
})();
