// D-117 · Bloqueo de pantalla por inactividad (2 minutos) y PIN como bloqueo.
//
// Se prueban las piezas sin dispositivo: el controlador del bloqueo, la pantalla
// de bloqueo (PIN correcto, PIN de fábrica y cambio) y el temporizador de
// inactividad con una duración inyectada.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/core/constants.dart';
import 'package:ggto_tecnico/features/auth/auth_provider.dart';
import 'package:ggto_tecnico/features/auth/credencial_service.dart';
import 'package:ggto_tecnico/features/auth/lock_controller.dart';
import 'package:ggto_tecnico/features/auth/lock_screen.dart';
import 'package:ggto_tecnico/widgets/bloqueo_inactividad.dart';

class _AuthFalso extends AuthProvider {
  _AuthFalso({this.porDefecto = false});

  static const String pin = '135790';
  bool porDefecto;
  String? pinCambiado;

  @override
  bool get autenticado => true;

  @override
  bool get sesionActiva => true;

  @override
  String get rol => 'TECNICO';

  @override
  String? get p00 => 'TSTTEC';

  @override
  String get nombre => 'ANA PEREZ';

  @override
  Future<ResultadoPin> verificarPinLocal(String p00, String entrada) async {
    if (porDefecto || entrada == AppConstants.pinPorDefecto) {
      return const ResultadoPin(
        EstadoPin.requiereCambio,
        'Está usando el PIN de fábrica: defina uno propio para continuar.',
      );
    }
    if (entrada == pin) {
      return const ResultadoPin(EstadoPin.ok, 'Acceso sin conexión concedido.');
    }
    return const ResultadoPin(EstadoPin.pinIncorrecto, 'PIN incorrecto.');
  }

  @override
  Future<String?> cambiarPinLocal(String p00, String nuevoPin) async {
    pinCambiado = nuevoPin;
    porDefecto = false;
    return null;
  }
}

Widget _pantallaBloqueo(_AuthFalso auth, LockController lock) => MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider<LockController>.value(value: lock),
      ],
      child: const MaterialApp(home: LockScreen()),
    );

void main() {
  group('D-117 · controlador del bloqueo', () {
    test('bloquear y desbloquear notifican y no tocan la sesión', () {
      final lock = LockController();
      var avisos = 0;
      lock.addListener(() => avisos++);

      expect(lock.bloqueado, isFalse);
      lock.bloquear();
      expect(lock.bloqueado, isTrue);
      lock.bloquear(); // idempotente
      lock.desbloquear();
      expect(lock.bloqueado, isFalse);
      expect(avisos, 2);
    });
  });

  group('D-117 · pantalla de bloqueo', () {
    testWidgets('pide el PIN y desbloquea con el correcto', (tester) async {
      final auth = _AuthFalso();
      final lock = LockController()..bloquear();

      await tester.pumpWidget(_pantallaBloqueo(auth, lock));
      await tester.pumpAndSettle();

      expect(find.text('Sesión bloqueada'), findsOneWidget);
      expect(find.text('ANA PEREZ'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('lock-pin')), '000000');
      await tester.tap(find.byKey(const Key('lock-desbloquear')));
      await tester.pumpAndSettle();
      expect(find.text('PIN incorrecto.'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('lock-pin')), '135790');
      await tester.tap(find.byKey(const Key('lock-desbloquear')));
      await tester.pumpAndSettle();
      expect(lock.bloqueado, isFalse);
    });

    testWidgets('con el PIN de fábrica exige cambiarlo antes de desbloquear',
        (tester) async {
      final auth = _AuthFalso(porDefecto: true);
      final lock = LockController()..bloquear();

      await tester.pumpWidget(_pantallaBloqueo(auth, lock));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('lock-pin')),
        AppConstants.pinPorDefecto,
      );
      await tester.tap(find.byKey(const Key('lock-desbloquear')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('lock-nuevo')), findsOneWidget);
      await tester.enterText(find.byKey(const Key('lock-nuevo')), '246810');
      await tester.enterText(find.byKey(const Key('lock-confirmar')), '246810');
      await tester.tap(find.byKey(const Key('lock-guardar')));
      await tester.pumpAndSettle();

      expect(auth.pinCambiado, '246810');
      expect(lock.bloqueado, isFalse);
    });
  });

  group('D-117 · inactividad', () {
    testWidgets('a los 2 minutos (inyectados) bloquea y el PIN vuelve a la app',
        (tester) async {
      final auth = _AuthFalso();
      final lock = LockController();

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: auth),
            ChangeNotifierProvider<LockController>.value(value: lock),
          ],
          child: const MaterialApp(
            home: BloqueoInactividad(
              duracion: Duration(seconds: 1),
              child: Scaffold(body: Center(child: Text('APP'))),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('APP'), findsOneWidget);
      expect(find.text('Sesión bloqueada'), findsNothing);

      await tester.pump(const Duration(seconds: 2));
      expect(find.text('Sesión bloqueada'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('lock-pin')), '135790');
      await tester.tap(find.byKey(const Key('lock-desbloquear')));
      await tester.pumpAndSettle();
      expect(find.text('APP'), findsOneWidget);
      expect(lock.bloqueado, isFalse);
    });

    testWidgets('un toque reinicia la cuenta de inactividad', (tester) async {
      final auth = _AuthFalso();
      final lock = LockController();

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: auth),
            ChangeNotifierProvider<LockController>.value(value: lock),
          ],
          child: const MaterialApp(
            home: BloqueoInactividad(
              duracion: Duration(seconds: 2),
              child: Scaffold(body: Center(child: Text('APP'))),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.pump(const Duration(milliseconds: 1200));
      await tester.tap(find.text('APP'));
      await tester.pump(const Duration(milliseconds: 1200));
      expect(find.text('Sesión bloqueada'), findsNothing);

      await tester.pump(const Duration(seconds: 2));
      expect(find.text('Sesión bloqueada'), findsOneWidget);
    });
  });
}
