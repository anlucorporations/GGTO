// test/telegram_grupo.test.js — v2 F3-TG-2/3: identidad por from.id, PII y dedupe en grupo
const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { crearEstado, obtenerToken, confirmarAccion, mapearAlta, buscarCaso, aplicarEvento,
  resolverConsulta, registrarTurno, procesarTelegram, buscarRemitente, responderTelegram,
  buscarGrupo, buscarMiembro, procesarMensaje } = require("../server.js")

const CHAT = "-5561202916"
const FROM = "8589760242"
const CASO = { id_caso: 991, id_averia: "REF-REP-000991", id_pago: "7012345678",
  estado_actual: "EN_GESTION", tipo_caso: "AVERIA", sector_nombre: "S1",
  fecha_reporte: "2026-11-27T08:00:00Z", nombre_cliente: "Pedro Ramirez",
  direccion: "Av los guayabos casa 12", contacto_cliente: "04141234567" }
const GRUPO = { id_grupo: 1, chat_id: -5561202916, titulo: "GGTOv3-PDE",
  id_central: 1, politica_pii: "REFERENCIAS", activo: true }
const MIEMBRO = { id_miembro: 1, id_grupo: 1, telegram_user_id: 8589760242,
  p00: "155541", rol: "SUPERVISOR", puede_actualizar: true, activo: true }

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
    res.end(JSON.stringify({ ok: true }))
  })
  return { ...w, mensajes: () => mensajes }
}
async function mockGGTO(opts = {}) {
  const llamadas = []
  const w = await servidorManejador(({ req, res, cuerpo }) => {
    llamadas.push({ url: req.url, method: req.method, cuerpo })
    const ok = (b, s = 200) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)) }
    if (req.url.startsWith("/api/v1/auth/login"))
      return ok({ access_token: `tok.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.x` })
    if (req.url.startsWith("/api/v1/asistente/grupos/1/miembros"))
      return ok(opts.miembro === false ? [] : [MIEMBRO])
    if (req.url.startsWith("/api/v1/asistente/grupos")) return ok([GRUPO])
    if (req.url.startsWith("/api/v1/casos/buscar")) return ok([CASO])
    if (req.url.startsWith("/api/v1/monitoreo/diario")) return ok({ pendientes: 12, cerrados: 5 })
    if (req.url.startsWith("/api/v1/asistente/sesiones")) return ok({ id_turno: 1 }, 201)
    if (req.url === "/api/v1/casos") return ok({ id_caso: 991, id_averia: "REF-REP-000991" }, 201)
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
  buscarGrupo, buscarMiembro, procesar: procesarMensaje,
  gateway: async () => '{"intencion":"CONSULTA","consulta":"en qué va el caso 7012345678"}',
  parse: (t) => { try { return JSON.parse(t) } catch { return null } },
}
const cfg = (gg, tg, gw, extra = {}) => ({ GGTO_API_URL: gg.url, GGTO_USER: "GGTOAST001", GGTO_PASS: "clave",
  TIMEOUT_MS: 5000, RATE_PER_MIN: 30, DAILY_LIMIT: 500, MONGO_URL: "", PROMPT: "P",
  GATEWAY_URL: gw.url, GATEWAY_AUTH: "k", MODEL: { id: "m", providerID: "p" },
  TELEGRAM_API_URL: tg.url, TELEGRAM_SECRET: "secreto-wb", TELEGRAM_BOT_TOKEN: "BOT-TOKEN", ...extra })
const UPDATE = (texto, updateId = 1) => ({ update_id: updateId,
  message: { message_id: 900 + updateId, text: texto,
    chat: { id: Number(CHAT), type: "group", title: "GGTOv3-PDE" },
    from: { id: Number(FROM), username: "txbarlovento" } } })
const SECRETO = "secreto-wb"

