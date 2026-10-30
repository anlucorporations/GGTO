import '../../core/api_client.dart';
import 'monitoreo_api.dart' show numero, texto;

/// Modelos y consulta del **reporte de producción del día** (D-162 · punto 7).
///
/// La web y la APK leen el mismo endpoint (`/despachos/reporte/produccion`). El
/// despacho se informa en **tres columnas** (Comunes, Referidos y Empresa) y
/// cada una desglosa sus cifras en reparaciones y construcción. El
/// mantenimiento y los casos de falla masiva se informan **aparte** para que el
/// total cuadre:
///
///     suma de columnas + mantenimientos + casos_masiva == asignados
///
/// El parser es tolerante, igual que el de `monitoreo_api.dart`: un JSON vacío,
/// con nulos o con tipos inesperados produce ceros en lugar de romper la
/// pantalla.
class DespachoDiaApi {
  const DespachoDiaApi._();

  /// Reporte de producción del día (por defecto, hoy).
  static Future<DespachoDia> delDia({DateTime? fecha}) async {
    final respuesta = await ApiClient.get(
      '/despachos/reporte/produccion',
      query: {'fecha': _iso(fecha ?? DateTime.now())},
    );
    return DespachoDia.desdeJson(
      respuesta is Map
          ? Map<String, dynamic>.from(respuesta)
          : <String, dynamic>{},
    );
  }

  static String _iso(DateTime fecha) {
    String dos(int valor) => valor.toString().padLeft(2, '0');
    return '${fecha.year}-${dos(fecha.month)}-${dos(fecha.day)}';
  }
}

/// Respuesta completa del reporte: fecha, central, filas por cuadrilla y totales.
class DespachoDia {
  const DespachoDia({
    required this.fecha,
    required this.idCentral,
    required this.porCuadrilla,
    required this.totales,
  });

  final String fecha;
  final int idCentral;
  final List<FilaDespacho> porCuadrilla;

  /// Fila de totales. Usa el mismo modelo que las cuadrillas; en ella
  /// `masivas` es un contador (fallas cubiertas), no la lista de ids.
  final FilaDespacho totales;

  static DespachoDia desdeJson(Map<String, dynamic> json) => DespachoDia(
        fecha: texto(json['fecha']),
        idCentral: numero(json['id_central']),
        porCuadrilla: [
          for (final fila in (json['por_cuadrilla'] as List? ?? const []))
            if (fila is Map)
              FilaDespacho.desdeJson(Map<String, dynamic>.from(fila)),
        ],
        totales: FilaDespacho.desdeJson(
          json['totales'] is Map
              ? Map<String, dynamic>.from(json['totales'] as Map)
              : <String, dynamic>{},
        ),
      );
}

/// Una fila del reporte: la de una cuadrilla o la de totales.
class FilaDespacho {
  const FilaDespacho({
    required this.cuadrilla,
    required this.nombre,
    required this.idCuadrilla,
    required this.asignados,
    required this.abiertos,
    required this.cerrados,
    required this.enrutado,
    required this.citados,
    required this.diferidos,
    required this.gestionados,
    required this.referidos,
    required this.empresas,
    required this.esMasiva,
    required this.masivas,
    required this.masivasIds,
    required this.construcciones,
    required this.construccionesCerradas,
    required this.mantenimientos,
    required this.mantenimientosCerradas,
    required this.casosMasiva,
    required this.columnas,
  });

  final String cuadrilla;
  final String nombre;
  final int idCuadrilla;
  final int asignados;
  final int abiertos;
  final int cerrados;
  final int enrutado;
  final int citados;
  final int diferidos;
  final int gestionados;
  final int referidos;
  final int empresas;
  final bool esMasiva;

  /// Fallas masivas que cubren la cuadrilla. En las filas el servidor manda la
  /// lista de ids; en los totales, un número. Se normaliza a contador y se
  /// conservan los ids en [masivasIds] (vacío en los totales).
  final int masivas;
  final List<int> masivasIds;

  final int construcciones;
  final int construccionesCerradas;
  final int mantenimientos;
  final int mantenimientosCerradas;

  /// Casos de falla masiva del despacho (se informan aparte de las columnas).
  final int casosMasiva;

  final ColumnasDespacho columnas;

  /// Asignados que explican las tres columnas.
  int get totalColumnas => columnas.totalAsignados;

  /// `true` cuando `suma columnas + mantenimientos + casos_masiva == asignados`.
  /// Es la reconciliación que exige el contrato de D-162 · punto 7.
  bool get cuadra => totalColumnas + mantenimientos + casosMasiva == asignados;

  /// Nombre legible para la interfaz (código — nombre si hay nombre).
  String get etiqueta {
    if (nombre.isEmpty) return cuadrilla;
    if (cuadrilla.isEmpty) return nombre;
    return '$cuadrilla — $nombre';
  }

