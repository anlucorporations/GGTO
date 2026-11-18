// test/core.test.js — pruebas del núcleo C1 de asistente-ggto (node --test)
// Sin red: OpenRouter se simula con un HTTP local; también se prueba el fail-closed y la tarifa.
const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { PROMPT_GGTO, crearEstado, tarifaOk, parseRespuestaIA, construirPrompt, procesarMensaje, crearServidor, llamarLLM, mcpLlamar } = require("../server.js")

const CFG_OK = { OPENROUTER_URL: "http://mock", OPENROUTER_API_KEY: "clave-prueba", LLM_MODEL: "openai/gpt-4o-mini",
  LLM_TOOLS_ENABLED: true, GGTO_MCP_KEY: "mcp-prueba", GGTO_MCP_URL: "http://mcp", GGTO_API_URL: "https://x",
  PROJECT: "ggto", PROMPT: PROMPT_GGTO, RATE_PER_MIN: 30, DAILY_LIMIT: 500, MONGO_URL: "", MONGO_DB: "proj_ggto", TIMEOUT_MS: 5000 }
const JSON_BUENO = '{"intencion":"ALTA_CASO","tipo_reporte":"REPARACION","id_pago":"7012345678","nombre_cliente":"Pedro Ramirez","contacto_cliente":"04141234567","direccion":"Av los guayabos casa 12","tipo_problema":"Sin tono","nota":null}'

function peticion(puerto, ruta, metodo, cuerpo) {
  return new Promise((resolver, rechazar) => {
    const req = http.request({ host: "127.0.0.1", port: puerto, path: ruta, method: metodo,
      headers: { "Content-Type": "application/json" } }, (res) => {
      let d = ""; res.on("data", (c) => (d += c))
      res.on("end", () => resolver({ status: res.statusCode, body: d ? JSON.parse(d) : {} }))
    })
    req.on("error", rechazar)
    if (cuerpo) req.write(JSON.stringify(cuerpo))
    req.end()
  })
}
// OpenRouter simulado: /chat/completions devuelve {choices:[{message:{content}}]}
function mockGateway(respuesta, codigo = 200) {
  const srv = http.createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c))
    req.on("end", () => {
      res.writeHead(codigo, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: respuesta } }] }))
    })
  })
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, url: `http://127.0.0.1:${srv.address().port}` })))
}
function servidorEfimero(cfg, deps) {
  const estado = crearEstado(cfg)
  const srv = crearServidor(estado, deps)
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, estado, url: `http://127.0.0.1:${srv.address().port}` })))
}

test("parseRespuestaIA: JSON limpio, con vallas y con texto alrededor; inválido → null", () => {
  assert.equal(parseRespuestaIA(JSON_BUENO).intencion, "ALTA_CASO")
  assert.equal(parseRespuestaIA("```json\n" + JSON_BUENO + "\n```").id_pago, "7012345678")
  assert.equal(parseRespuestaIA("Claro, aquí va:\n" + JSON_BUENO + "\n¿algo más?").nombre_cliente, "Pedro Ramirez")
  assert.equal(parseRespuestaIA("lo siento, no pude"), null)
  assert.equal(parseRespuestaIA(""), null)
  assert.equal(parseRespuestaIA('{"intencion": 42}'), null)
})

test("construirPrompt incluye el texto del usuario y la corrección tras fallo", () => {
  const p1 = construirPrompt(PROMPT_GGTO, "alta de prueba", false)
  assert.ok(p1.includes("alta de prueba") && p1.includes("TEXTO DEL USUARIO"))
  const p2 = construirPrompt(PROMPT_GGTO, "alta de prueba", true)
  assert.ok(p2.includes("NO fue un JSON válido"))
})

