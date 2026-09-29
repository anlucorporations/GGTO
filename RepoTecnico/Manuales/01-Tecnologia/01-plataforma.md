# Plataforma GGTO — Visión general y arquitectura

> Manual técnico de la plataforma **GGTO** (Sistema de administración de reportes de avería y
> construcción de puntos ópticos) de **CANTV C.A., Central Francisco Salias (Área 4)**.
> Todas las afirmaciones de este documento se respaldan con referencias `ruta:línea` verificadas
> sobre el código y la documentación del repositorio. Lo que no pudo comprobarse se indica como
> **pendiente de confirmar**.

## Visión general del sistema

### Propósito y alcance

GGTO es una plataforma web que administra el ciclo completo del reporte de avería GPON y de la
solicitud de construcción de puntos ópticos de la Central Francisco Salias. El propósito declarado
del backend está escrito en el encabezado del programa principal: *«GGTO API — Sistema de
administración de reportes de avería y puntos ópticos. CANTV C.A. — Central Francisco Salias
(Área 4)»* (`app/main.py:1-3`).

El alcance funcional de la primera versión abarca los ciclos 1 a 7 y el ciclo 9, según el propio
docstring de `app/main.py:4-5`: autenticación (P00 + clave, bloqueo y 12 palabras), configuración,
ingesta del CSV diario, PANEL/CASOS, DESPACHO, casos especiales y agenda, MONITOREO/REPORTES y
ALERTAS/Telegram/MCP.

El sistema se apoya en un conjunto de requerimientos formales: **38 RF, 25 RNF y 14 RT**
(`RepoTecnico/requerimientos.md:1-15`). La visión general del documento de requerimientos enumera
seis objetivos operativos, entre ellos ingestar diariamente el archivo matriz
`detalle_averias_gpon_<fecha>.csv`, administrar personal y cuadrillas, generar rutas/sectores,
dar seguimiento a casos especiales y producir reportes de gestión
(`RepoTecnico/requerimientos.md:22-35`).

| Aspecto | Definición verificada | Referencia |
|---|---|---|
| Nombre del producto | GGTO | `app/main.py:1` |
| Cliente | CANTV C.A. | `app/main.py:3` |
| Central objetivo de la v1 | Francisco Salias (Área 4) | `app/main.py:3` |
| Nombre técnico del servicio | `GGTO API` (`app_name`) | `app/core/config.py:12` |
| Versión de la aplicación | `0.9.0` (`app_version`) | `app/core/config.py:14` |
| Entorno por defecto | `development` (`app_env`) | `app/core/config.py:13` |
| Zona horaria | `America/Caracas` | `app/core/config.py:15` |

El alcance **excluye** explícitamente, en el estado actual del repositorio, la aplicación móvil
Flutter (diferida) y la integración con WhatsApp (reservada para la v3). La mensajería de la v1 se
limita a Telegram, correo SMTP y MCP (`RepoTecnico/estado_proyecto.md:76,92`). Cualquier consulta
sobre la APK Android debe remitirse al ciclo 8, hoy **pendiente de confirmar** en cuanto a fecha.

### Actores y roles

Los actores del sistema están definidos en `RepoTecnico/requerimientos.md:44-56` con identificadores
`ACT-01` a `ACT-06`. La tabla siguiente los resume junto con el canal que declara el documento.

| ID | Actor | Canal declarado |
|---|---|---|
| ACT-01 | Supervisor de la central | Web PC / App móvil |
| ACT-02 | Técnico de campo | App Android / Web móvil / Telegram |
| ACT-03 | Personal externo solicitante | Telegram / WEB-MCP (IA) |
| ACT-04 | Administrador del sistema | Web PC |
| ACT-05 | Sistema (automático) | Backend |
| ACT-06 | Integración IA (WEB-MCP) | MCP sobre web |

En el plano de la autorización, los roles reales de la v1 son **SUPER, ADMIN, SUPERVISOR y TECNICO**
(`RepoTecnico/requerimientos.md:229-231`). La matriz RBAC completa está en
`RepoTecnico/requerimientos.md:236-253` y distingue lectura de escritura por módulo.

