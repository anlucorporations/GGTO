import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';

/// Alta manual de un caso de MANTENIMIENTO desde la APK (requisito del
/// usuario: incorporar casos de mantenimiento de forma manual).
///
/// El servidor genera el identificador (`REF-MANT-######`), recibe el caso por
/// el mismo endpoint del alta manual (`POST /casos` con `tipo_reporte:
/// MANTENIMIENTO`) y lo deja en la cola abierta de la central. Igual que en la
/// web (RF-32): nombre y teléfono de contacto, identificador de pago (70*) y
/// dirección son obligatorios.
class MantenimientoScreen extends StatefulWidget {
  const MantenimientoScreen({super.key});

  @override
  State<MantenimientoScreen> createState() => _MantenimientoScreenState();
}

class _MantenimientoScreenState extends State<MantenimientoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _contacto = TextEditingController();
  final _pago = TextEditingController();
  final _direccion = TextEditingController();
  final _detalle = TextEditingController();
  bool _guardando = false;

  @override
  void dispose() {
    _nombre.dispose();
    _contacto.dispose();
    _pago.dispose();
    _direccion.dispose();
    _detalle.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _guardando = true);
    try {
      await ApiClient.post('/casos', data: {
        'tipo_reporte': 'MANTENIMIENTO',
        'nombre_cliente': _nombre.text.trim(),
        'contacto_cliente': _contacto.text.trim(),
        'id_pago': _pago.text.trim(),
        'direccion': _direccion.text.trim(),
        'problema_reporte': _detalle.text.trim().isEmpty
            ? 'Mantenimiento preventivo/correctivo'
            : _detalle.text.trim(),
      });
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (contexto) => AlertDialog(
          title: const Text('Caso de mantenimiento creado'),
          content: const Text(
              'El caso quedó en la cola abierta de la central con identificador '
              'REF-MANT-######.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(contexto),
                child: const Text('Entendido')),
          ],
        ),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(error is ApiError
            ? error.mensaje
            : 'No se pudo crear el caso de mantenimiento.'),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Nuevo caso de mantenimiento'),
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _nombre,
                decoration: const InputDecoration(
                  labelText: 'Nombre del cliente / contacto *',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? 'Obligatorio' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _contacto,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Teléfono de contacto *',
                  border: OutlineInputBorder(),
                  hintText: '04141234567',
                ),
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? 'Obligatorio' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _pago,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Identificador de pago (70*) *',
                  border: OutlineInputBorder(),
                  hintText: '7012345678',
                ),
                validator: (v) {
                  final limpio = (v ?? '').trim();
                  if (limpio.isEmpty) return 'Obligatorio';
                  if (!limpio.startsWith('70')) {
                    return 'Debe empezar con 70 (identificador de pago)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _direccion,
                decoration: const InputDecoration(
                  labelText: 'Dirección del mantenimiento *',
                  border: OutlineInputBorder(),
                  hintText: 'Sector, calle y referencia',
                ),
                textCapitalization: TextCapitalization.sentences,
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? 'Obligatorio' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _detalle,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Detalle del mantenimiento',
                  border: OutlineInputBorder(),
                  helperText:
                      'Opcional; si se omite el servidor anota «Mantenimiento '
                      'preventivo/correctivo»',
                ),
                textCapitalization: TextCapitalization.sentences,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _guardando ? null : () => _guardar(),
                icon: _guardando
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.engineering_outlined),
                label: Text(_guardando ? 'Guardando…' : 'Crear caso de mantenimiento'),
              ),
            ],
          ),
        ),
      );
}
