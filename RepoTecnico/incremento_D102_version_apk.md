# Incremento D-102 — Chequeo de la última versión de la APK desde el panel de usuario

| Campo | Valor |
|---|---|
| Petición | «Agrega a la APK el método de chequeo de la última versión desde el panel de usuario» |
| Fecha | 2026-10-16 |
| Alcance | `app_movil` (APK). Sin cambios de backend, de esquema ni de la web |
| Autor | Dirección del proyecto |

---

## 1. Qué se pidió y qué se entrega

Un **método de chequeo de la última versión** disponible de la APK, accesible desde el
**panel de usuario** de la aplicación. Se entrega:

1. **Regla pura de comparación** (`lib/core/version_app.dart`): interpreta `nombre+codigo`
   (`1.4.0+13`) y decide si lo publicado es más nuevo.
2. **Servicio de consulta** (`lib/features/usuario/version_service.dart`): lee el
   `apk.json` que publica `scripts/publicar_apk.py` y compone las URL de metadatos y descarga.
3. **Tarjeta del panel de usuario** (`lib/features/usuario/tarjeta_version.dart`): muestra
   la versión instalada y la publicada, el veredicto y, si procede, la descarga.
4. **Herramienta de diagnóstico** (`tool/consultar_version.dart`): comprueba el chequeo
   contra el servidor indicado sin instalar la APK.

---

## 2. De dónde sale la «última versión»

No hizo falta backend nuevo: el proyecto **ya publica** los metadatos de cada entrega.

`scripts/publicar_apk.py` copia la APK a `app/web/public/apk/` y regenera `apk.json`:

```json
{
  "archivo": "ggto-tecnico.apk",
  "ruta": "/apk/ggto-tecnico.apk",
  "nombre": "GGTO Técnico",
  "version": "1.4.0+13",
  "bytes": 24625676,
  "kb": 24049,
  "sha256": "7120b5a0…",
  "compilado_en": "2026-10-15T22:31:39.306710+00:00",
  "nota": "APK de evaluación. …"
}
```

La web lo sirve como archivo estático, así que la APK lo consulta **sin sesión**:

```
{origen}/apk/apk.json          ← metadatos (el origen sale de AppConstants.baseUrl)
{origen}/apk/ggto-tecnico.apk  ← binario
```

Verificado en producción: ambos responden **200** en
`https://ggto-web-593453426217.europe-west1.run.app`.

---

## 3. La regla (DEC-102)

| Caso | Resultado |
|---|---|
| El **código** publicado es mayor (`+14` > `+13`) | **Hay actualización** |
| Mismo código | Se compara el **nombre** `x.y.z` |
| El nombre publicado es mayor (`1.5.0` > `1.4.0`) | **Hay actualización** |
| Lo publicado es más antiguo o igual | Al día |
| El texto publicado no se puede interpretar (`sin-version`) | **No** se anuncia como actualización: se informa de que no se pudo comprobar |

Se prioriza el **código** porque es la regla que el proyecto ya aplica al entregar
(`pubspec.yaml:4`: el `versionCode` crece en cada entrega a CANTV). Un texto ilegible nunca
se convierte en un falso «descargue la actualización».

**DEC-102-a:** la comprobación es **automática al abrir el panel** y se puede repetir a mano
(no se sondea en segundo plano: es una consulta de un archivo pequeño y no debe gastar datos
del técnico sin que la pida).

**DEC-102-b:** la descarga **no** se hace dentro de la aplicación: se abre la URL en el
navegador. Instalar un APK desde la propia app exige un `Intent` de sistema y un paquete
nuevo (`open_filex` o equivalente); abrir el enlace reutiliza el camino que CANTV ya usa hoy
(la APK se instala desde la web) y no añade dependencias de instalación.

**DEC-102-c:** se añade **`url_launcher`** (paquete oficial de Flutter) para abrir la
descarga. Es la única dependencia nueva; sus implementaciones de escritorio y web ya estaban
en `pubspec.lock` como transitivas y el binario no crece de forma apreciable.

---

## 4. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-79 | La APK comprueba desde el panel de usuario si hay una versión más reciente publicada |
| RF-80 | Si hay actualización, ofrece descargarla (abriendo el enlace) y copiar el enlace |
| RNF-39 | El chequeo no bloquea la interfaz: si falla o no hay red, informa y deja seguir trabajando |
| RT-27 | Regla pura de comparación de versiones, verificable sin dispositivo ni red |
| DEC-102-a/b/c | Automático al abrir, descarga por navegador, dependencia `url_launcher` |

