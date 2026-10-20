import 'dart:io';

import 'package:dio/dio.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/database.dart';
import '../../core/sync_lock.dart';
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

/// Desenlace de **una** acción de la cola según el servidor (D-121).
class ResultadoItemCarga {
  const ResultadoItemCarga({
    required this.idLocal,
    required this.aceptada,
    this.idCaso,
    this.mensaje = '',
  });

  /// `accion_pendiente.id` en el dispositivo.
  final int idLocal;
  final int? idCaso;
  final bool aceptada;
  final String mensaje;
}

/// Servicio de carga directa: sube fotos pendientes y luego las actividades.
class UploadService {
  const UploadService._();

  /// Resumen del servidor: desenlace por acción (D-121).
  ///
  /// Es **puro** (sin red ni base de datos) para poder probarlo aislado: la CARGA
  /// marca cada acción con su propio resultado en lugar de todo el lote, de modo
  /// que una rechazada (p. ej. un caso reasignado) no arrastra al resto.
  static List<ResultadoItemCarga> planificarResultado(dynamic items) {
    final salida = <ResultadoItemCarga>[];
    if (items is! List) return salida;
    for (final crudo in items) {
      if (crudo is! Map) continue;
      final local = crudo['id_actividad_local'];
      if (local is! int) continue;
      final idCaso = crudo['id_caso'];
      salida.add(
        ResultadoItemCarga(
          idLocal: local,
          idCaso: idCaso is int ? idCaso : null,
          aceptada: crudo['aceptada'] == true,
          mensaje: '${crudo['mensaje'] ?? ''}'.trim(),
        ),
      );
    }
    return salida;
  }

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
  ///
  /// D-124 · H-07: la CARGA es la **dueña** de los cierres, enrutados y evidencias
  /// de un diferido, y toma el cerrojo de sincronización para que el envío
  /// automático no pueda mandar la misma acción a la vez.
  static Future<ResultadoCarga> cargar({
    void Function(String fase, double valor)? onProgreso,
  }) =>
      SyncLock.instance.ejecutar(() => _cargarInterno(onProgreso: onProgreso));

  static Future<ResultadoCarga> _cargarInterno({
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
      // D-121: intentos previos de cada acción (el contador crece de verdad; antes
      // se fijaba en 1 y nunca se alcanzaba el máximo de reintentos).
      final intentosPorAccion = <int, int>{
        for (final accion in acciones)
          if (accion['id'] is int)
            accion['id'] as int: (accion['intentos'] as int?) ?? 0,
      };
      try {
        final respuesta = await ApiClient.post('/sync/carga', data: {
          'id_sync_log': sesion.idSesion,
          'dispositivo_id': await DatabaseHelper.instance.dispositivoId(),
          'version_app': AppConstants.version,
          'actividades': actividades,
          'estados': estados,
        });
        if (respuesta is Map) {
          final resultado = UploadService.planificarResultado(respuesta['items']);
          if (resultado.isNotEmpty) {
            // D-121: se marca **acción por acción** con el desenlace del servidor.
            for (final item in resultado) {
              if (item.aceptada) {
                await DatabaseHelper.instance.marcarAccionEnviada(item.idLocal);
                if (item.idCaso != null) {
                  await DatabaseHelper.instance.limpiarPendienteSync(item.idCaso!);
                }
                actividadesEnviadas++;
              } else {
                final intentos = (intentosPorAccion[item.idLocal] ?? 0) + 1;
                await DatabaseHelper.instance.marcarAccionError(
                  item.idLocal,
                  intentos,
                  item.mensaje.isEmpty
                      ? 'Rechazada por el servidor'
                      : item.mensaje,
                );
                errores.add(
                  'Acción ${item.idLocal} rechazada: '
                  '${item.mensaje.isEmpty ? 'sin detalle' : item.mensaje}',
                );
              }
            }
          } else {
            // Servidor anterior a D-121: comportamiento por lote (compatibilidad).
            actividadesEnviadas = (respuesta['aceptadas'] as int?) ?? 0;
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
              for (final idCaso in idsCasoBatch) {
                await DatabaseHelper.instance.limpiarPendienteSync(idCaso);
              }
            } else {
              for (final id in idsBatch) {
                final intentos = (intentosPorAccion[id] ?? 0) + 1;
                await DatabaseHelper.instance.marcarAccionReintento(
                  id,
                  intentos,
                  DateTime.now()
                      .add(Duration(minutes: _backoffMinutos(intentos)))
                      .millisecondsSinceEpoch,
                  'Rechazo parcial en /sync/carga',
                );
              }
            }
          }
        }
      } catch (e) {
        errores.add('Error en /sync/carga: $e');
        // Sin respuesta no se sabe qué se aplicó: se reintenta con **backoff** y
        // el contador real. Si el servidor ya lo había aplicado, la idempotencia
        // (D-121) evita el duplicado en el siguiente intento.
        for (final id in idsBatch) {
          final intentos = (intentosPorAccion[id] ?? 0) + 1;
          await DatabaseHelper.instance.marcarAccionReintento(
            id,
            intentos,
            DateTime.now()
                .add(Duration(minutes: _backoffMinutos(intentos)))
                .millisecondsSinceEpoch,
            'Sin respuesta de /sync/carga',
          );
        }
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

  /// Espera antes del siguiente intento: 1, 2, 4, 8… (tope 60 min).
  ///
  /// Misma política que `SyncProvider.backoffMinutos`, replicada aquí para no
  /// arrastrar el proveedor de sincronización al servicio de carga.
  static int _backoffMinutos(int intentos) {
    final minutos = 1 << (intentos - 1).clamp(0, 6);
    return minutos > 60 ? 60 : minutos;
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
