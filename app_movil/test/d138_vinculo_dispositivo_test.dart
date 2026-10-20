// D-138 · H-21: el dispositivo queda vinculado al primer técnico que entra.
//
// La caché y la cola offline son del dispositivo: sobrevivían al cierre de sesión
// y el siguiente técnico veía los casos del anterior (con su PII) y podía enviar
// su trabajo. Decisión del usuario: solo el primero puede acceder; para entregar
// el teléfono hay que hacer el restablecimiento completo (que borra el vínculo).

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/core/vinculo_dispositivo.dart';

void main() {
  group('D-138 · vínculo del dispositivo', () {
    test('sin vínculo previo, el primero que entra puede', () {
      expect(vinculoPermite(vinculado: null, p00: 'TESTTEC'), isTrue);
      expect(vinculoPermite(vinculado: '', p00: 'TESTTEC'), isTrue);
      expect(vinculoPermite(vinculado: '   ', p00: 'TESTTEC'), isTrue);
    });

    test('el mismo técnico (aunque cambie el caso) puede volver a entrar', () {
      expect(vinculoPermite(vinculado: 'testtec', p00: 'TESTTEC'), isTrue);
      expect(vinculoPermite(vinculado: 'TESTTEC', p00: ' testtec '), isTrue);
    });

    test('otro técnico queda bloqueado', () {
      expect(vinculoPermite(vinculado: 'TESTTEC', p00: 'TESTADM'), isFalse);
      expect(vinculoPermite(vinculado: 'TESTADM', p00: 'TESTTEC'), isFalse);
    });

    test('el mensaje explica qué hacer para entregar el teléfono', () {
      expect(mensajeDispositivoVinculado, contains('vinculado a otro usuario'));
      expect(mensajeDispositivoVinculado.toLowerCase(), contains('restablecimiento'));
    });
  });
}
