package com.example.ggto_tecnico

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Puente con el **instalador del sistema** para actualizar la APK sin salir de la
 * aplicación (D-107) y **aviso por notificación** cuando la descarga termina con
 * la app en segundo plano (D-108).
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
 *
 * Desde Android 13 (API 33) las notificaciones requieren permiso en tiempo de
 * ejecución: `permisoNotificaciones` / `solicitarPermisoNotificaciones` lo
 * gestionan y `notificar` publica el aviso. Al tocar la notificación se abre la
 * app y, si trae la ruta de la APK, se lanza el instalador (desde primer plano,
 * que es cuando Android permite abrir actividades).
 */
class MainActivity : FlutterActivity() {
    private val canal = "ggto/actualizador"

    private var resultadoPermiso: MethodChannel.Result? = null

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
                    "permisoNotificaciones" -> resultado.success(permisoNotificaciones())
                    "solicitarPermisoNotificaciones" ->
                        solicitarPermisoNotificaciones(resultado)
                    "notificar" -> {
                        val titulo = llamada.argument<String>("titulo") ?: "Actualización"
                        val texto = llamada.argument<String>("texto") ?: ""
                        val ruta = llamada.argument<String>("ruta")
                        resultado.success(notificar(titulo, texto, ruta))
                    }
                    else -> resultado.notImplemented()
                }
            }
    }

    // ------------------------------------------------------------------ //
    // Instalación
    // ------------------------------------------------------------------ //

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

    // ------------------------------------------------------------------ //
    // Aviso cuando la descarga termina en segundo plano (D-108)
    // ------------------------------------------------------------------ //

    private fun permisoNotificaciones(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

    /** Pide el permiso de notificaciones (solo Android 13+) y responde al canal. */
    private fun solicitarPermisoNotificaciones(resultado: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || permisoNotificaciones()) {
            resultado.success(true)
            return
        }
        resultadoPermiso = resultado
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            CODIGO_PERMISO_NOTIFICACIONES,
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != CODIGO_PERMISO_NOTIFICACIONES) return
        val concedido = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        resultadoPermiso?.success(concedido)
        resultadoPermiso = null
    }

    /** Publica el aviso de «actualización descargada»; tocar abre el instalador. */
    private fun notificar(titulo: String, texto: String, ruta: String?): Boolean {
        if (!permisoNotificaciones()) return false
        crearCanalDeNotificaciones()
        val intento = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            if (!ruta.isNullOrBlank()) putExtra(EXTRA_APK, ruta)
        }
        val pendiente = PendingIntent.getActivity(
            this,
            0,
            intento,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notificacion = NotificationCompat.Builder(this, CANAL_NOTIFICACIONES)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(titulo)
            .setContentText(texto)
            .setStyle(NotificationCompat.BigTextStyle().bigText(texto))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendiente)
            .build()
        return try {
            NotificationManagerCompat.from(this).notify(ID_NOTIFICACION, notificacion)
            true
        } catch (e: SecurityException) {
            false
        }
    }

    private fun crearCanalDeNotificaciones() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val gestor = getSystemService(NotificationManager::class.java)
        if (gestor.getNotificationChannel(CANAL_NOTIFICACIONES) != null) return
        val canalAviso = NotificationChannel(
            CANAL_NOTIFICACIONES,
            "Actualizaciones de la app",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Avisa cuando una actualización ya está descargada y lista para instalar"
        }
        gestor.createNotificationChannel(canalAviso)
    }

    // ------------------------------------------------------------------ //
    // Notificación tocada: abrir el instalador
    // ------------------------------------------------------------------ //

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instalarSiVieneDeLaNotificacion(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        instalarSiVieneDeLaNotificacion(intent)
    }

    private fun instalarSiVieneDeLaNotificacion(intent: Intent?) {
        val ruta = intent?.getStringExtra(EXTRA_APK) ?: return
        intent.removeExtra(EXTRA_APK)
        try {
            instalar(File(ruta))
        } catch (e: Exception) {
            // Si la APK ya no está (caché limpiada), no se hace nada: la app queda
            // abierta y el técnico puede volver a descargarla.
        }
    }

    private companion object {
        const val CANAL_NOTIFICACIONES = "ggto_actualizaciones"
        const val ID_NOTIFICACION = 4711
        const val CODIGO_PERMISO_NOTIFICACIONES = 4712
        const val EXTRA_APK = "ggto_apk_para_instalar"
    }
}
