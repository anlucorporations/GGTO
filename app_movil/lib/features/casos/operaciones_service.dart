import '../../core/api_client.dart';
import '../../core/api_error.dart';
import '../../core/constants.dart';
import '../../core/database.dart';

/// Resultado de una operación de campo.
class ResultadoOperacion {
  const ResultadoOperacion({
    required this.mensaje,
    required this.enviada,
    this.caso,
    this.valida = true,
  });

  /// Mensaje para mostrar al técnico.
  final String mensaje;

  /// `true` si se aplicó en el servidor; `false` si quedó en la cola offline.
  final bool enviada;

  /// Caso actualizado devuelto por el servidor (si lo hubo).
  final Map<String, dynamic>? caso;

  /// `false` cuando el mensaje es una **validación local** (faltan datos): no se
  /// envió nada ni se encoló.
  final bool valida;

  bool get encolada => !enviada && valida;
}

/// Operaciones de campo del técnico contra el contrato real de la API.
///
/// Cada operación intenta el envío y, si no hay red (o el servidor falla con un
/// error recuperable), la **encola con su payload exacto** para sincronizarla
/// después. Los errores que no se resuelven reintentando (403, 404, 409, 422)
/// se devuelven al usuario en lugar de perderse.
class OperacionesService {
  const OperacionesService._();

  /// Fusiona un cambio en el mapa del caso (D-85).
  ///
  /// Es **puro** (sin red ni base de datos) para poder probarlo aislado; la
  /// escritura real la hace `DatabaseHelper.aplicarCambioLocal`.
  static Map<String, dynamic> conCambioLocal(
    Map<String, dynamic> caso, {
    String? estado,
    bool? pendienteSync,
    Map<String, dynamic>? extra,
  }) {
    final salida = Map<String, dynamic>.from(caso);
    if (estado != null && estado.isNotEmpty) salida['estado_actual'] = estado;
    if (pendienteSync != null) salida['pendiente_sync'] = pendienteSync;
    if (extra != null) salida.addAll(extra);
    return salida;
  }

  /// Escribe el cambio en la **caché local** para que se vea de inmediato y
  /// sobreviva al reinicio, haya o no conexión (D-85 · requisito 1 del usuario).
  static Future<void> _aplicarLocal(
    String idAveria, {
    String? estado,
    bool? pendienteSync,
    Map<String, dynamic>? extra,
  }) async {
    if (idAveria.isEmpty) return;
    await DatabaseHelper.instance.aplicarCambioLocal(
      idAveria,
      estado: estado,
      pendienteSync: pendienteSync,
      extra: extra,
    );
  }

  /// Marca el caso como CONTACTADO (RF-12).
  static Future<ResultadoOperacion> marcarContactado({
    required int idCaso,
    required String idAveria,
    String? motivo,
  }) async {
    final payload = {
      'estado_actual': 'CONTACTADO',
      if (motivo != null && motivo.trim().isNotEmpty) 'motivo_estado': motivo.trim(),
    };
    return _enviarEstado(
      idCaso: idCaso,
      idAveria: idAveria,
      payload: payload,
      tipo: 'CONTACTADO',
      exito: 'Caso marcado como CONTACTADO.',
    );
  }

  /// Marca el caso como CITADO (RF-12).
  static Future<ResultadoOperacion> marcarCitado({
    required int idCaso,
    required String idAveria,
    String? motivo,
  }) async {
    return _enviarEstado(
      idCaso: idCaso,
      idAveria: idAveria,
      payload: {
        'estado_actual': 'CITADO',
        if (motivo != null && motivo.trim().isNotEmpty) 'motivo_estado': motivo.trim(),
      },
      tipo: 'CITADO',
      exito: 'Caso marcado como CITADO.',
    );
  }

  /// Marca el caso como DIFERIDO con su justificación (RF-13).
  static Future<ResultadoOperacion> diferir({
    required int idCaso,
    required String idAveria,
    required String justificacion,
    List<String> evidencias = const [],
  }) async {
    final resultado = await _enviarEstado(
      idCaso: idCaso,
      idAveria: idAveria,
      payload: {
        'estado_actual': 'DIFERIDO',
        'motivo_estado': _recortar(justificacion, 200),
      },
      tipo: 'DIFERIDO',
      exito: 'Caso diferido con su justificación.',
    );
    // D-73: si el diferido quedó encolado, sus evidencias viajan con la acción
    // de estado (UploadService sube los archivos antes del batch).
    if (evidencias.isNotEmpty && resultado.encolada) {
      await DatabaseHelper.instance.encolarAccion(
        tipo: 'DIFERIDO_EVIDENCIAS',
        endpoint: '/casos/$idCaso/estado',
        metodo: 'POST',
        payload: {'evidencias': evidencias},
      );
    } else if (evidencias.isNotEmpty) {
      await _marcarEvidencias(evidencias);
    }
    return resultado;
  }

