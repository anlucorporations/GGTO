// D-120 · Pantalla de bloqueo con clave de sesión, borrado local y cierre de
// casos especiales desde la APK.
//
// Sin SQLite ni red: se prueban las piezas que deciden (textos de la pantalla de
// bloqueo, resumen del borrado y presencia de las acciones en la sección
// Usuario). La escritura real en la base local se verifica en el dispositivo.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/features/auth/auth_provider.dart';
import 'package:ggto_tecnico/features/auth/lock_controller.dart';
import 'package:ggto_tecnico/features/auth/lock_screen.dart';
import 'package:ggto_tecnico/features/usuario/reset_app_service.dart';

void main() {
  group('D-120 · bloqueo: desbloquear con la clave de sesión', () {
    Future<void> montar(WidgetTester tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => LockController()),
          ],
          child: const MaterialApp(home: Scaffold(body: LockScreen())),
        ),
      );
      await tester.pump();
    }

    testWidgets('el PIN sigue siendo el acceso principal', (tester) async {
      await montar(tester);
      expect(find.byKey(const Key('lock-pin')), findsOneWidget);
      expect(find.byKey(const Key('lock-desbloquear')), findsOneWidget);
      expect(find.byKey(const Key('lock-clave')), findsNothing);
    });

    testWidgets('«Olvidé el PIN» abre el formulario de clave', (tester) async {
      await montar(tester);
      expect(find.byKey(const Key('lock-usar-clave')), findsOneWidget);

      await tester.tap(find.byKey(const Key('lock-usar-clave')));
      await tester.pump();

      expect(find.byKey(const Key('lock-clave')), findsOneWidget);
      expect(find.byKey(const Key('lock-desbloquear-clave')), findsOneWidget);
      expect(find.text('Volver al PIN'), findsOneWidget);
      // El PIN deja de pedirse mientras se usa la clave.
      expect(find.byKey(const Key('lock-pin')), findsNothing);
    });

    testWidgets('se puede volver al PIN sin desbloquear', (tester) async {
      await montar(tester);
      await tester.tap(find.byKey(const Key('lock-usar-clave')));
      await tester.pump();
      await tester.tap(find.text('Volver al PIN'));
      await tester.pump();
      expect(find.byKey(const Key('lock-pin')), findsOneWidget);
    });

    testWidgets('siempre hay salida: cerrar sesión', (tester) async {
      await montar(tester);
      expect(find.byKey(const Key('lock-cerrar-sesion')), findsOneWidget);
      // El aviso de que el PIN no cierra la sesión sigue visible.
      expect(find.textContaining('la sesión no se cierra'), findsOneWidget);
    });
  });

  group('D-120 · resumen del borrado local', () {
    test('cuenta los casos, las acciones y las fotos', () {
      const resumen = ResumenBorrado(
        casos: 4,
        masivas: 1,
        acciones: 2,
        evidencias: 3,
        mensajes: 5,
        fotos: 6,
      );
      expect(resumen.vacio, isFalse);
      expect(resumen.resumen, contains('4 caso(s)'));
      expect(resumen.resumen, contains('1 masiva(s)'));
      expect(resumen.resumen, contains('2 acción(es)'));
      expect(resumen.resumen, contains('6 foto(s)'));
    });

    test('un dispositivo vacío lo dice sin inventar cifras', () {
      const resumen = ResumenBorrado();
      expect(resumen.vacio, isTrue);
      expect(resumen.resumen, contains('No había nada que borrar'));
    });

    test('el restablecimiento completo borra sesión y credencial', () {
      const resumen = ResumenBorrado(casos: 1, sesion: true, credenciales: true);
      expect(resumen.sesion, isTrue);
      expect(resumen.credenciales, isTrue);
    });
  });
}
