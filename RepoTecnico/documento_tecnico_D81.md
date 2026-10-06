# Documento Técnico — Incremento D-81
## Log de sincronización · Mensajería interna · Panel de gestión diaria

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** (CANTV · Francisco Salias / Área 4) |
| Alcance | Incremento **D-81** (RF-39…RF-44 · RNF-26…RNF-28 · RT-15…RT-16) |
| Base | Sistema GGTO v1 desplegado (FastAPI + PostgreSQL + React/Vite + Flutter) |
| Casos de uso | [`casos_uso_D81.md`](casos_uso/casos_uso_D81.md) **v0.2** |
| Requerimientos | [`incremento_D81_sync_mensajeria_panel.md`](incremento_D81_sync_mensajeria_panel.md) |
| Revisión | **v0.2** — incorpora la auditoría técnica (C-01…C-04, A-01…A-12, M-01…M-11, B-01…B-03) |
| Estado | Borrador v0.2 — **pendiente de validar y de las preguntas de cierre** |

> Extiende el sistema existente; **no** lo rediseña. Reutiliza `sync_log`, `caso`, `despacho`,
> `cuadrilla_sector_dia`, `cita` y el estilo de la SPA. **No** usa el patrón *outbox* (ese es para
> canales externos TELEGRAM/CORREO/MCP_IA); la mensajería interna es un canal propio. Sin dependencias nuevas.

---

## 1. Visión general y alcance

Tres capacidades nuevas sobre la arquitectura actual:

1. **Trazabilidad de sincronización** (RF-39, RF-40): registrar cada **sesión** de la APK y su
   **checklist** (conexión GCP · login · descarga · carga) **por paso**; consultable en **web** y **APK**
   dentro de **SISTEMAS** (abierto a Admin/Supervisor; la inspección de BD sigue solo para SUPER).
2. **Mensajería interna on-line** (RF-41): unidireccional **supervisor → técnicos**, automáticos
   (citas, estado de sync, alarmas por despacho) + texto libre; **único** componente con sondeo a **20 s**.
3. **Panel del Supervisor** (RF-42/43/44): **gestión diaria** (Asignadas vs. Cerradas por cuadrilla;
   Común/Referidos) con **auto-refresco a 30 s** y **alta manual de Casos Especiales**.

**Alcance del log (resolución A-02):** el **único** conjunto de `tipo` es **`DESCARGA` / `CARGA`**
(la subida de evidencias ocurre dentro de CARGA). **No** hay `SYNC_WEB` (la web no sincroniza). Esto
respeta el `CHECK` vigente de `sync_log` (`db/schema.sql:594`) — **no** requiere `ALTER` del constraint.

---

## 2. Arquitectura del incremento

```
┌─────────────────────────── CLIENTES ───────────────────────────┐
│  Web (React/Vite)                  APK (Flutter)                │
│   • SISTEMAS → Sincronización*      • Dispositivo (checklist)   │
│   • Mensajes (sondeo 20 s)          • Mensajes (sondeo 20 s)    │
│   • Panel gestión diaria (30 s)     • SISTEMAS → sync log*      │
└───────────────┬───────────────────────────────┬────────────────┘
                │ HTTPS/JSON                     │ HTTPS/JSON
┌───────────────▼───────────────────────────────▼────────────────┐
│                     Backend FastAPI (/api/v1)                   │
│  routes_sync.py (+sesión/checklist)   routes_mensajes.py (nuevo)│
│  routes_sincronizacion.py (nuevo)     routes_panel.py (nuevo)   │
│  routes_mantenimiento.py (nuevo)      services/mensajes.py      │
│  services/sync.py (instrumentado)     services/panel.py         │
│  services/purga.py                    services/scheduler_util.py│
└───────────────┬────────────────────────────────────────────────┘
                │ SQLAlchemy
┌───────────────▼────────────────────────────────────────────────┐
│ PostgreSQL (Cloud SQL)                                          │
│  sync_log (en uso) · sync_check* · mensaje* · mensaje_destino*  │
│  caso · despacho · cuadrilla_sector_dia · cita · usuario        │
└─────────────────────────────────────────────────────────────────┘
        ▲ Cloud Scheduler (OIDC / token, TZ America/Caracas)
   /mantenimiento/{cerrar-sesiones,purgar,recordatorios-citas,alarmas-despacho}
```

