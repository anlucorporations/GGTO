# Dependencias del backend GGTO

> Manual técnico de las dependencias de ejecución y de desarrollo del backend de **GGTO**
> (CANTV C.A., Central Francisco Salias / Área 4). Describe de dónde se declaran las
> dependencias, para qué las usa el código, qué versión se observó en el entorno de
> verificación y qué licencia puede acreditarse. Toda referencia `ruta:línea` fue leída
> directamente del repositorio. Lo que no puede comprobarse en el repositorio se marca como
> **pendiente de confirmar**; no se fijan aquí versiones ni paquetes que el proyecto no declare.

## Fuentes de dependencias

El backend declara sus dependencias en dos archivos de texto plano dentro del paquete `app/`.
No existe, en la fecha de verificación, un archivo de bloqueo (*lock*) de Python equivalente a
`package-lock.json` del frontend, ni un `poetry.lock`, ni restricciones de versión en
`pyproject.toml`.

### app/requirements.txt

El archivo contiene **ocho líneas sueltas con nombres de paquete y sin ninguna restricción de
versión** (`app/requirements.txt:1-8`). Es la fuente de las dependencias de ejecución y la que
usa la imagen Docker en tiempo de construcción.

| Línea | Contenido literal | Rol |
|---|---|---|
| `app/requirements.txt:1` | `fastapi` | Framework HTTP, validación y OpenAPI |
| `app/requirements.txt:2` | `uvicorn[standard]` | Servidor ASGI con extras (`standard`) |
| `app/requirements.txt:3` | `sqlalchemy` | ORM y capa de acceso a datos |
| `app/requirements.txt:4` | `psycopg2-binary` | Conductor PostgreSQL |
| `app/requirements.txt:5` | `pydantic-settings` | Configuración tipada por variables de entorno |
| `app/requirements.txt:6` | `argon2-cffi` | Hash Argon2id de contraseñas y palabras |
| `app/requirements.txt:7` | `PyJWT` | Emisión y validación de tokens JWT |
| `app/requirements.txt:8` | `python-multipart` | Lectura de formularios y archivos subidos |

La ausencia de sufijos `==`, `~=` o `>=` es un hecho del repositorio, no una interpretación: el
archivo no permite reconstruir por sí solo el entorno que fue probado. El contraste con las
versiones realmente instaladas se desarrolla en la sección *Riesgo de versiones no fijadas*.

### app/requirements-dev.txt

El archivo de desarrollo extiende al anterior y añade las herramientas de calidad
(`app/requirements-dev.txt:1-5`):

| Línea | Contenido literal | Rol |
|---|---|---|
| `app/requirements-dev.txt:1` | `-r requirements.txt` | Hereda las ocho dependencias de ejecución |
| `app/requirements-dev.txt:2` | `pytest` | Marco de pruebas |
| `app/requirements-dev.txt:3` | `httpx` | Cliente HTTP usado por `TestClient` |
| `app/requirements-dev.txt:4` | `ruff` | Linter y ordenador de importaciones |
| `app/requirements-dev.txt:5` | `mypy` | Comprobación estática de tipos |

La directiva `-r requirements.txt:1` hace que instalar el archivo de desarrollo instale también
todo el conjunto de ejecución. El *pipeline* de integración continua aprovecha esta propiedad:
instala únicamente `app/requirements-dev.txt` (`.github/workflows/ci.yml:44-45`) y su caché de
pip se ancla a ese mismo archivo (`.github/workflows/ci.yml:38-42`).

## Dependencias de ejecución

Las versiones que se indican a continuación son las **observadas en el entorno de verificación
del 2026-09-28** (Python 3.12.3). No provienen de una fijación en el repositorio, porque
`app/requirements.txt` no fija versiones. Se indican también las importaciones reales que
justifican cada paquete dentro del código.

### FastAPI

#### Versión y origen

Versión observada en el entorno: **0.141.1**, sobre **Starlette 1.7.0** (capa ASGI) y
**Pydantic 2.13.5** (validación). FastAPI no figura en ningún otro archivo de dependencias
aparte de `app/requirements.txt:1`.

#### Uso en el proyecto

