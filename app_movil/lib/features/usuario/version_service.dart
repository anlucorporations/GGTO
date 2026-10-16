import 'package:dio/dio.dart';

import '../../core/constants.dart';
import '../../core/version_app.dart';

/// Metadatos de la APK publicada (`/apk/apk.json`), tal como los escribe
/// `scripts/publicar_apk.py` al publicar una entrega.
class MetaApk {
  const MetaApk({
    required this.version,
    required this.nombre,
    required this.ruta,
    required this.kb,
    required this.sha256,
    required this.compiladoEn,
    required this.nota,
  });

  final String version;
  final String nombre;
  final String ruta;
  final int kb;
  final String sha256;
  final DateTime? compiladoEn;
  final String nota;

  static MetaApk? desdeJson(Map<String, dynamic> json) {
    final version = '${json['version'] ?? ''}'.trim();
    if (version.isEmpty) return null;
    return MetaApk(
      version: version,
      nombre: '${json['nombre'] ?? 'GGTO Técnico'}',
      ruta: '${json['ruta'] ?? '/apk/ggto-tecnico.apk'}',
      kb: int.tryParse('${json['kb'] ?? 0}') ?? 0,
      sha256: '${json['sha256'] ?? ''}',
      compiladoEn: DateTime.tryParse('${json['compilado_en'] ?? ''}'),
      nota: '${json['nota'] ?? ''}',
    );
  }

  /// Tamaño legible (p. ej. `24,0 MB`).
  String get tamanoLegible => kb <= 0 ? '—' : '${(kb / 1024).toStringAsFixed(1)} MB';

  /// Fecha legible en hora local, o `—` si no vino.
  String get fechaLegible {
    final fecha = compiladoEn?.toLocal();
    if (fecha == null) return '—';
    String dos(int v) => v.toString().padLeft(2, '0');
    return '${dos(fecha.day)}/${dos(fecha.month)}/${fecha.year}';
  }
}

/// Error de consulta con mensaje ya listo para la interfaz.
class VersionError implements Exception {
  const VersionError(this.mensaje);
  final String mensaje;
  @override
  String toString() => mensaje;
}

/// Consulta la última versión publicada de la APK.
///
/// El archivo `apk.json` lo publica `scripts/publicar_apk.py` junto al binario y
/// lo sirve la misma web (`/apk/apk.json`), así que **no** requiere sesión: es
/// información pública de la entrega.
///
/// Se usa un cliente propio y sin token para que el chequeo no interfiera con la
/// sesión ni dispare el cierre por 401 del interceptor de `ApiClient`.
class VersionService {
  VersionService({Dio? dio}) : _dio = dio ?? _crearDio();

  final Dio _dio;

  static Dio _crearDio() => Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 8),
          sendTimeout: const Duration(seconds: 8),
          responseType: ResponseType.json,
        ),
      );

  /// Quita el sufijo `/api/v1` para quedarse con el origen del sitio.
  static String origenDeApi([String base = AppConstants.baseUrl]) {
    final sinBarra = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    final match = RegExp(r'^(.*?)/api/v\d+$').firstMatch(sinBarra);
    return match?.group(1) ?? sinBarra;
  }

  /// URL de los metadatos de la última entrega.
  static String urlMetadatos([String base = AppConstants.baseUrl]) =>
      '${origenDeApi(base)}/apk/apk.json';

  /// URL absoluta de descarga a partir de la ruta publicada.
  static String urlDescarga(MetaApk meta, [String base = AppConstants.baseUrl]) {
    final ruta = meta.ruta.startsWith('/') ? meta.ruta : '/${meta.ruta}';
    return '${origenDeApi(base)}$ruta';
  }

  /// Pide `apk.json` y lo interpreta. Lanza [VersionError] con un mensaje claro.
  Future<MetaApk> consultar({String base = AppConstants.baseUrl}) async {
    try {
      final respuesta = await _dio.get<Map<String, dynamic>>(urlMetadatos(base));
      final datos = respuesta.data;
      if (datos == null) {
        throw const VersionError('El servidor no devolvió los datos de la versión.');
      }
      final meta = MetaApk.desdeJson(datos);
      if (meta == null) {
        throw const VersionError('El servidor no publica todavía una versión válida.');
      }
      return meta;
    } on VersionError {
      rethrow;
    } on DioException catch (e) {
      final codigo = e.response?.statusCode;
      if (codigo == 404) {
        throw const VersionError('El servidor no publica todavía una APK descargable.');
      }
      throw const VersionError('Sin conexión con el servidor: no se pudo comprobar la versión.');
    } catch (_) {
      throw const VersionError('No se pudo comprobar la versión.');
    }
  }

  /// Compara lo publicado con lo instalado usando la regla de [compararVersiones].
  ComparacionVersion comparar(MetaApk meta, {String instalada = AppConstants.version}) =>
      compararVersiones(instalada: instalada, disponible: meta.version);
}
