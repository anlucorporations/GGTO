// Pruebas del ciclo D-93 (el identificador de pago en la APK).
//
// Cubren la regla de los números (normalización RN-IP-07, detección del 70*),
// la CABECERA con el identificador de pago en solo lectura y el número de
// contacto, los rótulos de la ficha y de la tarjeta, y la ayuda del diálogo de
// edición del contacto.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/features/casos/acciones_caso.dart';
import 'package:ggto_tecnico/features/casos/caso_detalle_screen.dart';
import 'package:ggto_tecnico/features/casos/casos_provider.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';
import 'package:ggto_tecnico/widgets/caso_card.dart';

class _CasosEspia extends CasosProvider {
  _CasosEspia(this._datos);

  final List<Map<String, dynamic>> _datos;

  @override
  List<Map<String, dynamic>> get casos => _datos;
}

Map<String, dynamic> _caso({
  String identificador = '7014000848',
  String contacto = '4223109000',
  String estado = 'NUEVO',
}) =>
    {
      'id_averia': '28633781',
      'id_caso': 284,
      'estado_actual': estado,
      'nombre_cliente': 'CLIENTE D93',
      'telefono': identificador,
      'contacto_cliente': contacto,
      'direccion': 'CALLE 4 CON AV 5',
    };

Widget _ficha(Map<String, dynamic> caso) => MultiProvider(
      providers: [
        ChangeNotifierProvider<CasosProvider>.value(value: _CasosEspia([caso])),
        ChangeNotifierProvider<SyncProvider>(create: (_) => SyncProvider()),
      ],
      child: MaterialApp(home: CasoDetalleScreen(caso: caso)),
    );

void main() {
  group('D-93 · reglas de número', () {
    test('normaliza como el servidor (RN-IP-07)', () {
      expect(normalizarNumero('7014000848'), '7014000848');
      expect(normalizarNumero('701-400.0848'), '7014000848');
      expect(normalizarNumero('+58 0414-222-3344'), '4142223344');
      expect(normalizarNumero('0058 701 400 0848'), '7014000848');
      expect(normalizarNumero('0422-310-9000'), '4223109000');
      expect(normalizarNumero('SIN NUMERO'), '');
    });

    test('el 70* es el identificador de pago (DEC-IP-1)', () {
      expect(esIdentificadorPago('7014000848'), isTrue);
      expect(esIdentificadorPago('700 123 4567'), isTrue);
      expect(esIdentificadorPago('7029999999'), isTrue);
      expect(esIdentificadorPago('7030000000'), isTrue);
      expect(esIdentificadorPago('04142223344'), isFalse);
      expect(esIdentificadorPago('70140008'), isFalse);
      expect(esIdentificadorPago(''), isFalse);
    });

    test('cualquier número es un contacto válido; solo el vacío de dígitos falla', () {
      expect(errorNumeroContacto('04142223344'), isNull);
      expect(errorNumeroContacto('+58 414-222-3344'), isNull);
      expect(errorNumeroContacto('7014000848'), isNull);
      expect(errorNumeroContacto('  '), isNull);
      expect(errorNumeroContacto('---'), contains('válido'));
    });
  });

  group('D-93 · ficha del caso', () {
    testWidgets('la cabecera rotula el identificador de pago y el contacto',
        (tester) async {
      await tester.pumpWidget(_ficha(_caso()));
      await tester.pumpAndSettle();

      expect(find.textContaining('Identificador de pago (70*): 7014000848'),
          findsOneWidget);
      expect(find.textContaining('Número de contacto: 4223109000'), findsOneWidget);
    });

    testWidgets('sin identificador lo advierte en la cabecera', (tester) async {
      await tester.pumpWidget(_ficha(_caso(identificador: '', contacto: '')));
      await tester.pumpAndSettle();

      expect(find.textContaining('Sin identificador de pago'), findsOneWidget);
      expect(find.textContaining('Sin número de contacto'), findsOneWidget);
    });

    testWidgets('el grupo Contacto usa los rótulos nuevos', (tester) async {
      await tester.pumpWidget(_ficha(_caso()));
      await tester.pumpAndSettle();

      expect(find.text('Identificador de pago (70*)'), findsOneWidget);
      expect(find.text('Número de contacto'), findsOneWidget);
      expect(find.text('Teléfono'), findsNothing);
      expect(find.text('Contacto'), findsOneWidget); // el título del grupo
    });

    testWidgets('el diálogo de edición explica que un 70* es el identificador',
        (tester) async {
      await tester.pumpWidget(_ficha(_caso()));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Editar dirección y contacto'));
      await tester.pumpAndSettle();

      expect(find.text('Editar el contacto'), findsOneWidget);
      // El campo arranca con el **contacto** vigente, no con el identificador.
      expect(find.widgetWithText(TextFormField, '4223109000'), findsOneWidget);
      expect(find.textContaining('se registra como identificador de pago'),
          findsOneWidget);

      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
    });
  });

  group('D-93 · tarjeta de la lista', () {
    testWidgets('muestra el teléfono de contacto, no el identificador de pago',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CasoCard(caso: _caso(), onTap: () {}),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // El teléfono para contactar es el contacto.
      expect(find.textContaining('Contacto: 4223109000'), findsOneWidget);
      // El 70* es el identificador de pago: no se ofrece como teléfono.
      expect(find.textContaining('7014000848'), findsNothing);
      expect(find.textContaining('Tel: '), findsNothing);
    });

    testWidgets('sin contacto no inventa un teléfono', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CasoCard(caso: _caso(contacto: ''), onTap: () {}),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Contacto:'), findsNothing);
      expect(find.textContaining('7014000848'), findsNothing);
    });
  });
}
