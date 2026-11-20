# asistente-ggto — Asistente virtual de gestión por texto libre

App Node.js ligera (canon **v2-A5** de `RepoTecnico/Asistente/` + v2.2): entiende texto libre, extrae la
ficha estructurada con **OpenRouter** (LLM principal en GCP, con tools del MCP de GGTO) y muestra una
**vista previa**.
**No escribe nada en GGTO sin confirmación humana** — al confirmar aplica por los caminos
canónicos de la API (C2 altas, C3 eventos).

| Campo | Valor |
|---|---|
| Ciclo | **C1–C6 completados (2026-11-10/11) — código listo, sin despliegue** · C1 núcleo · C2 altas · C3 eventos · C4 consultas + historial · C5 Telegram (fail-closed, CONFIRMAR) · C6 panel editable + `DESPLIEGUE.md` (checklist §9, pendiente de ejecutar) · **v2.2 (2026-11-18): LLM principal migrado a OpenRouter con tools MCP** |
| IA | **OpenRouter** `POST {OPENROUTER_URL}/chat/completions` · `Authorization: Bearer <OPENROUTER_API_KEY>` (docker secret `/run/secrets/openrouter_api_key`; en producción `openrouter-key-2`, saldo 0 ⇒ modelo **`:free`**) · modelo `LLM_MODEL` (defecto `nvidia/nemotron-3.5-lightning`; alternativa pagada `deepseek/deepseek-v4.1-flash-1017`) · **el LLM opera el MCP de GGTO por tools** (`estado_central`, `consultar_caso` — solo lectura; las escrituras siguen por CONFIRMAR canónico). El Gateway OpenCode queda como legacy (`LLM_PROVIDER=opencode` + REF-SEC-26) |
| Alcance C4+ | Consultas (caso por 70*/avería, FAT, resumen del día); historial (PG GGTO); Telegram |

## Endpoints (C1 + C2 + C3 + C4)

| Ruta | Descripción |
|---|---|
| `GET /health` | `{"status":"ok","llm":"configurado\|no-configurado","modelo":"…","mcp":"configurado\|no-configurado","ggto_api":"…","telegram":"configurado\|no-configurado"}` |
| `GET /` | Panel de chat (ficha extraída **editable** antes de confirmar — C6; botón «Confirmar y crear caso» en ALTA_CASO y «Confirmar y aplicar evento» en EVENTO) |
| `POST /api/chat` | `{message, sesion_id?}` → `{intencion, ficha, confirmado:false, nota}` · **CONSULTA se resuelve en el mismo turno**: `consulta` (`CASO`/`FAT`/`RESUMEN_DIA`) + `respuesta` (lectura, sin escrituras; listados y resumen **sin PII**) · cada turno se registra en el historial de GGTO (best-effort, con `sesion_id`; defecto `PANEL-<día>`) · **fail-closed 503** sin clave de OpenRouter o sin clave MCP · 400 vacío · **429** (canon v2-A5) |
| `POST /telegram` | **C5 — webhook de Telegram (fail-closed):** header `X-Telegram-Bot-Api-Secret-Token` debe coincidir con `TELEGRAM_SECRET` (mismatch → **403**; sin config → **503**). Solo remitentes **activos** de la tabla `asistente_remitente` de GGTO (alta por SUPER). CONSULTA → respuesta directa; ALTA_CASO/EVENTO → **vista previa** que queda pendiente y se aplica solo con el mensaje `CONFIRMAR` (otro mensaje la descarta). Tarifa v2-A5 compartida con el panel. Sesiones como `TG-<chat_id>` con el p00 del remitente |
| `POST /api/confirmar` | **C2 — ALTA_CASO:** `{ficha}` → login JWT del usuario de servicio (cacheado con exp, renovación automática) → `POST /api/v1/casos` de GGTO. Faltantes → **422** con `faltantes` (RNF-AV-06); errores canónicos (409/422) se **propagan tal cual**. **C3 — EVENTO:** `validarFichaEvento` → `GET /api/v1/casos/buscar` (por `id_averia` o `id_pago`) → caso no encontrado → **404** sin escribir; COMENTARIO/ACTIVIDAD → `PATCH /casos/{id}` `{ultimo_comentario}`; CITA → `POST /casos/{id}/cita` `{fecha_hora, observacion}`; CAMBIO_ESTADO → `POST /casos/{id}/estado` `{estado_actual, motivo_estado}` (D-120). CONSULTA → **501** (C4) |
| `GET /api/usage` | Uso del día (canon v2-A5; Mongo `proj_ggto` si `MONGO_URL` está configurado) |

