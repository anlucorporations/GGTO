# Manual de Cloud Run y Cloud SQL — GGTO (CANTV, Central Francisco Salias / Área 4)

Este manual documenta el despliegue real de la plataforma **GGTO** en Google Cloud: el servicio
Cloud Run que sirve la API y la SPA, la instancia Cloud SQL que aloja la base `ggtov2`, la imagen
de contenedor, la forma en que la aplicación se conecta y los riesgos vigentes. Cada afirmación
se respalda con referencias `ruta:línea` verificadas; lo no comprobable se declara como
**pendiente de confirmar**.

## Estado real del despliegue

El despliegue definitivo no vive en el proyecto previsto `ggtov2`. La facturación de `ggtov2`
está **bloqueada** porque el cupo de cinco proyectos de la cuenta de facturación está agotado
(`RepoTecnico/entornos_globales.md:364`, `RepoTecnico/entornos_globales.md:57`). Por esa razón, el
servicio se aloja temporalmente en el proyecto **`truekeate-main`**, que sí tiene facturación
activa, apuntando a la base `ggtov2` de la instancia compartida
(`RepoTecnico/entornos_globales.md:313-314`).

| Elemento | Valor verificado | Referencia |
|---|---|---|
| Proyecto actual | `truekeate-main` | `RepoTecnico/entornos_globales.md:318` |
| Servicio | Cloud Run `ggto-web` | `RepoTecnico/entornos_globales.md:318` |
| Región | `europe-west1` | `RepoTecnico/entornos_globales.md:318` |
| URL principal | `https://ggto-web-593453426217.europe-west1.run.app` | `RepoTecnico/entornos_globales.md:319` |
| URL alternativa | `https://ggto-web-m33mjctj4a-ew.a.run.app` | `RepoTecnico/entornos_globales.md:319` |
| Acceso | Público (`allUsers` → `roles/run.invoker`) | `RepoTecnico/entornos_globales.md:325` |
| Proyecto previsto a futuro | `ggtov2` (projectNumber `905974355709`) | `RepoTecnico/entornos_globales.md:55` |

El despliegue corresponde a la decisión **D-43** del registro de decisiones: "servicio Cloud Run
`ggto-web` en `truekeate-main`/`europe-west1`, con SA propia `ggto-web-sa`, conectado a `ggtov2`
por el conector de Cloud SQL", con la advertencia explícita de que el acceso público es un *smoke
test* que debe restringirse antes de producción
(`RepoTecnico/estado_proyecto.md:107`).

### Cloud Run ggto-web en truekeate-main/europe-west1

Cloud Run ejecuta el contenedor que contiene tanto la API FastAPI como la SPA React compilada. El
punto de entrada del contenedor es
`uvicorn app.main:app --host 0.0.0.0 --port 8080` (`app/Dockerfile:29`), y la aplicación monta la
SPA al final del enrutador para no tapar la API: `SPAStaticFiles` sirve `app/web/dist` y responde
`index.html` ante rutas del cliente (`app/main.py:91-105`). Es decir, la misma URL sirve
`GET /`, los *deep links* de React Router y todo `/api/v1/*`.

La configuración de ejecución verificada en el servicio incluye:

- Cuenta de servicio de ejecución `ggto-web-sa@truekeate-main.iam.gserviceaccount.com`, con los
  roles `roles/cloudsql.client` y `roles/secretmanager.secretAccessor` sobre los secretos
  `ggtov2-db-password` y `ggto-secret-key` (`RepoTecnico/entornos_globales.md:322`).
- La instancia Cloud SQL montada
  `truekeate-main:southamerica-east1:truekeate-db-dev`
  (`RepoTecnico/entornos_globales.md:323`).
- El código desplegado es `app/` (FastAPI + SQLAlchemy + Argon2id + JWT) y `app/web/`
  (React + Vite + TypeScript) (`RepoTecnico/entornos_globales.md:324`).

### URL y revision (ggto-web-00014-zqx, imagen v14)

La última revisión documentada del servicio es la siguiente:

| Dato | Valor | Referencia |
|---|---|---|
| Revisión actual | `ggto-web-00014-zqx` | `RepoTecnico/estado_proyecto.md:124` |
| Imagen | `southamerica-east1-docker.pkg.dev/truekeate-main/truekeate-repo/ggto-web:v14` | `RepoTecnico/estado_proyecto.md:124` |
| Versión funcional | Ciclo 9 — ALERTAS, Telegram y MCP | `RepoTecnico/estado_proyecto.md:124` |
| Pruebas al cierre | 152/152 pytest | `RepoTecnico/estado_proyecto.md:124` |
| Verificación en vivo | 42 casos, 0 fallas, outbox vacío, 73 endpoints | `RepoTecnico/estado_proyecto.md:124`, `:294` |

