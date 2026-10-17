// D-105 · El botón para ver los casos ya resueltos es permanente.
//
// Defecto reportado: tras descargar, la APK decía que los casos ya estaban en el
// dispositivo pero el listado aparecía vacío, y no había forma de volver a ver
// el trabajo resuelto: el conmutador de D-101 solo se pintaba cuando había algún
// caso gestionado. Ahora `ChipResueltos` se pinta **siempre**, con el conteo real
// (aunque sea 0), y sigue siendo el mismo conmutador.
//
// Se prueba el widget aislado (sin proveedores, sin red y sin base de datos),
// igual que el resto de la suite de la APK.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/widgets/chip_resueltos.dart';

Widget _envolver(Widget hijo) => MaterialApp(home: Scaffold(body: hijo));

void main() {
  group('D-105 · botón permanente de casos resueltos', () {
    testWidgets('se pinta aunque no haya ningún caso resuelto', (tester) async {
      await tester.pumpWidget(_envolver(
        ChipResueltos(
          resueltos: 0,
          viendoResueltos: false,
          onTap: () {},
        ),
      ));

      expect(find.byType(ChipResueltos), findsOneWidget);
      expect(find.text('Resueltos (0)'), findsOneWidget);
      expect(find.byIcon(Icons.visibility_off), findsOneWidget);
    });

    testWidgets('muestra el conteo real del dispositivo', (tester) async {
      await tester.pumpWidget(_envolver(
        ChipResueltos(
          resueltos: 7,
          viendoResueltos: false,
          onTap: () {},
        ),
      ));

      expect(find.text('Resueltos (7)'), findsOneWidget);
    });

    testWidgets('al pulsarlo abre la vista de resueltos', (tester) async {
      var pulsaciones = 0;
      await tester.pumpWidget(_envolver(
        ChipResueltos(
          resueltos: 3,
          viendoResueltos: false,
          onTap: () => pulsaciones++,
        ),
      ));

      await tester.tap(find.byType(FilterChip));
      await tester.pump();

      expect(pulsaciones, 1);
    });

    testWidgets('cuando se están viendo, lo indica con el icono de visibilidad',
        (tester) async {
      await tester.pumpWidget(_envolver(
        ChipResueltos(
          resueltos: 2,
          viendoResueltos: true,
          onTap: () {},
        ),
      ));

      expect(find.byIcon(Icons.visibility), findsOneWidget);
      final chip = tester.widget<FilterChip>(find.byType(FilterChip));
      expect(chip.selected, isTrue);
    });
  });
}
