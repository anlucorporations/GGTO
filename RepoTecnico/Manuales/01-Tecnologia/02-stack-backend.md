# Stack del backend GGTO

> Manual técnico de la tecnología y la organización del backend de **GGTO**. Describe las versiones
> reales del entorno de desarrollo, la separación en capas del paquete `app/`, el middleware de
> observabilidad y la configuración por entorno. Todas las referencias `ruta:línea` fueron
> verificadas sobre el código del repositorio. Lo no comprobable se marca como **pendiente de
> confirmar**.

## Stack del backend

### Python y FastAPI

El backend está escrito en **Python 3.12** y usa **FastAPI**. La versión exacta de Python verificada
en el entorno de desarrollo es **3.12.3** y la de FastAPI es **0.141.1**, con **Starlette 1.7.0**
como capa ASGI subyacente (`/tmp/ggto_factsheet.md:54-57`; el detalle consolidado de versiones
proviene de la verificación del 2026-09-28).

La aplicación se construye en `app/main.py`. El objeto `FastAPI` se instancia con tres argumentos
tomados de la configuración: `title=settings.app_name`, `version=settings.app_version` y una
`description` que enumera los ciclos cubiertos (`app/main.py:38-47`).

FastAPI aporta al proyecto tres capacidades que el código explota de forma directa:

1. **Inyección de dependencias.** `Depends` se usa para la sesión de base de datos y para el usuario
   autenticado. Ejemplo real en un manejador de listado:
   `db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)`
   (`app/api/routes_casos.py:91-92`).
2. **Validación y serialización.** Los `response_model` declaran el contrato de salida. En
   `routes_casos.py` el listado declara `response_model=PaginaCasos`
   (`app/api/routes_casos.py:89`) y en `routes_auth.py` el login declara
   `response_model=TokenResponse` (`app/api/routes_auth.py:79`).
3. **Documentación automática.** La ruta de documentación se anuncia en el propio servicio; el
   endpoint de metadatos devuelve `"documentacion": "/docs"` (`app/api/routes_health.py:24`).

El servidor ASGI es **Uvicorn 0.54.0** (`/tmp/ggto_factsheet.md:54-57`). En desarrollo se ejecuta
uvicorn sobre `app.main:app` en el puerto 8000, que es el destino del proxy de Vite
(`app/web/vite.config.ts:8-15`). El comando exacto de arranque en cada entorno es **pendiente de
confirmar** en el manual de despliegue.

El archivo de dependencias `app/requirements.txt` **no fija versiones**: contiene ocho líneas sueltas
con los nombres de los paquetes (`app/requirements.txt:1-8`). Las versiones listadas en este manual
provienen del entorno donde se verificó el sistema, no de un *pin* en el repositorio; al reproducir
el entorno debe esperarse que pip resuelva versiones distintas si no se fijan. `requirements-dev.txt`
extiende el anterior con `-r requirements.txt` más las herramientas de calidad
(`app/requirements-dev.txt:1-5`).

La lista de dependencias directas de ejecución es:

| Paquete | Uso en el proyecto | Referencia |
|---|---|---|
| `fastapi` | Framework HTTP y OpenAPI | `app/requirements.txt:1` |
| `uvicorn[standard]` | Servidor ASGI | `app/requirements.txt:2` |
| `sqlalchemy` | ORM y capa de acceso a datos | `app/requirements.txt:3` |
| `psycopg2-binary` | Conductor PostgreSQL | `app/requirements.txt:4` |
| `pydantic-settings` | Configuración tipada por entorno | `app/requirements.txt:5` |
| `argon2-cffi` | Hash de contraseñas y palabras | `app/requirements.txt:6` |
| `PyJWT` | Emisión y validación de JWT | `app/requirements.txt:7` |
| `python-multipart` | Carga de archivos en la ingesta | `app/requirements.txt:8` |

Las herramientas de desarrollo son `pytest`, `httpx`, `ruff` y `mypy`
(`app/requirements-dev.txt:2-5`), con versiones verificadas pytest 9.1.1, httpx 0.28.1, ruff 0.16.9
y mypy 2.3.1 (`/tmp/ggto_factsheet.md:54-57`).

