# Casos de uso v2 — Asistente con IA en grupo de Telegram

> Generados en Fase 2 tras el `INFORME_OPTIMIZACION_V4.md` y las decisiones
> DEC-TG-01…17. Re-auditoría: APTO. Norma: un caso por objetivo de actor; criterios funcionales en
> **Gherkin**, restricciones del sistema en **EARS**; trazabilidad RF/RNF/RT/DEC;
> todo criterio debe ser verificable en test.

## Actores

| ID | Actor | Descripción |
|---|---|---|
| ACT-TG-01 | Miembro del grupo | Cualquier usuario de `GGTOv3-PDE` (`chat_id -5561202916`). Puede **consultar**. |
| ACT-TG-02 | Gestor | Usuario con rol SUPER/ADMIN/SUPERVISOR y `p00` nominado. Puede **actualizar** con `/confirmar`. |
| ACT-TG-03 | Bot / outbox | `GGTOv2Testbot` (`9052843256`), publica como miembro del grupo. |
| ACT-TG-04 | Operador web | Usuario de la SPA que usa el mismo motor del asistente. |
| ACT-TG-05 | Administrador del grupo | SUPER/SUPERVISOR que da de alta miembros y configura `eventos_config`/`politica_pii`. |

---

## CU-TG-01 — Consultar un caso por identificador

| Campo | Valor |
|---|---|
| Actor | ACT-TG-01 (miembro del grupo) |
| Precondición | Bot presente en `GGTOv3-PDE`; caso existe con `id_averia` o `id_pago` 70*; token/secretos configurados. |
| Flujo principal | 1) El miembro escribe texto libre con el identificador. 2) El bot valida `secret_token`, extrae el identificador y resuelve con MCP `consultar_caso` o API. 3) Publica la respuesta en el grupo con solo referencias. |
| Flujos alternativos | a) Identificador no encontrado → aviso «caso no encontrado», sin escritura. b) Proveedor IA 503/429 → aviso al grupo y reintento. c) `update_id` ya procesado → descarta sin responder. |

**Criterios Gherkin**

```gherkin
Dado que el caso 28715618 existe y el bot está en GGTOv3-PDE
Cuando un miembro escribe "¿estado de 28715618?"
Entonces el bot publica un mensaje con ID de avería, ID de pago, estado y sector
Y el mensaje NO contiene nombre, teléfono ni dirección

Dado un mensaje con un 70* inexistente
Cuando el bot procesa la consulta
Entonces responde "caso no encontrado"
Y no registra ninguna escritura en caso ni en caso_estado_hist

Dado un reenvío del mismo update_id con distinto message_id
Cuando llega al webhook
Entonces no se publica una segunda respuesta
Y no se crea un segundo turno en asistente_sesion

Dado un webhook sin X-Telegram-Bot-Api-Secret-Token válido
Cuando llega un update
Entonces responde 403 fail-closed sin invocar MCP
Y no publica respuesta ni registra escritura

Dado un turno válido del miembro 8589760242 con message_id 900
Cuando el bot responde en el grupo -5561202916
Entonces asistente_sesion contiene canal=TELEGRAM_GRUPO, id_grupo, message_id=900, p00 y resultado
Y la consulta queda trazada con el from.id real del emisor

Dado que el proveedor LLM responde 503
Cuando el bot procesa la consulta
Entonces publica un aviso "Asistente no disponible"
Y reintenta una vez sin crear pendiente ni duplicar respuesta

Dado que el grupo superó 30 mensajes en un minuto
Cuando llega un nuevo mensaje
Entonces responde 429 con retryAfterMs
Y no invoca MCP ni realiza escrituras

Dado que el usuario 8589760242 alcanzó 500 mensajes en el día
Cuando envía otro mensaje al grupo
Entonces responde 429 con aviso de cuota diaria agotada
Y su contador diario no se reinicia hasta el siguiente día
```

**Restricciones EARS**

- *Si* la política del grupo es `REFERENCIAS`, *entonces* el sistema excluirá nombre, teléfono y dirección de toda respuesta publicada.
- *Mientras* el proveedor LLM devuelva 429 con `retryAfterMs`, *el sistema* respetará ese retorno antes de reintentar.
- *Cuando* un `update_id` ya fue persistido, *el sistema* descartará el update de forma atómica.
- *Mientras* el grupo supere 30 mensajes/minuto o 500/día, *el sistema* responderá 429 sin escribir (RNF-TG-05, H-10).
- *Si* falta o es inválida la cabecera `X-Telegram-Bot-Api-Secret-Token`, *entonces* el sistema responderá **403** sin invocar MCP; *si* faltan credenciales de bot/MCP/usuario de servicio, *entonces* responderá **503** con aviso al grupo (RNF-TG-01, RT-TG-01).

