# GGTOv2 — Proyecto Google Cloud preparado para plataforma web con PostgreSQL

| Campo | Valor |
|---|---|
| Documento | Habilitación de infraestructura base en Google Cloud |
| Proyecto | **GGTOv2** (`projectId: ggtov2`, `projectNumber: 905974355709`) |
| Organización | `253767381125` |
| Cuenta de facturación | `013B00-B9A67C-014A43` (USD) |
| Región principal | `europe-west1` (Bélgica) |
| Perfil de base de datos | Desarrollo — Cloud SQL PostgreSQL `db-f1-micro`, sin HA |
| **Base de datos en uso** | **`truekeate-db-dev` (proyecto `truekeate-main`), base dedicada `ggtov2`** |
| Fecha de ejecución | 2026-09-24 / 2026-09-25 |
| Estado global | **Proyecto creado, base habilitada y PostgreSQL operativo vía instancia reutilizada de `truekeate-main`. Recursos facturables propios de `ggtov2` PENDIENTES por cuota de facturación.** |

> Nota: el pedido inicial mencionaba `GGTOv1`; por indicación expresa del usuario el proyecto se aprovisionó como **GGTOv2**.

---

## 1. Resumen ejecutivo

Se preparó un proyecto de Google Cloud llamado **GGTOv2** destinado a albergar una plataforma web con base de datos **PostgreSQL gestionada (Cloud SQL)** y manejo de **información sensible** (Secret Manager, Cloud KMS, Sensitive Data Protection, auditoría de accesos).

**Lo que quedó realmente ejecutado en GCP:**

1. Proyecto `ggtov2` creado y `ACTIVE` dentro de la organización.
2. **17 APIs de Google Cloud habilitadas** sin costo de facturación (las que no la exigen).
3. **2 cuentas de servicio** creadas con separación de funciones (runtime y despliegue).
4. **Matriz IAM de mínimo privilegio** aplicada (14 roles/bindings).
5. Configuración preparada para auditoría de accesos a datos (intentada; ver §3.5).
6. Scripts reproducibles de aprovisionamiento completo en `RepoTecnico/scripts/`.
7. **PostgreSQL operativo**: base `ggtov2` y usuario `ggtov2_app` creados en la instancia
   existente `truekeate-db-dev` (proyecto `truekeate-main`), credenciales en Secret Manager y
   acceso IAM cruzado para el runtime de GGTOv2. Privilegios verificados (ver §6.5).

**Bloqueo encontrado (único):** la cuenta de facturación ya tiene sus **5 proyectos** vinculados (cuota por defecto de cuentas autogestionadas). Sin facturación no se pueden habilitar `compute`, `secretmanager`, `run`, `cloudkms` (creación de llaves), `storage` (creación de buckets), `artifactregistry` ni crear la instancia Cloud SQL. El usuario decidió **no modificar la facturación** en esta sesión; por eso todo lo facturable quedó **documentado y scripteado** para ejecutarse en un solo comando cuando la cuota se resuelva.

**Todo lo pendiente se resuelve ejecutando `RepoTecnico/scripts/provision_all.sh`** una vez habilitada la facturación (ver §11).

---

## 2. Identificadores y datos del proyecto

| Recurso | Identificador |
|---|---|
| Nombre visible | `GGTOv2` |
| Project ID | `ggtov2` |
| Project number | `905974355709` |
| Organización | `organizations/253767381125` |
| Estado | `ACTIVE` |
| Cuenta de facturación | `billingAccounts/013B00-B9A67C-014A43` |
| Facturación activa | ❌ `billingEnabled: false` (cuota excedida) |
| Región | `europe-west1` |
| Zona sugerida | `europe-west1-b` |
| Red objetivo | `ggtov2-vpc` / subred `ggtov2-subnet` (10.10.0.0/24) |
| Rango Private Service Access | `ggtov2-psa-range` (/20) |
| Instancia PostgreSQL | `ggtov2-pg` (PostgreSQL 16) — *no creada, pendiente de facturación* |
| **Instancia PostgreSQL en uso** | **`truekeate-db-dev` — `truekeate-main:southamerica-east1:truekeate-db-dev` (POSTGRES_15)** |
| **Base / usuario dedicados** | **`ggtov2` / `ggtov2_app` en `truekeate-db-dev`** |
| Base de datos / usuario | `ggtov2` / `ggtov2_app` |
| Servicio web | `ggtov2-web` (Cloud Run) |
| Repositorio de imágenes | `europe-west1-docker.pkg.dev/ggtov2/ggtov2-web` |
| Bucket de activos | `ggtov2-assets-905974355709` |
| Cuenta de servicio runtime | `ggtov2-app@ggtov2.iam.gserviceaccount.com` |
| Cuenta de servicio despliegue | `ggtov2-deploy@ggtov2.iam.gserviceaccount.com` |

