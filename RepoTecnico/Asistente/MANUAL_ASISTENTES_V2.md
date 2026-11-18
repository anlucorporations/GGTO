# MANUAL MAESTRO — Integración de Asistentes Virtuales con el Gateway LLM (OpenCode) + MCP
**Versión:** 1.0 · 2026-11-10 · **Alcance:** TODOS los proyectos que quieran asistente con IA (web2 / web2.5 / web3, hotel, etc.)
**Master Gate:** V2-A0 cerrado (gateway activo con `opencode-go/claude-haiku-5-5`) — el resto son fases opcionales por proyecto.

---

## 1. Qué obtiene cada proyecto (value proposition)

Cada proyecto crea **su propio asistente virtual** usando esta plantilla:
- ✅ Chat con LLM (Claude Haiku 5.5 vía OpenCode Go — decisión del dueño) via **Gateway interno** en la tailnet.
- ✅ Memoria propia en MongoDB global (BD exclusiva `proj_<nombre>`), incluida *historia* y *RAG prefabricado* por proyecto.
- ✅ Deploy automático en **Coolify** (vm-preview) vía API o plantilla docker-compose.
- ✅ Uso de **MCP servers personalizados**: cada proyecto registra los tools que su asistente usa (deploy, RPC blockchain, DB query, etc.).
- ✅ Seguridad RS-2: todo secreto en Secret Manager; NADA en `.env`, NADA en repos.

## 2. Arquitectura de referencia (v2, multi-proyecto)

```
┌─────────────────┐     tailscale        ┌────────────────────────┐
│  navegador       │  ─────────────────►  │ asistente-<proj> (app) │  ← node.js lightweight
└─────────────────┘                      │  * GET  /               │     (docker en vm-preview,
      │                                   │  * POST /api/chat       │      Coolify o compose)
      │          HTTP (Tailnet-only)      │  * POST /api/mcp_tools  │
      │                                   └────────────────────────┘
      │  /api/chat llama:
      │    ┌────────────────────────────────────────────────┐
      │    │ GATEWAY LLM OpenCode (vm-dsh-dev : 4090)       │  ← el único lugar que toca los proveedores
      │    │ POST /api/experimental/generate/text           │
      │    │ Authorization: Basic base64("opencode:<pw>")   │
      │    └────────────────────────────────────────────────┘
      │                       │
      │                       └► opencode-go/claude-haiku-5-5  ✅ modelo oficial del dueño
      │
      └─ MongoDB (vm-databases 100.89.28.1:27017) = memoria por proyecto
                         + (opcional) MCP HTTP server que exponga los *tools* del proyecto
```

### 2.1 Resumen de componentes & conexiones

| Componente | Servicio/Dirección | Credencial | Cómo se consume |
|---|---|---|---|
| **Gateway OpenCode LLM** | `http://100.125.94.21:4090` | **REF-SEC-26** `opcode-gateway-api-key` (pw del gateway) | `POST /api/experimental/generate/text` con `Authorization: Basic base64("opencode:"+pw)` |
| **MongoDB global** | `mongodb://txbarlovento:PImf.04%2A@100.89.28.1:27017/admin` | usuario `txbarlovento` (REF-SEC creds file) | lib `mongodb` → DB `proj_< nombre >` y colecciones `assistant_sessions` / `assistant_docs` |
| **MCP server personalizado** | por proyecto (e.g. `http://proj-mcp.<vm>.<puerto>` o stdio) | definidas por el proyecto (tokens en Secret Manager `proj_<nombre>-mcp-*`) | definidas en la plantilla de asistente (ver §5) |
| **Coolify API** (deploy) | `http://100.113.94.52:8000/api/v1` | REF-SEC-24 `coolify-api-token` (regenerable) | para alta de la app del asistente (ver §7) |
| **OpenCode Go suscripción** | REF-SEC-27 `opencode-go-key` (solo gateway, no en apps) | opcional para límites y presupuesto | ya conectado en el gateway |

## 3. Plantilla de código — `asistente-base` (Node.js, sin deps nativas, solo `express` + `mongodb`)

### 3.1 docker-compose.yml (plantilla universal, un archivo por proyecto)

