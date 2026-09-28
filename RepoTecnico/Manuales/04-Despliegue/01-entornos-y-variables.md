# Manual de Entornos y Variables — GGTO (CANTV, Central Francisco Salias / Área 4)

Este manual describe los entornos en los que se ejecuta la plataforma **GGTO**, el inventario
completo de variables de configuración de la aplicación y el gobierno de los secretos. Todas
las afirmaciones se respaldan con referencias `ruta:línea` verificadas sobre el código y los
documentos del repositorio. Cuando un dato no pudo comprobarse, se declara explícitamente como
**pendiente de confirmar**.

## Entornos

La aplicación lee su entorno desde la variable `app_env` (variable de proceso `APP_ENV`),
cuyo valor por defecto es `development` (`app/core/config.py:13`). El valor se publica sin
transformación en el endpoint de metadatos `GET /api/v1/info` como la clave `entorno`
(`app/api/routes_health.py:17-25`), de modo que cualquier consulta a ese endpoint permite
determinar en qué entorno está corriendo el proceso sin revisar la consola de GCP.

La configuración se resuelve con `pydantic-settings`: `Settings` declara
`SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)`
(`app/core/config.py:8-9`), es decir, se lee un archivo `.env` del directorio de trabajo, las
variables del sistema tienen prioridad y las variables no declaradas se ignoran sin romper el
arranque. La instancia es única por proceso gracias a `@lru_cache` sobre `get_settings()`
(`app/core/config.py:45-47`).

### development

Es el entorno de trabajo en la instancia GCE del workspace (`/home/dsh/workspace`), usuario
`dsh`, con `python3`, `node`, `npm`, `gcloud` y `git` disponibles
(`RepoTecnico/entornos_globales.md:19-25`). En este entorno:

- `APP_ENV=development` es el valor documentado para el archivo de entorno previsto
  (`RepoTecnico/entornos_globales.md:133`).
- La base de datos se alcanza por TCP al proxy local: `DB_HOST=127.0.0.1`,
  `DB_PORT=5433`, `DB_NAME=ggtov2`, `DB_USER=ggtov2_app`
  (`RepoTecnico/pruebas/run_e2e.sh:16-20`).
- La aplicación se levanta manualmente con Uvicorn, tal como hace la rutina de pruebas E2E:
  `python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8090`
  (`RepoTecnico/pruebas/run_e2e.sh:51-52`).
- **No hay `docker` ni cliente `psql`** instalados de forma nativa
  (`RepoTecnico/entornos_globales.md:25`); el cliente `psql` se busca en `$HOME/bin/psql` con
  reserva a `psql` del `PATH` (`RepoTecnico/pruebas/run_e2e.sh:44-46`).

### staging

No existe un entorno de *staging* desplegado y verificado en la infraestructura actual. El
requerimiento **RNF-24** exige "entornos separados `dev`/`staging`/`prod`"
(`RepoTecnico/requerimientos.md:203`) y **RNF-25** exige paridad de versiones entre desarrollo y
producción (`RepoTecnico/requerimientos.md:204`); sin embargo, el estado real del despliegue
solo registra el servicio de producción en `truekeate-main`
(`RepoTecnico/entornos_globales.md:311-325`). El valor que deba usarse en `APP_ENV` para
*staging* y el proceso concreto de promoción entre entornos están **pendientes de confirmar**.

### production

Es el entorno donde corre el servicio **Cloud Run `ggto-web`**, desplegado temporalmente en el
proyecto `truekeate-main` y región `europe-west1`
(`RepoTecnico/entornos_globales.md:317-319`). En producción:

- El servicio se conecta a la base mediante el socket de Cloud SQL:
  `DB_HOST=/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev`
  (`RepoTecnico/entornos_globales.md:374`).
- El valor de `APP_ENV` en la revisión desplegada es **pendiente de confirmar**: el script
  `RepoTecnico/scripts/07_cloudrun_web.sh:16-21` solo declara `DB_USER`, `DB_NAME`, `DB_HOST` y
  `SECRET_KEY`; no incluye `APP_ENV`. La documentación del servicio desplegado indica que
  `GET /api/v1/info` respondía `"entorno":"production"`
  (`RepoTecnico/entornos_globales.md:332`), por lo que el valor debió fijarse fuera del script o
  por defecto en la revisión; la fuente exacta es **pendiente de confirmar**.
- El servicio tiene acceso **público** (`allUsers`) y contiene PII real: 42 casos cargados
  (`RepoTecnico/entornos_globales.md:325,351-354`).

### test/preview (DB_SCHEMA)

