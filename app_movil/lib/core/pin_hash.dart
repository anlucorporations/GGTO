/// Derivación del verificador del PIN de acceso sin conexión (D-100).
///
/// El acceso sin red no puede preguntar al servidor, así que la comprobación se
/// hace en el dispositivo. Para no guardar **nunca** el PIN en claro se usa
/// **PBKDF2-HMAC-SHA256** (RFC 8018) con sal aleatoria por ficha.
///
/// Se implementa sobre `package:crypto` en vez de añadir un paquete con código
/// nativo: la APK no gana binarios y la primitiva queda verificada contra los
/// vectores de prueba del estándar en `test/d100_credencial_local_test.dart`.
///
/// Advertencia de diseño: un PIN de 6 dígitos tiene 10⁶ combinaciones, así que
/// el PBKDF2 **no** es la barrera principal —lo es el almacén cifrado del
/// sistema (Keystore de Android) y el límite de intentos—, sino una segunda
/// línea para que un volcado del almacén no revele el PIN.
library;

import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

/// Longitud de la sal aleatoria, en bytes.
const int longitudSal = 16;

/// Longitud del verificador derivado, en bytes.
const int longitudVerificador = 32;

/// Iteraciones por defecto. Unas 20 000 mantienen la comprobación por debajo de
/// ~0,3 s en un teléfono de gama media y encarecen notablemente la fuerza bruta.
const int iteracionesPinPorDefecto = 20000;

/// Longitud del resumen de SHA-256, en bytes.
const int _longitudBloque = 32;

/// PBKDF2-HMAC-SHA256 (RFC 8018, sección 5.2).
///
/// Devuelve `longitud` bytes derivados de `contrasena` y `sal`.
Uint8List pbkdf2({
  required String contrasena,
  required List<int> sal,
  required int iteraciones,
  int longitud = longitudVerificador,
}) {
  if (iteraciones < 1) {
    throw ArgumentError.value(iteraciones, 'iteraciones', 'debe ser >= 1');
  }
  if (longitud < 1) {
    throw ArgumentError.value(longitud, 'longitud', 'debe ser >= 1');
  }

  final hmac = Hmac(sha256, utf8.encode(contrasena));
  final bloques = (longitud + _longitudBloque - 1) ~/ _longitudBloque;
  final salida = BytesBuilder();

  for (var i = 1; i <= bloques; i++) {
    // U1 = HMAC(P, S || INT_32_BE(i))
    final entrada = BytesBuilder()
      ..add(sal)
      ..add(<int>[
        (i >> 24) & 0xff,
        (i >> 16) & 0xff,
        (i >> 8) & 0xff,
        i & 0xff,
      ]);
    var u = Uint8List.fromList(hmac.convert(entrada.toBytes()).bytes);
    final acumulado = Uint8List.fromList(u);
    for (var j = 2; j <= iteraciones; j++) {
      u = Uint8List.fromList(hmac.convert(u).bytes);
      for (var k = 0; k < acumulado.length; k++) {
        acumulado[k] ^= u[k];
      }
    }
    salida.add(acumulado);
  }

  return Uint8List.fromList(salida.toBytes().sublist(0, longitud));
}

/// Genera una sal aleatoria criptográficamente segura, en base64.
String generarSal() {
  final aleatorio = Random.secure();
  return base64Encode(List<int>.generate(longitudSal, (_) => aleatorio.nextInt(256)));
}

/// Deriva el verificador de un PIN con su sal, en base64.
String derivarPin(
  String pin,
  String sal, {
  int iteraciones = iteracionesPinPorDefecto,
}) {
  final bytes = pbkdf2(
    contrasena: pin,
    sal: base64Decode(sal),
    iteraciones: iteraciones,
    longitud: longitudVerificador,
  );
  return base64Encode(bytes);
}

/// Compara dos cadenas en **tiempo constante** para no filtrar información por
/// el tiempo de respuesta. Recorre siempre la misma longitud.
bool compararEnTiempoConstante(String a, String b) {
  final bytesA = utf8.encode(a);
  final bytesB = utf8.encode(b);
  var diferencia = bytesA.length ^ bytesB.length;
  final maximo = bytesA.length > bytesB.length ? bytesA.length : bytesB.length;
  for (var i = 0; i < maximo; i++) {
    final x = i < bytesA.length ? bytesA[i] : 0;
    final y = i < bytesB.length ? bytesB[i] : 0;
    diferencia |= x ^ y;
  }
  return diferencia == 0;
}
