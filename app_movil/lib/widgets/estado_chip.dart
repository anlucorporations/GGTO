import 'package:flutter/material.dart';

import 'estado_icono.dart';

/// Chip del estado de un caso.
///
/// Se usa en la ficha y en las filas donde hay espacio para el rótulo; el
/// listado principal sigue con el icono (D-101).
///
/// Los colores vienen del mismo mapa que [EstadoIcono]: los de Material que
/// usaba antes dejaban el texto blanco sobre fondos que no llegan al 4,5:1 que
/// exige **RNF-APK-05** (`Colors.orange` daba 2,2:1).
class EstadoChip extends StatelessWidget {
  final String estado;
  const EstadoChip({super.key, required this.estado});

  @override
  Widget build(BuildContext context) {
    final (icono, tinta, fondo) = EstadoIcono.aspecto(estado);
    final etiqueta = estado.trim().isEmpty ? 'SIN ESTADO' : estado.trim().toUpperCase();
    return Chip(
      avatar: Icon(icono, size: 16, color: tinta),
      label: Text(
        etiqueta,
        style: TextStyle(color: tinta, fontSize: 12.5, fontWeight: FontWeight.w700),
      ),
      backgroundColor: fondo,
      side: BorderSide(color: tinta.withOpacity(0.22)),
      // D-93: el chip va dentro de filas de la ficha y del `trailing` de la
      // tarjeta; con el relleno táctil por defecto (48 px) desbordaba el
      // `ListTile`. Se compacta: la fila completa sigue siendo pulsable.
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
      labelPadding: const EdgeInsets.symmetric(horizontal: 2),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    );
  }
}
