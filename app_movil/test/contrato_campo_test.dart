// Pruebas del contrato de la app móvil: seriales, backoff y payloads (Ciclo 8).
//
// Cubren la lógica pura que sostiene la sincronización offline, sin necesidad de
// dispositivo ni de red.

import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/features/evidencias/evidencia_service.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';

void main() {
  group('serial de evidencia (§4.3)', () {
    test('incluye caso, id de avería, tipo y fecha/hora', () {
      final serial = EvidenciaService.serialDe(
        idCaso: '42',
        idAveria: '28626318',
        tipo: TipoEvidencia.potencia,
        momento: DateTime(2026, 10, 1, 14, 35, 9),
      );
      expect(serial, '42_28626318-POTENCIA-20261001-143509.jpg');
    });

    test('distingue los tres tipos del brief', () {
      final momento = DateTime(2026, 1, 2, 3, 4, 5);
      String serial(TipoEvidencia tipo) => EvidenciaService.serialDe(
            idCaso: '1',
            idAveria: 'A-1',
            tipo: tipo,
            momento: momento,
          );
      expect(serial(TipoEvidencia.potencia), contains('-POTENCIA-'));
      expect(serial(TipoEvidencia.navegacion), contains('-NAVEGACION-'));
      expect(serial(TipoEvidencia.demo), contains('-DEMO-'));
    });

    test('sanea los caracteres no válidos del identificador', () {
      final serial = EvidenciaService.serialDe(
        idCaso: '7',
        idAveria: 'REF/2324X 00001',
        tipo: TipoEvidencia.demo,
        momento: DateTime(2026, 12, 31, 23, 59, 59),
      );
      expect(serial, startsWith('7_REF_2324X_00001-DEMO-20261231-235959'));
      expect(serial.contains('/'), isFalse);
      expect(serial.contains(' '), isFalse);
    });

    test('rellena con ceros el mes, el día y la hora', () {
      final serial = EvidenciaService.serialDe(
        idCaso: '1',
        idAveria: 'X',
        tipo: TipoEvidencia.demo,
        momento: DateTime(2026, 2, 3, 4, 5, 6),
      );
      expect(serial.endsWith('-20260203-040506.jpg'), isTrue);
    });
  });

  group('backoff de la cola offline (RNF-20)', () {
    test('duplica la espera y se detiene en el tope', () {
      expect(SyncProvider.backoffMinutos(1), 1);
      expect(SyncProvider.backoffMinutos(2), 2);
      expect(SyncProvider.backoffMinutos(3), 4);
      expect(SyncProvider.backoffMinutos(4), 8);
      expect(SyncProvider.backoffMinutos(5), 16);
      expect(SyncProvider.backoffMinutos(6), 32);
      expect(SyncProvider.backoffMinutos(7), 60);
      expect(SyncProvider.backoffMinutos(20), 60);
    });

    test('nunca devuelve cero ni valores negativos', () {
      expect(SyncProvider.backoffMinutos(0), greaterThan(0));
      expect(SyncProvider.backoffMinutos(-3), greaterThan(0));
    });
  });
}