La revisión inmediatamente anterior documentada fue `ggto-web-00013-9pf` con la imagen `v13`
(`RepoTecnico/entornos_globales.md:320-321`). Existe una secuencia completa de revisiones
históricas por ciclo: `ggto-web-00002-rbl` (v2), `00003-6zb` (v3), `00004-cj9` (v4),
`00005-rxm` (v5), `00006-htl` (v6), `00007-vsr` (v7), `00008-vr5` (v8), `00009-fvc` (v9),
`00011-ksr` (v11), `00012-lbl` (v12), `00013-9pf` (v13) y `00014-zqx` (v14)
(`RepoTecnico/estado_proyecto.md:108-124`).

> La revisión activa en el momento de redactar este manual debe confirmarse con
> `gcloud run services describe ggto-web --region=europe-west1 --project=truekeate-main`. El dato
> aquí consignado es el último documentado en el repositorio, no una lectura en vivo.

### SA de ejecucion

La cuenta de servicio de ejecución es la identidad con la que el contenedor accede a Cloud SQL y
a Secret Manager. Además de `ggto-web-sa@truekeate-main.iam.gserviceaccount.com`
(`RepoTecnico/entornos_globales.md:322`), el proyecto mantiene dos cuentas planificadas en el
diseño original de `ggtov2`:

| Cuenta | Rol previsto | Referencia |
|---|---|---|
| `ggtov2-app@ggtov2.iam.gserviceaccount.com` | SA de *runtime* del proyecto GGTOv2 | `RepoTecnico/entornos_globales.md:60` |
| `ggtov2-deploy@ggtov2.iam.gserviceaccount.com` | SA de despliegue | `RepoTecnico/entornos_globales.md:61` |
| `ggto-web-sa@truekeate-main.iam.gserviceaccount.com` | SA de ejecución real del servicio | `RepoTecnico/entornos_globales.md:322` |

`ggtov2-app@ggtov2` conserva un permiso IAM **cruzado** hacia `truekeate-main`:
`roles/cloudsql.client` (`RepoTecnico/entornos_globales.md:77`,
`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:72-88`). Ese permiso se otorgó mediante
`getIamPolicy`/`setIamPolicy` sobre `truekeate-main`, añadiendo el binding con la cuenta de GGTOv2
(`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:84`).

## Cloud SQL

### instancia truekeate-db-dev (PostgreSQL 15.18)

La base de datos operativa de GGTO es una base dedicada **dentro de una instancia compartida** con
el proyecto TrueKeate. La separación es lógica (por base de datos), no física (por instancia),
aspecto señalado como riesgo en `RepoTecnico/GGTOv2_GCP.md:392-393`.

| Dato | Valor | Referencia |
|---|---|---|
| Instancia | `truekeate-main:southamerica-east1:truekeate-db-dev` | `RepoTecnico/entornos_globales.md:71` |
| Motor | `POSTGRES_15` / versión `15.18` | `RepoTecnico/entornos_globales.md:71`, `:293` |
| Región de la instancia | `southamerica-east1` | `RepoTecnico/GGTOv2_GCP.md:344` |
| Tier y disco | `db-f1-micro`, 10 GB PD_SSD, ZONAL | `RepoTecnico/GGTOv2_GCP.md:345` |
| IP pública | `34.39.180.101` (red autorizada `35.232.138.181/32`) | `RepoTecnico/entornos_globales.md:76` |
| SSL | `ALLOW_UNENCRYPTED_AND_ENCRYPTED` (no obligatorio) | `RepoTecnico/GGTOv2_GCP.md:347` |
| Backups / PITR / protección de borrado | ❌ / ❌ / ❌ | `RepoTecnico/GGTOv2_GCP.md:348` |

El DDL completo (`RepoTecnico/db/schema.sql`, 38 821 bytes) se aplicó el 2026-09-26 en una sola
transacción y sin errores (`RepoTecnico/entornos_globales.md:297`). La verificación posterior
confirmó 35 tablas, las extensiones `pgcrypto 1.3` y `pg_trgm 1.6`, RLS en `caso` y `despacho`,
14 triggers `actualizado_en`, 2 índices trigram y las semillas previstas
(`RepoTecnico/entornos_globales.md:301-309`).

