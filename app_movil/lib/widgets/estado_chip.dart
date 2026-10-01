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
    );
  }
}
