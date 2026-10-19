// D-100 · Acceso sin conexión: PIN local y documento de credencial.
//
// Se prueban las piezas **puras** (derivación PBKDF2, política del PIN, vigencia
// y documento), que son donde vive la decisión de seguridad. El almacén
// (`flutter_secure_storage`) necesita el canal de plataforma y no se ejercita
// aquí: su uso se limita a leer y escribir el documento ya construido.

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/core/constants.dart';
import 'package:ggto_tecnico/core/credencial_local.dart';
import 'package:ggto_tecnico/core/pin_hash.dart';
import 'package:ggto_tecnico/core/sesion.dart';
import 'package:ggto_tecnico/features/auth/auth_provider.dart';
import 'package:ggto_tecnico/features/auth/credencial_service.dart';

SesionUsuario _tecnico({String p00 = 'TSTTEC'}) => SesionUsuario(
      p00: p00,
      nombre: 'ANA',
      apellido: 'PEREZ',
      correo: 'ana@cantv.test',
      rol: 'TECNICO',
      idCentral: 1,
      idTecnico: 9,
    );

/// Ficha de fábrica lista para usar en las pruebas de política.
CredencialLocal _ficha({
  String p00 = 'TSTTEC',
  String pin = '135790',
  bool porDefecto = false,
  Duration antiguedad = Duration.zero,
  int fallos = 0,
}) {
  final ahora = DateTime.utc(2026, 10, 15, 12, 0, 0);
  final sal = generarSal();
  return CredencialLocal(
    p00: p00,
    nombre: 'ANA',
    apellido: 'PEREZ',
    correo: 'ana@cantv.test',
    rol: 'TECNICO',
    idCentral: 1,
    idTecnico: 9,
    sal: sal,
    verificador: derivarPin(pin, sal),
    pinPorDefecto: porDefecto,
    emitidaEn: ahora.subtract(antiguedad),
    ultimoAccesoConRed: ahora.subtract(antiguedad),
    intentosFallidos: fallos,
  );
}

/// Momento fijo de referencia de las pruebas.
final DateTime _ahora = DateTime.utc(2026, 10, 15, 12, 0, 0);

