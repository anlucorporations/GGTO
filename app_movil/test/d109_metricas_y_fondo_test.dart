// D-109 · Sincronización de fondo, envío ligero de casos atendidos y métricas
// con gráficos en la APK.
//
// Se prueban las piezas que no dependen del dispositivo: las cadencias de los
// temporizadores, la interpretación de las respuestas de MONITOREO (los mismos
// endpoints que la web) y la aritmética de los gráficos.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/features/mensajes/mensajes_provider.dart';
import 'package:ggto_tecnico/features/monitoreo/grafico.dart';
import 'package:ggto_tecnico/features/monitoreo/monitoreo_api.dart';
import 'package:ggto_tecnico/features/monitoreo/monitoreo_screen.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';

void main() {
  group('D-109 · cadencias de sincronización', () {
    test('los mensajes se sondean cada 60 segundos', () {
      expect(MensajesProvider.intervaloSondeo, const Duration(seconds: 60));
    });

    test('los casos atendidos se envían solos cada 5 minutos', () {
      expect(SyncProvider.intervaloAutoEnvio, const Duration(minutes: 5));
    });
  });

  group('D-109 · métricas de MONITOREO (mismos datos que la web)', () {
    test('el resumen diario interpreta las cifras del servidor', () {
      final diario = DiarioMonitoreo.desdeJson(const {
        'fecha': '2026-10-17',
        'ingresos_nuevos': 12,
        'resueltos_residencial': 5,
        'resueltos_empresarial': 2,
        'resueltos_reparaciones_referidas': 1,
        'resueltos_construccion': 2,
        'citados': 3,
        'diferidos': 4,
        'gestionados': 6,
      });
      expect(diario.fecha, '2026-10-17');
      expect(diario.ingresosNuevos, 12);
      expect(diario.resueltosTotal, 10);
      expect(diario.resueltosReparacionesReferidas, 1);
      expect(diario.resueltosConstruccion, 2);

      final barras = barrasDiario(diario);
      expect(barras.length, 8);
      expect(barras.first.etiqueta, 'Ingresos');
      expect(barras.first.valor, 12);
      expect(barras.map((b) => b.etiqueta), contains('Rep. referidas'));
      expect(barras.map((b) => b.etiqueta), contains('Construcciones'));
      expect(barras.map((b) => b.etiqueta), isNot(contains('Pendientes')));
    });

    test('la curva semanal y sus totales', () {
      final semanal = SemanalMonitoreo.desdeJson(const {
        'desde': '2026-10-12',
        'hasta': '2026-10-17',
        'dias': [
          {'fecha': '2026-10-12', 'asignados': 4, 'cerrados': 3, 'gestionados': 1},
          {'fecha': '2026-10-13', 'asignados': 6, 'cerrados': 2, 'gestionados': 2},
        ],
      });
      expect(semanal.dias.length, 2);
      expect(semanal.dias.first.etiqueta, 'lun');
      expect(semanal.cerrados, 5);
      expect(semanal.asignados, 10);
      expect(semanal.gestionados, 3);
    });

    test('los globales ordenan las barras por estado de mayor a menor', () {
      final globales = GlobalesMonitoreo.desdeJson(const {
        'desde': '2026-10-01',
        'hasta': '2026-10-17',
        'pendientes': 30,
        'resueltos': 70,
        'total': 100,
        'referidos': 12,
        'construccion': 8,
        'cerrados_comunes': 40,
        'por_estado': {'NUEVO': 10, 'CERRADO': 70, 'CITADO': 20},
        'por_categoria': {'REPARACION': 60},
      });
      expect(globales.total, 100);
      expect(globales.referidos, 12);
      expect(globales.construccion, 8);
      expect(globales.cerradosComunes, 40);
      final barras = barrasPorEstado(globales);
      expect(barras.map((b) => b.etiqueta).toList(), ['CERRADO', 'CITADO', 'NUEVO']);
    });

    test('reparación, construcción, cuadrillas y capacidad', () {
      final reparacion = ReparacionMonitoreo.desdeJson(const {
        'residenciales_comunes': 7,
        'residenciales_referidos': 2,
        'empresariales': 1,
        'total': 10,
      });
      expect(reparacion.total, 10);
      expect(reparacion.residencialesComunes, 7);

      final construccion = ConstruccionMonitoreo.desdeJson(const {
        'residenciales': 3,
        'empresariales': 1,
        'total': 4,
      });
      expect(construccion.total, 4);

      final cuadrillas = CuadrillasMonitoreo.desdeJson(const {
        'desde': '2026-10-12',
        'dias': 6,
        'cuadrillas': [
          {
            'id_cuadrilla': 11,
            'codigo': 'C-001',
            'nombre': 'Cuadrilla 1',
            'dias': [],
            'totales': {'asignados': 8, 'cerrados': 6, 'gestionados': 2},
          },
        ],
      });
      expect(cuadrillas.cuadrillas.single.codigo, 'C-001');
      expect(cuadrillas.cuadrillas.single.cerrados, 6);

      final capacidad = CapacidadMonitoreo.desdeJson(const {
        'cuadrillas_activas': 4,
        'tecnicos_activos': 9,
        'flota_disponible': 3,
        'herramientas_disponibles': 12,
        'sectores_activos': 8,
        'cuadrillas': [
          {'codigo': 'C-001', 'nombre': 'Cuadrilla 1', 'integrantes': 2, 'flota': 'AB123CD',
            'completa': true, 'es_supervisor': false},
        ],
      });
      expect(capacidad.tecnicosActivos, 9);
      expect(capacidad.cuadrillas.single.completa, isTrue);
      expect(capacidad.cuadrillas.single.flota, 'AB123CD');
    });

    test('las cifras toleran textos y nulos', () {
      expect(numero('7'), 7);
      expect(numero(null), 0);
      expect(numero(3.6), 4);
      expect(mapaNumeros(const {'A': '2', 'B': 3}), {'A': 2, 'B': 3});
      expect(mapaNumeros(null), isEmpty);
    });
  });

  group('D-109 · aritmética y dibujo de los gráficos', () {
    test('proporciones y porcentajes', () {
      expect(maximoDe([0, 0]), 1);
      expect(maximoDe([3, 9, 2]), 9);
      expect(proporciones([3, 9]), [closeTo(1 / 3, 0.001), 1.0]);
      expect(porcentaje(30, 120), 25);
      expect(porcentaje(1, 0), 0);
    });

    testWidgets('el gráfico de barras se pinta y se anuncia', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: GraficoBarras(datos: [
            DatoBarra('Ingresos', 12),
            DatoBarra('Resueltos', 8),
          ]),
        ),
      ));
      expect(find.byType(GraficoBarras), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Ingresos 12')), findsOneWidget);
    });

    testWidgets('el donut muestra el total y los porcentajes', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: GraficoDonut(
            porciones: [
              PorcionGrafico('Comunes', 6, Colors.blue),
              PorcionGrafico('Referidos', 2, Colors.orange),
              PorcionGrafico('Empresariales', 2, Colors.green),
            ],
            centro: '10',
            centroEtiqueta: 'casos',
          ),
        ),
      ));
      expect(find.text('10'), findsWidgets);
      expect(find.text('casos'), findsOneWidget);
      expect(find.textContaining('6 (60 %'), findsOneWidget);
    });

    testWidgets('las líneas y las barras agrupadas se construyen', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              GraficoLineas(
                etiquetas: ['lun', 'mar'],
                series: [
                  SerieGrafico('Asignados', [4, 6], Colors.blue),
                  SerieGrafico('Cerrados', [3, 2], Colors.green),
                ],
              ),
              GraficoBarrasAgrupadas(
                etiquetas: ['C-001'],
                series: [SerieGrafico('Cerrados', [6], Colors.green)],
              ),
            ],
          ),
        ),
      ));
      expect(find.byType(GraficoLineas), findsOneWidget);
      expect(find.byType(GraficoBarrasAgrupadas), findsOneWidget);
      expect(find.text('Asignados'), findsOneWidget);
    });
  });
}