El aislamiento de pruebas se logra con el parámetro `DB_SCHEMA` (`app/core/config.py:24-25`),
que añade `options=-csearch_path=<esquema>,public` a la URL de conexión
(`app/core/db.py:33-36`). Se usan dos esquemas aislados:

| Esquema | Herramienta | Referencia |
|---|---|---|
| `ggto_test` | `pytest` (unitarias + integración + contratos) | `RepoTecnico/pruebas/informe_fase4.md:7,16` |
| `ggto_e2e` | Playwright/Chromium (E2E de navegador) | `RepoTecnico/pruebas/informe_fase4.md:7,17` |

El esquema E2E se fija en `run_e2e.sh` con `ESQUEMA="${DB_SCHEMA:-ggto_e2e}"` y se exporta como
`DB_SCHEMA` (`RepoTecnico/pruebas/run_e2e.sh:14,21`). En el lado de `pytest`, el esquema se
selecciona con `GGTO_TEST_SCHEMA`, por defecto `public` (`app/tests/conftest.py:24-25`), y las
pruebas de integración se omiten si `GGTO_TEST_DB_URL` no está definida
(`app/tests/conftest.py:72`). La razón de conservar `public` en el `search_path` es que ahí
residen las extensiones `pgcrypto` y `pg_trgm` (`app/core/db.py:34`).

### variables globales del workspace (.env.global, gcp-env.sh)

El workspace dispone de un cargador global reutilizable ajeno al proyecto GGTO:

- `source /home/dsh/workspace/gcp-env.sh` carga variables y, en su modo diagnóstico, informa
  **solo nombres, nunca valores** (`RepoTecnico/entornos_globales.md:29-31`).
- `/home/dsh/workspace/.env.global` contiene variables sin secretos y apunta al proyecto
  **`mcc-ecommerce`** (TrueKeate/MCC), no a GGTO
  (`RepoTecnico/entornos_globales.md:34-46`).
- El proxy de Cloud SQL vive en `/home/dsh/tools/cloud-sql-proxy`, con logs en
  `/home/dsh/tools/cloudsql/proxy.log` (`RepoTecnico/entornos_globales.md:32`).

Variables relevantes de `.env.global` (verificadas como nombres en el archivo del workspace):

| Variable | Valor documentado | Observación |
|---|---|---|
| `GCP_PROJECT_ID` | `mcc-ecommerce` | Proyecto de MCC, no de GGTO (`RepoTecnico/entornos_globales.md:38`) |
| `GCP_REGION` | `us-central1` | Región base (`RepoTecnico/entornos_globales.md:39`) |
| `GCP_REGION_RUN` | `europe-west1` | Región de Cloud Run (`RepoTecnico/entornos_globales.md:40`) |
| `MCC_POSTGRES_URL` | `https://mcc-postgres-slzlptbcla-ew.a.run.app` | Servicio de MCC (`RepoTecnico/entornos_globales.md:41`) |
| `MCC_PGADMIN_URL` | `https://mcc-pgadmin-slzlptbcla-ew.a.run.app` | Administración de MCC (`RepoTecnico/entornos_globales.md:42`) |
| `MCC_ANVIL_RPC_URL` | `https://mcc-foundry-anvil-…run.app` | RPC de Anvil de MCC (`RepoTecnico/entornos_globales.md:43`) |

Además, `.env.global` declara nombres de secretos bajo el prefijo `GCP_SECRET_*` y
`MCC_SECRET_*` (por ejemplo `GCP_SECRET_DB_URL`, `MCC_SECRET_POSTGRES_PASSWORD`). Esos nombres
pertenecen a MCC y **no** deben reutilizarse para GGTO: la recomendación documentada es crear un
`.env.ggto` propio (`RepoTecnico/entornos_globales.md:45-47`).

## Variables de la aplicacion (app/core/config.py:8-47)

La clase `Settings` (`app/core/config.py:8-42`) declara 19 campos agrupados en aplicación, base
de datos, seguridad y CORS. La siguiente tabla reproduce tipo, valor por defecto y uso de cada
uno; el valor por defecto es el que rige cuando la variable no está en el entorno ni en `.env`.

