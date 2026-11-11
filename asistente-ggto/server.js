// server.js — asistente-ggto (C1: núcleo, canon v2-A5 de MANUAL_ASISTENTES_V2.md)
// Extracción de intención + ficha contra el Gateway OpenCode. NADA escribe en GGTO:
// la confirmación llega en C2 (POST /api/confirmar). Fail-closed: sin credencial → 503.
const http = require("http")

// ---- CONFIG (env; secretos por docker secret/env_file root-only, RS-2) ----
const GATEWAY_URL   = process.env.GATEWAY_URL || "http://100.125.94.21:4090"
const GATEWAY_AUTH  = process.env.GATEWAY_AUTH_KEY ||
  (leerArchivo("/run/secrets/gateway_auth") || "").trim()
const MODEL         = { id: process.env.MODEL_ID || "claude-haiku-5-5",
                        providerID: process.env.MODEL_PROVIDER || "opencode-go" }
const GGTO_API_URL  = process.env.GGTO_API_URL || "https://ggto-web-597577479284.europe-west1.run.app"
const GGTO_USER     = process.env.GGTO_SERVICE_USER || ""       // p00 del usuario de servicio
const GGTO_PASS     = process.env.GGTO_SERVICE_PASSWORD ||
  (leerArchivo("/run/secrets/ggto_service_pass") || "").trim()
const PROJECT       = process.env.PROJECT_NAME || "ggto"
const RATE_PER_MIN  = parseInt(process.env.RATE_PER_MIN || "30", 10)
const DAILY_LIMIT   = parseInt(process.env.DAILY_CHAT_LIMIT || "500", 10)
const MONGO_URL     = process.env.MONGO_URL           // opcional en C1 (uso/cuota, canon v2-A5)
const MONGO_DB      = process.env.MONGO_DB || `proj_${PROJECT}`
// ---- C5: Telegram (canon: secret_token fail-closed; token del bot por docker secret) ----
const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || "https://api.telegram.org"
const TELEGRAM_SECRET  = process.env.TELEGRAM_SECRET ||
  (leerArchivo("/run/secrets/telegram_secret") || "").trim()
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ||
  (leerArchivo("/run/secrets/telegram_bot_token") || "").trim()
const PUERTO        = parseInt(process.env.PORT || "3000", 10)
const TIMEOUT_MS    = parseInt(process.env.GATEWAY_TIMEOUT_MS || "60000", 10)

function leerArchivo(ruta) { try { return require("fs").readFileSync(ruta, "utf8") } catch { return "" } }

// ---- System-prompt del proyecto GGTO (intención + ficha, SOLO JSON) ----
const PROMPT_GGTO = `Eres el asistente virtual de GGTO (gestión de averías y puntos ópticos de la central CANTV Francisco Salias, codigo 2324X). Respondes SOLO con un JSON válido, sin texto adicional ni bloques de código, con esta forma EXACTA:
{"intencion": "ALTA_CASO" | "EVENTO" | "CONSULTA" | "DESCONOCIDO",
 "tipo_reporte": "REPARACION" | "CONSTRUCCION" | "MANTENIMIENTO" | null,
 "id_pago": string|null,          // identificador de pago 70* (solo dígitos tras el 70)
 "nombre_cliente": string|null,
 "contacto_cliente": string|null, // teléfono de contacto
 "direccion": string|null,
 "tipo_problema": string|null,    // obligatorio en REPARACION (max 20 caracteres)
 "tipo_evento": "ACTIVIDAD"|"COMENTARIO"|"CITA"|"CAMBIO_ESTADO"|null,
 "detalle_evento": string|null,   // para EVENTO: lo que se pide hacer
 "fecha_cita": string|null,       // para CITA: AAAA-MM-DD HH:mm si el texto la indica
 "estado_nuevo": string|null,     // para CAMBIO_ESTADO
 "consulta": string|null,         // para CONSULTA
 "nota": string|null}             // lo que falte o sea ambiguo
Reglas: el texto llega con ortografía imperfecta y abreviaturas: interpreta. Un id de pago
válido empieza con 70 y trae 10 dígitos (ej. 7012345678). Un alta sin id de pago, nombre,
contacto o dirección igual va como ALTA_CASO con los campos que tengas (el sistema pedirá
completar los faltantes). Si el texto no parece alta, evento ni consulta → DESCONOCIDO.`

