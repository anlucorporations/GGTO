import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'constants.dart';

/// Registro local rotativo de fallos no controlados (D-155 - H-15).
///
/// La APK no envía datos a un servicio externo: escribe un log acotado en el
/// almacenamiento privado de la aplicación para que el técnico pueda adjuntarlo
/// al reportar un fallo. El contenido se sanea antes de escribir (sin token,
/// P00, correo ni teléfono). El envío remoto (Sentry/Crashlytics) queda como
/// integración pendiente de credenciales.
class CrashLog {
  CrashLog._();

  /// Tamaño máximo del archivo activo antes de rotar.
  static const int maxBytes = 256 * 1024;

  /// Cantidad de archivos rotados que se conservan.
  static const int maxArchivos = 3;

  /// Tamaño máximo de un texto de error antes de truncarlo.
  static const int maxTexto = 16 * 1024;

  static const String _nombre = 'ggto_tecnico.log';
  static Directory? _directorio;
  static Future<void> _cola = Future<void>.value();

  /// Instala los enganches de errores no controlados.
  ///
  /// [directorio] permite fijar la carpeta (pruebas). [enganchar] se desactiva
  /// en las pruebas para no sustituir los manejadores de Flutter.
  static Future<void> iniciar(
      {Directory? directorio, bool enganchar = true}) async {
    if (directorio != null) _directorio = directorio;
    if (!enganchar) return;

    FlutterError.onError = (detalles) {
      FlutterError.presentError(detalles);
      unawaited(
        registrar(detalles.exception, detalles.stack, origen: 'flutter'),
      );
    };
    PlatformDispatcher.instance.onError = (error, pila) {
      unawaited(registrar(error, pila, origen: 'platform'));
      return true;
    };
  }

  /// Escribe un fallo saneado en el log local, rotando si hace falta.
  static Future<void> registrar(
    Object error,
    StackTrace? pila, {
    String origen = 'app',
  }) {
    String texto;
    try {
      final cuerpo = '${error.toString()}\n${pila?.toString() ?? '(sin pila)'}';
      final recortado = cuerpo.length > maxTexto
          ? '${cuerpo.substring(0, maxTexto)}\n...(truncado)'
          : cuerpo;
      final ahora = DateTime.now().toUtc().toIso8601String();
      texto = sanitizar(
        '$ahora [$origen] v${AppConstants.version}\n$recortado\n---\n',
      );
    } catch (_) {
      return Future<void>.value();
    }

    _cola = _cola.then((_) => _escribirAhora(texto)).catchError((Object _) {});
    return _cola;
  }

  /// Redacta los datos que no deben quedar en el dispositivo.
  static String sanitizar(String texto) {
    var limpio = texto;
    limpio = limpio.replaceAll(
      RegExp(
        r'\bAuthorization\s*[=:]\s*(?:Bearer\s+)?[A-Za-z0-9._~+/=-]+',
        caseSensitive: false,
      ),
      'Authorization: ***',
    );
    limpio = limpio.replaceAll(
      RegExp(r'\bBearer\s+[A-Za-z0-9._~+/=-]+', caseSensitive: false),
      'Bearer ***',
    );
    limpio = limpio.replaceAll(
      RegExp(r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b'),
      '***',
    );
    limpio = limpio.replaceAllMapped(
      RegExp(
        r'\b(token|clave|password|contrase(?:n|ñ)a|secret)'
        r'(\s*[=:]\s*)[^\s,;]+',
        caseSensitive: false,
      ),
      (m) => '${m[1]}${m[2]}***',
    );
    limpio = limpio.replaceAllMapped(
      RegExp(r'\b(p00)(\s*[=:]\s*)[A-Za-z0-9_-]+', caseSensitive: false),
      (m) => '${m[1]}${m[2]}***',
    );
    limpio = limpio.replaceAllMapped(
      RegExp(r'("usuario"\s*:\s*")[^"]*(")', caseSensitive: false),
      (m) => '${m[1]}***${m[2]}',
    );
    limpio = limpio.replaceAll(
      RegExp(r'\b[\w.+-]+@[\w-]+\.[\w.-]+\b'),
      '***@***',
    );
    limpio = limpio.replaceAll(
      RegExp(r'\b(?:\+?58)?0?4(?:12|14|16|24|26)\d{7}\b'),
      '***',
    );
    limpio = limpio.replaceAll(RegExp(r'\b\d{10,11}\b'), '***');
    return limpio;
  }

  static Future<Directory> _directorioLogs() async {
    final base = _directorio ?? await getApplicationSupportDirectory();
    final logs = Directory('${base.path}/logs');
    if (!await logs.exists()) await logs.create(recursive: true);
    return logs;
  }

  static Future<void> _escribirAhora(String texto) async {
    final dir = await _directorioLogs();
    final archivo = File('${dir.path}/$_nombre');
    final bytes = utf8.encode(texto).length;
    if (await archivo.exists() && (await archivo.length()) + bytes > maxBytes) {
      await _rotar(dir);
    }
    await archivo.writeAsString(texto, mode: FileMode.append, flush: true);
  }

  static Future<void> _rotar(Directory dir) async {
    final base = '${dir.path}/$_nombre';
    for (var i = maxArchivos; i >= 1; i--) {
      final destino = File('$base.$i');
      if (await destino.exists()) await destino.delete();
      final origen = File(i == 1 ? base : '$base.${i - 1}');
      if (await origen.exists()) await origen.rename(destino.path);
    }
  }
}
