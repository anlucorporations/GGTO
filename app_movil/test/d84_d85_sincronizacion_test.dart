// Pruebas de los incrementos D-84 (sincronización bajo control del técnico) y
// D-85 (acciones con efecto local inmediato).
//
// Cubren la lógica que no necesita dispositivo ni red: el periodo del sondeo de
// mensajes, la fusión del cambio local de un caso y —con espías de los
// proveedores— que **abrir «Mis casos» no descarga nada**.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/features/auth/auth_provider.dart';
import 'package:ggto_tecnico/features/casos/casos_provider.dart';
import 'package:ggto_tecnico/features/casos/casos_screen.dart';
import 'package:ggto_tecnico/features/casos/operaciones_service.dart';
import 'package:ggto_tecnico/features/mensajes/mensajes_provider.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';

/// Proveedor de casos que cuenta descargas y lecturas locales.
class _CasosEspia extends CasosProvider {
  int descargas = 0;
  int lecturasLocales = 0;

  @override
  Future<void> cargar({
    String? consulta,
    bool silencioso = false,
    void Function(String fase, double valor)? onProgreso,
  }) async {
    descargas++;
  }

  @override
  Future<void> refrescarLocal() async {
    lecturasLocales++;
  }

  @override
  Future<void> cargarDesdeCache({String? consulta}) async {
    lecturasLocales++;
  }

  @override
  Future<void> buscar(String consulta) async {
    descargas++;
  }
}

/// Proveedor de sincronización sin conectividad ni base de datos.
class _SyncEspia extends SyncProvider {
  _SyncEspia({this.pendientes = 0});

  @override
  final int pendientes;

  @override
  int get pendientesSinError => pendientes;

  @override
  Future<void> refrescar() async {}
}

void main() {
  group('D-84 · sincronización bajo control del técnico', () {
    test('el sondeo de mensajes es de 60 s (RF-APK-02)', () {
      expect(MensajesProvider.intervaloSondeo, const Duration(seconds: 60));
    });

    testWidgets('abrir «Mis casos» no descarga: solo lee el contenido local',
        (tester) async {
      final casos = _CasosEspia();
      final sync = _SyncEspia();

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<CasosProvider>.value(value: casos),
            ChangeNotifierProvider<SyncProvider>.value(value: sync),
            ChangeNotifierProvider<MensajesProvider>(
              create: (_) => MensajesProvider(),
            ),
            ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider()),
          ],
          child: const MaterialApp(home: CasosScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(casos.descargas, 0,
          reason: 'la descarga debe ser explícita (CARGA/DESCARGA)');
      expect(casos.lecturasLocales, greaterThan(0),
          reason: 'la pantalla debe pintar el contenido del dispositivo');
      expect(find.byType(CasosScreen), findsOneWidget);
    });

    testWidgets('la franja informa la cola y ofrece Cargar', (tester) async {
      final casos = _CasosEspia();
      final sync = _SyncEspia(pendientes: 2);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<CasosProvider>.value(value: casos),
            ChangeNotifierProvider<SyncProvider>.value(value: sync),
            ChangeNotifierProvider<MensajesProvider>(
              create: (_) => MensajesProvider(),
            ),
            ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider()),
          ],
          child: const MaterialApp(home: CasosScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('2 por enviar'), findsOneWidget);
      expect(find.text('Cargar (2)'), findsOneWidget);
      expect(find.text('Descargar'), findsOneWidget);
    });
  });

  group('D-85 · acciones con efecto local inmediato', () {
    test('el cambio local conserva los campos del caso (RF-APK-03)', () {
      final caso = {
        'id_averia': '28633781',
        'id_caso': 284,
        'estado_actual': 'NUEVO',
        'nombre_cliente': 'CLIENTE X',
        'direccion': 'CALLE 4',
      };

      final cambiado = OperacionesService.conCambioLocal(
        caso,
        estado: 'CONTACTADO',
        pendienteSync: true,
      );

      expect(cambiado['estado_actual'], 'CONTACTADO');
      expect(cambiado['pendiente_sync'], isTrue);
      expect(cambiado['nombre_cliente'], 'CLIENTE X',
          reason: 'la fusión no debe perder campos del caso');
      expect(cambiado['direccion'], 'CALLE 4');
      // El mapa original no se toca.
      expect(caso['estado_actual'], 'NUEVO');
      expect(caso.containsKey('pendiente_sync'), isFalse);
    });

    test('la cita agendada sin conexión deja su fecha en el caso', () {
      final caso = {'id_averia': '28633781', 'estado_actual': 'CONTACTADO'};
      final cambiado = OperacionesService.conCambioLocal(
        caso,
        pendienteSync: true,
        extra: {'fecha_cita': '2026-10-08T13:00:00.000'},
      );
      expect(cambiado['estado_actual'], 'CONTACTADO');
      expect(cambiado['fecha_cita'], '2026-10-08T13:00:00.000');
      expect(cambiado['pendiente_sync'], isTrue);
    });

    test('sincronizar quita el distintivo sin cambiar el estado', () {
      final caso = {
        'id_averia': '28633781',
        'estado_actual': 'CERRADO',
        'pendiente_sync': true,
      };
      final cambiado =
          OperacionesService.conCambioLocal(caso, pendienteSync: false);
      expect(cambiado['pendiente_sync'], isFalse);
      expect(cambiado['estado_actual'], 'CERRADO');
    });
  });
}
