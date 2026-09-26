# Entornos Globales — Plataforma GGTO

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** — Gestión de averías y puntos ópticos (CANTV, Central Francisco Salias / Área 4) |
| Workspace | `/home/dsh/workspace/CANTV_PDE` |
| Carpeta técnica | `/home/dsh/workspace/CANTV_PDE/RepoTecnico` |
| Infraestructura GCP | Proyecto **GGTOv2** (`ggtov2`) — detalle en `GGTOv2_GCP.md` |
| Fase | Fase 1 — Concepto |
| Estado | Borrador v0.1 |

> Este archivo registra **configuración, rutas, variables de entorno y comandos** importantes.
> Nunca se escriben secretos: solo se referencian por nombre en Secret Manager.

---

## 1. Entorno de desarrollo (máquina actual)

| Elemento | Valor |
|---|---|
| Host | Instancia GCE del workspace (`/home/dsh/workspace`) |
| Sistema | Linux |
| Usuario de trabajo | `dsh` |
| Herramientas disponibles | `python3` · `node` · `npm` · `gcloud` (snap) · `git` |
| Herramientas **no** disponibles | `docker` · `psql` (cliente PostgreSQL) |

### 1.1 Entorno global del workspace (reutilizable)

- Cargador global: `source /home/dsh/workspace/gcp-env.sh`
- Variables globales sin secretos: `/home/dsh/workspace/.env.global`
- Diagnóstico (solo nombres, nunca valores): `bash /home/dsh/workspace/gcp-env.sh`
- Proxy Cloud SQL: `/home/dsh/tools/cloud-sql-proxy` (logs en `/home/dsh/tools/cloudsql/proxy.log`)

Variables relevantes de `.env.global` (entorno **MCC**, distinto de GGTOv2):

| Variable | Valor |
|---|---|
| `GCP_PROJECT_ID` | `mcc-ecommerce` |
| `GCP_REGION` | `us-central1` |
| `GCP_REGION_RUN` | `europe-west1` |
| `MCC_POSTGRES_URL` | `https://mcc-postgres-slzlptbcla-ew.a.run.app` |
| `MCC_PGADMIN_URL` | `https://mcc-pgadmin-slzlptbcla-ew.a.run.app` |
| `MCC_ANVIL_RPC_URL` | `https://mcc-foundry-anvil-1095249147821.europe-west1.run.app` |

> ⚠️ El `.env.global` apunta al proyecto **`mcc-ecommerce`** (TrueKeate/MCC). Para GGTO se
> trabajará contra **`ggtov2`** y la instancia PostgreSQL reutilizada `truekeate-db-dev`.
> Conviene crear un `.env.ggto` propio del proyecto (pendiente de confirmar, ver §6).

---

## 2. Infraestructura GCP del proyecto (GGTOv2)

| Recurso | Identificador |
|---|---|
| Proyecto | `ggtov2` (projectNumber `905974355709`) |
| Organización | `organizations/253767381125` |
| Cuenta de facturación | `billingAccounts/013B00-B9A67C-014A43` — ⚠️ **cupo agotado (5 proyectos)** |
| Región | `europe-west1` |
| VPC / subred | `ggtov2-vpc` / `ggtov2-subnet` (10.10.0.0/24) |
| SA runtime | `ggtov2-app@ggtov2.iam.gserviceaccount.com` |
| SA despliegue | `ggtov2-deploy@ggtov2.iam.gserviceaccount.com` |
| Servicio web | Cloud Run `ggtov2-web` |
| Repositorio de imágenes | `europe-west1-docker.pkg.dev/ggtov2/ggtov2-web` |
| Bucket de activos | `ggtov2-assets-905974355709` |
| Cloud SQL planificado | `ggtov2-pg` (PostgreSQL 16) — *no creado por bloqueo de facturación* |

### 2.1 Base de datos PostgreSQL operativa (instancia reutilizada)

| Dato | Valor |
|---|---|
| Instancia | `truekeate-main:southamerica-east1:truekeate-db-dev` (POSTGRES_15) |
| Base de datos | `ggtov2` |
| Usuario | `ggtov2_app` |
| Contraseña | Secret Manager: `projects/truekeate-main/secrets/ggtov2-db-password` |
| Conexión (Secret) | `projects/truekeate-main/secrets/ggtov2-db-connection` |
| IP pública | `34.39.180.101` (red autorizada `35.232.138.181/32`) |
| IAM cruzado | `ggtov2-app@ggtov2…` → `roles/cloudsql.client` en `truekeate-main` |
| Acceso local | Cloud SQL Auth Proxy en `127.0.0.1:5433` |

