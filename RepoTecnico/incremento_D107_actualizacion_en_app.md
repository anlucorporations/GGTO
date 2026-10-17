# Incremento D-107 — La APK se actualiza desde la propia app, sin reinstalarla

| Campo | Valor |
|---|---|
| Petición | «Modifica la APK para que el método actualice sin tener que reinstalar la APK» |
| Fecha | 2026-10-17 |
| Alcance | APK (`app_movil`) + publicación (`app/web/public/apk`) |
| Versión | **`1.8.0+17`** |

---

## 1. Situación de partida

La tarjeta de versión (D-102) comprobaba la última entrega y ofrecía **descargarla en el
navegador**: el técnico salía de la app, esperaba la descarga, la abría desde el gestor de archivos y
pasaba por el instalador del sistema. Aunque Android sustituye la app si la firma coincide, el
recorrido se percibía como «volver a instalar» y se prestaba a errores (descarga a medias, archivo
equivocado, no encontrarlo).

---

## 2. Decisión

| ID | Decisión |
|---|---|
| **DEC-107-1** | La actualización se descarga **dentro de la app** y se entrega al **instalador del sistema** (`ACTION_VIEW` + `FileProvider`). Android reemplaza la app **en su sitio**: no hay que desinstalar y se conservan la sesión y la base local (SQLite) |
| **DEC-107-2** | Antes de instalar se verifica el **SHA-256 publicado** en `apk.json`; si no coincide, el archivo se descarta y no se instala |
| **DEC-107-3** | El permiso de Android «instalar apps desconocidas» (API 26+) se gestiona desde la app: se detecta y se abre la pantalla de ajustes de la propia aplicación |
| **DEC-107-4** | La descarga por el navegador y el enlace copiable **se conservan** como alternativa (redes restringidas, gestor corporativo) |
| **DEC-107-5** | La comprobación es **silenciosa** al abrir la pantalla de casos: si hay entrega nueva aparece una franja con «Actualizar»; sin conexión no molesta |

---

## 3. Qué cambió

### 3.1 Parte nativa (`MainActivity.kt`)

Canal `ggto/actualizador` con tres métodos:

| Método | Efecto |
|---|---|
| `puedeInstalar` | `PackageManager.canRequestPackageInstalls()` en API 26+; `true` en versiones anteriores |
| `abrirAjustes` | Abre `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` de la propia app |
| `instalar` | Convierte la ruta en `content://` con el `FileProvider` existente (`${applicationId}.fileprovider`, cubierto por `res/xml/file_paths.xml` → `cache-path /`) y lanza el instalador con `FLAG_GRANT_READ_URI_PERMISSION` |

`AndroidManifest.xml`: permiso `REQUEST_INSTALL_PACKAGES` y consulta del instalador
(`INSTALL_PACKAGE` / `application/vnd.android.package-archive`).

### 3.2 Orquestación (`actualizador_apk.dart`)

`ActualizadorApk.actualizar(meta)`:

1. comprueba el permiso y, si falta, abre los ajustes y devuelve `requierePermiso`;
2. reutiliza una descarga previa **solo** si su SHA-256 coincide;
3. descarga `/apk/ggto-tecnico.apk` en la **caché interna** (`cacheDir/apk/`) con **progreso**,
   tiempo de espera de 5 minutos y limpieza de entregas anteriores;
4. verifica el SHA-256 y, si no coincide, borra el archivo y devuelve `huellaIncorrecta`;
5. abre el instalador y devuelve `instaladorAbierto` (o `instaladorNoDisponible`).

### 3.3 Interfaz

- `tarjeta_version.dart` (panel de usuario): la acción principal pasa a **«Actualizar ahora»**, con
  barra de progreso, fase de la descarga y aviso del resultado; debajo quedan «Descargar en el
  navegador», «Copiar enlace» y «Volver a comprobar», y una nota de que la actualización conserva la
  sesión y los datos.
- **Nuevo** `banner_actualizacion.dart`: franja en la pantalla de casos que comprueba en silencio al
  abrir y ofrece «Actualizar» cuando hay una entrega nueva (sin conexión no aparece).
- Versión a **`1.8.0+17`**.

---

## 4. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-90 | La app se actualiza desde sí misma: descarga la APK publicada y abre el instalador del sistema |
| RNF-44 | La APK instalada se verifica contra el SHA-256 publicado; una descarga alterada no se instala |
| RT-32 | Pruebas del actualizador (nombre del archivo, semántica del resultado, tarjeta y franja con actualización inyectada) |

---

## 5. Archivos

| Archivo | Cambio |
|---|---|
| `app_movil/android/app/src/main/kotlin/com/example/ggto_tecnico/MainActivity.kt` | Canal `ggto/actualizador` |
| `app_movil/android/app/src/main/AndroidManifest.xml` | `REQUEST_INSTALL_PACKAGES` y consulta del instalador |
| `app_movil/lib/features/usuario/actualizador_apk.dart` | **Nuevo**: descarga, verificación e instalación |
| `app_movil/lib/features/usuario/banner_actualizacion.dart` | **Nuevo**: franja «Actualizar» en la pantalla de casos |
| `app_movil/lib/features/usuario/tarjeta_version.dart` | «Actualizar ahora» con progreso |
| `app_movil/lib/features/casos/casos_screen.dart` | Usa la franja |
| `app_movil/test/d107_actualizacion_test.dart` | **Nuevo**: 8 pruebas |
| `app_movil/lib/core/constants.dart`, `pubspec.yaml` | Versión `1.8.0+17` |

---

## 6. Verificación

| Prueba | Resultado |
|---|---|
| `flutter analyze` | **«No issues found!»** |
| `flutter test` | **169/169 en verde** (161 + **8 nuevos** de D-107) |
| APK de release | **`1.8.0+17`** firmada con el keystore oficial, SHA-256 `f8030a4e…` |
| Permiso en el binario | `aapt2 dump permissions` → **`android.permission.REQUEST_INSTALL_PACKAGES`** presente |
| Canal nativo en el binario | `ggto/actualizador` presente en `classes.dex` |
| Sitio | `/apk/apk.json` sirve **`1.8.0+17`** con el SHA-256 del binario y `/apk/ggto-tecnico.apk` responde **200** |

---

## 7. Pendiente

- **Un último paso manual**: la versión instalada hoy (1.6.0+15 / 1.7.0+16) **no tiene** este código,
  así que la primera vez hay que instalar `1.8.0+17` de la forma habitual (botón «Descargar en el
  navegador» de la tarjeta o el enlace del sitio). A partir de ahí, todas las entregas siguientes se
  instalan desde la app con «Actualizar ahora».
- Prueba en dispositivo: comprobar que el instalador sustituye la app sin desinstalar y que la sesión y
  los datos locales siguen ahí.
