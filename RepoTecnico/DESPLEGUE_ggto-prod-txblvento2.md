# DESPLIEGUE GGTO en `ggto-prod-txblvento2` (GCP de TX Barlovento) — v106

> **Estado vigente verificado el 24/11/2026:** el servicio `ggto-web` sirve la imagen `ggto-web:v106` (revisión `ggto-web-00016-k2k`, 100 % del tráfico) desde `europe-west1-docker.pkg.dev/ggto-prod-txblvento2/ggto/ggto-web`. La BD ya no es la Cloud SQL de este proyecto: es **PostgreSQL 16.15 en la VM `vm-databases`** (`10.140.0.2:5432`, base `ggtov2`) vía conector VPC `ggto-connector`; Cloud SQL `ggto-db` queda como respaldo. Los valores del despliegue original de v101 se conservan más abajo como registro histórico.

**Fecha de ejecución original:** jueves 12/11/2026
**Motivo:** el proyecto anterior `ggto-prod-txblvento` había quedado en estado
`DELETE_REQUESTED` (facturación desvinculada, servicio caído). Se restauró y,
como varios servicios de GCP seguían considerándolo eliminado (Cloud Build,
Artifact Registry, el registro del servicio de Cloud Run y Cloud Scheduler),
se desplegó en un proyecto nuevo y limpio.

---

## 1 · Datos de la plataforma

| Recurso | Valor |
|---|---|
| **URL de la web / API** | <https://ggto-web-695669822281.europe-west1.run.app> |
| Proyecto GCP | `ggto-prod-txblvento2` (nº **695669822281**) |
| Cuenta de facturación | `01E9E1-5892F8-EC5643` (`Mi cuenta de facturación`, **OPEN**) |
| Región | **europe-west1** |
| Imagen (vigente) | `europe-west1-docker.pkg.dev/ggto-prod-txblvento2/ggto/ggto-web:v106` |
| Bucket de evidencias (env vigente) | `gs://ggto-prod-txblvento-ggto-evidencias` (existe también `gs://ggto-prod-txblvento2-ggto-evidencias`) |
| Cuenta de servicio | `ggto-web-sa@ggto-prod-txblvento2.iam.gserviceaccount.com` |
| Revisión en tráfico | `ggto-web-00016-k2k` **al 100 %** |
| BD viva | PostgreSQL 16.15 en `vm-databases` — `10.140.0.2:5432`, base `ggtov2`, usuario `ggtov2_app` |
| Conector VPC | `ggto-connector` (red `ggto-vpc`, egress `private-ranges-only`) |
| Ciclo del código | v106 |
| APK | **`1.15.25+50`** — base URL apuntando a la URL nueva |

### 1.1 Registro de imágenes (cambio importante)

El registro **vive en el proyecto sano `plataforma-txbarlovento`**
(`europe-west1-docker.pkg.dev/plataforma-txbarlovento/ggto/ggto-web`), porque el
Artifact Registry del proyecto restaurado quedó inutilizable y Cloud Build
devuelve 403. Las imágenes se construyen con Docker en la VM `vm-dsh-dev`
(proyecto `plataforma-txbarlovento`) y se publican ahí.

Permisos cruzados concedidos sobre el repositorio `ggto`:

| Miembro | Rol | Para |
|---|---|---|
| `ggto-web-sa@ggto-prod-txblvento2…` | `artifactregistry.reader` | runtime |
| `service-695669822281@serverless-robot-prod…` | `artifactregistry.reader` | Cloud Run (pull) |

## 2 · Recursos creados

```
gcloud projects create ggto-prod-txblvento2 --name "GGTO Produccion TXBL 2"
gcloud billing projects link ggto-prod-txblvento2 --billing-account=01E9E1-5892F8-EC5643
gcloud services enable run, artifactregistry, sqladmin, secretmanager,
        cloudscheduler, storage, appengine
```

| Recurso | Detalle |
|---|---|
| Cloud SQL | `ggto-db` · POSTGRES_15 · `db-f1-micro` · **REGIONAL (HA)** · backups 03:00 + PITR + protección de borrado |
| Base / usuario | `ggtov2` / `ggtov2_app` |
| Secretos | `ggto-secret-key`, `ggtov2-db-password`, `ggto-mantenimiento-token` |
| App Engine | `apps/ggto-prod-txblvento2` (requerido por Scheduler) |
| Scheduler | 5 jobs `ENABLED` (ver §5) |

## 3 · Migración de datos

El proyecto restaurado conservaba la base **íntegra y al día** (198 casos), así
que se exportó desde ahí y se importó en la instancia nueva:

```
gcloud sql export sql ggto-db gs://ggto-prod-txblvento-ggto-evidencias/dump_ggtov2_20261112.sql \
  --database=ggtov2 --project ggto-prod-txblvento
gcloud sql import sql ggto-db gs://ggto-prod-txblvento2-ggto-evidencias/dump_ggtov2_20261112.sql \
  --database=ggtov2 --project ggto-prod-txblvento2
```

**Integridad verificada en destino:** `caso` = **198** · `caso_estado_hist` =
**633** · `falla_masiva` = **1** · 44 tablas.

Copias del dump: bucket nuevo, bucket del proyecto restaurado y
`C:\GGTO\backup_gcp_2026-11-12\dump_ggtov2_20261112.sql`.

## 4 · Despliegue de la web y la API (Cloud Run)

