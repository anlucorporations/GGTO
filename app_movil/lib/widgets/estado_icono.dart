import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Icono del estado de un caso (D-101).
///
/// Sustituye al [Chip] de texto en el **listado principal**: el técnico reconoce
/// el estado de un vistazo y la tarjeta gana el ancho que ocupaba el rótulo. El
/// nombre del estado no se pierde: va en el `Tooltip` (y en el `semanticsLabel`),
/// así que sigue disponible al mantener pulsado y para los lectores de pantalla.
///
/// En la ficha del caso se mantiene el rótulo textual, donde sí hay espacio.
///
/// **D-101 se mantiene**: el listado sigue mostrando un icono y no un chip. Lo
/// que cambió son los colores: los de Material (`Colors.orange` 2,16:1,
/// `Colors.green` 2,78:1, `Colors.grey` 2,68:1 sobre blanco) incumplían el
/// 4,5:1 que exige **RNF-APK-05**; ahora cada estado usa la tinta de marca
/// sobre su fondo claro (todos ≥ 4,7:1). Ver `scripts/contraste_apk.py`.
class EstadoIcono extends StatelessWidget {
  const EstadoIcono({super.key, required this.estado, this.tamano = 24});

  final String estado;
  final double tamano;

  /// Icono, tinta y fondo claro de cada estado.
  static (IconData, Color, Color) aspecto(String estado) {
    switch (estado.trim().toUpperCase()) {
      case 'NUEVO':
        return (Icons.fiber_new, Marca.info, Marca.infoClaro);
      case 'ASIGNADO':
        return (Icons.assignment_ind, Marca.info, Marca.infoClaro);
      case 'CONTACTADO':
        return (Icons.phone_in_talk, Marca.alerta, Marca.alertaClaro);
      case 'CITADO':
        return (Icons.event_available, Marca.especial, Marca.especialClaro);
      case 'DIFERIDO':
        return (Icons.hourglass_bottom, Marca.error, Marca.errorClaro);
      case 'ENRUTADO':
        return (Icons.alt_route, Marca.enrutado, Marca.enrutadoClaro);
      case 'CERRADO':
        return (Icons.check_circle, Marca.exito, Marca.exitoClaro);
      case 'CANCELADO':
        return (Icons.cancel, Marca.textoSuave, Marca.contenedor);
      case 'EN_GESTION':
        return (Icons.engineering, Marca.gestion, Marca.gestionClaro);
      default:
        return (Icons.help_outline, Marca.textoSuave, Marca.contenedor);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (icono, tinta, fondo) = aspecto(estado);
    final etiqueta = estado.trim().isEmpty ? 'SIN ESTADO' : estado.trim().toUpperCase();
    return Tooltip(
      message: etiqueta,
      child: Semantics(
        label: 'Estado $etiqueta',
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: fondo, borderRadius: BorderRadius.circular(12)),
          alignment: Alignment.center,
          child: Icon(icono, color: tinta, size: tamano),
        ),
      ),
    );
  }
}
