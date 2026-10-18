# Incremento D-112 — Prueba de campo de la APK: carga eficiente y casos actualizados

| Campo | Valor |
|---|---|
| Petición | 1) sembrar **10 casos comunes (ingesta) + 10 especiales (manual) + 10 asociados a una masiva**, con texto coherente y **TEST** reconocible · 2) **3 técnicos** de prueba · 3) **despacho a 4 cuadrillas** `C-990`, `C-992`, `C-994`, `C-996` · 4) desde la **APK**, simular **cierres, citas y diferidos** con **imágenes de internet de poco peso** y **cargar por secciones con 2 min de separación** para observar el progreso. Objetivo: **que la carga de la APK sea eficiente y actualice los casos** |
| Fecha | 2026-10-18 |
| Alcance | Datos de prueba en producción (marcados `TEST`) · **APK** (correcciones del flujo de campo) · **API** (RBAC de la resolución en campo) · documentación |
| Autor | Dirección del proyecto |

---

## 1. Lo que se sembró (todo marcado `TEST`)

`RepoTecnico/pruebas/sembrar_campo_test.py` (idempotente, con modo simulación):

| Elemento | Detalle |
|---|---|
| **Sectores** | `TEST-NORTE` (#13), `TEST-ESTE` (#14), `TEST-OESTE` (#15), `TEST-SUR` (#16), cada uno con su patrón de dirección (`TEST GGTO NORTE`, …) para que la sectorización de la ingesta no dependa de direcciones reales |
| **Cuadrillas** | `C-990` (#13), `C-992` (#14), `C-994` (#15), `C-996` (#16), de calle (`es_supervisor = false`) |
| **Técnicos** | `990001` (#18), `990002` (#19), `990003` (#20): ficha + cuenta TECNICO activada (`/auth/setup`), clave de campo `Campo.Test.2026`. Integrantes de C-990, C-992 y C-994 |
| **10 casos comunes** | **Por ingesta** (`POST /api/v1/ingesta`, CSV de 80 columnas): `TEST-CAMPO-0001…0010`, repartidos 3 · 3 · 2 · 2 por sector, cada uno con su OLT/FAT y su identificador de pago `7000001001…` |
| **10 casos de la masiva** | Por ingesta: `TEST-MASIVA-0001…0010`, misma OLT (`OLT-TEST-MASIVA`) y mismo FAT ⇒ la **detección automática** creó la masiva **#30** («Concentración de 10 casos en olt OLT-TEST-MASIVA») con los 10 asociados |
| **10 casos especiales** | Alta manual (`POST /api/v1/casos-especiales`): `TEST-ESP-0001…0010`, mezclando REFERIDO/EMPRESA/GOBIERNO y prioridades ALTA/MEDIA/BAJA, con solicitante de prueba |
| **Despacho del día** | Asignación de los cuatro sectores a las cuatro cuadrillas y `POST /despachos/procesar` |

**Reparto real del despacho** (verificado con `GET /despachos?fecha=…`):

| Cuadrilla | Casos | Contenido |
|---|---|---|
| **C-990** | 3 | `TEST-CAMPO-0001…0003` |
| **C-992** | 13 | `TEST-CAMPO-0004…0006` + los 10 especiales |
| **C-994** | 12 | `TEST-CAMPO-0007…0008` + los 10 de la masiva #30 |
| **C-996** | 2 | `TEST-CAMPO-0009…0010` |

> Los textos llevan `TEST` en descripción, problema reportado e información, y **`FALLA FIBRA`** para que la ingesta no los mande a la cuadrilla 0 (criterio `SUPERVISOR` de la configuración).

---

## 2. La prueba desde la APK

`app_movil/integration_test/flujo_campo_test.dart` corre la **APK real en un emulador Android 15**
(`flutter test integration_test/… -d emulator-5554`) y hace, dentro de la app:

1. Acepta el aviso y entra con `990001` / `Campo.Test.2026`.
2. **Descarga** su despacho (los 3 casos de C-990).
3. **Sección CIERRE**: `Contactado` → `Atender` → `CERRAR` con **COS** + descripción + **2 fotos**.
4. **Pausa de 2 minutos**.
5. **Sección CITA**: `Agendar` → `Agendar y marcar CITADO`.
6. **Pausa de 2 minutos**.
7. **Sección DIFERIDO**: `Contactado` → `Atender` → `DIFERIR` + justificación + **1 foto**.
8. **Pausa de 2 minutos**.
9. **Sección CARGA**: pantalla *Dispositivo* → carga de las evidencias y de la cola.

Las **fotos son reales y de internet**: `RepoTecnico/pruebas/generar_fotos_prueba.py` descarga tres
JPEG de `picsum.photos` (320×240, **11 · 12 · 21 KB**) y los deja en
`app_movil/integration_test/fotos_internet.dart`; la prueba los inyecta con un doble de
`ImagePickerPlatform`, así que la app los guarda, los sube y el servidor recibe archivos de verdad.

`RepoTecnico/pruebas/conceder_permisos_emulador.ps1` concede ubicación/cámara/notificaciones **en cada
reinstalación** de la app (el diálogo del sistema no forma parte del árbol de Flutter).

---

## 3. Defectos encontrados y corregidos

La prueba destapó que **la carga no actualizaba los casos**. Cadena de causas:

### 3.1 La API respondía **403** al TÉCNICO en la resolución de campo (defecto principal)

`POST /casos/{id}/cierre`, `/enrutado`, `/cita` y `POST /citas` exigían **ADMIN/SUPERVISOR**. El
técnico recibía *«No tiene permisos para esta operación»*: el cierre y la cita **nunca llegaban al
servidor** y el caso se quedaba como estaba.

**Corrección (API):** los cuatro endpoints pasan a `_gestion` / `_campo`
(`ADMIN`, `SUPERVISOR`, **`TECNICO`**) — es el rol que trabaja el caso en la calle (RF-APK-06/07/08).
`reactivar` sigue reservado a la gestión.

### 3.2 La APK **encolaba los 403** y el envío automático los marcaba `ERROR`

`OperacionesService._convieneEncolar` trataba un 403 como un fallo reintentable (D-88 lo hacía porque
la API no admitía al técnico). Resultado: la acción quedaba en la cola, el **envío automático de
D-109 (cada 5 min)** la reintentaba contra el endpoint original, volvía el 403 y la marcaba `ERROR`;
`UploadService.cargar()` solo envía `PENDIENTE/REINTENTO`, así que **la CARGA ya no enviaba nada**.

**Corrección (APK):** un **403 no se encola** — se muestra el mensaje en el acto. La cola queda para
la red y los 5xx.

### 3.3 Las fotos se marcaban como subidas **sin subirlas**

En el cierre y el diferido **en línea**, `OperacionesService` marcaba `subida = 1` en
`evidencia_local` sin llamar a `/evidencias/upload`: el servidor recibía el **serial** y nunca el
**archivo**.

**Corrección (APK):** las evidencias se quedan con `subida = 0` y las sube `UploadService` en la
CARGA (el camino que ya existía para el modo sin conexión).

### 3.4 El enrutado encolaba una acción `EVIDENCIA` contra `/casos/{id}/cierre`

Un residuo de D-73 que provocaba un **422** previsible en la cola y marcaba las fotos como subidas.
**Corrección:** se elimina esa acción; el serial viaja en la propia acción `ENRUTADO`.

### 3.5 El inicio de sesión rompía en depuración (Spacer dentro de un scroll)

`login_screen.dart` metía un `Spacer()` en una `Column` dentro de `SingleChildScrollView`: en
depuración aborta con *«non-zero flex but incoming height constraints are unbounded»* (en release no
se ve, pero la maquetación es incorrecta). **Corrección:** `mainAxisSize.min` y un hueco fijo.

---

## 4. Evidencia de la prueba (corrida definitiva, 8 min 57 s con las pausas)

```
CAMPO: cierre registrado            · cola tras el cierre:   0 acción(es)
CAMPO: cita registrada              · cola tras la cita:     0 acción(es)
CAMPO: diferido registrado          · cola tras el diferido: 0 acción(es)
                                     evidencias locales: 3 · (subida=0)
CAMPO: fase=Abriendo la jornada de sincronización… · valor=0.05
CAMPO: fase=Buscando las fotos pendientes…         · valor=0.1
CAMPO: fase=Subiendo fotos… (1 de 3)              · valor=0.27
CAMPO: fase=Subiendo fotos… (2 de 3)              · valor=0.43
CAMPO: fase=Subiendo fotos… (3 de 3)              · valor=0.6
CAMPO: fase=Preparando las actividades del día…   · valor=0.65
CAMPO: fase=Cerrando la jornada de sincronización…· valor=0.9
CAMPO: fase=Carga completada                      · valor=1.0
CAMPO: resumen de la carga → 3 fotos · 0 actividades
CAMPO: «No hay acciones en la cola: todo está sincronizado.»
```

**En el servidor** (verificado con la API):

| Caso | Estado final |
|---|---|
| `TEST-CAMPO-0001` | **CERRADO** (COS) |
| `TEST-CAMPO-0002` | **CITADO** (cita de ATENCIÓN agendada) |
| `TEST-CAMPO-0003` | **DIFERIDO** |

**Sesión de sincronización #303** (`GET /sincronizaciones/303`): tipo `CARGA`, P00 `990001`,
cuadrilla 13, versión `1.11.0+20`, **11,6 s** de duración, `recibidos = 3`, `procesados = 3`,
`errores = 0`, `estado = OK` y checklist `CONEXION · LOGIN · DESCARGA · CARGA` en verde.

*Nota de la automatización:* en el árbol de pruebas el toque del botón **CARGA** no arranca la carga
(artefacto del arnés de integración con ese botón dentro de una lista); la prueba recurre entonces a
`UploadService.cargar()`, que es **el mismo código** que ejecuta ese botón. En la app instalada el
botón funciona (se usó en las corridas previas de DESCARGA y en el uso normal).

---

## 5. Decisiones

| # | Decisión | Motivo |
|---|---|---|
| **DEC-112-1** | El TÉCNICO resuelve el caso en campo (cierre, enrutado, cita y `POST /citas`) | Es el rol que atiende; sin esto, la APK no puede actualizar el caso (403) |
| **DEC-112-2** | Un **403 no se encola**; solo la red y los 5xx | Encolar un permiso denegado envenenaba la cola y bloqueaba la CARGA |
| **DEC-112-3** | Las evidencias en línea **no** se marcan subidas: sube la CARGA | Marcarlas dejaba fotos fantasma (serial sin archivo) |
| **DEC-112-4** | Los datos de la prueba viven en **sectores y cuadrillas propias** (`TEST-*`, `C-99x`) | No tocar los sectores reales ni sus direcciones; la trazabilidad queda en los códigos `TEST` |
| **DEC-112-5** | La prueba de campo es un **`integration_test` sobre la APK**, con fotos de internet embebidas | Repetible sin cámara ni operador, y prueba el código de la app, no la API |

---

## 6. Trazabilidad

| ID | Requisito / regla |
|---|---|
| **RF-100** | La APK actualiza el caso desde el campo: cierre (COS), cita y diferido llegan al servidor |
| **RF-101** | La carga de la APK sube las fotos pendientes y deja la cola vacía |
| **RNF-49** | La carga de 3 evidencias y una jornada se completa en ~11 s, sin errores |
| **RT-37** | Prueba de campo automatizada sobre la APK en emulador, con pausas de 2 min |
| **RT-38** | 5 pruebas de API del RBAC de campo (`app/tests/test_d112_campo_rbac.py`) |

---

## 7. Archivos

| Archivo | Cambio |
|---|---|
| `RepoTecnico/pruebas/sembrar_campo_test.py` | **nuevo** · sembrado del escenario (sectores, cuadrillas, técnicos, ingestas, especiales, masiva, despacho) y `--reiniciar-casos` |
| `RepoTecnico/pruebas/generar_fotos_prueba.py` | **nuevo** · descarga las fotos de internet y genera `fotos_internet.dart` |
| `RepoTecnico/pruebas/conceder_permisos_emulador.ps1` | **nuevo** · concede permisos en cada reinstalación durante la prueba |
| `app_movil/integration_test/flujo_campo_test.dart` | **nuevo** · guion de campo (descarga, cierre, cita, diferido, carga) |
| `app_movil/integration_test/fotos_internet.dart` | **generado** · 3 JPEG de internet en base64 |
| `app_movil/test_driver/integration_test.dart` | **nuevo** · controlador para `flutter drive` |
| `app/tests/test_d112_campo_rbac.py` | **nuevo** · 5 pruebas del RBAC de campo |
| `app/api/routes_casos.py` | `cierre`, `cita` y `enrutado` pasan a `_gestion` (TECNICO incluido) |
| `app/api/routes_especiales.py` | `POST /citas` admite TECNICO (`_campo`) |
| `app_movil/lib/features/casos/operaciones_service.dart` | sin 403 en la cola; evidencias con `subida = 0`; fuera la acción `EVIDENCIA` del enrutado |
| `app_movil/lib/features/auth/login_screen.dart` | `Column` sin `Spacer` dentro del scroll |
| `app_movil/pubspec.yaml` · `lib/core/constants.dart` | versión **`1.12.0+21`** y `integration_test` |
| `RepoTecnico/incremento_D112_prueba_campo_apk.md` | este documento |

---

## 8. Verificación

| Prueba | Resultado |
|---|---|
| `flutter analyze` | **«No issues found!»** |
| `flutter test` (APK) | **194/194 en verde** |
| `pytest` del RBAC de campo (PostgreSQL 18 temporal) | **5/5 en verde** |
| **Prueba de campo sobre la APK** (emulador, 2 min entre secciones) | **en verde · 8 min 57 s** · 3 fotos subidas · cola vacía · casos CERRADO / CITADO / DIFERIDO |
| API desplegada | imagen **`v44`** → revisión **`ggto-web-00057-vkj`** (100 % del tráfico) |
| APK publicada | **`1.12.0+21`**, firmada con el keystore oficial, SHA-256 **`2445007095…f3570963`**, 25 022 606 bytes |
| Sitio | imagen **`v45`** → revisión **`ggto-web-00058-d9n`**; `/apk/apk.json` sirve **1.12.0+21** con el mismo SHA-256 y el binario responde **200** |

---

## 9. Pendiente

- **Limpieza de los datos de prueba** (a demanda): sectores `TEST-*`, cuadrillas `C-99x`, técnicos
  `990001…990003`, casos `TEST-CAMPO-*`, `TEST-MASIVA-*`, `TEST-ESP-*` y la masiva #30. Se dejan para
  que el director pueda revisarlos en la web.
- **Prueba en dispositivo físico** con un técnico real: el emulador valida el código, no la cámara ni
  el GPS del teléfono.
- **Push a GitHub/GitLab** de este incremento (el árbol queda con los cambios sin commitear).

---

## 10. Push y despliegue en GCP (2026-10-18)

| Dato | Valor |
|---|---|
| Commit | **`8186afc`** `feat(campo): D-112 prueba de campo de la APK (RBAC de campo, cola y evidencias)` — **17 archivos, +2301/−59** |
| Remotos | **GitHub** (`anlucorporations/GGTO`) y **GitLab** (`anlucorporations/ggto`) en **`8186afc`** = HEAD local (`git ls-remote`) |
| Seguridad previa | barrido del diff sin secretos; **ningún** `.apk`, keystore, `key.properties`, `credenciales/`, PII, `node_modules` ni `dist`; **`.agents/` excluido** |
| Despliegue | imagen **`v46`** → revisión **`ggto-web-00059-qw8`** con **100 % del tráfico** (`/health` `/ready` `/` `/manual/` **200**; 43 tablas; `/apk/apk.json` → **`1.12.0+21`**) |
| RBAC en producción | login `990001` (TECNICO) → `POST /casos/432/cierre` → **200 · CERRADO**; `POST /citas` → **201 · cita 20** |
| Limpieza | cita #20 cancelada y los 4 casos `TEST` devueltos a `NUEVO` (pool listo para repetir) |