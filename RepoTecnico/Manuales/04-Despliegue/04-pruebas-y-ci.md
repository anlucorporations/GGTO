# Manual de pruebas y CI — GGTO (CANTV, Central Francisco Salias / Área 4)

Este manual describe la estrategia de pruebas de la plataforma **GGTO**, los entornos aislados que
usa, la estructura y el inventario de la batería de `pytest` y de las pruebas E2E de navegador, los
analizadores de calidad estática, el resultado de la Fase 4 y el flujo de integración continua. Cada
afirmación se respalda con una referencia `ruta:línea` verificada; lo que no está implementado o no
puede comprobarse se declara como **pendiente de confirmar**.

## Estrategia de pruebas

La Fase 4 se planificó con el objetivo de validar el sistema entregado en la Fase 3 con **100 % de
pruebas en verde** (`RepoTecnico/pruebas/plan_pruebas.md:13-27`). La estrategia se apoya en cuatro
niveles complementarios y en un principio rector: **ninguna prueba toca producción**, sino esquemas
aislados (`RepoTecnico/pruebas/plan_pruebas.md:9`).

### Los cuatro niveles de prueba

`plan_pruebas.md` enumera los niveles con su alcance
(`RepoTecnico/pruebas/plan_pruebas.md:18-24`):

#### Unitarias

Prueban lógica pura, sin base de datos: construcción de la URL de conexión, *backoff* y palabras de
seguridad (`RepoTecnico/pruebas/plan_pruebas.md:18`). No dependen de PostgreSQL y por eso siguen
corriendo aunque no haya base disponible (`RepoTecnico/pruebas/informe_fase4.md:87-88`).

#### Integración

Ejercitan la API contra PostgreSQL, con el esquema recreado desde `RepoTecnico/db/schema.sql` en el
esquema `ggto_test` (`RepoTecnico/pruebas/plan_pruebas.md:19-20`). El esquema lo levanta el
`conftest.py` de la batería (`app/tests/conftest.py:1-7,82-85`).

#### Contratos

Verifican que el contrato OpenAPI publicado (73 endpoints) sea coherente, esté versionado, esté
documentado y proteja las rutas privadas (`RepoTecnico/pruebas/plan_pruebas.md:21-23`). La prueba
construye el esquema con `app.openapi()` (`app/tests/test_contratos.py:12`) y comprueba, entre otras
cosas, que todas las rutas `/api/` estén bajo `/api/v1/`
(`app/tests/test_contratos.py:27-29`).

#### E2E de navegador

Recorren los flujos reales de la SPA con Playwright/Chromium contra la aplicación completa y el
esquema `ggto_e2e` (`RepoTecnico/pruebas/plan_pruebas.md:23-24`).

Quedan **fuera de alcance** las pruebas de carga, las de penetración y la app móvil Flutter (Ciclo
8, no desarrollado) (`RepoTecnico/pruebas/plan_pruebas.md:26-27`).

## Entornos de prueba

La batería distingue el esquema de `pytest` del esquema de Playwright y comparte una única vía de
acceso a la base mediante el proxy de Cloud SQL.

### ggto_test (pytest)

Es el esquema que usa la integración y los contratos. Su nombre se toma de la variable
`GGTO_TEST_SCHEMA`, con valor por defecto `public`
(`app/tests/conftest.py:25`). Con el valor de trabajo `ggto_test`, el `conftest` añade
`search_path` para que `public` siga resolviendo las extensiones `pgcrypto` y `pg_trgm`
(`app/tests/conftest.py:74-77`). Si el esquema no es `public`, lo crea con
`CREATE SCHEMA IF NOT EXISTS` antes de aplicar `schema.sql`
(`app/tests/conftest.py:82-85`). La lógica de `search_path` proviene del parámetro `DB_SCHEMA` de
la aplicación (`app/core/db.py:33-36`), corregido durante la Fase 4 (hallazgo F4-01,
`RepoTecnico/pruebas/informe_fase4.md:36`).

### ggto_e2e (Playwright)

