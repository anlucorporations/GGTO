import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/database.dart';
import '../evidencias/evidencia_service.dart';
import '../usuario/usuario_service.dart';

/// Resultado de la generación del ZIP de la jornada.
class ResultadoZipJornada {
  const ResultadoZipJornada({
    required this.archivo,
    required this.casos,
    required this.evidenciasIncluidas,
    required this.evidenciasFaltantes,
  });

  final File archivo;
  final int casos;
  final int evidenciasIncluidas;
  final int evidenciasFaltantes;

  String get resumen {
    final faltantes = evidenciasFaltantes > 0
        ? ' · $evidenciasFaltantes evidencia(s) no encontrada(s)'
        : '';
    return 'ZIP listo: $casos caso(s) y $evidenciasIncluidas evidencia(s)$faltantes.';
  }
}

/// Genera el **ZIP de la jornada** (apartado 4.3 de los requerimientos):
/// el despacho local modificado por el técnico y todas las evidencias.
///
/// El nombre es `central+cuadrilla+fecha` (se normalizan los separadores para
/// que sea un nombre de archivo válido). El contenido es:
///
/// - `despacho.csv` — una fila por caso con los campos operativos;
/// - `despacho.json` — el registro local completo (para trazabilidad);
/// - `evidencias/…` — las fotos que aún están en el dispositivo;
/// - `LEEME.txt` — resumen y conteos.
///
/// Se separa la lectura de la base (`generar`) de la construcción del archivo
/// (`crear`) para poder probar esta última sin emulador ni SQLite.
class ZipJornadaService {
  static const columnas = <String>[
    'id_caso',
    'id_averia',
    'estado_actual',
    'tipo_caso',
    'categoria',
    'nombre_cliente',
    'telefono',
    'contacto_cliente',
    'direccion',
    'sector_nombre',
    'olt',
    'slot',
    'puerto',
    'fat',
    'fecha_cita',
    'actualizado_en',
  ];

  /// Nombre `central+cuadrilla+fecha` del archivo.
  static String nombreArchivo({
    required String central,
    required String cuadrilla,
    required DateTime fecha,
  }) {
    String dos(int valor) => valor.toString().padLeft(2, '0');
    final marca = '${fecha.year}${dos(fecha.month)}${dos(fecha.day)}';
    final partes = [central, cuadrilla, marca]
        .map(_limpiar)
        .where((parte) => parte.isNotEmpty)
        .toList();
    if (partes.isEmpty) return 'jornada_$marca.zip';
    return '${partes.join('_')}.zip';
  }

  /// Genera el ZIP leyendo la base local y las evidencias del dispositivo.
  static Future<ResultadoZipJornada> generar() async {
    final casos = await DatabaseHelper.instance.leerCasos();
    final evidencias = await DatabaseHelper.instance.evidencias();
    final perfil = await UsuarioService.perfilLocal();
    final cuadrilla = await UsuarioService.cuadrillaLocal();

    // La central viene del caso (la APK la recibe en la descarga); si aún no
    // hay casos, se usa el id del perfil para no perder el nombre del archivo.
    final central = casos
        .map((c) => '${c['nombre_central'] ?? ''}'.trim())
        .firstWhere((nombre) => nombre.isNotEmpty, orElse: () => '');
    final centralFinal = central.isNotEmpty
        ? central
        : (perfil?.idCentral == null
            ? 'CENTRAL'
            : 'CENTRAL${perfil!.idCentral}');
    final cuadrillaFinal = (cuadrilla?.codigo ?? '').trim().isNotEmpty
        ? cuadrilla!.codigo!
        : ((cuadrilla?.nombre ?? '').trim().isNotEmpty
            ? cuadrilla!.nombre!
            : 'SIN_CUADRILLA');

    final documentos = await getApplicationDocumentsDirectory();
    final carpetaSalida = Directory(p.join(documentos.path, 'zip_jornada'));
    if (!await carpetaSalida.exists()) {
      await carpetaSalida.create(recursive: true);
    }
    return crear(
      carpetaDestino: carpetaSalida,
      carpetaEvidencias: await EvidenciaService.carpetaEvidencias(),
      casos: casos,
      evidencias: evidencias,
      central: centralFinal,
      cuadrilla: cuadrillaFinal,
      fecha: DateTime.now(),
    );
  }

