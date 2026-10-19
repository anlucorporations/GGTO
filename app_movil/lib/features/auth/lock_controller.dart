import 'package:flutter/foundation.dart';

/// Estado del **bloqueo de pantalla** por inactividad (D-117).
///
/// No cierra la sesión: solo cubre la interfaz con la pantalla de bloqueo hasta
/// que el técnico introduce su PIN. La sesión, el token y los datos locales
/// siguen intactos.
class LockController extends ChangeNotifier {
  bool _bloqueado = false;

  bool get bloqueado => _bloqueado;

  void bloquear() {
    if (_bloqueado) return;
    _bloqueado = true;
    notifyListeners();
  }

  void desbloquear() {
    if (!_bloqueado) return;
    _bloqueado = false;
    notifyListeners();
  }
}
