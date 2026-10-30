// D-162 · punto 7: reporte de producción del día en tres columnas.
//
// Se prueba el parser tolerante del contrato (mismos nombres y campos que la
// web), la reconciliación `columnas + mantenimientos + casos_masiva ==
// asignados` y la vista «Despacho del día» con datos simulados. Sin red: aquí
// nunca se construye el cliente HTTP.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/features/monitoreo/despacho_dia.dart';
import 'package:ggto_tecnico/features/monitoreo/grafico.dart';
import 'package:ggto_tecnico/features/monitoreo/monitoreo_screen.dart';

/// Respuesta completa tal como la devuelve
/// `GET /api/v1/despachos/reporte/produccion?fecha=2026-10-30`.
const Map<String, dynamic> _respuestaCompleta = {
  'fecha': '2026-10-30',
  'id_central': 1,
  'por_cuadrilla': [
    {
      'cuadrilla': 'C-001',
      'nombre': 'Cuadrilla Alfa',
      'id_cuadrilla': 11,
      'asignados': 7,
      'abiertos': 1,
      'cerrados': 2,
      'enrutado': 1,
      'citados': 2,
      'diferidos': 0,
      'gestionados': 4,
      'referidos': 1,
      'empresas': 2,
      'es_masiva': true,
      'masivas': [7, 8],
      'construcciones': 1,
      'construcciones_cerradas': 1,
      'mantenimientos': 1,
      'mantenimientos_cerradas': 0,
      'casos_masiva': 1,
      'columnas': {
        'comunes': {
          'asignados': 2,
          'asignados_reparacion': 1,
          'asignados_construccion': 1,
          'cerrados': 1,
          'cerrados_reparacion': 1,
          'cerrados_construccion': 0,
          'enrutado': 0,
          'citado': 1,
          'citado_reparacion': 1,
          'citado_construccion': 0,
          'diferidos': 0,
          'diferidos_reparacion': 0,
          'diferidos_construccion': 0,
        },
        'referidos': {
          'asignados': 1,
          'asignados_reparacion': 1,
          'asignados_construccion': 0,
          'cerrados': 0,
          'cerrados_reparacion': 0,
          'cerrados_construccion': 0,
          'enrutado': 1,
          'citado': 0,
          'citado_reparacion': 0,
          'citado_construccion': 0,
          'diferidos': 0,
          'diferidos_reparacion': 0,
          'diferidos_construccion': 0,
        },
        'empresa': {
          'asignados': 2,
          'asignados_reparacion': 1,
          'asignados_construccion': 1,
          'cerrados': 1,
          'cerrados_reparacion': 0,
          'cerrados_construccion': 1,
          'enrutado': 0,
          'citado': 1,
          'citado_reparacion': 0,
          'citado_construccion': 1,
          'diferidos': 0,
          'diferidos_reparacion': 0,
          'diferidos_construccion': 0,
        },
      },
    },
    {
      'cuadrilla': 'C-002',
      'nombre': 'Cuadrilla Beta',
      'id_cuadrilla': 12,
      'asignados': 12,
      'abiertos': 0,
      'cerrados': 5,
      'enrutado': 3,
      'citados': 5,
      'diferidos': 4,
      'gestionados': 7,
      'referidos': 2,
      'empresas': 3,
      'es_masiva': true,
      'masivas': [11, 12],
      'construcciones': 2,
      'construcciones_cerradas': 2,
      'mantenimientos': 1,
      'mantenimientos_cerradas': 1,
      'casos_masiva': 2,
      'columnas': {
        'comunes': {
          'asignados': 4,
          'asignados_reparacion': 3,
          'asignados_construccion': 1,
          'cerrados': 2,
          'cerrados_reparacion': 1,
          'cerrados_construccion': 1,
          'enrutado': 1,
          'citado': 2,
          'citado_reparacion': 2,
          'citado_construccion': 0,
          'diferidos': 1,
          'diferidos_reparacion': 1,
          'diferidos_construccion': 0,
        },
        'referidos': {
          'asignados': 2,
          'asignados_reparacion': 2,
          'asignados_construccion': 0,
          'cerrados': 1,
          'cerrados_reparacion': 1,
          'cerrados_construccion': 0,
          'enrutado': 1,
          'citado': 1,
          'citado_reparacion': 1,
          'citado_construccion': 0,
          'diferidos': 1,
          'diferidos_reparacion': 1,
          'diferidos_construccion': 0,
        },
        'empresa': {
          'asignados': 3,
          'asignados_reparacion': 2,
          'asignados_construccion': 1,
          'cerrados': 2,
          'cerrados_reparacion': 1,
          'cerrados_construccion': 1,
          'enrutado': 1,
          'citado': 2,
          'citado_reparacion': 0,
          'citado_construccion': 2,
          'diferidos': 2,
          'diferidos_reparacion': 2,
          'diferidos_construccion': 0,
        },
      },
    },
  ],
  'totales': {
    'cuadrilla': null,
    'asignados': 19,
    'abiertos': 1,
    'cerrados': 7,
    'enrutado': 4,
    'citados': 7,
    'diferidos': 4,
    'gestionados': 11,
    'referidos': 3,
    'empresas': 5,
    'es_masiva': true,
    // En los totales `masivas` es un contador (fallas cubiertas), no una lista.
    'masivas': 4,
    'construcciones': 3,
    'construcciones_cerradas': 3,
    'mantenimientos': 2,
    'mantenimientos_cerradas': 1,
    'casos_masiva': 3,
    'columnas': {
      'comunes': {
        'asignados': 6,
        'asignados_reparacion': 4,
        'asignados_construccion': 2,
        'cerrados': 3,
        'cerrados_reparacion': 2,
        'cerrados_construccion': 1,
        'enrutado': 1,
        'citado': 3,
        'citado_reparacion': 3,
        'citado_construccion': 0,
        'diferidos': 1,
        'diferidos_reparacion': 1,
        'diferidos_construccion': 0,
      },
      'referidos': {
        'asignados': 3,
        'asignados_reparacion': 3,
        'asignados_construccion': 0,
        'cerrados': 1,
        'cerrados_reparacion': 1,
        'cerrados_construccion': 0,
        'enrutado': 2,
        'citado': 1,
        'citado_reparacion': 1,
        'citado_construccion': 0,
        'diferidos': 1,
        'diferidos_reparacion': 1,
        'diferidos_construccion': 0,
      },
      'empresa': {
        'asignados': 5,
        'asignados_reparacion': 3,
        'asignados_construccion': 2,
        'cerrados': 3,
        'cerrados_reparacion': 1,
        'cerrados_construccion': 2,
        'enrutado': 1,
        'citado': 3,
        'citado_reparacion': 0,
        'citado_construccion': 3,
        'diferidos': 2,
        'diferidos_reparacion': 2,
        'diferidos_construccion': 0,
      },
    },
  },
};

