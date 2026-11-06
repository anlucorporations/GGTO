# DESPLIEGUE GGTO en `ggto-prod-txblvento` (GCP de TX Barlovento)

**Fecha de ejecución:** viernes 06/11/2026
**Sistema migrado desde:** `truekeate-main` (caído por cierre de
facturación; revisión final `ggto-web-00115-g4b`, v100)
**Ciclo del código desplegado:** v100 — commit `93b81b0` en la rama
`GGTOv2-DSH-GCP` (GitHub + GitLab).

---

## 1 · Datos de la plataforma nueva

| Recurso | Valor |
|---|---|
| **URL de la web / API** | <https://ggto-web-597577479284.europe-west1.run.app> |
| Proyecto GCP | `ggto-prod-txblvento` (nº **597577479284**) — creado 06/11/2026 |
| Cuenta de facturación | `01E9E1-5892F8-EC5643` (`Mi cuenta de facturación`, **OPEN**) — del dueño `txbarlovento@gmail.com` |
| Región | **europe-west1** (Cloud Run, Cloud SQL, registro, bucket y Scheduler) |
| Cuentas usadas | `txbarlovento@gmail.com` (dueño, propietario) · `anlucorporations@gmail.com` (solo el export de la BD del proyecto viejo) |

## 2 · Recursos creados (fase por fase)

### 2.1 Proyecto y APIs
```
gcloud projects create ggto-prod-txblvento --name "GGTO Produccion TXBL"
gcloud billing projects link ggto-prod-txblvento --billing-account=01E9E1-5892F8-EC5643
gcloud services enable run, cloudbuild, artifactregistry, sqladmin,
        secretmanager, cloudscheduler, storage
```

### 2.2 Cloud SQL — servicio global gestionado con HA
| Atributo | Valor |
|---|---|
| Instancia | `ggto-db` (**POSTGRESQL_15**, capa `db-f1-micro`) |
| Disponibilidad | **REGIONAL (HA)** — el standby asume el control si falla el nodo |
| Región | europe-west1 |
| Base de datos | `ggtov2` · usuario de la app: `ggtov2_app` (clave nueva en Secret Manager) |
| Conexión desde Cloud Run | por socket `/cloudsql/ggto-prod-txblvento:europe-west1:ggto-db` |

### 2.3 Otros recursos
| Recurso | Nombre / valor |
|---|---|
| Registro de imágenes | `europe-west1-docker.pkg.dev/ggto-prod-txblvento/ggto/ggto-web` |
| Imagen desplegada | `ggto-web:v100` — digest `sha256:06449792b005c42b5f6b7d1ce30352550467987701bab5c58a51fce4a5839cd4` |
| Bucket de evidencias/backup | `gs://ggto-prod-txblvento-ggto-evidencias` |
| Cuenta de servicio | `ggto-web-sa@ggto-prod-txblvento.iam.gserviceaccount.com` — roles `cloudsql.client` · `secretmanager.secretAccessor` (los 3 secretos) · `storage.objectUser` |
| App Engine (requerido por el Scheduler) | `app create --region=europe-west1` |
| Secretos Secret Manager | `ggto-secret-key` · `ggtov2-db-password` · `ggto-mantenimiento-token` (todos NUEVOS, version 1) |

## 3 · Datos migrados (dump de producción)

**El dump LOGRÓ hacerse hoy** (el bloque de ayer: la cuenta de facturación
cerrada del proyecto viejo y la clave rotada de `ggtov2_app`):

```
gcloud sql export sql truekeate-db-dev gs://ggto-prod-txblvento-ggto-evidencias/dump_ggtov2_20261106.sql \
  --database=ggtov2 --project truekeate-main
gcloud storage buckets add-iam-policy-binding gs://ggto-prod-txblvento-ggto-evidencias \
  --member="serviceAccount:p593453426217-o127e6@gcp-sa-cloud-sql.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin "
gcloud sql import sql ggto-db gs://ggto-prod-txblvento-ggto-evidencias/dump_ggtov2_20261106.sql \
  --database=ggtov2 --project ggto-prod-txblvento
```

Copias conservadas del dump `dump_ggtov2_20261106.sql` (1,2 MB):
- `gs://ggto-prod-txblvento-ggto-evidencias/dump_ggtov2_20261106.sql`
- `C:\GGTO\backup_gcp_2026-11-05\dump_ggtov2_20261106.sql`

