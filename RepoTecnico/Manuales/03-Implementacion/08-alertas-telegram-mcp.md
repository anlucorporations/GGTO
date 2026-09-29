# Manual técnico — Alertas, Telegram y MCP (GGTO, Ciclo 9)

> Documentación técnica fiel al código real del proyecto **GGTO — CANTV C.A., Central
> Francisco Salias (Área 4)**. Cada afirmación relevante se respalda con una referencia
> `ruta:línea`. Lo que no es verificable en el repositorio se marca como
> **"pendiente de confirmar"**.

## Visión general

### Alcance funcional y requerimientos

El Ciclo 9 agrupa las alertas, el bot de Telegram y el servidor MCP. El docstring del
router enumera su alcance: «ALERTAS, Telegram y MCP — RF-06, RF-09, RF-16, RF-17, RF-18 /
RNF-19, RNF-20» (`app/api/routes_alertas.py:1`).

| Requerimiento | Contenido resumido | Referencia |
|---|---|---|
| RF-06 | Gestionar ingesta/asignación de casos especiales vía Telegram o IA (WEB-MCP) | `RepoTecnico/requerimientos.md:95` |
| RF-09 | Gestionar fallas masivas: detección automática por concentración tras la ingesta + reporte manual; asignación por proximidad de sector | `RepoTecnico/requerimientos.md:98` |
| RF-16 | Alertar casos de falla masiva por Telegram o WEB-MCP | `RepoTecnico/requerimientos.md:110` |
| RF-17 | Documentar la planificación de atención (reporte simple + evidencias fotográficas) | `RepoTecnico/requerimientos.md:111` |
| RF-18 | Preparar la solicitud de material según el caso | `RepoTecnico/requerimientos.md:112` |
| RNF-19 | Observabilidad: métricas de negocio, notificaciones fallidas, `/health` y `/ready` | `RepoTecnico/requerimientos.md:198` |
| RNF-20 | Fiabilidad: patrón *outbox* con reintentos exponenciales y estado terminal; correo como respaldo de Telegram | `RepoTecnico/requerimientos.md:199` |

La decisión **D-19** fijó la detección automática por concentración más el reporte manual
por MCP/Telegram, con asignación por proximidad de sector
(`RepoTecnico/estado_proyecto.md:83`). El umbral quedó como parámetro configurable, a
definir en la Fase 3 junto con las métricas (D-31, `RepoTecnico/estado_proyecto.md:95`).
El cierre del ciclo se registra en **D-60**, que lo da por completado con detección
idempotente, reporte manual, planificación, material, outbox con backoff, bot de Telegram
(`/ayuda`, `/estado`, `/caso`, `/falla`), servidor MCP JSON-RPC y `/metricas`
(`RepoTecnico/estado_proyecto.md:124`).

### Componentes implicados

| Capa | Archivo | Responsabilidad |
|---|---|---|
| API | `app/api/routes_alertas.py` | 11 operaciones: fallas, outbox, webhook de Telegram, MCP y métricas |
| Servicio de fallas | `app/services/fallas.py` | Detección por concentración, cuadrilla cercana y alerta |
| Outbox | `app/services/outbox.py` | Encolado, procesamiento con backoff y métricas del outbox |
| Canales | `app/services/notificaciones.py` | Envío por Telegram y correo (SMTP) |
| Esquemas | `app/schemas/alertas.py` | Contratos Pydantic del ciclo |
| Modelos | `app/models/despacho_entities.py` | Tablas `notificacion` y `falla_masiva` |
| Cliente web | `app/web/src/api/client.ts` | Funciones de fallas, outbox y métricas (`app/web/src/api/client.ts:823-886`) |
| Página web | `app/web/src/pages/Alertas.tsx` | Página ALERTAS (ruta `/alertas`, `app/web/src/App.tsx:35`) |

El router se registra con prefijo `/api/v1` y etiqueta
`"alertas, telegram y mcp"` (`app/api/routes_alertas.py:30`; montaje en
`app/main.py:85`). El rol de escritura se define una sola vez:
`_escritura = require_roles("ADMIN", "SUPERVISOR")`
(`app/api/routes_alertas.py:31`). La versión que anuncia el servidor MCP es la constante
`MCP_VERSION = "0.1.0"` (`app/api/routes_alertas.py:32`).

## Fallas masivas

### Detección por concentración (agrupador olt/fat/id_sector)

El servicio de fallas documenta su propósito como «detección automática por concentración
(RF-09 / D-31)» (`app/services/fallas.py:1`) y solo admite tres campos agrupadores:
`CAMPOS_VALIDOS = ("olt", "fat", "id_sector")` (`app/services/fallas.py:14`).

`detectar` lee la configuración y construye el grupo
(`app/services/fallas.py:53-77`):

