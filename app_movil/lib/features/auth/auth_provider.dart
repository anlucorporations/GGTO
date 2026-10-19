import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';
import '../../core/auth_storage.dart';
import '../../core/constants.dart';
import '../../core/credencial_local.dart';
import '../../core/sesion.dart';
import 'credencial_service.dart';

/// Estado de autenticación y sesión del usuario.
///
/// Corrige los defectos H-06/H-15/H-17/H-18 del informe de la APK: distingue el
/// error real del servidor, **no cuenta los fallos de red** como intentos
/// fallidos, guarda la sesión para arrancar sin conexión y cierra la sesión
/// cuando el token expira.
///
/// D-100: añade el **acceso sin conexión con PIN local** para el rol TÉCNICO.
class AuthProvider extends ChangeNotifier {
  SesionUsuario? _usuario;
  String? _token;
  int _intentosFallidos = 0;
  bool _bloqueado = false;
  bool _cargando = false;
  String? _ultimoError;
  bool _offline = false;
  /// D-117: `true` solo cuando el usuario abrió la sesión en esta ejecución
  /// (login o PIN); no cuando `restaurarSesion` recupera un token al arrancar.
  /// El bloqueo por inactividad no debe cubrir la pantalla de acceso.
  bool _sesionActiva = false;

  SesionUsuario? get usuario => _usuario;
  String? get p00 => _usuario?.p00;
  String get nombre => _usuario?.nombreCompleto ?? '';
  String get rol => _usuario?.rol ?? '';
  bool get autenticado =>
      _offline || (_token != null && _token!.isNotEmpty);
  bool get cargando => _cargando;
  int get intentosFallidos => _intentosFallidos;
  int get intentosRestantes =>
      (AppConstants.maxIntentos - _intentosFallidos).clamp(0, AppConstants.maxIntentos);
  bool get bloqueado => _bloqueado;
  String? get ultimoError => _ultimoError;

  /// `true` si la sesión actual se abrió **sin conexión** (D-100).
  bool get offline => _offline;

  /// D-117: `true` si el usuario abrió la sesión en esta ejecución. Es la
  /// condición para armar el bloqueo por inactividad (no en el acceso).
  bool get sesionActiva => _sesionActiva;

  /// Recupera la sesión guardada al arrancar (permite entrar **sin conexión**).
  Future<void> restaurarSesion() async {
    _token = await AuthStorage.getToken();
    _usuario = await AuthStorage.getSesion();
    notifyListeners();
  }

  /// Intenta renovar la sesión contra el servidor; si el token ya no vale, la cierra.
  /// Devuelve `true` si la sesión sigue siendo válida o si no hay red (offline).
  Future<bool> validarSesionRemota() async {
    if (!autenticado) return false;
    try {
      final datos = await ApiClient.get('/auth/me');
      if (datos is Map) {
        _usuario = SesionUsuario.fromJson(Map<String, dynamic>.from(datos));
        await AuthStorage.guardarSesion(_token!, _usuario!);
        // D-100: con red, la credencial local renueva su vigencia de 24 h.
        await CredencialService.registrarAccesoConRed(_usuario!);
        _offline = false;
        notifyListeners();
        return true;
      }
      return false;
    } on ApiError catch (error) {
      if (error.esDeRed) return true; // sin red se conserva la sesión cacheada
      await cerrarSesion();
      return false;
    }
  }

