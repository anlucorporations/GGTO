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
| 3 — Ingesta CSV | ⏳ pendiente | — | — |
| 4 — PANEL y CASOS | ⏳ pendiente | — | — |
| 5 — DESPACHO | ⏳ pendiente | — | — |
| 6 — SEGUIMIENTO/EMPRESAS/REFERIDOS | ⏳ pendiente | — | — |
| 7 — MONITOREO/REPORTES | ⏳ pendiente | — | — |
| 8 — App móvil Flutter | ⏳ pendiente | — | — |
| 9 — ALERTAS/Telegram/MCP | ⏳ pendiente | — | — |
| 10 — INSUMOS (v2) | ⏳ pendiente | — | — |

---

## 5. Bitácora de ciclos

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
