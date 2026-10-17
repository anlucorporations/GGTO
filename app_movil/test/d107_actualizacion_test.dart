// D-107 · La APK se actualiza desde la propia app, sin reinstalarla.
//
// Se prueban las piezas que no dependen del dispositivo: el nombre del archivo
// descargado, la semántica del resultado y el flujo de la tarjeta de versión con
// la actualización **inyectada** (sin red y sin canal nativo).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/features/usuario/actualizador_apk.dart';
import 'package:ggto_tecnico/features/usuario/banner_actualizacion.dart';
import 'package:ggto_tecnico/features/usuario/tarjeta_version.dart';
import 'package:ggto_tecnico/features/usuario/version_service.dart';

MetaApk _meta(String version) => MetaApk(
      version: version,
      nombre: 'GGTO Técnico',
      ruta: '/apk/ggto-tecnico.apk',
      kb: 24243,
      sha256: 'a' * 64,
      compiladoEn: null,
      nota: '',
    );

void main() {
  group('D-107 · actualizador de la APK', () {
    test('el archivo descargado lleva la versión y no el signo +', () {
      expect(ActualizadorApk.nombreArchivo('1.8.0+17'), 'ggto-1.8.0-17.apk');
      expect(ActualizadorApk.nombreArchivo('2.0.0+100'), 'ggto-2.0.0-100.apk');
    });

    test('solo el instalador abierto cuenta como éxito', () {
      for (final estado in EstadoActualizacion.values) {
        final resultado = ResultadoActualizacion(estado, 'x');
        expect(resultado.ok, estado == EstadoActualizacion.instaladorAbierto,
            reason: estado.name);
      }
    });
  });

  group('D-107 · la tarjeta actualiza sin reinstalar', () {
    testWidgets('«Actualizar ahora» descarga, informa el avance y abre el instalador',
        (tester) async {
      // La tarjeta completa (con el aviso de resultado) no cabe en la pantalla
      // por defecto del entorno de pruebas; en la app vive dentro de una lista.
      tester.view.physicalSize = const Size(900, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      var llamadas = 0;
      double? progresoVisto;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TarjetaVersion(
            versionInstalada: '1.7.0+16',
            consultar: () async => _meta('1.8.0+17'),
            actualizar: (meta, onProgreso) async {
              llamadas++;
              expect(meta.version, '1.8.0+17');
              onProgreso?.call(0.5, 'Descargando la actualización… 50 %');
              progresoVisto = 0.5;
              expect(progresoVisto, isNotNull);
              return const ResultadoActualizacion(
                EstadoActualizacion.instaladorAbierto,
                'Confirme la instalación en la ventana del sistema.',
              );
            },
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Actualizar ahora'), findsOneWidget);
      await tester.tap(find.text('Actualizar ahora'));
      await tester.pumpAndSettle();

      expect(llamadas, 1);
      expect(progresoVisto, 0.5);
      expect(find.text('Instalación en curso'), findsOneWidget);
      expect(find.textContaining('Confirme la instalación'), findsWidgets);
    });

    testWidgets('si falta el permiso de instalación, lo explica', (tester) async {
      tester.view.physicalSize = const Size(900, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TarjetaVersion(
            versionInstalada: '1.7.0+16',
            consultar: () async => _meta('1.8.0+17'),
            actualizar: (meta, onProgreso) async => const ResultadoActualizacion(
              EstadoActualizacion.requierePermiso,
              'Permita «instalar apps desconocidas» para GGTO Técnico y vuelva a pulsar.',
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Actualizar ahora'));
      await tester.pumpAndSettle();

      expect(find.text('No se pudo actualizar'), findsOneWidget);
      expect(find.textContaining('instalar apps desconocidas'), findsWidgets);
    });

    testWidgets('sin actualización publicada no aparece el botón de actualizar',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TarjetaVersion(
            versionInstalada: '1.8.0+17',
            consultar: () async => _meta('1.8.0+17'),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Tiene la última versión'), findsOneWidget);
      expect(find.text('Actualizar ahora'), findsNothing);
    });
  });

  group('D-107 · franja de actualización en la pantalla de casos', () {
    testWidgets('aparece cuando el servidor publica una versión más nueva',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              BannerActualizacion(
                consultar: () async => _meta('2.0.0+99'),
                actualizar: (meta, onProgreso) async => const ResultadoActualizacion(
                  EstadoActualizacion.instaladorAbierto,
                  'Confirme la instalación.',
                ),
              ),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Actualización 2.0.0+99 disponible'), findsOneWidget);
      expect(find.text('Actualizar'), findsOneWidget);
    });

    testWidgets('no aparece si la versión instalada es la última', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              BannerActualizacion(consultar: () async => _meta('1.0.0+1')),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('Actualización'), findsNothing);
      expect(find.text('Actualizar'), findsNothing);
    });

    testWidgets('«Actualizar» lanza la descarga y el instalador', (tester) async {
      var llamadas = 0;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              BannerActualizacion(
                consultar: () async => _meta('2.0.0+99'),
                actualizar: (meta, onProgreso) async {
                  llamadas++;
                  onProgreso?.call(1, 'Abriendo el instalador…');
                  return const ResultadoActualizacion(
                    EstadoActualizacion.instaladorAbierto,
                    'Confirme la instalación en la ventana del sistema.',
                  );
                },
              ),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Actualizar'));
      await tester.pumpAndSettle();

      expect(llamadas, 1);
      expect(find.textContaining('Confirme la instalación'), findsWidgets);
    });
  });

  group('D-108 · aviso cuando la descarga termina en segundo plano', () {
    test('descargar en segundo plano es un éxito, pero no abre el instalador', () {
      const resultado = ResultadoActualizacion(
        EstadoActualizacion.descargadaEnSegundoPlano,
        'Toque la notificación para instalar.',
      );
      expect(resultado.esExito, isTrue);
      expect(resultado.ok, isFalse, reason: 'la instalación aún no se abrió');
    });

    testWidgets('la tarjeta muestra «Actualización descargada» y ofrece instalar',
        (tester) async {
      tester.view.physicalSize = const Size(900, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TarjetaVersion(
            versionInstalada: '1.8.0+17',
            consultar: () async => _meta('2.0.0+99'),
            actualizar: (meta, onProgreso) async => const ResultadoActualizacion(
              EstadoActualizacion.descargadaEnSegundoPlano,
              'La actualización 1.9.0+18 ya está descargada: toque la notificación para instalarla.',
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Actualizar ahora'));
      await tester.pumpAndSettle();

      expect(find.text('Actualización descargada'), findsOneWidget);
      expect(find.text('Instalar actualización'), findsOneWidget);
      expect(find.textContaining('toque la notificación'), findsWidgets);
    });

    testWidgets('la franja cambia a «Instalar» tras la descarga en segundo plano',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              BannerActualizacion(
                consultar: () async => _meta('2.0.0+99'),
                actualizar: (meta, onProgreso) async => const ResultadoActualizacion(
                  EstadoActualizacion.descargadaEnSegundoPlano,
                  'La actualización 2.0.0+99 ya está descargada: toque la notificación.',
                ),
              ),
            ],
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Actualizar'));
      await tester.pumpAndSettle();

      expect(find.text('Instalar'), findsOneWidget);
      expect(find.textContaining('ya está descargada'), findsWidgets);
    });
  });
}