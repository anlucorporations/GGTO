# Manual de scripts de aprovisionamiento GCP — GGTO (CANTV, Central Francisco Salias / Área 4)

Este manual documenta los **scripts de aprovisionamiento de Google Cloud** que acompañan a la
plataforma **GGTO**. Describe la biblioteca común de autenticación, el orquestador, cada script por
separado (qué crea, qué variables consume y qué notas operativas tiene), los scripts auxiliares del
proyecto y el procedimiento de *teardown* controlado. Cada afirmación se respalda con una referencia
`ruta:línea` verificada en el repositorio; lo que no puede comprobarse en el código o en los
documentos se declara expresamente como **pendiente de confirmar**.

## Visión general

Los scripts son la materialización reproducible del plan de infraestructura descrito en
`RepoTecnico/GGTOv2_GCP.md`. El estado del proyecto los registra como trece archivos `.sh`
(`RepoTecnico/estado_proyecto.md:44`) y la auditoría confirma ese mismo conteo, aclarando que
`lib_gcp.sh` es una biblioteca y no un paso de aprovisionamiento
(`RepoTecnico/INFORME_OPTIMIZACION_V1.md:329`). Todos están escritos en `bash`, declaran
`set -euo pipefail` y se apoyan en la API REST de Google Cloud mediante `curl`, con `python3` como
ayudante para leer y construir JSON.

### La carpeta RepoTecnico/scripts

La carpeta `RepoTecnico/scripts/` contiene trece archivos:

| Archivo | Rol |
|---|---|
| `lib_gcp.sh` | Biblioteca común: token y helper `api` (`RepoTecnico/scripts/lib_gcp.sh:1-49`) |
| `provision_all.sh` | Orquestador del aprovisionamiento completo (`RepoTecnico/scripts/provision_all.sh:1-21`) |
| `00_crear_proyecto.sh` | Proyecto y facturación |
| `01_habilitar_apis.sh` | Habilitación de APIs |
| `02_red_privada.sh` | VPC, subred y *Private Service Access* |
| `03_iam_cuentas_servicio.sh` | Cuentas de servicio e IAM de mínimo privilegio |
| `04_secretos_kms.sh` | Cloud KMS (CMEK) y Secret Manager |
| `05_storage_registry.sh` | Bucket seguro y Artifact Registry |
| `06_cloudsql_postgres.sh` | Instancia Cloud SQL PostgreSQL |
| `07_cloudrun_web.sh` | Servicio Cloud Run |
| `08_auditoria_presupuesto.sh` | Auditoría de acceso a datos y presupuesto |
| `10_usar_instancia_truekeate.sh` | Base y usuario `ggtov2` en la instancia compartida `truekeate-db-dev` |
| `99_eliminar_todo.sh` | *Teardown* controlado |

La tabla funcional coincide con la que mantiene `RepoTecnico/entornos_globales.md:112-125`. El
documento de referencia de infraestructura también lista los scripts entregados en
`RepoTecnico/GGTOv2_GCP.md:460-479`.

### Convenciones (idempotencia, token gcloud, variables)

**Idempotencia.** Cada script consulta el recurso antes de crearlo y omite la creación si ya existe:
`00_crear_proyecto.sh` comprueba el proyecto con `GET` y busca `"projectId"`
(`RepoTecnico/scripts/00_crear_proyecto.sh:9-11`); `02_red_privada.sh` define una función
`existe_net` y repite el patrón para la subred y el rango PSA
(`RepoTecnico/scripts/02_red_privada.sh:12-31`); `03_iam_cuentas_servicio.sh` comprueba la cuenta de
servicio antes de crearla (`RepoTecnico/scripts/03_iam_cuentas_servicio.sh:8-17`);
`04_secretos_kms.sh` no sobreescribe secretos existentes
(`RepoTecnico/scripts/04_secretos_kms.sh:32-34`); `05_storage_registry.sh` verifica el bucket y el
repositorio (`RepoTecnico/scripts/05_storage_registry.sh:9-15`); `06_cloudsql_postgres.sh` comprueba
la instancia (`RepoTecnico/scripts/06_cloudsql_postgres.sh:14-16`) y `10_usar_instancia_truekeate.sh`
comprueba base y usuario antes de crearlos
(`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:56-70`). La conexión de *peering* de
`02_red_privada.sh` es la única operación que se ejecuta siempre con `force=true`, porque un
reintento devuelve un error benigno
(`RepoTecnico/scripts/02_red_privada.sh:33-36`).

**Token de `gcloud`.** Ningún script llama a `gcloud` para crear recursos: usan `curl` contra las
API REST. La única dependencia opcional de `gcloud` está en `gcp_token`
(`RepoTecnico/scripts/lib_gcp.sh:5-36`). Esto permite ejecutar los scripts incluso cuando el CLI de
`gcloud` no está operativo, gracias al respaldo de credenciales de usuario y al servidor de
metadatos.

