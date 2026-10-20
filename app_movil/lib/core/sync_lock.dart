import 'dart:async';

/// Cerrojo de las operaciones de sincronización (D-124 · H-07).
///
/// La cola offline la consumían **dos** caminos a la vez —el envío automático de
/// cada 5 minutos (`SyncProvider.sincronizar`) y la CARGA (`UploadService.cargar`,
/// dentro de `/sync/carga`)— sin ningún cerrojo compartido: la misma acción podía
/// salir dos veces (dos cierres y doble juego de evidencias).
///
/// Con este cerrojo:
///   · una operación de **usuario** (CARGA) espera su turno (`ejecutar`);
///   · el **envío automático** no espera: si hay algo en curso se salta esta
///     vuelta (`intentar` devuelve `null`) y lo intentará en la siguiente.
///
/// Es un singleton de proceso: la app tiene una sola base local y un solo
/// dispositivo, de modo que un cerrojo en memoria es suficiente.
class SyncLock {
  SyncLock._();

  static final SyncLock instance = SyncLock._();

  Future<void>? _enCurso;

  /// ¿Hay una operación de sincronización en curso?
  bool get ocupado => _enCurso != null;

  /// Ejecuta [accion] en exclusiva; si hay otra en curso, **espera** a que acabe.
  Future<T> ejecutar<T>(Future<T> Function() accion) async {
    while (_enCurso != null) {
      await _enCurso;
    }
    final turno = Completer<void>();
    _enCurso = turno.future;
    try {
      return await accion();
    } finally {
      _enCurso = null;
      if (!turno.isCompleted) turno.complete();
    }
  }

  /// Intenta ejecutar [accion] **sin esperar**: si hay otra en curso, `null`.
  Future<T?> intentar<T>(Future<T> Function() accion) {
    if (_enCurso != null) return Future<T?>.value();
    return ejecutar(accion);
  }
}