test("tarifaOk respeta RATE_PER_MIN y DAILY_LIMIT (canon v2-A5)", () => {
  const estado = crearEstado({ ...CFG_OK, RATE_PER_MIN: 2, DAILY_LIMIT: 3 })
  const t = Date.now()
  assert.equal(tarifaOk(estado, t).ok, true)
  assert.equal(tarifaOk(estado, t).ok, true)
  assert.equal(tarifaOk(estado, t).motivo, "rate")       // 3.ª en el mismo minuto
  const estado2 = crearEstado({ ...CFG_OK, RATE_PER_MIN: 100, DAILY_LIMIT: 3 })
  const t0 = claveFija()
  assert.equal(tarifaOk(estado2, t0).ok, true)
  assert.equal(tarifaOk(estado2, t0).ok, true)
  assert.equal(tarifaOk(estado2, t0).ok, true)
  assert.equal(tarifaOk(estado2, t0).motivo, "dia")      // tope diario
})
function claveFija() { const d = new Date(0); return d.getTime() }

test("procesarMensaje: ficha extraída, 200 y NADA confirmado", async () => {
  const estado = crearEstado(CFG_OK)
  const r = await procesarMensaje(estado, { gateway: async () => JSON_BUENO, parse: parseRespuestaIA }, "alta de prueba")
  assert.equal(r.status, 200)
  assert.equal(r.body.intencion, "ALTA_CASO")
  assert.equal(r.body.ficha.id_pago, "7012345678")
  assert.equal(r.body.confirmado, false)
})

test("procesarMensaje: respuesta sin JSON → reintento y luego 502", async () => {
  const estado = crearEstado(CFG_OK)
  let llamadas = 0
  const r = await procesarMensaje(estado, { gateway: async () => { llamadas += 1; return "no soy json" }, parse: parseRespuestaIA }, "x")
  assert.equal(llamadas, 2)          // hubo reintento único
  assert.equal(r.status, 502)
})

test("procesarMensaje: gateway caído → 503 fail-closed", async () => {
  const estado = crearEstado(CFG_OK)
  const r = await procesarMensaje(estado, { gateway: async () => { const e = new Error("boom"); e.codigo = 503; throw e }, parse: parseRespuestaIA }, "x")
  assert.equal(r.status, 503)
  assert.ok(r.body.error.includes("no disponible"))
})

test("HTTP: /health informa gateway configurado; /api/chat end-to-end con mock", async () => {
  const mock = await mockGateway(JSON_BUENO)
  const { srv, url } = await servidorEfimero({ ...CFG_OK, OPENROUTER_URL: mock.url }, { fetch: (u, o) => fetch(u, o), abortSignal: (ms) => AbortSignal.timeout(ms), parse: parseRespuestaIA, gateway: llamarLLM, indexHtml: "<html></html>", procesar: procesarMensaje })
  try {
    const h = await peticion(url.split(":")[2], "/health", "GET")
    assert.equal(h.status, 200); assert.equal(h.body.status, "ok"); assert.equal(h.body.llm, "configurado")
    const c = await peticion(url.split(":")[2], "/api/chat", "POST", { message: "alta de prueba" })
    assert.equal(c.status, 200); assert.equal(c.body.ficha.intencion, "ALTA_CASO")
    const conf = await peticion(url.split(":")[2], "/api/confirmar", "POST", {})
    assert.equal(conf.status, 501)   // C2 lo implementa
  } finally { srv.close(); mock.srv.close() }
})

test("HTTP: sin credencial del gateway → /api/chat responde 503 y /health avisa", async () => {
  const { srv, url } = await servidorEfimero({ ...CFG_OK, OPENROUTER_API_KEY: "" }, { fetch: (u, o) => fetch(u, o), abortSignal: (ms) => AbortSignal.timeout(ms), parse: parseRespuestaIA, gateway: llamarLLM, indexHtml: "<html></html>", procesar: procesarMensaje })
  try {
    const h = await peticion(url.split(":")[2], "/health", "GET")
    assert.equal(h.body.llm, "no-configurado")
    const c = await peticion(url.split(":")[2], "/api/chat", "POST", { message: "hola" })
    assert.equal(c.status, 503)
    assert.ok(c.body.error.includes("no disponible"))
  } finally { srv.close() }
})

