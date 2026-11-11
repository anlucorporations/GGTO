// test/eventos.test.js — ciclo C3: eventos sobre casos existentes (caminos canónicos)
const test = require("node:test")
const assert = require("node:assert/strict")
const { crearEstado, validarFichaEvento, confirmarAccion, obtenerToken, buscarCaso, aplicarEvento } = require("../server.js")

const CFG = (extra = {}) => ({ GGTO_API_URL: "http://mock-ggto", GGTO_USER: "GGTOAST001", GGTO_PASS: "clave-secreta",
  TIMEOUT_MS: 5000, RATE_PER_MIN: 30, DAILY_LIMIT: 500, MONGO_URL: "", PROMPT: "P",
  GATEWAY_URL: "http://gw", GATEWAY_AUTH: "k", MODEL: { id: "m", providerID: "p" }, PROJECT: "ggto", ...extra })

const FICHA = { intencion: "EVENTO", tipo_evento: "COMENTARIO", id_pago: "7012345678",
  detalle_evento: "Cliente reporta que ya restableció el servicio, pendiente verificación" }
const CASO = { id_caso: 991, id_averia: "REF-REP-000991", id_pago: 7012345678, estado_actual: "NUEVO" }

function mockGGTO(respuestas = {}) {
  const llamadas = []
  const srv = require("node:http").createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c))
    req.on("end", () => {
      llamadas.push({ url: req.url, method: req.method, cuerpo: JSON.parse(d || "{}") })
      const termino = (r) => { res.writeHead(r.status, { "Content-Type": "application/json" }); res.end(JSON.stringify(r.body)) }
      if (req.url.startsWith("/api/v1/auth/login"))
        return termino({ status: 200, body: { access_token: `tok.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.x`, expires_in: 3600 } })
      if (req.url.startsWith("/api/v1/casos/buscar")) {
        const r = respuestas.buscar || { status: 200, body: [CASO] }
        return termino(r)
      }
      if (/\/cita$/.test(req.url)) return termino(respuestas.cita || { status: 200, body: { ...CASO, estado_actual: "CITADO" } })
      if (/\/estado$/.test(req.url)) return termino(respuestas.estado || { status: 200, body: { ...CASO, estado_actual: "CONTACTADO" } })
      if (/\/api\/v1\/casos\/\d+$/.test(req.url)) return termino(respuestas.patch || { status: 200, body: CASO })
      res.writeHead(404); res.end("{}")
    })
  })
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, llamadas: () => llamadas,
    url: `http://127.0.0.1:${srv.address().port}` })))
}
const deps = () => ({ fetch: (u, o) => fetch(u, o), abortSignal: (ms) => AbortSignal.timeout(ms), TIMEOUT_MS: 5000,
  obtenerToken, buscarCaso, aplicarEvento })

test("validarFichaEvento: faltantes por tipo de evento", () => {
  assert.deepEqual(validarFichaEvento({}), ["tipo_evento", "id_pago"])
  assert.deepEqual(validarFichaEvento({ tipo_evento: "CITA", id_pago: "7012345678" }), ["fecha_cita"])
  assert.deepEqual(validarFichaEvento({ tipo_evento: "CAMBIO_ESTADO", id_averia: "REF-REP-000001" }), ["estado_nuevo"])
  assert.deepEqual(validarFichaEvento({ tipo_evento: "CAMBIO_ESTADO", id_pago: "7012345678", estado_nuevo: "VENTO" }),
    ["estado_nuevo_valido"])
  assert.deepEqual(validarFichaEvento({ tipo_evento: "COMENTARIO", id_pago: "7012345678" }), ["detalle_evento"])
  assert.deepEqual(validarFichaEvento({ tipo_evento: "ACTIVIDAD", id_pago: "7012345678", detalle_evento: "x" }), [])
})

test("COMENTARIO end-to-end: buscar → PATCH /casos/{id} con ultimo_comentario", async () => {
  const mock = await mockGGTO()
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const r = await confirmarAccion(estado, deps(), { ficha: FICHA })
  assert.equal(r.status, 200)
  assert.equal(r.body.aplicado, true)
  assert.equal(r.body.tipo_evento, "COMENTARIO")
  assert.equal(r.body.id_caso, 991)
  const patch = mock.llamadas().find((l) => l.method === "PATCH")
  assert.ok(patch, "debe llamar PATCH")
  assert.equal(patch.url, "/api/v1/casos/991")
  assert.equal(patch.cuerpo.ultimo_comentario, FICHA.detalle_evento)
  mock.srv.close()
})