Es el esquema aislado de las pruebas de navegador. `run_e2e.sh` lo fija con
`ESQUEMA="${DB_SCHEMA:-ggto_e2e}"` (`RepoTecnico/pruebas/run_e2e.sh:16`) y lo exporta como
`DB_SCHEMA` (`RepoTecnico/pruebas/run_e2e.sh:23`). `seed_e2e.py` lo reinicia y siembra desde `schema.sql`
(`RepoTecnico/pruebas/seed_e2e.py:44,60-84`). La aplicación bajo prueba se levanta con ese esquema y
la URL `http://127.0.0.1:8090` (`run_e2e.sh:30,49-51`).

### Cloud SQL Auth Proxy

Ambos entornos usan la instancia compartida `truekeate-db-dev` a través del **Cloud SQL Auth
Proxy**. El plan de pruebas lo describe escuchando en `127.0.0.1:5433`
(`RepoTecnico/pruebas/plan_pruebas.md:35`) y da el comando de arranque
(`RepoTecnico/pruebas/plan_pruebas.md:110-112`). `run_e2e.sh` usa ese puerto por defecto
(`RepoTecnico/pruebas/run_e2e.sh:19`) y comprueba la conectividad con `psql`
(`RepoTecnico/pruebas/run_e2e.sh:41-44`). El *proxy* es necesario porque la aplicación se ejecuta en local y la
instancia es gestionada; el manual `02-cloud-run-y-cloud-sql.md` de esta colección detalla la
conexión.

### Chromium y LD_LIBRARY_PATH/FONTCONFIG_FILE

Chromium en modo *headless* exige librerías del sistema y fuentes. `run_e2e.sh` exporta
`LD_LIBRARY_PATH` con `~/tools/libs` y `/tmp/playwright-libs`, y `FONTCONFIG_FILE` con la
configuración de fuentes del usuario (`RepoTecnico/pruebas/run_e2e.sh:28-29`). El plan advierte que,
sin fuentes, "el navegador no emite eventos de texto y los encabezados quedan con tamaño cero
(falsos negativos)" (`RepoTecnico/pruebas/plan_pruebas.md:42-45`). El hallazgo F4-04 documenta el
mismo problema y su mitigación (`RepoTecnico/pruebas/informe_fase4.md:39`). El comentario de
`helpers.js` repite la advertencia (`RepoTecnico/pruebas/e2e/helpers.js:5-8`).

## Pruebas backend

La batería de backend reúne pruebas unitarias, de integración y de contratos bajo el mismo
`pytest`.

### Estructura de app/tests

El directorio `app/tests/` contiene el paquete (`__init__.py`), el `conftest.py` y trece archivos
`test_*.py`. Los niveles se distinguen por lo que cada archivo necesita:

| Archivo | Nivel | Depende de base |
|---|---|---|
| `test_security.py` | Unitaria | No |
| `test_config_db.py` | Unitaria | No |
| `test_sectorizacion_cuadrilla0.py` | Unitaria | No |
| `test_ingesta_parser.py` | Unitaria | No |
| `test_contratos.py` | Contratos | No (usa `app.openapi()`) |
| `test_auth.py` | Integración | Sí |
| `test_config.py` | Integración | Sí |
| `test_casos_api.py` | Integración | Sí |
| `test_despacho_api.py` | Integración | Sí |
| `test_especiales_api.py` | Integración | Sí |
| `test_monitoreo_api.py` | Integración | Sí |
| `test_alertas_api.py` | Integración | Sí |
| `test_ingesta_api.py` | Integración | Sí |

### conftest.py

`app/tests/conftest.py` concentra el aprovisionamiento del entorno de pruebas
(`app/tests/conftest.py:1-171`):

- **URL y esquema de prueba:** lee `GGTO_TEST_DB_URL` y `GGTO_TEST_SCHEMA`
  (`app/tests/conftest.py:24-25`). Si no hay URL, las pruebas de integración se omiten con
  `pytest.skip` y las unitarias continúan (`app/tests/conftest.py:71-72`).
- **Recreación del esquema:** la *fixture* de sesión `engine` aplica `RepoTecnico/db/schema.sql`
  sobre la base (`app/tests/conftest.py:69-89`).
- **Aislamiento del limitador:** una *fixture* `autouse` limpia `routes_auth._intentos` antes y
  después de cada prueba, para que el *rate limiting* de RNF-22 no contamine la batería
  (`app/tests/conftest.py:59-66`).
- **Cliente HTTP:** la *fixture* `client` sustituye `get_db` por una fábrica de sesiones y envuelve
  la app en `TestClient` (`app/tests/conftest.py:102-121`).