La integración continua reproduce este stack en GitHub Actions con Python 3.12 y caché de pip basada
en `app/requirements-dev.txt` (`.github/workflows/ci.yml:32-37`). El *workflow* se dispara ante
`push` y `pull_request` sobre las ramas `GGTOv2-DSH-GCP` y `main`
(`.github/workflows/ci.yml:4-9`).

### SQLAlchemy 2.x y psycopg2

La capa de datos usa **SQLAlchemy 2.1.1** con el dialecto **`psycopg2`** y el paquete
**`psycopg2-binary` 2.9.13** (`/tmp/ggto_factsheet.md:54-57`). El estilo es el **declarativo 2.x** con
anotaciones `Mapped[...]` y `mapped_column(...)`.

El módulo `app/core/db.py` concentra la infraestructura de datos (`app/core/db.py:1-49`):

- `class Base(DeclarativeBase)` es la base declarativa de todos los modelos
  (`app/core/db.py:12-13`).
- `build_url()` arma la cadena de conexión y resuelve las tres modalidades (socket Unix, TCP y
  esquema alternativo) descritas en el manual `01-plataforma.md` (`app/core/db.py:16-36`).
- El motor se crea con `pool_pre_ping=True, pool_size=5, max_overflow=5, future=True`
  (`app/core/db.py:39`).
- `SessionLocal` es el `sessionmaker` con `autoflush=False, autocommit=False,
  expire_on_commit=False` (`app/core/db.py:40`).
- `get_db()` es el generador que entrega una sesión por petición y la cierra siempre
  (`app/core/db.py:43-49`).

Las consultas se escriben en estilo 2.x con `select()` y ejecución explícita. Los imports típicos en
un router son `from sqlalchemy import func, or_, select, text` (`app/api/routes_casos.py:8`), y las
consultas escalares se resuelven con `db.scalar(...)` o `db.scalars(...)`
(`app/api/deps.py:44`, `app/api/routes_casos.py:61-71`).

El uso de `text()` aparece cuando la consulta necesita SQL literal, como en los endpoints de salud
(`app/api/routes_health.py:38-48`) y en el conteo del resumen (`app/api/routes_health.py:64-77`).

Los modelos se agrupan por dominio funcional y se reexportan desde `app/models/__init__.py:1-41`:

| Archivo | Contenido | Ciclo |
|---|---|---|
| `app/models/entities.py` | `Central`, `DispositivoSeguridad`, `Rol`, `Tecnico`, `Usuario` | Ciclo 1 |
| `app/models/config_entities.py` | `CatalogoMetodo`, `Causa`, `Configuracion`, `Cuadrilla`, `Flota`, `Herramienta`, `Sector`, `SectorDireccion` | Ciclo 2 |
| `app/models/caso_entities.py` | `Caso`, `CasoEstadoHist`, `IngestaLote` | Ciclos 3-4 |
| `app/models/despacho_entities.py` | `Despacho`, `DespachoCasos`, `FallaMasiva`, `Notificacion` | Ciclo 5 |
| `app/models/especiales_entities.py` | `CasoEspecial`, `Cita`, `Seguimiento`, `Solicitante` | Ciclo 6 |
| `app/models/insumos_entities.py` | `OrdenMaterial` | v2 |

El mapeo es **manual y explícito**: los modelos se mapean al esquema ya desplegado en
`db/schema.sql`, tal como declara el encabezado de `entities.py`
(`app/models/entities.py:1`). Las columnas declaran tipos, longitudes y nulabilidad de forma
explícita; por ejemplo `Rol` define `id_rol` como entero primario, `codigo` como
`String(30)` único y no nulo, y `permisos` como `JSONB` (`app/models/entities.py:17-24`).

