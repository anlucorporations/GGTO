# Incremento D-154 — Evidencias durables y acceso acotado (H-05)

**Fecha:** 2026-10-22 · **Hallazgo:** H-05 del informe de optimización V2 (severidad ALTA)
**Alcance:** backend (subida, almacenamiento, descarga), script de despliegue, esquema de configuración y pruebas.

## 1. Defecto

1. `subir_evidencia()` solo usaba Cloud Storage si existía `GGTO_GCS_BUCKET`; la revisión desplegada no lo tenía, así que **todas las fotos se escribían en el disco efímero de Cloud Run** y se perdían en el siguiente reciclaje.
2. La subida **nunca fallaba**: si GCS no estaba disponible, registraba el error y continuaba; `/evidencias/upload` respondía `200` con una `ruta_remota` que no existía.
3. `app/main.py` no montaba `/evidencias-locales`; el *fallback* de la SPA devolvía `index.html` con `200 text/html`, de modo que el enlace “parecía válido” pero abría la aplicación.
4. Se validaba solo el `Content-Type` declarado por el cliente: un archivo arbitrario con cabecera `image/jpeg` se aceptaba.
5. No había cuota de subida ni límite por caso.
6. Un `id_caso` positivo inexistente se aceptaba sin vínculo y dejaba una **evidencia huérfana**.
7. En Cloud Run no había forma de obtener el token de GCS (solo se leía un archivo de credenciales, que no se monta).

## 2. Corrección

### 2.1 Almacenamiento (`app/services/storage.py`)

- **Fail-closed en producción** (`APP_ENV=production`): sin `GGTO_GCS_BUCKET` se lanza `StorageNoConfigurado`; con bucket pero sin token o con error de GCS se lanza `StorageError`. La ruta traduce ambos a **503** y la APK conserva la foto en su cola local y reintenta (el cliente no marca la evidencia como subida ante un no-2xx).
- **Token ADC**: archivo de cuenta de servicio si existe; si no, **servidor de metadatos de Cloud Run** (`Metadata-Flavor: Google`), con caché hasta 60 s antes de expirar.
- **Sin fallback silencioso**: en producción nunca se escribe en disco; en desarrollo, sin bucket, se mantiene el fallback local para trabajar offline.
- `leer_evidencia(ruta)` devuelve `(bytes, mime)` desde `gcs://...` o desde `/evidencias-locales/...`, con protección contra traversal de rutas.
- `detectar_tipo_imagen(bytes)`: JPEG (`FF D8 FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`) y WebP (`RIFF....WEBP`).
- `modo_almacenamiento()`: `gcs`, `local` o `no_configurado`, para `/ready`.
- `borrar_evidencia()` (D-153) reutiliza el mismo token y distingue “no existe” (`True`) de “no se pudo borrar” (`False`).

### 2.2 Subida (`POST /api/v1/evidencias/upload`)

| Regla | Respuesta |
|---|---|
| Bytes que no son JPEG/PNG/WebP | `422` |
| `id_caso > 0` inexistente | `404` (no crea fila) |
| Caso de otra cuadrilla/central | `403` |
| Supera la cuota diaria del caso | `429` |
| Sin bucket o fallo de GCS en producción | `503` (la APK reintenta) |
| Serial ya subido | `200` idempotente, con la misma fila |

La cuota se lee de `configuracion.evidencia.max_por_caso_dia` (semilla: **10**); un reintento del mismo serial no consume cuota. La respuesta incluye `url_firmada`, una URL de **15 minutos** con JWT propio (HMAC de la aplicación) ligada al `id_evidencia`.

### 2.3 Descarga (`GET /api/v1/evidencias/{id}`)

- Acepta el **Bearer** habitual o `?token=` de la URL firmada.
- Aplica el mismo alcance que D-152: central y cuadrilla; `SUPER` exento.
- Evidencia **sin caso** (reporte de falla masiva): solo `ADMIN`, `SUPERVISOR`, `COORDINADOR` y `SUPER`.
- Responde **404** si no existe o no es visible (no confirma su existencia).
- Devuelve `Cache-Control: private, max-age=300`.

> **Decisión:** se sirve la imagen por una ruta autenticada/firmada por la aplicación en lugar de una URL nativa firmada de GCS. Evita claves privadas y URLs públicas, y mantiene el acotado por caso en el backend. La descarga pasa por Cloud Run (fotos ≤ 3 MB); si el volumen crece, se puede migrar a `generate_signed_url` con `google-cloud-storage`.

### 2.4 SPA y salud

- `/evidencias-locales` se monta **solo en desarrollo**. En producción la ruta responde `404`, nunca el HTML de la SPA.
- `/ready` informa `almacenamiento` y `evidencias_ok`; no tumba la revisión por sí solo (la subida ya falla cerrada).

## 3. Despliegue

`RepoTecnico/scripts/11_desplegar_ggto_web.sh` pasa a **7 pasos**:

1. Sesión y proyecto.
2. Token de mantenimiento (D-153).
3. **Bucket de evidencias**: `${PROYECTO}-ggto-evidencias` (o `GGTO_BUCKET`), acceso uniforme, sin acceso público, ciclo de vida de 730 días, `roles/storage.objectUser` para la cuenta de Cloud Run.
4. Imagen en Cloud Build.
5. Cloud Run con `APP_ENV=production` y `GGTO_GCS_BUCKET`.
6. Verificación de salud/SPA.
7. Cloud Scheduler (4 jobs).

## 4. Verificación

| Prueba | Resultado |
|---|---|
| `app/tests/test_d154_evidencias.py` (nuevo) | **13 passed** |
| Evidencias existentes (`test_d128`, `test_sync_api`) | **57 passed** en conjunto con las nuevas |
| Suite completa | **586 passed**, cobertura **89,84 %** (10m00s) |
| `ruff check app` / `mypy app` | sin hallazgos |
| `bash -n` del script de despliegue | sintaxis OK |

Casos cubiertos: sin bucket en producción (`503`), subida a GCS simulada, bytes falsos (`422`), caso inexistente (`404`), cuota (`429`), URL firmada válida, token de otra evidencia (`401`), serial ajeno (`409`), caso ajeno (`404`), evidencia sin caso solo jefaturas, descarga sin credenciales (`401/403`), modo de almacenamiento y detección por bytes mágicos.

## 5. Residuales

- No hay conciliación automática de **objetos** huérfanos (blobs sin fila). Las filas sin caso ya no se crean por un id inexistente; las de falla masiva se vinculan después con la actividad.
- La descarga pasa por Cloud Run; no se usan URLs nativas firmadas de GCS.
- El bucket y el permiso se crean en el **primer despliegue**; hasta entonces la subida en producción responde `503` (que es el comportamiento buscado).
- La pérdida de evidencia solo queda cerrada cuando v80 esté desplegada y el bucket exista.

## 6. Archivos

- `app/services/storage.py`
- `app/api/routes_sync.py`
- `app/api/routes_health.py`
- `app/main.py`
- `RepoTecnico/db/schema.sql` (semilla `evidencia.max_por_caso_dia`)
- `RepoTecnico/scripts/11_desplegar_ggto_web.sh`
- `app/tests/test_d154_evidencias.py`
- `RepoTecnico/D81_despliegue.md`, manuales de operación y seguridad.
