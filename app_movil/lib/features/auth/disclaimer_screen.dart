import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData, rootBundle;
import 'package:share_plus/share_plus.dart';

import 'disclaimer_storage.dart';

/// Pantalla de aceptación obligatoria del aviso de uso restringido (APK).
///
/// D-73: se muestra en **cada inicio de sesión** y bloquea el acceso hasta que
/// el usuario acepte. El texto se carga del activo empaquetado
/// `assets/disclaimer.txt` (mismo contenido que `disclaimer.md` del repositorio,
/// generado con `scripts/generar_disclaimer.py`).
class DisclaimerScreen extends StatefulWidget {
  const DisclaimerScreen({super.key, required this.onAceptar});

  /// Se invoca cuando el usuario acepta el aviso.
  final Future<void> Function() onAceptar;

  @override
  State<DisclaimerScreen> createState() => _DisclaimerScreenState();
}

class _DisclaimerScreenState extends State<DisclaimerScreen> {
  static const _rutaActivo = 'assets/disclaimer.txt';

  /// Copia de respaldo embebida, por si el activo no estuviera empaquetado.
  static const _respaldo =
      'AVISO DE USO RESTRINGIDO Y DESCARGO DE RESPONSABILIDAD\n'
      '======================================================\n\n'
      'Esta aplicación (GGTO Técnico) es un PROYECTO DE EXPERIMENTO desarrollado por el '
      'Ing. Angel H. Lucci como parte de una ACTIVIDAD ACADÉMICA.\n\n'
      '• NO debe ser divulgada, publicada ni distribuida.\n'
      '• Su uso NO debe acarrear responsabilidad alguna a la Empresa, a la institución ni al autor.\n'
      '• La información sensible y confidencial de los usuarios y del sistema NO debe compartirse '
      'con terceros.\n'
      '• Haga un uso correcto, ético y lícito de la aplicación.\n'
      '• Evalúe el producto y reporte errores y mejoras al autor.\n\n'
      'Al aceptar, usted se compromete a cumplir estos supuestos de comportamiento de acuerdo '
      'con la ÉTICA PROFESIONAL. Si no acepta, debe abstenerse de usar la aplicación y eliminar '
      'cualquier copia en su poder.\n\n'
      'El texto completo del aviso está disponible en línea, en la sección /disclaimer del servicio.';

  String? _texto;
  bool _rechazado = false;
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    _cargarTexto();
  }

  Future<void> _cargarTexto() async {
    String texto;
    try {
      texto = await rootBundle.loadString(_rutaActivo);
    } catch (_) {
      texto = _respaldo;
    }
    if (mounted) setState(() => _texto = texto);
  }

  Future<void> _aceptar() async {
    setState(() => _guardando = true);
    await DisclaimerStorage.registrar();
    await widget.onAceptar();
    if (mounted) setState(() => _guardando = false);
  }

  Future<void> _compartir() async {
    final texto = _texto ?? _respaldo;
    await SharePlus.instance.share(
      ShareParams(text: texto, subject: 'Aviso de uso restringido — GGTO Técnico'),
    );
  }

  Future<void> _copiar() async {
    final texto = _texto ?? _respaldo;
    await Clipboard.setData(ClipboardData(text: texto));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Aviso copiado al portapapeles.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Aviso de uso restringido'),
        automaticallyImplyLeading: false,
      ),
      body: _texto == null
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Proyecto de experimento con fines académicos',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Desarrollado por el Ing. Angel H. Lucci. Información confidencial: '
                        'prohibida su divulgación, publicación o distribución.',
                        style: TextStyle(fontSize: 13),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          TextButton.icon(
                            onPressed: _compartir,
                            icon: const Icon(Icons.share, size: 18),
                            label: const Text('Compartir'),
                          ),
                          TextButton.icon(
                            onPressed: _copiar,
                            icon: const Icon(Icons.copy, size: 18),
                            label: const Text('Copiar'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    child: SelectableText(
                      _texto!,
                      style: const TextStyle(fontSize: 15, height: 1.45),
                    ),
                  ),
                ),
                if (_rechazado)
                  Container(
                    width: double.infinity,
                    color: const Color(0xFFFFEBEE),
                    padding: const EdgeInsets.all(12),
                    child: const Text(
                      'Sin la aceptación del aviso no es posible utilizar la aplicación. '
                      'Si no está de acuerdo con estas condiciones, cierre la aplicación y '
                      'elimine cualquier copia en su poder.',
                      style: TextStyle(color: Color(0xFFB71C1C), fontSize: 13),
                    ),
                  ),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                    child: Column(
                      children: [
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _guardando ? null : _aceptar,
                            child: Text(
                              _guardando ? 'Registrando…' : 'He leído y acepto el aviso',
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: _guardando ? null : () => setState(() => _rechazado = true),
                            child: const Text('No acepto'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
