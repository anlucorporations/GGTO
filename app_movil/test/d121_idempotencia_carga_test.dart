// D-121 · La CARGA marca cada acción de la cola con el desenlace del servidor.
//
// El defecto (H-01): la respuesta se trataba en bloque, así que un ítem
// rechazado devolvía **todo** el lote a reintento (con `intentos` fijo en 1) y el
// bueno se volvía a enviar una y otra vez. Aquí se fija la lectura por acción.

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/sync/upload_service.dart';

void main() {
  group('D-121 · desglose por acción de /sync/carga', () {
    test('lee los desenlaces aceptados y rechazados', () {
      final items = UploadService.planificarResultado([
        {
          'id_actividad_local': 21,
          'id_caso': 100,
          'aceptada': true,
          'mensaje': null,
          'id_actividad': 555,
        },
        {
          'id_actividad_local': 22,
          'id_caso': 100,
          'aceptada': false,
          'mensaje': 'El caso no está asignado a tu cuadrilla',
          'id_actividad': null,
        },
      ]);

      expect(items, hasLength(2));
      expect(items[0].idLocal, 21);
      expect(items[0].aceptada, isTrue);
      expect(items[0].idCaso, 100);
      expect(items[1].idLocal, 22);
      expect(items[1].aceptada, isFalse);
      expect(items[1].mensaje, contains('no está asignado'));
    });

    test('sin id local no hay nada que marcar (servidor antiguo o acción suelta)', () {
      final items = UploadService.planificarResultado([
        {'id_caso': 100, 'aceptada': true, 'id_actividad_local': null},
        {'id_caso': 100, 'aceptada': true},
      ]);
      expect(items, isEmpty);
    });

    test('tolera respuestas vacías o mal formadas', () {
      expect(UploadService.planificarResultado(null), isEmpty);
      expect(UploadService.planificarResultado('no es una lista'), isEmpty);
      expect(
        UploadService.planificarResultado([1, 'x', {'id_actividad_local': '21'}]),
        isEmpty,
      );
    });

    test('un lote mixto deja el bueno aceptado y el malo con su motivo', () {
      final items = UploadService.planificarResultado([
        {'id_actividad_local': 1, 'id_caso': 10, 'aceptada': true},
        {'id_actividad_local': 2, 'id_caso': 10, 'aceptada': false, 'mensaje': 'Caso no encontrado'},
        {'id_actividad_local': 3, 'id_caso': 11, 'aceptada': true, 'mensaje': 'Ya registrada en una carga anterior'},
      ]);
      final aceptadas = items.where((i) => i.aceptada).map((i) => i.idLocal).toList();
      final rechazadas = items.where((i) => !i.aceptada).map((i) => i.idLocal).toList();
      expect(aceptadas, [1, 3]);
      expect(rechazadas, [2]);
      // La duplicada se confirma (idempotencia) y se informa.
      expect(items.last.mensaje, contains('Ya registrada'));
    });
  });
}
