// Pruebas del incremento D-86 (mensajería legible).
//
// Cubren las ayudas puras (orden, filtros y agrupación por día) y la bandeja:
// el más reciente primero, los encabezados de día, el filtro de no leídos y la
// acción de marcado masivo.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/features/auth/auth_provider.dart';
import 'package:ggto_tecnico/features/mensajes/mensajes_provider.dart';
import 'package:ggto_tecnico/features/mensajes/mensajes_screen.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';

/// Proveedor con una bandeja fija, sin base de datos ni red.
///
/// Respeta el mismo contrato que el real: `mensajes` sale **del más reciente al
/// más antiguo** (el orden lo garantiza `ordenarMasRecientePrimero`, que tiene su
/// propia prueba unitaria).
class _MensajesEspia extends MensajesProvider {
  _MensajesEspia(this._datos);

  final List<Map<String, dynamic>> _datos;

  @override
  List<Map<String, dynamic>> get mensajes =>
      MensajesProvider.ordenarMasRecientePrimero(_datos);

  @override
  int get noLeidos => _datos.where((m) => m['leido'] != true).length;
}

Map<String, dynamic> _mensaje(int id, String cuerpo, DateTime fecha,
        {bool leido = false}) =>
    {
      'id_mensaje': id,
      'tipo': 'TEXTO',
      'cuerpo': cuerpo,
      'leido': leido,
      'creado_en': fecha.toIso8601String(),
    };

Widget _pantalla(MensajesProvider prov) => MultiProvider(
      providers: [
        ChangeNotifierProvider<MensajesProvider>.value(value: prov),
        ChangeNotifierProvider<SyncProvider>(create: (_) => SyncProvider()),
        ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider()),
      ],
      child: const MaterialApp(home: MensajesScreen()),
    );

void main() {
  final ahora = DateTime.now();
  final hoy = DateTime(ahora.year, ahora.month, ahora.day, 9, 30);
  final ayer = hoy.subtract(const Duration(days: 1));

  group('D-86 · ayudas puras', () {
    test('ordena del más reciente al más antiguo (DEC-4)', () {
      final items = [
        _mensaje(1, 'uno', hoy),
        _mensaje(3, 'tres', hoy),
        _mensaje(2, 'dos', hoy),
      ];
      final orden = MensajesProvider.ordenarMasRecientePrimero(items)
          .map((m) => m['id_mensaje'])
          .toList();
      expect(orden, [3, 2, 1]);
      // No muta la lista original.
      expect(items.first['id_mensaje'], 1);
    });

    test('filtra por tipo y por no leídos (DEC-2: sin borrado)', () {
      final items = [
        {..._mensaje(1, 'texto', hoy), 'tipo': 'TEXTO'},
        {..._mensaje(2, 'alarma', hoy, leido: true), 'tipo': 'ALARMA_DESPACHO'},
        {
          ..._mensaje(3, 'recordatorio', hoy),
          'tipo': 'RECORDATORIO_CITA',
        },
      ];
      expect(MensajesProvider.filtrar(items).length, 3);
      expect(
        MensajesProvider.filtrar(items, tipos: {'TEXTO', 'RECORDATORIO_CITA'})
            .map((m) => m['id_mensaje']),
        [1, 3],
      );
      expect(
        MensajesProvider.filtrar(items, soloNoLeidos: true)
            .map((m) => m['id_mensaje']),
        [1, 3],
      );
      expect(
        MensajesProvider.filtrar(items, tipos: {'TEXTO'}, soloNoLeidos: true)
            .map((m) => m['id_mensaje']),
        [1],
      );
    });

    test('rotula el día de cada mensaje', () {
      expect(MensajesProvider.etiquetaDia(hoy, ahora: ahora), 'Hoy');
      expect(MensajesProvider.etiquetaDia(ayer, ahora: ahora), 'Ayer');
      expect(
        MensajesProvider.etiquetaDia(DateTime(2026, 1, 5), ahora: ahora),
        '05/01/2026',
      );
    });

    test('lee la fecha de creación del mensaje', () {
      final fecha = MensajesProvider.fechaDe(_mensaje(1, 'x', hoy));
      expect(fecha, isNotNull);
      expect(fecha!.day, hoy.day);
      expect(MensajesProvider.fechaDe({'id_mensaje': 9}), isNull);
    });
  });

  group('D-86 · bandeja', () {
    testWidgets('muestra el más reciente arriba y agrupa por día',
        (tester) async {
      final prov = _MensajesEspia([
        _mensaje(1, 'Mensaje de ayer', ayer),
        _mensaje(2, 'Mensaje leído', hoy, leido: true),
        _mensaje(3, 'Mensaje nuevo', hoy),
      ]);

      await tester.pumpWidget(_pantalla(prov));
      await tester.pumpAndSettle();

      expect(find.text('Hoy'), findsOneWidget);
      expect(find.text('Ayer'), findsOneWidget);

      final nuevo = tester.getTopLeft(find.text('Mensaje nuevo')).dy;
      final leido = tester.getTopLeft(find.text('Mensaje leído')).dy;
      final viejo = tester.getTopLeft(find.text('Mensaje de ayer')).dy;
      expect(nuevo, lessThan(leido),
          reason: 'el más reciente debe ir primero');
      expect(leido, lessThan(viejo));
    });

    testWidgets('el filtro de no leídos oculta los leídos', (tester) async {
      final prov = _MensajesEspia([
        _mensaje(1, 'Mensaje de ayer', ayer),
        _mensaje(2, 'Mensaje leído', hoy, leido: true),
        _mensaje(3, 'Mensaje nuevo', hoy),
      ]);

      await tester.pumpWidget(_pantalla(prov));
      await tester.pumpAndSettle();

      expect(find.text('No leídos (2)'), findsOneWidget);
      expect(find.byTooltip('Marcar todos como leídos'), findsOneWidget);

      await tester.tap(find.text('No leídos (2)'));
      await tester.pumpAndSettle();

      expect(find.text('Mensaje leído'), findsNothing);
      expect(find.text('Mensaje nuevo'), findsOneWidget);
      expect(find.text('Mensaje de ayer'), findsOneWidget);
    });

    testWidgets('sin mensajes avisa y no ofrece marcado masivo', (tester) async {
      final prov = _MensajesEspia([]);
      await tester.pumpWidget(_pantalla(prov));
      await tester.pumpAndSettle();

      expect(find.text('Sin mensajes.'), findsOneWidget);
      expect(find.byTooltip('Marcar todos como leídos'), findsNothing);
    });
  });
}
