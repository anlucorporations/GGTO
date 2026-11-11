// test/confirmar.test.js — ciclo C2: autenticación de servicio + alta canónica
const test = require("node:test")
const assert = require("node:assert/strict")
const { crearEstado, validarFichaAlta, mapearAlta, confirmarAccion, obtenerToken, expiracionJwt } = require("../server.js")

const CFG = (extra = {}) => ({ GGTO_API_URL: "http://mock-ggto", GGTO_USER: "GGTOAST001", GGTO_PASS: "clave-secreta",
  TIMEOUT_MS: 5000, RATE_PER_MIN: 30, DAILY_LIMIT: 500, MONGO_URL: "", PROMPT: "P",
  GATEWAY_URL: "http://gw", GATEWAY_AUTH: "k", MODEL: { id: "m", providerID: "p" }, PROJECT: "ggto", ...extra })
const FICHA_OK = { intencion: "ALTA_CASO", tipo_reporte: "REPARACION", id_pago: "7012345678",
  nombre_cliente: "Pedro Ramirez", contacto_cliente: "04141234567",
  direccion: "Av los guayabos casa 12", tipo_problema: "Sin tono" }

function mockGGTO(respuestas) { // respuestas: {login:{status,body}, casos:(cuerpo)=>{status,body}}
  let logins = 0, altas = []
  const srv = require("node:http").createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c))
    req.on("end", () => {
      if (req.url === "/api/v1/auth/login") {
        logins += 1
        const r = respuestas.login || { status: 200, body: { access_token: `tok.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.x`, expires_in: 3600 } }
        res.writeHead(r.status, { "Content-Type": "application/json" }); res.end(JSON.stringify(r.body)); return
      }
      if (req.url === "/api/v1/casos" && req.method === "POST") {
        const r = respuestas.casos ? respuestas.casos(JSON.parse(d || "{}")) : { status: 201, body: { id_caso: 991, id_averia: "REF-REP-000991", estado_actual: "NUEVO", tipo_caso: "AVERIA", id_pago: "7012345678" } }
        altas.push({ auth: req.headers.authorization, cuerpo: JSON.parse(d || "{}") })
        res.writeHead(r.status, { "Content-Type": "application/json" }); res.end(JSON.stringify(r.body)); return
      }
      res.writeHead(404); res.end("{}")
    })
  })
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, logins: () => logins, altas: () => altas,
    url: `http://127.0.0.1:${srv.address().port}` })))
}
const deps = (mock) => ({ fetch: (u, o) => fetch(u, o), abortSignal: (ms) => AbortSignal.timeout(ms),
  obtenerToken, mapear: mapearAlta, TIMEOUT_MS: 5000 })

test("validarFichaAlta: faltantes e id_pago inválido (RNF-AV-06)", () => {
  assert.deepEqual(validarFichaAlta({}), ["tipo_reporte", "id_pago", "nombre_cliente", "contacto_cliente", "direccion"])
  assert.deepEqual(validarFichaAlta({ ...FICHA_OK, tipo_problema: null }), ["tipo_problema"])
  assert.deepEqual(validarFichaAlta({ ...FICHA_OK, id_pago: "04141234567" }), ["id_pago_invalido"])
  assert.deepEqual(validarFichaAlta(FICHA_OK), [])
})

test("mapearAlta: solo campos no vacíos", () => {
  const c = mapearAlta({ ...FICHA_OK, nota: "x", persona_reporta: "ana" })
  assert.equal(c.id_pago, "7012345678")
  assert.equal(c.persona_reporta, "ana")
  assert.ok(!("nota" in c) && !("intencion" in c))
})

test("confirmarAccion ALTA_CASO completa → login + POST /casos + 201; el JWT se cachea", async () => {
  const mock = await mockGGTO({})
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const d = deps(mock)
  const r1 = await confirmarAccion(estado, d, { ficha: FICHA_OK })
  assert.equal(r1.status, 201)
  assert.equal(r1.body.creado, true)
  assert.equal(r1.body.id_averia, "REF-REP-000991")
  assert.equal(mock.altas().length, 1)
  assert.match(mock.altas()[0].auth, /^Bearer tok\./)
  assert.equal(mock.altas()[0].cuerpo.id_pago, "7012345678")
  assert.equal(mock.logins(), 1)
  // 2.ª confirmación: reusa el JWT (login sigue en 1)
  const r2 = await confirmarAccion(estado, d, { ficha: { ...FICHA_OK, nombre_cliente: "Otro" } })
  assert.equal(r2.status, 201)
  assert.equal(mock.logins(), 1)
  mock.srv.close()
})

test("confirmarAccion: faltantes → 422 y NINGUNA llamada a /casos", async () => {
  const mock = await mockGGTO({})
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const r = await confirmarAccion(estado, deps(mock), { ficha: { intencion: "ALTA_CASO", id_pago: "7012345678" } })
  assert.equal(r.status, 422)
  assert.ok(r.body.faltantes.includes("nombre_cliente"))
  assert.equal(mock.altas().length, 0)
  mock.srv.close()
})

test("confirmarAccion: error canónico (409 duplicado) se propaga tal cual", async () => {
  const mock = await mockGGTO({ casos: () => ({ status: 409, body: { detail: "Ya existe un caso con id_averia REF-REP-000001" } }) })
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const r = await confirmarAccion(estado, deps(mock), { ficha: FICHA_OK })
  assert.equal(r.status, 409)
  assert.equal(r.body.canonico, true)
  assert.ok(r.body.error.includes("Ya existe"))
  mock.srv.close()
})

test("confirmarAccion: CONSULTA → 501 (llega en C4)", async () => {
  const mock = await mockGGTO({})
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  const r = await confirmarAccion(estado, deps(mock), { ficha: { intencion: "CONSULTA", consulta: "casos del dia" } })
  assert.equal(r.status, 501)
  assert.equal(mock.altas().length, 0)
  mock.srv.close()
})

test("obtenerToken: sin usuario/clave de servicio → 503 fail-closed; login malo → 503", async () => {
  const mock = await mockGGTO({})
  const estado1 = crearEstado({ ...CFG({ GGTO_API_URL: mock.url, GGTO_USER: "", GGTO_PASS: "" }) })
  await assert.rejects(() => obtenerToken(estado1, deps(mock)), /usuario de servicio no configurado/)
  const mockMalo = await mockGGTO({ login: { status: 401, body: { detail: "Credenciales inválidas" } } })
  const estado2 = crearEstado({ ...CFG({ GGTO_API_URL: mockMalo.url }) })
  await assert.rejects(() => obtenerToken(estado2, deps(mockMalo)), /respondió 401/)
  mock.srv.close(); mockMalo.srv.close()
})

test("expiracionJwt decodifica exp y obtieneToken renueva al vencer", async () => {
  const tokenVencido = `a.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 10 })).toString("base64url")}.c`
  assert.ok(expiracionJwt(tokenVencido) < Date.now() / 1000)
  const mock = await mockGGTO({})
  const estado = crearEstado({ ...CFG({ GGTO_API_URL: mock.url }) })
  estado.ggto = { token: tokenVencido, exp: expiracionJwt(tokenVencido) }
  const t = await obtenerToken(estado, deps(mock))
  assert.match(t, /^tok\./)          // renovó
  assert.equal(mock.logins(), 1)
  mock.srv.close()
})
