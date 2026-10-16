// D-104 · Purga de los casos no atendidos de despachos anteriores.
//
// La decisión vive en una función pura (`PurgaDespachos.planificar`), así que se
// prueba sin SQLite. Lo que se fija aquí:
//   · se conserva lo del despacho del día,
//   · se conserva lo que el técnico ya atendió (estados gestionados de D-101),
//   · se conserva **siempre** lo que tenga trabajo sin enviar,
//   · y se borra lo demás: lo no atendido que viene de jornadas anteriores.

import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/features/casos/acciones_caso.dart';
import 'package:ggto_tecnico/features/sync/purga_despachos.dart';

Map<String, dynamic> fila(String averia, int? idCaso, String estado) =>
    {'id': averia, 'id_caso': idCaso, 'estado': estado};

void main() {
  group('D-104 · plan de purga', () {
    test('conserva los casos del despacho del día aunque sigan pendientes', () {
      final borrar = PurgaDespachos.planificar(
        locales: [fila('AV-1', 101, 'ASIGNADO')],
        idsDelDia: {101},
        protegidos: {},
      );
      expect(borrar, isEmpty);
    });

    test('borra lo no atendido de despachos anteriores', () {
      final borrar = PurgaDespachos.planificar(
        locales: [
          fila('AV-VIEJO-1', 201, 'ASIGNADO'),
          fila('AV-VIEJO-2', 202, 'NUEVO'),
          fila('AV-VIEJO-3', 203, 'PENDIENTE'),
        ],
        idsDelDia: {101},
        protegidos: {},
      );
      expect(borrar, ['AV-VIEJO-1', 'AV-VIEJO-2', 'AV-VIEJO-3']);
    });

    test('conserva todos los estados gestionados (D-101)', () {
      final locales = [
        for (final estado in estadosGestionados) fila('AV-$estado', 300, estado),
      ];
      final borrar = PurgaDespachos.planificar(
        locales: locales,
        idsDelDia: const {},
        protegidos: const {},
      );
      expect(borrar, isEmpty);
      expect(estadosGestionados, {'CERRADO', 'CANCELADO', 'ENRUTADO', 'DIFERIDO', 'CITADO'});
    });

    test('CONTACTADO no cuenta como atendido (decisión del director)', () {
      final borrar = PurgaDespachos.planificar(
        locales: [fila('AV-CONTACTADO', 400, 'CONTACTADO')],
        idsDelDia: const {},
        protegidos: const {},
      );
      expect(borrar, ['AV-CONTACTADO']);
    });

    test('nunca borra un caso con trabajo sin enviar', () {
      final borrar = PurgaDespachos.planificar(
        // Protegido por la avería (acción en la cola) y por el id (evidencia).
        locales: [
          fila('AV-CON-COLA', 501, 'ASIGNADO'),
          fila('AV-CON-FOTO', 502, 'NUEVO'),
        ],
        idsDelDia: const {},
        protegidos: {'AV-CON-COLA', '502'},
      );
      expect(borrar, isEmpty);
    });

    test('ignora filas sin identificador y listas vacías', () {
      expect(
        PurgaDespachos.planificar(locales: const [], idsDelDia: const {}, protegidos: const {}),
        isEmpty,
      );
      expect(
        PurgaDespachos.planificar(
          locales: [fila('   ', 1, 'ASIGNADO')],
          idsDelDia: const {},
          protegidos: const {},
        ),
        isEmpty,
      );
    });

    test('sin despacho del día no se borra nada de lo que se conserva', () {
      // La condición de seguridad (no purgar sin despacho) la aplica la descarga,
      // pero el plan tampoco borra lo que pertenece al día indicado.
      final borrar = PurgaDespachos.planificar(
        locales: [fila('AV-1', 101, 'ASIGNADO'), fila('AV-2', 102, 'ASIGNADO')],
        idsDelDia: {102},
        protegidos: const {},
      );
      expect(borrar, ['AV-1']);
    });
  });
}
