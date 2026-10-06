# D-81 — Runbook de despliegue (preparado, NO ejecutado)

> Pasos para poner el **Incremento D-81** en producción (`ggtov2` + `ggto-web`).
> **Ninguno de estos pasos se ha ejecutado**: quedan a la espera de la orden del
> usuario (`/push`, `/preview`) y de las credenciales correspondientes.

---

## 0. Precondiciones

- Acceso a la instancia Cloud SQL (`truekeate-db-dev`, base `ggtov2`) o su DSN.
- `gcloud` autenticado y proyecto `ggtov2` (o el disponible) seleccionado.
- Imagen base ya desplegada (revisión vigente de `ggto-web`).

## 1. Migración de esquema (idempotente)

```bash
export DB_HOST=... DB_PORT=5432 DB_NAME=ggtov2 DB_USER=ggtov2_app DB_SSLMODE=require
export DB_PASSWORD="$(gcloud secrets versions access latest --secret=ggtov2-db-password --project=truekeate-main)"

python3 scripts/migrar_d81_sync_mensajeria.py            # SIMULACIÓN (revisar el plan)
python3 scripts/migrar_d81_sync_mensajeria.py --aplicar  # aplica (confirmar con «sí»)
```

Crea/ajusta: `sync_log` (+`plataforma`, `duracion_ms`, `id_central`), `sync_check`,
`mensaje` (+`dedupe_key`, `origen_p00` NULL), `mensaje_destino`, `cita.recordatorio_para`
y los **7 parámetros** de `configuracion`. Todo con `IF NOT EXISTS`/`ON CONFLICT`.

> Con datos reales (D-54/D-55): la migración **solo toca esquema**, no borra filas.
> Se registra en `RepoTecnico/BaseOperaciones/migracion_d81.log`.

## 2. Variables y secretos del servicio

```bash
# Token para los jobs de mantenimiento (fail-closed)
gcloud secrets create ggto-mantenimiento-token --replication-policy=automatic --project=<PROY>
echo -n "$(openssl rand -hex 24)" | gcloud secrets versions add ggto-mantenimiento-token --data-file=- --project=<PROY>
```

## 3. Reconstruir y desplegar `ggto-web`

La SPA se sirve desde el mismo contenedor (`app/web/dist`), así que el despliegue
incluye backend **y** frontend:

```bash
# Contrato SPA -> dist del incremento (panel, mensajería, sincronización)
cd app/web && npm ci && npm run build && cd ../..

# Imagen y despliegue (ver RepoTecnico/scripts/11_desplegar_ggto_web.sh)
gcloud run deploy ggto-web --source . --region=europe-west1 \
  --set-env-vars DB_HOST=/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev,DB_PORT=5432,DB_NAME=ggtov2,DB_USER=ggtov2_app,DB_SSLMODE=require \
  --set-secrets SECRET_KEY=ggto-secret-key:latest,DB_PASSWORD=ggtov2-db-password:latest,MANTENIMIENTO_TOKEN=ggto-mantenimiento-token:latest
```

## 4. Cloud Scheduler (4 jobs, TZ `America/Caracas`)

Todos con el header `X-Mantenimiento-Token: <token>` (OIDC como alternativa):

| Job | Cron | Ruta |
|---|---|---|
| Cierre de sesiones | `*/10 * * * *` | `/api/v1/mantenimiento/cerrar-sesiones` |
| Purga | `0 * * * *` | `/api/v1/mantenimiento/purgar` |
| Recordatorios de citas | `*/15 * * * *` | `/api/v1/mantenimiento/recordatorios-citas` |
| Alarmas de despacho | `*/30 * * * *` | `/api/v1/mantenimiento/alarmas-despacho` |

## 5. Verificación en vivo

- `GET /health` y `GET /ready` → `200`.
- `GET /api/v1/sincronizaciones` (con token ADMIN/SUPERVISOR) → `200`.
- `POST /api/v1/mantenimiento/purgar` sin token → `503`; con token → `200`.
- Publicar un mensaje `TODOS` y verlo desde la APK (sondeo 20 s).
- SPA: **SISTEMAS → Sincronización**, **Mensajes** (badge) y panel de gestión diaria.

## 6. Rollback

- **Código:** volver a la revisión previa de Cloud Run (`gcloud run services update-traffic`).
- **Esquema:** las tablas nuevas y columnas son **aditivas**; el código anterior las ignora.
  No hay migración destructiva que revertir.

## 7. Pendientes externos (heredados)

- Restringir el acceso público de `ggto-web` y habilitar respaldo antes de operar con PII real (D-26).
- Firmar el contrato de interfaz con CANTV.
