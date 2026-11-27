// Regresión: la CARGA no debe enviar un cierre con `modo` vacío.
// El servidor rechazaba esas acciones con "El modo de cierre  no está en el
// catálogo" y los casos nunca se actualizaban desde la APK.

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/sync/cola_offline.dart';

void main() {
  group('actividadDeCarga · modo de cierre', () {
    test('un cierre sin modo usa IVR por defecto', () {
      final actividad = actividadDeCarga(
        idLocal: 2,
        idCaso: 100,
        tipo: 'CIERRE',
        payload: {'descripcion': 'Cierre desde el campo'},
        fechaHora: '2026-11-27T15:00:00Z',
      );
      expect(actividad, isNotNull);
      expect(actividad!['modo'], 'IVR');
    });

    test('respeta el modo explícito y lo normaliza', () {
      final actividad = actividadDeCarga(
        idLocal: 3,
        idCaso: 100,
        tipo: 'CIERRE',
        payload: {'descripcion': 'Cierre', 'modo': ' cos '},
        fechaHora: '2026-11-27T15:00:00Z',
      );
      expect(actividad!['modo'], 'COS');
    });
  });
}