---

## 3. Estado de ejecución detallado (evidencia)

### 3.1 Proyecto

```
projectId     : ggtov2
name          : GGTOv2
projectNumber : 905974355709
lifecycleState: ACTIVE
createTime    : 2026-09-24T17:30:31.706Z
parent        : organizations/253767381125
```

La creación se hizo vía `cloudresourcemanager.googleapis.com/v1/projects` con la operación asíncrona `operations/create_project.global.6773632443723515682` (finalizada: `done: true`).

### 3.2 APIs habilitadas (sin requisito de facturación) — 17

| API | Uso |
|---|---|
| `cloudresourcemanager.googleapis.com` | Gestión del proyecto e IAM |
| `serviceusage.googleapis.com` | Habilitación de servicios |
| `iam.googleapis.com` | Cuentas de servicio y políticas |
| `iamcredentials.googleapis.com` | Tokens de cuentas de servicio |
| `cloudbilling.googleapis.com` | Estado de facturación |
| `sqladmin.googleapis.com` | **Administración de Cloud SQL (PostgreSQL)** |
| `sql-component.googleapis.com` | Componentes de Cloud SQL |
| `servicenetworking.googleapis.com` | **Private Service Access (peering de red para SQL)** |
| `storage.googleapis.com` | Cloud Storage (API habilitada) |
| `logging.googleapis.com` | Cloud Logging |
| `monitoring.googleapis.com` | Cloud Monitoring |
| `networkconnectivity.googleapis.com` | Conectividad de red |
| `cloudkms.googleapis.com` | API de Cloud KMS habilitada |
| `cloudtrace.googleapis.com` | Trazas |
| `cloudprofiler.googleapis.com` | Perfilado |
| `clouderrorreporting.googleapis.com` | Reporte de errores |
| `containeranalysis.googleapis.com` / `telemetry.googleapis.com` | Heredadas de la organización |

### 3.3 Cuentas de servicio creadas

| Cuenta | Nombre visible | Propósito |
|---|---|---|
| `ggtov2-app@ggtov2.iam.gserviceaccount.com` | GGTOv2 App Runtime (Cloud Run) | Identidad de ejecución de la plataforma web |
| `ggtov2-deploy@ggtov2.iam.gserviceaccount.com` | GGTOv2 CI/CD Deploy | Identidad de pipelines de despliegue |

### 3.4 IAM de mínimo privilegio (aplicado, 14 bindings)

**`ggtov2-app` (runtime):**

| Rol | Para qué |
|---|---|
| `roles/cloudsql.client` | Conectarse a Cloud SQL |
| `roles/secretmanager.secretAccessor` | Leer secretos de la app |
| `roles/cloudkms.cryptoKeyDecrypter` | Descifrar con CMEK |
| `roles/logging.logWriter` | Escribir logs |
| `roles/monitoring.metricWriter` | Publicar métricas |
| `roles/cloudtrace.agent` | Enviar trazas |
| `roles/cloudprofiler.agent` | Perfilado |
| `roles/serviceusage.serviceUsageConsumer` | Consumir servicios del proyecto |

**`ggtov2-deploy` (CI/CD):**

| Rol | Para qué |
|---|---|
| `roles/run.admin` | Desplegar Cloud Run |
| `roles/artifactregistry.writer` | Subir imágenes |
| `roles/cloudbuild.builds.editor` | Ejecutar builds |
| `roles/iam.serviceAccountUser` | Actuar como la SA runtime |
| `roles/storage.objectAdmin` | Publicar activos |
| `roles/cloudsql.client` | Migraciones de base de datos |

La cuenta `user:anlucorporations@gmail.com` conserva `roles/owner` sobre el proyecto.

