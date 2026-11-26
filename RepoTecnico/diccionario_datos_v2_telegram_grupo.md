# Diccionario de datos v2 — Asistente en grupo de Telegram

> Fase 2 completada (auditoría V4). Las entidades existentes (`asistente_sesion`,
> `asistente_remitente`) se conservan; se proponen extensiones mínimas.

## Entidades existentes reutilizadas

| Entidad | Uso en la nueva versión |
|---|---|
| `asistente_sesion` | Guarda cada turno del grupo. Extender `canal` con `TELEGRAM_GRUPO` y añadir `id_grupo`, `mensaje_id`, `id_grupo_mensaje`. |
| `asistente_remitente` | **Solo registro histórico del chat privado**; deja de ser fuente de autorización en el nuevo canal (H-18). La autorización del grupo reside exclusivamente en `asistente_grupo_miembro`. |
| `caso` / `caso_especial` | Fuente de los datos consultados y destino de las actualizaciones canónicas. |
| `auditoria` / `caso_estado_hist` | Trazabilidad de escrituras y cambios de estado. |

## Entidades nuevas propuestas

### `asistente_grupo`

| Campo | Tipo | Descripción |
|---|---|---|
| `id_grupo` | `serial` PK | Identificador interno del grupo. |
| `chat_id` | `bigint` UNIQUE | `message.chat.id` de Telegram (negativo en grupos). Valor inicial: `-5561202916`. |
| `titulo` | `varchar(160)` | Nombre del grupo. Valor inicial: `GGTOv3-PDE`. |
| `topic_id` | `bigint` NULL | `message_thread_id` si se usa un tema específico. |
| `activo` | `boolean` | Si el bot atiende el grupo. |
| `id_central` | `integer` FK | Central a la que pertenece el grupo (RNF-06). |
| `politica_pii` | `enum('NONE','REFERENCIAS','COMPLETO')` | Nivel de PII permitido; valor por defecto `REFERENCIAS` (DEC-TG-05). |
| `eventos_config` | `jsonb` | Eventos habilitados para este grupo (DEC-TG-03), p. ej. `{"CIERRE":true,"CITA":true,"FALLA":false}`. |
| `creado_en` | `timestamptz` | Alta del grupo. |

### `asistente_grupo_miembro`

| Campo | Tipo | Descripción |
|---|---|---|
| `id_miembro` | `serial` PK | — |
| `id_grupo` | `integer` FK | Grupo al que pertenece. |
| `telegram_user_id` | `bigint` | `from.id` del usuario. |
| `p00` | `varchar(20)` FK | Usuario GGTO **propio y nominado**; **nunca** `GGTOAST001` (DEC-TG-12). Sin cuenta ⇒ sin permisos de escritura. |
| `rol` | `varchar(20)` | Rol GGTO asignado explícitamente (no heredado del usuario de servicio). |
| `puede_actualizar` | `boolean` | `=true` solo si `rol ∈ {SUPER,ADMIN,SUPERVISOR}`; TECNICO conserva D-68. |
| `activo` | `boolean` | — |

### Alertas: reutilizar `notificacion` (DEC-TG-07)

**No se crea una tabla de alertas nueva.** El bot encola cada evento en la
entidad existente `notificacion` con:

| Campo | Valor para el grupo |
|---|---|
| `canal` | `TELEGRAM` |
| `destinatario` | `chat.id` del grupo (o `chat.id:topic_id`) |
| `asunto` | Tipo de evento (`CIERRE`, `CITA`, `ENRUTADO`, `DIFERIDO`, `FALLA`) |
| `cuerpo` | Texto con solo referencias (DEC-TG-05) |
| `id_caso` | Caso relacionado |
| `id_mensaje_telegram` | No es columna de `notificacion`: se registra en la bitácora del bot para idempotencia |
| `estado` / `intentos` / `proximo_intento` | Gestionados por el outbox existente |

El tipo de evento se decide con `asistente_grupo.eventos_config` (JSON) y el
enviador del outbox publica como el bot, miembro del grupo.

### `asistente_pending_confirm`

| Campo | Tipo | Descripción |
|---|---|---|
| `id_pending` | `serial` PK | — |
| `id_grupo` / `telegram_user_id` | `integer` / `bigint` | Contexto; **índice único parcial** `WHERE estado='PENDIENTE'` sobre `(id_grupo, telegram_user_id)`; las filas `CONSUMIDA`/`EXPIRADA` permiten nuevas pendientes. |
| `intencion` | `varchar(20)` | `ALTA_CASO` / `EVENTO` (incluye `CAMBIO_ESTADO`, `CITA`, `COMENTARIO`). |
| `ficha_json` | `jsonb` | Ficha editable en espera de confirmación. |
| `estado` | `enum` | `PENDIENTE` / `CONSUMIDA` / `DESCARTADA` / `EXPIRADA`. |
| `expira_en` | `timestamptz` | Caducidad de la vista previa. |
| `solicitado_por` / `confirmado_por` | `bigint` | `from.id` del solicitante y de quien ejecuta `/confirmar <id_pending>`; deben coincidir o ser gestor designado (DEC-TG-13). |
| `id_mensaje_preview` | `integer` | `message_id` de la vista previa en Telegram. |

> Nota: las migraciones se harán idempotentes (patrón D-121/D-164) y se
> documentarán en `BaseOperaciones/` antes de aplicarlas en producción.
