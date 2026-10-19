import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/constants.dart';
import '../features/auth/auth_provider.dart';
import '../features/auth/lock_controller.dart';
import '../features/auth/lock_screen.dart';

/// Bloquea la aplicación tras **2 minutos de inactividad** (D-117).
///
/// · No cierra la sesión: el `AuthProvider`, el token y los datos locales siguen
///   intactos; la pantalla de bloqueo pide el PIN y vuelve a la misma pantalla.
/// · Aplica a la sesión de **TÉCNICO**, que es la que tiene PIN local; los roles
///   de gestión no tienen credencial sin conexión.
/// · Se reinicia con cualquier toque y al volver del segundo plano, y comprueba
///   el tiempo transcurrido al reanudar la app (un temporizador de Android puede
///   quedar pausado).
class BloqueoInactividad extends StatefulWidget {
  const BloqueoInactividad({
    super.key,
    required this.child,
    this.duracion,
  });

  final Widget child;

  /// Duración inyectable para las pruebas; por defecto, 2 minutos.
  final Duration? duracion;

  @override
  State<BloqueoInactividad> createState() => _BloqueoInactividadState();
}

class _BloqueoInactividadState extends State<BloqueoInactividad>
    with WidgetsBindingObserver {
  Timer? _temporizador;
  DateTime _ultimaActividad = DateTime.now();
  AuthProvider? _auth;
  LockController? _lock;

  Duration get _duracion =>
      widget.duracion ?? const Duration(minutes: AppConstants.bloqueoInactividadMinutos);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ultimaActividad = DateTime.now();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = context.read<AuthProvider>();
    final lock = context.read<LockController>();
    if (!identical(_auth, auth)) {
      _auth?.removeListener(_programar);
      _auth = auth;
      auth.addListener(_programar);
    }
    if (!identical(_lock, lock)) {
      _lock?.removeListener(_programar);
      _lock = lock;
      lock.addListener(_programar);
    }
    _programar();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _temporizador?.cancel();
    _auth?.removeListener(_programar);
    _lock?.removeListener(_programar);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    final transcurrido = DateTime.now().difference(_ultimaActividad);
    if (transcurrido >= _duracion) {
      _bloquear();
    } else {
      _programarCon(_duracion - transcurrido);
    }
  }

  /// Arranca el temporizador si toca; no lo reinicia en cada notificación.
  void _programar() {
    final auth = _auth;
    final lock = _lock;
    if (auth == null || lock == null) return;
    if (!auth.sesionActiva || auth.rol != 'TECNICO') {
      _temporizador?.cancel();
      if (lock.bloqueado) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _lock?.desbloquear());
      }
      return;
    }
    if (lock.bloqueado || _temporizador?.isActive == true) return;
    _ultimaActividad = DateTime.now();
    _programarCon(_duracion);
  }

  void _programarCon(Duration restante) {
    _temporizador?.cancel();
    if (restante.isNegative || restante == Duration.zero) {
      _bloquear();
      return;
    }
    _temporizador = Timer(restante, _bloquear);
  }

  void _reiniciar() {
    if (_lock?.bloqueado == true) return;
    _ultimaActividad = DateTime.now();
    _programarCon(_duracion);
  }

  void _bloquear() {
    final auth = _auth;
    final lock = _lock;
    if (auth == null || lock == null) return;
    if (!auth.sesionActiva || auth.rol != 'TECNICO' || lock.bloqueado) return;
    lock.bloquear();
    _temporizador?.cancel();
  }

  @override
  Widget build(BuildContext context) {
    final lock = context.watch<LockController>();
    return Listener(
      onPointerDown: (_) => _reiniciar(),
      onPointerSignal: (_) => _reiniciar(),
      child: Stack(
        children: [
          widget.child,
          if (lock.bloqueado) const Positioned.fill(child: LockScreen()),
        ],
      ),
    );
  }
}