`*` = superficie abierta a **ADMIN/SUPERVISOR** (la inspección de BD de SISTEMAS permanece solo **SUPER**).

**Decisiones de arquitectura**
- **Sondeo, no WebSocket (RT-15):** refresco de 20 s; *polling* incremental con **fan-out** de
  destinatarios (ver §3.3), lo que hace el sondeo `id_mensaje > desde` directo sobre `mensaje_destino`.
- **Sin cron en proceso:** Cloud Run escala a cero → trabajos por **Cloud Scheduler** contra
  `/mantenimiento/*` (TZ `America/Caracas`, OIDC/token fail-closed; §8).
- **Solo la mensajería usa 20 s (RNF-26);** el resto no se auto-refresca a ese ritmo.

---

## 3. Modelo de datos

### 3.1 Tablas existentes reutilizadas

| Tabla | Uso |
|---|---|
| `sync_log` (ya creada, sin uso) | Se empieza a **escribir** en cada sesión (RF-39). Se amplía (3.2). |
| `cuadrilla`, `cuadrilla_tecnico`, `usuario`, `tecnico` | Cuadrilla activa (reutiliza `services.sync._cuadrilla_activa`) y destinatarios. |
| `cita` | Recordatorios; se amplía `recordatorio_para` (3.3). |
| `despacho`, `despacho_caso`, `cuadrilla_sector_dia`, `falla_masiva`, `orden_material`, `caso` | Panel diario y mensajes automáticos. |

### 3.2 Ampliación de `sync_log`

```sql
ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS plataforma   varchar(20) NOT NULL DEFAULT 'APK';
ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS duracion_ms  integer;
ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS id_central   integer REFERENCES central(id_central);  -- C-04 / RNF-21
-- estado YA admite ('EN_PROCESO','OK','PARCIAL','ERROR') — sin cambio.
```

### 3.3 Tablas nuevas y cambios (v0.2)

```sql
-- Checklist POR PASO (RF-40 / C-02): estado, hora y detalle por paso; OMITIDO para EARS-03-2
CREATE TABLE IF NOT EXISTS sync_check (
    id_sync_check  bigserial   PRIMARY KEY,
    id_sync_log    bigint      NOT NULL REFERENCES sync_log(id_sync_log) ON DELETE CASCADE,
    paso           varchar(12) NOT NULL CHECK (paso IN ('CONEXION','LOGIN','DESCARGA','CARGA')),
    estado         varchar(12) NOT NULL CHECK (estado IN ('PENDIENTE','EN_CURSO','OK','ERROR','OMITIDO')),
    fecha_hora     timestamptz,
    detalle        jsonb,
    UNIQUE (id_sync_log, paso)
);

-- Mensajería interna (RF-41) con id_central (C-04)
CREATE TABLE IF NOT EXISTS mensaje (
    id_mensaje     bigserial    PRIMARY KEY,
    id_central     integer      NOT NULL REFERENCES central(id_central),
    origen_p00     varchar(20)  NOT NULL REFERENCES usuario(p00),
    destino_tipo   varchar(12)  NOT NULL CHECK (destino_tipo IN ('TODOS','CUADRILLA','TECNICO')),
    id_cuadrilla   integer      REFERENCES cuadrilla(id_cuadrilla) ON DELETE SET NULL,
    id_tecnico     integer      REFERENCES tecnico(id_tecnico)    ON DELETE SET NULL,
    tipo           varchar(20)  NOT NULL
                   CHECK (tipo IN ('RECORDATORIO_CITA','ESTADO_SYNC','ALARMA_DESPACHO','TEXTO')),
    cuerpo         varchar(500) NOT NULL,
    id_caso        bigint       REFERENCES caso(id_caso) ON DELETE SET NULL,
    creado_en      timestamptz  NOT NULL DEFAULT now(),
    expira_en      timestamptz  NOT NULL DEFAULT (now() + interval '5 days'),   -- M-05
    CHECK (expira_en > creado_en),
    CHECK (                                                                      -- M-04 (XOR)
        (destino_tipo = 'TODOS'     AND id_cuadrilla IS NULL     AND id_tecnico IS NULL) OR
        (destino_tipo = 'CUADRILLA' AND id_cuadrilla IS NOT NULL AND id_tecnico IS NULL) OR
        (destino_tipo = 'TECNICO'   AND id_tecnico IS NOT NULL   AND id_cuadrilla IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS ix_mensaje_creado ON mensaje (creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_mensaje_expira ON mensaje (expira_en);

-- FAN-OUT de destinatarios + lectura (A-03/A-06): sustituye a `mensaje_lectura`
CREATE TABLE IF NOT EXISTS mensaje_destino (
    id_mensaje   bigint      NOT NULL REFERENCES mensaje(id_mensaje) ON DELETE CASCADE,
    id_tecnico   integer     NOT NULL REFERENCES tecnico(id_tecnico) ON DELETE CASCADE,
    leido_en     timestamptz,                       -- NULL = no leído
    PRIMARY KEY (id_mensaje, id_tecnico)
);
CREATE INDEX IF NOT EXISTS ix_mensaje_destino_tecnico ON mensaje_destino (id_tecnico, id_mensaje);

-- Idempotencia de recordatorios robusta ante reprogramación (M-06)
ALTER TABLE cita ADD COLUMN IF NOT EXISTS recordatorio_para timestamptz;  -- fecha_hora para la que se emitió
```

