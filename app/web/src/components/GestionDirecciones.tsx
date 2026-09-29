/**
 * Gestión de direcciones sin sector detectadas en la ingesta (requisito 2, D-66).
 *
 * Tras cargar el archivo diario, las direcciones que no coinciden con ningún
 * sector se listan aquí para agregarlas a un sector (SECTOR) y volver a
 * sectorizar los casos pendientes.
 */
import { useEffect, useState } from 'react';
import * as api from '../api/client';
import type { DireccionSinSector, Sector } from '../api/types';
import Modal from './Modal';

interface Props {
  direcciones: DireccionSinSector[];
  idCentral: number | null;
  onCerrar: () => void;
  onResuelto: (asignados: number) => void;
}

export default function GestionDirecciones({ direcciones, idCentral, onCerrar, onResuelto }: Props) {
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [eleccion, setEleccion] = useState<Record<string, number | ''>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    api
      .listarSectores({ id_central: idCentral ?? undefined })
      .then((lista) => {
        if (activo) setSectores(lista.filter((s) => s.activo));
      })
      .catch((e) => {
        if (activo) setError(e instanceof api.ApiError ? e.message : 'No se pudieron listar los sectores.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [idCentral]);

  const seleccionadas = direcciones.filter((d) => eleccion[d.direccion]);

  async function guardar() {
    if (seleccionadas.length === 0) {
      setError('Indique a qué sector pertenece al menos una dirección.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      for (const d of seleccionadas) {
        const idSector = Number(eleccion[d.direccion]);
        await api.agregarDireccionSector(idSector, {
          patron: d.direccion,
          tipo_coincidencia: 'CONTIENE',
          normalizar: true,
          activo: true,
        });
      }
      const resultado = await api.sectorizarPendientes(idCentral);
      onResuelto(resultado.asignados);
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudieron agregar las direcciones.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Direcciones sin sector" onCerrar={onCerrar}>
      {error && <p className="aviso aviso-error">{error}</p>}
      <p className="texto-pequeno">
        Estas direcciones del archivo no pertenecen a ningún sector. Asígnelas a un sector para que
        los casos queden sectorizados y entren al despacho.
      </p>

      {cargando ? (
        <p className="texto-pequeno">Cargando sectores…</p>
      ) : sectores.length === 0 ? (
        <p className="vacio">No hay sectores activos. Créelos primero en CONFIGURACIÓN → Sectores.</p>
      ) : (
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>Dirección</th>
                <th>Casos</th>
                <th>Ejemplo</th>
                <th>Sector destino</th>
              </tr>
            </thead>
            <tbody>
              {direcciones.map((d) => (
                <tr key={d.direccion}>
                  <td>{d.direccion}</td>
                  <td>{d.total}</td>
                  <td className="mono">{d.ejemplo_id_averia ?? '—'}</td>
                  <td>
                    <select
                      aria-label={`Sector para ${d.direccion}`}
                      value={eleccion[d.direccion] ?? ''}
                      onChange={(e) =>
                        setEleccion({
                          ...eleccion,
                          [d.direccion]: e.target.value ? Number(e.target.value) : '',
                        })
                      }
                    >
                      <option value="">— Seleccione —</option>
                      {sectores.map((s) => (
                        <option key={s.id_sector} value={s.id_sector}>
                          {s.codigo} — {s.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="acciones-form">
        <button
          className="btn"
          type="button"
          onClick={() => void guardar()}
          disabled={guardando || cargando || sectores.length === 0}
        >
          {guardando ? 'Guardando…' : 'Agregar direcciones y sectorizar'}
        </button>
        <button className="btn btn-secundario" type="button" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
