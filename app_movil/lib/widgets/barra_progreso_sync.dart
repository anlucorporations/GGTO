import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
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
///
/// Propuesta visual: la franja sube de 11 a 13 sp en negrita y la barra de 5 a
/// 6 px para que se lea al sol; los colores pasan a los tokens de marca (el
/// ámbar y el rojo de Material no alcanzaban el 4,5:1 sobre blanco).
class BarraProgresoSync extends StatelessWidget {
  const BarraProgresoSync({super.key, this.compacta = true});

  /// `true` para la franja bajo la barra de título; `false` para la tarjeta
  /// ancha de la pantalla «Sincronizar».
  final bool compacta;

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncProvider>();
    final activo = sync.progresoActivo;
    final valor = activo ? sync.progreso : sync.progresoEnReposo;

    final Color color;
    final IconData icono;
    if (activo) {
      color = Marca.azul;
      icono = Icons.sync;
    } else if (sync.conError > 0) {
      color = Marca.error;
      icono = Icons.error_outline;
    } else if (sync.pendientesSinError > 0) {
      color = Marca.alerta;
      icono = Icons.schedule;
    } else {
      color = Marca.exito;
      icono = Icons.cloud_done;
    }

    final barra = ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: LinearProgressIndicator(
        value: valor.clamp(0, 1),
        minHeight: compacta ? 6 : 8,
        backgroundColor: color.withOpacity(0.15),
        valueColor: AlwaysStoppedAnimation<Color>(color),
      ),
    );

    if (compacta) {
      return Container(
        color: Theme.of(context).colorScheme.surface,
        padding: const EdgeInsets.fromLTRB(12, 7, 12, 7),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icono, size: 15, color: color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    sync.resumenBarra,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, color: color, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
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
                Icon(icono, size: 20, color: color),
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
              style: const TextStyle(fontSize: 12.5, color: Marca.textoSuave),
            ),
          ],
        ),
      ),
    );
  }
}
