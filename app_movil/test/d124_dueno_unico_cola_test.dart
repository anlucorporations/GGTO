// D-124 · Un solo dueño de la cola offline y un cerrojo compartido (H-07).
//
// El defecto: el envío automático de cada 5 min y la CARGA consumían la misma
// cola sin cerrojo, así que una acción podía salir dos veces. Aquí se fija la
// regla —cada tipo tiene un dueño— y el comportamiento del cerrojo.

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/core/sync_lock.dart';
import 'package:ggto_tecnico/features/sync/cola_offline.dart';

Map<String, dynamic> accion(int id, String tipo) => {'id': id, 'tipo': tipo};

void main() {
  group('D-124 · dueño único de la cola', () {
    test('los cierres, enrutados y evidencias de diferido son de la CARGA', () {
      expect(tiposQueSoloVaPorCarga, containsAll(['CIERRE', 'ENRUTADO', 'DIFERIDO_EVIDENCIAS']));
      expect(esTipoDeCarga('cierre'), isTrue, reason: 'el tipo se compara sin distinguir mayúsculas');
      expect(esTipoDeCarga('CONTACTADO'), isFalse);
      expect(esTipoDeCarga('FALLA_MASIVA'), isFalse);
    });

    test('el outbox ignora las acciones que envía la CARGA', () {
      final cola = [
        accion(1, 'CIERRE'),
        accion(2, 'CONTACTADO'),
        accion(3, 'ENRUTADO'),
        accion(4, 'FALLA_MASIVA'),
        accion(5, 'DIFERIDO_EVIDENCIAS'),
        accion(6, 'CITA'),
      ];
      final outbox = accionesParaOutbox(cola).map((a) => a['id']).toList();
      expect(outbox, [2, 4, 6]);
    });

    test('una cola sin acciones de la CARGA se envía completa', () {
      final cola = [accion(1, 'CONTACTADO'), accion(2, 'FALLA_MASIVA')];
      expect(accionesParaOutbox(cola), hasLength(2));
    });

    test('la cola vacía no rompe nada', () {
      expect(accionesParaOutbox(const []), isEmpty);
    });
  });

  group('D-124 · cerrojo de sincronización', () {
    test('ejecutar serializa: la segunda operación espera a la primera', () async {
      final lock = SyncLock.instance;
      final orden = <String>[];
      final primera = lock.ejecutar(() async {
        orden.add('a1');
        await Future<void>.delayed(const Duration(milliseconds: 60));
        orden.add('a2');
      });
      final segunda = lock.ejecutar(() async {
        orden.add('b1');
      });
      await Future.wait([primera, segunda]);
      expect(orden, ['a1', 'a2', 'b1'], reason: 'no puede haber dos sincronizaciones a la vez');
      expect(lock.ocupado, isFalse);
    });

    test('intentar devuelve null si ya hay una operación en curso', () async {
      final lock = SyncLock.instance;
      final enCurso = lock.ejecutar(
        () => Future<void>.delayed(const Duration(milliseconds: 80)),
      );
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(lock.ocupado, isTrue);
      final saltada = await lock.intentar(() async => 'hecho');
      expect(saltada, isNull, reason: 'el auto-envío se salta la vuelta, no encola');
      await enCurso;
      expect(lock.ocupado, isFalse);
      // Sin nada en curso, se ejecuta con normalidad.
      expect(await lock.intentar(() async => 'hecho'), 'hecho');
    });

    test('un fallo libera el cerrojo', () async {
      final lock = SyncLock.instance;
      await expectLater(
        lock.ejecutar(() async => throw StateError('fallo de prueba')),
        throwsA(isA<StateError>()),
      );
      expect(lock.ocupado, isFalse);
      expect(await lock.ejecutar(() async => 42), 42);
    });
  });
}
