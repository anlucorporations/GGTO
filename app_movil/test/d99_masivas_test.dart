// Pruebas del incremento D-99 (módulo MASIVAS en la APK).
//
// Cubren, sin emulador ni red:
//   * la persistencia local de masivas (merge por id y borrado de las que ya no
//     vienen) mediante el plan puro del `DatabaseHelper`;
//   * la **RUTA** de la ficha, tomada de `ruta`/`extra` (columna EXTRA de la
//     ingesta) y siempre visible;
//   * el texto obligatorio del cierre («Reparado en FDT») y el aviso de que el
//     cierre alcanza a **todos** los casos asociados;
//   * el rol: TECNICO ve la ficha en solo lectura (sin PLANIFICAR ni CERRAR).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/core/database.dart';
import 'package:ggto_tecnico/features/masivas/ficha_masiva_screen.dart';
import 'package:ggto_tecnico/features/masivas/masivas_provider.dart';
import 'package:ggto_tecnico/features/masivas/masivas_screen.dart';
import 'package:ggto_tecnico/features/masivas/masivas_service.dart';

/// Caso asociado tal como lo entrega la DESCARGA (con la RUTA en `extra`).
Map<String, dynamic> _caso({
  String? ruta,
  String extra = 'TARJETA 3 / PUERTO 7 / FAT C-01',
}) =>
    {
      'id_caso': 91,
      'id_averia': 'TSTD99-M1',
      'estado_actual': 'ASIGNADO',
      'nombre_cliente': 'CLIENTE X',
      'telefono': '7000000000',
      'direccion': 'SECTOR D99 ALFA CASA 1',
      'id_sector': 3,
      'sector_nombre': 'Alfa',
      'olt': 'OLT-01',
      'slot': '3',
      'puerto': '7',
      'fat': 'FAT-C01',
      'extra': extra,
      if (ruta != null) 'ruta': ruta,
      'id_cuadrilla': 2,
      'cuadrilla_codigo': 'TCD9A',
      'cuadrilla_nombre': 'Cuadrilla D99 1',
      'origen_asociacion': 'AUTO',
    };

/// Masiva activa tal como la entrega `GET /sync/descarga`.
Map<String, dynamic> _masiva({
  int idFalla = 12,
  String estado = 'DETECTADA',
  int casosAsociados = 8,
  Map<String, dynamic>? caso,
  List<Map<String, dynamic>>? ordenes,
}) =>
    {
      'id_falla': idFalla,
      'descripcion': 'Concentración de 8 casos en olt OLT-01 (últimas 24 h)',
      'estado': estado,
      'origen': 'AUTOMATICA',
      'clave_concentracion': 'olt:OLT-01',
      'id_sector': 3,
      'sector_nombre': 'Alfa',
      'id_cuadrilla': 2,
      'odn': 'ODN-77',
      'fat': 'FAT-C01',
      'direccion': 'CALLE 1, CASA 4',
      'latitud': 10.1234567,
      'longitud': -66.9876543,
      'planificacion': null,
      'reporte_simple': null,
      'planificada_en': null,
      'fecha_deteccion': '2026-10-14T14:23:01.036467+00:00',
      'evidencias': ['FM-1-FALLA_MASIVA-20261006-120000.jpg'],
      'actualizado_en': '2026-10-14T14:23:01+00:00',
      'casos_asociados': casosAsociados,
      'ordenes': ordenes ??
          [
            {
              'id_orden': 4,
              'estado': 'SOLICITADA',
              'observacion': '[Falla 12] cable',
              'fecha': '2026-10-14T14:20:00+00:00',
            },
          ],
      'casos': [caso ?? _caso()],
    };

