import 'dart:async';

import 'package:dio/dio.dart';

import 'api_error.dart';
import 'auth_storage.dart';
import 'constants.dart';

/// Cliente HTTP único de la aplicación.
///
/// Registra el interceptor que añade `Authorization: Bearer` (H-01), fija
/// tiempos de espera (H-39) y avisa al llamador cuando la sesión expira (H-18).
class ApiClient {
  ApiClient._();

  static final Dio _dio = Dio(
    BaseOptions(
      baseUrl: AppConstants.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      // Holgado: la subida de evidencias y el envío del ZIP pueden tardar.
      sendTimeout: const Duration(seconds: 90),
      headers: const {'Accept': 'application/json'},
      // Los 4xx/5xx se manejan como `ApiError`, no como excepción de Dio.
      validateStatus: (status) => status != null && status < 500,
    ),
  );

  static bool _inicializado = false;
  static Future<void> Function()? _onSesionExpirada;

  /// Debe llamarse una sola vez, antes de `runApp`.
  static void init({Future<void> Function()? onSesionExpirada}) {
    if (_inicializado) return;
    _inicializado = true;
    _onSesionExpirada = onSesionExpirada;

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await AuthStorage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onResponse: (response, handler) {
          // El backend responde 4xx con el formato estándar de FastAPI.
          final status = response.statusCode ?? 0;
          if (status >= 400) {
            handler.reject(
              DioException(
                requestOptions: response.requestOptions,
                response: response,
                type: DioExceptionType.badResponse,
              ),
            );
            return;
          }
          handler.next(response);
        },
        onError: (error, handler) async {
          final status = error.response?.statusCode;
          if (status == 401 && _onSesionExpirada != null) {
            await _onSesionExpirada!();
          }
          // El error de red ya viene con la respuesta adjunta: se propaga tal cual.
          handler.next(error);
        },
      ),
    );
  }

  static Dio get dio => _dio;

  /// GET que devuelve el cuerpo ya decodificado y lanza `ApiError`.
  static Future<dynamic> get(String ruta, {Map<String, dynamic>? query}) =>
      _ejecutar(() => _dio.get(ruta, queryParameters: query));

  /// POST que devuelve el cuerpo ya decodificado y lanza `ApiError`.
  static Future<dynamic> post(String ruta, {Object? data}) =>
      _ejecutar(() => _dio.post(ruta, data: data));

  /// PATCH que devuelve el cuerpo ya decodificado y lanza `ApiError`.
  static Future<dynamic> patch(String ruta, {Object? data}) =>
      _ejecutar(() => _dio.patch(ruta, data: data));

  /// PUT que devuelve el cuerpo ya decodificado y lanza `ApiError`.
  static Future<dynamic> put(String ruta, {Object? data}) =>
      _ejecutar(() => _dio.put(ruta, data: data));

  static Future<dynamic> _ejecutar(Future<Response<dynamic>> Function() peticion) async {
    try {
      final respuesta = await peticion();
      return respuesta.data;
    } on DioException catch (error) {
      throw ApiError.fromDio(error);
    } on ApiError {
      rethrow;
    } catch (error) {
      throw ApiError.desconocido(error);
    }
  }
}