- **Usuarios de prueba:** `TESTADM`, `TESTTEC` y `TESTSUP`, con una clave sintética definida en el
  propio `conftest.py`, creados por la *fixture* `admin_token`, que además devuelve las cabeceras
  `Bearer` de cada rol (`conftest.py:27-30,129-169`). El valor de la clave no se reproduce aquí por
  ser una credencial.
- **Limpieza:** el script `SQL_LIMPIEZA` borra los registros de prueba en orden de claves foráneas
  (`app/tests/conftest.py:33-56`). La muestra de ingesta pseudonimizada está en
  `RepoTecnico/muestras/detalle_averias_gpon_EJEMPLO.csv` (`app/tests/conftest.py:23`).

### Inventario por archivo

El informe de la Fase 4 desglosa las **169** pruebas ejecutadas
(`RepoTecnico/pruebas/informe_fase4.md:70-85`):

| Archivo | Pruebas | Nivel | Referencia |
|---|---|---|---|
| `test_alertas_api.py` | 23 | Integración | `RepoTecnico/pruebas/informe_fase4.md:72` |
| `test_despacho_api.py` | 17 | Integración | `RepoTecnico/pruebas/informe_fase4.md:73` |
| `test_casos_api.py` | 17 | Integración | `RepoTecnico/pruebas/informe_fase4.md:74` |
| `test_sectorizacion_cuadrilla0.py` | 16 | Unitaria | `RepoTecnico/pruebas/informe_fase4.md:75` |
| `test_monitoreo_api.py` | 16 | Integración | `RepoTecnico/pruebas/informe_fase4.md:76` |
| `test_especiales_api.py` | 15 | Integración | `RepoTecnico/pruebas/informe_fase4.md:77` |
| `test_contratos.py` | 14 | Contratos | `RepoTecnico/pruebas/informe_fase4.md:78` |
| `test_config.py` | 13 | Integración | `RepoTecnico/pruebas/informe_fase4.md:79` |
| `test_ingesta_parser.py` | 12 | Unitaria | `RepoTecnico/pruebas/informe_fase4.md:80` |
| `test_auth.py` | 11 | Integración | `RepoTecnico/pruebas/informe_fase4.md:81` |
| `test_security.py` | 6 | Unitaria | `RepoTecnico/pruebas/informe_fase4.md:82` |
| `test_ingesta_api.py` | 6 | Integración | `RepoTecnico/pruebas/informe_fase4.md:83` |
| `test_config_db.py` | 3 | Unitaria | `RepoTecnico/pruebas/informe_fase4.md:84` |
| **Total** | **169** | — | `RepoTecnico/pruebas/informe_fase4.md:85` |

Algunos archivos declaran menos funciones que pruebas ejecutadas porque usan parametrización de
`pytest`: `test_sectorizacion_cuadrilla0.py` emplea `@pytest.mark.parametrize`
(`app/tests/test_sectorizacion_cuadrilla0.py:22`) y `test_monitoreo_api.py` parametriza los periodos
`diario`, `semanal` y `mensual` (`app/tests/test_monitoreo_api.py:164`). Por eso el número de casos
ejecutados (169) coincide con el informe aunque el conteo de funciones `def test_` sea menor.

### Cómo ejecutarlas

El plan describe el procedimiento (`RepoTecnico/pruebas/plan_pruebas.md:107-124`). El modo directo es:

```bash
# Proxy (una vez)
~/tools/cloud-sql-proxy --gcloud-auth --port 5433 \
  truekeate-main:southamerica-east1:truekeate-db-dev &

# Integración + contratos
export GGTO_TEST_DB_URL="postgresql+psycopg2://ggtov2_app:<clave>@127.0.0.1:5433/ggtov2"
export GGTO_TEST_SCHEMA=ggto_test
python3 -m pytest app/tests -q
```

La cadena `<clave>` se obtiene del secreto `ggtov2-db-password`; **no se escribe en este manual**.
Sin `GGTO_TEST_DB_URL`, las pruebas de integración se omiten y las unitarias siguen corriendo
(`RepoTecnico/pruebas/informe_fase4.md:87-88`).

## Pruebas E2E

Las pruebas E2E validan la SPA completa en un navegador real contra un *backend* local.

### RepoTecnico/pruebas/e2e

