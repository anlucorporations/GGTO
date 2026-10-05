// La versión que muestra la pantalla de acceso debe ser la real del paquete.
//
// `AppConstants.version` es una constante de Dart, así que no se entera de los
// cambios de `pubspec.yaml`: sin esta prueba, la app podía anunciar «1.0.0+1»
// mientras el APK entregado era el «1.0.0+2» (defecto detectado el 2026-10-02).
// Se ejecuta con `flutter test`; no necesita dispositivo ni red.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/core/constants.dart';

/// Lee `version:` del `pubspec.yaml` del paquete (el cwd de `flutter test`).
String versionDelPubspec() {
  final archivo = File('pubspec.yaml');
  expect(archivo.existsSync(), isTrue,
      reason: 'no se encontró pubspec.yaml; ejecuta la prueba desde app_movil/');
  for (final linea in archivo.readAsLinesSync()) {
    final limpia = linea.trim();
    if (limpia.startsWith('version:')) {
      return limpia.substring('version:'.length).trim();
    }
  }
  fail('pubspec.yaml no declara «version:»');
}

void main() {
  test('la versión visible coincide con la de pubspec.yaml', () {
    expect(AppConstants.version, versionDelPubspec(),
        reason: 'actualiza AppConstants.version al subir el versionCode de entrega');
  });

  test('la versión visible tiene el formato nombre+versionCode', () {
    expect(AppConstants.version, matches(RegExp(r'^\d+\.\d+\.\d+\+\d+$')));
  });
}
