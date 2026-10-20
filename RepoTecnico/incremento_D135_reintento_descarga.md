# Incremento D-135 — La descarga reintenta con backoff (H-18)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-18** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **reintento con backoff** |
| Fecha | 2026-10-20 |
| Alcance | APK · **`1.15.10+35`** publicada · despliegue **v67** · sin cambios de API |
| Autor | Dirección del proyecto |

---

## 1. El defecto

De las tres operaciones de la sincronización, la **DESCARGA** —la única sin la que
el técnico no tiene despacho— era la que **no reintentaba**: una sola llamada
(`POST /sync/descarga`) con 30 s de timeout. Un corte momentáneo de red o un 503
puntual dejaba la sincronización **sin casos** hasta la vuelta siguiente (5 min o
la próxima pulsación manual).

---

## 2. Corrección

`app_movil/lib/features/sync/reintentos.dart` (nuevo, función **pura**):

```dart
const esperasDescarga = [Duration(seconds: 1), Duration(seconds: 3)];

bool reintentableDescarga({required int? status, required bool deRed, required int intento});
```

| Fallo | ¿Reintenta? |
|---|---|
| red (sin respuesta) | sí, mientras queden intentos |
| 5xx | sí |
| 4xx (400/401/422…) | **no**: reintentar no cambia el resultado |
| 404/405 | no aquí: activan la **caída al `GET /sync/descarga`** antiguo (D-127) |

`DownloadService._descargar` aplica la política (2 reintentos, 1 s y 3 s) y conserva
la caída al GET para servidores anteriores. Si agota los intentos, el error se
propaga como antes: la sincronización lo muestra y **no se purga nada** (la purga
solo ocurre con una descarga exitosa).

El reintento vive dentro de la misma operación, que ya está bajo el **cerrojo de
sincronización** de D-124: no puede solaparse con la CARGA.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| APK `flutter test` | **257/257 en verde** (4 nuevas de D-135) · `flutter analyze` sin hallazgos |
| Pruebas nuevas | un fallo de red se reintenta hasta agotar; 5xx se reintenta y 4xx no; 404/405 no se reintentan (caída al GET); las esperas son crecientes y ≤ 5 s |
| Backend / esquema | sin cambios |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/sync/reintentos.dart` | **Nuevo**: política de reintentos. |
| `app_movil/lib/features/sync/download_service.dart` | `_descargar` con reintentos + caída al GET. |
| `app_movil/test/d135_reintento_descarga_test.dart` | **Nuevo**: 4 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.10+35**. |

---

## 5. Siguiente hallazgo

**H-19** — observabilidad: el servidor no sabe qué descargó ni qué falló por caso
(`sync_log` solo guarda contadores y el detalle libre de la APK nunca se envía). Se
consulta al usuario.