El rol `SUPER` (Super Usuario) merece una nota aparte: **no se enumera en cada endpoint**, sino que
`require_roles` le concede cualquier operación mediante una comparación directa. La constante está
declarada en `app/api/deps.py:20` (`ROL_SUPER = "SUPER"`) y la comprobación se ejecuta en
`app/api/deps.py:65` (`if usuario.rol.codigo == ROL_SUPER or usuario.rol.codigo in roles: return
usuario`). El efecto práctico es un bypass permanente que cubre también las secciones futuras, tal
como documenta la decisión D-50 (`RepoTecnico/estado_proyecto.md:114`).

El rechazo de la autorización usa dos códigos diferenciados:

- Credenciales inválidas o token expirado → **401** (`app/api/deps.py:22-26`).
- Usuario bloqueado → **423 Locked** (`app/api/deps.py:47-48`).

Los actores externos (responsable de protección de datos del lado CANTV y dueño del sistema origen
que entrega el CSV) están registrados como **pendientes de designar**
(`RepoTecnico/requerimientos.md:270-272`).

### Secciones de la plataforma

La interfaz se compone de una pantalla de acceso y un conjunto de rutas protegidas. El enrutador
declara `/login` como única ruta pública y agrupa el resto bajo `RutaProtegida` y `Layout`
(`app/web/src/App.tsx:22-48`). Las rutas reales son:

| Ruta | Componente | Sección |
|---|---|---|
| `/login` | `Login` | Acceso |
| `/` (index) | `Panel` | PANEL |
| `/ingesta` | `Ingesta` | INGESTA |
| `/casos` | `Casos` | CASOS |
| `/despacho` | `Despacho` | DESPACHO |
| `/especiales` | `Especiales` | ESPECIALES (empresas y referidos) |
| `/agenda` | `Agenda` | AGENDA |
| `/monitoreo` | `Monitoreo` | MONITOREO y GRÁFICOS |
| `/alertas` | `Alertas` | ALERTAS |
| `/central` | `Centrales` | CONFIGURACIÓN · Central |
| `/sectores` | `Sectores` | CONFIGURACIÓN · Sectores |
| `/tecnicos` | `Tecnicos` | CONFIGURACIÓN · Técnicos |
| `/flota` | `Flota` | CONFIGURACIÓN · Flota |
| `/cuadrillas` | `Cuadrillas` | CONFIGURACIÓN · Cuadrillas |
| `/catalogos` | `Catalogos` | CONFIGURACIÓN · Catálogos |
| `/parametros` | `Parametros` | CONFIGURACIÓN · Parámetros |
| `*` | `Navigate to="/"` | Redirección de rutas desconocidas |

Cada ruta del listado anterior corresponde a una línea concreta de `app/web/src/App.tsx:24-46`. La
pantalla de acceso (`app/web/src/pages/Login.tsx`) ofrece, además del inicio de sesión, el
**desbloqueo con 3 palabras** y el flujo de **primer acceso** (D-67): comprueba el P00 con
`GET /api/v1/auth/primer-acceso`, crea la cuenta con `POST /api/v1/auth/setup` y muestra las
12 palabras una sola vez (`app/web/src/pages/Login.tsx:34-45,118-177,287-381`). La
barra superior no muestra las secciones de configuración a todos los roles: el componente
`MenuConfiguracion` se pinta solo si el rol del usuario está en `ROLES_CONFIG`, definido como
`['SUPER', 'ADMIN', 'SUPERVISOR']` (`app/web/src/components/Layout.tsx:53`) y evaluado en
`app/web/src/components/Layout.tsx:170` (`puedeConfigurar`).

Los módulos transversales que no tienen una sección propia pero atraviesan la plataforma
(INGESTA, GESTIÓN AUTOMATIZADA, GESTIÓN TÉCNICA, ALERTAS, SEGURIDAD, INSUMOS v2 y REPORTES) están
descritos en `RepoTecnico/requerimientos.md:73-83`.

## Arquitectura de componentes

### Backend FastAPI