FastAPI es el esqueleto del servicio. Se construye la aplicación con
`app = FastAPI(` (`app/main.py:38`), precedido por la importación
`from fastapi import FastAPI` (`app/main.py:13`), y se añaden los *middleware* de CORS y de
observabilidad desde `fastapi.middleware.cors` y `fastapi.staticfiles`
(`app/main.py:14-15`).

El proyecto explota tres capacidades concretas del marco:

- **Inyección de dependencias.** Los manejadores reciben la sesión de base de datos y el usuario
  autenticado mediante `Depends`. Ejemplo real en el listado de casos:
  `db: Session = Depends(get_db)` y `_: Usuario = Depends(get_current_user)`
  (`app/api/routes_casos.py:91-92`). Las dependencias de seguridad viven en
  `app/api/deps.py:8-9`, que importa `Depends`, `HTTPException`, `status` y el esquema
  `HTTPBearer`.
- **Validación y contrato de salida.** Los decoradores declaran `response_model`, por ejemplo
  `@router.post("/login", response_model=TokenResponse, ...)` (`app/api/routes_auth.py:79`).
- **Documentación automática.** El endpoint de metadatos informa la ruta de documentación del
  servicio (`app/api/routes_health.py:17-24`).

Los diez módulos de rutas importan símbolos de FastAPI de forma directa: `app/api/routes_ingesta.py:7`,
`app/api/routes_especiales.py:7`, `app/api/routes_auth.py:8`, `app/api/routes_alertas.py:9`, `app/api/routes_despachos.py:7`,
`app/api/routes_health.py:5`, `app/api/routes_casos.py:7`, `app/api/routes_monitoreo.py:7`, `app/api/routes_config.py:7` y
`app/api/deps.py:8`. La dependencia es transversal a toda la API.

#### Licencia

**Pendiente de confirmar.** El repositorio no incluye archivo `LICENSE` ni metadatos de licencia
de las dependencias. Para el uso interno de CANTV debe realizarse una revisión formal de
licencias antes de una redistribución.

### Uvicorn

#### Versión y origen

Versión observada en el entorno: **0.54.0**. Se declara con el extra `standard`
(`app/requirements.txt:2`), que incorpora dependencias adicionales de rendimiento del propio
paquete.

#### Uso en el proyecto

Uvicorn es el servidor ASGI; **el código Python de `app/` no lo importa en ningún módulo**. Su
uso es de proceso, no de librería, y se materializa en dos lugares verificables:

- **Producción (contenedor).** El `CMD` de la imagen lo arranca como proceso principal:
  `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]`
  (`app/Dockerfile:29`).
- **Pruebas E2E.** El guion de Fase 4 lo levanta sobre `app.main:app` en el puerto del entorno
  (`python3 -m uvicorn app.main:app --host 127.0.0.1 --port "$PUERTO" --log-level warning`,
  `RepoTecnico/pruebas/run_e2e.sh:50-51`) y luego espera a que `/health` responda
  (`RepoTecnico/pruebas/run_e2e.sh:55-59`).

En desarrollo, el proxy de Vite apunta a `http://localhost:8000`
(`app/web/vite.config.ts:10-14`), pero el comando exacto de arranque local es **pendiente de
confirmar** en este manual; se documenta en el manual de despliegue.

#### Licencia

**Pendiente de confirmar.**

### SQLAlchemy

#### Versión y origen

Versión observada en el entorno: **2.1.1**. Se declara sin restricción en
`app/requirements.txt:3`.

#### Uso en el proyecto

SQLAlchemy es el ORM y la capa de acceso a datos, en estilo **declarativo 2.x** con anotaciones
`Mapped[...]` y `mapped_column(...)`. Las importaciones se reparten entre los modelos y los
manejadores:

- **Modelos.** `app/models/entities.py:7-9` importa tipos (`Boolean`, `DateTime`, `ForeignKey`,
  `Integer`, `SmallInteger`, `String`, `Text`, `func`), el dialecto `JSONB` de PostgreSQL
  (`app/models/entities.py:8`) y `Mapped`, `mapped_column`, `relationship`
  (`app/models/entities.py:9`). El mismo patrón se repite en `app/models/caso_entities.py:7-18`,
  `app/models/especiales_entities.py:7-17`, `app/models/config_entities.py:7-21`,
  `app/models/despacho_entities.py:7-19` y `app/models/insumos_entities.py:7-8`.
