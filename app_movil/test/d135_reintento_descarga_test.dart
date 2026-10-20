// D-135 · H-18: la descarga reintenta con backoff.
//
// La DESCARGA es la operación crítica —sin ella el técnico no tiene despacho— y
// era la única sin reintento: una sola llamada con 30 s de timeout. Un corte
// momentáneo de red dejaba la sincronización sin casos hasta la siguiente vuelta.

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/sync/reintentos.dart';

void main() {
  group('D-135 · política de reintentos de la descarga', () {
    test('un fallo de red se reintenta mientras queden intentos', () {
      expect(reintentableDescarga(status: null, deRed: true, intento: 0), isTrue);
      expect(reintentableDescarga(status: null, deRed: true, intento: 1), isTrue);
      expect(reintentableDescarga(status: null, deRed: true, intento: 2), isFalse,
          reason: 'agotados los reintentos se propaga el error');
    });

    test('un 5xx se reintenta; un 4xx no', () {
      expect(reintentableDescarga(status: 500, deRed: false, intento: 0), isTrue);
      expect(reintentableDescarga(status: 503, deRed: false, intento: 1), isTrue);
      expect(reintentableDescarga(status: 400, deRed: false, intento: 0), isFalse);
      expect(reintentableDescarga(status: 422, deRed: false, intento: 1), isFalse);
      expect(reintentableDescarga(status: 401, deRed: false, intento: 0), isFalse);
    });

    test('404/405 no se reintentan aquí: activan la caída al GET antiguo', () {
      expect(reintentableDescarga(status: 404, deRed: false, intento: 0), isFalse);
      expect(reintentableDescarga(status: 405, deRed: false, intento: 0), isFalse);
    });

    test('las esperas son crecientes y acotadas', () {
      expect(esperasDescarga, hasLength(2));
      expect(esperasDescarga[1], greaterThan(esperasDescarga[0]));
      expect(esperasDescarga.last.inSeconds, lessThanOrEqualTo(5));
    });
  });
}
