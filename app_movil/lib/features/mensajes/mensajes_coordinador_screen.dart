import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';

/// Envío del Coordinador hacia el Supervisor activo de su central.
class MensajesCoordinadorScreen extends StatefulWidget {
  const MensajesCoordinadorScreen({super.key});

  @override
  State<MensajesCoordinadorScreen> createState() =>
      _MensajesCoordinadorScreenState();
}

class _MensajesCoordinadorScreenState extends State<MensajesCoordinadorScreen> {
  final _cuerpo = TextEditingController();
  List<Map<String, dynamic>> _supervisores = [];
  String? _p00;
  bool _escalar = false;
  bool _cargando = true;
  bool _enviando = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargarSupervisores();
  }

  @override
  void dispose() {
    _cuerpo.dispose();
    super.dispose();
  }

  Future<void> _cargarSupervisores() async {
    try {
      final respuesta = await ApiClient.get('/mensajes/supervisores');
      if (!mounted) return;
      final supervisores = (respuesta as List).cast<Map<String, dynamic>>();
      setState(() {
        _supervisores = supervisores;
        _p00 ??= supervisores.isEmpty ? null : '${supervisores.first['p00']}';
        _cargando = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiError
            ? error.mensaje
            : 'No se pudo consultar el Supervisor de la central.';
        _cargando = false;
      });
    }
  }

  Future<void> _enviar() async {
    final cuerpo = _cuerpo.text.trim();
    if (cuerpo.isEmpty || cuerpo.length > 500) return;
    setState(() => _enviando = true);
    try {
      await ApiClient.post('/mensajes/supervisor', data: {
        'p00_supervisor': _p00 ?? '',
        'cuerpo': cuerpo,
        'escalar_al_admin': _escalar,
      });
      if (!mounted) return;
      _cuerpo.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mensaje enviado.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _error =
          error is ApiError ? error.mensaje : 'No se pudo enviar el mensaje.');
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Mensaje al Supervisor'),
          actions: [
            IconButton(
              tooltip: 'Actualizar supervisores',
              onPressed: _cargarSupervisores,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: _cargando
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    MaterialBanner(
                      content: Text(_error!),
                      actions: [
                        TextButton(
                          onPressed: () => setState(() => _error = null),
                          child: const Text('Cerrar'),
                        ),
                      ],
                    ),
                  if (_supervisores.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child:
                            Text('No hay Supervisor activo en esta central.'),
                      ),
                    )
                  else
                    DropdownButtonFormField<String>(
                      value: _p00,
                      decoration: const InputDecoration(
                        labelText: 'Supervisor destinatario',
                        border: OutlineInputBorder(),
                      ),
                      items: _supervisores.map((supervisor) {
                        final nombre = [
                          supervisor['nombre'],
                          supervisor['apellido'],
                        ]
                            .where(
                                (parte) => parte != null && '$parte'.isNotEmpty)
                            .join(' ');
                        return DropdownMenuItem(
                          value: '${supervisor['p00']}',
                          child: Text(nombre.isEmpty
                              ? '${supervisor['p00']}'
                              : '$nombre · ${supervisor['p00']}'),
                        );
                      }).toList(),
                      onChanged: (v) => setState(() => _p00 = v),
                    ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _cuerpo,
                    onChanged: (_) => setState(() {}),
                    minLines: 3,
                    maxLines: 8,
                    maxLength: 500,
                    decoration: const InputDecoration(
                      labelText: 'Mensaje',
                      border: OutlineInputBorder(),
                      alignLabelWithHint: true,
                    ),
                  ),
                  if (_supervisores.isEmpty)
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Escalar al Administrador'),
                      value: _escalar,
                      onChanged: (v) => setState(() => _escalar = v),
                    ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _enviando || _cuerpo.text.trim().isEmpty
                        ? null
                        : _enviar,
                    icon: _enviando
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                    label: const Text('Enviar al Supervisor'),
                  ),
                ],
              ),
      );
}
