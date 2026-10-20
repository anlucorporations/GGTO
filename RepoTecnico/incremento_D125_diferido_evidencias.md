# Incremento D-125 — La evidencia del diferido, vinculada y sin 422 (H-08)

| Campo | Valor |
|---|---|
| Petición | Cerrar **H-08** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md) con **prueba de regresión** (decisión del usuario) |
| Fecha | 2026-10-20 |
| Alcance | APK + pruebas · **`1.15.4+29`** publicada · despliegue **v57** · sin cambios de contrato |
| Autor | Dirección del proyecto |

---

## 1. El defecto y por qué ya no puede ocurrir

Al **diferir sin conexión**, `OperacionesService.diferir` encolaba la acción del
diferido y, además, una segunda acción `DIFERIDO_EVIDENCIAS` con:

```dart
endpoint: '/casos/$idCaso/estado',   // exige `estado_actual`
payload:  {'evidencias': [...]},     // no lo lleva
```

El outbox la enviaba a `/casos/{id}/estado` → **422** → `ERROR` permanente, y la
foto quedaba subida pero **sin vínculo** a ninguna actividad.

D-124 (dueño único) hizo que ese tipo **solo** lo envíe la CARGA, que lo traduce a
una actividad `CONTACTO` con los seriales. Por tanto el 422 ya no puede ocurrir.

---

## 2. Lo que se añade en D-125

### 2.1 La traducción de la cola, como función pura y probada

`app_movil/lib/features/sync/cola_offline.dart` gana:

- `actividadDeCarga(...)` → cuerpo de la actividad de `/sync/carga` para una acción
  de la cola: `CIERRE` (con modo/método/causa), `ENRUTADO` y
  **`DIFERIDO_EVIDENCIAS` → `CONTACTO`** con sus seriales; `null` para los tipos
  del outbox.
- `estadoDeCarga(...)` → cambio de estado de las acciones de campo; **`null`** para
  `DIFERIDO_EVIDENCIAS` (la causa exacta del 422 queda imposible por construcción).

`UploadService` deja de tener el `switch` incrustado y usa estas funciones.

### 2.2 Pruebas de regresión

| Prueba | Qué fija |
|---|---|
| APK (`test/d125_diferido_evidencias_test.dart`, 8 casos) | el diferido con evidencias se envía como **CONTACTO** con sus seriales; **nunca** produce un estado; el diferido en sí sigue siendo un estado; `CIERRE` conserva modo/método/causa; `ENRUTADO` su motivo y evidencias; los tipos del outbox no entran en el lote |
| Backend (`app/tests/test_d125_diferido_evidencias.py`) | una actividad `CONTACTO` con el serial de una evidencia ya subida **vincula** la evidencia (`id_actividad`); el reenvío del mismo lote es idempotente (D-121) |

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| APK `flutter test` | **237/237 en verde** (7 nuevas de D-125) · `flutter analyze` sin hallazgos |
| Backend | prueba nueva de D-125 en verde; el resto sin cambios |
| Esquema / API | sin cambios |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/sync/cola_offline.dart` | `actividadDeCarga`, `estadoDeCarga` (puras). |
| `app_movil/lib/features/sync/upload_service.dart` | Usa las funciones puras en lugar del `switch`. |
| `app_movil/test/d125_diferido_evidencias_test.dart` | **Nuevo**: 8 pruebas. |
| `app/tests/test_d125_diferido_evidencias.py` | **Nuevo**: evidencia vinculada + idempotencia. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.4+29**. |

---

## 5. Siguiente hallazgo

**H-09** — `mergearCasos` reemplaza la fila local: la descarga pisa el estado
optimista y `pendiente_sync`, y el trabajo ya gestionado reaparece como pendiente.
Se consulta al usuario antes de implementarlo.
