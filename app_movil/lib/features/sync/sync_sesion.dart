import 'dart:convert';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/database.dart';

/// Sesión de sincronización abierta en el servidor y su checklist (D-81).
class SesionSync {
  SesionSync(this.idSesion, this.checklist);

  /// `id_sync_log` del servidor, o `null` si no hubo conexión (C-03).
  final int? idSesion;
  final List<Map<String, dynamic>> checklist;
}

/// Ejecuta el **checklist** de la sincronización (RF-40) y abre/cierra la sesión
/// de trazabilidad (RF-39). Automático en cada DESCARGA/CARGA.
class SyncSesionService {
  const SyncSesionService._();

  static Map<String, dynamic> _paso(String paso, String estado, [String? detalle]) => {
        'paso': paso,
        'estado': estado,
        'fecha_hora': DateTime.now().toUtc().toIso8601String(),
        'detalle': detalle == null ? null : {'mensaje': detalle},
      };

  /// Comprueba conexión (GCP) y login, y abre la sesión en el servidor.
  static Future<SesionSync> abrir(String tipo) async {
    final checklist = <Map<String, dynamic>>[];

    // (a) Conexión con el servidor GCP (endpoint público, sin BD).
    try {
      await ApiClient.get('/info');
      checklist.add(_paso('CONEXION', 'OK'));
    } catch (e) {
      checklist.add(_paso('CONEXION', 'ERROR', '$e'));
      checklist.add(_paso('LOGIN', 'OMITIDO'));
      checklist.add(_paso('DESCARGA', 'OMITIDO'));
      checklist.add(_paso('CARGA', 'OMITIDO'));
      await _persistir(checklist);
      return SesionSync(null, checklist);
    }

    // (b) Login válido.
    try {
      await ApiClient.get('/auth/me');
      checklist.add(_paso('LOGIN', 'OK'));
    } catch (e) {
      checklist.add(_paso('LOGIN', 'ERROR', '$e'));
    }

    // Abre la sesión de trazabilidad en el servidor.
    int? id;
    try {
      final resp = await ApiClient.post('/sync/sesion', data: {
        'tipo': tipo,
        'dispositivo_id': await DatabaseHelper.instance.dispositivoId(),
        'version_app': AppConstants.version,
      });
      if (resp is Map && resp['id_sync_log'] is int) {
        id = resp['id_sync_log'] as int;
      }
    } catch (_) {
      // Sin sesión en el servidor: el checklist se conserva localmente (C-03).
    }
    await _persistir(checklist);
    return SesionSync(id, checklist);
  }

  /// Cierra la sesión con el resultado del paso propio (DESCARGA o CARGA).
  static Future<void> cerrar(
    SesionSync sesion, {
    required String tipo,
    int recibidos = 0,
    int procesados = 0,
    int errores = 0,
    required String estado,
    required String pasoEstado,
    String? detalleError,
  }) async {
    final propioEsDescarga = tipo == 'DESCARGA';
    sesion.checklist.add(
      _paso(propioEsDescarga ? 'DESCARGA' : 'CARGA', pasoEstado, detalleError),
    );
    sesion.checklist.add(_paso(propioEsDescarga ? 'CARGA' : 'DESCARGA', 'OMITIDO'));

    if (sesion.idSesion != null) {
      try {
        await ApiClient.patch('/sync/sesion/${sesion.idSesion}', data: {
          'recibidos': recibidos,
          'procesados': procesados,
          'errores': errores,
          'estado': estado,
          'checklist': sesion.checklist,
        });
      } catch (_) {
        // El checklist ya quedó persistido en local.
      }
    }
    await _persistir(sesion.checklist);
  }

  static Future<void> _persistir(List<Map<String, dynamic>> checklist) async {
    try {
      await DatabaseHelper.instance.guardarChecklist(jsonEncode(checklist));
    } catch (_) {
      // Best-effort.
    }
  }
}
