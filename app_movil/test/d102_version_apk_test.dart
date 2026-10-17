// D-102 · Chequeo de la última versión de la APK desde el panel de usuario.
//
// Cubre la regla pura (RT-27), la interpretación de `apk.json` y los cuatro
// estados de la tarjeta del panel.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/core/version_app.dart';
import 'package:ggto_tecnico/features/usuario/tarjeta_version.dart';
import 'package:ggto_tecnico/features/usuario/version_service.dart';

MetaApk _meta(String version, {String sha = 'abc123'}) => MetaApk(
      version: version,
      nombre: 'GGTO Técnico',
      ruta: '/apk/ggto-tecnico.apk',
      kb: 24049,
      sha256: sha,
      compiladoEn: DateTime.utc(2026, 10, 15, 22, 31),
      nota: 'APK de evaluación.',
    );

void main() {
  group('D-102 · interpretación de la versión', () {
    test('interpreta nombre y código', () {
      final v = VersionApp.parsear('1.4.0+13')!;
      expect(v.nombre, '1.4.0');
      expect(v.codigo, 13);
      expect(v.texto, '1.4.0+13');
    });

    test('acepta la «v» inicial y las versiones sin código', () {
      expect(VersionApp.parsear('v1.2.3+4')!.codigo, 4);
      final sinCodigo = VersionApp.parsear('1.2.3')!;
      expect(sinCodigo.codigo, 0);
      expect(sinCodigo.nombre, '1.2.3');
    });

    test('devuelve null con textos que no son versiones', () {
      for (final texto in ['', '   ', 'sin-version', 'v', 'abc+3', '1.4.0+']) {
        final v = VersionApp.parsear(texto);
        // «1.4.0+» sí tiene nombre válido: el código queda en 0.
        if (texto == '1.4.0+') {
          expect(v, isNotNull, reason: 'el nombre es válido aunque falte el código');
        } else {
          expect(v, isNull, reason: 'no debería interpretar «$texto»');
        }
      }
    });

    test('compara nombres componente a componente', () {
      expect(VersionApp.compararNombres('1.5.0', '1.4.9'), greaterThan(0));
      expect(VersionApp.compararNombres('1.4.0', '1.4.0'), 0);
      expect(VersionApp.compararNombres('1.4.0', '1.4.0.1'), lessThan(0));
    });
  });

  group('D-102 · regla de «hay actualización»', () {
    test('el código mayor anuncia actualización', () {
      final r = compararVersiones(instalada: '1.4.0+13', disponible: '1.4.0+14');
      expect(r.hayActualizacion, isTrue);
      expect(r.motivo, contains('compilación 14'));
    });

    test('el mismo código con el mismo nombre está al día', () {
      final r = compararVersiones(instalada: '1.4.0+13', disponible: '1.4.0+13');
      expect(r.hayActualizacion, isFalse);
    });

    test('una versión publicada más antigua no se ofrece como actualización', () {
      final r = compararVersiones(instalada: '1.5.0+14', disponible: '1.4.0+13');
      expect(r.hayActualizacion, isFalse);
    });

    test('sin códigos decide el nombre', () {
      expect(
        compararVersiones(instalada: '1.4.0', disponible: '1.5.0').hayActualizacion,
        isTrue,
      );
      expect(
        compararVersiones(instalada: '1.5.0', disponible: '1.4.0').hayActualizacion,
        isFalse,
      );
    });

    test('un texto ilegible no se anuncia como actualización', () {
      final r = compararVersiones(instalada: '1.4.0+13', disponible: 'sin-version');
      expect(r.hayActualizacion, isFalse);
      expect(r.motivo, contains('No se pudo interpretar'));
    });
  });

  group('D-102 · metadatos publicados', () {
    test('el origen sale de la URL de la API', () {
      expect(
        VersionService.origenDeApi('https://ggto-web-593453426217.europe-west1.run.app/api/v1'),
        'https://ggto-web-593453426217.europe-west1.run.app',
      );
      expect(
        VersionService.origenDeApi('https://ejemplo.test/api/v1/'),
        'https://ejemplo.test',
      );
    });

    test('las URL de metadatos y descarga se componen sobre el origen', () {
      const base = 'https://ejemplo.test/api/v1';
      expect(VersionService.urlMetadatos(base), 'https://ejemplo.test/apk/apk.json');
      expect(
        VersionService.urlDescarga(_meta('1.5.0+14'), base),
        'https://ejemplo.test/apk/ggto-tecnico.apk',
      );
    });

    test('interpreta el apk.json publicado por publicar_apk.py', () {
      final meta = MetaApk.desdeJson(const {
        'archivo': 'ggto-tecnico.apk',
        'ruta': '/apk/ggto-tecnico.apk',
        'nombre': 'GGTO Técnico',
        'version': '1.5.0+14',
        'bytes': 24625676,
        'kb': 24049,
        'sha256': '7120b5a0',
        'compilado_en': '2026-10-15T22:31:39.306710+00:00',
        'nota': 'APK de evaluación.',
      });
      expect(meta, isNotNull);
      expect(meta!.version, '1.5.0+14');
      expect(meta.tamanoLegible, '23.5 MB');
      expect(meta.fechaLegible, '15/10/2026');
    });

    test('sin versión no hay metadatos utilizables', () {
      expect(MetaApk.desdeJson(const {'nombre': 'GGTO'}), isNull);
    });
  });

  group('D-102 · tarjeta del panel de usuario', () {
    // Las pruebas fijan la versión instalada a propósito: así no se rompen cada
    // vez que se sube el `versionCode` de una entrega.
    testWidgets('avisa cuando el servidor publica una versión más nueva',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TarjetaVersion(
            versionInstalada: '1.4.0+13',
            consultar: () async => _meta('1.5.0+14'),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Hay una actualización disponible'), findsOneWidget);
      // D-107: la acción principal actualiza sin reinstalar; la descarga por el
      // navegador queda como alternativa.
      expect(find.text('Actualizar ahora'), findsOneWidget);
      expect(find.text('Descargar en el navegador'), findsOneWidget);
      expect(find.textContaining('1.5.0+14'), findsWidgets);
    });

    testWidgets('confirma cuando el dispositivo está al día', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TarjetaVersion(
            versionInstalada: '1.5.0+14',
            consultar: () async => _meta('1.5.0+14'),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Tiene la última versión'), findsOneWidget);
      expect(find.text('Actualizar ahora'), findsNothing);
      expect(find.text('Buscar actualización'), findsOneWidget);
    });

    testWidgets('informa cuando no se puede comprobar (sin conexión)',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TarjetaVersion(
            consultar: () async =>
                throw const VersionError('Sin conexión con el servidor: no se pudo comprobar la versión.'),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('No se pudo comprobar'), findsOneWidget);
      expect(find.textContaining('Sin conexión'), findsWidgets);
      expect(find.text('Buscar actualización'), findsOneWidget);
    });
  });
}
