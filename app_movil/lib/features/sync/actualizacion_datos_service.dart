import '../../core/api_error.dart';
import 'download_service.dart';
import 'sync_provider.dart';
import 'upload_service.dart';

/// Resultado de la **actualización completa** del dispositivo (D-115).
///
/// Reúne las tres fases que antes eran botones separados:
///   1. **CARGA** de evidencias y actividades del técnico,
///   2. envío del resto de la cola clásica (masivas, citas, evidencias sueltas),
///   3. **DESCARGA** del despacho del día y **purga** de los casos no atendidos.
class ResultadoActualizacionDatos {
  const ResultadoActualizacionDatos({
    this.carga,
    this.cola,
    this.descarga,
    this.errorCarga,
    this.errorDescarga,
  });

  final ResultadoCarga? carga;
  final ResultadoSync? cola;
  final ResultadoDescarga? descarga;
  final String? errorCarga;
  final String? errorDescarga;

  bool get huboErrores =>
      (carga?.tuvoErrores ?? false) ||
      (cola?.huboErrores ?? false) ||
      errorCarga != null ||
      errorDescarga != null;

  /// `true` si no se pudo descargar (p. ej. sin conexión): el contenido local
  /// sigue disponible, pero no se pudo confirmar el despacho del día.
  bool get sinDescarga => descarga == null;

  String get resumen {
    final partes = <String>[];
    if (errorCarga != null) {
      partes.add('sin carga: $errorCarga');
    } else if (carga != null) {
      if (carga!.fotosSubidas > 0) {
        partes.add('${carga!.fotosSubidas} evidencia(s)');
      }
      if (carga!.actividadesEnviadas > 0) {
        partes.add('${carga!.actividadesEnviadas} actividad(es)');
      }
      if (carga!.tuvoErrores) {
        partes.add('${carga!.errores.length} aviso(s) de carga');
      }
    }
    if (descarga != null) {
      partes.add(descarga!.resumen);
    } else if (errorDescarga != null) {
      partes.add('sin descarga: $errorDescarga');
    }
    if (partes.isEmpty) return 'Actualización completada.';
    return partes.join(' · ');
  }
}

/// Orquestador de la **actualización en un solo paso** de la APK (D-115).
///
/// El técnico pulsa un único botón y la app:
///   1. sube sus **evidencias** (fotos) y las actividades pendientes,
///   2. vacía la cola clásica (fallas masivas, citas, evidencias sueltas),
///   3. descarga el **despacho del día** y, con la confirmación del servidor,
///      **borra los casos no atendidos** que arrastraba de jornadas anteriores.
///
/// La descarga se ejecuta **aunque la carga falle**: el trabajo sin enviar queda
/// protegido en la cola y el técnico no se queda sin el despacho por un error de
/// una foto. Si la descarga falla, el contenido local se conserva.
class ActualizacionDatosService {
  const ActualizacionDatosService._();

  /// Ejecuta las tres fases y devuelve un resultado único.
  ///
  /// Los parámetros `cargar`, `sincronizar` y `descargar` son inyectables para
  /// poder probar el orden y el manejo de errores sin red ni SQLite.
  static Future<ResultadoActualizacionDatos> ejecutar({
    required SyncProvider sync,
    void Function(String fase, double valor)? onProgreso,
    Future<ResultadoCarga> Function(void Function(String, double)?)? cargar,
    Future<ResultadoSync> Function(SyncProvider)? sincronizar,
    Future<ResultadoDescarga> Function(void Function(String, double)?)? descargar,
  }) async {
    void avisar(double valor, String fase) => onProgreso?.call(fase, valor);

    ResultadoCarga? resultadoCarga;
    ResultadoSync? resultadoCola;
    ResultadoDescarga? resultadoDescarga;
    String? errorCarga;
    String? errorDescarga;

    // 1) Evidencias y actividades del técnico.
    try {
      avisar(0.02, 'Subiendo las evidencias del técnico…');
      resultadoCarga = await (cargar ?? _cargarPorDefecto)(
        (fase, valor) => avisar(0.02 + 0.38 * valor, fase),
      );
    } catch (e) {
      errorCarga = ApiError.desconocido(e).mensaje;
    }

    // 2) Resto de la cola clásica (masivas, citas, evidencias sueltas).
    try {
      await sync.refrescar();
      if (sync.pendientesSinError > 0 && sync.enLinea) {
        avisar(0.42, 'Enviando el resto de la cola…');
        resultadoCola = await (sincronizar ?? _sincronizarPorDefecto)(sync);
      }
    } catch (_) {
      // La cola no bloquea la descarga: sus acciones quedan para el próximo intento.
    }

    // 3) Despacho del día y purga de los casos no atendidos.
    try {
      avisar(0.55, 'Descargando el despacho del día…');
      resultadoDescarga = await (descargar ?? _descargarPorDefecto)(
        (fase, valor) => avisar(0.55 + 0.45 * valor, fase),
      );
    } catch (e) {
      errorDescarga = ApiError.desconocido(e).mensaje;
    }

    avisar(1, 'Actualización completada');
    return ResultadoActualizacionDatos(
      carga: resultadoCarga,
      cola: resultadoCola,
      descarga: resultadoDescarga,
      errorCarga: errorCarga,
      errorDescarga: errorDescarga,
    );
  }

  static Future<ResultadoCarga> _cargarPorDefecto(
    void Function(String, double)? onProgreso,
  ) =>
      UploadService.cargar(onProgreso: onProgreso);

  static Future<ResultadoSync> _sincronizarPorDefecto(SyncProvider sync) =>
      sync.sincronizar(
        silencioso: true,
        progresoDesde: 0.42,
        progresoHasta: 0.55,
      );

  static Future<ResultadoDescarga> _descargarPorDefecto(
    void Function(String, double)? onProgreso,
  ) =>
      DownloadService.descargar(onProgreso: onProgreso);
}
