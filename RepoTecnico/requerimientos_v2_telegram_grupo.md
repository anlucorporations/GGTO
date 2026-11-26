# Requerimientos v2 — Asistente con IA en grupo de Telegram

> **Fase 2 completada — auditoría (26/11/2026).** Documento nuevo, no sustituye a
> `requerimientos.md` ni al histórico del proyecto. Entrevista respondida
> (DEC-TG-01…10); veredicto de [`INFORME_OPTIMIZACION_V4.md`](INFORME_OPTIMIZACION_V4.md):
> Resuelto en Fase 2: DEC-TG-01…17, casos de uso APTO, documento técnico APTO. Fase 2 cerrada.

## 1. Contexto y línea base

El proyecto ya tiene:

- `asistente-ggto` (Node.js) desplegado en vm-preview, con **un** chat de
  Telegram autorizado (`chat_id 1090508107` → p00 `123456`), LLM (Nemotron vía
  gateway OpenCode), MCP de GGTO (`estado_central`, `consultar_caso`, …) y
  escrituras canónicas previa confirmación.
- Panel web de chat embebido en la SPA y APK `1.15.26+51` consumiendo la API.
- Usuario de servicio `GGTOAST001` (rol SUPERVISOR) ya activado.

**Brecha de la nueva versión:** el canal actual es *chat privado de un solo
remitente*; se requiere un **grupo** con varios usuarios, con identidad por
usuario, y que el bot actúe como **un miembro más** del grupo enviando alertas.

## 2. Requerimientos funcionales

| ID | Requerimiento | Actor | Resultado verificable |
|---|---|---|---|
| RF-TG-01 | **Consultar un caso por identificador** desde el grupo. El bot interpreta texto libre, resuelve el caso con MCP/API y responde en el grupo con los datos autorizados. | Cualquier miembro del grupo | Mensaje con **ID de avería, ID de pago, estado y sector** (DEC-TG-05); sin nombre, teléfono ni dirección; sin escrituras. |
| RF-TG-02 | **Actualizar información o estatus de un caso** a partir de un indicador (ID de caso + campo/estado deseado). Vista previa y `/confirmar <id_pending>` antes de escribir. | **Solo roles de gestión** (SUPER/ADMIN/SUPERVISOR); TECNICO solo cambio de estado vigente (D-68) | `PATCH /casos/{id}` o `POST /casos/{id}/estado` aplicado; bitácora y auditoría registradas con `from.id` del solicitante y del confirmador; respuesta en el grupo. |
| RF-TG-03 | **Enviar mensajes/alertas al grupo** como un usuario más (el bot), ante los eventos habilitados en `eventos_config`. | Sistema / bot | Mensaje publicado en el grupo con plantilla fija, deduplicado y trazable; solo referencias (DEC-TG-05). |
| RF-TG-04 | **Asistente con IA integrado en la web**, compartiendo el mismo motor (LLM + MCP/API) que el grupo. **APK en ciclo posterior** (DEC-TG-11). | Operador web | Misma ficha extraída, misma confirmación y mismos caminos canónicos en **dos canales (grupo y web)**. |
| RF-TG-05 | **Identidad y autorización por usuario de Telegram** dentro del grupo: identidad por `from.id`, nunca por `chat.id` del grupo. | SUPER / SUPERVISOR de la central | Tabla de miembros con `telegram_user_id`, `p00` propio (nunca `GGTOAST001`), rol y central; un mensaje de quien no esté autorizado no se procesa. |

## 3. Requerimientos no funcionales

| ID | Requerimiento |
|---|---|
| RNF-TG-01 | **Fail-closed (dos códigos):** cabecera `X-Telegram-Bot-Api-Secret-Token` ausente/inválida → **403** sin invocar MCP; credenciales de bot/MCP/usuario de servicio ausentes → **503** con aviso al grupo. |
| RNF-TG-02 | **Privacidad:** el grupo muestra **solo referencias** (ID de avería, ID de pago, estado, sector); sin nombre, teléfono ni dirección. `politica_pii` no admite `COMPLETO` para este grupo. |
| RNF-TG-03 | **Trazabilidad:** cada turno del grupo se registra en `asistente_sesion` con `canal=TELEGRAM_GRUPO`, `id_grupo`, `mensaje_id`, p00 y resultado. |
| RNF-TG-04 | **Idempotencia:** un reenvío del mismo `update_id`/`message_id` no duplica respuesta ni escritura. |
| RNF-TG-05 | **Cuota y control de abuso:** límite por minuto/día por grupo y por usuario (hereda 30/min, 500/día del canon v2-A5). |
| RNF-TG-06 | **RBAC y recinto:** las escrituras se acotan a la central del usuario de servicio y al rol del remitente; SUPER por bypass. |
| RNF-TG-07 | **Resiliencia:** ante 503 del proveedor de IA, aviso al grupo y reintento; sin pérdida de la pendiente de confirmación. |

## 4. Requerimientos técnicos