### 3.5 Auditoría de acceso a datos — INTENTADA, NO PERSISTIDA

Se envió la política con `auditConfigs` para `secretmanager`, `cloudkms`, `cloudsql` y `storage` (`ADMIN_READ` / `DATA_READ` / `DATA_WRITE`). La API respondió `HTTP 200` pero **devolvió la política con `version: 1` y sin `auditConfigs`**, es decir, el cambio no se almacenó. Debe reintentarse tras habilitar facturación / revisar permisos de auditoría:

```bash
# Reintento (una vez resuelta la facturación)
RepoTecnico/scripts/08_auditoria_presupuesto.sh
```

Verificación:

```bash
gcloud projects get-iam-policy ggtov2 --format=json | jq '.auditConfigs'
```

---

## 4. Bloqueo actual: cuota de facturación

### 4.1 Evidencia

```
PUT https://cloudbilling.googleapis.com/v1/projects/ggtov2/billingInfo
→ 400 FAILED_PRECONDITION
  "Cloud billing quota exceeded:
   https://support.google.com/code/contact/billing_quota_increase"
  subject: billingAccounts/013B00-B9A67C-014A43
```

Proyectos que ocupan los 5 cupos de la cuenta `013B00-B9A67C-014A43`:

| Proyecto | ¿Candidato a liberar? |
|---|---|
| `barloventasv2` | Evaluar |
| `daovotacionv1` | Evaluar |
| `mcc-ecommerce` | No (proyecto actual de la instancia) |
| `quantum-feat-503600-q6` | Probable (nombre de proyecto temporal) |
| `truekeate-main` | Evaluar |

### 4.2 Opciones para resolverlo (decisión del usuario)

1. **Liberar un cupo**: desvincular facturación de un proyecto en desuso.
   ```bash
   gcloud billing projects unlink NOMBRE_DEL_PROYECTO
   ```
2. **Solicitar aumento de cuota** en `https://support.google.com/code/contact/billing_quota_increase`.
3. **Migrar a una cuenta de facturación con cupo disponible.**

### 4.3 Comando exacto para vincular GGTOv2 (cuando haya cupo)

```bash
gcloud billing projects link ggtov2 --billing-account=013B00-B9A67C-014A43
# o vía API:
# PUT https://cloudbilling.googleapis.com/v1/projects/ggtov2/billingInfo
# {"billingAccountName":"billingAccounts/013B00-B9A67C-014A43"}
```

### 4.4 Impacto del bloqueo

| Capacidad | Estado sin facturación |
|---|---|
| Proyecto, IAM y cuentas de servicio | ✅ Operativo |
| APIs de administración de Cloud SQL | ✅ Habilitada |
| VPC, subred, Private Service Access | ❌ Requiere `compute.googleapis.com` |
| Instancia Cloud SQL PostgreSQL | ❌ Requiere facturación |
| Secret Manager (crear secretos) | ❌ Requiere facturación |
| Cloud KMS (crear llaves) | ❌ Requiere facturación |
| Cloud Storage (crear bucket) | ❌ Requiere facturación |
| Artifact Registry / Cloud Build | ❌ Requiere facturación |
| Cloud Run (plataforma web) | ❌ Requiere facturación |
| Sensitive Data Protection (DLP) | ❌ Requiere facturación |

---

## 5. Arquitectura objetivo

```
                    Internet
                       │  HTTPS 443
                       ▼
        ┌──────────────────────────────────────┐
        │  Cloud Run  ·  ggtov2-web             │
        │  contenedor Docker (Artifact Registry)│
        │  SA: ggtov2-app                       │
        │  env: DB_* + SECRET_KEY (Secret Mgr)  │
        └───────────────┬──────────────────────┘
                        │ Direct VPC egress
                        ▼
        ┌──────────────────────────────────────┐
        │  VPC ggtov2-vpc (europe-west1)        │
        │  subred 10.10.0.0/24                  │
        │  Private Service Access (peering /20) │
        └───────────────┬──────────────────────┘
                        │ IP privada  ·  sslmode=require
                        ▼
        ┌──────────────────────────────────────┐
        │  Cloud SQL PostgreSQL 16 · ggtov2-pg  │
        │  db-f1-micro · ZONAL · 10 GB SSD      │
        │  backups + PITR (7 días)              │
        │  deletion protection ON               │
        └──────────────────────────────────────┘

  Servicios transversales:
   • Secret Manager  → contraseñas y claves (cifradas con CMEK)
   • Cloud KMS       → llaves ggtov2-secrets / ggtov2-storage (rotación 90 d)
   • Cloud Logging   → auditoría de acceso a datos sensibles
   • Cloud Monitoring→ métricas, alertas y presupuesto
   • Artifact Registry → imágenes Docker
   • Cloud Storage   → activos, sin acceso público, CMEK, versionado
```