> **Por qué fan-out (A-03/A-06):** al emitir un mensaje se **materializan** sus destinatarios en
> `mensaje_destino`. Así el sondeo 20 s es `id_mensaje > desde` por `id_tecnico` (usa el índice), el
> contador de no leídos es un `COUNT`, y un **cambio de cuadrilla** no pierde mensajes (los ya materializados
> siguen perteneciendo al técnico). `TODOS` = un `mensaje_destino` por técnico activo de la central.

### 3.4 Parámetros nuevos (`configuracion`) + siembra (M-10)

```sql
INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('mensajeria.poll_segundos',       '20'::jsonb, 'Periodo del sondeo de mensajes (únicas 20 s del sistema)'),
    ('panel.sync_segundos',            '30'::jsonb, 'Periodo del auto-refresco del panel'),
    ('mensajeria.retencion_dias',      '5'::jsonb,  'Retención de mensajes internos'),
    ('mensajeria.retencion_max_dias',  '30'::jsonb, 'Tope de seguridad: no leídos se borran a los N días'),
    ('sync_log.retencion_dias',        '90'::jsonb, 'Retención del log de sincronización'),
    ('mensajeria.recordatorio_cita_min','60'::jsonb, 'Antelación del recordatorio de cita'),
    ('sync.timeout_min',               '10'::jsonb, 'Cierre de sesiones colgadas')
ON CONFLICT (clave) DO NOTHING;
```

> `PUT /configuracion/{clave}` responde **404** si la clave no existe (`routes_config.py`), por lo que la
> **siembra es obligatoria**. Se añade al script de migración **y** al bloque de semillas de `db/schema.sql`.

---

## 4. Contratos de API (`/api/v1`)

### 4.1 Sincronización (instrumentar + checklist)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/sync/sesion` | Autenticado | **Abre** sesión: `{tipo ∈ {DESCARGA,CARGA}, dispositivo_id, version_app}` → `201 {id_sync_log}`. Valida `tipo` (**422** si no es DESCARGA/CARGA — A-02). |
| PATCH | `/sync/sesion/{id}` | Autenticado | **Cierra**: `{recibidos, procesados, errores, estado, detalle}`. `409` si ya cerrada. Dispara el mensaje `ESTADO_SYNC` (M-02). |
| PATCH | `/sync/checklist` | Autenticado | **Idempotente** por `(id_sync_log, paso)`: sube/actualiza el checklist por paso (C-03; permite reportar el fallo de conexión al reconectar). |
| GET | `/sync/descarga` | Autenticado | *(existente)* + `id_sync_log` **opcional** (query) para asociar la sesión (A-10). |
| POST | `/sync/carga` | Autenticado | *(existente)* + campo **opcional** `id_sync_log` en el body (A-10, retrocompatible: si falta, la sesión queda sin asociar). |

