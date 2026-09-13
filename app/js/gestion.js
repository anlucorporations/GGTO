/*
 * GGTO-v1 - gestion.js
 * PENDIENTE DEL CICLO C3 (RF-15, RF-07 clasificación, RF-28): bandeja
 * telefónica de status = GESTION, cola por antigüedad y sector, guion de
 * verificación y reclasificación. Exclusiva del supervisor (D-35, RNF-12).
 */
(function (raiz) {
  'use strict';

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'pendiente';
    var h = document.createElement('h2');
    h.textContent = 'GESTION — pendiente del ciclo C3';
    var p1 = document.createElement('p');
    p1.textContent = 'La bandeja telefónica de los casos con status = GESTION (cola por antigüedad y sector, ' +
      'guion de verificación, registro del resultado de la llamada y «Enviar a calle») se implementa en el ciclo C3.';
    var p2 = document.createElement('p');
    p2.textContent = 'Requisitos asociados: RF-15, RF-07 (clasificación) y RF-28; D-30, D-35 y D-38.';
    var p3 = document.createElement('p');
    p3.textContent = 'Pestaña exclusiva del supervisor: en la sesión de operador aparece deshabilitada.';
    caja.appendChild(h); caja.appendChild(p1); caja.appendChild(p2); caja.appendChild(p3);
    contenedor.appendChild(caja);
  }

  raiz.GGTO_GESTION = { ciclo: 'C3', requisitos: 'RF-15, RF-07, RF-28', render: render };
})(window);