**Integridad verificada en el destino** (túnel cloud-sql-proxy sobre
`127.0.0.1:5434`, luego cerrado):

| Chequeo | Valor leído |
|---|---|
| `caso` | **167 casos** |
| Averías (tipo AVERIA) | 40 CERRADO + 42 PENDIENTE = 82 ✓ |
| Bitácora `caso_estado_hist` | **633 movimientos** (cada operación con historia, D-120) |
| `falla_masiva` | 0 (correcto: el comportamiento de masivas según Datos y F‑plan de D-168/D-99) |

## 4 · Despliegue de la web y la API (Cloud Run)

Imagen construida y publicada con Cloud Build, despliegue con:

```
gcloud run deploy ggto-web \
  --project ggto-prod-txblvento --region europe-west1 \
  --image europe-west1-docker.pkg.dev/ggto-prod-txblvento/ggto/ggto-web:v100 \
  --port 8080 --cpu 1 --memory 512Mi --timeout 300 --min-instances 0 --max-instances 10 \
  --add-cloudsql-instances ggto-prod-txblvento:europe-west1:ggto-db \
  --set-env-vars "DB_HOST=/cloudsql/ggto-prod-txblvento:europe-west1:ggto-db,
                 DB_PORT=5432,DB_NAME=ggtov2,DB_USER=ggtov2_app,DB_SSLMODE=require,
                 APP_ENV=production,GGO_GCS_BUCKET=ggto-prod-txblvento-ggto-evidencias" \
  --set-secrets "SECRET_KEY=ggto-secret-key:latest,
                 DB_PASSWORD=ggtov2-db-password:latest,
                 MANTENIMIENTO_TOKEN=ggto-mantenimiento-token:latest" \
  --service-account ggto-web-sa@ggto-prod-txblvento.iam.gserviceaccount.com \
  --allow-unauthenticated
```

**Servicio verificado:**
| Check | Resultado |
|---|---|
| Revisión en tráfico | `ggto-web-00001-dzx` **al 100 %** |
| `/health` · `/ready` | **HTTP 200 · HTTP 200** |
| `/version.json` | `{"version":"v100"}` → **badge v100 en la navbar** |
| Login del SUPER (P00 123456) | **JWT OK** |
| API `casos?solo_abiertos=true` | `total: 66` (datos del dump) |
| API `fallas-masivas?solo_activas=true` | lista vacía (correcto) |

Importante: la imagen **v100** se construyó con el mismo `Dockerfile` y
script del repositorio (`11_desplegar_ggto_web.sh`), que hornea la
`version.json` del badge (commit `ce781a0`). El paso del deploy interactivo
de Cloud Run pide confirmación y aborta en shells sin TTY: se ejecutó con
`echo y | gcloud run deploy …` (o `-q` no aplica). Todo lo demás salió del
script parametrizado con el proyecto nuevo.

## 5 · Jobs de mantenimiento (Cloud Scheduler)

Creados en `europe-west1` con TZ America/Caracas y cabecera
`X-Mantenimiento-Token=<_secret ggto-mantenimiento-token>`:

| Job | Cron | Ruta |
|---|---|---|
| `ggto-purgar` | `0 * * * *` | `/api/v1/mantenimiento/purgar` |
| `ggto-cerrar-sesiones` | `*/10 * * * *` | `/api/v1/mantenimiento/cerrar-sesiones` |
| `ggto-recordatorios-citas` | `*/15 * * * *` | `/api/v1/mantenimiento/recordatorios-citas` |
| `ggto-alarmas-despacho` | `*/30 * * * *` | `/api/v1/mantenimiento/alarmas-despacho` |
| `ggto-cierre-jornada` | `0 23 * * *` | `/api/v1/mantenimiento/cierre-jornada` |

> Los 5 estados deben ser `ENABLED` (verificado con
> `gcloud scheduler jobs list --location=europe-west1`).

## 6 · APK (Flutter — `app_movil`)

| Atributo | Valor |
|---|---|
| Versión | **`1.15.22+47`** — la entrega previa era `1.15.21+46` |
| Cambio esencial | `core/constants.dart` — base URL `https://ggto-web-597577479284.europe-west1.run.app/api/v1` (vs la de `truekeate-main`) |
| Compilación | `flutter build apk --release` → `app-release.apk` de **24,2 MB** |
| Test de versión | **2 passed** (`test/version_visible_test.dart`: coincide con pubspec y formato nombre+versionCode) |

