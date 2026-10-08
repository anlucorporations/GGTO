import 'dart:io';

import 'package:dio/dio.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/database.dart';
import 'sync_sesion.dart';

/// Resultado de una operación CARGA (D-73).
class ResultadoCarga {
  const ResultadoCarga({
    required this.fotosSubidas,
    required this.actividadesEnviadas,
    required this.errores,
  });

  final int fotosSubidas;
  final int actividadesEnviadas;
  final List<String> errores;

  bool get tuvoErrores => errores.isNotEmpty;

  String get resumen {
    final partes = <String>[
      '$fotosSubidas fotos',
      '$actividadesEnviadas actividades',
    ];
    if (errores.isNotEmpty) partes.add('${errores.length} errores');
    return partes.join(' · ');
  }
}

/// Servicio de carga directa: sube fotos pendientes y luego las actividades.
class UploadService {
  const UploadService._();

  /// Sube **una** evidencia local por su identificador.
  ///
  /// Devuelve el serial confirmado por el servidor. Se usa tanto en la CARGA
  /// como en el reporte de falla masiva (D-82), que necesita el serial antes de
  /// registrar la falla.
  static Future<String> subirEvidencia(Map<String, dynamic> evidencia) async {
    final ruta = '${evidencia['ruta_archivo']}';
    final serialReal = '${evidencia['serial_imagen'] ?? ''}';
    final file = File(ruta);
    if (!await file.exists()) {
      throw StateError('Archivo no encontrado: $ruta');
    }
    final bytes = await file.readAsBytes();
    if (bytes.lengthInBytes > AppConstants.maxFotoBytes) {
      throw StateError('La foto supera 3 MB: $serialReal');
    }

    final form = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: '${serialReal.isEmpty ? 'evidencia-${evidencia['id']}' : serialReal}.jpg',
      ),
      'id_caso': _intentoInt(evidencia['id_caso']) ?? 0,
      'tipo': evidencia['tipo'],
      'serial_local': serialReal.isEmpty ? null : serialReal,
      'latitud': evidencia['latitud'],
      'longitud': evidencia['longitud'],
      'fecha_hora': evidencia['timestamp'],
    });
    final respuesta = await ApiClient.post('/evidencias/upload', data: form);
    await DatabaseHelper.instance.marcarEvidenciaSubida(evidencia['id'] as int);
    if (respuesta is Map && respuesta['serial_imagen'] != null) {
      return '${respuesta['serial_imagen']}';
    }
    return serialReal;
  }

  /// Sube todas las evidencias locales no subidas.
  ///
  /// Devuelve `(subidas, errores, seriales)`; `seriales` son los confirmados por
  /// el servidor, en el mismo orden en que se subieron. Con `idCaso` se limita a
  /// las evidencias de un reporte concreto (lo usa la falla masiva, D-82).
  static Future<(int, List<String>, List<String>)> subirPendientes({
    void Function(String fase, double valor)? onProgreso,
    String? idCaso,
  }) async {
    final db = await DatabaseHelper.instance.database;
    final pendientes = await db.query(
      'evidencia_local',
      where: idCaso == null ? 'subida = 0' : 'subida = 0 AND id_caso = ?',
      whereArgs: idCaso == null ? null : [idCaso],
      orderBy: 'id ASC',
    );

    var subidas = 0;
    final errores = <String>[];
    final seriales = <String>[];
    var indice = 0;
    for (final evidencia in pendientes) {
      indice++;
      onProgreso?.call(
        'Subiendo fotos… ($indice de ${pendientes.length})',
        pendientes.isEmpty ? 1 : indice / pendientes.length,
      );
      try {
        seriales.add(await subirEvidencia(evidencia));
        subidas++;
      } catch (e) {
        errores.add('Error al subir ${evidencia['serial_imagen']}: $e');
      }
    }
    return (subidas, errores, seriales);
  }

  /// Sube todas las evidencias locales no subidas y después envía la cola de
  /// acciones mediante `POST /sync/carga`. Las acciones que el batch no cubre
  /// (fallas masivas, citas) quedan para `SyncProvider.sincronizar()`.
  static Future<ResultadoCarga> cargar({
    void Function(String fase, double valor)? onProgreso,
  }) async {
    void avisar(double valor, String fase) => onProgreso?.call(fase, valor);

    avisar(0.05, 'Abriendo la jornada de sincronización…');
    final sesion = await SyncSesionService.abrir('CARGA');
    var fotosSubidas = 0;
    final errores = <String>[];

    // 1. Subir fotos pendientes (máx. 5 por caso, ≤ 3 MB — decisión del usuario).
    avisar(0.1, 'Buscando las fotos pendientes…');
    final db = await DatabaseHelper.instance.database;
    final pendientes = await db.query(
      'evidencia_local',
      where: 'subida = 0',
      orderBy: 'id ASC',
    );

    var indice = 0;
    for (final evidencia in pendientes) {
      indice++;
      // La barra dedica el 10 %-60 % a las fotos.
      avisar(
        pendientes.isEmpty ? 0.6 : 0.1 + 0.5 * (indice / pendientes.length),
        'Subiendo fotos… ($indice de ${pendientes.length})',
      );
      try {
        await subirEvidencia(evidencia);
        fotosSubidas++;
      } catch (e) {
        errores.add('Error al subir ${evidencia['serial_imagen']}: $e');
      }
    }

    // 2. Vaciar vía `/sync/carga` las acciones de estado/cierre/enrutado.
    avisar(0.65, 'Preparando las actividades del día…');
    final acciones = await DatabaseHelper.instance.accionesPendientes(limite: 200);
    var actividadesEnviadas = 0;
    final actividades = <Map<String, dynamic>>[];
    final estados = <Map<String, dynamic>>[];
    final idsBatch = <int>[];
    // D-85: casos cuyo cambio local hay que dejar de marcar como pendiente al
    // confirmarse el envío.
    final idsCasoBatch = <int>[];

    for (final accion in acciones) {
      final payload = _payload(accion['payload']);
      final tipo = '${accion['tipo']}';
      final endpoint = '${accion['endpoint']}';
      final idCaso = _extraerIdCaso(payload, endpoint);
      if (idCaso == null) continue;

      switch (tipo) {
        case 'CIERRE':
          actividades.add({
            'id_actividad_local': accion['id'],
            'id_caso': idCaso,
            'tipo': 'CIERRE',
            'resultado': 'EXITOSO',
            'reporte_corto': payload['descripcion'],
            // El cierre de campo guarda el modo (IVR/COS/SACAS) sin conexión; el
            // servidor lo traduce al catálogo para no perderlo.
            'modo': payload['modo'],
            'id_metodo': payload['id_metodo'],
            'id_causa': payload['id_causa'],
            'fecha_hora': DateTime.now().toIso8601String(),
            'evidencias': payload['evidencias'] ?? [],
          });
        case 'CONTACTADO':
        case 'CITADO':
        case 'DIFERIDO':
        case 'ESTADO':
          // El payload de `_enviarEstado` trae `estado_actual`; si viene vacío
          // (cola antigua), se usa el tipo local como estado objetivo.
          final estadoObjetivo = (payload['estado_actual'] ?? tipo).toString();
          estados.add({
            'id_caso': idCaso,
            'estado_nuevo': estadoObjetivo,
            'motivo': payload['motivo_estado'],
          });
        case 'ENRUTADO':
          actividades.add({
            'id_actividad_local': accion['id'],
            'id_caso': idCaso,
            'tipo': 'ENRUTADO',
            'reporte_corto': payload['motivo'],
            'id_metodo': payload['id_metodo'],
            'fecha_hora': DateTime.now().toIso8601String(),
            'evidencias': payload['evidencias'] ?? [],
          });
        case 'DIFERIDO_EVIDENCIAS':
          // Evidencias asociadas a un diferido ya encolado (o aplicado): viajan
          // como actividad de contacto para no perder la foto. La acción se
          // borra al confirmar el servidor (no tiene endpoint propio).
          actividades.add({
            'id_actividad_local': accion['id'],
            'id_caso': idCaso,
            'tipo': 'CONTACTO',
            'reporte_corto': 'Evidencias del diferido',
            'fecha_hora': DateTime.now().toIso8601String(),
            'evidencias': payload['evidencias'] ?? [],
          });
          // (idsBatch se añade más abajo, fuera del switch)
          break;
        default:
          // FALLA_MASIVA / CITA / EVIDENCIA suelta: las procesa el outbox
          // clásico (`SyncProvider.sincronizar()`) contra su endpoint original.
          continue;
      }
      idsBatch.add(accion['id'] as int);
      idsCasoBatch.add(idCaso);
    }

    if (actividades.isNotEmpty || estados.isNotEmpty) {
      try {
        final respuesta = await ApiClient.post('/sync/carga', data: {
          'id_sync_log': sesion.idSesion,
          'dispositivo_id': await DatabaseHelper.instance.dispositivoId(),
          'version_app': AppConstants.version,
          'actividades': actividades,
          'estados': estados,
        });
        if (respuesta is Map && respuesta['aceptadas'] is int) {
          actividadesEnviadas = respuesta['aceptadas'] as int;
          final rechazadas = (respuesta['rechazadas'] as int?) ?? 0;
          final detalle = respuesta['errores'];
          if (detalle is List) {
            for (final e in detalle) {
              errores.add('Servidor: $e');
            }
          }
          if (rechazadas == 0) {
            for (final id in idsBatch) {
              await DatabaseHelper.instance.marcarAccionEnviada(id);
            }
            // D-85: el servidor confirmó el lote → los casos dejan de estar
            // «pendiente de sincronizar» en el dispositivo.
            for (final idCaso in idsCasoBatch) {
              await DatabaseHelper.instance.limpiarPendienteSync(idCaso);
            }
          } else {
            for (final id in idsBatch) {
              await DatabaseHelper.instance.marcarAccionReintento(
                id,
                1,
                DateTime.now().add(const Duration(minutes: 1)).millisecondsSinceEpoch,
                'Rechazo parcial en /sync/carga',
              );
            }
          }
        }
      } catch (e) {
        errores.add('Error en /sync/carga: $e');
      }
    }

    final procesados = fotosSubidas + actividadesEnviadas;
    final nErrores = errores.length;
    final estado = nErrores == 0 ? 'OK' : (procesados > 0 ? 'PARCIAL' : 'ERROR');
    avisar(0.9, 'Cerrando la jornada de sincronización…');
    if (sesion.idSesion != null) {
      await SyncSesionService.cerrar(
        sesion,
        tipo: 'CARGA',
        recibidos: procesados + nErrores,
        procesados: procesados,
        errores: nErrores,
        estado: estado,
        pasoEstado: nErrores == 0 ? 'OK' : (procesados > 0 ? 'OK' : 'ERROR'),
        detalleError: nErrores > 0 ? errores.first : null,
      );
    }
    avisar(1, nErrores == 0 ? 'Carga completada' : 'Carga completada con avisos');

    return ResultadoCarga(
      fotosSubidas: fotosSubidas,
      actividadesEnviadas: actividadesEnviadas,
      errores: errores,
    );
  }

  static Map<String, dynamic> _payload(dynamic crudo) {
    if (crudo is Map) return Map<String, dynamic>.from(crudo);
    return {};
  }

  static int? _intentoInt(dynamic valor) {
    if (valor is int) return valor;
    if (valor is String) return int.tryParse(valor);
    return null;
  }

  static int? _extraerIdCaso(Map<String, dynamic> payload, String endpoint) {
    final directo = _intentoInt(payload['id_caso']);
    if (directo != null) return directo;
    final match = RegExp(r'/casos/(\d+)').firstMatch(endpoint);
    if (match != null) return int.tryParse(match.group(1)!);
    return null;
  }
}
