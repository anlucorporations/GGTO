// test/consultas.test.js — ciclo C4: consultas de lectura + historial de sesión en GGTO
const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { crearEstado, clasificarConsulta, procesarMensaje, claveVentana } = require("../server.js")

const CASO = { id_caso: 991, id_averia: "REF-REP-000991", estado_actual: "EN_GESTION", tipo_caso: "AVERIA",
  sector_nombre: "S1", olt: "OLT1", slot: "1", puerto: "4", fat: "FAT-12",
  fecha_reporte: "2026-11-11T08:00:00Z", fecha_cita: null, ultimo_comentario: "pendiente cuadrilla",
  nombre_cliente: "Pedro Ramirez", direccion: "Av los guayabos casa 12", contacto_cliente: "04141234567" }

function mockGGTO(respuestas = {}) {
  const llamadas = []
  const srv = http.createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c))
    req.on("end", () => {
      llamadas.push({ url: req.url, method: req.method, cuerpo: JSON.parse(d || "{}") })
      const termino = (r) => { res.writeHead(r.status, { "Content-Type": "application/json" }); res.end(JSON.stringify(r.body)) }
      if (req.url.startsWith("/api/v1/auth/login"))
        return termino({ status: 200, body: { access_token: `tok.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.x`, expires_in: 3600 } })
      if (req.url.startsWith("/api/v1/casos/buscar")) return termino(respuestas.buscar || { status: 200, body: [CASO] })
      if (req.url.startsWith("/api/v1/monitoreo/diario")) return termino(respuestas.diario || { status: 200, body: { pendientes: 12, cerrados: 5, asignados: 8 } })
      if (req.url.startsWith("/api/v1/asistente/sesiones")) return termino(respuestas.sesiones || { status: 201, body: { id_turno: 1 } })
      res.writeHead(404); res.end("{}")
    })
  })
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, llamadas: () => llamadas,
    url: `http://127.0.0.1:${srv.address().port}` })))
}
function mockGateway(texto) {
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ data: { text: texto } }))
  })
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, url: `http://127.0.0.1:${srv.address().port}` })))
}
const CFG = (mock) => ({ GGTO_API_URL: mock.url, GGTO_USER: "GGTOAST001", GGTO_PASS: "clave-secreta",
  TIMEOUT_MS: 5000, RATE_PER_MIN: 30, DAILY_LIMIT: 500, MONGO_URL: "", PROMPT: "P",
  GATEWAY_URL: "http://gw", GATEWAY_AUTH: "k", MODEL: { id: "m", providerID: "p" }, PROJECT: "ggto" })
const deps = (obtenerToken) => ({ fetch: (u, o) => fetch(u, o), abortSignal: (ms) => AbortSignal.timeout(ms),
  TIMEOUT_MS: 5000, obtenerToken, gateway: null, parse: null })

test("clasificarConsulta: CASO por 70*/REF, FAT/sector, resto → RESUMEN_DIA", () => {
  assert.equal(clasificarConsulta({ consulta: "en qué va el caso 7012345678" }), "CASO")
  assert.equal(clasificarConsulta({ id_pago: "7012345678", consulta: "estado" }), "CASO")
  assert.equal(clasificarConsulta({ consulta: "casos de la avería REF-REP-000991" }), "CASO")
  assert.equal(clasificarConsulta({ consulta: "qué hay en el FAT FAT-12" }), "FAT")
  assert.equal(clasificarConsulta({ consulta: "casos del sector 5" }), "FAT")
  assert.equal(clasificarConsulta({ consulta: "resumen del día" }), "RESUMEN_DIA")
})

