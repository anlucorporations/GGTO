/// Política de red para la sincronización del dispositivo (petición del técnico).
///
/// La APK **solo sincroniza por Wi-Fi**: ni la cola, ni la carga de evidencias,
/// ni la descarga del despacho deben consumir datos móviles. Si no se puede
/// comprobar el tipo de red, se decide «no» (fail-closed) y el trabajo queda
/// guardado en el dispositivo hasta que haya Wi-Fi.
library;

import 'package:connectivity_plus/connectivity_plus.dart';

class RedSync {
  RedSync._();

  /// Mensaje único para todas las pantallas cuando no hay Wi-Fi.
  static const String mensajeSinWifi =
      'La sincronización solo se permite por Wi-Fi. Conéctese a una red Wi-Fi '
      'para enviar y descargar los datos del dispositivo.';

  /// `true` si alguna de las redes activas es Wi-Fi.
  static bool esWifi(List<ConnectivityResult> resultados) =>
      resultados.contains(ConnectivityResult.wifi);

  /// Comprueba en el momento si hay Wi-Fi. Nunca lanza: ante duda, `false`.
  static Future<bool> hayWifi() async {
    try {
      return esWifi(await Connectivity().checkConnectivity());
    } catch (_) {
      return false;
    }
  }
}
