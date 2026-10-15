/// Documento de credencial local para el acceso sin conexión (D-100 · RF-73).
///
/// En el dispositivo se guarda **un documento** con una ficha por cada técnico
/// que haya iniciado sesión con red. Cada ficha reúne lo necesario para validar
/// el PIN y reconstruir la sesión **sin servidor**:
///
/// * identidad y rol, para saber a quién se le abre la sesión;
/// * **sal + verificador del PIN** — el PIN nunca se guarda en claro;
/// * `pinPorDefecto`, que obliga a cambiarlo la primera vez;
/// * `emitidaEn` y `ultimoAccesoConRed`, de los que depende la **vigencia de
///   24 h**;
/// * `intentosFallidos`, para bloquear la ficha igual que hace el servidor.
///
/// Vive en `flutter_secure_storage`, cifrado con el Keystore de Android. Solo se
/// emite para el rol **TÉCNICO**: los roles de gestión siempre exigen conexión.
library;

import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'pin_hash.dart';
import 'sesion.dart';

/// Versión del formato del documento. Un documento de otra versión se descarta.
const int versionCredencial = 1;

/// Una ficha del documento: la credencial de un técnico en este dispositivo.
class CredencialLocal {
  const CredencialLocal({
    required this.p00,
    required this.nombre,
    required this.apellido,
    required this.correo,
    required this.rol,
    required this.sal,
    required this.verificador,
    required this.pinPorDefecto,
    required this.emitidaEn,
    required this.ultimoAccesoConRed,
    this.idCentral,
    this.idTecnico,
    this.intentosFallidos = 0,
  });

  final String p00;
  final String nombre;
  final String apellido;
  final String correo;
  final String rol;
  final int? idCentral;
  final int? idTecnico;

  /// Sal aleatoria del PBKDF2, en base64.
  final String sal;

  /// Verificador del PIN (PBKDF2-HMAC-SHA256), en base64.
  final String verificador;

  /// `true` mientras el PIN siga siendo el de fábrica: obliga a cambiarlo.
  final bool pinPorDefecto;

  final DateTime emitidaEn;

  /// Último acceso **con red**: de aquí cuelga la vigencia de 24 h.
  final DateTime ultimoAccesoConRed;

  final int intentosFallidos;

  /// Crea la ficha de un técnico con el PIN indicado.
  factory CredencialLocal.nueva({
    required SesionUsuario usuario,
    required String pin,
    required DateTime ahora,
    required String? sal,
  }) {
    final salUsada = sal ?? generarSal();
    return CredencialLocal(
      p00: usuario.p00,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
      idCentral: usuario.idCentral,
      idTecnico: usuario.idTecnico,
      sal: salUsada,
      verificador: derivarPin(pin, salUsada),
      pinPorDefecto: true,
      emitidaEn: ahora,
      ultimoAccesoConRed: ahora,
    );
  }

  /// Vigencia de la credencial (D-100): 24 h desde el último acceso con red.
  bool vigente(DateTime ahora, {required Duration vigencia}) =>
      ahora.difference(ultimoAccesoConRed) < vigencia;

  /// Comprueba el PIN contra el verificador.
  bool comprobarPin(String pin) =>
      compararEnTiempoConstante(derivarPin(pin, sal), verificador);

  /// Reconstruye los datos de sesión que se restauran al entrar sin conexión.
  SesionUsuario get sesion => SesionUsuario(
        p00: p00,
        nombre: nombre,
        apellido: apellido,
        correo: correo,
        rol: rol,
        idCentral: idCentral,
        idTecnico: idTecnico,
      );

  CredencialLocal copyWith({
    String? sal,
    String? verificador,
    bool? pinPorDefecto,
    DateTime? ultimoAccesoConRed,
    int? intentosFallidos,
  }) =>
      CredencialLocal(
        p00: p00,
        nombre: nombre,
        apellido: apellido,
        correo: correo,
        rol: rol,
        idCentral: idCentral,
        idTecnico: idTecnico,
        sal: sal ?? this.sal,
        verificador: verificador ?? this.verificador,
        pinPorDefecto: pinPorDefecto ?? this.pinPorDefecto,
        emitidaEn: emitidaEn,
        ultimoAccesoConRed: ultimoAccesoConRed ?? this.ultimoAccesoConRed,
        intentosFallidos: intentosFallidos ?? this.intentosFallidos,
      );

  /// Refresca la identidad y reinicia la vigencia (acceso con red correcto).
  CredencialLocal renovada(SesionUsuario usuario, DateTime ahora) => CredencialLocal(
        p00: usuario.p00,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        idCentral: usuario.idCentral,
        idTecnico: usuario.idTecnico,
        sal: sal,
        verificador: verificador,
        pinPorDefecto: pinPorDefecto,
        emitidaEn: emitidaEn,
        ultimoAccesoConRed: ahora,
        intentosFallidos: 0,
      );

