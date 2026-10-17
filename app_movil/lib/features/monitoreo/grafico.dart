import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Gráficos del tablero de MONITOREO (D-109), dibujados con `CustomPainter`.
///
/// No se añaden librerías: la APK mantiene su tamaño y funciona sin conexión una
/// vez cargados los datos. Se replican los cuatro tipos de la web
/// (`GraficoBarras`, `GraficoBarrasAgrupadas`, `GraficoLineas`, `GraficoTorta`)
/// con la misma paleta.

/// Paleta común (la misma de la web).
const List<Color> paletaGraficos = [
  Marca.azul,
  Marca.exito,
  Marca.alerta,
  Marca.error,
  Marca.especial,
  Marca.enrutado,
];

/// Una barra: etiqueta y valor.
class DatoBarra {
  const DatoBarra(this.etiqueta, this.valor, {this.color});
  final String etiqueta;
  final int valor;
  final Color? color;
}

/// Una serie de un gráfico de líneas o de barras agrupadas.
class SerieGrafico {
  const SerieGrafico(this.nombre, this.valores, this.color);
  final String nombre;
  final List<int> valores;
  final Color color;
}

/// Una porción de la torta/donut.
class PorcionGrafico {
  const PorcionGrafico(this.etiqueta, this.valor, this.color);
  final String etiqueta;
  final int valor;
  final Color color;
}

// ------------------------------------------------------------------------- //
// Ayudas puras (verificables sin pintar)
// ------------------------------------------------------------------------- //

/// Valor máximo de una lista de enteros, con 1 como suelo (evita dividir por 0).
int maximoDe(Iterable<int> valores) {
  var maximo = 0;
  for (final valor in valores) {
    if (valor > maximo) maximo = valor;
  }
  return maximo <= 0 ? 1 : maximo;
}

/// Proporción de cada valor respecto al máximo (0..1).
List<double> proporciones(List<int> valores, {int? maximo}) {
  final tope = maximo ?? maximoDe(valores);
  return [for (final valor in valores) (valor / tope).clamp(0.0, 1.0)];
}

/// Porcentaje entero de una porción sobre el total.
int porcentaje(int valor, int total) => total <= 0 ? 0 : ((valor / total) * 100).round();

// ------------------------------------------------------------------------- //
// Barras verticales
// ------------------------------------------------------------------------- //

class GraficoBarras extends StatelessWidget {
  const GraficoBarras({super.key, required this.datos, this.alto = 220});

  final List<DatoBarra> datos;
  final double alto;

  @override
  Widget build(BuildContext context) {
    final maximo = maximoDe(datos.map((d) => d.valor));
    return Semantics(
      label: 'Gráfico de barras: '
          '${datos.map((d) => '${d.etiqueta} ${d.valor}').join(', ')}',
      child: SizedBox(
        height: alto,
        width: double.infinity,
        child: CustomPaint(
          painter: _PintorBarras(datos: datos, maximo: maximo),
        ),
      ),
    );
  }
}

class _PintorBarras extends CustomPainter {
  _PintorBarras({required this.datos, required this.maximo});

  final List<DatoBarra> datos;
  final int maximo;

  @override
  void paint(Canvas canvas, Size size) {
    if (datos.isEmpty) return;
    const margenInferior = 34.0;
    const margenSuperior = 18.0;
    final altoBarra = size.height - margenInferior - margenSuperior;
    final anchoHueco = size.width / datos.length;
    final anchoBarra = math.min(38.0, anchoHueco * 0.62);
    final pincel = Paint()..style = PaintingStyle.fill;

    for (var i = 0; i < datos.length; i++) {
      final dato = datos[i];
      final centro = anchoHueco * i + anchoHueco / 2;
      final proporcion = (dato.valor / maximo).clamp(0.0, 1.0);
      final altura = altoBarra * proporcion;
      final rect = Rect.fromLTWH(
        centro - anchoBarra / 2,
        margenSuperior + (altoBarra - altura),
        anchoBarra,
        altura,
      );
      pincel.color = dato.color ?? paletaGraficos[i % paletaGraficos.length];
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(5)),
        pincel,
      );
      _texto(canvas, '${dato.valor}', Offset(centro, rect.top - 12),
          tamano: 10.5, color: Marca.texto, centrado: true);
      _texto(canvas, dato.etiqueta, Offset(centro, size.height - 20),
          tamano: 9.5, color: Marca.textoSuave, centrado: true, anchoMax: anchoHueco);
    }
  }

  @override
  bool shouldRepaint(_PintorBarras anterior) =>
      anterior.datos != datos || anterior.maximo != maximo;
}

// ------------------------------------------------------------------------- //
// Barras agrupadas (varias series por etiqueta)
// ------------------------------------------------------------------------- //