El backend es una aplicación **FastAPI** construida en `app/main.py`. La instancia se crea con
`FastAPI(title=settings.app_name, version=settings.app_version, description=...)`
(`app/main.py:38-47`), de modo que el título y la versión expuestos en OpenAPI provienen de la
configuración (`app/core/config.py:12-14`).

Los routers se importan de forma agrupada desde `app.api` (`app/main.py:19-29`) y se registran
mediante `include_router` en un bloque único (`app/main.py:77-85`). Los diez módulos de rutas son
`routes_health`, `routes_auth`, `routes_config`, `routes_ingesta`, `routes_casos`,
`routes_despachos`, `routes_especiales`, `routes_monitoreo` y `routes_alertas`.

El inventario de endpoints verificado reporta **109 decoradores `@router.*`** en el código; el
esquema OpenAPI publicado (`app.openapi()`) expone **79 rutas (paths)** y **109 operaciones**
(método + path), porque varios paths comparten `GET`/`POST`/`PATCH`. Los documentos y las pruebas de
contrato hablaban de **77 endpoints** en el sentido de 77 paths (superficie anterior a D-67). El
desglose funcional y por archivo corresponde al manual `03-Implementacion/09-api-endpoints.md`.

| Módulo de rutas | Prefijo | Operaciones | Archivo |
|---|---|---|---|
| `routes_health` | sin prefijo (`/health`, `/ready`) | 4 | `app/api/routes_health.py` |
| `routes_auth` | `/api/v1/auth` | 7 | `app/api/routes_auth.py` |
| `routes_config` | `/api/v1` | 35 | `app/api/routes_config.py` |
| `routes_ingesta` | `/api/v1/ingesta` | 5 | `app/api/routes_ingesta.py` |
| `routes_casos` | `/api/v1/casos` | 6 | `app/api/routes_casos.py` |
| `routes_despachos` | `/api/v1/despachos` | 18 | `app/api/routes_despachos.py` |
| `routes_especiales` | `/api/v1` | 14 | `app/api/routes_especiales.py` |
| `routes_monitoreo` | `/api/v1` | 9 | `app/api/routes_monitoreo.py` |
| `routes_alertas` | `/api/v1` | 11 | `app/api/routes_alertas.py` |

Los prefijos se declaran en la construcción del router de cada archivo. Por ejemplo,
`routes_casos.py` fija `APIRouter(prefix="/api/v1/casos", tags=["casos"])`
(`app/api/routes_casos.py:24`), `routes_ingesta.py` fija `/api/v1/ingesta`
(`app/api/routes_ingesta.py:21`) y `routes_monitoreo.py` usa el prefijo general `/api/v1`
(`app/api/routes_monitoreo.py:17`). El archivo `routes_health.py` no define prefijo
(`app/api/routes_health.py:14`) y por eso expone `/health` y `/ready` en la raíz del servicio
(`app/api/routes_health.py:28,34`).

### SPA React servida por el mismo contenedor

La interfaz web es una **SPA React** compilada por Vite y servida por el **mismo proceso FastAPI**.
El montaje se realiza al final del módulo, con un comentario que explica la razón: *«Web de
administración (SPA React). Se monta al final para no tapar la API»* (`app/main.py:88-90`).

La pieza clave es la clase `SPAStaticFiles`, subclase de `StaticFiles`, que captura el `404` y
devuelve `index.html` para que React Router resuelva los *deep links* del lado del cliente
(`app/main.py:91-100`). El directorio se calcula como `app/web/dist` en tiempo de importación y solo
se monta si existe (`app/main.py:103-105`). Esto significa que en un despliegue sin el *build* de la
SPA el servicio funciona como API pura, sin romper el arranque.

La consecuencia arquitectónica es relevante para operaciones: **frontend y backend comparten
origen**, por lo que la SPA no necesita configurar un host de API ni lidiar con CORS en producción.
El cliente HTTP confirma esta decisión: `API_BASE = '/api/v1'` es una ruta relativa
(`app/web/src/api/client.ts:93`) y el comentario del encabezado indica que *«todas las llamadas van a
`/api/v1` (Vite lo reenvía en dev)»* (`app/web/src/api/client.ts:4`). En desarrollo, Vite actúa como
proxy hacia `http://localhost:8000` (`app/web/vite.config.ts:8-15`).