| Concepto | Implementación | Referencia |
|---|---|---|
| Base declarativa | `DeclarativeBase` | `app/core/db.py:12-13` |
| Motor | `create_engine(..., pool_pre_ping=True)` | `app/core/db.py:39` |
| Sesión | `sessionmaker(bind=engine, expire_on_commit=False)` | `app/core/db.py:40` |
| Dependencia | `get_db()` con cierre en `finally` | `app/core/db.py:43-49` |
| Tipo JSONB | `sqlalchemy.dialects.postgresql.JSONB` | `app/models/entities.py:9`, `app/models/config_entities.py:20` |
| Relaciones | `relationship` de SQLAlchemy ORM | `app/models/entities.py:10` |

La migración de esquema **no** se realiza con Alembic en el estado actual: el DDL se aplica como
script (`RepoTecnico/db/schema.sql`). La previsión D-38 mencionaba Alembic con *baseline* en el
script, pero su uso efectivo es **pendiente de confirmar** (`RepoTecnico/estado_proyecto.md:102`).

### Pydantic v2 y pydantic-settings

La validación usa **Pydantic 2.13.5** y la configuración **pydantic-settings 2.15.0**
(`/tmp/ggto_factsheet.md:54-57`). El paquete `app/schemas/` contiene los esquemas por dominio:

| Archivo | Dominio |
|---|---|
| `app/schemas/auth.py` | Login, token, usuario, desbloqueo, setup |
| `app/schemas/config.py` | Central, sectores, técnicos, flota, cuadrillas, catálogos, parámetros |
| `app/schemas/ingesta.py` | Resumen y lote de ingesta |
| `app/schemas/casos.py` | Caso, página de casos, historial |
| `app/schemas/despacho.py` | Propuesta, despacho, reportes, notificaciones |
| `app/schemas/especiales.py` | Solicitantes, casos especiales, citas, seguimiento |
| `app/schemas/alertas.py` | Fallas masivas, notificaciones, métricas, MCP |

Los esquemas siguen el patrón **base / create / update / out** propio de Pydantic v2. Un ejemplo
verificable: `CentralBase` declara once campos con `Field(max_length=...)`
(`app/schemas/config.py:15-26`) y `CentralCreate` la extiende sin cambios
(`app/schemas/config.py:29-30`). El uso de `ConfigDict` y `Field` está importado
en el encabezado (`app/schemas/config.py:7`), y los tipos usan la sintaxis moderna de unión
`str | None` y `Literal` (`app/schemas/config.py:5-6`).

La conversión de un modelo ORM a esquema de salida se hace con `model_validate`, propio de Pydantic
v2: `datos = CasoOut.model_validate(caso).model_dump()` (`app/api/routes_casos.py:74`). Este patrón
permite enriquecer el diccionario resultante con campos calculados antes de reconstruir el esquema
(`app/api/routes_casos.py:75-82`).

La configuración del entorno se resuelve con `pydantic-settings`. La clase `Settings` hereda de
`BaseSettings` y declara `model_config = SettingsConfigDict(env_file=".env", extra="ignore",
case_sensitive=False)` (`app/core/config.py:8-9`). Las tres opciones significan: se lee un archivo
`.env` si existe, se ignoran variables no declaradas y los nombres de las variables son
insensibles a mayúsculas.

La instancia se obtiene con `get_settings()`, decorada con `@lru_cache`, de modo que la lectura del
entorno ocurre una sola vez por proceso (`app/core/config.py:45-47`).

### Uvicorn

**Uvicorn 0.54.0** es el servidor ASGI (`/tmp/ggto_factsheet.md:54-57`). En el contenedor, la imagen
multi-etapa compila la SPA con Node y luego la sirve el proceso Python
(`RepoTecnico/entornos_globales.md:321`). El arranque concreto del contenedor (comando, número de
*workers*, puerto) es **pendiente de confirmar** contra el `Dockerfile` del despliegue, que no forma
parte de este manual.

En desarrollo, el contrato de puertos es el siguiente: Vite sirve en `5173` y reenvía `/api` a
`http://localhost:8000`, donde escucha el backend (`app/web/vite.config.ts:8-15`). Los endpoints de
salud y metadatos permiten verificar el arranque con `GET /health` (`app/api/routes_health.py:28`) y
`GET /ready` (`app/api/routes_health.py:34`).

