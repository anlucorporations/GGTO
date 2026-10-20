# Incremento D-136 — El detalle de la sincronización viaja al servidor (H-19)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-19** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **detalle por caso al cerrar** |
| Fecha | 2026-10-20 |
| Alcance | APK · **`1.15.11+36`** publicada · despliegue **v68** · sin migración ni cambios de contrato |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`sync_log.detalle` (jsonb) existía y el servidor lo guardaba al cerrar la sesión
(`cerrar_sesion` fusiona el `detalle` recibido). Pero la APK enviaba **solo
contadores** y el checklist: **nunca** el detalle. Consecuencia: quien administraba
no podía saber **qué** descargó un técnico (ids, motivo, descartados) ni **qué**
falló en la carga (caso y motivo), y la traza quedaba reducida a números.

---

## 2. Corrección

`app_movil/lib/features/sync/detalle_sync.dart` (nuevo, funciones **puras**):

- `detalleDescarga(...)` → `{'descarga': {ids_recibidos (ordenados), nuevos,
  actualizados, descartados, ids_del_dia, ids_vigentes, motivo, cuadrilla?}}`.
- `detalleCarga(...)` → `{'carga': {actividades, estados, aceptadas, rechazadas,
  errores (últimos 20)}}`.

`SyncSesionService.cerrar` gana el parámetro `detalle` y lo envía en el `PATCH`
(`if (detalle != null) 'detalle': detalle`). `DownloadService` y `UploadService`
lo construyen al cerrar su sesión; el error de la descarga deja
`{'error': 'descarga'}` como marca.

El servidor ya lo almacenaba: **no hace falta migración**.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| APK `flutter test` | **261/261 en verde** (4 nuevas de D-136) · `flutter analyze` sin hallazgos |
| Pruebas nuevas | el detalle de la descarga lleva ids ordenados, conteos, motivo y cuadrilla (y omite la clave sin cuadrilla); el de la carga resume acciones y recorta los errores a los últimos 20 |
| Backend / esquema | sin cambios (usa `sync_log.detalle` existente) |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/sync/detalle_sync.dart` | **Nuevo**: `detalleDescarga`, `detalleCarga`. |
| `app_movil/lib/features/sync/sync_sesion.dart` | `cerrar(..., detalle)` y su envío. |
| `app_movil/lib/features/sync/download_service.dart` | Detalle de la descarga al cerrar. |
| `app_movil/lib/features/sync/upload_service.dart` | Detalle de la carga al cerrar. |
| `app_movil/test/d136_detalle_sync_test.dart` | **Nuevo**: 4 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.11+36**. |

---

## 5. Siguiente hallazgo

**H-20** — IDOR en `PATCH /sync/sesion/{id}`: cualquier usuario autenticado puede
cerrar (y falsear contadores de) la sesión de **otro** técnico. Se consulta al
usuario.
