# Incremento — Asistente virtual de gestión por texto libre (Propuesta v2)

| Campo | Valor |
|---|---|
| Fecha | 2026-11-10 (v2.1 — sustituye la v1 del mismo día por orden del usuario: «cambia el cliente de IA» + análisis de la carpeta `RepoTecnico/Asistente/`) |
| Estado | **PROPUESTA — pendiente de aprobación para codificar** (numeración de ciclo D-169… por asignar) |
| Origen | Petición del usuario: «asistente virtual para agregar casos o eventos de forma manual: introduce texto libre y el asistente entiende y realiza la solicitud usando la API» |
| Norma | **`RepoTecnico/Asistente/`** — `MANUAL_ASISTENTES_V2.md` (plantilla y gateway) + `03_credenciales.md` (REF-SEC) + `04_runbook.md` (alta estandarizada, canon v2-A5, dominios) |
| IA | **Gateway LLM OpenCode** interno (`http://100.125.94.21:4090`, vm-dsh-dev) — contrato exacto del runbook: `POST /api/experimental/generate/text` con `Authorization: Basic base64("opencode:" + REF-SEC-26)` y cuerpo `{"prompt":"…","model":{"id":"claude-haiku-5-5","providerID":"opencode-go"}}` → `{"data":{"text":"…"}}`; endpoint completo en `/openapi.json`; modelo oficial del dueño **`claude-haiku-5-5`** (suscripción OpenCode Go, REF-SEC-27, solo el gateway la conoce) |
| Canales | App-asistente (`asistente-ggto`) con panel de chat + **Telegram** (WhatsApp → ciclo posterior, cuenta Meta Business) |
| Roles | **SUPER + ADMIN + SUPERVISOR** (los mismos de la alta manual hoy) |
| Acciones | **Altas de casos + eventos sobre casos + consultas** — todas con **vista previa + confirmación humana** |

> **Cambios v1 → v2.1:** el cliente IA deja de ser Vertex AI Gemini (GCP) y pasa a ser el **gateway OpenCode**
> corporativo con `claude-haiku-5-5` — sin `roles/aiplatform.user`, sin IAM de GCP, sin `gemini-2.5-flash`.
> Consecuencia de topología (el gateway vive en la **tailnet**, Cloud Run no la alcanza): el asistente ya no
> vive dentro del backend FastAPI de GGTO, sino como **app aparte `asistente-ggto`** creada con el **script
> estandarizado de alta** (`sudo /usr/local/bin/alta_asistente.sh ggto`, puerto correlativo 3002–3019 — el
> 3002 lo ocupa la demo `asistente-hotel`), que conversa con el gateway y actúa contra la **API pública de
> GGTO** con un **usuario de servicio dedicado**. La app hereda el **canon v2-A5** ya vigente en las apps de
> la plataforma (rate-limit 30/min por IP, tope diario de chats, registro de uso y 429 con `retryAfterMs`
> cuando se agota OpenCode Go). El historial de conversación se guarda en la **PostgreSQL de GGTO** (no en
> la MongoDB del manual) por decisión del usuario; el registro de uso sigue el canon (Mongo `proj_ggto`).

---

## 1 · Requerimientos del incremento

