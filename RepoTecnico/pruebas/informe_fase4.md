# Informe de Pruebas — Fase 4

| Campo | Valor |
|---|---|
| Proyecto | GGTO — CANTV, Central Francisco Salias (Área 4) |
| Fase | **Fase 4 — Pruebas** |
| Versión evaluada | `app/` v0.9.0 (Ciclos 1–7 y 9) |
| Entorno | Esquemas aislados `ggto_test` (integración/contratos) y `ggto_e2e` (E2E) |
| Plan | `RepoTecnico/pruebas/plan_pruebas.md` |
| Logs | `RepoTecnico/pruebas/logs/` |

---

## 1. Resumen global

| Nivel | Herramienta | Ejecutadas | Pasadas | Fallidas |
|---|---|---|---|---|
| Unitarias + integración + contratos | `pytest` | **195** | **195** | **0** |
| E2E de navegador | Playwright/Chromium | **77** | **77** | **0** |
| Calidad estática | `ruff` / `mypy` / `tsc` strict | 3 | 3 | 0 |

- `pytest`: `195 passed (1:01:03)` — resumen en `logs/pytest-resultados.txt`
  (log completo en `logs/pytest.log`).
- E2E: `77 passed (23.8m)` — informe en `logs/e2e-resultados.json` y
  `logs/e2e-reporte/`.
- Cobertura E2E: autenticación, navegación y RBAC, casos, especiales, agenda,
  despacho, ingesta CSV, monitoreo/reportes, alertas (RF-09/16/17/18 y outbox),
  configuración, **AYUDA** (manuales y PDF) y **requisitos de UI** (D-64).

---

## 2. Hallazgos y correcciones

| ID | Hallazgo | Severidad | Causa | Solución | Estado |
|---|---|---|---|---|---|
| F4-01 | Las pruebas no podían aislarse de producción: la aplicación no permitía fijar el esquema de PostgreSQL. | Media | `app/core/db.py` construía la URL sin `search_path`. | Nuevo parámetro `DB_SCHEMA` que añade `options=-csearch_path=<esquema>,public`. Retrocompatible (vacío = comportamiento anterior). Pruebas unitarias en `app/tests/test_config_db.py`. | Corregido |
| F4-02 | 56 etiquetas `<label>` de CONFIGURACIÓN sin asociar a su control. | Media (accesibilidad, RNF-09/23) | Formularios con `<label>Texto</label>` sin `htmlFor`. | Asociación `htmlFor`+`id` en `Centrales`, `Sectores`, `Técnicos`, `Flota`, `Cuadrillas`, `Catálogos` y `Parámetros`. | Corregido |
| F4-03 | `test_monitoreo_api.py` capturaba la fecha al importar el módulo (`HOY = date.today()`). Una corrida que cruzaba la medianoche hacía que los registros creados «hoy» no coincidieran con la fecha consultada: 4 pruebas fallaron con `assert 0 == N`. | Alta (falso negativo en CI nocturno) | Constante evaluada en la colección de pytest, no en la ejecución. | `HOY` pasa a la función `hoy()`, evaluada dentro de cada prueba; se usa también para `rango_semana` y el cálculo del día operativo. | Corregido |
| F4-04 | Chromium headless no emitía eventos de texto y los encabezados medían 0×0. | Baja (solo entorno de pruebas) | Faltaban fuentes y librerías del sistema. | `run_e2e.sh` exporta `LD_LIBRARY_PATH` y `FONTCONFIG_FILE`; se documenta en el plan. | Mitigado |
| F4-05 | El limitador de intentos (RNF-22) producía `429` durante la batería E2E. | Baja (solo entorno de pruebas) | Más de 10 inicios de sesión por minuto con el mismo P00. | `RATE_LIMIT_INTENTOS` elevado en `run_e2e.sh`; en producción se mantiene en 10/min. | Mitigado |
| F4-06 | `test_cita_cuenta_en_el_dia` fallaba con `TypeError: 'datetime.datetime' object is not callable`. | Media (regresión introducida por F4-03) | La corrección F4-03 introdujo la función `hoy()`, pero la prueba conservaba una variable local `hoy = datetime.now()…` que **tapaba** la función. | La variable local pasa a llamarse `ahora`; la fecha consultada se obtiene de `hoy()`. | Corregido |

