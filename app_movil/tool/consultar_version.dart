/// Comprobación real del chequeo de versión (D-102) contra el servidor.
///
/// Uso (desde `app_movil`):
///   dart run tool/consultar_version.dart [url-base] [version-instalada]
///
/// El segundo argumento permite simular otra versión instalada (por ejemplo
/// `1.3.0+12`) para ver el camino de «hay actualización».
///
/// Sirve de diagnóstico para el equipo: imprime los metadatos publicados, la
/// versión instalada en el binario y el veredicto de la regla. No forma parte de
/// la aplicación: no se empaqueta en la APK.
///
/// Es una herramienta de consola: imprimir **es** su salida.
// ignore_for_file: avoid_print
library;

import 'package:ggto_tecnico/core/constants.dart';
import 'package:ggto_tecnico/core/version_app.dart';
import 'package:ggto_tecnico/features/usuario/version_service.dart';

Future<void> main(List<String> args) async {
  final base = args.isNotEmpty ? args.first : AppConstants.baseUrl;
  final instalada = args.length > 1 ? args[1] : AppConstants.version;
  print('Origen       : ${VersionService.origenDeApi(base)}');
  print('Metadatos    : ${VersionService.urlMetadatos(base)}');
  print('Instalada    : $instalada');

  try {
    final meta = await VersionService().consultar(base: base);
    print('Publicada    : ${meta.version} (${meta.nombre})');
    print('Tamaño       : ${meta.tamanoLegible} · compilada el ${meta.fechaLegible}');
    print('Descarga     : ${VersionService.urlDescarga(meta, base)}');
    print('SHA-256      : ${meta.sha256}');

    final r = compararVersiones(instalada: instalada, disponible: meta.version);
    print('¿Actualizar? : ${r.hayActualizacion ? 'SÍ' : 'NO'} — ${r.motivo}');
  } on VersionError catch (e) {
    print('ERROR        : ${e.mensaje}');
  }
}