```yaml
# /srv/compose/proj_<nombre>-asistente/docker-compose.yml
services:
  asistente:
    image: proj_<nombre>-asistente:latest
    build: .
    container_name: asistente-<nombre>
    restart: unless-stopped
    environment:
      - GATEWAY_URL=http://100.125.94.21:4090
      - GATEWAY_USER=opencode
      - GATEWAY_AUTH=${GATEWAY_AUTH}              # ← se inyecta por Secret Manager
      - MONGO_URL=mongodb://txbarlovento:PImf.04%2A@100.89.28.1:27017/?authSource=admin
      - MONGO_DB=proj_<nombre>
      - MODEL_ID=claude-haiku-5-5
      - MODEL_PROVIDER=opencode-go
      - PROJECT_NAME=<nombre>
    env_file:
      - /etc/secure/asistente-<nombre>.env        # ← root-only, generado por script de alta (no repo)
    ports:
      - "100.113.94.52:3000:3000"                 # IP Tailscale de vm-preview, no público
    networks:
      - asistente-net
    deploy:
      resources:
        limits: { cpus: '1', memory: 1073741824 }
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
networks:
  asistente-net:
    external: true
secrets:
  gateway_auth:
    file: /etc/secure/opcode-gateway-api-key      # ← root-only (solo lectura para container)
```

> ⚠ Corrección importante: uso **docker `secrets`** ( Evan el/EE `secrets` con mount `/run/secrets/gateway_auth`) — el contenido del gateway token no baja a `.env`, queda en disco root-only.

### 3.2 Dockerfile del asistente (inline, sin build-context)

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN echo '<B64_SERVER_JS>' | base64 -d > server.js
RUN echo '<B64_INDEX_HTML>' | base64 -d > index.html
RUN npm install --no-audit --no-fund mongodb@6 2>&1 | tail -1
EXPOSE 3000
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
```

El patrón `RUN echo | base64 -d > archivo` es el **patrón estandarizado** (v2, Coolify no da build-context) — igual que se usó en las fases piloto. La clave y los tokens **nunca** se embedean acá (docker secrets/env roto, ver arriba).

### 3.3 server.js — asistente base (lazy-load del gateway + Mongo + MCP opcional)

```js
// server.js (asistente-base, patrón v2, Node 22, Native fetch, sin express)
const http  = require("http")
const { MongoClient } = require("mongodb")

// ---- CONFIG leída en env (rápido y clásico) ----
const GATEWAY_URL   = process.env.GATEWAY_URL || "http://100.125.94.21:4090"
const GATEWAY_AUTH  = process.env.GATEWAY_AUTH_KEY            // <- Basic base64 ("opencode:<pw>")
const MONGO_URL     = process.env.MONGO_URL
const MONGO_DB      = process.env.MONGO_DB || "proj_<nombre>"
const MODEL         = {
  id:       process.env.MODEL_ID || "claude-haiku-5-5",
  providerID: process.env.MODEL_PROVIDER || "opencode-go",
}
const PROJECT       = process.env.PROJECT_NAME || "proyecto"
// MCP personalizado (opcional, definido en el portal de Coolify por proyecto)
const MCP_URL       = process.env.MCP_URL     // e.g. http://100.85.239.67:4090/sse (opcional)
const MCP_TOKEN     = process.env.MCP_TOKEN   // (REF-SEC por proyecto)

// ---- Inicializar MongoDB (conexión lazy) ----
let db = null
async function mongo() {
  if (db) return db
  const c = await MongoClient.connect(MONGO_URL, { serverSelectionTimeoutMS: 8000 })
  db = c.db(MONGO_DB)
  return db
}

async function mcpCall(tool, payload) {
  if (!MCP_URL || !MCP_TOKEN) return null
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MCP_TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: tool, arguments: payload ?? {} }}),
  })
  if (!r.ok) return null
  const j = await r.json()
  return j?.result
}

async function callGateway(messages) {
  //  — modelo con historial compactado: enviamos solo el último mensaje + systemPrompt; para conversación continua usar el endpoint chat (v2)
  //   OPCIONAL: si quieres tools via MCP, primero pre-dependencia http del gateway (/api/experimental/…), "work-calls" create
  const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
  const r = await fetch(`${GATEWAY_URL}/api/experimental/generate/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${GATEWAY_AUTH_KEY}` },
    body: JSON.stringify({ prompt, model: MODEL }),
  })
  const j = await r.json()
  if (j?.data?.text) return j.data.text
  throw new Error(JSON.stringify(j).slice(0, 200))
}

