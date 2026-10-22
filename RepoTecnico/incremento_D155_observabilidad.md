# Incremento D-155 · Observabilidad y monitoreo (H-15)

**Fecha:** 2026-10-22
**Hallazgo:** H-15 (R3, severidad M) del `INFORME_OPTIMIZACION_V2.md`.
**Estado:** implementado, probado, publicado y desplegado en producción (imagen **v80**, revisión
`ggto-web-00093-g8c`, 100 % del tráfico).

## 1. Defecto

La revisión desplegada registraba texto plano con `logging.basicConfig`, sin JSON y sin el
usuario. El `ObservabilidadMiddleware` añadía `request_id`, método, ruta, código y milisegundos,
pero el `request_id` no llegaba a los servicios y el P00/rol no aparecía en ninguna línea. Los
pocos `logger.exception` no bastaban para diagnosticar una ingesta o una notificación fallida.
No existían métricas basadas en logs, políticas de alerta, *uptime check* ni retención explícita;
`/metricas` es un contador de negocio autenticado, no una fuente de alertas. La APK no tenía
registro de fallos.

## 2. Corrección

### 2.1 Logs JSON con contexto (backend)

- Nuevo `app/core/observabilidad.py`:
  - `FormatoJSON` escribe una línea por evento con `timestamp`, `severity`, `logger`, `message`,
    `request_id`, `usuario` (P00), `rol` y los campos del evento (`evento`, `metodo`, `ruta`,
    `status`, `ms`, `id_lote`, `filas`, `canal`, etc.).
  - `FiltroContexto` inyecta el contexto en **todos** los registros, también los de servicios.
  - `redactar()` elimina `Bearer`, JWT, `token/clave/password/secret`, correos, teléfonos
    venezolanos, números de 10-11 dígitos y P00 en texto libre.
  - `configurar_logging()` instala el formateador en la raíz y en Uvicorn; desactiva el log de
    acceso duplicado de Uvicorn.
- `app/main.py` usa un middleware **ASGI puro** (no `BaseHTTPMiddleware`) para conservar el
  contexto en la misma tarea. Acepta `X-Request-ID` solo si cumple `[A-Za-z0-9._-]{1,64}`; si no,
  genera uno. El P00 y el rol se toman del JWT **firmado** únicamente para trazabilidad; la
  autorización sigue en `get_current_user`.
- El evento `http_request` se emite con `INFO`, `WARNING` (>= 2 s) o `ERROR` (>= 500) e incluye
  método, ruta, estado y latencia.
- `CORS` expone `X-Request-ID` para que soporte pueda citarlo.

### 2.2 Eventos para alertas

| Evento | Dónde | Para qué |
|---|---|---|
| `http_request` | `app/main.py` | 5xx, latencia p95 y auditoría de acceso |
| `ingesta_completada` | `app/api/routes_ingesta.py` | detectar una ingesta diaria ausente |
| `ingesta_fallida` | `app/api/routes_ingesta.py` | encabezado inválido (lote en `ERROR`) |
| `notificacion_fallida` | `app/services/outbox.py` | notificación que agotó los reintentos |
| `ready_fallido` | `app/api/routes_health.py` | `/ready` con `503` |

### 2.3 Infraestructura

Nuevo `RepoTecnico/scripts/12_observabilidad.sh` (idempotente, vía API REST para no depender del
componente `gcloud alpha`):

- métricas basadas en logs `ggto_ingesta_completada`, `ggto_notificacion_fallida`,
  `ggto_http_5xx` y `ggto_http_latencia` (distribución de `jsonPayload.ms`);
- 4 políticas: ingesta ausente 23 h, 5xx/`/ready` en 5 min, notificación fallida en 15 min y
  latencia p95 > 2 s en 10 min;
- canal de correo si se define `ALERTA_EMAIL`;
- *uptime check* de `/health` cada 5 minutos;
- retención explícita de `_Default` a 30 días.

Dos límites de la API obligaron a ajustar el script durante la puesta en marcha:

- Monitoring rechaza `conditionAbsent` con duración superior a **23 h 30 min**; la alerta de
  ingesta quedó en **23 h** (`82800s`) para dejar margen antes del corte de 24 h.
- El `GET` de una métrica de Logging devolvía `404` aunque la métrica existiera. El script ahora
  hace `PUT` (actualización idempotente) y solo usa `POST` si la métrica no existe; un `409` se
  resuelve con un segundo `PUT`. Así se puede ejecutar repetidamente sin fallar.

### 2.4 APK

Nuevo `app_movil/lib/core/crash_log.dart`: registro local rotativo (256 KB, 3 archivos) para
`FlutterError.onError` y `PlatformDispatcher.instance.onError`, con versión de la app y saneado de
token, P00, correo y teléfono. No envía datos fuera del dispositivo. El envío remoto
(Sentry/Crashlytics) queda pendiente de credenciales y configuración del proyecto.

## 3. Verificación

| Prueba | Resultado |
|---|---|
| `app/tests/test_d155_observabilidad.py` | **7 passed** |
| Áreas relacionadas (`ingesta`, `alertas`, D-152, D-153, D-154) | **71 passed** |
| Suite completa | **593 passed**, cobertura **90,03 %** (14m00s) |
| `ruff` / `mypy` | sin hallazgos |
| `bash -n RepoTecnico/scripts/12_observabilidad.sh` | OK |
| `flutter analyze` | sin hallazgos |
| `flutter test` | **276 passed** |