```
gcloud run deploy ggto-web \
  --project ggto-prod-txblvento2 --region europe-west1 \
  --image europe-west1-docker.pkg.dev/plataforma-txbarlovento/ggto/ggto-web:v101 \
  --port 8080 --cpu 1 --memory 512Mi --timeout 300 --min-instances 0 --max-instances 10 \
  --add-cloudsql-instances ggto-prod-txblvento2:europe-west1:ggto-db \
  --set-env-vars "DB_HOST=/cloudsql/ggto-prod-txblvento2:europe-west1:ggto-db,
                 DB_PORT=5432,DB_NAME=ggtov2,DB_USER=ggtov2_app,DB_SSLMODE=require,
                 APP_ENV=production,GGTO_GCS_BUCKET=ggto-prod-txblvento2-ggto-evidencias" \
  --set-secrets "SECRET_KEY=ggto-secret-key:latest,
                 DB_PASSWORD=ggtov2-db-password:latest,
                 MANTENIMIENTO_TOKEN=ggto-mantenimiento-token:latest" \
  --service-account ggto-web-sa@ggto-prod-txblvento2.iam.gserviceaccount.com \
  --allow-unauthenticated
```

> ⚠️ La variable es **`GGTO_GCS_BUCKET`** (con doble T). El documento anterior
> traía `GGO_GCS_BUCKET` (errata): con esa grafía `/ready` reporta
> `almacenamiento: no_configurado` y las evidencias fallan.

**Verificación en vivo:**

| Check | Resultado |
|---|---|
| `/version.json` | `{"version":"v101"}` |
| `/health` | `{"status":"ok"}` |
| `/ready` | `ready` · PostgreSQL 15.19 · 44 tablas · `almacenamiento: gcs` · `evidencias_ok: true` |
| `/` y `/manual/` | HTTP 200 |
| Login SUPER (`123456`) | JWT OK |
| Tests | backend **127 passed** · APK **290 passed** |

## 5 · Jobs de mantenimiento (Cloud Scheduler)

`europe-west1`, TZ `America/Caracas`, cabecera `X-Mantenimiento-Token`:

| Job | Cron | Ruta |
|---|---|---|
| `ggto-purgar` | `0 * * * *` | `/api/v1/mantenimiento/purgar` |
| `ggto-cerrar-sesiones` | `*/10 * * * *` | `/api/v1/mantenimiento/cerrar-sesiones` |
| `ggto-recordatorios-citas` | `*/15 * * * *` | `/api/v1/mantenimiento/recordatorios-citas` |
| `ggto-alarmas-despacho` | `*/30 * * * *` | `/api/v1/mantenimiento/alarmas-despacho` |
| `ggto-cierre-jornada` | `0 23 * * *` | `/api/v1/mantenimiento/cierre-jornada` |

Los 5 quedaron `ENABLED`.

## 6 · APK

| Atributo | Valor |
|---|---|
| Versión | **`1.15.23+48`** (anterior `1.15.22+47`) |
| Cambio | `core/constants.dart` → base URL `https://ggto-web-695669822281.europe-west1.run.app/api/v1` |
| Compilación | `flutter build apk --release` → `app-release.apk` de **24,2 MB** |
| Tests | **290 passed** (incluye `version_visible_test` y `inicio_tecnico_test` actualizados) |

## 7 · Cómo desplegar de nuevo

```bash
# 1) Construir la imagen (la VM tiene Docker instalado)
TAG=v102
#   tar -czf app.tgz app (excluyendo node_modules y dist) → scp a vm-dsh-dev → docker build
#   login: token OAuth2 como oauth2accesstoken → docker push

# 2) Desplegar (mismo bloque gcloud run deploy de §4 con el TAG nuevo)

# 3) Jobs: RepoTecnico/scripts/11_desplegar_ggto_web.sh §7 (o el script de §5)
```

Los pasos 2–3 del script `11_desplegar_ggto_web.sh` (secretos, bucket, deploy,
scheduler) siguen siendo válidos con:

```
PROYECTO=ggto-prod-txblvento2 SERVICIO=ggto-web \
INSTANCIA_SQL=ggto-prod-txblvento2:europe-west1:ggto-db \
CUENTA_SERVICIO=ggto-web-sa@ggto-prod-txblvento2.iam.gserviceaccount.com \
BUCKET=ggto-prod-txblvento2-ggto-evidencias \
RepoTecnico/scripts/11_desplegar_ggto_web.sh --confirmar
```
(El paso 4/7 —build en Cloud Build— falla en este proyecto; construir en la VM.)

## 8 · Proyecto restaurado `ggto-prod-txblvento` (decisión pendiente)

- Restaurado el 12/11 (estaba en `DELETE_REQUESTED`); facturación re-vinculada.
- BD `ggto-db` **sana y al día** (198 casos) — sirve de respaldo en caliente.
- Cloud Build (403), Artifact Registry ("proyecto eliminado"), el registro del
  servicio de Cloud Run (sin URL/tráfico) y Scheduler (inconsistente) siguen
  dañados; no se usan.
- Costo mientras siga encendido: ~25–35 USD/mes (SQL HA). Recomendación: tras
  30 días estables en el proyecto nuevo, exportar un dump final y apagarlo.

## 9 · Notas operativas

- **Secretos y PowerShell:** nunca copiar secretos con `>` de PowerShell
  (escribe UTF-16 y Cloud Run aborta con "non-UTF8 data"). Usar redirección de
  bash o `--data-file` desde un archivo generado en bash.
- **Contraseñas de BD:** pasarlas por API (`PUT /instances/{i}/users`) o por
  bash; PowerShell manglea bytes no ASCII y rompe la autenticación.
- **Si `/ready` da 503:** revisar `DB_HOST` (socket) y el permiso
  `roles/cloudsql.client` de `ggto-web-sa`.
- **Si fallan las evidencias:** verificar `GGTO_GCS_BUCKET` (doble T) y el rol
  `storage.objectUser` de `ggto-web-sa` sobre el bucket.