**Variables.** Las variables globales tienen valores por defecto y pueden sobreescribirse por
entorno. Se definen al final de `lib_gcp.sh` (`RepoTecnico/scripts/lib_gcp.sh:46-49`):
`PROJECT_ID` (por defecto `ggtov2`), `REGION` (por defecto `europe-west1`), `BILLING_ACCOUNT` y
`ORG_ID`. Las variables particulares de cada script (`TIER`, `HA`, `BUDGET_USD`, `IMAGE`,
`CREAR_RECURSOS`, `CONFIRM_DESTROY`) se documentan en su sección correspondiente. El manual
`01-entornos-y-variables.md` de esta misma colección describe las variables de la aplicación; aquí
solo se tratan las del aprovisionamiento.

## Biblioteca común (scripts/lib_gcp.sh)

`lib_gcp.sh` se carga con `source` desde todos los scripts y aporta tres cosas: la obtención del
token, el helper de llamadas REST y las variables globales
(`RepoTecnico/scripts/lib_gcp.sh:1-49`).

### Obtención del token (gcp_token)

La función `gcp_token` resuelve un *access token* probando cuatro fuentes en orden estricto
(`RepoTecnico/scripts/lib_gcp.sh:5-36`):

| Orden | Fuente | Condición | Línea |
|---|---|---|---|
| 1 | `$GOOGLE_ACCESS_TOKEN` | Si la variable está definida | `RepoTecnico/scripts/lib_gcp.sh:6` |
| 2 | `gcloud auth print-access-token` | Si `gcloud` existe y responde | `RepoTecnico/scripts/lib_gcp.sh:7-8` |
| 3 | Credenciales de usuario (`refresh_token`) | Si existe `~/.config/gcloud/credentials.db` | `RepoTecnico/scripts/lib_gcp.sh:10-29` |
| 4 | Servidor de metadatos de GCE | Si responde `metadata.google.internal` | `RepoTecnico/scripts/lib_gcp.sh:30-34` |

Si ninguna fuente funciona, imprime `ERROR: no se pudo obtener token` y termina con código distinto
de cero (`RepoTecnico/scripts/lib_gcp.sh:35`). La tercera vía usa `sqlite3` para leer
`credentials.db`, intercambia el `refresh_token` en `https://oauth2.googleapis.com/token` y toma la
cuenta indicada por `GCP_USER_ACCOUNT` (`RepoTecnico/scripts/lib_gcp.sh:12-26`). El valor por
defecto de esa variable de cuenta aparece en el propio archivo; **no se reproduce aquí por tratarse
de un identificador personal**.

### Helper api y variables globales

El helper `api` recibe método, URL y, opcionalmente, un cuerpo JSON
(`RepoTecnico/scripts/lib_gcp.sh:37-45`). Cuando hay cuerpo, envía `curl -s -X "$method"` con las
cabeceras `Authorization: Bearer` y `Content-Type: application/json`; cuando no lo hay, omite el
cuerpo (`RepoTecnico/scripts/lib_gcp.sh:40-44`). Todos los scripts construyen las URL con
`$PROJECT_ID`, `$REGION`, `$BILLING_ACCOUNT` u `$ORG_ID` y procesan la respuesta con `python3 -c`
para extraer campos o detectar `"error"`. Las variables globales se fijan con el patrón
`${VARIABLE:-valor}` (`RepoTecnico/scripts/lib_gcp.sh:46-49`), de modo que el operador puede
apuntar a otro proyecto o región sin editar el archivo.

## Orquestador (scripts/provision_all.sh) y variable CREAR_RECURSOS

`provision_all.sh` ejecuta el aprovisionamiento en orden y separa los pasos **no facturables** de
los **facturables** (`RepoTecnico/scripts/provision_all.sh:1-21`). Primero se sitúa en su propio
directorio con `cd "$(dirname "$0")"` (`RepoTecnico/scripts/provision_all.sh:6`), de forma que las llamadas relativas
`./00_...` funcionan desde cualquier directorio de invocación.

| Ejecución | Pasos que corre | Efecto |
|---|---|---|
| `./provision_all.sh` | `00`, `01`, `02`, `03`, `08` | No genera costo |
| `CREAR_RECURSOS=si ./provision_all.sh` | Los anteriores + `04`, `05`, `06` | Genera costo recurrente |

El bloque condicional comprueba `[[ "${CREAR_RECURSOS:-no}" == "si" ]]`
(`RepoTecnico/scripts/provision_all.sh:13`) y, si no se activa, imprime que los recursos facturables
quedan omitidos y recomienda ejecutarlo cuando la facturación esté activa
(`RepoTecnico/scripts/provision_all.sh:18-20`). El paso `07_cloudrun_web.sh` está **comentado** en el orquestador, con
la nota de que debe descomentarse cuando exista una imagen en Artifact Registry
(`RepoTecnico/scripts/provision_all.sh:17`). Esto explica por qué el despliegue de Cloud Run se hace por separado en la
práctica.

