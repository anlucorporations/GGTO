/// Constantes de la aplicación.
class AppConstants {
  /// URL base de la API. Se puede sobrescribir en tiempo de compilación:
  /// `flutter build apk --dart-define=GGTO_API_BASE=http://10.0.2.2:8000/api/v1`
  static const String baseUrl = String.fromEnvironment(
    'GGTO_API_BASE',
    defaultValue: 'https://ggto-web-593453426217.europe-west1.run.app/api/v1',
  );

  /// Versión visible de la app (debe coincidir con `pubspec.yaml`).
  static const String version = '1.0.0+1';

  /// Máximo de intentos de login antes del bloqueo (RF-20).
  static const int maxIntentos = 3;

  /// Intentos de sincronización antes de marcar una acción como fallida.
  static const int maxIntentosSync = 5;

  /// Tamaño máximo (lado mayor) de las evidencias: el brief pide baja calidad.
  static const double evidenciaLadoMaximo = 1280;

  /// Calidad JPEG de las evidencias (0-100).
  static const int evidenciaCalidad = 70;
}
