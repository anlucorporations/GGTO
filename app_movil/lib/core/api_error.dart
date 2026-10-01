import 'package:dio/dio.dart';

/// Error de la API con el mensaje real que devuelve el servidor.
///
/// El backend responde el formato estándar de FastAPI (`{"detail": ...}`), y en
/// el login añade la cabecera `X-Intentos-Restantes`. Sin esto, la APK mostraba
/// «Error en login» para cualquier causa (401, 403, 423, 429 o 5xx).
class ApiError implements Exception {
  ApiError({
    required this.mensaje,
    this.status,
    this.intentosRestantes,
    this.detalle,
    this.esDeRed = false,
  });

  /// Mensaje listo para mostrar al usuario.
  final String mensaje;

  /// Código HTTP, o `null` si la petición no llegó al servidor.
  final int? status;

  /// Intentos que le quedan al usuario antes del bloqueo (solo en login).
  final int? intentosRestantes;

  /// Detalle técnico (útil en los registros de sincronización).
  final String? detalle;

  /// `true` cuando el fallo es de conectividad, no de credenciales.
  final bool esDeRed;

  bool get esCredencial => status == 401;
  bool get estaBloqueado => status == 423;
  bool get demasiadosIntentos => status == 429;
  bool get esPermiso => status == 403;
  bool get esConflicto => status == 409;
  bool get esNoEncontrado => status == 404;
  bool get esValidacion => status == 422;

  /// El error no se resolverá reintentando (útil para la cola offline).
  bool get esDefinitivo =>
      esPermiso || esConflicto || esNoEncontrado || esValidacion;

  factory ApiError.desconocido(Object error) {
    if (error is ApiError) return error;
    if (error is DioException) return ApiError.fromDio(error);
    return ApiError(mensaje: 'Error inesperado: $error', detalle: '$error');
  }

  factory ApiError.fromDio(DioException error) {
    final tipo = error.type;
    final respuesta = error.response;
    final status = respuesta?.statusCode;

    if (tipo == DioExceptionType.connectionTimeout ||
        tipo == DioExceptionType.receiveTimeout ||
        tipo == DioExceptionType.sendTimeout) {
      return ApiError(
        mensaje: 'El servidor tardó demasiado en responder.',
        status: status,
        detalle: '$tipo',
        esDeRed: true,
      );
    }
    if (tipo == DioExceptionType.connectionError ||
        tipo == DioExceptionType.unknown ||
        tipo == DioExceptionType.badCertificate) {
      return ApiError(
        mensaje: 'Sin conexión con el servidor.',
        status: status,
        detalle: '$tipo',
        esDeRed: true,
      );
    }
    if (tipo == DioExceptionType.cancel) {
      return ApiError(mensaje: 'Petición cancelada.', status: status, detalle: '$tipo');
    }

    final intentos = int.tryParse(
      respuesta?.headers.value('x-intentos-restantes')?.toString() ?? '',
    );

    return ApiError(
      mensaje: _mensajeDe(status, _extraerDetail(respuesta?.data)),
      status: status,
      intentosRestantes: intentos,
      detalle: '${respuesta?.data}',
    );
  }

  /// Extrae el `detail` de FastAPI: cadena o lista de errores de validación.
  static String? _extraerDetail(dynamic datos) {
    if (datos is Map && datos['detail'] != null) {
      final detail = datos['detail'];
      if (detail is String) return detail;
      if (detail is List) {
        final partes = <String>[];
        for (final item in detail) {
          if (item is Map) {
            final campo = (item['loc'] is List && (item['loc'] as List).isNotEmpty)
                ? (item['loc'] as List).last.toString()
                : 'campo';
            partes.add('$campo: ${item['msg'] ?? 'valor inválido'}');
          } else {
            partes.add('$item');
          }
        }
        return partes.join(' · ');
      }
      return '$detail';
    }
    return null;
  }

  static String _mensajeDe(int? status, String? detail) {
    switch (status) {
      case 400:
        return detail ?? 'La petición no es válida.';
      case 401:
        return detail ?? 'Credenciales inválidas o sesión expirada.';
      case 403:
        return detail ?? 'Su rol no tiene permiso para esta operación.';
      case 404:
        return detail ?? 'El recurso no existe en el servidor.';
      case 409:
        return detail ?? 'La operación entra en conflicto con el estado actual.';
      case 422:
        return detail ?? 'Los datos enviados no son válidos.';
      case 423:
        return detail ?? 'La cuenta está bloqueada.';
      case 429:
        return detail ?? 'Demasiados intentos. Espere un momento.';
      case null:
        return detail ?? 'No se pudo completar la operación.';
      default:
        if (status >= 500) {
          return detail ?? 'El servidor reportó un error interno ($status).';
        }
        return detail ?? 'Error inesperado del servidor ($status).';
    }
  }

  @override
  String toString() =>
      'ApiError(status: $status, red: $esDeRed, mensaje: $mensaje)';
}
