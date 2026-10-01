import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'auth_provider.dart';

/// Primer acceso del técnico (RF-20 / §4.3): comprueba el P00, crea la cuenta
/// con su clave y muestra las **12 palabras de seguridad** una sola vez.
class PrimerAccesoScreen extends StatefulWidget {
  const PrimerAccesoScreen({super.key});

  @override
  State<PrimerAccesoScreen> createState() => _PrimerAccesoScreenState();
}

class _PrimerAccesoScreenState extends State<PrimerAccesoScreen> {
  final _p00Controller = TextEditingController();
  final _correoController = TextEditingController();
  final _claveController = TextEditingController();
  final _confirmacionController = TextEditingController();

  Map<String, dynamic>? _info;
  List<String>? _palabras;
  String? _error;
  bool _comprobando = false;
  bool _creando = false;

  @override
  void dispose() {
    _p00Controller.dispose();
    _correoController.dispose();
    _claveController.dispose();
    _confirmacionController.dispose();
    super.dispose();
  }

  Future<void> _comprobar() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() {
      _error = null;
      _info = null;
    });
    if (_p00Controller.text.trim().isEmpty) {
      setState(() => _error = 'Indique su P00.');
      return;
    }
    setState(() => _comprobando = true);
    final info = await auth.primerAcceso(_p00Controller.text);
    if (!mounted) return;
    setState(() {
      _comprobando = false;
      _info = info;
      if (info == null) _error = auth.ultimoError ?? 'No se pudo comprobar el P00.';
    });
  }

  Future<void> _crear() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _error = null);

    if (_claveController.text.length < 8) {
      setState(() => _error = 'La clave debe tener al menos 8 caracteres.');
      return;
    }
    if (_claveController.text != _confirmacionController.text) {
      setState(() => _error = 'La clave y su confirmación no coinciden.');
      return;
    }

    setState(() => _creando = true);
    final palabras = await auth.crearAcceso(
      p00: _p00Controller.text,
      correo: _correoController.text,
      clave: _claveController.text,
      confirmacion: _confirmacionController.text,
    );
    if (!mounted) return;
    setState(() {
      _creando = false;
      if (palabras == null) {
        _error = auth.ultimoError ?? 'No se pudo crear el acceso.';
      } else {
        _palabras = palabras;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Primer acceso')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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

              if (_palabras != null) ...[
                const Text(
                  'Anote sus 12 palabras de seguridad',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Se muestran una sola vez y no se pueden consultar después. Con 3 de ellas '
                  'podrá desbloquear su cuenta o restablecer la clave. Si las pierde, el '
                  'Super Usuario puede generar un juego nuevo.',
                  style: TextStyle(fontSize: 13),
                ),
                const SizedBox(height: 12),
                for (var i = 0; i < _palabras!.length; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text(
                      '${(i + 1).toString().padLeft(2, '0')}.  ${_palabras![i]}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 48,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.copy),
                    label: const Text('Copiar las 12 palabras'),
                    onPressed: () async {
                      await Clipboard.setData(
                        ClipboardData(text: _palabras!.join(', ')),
                      );
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Palabras copiadas. Guárdelas en un lugar seguro.'),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 48,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pushReplacementNamed(context, '/login'),
                    child: const Text('Ir al acceso'),
                  ),
                ),
              ] else ...[
                TextField(
                  controller: _p00Controller,
                  decoration: const InputDecoration(
                    labelText: 'P00',
                    hintText: 'Su código de personal',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 46,
                  child: OutlinedButton(
                    onPressed: _comprobando ? null : _comprobar,
                    child: Text(_comprobando ? 'Comprobando…' : 'Comprobar P00'),
                  ),
                ),

                if (_info != null) ...[
                  const SizedBox(height: 14),
                  Text('${_info!['mensaje'] ?? ''}', style: const TextStyle(fontSize: 14)),
                  const SizedBox(height: 10),
                  if (_info!['puede_registrarse'] == true) ...[
                    TextField(
                      controller: _correoController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Correo',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _claveController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Clave (mínimo 8 caracteres)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _confirmacionController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Confirmar clave',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _creando ? null : _crear,
                        child: Text(
                          _creando ? 'Creando…' : 'Crear mi acceso y ver las 12 palabras',
                        ),
                      ),
                    ),
                  ] else
                    const Text(
                      'Su cuenta ya está activa: use la pantalla de acceso. Si olvidó la clave, '
                      'pida al Super Usuario que regenere sus 12 palabras.',
                      style: TextStyle(fontSize: 13),
                    ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}
