import '../../core/constants.dart';
import '../../core/database.dart';
import 'acciones_caso.dart';

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

  /// `true` solo si la operación se aplicó **en el servidor**.
  ///
  /// Con la gestión local-first (petición del técnico) las operaciones de campo
  /// nunca se envían aquí: quedan en `enviada = false` hasta que el técnico
  /// pulsa SINCRONIZAR.
  final bool enviada;

  /// Caso local ya actualizado (si procede).
  final Map<String, dynamic>? caso;

  /// `false` cuando el mensaje es una **validación local** (faltan datos): no se
  /// encoló nada.
  final bool valida;

  bool get encolada => !enviada && valida;
}

/// Operaciones de campo del técnico, **local-first**.
///
/// Cada operación valida y escribe el cambio en SQLite y lo deja en la cola
/// (`accion_pendiente`) con su payload exacto. **Ninguna** llama a la API: el
/// servidor solo se actualiza cuando el técnico ejecuta SINCRONIZAR (que exige
/// Wi-Fi). Así el trabajo en campo no depende de la cobertura y no se envía a
/// medias durante la jornada.
class OperacionesService {
  const OperacionesService._();

  /// Mensaje uniforme para una acción guardada y pendiente de sincronizar.
  static ResultadoOperacion _guardado(String que) => ResultadoOperacion(
        mensaje: 'Guardado en el dispositivo: $que Se enviará al servidor al '
            'sincronizar por Wi-Fi.',
        enviada: false,
      );

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
  /// sobreviva al reinicio (D-85 · requisito 1 del usuario).
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
  }) =>
      _guardarEstado(
        idCaso: idCaso,
        idAveria: idAveria,
        payload: {
          'estado_actual': 'CONTACTADO',
          if (motivo != null && motivo.trim().isNotEmpty) 'motivo_estado': motivo.trim(),
        },
        tipo: 'CONTACTADO',
        exito: 'Caso marcado como CONTACTADO.',
      );

  /// Marca el caso como CITADO (RF-12).
  static Future<ResultadoOperacion> marcarCitado({
    required int idCaso,
    required String idAveria,
    String? motivo,
  }) =>
      _guardarEstado(
        idCaso: idCaso,
        idAveria: idAveria,
        payload: {
          'estado_actual': 'CITADO',
          if (motivo != null && motivo.trim().isNotEmpty) 'motivo_estado': motivo.trim(),
        },
        tipo: 'CITADO',
        exito: 'Caso marcado como CITADO.',
      );

  /// Diferir con justificación y evidencias (RF-13).
  static Future<ResultadoOperacion> diferir({
    required int idCaso,
    required String idAveria,
    required String justificacion,
    List<String> evidencias = const [],
  }) async {
    final resultado = await _guardarEstado(
      idCaso: idCaso,
      idAveria: idAveria,
      payload: {
        'estado_actual': 'DIFERIDO',
        'motivo_estado': _recortar(justificacion, 200),
      },
      tipo: 'DIFERIDO',
      exito: 'Caso diferido con su justificación.',
    );
    // Las evidencias nunca se marcan como subidas aquí: las sube la CARGA.
    if (evidencias.isNotEmpty && resultado.encolada) {
      await DatabaseHelper.instance.encolarAccion(
        tipo: 'DIFERIDO_EVIDENCIAS',
        endpoint: '/casos/$idCaso/estado',
        metodo: 'POST',
        payload: {'id_caso': idCaso, 'id_averia': idAveria, 'evidencias': evidencias},
      );
    }
    return resultado;
  }

  /// Agenda una cita para el caso (RF-12).
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
    await DatabaseHelper.instance.encolarAccion(
      tipo: 'CITA',
      endpoint: '/citas',
      metodo: 'POST',
      payload: payload,
    );
    // D-85: la cita se ve en el teléfono aunque aún no haya viajado.
    await _aplicarLocal(
      idAveria,
      pendienteSync: true,
      extra: {'fecha_cita': fechaHora.toIso8601String()},
    );
    return _guardado('Cita agendada para el ${_formato(fechaHora)}.');
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
    await DatabaseHelper.instance.encolarAccion(
      tipo: 'CIERRE',
      endpoint: '/casos/$idCaso/cierre',
      metodo: 'POST',
      payload: payload,
    );
    // D-85: el caso queda CERRADO en el dispositivo (pendiente de enviar).
    await _aplicarLocal(idAveria, estado: 'CERRADO', pendienteSync: true);
    return _guardado('Caso cerrado con $modo.');
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
    // La evidencia viaja dentro de la propia acción ENRUTADO; no se encola
    // aparte (UploadService sube el archivo en la CARGA).
    await DatabaseHelper.instance.encolarAccion(
      tipo: 'ENRUTADO',
      endpoint: '/casos/$idCaso/enrutado',
      metodo: 'POST',
      payload: {...payload, 'evidencias': evidencias},
    );
    await _aplicarLocal(idAveria, estado: 'ENRUTADO', pendienteSync: true);
    return _guardado('Caso enrutado a $destino.');
  }

  /// «No Contesta» (D-88 · RF-APK-12): CITADO con cita de 1ra visita.
  static Future<ResultadoOperacion> noContesta({
    required int idCaso,
    required String idAveria,
    DateTime? fechaHora,
    String? observacion,
  }) async {
    final cita = fechaHora ?? citaDeNoContesta();
    final payload = <String, dynamic>{
      'fecha_hora': cita.toUtc().toIso8601String(),
      if (observacion != null && observacion.trim().isNotEmpty)
        'observacion': observacion.trim(),
    };
    await DatabaseHelper.instance.encolarAccion(
      tipo: 'NO_CONTESTA',
      endpoint: '/casos/$idCaso/no-contesta',
      metodo: 'POST',
      payload: payload,
    );
    await _aplicarLocal(
      idAveria,
      estado: 'CITADO',
      pendienteSync: true,
      extra: {'fecha_cita': cita.toUtc().toIso8601String()},
    );
    return _guardado('El caso quedó CITADO con cita de 1ra visita.');
  }

  /// Corrige dirección y número de contacto desde el campo (D-88 · D-93).
  static Future<ResultadoOperacion> editarContacto({
    required int idCaso,
    required String idAveria,
    String? direccion,
    String? contacto,
  }) async {
    final texto = (contacto ?? '').trim();
    final payload = <String, dynamic>{
      if (direccion != null && direccion.trim().isNotEmpty)
        'direccion': direccion.trim(),
      if (texto.isNotEmpty) 'contacto': texto,
    };
    if (payload.isEmpty) {
      return const ResultadoOperacion(
        mensaje: 'Indique la dirección o el número de contacto.',
        enviada: false,
        valida: false,
      );
    }
    await DatabaseHelper.instance.encolarAccion(
      tipo: 'CONTACTO_CAMPO',
      endpoint: '/casos/$idCaso/contacto',
      metodo: 'PATCH',
      payload: payload,
    );
    await _aplicarLocal(idAveria, pendienteSync: true, extra: payload);
    final eraIdentificador = esIdentificadorPago(texto);
    return _guardado(eraIdentificador
        ? '${normalizarNumero(texto)} se registrará como identificador de pago del caso.'
        : 'Contacto actualizado en el caso.');
  }

  /// Reporta una falla masiva desde el campo (RF-16 · D-82 · D-118).
  static Future<ResultadoOperacion> reportarFallaMasiva({
    required String olt,
    required String slot,
    required String puerto,
    required String odn,
    required String direccion,
    required String fat,
    required String descripcion,
    List<String> evidencias = const [],
    int? idSector,
    int? idCuadrilla,
  }) async {
    final oltLimpia = olt.trim();
    final slotLimpio = slot.trim();
    final puertoLimpio = puerto.trim();
    final odnLimpia = odn.trim();
    final direccionLimpia = direccion.trim();
    final fatLimpia = fat.trim();
    final texto = _recortar(descripcion.trim(), 500);
    if (oltLimpia.isEmpty) {
      return const ResultadoOperacion(
        mensaje: 'Indique la OLT del reporte.', enviada: true, valida: false);
    }
    if (slotLimpio.isEmpty) {
      return const ResultadoOperacion(
        mensaje: 'Indique el SLOT del reporte.', enviada: true, valida: false);
    }
    if (puertoLimpio.isEmpty) {
      return const ResultadoOperacion(
        mensaje: 'Indique el PUERTO del reporte.', enviada: true, valida: false);
    }
    if (odnLimpia.length < 3) {
      return const ResultadoOperacion(
        mensaje: 'Indique la ODN del reporte.', enviada: true, valida: false);
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
        mensaje: 'Indique la FAT del reporte.', enviada: true, valida: false);
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
      'olt': _recortar(oltLimpia, 60),
      'slot': _recortar(slotLimpio, 20),
      'puerto': _recortar(puertoLimpio, 20),
      'odn': _recortar(odnLimpia, 60),
      'direccion': _recortar(direccionLimpia, 200),
      'fat': _recortar(fatLimpia, 60),
      'descripcion': texto,
      'evidencias': evidencias,
      'origen': 'REPORTE_TECNICO',
      if (idSector != null) 'id_sector': idSector,
      if (idCuadrilla != null) 'id_cuadrilla': idCuadrilla,
    };
    await DatabaseHelper.instance.encolarAccion(
      tipo: 'FALLA_MASIVA',
      endpoint: '/fallas-masivas/reporte-campo',
      metodo: 'POST',
      payload: payload,
    );
    return _guardado('Falla masiva reportada.');
  }

  /// Guarda un cambio de estado en local y en la cola, sin tocar la red.
  static Future<ResultadoOperacion> _guardarEstado({
    required int idCaso,
    required String idAveria,
    required Map<String, dynamic> payload,
    required String tipo,
    required String exito,
  }) async {
    await DatabaseHelper.instance.encolarAccion(
      tipo: tipo,
      endpoint: '/casos/$idCaso/estado',
      metodo: 'POST',
      payload: payload,
    );
    await _aplicarLocal(
      idAveria,
      estado: '${payload['estado_actual'] ?? ''}',
      pendienteSync: true,
    );
    return _guardado(exito);
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