| Paso | Comportamiento | Referencia |
|---|---|---|
| Interruptor | Si `fallas.activo` es `false`/`0`/`no`, devuelve lista vacía | `app/services/fallas.py:55-57` |
| Umbral | `fallas.umbral_casos`, por defecto 5 | `app/services/fallas.py:59`, `:15` |
| Ventana | `fallas.ventana_horas`, por defecto 24 | `app/services/fallas.py:60`, `:16` |
| Campo | `fallas.campo_concentracion`; si no es válido, cae a `olt` | `app/services/fallas.py:61-63` |
| Filtro | Casos de la central, no `CERRADO`/`CANCELADO`, creados desde `ahora - horas`, con el campo no nulo | `app/services/fallas.py:69-74` |
| Agrupación | `group_by(columna)` con `having count() >= umbral` | `app/services/fallas.py:75-76` |

Para cada grupo, la descripción generada es
`"Concentración de {total} casos en {campo} {valor} (últimas {horas} h)"`, el origen es
`AUTOMATICA` y el estado inicial `DETECTADA` (`app/services/fallas.py:100-108`). Si el
campo es `id_sector`, el sector de la falla se toma del propio valor; en los demás casos
se busca un caso del grupo con `id_sector` no nulo (`app/services/fallas.py:92-99`).

#### Cuadrilla asignada por proximidad

`cuadrilla_cercana` primero lista las cuadrillas activas de calle
(`es_supervisor = false`, `app/services/fallas.py:28-34`). Si se indica un sector, cuenta
los casos por cuadrilla en ese sector vía `despacho_caso` y elige la de mayor conteo
(`app/services/fallas.py:37-49`). Si no hay datos del sector, elige la cuadrilla de código
menor (`app/services/fallas.py:50`). La prueba de contrato funcional de fallas se apoya en
esta asignación (`app/tests/test_alertas_api.py:36-44`).

#### Cuándo se ejecuta

La detección se dispara automáticamente al terminar una carga CSV: el router de ingesta
importa el servicio (`app/api/routes_ingesta.py:15`) y, tras confirmar el lote, llama a
`fallas.detectar(db, central.id_central)`, agregando el conteo `fallas_masivas` al resumen
(`app/api/routes_ingesta.py:162-166`). También puede forzarse bajo demanda con
`POST /api/v1/fallas-masivas/detectar` (`app/api/routes_alertas.py:90-101`).

### Idempotencia por clave_concentracion

La clave se compone como `f"{campo}:{valor}"` truncada a 120 caracteres
(`app/services/fallas.py:81`), longitud que coincide con la columna
`clave_concentracion: String(120)` (`app/models/despacho_entities.py:90`). Antes de crear
una falla, el servicio busca otra de la misma central, con la misma clave y estado
`DETECTADA` o `PLANIFICADA`; si existe, la omite (`app/services/fallas.py:82-90`).

Esto garantiza que, mientras la falla siga activa, una nueva detección no la duplica. La
prueba `test_deteccion_por_concentracion` verifica la clave `olt:pde-olt-99` y que una
segunda detección devuelve lista vacía (`app/tests/test_alertas_api.py:36-51`).
`RepoTecnico/entornos_globales.md:204-206` documenta la misma regla con el ejemplo
`olt:pde-olt-00`.

### Umbral (configuración)

Los parámetros viven en la tabla `configuracion` (JSONB), no en variables de entorno
(`RepoTecnico/entornos_globales.md:189-191`). Todos los valores se leen con el auxiliar
`_config`, que devuelve el valor por defecto si la clave está vacía o ausente
(`app/services/fallas.py:19-23`).

| Clave | Valor inicial | Uso | Referencia |
|---|---|---|---|
| `fallas.activo` | `true` | Habilita la detección automática | `RepoTecnico/entornos_globales.md:195` |
| `fallas.umbral_casos` | `5` | Casos mínimos del grupo | `RepoTecnico/entornos_globales.md:196` |
| `fallas.ventana_horas` | `24` | Ventana temporal | `RepoTecnico/entornos_globales.md:197` |
| `fallas.campo_concentracion` | `"olt"` | Agrupador: `olt` \| `fat` \| `id_sector` | `RepoTecnico/entornos_globales.md:198` |
| `despacho.destino_telegram` | `""` | `chat_id` destino; vacío ⇒ notificación PENDIENTE | `RepoTecnico/entornos_globales.md:199` |

La prueba `test_deteccion_desactivada` apaga `fallas.activo`, comprueba que la detección
devuelve lista vacía y restaura el valor
(`app/tests/test_alertas_api.py:65-77`).

### Endpoints

