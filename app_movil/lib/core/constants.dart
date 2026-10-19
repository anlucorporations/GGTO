/// Constantes de la aplicación.
class AppConstants {
  /// URL base de la API. Se puede sobrescribir en tiempo de compilación:
  /// `flutter build apk --dart-define=GGTO_API_BASE=http://10.0.2.2:8000/api/v1`
  static const String baseUrl = String.fromEnvironment(
    'GGTO_API_BASE',
    defaultValue: 'https://ggto-web-593453426217.europe-west1.run.app/api/v1',
  );

  /// Versión visible de la app, tal como se muestra en la pantalla de acceso.
  ///
  /// Debe coincidir **exactamente** con `version:` de `pubspec.yaml` (nombre y
  /// versionCode). Hay una prueba que lo verifica (`test/version_visible_test.dart`):
  /// al subir el versionCode de cada entrega a CANTV hay que actualizar ambos.
  static const String version = '1.15.1+26';

  /// Máximo de intentos de login antes del bloqueo (RF-20).
  static const int maxIntentos = 3;

  // --------------------------------------------------------------------- //
  // D-100 · Acceso sin conexión (PIN local)                                //
  // --------------------------------------------------------------------- //

  /// PIN de fábrica del acceso sin conexión, para las cuentas **ya dadas de
  /// alta**. Se entrega así para que un técnico que nunca configuró nada pueda
  /// entrar en campo, y la app **obliga a cambiarlo** en el primer uso.
  static const String pinPorDefecto = '824605';

  /// Longitud exigida al PIN (solo dígitos).
  static const int pinLongitud = 6;

  /// Vigencia del acceso sin conexión: pasadas estas horas sin conectarse, la
  /// app exige red para renovar la credencial.
  static const int credencialOfflineHoras = 24;

  /// D-117: minutos de inactividad antes de bloquear la pantalla. El bloqueo
  /// **no cierra la sesión**: solo pide el PIN para volver a la misma pantalla.
  static const int bloqueoInactividadMinutos = 2;

  /// Intentos de sincronización antes de marcar una acción como fallida.
  static const int maxIntentosSync = 5;

  /// Evidencias fotográficas admitidas en un reporte de falla masiva (D-82).
  static const int maxEvidenciasFallaMasiva = 2;

  /// Tamaño máximo de una evidencia (decisión del usuario: 3 MB por foto).
  static const int maxFotoBytes = 3 * 1024 * 1024;

  /// Tamaño máximo (lado mayor) de las evidencias: el brief pide baja calidad.
  static const double evidenciaLadoMaximo = 1280;

  /// Calidad JPEG de las evidencias (0-100).
  static const int evidenciaCalidad = 70;
}
