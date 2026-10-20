// D-132 · H-15: la purga protege el caso de **toda** acción encolada.
//
// La protección leía `id_caso`/`id_averia` del payload. Las acciones de
// `DIFERIDO_EVIDENCIAS` solo llevan `evidencias`, así que su caso no quedaba
// protegido y la purga podía borrarlo con su trabajo pendiente. Ahora también se
// deduce del endpoint (`/casos/{id}/…`), que sí trae, de modo que las filas ya
// encoladas quedan cubiertas sin migración.

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/sync/purga_despachos.dart';

void main() {
  group('D-132 · claves de una acción encolada', () {
    test('payload con id_caso e id_averia protege ambos', () {
      final claves = PurgaDespachos.clavesDeAccion(
        payload: {'id_caso': 42, 'id_averia': 'AV-42'},
        endpoint: '/casos/42/estado',
      );
      expect(claves, containsAll(['42', 'AV-42']));
    });

    test('DIFERIDO_EVIDENCIAS sin el caso en el payload lo protege por el endpoint', () {
      final claves = PurgaDespachos.clavesDeAccion(
        payload: {'evidencias': ['foto-1.jpg']},
        endpoint: '/casos/900/estado',
      );
      expect(claves, {'900'}, reason: 'el caso debe quedar protegido de la purga');
    });

    test('una acción con payload rico y endpoint coincidente no duplica', () {
      final claves = PurgaDespachos.clavesDeAccion(
        payload: {'id_caso': 7, 'id_averia': 'AV-7'},
        endpoint: '/casos/7/estado',
      );
      expect(claves, {'7', 'AV-7'});
    });

    test('un endpoint con otro recurso no inventa claves', () {
      final claves = PurgaDespachos.clavesDeAccion(
        payload: const {},
        endpoint: '/citas',
      );
      expect(claves, isEmpty);
    });

    test('el id 0 (reporte de falla masiva) no protege a nadie', () {
      final claves = PurgaDespachos.clavesDeAccion(
        payload: {'id_caso': 0},
        endpoint: '/evidencias/upload',
      );
      expect(claves, isEmpty);
    });

    test('el payload ilegible no impide la protección por el endpoint', () {
      final claves = PurgaDespachos.clavesDeAccion(
        payload: const {},
        endpoint: '/casos/1234/cierre',
      );
      expect(claves, {'1234'});
    });
  });
}