void main() {
  group('D-162 · parser del reporte del día', () {
    test(
        'interpreta la respuesta completa con las 3 columnas y sus sub-métricas',
        () {
      final despacho = DespachoDia.desdeJson(_respuestaCompleta);

      expect(despacho.fecha, '2026-10-30');
      expect(despacho.idCentral, 1);
      expect(despacho.porCuadrilla.length, 2);

      final alfa = despacho.porCuadrilla.first;
      expect(alfa.cuadrilla, 'C-001');
      expect(alfa.nombre, 'Cuadrilla Alfa');
      expect(alfa.idCuadrilla, 11);
      expect(alfa.etiqueta, 'C-001 — Cuadrilla Alfa');
      expect(alfa.asignados, 7);
      expect(alfa.abiertos, 1);
      expect(alfa.cerrados, 2);
      expect(alfa.enrutado, 1);
      expect(alfa.citados, 2);
      expect(alfa.diferidos, 0);
      expect(alfa.gestionados, 4);
      expect(alfa.referidos, 1);
      expect(alfa.empresas, 2);
      expect(alfa.construcciones, 1);
      expect(alfa.construccionesCerradas, 1);
      expect(alfa.mantenimientos, 1);
      expect(alfa.mantenimientosCerradas, 0);
      expect(alfa.casosMasiva, 1);
      expect(alfa.esMasiva, isTrue);
      // En la fila de cuadrilla `masivas` es la lista de fallas que la cubren.
      expect(alfa.masivas, 2);
      expect(alfa.masivasIds, [7, 8]);

      final comunes = alfa.columnas.comunes;
      expect(comunes.asignados, 2);
      expect(comunes.asignadosReparacion, 1);
      expect(comunes.asignadosConstruccion, 1);
      expect(comunes.cerrados, 1);
      expect(comunes.cerradosReparacion, 1);
      expect(comunes.cerradosConstruccion, 0);
      expect(comunes.enrutado, 0);
      expect(comunes.citado, 1);
      expect(comunes.citadoReparacion, 1);
      expect(comunes.citadoConstruccion, 0);
      expect(comunes.diferidos, 0);
      expect(comunes.diferidosReparacion, 0);
      expect(comunes.diferidosConstruccion, 0);
      expect(alfa.columnas.referidos.enrutado, 1);
      expect(alfa.columnas.empresa.citadoConstruccion, 1);

      // Reconciliación de la fila: 5 columnas + 1 mantenimiento + 1 masiva = 7.
      expect(alfa.totalColumnas, 5);
      expect(alfa.cuadra, isTrue);

      final totales = despacho.totales;
      expect(totales.cuadrilla, isEmpty);
      expect(totales.asignados, 19);
      expect(totales.totalColumnas, 14);
      // En los totales `masivas` es un número y no se inventan ids.
      expect(totales.masivas, 4);
      expect(totales.masivasIds, isEmpty);
      expect(totales.cuadra, isTrue);
      expect(
          14 + totales.mantenimientos + totales.casosMasiva, totales.asignados);
    });

    test('una respuesta vacía o con nulos produce ceros sin romper', () {
      final vacio = DespachoDia.desdeJson(const <String, dynamic>{});
      expect(vacio.fecha, '');
      expect(vacio.idCentral, 0);
      expect(vacio.porCuadrilla, isEmpty);
      expect(vacio.totales.asignados, 0);
      expect(vacio.totales.columnas.comunes.asignados, 0);
      expect(vacio.totales.columnas.empresa.diferidosConstruccion, 0);
      expect(vacio.totales.masivas, 0);
      expect(vacio.totales.cuadra, isTrue);

      final sinListas = DespachoDia.desdeJson(const {
        'por_cuadrilla': null,
        'totales': null,
      });
      expect(sinListas.porCuadrilla, isEmpty);
      expect(sinListas.totales.columnas.referidos.asignados, 0);
    });

    test('tolera textos, dobles, filas inválidas y `masivas` de ambos tipos',
        () {
      final tolerante = DespachoDia.desdeJson(const {
        'fecha': '2026-10-30',
        'id_central': '1',
        'por_cuadrilla': [
          null,
          42,
          {
            'cuadrilla': 'C-003',
            'asignados': '10',
            'masivas': 2,
            'es_masiva': true,
            'columnas': null,
          },
          {
            'cuadrilla': 'C-004',
            'masivas': ['5', 6],
            'columnas': {
              'comunes': {'asignados': '3'},
            },
          },
        ],
        'totales': {'asignados': 3.6, 'masivas': '4'},
      });

      expect(tolerante.idCentral, 1);
      expect(tolerante.porCuadrilla.length, 2);

      final c003 = tolerante.porCuadrilla.first;
      expect(c003.cuadrilla, 'C-003');
      expect(c003.asignados, 10);
      expect(c003.masivas, 2);
      expect(c003.masivasIds, isEmpty);
      expect(c003.columnas.comunes.asignados, 0);
      expect(c003.cuadra, isFalse);

      final c004 = tolerante.porCuadrilla.last;
      expect(c004.masivas, 2);
      expect(c004.masivasIds, [5, 6]);
      expect(c004.columnas.comunes.asignados, 3);

      expect(tolerante.totales.asignados, 4);
      expect(tolerante.totales.masivas, 4);
      expect(FilaDespacho.vacia().asignados, 0);
    });
  });

  group('D-162 · barras y reconciliación', () {
    test('las barras resumen los bloques del día', () {
      final totales = DespachoDia.desdeJson(_respuestaCompleta).totales;
      final barras = barrasDespacho(totales);
      expect(barras.map((b) => b.etiqueta).toList(),
          ['Comunes', 'Referidos', 'Empresa', 'Mantenim.', 'Masivas']);
      expect(barras.map((b) => b.valor).toList(), [6, 3, 5, 2, 3]);
    });

    test('la línea de reconciliación cuadra o avisa del descuadre', () {
      final totales = DespachoDia.desdeJson(_respuestaCompleta).totales;
      final linea = lineaReconciliacion(totales);
      expect(
          linea,
          contains('6 comunes + 3 referidos + 5 empresa + '
              '2 mantenimiento + 3 casos masiva = 19 de 19 asignados'));
      expect(linea, contains('✓'));

      final descuadrada = FilaDespacho.desdeJson(const {'asignados': 10});
      expect(lineaReconciliacion(descuadrada), contains('no cuadra'));
    });
  });

  group('D-162 · vista «Despacho del día»', () {
    testWidgets('muestra columnas, cuadrillas, mantenimiento y reconciliación',
        (tester) async {
      final despacho = DespachoDia.desdeJson(_respuestaCompleta);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(12),
              child: DespachoDiaVista(despacho: despacho),
            ),
          ),
        ),
      );

      expect(find.byType(DespachoDiaVista), findsOneWidget);
      expect(find.text('Central 1'), findsOneWidget);
      expect(find.text('Comunes'), findsOneWidget);
      expect(find.text('Referidos'), findsOneWidget);
      expect(find.text('Empresa'), findsOneWidget);
      expect(find.text('C-001 — Cuadrilla Alfa'), findsOneWidget);
      expect(find.text('C-002 — Cuadrilla Beta'), findsOneWidget);
      expect(find.text('Total'), findsOneWidget);
      expect(find.text('Mantenimiento'), findsOneWidget);
      expect(find.text('Mant. cerradas'), findsOneWidget);
      expect(find.text('Casos masiva'), findsOneWidget);
      expect(find.text('Fallas masivas'), findsOneWidget);
      expect(find.textContaining('Reconciliación: 6 comunes'), findsOneWidget);
      expect(find.textContaining('19 de 19 asignados'), findsOneWidget);
      expect(find.textContaining('no cuadra'), findsNothing);
      expect(find.byType(GraficoBarras), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('tolera totales vacíos y no desborda en un móvil estrecho',
        (tester) async {
      tester.view.physicalSize = const Size(360, 780);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(12),
              child: DespachoDiaVista(
                despacho: DespachoDia.desdeJson(const <String, dynamic>{}),
              ),
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Sin cuadrillas despachadas para la fecha.'),
          findsOneWidget);
      expect(find.textContaining('0 de 0 asignados'), findsOneWidget);
    });
  });
}
