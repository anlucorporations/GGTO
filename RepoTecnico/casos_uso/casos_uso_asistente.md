# Casos de Uso — Asistente Virtual de Gestión (`asistente-ggto`, ciclos C1–C6)

> Actualiza los CU-AV-01…05 de `PROPUESTA_asistente_virtual.md` al estado real C1–C6
> (canon v2-A5, `RepoTecnico/Asistente/MANUAL_ASISTENTES_V2.md` — fuera de git).
> Actores: **ACT-AV-O** Operador de gestión (usuario SUPERVISOR/ADMIN en el panel web) y
> **ACT-AV-T** Remitente autorizado de Telegram (usuario GGTO mapeado por `asistente_remitente`).
> El **Gateway OpenCode** (`claude-haiku-5-5`) es el sistema intermediario.

## Reglas globales del asistente (EARS, aplican a todos los CU-AV)

- **R-AV-1 (EARS):** Si la vista previa no está confirmada por un humano, entonces el sistema
  no aplicará ninguna escritura en GGTO (alta, evento o estado). *(RNF-AV-06)*
- **R-AV-2 (EARS):** Cuando el Gateway no responde o no está configurado, el sistema responderá
  **503 fail-closed** sin ficha ni gasto de modelo.
- **R-AV-3 (EARS):** Cuando un remitente de Telegram no esté en `asistente_remitente`,
  el sistema ignorará su mensaje sin respuesta y sin consumo de Gateway.
- **R-AV-4 (EARS):** Si un chat_id excede **30 mensajes/minuto** o **500/día**, el sistema
  responderá **429** y no procesará el mensaje. *(RNF-AV cuota, canon v2-A5)*
- **R-AV-5 (EARS):** Mientras exista sesión de turno, el sistema registrará cada intercambio
  en `asistente_sesion` (PostgreSQL GGTO) y en Mongo (`proj_ggto`, uso/cuota).
- **R-AV-6 (EARS):** De acuerdo con la validación canónica de GGTO, toda escritura del asistente
  usará los caminos canónicos (`POST /api/v1/casos`, `PATCH`, cita, estado por el **camino único
  de estado**, D-120) y un dato corregido inválido producirá **422/404/409** canónicos sin aplicar nada.

---

## CU-AV-01 — Conversar y recibir ficha de intención (vista previa)

**Actor:** ACT-AV-O (panel web `GET /`) o ACT-AV-T (Telegram) · **Ciclo:** C1 (+C5 en Telegram)

**Precondición:** Gateway configurado (REF-SEC-26 por docker secret); sesión de turno abierta;
(en Telegram) remitente dado de alta en `asistente_remitente`.

**Flujo principal:** el actor escribe texto libre («crear caso para cliente X, 70123456…») →
el servidor envía el texto al Gateway → el modelo devuelve ficha estructurada
(`intencion`, tipo_reporte, id_pago, nombre/contacto/dirección, tipo_problema/evento, fecha_cita…) →
el panel muestra la ficha **editable** (C6) sin haber escrito nada en GGTO.

**Alternativos:** Gateway ausente → 503 fail-closed (R-AV-2); texto ambiguo → ficha parcial y
el operador corrige campos o pide de nuevo; mensaje vacío → se pide texto.

**Criterios (Gherkin):**

```gherkin
Dado un Gateway configurado y una sesión abierta
Cuando el actor envía el texto «alta cliente 70123456 FAT 8 port»
Entonces el panel muestra una ficha con intencion ALTA_CASO e id_pago 70123456
Y ninguna fila de `caso` de GGTO cambia (0 escrituras).

Dado un Gateway NO configurado
Cuando el actor envía cualquier texto
Entonces la respuesta es 503 y el panel indica «asistente no disponible»
Y no se consume ninguna llamada de modelo.
```

**Trazabilidad:** RNF-AV (canon v2-A5), R-AV-1/2, RF-32 (alta asistida), RT-07 (canal IA),
`MANUAL_ASISTENTES_V2.md` §9. Test: `asistente-ggto/test/core.test.js`.

---

## CU-AV-02 — Confirmar ALTA_CASO (crear caso canónico)

**Actor:** ACT-AV-O (botón «Confirmar y crear caso») o ACT-AV-T (comando `CONFIRMAR` por chat)
· **Ciclo:** C2/C5

**Precondición:** ficha de vista previa (CU-AV-01) presente; los datos obligatorios de alta
canónica están completos (RN-AL-01).

**Flujo principal:** el actor confirma (ficha **editada** si corrigió campos, C6) →
`POST /api/v1/casos` canónico → 201 con `id_averia`, `id_caso`, `estado_actual` →
el panel/chat muestra la confirmación con la referencia.

**Alternativos:** 422 «faltan datos» → el sistema lista los campos faltantes y no crea nada;
404 identidad no encontrada → aviso con `id_averia/id_pago`; error de red → botón re-habilitado.

**Criterios (Gherkin):**