| Variable | Tipo | Valor por defecto | Uso |
|---|---|---|---|
| `APP_NAME` | `str` | `GGTO API` | Título de la app FastAPI y campo `servicio` de `/api/v1/info` (`app/core/config.py:12`, `app/main.py:39`, `app/api/routes_health.py:20`) |
| `APP_ENV` | `str` | `development` | Entorno lógico; se publica en `/api/v1/info` (`app/core/config.py:13`, `app/api/routes_health.py:23`) |
| `APP_VERSION` | `str` | `0.9.0` | Versión declarada en OpenAPI y en `/api/v1/info` (`app/core/config.py:14`, `app/main.py:40`) |
| `APP_TIMEZONE` | `str` | `America/Caracas` | Zona horaria operativa (`app/core/config.py:15`) |
| `DB_HOST` | `str` | `localhost` | Host de PostgreSQL; si empieza por `/` se trata como socket de Cloud SQL (`app/core/config.py:18`, `app/core/db.py:26-29`) |
| `DB_PORT` | `int` | `5432` | Puerto TCP cuando no se usa socket (`app/core/config.py:19`, `app/core/db.py:31`) |
| `DB_NAME` | `str` | `ggtov2` | Nombre de la base (`app/core/config.py:20`) |
| `DB_USER` | `str` | `ggtov2_app` | Usuario de aplicación (`app/core/config.py:21`) |
| `DB_PASSWORD` | `str` | `""` (vacío) | Contraseña; en producción proviene de Secret Manager (`app/core/config.py:22`) |
| `DB_SSLMODE` | `str` | `prefer` | Modo SSL de la conexión TCP (`app/core/config.py:23`, `app/core/db.py:32`) |
| `DB_SCHEMA` | `str` | `""` (vacío) | Esquema alternativo vía `search_path`; vacío = comportamiento por defecto (`app/core/config.py:24-25`, `app/core/db.py:33-36`) |
| `SECRET_KEY` | `str` | `cambiar-esta-clave-en-produccion` | Clave de firma de los JWT (`app/core/config.py:28`) |
| `JWT_ALGORITHM` | `str` | `HS256` | Algoritmo de firma (`app/core/config.py:29`) |
| `ACCESS_TOKEN_MINUTES` | `int` | `480` | Vigencia del token: 8 h de jornada (`app/core/config.py:30`) |
| `MAX_INTENTOS` | `int` | `3` | Intentos fallidos antes del bloqueo (RF-20) (`app/core/config.py:31`) |
| `PALABRAS_SEGURIDAD` | `int` | `12` | Cantidad de palabras de recuperación (RF-20) (`app/core/config.py:32`) |
| `PALABRAS_REQUERIDAS` | `int` | `3` | Palabras exigidas para recuperar la cuenta (RF-20) (`app/core/config.py:33`) |
| `RATE_LIMIT_INTENTOS` | `int` | `10` | Intentos de login permitidos por ventana (RNF-22) (`app/core/config.py:34`) |
| `RATE_LIMIT_VENTANA_SEG` | `int` | `60` | Duración de la ventana de rate limiting en segundos (`app/core/config.py:35`) |
| `CORS_ORIGINS` | `str` | `*` | Orígenes permitidos, separados por coma (`app/core/config.py:38`) |

La propiedad derivada `cors_origin_list` (`app/core/config.py:40-42`) divide `CORS_ORIGINS` por
comas, recorta espacios y descarta elementos vacíos; su resultado se entrega directamente a
`CORSMiddleware` en `app/main.py:69-75`. Esto implica que con el valor por defecto `*` la API
acepta cualquier origen con `allow_credentials=True`, situación coherente con el acceso público
actual del servicio pero **no recomendable en producción**.

## Variables de despliegue previstas (RepoTecnico/entornos_globales.md:129-206)

El bloque `dotenv` de `RepoTecnico/entornos_globales.md:131-185` enumera las variables previstas
para el despliegue. Es un documento de **previsión**: algunas no están todavía implementadas en
`app/core/config.py` y otras se gobiernan desde la tabla `configuracion` (ver la sección
siguiente). Se organizan por dominio.

### aplicacion

| Variable | Valor previsto | Estado real |
|---|---|---|
| `APP_ENV` | `development \| staging \| production` | Implementada en `app/core/config.py:13` |
| `APP_NAME` | `GGTO` | Implementada, pero el valor real en código es `GGTO API` (`app/core/config.py:12`) |
| `APP_TIMEZONE` | `America/Caracas` | Implementada (`app/core/config.py:15`) |
| `SECRET_KEY` | Secret Manager `ggtov2-app-secret-key` | Implementada; el despliegue real usa el secreto `ggto-secret-key` (`RepoTecnico/entornos_globales.md:322`) |

### base de datos

