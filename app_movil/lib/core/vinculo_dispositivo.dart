/// Vínculo del dispositivo con el primer técnico que inicia sesión (D-138 · H-21).
///
/// La caché y la cola offline son del **dispositivo**: sobrevivían al cierre de
/// sesión, así que el siguiente técnico que entraba en el mismo teléfono veía los
/// casos del anterior (con su PII) y podía enviar su trabajo.
///
/// Decisión del usuario: **solo el usuario que inicia por primera vez puede
/// acceder**. El dispositivo guarda el P00 del primer acceso; otro P00 queda
/// bloqueado hasta que se haga el restablecimiento completo (que borra el vínculo).
library;

/// Marcas locales del vínculo (claves de `meta`).
const String claveP00Dispositivo = 'dispositivo_p00';

/// ¿Puede [p00] iniciar sesión en este dispositivo?
///
/// - Sin vínculo previo → sí (y el llamador debe guardarlo: es el «primero»).
/// - Con el mismo P00 → sí.
/// - Con otro P00 → **no**.
bool vinculoPermite({required String? vinculado, required String p00}) {
  final dueno = (vinculado ?? '').trim().toUpperCase();
  if (dueno.isEmpty) return true;
  return dueno == p00.trim().toUpperCase();
}

/// Mensaje que ve el técnico cuando el dispositivo está vinculado a otro P00.
const String mensajeDispositivoVinculado =
    'Este dispositivo está vinculado a otro usuario. Solo el técnico que inició '
    'sesión por primera vez puede usarlo. Para entregarlo a otra persona haga el '
    'restablecimiento completo en DISPOSITIVO → Restablecer la aplicación.';
