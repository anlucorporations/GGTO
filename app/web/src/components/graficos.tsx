/**
 * Gráficos SVG en línea para la página MONITOREO.
 *
 * Sin dependencias externas (nada de recharts/chart.js): barras, barras
 * agrupadas, curva (línea) y torta se dibujan con SVG y las clases CSS de
 * `styles.css`. Todos son de solo lectura y reciben datos ya calculados.
 */

/** Ancho lógico común de los gráficos; el SVG escala con `width: 100%`. */
const ANCHO = 640;
const MARGEN_SUP = 20;
const MARGEN_INF = 60;

/** Paleta de series, alineada con los colores base del proyecto. */
export const PALETA = ['#0b4f9c', '#1f7a4d', '#8a6100', '#b3261e', '#5b21b6', '#0e7490'];

export interface DatoBarra {
  etiqueta: string;
  valor: number;
  color?: string;
}

export interface GrupoBarras {
  etiqueta: string;
  valores: number[];
}

export interface SerieLinea {
  nombre: string;
  color: string;
  valores: number[];
}

export interface PorcionTorta {
  etiqueta: string;
  valor: number;
  color: string;
}

function maximo(valores: number[]): number {
  return Math.max(1, ...valores);
}

/** Etiqueta del eje X, partida por palabras para que no se solape. */
function EtiquetaEje({
  x,
  y,
  texto,
  clase,
}: {
  x: number;
  y: number;
  texto: string;
  clase: string;
}) {
  const palabras = texto.split(' ');
  return (
    <text x={x} y={y} textAnchor="middle" className={clase}>
      {palabras.map((palabra, i) => (
        <tspan key={`${palabra}-${i}`} x={x} dy={i === 0 ? 0 : 12}>
          {palabra}
        </tspan>
      ))}
    </text>
  );
}