### Base de datos PostgreSQL

La capa de datos vive en `app/core/db.py` y usa **SQLAlchemy 2.x con el dialecto `psycopg2`**. La
función `build_url()` construye la cadena de conexión con tres modalidades (`app/core/db.py:16-36`):

1. **Socket Unix de Cloud SQL**: si `DB_HOST` empieza por `/`, la URL omite host y puerto y el socket
   se pasa como parámetro `host` (`app/core/db.py:26-29`).
2. **TCP normal**: URL con host y puerto explícitos más el parámetro `sslmode`
   (`app/core/db.py:30-32`).
3. **Esquema alternativo**: si `DB_SCHEMA` no está vacío, se añade
   `options=-csearch_path=<esquema>,public` (`app/core/db.py:33-36`). El comentario del código
   aclara que `public` se mantiene para resolver las extensiones `pgcrypto` y `pg_trgm`.

El motor se crea con `pool_pre_ping=True`, `pool_size=5`, `max_overflow=5` y `future=True`
(`app/core/db.py:39`). La sesión por petición se entrega mediante la dependencia `get_db()`, que
abre una `Session` y la cierra en el bloque `finally` (`app/core/db.py:43-49`).

| Dato de conexión | Valor por defecto | Referencia |
|---|---|---|
| `DB_HOST` | `localhost` | `app/core/config.py:18` |
| `DB_PORT` | `5432` | `app/core/config.py:19` |
| `DB_NAME` | `ggtov2` | `app/core/config.py:20` |
| `DB_USER` | `ggtov2_app` | `app/core/config.py:21` |
| `DB_PASSWORD` | vacío (se inyecta por entorno) | `app/core/config.py:22` |
| `DB_SSLMODE` | `prefer` | `app/core/config.py:23` |
| `DB_SCHEMA` | vacío (esquema por defecto) | `app/core/config.py:25` |

El esquema físico consta de **36 tablas** (35 tras la verificación inicial registrada en
`RepoTecnico/entornos_globales.md:303`, más `cuadrilla_sector_dia` del ciclo D-66). El detalle de las entidades corresponde a los
manuales `05-Diccionario-de-Datos/01-entidades.md` y `06-Diagrama-Relacional/01-diagrama-er.md`.

El estado de la base en producción es el siguiente (`RepoTecnico/entornos_globales.md:291-309`):

| Comprobación | Resultado |
|---|---|
| Instancia | `truekeate-main:southamerica-east1:truekeate-db-dev` (PostgreSQL 15.18) |
| Base | `ggtov2` |
| Extensiones | `pgcrypto 1.3`, `pg_trgm 1.6` |
| RLS | `caso` y `despacho` con `relrowsecurity` y `relforcerowsecurity`; 2 políticas |
| Triggers `actualizado_en` | 14 |
| Índices trigram | 2 (`caso.direccion`, `sector_direccion.patron`) |
| Semillas | 3 roles, 1 central, 1 cuadrilla, 9 métodos, 13 parámetros, 0 causas |

### Canales externos (Telegram, correo SMTP, MCP)

Los canales de notificación de la v1 son **Telegram, correo SMTP y MCP**. WhatsApp **no existe** en
el sistema: fue retirado de los requerimientos por la decisión D-28 y reservado para la v3
(`RepoTecnico/estado_proyecto.md:92`).

La capa de canales se materializa en `app/services/notificaciones.py` (composición de mensajes) y
`app/services/outbox.py` (bandeja con reintentos), y se expone a través de las operaciones
`POST /api/v1/notificaciones/procesar` y `POST /api/v1/telegram/webhook`, ambas en
`app/api/routes_alertas.py:186` y `app/api/routes_alertas.py:256` respectivamente. El canal MCP se
expone como `POST /api/v1/mcp` (`app/api/routes_alertas.py:346`), que implementa un servidor
JSON-RPC.

