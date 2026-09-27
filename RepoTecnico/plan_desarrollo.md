# Plan de Desarrollo Vertical — GGTO

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** — Gestión de averías y puntos ópticos (CANTV · Francisco Salias / Área 4) |
| Fase | **Fase 3 — Desarrollo** |
| Stack | Python + FastAPI · PostgreSQL (Cloud SQL) · React (Vite) · Flutter · GitHub Actions |
| Base de datos | ✅ desplegada (`ggtov2` en `truekeate-db-dev`) |
| Servicio | ✅ `ggto-web` en Cloud Run (`truekeate-main`) |
| Estado | Plan v1.0 — **en ejecución** |

> Cada ciclo es una **entrega 100 % operativa**: funcionalidad completa, probada y desplegada.
> Al terminar las pruebas de cada ciclo se actualiza el despliegue y **se espera la interacción del usuario** antes de pasar al siguiente.

---

## 1. Criterios de aceptación por ciclo (generales)

1. Los RF/RNF del ciclo están implementados en backend y, cuando aplique, en web.
2. **Pruebas unitarias** y de **integración** del ciclo en verde.
3. Documentación del ciclo actualizada (`estado_proyecto.md`, `diccionario_datos.md` si cambia el modelo).
4. Despliegue actualizado en Cloud Run y `GET /ready` en estado `ready`.
5. Sin errores funcionales conocidos.

---

## 2. Ciclos

### Ciclo 1 — Núcleo + Autenticación
**Objetivo:** un usuario puede autenticarse con `P00` + clave, con bloqueo a los 3 intentos y recuperación con 3 de las 12 palabras.

| Tarea | RF/RNF |
|---|---|
| Estructura del backend (config, sesión de BD, modelos base) | RT-02, RT-13 |
| Login `P00` + clave, JWT, `/auth/me` | RF-20, RNF-01 |
| Bloqueo a los 3 intentos y desbloqueo con 3 de 12 palabras | RF-20, RNF-01 |
| Primer inicio de la app (alta de clave + generación de 12 palabras) | RF-20 (brief 4.3.6) |
| RBAC base (`require_roles`) y matriz de roles | RNF-21, RNF-22 |
| Hashing Argon2id, política de sesión y rate limiting | RNF-22 |
| Pruebas unitarias + integración, CI | RNF-24 |

**Entrega:** API autenticada desplegada, con tests en verde.

---

### Ciclo 2 — Configuración (CONFIGURACIÓN)
**Objetivo:** el supervisor administra todo el entorno operativo.

| Tarea | RF |
|---|---|
| CRUD de CENTRAL | RF-38 |
| CRUD de SECTORES + direcciones/alias (base de la sectorización) | RF-38, RF-23 |
| CRUD de TÉCNICOS | RF-02, RF-38 |
| CRUD de FLOTA | RF-03 |
| CRUD de CUADRILLAS (técnicos + flota + herramientas) | RF-04 |
| CRUD de catálogos (causas, métodos) y parámetros | RF-07, RNF-10 |
| Accesos y perfiles de trabajadores | RF-02 |

**Entrega:** configuración completa operable desde web, con la que ya se puede sectorizar.

---

### Ciclo 3 — Ingesta CSV + Gestión automatizada
**Objetivo:** cargar el archivo diario y dejar los casos listos (clasificados, sectorizados y con la cuadrilla 0 resuelta).

| Tarea | RF |
|---|---|
| Parser ISO-8859-1, delimitador `;`, 80 columnas por posición, 49 campos destino | RF-01, RT-05 |
| Fechas `dd/mm/aaaa hh:mm:ss a.m./p.m.`, normalización de acentos | RT-05, RNF-13 |
| Filtro por central y **deduplicación por `id_averia`** | RF-21, RF-22 |
| Sectorización por coincidencia de `direccion` (`pg_trgm`, prioridad) | RF-23 |
| Registro del lote (`ingesta_lote`) y reporte de la carga | RF-29 |
| Criterio combinado de **cuadrilla 0** (`frases_campo` / `frases_supervisor`) | RF-25 |
| Alta manual con identificador `REF-…` | RF-32, D-23 |

**Entrega:** el supervisor sube el CSV y ve el resumen de nuevos/duplicados/sectorizados.

---