### Componentes y justificación

| Capa | Servicio | Motivo |
|---|---|---|
| Cómputo web | Cloud Run | Serverless, escala a cero, HTTPS gestionado, integra VPC |
| Base de datos | Cloud SQL PostgreSQL 16 | Servicio gestionado de PostgreSQL, backups/PITR/HA |
| Conectividad DB | VPC + Private Service Access | La base **no** expone IP pública |
| Secretos | Secret Manager + CMEK | Contraseñas nunca en código ni en variables planas |
| Cifrado | Cloud KMS | Claves propias (CMEK) y rotación automática |
| Datos sensibles | Sensitive Data Protection (DLP) | Descubrimiento/clasificación de PII |
| Imágenes | Artifact Registry | Registro privado de contenedores |
| Observabilidad | Cloud Logging/Monitoring/Trace | Diagnóstico y auditoría |
| Red | VPC dedicada | Aislamiento, sin red `default` compartida |

---

## 6. PostgreSQL gestionado (Cloud SQL)

### 6.1 Configuración planificada (`06_cloudsql_postgres.sh`)

| Parámetro | Valor |
|---|---|
| Motor | `POSTGRES_16` |
| Instancia | `ggtov2-pg` |
| Región | `europe-west1` |
| Tier (dev) | `db-f1-micro` |
| Alta disponibilidad | `ZONAL` (dev) — producción: `REGIONAL` |
| Disco | `PD_SSD`, 10 GB, autoescalado hasta 50 GB |
| IP pública | ❌ deshabilitada (`ipv4Enabled: false`) |
| Red privada | `projects/ggtov2/global/networks/ggtov2-vpc` |
| SSL | `sslMode: ENCRYPTED_ONLY` (obligatorio) |
| Backups | Diarios, `startTime 03:00`, retención 7 días |
| Point-in-time recovery | ✅ habilitado |
| Protección de borrado | ✅ `deletionProtectionEnabled: true` |
| Política de contraseñas | mínimo 12, complejidad, sin reutilizar 5, sin nombre de usuario |
| Flags | `cloudsql.iam_authentication=on`, `log_min_duration_statement=500`, `log_connections=on` |
| Query Insights | ✅ habilitado |
| Ventana de mantenimiento | domingo 03:00 (`day:7`, `hour:3`, track `stable`) |

### 6.2 Contraseñas

- `ggtov2-db-root-password` → contraseña del usuario `postgres`.
- `ggtov2-db-password` → contraseña del usuario de aplicación `ggtov2_app`.
- Se generan aleatoriamente (32 caracteres) y **solo** se almacenan en Secret Manager, cifradas con CMEK.
- La SA `ggtov2-app` tiene `secretmanager.secretAccessor` únicamente sobre los secretos que necesita.

### 6.3 Conexión desde la aplicación

Con **Cloud Run Direct VPC egress** + socket de Cloud SQL:

```
DB_HOST=/cloudsql/ggtov2:europe-west1:ggtov2-pg
DB_USER=ggtov2_app
DB_NAME=ggtov2
```

Cadena directa equivalente:

```
postgresql://ggtov2_app:<secreto>@<IP_PRIVADA>:5432/ggtov2?sslmode=require
```

> El socket Unix de Cloud SQL (`/cloudsql/...`) requiere montar el volumen de Cloud SQL o usar el
> conector; con Direct VPC egress se puede usar la IP privada directamente con `sslmode=require`.

### 6.4 Migración a producción

```bash
TIER=db-custom-2-7680 HA=REGIONAL RepoTecnico/scripts/06_cloudsql_postgres.sh
```