Es importante no prometer un funcionamiento que no está habilitado: **Telegram y el correo aún no
tienen credenciales en producción**, por lo que los envíos quedan en estado **PENDIENTE** dentro de
la bandeja y adoptan el patrón *outbox*. La decisión D-52 lo registra expresamente al describir el
cierre del ciclo 5 (`RepoTecnico/estado_proyecto.md:123`, *«queda `PENDIENTE` sin credenciales, que
llegan en el Ciclo 9»*) y la D-61 lo confirma sobre datos reales
(`RepoTecnico/estado_proyecto.md:125`, *«Telegram y correo siguen sin credenciales
(`canales_configurados=false`)»*).

Los parámetros que gobiernan los canales y la detección de fallas viven en la tabla
`configuracion` como JSONB, no en el entorno (`RepoTecnico/entornos_globales.md:187-206`):

| Clave | Valor inicial verificado | Referencia |
|---|---|---|
| `fallas.activo` | `true` | `RepoTecnico/entornos_globales.md:195` |
| `fallas.umbral_casos` | `5` | `RepoTecnico/entornos_globales.md:196` |
| `fallas.ventana_horas` | `24` | `RepoTecnico/entornos_globales.md:197` |
| `fallas.campo_concentracion` | `"olt"` (`olt` \| `fat` \| `id_sector`) | `RepoTecnico/entornos_globales.md:198` |
| `despacho.destino_telegram` | `""` (vacío ⇒ PENDIENTE) | `RepoTecnico/entornos_globales.md:199` |
| `outbox.max_intentos` | `5` (backoff 1,2,4,8… min, tope 60) | `RepoTecnico/entornos_globales.md:200` |
| `telegram.webhook_secret` | `""` (cabecera `X-Telegram-Bot-Api-Secret-Token`) | `RepoTecnico/entornos_globales.md:201` |
| `mcp.api_key` | `""` (cabecera `X-MCP-Key`) | `RepoTecnico/entornos_globales.md:202` |

La detección de fallas es **idempotente** por `falla_masiva.clave_concentracion`
(p. ej. `olt:pde-olt-00`): mientras la falla siga activa (`DETECTADA`/`PLANIFICADA`) no se
duplica; se ejecuta tras cada ingesta y bajo demanda con `POST /api/v1/fallas-masivas/detectar`
(`RepoTecnico/entornos_globales.md:204-206`).

Los **nombres** de los secretos previstos en Secret Manager se listan en la configuración de
entornos (`RepoTecnico/entornos_globales.md:165-176`): `SECRET_KEY`, `DB_PASSWORD`,
`TELEGRAM_BOT_TOKEN`, `SMTP_HOST`, `SMTP_PASSWORD` y `MCP_API_KEY`. Sus **valores** no se
documentan aquí ni en ningún manual del repositorio.

## Flujo de una operacion tipica (peticion -> middleware -> router -> servicio -> BD)

El recorrido de una petición autenticada sigue una secuencia estable que conviene conocer para
diagnosticar incidentes. Se describe a continuación el caso de un listado de casos.

1. **Entrada y observabilidad.** Toda petición atraviesa `ObservabilidadMiddleware`, que asigna un
   `X-Request-ID` (el recibido o uno nuevo de 12 caracteres hexadecimales), mide la duración con
   `time.perf_counter()` y registra una línea al finalizar (`app/main.py:49-65`). El middleware se
   registra antes que CORS, de modo que el identificador está disponible en todas las respuestas
   (`app/main.py:68`).
2. **CORS.** El `CORSMiddleware` aplica los orígenes de `settings.cors_origin_list`, permite
   credenciales, y acepta cualquier método y cabecera (`app/main.py:69-75`).
3. **Router.** FastAPI resuelve la ruta contra el router incluido. Para un listado de casos la
   operación es `GET /api/v1/casos` (`app/api/routes_casos.py:89`), dentro del router con prefijo
   `/api/v1/casos` (`app/api/routes_casos.py:24`).
4. **Dependencias.** La firma del manejador inyecta la sesión y el usuario:
   `db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)`
   (`app/api/routes_casos.py:91-92`). Las dependencias se resuelven antes de ejecutar el cuerpo.
   `get_current_user` valida el `Bearer`, decodifica el JWT, busca al usuario por `p00` y verifica
   `activo` y `bloqueado` (`app/api/deps.py:29-49`).