| Variable | Valor previsto | Observación |
|---|---|---|
| `DB_HOST` | `/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev` | Socket en Cloud Run; proxy local en desarrollo (`RepoTecnico/entornos_globales.md:139`) |
| `DB_PORT` | `5432` | `app/core/config.py:19` |
| `DB_NAME` | `ggtov2` | `app/core/config.py:20` |
| `DB_USER` | `ggtov2_app` | `app/core/config.py:21` |
| `DB_PASSWORD` | Secret Manager `ggtov2-db-password` | `RepoTecnico/entornos_globales.md:143` |
| `DB_SSLMODE` | `require` | Previsto `require`; en `RepoTecnico/pruebas/run_e2e.sh:20` se usa `disable` contra el proxy local |
| `DB_SCHEMA` | vacío en producción; `ggto_test`/`ggto_e2e` en pruebas | `RepoTecnico/entornos_globales.md:145`, `app/core/db.py:33-36` |

### ingesta

| Variable | Valor previsto | Observación |
|---|---|---|
| `INGESTA_CSV_DELIMITER` | `;` | 80 columnas por posición (`RepoTecnico/entornos_globales.md:148`, `:230`) |
| `INGESTA_CSV_ENCODING` | `iso-8859-1` | El CSV real es ISO-8859-1, no UTF-8 (`RepoTecnico/entornos_globales.md:149-153`) |
| `INGESTA_CSV_ENCODING_DESTINO` | `utf-8` | Decodificación en la frontera (`RepoTecnico/entornos_globales.md:154`) |
| `INGESTA_CSV_FECHA_FORMATO` | `%d/%m/%Y %I:%M:%S %p` | Fechas con a.m./p.m. (`RepoTecnico/entornos_globales.md:155`) |
| `INGESTA_CSV_TIMEZONE` | `America/Caracas` | `RepoTecnico/entornos_globales.md:156` |
| `INGESTA_CSV_MAPEO` | `por_posicion` | `RepoTecnico/entornos_globales.md:157` |
| `INGESTA_CENTRAL_CODIGO` | `2324X` | `RepoTecnico/entornos_globales.md:158` |
| `INGESTA_CENTRAL_NOMBRE` | `FRANCISCO SALIAS` | `RepoTecnico/entornos_globales.md:159` |
| `INGESTA_ESTADO_OPERATIVO` | `MIRANDA-2` | `RepoTecnico/entornos_globales.md:160` |
| `INGESTA_AREA` | `AREA 4` | `RepoTecnico/entornos_globales.md:161` |

Estos parámetros no están declarados en `Settings`; en la implementación real se leen desde la
tabla `configuracion` con las claves `ingesta.central_codigo`, `ingesta.delimitador`,
`ingesta.encoding` y `ingesta.fecha_formato`
(`RepoTecnico/db/schema.sql:772-775`). La convivencia entre ambas fuentes es **pendiente de
confirmar**.

### despacho

| Variable | Valor previsto | Observación |
|---|---|---|
| `DESPACHO_HORA_REPORTE` | `16:00` | Clave real `despacho.hora_reporte` (`RepoTecnico/db/schema.sql:776`) |
| `DESPACHO_MIN_REFERIDOS` | `2` | Clave real `despacho.min_referidos` (`RepoTecnico/db/schema.sql:777`) |
| `DESPACHO_MIN_EMPRESAS` | `1` | Clave real `despacho.min_empresas` (`RepoTecnico/db/schema.sql:778`) |
| `DESPACHO_FRASES_EXCLUIR` | `LOSS ROJO;FALLA FIBRA;Fibra Dañada` | En la tabla se modela como lista JSON `despacho.frases_campo` (`RepoTecnico/db/schema.sql:782-783`) |

### mensajeria

| Variable | Valor previsto | Observación |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `<Secret Manager>` | Nombre del secreto **pendiente de confirmar** |
| `TELEGRAM_CHAT_ID_CENTRAL` | vacío | Destino de alertas |
| `SMTP_HOST` | `smtp.sendgrid.net` (alternativa `smtp.gmail.com`) | `RepoTecnico/entornos_globales.md:172` |
| `SMTP_PORT` | `587` | `RepoTecnico/entornos_globales.md:173` |
| `SMTP_USER` | `apikey` (alternativa Gmail `txbarlovento@gmail.com`) | `RepoTecnico/entornos_globales.md:174` |
| `SMTP_PASSWORD` | `<Secret Manager>` | Nombre del secreto **pendiente de confirmar** |
| `MAIL_FROM` | `txbarlovento@gmail.com` | `RepoTecnico/entornos_globales.md:176` |
| `WHATSAPP_API_URL` | reservado para la 3.ª versión | **WhatsApp no existe en la v1** (`RepoTecnico/entornos_globales.md:177`) |

