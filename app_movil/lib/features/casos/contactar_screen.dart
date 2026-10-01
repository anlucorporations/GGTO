import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../sync/sync_provider.dart';
import 'operaciones_service.dart';

/// CONTACTAR (§4.1): marca el caso como CONTACTADO o agenda la cita acordada.
///
/// Usa `POST /casos/{id}/estado` con `motivo_estado` (lo que sí admite al rol
/// TECNICO) y `POST /citas` con `fecha_hora`, el campo que exige el backend.
/// Si no hay red, la acción se **encola** con su payload exacto.
class ContactarScreen extends StatefulWidget {
  const ContactarScreen({
    super.key,
    required this.idCaso,
    required this.idAveria,
    this.telefono = '',
    this.nombreCliente = '',
  });

  final int idCaso;
  final String idAveria;
  final String telefono;
  final String nombreCliente;

  @override
  State<ContactarScreen> createState() => _ContactarScreenState();
}

class _ContactarScreenState extends State<ContactarScreen> {
  final _motivoController = TextEditingController();
  final _observacionController = TextEditingController();

  DateTime _fecha = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _hora = const TimeOfDay(hour: 9, minute: 0);
  bool _enviando = false;

  @override
  void dispose() {
    _motivoController.dispose();
    _observacionController.dispose();
    super.dispose();
  }

  DateTime get _fechaHora =>
      DateTime(_fecha.year, _fecha.month, _fecha.day, _hora.hour, _hora.minute);

  Future<void> _marcarContactado() async {
    setState(() => _enviando = true);
    final resultado = await OperacionesService.marcarContactado(
      idCaso: widget.idCaso,
      idAveria: widget.idAveria,
      motivo: _motivoController.text.isEmpty
          ? 'Contacto telefónico acordado con el cliente'
          : _motivoController.text,
    );
    if (!mounted) return;
    await _finalizar(resultado);
  }

  Future<void> _agendarCita() async {
    if (_fechaHora.isBefore(DateTime.now())) {
      _avisar('La cita debe ser en una fecha y hora futuras.');
      return;
    }
    setState(() => _enviando = true);

    final cita = await OperacionesService.agendarCita(
      idCaso: widget.idCaso,
      idAveria: widget.idAveria,
      fechaHora: _fechaHora,
      observacion: _observacionController.text,
    );

    // Si la cita quedó registrada (en el servidor o en la cola), se marca CITADO.
    if (cita.enviada && _noEsError(cita.mensaje)) {
      final estado = await OperacionesService.marcarCitado(
        idCaso: widget.idCaso,
        idAveria: widget.idAveria,
        motivo: 'Cita agendada para el ${_textoFecha(_fechaHora)}',
      );
      if (!mounted) return;
      await _finalizar(
        ResultadoOperacion(
          mensaje: '${cita.mensaje} ${estado.mensaje}'.trim(),
          enviada: cita.enviada && estado.enviada,
          caso: estado.caso ?? cita.caso,
        ),
      );
      return;
    }

    if (!mounted) return;
    await _finalizar(cita);
  }

  /// Distingue un mensaje de éxito de uno de error del servidor.
  bool _noEsError(String mensaje) {
    const marcas = [
      'no tiene permiso',
      'no existe',
      'ya está',
      'no son válidos',
      'ya tiene una cita',
      'Solo el Super',
      'debe',
    ];
    return !marcas.any((m) => mensaje.toLowerCase().contains(m.toLowerCase()));
  }

  Future<void> _finalizar(ResultadoOperacion resultado) async {
    if (!mounted) return;
    setState(() => _enviando = false);

    // Se capturan antes de los `await` para no usar el contexto tras un hueco asíncrono.
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final sync = context.read<SyncProvider>();

    if (resultado.caso != null) {
      // Refresca la lista y la ficha con lo que devolvió el servidor.
      await sync.refrescar();
    }

    messenger.showSnackBar(
      SnackBar(
        content: Text(resultado.mensaje),
        backgroundColor: resultado.encolada ? Colors.orange.shade800 : null,
      ),
    );
    navigator.pop(true);
  }

  void _avisar(String mensaje) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
  }

  Future<void> _elegirFecha() async {
    final elegida = await showDatePicker(
      context: context,
      initialDate: _fecha,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 120)),
      helpText: 'Fecha de la cita',
    );
    if (elegida != null) setState(() => _fecha = elegida);
  }

  Future<void> _elegirHora() async {
    final elegida = await showTimePicker(
      context: context,
      initialTime: _hora,
      helpText: 'Hora de la cita',
    );
    if (elegida != null) setState(() => _hora = elegida);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Contactar cliente')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: ListTile(
                leading: const Icon(Icons.person),
                title: Text(widget.nombreCliente.isEmpty ? 'Cliente' : widget.nombreCliente),
                subtitle: Text(
                  '${widget.idAveria}\n'
                  '${widget.telefono.isEmpty ? 'Sin teléfono registrado' : 'Tel: ${widget.telefono}'}',
                ),
                isThreeLine: true,
              ),
            ),
            if (widget.telefono.isNotEmpty) ...[
              const SizedBox(height: 6),
              const Text(
                'Llame al cliente, acuerde la atención y registre el resultado.',
                style: TextStyle(fontSize: 13, color: Colors.black54),
              ),
            ],
            const SizedBox(height: 14),

            TextField(
              controller: _motivoController,
              maxLength: 200,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Observación del contacto (opcional)',
                border: OutlineInputBorder(),
              ),
            ),

            const SizedBox(height: 8),
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.check_circle_outline),
                label: const Text('Marcar como CONTACTADO'),
                onPressed: _enviando ? null : _marcarContactado,
              ),
            ),

            const Divider(height: 36),

            const Text(
              'Agendar cita',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.calendar_today, size: 18),
                    label: Text(_soloFecha(_fecha)),
                    onPressed: _enviando ? null : _elegirFecha,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.access_time, size: 18),
                    label: Text(_hora.format(context)),
                    onPressed: _enviando ? null : _elegirHora,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _observacionController,
              maxLength: 200,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Observación de la cita (opcional)',
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.event_available),
                label: const Text('Agendar y marcar CITADO'),
                onPressed: _enviando ? null : _agendarCita,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Cita propuesta: ${_textoFecha(_fechaHora)}',
              style: const TextStyle(fontSize: 13),
            ),
            if (_enviando) ...[
              const SizedBox(height: 16),
              const Center(child: CircularProgressIndicator()),
            ],
          ],
        ),
      ),
    );
  }

  static String _soloFecha(DateTime fecha) {
    String dos(int v) => v.toString().padLeft(2, '0');
    return '${dos(fecha.day)}/${dos(fecha.month)}/${fecha.year}';
  }

  static String _textoFecha(DateTime fecha) {
    String dos(int v) => v.toString().padLeft(2, '0');
    return '${dos(fecha.day)}/${dos(fecha.month)}/${fecha.year} ${dos(fecha.hour)}:${dos(fecha.minute)}';
  }
}