5. **Validación de entrada.** Los parámetros de consulta se declaran con `Query` y con tipos
   opcionales; por ejemplo el texto libre `q` se describe como *«Texto libre: avería, teléfono,
   cliente o dirección»* (`app/api/routes_casos.py:93`). La validación estructural recae en Pydantic
   v2 y ocurre antes del cuerpo del manejador.
6. **Servicio.** El manejador delega las reglas transversales en `app/services`. En `routes_casos.py`
   se usan `cargar_config`, `cargar_patrones` y `resolver_central` para la configuración, y
   `asignar_sector` para la sectorización (`app/api/routes_casos.py:20-21`, aplicado en
   `app/api/routes_casos.py:52-53`).
7. **Acceso a datos.** El servicio o el propio manejador emiten sentencias SQLAlchemy 2.x
   (`select`, `func`, `or_`, `text`) sobre la sesión inyectada (`app/api/routes_casos.py:8`). El
   enriquecimiento del listado con nombre de sector e iconos de estado se hace en `_resumen()`, que
   calcula conjuntos de `pendientes`, `asignados`, `citados` y `gestion` y los añade al modelo de
   salida (`app/api/routes_casos.py:56-83`).
8. **Serialización.** La respuesta se valida contra el esquema Pydantic declarado en
   `response_model` (`app/api/routes_casos.py:89`, con `PaginaCasos`).
9. **Salida.** El middleware añade la cabecera `X-Request-ID` y registra el código y la duración
   (`app/main.py:62-64`).

Para operaciones de escritura el patrón agrega un paso de autorización antes del servicio. En
`routes_casos.py` la dependencia de escritura se construye una sola vez en el módulo:
`_escritura = require_roles("ADMIN", "SUPERVISOR")` (`app/api/routes_casos.py:26`). El mismo patrón
se repite en `app/api/routes_ingesta.py:23`. La validación de negocio devuelve códigos HTTP explícitos
(404 con `_o_404`, `app/api/routes_casos.py:29-33`; 409 de solapamiento de citas según
`RepoTecnico/estado_proyecto.md:120`).

El diagrama textual del flujo queda así:

```
Cliente SPA  →  HTTPS  →  ObservabilidadMiddleware (X-Request-ID)
            →  CORSMiddleware (orígenes permitidos)
            →  FastAPI router (app/api/routes_*.py)
            →  Dependencias (get_db, get_current_user, require_roles)
            →  Servicio (app/services/*.py)
            →  SQLAlchemy 2.x  →  PostgreSQL (Cloud SQL)
            →  response_model (Pydantic v2)  →  JSON / HTML
```

## Despliegue en GCP

### Proyecto ggtov2 y bloqueo de facturacion

El proyecto GCP objetivo del sistema es **`ggtov2`**, pero su facturación está deshabilitada. El
documento de entornos lo registra con tres comprobaciones en
`RepoTecnico/entornos_globales.md:360-366`: `billingEnabled: false` por cupo de 5 proyectos agotado,
APIs de despliegue no habilitables sin facturación (`run`, `artifactregistry`, `cloudbuild`,
`secretmanager`) y ausencia de Cloud Run y Artifact Registry propios.

El plan al desbloquearse la facturación está descrito en `RepoTecnico/entornos_globales.md:368-369`:
migrar el servicio a `ggtov2` con el script `scripts/07_cloudrun_web.sh` y su propio Cloud SQL
`ggtov2-pg` con configuración REGIONAL, SSL `ENCRYPTED_ONLY` y backups con PITR.

Mientras esa condición persista, el despliegue vive en un proyecto **distinto** al objetivo. Este es
un hecho central para la operación y debe explicarse a cualquier nuevo integrante.

### Servicio Cloud Run ggto-web en truekeate-main

El servicio se aloja temporalmente en el proyecto **`truekeate-main`**, que sí tiene facturación
habilitada (`RepoTecnico/entornos_globales.md:311-314`).