## Script por script

Cada subsección describe el script, los recursos que crea, las variables que consume y las notas
operativas verificadas.

### 00_crear_proyecto.sh

Crea el proyecto `GGTOv2` dentro de la organización y vincula la cuenta de facturación
(`RepoTecnico/scripts/00_crear_proyecto.sh:1-34`). Encabezado y variables: `$PROJECT_ID`,
`$ORG_ID`, `$BILLING_ACCOUNT` (`RepoTecnico/scripts/00_crear_proyecto.sh:5-7`).

- **Consulta previa:** `GET .../v1/projects/$PROJECT_ID`; si la respuesta contiene `"projectId"`,
  informa que el proyecto ya existe con su número y estado
  (`RepoTecnico/scripts/00_crear_proyecto.sh:9-11`).
- **Creación:** `POST .../v1/projects` con `name: "GGTOv2"` y `parent` de tipo `organization`
  (`RepoTecnico/scripts/00_crear_proyecto.sh:13-16`).
- **Espera:** sondea la operación hasta 30 veces con `sleep 6` hasta ver `"done": true`
  (`RepoTecnico/scripts/00_crear_proyecto.sh:18-22`).
- **Facturación:** `PUT .../billingInfo` con `billingAccounts/$BILLING_ACCOUNT` y luego `GET` para
  imprimir `billingEnabled` (`RepoTecnico/scripts/00_crear_proyecto.sh:25-31`).
- **Nota:** advierte que `Cloud billing quota exceeded` significa que la cuenta alcanzó el máximo de
  cinco proyectos (`RepoTecnico/scripts/00_crear_proyecto.sh:33-34`). Ese cupo agotado es exactamente el bloqueo que
  obligó a usar `truekeate-main` (`RepoTecnico/estado_proyecto.md:12`).

### 01_habilitar_apis.sh

Habilita las APIs de GCP requeridas por la plataforma
(`RepoTecnico/scripts/01_habilitar_apis.sh:1-38`). Primero obtiene el `projectNumber`
(`RepoTecnico/scripts/01_habilitar_apis.sh:6-8`) y luego recorre dos listas:

| Grupo | APIs | Facturación |
|---|---|---|
| `SIN_BILLING` | `cloudresourcemanager`, `serviceusage`, `iam`, `iamcredentials`, `cloudbilling`, `sqladmin`, `sql-component`, `servicenetworking`, `storage`, `logging`, `monitoring`, `networkconnectivity`, `cloudkms`, `cloudtrace`, `cloudprofiler`, `clouderrorreporting`, `servicecontrol` | No requiere | 
| `CON_BILLING` | `compute`, `vpcaccess`, `secretmanager`, `dlp`, `run`, `artifactregistry`, `cloudbuild`, `containerregistry`, `certificatemanager`, `billingbudgets` | Requiere |

Las listas se declaran en `RepoTecnico/scripts/01_habilitar_apis.sh:11-24`. Para cada servicio hace
`POST .../services/$s:enable` (`RepoTecnico/scripts/01_habilitar_apis.sh:29`) e imprime `OK` o `PENDIENTE` según la
respuesta (`RepoTecnico/scripts/01_habilitar_apis.sh:30-35`). Cierra recordando que las APIs marcadas `PENDIENTE`
requieren vincular facturación (`RepoTecnico/scripts/01_habilitar_apis.sh:38`).

### 02_red_privada.sh

Crea la red privada dedicada: VPC, subred y rango de *Private Service Access* para Cloud SQL
(`RepoTecnico/scripts/02_red_privada.sh:1-37`). Variables locales: `VPC=ggtov2-vpc`,
`SUBNET=ggtov2-subnet`, `PSA_RANGE=ggtov2-psa-range` y `PSA_PREFIX=20`
(`RepoTecnico/scripts/02_red_privada.sh:6-9`).

| Recurso | Configuración | Línea |
|---|---|---|
| VPC `ggtov2-vpc` | `autoCreateSubnetworks:false`, routing `GLOBAL` | `RepoTecnico/scripts/02_red_privada.sh:14-18` |
| Subred `ggtov2-subnet` | `10.10.0.0/24`, `privateIpGoogleAccess:true` | `RepoTecnico/scripts/02_red_privada.sh:20-24` |
| Rango PSA | `INTERNAL`, `VPC_PEERING`, prefijo `/20` | `RepoTecnico/scripts/02_red_privada.sh:27-31` |
| Conexión de *peering* | `servicenetworking` con `force=true` | `RepoTecnico/scripts/02_red_privada.sh:33-36` |

Cierra indicando que Cloud SQL usará IP privada dentro de la VPC (`RepoTecnico/scripts/02_red_privada.sh:37`). Es la
base de red que consumiría `06_cloudsql_postgres.sh`.

### 03_iam_cuentas_servicio.sh

