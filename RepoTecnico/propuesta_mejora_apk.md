# Propuesta de mejora — APK «GGTO Técnico» (`app_movil`)

| | |
|---|---|
| **Artefacto analizado** | `app_movil/` — APK `GGTOv2.apk` / `app-release.apk` (22,0 MiB), `version: 1.0.0+1` |
| **Fecha del análisis** | 2026-10-01 |
| **Alcance** | Código Flutter (21 archivos, 1 053 líneas), empaquetado Android, contrato real con el backend FastAPI (`app/`), trazabilidad contra `RepoTecnico/requerimientos.md` (RF-11…RF-20, RF-GESTIÓN TÉCNICA §4) |
| **Método** | Lectura íntegra del código, inspección del APK y de `build/`, verificación endpoint-por-endpoint contra `app/api/**` y `app/schemas/**` con evidencia `archivo:línea` |
| **Veredicto** | **La APK 1.0.0+1 no es operable contra el backend desplegado.** 8 defectos bloqueantes (P0) impiden el flujo de campo completo; el 100 % de las escrituras que realiza el técnico recibe 403/404/422 y la lista de casos nunca se llena. Se requiere una Fase 0 de contrato en el backend antes de que la APK pueda funcionar |

---

## 1. Resumen ejecutivo

La APK está construida como un **prototipo de pantallas**: la navegación, el modelo de estado y la intención funcional están bien encaminados (Provider, SQLite, cola offline, cámara, GPS), pero **la capa de integración no se ejecutó ni una vez contra la API real**. Las tres causas raíz son:

1. **Nunca se activa la autenticación HTTP.** `ApiClient.init()` —el único lugar donde se registra el interceptor que añade `Authorization: Bearer`— **no se invoca desde ningún punto del código**. Toda petición autenticada devuelve 401, y los `catch` vacíos lo ocultan: la lista de casos se ve *vacía*, no *rota*.
2. **La APK habla un contrato que no existe.** `GET /casos` responde `items` (la app lee `casos`), `PATCH /casos/{id}` no acepta `motivo_cierre` (es `motivo_estado`), `POST /citas` exige `fecha_hora` (la app envía `fecha`), `POST /incidentes` **no existe** en el backend y `/fallas-masivas` no tiene campo `tipo`.
3. **El rol `TECNICO` no puede escribir.** Las tres escrituras de la app (`PATCH /casos/{id}`, `POST /citas`, `POST /fallas-masivas`) están restringidas a `ADMIN`/`SUPERVISOR`. El único endpoint que sí admite al técnico (`POST /casos/{id}/estado`, D-68) es justamente el que la app **no** usa.

Adicionalmente, el cumplimiento del brief es parcial: no hay subida de evidencias al servidor (RF-14 queda en local), no hay enrolamiento de primer acceso con las 12 palabras ni documento de seguridad cifrado (RF-20 / RNF-03), no hay ficha administrativa/técnica ni método de cierre (RF-GESTIÓN TÉCNICA 4.2), el ZIP de jornada es un `SnackBar` (4.3), y el APK de release está **firmado con la clave de depuración** con `applicationId com.example.ggto_tecnico`.

**Esfuerzo estimado: 34–45 días-desarrollador** (1 móvil + apoyo backend parcial) + 5–8 días de QA en dispositivo, ejecutables en **5 fases** con valor entregable al final de cada una. Las 10 acciones «quick win» de §6 restablecen un flujo demostrable en **2–3 días**.

---

## 2. Inventario verificado

| Métrica | Valor |
|---|---|
| Archivos Dart en `lib/` | 21 (1 053 líneas) |
| Dependencias declaradas | 12 (+2 dev) — **4 sin usar**: `path_provider`, `archive`, `share_plus`, `intl` |
| Pruebas | **0** (no existe `app_movil/test/`; `flutter_test` está declarado) |
| `analysis_options.yaml` | **Ausente** → `flutter_lints` declarado pero **inactivo** |
| APK release | 22,0 MiB, 113 entradas, 49,2 MB descomprimidos, 3 ABIs (incluye `x86_64`) |
| Firma del release | `signingConfigs.debug` (`android/app/build.gradle:31`) |
| Identidad | `applicationId com.example.ggto_tecnico`, `minSdk 21`, `targetSdk/compileSdk 35` |
| Toolchain | Flutter 3.24.3 (`android/local.properties`), Gradle 8.7, AGP 8.6.0, Kotlin 2.1.0, NDK 26.1.10909125 |
| Higiene | Sin `.git`, sin `.gitignore`; `build/` = **223 MB / 6 330 archivos**; **dos copias** del APK en la raíz de la app; `generate_app.py` regenera los fuentes con versiones antiguas |
| Base URL | `https://ggto-web-593453426217.europe-west1.run.app/api/v1` (`lib/core/constants.dart:2`) |

---

## 3. Hallazgos

Severidad: **P0** = impide operar · **P1** = función del brief ausente o incorrecta · **P2** = seguridad/privacidad · **P3** = rendimiento, tamaño, accesibilidad · **P4** = calidad, pruebas, entrega.

### 3.1 P0 — Bloqueantes (la APK no funciona contra el backend)