| Dato | Valor | Referencia |
|---|---|---|
| Servicio | Cloud Run `ggto-web` en `truekeate-main` | `RepoTecnico/entornos_globales.md:318` |
| Región | `europe-west1` | `RepoTecnico/entornos_globales.md:318` |
| URL principal | `https://ggto-web-593453426217.europe-west1.run.app` | `RepoTecnico/entornos_globales.md:319` |
| URL alternativa | `https://ggto-web-m33mjctj4a-ew.a.run.app` | `RepoTecnico/entornos_globales.md:319` |
| SA de ejecución | `ggto-web-sa@truekeate-main.iam.gserviceaccount.com` | `RepoTecnico/entornos_globales.md:322` |
| Imagen (última documentada) | `southamerica-east1-docker.pkg.dev/truekeate-main/truekeate-repo/ggto-web:v14` | `RepoTecnico/estado_proyecto.md:124` |
| Revisión (última documentada) | `ggto-web-00014-zqx` | `RepoTecnico/estado_proyecto.md:124` |

La cuenta de servicio tiene los roles `cloudsql.client` y `secretmanager.secretAccessor` sobre los
secretos `ggtov2-db-password` y `ggto-secret-key` (`RepoTecnico/entornos_globales.md:322`). La
imagen es **multi-etapa**: Node compila la SPA y Python la sirve
(`RepoTecnico/entornos_globales.md:321`).

Las revisiones desplegadas están registradas de forma incremental en las decisiones del proyecto;
la tabla siguiente reconstruye la secuencia documentada (`RepoTecnico/estado_proyecto.md:108-124`).
Es una línea de tiempo **histórica**: la revisión vigente es la última que confirme el operador y
cualquier otra debe considerarse **pendiente de confirmar** en el momento de la consulta.

| Revisión | Imagen | Hito |
|---|---|---|
| `ggto-web-00002-rbl` | `v2` | Ciclo 1 — núcleo y autenticación |
| `ggto-web-00003-6zb` | `v3` | Ciclo 2 — configuración |
| `ggto-web-00004-cj9` | `v4` | Ciclo 3 — ingesta CSV |
| `ggto-web-00005-rxm` | `v5` | Ciclo 4 — PANEL y CASOS |
| `ggto-web-00006-htl` | `v6` | Super Usuario con acceso total |
| `ggto-web-00007-vsr` | `v7` | Ciclo 5 — DESPACHO |
| `ggto-web-00008-vr5` | `v8` | Ciclo 6 — especiales y agenda |
| `ggto-web-00009-fvc` | `v9` | Ciclo 7 — MONITOREO y REPORTES |
| `ggto-web-00014-zqx` | `v14` | Ciclo 9 — ALERTAS, Telegram y MCP |

> Nota: entre la imagen `v9` y la `v14` el historial documentado incluye hitos intermedios (por
> ejemplo, la revisión `ggto-web-00012-lbl`/imagen `v12` del rediseño de navegación D-57, con
> `ggto-web-00013-9pf`/`v13` como revisión siguiente en `RepoTecnico/entornos_globales.md:320`).
> La revisión vigente en el momento de leer este manual es **pendiente de confirmar** contra
> `gcloud run services describe ggto-web`.

Los *scripts* de aprovisionamiento viven en `RepoTecnico/scripts/` y se ejecutan en orden del `00` al
`10`, con `provision_all.sh` como orquestador y `lib_gcp.sh` como biblioteca común. La tabla de
scripts documentada incluye `07_cloudrun_web.sh` para el servicio Cloud Run y
`10_usar_instancia_truekeate.sh` para la base y el usuario `ggtov2`
(`RepoTecnico/entornos_globales.md:111-126`). El manual `04-Despliegue/03-scripts-gcp.md` desarrolla
esta materia.

### Cloud SQL compartida truekeate-db-dev

La base de datos del sistema vive en una instancia **compartida** con otro producto, TrueKeate. La
instancia es `truekeate-main:southamerica-east1:truekeate-db-dev`, con PostgreSQL 15.18, base
`ggtov2` y usuario `ggtov2_app` (`RepoTecnico/entornos_globales.md:293-295`).

