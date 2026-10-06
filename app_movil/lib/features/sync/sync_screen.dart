import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'download_service.dart';
import 'sync_provider.dart';
import 'upload_service.dart';

/// Pantalla DISPOSITIVO (§4.3 / D-73): estado de la cola, **DESCARGA** y **CARGA**
/// directas contra el backend. Ya no se exporta un ZIP manual.
class SyncScreen extends StatefulWidget {
  const SyncScreen({super.key});

  @override
  State<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> {
  bool _procesando = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<SyncProvider>(context, listen: false).refrescar();
    });
  }

  Future<void> _descargar() async {
    setState(() => _procesando = true);
    try {
      final resultado = await DownloadService.descargar();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('DESCARGA: ${resultado.resumen}')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error en DESCARGA: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _procesando = false);
    }
  }

  Future<void> _cargar() async {
    setState(() => _procesando = true);
    try {
      final resultado = await UploadService.cargar();
      if (!mounted) return;
      final sync = Provider.of<SyncProvider>(context, listen: false);
      await sync.refrescar();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('CARGA: ${resultado.resumen}'),
          backgroundColor: resultado.tuvoErrores ? Colors.orange.shade800 : null,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error en CARGA: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _procesando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sync = Provider.of<SyncProvider>(context);
    final acciones = sync.acciones;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dispositivo'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: () => sync.refrescar(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        sync.enLinea ? Icons.cloud_done : Icons.cloud_off,
                        color: sync.enLinea ? Colors.green : Colors.red,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        sync.enLinea ? 'Con conexión' : 'Sin conexión',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _Metrica('Acciones pendientes', '${sync.resumen['PENDIENTE'] ?? 0}'),
                  _Metrica('En reintento', '${sync.resumen['REINTENTO'] ?? 0}'),
                  _Metrica('Con error (requieren atención)', '${sync.conError}'),
                  _Metrica('Evidencias en el dispositivo', '${sync.evidencias}'),
                  if (sync.ultimaSync != null)
                    _Metrica('Última sincronización', _hora(sync.ultimaSync!)),
                ],
              ),
            ),
          ),
          if (sync.ultimoChecklist.isNotEmpty) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Checklist de sincronización (GCP · login · descarga · carga)',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    for (final paso in sync.ultimoChecklist) _PasoChecklist(paso: paso),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.download),
                  label: const Text('DESCARGA'),
                  onPressed: _procesando ? null : _descargar,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.upload),
                  label: const Text('CARGA'),
                  onPressed: _procesando ? null : _cargar,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Text(
            'Cola de acciones',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          if (acciones.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Text(
                'No hay acciones en la cola: todo está sincronizado.',
                textAlign: TextAlign.center,
              ),
            )
          else
            for (final accion in acciones) _AccionTile(accion: accion, sync: sync),
        ],
      ),
    );
  }

  static String _hora(DateTime fecha) {
    String dos(int v) => v.toString().padLeft(2, '0');
    return '${dos(fecha.day)}/${dos(fecha.month)} ${dos(fecha.hour)}:${dos(fecha.minute)}';
  }


}

class _Metrica extends StatelessWidget {
  const _Metrica(this.etiqueta, this.valor);

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(etiqueta, style: const TextStyle(fontSize: 13))),
          Text(valor, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _AccionTile extends StatelessWidget {
  const _AccionTile({required this.accion, required this.sync});

  final Map<String, dynamic> accion;
  final SyncProvider sync;

  @override
  Widget build(BuildContext context) {
    final estado = '${accion['estado']}';
    final color = switch (estado) {
      'ERROR' => Colors.red,
      'REINTENTO' => Colors.orange,
      _ => Colors.blueGrey,
    };

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        dense: true,
        leading: CircleAvatar(
          radius: 14,
          backgroundColor: color.withOpacity(0.15),
          child: Icon(
            estado == 'ERROR' ? Icons.error_outline : Icons.schedule,
            size: 16,
            color: color,
          ),
        ),
        title: Text('${accion['tipo']}', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${accion['metodo']} ${accion['endpoint']}', style: const TextStyle(fontSize: 12)),
            Text('Estado: $estado · intentos: ${accion['intentos']}', style: const TextStyle(fontSize: 12)),
            if (accion['ultimo_error'] != null)
              Text(
                '${accion['ultimo_error']}',
                style: const TextStyle(fontSize: 12, color: Colors.red),
              ),
          ],
        ),
        trailing: PopupMenuButton<String>(
          tooltip: 'Opciones',
          onSelected: (opcion) async {
            if (opcion == 'reintentar') {
              await sync.reintentarAccion(accion['id'] as int);
            } else if (opcion == 'descartar') {
              await sync.descartarAccion(accion['id'] as int);
            }
          },
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'reintentar', child: Text('Reintentar ahora')),
            PopupMenuItem(value: 'descartar', child: Text('Descartar')),
          ],
        ),
      ),
    );
  }
}

/// Fila del checklist de sincronización (D-81 · RF-40).
class _PasoChecklist extends StatelessWidget {
  const _PasoChecklist({required this.paso});

  final Map<String, dynamic> paso;

  @override
  Widget build(BuildContext context) {
    final estado = '${paso['estado'] ?? ''}';
    final color = switch (estado) {
      'OK' => Colors.green,
      'ERROR' => Colors.red,
      'EN_CURSO' => Colors.orange,
      'OMITIDO' => Colors.grey,
      _ => Colors.blueGrey,
    };
    final icono = switch (estado) {
      'OK' => Icons.check_circle,
      'ERROR' => Icons.error,
      'EN_CURSO' => Icons.sync,
      'OMITIDO' => Icons.remove_circle_outline,
      _ => Icons.radio_button_unchecked,
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(icono, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text('${paso['paso']}', style: const TextStyle(fontSize: 13))),
          Text(
            estado,
            style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