void main() {
  group('D-100 · PBKDF2-HMAC-SHA256', () {
    // Vectores del estándar para comprobar que la implementación es correcta:
    // P = "password", S = "salt", dkLen = 32.
    test('coincide con los vectores de RFC 8018', () {
      String hex(Uint8List bytes) =>
          bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

      expect(
        hex(pbkdf2(
          contrasena: 'password',
          sal: utf8.encode('salt'),
          iteraciones: 1,
        )),
        '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
      );
      expect(
        hex(pbkdf2(
          contrasena: 'password',
          sal: utf8.encode('salt'),
          iteraciones: 2,
        )),
        'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43',
      );
      expect(
        hex(pbkdf2(
          contrasena: 'password',
          sal: utf8.encode('salt'),
          iteraciones: 4096,
        )),
        'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a',
      );
    });

    test('rechaza parámetros inválidos', () {
      expect(
        () => pbkdf2(contrasena: 'x', sal: const [1], iteraciones: 0),
        throwsArgumentError,
      );
      expect(
        () => pbkdf2(contrasena: 'x', sal: const [1], iteraciones: 1, longitud: 0),
        throwsArgumentError,
      );
    });

    test('la misma sal da el mismo verificador y otra sal cambia el resultado', () {
      final sal = generarSal();
      expect(derivarPin('135790', sal), derivarPin('135790', sal));
      expect(derivarPin('135790', sal), isNot(derivarPin('135790', generarSal())));
      expect(derivarPin('135790', sal), isNot(derivarPin('135791', sal)));
    });

    test('la comparación en tiempo constante distingue cadenas', () {
      expect(compararEnTiempoConstante('abc', 'abc'), isTrue);
      expect(compararEnTiempoConstante('abc', 'abd'), isFalse);
      expect(compararEnTiempoConstante('abc', 'abcd'), isFalse);
      expect(compararEnTiempoConstante('', ''), isTrue);
    });
  });

  group('D-100 · formato y política del PIN', () {
    test('validarFormatoPin exige 6 dígitos', () {
      expect(validarFormatoPin('135790'), isNull);
      expect(validarFormatoPin(''), isNotNull);
      expect(validarFormatoPin('13579'), isNotNull);
      expect(validarFormatoPin('1357900'), isNotNull);
      expect(validarFormatoPin('13579a'), isNotNull);
    });

    test('validarPinNuevo rechaza lo que no aporta seguridad', () {
      expect(
        validarPinNuevo(nuevo: '246810', confirmacion: '246810', actual: '135790'),
        isNull,
      );
      // Confirmación distinta.
      expect(
        validarPinNuevo(nuevo: '246810', confirmacion: '246811', actual: '135790'),
        isNotNull,
      );
      // Repite el actual.
      expect(
        validarPinNuevo(nuevo: '135790', confirmacion: '135790', actual: '135790'),
        isNotNull,
      );
      // Es el de fábrica.
      expect(
        validarPinNuevo(
          nuevo: AppConstants.pinPorDefecto,
          confirmacion: AppConstants.pinPorDefecto,
          actual: '135790',
        ),
        isNotNull,
      );
      // Dígito repetido.
      expect(
        validarPinNuevo(nuevo: '111111', confirmacion: '111111', actual: '135790'),
        isNotNull,
      );
    });

    test('el PIN de fábrica es de 6 dígitos', () {
      expect(AppConstants.pinPorDefecto.length, AppConstants.pinLongitud);
      expect(validarFormatoPin(AppConstants.pinPorDefecto), isNull);
    });

    test('restablecer deja el PIN de fábrica y exige cambiarlo (D-117)', () {
      final restablecida = fichaConPinPorDefecto(_ficha(pin: '135790'));
      expect(restablecida.pinPorDefecto, isTrue);
      expect(restablecida.intentosFallidos, 0);
      expect(restablecida.comprobarPin(AppConstants.pinPorDefecto), isTrue);
      expect(restablecida.comprobarPin('135790'), isFalse);

      final r = evaluarPin(
        documento: DocumentoCredencial(credenciales: [restablecida]),
        p00: 'TSTTEC',
        pin: AppConstants.pinPorDefecto,
        ahora: _ahora,
      );
      expect(r.resultado.estado, EstadoPin.requiereCambio);
    });
  });

  group('D-100 · vigencia de 24 h', () {
    test('una ficha recién emitida está vigente', () {
      expect(_ficha().vigente(_ahora, vigencia: CredencialService.vigencia), isTrue);
    });

    test('a las 24 h sin conexión deja de valer', () {
      expect(
        _ficha(antiguedad: const Duration(hours: 23, minutes: 59))
            .vigente(_ahora, vigencia: CredencialService.vigencia),
        isTrue,
      );
      expect(
        _ficha(antiguedad: const Duration(hours: 24, minutes: 1))
            .vigente(_ahora, vigencia: CredencialService.vigencia),
        isFalse,
      );
    });

    test('la vigencia configurada son 24 horas', () {
      expect(AppConstants.credencialOfflineHoras, 24);
      expect(CredencialService.vigencia, const Duration(hours: 24));
    });
  });

  group('D-100 · evaluación del PIN (política)', () {
    DocumentoCredencial doc(CredencialLocal ficha) =>
        DocumentoCredencial(credenciales: [ficha]);

    test('sin documento no hay acceso sin conexión', () {
      final r = evaluarPin(
        documento: const DocumentoCredencial(),
        p00: 'TSTTEC',
        pin: '135790',
        ahora: _ahora,
      );
      expect(r.resultado.estado, EstadoPin.credencialAusente);
      expect(r.ficha, isNull);
    });

    test('un P00 sin ficha no puede entrar', () {
      final r = evaluarPin(
        documento: doc(_ficha()),
        p00: 'OTRO',
        pin: '135790',
        ahora: _ahora,
      );
      expect(r.resultado.estado, EstadoPin.usuarioSinCredencial);
    });

    test('una credencial caducada exige conexión', () {
      final r = evaluarPin(
        documento: doc(_ficha(antiguedad: const Duration(hours: 25))),
        p00: 'TSTTEC',
        pin: '135790',
        ahora: _ahora,
      );
      expect(r.resultado.estado, EstadoPin.caducada);
    });

    test('el PIN correcto y personalizado concede el acceso', () {
      final r = evaluarPin(
        documento: doc(_ficha()),
        p00: 'TSTTEC',
        pin: '135790',
        ahora: _ahora,
      );
      expect(r.resultado.estado, EstadoPin.ok);
      expect(r.resultado.concedido, isTrue);
    });

    test('el PIN de fábrica obliga a cambiarlo antes de entrar', () {
      final r = evaluarPin(
        documento: doc(_ficha(pin: AppConstants.pinPorDefecto, porDefecto: true)),
        p00: 'TSTTEC',
        pin: AppConstants.pinPorDefecto,
        ahora: _ahora,
      );
      expect(r.resultado.estado, EstadoPin.requiereCambio);
      expect(r.resultado.exigeCambio, isTrue);
      expect(r.resultado.concedido, isFalse);
    });

    test('el PIN incorrecto descuenta intentos', () {
      final primero = evaluarPin(
        documento: doc(_ficha()),
        p00: 'TSTTEC',
        pin: '000000',
        ahora: _ahora,
      );
      expect(primero.resultado.estado, EstadoPin.pinIncorrecto);
      expect(primero.resultado.intentosRestantes, AppConstants.maxIntentos - 1);
      expect(primero.ficha!.intentosFallidos, 1);

      final segundo = evaluarPin(
        documento: doc(_ficha(fallos: 1)),
        p00: 'TSTTEC',
        pin: '000000',
        ahora: _ahora,
      );
      expect(segundo.resultado.intentosRestantes, AppConstants.maxIntentos - 2);
      expect(segundo.ficha!.intentosFallidos, 2);
    });

    test('al agotar los intentos la ficha queda bloqueada', () {
      final r = evaluarPin(
        documento: doc(_ficha(fallos: AppConstants.maxIntentos - 1)),
        p00: 'TSTTEC',
        pin: '000000',
        ahora: _ahora,
      );
      expect(r.resultado.estado, EstadoPin.bloqueada);
      expect(r.ficha!.intentosFallidos, AppConstants.maxIntentos);

      // Ya bloqueada: ni siquiera el PIN correcto entra.
      final bloqueada = evaluarPin(
        documento: doc(_ficha(fallos: AppConstants.maxIntentos)),
        p00: 'TSTTEC',
        pin: '135790',
        ahora: _ahora,
      );
      expect(bloqueada.resultado.estado, EstadoPin.bloqueada);
    });

    test('un acierto limpia el contador de fallos', () {
      final r = evaluarPin(
        documento: doc(_ficha(fallos: 2)),
        p00: 'TSTTEC',
        pin: '135790',
        ahora: _ahora,
      );
      expect(r.resultado.estado, EstadoPin.ok);
      expect(r.ficha!.intentosFallidos, 0);
    });
  });

  group('D-100 · documento de credencial', () {
    test('emite la ficha con el PIN de fábrica y la vigencia al día', () {
      final ahora = DateTime.utc(2026, 10, 15, 12);
      final ficha = CredencialLocal.nueva(
        usuario: _tecnico(),
        pin: AppConstants.pinPorDefecto,
        ahora: ahora,
        sal: null,
      );
      expect(ficha.p00, 'TSTTEC');
      expect(ficha.rol, 'TECNICO');
      expect(ficha.pinPorDefecto, isTrue);
      expect(ficha.ultimoAccesoConRed, ahora);
      expect(ficha.comprobarPin(AppConstants.pinPorDefecto), isTrue);
      expect(ficha.comprobarPin('000000'), isFalse);
    });

    test('renovar actualiza la vigencia y conserva el PIN', () {
      final ficha = _ficha(antiguedad: const Duration(hours: 30), fallos: 2);
      final renovada = ficha.renovada(_tecnico(), _ahora);
      expect(renovada.ultimoAccesoConRed, _ahora);
      expect(renovada.intentosFallidos, 0);
      expect(renovada.verificador, ficha.verificador);
      expect(renovada.vigente(_ahora, vigencia: CredencialService.vigencia), isTrue);
    });

    test('el documento inserta, reemplaza y quita fichas por P00', () {
      final a = _ficha(p00: 'AAA');
      final b = _ficha(p00: 'BBB');
      var documento = const DocumentoCredencial().con(a).con(b);
      expect(documento.credenciales.length, 2);
      expect(documento.buscar('aaa')?.p00, 'AAA'); // sin distinguir mayúsculas

      final aNueva = a.copyWith(pinPorDefecto: false, intentosFallidos: 3);
      documento = documento.con(aNueva);
      expect(documento.credenciales.length, 2);
      expect(documento.buscar('AAA')!.intentosFallidos, 3);

      documento = documento.sin('bbb');
      expect(documento.buscar('BBB'), isNull);
      expect(documento.credenciales.length, 1);
    });

    test('el documento sobrevive al viaje a JSON', () {
      final original = const DocumentoCredencial().con(_ficha(p00: 'AAA'));
      final reconstruido = DocumentoCredencial.fromJson(
        jsonDecode(jsonEncode(original.toJson())) as Map<String, dynamic>,
      );
      final ficha = reconstruido.buscar('AAA')!;
      expect(ficha.p00, 'AAA');
      expect(ficha.rol, 'TECNICO');
      expect(ficha.comprobarPin('135790'), isTrue);
      expect(ficha.pinPorDefecto, isFalse);
    });

    test('descarta documentos de otra versión o con fichas corruptas', () {
      expect(
        DocumentoCredencial.fromJson({'version': 99, 'credenciales': []}).vacio,
        isTrue,
      );
      final conBasura = DocumentoCredencial.fromJson({
        'version': versionCredencial,
        'credenciales': [
          {'p00': 'SIN-RESTO'},
          'no-es-un-mapa',
          _ficha().toJson(),
        ],
      });
      expect(conBasura.credenciales.length, 1);
    });

    test('una ficha sin datos obligatorios no se reconstruye', () {
      expect(CredencialLocal.fromJson({'p00': 'X'}), isNull);
    });
  });

  group('D-100 · alcance por rol', () {
    test('la sesión reconstruida conserva identidad y rol', () {
      final sesion = _ficha().sesion;
      expect(sesion.p00, 'TSTTEC');
      expect(sesion.rol, 'TECNICO');
      expect(sesion.esTecnico, isTrue);
      expect(sesion.idCentral, 1);
      expect(sesion.idTecnico, 9);
      expect(sesion.nombreCompleto, 'ANA PEREZ');
    });
  });

  // ----------------------------------------------------------------------- //
  // Flujo completo con el almacén cifrado simulado.                          //
  //                                                                          //
  // `flutter_secure_storage` expone `setMockInitialValues` para no depender   //
  // del canal de plataforma: así se ejercita de verdad la emisión, el cambio  //
  // obligatorio del PIN de fábrica y la apertura de la sesión cacheada sin    //
  // red, que es lo que pide el requisito.                                    //
  // ----------------------------------------------------------------------- //
  group('D-100 · acceso sin conexión de extremo a extremo', () {
    setUp(() {
      TestWidgetsFlutterBinding.ensureInitialized();
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('emite la credencial al entrar con red y obliga a cambiar el PIN de fábrica',
        () async {
      await CredencialService.registrarAccesoConRed(_tecnico());
      expect(await CredencialService.hayCredencial(), isTrue);

      // Con el PIN de fábrica no se concede: se exige el cambio.
      final primero = await CredencialService.verificar(
        p00: 'TSTTEC',
        pin: AppConstants.pinPorDefecto,
      );
      expect(primero.estado, EstadoPin.requiereCambio);
      expect(primero.concedido, isFalse);

      // Se define uno propio y entonces sí entra.
      expect(
        await CredencialService.cambiarPin(p00: 'TSTTEC', nuevoPin: '246810'),
        isNull,
      );
      final segundo = await CredencialService.verificar(p00: 'TSTTEC', pin: '246810');
      expect(segundo.estado, EstadoPin.ok);
      expect(segundo.concedido, isTrue);

      // El PIN de fábrica deja de valer para siempre.
      final tercero = await CredencialService.verificar(
        p00: 'TSTTEC',
        pin: AppConstants.pinPorDefecto,
      );
      expect(tercero.estado, EstadoPin.pinIncorrecto);

      final ficha = await CredencialService.ficha('TSTTEC');
      expect(ficha!.pinPorDefecto, isFalse);
    });

    test('no se puede dejar el PIN de fábrica al cambiarlo', () async {
      await CredencialService.registrarAccesoConRed(_tecnico());
      final fallo = await CredencialService.cambiarPin(
        p00: 'TSTTEC',
        nuevoPin: AppConstants.pinPorDefecto,
      );
      expect(fallo, isNotNull);
      expect((await CredencialService.ficha('TSTTEC'))!.pinPorDefecto, isTrue);
    });

    test('solo el rol TÉCNICO recibe credencial local', () async {
      await CredencialService.registrarAccesoConRed(const SesionUsuario(
        p00: 'TSTSUP',
        nombre: 'SUPER',
        apellido: 'VISOR',
        correo: 'sup@cantv.test',
        rol: 'SUPERVISOR',
      ));
      expect(await CredencialService.hayCredencial(), isFalse);

      final resultado = await CredencialService.verificar(
        p00: 'TSTSUP',
        pin: AppConstants.pinPorDefecto,
      );
      // Sin credencial: los roles de gestión siempre exigen conexión.
      expect(resultado.estado, EstadoPin.credencialAusente);
    });

    test('los intentos fallidos invalidan el acceso sin conexión', () async {
      await CredencialService.registrarAccesoConRed(_tecnico());
      await CredencialService.cambiarPin(p00: 'TSTTEC', nuevoPin: '246810');

      for (var i = 0; i < AppConstants.maxIntentos - 1; i++) {
        final r = await CredencialService.verificar(p00: 'TSTTEC', pin: '000000');
        expect(r.estado, EstadoPin.pinIncorrecto);
      }
      final bloqueo = await CredencialService.verificar(p00: 'TSTTEC', pin: '000000');
      expect(bloqueo.estado, EstadoPin.bloqueada);

      // Ni el PIN correcto vuelve a entrar.
      final correcto = await CredencialService.verificar(p00: 'TSTTEC', pin: '246810');
      expect(correcto.estado, EstadoPin.bloqueada);
    });

    test('olvidar el PIN descarta la ficha', () async {
      await CredencialService.registrarAccesoConRed(_tecnico());
      expect(await CredencialService.hayCredencial(), isTrue);
      await CredencialService.olvidar('TSTTEC');
      expect(await CredencialService.ficha('TSTTEC'), isNull);
    });

    test('abre la sesión cacheada del técnico sin tocar la red', () async {
      // Sesión cacheada del mismo P00, con las claves del almacén de sesión.
      FlutterSecureStorage.setMockInitialValues({
        'jwt_token': 'TOKEN-CACHEADO',
        'sesion_usuario': jsonEncode(_tecnico().toJson()),
      });
      await CredencialService.registrarAccesoConRed(_tecnico());
      await CredencialService.cambiarPin(p00: 'TSTTEC', nuevoPin: '246810');

      final auth = AuthProvider();
      expect(auth.autenticado, isFalse);

      final pin = await auth.verificarPinLocal('TSTTEC', '246810');
      expect(pin.concedido, isTrue);

      final entrada = await auth.entrarSinConexion('TSTTEC');
      expect(entrada.concedido, isTrue);
      expect(auth.autenticado, isTrue);
      expect(auth.offline, isTrue);
      expect(auth.p00, 'TSTTEC');
      expect(auth.rol, 'TECNICO');
    });

    test('rechaza abrir la credencial con la sesión de otro usuario', () async {
      // La sesión cacheada es de OTRO usuario (dispositivo compartido).
      FlutterSecureStorage.setMockInitialValues({
        'jwt_token': 'TOKEN-DE-OTRO',
        'sesion_usuario': jsonEncode(const SesionUsuario(
          p00: 'TSTOTRO',
          nombre: 'OTRO',
          apellido: 'TECNICO',
          correo: 'otro@cantv.test',
          rol: 'TECNICO',
        ).toJson()),
      });
      await CredencialService.registrarAccesoConRed(_tecnico());

      final auth = AuthProvider();
      final entrada = await auth.entrarSinConexion('TSTTEC');
      expect(entrada.estado, EstadoPin.sesionIncoherente);
      expect(auth.autenticado, isFalse);
    });

    test('sin sesión guardada no hay nada que abrir', () async {
      await CredencialService.registrarAccesoConRed(_tecnico());
      final auth = AuthProvider();
      final entrada = await auth.entrarSinConexion('TSTTEC');
      expect(entrada.estado, EstadoPin.sinSesionGuardada);
      expect(auth.autenticado, isFalse);
    });

    test('abre la sesión aunque el token haya caducado', () async {
      // El token caducó (8 h) y se descartó: queda la identidad cacheada.
      FlutterSecureStorage.setMockInitialValues({
        'sesion_usuario': jsonEncode(_tecnico().toJson()),
      });
      await CredencialService.registrarAccesoConRed(_tecnico());
      await CredencialService.cambiarPin(p00: 'TSTTEC', nuevoPin: '246810');

      final auth = AuthProvider();
      final entrada = await auth.entrarSinConexion('TSTTEC');
      expect(entrada.concedido, isTrue);
      expect(auth.autenticado, isTrue, reason: 'sin token sigue habiendo sesión offline');
      expect(auth.offline, isTrue);
      expect(auth.p00, 'TSTTEC');
    });
  });
}