// ---- C2: autenticación contra GGTO (usuario de servicio, JWT renovable) ----
function expiracionJwt(token) { // exp del payload (base64url); 0 si no se puede
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
    return typeof p.exp === "number" ? p.exp : 0
  } catch { return 0 }
}
async function obtenerToken(estado, deps) {
  const { GGTO_API_URL, GGTO_USER, GGTO_PASS, fetch, abortSignal } = { ...estado.cfg, ...deps }
  if (!GGTO_USER || !GGTO_PASS) { const e = new Error("usuario de servicio no configurado"); e.codigo = 503; throw e }
  const margen = Math.floor(Date.now() / 1000) + 60
  if (estado.ggto?.token && estado.ggto.exp > margen) return estado.ggto.token
  const r = await deps.fetch(`${GGTO_API_URL}/api/v1/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p00: GGTO_USER, clave: GGTO_PASS }),
    signal: deps.abortSignal(deps.TIMEOUT_MS || 30000),
  })
  if (!r.ok) { const e = new Error(`login GGTO respondió ${r.status}`); e.codigo = 503; throw e }
  const j = await r.json()
  if (!j?.access_token) { const e = new Error("login GGTO sin token"); e.codigo = 503; throw e }
  estado.ggto = { token: j.access_token, exp: expiracionJwt(j.access_token) }
  return estado.ggto.token
}

// ---- C2: ALTA_CASO por el camino canónico POST /api/v1/casos ----
const OBLIGATORIOS_ALTA = ["tipo_reporte", "id_pago", "nombre_cliente", "contacto_cliente", "direccion"]
function validarFichaAlta(ficha) {
  const faltantes = []
  for (const c of OBLIGATORIOS_ALTA) if (!String(ficha?.[c] ?? "").trim()) faltantes.push(c)
  if (ficha && String(ficha.tipo_reporte) === "REPARACION" && !String(ficha.tipo_problema ?? "").trim())
    faltantes.push("tipo_problema")
  if (ficha?.id_pago && !/^70\d{8}$/.test(String(ficha.id_pago).trim())) faltantes.push("id_pago_invalido")
  return faltantes
}
function mapearAlta(ficha) { // solo campos no vacíos → CasoManualCreate
  const saca = (k) => { const v = String(ficha[k] ?? "").trim(); return v || undefined }
  const cuerpo = {
    tipo_reporte: saca("tipo_reporte"),
    id_pago: saca("id_pago"),
    nombre_cliente: saca("nombre_cliente"),
    contacto_cliente: saca("contacto_cliente"),
    direccion: saca("direccion"),
  }
  for (const k of ["tipo_problema", "informacion", "problema_reporte", "persona_reporta", "fecha_cita", "categoria", "tipo_servicio"]) {
    const v = saca(k); if (v) cuerpo[k] = v
  }
  return cuerpo
}
async function confirmarAccion(estado, deps, cuerpo) {
  const { GGTO_API_URL, fetch, abortSignal, TIMEOUT_MS } = estado.cfg
  const ficha = cuerpo?.ficha || cuerpo
  if (String(ficha.intencion || "") === "CONSULTA")
    return { status: 501, body: { error: "Las consultas llegan en C4" } }
  if (String(ficha.intencion || "ALTA_CASO") === "EVENTO") {
    // C3: evento sobre un caso existente — validar → buscar caso → aplicar
    const faltantesEv = validarFichaEvento(ficha)
    if (faltantesEv.length) return { status: 422, body: { error: "Faltan datos del evento", faltantes: faltantesEv } }
    let caso
    try {
      await deps.obtenerToken(estado, deps)
      caso = await deps.buscarCaso(estado, deps, ficha)
    } catch (e) {
      return { status: 503, body: { error: `No se pudo contactar la API de GGTO: ${e.message}` } }
    }
    if (!caso) return { status: 404, body: { error: "Caso no encontrado", id_pago: ficha.id_pago || undefined, id_averia: ficha.id_averia || undefined } }
    try { return await deps.aplicarEvento(estado, deps, ficha, caso.id_caso) }
    catch (e) {
      return { status: 503, body: { error: `No se pudo contactar la API de GGTO: ${e.message}` } }
    }
  }
  if (ficha.intencion && ficha.intencion !== "ALTA_CASO")
    return { status: 501, body: { error: `La intención ${ficha.intencion} no está soportada` } }
  const faltantes = validarFichaAlta(ficha)
  if (faltantes.length) return { status: 422, body: { error: "Faltan datos obligatorios del caso", faltantes } }
  let token
  try { token = await deps.obtenerToken(estado, deps) }
  catch (e) { return { status: e.codigo === 503 ? 503 : 503, body: { error: `No se pudo autenticar contra GGTO: ${e.message}` } } }
  try {
    const r = await deps.fetch(`${GGTO_API_URL}/api/v1/casos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(deps.mapear(ficha)),
      signal: deps.abortSignal(TIMEOUT_MS || 30000),
    })
    const j = await r.json().catch(() => ({}))
    if (r.status === 201)
      return { status: 201, body: { creado: true, id_caso: j.id_caso, id_averia: j.id_averia,
        estado_actual: j.estado_actual, tipo_caso: j.tipo_caso, id_pago: j.id_pago,
        nota: "Caso creado por el camino canónico (POST /casos)" } }
    // errores canónicos: se propagan tal cual (422/409/400/…) sin reinterpretar
    return { status: r.status, body: { error: j.detail || `GGTO respondió ${r.status}`, canonico: true } }
  } catch (e) {
    return { status: 503, body: { error: `No se pudo contactar la API de GGTO: ${e.message}` } }
  }
}