| Método y ruta | Propósito | Rol exigido | Línea |
|---|---|---|---|
| `GET /api/v1/fallas-masivas` | Listar fallas registradas | Autenticado | `app/api/routes_alertas.py:45` |
| `POST /api/v1/fallas-masivas` | Reportar falla manual (201) | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:64` |
| `POST /api/v1/fallas-masivas/detectar` | Detección por concentración | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:90` |
| `PATCH /api/v1/fallas-masivas/{id_falla}` | Actualizar estado o cuadrilla | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:104` |
| `POST /api/v1/fallas-masivas/{id_falla}/planificacion` | Documentar planificación (RF-17) | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:120` |
| `POST /api/v1/fallas-masivas/{id_falla}/material` | Solicitar material (RF-18), 201 | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:144` |

El listado acepta `estado`, `id_central` y `solo_activas`; este último filtra
`DETECTADA`/`PLANIFICADA` (`app/api/routes_alertas.py:50-60`). El reporte manual usa el
esquema `FallaMasivaManual`, con `descripcion` de 5 a 500 caracteres y origen por defecto
`REPORTE_TECNICO` (`app/schemas/alertas.py:29-33`). Si no se indica cuadrilla, se resuelve
la cercana al sector informado (`app/api/routes_alertas.py:72-73`), y tras crear la falla
se encola la alerta (`app/api/routes_alertas.py:84`). El `PATCH` valida el estado contra
el patrón `^(DETECTADA|PLANIFICADA|ATENDIDA|CERRADA)$` (`app/schemas/alertas.py:36-40`).
Un `id_falla` inexistente produce HTTP 404 mediante `_o_404`
(`app/api/routes_alertas.py:35-39`).

La prueba `test_filtros_de_fallas` valida el filtro `solo_activas`
(`app/tests/test_alertas_api.py:122-127`) y `test_rbac_tecnico` confirma que el rol
`TECNICO` puede listar pero recibe 403 al crear
(`app/tests/test_alertas_api.py:286-292`).

## Planificación (RF-17) y material (RF-18) sobre la falla

### Planificación

El esquema `PlanificacionRequest` exige `planificacion` (5 a 2000 caracteres), admite
`reporte_simple` (máximo 2000), una lista de `evidencias` (seriales o rutas) y una
`id_cuadrilla` opcional (`app/schemas/alertas.py:43-50`). El endpoint
`POST /fallas-masivas/{id_falla}/planificacion` (`app/api/routes_alertas.py:120-141`):

1. Recupera la falla con `_o_404` (`:128`).
2. Guarda `planificacion` (`:129`).
3. Copia `reporte_simple` si viene (`:130-131`).
4. Concatena las evidencias al reporte simple con el prefijo `Evidencias: `
   (`:132-134`).
5. Reasigna la cuadrilla si se indicó (`:135-136`).
6. Fija el estado en `PLANIFICADA` y registra `planificada_en` con `datetime.now(UTC)`
   (`:137-138`).

La prueba `test_reporte_manual_y_planificacion` comprueba el estado `PLANIFICADA`,
`planificada_en` no nulo y que un serial `IMG-001` quede en `reporte_simple`
(`app/tests/test_alertas_api.py:83-99`).

### Material

El esquema `MaterialRequest` exige `descripcion` (3 a 500 caracteres) y admite
`id_cuadrilla` (`app/schemas/alertas.py:53-57`). El endpoint
`POST /fallas-masivas/{id_falla}/material` responde 201 y crea una fila `OrdenMaterial`
(`app/api/routes_alertas.py:144-163`) con:

| Campo | Valor | Referencia |
|---|---|---|
| `id_cuadrilla` | el recibido o el de la falla | `app/api/routes_alertas.py:154` |
| `solicitante_usuario` | el P00 del usuario autenticado | `app/api/routes_alertas.py:155` |
| `estado` | `SOLICITADA` | `app/api/routes_alertas.py:156` |
| `observacion` | `[Falla {id_falla}] {descripcion}` | `app/api/routes_alertas.py:157` |

La respuesta incluye `id_orden`, `estado`, `observacion` e `id_falla`
(`app/api/routes_alertas.py:162-163`). La prueba `test_solicitud_de_material` valida el
estado `SOLICITADA` y el prefijo `[Falla N]` (`app/tests/test_alertas_api.py:102-110`).

## Outbox

### Tabla notificacion

Toda notificación se persiste primero en la tabla `notificacion`
(`app/models/despacho_entities.py:68-82`). Sus columnas relevantes son `canal` (20),
`destinatario` (160), `asunto` (200), `cuerpo` (`Text`), `id_caso` con borrado
`SET NULL`, `estado` (20), `error` (`Text`), `enviado_en`, `intentos` (`SmallInteger`) y
`proximo_intento` (`app/models/despacho_entities.py:71-82`). El esquema de salida
`NotificacionOut` refleja estos campos (`app/schemas/alertas.py:60-74`).

`encolar` crea la fila con estado `PENDIENTE`, `intentos = 0` y `proximo_intento = ahora`
(`app/services/outbox.py:34-48`). El asunto se trunca a 200 caracteres
(`app/services/outbox.py:40`), coherente con la columna.

### Estados

| Estado | Significado | Referencia |
|---|---|---|
| `PENDIENTE` | Encolada o diferida; puede reintentarse | `app/services/outbox.py:43,80,92` |
| `ENVIADO` | El canal confirmó el envío | `app/services/outbox.py:73-77` |
| `FALLIDO` | Se agotaron los intentos permitidos | `app/services/outbox.py:87-90` |

Estados devueltos por cada canal en `notificaciones.enviar`: `ENVIADO`, `PENDIENTE` o
`FALLIDO` (`app/services/notificaciones.py:64-72`). La página ALERTAS ofrece el filtro de
bandeja por estado `PENDIENTE`, `ENVIADO` y `FALLIDO`
(`app/web/src/pages/Alertas.tsx:27,356-367`).

#### Diferencia entre «diferida» y «fallida»

Si el canal responde `PENDIENTE` (falta de credenciales), el outbox **resta** el intento
recién sumado, reprograma con backoff y contabiliza la notificación como «diferida»; así
no consume intentos (`app/services/outbox.py:78-85`). Si el canal responde `FALLIDO` y los
intentos alcanzan `max_intentos`, el estado pasa a `FALLIDO` y se limpia
`proximo_intento` (`app/services/outbox.py:86-90`); en caso contrario se reprograma
(`app/services/outbox.py:91-96`). `RepoTecnico/metricas.md:121` formaliza que «diferida»
equivale a `intentadas - enviadas - fallidas`.

### Backoff y max_intentos (app/services/outbox.py)

`backoff_minutos` devuelve `min(2^(intentos-1), 60)` minutos, es decir 1, 2, 4, 8… con
tope de 60 (`app/services/outbox.py:29-31`, constante `BACKOFF_TOPE_MINUTOS = 60` en
`:21`). El número máximo de intentos se lee de `outbox.max_intentos`, con valor por
defecto `MAX_INTENTOS_POR_DEFECTO = 5` (`app/services/outbox.py:20,53`); el valor inicial
documentado en la configuración también es 5
(`RepoTecnico/entornos_globales.md:200`).

`procesar` selecciona las notificaciones `PENDIENTE` cuyo `proximo_intento` ya llegó,
ordenadas por `id_notificacion` y limitadas por el parámetro `limite`
(`app/services/outbox.py:51-64`). Devuelve un resumen con `intentadas`, `enviadas`,
`diferidas`, `fallidas` y el `detalle` por notificación
(`app/services/outbox.py:66,97-103`), que corresponde al esquema `ProcesarOutboxOut`
(`app/schemas/alertas.py:77-82`).

#### Disparadores del procesamiento

| Disparador | Límite | Referencia |
|---|---|---|
| `POST /api/v1/notificaciones/procesar` | `limite` entre 1 y 200, por defecto 50 | `app/api/routes_alertas.py:188-195` |
| Respuesta del bot de Telegram | 5 | `app/api/routes_alertas.py:205` |
| Herramienta MCP `procesar_notificaciones` | 20 | `app/api/routes_alertas.py:382` |

### Canales (app/services/notificaciones.py)

El módulo declara que, si el canal no tiene credenciales, la notificación queda
`PENDIENTE` con el motivo en lugar de perderse
(`app/services/notificaciones.py:1-5`).

| Canal | Variable de entorno | Sin credenciales | Referencia |
|---|---|---|---|
| `TELEGRAM` | `TELEGRAM_BOT_TOKEN` | `PENDIENTE` + motivo | `app/services/notificaciones.py:20-22` |
| `CORREO` | `SMTP_HOST` (y `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`) | `PENDIENTE` + motivo | `app/services/notificaciones.py:40-46` |

El envío por Telegram usa `urllib.request` contra `api.telegram.org/bot{token}/sendMessage`
con `parse_mode: Markdown`, trunca el texto a `LIMITE_TELEGRAM = 4000` caracteres
(`app/services/notificaciones.py:16,23-33`) y devuelve `FALLIDO` ante
`URLError`, `TimeoutError` u `OSError` (`app/services/notificaciones.py:35-36`). El correo
usa `smtplib.SMTP` con `starttls()` y login si hay usuario
(`app/services/notificaciones.py:54-58`). Cualquier otro canal devuelve `FALLIDO` con
«Canal no soportado» (`app/services/notificaciones.py:72`).

#### Nota sobre nombre de canal del correo

`enviar` reconoce el canal `CORREO` (`app/services/notificaciones.py:70`). **Pendiente de
confirmar** si algún flujo de la v1 encola notificaciones por ese canal: en el código
revisado, las alertas de falla y las respuestas del bot encolan siempre `TELEGRAM`
(`app/services/fallas.py:125`, `app/api/routes_alertas.py:202`).

## Telegram

### Webhook POST /api/v1/telegram/webhook

El webhook se declara como `async` y lee el cuerpo con `await request.json()`
(`app/api/routes_alertas.py:256-267`). Acepta tanto `message` como `edited_message`
(`app/api/routes_alertas.py:268`). Extrae `chat_id` y `text`; si falta cualquiera de los
dos, responde `{"ok": True, "ignorado": True}` sin procesar nada
(`app/api/routes_alertas.py:269-272`). En caso contrario, resuelve el comando, encola la
respuesta y devuelve `{"ok": True, "respuesta": ...}` (`app/api/routes_alertas.py:274-276`).

`_responder_telegram` encola la respuesta con canal `TELEGRAM` y destinatario `chat_id`,
confirma, procesa hasta 5 notificaciones y vuelve a confirmar
(`app/api/routes_alertas.py:201-206`). Esto significa que la respuesta al usuario también
depende del outbox: **sin credenciales del bot queda PENDIENTE** y el usuario no recibe
nada en Telegram.

### Comandos /ayuda /estado /caso /falla

`_comando` parte el texto en comando y argumento, normaliza el comando a minúsculas y
quita la barra inicial (`app/api/routes_alertas.py:209-212`).

| Comando | Aliases | Comportamiento | Referencia |
|---|---|---|---|
| `/ayuda` | `start`, `help` | Devuelve la lista de comandos | `app/api/routes_alertas.py:215-217` |
| `/estado` | — | Cuenta casos pendientes y fallas activas de la central | `app/api/routes_alertas.py:218-230` |
| `/caso <id_averia>` | — | Busca el caso por `id_averia` y devuelve estado, cliente, teléfono, dirección y problema | `app/api/routes_alertas.py:231-239` |
| `/falla <descripción>` | — | Crea una falla masiva con origen `REPORTE_TECNICO` | `app/api/routes_alertas.py:240-252` |

Detalles verificados: `/caso` sin argumento responde «Uso: /caso <id_averia>»
(`:232-233`) y, si no encuentra el caso, «No encontré el caso {argumento}» (`:235-236`).
`/falla` sin argumento responde «Uso: /falla <descripción de la falla>` (`:241-242`);
la descripción se prefija con `[Telegram {chat_id}]` (`:245`). Un comando desconocido
responde «Comando no reconocido. Use /ayuda.» (`:253`). Las pruebas del webhook cubren
ayuda, estado, consulta de caso (incluido el no encontrado), reporte de falla, mensaje sin
texto y el secreto (`app/tests/test_alertas_api.py:156-206`).