En la v1 los canales son **Telegram, correo (SMTP) y MCP**; WhatsApp está diferido a la v3
(`RepoTecnico/entornos_globales.md:169`). A la fecha del levantamiento, Telegram y correo
**no tienen credenciales en producción**, por lo que el *outbox* deja las notificaciones en
estado `PENDIENTE` en lugar de perderlas (`RepoTecnico/entornos_globales.md:189-191`).

### MCP

| Variable | Valor previsto | Observación |
|---|---|---|
| `MCP_SERVER_URL` | vacío | URL del servidor MCP |
| `MCP_API_KEY` | `<Secret Manager>` | Clave que se contrasta contra la cabecera del servidor MCP (`RepoTecnico/entornos_globales.md:181`) |

### almacenamiento

| Variable | Valor previsto | Observación |
|---|---|---|
| `STORAGE_BUCKET` | `ggtov2-assets-905974355709` | Bucket de activos/evidencias (`RepoTecnico/entornos_globales.md:184`) |

> Recordatorio: `STORAGE_BUCKET` apunta a un bucket del proyecto `ggtov2`, que **no** tiene
> facturación habilitada (`RepoTecnico/entornos_globales.md:63-65,364-366`). Su uso efectivo por
> parte de la aplicación en la revisión desplegada está **pendiente de confirmar**.

## Parametros gobernados por la tabla configuracion (JSONB) (entornos_globales.md:187-206)

Buena parte de los parámetros operativos no vive en variables de entorno sino en la tabla
`configuracion`, definida como `clave varchar(80) PRIMARY KEY`, `valor jsonb NOT NULL`,
`descripcion text` y `actualizado_en timestamptz`
(`RepoTecnico/db/schema.sql:99-104`). La decisión documentada es que "los canales y la detección
de fallas se gobiernan desde la tabla `configuracion`, no desde el entorno"
(`RepoTecnico/entornos_globales.md:189-191`).

Las 13 claves sembradas por el DDL (`RepoTecnico/db/schema.sql:771-797`) se resumen a
continuación. El conteo de 13 parámetros sembrados está verificado
(`RepoTecnico/entornos_globales.md:308`).

| Clave | Valor inicial | Uso | Referencia |
|---|---|---|---|
| `ingesta.central_codigo` | `"2324X"` | Filtro de central en la ingesta | `RepoTecnico/db/schema.sql:772` |
| `ingesta.delimitador` | `";"` | Delimitador del archivo diario | `RepoTecnico/db/schema.sql:773` |
| `ingesta.encoding` | `"iso-8859-1"` | Codificación real del CSV (H-02) | `RepoTecnico/db/schema.sql:774` |
| `ingesta.fecha_formato` | `"%d/%m/%Y %I:%M:%S %p"` | Formato de fecha con zona `America/Caracas` | `RepoTecnico/db/schema.sql:775` |
| `despacho.hora_reporte` | `"16:00"` | Hora del reporte de producción | `RepoTecnico/db/schema.sql:776` |
| `despacho.min_referidos` | `2` | Mínimo de reparaciones de referidos por despacho | `RepoTecnico/db/schema.sql:777` |
| `despacho.min_empresas` | `1` | Mínimo de reparaciones de empresas por despacho | `RepoTecnico/db/schema.sql:778` |
| `despacho.criterio_cuadrilla0` | `"SUPERVISOR"` | Criterio de cuadrilla 0: `CAMPO \| SUPERVISOR \| UNION` (D-22/D-59) | `RepoTecnico/db/schema.sql:779` |
| `despacho.destino_telegram` | `""` | Chat/canal de Telegram que recibe las fichas; vacío ⇒ PENDIENTE | `RepoTecnico/db/schema.sql:780` |
| `despacho.destino_correo` | `""` | Correo que recibe las fichas de despacho | `RepoTecnico/db/schema.sql:781` |
| `despacho.frases_campo` | `["LOSS ROJO","FALLA FIBRA","Fibra Dañada"]` | Frases que indican maniobra de campo | `RepoTecnico/db/schema.sql:782-783` |
| `despacho.frases_supervisor` | `["NAVEGACION LENTA","PON INTERMITENTE","SIN TONO"]` | Frases que no ameritan maniobra en casa | `RepoTecnico/db/schema.sql:784-785` |
| `despacho.columnas_evaluar` | `["problema_reporte","ultimo_comentario","informacion"]` | Columnas donde se buscan las frases | `RepoTecnico/db/schema.sql:786-787` |
| `fallas.activo` | `true` | Detección automática tras la ingesta (RF-09) | `RepoTecnico/db/schema.sql:788` |
| `fallas.umbral_casos` | `5` | Casos mínimos del grupo para declarar falla masiva | `RepoTecnico/db/schema.sql:789` |
| `fallas.ventana_horas` | `24` | Ventana temporal de la concentración | `RepoTecnico/db/schema.sql:790` |
| `fallas.campo_concentracion` | `"olt"` | Campo agrupador: `olt \| fat \| id_sector` | `RepoTecnico/db/schema.sql:791` |
| `outbox.max_intentos` | `5` | Reintentos antes de marcar `FALLIDO` (RNF-20) | `RepoTecnico/db/schema.sql:792` |
| `telegram.webhook_secret` | `""` | Cabecera `X-Telegram-Bot-Api-Secret-Token`; vacío ⇒ sin exigir | `RepoTecnico/db/schema.sql:793` |
| `mcp.api_key` | `""` | Cabecera `X-MCP-Key` del servidor MCP; vacío ⇒ sin exigir | `RepoTecnico/db/schema.sql:794` |
| `seguridad.max_intentos` | `3` | Intentos de login antes del bloqueo | `RepoTecnico/db/schema.sql:795` |
| `seguridad.palabras_seguridad` | `12` | Cantidad de palabras de recuperación | `RepoTecnico/db/schema.sql:796` |