  /// Inicia sesión con P00 y clave. Devuelve `null` si tuvo éxito, o el motivo.
  Future<String?> login(String p00, String clave) async {
    _ultimoError = null;
    _cargando = true;
    notifyListeners();

    try {
      final datos = await ApiClient.post('/auth/login', data: {
        'p00': p00.trim(),
        'clave': clave,
      });
      if (datos is! Map) {
        _ultimoError = 'Respuesta inesperada del servidor.';
        return _ultimoError;
      }

      final token = '${datos['access_token'] ?? ''}';
      if (token.isEmpty) {
        _ultimoError = 'El servidor no devolvió un token de sesión.';
        return _ultimoError;
      }

      final bruto = datos['usuario'];
      _usuario = bruto is Map
          ? SesionUsuario.fromJson(Map<String, dynamic>.from(bruto))
          : SesionUsuario(p00: p00.trim(), nombre: '', apellido: '', correo: '', rol: '');

      _token = token;
      _intentosFallidos = 0;
      _bloqueado = false;
      _offline = false;
      _sesionActiva = true;
      await AuthStorage.guardarSesion(token, _usuario!);
      // D-100: el acceso con red emite (o renueva) la credencial local del
      // técnico, con su PIN y la vigencia de 24 h.
      await CredencialService.registrarAccesoConRed(_usuario!);
      return null;
    } on ApiError catch (error) {
      // Un fallo de red NO consume intentos (H-15).
      if (!error.esDeRed) {
        if (error.estaBloqueado) {
          _bloqueado = true;
          _intentosFallidos = AppConstants.maxIntentos;
        } else if (error.esCredencial) {
          _intentosFallidos = error.intentosRestantes != null
              ? AppConstants.maxIntentos - error.intentosRestantes!
              : _intentosFallidos + 1;
          if (_intentosFallidos >= AppConstants.maxIntentos) _bloqueado = true;
        } else if (error.demasiadosIntentos) {
          // Límite de peticiones: no altera el contador de intentos de la cuenta.
          _ultimoError = error.mensaje;
          return error.mensaje;
        }
      }
      _ultimoError = error.mensaje;
      return error.mensaje;
    } catch (error) {
      _ultimoError = 'Error inesperado al iniciar sesión.';
      return '$_ultimoError ($error)';
    } finally {
      _cargando = false;
      notifyListeners();
    }
  }

  /// Desbloquea la cuenta con 3 de las 12 palabras y, si procede, inicia sesión.
  ///
  /// `POST /auth/unlock` **no devuelve token** (H-06): se encadena el login con
  /// la clave recién introducida por el usuario.
  Future<String?> desbloquear({
    required String p00,
    required List<Map<String, dynamic>> palabras,
    required String clave,
  }) async {
    _ultimoError = null;
    _cargando = true;
    notifyListeners();
    try {
      final datos = await ApiClient.post('/auth/unlock', data: {
        'p00': p00.trim(),
        'palabras': palabras,
      });
      final mensaje = datos is Map ? '${datos['mensaje'] ?? ''}'.trim() : '';

      _bloqueado = false;
      _intentosFallidos = 0;
      notifyListeners();

      // Encadena el acceso: desbloquear no emite token.
      final error = await login(p00, clave);
      if (error == null) {
        return null;
      }
      final aviso = mensaje.isEmpty ? '' : '$mensaje ';
      return '${aviso}No se pudo iniciar sesión: $error';
    } on ApiError catch (error) {
      _ultimoError = error.mensaje;
      return error.mensaje;
    } catch (error) {
      _ultimoError = 'Error inesperado al desbloquear.';
      return '$_ultimoError ($error)';
    } finally {
      _cargando = false;
      notifyListeners();
    }
  }

  /// Consulta si el P00 puede completar su primer acceso (D-67).
  Future<Map<String, dynamic>?> primerAcceso(String p00) async {
    try {
      final datos = await ApiClient.get('/auth/primer-acceso', query: {'p00': p00.trim()});
      if (datos is Map) return Map<String, dynamic>.from(datos);
      return null;
    } on ApiError catch (error) {
      _ultimoError = error.mensaje;
      return null;
    }
  }

  /// Crea la cuenta en el primer acceso y devuelve las 12 palabras.
  Future<List<String>?> crearAcceso({
    required String p00,
    required String correo,
    required String clave,
    required String confirmacion,
  }) async {
    try {
      final datos = await ApiClient.post('/auth/setup', data: {
        'p00': p00.trim(),
        'correo': correo.trim(),
        'clave': clave,
        'confirmacion': confirmacion,
      });
      if (datos is Map && datos['palabras'] is List) {
        return (datos['palabras'] as List).map((p) => '$p').toList();
      }
      return null;
    } on ApiError catch (error) {
      _ultimoError = error.mensaje;
      return null;
    }
  }

  /// Refresca los datos del usuario desde el servidor (si hay red).
  Future<void> fetchMe() async {
    try {
      final datos = await ApiClient.get('/auth/me');
      if (datos is Map && _token != null) {
        _usuario = SesionUsuario.fromJson(Map<String, dynamic>.from(datos));
        await AuthStorage.guardarSesion(_token!, _usuario!);
        // D-100: hay red, así que la credencial local renueva su vigencia.
        await CredencialService.registrarAccesoConRed(_usuario!);
        _offline = false;
        notifyListeners();
      }
    } on ApiError {
      // Sin red se conserva la sesión cacheada; no es un error para el usuario.
    }
  }

