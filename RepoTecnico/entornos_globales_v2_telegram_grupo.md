# Entornos globales v2 — Asistente en grupo de Telegram

> Fase 2 completada (auditoría V4). Configuración prevista; los valores Secret
> Manager se referencian por nombre, nunca por valor.

## 1. Despliegue vigente (línea base)

| Componente | Valor |
|---|---|
| API / web GGTO | `https://ggto-web-695669822281.europe-west1.run.app` (Cloud Run `ggto-web:v106`, revisión `ggto-web-00016-k2k`) |
| MCP GGTO | `{GGTO_API_URL}/api/v1/mcp` · 4 tools |
| Motor asistente | `asistente-ggto` en vm-preview, `http://100.113.94.52:3004` (tailnet) |
| Webhook Telegram actual | `https://vm-preview.tailb951ba.ts.net/telegram` → puerto 3004 |
| Usuario de servicio | `GGTOAST001` · rol `SUPERVISOR` · central 1 (cuenta activada 26/11/2026) |
| BD | `ggtov2` en PostgreSQL 16.15 (`vm-databases`, 10.140.0.2:5432) |
| Repositorios | GitHub `anlucorporations/GGTO` · GitLab `anlucorporations/ggto` · rama `GGTOv2-DSH-GCP` |

## 2. Variables de entorno nuevas / reutilizadas

| Variable | Uso |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot (Secret Manager, docker secret `telegram_bot_token`). |
| `TELEGRAM_SECRET` | `secret_token` del webhook; cabecera `X-Telegram-Bot-Api-Secret-Token`. |
| `TELEGRAM_GROUP_ID` | `chat.id` del grupo destino (o tabla `asistente_grupo`). |
| `TELEGRAM_TOPIC_ID` | `message_thread_id` opcional. |
| `GGTO_API_URL` | API canónica (valor vigente arriba). |
| `GGTO_SERVICE_USER` / `GGTO_SERVICE_PASSWORD` | `GGTOAST001` / secreto `ggto-service-pass`. |
| `GGTO_MCP_KEY` | Clave `X-MCP-Key` del MCP (docker secret `ggto_mcp_key`). |
| `LLM_PROVIDER` / `LLM_MODEL` | **`opencode` / `nvidia/nemotron-3.5-super-vl-120b-a12b`** (DEC-TG-14, verificado en `/health`); `openrouter` queda como alternativo. |
| `RATE_PER_MIN` / `DAILY_CHAT_LIMIT` | 30 / 500, por grupo y por usuario. |

## 3. Comandos de operación (referencia)

```bash
# Webhook del grupo (sustituye al actual de chat privado)
curl -F "url=https://vm-preview.tailb951ba.ts.net/telegram" \
     -F "secret_token=$TELEGRAM_SECRET" \
     https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook

# Salud del motor
curl http://100.113.94.52:3004/health

# Migración idempotente: PENDIENTE de crear en Fase 3 (scripts/migrar_tg_grupo.py)
# No ejecutar hasta que exista y pase la prueba en esquema aislado.
```

## 4. Resuelto en el bloque 2

- Grupo: **el existente**, con webhook en `https://vm-preview.tailb951ba.ts.net/telegram` (Funnel actual).
- PII: **solo referencias** (ID de avería, ID de pago, estado, sector).
- APK: **diferida**; esta versión integra el asistente solo en la web.

## 5. Resuelto en el bloque 3

- Eventos: se encolan en `notificacion.canal='TELEGRAM'` (outbox existente); el tipo lo decide `eventos_config` del grupo.
- Confirmación: comando **`/confirmar <id_pending>`**, pendiente persistida con TTL y `confirmado_por` (DEC-TG-13).
- Git: **rama nueva** desde `GGTOv2-DSH-GCP`, mismos repos; sin push sin `/push`.

## 6. Identidad Telegram verificada (26/11/2026)

| Variable / dato | Valor |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Secreto **`ggto-telegram-bot-token`** (Secret Manager, `plataforma-txbarlovento`) |
| `TELEGRAM_SECRET` | Secreto **`ggto-telegram-webhook-secret`** (mismo proyecto) |
| `TELEGRAM_GROUP_ID` | `-5561202916` — grupo **`GGTOv3-PDE`** |
| `TELEGRAM_ADMIN_CHAT_ID` | `8589760242` — chat privado de `txbarlovento` (administración), **no el bot** |
| `TELEGRAM_BOT_ID` | `9052843256` — `GGTOv2Testbot` |

Verificado con `getMe` y `getChat` contra la API de Telegram. El token **no se escribe en este archivo ni en el repo**.

Pendiente operativo para el ciclo de implementación: `setWebhook` con el `secret_token` del nuevo secreto y comprobación de que el bot recibe mensajes del grupo.
