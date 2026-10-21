// D-144: la búsqueda libre mira todo el universo y se puede filtrar CERRADOS.
//
// Antes el listado ocultaba los casos gestionados (D-101) incluso al buscar, así
// que un caso cerrado «desaparecía» al buscarlo por su avería o su teléfono. Ahora
// la búsqueda cubre abiertos, cerrados y cancelados, y el filtro de estado permite
// pedir solo los CERRADOS.

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/casos/acciones_caso.dart';

Map<String, dynamic> caso(String id, String estado) => {
      'id_averia': id,
      'estado_actual': estado,
      'direccion': 'CALLE $id',
    };

void main() {
  final universo = [
    caso('AV-1', 'NUEVO'),
    caso('AV-2', 'CONTACTADO'),
    caso('AV-3', 'CERRADO'),
    caso('AV-4', 'CANCELADO'),
    caso('AV-5', 'ENRUTADO'),
  ];

  group('D-144 · búsqueda sobre todo el universo', () {
    test('sin búsqueda, el listado sigue ocultando los gestionados', () {
      final visibles = casosVisiblesDe(universo, verGestionados: false);
      expect(visibles.map((c) => c['id_averia']), ['AV-1', 'AV-2']);
    });

    test('con texto de búsqueda, un caso cerrado no queda oculto', () {
      // El texto lo filtra la consulta local (`leerCasos`); aquí se comprueba que
      // el listado **no vuelve a ocultar** lo que la búsqueda encontró.
      final encontrado = casosVisiblesDe(
        [caso('AV-3', 'CERRADO')],
        verGestionados: false,
        consulta: 'AV-3',
      );
      expect(encontrado.map((c) => c['id_averia']), ['AV-3']);
    });

    test('la búsqueda con texto devuelve el universo completo (sin filtrar estado)', () {
      final visibles = casosVisiblesDe(
        universo,
        verGestionados: false,
        consulta: 'AV-',
      );
      expect(visibles, hasLength(universo.length));
    });
  });

  group('D-144 · filtro de estado', () {
    test('CERRADOS muestra solo los casos cerrados', () {
      final visibles = casosVisiblesDe(
        universo,
        verGestionados: false,
        filtroEstado: filtroCerrados,
      );
      expect(visibles.map((c) => c['id_averia']), ['AV-3']);
    });

    test('ABIERTOS nunca muestra gestionados', () {
      final visibles = casosVisiblesDe(
        universo,
        verGestionados: true,
        filtroEstado: filtroAbiertos,
      );
      expect(visibles.map((c) => c['id_averia']), ['AV-1', 'AV-2']);
    });

    test('TODOS con «resueltos» activo devuelve el universo', () {
      final visibles = casosVisiblesDe(universo, verGestionados: true);
      expect(visibles, hasLength(universo.length));
    });

    test('las opciones del selector son Todos, Abiertos y Cerrados', () {
      expect(opcionesFiltroEstado.map((o) => o.etiqueta), ['Todos', 'Abiertos', 'Cerrados']);
      expect(opcionesFiltroEstado.map((o) => o.clave),
          [filtroTodos, filtroAbiertos, filtroCerrados]);
    });
  });
}