#### Comando no implementado

`/falla` crea la falla pero **no** llama a `svc_fallas.alertar` —a diferencia del reporte
manual y de la herramienta MCP, que sí lo hacen—; el mensaje de respuesta afirma «Se
notificó al supervisor» (`app/api/routes_alertas.py:252`). Este comportamiento es el real
del código y se documenta tal cual; **pendiente de confirmar** si es intencional.

### Cabecera X-Telegram-Bot-Api-Secret-Token

El webhook recibe la cabecera `x_telegram_bot_api_secret_token` de forma opcional
(`app/api/routes_alertas.py:260`). El valor esperado se lee de la clave
`telegram.webhook_secret` de `configuracion` (`app/api/routes_alertas.py:263`). Si la
clave tiene valor y la cabecera no coincide, responde **HTTP 403** con detalle «Secreto
del webhook inválido» (`app/api/routes_alertas.py:264-265`). Si la clave está vacía, no se
exige la cabecera (`RepoTecnico/entornos_globales.md:201`). La prueba
`test_telegram_secreto` valida ambos caminos (`app/tests/test_alertas_api.py:192-206`).

## MCP

### POST /api/v1/mcp JSON-RPC

El servidor MCP se expone como `POST /api/v1/mcp` con la descripción «Servidor MCP
(JSON-RPC 2.0)» (`app/api/routes_alertas.py:346`). Es `async`, lee el cuerpo con
`await request.json()` y extrae `method`, `id` y `params`
(`app/api/routes_alertas.py:358-361`). No exige sesión de usuario: su control de acceso es
la clave MCP.

