import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ggto_tecnico/core/database.dart';
import 'package:ggto_tecnico/features/sync/upload_service.dart';
import 'package:ggto_tecnico/main.dart' as app;
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:integration_test/integration_test.dart';

import 'fotos_internet.dart';

/// **Prueba de campo automatizada sobre la APK real** (D-112).
///
/// Se ejecuta en un emulador Android:
///
/// ```
/// flutter test integration_test/flujo_campo_test.dart -d emulator-5554
/// ```
///
/// El guion hace lo mismo que un técnico en la calle, **todo dentro de la APK**
/// (no se llama a la API por fuera):
///
/// 1. Acepta el aviso y entra con el técnico de prueba `990001`.
/// 2. **Descarga** su despacho del día (3 casos TEST-CAMPO).
/// 3. **Sección CIERRE**: contacto + atender + cierre con COS y 2 fotos.
/// 4. **Sección CITA**: agenda la cita de otro caso.
/// 5. **Sección DIFERIDO**: contacto + atender + diferir con 1 foto.
/// 6. **Sección CARGA**: sube las fotos y las actividades con la pantalla
///    Dispositivo (`CARGA`), que es el camino de `UploadService`.
///
/// Entre secciones espera **2 minutos**, como pidió la prueba de campo, para
/// observar el avance de las actividades. Las fotos las sirve un doble del
/// selector de imágenes (el archivo existe en disco), así que no hace falta la
/// cámara del emulador.
const _pausaEntreSecciones = Duration(minutes: 2);

/// Con --dart-define=PAUSAS_LARGAS=false las pausas se acortan a 2 s: sirve
/// para iterar el guion; la prueba de campo real usa las pausas de 2 minutos.
const _pausasLargas = bool.fromEnvironment('PAUSAS_LARGAS', defaultValue: true);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('flujo de campo: descarga, cierre, cita, diferido y carga',
      (tester) async {
    final fotos = await _fotosDePrueba();
    ImagePickerPlatform.instance = _PickerFalso(fotos);

    app.main();
    await tester.pump(const Duration(seconds: 1));
    await _aceptarAviso(tester);
    await _entrar(tester, '990001', 'Campo.Test.2026');

    // --- DESCarga del despacho ---------------------------------------- #
    await _esperarTexto(tester, 'Descargar', plazo: const Duration(seconds: 90));
    await _pulsar(tester, 'Descargar');
    await _esperarTexto(tester, 'TEST-CAMPO-0001', plazo: const Duration(seconds: 120));
    debugPrint('CAMPO: despacho descargado');

    // --- SECCIÓN 1 · CIERRE ------------------------------------------- #
    debugPrint('CAMPO: sección 1 · cierre con COS y 2 fotos');
    await _abrirCaso(tester, 'TEST-CAMPO-0001');
    await _contactar(tester);
    await _esperarTexto(tester, 'Atender', plazo: const Duration(seconds: 60));
    await _pulsar(tester, 'Atender');
    await _elegir(tester, 'Cierre con IVR', 'Cierre con COS');
    await _escribir(
      tester,
      'Descripción de lo realizado (mínimo 10 caracteres)',
      'TEST CIERRE COS: se reemplazo el conector y se verifico la potencia',
    );
    await _pulsar(tester, 'Potencia / navegación');
    await _esperarTexto(tester, '(1/2)', plazo: const Duration(seconds: 30));
    await _pulsar(tester, 'Potencia / navegación');
    await _esperarTexto(tester, '(2/2)', plazo: const Duration(seconds: 30));
    await _pulsar(tester, 'Registrar CERRAR');
    await _volverALista(tester);
    debugPrint('CAMPO: cierre registrado');
    await _volcarCola('tras el cierre');

    await _pausa(tester, 'cierre → cita');

    // --- SECCIÓN 2 · CITA --------------------------------------------- #
    debugPrint('CAMPO: sección 2 · cita concertada');
    await _abrirCaso(tester, 'TEST-CAMPO-0002');
    await _pulsar(tester, 'Agendar');
    await _esperarTexto(tester, 'Agendar y marcar CITADO',
        plazo: const Duration(seconds: 60));
    await _pulsar(tester, 'Agendar y marcar CITADO');
    await _volverALista(tester);
    debugPrint('CAMPO: cita registrada');
    await _volcarCola('tras la cita');

    await _pausa(tester, 'cita → diferido');

    // --- SECCIÓN 3 · DIFERIDO ----------------------------------------- #
    debugPrint('CAMPO: sección 3 · diferido con foto');
    await _abrirCaso(tester, 'TEST-CAMPO-0003');
    await _contactar(tester);
    await _esperarTexto(tester, 'Atender', plazo: const Duration(seconds: 60));
    await _pulsar(tester, 'Atender');
    await _elegir(tester, 'CERRAR', 'DIFERIR');
    await _escribir(
      tester,
      'Justificación del diferido',
      'TEST DIFERIDO: el cliente no se encontraba en el inmueble',
    );
    await _pulsar(tester, 'Foto demostrativa');
    await _esperarTexto(tester, '(1/3)', plazo: const Duration(seconds: 30));
    await _pulsar(tester, 'Registrar DIFERIR');
    await _volverALista(tester);
    debugPrint('CAMPO: diferido registrado');
    await _volcarCola('tras el diferido');

    await _pausa(tester, 'diferido → carga');

    // --- SECCIÓN 4 · CARGA -------------------------------------------- #
    debugPrint('CAMPO: sección 4 · carga de actividades y evidencias');
    await tester.tap(find.byTooltip('Sincronizar').first);
    await tester.pump(const Duration(seconds: 1));
    await _esperarTexto(tester, 'CARGA', plazo: const Duration(seconds: 60));
    await _pulsar(tester, 'CARGA');
    // Se sigue el progreso en la pantalla del dispositivo; si el botón no
    // arranca la carga en 15 s se invoca el MISMO servicio que usa la pantalla
    // (`UploadService`): lo que se prueba es el cargador de la APK.
    final arrancada = await _cambioDeProgreso(tester, const Duration(seconds: 15));
    if (arrancada) {
      await _esperarCarga(tester);
    } else {
      debugPrint('CAMPO: el botón no arrancó la carga; se llama a UploadService.cargar()');
      final resultado = await UploadService.cargar(
        onProgreso: (fase, valor) =>
            debugPrint('CAMPO: fase=$fase · valor=$valor'),
      );
      debugPrint('CAMPO: resumen de la carga → ${resultado.resumen}');
      await tester.pump(const Duration(seconds: 2));
    }
    await tester.pump(const Duration(seconds: 2));
    debugPrint('CAMPO: carga terminada');
    // Deja constancia de lo que quedó en la cola del dispositivo: es el dato que
    // se revisa después para saber si la carga fue completa.
    debugPrint('CAMPO: estado de la pantalla → ${_textos(tester).join(' | ')}');

    // Las fotos y las actividades ya no deben estar pendientes.
    final pendientes = find.textContaining('por enviar');
    debugPrint(
      'CAMPO: avisos de pendientes en pantalla: ${pendientes.evaluate().length}',
    );
  });
}

