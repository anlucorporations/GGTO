# Incremento D-108 — El instalador avisa al técnico cuando la descarga termina en segundo plano

| Campo | Valor |
|---|---|
| Petición | «Que el instalador avise al técnico cuando la descarga termine en segundo plano» |
| Fecha | 2026-10-17 |
| Alcance | APK (`app_movil`) + publicación (`app/web/public/apk`) |
| Versión | **`1.9.0+18`** |

---

## 1. Situación de partida

Con D-107 la app descarga la APK y abre el instalador **siempre**. Si el técnico salía de la app
mientras descargaba (lo normal: 24 MB y se pone a atender otro caso), al terminar la descarga:

- Android **bloquea** abrir el instalador desde el fondo (restricción de *background activity start*),
  así que la ventana de instalación no aparecía;
- y no había ningún aviso: el técnico no sabía que la descarga había terminado.

---

## 2. Decisiones

| ID | Decisión |
|---|---|
| **DEC-108-1** | Si al terminar la descarga la app **no está en primer plano**, no se intenta abrir el instalador: se publica una **notificación** con la versión y la ruta de la APK |
| **DEC-108-2** | Tocar la notificación abre la app **y lanza el instalador** (ya en primer plano, que es cuando Android lo permite) |
| **DEC-108-3** | En Android 13+ el permiso de notificaciones se pide **al empezar la descarga**, para que el aviso funcione cuando haga falta; si se deniega, la instalación sigue disponible al volver a la app |
| **DEC-108-4** | La APK descargada se conserva en la caché y se reutiliza (con verificación de SHA-256): al volver a la app, «Instalar actualización» instala sin volver a descargar |

---

## 3. Qué cambió

### 3.1 Parte nativa (`MainActivity.kt`)

- **Canal de notificaciones** `ggto_actualizaciones` («Actualizaciones de la app»), creado una sola vez.
- Métodos nuevos del canal `ggto/actualizador`:
  - `permisoNotificaciones` → `POST_NOTIFICATIONS` concedido (API < 33: siempre `true`);
  - `solicitarPermisoNotificaciones` → pide el permiso en tiempo de ejecución y responde al canal con
    el resultado (`ActivityCompat.requestPermissions` + `onRequestPermissionsResult`);
  - `notificar` → publica el aviso con `PendingIntent` que abre `MainActivity` con la ruta de la APK.
- `onCreate`/`onNewIntent`: si la app viene de la notificación, **lanza el instalador** con esa ruta.
- `AndroidManifest.xml`: permiso **`POST_NOTIFICATIONS`**.

### 3.2 Orquestación (`actualizador_apk.dart`)

- Estado nuevo **`descargadaEnSegundoPlano`** y `ResultadoActualizacion.esExito` (éxito aunque la
  instalación quede pendiente de un toque).
- Antes de empezar se pide el permiso de notificaciones.
- Al terminar la descarga y verificar la huella: si `WidgetsBinding.lifecycleState` es `paused`,
  `hidden` o `detached`, se publica `avisarDescargaCompletada(version, ruta)` y se devuelve el estado
  nuevo; en primer plano se abre el instalador como antes.

### 3.3 Interfaz

- `tarjeta_version.dart`: el aviso de resultado distingue **«Actualización descargada»** (éxito, con el
  mensaje de la notificación) de «No se pudo actualizar», y el botón pasa a **«Instalar actualización»**
  cuando la descarga ya está hecha.
- `banner_actualizacion.dart`: tras la descarga en segundo plano, la franja cambia el botón a
  **«Instalar»** (la APK ya está en caché).
- Versión a **`1.9.0+18`**.

---

## 4. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-91 | Si la descarga termina en segundo plano, la app avisa por notificación y la instalación se hace desde el aviso |
| RNF-45 | El aviso no interrumpe el trabajo de campo: no hay ventanas emergentes desde el fondo y la APK queda lista para instalar |
| RT-33 | Pruebas del estado «descargada en segundo plano» y de la interfaz (tarjeta y franja con actualización inyectada) |

---

## 5. Archivos

| Archivo | Cambio |
|---|---|
| `app_movil/android/app/src/main/kotlin/com/example/ggto_tecnico/MainActivity.kt` | Canal de notificaciones, permiso y aviso con `PendingIntent` al instalador |
| `app_movil/android/app/src/main/AndroidManifest.xml` | `POST_NOTIFICATIONS` |
| `app_movil/lib/features/usuario/actualizador_apk.dart` | Estado nuevo, detección de segundo plano y `avisarDescargaCompletada` |
| `app_movil/lib/features/usuario/tarjeta_version.dart` | «Actualización descargada» / «Instalar actualización» |
| `app_movil/lib/features/usuario/banner_actualizacion.dart` | Botón «Instalar» tras la descarga en segundo plano |
| `app_movil/test/d107_actualizacion_test.dart` | 3 pruebas nuevas de D-108 |
| `app_movil/lib/core/constants.dart`, `pubspec.yaml` | Versión `1.9.0+18` |

---

## 6. Verificación

| Prueba | Resultado |
|---|---|
| `flutter analyze` | **«No issues found!»** |
| `flutter test` | **172/172 en verde** (169 + **3 nuevos** de D-108) |
| APK de release | **`1.9.0+18`** firmada con el keystore oficial, SHA-256 `c11b64ff…` |
| Permisos en el binario | `aapt2 dump permissions` → **`REQUEST_INSTALL_PACKAGES`** y **`POST_NOTIFICATIONS`** |
| Canal nativo | `ggto_actualizaciones` presente en `classes.dex` |
| Sitio | `/apk/apk.json` sirve **`1.9.0+18`** con su SHA-256 y el `.apk` responde **200** |

---

## 7. Pendiente

- **Prueba en dispositivo** con la app en segundo plano: iniciar la descarga, salir a inicio, esperar la
  notificación, tocarla y confirmar la instalación (la app se reemplaza sin perder la sesión).
- La primera instalación de esta serie sigue siendo manual para los equipos que tengan 1.6.0+15 /
  1.7.0+16; desde `1.8.0+17` en adelante el proceso es dentro de la app.