| Método JSON-RPC | Resultado | Referencia |
|---|---|---|
| `initialize` | `protocolVersion` `2024-11-05`, `capabilities.tools`, `serverInfo` `ggto-mcp` versión 0.1.0 | `app/api/routes_alertas.py:363-368` |
| `tools/list` | Lista `TOOLS` | `app/api/routes_alertas.py:369-370` |
| `tools/call` | Ejecuta la herramienta indicada en `params.name` | `app/api/routes_alertas.py:371-389` |
| Otro método | Error `-32601` «Método no soportado» | `app/api/routes_alertas.py:390-392` |

La respuesta exitosa tiene la forma `{"jsonrpc": "2.0", "id": ident, "result": ...}`
(`app/api/routes_alertas.py:394`). Las herramientas devuelven tanto texto como el objeto
`datos` (`result.content[0].text` y `result.datos`, `app/api/routes_alertas.py:389`).

### Cabecera X-MCP-Key

`mcp` recibe la cabecera opcional `x_mcp_key` (`app/api/routes_alertas.py:350`). El valor
esperado se lee de la clave `mcp.api_key` (`app/api/routes_alertas.py:353`). Si la clave
está configurada y no coincide, se devuelve un error JSON-RPC con código **-32001** y
mensaje «Clave MCP inválida» (`app/api/routes_alertas.py:354-356`). Si está vacía, no se
exige la cabecera (`RepoTecnico/entornos_globales.md:202`). La prueba `test_mcp_clave`
cubre el rechazo y el acceso con la cabecera correcta
(`app/tests/test_alertas_api.py:257-270`).