**Punto único de escritura (A-10):** `services/sync.py` es el único que abre/cierra `sync_log` y `sync_check`.
Las APK ya instaladas que no envían `id_sync_log` siguen funcionando (sesión sin asociar).

### 4.2 Log de sincronizaciones (Admin/Supervisor/SUPER, acotado a central)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/sincronizaciones` | Lista paginada. Filtros: `p00, id_cuadrilla, dispositivo_id, tipo, estado, desde, hasta`; `orden` (por defecto `iniciado_en DESC`) (M-01). |
| GET | `/sincronizaciones/{id}` | Detalle + `sync_check` (por paso). `detalle` con **lista blanca** (A-07). |
| GET | `/sincronizaciones/resumen?fecha=` | KPIs de la fecha (por defecto hoy): total, `OK/PARCIAL/ERROR`, por cuadrilla (M-01). |
| GET | `/sincronizaciones/checklist` | Último checklist por `dispositivo_id` real (A-04). |

### 4.3 Mensajería (RF-41)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/mensajes?desde=<id>&limit=` | TÉCNICO | Sondeo incremental: `mensaje_destino` del técnico con `mensaje.id_mensaje > desde` y `expira_en > now()`, con `leido` (A-03). `limit` por defecto 50. |
| POST | `/mensajes` | Admin/Supervisor/SUPER | Enviar; **fan-out** a `mensaje_destino`. |
| POST | `/mensajes/{id}/leido` | TÉCNICO | Marca leído (idempotente: no sobrescribe `leido_en`). |
| POST | `/mensajes/leidos` | TÉCNICO | Marcado **masivo** `{ids:[…]}` (idempotente, `ON CONFLICT DO NOTHING`) (M-03). |
| GET | `/mensajes/no-leidos` | TÉCNICO | Contador de no leídos vigentes. |
| GET | `/mensajes/bandeja` | Admin/Supervisor/SUPER | Mensajes emitidos por el autor (CU-D81-11). |

### 4.4 Panel (RF-42/43/44)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/panel/gestion-diaria?fecha=&modo=COMUN|REFERIDOS` | Admin/Supervisor/SUPER | Asignadas vs. Cerradas por cuadrilla (acotado a central). |

### 4.5 Mantenimiento (Cloud Scheduler; seguridad en §8)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/mantenimiento/cerrar-sesiones` | Cierra como `ERROR` las sesiones `EN_PROCESO` con `iniciado_en < now() - sync.timeout_min`; `detalle.motivo="sesión abandonada"`, `finalizado_en=now()` (C-01). |
| POST | `/mantenimiento/purgar` | Borra mensajes vencidos y `sync_log` fuera de retención (en cascada con `sync_check`); **por lotes** (M-09). |
| POST | `/mantenimiento/recordatorios-citas` | Recordatorios del día (idempotente por `cita.recordatorio_para`) (M-06/M-07). |
| POST | `/mantenimiento/alarmas-despacho` | Alarmas por sector del despacho de la fecha (idempotente) (A-12). |

---

## 5. Reglas de negocio clave

- **Checklist por paso (RF-40 / C-02):** 4 filas en `sync_check` (`CONEXION, LOGIN, DESCARGA, CARGA`),
  cada una con `estado ∈ {PENDIENTE, EN_CURSO, OK, ERROR, OMITIDO}`, `fecha_hora` y `detalle`. Si
  CONEXION = ERROR, DESCARGA/CARGA = **`OMITIDO`** (no `false`).
- **Checklist del fallo de conexión (C-03):** la APK **persiste el checklist en su cola local** (SQLite)
  y lo sube con `PATCH /sync/checklist` en el siguiente arranque con red; es **idempotente** por
  `(id_sync_log, paso)`. El paso CONEXION también puede derivarse en servidor desde el timeout (C-01).
- **Estado de la sesión:** `OK` (0 errores), `PARCIAL` (procesados>0 y errores>0), `ERROR` (fallo total,
  timeout o sin cuadrilla).