| ID | Hallazgo | Evidencia (app) | Evidencia (backend) | Efecto real |
|---|---|---|---|---|
| **H-01** | `ApiClient.init()` nunca se invoca → **el interceptor que añade `Authorization: Bearer` jamás se registra** | `lib/core/api_client.dart:8-18`; `lib/main.dart:14-28`; 0 llamadas a `ApiClient.init` | `app/api/deps.py:22-38` (JWT obligatorio) | `/auth/me` y `/casos` → **401 silencioso**; nombre vacío y lista vacía sin ningún error visible |
| **H-02** | `GET /casos` responde `{items,total,page,page_size,pages}`; la app lee `data['casos']` | `lib/features/casos/casos_provider.dart:16` | `app/schemas/casos.py:104-109`; `app/api/routes_casos.py:180-186` | La lista de casos **nunca** se llena; `?? []` convierte el fallo en «no hay casos» |
| **H-03** | Las 3 escrituras de campo usan endpoints restringidos a `ADMIN`/`SUPERVISOR` | `atender_screen.dart:19`; `contactar_screen.dart:19,40-41`; `alertas_screen.dart:20` | `routes_casos.py:44,309`; `routes_especiales.py:47,306`; `routes_alertas.py:31,69` | **403 Forbidden** en contactar, citar, cerrar, enrutar y reportar falla masiva |
| **H-04** | Campo `motivo_cierre` inexistente (el real es `motivo_estado`) | `atender_screen.dart:22` | `app/schemas/casos.py:147` | Pydantic **descarta el motivo sin error** → el reporte del técnico se pierde |
| **H-05** | No se usa el flujo de cierre real del backend (modo + descripción + causa + seriales) | `atender_screen.dart:14-29` (dropdown + texto libre) | `POST /casos/{id}/cierre` → `CierreCaso` en `routes_casos.py:391-451`, `schemas/casos.py:184-195` | No se crea registro en `actividad` ni `evidencia` → **RF-13/RF-14/RF-15 incumplidos**; el supervisor no ve el trabajo |
| **H-06** | `POST /auth/unlock` **no devuelve token**; la app lo lee e intenta guardarlo | `auth_provider.dart:46-47` (`saveToken(null)`) | `routes_auth.py:350-366` (retorna `{p00,bloqueado,mensaje}`) | `TypeError` capturado por el `catch` → `unlock()` devuelve `false`. **El desbloqueo con las 12 palabras nunca funciona**: tras 3 intentos fallidos la cuenta queda sin salida (RF-20/RNF-01) |
| **H-07** | `POST /citas` exige `fecha_hora`; la app envía `fecha`. **Y la rama offline no encola nada** | `contactar_screen.dart:40-48` (comentario «Guardar offline» sin `insert`) | `schemas/especiales.py:94-102` | **422** + pérdida silenciosa: se muestra «Error o guardado offline» y la cita no existe en ningún lado |
| **H-08** | `POST /incidentes` **no existe** en el backend y el ítem queda en la cola para siempre; `sincronizar()` hace `break` ante el primer fallo | `alertas_screen.dart:32-38`; `sync_provider.dart:36-39` | Sin ruta ni modelo (solo tabla `incidente`, `RepoTecnico/db/schema.sql:547-559`) | 404 → **bloqueo en cabeza de cola**: ninguna acción posterior se sincroniza jamás (pérdida de datos de toda la jornada) |
| **H-09** | `POST /fallas-masivas`: campo `tipo` inexistente (el modelo usa `descripcion`, `id_sector`, `id_cuadrilla`, `origen`) | `alertas_screen.dart:20-23` | `schemas/alertas.py:29-33` | El tipo OLT/FAT/SECTOR se descarta; la alerta llega sin clasificar |
| **H-10** | **Las evidencias nunca salen del dispositivo**: no hay subida y `evidencia_local` no la lee nadie | `camara_screen.dart:43-53`; 0 referencias a `evidencia_local` fuera de la inserción; 0 usos de `MultipartFile` | No existe endpoint de subida (el único multipart es la ingesta CSV, `routes_ingesta.py:124-145`) | **RF-14 incumplido en su parte esencial**: la foto con GPS queda en el teléfono y se pierde al desinstalar |
| **H-11** | Sin sesión offline: todo el arranque depende de la red | `auth_provider.dart:16-38`; `login_screen.dart:16-30` | — | **RNF-06 incumplido en el arranque**: sin cobertura el técnico no puede entrar a trabajar |
| **H-12** | El técnico no tiene «sus casos»: no hay filtro por técnico/cuadrilla y `estado_actual=ASIGNADO` no acota propiedad | `casos_provider.dart:15` | `routes_casos.py:113-129` (sin parámetro de técnico); `Usuario.id_tecnico` no se usa | Se listan casos de **todas las centrales**; con `PATCH` habilitado habría **IDOR** (operar casos ajenos) → RNF-21 |

### 3.2 P1 — Función del brief ausente o incorrecta

| ID | Hallazgo | Evidencia | Requisito |
|---|---|---|---|
| **H-13** | Sin caché local: `caso_local` nunca se escribe ni se lee (el propio código lo admite) | `casos_provider.dart:17`; `core/database.dart:24-29` | RNF-06 |
| **H-14** | Cola offline sin estados: sin `intentos`, sin backoff, sin idempotencia, sin UI de errores/descarte | `sync_provider.dart:19-42`; tabla `accion_pendiente` (`database.dart:30-39`) | RNF-06 |
| **H-15** | `_bloqueado`/`_intentosFallidos` solo en memoria **y cualquier excepción cuenta como intento fallido**, incluidos los fallos de red | `auth_provider.dart:8-9,30-34` | RNF-01/RNF-22 |
| **H-16** | El backend informa `423`, `detail` y `X-Intentos-Restantes`; la app muestra «Error en login» y no distingue 401/403/423/429/5xx | `login_screen.dart:25-27` | RNF-09 |
| **H-17** | El rol nunca se lee (`usuario.rol` en la respuesta de login): la UI de campo no valida que el usuario sea `TECNICO` | `auth_provider.dart:19-28`; `schemas/auth.py:13-20` | RNF-21 |
| **H-18** | Sesión sin manejo de expiración (JWT 480 min, **sin refresh**) y sin re-login ante 401 | `api_client.dart:9-18`; `app/core/config.py:30` | RNF-22 |
| **H-19** | Enrolamiento de primer acceso no implementado: no se usan `GET /auth/primer-acceso` ni `POST /auth/setup`; no se muestran las 12 palabras, no hay documento de seguridad cifrado ni clave privada de la app | 0 referencias a `primer-acceso`/`setup` en `lib/`; `routes_auth.py:130-292` | RF-20, RF-GESTIÓN TÉCNICA 4.3, RNF-03 |
| **H-20** | Sin «olvidé mi clave» aunque el backend lo soporta (`POST /auth/reset-password`, clave ≥ 8) | 0 referencias; `routes_auth.py:369-385` | RF-20 |
| **H-21** | La pantalla DISPOSITIVO/ZIP es un stub: solo muestra un `SnackBar` | `sync_screen.dart:19-21,40-43` | RF-GESTIÓN TÉCNICA 4.3 |
| **H-22** | Catálogos hardcodeados en lugar de `GET /configuracion/catalogos/causas` y `/catalogos/metodos` | `atender_screen.dart:41-45`; `alertas_screen.dart:54-58,69-72` | RNF-10 |
| **H-23** | CONTACTAR incompleto: falta DIFERIDO con fecha/hora, falta control de solape y la cita se captura **solo con fecha** (sin hora) | `contactar_screen.dart:64-82`; `CitaCreate.permitir_solape` | RF-12, §4.1 |
| **H-24** | ATENDER incompleto: sin ficha **Administrativa** (número, plan, serial, tipo de servicio) ni **Técnica** (OLT, slot, puerto, ruta, FAT); no exige estado `CONTACTADO`; sin método de cierre (IVR/COS/SACAS) ni causa | `atender_screen.dart:32-72` | §4.2 |
| **H-25** | Alertas incompletas: falta solicitud de material (RF-18) y planificación de falla masiva con reporte + evidencias (RF-17); los tipos de incidente no coinciden con el esquema (`VEHICULO` vs `FLOTA`) | `alertas_screen.dart:52-75`; `RepoTecnico/db/schema.sql:547-559` | RF-16…RF-19 |
| **H-26** | Sin búsqueda: RNF-09 exige hallar la ficha por teléfono en ≤ 10 s; no se usa `q`/`telefono` ni `GET /casos/buscar` | `casos_screen.dart:50-75` | RNF-09 |
| **H-27** | Sin estados de UI: sin vacío, sin error, sin pull-to-refresh, sin reintento; los `catch` vacíos ocultan todo | `casos_provider.dart:18-19`; `auth_provider.dart:64-66`; `atender_screen.dart:25-28` | RNF-09 |