### Ciclo 4 — PANEL y CASOS
**Objetivo:** consultar y operar el universo de casos.

| Tarea | RF |
|---|---|
| Búsqueda por `id_averia` y por `teléfono` | RF-30 |
| Ficha del caso y edición | RF-31 |
| Alta manual genérica | RF-32 |
| Listado con filtros (central, sector, estado, tipo, fechas) y resolución | RF-33 |
| Historial de estados (`caso_estado_hist`) | RNF-12 |

**Entrega:** PANEL y CASOS operativos con trazabilidad.

---

### Ciclo 5 — DESPACHO
**Objetivo:** armar, publicar e imprimir el despacho diario.

| Tarea | RF |
|---|---|
| Propuesta automática de distribución por cuadrilla y sector | RF-24 |
| Reglas: citados del día, ≥2 referidos, ≥1 empresa, construcción a una sola cuadrilla | RF-08, brief 2 |
| Exclusión de casos en gestión/cuadrilla 0 | RF-25 |
| Edición, publicación e histórico de despachos | RF-08 |
| Impresión tamaño carta del despacho por cuadrilla | RT-08 |
| Envío por Telegram/correo y reporte de producción 16:00 | RF-10, RF-27 |
| Fallas masivas asignadas a la cuadrilla más cercana | RF-09 |

**Entrega:** despacho diario end-to-end, con envío y reporte.

---

### Ciclo 6 — SEGUIMIENTO, EMPRESAS y REFERIDOS
**Objetivo:** gestionar los casos especiales y su agenda.

| Tarea | RF |
|---|---|
| Seguimiento de casos derivados a otras instancias/colas | RF-34 |
| Casos EMPRESA con cita | RF-35 |
| Casos REFERIDO con prioridad y cita | RF-36 |
| Agenda interna (sin solapamiento) | RF-12, RNF-04 |
| Ingesta de casos especiales por Telegram / MCP | RF-06 |

**Entrega:** módulos de casos especiales con citas y notificación al solicitante.

---

### Ciclo 7 — MONITOREO, GRÁFICOS y REPORTES
**Objetivo:** tableros y reportes con métricas cerradas (S-08/D-17).

| Tarea | RF |
|---|---|
| Definición formal de métricas (fórmula, entidad, ventana, redondeo) | S-08, RF-26 |
| Tableros MONITOREO (diario, semanal, globales, reparación, construcción, cuadrilla) | RF-26 |
| GRÁFICOS (barras, curva, torta) | RF-26, RT-10 |
| Reportes de capacidad operativa y función diaria | RF-07 |
| Reporte de trabajo diario, semanal y mensual (PDF) | RF-28 |

**Entrega:** monitoreo y reportes descargables.

---

### Ciclo 8 — App móvil Flutter (gestión técnica)
**Objetivo:** el técnico opera en campo, offline, con evidencias.

| Tarea | RF |
|---|---|
| Login `P00` + clave, bloqueo y 12 palabras | RF-20 |
| Descarga de casos de su cuadrilla y fichas | RF-11 |
| CONTACTAR (CONTACTADO / DIFERIDO con cita) | RF-12 |
| ATENDER: CERRAR / ENRUTAR / DIFERIR | RF-13, RF-15 |
| Evidencias solo por cámara con GPS + fecha/hora | RF-14, RNF-04 |
| ZIP de jornada y SINCRONIZAR el dispositivo | RNF-06 |
| Alertas de incidentes de flota/herramientas | RF-19 |

**Entrega:** APK operativa con sincronización offline.

---

### Ciclo 9 — ALERTAS, Telegram y MCP
**Objetivo:** alertas y canales externos.

| Tarea | RF |
|---|---|
| Fallas masivas: detección automática + reporte del técnico | RF-09, RF-16, RF-17 |
| Solicitud de material | RF-18 |
| Bot de Telegram (envío de fichas, reportes y alertas) | RF-10, RF-16, RF-27 |
| Servidor **MCP** de ingesta/consulta/alertas | RF-06 |
| Correo (SendGrid/Gmail) con patrón *outbox* y reintentos | RNF-20 |
| Observabilidad: logs, métricas y alertas | RNF-19 |

**Entrega:** canales externos operativos y notificaciones resilientes.

---

