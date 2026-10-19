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
class LockScreen extends StatefulWidget {
  const LockScreen({super.key});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  final _pinController = TextEditingController();
  final _nuevoController = TextEditingController();
  final _confirmarController = TextEditingController();

  bool _cambiando = false;
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _pinController.dispose();
    _nuevoController.dispose();
    _confirmarController.dispose();
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
      _error = null;
      _nuevoController.clear();
      _confirmarController.clear();
    });
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
                  if (!_cambiando) ...[
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
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