⚠️ Riesgos pendientes sobre la instancia compartida (ver `GGTOv2_GCP.md` §6.5):
SSL no obligatorio, sin backups/PITR, sin protección de borrado, datos compartidos por base.

### 2.1.1 Roles y privilegios de base de datos (endurecidos — H-33 / QW-6)

Estado aplicado el 2026-09-25 sobre `ggtov2_app`:

| Cambio | Estado | Evidencia |
|---|---|---|
| `CREATEROLE` revocado | ✅ | `rolcreaterole = false` |
| `CREATEDB` revocado | ✅ | `rolcreatedb = false` |
| `NOINHERIT` aplicado (neutraliza `cloudsqlsuperuser`) | ✅ | `rolinherit = false` |
| Membresía `cloudsqlsuperuser` revocada | ⚠️ **No posible vía SQL** | Cloud SQL no otorga `ADMIN OPTION` a ningún miembro; la pertenencia persiste pero **no se hereda** |
| `CONNECT/TEMPORARY/CREATE` de `PUBLIC` revocados en `truekeate`, `postgres`, `template1` | ✅ | `ggtov2_app → truekeate`: `permission denied for database` |
| `CONNECT` re-otorgado a `app` y `postgres` en esas bases | ✅ | TrueKeate sigue operando (39 tablas) |
| `CONNECT` + `CREATE` en la base `ggtov2` y en el esquema `public` | ✅ | DDL de prueba OK |
| `truekeate-app-sa` sin acceso a los secretos de GGTO | ✅ | solo `ggtov2-app@ggtov2` en el IAM de ambos secretos |

**Riesgo residual:** al ser miembro de `cloudsqlsuperuser`, `ggtov2_app` podría recuperar privilegios con un `SET ROLE cloudsqlsuperuser` explícito. La corrección definitiva requiere **recrear el rol** (no es posible con los privilegios actuales: `DROP ROLE` exige ser miembro o superusuario, y `postgres` no es `rolsuper`). Decisión adoptada: **aceptar el residual con `NOINHERIT`** y documentarlo (§8).

**Incidente de exposición — RESUELTO:** durante la verificación, un mensaje de error de Node imprimió la contraseña del usuario `app` (TrueKeate) contenida en el secreto `DATABASE_URL`. Se **rotó la contraseña**:

1. `ALTER ROLE app PASSWORD '<nueva>'` (32 caracteres aleatorios).
2. Nueva versión del secreto `DATABASE_URL` (`versions/3`) en `truekeate-main`.
3. Nueva revisión de Cloud Run `truekeate-api-00034-hvk` para tomar el valor `latest` → `Ready`, 100 % del tráfico, sin errores de autenticación en logs.

> `truekeate-web` no consume `DATABASE_URL`, por lo que no requirió revisión nueva.

### 2.2 Scripts de aprovisionamiento

Todos en `RepoTecnico/scripts/` (idempotentes, autenticación por token `gcloud`):

| Script | Función |
|---|---|
| `provision_all.sh` | Orquesta 00→08 (`CREAR_RECURSOS=si` para recursos facturables). |
| `00_crear_proyecto.sh` | Crea proyecto y vincula facturación. |
| `01_habilitar_apis.sh` | Habilita APIs. |
| `02_red_privada.sh` | VPC, subred, PSA. |
| `03_iam_cuentas_servicio.sh` | Cuentas de servicio + IAM. |
| `04_secretos_kms.sh` | Cloud KMS + Secret Manager. |
| `05_storage_registry.sh` | Bucket seguro + Artifact Registry. |
| `06_cloudsql_postgres.sh` | Cloud SQL PostgreSQL 16. |
| `07_cloudrun_web.sh` | Servicio Cloud Run. |
| `08_auditoria_presupuesto.sh` | Auditoría + presupuesto. |
| `10_usar_instancia_truekeate.sh` | Base/usuario `ggtov2` en `truekeate-db-dev`. |
| `99_eliminar_todo.sh` | Teardown (requiere `CONFIRM_DESTROY=ELIMINAR`). |

---

## 3. Variables de entorno previstas para la aplicación