## 7 · Commit de documentación e infra

- `93b81b0` — «feat(deploy): GGTO mudado al proyecto ggto-prod-txblvento»
  (bitácora del estado, propuesta EJECUTADA, base URL + version de la APK),
  push a GitHub y GitLab.
- A nivel de **infraestructura no hay cambios de código**: los mismos
  scripts y el mismo `Dockerfile` se desplegaron con los parámetros del
  proyecto nuevo.

## 8 · Cómo desplegar de nuevo (referencia)

Cualquier despliegue posterior se hace así (todos los parámetros):

```bash
TAG=v101 PROYECTO=ggto-prod-txblvento SERVICIO=ggto-web \
  INSTANCIA_SQL=ggto-prod-txblvento:europe-west1:ggto-db \
  CUENTA_SERVICIO=ggto-web-sa@ggto-prod-txblvento.iam.gserviceaccount.com \
  REPO_IMAGEN=europe-west1-docker.pkg.dev/ggto-prod-txblvento/ggto/ggto-web \
  BUCKET=ggto-prod-txblvento-ggto-evidencias \
  RepoTecnico/scripts/11_desplegar_ggto_web.sh --confirmar
```

(Se requiere bash (Git Bash en Windows). El paso 7/7 del script vuelve a
programar los 5 jobs si aún no existen. En PowerShell NO usar `|` sobre el
script; el `gcloud run deploy` interactivo se confirma con
`echo y | gcloud run deploy …`.)

## 9 · Proyecto viejo `truekeate-main` (fase de apagado, PENDIENTE)

- Queda intacto y **caído** (503 por facturación cerrada) — no se tocó.
- Al darse 48 h estables en el proyecto nuevo se recomienda:
  1. Snapshot final de la BD vieja (ya se tiene).
  2. `gcloud run services delete ggto-web --project truekeate-main`
  3. Mover la instancia `truekeate-db-dev` a un snapshot demasiado y
     quitarla del proyecto para no pagar más (la facturación del proyecto
     apáctiva NO corre hasta el proyecto nuevo).

## 10 · Costos (estimación mensual de la plataforma nueva)

| Servicio | USD/mes aprox. |
|---|---|
| Cloud Run (0→10 instancias, 1 vCPU/512Mi) | 5–15 |
| Cloud SQL `db-f1-micro` **HA REGIONAL** | 25–35 (la HA dobla el costo vs single-zone) |
| Cloud Storage + bucket | ~1 |
| Secret Manager (3 secretos) | ~0.1 |
| Cloud Scheduler | ~0.2 |
| Cloud Build | dentro de tier gratuito |
| **Total** | **~31–52 USD/mes** (trafico-dependiente) |

## 11 · Credenciales y acceso a la aplicación

- **Login del SUPER**: `P00 123456` / clave (ver
  `RepoTecnico/credenciales/CREDENCIALES-GGTO.md` local), usuario
  `ANLUcorporations`, central 2324X «Francisco Salias».
- Los logins y PII de la plataforma quedan FUERA del repositorio (el dump
  contiene PII real; conservarlo solo en el bucket y en copy local, nunca
  commitearlo).
- Password de `ggtov2_app` (BD nueva) está versión 1 en Secret Manager del
  proyecto nuevo; si se rota, seguir el mismo procedimiento del archivo de
  credenciales (`ALTER ROLE` + nueva versión del secreto sin `--update-secrets`
  del servicio).

## 12 · Notas operativas (¿y si falla X?)

- **¿Cloud Run no arranca?** Revisar `gcloud run revisions list`: las causas
  típicas son permisos del `ggto-web-sa` (`cloudsql.client` y lectura de los
  3 secretos); aplicar `gcloud projects add-iam-policy-binding` con el
  mismo set de §2.3.
- **¿La BD parece vacía?** El dump es la única fuente de datos: verificar
  `SELECT count(*) FROM caso` (167). Si ≠, re-importar el dump (§3) tras
  `--database=ggtov2`.
- **¿Scheduler llama y falla?** Sus invocadores son anónimos sobre la URL
  pública; verificar `X-Mantenimiento-Token` cabeza y que el secret
  `ggto-mantenimiento-token` no haya sido rotado sin re-programar.
- **¿Apk vieja no responde?** La APK 1.15.21+46 apunta a `truekeate-main`
  (es de la misma URL caída). Entregar la nueva.
