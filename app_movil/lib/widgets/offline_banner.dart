import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Banner rojo que aparece cuando no hay conexión a Internet (RNF-06).
///
/// En connectivity_plus 6.x, [onConnectivityChanged] emite
/// [List<ConnectivityResult>] en lugar de [ConnectivityResult].
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

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
          return Container(
            color: Colors.red,
            width: double.infinity,
            padding: const EdgeInsets.all(8),
            child: const Text(
              'Sin conexión — Modo Offline',
              style: TextStyle(color: Colors.white),
              textAlign: TextAlign.center,
            ),
          );
        }
        return const SizedBox.shrink();
      },
    );
  }
}