### base ggtov2 y usuario ggtov2_app

| Recurso | Valor | Referencia |
|---|---|---|
| Base de datos | `ggtov2` (charset UTF8) | `RepoTecnico/entornos_globales.md:72`, `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:60` |
| Usuario | `ggtov2_app` (contraseña aleatoria de 32 caracteres, host `%`) | `RepoTecnico/entornos_globales.md:73`, `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:68` |
| Contraseña | Secret Manager `projects/truekeate-main/secrets/ggtov2-db-password` | `RepoTecnico/entornos_globales.md:74` |
| Secreto de conexión | `projects/truekeate-main/secrets/ggtov2-db-connection` | `RepoTecnico/entornos_globales.md:75` |

La base y el usuario se crearon con `RepoTecnico/scripts/10_usar_instancia_truekeate.sh`, que es
idempotente: si la base ya existe no la recrea (`:56-62`) y si el usuario existe **no cambia la
contraseña** (`:64-70`). El script genera la contraseña con `openssl rand -base64 36`, filtra a
alfanuméricos y recorta a 32 caracteres sin imprimirla
(`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:23`), y publica una versión nueva del secreto
en cada ejecución (`:33-35`).

### socket /cloudsql/...

La aplicación reconoce el socket Unix de Cloud SQL por una convención simple: si `DB_HOST`
comienza con `/`, la URL se construye sin puerto y el host viaja como parámetro de consulta
`host=`, que es la forma que espera el conector
(`app/core/db.py:26-29`). El valor que se monta en el contenedor es:

```
DB_HOST=/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev
DB_PORT=5432
DB_NAME=ggtov2
DB_USER=ggtov2_app
DB_SSLMODE=require
```

(ver `RepoTecnico/entornos_globales.md:374-379`). En Cloud Run la instancia se monta con
`--add-cloudsql-instances=truekeate-main:southamerica-east1:truekeate-db-dev`
(`RepoTecnico/entornos_globales.md:382-384`). La ventaja del socket es que el conector usa TLS y
**no requiere abrir redes**, dado que la SA ya tiene `roles/cloudsql.client` en `truekeate-main`
(`RepoTecnico/GGTOv2_GCP.md:379-381`).

> Detalle a verificar: el script `07_cloudrun_web.sh` del repositorio **no** incluye
> `--add-cloudsql-instances` ni el `DB_HOST` del socket; su cuerpo declara
> `DB_HOST=/cloudsql/truekeate-main:southamerica-east1:ggtov2-pg`
> (`RepoTecnico/scripts/07_cloudrun_web.sh:19`), apuntando a la instancia **planificada** de
> `ggtov2` y no a la instancia compartida realmente usada. El montaje efectivo de la instancia
> compartida se realizó por fuera de ese script; el comando exacto empleado está **pendiente de
> confirmar**.

### SSL y roles endurecidos (entornos_globales.md:83-106)

El endurecimiento del rol `ggtov2_app` se aplicó el 2026-09-25 y está verificado
(`RepoTecnico/entornos_globales.md:85-98`):

| Cambio | Estado | Evidencia |
|---|---|---|
| `CREATEROLE` revocado | ✅ | `rolcreaterole = false` |
| `CREATEDB` revocado | ✅ | `rolcreatedb = false` |
| `NOINHERIT` aplicado (neutraliza `cloudsqlsuperuser`) | ✅ | `rolinherit = false` |
| Membresía `cloudsqlsuperuser` revocada | ⚠️ No posible vía SQL | Cloud SQL no otorga `ADMIN OPTION`; la pertenencia persiste pero no se hereda |
| `CONNECT/TEMPORARY/CREATE` de `PUBLIC` revocados en `truekeate`, `postgres` y `template1` | ✅ | `ggtov2_app → truekeate`: `permission denied for database` |
| `CONNECT` re-otorgado a `app` y `postgres` | ✅ | TrueKeate sigue operando (39 tablas) |
| `CONNECT` + `CREATE` en la base `ggtov2` y el esquema `public` | ✅ | DDL de prueba correcto |
| `truekeate-app-sa` sin acceso a los secretos de GGTO | ✅ | Solo `ggtov2-app@ggtov2` en el IAM de ambos secretos |

El estado original (antes del endurecimiento) estaba documentado con `createrole=True`,
`createdb=True`, `cloudsqlsuperuser=True` y `CREATE_on_public=True`
(`RepoTecnico/GGTOv2_GCP.md:364-366`), confirmando que la corrección fue efectiva.

