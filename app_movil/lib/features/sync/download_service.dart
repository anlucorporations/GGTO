import '../../core/api_client.dart';
import '../../core/api_error.dart';
import '../../core/database.dart';
import 'detalle_sync.dart';
import 'purga_despachos.dart';
import 'reintentos.dart';
import 'sync_sesion.dart';

/// Resultado de una operación DESCARGA (D-73).
///
/// D-83: además de los conteos, el servidor devuelve **por qué** no hay casos
/// (`motivo`/`mensaje`) y la **cuadrilla** que resolvió. Antes, «sin cuadrilla»,
/// «cuadrilla de gestión», «sin despacho» y «ya tiene todo» se veían igual
/// («No hay casos nuevos ni cambios»).
class ResultadoDescarga {
  const ResultadoDescarga({
    required this.nuevos,
    required this.actualizados,
    required this.serverTs,
    this.motivo = '',
    this.mensaje = '',
    this.cuadrillaCodigo,
    this.casosCuadrilla = 0,
    this.masivas = 0,
    this.descartados = 0,
    this.despachoDelDia,
  });

  final int nuevos;
  final int actualizados;
  final DateTime? serverTs;

  /// Código estable del motivo (`OK`, `SIN_CUADRILLA`, `CUADRILLA_GESTION`…).
  final String motivo;

  /// Explicación lista para mostrar al técnico.
  final String mensaje;

  /// Código de la cuadrilla resuelta por el servidor (p. ej. `C-001`).
  final String? cuadrillaCodigo;

  /// Casos operables que el servidor tiene despachados para esa cuadrilla.
  final int casosCuadrilla;

  /// D-99: masivas activas (DETECTADA o PLANIFICADA) que atañen a la cuadrilla.
  ///
  /// Viaja **siempre** con la descarga —aunque no haya casos nuevos— porque el
  /// bloque MASIVA de la APK es fijo y debe reflejar el estado vigente.
  final int masivas;

  /// D-104/D-115: casos **no atendidos** de despachos anteriores que se borraron
  /// del dispositivo tras una descarga correcta.
  final int descartados;

  /// D-104/D-115: fecha del despacho del día (`null` si la cuadrilla no tiene
  /// jornada; la purga se aplica igualmente si la cuadrilla está resuelta).
  final DateTime? despachoDelDia;

  /// ¿La descarga no trajo nada **porque no hay nada** (y no por un fallo)?
  bool get sinNovedades => nuevos == 0 && actualizados == 0;

  String get resumen {
    if (sinNovedades && descartados == 0) {
      return mensaje.isNotEmpty ? mensaje : 'No hay casos nuevos ni cambios.';
    }
    final partes = <String>[];
    if (nuevos > 0) partes.add('$nuevos nuevos');
    if (actualizados > 0) partes.add('$actualizados actualizados');
    if (descartados > 0) partes.add('$descartados descartados de jornadas anteriores');
    final conteo = partes.join(' · ');
    if (cuadrillaCodigo == null || cuadrillaCodigo!.isEmpty) return conteo;
    return '$conteo · cuadrilla $cuadrillaCodigo';
  }

}

/// Servicio de descarga diferencial por cuadrilla del técnico logueado.
class DownloadService {
  const DownloadService._();

  /// Clave de la marca de agua del servidor (`server_ts` de la última descarga).
  static const claveMarcaDescarga = 'ultima_descarga_ts';

