# Incremento D-115 — La APK se actualiza con un solo botón

| Campo | Valor |
|---|---|
| Petición | 1) un **solo botón** que unifique todos los procesos de actualización · 1.2) **cargar las evidencias** del técnico · 1.3) **borrar los casos no atendidos** · 1.4) **descargar el despacho del día**. Objetivo: que el técnico tenga **solo** los casos del despacho del día |
| Fecha | 2026-10-19 |
| Alcance | APK (`app_movil`) · sin cambios de API ni de esquema · versión **`1.13.0+22`** |
| Autor | Dirección del proyecto |

---

## 1. Un solo botón para todo el proceso

Antes la pantalla **Dispositivo** tenía dos botones, **DESCARGA** y **CARGA**, y la
franja de **Casos** ofrecía «Descargar» y «Cargar (N)». El técnico tenía que
recordar cuál tocar y, si solo pulsaba uno, el trabajo quedaba a medias: las fotos
sin subir o los casos viejos sin borrar.

Ahora hay **una sola acción** (`ActualizacionDatosService.ejecutar`) que ejecuta,
en este orden:

1. **CARGA de evidencias y actividades** (`UploadService.cargar`):
   sube las fotos con `evidencia_local.subida = 0` y envía el lote a `/sync/carga`.
2. **Resto de la cola** (`SyncProvider.sincronizar`): fallas masivas, citas y
   evidencias sueltas que el lote no cubre.
3. **DESCARGA del despacho del día** (`DownloadService.descargar`): actualiza la
   caché local con los casos de la cuadrilla y ejecuta la **purga**.

La descarga se ejecuta **aunque la carga falle**: el trabajo sin enviar queda
protegido en la cola y un error de una foto no deja al técnico sin despacho. Si la
descarga falla, el contenido local se conserva y se informa el motivo.

**Decisión (DEC-115-1).** Un único punto de entrada en la APK. En **Casos** la
franja muestra **Actualizar**; en **Dispositivo** el botón es **ACTUALIZAR**. El
icono de la barra superior sigue abriendo **Dispositivo** para revisar la cola y
los errores.

---

## 2. Cargar las evidencias antes de borrar

El orden **evidencias → purga** es intencional: si se borrara primero, se perderían
las fotos de un caso no atendido que el técnico ya había capturado. Al subirlas
primero quedan en el servidor y, cuando la purga borra el caso local, también
limpia sus evidencias ya subidas (`subida = 1`).

Las evidencias con `subida = 0` **protegen** su caso: `PurgaDespachos` nunca borra
un caso con trabajo sin enviar (cola o foto pendiente, DEC-104-2).

---

## 3. Borrar los casos no atendidos

La purga sigue la regla de D-104: se conserva lo del **despacho del día**, los
cinco estados gestionados (cerrado, cancelado, enrutado, diferido y citado) y todo
caso con trabajo sin enviar; se borra el resto (lo no atendido de jornadas
anteriores).

**Cambio de D-115 (DEC-115-2).** La purga se ejecuta **siempre** que la descarga
haya resuelto una **cuadrilla de campo**, aunque todavía no haya un despacho
publicado del día. Antes (DEC-104-3) se exigía `despacho_del_dia` y, si el
supervisor aún no había publicado, el técnico seguía arrastrando casos viejos.
Ahora:

- con despacho del día, se conservan sus casos y se borra el resto;
- sin despacho del día, `idsDelDia` viene vacío y se borran **todos** los no
  atendidos;
- **no** se purga si el servidor no resolvió cuadrilla (`SIN_CUADRILLA`,
  `SIN_TECNICO`) ni en la **cuadrilla 0** de gestión (`CUADRILLA_GESTION`), porque
  no son trabajo de campo.

La condición vive en `PurgaDespachos.procede(motivo:, cuadrillaResuelta:)`, una
función pura y probada.

---

## 4. Descargar el despacho del día

`DownloadService.descargar` sigue trayendo el diferencial de la cuadrilla y la
jornada (`despacho_del_dia` / `ids_del_dia`) que calcula el backend con el día
operativo de `America/Caracas`. La novedad es que la actualización **siempre**
aplica la purga después de una descarga correcta, de modo que el listado final del
dispositivo queda con los casos del día y lo ya atendido.

---

## 5. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/sync/actualizacion_datos_service.dart` | **Nuevo**: orquesta CARGA → cola → DESCARGA y devuelve un resultado único. |
| `app_movil/lib/features/sync/sync_screen.dart` | Un solo botón **ACTUALIZAR**; refresca casos y masivas al terminar. |
| `app_movil/lib/features/casos/casos_screen.dart` | La franja ofrece **Actualizar**; el refresco por gesto ejecuta la actualización completa. |
| `app_movil/lib/features/casos/casos_provider.dart` | `aplicarDescarga()` aplica un resultado ya descargado sin volver a llamar a la API. |
| `app_movil/lib/features/sync/download_service.dart` | La purga se ejecuta con `PurgaDespachos.procede` (siempre con cuadrilla de campo). |
| `app_movil/lib/features/sync/purga_despachos.dart` | Nueva condición pura `procede()`. |
| `app_movil/lib/features/sync/sync_provider.dart` | `sincronizar()` acepta una franja de progreso (`progresoDesde`/`progresoHasta`). |
| `app_movil/pubspec.yaml`, `lib/core/constants.dart` | Versión **`1.13.0+22`**. |
| `app_movil/test/d115_actualizacion_unica_test.dart` | **Nuevo**: orden, resultado, errores y botón único. |
| `app_movil/test/d104_purga_despachos_test.dart` | Pruebas de `procede()`. |
| `app_movil/test/d84_d85_sincronizacion_test.dart` | La franja ya no tiene «Cargar»/«Descargar»; tiene «Actualizar». |

---

## 6. Verificación

| Comprobación | Resultado |
|---|---|
| `flutter analyze` | **No issues found!** |
| `flutter test` | **201/201 en verde** en D-115; con la corrección de D-116 queda en **202/202** |
| Sin cambios de API ni de esquema | El backend no necesita redeploy para esta APK. |

**Pendiente:** compilar y publicar la APK `1.13.0+22`, y la prueba en dispositivo
con una jornada real (subir una foto, verificar que se borran los casos viejos y
que el listado queda con el despacho del día).
