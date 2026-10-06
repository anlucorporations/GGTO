import 'dart:convert';

import '../../core/api_client.dart';
import '../../core/database.dart';

/// Datos del perfil del usuario autenticado (D-82 · requisito 4).
class PerfilUsuario {
  const PerfilUsuario({
    required this.p00,
    required this.nombre,
    required this.apellido,
    required this.correo,
    required this.rol,
    this.idCentral,
  });

  final String p00;
  final String nombre;
  final String apellido;
  final String correo;
  final String rol;
  final int? idCentral;

  String get nombreCompleto {
    final completo = '$nombre $apellido'.trim();
    return completo.isEmpty ? p00 : completo;
  }

  factory PerfilUsuario.fromJson(Map<String, dynamic> json) => PerfilUsuario(
        p00: '${json['p00'] ?? ''}',
        nombre: '${json['nombre'] ?? ''}',
        apellido: '${json['apellido'] ?? ''}',
        correo: '${json['correo'] ?? ''}',
        rol: '${json['rol'] ?? ''}',
        idCentral: json['id_central'] is int ? json['id_central'] as int : null,
      );

  Map<String, dynamic> toJson() => {
        'p00': p00,
        'nombre': nombre,
        'apellido': apellido,
        'correo': correo,
        'rol': rol,
        'id_central': idCentral,
      };
}

/// Cuadrilla activa del usuario (datos administrativos).
class CuadrillaInfo {
  const CuadrillaInfo({
    this.idCuadrilla,
    this.codigo,
    this.nombre,
    this.desde,
    this.esSupervisor = false,
  });

  final int? idCuadrilla;
  final String? codigo;
  final String? nombre;
  final String? desde;
  final bool esSupervisor;

  String get etiqueta {
    if (idCuadrilla == null) return 'Sin cuadrilla activa';
    final partes = [codigo, nombre].where((p) => p != null && p.isNotEmpty).join(' · ');
    return partes.isEmpty ? 'Cuadrilla $idCuadrilla' : partes;
  }

  factory CuadrillaInfo.fromJson(Map<String, dynamic> json) => CuadrillaInfo(
        idCuadrilla: json['id_cuadrilla'] is int ? json['id_cuadrilla'] as int : null,
        codigo: json['codigo'] == null ? null : '${json['codigo']}',
        nombre: json['nombre'] == null ? null : '${json['nombre']}',
        desde: json['desde'] == null ? null : '${json['desde']}',
        esSupervisor: json['es_supervisor'] == true,
      );

  Map<String, dynamic> toJson() => {
        'id_cuadrilla': idCuadrilla,
        'codigo': codigo,
        'nombre': nombre,
        'desde': desde,
        'es_supervisor': esSupervisor,
      };
}

/// Estado de las 12 palabras de seguridad (nunca expone los valores).
class EstadoSeguridad {
  const EstadoSeguridad({
    required this.p00,
    required this.tienePalabras,
    this.version,
    this.cantidad = 0,
    this.actualizadoEn,
    this.requiereCambioClave = false,
    this.bloqueado = false,
  });

  final String p00;
  final bool tienePalabras;
  final int? version;
  final int cantidad;
  final String? actualizadoEn;
  final bool requiereCambioClave;
  final bool bloqueado;

  factory EstadoSeguridad.fromJson(Map<String, dynamic> json) => EstadoSeguridad(
        p00: '${json['p00'] ?? ''}',
        tienePalabras: json['tiene_palabras'] == true,
        version: json['version'] is int ? json['version'] as int : null,
        cantidad: json['cantidad'] is int ? json['cantidad'] as int : 0,
        actualizadoEn: json['actualizado_en'] == null ? null : '${json['actualizado_en']}',
        requiereCambioClave: json['requiere_cambio_clave'] == true,
        bloqueado: json['bloqueado'] == true,
      );
}

/// Servicio de la sección **Usuario** de la APK (D-82 · requisitos 3 y 4).
///
/// Todo lo que se puede pintar sin conexión (perfil y cuadrilla) queda cacheado
/// en la base local, de modo que la sección abre con **contenido local** y se
/// actualiza cuando hay red.
class UsuarioService {
  const UsuarioService._();

  static const _clavePerfil = 'perfil_local';
  static const _claveCuadrilla = 'cuadrilla_local';

