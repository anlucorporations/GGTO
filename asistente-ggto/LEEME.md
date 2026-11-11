# asistente-ggto — Asistente virtual de gestión por texto libre

App Node.js ligera (canon **v2-A5** de `RepoTecnico/Asistente/`): entiende texto libre, extrae la
ficha estructurada con el **Gateway OpenCode** (`claude-haiku-5-5`) y muestra una **vista previa**.
**No escribe nada en GGTO sin confirmación humana** — al confirmar aplica por los caminos
canónicos de la API (C2 altas, C3 eventos).

| Campo | Valor |
|---|---|
| Ciclo | **C1–C6 completados (2026-11-10/11) — código listo, sin despliegue** · C1 núcleo · C2 altas · C3 eventos · C4 consultas + historial · C5 Telegram (fail-closed, CONFIRMAR) · C6 panel editable + `DESPLIEGUE.md` (checklist §9, pendiente de ejecutar) |
| IA | Gateway OpenCode `http://100.125.94.21:4090` · `POST /api/experimental/generate/text` · Basic `opencode:<REF-SEC-26>` · modelo `claude-haiku-5-5`/`opencode-go` |
| Alcance C4+ | Consultas (caso por 70*/avería, FAT, resumen del día); historial (PG GGTO); Telegram |

## Endpoints (C1 + C2 + C3 + C4)

| Ruta | Descripción |
|---|---|
| `GET /health` | `{"status":"ok","gateway":"configurado\|no-configurado","modelo":"…","ggto_api":"…","telegram":"configurado\|no-configurado"}` |
| `GET /` | Panel de chat (ficha extraída **editable** antes de confirmar — C6; botón «Confirmar y crear caso» en ALTA_CASO y «Confirmar y aplicar evento» en EVENTO) |
| `POST /api/chat` | `{message, sesion_id?}` → `{intencion, ficha, confirmado:false, nota}` · **CONSULTA se resuelve en el mismo turno**: `consulta` (`CASO`/`FAT`/`RESUMEN_DIA`) + `respuesta` (lectura, sin escrituras; listados y resumen **sin PII**) · cada turno se registra en el historial de GGTO (best-effort, con `sesion_id`; defecto `PANEL-<día>`) · **fail-closed 503** sin gateway · 400 vacío · **429** (canon v2-A5) |
| `POST /telegram` | **C5 — webhook de Telegram (fail-closed):** header `X-Telegram-Bot-Api-Secret-Token` debe coincidir con `TELEGRAM_SECRET` (mismatch → **403**; sin config → **503**). Solo remitentes **activos** de la tabla `asistente_remitente` de GGTO (alta por SUPER). CONSULTA → respuesta directa; ALTA_CASO/EVENTO → **vista previa** que queda pendiente y se aplica solo con el mensaje `CONFIRMAR` (otro mensaje la descarta). Tarifa v2-A5 compartida con el panel. Sesiones como `TG-<chat_id>` con el p00 del remitente |
| `POST /api/confirmar` | **C2 — ALTA_CASO:** `{ficha}` → login JWT del usuario de servicio (cacheado con exp, renovación automática) → `POST /api/v1/casos` de GGTO. Faltantes → **422** con `faltantes` (RNF-AV-06); errores canónicos (409/422) se **propagan tal cual**. **C3 — EVENTO:** `validarFichaEvento` → `GET /api/v1/casos/buscar` (por `id_averia` o `id_pago`) → caso no encontrado → **404** sin escribir; COMENTARIO/ACTIVIDAD → `PATCH /casos/{id}` `{ultimo_comentario}`; CITA → `POST /casos/{id}/cita` `{fecha_hora, observacion}`; CAMBIO_ESTADO → `POST /casos/{id}/estado` `{estado_actual, motivo_estado}` (D-120). CONSULTA → **501** (C4) |
| `GET /api/usage` | Uso del día (canon v2-A5; Mongo `proj_ggto` si `MONGO_URL` está configurado) |

## Variables de entorno