### Métodos expuestos según el código

Solo están implementados los tres métodos anteriores; `resources/list` y cualquier otro
caen en el error `-32601` (`app/tests/test_alertas_api.py:252-254`). **Pendiente de
confirmar** cualquier ampliación de métodos o de herramientas más allá de las declaradas
en `TOOLS`.

### Herramientas de la lista TOOLS

`TOOLS` declara cuatro herramientas (`app/api/routes_alertas.py:282-293`):

| Herramienta | Descripción | Argumentos | Implementación |
|---|---|---|---|
| `estado_central` | Resumen de casos pendientes y fallas activas | ninguno | `app/api/routes_alertas.py:296-309` |
| `consultar_caso` | Busca un caso por id de avería o teléfono | `id_averia`, `telefono` | `app/api/routes_alertas.py:312-325` |
| `reportar_falla` | Registra una falla masiva | `descripcion` (obligatorio) | `app/api/routes_alertas.py:328-343` |
| `procesar_notificaciones` | Procesa el outbox | ninguno | `app/api/routes_alertas.py:381-383` |

`consultar_caso` exige al menos uno de los dos argumentos; si faltan, lanza
`ValueError("Indique id_averia o telefono")`, que el manejador traduce a error `-32602`
(`app/api/routes_alertas.py:315-316,386-388`). Si no encuentra el caso devuelve
`{"encontrado": False}` (`app/api/routes_alertas.py:321-322`). `reportar_falla` exige una
descripción de al menos 5 caracteres, prefija `[MCP]`, asigna cuadrilla cercana, crea la
falla y llama a `alertar` (`app/api/routes_alertas.py:328-343`).

## Métricas

### GET /api/v1/metricas

El endpoint de observabilidad responde con el esquema `MetricasOut` y la descripción
«Métricas de negocio y estado de los canales» (`app/api/routes_alertas.py:400-402`). Exige
usuario autenticado y calcula (`app/api/routes_alertas.py:402-422`):

| Campo | Cálculo | Referencia |
|---|---|---|
| `casos_total` | suma de los conteos por estado | `app/api/routes_alertas.py:407` |
| `casos_por_estado` | `group_by(Caso.estado_actual)` | `app/api/routes_alertas.py:403` |
| `casos_por_categoria` | `group_by(Caso.categoria)` | `app/api/routes_alertas.py:404` |
| `lotes_ingesta` | `count(ingesta_lote)` | `app/api/routes_alertas.py:410` |
| `casos_ingeridos` | casos con `origen = 'INGESTA_CSV'` | `app/api/routes_alertas.py:411-412` |
| `fallas_activas` | fallas en `DETECTADA`/`PLANIFICADA` | `app/api/routes_alertas.py:413-415` |
| `notificaciones_pendientes` / `enviadas` / `fallidas` | provistas por `outbox.metricas` | `app/api/routes_alertas.py:416-418` |
| `canales_configurados` | `telegram` = existe `TELEGRAM_BOT_TOKEN`; `correo` = existe `SMTP_HOST` | `app/api/routes_alertas.py:419-422` |

`outbox.metricas` agrupa `notificacion` por estado y expone `PENDIENTE`, `ENVIADO` y
`FALLIDO` (`app/services/outbox.py:107-120`). El esquema `MetricasOut` declara exactamente
esos campos (`app/schemas/alertas.py:85-95`). La prueba `test_metricas` comprueba el total
de casos, que no hay ingeridos y que ambos canales figuran como no configurados
(`app/tests/test_alertas_api.py:276-283`).

