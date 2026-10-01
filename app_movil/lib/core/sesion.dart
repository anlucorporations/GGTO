/// Datos de la sesión del usuario autenticado.
class SesionUsuario {
  const SesionUsuario({
    required this.p00,
    required this.nombre,
    required this.apellido,
    required this.correo,
    required this.rol,
    this.idCentral,
    this.idTecnico,
  });

  final String p00;
  final String nombre;
  final String apellido;
  final String correo;
  final String rol;
  final int? idCentral;
  final int? idTecnico;

  /// Nombre completo, o el P00 si no hay nombre registrado.
  String get nombreCompleto {
    final completo = '$nombre $apellido'.trim();
    return completo.isEmpty ? p00 : completo;
  }

  bool get esTecnico => rol == 'TECNICO';
  bool get esSuper => rol == 'SUPER';
  bool get soloLectura => esTecnico;

  /// Normaliza la respuesta de `POST /auth/login` (`usuario`) y `GET /auth/me`.
  factory SesionUsuario.fromJson(Map<String, dynamic> json) {
    return SesionUsuario(
      p00: '${json['p00'] ?? ''}',
      nombre: '${json['nombre'] ?? ''}',
      apellido: '${json['apellido'] ?? ''}',
      correo: '${json['correo'] ?? ''}',
      rol: '${json['rol'] ?? ''}',
      idCentral: json['id_central'] is int ? json['id_central'] as int : null,
      idTecnico: json['id_tecnico'] is int ? json['id_tecnico'] as int : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'p00': p00,
        'nombre': nombre,
        'apellido': apellido,
        'correo': correo,
        'rol': rol,
        'id_central': idCentral,
        'id_tecnico': idTecnico,
      };

  @override
  String toString() => 'SesionUsuario($p00, $rol)';
}
