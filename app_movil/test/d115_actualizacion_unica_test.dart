// D-115 · La actualización de la APK en un solo botón.
//
// Cubre la pieza que une los tres procesos (evidencias → cola → despacho del
// día) sin red ni SQLite: el orden de las fases, el resultado único y el manejo
// de un fallo de descarga. Además fija que la pantalla Dispositivo ya no tenga
// los botones separados DESCARGA/CARGA.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/core/api_error.dart';
import 'package:ggto_tecnico/features/sync/actualizacion_datos_service.dart';
import 'package:ggto_tecnico/features/sync/download_service.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';
import 'package:ggto_tecnico/features/sync/sync_screen.dart';
import 'package:ggto_tecnico/features/sync/upload_service.dart';

const _carga = ResultadoCarga(
  fotosSubidas: 2,
  actividadesEnviadas: 1,
  errores: [],
);

final _descarga = ResultadoDescarga(
  nuevos: 3,
  actualizados: 0,
  serverTs: DateTime.utc(2026, 10, 19, 12),
  motivo: 'OK',
  mensaje: '3 caso(s) de su cuadrilla C-001.',
  cuadrillaCodigo: 'C-001',
  casosCuadrilla: 3,
  descartados: 2,
);

class _SyncFalso extends SyncProvider {
  _SyncFalso({this.pendientesFalsos = 1});

  final int pendientesFalsos;
  int refrescos = 0;

  @override
  int get pendientesSinError => pendientesFalsos;

  @override
  bool get enLinea => true;

  @override
  Future<void> refrescar() async {
    refrescos++;
  }

  @override
  Future<ResultadoSync> sincronizar({
    bool silencioso = false,
    double progresoDesde = 0,
    double progresoHasta = 1,
  }) async =>
      const ResultadoSync(enviadas: 1, reintentar: 0, fallidas: 0, pendientes: 0);
}

void main() {
  group('D-115 · resultado de la actualización completa', () {
    test('resume evidencias, cola y despacho con los casos descartados', () {
      final resultado = ResultadoActualizacionDatos(
        carga: _carga,
        cola: const ResultadoSync(enviadas: 1, reintentar: 0, fallidas: 0, pendientes: 0),
        descarga: _descarga,
      );

      expect(resultado.huboErrores, isFalse);
      expect(resultado.sinDescarga, isFalse);
      expect(resultado.resumen, contains('2 evidencia(s)'));
      expect(resultado.resumen, contains('1 actividad(es)'));
      expect(resultado.resumen, contains('3 nuevos'));
      expect(resultado.resumen, contains('2 descartados'));
    });

    test('un fallo de descarga no oculta lo que sí se cargó', () {
      const resultado = ResultadoActualizacionDatos(
        carga: _carga,
        errorDescarga: 'Sin conexión con el servidor.',
      );

      expect(resultado.huboErrores, isTrue);
      expect(resultado.sinDescarga, isTrue);
      expect(resultado.resumen, contains('2 evidencia(s)'));
      expect(resultado.resumen, contains('sin descarga'));
    });
  });

  group('D-115 · orden de la actualización', () {
    test('primero evidencias, luego cola y al final el despacho del día', () async {
      final orden = <String>[];
      final sync = _SyncFalso();
      final resultado = await ActualizacionDatosService.ejecutar(
        sync: sync,
        cargar: (onProgreso) async {
          orden.add('carga');
          onProgreso?.call('Subiendo fotos…', 0.5);
          return _carga;
        },
        sincronizar: (s) async {
          orden.add('cola');
          return const ResultadoSync(enviadas: 1, reintentar: 0, fallidas: 0, pendientes: 0);
        },
        descargar: (onProgreso) async {
          orden.add('descarga');
          onProgreso?.call('Descargando el despacho…', 0.9);
          return _descarga;
        },
      );

      expect(orden, ['carga', 'cola', 'descarga']);
      expect(sync.refrescos, greaterThan(0));
      expect(resultado.descarga, same(_descarga));
      expect(resultado.huboErrores, isFalse);
    });

    test('si la descarga falla, la carga se conserva y el resultado lo informa',
        () async {
      final resultado = await ActualizacionDatosService.ejecutar(
        sync: _SyncFalso(pendientesFalsos: 0),
        cargar: (_) async => _carga,
        sincronizar: (_) async =>
            const ResultadoSync(enviadas: 0, reintentar: 0, fallidas: 0, pendientes: 0),
        descargar: (_) async =>
            throw ApiError(mensaje: 'Sin conexión con el servidor.', esDeRed: true),
      );

      expect(resultado.carga, same(_carga));
      expect(resultado.descarga, isNull);
      expect(resultado.errorDescarga, contains('Sin conexión'));
      expect(resultado.huboErrores, isTrue);
    });
  });

  group('D-115 · pantalla Dispositivo', () {
    testWidgets('tiene un solo botón ACTUALIZAR y ya no DESCARGA/CARGA',
        (tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider<SyncProvider>.value(
          value: _SyncFalso(pendientesFalsos: 0),
          child: const MaterialApp(home: SyncScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('ACTUALIZAR'), findsOneWidget);
      expect(find.text('DESCARGA'), findsNothing);
      expect(find.text('CARGA'), findsNothing);
    });
  });
}