// ---- Servidor HTTP (chat + REST minimal) ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost")
  if (url.pathname === "/health") { res.writeHead(200); res.end(JSON.stringify({ status: "ok", app: PROJECT })); return }
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(INDEX_HTML); return
  }
  if (req.method === "POST" && url.pathname === "/api/chat") {
    try {
      const chunks = []
      req.on("data", (c) => chunks.push(c))
      req.on("end", async () => {
        const { message, sessionID: userSession } = JSON.parse(Buffer.concat(chunks).toString() || "{}")
        const db = await mongo()
        const col = db.collection("assistant_sessions")
        const sid = userSession || `ses_${Date.now()}`
        const hist = await col.findOne({ sessionID: sid })
          ?? { sessionID: sid, project: PROJECT, messages: [] }
        hist.messages.push({ role: "user", content: message, time: new Date() })
        const sys = `Eres el asistente virtual del proyecto ${PROJECT}. Responde corto y en español.`
        const msgs = [{ role: "system", content: sys }, ...hist.messages.slice(-10)]
        let reply
        try {
          reply = await callGateway(msgs)
        } catch (e) {
          reply = `⚠ error del gateway: ${e.message}`
        }
        hist.messages.push({ role: "assistant", content: reply, time: new Date() })
        await col.replaceOne({ sessionID: sid }, hist, { upsert: true })
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ sessionID: sid, reply }))
      })
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })) } finally {}
    return
  }
  if (req.method === "POST" && url.pathname === "/api/chat/mcp") {
    // conversación con contenido única (v2) - llama a tu MCP server personalizado (opcional ejecutar el tool con nombre)
    const body = JSON.parse((await streamToString(req)) || "{}")
    const db = await mongo()
    const r = await mcpCall(body.tool, body.args)
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(r ?? { ok: false }))
    return
  }
  res.writeHead(404); res.end()
})

function streamToString(req) {
  return new Promise((resolve) => {
    const ch = []; req.on("data", (c)=>ch.push(c))
    req.on("end", ()=>resolve(Buffer.concat(ch).toString()))
  })
}

server.listen(3000, () => console.log(`asistente-${PROJECT} escuchando en :3000`))
```

*(el INDEX_HTML junto con el `B64_SERVER_JS` y `B64_INDEX_HTML` se suben al Dockerfile vía `base64` — ver §3.2)*

### 3.4 url del gateway + token de acceso, detrás de rs-2

```bash
# alta del proyecto (1 vez):
gcloud secrets versions access latest --secret=opcode-gateway-api-key --project=plataforma-txbarlovento \
  | sudo tee /etc/secure/opcode-gateway-api-key >/dev/null    # → docker secret file (solo root)
