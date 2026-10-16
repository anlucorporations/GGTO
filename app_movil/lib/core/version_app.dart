/// Comparación de versiones de la APK (D-102 · chequeo de la última versión).
///
/// La versión visible del proyecto tiene la forma `nombre+codigo` —por ejemplo
/// `1.4.0+13`—, donde el **código** (`versionCode` de Android) es el número que
/// el proyecto sube en **cada** entrega a CANTV (`pubspec.yaml:4`).
///
/// Este archivo es **puro**: no depende de Flutter ni de la red, así que la
/// regla de «hay actualización» se puede probar sin dispositivo (RT-27).
library;

/// Versión interpretada: texto original, nombre `x.y.z` y código entero.
class VersionApp {
  const VersionApp({
    required this.texto,
    required this.nombre,
    required this.codigo,
  });

  /// Texto tal como viene en `pubspec.yaml` o en `apk.json` (p. ej. `1.4.0+13`).
  final String texto;

  /// Parte del nombre, sin el `+codigo` (p. ej. `1.4.0`).
  final String nombre;

  /// `versionCode` de Android; `0` si la cadena no lo trae.
  final int codigo;

  /// Interpreta `1.4.0+13`, `1.4.0` o `v1.4.0+13`. Devuelve `null` si el texto
  /// no tiene al menos un número de versión reconocible.
  static VersionApp? parsear(String? texto) {
    if (texto == null) return null;
    final limpio = texto.trim().replaceFirst(RegExp(r'^[vV]'), '');
    if (limpio.isEmpty) return null;

    final partes = limpio.split('+');
    final nombre = partes.first.trim();
    if (!RegExp(r'^\d+(\.\d+)*$').hasMatch(nombre)) return null;

    final codigo = partes.length > 1 ? int.tryParse(partes[1].trim()) ?? 0 : 0;
    return VersionApp(texto: limpio, nombre: nombre, codigo: codigo);
  }

  /// Compara dos nombres `x.y.z` componente a componente.
  static int compararNombres(String a, String b) {
    final izq = a.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final der = b.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final largo = izq.length > der.length ? izq.length : der.length;
    for (var i = 0; i < largo; i++) {
      final x = i < izq.length ? izq[i] : 0;
      final y = i < der.length ? der[i] : 0;
      if (x != y) return x.compareTo(y);
    }
    return 0;
  }
}

/// Resultado del chequeo, con el motivo en lenguaje llano para la interfaz.
class ComparacionVersion {
  const ComparacionVersion({
    required this.hayActualizacion,
    required this.instalada,
    required this.disponible,
    required this.motivo,
  });

  final bool hayActualizacion;
  final VersionApp? instalada;
  final VersionApp? disponible;

  /// Explicación corta del veredicto (para mostrar al técnico).
  final String motivo;
}

/// Decide si la versión `disponible` en el servidor es más nueva que la
/// `instalada` en el dispositivo.
///
/// Regla (D-102):
///  1. Se comparan los **códigos** (`+N`); si el remoto es mayor, hay
///     actualización. Es la regla que el proyecto ya sigue al entregar.
///  2. Si los códigos son iguales (o ninguno trae código), se compara el
///     **nombre** `x.y.z`.
///  3. Un texto que no se puede interpretar **no** se anuncia como
///     actualización: se informa de que no se pudo comprobar.
ComparacionVersion compararVersiones({
  required String instalada,
  required String disponible,
}) {
  final local = VersionApp.parsear(instalada);
  final remota = VersionApp.parsear(disponible);

  if (local == null || remota == null) {
    return ComparacionVersion(
      hayActualizacion: false,
      instalada: local,
      disponible: remota,
      motivo: 'No se pudo interpretar la versión publicada.',
    );
  }

  if (remota.codigo != local.codigo) {
    final hay = remota.codigo > local.codigo;
    return ComparacionVersion(
      hayActualizacion: hay,
      instalada: local,
      disponible: remota,
      motivo: hay
          ? 'Hay una versión más reciente (compilación ${remota.codigo} > ${local.codigo}).'
          : 'Su versión es igual o más reciente que la publicada.',
    );
  }

  final orden = VersionApp.compararNombres(remota.nombre, local.nombre);
  return ComparacionVersion(
    hayActualizacion: orden > 0,
    instalada: local,
    disponible: remota,
    motivo: orden > 0
        ? 'Hay una versión más reciente (${remota.nombre} > ${local.nombre}).'
        : 'Su versión es igual o más reciente que la publicada.',
  );
}