### 3.3 P2 — Seguridad y privacidad

| ID | Hallazgo | Evidencia | Riesgo |
|---|---|---|---|
| **H-28** | Release firmado con la **clave de depuración** | `android/app/build.gradle:31` | APK no distribuible; cualquiera puede firmar actualizaciones suplantando la app |
| **H-29** | `applicationId com.example.ggto_tecnico` (placeholder) | `build.gradle:22`; `MainActivity.kt` en `com/example/ggto_tecnico` | No publicable; identidad definitiva pendiente |
| **H-30** | Sin bloqueo de app ni re-autenticación (RNF-05) y sin `FLAG_SECURE`: la PII del cliente queda visible en el conmutador de recientes y ante terceros | `casos_screen.dart:41-47` (solo logout manual) | RNF-05, RNF-18 |
| **H-31** | `android:allowBackup` por defecto `true`, sin `dataExtractionRules` → `adb backup` puede extraer `ggto.db` (clientes, direcciones, rutas de evidencias) | `AndroidManifest.xml:20-23` | Fuga de PII en dispositivo comprometido |
| **H-32** | Permisos de almacenamiento amplios e innecesarios (la cámara escribe en caché propio) | `AndroidManifest.xml:16-18` | Rechazo en revisión y superficie innecesaria (RNF-04) |
| **H-33** | Sin `usesCleartextTraffic=false` explícito, sin `network_security_config` ni pinning; sin política de cifrado del archivo de evidencia | `AndroidManifest.xml` | RNF-18 |
| **H-34** | JWT en `FlutterSecureStorage` sin opciones explícitas de cifrado y sin borrado en 401 | `core/auth_storage.dart:4` | Sesión zombi y residuo de token |
| **H-35** | Sin R8/ProGuard (`minifyEnabled`/`shrinkResources` ausentes) | `build.gradle:29-33` | APK inflado y símbolos expuestos |
| **H-36** | Sin logging estructurado, auditoría local ni crash reporting (RNF-12/RNF-19) | 0 dependencias de observabilidad | Incidentes de campo indiagnosticables |

### 3.4 P3 — Rendimiento, tamaño y accesibilidad

| ID | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| **H-37** | APK fat con 3 ABIs, **incluida `x86_64` (16,7 MB)** inútil en campo | APK: `lib/x86_64` 16,72 MB + `arm64-v8a` 15,66 + `armeabi-v7a` 13,21 | 22 MiB descargables; con `--split-per-abi`/App Bundle baja ~55-65 % |
| **H-38** | Sin compresión ni serial de imagen: se guarda el original de la cámara, sin resolución límite ni nombre normalizado | `camara_screen.dart:19-25,44-50` | El brief exige «baja calidad» + serial `N.º caso + id_averia + tipo + fecha/hora` (§4.3) |
| **H-39** | Dio sin `connectTimeout`/`receiveTimeout`/`CancelToken` | `api_client.dart:6` | En 2G/3G la app queda colgada sin retroalimentación |
| **H-40** | Sin política de retención/limpieza local de evidencias | `database.dart:40-49` | Crecimiento sin límite; RNF-18 fija retención de evidencias (2 años) |
| **H-41** | Accesibilidad (RNF-23) no verificada: tema con tamaños por defecto de Material (~14 sp), `DropdownButton` con objetivos táctiles < 48 dp, contraste insuficiente en `EstadoChip` (`Colors.orange`/`blue` con texto blanco), sin `Semantics` | `core/theme.dart:3-26`; `widgets/estado_chip.dart:10-20`; `atender_screen.dart:39-47` | RNF-23 incumplido (≥48 dp, ≥4.5:1, ≥16 sp, lector de pantalla) |
| **H-42** | `targetSdk 35` con Flutter 3.24.3: Android 15 fuerza *edge-to-edge*; no hay `SafeArea` ni `SystemUiOverlayStyle`. Además el NDK 26.1 no garantiza páginas de 16 KB (requisito de Play) | `build.gradle:9-10,24` | UI bajo las barras del sistema en Android 15; riesgo de rechazo en Play (**verificar en dispositivo API 35 antes de decidir**) |
| **H-43** | Sin icono adaptativo (`mipmap-anydpi-v26` ausente) y el icono actual es el **logo por defecto de Flutter**; `styles.xml` usa `Theme.Black.NoTitleBar` | `res/mipmap-*/ic_launcher.png`; `res/values/styles.xml:3-8` | Imagen de marca y splash pendientes; parpadeo de arranque |