Sobre el SSL: la instancia permanece con `sslMode: ALLOW_UNENCRYPTED_AND_ENCRYPTED`
(`RepoTecnico/GGTOv2_GCP.md:347`) porque cambiarla a `ENCRYPTED_ONLY` afecta a la aplicación
TrueKeate que la comparte; la recomendación documentada es fijar `ENCRYPTED_ONLY`, dado que el
conector de Cloud SQL siempre cifra y la app coexistente no debería romperse, pero **no se cambió
sin autorización** por tratarse de una instancia en uso
(`RepoTecnico/GGTOv2_GCP.md:387-389`).

## Imagen de contenedor

### multi-etapa Node+Python

La imagen se construye con `app/Dockerfile` y contexto de build en el directorio `app/`
(`app/Dockerfile:2`). Es una construcción de dos etapas:

| Etapa | Base | Acciones | Referencia |
|---|---|---|---|
| 1 — `web` | `node:20-slim` | `npm ci` con `web/package*.json` y `npm run build` | `app/Dockerfile:6-11` |
| 2 — *runtime* | `python:3.12-slim` | Instala `requirements.txt` y copia el código | `app/Dockerfile:13-25` |

La segunda etapa fija `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1` y `PORT=8080`
(`app/Dockerfile:15-17`), instala las dependencias sin caché (`app/Dockerfile:21-22`), copia el
código a `/srv/app` (`:24`) y superpone el resultado de la etapa Node en
`/srv/app/web/dist` (`:25`). El `CMD` final es el arranque de Uvicorn en el puerto 8080
(`app/Dockerfile:29`). El contexto de build usa `app/.dockerignore`.

Esta arquitectura multi-etapa es la que se verificó en el despliegue del Ciclo 2: "build
multi-etapa Node+Python" (`RepoTecnico/estado_proyecto.md:109`). El requisito **RNF-25** exige
precisamente "imagen Docker reproducible" y configuración solo por variables de entorno
(`RepoTecnico/requerimientos.md:204`).

### Artifact Registry truekeate-repo

Las imágenes se publican en el repositorio:

```
southamerica-east1-docker.pkg.dev/truekeate-main/truekeate-repo/ggto-web:v14
```

(`RepoTecnico/estado_proyecto.md:124`). El nombre de imagen sigue el patrón
`<región>-docker.pkg.dev/<proyecto>/<repositorio>/<servicio>:<tag>`; en el diseño original de
`ggtov2` el repositorio sería `europe-west1-docker.pkg.dev/ggtov2/ggtov2-web`
(`RepoTecnico/entornos_globales.md:63`) y el script de despliegue usa por defecto
`$REGION-docker.pkg.dev/$PROJECT_ID/ggtov2-web/app:latest`
(`RepoTecnico/scripts/07_cloudrun_web.sh:7`). El repositorio realmente empleado es
`truekeate-repo` en la región `southamerica-east1`, coherente con la ubicación de la instancia
Cloud SQL.

> El procedimiento de `docker build`/`docker push` y el proyecto Cloud Build asociado para las
> imágenes `v1`…`v14` están **pendientes de confirmar**: la máquina de desarrollo no tiene
> `docker` instalado (`RepoTecnico/entornos_globales.md:25`) y no hay un `cloudbuild.yaml` en el
> repositorio.

## Conexion de la aplicacion

### socket vs proxy local 127.0.0.1:5433

GGTO se conecta a PostgreSQL de dos maneras según el entorno, y ambas convergen en el mismo
`build_url()`:

| Entorno | `DB_HOST` | `DB_PORT` | `DB_SSLMODE` | Referencia |
|---|---|---|---|---|
| Cloud Run (producción) | `/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev` | `5432` | `require` | `RepoTecnico/entornos_globales.md:374-379` |
| Desarrollo / E2E local | `127.0.0.1` (proxy) | `5433` | `disable` | `RepoTecnico/pruebas/run_e2e.sh:17-20` |

El proxy local se levanta con:

```bash
nohup /home/dsh/tools/cloud-sql-proxy \
  --project truekeate-main --address 127.0.0.1 --port 5433 \
  truekeate-main:southamerica-east1:truekeate-db-dev &
```

(`RepoTecnico/entornos_globales.md:224-226`). El puerto `5433` evita el choque con un PostgreSQL
local en `5432`. La conectividad desde la máquina de desarrollo también admite conexión directa
por IP pública `34.39.180.101:5432` con SSL y la red autorizada `35.232.138.181/32`
(`RepoTecnico/entornos_globales.md:296`).

