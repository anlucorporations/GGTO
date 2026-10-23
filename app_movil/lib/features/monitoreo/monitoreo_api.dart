import '../../core/api_client.dart';

/// Modelos y consultas de **MONITOREO** para la APK (D-109).
///
/// Reproduce en el móvil el mismo esquema de métricas que la web: gestión del día,
/// curva semanal, globales del periodo, pendientes por tipo (reparación y
/// construcción), por cuadrilla y capacidad operativa. Los endpoints son los
/// mismos (`/monitoreo/...`) y comparten el alcance por central/cuadrilla que
/// resuelve el servidor, así que las cifras coinciden con la web.
class MonitoreoApi {
  const MonitoreoApi._();

  /// Consulta **todas** las fuentes del tablero en paralelo.
  static Future<PanoramaMonitoreo> panorama({
    DateTime? fecha,
    DateTime? desde,
  }) async {
    final f = _iso(fecha ?? DateTime.now());
    final d = _iso(desde ?? DateTime.now());
    final respuestas = await Future.wait([
      ApiClient.get('/monitoreo/diario', query: {'fecha': f}),
      ApiClient.get('/monitoreo/semanal', query: {'desde': d}),
      ApiClient.get('/monitoreo/globales'),
      ApiClient.get('/monitoreo/reparacion'),
      ApiClient.get('/monitoreo/construccion'),
      ApiClient.get('/monitoreo/cuadrilla', query: {'desde': d}),
      ApiClient.get('/monitoreo/capacidad'),
    ]);
    return PanoramaMonitoreo(
      diario: DiarioMonitoreo.desdeJson(_mapa(respuestas[0])),
      semanal: SemanalMonitoreo.desdeJson(_mapa(respuestas[1])),
      globales: GlobalesMonitoreo.desdeJson(_mapa(respuestas[2])),
      reparacion: ReparacionMonitoreo.desdeJson(_mapa(respuestas[3])),
      construccion: ConstruccionMonitoreo.desdeJson(_mapa(respuestas[4])),
      cuadrillas: CuadrillasMonitoreo.desdeJson(_mapa(respuestas[5])),
      capacidad: CapacidadMonitoreo.desdeJson(_mapa(respuestas[6])),
    );
  }

  static String _iso(DateTime fecha) {
    String dos(int v) => v.toString().padLeft(2, '0');
    return '${fecha.year}-${dos(fecha.month)}-${dos(fecha.day)}';
  }

  static Map<String, dynamic> _mapa(dynamic valor) =>
      valor is Map ? Map<String, dynamic>.from(valor) : <String, dynamic>{};
}

/// Cifra entera tolerante (JSON numérico o texto).
int numero(dynamic valor) {
  if (valor is int) return valor;
  if (valor is num) return valor.round();
  return int.tryParse('${valor ?? ''}') ?? 0;
}

/// Texto tolerante.
String texto(dynamic valor) => '${valor ?? ''}';

/// Mapa de etiqueta → cifra (p. ej. `por_estado`).
Map<String, int> mapaNumeros(dynamic valor) {
  if (valor is! Map) return {};
  return {
    for (final entrada in valor.entries) '${entrada.key}': numero(entrada.value),
  };
}

// --------------------------------------------------------------------------- //
// Modelos (mismos nombres y campos que la web)
// --------------------------------------------------------------------------- //

class PanoramaMonitoreo {
  const PanoramaMonitoreo({
    required this.diario,
    required this.semanal,
    required this.globales,
    required this.reparacion,
    required this.construccion,
    required this.cuadrillas,
    required this.capacidad,
  });

  final DiarioMonitoreo diario;
  final SemanalMonitoreo semanal;
  final GlobalesMonitoreo globales;
  final ReparacionMonitoreo reparacion;
  final ConstruccionMonitoreo construccion;
  final CuadrillasMonitoreo cuadrillas;
  final CapacidadMonitoreo capacidad;
}

class DiarioMonitoreo {
  const DiarioMonitoreo({
    required this.fecha,
    required this.ingresosNuevos,
    required this.resueltosResidencial,
    required this.resueltosEmpresarial,
    required this.resueltosReparacionesReferidas,
    required this.resueltosConstruccion,
    required this.citados,
    required this.diferidos,
    required this.gestionados,
  });

