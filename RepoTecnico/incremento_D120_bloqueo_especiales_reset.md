# Incremento D-120 — Bloqueo con la clave, cierre de especiales y borrado local

| Campo | Valor |
|---|---|
| Petición | 0) que el bloqueo de pantalla se pueda abrir con la **clave de sesión** si se olvida el PIN · 1) los casos especiales (referidos) **no se cierran desde la APK** · 2) auditar la sincronización APK↔web · 3) un método para **resetear la APK** y dejarla como recién instalada |
| Fecha | 2026-10-19 |
| Alcance | Backend + APK · APK **`1.15.0+25`** publicada · despliegue **v52** (revisión `ggto-web-00065-xv8`) · informe de auditoría [`INFORME_OPTIMIZACION_V3.md`](INFORME_OPTIMIZACION_V3.md) |
| Autor | Dirección del proyecto |

---

## 1. Pantalla de bloqueo: desbloquear con la clave de sesión

`LockScreen` pedía **solo el PIN**. Si el técnico lo olvidaba, quedaba encerrado
(la única salida era matar la app) y el acceso sin conexión también se perdía.

Ahora la pantalla ofrece:

- **PIN** (sin cambios) para el desbloqueo normal.
- **«Olvidé el PIN: usar mi clave»**: valida la **clave de sesión** contra el
  servidor (`auth.login`, que además renueva el token y la credencial de 24 h),
  desbloquea y **devuelve el PIN al de fábrica** para que el técnico recupere el
  acceso sin conexión; la app le pide cambiarlo en Perfil → Seguridad.
- **«Cerrar sesión»** como salida de emergencia: funciona **sin red** y conserva
  los casos y la cola del dispositivo.

Si no hay conexión, el intento con clave lo dice expresamente («para desbloquear
con la clave necesita internet; use su PIN o conéctese»). El formulario advierte
que **3 intentos incorrectos bloquean la cuenta** (la regla del servidor).

**Evidencia:** `app_movil/lib/features/auth/lock_screen.dart` · `AuthProvider.ultimoErrorEsDeRed`
(para distinguir red de credenciales) · capturas `docs/imagenes/apk_d120/01-*` y `02-*`.

---

## 2. Los casos especiales (referidos) ya se cierran

### 2.1 Causa raíz (con datos de producción)

El referido **no tiene cierre propio**: se cierra su **caso** (`REF-…`). Pero
`caso_especial.estado` era una columna independiente que **ningún camino de campo
movía**: al cerrar el caso desde la APK el especial seguía en `ABIERTO`, y la
lista de ESPECIALES (web y APK) lo mostraba «pendiente» para siempre.

Medido en producción antes del arreglo: **46 especiales, 45 «pendientes»**, con
**11 de sus casos ya `CERRADO`**.

### 2.2 Corrección (una sola fuente de verdad: el caso)

- `services/clasificacion.py`: `estado_especial_para`, `estado_especial_visible`
  y `sincronizar_estado_especial` (funciones puras + escritura).
  - caso `CERRADO`/`CANCELADO`/`ENRUTADO` → especial **`CERRADO`**;
  - caso `CONTACTADO`/`CITADO`/`EN_GESTION`/`DIFERIDO` → **`EN_PROCESO`**;
  - un `ATENDIDO`/`CERRADO` manual no se reabre solo.
- `services/resolucion.registrar_estado` (camino **único** de los estados) llama a
  la sincronización. Y ahora **también lo usan** los tres caminos que tenían su
  propia copia: `routes_casos._registrar_estado` (contacto, no contesta, enrutado,
  reactivación) y `services/sync._registrar_estado` (la **carga offline** de la
  APK, que era el hueco por el que un cierre sin conexión no cerraba el especial).
- La lista de ESPECIALES **deriva** el estado del caso (`_resumen_especiales`) y
  los filtros `estado` y `solo_pendientes` se aplican sobre el estado **efectivo**
  (expresión SQL `case`), no sobre la columna cruda.
