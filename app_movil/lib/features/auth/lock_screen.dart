import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/constants.dart';
import '../../core/theme.dart';
import 'auth_provider.dart';
import 'credencial_service.dart';
import 'lock_controller.dart';

/// Pantalla de **bloqueo** por inactividad (D-117).
///
/// Se superpone a la aplicación (no es una ruta) y **no cierra la sesión**: pide
/// el PIN local para volver a la misma pantalla. Si el PIN sigue siendo el de
/// fábrica, exige cambiarlo antes de desbloquear, igual que el acceso sin
/// conexión.
///
/// D-120: si el técnico **olvidó el PIN**, puede desbloquear con su **clave de
/// sesión** (se valida contra el servidor) y el PIN vuelve al de fábrica para no
/// quedarse fuera de la app; también puede cerrar la sesión y volver al acceso.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  final _pinController = TextEditingController();
  final _nuevoController = TextEditingController();
  final _confirmarController = TextEditingController();
  final _claveController = TextEditingController();

  bool _cambiando = false;
  bool _enviando = false;
  /// D-120: formulario de **clave de sesión** (alternativa al PIN olvidado).
  bool _usandoClave = false;
  bool _claveVisible = false;
  String? _error;

  @override
  void dispose() {
    _pinController.dispose();
    _nuevoController.dispose();
    _confirmarController.dispose();
    _claveController.dispose();
    super.dispose();
  }

  Future<void> _desbloquear() async {
    final auth = context.read<AuthProvider>();
    final lock = context.read<LockController>();
    final p00 = auth.p00;
    setState(() => _error = null);

    if (p00 == null || p00.trim().isEmpty) {
      setState(() => _error = 'No hay una sesión que desbloquear.');
      return;
    }
    final formato = validarFormatoPin(_pinController.text);
    if (formato != null) {
      setState(() => _error = formato);
      return;
    }

    setState(() => _enviando = true);
    final resultado = await auth.verificarPinLocal(p00, _pinController.text);
    if (!mounted) return;
    setState(() => _enviando = false);

    if (resultado.concedido) {
      lock.desbloquear();
      return;
    }
    if (resultado.exigeCambio) {
      setState(() {
        _cambiando = true;
        _error = resultado.mensaje;
      });
      return;
    }
    setState(() => _error = resultado.mensaje);
  }

  Future<void> _guardarNuevoPin() async {
    final auth = context.read<AuthProvider>();
    final lock = context.read<LockController>();
    final p00 = auth.p00;
    setState(() => _error = null);
    if (p00 == null) {
      setState(() => _error = 'No hay una sesión que desbloquear.');
      return;
    }

    final problema = validarPinNuevo(
      nuevo: _nuevoController.text,
      confirmacion: _confirmarController.text,
      actual: _pinController.text,
    );
    if (problema != null) {
      setState(() => _error = problema);
      return;
    }

    setState(() => _enviando = true);
    final fallo = await auth.cambiarPinLocal(p00, _nuevoController.text);
    if (!mounted) return;
    setState(() => _enviando = false);
    if (fallo != null) {
      setState(() => _error = fallo);
      return;
    }
    lock.desbloquear();
  }

  void _volverAlPin() {
    setState(() {
      _cambiando = false;
      _usandoClave = false;
      _error = null;
      _nuevoController.clear();
      _confirmarController.clear();
      _claveController.clear();
    });
  }

  /// D-120: desbloquea con la **clave de sesión** (la del acceso a la app).
  ///
  /// Se valida contra el servidor con `auth.login` (el token se renueva y la
  /// credencial sin conexión también). Como el PIN es justo lo que se olvidó, se
  /// deja de nuevo en el de **fábrica** para que el técnico recupere también el
  /// acceso sin conexión; la app pedirá cambiarlo la próxima vez que lo use.
  Future<void> _desbloquearConClave() async {
    final auth = context.read<AuthProvider>();
    final lock = context.read<LockController>();
    final mensajeria = ScaffoldMessenger.of(context);
    final p00 = auth.p00;
    setState(() => _error = null);

    if (p00 == null || p00.trim().isEmpty) {
      setState(() => _error = 'No hay una sesión que desbloquear.');
      return;
    }
    if (_claveController.text.trim().isEmpty) {
      setState(() => _error = 'Escriba su clave de sesión.');
      return;
    }

    setState(() => _enviando = true);
    final error = await auth.login(p00, _claveController.text);
    if (!mounted) return;
    setState(() => _enviando = false);

    if (error != null) {
      setState(() {
        _error = auth.ultimoErrorEsDeRed
            ? 'Sin conexión: para desbloquear con la clave necesita internet. '
              'Use su PIN o conéctese.'
            : '$error Si no recuerda la clave, use «Cerrar sesión» y recupere la '
              'cuenta con sus 3 palabras.';
      });
      return;
    }

    // El PIN olvidado vuelve al de fábrica (824605) y se pedirá cambiarlo.
    await auth.restablecerPinLocal(p00);
    if (!mounted) return;
    _claveController.clear();
    lock.desbloquear();
    mensajeria.showSnackBar(
      const SnackBar(
        content: Text(
          'Desbloqueado con su clave. El PIN volvió al de fábrica: '
          'cámbielo en Perfil y seguridad.',
        ),
      ),
    );
  }

  /// D-120: cierra la sesión y vuelve al acceso (siempre funciona, con o sin red).
  Future<void> _cerrarSesion() async {
    final auth = context.read<AuthProvider>();
    final lock = context.read<LockController>();
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('Cerrar la sesión'),
        content: const Text(
          'Se cerrará la sesión y volverá a la pantalla de acceso. Los casos '
          'descargados y las acciones sin enviar se conservan en el dispositivo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(contexto, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(contexto, true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (confirmado != true || !mounted) return;
    await auth.cerrarSesion();
    lock.desbloquear();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (ruta) => false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final nombre = auth.nombre.trim().isEmpty ? 'Técnico' : auth.nombre;

    return Material(
      color: Marca.fondo,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 76,
                      height: 76,
                      decoration: const BoxDecoration(
                        color: Marca.azul,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Icon(Icons.lock_outline, color: Colors.white, size: 38),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Sesión bloqueada',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    nombre,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Marca.azul,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Ingrese su PIN para volver a la aplicación.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13.5, color: Marca.textoSuave),
                  ),
                  const SizedBox(height: 22),
                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Marca.errorClaro,
                        border: Border.all(color: Marca.error.withOpacity(0.35)),
                        borderRadius: BorderRadius.circular(Marca.radioControl),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: Marca.error, fontSize: 13),
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],
                  if (_usandoClave) ...[
                    // D-120: desbloqueo con la clave de sesión (PIN olvidado).
                    TextField(
                      key: const Key('lock-clave'),
                      controller: _claveController,
                      autofocus: true,
                      obscureText: !_claveVisible,
                      textInputAction: TextInputAction.done,
                      decoration: InputDecoration(
                        labelText: 'Clave de sesión',
                        helperText: '3 intentos incorrectos bloquean la cuenta.',
                        helperMaxLines: 2,
                        prefixIcon: const Icon(Icons.key_outlined),
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          icon: Icon(_claveVisible
                              ? Icons.visibility_off
                              : Icons.visibility),
                          tooltip: _claveVisible ? 'Ocultar' : 'Mostrar',
                          onPressed: () =>
                              setState(() => _claveVisible = !_claveVisible),
                        ),
                      ),
                      onSubmitted: (_) => _enviando ? null : _desbloquearConClave(),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton.icon(
                        key: const Key('lock-desbloquear-clave'),
                        icon: const Icon(Icons.lock_open),
                        label: Text(_enviando ? 'Verificando…' : 'Desbloquear con mi clave'),
                        onPressed: _enviando ? null : _desbloquearConClave,
                      ),
                    ),
                    TextButton(
                      onPressed: _enviando ? null : _volverAlPin,
                      child: const Text('Volver al PIN'),
                    ),
                  ] else if (!_cambiando) ...[
                    TextField(
                      key: const Key('lock-pin'),
                      controller: _pinController,
                      autofocus: true,
                      obscureText: true,
                      keyboardType: TextInputType.number,
                      maxLength: AppConstants.pinLongitud,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(
                        labelText: 'PIN',
                        hintText: '••••••',
                        counterText: '',
                        prefixIcon: Icon(Icons.password),
                        border: OutlineInputBorder(),
                      ),
                      onSubmitted: (_) => _enviando ? null : _desbloquear(),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton.icon(
                        key: const Key('lock-desbloquear'),
                        icon: const Icon(Icons.lock_open),
                        label: Text(_enviando ? 'Verificando…' : 'Desbloquear'),
                        onPressed: _enviando ? null : _desbloquear,
                      ),
                    ),
                    // D-120: el técnico que olvidó el PIN no queda encerrado.
                    TextButton.icon(
                      key: const Key('lock-usar-clave'),
                      icon: const Icon(Icons.key_outlined),
                      label: const Text('Olvidé el PIN: usar mi clave'),
                      onPressed: _enviando
                          ? null
                          : () => setState(() {
                                _usandoClave = true;
                                _error = null;
                              }),
                    ),
                  ] else ...[
                    const Text(
                      'Su PIN es el de fábrica. Defina uno propio para desbloquear.',
                      style: TextStyle(fontSize: 13, color: Marca.textoSuave),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      key: const Key('lock-nuevo'),
                      controller: _nuevoController,
                      obscureText: true,
                      keyboardType: TextInputType.number,
                      maxLength: AppConstants.pinLongitud,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(
                        labelText: 'PIN nuevo',
                        counterText: '',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      key: const Key('lock-confirmar'),
                      controller: _confirmarController,
                      obscureText: true,
                      keyboardType: TextInputType.number,
                      maxLength: AppConstants.pinLongitud,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(
                        labelText: 'Confirmar PIN nuevo',
                        counterText: '',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton.icon(
                        key: const Key('lock-guardar'),
                        icon: const Icon(Icons.save_outlined),
                        label: Text(_enviando ? 'Guardando…' : 'Guardar PIN y desbloquear'),
                        onPressed: _enviando ? null : _guardarNuevoPin,
                      ),
                    ),
                    TextButton(
                      onPressed: _enviando ? null : _volverAlPin,
                      child: const Text('Volver'),
                    ),
                  ],
                  const SizedBox(height: 18),
                  const Text(
                    'El PIN solo desbloquea la pantalla o abre la app sin internet; '
                    'la sesión no se cierra.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Marca.textoSuave),
                  ),
                  const SizedBox(height: 6),
                  // D-120: salida de emergencia (funciona sin conexión).
                  TextButton.icon(
                    key: const Key('lock-cerrar-sesion'),
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('Cerrar sesión'),
                    onPressed: _enviando ? null : _cerrarSesion,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
