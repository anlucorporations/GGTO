import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../core/theme.dart';

/// Aviso de «sin conexión» (RNF-06).
///
/// En connectivity_plus 6.x, [onConnectivityChanged] emite
/// [List<ConnectivityResult>] en lugar de [ConnectivityResult].
///
/// Propuesta visual: el trabajo sin conexión es el **modo normal** del técnico,
/// no una falla, así que el aviso deja el rojo a sangre y pasa a ámbar claro con
/// tinta oscura (4,5:1 garantizado y legible al sol). El rojo se reserva a errores
/// reales de sincronización. Admite un contador opcional de cambios en cola.
///
/// Nota: hoy la app informa del estado de red desde la franja de
/// `BarraProgresoSync`; este widget queda disponible para las pantallas que
/// quieran el aviso a pantalla completa.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key, this.pendientes});

  /// Cambios guardados en el dispositivo pendientes de enviar (opcional).
  final int? pendientes;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<ConnectivityResult>>(
      stream: Connectivity().onConnectivityChanged,
      builder: (context, snapshot) {
        // Sin conexión cuando la lista está vacía o sólo contiene 'none'
        final resultados = snapshot.data ?? [];
        final sinConexion = resultados.isEmpty ||
            resultados.every((r) => r == ConnectivityResult.none);

        if (snapshot.hasData && sinConexion) {
          final cola = pendientes == null
              ? 'sus cambios quedan guardados aquí'
              : pendientes == 0
                  ? 'todo está guardado'
                  : '$pendientes cambios guardados aquí';
          return Container(
            color: Marca.alertaClaro,
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            child: Row(
              children: [
                const Icon(Icons.wifi_off, size: 18, color: Marca.alerta),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Sin conexión — trabaje normal: $cola.',
                    style: const TextStyle(
                      color: Marca.alerta,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          );
        }
        return const SizedBox.shrink();
      },
    );
  }
}
