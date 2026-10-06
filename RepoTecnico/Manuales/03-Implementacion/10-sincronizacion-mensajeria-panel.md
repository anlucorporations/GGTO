# 10 — Sincronización, mensajería interna y panel de gestión diaria (Incremento D-81)

Manual técnico del **incremento D-81** (RF-39…RF-44). Describe el log de
sincronización de la APK, su checklist, la mensajería interna (supervisor → técnicos)
y el panel de gestión diaria.

> Requerimientos: `RepoTecnico/incremento_D81_sync_mensajeria_panel.md`.
> Casos de uso: `RepoTecnico/casos_uso/casos_uso_D81.md`.
> Diseño: `RepoTecnico/documento_tecnico_D81.md`.

---

## 1. Log de sincronización (`sync_log` + `sync_check`) — RF-39/RF-40

Cada sesión de la APK (DESCARGA o CARGA) deja **una fila** en `sync_log`
(`app/models/sync_entities.py`) con `p00`, cuadrilla, `id_central`, dispositivo real,
tipo, inicio/fin, duración, contadores y estado (`EN_PROCESO/OK/PARCIAL/ERROR`).

El **checklist por paso** vive en `sync_check` (una fila por
`CONEXION/LOGIN/DESCARGA/CARGA`, con estado `PENDIENTE/EN_CURSO/OK/ERROR/OMITIDO`).

**Endpoints** (`app/api/routes_sync.py`):

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/sync/sesion` | Abre una sesión (`{tipo, dispositivo_id, version_app}`) → `id_sync_log`. |
| PATCH | `/api/v1/sync/sesion/{id}` | Cierra con contadores, estado y checklist. `409` si ya cerrada. |
| PATCH | `/api/v1/sync/checklist?id_sync_log=` | Sube el checklist por paso (idempotente). |

**Consulta** (`app/api/routes_sincronizacion.py`, `app/services/sincronizacion.py`):
`GET /api/v1/sincronizaciones`, `/{id}`, `/resumen`, `/checklist` — **ADMIN/SUPERVISOR/SUPER**,
acotado a la central. La inspección de BD (`/api/v1/sistemas/*`) sigue siendo **solo SUPER**.

**Web:** pestañas en **SISTEMAS** → `app/web/src/pages/Sistemas.tsx` y
`app/web/src/pages/Sincronizacion.tsx`.
**APK:** `app_movil/lib/features/sync/sync_screen.dart` y `sync_sesion.dart`.

---

## 2. Mensajería interna — RF-41

Unidireccional **supervisor → técnicos**. Tablas `mensaje` y `mensaje_destino`
(fan-out de destinatarios + lectura) en `app/models/mensaje_entities.py`. Servicio en
`app/services/mensajes.py`; endpoints en `app/api/routes_mensajes.py`:

| Método | Ruta | Rol |
|---|---|---|
| GET | `/api/v1/mensajes?desde=&limit=` | Autenticado (sondeo incremental) |
| GET | `/api/v1/mensajes/no-leidos` | Autenticado |
| GET | `/api/v1/mensajes/bandeja` | SUPER/ADMIN/SUPERVISOR |
| POST | `/api/v1/mensajes` | SUPER/ADMIN/SUPERVISOR |
| POST | `/api/v1/mensajes/{id}/leido` · `/leidos` | Técnico |

**Automáticos** (idempotentes por `dedupe_key`): `ESTADO_SYNC` al cerrar una sesión,
`recordatorios-citas` y `alarmas-despacho` (jobs de mantenimiento).

**Sondeo:** 20 s, incremental (`useMensajes.ts` en web; `mensajes_provider.dart` en la APK).
Es la **única** pieza del sistema que se refresca a 20 s (RNF-26).

---

## 3. Panel de gestión diaria — RF-42/43/44

`GET /api/v1/panel/gestion-diaria?fecha=&modo=COMUN|REFERIDOS`
(`app/api/routes_panel.py`, `app/services/panel.py`): **Asignadas** (casos del despacho
de la fecha) vs. **Cerradas** (`caso.estado_actual='CERRADO'`), por cuadrilla. **Común**
= `categoria='RESIDENCIAL'`; **Referidos** = `clasificacion='REFERIDO'`.

**Web:** `app/web/src/components/PanelGestionDiaria.tsx` (auto-refresco **30 s** con
`useAutoRefresh.ts`; botón **«Agregar caso especial»** → `POST /casos-especiales`).

---

## 4. Mantenimiento (`app/api/routes_mantenimiento.py`)

Rutas fuera del OpenAPI, protegidas por el header **`X-Mantenimiento-Token`**
(comparación en tiempo constante; **503** si no está configurado):

| Ruta | Efecto |
|---|---|
| `POST /api/v1/mantenimiento/cerrar-sesiones` | Cierra como `ERROR` las sesiones colgadas (`sync.timeout_min`). |
| `POST /api/v1/mantenimiento/purgar` | Borra mensajes vencidos (salvo no leídos, E-14) y `sync_log` fuera de retención. |
| `POST /api/v1/mantenimiento/recordatorios-citas` | Emite recordatorios de citas del día. |
| `POST /api/v1/mantenimiento/alarmas-despacho` | Emite alarmas por sector del despacho. |

---

## 5. Parámetros (`configuracion`)

| Clave | Defecto | Uso |
|---|---|---|
| `mensajeria.poll_segundos` | 20 | Sondeo de mensajes. |
| `panel.sync_segundos` | 30 | Auto-refresco del panel. |
| `mensajeria.retencion_dias` | 5 | Retención de mensajes. |
| `mensajeria.retencion_max_dias` | 30 | Tope de los no leídos. |
| `sync_log.retencion_dias` | 90 | Retención del log. |
| `mensajeria.recordatorio_cita_min` | 60 | Antelación del recordatorio. |
| `sync.timeout_min` | 10 | Cierre de sesiones colgadas. |

---

## 6. Migración y pruebas

- Migración idempotente: `scripts/migrar_d81_sync_mensajeria.py` (simulación por defecto;
  `--aplicar` para escribir). El DDL canónico está en `RepoTecnico/db/schema.sql` §12.
- Pruebas de integración: `app/tests/test_d81_api.py`, `test_d81_mensajes_api.py`,
  `test_d81_panel_api.py` (requieren `GGTO_TEST_DB_URL`).