class GraficoBarrasAgrupadas extends StatelessWidget {
  const GraficoBarrasAgrupadas({
    super.key,
    required this.etiquetas,
    required this.series,
    this.alto = 230,
  });

  final List<String> etiquetas;
  final List<SerieGrafico> series;
  final double alto;

  @override
  Widget build(BuildContext context) {
    final maximo = maximoDe(series.expand((s) => s.valores));
    return Semantics(
      label: 'Gráfico agrupado de ${series.map((s) => s.nombre).join(', ')}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              for (final serie in series)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 10, height: 10, color: serie.color),
                    const SizedBox(width: 4),
                    Text(serie.nombre,
                        style: const TextStyle(fontSize: 11.5, color: Marca.textoSuave)),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: alto,
            width: double.infinity,
            child: CustomPaint(
              painter: _PintorBarrasAgrupadas(
                etiquetas: etiquetas,
                series: series,
                maximo: maximo,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PintorBarrasAgrupadas extends CustomPainter {
  _PintorBarrasAgrupadas({
    required this.etiquetas,
    required this.series,
    required this.maximo,
  });

  final List<String> etiquetas;
  final List<SerieGrafico> series;
  final int maximo;

  @override
  void paint(Canvas canvas, Size size) {
    if (etiquetas.isEmpty || series.isEmpty) return;
    const margenInferior = 30.0;
    const margenSuperior = 12.0;
    final altoBarra = size.height - margenInferior - margenSuperior;
    final anchoGrupo = size.width / etiquetas.length;
    final anchoBarra =
        math.min(16.0, (anchoGrupo * 0.72) / series.length);
    final pincel = Paint()..style = PaintingStyle.fill;

    for (var i = 0; i < etiquetas.length; i++) {
      final inicioGrupo = anchoGrupo * i;
      final totalBarras = anchoBarra * series.length;
      final desde = inicioGrupo + (anchoGrupo - totalBarras) / 2;
      for (var s = 0; s < series.length; s++) {
        final valor = i < series[s].valores.length ? series[s].valores[i] : 0;
        final altura = altoBarra * (valor / maximo).clamp(0.0, 1.0);
        final rect = Rect.fromLTWH(
          desde + s * anchoBarra,
          margenSuperior + (altoBarra - altura),
          anchoBarra - 1.5,
          altura,
        );
        pincel.color = series[s].color;
        canvas.drawRRect(
          RRect.fromRectAndRadius(rect, const Radius.circular(3)),
          pincel,
        );
      }
      _texto(canvas, etiquetas[i], Offset(inicioGrupo + anchoGrupo / 2, size.height - 18),
          tamano: 9.5, color: Marca.textoSuave, centrado: true, anchoMax: anchoGrupo);
    }
  }

  @override
  bool shouldRepaint(_PintorBarrasAgrupadas anterior) =>
      anterior.etiquetas != etiquetas || anterior.series != series;
}

// ------------------------------------------------------------------------- //
// Líneas
// ------------------------------------------------------------------------- //

class GraficoLineas extends StatelessWidget {
  const GraficoLineas({
    super.key,
    required this.etiquetas,
    required this.series,
    this.alto = 240,
  });

  final List<String> etiquetas;
  final List<SerieGrafico> series;
  final double alto;

  @override
  Widget build(BuildContext context) {
    final maximo = maximoDe(series.expand((s) => s.valores));
    return Semantics(
      label: 'Gráfico de líneas de ${series.map((s) => s.nombre).join(', ')}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              for (final serie in series)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 10, height: 10, color: serie.color),
                    const SizedBox(width: 4),
                    Text(serie.nombre,
                        style: const TextStyle(fontSize: 11.5, color: Marca.textoSuave)),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: alto,
            width: double.infinity,
            child: CustomPaint(
              painter: _PintorLineas(
                etiquetas: etiquetas,
                series: series,
                maximo: maximo,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PintorLineas extends CustomPainter {
  _PintorLineas({required this.etiquetas, required this.series, required this.maximo});

  final List<String> etiquetas;
  final List<SerieGrafico> series;
  final int maximo;

  @override
  void paint(Canvas canvas, Size size) {
    if (etiquetas.isEmpty || series.isEmpty) return;
    const margenInferior = 28.0;
    const margenSuperior = 14.0;
    const margenLateral = 8.0;
    final alto = size.height - margenSuperior - margenInferior;
    final ancho = size.width - margenLateral * 2;
    final paso = etiquetas.length > 1 ? ancho / (etiquetas.length - 1) : 0.0;

    // Rejilla de referencia (tercios).
    final rejilla = Paint()
      ..color = Marca.borde
      ..strokeWidth = 1;
    for (var i = 0; i <= 2; i++) {
      final y = margenSuperior + alto * (i / 2);
      canvas.drawLine(Offset(margenLateral, y), Offset(size.width - margenLateral, y), rejilla);
    }

    for (final serie in series) {
      final trazo = Paint()
        ..color = serie.color
        ..strokeWidth = 2.2
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;
      final puntos = <Offset>[];
      for (var i = 0; i < etiquetas.length; i++) {
        final valor = i < serie.valores.length ? serie.valores[i] : 0;
        final x = margenLateral + paso * i;
        final y = margenSuperior + alto * (1 - (valor / maximo).clamp(0.0, 1.0));
        puntos.add(Offset(x, y));
      }
      final camino = Path()..moveTo(puntos.first.dx, puntos.first.dy);
      for (final punto in puntos.skip(1)) {
        camino.lineTo(punto.dx, punto.dy);
      }
      canvas.drawPath(camino, trazo);
      for (var i = 0; i < puntos.length; i++) {
        canvas.drawCircle(puntos[i], 3.2, Paint()..color = serie.color);
        final valor = i < serie.valores.length ? serie.valores[i] : 0;
        _texto(canvas, '$valor', Offset(puntos[i].dx, puntos[i].dy - 12),
            tamano: 9, color: Marca.textoSuave, centrado: true);
      }
    }

    for (var i = 0; i < etiquetas.length; i++) {
      final x = margenLateral + paso * i;
      _texto(canvas, etiquetas[i], Offset(x, size.height - 16),
          tamano: 9.5, color: Marca.textoSuave, centrado: true, anchoMax: paso + 12);
    }
  }

  @override
  bool shouldRepaint(_PintorLineas anterior) =>
      anterior.etiquetas != etiquetas || anterior.series != series;
}

// ------------------------------------------------------------------------- //
// Donut
// ------------------------------------------------------------------------- //

class GraficoDonut extends StatelessWidget {
  const GraficoDonut({
    super.key,
    required this.porciones,
    this.centro = '',
    this.centroEtiqueta = '',
    this.alto = 220,
  });

  final List<PorcionGrafico> porciones;
  final String centro;
  final String centroEtiqueta;
  final double alto;

  @override
  Widget build(BuildContext context) {
    final total = porciones.fold(0, (suma, p) => suma + p.valor);
    return Semantics(
      label: 'Gráfico circular: '
          '${porciones.map((p) => '${p.etiqueta} ${p.valor}').join(', ')}',
      child: Row(
        children: [
          SizedBox(
            width: alto,
            height: alto,
            child: CustomPaint(
              painter: _PintorDonut(porciones: porciones, total: total),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(centro,
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w800, color: Marca.texto)),
                    if (centroEtiqueta.isNotEmpty)
                      Text(centroEtiqueta,
                          style: const TextStyle(fontSize: 10.5, color: Marca.textoSuave)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (final porcion in porciones)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        Container(width: 10, height: 10, color: porcion.color),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(porcion.etiqueta,
                              style: const TextStyle(fontSize: 12, color: Marca.texto)),
                        ),
                        Text(
                          '${porcion.valor} (${porcentaje(porcion.valor, total)} %)',
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600, color: Marca.textoSuave),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PintorDonut extends CustomPainter {
  _PintorDonut({required this.porciones, required this.total});

  final List<PorcionGrafico> porciones;
  final int total;

  @override
  void paint(Canvas canvas, Size size) {
    final centro = Offset(size.width / 2, size.height / 2);
    final radio = math.min(size.width, size.height) / 2 - 6;
    final grosor = radio * 0.42;
    final anillo = Rect.fromCircle(center: centro, radius: radio - grosor / 2);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = grosor
      ..color = Marca.contenedor;
    canvas.drawArc(anillo, 0, math.pi * 2, false, base);
    if (total <= 0) return;

    var inicio = -math.pi / 2;
    for (var i = 0; i < porciones.length; i++) {
      final porcion = porciones[i];
      final barrido = math.pi * 2 * (porcion.valor / total);
      final pincel = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = grosor
        ..color = porcion.color
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(anillo, inicio, barrido, false, pincel);
      inicio += barrido;
    }
  }

  @override
  bool shouldRepaint(_PintorDonut anterior) =>
      anterior.porciones != porciones || anterior.total != total;
}

// ------------------------------------------------------------------------- //
// Texto con TextPainter (para los pintores)
// ------------------------------------------------------------------------- //

void _texto(
  Canvas canvas,
  String valor,
  Offset posicion, {
  required double tamano,
  required Color color,
  bool centrado = false,
  double? anchoMax,
}) {
  final pintor = TextPainter(
    text: TextSpan(text: valor, style: TextStyle(fontSize: tamano, color: color)),
    textDirection: TextDirection.ltr,
    maxLines: 1,
    ellipsis: '…',
  );
  pintor.layout(maxWidth: anchoMax ?? double.infinity);
  final dx = centrado ? posicion.dx - pintor.width / 2 : posicion.dx;
  pintor.paint(canvas, Offset(dx, posicion.dy));
}