### Ciclo 10 (v2) — INSUMOS
Inventario, órdenes de material y entrega a trabajadores. **RF-05, RF-18.**

---

## 3. Secuencia y dependencias

```
Ciclo 1 (Núcleo+Auth) ─► Ciclo 2 (Configuración) ─► Ciclo 3 (Ingesta)
      │                                                    │
      └──────────────► Ciclo 4 (PANEL/CASOS) ◄─────────────┘
                              │
                              ├─► Ciclo 5 (Despacho) ─► Ciclo 6 (Especiales)
                              ├─► Ciclo 7 (Monitoreo/Reportes)
                              ├─► Ciclo 8 (App móvil) ─► Ciclo 9 (Alertas/MCP)
                              └─► Ciclo 10 (Insumos, v2)
```

## 4. Registro de avance

| Ciclo | Estado | Pruebas | Desplegado |
|---|---|---|---|
| 1 — Núcleo + Autenticación | ✅ **completado** | 17/17 en verde | rev. `ggto-web-00002-rbl` |
| 2 — Configuración | ✅ **completado** | 28/28 acumuladas | rev. `ggto-web-00003-6zb` |
| 3 — Ingesta CSV | ✅ **completado** | 62/62 acumuladas | rev. `ggto-web-00004-cj9` |
| 4 — PANEL y CASOS | ✅ **completado** | 79/79 acumuladas | rev. `ggto-web-00005-rxm` |
| 5 — DESPACHO | ✅ **completado** | 96/96 acumuladas | rev. `ggto-web-00007-vsr` |
| 6 — SEGUIMIENTO/EMPRESAS/REFERIDOS | ✅ **completado** | 111/111 acumuladas | rev. `ggto-web-00008-vr5` |
| 7 — MONITOREO/REPORTES | ⏳ pendiente | — | — |
| 8 — App móvil Flutter | ⏳ pendiente | — | — |
| 9 — ALERTAS/Telegram/MCP | ⏳ pendiente | — | — |
| 10 — INSUMOS (v2) | ⏳ pendiente | — | — |

---

## 5. Bitácora de ciclos

### Ciclo 6 — SEGUIMIENTO, EMPRESAS y REFERIDOS ✅

| Aspecto | Resultado |
|---|---|
| Casos especiales (RF-35, RF-36) | `POST /casos-especiales` con `clasificacion` (REFERIDO/EMPRESA/GOBIERNO), `tipo_actividad`, `prioridad` y solicitante; si no se indica `id_caso` **crea el caso** con `REF-…`; filtros por clasificación/estado/prioridad y solo pendientes |
| Solicitantes | `GET/POST /solicitantes` — unidad + nombre + contacto + canal (personal externo) |
| Agenda (RF-12, RNF-04) | `GET/POST/PATCH/DELETE /citas`; **validación de solapamiento** por cuadrilla con duración configurable (`agenda.duracion_minutos`, 60 por defecto); `409` con el detalle del choque; `409`/`403` controlado para forzar solape (solo `SUPER`) |
| Seguimiento (RF-34) | `GET/POST/PATCH /seguimiento`; al derivar a `EN_COLA` el caso pasa a **ENRUTADO** y **sale del despacho**; al `DEVUELTO` vuelve a `NUEVO` |
| Web | Páginas **ESPECIALES** (filtros, alta con solicitante, edición) y **AGENDA** (rango de fechas, agrupada por día, alta con detección de solape) |
| Pruebas | +15 de integración → **111/111 acumuladas** |
| Calidad | `ruff` ✅ · `mypy` ✅ · `tsc` strict ✅ |

**Verificación en vivo:**

| Prueba | Resultado |
|---|---|
| Caso especial EMPRESA | `201` · caso asociado `REF-2324X-000002` · categoría `EMPRESA` |
| Solicitante | 1 creado junto al caso |
| Cita + solapamiento | `201` → `409` («La cuadrilla ya tiene una cita a las … (duración 60 min)») → cita libre `201` |
| Cancelar cita | `204` y deja de bloquear |
| Seguimiento | Caso → `ENRUTADO` y **excluido del despacho**; al `DEVUELTO` → `NUEVO` |
| SPA `/especiales` y `/agenda` | `200` |

