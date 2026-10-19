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
/// D-115: la **actualización completa** ejecuta esta purga en cuanto el servidor
/// resuelve una cuadrilla de campo (`procede`), aunque todavía no haya despacho
/// del día; en ese caso `idsDelDia` viene vacío y se borran todos los no atendidos.
///
/// La decisión vive en una **función pura** (RT-29) para poder probarla sin
/// SQLite, igual que `planMergeMasivas` (D-99).
class PurgaDespachos {
  const PurgaDespachos._();

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
  static List<String> planificar({
    required List<Map<String, dynamic>> locales,
    required Set<int> idsDelDia,
    required Set<String> protegidos,
  }) {
    final borrar = <String>[];
    for (final fila in locales) {
      final clave = '${fila['id'] ?? ''}'.trim();
      if (clave.isEmpty) continue;
      // Trabajo sin enviar (por avería o por identificador numérico).
      if (protegidos.contains(clave)) continue;
      final idCaso = fila['id_caso'];
      if (idCaso != null && protegidos.contains('$idCaso')) continue;
      // Del despacho de hoy: se queda.
      if (idCaso is int && idsDelDia.contains(idCaso)) continue;
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
  static Future<int> ejecutar({required Set<int> idsDelDia}) async {
    final db = DatabaseHelper.instance;
    final locales = await db.casosParaPurga();
    final protegidos = await db.clavesConTrabajoPendiente();
    final borrar = planificar(
      locales: locales,
      idsDelDia: idsDelDia,
      protegidos: protegidos,
    );
    if (borrar.isEmpty) return 0;
    return db.borrarCasos(borrar);
  }
}
