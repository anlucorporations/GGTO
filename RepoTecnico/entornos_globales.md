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
INGESTA_CSV_ENCODING=utf-8
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

## 5. Stack tecnológico (propuesto — a confirmar)

| Capa | Propuesta | Alternativas |
|---|---|---|
| Backend | Python (FastAPI) o Node.js (NestJS) | Django REST |
| Frontend web | React + librería de gráficos | Vue, Svelte |
| App móvil | APK Android híbrido (Flutter / React Native) con SQLite | Kotlin nativo |
| Base de datos | PostgreSQL (Cloud SQL) | — |
| Reportes PDF | WeasyPrint / wkhtmltopdf / Puppeteer | — |
| Mensajería | Telegram Bot + correo (SendGrid/Gmail SMTP) | WhatsApp Business API (v3) |
| IA | Servidor **MCP** expuesto por web | — |
| Despliegue | Cloud Run `ggtov2-web` + Cloud SQL | GCE / App Engine |

---

## 6. Repositorios remotos

| Remoto | URL | Rama de trabajo |
|---|---|---|
| GitHub | `https://github.com/anlucorporations/GGTO.git` | `GGTOv2-DSH-GCP` |
| GitLab | `https://gitlab.com/anlucorporations/ggto.git` | `GGTOv2-DSH-GCP` |

- La rama `GGTOv2-DSH-GCP` debe quedar **limpia** (sin contenido previo) para iniciar el proyecto.
- Convención de remotos: `origin` → GitHub, `gitlab` → GitLab.
- **No se hace push sin orden explícita del usuario** (comando `/push`).

---

## 7. Pendientes de entorno

1. **Repositorios remotos**: ✅ URLs y rama definidas (§6). Pendiente `git init` + push bajo orden `/push`.
2. **`.env.ggto`**: crear el archivo de entorno del proyecto (separado de `.env.global` de MCC).
3. **Cliente PostgreSQL** (`psql`) y/o dependencia `psycopg2`/`asyncpg` para pruebas.
4. **Fase de facturación GCP**: liberar cupo o solicitar aumento de cuota para habilitar
   `compute`, `run`, `secretmanager`, `cloudkms`, `storage`, `artifactregistry` y Cloud SQL propio.
5. **Credenciales de mensajería**: token del **bot de Telegram** (v1), servicio de **correo**
   (SendGrid free tier / Gmail app password) y clave del **MCP**.
6. **Habilitar backups/PITR/protección de borrado** en `truekeate-db-dev` antes de datos reales.
