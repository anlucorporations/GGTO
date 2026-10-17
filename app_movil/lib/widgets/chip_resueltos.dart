import 'package:flutter/material.dart';

/// Botón **permanente** para ver los casos ya resueltos del dispositivo (D-105).
///
/// D-101 oculta del listado principal los casos ya gestionados (cerrado,
/// cancelado, enrutado, diferido y citado) y dejaba el conmutador **condicionado**
/// a que hubiera alguno: cuando el técnico terminaba su jornada —o cuando una
/// descarga dejaba el listado vacío— el botón desaparecía y no había forma de
/// volver a ver el trabajo ya resuelto.
///
/// D-105 lo hace incondicional: se pinta siempre, con el conteo real (aunque sea
/// 0), para que el técnico sepa que la puerta al histórico está ahí y no dependa
/// del estado de la lista. Es un widget aparte —y sin lógica— para poder probarlo
/// sin levantar la pantalla completa.
class ChipResueltos extends StatelessWidget {
  const ChipResueltos({
    super.key,
    required this.resueltos,
    required this.viendoResueltos,
    required this.onTap,
  });

  /// Cuántos casos del dispositivo están ya resueltos (gestionados).
  final int resueltos;

  /// ¿Se están mostrando ahora mismo?
  final bool viendoResueltos;

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 2),
      child: Align(
        alignment: Alignment.centerLeft,
        child: FilterChip(
          selected: viendoResueltos,
          avatar: Icon(
            viendoResueltos ? Icons.visibility : Icons.visibility_off,
            size: 18,
          ),
          label: Text('Resueltos ($resueltos)'),
          tooltip: viendoResueltos
              ? 'Ocultar los casos ya resueltos'
              : 'Ver los casos ya resueltos',
          onSelected: (_) => onTap(),
        ),
      ),
    );
  }
}