  /// Construye el ZIP a partir de datos ya leídos (pruebas y reutilización).
  static Future<ResultadoZipJornada> crear({
    required Directory carpetaDestino,
    required Directory carpetaEvidencias,
    required List<Map<String, dynamic>> casos,
    required List<Map<String, dynamic>> evidencias,
    required String central,
    required String cuadrilla,
    required DateTime fecha,
  }) async {
    final archivoZip = Archive();
    final contenidoJson = const JsonEncoder.withIndent('  ').convert({
      'generado_en': fecha.toIso8601String(),
      'central': central,
      'cuadrilla': cuadrilla,
      'total_casos': casos.length,
      'casos': casos,
    });
    _agregarTexto(archivoZip, 'despacho.json', contenidoJson);
    _agregarTexto(archivoZip, 'despacho.csv', csv(casos));

    var incluidas = 0;
    var faltantes = 0;
    final nombresUsados = <String>{};
    for (final evidencia in evidencias) {
      final ruta = '${evidencia['ruta_archivo'] ?? ''}'.trim();
      if (ruta.isEmpty) {
        faltantes++;
        continue;
      }
      final archivo = File(
          p.isAbsolute(ruta) ? ruta : p.join(carpetaEvidencias.path, ruta));
      if (!await archivo.exists()) {
        faltantes++;
        continue;
      }
      final serial = '${evidencia['serial_imagen'] ?? ''}'.trim();
      final base = _limpiarArchivo(
          p.basename(serial.isNotEmpty ? serial : archivo.path));
      final nombre = _nombreUnico(base, nombresUsados);
      final bytes = await archivo.readAsBytes();
      archivoZip
          .addFile(ArchiveFile('evidencias/$nombre', bytes.length, bytes));
      incluidas++;
    }

    final resumen = StringBuffer()
      ..writeln('ZIP de la jornada — GGTO Técnico')
      ..writeln('Central: $central')
      ..writeln('Cuadrilla: $cuadrilla')
      ..writeln('Generado: ${fecha.toIso8601String()}')
      ..writeln('Casos: ${casos.length}')
      ..writeln('Evidencias incluidas: $incluidas')
      ..writeln('Evidencias no encontradas: $faltantes')
      ..writeln()
      ..writeln(
          'Contenido: despacho.csv, despacho.json y la carpeta evidencias/.');
    _agregarTexto(archivoZip, 'LEEME.txt', resumen.toString());

    final bytesZip = ZipEncoder().encode(archivoZip);
    if (bytesZip == null) {
      throw StateError('No se pudo codificar el ZIP de la jornada.');
    }
    final destino = File(p.join(
      carpetaDestino.path,
      nombreArchivo(central: central, cuadrilla: cuadrilla, fecha: fecha),
    ));
    await destino.parent.create(recursive: true);
    await destino.writeAsBytes(bytesZip, flush: true);
    return ResultadoZipJornada(
      archivo: destino,
      casos: casos.length,
      evidenciasIncluidas: incluidas,
      evidenciasFaltantes: faltantes,
    );
  }

  /// CSV con cabecera y una fila por caso. Escapa comillas y saltos de línea.
  static String csv(List<Map<String, dynamic>> casos) {
    final buffer = StringBuffer()..writeln(columnas.join(','));
    for (final caso in casos) {
      buffer.writeln(columnas.map((campo) => _csv(caso[campo])).join(','));
    }
    return buffer.toString();
  }

  static void _agregarTexto(Archive archivo, String nombre, String texto) {
    final bytes = utf8.encode(texto);
    archivo.addFile(ArchiveFile(nombre, bytes.length, bytes));
  }

  static String _csv(Object? valor) {
    final texto = valor == null ? '' : '$valor';
    if (!texto.contains(RegExp(r'[",\r\n]'))) return texto;
    return '"${texto.replaceAll('"', '""')}"';
  }

  static String _nombreUnico(String base, Set<String> usados) {
    final limpio = base.isEmpty ? 'evidencia' : base;
    if (usados.add(limpio)) return limpio;
    final punto = limpio.lastIndexOf('.');
    final raiz = punto > 0 ? limpio.substring(0, punto) : limpio;
    final extension = punto > 0 ? limpio.substring(punto) : '';
    var indice = 2;
    while (true) {
      final candidato = '${raiz}_$indice$extension';
      if (usados.add(candidato)) return candidato;
      indice++;
    }
  }

  static String _limpiar(String valor) =>
      valor.replaceAll(RegExp(r'[^A-Za-z0-9_\-]'), '_');

  /// Limpia el nombre pero conserva la extensión de la foto (`.jpg`).
  static String _limpiarArchivo(String valor) {
    final punto = valor.lastIndexOf('.');
    if (punto <= 0 || punto == valor.length - 1) return _limpiar(valor);
    final nombre = _limpiar(valor.substring(0, punto));
    final extension = _limpiar(valor.substring(punto + 1));
    return '$nombre.$extension';
  }
}
