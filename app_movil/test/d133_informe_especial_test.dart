// D-133 · H-16: el especial que requiere informe no se cierra sin él.
//
// `requiere_informe` era decorativo: se mostraba y se editaba, pero ningún camino
// exigía el informe. El backend lo valida (422) y el diálogo de cierre de la APK
// lo pide cuando el especial lo requiere.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/especiales/especiales_screen.dart';

Future<void> _abrirDialogo(
  WidgetTester tester, {
  required bool requiereInforme,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => showDialog<Map<String, String>>(
              context: context,
              builder: (_) => CerrarCasoEspecialDialog(
                titulo: 'Cerrar el especial #1',
                requiereInforme: requiereInforme,
              ),
            ),
            child: const Text('abrir'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
}

Future<void> _escribirDescripcion(WidgetTester tester) async {
  await tester.enterText(
    find.byKey(const Key('especial-descripcion-cierre')),
    'Se atendió al suscriptor y se verificó la línea',
  );
  await tester.pump();
}

void main() {
  group('D-133 · cierre del especial con informe', () {
    testWidgets('sin informe no deja cerrar cuando el especial lo requiere',
        (tester) async {
      await _abrirDialogo(tester, requiereInforme: true);
      expect(find.byKey(const Key('especial-informe')), findsOneWidget);
      await _escribirDescripcion(tester);

      await tester.tap(find.byKey(const Key('especial-confirmar-cierre')));
      await tester.pumpAndSettle();

      expect(find.textContaining('informe de atención'), findsOneWidget);
      expect(find.text('Cerrar el especial #1'), findsOneWidget,
          reason: 'el diálogo sigue abierto');
    });

    testWidgets('con un informe corto tampoco', (tester) async {
      await _abrirDialogo(tester, requiereInforme: true);
      await _escribirDescripcion(tester);
      await tester.enterText(find.byKey(const Key('especial-informe')), 'listo');
      await tester.tap(find.byKey(const Key('especial-confirmar-cierre')));
      await tester.pumpAndSettle();
      expect(find.textContaining('requiere un informe de atención'), findsOneWidget);
    });

    testWidgets('con informe completo cierra y lo devuelve', (tester) async {
      Map<String, String>? resultado;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async {
                  resultado = await showDialog<Map<String, String>>(
                    context: context,
                    builder: (_) => const CerrarCasoEspecialDialog(
                      titulo: 'Cerrar el especial #1',
                      requiereInforme: true,
                    ),
                  );
                },
                child: const Text('abrir'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      await _escribirDescripcion(tester);
      await tester.enterText(
        find.byKey(const Key('especial-informe')),
        'Se reemplazó el conector y se verificó la potencia del servicio.',
      );
      await tester.tap(find.byKey(const Key('especial-confirmar-cierre')));
      await tester.pumpAndSettle();

      expect(resultado, isNotNull);
      expect(resultado!['informe'], startsWith('Se reemplazó'));
    });

    testWidgets('si no requiere informe, el campo no aparece',
        (tester) async {
      await _abrirDialogo(tester, requiereInforme: false);
      expect(find.byKey(const Key('especial-informe')), findsNothing);
      await _escribirDescripcion(tester);
      await tester.tap(find.byKey(const Key('especial-confirmar-cierre')));
      await tester.pumpAndSettle();
      expect(find.text('Cerrar el especial #1'), findsNothing,
          reason: 'se cerró sin pedir informe');
    });
  });
}
