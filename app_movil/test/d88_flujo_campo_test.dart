// Pruebas del incremento D-88 (flujo de campo completo).
//
// Cubren la regla del «No Contesta» (acción nueva en NUEVO/ASIGNADO/EN_GESTION),
// la validación de la edición del contacto (serie 700/701/702), la cita de 1ra
// visita propuesta y su presencia en la ficha, además del conteo de imágenes.

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

  group('D-88 · edición del contacto (RF-APK-11)', () {
    test('normaliza el número de la serie 700/701/702', () {
      expect(normalizarTelefono('7001234567'), '7001234567');
      expect(normalizarTelefono('701-555-6677'), '7015556677');
      expect(normalizarTelefono('(702) 123 4567'), '7021234567');
    });

    test('rechaza números que no son de la serie o no tienen 10 dígitos', () {
      expect(normalizarTelefono('04121234567'), isNull);
      expect(normalizarTelefono('700123456'), isNull);
      expect(normalizarTelefono('7031234567'), isNull);
      expect(errorTelefono('04121234567'), contains('700'));
      expect(errorTelefono('7001234567'), isNull);
      expect(errorTelefono(''), isNull);
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

      // Un teléfono fuera de la serie no se acepta.
      await tester.enterText(
          find.widgetWithText(TextFormField, 'Número de contacto'), '04121234567');
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();
      expect(find.textContaining('serie 700, 701 o 702'), findsOneWidget);
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