test("procesarMensaje CONSULTA_CASO: resuelve en el turno con PII de la ficha del caso", async () => {
  const mock = await mockGGTO()
  const gw = await mockGateway('{"intencion":"CONSULTA","consulta":"en qué va el caso 7012345678"}')
  const estado = crearEstado({ ...CFG(mock), GATEWAY_URL: gw.url })
  const d = { ...deps((e, x) => require("../server.js").obtenerToken(e, x)),
    gateway: async (c) => { const r = await fetch(`${c.GATEWAY_URL}/gen`, { method: "POST", headers: { "Content-Type": "application/json" } }); return (await r.json()).data.text },
    parse: (t) => { try { return JSON.parse(t.replace(/^```json\n?|```$/g, "")) } catch { return null } },
    buscarCaso: require("../server.js").buscarCaso,
    resolverConsulta: require("../server.js").resolverConsulta,
    registrarTurno: require("../server.js").registrarTurno }
  const r = await procesarMensaje(estado, d, "en qué va el caso 7012345678", "SESION-TEST")
  assert.equal(r.status, 200)
  assert.equal(r.body.consulta, "CASO")
  assert.equal(r.body.respuesta.encontrado, true)
  assert.equal(r.body.respuesta.resumen.id_averia, "REF-REP-000991")
  assert.equal(r.body.respuesta.resumen.estado_actual, "EN_GESTION")
  assert.equal(r.body.respuesta.resumen.nombre_cliente, "Pedro Ramirez")
  assert.ok(r.body.nota.includes("nada se ha modificado"))
  const turno = mock.llamadas().find((l) => l.url.startsWith("/api/v1/asistente/sesiones"))
  assert.ok(turno, "debe registrar el turno")
  assert.equal(turno.cuerpo.sesion_id, "SESION-TEST")
  assert.equal(turno.cuerpo.intencion, "CONSULTA")
  assert.equal(turno.cuerpo.detalle, "CASO")
  assert.equal(turno.method, "POST")
  mock.srv.close(); gw.srv.close()
})

test("procesarMensaje CONSULTA_FAT: listado sin PII (sin nombre/dirección/contacto)", async () => {
  const mock = await mockGGTO()
  const gw = await mockGateway('{"intencion":"CONSULTA","consulta":"qué hay en el FAT FAT-12"}')
  const estado = crearEstado({ ...CFG(mock), GATEWAY_URL: gw.url })
  const srv = require("../server.js")
  const d = { ...deps((e, x) => srv.obtenerToken(e, x)),
    gateway: async (c) => { const r = await fetch(`${c.GATEWAY_URL}/gen`, { method: "POST" }); return (await r.json()).data.text },
    parse: (t) => JSON.parse(t), buscarCaso: srv.buscarCaso,
    resolverConsulta: srv.resolverConsulta, registrarTurno: srv.registrarTurno }
  const r = await procesarMensaje(estado, d, "qué hay en el FAT FAT-12", "SESION-TEST")
  assert.equal(r.body.consulta, "FAT")
  assert.equal(r.body.respuesta.termino, "FAT-12")
  assert.equal(r.body.respuesta.total, 1)
  const caso = r.body.respuesta.casos[0]
  assert.equal(caso.fat, "OLT1-1-4-FAT-12")
  assert.ok(!("nombre_cliente" in caso) && !("direccion" in caso) && !("contacto_cliente" in caso),
    "el listado no debe llevar PII")
  const q = mock.llamadas().find((l) => l.url.includes("/casos/buscar")).url
  assert.ok(q.includes("q=FAT-12"))
  mock.srv.close(); gw.srv.close()
})

test("procesarMensaje RESUMEN_DIA: agregados del monitoreo, sin PII", async () => {
  const mock = await mockGGTO()
  const gw = await mockGateway('{"intencion":"CONSULTA","consulta":"resumen del día"}')
  const estado = crearEstado({ ...CFG(mock), GATEWAY_URL: gw.url })
  const srv = require("../server.js")
  const d = { ...deps((e, x) => srv.obtenerToken(e, x)),
    gateway: async (c) => { const r = await fetch(`${c.GATEWAY_URL}/gen`, { method: "POST" }); return (await r.json()).data.text },
    parse: (t) => JSON.parse(t), buscarCaso: srv.buscarCaso,
    resolverConsulta: srv.resolverConsulta, registrarTurno: srv.registrarTurno }
  const r = await procesarMensaje(estado, d, "resumen del día", "SESION-TEST")
  assert.equal(r.body.consulta, "RESUMEN_DIA")
  assert.equal(r.body.respuesta.resumen.pendientes, 12)
  assert.ok(!JSON.stringify(r.body.respuesta).includes("Pedro"))
  mock.srv.close(); gw.srv.close()
})

