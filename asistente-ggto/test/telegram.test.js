// test/telegram.test.js — ciclo C5: webhook fail-closed + remitentes + vista previa/confirmar
const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { crearEstado, obtenerToken, confirmarAccion, mapearAlta, buscarCaso, aplicarEvento,
  resolverConsulta, registrarTurno, procesarTelegram, buscarRemitente, responderTelegram,
  procesarMensaje } = require("../server.js")

const CASO = { id_caso: 991, id_averia: "REF-REP-000991", estado_actual: "EN_GESTION", tipo_caso: "AVERIA",
  sector_nombre: "S1", olt: "OLT1", slot: "1", puerto: "4", fat: "FAT-12",
  fecha_reporte: "2026-11-11T08:00:00Z", nombre_cliente: "Pedro Ramirez",
  direccion: "Av los guayabos casa 12", contacto_cliente: "04141234567" }
const REMITENTE = { id_remitente: 7, id_central: 1, canal: "TELEGRAM", chat_id: "555000111",
  p00: "GGTOAST001", nombre: "SPV Telegram", activo: true }

function servidorManejador(manejador) {
  const srv = http.createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c))
    req.on("end", () => manejador({ req, res, cuerpo: JSON.parse(d || "{}") }))
  })
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, url: `http://127.0.0.1:${srv.address().port}` })))
}
async function mockTelegram() {
  const mensajes = []
  const w = await servidorManejador(({ res, cuerpo }) => {
    mensajes.push(cuerpo)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }))
  })
  return { ...w, mensajes: () => mensajes }
}
async function mockGGTO(opts = {}) {
  const llamadas = []
  const w = await servidorManejador(({ req, res, cuerpo }) => {
    llamadas.push({ url: req.url, method: req.method, cuerpo, auth: req.headers.authorization })
    const ok = (b, s = 200) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)) }
    if (req.url.startsWith("/api/v1/auth/login"))
      return ok({ access_token: `tok.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.x`, expires_in: 3600 })
    if (req.url.startsWith("/api/v1/asistente/remitentes"))
      return ok(opts.remitente === false ? [] : [REMITENTE])
    if (req.url.startsWith("/api/v1/casos/buscar")) return ok(opts.buscar ?? [CASO])
    if (req.url.startsWith("/api/v1/monitoreo/diario")) return ok({ pendientes: 12, cerrados: 5 })
    if (req.url.startsWith("/api/v1/asistente/sesiones")) return ok({ id_turno: 1 }, 201)
    if (/\/casos\/\d+\/(cita|estado)$/.test(req.url)) return ok({ ...CASO, estado_actual: "CITADO" })
    if (/\/api\/v1\/casos\/\d+$/.test(req.url)) return ok(CASO)
    if (req.url === "/api/v1/casos") return ok({ id_caso: 991, id_averia: "REF-REP-000991", estado_actual: "NUEVO" }, 201)
    res.writeHead(404); res.end("{}")
  })
  return { ...w, llamadas: () => llamadas }
}
async function mockGateway(texto) {
  const w = await servidorManejador(({ res }) => {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ data: { text: texto } }))
  })
  return w
}
const deps = {
  fetch: (u, o) => fetch(u, o), abortSignal: (ms) => AbortSignal.timeout(ms), TIMEOUT_MS: 5000,
  obtenerToken, confirmar: confirmarAccion, mapear: mapearAlta, buscarCaso, aplicarEvento,
  resolverConsulta, registrarTurno, procesarTelegram, buscarRemitente, responderTelegram,
  procesar: procesarMensaje,
  gateway: async (c) => { const r = await fetch(`${c.GATEWAY_URL}/gen`, { method: "POST" }); return (await r.json()).data.text },
  parse: (t) => { try { return JSON.parse(t) } catch { return null } },
}
const cfgBase = (gg, tg, gw, extra = {}) => ({ GGTO_API_URL: gg.url, GGTO_USER: "GGTOAST001", GGTO_PASS: "clave",
  TIMEOUT_MS: 5000, RATE_PER_MIN: 30, DAILY_LIMIT: 500, MONGO_URL: "", PROMPT: "P",
  GATEWAY_URL: gw.url, GATEWAY_AUTH: "k", MODEL: { id: "m", providerID: "p" }, PROJECT: "ggto",
  TELEGRAM_API_URL: tg.url, TELEGRAM_SECRET: "secreto-wb", TELEGRAM_BOT_TOKEN: "BOT-TOKEN", ...extra })
const UPDATE = (texto, chatId = "555000111") => ({ message: { text: texto, chat: { id: chatId } } })
const CABECERA = { "x-telegram-bot-api-secret-token": "secreto-wb" }

test("fail-closed: sin secret/bot configurados → 503 y NINGUNA llamada", async (t) => {
  const tg = await mockTelegram()
  const gg = await mockGGTO()
  t.after(() => { tg.srv.close(); gg.srv.close() })
  const estado = crearEstado(cfgBase(gg, tg, { url: "http://x" }, { TELEGRAM_SECRET: "", TELEGRAM_BOT_TOKEN: "" }))
  const r = await procesarTelegram(estado, deps, UPDATE("hola"), CABECERA["x-telegram-bot-api-secret-token"])
  assert.equal(r.status, 503)
  assert.equal(tg.mensajes().length, 0)   // no intenta responder el bot
})

