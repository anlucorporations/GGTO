# Despliegue de `asistente-ggto` — checklist §9 del canon (pendiente de ejecutar)

> Estado: **DESPLEGADO (2026-11-19/20)** en `vm-preview` (100.113.94.52:3004), contenedor
> `asistente-ggto` con `docker compose up -d --build`; `/health` en verde (`llm/mcp/telegram:
> configurado`) y humo de chat CONSULTA→RESUMEN_DIA con datos reales OK.
> Secretos en `/etc/secure/asistente-ggto.env` (0400, enlazado como `.env` del compose):
> GGTOAST001, GGTO_MCP_KEY, OPENROUTER_API_KEY (`openrouter-key-2`), TELEGRAM_*.
> Ejecutar en `vm-preview` (100.113.94.52) como root, siguiendo el canon
> `RepoTecnico/Asistente/MANUAL_ASISTENTES_V2.md` y `04_runbook.md` (patrón V2-A2).

## 0 · Requisitos previos (decido el usuario)

- [ ] **Usuario de servicio en GGTO**: p00 tipo `GGTOAST001`, rol `SUPERVISOR` (o ADMIN), central
      2324X. Clave inicial → se guarda en `/etc/secure/asistente-ggto.env` (paso 2); **nunca en repo**.
- [ ] **Clave de OpenRouter (v2.2)**: usar el secreto `openrouter-key-2` en Secret Manager
      (`plataforma-txbarlovento`; verificada 2026-11-18 — `openrouter-key-1` responde 401).
- [ ] **Clave del MCP de GGTO**: fijar `mcp.api_key` en la tabla `configuracion` (hoy vacía ⇒ el
      endpoint responde 503) y copiarla al docker secret `ggto_mcp_key`.
- [ ] **Token del bot de Telegram**: crear bot con @BotFather, token → Secret Manager/directo al
      docker secret; `secret_token` del webhook: cadena aleatoria ≥ 32 chars.
- [ ] Decidir **puerto** del rango 3002–3019 (3002 = demo `asistente-hotel`) y registrarlo en el
      runbook §3.

## 1 · Migraciones idempotentes (patrón D-164: simula → aplica)

```bash
# en vm-preview, con DB_* del entorno de producción (o --dsn vía cloud-sql-proxy):
python scripts/migrar_av_asistente_sesion.py                 # simula
python scripts/migrar_av_asistente_sesion.py --aplicar --si  # tabla asistente_sesion (C4)
python scripts/migrar_av_asistente_remitentes.py --aplicar --si  # tabla asistente_remitente (C5)
```

## 2 · Secretos (RS-2 — nada en `.env` versionado ni en claro en disco compartido)

```bash
# clave de OpenRouter (v2.2 — RS-2, nunca en .env/repo). Claves verificadas 2026-11-18:
#   openrouter-key-1 → 401 (inválida); openrouter-key-2 → OK (límite 50 USD, uso 0) ← LA VÁLIDA
#   (opcode-gateway-api-key es la clave del servidor OpenCode legacy, NO de OpenRouter)
gcloud secrets versions access latest --secret=openrouter-key-2 --project=plataforma-txbarlovento \
  | sudo tee /etc/secure/openrouter_api_key >/dev/null && sudo chmod 0400 /etc/secure/openrouter_api_key
# clave del MCP de GGTO (de la tabla configuracion, parámetro mcp.api_key → docker secret ggto_mcp_key):
#   (pedirla al SUPER; solo se lee de la BD)  →  /etc/secure/ggto_mcp_key (chmod 0400)
# env_file root-only del asistente:
sudo nano /etc/secure/asistente-ggto.env   # chmod 0400 — contenido:
#   GGTO_SERVICE_USER=GGTOAST001
#   GGTO_SERVICE_PASSWORD=<clave del usuario de servicio>
#   TELEGRAM_SECRET=<secret_token del webhook>
#   TELEGRAM_BOT_TOKEN=<token de @BotFather>
#   MONGO_URL=<resoluble por tailnet; BD proj_ggto con usuario dedicado>
#   GATEWAY_AUTH_KEY=<valor de opcode-gateway-api-key>  ← proveedor activo (REF-SEC-26)
```
# La credencial del gateway se publica así (nunca en el repo):
```bash
gcloud secrets versions access latest --secret=opcode-gateway-api-key --project=plataforma-txbarlovento \
  | sudo tee /etc/secure/opcode-gateway-api-key >/dev/null && sudo chmod 0400 /etc/secure/opcode-gateway-api-key
# y se añade GATEWAY_AUTH_KEY=<ese valor> a /etc/secure/asistente-ggto.env (0400)
```

## 3 · Alta y arranque (runbook §3, patrón V2-A2)

```bash
sudo /usr/local/bin/alta_asistente.sh ggto <puerto>     # genera servicio/BD/namespace según canon
cd /opt/asistente-ggto && docker compose up -d --build  # limits ya en el compose (1 CPU / 1 GB)
```

## 4 · Webhook de Telegram ✅ EJECUTADO (2026-11-21)

`vm-preview` ya tenía **Tailscale Funnel** activo en `https://vm-preview.tailb951ba.ts.net`
(solo el path `/`, hacia el puerto 8000). Se expone **únicamente** `/telegram`:

```bash
# en vm-preview (el contenedor escucha en la IP Tailscale, no en 127.0.0.1):
sudo tailscale funnel --set-path=/telegram --bg http://100.113.94.52:3004/telegram
tailscale funnel status   # / → 8000 · /telegram → 3004
```

```bash
# registro del webhook (token y secret en Secret Manager, nunca en el repo):
curl -s -X "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://vm-preview.tailb951ba.ts.net/telegram" \
  -d "secret_token=$TELEGRAM_SECRET" | jq .
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | jq .
```