| ID | Requisito funcional | Descripción |
|---|---|---|
| RF-AV-01 | Interpretar texto libre | `asistente-ggto` envía el texto (con el system-prompt del proyecto GGTO y el catálogo de intenciones) al gateway OpenCode y determina la **intención**: `ALTA_CASO`, `EVENTO`, `CONSULTA` o `DESCONOCIDO`. |
| RF-AV-02 | Extraer datos estructurados | De un texto de alta extrae: `tipo_reporte` (REPARACION/CONSTRUCCION/MANTENIMIENTO), `id_pago` (70\*), `nombre_cliente`, `contacto_cliente`, `direccion`, `tipo_problema` (REPARACION), y los opcionales que aparezcan (`telefono`, `informacion`, `problema_reporte`, `persona_reporta`, `fecha_cita`, `categoria`, `tipo_servicio`). |
| RF-AV-03 | Vista previa editable | El asistente presenta la **ficha extraída** para revisar/editar; **nada se escribe sin confirmación explícita** del usuario. |
| RF-AV-04 | Alta por el camino canónico | Al confirmar, la app-asistente crea el caso vía `POST /api/v1/casos` de GGTO (`CasoManualCreate`): `REF-…` generado por el servidor (D-145), clasificador de pago (D-89), bitácora estándar, atribuido al **usuario de servicio** con su bitácora normal. |
| RF-AV-05 | Eventos sobre casos | 4 tipos de evento sobre un caso existente (identificado por 70\* o id de avería): (a) **actividad/reporte de gestión**, (b) **comentario** (`ultimo_comentario`), (c) **cita** (`fecha_cita`), (d) **cambio de estado** por el camino canónico D-120 con motivo y bitácora en `caso_estado_hist`. |
| RF-AV-06 | Consultas de lectura | 3 tipos de consulta contra la API de GGTO: (a) estado/resumen de un caso por 70\* o id de avería, (b) casos abiertos por tupla FAT/OLT/slot/puerto (D-168) o por sector/estado, (c) resumen del día (abiertos, despacho, masivas activas — conteos sin PII). |
| RF-AV-07 | Panel de chat | Ventana de chat servida por `asistente-ggto` (patrón del manual, `index.html`) accesible a SUPER/ADMIN/SUPERVISOR con credencial de GGTO; también embebible desde la web CASOS. |
| RF-AV-08 | Canal Telegram | El mismo asistente responde por el bot de Telegram vía webhook público de `asistente-ggto` (validación `secret_token`, patrón fail-closed D-149), **solo** para remitentes autorizados. |
| RF-AV-09 | Remitentes autorizados | Tabla `asistente_remitente` en la BD de GGTO (chat/teléfono ↔ usuario con sus roles); remitente no autorizado → rechazo genérico sin datos. La registra el SUPER. |
| RF-AV-10 | Historial de sesión | Cada conversación guarda su historial en la BD de GGTO (tabla `asistente_sesion`) por los endpoints de sesión de GGTO; retención bajo la política D-153. |

## 2 · Restricciones del sistema (EARS)

| ID | Restricción (EARS) |
|---|---|
| RNF-AV-01 | **Si** el gateway OpenCode no está configurado, su credencial (REF-SEC-26) no existe o la llamada falla, **entonces** `asistente-ggto` responderá **503 fail-closed** (patrón D-149) y **no** escribirá nada en GGTO. |
| RNF-AV-02 | **Cuando** el usuario confirma una ficha, **entonces** la app-asistente ejecutará la acción **exclusivamente** por los caminos canónicos de la API de GGTO (`POST /casos`, actividad, cita, `POST /casos/{id}/estado` D-120) — nunca SQL directo ni endpoints paralelos. |
| RNF-AV-03 | **Mientras** exista una ficha extraída sin confirmar, el sistema no habrá escrito nada en la base de GGTO. |
| RNF-AV-04 | De acuerdo con RS-2 del manual y el registro REF-SEC de `Asistente/03_credenciales.md`: la credencial del gateway es el secreto existente **`opcode-gateway-api-key` (REF-SEC-26)** y la de OpenCode Go (`REF-SEC-27`) queda **solo en el gateway**; la contraseña del usuario de servicio GGTO y la del usuario Mongo `proj_ggto` van a Secret Manager / docker secrets root-only. **Nada de secretos en `.env` de repos ni en el código**; auditoría anti-env del runbook aplica. |
| RNF-AV-05 | **Si** el remitente de chat no está en `asistente_remitente`, **entonces** la app responderá un mensaje genérico sin datos del sistema. |
| RNF-AV-06 | **Si** la extracción no reúne los obligatorios del caso (70\*, nombre, contacto, dirección; tipo_problema en REPARACION), **entonces** la ficha se marcará «faltan datos» y la confirmación quedará deshabilitada hasta completarlos a mano. |
| RNF-AV-07 | **De acuerdo con** el recinto de seguridad de GGTO: el usuario de servicio del asistente tendrá exactamente los roles acordados (SUPER/ADMIN/SUPERVISOR) y ninguna consulta de la app excederá lo que ese rol ve por API. |
| RNF-AV-08 | La app-asistente registra cada intento (intención, canal, usuario, resultado) en la BD de GGTO sin volcar el texto completo con PII (hash o referencia del mensaje). |
| RNF-AV-09 | Presupuesto (canon v2-A5 del runbook): rate-limit **30/min por IP** (429), tope diario **500 chats/día** (429, ajustable por env), uso registrado (chats y tokens estimados chars/4) y **429 con `retryAfterMs` cuando OpenCode Go agota el plan** — el asistente muestra el error claro y nunca reintenta en bucle; un solo llamado al gateway por mensaje con historial compactado y timeout corto. |
| RNF-AV-10 | PII: el texto de los abonados **viaja por la tailnet** hacia el gateway (Anthropic `claude-haiku-5-5` vía suscripción `opencode-go`) y las respuestas vuelven por la app. La pierna interna es privada (tailnet); la pierna pública (web/Telegram) exige verificación de credencial. Riesgo conocido, aceptado por el usuario; residual para revisión legal con el cliente. |
| RNF-AV-11 | Aislamiento (manual §6): `asistente-ggto` **no público por defecto** (binding a la IP Tailscale de vm-preview); lo que se exponga (webhook de Telegram, panel remoto) lleva su verificación específica y de ahí en adelante trata toda entrada como no confiable. |