void main() {
  group('D-99 · persistencia local de masivas', () {
    test('el merge guarda lo que llega y borra lo que ya no viene', () {
      final plan = DatabaseHelper.planMergeMasivas(
        ['12', '13', '14'],
        [
          _masiva(idFalla: 12),
          _masiva(idFalla: 15, estado: 'PLANIFICADA'),
        ],
      );

      expect(plan.guardar.map((m) => m['id_falla']), [12, 15]);
      // La 13 y la 14 ya no están activas: se borran del dispositivo.
      expect(plan.eliminar, ['13', '14']);
      // El merge conserva el contenido completo de cada masiva.
      expect(plan.guardar.first['casos_asociados'], 8);
      expect(plan.guardar.last['estado'], 'PLANIFICADA');
    });

    test('una lista vacía borra la caché y los elementos sin id se ignoran', () {
      final vacio = DatabaseHelper.planMergeMasivas(['7', '9'], const []);
      expect(vacio.guardar, isEmpty);
      expect(vacio.eliminar, ['7', '9']);

      final sinId = DatabaseHelper.planMergeMasivas(
        ['7'],
        [
          {'descripcion': 'sin id_falla'},
          _masiva(idFalla: 7),
        ],
      );
      expect(sinId.guardar.length, 1);
      expect(sinId.eliminar, isEmpty, reason: 'la 7 sigue viniendo');
    });

    test('la masiva de más prioridad es la DETECTADA con más casos', () {
      final orden = MasivasProvider.ordenarPorPrioridad([
        _masiva(idFalla: 3, estado: 'PLANIFICADA', casosAsociados: 20),
        _masiva(idFalla: 4, estado: 'DETECTADA', casosAsociados: 2),
        _masiva(idFalla: 9, estado: 'DETECTADA', casosAsociados: 15),
      ]);

      expect(orden.map((m) => m['id_falla']), [9, 4, 3]);
      expect(MasivasProvider.pesoEstado(_masiva(estado: 'DETECTADA')), 2);
      expect(MasivasProvider.pesoEstado(_masiva(estado: 'PLANIFICADA')), 1);
    });
  });

  group('D-99 · RUTA de la ficha (columna EXTRA de la ingesta)', () {
    test('prioriza ruta, después extra y por último Slot · Puerto · FAT', () {
      expect(
        MasivasProvider.rutaDeCaso(
          {'ruta': 'TARJETA 3 / PUERTO 7', 'extra': 'IGNORADO'},
        ),
        'TARJETA 3 / PUERTO 7',
      );
      expect(
        MasivasProvider.rutaDeCaso({'extra': 'TARJETA 3 / PUERTO 7'}),
        'TARJETA 3 / PUERTO 7',
      );
      expect(
        MasivasProvider.rutaDeCaso({'slot': '3', 'puerto': '7', 'fat': 'FAT-C01'}),
        '3 · 7 · FAT-C01',
      );
      expect(MasivasProvider.rutaDeCaso(const {}), '');
      expect(
        MasivasProvider.rutaDeMasiva(_masiva(caso: _caso(extra: 'RUTA-EXTRA'))),
        'RUTA-EXTRA',
      );
    });

    testWidgets('la ficha muestra la RUTA que viene del EXTRA', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: FichaMasivaScreen(masiva: _masiva(), rol: 'TECNICO'),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('RUTA: TARJETA 3 / PUERTO 7 / FAT C-01'),
        findsOneWidget,
      );
      expect(find.text('CASOS ASOCIADOS'), findsOneWidget);
    });

    testWidgets('la ficha prefiere la RUTA de la columna ruta', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: FichaMasivaScreen(
            masiva: _masiva(caso: _caso(ruta: 'RUTA-DE-LA-COLUMNA')),
            rol: 'TECNICO',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('RUTA: RUTA-DE-LA-COLUMNA'), findsOneWidget);
      expect(find.textContaining('RUTA: TARJETA 3'), findsNothing);
    });
  });

  group('D-99 · cierre de la masiva (RF-61/RF-62)', () {
    test('el texto por defecto de cada caso es «Reparado en FDT» y es válido',
        () {
      expect(MasivasService.descripcionCasoPorDefecto, 'Reparado en FDT');
      expect(
        MasivasService.errorDescripcionCaso(MasivasService.descripcionCasoPorDefecto),
        isNull,
      );
      expect(MasivasService.errorDescripcionCaso('Reparado'), isNotNull);

      // Descripción del trabajo: mínimo 10.
      expect(MasivasService.errorDescripcionCierre('Reparado'), isNotNull);
      expect(
        MasivasService.errorDescripcionCierre('Se reparó el FAT y se validó.'),
        isNull,
      );
      // Validador del CRASS obligatorio.
      expect(MasivasService.errorValidador(null), isNotNull);
      expect(MasivasService.errorValidador(7), isNull);
      expect(MasivasService.modosCierre, ['IVR', 'COS', 'SACAS']);
    });

    testWidgets('el aviso previo dice que solo se cierran los casos asociados',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: DialogoConfirmacionCierreMasiva(
            idFalla: 12,
            cantidadCasos: 8,
            modo: 'IVR',
            descripcionCaso: MasivasService.descripcionCasoPorDefecto,
          ),
        ),
      );

      expect(
        find.textContaining('Se cerrarán solo los 8 casos asociados'),
        findsOneWidget,
      );
      expect(find.textContaining('OLT + SLOT + PUERTO + FAT'), findsOneWidget);
      expect(find.textContaining('«Reparado en FDT»'), findsOneWidget);
      expect(find.textContaining('no se puede deshacer'), findsOneWidget);
      expect(find.text('Cerrar la masiva'), findsOneWidget);
      expect(find.text('Cancelar'), findsOneWidget);
    });

    testWidgets('el resumen informa los cerrados, los omitidos y el detalle',
        (tester) async {
      final resultado = ResultadoCierreMasiva.fromJson(const {
        'id_falla': 12,
        'estado': 'CERRADA',
        'casos_cerrados': 7,
        'casos_omitidos': 1,
        'detalle': [
          {'id_caso': 91, 'id_averia': 'TSTD99-M1', 'resultado': 'CERRADO'},
          {
            'id_caso': 92,
            'id_averia': 'TSTD99-M2',
            'resultado': 'OMITIDO',
            'motivo': 'El caso ya estaba cerrado',
          },
        ],
      });

      expect(resultado.casosCerrados, 7);
      expect(resultado.casosOmitidos, 1);
      expect(resultado.resumen, contains('7 caso(s) cerrado(s)'));

      await tester.pumpWidget(
        MaterialApp(home: ResumenCierreMasiva(resultado: resultado)),
      );

      expect(find.text('Casos cerrados: 7'), findsOneWidget);
      expect(find.text('Casos omitidos: 1'), findsOneWidget);
      expect(
        find.textContaining('#92 · TSTD99-M2 · OMITIDO'),
        findsOneWidget,
      );
    });
  });

  group('D-99 · rol y tarjeta de la lista', () {
    test('los roles se resuelven igual que los endpoints', () {
      for (final rol in ['TECNICO', 'COORDINADOR', 'SUPER']) {
        expect(MasivasProvider.puedePlanificar(rol), isFalse, reason: rol);
        expect(MasivasProvider.puedeCerrar(rol), isFalse, reason: rol);
      }
      for (final rol in ['ADMIN', 'SUPERVISOR']) {
        expect(MasivasProvider.puedePlanificar(rol), isTrue, reason: rol);
        expect(MasivasProvider.puedeCerrar(rol), isTrue, reason: rol);
      }
      expect(MasivasProvider.puedeSolicitarMaterial('COORDINADOR'), isTrue);
      expect(MasivasProvider.puedeSolicitarMaterial('ADMIN'), isTrue);
      expect(MasivasProvider.puedeSolicitarMaterial('TECNICO'), isFalse);
      // El rol no distingue mayúsculas ni espacios.
      expect(MasivasProvider.puedeCerrar(' supervisor '), isTrue);
    });

    testWidgets('el TECNICO ve la ficha en solo lectura', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: FichaMasivaScreen(masiva: _masiva(), rol: 'TECNICO'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('PLANIFICAR'), findsNothing);
      expect(find.text('CERRAR'), findsNothing);
      expect(find.text('MATERIALES'), findsOneWidget);
      expect(find.text('DATOS TÉCNICOS'), findsOneWidget);
    });

    test('las pestañas de gestión dependen del rol', () {
      final tecnico = FichaMasivaScreen.pestanasDe('TECNICO');
      expect(tecnico, ['CASOS ASOCIADOS', 'DATOS TÉCNICOS', 'MATERIALES']);
      expect(tecnico.contains('PLANIFICAR'), isFalse);
      expect(tecnico.contains('CERRAR'), isFalse);

      final coordinador = FichaMasivaScreen.pestanasDe('COORDINADOR');
      expect(coordinador.contains('PLANIFICAR'), isFalse);
      expect(coordinador.contains('CERRAR'), isFalse);
      expect(coordinador.contains('MATERIALES'), isTrue);

      expect(FichaMasivaScreen.pestanasDe('SUPERVISOR'), [
        'CASOS ASOCIADOS',
        'DATOS TÉCNICOS',
        'PLANIFICAR',
        'MATERIALES',
        'CERRAR',
      ]);
      expect(FichaMasivaScreen.pestanasDe('ADMIN').contains('CERRAR'), isTrue);
    });

    test('la tarjeta de la lista resume identificación, técnica y RUTA', () {
      final texto = TarjetaMasiva.lineas(_masiva()).join('\n');

      expect(texto, contains('Sector: Alfa'));
      expect(texto, contains('FAT: FAT-C01'));
      expect(texto, contains('ODN: ODN-77'));
      expect(texto, contains('RUTA: TARJETA 3 / PUERTO 7 / FAT C-01'));
      expect(texto, contains('Casos asociados: 8'));
      expect(texto, contains('Detectada el 14/10/2026'));
    });
  });
}
