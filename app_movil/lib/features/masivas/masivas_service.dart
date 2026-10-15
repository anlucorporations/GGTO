import '../../core/api_client.dart';

/// Resultado del **cierre en cascada** de una masiva (D-99 · RF-61/RF-62).
///
/// El servidor cierra **todos** los casos asociados con el modo indicado y la
/// descripción «Reparado en FDT»; los que ya estaban cerrados se omiten y se
/// informan en el detalle.
class ResultadoCierreMasiva {
  const ResultadoCierreMasiva({
    required this.idFalla,
    required this.estado,
    required this.casosCerrados,
    required this.casosOmitidos,
    this.detalle = const [],
  });

  final int idFalla;
  final String estado;
  final int casosCerrados;
  final int casosOmitidos;

  /// Detalle por caso: `{id_caso, id_averia?, resultado, motivo?}`.
  final List<Map<String, dynamic>> detalle;

  /// Resumen listo para mostrar al usuario.
  String get resumen => 'Masiva #$idFalla · $estado · '
      '$casosCerrados caso(s) cerrado(s) · $casosOmitidos omitido(s)';

  factory ResultadoCierreMasiva.fromJson(Map<String, dynamic> json) {
    final detalle = json['detalle'];
    return ResultadoCierreMasiva(
      idFalla: json['id_falla'] is int ? json['id_falla'] as int : 0,
      estado: '${json['estado'] ?? ''}',
      casosCerrados: json['casos_cerrados'] is int ? json['casos_cerrados'] as int : 0,
      casosOmitidos: json['casos_omitidos'] is int ? json['casos_omitidos'] as int : 0,
      detalle: detalle is List
          ? detalle
              .whereType<Map<String, dynamic>>()
              .map((m) => Map<String, dynamic>.from(m))
              .toList()
          : const [],
    );
  }

  /// Línea del detalle de un caso (`#91 · CERRADO · Reparado en FDT`).
  static String lineaDetalle(Map<String, dynamic> item) {
    final idCaso = '${item['id_caso'] ?? '—'}';
    final averia = '${item['id_averia'] ?? ''}'.trim();
    final resultado = '${item['resultado'] ?? ''}';
    final motivo = '${item['motivo'] ?? ''}'.trim();
    return [
      '#$idCaso',
      if (averia.isNotEmpty) averia,
      resultado,
      if (motivo.isNotEmpty) motivo,
    ].join(' · ');
  }
}

/// Operaciones del módulo **MASIVAS** contra la API (D-99).
///
/// Concentra las rutas de la ficha para que las pantallas queden delgadas:
/// ficha, casos asociados, órdenes de material, planificación, solicitud de
/// material, personal del CRASS y cierre en cascada.
class MasivasService {
  const MasivasService._();

  /// Texto que queda en **cada caso** al cerrar la masiva (RF-62).
  static const String descripcionCasoPorDefecto = 'Reparado en FDT';

  /// Modos de cierre admitidos por el servidor.
  static const List<String> modosCierre = ['IVR', 'COS', 'SACAS'];

  /// Longitudes mínimas que exige la API (se validan antes de enviar).
  static const int minimoPlanificacion = 5;
  static const int minimoMaterial = 3;
  static const int minimoDescripcionCierre = 10;
  static const int minimoDescripcionCaso = 10;

  /// Masivas activas (DETECTADA o PLANIFICADA).
  static Future<List<Map<String, dynamic>>> listarActivas() async {
    final datos = await ApiClient.get(
      '/fallas-masivas',
      query: {'solo_activas': true},
    );
    return _listaDe(datos);
  }

  /// Ficha completa de una masiva.
  static Future<Map<String, dynamic>?> detalle(int idFalla) async {
    final datos = await ApiClient.get('/fallas-masivas/$idFalla');
    return datos is Map ? Map<String, dynamic>.from(datos) : null;
  }

  /// CASOS ASOCIADOS de la masiva (con sus datos técnicos y la RUTA).
  static Future<List<Map<String, dynamic>>> casos(int idFalla) async {
    final datos = await ApiClient.get('/fallas-masivas/$idFalla/casos');
    return _listaDe(datos);
  }

  /// Órdenes de material de la masiva.
  static Future<List<Map<String, dynamic>>> ordenes(int idFalla) async {
    final datos = await ApiClient.get('/fallas-masivas/$idFalla/ordenes');
    return _listaDe(datos);
  }