  /// Llama `GET /sync/descarga` y aplica el resultado a la caché local.
  ///
  /// D-81: abre una sesión de sincronización, ejecuta el checklist y la cierra
  /// con el resultado (RF-39/RF-40).
  ///
  /// D-82: informa el avance por `onProgreso` para la barra de sincronización.
  ///
  /// D-83: el diferencial se mide con la **marca del servidor** (`server_ts`), no
  /// con el reloj del teléfono: un reloj adelantado dejaba al técnico sin casos
  /// para siempre porque todo parecía «ya modificado».
  static Future<ResultadoDescarga> descargar({
    void Function(String fase, double valor)? onProgreso,
  }) async {
    void avisar(double valor, String fase) => onProgreso?.call(fase, valor);

    avisar(0.05, 'Conectando con el servidor…');
    final sesion = await SyncSesionService.abrir('DESCARGA');
    try {
      final idsConocidos = await DatabaseHelper.instance.idsCasosConocidos();
      // D-105: sin casos en el dispositivo no hay marca de agua válida que enviar.
      // Si se mandaba `desde` con la caché vacía, el servidor entendía que el
      // dispositivo estaba al día y no enviaba lo que no tenía: la descarga
      // respondía «ya los tiene todos» y el listado quedaba vacío para siempre
      // (pasaba tras una purga de D-104 o tras borrar los datos de la app).
      final ultima = idsConocidos.isEmpty ? null : await _marcaDescarga();

      final query = <String, dynamic>{
        if (idsConocidos.isNotEmpty) 'ids_conocidos': idsConocidos,
        if (ultima != null) 'desde': ultima.toUtc().toIso8601String(),
      };

      avisar(0.35, 'Descargando los casos de mi cuadrilla…');
      // D-127 · H-10: la descarga viaja en el **cuerpo** (POST). Con la caché
      // grande, `ids_conocidos` en la query string superaba el límite de URL del
      // proxy. Si el servidor todavía no tiene la ruta (versión anterior), se
      // reintenta por GET para no dejar al técnico sin despacho.
      // D-135 · H-18: además reintenta con backoff ante fallos de red o 5xx.
      final datos = await _descargar(query);
      if (datos is! Map) {
        avisar(1, 'Descarga completada');
        return const ResultadoDescarga(nuevos: 0, actualizados: 0, serverTs: null);
      }

      final lista = datos['casos'];
      var nuevos = 0;
      var actualizados = 0;
      // D-119: los casos que llegan en **esta** descarga no se purgan nunca.
      final idsDescargados = <int>{};
      if (lista is List && lista.isNotEmpty) {
        avisar(0.7, 'Guardando el contenido en el dispositivo…');
        for (final caso in lista) {
          if (caso is Map && caso['id_caso'] is int) {
            idsDescargados.add(caso['id_caso'] as int);
          }
        }
        final r = await DatabaseHelper.instance.mergearCasos(lista);
        nuevos = r.$1;
        actualizados = r.$2;
      }

      // D-119: todo el trabajo vigente que el servidor reconoce a la cuadrilla.
      // Se conserva al purgar junto con `ids_del_dia`; sin él, un despacho del día
      // en BORRADOR (o de una jornada anterior) dejaba la lista vacía.
      final idsVigentes = <int>{};
      final listaVigentes = datos['ids_vigentes'];
      if (listaVigentes is List) {
        for (final id in listaVigentes) {
          if (id is int) idsVigentes.add(id);
        }
      }

      // D-99: las masivas activas acompañan a la descarga. Un servidor antiguo
      // no las envía: se trata como lista vacía (no hay masivas que mostrar).
      final listaMasivas = datos['masivas'];
      final masivas = listaMasivas is List ? listaMasivas : const <dynamic>[];
      avisar(0.8, 'Guardando las fallas masivas…');
      await DatabaseHelper.instance.guardarMasivas(masivas);

      // D-104/D-115: la jornada del día aporta los casos que se conservan
      // siempre; la purga borra los **no atendidos** de jornadas anteriores.
      final despachoDia = datos['despacho_del_dia'];
      DateTime? fechaDespacho;
      var descartados = 0;
      final idsDia = <int>{};
      if (despachoDia is Map) {
        final fecha = despachoDia['fecha'];
        if (fecha is String) fechaDespacho = DateTime.tryParse(fecha);
        final ids = datos['ids_del_dia'];
        if (ids is List) {
          for (final id in ids) {
            if (id is int) idsDia.add(id);
          }
        }
      }

      final motivo = '${datos['motivo'] ?? ''}';
      final cuadrilla = datos['cuadrilla'];
      final codigo = cuadrilla is Map ? '${cuadrilla['codigo'] ?? ''}' : '';
      // D-115: la purga es parte de la actualización. Se ejecuta cuando el
      // servidor resolvió una cuadrilla de campo, aunque todavía no haya
      // despacho publicado del día (en ese caso `idsDelDia` viene vacío y se
      // conservan solo los casos atendidos y el trabajo sin enviar).
      // D-119: además se conservan los casos vigentes de la cuadrilla y los que
      // acaban de llegar en esta descarga: la purga nunca borra lo que el
      // servidor considera trabajo del técnico.
      final purgaPermitida = datos['purga_permitida'] != false;
      if (PurgaDespachos.procede(
        motivo: motivo,
        cuadrillaResuelta: codigo.isNotEmpty,
        purgaPermitida: purgaPermitida,
      )) {
        avisar(0.9, 'Descartando los casos no atendidos…');
        descartados = await PurgaDespachos.ejecutar(
          idsDelDia: idsDia,
          idsVigentes: idsVigentes,
          idsDescargados: idsDescargados,
        );
      }

      DateTime? serverTs;
      final ts = datos['server_ts'];
      if (ts is String) {
        serverTs = DateTime.tryParse(ts);
      }
      // La marca del servidor es la referencia del próximo diferencial.
      if (serverTs != null) {
        await DatabaseHelper.instance
            .guardarMeta(claveMarcaDescarga, serverTs.toUtc().toIso8601String());
      }

      final casosCuadrilla = datos['casos_cuadrilla'] is int
          ? datos['casos_cuadrilla'] as int
          : 0;

      if (sesion.idSesion != null) {
        await SyncSesionService.cerrar(
          sesion,
          tipo: 'DESCARGA',
          recibidos: nuevos + actualizados,
          procesados: nuevos + actualizados,
          estado: 'OK',
          pasoEstado: 'OK',
          // D-136 · H-19: qué llegó y qué se descartó, para la auditoría.
          detalle: detalleDescarga(
            idsRecibidos: idsDescargados,
            nuevos: nuevos,
            actualizados: actualizados,
            descartados: descartados,
            idsDelDia: idsDia,
            idsVigentes: idsVigentes,
            motivo: motivo,
            cuadrilla: codigo,
          ),
        );
      }
      avisar(1, 'Descarga completada');
      return ResultadoDescarga(
        nuevos: nuevos,
        actualizados: actualizados,
        serverTs: serverTs,
        motivo: '${datos['motivo'] ?? ''}',
        mensaje: '${datos['mensaje'] ?? ''}',
        cuadrillaCodigo: codigo.isEmpty ? null : codigo,
        casosCuadrilla: casosCuadrilla,
        masivas: masivas.length,
        descartados: descartados,
        despachoDelDia: fechaDespacho,
      );
    } catch (e) {
      if (sesion.idSesion != null) {
        await SyncSesionService.cerrar(
          sesion,
          tipo: 'DESCARGA',
          errores: 1,
          estado: 'ERROR',
          pasoEstado: 'ERROR',
          detalleError: '$e',
          detalle: const {'error': 'descarga'},
        );
      }
      rethrow;
    }
  }

  /// Marca de agua del diferencial: la del servidor si ya existe (D-83) y, si no,
  /// la del reloj del dispositivo que usaban las versiones anteriores.
  static Future<DateTime?> _marcaDescarga() async {
    final guardada = await DatabaseHelper.instance.leerMeta(claveMarcaDescarga);
    final delServidor = guardada == null ? null : DateTime.tryParse(guardada);
    if (delServidor != null) return delServidor;
    return DatabaseHelper.instance.ultimaDescarga();
  }

  /// Descarga con reintento y caída al GET antiguo (D-135 · H-18).
  static Future<dynamic> _descargar(Map<String, dynamic> query) async {
    var intento = 0;
    while (true) {
      try {
        return await ApiClient.post('/sync/descarga', data: query);
      } on ApiError catch (error) {
        // Servidor anterior a D-127: se usa la vía GET, sin reintentos.
        if (error.status == 404 || error.status == 405) {
          return ApiClient.get('/sync/descarga', query: query);
        }
        if (!reintentableDescarga(
          status: error.status,
          deRed: error.esDeRed,
          intento: intento,
        )) {
          rethrow;
        }
        await Future<void>.delayed(esperasDescarga[intento]);
        intento++;
      }
    }
  }
}