| ID | Requerimiento |
|---|---|
| RT-TG-01 | Telegram Bot API: webhook con `secret_token`, `setWebhook`, modo privacidad del bot configurado para recibir mensajes del grupo. |
| RT-TG-02 | Reutilizar `asistente-ggto` como motor único; añadir soporte de `message.chat.type=group/supergroup` y `from.id`. |
| RT-TG-03 | MCP/API de GGTO vía `GGTO_MCP_KEY` y JWT del usuario de servicio `GGTOAST001`. |
| RT-TG-04 | Extensión del esquema: grupo, miembro y sesión de grupo; las alertas reutilizan `notificacion.canal=TELEGRAM` según DEC-TG-07 (ver `diccionario_datos_v2_telegram_grupo.md`). |
| RT-TG-05 | Integración en la SPA (`asistente` en web) consumiendo el mismo endpoint del motor. La pantalla de la APK queda para el ciclo posterior (DEC-TG-11). |

## 5. Dudas abiertas (bloque 1 de la entrevista)

1. ¿Qué identificadores acepta el bot para localizar un caso?
2. ¿Quién puede actualizar y con qué control de confirmación?
3. ¿Qué eventos dispara el bot al grupo y con qué contenido/PII?

## 6. Decisiones del usuario — bloque 1 (26/11/2026)

| Decisión | Valor |
|---|---|
| **DEC-TG-01** | El bot localiza casos por **`id_averia` + identificador de pago `70*`**. El `REF-` queda como fuente opcional, no obligatoria. |
| **DEC-TG-02** | Las actualizaciones de info/estatus las puede hacer **solo rol de gestión (SUPER/ADMIN/SUPERVISOR)** y siempre con **vista previa + `CONFIRMAR`** antes de escribir. |
| **DEC-TG-03** | Los eventos que publica el bot en el grupo son **configurables por grupo** (tabla de configuración), no un conjunto fijo. |

## 7. Decisiones del usuario — bloque 2 (26/11/2026)

| Decisión | Valor |
|---|---|
| **DEC-TG-04** | Se usa el **grupo actual** de Telegram y el **túnel Tailscale Funnel** existente (`https://vm-preview.tailb951ba.ts.net/telegram`), añadiendo el `chat.id` del grupo; no se crea dominio público nuevo. |
| **DEC-TG-05** | El grupo recibe **solo referencias**: ID de avería, ID de pago, estado y sector; **sin nombre, teléfono ni dirección**. |
| **DEC-TG-06** | La integración del asistente en la **APK se difiere** a un ciclo posterior; en esta versión se integra solo en la **web**. |

## 8. Decisiones del usuario — bloque 3 (26/11/2026)

| Decisión | Valor |
|---|---|
| **DEC-TG-07** | Las alertas al grupo **usan el canal `TELEGRAM` del esquema de notificaciones existente** (tabla `notificacion` + outbox); no se crea una tabla nueva de alertas. `destinatario` = `chat.id` del grupo y `id_caso` vincula el evento. La configuración por grupo decide qué tipos de evento se encolan. |
| **DEC-TG-08** | La confirmación en el grupo se hace con el comando **`/confirmar`**; la vista previa muestra el identificador de la solicitud pendiente. |
| **DEC-TG-09** | Se trabaja en una **rama nueva** creada desde `GGTOv2-DSH-GCP`, reutilizando GitHub `anlucorporations/GGTO` y GitLab `anlucorporations/ggto`. **Sin push sin orden explícita** (`/push`). |

## 9. Identidad de Telegram incorporada (26/11/2026)

| Dato | Valor |
|---|---|
| Bot | `GGTOv2Testbot` (`first_name: GGTO-PDE`) · `bot_id 9052843256` (verificado con `getMe`) |
| Token | Guardado en Secret Manager como **`ggto-telegram-bot-token`** (proyecto `plataforma-txbarlovento`, versión 1). **Nunca en el repo.** |
| Grupo | **`GGTOv3-PDE`** · `chat_id -5561202916` · tipo `group` (verificado con `getChat`) |
| Chat directo | `chat_id 8589760242` · usuario `txbarlovento` (`PlantaInternaM4`) · tipo `private` (verificado con `getChat`). Se registra como chat de administración, **no como bot**. |
| Webhook | `secret_token` generado y guardado como **`ggto-telegram-webhook-secret`** (mismo proyecto). |

**DEC-TG-10:** el bot atiende el grupo `GGTOv3-PDE` y el chat directo de administración; sus credenciales se consumen por referencia a Secret Manager/docker secret, nunca como literales en código o documentación.

## 10. Decisiones tras la auditoría V4 (26/11/2026)

| Decisión | Valor |
|---|---|
| **DEC-TG-11** | Alcance de esta versión: **grupo + web**. La APK queda para un ciclo posterior con su propio RF/RT (resuelve H-01). |
| **DEC-TG-12** | Actualizaciones: **solo roles de gestión** (SUPER/ADMIN/SUPERVISOR); el TECNICO conserva su permiso vigente de cambio de estado (D-68). Ningún miembro se mapea al usuario de servicio (resuelve H-05/H-06). |
| **DEC-TG-13** | Confirmación canónica: **`/confirmar <id_pending>`**, pendiente persistida con `expira_en`, estado y `confirmado_por`; solo el solicitante o un gestor designado puede confirmar (resuelve H-02/H-03). |

**Fase 2 completada** con auditoría V4; las decisiones anteriores cierran las 3 preguntas del bloque 1 del informe. Siguiente: casos de uso con Gherkin/EARS y trazabilidad.