  /// Agenda una cita para el caso (RF-12).
  ///
  /// Usa `POST /citas` con `fecha_hora`, el campo que exige el backend (H-07).
  static Future<ResultadoOperacion> agendarCita({
    required int idCaso,
    required String idAveria,
    required DateTime fechaHora,
    String tipo = 'ATENCION',
    String? observacion,
  }) async {
    final payload = {
      'id_caso': idCaso,
      'fecha_hora': fechaHora.toIso8601String(),
      'tipo': tipo,
      if (observacion != null && observacion.trim().isNotEmpty) 'observacion': observacion.trim(),
    };
    const endpoint = '/citas';

    try {
      final datos = await ApiClient.post(endpoint, data: payload);
      final caso = await _refrescarCaso(idCaso);
      final hora = _formato(fechaHora);
      return ResultadoOperacion(
        mensaje: 'Cita agendada para el $hora.',
        enviada: true,
        caso: caso ?? _conEstado(datos),
      );
    } on ApiError catch (error) {
      if (error.esConflicto) {
        // Solapamiento con otra cita de la cuadrilla (RNF-04).
        return ResultadoOperacion(mensaje: error.mensaje, enviada: true);
      }
      if (error.esDeRed || (error.status != null && error.status! >= 500)) {
        await DatabaseHelper.instance.encolarAccion(
          tipo: 'CITA',
          endpoint: endpoint,
          metodo: 'POST',
          payload: payload,
        );
        // D-85: la cita se ve en el teléfono aunque aún no haya viajado.
        await _aplicarLocal(
          idAveria,
          pendienteSync: true,
          extra: {'fecha_cita': fechaHora.toIso8601String()},
        );
        return const ResultadoOperacion(
          mensaje: 'Sin conexión: la cita quedó guardada en el dispositivo y se enviará al sincronizar.',
          enviada: false,
        );
      }
      return ResultadoOperacion(mensaje: error.mensaje, enviada: true);
    }
  }

  /// Cierra el caso con modo, descripción y evidencias (RF-15 / §4.2).
  static Future<ResultadoOperacion> cerrar({
    required int idCaso,
    required String idAveria,
    required String modo,
    required String descripcion,
    List<String> evidencias = const [],
    int? idCausa,
  }) async {
    final payload = {
      'modo': modo,
      'descripcion': descripcion.trim(),
      'evidencias': evidencias,
      if (idCausa != null) 'id_causa': idCausa,
    };
    final endpoint = '/casos/$idCaso/cierre';

    try {
      final datos = await ApiClient.post(endpoint, data: payload);
      final caso = await _refrescarCaso(idCaso);
      await _marcarEvidencias(evidencias);
      final mensaje = datos is Map && datos['mensaje'] != null
          ? '${datos['mensaje']}'
          : 'Caso cerrado con $modo.';
      return ResultadoOperacion(mensaje: mensaje, enviada: true, caso: caso);
    } on ApiError catch (error) {
      if (error.esDeRed || (error.status != null && error.status! >= 500)) {
        // D-73: las evidencias NO se marcan como subidas aquí; `UploadService`
        // sube primero el archivo y luego envía la acción por `/sync/carga`.
        await DatabaseHelper.instance.encolarAccion(
          tipo: 'CIERRE',
          endpoint: endpoint,
          metodo: 'POST',
          payload: payload,
        );
        // D-85: el caso queda CERRADO en el dispositivo (marcado como pendiente).
        await _aplicarLocal(idAveria, estado: 'CERRADO', pendienteSync: true);
        return const ResultadoOperacion(
          mensaje: 'Sin conexión: el cierre quedó guardado en el dispositivo y se enviará al sincronizar.',
          enviada: false,
        );
      }
      return ResultadoOperacion(mensaje: error.mensaje, enviada: true);
    }
  }