### app/core/db.py:26-36

La lógica de conexión es la siguiente: si el host empieza por `/` se emite la URL sin puerto y se
añade el parámetro `host=` (`app/core/db.py:26-29`); en caso contrario se construye una URL TCP
con `host:puerto` y se añade `sslmode` (`app/core/db.py:30-32`); finalmente, si `DB_SCHEMA` tiene
valor se agrega `options=-csearch_path=<esquema>,public` (`app/core/db.py:33-35`). El motor se
crea con `pool_pre_ping=True`, `pool_size=5` y `max_overflow=5` (`app/core/db.py:39`), de modo que
las conexiones muertas se detectan antes de usarse —importante en Cloud Run, donde la instancia
puede reciclarse. La sesión por petición se entrega con `get_db()` y se cierra siempre
(`app/core/db.py:43-49`).

> `DB_PASSWORD` no aparece en el bloque de variables de Cloud Run de este manual por política de
> secretos; se inyecta desde Secret Manager y su nombre (`ggtov2-db-password`) sí está
> documentado.

## Despliegue a ggto-web

El despliegue real se ejecuta con pasos equivalentes a los que describe
`RepoTecnico/scripts/07_cloudrun_web.sh`. Ese script escribe el cuerpo JSON del servicio y lo crea
o reemplaza mediante la API regional de Cloud Run
(`RepoTecnico/scripts/07_cloudrun_web.sh:10-29`), usando el ayudante `api()` de
`RepoTecnico/scripts/lib_gcp.sh:38-45`, que obtiene un token por `$GOOGLE_ACCESS_TOKEN`, `gcloud`,
credenciales de usuario o el servidor de metadatos
(`RepoTecnico/scripts/lib_gcp.sh:5-35`).

Los elementos del despliegue que el script fija son:

| Elemento | Valor | Referencia |
|---|---|---|
| Servicio | `ggtov2-web` (variable `SERVICE`) | `RepoTecnico/scripts/07_cloudrun_web.sh:6` |
| Imagen | `$IMAGE` o `$REGION-docker.pkg.dev/$PROJECT_ID/ggtov2-web/app:latest` | `RepoTecnico/scripts/07_cloudrun_web.sh:7` |
| Puerto del contenedor | `8080` | `RepoTecnico/scripts/07_cloudrun_web.sh:15` |
| Variables de entorno | `DB_USER`, `DB_NAME`, `DB_HOST`, `SECRET_KEY` | `RepoTecnico/scripts/07_cloudrun_web.sh:16-21` |
| Recursos | CPU `1`, memoria `512Mi` | `RepoTecnico/scripts/07_cloudrun_web.sh:22` |
| Escalado | mínimo `0`, máximo `10` | `RepoTecnico/scripts/07_cloudrun_web.sh:24` |
| Tiempo de espera | `300s` | `RepoTecnico/scripts/07_cloudrun_web.sh:25` |
| Acceso | `roles/run.invoker` para `allUsers` | `RepoTecnico/scripts/07_cloudrun_web.sh:31-34` |

`SECRET_KEY` no se escribe en claro: se inyecta por referencia al secreto
`ggtov2-app-secret-key` con versión `latest` (`RepoTecnico/scripts/07_cloudrun_web.sh:20`). El
nombre del secreto efectivamente usado por el servicio desplegado es `ggto-secret-key`
(`RepoTecnico/entornos_globales.md:322`).

### Pasos operativos

Los pasos siguientes reflejan el patrón del script y la configuración verificada del servicio
real. El servicio desplegado se llama **`ggto-web`** en **`truekeate-main`**; los marcadores entre
ángulos deben sustituirse por valores reales sin escribir secretos en la línea de comandos.

1. **Autenticarse y fijar el proyecto destino.**

   ```bash
   gcloud auth login
   gcloud config set project truekeate-main
   gcloud config set run/region europe-west1
   ```

   El script equivalente obtiene el token con el ayudante `gcp_token()`
   (`RepoTecnico/scripts/lib_gcp.sh:5-35`).

2. **Construir y publicar la imagen** en Artifact Registry
   (`southamerica-east1-docker.pkg.dev/truekeate-main/truekeate-repo/ggto-web:<tag>`),
   siguiendo la construcción multi-etapa de `app/Dockerfile:6-25`.

