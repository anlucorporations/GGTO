import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'sesion.dart';

/// Almacenamiento seguro de la sesión (token JWT y datos del usuario).
///
/// La sesión se guarda además en disco para poder **arrancar sin conexión**
/// (H-11): si no hay red, la app muestra la sesión cacheada y el usuario puede
/// seguir trabajando con la cola offline.
class AuthStorage {
  AuthStorage._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _claveToken = 'jwt_token';
  static const _claveSesion = 'sesion_usuario';

  static Future<void> saveToken(String token) async {
    await _storage.write(key: _claveToken, value: token);
  }

  static Future<String?> getToken() async {
    return _storage.read(key: _claveToken);
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: _claveToken);
  }

  /// Guarda el token y los datos del usuario de una sola vez.
  static Future<void> guardarSesion(String token, SesionUsuario usuario) async {
    await _storage.write(key: _claveToken, value: token);
    await _storage.write(key: _claveSesion, value: jsonEncode(usuario.toJson()));
  }

  /// Recupera la sesión cacheada (o `null` si no hay).
  static Future<SesionUsuario?> getSesion() async {
    final crudo = await _storage.read(key: _claveSesion);
    if (crudo == null || crudo.isEmpty) return null;
    try {
      final datos = jsonDecode(crudo);
      if (datos is Map<String, dynamic>) return SesionUsuario.fromJson(datos);
      if (datos is Map) return SesionUsuario.fromJson(Map<String, dynamic>.from(datos));
    } catch (_) {
      // Sesión corrupta: se descarta para no bloquear el arranque.
    }
    return null;
  }

  /// Borra la sesión completa (token y datos).
  static Future<void> limpiarSesion() async {
    await _storage.delete(key: _claveToken);
    await _storage.delete(key: _claveSesion);
  }
}