```gherkin
Dado una ficha ALTA_CASO con datos obligatorios completos (RN-AL-01)
Cuando el actor pulsa «Confirmar y crear caso»
Entonces GGTO responde 201 y existe el caso nuevo con estado canónico inicial
Y la ficha queda consumida (el botón desaparece).

Dado una ficha ALTA_CASO a la que le falta un dato obligatorio
Cuando el actor confirma
Entonces la respuesta es 422 con la lista de faltantes
Y no se crea ningún caso.
```

**Trazabilidad:** RF-32, RN-AL-01, RNF-AV-06, R-AV-1/6, DEC-G (canales canónicos).
Test: `confirmar.test.js`.

---

## CU-AV-03 — Confirmar EVENTO (comentario, actividad, cita, cambio de estado)

**Actor:** ACT-AV-O / ACT-AV-T · **Ciclo:** C3/C5

**Precondición:** ficha `intencion=EVENTO` con caso localizado previamente por
`GET /api/v1/casos/buscar` (70*, REF).

**Flujo principal:** confirmar → el asistente aplica el evento por el camino canónico:
comentario/actividad vía `PATCH`, cita vía `POST /cita`, cambio de estado vía
`POST /estado` (camino único de estado, D-120) → respuesta con `tipo_evento` e `id_caso`.

**Alternativos:** caso no encontrado → 404 canónico; caso en estado terminal
(CERRADO/CANCELADO/ENRUTADO) → 409 canónico; 422 faltantes.

**Criterios (Gherkin):**

```gherkin
Dado un caso 70123456 en estado no terminal
Cuando se confirma la ficha EVENTO cambio de estado a ASIGNADO
Entonces el estado del caso en GGTO es ASIGNADO
Y el evento queda en el historial del caso con el usuario de servicio.

Dado una ficha EVENTO sobre un caso en estado CERRADO
Cuando se confirma
Entonces la respuesta es 409 canónica y no cambia ningún dato.

Dado una ficha EVENTO con caso inexistente
Cuando se confirma
Entonces la respuesta es 404 y no cambia ningún dato.
```

**Trazabilidad:** RF-31, D-120 (camino único de estado), R-AV-6. *(RN-EST-01 definirá la matriz de transiciones; el asistente quedará sujeto a ella — pendiente de implementación.)*

---

## CU-AV-04 — Consultar información (CASO / FAT / RESUMEN_DIA)

**Actor:** ACT-AV-O / ACT-AV-T · **Ciclo:** C4

**Precondición:** sesión abierta; (FAT) identificador de FAT conocido; (RESUMEN_DIA) central del
usuario de servicio.

**Flujo principal:** texto de consulta → intención CONSULTA → lectura directa (sin confirmación):
CASO (por 70*/REF, ficha sin PII en listados), FAT (resumen de la FAT),
RESUMEN_DIA (pendientes/asignados/cerrados del día de la central) → respuesta inmediata
con datos de solo lectura.

**Alternativos:** consulta ambigua → el asistente pide el identificador; caso inexistente →
aviso sin dato.

**Criterios (Gherkin):**

```gherkin
Dado un caso 70123456 existente en la central del usuario de servicio
Cuando el actor pregunta «estado del caso 70123456»
Entonces la respuesta contiene estado actual y sin direcciones/nombres de clientes en listados
Y no se registra ningún evento en el caso.

Dado la consulta «resumen del dia»
Cuando se procesa
Entonces la respuesta contiene los contadores del día de la central configurada
Y la operación fue de solo lectura (0 escrituras en `caso`).
```

**Trazabilidad:** RF-30, RNF-18 (minimización de PII), R-AV-6. Test: `consultas.test.js`.

---

## CU-AV-05 — Historial y cierre de turno

**Actor:** ACT-AV-O / sistema · **Ciclo:** C4

**Precondición:** sesiones registradas en `asistente_sesion` (tabla de la BD de GGTO).

**Flujo principal:** cada intercambio queda asociado a la sesión de turno (usuario, central,
tiempo) → al cerrar turno la sesión queda marcada y el historial es consultable; el uso/cuota
del día se acumula en Mongo (`proj_ggto`).

**Criterios (Gherkin):**

```gherkin
Dado un turno con 3 intercambios
Cuando se consulta el historial de la sesión
Entonces aparecen los 3 intercambios con fecha/hora y usuario
Y el contador de uso del día en Mongo refleja el consumo real.
```

**Restricción (EARS):** Mientras el turno esté abierto, el sistema registrará cada intercambio
antes de responder.

**Trazabilidad:** RNF-12 (auditabilidad), canon v2-A5, R-AV-5. Test: `consultas.test.js` (historial).

---

## CU-AV-06 — Conversar por Telegram con vista previa

**Actor:** ACT-AV-T · **Ciclo:** C5 · **Ruta:** `POST /telegram` (webhook con `secret_token`)

**Precondición:** webhook registrado con `secret_token` ≥ 32 chars; remitente en
`asistente_remitente` (chat_id ↔ p00 ↔ central); dentro de cuota.