## Variables de entorno

| Variable | Defecto | Nota |
|---|---|---|
| `LLM_PROVIDER` | `openrouter` | Proveedor del LLM (`openrouter` o `opencode` legacy) |
| `OPENROUTER_URL` | `https://openrouter.ai/api/v1` | Base de la API de OpenRouter (sobrescribir para humo/proxy en GCP) |
| `OPENROUTER_API_KEY` | — | **Clave de OpenRouter** (docker secret `/run/secrets/openrouter_api_key` o env_file root-only); sin ella **503 fail-closed** |
| `LLM_MODEL` | `openrouter/free` | Auto-enrutador entre los modelos gratis de OpenRouter (resiliente ante upstream saturado); cambio solo por env. Alternativas: `inclusionai/ling-3.2-flash:free`, o con créditos `deepseek/deepseek-v4.1-flash-1017` |
| `LLM_TOOLS_ENABLED` | `true` | `true`: el LLM opera las tools del MCP de GGTO (solo lectura); `false`: chat sin tools |
| `GGTO_MCP_KEY` | — | **Clave `X-MCP-Key` del servidor MCP de GGTO** (docker secret `/run/secrets/ggto_mcp_key`); sin ella las tools responden **503 fail-closed** |
| `GGTO_MCP_URL` | `{GGTO_API_URL}/api/v1/mcp` | Endpoint JSON-RPC del servidor MCP de GGTO |
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
# secreto de OpenRouter (RS-2 — nunca en .env/repo):
gcloud secrets versions access latest --secret=openrouter-api-key --project=plataforma-txbarlovento \
  | sudo tee /etc/secure/openrouter_api_key >/dev/null && sudo chmod 0400 /etc/secure/openrouter_api_key
# clave del MCP de GGTO (mcp.api_key de la tabla configuracion → docker secret ggto_mcp_key)
# env_file root-only (sin secretos en claro en repo): /etc/secure/asistente-ggto.env
curl http://100.113.94.52:<puerto>/health              # → {"status":"ok","llm":"configurado","mcp":"configurado"}
```

## Pruebas

```bash
node --test asistente-ggto/test/core.test.js asistente-ggto/test/confirmar.test.js asistente-ggto/test/eventos.test.js asistente-ggto/test/consultas.test.js asistente-ggto/test/telegram.test.js
# 41 pruebas: C1/C2 (19, incluido el bucle OpenRouter→MCP y el fail-closed de OpenRouter y del MCP)
# + C3 eventos (9) + C4 consultas/historial (7) + C5 telegram (6):
# fail-closed 503 sin API key de OpenRouter ni clave MCP, 403 secret inválido,
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
2. **Fail-closed**: sin clave de OpenRouter o sin clave del MCP (o proveedor caído) → 503, sin escritura (RNF-AV-01, patrón D-149).
3. **Secretos fuera del repo** (RS-2): docker secrets / env_file root-only; nada en `.env` versionado.
4. El texto de los abonados viaja a OpenRouter (proveedor LLM principal) y los datos de casos operados por tools salen y vuelven del MCP de GGTO por HTTPS (RNF-AV-10, residual legal: los proveedores de OpenRouter deben cubrirse por DPA).