  // --------------------------------------------------------------------- //
  // D-100 · Acceso sin conexión con PIN local                              //
  // --------------------------------------------------------------------- //

  /// Verifica el PIN local de un P00 **sin** abrir la sesión.
  ///
  /// Solo el rol TÉCNICO tiene credencial: para cualquier otro P00 devuelve
  /// `usuarioSinCredencial` (los roles de gestión siempre exigen conexión).
  Future<ResultadoPin> verificarPinLocal(String p00, String pin) =>
      CredencialService.verificar(p00: p00, pin: pin);

  /// ¿Hay alguna credencial de acceso sin conexión en este dispositivo?
  Future<bool> hayCredencialLocal() => CredencialService.hayCredencial();

  /// Devuelve la ficha del P00 indicado, o `null`.
  Future<CredencialLocal?> credencialDe(String p00) => CredencialService.ficha(p00);

  /// Abre la **sesión cacheada** tras validar el PIN (D-100).
  ///
  /// No toca el servidor. Exige que la identidad guardada sea del mismo P00 que
  /// la credencial: en un dispositivo compartido, abrir la credencial de un
  /// técnico con la identidad que dejó otro sería un salto de identidad.
  ///
  /// El **token es opcional**: sin conexión no hace falta, y tras una caducidad
  /// se descarta el token pero se conserva la identidad justamente para que este
  /// camino siga funcionando dentro de las 24 h de vigencia.
  Future<ResultadoPin> entrarSinConexion(String p00) async {
    final ficha = await CredencialService.ficha(p00);
    if (ficha == null) {
      return const ResultadoPin(
        EstadoPin.usuarioSinCredencial,
        'No hay acceso sin conexión para ese P00 en este dispositivo.',
      );
    }
    final sesion = await AuthStorage.getSesion();
    if (sesion == null) {
      return const ResultadoPin(
        EstadoPin.sinSesionGuardada,
        'No hay una sesión guardada que abrir. Conéctese a internet e inicie '
        'sesión una vez para habilitar el acceso sin conexión.',
      );
    }
    if (sesion.p00.toUpperCase() != ficha.p00.toUpperCase()) {
      return const ResultadoPin(
        EstadoPin.sesionIncoherente,
        'La sesión guardada es de otro usuario. Conéctese a internet e inicie '
        'sesión con su P00.',
      );
    }

    _token = await AuthStorage.getToken();
    _usuario = sesion;
    _intentosFallidos = 0;
    _bloqueado = false;
    _offline = true;
    _sesionActiva = true;
    notifyListeners();
    return const ResultadoPin(EstadoPin.ok, 'Sesión abierta sin conexión.');
  }

  /// Cambia el PIN del acceso sin conexión. Devuelve `null` si se guardó.
  Future<String?> cambiarPinLocal(String p00, String nuevoPin) =>
      CredencialService.cambiarPin(p00: p00, nuevoPin: nuevoPin);

  /// D-117: restablece el PIN al de **fábrica** conservando la credencial.
  ///
  /// El próximo uso del acceso sin conexión exigirá cambiarlo. Devuelve `null`
  /// si se guardó, o el motivo del rechazo.
  Future<String?> restablecerPinLocal(String p00) =>
      CredencialService.restablecerPin(p00);

  /// Descarta la credencial del P00 (olvido del PIN).
  Future<void> olvidarCredencial(String p00) async {
    await CredencialService.olvidar(p00);
    notifyListeners();
  }

  /// Cierra la sesión y borra el token (también al expirar).
  ///
  /// **Conserva** la credencial local: el PIN ya configurado se reutiliza en el
  /// siguiente acceso con red. Si se quiere revocar el acceso sin conexión hay
  /// que usar «Olvidé mi PIN» en el acceso o «Restablecer» en la sección Usuario.
  Future<void> cerrarSesion() async {
    await AuthStorage.limpiarSesion();
    _token = null;
    _usuario = null;
    _intentosFallidos = 0;
    _bloqueado = false;
    _offline = false;
    _sesionActiva = false;
    notifyListeners();
  }

  /// Marca la cuenta como bloqueada localmente (3 intentos fallidos).
  void marcarBloqueado() {
    _bloqueado = true;
    _intentosFallidos = AppConstants.maxIntentos;
    notifyListeners();
  }
}