| Variable | Defecto | Nota |
|---|---|---|
| `GATEWAY_URL` | `http://100.125.94.21:4090` | Gateway en la tailnet |
| `GATEWAY_AUTH_KEY` | — | **REF-SEC-26** (`opcode-gateway-api-key`, Secret Manager `plataforma-txbarlovento`); alternativamente docker secret `/run/secrets/gateway_auth` |
| `MODEL_ID` / `MODEL_PROVIDER` | `claude-haiku-5-5` / `opencode-go` | Cambio de modelo solo por env (manual §7); verificar con `opencode models \| grep claude` |
| `GGTO_API_URL` | URL de Cloud Run | API de GGTO |
| `GGTO_SERVICE_USER` / `GGTO_SERVICE_PASSWORD` | — | **C2:** p00 del usuario de servicio y su clave (docker secret `/run/secrets/ggto_service_pass` o env_file root-only); sin ellas, `confirmar` responde 503 fail-closed |
| `RATE_PER_MIN` / `DAILY_CHAT_LIMIT` | 30 / 500 | Canon v2-A5 (429) |
| `TELEGRAM_API_URL` / `TELEGRAM_SECRET` / `TELEGRAM_BOT_TOKEN` | api.telegram.org / — / — | **C5:** URL pública del webhook con `setWebhook` + `secret_token`; ambos secretos por docker secret (`/run/secrets/telegram_secret`, `/run/secrets/telegram_bot_token`) o env_file root-only |
| `MONGO_URL` / `MONGO_DB` | — / `proj_ggto` | Uso/cuota (canon v2-A5); el historial de sesión va a la PostgreSQL de GGTO (decisión del usuario) |
| `PORT` | 3000 | El compose lo publica en la IP Tailscale de vm-preview |

## Despliegue (vm-preview, patrón V2-A2 del runbook)

```bash
# alta (elige puerto libre del rango 3002–3019; 3002 = demo asistente-hotel):
sudo /usr/local/bin/alta_asistente.sh ggto <puerto>    # o adaptar este compose
# secreto del gateway (RS-2 — nunca en .env/repo):
gcloud secrets versions access latest --secret=opcode-gateway-api-key --project=plataforma-txbarlovento \
  | sudo tee /etc/secure/opcode-gateway-api-key >/dev/null && sudo chmod 0400 /etc/secure/opcode-gateway-api-key
# env_file root-only (sin secretos en claro en repo): /etc/secure/asistente-ggto.env
curl http://100.113.94.52:<puerto>/health              # → {"status":"ok","gateway":"configurado"}
```

## Pruebas

```bash
node --test asistente-ggto/test/core.test.js asistente-ggto/test/confirmar.test.js asistente-ggto/test/eventos.test.js asistente-ggto/test/consultas.test.js asistente-ggto/test/telegram.test.js
# 39 pruebas: C1/C2 (17) + C3 eventos (9) + C4 consultas/historial (7) + C5 telegram (6):
# fail-closed 503 sin secret, 403 secret inválido, remitente no autorizado sin gateway,
# consulta directa, vista previa + CONFIRMAR canónica, tarifa compartida v2-A5.
```

Del lado GGTO (ciclos C4/C5): `pytest app/tests/test_asistente.py` — permisos/recinto de sesiones
y remitentes (TÉCNICO 403, alta de remitente solo SUPER, chat_id único 409, desactivación) —
se necesitan `GGTO_TEST_DB_URL`.

Verificación en vivo C1 (2026-11-10): `/health` ok con gateway real; `POST /api/chat` con texto
ficticio devolvió `ALTA_CASO` con `id_pago/nombre/contacto/dirección/tipo_problema` correctos.
C2/C3 verificados por contrato (mock de la API de GGTO) — el humo real exige el usuario de servicio
creado en producción.

## Reglas duras

1. **Nada se escribe sin confirmación** (RNF-AV-02/03) — C1 no tiene ruta de escritura.
2. **Fail-closed**: sin credencial del gateway o gateway caído → 503, sin escritura (RNF-AV-01, patrón D-149).
3. **Secretos fuera del repo** (RS-2): docker secrets / env_file root-only; nada en `.env` versionado.
4. El texto de los abonados viaja al proveedor del gateway por la tailnet (RNF-AV-10, residual legal).