> **Sin defectos funcionales pendientes.** Los hallazgos F4-01…F4-03 y F4-06 son
> correcciones aplicadas al código; F4-04 y F4-05 son particularidades del
> entorno de pruebas, no del producto.

---

## 3. Detalle de la ejecución

### 3.1 E2E de navegador (Playwright/Chromium, esquema `ggto_e2e`)

| Archivo | Pruebas | Pasadas | Ámbito |
|---|---|---|---|
| `01-login.spec.js` | 6 | 6 | Login válido/inválido, ruta protegida, cierre de sesión, menú de usuario |
| `02-navegacion.spec.js` | 7 | 7 | Secciones, menú CONFIGURACIÓN, RBAC de menú, barra móvil, buscador |
| `03-casos.spec.js` | 6 | 6 | Listado, filtros, búsqueda global, ficha, alta manual `REF-…` |
| `04-especiales.spec.js` | 2 | 2 | Alta de caso especial y filtros |
| `05-agenda.spec.js` | 5 | 5 | Vistas día/semana/mes, navegación, alta de cita |
| `06-despacho.spec.js` | 3 | 3 | Propuesta, generación, falla masiva manual |
| `07-ingesta.spec.js` | 2 | 2 | Previsualización del CSV e historial de lotes |
| `08-monitoreo.spec.js` | 3 | 3 | Zonas del tablero, gráficos SVG, reporte de trabajo |
| `09-alertas.spec.js` | 4 | 4 | Métricas, RF-09, RF-17, RF-18, outbox |
| `10-configuracion.spec.js` | 4 | 4 | Alta de sector, técnico, causa y parámetros |
| `11-rbac.spec.js` | 4 | 4 | TECNICO solo lectura y ADMIN operativo |
| `12-ayuda.spec.js` | 5 | 5 | AYUDA: índice temas/secciones/sub-secciones, buscador, HTML y PDF (Fase 5) |
| `13-ui-requisitos.spec.js` | 5 | 5 | Barra PC/móvil, modal 90 % con título y cerrar, ficha modal y tabla 90 % con pie (D-64) |
| `14-operacion-filtros-ficha.spec.js` | 4 | 4 | Filtros en una fila sin Origen ni rango de fechas, OPERACIÓN fusionada y ficha rápida con pestañas (D-65) |
| `15-proceso-despacho.spec.js` | 3 | 3 | Proceso del despacho en formulario flotante, asignación de sectores y especiales (D-66) |
| `16-primer-acceso-tecnicos.spec.js` | 3 | 3 | Primer acceso del técnico, estado de la cuenta y regeneración por el SUPER (D-67) |
| `17-sistemas-y-roles.spec.js` | 5 | 5 | SISTEMAS solo para el SUPER, cambio de rol en TÉCNICOS y gestión del estado por el TECNICO (D-68/D-69) |
| `18-ficha-pestanas.spec.js` | 6 | 6 | Ficha en pestañas con 3 datos por línea, edición limitada por icono, Resolución (cerrar/cita/enrutar) e Histórico (D-70) |
| **Total** | **77** | **77** | `77 passed (23.8m)` |

### 3.2 `pytest` (esquema `ggto_test`)

| Archivo | Pruebas | Nivel | Ámbito |
|---|---|---|---|
| `test_alertas_api.py` | 23 | Integración | Detección RF-09, planificación RF-17, material RF-18, outbox y canales |
| `test_sistemas_api.py` | 3 | Integración | Inspección de la BD: estructura, detalle y contenido ofuscado (D-69) |
| `test_despacho_api.py` | 23 | Integración | Propuesta, asignación diaria de sectores, proceso, especiales y fallas masivas (D-66) |
| `test_casos_api.py` | 17 | Integración | Búsqueda, filtros, ficha, edición, alta `REF-…` y bitácora |
| `test_sectorizacion_cuadrilla0.py` | 16 | Unitaria | Sectorización por dirección y criterio de cuadrilla 0 |
| `test_monitoreo_api.py` | 16 | Integración | Gestión diaria/semanal, globales, capacidad y reportes |
| `test_especiales_api.py` | 15 | Integración | Referidos/empresas/gobierno, solicitante y seguimiento |
| `test_contratos.py` | 14 | Contratos | Coherencia, versionado y protección del OpenAPI (79 endpoints) |
| `test_config.py` | 13 | Integración | CRUD de configuración y RBAC de escritura |
| `test_ingesta_parser.py` | 12 | Unitaria | Parser ISO-8859-1 de 80 columnas y fechas `a.m./p.m.` |
| `test_auth.py` | 15 | Integración | Login, bloqueo, primer acceso, estado de cuenta, 12 palabras y regeneración (D-67) |
| `test_security.py` | 6 | Unitaria | Hash Argon2id, JWT y utilidades de seguridad |
| `test_ingesta_api.py` | 8 | Integración | Preview, carga, direcciones sin sector y re-sectorización (D-66) |
| `test_config_db.py` | 3 | Unitaria | Construcción de la URL de conexión y `search_path` |
| **Total** | **195** | — | `195 passed (1:01:03)` |

