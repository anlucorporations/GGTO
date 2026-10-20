# Incremento D-124 — Un solo dueño de la cola y un cerrojo de sincronización (H-07)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-07** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **dueño único + cerrojo** |
| Fecha | 2026-10-20 |
| Alcance | APK · **`1.15.3+28`** publicada · despliegue **v56** · sin cambios de API ni de esquema |
| Autor | Dirección del proyecto |

---

## 1. El defecto

La cola local (`accion_pendiente`) la consumían **dos** caminos a la vez:

1. **La CARGA** (`UploadService.cargar`): agrupa cierres, enrutados y evidencias de
   un diferido y los envía dentro de `POST /sync/carga`.
2. **El outbox clásico** (`SyncProvider.sincronizar`): envía cada acción suelta a
   su endpoint original; además lo lanza solo el **auto-envío de 5 minutos**.

Sin cerrojo compartido, la misma acción podía salir dos veces (dos cierres y doble
juego de evidencias). La idempotencia del servidor (D-121) evita el duplicado en
la bitácora, pero el intento doble seguía ahí: dos peticiones, dos marcas de la
acción y carreras al cerrar la sesión de sincronización.

---

## 2. Corrección

### 2.1 Cada tipo tiene un dueño

`app_movil/lib/features/sync/cola_offline.dart` (nuevo):

```dart
const Set<String> tiposQueSoloVaPorCarga = {'CIERRE', 'ENRUTADO', 'DIFERIDO_EVIDENCIAS'};
```

`SyncProvider.sincronizar` solo envía `accionesParaOutbox(cola)`: los tres tipos de
la CARGA se quedan fuera del outbox y del auto-envío. Los demás (contactado,
citado, falla masiva, cita, evidencias sueltas) siguen su camino de siempre.

### 2.2 Un cerrojo de proceso

`app_movil/lib/core/sync_lock.dart` (nuevo): `SyncLock.instance` con dos modos:

| Modo | Quién lo usa | Comportamiento |
|---|---|---|
| `ejecutar` | **CARGA** (operación del usuario) | espera su turno: nunca dos envíos a la vez |
| `intentar` | **auto-envío** de 5 min | si hay algo en curso, **se salta** la vuelta y no espera |

`UploadService.cargar` toma el cerrojo; `SyncProvider.sincronizar` intenta
tomarlo. Un fallo siempre libera el cerrojo (`finally`), también en el auto-envío.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| APK `flutter test` | **230/230 en verde** (7 nuevas de D-124) |
| APK `flutter analyze` | **No issues found!** |
| Pruebas nuevas | el outbox ignora CIERRE/ENRUTADO/DIFERIDO_EVIDENCIAS y respeta el resto · comparación sin distinguir mayúsculas · `ejecutar` serializa (a1, a2, b1) · `intentar` devuelve `null` si hay algo en curso · un fallo libera el cerrojo |
| Backend | sin cambios (no se toca la API) |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/core/sync_lock.dart` | **Nuevo**: cerrojo con `ejecutar`/`intentar`. |
| `app_movil/lib/features/sync/cola_offline.dart` | **Nuevo**: tipos de la CARGA y `accionesParaOutbox`. |
| `app_movil/lib/features/sync/sync_provider.dart` | `sincronizar` toma el cerrojo con `intentar` y filtra la cola. |
| `app_movil/lib/features/sync/upload_service.dart` | `cargar` toma el cerrojo con `ejecutar`. |
| `app_movil/test/d124_dueno_unico_cola_test.dart` | **Nuevo**: 7 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.3+28**. |

---

## 5. Siguiente hallazgo

**H-08** — `DIFERIDO_EVIDENCIAS` se encola contra un endpoint que exige otro campo
(422) y acaba en `ERROR` permanente, con la evidencia sin vínculo. Se consulta al
usuario antes de implementarlo.
