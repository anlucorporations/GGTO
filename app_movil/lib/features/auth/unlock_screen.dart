import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'auth_provider.dart';

/// Desbloqueo de la cuenta con 3 de las 12 palabras de seguridad (RF-20).
///
/// `POST /auth/unlock` **no emite token**: en la misma pantalla se pide la clave
/// para encadenar el acceso (H-06). Antes, el desbloqueo dejaba la cuenta
/// bloqueada sin salida.
class UnlockScreen extends StatefulWidget {
  const UnlockScreen({super.key});

  @override
  State<UnlockScreen> createState() => _UnlockScreenState();
}

class _UnlockScreenState extends State<UnlockScreen> {
  final _p00Controller = TextEditingController();
  final _claveController = TextEditingController();
  final List<int> _posiciones = [1, 2, 3];
  final List<TextEditingController> _palabras =
      List.generate(3, (_) => TextEditingController());

  String? _error;
  bool _enviando = false;

  @override
  void initState() {
    super.initState();
    // El login puede precargar el P00 al detectar el bloqueo.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final argumentos = ModalRoute.of(context)?.settings.arguments;
      if (argumentos is Map && argumentos['p00'] is String) {
        _p00Controller.text = argumentos['p00'] as String;
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _p00Controller.dispose();
    _claveController.dispose();
    for (final controlador in _palabras) {
      controlador.dispose();
    }
    super.dispose();
  }

  Future<void> _desbloquear() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _error = null);

    if (_p00Controller.text.trim().isEmpty) {
      setState(() => _error = 'Indique el P00 de la cuenta bloqueada.');
      return;
    }
    if (_palabras.any((c) => c.text.trim().isEmpty)) {
      setState(() => _error = 'Complete las tres palabras de seguridad.');
      return;
    }
    if (_claveController.text.isEmpty) {
      setState(() => _error = 'Indique su clave para entrar tras el desbloqueo.');
      return;
    }

    setState(() => _enviando = true);
    final error = await auth.desbloquear(
      p00: _p00Controller.text,
      palabras: [
        for (var i = 0; i < 3; i++) {'pos': _posiciones[i], 'valor': _palabras[i].text.trim()},
      ],
      clave: _claveController.text,
    );
    if (!mounted) return;
    setState(() => _enviando = false);

    if (error == null) {
      Navigator.pushReplacementNamed(context, '/casos');
      return;
    }
    setState(() => _error = error);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Desbloquear cuenta')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Introduzca 3 de sus 12 palabras de seguridad con su posición.',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEBEE),
                    border: Border.all(color: const Color(0xFFE57373)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_error!, style: const TextStyle(color: Color(0xFFB71C1C))),
                ),
                const SizedBox(height: 12),
              ],

              TextField(
                controller: _p00Controller,
                decoration: const InputDecoration(
                  labelText: 'P00',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 14),

              for (var i = 0; i < 3; i++) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 96,
                      child: DropdownButtonFormField<int>(
                        value: _posiciones[i],
                        decoration: const InputDecoration(
                          labelText: 'Posición',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: [
                          for (var p = 1; p <= 12; p++)
                            DropdownMenuItem(value: p, child: Text('Pos $p')),
                        ],
                        onChanged: (valor) {
                          if (valor != null) setState(() => _posiciones[i] = valor);
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _palabras[i],
                        autocorrect: false,
                        decoration: InputDecoration(
                          labelText: 'Palabra ${i + 1}',
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],

              const SizedBox(height: 4),
              const Text(
                'Al desbloquear se solicita su clave para iniciar sesión: el desbloqueo por sí '
                'solo no abre la sesión.',
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _claveController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Clave',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _enviando ? null : _desbloquear,
                  child: Text(_enviando ? 'Desbloqueando…' : 'Desbloquear e ingresar'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