  /// Enruta el caso a otra instancia (RF-13 / §4.2).
  static Future<ResultadoOperacion> enrutar({
    required int idCaso,
    required String idAveria,
    required String destino,
    required String motivo,
    List<String> evidencias = const [],
    int? idMetodo,
  }) async {
    final payload = {
      'destino': destino.trim(),
      'motivo': motivo.trim(),
      if (idMetodo != null) 'id_metodo': idMetodo,
    };
    final endpoint = '/casos/$idCaso/enrutado';

    try {
      final datos = await ApiClient.post(endpoint, data: payload);
      final caso = await _refrescarCaso(idCaso);
      if (evidencias.isNotEmpty) {
        await _encolarEvidencias(idCaso, idAveria, evidencias);
      }
      final mensaje = datos is Map && datos['mensaje'] != null
          ? '${datos['mensaje']}'
          : 'Caso enrutado a $destino.';
      return ResultadoOperacion(mensaje: mensaje, enviada: true, caso: caso);
    } on ApiError catch (error) {
      if (error.esDeRed || (error.status != null && error.status! >= 500)) {
        // D-73: la evidencia viaja dentro de la propia acción ENRUTADO; no se
        // marca subida ni se encola aparte (UploadService sube el archivo).
        await DatabaseHelper.instance.encolarAccion(
          tipo: 'ENRUTADO',
          endpoint: endpoint,
          metodo: 'POST',
          payload: {...payload, 'evidencias': evidencias},
        );
        // D-85: el caso queda ENRUTADO en el dispositivo (pendiente de enviar).
        await _aplicarLocal(idAveria, estado: 'ENRUTADO', pendienteSync: true);
        return const ResultadoOperacion(
          mensaje: 'Sin conexión: el enrutado quedó guardado en el dispositivo y se enviará al sincronizar.',
          enviada: false,
        );
      }
      return ResultadoOperacion(mensaje: error.mensaje, enviada: true);
    }
  }

  /// Reporta una falla masiva desde el campo (RF-16 · D-82).
  ///
  /// El reporte indica la **ODN**, la **dirección**, la **FAT** y la
  /// **descripción**, con **hasta 2 fotos** de evidencia. Las fotos se suben con
  /// `POST /evidencias/upload` y sus seriales viajan en el reporte; si no hay
  /// conexión, la acción queda en la cola con los seriales locales (el servidor
  /// acepta el mismo serial al subir el archivo, así que no se duplica).
  static Future<ResultadoOperacion> reportarFallaMasiva({
    required String odn,
    required String direccion,
    required String fat,
    required String descripcion,
    List<String> evidencias = const [],
    int? idSector,
    int? idCuadrilla,
  }) async {
    final odnLimpia = odn.trim();
    final direccionLimpia = direccion.trim();
    final fatLimpia = fat.trim();
    final texto = _recortar(descripcion.trim(), 500);
    if (odnLimpia.length < 3) {
      return const ResultadoOperacion(
        mensaje: 'Indique la ODN del reporte.',
        enviada: true,
        valida: false,
      );
    }
    if (direccionLimpia.length < 5) {
      return const ResultadoOperacion(
        mensaje: 'Indique la dirección del reporte (mínimo 5 caracteres).',
        enviada: true,
        valida: false,
      );
    }
    if (fatLimpia.isEmpty) {
      return const ResultadoOperacion(
        mensaje: 'Indique la FAT del reporte.',
        enviada: true,
        valida: false,
      );
    }
    if (texto.length < 5) {
      return const ResultadoOperacion(
        mensaje: 'Describa la falla con al menos 5 caracteres.',
        enviada: true,
        valida: false,
      );
    }
    if (evidencias.length > AppConstants.maxEvidenciasFallaMasiva) {
      return const ResultadoOperacion(
        mensaje: 'Solo se admiten 2 fotos de evidencia por reporte.',
        enviada: true,
        valida: false,
      );
    }

    final payload = <String, dynamic>{
      'odn': _recortar(odnLimpia, 60),
      'direccion': _recortar(direccionLimpia, 200),
      'fat': _recortar(fatLimpia, 60),
      'descripcion': texto,
      'evidencias': evidencias,
      'origen': 'REPORTE_TECNICO',
      if (idSector != null) 'id_sector': idSector,
      if (idCuadrilla != null) 'id_cuadrilla': idCuadrilla,
    };
    const endpoint = '/fallas-masivas/reporte-campo';

    try {
      await ApiClient.post(endpoint, data: payload);
      return const ResultadoOperacion(mensaje: 'Falla masiva reportada.', enviada: true);
    } on ApiError catch (error) {
      if (error.esDeRed || (error.status != null && error.status! >= 500)) {
        await DatabaseHelper.instance.encolarAccion(
          tipo: 'FALLA_MASIVA',
          endpoint: endpoint,
          metodo: 'POST',
          payload: payload,
        );
        return const ResultadoOperacion(
          mensaje: 'Sin conexión: la falla quedó guardada y se enviará al sincronizar.',
          enviada: false,
        );
      }
      return ResultadoOperacion(mensaje: error.mensaje, enviada: true);
    }
  }