La conexión que usa la aplicación en Cloud Run se declara así
(`RepoTecnico/entornos_globales.md:373-380`):

```dotenv
DB_HOST=/cloudsql/truekeate-main:southamerica-east1:truekeate-db-dev
DB_PORT=5432
DB_NAME=ggtov2
DB_USER=ggtov2_app
DB_PASSWORD=<Secret Manager: truekeate-main/ggtov2-db-password>
DB_SSLMODE=require
```

La instancia se monta en Cloud Run con el modificador
`--add-cloudsql-instances=truekeate-main:southamerica-east1:truekeate-db-dev`
(`RepoTecnico/entornos_globales.md:382-384`). La forma del `DB_HOST` —una ruta Unix— es precisamente
la que `build_url()` detecta para construir la URL sin host ni puerto (`app/core/db.py:26-29`), de
modo que la configuración documentada y el código están alineados.

Para el modo de pruebas, `DB_SCHEMA` añade `search_path` y permite usar esquemas aislados
(`app/core/db.py:33-36`). Los esquemas empleados son `ggto_test` (pytest) y `ggto_e2e` (Playwright),
manteniendo `public` para resolver las extensiones. Nunca se apunta a producción en pruebas
(`RepoTecnico/estado_proyecto.md:126`).

### Pendientes y riesgos (D-26, acceso publico con PII)

Existen dos riesgos abiertos que todo operador debe conocer antes de cargar datos.

**Riesgo D-26 — instancia sin backups ni SSL obligatorio.** La decisión D-26 está registrada como
*riesgo aceptado*: no se modifican los backups, el PITR ni el SSL de `truekeate-db-dev` por ser una
instancia compartida de TrueKeate. El dueño es la Dirección del proyecto, la fecha es 2026-09-25 y
el cierre previsto es migrar a `ggtov2-pg` con backups, PITR y SSL al desbloquear la facturación. La
decisión incluye una instrucción operativa explícita: **no cargar datos reales hasta entonces**
(`RepoTecnico/estado_proyecto.md:90`). Esto incumple RNF-16 (backup y recuperación con RPO ≤ 24 h y
RTO ≤ 4 h) y el SSL obligatorio, tal como advierte `RepoTecnico/requerimientos.md:206`.

**Riesgo de acceso público con PII.** El servicio Cloud Run tiene acceso **público (`allUsers`)** y
contiene **PII real de suscriptores**. La advertencia está en dos lugares del repositorio: la tabla
de despliegue marca el acceso como *«Público (`allUsers`) — smoke test; endurecer antes de
producción»* (`RepoTecnico/entornos_globales.md:325`) y la nota de datos reales indica que hay 1 lote
con **42 casos reales** con PII y que el servicio es público
(`RepoTecnico/entornos_globales.md:351-354`). El estado del proyecto lo lista como pendiente externo
prioritario (`RepoTecnico/estado_proyecto.md:13`). La mitigación prevista es restringir el acceso por
IAP o invocación autenticada, y evaluar el traslado a una instancia con respaldo
(`RepoTecnico/entornos_globales.md:356-358`).

| Riesgo | Descripción | Estado | Mitigación prevista |
|---|---|---|---|
| D-26 | Sin backups/PITR ni SSL obligatorio en la instancia compartida | Aceptado, dueño Dirección | Migrar a `ggtov2-pg` al desbloquear facturación |
| Acceso público | `allUsers` sobre `ggto-web` con PII real (42 casos) | Abierto | IAP o invocación autenticada; restringir antes de producción |
| Facturación `ggtov2` | `billingEnabled: false`, sin APIs de despliegue | Bloqueado | Liberar cupo y migrar el servicio |
| Credenciales de canales | Telegram y correo sin credenciales | Operativo diferido | Cargar secretos y procesar el *outbox* |
| Contrato de interfaz | `interfaz_csv_origen.md` sin firma | Pendiente CANTV | Firma de la D-41 |

Las decisiones relacionadas pueden consultarse en `RepoTecnico/estado_proyecto.md:90,92,107,121`.
Todo lo que no esté confirmado contra la consola de GCP en el momento de la lectura debe escribirse
como **pendiente de confirmar**.