- [x] Funnel activo y restringido a `/telegram` (el panel NO queda público).
- [x] `secret_token` fail-closed: sin cabecera → **403**; con cabecera → **200**.
- [x] Bot `@GGTOv2Testbot` verificado con `getMe` (id 9052843256).
- [x] Remitente autorizado: `chat_id=1090508107` → p00 `123456` (SUPER), central 1.
- [x] Humo real: `CONSULTA → RESUMEN_DIA` por webhook con respuesta del bot y turno
      registrado en `asistente_sesion` (`TG-1090508107`, canal TELEGRAM).
- [x] Migración de secuencias aplicada (ver `RepoTecnico/BaseOperaciones/asistente_secuencias.sql`):
      `asistente_sesion.id_turno` y `asistente_remitente.id_remitente` no tenían DEFAULT;
      el API respondía **500** al registrar turnos. Ahora `nextval(...)` con GRANT a
      `ggtov2_app` (POST → **201**).

> **MCP (verificado 2026-11-21):** `tools/list` devuelve 4 herramientas
> (`estado_central`, `consultar_caso`, `reportar_falla`, `procesar_notificaciones`) y
> `estado_central` responde con datos reales. Solo las dos de lectura se usan. Como el
> endpoint de generación del Gateway OpenCode no acepta `tools`, el MCP se conecta por
> código en `resolverConsulta` (`estado_central` para RESUMEN_DIA, `consultar_caso` para
> CASO) y la respuesta lleva `via:"MCP+API"`; si el MCP falla se cae a la API REST.
> Humo: `/api/chat` → `via:MCP+API`, `casos_pendientes:112`, `fallas_activas:1`.

> **Nota:** el tier `:free` de OpenRouter (`openrouter/free`) se satura por proveedor
> a ratos (429) y el webhook responde `{"atendido":true,"accion":"error","status_interno":503}`
> con el mensaje de error al usuario; `llamarLLM` ya prueba modelos gratis alternativos
> antes de rendirse. Para estabilidad plena: créditos + `LLM_MODEL=deepseek/deepseek-v4.1-flash-1017`.

## 5 · Checklist §9 del canon (verificar una a una)

| # | Verificación en `asistente-ggto` | Estado |
|---|---|---|
| 1 | BD Mongo `proj_ggto` creada, usuario dedicado readWrite solo su BD | ☐ |
| 2 | `OPENROUTER_API_KEY` por docker secret root-only (`/run/secrets/openrouter_api_key`, **no en .env**) | ☐ |
| 3 | `GGTO_MCP_KEY` por docker secret root-only (`/run/secrets/ggto_mcp_key`) y `mcp.api_key` configurada en GGTO | ☐ |
| 4 | `MONGO_URL` resoluble desde el contenedor (tailnet) | ☐ |
| 5 | `LLM_PROVIDER=opencode` · `GATEWAY_URL=http://100.125.94.21:4090` · `MODEL_ID=nvidia/nemotron-3.5-super-vl-120b-a12b` · `MODEL_PROVIDER=nvidia` · `GATEWAY_AUTH_KEY` desde `opcode-gateway-api-key` (REF-SEC-26). El `:free` (`nemotron-3.5-super-vl-free`/`opencode`) está agotado (~6 h); se usa la misma familia vía NVIDIA del gateway (probado OK). Alternativa con tools MCP: `LLM_PROVIDER=openrouter` | ☑ |
| 6 | `curl http://100.113.94.52:<puerto>/health` → `{"status":"ok","llm":"configurado","mcp":"configurado","telegram":"configurado"}` | ☐ |
| 7 | Chat básico: texto ficticio → ficha; CONSULTA → respuesta (el LLM puede operar tools de lectura del MCP); CONFIRMAR → alta canónica; historial en `asistente_sesion` + Mongo | ☐ |
| 8 | docker-compose limits 1 CPU / 1 GB (ya configurado) | ☐ |
| 9 | Puerto registrado en `04_runbook.md` §3 y en `estado_proyecto.md` | ☐ |
| 10 | RS-2: sin secretos en fuentes/repo; auditoría anti-env (`grep -r "7012\|api.telegram\|OPENROUTER_API_KEY=\|GGTO_MCP_KEY=" .` sin credenciales) | ☐ |

## 6 · Humo final (con producción)

- [ ] Alta real: texto → ficha editable → confirmar → 201 con `REF-…` en GGTO. *(CONSULTA
      → RESUMEN_DIA verificada 2026-11-20; ALTA/EVENTO exigen el LLM vivo — el pool `:free`
      de OpenRouter se satura por upstream a ratos y responde 503; ver nota)*
- [ ] Evento real: `PATCH` comentario / cita / cambio de estado sobre un caso de prueba.
- [ ] Consultas: caso por 70\*, FAT, resumen del día (verificar sin PII en listados).
- [ ] Telegram: mensaje de remitente autorizado → vista previa → CONFIRMAR; remitente no
      autorizado → sin respuesta y sin gasto de OpenRouter.

> **Nota LLM (2026-11-20):** el tier `:free` de OpenRouter (`openrouter/free`, ling-3.2,
> gemma-4-31b) se satura **por upstream** (`upstream_provider_shared_pool`) y devuelve 429
> a ratos; `llamarLLM` reintenta 1 vez con backoff de 3 s y si persiste responde 503
> fail-closed. Para estabilidad plena: añadir créditos en openrouter.ai y fijar
> `LLM_MODEL=deepseek/deepseek-v4.1-flash-1017` (el compose ya lo permite por env).
