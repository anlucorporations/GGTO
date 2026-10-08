import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';
import '../../core/constants.dart';
import '../../core/database.dart';

/// Resultado de una pasada de sincronización.
class ResultadoSync {
  const ResultadoSync({
    required this.enviadas,
    required this.reintentar,
    required this.fallidas,
    required this.pendientes,
  });

  final int enviadas;
  final int reintentar;
  final int fallidas;
  final int pendientes;

  bool get huboErrores => fallidas > 0;

  String get resumen {
    if (enviadas == 0 && reintentar == 0 && fallidas == 0) {
      return 'No había acciones por sincronizar.';
    }
    final partes = <String>['$enviadas enviadas'];
    if (reintentar > 0) partes.add('$reintentar en reintento');
    if (fallidas > 0) partes.add('$fallidas con error');
    if (pendientes > 0) partes.add('$pendientes pendientes');
    return partes.join(' · ');
  }
}

/// Cola offline (outbox) con estados, reintentos y backoff.
///
/// Corrige H-08 (el `break` bloqueaba toda la cola ante el primer fallo), H-14
/// (no había estados ni reintentos) y añade el vaciado automático al recuperar
/// la conexión (RNF-06).
class SyncProvider extends ChangeNotifier {
  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _suscripcion;

  Map<String, int> _resumen = {'PENDIENTE': 0, 'REINTENTO': 0, 'ERROR': 0, 'TOTAL': 0};
  List<Map<String, dynamic>> _acciones = [];
  bool _sincronizando = false;
  bool _enLinea = true;
  ResultadoSync? _ultimoResultado;
  DateTime? _ultimaSync;
  int _evidencias = 0;
  List<Map<String, dynamic>> _ultimoChecklist = [];
  double _progreso = 1;
  String _fase = 'Datos sincronizados';
  bool _progresoActivo = false;

  Map<String, int> get resumen => _resumen;
  int get pendientes => _resumen['TOTAL'] ?? 0;
  int get pendientesSinError => (_resumen['PENDIENTE'] ?? 0) + (_resumen['REINTENTO'] ?? 0);
  int get conError => _resumen['ERROR'] ?? 0;
  List<Map<String, dynamic>> get acciones => _acciones;
  bool get sincronizando => _sincronizando;
  bool get enLinea => _enLinea;
  ResultadoSync? get ultimoResultado => _ultimoResultado;
  DateTime? get ultimaSync => _ultimaSync;
  int get evidencias => _evidencias;
  List<Map<String, dynamic>> get ultimoChecklist => _ultimoChecklist;

  // ------------------------------------------------------------------------- #
  // Barra de progreso de la sincronización (D-82 · requisito 2)
  // ------------------------------------------------------------------------- #

  /// Avance de la sincronización en curso, entre 0 y 1.
  double get progreso => _progreso;

  /// Texto del paso que se está ejecutando (p. ej. «Enviando acciones…»).
  String get fase => _fase;

  /// `true` mientras hay una sincronización u operación en curso.
  bool get progresoActivo => _progresoActivo;

  /// Porcentaje entero para mostrar en pantalla.
  int get progresoPorcentaje => (_progreso.clamp(0, 1) * 100).round();

  /// Progreso que debe pintar la barra cuando **no** hay nada en curso: la cola
  /// al día se muestra completa (verde) y con pendientes se muestra vacía.
  double get progresoEnReposo => pendientesSinError == 0 && conError == 0 ? 1 : 0;

  /// Texto del estado en reposo.
  String get resumenBarra {
    if (_progresoActivo) return '$progresoPorcentaje % · $_fase';
    if (conError > 0) return '$conError acciones con error · revíselas en Dispositivo';
    if (pendientesSinError > 0) {
      return '$pendientesSinError acciones pendientes de envío';
    }
    return _ultimaSync == null ? 'Sin sincronizar todavía' : 'Datos sincronizados';
  }