test("miembro autorizado: consulta responde SOLO referencias (sin PII) y registra turno de grupo", async (t) => {
  const tg = await mockTelegram(), gg = await mockGGTO(), gw = await mockGateway("")
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfg(gg, tg, gw))
  const r = await procesarTelegram(estado, deps, UPDATE("en qué va el caso 7012345678", 1), SECRETO)
  assert.equal(r.status, 200)
  assert.equal(r.body.accion, "consulta")
  const texto = tg.mensajes()[0].text
  assert.match(texto, /REF-REP-000991/)
  assert.match(texto, /7012345678/)
  assert.match(texto, /EN_GESTION|S1/)
  assert.doesNotMatch(texto, /Pedro Ramirez|04141234567|Av los guayabos/)
  const turno = gg.llamadas().find((l) => l.url.startsWith("/api/v1/asistente/sesiones"))
  assert.ok(turno, "debe registrar el turno")
  assert.equal(turno.cuerpo.canal, "TELEGRAM_GRUPO")
  assert.equal(turno.cuerpo.p00, "155541")
  assert.equal(turno.cuerpo.id_grupo, 1)
  assert.equal(turno.cuerpo.mensaje_id, 901)
  assert.equal(turno.cuerpo.telegram_user_id, 8589760242)
})

test("usuario NO autorizado por from.id: 200, sin LLM y aviso al grupo", async (t) => {
  const tg = await mockTelegram(), gg = await mockGGTO({ miembro: false }), gw = await mockGateway("")
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfg(gg, tg, gw))
  let gatewayLlamado = false
  const d = { ...deps, gateway: async () => { gatewayLlamado = true; return "{}" } }
  const r = await procesarTelegram(estado, d, UPDATE("hola", 2), SECRETO)
  assert.equal(r.body.motivo, "usuario no autorizado")
  assert.equal(r.body.telegram_user_id, FROM)
  assert.equal(gatewayLlamado, false)
  assert.match(tg.mensajes()[0].text, /8589760242/)
})

test("dedupe: reenvío del mismo update_id no duplica respuesta ni gasto del LLM", async (t) => {
  const tg = await mockTelegram(), gg = await mockGGTO(), gw = await mockGateway("")
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfg(gg, tg, gw))
  const update = UPDATE("resumen del dia", 3)
  const r1 = await procesarTelegram(estado, deps, update, SECRETO)
  const r2 = await procesarTelegram(estado, deps, update, SECRETO)
  assert.equal(r1.body.accion, "consulta")
  assert.equal(r2.body.motivo, "duplicado")
  assert.equal(tg.mensajes().length, 1)
  assert.equal(gg.llamadas().filter((l) => l.url.startsWith("/api/v1/asistente/sesiones")).length, 1)
})

test("gestor: vista previa sin PII y pendiente con /confirmar <id>", async (t) => {
  const tg = await mockTelegram(), gg = await mockGGTO(), gw = await mockGateway("")
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfg(gg, tg, gw))
  const d = { ...deps, gateway: async () =>
    '{"intencion":"ALTA_CASO","tipo_reporte":"REPARACION","id_pago":"7012345678",'
    + '"nombre_cliente":"Pedro Ramirez","contacto_cliente":"04141234567",'
    + '"direccion":"Av los guayabos casa 12","tipo_problema":"Sin tono"}' }
  const r = await procesarTelegram(estado, d, UPDATE("alta cliente Pedro 7012345678 sin tono", 5), SECRETO)
  assert.equal(r.body.accion, "vista_previa")
  assert.ok(r.body.id_pending)
  assert.match(tg.mensajes()[0].text, /\/confirmar/)
  assert.match(tg.mensajes()[0].text, /7012345678/)
  assert.doesNotMatch(tg.mensajes()[0].text, /Pedro Ramirez|04141234567|Av los guayabos/)
  assert.equal(gg.llamadas().filter((l) => l.url === "/api/v1/casos" && l.method === "POST").length, 0)
})

test("rol sin permiso de escritura: no crea caso y avisa al grupo", async (t) => {
  const tg = await mockTelegram(), gg = await mockGGTO(), gw = await mockGateway("")
  t.after(() => { tg.srv.close(); gg.srv.close(); gw.srv.close() })
  const estado = crearEstado(cfg(gg, tg, gw))
  const d = { ...deps,
    buscarMiembro: async () => ({ ...MIEMBRO, rol: "TECNICO", puede_actualizar: false }),
    gateway: async () => '{"intencion":"ALTA_CASO","id_pago":"7012345678"}' }
  const r = await procesarTelegram(estado, d, UPDATE("dame de alta el cliente Pedro 7012345678", 4), SECRETO)
  assert.equal(r.body.motivo, "rol sin permiso de escritura")
  assert.equal(gg.llamadas().filter((l) => l.url === "/api/v1/casos" && l.method === "POST").length, 0)
})