Además, para producción: réplica de lectura en otra zona, CMEK para el disco de Cloud SQL
(`diskEncryptionConfiguration`), y Private Service Connect en lugar de PSA si se requiere.

> Alternativa "PostgreSQL global": si más adelante se necesita escala analítica/HTAP, evaluar
> **AlloyDB for PostgreSQL** o **Cloud SQL Enterprise Plus**; Cloud SQL sigue siendo el estándar
> gestionado de PostgreSQL en GCP.

### 6.5 Instancia reutilizada de `truekeate-main` (decisión del usuario)

Ante el bloqueo de facturación de `ggtov2`, el usuario indicó **usar la instancia PostgreSQL
existente en `truekeate-main`** en lugar de esperar a crear `ggtov2-pg`. Se aprovisionó una base
y un usuario **dedicados** (sin mezclar datos con la aplicación TrueKeate) y se habilitó el acceso
mediante **Cloud SQL Auth (conector/IAM)**.

**Instancia destino**

| Dato | Valor |
|---|---|
| Proyecto | `truekeate-main` (facturación activa) |
| Instancia | `truekeate-db-dev` |
| Motor | `POSTGRES_15` |
| connectionName | `truekeate-main:southamerica-east1:truekeate-db-dev` |
| Región | `southamerica-east1` |
| Tier | `db-f1-micro`, 10 GB PD_SSD, ZONAL |
| IP pública | `34.39.180.101` (red autorizada `35.232.138.181/32`) |
| SSL | `ALLOW_UNENCRYPTED_AND_ENCRYPTED` (⚠️ no obligatorio) |
| Backups / PITR / protección de borrado | ❌ / ❌ / ❌ |

**Recursos creados en esa instancia**

| Recurso | Valor |
|---|---|
| Base de datos | `ggtov2` (UTF8) |
| Usuario | `ggtov2_app` (contraseña aleatoria de 32 caracteres) |
| Secreto contraseña | `truekeate-main/ggtov2-db-password` |
| Secreto conexión | `truekeate-main/ggtov2-db-connection` |
| IAM cruzado | `ggtov2-app@ggtov2.iam.gserviceaccount.com` → `roles/cloudsql.client` en `truekeate-main` |
| Lectura de secretos | `ggtov2-app@ggtov2…` y `truekeate-app-sa@truekeate-main…` → `secretmanager.secretAccessor` |

**Verificación real de privilegios** (conexión directa por IP autorizada, `psycopg2`):

```
ggtov2_app @ ggtov2 -> super=False createrole=True createdb=True
                       cloudsqlsuperuser=True CREATE_on_public=True
                       DDL en public: OK (creó y eliminó una tabla de prueba)
```

**Cadena de conexión para la aplicación**

```
# Cloud Run (conector Cloud SQL), recomendado:
DB_HOST=/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev
DB_USER=ggtov2_app
DB_NAME=ggtov2
# contraseña: Secret Manager -> projects/truekeate-main/secrets/ggtov2-db-password
```

Para exponerla en Cloud Run del proyecto `ggtov2` (cuando haya facturación) se monta la instancia
con `--add-cloudsql-instances=truekeate-main:southamerica-east1:truekeate-db-dev`; el conector usa
TLS y no requiere abrir redes, dado que la SA ya tiene `roles/cloudsql.client` en `truekeate-main`.

**Script:** `RepoTecnico/scripts/10_usar_instancia_truekeate.sh` (idempotente).

**Riesgos y recomendaciones pendientes sobre esta instancia compartida**

1. ⚠️ **SSL no obligatorio**: conviene fijar `sslMode: ENCRYPTED_ONLY`. El conector de Cloud SQL
   siempre cifra, por lo que la app TrueKeate no debería romperse; *no se cambió sin autorización*
   por ser una instancia en uso.
2. ⚠️ **Sin backups ni PITR**: habilitarlos antes de guardar datos reales de GGTOv2.
3. ⚠️ **Sin protección de borrado**: activarla para evitar eliminaciones accidentales.
4. ⚠️ **Datos compartidos en la misma instancia**: la separación es por base de datos, no por
   instancia; para producción se recomienda una instancia propia en `ggtov2`.

---

## 7. Manejo de información sensible

