import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants.dart';
import 'auth_provider.dart';

/// Pantalla de acceso (§4.0): P00 + clave, con bloqueo a los 3 intentos.
///
/// Los mensajes de error son los del servidor (401/403/423/429/5xx) y los fallos
/// de red **no** consumen intentos (H-15/H-16).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _p00Controller = TextEditingController();
  final _claveController = TextEditingController();
  final _claveFocus = FocusNode();

  String? _error;
  bool _verClave = false;

  @override
  void dispose() {
    _p00Controller.dispose();
    _claveController.dispose();
    _claveFocus.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _error = null);

    final p00 = _p00Controller.text.trim();
    if (p00.isEmpty || _claveController.text.isEmpty) {
      setState(() => _error = 'Indique el P00 y la clave.');
      return;
    }

    final error = await auth.login(p00, _claveController.text);
    if (!mounted) return;

    if (error == null) {
      Navigator.pushReplacementNamed(context, '/casos');
      return;
    }

    setState(() => _error = error);
    if (auth.bloqueado) {
      // La cuenta quedó bloqueada: se ofrece el desbloqueo con 3 palabras.
      Navigator.pushNamed(context, '/unlock', arguments: {'p00': p00});
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight - 40),
              child: Column(
                // El Spacer() del pie exige `start`; el centrado vertical se
                // logra con los SizedBox superiores.
                mainAxisAlignment: MainAxisAlignment.start,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Marca institucional centrada (D-73).
                  Image.asset(
                    'assets/logo_CANTV.webp',
                    height: 96,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'PLANTA EXTERNA GPON',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Ingrese su P00 y su clave',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14),
                  ),
                  const SizedBox(height: 24),

                  if (_error != null) ...[
                    _AvisoError(mensaje: _error!),
                    const SizedBox(height: 12),
                  ],

                  TextField(
                    controller: _p00Controller,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'P00',
                      hintText: 'Su código de personal',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _claveFocus.requestFocus(),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _claveController,
                    focusNode: _claveFocus,
                    obscureText: !_verClave,
                    decoration: InputDecoration(
                      labelText: 'Clave',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        icon: Icon(_verClave ? Icons.visibility_off : Icons.visibility),
                        tooltip: _verClave ? 'Ocultar clave' : 'Mostrar clave',
                        onPressed: () => setState(() => _verClave = !_verClave),
                      ),
                    ),
                    onSubmitted: (_) => _login(),
                  ),

                  if (auth.intentosFallidos > 0 && !auth.bloqueado) ...[
                    const SizedBox(height: 10),
                    Text(
                      'Intentos restantes: ${auth.intentosRestantes} de ${AppConstants.maxIntentos}',
                      style: const TextStyle(color: Colors.orange, fontWeight: FontWeight.w600),
                    ),
                  ],

                  const SizedBox(height: 22),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: auth.cargando ? null : _login,
                      child: Text(auth.cargando ? 'Ingresando…' : 'Ingresar'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => Navigator.pushNamed(context, '/unlock'),
                    child: const Text('Desbloquear con 3 palabras'),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pushNamed(context, '/primer-acceso'),
                    child: const Text('Primer acceso'),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Versión ${AppConstants.version}',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  const Spacer(),
                  const Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: Text(
                      'APK en Desarrollo - Desarrollado por ING. Angel Lucci - '
                      'Uso confidencial de CANTV-GGTO - 2026',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11, color: Colors.black54),
                    ),
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

/// Aviso de error reutilizable en las pantallas de campo.
class _AvisoError extends StatelessWidget {
  const _AvisoError({required this.mensaje});

  final String mensaje;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFEBEE),
        border: Border.all(color: const Color(0xFFE57373)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, color: Color(0xFFC62828), size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              mensaje,
              style: const TextStyle(color: Color(0xFFB71C1C), fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}
