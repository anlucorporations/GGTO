// D-101 · Listado principal, cabecera de la ficha y acciones con iconos.
//
// Los tres cambios de esta entrega:
//   1. los casos ya gestionados se ocultan del listado (con conmutador);
//   2. la cabecera pierde el rótulo del identificador de pago y usa el teléfono
//      que aparezca en el texto de «Información» cuando no hay contacto propio;
//   3. el estado va como icono y las acciones del pie son iconos, no botones.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/features/casos/acciones_caso.dart';
import 'package:ggto_tecnico/widgets/caso_card.dart';
import 'package:ggto_tecnico/widgets/estado_chip.dart';
import 'package:ggto_tecnico/widgets/estado_icono.dart';
import 'package:ggto_tecnico/widgets/ficha_caso.dart';

Map<String, dynamic> _caso({required String estado, String id = 'TSTD101-1'}) =>
    {'id_averia': id, 'estado_actual': estado};

void main() {
  group('D-101 · los casos gestionados se ocultan del listado', () {
    test('los cinco estados gestionados quedan ocultos', () {
      for (final estado in ['CERRADO', 'ENRUTADO', 'DIFERIDO', 'CITADO', 'CANCELADO']) {
        expect(estaGestionado(estado), isTrue, reason: estado);
      }
    });

    test('los estados de trabajo siguen visibles', () {
      for (final estado in ['NUEVO', 'ASIGNADO', 'CONTACTADO', 'EN_GESTION']) {
        expect(estaGestionado(estado), isFalse, reason: estado);
      }
    });

    test('no distingue mayúsculas ni espacios', () {
      expect(estaGestionado('  cerrado '), isTrue);
      expect(estaGestionado('Citado'), isTrue);
    });

    test('«No contesta» queda cubierto porque deja el caso en CITADO', () {
      // La acción de «No Contesta» registra el aviso al COS y deja CITADO
      // (accesos_caso.dart → OperacionesService.noContesta).
      expect(estaGestionado('CITADO'), isTrue);
    });

    test('sin conmutador solo se ven los pendientes', () {
      final casos = [
        _caso(estado: 'NUEVO', id: 'A'),
        _caso(estado: 'CERRADO', id: 'B'),
        _caso(estado: 'ASIGNADO', id: 'C'),
        _caso(estado: 'CITADO', id: 'D'),
        _caso(estado: 'DIFERIDO', id: 'E'),
        _caso(estado: 'ENRUTADO', id: 'F'),
      ];
      final visibles = casosVisiblesDe(casos, verGestionados: false);
      expect(visibles.map((c) => c['id_averia']), ['A', 'C']);
    });

    test('con el conmutador vuelven todos', () {
      final casos = [
        _caso(estado: 'NUEVO', id: 'A'),
        _caso(estado: 'CERRADO', id: 'B'),
      ];
      final visibles = casosVisiblesDe(casos, verGestionados: true);
      expect(visibles.length, 2);
    });

    test('un caso sin estado no se oculta', () {
      final visibles = casosVisiblesDe([{'id_averia': 'X'}], verGestionados: false);
      expect(visibles.length, 1);
    });
  });

  group('D-101 · teléfono dentro del texto de «Información»', () {
    test('reconoce las formas venezolanas habituales', () {
      expect(telefonoEnTexto('LLAMAR AL 04121234567 ANTES'), '04121234567');
      expect(telefonoEnTexto('Telf: 0412-1234567'), '04121234567');
      expect(telefonoEnTexto('contacto +58 412 1234567'), '04121234567');
      expect(telefonoEnTexto('(0212) 555.1234'), '02125551234');
      expect(telefonoEnTexto('fijo 0212-5551234 casa'), '02125551234');
    });

    test('normaliza siempre a 11 dígitos con el 0 inicial', () {
      expect(telefonoEnTexto('4121234567'), '04121234567');
      expect(telefonoEnTexto('2125551234'), '02125551234');
    });

    test('no confunde un identificador de pago (70*) con un teléfono', () {
      expect(telefonoEnTexto('70* 7014000848'), isNull);
      expect(telefonoEnTexto('7014000848'), isNull);
    });

    test('sin número devuelve null', () {
      expect(telefonoEnTexto(''), isNull);
      expect(telefonoEnTexto('SIN NOVEDAD'), isNull);
      expect(telefonoEnTexto('reporte del 15/10/2026'), isNull);
    });

    test('el contacto propio manda sobre el de Información', () {
      expect(
        contactoParaMostrar(
          contacto: '04142223344',
          informacion: 'llamar al 02125551234',
        ),
        '04142223344',
      );
    });

    test('sin contacto propio se usa el de Información', () {
      expect(
        contactoParaMostrar(contacto: '', informacion: 'el cliente deja 0412-1234567'),
        '04121234567',
      );
      expect(
        contactoParaMostrar(contacto: '   ', informacion: '0412-1234567'),
        '04121234567',
      );
    });

    test('sin ninguno de los dos devuelve vacío', () {
      expect(contactoParaMostrar(contacto: '', informacion: 'sin datos'), '');
    });
  });

  group('D-101 · el estado es un icono', () {
    test('cada estado tiene su icono y su color', () {
      final nuevo = EstadoIcono.aspecto('NUEVO');
      final cerrado = EstadoIcono.aspecto('CERRADO');
      final enrutado = EstadoIcono.aspecto('ENRUTADO');
      expect(nuevo.$1, isNot(cerrado.$1));
      expect(cerrado.$1, Icons.check_circle);
      expect(enrutado.$1, Icons.alt_route);
      expect(cerrado.$2, Colors.green);
      // Un estado desconocido no rompe: cae en el icono genérico.
      expect(EstadoIcono.aspecto('LO QUE SEA').$1, Icons.help_outline);
    });

    testWidgets('la tarjeta de la lista usa el icono y no el chip de texto',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CasoCard(
            caso: const {
              'id_averia': 'TSTD101-1',
              'estado_actual': 'CERRADO',
              'nombre_cliente': 'CLIENTE',
            },
            onTap: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(EstadoIcono), findsOneWidget);
      expect(find.byType(EstadoChip), findsNothing);
      // El nombre del estado sigue accesible por el tooltip.
      expect(find.byTooltip('CERRADO'), findsOneWidget);
    });

    testWidgets('las acciones del pie son iconos, no botones', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FichaPie(
            acciones: [
              FichaAccion(
                icono: Icons.phone_callback,
                etiqueta: 'Contactado',
                onPressed: () {},
              ),
              FichaAccion(
                icono: Icons.build,
                etiqueta: 'Atender',
                onPressed: () {},
              ),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(FichaAccion), findsNWidgets(2));
      expect(find.byType(ElevatedButton), findsNothing);
      expect(find.byIcon(Icons.phone_callback), findsOneWidget);
      expect(find.text('Contactado'), findsOneWidget);
      expect(find.text('Atender'), findsOneWidget);
    });
  });

  group('D-101 · cabecera de la ficha', () {
    testWidgets('el identificador va sin rótulo y el contacto se rotula Contacto',
        (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: FichaCabecera(
            nombre: 'CLIENTE PRUEBA',
            identificadorPago: '7001234567',
            contacto: '04121234567',
            estado: 'NUEVO',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('7001234567'), findsOneWidget);
      expect(find.textContaining('Identificador de pago'), findsNothing);
      expect(find.text('Contacto: 04121234567'), findsOneWidget);
    });

    testWidgets('sin identificador no se pinta la fila', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: FichaCabecera(
            nombre: 'CLIENTE PRUEBA',
            identificadorPago: '',
            contacto: '',
            estado: 'NUEVO',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // Ni el número ni el aviso anterior: la fila desaparece.
      expect(find.byIcon(Icons.badge_outlined), findsNothing);
      expect(find.textContaining('Sin identificador'), findsNothing);
      expect(find.text('Sin número de contacto'), findsOneWidget);
    });
  });
}