Cómo las consume el código:

- `app/services/fallas.py:55-61` lee `fallas.activo`, `fallas.umbral_casos`,
  `fallas.ventana_horas` y `fallas.campo_concentracion` con valores por defecto internos
  (`UMBRAL_POR_DEFECTO`, `VENTANA_POR_DEFECTO`, `"olt"`).
- `app/services/fallas.py:121-123` obtiene `despacho.destino_telegram` y encola la notificación.
- `app/services/outbox.py:53` lee `outbox.max_intentos` con reserva a
  `MAX_INTENTOS_POR_DEFECTO = 5` (`app/services/outbox.py:18`); el *backoff* es exponencial
  1, 2, 4, 8… minutos con tope de 60 (`app/services/outbox.py:25-27`).
- `app/api/routes_alertas.py:263` compara la cabecera del webhook de Telegram contra
  `telegram.webhook_secret`; `app/api/routes_alertas.py:353` hace lo propio con `mcp.api_key`.
- `app/api/routes_despachos.py:467` resuelve el destino de forma genérica con
  `despacho.destino_<canal>`.

La administración se expone por API: `GET /api/v1/configuracion` lista las claves y
`PUT /api/v1/configuracion/{clave}` actualiza el valor, exigiendo perfil de escritura
(`app/api/routes_config.py:529-549`). La detección de fallas es **idempotente** por
`falla_masiva.clave_concentracion` (por ejemplo `olt:pde-olt-00`): mientras la falla siga activa
no se duplica (`RepoTecnico/entornos_globales.md:204-206`).

> Nota de coherencia: `seguridad.max_intentos` y `seguridad.palabras_seguridad` existen en la
> tabla, pero la autenticación vigente usa `MAX_INTENTOS` y `PALABRAS_SEGURIDAD` de
> `app/core/config.py:31-32`. Cuál de las dos fuentes prevalece es **pendiente de confirmar**.

## Secretos

El proyecto sigue la regla explícita de **no escribir secretos**: los documentos "nunca escriben
secretos, solo se referencian por nombre en Secret Manager"
(`RepoTecnico/entornos_globales.md:12-13`). Este manual respeta esa regla: solo se nombran
secretos, jamás sus valores.

### Secret Manager (ggtov2-db-password, ggto-secret-key, ggtov2-app-secret-key)

| Secreto | Proyecto | Función | Evidencia |
|---|---|---|---|
| `ggtov2-db-password` | `truekeate-main` | Contraseña del usuario `ggtov2_app` | `RepoTecnico/entornos_globales.md:74`; creado por `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:26-35` |
| `ggtov2-db-connection` | `truekeate-main` | Nombre de conexión de la instancia | `RepoTecnico/entornos_globales.md:75`; creado por `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:38-46` |
| `ggto-secret-key` | `truekeate-main` | Clave de firma de JWT usada por el servicio desplegado | `RepoTecnico/entornos_globales.md:322` |
| `ggtov2-app-secret-key` | `ggtov2` (previsto) | Clave de firma prevista para el proyecto GGTOv2 | `RepoTecnico/scripts/04_secretos_kms.sh:45`; referenciada por `RepoTecnico/scripts/07_cloudrun_web.sh:20` |

