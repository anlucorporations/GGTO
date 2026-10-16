import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants.dart';
import '../../core/credencial_local.dart';
import '../../core/theme.dart';
import 'auth_provider.dart';

/// Pantalla de acceso (§4.0): P00 + clave, con bloqueo a los 3 intentos.
///
/// Los mensajes de error son los del servidor (401/403/423/429/5xx) y los fallos
/// de red **no** consumen intentos (H-15/H-16).
///
/// D-100: si el acceso con clave falla **por falta de red** y hay una credencial
/// local del P00 indicado, se ofrece entrar con el **PIN sin conexión**. El
/// botón «Acceso sin conexión» permite ir directo a ese flujo.
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
  /// Credencial local del P00 escrito, para avisar del PIN de fábrica.
  CredencialLocal? _credencial;

  @override
  void dispose() {
    _p00Controller.dispose();
    _claveController.dispose();
    _claveFocus.dispose();
    super.dispose();
  }

  /// Consulta la credencial local del P00 tecleado (sin conexión).
  Future<void> _mirarCredencial() async {
    final p00 = _p00Controller.text.trim();
    if (p00.isEmpty) {
      if (_credencial != null) setState(() => _credencial = null);
      return;
    }
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final ficha = await auth.credencialDe(p00);
    if (!mounted) return;
    if (ficha?.p00 != _credencial?.p00) setState(() => _credencial = ficha);
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
      Navigator.pushReplacementNamed(context, '/inicio');
      return;
    }

    // D-100: sin red, si el técnico tiene credencial local se le ofrece el PIN.
    final ficha = await auth.credencialDe(p00);
    if (!mounted) return;
    if (ficha != null) {
      setState(() {
        _credencial = ficha;
        _error = '$error Puede entrar sin conexión con su PIN local.';
      });
      return;
    }

    setState(() => _error = error);
    if (auth.bloqueado) {
      // La cuenta quedó bloqueada: se ofrece el desbloqueo con 3 palabras.
      Navigator.pushNamed(context, '/unlock', arguments: {'p00': p00});
    }
  }

  void _abrirPin() {
    Navigator.pushNamed(context, '/pin', arguments: {
      'p00': _p00Controller.text.trim(),
    });
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
              constraints:
                  BoxConstraints(minHeight: constraints.maxHeight - 40),
              child: Column(
                // El Spacer() del pie exige `start`; el centrado vertical se
                // logra con los SizedBox superiores.
                mainAxisAlignment: MainAxisAlignment.start,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Banda de marca (propuesta visual v2 · D-73): el degradado
                  // medido sobre la pieza «autogestión» con el logotipo CANTV
                  // monocromo blanco y el nombre del producto.
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.asset(
                      'assets/marca/banda_acceso.webp',
                      fit: BoxFit.fitWidth,
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Ingrese su P00 y su clave',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14),
                  ),
                  const SizedBox(height: 20),

                  if (_error != null) ...[
                    _AvisoError(mensaje: _error!),
                    const SizedBox(height: 12),
                  ],

                  // D-100: hay credencial de acceso sin conexión para el P00
                  // escrito. Se avisa del PIN de fábrica y se ofrece entrar.
                  if (_credencial != null) ...[
                    _AvisoSinConexion(
                      credencial: _credencial!,
                      alEntrar: _abrirPin,
                    ),
                    const SizedBox(height: 12),
                  ],

                  TextField(
                    controller: _p00Controller,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    onChanged: (_) => _mirarCredencial(),
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
                        icon: Icon(_verClave
                            ? Icons.visibility_off
                            : Icons.visibility),
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
                      style: const TextStyle(
                          color: Marca.alerta, fontWeight: FontWeight.w600),
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
                    onPressed: _abrirPin,
                    child: const Text('Acceso sin conexión (PIN)'),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pushNamed(context, '/unlock'),
                    child: const Text('Desbloquear con 3 palabras'),
                  ),
                  TextButton(
                    onPressed: () =>
                        Navigator.pushNamed(context, '/primer-acceso'),
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
class _AvisoError extends StatelessWidget {  const _AvisoError({required this.mensaje});

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

/// Aviso del **acceso sin conexión** disponible para el P00 escrito (D-100).
///
/// Si la credencial todavía usa el PIN de fábrica lo dice de forma destacada:
/// es la situación en la que cualquiera con el dispositivo podría entrar, y el
/// técnico debe cambiarlo.
class _AvisoSinConexion extends StatelessWidget {
  const _AvisoSinConexion({required this.credencial, required this.alEntrar});

  final CredencialLocal credencial;
  final VoidCallback alEntrar;

  @override
  Widget build(BuildContext context) {
    final porDefecto = credencial.pinPorDefecto;
    final color = porDefecto ? const Color(0xFF8A5200) : const Color(0xFF1F7A4D);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        border: Border.all(color: color.withOpacity(0.45)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(porDefecto ? Icons.warning_amber : Icons.wifi_off, color: color, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  porDefecto
                      ? 'Acceso sin conexión con el PIN de fábrica. Al entrar se le '
                          'pedirá cambiarlo por uno propio.'
                      : 'Este dispositivo puede entrar sin conexión con su PIN.',
                  style: TextStyle(color: color, fontSize: 13),
                ),
              ),
            ],
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: alEntrar,
              child: const Text('Entrar con PIN'),
            ),
          ),
        ],
      ),
    );
  }
}
