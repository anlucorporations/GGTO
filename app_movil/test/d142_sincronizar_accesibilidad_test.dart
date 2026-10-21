// D-142 · H-25: la pantalla Sincronizar avisa antes de purgar y usa la marca.
//
// La auditoría señaló tres cosas: colores fuera del sistema de marca (contraste
// < 4,5:1), progreso sin semántica para lectores de pantalla y purga de casos sin
// confirmación ni anuncio. Aquí se fija la confirmación (el resto se verifica con
// `flutter analyze` y la revisión visual).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/sync/sync_screen.dart';

void main() {
  group('D-142 · confirmación antes de actualizar', () {
    testWidgets('explica la purga y permite cancelar', (tester) async {
      bool? resultado;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async {
                  resultado = await showDialog<bool>(
                    context: context,
                    builder: (_) => const ConfirmarSincronizacionDialog(),
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

      expect(find.text('¿Actualizar los datos?'), findsOneWidget);
      expect(
        find.textContaining('NO atendidos de jornadas anteriores'),
        findsOneWidget,
        reason: 'el técnico debe saber que se quitan casos del teléfono',
      );

      await tester.tap(find.byKey(const Key('sincronizar-cancelar')));
      await tester.pumpAndSettle();
      expect(resultado, isFalse);
      expect(find.text('¿Actualizar los datos?'), findsNothing);
    });

    testWidgets('confirmar devuelve true', (tester) async {
      bool? resultado;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async {
                  resultado = await showDialog<bool>(
                    context: context,
                    builder: (_) => const ConfirmarSincronizacionDialog(),
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
      await tester.tap(find.byKey(const Key('sincronizar-confirmar')));
      await tester.pumpAndSettle();
      expect(resultado, isTrue);
    });
  });
}