// ---- C3: EVENTOS sobre casos existentes (caminos canónicos) ----
const ESTADOS_VALIDOS = ["NUEVO", "ASIGNADO", "CONTACTADO", "CITADO", "DIFERIDO", "EN_GESTION", "ENRUTADO", "CERRADO", "CANCELADO"]
const EVENTOS_VALIDOS = ["COMENTARIO", "ACTIVIDAD", "CITA", "CAMBIO_ESTADO"]
function validarFichaEvento(ficha) {
  const faltantes = []
  if (!EVENTOS_VALIDOS.includes(String(ficha?.tipo_evento || ""))) faltantes.push("tipo_evento")
  if (!String(ficha?.id_pago ?? "").trim() && !String(ficha?.id_averia ?? "").trim()) faltantes.push("id_pago")
  const te = String(ficha?.tipo_evento || "")
  if (te === "CITA" && !String(ficha?.fecha_cita ?? "").trim()) faltantes.push("fecha_cita")
  if (te === "CAMBIO_ESTADO" && !String(ficha?.estado_nuevo ?? "").trim()) faltantes.push("estado_nuevo")
  if (te === "CAMBIO_ESTADO" && ficha?.estado_nuevo && !ESTADOS_VALIDOS.includes(String(ficha.estado_nuevo).trim()))
    faltantes.push("estado_nuevo_valido")
  if ((te === "COMENTARIO" || te === "ACTIVIDAD") && !String(ficha?.detalle_evento ?? "").trim())
    faltantes.push("detalle_evento")
  return faltantes
}
async function buscarCaso(estado, deps, ficha) {
  const token = await deps.obtenerToken(estado, deps)
  const idAveria = String(ficha?.id_averia ?? "").trim()
  const idPago = String(ficha?.id_pago ?? "").trim()
  const qs = idAveria ? `id_averia=${encodeURIComponent(idAveria)}` : `telefono=${encodeURIComponent(idPago)}`
  const r = await deps.fetch(`${estado.cfg.GGTO_API_URL}/api/v1/casos/buscar?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: deps.abortSignal(estado.cfg.TIMEOUT_MS || 30000),
  })
  if (!r.ok) { const e = new Error(`búsqueda GGTO respondió ${r.status}`); e.codigo = 503; throw e }
  const lista = await r.json()
  return Array.isArray(lista) && lista.length ? lista[0] : null
}
async function aplicarEvento(estado, deps, ficha, idCaso) {
  const token = await deps.obtenerToken(estado, deps)
  const cab = { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  const base = `${estado.cfg.GGTO_API_URL}/api/v1/casos`
  const det = String(ficha.detalle_evento ?? "").trim() || undefined
  let ruta, cuerpo
  if (ficha.tipo_evento === "COMENTARIO" || ficha.tipo_evento === "ACTIVIDAD") {
    ruta = `${base}/${idCaso}`; cuerpo = { ultimo_comentario: det }   // PATCH: no existe endpoint REST de actividad genérica
  } else if (ficha.tipo_evento === "CITA") {
    ruta = `${base}/${idCaso}/cita`; cuerpo = { fecha_hora: ficha.fecha_cita, observacion: det }
  } else {
    ruta = `${base}/${idCaso}/estado`; cuerpo = { estado_actual: String(ficha.estado_nuevo).trim(), motivo_estado: det }
  }
  const r = await deps.fetch(ruta, {
    method: ficha.tipo_evento === "COMENTARIO" || ficha.tipo_evento === "ACTIVIDAD" ? "PATCH" : "POST",
    headers: cab, body: JSON.stringify(cuerpo), signal: deps.abortSignal(estado.cfg.TIMEOUT_MS || 30000),
  })
  const j = await r.json().catch(() => ({}))
  if (r.ok)
    return { status: 200, body: { aplicado: true, tipo_evento: ficha.tipo_evento, id_caso: idCaso,
      resultado: j, nota: `Evento aplicado por el camino canónico (${ruta.split("/api/v1/")[1]})` } }
  return { status: r.status, body: { error: j.detail || `GGTO respondió ${r.status}`, canonico: true } }
}

// ---- C4: CONSULTAS de lectura (se resuelven en el mismo turno, nada se escribe) ----
function clasificarConsulta(ficha) {
  const texto = String(ficha?.consulta ?? "")
  const idPago = String(ficha?.id_pago ?? "").trim() || (texto.match(/\b70\d{8}\b/)?.[0] ?? "")
  const idAveria = String(ficha?.id_averia ?? "").trim() || (texto.match(/REF-[A-Z]+-\d+/i)?.[0] ?? "")
  if (idPago || idAveria) return "CASO"
  if (/\bfat\b/i.test(texto) || /\bsector\b/i.test(texto)) return "FAT"
  return "RESUMEN_DIA"
}
function resumenCaso(caso, conPII) {
  const g = (k) => (caso?.[k] ?? null)
  const base = { id_caso: g("id_caso"), id_averia: g("id_averia"), estado_actual: g("estado_actual"),
    tipo_caso: g("tipo_caso"), sector: g("sector_nombre"),
    fat: [g("olt"), g("slot"), g("puerto"), g("fat")].filter(Boolean).join("-") || null,
    fecha_reporte: g("fecha_reporte"), fecha_cita: g("fecha_cita"),
    ultimo_comentario: g("ultimo_comentario") }
  // PII solo en la ficha de un caso concreto; los listados y el resumen del día van sin PII
  return conPII ? { ...base, nombre_cliente: g("nombre_cliente"), direccion: g("direccion"),
    contacto_cliente: g("contacto_cliente") } : base
}
async function resolverConsulta(estado, deps, ficha) {
  const token = await deps.obtenerToken(estado, deps)
  const cab = { Authorization: `Bearer ${token}` }
  const base = `${estado.cfg.GGTO_API_URL}/api/v1`
  const tipo = clasificarConsulta(ficha)
  if (tipo === "CASO") {
    const texto = String(ficha?.consulta ?? "")
    ficha.id_pago = String(ficha?.id_pago ?? "").trim() || texto.match(/\b70\d{8}\b/)?.[0]
    ficha.id_averia = String(ficha?.id_averia ?? "").trim() || texto.match(/REF-[A-Z]+-\d+/i)?.[0]
    const caso = await deps.buscarCaso(estado, deps, ficha)
    if (!caso)
      return { tipo, encontrado: false,
        texto: `No encontré un caso con ${ficha.id_averia ? `id_averia ${ficha.id_averia}` : `identificador ${ficha.id_pago}`} en tu central.` }
    return { tipo, encontrado: true, resumen: resumenCaso(caso, true) }
  }
  if (tipo === "FAT") {
    const texto = String(ficha?.consulta ?? "")
    const termino = texto.match(/\bFAT\s*[:\-]?\s*([\w\-.]+)/i)?.[1]
      || texto.match(/\bsector\s*[:\-]?\s*([\w\-.]+)/i)?.[1] || texto.trim()
    const r = await deps.fetch(`${base}/casos/buscar?q=${encodeURIComponent(termino)}&limite=10`,
      { headers: cab, signal: deps.abortSignal(estado.cfg.TIMEOUT_MS || 30000) })
    if (!r.ok) { const e = new Error(`búsqueda GGTO respondió ${r.status}`); e.codigo = 503; throw e }
    const lista = await r.json()
    return { tipo, termino, total: Array.isArray(lista) ? lista.length : 0,
      casos: (Array.isArray(lista) ? lista : []).map((c) => resumenCaso(c, false)) }
  }
  // RESUMEN_DIA: agregados del monitoreo canónico (sin PII por diseño)
  const r = await deps.fetch(`${base}/monitoreo/diario`, {
    headers: cab, signal: deps.abortSignal(estado.cfg.TIMEOUT_MS || 30000) })
  if (!r.ok) { const e = new Error(`monitoreo GGTO respondió ${r.status}`); e.codigo = 503; throw e }
  return { tipo, resumen: await r.json() }
}

// ---- C4: historial de sesión en la PostgreSQL de GGTO (best-effort: si falla, el chat sigue) ----
async function registrarTurno(estado, deps, turno) {
  if (!estado.cfg.GGTO_USER || !estado.cfg.GGTO_PASS) return
  try {
    const token = await deps.obtenerToken(estado, deps)
    await deps.fetch(`${estado.cfg.GGTO_API_URL}/api/v1/asistente/sesiones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(turno), signal: deps.abortSignal(estado.cfg.TIMEOUT_MS || 30000),
    })
  } catch (e) { console.error("[sesion] no se pudo registrar el turno:", e.message) }
}

