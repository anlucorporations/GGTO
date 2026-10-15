import 'package:flutter/material.dart';

/// Icono del estado de un caso (D-101).
///
/// Sustituye al [Chip] de texto en el **listado principal**: el técnico reconoce
/// el estado de un vistazo y la tarjeta gana el ancho que ocupaba el rótulo. El
/// nombre del estado no se pierde: va en el `Tooltip` (y en el `semanticsLabel`),
/// así que sigue disponible al mantener pulsado y para los lectores de pantalla.
///
/// En la ficha del caso se mantiene el rótulo textual, donde sí hay espacio.
class EstadoIcono extends StatelessWidget {
  const EstadoIcono({super.key, required this.estado, this.tamano = 22});

  final String estado;
  final double tamano;

  /// Icono y color de cada estado. Los colores son los mismos que usaba el chip.
  static (IconData, Color) aspecto(String estado) {
    switch (estado.trim().toUpperCase()) {
      case 'NUEVO':
        return (Icons.fiber_new, Colors.indigo);
      case 'ASIGNADO':
        return (Icons.assignment_ind, Colors.blue);
      case 'CONTACTADO':
        return (Icons.phone_in_talk, Colors.orange);
      case 'CITADO':
        return (Icons.event_available, Colors.purple);
      case 'DIFERIDO':
        return (Icons.hourglass_bottom, Colors.red);
      case 'ENRUTADO':
        return (Icons.alt_route, Colors.teal);
      case 'CERRADO':
        return (Icons.check_circle, Colors.green);
      case 'CANCELADO':
        return (Icons.cancel, Colors.blueGrey);
      case 'EN_GESTION':
        return (Icons.engineering, Colors.brown);
      default:
        return (Icons.help_outline, Colors.grey);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (icono, color) = aspecto(estado);
    final etiqueta = estado.trim().isEmpty ? 'SIN ESTADO' : estado.trim().toUpperCase();
    return Tooltip(
      message: etiqueta,
      child: Semantics(
        label: 'Estado $etiqueta',
        child: Icon(icono, color: color, size: tamano),
      ),
    );
  }
}
