# DESPLIEGUE GGTO en `plataforma-txbarlovento` con Cloud SQL dedicado — v101

**Fecha de ejecución:** sábado 14/11/2026
**Motivo:** verificación indicada por el usuario de que el despliegue usara el
**servicio gestionado de PostgreSQL de GCP** de `txbarlovento@gmail.com`.
Se migró la BD desde el contenedor Postgres de `vm-databases` a una instancia
**Cloud SQL dedicada** (`ggto-db`) y se redesplegó el servicio.

---

## 1 · Datos de la plataforma

| Recurso | Valor |
|---|---|
| **URL web / API** | <https://ggto-web-173076294289.europe-west1.run.app> |
| Proyecto GCP | `plataforma-txbarlovento` (nº **173076294289**) |
| Región | **europe-west1** |
| Imagen | `europe-west1-docker.pkg.dev/plataforma-txbarlovento/ggto/ggto-web:v101` |
| Revisión vigente | `ggto-web-00002-q84` (100 % del tráfico) |
| Bucket de evidencias | `gs://plataforma-txbarlovento-ggto-evidencias` |
| Cuenta de servicio | `ggto-web-sa@plataforma-txbarlovento.iam.gserviceaccount.com` |
| APK | **`1.15.24+49`** (sin cambios: la URL no varió) |

## 2 · Base de datos: Cloud SQL `ggto-db` (gestionado)

| Dato | Valor |
|---|---|
| Instancia | **`ggto-db`** — `plataforma-txbarlovento:europe-west1:ggto-db` |
| Motor | **PostgreSQL 16.15** (ENTERPRISE, `db-f1-micro`) |
| Disponibilidad | **REGIONAL (HA)** |
| IP | pública `34.156.141.36` (el acceso de la app es por **socket de Cloud SQL**, no por IP) |
| Base / usuario | **`ggtov2`** / `ggtov2_app` (contraseña en Secret Manager `ggtov2-db-password`) |
| Owner de objetos | `postgres` (restricción de Cloud SQL: no se puede asignar owner a otro rol) |
| Privilegios | `GRANT ALL` de esquema/tablas/secuencias/funciones a `ggtov2_app` + default privileges |
| Extensiones | `pg_trgm`, `pgcrypto` (creadas como `postgres` antes del import) |
| Backups | diario **03:00** + **PITR** + `deletion-protection` ON |
| Conexión app | `DB_HOST=/cloudsql/plataforma-txbarlovento:europe-west1:ggto-db`, `DB_SSLMODE=require` |
| IAM | `ggto-web-sa` con `roles/cloudsql.client`; SA de Cloud SQL con `objectAdmin` en el bucket |

**RLS:** se conserva `FORCE ROW LEVEL SECURITY`; `ggtov2_app` no la elude.

## 3 · Migración de datos (cómo se hizo)

```
# Dump solo-esquema-public desde el contenedor de vm-databases
docker exec postgres pg_dump -U txbarlovento -d ggtov2 --no-owner --format=plain --schema=public
# Ajustes del dump para Cloud SQL (script sed):
#   - eliminar CREATE SCHEMA public;                (ya existe)
#   - eliminar ALTER DEFAULT PRIVILEGES ...;        (el importador no puede cambiarlas)
# Crear extensiones ANTES del import (por proxy local, usuario postgres):
CREATE EXTENSION pg_trgm;  CREATE EXTENSION pgcrypto;   -- en ggtov2, no en postgres
# Import:
gcloud sql import sql ggto-db gs://...-ggto-evidencias/dump_ggtov2_20261114_cloudsql.sql \
  --database=ggtov2 --user=postgres --project plataforma-txbarlovento
# Privilegios (por proxy local, usuario postgres):
GRANT ALL ON SCHEMA public / ALL TABLES / SEQUENCES / FUNCTIONS TO ggtov2_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... GRANT ALL TO ggtov2_app;
```

