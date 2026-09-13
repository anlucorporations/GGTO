/*
 * GGTO-v1 - reportes.js
 * PENDIENTE DEL CICLO C6 (RF-25, RF-26; RNF-01, RNF-06, RNF-11): reporte de
 * trabajo diario y de gestión semanal, vigilancia de casos especiales
 * (EMP/REF abiertos, D-33) y averías concentradas (umbral editable, D-25).
 */
(function (raiz) {
  'use strict';

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'pendiente';
    var h = document.createElement('h2');
    h.textContent = 'REPORTES — pendiente del ciclo C6';
    var p1 = document.createElement('p');
    p1.textContent = 'El reporte de trabajo diario, el seguimiento semanal estadístico, la vigilancia de casos ' +
      'especiales (tipo_abonado EMP o nivel REF abiertos) y el bloque de averías concentradas se implementan ' +
      'en el ciclo C6.';
    var p2 = document.createElement('p');
    p2.textContent = 'Requisitos asociados: RF-25 y RF-26; RNF-01, RNF-06 y RNF-11; decisiones D-25, D-33 y D-34.';
    var p3 = document.createElement('p');
    p3.textContent = 'RF-26 queda en estado «Parcial» en la base normativa por el corte exacto de la semana ' +
      'operativa (pendiente técnico, no decisión del usuario).';
    caja.appendChild(h); caja.appendChild(p1); caja.appendChild(p2); caja.appendChild(p3);
    contenedor.appendChild(caja);
  }

  raiz.GGTO_REPORTES = { ciclo: 'C6', requisitos: 'RF-25, RF-26', render: render };
})(window);
