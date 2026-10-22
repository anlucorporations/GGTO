# Incremento D-151 — Integración continua real y línea base reproducible (H-17)

| Campo | Valor |
|---|---|
| Origen | **H-17** del `INFORME_OPTIMIZACION_V2.md` (calidad y entrega) |
| Fecha | 2026-10-21 |
| Alcance | CI, configuración de pruebas y manuales · sin cambios de comportamiento en producción |
| Autor | Dirección del proyecto |

---

## 1. El defecto

El manual de pruebas describía un *workflow* que **no existía**: `.github/` se había borrado
en `d818bcb` (2026-10-06). Además:

- La cobertura mínima del 70 % (RNF-24) no se medía: faltaba `pytest-cov` y no había
  configuración de cobertura.
- La suite podía quedar **verde sin tocar la base**: `conftest` usaba `public` por defecto y
  omitía las pruebas de integración si faltaba `GGTO_TEST_DB_URL`.
- `ruff check app` daba **7 hallazgos** y `mypy app` **7 errores**, así que el criterio
  «lint y tipos sin hallazgos» no se cumplía.
- Seis manuales citaban el CI con líneas exactas y un servicio `postgres:15`.

## 2. Corrección

### 2.1 Workflow con tres trabajos

Nuevo `.github/workflows/ci.yml` (dispara en `push` y `pull_request` sobre
`GGTOv2-DSH-GCP` y `main`, con `concurrency` para cancelar corridas viejas):

| Trabajo | Qué hace |
|---|---|
| `backend` | Python 3.12 + PostgreSQL **15**; `ruff check app`; `mypy app`; `pytest` con cobertura y **`--cov-fail-under=70`**; publica `coverage.xml`. |
| `web` | Node 20; `npm ci`; `npm run build` (`tsc` + `vite build`). |
| `apk` | Flutter **3.24.5**; `flutter pub get`; `flutter analyze`; `flutter test`. |

El servicio de PostgreSQL es efímero (`postgres`/`postgres`, base `ggto_test`) y la suite usa
el esquema desechable **`ggto_ci`**, nunca `public`.

### 2.2 La suite ya no puede quedar verde sin base

- `GGTO_REQUIRE_DB=1` (definido en CI) hace que el *fixture* de base **falle** en lugar de
  omitir las pruebas de integración.
- `GGTO_TEST_SCHEMA` pasa a tener por defecto **`ggto_test`**; `public` está **prohibido**
  salvo `GGTO_ALLOW_PUBLIC_SCHEMA=1`, porque el `conftest` borra y recrea el esquema.
- Se añadió `pytest-cov` a `app/requirements-dev.txt` y la configuración
  `[tool.coverage.run]` / `[tool.coverage.report]` a `pyproject.toml`.
- `.gitignore` ignora `.coverage*`, `coverage.xml`, `coverage.json` y `htmlcov/`.

### 2.3 Lint y tipos a cero

| Archivo | Corrección |
|---|---|
| `app/api/routes_auditoria.py` | `Query(...)` partido en varias líneas (E501). |
| `app/models/mensaje_entities.py` | CHECK de destino construido con `" OR ".join(...)` (E501). |
| `app/tests/test_d145_ingesta_manual.py` | imports `Solicitante` y `Despacho` sin usar (F401). |
| `app/api/routes_casos.py` | anotación `numero: int`. |
| `app/api/routes_despachos.py` | el seguimiento de construcciones usa `DiaConstruccionOut` y `SectorConstruccionSeguimientoOut` en lugar de diccionarios sin tipo. |
| `app/services/efectividad.py` | variable de bucle renombrada para no reutilizar el tipo de una fila SQL. |
| `app/tests/test_d99_masivas.py`, `app/tests/test_sync_api.py` | `cuerpo: dict[str, object]`. |

### 2.4 Manuales

Se corrigieron los seis manuales que describían el CI: `04-pruebas-y-ci.md` (sección CI
reescrita: tres trabajos, PostgreSQL 18, cobertura, línea base), `01-entornos-y-variables.md`,
`02-configuracion.md`, `01-backend.md`, `02-stack-backend.md` y `03-stack-frontend.md`.

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| `ruff check app` | **0 hallazgos** |
| `mypy app` | **0 errores en 126 archivos** |
| Suite completa contra PostgreSQL 18 local (esquema desechable) | **556 passed, 1 warning en 8m15s** |
| Cobertura del backend | **90,54 %** (umbral 70 %) |
| Web (`npm run build`) | `tsc` + `vite build` correctos (17,45 s) |
| APK (`flutter analyze`) | **No issues found!** |
| APK (`flutter test`) | **274 pruebas en verde** |
| `GGTO_REQUIRE_DB=1` sin URL | la suite **falla** (comprobado) |
| `GGTO_TEST_SCHEMA=public` | la suite **falla** (comprobado) |
| YAML del workflow | parsea; tres trabajos (`backend`, `web`, `apk`) |

La corrida completa se hizo sobre una instancia PostgreSQL 18.6 local efímera (puerto 55432,
autenticación local, esquema `ggto_ci`), no sobre producción ni sobre el proxy; el CI usa
`postgres:15`, la versión de producción.

## 4. Residuales

1. **El CI se estrena con el próximo push**: el archivo está en el repositorio, pero la
   primera ejecución real en GitHub Actions ocurre al publicar este commit.
2. **No hay `.gitlab-ci.yml`**: el espejo en GitLab sigue sin pipeline.
3. **E2E de Playwright fuera del CI**: se ejecutan con `RepoTecnico/pruebas/run_e2e.sh`.
4. **Sin build de imagen ni despliegue automático**: siguen siendo manuales
   (`scripts/11_desplegar_ggto_web.sh`).
5. **Alembic**: el esquema se sigue aplicando desde `db/schema.sql` (RT-13).
