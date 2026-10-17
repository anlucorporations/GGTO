import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'version_service.dart';

/// Resultado de un intento de actualización en la propia app (D-107).
enum EstadoActualizacion {
  /// La APK quedó descargada y se abrió el instalador del sistema.
  instaladorAbierto,

  /// Falta permitir «instalar apps desconocidas» para esta app.
  requierePermiso,

  /// El instalador del sistema no se pudo abrir (sin visor de paquetes).
  instaladorNoDisponible,

  /// La descarga falló (sin conexión, servidor, disco…).
  errorDescarga,

  /// El archivo descargado no coincide con el SHA-256 publicado.
  huellaIncorrecta,
}

/// Resultado con mensaje listo para mostrar.
class ResultadoActualizacion {
  const ResultadoActualizacion(this.estado, this.mensaje, {this.bytes = 0});

  final EstadoActualizacion estado;
  final String mensaje;
  final int bytes;

  bool get ok => estado == EstadoActualizacion.instaladorAbierto;
}

/// **Actualización dentro de la propia app** (D-107).
///
/// Antes la tarjeta de versión abría el navegador con la APK y el técnico tenía
/// que instalarla a mano. Ahora la app:
///
/// 1. comprueba el permiso de instalación (`REQUEST_INSTALL_PACKAGES`);
/// 2. descarga la APK publicada en su **caché interna** con progreso;
/// 3. verifica el **SHA-256** que publica `apk.json` (no se instala un binario
///    alterado o truncado);
/// 4. abre el **instalador de Android**, que reemplaza la app en su sitio: no hay
///    que desinstalar y se conservan la sesión y los datos locales.
///
/// El puente nativo vive en `MainActivity.kt` (canal `ggto/actualizador`); aquí
/// solo se orquesta la descarga y se traducen los fallos a mensajes.
class ActualizadorApk {
  ActualizadorApk({MethodChannel? canal, Dio? dio})
      : _canal = canal ?? const MethodChannel(canalNativo),
        _dio = dio;

  /// Canal con la parte nativa (descarga aparte para poder probar sin Android).
  static const String canalNativo = 'ggto/actualizador';

  final MethodChannel _canal;
  final Dio? _dio;

  /// Nombre del archivo de la APK descargada (p. ej. `ggto-1.8.0+17.apk`).
  static String nombreArchivo(String version) => 'ggto-${version.replaceAll('+', '-')}.apk';

  /// Descarga (si hace falta) la APK de [meta] y abre el instalador.
  ///
  /// [onProgreso] recibe de 0 a 1 mientras descarga y la fase en texto.
  Future<ResultadoActualizacion> actualizar(
    MetaApk meta, {
    void Function(double progreso, String fase)? onProgreso,
  }) async {
    final instalable = await _puedeInstalar();
    if (!instalable) {
      await _abrirAjustes();
      return const ResultadoActualizacion(
        EstadoActualizacion.requierePermiso,
        'Permita «instalar apps desconocidas» para GGTO Técnico y vuelva a pulsar '
        '«Actualizar ahora». Se abrió la pantalla de ajustes.',
      );
    }

    final destino = await _rutaDestino(meta);
    // Se libera el espacio de entregas anteriores antes de descargar (best-effort:
    // si no se puede, la actualización sigue).
    await limpiarAnteriores(meta.version);

    if (meta.sha256.isNotEmpty && await destino.exists() && destino.lengthSync() > 0) {
      // Reutiliza una descarga previa solo si la huella coincide.
      final previa = await _huella(destino);
      if (previa != meta.sha256.toLowerCase()) {
        try {
          await destino.delete();
        } catch (_) {
          // Si no se puede borrar, se vuelve a descargar encima.
        }
      }
    }

    if (!await destino.exists() || destino.lengthSync() == 0) {
      final descargado = await _descargar(meta, destino, onProgreso);
      if (!descargado) {
        return const ResultadoActualizacion(
          EstadoActualizacion.errorDescarga,
          'No se pudo descargar la actualización. Compruebe la conexión y vuelva a intentarlo.',
        );
      }
    }

    if (meta.sha256.isNotEmpty) {
      final huella = await _huella(destino);
      if (huella != meta.sha256.toLowerCase()) {
        try {
          await destino.delete();
        } catch (_) {}
        return const ResultadoActualizacion(
          EstadoActualizacion.huellaIncorrecta,
          'La descarga no coincide con la huella publicada: se descartó. Vuelva a intentarlo.',
        );
      }
    }

    onProgreso?.call(1, 'Abriendo el instalador…');
    final abierto = await _invocar<bool>('instalar', {'ruta': destino.path});
    if (abierto != true) {
      return const ResultadoActualizacion(
        EstadoActualizacion.instaladorNoDisponible,
        'No se pudo abrir el instalador del sistema. Use «Descargar en el navegador».',
      );
    }
    return ResultadoActualizacion(
      EstadoActualizacion.instaladorAbierto,
      'Confirme la instalación en la ventana del sistema. La app se actualizará '
      'sobre esta misma y conservará su sesión y sus datos.',
      bytes: destino.lengthSync(),
    );
  }