El directorio `RepoTecnico/pruebas/e2e/` contiene el proyecto de Playwright: `package.json`,
`playwright.config.js`, `helpers.js`, `inventario.js` (utilidad de inspección) y la carpeta `tests/`
con once archivos `.spec.js`. La configuración fija `testDir: ./tests`, `timeout` de 90 s,
`expect` de 20 s, `workers: 1`, `fullyParallel: false` y `retries: 0`, con `baseURL` tomada de
`GGTO_E2E_URL` (`RepoTecnico/pruebas/e2e/playwright.config.js:9-32`). El proyecto es solo
`chromium` (`RepoTecnico/pruebas/e2e/playwright.config.js:33-38`), en modo `headless`, *viewport* 1440×900, idioma `es-VE` y
zona horaria `America/Caracas` (`RepoTecnico/pruebas/e2e/playwright.config.js:24-31`). Genera reporte de lista, JSON en
`../logs/e2e-resultados.json` y HTML en `../logs/e2e-reporte`
(`RepoTecnico/pruebas/e2e/playwright.config.js:19-23`). La versión declarada de `@playwright/test` es `1.63.0`
(`RepoTecnico/pruebas/e2e/package.json:11`).

### 11 archivos y 46 pruebas

El informe desglosa los once archivos y sus 46 pruebas
(`RepoTecnico/pruebas/informe_fase4.md:55-66`):

| Archivo | Pruebas | Ámbito | Referencia |
|---|---|---|---|
| `01-login.spec.js` | 6 | Login válido/inválido, ruta protegida, cierre de sesión, menú de usuario | `RepoTecnico/pruebas/informe_fase4.md:55` |
| `02-navegacion.spec.js` | 7 | Secciones, menú CONFIGURACIÓN, RBAC de menú, barra móvil, buscador | `RepoTecnico/pruebas/informe_fase4.md:56` |
| `03-casos.spec.js` | 6 | Listado, filtros, búsqueda global, ficha, alta manual `REF-…` | `RepoTecnico/pruebas/informe_fase4.md:57` |
| `04-especiales.spec.js` | 2 | Alta de caso especial y filtros | `RepoTecnico/pruebas/informe_fase4.md:58` |
| `05-agenda.spec.js` | 5 | Vistas día/semana/mes, navegación, alta de cita | `RepoTecnico/pruebas/informe_fase4.md:59` |
| `06-despacho.spec.js` | 3 | Propuesta, generación, falla masiva manual | `RepoTecnico/pruebas/informe_fase4.md:60` |
| `07-ingesta.spec.js` | 2 | Previsualización del CSV e historial de lotes | `RepoTecnico/pruebas/informe_fase4.md:61` |
| `08-monitoreo.spec.js` | 3 | Zonas del tablero, gráficos SVG, reporte de trabajo | `RepoTecnico/pruebas/informe_fase4.md:62` |
| `09-alertas.spec.js` | 4 | Métricas, RF-09, RF-17, RF-18, outbox | `RepoTecnico/pruebas/informe_fase4.md:63` |
| `10-configuracion.spec.js` | 4 | Alta de sector, técnico, causa y parámetros | `RepoTecnico/pruebas/informe_fase4.md:64` |
| `11-rbac.spec.js` | 4 | TECNICO solo lectura y ADMIN operativo | `RepoTecnico/pruebas/informe_fase4.md:65` |
| **Total** | **46** | — | `RepoTecnico/pruebas/informe_fase4.md:66` |

La utilidad `helpers.js` centraliza el inicio y cierre de sesión, el relleno de campos y la búsqueda
global (`RepoTecnico/pruebas/e2e/helpers.js:16-54`); los usuarios de prueba son `E2EADM` (ADMIN),
`E2ESUP` (SUPERVISOR) y `E2ETEC` (TECNICO) (`RepoTecnico/pruebas/e2e/helpers.js:10-14`). `inventario.js` no es una prueba,
sino un recorrido de rutas que vuelca encabezados, botones y tablas para inspección manual
(`RepoTecnico/pruebas/e2e/inventario.js:1-28`).

### run_e2e.sh

`run_e2e.sh` encadena comprobación de base, siembra, arranque de la app y Playwright
(`RepoTecnico/pruebas/run_e2e.sh:1-71`):