  /// Marca el inicio de una operación con progreso visible.
  void iniciarProgreso(String fase, {double valor = 0}) {
    _progresoActivo = true;
    _fase = fase;
    _progreso = valor.clamp(0, 1);
    notifyListeners();
  }

  /// Actualiza el avance de la operación en curso.
  void actualizarProgreso(double valor, {String? fase}) {
    _progresoActivo = true;
    _progreso = valor.clamp(0, 1);
    if (fase != null && fase.isNotEmpty) _fase = fase;
    notifyListeners();
  }

  /// Cierra la operación dejando la barra en reposo.
  void terminarProgreso({String? fase, bool completo = true}) {
    _progresoActivo = false;
    _progreso = completo ? 1 : 0;
    _fase = fase ?? 'Datos sincronizados';
    notifyListeners();
  }


  /// Arranca la vigilancia de conectividad (solo para el indicador).
  ///
  /// D-84 (DEC-3): **no** se vacía la cola al recuperar la red. La CARGA la
  /// decide el técnico; la conectividad solo actualiza el indicador y la
  /// disponibilidad de los botones.
  void iniciar() {
    _suscripcion ??= _connectivity.onConnectivityChanged.listen((resultados) {
      final conectado = resultados.any((r) => r != ConnectivityResult.none);
      _enLinea = conectado;
      notifyListeners();
    });

    _connectivity.checkConnectivity().then((resultados) {
      _enLinea = resultados.any((r) => r != ConnectivityResult.none);
      notifyListeners();
    }).catchError((_) {
      // Si la consulta falla, se asume en línea y se deja que la API decida.
      _enLinea = true;
    });

    refrescar();
  }

  /// Recuenta la cola y las evidencias de la jornada.
  Future<void> refrescar() async {
    _resumen = await DatabaseHelper.instance.resumenCola();
    _acciones = await DatabaseHelper.instance.todasLasAcciones();
    _evidencias = await DatabaseHelper.instance.contarEvidencias();
    _ultimoChecklist = _decodificarChecklist(await DatabaseHelper.instance.leerChecklist());
    notifyListeners();
  }

