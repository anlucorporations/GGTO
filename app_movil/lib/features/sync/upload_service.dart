import 'dart:io';

import 'package:dio/dio.dart';

import '../../core/api_client.dart';
import '../../core/database.dart';

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

  /// Sube todas las evidencias locales no subidas y después envía la cola de
  /// acciones mediante `POST /sync/carga`. Las acciones que el batch no cubre
  /// (fallas masivas, citas) quedan para `SyncProvider.sincronizar()`.
  static Future<ResultadoCarga> cargar() async {
    var fotosSubidas = 0;
    final errores = <String>[];

    // 1. Subir fotos pendientes (máx. 5 por caso, ≤ 3 MB — decisión del usuario).
    final db = await DatabaseHelper.instance.database;
    final pendientes = await db.query(
      'evidencia_local',
      where: 'subida = 0',
      orderBy: 'id ASC',
    );

    for (final evidencia in pendientes) {
      final ruta = '${evidencia['ruta_archivo']}';
      final serialReal = '${evidencia['serial_imagen'] ?? ''}';
      final file = File(ruta);
      if (!await file.exists()) {
        errores.add('Archivo no encontrado: $ruta');
        continue;
      }
      final bytes = await file.readAsBytes();
      if (bytes.lengthInBytes > 3 * 1024 * 1024) {
        errores.add('Foto supera 3 MB: ${evidencia['serial_imagen']}');
        continue;
      }

      try {
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
        await ApiClient.post('/evidencias/upload', data: form);
        await DatabaseHelper.instance.marcarEvidenciaSubida(evidencia['id'] as int);
        fotosSubidas++;
      } catch (e) {
        errores.add('Error al subir ${evidencia['serial_imagen']}: $e');
      }
    }

    // 2. Vaciar vía `/sync/carga` las acciones de estado/cierre/enrutado.
    final acciones = await DatabaseHelper.instance.accionesPendientes(limite: 200);
    var actividadesEnviadas = 0;
    final actividades = <Map<String, dynamic>>[];
    final estados = <Map<String, dynamic>>[];
    final idsBatch = <int>[];

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
    }

    if (actividades.isNotEmpty || estados.isNotEmpty) {
      try {
        final respuesta = await ApiClient.post('/sync/carga', data: {
          'dispositivo_id': 'apk-local',
          'version_app': '1.0.0',
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