### 3.5 P4 — Calidad, pruebas y entrega

| ID | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| **H-44** | **0 pruebas** (ni unitarias, ni de widget, ni de integración) en los flujos críticos: login, unlock, sync, cierre | No existe `app_movil/test/` | Ninguna regresión se detecta; RNF-24 (calidad y entrega) no cubre la APK |
| **H-45** | `flutter_lints` declarado **sin `analysis_options.yaml`** → lints inactivos. Además `catch` vacíos, `void logout() async`, `TextEditingController` sin `dispose()`, uso de `context` tras `await` sin `mounted` | `pubspec.yaml:28`; `auth_provider.dart:64-74`; `camara_screen.dart:27-53` | Deuda silenciosa |
| **H-46** | Sin control de versiones ni CI: no hay `.git`, ni `.gitignore`; se versionarían 223 MB de `build/`, `.dart_tool/`, `local.properties` y **dos copias** del APK | Raíz de `app_movil/` | Imposible trazabilidad ni revisión de cambios |
| **H-47** | `generate_app.py` (36 KB) **regenera** `pubspec.yaml`, `lib/main.dart`, etc. con versiones antiguas (p. ej. `geolocator: ^1.0.1`) | `generate_app.py:6-120` | **Ejecutarlo sobrescribe todas las correcciones de esta propuesta** |
| **H-48** | 4 dependencias sin usar (`path_provider`, `archive`, `share_plus`, `intl`) y un `dependency_overrides: geolocator_android: ^5.0.0` sin justificar | `pubspec.yaml:13-31`; 0 importaciones en `lib/` | Ruido y riesgo de resolución |
| **H-49** | BD local sin migraciones: `openDatabase(version: 1, onCreate:)` sin `onUpgrade` | `core/database.dart:20` | Cualquier cambio de esquema obliga a reinstalar (se pierden evidencias) |
| **H-50** | Sin `README`, `CHANGELOG` ni política de versiones de la app (`version: 1.0.0+1` fija a mano) | `pubspec.yaml:4` | Entrega no reproducible |

---

## 4. Trazabilidad con el brief (`RepoTecnico/requerimientos.md`)

| Requisito | Estado | Brecha |
|---|---|---|
| RF-11 — ficha de los casos de **su cuadrilla** | ❌ | H-02, H-12, H-24 (sin ficha completa ni alcance por técnico) |
| RF-12 — contactar y agendar | ⚠️ | H-03, H-07, H-23 (403, 422, sin hora ni solape, sin DIFERIDO) |
| RF-13 — documentar la actividad | ❌ | H-05 (no se crea `actividad`; `motivo_cierre` se descarta) |
| RF-14 — registro fotográfico con GPS, **solo cámara** | ⚠️ | Fuente cámara ✔ (`image_picker` sin galería), pero H-10 (no se sube), H-38 (sin compresión ni serial) |
| RF-15 — documentar la resolución | ❌ | H-05 (modo IVR/COS/SACAS, causa y evidencias no se registran) |
| RF-16/RF-19 — fallas masivas e incidentes | ❌ | H-03, H-08, H-09, H-25 |
| RF-17/RF-18 — planificación y solicitud de material | ❌ | H-25 (no implementados) |
| RF-20 — `P00`+clave, 3 intentos, 3 de 12 palabras, bloqueo de app | ❌ | H-06, H-15, H-19, H-20, H-30 |
| §4.1 CONTACTAR / §4.2 ATENDER / §4.3 DISPOSITIVO+ZIP | ⚠️/❌ | H-21, H-22, H-23, H-24 |
| RNF-01, RNF-03, RNF-04, RNF-05 | ❌ | H-06, H-15, H-19, H-30, H-32 |
| RNF-06 — offline con sincronización asíncrona **sin pérdida** | ❌ | H-07, H-08, H-11, H-13, H-14 |
| RNF-09 — ≤ 3 toques / ≤ 20 s, a una mano | ⚠️ | H-23, H-26, H-27 (sin medir; sin búsqueda) |
| RNF-10 — catálogos configurables | ❌ | H-22 |
| RNF-12 — trazabilidad | ❌ | H-05, H-36 |
| RNF-13 — fechas `dd/mm/aaaa hh:mm` | ⚠️ | Se muestran ISO-8601 crudos (`contactar_screen.dart:77`); `intl` está declarado sin usar |
| RNF-18 — PII, retención, cifrado | ❌ | H-30, H-31, H-40 |
| RNF-21 — RBAC y alcance | ❌ | H-03, H-12 |
| RNF-22 — endurecimiento de sesión | ⚠️ | H-15, H-16, H-18, H-34 |
| RNF-23 — accesibilidad APK | ❌ | H-41 |
| RNF-24 — CI, lints, cobertura | ❌ | H-44, H-45, H-46 |

---

## 5. Plan de mejora por fases

> Regla de secuencia: **la Fase 0 es prerrequisito de las Fases 1–3**. Sin endpoints para `TECNICO` y sin subida de evidencias, ningún trabajo en la APK puede cerrar el flujo de campo.

### Fase 0 — Contrato: cerrar la brecha backend ↔ móvil · 8–11 d (backend)