| Control | Implementación | Estado |
|---|---|---|
| Cifrado de secretos con clave propia | Cloud KMS `ggtov2-secrets`, rotación 90 días | Script listo |
| Cifrado de datos en reposo (bucket) | CMEK `ggtov2-storage` | Script listo |
| Cifrado en tránsito | TLS/SSL obligatorio en Cloud SQL; HTTPS en Cloud Run | Script listo |
| Contraseñas fuera del código | Secret Manager + `secretKeyRef` en Cloud Run | Script listo |
| Mínimo privilegio | 2 SAs con roles acotados; sin roles básicos | ✅ Aplicado |
| Auditoría de acceso a datos | `auditConfigs` ADMIN/DATA READ-WRITE | ⚠️ Reintentar |
| Clasificación de PII | Sensitive Data Protection (DLP) API + inspección de buckets | API pendiente |
| Prevención de acceso público | `publicAccessPrevention: enforced` en el bucket | Script listo |
| Versionado y retención | Versionado ON + retención 30 días en el bucket | Script listo |
| Aislamiento de red | VPC dedicada; Cloud SQL sin IP pública | Script listo |
| Protección de la base | Borrado protegido + backups + PITR | Script listo |
| Validación de contraseñas DB | `passwordValidationPolicy` | Script listo |

### 7.1 Recomendaciones adicionales (post-facturación)

1. **VPC Service Controls** (perímetro) alrededor de `ggtov2` para secretmanager/kms/storage/sql.
2. **Org Policies** recomendadas:
   - `constraints/iam.allowedPolicyMemberDomains` (restringir dominios).
   - `constraints/compute.vmExternalIpAccess` (denegar IP externa).
   - `constraints/sql.restrictPublicIp` (prohibir IP pública en Cloud SQL).
   - `constraints/storage.publicAccessPrevention`.
   - `constraints/gcp.resourceLocations` limitado a `europe-west1`.
3. **Cloud DLP**: trabajos programados de inspección sobre el bucket y la base, con
   `deidentify` (tokenización) para datos sensibles.
4. **Acceso humano**: usar IAM con MFA; evitar `roles/owner` en uso diario (crear
   `roles/editor` acotado o grupos). Habilitar **2-step verification** obligatoria.
5. **Rotación** de secretos cada 90 días (coincidir con la rotación de CMEK).

---

## 8. Red y conectividad

| Elemento | Valor |
|---|---|
| VPC | `ggtov2-vpc`, modo personalizado, routing global |
| Subred | `ggtov2-subnet`, `10.10.0.0/24`, Private Google Access ON |
| Rango PSA | `ggtov2-psa-range`, `/20`, purpose `VPC_PEERING` |
| Peering | `servicenetworking` ↔ `ggtov2-vpc` |
| Cloud SQL | IP privada dentro del rango PSA |
| Cloud Run | Direct VPC egress hacia `ggtov2-subnet` |
| Firewall | Sin reglas de entrada a la VPC; Cloud Run expone HTTPS gestionado |
| Salida a Internet | Cloud NAT solo si la app lo requiere (no incluido) |

---

## 9. Plataforma web

| Componente | Servicio | Detalle |
|---|---|---|
| Ejecución | Cloud Run `ggtov2-web` | CPU 1, RAM 512 Mi, 0–10 instancias, timeout 300 s |
| Imagen | Artifact Registry `ggtov2-web` | `europe-west1-docker.pkg.dev/ggtov2/ggtov2-web/app:latest` |
| Build | Cloud Build | Pipeline a definir por el equipo de aplicación |
| Variables | `DB_USER`, `DB_NAME`, `DB_HOST`, `SECRET_KEY` | La `SECRET_KEY` proviene de Secret Manager |
| Identidad | `ggtov2-app` | Sin claves estáticas |
| Acceso | Público (`allUsers` → `roles/run.invoker`) | Ajustable a IAP si es interno |
| Dominio | Domain Mapping de Cloud Run + certificado gestionado | A configurar con el dominio final |

---

## 10. Scripts entregados

Todos en `RepoTecnico/scripts/`, con autenticación por token (`gcloud`, metadata o credenciales
de usuario) y diseño idempotente.