- El listado expone `id_averia` y `estado_caso` del caso asociado.
- **APK**: la pantalla Especiales muestra el estado del caso y añade **«Cerrar el
  caso»** (diálogo con método IVR/COS/SACAS y descripción) para los roles de
  gestión; el **SUPER** ya puede gestionar (antes la pantalla le ocultaba la
  edición aunque el backend se lo permitía).

### 2.3 Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **444/444 en verde** (15 nuevas de D-120) |
| APK `flutter test` | **219/219 en verde** (7 nuevas de D-120) · `flutter analyze` sin hallazgos |
| Producción, antes → después del despliegue | **45 pendientes / 1 cerrado** → **34 pendientes / 12 cerrados** (los 11 referidos con caso cerrado dejan de contarse) · `solo_pendientes` = 34 · `estado=CERRADO` = 12 |
| Emulador (APK real) | referido `TSTD120-LOCAL` descargado → Contactado → Atender → **Cerrar con IVR** → `CERRADO`; la API del especial devuelve `estado CERRADO`, `pendiente false` |

---

## 3. Auditoría del proceso de sincronización (`informe V3`)

Se ejecutó el equipo de auditoría en 3 fases (7 revisores → 7 verificadores
adversariales → síntesis) sobre la descarga de los casos de la cuadrilla, la carga
del trabajo gestionado y el cierre de especiales. Informe:
[`INFORME_OPTIMIZACION_V3.md`](INFORME_OPTIMIZACION_V3.md) — **25 hallazgos
verificados** (3 CRÍTICA · 10 ALTA · 12 MEDIA · 15 descartados).

Veredicto del informe: la **descarga** funciona con salvedades; la **carga**
transmite pero duplica; el **cierre de especiales** no estaba garantizado (lo que
este incremento corrige).

Corregido en este incremento, además de lo anterior:

| Hallazgo | Qué se hizo |
|---|---|
| **H-02** (CRÍTICA) RBAC fail-open en `/sync/carga` | si el TÉCNICO **no tiene cuadrilla vigente** la carga responde **403** (antes aceptaba cualquier caso de la central); se valida además que el caso sea de su central. Nueva prueba negativa. |
| **H-03** (CRÍTICA, parcial) la carga saltaba las reglas del servidor | el **cierre** que llega de la cola offline pasa por `resolucion.cerrar_caso`: exige método del catálogo (IVR/COS/SACAS), rechaza un caso ya cerrado y aplica la clasificación REPARACIÓN↔REFERIDO. Un cierre sin `modo` ya **no se acepta en silencio** (antes dejaba `id_metodo` NULL). |
| **H-05** (ALTA) el cierre del caso no cerraba el especial | §2 completo, incluida la carga offline y los filtros. |

Pendientes del informe (no incluidos aquí, con su ID): **H-01** idempotencia de
`/sync/carga` (duplicados en reintento), **H-04** el `REF-…` de un especial no se
despacha al crearse, **H-06** caso reasignado a mitad de jornada, **H-07** dos
emisores de la cola (auto-envío de 5 min vs CARGA), **H-08** `DIFERIDO_EVIDENCIAS`
con endpoint inválido, **H-09** la descarga pisa el estado optimista local,
**H-10** `ids_conocidos` en la URL, **H-11** evidencias huérfanas, **H-12** el lote
no respeta la cronología de estados, **H-13** `/casos` sin filtro de cuadrilla,
**H-14** `date.today()` UTC vs día operativo, **H-15** protección del trabajo sin
enviar en 7 de 8 acciones, **H-16** `requiere_informe` sin exigir, **H-17** PATCH
del especial sin reglas, **H-18…H-25** (reintento de la descarga, observabilidad,
IDOR de sesiones de sync, PII del dispositivo compartido, validación de ids,
salvaguarda de C-00, zonas horarias y accesibilidad de la pantalla Sincronizar).

---

## 4. Resetear la aplicación (como recién instalada)

### 4.1 Dos niveles, en **Usuario → Datos en el dispositivo**

| Acción | Qué borra | Qué conserva |
|---|---|---|
| **Borrar los casos descargados** | `caso_local` y `masiva_local` (el despacho del dispositivo) | la sesión, el PIN y la **cola de trabajo sin enviar** |
| **Restablecer la aplicación** | todo el contenido local: casos, masivas, cola, evidencias, mensajes y metadatos + las **fotos** de la carpeta de evidencias + la **credencial del PIN** + la **sesión** | nada: la app queda como recién instalada y vuelve al acceso con P00 y clave |