El script de secretos planificado crea, además, `ggtov2-db-root-password` y
`ggtov2-django-secret-key` y otorga `roles/secretmanager.secretAccessor` a las cuentas de
servicio (`RepoTecnico/scripts/04_secretos_kms.sh:43-50`). El inventario de pendientes del
proyecto los lista como tareas del aprovisionamiento de `ggtov2`
(`RepoTecnico/GGTOv2_GCP.md:577`).

La cuenta de servicio de ejecución del servicio real
`ggto-web-sa@truekeate-main.iam.gserviceaccount.com` tiene `roles/cloudsql.client` y
`roles/secretmanager.secretAccessor` sobre `ggtov2-db-password` y `ggto-secret-key`
(`RepoTecnico/entornos_globales.md:322`). El acceso a los secretos se concede de forma explícita
por nombre: `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:49-53` recorre `ggtov2-db-password` y
`ggtov2-db-connection` y fija la política con las cuentas autorizadas.

### nunca en git

El `.gitignore` del repositorio protege la configuración sensible desde la primera sección
("Entornos y secretos"): ignora `.env`, `.env.*`, `*.pem`, `*.key`, `credentials*.json` y
`*-sa.json` (`.gitignore:1-7`), dejando como única excepción versionable `.env.example`.

Además, el repositorio ignora explícitamente los datos de ingesta reales con PII de
suscriptores CANTV: `detalle_averias_gpon*.csv`, `RepoTecnico/entrada/`, `RepoTecnico/salida/`,
`RepoTecnico/evidencias/` y `*.zip` (`.gitignore:40-46`), con la salvedad de que las muestras
pseudonimizadas de `RepoTecnico/muestras/*.csv` **sí** se versionan con fines de prueba
(`.gitignore:48-49`). También se ignoran `RepoTecnico/credenciales/` y los archivos
`*credenciales*.md` (`.gitignore:51-54`).

Esta política responde al hallazgo **H-01**: un CSV real con PII (nombre, teléfono, dirección,
serial, IP) llegó a estar versionado en git y quedó fuera de `.gitignore`; se corrigió retirando
el archivo del índice, purgando el historial y pseudonimizando la muestra
(`RepoTecnico/estado_proyecto.md:205`, `:249`, decisión **QW-1** en `:88`).

### rotacion

Existe un precedente documentado de rotación de credenciales. Durante una verificación, un
mensaje de error de Node imprimió la contraseña del usuario `app` de TrueKeate contenida en el
secreto `DATABASE_URL`; la respuesta fue (`RepoTecnico/entornos_globales.md:100-106`):

#### Procedimiento observado

1. `ALTER ROLE app PASSWORD '<nueva>'` con 32 caracteres aleatorios.
2. Publicación de una nueva versión del secreto (`versions/3`) en `truekeate-main`.
3. Nueva revisión de Cloud Run `truekeate-api-00034-hvk` para tomar el valor `latest`, que
   quedó `Ready`, con el 100 % del tráfico y sin errores de autenticación en los logs.

El procedimiento reutilizable que se desprende es: generar la credencial, publicar una versión
nueva del secreto, redesplegar para que la referencia `latest` se materialice y verificar en los
logs. Para el caso de GGTO, la generación de la contraseña la hace el script con 32 caracteres
aleatorios sin imprimirla (`RepoTecnico/scripts/10_usar_instancia_truekeate.sh:23,95`).

#### Periodicidad y gobierno

Están **pendientes de confirmar**: la periodicidad formal de rotación para los secretos de GGTO,
el responsable asignado y si Cloud KMS `ggtov2-secrets` con rotación a 90 días —hoy descrito como
"script listo" y no aplicado— llegará a gobernar estos secretos
(`RepoTecnico/GGTOv2_GCP.md:401`).

## Modo de pruebas DB_SCHEMA (app/core/db.py:16-36)

La función `build_url()` (`app/core/db.py:16-36`) construye la cadena de conexión y es el punto
donde se materializa el aislamiento de pruebas:

1. Escapa usuario y contraseña con `quote_plus` para tolerar caracteres especiales
   (`app/core/db.py:24-25`).
2. Si `DB_HOST` empieza por `/`, genera una URL sin puerto y pasa el host como parámetro de
   consulta `host=`, que es la forma que espera el socket Unix de Cloud SQL
   (`app/core/db.py:26-29`).
3. En caso contrario, arma una URL TCP con `host:puerto` y añade `sslmode` según `DB_SSLMODE`
   (`app/core/db.py:30-32`).
4. Si `DB_SCHEMA` tiene valor, añade
   `options=-csearch_path=<esquema>,public` (`app/core/db.py:33-35`). El comentario del propio
   código explica por qué se conserva `public`: resolver las extensiones `pgcrypto` y `pg_trgm`
   (`app/core/db.py:34`).