  final String fecha;
  final int ingresosNuevos;
  final int resueltosResidencial;
  final int resueltosEmpresarial;
  final int resueltosReparacionesReferidas;
  final int resueltosConstruccion;
  final int citados;
  final int diferidos;
  final int gestionados;

  static DiarioMonitoreo desdeJson(Map<String, dynamic> json) => DiarioMonitoreo(
        fecha: texto(json['fecha']),
        ingresosNuevos: numero(json['ingresos_nuevos']),
        resueltosResidencial: numero(json['resueltos_residencial']),
        resueltosEmpresarial: numero(json['resueltos_empresarial']),
        resueltosReparacionesReferidas: numero(json['resueltos_reparaciones_referidas']),
        resueltosConstruccion: numero(json['resueltos_construccion']),
        citados: numero(json['citados']),
        diferidos: numero(json['diferidos']),
        gestionados: numero(json['gestionados']),
      );

  int get resueltosTotal =>
      resueltosResidencial +
      resueltosEmpresarial +
      resueltosReparacionesReferidas +
      resueltosConstruccion;
}

class DiaSemanal {
  const DiaSemanal({
    required this.fecha,
    required this.asignados,
    required this.cerrados,
    required this.gestionados,
  });

  final String fecha;
  final int asignados;
  final int cerrados;
  final int gestionados;

  static DiaSemanal desdeJson(Map<String, dynamic> json) => DiaSemanal(
        fecha: texto(json['fecha']),
        asignados: numero(json['asignados']),
        cerrados: numero(json['cerrados']),
        gestionados: numero(json['gestionados']),
      );

  /// Etiqueta corta del día (p. ej. `lun`).
  String get etiqueta {
    final fechaDia = DateTime.tryParse(fecha);
    if (fechaDia == null) return fecha;
    const nombres = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
    return nombres[fechaDia.weekday - 1];
  }
}

class SemanalMonitoreo {
  const SemanalMonitoreo({required this.desde, required this.hasta, required this.dias});

  final String desde;
  final String hasta;
  final List<DiaSemanal> dias;

  static SemanalMonitoreo desdeJson(Map<String, dynamic> json) => SemanalMonitoreo(
        desde: texto(json['desde']),
        hasta: texto(json['hasta']),
        dias: [
          for (final dia in (json['dias'] as List? ?? const []))
            if (dia is Map) DiaSemanal.desdeJson(Map<String, dynamic>.from(dia)),
        ],
      );

  int get cerrados => dias.fold(0, (suma, dia) => suma + dia.cerrados);
  int get asignados => dias.fold(0, (suma, dia) => suma + dia.asignados);
  int get gestionados => dias.fold(0, (suma, dia) => suma + dia.gestionados);
}

class GlobalesMonitoreo {
  const GlobalesMonitoreo({
    required this.desde,
    required this.hasta,
    required this.pendientes,
    required this.resueltos,
    required this.total,
    required this.referidos,
    required this.construccion,
    required this.cerradosComunes,
    required this.porEstado,
    required this.porCategoria,
  });

  final String desde;
  final String hasta;
  final int pendientes;
  final int resueltos;
  final int total;
  final int referidos;
  final int construccion;
  final int cerradosComunes;
  final Map<String, int> porEstado;
  final Map<String, int> porCategoria;

  static GlobalesMonitoreo desdeJson(Map<String, dynamic> json) => GlobalesMonitoreo(
        desde: texto(json['desde']),
        hasta: texto(json['hasta']),
        pendientes: numero(json['pendientes']),
        resueltos: numero(json['resueltos']),
        total: numero(json['total']),
        referidos: numero(json['referidos']),
        construccion: numero(json['construccion']),
        cerradosComunes: numero(json['cerrados_comunes']),
        porEstado: mapaNumeros(json['por_estado']),
        porCategoria: mapaNumeros(json['por_categoria']),
      );
}

class ReparacionMonitoreo {
  const ReparacionMonitoreo({
    required this.residencialesComunes,
    required this.residencialesReferidos,
    required this.empresariales,
    required this.total,
  });

  final int residencialesComunes;
  final int residencialesReferidos;
  final int empresariales;
  final int total;

  static ReparacionMonitoreo desdeJson(Map<String, dynamic> json) => ReparacionMonitoreo(
        residencialesComunes: numero(json['residenciales_comunes']),
        residencialesReferidos: numero(json['residenciales_referidos']),
        empresariales: numero(json['empresariales']),
        total: numero(json['total']),
      );
}