- **Consultas.** Los manejadores usan `select`, `func` y `text`, y la sesión tipada
  `Session`. Ejemplos: `app/api/routes_ingesta.py:8-9`, `app/api/routes_especiales.py:8-9`,
  `app/api/deps.py:10-11`.
- **Motor y sesión.** `app/core/db.py` crea el motor con
  `create_engine(build_url(), pool_pre_ping=True, pool_size=5, max_overflow=5, future=True)`
  (`app/core/db.py:39`) y la fábrica de sesiones con
  `sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)`
  (`app/core/db.py:40`). El uso de `future=True` confirma la API 2.x.

La URL de conexión se arma con el dialecto explícito `postgresql+psycopg2`
(`app/core/db.py:28` y `app/core/db.py:31`), lo que enlaza SQLAlchemy con el conductor descrito
en la sub-sección siguiente.

#### Licencia

**Pendiente de confirmar.** SQLAlchemy se distribuye habitualmente bajo licencia MIT, pero el
repositorio no aporta el texto ni el metadato, por lo que no se acredita aquí.

### psycopg2-binary

#### Versión y origen

Versión observada en el entorno: **2.9.13**. Se declara en `app/requirements.txt:4`. La variante
`-binary` incluye las bibliotecas nativas compiladas, lo que simplifica la instalación en la
imagen `python:3.12-slim` (`app/Dockerfile:13`).

#### Uso en el proyecto

No se importa `psycopg2` de forma directa en el código de `app/`: se usa **a través del dialecto
de SQLAlchemy**. Las referencias reales están en la construcción de la URL y en las pruebas de
configuración:

- `f"postgresql+psycopg2://{user}:{pwd}@/{s.db_name}"` para el socket Unix de Cloud SQL, con el
  host como parámetro de consulta (`app/core/db.py:28`).
- `f"postgresql+psycopg2://{user}:{pwd}@{s.db_host}:{s.db_port}/{s.db_name}"` para la conexión
  TCP (`app/core/db.py:31`).
- Comprobaciones de la cadena resultante en las pruebas:
  `"postgresql+psycopg2://u:p@127.0.0.1:5432/ggtov2?sslmode=require"`
  (`app/tests/test_config_db.py:23`) y `url.startswith("postgresql+psycopg2://u:p@/ggtov2?")`
  (`app/tests/test_config_db.py:45`).
- La integración continua define su cadena con el mismo dialecto en
  `GGTO_TEST_DB_URL` (`.github/workflows/ci.yml:30`).

El parámetro `sslmode` forma parte de la URL (`app/core/config.py:23`, aplicado en
`app/core/db.py:32`) y el esquema alternativo se añade con
`options=-csearch_path=<esquema>,public` (`app/core/db.py:33-36`), lo que permite resolver las
extensiones `pgcrypto` y `pg_trgm` desde `public`.

#### Licencia

**Pendiente de confirmar.** La distribución instalada declara en sus metadatos la clasificación
LGPL con excepciones, pero esa señal no está en el repositorio: la confirmación formal queda
pendiente.

### pydantic-settings

#### Versión y origen

Versión observada en el entorno: **2.15.0**. Se declara en `app/requirements.txt:5`.

#### Uso en el proyecto

Es la base del módulo de configuración. `app/core/config.py:5` importa
`from pydantic_settings import BaseSettings, SettingsConfigDict`, y la clase `Settings` declara
`model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)`
(`app/core/config.py:9`). Sobre esa clase se tipan todos los parámetros del sistema: aplicación
(`app/core/config.py:12-15`), base de datos (`app/core/config.py:18-25`), seguridad
(`app/core/config.py:28-35`) y CORS (`app/core/config.py:38`). La configuración se obtiene con
`get_settings()` (`app/main.py:30` y `app/main.py:36`).

Los valores sensibles —`secret_key` (`app/core/config.py:28`), `db_password`
(`app/core/config.py:22`) y las claves de los canales de notificación— se leen del entorno y de
un `.env` no versionado. Este manual **no reproduce secretos**: solo se nombran las claves.

