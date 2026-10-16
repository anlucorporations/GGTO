/**
 * Columna **Sector** de los listados (D-103).
 *
 * Muestra el sector y, debajo, el **FAT** del caso cuando la API lo entrega: en
 * campo, el sector dice dónde y el FAT dice exactamente en qué caja se trabaja.
 * Si no hay FAT, la celda queda como estaba (solo el sector).
 */
export default function CeldaSector({
  sector,
  fat,
}: {
  sector: string | null | undefined;
  fat: string | null | undefined;
}) {
  const nombre = (sector ?? '').trim();
  const caja = (fat ?? '').trim();

  if (!nombre && !caja) return <span className="tenue">—</span>;

  return (
    <span className="celda-sector">
      <span className="sector-nombre">{nombre || '—'}</span>
      {caja && (
        <span className="sector-fat" title={`FAT ${caja}`}>
          <span className="sector-fat-etiqueta">FAT</span>
          <span className="mono">{caja}</span>
        </span>
      )}
    </span>
  );
}