## Organizacion en capas

### app/main.py (composicion)

`app/main.py` es el **punto de composición** de la aplicación: no contiene reglas de negocio. Sus
responsabilidades, en orden de aparición, son:

1. Configurar el *logging* raíz (`app/main.py:32-34`).
2. Leer la configuración (`settings = get_settings()`, `app/main.py:36`).
3. Crear la instancia `FastAPI` (`app/main.py:38-47`).
4. Definir y registrar el middleware de observabilidad (`app/main.py:49-68`).
5. Registrar el middleware de CORS (`app/main.py:69-75`).
6. Incluir los nueve routers (`app/main.py:77-85`).
7. Montar la SPA al final para no tapar la API (`app/main.py:88-105`).

El archivo tiene **105 líneas** y no importa ningún modelo ni servicio de negocio: solo routers y
configuración (`app/main.py:19-30`).

### Routers (app/api)

El paquete `app/api/` aloja diez módulos de rutas y el módulo de dependencias `deps.py`. La
distribución es la siguiente, con el recuento de operaciones del inventario:

| Archivo | Prefijo | Operaciones | Líneas |
|---|---|---|---|
| `routes_alertas.py` | `/api/v1` | 11 | 423 |
| `routes_auth.py` | `/api/v1/auth` | 4 | 206 |
| `routes_casos.py` | `/api/v1/casos` | 6 | 329 |
| `routes_config.py` | `/api/v1` | 31 | 549 |
| `routes_despachos.py` | `/api/v1/despachos` | 15 | 499 |
| `routes_especiales.py` | `/api/v1` | 14 | 441 |
| `routes_health.py` | sin prefijo | 4 | 80 |
| `routes_ingesta.py` | `/api/v1/ingesta` | 4 | 195 |
| `routes_monitoreo.py` | `/api/v1` | 9 | 199 |
| `deps.py` | — (dependencias) | — | 72 |

Los routers declaran su prefijo y sus etiquetas OpenAPI en la creación del objeto. Ejemplos
verificados: `APIRouter(prefix="/api/v1/casos", tags=["casos"])` (`app/api/routes_casos.py:24`),
`APIRouter(prefix="/api/v1/ingesta", tags=["ingesta"])` (`app/api/routes_ingesta.py:21`),
`APIRouter(prefix="/api/v1", tags=["monitoreo y reportes"])` (`app/api/routes_monitoreo.py:17`) y
`APIRouter(tags=["salud"])` sin prefijo (`app/api/routes_health.py:14`).

Cada router concentra solo orquestación: valida, autoriza, delega en servicios y serializa. Las
funciones auxiliares privadas (prefijo `_`) viven en el mismo módulo cuando son específicas del
recurso, como `_o_404`, `_registrar_estado`, `_sectorizar` y `_resumen` en
`app/api/routes_casos.py:29-83`.

### Esquemas (app/schemas)

Los esquemas Pydantic son el contrato de entrada y salida de la API y, a la vez, el espejo del
frontend. El encabezado de `app/web/src/api/types.ts` lo declara explícitamente: *«Tipos del dominio
GGTO — espejo de los esquemas Pydantic del backend (`app/schemas/auth.py` y
`app/schemas/config.py`)»* (`app/web/src/api/types.ts:1-4`).

La correspondencia se mantiene manualmente. Por ejemplo, la interfaz `Usuario` de TypeScript declara
`p00`, `correo`, `rol`, `id_rol`, `id_central`, `nombre` y `apellido`
(`app/web/src/api/types.ts:10-18`), que son los campos que el backend devuelve en el login. La
interfaz `Sector` declara `direcciones: SectorDireccion[]` como arreglo anidado
(`app/web/src/api/types.ts:78-87`).

### Servicios (app/services)

La carpeta `app/services/` concentra las reglas de negocio. Sus módulos y su función documentada
son:

| Módulo | Responsabilidad |
|---|---|
| `app/services/ingesta.py` | Parser y carga del CSV diario (especificación de columnas) |
| `app/services/sectorizacion.py` | Sectorización por dirección |
| `app/services/cuadrilla0.py` | Criterio combinado de cuadrilla 0 (D-22/D-59) |
| `app/services/despacho.py` | Propuesta y balanceo del despacho |
| `app/services/fallas.py` | Detección de fallas masivas por concentración |
| `app/services/notificaciones.py` | Composición de mensajes y canales |
| `app/services/outbox.py` | Bandeja con reintentos y backoff |
| `app/services/monitoreo.py` | Métricas y reportes |
| `app/services/consultas.py` | Consultas auxiliares de configuración |

La evidencia de uso desde los routers es directa. En `routes_casos.py` se importan
`cargar_config`, `cargar_patrones`, `resolver_central` y `asignar_sector`
(`app/api/routes_casos.py:20-21`); en `routes_ingesta.py` se importan `cuadrilla0`, `fallas`,
`ESPECIFICACION`, `filtrar_por_central`, `parsear` y `Patron`
(`app/api/routes_ingesta.py:16-18`); y en `routes_monitoreo.py` el servicio se importa con alias
`from ..services import monitoreo as svc` (`app/api/routes_monitoreo.py:14`).

La convención es que los servicios reciben la `Session` como primer argumento y devuelven datos
listos para serializar, sin depender de FastAPI. El manual `03-Implementacion/` desarrolla cada
servicio.

### Modelos (app/models)

Los modelos son el mapeo al esquema físico. Se agrupan por dominio (véase la tabla de la sección
anterior) y se reexportan en un único punto de importación: `app/models/__init__.py:1-41`. Los
routers importan desde ese paquete, no desde los módulos internos, lo que mantiene estables las
rutas de importación. Ejemplos: `from ..models import Caso, CasoEstadoHist, Cita, DespachoCasos,
Sector, Usuario` (`app/api/routes_casos.py:12`) y `from ..models import Usuario`
(`app/api/deps.py:15`).

### Nucleo (app/core)

`app/core/` contiene las piezas transversales. Tiene cuatro módulos:

| Módulo | Contenido | Líneas |
|---|---|---|
| `app/core/config.py` | `Settings` y `get_settings()` | 47 |
| `app/core/db.py` | `Base`, `build_url()`, `engine`, `SessionLocal`, `get_db()` | 49 |
| `app/core/security.py` | Hash Argon2id, JWT, normalización de palabras | 78 |
| `app/core/words.py` | Diccionario de palabras de seguridad | 27 |

Ninguno importa de `app/api` ni de `app/services`: la dependencia va en un solo sentido, desde las
capas externas hacia el núcleo. Esto se verifica en los encabezados de importación de
`app/core/config.py:1-5`, `app/core/db.py:1-9` y `app/core/security.py:1-12`.

## Middleware y observabilidad

### ObservabilidadMiddleware y X-Request-ID (RNF-19) (app/main.py:49-68)

El middleware de observabilidad es una subclase de `BaseHTTPMiddleware` cuyo docstring declara su
propósito: *«Añade un `request-id` y registra cada petición (RNF-19)»* (`app/main.py:49-50`).

Su implementación (`app/main.py:52-65`) hace lo siguiente:

1. Obtiene el `X-Request-ID` entrante o genera uno nuevo de 12 caracteres hexadecimales:
   `request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]` (`app/main.py:53`).
2. Marca el inicio con `time.perf_counter()` (`app/main.py:54`).
3. Ejecuta la cadena de la aplicación dentro de un `try/except`; si algo falla, registra la excepción
   con `logger.exception` incluyendo el `request_id`, el método y la ruta, y **relanza**
   (`app/main.py:55-60`).
4. Calcula la duración en milisegundos (`app/main.py:61`).
5. Escribe la cabecera `X-Request-ID` en la respuesta (`app/main.py:62`).
6. Registra una línea informativa con `request_id`, método, ruta, código y milisegundos
   (`app/main.py:63-64`).

