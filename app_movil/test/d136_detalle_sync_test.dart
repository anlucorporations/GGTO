// D-136 · H-19: la APK envía el detalle de lo que descargó y de lo que falló.
//
// `sync_log.detalle` existía y el servidor lo guardaba, pero la APK nunca lo
// enviaba: quien administraba solo veía contadores y no sabía **qué** llegó ni qué
// falló por caso. Estas funciones puras arman ese resumen.

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/sync/detalle_sync.dart';

void main() {
  group('D-136 · detalle de la descarga', () {
    test('incluye los ids, los conteos y el motivo', () {
      final detalle = detalleDescarga(
        idsRecibidos: {9, 3, 5},
        nuevos: 2,
        actualizados: 1,
        descartados: 1,
        idsDelDia: {5, 3},
        idsVigentes: {3, 5, 9},
        motivo: 'OK',
        cuadrilla: 'C-001',
      );
      final descarga = detalle['descarga'] as Map<String, dynamic>;
      expect(descarga['ids_recibidos'], [3, 5, 9], reason: 'ordenados');
      expect(descarga['nuevos'], 2);
      expect(descarga['actualizados'], 1);
      expect(descarga['descartados'], 1);
      expect(descarga['ids_del_dia'], [3, 5]);
      expect(descarga['ids_vigentes'], [3, 5, 9]);
      expect(descarga['motivo'], 'OK');
      expect(descarga['cuadrilla'], 'C-001');
    });

    test('sin cuadrilla no se inventa la clave', () {
      final detalle = detalleDescarga(
        idsRecibidos: const {},
        nuevos: 0,
        actualizados: 0,
        descartados: 0,
      );
      final descarga = detalle['descarga'] as Map<String, dynamic>;
      expect(descarga.containsKey('cuadrilla'), isFalse);
      expect(descarga['ids_recibidos'], isEmpty);
    });
  });

  group('D-136 · detalle de la carga', () {
    test('resume las acciones y los errores', () {
      final detalle = detalleCarga(
        actividades: 3,
        estados: 2,
        aceptadas: 4,
        rechazadas: 1,
        errores: ['Caso 465: sin cuadrilla'],
      );
      final carga = detalle['carga'] as Map<String, dynamic>;
      expect(carga['actividades'], 3);
      expect(carga['estados'], 2);
      expect(carga['aceptadas'], 4);
      expect(carga['rechazadas'], 1);
      expect(carga['errores'], ['Caso 465: sin cuadrilla']);
    });

    test('los errores se recortan a los últimos 20', () {
      final errores = List.generate(25, (i) => 'error $i');
      final detalle = detalleCarga(
        actividades: 25,
        estados: 0,
        aceptadas: 0,
        rechazadas: 25,
        errores: errores,
      );
      final carga = detalle['carga'] as Map<String, dynamic>;
      expect(carga['errores'], hasLength(20));
      expect((carga['errores'] as List).last, 'error 24');
    });
  });
}
