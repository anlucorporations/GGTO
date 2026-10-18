import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Indicador con **icono** del cuadro de MASIVAS de la APK (D-111).
///
/// Resume, en un cuadrado de 34 dp, si la masiva ya tiene **Planificación**,
/// **Materiales** o **Asignación**:
///
///  * **encendido** (activa): la tinta de marca sobre su fondo claro — el mismo
///    par tinta/fondo que usa `EstadoIcono` y que cumple **RNF-APK-05**;
///  * **apagado**: solo el contorno punteado y el icono en `Marca.textoSuave`
///    (5,6:1 sobre blanco), para que no compita con los activos.
///
/// El nombre del indicador **no se pierde**: va en el `Tooltip` y en el
/// `semanticsLabel` (RNF-38), porque el icono no lleva texto visible.
class IndicadorMasiva extends StatelessWidget {
  const IndicadorMasiva({
    super.key,
    required this.icono,
    required this.activa,
    required this.etiqueta,
    this.detalle,
    this.onTap,
  });

  /// Icono del indicador (calendario, caja, cuadrilla).
  final IconData icono;

  /// ¿La masiva ya cumple ese requisito?
  final bool activa;

  /// Nombre corto: «Planificación», «Materiales», «Asignación».
  final String etiqueta;

  /// Texto del `Tooltip`: el estado concreto («sin planificar», «2 orden(es)»…).
  final String? detalle;

  /// Acción al tocar (abre la ficha en la pestaña correspondiente).
  final VoidCallback? onTap;

  /// Lado del cuadrado del indicador.
  static const double lado = 34;

  /// Tinta y fondo de cada indicador cuando está encendido.
  static (Color, Color) aspecto(bool activa, String etiqueta) {
    if (!activa) return (Marca.textoSuave, Colors.transparent);
    switch (etiqueta.trim().toUpperCase()) {
      case 'PLANIFICACIÓN':
        return (Marca.info, Marca.infoClaro);
      case 'MATERIALES':
        return (Marca.alerta, Marca.alertaClaro);
      case 'ASIGNACIÓN':
        return (Marca.exito, Marca.exitoClaro);
      default:
        return (Marca.azul, Marca.contenedor);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (tinta, fondo) = aspecto(activa, etiqueta);
    final titulo = detalle == null ? etiqueta : '$etiqueta: $detalle';

    final caja = Container(
      width: lado,
      height: lado,
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(Marca.radioCampo),
        border: Border.all(
          color: activa ? tinta.withOpacity(0.35) : Marca.bordeFuerte,
        ),
      ),
      alignment: Alignment.center,
      child: Icon(icono, size: 19, color: tinta),
    );

    return Tooltip(
      message: titulo,
      child: Semantics(
        label: titulo,
        button: onTap != null,
        child: onTap == null
            ? caja
            : InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(Marca.radioCampo),
                child: caja,
              ),
      ),
    );
  }
}
