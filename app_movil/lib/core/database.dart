import 'dart:convert';
import 'dart:math';

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
  static const int version = 4;

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
    // D-81: metadatos de la app (identificador de dispositivo, último checklist).
    await db.execute('''
      CREATE TABLE app_meta (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      )
    ''');
    // D-86: bandeja local de mensajes (lectura sin conexión y «leído» pegajoso).
    await db.execute('''
      CREATE TABLE mensaje_local (
        id_mensaje INTEGER PRIMARY KEY,
        tipo TEXT NOT NULL DEFAULT 'TEXTO',
        cuerpo TEXT NOT NULL DEFAULT '',
        leido INTEGER NOT NULL DEFAULT 0,
        creado_en TEXT,
        datos_json TEXT NOT NULL
      )
    ''');
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
    if (anterior < 3) {
      // D-81: tabla de metadatos (identificador de dispositivo, último checklist).
      await db.execute('''
        CREATE TABLE IF NOT EXISTS app_meta (
          clave TEXT PRIMARY KEY,
          valor TEXT NOT NULL
        )
      ''');
    }
    if (anterior < 4) {
      // D-86: bandeja local de mensajes.
      await db.execute('''
        CREATE TABLE IF NOT EXISTS mensaje_local (
          id_mensaje INTEGER PRIMARY KEY,
          tipo TEXT NOT NULL DEFAULT 'TEXTO',
          cuerpo TEXT NOT NULL DEFAULT '',
          leido INTEGER NOT NULL DEFAULT 0,
          creado_en TEXT,
          datos_json TEXT NOT NULL
        )
      ''');
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

  /// Aplica un cambio **local** sobre el caso guardado, fusionándolo (D-85).
  ///
  /// A diferencia de `actualizarCasoLocal` —que reemplaza la fila con la
  /// respuesta completa del servidor—, aquí se **fusiona** sobre el `datos_json`
  /// existente para no perder campos, y **no** se toca `actualizado_en` (esa
  /// marca significa «cuándo llegó el contenido del servidor» y es la referencia
  /// del diferencial). `pendienteSync` deja el distintivo de la tarjeta.
  Future<void> aplicarCambioLocal(
    String idAveria, {
    String? estado,
    bool? pendienteSync,
    Map<String, dynamic>? extra,
  }) async {
    if (idAveria.isEmpty) return;
    final db = await database;
    final filas = await db.query(
      'caso_local',
      where: 'id = ?',
      whereArgs: [idAveria],
      limit: 1,
    );
    if (filas.isEmpty) return;
    final fila = filas.first;
    Map<String, dynamic> datos;
    try {
      final decodificado = jsonDecode('${fila['datos_json']}');
      datos = decodificado is Map
          ? Map<String, dynamic>.from(decodificado)
          : <String, dynamic>{};
    } catch (_) {
      datos = <String, dynamic>{};
    }
    if (estado != null && estado.isNotEmpty) datos['estado_actual'] = estado;
    if (pendienteSync != null) datos['pendiente_sync'] = pendienteSync;
    if (extra != null) datos.addAll(extra);
    await db.update(
      'caso_local',
      {
        'id_caso': datos['id_caso'] ?? fila['id_caso'],
        'estado': '${datos['estado_actual'] ?? fila['estado'] ?? ''}',
        'datos_json': jsonEncode(datos),
      },
      where: 'id = ?',
      whereArgs: [idAveria],
    );
  }

  // ------------------------------------------------------------------------- #
  /// Quita el distintivo «pendiente de sincronizar» del caso indicado (D-85).
  ///
  /// Se busca por `id_caso` porque la cola identifica el caso en el endpoint
  /// (`/casos/{id}/estado`), no por el `id_averia` que usa la caché.
  Future<void> limpiarPendienteSync(int idCaso) async {
    final db = await database;
    final filas = await db.query(
      'caso_local',
      columns: ['id'],
      where: 'id_caso = ?',
      whereArgs: [idCaso],
      limit: 1,
    );
    if (filas.isEmpty) return;
    await aplicarCambioLocal('${filas.first['id']}', pendienteSync: false);
  }

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

  /// Cuántas imágenes hay guardadas para el caso (D-88 · requisito 3.2bis).
  ///
  /// En `evidencia_local.id_caso` se guarda indistintamente el `id_averia` o el
  /// `id_caso`, según el origen de la captura: se cuentan ambos.
  Future<int> contarEvidenciasDeCaso(String idAveria, {int? idCaso}) async {
    final db = await database;
    var where = '(id_caso = ? OR id_averia = ?)';
    final valores = <Object?>[idAveria, idAveria];
    if (idCaso != null) {
      where += ' OR id_caso = ?';
      valores.add('$idCaso');
    }
    final filas = await db.rawQuery(
      'SELECT COUNT(*) AS total FROM evidencia_local WHERE $where',
      valores,
    );
    final valor = filas.isNotEmpty ? filas.first['total'] : 0;
    return valor is int ? valor : 0;
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

  /// Borra una evidencia local (foto descartada antes de enviarla).
  Future<void> borrarEvidencia(int id) async {
    final db = await database;
    await db.delete('evidencia_local', where: 'id = ?', whereArgs: [id]);
  }

  // ------------------------------------------------------------------------- #
  // ------------------------------------------------------------------------- #
  // Mensajería local (D-86): bandeja guardada y «leído» pegajoso
  // ------------------------------------------------------------------------- #

  /// Guarda (o actualiza) los mensajes recibidos en la bandeja local.
  ///
  /// El «leído» es **pegajoso**: si el técnico ya lo marcó en el teléfono y aún
  /// no pudo avisar al servidor (o el sondeo lo vuelve a traer), no se revierte.
  Future<void> guardarMensajes(List<dynamic> mensajes) async {
    final db = await database;
    await db.transaction((txn) async {
      for (final m in mensajes) {
        if (m is! Map) continue;
        final id = m['id_mensaje'];
        if (id is! int) continue;
        final previos = await txn.query(
          'mensaje_local',
          columns: ['leido'],
          where: 'id_mensaje = ?',
          whereArgs: [id],
          limit: 1,
        );
        final yaLeido = previos.isNotEmpty && previos.first['leido'] == 1;
        final datos = Map<String, dynamic>.from(m);
        final leido = datos['leido'] == true || yaLeido;
        datos['leido'] = leido;
        await txn.insert(
          'mensaje_local',
          {
            'id_mensaje': id,
            'tipo': '${datos['tipo'] ?? 'TEXTO'}',
            'cuerpo': '${datos['cuerpo'] ?? ''}',
            'leido': leido ? 1 : 0,
            'creado_en': '${datos['creado_en'] ?? ''}',
            'datos_json': jsonEncode(datos),
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }

  /// Lee la bandeja guardada en orden cronológico (el más antiguo primero).
  Future<List<Map<String, dynamic>>> leerMensajes({int? limite}) async {
    final db = await database;
    final filas = await db.query('mensaje_local', orderBy: 'id_mensaje ASC');
    final lista = <Map<String, dynamic>>[];
    for (final fila in filas) {
      try {
        final datos = jsonDecode('${fila['datos_json']}');
        if (datos is Map) lista.add(Map<String, dynamic>.from(datos));
      } catch (_) {
        // Registro corrupto: se ignora.
      }
    }
    if (limite != null && lista.length > limite) {
      return lista.sublist(lista.length - limite);
    }
    return lista;
  }

  /// Último `id_mensaje` guardado (cursor del sondeo incremental).
  Future<int?> maxIdMensaje() async {
    final db = await database;
    final filas = await db.rawQuery('SELECT MAX(id_mensaje) AS ultimo FROM mensaje_local');
    final valor = filas.isNotEmpty ? filas.first['ultimo'] : null;
    return valor is int ? valor : null;
  }

  /// Cuántos mensajes de la bandeja están sin leer.
  Future<int> contarMensajesNoLeidos() async {
    final db = await database;
    final filas =
        await db.rawQuery('SELECT COUNT(*) AS total FROM mensaje_local WHERE leido = 0');
    final valor = filas.isNotEmpty ? filas.first['total'] : 0;
    return valor is int ? valor : 0;
  }

  /// Marca como leídos los mensajes indicados en la bandeja local.
  Future<void> marcarMensajesLeidosLocal(List<int> ids) async {
    if (ids.isEmpty) return;
    final db = await database;
    for (final id in ids) {
      final filas = await db.query(
        'mensaje_local',
        columns: ['datos_json'],
        where: 'id_mensaje = ?',
        whereArgs: [id],
        limit: 1,
      );
      if (filas.isEmpty) continue;
      Map<String, dynamic> datos;
      try {
        final decodificado = jsonDecode('${filas.first['datos_json']}');
        datos = decodificado is Map
            ? Map<String, dynamic>.from(decodificado)
            : <String, dynamic>{};
      } catch (_) {
        datos = <String, dynamic>{};
      }
      datos['leido'] = true;
      await db.update(
        'mensaje_local',
        {'leido': 1, 'datos_json': jsonEncode(datos)},
        where: 'id_mensaje = ?',
        whereArgs: [id],
      );
    }
  }

  // Metadatos (D-81): identificador de dispositivo y último checklist
  // ------------------------------------------------------------------------- #

  Future<String?> leerMeta(String clave) async {
    final db = await database;
    final filas = await db.query('app_meta', where: 'clave = ?', whereArgs: [clave], limit: 1);
    if (filas.isEmpty) return null;
    return '${filas.first['valor']}';
  }

  Future<void> guardarMeta(String clave, String valor) async {
    final db = await database;
    await db.insert(
      'app_meta',
      {'clave': clave, 'valor': valor},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Identificador **real** del dispositivo (UUID generado una vez y persistido).
  /// Sustituye al antiguo `'apk-local'` fijo (A-04).
  Future<String> dispositivoId() async {
    final existente = await leerMeta('dispositivo_id');
    if (existente != null && existente.isNotEmpty) return existente;
    final generado = _nuevoId();
    await guardarMeta('dispositivo_id', generado);
    return generado;
  }

  /// Guarda el checklist de la última sincronización (para mostrarlo en la pantalla).
  Future<void> guardarChecklist(String json) => guardarMeta('ultimo_checklist', json);

  Future<String?> leerChecklist() => leerMeta('ultimo_checklist');

  static String _nuevoId() {
    final r = Random();
    final hex = List<String>.generate(
      16,
      (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
    return 'DEV-$hex';
  }

  static int _ahora() => DateTime.now().millisecondsSinceEpoch;
}
