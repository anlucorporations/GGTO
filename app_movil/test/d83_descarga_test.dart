// Pruebas del incremento D-83 (la APK explica por qué no hay casos).
//
// Cubre la lógica pura del resultado de la DESCARGA: el mensaje del servidor
// (`motivo`/`mensaje`) y la cuadrilla resuelta. Antes, «sin cuadrilla»,
// «cuadrilla de gestión», «sin despacho» y «ya tiene todo» se anunciaban igual:
// «No hay casos nuevos ni cambios».

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/sync/download_service.dart';

void main() {
  group('resultado de la DESCARGA (D-83)', () {
    test('sin novedades muestra el mensaje del servidor, no el genérico', () {
      const r = ResultadoDescarga(
        nuevos: 0,
        actualizados: 0,
        serverTs: null,
        motivo: 'CUADRILLA_GESTION',
        mensaje: 'Su cuadrilla C-00 es de gestión (supervisor) y no recibe trabajo de campo.',
        cuadrillaCodigo: 'C-00',
      );
      expect(r.sinNovedades, isTrue);
      expect(r.resumen, contains('gestión'));
      expect(r.resumen, isNot(contains('No hay casos nuevos')));
      expect(r.motivo, 'CUADRILLA_GESTION');
    });

    test('sin cuadrilla vigente explica qué hacer', () {
      const r = ResultadoDescarga(
        nuevos: 0,
        actualizados: 0,
        serverTs: null,
        motivo: 'SIN_CUADRILLA',
        mensaje: 'No tiene una cuadrilla vigente: pida a su supervisor que lo asigne.',
      );
      expect(r.resumen, contains('cuadrilla vigente'));
    });

    test('con casos nuevos informa el conteo y la cuadrilla', () {
      final r = ResultadoDescarga(
        nuevos: 8,
        actualizados: 2,
        serverTs: DateTime.utc(2026, 10, 7, 17, 30),
        motivo: 'OK',
        mensaje: '10 caso(s) de su cuadrilla C-001.',
        cuadrillaCodigo: 'C-001',
        casosCuadrilla: 8,
      );
      expect(r.sinNovedades, isFalse);
      expect(r.resumen, '8 nuevos · 2 actualizados · cuadrilla C-001');
      expect(r.casosCuadrilla, 8);
    });

    test('sin mensaje del servidor conserva el texto histórico', () {
      const r = ResultadoDescarga(nuevos: 0, actualizados: 0, serverTs: null);
      expect(r.resumen, 'No hay casos nuevos ni cambios.');
    });

    test('ya tiene todo: lo dice sin alarmar', () {
      const r = ResultadoDescarga(
        nuevos: 0,
        actualizados: 0,
        serverTs: null,
        motivo: 'SIN_CAMBIOS',
        mensaje: 'Su cuadrilla C-002 tiene 21 caso(s) y el dispositivo ya los tiene todos: '
            'no hay cambios.',
        cuadrillaCodigo: 'C-002',
        casosCuadrilla: 21,
      );
      expect(r.resumen, contains('ya los tiene todos'));
      expect(r.resumen, isNot(contains('pida a su supervisor')));
    });
  });
}