## ESTADO REAL de los canales

### Telegram y correo sin credenciales ⇒ envíos PENDIENTES

En el entorno real las credenciales de los canales **no están configuradas**. Por diseño,
`_telegram` devuelve `("PENDIENTE", "Sin TELEGRAM_BOT_TOKEN configurado (se habilita en
el Ciclo 9)")` (`app/services/notificaciones.py:20-22`) y `_correo` devuelve
`("PENDIENTE", "Sin SMTP_HOST configurado (se habilita en el Ciclo 9)")`
(`app/services/notificaciones.py:40-42`). En consecuencia:

- `canales_configurados` informa `false` para Telegram y correo
  (`app/api/routes_alertas.py:419-422`).
- Las alertas quedan en la bandeja con estado `PENDIENTE` y no se pierden
  (`app/services/outbox.py:1-7,78-85`).
- La prueba `test_deteccion_encola_alerta` verifica que la alerta es del canal `TELEGRAM`,
  que su asunto contiene «Falla masiva» y que su estado es `PENDIENTE`
  (`app/tests/test_alertas_api.py:54-62`).
- La prueba `test_procesar_outbox_sin_credenciales` verifica `enviadas == 0` y
  `diferidas >= 1` (`app/tests/test_alertas_api.py:133-146`).

Por lo tanto, **no debe afirmarse que el sistema ya notifica**: los envíos están
**PENDIENTES** hasta que existan las credenciales (`TELEGRAM_BOT_TOKEN` / `SMTP_HOST`).
La propia página ALERTAS lo indica al usuario
(`app/web/src/pages/Alertas.tsx:8-10,227-237`).

### WhatsApp NO existe

El canal de WhatsApp **no está implementado** en la v1: `enviar` solo reconoce `TELEGRAM`
y `CORREO` (`app/services/notificaciones.py:64-72`), `canales_configurados` solo expone
`telegram` y `correo` (`app/api/routes_alertas.py:419-422`) y la prueba de esquema exige
exactamente esas dos claves (`app/tests/test_alertas_api.py:283`). WhatsApp está diferido
y no debe documentarse como disponible.

#### Canales mencionados en dependencias

Las variables `MCP_SERVER_URL` y `MCP_API_KEY` aparecen en `RepoTecnico/entornos_globales.md:180-181`,
pero el servidor MCP implementado en el código no las consume: su control de acceso es la
clave `mcp.api_key` de la tabla `configuracion`
(`app/api/routes_alertas.py:352-356`). **Pendiente de confirmar** el uso previsto de esas
variables de entorno.

## Endpoints de bandeja y página web ALERTAS

### Endpoints de bandeja

