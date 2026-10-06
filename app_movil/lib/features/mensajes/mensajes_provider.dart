import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';

/// Mensajería interna (D-81 · RF-41) en la APK.
///
/// Sondeo **incremental cada 20 s** (única pieza del sistema con ese periodo).
class MensajesProvider extends ChangeNotifier {
  Timer? _timer;
  final List<Map<String, dynamic>> _mensajes = [];
  int _noLeidos = 0;
  int _ultimoId = 0;
  bool _enCurso = false;

  List<Map<String, dynamic>> get mensajes => _mensajes;
  int get noLeidos => _noLeidos;

  /// Arranca el sondeo de 20 s (idempotente).
  void iniciar() {
    _timer ??= Timer.periodic(const Duration(seconds: 20), (_) => sondear());
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
    _timer?.cancel();
    super.dispose();
  }
}