  Map<String, dynamic> toJson() => {
        'p00': p00,
        'nombre': nombre,
        'apellido': apellido,
        'correo': correo,
        'rol': rol,
        'id_central': idCentral,
        'id_tecnico': idTecnico,
        'sal': sal,
        'verificador': verificador,
        'pin_por_defecto': pinPorDefecto,
        'emitida_en': emitidaEn.toUtc().toIso8601String(),
        'ultimo_acceso_con_red': ultimoAccesoConRed.toUtc().toIso8601String(),
        'intentos_fallidos': intentosFallidos,
      };

  static CredencialLocal? fromJson(Map<String, dynamic> json) {
    final p00 = '${json['p00'] ?? ''}';
    final sal = '${json['sal'] ?? ''}';
    final verificador = '${json['verificador'] ?? ''}';
    final emitida = DateTime.tryParse('${json['emitida_en'] ?? ''}');
    final ultimo = DateTime.tryParse('${json['ultimo_acceso_con_red'] ?? ''}');
    if (p00.isEmpty || sal.isEmpty || verificador.isEmpty || emitida == null || ultimo == null) {
      return null; // ficha corrupta: se descarta en vez de bloquear el arranque
    }
    return CredencialLocal(
      p00: p00,
      nombre: '${json['nombre'] ?? ''}',
      apellido: '${json['apellido'] ?? ''}',
      correo: '${json['correo'] ?? ''}',
      rol: '${json['rol'] ?? ''}',
      idCentral: json['id_central'] is int ? json['id_central'] as int : null,
      idTecnico: json['id_tecnico'] is int ? json['id_tecnico'] as int : null,
      sal: sal,
      verificador: verificador,
      pinPorDefecto: json['pin_por_defecto'] == true,
      emitidaEn: emitida.toUtc(),
      ultimoAccesoConRed: ultimo.toUtc(),
      intentosFallidos: json['intentos_fallidos'] is int
          ? json['intentos_fallidos'] as int
          : 0,
    );
  }

  @override
  String toString() => 'CredencialLocal($p00, $rol, pinPorDefecto=$pinPorDefecto)';
}

/// El documento completo: todas las fichas emitidas en este dispositivo.
class DocumentoCredencial {
  const DocumentoCredencial({this.credenciales = const []});

  final List<CredencialLocal> credenciales;

  bool get vacio => credenciales.isEmpty;

  CredencialLocal? buscar(String p00) {
    final clave = p00.trim().toUpperCase();
    for (final ficha in credenciales) {
      if (ficha.p00.toUpperCase() == clave) return ficha;
    }
    return null;
  }

  /// Devuelve el documento con la ficha insertada o reemplazada.
  DocumentoCredencial con(CredencialLocal ficha) {
    final otras = credenciales
        .where((c) => c.p00.toUpperCase() != ficha.p00.toUpperCase())
        .toList();
    return DocumentoCredencial(credenciales: [...otras, ficha]);
  }

  /// Devuelve el documento sin la ficha indicada.
  DocumentoCredencial sin(String p00) => DocumentoCredencial(
        credenciales: credenciales
            .where((c) => c.p00.toUpperCase() != p00.trim().toUpperCase())
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'version': versionCredencial,
        'credenciales': credenciales.map((c) => c.toJson()).toList(),
      };

  static DocumentoCredencial fromJson(Map<String, dynamic> json) {
    if (json['version'] != versionCredencial) return const DocumentoCredencial();
    final bruto = json['credenciales'];
    if (bruto is! List) return const DocumentoCredencial();
    final fichas = <CredencialLocal>[];
    for (final item in bruto) {
      if (item is Map) {
        final ficha = CredencialLocal.fromJson(Map<String, dynamic>.from(item));
        if (ficha != null) fichas.add(ficha);
      }
    }
    return DocumentoCredencial(credenciales: fichas);
  }
}

/// Almacén del documento en el almacén cifrado del sistema.
class CredencialStore {
  CredencialStore._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _clave = 'credencial_local';

  static Future<DocumentoCredencial> leer() async {
    try {
      final crudo = await _storage.read(key: _clave);
      if (crudo == null || crudo.isEmpty) return const DocumentoCredencial();
      final datos = jsonDecode(crudo);
      if (datos is Map) {
        return DocumentoCredencial.fromJson(Map<String, dynamic>.from(datos));
      }
    } catch (_) {
      // Documento ilegible: se trata como si no hubiera credencial.
    }
    return const DocumentoCredencial();
  }

  static Future<void> guardar(DocumentoCredencial documento) async {
    await _storage.write(key: _clave, value: jsonEncode(documento.toJson()));
  }

  static Future<void> borrar() async {
    await _storage.delete(key: _clave);
  }
}
