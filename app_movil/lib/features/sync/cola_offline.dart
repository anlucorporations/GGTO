/// Dueño único de la cola offline (D-124 · H-07).
///
/// La cola local (`accion_pendiente`) la procesaban **dos** caminos:
///
///   1. La **CARGA** (`UploadService`), que agrupa cierres, enrutados y evidencias
///      de un diferido en `POST /sync/carga` y los marca **acción por acción**
///      (D-121).
///   2. El **outbox clásico** (`SyncProvider.sincronizar`), que envía cada acción
///      suelta a su endpoint original (y también lo lanza el auto-envío de 5 min).
///
/// Si ambos veían el mismo tipo, la acción salía dos veces (dos cierres y doble
/// juego de evidencias). La regla es **un solo dueño por tipo**: estos tipos solo
/// los envía la CARGA; el outbox los ignora.
library;

/// Tipos cuya única vía de envío es `POST /sync/carga`.
const Set<String> tiposQueSoloVaPorCarga = {
  'CIERRE',
  'ENRUTADO',
  'DIFERIDO_EVIDENCIAS',
};

/// ¿Ese tipo lo envía la CARGA (y por tanto el outbox debe ignorarlo)?
bool esTipoDeCarga(String tipo) => tiposQueSoloVaPorCarga.contains(tipo.trim().toUpperCase());

/// Acciones de la cola que puede enviar el **outbox clásico**.
///
/// Función pura para poder probarla sin SQLite ni red.
List<Map<String, dynamic>> accionesParaOutbox(
  List<Map<String, dynamic>> acciones,
) =>
    acciones.where((accion) => !esTipoDeCarga('${accion['tipo']}')).toList();