| Método y ruta | Propósito | Parámetros | Rol | Línea |
|---|---|---|---|---|
| `GET /api/v1/notificaciones` | Bandeja del outbox | `estado`, `canal`, `limite` (1–500, por defecto 100) | Autenticado | `app/api/routes_alertas.py:169` |
| `POST /api/v1/notificaciones/procesar` | Procesar reintentos | `limite` (1–200, por defecto 50) | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:186` |

El listado ordena por `id_notificacion` descendente y aplica los filtros
(`app/api/routes_alertas.py:178-182`). El procesamiento delega en `outbox.procesar` y
confirma la sesión (`app/api/routes_alertas.py:193-194`). `test_rbac_tecnico` confirma que
el rol `TECNICO` recibe 403 al procesar (`app/tests/test_alertas_api.py:292`).

### Página web ALERTAS

La página `Alertas` cubre RF-09, RF-16, RF-17, RF-18 y RNF-19/RNF-20
(`app/web/src/pages/Alertas.tsx:1-11`), se registra en la ruta `/alertas`
(`app/web/src/App.tsx:35`) y carga en paralelo métricas, fallas y bandeja con
`Promise.allSettled` (`app/web/src/pages/Alertas.tsx:104-120`).

| Zona | Contenido | Referencia |
|---|---|---|
| Estado de las alertas | Tarjetas de fallas activas, notificaciones (pendientes/enviadas/fallidas) y casos totales; estado de los canales | `app/web/src/pages/Alertas.tsx:196-243` |
| Fallas masivas | Tabla con origen, concentración, descripción, sector, cuadrilla, estado y fecha; filtro «solo activas» | `app/web/src/pages/Alertas.tsx:245-346` |
| Acciones por falla | «Planificar», «Material» y selector de estado | `app/web/src/pages/Alertas.tsx:307-338` |
| Bandeja de notificaciones | Tabla con canal, destinatario, asunto, estado, intentos, próximo intento y error | `app/web/src/pages/Alertas.tsx:348-418` |
| Botones superiores | «Detectar fallas» y «Reportar falla» | `app/web/src/pages/Alertas.tsx:173-190` |
| Modales | Reporte manual, planificación y solicitud de material | `app/web/src/pages/Alertas.tsx:415-439,446-661` |

Los estados de falla que ofrece la interfaz son `DETECTADA`, `PLANIFICADA`, `ATENDIDA` y
`CERRADA` (`app/web/src/pages/Alertas.tsx:25`), coherentes con el patrón de
`FallaMasivaUpdate` (`app/schemas/alertas.py:37-38`). La detección bajo demanda informa
cuántas fallas nuevas se crearon o que no hubo concentraciones sobre el umbral
(`app/web/src/pages/Alertas.tsx:140-146`). El procesamiento del outbox muestra el resumen
de enviadas, diferidas y fallidas (`app/web/src/pages/Alertas.tsx:148-155`). Las funciones
de escritura se deshabilitan cuando la sesión es de solo lectura
(`app/web/src/pages/Alertas.tsx:178,186,312,320,326,373`).

## Pruebas

### Cobertura del ciclo 9

El archivo `app/tests/test_alertas_api.py` contiene **23 pruebas** de integración
(`RepoTecnico/pruebas/informe_fase4.md:72`) que cubren detección RF-09, planificación
RF-17, material RF-18, outbox y canales. El proyecto cerró la Fase 4 con 169/169 pruebas de
`pytest` (`RepoTecnico/pruebas/informe_fase4.md:18,85`) y 215 sumando las 46 E2E
(`RepoTecnico/pruebas/informe_fase4.md:103`). El guion E2E `09-alertas.spec.js` aportó 4
pruebas sobre métricas, RF-09, RF-17, RF-18 y outbox
(`RepoTecnico/pruebas/informe_fase4.md:63`).

| Bloque | Pruebas | Referencia |
|---|---|---|
| Detección automática | `test_deteccion_por_concentracion`, `test_deteccion_encola_alerta`, `test_deteccion_desactivada` | `app/tests/test_alertas_api.py:36-77` |
| Reporte, planificación y material | `test_reporte_manual_y_planificacion`, `test_solicitud_de_material`, `test_actualizar_estado_de_falla`, `test_filtros_de_fallas` | `app/tests/test_alertas_api.py:83-127` |
| Outbox | `test_procesar_outbox_sin_credenciales` | `app/tests/test_alertas_api.py:133-146` |
| Telegram | Ayuda, estado, caso, reporte de falla, sin texto y secreto | `app/tests/test_alertas_api.py:156-206` |
| MCP | `initialize`, `tools/list`, herramientas, método no soportado y clave | `app/tests/test_alertas_api.py:216-270` |
| Métricas y RBAC | `test_metricas`, `test_rbac_tecnico`, `test_sin_token` | `app/tests/test_alertas_api.py:276-296` |

### Pruebas de contrato y RBAC

Además del archivo específico, las pruebas de contrato verifican que
`/api/v1/fallas-masivas` forma parte del OpenAPI publicado
(`app/tests/test_contratos.py:35`) y que los roles autorizados pueden crear fallas
(`app/tests/test_contratos.py:131-134`). El escenario base de `test_alertas_api.py` crea
seis casos pendientes en el mismo OLT para superar el umbral de 5, fijando el campo `olt`
directamente porque la vía manual no lo carga
(`app/tests/test_alertas_api.py:14-30`).

### Verificación en vivo

**D-60** registra la verificación en vivo del ciclo con 42 casos, 0 fallas, outbox vacío,
73 endpoints (cifra previa a los ciclos D-66/D-67, que dejaron la superficie en 79 paths / 109 operaciones)
y respuesta `200` de la SPA en `/alertas`
(`RepoTecnico/estado_proyecto.md:124` y la bitácora en `RepoTecnico/estado_proyecto.md:294`).

## Pendiente de confirmar

| Tema | Motivo | Referencia |
|---|---|---|
| Canal `CORREO` sin flujo que lo encole en la v1 | `enviar` lo soporta, pero los flujos revisados encolan `TELEGRAM` | `app/services/notificaciones.py:70`, `app/services/fallas.py:125` |
| `/falla` de Telegram no llama a `alertar` pese a afirmarlo | Comportamiento real del código | `app/api/routes_alertas.py:240-252` |
| Uso de `MCP_SERVER_URL` / `MCP_API_KEY` del entorno | El código usa `mcp.api_key` de `configuracion` | `RepoTecnico/entornos_globales.md:180-181`, `app/api/routes_alertas.py:353` |
| Ampliación de métodos MCP o de la lista `TOOLS` | No verificable en el repositorio actual | `app/api/routes_alertas.py:282-293` |
| Fecha de habilitación de credenciales de Telegram/correo | Depende de la operación, no del código | `app/services/notificaciones.py:22,42` |
