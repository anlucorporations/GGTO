// Pruebas del incremento D-82 (requisitos 1 a 5 de la APK).
//
// Cubren la lógica pura y los widgets nuevos que no necesitan dispositivo ni
// red: validación del reporte de falla masiva (ODN · dirección · FAT ·
// descripción · máximo 2 fotos), barra de progreso de la sincronización, icono
// del menú de usuario y datos de la sección Usuario.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:ggto_tecnico/core/constants.dart';
import 'package:ggto_tecnico/features/casos/operaciones_service.dart';
import 'package:ggto_tecnico/features/sync/sync_provider.dart';
import 'package:ggto_tecnico/features/usuario/usuario_service.dart';
import 'package:ggto_tecnico/widgets/barra_progreso_sync.dart';
import 'package:ggto_tecnico/widgets/boton_usuario.dart';

void main() {
  group('reporte de falla masiva (requisito 5)', () {
    test('exige la ODN', () async {
      final r = await OperacionesService.reportarFallaMasiva(
        odn: 'AB',
        direccion: 'Calle 4 con Av. Principal',
        fat: 'FAT-04',
        descripcion: 'Sin servicio en la zona',
      );
      expect(r.valida, isFalse);
      expect(r.mensaje, contains('ODN'));
    });

    test('exige la dirección', () async {
      final r = await OperacionesService.reportarFallaMasiva(
        odn: 'ODN-2324X-0451',
        direccion: 'Casa',
        fat: 'FAT-04',
        descripcion: 'Sin servicio en la zona',
      );
      expect(r.valida, isFalse);
      expect(r.mensaje, contains('dirección'));
    });

    test('exige la FAT', () async {
      final r = await OperacionesService.reportarFallaMasiva(
        odn: 'ODN-2324X-0451',
        direccion: 'Calle 4 con Av. Principal',
        fat: '  ',
        descripcion: 'Sin servicio en la zona',
      );
      expect(r.valida, isFalse);
      expect(r.mensaje, contains('FAT'));
    });

    test('exige la descripción', () async {
      final r = await OperacionesService.reportarFallaMasiva(
        odn: 'ODN-2324X-0451',
        direccion: 'Calle 4 con Av. Principal',
        fat: 'FAT-04',
        descripcion: 'abc',
      );
      expect(r.valida, isFalse);
      expect(r.mensaje, contains('Describa'));
    });

    test('admite como máximo 2 fotos de evidencia', () async {
      final r = await OperacionesService.reportarFallaMasiva(
        odn: 'ODN-2324X-0451',
        direccion: 'Calle 4 con Av. Principal',
        fat: 'FAT-04',
        descripcion: 'Sin servicio en la zona',
        evidencias: const ['a.jpg', 'b.jpg', 'c.jpg'],
      );
      expect(r.valida, isFalse);
      expect(r.mensaje, contains('2 fotos'));
      expect(AppConstants.maxEvidenciasFallaMasiva, 2);
    });
  });

  group('barra de progreso de la sincronización (requisito 2)', () {
    test('calcula el porcentaje y el resumen del avance', () {
      final sync = SyncProvider();
      expect(sync.progresoActivo, isFalse);
      expect(sync.progresoPorcentaje, 100);

      sync.iniciarProgreso('Descargando los casos de mi cuadrilla…');
      expect(sync.progresoActivo, isTrue);
      expect(sync.progreso, 0);
      expect(sync.resumenBarra, contains('Descargando'));

      sync.actualizarProgreso(0.42, fase: 'Enviando acciones… (21 de 50)');
      expect(sync.progresoPorcentaje, 42);
      expect(sync.resumenBarra, '42 % · Enviando acciones… (21 de 50)');

      sync.terminarProgreso();
      expect(sync.progresoActivo, isFalse);
      expect(sync.progreso, 1);
      expect(sync.resumenBarra, 'Sin sincronizar todavía');
    });

    test('en reposo, la cola al día se muestra completa', () {
      final sync = SyncProvider();
      expect(sync.progresoEnReposo, 1);
    });

    testWidgets('pinta la barra y su porcentaje', (tester) async {
      final sync = SyncProvider()..iniciarProgreso('Subiendo fotos…', valor: 0.5);
      await tester.pumpWidget(
        ChangeNotifierProvider<SyncProvider>.value(
          value: sync,
          child: const MaterialApp(
            home: Scaffold(body: BarraProgresoSync(compacta: false)),
          ),
        ),
      );
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      // El resumen incluye el porcentaje y el porcentaje se repite a la derecha.
      expect(find.text('50 %'), findsOneWidget);
      expect(find.textContaining('Subiendo fotos'), findsOneWidget);
      sync.dispose();
    });
  });

  group('menú de usuario (requisito 3)', () {
    testWidgets('el icono de usuario abre la ruta /usuario', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          initialRoute: '/',
          routes: {
            '/': (_) => const Scaffold(appBar: null, body: BotonUsuario()),
            '/usuario': (_) => const Scaffold(body: Text('Sección Usuario')),
          },
        ),
      );
      expect(find.byIcon(Icons.account_circle), findsOneWidget);
      await tester.tap(find.byIcon(Icons.account_circle));
      await tester.pumpAndSettle();
      expect(find.text('Sección Usuario'), findsOneWidget);
    });
  });

  group('datos de la sección Usuario (requisito 4)', () {
    test('la cuadrilla se rotula con código y nombre', () {
      const cuadrilla = CuadrillaInfo(
        idCuadrilla: 3,
        codigo: 'C-03',
        nombre: 'Cuadrilla Norte',
      );
      expect(cuadrilla.etiqueta, 'C-03 · Cuadrilla Norte');
      expect(const CuadrillaInfo().etiqueta, 'Sin cuadrilla activa');
    });

    test('el perfil usa el P00 cuando no hay nombre', () {
      const perfil = PerfilUsuario(
        p00: '2324X001',
        nombre: '',
        apellido: '',
        correo: 'tecnico@cantv.com.ve',
        rol: 'TECNICO',
      );
      expect(perfil.nombreCompleto, '2324X001');
      final desdeJson = PerfilUsuario.fromJson(const {
        'p00': '2324X001',
        'nombre': 'Ana',
        'apellido': 'Pérez',
        'correo': 'a@b.ve',
        'rol': 'TECNICO',
        'id_central': 1,
      });
      expect(desdeJson.nombreCompleto, 'Ana Pérez');
      expect(desdeJson.idCentral, 1);
    });

    test('el estado de las palabras de seguridad se interpreta sin exponer valores', () {
      final estado = EstadoSeguridad.fromJson(const {
        'p00': '2324X001',
        'tiene_palabras': true,
        'version': 2,
        'cantidad': 12,
        'actualizado_en': '2026-10-06T12:00:00Z',
        'requiere_cambio_clave': false,
        'bloqueado': false,
      });
      expect(estado.tienePalabras, isTrue);
      expect(estado.cantidad, 12);
      expect(estado.version, 2);
      expect(estado.bloqueado, isFalse);
    });
  });
}