## 3 · Casos de uso (criterios de aceptación Gherkin)

### CU-AV-01 · Alta manual de caso por texto (SUPER/ADMIN/SUPERVISOR)

```
Dado un usuario autorizado (panel con credencial GGTO o remitente de Telegram registrado)
Cuando escribe texto libre tipo alta («casa de juan pérez, sin señal, pago 7012345678,
     llamar al 0414…, urb x»)
Entonces la app-asistente identifica la intención ALTA_CASO y el tipo_reporte
Y muestra la ficha extraída editable (pago 70*, nombre, contacto, dirección, problema)
Y no crea ningún caso mientras no se confirme
Cuando el usuario confirma la ficha completa
Entonces la app crea el caso por POST /api/v1/casos de GGTO con REF-… del servidor
Y la respuesta muestra id de caso, cola de despacho estándar y bitácora del usuario de servicio
```
**Pero** (alternos): falta un obligatorio → ficha «faltan datos», confirmación deshabilitada
(RNF-AV-06); gateway caído o sin credencial → 503 y mensaje de no disponible, sin escritura (RNF-AV-01).

### CU-AV-02 · Evento sobre un caso existente (actividad/comentario/cita/estado)

```
Dado un caso existente identificado por 70* o id de avería
Cuando el usuario describe el evento en texto libre («cita para el 7012345678
     el jueves 9 am», «cambiar el 7012345678 a ENRUTADO por pasar a CRASS»)
Entonces la app-asistente identifica el caso, el tipo de evento y los datos
Y muestra la vista previa del evento
Cuando el usuario confirma
Entonces el evento se aplica por el camino canónico de GGTO correspondiente
  — actividad: reporte de gestión estándar
  — comentario: ultimo_comentario
  — cita: fecha_cita del caso (entra al flujo de citas del despacho)
  — estado: POST /casos/{id}/estado con motivo y bitácora en caso_estado_hist (D-120)
Y la respuesta confirma con el id del caso y el evento aplicado
```
**Pero**: 70\*/avería inexistente → «caso no encontrado», sin crear nada; rechazo canónico
(409/422) → la app devuelve el error del camino de GGTO, no uno nuevo.

### CU-AV-03 · Consulta de lectura

```
Dado un usuario con rol autorizado
Cuando consulta («estado del 7012345678», «casos abiertos del FAT … en pde-olt-01»,
     «resumen del día»)
Entonces la app-asistente responde con datos de lectura de la API de GGTO
Y el alcance respeta los permisos del usuario de servicio (RNF-AV-07)
```
**Pero**: consulta ambigua → pide precisión; resumen del día sin PII (conteos).

