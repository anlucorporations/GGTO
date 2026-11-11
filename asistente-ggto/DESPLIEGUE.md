# Despliegue de `asistente-ggto` — checklist §9 del canon (pendiente de ejecutar)

> Estado: **documentado en C6, sin ejecutar** (orden del usuario: C6 sin despliegue).
> Ejecutar en `vm-preview` (100.113.94.52) como root, siguiendo el canon
> `RepoTecnico/Asistente/MANUAL_ASISTENTES_V2.md` y `04_runbook.md` (patrón V2-A2).

## 0 · Requisitos previos (decido el usuario)

- [ ] **Usuario de servicio en GGTO**: p00 tipo `GGTOAST001`, rol `SUPERVISOR` (o ADMIN), central
      2324X. Clave inicial → se guarda en `/etc/secure/asistente-ggto.env` (paso 2); **nunca en repo**.
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
# gateway REF-SEC-26 (canon §9-2):
gcloud secrets versions access latest --secret=opcode-gateway-api-key --project=plataforma-txbarlovento \
  | sudo tee /etc/secure/opcode-gateway-api-key >/dev/null && sudo chmod 0400 /etc/secure/opcode-gateway-api-key
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
| 2 | `GATEWAY_AUTH_KEY` por docker secret root-only (REF-SEC-26, **no en .env**) | ☐ |
| 3 | `MONGO_URL` resoluble desde el contenedor (tailnet) | ☐ |
| 4 | `MODEL_ID/MODEL_PROVIDER` = `claude-haiku-5-5`/`opencode-go` (verificado en C1) | ☐ |
| 5 | `curl http://100.113.94.52:<puerto>/health` → `{"status":"ok","gateway":"configurado","telegram":"configurado"}` | ☐ |
| 6 | Chat básico: texto ficticio → ficha; CONSULTA → respuesta; CONFIRMAR → alta canónica; historial en `asistente_sesion` + Mongo | ☐ |
| 7 | docker-compose limits 1 CPU / 1 GB (ya configurado) | ☐ |
| 8 | Puerto registrado en `04_runbook.md` §3 y en `estado_proyecto.md` | ☐ |
| 9 | RS-2: sin secretos en fuentes/repo; auditoría anti-env (`grep -r "7012\|api.telegram\|GATEWAY_AUTH_KEY=" .` sin credenciales) | ☐ |

## 6 · Humo final (con producción)

- [ ] Alta real: texto → ficha editable → confirmar → 201 con `REF-…` en GGTO.
- [ ] Evento real: `PATCH` comentario / cita / cambio de estado sobre un caso de prueba.
- [ ] Consultas: caso por 70\*, FAT, resumen del día (verificar sin PII en listados).
- [ ] Telegram: mensaje de remitente autorizado → vista previa → CONFIRMAR; remitente no
      autorizado → sin respuesta y sin gasto de gateway.
