/// Política y operaciones del acceso sin conexión (D-100 · RF-73…RF-75).
///
/// Reglas del incremento:
///
/// * **Solo el rol TÉCNICO** puede entrar sin red; los roles de gestión siempre
///   exigen conexión (DEC-PIN-1).
/// * La credencial se emite en cada inicio de sesión **con red** correcto.
/// * El PIN arranca en [AppConstants.pinPorDefecto] para las cuentas **ya dadas
///   de alta** y **obliga a cambiarlo** la primera vez que se usa (DEC-PIN-2).
/// * La credencial **caduca a las 24 h** sin conexión (DEC-PIN-3).
/// * El PIN nunca se guarda: solo su verificador PBKDF2 con sal.
library;

import '../../core/constants.dart';
import '../../core/credencial_local.dart';
import '../../core/pin_hash.dart';
import '../../core/sesion.dart';

/// Motivo por el que un intento de acceso sin conexión no concedió la sesión.
enum EstadoPin {
  /// PIN correcto y ya personalizado: se puede abrir la sesión cacheada.
  ok,

  /// PIN correcto pero **de fábrica**: hay que definir uno nuevo antes de entrar.
  requiereCambio,

  /// El dispositivo no tiene ninguna credencial emitida.
  credencialAusente,

  /// Hay credenciales, pero ninguna de ese P00.
  usuarioSinCredencial,

  /// La credencial superó las 24 h sin conexión.
  caducada,

  /// El PIN no coincide.
  pinIncorrecto,

  /// Demasiados intentos fallidos: la ficha quedó invalidada.
  bloqueada,

  /// No hay sesión cacheada que restaurar (se cerró sesión o expiró el token).
  sinSesionGuardada,

  /// La sesión cacheada es de **otro** usuario distinto del de la credencial.
  ///
  /// Ocurre en dispositivos compartidos: entrar con la credencial de A usando el
  /// token que dejó B sería un salto de identidad, así que se rechaza.
  sesionIncoherente,
}

/// Resultado de verificar el PIN local.
class ResultadoPin {
  const ResultadoPin(this.estado, this.mensaje, {this.intentosRestantes = 0});

  final EstadoPin estado;
  final String mensaje;
  final int intentosRestantes;

  /// El PIN es válido y ya está personalizado.
  bool get concedido => estado == EstadoPin.ok;

  /// El PIN es válido pero es el de fábrica: hay que cambiarlo.
  bool get exigeCambio => estado == EstadoPin.requiereCambio;

  @override
  String toString() => 'ResultadoPin(${estado.name})';
}

/// Comprueba el **formato** de un PIN. Devuelve `null` si es aceptable.
String? validarFormatoPin(String pin) {
  final limpio = pin.trim();
  if (limpio.isEmpty) return 'Indique el PIN.';
  if (limpio.length != AppConstants.pinLongitud) {
    return 'El PIN debe tener ${AppConstants.pinLongitud} dígitos.';
  }
  if (!RegExp(r'^\d+$').hasMatch(limpio)) return 'El PIN solo admite dígitos.';
  return null;
}

/// Valida el **cambio** de PIN y devuelve `null` si procede.
///
/// Se exige que el nuevo PIN tenga el formato correcto, que coincida con la
/// confirmación, que no repita el actual y que **no sea el de fábrica** —si no,
/// el cambio no aportaría nada y cualquiera con el dispositivo podría entrar—.
String? validarPinNuevo({
  required String nuevo,
  required String confirmacion,
  required String actual,
}) {
  final error = validarFormatoPin(nuevo);
  if (error != null) return error;
  if (nuevo.trim() != confirmacion.trim()) return 'Los dos PIN no coinciden.';
  if (nuevo.trim() == actual.trim()) return 'El PIN nuevo debe ser distinto del actual.';
  if (nuevo.trim() == AppConstants.pinPorDefecto) {
    return 'No puede quedarse con el PIN de fábrica: elija uno propio.';
  }
  if (RegExp(r'^(\d)\1+$').hasMatch(nuevo.trim())) {
    return 'El PIN no puede ser un dígito repetido.';
  }
  return null;
}

/// Resultado de evaluar el PIN **sin** tocar el almacenamiento.
class EvaluacionPin {
  const EvaluacionPin(this.resultado, {this.ficha});

  final ResultadoPin resultado;

  /// Ficha actualizada que hay que persistir (`null` = no cambió nada).
  final CredencialLocal? ficha;
}