- **Asignadas vs. Cerradas (E-04):** Asignadas = casos con fila en `despacho_caso` de la fecha;
  Cerradas = de esos, `caso.estado_actual = 'CERRADO'` **al momento de la consulta**. **Común** =
  `caso.categoria = 'RESIDENCIAL'`; **Referidos** = `caso_especial.clasificacion = 'REFERIDO'`
  (EMPRESA/GOBIERNO no entran en ninguno de los dos modos).
- **Cuadrilla activa (M-08):** se reutiliza `services.sync._cuadrilla_activa` (por `cuadrilla_tecnico.desde/hasta`).
  Se ampliará para **excluir** cuadrillas con `cuadrilla.activa = false` (afecta por igual a DESCARGA y a mensajería).
- **Resolución sector → cuadrilla de alarmas (A-12):** el sector de la falla (`falla_masiva` →
  `despacho_caso.id_sector`) se cruza con **`cuadrilla_sector_dia(fecha, id_sector)`** de la fecha del
  despacho; si `falla_masiva.id_cuadrilla` ya está asignado, se usa ese. Clave de idempotencia:
  **`(id_falla, id_cuadrilla, fecha)`**.
- **Recordatorios (M-06/M-07):** solo `cita` con `id_cuadrilla IS NOT NULL`, `estado IN ('PROPUESTA','CONFIRMADA')`,
  `fecha_hora` de hoy, y `recordatorio_para` distinto de la `fecha_hora` vigente (se reemite si se reprogramó).
- **Purga de mensajes (E-07):** un mensaje vencido se elimina **solo si todos sus destinatarios lo leyeron**;
  si alguno no lo ha leído, **se conserva** hasta que lo lea o hasta `mensajeria.retencion_max_dias` (30).
- **`mensaje` y PII (A-07):** `detalle` del log se expone con **lista blanca** (contadores + códigos de error,
  sin dirección/teléfono/nombre). Coherente con D-69.

---

## 6. Diseño de frontend

### 6.1 Web (React/Vite)

| Componente | Cambio |
|---|---|
| `App.tsx` | Nueva ruta `sistemas` accesible a SUPER/ADMIN/SUPERVISOR (guarda por pestaña; la pestaña BD sigue solo SUPER) (B-02, A-05). |
| `components/Layout.tsx` | El enlace **Sistemas** pasa de `rol === 'SUPER'` a `['SUPER','ADMIN','SUPERVISOR']`; el menú de usuario gana el **badge de mensajes no leídos** (A-05). |
| `pages/Sistemas.tsx` | Se convierte en **pestañas**: **«Base de datos»** (solo SUPER) y **«Sincronización»** (ADMIN/SUPERVISOR/SUPER) (A-05). |
| `pages/Sincronizacion.tsx` *(nuevo)* | Tabla paginada del log + filtros + ficha con el checklist **por paso**. |
| `components/Mensajes.tsx` *(nuevo)* | Bandeja (CU-D81-11) + (si el rol tiene `id_tecnico`) recepción; compositor solo SUPER/ADMIN/SUPERVISOR. |
| `components/useMensajes.ts` *(nuevo)* | Sondeo **20 s** incremental (única pieza con ese periodo). |
| `components/useAutoRefresh.ts` *(nuevo)* | Auto-refresco **30 s** con pausa en segundo plano. |
| `pages/Widget.tsx` / `Panel.tsx` | **Pantalla principal**: gestión diaria (toggle Común/Referidos) + botón **«Agregar caso especial»**. |
| `pruebas/e2e/tests/17-sistemas-y-roles.spec.js` | **Debe actualizarse** (A-05): hoy afirma que el menú no aparece a ADMIN; pasará a verificar la pestaña de Sincronización. |

### 6.2 APK (Flutter)