  /// Borra las APK descargadas de versiones anteriores (no ocupan espacio).
  Future<void> limpiarAnteriores(String versionActual) async {
    try {
      final carpeta = await _carpeta();
      final conservar = nombreArchivo(versionActual);
      for (final fichero in carpeta.listSync()) {
        if (fichero is! File || !fichero.path.endsWith('.apk')) continue;
        if (p.basename(fichero.path) == conservar) continue;
        try {
          fichero.deleteSync();
        } catch (_) {
          // Un archivo en uso no impide la actualización.
        }
      }
    } catch (_) {
      // La limpieza es best-effort: nunca bloquea la actualización.
    }
  }

  // ------------------------------------------------------------------ //

  Future<Directory> _carpeta() async {
    // El plazo evita que un fallo del canal de almacenamiento deje el botón
    // «Actualizar» colgado en «Preparando…».
    final cache = await getTemporaryDirectory().timeout(const Duration(seconds: 8));
    final carpeta = Directory(p.join(cache.path, 'apk'));
    if (!await carpeta.exists()) await carpeta.create(recursive: true);
    return carpeta;
  }

  Future<File> _rutaDestino(MetaApk meta) async =>
      File(p.join((await _carpeta()).path, nombreArchivo(meta.version)));

  Future<bool> _descargar(
    MetaApk meta,
    File destino,
    void Function(double, String)? onProgreso,
  ) async {
    final url = VersionService.urlDescarga(meta);
    final dio = _dio ??
        Dio(
          BaseOptions(
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(minutes: 5),
            followRedirects: true,
          ),
        );
    try {
      await dio.download(
        url,
        destino.path,
        onReceiveProgress: (recibido, total) {
          if (total <= 0) {
            onProgreso?.call(0, 'Descargando la actualización…');
            return;
          }
          final fraccion = (recibido / total).clamp(0.0, 1.0);
          onProgreso?.call(
            fraccion,
            'Descargando la actualización… ${(fraccion * 100).toStringAsFixed(0)} %',
          );
        },
      );
      return await destino.exists() && destino.lengthSync() > 0;
    } on DioException {
      try {
        if (await destino.exists()) await destino.delete();
      } catch (_) {}
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<String> _huella(File archivo) async =>
      sha256.convert(await archivo.readAsBytes()).toString();

  Future<bool> _puedeInstalar() async =>
      await _invocar<bool>('puedeInstalar') ?? false;

  Future<bool> _abrirAjustes() async =>
      await _invocar<bool>('abrirAjustes') ?? false;

  /// Invoca el canal nativo; en escritorio/pruebas devuelve `null`.
  Future<T?> _invocar<T>(String metodo, [Map<String, Object?>? argumentos]) async {
    try {
      return await _canal.invokeMethod<T>(metodo, argumentos);
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }
}