**Verificación post-import:** `caso`=198 · `caso_estado_hist`=675 · 44 tablas ·
54 abiertos · extensiones OK.

## 4 · Despliegue (Cloud Run)

```
gcloud run deploy ggto-web \
  --project plataforma-txbarlovento --region europe-west1 \
  --image europe-west1-docker.pkg.dev/plataforma-txbarlovento/ggto/ggto-web:v101 \
  --port 8080 --cpu 1 --memory 512Mi --timeout 300 \
  --min-instances 0 --max-instances 10 \
  --add-cloudsql-instances plataforma-txbarlovento:europe-west1:ggto-db \
  --set-env-vars "DB_HOST=/cloudsql/plataforma-txbarlovento:europe-west1:ggto-db,
     DB_PORT=5432,DB_NAME=ggtov2,DB_USER=ggtov2_app,DB_SSLMODE=require,
     APP_ENV=production,GGTO_GCS_BUCKET=plataforma-txbarlovento-ggto-evidencias" \
  --set-secrets "SECRET_KEY=ggto-secret-key:latest,DB_PASSWORD=ggtov2-db-password:latest,
     MANTENIMIENTO_TOKEN=ggto-mantenimiento-token:latest" \
  --service-account ggto-web-sa@plataforma-txbarlovento.iam.gserviceaccount.com \
  --allow-unauthenticated
```

> Ya no se usa `--network plataforma-vpc / --subnet / --vpc-egress`
> (el socket de Cloud SQL no requiere VPC).

**Verificación en vivo (14/11/2026):**

| Check | Resultado |
|---|---|
| `/version.json` | `{"version":"v101"}` |
| `/health` | `{"status":"ok"}` |
| `/ready` | PostgreSQL **16.15** (Cloud SQL) · `ggtov2` · **44 tablas** · `gcs` · `evidencias_ok: true` |
| Login SUPER → JWT | OK |
| API `/api/v1/casos` | **198 casos** (55 abiertos) |
| Scheduler | 5 jobs `ENABLED` (apuntan a la misma URL; sin cambios) |

## 5 · Dumps y respaldos

| Artefacto | Ubicación |
|---|---|
| Dump pre-migración (solo `public`, estado 14/11) | `gs://plataforma-txbarlovento-ggto-evidencias/dump_ggtov2_20261114.sql` y `dump_ggtov2_20261114_cloudsql.sql` (ajustado) |
| Copia local | `C:\Users\lucci\AppData\Local\Temp\opencode\ggto_public.sql` / `ggto_cloudsql.sql` |
| Backups gestionados | diario 03:00 + PITR (automáticos) |

## 6 · Historial de despliegues

| Proyecto | BD | Estado |
|---|---|---|
| `plataforma-txbarlovento` | **Cloud SQL `ggto-db`** | **en operaciones** |
| `plataforma-txbarlovento` (fase 1, 12–14/11) | Postgres VM `vm-databases` | superado (doc previo) |
| `ggto-prod-txblvento2` | Cloud SQL `ggto-db` (PG15) | intacto como respaldo; jobs PAUSED; candidato a apagar |
| `ggto-prod-txblvento` | Cloud SQL `ggto-db` (PG15) | restaurado, servicios corruptos; solo respaldo |

## 7 · Pendientes recomendados

1. **Apagar** proyectos `ggto-prod-txblvento2` y `ggto-prod-txblvento`
   (sus Cloud SQL siguen corriendo y generando costo) tras período de estabilidad.
2. El Postgres de la VM queda como **respaldo estático**; si se quiere vivo,
   programar `pg_dump` diario a bucket.
3. Restringir el invocador del servicio Cloud Run (`--allow-unauthenticated`
   expone PII; pendiente histórico).
4. Rotar la contraseña temporal del usuario `postgres` de `ggto-db`
   (bootstrap de la migración) si se decide mantenerla; usar IAM DB auth.