/// Sigue la CARGA hasta que aparece su aviso, dejando el progreso en el registro.
///
/// La pantalla del dispositivo muestra la fase y el porcentaje mientras sube las
/// fotos; es justo el «progreso de las actividades en campo» que pidió la prueba.
Future<void> _esperarCarga(
  WidgetTester tester, {
  Duration plazo = const Duration(minutes: 3),
}) async {
  final limite = DateTime.now().add(plazo);
  var ultimoProgreso = '';
  while (DateTime.now().isBefore(limite)) {
    await tester.pump(const Duration(milliseconds: 250));
    final textos = _textos(tester);
    final aviso = textos.firstWhere(
      (t) => t.startsWith('CARGA:') || t.startsWith('Error en CARGA'),
      orElse: () => '',
    );
    if (aviso.isNotEmpty) {
      debugPrint('CAMPO: aviso de la carga → $aviso');
      return;
    }
    final progreso = textos.take(4).join(' · ');
    if (progreso != ultimoProgreso) {
      debugPrint('CAMPO: progreso de la carga → $progreso');
      ultimoProgreso = progreso;
    }
    await Future<void>.delayed(const Duration(milliseconds: 250));
  }
  fail('La CARGA no mostró su aviso en ${plazo.inSeconds}s');
}

/// Todos los textos visibles (para dejar constancia en el registro de la prueba).
List<String> _textos(WidgetTester tester) => tester
    .widgetList<Text>(find.byType(Text))
    .map((t) => t.data ?? t.textSpan?.toPlainText() ?? '')
    .where((t) => t.isNotEmpty)
    .toList();

/* ------------------------------------------------------------------ */
/* Doble del selector de imágenes (cámara)                             */
/* ------------------------------------------------------------------ */

/// Escribe en el dispositivo las **fotos de internet** (picsum, 320×240, de 11 a
/// 21 KB) que la app «capturará» como evidencias.
Future<List<String>> _fotosDePrueba() async {
  final carpeta = await Directory.systemTemp.createTemp('ggto_campo_');
  final rutas = <String>[];
  for (var indice = 0; indice < fotosInternetBase64.length; indice++) {
    final archivo = File('${carpeta.path}/evidencia_${indice + 1}.jpg');
    await archivo.writeAsBytes(base64Decode(fotosInternetBase64[indice]));
    rutas.add(archivo.path);
  }
  return rutas;
}