3. **Crear o actualizar el servicio** montando Cloud SQL y declarando los secretos. La forma
   canónica en `gcloud` es:

   ```bash
   gcloud run deploy ggto-web \
     --project truekeate-main \
     --region europe-west1 \
     --image southamerica-east1-docker.pkg.dev/truekeate-main/truekeate-repo/ggto-web:<tag> \
     --port 8080 \
     --cpu 1 --memory 512Mi \
     --min-instances 0 --max-instances 10 \
     --timeout 300 \
     --add-cloudsql-instances truekeate-main:southamerica-east1:truekeate-db-dev \
     --set-env-vars DB_HOST=/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev,DB_PORT=5432,DB_NAME=ggtov2,DB_USER=ggtov2_app,DB_SSLMODE=require \
     --set-secrets SECRET_KEY=ggto-secret-key:latest,DB_PASSWORD=ggtov2-db-password:latest \
     --service-account ggto-web-sa@truekeate-main.iam.gserviceaccount.com
   ```

   Las variables y recursos de este comando reproducen `RepoTecnico/scripts/07_cloudrun_web.sh:15-25`
   (puerto, CPU, memoria, escalado, tiempo de espera) y el montaje del socket documentado en
   `RepoTecnico/entornos_globales.md:371-384`. El `--add-cloudsql-instances` con la instancia
   compartida es el paso que **no** está en el script del repositorio y que debe ejecutarse de
   forma explícita (ver la observación de la sección *socket /cloudsql/...*).

4. **Permitir la invocación.** El script publica el servicio con `allUsers`
   (`RepoTecnico/scripts/07_cloudrun_web.sh:31-34`). Esto es un *smoke test* y **debe
   restringirse antes de producción** (`RepoTecnico/estado_proyecto.md:107`); la alternativa
   recomendada es IAP o invocación autenticada (`RepoTecnico/entornos_globales.md:356-358`).

5. **Verificar** la revisión, la URL y los endpoints de salud (ver la sección *Verificación*).

### Alternativa por API REST

El script del repositorio no usa `gcloud run deploy`, sino la API v2 directamente: construye el
cuerpo JSON con `python3` (`RepoTecnico/scripts/07_cloudrun_web.sh:10-27`) y hace
`POST https://run.googleapis.com/v2/projects/$PROJECT_ID/locations/$REGION/services?serviceId=$SERVICE`
(`RepoTecnico/scripts/07_cloudrun_web.sh:28-29`). El IAM se fija después con
`services/$SERVICE:setIamPolicy` (`RepoTecnico/scripts/07_cloudrun_web.sh:32-34`). Una ventaja de
esta vía es que el cuerpo JSON admite el bloque `vpcAccess` con la red `ggtov2-vpc` y la subred
`ggtov2-subnet` (`RepoTecnico/scripts/07_cloudrun_web.sh:23`), pensado para la salida VPC directa
del diseño original.

## Bloqueo de ggtov2 y plan de migracion (entornos_globales.md:360-369)

El proyecto `ggtov2` no puede alojar todavía el servicio. El estado del bloqueo es
(`RepoTecnico/entornos_globales.md:360-366`):

| Requisito | Estado |
|---|---|
| Facturación en `ggtov2` | ❌ `billingEnabled: false` (cupo de 5 proyectos agotado) |
| APIs de despliegue en `ggtov2` | ❌ `run`, `artifactregistry`, `cloudbuild` y `secretmanager` no habilitables sin facturación |
| Cloud Run / Artifact Registry en `ggtov2` | ❌ No existen |

El plan de migración, cuando se desbloquee la facturación, es
(`RepoTecnico/entornos_globales.md:368-369`):

1. Ejecutar `RepoTecnico/scripts/07_cloudrun_web.sh` para crear el servicio en `ggtov2` con su
   propia imagen en `europe-west1-docker.pkg.dev/ggtov2/ggtov2-web`
   (`RepoTecnico/entornos_globales.md:63`, `RepoTecnico/scripts/07_cloudrun_web.sh:7`).
2. Crear y migrar a un Cloud SQL propio `ggtov2-pg` (PostgreSQL 16) con `TIER` `db-custom-2-7680`,
   `HA=REGIONAL`, SSL `ENCRYPTED_ONLY`, backups y PITR
   (`RepoTecnico/entornos_globales.md:65,369`; `RepoTecnico/scripts/06_cloudsql_postgres.sh:1-66`).
3. Migrar los datos de `ggtov2` (instancia compartida) al Cloud SQL propio y reapuntar
   `DB_HOST` al nuevo socket.