> ⚠️ **Hallazgo durante la verificación:** la base de producción ya contiene **datos reales** — el
> Super Usuario cargó `detalle_averias_gpon 15_09_2026.csv` (47 filas → **42 casos** de la central,
> 5 descartadas). La ingesta funcionó correctamente. Esos casos **no se tocaron** (verificado con las
> secuencias: todo lo eliminado en las pruebas coincidía con mis propios registros).

### Ciclo 5 — DESPACHO ✅

| Aspecto | Resultado |
|---|---|
| Propuesta (RF-24) | `POST /despachos/propuesta`: agrupa por **sector** y reparte con balanceo *greedy* a la cuadrilla con menor carga; devuelve `resumen` y `reglas` |
| Reglas del brief | Incluye **citados del día** (aunque sean de cuadrilla 0), **≥2 referidos**, **≥1 empresa** y toda la **construcción a una sola cuadrilla** (prefiere la que ya trabaja en el sector) |
| Exclusión (RF-25) | Fuera los casos de la **cuadrilla 0** y los ya asignados a un despacho no cerrado |
| Generación (RF-08) | `POST /despachos` persiste en BORRADOR; `409` si ya existe la fecha; `reemplazar=true` regenera. `PATCH` publica/cierra |
| Edición | Agregar/quitar casos y cambiar el estado de cada caso (`ASIGNADO/GESTIONADO/CERRADO/CITADO/DIFERIDO`) |
| Impresión (RT-08) | `GET /despachos/{id}/imprimible` → HTML con `@page { size: letter }`, tabla con firma/resultado |
| Reporte de producción (RF-27) | Global del día y por despacho: asignados, cerrados, citados, diferidos, gestionados, referidos y empresas |
| Envío (RF-10) | `POST /despachos/{id}/enviar?canal=TELEGRAM|CORREO`: intenta enviar y, si no hay credenciales, la notificación queda **PENDIENTE** con el motivo (patrón *outbox*, RNF-20) |
| Fallas masivas (RF-09) | Registrar y listar; asigna la cuadrilla más cercana por sector |
| Corrección | Los indicadores `cumple_min_referidos`/`cumple_min_empresas` eran tautológicos; ahora comparan contra los **disponibles** en el universo |
| Web | Página **DESPACHO**: fecha, simular, generar (con flujo 409/Reemplazar), detalle editable, imprimir, enviar, notificaciones, reportes y fallas masivas |
| Pruebas | +17 de integración → **96/96 acumuladas** |
| Calidad | `ruff` ✅ · `mypy` ✅ · `tsc` strict ✅ |

**Verificación en vivo** (2 sectores, 2 cuadrillas, 10 casos: 4 Alfa, 2 Beta, 2 referidos, 1 empresa, 1 construcción):

| Prueba | Resultado |
|---|---|
| Propuesta | `total_casos=10`, `asignados=10` · **TCD1: 6** (Alfa + empresa + construcción) y **TCD2: 4** (Beta + 2 referidos) |
| Reglas | `referidos_asignados=2/2` ✅ · `empresas_asignadas=1/1` ✅ · `construccion_en_una_sola=true` (TCD1) ✅ |
| Generar | `201`, 2 despachos |
| Imprimible | `200` · `size: letter` ✅ · tabla con `ID avería` ✅ |
| Reporte | `asignados=10`, `referidos=2`, `empresas=1` |
| Publicar / enviar | `200` / `PENDIENTE` con motivo «Sin TELEGRAM_BOT_TOKEN configurado (se habilita en el Ciclo 9)» |
| Falla masiva | `201` y listado con 1 registro |
| SPA `/despacho` | `200` |

### Ciclo 4 — PANEL y CASOS ✅

