# Despliegue de `asistente-ggto` — checklist §9 del canon (pendiente de ejecutar)

> Estado: **documentado en C6, sin ejecutar** (orden del usuario: C6 sin despliegue).
> Ejecutar en `vm-preview` (100.113.94.52) como root, siguiendo el canon
> `RepoTecnico/Asistente/MANUAL_ASISTENTES_V2.md` y `04_runbook.md` (patrón V2-A2).

## 0 · Requisitos previos (decido el usuario)

- [ ] **Usuario de servicio en GGTO**: p00 tipo `GGTOAST001`, rol `SUPERVISOR` (o ADMIN), central
      2324X. Clave inicial → se guarda en `/etc/secure/asistente-ggto.env` (paso 2); **nunca en repo**.
- [ ] **Clave de OpenRouter (v2.2)**: crear/obtener en Secret Manager (`openrouter-api-key` en
      `plataforma-txbarlovento`) — es la credencial del LLM principal.
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
# clave de OpenRouter (v2.2 — RS-2, nunca en .env/repo):
gcloud secrets versions access latest --secret=openrouter-api-key --project=plataforma-txbarlovento \
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
```

## 3 · Alta y arranque (runbook §3, patrón V2-A2)

```bash
sudo /usr/local/bin/alta_asistente.sh ggto <puerto>     # genera servicio/BD/namespace según canon
cd /opt/asistente-ggto && docker compose up -d --build  # limits ya en el compose (1 CPU / 1 GB)
```

## 4 · Webhook de Telegram (una vez resuelta la URL pública — decisión de C5/C6)

```bash
# con la URL pública (o túnel) del asistente:
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<URL_PUBLICA>/telegram" \
  -d "secret_token=$TELEGRAM_SECRET" | jq .
```

- [ ] Dar de alta los remitentes: SUPER → `POST /api/v1/asistente/remitentes` (chat_id, p00, central).

## 5 · Checklist §9 del canon (verificar una a una)

| # | Verificación en `asistente-ggto` | Estado |
|---|---|---|
| 1 | BD Mongo `proj_ggto` creada, usuario dedicado readWrite solo su BD | ☐ |
| 2 | `OPENROUTER_API_KEY` por docker secret root-only (`/run/secrets/openrouter_api_key`, **no en .env**) | ☐ |
| 3 | `GGTO_MCP_KEY` por docker secret root-only (`/run/secrets/ggto_mcp_key`) y `mcp.api_key` configurada en GGTO | ☐ |
| 4 | `MONGO_URL` resoluble desde el contenedor (tailnet) | ☐ |
| 5 | `LLM_MODEL` = modelo de OpenRouter elegido (defecto `openai/gpt-4o-mini`); `LLM_TOOLS_ENABLED=true` | ☐ |
| 6 | `curl http://100.113.94.52:<puerto>/health` → `{"status":"ok","llm":"configurado","mcp":"configurado","telegram":"configurado"}` | ☐ |
| 7 | Chat básico: texto ficticio → ficha; CONSULTA → respuesta (el LLM puede operar tools de lectura del MCP); CONFIRMAR → alta canónica; historial en `asistente_sesion` + Mongo | ☐ |
| 8 | docker-compose limits 1 CPU / 1 GB (ya configurado) | ☐ |
| 9 | Puerto registrado en `04_runbook.md` §3 y en `estado_proyecto.md` | ☐ |
| 10 | RS-2: sin secretos en fuentes/repo; auditoría anti-env (`grep -r "7012\|api.telegram\|OPENROUTER_API_KEY=\|GGTO_MCP_KEY=" .` sin credenciales) | ☐ |

## 6 · Humo final (con producción)

- [ ] Alta real: texto → ficha editable → confirmar → 201 con `REF-…` en GGTO.
- [ ] Evento real: `PATCH` comentario / cita / cambio de estado sobre un caso de prueba.
- [ ] Consultas: caso por 70\*, FAT, resumen del día (verificar sin PII en listados).
- [ ] Telegram: mensaje de remitente autorizado → vista previa → CONFIRMAR; remitente no
      autorizado → sin respuesta y sin gasto de OpenRouter.