Crea dos cuentas de servicio y aplica enlaces IAM de mínimo privilegio
(`RepoTecnico/scripts/03_iam_cuentas_servicio.sh:1-43`). Las cuentas son `ggtov2-app` (runtime de
Cloud Run) y `ggtov2-deploy` (CI/CD) (`03_iam_cuentas_servicio.sh:5,18-19`).

| Cuenta | Roles asignados | Línea |
|---|---|---|
| `ggtov2-app` | `cloudsql.client`, `secretmanager.secretAccessor`, `logging.logWriter`, `monitoring.metricWriter`, `cloudtrace.agent`, `cloudprofiler.agent`, `serviceusage.serviceUsageConsumer`, `cloudkms.cryptoKeyDecrypter` | `RepoTecnico/scripts/03_iam_cuentas_servicio.sh:33-36` |
| `ggtov2-deploy` | `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`, `cloudbuild.builds.editor`, `storage.objectAdmin`, `cloudsql.client` | `RepoTecnico/scripts/03_iam_cuentas_servicio.sh:37-39` |

La aplicación de los enlaces es idempotente: obtiene la política con `getIamPolicy`, añade el
miembro solo si no está presente con una función `add` y la vuelve a fijar con `setIamPolicy`
(`RepoTecnico/scripts/03_iam_cuentas_servicio.sh:22-43`).

### 04_secretos_kms.sh

Crea el llavero y las claves de Cloud KMS (CMEK) y los secretos de la plataforma
(`RepoTecnico/scripts/04_secretos_kms.sh:1-54`). Variables: `KR=ggtov2`, `KEY_SEC=ggtov2-secrets`,
`KEY_STO=ggtov2-storage` (`RepoTecnico/scripts/04_secretos_kms.sh:6`).

- **Rotación:** las claves se crean con propósito `ENCRYPT_DECRYPT` y `rotationPeriod` de
  `7776000s`, es decir 90 días (`RepoTecnico/scripts/04_secretos_kms.sh:22-24`).
- **Generación de valores:** `gcp_gen` produce una cadena aleatoria de 32 caracteres con
  `openssl rand` (`RepoTecnico/scripts/04_secretos_kms.sh:10`); los valores **no se imprimen**.
- **Secretos creados:** `ggtov2-db-password`, `ggtov2-db-root-password`, `ggtov2-app-secret-key` y
  `ggtov2-django-secret-key` (`RepoTecnico/scripts/04_secretos_kms.sh:43-46`). El cuarto conserva un nombre heredado de
  Django; su uso real en el código actual está **pendiente de confirmar**.
- **CMEK:** cada secreto usa replicación `userManaged` en la región con `customerManagedEncryption`
  (`RepoTecnico/scripts/04_secretos_kms.sh:35-36`).
- **Permisos:** concede `roles/secretmanager.secretAccessor` a `ggtov2-app` sobre
  `ggtov2-db-password`, `ggtov2-app-secret-key` y `ggtov2-django-secret-key`
  (`RepoTecnico/scripts/04_secretos_kms.sh:48-53`).

### 05_storage_registry.sh

Crea el bucket seguro de evidencias y el repositorio de imágenes
(`RepoTecnico/scripts/05_storage_registry.sh:1-28`). El nombre del bucket es
`ggtov2-assets-<projectNumber>` (`RepoTecnico/scripts/05_storage_registry.sh:5`) y la clave CMEK es
`ggtov2-storage` (`RepoTecnico/scripts/05_storage_registry.sh:6`).

| Ajuste del bucket | Valor | Línea |
|---|---|---|
| Ubicación y clase | `EUROPE-WEST1`, `STANDARD` | `RepoTecnico/scripts/05_storage_registry.sh:13` |
| Clave por defecto | `ggtov2-storage` (CMEK) | `RepoTecnico/scripts/05_storage_registry.sh:13` |
| Acceso | `uniformBucketLevelAccess` y `publicAccessPrevention: enforced` | `RepoTecnico/scripts/05_storage_registry.sh:13` |
| Versionado | `enabled: true` | `RepoTecnico/scripts/05_storage_registry.sh:13` |
| Ciclo de vida | Borra versiones no vigentes a los 365 días | `RepoTecnico/scripts/05_storage_registry.sh:13` |
| Retención | 30 días (`2592000` segundos), sin bloquear | `RepoTecnico/scripts/05_storage_registry.sh:17-18` |

El repositorio `ggtov2-web` de Artifact Registry se crea con formato `DOCKER` y etiqueta
`proyecto=ggtov2` (`RepoTecnico/scripts/05_storage_registry.sh:20-27`).

### 06_cloudsql_postgres.sh

