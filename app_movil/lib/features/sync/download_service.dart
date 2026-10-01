import '../../core/api_client.dart';
import '../../core/database.dart';

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
  static Future<ResultadoDescarga> descargar() async {
    final idsConocidos = await DatabaseHelper.instance.idsCasosConocidos();
    final ultima = await DatabaseHelper.instance.ultimaDescarga();

    final query = <String, dynamic>{
      if (idsConocidos.isNotEmpty) 'ids_conocidos': idsConocidos,
      if (ultima != null) 'desde': ultima.toIso8601String(),
    };

    final datos = await ApiClient.get('/sync/descarga', query: query);
    if (datos is! Map) {
      return const ResultadoDescarga(nuevos: 0, actualizados: 0, serverTs: null);
    }

    final lista = datos['casos'];
    var nuevos = 0;
    var actualizados = 0;
    if (lista is List && lista.isNotEmpty) {
      final r = await DatabaseHelper.instance.mergearCasos(lista);
      nuevos = r.$1;
      actualizados = r.$2;
    }

    DateTime? serverTs;
    final ts = datos['server_ts'];
    if (ts is String) {
      serverTs = DateTime.tryParse(ts);
    }

    return ResultadoDescarga(nuevos: nuevos, actualizados: actualizados, serverTs: serverTs);
  }
}