**Flujo principal:** mensaje del remitente → el webhook valida `secret_token` y remitente →
intención → Telegram recibe la **vista previa** (ficha) y la instrucción de confirmar
escribiendo `CONFIRMAR` (o el texto de corrección).

**Alternativos:** secret_token inválido → 403 sin proceso; remitente no autorizado →
ignorado sin respuesta ni gasto (R-AV-3); fuera de cuota → 429 (R-AV-4).

**Criterios (Gherkin):**

```gherkin
Dado un remitente autorizado con chat_id registrado
Cuando envía «alta cliente 70123456»
Entonces recibe la vista previa de la ficha y la instrucción de confirmación
Y nada se aplica hasta que escriba CONFIRMAR.

Dado un chat_id que NO está en asistente_remitente
Cuando envía un mensaje al webhook
Entonces no recibe respuesta, no se consulta el Gateway y no se gasta cuota.
```

**Restricciones (EARS):** ver R-AV-2, R-AV-3, R-AV-4.

**Trazabilidad:** RNF-AV (canon), RF-16 (canal Telegram), RNF-11. Test: `telegram.test.js`.

---

## CU-AV-07 — Confirmar escritura desde Telegram

**Actor:** ACT-AV-T · **Ciclo:** C5

**Precondición:** vista previa pendiente de ese chat (CU-AV-06).

**Flujo principal:** el remitente escribe `CONFIRMAR` → el asistente aplica la ficha pendiente
por el camino canónico (CU-AV-02/03) → responde por Telegram con el resultado (201 / evento
aplicado / 422 faltantes).

**Criterios (Gherkin):**

```gherkin
Dado una vista previa ALTA_CASO pendiente para el chat
Cuando el remitente escribe CONFIRMAR
Entonces el caso se crea por POST /api/v1/casos y el chat recibe la referencia
Y la ficha pendiente se consume (un segundo CONFIRMAR no duplica).
```

**Restricción (EARS):** Si no existe vista previa pendiente, entonces el sistema responderá
que no hay operación por confirmar.

**Trazabilidad:** RNF-AV-06, RF-32/RF-31. Test: `telegram.test.js`, `confirmar.test.js`.

---

## CU-AV-08 — Gestionar sesiones del asistente (lado GGTO)

**Actor:** ACT-01 (SUPERVISOR/ADMIN) · **Ruta:** `POST/GET /api/v1/asistente/sesiones` · Ciclo C4

**Precondición:** sesión válida con rol ADMIN o SUPERVISOR (`_acceso`).

**Flujo principal:** abrir sesión de turno (`POST /sesiones`) y consultar sesiones/historial
(`GET /sesiones`), acotado a su central (recinto).

**Criterios (Gherkin):**

```gherkin
Dado un usuario SUPERVISOR de la central 2324X
Cuando consulta GET /api/v1/asistente/sesiones
Entonces recibe solo sesiones de su central
Y un COORDINADOR o TECNICO obtiene 403.
```

**Trazabilidad:** RNF-21, RNF-12, R-AV-5. Test: `app/tests/test_asistente.py` (se integra).

---

## CU-AV-09 — Gestionar remitentes de Telegram (alta/edición)

**Actor:** ACT-04 (`SUPER`) · **Ruta:** `POST/GET/PATCH /api/v1/asistente/remitentes` · Ciclo C5

**Precondición:** sesión SUPER (`_solo_super`).

**Flujo principal:** SUPER registra un remitente (chat_id, p00, central) o edita/desactiva;
solo así el chat puede conversar (CU-AV-06).

**Criterios (Gherkin):**

```gherkin
Dado un SUPER con sesión válida
Cuando da de alta el chat_id -100123 con p00 TECG001 y central 2324X
Entonces el remitente queda activo en asistente_remitente
Y desde ese momento ese chat puede recibir vistas previas.

Dado un usuario SUPERVISOR (no SUPER)
Cuando intenta POST /api/v1/asistente/remitentes
Entonces recibe 403.
```

**Restricción (EARS):** El alta de remitentes quedará reservada exclusivamente al rol SUPER.

**Trazabilidad:** RNF-21, H-15, canon C5. Test: `app/tests/test_asistente.py`.

---

## CU-AV-10 — Límites de uso y cuota

**Actor:** sistema · **Ciclo:** C1 (core)

**Flujo principal:** cada mensaje autenticado suma al contador de la sesión/día en Mongo;
30/min y 500/día por chat; exceder → 429.

**Criterios (Gherkin):**

```gherkin
Dado un chat que ya envió 30 mensajes en el último minuto
Cuando envía el mensaje 31
Entonces recibe 429 y el mensaje no se procesa
Y al pasar la ventana el chat vuelve a funcionar.
```

**Restricción (EARS):** ver R-AV-4.

**Trazabilidad:** RNF-AV (cuota v2-A5), RNF-19 (métricas). Test: `core.test.js`.
