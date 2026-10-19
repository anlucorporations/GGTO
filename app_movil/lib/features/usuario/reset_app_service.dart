import 'dart:io';

import '../../core/auth_storage.dart';
import '../../core/database.dart';
import '../auth/credencial_service.dart';
import '../evidencias/evidencia_service.dart';

/// Resultado de un borrado local, listo para mostrar al usuario.
class ResumenBorrado {
  const ResumenBorrado({
    this.casos = 0,
    this.masivas = 0,
    this.acciones = 0,
    this.evidencias = 0,
    this.mensajes = 0,
    this.fotos = 0,
    this.credenciales = false,
    this.sesion = false,
  });

  final int casos;
  final int masivas;
  final int acciones;
  final int evidencias;
  final int mensajes;

  /// Archivos de foto borrados del almacenamiento de la app.
  final int fotos;

  /// Se descartó la credencial del PIN local.
  final bool credenciales;

  /// Se cerró la sesión guardada.
  final bool sesion;

  bool get vacio =>
      casos == 0 &&
      masivas == 0 &&
      acciones == 0 &&
      evidencias == 0 &&
      mensajes == 0 &&
      fotos == 0;

  /// Texto corto para la barra de confirmación.
  String get resumen {
    final partes = <String>[
      if (casos > 0) '$casos caso(s)',
      if (masivas > 0) '$masivas masiva(s)',
      if (acciones > 0) '$acciones acción(es)',
      if (evidencias > 0) '$evidencias evidencia(s)',
      if (mensajes > 0) '$mensajes mensaje(s)',
      if (fotos > 0) '$fotos foto(s)',
    ];
    if (partes.isEmpty) return 'No había nada que borrar en el dispositivo.';
    return 'Borrado del dispositivo: ${partes.join(' · ')}.';
  }
}

/// Borrado de los datos **locales** de la APK (D-120).
///
/// Dos niveles, elegidos por el usuario:
///
///  1. [borrarCasos]: elimina los casos y las fallas masivas **descargados**.
///     Conserva la sesión, el PIN y la cola de trabajo sin enviar (el técnico
///     sigue dentro y puede volver a sincronizar cuando quiera).
///  2. [restablecerTodo]: deja la app **como recién instalada**. Borra la base
///     local completa (casos, despacho, cola, evidencias, mensajes y metadatos),
///     las fotos capturadas, la credencial del PIN y la sesión guardada; el
///     usuario vuelve al acceso con P00 y clave.
///
/// No toca nada del servidor: los casos siguen en la plataforma y el despacho
/// del día se vuelve a descargar en la primera sincronización.
class ResetAppService {
  const ResetAppService._();

  /// Borra los casos y las masivas descargados (conserva sesión, PIN y cola).
  static Future<ResumenBorrado> borrarCasos() async {
    final filas = await DatabaseHelper.instance.borrarCasosDescargados();
    return ResumenBorrado(
      casos: filas['casos'] ?? 0,
      masivas: filas['masivas'] ?? 0,
    );
  }

  /// Restablece la aplicación por completo (como una instalación nueva).
  static Future<ResumenBorrado> restablecerTodo() async {
    final filas = await DatabaseHelper.instance.reiniciarTodo();
    final fotos = await _borrarFotos();
    await CredencialService.olvidarTodo();
    await AuthStorage.limpiarSesion();
    return ResumenBorrado(
      casos: filas['caso_local'] ?? 0,
      masivas: filas['masiva_local'] ?? 0,
      acciones: filas['accion_pendiente'] ?? 0,
      evidencias: filas['evidencia_local'] ?? 0,
      mensajes: filas['mensaje_local'] ?? 0,
      fotos: fotos,
      credenciales: true,
      sesion: true,
    );
  }

  /// Borra los archivos de foto de la carpeta de evidencias de la app.
  ///
  /// Es tolerante a fallos: si el sistema no deja borrar un archivo, se cuenta lo
  /// que sí se borró y el resto queda para el próximo intento.
  static Future<int> _borrarFotos() async {
    try {
      final carpeta = await EvidenciaService.carpetaEvidencias();
      var borrados = 0;
      await for (final entrada in carpeta.list()) {
        if (entrada is! File) continue;
        try {
          await entrada.delete();
          borrados++;
        } catch (_) {
          // Archivo bloqueado o sin permisos: se conserva.
        }
      }
      return borrados;
    } catch (_) {
      return 0;
    }
  }

  /// Tamaño de la carpeta de evidencias, para informar antes de borrar.
  static Future<int> fotografiasEnDispositivo() async {
    try {
      final carpeta = await EvidenciaService.carpetaEvidencias();
      var total = 0;
      await for (final entrada in carpeta.list()) {
        if (entrada is File) total++;
      }
      return total;
    } catch (_) {
      return 0;
    }
  }
}
