/*
 * GGTO-v1 - ingesta.js
 * PENDIENTE DEL CICLO C2 (RF-16 a RF-19, RF-27; RNF-02, RNF-04, RNF-06,
 * RNF-10; D-21, D-26, D-38, D-43, D-44). En C1 no se implementa: la carga del
 * CSV, la validación posicional de 80 columnas, el filtro de central, el
 * dedupe, la clasificación RN-03 y la asignación de sector llegan en C2.
 */
(function (raiz) {
  'use strict';
  var CONST = raiz.GGTO_NUCLEO.CONST;

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'pendiente';
    var h = document.createElement('h2');
    h.textContent = 'INGESTA — pendiente del ciclo C2';
    var p1 = document.createElement('p');
    p1.textContent = 'La ingesta del CSV diario (carga con separador «;», validación bloqueante de las ' +
      CONST.ARCHIVO_ESTRUCTURA + ' con ' + 80 + ' columnas, filtro de central, mapeo posicional, dedupe por ' +
      'id_averia, clasificación RN-03 y cola de direcciones sin sector) se implementa en el ciclo C2.';
    var p2 = document.createElement('p');
    p2.textContent = 'Requisitos asociados: RF-16, RF-17, RF-18, RF-19 y RF-27; RNF-02 (umbral S-RNF-02b), ' +
      'RNF-04, RNF-06 y RNF-10; decisiones D-21, D-26, D-38, D-43 y D-44.';
    var p3 = document.createElement('p');
    p3.textContent = 'El maestro de casos permanece sin cambios: en C1 no se escribe nada por esta vía.';
    caja.appendChild(h); caja.appendChild(p1); caja.appendChild(p2); caja.appendChild(p3);
    contenedor.appendChild(caja);
  }

  raiz.GGTO_INGESTA = { ciclo: 'C2', requisitos: 'RF-16 a RF-19, RF-27', render: render };
})(window);
