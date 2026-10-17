package com.example.ggto_tecnico

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Puente con el **instalador del sistema** para actualizar la APK sin salir de la
 * aplicación (D-107).
 *
 * La APK nueva se descarga en la caché interna (cubierta por `res/xml/file_paths.xml`)
 * y aquí se abre el instalador de Android con `FileProvider`, que **reemplaza la
 * app en su sitio**: no hay que desinstalar nada y se conservan la sesión y los
 * datos locales (SQLite). Android solo acepta la instalación si la APK está
 * firmada con la misma clave que la instalada.
 *
 * Desde Android 8 (API 26) el usuario debe permitir «instalar apps desconocidas»
 * para esta aplicación; el canal expone `puedeInstalar` y `abrirAjustes` para
 * llevar al técnico a esa pantalla sin que tenga que buscarla.
 */
class MainActivity : FlutterActivity() {
    private val canal = "ggto/actualizador"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, canal)
            .setMethodCallHandler { llamada, resultado ->
                when (llamada.method) {
                    "puedeInstalar" -> resultado.success(puedeInstalar())
                    "abrirAjustes" -> resultado.success(abrirAjustes())
                    "instalar" -> {
                        val ruta = llamada.argument<String>("ruta")
                        if (ruta.isNullOrBlank()) {
                            resultado.error("SIN_RUTA", "Falta la ruta de la APK descargada", null)
                        } else {
                            try {
                                resultado.success(instalar(File(ruta)))
                            } catch (e: Exception) {
                                resultado.error(
                                    "ERROR_INSTALACION",
                                    e.message ?: "No se pudo abrir el instalador",
                                    null,
                                )
                            }
                        }
                    }
                    else -> resultado.notImplemented()
                }
            }
    }

    /** ¿La app puede pedir la instalación de paquetes? (API < 26: siempre). */
    private fun puedeInstalar(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            packageManager.canRequestPackageInstalls()
        } else {
            true
        }

    /** Abre la pantalla de «instalar apps desconocidas» de esta aplicación. */
    private fun abrirAjustes(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true
        return try {
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:$packageName"),
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Lanza el instalador de Android sobre la APK descargada. */
    private fun instalar(archivo: File): Boolean {
        require(archivo.exists()) { "La APK descargada no existe" }
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", archivo)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
        return true
    }
}