### CU-AV-04 · Registro de remitente de chat (SUPER)

```
Dado un SUPER
Cuando registra un chat de Telegram con el usuario del sistema asociado
Entonces ese remitente puede usar el asistente con los roles de su usuario
Y un remitente no registrado que escriba al bot recibe un mensaje genérico sin datos (RNF-AV-05)
```

### CU-AV-05 · Gateway no disponible (restricción, EARS)

```
Si el gateway OpenCode no está configurado, su credencial no existe o la llamada falla,
entonces asistente-ggto responderá 503, no escribirá nada en GGTO y lo anunciará
al usuario (panel y chat), dejando evidencia en el registro de intentos.
```

**Trazabilidad:** RF-AV-01…04 ↔ CU-AV-01 · RF-AV-05 ↔ CU-AV-02 · RF-AV-06 ↔ CU-AV-03 ·
RF-AV-08/09 ↔ CU-AV-04 · RF-AV-10 transversal · RNF-AV-01…11 transversales.
Todos los criterios son testeables (contrato HTTP de la app, estado de BD de GGTO, mensajes del bot).

## 4 · Arquitectura (v2 — topología del manual)

```
Panel web / Telegram  ──►  asistente-ggto (Node.js, vm-preview 100.113.94.52, docker-compose/Coolify)
                             ├─► Gateway OpenCode (vm-dsh-dev 100.125.94.21:4090)  ← claude-haiku-5-5
                             │     POST /api/experimental/generate/text (Basic, REF-SEC-26)
                             └─► API pública de GGTO (Cloud Run, JWT del usuario de servicio)
                                   · POST /casos (alta), actividades, cita, estado D-120
                                   · GET casos/buscar (D-167), resumen
                                   · /asistente/sesiones (historial → PostgreSQL de GGTO)
                                   · /asistente/remitentes (SUPER)
```

| Pieza | Dónde | Detalle |
|---|---|---|
| **App-asistente** | `asistente-ggto` — **alta estandarizada**: `sudo /usr/local/bin/alta_asistente.sh ggto [puerto]` (correlativo **3002–3019**; 3002 ocupado por la demo `asistente-hotel`) | Node.js 22 con el `server.js` **canónico v2-A5** (rate-limit 30/min, tope diario, uso en Mongo, `GET /api/usage`); `/health`, panel de chat, `POST /api/chat` (intención+extracción+vista previa), `POST /api/confirmar` (ejecuta contra GGTO), webhook Telegram |
| **Gateway** | vm-dsh-dev `:4090` — el único que toca proveedores | Credencial REF-SEC-26 `opcode-gateway-api-key`; `MODEL_ID=claude-haiku-5-5`, `MODEL_PROVIDER=opencode-go`; verificación de modelos disponible con `opencode models \| grep claude` y contrato completo en `http://100.125.94.21:4090/openapi.json`; cambio de modelo solo por env del contenedor (§7 del manual) |
| **Extracción** | system-prompt de GGTO + respuesta JSON | El endpoint devuelve **texto** (`{"data":{"text":…}}`): el prompt exige JSON único y la app lo valida/parsea con reintento; patrones locales de respaldo para 70\*/teléfonos/fechas |
| **Credencial GGTO** | Usuario de servicio dedicado (roles acordados) | Contraseña en Secret Manager; la app obtiene y **renueva el JWT** de la API de GGTO; todo queda atribuido a ese usuario con bitácora normal |
| **Historial** | **PostgreSQL de GGTO** — tabla `asistente_sesion` + endpoints de sesión (migración idempotente patrón D-166/D-168) | Decisión del usuario; retención bajo la política D-153 |
| **Uso/cuota** | Canon v2-A5: Mongo `assistant_usage` en BD dedicada `proj_ggto` (usuario `proj_ggto` readWrite solo su BD, per §5 de credenciales) | `GET /api/usage` para el panel de consumo |
| **Remitentes** | Tabla `asistente_remitente` (migración idempotente) | Alta por SUPER; el servicio valida canal+chat→usuario y sus roles |
| **GGTO backend** | Cambios **mínimos**: 2 tablas + ~4 endpoints (sesiones, remitentes) + nada de IA dentro de Cloud Run | La lógica de IA vive toda en `asistente-ggto` |
| **Despliegue** | vm-preview por el script de alta (patrón V2-A2 del runbook) — dominio tailnet-only `http://100.113.94.52:<puerto>` (sslip `https://ggto.100.113.94.52.sslip.io` **solo resuelve en tailnet**) | Registro del puerto/proyecto en el runbook §3; **checklist §9 del manual** obligatorio; recursos 1 CPU/1 GB vía UI de Coolify (la API no acepta limits) |

