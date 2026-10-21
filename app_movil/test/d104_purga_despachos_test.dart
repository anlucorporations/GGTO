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
        locales: [
          fila('AV-1', 101, 'ASIGNADO'),
          fila('AV-PEND', 102, 'PENDIENTE'),
        ],
        idsDelDia: {101, 102},
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

    test('sin despacho del día se conserva lo que pertenece al día indicado', () {
      // D-115: la descarga decide si procede purgar (con cuadrilla de campo) y
      // llama al plan con los ids del día (vacíos si aún no hay despacho).
      final borrar = PurgaDespachos.planificar(
        locales: [fila('AV-1', 101, 'ASIGNADO'), fila('AV-2', 102, 'ASIGNADO')],
        idsDelDia: {102},
        protegidos: const {},
      );
      expect(borrar, ['AV-1']);
    });
  });

  group('D-119 · la purga no borra lo que el servidor entrega', () {
    test('conserva el trabajo vigente aunque no sea del despacho de hoy', () {
      // El servidor manda `ids_vigentes` con todo lo que reconoce a la cuadrilla
      // (incluido lo que viene de una jornada anterior): la purga no lo toca.
      final borrar = PurgaDespachos.planificar(
        locales: [
          fila('AV-VIGENTE', 301, 'ASIGNADO'),
          fila('AV-AJENO', 302, 'ASIGNADO'),
        ],
        idsDelDia: const {},
        protegidos: const {},
        idsVigentes: {301},
      );
      expect(borrar, ['AV-AJENO']);
    });

    test('conserva los casos recién descargados (despacho del día en BORRADOR)', () {
      // Era el defecto reportado: el despacho del día seguía en BORRADOR, así que
      // `ids_del_dia` venía vacío y la purga borraba en la misma sincronización
      // los 4 casos que la descarga acababa de entregar.
      final borrar = PurgaDespachos.planificar(
        locales: [
          fila('AV-1', 401, 'ASIGNADO'),
          fila('AV-2', 402, 'NUEVO'),
          fila('AV-3', 403, 'PENDIENTE'),
          fila('AV-4', 404, 'ASIGNADO'),
        ],
        idsDelDia: const {},
        protegidos: const {},
        idsDescargados: {401, 402, 403, 404},
      );
      expect(borrar, isEmpty);
    });

    test('sin ids del servidor la purga sigue limpiando lo ajeno', () {
      final borrar = PurgaDespachos.planificar(
        locales: [fila('AV-VIEJO', 501, 'ASIGNADO')],
        idsDelDia: const {},
        protegidos: const {},
        idsVigentes: const {999},
        idsDescargados: const {998},
      );
      expect(borrar, ['AV-VIEJO']);
    });
  });

  group('D-115 · ¿procede purgar en la actualización?', () {
    test('con cuadrilla de campo, aunque no haya despacho del día', () {
      expect(
        PurgaDespachos.procede(motivo: 'SIN_DESPACHO', cuadrillaResuelta: true),
        isTrue,
      );
      expect(PurgaDespachos.procede(motivo: 'OK', cuadrillaResuelta: true), isTrue);
    });

    test('sin cuadrilla o en la cuadrilla 0 no se purga', () {
      expect(
        PurgaDespachos.procede(motivo: 'SIN_CUADRILLA', cuadrillaResuelta: false),
        isFalse,
      );
      expect(
        PurgaDespachos.procede(motivo: 'SIN_TECNICO', cuadrillaResuelta: false),
        isFalse,
      );
      expect(
        PurgaDespachos.procede(motivo: 'CUADRILLA_GESTION', cuadrillaResuelta: true),
        isFalse,
      );

      // D-140 · H-23: una cuadrilla de gestión no purga aunque tenga casos; la
      // bandera la manda el servidor en la descarga.
      expect(
        PurgaDespachos.procede(
          motivo: 'OK',
          cuadrillaResuelta: true,
          purgaPermitida: false,
        ),
        isFalse,
      );
      expect(
        PurgaDespachos.procede(
          motivo: 'OK',
          cuadrillaResuelta: true,
          purgaPermitida: true,
        ),
        isTrue,
      );
    });
  });
}