Crea la instancia Cloud SQL propia `ggtov2-pg` con IP privada, SSL y respaldos
(`RepoTecnico/scripts/06_cloudsql_postgres.sh:1-66`). Variables: `INSTANCE=ggtov2-pg`,
`DB_NAME=ggtov2`, `DB_USER=ggtov2_app`, `TIER` (por defecto `db-f1-micro`) y `HA` (por defecto
`ZONAL`) (`RepoTecnico/scripts/06_cloudsql_postgres.sh:7-11`). El perfil por defecto es de desarrollo y el propio
encabezado advierte cambiarlo para producción (`RepoTecnico/scripts/06_cloudsql_postgres.sh:2-4`).

| Ajuste | Valor | Línea |
|---|---|---|
| Motor | `POSTGRES_16` | `RepoTecnico/scripts/06_cloudsql_postgres.sh:25` |
| Disco | `PD_SSD`, 10 GB, autoescalado hasta 50 GB | `RepoTecnico/scripts/06_cloudsql_postgres.sh:27-28` |
| Respaldos | Activados, PITR 7 días, inicio 03:00 | `RepoTecnico/scripts/06_cloudsql_postgres.sh:29-30` |
| Red | `ipv4Enabled:false`, red `ggtov2-vpc`, `sslMode: ENCRYPTED_ONLY` | `RepoTecnico/scripts/06_cloudsql_postgres.sh:31-32` |
| Protección | `deletionProtectionEnabled:true` | `RepoTecnico/scripts/06_cloudsql_postgres.sh:33` |
| Contraseñas | Mínimo 12, complejidad por defecto, sin reutilizar en 5 | `RepoTecnico/scripts/06_cloudsql_postgres.sh:34-35` |
| Banderas | `cloudsql.iam_authentication=on`, `log_min_duration_statement=500`, `log_connections=on` | `RepoTecnico/scripts/06_cloudsql_postgres.sh:36-38` |
| Mantenimiento | Domingo a las 03:00, pista `stable` | `RepoTecnico/scripts/06_cloudsql_postgres.sh:39` |

La contraseña de la base y de `root` se leen de Secret Manager
(`RepoTecnico/scripts/06_cloudsql_postgres.sh:17-20`). Tras crear la instancia (con sondeo de hasta 60 iteraciones de
15 s, `RepoTecnico/scripts/06_cloudsql_postgres.sh:47-51`), crea la base `ggtov2` con `charset UTF8` y el usuario
`ggtov2_app` con host `%` (`RepoTecnico/scripts/06_cloudsql_postgres.sh:54-62`). Cierra mostrando la forma de la cadena
de conexión, sin revelar la contraseña (`RepoTecnico/scripts/06_cloudsql_postgres.sh:64-66`).

> **Nota de fidelidad:** lo realmente desplegado **no** es esta instancia, sino la base `ggtov2`
> dentro de la instancia compartida `truekeate-db-dev` (PostgreSQL 15.18), como se detalla en
> `RepoTecnico/entornos_globales.md:313-314`. Este script es el camino previsto al desbloquear la
> facturación (`RepoTecnico/entornos_globales.md:368-369`).

### 07_cloudrun_web.sh

Despliega la plataforma en Cloud Run con salida VPC directa
(`RepoTecnico/scripts/07_cloudrun_web.sh:1-36`). Variables: `SERVICE=ggtov2-web`
(`RepoTecnico/scripts/07_cloudrun_web.sh:6`) e `IMAGE` (por defecto
`$REGION-docker.pkg.dev/$PROJECT_ID/ggtov2-web/app:latest`, `RepoTecnico/scripts/07_cloudrun_web.sh:7`).

El cuerpo del servicio define: puerto `8080`; variables `DB_USER`, `DB_NAME`, `DB_HOST` con socket
`/cloudsql/<proyecto>:<región>:ggtov2-pg` y `SECRET_KEY` desde el secreto `ggtov2-app-secret-key`;
límites de 1 CPU y 512 MiB; acceso VPC por `ggtov2-vpc`/`ggtov2-subnet`; escalado de 0 a 10
instancias y `timeout` de 300 s (`RepoTecnico/scripts/07_cloudrun_web.sh:10-26`). Después de crear el servicio
(`RepoTecnico/scripts/07_cloudrun_web.sh:28-29`) aplica un enlace IAM que concede `roles/run.invoker` a `allUsers`
(`RepoTecnico/scripts/07_cloudrun_web.sh:31-34`).

> **Riesgo documentado:** ese enlace hace el servicio **público**. El estado del proyecto pide
> restringir el acceso porque el servicio ya contiene PII real
> (`RepoTecnico/estado_proyecto.md:13`, `RepoTecnico/estado_proyecto.md:121`). En el despliegue real
> la URL pública también quedó expuesta (`RepoTecnico/entornos_globales.md:325`).

### 08_auditoria_presupuesto.sh

Activa la auditoría de acceso a datos y crea el presupuesto con alertas
(`RepoTecnico/scripts/08_auditoria_presupuesto.sh:1-25`).