| # | Entregable | Detalle |
|---|---|---|
| 0.1 | Endpoints de escritura para `TECNICO` con **alcance por cuadrilla/central** | Habilitar `TECNICO` en `POST /casos/{id}/cierre`, `/cita`, `/enrutado` (`routes_casos.py:391-526`) o crear sus equivalentes `…/cierre-tecnico` con verificación de que el caso pertenece al técnico autenticado (`Usuario.id_tecnico` → `despacho_caso`) |
| 0.2 | `GET /casos/mis-casos` (o `?id_cuadrilla=`/`?mis=true`) con alcance forzado por token | Cierra H-12 y habilita la bandeja real del técnico (fuente: despacho del día) |
| 0.3 | `POST /casos/{id}/evidencias` **multipart** (`archivo: UploadFile`, `tipo: POTENCIA\|NAVEGACION\|DEMO`, `serial`, `latitud`, `longitud`, `fecha_hora`) → guarda el binario (GCS/Cloud Storage) y devuelve el serial | Cierra H-10; hoy la evidencia solo se acepta como texto (`schemas/casos.py:193`) |
| 0.4 | `POST /incidentes` (o `/flota/incidentes`) con `FallaMasivaManual`-style: `tipo` ∈ `FLOTA\|HERRAMIENTA`, `id_flota`/`id_herramienta`, `descripcion`, evidencias | Cierra H-08; alinear con el CHECK de `RepoTecnico/db/schema.sql:547-559` |
| 0.5 | `POST /auth/unlock` devuelve `TokenResponse` **o** la app pasa a flujo `unlock → login`/`reset-password` | Cierra H-06 (recomendado: no emitir token en `unlock`; emitirlo es un cambio de contrato menor pero útil para RNF-06) |
| 0.6 | Idempotencia de sincronización: cabecera `Idempotency-Key` aceptada en los POST de campo, y `GET /sync/jornada?fecha=` que devuelva el despacho + catálogos + `version_palabras` | Cierra H-14/H-21 en su parte servidor |
| 0.7 | `tipo` en `FallaMasivaManual` (o catálogo `origen_falla`) | Cierra H-09 |

### Fase 1 — Desbloquear el flujo (P0) · 4–5 d

`ApiClient.init()` en `main()` + timeouts + interceptor `onError 401` (`H-01`, `H-18`, `H-39`) · lectura de `items` (`H-02`) · migración a `POST /casos/{id}/estado` con `motivo_estado` (`H-03`, `H-04`) · consumo de `POST /casos/{id}/cierre` (`H-05`) · `POST /citas` con `fecha_hora` + cola offline real (`H-07`) · retirar `POST /incidentes` de la cola hasta 0.4 y **eliminar el `break` bloqueante** para que un 4xx se marque como error y la cola continúe (`H-08`) · mensajes de error del backend (`detail`, `423`, `X-Intentos-Restantes`) y **no contar los fallos de red** como intentos (`H-15`, `H-16`) · contrato de `unlock` corregido (`H-06`) · verificación de rol (`H-17`).

**Criterio de aceptación:** en dispositivo real, un `TECNICO` completa login → lista con casos → CONTACTADO → cita con fecha y hora → cierre con modo y causa, y todo queda visible en la web (actividad + bitácora).

### Fase 2 — Offline-first real (RNF-06) · 6–8 d

Repositorio + DAO con caché `caso_local` (lectura offline y refresco en segundo plano) (`H-13`) · **outbox robusto** con `estado`/`intentos`/`proximo_intento`/`ultimo_error`/`idempotency_key` y backoff exponencial (`H-14`) · subida de evidencias en cola con compresión, serial y reintento (`H-10`, `H-38`) · motor de sincronización *single-flight*, **aislado por ítem** (un 404/409/422 no detiene la cola), disparado al recuperar conectividad (`connectivity_plus`) (`H-08`) · sesión offline con token cacheado + relogin al volver la red (`H-11`) · pantalla de sincronización con métricas por ítem, errores visibles y descarte manual (`H-21`, `H-27`) · migraciones locales (`onUpgrade`) (`H-49`) · retención/limpieza de evidencias (`H-40`).

**Criterio de aceptación (RNF-06):** prueba en modo avión — alta de actividad, cierre y 3 fotos; al recuperar red, todo se sincroniza **sin pérdida** y sin intervención del usuario; el contador de pendientes llega a 0 y la bitácora web refleja cada acción.

### Fase 3 — Cumplimiento funcional del brief · 8–10 d

Ficha del caso con secciones **Administrativa** y **Técnica** (`H-24`) · CONTACTAR/DIFERIDO con fecha-hora, control de solape y agenda (`H-23`) · catálogos desde API: causas y métodos de cierre/enrutado (`H-22`) · búsqueda por teléfono/`id_averia` y filtros (`H-26`) · alertas completas: falla masiva tipificada, planificación con evidencias (RF-17), incidentes (RF-19) y solicitud de material (RF-18) (`H-25`) · enrolamiento de primer acceso: `GET /auth/primer-acceso` → `POST /auth/setup` → mostrar 12 palabras → **documento de seguridad cifrado con la clave privada de la app** (AES-GCM con clave en Keystore) + `POST /auth/reset-password` (`H-19`, `H-20`) · ZIP de jornada `central+cuadrilla+fecha` con despacho y evidencias (`H-21`) · fechas `dd/mm/aaaa hh:mm` con `intl` y locale `es_VE` (RNF-13).

### Fase 4 — Seguridad, accesibilidad y calidad · 6–8 d

`allowBackup=false` + `dataExtractionRules` (`H-31`) · retirar permisos de almacenamiento (`H-32`) · `usesCleartextTraffic=false` y, si el backend lo permite, pinning de certificado (`H-33`) · **bloqueo de app** por inactividad con PIN/biometría + `FLAG_SECURE` (RNF-05, `H-30`) · opciones explícitas de `FlutterSecureStorage` y limpieza en 401 (`H-34`) · R8/`shrinkResources` (`H-35`) · tema accesible: fuente base ≥ 16 sp, objetivos ≥ 48 dp, contraste ≥ 4.5:1, `Semantics` y `textScaler` acotado (`H-41`) · `analysis_options.yaml` + `dart format` + `flutter analyze` en CI (`H-45`) · **pruebas**: unitarias del outbox/serial/formatos, de widget de las 5 pantallas críticas, de integración de un ciclo offline completo, y `mocktail`/`dio` `MockAdapter` para contrato (`H-44`) · logging con correlación y crash reporting (Sentry/Crashlytics) (`H-36`) · verificación Android 15 (edge-to-edge, páginas 16 KB) (`H-42`).

### Fase 5 — Empaquetado y entrega · 2–3 d