| Archivo | Cambio |
|---|---|
| `features/sync/sync_screen.dart` | Checklist **por paso** (CONEXION/LOGIN/DESCARGA/CARGA) con estado, hora y detalle (C-02). |
| `features/sync/upload_service.dart` | `dispositivo_id` **real** (UUID persistido en SQLite; ver A-04) y envío del checklist en cola local (C-03). |
| `features/mensajes/mensajes_screen.dart` *(nuevo)* | Bandeja de mensajes + `Timer.periodic(20 s)`. |
| `features/mensajes/mensajes_provider.dart` *(nuevo)* | Estado y contador de no leídos. |
| `main.dart` / `core/sesion.dart` | Nueva ruta **`/sistemas`** (solo lectura del log) y gating por rol (A-11). |

> **A-04 (identificador de dispositivo):** la APK envía hoy `dispositivo_id="apk-local"` fijo. Se generará
> un **UUID una vez**, persistido en la BD local (sin dependencia nueva), y se enviará en `/sync/sesion`.
> Las filas históricas con `apk-local` se conservan sin migración destructiva.

---

## 7. RBAC del incremento (amplía RNF-21/RNF-28)

| Módulo / acción | SUPER | ADMIN | SUPERVISOR | TECNICO |
|---|---|---|---|---|
| SISTEMAS → Sincronización (ver log + checklist) | ✔ | ✔ | ✔ | — |
| SISTEMAS → Base de datos (inspección) | ✔ | — | — | — |
| Mensajería — **enviar** / bandeja de enviados | ✔ | ✔ | ✔ | — |
| Mensajería — **recibir/leer** (los propios) | — | — | — | ✔ |
| Panel gestión diaria (30 s) | ✔ | ✔ | ✔ | — |
| Alta manual de Caso Especial | ✔ | ✔ | ✔ | — |

> **A-01 resuelto:** los **receptores** de mensajes son **TÉCNICOS** (tienen `usuario.id_tecnico`); los
> gestores usan la **bandeja de enviados** (CU-D81-11). Así el modelo (`mensaje_destino.id_tecnico`) y la
> unidireccionalidad (supervisor→técnicos) coinciden sin necesitar destinatario `USUARIO`.

> **Aislamiento por central (RNF-21 / C-04):** `sync_log` y `mensaje` llevan `id_central`; todos los
> endpoints nuevos filtran por `usuario.id_central` (con RLS como defensa en profundidad). Prueba negativa
> entre centrales A/B en CU-D81-02/04/05/09/10.

---

## 8. Seguridad y operación

- **Token de mantenimiento (A-08):** header **`X-Mantenimiento-Token`**, comparación en **tiempo constante**
  (`secrets.compare_digest`), **503 si no está configurado** (nunca fail-open), `/mantenimiento/*` con
  `include_in_schema=False`, y **OIDC de Cloud Scheduler** como alternativa. Cada ejecución se registra en `auditoria`.
- **Zona horaria (A-09):** los 4 jobs con `timeZone: America/Caracas`; «hoy» se calcula con `app_timezone`
  (`app/core/config.py`); `cita.fecha_hora` es `timestamptz`.
- **Purga (M-09):** borrado **por lotes** (una transacción por lote), resultado registrado en `auditoria`
  (de ahí lo lee `/metricas`); no bloquea la tabla.
- **Observabilidad:** `/metricas` añade sesiones de sync hoy (OK/PARCIAL/ERROR), mensajes emitidos/no leídos y última purga.
- **Migración (M-10):** script idempotente (estilo `scripts/migrar_d73_sync.py`) + actualización de
  `db/schema.sql`. **RNF-24 exige Alembic**, que **no existe** en el repo → se **declara la desviación** (ver §10).

---

## 9. Trazabilidad componente ↔ CU ↔ RF

