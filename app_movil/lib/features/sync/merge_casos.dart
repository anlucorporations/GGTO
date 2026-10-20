/// Fusión de un caso descargado con lo que ya tenía el dispositivo (D-126 · H-09).
///
/// La DESCARGA reemplazaba la fila local (`ConflictAlgorithm.replace`) con el JSON
/// del servidor. Si el técnico ya había marcado CONTACTADO/CERRADO **sin
/// conexión**, el servidor seguía enviando su estado anterior (`NUEVO`) y la
/// descarga lo pisaba: el caso reaparecía como pendiente, se perdía
/// `pendiente_sync` y el técnico podía repetir la acción.
///
/// Regla (acordada): **lo pendiente manda**. Mientras el caso tenga trabajo en la
/// cola o su marca `pendiente_sync`, la descarga refresca todos los campos menos
/// el **estado** y la marca; cuando la acción se envía y la cola queda vacía, la
/// siguiente descarga vuelve a mandar.
library;

/// Fusiona [entrante] (servidor) con [local] (dispositivo) para `caso_local`.
///
/// - Sin fila local o sin trabajo pendiente → manda el servidor.
/// - Con trabajo pendiente → se conserva el `estado_actual` local (si lo hay) y
///   `pendiente_sync = true`; el resto de campos se refresca.
Map<String, dynamic> fusionarCasoDescargado({
  required Map<String, dynamic> entrante,
  Map<String, dynamic>? local,
  required bool tieneTrabajoPendiente,
}) {
  final fusionado = Map<String, dynamic>.from(entrante);
  if (local == null || !tieneTrabajoPendiente) {
    fusionado['pendiente_sync'] = false;
    return fusionado;
  }
  final estadoLocal = '${local['estado_actual'] ?? ''}'.trim();
  if (estadoLocal.isNotEmpty) {
    fusionado['estado_actual'] = estadoLocal;
  }
  fusionado['pendiente_sync'] = true;
  return fusionado;
}
