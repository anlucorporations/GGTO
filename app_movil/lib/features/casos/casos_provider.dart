import 'package:flutter/material.dart';

import '../../core/api_error.dart';
import '../../core/database.dart';
import '../sync/download_service.dart';

/// Lista de casos del técnico, con caché local para operar sin conexión.
///
/// D-73: la carga usa `DownloadService` (DESCARGA diferencial por cuadrilla) en
/// lugar de leer el listado global `/casos`.
///
/// D-82: el **contenido local** (SQLite) es la fuente de la lista. Cualquier
/// carga —con o sin conexión— vuelca la caché del dispositivo en pantalla, de
/// modo que el técnico siempre ve sus casos aunque la descarga falle.
class CasosProvider extends ChangeNotifier {
  List<Map<String, dynamic>> _casos = [];
  bool _cargando = false;
  bool _desdeCache = false;
  String? _error;
  String _consulta = '';
  DateTime? _actualizadoEn;
  DateTime? _sincronizadoEn;
  int _total = 0;

  List<Map<String, dynamic>> get casos => _casos;
  bool get cargando => _cargando;

  /// `true` cuando la última descarga contra el servidor falló: lo que se ve en
  /// pantalla es el contenido local guardado.
  bool get desdeCache => _desdeCache;
  String? get error => _error;
  String get consulta => _consulta;

  /// Fecha del contenido local (la última descarga con éxito).
  DateTime? get actualizadoEn => _actualizadoEn;

  /// Fecha del último intento de sincronización (haya funcionado o no).
  DateTime? get sincronizadoEn => _sincronizadoEn;
  int get total => _total;
  bool get vacio => !_cargando && _casos.isEmpty;

  /// Cuántos casos hay guardados en el dispositivo.
  int get locales => _casos.length;

  /// Descarga los casos asignados a la cuadrilla del técnico logueado y, en
  /// cualquier caso, muestra el contenido local guardado en el dispositivo.
  Future<void> cargar({
    String? consulta,
    bool silencioso = false,
    void Function(String fase, double valor)? onProgreso,
  }) async {
    _consulta = consulta ?? _consulta;
    if (!silencioso) {
      _cargando = true;
      _error = null;
      notifyListeners();
    }

    try {
      onProgreso?.call('Descargando los casos de mi cuadrilla…', 0.05);
      final resultado = await DownloadService.descargar(onProgreso: onProgreso);
      _actualizadoEn = resultado.serverTs ?? DateTime.now();
      _desdeCache = false;
      _error = null;
    } on ApiError catch (error) {
      _desdeCache = true;
      _error = error.mensaje;
    } catch (error) {
      _desdeCache = true;
      _error = ApiError.desconocido(error).mensaje;
    } finally {
      _sincronizadoEn = DateTime.now();
      // El contenido que se pinta es SIEMPRE el del dispositivo (SQLite): la
      // descarga solo lo actualiza.
      await _leerLocal();
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
    _consulta = consulta ?? _consulta;
    _desdeCache = true;
    await _leerLocal();
    notifyListeners();
  }

  /// Vuelca la caché local en la lista visible.
  Future<void> _leerLocal() async {
    final locales = await DatabaseHelper.instance.leerCasos(consulta: _consulta);
    _casos = locales;
    _total = locales.length;
    _actualizadoEn ??= await DatabaseHelper.instance.ultimaDescarga();
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
}