Keystore de release propio + `signingConfigs.release` con secretos por variable de entorno (`H-28`) · `applicationId` definitivo acordado con CANTV (`H-29`) · `flutter build appbundle --obfuscate --split-debug-info` y `apk --split-per-abi` (`H-37`) · icono adaptativo, splash y marca (`H-43`) · `.gitignore` + `git init` + retirar APKs y `build/` del árbol (`H-46`) · **retirar `generate_app.py` a `scripts/legacy/`** (`H-47`) · limpieza de dependencias (`H-48`) · `README.md`, `CHANGELOG.md` y política de versiones (`H-50`) · pipeline CI: `analyze` + `test` + `build` en cada PR (RNF-24).

### Esfuerzo consolidado

| Fase | Dev-días | Dependencia |
|---|---|---|
| 0 — Contrato backend | 8–11 | — |
| 1 — Desbloqueo | 4–5 | 0.1, 0.4, 0.5 |
| 2 — Offline-first | 6–8 | 0.3, 0.6 |
| 3 — Cumplimiento funcional | 8–10 | 0.2, 0.3, 0.7 |
| 4 — Seguridad/accesibilidad/calidad | 6–8 | — |
| 5 — Empaquetado y entrega | 2–3 | — |
| **Total** | **34–45** | + 5–8 d QA en dispositivo |

---

## 6. Quick wins (2–3 días, máximo impacto)

> ### ✅ ESTADO: aplicados (D-73, 2026-10-01)
>
> Los diez quick wins de esta sección **ya están implementados** en `app_movil/`.
> Resultado verificado: `flutter analyze` sin hallazgos (con `analysis_options.yaml`
> activo y lints estrictos), **6/6 pruebas unitarias** en verde y APK recompilada.
>
> | # | Quick win | Estado | Dónde se resolvió |
> |---|---|---|---|
> | 1 | `ApiClient.init()` en `main()` con timeouts e interceptor 401 | ✅ | `lib/core/api_client.dart` (+ `main.dart` con `navigatorKey` para cerrar sesión al expirar) |
> | 2 | `response.data['items']` en lugar de `['casos']` | ✅ | `lib/features/casos/casos_provider.dart` (`_extraerItems` acepta `items`, `casos` o lista) |
> | 3 | `POST /casos/{id}/estado` con `motivo_estado` | ✅ | `lib/features/casos/operaciones_service.dart` |
> | 4 | Quitar el `break` del bucle de sincronización | ✅ | `lib/features/sync/sync_provider.dart` (aislado por ítem, con estados y backoff) |
> | 5 | Mensajes de error reales y no contar fallos de red | ✅ | `lib/core/api_error.dart` + `auth_provider.dart` (lee `detail` y `X-Intentos-Restantes`) |
> | 6 | `unlock` sin esperar token + restablecer clave | ✅ | `unlock_screen.dart` (+ `primer_acceso_screen.dart`) encadena `unlock → login` |
> | 7 | Firmar el release con un keystore propio | ⏳ **pendiente** | Requiere el keystore y el `applicationId` definitivos de CANTV (H-28/H-29) |
> | 8 | `flutter build apk --split-per-abi` | ⏳ **pendiente** | Se mantiene el APK universal (22 MB) para la descarga desde la web; el *split* reduce a ~8-9 MiB por ABI |
> | 9 | `.gitignore` + `git init`; retirar los APK del árbol | ◐ parcial | `app/web/.gitignore` cubre el APK publicado; quedan las dos copias sueltas en `app_movil/` y falta `git init` (H-46) |
> | 10 | Retirar `generate_app.py` y activar `flutter_lints` | ◐ parcial | `analysis_options.yaml` **creado** y activo; `generate_app.py` sigue presente y **sobrescribe los fuentes si se ejecuta** (H-47) |
>
> **Además** (fuera de los quick wins, ya incluido): caché local de casos para operar
> sin conexión, cola offline con backoff y descarte visible, evidencias comprimidas y
> serializadas, ficha con las secciones Administrativa y Técnica, cita con fecha y hora,
> cierre con modo + descripción + evidencias, enrutado con destino y motivo, y **ZIP real
> de jornada** con manifiesto. El listado de hallazgos P0 (H-01…H-12) queda resuelto en su
> totalidad salvo la subida de evidencias al servidor, que sigue sin endpoint (0.3).
>
> **Cambio de contrato en el backend:** `POST /casos/{id}/cierre`, `/cita` y `/enrutado`
> pasan a admitir el rol **TECNICO** (`_gestion`), porque son las operaciones de campo que
> el brief le asigna (RF-12/13/15). La edición completa del caso sigue vedada al técnico.

1. `ApiClient.init()` en `main()` con timeouts e interceptor 401 → **restablece toda la app**.
2. `response.data['items']` en lugar de `['casos']` → la lista aparece.
3. `POST /casos/{id}/estado` con `motivo_estado` en lugar de `PATCH` → CONTACTADO/CITADO dejan de dar 403.
4. Quitar el `break` del bucle de sincronización y marcar el ítem como `ERROR` → **la cola deja de bloquearse**.
5. Mensajes de error reales (`e.response?.data['detail']`) y no contar fallos de red como intentos de login.
6. `unlock` sin esperar token + botón «Restablecer clave» con `POST /auth/reset-password` → salida del bloqueo.
7. Firmar el release con un keystore propio.
8. `flutter build apk --release --split-per-abi` → **≈ 8-9 MiB por ABI en lugar de 22 MiB**.
9. `.gitignore` + `git init`; mover `GGTOv2.apk` y `app-release.apk` fuera del árbol.
10. Retirar `generate_app.py` y `analysis_options.yaml` con `flutter_lints` activo.

---

## 7. Anexo A — Parches propuestos

### A.1 `lib/core/api_client.dart` — autenticación, tiempos y sesión expirada (H-01, H-18, H-39)

