import '../../core/database.dart';
import '../casos/acciones_caso.dart';

/// Purga de los casos **no atendidos** de despachos anteriores (D-104).
///
/// Objetivo del director: que el técnico vea en su dispositivo **solo** los casos
/// que ya atendió y los del **despacho del día**, y no arrastre trabajo viejo de
/// jornadas anteriores que ya no le corresponde.
///
/// Regla (decidida por el usuario · DEC-104-1): un caso se **conserva** si
///   1. pertenece al **despacho de hoy** (`idsDelDia`), o
///   2. está **gestionado** (`estadosGestionados` de D-101: cerrado, cancelado,
///      enrutado, diferido o citado), o
///   3. tiene **trabajo sin enviar** (`protegidos`: acciones en la cola o fotos
///      sin subir). Esto es innegociable: borrarlo perdería trabajo de campo.
/// En cualquier otro caso —no atendido y de un despacho anterior— se borra.
///
/// D-117: un **PENDIENTE** que pertenece al **despacho del día** se conserva
/// (`idsDelDia`). Los pendientes de despachos anteriores que ya no están en el
/// despacho se retiran del **dispositivo**, pero **no se borran del servidor**:
/// el backend los mantiene en la bolsa para reasignarlos. Así el técnico no
/// acumula casos viejos y el trabajo pendiente no se pierde.
///
/// D-115: la **actualización completa** ejecuta esta purga en cuanto el servidor
/// resuelve una cuadrilla de campo (`procede`), aunque todavía no haya despacho
/// del día; en ese caso `idsDelDia` viene vacío y se borran todos los no atendidos.
///
/// D-119: **la purga nunca borra lo que el servidor considera vigente ni lo que
/// acaba de descargar**. El defecto reportado era justo lo contrario: con el
/// despacho del día en `BORRADOR` el servidor no informaba `ids_del_dia`, la
/// descarga traía los casos y esta purga los borraba en la misma sincronización;
/// el técnico sincronizaba y no veía nada. Ahora se conservan además:
///   - `idsVigentes`: todo el trabajo que el servidor reconoce a la cuadrilla
///     (viaja en la descarga como `ids_vigentes`), esté o no en el despacho de hoy;
///   - `idsDescargados`: los casos que llegaron en **esta** descarga.
///
/// La decisión vive en una **función pura** (RT-29) para poder probarla sin
/// SQLite, igual que `planMergeMasivas` (D-99).
class PurgaDespachos {
  const PurgaDespachos._();

  /// Claves (avería o `id_caso`) que protege **una** acción encolada (D-132).
  ///
  /// H-15: la protección de la purga solo miraba `id_caso`/`id_averia` del
  /// payload. Las acciones de `DIFERIDO_EVIDENCIAS` llevan únicamente
  /// `evidencias`, así que su caso **no** quedaba protegido y la purga podía
  /// borrarlo con su trabajo pendiente. Ahora también se deduce del **endpoint**
  /// (`/casos/{id}/…`), que esa acción sí trae, de modo que las filas ya
  /// encoladas en los dispositivos quedan cubiertas sin migración.
  static Set<String> clavesDeAccion({
    required Map<String, dynamic> payload,
    required String endpoint,
  }) {
    final claves = <String>{};

    void anotar(dynamic valor) {
      final texto = '${valor ?? ''}'.trim();
      if (texto.isNotEmpty && texto != '0') claves.add(texto);
    }

    anotar(payload['id_caso']);
    anotar(payload['id_averia']);
    final enRuta = RegExp(r'/casos/(\d+)').firstMatch(endpoint);
    if (enRuta != null) anotar(enRuta.group(1));
    return claves;
  }

  /// D-115: ¿procede purgar en esta descarga?
  ///
  /// La actualización purga **siempre** que el servidor haya resuelto una
  /// cuadrilla de campo, aunque todavía no haya despacho publicado del día: el
  /// técnico no debe arrastrar casos no atendidos. No se purga cuando no hay
  /// cuadrilla (`SIN_CUADRILLA`/`SIN_TECNICO`) ni en la **cuadrilla 0** de
  /// gestión (`CUADRILLA_GESTION`), porque no son trabajo de campo.
  static bool procede({required String motivo, required bool cuadrillaResuelta}) {
    if (!cuadrillaResuelta) return false;
    return motivo != 'CUADRILLA_GESTION';
  }

  /// Averías que deben borrarse de la caché local.
  ///
  /// `idsVigentes` e `idsDescargados` (D-119) son conjuntos de `id_caso` que
  /// **nunca** se borran: son el trabajo que el servidor reconoce y lo que esta
  /// misma descarga acaba de entregar.
  static List<String> planificar({
    required List<Map<String, dynamic>> locales,
    required Set<int> idsDelDia,
    required Set<String> protegidos,
    Set<int> idsVigentes = const {},
    Set<int> idsDescargados = const {},
  }) {
    final borrar = <String>[];
    for (final fila in locales) {
      final clave = '${fila['id'] ?? ''}'.trim();
      if (clave.isEmpty) continue;
      // Trabajo sin enviar (por avería o por identificador numérico).
      if (protegidos.contains(clave)) continue;
      final idCaso = fila['id_caso'];
      if (idCaso != null && protegidos.contains('$idCaso')) continue;
      if (idCaso is int) {
        // Del despacho de hoy: se queda.
        if (idsDelDia.contains(idCaso)) continue;
        // D-119: trabajo vigente de la cuadrilla o recién descargado: se queda.
        if (idsVigentes.contains(idCaso)) continue;
        if (idsDescargados.contains(idCaso)) continue;
      }
      // Ya atendido por la cuadrilla: se queda.
      if (estaGestionado('${fila['estado'] ?? ''}')) continue;
      borrar.add(clave);
    }
    return borrar;
  }

  /// Ejecuta la purga contra la caché local.
  ///
  /// Devuelve cuántos casos se borraron. **Solo debe llamarse cuando el servidor
  /// resolvió una cuadrilla de campo** (`PurgaDespachos.procede`, D-115): sin
  /// cuadrilla no se toca el dispositivo.
  static Future<int> ejecutar({
    required Set<int> idsDelDia,
    Set<int> idsVigentes = const {},
    Set<int> idsDescargados = const {},
  }) async {
    final db = DatabaseHelper.instance;
    final locales = await db.casosParaPurga();
    final protegidos = await db.clavesConTrabajoPendiente();
    final borrar = planificar(
      locales: locales,
      idsDelDia: idsDelDia,
      protegidos: protegidos,
      idsVigentes: idsVigentes,
      idsDescargados: idsDescargados,
    );
    if (borrar.isEmpty) return 0;
    return db.borrarCasos(borrar);
  }
}
