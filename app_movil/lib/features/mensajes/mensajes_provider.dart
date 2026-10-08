import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';

/// Mensajería interna (D-81 · RF-41) en la APK.
///
/// D-84 (RF-APK-02): sondeo **cada 60 s** (antes 20 s) y **solo con la app en
/// primer plano**. Es la única pieza que se sincroniza sola: los casos dependen
/// de las funciones CARGA y DESCARGA (DEC-3).
class MensajesProvider extends ChangeNotifier with WidgetsBindingObserver {
  /// Periodo del sondeo automático (RF-APK-02).
  static const Duration intervaloSondeo = Duration(seconds: 60);

  Timer? _timer;
  final List<Map<String, dynamic>> _mensajes = [];
  int _noLeidos = 0;
  int _ultimoId = 0;
  bool _enCurso = false;
  bool _enPrimerPlano = true;

  List<Map<String, dynamic>> get mensajes => _mensajes;
  int get noLeidos => _noLeidos;

  /// Arranca el sondeo (idempotente). Solo corre en primer plano.
  void iniciar() {
    WidgetsBinding.instance.addObserver(this);
    _timer ??= Timer.periodic(intervaloSondeo, (_) => _sondearSiAplica());
    _sondearSiAplica();
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

  Future<void> sondear() async {
    if (_enCurso) return;
    _enCurso = true;
    try {
      final resp = await ApiClient.get(
        '/mensajes',
        query: {'desde': _ultimoId, 'limit': 50},
      );
      if (resp is List && resp.isNotEmpty) {
        for (final m in resp) {
          if (m is! Map) continue;
          final mapa = Map<String, dynamic>.from(m);
          _mensajes.add(mapa);
          final id = (mapa['id_mensaje'] as int?) ?? 0;
          if (id > _ultimoId) _ultimoId = id;
          if (mapa['leido'] == false) _noLeidos++;
        }
        notifyListeners();
      }
    } catch (_) {
      // Silencioso: se reintenta en el próximo ciclo.
    } finally {
      _enCurso = false;
    }
  }

  Future<void> marcarLeido(int id) async {
    for (final m in _mensajes) {
      if (m['id_mensaje'] == id && m['leido'] == false) {
        m['leido'] = true;
        if (_noLeidos > 0) _noLeidos--;
      }
    }
    notifyListeners();
    try {
      await ApiClient.post('/mensajes/$id/leido');
    } catch (_) {
      // Best-effort.
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }
}
