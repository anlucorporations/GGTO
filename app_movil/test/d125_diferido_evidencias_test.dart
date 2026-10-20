// D-125 · Regresión de H-08: las evidencias de un diferido viajan en la CARGA
// como actividad CONTACTO, nunca como estado contra `/casos/{id}/estado`.
//
// El defecto original: al diferir sin conexión, la APK encolaba además una acción
// `DIFERIDO_EVIDENCIAS` con `endpoint: '/casos/{id}/estado'` y un payload sin
// `estado_actual`; el servidor devolvía 422 y la acción quedaba en ERROR para
// siempre, con la foto sin vínculo. La traducción de la cola vive ahora en
// `cola_offline.actividadDeCarga` (función pura) y aquí se fija su contrato.

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/sync/cola_offline.dart';

const _fecha = '2026-10-20T10:00:00.000Z';

void main() {
  group('D-125 · H-08: la evidencia del diferido se envía como CONTACTO', () {
    test('DIFERIDO_EVIDENCIAS produce una actividad CONTACTO con sus seriales', () {
      final actividad = actividadDeCarga(
        idLocal: 41,
        idCaso: 900,
        tipo: 'DIFERIDO_EVIDENCIAS',
        payload: {
          'evidencias': ['AV-1-A2-DEMO-01.jpg', 'AV-1-A2-DEMO-02.jpg'],
        },
        fechaHora: _fecha,
      );

      expect(actividad, isNotNull);
      expect(actividad!['tipo'], 'CONTACTO');
      expect(actividad['id_caso'], 900);
      expect(actividad['id_actividad_local'], 41);
      expect(actividad['reporte_corto'], 'Evidencias del diferido');
      expect(actividad['evidencias'], hasLength(2));
      expect(actividad['fecha_hora'], _fecha);
    });

    test('ese tipo NUNCA se traduce en un cambio de estado (causa del 422)', () {
      final estado = estadoDeCarga(
        idLocal: 41,
        idCaso: 900,
        tipo: 'DIFERIDO_EVIDENCIAS',
        payload: {'evidencias': ['X.jpg']},
      );
      expect(estado, isNull, reason: 'no debe pedirse /casos/{id}/estado sin estado_actual');
    });

    test('el diferido en sí sigue siendo un cambio de estado', () {
      final estado = estadoDeCarga(
        idLocal: 42,
        idCaso: 900,
        tipo: 'DIFERIDO',
        payload: {'estado_actual': 'DIFERIDO', 'motivo_estado': 'Cliente ausente'},
      );
      expect(estado, isNotNull);
      expect(estado!['estado_nuevo'], 'DIFERIDO');
      expect(estado['motivo'], 'Cliente ausente');
    });
  });

  group('D-125 · traducción del resto de la cola', () {
    test('CIERRE conserva modo, método y causa', () {
      final actividad = actividadDeCarga(
        idLocal: 7,
        idCaso: 5,
        tipo: 'CIERRE',
        payload: {
          'descripcion': 'Se reemplazó el conector',
          'modo': 'COS',
          'id_metodo': 3,
          'id_causa': 1,
          'evidencias': ['foto.jpg'],
        },
        fechaHora: _fecha,
      );
      expect(actividad!['tipo'], 'CIERRE');
      expect(actividad['resultado'], 'EXITOSO');
      expect(actividad['modo'], 'COS');
      expect(actividad['id_metodo'], 3);
      expect(actividad['id_causa'], 1);
      expect(actividad['evidencias'], ['foto.jpg']);
    });

    test('ENRUTADO conserva el motivo y las evidencias', () {
      final actividad = actividadDeCarga(
        idLocal: 8,
        idCaso: 5,
        tipo: 'ENRUTADO',
        payload: {'motivo': 'Falta material', 'evidencias': ['e.jpg']},
        fechaHora: _fecha,
      );
      expect(actividad!['tipo'], 'ENRUTADO');
      expect(actividad['reporte_corto'], 'Falta material');
      expect(actividad['evidencias'], ['e.jpg']);
    });

    test('los estados de campo viajan como estado, no como actividad', () {
      for (final tipo in ['CONTACTADO', 'CITADO', 'ESTADO']) {
        expect(
          actividadDeCarga(
            idLocal: 1, idCaso: 5, tipo: tipo, payload: const {}, fechaHora: _fecha,
          ),
          isNull,
          reason: '$tipo no crea actividad',
        );
        final estado = estadoDeCarga(
          idLocal: 1, idCaso: 5, tipo: tipo, payload: const {},
        );
        expect(estado, isNotNull, reason: '$tipo debe cambiar el estado');
        expect(estado!['estado_nuevo'], tipo);
      }
    });

    test('los tipos del outbox no entran en el lote', () {
      for (final tipo in ['CITA', 'FALLA_MASIVA', 'EVIDENCIA']) {
        expect(
          actividadDeCarga(
            idLocal: 1, idCaso: 5, tipo: tipo, payload: const {}, fechaHora: _fecha,
          ),
          isNull,
        );
        expect(
          estadoDeCarga(idLocal: 1, idCaso: 5, tipo: tipo, payload: const {}),
          isNull,
        );
      }
    });
  });
}
