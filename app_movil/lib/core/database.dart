import 'dart:convert';

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

/// Acceso a la base local (SQLite) de la aplicación.
///
/// Guarda: el universo de casos descargado (para operar **sin conexión**),
/// la cola de acciones pendientes de sincronizar y las evidencias capturadas.
class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  /// Versión del esquema local. Al cambiarla hay que ampliar `_upgradeDB`.
  static const int version = 2;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('ggto.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);
    return openDatabase(
      path,
      version: version,
      onCreate: _createDB,
      onUpgrade: _upgradeDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE caso_local (
        id TEXT PRIMARY KEY,
        id_caso INTEGER,
        estado TEXT,
        datos_json TEXT NOT NULL,
        actualizado_en INTEGER NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE accion_pendiente (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        metodo TEXT NOT NULL,
        payload TEXT NOT NULL,
        fecha INTEGER NOT NULL,
        estado TEXT NOT NULL DEFAULT 'PENDIENTE',
        intentos INTEGER NOT NULL DEFAULT 0,
        proximo_intento INTEGER NOT NULL DEFAULT 0,
        ultimo_error TEXT,
        actualizado_en INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute('''
      CREATE TABLE evidencia_local (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_caso TEXT NOT NULL,
        id_averia TEXT,
        ruta_archivo TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'DEMO',
        serial_imagen TEXT,
        latitud REAL,
        longitud REAL,
        timestamp TEXT NOT NULL,
        subida INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute(
      'CREATE INDEX ix_accion_pendiente_estado ON accion_pendiente (estado, proximo_intento)',
    );
    await db.execute('CREATE INDEX ix_evidencia_caso ON evidencia_local (id_caso)');
  }

  /// Migración no destructiva: **no** borra evidencias ni la cola pendiente.
  Future<void> _upgradeDB(Database db, int anterior, int nueva) async {
    if (anterior < 2) {
      await db.execute('ALTER TABLE accion_pendiente ADD COLUMN estado TEXT NOT NULL DEFAULT \'PENDIENTE\'');
      await db.execute('ALTER TABLE accion_pendiente ADD COLUMN intentos INTEGER NOT NULL DEFAULT 0');
      await db.execute('ALTER TABLE accion_pendiente ADD COLUMN proximo_intento INTEGER NOT NULL DEFAULT 0');
      await db.execute('ALTER TABLE accion_pendiente ADD COLUMN ultimo_error TEXT');
      await db.execute('ALTER TABLE accion_pendiente ADD COLUMN actualizado_en INTEGER NOT NULL DEFAULT 0');
      await db.execute('ALTER TABLE evidencia_local ADD COLUMN id_averia TEXT');
      await db.execute('ALTER TABLE evidencia_local ADD COLUMN tipo TEXT NOT NULL DEFAULT \'DEMO\'');
      await db.execute('ALTER TABLE evidencia_local ADD COLUMN serial_imagen TEXT');
      await db.execute('ALTER TABLE evidencia_local ADD COLUMN subida INTEGER NOT NULL DEFAULT 0');
      await db.execute('ALTER TABLE caso_local ADD COLUMN id_caso INTEGER');
      await db.execute('ALTER TABLE caso_local ADD COLUMN estado TEXT');
      await db.execute('ALTER TABLE caso_local ADD COLUMN actualizado_en INTEGER NOT NULL DEFAULT 0');
      await db.execute(
        'CREATE INDEX IF NOT EXISTS ix_accion_pendiente_estado ON accion_pendiente (estado, proximo_intento)',
      );
      await db.execute('CREATE INDEX IF NOT EXISTS ix_evidencia_caso ON evidencia_local (id_caso)');
    }
  }

  // ------------------------------------------------------------------------- #
  // Caché de casos (lectura sin conexión)
  // ------------------------------------------------------------------------- //

  /// Reemplaza la caché local con el universo de casos descargado.
  Future<void> guardarCasos(List<dynamic> casos) async {
    final db = await database;
    final ahora = _ahora();
    await db.transaction((txn) async {
      for (final caso in casos) {
        if (caso is! Map) continue;
        final idAveria = '${caso['id_averia'] ?? ''}';
        if (idAveria.isEmpty) continue;
        await txn.insert(
          'caso_local',
          {
            'id': idAveria,
            'id_caso': caso['id_caso'],
            'estado': '${caso['estado_actual'] ?? ''}',
            'datos_json': jsonEncode(caso),
            'actualizado_en': ahora,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }

  /// DESCARGA diferencial (D-73): inserta/actualiza solo los casos recibidos,
  /// sin borrar la caché existente. Devuelve `(nuevos, actualizados)`.
  Future<(int nuevos, int actualizados)> mergearCasos(List<dynamic> casos) async {
    final db = await database;
    final ahora = _ahora();
    var nuevos = 0;
    var actualizados = 0;
    await db.transaction((txn) async {
      for (final caso in casos) {
        if (caso is! Map) continue;
        final idAveria = '${caso['id_averia'] ?? ''}';
        if (idAveria.isEmpty) continue;
        final existentes = await txn.query(
          'caso_local',
          columns: ['id'],
          where: 'id = ?',
          whereArgs: [idAveria],
          limit: 1,
        );
        await txn.insert(
          'caso_local',
          {
            'id': idAveria,
            'id_caso': caso['id_caso'],
            'estado': '${caso['estado_actual'] ?? ''}',
            'datos_json': jsonEncode(caso),
            'actualizado_en': ahora,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
        if (existentes.isEmpty) {
          nuevos++;
        } else {
          actualizados++;
        }
      }
    });
    return (nuevos, actualizados);
  }

  /// IDs de casos ya presentes en la caché local, para enviarlos como
  /// `ids_conocidos` en la próxima DESCARGA diferencial.
  Future<List<int>> idsCasosConocidos() async {
    final db = await database;
    final filas = await db.rawQuery('SELECT id_caso FROM caso_local WHERE id_caso IS NOT NULL');
    return filas.map((f) => f['id_caso'] as int).toList();
  }

  /// Lee la caché de casos; devuelve una lista vacía si aún no hay datos.
  Future<List<Map<String, dynamic>>> leerCasos({String? consulta}) async {
    final db = await database;
    final filas = await db.query('caso_local', orderBy: 'actualizado_en DESC, id ASC');
    final casos = <Map<String, dynamic>>[];
    for (final fila in filas) {
      try {
        final datos = jsonDecode('${fila['datos_json']}');
        if (datos is Map) casos.add(Map<String, dynamic>.from(datos));
      } catch (_) {
        // Registro corrupto: se ignora.
      }
    }
    if (consulta == null || consulta.trim().isEmpty) return casos;

    final aguja = consulta.trim().toLowerCase();
    return casos.where((caso) {
      final campos = [caso['id_averia'], caso['telefono'], caso['nombre_cliente'], caso['direccion']];
      return campos.any((valor) => '${valor ?? ''}'.toLowerCase().contains(aguja));
    }).toList();
  }

  /// Momento de la última descarga de casos (o `null` si nunca se descargó).
  Future<DateTime?> ultimaDescarga() async {
    final db = await database;
    final filas = await db.rawQuery('SELECT MAX(actualizado_en) AS ultimo FROM caso_local');
    final valor = filas.isNotEmpty ? filas.first['ultimo'] : null;
    if (valor is int && valor > 0) {
      return DateTime.fromMillisecondsSinceEpoch(valor);
    }
    return null;
  }

  /// Actualiza el estado de un caso en la caché local (respuesta del servidor).
  Future<void> actualizarCasoLocal(Map<String, dynamic> caso) async {
    final idAveria = '${caso['id_averia'] ?? ''}';
    if (idAveria.isEmpty) return;
    final db = await database;
    await db.insert(
      'caso_local',
      {
        'id': idAveria,
        'id_caso': caso['id_caso'],
        'estado': '${caso['estado_actual'] ?? ''}',
        'datos_json': jsonEncode(caso),
        'actualizado_en': _ahora(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // ------------------------------------------------------------------------- #
  // Cola de acciones pendientes (outbox)
  // ------------------------------------------------------------------------- //

  /// Encola una acción para sincronizarla después.
  Future<int> encolarAccion({
    required String tipo,
    required String endpoint,
    required String metodo,
    required Map<String, dynamic> payload,
  }) async {
    final db = await database;
    final ahora = _ahora();
    return db.insert('accion_pendiente', {
      'tipo': tipo,
      'endpoint': endpoint,
      'metodo': metodo,
      'payload': jsonEncode(payload),
      'fecha': ahora,
      'estado': 'PENDIENTE',
      'intentos': 0,
      'proximo_intento': 0,
      'actualizado_en': ahora,
    });
  }

  /// Acciones listas para intentar (pendientes o reintentables cuyo momento llegó).
  Future<List<Map<String, dynamic>>> accionesPendientes({int limite = 50}) async {
    final db = await database;
    return db.query(
      'accion_pendiente',
      where: "estado IN ('PENDIENTE','REINTENTO') AND proximo_intento <= ?",
      whereArgs: [_ahora()],
      orderBy: 'id ASC',
      limit: limite,
    );
  }

  /// Todas las acciones de la cola, para mostrarlas en la pantalla DISPOSITIVO.
  Future<List<Map<String, dynamic>>> todasLasAcciones({int limite = 200}) async {
    final db = await database;
    return db.query('accion_pendiente', orderBy: 'id DESC', limit: limite);
  }

  Future<void> marcarAccionEnviada(int id) async {
    final db = await database;
    await db.delete('accion_pendiente', where: 'id = ?', whereArgs: [id]);
  }

  /// Marca un reintento con su próximo momento (backoff).
  Future<void> marcarAccionReintento(int id, int intentos, int proximoIntento, String error) async {
    final db = await database;
    await db.update(
      'accion_pendiente',
      {
        'estado': 'REINTENTO',
        'intentos': intentos,
        'proximo_intento': proximoIntento,
        'ultimo_error': error,
        'actualizado_en': _ahora(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Marca la acción como fallida de forma definitiva (no se reintenta sola).
  Future<void> marcarAccionError(int id, int intentos, String error) async {
    final db = await database;
    await db.update(
      'accion_pendiente',
      {
        'estado': 'ERROR',
        'intentos': intentos,
        'ultimo_error': error,
        'actualizado_en': _ahora(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Devuelve una acción con error a la cola para reintentarla.
  Future<void> reintentarAccion(int id) async {
    final db = await database;
    await db.update(
      'accion_pendiente',
      {
        'estado': 'PENDIENTE',
        'intentos': 0,
        'proximo_intento': 0,
        'actualizado_en': _ahora(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> borrarAccion(int id) async {
    final db = await database;
    await db.delete('accion_pendiente', where: 'id = ?', whereArgs: [id]);
  }

  /// Conteo de acciones por estado: `{PENDIENTE, REINTENTO, ERROR, TOTAL}`.
  Future<Map<String, int>> resumenCola() async {
    final db = await database;
    final filas = await db.rawQuery(
      'SELECT estado, COUNT(*) AS total FROM accion_pendiente GROUP BY estado',
    );
    final resumen = {'PENDIENTE': 0, 'REINTENTO': 0, 'ERROR': 0, 'TOTAL': 0};
    for (final fila in filas) {
      final estado = '${fila['estado']}';
      final total = (fila['total'] as int?) ?? 0;
      resumen[estado] = total;
      resumen['TOTAL'] = (resumen['TOTAL'] ?? 0) + total;
    }
    return resumen;
  }

  // ------------------------------------------------------------------------- #
  // Evidencias
  // ------------------------------------------------------------------------- #

  Future<int> guardarEvidencia({
    required String idCaso,
    String? idAveria,
    required String rutaArchivo,
    required String tipo,
    required String serialImagen,
    double? latitud,
    double? longitud,
    required DateTime momento,
  }) async {
    final db = await database;
    return db.insert('evidencia_local', {
      'id_caso': idCaso,
      'id_averia': idAveria,
      'ruta_archivo': rutaArchivo,
      'tipo': tipo,
      'serial_imagen': serialImagen,
      'latitud': latitud,
      'longitud': longitud,
      'timestamp': momento.toIso8601String(),
      'subida': 0,
    });
  }

  /// Evidencias de una jornada (desde `desde`), más recientes primero.
  Future<List<Map<String, dynamic>>> evidencias({DateTime? desde, String? idCaso}) async {
    final db = await database;
    final condiciones = <String>[];
    final argumentos = <Object?>[];
    if (desde != null) {
      condiciones.add('timestamp >= ?');
      argumentos.add(desde.toIso8601String());
    }
    if (idCaso != null) {
      condiciones.add('id_caso = ?');
      argumentos.add(idCaso);
    }
    return db.query(
      'evidencia_local',
      where: condiciones.isEmpty ? null : condiciones.join(' AND '),
      whereArgs: argumentos.isEmpty ? null : argumentos,
      orderBy: 'id ASC',
    );
  }

  Future<int> contarEvidencias({DateTime? desde}) async {
    final lista = await evidencias(desde: desde);
    return lista.length;
  }

  Future<void> marcarEvidenciaSubida(int id) async {
    final db = await database;
    await db.update('evidencia_local', {'subida': 1}, where: 'id = ?', whereArgs: [id]);
  }

  static int _ahora() => DateTime.now().millisecondsSinceEpoch;
}
