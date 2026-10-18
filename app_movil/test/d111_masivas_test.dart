// Pruebas del incremento D-111 (cuadro de MASIVAS con el estilo de CASOS).
//
// Cubren, sin emulador ni red:
//   * los tres indicadores del cuadro —Planificación, Materiales y Asignación—
//     con las dos formas en que llegan las órdenes (`ordenes` y
//     `ordenes_count`) y las dos de la cuadrilla (`id_cuadrilla` y código);
//   * las acciones con icono de la tarjeta según el rol (TECNICO solo consulta);
//   * la pestaña con la que abre la ficha la acción con icono;
//   * el widget del indicador: encendido/apagado y su nombre accesible.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/core/theme.dart';
import 'package:ggto_tecnico/features/masivas/ficha_masiva_screen.dart';
import 'package:ggto_tecnico/features/masivas/indicador_masiva.dart';
import 'package:ggto_tecnico/features/masivas/masivas_provider.dart';
import 'package:ggto_tecnico/features/masivas/masivas_screen.dart';

/// Caso asociado tal como lo entrega la DESCARGA (con la RUTA en `extra`).
Map<String, dynamic> _caso() => {
      'id_caso': 91,
      'id_averia': 'TSTD111-M1',
      'estado_actual': 'ASIGNADO',
      'sector_nombre': 'Alfa',
      'olt': 'OLT-01',
      'slot': '3',
      'puerto': '7',
      'fat': 'FAT-C01',
      'extra': 'TARJETA 3 / PUERTO 7 / FAT C-01',
      'origen_asociacion': 'AUTO',
    };

/// Masiva activa tal como la entrega `GET /sync/descarga`.
Map<String, dynamic> _masiva({
  String? planificacion,
  List<Map<String, dynamic>>? ordenes,
  int? ordenesContador,
  int? idCuadrilla = 2,
  String? cuadrillaCodigo = 'TCD9A',
  String? cuadrillaNombre = 'Cuadrilla D99 1',
}) =>
    {
      'id_falla': 12,
      'descripcion': 'Concentración de 8 casos en olt OLT-01 (últimas 24 h)',
      'estado': 'DETECTADA',
      'origen': 'AUTOMATICA',
      'clave_concentracion': 'olt:OLT-01',
      'id_sector': 3,
      'sector_nombre': 'Alfa',
      'id_cuadrilla': idCuadrilla,
      'cuadrilla_codigo': cuadrillaCodigo,
      'cuadrilla_nombre': cuadrillaNombre,
      'odn': 'ODN-77',
      'fat': 'FAT-C01',
      'direccion': 'CALLE 1, CASA 4',
      'planificacion': planificacion,
      'reporte_simple': null,
      'fecha_deteccion': '2026-10-14T14:23:01.036467+00:00',
      'casos_asociados': 8,
      if (ordenes != null) 'ordenes': ordenes,
      if (ordenesContador != null) 'ordenes_count': ordenesContador,
      'casos': [_caso()],
    };

const _orden = {
  'id_orden': 4,
  'estado': 'SOLICITADA',
  'observacion': '[Falla 12] cable',
  'fecha': '2026-10-14T14:20:00+00:00',
};

