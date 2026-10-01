import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../casos/operaciones_service.dart';
import '../sync/sync_provider.dart';

/// ALERTAS (RF-16): reporte de falla masiva desde el campo.
///
/// El contrato real (`FallaMasivaManual`) acepta `descripcion`, `id_sector`,
/// `id_cuadrilla` y `origen`: el tipo OLT/FAT/SECTOR viaja **dentro** de la
/// descripción porque el modelo no tiene ese campo (H-09). Los incidentes de
/// flota/herramienta no tienen endpoint todavía (H-08), así que ya **no** se
/// encolan a una ruta inexistente.
class AlertasScreen extends StatefulWidget {
  const AlertasScreen({super.key});

  @override
  State<AlertasScreen> createState() => _AlertasScreenState();
}

class _AlertasScreenState extends State<AlertasScreen> {
  final _descController = TextEditingController();
  final _sectorController = TextEditingController();
  String _tipoFalla = 'OLT';
  bool _enviando = false;

  static const _tipos = ['OLT', 'FAT', 'SECTOR', 'OTRO'];

  @override
  void dispose() {
    _descController.dispose();
    _sectorController.dispose();
    super.dispose();
  }

  Future<void> _reportarFalla() async {
    if (_descController.text.trim().length < 5) {
      _avisar('Describa la falla con al menos 5 caracteres.');
      return;
    }
    final idSector = int.tryParse(_sectorController.text.trim());

    setState(() => _enviando = true);
    final resultado = await OperacionesService.reportarFallaMasiva(
      tipo: _tipoFalla,
      descripcion: _descController.text,
      idSector: idSector,
    );
    if (!mounted) return;
    setState(() => _enviando = false);

    if (!resultado.enviada) {
      await context.read<SyncProvider>().refrescar();
    }
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(resultado.mensaje),
        backgroundColor: resultado.encolada ? Colors.orange.shade800 : null,
      ),
    );
    if (resultado.enviada && !resultado.mensaje.toLowerCase().contains('al menos')) {
      _descController.clear();
    }
  }

  void _avisar(String mensaje) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alertas')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Falla masiva',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            const Text(
              'Reporte una concentración de averías (mismo OLT, FAT o sector). El supervisor '
              'recibe la alerta y asigna la cuadrilla más cercana.',
              style: TextStyle(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: _tipoFalla,
              decoration: const InputDecoration(
                labelText: 'Tipo de concentración',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final tipo in _tipos) DropdownMenuItem(value: tipo, child: Text(tipo)),
              ],
              onChanged: (valor) {
                if (valor != null) setState(() => _tipoFalla = valor);
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descController,
              maxLines: 3,
              maxLength: 400,
              decoration: const InputDecoration(
                labelText: 'Descripción de la falla',
                hintText: 'Ej. 6 clientes sin servicio en la FAT 4 del sector Norte 2',
                border: OutlineInputBorder(),
              ),
            ),
            TextField(
              controller: _sectorController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Sector (opcional)',
                hintText: 'Número de sector',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.warning_amber),
                label: Text(_enviando ? 'Enviando…' : 'Reportar falla masiva'),
                onPressed: _enviando ? null : _reportarFalla,
              ),
            ),

            const Divider(height: 40),

            const Text(
              'Incidentes de flota o herramienta',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blueGrey.shade50,
                border: Border.all(color: Colors.blueGrey.shade200),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'El reporte de incidentes de flota/herramienta aún no tiene endpoint en el '
                'servidor, así que la app ya no encola esas acciones (antes se perdían en la '
                'cola). Reporte el incidente por Telegram o al supervisor hasta que se habilite.',
                style: TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