```dotenv
# --- Aplicación ---
APP_ENV=development                      # development | staging | production
APP_NAME=GGTO
APP_TIMEZONE=America/Caracas
SECRET_KEY=<Secret Manager: ggtov2-app-secret-key>

# --- Base de datos (Cloud Run: socket; local: proxy) ---
DB_HOST=/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev
DB_PORT=5432
DB_NAME=ggtov2
DB_USER=ggtov2_app
DB_PASSWORD=<Secret Manager: ggtov2-db-password>
DB_SSLMODE=require

# --- Ingesta ---
INGESTA_CSV_DELIMITER=;
# El archivo real detalle_averias_gpon_*.csv es ISO-8859-1 (latin-1/cp1252),
# NO UTF-8. Verificado con `file` y decodificación estricta (falla en 0xd1).
# La ingesta debe decodificar latin-1 -> UTF-8 en la frontera y fallar ruidosamente
# ante bytes inválidos (nunca errors='ignore').
INGESTA_CSV_ENCODING=iso-8859-1
INGESTA_CSV_ENCODING_DESTINO=utf-8
INGESTA_CSV_FECHA_FORMATO=%d/%m/%Y %I:%M:%S %p
INGESTA_CSV_TIMEZONE=America/Caracas
INGESTA_CSV_MAPEO=por_posicion
INGESTA_CENTRAL_CODIGO=2324X
INGESTA_CENTRAL_NOMBRE=FRANCISCO SALIAS
INGESTA_ESTADO_OPERATIVO=MIRANDA-2
INGESTA_AREA=AREA 4

# --- Despacho ---
DESPACHO_HORA_REPORTE=16:00
DESPACHO_MIN_REFERIDOS=2
DESPACHO_MIN_EMPRESAS=1
DESPACHO_FRASES_EXCLUIR=LOSS ROJO;FALLA FIBRA;Fibra Dañada

# --- Mensajería (v1: Telegram + correo; WhatsApp se difiere a v3) ---
TELEGRAM_BOT_TOKEN=<Secret Manager>
TELEGRAM_CHAT_ID_CENTRAL=
SMTP_HOST=smtp.sendgrid.net            # alternativa: smtp.gmail.com
SMTP_PORT=587
SMTP_USER=apikey                       # alternativa Gmail: txbarlovento@gmail.com
SMTP_PASSWORD=<Secret Manager>
MAIL_FROM=txbarlovento@gmail.com
# WHATSAPP_API_URL=                    # reservado para la 3.ª versión

# --- MCP / IA ---
MCP_SERVER_URL=
MCP_API_KEY=<Secret Manager>

# --- Almacenamiento de evidencias ---
STORAGE_BUCKET=ggtov2-assets-905974355709
```

---

## 4. Comandos importantes

```bash
# --- Entorno global ---
source /home/dsh/workspace/gcp-env.sh          # carga variables + secretos MCC
bash /home/dsh/workspace/gcp-env.sh            # diagnóstico (solo nombres)

# --- GCP / GGTOv2 ---
gcloud config set project ggtov2
gcloud projects describe ggtov2
gcloud services list --enabled --project ggtov2
gcloud secrets list --project ggtov2

# --- PostgreSQL (proxy local) ---
nohup /home/dsh/tools/cloud-sql-proxy \
  --project truekeate-main --address 127.0.0.1 --port 5433 \
  truekeate-main:southamerica-east1:truekeate-db-dev &
# (requiere cliente psql, actualmente NO instalado)

# --- Ingesta de muestra (referencia) ---
head -1 "RepoTecnico/detalle_averias_gpon 12_09_2026.csv" | awk -F';' '{print NF}'   # → 80
```

---

## 5. Stack tecnológico (definido — D-38)

| Capa | Tecnología |
|---|---|
| Backend | **Python + FastAPI** (API REST, Pydantic, SQLAlchemy 2.x, `asyncpg`) |
| Migraciones | **Alembic** (baseline = `db/schema.sql`; versiones en `db/migrations/`) |
| Frontend web | **React** (Vite) + librería de gráficos (Recharts) |
| App móvil | **Flutter + SQLite** (offline-first, sincronización asíncrona) |
| Base de datos | **PostgreSQL** (Cloud SQL), `pgcrypto` + `pg_trgm`, RLS multi-central |
| Reportes PDF | WeasyPrint (plantillas HTML/CSS tamaño carta) |
| Mensajería | **Telegram Bot** + correo (SendGrid free tier / Gmail SMTP) |
| IA | Servidor **MCP** expuesto por web |
| CI/CD | **GitHub Actions** (espejo en GitLab CI): tests, Ruff/mypy, cobertura, build de imagen |
| Contenedores | Imagen Docker → Artifact Registry → Cloud Run `ggtov2-web` |
| Testing | `pytest` + `httpx` (API), Vitest/Playwright (web), `flutter_test` (APK) |

