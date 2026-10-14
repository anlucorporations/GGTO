// Pruebas del incremento D-88 (flujo de campo completo).
//
// Cubren la regla del «No Contesta» (acción nueva en NUEVO/ASIGNADO/EN_GESTION),
// la edición del contacto desde el campo (D-93: cualquier número; el 70* se
// registra como identificador de pago), la cita de 1ra visita propuesta y su
// presencia en la ficha, además del conteo de imágenes.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/features/casos/acciones_caso.dart';
import 'package:ggto_tecnico/features/casos/caso_detalle_screen.dart';
import 'package:ggto_tecnico/features/casos/casos_provider.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';

class _CasosEspia extends CasosProvider {
  _CasosEspia(this._datos);

  final List<Map<String, dynamic>> _datos;

  @override
  List<Map<String, dynamic>> get casos => _datos;
}

Map<String, dynamic> _caso(String estado) => {
      'id_averia': '28633781',
      'id_caso': 284,
      'estado_actual': estado,
      'nombre_cliente': 'CLIENTE PRUEBA',
      'telefono': '7001234567',
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
  group('D-88 · «No Contesta» (RF-APK-12)', () {
    test('está disponible mientras el caso no esté contactado', () {
      for (final estado in ['NUEVO', 'ASIGNADO', 'EN_GESTION']) {
        expect(accionesDeEstado(estado), contains(AccionCaso.noContesta),
            reason: estado);
      }
      expect(accionesDeEstado('CONTACTADO'), isNot(contains(AccionCaso.noContesta)));
      expect(accionesDeEstado('CERRADO'), isNot(contains(AccionCaso.noContesta)));
    });

    test('propone la cita de 1ra visita para mañana a las 08:00', () {
      final ahora = DateTime(2026, 10, 8, 15, 30);
      final cita = citaDeNoContesta(ahora: ahora);
      expect(cita.day, 9);
      expect(cita.month, 10);
      expect(cita.hour, 8);
      expect(cita.minute, 0);
    });

    testWidgets('la ficha ofrece «No contesta» y confirma la cita',
        (tester) async {
      await tester.pumpWidget(_ficha(_caso('NUEVO')));
      await tester.pumpAndSettle();

      expect(find.text('No contesta'), findsOneWidget);
      await tester.tap(find.text('No contesta'));
      await tester.pumpAndSettle();

      // Diálogo de confirmación con la cita y el aviso al COS.
      expect(find.text('El cliente no contesta'), findsOneWidget);
      expect(find.textContaining('1ra visita'), findsOneWidget);
      expect(find.textContaining('informó al COS'), findsOneWidget);
      expect(find.text('Registrar'), findsOneWidget);

      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(find.text('Registrar'), findsNothing);
    });
  });

  group('D-88/D-93 · edición del contacto (RF-APK-11)', () {
    test('normaliza cualquier número igual que el servidor (RN-IP-07)', () {
      expect(normalizarNumero('7001234567'), '7001234567');
      expect(normalizarNumero('701-555-6677'), '7015556677');
      expect(normalizarNumero('(702) 123 4567'), '7021234567');
      expect(normalizarNumero('+58 0414-222-3344'), '4142223344');
      expect(normalizarNumero('0058 701-400.0848'), '7014000848');
    });

    test('reconoce el identificador de pago (70*) y ya no exige las series', () {
      expect(esIdentificadorPago('7014000848'), isTrue);
      expect(esIdentificadorPago('700-123.4567'), isTrue);
      expect(esIdentificadorPago('7030000000'), isTrue); // cualquier 70*
      expect(esIdentificadorPago('04142223344'), isFalse);
      // D-93: un móvil es un contacto válido (antes se rechazaba).
      expect(errorNumeroContacto('04121234567'), isNull);
      expect(errorNumeroContacto('0414-222-3344'), isNull);
      // Un 70* tampoco es error: el servidor lo registra como identificador.
      expect(errorNumeroContacto('7014000848'), isNull);
      expect(errorNumeroContacto(''), isNull);
      expect(errorNumeroContacto('SIN NUMERO'), contains('válido'));
    });

    test('la dirección exige un mínimo y el vacío no es error', () {
      expect(errorDireccion('CALLE 4'), isNull);
      expect(errorDireccion('AV'), contains('corta'));
      expect(errorDireccion('   '), isNull);
    });

    testWidgets('el diálogo valida antes de guardar', (tester) async {
      await tester.pumpWidget(_ficha(_caso('NUEVO')));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Editar dirección y contacto'));
      await tester.pumpAndSettle();
      expect(find.text('Editar el contacto'), findsOneWidget);

      // Un valor sin dígitos no se acepta (cualquier número sí).
      await tester.enterText(
          find.widgetWithText(TextFormField, 'Número de contacto'), 'SIN NUMERO');
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Indique un número de contacto válido'), findsOneWidget);
      expect(find.text('Editar el contacto'), findsOneWidget);
    });
  });

  group('D-88 · conteo de imágenes (3.2bis)', () {
    testWidgets('el cuerpo muestra las imágenes cargadas', (tester) async {
      await tester.pumpWidget(_ficha(_caso('CONTACTADO')));
      await tester.pumpAndSettle();

      expect(find.text('Imágenes cargadas'), findsOneWidget);
    });
  });
}
