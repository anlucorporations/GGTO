/**
 * Pestaña INGESTA (ciclo D-72): reservada a Supervisor, Administrador y Super
 * Usuario. Agrupa las fichas «Ingesta» (carga del CSV diario e historial de
 * lotes), «Zona casos globales» y «Zona capacidad operativa».
 */
import Ingesta from './Ingesta';
import { BloqueCasosGlobales, BloqueCapacidadOperativa } from './Monitoreo';

export default function TabIngesta() {
  return (
    <>
      <Ingesta />
      <BloqueCasosGlobales />
      <BloqueCapacidadOperativa />
    </>
  );
}
