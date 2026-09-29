# Plan de Pruebas — GGTO (Fase 4)

| Campo | Valor |
|---|---|
| Proyecto | GGTO — CANTV, Central Francisco Salias (Área 4) |
| Fase | **Fase 4 — Pruebas** |
| Versión | v1.0 |
| Aplicación | `app/` — FastAPI + PostgreSQL + SPA React (`app/web`) |
| Entorno | **Aislado** (`ggto_e2e` / `ggto_test`); nunca producción |

---

## 1. Objetivo y alcance

Validar que el sistema entregado en la Fase 3 cumple sus requisitos con **100 %
de pruebas en verde**, cubriendo cuatro niveles complementarios:

1. **Unitarias** — lógica pura sin base de datos (URL de conexión, backoff, palabras).
2. **Integración** — API contra PostgreSQL, con esquema recreado desde
   `RepoTecnico/db/schema.sql` (`ggto_test`).
3. **Contratos** — el contrato OpenAPI publicado (73 endpoints) es coherente,
   versionado, documentado y protege las rutas privadas.
4. **E2E de navegador** — los flujos reales de la SPA con Playwright/Chromium
   contra la aplicación completa (`ggto_e2e`).

**Fuera de alcance:** pruebas de carga, de penetración y la app móvil Flutter
(Ciclo 8, no desarrollado).

---

## 2. Entorno de pruebas

| Aspecto | Valor |
|---|---|
| Base de datos | PostgreSQL 15 (`truekeate-db-dev`) vía **Cloud SQL Auth Proxy** en `127.0.0.1:5433` |
| Esquema de integración | `ggto_test` (lo recrea `app/tests/conftest.py`) |
| Esquema E2E | `ggto_e2e` (lo recrea `RepoTecnico/pruebas/seed_e2e.py`) |
| Aplicación E2E | `uvicorn app.main:app` en `http://127.0.0.1:8090` con `DB_SCHEMA=ggto_e2e` |
| Navegador | Chromium 1243 (Playwright 1.63), headless |
| Datos | Usuarios `E2EADM`/`E2ESUP`/`E2ETEC`, sector `E2E-S1`, cuadrilla `E2E-C1`, 8 casos `E2E-…` |

> **Nota de entorno:** Chromium requiere `LD_LIBRARY_PATH` (librerías del sistema
> en `~/tools/libs` y `/tmp/playwright-libs`) y `FONTCONFIG_FILE` con fuentes
> DejaVu. Sin fuentes, el navegador no emite eventos de texto y los encabezados
> quedan con tamaño cero (falsos negativos). `run_e2e.sh` exporta ambos.

---

## 3. Herramientas

| Nivel | Herramienta | Ubicación |
|---|---|---|
| Unitarias / integración / contratos | `pytest` | `app/tests/` |
| E2E navegador | `@playwright/test` | `RepoTecnico/pruebas/e2e/` |
| Calidad estática | `ruff`, `mypy`, `tsc` (strict) | raíz / `app/web` |

> **Nota:** el proyecto no usa blockchain, por lo que no aplica *Forge*; el marco
> acordado es `pytest` + `Playwright`, ya empleado en los ciclos 1–9.

---

## 4. Casos de prueba E2E

