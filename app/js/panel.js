/*
 * GGTO-v1 - panel.js
 * PENDIENTE DEL CICLO C3 (RF-02, RF-03, RF-04, RF-28): búsqueda por id_averia o
 * telefono, actualización de gestión y alta manual con id_averia MAN-.
 */
(function (raiz) {
  'use strict';

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'pendiente';
    var h = document.createElement('h2');
    h.textContent = 'PANEL — pendiente del ciclo C3';
    var p1 = document.createElement('p');
    p1.textContent = 'La búsqueda por id_averia o teléfono, la actualización de gestión y el alta manual ' +
      'de casos con id_averia MAN- (lista cerrada de campos de D-18) se implementan en el ciclo C3.';
    var p2 = document.createElement('p');
    p2.textContent = 'Requisitos asociados: RF-02, RF-03, RF-04 y RF-28; RNF-06, RNF-08 a RNF-12.';
    caja.appendChild(h); caja.appendChild(p1); caja.appendChild(p2);
    contenedor.appendChild(caja);
  }

  raiz.GGTO_PANEL = { ciclo: 'C3', requisitos: 'RF-02 a RF-04, RF-28', render: render };
})(window);
