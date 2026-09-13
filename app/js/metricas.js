/*
 * GGTO-v1 - metricas.js
 * PENDIENTE DEL CICLO C5 (RF-05 tablas, RF-25; RNF-02, RNF-06): agregaciones
 * del MONITOREO y del seguimiento semanal (ingreso vs. reparadas, línea de
 * pendiente, Sem 1 a Sem 36, semana operativa de lunes a sábado, RN-08).
 */
(function (raiz) {
  'use strict';

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'pendiente';
    var h = document.createElement('h2');
    h.textContent = 'MONITOREO — pendiente del ciclo C5';
    var p1 = document.createElement('p');
    p1.textContent = 'Las agregaciones del MONITOREO (6 zonas con gráfico y tabla, corte por semana operativa ' +
      'de lunes a sábado y selector Sem 1 a Sem 36) se implementan en el ciclo C5.';
    var p2 = document.createElement('p');
    p2.textContent = 'Requisitos asociados: RF-05 y RF-25; RNF-02, RNF-06 y RNF-13 (tabla o texto alternativo ' +
      'equivalente en cada gráfico); decisiones D-23, D-24 y D-34.';
    caja.appendChild(h); caja.appendChild(p1); caja.appendChild(p2);
    contenedor.appendChild(caja);
  }

  raiz.GGTO_METRICAS = { ciclo: 'C5', requisitos: 'RF-05, RF-25', render: render };
})(window);