La migración cierra el riesgo aceptado **D-26** y cumple **RNF-16** (backup, RPO ≤ 24 h,
RTO ≤ 4 h) y **RNF-17** (disponibilidad ≥ 99 %) (`RepoTecnico/requerimientos.md:195-196`,
`RepoTecnico/estado_proyecto.md:90`). Hay un requisito previo de negocio: **liberar cupo o
solicitar aumento de cuota** para habilitar `compute`, `run`, `secretmanager`, `cloudkms`,
`storage`, `artifactregistry` y Cloud SQL propio
(`RepoTecnico/entornos_globales.md:277-278`).

> El plan de corte (ventana, herramienta de volcado/restauración y validación de integridad) es
> **pendiente de confirmar**. La máquina de desarrollo no tiene `psql` ni `docker`
> (`RepoTecnico/entornos_globales.md:25`), por lo que la ejecución del traslado requiere
> habilitar herramientas adicionales.

## Riesgos

### D-26 sin backups/PITR

El riesgo **D-26** está registrado y aceptado formalmente: no se modifican backups, PITR ni SSL de
`truekeate-db-dev` por ser una instancia compartida de TrueKeate. El dueño es la Dirección del
proyecto, la fecha de registro es 2026-09-25 y el cierre previsto es migrar a `ggtov2-pg` con
backups, PITR y SSL al desbloquear la facturación. Incluye la instrucción explícita de **no cargar
datos reales hasta entonces** (`RepoTecnico/estado_proyecto.md:90`).

El estado técnico que sustenta el riesgo es: backups ❌, PITR ❌, protección de borrado ❌ y SSL no
obligatorio (`RepoTecnico/GGTOv2_GCP.md:347-348`). Los requisitos **RNF-16** y **RNF-17** definen
el objetivo a cumplir, y el documento de requerimientos advierte que la base provisional "**no**
cumple RNF-16/SSL" (`RepoTecnico/requerimientos.md:195-196,206`).

**Consecuencia operativa:** ante una pérdida o corrupción de la base `ggtov2`, no existe
restauración a un punto en el tiempo. Cualquier dato de producción cargado en esta instancia
queda sin respaldo.

### servicio publico con PII real (debe restringirse)

El servicio `ggto-web` es accesible por `allUsers` (`RepoTecnico/entornos_globales.md:325`) y
contiene **PII de suscriptores**: 42 casos reales cargados desde
`detalle_averias_gpon 15_09_2026.csv` por el Super Usuario
(`RepoTecnico/estado_proyecto.md:121`). La propia documentación advierte que "conviene restringir
el acceso y evaluar el traslado a una instancia con respaldo (RNF-16) antes de seguir cargando
información" (`RepoTecnico/entornos_globales.md:351-354`).

Este riesgo figura como pendiente externo de primer orden en el estado del proyecto: "Restringir
el acceso público (ya hay PII real)" (`RepoTecnico/estado_proyecto.md:13,134`). La mitigación
recomendada es IAP o invocación autenticada
(`RepoTecnico/entornos_globales.md:356-358`). Adicionalmente, `CORS_ORIGINS` por defecto es `*`
(`app/core/config.py:38`), lo que refuerza la necesidad de endurecer el acceso.

### roles de BD (NOINHERIT, riesgo residual)

El rol `ggtov2_app` conserva la membresía `cloudsqlsuperuser` porque Cloud SQL no otorga
`ADMIN OPTION` y no es posible revocarla por SQL. Con `NOINHERIT` la pertenencia **no se hereda**,
pero un `SET ROLE cloudsqlsuperuser` explícito podría recuperar privilegios. La corrección
definitiva exige **recrear el rol**, algo inviable con los privilegios actuales: `DROP ROLE` exige
ser miembro o superusuario, y el usuario `postgres` no es `rolsuper`. La decisión adoptada fue
aceptar el residual con `NOINHERIT` y documentarlo
(`RepoTecnico/entornos_globales.md:98`, `RepoTecnico/estado_proyecto.md:89`).

El estado verificado del rol es: `CREATEROLE` revocado, `CREATEDB` revocado, `NOINHERIT` aplicado
y sin acceso a las bases `truekeate`, `postgres` y `template1`
(`RepoTecnico/entornos_globales.md:87-96`).

## Verificacion

La verificación de un despliegue se apoya en tres endpoints de diagnóstico más el de metadatos.
Todos están definidos en `app/api/routes_health.py`:

| Endpoint | Tipo | Autenticación | Línea |
|---|---|---|---|
| `GET /health` | Liveness — no toca la base | Público | `app/api/routes_health.py:28-31` |
| `GET /ready` | Readiness — consulta la base | Público | `app/api/routes_health.py:34-57` |
| `GET /api/v1/info` | Metadatos del servicio | Público | `app/api/routes_health.py:17-25` |
| `GET /api/v1/resumen` | Conteos del esquema | Requiere token | `app/api/routes_health.py:60-80` |

`/health` devuelve `{"status":"ok"}` sin acceso a datos (`app/api/routes_health.py:29-31`).
`/ready` ejecuta una consulta que devuelve versión de PostgreSQL, base actual, usuario y número de
tablas de `public`; si falla, responde **503** con el tipo de excepción
(`app/api/routes_health.py:38-57`). `/api/v1/info` devuelve `servicio`, `version`, `entorno` y la
ruta de `documentacion` (`app/api/routes_health.py:19-25`). `/api/v1/resumen` cuenta tablas,
centrales, roles, cuadrillas, causas y parámetros, y también responde 503 si la base no está
disponible (`app/api/routes_health.py:60-80`).

Comandos de verificación posteriores a un despliegue:

```bash
# Revisión y URL del servicio
gcloud run services describe ggto-web \
  --project truekeate-main --region europe-west1 \
  --format='value(status.latestReadyRevisionName,status.url)'

# Salud (públicos)
curl -sf https://ggto-web-593453426217.europe-west1.run.app/health
curl -sf https://ggto-web-593453426217.europe-west1.run.app/ready
curl -sf https://ggto-web-593453426217.europe-west1.run.app/api/v1/info
```

Respuestas verificadas en producción al cierre del despliegue
(`RepoTecnico/entornos_globales.md:327-345`):

| Endpoint | Respuesta documentada |
|---|---|
| `GET /` | SPA React (`index.html` + `/assets/*`); *deep links* vía `SPAStaticFiles` |
| `GET /api/v1/info` | `{"servicio":"GGTO API","version":"0.2.0","entorno":"production",...}` |
| `GET /health` | `{"status":"ok"}` |
| `GET /ready` | `{"status":"ready","base":"ggtov2","postgres":"PostgreSQL 15.18","tablas":35}` |
| `GET /api/v1/resumen` | 🔒 requiere token |

> Discrepancia entre documentos: la respuesta de `/api/v1/info` consignada en
> `RepoTecnico/entornos_globales.md:332` muestra `"version":"0.2.0"`, mientras que `APP_VERSION` por defecto
> en el código es `0.9.0` (`app/core/config.py:14`) y el informe de Fase 4 evalúa `app/` como
> v0.9.0 (`RepoTecnico/pruebas/informe_fase4.md:6`). El valor real en la revisión desplegada está
> **pendiente de confirmar**, leyendo el endpoint o la variable `APP_VERSION` del servicio.

Comprobaciones adicionales recomendadas tras cualquier despliegue:

#### Lista de comprobacion posterior al despliegue

1. **Logs sin errores de autenticación** contra Cloud SQL: la aplicación registra cada petición
   con `request_id`, método, ruta, código y duración vía `ObservabilidadMiddleware`
   (`app/main.py:49-65`), y el formato de logging incluye marca de tiempo, nivel y nombre del
   logger (`app/main.py:32-34`).
2. **Estado de los datos**: que `/ready` reporte `tablas: 35` y PostgreSQL `15.18`, coherentes con el
   esquema desplegado (`RepoTecnico/entornos_globales.md:334`).
3. **Prueba de escritura**: un alta manual de caso debe generar `REF-<CENTRAL>-<NNNNNN>` mediante
   la función `generar_id_averia_ref`
   (`RepoTecnico/entornos_globales.md:309`).
4. **Revisión de estado** con `gcloud run revisions list` para confirmar que la nueva revisión
   recibe el 100 % del tráfico, procedimiento empleado al rotar la contraseña de TrueKeate
   (`RepoTecnico/entornos_globales.md:104`).

Finalmente, el `ready` público no expone secretos, pero **sí revela** el nombre de la base, el
usuario y la versión del motor (`app/api/routes_health.py:49-55`). En un servicio con PII y acceso
abierto, esa exposición es un argumento adicional para restringir el invocador y evaluar la
restricción de `/ready` en producción; el endurecimiento concreto está **pendiente de confirmar**.