```dart
class ApiClient {
  ApiClient._();
  static final Dio _dio = Dio(BaseOptions(
    baseUrl: AppConstants.baseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    sendTimeout: const Duration(seconds: 90),      // subida de evidencias
    headers: {'Accept': 'application/json'},
  ));

  static void init({required Future<void> Function() onSesionExpirada}) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (o, h) async {
        final t = await AuthStorage.getToken();
        if (t != null) o.headers['Authorization'] = 'Bearer $t';
        h.next(o);
      },
      onError: (e, h) async {
        if (e.response?.statusCode == 401) await onSesionExpirada();
        h.next(e);
      },
    ));
  }
  static Dio get dio => _dio;
}
```

```dart
// main.dart — antes de runApp
ApiClient.init(onSesionExpirada: () async {
  await AuthStorage.deleteToken();
  navigatorKey.currentState?.pushNamedAndRemoveUntil('/login', (_) => false);
});
```

### A.2 `casos_provider.dart` — clave correcta + caché local (H-02, H-13)

```dart
Future<void> fetchCasos() async {
  _isLoading = true; _error = null; notifyListeners();
  try {
    final r = await ApiClient.dio.get('/casos', queryParameters: {
      'estado_actual': 'ASIGNADO', 'page': 1, 'page_size': 50,
    });
    final items = (r.data['items'] as List).cast<Map<String, dynamic>>();
    await DatabaseHelper.instance.reemplazarCasos(items);   // caso_local: HOY sin usar
    _casos = items;
  } on DioException catch (e) {
    _casos = await DatabaseHelper.instance.leerCasos();      // sin red: caché
    _error = e.type == DioExceptionType.connectionError
        ? 'Sin conexión — mostrando datos guardados'
        : 'Error ${e.response?.statusCode}: ${e.response?.data?['detail'] ?? e.message}';
  } finally { _isLoading = false; notifyListeners(); }
}
```

### A.3 Outbox con estados, backoff e idempotencia (H-14)

```sql
CREATE TABLE outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT    NOT NULL UNIQUE,
  tipo            TEXT    NOT NULL,   -- ESTADO|CIERRE|CITA|FALLA|INCIDENTE|MATERIAL
  endpoint        TEXT    NOT NULL,
  metodo          TEXT    NOT NULL,   -- POST|PATCH
  payload         TEXT    NOT NULL,
  id_caso         TEXT,
  estado          TEXT    NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE|ENVIADO|ERROR|DESCARTADO
  intentos        INTEGER NOT NULL DEFAULT 0,
  proximo_intento TEXT,
  ultimo_error    TEXT,
  creado_en       TEXT    NOT NULL,
  enviado_en      TEXT
);
CREATE INDEX idx_outbox_pend ON outbox(estado, proximo_intento);
```

### A.4 Motor de sincronización sin bloqueo en cabeza de cola (H-08, H-14)

```dart
Future<ResumenSync> sincronizar() async {
  if (_enCurso) return ResumenSync.yaEnCurso();
  _enCurso = true;
  var ok = 0, error = 0;
  try {
    await _subirEvidenciasPendientes();          // 1) fotos (multipart) — Fase 0.3
    for (final a in await _dao.pendientesListos()) {
      try {
        final r = await ApiClient.dio.request(a.endpoint,
            data: jsonDecode(a.payload),
            options: Options(method: a.metodo,
                headers: {'Idempotency-Key': a.idempotencyKey}));
        if ((r.statusCode ?? 500) < 300) { await _dao.marcarEnviado(a.id); ok++; }
        else { await _dao.marcarError(a.id, _detalle(r), a.intentos + 1); error++; }
      } on DioException catch (e) {
        if (e.type == DioExceptionType.connectionError ||
            e.type == DioExceptionType.connectionTimeout) {
          break;                                  // sin red: cortar aquí, no es error del ítem
        }
        // 4xx permanente (404/409/422): marcar ERROR y SEGUIR con el resto
        await _dao.marcarError(a.id, _detalle(e.response), a.intentos + 1);
        error++;
      }
    }
  } finally { _enCurso = false; await checkPendientes(); }
  return ResumenSync(ok: ok, error: error);
}

// Backoff: proximo_intento = ahora + min(30s * 2^intentos, 6h); DESCARTADO tras 5 intentos 4xx.
```

### A.5 Escrituras correctas del técnico (H-03, H-04, H-05, H-07)

```dart
// Cambio de estado (ÚNICO endpoint que admite TECNICO hoy — D-68)
await ApiClient.dio.post('/casos/$idCaso/estado',
    data: {'estado_actual': estado, 'motivo_estado': motivo});

// Cierre con modo, descripción, causa y seriales de evidencia (requiere Fase 0.1)
await ApiClient.dio.post('/casos/$idCaso/cierre', data: {
  'modo': modo,                    // IVR | COS | SACAS
  'descripcion': reporte,          // min 10 caracteres
  'id_causa': idCausa,
  'evidencias': seriales,          // seriales de las fotos ya subidas
});

// Cita: el backend exige fecha_hora (no 'fecha')
await ApiClient.dio.post('/citas', data: {
  'id_caso': idCaso,
  'fecha_hora': fechaHora.toUtc().toIso8601String(),
  'tipo': 'ATENCION',
  'observacion': observacion,
});
```

### A.6 Evidencia: serial, compresión y subida (H-10, H-38)

```dart
// Serial según §4.3: N.º de caso + id_averia + tipo + fecha/hora
String serial(String idAveria, String tipo, DateTime ts) =>
    '${idCaso}_${idAveria}_$tipo'
    '_${DateFormat('yyyyMMdd_HHmmss').format(ts)}';

// Compresión "baja calidad" antes de guardar/subir (paquete image o flutter_image_compress)
final reducida = await FlutterImageCompress.compressAndGetFile(
    foto.path, destino, minWidth: 1280, minHeight: 720, quality: 60,
    exif: _exifConGps(posicion, DateTime.now()));   // RF-14: GPS + fecha/hora en el archivo

await ApiClient.dio.post('/casos/$idCaso/evidencias',
  data: FormData.fromMap({
    'archivo': await MultipartFile.fromFile(reducida!.path, filename: '$serial.jpg'),
    'tipo': tipo,                 // POTENCIA | NAVEGACION | DEMO
    'serial': serial,
    'latitud': posicion.latitude, 'longitud': posicion.longitude,
    'fecha_hora': DateTime.now().toUtc().toIso8601String(),
  }),
  options: Options(headers: {'Idempotency-Key': serial}));
```

