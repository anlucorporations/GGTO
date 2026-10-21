import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../widgets/barra_progreso_sync.dart';
import '../../widgets/boton_usuario.dart';
import '../casos/casos_provider.dart';
import '../masivas/masivas_provider.dart';
import 'actualizacion_datos_service.dart';
import 'sync_provider.dart';

/// Pantalla SINCRONIZAR (§4.3 / D-73 · D-117): estado de la cola y **un solo
/// botón** que sube los casos resueltos y contactados y descarga los casos
/// asignados por el despacho del día.
///
/// D-82: la barra superior muestra el **progreso** de la sincronización de los
/// datos (requisito 2).
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

  /// D-115: una sola acción para todo el proceso del técnico.
  ///
  /// 1) CARGA de evidencias y actividades · 2) cola clásica · 3) DESCARGA del
  /// despacho del día con la purga de los casos no atendidos.
  Future<void> _actualizarTodo() async {
    if (_procesando) return;
    // D-142 · H-25: la actualización puede quitar del teléfono los casos no
    // atendidos de jornadas anteriores; se avisa y se pide confirmación.
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (_) => const ConfirmarSincronizacionDialog(),
    );
    if (confirmado != true || !mounted) return;
    setState(() => _procesando = true);
    final sync = context.read<SyncProvider>();
    final casos = context.read<CasosProvider>();
    final masivas = MasivasProvider.opcional(context, escuchar: false);
    try {
      final resultado = await ActualizacionDatosService.ejecutar(
        sync: sync,
        onProgreso: (fase, valor) => sync.actualizarProgreso(valor, fase: fase),
      );
      if (resultado.descarga != null) {
        await casos.aplicarDescarga(resultado.descarga!);
      }
      await masivas?.refrescarLocal();
      await sync.refrescar();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ACTUALIZACIÓN: ${resultado.resumen}'),
          // D-142 · H-25: tokens de marca (contraste ≥ 4,5:1 sobre el texto blanco).
          backgroundColor: resultado.huboErrores ? Marca.alerta : null,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al actualizar: $e'), backgroundColor: Marca.error),
      );
    } finally {
      sync.terminarProgreso();
      if (mounted) setState(() => _procesando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sync = Provider.of<SyncProvider>(context);
    final acciones = sync.acciones;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sincronizar'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: () => sync.refrescar(),
          ),
          const BotonUsuario(),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          const BarraProgresoSync(compacta: false),
          const SizedBox(height: 12),
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
                  const SizedBox(height: 6),
                  const Text(
                    'Sube los casos resueltos (cerrados, citados, enrutados, '
                    'diferidos) y los contactados; descarga los casos asignados '
                    'por el despacho del día.',
                    style: TextStyle(fontSize: 12.5, color: Colors.black54),
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
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.sync),
              label: Text(_procesando ? 'SINCRONIZANDO…' : 'SINCRONIZAR'),
              onPressed: _procesando ? null : _actualizarTodo,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Sube las evidencias del técnico, borra los casos no atendidos y '
            'descarga el despacho del día.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.black54),
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
    // D-142 · H-25: tokens de marca (el ámbar y el rojo de Material no llegaban
    // al 4,5:1 sobre blanco).
    final color = switch (estado) {
      'ERROR' => Marca.error,
      'REINTENTO' => Marca.alerta,
      _ => Marca.textoSuave,
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


/// Diálogo de confirmación antes de la actualización completa (D-142 · H-25).
///
/// Explica que los casos **no atendidos** de jornadas anteriores se quitan del
/// dispositivo (no se borran del servidor) y permite cancelar.
class ConfirmarSincronizacionDialog extends StatelessWidget {
  const ConfirmarSincronizacionDialog({super.key});

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('¿Actualizar los datos?'),
        content: const Text(
          'Se subirán las evidencias y la cola, y se descargará el despacho de su '
          'cuadrilla. Los casos NO atendidos de jornadas anteriores se quitarán de '
          'este teléfono (no se borran del servidor).',
        ),
        actions: [
          TextButton(
            key: const Key('sincronizar-cancelar'),
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            key: const Key('sincronizar-confirmar'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Actualizar'),
          ),
        ],
      );
}