La sección muestra antes de borrar cuántos casos, fotos y acciones hay, y ambas
acciones piden confirmación explicando qué se pierde. Nada se borra en el
servidor: al volver a entrar, la primera sincronización descarga el despacho del
día.

**Implementación:** `core/database.dart` (`borrarCasosDescargados`, `reiniciarTodo`)
· `features/usuario/reset_app_service.dart` (orquestación + borrado de fotos) ·
`usuario_screen.dart` (UI) · claves `usuario-borrar-casos` y `usuario-restablecer`.

### 4.2 Verificación en el emulador

1. Con 4 casos en caché: **Restablecer la aplicación** → confirmación → la app
   vuelve al **acceso** (`docs/imagenes/apk_d120/04-*`).
2. Al entrar de nuevo: **«Contenido local · 0 casos»** y el servidor informa de
   los 4 casos de la cuadrilla pendientes de descargar (`05-*`).

---

## 5. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/clasificacion.py` | Estado del especial: funciones puras y sincronización con el caso. |
| `app/services/resolucion.py` | `registrar_estado` sincroniza la ficha del especial. |
| `app/services/sync.py` | Delegación en `resolucion` (estados y **cierre** de la carga), RBAC **fail-closed** por cuadrilla y central, `ids_vigentes` (D-119). |
| `app/api/routes_casos.py` | `_registrar_estado` delega en `resolucion` (un solo camino). |
| `app/api/routes_especiales.py` | Estado derivado, filtros por estado efectivo, `id_averia`/`estado_caso`. |
| `app/api/routes_sync.py` | (sin cambios de contrato) la carga conserva su respuesta por ítem. |
| `app/schemas/especiales.py` | `id_averia`, `estado_caso` en `CasoEspecialOut`. |
| `app/tests/test_d120_especiales_estado.py` | **Nuevo**: 15 pruebas (funciones puras, cierre online y offline, filtros, fail-closed). |
| `app/tests/test_sync_api.py` | Cierre por lote con `modo`; nueva prueba de rechazo sin `modo`. |
| `app_movil/lib/features/auth/lock_screen.dart` | Desbloqueo con clave de sesión + cerrar sesión. |
| `app_movil/lib/features/auth/auth_provider.dart` | `ultimoErrorEsDeRed`. |
| `app_movil/lib/core/database.dart` | `borrarCasosDescargados`, `reiniciarTodo`. |
| `app_movil/lib/features/usuario/reset_app_service.dart` | **Nuevo**: orquestación del borrado. |
| `app_movil/lib/features/usuario/usuario_screen.dart` | Sección «Datos en el dispositivo» y acciones. |
| `app_movil/lib/features/especiales/especiales_screen.dart` | «Cerrar el caso» + estado del caso. |
| `app_movil/lib/features/inicio/inicio_gestion_screen.dart` | El SUPER gestiona especiales. |
| `app_movil/test/d120_bloqueo_reset_especiales_test.dart` | **Nuevo**: 7 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.0+25**. |
| `docs/imagenes/apk_d120/*.png` | Capturas de la verificación. |
| `RepoTecnico/INFORME_OPTIMIZACION_V3.md` | Informe de la auditoría (generado por el equipo). |

---

## 6. Despliegue y entrega

| Elemento | Valor |
|---|---|
| Imagen | `…/truekeate-repo/ggto-web:v52` |
| Revisión | **`ggto-web-00065-xv8`**, 100 % del tráfico |
| APK publicada | **`1.15.0+25`** · SHA-256 `eefc665c1e39cf2dd732a37117b52b65f72340fc1defd196f6d36eb2e18ea806` |
| Descarga | `/apk/ggto-tecnico.apk` (la app ofrece la actualización sola) |

**Pendiente:** los hallazgos del informe marcados como pendientes en §3 (H-01,
H-04, H-06…H-25), regenerar los manuales HTML/PDF y la prueba en dispositivo de
las tres funciones nuevas.