1. **Variables y puertos:** `GGTO_E2E_PORT` (por defecto `8090`), `DB_HOST` `127.0.0.1`,
   `DB_PORT` `5433`, `DB_NAME` `ggtov2`, `DB_USER` `ggtov2_app`, `DB_SSLMODE` `disable`
   (`RepoTecnico/pruebas/run_e2e.sh:15-23`).
2. **Rate limiting relajado:** eleva `RATE_LIMIT_INTENTOS` a 10000 para no recibir `429` por logins
   repetidos, y fija `SECRET_KEY=e2e-secret-key` (`RepoTecnico/pruebas/run_e2e.sh:24-26`); el hallazgo F4-05 documenta
   este ajuste (`RepoTecnico/pruebas/informe_fase4.md:40`).
3. **Comprobación de PostgreSQL:** usa `psql` y exige `DB_PASSWORD`
   (`RepoTecnico/pruebas/run_e2e.sh:34-44`).
4. **Siembra:** ejecuta `seed_e2e.py` y guarda la salida en `logs/seed.json`
   (`RepoTecnico/pruebas/run_e2e.sh:46-47`).
5. **Arranque:** levanta `uvicorn app.main:app` en segundo plano y espera a `/health`
   (`RepoTecnico/pruebas/run_e2e.sh:49-59`).
6. **Ejecución:** `npx playwright test "$@"` desde el directorio E2E
   (`RepoTecnico/pruebas/run_e2e.sh:61-66`).
7. **Limpieza:** mata el *backend* y propaga el código de salida de Playwright
   (`RepoTecnico/pruebas/run_e2e.sh:68-71`).

Permite ejecutar un solo archivo pasando la ruta como argumento
(`RepoTecnico/pruebas/plan_pruebas.md:123-124`).

### seed_e2e.py

`seed_e2e.py` prepara el esquema y los datos deterministas
(`RepoTecnico/pruebas/seed_e2e.py:1-203`). Crea el esquema y trunca sus tablas con
`RESTART IDENTITY CASCADE` si ya existen (`RepoTecnico/pruebas/seed_e2e.py:60-76`) y luego aplica `schema.sql`
(`RepoTecnico/pruebas/seed_e2e.py:78-84`). Siembra:

- Tres usuarios con su ficha de técnico: `E2EADM` (ADMIN), `E2ESUP` (SUPERVISOR) y `E2ETEC`
  (TECNICO), con una clave sintética común definida en el propio script
  (`seed_e2e.py:48-52,104-114`). El valor no se reproduce aquí por ser una credencial.
- El sector `E2E-S1` con el patrón `CALLE E2E` (`RepoTecnico/pruebas/seed_e2e.py:117-122`).
- La flota `E2ECAN01` y la cuadrilla `E2E-C1` con el técnico `E2ETEC`
  (`RepoTecnico/pruebas/seed_e2e.py:124-135`).
- La causa `E2E`/`01` (`RepoTecnico/pruebas/seed_e2e.py:137-141`).
- **Ocho casos** `E2E-0001`…`E2E-0008`, seis de ellos concentrados en `e2e-olt-00` para disparar la
  detección de fallas con umbral 5 (`RepoTecnico/pruebas/seed_e2e.py:143-177`).

El resumen que imprime incluye esquema, central, usuarios, sector, cuadrilla y número de casos
(`RepoTecnico/pruebas/seed_e2e.py:180-199`); la ejecución real dejó ese resumen en `RepoTecnico/pruebas/logs/seed.json`.
El script **aborta** si `DB_SCHEMA` es `public` o está vacío, para no tocar producción
(`RepoTecnico/pruebas/seed_e2e.py:190-192`).

## Calidad estática

Además de las pruebas, la Fase 4 exige `ruff`, `mypy` y `tsc` strict sin hallazgos
(`RepoTecnico/pruebas/plan_pruebas.md:55`, `RepoTecnico/pruebas/informe_fase4.md:20`).

### ruff

La configuración vive en `pyproject.toml`: longitud de línea 110, objetivo `py312`, exclusión de
`app/web` y selección de reglas `E`, `F`, `I`, `B`, `UP`, `RUF`, con `B008` ignorada porque FastAPI
usa `Depends(...)` como valor por defecto (`pyproject.toml:1-12`). El comando de CI es
`ruff check app` (`.github/workflows/ci.yml:47-48`).

### mypy