test("CASO no encontrado: respuesta amable y sin escrituras; turno registrado igualmente", async () => {
  const mock = await mockGGTO({ buscar: { status: 200, body: [] } })
  const gw = await mockGateway('{"intencion":"CONSULTA","consulta":"en qué va el caso 7012345678"}')
  const estado = crearEstado({ ...CFG(mock), GATEWAY_URL: gw.url })
  const srv = require("../server.js")
  const d = { ...deps((e, x) => srv.obtenerToken(e, x)),
    gateway: async (c) => { const r = await fetch(`${c.GATEWAY_URL}/gen`, { method: "POST" }); return (await r.json()).data.text },
    parse: (t) => JSON.parse(t), buscarCaso: srv.buscarCaso,
    resolverConsulta: srv.resolverConsulta, registrarTurno: srv.registrarTurno }
  const r = await procesarMensaje(estado, d, "en qué va el caso 7012345678", "SESION-TEST")
  assert.equal(r.body.respuesta.encontrado, false)
  assert.ok(r.body.respuesta.texto.includes("No encontré"))
  assert.ok(mock.llamadas().find((l) => l.url.startsWith("/api/v1/asistente/sesiones")), "el turno se registra igual")
  mock.srv.close(); gw.srv.close()
})

test("fallo del historial de sesión (GGTO 500) NO rompe el chat", async () => {
  const mock = await mockGGTO({ sesiones: { status: 500, body: { detail: "boom" } } })
  const gw = await mockGateway('{"intencion":"CONSULTA","consulta":"resumen del día"}')
  const estado = crearEstado({ ...CFG(mock), GATEWAY_URL: gw.url })
  const srv = require("../server.js")
  const d = { ...deps((e, x) => srv.obtenerToken(e, x)),
    gateway: async (c) => { const r = await fetch(`${c.GATEWAY_URL}/gen`, { method: "POST" }); return (await r.json()).data.text },
    parse: (t) => JSON.parse(t), buscarCaso: srv.buscarCaso,
    resolverConsulta: srv.resolverConsulta, registrarTurno: srv.registrarTurno }
  const r = await procesarMensaje(estado, d, "resumen del día", "SESION-TEST")
  assert.equal(r.status, 200)
  assert.equal(r.body.consulta, "RESUMEN_DIA")
  mock.srv.close(); gw.srv.close()
})

test("sin sesion_id del cliente: sesion diaria PANEL-<fecha> (canon v2-A5)", async () => {
  const mock = await mockGGTO()
  const gw = await mockGateway('{"intencion":"CONSULTA","consulta":"resumen del día"}')
  const estado = crearEstado({ ...CFG(mock), GATEWAY_URL: gw.url })
  const srv = require("../server.js")
  const d = { ...deps((e, x) => srv.obtenerToken(e, x)),
    gateway: async (c) => { const r = await fetch(`${c.GATEWAY_URL}/gen`, { method: "POST" }); return (await r.json()).data.text },
    parse: (t) => JSON.parse(t), buscarCaso: srv.buscarCaso,
    resolverConsulta: srv.resolverConsulta, registrarTurno: srv.registrarTurno }
  await procesarMensaje(estado, d, "resumen del día", "")
  const turno = mock.llamadas().find((l) => l.url.startsWith("/api/v1/asistente/sesiones"))
  assert.equal(turno.cuerpo.sesion_id, `PANEL-${claveVentana(Date.now(), "dia")}`)
  mock.srv.close(); gw.srv.close()
})