test("CITA end-to-end: POST /casos/{id}/cita con fecha_hora y observacion", async () => {
  const mock = await mockGGTO()
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const ficha = { intencion: "EVENTO", tipo_evento: "CITA", id_averia: CASO.id_averia,
    fecha_cita: "2026-11-12T09:00:00", detalle_evento: "Cita acordada con el cliente" }
  const r = await confirmarAccion(estado, deps(), { ficha })
  assert.equal(r.status, 200)
  const cita = mock.llamadas().find((l) => /\/cita$/.test(l.url))
  assert.ok(cita, "debe llamar /cita")
  assert.equal(cita.method, "POST")
  assert.equal(cita.url, "/api/v1/casos/991/cita")
  assert.equal(cita.cuerpo.fecha_hora, "2026-11-12T09:00:00")
  assert.equal(cita.cuerpo.observacion, ficha.detalle_evento)
  mock.srv.close()
})

test("CAMBIO_ESTADO end-to-end: POST /casos/{id}/estado (D-120)", async () => {
  const mock = await mockGGTO()
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const ficha = { intencion: "EVENTO", tipo_evento: "CAMBIO_ESTADO", id_pago: "7012345678",
    estado_nuevo: "CONTACTADO", detalle_evento: "Cliente informado por COS" }
  const r = await confirmarAccion(estado, deps(), { ficha })
  assert.equal(r.status, 200)
  const est = mock.llamadas().find((l) => /\/estado$/.test(l.url))
  assert.ok(est, "debe llamar /estado")
  assert.deepEqual(est.cuerpo, { estado_actual: "CONTACTADO", motivo_estado: "Cliente informado por COS" })
  mock.srv.close()
})

test("caso no encontrado → 404 y NINGUNA escritura", async () => {
  const mock = await mockGGTO({ buscar: { status: 200, body: [] } })
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const r = await confirmarAccion(estado, deps(), { ficha: FICHA })
  assert.equal(r.status, 404)
  assert.equal(r.body.error, "Caso no encontrado")
  assert.equal(r.body.id_pago, "7012345678")
  assert.equal(mock.llamadas().filter((l) => l.method === "PATCH" || /\/(cita|estado)$/.test(l.url)).length, 0)
  mock.srv.close()
})

test("422 faltantes del evento → sin llamadas a GGTO", async () => {
  const mock = await mockGGTO()
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const r = await confirmarAccion(estado, deps(), { ficha: { intencion: "EVENTO", tipo_evento: "CITA" } })
  assert.equal(r.status, 422)
  assert.ok(r.body.faltantes.includes("id_pago") && r.body.faltantes.includes("fecha_cita"))
  assert.equal(mock.llamadas().filter((l) => !l.url.includes("login")).length, 0)
  mock.srv.close()
})

test("ACTIVIDAD usa el mismo camino canónico del comentario (no existe endpoint REST de actividad)", async () => {
  const mock = await mockGGTO()
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const ficha = { intencion: "EVENTO", tipo_evento: "ACTIVIDAD", id_averia: CASO.id_averia,
    detalle_evento: "Visita técnica realizada, equipo reinstalado" }
  const r = await confirmarAccion(estado, deps(), { ficha })
  assert.equal(r.status, 200)
  const patch = mock.llamadas().find((l) => l.method === "PATCH")
  assert.equal(patch.url, "/api/v1/casos/991")
  assert.equal(patch.cuerpo.ultimo_comentario, ficha.detalle_evento)
  mock.srv.close()
})

test("error canónico de GGTO se propaga tal cual (409 estado igual, D-120)", async () => {
  const mock = await mockGGTO({ estado: { status: 409, body: { detail: "El caso ya está en el estado CONTACTADO" } } })
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const ficha = { intencion: "EVENTO", tipo_evento: "CAMBIO_ESTADO", id_pago: "7012345678",
    estado_nuevo: "CONTACTADO", detalle_evento: "mismo estado" }
  const r = await confirmarAccion(estado, deps(), { ficha })
  assert.equal(r.status, 409)
  assert.equal(r.body.canonico, true)
  assert.ok(r.body.error.includes("ya está en el estado"))
  mock.srv.close()
})

test("422 canónico del servidor GGTO (fecha de cita inválida) se propaga sin reinterpretar", async () => {
  const mock = await mockGGTO({ cita: { status: 422, body: { detail: "fecha_hora inválida" } } })
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const ficha = { intencion: "EVENTO", tipo_evento: "CITA", id_pago: "7012345678",
    fecha_cita: "ayer a las nueve", detalle_evento: "cita" }
  const r = await confirmarAccion(estado, deps(), { ficha })
  assert.equal(r.status, 422)
  assert.equal(r.body.canonico, true)
  assert.equal(r.body.error, "fecha_hora inválida")
  mock.srv.close()
})