**Trazabilidad:** RF-TG-01, RNF-TG-01/02/03/04/05/07, RT-TG-01/02/03, DEC-TG-01/05, H-07/H-10/H-11/H-21/H-31.

---

## CU-TG-02 — Actualizar información o estatus con confirmación

| Campo | Valor |
|---|---|
| Actor | ACT-TG-02 (gestor) |
| Precondición | Miembro con `p00` propio, `rol ∈ {SUPER,ADMIN,SUPERVISOR}` y `puede_actualizar=true`; pendiente persistida disponible. |
| Flujo principal | 1) El gestor indica ID de caso + campo/estado deseado. 2) El bot crea `asistente_pending_confirm` con `id_pending`, `expira_en` y vista previa editable. 3) El gestor envía `/confirmar <id_pending>`. 4) El bot revalida rol y aplica `PATCH /casos/{id}` o `POST /casos/{id}/estado`. 5) Publica resultado y registra auditoría. |
| Flujos alternativos | a) `/confirmar` de otro `from.id` → 403, sin escritura. b) Pendiente expirada → aviso, sin escritura. c) Transición no permitida (409) → propaga error canónico. d) TECNICO intenta actualizar dato → rechaza; solo cambio de estado D-68. |

**Criterios Gherkin**

```gherkin
Dado un gestor con rol SUPERVISOR y puede_actualizar=true
Cuando solicita cambiar el estado del caso 7014048481 a DIFERIDO
Entonces el bot publica una vista previa con el id_pending
Y no modifica el caso hasta recibir /confirmar <id_pending>

Dado el id_pending 123 creado por el usuario 8589760242
Cuando el usuario 1090508107 envía "/confirmar 123"
Entonces el bot responde "confirmación no autorizada"
Y el caso permanece sin cambios

Dado una pendiente con expira_en ya vencida
Cuando llega /confirmar con su id_pending
Entonces la pendiente pasa a EXPIRADA y no se aplica ninguna escritura

Dado un TECNICO autorizado en el grupo
Cuando intenta cambiar la dirección de un caso
Entonces se rechaza con mensaje de permiso insuficiente
Y si solicita cambio de estado, se aplica por D-68 tras confirmación

Dado un gestor del grupo -5561202916 con p00 de central 1
Cuando confirma el cambio de estado del caso 7014048481
Entonces se registra en auditoría el from.id del solicitante y del confirmador
Y asistente_sesion guarda canal=TELEGRAM_GRUPO, id_grupo, message_id y resultado

Dado un miembro con p00 de central distinta a la del usuario de servicio
Cuando solicita una escritura
Entonces responde 403 por recinto y no modifica el caso

Dado un SUPER con puede_actualizar=false
Cuando envía /confirmar sobre una pendiente válida
Entonces aplica la escritura por bypass auditado y registra al confirmador
```

**Restricciones EARS**

- *Si* `confirmado_por` no coincide con `solicitado_por` ni con un gestor designado, *entonces* el sistema rechazará la confirmación y registrará el intento.
- *Cuando* se consume una pendiente, *el sistema* la marcará `CONSUMIDA` y la invalidará para reintentos.
- *El sistema deberá* conservar la pendiente ante un 503 del proveedor de IA, sin duplicar escrituras.
- *Si* la central del miembro difiere de la del usuario de servicio, *entonces* el sistema denegará la escritura; el bypass SUPER quedará auditado (RNF-TG-06, H-15/H-29).

**Trazabilidad:** RF-TG-02/05, RNF-TG-03/04/06/07, RT-TG-02/03/04, DEC-TG-02/08/10/12/13, D-68, D-120, H-02/H-03/H-06/H-15/H-29/H-30.

---

## CU-TG-03 — Publicar alertas en el grupo como miembro

| Campo | Valor |
|---|---|
| Actor | ACT-TG-03 (bot/outbox) |
| Precondición | Evento habilitado en `asistente_grupo.eventos_config`; `notificacion.canal=TELEGRAM` con `destinatario=-5561202916`. |
| Flujo principal | 1) Ocurre un evento (CIERRE, CITA, ENRUTADO, DIFERIDO, FALLA). 2) El sistema encola `notificacion`. 3) El outbox publica el mensaje con plantilla de solo referencias. 4) Se registra `id_mensaje_telegram` y resultado. |
| Flujos alternativos | a) Envío fallido → reintentos con backoff y estado terminal. b) Evento no habilitado → no se encola. c) Reenvío duplicado → `clave_dedupe` evita segunda publicación. |

**Criterios Gherkin**