---

## 5. Verificación

| Prueba | Resultado |
|---|---|
| `flutter analyze` | **«No issues found!»** |
| `flutter test` | **150/150 en verde** (134 previos + **16 nuevos** de `test/d102_version_apk_test.dart`) |
| `flutter build apk --debug` | **Construida** (Gradle `assembleDebug` en 117 s) con el plugin nuevo |
| Chequeo real contra producción | `dart run tool/consultar_version.dart` → origen, metadatos, tamaño (23,5 MB), fecha (15/10/2026), URL de descarga y **SHA-256** correctos; veredicto **NO** para `1.4.0+13` |
| Chequeo real simulando la versión anterior | `… tool/consultar_version.dart <base> 1.3.0+12` → **SÍ — «Hay una versión más reciente (compilación 13 > 12)»** |

Pruebas nuevas: interpretación (`1.4.0+13`, con `v`, sin código, textos inválidos), la regla
en sus cinco casos, composición de las URL (`origenDeApi`, `urlMetadatos`, `urlDescarga`),
lectura del `apk.json` real y los **tres estados de la tarjeta** (al día, con actualización,
sin conexión) con la consulta inyectada.

---

## 6. Artefactos

| Archivo | Cambio |
|---|---|
| `app_movil/lib/core/version_app.dart` | **Nuevo**: `VersionApp`, `ComparacionVersion` y `compararVersiones` |
| `app_movil/lib/features/usuario/version_service.dart` | **Nuevo**: `MetaApk`, `VersionError` y `VersionService` (Dio propio, sin token) |
| `app_movil/lib/features/usuario/tarjeta_version.dart` | **Nuevo**: tarjeta del panel con los cuatro estados |
| `app_movil/lib/features/usuario/usuario_screen.dart` | Añade `TarjetaVersion` tras «Datos administrativos» |
| `app_movil/lib/core/theme.dart` | (Sin cambios en este incremento; los colores salen de `Marca`) |
| `app_movil/tool/consultar_version.dart` | **Nuevo**: diagnóstico del chequeo contra un servidor |
| `app_movil/test/d102_version_apk_test.dart` | **Nuevo**: 16 pruebas |
| `app_movil/pubspec.yaml` | Añade `url_launcher: ^6.3.0` |
| `docs/propuesta-visual-apk/mockup/apk.html` | **Pantalla 8**: el panel de usuario con el chequeo, en sus dos estados |

---

## 7. Entrega publicada

| Dato | Valor |
|---|---|
| Versión | **1.5.0+14** (`pubspec.yaml` y `constants.dart`) |
| APK | `app_movil/GGTOv2.apk` · 23,7 MB |
| SHA-256 | `35a4c037b33e88b65bfb513b8cae73793e22b69e4826d0c7b679e9fbe539b310` |
| Firma | `CN=GGTO Tecnico, OU=Proyecto GGTO, O=Ing. Angel H. Lucci, L=Caracas, ST=Miranda, C=VE` (keystore oficial, `apksigner verify` OK) |
| Publicada en | `app/web/public/apk/ggto-tecnico.apk` + `apk.json` |
| Despliegue | Cloud Run **`ggto-web-00045-jbc`** (100 % del tráfico, imagen `ggto-web:v32`) |

**Verificación de la cadena completa en producción** (`dart run tool/consultar_version.dart`):

```
Instalada    : 1.5.0+14     → Publicada: 1.5.0+14     → ¿Actualizar? NO
Instalada    : 1.4.0+13     → Publicada: 1.5.0+14     → ¿Actualizar? SÍ — «compilación 14 > 13»
```

El `apk.json` servido declara `1.5.0+14`, `kb` 24239 y el **mismo SHA-256** que el binario
publicado; el binario responde **200** (23,67 MB). Es decir: un técnico con la APK anterior
verá el aviso y podrá descargar la nueva.

## 8. Pendiente

- **Documentar `url_launcher`** en el manual de dependencias.
- **Prueba en dispositivo**: el diálogo de descarga del navegador y la instalación del APK
  descargado solo se comprueban en un equipo real o en un emulador.
