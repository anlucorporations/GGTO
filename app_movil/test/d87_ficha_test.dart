// Pruebas del incremento D-87 (ficha con CABECERA · CUERPO · PIE).
//
// Cubren la regla pura de acciones por estado (que cierra M-06: la ficha ofrecía
// «Contactar» con el caso ya contactado) y la estructura de la ficha: cabecera
// que identifica y ofrece Editar, cuerpo con grupos desplegables y pie fijo con
// las acciones del estado.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/features/casos/acciones_caso.dart';
import 'package:ggto_tecnico/features/casos/caso_detalle_screen.dart';
import 'package:ggto_tecnico/features/casos/casos_provider.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';
import 'package:ggto_tecnico/widgets/ficha_caso.dart';

/// Proveedor con los casos ya cargados (sin base de datos ni red).
class _CasosEspia extends CasosProvider {
  _CasosEspia(this._datos);

  final List<Map<String, dynamic>> _datos;

  @override
  List<Map<String, dynamic>> get casos => _datos;
}

Map<String, dynamic> _caso(String estado, {bool pendiente = false}) => {
      'id_averia': '28633781',
      'id_caso': 284,
      'estado_actual': estado,
      'nombre_cliente': 'CLIENTE PRUEBA',
      'telefono': '7001234567',
      'direccion': 'CALLE 4 CON AV 5',
      'sector_nombre': 'SECTOR X',
      'problema_reporte': 'SIN SERVICIO',
      'plan': 'PLAN X',
      if (pendiente) 'pendiente_sync': true,
    };

Widget _ficha(Map<String, dynamic> caso) => MultiProvider(
      providers: [
        ChangeNotifierProvider<CasosProvider>.value(value: _CasosEspia([caso])),
        ChangeNotifierProvider<SyncProvider>(create: (_) => SyncProvider()),
      ],
      child: MaterialApp(home: CasoDetalleScreen(caso: caso)),
    );

void main() {
  group('D-87 · acciones por estado (RF-APK-06)', () {
    test('NUEVO, ASIGNADO y EN_GESTION ofrecen contactar, no contesta y agendar',
        () {
      for (final estado in ['NUEVO', 'ASIGNADO', 'EN_GESTION']) {
        expect(
          accionesDeEstado(estado),
          {
            AccionCaso.marcarContactado,
            AccionCaso.noContesta,
            AccionCaso.agendarCita,
          },
          reason: estado,
        );
      }
    });

    test('CONTACTADO y CITADO solo ofrecen atender (defecto M-06)', () {
      for (final estado in ['CONTACTADO', 'CITADO']) {
        expect(accionesDeEstado(estado), {AccionCaso.atender}, reason: estado);
        expect(accionesDeEstado(estado).contains(AccionCaso.marcarContactado),
            isFalse);
      }
    });

    test('los estados sin gestión no ofrecen acciones y lo explican', () {
      for (final estado in ['CERRADO', 'CANCELADO', 'ENRUTADO', 'DIFERIDO']) {
        expect(accionesDeEstado(estado), isEmpty, reason: estado);
        expect(notaDeEstado(estado), isNotNull, reason: estado);
      }
      expect(notaDeEstado('NUEVO'), isNull);
    });

    test('el estado no distingue mayúsculas y el cierre no admite edición', () {
      expect(accionesDeEstado(' contactado '), {AccionCaso.atender});
      expect(puedeEditarContacto('NUEVO'), isTrue);
      expect(puedeEditarContacto('CONTACTADO'), isTrue);
      expect(puedeEditarContacto('CERRADO'), isFalse);
      expect(puedeEditarContacto('ENRUTADO'), isFalse);
    });
  });

  group('D-87 · ficha', () {
    testWidgets('la cabecera identifica el caso y ofrece Editar',
        (tester) async {
      await tester.pumpWidget(_ficha(_caso('NUEVO')));
      await tester.pumpAndSettle();

      // Se comprueba **dentro de la cabecera**: el nombre también aparece en el
      // grupo de contacto del cuerpo.
      final cabecera = find.byType(FichaCabecera);
      expect(cabecera, findsOneWidget);
      expect(find.descendant(of: cabecera, matching: find.text('CLIENTE PRUEBA')),
          findsOneWidget);
      expect(find.descendant(of: cabecera, matching: find.text('7001234567')),
          findsOneWidget);
      expect(find.descendant(of: cabecera, matching: find.text('NUEVO')),
          findsOneWidget); // chip de estado
      expect(
        find.descendant(
          of: cabecera,
          matching: find.byTooltip('Editar dirección y contacto'),
        ),
        findsOneWidget,
      );
    });

    testWidgets('en NUEVO el pie ofrece contactar y agendar', (tester) async {
      await tester.pumpWidget(_ficha(_caso('NUEVO')));
      await tester.pumpAndSettle();

      expect(find.text('Marcar como contactado'), findsOneWidget);
      expect(find.text('Agendar cita'), findsOneWidget);
      expect(find.text('Atender'), findsNothing);
    });

    testWidgets('en CONTACTADO el pie solo ofrece Atender (M-06)',
        (tester) async {
      await tester.pumpWidget(_ficha(_caso('CONTACTADO')));
      await tester.pumpAndSettle();

      expect(find.text('Atender'), findsOneWidget);
      expect(find.text('Marcar como contactado'), findsNothing);
      expect(find.text('Agendar cita'), findsNothing);
    });

    testWidgets('en CERRADO avisa y no ofrece acciones', (tester) async {
      await tester.pumpWidget(_ficha(_caso('CERRADO')));
      await tester.pumpAndSettle();

      expect(find.text('Atender'), findsNothing);
      expect(find.textContaining('no admite nuevas gestiones'), findsOneWidget);
    });

    testWidgets('el cuerpo muestra los grupos y los despliega al tocarlos',
        (tester) async {
      await tester.pumpWidget(_ficha(_caso('NUEVO')));
      await tester.pumpAndSettle();

      // El grupo de contacto arranca abierto: su información se ve.
      expect(find.text('Contacto'), findsOneWidget);
      expect(find.text('CALLE 4 CON AV 5'), findsOneWidget);
      // Los demás arrancan plegados: sus filas no se pintan.
      expect(find.text('Administrativa'), findsOneWidget);
      expect(find.text('Plan'), findsNothing);

      await tester.tap(find.text('Administrativa'));
      await tester.pumpAndSettle();
      expect(find.text('Plan'), findsOneWidget);
      expect(find.text('PLAN X'), findsOneWidget);
    });

    testWidgets('el pie avisa de los cambios sin sincronizar', (tester) async {
      await tester.pumpWidget(_ficha(_caso('CONTACTADO', pendiente: true)));
      await tester.pumpAndSettle();

      expect(find.textContaining('pendientes de sincronizar'), findsOneWidget);
    });
  });
}