void main() {
  group('D-111 · indicadores del cuadro de masivas', () {
    test('Planificación: la enciende el texto del plan (RF-17)', () {
      expect(MasivasProvider.tienePlanificacion(_masiva()), isFalse);
      expect(MasivasProvider.tienePlanificacion(_masiva(planificacion: '   ')), isFalse);
      expect(
        MasivasProvider.tienePlanificacion(
          _masiva(planificacion: 'Cuadrilla 3 a las 7:00 con 120 m de fibra'),
        ),
        isTrue,
      );
    });

    test('Materiales: vale la lista de la descarga y el contador de la API', () {
      expect(MasivasProvider.ordenesDe(_masiva()), 0);
      expect(MasivasProvider.ordenesDe(_masiva(ordenes: const [])), 0);
      expect(MasivasProvider.ordenesDe(_masiva(ordenes: const [_orden])), 1);
      // El listado de la web/API manda el contador, no la lista.
      expect(MasivasProvider.ordenesDe(_masiva(ordenesContador: 3)), 3);
      expect(MasivasProvider.ordenesDe(_masiva(ordenesContador: 0)), 0);

      expect(MasivasProvider.tieneMateriales(_masiva()), isFalse);
      expect(MasivasProvider.tieneMateriales(_masiva(ordenes: const [_orden])), isTrue);
      expect(MasivasProvider.tieneMateriales(_masiva(ordenesContador: 2)), isTrue);
    });

    test('Asignación: la enciende la cuadrilla, por id o por código', () {
      expect(MasivasProvider.tieneAsignacion(_masiva()), isTrue);
      expect(
        MasivasProvider.tieneAsignacion(
          _masiva(idCuadrilla: null, cuadrillaCodigo: 'TCD9B', cuadrillaNombre: null),
        ),
        isTrue,
        reason: 'el código de cuadrilla basta para mostrarla asignada',
      );
      expect(
        MasivasProvider.tieneAsignacion(
          _masiva(
            idCuadrilla: null,
            cuadrillaCodigo: null,
            cuadrillaNombre: 'Cuadrilla D99 2',
          ),
        ),
        isTrue,
        reason: 'el nombre de la cuadrilla también cuenta',
      );
      expect(
        MasivasProvider.tieneAsignacion(
          _masiva(
            idCuadrilla: null,
            cuadrillaCodigo: null,
            cuadrillaNombre: null,
          ),
        ),
        isFalse,
      );
      expect(
        MasivasProvider.tieneAsignacion(
          _masiva(idCuadrilla: 0, cuadrillaCodigo: '', cuadrillaNombre: ''),
        ),
        isFalse,
      );
    });
  });

  group('D-111 · acciones con icono de la tarjeta', () {
    test('el rol decide las acciones, igual que las pestañas de la ficha', () {
      expect(TarjetaMasiva.accionesDe('TECNICO'), ['MATERIALES']);
      expect(TarjetaMasiva.accionesDe('COORDINADOR'), ['MATERIALES']);
      for (final rol in ['ADMIN', 'SUPERVISOR', ' supervisor '.toUpperCase()]) {
        expect(
          TarjetaMasiva.accionesDe(rol),
          ['PLANIFICAR', 'MATERIALES', 'CERRAR'],
          reason: rol,
        );
      }
      // Sin rol resoluble se ofrece solo la consulta de materiales.
      expect(TarjetaMasiva.accionesDe(''), ['MATERIALES']);
    });

    test('cada acción tiene su icono y su nombre accesible', () {
      expect(TarjetaMasiva.iconoDeAccion('PLANIFICAR').$2, 'Planificar');
      expect(TarjetaMasiva.iconoDeAccion('MATERIALES').$2, 'Materiales');
      expect(TarjetaMasiva.iconoDeAccion('CERRAR').$2, 'Cerrar');
      expect(TarjetaMasiva.iconoDeAccion('CERRAR').$1, Icons.task_alt);
    });

    test('la ficha abre en la pestaña de la acción, o en la primera', () {
      final supervisor = FichaMasivaScreen.pestanasDe('SUPERVISOR');
      expect(FichaMasivaScreen.indicePestana(supervisor, 'PLANIFICAR'), 2);
      expect(FichaMasivaScreen.indicePestana(supervisor, 'MATERIALES'), 3);
      expect(FichaMasivaScreen.indicePestana(supervisor, 'CERRAR'), 4);

      // El TECNICO no tiene PLANIFICAR ni CERRAR: abre la primera, sin fallar.
      final tecnico = FichaMasivaScreen.pestanasDe('TECNICO');
      expect(FichaMasivaScreen.indicePestana(tecnico, 'CERRAR'), 0);
      expect(FichaMasivaScreen.indicePestana(tecnico, 'MATERIALES'), 2);
      expect(FichaMasivaScreen.indicePestana(tecnico, null), 0);
    });
  });

  group('D-111 · tarjeta de la masiva con el estilo de CASOS', () {
    testWidgets('muestra la identificación, los tres indicadores y el estado',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TarjetaMasiva(
              masiva: _masiva(),
              rol: 'ADMIN',
              onTap: () {},
              alAbrirPestana: (_) {},
            ),
          ),
        ),
      );

      expect(find.text('Masiva #12'), findsOneWidget);
      expect(find.textContaining('RUTA: TARJETA 3 / PUERTO 7'), findsOneWidget);
      expect(find.textContaining('Casos asociados: 8'), findsOneWidget);

      // La columna de indicadores: los tres, con su estado en el Tooltip.
      expect(find.byType(IndicadorMasiva), findsNWidgets(3));
      expect(find.byTooltip('Planificación: sin planificar'), findsOneWidget);
      expect(find.byTooltip('Materiales: sin órdenes'), findsOneWidget);
      expect(find.byTooltip('Asignación: TCD9A'), findsOneWidget);

      // El estado de la masiva va como icono, no como texto suelto.
      expect(find.text('DETECTADA'), findsNothing);
    });

    testWidgets('las acciones abren la ficha en su pestaña', (tester) async {
      final abiertas = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TarjetaMasiva(
              masiva: _masiva(planificacion: 'Cuadrilla 3 a las 7:00'),
              rol: 'ADMIN',
              onTap: () => abiertas.add('FICHA'),
              alAbrirPestana: abiertas.add,
            ),
          ),
        ),
      );

      expect(find.byTooltip('Planificar'), findsOneWidget);
      expect(find.byTooltip('Materiales'), findsOneWidget);
      expect(find.byTooltip('Cerrar'), findsOneWidget);

      await tester.tap(find.byTooltip('Cerrar'));
      await tester.tap(find.byTooltip('Materiales'));
      await tester.tap(find.byTooltip('Planificar'));
      expect(abiertas, ['CERRAR', 'MATERIALES', 'PLANIFICAR']);

      // Tocar la tarjeta sigue abriendo la ficha (por la primera pestaña).
      await tester.tap(find.text('Masiva #12'));
      expect(abiertas.last, 'FICHA');
    });

    testWidgets('el TECNICO solo ve la acción de materiales', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TarjetaMasiva(
              masiva: _masiva(),
              rol: 'TECNICO',
              onTap: () {},
            ),
          ),
        ),
      );

      expect(find.byTooltip('Planificar'), findsNothing);
      expect(find.byTooltip('Cerrar'), findsNothing);
      // La acción de materiales; el indicador se rotula «Materiales: …».
      expect(find.byTooltip('Materiales'), findsOneWidget);
    });
  });

  group('D-111 · widget del indicador', () {
    test('encendido usa el par tinta/fondo de marca; apagado queda gris', () {
      expect(IndicadorMasiva.aspecto(true, 'PLANIFICACIÓN'), (Marca.info, Marca.infoClaro));
      expect(IndicadorMasiva.aspecto(true, 'MATERIALES'), (Marca.alerta, Marca.alertaClaro));
      expect(IndicadorMasiva.aspecto(true, 'ASIGNACIÓN'), (Marca.exito, Marca.exitoClaro));
      expect(IndicadorMasiva.aspecto(false, 'PLANIFICACIÓN'), (Marca.textoSuave, Colors.transparent));
    });

    testWidgets('expone su nombre accesible y responde al toque', (tester) async {
      var tocado = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: IndicadorMasiva(
              icono: Icons.event_available,
              activa: true,
              etiqueta: 'Planificación',
              detalle: 'cuadrilla 3 a las 7:00',
              onTap: () => tocado++,
            ),
          ),
        ),
      );

      expect(find.byTooltip('Planificación: cuadrilla 3 a las 7:00'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Planificación: cuadrilla 3 a las 7:00'),
        findsOneWidget,
      );
      await tester.tap(find.byType(IndicadorMasiva));
      expect(tocado, 1);
    });
  });
}