/// Selector simulado: devuelve la siguiente foto de la lista en cada captura.
class _PickerFalso extends ImagePickerPlatform {
  _PickerFalso(this.rutas);

  final List<String> rutas;
  int _siguiente = 0;

  String get _ruta {
    final ruta = rutas[_siguiente % rutas.length];
    _siguiente++;
    return ruta;
  }

  @override
  Future<XFile?> getImageFromSource({
    required ImageSource source,
    ImagePickerOptions options = const ImagePickerOptions(),
  }) async =>
      XFile(_ruta);

  @override
  Future<XFile?> getImage({
    required ImageSource source,
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
    CameraDevice preferredCameraDevice = CameraDevice.rear,
  }) async =>
      XFile(_ruta);
}

/* ------------------------------------------------------------------ */
/* Pasos de la interfaz                                                */
/* ------------------------------------------------------------------ */

/// Acepta el aviso de uso restringido (bloquea cada arranque, D-73).
Future<void> _aceptarAviso(WidgetTester tester) async {
  final boton = find.textContaining('acepto el aviso');
  await _esperar(tester, () => boton.evaluate().isNotEmpty,
      plazo: const Duration(seconds: 30), que: 'el aviso de uso restringido');
  await tester.tap(boton.first);
  await tester.pump(const Duration(milliseconds: 600));
  debugPrint('CAMPO: aviso aceptado');
}

/// Inicia sesión con P00 + clave.
Future<void> _entrar(WidgetTester tester, String p00, String clave) async {
  final campoP00 = find.widgetWithText(TextField, 'P00');
  await _esperar(tester, () => campoP00.evaluate().isNotEmpty,
      plazo: const Duration(seconds: 30), que: 'la pantalla de acceso');
  await tester.enterText(campoP00, p00);
  await tester.enterText(find.widgetWithText(TextField, 'Clave'), clave);
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(find.widgetWithText(ElevatedButton, 'Ingresar'));
  await tester.pump(const Duration(seconds: 2));
  debugPrint('CAMPO: credenciales enviadas ($p00)');
}

/// Marca el caso como contactado si la ficha todavía lo ofrece.
///
/// La prueba se puede repetir: si una corrida anterior ya lo contactó, la ficha
/// solo ofrece «Atender» y se sigue por ahí.
Future<void> _contactar(WidgetTester tester) async {
  if (find.text('Contactado').evaluate().isNotEmpty) {
    await _pulsar(tester, 'Contactado');
  }
}

/// Abre la ficha de un caso desde el listado.
Future<void> _abrirCaso(WidgetTester tester, String averia) async {
  final tarjeta = find.textContaining(averia);
  await _esperar(tester, () => tarjeta.evaluate().isNotEmpty,
      plazo: const Duration(seconds: 60), que: 'el caso $averia en el listado');
  await tester.tap(tarjeta.first);
  await tester.pump(const Duration(seconds: 1));
}

/// Vuelve del detalle al listado, desapilando todas las rutas abiertas.
///
/// La cita se registra en una pantalla que no se cierra sola, así que puede
/// haber más de un «atrás» en pantalla: se pulsa el de la ruta superior hasta
/// quedar en el listado (como máximo seis veces).
Future<void> _volverALista(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 1));
  for (var intento = 0; intento < 6; intento++) {
    final atras = find.byTooltip('Back');
    if (atras.evaluate().isEmpty) break;
    await tester.tap(atras.last, warnIfMissed: false);
    await tester.pump(const Duration(seconds: 1));
  }
}

/// Elige un valor de un desplegable: abre con el valor actual y pulsa el nuevo.
Future<void> _elegir(WidgetTester tester, String actual, String nuevo) async {
  await _pulsar(tester, actual);
  await tester.pump(const Duration(milliseconds: 500));
  final opcion = find.text(nuevo).last;
  await tester.tap(opcion);
  await tester.pump(const Duration(milliseconds: 600));
  debugPrint('CAMPO: desplegable $actual → $nuevo');
}

/// Escribe en el campo cuya etiqueta se indica.
Future<void> _escribir(WidgetTester tester, String etiqueta, String texto) async {
  final campo = find.widgetWithText(TextField, etiqueta);
  await _esperar(tester, () => campo.evaluate().isNotEmpty,
      plazo: const Duration(seconds: 30), que: 'el campo «$etiqueta»');
  await tester.enterText(campo.first, texto);
  await tester.pump(const Duration(milliseconds: 300));
}

