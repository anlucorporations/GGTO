/// Política de reintentos de la DESCARGA (D-135 · H-18).
///
/// La descarga es la operación crítica —sin ella el técnico no tiene despacho— y
/// era la **única** que no reintentaba: una sola llamada con 30 s de timeout. Un
/// corte momentáneo de red dejaba la sincronización sin casos hasta la siguiente
/// vuelta.
///
/// Función pura para poder probarla sin red.
library;

/// Esperas entre intentos de la descarga (2 reintentos: 1 s y 3 s).
const List<Duration> esperasDescarga = [
  Duration(seconds: 1),
  Duration(seconds: 3),
];

/// ¿Merece reintento un fallo de la descarga?
///
/// - Fallo de red (sin respuesta) → sí, mientras queden intentos.
/// - 5xx → sí (el servidor puede recuperarse).
/// - 4xx → **no**: reintentar no cambia el resultado (y 404/405 activa la caída
///   al `GET /sync/descarga` antiguo, que se resuelve fuera de esta política).
bool reintentableDescarga({
  required int? status,
  required bool deRed,
  required int intento,
}) {
  if (intento >= esperasDescarga.length) return false;
  if (deRed) return true;
  return status != null && status >= 500;
}