- **Auditoría:** construye `auditConfigs` para `secretmanager`, `cloudkms`, `cloudsql` y `storage`
  con los tipos `ADMIN_READ`, `DATA_READ` y/o `DATA_WRITE`
  (`RepoTecnico/scripts/08_auditoria_presupuesto.sh:12-16`) y los fija con `setIamPolicy`
  (`RepoTecnico/scripts/08_auditoria_presupuesto.sh:19-20`). Si la respuesta no trae `auditConfigs`, avisa que no se
  persistió (`RepoTecnico/scripts/08_auditoria_presupuesto.sh:20`).
- **Presupuesto:** `POST .../billingAccounts/$BILLING_ACCOUNT/budgets` con nombre `GGTOv2 mensual`,
  importe `${BUDGET_USD:-50}` USD y umbrales al 50 %, 90 % y 100 %
  (`RepoTecnico/scripts/08_auditoria_presupuesto.sh:22-25`). La variable de importe es `BUDGET_USD`.

### 10_usar_instancia_truekeate.sh

Es el script que permitió operar **sin** facturación propia. Da de alta una base y un usuario
dedicados a GGTO dentro de la instancia Cloud SQL existente en `truekeate-main` y habilita el
acceso del runtime (`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:1-96`).

| Dato | Valor | Línea |
|---|---|---|
| Proyecto origen | `truekeate-main` | `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:12` |
| Instancia | `truekeate-db-dev` | `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:13` |
| Base / usuario | `ggtov2` / `ggtov2_app` | `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:14-15` |
| `connectionName` | `truekeate-main:southamerica-east1:truekeate-db-dev` | `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:16` |
| SA de la app | `ggtov2-app@ggtov2.iam.gserviceaccount.com` | `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:17` |
| SA de TrueKeate | `truekeate-app-sa@truekeate-main.iam.gserviceaccount.com` | `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:18` |

Pasos: genera una contraseña aleatoria de 32 caracteres sin imprimirla
(`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:23`); crea o versiona los secretos `ggtov2-db-password` y
`ggtov2-db-connection` en `truekeate-main`
(`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:26-46`); concede `secretmanager.secretAccessor` sobre ambos a las
dos cuentas de servicio (`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:49-53`); crea la base y el usuario solo si
no existen, sin cambiar la contraseña del usuario ya creado
(`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:56-70`); y añade `roles/cloudsql.client` para la SA de GGTO en la
política de `truekeate-main` (`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:72-88`). El resumen final indica que
la contraseña vive solo en Secret Manager y muestra la ruta del socket para Cloud Run
(`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:90-96`).

### 99_eliminar_todo.sh

*Teardown* controlado de los recursos de GGTO
(`RepoTecnico/scripts/99_eliminar_todo.sh:1-18`). Antes de tocar nada exige
`CONFIRM_DESTROY=ELIMINAR`; si no coincide, aborta con un mensaje
(`RepoTecnico/scripts/99_eliminar_todo.sh:6`). El orden de borrado es: desactivar `deletionProtectionEnabled` de la
instancia y borrarla (`RepoTecnico/scripts/99_eliminar_todo.sh:9-11`), borrar el servicio Cloud Run `ggtov2-web`
(`RepoTecnico/scripts/99_eliminar_todo.sh:12`), el repositorio `ggtov2-web` (`RepoTecnico/scripts/99_eliminar_todo.sh:13`), la VPC
(`RepoTecnico/scripts/99_eliminar_todo.sh:14`) y los cuatro secretos (`RepoTecnico/scripts/99_eliminar_todo.sh:15-17`). El cierre advierte
que **el bucket y las claves KMS deben borrarse manualmente** por su política de retención
(`RepoTecnico/scripts/99_eliminar_todo.sh:18`).

## Scripts auxiliares del proyecto

Además de los scripts de infraestructura, el repositorio incluye utilidades de operación y de
pruebas. No forman parte de `provision_all.sh` y se ejecutan de forma explícita.

### scripts/inyectar_super_usuario.py

Inyecta el **Super Usuario** de la plataforma con rol `SUPER`
(`scripts/inyectar_super_usuario.py:1-281`). Es idempotente: si el `P00` ya existe, actualiza sus
datos y su clave (`scripts/inyectar_super_usuario.py:9-11`). Sus garantías de seguridad son relevantes para
operación:

- La clave **no** se escribe en el archivo ni en la línea de comandos: se lee de la variable de
  entorno indicada por `--clave-env` (por defecto `GGTO_SUPER_CLAVE`) o se pide de forma oculta
  (`inyectar_super_usuario.py:13-15,164-169`).
- Exige confirmación interactiva salvo `--si` (`scripts/inyectar_super_usuario.py:178-182`) y exige un
  mínimo de 8 caracteres (`scripts/inyectar_super_usuario.py:170-172`).
- Registra cada ejecución en `RepoTecnico/BaseOperaciones/inyeccion_super_usuario.log`
  (`inyectar_super_usuario.py:82,85-90`).