El motor se crea una sola vez al importar el módulo, con `pool_pre_ping=True`, `pool_size=5` y
`max_overflow=5` (`app/core/db.py:39`); la dependencia `get_db()` entrega una sesión por petición
y la cierra siempre en el bloque `finally` (`app/core/db.py:43-49`).

Uso operativo del modo de pruebas:

| Escenario | `DB_SCHEMA` | Efecto |
|---|---|---|
| Producción | vacío | `search_path` por defecto del rol |
| `pytest` | `ggto_test` | Todo el DDL de `db/schema.sql` se crea en el esquema aislado (`app/tests/conftest.py:6`) |
| Playwright E2E | `ggto_e2e` | `run_e2e.sh` exporta el esquema y siembra datos con `seed_e2e.py` (`RepoTecnico/pruebas/run_e2e.sh:14,21,48`) |

El aislamiento fue una corrección formal de la Fase 4 (hallazgo **F4-01**): antes, las pruebas no
podían separarse de producción porque `app/core/db.py` construía la URL sin `search_path`; se
añadió `DB_SCHEMA` de forma retrocompatible y se cubrió con pruebas unitarias en
`app/tests/test_config_db.py` (`RepoTecnico/pruebas/informe_fase4.md:36`). La suite resultante
cerró con **169/169 pytest** y **46/46 E2E Playwright** (`RepoTecnico/pruebas/informe_fase4.md:16-18`).
Para las pruebas E2E también se elevó `RATE_LIMIT_INTENTOS` a 10 000 y se fijó `SECRET_KEY` de
prueba, evitando que el limitador de RNF-22 produjera `429`
(`RepoTecnico/pruebas/run_e2e.sh:22-23`, hallazgo F4-05 en `RepoTecnico/pruebas/informe_fase4.md:53`).

## Pendientes de entorno (entornos_globales.md:272-282)

El documento de entornos enumera seis pendientes (`RepoTecnico/entornos_globales.md:272-282`).
Su estado se contrasta así:

| # | Pendiente | Estado y evidencia |
|---|---|---|
| 1 | Repositorios remotos publicados | ✅ Resuelto: GitHub y GitLab con la rama `GGTOv2-DSH-GCP` (`entornos_globales.md:274,255-262`) |
| 2 | Crear `.env.ggto` propio del proyecto | ⏳ Pendiente: hoy solo existe el `.env.global` de MCC (`entornos_globales.md:275,45-47`) |
| 3 | Cliente PostgreSQL `psql` y/o dependencias `psycopg2`/`asyncpg` | ⏳ Parcial: `psycopg2-binary` está en `app/requirements.txt:4`; `run_e2e.sh` busca `psql` en `$HOME/bin/psql` con reserva al `PATH` (`RepoTecnico/pruebas/run_e2e.sh:44-46`) |
| 4 | Liberar cupo de facturación GCP | ❌ Pendiente: `billingEnabled: false` por cupo de 5 proyectos agotado (`entornos_globales.md:277-278,364`) |
| 5 | Credenciales de mensajería (Telegram, correo, MCP) | ❌ Pendiente: sin ellas el *outbox* deja las notificaciones en `PENDIENTE` (`entornos_globales.md:279-280,189-191`) |
| 6 | Backups/PITR/protección de borrado antes de datos reales | ❌ Pendiente: riesgo aceptado **D-26** (`RepoTecnico/entornos_globales.md:281`; `RepoTecnico/estado_proyecto.md:90`) |

Observaciones adicionales sobre el inventario:

- El stack previsto menciona `asyncpg` (`RepoTecnico/entornos_globales.md:239`), pero la
  implementación real usa `psycopg2-binary` (`app/core/db.py:1-2`, `app/requirements.txt:4`). La
  adopción de `asyncpg` es **pendiente de confirmar**.
- El pendiente 6 es el más crítico: hay **datos reales en producción** (un lote con 42 casos y
  PII de suscriptores) sobre una instancia sin respaldo y con el servicio público
  (`RepoTecnico/entornos_globales.md:351-354`). El riesgo **D-26** obliga a no seguir cargando
  datos reales hasta migrar a `ggtov2-pg` con backups, PITR y SSL
  (`RepoTecnico/estado_proyecto.md:90`).
- La rotación del `.env.global` hacia un `.env.ggto` no cambia los nombres de secretos ya
  desplegados; cualquier cambio de nombres debe coordinar Secret Manager, IAM y la revisión de
  Cloud Run para evitar cortes de servicio.
