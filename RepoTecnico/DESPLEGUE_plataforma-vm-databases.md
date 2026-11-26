# DESPLIEGUE GGTO con BD en `vm-databases` — BD vigente, Cloud Run retirado

> **Estado vigente verificado el 24/11/2026:** la **base sigue siendo la de este documento** (PostgreSQL 16.15 en `vm-databases`, `10.140.0.2:5432`, base `ggtov2`). El **Cloud Run de `plataforma-txbarlovento`** (`ggto-web-695669822281…`) fue retirado: la web/API vigente es `ggto-web` en **`ggto-prod-txblvento2`** (<https://ggto-web-695669822281.europe-west1.run.app>, imagen `:v106`), conectada a esta BD mediante el conector VPC `ggto-connector`. La tabla siguiente conserva el despliegue original como registro histórico.

**Fecha de ejecución original:** jueves 12/11/2026 (noche)
**Motivo:** indicación del usuario de usar **la BD del servicio de
`txbarlovento@gmail.com`** (Postgres de `vm-databases`) y redesplegar allí.

---

## 1 · Datos de la plataforma

| Recurso | Valor |
|---|---|
| **URL web / API (vigente)** | <https://ggto-web-695669822281.europe-west1.run.app> |
| Proyecto GCP del Cloud Run (vigente) | `ggto-prod-txblvento2` (nº **695669822281**) |
| Proyecto GCP de la BD (vigente) | `plataforma-txbarlovento` (nº **695669822281**) |
| Región | **europe-west1** |
| Imagen (vigente) | `europe-west1-docker.pkg.dev/ggto-prod-txblvento2/ggto/ggto-web:v106` |
| Bucket de evidencias (env vigente) | `gs://ggto-prod-txblvento-ggto-evidencias` |
| Cuenta de servicio (vigente) | `ggto-web-sa@ggto-prod-txblvento2.iam.gserviceaccount.com` |
| Revisión (vigente) | `ggto-web-00016-k2k` (100 % del tráfico) |
| APK | **`1.15.25+50`** |

## 2 · Base de datos (en la VM, no Cloud SQL)

| Dato | Valor |
|---|---|
| Host | **`10.140.0.2`** (IP privada de `vm-databases`, red `plataforma-vpc` / subred `subnet-euw1` 10.140.0.0/20) |
| Contenedor | `postgres:16` (Docker) — datos en `/srv/data/postgres` |
| Puerto | `5432` (publicado ahora en `10.140.0.2` **y** `100.89.28.1` Tailscale) |
| Base | **`ggtov2`** (44 tablas, 198 casos, 675 movimientos) |
| Usuario app | `ggtov2_app` (propietario de la base y con privilegios en el esquema) |
| Contraseña | Secret Manager `ggtov2-db-password` (proyecto `plataforma-txbarlovento`) |
| Superusuario del contenedor | `txbarlovento` |

**Red y firewall:**

- `allow-ggto-postgres`: ingress tcp:5432 desde `10.140.0.0/20` hacia la VM
  (tag `ggto-db`). Cloud Run sale por Direct VPC egress a `subnet-euw1`.
- Cloud Run: `--network plataforma-vpc --subnet subnet-euw1
  --vpc-egress private-ranges-only`.

**RLS:** las tablas conservan `FORCE ROW LEVEL SECURITY`; el usuario de la app
no la elude aunque tenga privilegios.

## 3 · Migración de datos

```
# Dump exportado de Cloud SQL (estado post-cierre) e importado en la VM:
psql -U txbarlovento -d ggtov2 < dump_ggtov2_20261112_post_cierre.sql
```

Verificado: `caso`=198 · `caso_estado_hist`=675 · 44 tablas · 54 abiertos.
Único error del dump: `GRANT ... cloudsqlsuperuser` (rol inexistente fuera de
Cloud SQL; inocuo).

## 4 · Despliegue (Cloud Run)

```
gcloud run deploy ggto-web \
  --project plataforma-txbarlovento --region europe-west1 \
  --image europe-west1-docker.pkg.dev/plataforma-txbarlovento/ggto/ggto-web:v101 \
  --port 8080 --cpu 1 --memory 512Mi --timeout 300 \
  --min-instances 0 --max-instances 10 \
  --network plataforma-vpc --subnet subnet-euw1 --vpc-egress private-ranges-only \
  --set-env-vars "DB_HOST=10.140.0.2,DB_PORT=5432,DB_NAME=ggtov2,DB_USER=ggtov2_app,
                 DB_SSLMODE=prefer,APP_ENV=production,
                 GGTO_GCS_BUCKET=plataforma-txbarlovento-ggto-evidencias" \
  --set-secrets "SECRET_KEY=ggto-secret-key:latest,DB_PASSWORD=ggtov2-db-password:latest,
                 MANTENIMIENTO_TOKEN=ggto-mantenimiento-token:latest" \
  --service-account ggto-web-sa@plataforma-txbarlovento.iam.gserviceaccount.com \
  --allow-unauthenticated
```

**Verificación:**

| Check | Resultado |
|---|---|
| `/version.json` | `{"version":"v101"}` |
| `/health` | `{"status":"ok"}` |
| `/ready` | PostgreSQL 16.15 · `ggtov2` · 44 tablas · `gcs` · `evidencias_ok: true` |
| Login SUPER + `/api/v1/casos` | JWT OK · **198 casos** (55 abiertos) |
| Tests | backend 127 · APK **290** |

## 5 · Scheduler

5 jobs `ENABLED` en `plataforma-txbarlovento/europe-west1`
(`ggto-purgar`, `ggto-cerrar-sesiones`, `ggto-recordatorios-citas`,
`ggto-alarmas-despacho`, `ggto-cierre-jornada`).

## 6 · Cambios en la VM

- El contenedor `postgres` se recreó con los **mismos datos y variables**
  (`POSTGRES_USER=txbarlovento`, `PGDATA=/var/lib/postgresql/data/pgdata`,
  volumen `/srv/data/postgres`) añadiendo la publicación en `10.140.0.2:5432`.
- Se creó la base `ggtov2` + rol `ggtov2_app` y se concedieron privilegios
  sobre el esquema `public`.

> ⚠️ **Sin backups gestionados** (no es Cloud SQL): se recomienda un `pg_dump`
> diario a Cloud Storage o a disco con retención.

## 7 · Despliegues anteriores (respaldo)

| Proyecto | URL | BD | Estado |
|---|---|---|---|
| `plataforma-txbarlovento` | ggto-web-695669822281… | Postgres VM (`ggtov2`) | **en operaciones** |
| `ggto-prod-txblvento2` | ggto-web-695669822281… | Cloud SQL `ggto-db` | intacto, como respaldo (se puede apagar) |
| `ggto-prod-txblvento` | — | Cloud SQL `ggto-db` | restaurado, servicios corruptos, solo respaldo |