- Reutiliza el mismo *hash* y el mismo diccionario de palabras que la aplicación
  (`scripts/inyectar_super_usuario.py:44-50`).
- Opcionalmente genera y guarda las **12 palabras de seguridad** en `dispositivo_seguridad`
  (`scripts/inyectar_super_usuario.py:233-247`) y las muestra una sola vez
  (`scripts/inyectar_super_usuario.py:271-274`).

Parámetros principales: `--p00`, `--correo`, `--nombre`, `--apellido`, `--rol`, `--id-central`,
`--con-palabras`, `--dry-run`, `--si` (`scripts/inyectar_super_usuario.py:148-162`). Las credenciales de
base se toman de `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_SSLMODE` o de `--dsn`
(`scripts/inyectar_super_usuario.py:93-112`).

### scripts/recalcular_cuadrilla0.py

Recalcula la marca de **cuadrilla 0** (`caso.en_gestion_supervisor`) de los casos existentes usando
la configuración vigente (`scripts/recalcular_cuadrilla0.py:1-143`). Sirve para aplicar un cambio de
criterio sin volver a ingerir el CSV (`scripts/recalcular_cuadrilla0.py:11-12`).

- Por defecto es **simulación**: informa qué cambiaría sin escribir
  (`recalcular_cuadrilla0.py:15-16,117-119`). Para escribir hay que pasar `--aplicar` y confirmar
  (o `--si`) (`scripts/recalcular_cuadrilla0.py:121-125`).
- Lee las claves `despacho.criterio_cuadrilla0`, `despacho.frases_campo`,
  `despacho.frases_supervisor` y `despacho.columnas_evaluar` de la tabla `configuracion`
  (`recalcular_cuadrilla0.py:9,84-91`) y evalúa con `app.services.cuadrilla0.evaluar`
  (`recalcular_cuadrilla0.py:40,107`).
- Limita a 20 los cambios impresos y resume el resto (`scripts/recalcular_cuadrilla0.py:112-115`).
- Registra la ejecución en `RepoTecnico/BaseOperaciones/recalculo_cuadrilla0.log`
  (`recalcular_cuadrilla0.py:42,45-49`).

Su uso real está documentado en la decisión D-59: se recalcularon los 42 casos reales pasando
`despacho.criterio_cuadrilla0` a `SUPERVISOR`
(`RepoTecnico/estado_proyecto.md:116`).

### RepoTecnico/pruebas/run_e2e.sh

Orquesta las pruebas E2E de navegador contra un esquema aislado
(`RepoTecnico/pruebas/run_e2e.sh:1-71`). El manual `04-pruebas-y-ci.md` de esta colección lo detalla
en profundidad; aquí se resume su relación con el aprovisionamiento: reutiliza la base compartida a
través del **Cloud SQL Auth Proxy** en `127.0.0.1:5433`
(`RepoTecnico/pruebas/run_e2e.sh:18-23`), levanta `uvicorn app.main:app` en `http://127.0.0.1:8090`
(`run_e2e.sh:30,49-51`) y usa `DB_SCHEMA=ggto_e2e`
(`run_e2e.sh:16,23`). Exporta `LD_LIBRARY_PATH` y `FONTCONFIG_FILE` para Chromium
(`RepoTecnico/pruebas/run_e2e.sh:28-29`) y termina el *backend* con un `trap`/`kill` al salir
(`run_e2e.sh:52-53,68-69`).

### RepoTecnico/pruebas/seed_e2e.py

Siembra los datos deterministas de las pruebas E2E (`RepoTecnico/pruebas/seed_e2e.py:1-203`). Crea o
reinicia el esquema aislado (por defecto `ggto_e2e`) a partir de
`RepoTecnico/db/schema.sql` (`RepoTecnico/pruebas/seed_e2e.py:60-84`) y siembra usuarios `E2EADM`/`E2ESUP`/`E2ETEC`, el
sector `E2E-S1`, la cuadrilla `E2E-C1` y **8 casos** `E2E-…`
(`seed_e2e.py:48-52,117-135,143-187`). Aborta si el esquema es `public`, para no tocar producción
(`RepoTecnico/pruebas/seed_e2e.py:190-192`). En su ejecución real genera `RepoTecnico/pruebas/logs/seed.json`
(`RepoTecnico/pruebas/run_e2e.sh:46-47`).

## Teardown y confirmación (CONFIRM_DESTROY=ELIMINAR)

El borrado de recursos es destructivo e irreversible, y el diseño lo protege con una confirmación
explícita. `99_eliminar_todo.sh` compara `CONFIRM_DESTROY` con la cadena literal `ELIMINAR` y
aborta si no coincide (`RepoTecnico/scripts/99_eliminar_todo.sh:6`). Para ejecutarlo:

```bash
cd RepoTecnico/scripts
CONFIRM_DESTROY=ELIMINAR ./99_eliminar_todo.sh
```

Puntos que conviene tener presentes antes de usarlo:

- El script apunta a `$PROJECT_ID`, que por defecto es `ggtov2`
  (`RepoTecnico/scripts/lib_gcp.sh:46`). **No** borra la base `ggtov2` ni el usuario `ggtov2_app` de
  la instancia `truekeate-db-dev`, ni los secretos creados en `truekeate-main` por
  `10_usar_instancia_truekeate.sh`; ese borrado está **pendiente de confirmar** como procedimiento
  documentado y debe hacerse de forma manual y coordinada con TrueKeate.
- Los borrados de la instancia, el servicio, el repositorio, la VPC y los secretos usan
  `>/dev/null 2>&1 || true`, de modo que un recurso inexistente no aborta el *teardown*
  (`RepoTecnico/scripts/99_eliminar_todo.sh:9-17`).
- El bucket y las claves KMS **no** se borran automáticamente por su política de retención
  (`RepoTecnico/scripts/99_eliminar_todo.sh:18`).
- El servicio Cloud Run realmente desplegado se llama `ggto-web` en `truekeate-main`, mientras que
  el script intenta borrar `ggtov2-web` en `$PROJECT_ID`
  (`RepoTecnico/scripts/99_eliminar_todo.sh:12`); por tanto, el `ggto-web` real **no** queda cubierto por este script.

## Diferencia entre lo previsto (ggtov2) y lo realmente desplegado (truekeate-main)

La infraestructura prevista y la realmente operativa divergen por un bloqueo administrativo, no por
un cambio de diseño. La cuenta de facturación tiene agotado el cupo de cinco proyectos, de modo que
`ggtov2` quedó con `billingEnabled:false` y sin APIs de despliegue
(`RepoTecnico/entornos_globales.md:360-366`). Para no detener el proyecto, se reutilizó la instancia
Cloud SQL de `truekeate-main` (`RepoTecnico/estado_proyecto.md:12,106-107`).

| Aspecto | Previsto (`ggtov2`) | Real (`truekeate-main`) | Referencia |
|---|---|---|---|
| Proyecto | `ggtov2` | `truekeate-main` | `RepoTecnico/entornos_globales.md:313`; `RepoTecnico/estado_proyecto.md:107` |
| Servicio Cloud Run | `ggtov2-web` | `ggto-web` | `RepoTecnico/scripts/07_cloudrun_web.sh:6`; `RepoTecnico/entornos_globales.md:318` |
| Imagen | `.../ggtov2/ggtov2-web/app:latest` | `southamerica-east1-docker.pkg.dev/truekeate-main/truekeate-repo/ggto-web:v14` | `RepoTecnico/scripts/07_cloudrun_web.sh:7`; `RepoTecnico/estado_proyecto.md:124` |
| Instancia de datos | `ggtov2-pg` (PostgreSQL 16, privada) | `truekeate-db-dev` (PostgreSQL 15.18, compartida) | `06_cloudsql_postgres.sh:7,25`; `RepoTecnico/entornos_globales.md:314` |
| Base / usuario | `ggtov2` / `ggtov2_app` | `ggtov2` / `ggtov2_app` (mismos nombres) | `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:14-15` |
| Buena parte de 04, 05, 06 | Ejecutables con `CREAR_RECURSOS=si` | **No ejecutados** por falta de facturación | `RepoTecnico/scripts/provision_all.sh:13-20`; `RepoTecnico/GGTOv2_GCP.md:208` |
| SA de ejecución | `ggtov2-app@ggtov2…` | `ggto-web-sa@truekeate-main…` | `RepoTecnico/scripts/03_iam_cuentas_servicio.sh:5`; `RepoTecnico/entornos_globales.md:322` |

Consecuencias operativas verificadas:

- La base propia no se creó: por eso existe `10_usar_instancia_truekeate.sh`, que da base, usuario,
  secretos y permiso cruzado dentro de `truekeate-main`
  (`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:1-8,72-88`).
- La instancia compartida **no** tiene los respaldos, PITR ni SSL obligatorio que sí definiría
  `06_cloudsql_postgres.sh`; ese riesgo quedó aceptado como D-26 hasta migrar
  (`RepoTecnico/estado_proyecto.md:90`).
- El paso `07_cloudrun_web.sh` no se ejecutó en `ggtov2`; el despliegue real usa el proyecto
  `truekeate-main` con una cuenta de servicio distinta
  (`RepoTecnico/estado_proyecto.md:107`).
- La ruta de convergencia está definida: al desbloquear la facturación, migrar el servicio a
  `ggtov2` con `07_cloudrun_web.sh` y su propio Cloud SQL `ggtov2-pg`
  (`RepoTecnico/entornos_globales.md:368-369`).
- El importe y la fecha exactos para esa migración están **pendientes de confirmar**; el estado del
  proyecto solo registra "desbloquear la facturación GCP y migrar"
  (`RepoTecnico/estado_proyecto.md:137`).
