import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/database.dart';

/// Mensajería interna (D-81 · RF-41) en la APK.
///
/// D-84 (RF-APK-02): sondeo **cada 60 s** y **solo con la app en primer plano**.
/// Es la única pieza que se sincroniza sola: los casos dependen de CARGA y
/// DESCARGA (DEC-3).
///
/// D-86 (RF-APK-04/05): la **primera carga** pide los **últimos 50** (antes pedía
/// `desde=0` y traía los 50 **más antiguos**, de modo que los recién llegados
/// tardaban varios ciclos en aparecer); la bandeja se muestra **del más reciente
/// al más antiguo** agrupada por día, se guarda en el dispositivo para leerla sin
/// conexión y admite **filtros** por tipo y por leído/no leído, además del
/// **marcado masivo como leído** (sin borrado, DEC-2).
class MensajesProvider extends ChangeNotifier with WidgetsBindingObserver {
  /// Periodo del sondeo automático (RF-APK-02).
  static const Duration intervaloSondeo = Duration(seconds: 60);

  /// Cuántos mensajes trae la primera carga (RF-APK-04).
  static const int ultimosIniciales = 50;

  /// Tipos de mensaje que rotula la bandeja.
  static const Map<String, String> etiquetas = {
    'TEXTO': 'Mensaje',
    'RECORDATORIO_CITA': 'Recordatorio de cita',
    'ESTADO_SYNC': 'Estado de sincronización',
    'ALARMA_DESPACHO': 'Alarma de despacho',
  };

  Timer? _timer;
  final List<Map<String, dynamic>> _mensajes = []; // orden cronológico
  int _noLeidos = 0;
  int _ultimoId = 0;
  bool _enCurso = false;
  bool _enPrimerPlano = true;

  /// Bandeja **del más reciente al más antiguo** (DEC-4).
  List<Map<String, dynamic>> get mensajes => ordenarMasRecientePrimero(_mensajes);

  int get noLeidos => _noLeidos;

  /// Arranca el sondeo (idempotente): primero lo guardado, después la red.
  void iniciar() {
    WidgetsBinding.instance.addObserver(this);
    _timer ??= Timer.periodic(intervaloSondeo, (_) => _sondearSiAplica());
    cargarLocal().then((_) => _sondearSiAplica());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _enPrimerPlano = state == AppLifecycleState.resumed;
    // Al volver a la app no se espera el minuto completo.
    if (_enPrimerPlano) _sondearSiAplica();
  }

  /// Sondea solo si la app está en primer plano (ahorro de batería y datos).
  void _sondearSiAplica() {
    if (!_enPrimerPlano) return;
    sondear();
  }

  /// Carga la bandeja guardada en el dispositivo (sin red).
  Future<void> cargarLocal() async {
    final guardados = await DatabaseHelper.instance.leerMensajes();
    _mensajes
      ..clear()
      ..addAll(guardados);
    _ultimoId = (await DatabaseHelper.instance.maxIdMensaje()) ?? 0;
    _noLeidos = await DatabaseHelper.instance.contarMensajesNoLeidos();
    notifyListeners();
  }

  /// Sondeo contra el servidor: últimos N la primera vez, incremental después.
  Future<void> sondear() async {
    if (_enCurso) return;
    _enCurso = true;
    try {
      final resp = await ApiClient.get(
        '/mensajes',
        query: _ultimoId == 0
            ? {'ultimos': ultimosIniciales}
            : {'desde': _ultimoId, 'limit': 50},
      );
      if (resp is List && resp.isNotEmpty) {
        await DatabaseHelper.instance.guardarMensajes(resp);
        // La bandeja se pinta **desde el dispositivo**: el orden y los filtros no
        // dependen del orden en que llegó cada lote.
        await cargarLocal();
      }
    } catch (_) {
      // Silencioso: se reintenta en el próximo ciclo.
    } finally {
      _enCurso = false;
    }
  }

  /// Marca un mensaje como leído (local primero, aviso al servidor después).
  Future<void> marcarLeido(int id) async {
    await DatabaseHelper.instance.marcarMensajesLeidosLocal([id]);
    final indice = _mensajes.indexWhere((m) => m['id_mensaje'] == id);
    if (indice >= 0) _mensajes[indice] = {..._mensajes[indice], 'leido': true};
    _noLeidos = await DatabaseHelper.instance.contarMensajesNoLeidos();
    notifyListeners();
    try {
      await ApiClient.post('/mensajes/$id/leido');
    } catch (_) {
      // Best-effort: el «leído» queda pegajoso en el dispositivo.
    }
  }

  /// Marca como leídos **todos** los pendientes (RF-APK-05). Devuelve cuántos.
  Future<int> marcarTodosLeidos() async {
    final ids = _mensajes
        .where((m) => m['leido'] != true)
        .map((m) => m['id_mensaje'])
        .whereType<int>()
        .toList();
    if (ids.isEmpty) return 0;
    await DatabaseHelper.instance.marcarMensajesLeidosLocal(ids);
    for (var i = 0; i < _mensajes.length; i++) {
      if (_mensajes[i]['leido'] != true) {
        _mensajes[i] = {..._mensajes[i], 'leido': true};
      }
    }
    _noLeidos = 0;
    notifyListeners();
    try {
      await ApiClient.post('/mensajes/leidos', data: {'ids': ids});
    } catch (_) {
      // Best-effort.
    }
    return ids.length;
  }

  // ------------------------------------------------------------------------- #
  // Ayudas puras (probables sin dispositivo ni red)
  // ------------------------------------------------------------------------- #

  /// Ordena la bandeja del más reciente al más antiguo (DEC-4).
  static List<Map<String, dynamic>> ordenarMasRecientePrimero(
    List<Map<String, dynamic>> items,
  ) {
    final copia = List<Map<String, dynamic>>.from(items);
    copia.sort((a, b) => _idDe(b).compareTo(_idDe(a)));
    return copia;
  }

  /// Filtra por tipo y por leído/no leído (RF-APK-05 · DEC-2: sin borrado).
  static List<Map<String, dynamic>> filtrar(
    List<Map<String, dynamic>> items, {
    Set<String>? tipos,
    bool soloNoLeidos = false,
  }) {
    return items.where((m) {
      if (soloNoLeidos && m['leido'] == true) return false;
      if (tipos != null && tipos.isNotEmpty && !tipos.contains('${m['tipo']}')) {
        return false;
      }
      return true;
    }).toList();
  }

  /// Rótulo del día para agrupar la bandeja: «Hoy», «Ayer» o `dd/mm/aaaa`.
  static String etiquetaDia(DateTime fecha, {DateTime? ahora}) {
    final hoy = ahora ?? DateTime.now();
    final dia = DateTime(fecha.year, fecha.month, fecha.day);
    final referencia = DateTime(hoy.year, hoy.month, hoy.day);
    final diferencia = referencia.difference(dia).inDays;
    if (diferencia == 0) return 'Hoy';
    if (diferencia == 1) return 'Ayer';
    String dos(int v) => v.toString().padLeft(2, '0');
    return '${dos(dia.day)}/${dos(dia.month)}/${dia.year}';
  }

  /// Fecha de creación de un mensaje (o `null` si viene ilegible).
  static DateTime? fechaDe(Map<String, dynamic> mensaje) {
    final crudo = '${mensaje['creado_en'] ?? ''}';
    return crudo.isEmpty ? null : DateTime.tryParse(crudo)?.toLocal();
  }

  static int _idDe(Map<String, dynamic> m) => (m['id_mensaje'] as int?) ?? 0;

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }
}