---

## 6. Repositorios remotos

| Remoto | URL | Rama de trabajo |
|---|---|---|
| GitHub | `https://github.com/anlucorporations/GGTO.git` | `GGTOv2-DSH-GCP` |
| GitLab | `https://gitlab.com/anlucorporations/ggto.git` | `GGTOv2-DSH-GCP` |

- La rama `GGTOv2-DSH-GCP` debe quedar **limpia** (sin contenido previo) para iniciar el proyecto.
- Convención de remotos: `origin` → GitHub, `gitlab` → GitLab.
- **No se hace push sin orden explícita del usuario** (comando `/push`).

### 6.1 Contrato de interfaz del archivo diario

La entrega del CSV `detalle_averias_gpon_<fecha>.csv` por parte del sistema origen CANTV se rige por
[`interfaz_csv_origen.md`](interfaz_csv_origen.md) (D-41): nombre, periodicidad, canal, codificación
ISO-8859-1, 80 columnas por posición, validaciones, manejo de errores y confidencialidad de la PII.

---

## 7. Pendientes de entorno

1. **Repositorios remotos**: ✅ publicados en GitHub y GitLab (§6).
2. **`.env.ggto`**: crear el archivo de entorno del proyecto (separado de `.env.global` de MCC).
3. **Cliente PostgreSQL** (`psql`) y/o dependencia `psycopg2`/`asyncpg` para pruebas.
4. **Fase de facturación GCP**: liberar cupo o solicitar aumento de cuota para habilitar
   `compute`, `run`, `secretmanager`, `cloudkms`, `storage`, `artifactregistry` y Cloud SQL propio.
5. **Credenciales de mensajería**: token del **bot de Telegram** (v1), servicio de **correo**
   (SendGrid free tier / Gmail app password) y clave del **MCP**.
6. **Habilitar backups/PITR/protección de borrado** en `truekeate-db-dev` antes de datos reales.

---

## 8. Estado de despliegue

### 8.1 Base de datos — ✅ DESPLEGADA (2026-09-26)

`RepoTecnico/db/schema.sql` se aplicó sobre el PostgreSQL disponible en GCP.

| Dato | Valor |
|---|---|
| Instancia | `truekeate-main:southamerica-east1:truekeate-db-dev` (PostgreSQL 15.18) |
| Base | `ggtov2` |
| Usuario | `ggtov2_app` |
| Conexión usada | IP pública `34.39.180.101:5432` con SSL (red autorizada `35.232.138.181/32`) |
| Script | `RepoTecnico/db/schema.sql` (38 821 bytes) aplicado en una transacción, sin errores |

**Verificación posterior a la aplicación:**

| Comprobación | Resultado |
|---|---|
| Tablas en `public` | **35** |
| Extensiones | `pgcrypto 1.3`, `pg_trgm 1.6` |
| RLS | `caso` y `despacho` con `relrowsecurity=true` y `relforcerowsecurity=true`; **2 políticas** |
| Triggers `actualizado_en` | **14** |
| Índices trigram | **2** (`caso.direccion`, `sector_direccion.patron`) |
| Semillas | 3 roles · 1 central (`2324X` FRANCISCO SALIAS) · 1 cuadrilla (`C-00`) · 9 métodos · 13 parámetros · 0 causas |
| Función `generar_id_averia_ref` | ✅ devolvió `REF-2324X-000001` (secuencia reiniciada a 1) |

### 8.2 Aplicación web — ✅ DESPLEGADA (esqueleto, 2026-09-26)

Al no haber facturación en `ggtov2`, el servicio se alojó temporalmente en **`truekeate-main`**
(que sí tiene facturación), apuntando a la base **`ggtov2`** de la instancia compartida.