```gherkin
Dado eventos_config={"CIERRE":true,"CITA":false}
Cuando se cierra el caso 7014048481
Entonces se encola una notificacion canal TELEGRAM destinatario -5561202916
Y no se encola ninguna notificación por la cita del caso 7014045719

Dado un mensaje de alerta publicado con message_id 555
Cuando el outbox reintenta el mismo evento
Entonces no se publica un segundo mensaje
Y la notificación conserva su estado ENVIADA

Dado que la app no tiene TELEGRAM_BOT_TOKEN accesible desde Secret Manager
Cuando el outbox intenta drenar la notificación del grupo
Entonces permanece PENDIENTE con error "canal no configurado"
Y se emite una alerta al supervisor
```

**Restricciones EARS**

- *Si* `eventos_config` no contiene la clave del evento, *entonces* el sistema no encolará la notificación.
- *De acuerdo con* DEC-TG-05, *el cuerpo* contendrá solo ID de avería, ID de pago, estado y sector.
- *Cuando* se agoten los reintentos del outbox, *el sistema* marcará `FALLIDO` y alertará al supervisor.
- *Si* la app no puede leer el token del bot, *entonces* mantendrá la notificación PENDIENTE sin envío parcial (H-09).

**Trazabilidad:** RF-TG-03, RNF-TG-02/03/04, RT-TG-04, DEC-TG-03/05/07, H-09/H-16.

---

## CU-TG-04 — Usar el asistente en la web (mismo motor)

| Campo | Valor |
|---|---|
| Actor | ACT-TG-04 (operador web) |
| Precondición | SPA desplegada; mismo endpoint del motor `asistente-ggto`. |
| Flujo principal | 1) El operador escribe una consulta o indica una actualización. 2) El motor extrae la ficha y muestra vista previa editable. 3) El operador confirma. 4) Se aplica por caminos canónicos y se registra en `asistente_sesion` con `canal=PANEL`. |
| Flujos alternativos | a) Ficha incompleta → 422 con `faltantes`. b) Caso no encontrado → 404 sin escritura. |

**Criterios Gherkin**

```gherkin
Dado un operador web autenticado
Cuando escribe "consultar 28708097"
Entonces ve la misma respuesta permitida que en el grupo
Y el turno se registra con canal PANEL

Dado una ficha de alta sin dirección
Cuando el operador confirma
Entonces el servidor responde 422 con el campo faltante
Y no se crea ningún caso
```

**Restricciones EARS**

- *El sistema deberá* usar el mismo contrato de ficha y confirmación en web y grupo.
- *Si* la SPA no puede alcanzar el motor, *entonces* mostrará aviso fail-closed sin escribir.

**Trazabilidad:** RF-TG-04, RNF-TG-02, RT-TG-05, DEC-TG-11 (fail-closed de credenciales se verifica en CU-TG-01).

---

## CU-TG-05 — Dar de alta y gestionar miembros del grupo

| Campo | Valor |
|---|---|
| Actor | ACT-TG-05 (SUPER/SUPERVISOR de la central) |
| Precondición | Rol de gestión; grupo dado de alta en `asistente_grupo`. |
| Flujo principal | 1) Alta/baja en `asistente_grupo_miembro` con `telegram_user_id`, `p00` propio, `rol` y `puede_actualizar` derivado del rol. 2) Cada cambio queda auditado. |
| Flujos alternativos | a) `p00=GGTOAST001` para humano → rechazo. b) Miembro de otra central → rechazo por recinto. |

**Criterios Gherkin**

```gherkin
Dado un SUPER autenticado
Cuando da de alta al usuario 8589760242 con p00 propio y rol SUPERVISOR
Entonces el miembro queda activo con puede_actualizar=true
Y se registra quién concedió el permiso

Dado un intento de alta con p00 GGTOAST001 para una persona física
Cuando se valida el miembro
Entonces se rechaza con error de identidad no nominada

Dado un miembro de central distinta a la del grupo
Cuando se intenta su alta en GGTOv3-PDE
Entonces se rechaza por recinto sin crear la fila
```

**Restricciones EARS**

- *Si* el `p00` del miembro es el usuario de servicio, *entonces* el sistema rechazará el alta.
- *El sistema deberá* derivar `puede_actualizar` del rol, usando `asistente_grupo_miembro` como única fuente de autorización (H-18).

**Trazabilidad:** RF-TG-05, RNF-TG-06, RT-TG-02/04, DEC-TG-09/12, H-06/H-15/H-18.

---

## CU-TG-06 — Configurar eventos y privacidad del grupo

| Campo | Valor |
|---|---|
| Actor | ACT-TG-05 (SUPER/SUPERVISOR de la central) |
| Precondición | Grupo dado de alta; catálogo maestro de eventos publicado. |
| Flujo principal | 1) Ajusta `eventos_config` con claves del catálogo. 2) Fija `politica_pii=REFERENCIAS`. 3) Guarda y audita el cambio. |
| Flujos alternativos | a) Clave desconocida → rechazo 422. b) `politica_pii=COMPLETO` → rechazo. |

