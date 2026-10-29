// Pruebas del panel aparte de MASIVAS del técnico (ciclo posterior a D-160).
//
// Pide el usuario: la tarjeta fija de masiva **desaparece** del panel
// principal y el aviso vive **solo en la barra de navegación**. Cubren, sin
// emulador ni red (espías de los proveedores, como en D-84/D-99):
//   * «Mis casos» ya no pinta el banner «MASIVA ACTIVA»;
//   * la barra de navegación del técnico ofrece el panel MASIVAS con un
//     `Badge` con el conteo (y sin badge encendido cuando no hay masivas);
//   * tocar la pestaña abre el panel MASIVAS de su cuadrilla;
//   * la versión visible sigue 1.15.21+46 (entrega nueva).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/core/constants.dart';
import 'package:ggto_tecnico/features/auth/auth_provider.dart';
import 'package:ggto_tecnico/features/casos/casos_provider.dart';
import 'package:ggto_tecnico/features/inicio/inicio_tecnico_screen.dart';
import 'package:ggto_tecnico/features/masivas/masivas_provider.dart';
import 'package:ggto_tecnico/features/masivas/masivas_screen.dart';
import 'package:ggto_tecnico/features/mensajes/mensajes_provider.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';

/// Proveedor de masivas con una lista fija en memoria (sin base de datos).
class _MasivasEspia extends MasivasProvider {
  _MasivasEspia({required this.lista});

  final List<Map<String, dynamic>> lista;

  @override
  List<Map<String, dynamic>> get masivas => lista;

  @override
  int get total => lista.length;

  @override
  bool get hayActivas => lista.isNotEmpty;

  @override
  Future<void> cargar({bool silencioso = false}) async {}

  @override
  Future<void> refrescarDesdeServidor() => cargar();

  @override
  Future<void> cargarDesdeCache() async {}

  @override
  Future<void> refrescarLocal() async {}

  @override
  Future<void> quitarLocal(int idFalla) async {}
}

class _CasosEspia extends CasosProvider {
  int lecturasLocales = 0;

  @override
  Future<void> cargar({String? consulta, bool silencioso = false,
      void Function(String fase, double valor)? onProgreso}) async {}

  @override
  Future<void> refrescarLocal() async {
    lecturasLocales++;
  }

  @override
  Future<void> cargarDesdeCache({String? consulta}) async {
    lecturasLocales++;
  }

  @override
  Future<void> buscar(String consulta) async {}
}

/// Proveedor de sincronización sin conectividad ni base de datos.
class _SyncEspia extends SyncProvider {
  _SyncEspia();

  @override
  int get pendientesSinError => 0;

  @override
  Future<void> refrescar() async {}
}

/// Masiva activa mínima para el badge.
Map<String, dynamic> _masiva({int idFalla = 12, String estado = 'DETECTADA'}) => {
      'id_falla': idFalla,
      'descripcion': 'Concentración en OLT-01',
      'estado': estado,
      'casos_asociados': 8,
    };

/// Árbol del panel del técnico con los proveedores espía dados.
Widget panel({required MasivasProvider masivas}) => MultiProvider(
      providers: [
        ChangeNotifierProvider<CasosProvider>.value(value: _CasosEspia()),
        ChangeNotifierProvider<SyncProvider>.value(value: _SyncEspia()),
        ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider()),
        ChangeNotifierProvider<MensajesProvider>(
            create: (_) => MensajesProvider()),
        ChangeNotifierProvider<MasivasProvider>.value(value: masivas),
      ],
      child: const MaterialApp(home: InicioTecnicoScreen()),
    );

/// Badges encendidos dentro de la barra de navegación.
Iterable<Badge> badgesDeLaBarra(WidgetTester tester) =>
    tester.widgetList<Badge>(find.descendant(
      of: find.byType(NavigationBar),
      matching: find.byType(Badge),
    ));

void main() {
  test('la versión de la entrega es 1.15.21+46', () {
    expect(AppConstants.version, '1.15.21+46');
  });

  group('Panel aparte de MASIVAS · barra de navegación del técnico', () {
    testWidgets('sin masivas activas el aviso no se pinta', (tester) async {
      await tester.pumpWidget(panel(masivas: _MasivasEspia(lista: const [])));
      await tester.pumpAndSettle();

      // El panel principal no trae la tarjeta fija de masiva.
      expect(find.text('MASIVA ACTIVA'), findsNothing);
      // Ningún badge encendido en la barra de navegación.
      expect(badgesDeLaBarra(tester).any((b) => b.isLabelVisible), isFalse);
      // El panel está en la barra.
      final nav = tester.widget<NavigationBar>(find.byType(NavigationBar));
      expect(
        nav.destinations.whereType<NavigationDestination>().map((d) => d.label),
        ['Mis casos', 'Masivas'],
      );
    });

    testWidgets('con masivas activas la barra muestra el contador (aviso)',
        (tester) async {
      await tester
          .pumpWidget(panel(masivas: _MasivasEspia(lista: [_masiva()])));
      await tester.pumpAndSettle();

      final encendidos =
          badgesDeLaBarra(tester).where((b) => b.isLabelVisible).toList();
      expect(encendidos, hasLength(1),
          reason: 'el aviso vive solo en la barra de navegación');
      expect(
        find.descendant(of: find.byType(NavigationBar), matching: find.text('1')),
        findsOneWidget,
      );
      expect(find.text('MASIVA ACTIVA'), findsNothing);
    });

    testWidgets('con tres masivas el badge cuenta las tres', (tester) async {
      await tester.pumpWidget(panel(
        masivas: _MasivasEspia(lista: [
          _masiva(idFalla: 3),
          _masiva(idFalla: 9),
          _masiva(idFalla: 4, estado: 'PLANIFICADA'),
        ]),
      ));
      await tester.pumpAndSettle();

      expect(
        find.descendant(of: find.byType(NavigationBar), matching: find.text('3')),
        findsOneWidget,
      );
    });

    testWidgets('la pestaña MASIVAS abre el panel de la cuadrilla',
        (tester) async {
      await tester
          .pumpWidget(panel(masivas: _MasivasEspia(lista: [_masiva()])));
      await tester.pumpAndSettle();

      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('Masivas'),
        ),
      );
      await tester.pumpAndSettle();

      // El panel aparte es la pantalla de masivas de su cuadrilla.
      expect(find.byType(MasivasScreen), findsOneWidget);
      expect(find.textContaining('Masiva #12'), findsOneWidget);
      // En el panel, el técnico solo ve la acción MATERIALES (D-99/D-111).
      expect(find.byTooltip('Materiales'), findsOneWidget);
    });

    testWidgets('regresar a «Mis casos» sin la tarjeta de masiva',
        (tester) async {
      await tester
          .pumpWidget(panel(masivas: _MasivasEspia(lista: [_masiva()])));
      await tester.pumpAndSettle();

      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('Masivas'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('Mis casos'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Masiva #'), findsNothing);
      expect(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.byIcon(Icons.crisis_alert),
        ),
        findsOneWidget,
        reason: 'el icono queda solo en la barra de navegación',
      );
    });
  });
}
