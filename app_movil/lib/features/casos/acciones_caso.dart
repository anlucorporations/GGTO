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
// Edición del contacto desde el campo (D-88 · RF-APK-11 · D-93)
// --------------------------------------------------------------------------- #

/// Patrón del **identificador de pago** (70\\*), el mismo valor por defecto del
/// servidor (`configuracion.pago.serie_regex`, DEC-IP-1).
///
/// La APK no lee la configuración del servidor: sirve para **rotular** el dato y
/// para avisar al técnico; la validación de negocio es responsabilidad del
/// servidor.
final RegExp patronIdentificadorPago = RegExp(r'^70\d{8}$');

/// Normaliza un número igual que el servidor (RN-IP-07): solo dígitos, sin
/// prefijo internacional (`0058`, `58`) ni el `0` inicial.
String normalizarNumero(String valor) {
  var digitos = valor.replaceAll(RegExp(r'\D'), '');
  if (digitos.startsWith('0058')) {
    digitos = digitos.substring(4);
  } else if (digitos.startsWith('58') && digitos.length >= 12) {
    digitos = digitos.substring(2);
  }
  if (digitos.length == 11 && digitos.startsWith('0')) {
    digitos = digitos.substring(1);
  }
  return digitos;
}

/// ¿El valor es un **identificador de pago** (70\\*)?
///
/// D-93/DEC-IP-7: si el técnico lo teclea en el campo de contacto, el servidor lo
/// registra como **identificador del caso** (no como contacto) y la APK se lo
/// informa.
bool esIdentificadorPago(String valor) =>
    patronIdentificadorPago.hasMatch(normalizarNumero(valor));

/// Mensaje de error del **número de contacto**, o `null` si está bien (o vacío).
///
/// Desde D-93 cualquier número es un contacto válido: el 70\\* dejó de ser «el
/// número de contacto» (es el identificador de pago) y las series 700/701/702 ya
/// no son una restricción de la ficha.
String? errorNumeroContacto(String valor) {
  if (valor.trim().isEmpty) return null;
  if (normalizarNumero(valor).isEmpty) {
    return 'Indique un número de contacto válido.';
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
