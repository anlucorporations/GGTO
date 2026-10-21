import 'package:flutter/material.dart';

import '../../core/api_error.dart';
import '../../core/database.dart';
import '../sync/download_service.dart';
import 'acciones_caso.dart';

/// Lista de casos del técnico, con caché local para operar sin conexión.
///
/// D-73: la carga usa `DownloadService` (DESCARGA diferencial por cuadrilla) en
/// lugar de leer el listado global `/casos`.
///
/// D-82: el **contenido local** (SQLite) es la fuente de la lista. Cualquier
/// carga —con o sin conexión— vuelca la caché del dispositivo en pantalla, de
/// modo que el técnico siempre ve sus casos aunque la descarga falle.
///
/// D-101: el listado principal esconde los casos **ya gestionados** (cerrado,
/// enrutado, diferido, citado o cancelado); el técnico puede volver a verlos con
/// [alternarGestionados].
class CasosProvider extends ChangeNotifier {
  List<Map<String, dynamic>> _casos = [];
  bool _cargando = false;
  bool _desdeCache = false;
  bool _verGestionados = false;
  // D-144: filtro de estado del listado (TODOS / ABIERTOS / CERRADOS).
  String _filtroEstado = filtroTodos;
  String? _error;
  String _consulta = '';
  DateTime? _actualizadoEn;
  DateTime? _sincronizadoEn;
  int _total = 0;
  // D-83: explicación del servidor sobre la última descarga.
  String _motivo = '';
  String _mensajeServidor = '';
  String? _cuadrillaCodigo;
  int _casosCuadrilla = 0;

  List<Map<String, dynamic>> get casos => _casos;
  bool get cargando => _cargando;

  /// ¿El técnico pidió ver también los casos ya gestionados? (D-101)
  bool get verGestionados => _verGestionados;

  /// Cuántos casos de la caché ya están gestionados.
  int get gestionados =>
      _casos.where((c) => estaGestionado('${c['estado_actual'] ?? ''}')).length;

  /// Cuántos casos quedan pendientes (los que ve el listado por defecto).
  int get pendientes => _casos.length - gestionados;

  /// Casos que pinta el **listado principal**: los pendientes y, si el técnico
  /// activó el conmutador, también los gestionados (D-101).
  ///
  /// D-144: con texto de búsqueda se mira **todo** el universo y el filtro de
  /// estado permite ver solo los cerrados.
  List<Map<String, dynamic>> get casosVisibles => casosVisiblesDe(
        _casos,
        verGestionados: _verGestionados,
        filtroEstado: _filtroEstado,
        consulta: _consulta,
      );

  /// Filtro de estado activo (`TODOS`, `ABIERTOS` o `CERRADOS`).
  String get filtroEstado => _filtroEstado;

  /// Cuántos casos del dispositivo están **cerrados** (D-144).
  int get cerrados => _casos
      .where((c) => '${c['estado_actual'] ?? ''}'.trim().toUpperCase() == 'CERRADO')
      .length;

  /// Cambia el filtro de estado del listado (D-144).
  void cambiarFiltroEstado(String filtro) {
    _filtroEstado = filtro;
    notifyListeners();
  }

  /// Muestra u oculta los casos ya gestionados.
  void alternarGestionados() {
    _verGestionados = !_verGestionados;
    notifyListeners();
  }

  /// `true` cuando la última descarga contra el servidor falló: lo que se ve en
  /// pantalla es el contenido local guardado.
  bool get desdeCache => _desdeCache;
  String? get error => _error;
  String get consulta => _consulta;

  /// Motivo devuelto por el servidor en la última descarga (`OK`, `SIN_CUADRILLA`,
  /// `CUADRILLA_GESTION`, `SIN_DESPACHO`, `SIN_PENDIENTES`, `SIN_CAMBIOS`…).
  String get motivoServidor => _motivo;

  /// Mensaje del servidor que explica por qué no hay casos (D-83).
  String get mensajeServidor => _mensajeServidor;

  /// Cuadrilla que el servidor resolvió para este usuario (p. ej. `C-001`).
  String? get cuadrillaCodigo => _cuadrillaCodigo;

  /// Casos despachados que el servidor tiene para esa cuadrilla.
  int get casosCuadrilla => _casosCuadrilla;

  /// Explicación para la pantalla cuando el dispositivo no tiene casos: usa el
  /// mensaje del servidor y, si no lo hay, el texto genérico.
  String get explicacionSinCasos {
    if (_mensajeServidor.isNotEmpty) return _mensajeServidor;
    if (_error != null) return _error!;
    return 'No tiene casos asignados en este momento.';
  }

  /// Fecha del contenido local (la última descarga con éxito).
  DateTime? get actualizadoEn => _actualizadoEn;

  /// Fecha del último intento de sincronización (haya funcionado o no).
  DateTime? get sincronizadoEn => _sincronizadoEn;
  int get total => _total;
  /// ¿No hay nada que pintar en el listado? (D-101: cuenta lo **visible**).
  bool get vacio => !_cargando && casosVisibles.isEmpty;

  /// El dispositivo **sí** tiene casos, pero todos están gestionados: el listado
  /// queda vacío solo porque el conmutador está apagado.
  bool get todoGestionado =>
      !_cargando && casosVisibles.isEmpty && _casos.isNotEmpty;

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
      await aplicarDescarga(resultado);
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

  /// D-115: aplica a la lista un resultado de DESCARGA ya ejecutado por la
  /// **actualización completa** (sin volver a descargar).
  ///
  /// Deja el mensaje del servidor, la cuadrilla y los casos descartados por la
  /// purga, y vuelca la caché local actualizada.
  Future<void> aplicarDescarga(ResultadoDescarga resultado) async {
    _actualizadoEn = resultado.serverTs ?? DateTime.now();
    _motivo = resultado.motivo;
    // D-104/D-115: si la purga descartó casos no atendidos, se dice.
    _mensajeServidor = resultado.descartados > 0
        ? '${resultado.mensaje} Se descartaron ${resultado.descartados} '
            'caso(s) no atendidos de jornadas anteriores.'
        : resultado.mensaje;
    _cuadrillaCodigo = resultado.cuadrillaCodigo;
    _casosCuadrilla = resultado.casosCuadrilla;
    _desdeCache = false;
    _error = null;
    _sincronizadoEn = DateTime.now();
    await _leerLocal();
    notifyListeners();
  }

  /// Búsqueda **local** sobre la caché del dispositivo (D-117).
  ///
  /// El panel principal no toca la red: filtra lo que ya está guardado. La
  /// descarga de casos se hace en la sección **Sincronizar**.
  Future<void> buscar(String consulta) async {
    _consulta = consulta;
    await _leerLocal();
    notifyListeners();
  }

  Future<void> limpiarBusqueda() async {
    _consulta = '';
    await _leerLocal();
    notifyListeners();
  }

  /// Casos de la caché local sin tocar la red ni marcar «sin conexión» (D-84).
  ///
  /// Se usa al abrir la pantalla y al volver de la ficha: leer el dispositivo no
  /// es sincronizar —la descarga solo ocurre cuando el técnico la pide— y este
  /// camino **no** pinta la franja de «sin conexión».
  Future<void> refrescarLocal() async {
    await _leerLocal();
    notifyListeners();
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