| Dato | Valor |
|---|---|
| Servicio | **Cloud Run `ggto-web`** en `truekeate-main`, región `europe-west1` |
| URL | **https://ggto-web-593453426217.europe-west1.run.app** (API + web) |
| Revisión | `ggto-web-00005-rxm` (100 % del tráfico) — Ciclo 4 |
| Imagen | `southamerica-east1-docker.pkg.dev/truekeate-main/truekeate-repo/ggto-web:v5` (multi-etapa: Node compila la SPA, Python la sirve) |
| SA de ejecución | `ggto-web-sa@truekeate-main.iam.gserviceaccount.com` (roles `cloudsql.client` + `secretmanager.secretAccessor` sobre `ggtov2-db-password` y `ggto-secret-key`) |
| Cloud SQL montado | `truekeate-main:southamerica-east1:truekeate-db-dev` |
| Código | `app/` (FastAPI + SQLAlchemy + Argon2id + JWT) · `app/web/` (React + Vite + TypeScript) |
| Acceso | Público (`allUsers`) — **smoke test; endurecer antes de producción** |

**Endpoints verificados en producción:**

| Endpoint | Respuesta |
|---|---|
| `GET /` | **SPA React** (`index.html` + `/assets/*`); deep links servidos por `SPAStaticFiles` |
| `GET /api/v1/info` | `{"servicio":"GGTO API","version":"0.2.0","entorno":"production",...}` |
| `GET /health` | `{"status":"ok"}` (público) |
| `GET /ready` | `{"status":"ready","base":"ggtov2","postgres":"PostgreSQL 15.18","tablas":35}` (público) |
| `GET /api/v1/resumen` | 🔒 requiere token — conteos del esquema |
| `POST /api/v1/auth/setup` | Fija la clave del P00 y devuelve las **12 palabras** (una sola vez) |
| `POST /api/v1/auth/login` | `P00` + clave → JWT (8 h); bloqueo al **3.º** intento (423) |
| `GET /api/v1/auth/me` · `POST /auth/unlock` · `POST /auth/reset-password` | 🔒 sesión / recuperación con 3 palabras |
| `/api/v1/central`, `/sectores`, `/tecnicos`, `/flota`, `/cuadrillas`, `/catalogos/*`, `/configuracion` | 🔒 CRUD de CONFIGURACIÓN (escritura solo `ADMIN`/`SUPERVISOR`) |
| `POST /api/v1/ingesta/preview` · `POST /api/v1/ingesta` · `GET /api/v1/ingesta/lotes` | 🔒 Ingesta del CSV diario y su historial (escritura solo `ADMIN`/`SUPERVISOR`) |
| `GET /api/v1/casos` · `/casos/buscar` · `/casos/{id}` · `/casos/{id}/historial` | 🔒 Listado con filtros, búsqueda por avería/teléfono y bitácora |
| `POST /api/v1/casos` · `PATCH /api/v1/casos/{id}` | 🔒 Alta manual (genera `REF-…`) y edición con registro de estado |

> **Pruebas:** 79/79 en verde (Ciclos 1–4) contra el esquema aislado `ggto_test`.
> CI en `.github/workflows/ci.yml`. **Ciclo 4 verificado en vivo**: alta manual `REF-2324X-000001`,
> búsqueda por avería y teléfono, cambio de estado con bitácora y listado filtrado.

> ⚠️ **Pendiente:** mover el servicio a `ggtov2` (Cloud Run + Artifact Registry propios) cuando se
> desbloquee la facturación, y **restringir el acceso** (IAP o invocación autenticada), porque hoy
> `/api/v1/*` expone datos de la base sin autenticación.

### 8.3 Bloqueo pendiente en `ggtov2` (histórico)

| Requisito | Estado |
|---|---|
| Facturación en `ggtov2` | ❌ `billingEnabled: false` (cupo de 5 proyectos agotado) |
| APIs de despliegue en `ggtov2` | ❌ `run`, `artifactregistry`, `cloudbuild`, `secretmanager` no habilitables sin facturación |
| Cloud Run / Artifact Registry en `ggtov2` | ❌ No existen |

**Al desbloquearse:** migrar el servicio a `ggtov2` con `scripts/07_cloudrun_web.sh` y su propio
Cloud SQL `ggtov2-pg` (REGIONAL, SSL `ENCRYPTED_ONLY`, backups + PITR).

### 8.4 Conexión de la aplicación

```dotenv
DB_HOST=/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev
DB_PORT=5432
DB_NAME=ggtov2
DB_USER=ggtov2_app
DB_PASSWORD=<Secret Manager: truekeate-main/ggtov2-db-password>
DB_SSLMODE=require
```

> En Cloud Run se monta la instancia con
> `--add-cloudsql-instances=truekeate-main:southamerica-east1:truekeate-db-dev`; la SA
> `ggtov2-app@ggtov2` ya tiene `roles/cloudsql.client` en `truekeate-main`.