| Aspecto | Resultado |
|---|---|
| Búsqueda (RF-30) | `GET /casos/buscar?id_averia=` o `?telefono=` (al menos uno; si no, `422`) |
| Listado (RF-33) | `GET /casos` con filtros `q`, `id_averia`, `telefono`, `id_central`, `id_sector`, `id_causa`, `id_lote_ingesta`, `estado_actual`, `tipo_caso`, `categoria`, `origen`, `en_gestion_supervisor`, `es_falla_masiva`, `desde`, `hasta` + paginación (`page`, `page_size`, `total`, `pages`) |
| Ficha y edición (RF-31) | `GET /casos/{id}` y `PATCH /casos/{id}` (envía solo lo modificado); si cambia la dirección se **recalcula el sector** |
| Alta manual (RF-32) | `POST /casos`; sin `id_averia` genera **`REF-<CENTRAL>-<NNNNNN>`**; `409` si el identificador ya existe |
| Bitácora (RNF-12) | `caso_estado_hist`: cambio de estado con motivo y usuario; `GET /casos/{id}/historial`; no se registra si el estado no cambia |
| Validación | `422` en estado no permitido (los 9 estados del DDL) |
| Web | Página **CASOS**: búsqueda directa, filtros, paginación, ficha agrupada, edición, cambio de estado, historial y alta manual con `REF-` destacado; el PANEL añade búsqueda rápida que navega a CASOS |
| Pruebas | +17 de integración (`test_casos_api.py`) → **79/79 acumuladas** |
| Calidad | `ruff` ✅ · `mypy` ✅ · `tsc` strict ✅ |

**Verificación en vivo:** alta manual → `REF-2324X-000001` · búsqueda por `id_averia` y por teléfono (`1`) · sin parámetros `422` · edición a `CONTACTADO` con motivo · historial con 2 entradas (`None→NUEVO`, `NUEVO→CONTACTADO`) · estado inválido `422` · listado filtrado `total=1` · tras ingerir, `DEMO-0001` localizado con su lote · SPA `/casos` `200`.

### Ciclo 3 — Ingesta CSV + Gestión automatizada ✅

| Aspecto | Resultado |
|---|---|
| Parser | `app/services/ingesta.py`: ISO-8859-1, delimitador `;`, **80 columnas por posición**, **49 campos destino**, `informacion` = cols. 31+32+52, ayudantes como lista |
| Fechas | `%d/%m/%Y %I:%M:%S %p` con variantes `a.m./p.m.`, ISO y fecha sola; celdas vacías toleradas |
| Robustez | Normalización de acentos; **recorte defensivo** con aviso si un valor excede su columna (`extra` se amplió a `varchar(120)`) |
| Filtro de central | Solo se cargan los casos de la central configurada (RF-21) |
| Deduplicación | Por `id_averia`, incluyendo duplicados dentro del mismo archivo (RF-22) |
| Sectorización | `app/services/sectorizacion.py`: coincidencia CONTIENE/EXACTO/REGEX sobre `direccion`, sin acentos, gana el patrón más específico (RF-23) |
| Cuadrilla 0 | `app/services/cuadrilla0.py`: modos `CAMPO`/`SUPERVISOR`/`UNION` con listas y columnas configurables (RF-25 / D-22) |
| Endpoints | `POST /ingesta/preview` (simulación), `POST /ingesta` (carga), `GET /ingesta/lotes`, `GET /ingesta/lotes/{id}` |
| Trazabilidad | Cada carga queda en `ingesta_lote` con filas leídas, de la central, nuevas, duplicadas y descartadas (RF-29) |
| Web | Página **INGESTA**: simular, cargar con confirmación, resumen por tarjetas, avisos, ejemplos e historial de lotes |
| Pruebas | **62/62** acumuladas (+34 del Ciclo 3: 16 del parser, 12 de sectorización/cuadrilla 0, 6 de la API) |
| Calidad | `ruff` ✅ · `mypy` ✅ · `tsc` strict ✅ |

**Verificación en vivo** (muestra real de 56 filas, 3 centrales):

| Prueba | Resultado |
|---|---|
| `preview` | `filas_leidas=56`, `filas_central=51`, `casos_descartados=5`, `sectorizados=15`, `sin_sector=36` |
| Carga real | `id_lote=1`, `casos_nuevos=51` |
| Segunda carga | `casos_nuevos=0`, `casos_duplicados=51` ✅ deduplicación |
| Historial | 2 lotes en `OK` |
| SPA `/ingesta` | `200` |

> ⚠️ **Hallazgo de la prueba real:** con el modo `UNION` (D-22), **51 de 51** casos quedaron marcados para la
> cuadrilla 0, porque casi ninguno contiene frases de campo (`LOSS ROJO`, `FALLA FIBRA`, `Fibra Dañada`).
> Es exactamente el riesgo señalado en la auditoría (H-04/H-19). Está **parametrizado** en
> `despacho.criterio_cuadrilla0` y las listas de frases: debe ajustarse con CANTV antes de usar el
> despacho real (candidato: modo `SUPERVISOR` o una lista de frases de campo más completa).

