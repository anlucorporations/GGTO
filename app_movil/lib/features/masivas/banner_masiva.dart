import 'package:flutter/material.dart';

import 'masivas_provider.dart';

/// Banner **fijo y prioritario** de MASIVA ACTIVA (D-99).
///
/// Se coloca **fuera** de la lista de casos (en la `Column` de la pantalla, con
/// la lista dentro de un `Expanded` debajo), de modo que no desaparece al
/// desplazar: la masiva se ve siempre, por encima de los casos.
///
/// Si no hay masivas activas **no pinta nada**.
class BannerMasivaActiva extends StatelessWidget {
  const BannerMasivaActiva({
    super.key,
    required this.masivas,
    required this.onTap,
  });

  /// Masivas activas del dispositivo (las de mayor prioridad primero).
  final List<Map<String, dynamic>> masivas;

  /// Abre la pantalla MASIVA.
  final VoidCallback onTap;

  /// Texto que anuncia cuántas masivas hay, además de la prioritaria.
  static String textoConteo(int total) => '$total masiva(s)';

  @override
  Widget build(BuildContext context) {
    if (masivas.isEmpty) return const SizedBox.shrink();

    final prioritaria = MasivasProvider.ordenarPorPrioridad(masivas).first;
    final descripcion = '${prioritaria['descripcion'] ?? ''}'.trim();
    final total = masivas.length;
    final alerta = Theme.of(context).colorScheme.error;

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Material(
        color: alerta.withOpacity(0.08),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: alerta, width: 3),
        ),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.crisis_alert, color: alerta, size: 30),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'MASIVA ACTIVA',
                        style: TextStyle(
                          color: alerta,
                          fontWeight: FontWeight.w900,
                          fontSize: 15,
                          letterSpacing: 0.4,
                        ),
                      ),
                      if (descripcion.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          descripcion,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13),
                        ),
                      ],
                      if (total > 1) ...[
                        const SizedBox(height: 2),
                        Text(
                          textoConteo(total),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: alerta),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