test("HTTP: mensaje vacío → 400; límite diario activo → 429", async () => {
  const { srv, url } = await servidorEfimero({ ...CFG_OK, DAILY_LIMIT: 1 }, { fetch: (u, o) => fetch(u, o), abortSignal: (ms) => AbortSignal.timeout(ms), parse: parseRespuestaIA, gateway: llamarLLM, indexHtml: "<html></html>", procesar: procesarMensaje })
  try {
    const vacio = await peticion(url.split(":")[2], "/api/chat", "POST", {})
    assert.equal(vacio.status, 400)
    const primero = await peticion(url.split(":")[2], "/api/chat", "POST", { message: "a" })
    // sin credencial → 503 pero el consumo ya corrió; el 2.º cae por tope diario
    assert.ok([429, 503].includes(primero.status))
    const segundo = await peticion(url.split(":")[2], "/api/chat", "POST", { message: "b" })
    assert.equal(segundo.status, 429)
    assert.equal(segundo.body.motivo, "dia")
  } finally { srv.close() }
})

test("llamarLLM: bucle tools — OpenRouter pide consultar_caso → MCP responde → texto final", async () => {
  // Mock de OpenRouter: 1.a respuesta pide el tool; tras el resultado del tool, responde el JSON
  const JSON_FINAL = '{"intencion":"CONSULTA","consulta":"estado del caso"}'
  const llamadas = []
  const or = http.createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c))
    req.on("end", () => {
      llamadas.push(JSON.parse(d))
      const cuerpo = JSON.parse(d)
      const yaHayTool = (cuerpo.messages || []).some((m) => m.role === "tool")
      res.writeHead(200, { "Content-Type": "application/json" })
      if (yaHayTool)
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON_FINAL } }] }))
      else
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", tool_calls: [
          { id: "tc_1", type: "function", function: { name: "consultar_caso", arguments: '{"telefono":"7012345678"}' } } ] } }] }))
    })
  })
  // Mock del servidor MCP de GGTO (JSON-RPC tools/call)
  const mcp = http.createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c))
    req.on("end", () => {
      llamadas.push({ mcp: JSON.parse(d) })
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 1,
        result: { datos: { encontrado: true, id_averia: "REF-REP-000991", estado: "EN_GESTION" } } }))
    })
  })
  const arrancar = (srv) => new Promise((r) => srv.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${srv.address().port}`)))
  const orUrl = await arrancar(or), mcpUrl = await arrancar(mcp)
  try {
    const deps = { OPENROUTER_URL: orUrl, OPENROUTER_API_KEY: "k", LLM_MODEL: "openai/gpt-4o-mini",
      LLM_TOOLS_ENABLED: true, GGTO_MCP_KEY: "clave-mcp", GGTO_MCP_URL: mcpUrl, TIMEOUT_MS: 5000,
      fetch: (u, o) => fetch(u, o), abortSignal: (ms) => AbortSignal.timeout(ms) }
    const texto = await llamarLLM(deps, [{ role: "user", content: "en qué va el caso 7012345678" }])
    assert.equal(parseRespuestaIA(texto).intencion, "CONSULTA")
    const rpcMcp = llamadas.find((l) => l.mcp)?.mcp
    assert.ok(rpcMcp, "debe haber llamado al MCP")
    assert.equal(rpcMcp.method, "tools/call")
    assert.equal(rpcMcp.params.name, "consultar_caso")
    assert.equal(rpcMcp.params.arguments.telefono, "7012345678")
    assert.ok(llamadas.length >= 2, "OpenRouter debe llamarse otra vez tras el tool")
  } finally { or.close(); mcp.close() }
})

test("llamarLLM fail-closed: sin OPENROUTER_API_KEY → 503; MCP sin clave → 503", async () => {
  await assert.rejects(
    llamarLLM({ OPENROUTER_API_KEY: "", OPENROUTER_URL: "http://x", LLM_MODEL: "m", LLM_TOOLS_ENABLED: false,
      TIMEOUT_MS: 1000, fetch, abortSignal: (ms) => AbortSignal.timeout(ms) }, [{ role: "user", content: "x" }]),
    (e) => e.codigo === 503)
  await assert.rejects(
    mcpLlamar({ GGTO_MCP_KEY: "", GGTO_MCP_URL: "http://x", TIMEOUT_MS: 1000, fetch, abortSignal: (ms) => AbortSignal.timeout(ms) }, "estado_central", {}),
    (e) => e.codigo === 503)
})