#### Licencia

**Pendiente de confirmar.** La distribución instalada se clasifica como MIT, pero el repositorio
no contiene el texto de licencia.

### argon2-cffi

#### Versión y origen

Versión observada en el entorno: **25.1.0**. Se declara en `app/requirements.txt:6` y responde al
requisito **RNF-22** de endurecimiento del acceso, que exige `Argon2id`
(`RepoTecnico/requerimientos.md:201`).

#### Uso en el proyecto

`app/core/security.py:11` importa `from argon2 import PasswordHasher` y
`app/core/security.py:12` importa las excepciones `InvalidHashError`, `VerificationError` y
`VerifyMismatchError`. El *hasher* se instancia una sola vez con los parámetros por defecto de la
biblioteca:

- `_hasher = PasswordHasher()` con el comentario «Argon2id con parámetros por defecto de
  argon2-cffi (RNF-22)» (`app/core/security.py:16-17`).
- `hash_password()` devuelve `_hasher.hash(password)` (`app/core/security.py:23-25`).
- `verify_password()` valida sin propagar excepciones (`app/core/security.py:28-30`).

La prueba de seguridad confirma el algoritmo efectivo al comprobar que el hash comienza por
`$argon2id$` (`app/tests/test_security.py:20`). El mismo *hasher* cubre las contraseñas y el
diccionario de palabras de seguridad.

#### Licencia

**Pendiente de confirmar.**

### PyJWT

#### Versión y origen

Versión observada en el entorno: **2.7.0**. Se declara como `PyJWT` en
`app/requirements.txt:7`; el nombre de importación es `jwt`.

#### Uso en el proyecto

Se importa como `import jwt` en tres puntos verificados: `app/core/security.py:10`,
`app/api/deps.py:7` y `app/tests/test_security.py:5`. Cubre dos funciones:

- **Emisión.** En `app/core/security.py` se construye el token HS256 con los reclamos `sub`
  (P00), `rol`, `exp`, `iat` y `jti` (`app/core/security.py:56-72`). El algoritmo y la vigencia
  provienen de la configuración: `jwt_algorithm: str = "HS256"` (`app/core/config.py:29`) y
  `access_token_minutes: int = 480` (`app/core/config.py:30`).
- **Validación.** La dependencia de autenticación decodifica el token del encabezado `Bearer`
  con `HTTPBearer(auto_error=False)` (`app/api/deps.py:17`) y usa `decode_token`
  (`app/api/deps.py:14`); ante un token inválido o vencido responde 401 con el mensaje
  «Credenciales inválidas o token expirado» (`app/api/deps.py:22-26`).

La clave de firma se toma de `secret_key` (`app/core/config.py:28`), que **no se transcribe en
este manual**.

#### Licencia

**Pendiente de confirmar.** La distribución instalada declara `MIT` en `License:` y en sus
clasificadores, pero esa información no consta en el repositorio.

### python-multipart

#### Versión y origen

Versión observada en el entorno: **0.0.32**. Se declara en `app/requirements.txt:8`. Es la
dependencia que habilita en FastAPI los parámetros `File(...)` y `Form(...)` de tipo
`multipart/form-data`.

#### Uso en el proyecto

Su consumo está concentrado en el módulo de ingesta. `app/api/routes_ingesta.py:7` importa
`File`, `Form`, `UploadFile` junto al resto de símbolos de FastAPI, y los dos puntos de entrada
del CSV los usan:

- **Simulación:** `archivo: UploadFile = File(...)` e `id_central: int | None = Form(default=None)`
  (`app/api/routes_ingesta.py:107-108`).
- **Carga real:** la misma pareja de parámetros en el manejador de creación
  (`app/api/routes_ingesta.py:122-123`).

El contenido se lee de forma asíncrona con `contenido = await archivo.read()`
(`app/api/routes_ingesta.py:112`) y el nombre original se conserva en
`resumen["archivo"] = archivo.filename or "sin-nombre"` (`app/api/routes_ingesta.py:114`). El
contrato del archivo de origen se detalla en `RepoTecnico/interfaz_csv_origen.md`.