  /// Encola las evidencias de un caso para subirlas al sincronizar.
  static Future<void> _encolarEvidencias(
    int idCaso,
    String idAveria,
    List<String> seriales,
  ) async {
    if (seriales.isEmpty) return;
    await DatabaseHelper.instance.encolarAccion(
      tipo: 'EVIDENCIA',
      endpoint: '/casos/$idCaso/cierre',
      metodo: 'POST',
      payload: {'evidencias': seriales},
    );
    await _marcarEvidencias(seriales);
  }

  static Future<void> _marcarEvidencias(List<String> seriales) async {
    if (seriales.isEmpty) return;
    final db = await DatabaseHelper.instance.database;
    for (final serial in seriales) {
      await db.update(
        'evidencia_local',
        {'subida': 1},
        where: 'serial_imagen = ?',
        whereArgs: [serial],
      );
    }
  }

  static Future<ResultadoOperacion> _enviarEstado({
    required int idCaso,
    required String idAveria,
    required Map<String, dynamic> payload,
    required String tipo,
    required String exito,
  }) async {
    final endpoint = '/casos/$idCaso/estado';
    final estadoNuevo = '${payload['estado_actual'] ?? ''}';
    try {
      final datos = await ApiClient.post(endpoint, data: payload);
      final caso = datos is Map
          ? Map<String, dynamic>.from(datos)
          : await _refrescarCaso(idCaso);
      // D-85: el servidor confirmó; se guarda el caso y se quita el distintivo.
      if (caso != null) {
        await DatabaseHelper.instance
            .actualizarCasoLocal(conCambioLocal(caso, pendienteSync: false));
      } else {
        await _aplicarLocal(idAveria, estado: estadoNuevo, pendienteSync: false);
      }
      return ResultadoOperacion(mensaje: exito, enviada: true, caso: caso);
    } on ApiError catch (error) {
      if (error.esConflicto) {
        // El caso ya está en ese estado: no es un fallo para el usuario.
        await _aplicarLocal(idAveria, estado: estadoNuevo, pendienteSync: false);
        return ResultadoOperacion(mensaje: error.mensaje, enviada: true);
      }
      if (error.esDeRed || (error.status != null && error.status! >= 500)) {
        await DatabaseHelper.instance.encolarAccion(
          tipo: tipo,
          endpoint: endpoint,
          metodo: 'POST',
          payload: payload,
        );
        // D-85: el cambio se ve **ya** en el teléfono y queda marcado como
        // pendiente de sincronizar (antes no se reflejaba hasta la CARGA).
        await _aplicarLocal(idAveria, estado: estadoNuevo, pendienteSync: true);
        return const ResultadoOperacion(
          mensaje: 'Sin conexión: el cambio quedó guardado en el dispositivo y se enviará al sincronizar.',
          enviada: false,
        );
      }
      return ResultadoOperacion(mensaje: error.mensaje, enviada: true);
    }
  }

  static Future<Map<String, dynamic>?> _refrescarCaso(int idCaso) async {
    try {
      final datos = await ApiClient.get('/casos/$idCaso');
      if (datos is Map) {
        final caso = Map<String, dynamic>.from(datos);
        await DatabaseHelper.instance.actualizarCasoLocal(caso);
        return caso;
      }
    } on ApiError {
      // Si no se puede refrescar, se devuelve `null` y la pantalla se recarga.
    }
    return null;
  }

  static Map<String, dynamic>? _conEstado(dynamic datos) {
    if (datos is Map) return Map<String, dynamic>.from(datos);
    return null;
  }

  static String _recortar(String texto, int maximo) {
    final limpio = texto.trim();
    return limpio.length <= maximo ? limpio : limpio.substring(0, maximo);
  }

  static String _formato(DateTime fecha) {
    String dos(int valor) => valor.toString().padLeft(2, '0');
    return '${dos(fecha.day)}/${dos(fecha.month)}/${fecha.year} ${dos(fecha.hour)}:${dos(fecha.minute)}';
  }
}