  static FilaDespacho desdeJson(Map<String, dynamic> json) {
    final (cantidadMasivas, idsMasivas) = _masivas(json['masivas']);
    return FilaDespacho(
      cuadrilla: texto(json['cuadrilla']),
      nombre: texto(json['nombre']),
      idCuadrilla: numero(json['id_cuadrilla']),
      asignados: numero(json['asignados']),
      abiertos: numero(json['abiertos']),
      cerrados: numero(json['cerrados']),
      enrutado: numero(json['enrutado']),
      citados: numero(json['citados']),
      diferidos: numero(json['diferidos']),
      gestionados: numero(json['gestionados']),
      referidos: numero(json['referidos']),
      empresas: numero(json['empresas']),
      esMasiva: json['es_masiva'] == true,
      masivas: cantidadMasivas,
      masivasIds: idsMasivas,
      construcciones: numero(json['construcciones']),
      construccionesCerradas: numero(json['construcciones_cerradas']),
      mantenimientos: numero(json['mantenimientos']),
      mantenimientosCerradas: numero(json['mantenimientos_cerradas']),
      casosMasiva: numero(json['casos_masiva']),
      columnas: ColumnasDespacho.desdeJson(json['columnas']),
    );
  }

  /// Fila de ceros, para respuestas vacías o sin `totales`.
  static FilaDespacho vacia() =>
      FilaDespacho.desdeJson(const <String, dynamic>{});

  /// `masivas` llega como lista (fila de cuadrilla) o como número (totales).
  static (int, List<int>) _masivas(dynamic valor) {
    if (valor is List) {
      final ids = [for (final id in valor) numero(id)];
      return (ids.length, ids);
    }
    return (numero(valor), const <int>[]);
  }
}

/// Las tres columnas del despacho del día.
class ColumnasDespacho {
  const ColumnasDespacho({
    required this.comunes,
    required this.referidos,
    required this.empresa,
  });

  final ColumnaDespacho comunes;
  final ColumnaDespacho referidos;
  final ColumnaDespacho empresa;

  /// Suma de asignados de las tres columnas (la parte de la reconciliación que
  /// no incluye mantenimiento ni masivas).
  int get totalAsignados =>
      comunes.asignados + referidos.asignados + empresa.asignados;

  static ColumnasDespacho desdeJson(dynamic valor) {
    final json =
        valor is Map ? Map<String, dynamic>.from(valor) : <String, dynamic>{};
    return ColumnasDespacho(
      comunes: ColumnaDespacho.desdeJson(json['comunes']),
      referidos: ColumnaDespacho.desdeJson(json['referidos']),
      empresa: ColumnaDespacho.desdeJson(json['empresa']),
    );
  }
}

/// Contadores de una columna (Comunes, Referidos o Empresa) con el desglose
/// reparaciones/construcción que define el contrato de D-162 · punto 7.
class ColumnaDespacho {
  const ColumnaDespacho({
    required this.asignados,
    required this.asignadosReparacion,
    required this.asignadosConstruccion,
    required this.cerrados,
    required this.cerradosReparacion,
    required this.cerradosConstruccion,
    required this.enrutado,
    required this.citado,
    required this.citadoReparacion,
    required this.citadoConstruccion,
    required this.diferidos,
    required this.diferidosReparacion,
    required this.diferidosConstruccion,
  });

  final int asignados;
  final int asignadosReparacion;
  final int asignadosConstruccion;
  final int cerrados;
  final int cerradosReparacion;
  final int cerradosConstruccion;
  final int enrutado;
  final int citado;
  final int citadoReparacion;
  final int citadoConstruccion;
  final int diferidos;
  final int diferidosReparacion;
  final int diferidosConstruccion;

  static ColumnaDespacho desdeJson(dynamic valor) {
    final json =
        valor is Map ? Map<String, dynamic>.from(valor) : <String, dynamic>{};
    return ColumnaDespacho(
      asignados: numero(json['asignados']),
      asignadosReparacion: numero(json['asignados_reparacion']),
      asignadosConstruccion: numero(json['asignados_construccion']),
      cerrados: numero(json['cerrados']),
      cerradosReparacion: numero(json['cerrados_reparacion']),
      cerradosConstruccion: numero(json['cerrados_construccion']),
      enrutado: numero(json['enrutado']),
      citado: numero(json['citado']),
      citadoReparacion: numero(json['citado_reparacion']),
      citadoConstruccion: numero(json['citado_construccion']),
      diferidos: numero(json['diferidos']),
      diferidosReparacion: numero(json['diferidos_reparacion']),
      diferidosConstruccion: numero(json['diferidos_construccion']),
    );
  }
}