/// Evalúa un intento de PIN contra el documento, **sin efectos secundarios**.
///
/// Es la política completa del acceso sin conexión —incluido el cómputo de
/// intentos fallidos y la caducidad— separada del almacén para poder probarla.
EvaluacionPin evaluarPin({
  required DocumentoCredencial documento,
  required String p00,
  required String pin,
  required DateTime ahora,
  Duration? vigenciaPin,
  int maxIntentos = AppConstants.maxIntentos,
}) {
  final vence = vigenciaPin ?? CredencialService.vigencia;
  if (documento.vacio) {
    return const EvaluacionPin(ResultadoPin(
      EstadoPin.credencialAusente,
      'Este dispositivo no tiene acceso sin conexión configurado. '
      'Conéctese a internet e inicie sesión una vez.',
    ));
  }

  final ficha = documento.buscar(p00);
  if (ficha == null) {
    return const EvaluacionPin(ResultadoPin(
      EstadoPin.usuarioSinCredencial,
      'No hay acceso sin conexión para ese P00 en este dispositivo. '
      'Conéctese a internet e inicie sesión una vez.',
    ));
  }

  if (ficha.intentosFallidos >= maxIntentos) {
    return const EvaluacionPin(ResultadoPin(
      EstadoPin.bloqueada,
      'Acceso sin conexión bloqueado por intentos fallidos. '
      'Conéctese a internet e inicie sesión de nuevo.',
    ));
  }

  if (!ficha.vigente(ahora, vigencia: vence)) {
    return const EvaluacionPin(ResultadoPin(
      EstadoPin.caducada,
      'El acceso sin conexión caducó (${AppConstants.credencialOfflineHoras} h). '
      'Conéctese a internet e inicie sesión para renovarlo.',
    ));
  }

  if (!ficha.comprobarPin(pin)) {
    final fallos = ficha.intentosFallidos + 1;
    final restantes = (maxIntentos - fallos).clamp(0, maxIntentos);
    if (fallos >= maxIntentos) {
      return EvaluacionPin(
        const ResultadoPin(
          EstadoPin.bloqueada,
          'PIN incorrecto. Se agotaron los intentos: el acceso sin conexión quedó '
          'bloqueado. Conéctese a internet e inicie sesión de nuevo.',
        ),
        ficha: ficha.copyWith(intentosFallidos: fallos),
      );
    }
    return EvaluacionPin(
      ResultadoPin(
        EstadoPin.pinIncorrecto,
        'PIN incorrecto. Le quedan $restantes intento(s).',
        intentosRestantes: restantes,
      ),
      ficha: ficha.copyWith(intentosFallidos: fallos),
    );
  }

  if (ficha.pinPorDefecto) {
    return const EvaluacionPin(ResultadoPin(
      EstadoPin.requiereCambio,
      'Está usando el PIN de fábrica: defina uno propio para continuar.',
    ));
  }

  return EvaluacionPin(
    const ResultadoPin(EstadoPin.ok, 'Acceso sin conexión concedido.'),
    ficha: ficha.intentosFallidos == 0 ? null : ficha.copyWith(intentosFallidos: 0),
  );
}

/// Operaciones sobre el documento de credencial del dispositivo.
class CredencialService {
  CredencialService._();

  /// Vigencia de la credencial sin conexión.
  static Duration get vigencia =>
      const Duration(hours: AppConstants.credencialOfflineHoras);

  /// Registra un acceso **con red** correcto: emite o renueva la ficha.
  ///
  /// Solo el rol TÉCNICO accede sin conexión, así que para el resto de roles
  /// esta operación no hace nada.
  static Future<void> registrarAccesoConRed(
    SesionUsuario usuario, {
    DateTime? ahora,
  }) async {
    if (usuario.rol != 'TECNICO' || usuario.p00.trim().isEmpty) return;
    final momento = (ahora ?? DateTime.now()).toUtc();
    final documento = await CredencialStore.leer();
    final existente = documento.buscar(usuario.p00);
    final ficha = existente == null
        ? CredencialLocal.nueva(
            usuario: usuario,
            pin: AppConstants.pinPorDefecto,
            ahora: momento,
            sal: null,
          )
        : existente.renovada(usuario, momento);
    await CredencialStore.guardar(documento.con(ficha));
  }

  /// Devuelve la ficha del P00 indicado, o `null`.
  static Future<CredencialLocal?> ficha(String p00) async {
    final documento = await CredencialStore.leer();
    return documento.buscar(p00);
  }

  /// ¿Hay alguna credencial emitida en el dispositivo?
  static Future<bool> hayCredencial() async {
    final documento = await CredencialStore.leer();
    return !documento.vacio;
  }

  /// Verifica el PIN de una ficha **sin** abrir la sesión.
  ///
  /// Contabiliza los intentos fallidos y, al agotarlos, invalida la ficha para
  /// que solo quede la vía de la conexión. La política vive en [evaluarPin].
  static Future<ResultadoPin> verificar({
    required String p00,
    required String pin,
    DateTime? ahora,
  }) async {
    final momento = (ahora ?? DateTime.now()).toUtc();
    final documento = await CredencialStore.leer();
    final evaluacion = evaluarPin(
      documento: documento,
      p00: p00,
      pin: pin,
      ahora: momento,
    );
    final ficha = evaluacion.ficha;
    if (ficha != null) {
      await CredencialStore.guardar(documento.con(ficha));
    }
    return evaluacion.resultado;
  }

  /// Cambia el PIN de la ficha (deja de ser el de fábrica).
  ///
  /// Devuelve `null` si se guardó, o el motivo del rechazo.
  static Future<String?> cambiarPin({
    required String p00,
    required String nuevoPin,
  }) async {
    final error = validarFormatoPin(nuevoPin);
    if (error != null) return error;
    if (nuevoPin.trim() == AppConstants.pinPorDefecto) {
      return 'No puede quedarse con el PIN de fábrica: elija uno propio.';
    }
    final documento = await CredencialStore.leer();
    final ficha = documento.buscar(p00);
    if (ficha == null) {
      return 'No hay acceso sin conexión para ese P00 en este dispositivo.';
    }
    final sal = generarSal();
    await CredencialStore.guardar(
      documento.con(ficha.copyWith(
        sal: sal,
        verificador: derivarPin(nuevoPin.trim(), sal),
        pinPorDefecto: false,
        intentosFallidos: 0,
      )),
    );
    return null;
  }

  /// Descarta la ficha del P00 indicado (olvido del PIN, baja del técnico).
  static Future<void> olvidar(String p00) async {
    final documento = await CredencialStore.leer();
    await CredencialStore.guardar(documento.sin(p00));
  }

  /// Descarta **todas** las fichas del dispositivo (cierre de sesión forzado).
  static Future<void> olvidarTodo() => CredencialStore.borrar();
}
