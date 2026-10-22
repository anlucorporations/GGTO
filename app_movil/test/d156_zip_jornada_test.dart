// D-156 · ZIP de la jornada: nombre, despacho y evidencias.
//
// Se prueba la construcción pura del archivo (sin SQLite ni path_provider) para
// que la entrega a CANTV no dependa de un emulador.

import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/features/sync/zip_jornada_service.dart';
import 'package:path/path.dart' as p;

void main() {
  test('el nombre es central + cuadrilla + fecha y es un nombre válido', () {
    final nombre = ZipJornadaService.nombreArchivo(
      central: 'Central Francisco Salias',
      cuadrilla: 'TC-01',
      fecha: DateTime(2026, 10, 22),
    );
    expect(nombre, 'Central_Francisco_Salias_TC-01_20261022.zip');
    expect(nombre, isNot(contains('/')));
    expect(nombre, isNot(contains(' ')));
  });

  test('genera despacho.csv/json y todas las evidencias disponibles', () async {
    final raiz = await Directory.systemTemp.createTemp('ggto_zip_');
    addTearDown(() => raiz.delete(recursive: true));
    final evidencias = Directory(p.join(raiz.path, 'evidencias'));
    await evidencias.create(recursive: true);
    final foto = File(p.join(evidencias.path, 'TST-1.jpg'));
    await foto.writeAsBytes([1, 2, 3, 4]);

    final resultado = await ZipJornadaService.crear(
      carpetaDestino: raiz,
      carpetaEvidencias: evidencias,
      casos: [
        {
          'id_caso': 7,
          'id_averia': 'TST-1',
          'estado_actual': 'CERRADO',
          'nombre_cliente': 'CLIENTE, "A"',
          'direccion': 'CALLE 1',
          'sector_nombre': 'ALFA',
        },
      ],
      evidencias: [
        {
          'serial_imagen': 'TST-1.jpg',
          'ruta_archivo': foto.path,
        },
        {
          'serial_imagen': 'TST-2.jpg',
          'ruta_archivo': p.join(evidencias.path, 'no-existe.jpg'),
        },
      ],
      central: 'Central Uno',
      cuadrilla: 'TC-01',
      fecha: DateTime(2026, 10, 22, 18, 30),
    );

    expect(resultado.casos, 1);
    expect(resultado.evidenciasIncluidas, 1);
    expect(resultado.evidenciasFaltantes, 1);
    expect(resultado.archivo.existsSync(), isTrue);
    expect(
        p.basename(resultado.archivo.path), 'Central_Uno_TC-01_20261022.zip');

    final archivo =
        ZipDecoder().decodeBytes(await resultado.archivo.readAsBytes());
    final nombres = archivo.files.map((f) => f.name).toList();
    expect(
        nombres,
        containsAll(<String>[
          'despacho.csv',
          'despacho.json',
          'LEEME.txt',
          'evidencias/TST-1.jpg',
        ]));

    ArchiveFile buscar(String nombre) =>
        archivo.files.firstWhere((f) => f.name == nombre);
    final csv = utf8.decode(buscar('despacho.csv').content as List<int>);
    expect(csv, contains('id_caso,id_averia,estado_actual'));
    expect(csv, contains('7,TST-1,CERRADO'));
    expect(csv, contains('"CLIENTE, ""A"""'));
    final json =
        jsonDecode(utf8.decode(buscar('despacho.json').content as List<int>));
    expect(json['total_casos'], 1);
    expect((json['casos'] as List).first['id_averia'], 'TST-1');
  });

  test('no duplica nombres de evidencias con el mismo serial', () async {
    final raiz = await Directory.systemTemp.createTemp('ggto_zip_dup_');
    addTearDown(() => raiz.delete(recursive: true));
    final evidencias = Directory(p.join(raiz.path, 'evidencias'));
    await evidencias.create(recursive: true);
    final foto = File(p.join(evidencias.path, 'foto.jpg'));
    await foto.writeAsBytes([9, 8, 7]);

    final resultado = await ZipJornadaService.crear(
      carpetaDestino: raiz,
      carpetaEvidencias: evidencias,
      casos: const [],
      evidencias: [
        {'serial_imagen': 'foto.jpg', 'ruta_archivo': foto.path},
        {'serial_imagen': 'foto.jpg', 'ruta_archivo': foto.path},
      ],
      central: 'C',
      cuadrilla: 'Q',
      fecha: DateTime(2026, 1, 2),
    );

    final archivo =
        ZipDecoder().decodeBytes(await resultado.archivo.readAsBytes());
    final nombres = archivo.files.map((f) => f.name).toList();
    expect(nombres.where((n) => n.startsWith('evidencias/foto')), hasLength(2));
    expect(resultado.evidenciasIncluidas, 2);
  });
}
