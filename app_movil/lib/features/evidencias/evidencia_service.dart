import 'dart:io';

import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/constants.dart';
import '../../core/database.dart';

/// Tipos de evidencia que pide el brief (§4.3).
enum TipoEvidencia {
  potencia('POTENCIA', 'Potencia del equipo'),
  navegacion('NAVEGACION', 'Prueba de navegación'),
  demo('DEMO', 'Demostrativa');

  const TipoEvidencia(this.codigo, this.etiqueta);

  final String codigo;
  final String etiqueta;
}

/// Captura de evidencias por cámara con GPS y fecha/hora.
///
/// Cumple RF-14 y §4.3: **solo cámara** (sin galería), imagen comprimida de baja
/// calidad, archivo serializado como
/// `N.º de caso + id_avería + tipo + fecha y hora`, y carpeta propia de la app.
class EvidenciaService {
  const EvidenciaService._();

  static final ImagePicker _picker = ImagePicker();

  /// Abre la cámara, guarda la evidencia y devuelve su serial (o `null` si se canceló).
  static Future<String?> capturar({
    required String idCaso,
    required String idAveria,
    required TipoEvidencia tipo,
    required DateTime momento,
    double? latitud,
    double? longitud,
  }) async {
    final XFile? foto = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: AppConstants.evidenciaLadoMaximo,
      maxHeight: AppConstants.evidenciaLadoMaximo,
      imageQuality: AppConstants.evidenciaCalidad,
      preferredCameraDevice: CameraDevice.rear,
    );
    if (foto == null) return null;

    final serial = serialDe(idCaso: idCaso, idAveria: idAveria, tipo: tipo, momento: momento);
    final destino = await _rutaDestino(serial);

    // Validar límite de 3 MB (decisión del usuario). Si la cámara devuelve un
    // archivo mayor, se re-comprime con calidad decreciente.
    var bytes = await File(foto.path).readAsBytes();
    if (bytes.lengthInBytes > 3 * 1024 * 1024) {
      for (var calidad = AppConstants.evidenciaCalidad - 5; calidad >= 30; calidad -= 5) {
        final recomprimida = await _picker.pickImage(
          source: ImageSource.camera,
          maxWidth: AppConstants.evidenciaLadoMaximo,
          maxHeight: AppConstants.evidenciaLadoMaximo,
          imageQuality: calidad,
          preferredCameraDevice: CameraDevice.rear,
        );
        if (recomprimida == null) break;
        bytes = await File(recomprimida.path).readAsBytes();
        if (bytes.lengthInBytes <= 3 * 1024 * 1024) break;
      }
      if (bytes.lengthInBytes > 3 * 1024 * 1024) {
        throw StateError('La foto supera el máximo de 3 MB incluso tras comprimirla.');
      }
    }
    await destino.writeAsBytes(bytes);

    await DatabaseHelper.instance.guardarEvidencia(
      idCaso: idCaso,
      idAveria: idAveria,
      rutaArchivo: destino.path,
      tipo: tipo.codigo,
      serialImagen: serial,
      latitud: latitud,
      longitud: longitud,
      momento: momento,
    );
    return serial;
  }

  /// Nombre normalizado de la evidencia: `caso-idAveria-TIPO-aaaammdd-hhmmss.jpg`.
  static String serialDe({
    required String idCaso,
    required String idAveria,
    required TipoEvidencia tipo,
    required DateTime momento,
  }) {
    String dos(int valor) => valor.toString().padLeft(2, '0');
    final marca = '${momento.year}${dos(momento.month)}${dos(momento.day)}'
        '-${dos(momento.hour)}${dos(momento.minute)}${dos(momento.second)}';
    final limpio = _limpiar('${idCaso}_$idAveria');
    return '$limpio-${tipo.codigo}-$marca.jpg';
  }

  /// Carpeta de evidencias dentro del almacenamiento propio de la app.
  static Future<Directory> carpetaEvidencias() async {
    final base = await getApplicationDocumentsDirectory();
    final carpeta = Directory(p.join(base.path, 'evidencias'));
    if (!await carpeta.exists()) {
      await carpeta.create(recursive: true);
    }
    return carpeta;
  }

  static Future<File> _rutaDestino(String serial) async {
    final carpeta = await carpetaEvidencias();
    return File(p.join(carpeta.path, serial));
  }

  /// Obtiene la ubicación actual, pidiendo permiso si hace falta.
  ///
  /// Devuelve `null` si el servicio está apagado o no se concede el permiso; la
  /// captura continúa y la evidencia queda sin coordenadas.
  static Future<Position?> ubicacion() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var permiso = await Geolocator.checkPermission();
      if (permiso == LocationPermission.denied) {
        permiso = await Geolocator.requestPermission();
      }
      if (permiso == LocationPermission.denied || permiso == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
    } catch (_) {
      return null;
    }
  }

  /// Texto de la ubicación para mostrar en pantalla.
  static String describir(Position? posicion) {
    if (posicion == null) return 'Sin ubicación';
    return '${posicion.latitude.toStringAsFixed(5)}, ${posicion.longitude.toStringAsFixed(5)}';
  }

  static String _limpiar(String valor) =>
      valor.replaceAll(RegExp(r'[^A-Za-z0-9_\-]'), '_');
}