  /// Lee el último checklist guardado (RF-40). Tolerante a datos corruptos.
  List<Map<String, dynamic>> _decodificarChecklist(String? json) {
    if (json == null || json.isEmpty) return [];
    try {
      final datos = jsonDecode(json);
      if (datos is List) {
        return datos
            .whereType<Map<String, dynamic>>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    } catch (_) {
      // Se ignora un checklist ilegible.
    }
    return [];
  }

  /// Compatibilidad con la pantalla anterior.
  Future<void> checkPendientes() => refrescar();

  /// Envía las acciones pendientes.
  ///
  /// Cada acción se intenta de forma independiente: un 4xx **no** detiene la
  /// cola (H-08). Los fallos de red o 5xx se reintentan con backoff.
  Future<ResultadoSync> sincronizar({bool silencioso = false}) async {
    if (_sincronizando) {
      return _ultimoResultado ??
          const ResultadoSync(enviadas: 0, reintentar: 0, fallidas: 0, pendientes: 0);
    }
    _sincronizando = true;
    if (!silencioso) notifyListeners();

    var enviadas = 0;
    var reintentar = 0;
    var fallidas = 0;

    try {
      final acciones = await DatabaseHelper.instance.accionesPendientes();
      final total = acciones.length;
      // D-82: la barra avanza acción por acción (progreso determinista).
      _progresoActivo = true;
      _progreso = total == 0 ? 1 : 0;
      _fase = total == 0 ? 'No había acciones por sincronizar' : 'Enviando acciones…';
      notifyListeners();

      var procesadas = 0;
      for (final accion in acciones) {
        final id = accion['id'] as int;
        final intentos = ((accion['intentos'] as int?) ?? 0) + 1;
        try {
          await _enviar(accion);
          await DatabaseHelper.instance.marcarAccionEnviada(id);
          await _marcarEvidenciasSubidas(accion);
          enviadas++;
        } on ApiError catch (error) {
          if (error.esDeRed || (error.status != null && error.status! >= 500)) {
            // Reintentable: backoff exponencial con tope.
            final minutos = backoffMinutos(intentos);
            await DatabaseHelper.instance.marcarAccionReintento(
              id,
              intentos,
              DateTime.now().add(Duration(minutes: minutos)).millisecondsSinceEpoch,
              error.mensaje,
            );
            reintentar++;
          } else if (error.esDefinitivo || intentos >= AppConstants.maxIntentosSync) {
            // No se resuelve reintentando: se deja visible para el usuario.
            await DatabaseHelper.instance.marcarAccionError(id, intentos, error.mensaje);
            fallidas++;
          } else {
            await DatabaseHelper.instance.marcarAccionReintento(
              id,
              intentos,
              DateTime.now().add(Duration(minutes: backoffMinutos(intentos))).millisecondsSinceEpoch,
              error.mensaje,
            );
            reintentar++;
          }
        } catch (error) {
          await DatabaseHelper.instance.marcarAccionError(
            id,
            intentos,
            ApiError.desconocido(error).mensaje,
          );
          fallidas++;
        }
        procesadas++;
        _progreso = total == 0 ? 1 : procesadas / total;
        _fase = 'Enviando acciones… ($procesadas de $total)';
        notifyListeners();
      }
    } finally {
      _sincronizando = false;
      await refrescar();
      _ultimaSync = DateTime.now();
      final resultado = ResultadoSync(
        enviadas: enviadas,
        reintentar: reintentar,
        fallidas: fallidas,
        pendientes: _resumen['TOTAL'] ?? 0,
      );
      _ultimoResultado = resultado;
      _progresoActivo = false;
      _progreso = 1;
      _fase = 'Datos sincronizados';
      notifyListeners();
    }

    return _ultimoResultado!;
  }

  /// Devuelve una acción con error a la cola.
  Future<void> reintentarAccion(int id) async {
    await DatabaseHelper.instance.reintentarAccion(id);
    await refrescar();
  }

  /// Descarta una acción de la cola.
  Future<void> descartarAccion(int id) async {
    await DatabaseHelper.instance.borrarAccion(id);
    await refrescar();
  }

  /// Minutos de espera antes del siguiente intento: 1, 2, 4, 8… (tope 60).
  ///
  /// Público y estático para poder verificarlo en las pruebas del contrato.
  static int backoffMinutos(int intentos) {
    final minutos = 1 << (intentos - 1).clamp(0, 6);
    return minutos > 60 ? 60 : minutos;
  }

  /// Traduce una acción de la cola a la llamada real de la API.
  Future<void> _enviar(Map<String, dynamic> accion) async {
    final endpoint = '${accion['endpoint']}';
    final metodo = '${accion['metodo']}';
    final payload = _payload(accion);

    switch (metodo) {
      case 'PATCH':
        await ApiClient.patch(endpoint, data: payload);
        break;
      case 'PUT':
        await ApiClient.put(endpoint, data: payload);
        break;
      default:
        await ApiClient.post(endpoint, data: payload);
    }
  }

  Map<String, dynamic> _payload(Map<String, dynamic> accion) {
    final crudo = accion['payload'];
    if (crudo is Map) return Map<String, dynamic>.from(crudo);
    return {};
  }

  /// Marca como subidas las evidencias referenciadas por la acción enviada.
  Future<void> _marcarEvidenciasSubidas(Map<String, dynamic> accion) async {
    final tipo = '${accion['tipo']}';
    if (!tipo.startsWith('EVIDENCIA')) return;
    final db = await DatabaseHelper.instance.database;
    final seriales = _payload(accion)['evidencias'];
    if (seriales is! List) return;
    for (final serial in seriales) {
      await db.update(
        'evidencia_local',
        {'subida': 1},
        where: 'serial_imagen = ?',
        whereArgs: ['$serial'],
      );
    }
  }

  @override
  void dispose() {
    _suscripcion?.cancel();
    super.dispose();
  }
}
