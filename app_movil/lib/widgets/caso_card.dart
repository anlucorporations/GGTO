import 'package:flutter/material.dart';

import 'estado_chip.dart';

/// Tarjeta de resumen de un caso en la lista de trabajo del técnico (RF-11).
class CasoCard extends StatelessWidget {
  const CasoCard({super.key, required this.caso, required this.onTap});

  final Map<String, dynamic> caso;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final idAveria = '${caso['id_averia'] ?? ''}';
    final cliente = '${caso['nombre_cliente'] ?? ''}'.trim();
    final sector = '${caso['sector_nombre'] ?? ''}'.trim();
    final direccion = '${caso['direccion'] ?? ''}'.trim();
    final telefono = '${caso['telefono'] ?? ''}'.trim();
    final estado = '${caso['estado_actual'] ?? 'DESCONOCIDO'}';
    final pendienteSync = caso['pendiente_sync'] == true;

    final detalles = <String>[
      if (cliente.isNotEmpty) cliente,
      if (sector.isNotEmpty) 'Sector: $sector',
      if (telefono.isNotEmpty) 'Tel: $telefono',
      if (direccion.isNotEmpty) direccion,
      if (pendienteSync) 'Cambio pendiente de sincronizar',
    ];

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        title: Text(
          idAveria.isEmpty ? 'Caso sin identificador' : idAveria,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          detalles.join('\n'),
          style: TextStyle(
            fontSize: 13,
            color: pendienteSync ? Colors.orange.shade900 : null,
          ),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            EstadoChip(estado: estado),
            const SizedBox(height: 6),
            const Icon(Icons.chevron_right, size: 20),
          ],
        ),
        isThreeLine: detalles.length > 1,
        onTap: onTap,
      ),
    );
  }
}