## 5 · Plan de ciclos (entregable = funcional + probado)

1. **C1 — App-asistente núcleo:** alta con `sudo /usr/local/bin/alta_asistente.sh ggto` (puerto libre del rango 3002–3019) + adaptación del `server.js` canónico v2-A5: conexión al gateway con REF-SEC-26 (contrato del runbook, respuesta `{"data":{"text":…}}`), system-prompt GGTO, intención+extracción JSON, `/health`, panel básico; pruebas con gateway real y con simulacro; fail-closed 503.
2. **C2 — Altas contra GGTO:** usuario de servicio (alta en GGTO + contraseña a Secret Manager) + `POST /api/confirmar` para ALTA_CASO vía `CasoManualCreate` (D-145/D-89 intactos) + pruebas end-to-end texto→ficha→caso creado.
3. **C3 — Eventos:** los 4 tipos (actividad, comentario, cita, estado D-120) + pruebas (caso no encontrado, rechazo canónico, idempotencia).
4. **C4 — Consultas + historial:** las 3 consultas de lectura + tabla `asistente_sesion` (migración idempotente) + endpoints de sesión de GGTO + pruebas de recinto/permisos y resumen sin PII. El registro de uso queda en el canon v2-A5 (Mongo `proj_ggto`, usuario dedicado readWrite solo su BD).
5. **C5 — Telegram:** tabla `asistente_remitente` (migración idempotente) + alta por SUPER + webhook público de `asistente-ggto` (secret_token, fail-closed) + token del bot en Secret Manager + pruebas del flujo de chat.
6. **C6 — Panel final + despliegue + checklist:** panel completo (ficha editable), despliegue definitivo en vm-preview con docker secrets (RS-2, auditoría anti-env), recursos 1 CPU/1 GB por UI, **checklist §9 del manual** completo, verificación en vivo (tailnet y, si aplica, dominio público) y bitácora en `estado_proyecto.md` + registro del puerto en el runbook §3.

**Sin codificar hasta tu orden.** Al aprobar, arranca C1 y se reporta por ciclo (convención del proyecto).

## 6 · Riesgos y decisiones abiertas

1. **PII hacia Anthropic vía gateway** (RNF-AV-10): la pierna interna es tailnet-privada; el texto sale igualmente del perímetro hacia el proveedor del gateway. Residual legal a revisar con el cliente.
2. **Exposición pública mínima**: por defecto la app es **tailnet-only** (sslip `100.x` no resuelve público). El webhook de Telegram exige URL pública — decisión de C5 (exponer el asistente con protección específica o proxy). El panel web para usuarios de la central (fuera de la tailnet) tiene la misma limitación: mientras no haya URL pública, el panel solo sirve a usuarios conectados a la tailnet.
3. **Respuesta del gateway es texto**: la extracción estructurada depende de prompt + parseo robusto con reintento (mitigado además por la confirmación humana).
4. **Extracción imperfecta**: nombres/direcciones mal leídos — mitigación principal: vista previa editable + confirmación (no existe «crear directo»).
5. **Plan de OpenCode Go**: al agotarse, el gateway responde 429 con `retryAfterMs` (canon v2-A5) — el asistente lo comunica y no reintenta en bucle; el tope diario por env evita agotarlo por accidente.
6. **WhatsApp**: requiere cuenta Meta Business — ciclo posterior explícito.
7. **Numeración**: `AV`/`RF-AV` provisional; al implementar se asigna D-169… y las tablas `asistente_sesion`/`asistente_remitente` entran al diccionario de datos.