```

## 4. Workflow recomendado para **alta de asistente** (2 opciones)

### Opción A — Deploy manual con docker-compose (recomendado para v2-A1, sin Coolify)

```bash
# en vm-modal-preview (100.113.94.52), via SSH (Génesis de alta de proyecto ya ensayada)
cd /srv/asistente-<nombre>
cat docker-compose.yml           # usar plantilla de arriba
docker compose up -d --build
docker compose ps —  circulares → verificar UP
curl http://<ip-preview>:3001/health       # → {"status":"ok"}
```
*Deja.documento* registro en runbook (comando y URL final).

### Opción B — Deploy vía Coolify API (para alta repetibles por proyecto = fase v2-A2 en adelante)

```powershell
# directo en Coolify en vivo (usando tu REF-SEC-24 coolify-api-token):
$Body = @{ project_uuid="<UUID hier>"; server_uuid="<UUID server>"; environment_name="production"; dockerfile=$dfileb64 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://100.113.94.52:8000/api/v1/applications/dockerfile" -Headers @{Authorization="Bearer <tok>"} -Body $Body
```

## 5. Integración MCP por proyecto (opcional)

Cada proyecto define cuáles **tools** quiere exponer a su asistente:
- **web3 (blockchain)**: `solana-start`, RPC read-only para “status de la red”, anvil fork read, etc.
- **B2B (web2)**: query a la BD del proyecto en Mongo (read-only), lists de usuarios/coll.
- **Hoteles (v2-A4+)**: tools específicas.

#### Formato del MCP server base (true generic wrapper)
```bash
# src/mcp-server.ts (Node 22/20, stdio)
// služby: on tool_1 "query_mongo" (read-only queries), tool_2 "status_rpc", ...
// defined and register tools (read-only esféric; NEVER auto-invocar risk):
// - "query_mongo{ db, collection, filter }"
// - "blockchain_status{ rpc, id_hex }"
// Otras herramientas por proyecto (Reglas: read-only por default; las destructivas se restringen/difinidas en permissions)
```
Config en asistente-service (v2-A1 basic) usa los MCP **tools** entry de un servidor **MCP stdio** (MCP_SETUP) que corre en modo _tailnet-only_, para corresponder a la definición de v2-A0 (solo hijos de un directorio cl/grupo, y no llegs vía servidor global _global_, para permitvisor el TEM por projectos). Al production el equipo de plataforma puede elegir 'readonly' o 'full write' antes de desplegar.

## 6. BigScope: Seguridad y aislamiento por proyecto

| Aspecto | Restriction |
|---|---|
| Auth en el gateway | `Authorization: Basic base64("opencode:" + REF-SEC-26)` — el token `opencode-go-key` solo pasa a quemar por gateway (SECRET, no to apps) |
| DB lock (var sí por proyecto) | cada asistente solo usa la DB de su proyecto (`MongoDB project_<nombre>`), nunca cross-db |
| Secrets | docker secrets + env_file root-only (nada en `.env` en repos) |
| Recordatorio cabin | Revision RS-2 en cadacaas GATE (osem; con cada env vars sin secreturas en plaintext) |
| CORS | — `Origin: <proyecto>` por proyecto **NO público** (a tailnet); si se expone, usar Cloudflare Turnstile (RS-1.5) |
| Coolify/lbs | resource limit 1 CPU/1GB (docker-compose limits/resources para v2-A1) |

## 7. Uso dedicado para蒿 los Te: Cómo requiere cambiar de modelo

Al querer cambiar de modelo/provider desde la app asistente, mantiene las mismas propiedades (per §3.3, se lee todo de env por asistente):
```bash
# en el panel Coolify: cambiar la env del asistente `MODEL_ID=claude-haiku-5-5` y/o `MODEL_PROVIDER=opencode-go`:
# p. ej. change a gpt-5-mini (openai):
MODEL_ID=gpt-5-mini
MODEL_PROVIDER=openai
# ** si vas a añadir a otro provider en el gateway CLI debe estar en auth.json de root y disponible en el list /api/model (verificar con openapi)
```

## 8. RUNBOOK: Pasos exactos paso a paso (guía para integración)
### Alta de proyecto tal a v2 template (duplicable cada proyecto)
1. (md) Crear el repos proyecto local: `mkdir -p /srv/asistente-<nombre> && cd _` (descargar la plantilla de este manual).
2. Editar el `docker-compose.yml` para él: `proj_<nombre>`, dominio Coolify si es público, Molton endpoint (`MONGO_DB`), ROLE (a modo de esempio), catálogos correctos.
3. Crear secret para asistente (RS-2): `gcloud secrets create proj_<nombre>-<pass clave>...` (debes elegir al monstrua, no según debas).
4. Registrar el asistente en Coolify API (de type docker-compose); docker-compose puede usar un **volume de secrets** para asistente ya estrellas ( pero NO hay per-proyecto módulo en GS).

## 9. Checklist de integración — ejecutan **obligatorínea** por asistente

| # | Paso |
|---|---|
| 1 | DB Mongo creada y namespace único  |
| 2 | `GATEWAY_AUTH_KEY` docker-secret root-only montado (no en `.env`) |
| 3 | `MONGO_URL` resolvable desde el contenedor (por tailnet) |
| 4 | `MODEL_ID/MODEL_PROVIDER` correcto según tu proyecto |
| 5 | `/health` responde 200 |
| 6 | Chat básico **funciona** con tu texto de prueba y el historial se guarda en Mongo |
| 7 | docker-compose limits configurado, priority CPU/RAM |
| 8 | URL registrada al dashboard del proyecto (`RUNBOOK §3 ejemplo`) |
| 9 | No secrets/spaces parchared por BOT en fuentes (RS-2 ✅) |

---
**Este documento es la fuente de verdad para integración per-proyecto.**
- Para detalles de infraestructura del gateway: `04_runbook.md` (fase V2-A0), `02_arquitectura.md` (diagrama global, `MANUAL_OPERACION_UNICO.md` (doctor operativo), `06_PLAN_V2_OPENCODE_ASISTENTES.md` (roadmap de fases A0–A6).