| Componente | CU | RF |
|---|---|---|
| `services/sync.py` + `routes_sync.py` (sesión/checklist/carga) | CU-D81-01, CU-D81-03 | RF-39, RF-40 |
| `routes_sincronizacion.py` + `Sincronizacion.tsx` | CU-D81-02 | RF-39 |
| `routes_mensajes.py` + `services/mensajes.py` + `Mensajes.tsx` + `useMensajes.ts` | CU-D81-04, CU-D81-05, CU-D81-11 | RF-41 |
| Jobs `recordatorios-citas` + `alarmas-despacho` + `PATCH /sync/sesion`→`ESTADO_SYNC` | CU-D81-06 | RF-41 |
| `services/purga.py` + `routes_mantenimiento.py` (purgar + **cerrar-sesiones**) | CU-D81-07 | RF-39, RF-41 |
| `useAutoRefresh.ts` + `Widget.tsx` | CU-D81-08, CU-D81-09 | RF-42, RF-43 |
| `services/panel.py` (gestión diaria) | CU-D81-09 | RF-43 |
| Botón «Agregar caso especial» + `POST /casos-especiales` (`generar_id_averia_ref`, `require_roles("ADMIN","SUPERVISOR")`) | CU-D81-10 | RF-44 |
| **APK**: `sync_screen.dart`, `upload_service.dart`, `mensajes_screen.dart`, `mensajes_provider.dart`, ruta `/sistemas` | CU-D81-01, CU-D81-03, CU-D81-05 | RF-39, RF-40, RF-41 |

---

## 10. Riesgos técnicos y decisiones pendientes

| # | Riesgo / decisión | Mitigación / estado |
|---|---|---|
| R-1 | **Cloud Run sin cron nativo** → infra nueva (Cloud Scheduler + token). | Cloud Scheduler con TZ `America/Caracas`; token fail-closed (§8). Documentar el alta de infra. |
| R-2 | **Sondeo 20 s**: con el fan-out, es `id_mensaje > desde` por índice `(id_tecnico, id_mensaje)`. | Índices por destino; `limit`; cursor por `(id_tecnico, dispositivo_id)` si se requiere. |
| R-3 | La web **no** sincroniza archivos → el checklist lo genera la APK. | La web **consulta**; documentado en §1/§6. |
| R-4 | Retención de **5 días** puede ocultar mensajes no leídos de un técnico sin red. | **Resuelto (E-14):** los **no leídos se conservan** hasta ser leídos o hasta el tope de 30 días (`mensajeria.retencion_max_dias`). |
| R-5 | Crecimiento de `sync_log`. | Retención 90 días + purga por lotes; índices `(iniciado_en)`/`(estado, iniciado_en)`. |
| R-6 | **RNF-24 (Alembic)** no cumplido (script ad-hoc). | **Resuelto (E-15):** script idempotente ahora + actualización de `schema.sql`; **Alembic queda como tarea aparte** (desviación declarada). |
| R-7 | `dispositivo_id` histórico `apk-local` (A-04). | UUID nuevo + conservación de filas históricas. |
| R-8 | Actualización de E2E `17`, diccionario, §5.1 y manuales. | Ver §11. |

---

## 11. Documentación y pruebas (M-11)

**Actualizaciones documentales requeridas al implementar:**
1. `RepoTecnico/requerimientos.md` §5.1 (retención): añadir `mensaje` y `sync_log`/`sync_check` (contienen `p00`, dispositivo y `detalle` jsonb = PII según RNF-18).
2. `RepoTecnico/diccionario_datos.md`: añadir `sync_log` (hoy ausente), `sync_check`, `mensaje`, `mensaje_destino` y la columna `cita.recordatorio_para`.
3. `RepoTecnico/db/schema.sql`: incorporar las tablas/columnas y las semillas de §3.
4. `RepoTecnico/Manuales/` y `docs/Manuales/`: nuevo tema de **mensajería interna** y de **sincronización/checklist**.

**Pruebas nuevas (pytest + E2E):**
- `test_sync_sesion_api.py`: CU-D81-01 (abrir/cerrar/timeout/sin cuadrilla/doble cierre) y CU-D81-03 (checklist por paso, OMITIDO).
- `test_mensajes_api.py`: CU-D81-04/05/06/07/11 (fan-out, sondeo incremental, expiración, idempotencia de lectura, aislamiento por central).
- `test_panel_api.py`: CU-D81-09 (modos, sin despacho, `caso.estado_actual`).
- `test_mantenimiento_api.py`: CU-D81-07 y cierre por timeout; token fail-closed.
- **E2E `17-sistemas-y-roles.spec.js`** actualizado (pestañas y gating); nuevo E2E de mensajería y de panel con auto-refresco.