// ---- C5: TELEGRAM — webhook con secret_token fail-closed + vista previa/confirmar ----
const CONFIRMADORES = /^(confirmar|confirmo|si|sí|ok, confirma|aplicar)$/i
async function buscarRemitente(estado, deps, chatId) {
  const token = await deps.obtenerToken(estado, deps)
  const r = await deps.fetch(
    `${estado.cfg.GGTO_API_URL}/api/v1/asistente/remitentes?canal=TELEGRAM&chat_id=${encodeURIComponent(chatId)}&activo=true`,
    { headers: { Authorization: `Bearer ${token}` },
      signal: deps.abortSignal(estado.cfg.TIMEOUT_MS || 30000) })
  if (!r.ok) { const e = new Error(`remitentes GGTO respondió ${r.status}`); e.codigo = 503; throw e }
  const lista = await r.json()
  return Array.isArray(lista) && lista.length ? lista[0] : null
}
async function responderTelegram(estado, deps, chatId, texto) {
  const { TELEGRAM_API_URL, TELEGRAM_BOT_TOKEN, TIMEOUT_MS } = estado.cfg
  try {
    await deps.fetch(`${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
      signal: deps.abortSignal(TIMEOUT_MS || 30000),
    })
  } catch (e) { console.error("[telegram] no se pudo responder:", e.message) }
}
function textoDeRespuesta(respuesta) {
  if (!respuesta) return "⚠ No pude resolver la consulta."
  if (respuesta.error) return `⚠ ${respuesta.error}`
  const lineas = []
  if (respuesta.tipo === "CASO" && respuesta.resumen) {
    const s = respuesta.resumen
    for (const [k, v] of Object.entries({ Caso: s.id_averia, Estado: s.estado_actual, Tipo: s.tipo_caso,
      Sector: s.sector, FAT: s.fat, Cliente: s.nombre_cliente, Reporte: s.fecha_reporte,
      Cita: s.fecha_cita, "Último comentario": s.ultimo_comentario }))
      if (v) lineas.push(`${k}: ${v}`)
  } else if (respuesta.tipo === "CASO") lineas.push(respuesta.texto || "Caso no encontrado.")
  else if (respuesta.tipo === "FAT") {
    lineas.push(`Búsqueda «${respuesta.termino}»: ${respuesta.total} caso(s)`)
    for (const c of respuesta.casos || [])
      lineas.push(`· ${c.id_averia} · ${c.estado_actual} · sector ${c.sector || "-"} · FAT ${c.fat || "-"}`)
  } else lineas.push(JSON.stringify(respuesta.resumen ?? respuesta, null, 2))
  return lineas.join("\n")
}
function vistaPreviaTexto(body) {
  const f = body.ficha || {}
  const lineas = ["Vista previa — nada aplicado todavía:"]
  for (const [k, v] of Object.entries(f))
    if (v && k !== "intencion") lineas.push(`· ${k}: ${v}`)
  return lineas.join("\n")
}
async function procesarTelegram(estado, deps, update, secretoHeader) {
  const cfg = estado.cfg
  if (!cfg.TELEGRAM_SECRET || !cfg.TELEGRAM_BOT_TOKEN)
    return { status: 503, body: { atendido: false, error: "Webhook de Telegram no configurado" } }
  if (secretoHeader !== cfg.TELEGRAM_SECRET)
    return { status: 403, body: { atendido: false, error: "secret_token inválido" } }
  const mensaje = update?.message
  if (!mensaje?.text) return { status: 200, body: { atendido: false, motivo: "sin texto" } }
  const chatId = String(mensaje.chat?.id ?? "")
  if (!chatId) return { status: 200, body: { atendido: false, motivo: "sin chat_id" } }
  // canon v2-A5: los chats de Telegram comparten la tarifa global con el panel
  const tarifa = tarifaOk(estado, Date.now())
  if (!tarifa.ok) {
    await deps.responderTelegram(estado, deps, chatId, "⚠ Límite de uso alcanzado (canon v2-A5). Prueba más tarde.")
    return { status: 200, body: { atendido: false, motivo: tarifa.motivo } }
  }
  // solo remitentes activos autorizados por el SUPER (tabla asistente_remitente)
  let remitente = null
  try { remitente = await deps.buscarRemitente(estado, deps, chatId) }
  catch (e) { return { status: 503, body: { atendido: false, error: e.message } } }
  if (!remitente)
    return { status: 200, body: { atendido: false, motivo: "remitente no autorizado" } }
  const texto = String(mensaje.text).trim()
  // confirmación de la ficha pendiente (nada se aplica sin ella)
  const pendiente = estado.telegram?.pendientes?.get(chatId)
  if (pendiente && CONFIRMADORES.test(texto)) {
    estado.telegram.pendientes.delete(chatId)
    const r = await deps.confirmar(estado, deps, { ficha: pendiente })
    await deps.responderTelegram(estado, deps, chatId,
      r.status === 201 ? `✅ Caso creado: ${r.body.id_averia} (id ${r.body.id_caso})`
        : r.body.aplicado ? `✅ Evento aplicado al caso ${r.body.id_caso}`
        : `⚠ No se aplicó (${r.status}): ${r.body.error || ""}`)
    return { status: 200, body: { atendido: true, accion: "confirmado", status_interno: r.status, resultado: r.body } }
  }
  // flujo normal: CONSULTA se resuelve en el turno; ALTA/EVENTO queda pendiente de CONFIRMAR
  const r = await deps.procesar(estado, deps, texto, `TG-${chatId}`, { canal: "TELEGRAM", p00: remitente.p00 })
  if (r.status !== 200) {
    await deps.responderTelegram(estado, deps, chatId, `⚠ ${r.body.error || "Asistente no disponible"}`)
    return { status: 200, body: { atendido: true, accion: "error", status_interno: r.status } }
  }
  if (r.body.intencion === "CONSULTA") {
    await deps.responderTelegram(estado, deps, chatId, textoDeRespuesta(r.body.respuesta))
    return { status: 200, body: { atendido: true, accion: "consulta", consulta: r.body.consulta } }
  }
  estado.telegram.pendientes.set(chatId, r.body.ficha)
  await deps.responderTelegram(estado, deps, chatId,
    `${vistaPreviaTexto(r.body)}\n\nResponde CONFIRMAR para aplicar (otro mensaje descarta esta ficha).`)
  return { status: 200, body: { atendido: true, accion: "vista_previa", intencion: r.body.intencion } }
}

// ---- Estado por proceso (tarifa + límite diario) ----
function crearEstado(cfg) {
  return { cfg, minuto: { clave: null, conteo: 0 }, dia: { clave: null, conteo: 0 },
    telegram: { pendientes: new Map() } }   // C5: ficha pendiente de confirmar por chat
}
function claveVentana(t, unidad) {
  const d = new Date(t)
  if (unidad === "dia") return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`
}
// canon v2-A5: 30/min por IP (429) + tope diario (429). La IP por mensaje viene del servidor HTTP.
function tarifaOk(estado, ahora) {
  const cm = claveVentana(ahora, "min"), cd = claveVentana(ahora, "dia")
  if (estado.minuto.clave !== cm) estado.minuto = { clave: cm, conteo: 0 }
  if (estado.dia.clave !== cd) estado.dia = { clave: cd, conteo: 0 }
  estado.minuto.conteo += 1
  estado.dia.conteo += 1
  if (estado.minuto.conteo > estado.cfg.RATE_PER_MIN) return { ok: false, motivo: "rate" }
  if (estado.dia.conteo > estado.cfg.DAILY_LIMIT) return { ok: false, motivo: "dia" }
  return { ok: true }
}

// ---- Llamada al gateway (contrato del runbook Registro V2) ----
async function llamarGateway(deps, prompt) {
  const { GATEWAY_URL, GATEWAY_AUTH, MODEL, TIMEOUT_MS } = deps
  if (!GATEWAY_AUTH) { const e = new Error("gateway sin credencial (RS-2)"); e.codigo = 503; throw e }
  const r = await deps.fetch(`${GATEWAY_URL}/api/experimental/generate/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json",
               Authorization: `Basic ${Buffer.from(`opencode:${GATEWAY_AUTH}`).toString("base64")}` },
    body: JSON.stringify({ prompt, model: MODEL }),
    signal: deps.abortSignal(TIMEOUT_MS),
  })
  if (r.status === 429) { const e = new Error("plan del gateway agotado (429)"); e.codigo = 503; e.retry = r.headers.get("retry-after"); throw e }
  if (!r.ok) { const e = new Error(`gateway respondió ${r.status}`); e.codigo = 503; throw e }
  const j = await r.json()
  const texto = j?.data?.text
  if (typeof texto !== "string" || !texto.trim()) { const e = new Error("respuesta del gateway sin texto"); e.codigo = 502; throw e }
  return texto
}
const abortSignal = (ms) => AbortSignal.timeout(ms)

// ---- Parseo robusto de la respuesta (el gateway devuelve texto) ----
function parseRespuestaIA(texto) {
  if (!texto) return null
  let limpio = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  const i = limpio.indexOf("{"), f = limpio.lastIndexOf("}")
  if (i < 0 || f <= i) return null
  try {
    const j = JSON.parse(limpio.slice(i, f + 1))
    return (j && typeof j === "object" && typeof j.intencion === "string") ? j : null
  } catch { return null }
}
function construirPrompt(PROMPT, mensaje, correccion) {
  return correccion
    ? `${PROMPT}\n\nTu respuesta anterior NO fue un JSON válido. Responde de nuevo SOLO el JSON.\n\nTEXTO DEL USUARIO: ${mensaje}`
    : `${PROMPT}\n\nTEXTO DEL USUARIO: ${mensaje}`
}

// ---- Procesar un mensaje (C1: extraer y devolver ficha; NUNCA escribir) ----
async function procesarMensaje(estado, deps, mensaje, sesionId, meta) {
  const { GATEWAY_URL, GATEWAY_AUTH, MODEL, TIMEOUT_MS, PROMPT } = estado.cfg
  try {
    let texto = await deps.gateway({ GATEWAY_URL, GATEWAY_AUTH, MODEL, TIMEOUT_MS,
      fetch: deps.fetch, abortSignal: deps.abortSignal }, construirPrompt(PROMPT, mensaje, false))
    let ficha = deps.parse(texto)
    if (!ficha) { // reintento único con corrección (patrón propuesto en la v2.1)
      texto = await deps.gateway({ GATEWAY_URL, GATEWAY_AUTH, MODEL, TIMEOUT_MS,
        fetch: deps.fetch, abortSignal: deps.abortSignal }, construirPrompt(PROMPT, mensaje, true))
      ficha = deps.parse(texto)
    }
    if (!ficha) return { status: 502, body: { error: "La IA no devolvió una ficha válida", intencion: "DESCONOCIDO" } }
    // C1: el sistema NO escribe. La confirmación (C2) aplicará por los caminos canónicos de GGTO.
    // C4: las CONSULTAS se resuelven en el mismo turno (lectura, nada se escribe).
    let extra = {}
    if (ficha.intencion === "CONSULTA" && deps.resolverConsulta) {
      try {
        const resuelta = await deps.resolverConsulta(estado, deps, ficha)
        extra = { consulta: resuelta.tipo, respuesta: resuelta }
      } catch (e) {
        extra = { consulta: "ERROR", respuesta: { error: `No se pudo resolver la consulta: ${e.message}` } }
      }
    }
    // C4: historial del turno en GGTO (best-effort; su fallo no afecta el chat)
    if (deps.registrarTurno) {
      await deps.registrarTurno(estado, deps, {
        sesion_id: String(sesionId || `PANEL-${claveVentana(Date.now(), "dia")}`).slice(0, 64),
        canal: String(meta?.canal || "PANEL") === "TELEGRAM" ? "TELEGRAM" : "PANEL",
        p00: meta?.p00 || null,
        texto_entrada: String(mensaje || "").slice(0, 4000),
        intencion: ficha.intencion,
        detalle: String(ficha.tipo_evento || extra.consulta || "").slice(0, 60) || null,
        ficha_json: JSON.stringify(ficha).slice(0, 20000),
        respuesta: extra.respuesta ? JSON.stringify(extra.respuesta).slice(0, 20000) : null,
      })
    }
    return { status: 200, body: { intencion: ficha.intencion, ficha, confirmado: false, ...extra,
      nota: extra.respuesta ? "Vista previa — consulta de lectura, nada se ha modificado"
        : "Vista previa — nada se ha creado todavía" } }
  } catch (e) {
    if (e.codigo === 503 || e.codigo === 502) return { status: e.codigo, body: { error: `Asistente no disponible: ${e.message}` } }
    return { status: 503, body: { error: `Asistente no disponible: ${e.message}` } }
  }
}

// ---- Uso/cuota (canon v2-A5: Mongo assistant_usage; opcional en C1) ----
async function registrarUso(estado, now) {
  if (!estado.cfg.MONGO_URL) return
  try {
    const { MongoClient } = require("mongodb")
    const c = await MongoClient.connect(estado.cfg.MONGO_URL, { serverSelectionTimeoutMS: 8000 })
    const col = c.db(estado.cfg.MONGO_DB).collection("assistant_usage")
    await col.updateOne({ fecha: claveVentana(now, "dia") }, { $inc: { chats: 1, tokens_est: 1 } }, { upsert: true })
    await c.close()
  } catch (e) { console.error("[uso] no se pudo registrar:", e.message) }
}
async function obtenerUso(estado) {
  if (!estado.cfg.MONGO_URL) return { fecha: claveVentana(Date.now(), "dia"), chats: estado.dia.conteo, tokens_est: null, mongo: false }
  try {
    const { MongoClient } = require("mongodb")
    const c = await MongoClient.connect(estado.cfg.MONGO_URL, { serverSelectionTimeoutMS: 8000 })
    const u = await c.db(estado.cfg.MONGO_DB).collection("assistant_usage").findOne({ fecha: claveVentana(Date.now(), "dia") })
    await c.close()
    return { fecha: claveVentana(Date.now(), "dia"), chats: u?.chats ?? 0, tokens_est: u?.tokens_est ?? 0, mongo: true }
  } catch { return { fecha: claveVentana(Date.now(), "dia"), chats: estado.dia.conteo, tokens_est: null, mongo: false } }
}

// ---- Servidor HTTP (canon: /health, /, /api/chat, /api/usage) ----
function crearServidor(estado, deps) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost")
    const enviar = (codigo, cuerpo) => { res.writeHead(codigo, { "Content-Type": "application/json" }); res.end(JSON.stringify(cuerpo)) }
    if (url.pathname === "/health") {
      return enviar(200, { status: "ok", app: estado.cfg.PROJECT,
        gateway: estado.cfg.GATEWAY_AUTH ? "configurado" : "no-configurado",
        modelo: `${estado.cfg.MODEL.providerID}/${estado.cfg.MODEL.id}`,
        ggto_api: estado.cfg.GGTO_API_URL,
        telegram: estado.cfg.TELEGRAM_SECRET && estado.cfg.TELEGRAM_BOT_TOKEN ? "configurado" : "no-configurado" })
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(deps.indexHtml); return
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      let cuerpo = ""
      req.on("data", (c) => { cuerpo += c })
      req.on("end", async () => {
        // canon v2-A5: la tarifa se evalúa con el cuerpo ya consumido (evita cuerpos
        // sobrantes en la conexión keep-alive al responder 429).
        const tarifa = tarifaOk(estado, Date.now())
        if (!tarifa.ok) {
          const motivo = estado.minuto.conteo > estado.cfg.RATE_PER_MIN ? "rate" : "dia"
          return enviar(429, { error: "Límite de uso alcanzado (canon v2-A5)", motivo })
        }
        let mensaje = "", sesionId = ""
        try {
          const d = JSON.parse(cuerpo || "{}")
          mensaje = (d.message || "").trim()
          sesionId = String(d.sesion_id || "").slice(0, 64)
        } catch { return enviar(400, { error: "JSON inválido" }) }
        if (!mensaje) return enviar(400, { error: "El mensaje es obligatorio" })
        const r = await deps.procesar(estado, deps, mensaje, sesionId)
        await registrarUso(estado, Date.now())
        enviar(r.status, r.body)
      })
      return
    }
    if (req.method === "GET" && url.pathname === "/api/usage") return enviar(200, await obtenerUso(estado))
    if (req.method === "POST" && url.pathname === "/telegram") {
      // canon C5: fail-closed — el cuerpo SIEMPRE se drena antes de responder (keep-alive)
      if (!deps.procesarTelegram) return enviar(503, { error: "Telegram llega en C5 (no configurado en este despliegue)" })
      let cuerpo = ""
      req.on("data", (c) => { cuerpo += c })
      req.on("end", async () => {
        let update = {}
        try { update = JSON.parse(cuerpo || "{}") } catch { update = {} }
        const r = await deps.procesarTelegram(estado, deps, update, req.headers["x-telegram-bot-api-secret-token"])
        enviar(r.status, r.body)
      })
      return
    }
    if (req.method === "POST" && url.pathname === "/api/confirmar") {
      if (!deps.confirmar) return enviar(501, { error: "La confirmación de acciones llega en C2 (nada se escribe todavía)" })
      let cuerpo = ""
      req.on("data", (c) => { cuerpo += c })
      req.on("end", async () => {
        let datos = {}
        try { datos = JSON.parse(cuerpo || "{}") } catch { return enviar(400, { error: "JSON inválido" }) }
        const r = await deps.confirmar(estado, deps, datos)
        enviar(r.status, r.body)
      })
      return
    }
    enviar(404, { error: "No encontrado" })
  })
}

// ---- Arranque (solo cuando corre como proceso principal) ----
const INDEX_HTML = (() => { try { return require("fs").readFileSync(require("path").join(__dirname, "index.html"), "utf8") } catch { return "<h1>asistente-ggto</h1>" } })()
const depsPorDefecto = { fetch: (u, o) => fetch(u, o), abortSignal, parse: parseRespuestaIA, gateway: llamarGateway, indexHtml: INDEX_HTML, procesar: procesarMensaje }
if (require.main === module) {
  const cfg = { GATEWAY_URL, GATEWAY_AUTH, MODEL, GGTO_API_URL, PROJECT, PROMPT: PROMPT_GGTO, RATE_PER_MIN, DAILY_LIMIT, MONGO_URL, MONGO_DB, TIMEOUT_MS, GGTO_USER, GGTO_PASS, TELEGRAM_API_URL, TELEGRAM_SECRET, TELEGRAM_BOT_TOKEN }
  const estado = crearEstado(cfg)
  const depsCompletos = { ...depsPorDefecto, obtenerToken, confirmar: confirmarAccion, mapear: mapearAlta, buscarCaso, aplicarEvento, resolverConsulta, registrarTurno, procesarTelegram, buscarRemitente, responderTelegram }
  crearServidor(estado, depsCompletos).listen(PUERTO, () =>
    console.log(`asistente-${PROJECT} escuchando en :${PUERTO} (gateway ${estado.cfg.GATEWAY_AUTH ? "configurado" : "SIN CREDENCIAL"})`))
}

module.exports = { PROMPT_GGTO, crearEstado, tarifaOk, llamarGateway, parseRespuestaIA, construirPrompt, procesarMensaje, crearServidor, claveVentana, obtenerToken, validarFichaAlta, mapearAlta, confirmarAccion, expiracionJwt, validarFichaEvento, buscarCaso, aplicarEvento, clasificarConsulta, resumenCaso, resolverConsulta, registrarTurno, procesarTelegram, buscarRemitente, responderTelegram, textoDeRespuesta, vistaPreviaTexto }