El middleware se registra con `app.add_middleware(ObservabilidadMiddleware)` (`app/main.py:68`). El
orden de registro importa: como el registro de CORS ocurre después (`app/main.py:69-75`), el
middleware de observabilidad envuelve a CORS y el identificador se aplica a todas las respuestas,
incluidas las de preflight.

Este comportamiento respalda RNF-19, que exige *«logs estructurados con `request-id` y usuario en
todas las operaciones»*, junto con `/health` y `/ready`, métricas de negocio y retención de logs ≥ 30
días (`RepoTecnico/requerimientos.md:198`). El componente de métricas de negocio se expone en
`GET /api/v1/metricas` (`app/api/routes_alertas.py:400`).

### CORS (app/main.py:69-75)

El middleware CORS se agrega con los valores de configuración (`app/main.py:69-75`):

- `allow_origins=settings.cors_origin_list`
- `allow_credentials=True`
- `allow_methods=["*"]`
- `allow_headers=["*"]`

La lista de orígenes se deriva de la cadena `CORS_ORIGINS` separada por comas mediante la propiedad
`cors_origin_list`, que recorta espacios y descarta elementos vacíos
(`app/core/config.py:40-42`). El valor por defecto es `"*"` (`app/core/config.py:38`), lo que
produce una lista con un único elemento comodín.

> Advertencia operativa: con el valor por defecto `*` y `allow_credentials=True`, el navegador
> rechaza el comodín en peticiones con credenciales. En producción, y dado que la SPA se sirve desde
> el mismo origen (`app/main.py:103-105`), lo recomendable es fijar `CORS_ORIGINS` a los orígenes
> reales. El valor efectivo desplegado es **pendiente de confirmar** en la configuración del
> servicio Cloud Run.

### Logging (app/main.py:32-34)

El *logging* se configura una sola vez, al importar el módulo, con `logging.basicConfig` a nivel
`INFO` y un formato que incluye marca de tiempo, nivel, nombre del logger y mensaje
(`app/main.py:32-33`). El logger del proyecto se obtiene con
`logger = logging.getLogger('ggto')` (`app/main.py:34`), de modo que todas las líneas del sistema
quedan etiquetadas con el nombre `ggto` y son fáciles de filtrar en Cloud Logging. Los registros del
middleware usan ese logger (`app/main.py:58,63`).

| Elemento | Valor | Referencia |
|---|---|---|
| Nivel | `INFO` | `app/main.py:32` |
| Formato | `%(asctime)s %(levelname)s %(name)s %(message)s` | `app/main.py:33` |
| Nombre del logger | `ggto` | `app/main.py:34` |
| Campos de la línea de petición | `request_id`, método, ruta, código, ms | `app/main.py:63-64` |

## Configuracion por entorno (app/core/config.py:8-47)

La configuración se declara como una clase `Settings` que hereda de `BaseSettings` y se cachea con
`get_settings()` (`app/core/config.py:45-47`). El archivo completo tiene 47 líneas y agrupa las
variables en cuatro bloques comentados: Aplicación, Base de datos, Seguridad y CORS
(`app/core/config.py:11-38`).