#### Licencia

**Pendiente de confirmar.** La distribución instalada se clasifica como Apache Software License,
señal que no consta en el repositorio.

## Dependencias de desarrollo

### pytest

#### Versión y origen

Versión observada: **9.1.1**. Declarada en `app/requirements-dev.txt:2`. La configuración vive
en `pytest.ini` (véase *Herramientas de calidad*).

#### Uso en el proyecto

Toda la suite está en `app/tests/`: `conftest.py` más catorce módulos `test_*.py`, entre ellos
`test_auth.py`, `test_casos_api.py`, `test_despacho_api.py`, `test_especiales_api.py`,
`test_ingesta_api.py`, `test_ingesta_parser.py`, `test_monitoreo_api.py`, `test_alertas_api.py`,
`test_config.py`, `test_config_db.py`, `test_contratos.py`, `test_security.py` y
`test_sectorizacion_cuadrilla0.py`. El `conftest.py` define las *fixtures* compartidas:
`import pytest` (`app/tests/conftest.py:14`), la *fixture* automática de limpieza de intentos
(`app/tests/conftest.py:59-62`), la *fixture* de sesión (`app/tests/conftest.py:69`) y el cliente
(`app/tests/conftest.py:102-107`).

El resultado de la Fase 4 fue **169/169 pruebas en verde**
(`RepoTecnico/pruebas/informe_fase4.md:16-28`).

#### Licencia

**Pendiente de confirmar.**

### httpx

#### Versión y origen

Versión observada: **0.28.1**. Declarada en `app/requirements-dev.txt:3`.

#### Uso en el proyecto

`httpx` **no se importa de forma directa en ningún archivo Python del repositorio** (búsqueda
sobre `app/` y `RepoTecnico/` sin resultados). Su presencia se explica porque
`fastapi.testclient.TestClient` se apoya en `httpx` como transporte. El cliente de pruebas se
construye con `from fastapi.testclient import TestClient`
(`app/tests/conftest.py:104`) y se usa como gestor de contexto
(`app/tests/conftest.py:119`). Es, por tanto, una dependencia de pruebas declarada de forma
explícita aunque su uso sea indirecto.

#### Licencia

**Pendiente de confirmar.** La distribución instalada declara `BSD-3-Clause`; el repositorio no
incluye el texto.

### ruff

#### Versión y origen

Versión observada: **0.16.9**. Declarada en `app/requirements-dev.txt:4` y configurada en
`pyproject.toml`.

#### Uso en el proyecto

Es el linter y ordenador de importaciones. El informe de Fase 4 lo reporta sin hallazgos
(`RepoTecnico/pruebas/informe_fase4.md:20` y `RepoTecnico/pruebas/informe_fase4.md:96`), y
`RepoTecnico/plan_desarrollo.md:415` registra la ejecución `ruff check app`. La configuración
aplicada se detalla en la sección *Herramientas de calidad*.

#### Licencia

**Pendiente de confirmar.**

### mypy

#### Versión y origen

Versión observada: **2.3.1**. Declarada en `app/requirements-dev.txt:5` y configurada en
`pyproject.toml`.

#### Uso en el proyecto

Realiza la comprobación estática de tipos sobre `app/`. Al igual que ruff, aparece sin hallazgos
en el informe de Fase 4 (`RepoTecnico/pruebas/informe_fase4.md:20`) y se invoca como
`mypy app` en el plan de desarrollo (`RepoTecnico/plan_desarrollo.md:415`). La configuración se
detalla en la sección *Herramientas de calidad*.

#### Licencia

**Pendiente de confirmar.**

## Riesgo de versiones no fijadas

### Reproducibilidad y RNF-24/RNF-25

`app/requirements.txt` no fija versiones (`app/requirements.txt:1-8`) y no existe archivo de
bloqueo de Python. Esto significa que dos instalaciones de `pip install -r
app/requirements-dev.txt` en fechas distintas pueden resolver versiones distintas de FastAPI,
SQLAlchemy, Pydantic o Starlette. Las consecuencias se miden contra dos requisitos ya acordados:

| Requisito | Texto relevante | Efecto de no fijar versiones |
|---|---|---|
| **RNF-24** | Migraciones versionadas, CI con `pytest`/Ruff/mypy, cobertura mínima 70 %, API versionada, entornos separados (`RepoTecnico/requerimientos.md:203`) | El *pipeline* puede romperse por una actualización de dependencia sin cambio de código; la cobertura mínima del 70 % no está configurada en el repositorio (pendiente de confirmar) |
| **RNF-25** | Paridad de entornos dev/prod, configuración solo por variables de entorno, imagen Docker reproducible (`RepoTecnico/requerimientos.md:204`) | «Imagen Docker reproducible» no se cumple mientras `pip install` resuelva versiones libres en cada construcción |

### Baseline verificado del entorno

El único *baseline* comprobable hoy es el del entorno donde se verificó el sistema el
2026-09-28, con **Python 3.12.3** y las versiones de la tabla siguiente. Este *baseline* es una
observación, no una garantía del repositorio: no está escrito en `requirements*.txt`.

| Paquete | Versión observada | Declarado en el repositorio |
|---|---|---|
| fastapi | 0.141.1 | `app/requirements.txt:1` (sin versión) |
| starlette | 1.7.0 | No declarado (transitiva) |
| uvicorn | 0.54.0 | `app/requirements.txt:2` (sin versión) |
| sqlalchemy | 2.1.1 | `app/requirements.txt:3` (sin versión) |
| psycopg2-binary | 2.9.13 | `app/requirements.txt:4` (sin versión) |
| pydantic-settings | 2.15.0 | `app/requirements.txt:5` (sin versión) |
| pydantic | 2.13.5 | No declarado (transitiva) |
| argon2-cffi | 25.1.0 | `app/requirements.txt:6` (sin versión) |
| PyJWT | 2.7.0 | `app/requirements.txt:7` (sin versión) |
| python-multipart | 0.0.32 | `app/requirements.txt:8` (sin versión) |
| pytest | 9.1.1 | `app/requirements-dev.txt:2` (sin versión) |
| httpx | 0.28.1 | `app/requirements-dev.txt:3` (sin versión) |
| ruff | 0.16.9 | `app/requirements-dev.txt:4` (sin versión) |
| mypy | 2.3.1 | `app/requirements-dev.txt:5` (sin versión) |

### Dependencias transitivas usadas de forma directa

Dos paquetes que el código importa de forma directa **no están declarados** en
`app/requirements.txt`:

- **pydantic.** Se importa en los siete módulos de esquemas, por ejemplo
  `from pydantic import BaseModel, ConfigDict, Field` (`app/schemas/ingesta.py:7`,
  `app/schemas/casos.py:8`, `app/schemas/alertas.py:8`, `app/schemas/config.py:8`,
  `app/schemas/despacho.py:8`, `app/schemas/especiales.py:8` y `from pydantic import BaseModel,
  Field` en `app/schemas/auth.py:5`). Llega como dependencia transitiva de FastAPI y de
  pydantic-settings; si FastAPI cambiara de versión mayor de Pydantic, el código podría romperse
  sin que ninguna línea de `requirements.txt` lo anticipe.
- **starlette.** Se usa de forma explícita en `app/main.py:16-17`
  (`from starlette.exceptions import HTTPException as StarletteHTTPException` y
  `from starlette.middleware.base import BaseHTTPMiddleware`), pero no figura en
  `app/requirements.txt`. Depende de la versión de FastAPI instalada.

### Alembic y la cobertura

**RNF-24** exige «migraciones versionadas con Alembic (baseline = `db/schema.sql`)» y
«cobertura mínima 70 %» (`RepoTecnico/requerimientos.md:203`). Sin embargo:

- `alembic` **no aparece** en `app/requirements.txt:1-8` ni en `app/requirements-dev.txt:1-5`;
  la única mención en el repositorio es la del propio requisito
  (`RepoTecnico/requerimientos.md:203`). El estado real de esa migración es **pendiente de
  confirmar**.
- No hay `pytest-cov` ni configuración de cobertura en `pyproject.toml:1-18` ni en
  `pytest.ini:1-6`. El umbral del 70 % no está instrumentado en el repositorio: **pendiente de
  confirmar**.