- Sin base de datos no se ejecuta la integración: el `conftest` omite esos casos
  cuando `GGTO_TEST_DB_URL` no está definida (las unitarias siguen corriendo).

---

## 4. Criterios de salida

- [x] `pytest` completo en verde (195/195).
- [x] Playwright E2E completo en verde (77/77).
- [x] `ruff`, `mypy` y `tsc` strict sin hallazgos.
- [x] Hallazgos corregidos y documentados.

---

## 5. Conclusión

La **Fase 4 cierra con 272 pruebas en verde** (195 de `pytest` + 77 E2E) y los
tres analizadores estáticos sin hallazgos. Se encontraron y corrigieron **seis
hallazgos** (F4-01…F4-06): tres de producto/entorno de pruebas y tres defectos de
las propias pruebas. **No quedan defectos funcionales abiertos** y los criterios
de salida de `plan_pruebas.md` §6 se cumplen en su totalidad.

> **Regresión de la Fase 5:** al integrar la sección AYUDA en la SPA se añadió
> `12-ayuda.spec.js` (5 casos) y se repitió la suite E2E completa: **60/60**, sin
> regresiones sobre los casos previos.
>
> **Ciclo de UI (D-64):** la conversión de formularios/fichas a modales del 90 %
> y el pie de conteo en las tablas se validó con `13-ui-requisitos.spec.js`
> (5 casos que miden el 90 % de la ventana y la barra por dispositivo), además
> de actualizar los especímenes de configuración, agenda, despacho e ingesta al
> nuevo flujo de apertura.
>
> **Ciclo de UI (D-65):** los filtros de tablas en una sola fila (y la retirada
> del filtro Origen y del rango de fechas en CASOS), la fusión de PANEL, INGESTA,
> MONITOREO y ALERTAS en OPERACIÓN y la ficha rápida con pestañas se validaron con
> `14-operacion-filtros-ficha.spec.js` (4 casos). Se actualizaron además
> `02-navegacion` (5 secciones), `03-casos` (la búsqueda global abre la ficha
> rápida), `09-alertas` y `11-rbac`.
>
> **Lógica del despacho (D-66):** nuevo motor por sector con asignación diaria
> (`cuadrilla_sector_dia`), citados prioritarios, casos especiales incluidos y
> proceso en formulario flotante; más el aviso de direcciones sin sector en la
> ingesta. Validado con `15-proceso-despacho.spec.js` (3 E2E) y 8 pruebas de
> integración nuevas (`test_despacho_api.py` 17→23, `test_ingesta_api.py` 6→8).
> Se corrigió además una **contaminación entre pruebas** (un sector de prueba con
> código fuera del patrón de limpieza y la tabla nueva sin limpiar).
>
> **Alta y recuperación de técnicos (D-67):** primer acceso del técnico con
> generación de las 12 palabras, estado de la cuenta en TÉCNICOS y regeneración
> exclusiva del Super Usuario (auditada). Validado con
> `16-primer-acceso-tecnicos.spec.js` (3 E2E) y 4 pruebas de integración nuevas
> (`test_auth.py` 11→15). El contrato OpenAPI pasó de 73 a **79 paths / 109
> operaciones**.

> **Pendientes que no bloquean la Fase 4:** la app móvil Flutter (Ciclo 8, fuera
> de alcance), las credenciales de Telegram/correo (los envíos quedan en la
> bandeja como `PENDIENTE`), la firma del contrato de interfaz por CANTV y el
> **acceso público del servicio con PII real**, que debe restringirse antes de
> operar en producción.
