/*
 * GGTO-v1 - graficos.js
 * PENDIENTE DEL CICLO C5 (RF-05, RF-06): gráficos de las 6 zonas con Chart.js
 * local (app/lib/chart.umd.min.js, RT-07) — barras, barras + línea y torta —
 * cada uno con su tabla o texto alternativo equivalente (D-40, RNF-13).
 */
(function (raiz) {
  'use strict';

  function render(contenedor, ctx) {
    contenedor.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'pendiente';
    var h = document.createElement('h2');
    h.textContent = 'GRAFICOS — pendiente del ciclo C5';
    var p1 = document.createElement('p');
    p1.textContent = 'Los gráficos de las 6 zonas (barras, barras + línea semanal y torta) se implementan en ' +
      'el ciclo C5, con Chart.js local y alternativa textual accesible en cada gráfico.';
    var p2 = document.createElement('p');
    p2.textContent = 'Requisitos asociados: RF-05 y RF-06; RNF-02 y RNF-13 (D-40); decisión D-34.';
    caja.appendChild(h); caja.appendChild(p1); caja.appendChild(p2);
    contenedor.appendChild(caja);
  }

  raiz.GGTO_GRAFICOS = { ciclo: 'C5', requisitos: 'RF-05, RF-06', render: render };
})(window);