test("secret_token incorrecto → 403, sin gateway ni respuestas del bot", async (t) => {
  const tg = await mockTelegram()
  const gg = await mockGGTO()
  const gw = await mockGateway('{"intencion":"DESCONOCIDO"}')
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfgBase(gg, tg, gw))
  const r = await procesarTelegram(estado, deps, UPDATE("hola"), "otro-secreto")
  assert.equal(r.status, 403)
  assert.equal(tg.mensajes().length, 0)
  assert.equal(gg.llamadas().filter((l) => !l.url.includes("login")).length, 0)
})

test("remitente no autorizado → 200 atendido:false, SIN llamar al gateway (fail-closed)", async (t) => {
  const tg = await mockTelegram()
  const gg = await mockGGTO({ remitente: false })
  const gw = await mockGateway('{"intencion":"DESCONOCIDO"}')
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfgBase(gg, tg, gw))
  let gatewayLlamado = false
  const d = { ...deps, gateway: async () => { gatewayLlamado = true; return '{"intencion":"DESCONOCIDO"}' } }
  const r = await procesarTelegram(estado, d, UPDATE("hola"), CABECERA["x-telegram-bot-api-secret-token"])
  assert.equal(r.status, 200)
  assert.equal(r.body.atendido, false)
  assert.equal(r.body.motivo, "remitente no autorizado")
  assert.equal(gatewayLlamado, false)
})

test("CONSULTA autorizada: el bot responde el resumen y registra el turno TG-<chat>", async (t) => {
  const tg = await mockTelegram()
  const gg = await mockGGTO()
  const gw = await mockGateway('{"intencion":"CONSULTA","consulta":"en qué va el caso 7012345678"}')
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfgBase(gg, tg, gw))
  const r = await procesarTelegram(estado, deps, UPDATE("en qué va el caso 7012345678"), CABECERA["x-telegram-bot-api-secret-token"])
  assert.equal(r.status, 200)
  assert.equal(r.body.accion, "consulta")
  assert.equal(r.body.consulta, "CASO")
  const msg = tg.mensajes()[0]
  assert.equal(msg.chat_id, "555000111")
  assert.ok(msg.text.includes("REF-REP-000991"), msg.text)
  const turno = gg.llamadas().find((l) => l.url.startsWith("/api/v1/asistente/sesiones"))
  assert.ok(turno, "debe registrar el turno")
  assert.equal(turno.cuerpo.canal, "TELEGRAM")
  assert.equal(turno.cuerpo.p00, "GGTOAST001")
  assert.ok(turno.cuerpo.sesion_id.startsWith("TG-"))
})

test("ALTA_CASO: vista previa SIN crear; luego CONFIRMAR aplica por el camino canónico", async (t) => {
  const tg = await mockTelegram()
  const gg = await mockGGTO()
  const gw = await mockGateway('{"intencion":"ALTA_CASO","tipo_reporte":"REPARACION","id_pago":"7012345678","nombre_cliente":"Pedro Ramirez","contacto_cliente":"04141234567","direccion":"Av los guayabos casa 12","tipo_problema":"Sin tono"}')
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfgBase(gg, tg, gw))
  // 1.er turno: vista previa, sin POST /casos
  const r1 = await procesarTelegram(estado, deps, UPDATE("ficha cliente Pedro Ramirez 7012345678 sin tono"), CABECERA["x-telegram-bot-api-secret-token"])
  assert.equal(r1.body.accion, "vista_previa")
  assert.equal(gg.llamadas().filter((l) => l.url === "/api/v1/casos" && l.method === "POST").length, 0)
  assert.ok(tg.mensajes()[0].text.includes("Responde CONFIRMAR"), tg.mensajes()[0].text)
  assert.ok(tg.mensajes()[0].text.includes("7012345678"))
  // 2.do turno: CONFIRMAR → 201
  const r2 = await procesarTelegram(estado, deps, UPDATE("confirmar"), CABECERA["x-telegram-bot-api-secret-token"])
  assert.equal(r2.body.accion, "confirmado", JSON.stringify(r2.body))
  assert.equal(r2.body.status_interno, 201)
  const alta = gg.llamadas().find((l) => l.url === "/api/v1/casos" && l.method === "POST")
  assert.equal(alta.cuerpo.id_pago, "7012345678")
  assert.ok(alta.auth.startsWith("Bearer tok."))
  assert.ok(tg.mensajes()[1].text.includes("Caso creado"), tg.mensajes()[1].text)
  // la pendiente se consume: un 2.do confirmar no re-aplica (queda como texto nuevo)
  const r3 = await procesarTelegram(estado, deps, UPDATE("confirmar"), CABECERA["x-telegram-bot-api-secret-token"])
  assert.equal(r3.body.accion, "vista_previa")
})

test("tarifa v2-A5 compartida: excedida → responde aviso y NO procesa", async (t) => {
  const tg = await mockTelegram()
  const gg = await mockGGTO()
  const gw = await mockGateway('{"intencion":"CONSULTA","consulta":"resumen del día"}')
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfgBase(gg, tg, gw, { RATE_PER_MIN: 1 }))
  await procesarTelegram(estado, deps, UPDATE("resumen del día"), CABECERA["x-telegram-bot-api-secret-token"])
  const r2 = await procesarTelegram(estado, deps, UPDATE("resumen del día"), CABECERA["x-telegram-bot-api-secret-token"])
  assert.equal(r2.status, 200)
  assert.equal(r2.body.motivo, "rate")
  assert.ok(tg.mensajes()[1].text.includes("Límite de uso"), JSON.stringify(tg.mensajes()))
})