**Criterios Gherkin**

```gherkin
Dado el catálogo CIERRE,CITA,ENRUTADO,DIFERIDO,FALLA
Cuando el administrador guarda eventos_config={"CIERRE":true,"CITA":false}
Entonces la configuración queda vigente y auditada

Dado un intento de guardar eventos_config con clave "ALTA_CASO"
Cuando se valida el JSON
Entonces responde 422 y no modifica la configuración anterior

Dado un grupo con politica_pii=REFERENCIAS
Cuando el administrador intenta fijar politica_pii=COMPLETO
Entonces se rechaza el cambio y se registra el intento
```

**Restricciones EARS**

- *Si* una clave de `eventos_config` no está en el catálogo, *entonces* el sistema rechazará la configuración (H-16).
- *El sistema deberá* mantener `politica_pii=REFERENCIAS` para este grupo sin admitir `COMPLETO` (H-04/H-11).

**Trazabilidad:** RF-TG-03/05, RNF-TG-02, RT-TG-04, DEC-TG-03/05, H-04/H-11/H-16 (H-28 es nombramiento organizativo, se registra en `estado_proyecto.md`, no en CU).

---

## Matriz de trazabilidad RF → CU

| RF | CU |
|---|---|
| RF-TG-01 | CU-TG-01 |
| RF-TG-02 | CU-TG-02 |
| RF-TG-03 | CU-TG-03 |
| RF-TG-04 | CU-TG-04 |
| RF-TG-05 | CU-TG-05 / CU-TG-06 |

## Cobertura de hallazgos V4 (31)

| Hallazgo | Estado / cobertura |
|---|---|
| H-01 APK | Resuelto por DEC-TG-11 · CU-TG-04 |
| H-02 pendientes | CU-TG-02 (persistencia, TTL, confirmador) |
| H-03 token | CU-TG-02 (`/confirmar <id_pending>`) |
| H-04 PII | CU-TG-01 / CU-TG-03 / CU-TG-06 |
| H-05 roles | Resuelto por DEC-TG-12 · CU-TG-02 |
| H-06 usuario de servicio | CU-TG-05 |
| H-07 idempotencia | CU-TG-01 / CU-TG-03 |
| H-08 from.id | CU-TG-01 / CU-TG-02 / CU-TG-05 |
| H-09 outbox | CU-TG-03 (credenciales PENDIENTE → H-09 abierto en Fase 3) |
| H-10 cuota | CU-TG-01 (429 / retryAfterMs) |
| H-11 audiencia | Resuelto por DEC-TG-05 · CU-TG-01 (solo referencias; audiencia abierta) |
| H-12 legal | **Pendiente** — responsable: dirección/CANTV, antes de datos reales |
| H-13 cabeceras | **Corregido** en documentos v2 y `estado_proyecto.md` |
| H-14 entidad alerta | **Corregido** en RT-TG-04 (reutiliza `notificacion`) |
| H-15 precedencia roles | CU-TG-02 / CU-TG-05 (bypass SUPER auditado) |
| H-16 eventos_config | CU-TG-03 / CU-TG-06 |
| H-17 plantilla mensaje | CU-TG-03 (plantilla de solo referencias, longitud por definir en Fase 3) |
| H-18 doble tabla auth | **Corregido**: `asistente_grupo_miembro` única fuente (CU-TG-05) |
| H-19 rama git | **Corregido** en `estado_proyecto.md` |
| H-20 modelo IA | **Resuelto** DEC-TG-14: `opencode` / `nvidia/nemotron-3.5-super-vl-120b-a12b` (CU-TG-01 `/health`) |
| H-21 latencia | CU-TG-01 (429/reintento); SLO p95 **pendiente** en Fase 3 |
| H-22 Funnel | **Riesgo aceptado** DEC-TG-04; runbook pendiente |
| H-23 rotación | **Pendiente** — runbook `setWebhook` atómico en Fase 3 |
| H-24 migración | **Corregido**: comando retirado hasta crear el script |
| H-25 monitoreo | **Pendiente** — recrear alertas en proyecto vigente |
| H-26 administrador | **Pendiente Fase 3** — definir permisos exactos del chat admin `8589760242` |
| H-27 auditoría TG | Abierto — responsable **SUPER en solo lectura**, a registrar en la tabla de gobierno de `requerimientos.md` §5.3 |
| H-28 dueño bot | **Pendiente** — nombramiento organizativo, no testeable en CU |
| H-29 recinto | CU-TG-02 (403 por central) |
| H-30 trazabilidad | CU-TG-01 / CU-TG-02 (`from.id`, confirmador, resultado) |
| H-31 privacy mode | **Pendiente Fase 3** — fijar valor exacto (`/setprivacy Disabled` o exigir @mención) |
