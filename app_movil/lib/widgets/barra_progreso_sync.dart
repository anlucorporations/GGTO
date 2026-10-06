import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../features/sync/sync_provider.dart';

/// Barra con el **progreso de la sincronización de los datos** (D-82 · requisito 2).
///
/// Muestra el avance real de la operación en curso (descarga, subida de fotos o
/// envío de la cola) y, cuando no hay nada en marcha, resume el estado de la
/// cola: verde si todo está enviado, ámbar con acciones pendientes y rojo si hay
/// errores que exigen atención.
///
/// Es un widget de sólo lectura: se alimenta de `SyncProvider`, así que aparece
/// actualizada en cualquier pantalla donde se coloque.
class BarraProgresoSync extends StatelessWidget {
  const BarraProgresoSync({super.key, this.compacta = true});

  /// `true` para la franja bajo la barra de título; `false` para la tarjeta
  /// ancha de la pantalla «Dispositivo».
  final bool compacta;

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncProvider>();
    final activo = sync.progresoActivo;
    final valor = activo ? sync.progreso : sync.progresoEnReposo;

    final Color color;
    final IconData icono;
    if (activo) {
      color = Theme.of(context).colorScheme.primary;
      icono = Icons.sync;
    } else if (sync.conError > 0) {
      color = Colors.red.shade700;
      icono = Icons.error_outline;
    } else if (sync.pendientesSinError > 0) {
      color = Colors.orange.shade800;
      icono = Icons.schedule;
    } else {
      color = Colors.green.shade700;
      icono = Icons.cloud_done;
    }

    final barra = ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: LinearProgressIndicator(
        value: valor.clamp(0, 1),
        minHeight: compacta ? 5 : 8,
        backgroundColor: color.withOpacity(0.15),
        valueColor: AlwaysStoppedAnimation<Color>(color),
      ),
    );

    if (compacta) {
      return Container(
        color: Theme.of(context).colorScheme.surface,
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icono, size: 13, color: color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    sync.resumenBarra,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            barra,
          ],
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icono, size: 18, color: color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    sync.resumenBarra,
                    style: TextStyle(fontWeight: FontWeight.bold, color: color),
                  ),
                ),
                if (activo)
                  Text(
                    '${sync.progresoPorcentaje} %',
                    style: TextStyle(fontWeight: FontWeight.bold, color: color),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            barra,
            const SizedBox(height: 6),
            Text(
              sync.enLinea ? 'Con conexión' : 'Sin conexión: el contenido local sigue disponible',
              style: const TextStyle(fontSize: 11, color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }
}