Casos cubiertos: redacción de secretos/PII; formato JSON con contexto; `X-Request-ID` válido e
inválido; P00/rol en el log de acceso; `ready_fallido`; `ingesta_completada`; y
`notificacion_fallida` cuando el outbox agota los reintentos.

## 4. Despliegue

El **2026-10-22** se desplegó la imagen **v80** con D-148, D-149, D-150, D-152, D-153, D-154 y
D-155. Resultado verificado:

| Dato | Valor |
|---|---|
| Imagen | `southamerica-east1-docker.pkg.dev/truekeate-main/truekeate-repo/ggto-web:v80` |
| Revisión de Cloud Run | `ggto-web-00093-g8c`, 100 % del tráfico |
| URL | `https://ggto-web-593453426217.europe-west1.run.app` |
| `/health`, `/ready`, `/`, `/manual/` y un HTML de manual | `200` |
| `/ready` | PostgreSQL 15.18, base `ggtov2`, 43 tablas, `"almacenamiento": "gcs"`, `evidencias_ok: true` |
| Log JSON | `jsonPayload.evento="http_request"`, `request_id="deploy-v80-check"`, ruta `/health`, estado 200 |
| APK servida | `1.15.17+42`, 25.162.951 bytes, SHA-256 `22c59a…128c`, idéntico al binario firmado |
| Observabilidad | 4 métricas, 4 políticas habilitadas, uptime `/health` cada 300 s, retención 30 días |
| Alertas | 0 canales: no se configuró `ALERTA_EMAIL` |

El script se ejecutó sin `ALERTA_EMAIL`, por lo que las políticas existen pero no notifican. Para
activarlas, ejecutar de nuevo con el correo de destino o asociar un canal desde Monitoring.

La ejecución de referencia es:

```bash
PROYECTO=truekeate-main bash RepoTecnico/scripts/12_observabilidad.sh
```

La verificación de una línea JSON se hizo con una petición marcada:

```bash
curl -H 'X-Request-ID: deploy-v80-check' \
  https://ggto-web-593453426217.europe-west1.run.app/health
gcloud logging read \
  'resource.type="cloud_run_revision" AND jsonPayload.request_id="deploy-v80-check"' \
  --project=truekeate-main --limit=1 --format=json
```

Queda pendiente la prueba en un dispositivo real del log local de la APK: provocar un fallo
controlado y confirmar `logs/ggto_tecnico.log` en el almacenamiento privado, sin PII.

## 5. Residuales

- **Crash reporting remoto de la APK:** requiere un DSN de Sentry o un proyecto Firebase; el log
  local ya está implementado. No se añadió una dependencia nativa para no romper la compilación
  sin credenciales.
- **Canal de alertas:** sin `ALERTA_EMAIL`, las políticas existen pero no notifican; se pueden
  asociar después desde la consola.
- **Retención:** el script fija `_Default` a 30 días; si el proyecto usa un bucket distinto o un
  *sink*, hay que ajustar el destino.
- **PII en excepciones:** la redacción cubre patrones conocidos, pero un error de base de datos
  podría incluir nombres o direcciones entrecomillados. No se registran cuerpos, query strings ni
  cabeceras; conviene revisar un log antes de compartirlo fuera del equipo.
- **Métricas de negocio:** `/metricas` sigue siendo un endpoint autenticado; las alertas se basan
  en los eventos de log, no en un exportador Prometheus.

## 6. APK publicada con el log local

El 2026-10-22 se compiló y firmó la APK **`1.15.17+42`** con el keystore oficial
(`CN=GGTO Tecnico`), usando `scripts/publicar_apk.py --confirmar`:

| Dato | Valor |
|---|---|
| `versionName` / `versionCode` | `1.15.17` / `42` |
| Tamaño | **25.162.951 bytes** (24,0 MB) |
| SHA-256 del APK | `22c59a673b86e988ba8ebb22e626021623a9e1c7b2ec8704df3799c9e8ec128c` |
| SHA-256 del certificado | `1591662443fa9df058d3dce995403e31a50020db2e6ce65beccf26a1316bef44` |
| Copias | `app_movil/GGTOv2.apk` y `app/web/public/apk/ggto-tecnico.apk` |
| Metadatos | `app/web/public/apk/apk.json` actualizado |

La APK incorpora `app_movil/lib/core/crash_log.dart` (log local rotativo y saneado de D-155).
Verificado en el binario: `lib/arm64-v8a/libapp.so` contiene las cadenas `ggto_tecnico.log` y
`CrashLog`.

**Descarga en producción verificada:** v80 sirve `/apk/ggto-tecnico.apk` y
`/apk/apk.json`; el archivo descargado mide **25.162.951 bytes** y su SHA-256 coincide con el
binario firmado (`22c59a…128c`). El APK y `apk.json` están ignorados por git, por lo que el
despliegue debe hacerse desde este árbol de trabajo (o copiarlos al contexto de la imagen).