### Mitigaciones recomendadas

1. **Fijar versiones** (`paquete==versión`) con las del *baseline* de la tabla anterior, o
   adoptar un archivo de bloqueo generado con `pip freeze`.
2. **Declarar las dependencias directas** `pydantic` y `starlette` en `app/requirements.txt`,
   ya que el código las importa de forma explícita.
3. **Fijar la versión de Python** en la imagen y en CI; hoy ambas usan 3.12
   (`app/Dockerfile:13` y `.github/workflows/ci.yml:38-40`), lo que es coherente con RNF-25.
4. **Registrar el texto de las licencias** de todas las dependencias para cerrar la revisión
   legal pendiente.

## Herramientas de calidad y su invocación

### pyproject.toml

El archivo `pyproject.toml` contiene dos bloques de configuración y ninguna dependencia.

#### Ruff

- `line-length = 110` (`pyproject.toml:2`).
- `target-version = "py312"` (`pyproject.toml:3`), coherente con Python 3.12.
- `extend-exclude = [".venv", "venv", "app/web"]` (`pyproject.toml:4`): excluye la web y los
  entornos virtuales del análisis.
- Reglas seleccionadas `["E", "F", "I", "B", "UP", "RUF"]` (`pyproject.toml:9`): errores de
  estilo (E), de Pyflakes (F), orden de importaciones (I), `flake8-bugbear` (B), `pyupgrade`
  (UP) y reglas propias de Ruff (RUF).
- `ignore = ["B008"]` con el comentario que lo justifica: FastAPI usa `Depends(...)` como valor
  por defecto (`pyproject.toml:7-8`).
- Excepción por archivo: `"app/tests/*" = ["E501"]` (`pyproject.toml:11-12`), de modo que las
  pruebas no están sujetas al límite de 110 columnas.

#### mypy

- `python_version = "3.12"` (`pyproject.toml:15`).
- `ignore_missing_imports = true` (`pyproject.toml:16`).
- `warn_unused_ignores = true` (`pyproject.toml:17`).
- `exclude = ["app/web/"]` (`pyproject.toml:18`).

### pytest.ini

La configuración de pytest es mínima y explícita (`pytest.ini:1-6`):

| Clave | Valor | Efecto |
|---|---|---|
| `testpaths` | `app/tests` | Solo se recolectan las pruebas del paquete `app/tests` |
| `python_files` | `test_*.py` | Patrón de archivos de prueba |
| `python_classes` | `Test*` | Patrón de clases de prueba |
| `python_functions` | `test_*` | Patrón de funciones de prueba |
| `addopts` | `-ra` | Resumen final de resultados, incluidos los omitidos |

### Invocación local y en integración continua

Los comandos verificados son:

| Herramienta | Comando | Referencia |
|---|---|---|
| Ruff | `ruff check app` | `.github/workflows/ci.yml:48`, `RepoTecnico/plan_desarrollo.md:415` |
| mypy | `mypy app --ignore-missing-imports` | `.github/workflows/ci.yml:51` |
| pytest | `pytest app/tests -q` | `.github/workflows/ci.yml:54` |
| pytest (alternativo) | `python3 -m pytest app/tests -q` | `RepoTecnico/pruebas/plan_pruebas.md:117` |

El *workflow* dispone de un servicio PostgreSQL 15 con base `ggto_test`
(`.github/workflows/ci.yml:14-27`) y define las variables de entorno de prueba, incluida
`GGTO_TEST_DB_URL` con dialecto `psycopg2` (`.github/workflows/ci.yml:29-33`). Los pasos
se ejecutan en el orden lint → tipos → pruebas (`.github/workflows/ci.yml:47-54`).

### Sistema de construcción

El backend **no empaqueta** la aplicación: no hay `[build-system]` ni `[project]` en
`pyproject.toml`, cuyo contenido se limita a `[tool.ruff]` y `[tool.mypy]`
(`pyproject.toml:1-18`). La aplicación se ejecuta desde la raíz con `uvicorn app.main:app`
(`app/Dockerfile:29`). El empaquetado de la web con Node se documenta en
`02-Dependencias/02-frontend.md`.
