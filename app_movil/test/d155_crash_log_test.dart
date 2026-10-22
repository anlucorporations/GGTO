import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/core/constants.dart';
import 'package:ggto_tecnico/core/crash_log.dart';

void main() {
  test('sanea token, P00, correo y teléfono antes de escribir', () {
    final limpio = CrashLog.sanitizar(
      'Authorization: Bearer abc.def.ghi p00=TESTTEC '
      'correo@cantv.com.ve telefono 04141234567 token=secreto',
    );

    expect(limpio, isNot(contains('abc.def.ghi')));
    expect(limpio, isNot(contains('TESTTEC')));
    expect(limpio, isNot(contains('correo@cantv.com.ve')));
    expect(limpio, isNot(contains('04141234567')));
    expect(limpio, isNot(contains('secreto')));
    expect(limpio, contains('Authorization: ***'));
    expect(limpio, contains('p00=***'));
  });

  test('rota el archivo al superar el tamaño máximo y conserva el anterior',
      () async {
    final dir = await Directory.systemTemp.createTemp('ggto_crash_');
    addTearDown(() async {
      if (await dir.exists()) await dir.delete(recursive: true);
    });

    await CrashLog.iniciar(directorio: dir, enganchar: false);

    final trozo = 'x' * 15000;
    for (var i = 0; i < 20; i++) {
      await CrashLog.registrar('fallo $i $trozo', StackTrace.empty,
          origen: 'prueba');
    }
    await CrashLog.registrar('segundo fallo', StackTrace.empty,
        origen: 'prueba');

    final base = File('${dir.path}/logs/ggto_tecnico.log');
    final rotado = File('${dir.path}/logs/ggto_tecnico.log.1');
    expect(await base.exists(), isTrue);
    expect(await rotado.exists(), isTrue);

    final actual = await base.readAsString();
    expect(actual, contains('segundo fallo'));
    expect(actual, contains('v${AppConstants.version}'));

    final anterior = await rotado.readAsString();
    expect(anterior, contains('prueba'));
    expect(anterior.length, greaterThan(0));
  });
}