function Leyenda({ entradas }: { entradas: { etiqueta: string; color: string }[] }) {
  return (
    <div className="grafico-leyenda">
      {entradas.map((e) => (
        <span className="grafico-leyenda-item" key={e.etiqueta}>
          <span className="grafico-swatch" style={{ background: e.color }} />
          {e.etiqueta}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras simples                                                      */
/* ------------------------------------------------------------------ */

interface BarrasProps {
  datos: DatoBarra[];
  alto?: number;
}

/** Barras verticales con el valor encima de cada una y su etiqueta debajo. */
export function GraficoBarras({ datos, alto = 250 }: BarrasProps) {
  if (datos.length === 0) return <p className="vacio">Sin datos para graficar.</p>;

  const max = maximo(datos.map((d) => d.valor));
  const areaAltura = alto - MARGEN_SUP - MARGEN_INF;
  const paso = ANCHO / datos.length;
  const anchoBarra = Math.min(70, paso * 0.55);
  const lineaBase = MARGEN_SUP + areaAltura;

  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${ANCHO} ${alto}`} role="img" className="grafico-svg">
        <line x1={0} y1={lineaBase} x2={ANCHO} y2={lineaBase} className="grafico-eje" />
        {datos.map((d, i) => {
          const altura = (d.valor / max) * areaAltura;
          const x = i * paso + (paso - anchoBarra) / 2;
          const y = lineaBase - altura;
          return (
            <g key={`${d.etiqueta}-${i}`}>
              <rect
                x={x}
                y={y}
                width={anchoBarra}
                height={Math.max(altura, 0)}
                rx={3}
                fill={d.color ?? PALETA[0]}
              />
              <text x={x + anchoBarra / 2} y={y - 6} textAnchor="middle" className="grafico-valor">
                {d.valor}
              </text>
              <EtiquetaEje
                x={i * paso + paso / 2}
                y={lineaBase + 18}
                texto={d.etiqueta}
                clase="grafico-etiqueta"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras agrupadas                                                    */
/* ------------------------------------------------------------------ */

interface BarrasAgrupadasProps {
  grupos: GrupoBarras[];
  series: string[];
  colores?: string[];
  alto?: number;
}

/** Barras agrupadas: una serie por color dentro de cada grupo del eje X. */
export function GraficoBarrasAgrupadas({
  grupos,
  series,
  colores = PALETA,
  alto = 280,
}: BarrasAgrupadasProps) {
  if (grupos.length === 0 || series.length === 0) {
    return <p className="vacio">Sin datos para graficar.</p>;
  }

  const max = maximo(grupos.flatMap((g) => g.valores));
  const areaAltura = alto - MARGEN_SUP - MARGEN_INF;
  const paso = ANCHO / grupos.length;
  const anchoGrupo = paso * 0.68;
  const anchoBarra = anchoGrupo / series.length;
  const lineaBase = MARGEN_SUP + areaAltura;

  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${ANCHO} ${alto}`} role="img" className="grafico-svg">
        <line x1={0} y1={lineaBase} x2={ANCHO} y2={lineaBase} className="grafico-eje" />
        {grupos.map((grupo, gi) => {
          const inicio = gi * paso + (paso - anchoGrupo) / 2;
          return (
            <g key={`${grupo.etiqueta}-${gi}`}>
              {grupo.valores.map((valor, si) => {
                const altura = (valor / max) * areaAltura;
                const x = inicio + si * anchoBarra;
                const y = lineaBase - altura;
                return (
                  <g key={`${grupo.etiqueta}-${series[si] ?? si}`}>
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(anchoBarra - 3, 1)}
                      height={Math.max(altura, 0)}
                      rx={2}
                      fill={colores[si % colores.length]}
                    />
                    <text
                      x={x + anchoBarra / 2}
                      y={y - 5}
                      textAnchor="middle"
                      className="grafico-valor grafico-valor-mini"
                    >
                      {valor}
                    </text>
                  </g>
                );
              })}
              <EtiquetaEje
                x={gi * paso + paso / 2}
                y={lineaBase + 18}
                texto={grupo.etiqueta}
                clase="grafico-etiqueta"
              />
            </g>
          );
        })}
      </svg>
      <Leyenda
        entradas={series.map((nombre, i) => ({
          etiqueta: nombre,
          color: colores[i % colores.length],
        }))}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Curva (línea)                                                       */
/* ------------------------------------------------------------------ */

interface LineasProps {
  etiquetas: string[];
  series: SerieLinea[];
  alto?: number;
}

/** Curva SVG (polilínea) con un punto por observación y leyenda. */
export function GraficoLineas({ etiquetas, series, alto = 280 }: LineasProps) {
  const totalPuntos = etiquetas.length;
  if (totalPuntos === 0 || series.length === 0) {
    return <p className="vacio">Sin datos para graficar.</p>;
  }

  const max = maximo(series.flatMap((s) => s.valores));
  const areaAltura = alto - MARGEN_SUP - MARGEN_INF;
  const paso = ANCHO / Math.max(totalPuntos - 1, 1);
  const lineaBase = MARGEN_SUP + areaAltura;

  const puntos = series.map((s) =>
    s.valores.map((valor, i) => ({
      x: i * paso,
      y: lineaBase - (valor / max) * areaAltura,
    })),
  );

  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${ANCHO} ${alto}`} role="img" className="grafico-svg">
        <line x1={0} y1={lineaBase} x2={ANCHO} y2={lineaBase} className="grafico-eje" />
        {etiquetas.map((texto, i) => (
          <EtiquetaEje
            key={`${texto}-${i}`}
            x={i * paso}
            y={lineaBase + 18}
            texto={texto}
            clase="grafico-etiqueta"
          />
        ))}
        {series.map((serie, si) => (
          <g key={serie.nombre}>
            <polyline
              className="grafico-linea"
              points={puntos[si].map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={serie.color}
            />
            {puntos[si].map((p, i) => (
              <circle key={`${serie.nombre}-${i}`} cx={p.x} cy={p.y} r={3.5} fill={serie.color}>
                <title>{`${serie.nombre} ${etiquetas[i]}: ${serie.valores[i]}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <Leyenda
        entradas={series.map((s) => ({ etiqueta: s.nombre, color: s.color }))}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Torta                                                               */
/* ------------------------------------------------------------------ */

interface TortaProps {
  porciones: PorcionTorta[];
  centro?: string;
}

/** Torta SVG con `stroke-dasharray` sobre un círculo y leyenda con valores. */
export function GraficoTorta({ porciones, centro }: TortaProps) {
  const visibles = porciones.filter((p) => p.valor > 0);
  const total = visibles.reduce((suma, p) => suma + p.valor, 0);
  if (visibles.length === 0 || total === 0) {
    return <p className="vacio">Sin datos para graficar.</p>;
  }

  const radio = 60;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;

  return (
    <div className="grafico">
      <div className="grafico-torta-caja">
        <svg viewBox="0 0 160 160" role="img" className="grafico-svg grafico-torta">
          <g transform="rotate(-90 80 80)">
            {visibles.map((p) => {
              const largo = (p.valor / total) * circunferencia;
              const offset = -acumulado;
              acumulado += largo;
              return (
                <circle
                  key={p.etiqueta}
                  cx={80}
                  cy={80}
                  r={radio}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={28}
                  strokeDasharray={`${largo} ${circunferencia - largo}`}
                  strokeDashoffset={offset}
                >
                  <title>{`${p.etiqueta}: ${p.valor}`}</title>
                </circle>
              );
            })}
          </g>
          <text x={80} y={76} textAnchor="middle" className="grafico-torta-total">
            {centro ?? String(total)}
          </text>
          <text x={80} y={92} textAnchor="middle" className="grafico-torta-sub">
            total
          </text>
        </svg>
      </div>
      <ul className="grafico-torta-leyenda">
        {visibles.map((p) => (
          <li key={p.etiqueta}>
            <span className="grafico-swatch" style={{ background: p.color }} />
            <span className="grafico-torta-nombre">{p.etiqueta}</span>
            <strong>{p.valor}</strong>
            <span className="texto-pequeno">{Math.round((p.valor / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
