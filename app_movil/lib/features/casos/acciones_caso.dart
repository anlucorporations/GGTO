/// Acciones del PIE de la ficha según el estado del caso (D-87 · RF-APK-06).
///
/// Era el defecto M-06: la ficha ofrecía «Contactar / Agendar cita» **siempre**,
/// incluso con el caso ya contactado. Aquí vive la regla, aislada y probable.
library;

/// Acciones que el técnico puede ejecutar desde la ficha.
enum AccionCaso {
  /// NUEVO / ASIGNADO / EN_GESTION: registrar el contacto con el cliente (RF-12).
  marcarContactado,

  /// NUEVO / ASIGNADO / EN_GESTION: el cliente **no contesta** (D-88 · RF-APK-12):
  /// el caso pasa a `CITADO` con cita de 1ra visita e informado al COS.
  noContesta,

  /// NUEVO / ASIGNADO / EN_GESTION: agendar una cita.
  agendarCita,

  /// CONTACTADO / CITADO: atender (cerrar, enrutar o diferir).
  atender,
}

/// Estados terminales: el caso no admite gestiones nuevas desde la APK.
const Set<String> estadosCerrados = {'CERRADO', 'CANCELADO', 'ENRUTADO'};

/// Explicación que el PIE muestra cuando no hay acciones disponibles.
const Map<String, String> notasPorEstado = {
  'CERRADO': 'El caso está cerrado: no admite nuevas gestiones desde la app.',
  'CANCELADO': 'El caso está cancelado: no admite nuevas gestiones desde la app.',
  'ENRUTADO': 'El caso fue enrutado a otra instancia.',
  'DIFERIDO': 'El caso está diferido: se retoma cuando el despacho lo reactive.',
};

/// Acciones que el PIE debe ofrecer para [estado].
Set<AccionCaso> accionesDeEstado(String estado) {
  switch (estado.trim().toUpperCase()) {
    case 'NUEVO':
    case 'ASIGNADO':
    case 'EN_GESTION':
      return {
        AccionCaso.marcarContactado,
        AccionCaso.noContesta,
        AccionCaso.agendarCita,
      };
    case 'CONTACTADO':
    case 'CITADO':
      return {AccionCaso.atender};
    default:
      return {};
  }
}

/// ¿El estado admite editar la dirección y el número de contacto?
///
/// D-87 deja el icono **Editar** en la cabecera (M-07); la edición real llega en
/// D-88, porque `PATCH /casos/{id}` exige ADMIN/SUPERVISOR y hace falta un camino
/// para el técnico (RF-APK-11).
bool puedeEditarContacto(String estado) =>
    !estadosCerrados.contains(estado.trim().toUpperCase());

/// Nota del PIE para un estado sin acciones (o `null` si no aplica).
String? notaDeEstado(String estado) => notasPorEstado[estado.trim().toUpperCase()];

// --------------------------------------------------------------------------- #
// Edición del contacto desde el campo (D-88 · RF-APK-11)
// --------------------------------------------------------------------------- #

/// Serie de los números de contacto de CANTV que admite la ficha.
const List<String> seriesTelefono = ['700', '701', '702'];

/// Normaliza el número de contacto (quita espacios, guiones y paréntesis).
///
/// Devuelve `null` si no es de la serie **700/701/702** con 10 dígitos: la misma
/// regla que valida el servidor en `PATCH /casos/{id}/contacto`.
String? normalizarTelefono(String valor) {
  final limpio = valor.replaceAll(RegExp(r'[\s\-().]'), '');
  if (limpio.length != 10 || !RegExp(r'^\d{10}$').hasMatch(limpio)) return null;
  if (!seriesTelefono.any(limpio.startsWith)) return null;
  return limpio;
}

/// Mensaje de error del teléfono, o `null` si está bien (o vacío).
String? errorTelefono(String valor) {
  if (valor.trim().isEmpty) return null;
  if (normalizarTelefono(valor) == null) {
    return 'El número de contacto debe ser de la serie 700, 701 o 702 (10 dígitos).';
  }
  return null;
}

/// Mensaje de error de la dirección, o `null` si está bien (o vacía).
String? errorDireccion(String valor) {
  if (valor.trim().isEmpty) return null;
  if (valor.trim().length < 5) return 'La dirección indicada es demasiado corta.';
  return null;
}

/// Cita de 1ra visita propuesta por «No Contesta»: **mañana a las 08:00**.
///
/// Se calcula en la zona del dispositivo (el técnico está en campo) y se envía en
/// ISO al servidor, que la guarda en UTC.
DateTime citaDeNoContesta({DateTime? ahora}) {
  final base = (ahora ?? DateTime.now()).add(const Duration(days: 1));
  return DateTime(base.year, base.month, base.day, 8);
}
