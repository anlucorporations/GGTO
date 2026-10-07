import '../../core/api_client.dart';
import '../../core/database.dart';
import 'sync_sesion.dart';

/// Resultado de una operación DESCARGA (D-73).
///
/// D-83: además de los conteos, el servidor devuelve **por qué** no hay casos
/// (`motivo`/`mensaje`) y la **cuadrilla** que resolvió. Antes, «sin cuadrilla»,
/// «cuadrilla de gestión», «sin despacho» y «ya tiene todo» se veían igual
/// («No hay casos nuevos ni cambios»).
class ResultadoDescarga {
  const ResultadoDescarga({
    required this.nuevos,
    required this.actualizados,
    required this.serverTs,
    this.motivo = '',
    this.mensaje = '',
    this.cuadrillaCodigo,
    this.casosCuadrilla = 0,
  });

  final int nuevos;
  final int actualizados;
  final DateTime? serverTs;

  /// Código estable del motivo (`OK`, `SIN_CUADRILLA`, `CUADRILLA_GESTION`…).
  final String motivo;

  /// Explicación lista para mostrar al técnico.
  final String mensaje;

  /// Código de la cuadrilla resuelta por el servidor (p. ej. `C-001`).
  final String? cuadrillaCodigo;

  /// Casos operables que el servidor tiene despachados para esa cuadrilla.
  final int casosCuadrilla;

  /// ¿La descarga no trajo nada **porque no hay nada** (y no por un fallo)?
  bool get sinNovedades => nuevos == 0 && actualizados == 0;

  String get resumen {
    if (sinNovedades) {
      return mensaje.isNotEmpty ? mensaje : 'No hay casos nuevos ni cambios.';
    }
    final partes = <String>[];
    if (nuevos > 0) partes.add('$nuevos nuevos');
    if (actualizados > 0) partes.add('$actualizados actualizados');
    final conteo = partes.join(' · ');
    if (cuadrillaCodigo == null || cuadrillaCodigo!.isEmpty) return conteo;
    return '$conteo · cuadrilla $cuadrillaCodigo';
  }
}

/// Servicio de descarga diferencial por cuadrilla del técnico logueado.
class DownloadService {
  const DownloadService._();

  /// Clave de la marca de agua del servidor (`server_ts` de la última descarga).
  static const claveMarcaDescarga = 'ultima_descarga_ts';

  /// Llama `GET /sync/descarga` y aplica el resultado a la caché local.
  ///
  /// D-81: abre una sesión de sincronización, ejecuta el checklist y la cierra
  /// con el resultado (RF-39/RF-40).
  ///
  /// D-82: informa el avance por `onProgreso` para la barra de sincronización.
  ///
  /// D-83: el diferencial se mide con la **marca del servidor** (`server_ts`), no
  /// con el reloj del teléfono: un reloj adelantado dejaba al técnico sin casos
  /// para siempre porque todo parecía «ya modificado».
  static Future<ResultadoDescarga> descargar({
    void Function(String fase, double valor)? onProgreso,
  }) async {
    void avisar(double valor, String fase) => onProgreso?.call(fase, valor);

    avisar(0.05, 'Conectando con el servidor…');
    final sesion = await SyncSesionService.abrir('DESCARGA');
    try {
      final idsConocidos = await DatabaseHelper.instance.idsCasosConocidos();
      final ultima = await _marcaDescarga();

      final query = <String, dynamic>{
        if (idsConocidos.isNotEmpty) 'ids_conocidos': idsConocidos,
        if (ultima != null) 'desde': ultima.toUtc().toIso8601String(),
      };

      avisar(0.35, 'Descargando los casos de mi cuadrilla…');
      final datos = await ApiClient.get('/sync/descarga', query: query);
      if (datos is! Map) {
        avisar(1, 'Descarga completada');
        return const ResultadoDescarga(nuevos: 0, actualizados: 0, serverTs: null);
      }

      final lista = datos['casos'];
      var nuevos = 0;
      var actualizados = 0;
      if (lista is List && lista.isNotEmpty) {
        avisar(0.7, 'Guardando el contenido en el dispositivo…');
        final r = await DatabaseHelper.instance.mergearCasos(lista);
        nuevos = r.$1;
        actualizados = r.$2;
      }

      DateTime? serverTs;
      final ts = datos['server_ts'];
      if (ts is String) {
        serverTs = DateTime.tryParse(ts);
      }
      // La marca del servidor es la referencia del próximo diferencial.
      if (serverTs != null) {
        await DatabaseHelper.instance
            .guardarMeta(claveMarcaDescarga, serverTs.toUtc().toIso8601String());
      }

      final cuadrilla = datos['cuadrilla'];
      final codigo = cuadrilla is Map ? '${cuadrilla['codigo'] ?? ''}' : '';
      final casosCuadrilla = datos['casos_cuadrilla'] is int
          ? datos['casos_cuadrilla'] as int
          : 0;

      if (sesion.idSesion != null) {
        await SyncSesionService.cerrar(
          sesion,
          tipo: 'DESCARGA',
          recibidos: nuevos + actualizados,
          procesados: nuevos + actualizados,
          estado: 'OK',
          pasoEstado: 'OK',
        );
      }
      avisar(1, 'Descarga completada');
      return ResultadoDescarga(
        nuevos: nuevos,
        actualizados: actualizados,
        serverTs: serverTs,
        motivo: '${datos['motivo'] ?? ''}',
        mensaje: '${datos['mensaje'] ?? ''}',
        cuadrillaCodigo: codigo.isEmpty ? null : codigo,
        casosCuadrilla: casosCuadrilla,
      );
    } catch (e) {
      if (sesion.idSesion != null) {
        await SyncSesionService.cerrar(
          sesion,
          tipo: 'DESCARGA',
          errores: 1,
          estado: 'ERROR',
          pasoEstado: 'ERROR',
          detalleError: '$e',
        );
      }
      rethrow;
    }
  }

  /// Marca de agua del diferencial: la del servidor si ya existe (D-83) y, si no,
  /// la del reloj del dispositivo que usaban las versiones anteriores.
  static Future<DateTime?> _marcaDescarga() async {
    final guardada = await DatabaseHelper.instance.leerMeta(claveMarcaDescarga);
    final delServidor = guardada == null ? null : DateTime.tryParse(guardada);
    if (delServidor != null) return delServidor;
    return DatabaseHelper.instance.ultimaDescarga();
  }
}