  /// Datos personales/administrativos del usuario autenticado.
  static Future<PerfilUsuario?> cargarPerfil({bool usarCache = true}) async {
    try {
      final datos = await ApiClient.get('/auth/me');
      if (datos is Map) {
        final perfil = PerfilUsuario.fromJson(Map<String, dynamic>.from(datos));
        await DatabaseHelper.instance.guardarMeta(_clavePerfil, jsonEncode(perfil.toJson()));
        return perfil;
      }
    } catch (_) {
      // Sin red: se devuelve lo último guardado en el dispositivo.
    }
    return usarCache ? await perfilLocal() : null;
  }

  /// Perfil guardado en el dispositivo (sin tocar la red).
  static Future<PerfilUsuario?> perfilLocal() async {
    final crudo = await DatabaseHelper.instance.leerMeta(_clavePerfil);
    if (crudo == null || crudo.isEmpty) return null;
    try {
      final datos = jsonDecode(crudo);
      if (datos is Map) return PerfilUsuario.fromJson(Map<String, dynamic>.from(datos));
    } catch (_) {
      // Registro ilegible: se ignora.
    }
    return null;
  }

  /// Cuadrilla activa del usuario (`GET /sync/cuadrilla`).
  static Future<CuadrillaInfo?> cargarCuadrilla() async {
    try {
      final datos = await ApiClient.get('/sync/cuadrilla');
      if (datos is Map) {
        final cuadrilla = CuadrillaInfo.fromJson(Map<String, dynamic>.from(datos));
        await DatabaseHelper.instance.guardarMeta(
          _claveCuadrilla,
          jsonEncode(cuadrilla.toJson()),
        );
        return cuadrilla;
      }
    } catch (_) {
      // Sin red: se usa la copia local.
    }
    return cuadrillaLocal();
  }

  static Future<CuadrillaInfo?> cuadrillaLocal() async {
    final crudo = await DatabaseHelper.instance.leerMeta(_claveCuadrilla);
    if (crudo == null || crudo.isEmpty) return null;
    try {
      final datos = jsonDecode(crudo);
      if (datos is Map) return CuadrillaInfo.fromJson(Map<String, dynamic>.from(datos));
    } catch (_) {
      // Registro ilegible: se ignora.
    }
    return null;
  }

  /// Estado de las palabras de seguridad (`GET /auth/mi-seguridad`).
  static Future<EstadoSeguridad?> estadoSeguridad() async {
    final datos = await ApiClient.get('/auth/mi-seguridad');
    if (datos is Map) {
      return EstadoSeguridad.fromJson(Map<String, dynamic>.from(datos));
    }
    return null;
  }

  /// Cambia la propia contraseña verificando la actual (RNF-01).
  static Future<String> cambiarClave({
    required String claveActual,
    required String claveNueva,
    required String confirmacion,
  }) async {
    final datos = await ApiClient.post('/auth/cambio-clave', data: {
      'clave_actual': claveActual,
      'clave_nueva': claveNueva,
      'confirmacion': confirmacion,
    });
    if (datos is Map && datos['mensaje'] != null) return '${datos['mensaje']}';
    return 'Contraseña actualizada.';
  }

  /// Actualiza el correo del propio perfil (`PATCH /auth/me`).
  static Future<PerfilUsuario?> actualizarCorreo(String correo) async {
    final datos = await ApiClient.patch('/auth/me', data: {'correo': correo.trim()});
    if (datos is Map) {
      final perfil = PerfilUsuario.fromJson(Map<String, dynamic>.from(datos));
      await DatabaseHelper.instance.guardarMeta(_clavePerfil, jsonEncode(perfil.toJson()));
      return perfil;
    }
    return null;
  }

  /// Muestra las 12 palabras de seguridad tras verificar la **contraseña actual**.
  ///
  /// Las palabras anteriores dejan de ser válidas: el servidor las regenera y el
  /// usuario debe guardar las nuevas.
  static Future<List<String>> mostrarPalabras(String claveActual) async {
    final datos = await ApiClient.post('/auth/palabras/mostrar', data: {
      'clave': claveActual,
    });
    if (datos is Map && datos['palabras'] is List) {
      return (datos['palabras'] as List).map((p) => '$p').toList();
    }
    return const [];
  }
}
