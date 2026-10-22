# Incremento D-155 · Observabilidad y monitoreo (H-15)

**Fecha:** 2026-10-22
**Hallazgo:** H-15 (R3, severidad M) del `INFORME_OPTIMIZACION_V2.md`.
**Estado:** implementado, probado y publicado (`85604de`); despliegue pendiente con v80.

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
- 4 políticas: ingesta ausente 26 h, 5xx/`/ready` en 5 min, notificación fallida en 15 min y
  latencia p95 > 2 s en 10 min;
- canal de correo si se define `ALERTA_EMAIL`;
- *uptime check* de `/health` cada 5 minutos;
- retención explícita de `_Default` a 30 días.

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

1. Desplegar v80 (incluye D-148, D-149, D-150, D-152, D-153, D-154 y D-155).
2. Ejecutar, con una cuenta con permisos de Logging/Monitoring:

   ```bash
   PROYECTO=truekeate-main ALERTA_EMAIL=operaciones@ejemplo.com \
     bash RepoTecnico/scripts/12_observabilidad.sh
   ```

3. Verificar una línea JSON:

   ```bash
   gcloud logging read 'resource.type="cloud_run_revision" AND jsonPayload.evento="http_request"' \
     --project=truekeate-main --limit=1 --format=json
   ```

4. En Monitoring, comprobar las 4 políticas, el uptime de `/health` y la retención de 30 días.
5. En la APK, provocar un fallo controlado y confirmar que se crea
   `logs/ggto_tecnico.log` en el almacenamiento privado; el archivo no debe contener PII.

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
