import 'package:flutter/material.dart';

import '../../core/api_error.dart';
import '../../core/database.dart';
import '../sync/download_service.dart';

/// Lista de casos del técnico, con caché local para operar sin conexión.
///
/// D-73: la carga ahora usa `DownloadService` (DESCARGA diferencial por
/// cuadrilla) en lugar de leer el listado global `/casos`.
class CasosProvider extends ChangeNotifier {
  List<Map<String, dynamic>> _casos = [];
  bool _cargando = false;
  bool _desdeCache = false;
  String? _error;
  String _consulta = '';
  DateTime? _actualizadoEn;
  int _total = 0;

  List<Map<String, dynamic>> get casos => _casos;
  bool get cargando => _cargando;
  bool get desdeCache => _desdeCache;
  String? get error => _error;
  String get consulta => _consulta;
  DateTime? get actualizadoEn => _actualizadoEn;
  int get total => _total;
  bool get vacio => !_cargando && _casos.isEmpty;

  /// Descarga los casos asignados a la cuadrilla del técnico logueado.
  Future<void> cargar({String? consulta, bool silencioso = false}) async {
    _consulta = consulta ?? _consulta;
    if (!silencioso) {
      _cargando = true;
      _error = null;
      notifyListeners();
    }

    try {
      final resultado = await DownloadService.descargar();
      _actualizadoEn = resultado.serverTs ?? DateTime.now();
      _error = null;
    } on ApiError catch (error) {
      await _servirCache(error);
    } catch (error) {
      await _servirCache(ApiError.desconocido(error));
    } finally {
      _cargando = false;
      notifyListeners();
    }
  }

  /// Consulta combinada: intenta el servidor y, si falla, filtra la caché local.
  Future<void> buscar(String consulta) => cargar(consulta: consulta);

  Future<void> limpiarBusqueda() async {
    _consulta = '';
    await cargar();
  }

  /// Casos de la caché local sin tocar la red.
  Future<void> cargarDesdeCache({String? consulta}) async {
    final locales = await DatabaseHelper.instance.leerCasos(consulta: consulta ?? _consulta);
    _casos = locales;
    _total = locales.length;
    _desdeCache = true;
    _actualizadoEn = await DatabaseHelper.instance.ultimaDescarga();
    notifyListeners();
  }

  /// Actualiza un caso con la respuesta del servidor (tras un cambio de estado).
  Future<void> actualizarCaso(Map<String, dynamic> caso) async {
    final idAveria = '${caso['id_averia'] ?? ''}';
    if (idAveria.isEmpty) return;
    final indice = _casos.indexWhere((c) => '${c['id_averia']}' == idAveria);
    if (indice >= 0) {
      _casos[indice] = caso;
    } else {
      _casos.insert(0, caso);
    }
    await DatabaseHelper.instance.actualizarCasoLocal(caso);
    notifyListeners();
  }

  /// Aplica localmente un estado mientras la acción espera en la cola offline.
  void aplicarEstadoLocal(String idAveria, String estado) {
    final indice = _casos.indexWhere((c) => '${c['id_averia']}' == idAveria);
    if (indice < 0) return;
    _casos[indice] = {..._casos[indice], 'estado_actual': estado, 'pendiente_sync': true};
    notifyListeners();
  }

  Future<void> _servirCache(ApiError error) async {
    _error = error.mensaje;
    final locales = await DatabaseHelper.instance.leerCasos(consulta: _consulta);
    if (locales.isNotEmpty) {
      _casos = locales;
      _total = locales.length;
      _desdeCache = true;
      _actualizadoEn = await DatabaseHelper.instance.ultimaDescarga();
    } else {
      // Sin caché y sin red: se deja la lista vacía pero con el error visible.
      _casos = [];
      _desdeCache = error.esDeRed;
    }
  }
}
