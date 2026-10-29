import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import '../../core/api_error.dart';
import '../../core/database.dart';
import '../sync/download_service.dart';

/// Estado de las fallas **MASIVAS** activas (D-99) con caché local.
///
/// Igual que `CasosProvider`, el **contenido del dispositivo** (SQLite) manda:
/// cualquier carga vuelca la caché en pantalla, de modo que el bloque MASIVA de
/// la APK funciona aunque la descarga falle.
class MasivasProvider extends ChangeNotifier {
  /// Roles que pueden **planificar** la masiva (endpoint de escritura).
  static const Set<String> rolesPlanificacion = {'ADMIN', 'SUPERVISOR'};

  /// Roles que pueden **solicitar material**.
  static const Set<String> rolesMaterial = {'ADMIN', 'SUPERVISOR', 'COORDINADOR'};

  /// Roles que pueden **cerrar** la masiva en cascada.
  static const Set<String> rolesCierre = {'ADMIN', 'SUPERVISOR'};

  List<Map<String, dynamic>> _masivas = [];
  bool _cargando = false;
  bool _desdeCache = false;
  String? _error;
  DateTime? _actualizadoEn;

  List<Map<String, dynamic>> get masivas => _masivas;
  bool get cargando => _cargando;

  /// `true` cuando la última descarga contra el servidor falló: lo que se ve en
  /// pantalla es el contenido local guardado.
  bool get desdeCache => _desdeCache;
  String? get error => _error;

  /// Fecha del contenido local (la última descarga con éxito).
  DateTime? get actualizadoEn => _actualizadoEn;

  /// ¿Hay alguna masiva activa? Es lo que alimenta el aviso (badge) de la
  /// barra de navegación del técnico.
  bool get hayActivas => _masivas.isNotEmpty;

  /// Cuántas masivas activas hay en el dispositivo.
  int get total => _masivas.length;

  /// Masiva de mayor prioridad (la DETECTADA con más casos asociados).
  Map<String, dynamic>? get prioritaria {
    if (_masivas.isEmpty) return null;
    return ordenarPorPrioridad(_masivas).first;
  }

  /// Descarga las masivas de la cuadrilla y, en cualquier caso, deja en pantalla
  /// el contenido local guardado (la caché manda, como en `CasosProvider`).
  Future<void> cargar({bool silencioso = false}) async {
    if (!silencioso) {
      _cargando = true;
      _error = null;
      notifyListeners();
    }

    try {
      final resultado = await DownloadService.descargar();
      _actualizadoEn = resultado.serverTs ?? DateTime.now();
      _desdeCache = false;
      _error = null;
    } on ApiError catch (error) {
      _desdeCache = true;
      _error = error.mensaje;
    } catch (error) {
      _desdeCache = true;
      _error = ApiError.desconocido(error).mensaje;
    } finally {
      // Lo que se pinta es SIEMPRE el contenido del dispositivo.
      await _leerLocal();
      _cargando = false;
      notifyListeners();
    }
  }

  /// Refresca las masivas contra el servidor (misma DESCARGA que los casos).
  Future<void> refrescarDesdeServidor() => cargar();

  /// Vuelca la caché local sin tocar la red ni marcar «sin conexión».
  ///
  /// Abrir una pantalla **no** es sincronizar (D-84): este camino pinta lo que
  /// hay en el dispositivo sin anunciar que la descarga falló.
  Future<void> refrescarLocal() async {
    await _leerLocal();
    notifyListeners();
  }

  /// Vuelca la caché local sin tocar la red.
  Future<void> cargarDesdeCache() async {
    _desdeCache = true;
    await _leerLocal();
    notifyListeners();
  }

  /// Quita una masiva del dispositivo (p. ej. tras cerrarla) y refresca la lista.
  ///
  /// Se apoya en `guardarMasivas`, cuyo merge borra lo que ya no viene: se
  /// vuelve a guardar el resto para que la cerrada desaparezca del panel MASIVAS
  /// (y el badge de la barra caiga a cero).
  Future<void> quitarLocal(int idFalla) async {
    final restantes = _masivas
        .where((m) => idDe(m) != idFalla)
        .toList();
    await DatabaseHelper.instance.guardarMasivas(restantes);
    await _leerLocal();
    notifyListeners();
  }

  Future<void> _leerLocal() async {
    _masivas = await DatabaseHelper.instance.leerMasivas();
  }

  // ------------------------------------------------------------------------- #
  // Ayudas puras (probables sin dispositivo ni red)
  // ------------------------------------------------------------------------- #

  /// Identificador numérico de la masiva (`id_falla`), o `0` si no lo trae.
  static int idDe(Map<String, dynamic> masiva) {
    final valor = masiva['id_falla'];
    if (valor is int) return valor;
    return int.tryParse('$valor') ?? 0;
  }

  /// Nº de casos asociados: el contador del servidor o, si no viniera, el tamaño
  /// de la lista embebida de casos.
  static int casosAsociados(Map<String, dynamic> masiva) {
    final contador = masiva['casos_asociados'];
    if (contador is int) return contador;
    final casos = masiva['casos'];
    if (casos is List) return casos.length;
    return 0;
  }