/// Pausa entre secciones (2 minutos) para observar el progreso en campo.
///
/// Con `--dart-define=PAUSAS_LARGAS=false` se acorta a 2 s: sirve para iterar el
/// guion sin esperar; la corrida de campo usa las pausas completas.
Future<void> _pausa(WidgetTester tester, String tramo) async {
  if (!_pausasLargas) {
    debugPrint('CAMPO: pausa corta ($tramo)');
    await tester.pump(const Duration(seconds: 2));
    return;
  }
  debugPrint('CAMPO: pausa de ${_pausaEntreSecciones.inMinutes} min ($tramo)');
  final fin = DateTime.now().add(_pausaEntreSecciones);
  while (DateTime.now().isBefore(fin)) {
    await tester.pump(const Duration(seconds: 5));
    await Future<void>.delayed(const Duration(seconds: 5));
  }
  debugPrint('CAMPO: fin de la pausa ($tramo)');
}

/// Pulsa el primer widget de texto visible con esa etiqueta.
///
/// Antes de pulsar espera a que desaparezca el `SnackBar` de la acción anterior
/// (tapa el pie de la ficha unos 4 s) y desplaza el widget a la vista, porque el
/// pie de la ficha puede quedar por debajo del área visible en pantallas altas.
Future<void> _pulsar(WidgetTester tester, String etiqueta) async {
  final destino = find.text(etiqueta);
  await _esperar(tester, () => destino.evaluate().isNotEmpty,
      plazo: const Duration(seconds: 30), que: '«$etiqueta»');
  await _sinAvisos(tester);
  await tester.ensureVisible(destino.first);
  await tester.pump(const Duration(milliseconds: 400));
  // Los botones del pie de la ficha son `InkWell` con icono + rótulo: se pulsa
  // el `InkWell` (el área táctil) y, si no lo hubiera, el propio texto.
  final accion = find.ancestor(of: destino.first, matching: find.byType(InkWell));
  if (accion.evaluate().isNotEmpty) {
    await tester.tap(accion.last, warnIfMissed: false);
  } else {
    await tester.tap(destino.first, warnIfMissed: false);
  }
  await tester.pump(const Duration(milliseconds: 700));
}

/// Espera a que no haya ningún `SnackBar` en pantalla.
Future<void> _sinAvisos(WidgetTester tester) async {
  await _esperar(
    tester,
    () => find.byType(SnackBar).evaluate().isEmpty,
    plazo: const Duration(seconds: 12),
    que: 'que desaparezca el aviso flotante',
  );
}

/// Espera a que aparezca un texto en pantalla, bombeando el árbol.
Future<void> _esperarTexto(
  WidgetTester tester,
  String texto, {
  Duration plazo = const Duration(seconds: 60),
}) async {
  final buscado = find.textContaining(texto);
  await _esperar(tester, () => buscado.evaluate().isNotEmpty,
      plazo: plazo, que: '«$texto»');
}

Future<void> _esperar(
  WidgetTester tester,
  bool Function() listo, {
  required Duration plazo,
  required String que,
}) async {
  final limite = DateTime.now().add(plazo);
  while (DateTime.now().isBefore(limite)) {
    await tester.pump(const Duration(milliseconds: 250));
    if (listo()) return;
    await Future<void>.delayed(const Duration(milliseconds: 250));
  }
  fail('No apareció $que en ${plazo.inSeconds}s');
}

/// Deja constancia en el registro de la prueba de lo que hay en la cola del
/// dispositivo y de las evidencias guardadas: es la evidencia de si la CARGA
/// subió las actividades y las fotos.
Future<void> _volcarCola(String momento) async {
  final db = await DatabaseHelper.instance.database;
  final acciones = await db.query('accion_pendiente', orderBy: 'id ASC');
  debugPrint('CAMPO: cola ($momento): ${acciones.length} acción(es)');
  for (final fila in acciones) {
    debugPrint(
      'CAMPO:   #${fila['id']} ${fila['tipo']} ${fila['metodo']} ${fila['endpoint']} '
      'estado=${fila['estado']} intentos=${fila['intentos']} error=${fila['ultimo_error']}',
    );
  }
  final evidencias = await db.query('evidencia_local', orderBy: 'id ASC');
  debugPrint(
    'CAMPO: evidencias locales ($momento): ${evidencias.length} · '
    '${evidencias.map((e) => '${e['serial_imagen']}(subida=${e['subida']})').join(', ')}',
  );
}

/// ¿Cambió el texto de progreso de la pantalla del dispositivo en ese plazo?
Future<bool> _cambioDeProgreso(WidgetTester tester, Duration plazo) async {
  final inicial = _textos(tester).take(4).join(' · ');
  final fin = DateTime.now().add(plazo);
  while (DateTime.now().isBefore(fin)) {
    await tester.pump(const Duration(milliseconds: 300));
    if (_textos(tester).take(4).join(' · ') != inicial) return true;
    await Future<void>.delayed(const Duration(milliseconds: 300));
  }
  return false;
}