| ID | Archivo | Flujo | RF/RNF |
|---|---|---|---|
| E2E-01 | `01-login.spec.js` | Login válido/inválido, ruta protegida, cierre de sesión, menú de usuario | RF-20, RNF-21/22 |
| E2E-02 | `02-navegacion.spec.js` | 8 secciones, menú CONFIGURACIÓN, RBAC de menú, barra en móvil, buscador y alta | RF-33, RNF-09 |
| E2E-03 | `03-casos.spec.js` | Listado, filtro por estado, búsqueda por avería/teléfono, ficha, alta manual `REF-…` | RF-30…RF-33 |
| E2E-04 | `04-especiales.spec.js` | Alta de caso especial (REFERIDO/CONSTRUCCIÓN) y listado | RF-35/RF-36 |
| E2E-05 | `05-agenda.spec.js` | Vistas día/semana/mes, navegación y alta de cita | RF-12, RNF-04 |
| E2E-06 | `06-despacho.spec.js` | Propuesta, generación del despacho y falla masiva manual | RF-08/09/24 |
| E2E-07 | `07-ingesta.spec.js` | Previsualización del CSV diario e historial de lotes | RF-01/RF-02 |
| E2E-08 | `08-monitoreo.spec.js` | Zonas del tablero, gráficos SVG y reporte de trabajo | RF-26/RF-28 |
| E2E-09 | `09-alertas.spec.js` | Métricas, detección RF-09, planificación RF-17, material RF-18 y outbox | RF-09/16/17/18, RNF-19/20 |
| E2E-10 | `10-configuracion.spec.js` | Alta de sector, técnico y causa; parámetros | RF-03…RF-05 |
| E2E-11 | `11-rbac.spec.js` | TECNICO solo lectura y sin escritura en ALERTAS | RNF-21 |
| E2E-12 | `12-ayuda.spec.js` | AYUDA: índice temas/secciones/sub-secciones, buscador, HTML y PDF | RF-33, D-63 |
| E2E-13 | `13-ui-requisitos.spec.js` | Barra PC (solo nombres) y móvil (solo iconos), modales al 90 % con título/cerrar y tablas al 90 % con pie de conteo | RNF-09, D-64 |
| E2E-14 | `14-operacion-filtros-ficha.spec.js` | Filtros en una fila sin Origen ni rango de fechas, OPERACIÓN fusionada y ficha rápida con pestañas | RNF-09, D-65 |
| E2E-15 | `15-proceso-despacho.spec.js` | Proceso del despacho en formulario flotante (universo, sectores, cuadrillas), asignación dinámica de sectores y especiales | RF-24, D-66 |
| E2E-16 | `16-primer-acceso-tecnicos.spec.js` | Primer acceso del técnico (clave + 12 palabras), estado de la cuenta y regeneración por el Super Usuario | RF-02, RF-20, D-67 |

---

## 5. Matriz de trazabilidad (resumen)

| Requisito | Nivel que lo cubre |
|---|---|
| RF-01/RF-02 (ingesta CSV) | Integración + E2E-07 |
| RF-03…RF-05 (configuración) | Integración + E2E-10 |
| RF-06/RF-09/RF-16 (alertas, MCP, Telegram) | Integración + Contratos + E2E-09 |
| RF-08/RF-24/RF-25/RF-27 (despacho y reportes) | Integración + E2E-06 |
| RF-12/RF-34…RF-36 (agenda, seguimiento, especiales) | Integración + E2E-04/05 |
| RF-17/RF-18 (planificación y material) | Integración + E2E-09 |
| RF-20/RF-30…RF-33 (auth, panel, casos) | Integración + Contratos + E2E-01/03 |
| RF-26/RF-28 (monitoreo y reportes) | Integración + E2E-08 |
| RNF-09/21/22 (usabilidad, RBAC, bloqueo) | E2E-02/11 + Integración |
| RNF-19/RNF-20 (observabilidad y outbox) | Integración + E2E-09 |

---

## 6. Criterios de salida (Fase 4)

- [ ] `pytest` completo en verde (unitarias + integración + contratos).
- [ ] Playwright E2E completo en verde (escritorio y móvil simulado).
- [ ] `ruff`, `mypy` y `tsc` strict sin hallazgos.
- [ ] Todo defecto encontrado: corregido, con causa y solución documentadas.
- [ ] Informe en `RepoTecnico/pruebas/informe_fase4.md` con logs en `logs/`.

---

## 7. Cómo ejecutar

```bash
# 0. Proxy (una vez)
~/tools/cloud-sql-proxy --gcloud-auth --port 5433 \
  truekeate-main:southamerica-east1:truekeate-db-dev &

# 1. Integración + contratos
export GGTO_TEST_DB_URL="postgresql+psycopg2://ggtov2_app:<clave>@127.0.0.1:5433/ggtov2"
export GGTO_TEST_SCHEMA=ggto_test
python3 -m pytest app/tests -q

# 2. E2E de navegador (siembra, levanta la app y ejecuta Playwright)
export DB_PASSWORD="<clave>"
RepoTecnico/pruebas/run_e2e.sh

# 3. Un solo archivo E2E
RepoTecnico/pruebas/run_e2e.sh tests/09-alertas.spec.js
```