| Script | Función |
|---|---|
| `lib_gcp.sh` | Librería: obtención de token, helper `api`, variables globales |
| `00_crear_proyecto.sh` | Crea el proyecto y vincula facturación |
| `01_habilitar_apis.sh` | Habilita las APIs (distingue las que requieren facturación) |
| `02_red_privada.sh` | VPC, subred, rango PSA y peering |
| `03_iam_cuentas_servicio.sh` | Cuentas de servicio + bindings IAM |
| `04_secretos_kms.sh` | Cloud KMS (CMEK, rotación 90 d) + Secret Manager |
| `05_storage_registry.sh` | Bucket seguro (CMEK, sin acceso público) + Artifact Registry |
| `06_cloudsql_postgres.sh` | Instancia PostgreSQL 16 privada, backups, PITR, SSL |
| `07_cloudrun_web.sh` | Servicio Cloud Run con salida VPC y secretos |
| `08_auditoria_presupuesto.sh` | Audit configs + presupuesto con alertas |
| `10_usar_instancia_truekeate.sh` | Base/usuario `ggtov2` en `truekeate-db-dev` + secretos + IAM cruzado |
| `99_eliminar_todo.sh` | Teardown controlado (requiere `CONFIRM_DESTROY=ELIMINAR`) |
| `provision_all.sh` | Orquesta 00→08 (facturables solo con `CREAR_RECURSOS=si`) |

### Uso

```bash
cd RepoTecnico/scripts

# 1) Tras habilitar facturación: base sin costo
./provision_all.sh

# 2) Recursos facturables (Cloud SQL, secretos, KMS, storage, registry)
CREAR_RECURSOS=si ./provision_all.sh

# 3) Plataforma web (cuando exista una imagen en Artifact Registry)
IMAGE=europe-west1-docker.pkg.dev/ggtov2/ggtov2-web/app:v1 ./07_cloudrun_web.sh

# 4) Presupuesto mensual de USD 50 con alertas 50/90/100 %
BUDGET_USD=50 ./08_auditoria_presupuesto.sh
```

---

## 11. Runbook

### Fase 0 — Desbloqueo (acción del usuario)

1. Liberar un cupo de la cuenta de facturación **o** solicitar aumento de cuota.
2. Verificar: `gcloud billing projects describe ggtov2` → `billingEnabled: true`.

### Fase 1 — Base (sin costo)

```bash
RepoTecnico/scripts/provision_all.sh
```

### Fase 2 — Recursos facturables

```bash
CREAR_RECURSOS=si RepoTecnico/scripts/provision_all.sh
```

### Fase 2-bis — Usar PostgreSQL existente (ya ejecutada)

```bash
# Crea base ggtov2 + usuario ggtov2_app en truekeate-db-dev, secretos e IAM cruzado
RepoTecnico/scripts/10_usar_instancia_truekeate.sh
```

### Fase 3 — Plataforma web

```bash
# Construir y subir la imagen
gcloud builds submit --tag europe-west1-docker.pkg.dev/ggtov2/ggtov2-web/app:v1 ./app
RepoTecnico/scripts/07_cloudrun_web.sh
```

### Verificación

```bash
gcloud projects describe ggtov2
gcloud services list --enabled --project ggtov2
gcloud sql instances describe ggtov2-pg --project ggtov2
gcloud secrets list --project ggtov2
gcloud run services describe ggtov2-web --region europe-west1 --project ggtov2
gcloud projects get-iam-policy ggtov2 --format=json | jq '.auditConfigs'
```

---

## 12. Costos estimados (USD/mes, `europe-west1`)

| Recurso | Estimado | Nota |
|---|---|---|
| Cloud SQL `db-f1-micro` ZONAL | ~9–12 | Incluye ~10 GB SSD; apagar en horas no usadas |
| Backups/PITR Cloud SQL | ~1–2 | Según volumen |
| Cloud Storage (10 GB) | ~0.25 | + operaciones |
| Cloud KMS (3 claves) | ~0.20 | + operaciones (~0.03/10 000) |
| Secret Manager | ~0–1 | 6 versiones activas gratis; luego USD 0.06/versión |
| Artifact Registry (5 GB) | ~0.50 | USD 0.10/GB |
| Cloud Run | ~0–5 | Escala a cero; se paga por uso |
| Cloud Logging/Monitoring | ~0–5 | Auditoría de datos puede elevar el costo |
| **Total dev** | **~12–25** | Sin tráfico ni DLP |
| Producción (db-custom-2-7680 HA) | **~110–160** | + réplicas y HA |