  /// Orden de **prioridad**: primero las DETECTADAS (aún sin planificar),
  /// después las de más casos asociados y, a igualdad, la más reciente.
  static List<Map<String, dynamic>> ordenarPorPrioridad(
    List<Map<String, dynamic>> masivas,
  ) {
    final copia = List<Map<String, dynamic>>.from(masivas);
    copia.sort((a, b) {
      final estado = pesoEstado(a).compareTo(pesoEstado(b));
      if (estado != 0) return -estado;
      final casos = casosAsociados(a).compareTo(casosAsociados(b));
      if (casos != 0) return -casos;
      return idDe(b).compareTo(idDe(a));
    });
    return copia;
  }

  /// Peso del estado para la prioridad: DETECTADA (2) pesa más que PLANIFICADA (1).
  static int pesoEstado(Map<String, dynamic> masiva) =>
      '${masiva['estado'] ?? ''}'.toUpperCase() == 'DETECTADA' ? 2 : 1;

  /// **RUTA** del caso asociado (RF-59 · D-99).
  ///
  /// En el archivo de ingesta la ruta viaja en la columna **EXTRA**; el servidor
  /// la entrega en `ruta` y, si viniera vacía, en `extra`. Como último recurso se
  /// compone con Tarjeta (slot) · Puerto · FAT, el criterio D-75. Sea cual sea su
  /// origen, la ficha la muestra **siempre**.
  static String rutaDeCaso(Map<String, dynamic> caso) {
    for (final campo in const ['ruta', 'extra']) {
      final valor = '${caso[campo] ?? ''}'.trim();
      if (valor.isNotEmpty) return valor;
    }
    return const ['slot', 'puerto', 'fat']
        .map((campo) => '${caso[campo] ?? ''}'.trim())
        .where((parte) => parte.isNotEmpty)
        .join(' · ');
  }

  /// **RUTA** de la masiva: la suya propia o, si no viniera, la del primer caso
  /// asociado que la tenga (que la toma de `ruta`/`extra` o la compone).
  static String rutaDeMasiva(Map<String, dynamic> masiva) {
    final propia = '${masiva['ruta'] ?? ''}'.trim();
    if (propia.isNotEmpty) return propia;
    final casos = masiva['casos'];
    if (casos is List) {
      for (final caso in casos) {
        if (caso is! Map) continue;
        final ruta = rutaDeCaso(Map<String, dynamic>.from(caso));
        if (ruta.isNotEmpty) return ruta;
      }
    }
    return '';
  }

  /// ¿El rol puede planificar la masiva?
  static bool puedePlanificar(String rol) =>
      rolesPlanificacion.contains(rol.trim().toUpperCase());

  /// ¿El rol puede solicitar material?
  static bool puedeSolicitarMaterial(String rol) =>
      rolesMaterial.contains(rol.trim().toUpperCase());

  /// ¿El rol puede cerrar la masiva (y con ella todos sus casos)?
  static bool puedeCerrar(String rol) =>
      rolesCierre.contains(rol.trim().toUpperCase());

  // ------------------------------------------------------------------------- #
  // Indicadores del cuadro de MASIVAS (D-111)
  // ------------------------------------------------------------------------- #

  /// **Planificación**: la masiva ya tiene plan de atención (RF-17).
  static bool tienePlanificacion(Map<String, dynamic> masiva) =>
      '${masiva['planificacion'] ?? ''}'.trim().isNotEmpty;

  /// **Materiales**: cuántas órdenes de material tiene la masiva.
  ///
  /// La DESCARGA manda la lista `ordenes`; el listado de la API manda el
  /// contador `ordenes_count`. Se admiten las dos formas para que el indicador
  /// funcione con y sin conexión.
  static int ordenesDe(Map<String, dynamic> masiva) {
    final ordenes = masiva['ordenes'];
    if (ordenes is List) return ordenes.length;
    final contador = masiva['ordenes_count'];
    if (contador is int) return contador;
    return int.tryParse('${contador ?? ''}') ?? 0;
  }

  /// **Materiales**: ¿tiene al menos una orden solicitada? (RF-18)
  static bool tieneMateriales(Map<String, dynamic> masiva) =>
      ordenesDe(masiva) > 0;

  /// **Asignación**: ¿la masiva ya tiene cuadrilla asignada?
  static bool tieneAsignacion(Map<String, dynamic> masiva) {
    final id = masiva['id_cuadrilla'];
    final idCuadrilla = id is int ? id : int.tryParse('${id ?? ''}') ?? 0;
    final codigo =
        '${masiva['cuadrilla_codigo'] ?? masiva['cuadrilla_nombre'] ?? ''}'.trim();
    return idCuadrilla > 0 || codigo.isNotEmpty;
  }

  /// Busca el proveedor de masivas **si** está registrado en el árbol.
  ///
  /// El panel MASIVAS y el badge de la barra lo usan: cuando no hay proveedor
  /// (una pantalla aislada) el aviso simplemente no se pinta en lugar de romper
  /// la lista de trabajo.
  static MasivasProvider? opcional(BuildContext context, {bool escuchar = true}) {
    try {
      return Provider.of<MasivasProvider>(context, listen: escuchar);
    } catch (_) {
      return null;
    }
  }
}