### Ciclo 2 — Configuración ✅

**Backend (API) ✅**

| Aspecto | Resultado |
|---|---|
| Endpoints | `central`, `sectores` (+`direcciones`), `tecnicos`, `flota`, `cuadrillas` (+`integrantes`), `catalogos/causas`, `catalogos/metodos`, `configuracion` |
| RBAC | Escritura solo `ADMIN`/`SUPERVISOR`; lectura para cualquier usuario autenticado; `403` para `TECNICO` |
| Reglas | Baja lógica (`activa`/`activo`/`status`), `409` en duplicados, `404` en inexistentes |
| Pruebas | +11 de integración (`test_config.py`) → **28/28 acumuladas** |
| Calidad | `ruff` ✅ · `mypy` ✅ |
| Seguridad | `/api/v1/resumen` pasó a exigir token; `GET /` se movió a `/api/v1/info` para que la SPA ocupe la raíz |

**Web de administración (React + Vite + TypeScript) ✅**

| Aspecto | Resultado |
|---|---|
| Secciones | Login (+ desbloqueo con 3 palabras), PANEL, CENTRAL, SECTORES, TÉCNICOS, FLOTA, CUADRILLAS, CATÁLOGOS, PARÁMETROS |
| Sesión | Token en `localStorage`; valida `GET /auth/me` al montar; rutas protegidas con redirección a `/login` |
| RBAC en UI | Con rol `TECNICO` se ocultan formularios y botones y se muestra "Modo solo lectura" |
| Servido | Mismo contenedor: `index.html` y `/assets/*` desde `app/web/dist` vía `SPAStaticFiles` (deep links OK) |
| Build | `tsc` (strict) + `vite build` ✅ · 49 módulos · 226 kB JS (66 kB gzip) |

**Despliegue y verificación en vivo ✅** — revisión `ggto-web-00003-6zb` (imagen `v3`):
`GET /` sirve la SPA y `/assets/*` responde `200`; `/api/v1/info` OK; `setup` → `login` OK;
`/api/v1/resumen` con token `200` y sin token `401`; creación de **central, sector con 2 direcciones,
técnico, flota y cuadrilla** → todos `201`. Datos temporales eliminados tras la prueba.

### Ciclo 1 — Núcleo + Autenticación ✅

| Aspecto | Resultado |
|---|---|
| Estructura | `app/` como paquete: `core/` (config, db, security, words), `models/`, `schemas/`, `api/` (deps, routes_auth, routes_health), `tests/` |
| Endpoints | `POST /api/v1/auth/setup` · `POST /api/v1/auth/login` · `GET /api/v1/auth/me` · `POST /api/v1/auth/unlock` · `POST /api/v1/auth/reset-password` · `GET /` · `GET /health` · `GET /ready` · `GET /api/v1/resumen` |
| Seguridad | Argon2id; JWT HS256 (8 h); bloqueo a los **3 intentos**; **12 palabras** generadas en el primer inicio y recuperación con **3**; **rate limiting** 10/min por P00+IP; RBAC (`require_roles`) |
| Base de datos | Modelos SQLAlchemy mapeados al esquema desplegado (35 tablas); sin migraciones destructivas |
| Pruebas | **17/17** — 6 unitarias (`test_security.py`) + 11 de integración (`test_auth.py`) contra el esquema aislado `ggto_test` |
| Calidad | `ruff check app` ✅ · `mypy app` ✅ |
| CI | `.github/workflows/ci.yml` con Postgres 15 de servicio, Ruff, mypy y pytest |
| Despliegue | Imagen `ggto-web:v2` → Cloud Run `ggto-web-00002-rbl`, secreto `ggto-secret-key` en Secret Manager |
| Verificación en vivo | `setup` (12 palabras) → `login` (JWT) → `/me` ✅ → 3 fallos (401/401/**423**) → `unlock` con 3 palabras ✅ → login ✅ |
| Limpieza | Usuario temporal `DEMO001` eliminado; la base queda sin usuarios (los creará RF-02 en el Ciclo 2) |
