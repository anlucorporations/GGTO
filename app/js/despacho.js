/*
 * GGTO-v1 - despacho.js
 * PENDIENTE DEL CICLO C4 (RF-08, RF-09, RF-20; RNF-01, RNF-05, RNF-11):
 * agrupación por sector y Reparador Principal, reglas RN-05/RN-06, desempate
 * D-32, edición manual, proyección de despacho.json (D-31) y fecha_asignacion.
 * Los bloqueos de C4 (isla de despacho, ingesta o resultado de gestión) se
 * implementan en su ciclo: en C1 esta pestaña solo existe como parte de las 7.
 */
(function (raiz) {
  'use strict';

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'pendiente';
    var h = document.createElement('h2');
    h.textContent = 'DESPACHO — pendiente del ciclo C4';
    var p1 = document.createElement('p');
    p1.textContent = 'La generación y el ajuste del despacho del día (agrupación por sector y cuadrilla, ' +
      'citados del día por fecha_cita, RN-05/RN-06, desempate D-32, escritura de Reparador Principal y ' +
      'fecha_asignacion en el maestro, y proyección de despacho.json) se implementan en el ciclo C4.';
    var p2 = document.createElement('p');
    p2.textContent = 'Requisitos asociados: RF-08, RF-09 y RF-20; RNF-01, RNF-05 y RNF-11; decisiones D-30, ' +
      'D-31, D-32, D-37 y D-48.';
    var p3 = document.createElement('p');
    p3.textContent = 'Pestaña exclusiva del supervisor (D-35, RNF-12).';
    caja.appendChild(h); caja.appendChild(p1); caja.appendChild(p2); caja.appendChild(p3);
    contenedor.appendChild(caja);
  }

  raiz.GGTO_DESPACHO = { ciclo: 'C4', requisitos: 'RF-08, RF-09, RF-20', render: render };
})(window);
