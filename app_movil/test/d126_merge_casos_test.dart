// D-126 · H-09: la descarga no puede deshacer el trabajo pendiente del técnico.
//
// `mergearCasos` reemplazaba la fila local con el JSON del servidor. Si el técnico
// ya había marcado CONTACTADO (o cerrado) sin conexión, el servidor seguía
// enviando «NUEVO» y la descarga lo pisaba: el caso reaparecía como pendiente y se
// perdía `pendiente_sync`. La regla acordada —«lo pendiente manda»— vive en una
// función pura y aquí se fija su contrato.

import 'package:flutter_test/flutter_test.dart';

import 'package:ggto_tecnico/features/sync/merge_casos.dart';

Map<String, dynamic> servidor(String estado, {String direccion = 'CALLE 1'}) => {
      'id_caso': 42,
      'id_averia': 'AV-42',
      'estado_actual': estado,
      'direccion': direccion,
      'telefono': '04141112233',
    };

Map<String, dynamic> local(String estado, {bool pendienteSync = false}) => {
      'id_caso': 42,
      'id_averia': 'AV-42',
      'estado_actual': estado,
      'direccion': 'CALLE VIEJA',
      'pendiente_sync': pendienteSync,
    };

void main() {
  group('D-126 · fusión de la descarga con lo local', () {
    test('sin trabajo pendiente manda el servidor', () {
      final fusionado = fusionarCasoDescargado(
        entrante: servidor('NUEVO', direccion: 'CALLE NUEVA'),
        local: local('CONTACTADO'),
        tieneTrabajoPendiente: false,
      );
      expect(fusionado['estado_actual'], 'NUEVO');
      expect(fusionado['direccion'], 'CALLE NUEVA');
      expect(fusionado['pendiente_sync'], isFalse);
    });

    test('con trabajo pendiente se conserva el estado local y la marca', () {
      final fusionado = fusionarCasoDescargado(
        entrante: servidor('NUEVO', direccion: 'CALLE NUEVA'),
        local: local('CONTACTADO', pendienteSync: true),
        tieneTrabajoPendiente: true,
      );
      expect(fusionado['estado_actual'], 'CONTACTADO', reason: 'no puede volver a NUEVO');
      expect(fusionado['pendiente_sync'], isTrue);
      // El resto de campos sí se refresca con lo que manda el servidor.
      expect(fusionado['direccion'], 'CALLE NUEVA');
      expect(fusionado['telefono'], '04141112233');
    });

    test('un cierre pendiente tampoco se revierte', () {
      final fusionado = fusionarCasoDescargado(
        entrante: servidor('NUEVO'),
        local: local('CERRADO', pendienteSync: true),
        tieneTrabajoPendiente: true,
      );
      expect(fusionado['estado_actual'], 'CERRADO');
    });

    test('sin fila local se inserta la del servidor', () {
      final fusionado = fusionarCasoDescargado(
        entrante: servidor('NUEVO'),
        local: null,
        tieneTrabajoPendiente: true,
      );
      expect(fusionado['estado_actual'], 'NUEVO');
      expect(fusionado['pendiente_sync'], isFalse);
    });

    test('una fila local sin estado no inventa uno', () {
      final sinEstado = local('');
      final fusionado = fusionarCasoDescargado(
        entrante: servidor('ASIGNADO'),
        local: sinEstado,
        tieneTrabajoPendiente: true,
      );
      expect(fusionado['estado_actual'], 'ASIGNADO');
      expect(fusionado['pendiente_sync'], isTrue, reason: 'el trabajo sigue en la cola');
    });

    test('la función no muta los mapas de entrada', () {
      final entrante = servidor('NUEVO');
      final previo = local('CONTACTADO', pendienteSync: true);
      fusionarCasoDescargado(
        entrante: entrante,
        local: previo,
        tieneTrabajoPendiente: true,
      );
      expect(entrante['estado_actual'], 'NUEVO');
      expect(previo['estado_actual'], 'CONTACTADO');
    });
  });
}