La configuración declara `python_version = "3.12"`, `ignore_missing_imports = true`,
`warn_unused_ignores = true` y excluye `app/web/` (`pyproject.toml:14-18`). El comando de CI es
`mypy app --ignore-missing-imports` (`.github/workflows/ci.yml:50-51`).

### tsc strict

El frontend se compila con TypeScript estricto: `strict: true` y `noFallthroughCasesInSwitch: true`
en `app/web/tsconfig.json:18-19`, y el *script* de build es `tsc && vite build`
(`app/web/package.json:9`). El informe registra `tsc` strict sin hallazgos
(`RepoTecnico/pruebas/informe_fase4.md:20`). **Pendiente de confirmar** si `tsc` se ejecuta en algún
flujo automatizado: el único *workflow* del repositorio solo corre el trabajo de backend
(`.github/workflows/ci.yml:9-54`).

## Resultado Fase 4

La Fase 4 cerró con 215 pruebas en verde y los tres analizadores estáticos sin hallazgos
(`RepoTecnico/pruebas/informe_fase4.md:103-107`).

### 169/169 pytest

La corrida real registró `169 passed, 1 warning` en 2251,20 s (37 min 31 s) contra PostgreSQL 15.18
y el esquema aislado `ggto_test` (`RepoTecnico/pruebas/logs/pytest-resultados.txt`). El único aviso
es una `StarletteDeprecationWarning` por el uso de `httpx` con `starlette.testclient`
(`RepoTecnico/pruebas/logs/pytest.log`). El informe resume `169 passed (37.5m)`
(`RepoTecnico/pruebas/informe_fase4.md:22-23`).

### 46/46 E2E

La corrida de Playwright registró `46 expected, 0 unexpected, 0 flaky` en 441461 ms (unos 7,4 min)
(`RepoTecnico/pruebas/logs/e2e-resultados.json`, campo `stats`). El informe lo resume como
`46 passed (7.4m)` y deja el HTML en `logs/e2e-reporte/` y el JSON en
`logs/e2e-resultados.json` (`RepoTecnico/pruebas/informe_fase4.md:25`). La cobertura funcional
incluye autenticación, navegación y RBAC, casos, especiales, agenda, despacho, ingesta CSV,
monitoreo/reportes, alertas y configuración (`RepoTecnico/pruebas/informe_fase4.md:26-28`).

### Hallazgos F4-01 a F4-06

El informe documenta seis hallazgos (`RepoTecnico/pruebas/informe_fase4.md:34-45`):

| ID | Hallazgo | Severidad | Estado | Referencia |
|---|---|---|---|---|
| F4-01 | Las pruebas no podían aislarse de producción: faltaba fijar el esquema; se añadió `DB_SCHEMA` con `search_path` | Media | Corregido | `RepoTecnico/pruebas/informe_fase4.md:36` |
| F4-02 | 56 etiquetas `<label>` de CONFIGURACIÓN sin asociar a su control; se añadió `htmlFor`+`id` | Media (accesibilidad) | Corregido | `RepoTecnico/pruebas/informe_fase4.md:37` |
| F4-03 | `test_monitoreo_api.py` capturaba la fecha al importar; una corrida que cruzaba medianoche fallaba | Alta (falso negativo en CI nocturno) | Corregido | `RepoTecnico/pruebas/informe_fase4.md:38` |
| F4-04 | Chromium *headless* no emitía eventos de texto; faltaban fuentes y librerías | Baja (solo entorno de pruebas) | Mitigado | `RepoTecnico/pruebas/informe_fase4.md:39` |
| F4-05 | El limitador de intentos producía `429` durante la batería E2E | Baja (solo entorno de pruebas) | Mitigado | `RepoTecnico/pruebas/informe_fase4.md:40` |
| F4-06 | `test_cita_cuenta_en_el_dia` fallaba por una variable local `hoy` que tapaba la función introducida por F4-03 | Media (regresión de F4-03) | Corregido | `RepoTecnico/pruebas/informe_fase4.md:41` |

F4-01, F4-02, F4-03 y F4-06 son correcciones aplicadas al código; F4-04 y F4-05 son
particularidades del entorno de pruebas, no del producto (`RepoTecnico/pruebas/informe_fase4.md:43-45`). La Fase 4 no
deja defectos funcionales abiertos (`RepoTecnico/pruebas/informe_fase4.md:106-107`).

