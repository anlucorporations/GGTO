# Incremento D-127 — La descarga diferencial viaja en el cuerpo (H-10)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-10** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **`POST /sync/descarga`** |
| Fecha | 2026-10-20 |
| Alcance | Backend + APK · **`1.15.6+31`** publicada · despliegue **v59** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`GET /sync/descarga` recibía **todos** los ids que el dispositivo conoce en la
query string:

```
GET /api/v1/sync/descarga?ids_conocidos=1&ids_conocidos=2&…&desde=…
```

Con ~380 casos la URL ronda **8 KB** y crece con la caché (sin retención), hasta
superar el límite del proxy/CDN (414 *Request-URI Too Long*, 431…) y dejar al
técnico sin descarga. Además el diferencial de D-105 depende de esa lista: no se
puede simplemente dejar de enviarla sin perder la garantía de que un caso viejo no
modificado y desconocido llegue igual.

---

## 2. Corrección

### 2.1 Backend: la misma descarga, por POST

`POST /api/v1/sync/descarga` con `SyncDescargaIn`:

```json
{ "desde": "2026-10-20T12:00:00Z", "ids_conocidos": [1, 2, 3, …] }
```

- `ids_conocidos = null` (campo ausente) conserva el significado de la versión GET:
  el dispositivo no declara lo que tiene.
- Responde **exactamente el mismo** `SyncDescargaOut` (casos, motivo, `ids_del_dia`,
  `ids_vigentes`, masivas…).
- El **GET se mantiene** por compatibilidad con APK anteriores.

### 2.2 APK: usa el cuerpo y cae al GET si hace falta

`DownloadService.descargar` envía `desde` e `ids_conocidos` en el **cuerpo** del
POST. Si el servidor todavía no tiene la ruta (despliegue desfasado), reintenta por
GET con los mismos parámetros: el técnico nunca se queda sin despacho.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **464/464 en verde** (4 nuevas de D-127) |
| Pruebas nuevas | POST y GET devuelven lo mismo (motivo, casos, `ids_del_dia`, `ids_vigentes`, despacho); 500 ids en el cuerpo no rompen y los casos desconocidos llegan (D-105); `desde` futuro → `SIN_CAMBIOS` en las dos vías; fecha inválida → 422 |
| APK | `flutter analyze` sin hallazgos; suite completa en verde |
| Contrato | `/openapi.json` expone `POST /api/v1/sync/descarga` y `SyncDescargaIn` |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/schemas/sync.py` | `SyncDescargaIn` (`desde`, `ids_conocidos`). |
| `app/api/routes_sync.py` | `POST /sync/descarga` (mismo servicio que el GET). |
| `app/tests/test_d127_descarga_post.py` | **Nuevo**: 4 pruebas de equivalencia y cuerpo grande. |
| `app_movil/lib/features/sync/download_service.dart` | POST con caída al GET. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.6+31**. |

---

## 5. Siguiente hallazgo

**H-11** — evidencias huérfanas y sin dueño: `/evidencias/upload` no guarda
`id_caso` ni valida a quién pertenece la foto, y la purga puede borrar la
referencia local. Se consulta al usuario.