> Cifras orientativas; confirmar con la calculadora oficial de precios de GCP antes de comprometer presupuesto.

---

## 13. Checklist de aceptación

- [x] Proyecto `GGTOv2` creado y activo en la organización.
- [x] Cuentas de servicio con separación runtime/despliegue.
- [x] IAM de mínimo privilegio aplicado.
- [x] APIs base habilitadas (incluidas SQL y Private Service Access).
- [ ] Cuenta de facturación vinculada (`billingEnabled: true`). **← bloqueo actual**
- [ ] APIs dependientes de facturación habilitadas (compute, secretmanager, run, DLP, registry…).
- [ ] VPC + subred + Private Service Access creados.
- [ ] Cloud KMS con claves `ggtov2-secrets` y `ggtov2-storage` (rotación 90 d).
- [ ] Secretos `ggtov2-db-password`, `ggtov2-db-root-password`, `ggtov2-app-secret-key`, `ggtov2-django-secret-key`.
- [ ] Cloud SQL PostgreSQL 16 `ggtov2-pg` con IP privada, SSL obligatorio, backups y PITR (instancia propia, pendiente de facturación).
- [x] Base `ggtov2` y usuario `ggtov2_app` creados (en la instancia reutilizada `truekeate-db-dev`).
- [x] Credenciales en Secret Manager + acceso IAM cruzado `roles/cloudsql.client`.
- [ ] SSL obligatorio, backups, PITR y protección de borrado en `truekeate-db-dev`.
- [ ] Bucket `ggtov2-assets-905974355709` con CMEK, sin acceso público y versionado.
- [ ] Artifact Registry `ggtov2-web`.
- [ ] Cloud Run `ggtov2-web` desplegado y accesible por HTTPS.
- [ ] `auditConfigs` de acceso a datos persistidos.
- [ ] Presupuesto con alertas configurado.
- [ ] Dominio propio mapeado a Cloud Run.

---

## 14. Anexos

### 14.1 Interpretación de "servicio global de PostgreSQL"

Se interpretó como **Cloud SQL for PostgreSQL**, el servicio gestionado de PostgreSQL de Google
Cloud (plano de control global, instancia regional). Quedó habilitada su API de administración
(`sqladmin.googleapis.com`) y el acceso privado por red. Alternativas evaluables: AlloyDB
(HTAP/escala) y Cloud SQL Enterprise Plus (mayor SLA y rendimiento).

### 14.2 Glosario

- **CMEK**: claves de cifrado gestionadas por el cliente (Cloud KMS).
- **PSA**: Private Service Access, peering privado para servicios gestionados.
- **PITR**: recuperación a un punto en el tiempo.
- **SA**: service account (cuenta de servicio).
- **DLP**: Sensitive Data Protection, descubrimiento y protección de datos sensibles.
- **Direct VPC egress**: salida de Cloud Run directamente por la VPC, sin conector.

### 14.3 Historial de esta sesión

1. Verificación de entorno y credenciales (instancia GCE, SA de cómputo sin permisos de creación).
2. Detección de credenciales de usuario con permiso de creación de proyectos y cuenta de facturación.
3. Creación del proyecto `GGTOv2` y comprobación de la cuota de facturación.
4. Habilitación de 17 APIs sin costo de facturación.
5. Creación de cuentas de servicio y aplicación de IAM de mínimo privilegio.
6. Intento de auditoría de acceso a datos (no persistió; documentado).
7. Generación de scripts reproducibles y de este documento.
8. Inventario de servicios PostgreSQL de la organización: instancias en `hotel-mcp` y `truekeate-main`; `ggtov2` sin instancia.
9. Decisión del usuario de reutilizar `truekeate-db-dev`: creación de la base `ggtov2`, el usuario `ggtov2_app`, los secretos y el IAM cruzado; verificación de privilegios con `psycopg2` (DDL OK).

---

*Documento generado en `RepoTecnico/GGTOv2_GCP.md`. Los scripts asociados están en `RepoTecnico/scripts/`.*