class ConstruccionMonitoreo {
  const ConstruccionMonitoreo({
    required this.residenciales,
    required this.empresariales,
    required this.total,
  });

  final int residenciales;
  final int empresariales;
  final int total;

  static ConstruccionMonitoreo desdeJson(Map<String, dynamic> json) =>
      ConstruccionMonitoreo(
        residenciales: numero(json['residenciales']),
        empresariales: numero(json['empresariales']),
        total: numero(json['total']),
      );
}

class CuadrillaMonitoreo {
  const CuadrillaMonitoreo({
    required this.idCuadrilla,
    required this.codigo,
    required this.nombre,
    required this.asignados,
    required this.cerrados,
    required this.gestionados,
    required this.dias,
  });

  final int idCuadrilla;
  final String codigo;
  final String nombre;
  final int asignados;
  final int cerrados;
  final int gestionados;
  final List<DiaSemanal> dias;

  static CuadrillaMonitoreo desdeJson(Map<String, dynamic> json) {
    final totales = json['totales'] is Map
        ? Map<String, dynamic>.from(json['totales'] as Map)
        : <String, dynamic>{};
    return CuadrillaMonitoreo(
      idCuadrilla: numero(json['id_cuadrilla']),
      codigo: texto(json['codigo']),
      nombre: texto(json['nombre']),
      asignados: numero(totales['asignados']),
      cerrados: numero(totales['cerrados']),
      gestionados: numero(totales['gestionados']),
      dias: [
        for (final dia in (json['dias'] as List? ?? const []))
          if (dia is Map) DiaSemanal.desdeJson(Map<String, dynamic>.from(dia)),
      ],
    );
  }
}

class CuadrillasMonitoreo {
  const CuadrillasMonitoreo({required this.desde, required this.dias, required this.cuadrillas});

  final String desde;
  final int dias;
  final List<CuadrillaMonitoreo> cuadrillas;

  static CuadrillasMonitoreo desdeJson(Map<String, dynamic> json) => CuadrillasMonitoreo(
        desde: texto(json['desde']),
        dias: numero(json['dias']),
        cuadrillas: [
          for (final c in (json['cuadrillas'] as List? ?? const []))
            if (c is Map) CuadrillaMonitoreo.desdeJson(Map<String, dynamic>.from(c)),
        ],
      );
}

class CapacidadCuadrilla {
  const CapacidadCuadrilla({
    required this.codigo,
    required this.nombre,
    required this.integrantes,
    required this.flota,
    required this.completa,
    required this.esSupervisor,
  });

  final String codigo;
  final String nombre;
  final int integrantes;
  final String? flota;
  final bool completa;
  final bool esSupervisor;

  static CapacidadCuadrilla desdeJson(Map<String, dynamic> json) => CapacidadCuadrilla(
        codigo: texto(json['codigo']),
        nombre: texto(json['nombre']),
        integrantes: numero(json['integrantes']),
        flota: (json['flota'] as String?)?.trim().isEmpty ?? true
            ? null
            : texto(json['flota']),
        completa: json['completa'] == true,
        esSupervisor: json['es_supervisor'] == true,
      );
}

class CapacidadMonitoreo {
  const CapacidadMonitoreo({
    required this.cuadrillasActivas,
    required this.tecnicosActivos,
    required this.flotaDisponible,
    required this.herramientasDisponibles,
    required this.sectoresActivos,
    required this.cuadrillas,
  });

  final int cuadrillasActivas;
  final int tecnicosActivos;
  final int flotaDisponible;
  final int herramientasDisponibles;
  final int sectoresActivos;
  final List<CapacidadCuadrilla> cuadrillas;

  static CapacidadMonitoreo desdeJson(Map<String, dynamic> json) => CapacidadMonitoreo(
        cuadrillasActivas: numero(json['cuadrillas_activas']),
        tecnicosActivos: numero(json['tecnicos_activos']),
        flotaDisponible: numero(json['flota_disponible']),
        herramientasDisponibles: numero(json['herramientas_disponibles']),
        sectoresActivos: numero(json['sectores_activos']),
        cuadrillas: [
          for (final c in (json['cuadrillas'] as List? ?? const []))
            if (c is Map) CapacidadCuadrilla.desdeJson(Map<String, dynamic>.from(c)),
        ],
      );
}