## CI

La integración continua se materializa en un único *workflow* de GitHub Actions.

### .github/workflows/ci.yml

El archivo se llama `CI` y se dispara en `push` y `pull_request` sobre las ramas `GGTOv2-DSH-GCP` y
`main` (`.github/workflows/ci.yml:1-7`). Tiene un solo trabajo, `backend`, que corre en
`ubuntu-latest` (`.github/workflows/ci.yml:9-12`) y declara un servicio PostgreSQL:

| Aspecto | Valor | Referencia |
|---|---|---|
| Imagen | `postgres:15` | `.github/workflows/ci.yml:16` |
| Usuario / clave / base | `postgres` / `postgres` / `ggto_test` | `.github/workflows/ci.yml:18-20` |
| Puerto | `5432:5432` | `.github/workflows/ci.yml:21-22` |
| *Health check* | `pg_isready -U postgres`, 10 s, 5 reintentos | `.github/workflows/ci.yml:23-27` |
| `GGTO_TEST_DB_URL` | URL de la base de servicio de CI (`postgres` en `localhost:5432/ggto_test`; la clave es la del servicio efímero) | `.github/workflows/ci.yml:30` |
| `GGTO_TEST_SCHEMA` | `public` | `.github/workflows/ci.yml:31` |
| `SECRET_KEY` / `APP_ENV` | Valor de prueba / `test` | `.github/workflows/ci.yml:32-33` |

Los pasos del trabajo son: `actions/checkout@v4` (`.github/workflows/ci.yml:36`); `actions/setup-python@v5` con
Python 3.12 y caché de `pip` sobre `app/requirements-dev.txt` (`.github/workflows/ci.yml:38-42`); instalación de
dependencias de desarrollo (`.github/workflows/ci.yml:44-45`); `ruff check app` (`.github/workflows/ci.yml:47-48`);
`mypy app --ignore-missing-imports` (`.github/workflows/ci.yml:50-51`); y `pytest app/tests -q` (`.github/workflows/ci.yml:53-54`). Las
dependencias de desarrollo son `-r requirements.txt` más `pytest`, `httpx`, `ruff` y `mypy`
(`app/requirements-dev.txt:1-5`).

### Comparación con lo previsto

La decisión D-38 y los requisitos técnicos preveían un CI/CD más amplio que el implementado
(`RepoTecnico/estado_proyecto.md:102`, `RepoTecnico/requerimientos.md:288-289`).

| Elemento previsto | Requisito / decisión | Estado real |
|---|---|---|
| Cobertura mínima 70 % | RNF-24 (`RepoTecnico/requerimientos.md:203`), D-38 (`RepoTecnico/estado_proyecto.md:102`) | **No implementado** en el CI: no hay `pytest-cov` en `app/requirements-dev.txt` ni configuración de cobertura en `pyproject.toml` |
| Migraciones versionadas con Alembic | RT-13 (`RepoTecnico/requerimientos.md:288`), `RepoTecnico/entornos_globales.md:240` | **No implementado**: no existe `alembic.ini` ni carpeta `db/migrations/`; el esquema se aplica desde `db/schema.sql` |
| Build de imagen y despliegue a Cloud Run | RT-14 (`RepoTecnico/requerimientos.md:289`), `RepoTecnico/entornos_globales.md:247` | **No implementado** en el CI: `ci.yml` no compila ni publica la imagen; el despliegue se hizo manualmente |
| Espejo en GitLab CI | D-38 (`RepoTecnico/estado_proyecto.md:102`), `RepoTecnico/entornos_globales.md:247` | **Pendiente de confirmar**: no existe `.gitlab-ci.yml` en el repositorio |
| Análisis estático del frontend (`tsc`) | Plan de pruebas (`RepoTecnico/pruebas/plan_pruebas.md:55`) | **No automatizado**: `tsc` se ejecuta en el build local de la SPA (`app/web/package.json:9`), pero no hay trabajo de frontend en el CI |

El CI implementado cubre, por tanto, lint, tipos y pruebas de backend sobre PostgreSQL 15; la
cobertura, las migraciones versionadas, el build de imagen, el espejo en GitLab y el análisis
estático del frontend quedan como brechas frente a lo previsto y se registran aquí como pendientes
de confirmar en cuanto a su planificación.
