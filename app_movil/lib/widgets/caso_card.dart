import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'estado_icono.dart';

/// Tarjeta de resumen de un caso en la lista de trabajo del técnico (RF-11).
///
/// Tipografía de la propuesta visual: el identificador de avería a 16 sp con
/// cifras tabulares y el detalle a 14 sp con interlineado 1,4. El formato del
/// texto (una línea por dato, «Etiqueta: valor») se conserva tal cual, porque
/// es lo que verifican las pruebas del listado.
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
    // El teléfono para contactar al cliente es el **contacto**: `telefono` es el
    // identificador de pago (70*) y no es un número para llamar.
    final contacto = '${caso['contacto_cliente'] ?? ''}'.trim();
    final estado = '${caso['estado_actual'] ?? 'DESCONOCIDO'}';
    final pendienteSync = caso['pendiente_sync'] == true;

    final detalles = <String>[
      if (cliente.isNotEmpty) cliente,
      if (sector.isNotEmpty) 'Sector: $sector',
      if (contacto.isNotEmpty) 'Contacto: $contacto',
      if (direccion.isNotEmpty) direccion,
      if (pendienteSync) 'Cambio pendiente de sincronizar',
    ];

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
        title: Text(
          idAveria.isEmpty ? 'Caso sin identificador' : idAveria,
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 16,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
        subtitle: Text(
          detalles.join('\n'),
          style: TextStyle(
            fontSize: 14,
            height: 1.4,
            color: pendienteSync ? Marca.alerta : Marca.textoSuave,
            fontWeight: pendienteSync ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // D-101: el estado va como **icono**, no como chip de texto.
            EstadoIcono(estado: estado),
            const SizedBox(width: 2),
            const Icon(Icons.chevron_right, size: 18, color: Marca.textoSuave),
          ],
        ),
        isThreeLine: detalles.length > 1,
        onTap: onTap,
      ),
    );
  }
}
