/// Persistencia de la aceptación del aviso de uso restringido (APK).
///
/// D-73: el aviso se muestra en **cada inicio de sesión**, por lo que no se
/// persiste entre sesiones. La clase se conserva como interfaz para pruebas y
/// para permitir una futura política configurable (por ejemplo, aceptar solo
/// al cambiar de versión).
class DisclaimerStorage {
  DisclaimerStorage._();

  /// Versión vigente del aviso (debe coincidir con `VERSION_DISCLAIMER` de la web).
  static const version = 'v1';

  /// En la política actual siempre se exige aceptar antes de ingresar.
  static Future<bool> aceptado() async => false;

  /// No-op: la aceptación dura solo la sesión actual.
  static Future<void> registrar() async {}

  /// No-op: no hay estado persistente que borrar.
  static Future<void> borrar() async {}
}