  /// Personal del CRASS activo (desplegable del validador del cierre).
  static Future<List<Map<String, dynamic>>> personalCrass() async {
    final datos = await ApiClient.get(
      '/solicitantes',
      query: {'tipo': 'CRASS', 'solo_activos': true},
    );
    return _listaDe(datos);
  }

  /// Documenta la planificación de la atención (RF-17) y devuelve la ficha.
  static Future<Map<String, dynamic>?> planificar({
    required int idFalla,
    required String planificacion,
    String? reporteSimple,
    List<String> evidencias = const [],
  }) async {
    final datos = await ApiClient.post(
      '/fallas-masivas/$idFalla/planificacion',
      data: {
        'planificacion': planificacion.trim(),
        if (reporteSimple != null && reporteSimple.trim().isNotEmpty)
          'reporte_simple': reporteSimple.trim(),
        if (evidencias.isNotEmpty) 'evidencias': evidencias,
      },
    );
    return datos is Map ? Map<String, dynamic>.from(datos) : null;
  }

  /// Solicita material para la masiva (RF-18).
  static Future<Map<String, dynamic>?> solicitarMaterial({
    required int idFalla,
    required String descripcion,
  }) async {
    final datos = await ApiClient.post(
      '/fallas-masivas/$idFalla/material',
      data: {'descripcion': descripcion.trim()},
    );
    return datos is Map ? Map<String, dynamic>.from(datos) : null;
  }

  /// Cierra la masiva y **todos sus casos asociados** (RF-61/RF-62).
  static Future<ResultadoCierreMasiva> cerrar({
    required int idFalla,
    required String descripcion,
    required int idValidadorCrass,
    String modo = 'IVR',
    String descripcionCaso = descripcionCasoPorDefecto,
    List<String> evidencias = const [],
    double? latitud,
    double? longitud,
  }) async {
    final datos = await ApiClient.post(
      '/fallas-masivas/$idFalla/cierre',
      data: {
        'descripcion': descripcion.trim(),
        'id_validador_crass': idValidadorCrass,
        'modo': modo,
        'descripcion_caso': descripcionCaso.trim(),
        if (evidencias.isNotEmpty) 'evidencias': evidencias,
        if (latitud != null) 'latitud': latitud,
        if (longitud != null) 'longitud': longitud,
      },
    );
    return ResultadoCierreMasiva.fromJson(
      datos is Map ? Map<String, dynamic>.from(datos) : const {},
    );
  }

  // ------------------------------------------------------------------------- #
  // Validaciones puras (probables sin dispositivo ni red)
  // ------------------------------------------------------------------------- #

  /// Error de la planificación (obligatoria, mínimo 5).
  static String? errorPlanificacion(String valor) =>
      valor.trim().length < minimoPlanificacion
          ? 'Describa la planificación (mínimo $minimoPlanificacion caracteres).'
          : null;

  /// Error de la solicitud de material (obligatoria, mínimo 3).
  static String? errorMaterial(String valor) =>
      valor.trim().length < minimoMaterial
          ? 'Describa el material requerido (mínimo $minimoMaterial caracteres).'
          : null;

  /// Error de la descripción del trabajo de cierre (obligatoria, mínimo 10).
  static String? errorDescripcionCierre(String valor) =>
      valor.trim().length < minimoDescripcionCierre
          ? 'Describa el trabajo realizado (mínimo $minimoDescripcionCierre caracteres).'
          : null;

  /// Error del texto que quedará en cada caso (por defecto «Reparado en FDT»).
  static String? errorDescripcionCaso(String valor) =>
      valor.trim().length < minimoDescripcionCaso
          ? 'El texto de cada caso debe tener al menos $minimoDescripcionCaso caracteres.'
          : null;

  /// Error del validador del CRASS (obligatorio).
  static String? errorValidador(int? idValidador) => idValidador == null
      ? 'Seleccione el personal del CRASS que valida la reparación.'
      : null;

  static List<Map<String, dynamic>> _listaDe(dynamic datos) {
    if (datos is! List) return [];
    return datos
        .whereType<Map<String, dynamic>>()
        .map((elemento) => Map<String, dynamic>.from(elemento))
        .toList();
  }
}
