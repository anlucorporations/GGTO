/// Detalle que la APK envía al cerrar cada sesión de sincronización (D-136 · H-19).
///
/// `sync_log.detalle` existía y el servidor lo guardaba, pero la APK **nunca lo
/// enviaba**: quien administraba solo veía contadores y no podía saber **qué**
/// descargó ni qué falló por caso. Estas funciones puras arman ese resumen para
/// poder probarlo sin red ni base de datos.
library;

/// Detalle de una DESCARGA: qué llegó, qué se insertó/actualizó y qué se descartó.
Map<String, dynamic> detalleDescarga({
  required Set<int> idsRecibidos,
  required int nuevos,
  required int actualizados,
  required int descartados,
  Set<int> idsDelDia = const {},
  Set<int> idsVigentes = const {},
  String motivo = 'OK',
  String? cuadrilla,
}) {
  final recibidos = idsRecibidos.toList()..sort();
  final delDia = idsDelDia.toList()..sort();
  final vigentes = idsVigentes.toList()..sort();
  return {
    'descarga': {
      'ids_recibidos': recibidos,
      'nuevos': nuevos,
      'actualizados': actualizados,
      'descartados': descartados,
      'ids_del_dia': delDia,
      'ids_vigentes': vigentes,
      'motivo': motivo,
      if (cuadrilla != null && cuadrilla.isNotEmpty) 'cuadrilla': cuadrilla,
    },
  };
}

/// Detalle de una CARGA: cuántas acciones fueron y cuáles fallaron (con su caso).
Map<String, dynamic> detalleCarga({
  required int actividades,
  required int estados,
  required int aceptadas,
  required int rechazadas,
  List<String> errores = const [],
  int maxErrores = 20,
}) {
  final recortados = errores.length > maxErrores
      ? errores.sublist(errores.length - maxErrores)
      : errores;
  return {
    'carga': {
      'actividades': actividades,
      'estados': estados,
      'aceptadas': aceptadas,
      'rechazadas': rechazadas,
      'errores': recortados,
    },
  };
}
