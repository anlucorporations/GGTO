import '../../core/api_client.dart';
import '../../core/database.dart';
import 'sync_sesion.dart';

/// Resultado de una operación DESCARGA (D-73).
class ResultadoDescarga {
  const ResultadoDescarga({
    required this.nuevos,
    required this.actualizados,
    required this.serverTs,
  });

  final int nuevos;
  final int actualizados;
  final DateTime? serverTs;

  String get resumen {
    if (nuevos == 0 && actualizados == 0) return 'No hay casos nuevos ni cambios.';
    final partes = <String>[];
    if (nuevos > 0) partes.add('$nuevos nuevos');
    if (actualizados > 0) partes.add('$actualizados actualizados');
    return partes.join(' · ');
  }
}

/// Servicio de descarga diferencial por cuadrilla del técnico logueado.
class DownloadService {
  const DownloadService._();

  /// Llama `GET /sync/descarga` y aplica el resultado a la caché local.
  ///
  /// D-81: abre una sesión de sincronización, ejecuta el checklist y la cierra
  /// con el resultado (RF-39/RF-40).
  ///
  /// D-82: informa el avance por `onProgreso` para la barra de sincronización.
  static Future<ResultadoDescarga> descargar({
    void Function(String fase, double valor)? onProgreso,
  }) async {
    void avisar(double valor, String fase) => onProgreso?.call(fase, valor);

    avisar(0.05, 'Conectando con el servidor…');
    final sesion = await SyncSesionService.abrir('DESCARGA');
    try {
      final idsConocidos = await DatabaseHelper.instance.idsCasosConocidos();
      final ultima = await DatabaseHelper.instance.ultimaDescarga();

      final query = <String, dynamic>{
        if (idsConocidos.isNotEmpty) 'ids_conocidos': idsConocidos,
        if (ultima != null) 'desde': ultima.toIso8601String(),
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
      return ResultadoDescarga(nuevos: nuevos, actualizados: actualizados, serverTs: serverTs);
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
}