### A.7 Tema accesible (RNF-23, H-41)

```dart
final ThemeData appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1565C0)),
  textTheme: Typography.material2021().black.apply(fontSizeFactor: 1.15), // base ≥ 16 sp
  materialTapTargetSize: MaterialTapTargetSize.padded,                     // ≥ 48 dp
  visualDensity: VisualDensity.standard,
);
// Envolver la app:
MediaQuery.withClampedTextScaling(minScaleFactor: 1.0, maxScaleFactor: 1.6, child: child)
```

### A.8 Build de release (H-28, H-35, H-37)

```gradle
signingConfigs {
    release {
        storeFile file(System.getenv("GGTO_KEYSTORE") ?: "keystore/ggto-release.jks")
        storePassword System.getenv("GGTO_STORE_PASSWORD")
        keyAlias System.getenv("GGTO_KEY_ALIAS")
        keyPassword System.getenv("GGTO_KEY_PASSWORD")
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

```bash
flutter build appbundle --release --obfuscate --split-debug-info=build/symbols   # Play
flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/symbols
```

---

## 8. Anexo B — Definición de terminado y matriz de pruebas

**DoD por incremento:** `flutter analyze` sin errores · `dart format` aplicado · pruebas nuevas en verde · build de release firmado con keystore propio · checklist funcional ejecutado en dispositivo físico · sin `catch` vacíos en el código tocado · `CHANGELOG` actualizado.

| Prueba | Escenario | Criterio |
|---|---|---|
| Login/anti-fuerza bruta | 3 claves erradas → 423; desbloqueo con 3 de 12 palabras | RNF-01/RNF-22: bloqueo efectivo, desbloqueo funcional, contador persistente tras reiniciar la app |
| **Offline extremo** | Modo avión 8 h: contactar, citar, cerrar, 3 fotos, incidente | RNF-06: al recuperar red **0 pérdidas**, cola en 0; un ítem inválido no bloquea al resto |
| Cierre de caso | Cierre con IVR + causa + 2 fotos | Aparece `actividad` tipo CIERRE y 2 filas `evidencia` con serial; caso en `CERRADO` en la web |
| Usabilidad de campo | `CONTACTAR → CONTACTADO/DIFERIDO` | RNF-09: ≤ 3 toques y ≤ 20 s, a una mano, sin conexión |
| Búsqueda | Hallar ficha por teléfono desde el login | RNF-09: ≤ 10 s |
| Accesibilidad | TalkBack + fuente del sistema al 130 % | RNF-23: lectura completa, objetivos ≥ 48 dp, sin recortes |
| Evidencias | Foto con GPS y hora | RNF-13: EXIF/sidecar con coordenadas; serial `caso+avería+tipo+fecha`; archivo ≤ ~200 KB |
| Android 15 (API 35) | Navegación completa | Sin solape con barras del sistema; permisos de cámara/GPS correctos (H-42) |
| Sincronización concurrente | Doble pulsación de SINCRONIZAR | `single-flight`: una sola ejecución, sin duplicados (idempotencia) |
| Seguridad de datos | `adb backup` y conmutador de recientes | Sin extracción de `ggto.db`; contenido oculto en recientes |

---

## 9. Riesgos y decisiones abiertas

| # | Riesgo / decisión | Impacto | Mitigación propuesta |
|---|---|---|---|
| R-01 | **La Fase 0 es de backend y está fuera de `app_movil`**: sin ella, las Fases 1–3 no cierran el flujo | Bloqueante | Acordar 0.1–0.4 como *sprint* conjunto móvil+backend antes de tocar la UI |
| R-02 | Alcance por técnico/cuadrilla no existe en la API (H-12) | Seguridad (IDOR) y RNF-21 | Mientras no exista 0.2: filtrado defensivo en el cliente **y** bloqueo de escritura a casos no asignados |
| R-03 | `targetSdk 35` con Flutter 3.24.3 (edge-to-edge, 16 KB) | Rechazo en Play / UI rota | Verificar en API 35; si falla, fijar `targetSdk 34` y planificar subida de Flutter ≥ 3.29 |
| R-04 | `generate_app.py` sobrescribe los fuentes con versiones antiguas | Pérdida de trabajo | Retirar a `scripts/legacy/` en la Fase 1 (no esperar a la 5) |
| R-05 | No hay control de versiones | Sin trazabilidad de esta mejora | `git init` + `.gitignore` **antes** de empezar la Fase 1 |
| R-06 | Retención/borrado de evidencias (RNF-18, 2 años) sin definir en el dispositivo | Cumplimiento | Definir política en Fase 2 (limpieza local por antigüedad tras sincronizar) |
| R-07 | `id_averia` puede venir nulo (casos `REF-…`, RF-36) y el serial lo usa | Integridad del serial | Fallback documentado: `REF` + `id_caso` |
| R-08 | Pruebas de usabilidad con 3–5 técnicos reales (RNF-09) no están planificadas | Requisito medible | Agendar en Fase 3–4 con dispositivo de campo y guion de métricas |

---

## 10. Recomendación

Ejecutar en este orden: **(1)** Fase 0 (contrato) en paralelo con los quick wins 1, 2, 3, 4, 6, 9 y 10; **(2)** Fase 1 completa y validación end-to-end con un `TECNICO` real contra el entorno desplegado; **(3)** Fase 2 (offline) antes que la Fase 3, porque RNF-06 es el requisito que define el producto de campo; **(4)** Fases 3–5.

Con las Fases 0–2 (≈ 18–24 dev-días) la APK pasa de **no operable** a **demostrable en campo sin pérdida de datos**; las Fases 3–5 la convierten en un entregable publicable y auditable frente a RF-11…RF-20, RNF-01…RNF-06, RNF-09, RNF-12, RNF-13, RNF-18, RNF-21, RNF-22, RNF-23 y RNF-24.
