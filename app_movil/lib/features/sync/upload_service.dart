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
  /// acciones mediante `POST /sync/carga`.
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
          'file': MultipartFile.fromBytes(bytes, filename: '${evidencia['serial_imagen']}.jpg'),
          'id_caso': evidencia['id_caso'],
          'tipo': evidencia['tipo'],
          'serial_local': evidencia['serial_imagen'],
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

    // 2. Vaciar la cola de acciones pendientes vía el batch `/sync/carga`.
    final acciones = await DatabaseHelper.instance.accionesPendientes(limite: 200);
    var actividadesEnviadas = 0;
    if (acciones.isNotEmpty) {
      final actividades = <Map<String, dynamic>>[];
      final estados = <Map<String, dynamic>>[];

      for (final accion in acciones) {
        final payload = _payload(accion['payload']);
        final tipo = '${accion['tipo']}';
        if (tipo == 'CIERRE' || tipo == 'CONTACTADO' || tipo == 'CITADO' || tipo == 'DIFERIDO' || tipo == 'ENRUTADO') {
          final idCaso = _extraerIdCaso(payload, '${accion['endpoint']}');
          if (idCaso != null) {
            actividades.add({
              'id_actividad_local': accion['id'],
              'id_caso': idCaso,
              'tipo': _tipoActividad(tipo),
              'resultado': tipo == 'CIERRE' ? 'EXITOSO' : null,
              'reporte_corto': payload['descripcion'] ?? payload['motivo_estado'],
              'id_metodo': payload['id_metodo'],
              'id_causa': payload['id_causa'],
              'fecha_hora': DateTime.now().toIso8601String(),
              'evidencias': payload['evidencias'] ?? [],
            });
          }
        } else if (tipo == 'ESTADO') {
          final idCaso = _extraerIdCaso(payload, '${accion['endpoint']}');
          if (idCaso != null) {
            estados.add({
              'id_caso': idCaso,
              'estado_nuevo': payload['estado_actual'],
              'motivo': payload['motivo_estado'],
            });
          }
        }
      }

      try {
        final respuesta = await ApiClient.post('/sync/carga', data: {
          'dispositivo_id': 'apk-local',
          'version_app': '1.0.0',
          'actividades': actividades,
          'estados': estados,
        });
        if (respuesta is Map && respuesta['aceptadas'] is int) {
          actividadesEnviadas = respuesta['aceptadas'] as int;
          for (final accion in acciones) {
            await DatabaseHelper.instance.marcarAccionEnviada(accion['id'] as int);
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

  static int? _extraerIdCaso(Map<String, dynamic> payload, String endpoint) {
    final directo = payload['id_caso'];
    if (directo is int) return directo;
    final match = RegExp(r'/casos/(\d+)').firstMatch(endpoint);
    if (match != null) return int.tryParse(match.group(1)!);
    return null;
  }

  static String _tipoActividad(String tipoLocal) {
    switch (tipoLocal) {
      case 'CIERRE':
        return 'CIERRE';
      case 'CONTACTADO':
        return 'CONTACTO';
      case 'CITADO':
        return 'CITA';
      case 'DIFERIDO':
        return 'DIFERIDO';
      case 'ENRUTADO':
        return 'ENRUTADO';
      default:
        return 'CONTACTO';
    }
  }
}