| Bloque | Variable | Valor por defecto | Referencia |
|---|---|---|---|
| Aplicación | `app_name` | `GGTO API` | `app/core/config.py:12` |
| Aplicación | `app_env` | `development` | `app/core/config.py:13` |
| Aplicación | `app_version` | `0.9.0` | `app/core/config.py:14` |
| Aplicación | `app_timezone` | `America/Caracas` | `app/core/config.py:15` |
| Base de datos | `db_host` | `localhost` | `app/core/config.py:18` |
| Base de datos | `db_port` | `5432` | `app/core/config.py:19` |
| Base de datos | `db_name` | `ggtov2` | `app/core/config.py:20` |
| Base de datos | `db_user` | `ggtov2_app` | `app/core/config.py:21` |
| Base de datos | `db_password` | `""` | `app/core/config.py:22` |
| Base de datos | `db_sslmode` | `prefer` | `app/core/config.py:23` |
| Base de datos | `db_schema` | `""` (esquema por defecto) | `app/core/config.py:25` |
| Seguridad | `secret_key` | valor de marcador, a cambiar en producción | `app/core/config.py:28` |
| Seguridad | `jwt_algorithm` | `HS256` | `app/core/config.py:29` |
| Seguridad | `access_token_minutes` | `480` (8 h de jornada) | `app/core/config.py:30` |
| Seguridad | `max_intentos` | `3` (RF-20) | `app/core/config.py:31` |
| Seguridad | `palabras_seguridad` | `12` (RF-20) | `app/core/config.py:32` |
| Seguridad | `palabras_requeridas` | `3` (RF-20) | `app/core/config.py:33` |
| Seguridad | `rate_limit_intentos` | `10` (RNF-22) | `app/core/config.py:34` |
| Seguridad | `rate_limit_ventana_seg` | `60` | `app/core/config.py:35` |
| CORS | `cors_origins` | `*` | `app/core/config.py:38` |

Notas de operación:

- `secret_key` tiene por defecto un valor de marcador que **debe** sustituirse en producción. El
  valor real vive en Secret Manager y en este manual solo se documenta el **nombre** del secreto,
  nunca su contenido (`app/core/config.py:28`).
- El bloque de seguridad codifica las reglas de RF-20: bloqueo a los 3 intentos, 12 palabras
  generadas y 3 requeridas para el desbloqueo (`app/core/config.py:31-33`).
- El límite de tasa de RNF-22 se aplica con 10 intentos por cada 60 segundos
  (`app/core/config.py:34-35`) y se evalúa al inicio del login
  (`app/api/routes_auth.py:82`).
- La vigencia del token es de 480 minutos, es decir, la jornada de 8 horas
  (`app/core/config.py:30`).
- El archivo `.env` es opcional; si no existe, se usan los valores por defecto
  (`app/core/config.py:9`).

## Montaje de la SPA y deep links (app/main.py:91-105)

El montaje de la SPA es la última operación del módulo y tiene una razón de orden explícita: *«Web de
administración (SPA React). Se monta al final para no tapar la API»* (`app/main.py:88-90`). Si el
montaje en `/` ocurriera antes, capturaría también las rutas de la API.

El mecanismo de *deep links* se implementa en la clase `SPAStaticFiles`
(`app/main.py:91-100`), cuyo docstring dice: *«Sirve `index.html` ante rutas del cliente (deep links
de React Router)»* (`app/main.py:92`). La implementación sobrescribe `get_response` y envuelve la
llamada al padre en un `try/except`: si el padre lanza `StarletteHTTPException` con código **404**,
se vuelve a pedir `index.html`; cualquier otro código se propaga
(`app/main.py:94-100`).

El directorio se resuelve de forma relativa al archivo y solo se monta si existe:

```
WEB_DIST = Path(__file__).resolve().parent / "web" / "dist"
if WEB_DIST.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(WEB_DIST), html=True), name="web")
```

(`app/main.py:103-105`). El argumento `html=True` habilita la resolución de `index.html` como
documento por defecto.

La consecuencia práctica es que rutas como `/casos/123` o `/monitoreo` funcionan al recargar el
navegador: FastAPI no encuentra el archivo, devuelve `index.html` y React Router resuelve la vista en
el cliente (`app/web/src/App.tsx:22-48`). El script de construcción que produce `app/web/dist` está
en `app/web/package.json:9` y se documenta en el manual `03-stack-frontend.md`.

| Elemento | Valor | Referencia |
|---|---|---|
| Clase | `SPAStaticFiles(StaticFiles)` | `app/main.py:91` |
| Criterio de fallback | `HTTPException` con `status_code == 404` | `app/main.py:97-99` |
| Documento de fallback | `index.html` | `app/main.py:99` |
| Directorio | `app/web/dist` | `app/main.py:103` |
| Condición de montaje | `WEB_DIST.is_dir()` | `app/main.py:104` |
| Punto de montaje | `/` con `html=True` | `app/main.py:105` |
