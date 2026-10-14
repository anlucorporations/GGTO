import 'package:flutter/material.dart';

class EstadoChip extends StatelessWidget {
  final String estado;
  const EstadoChip({super.key, required this.estado});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (estado) {
      case 'ASIGNADO': color = Colors.blue; break;
      case 'CONTACTADO': color = Colors.orange; break;
      case 'CITADO': color = Colors.purple; break;
      case 'CERRADO': color = Colors.green; break;
      default: color = Colors.grey;
    }
    return Chip(
      label: Text(estado, style: const TextStyle(color: Colors.white, fontSize: 12)),
      backgroundColor: color,
      // D-93: el chip va dentro de filas de la ficha y del `trailing` de la
      // tarjeta; con el relleno táctil por defecto (48 px) desbordaba el
      // `ListTile`. Se compacta: la fila completa sigue siendo pulsable.
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
    );
  }
}
