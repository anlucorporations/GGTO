# Casos de Uso — Incremento D-81 (log de sincronización · mensajería interna · panel diario)

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** (CANTV · Francisco Salias) |
| Alcance | Incremento **D-81** — RF-39…RF-44 (ver `incremento_D81_sync_mensajeria_panel.md`) |
| Notación | **Gherkin** (comportamiento) + **EARS** (restricciones del sistema) |
| Actores | **SUPER/ADMIN/SUPERVISOR**, **TÉCNICO**, **SISTEMA** |
| Revisión | **v0.2** — incorpora la auditoría `auditoria_D81_casos_uso.md` (H-01…H-38) |
| Regla | Un CU por objetivo de actor; todo criterio **testeable** con cifras; cada CU enlaza sus RF/RNF/RT. |

> **Convención de actores:** donde aparece **SUPER/ADMIN/SUPERVISOR** los tres pueden operar
> (SUPER por acceso total `deps.py`; ADMIN y SUPERVISOR por la matriz RBAC, que este incremento
> **amplía** — ver §Trazabilidad y `requerimientos.md` §5.2). El **TÉCNICO** solo **recibe** mensajes
> y **ejecuta** la sincronización; **no** envía mensajes ni consulta el log.
> **EARS:** las restricciones del sistema (plantillas *Ubicuo / Dirigido por evento / Por estado /
> Opción / Característica no deseada*) van en bloque **EARS**; los códigos HTTP concretos (403/404/409/422)
> viven en los **escenarios Gherkin**, no en EARS.

---

## Índice de casos de uso

| CU | Nombre | Actor | RF | RNF/RT |
|---|---|---|---|---|
| CU-D81-01 | Registrar una sesión de sincronización | SISTEMA / TÉCNICO | RF-39 | RNF-19 |
| CU-D81-02 | Consultar el log de sincronizaciones | SUPER/ADMIN/SUPERVISOR | RF-39 | RNF-21, RNF-28 |
| CU-D81-03 | Ejecutar y mostrar el checklist de sincronización | TÉCNICO | RF-40 | RNF-19 |
| CU-D81-04 | Enviar un mensaje interno | SUPER/ADMIN/SUPERVISOR | RF-41 | RNF-21, RNF-28 |
| CU-D81-05 | Recibir mensajes internos y su contador (20 s) | TÉCNICO | RF-41 | RNF-26, RT-15 |
| CU-D81-06 | Generar mensajes automáticos | SISTEMA | RF-41 | RNF-19 |
| CU-D81-07 | Purgar mensajes y log vencidos | SISTEMA | RF-39, RF-41 | RNF-19 |
| CU-D81-08 | Auto-refresco del panel (30 s) | SUPER/ADMIN/SUPERVISOR | RF-42 | RNF-26, RNF-27 |
| CU-D81-09 | Ver la gestión diaria (Asignadas vs. Cerradas) | SUPER/ADMIN/SUPERVISOR | RF-43 | RNF-27 |
| CU-D81-10 | Alta manual de un Caso Especial | SUPER/ADMIN/SUPERVISOR | RF-44 | RNF-21 |
| CU-D81-11 | Consultar la bandeja de mensajes enviados | SUPER/ADMIN/SUPERVISOR | RF-41 | RNF-28 |

---

## CU-D81-01 — Registrar una sesión de sincronización

- **Actor primario:** SISTEMA (a petición de la APK del **TÉCNICO**).
- **Precondición:** el técnico está autenticado (token válido).
- **Disparador:** la APK inicia una acción de **DESCARGA** o **CARGA**.
- **RF:** RF-39 · **RNF:** RNF-19.

**Flujo principal**
1. La APK llama `POST /sync/sesion` con `{tipo ∈ {DESCARGA, CARGA}, dispositivo_id, version_app}`.
2. El SISTEMA crea **exactamente 1** fila en `sync_log`: `estado = EN_PROCESO`, `iniciado_en = now()`,
   `recibidos = procesados = errores = 0`, `finalizado_en = NULL`, `id_cuadrilla` = cuadrilla activa
   (o `NULL`), y responde `201 {id_sync_log}`.
3. La APK ejecuta la operación enviando `id_sync_log`.
4. La APK llama `PATCH /sync/sesion/{id}` con `{recibidos, procesados, errores, estado, detalle, checklist}`.
5. El SISTEMA fija `finalizado_en`, `duracion_ms`, `estado` (`OK`/`PARCIAL`/`ERROR`) e inserta el `sync_check`.

**Flujos alternativos**
- **A1 (timeout):** si la sesión sigue `EN_PROCESO` más de `sync.timeout_min` (10 min), el job
  `POST /mantenimiento/cerrar-sesiones` la cierra con `estado = ERROR`, `finalizado_en = now()`,
  `duracion_ms ≈ (now − iniciado_en)` y `detalle.motivo = "sesión abandonada"`.
- **A2 (sin cuadrilla activa):** `id_cuadrilla = NULL`; el cierre fija `estado = ERROR` y
  `detalle.motivo = "sin_cuadrilla"`.
- **A3 (doble cierre):** `PATCH` sobre una sesión ya cerrada → `409`; no se reescriben `finalizado_en`
  ni `duracion_ms`.

**Criterios de aceptación (Gherkin)**
```gherkin
Antecedentes:
  Dado un técnico autenticado con p00 "T1234" y cuadrilla activa C-01

Escenario: Abrir una sesión de DESCARGA
  Cuando la APK llama POST /sync/sesion con {tipo:"DESCARGA", dispositivo_id:"DEV-01", version_app:"1.0"}
  Entonces hay exactamente 1 fila en sync_log con p00="T1234", id_cuadrilla=C-01, tipo="DESCARGA",
    estado="EN_PROCESO", recibidos=0, procesados=0, errores=0, finalizado_en nulo
  Y la respuesta 201 devuelve id_sync_log entero > 0

Esquema del escenario: Cerrar una sesión
  Cuando la APK llama PATCH /sync/sesion/{id} con recibidos=<r>, procesados=<p>, errores=<e>
  Entonces sync_log queda con estado=<estado>, recibidos=<r>, procesados=<p>, errores=<e>
  Y finalizado_en >= iniciado_en y duracion_ms > 0

  Ejemplos:
    | r  | p  | e | estado  |
    | 12 | 12 | 0 | OK      |
    | 10 |  8 | 2 | PARCIAL |
    |  0 |  0 | 5 | ERROR   |

Escenario: Abrir una sesión con tipo inválido
  Cuando la APK llama POST /sync/sesion con {tipo:"SYNC_WEB"}
  Entonces la respuesta es 422 con detail que enumera los tipos admitidos (DESCARGA, CARGA)
  Y no se crea ninguna fila en sync_log

Escenario: Cerrar por timeout una sesión abandonada (sync.timeout_min = 10)
  Dado un id_sync_log con iniciado_en = now() - 11 minutos y estado "EN_PROCESO"
  Cuando se ejecuta POST /mantenimiento/cerrar-sesiones
  Entonces esa fila queda con estado="ERROR", finalizado_en no nulo,
    duracion_ms ≈ 660000 (±60000) y detalle.motivo="sesión abandonada"

Escenario: Cerrar una sesión sin cuadrilla activa
  Dado un técnico autenticado sin cuadrilla activa
  Cuando abre y cierra una sesión de tipo "CARGA" con 0 recibidos
  Entonces la fila queda con id_cuadrilla nulo, estado="ERROR", errores=0 y detalle.motivo="sin_cuadrilla"

Escenario: Doble cierre de la misma sesión
  Dado un id_sync_log ya cerrado
  Cuando la APK vuelve a llamar PATCH /sync/sesion/{id}
  Entonces la respuesta es 409 y finalizado_en y duracion_ms no cambian
```

**Restricciones (EARS)**
- **EARS-01-1 (Ubicuo):** *El sistema deberá* crear **exactamente 1** fila por sesión (alta en `POST`, cierre en `PATCH` sobre la misma fila).
- **EARS-01-2 (Dirigido por evento):** *Si* una sesión permanece `EN_PROCESO` más de `sync.timeout_min`, *entonces* el sistema la cerrará como `ERROR`.
- **EARS-01-3 (Ubicuo):** *El sistema deberá* admitir únicamente los tipos `DESCARGA` y `CARGA`.

---

## CU-D81-02 — Consultar el log de sincronizaciones

- **Actor primario:** **SUPER/ADMIN/SUPERVISOR**.
- **Precondición:** el usuario tiene rol ADMIN/SUPERVISOR/SUPER y sesión válida.
- **RF:** RF-39 · **RNF:** RNF-21, RNF-28.

**Flujo principal**
1. El supervisor abre **SISTEMAS → Sincronización** (web) o la sección equivalente en la APK.
2. El SISTEMA devuelve una lista **paginada** (`total`, `page`, `page_size`) con fecha, `P00`,
   cuadrilla, tipo, estado, duración y contadores.
3. El supervisor filtra (rango de fechas, `P00`, cuadrilla, tipo, estado) y ordena.
4. Al seleccionar una fila, el SISTEMA muestra el detalle (`detalle` JSON + `sync_check`).

**Flujos alternativos**
- **A1 (sin resultados):** lista vacía con `total = 0`.
- **A2 (token expirado/revocado):** `401` y re-login.

**Criterios de aceptación (Gherkin)**
```gherkin
Dado un supervisor autenticado
Cuando abre SISTEMAS → Sincronización
Entonces ve la lista paginada con total, page y page_size

Dado que hoy hay 7 sesiones (2 en "ERROR", 5 en "OK") y 3 en "ERROR" de ayer
Cuando filtra por estado="ERROR" y desde=hasta=hoy, con page_size=10
Entonces total=2 y la lista tiene 2 elementos, todos estado="ERROR" con iniciado_en dentro de hoy
Y ninguna sesión de ayer aparece

Dado un usuario con rol TECNICO
Cuando solicita GET /sincronizaciones
Entonces el sistema responde 403

Dado un supervisor de la central A
Cuando consulta GET /sincronizaciones con sesiones de la central B
Entonces no obtiene ninguna fila de la central B
```

**Restricciones (EARS)**
- **EARS-02-1 (Ubicuo):** *El sistema deberá* restringir la consulta del log a ADMIN/SUPERVISOR/SUPER.
- **EARS-02-2 (De acuerdo con RNF-21):** el log se devuelve **acotado a la central del usuario**.

---

## CU-D81-03 — Ejecutar y mostrar el checklist de sincronización

- **Actor primario:** TÉCNICO (en la APK); el resultado se **consulta** en web (SISTEMAS → Sincronización).
- **Precondición:** la APK inicia una sincronización. Si el servidor no es alcanzable, el checklist se **calcula en local** y se intenta reportar al reconectar.
- **RF:** RF-40.

**Flujo principal**
1. Al iniciar la sincronización, se comprueban **4 pasos**: (a) conexión GCP (`GET /ready`),
   (b) login (`GET /auth/me`), (c) descarga, (d) carga.
2. Cada paso se marca **OK / ERROR** con su **hora** y el **detalle** del fallo.
3. El resultado se guarda en `sync_check` ligado a la `sync_log` (al cerrar la sesión).
4. La APK muestra el checklist en **"Dispositivo"**; la web en la ficha de la sesión.

**Flujos alternativos**
- **A1 (sin conexión):** el paso (a) = ERROR; (c) y (d) **no se intentan** ni en el flujo (quedan en ERROR/false). La sesión se cierra `ERROR` con el `sync_check` reportado al reconectar (o queda sin fila si nunca hubo servidor).
- **A2 (token expirado):** el paso (b) = ERROR y se solicita re-login.

**Criterios de aceptación (Gherkin)**
```gherkin
Dado que la APK inicia una sincronización con el servidor GCP disponible
Cuando ejecuta el checklist
Entonces los 4 pasos quedan en "OK" con su hora no nula
Y existen 4 filas en sync_check (CONEXION, LOGIN, DESCARGA, CARGA), todas con estado="OK" y fecha_hora no nula

Dado que GET /ready responde timeout a los 5 s
Cuando la APK ejecuta el checklist (y lo sube al reconectar)
Entonces la fila sync_check paso="CONEXION" queda con estado="ERROR" y detalle.conexion con el código de error
Y las filas paso="LOGIN", "DESCARGA" y "CARGA" quedan en estado="OMITIDO"
Y sync_log.estado="ERROR"

Dado un checklist ejecutado y guardado
Cuando el supervisor abre la ficha de esa sesión en SISTEMAS
Entonces ve el resultado de los 4 pasos con su hora
```

**Restricciones (EARS)**
- **EARS-03-1 (Ubicuo):** *El sistema deberá* ejecutar el checklist **automáticamente** en cada sincronización (sin botón manual).

---

## CU-D81-04 — Enviar un mensaje interno

- **Actor primario:** **SUPER/ADMIN/SUPERVISOR**.
- **Precondición:** rol ADMIN/SUPERVISOR/SUPER y sesión válida.
- **RF:** RF-41 · **RNF:** RNF-21, RNF-28.

**Flujo principal**
1. El supervisor escribe un mensaje corto (≤ 500 caracteres).
2. Elige destino: **TODOS**, **CUADRILLA** o **TECNICO**.
3. Confirma. El SISTEMA crea el `mensaje` con `tipo = TEXTO`, `origen_p00`, destino y
   `expira_en = creado_en + INTERVAL '1 day' * config('mensajeria.retencion_dias')`.

**Flujos alternativos**
- **A1 (texto vacío / > 500):** `422`; no se crea fila.
- **A2 (destino CUADRILLA/TECNICO sin id):** `422`.
- **A3 (id inexistente o de otra central):** `404`; no se crea fila.
- **A4 (token expirado):** `401` y re-login.

**Criterios de aceptación (Gherkin)**
```gherkin
Dado un supervisor autenticado con p00="S01" y 12 técnicos en su central
Cuando envía {destino_tipo:"TODOS", cuerpo:<120 caracteres>}
Entonces se crea exactamente 1 fila en mensaje con tipo="TEXTO", origen_p00="S01",
  destino_tipo="TODOS", id_cuadrilla nulo, id_tecnico nulo
Y expira_en = creado_en + 5 días (±1 s)
Y GET /mensajes devuelve ese mensaje a cada uno de los 12 técnicos

Dado que el contador de mensaje es 40
Cuando el supervisor envía cuerpo="" (y en otro caso cuerpo de 501 caracteres)
Entonces responde 422 con detail que indica el límite de 500
Y el contador de mensaje sigue en 40

Dado un supervisor autenticado
Cuando envía un mensaje con id_cuadrilla inexistente
Entonces responde 404
Y no se crea ninguna fila en mensaje

Dado un supervisor de la central A
Cuando envía un mensaje dirigido a una cuadrilla de la central B
Entonces responde 404/403
Y no se crea ninguna fila en mensaje

Dado un usuario con rol TECNICO
Cuando intenta POST /mensajes
Entonces el sistema responde 403
```

**Restricciones (EARS)**
- **EARS-04-1 (Ubicuo):** *El sistema deberá* permitir el envío de mensajes internos solo a ADMIN/SUPERVISOR/SUPER.
- **EARS-04-2 (Por estado):** *Mientras* el `destino_tipo` sea CUADRILLA o TECNICO, el sistema exigirá su identificador.
- **EARS-04-3 (Característica no deseada):** *El sistema no deberá* habilitar la **respuesta** del TÉCNICO (mensajería unidireccional).

---

## CU-D81-05 — Recibir mensajes internos y su contador (sondeo 20 s)

- **Actor primario:** TÉCNICO (APK); **en la web** el sondeo aplica a cualquier rol autenticado con bandeja de recepción.
- **Precondición:** sesión válida.
- **RF:** RF-41 · **RNF:** RNF-26 · **RT:** RT-15.

**Flujo principal**
1. La app ejecuta un **sondeo incremental** cada **20 s**: `GET /mensajes?desde=<último id>`.
2. El SISTEMA devuelve solo los mensajes nuevos dirigidos al usuario (TODOS + su cuadrilla + él mismo),
   vigentes (`expira_en >= now()`), ordenados por `id`, con `leido` (boolean).
3. La app muestra los mensajes y actualiza el **contador de no leídos** (`GET /mensajes/no-leidos`).
4. Al **abrir** un mensaje, la app llama `POST /mensajes/{id}/leido` (**idempotente**).

**Flujos alternativos**
- **A1 (sin novedades):** lista vacía (payload mínimo).
- **A2 (sin conexión):** conserva los ya recibidos y reintenta en el próximo ciclo.
- **A3 (mensaje expirado):** no se entrega.
- **A4 (técnico sin cuadrilla activa):** recibe solo los `TODOS` y los `TECNICO` dirigidos a él;
  no es error y no recibe los `CUADRILLA`.
- **A5 (token expirado):** `401`; la app pausa el sondeo y pide re-login.

**Criterios de aceptación (Gherkin)**
```gherkin
Dado un técnico con id_tecnico=77, cuadrilla activa C-01 y último id visto=10
Y existen los mensajes 11 (TECNICO 77), 12 (CUADRILLA C-01), 13 (CUADRILLA C-99) y
  14 (TECNICO 77, expira_en = ayer)
Cuando ejecuta GET /mensajes?desde=10
Entonces recibe [11, 12] en ese orden, ambos con leido=false
Y no recibe 13 ni 14

Dado un técnico sin cuadrilla activa, con mensajes TODOS, CUADRILLA y TECNICO dirigidos a él
Cuando ejecuta GET /mensajes?desde=0
Entonces recibe los mensajes TODOS y TECNICO
Y no recibe ninguno con destino_tipo="CUADRILLA"
Y la respuesta es 200 (no es error)

Dado el mensaje 12 (CUADRILLA C-01) sin leer, con 2 técnicos en C-01 (77 y 78)
Cuando el técnico 77 ejecuta POST /mensajes/12/leido
Entonces mensaje_destino tiene (12, 77) con leido_en no nulo
Y el contador de no leídos de 77 baja de 3 a 2, y el de 78 sigue en 3
Y al repetir la llamada responde 200 sin cambiar leido_en ni el contador
```

**Restricciones (EARS)**
- **EARS-05-1 (Ubicuo):** *El sistema deberá* entregar los mensajes por sondeo **incremental**, sin reenviar los ya vistos.
- **EARS-05-2 (Por estado):** *Mientras* un mensaje esté vencido, el sistema no lo entregará.
- **EARS-05-3 (Ubicuo):** *El sistema deberá* registrar la lectura de forma **idempotente** por `(id_mensaje, id_tecnico)`.

---

## CU-D81-06 — Generar mensajes automáticos

- **Actor primario:** SISTEMA (jobs).
- **RF:** RF-41 · **RNF:** RNF-19.

**Precondiciones (por disparador)**
- **(a) Recordatorio de cita:** existe ≥1 `cita` de la **fecha de hoy** con `recordatorio_enviado_en = NULL`
  y su `id_cuadrilla` no nulo.
- **(b) Estado de sync:** existe una sesión `sync_log` recién cerrada **sin** mensaje `ESTADO_SYNC` emitido.
- **(c) Alarma de despacho:** existe una `falla_masiva` (u `orden_material`) cuyo **sector de la falla
  pertenece a los sectores de los despachos de la fecha**, y no se emitió ya su alarma.

**Flujo principal (tres disparadores idempotentes)**
1. **(a)** `POST /mantenimiento/recordatorios-citas`, N minutos antes (por defecto `mensajeria.recordatorio_cita_min` = 60)
   de una cita del día → `mensaje` tipo `RECORDATORIO_CITA`, destino **CUADRILLA** de la cita; marca
   `cita.recordatorio_enviado_en = now()`.
2. **(b)** al cerrar una sesión → `mensaje` tipo `ESTADO_SYNC`, destino **TECNICO**, resumen (OK/PARCIAL/ERROR, contadores).
   Idempotente por `id_sync_log`.
3. **(c)** `POST /mantenimiento/alarmas-despacho`: por cada falla cuyo sector esté en los sectores despachados
   de la fecha → `mensaje` tipo `ALARMA_DESPACHO`, destino **CUADRILLA**; idempotente por `falla_masiva.id_falla`.

**Flujos alternativos**
- **A1 (destinatario irresoluble):** no se genera el mensaje; se registra el motivo en el log del job.

**Criterios de aceptación (Gherkin)**
```gherkin
Dada una cita de C-01 hoy a las 10:00 sin recordatorio previo
Cuando el job de recordatorios se ejecuta a las 09:00 y de nuevo a las 09:20
Entonces existe 1 mensaje "RECORDATORIO_CITA" con el id_caso de esa cita
Y cita.recordatorio_enviado_en no es nulo
Y la segunda ejecución no crea filas

Dado que un técnico cerró su sincronización (id_sync_log=50) con estado "PARCIAL"
Cuando el sistema procesa el cierre
Entonces crea exactamente 1 mensaje "ESTADO_SYNC" dirigido a ese técnico con el resumen
Y reprocesar el cierre del id_sync_log=50 no crea otro mensaje

Dado el despacho de hoy: C-02 cubre [Norte 1, Norte 2] y C-03 cubre [Sur 1]
Y existe 1 falla masiva en "Norte 1"
Cuando se ejecuta POST /mantenimiento/alarmas-despacho
Entonces se crea 1 mensaje "ALARMA_DESPACHO" con id_cuadrilla=C-02
Y no se crea ningún mensaje para C-03

Dado que la cuadrilla destino no se puede resolver
Cuando el job intenta emitir el mensaje
Entonces no se crea mensaje y se registra el motivo en el log del job
```

**Restricciones (EARS)**
- **EARS-06-1 (Dirigido por evento):** *Cuando* falten N minutos para una cita del día, el sistema emitirá su recordatorio.
- **EARS-06-2 (Por estado):** *Si* ya se emitió el mensaje de un evento (cita, cierre o falla), *entonces* el sistema no lo emitirá de nuevo.
- **EARS-06-3 (De acuerdo con RF-41):** la alarma se dirige **solo** a la cuadrilla cuyo despacho de la fecha cubre el sector afectado.

---

## CU-D81-07 — Purgar mensajes y log vencidos

- **Actor primario:** SISTEMA (job programado `POST /mantenimiento/purgar`).
- **RF:** RF-39, RF-41 · **RNF:** RNF-19.

**Flujo principal**
1. El SISTEMA borra los `mensaje` con `expira_en < now()` (retención = `config('mensajeria.retencion_dias')`, por defecto 5 días)
   **cuyos destinatarios ya leyeron** (todas las filas de `mensaje_destino` con `leido_en` no nulo).
2. El SISTEMA borra las `sync_log` más antiguas que `config('sync_log.retencion_dias')` (90 días),
   con borrado **en cascada** de sus `sync_check`.
3. Registra el resultado (`mensajes_eliminados`, `sync_log_eliminadas`) en el log y en `/metricas`.

**Flujos alternativos**
- **A1 (fallo del job):** no borra nada (`rollback`), registra el error y emite alerta.
- **A2 (mensaje vencido con destinatarios sin leer):** **se conserva** hasta que lo lean o hasta el tope de
  seguridad `config('mensajeria.retencion_max_dias')` (por defecto 30 días), lo que ocurra primero; se
  registra el conteo de mensajes conservados por no leídos.
- **A3 (purga parcial por lotes):** borra en lotes acotados (p. ej. 1000) hasta agotar; interrumpible sin corromper.

**Criterios de aceptación (Gherkin)**
```gherkin
Dado un mensaje con creado_en = now() - 121 h y expira_en = creado_en + 120 h (retención=5),
  con 2 filas en mensaje_destino ya leídas (leido_en no nulo)
Cuando se ejecuta POST /mantenimiento/purgar
Entonces ese mensaje y sus 2 destinos no existen
Y sigue existiendo el mensaje con expira_en = now() + 1 h

Dado un mensaje vencido (expira_en < now()) con 1 destino leído y otro sin leer
Cuando se ejecuta POST /mantenimiento/purgar
Entonces el mensaje NO se elimina (se conserva por tener un destinatario sin leer)
Y no se elimina el destino pendiente

Dada una sync_log con finalizado_en = now() - 91 días y 3 filas en sync_check
Cuando se ejecuta POST /mantenimiento/purgar con sync_log.retencion_dias=90
Entonces no existe la fila en sync_log
Y sus 3 filas en sync_check se eliminaron en cascada
Y la respuesta reporta sync_log_eliminadas >= 1

Dado el job de purga con una tabla bloqueada
Cuando se ejecuta y falla a mitad
Entonces no se elimina ninguna fila (rollback) y se registra el error
```

**Restricciones (EARS)**
- **EARS-07-1 (Dirigido por evento):** *Cuando* un mensaje supere `mensajeria.retencion_dias` **y todos sus destinatarios lo hayan leído** (o supere `mensajeria.retencion_max_dias`), el sistema lo eliminará.
- **EARS-07-2 (Dirigido por evento):** *Cuando* una `sync_log` supere `sync_log.retencion_dias`, el sistema la eliminará (en cascada con su `sync_check`).

---

## CU-D81-08 — Auto-refresco del panel (30 s)

- **Actor primario:** **SUPER/ADMIN/SUPERVISOR** (web).
- **Precondición:** el usuario está en la pantalla principal del panel con sesión válida.
- **RF:** RF-42 · **RNF:** RNF-26, RNF-27.

**Flujo principal**
1. La web inicia un temporizador de **30 s** (`panel.sync_segundos`) para refrescar los datos del panel.
2. Cada 30 s, sin recargar la página, solicita los datos y los repinta.
3. Si la pestaña no está visible, el refresco se **pausa**; al volver, se dispara **un refresco inmediato** y luego el ciclo de 30 s.
4. Al desmontar el componente o cerrar sesión, el temporizador se **cancela**.

**Flujos alternativos**
- **A1 (petición en curso):** el siguiente ciclo no se solapa (máx. 1 petición en vuelo).
- **A2 (error de red):** conserva los últimos datos y reintenta en el siguiente ciclo.
- **A3 (token expirado/401):** cancela el temporizador, muestra aviso y redirige a login.

**Criterios de aceptación (Gherkin)**
```gherkin
Dado un supervisor en la pantalla del panel
Cuando transcurren 30 segundos
Entonces los datos del panel se actualizan sin recargar la página

Dado el panel visible con auto-refresco activo
Cuando la pestaña pasa a segundo plano durante 120 s y vuelve
Entonces durante la ocultación la API recibe 0 peticiones del panel
Y en los 30 s posteriores al retorno recibe 1 petición (sin esperar el ciclo completo)

Dado el panel con auto-refresco de 30 s y una respuesta del endpoint que tarda 70 s
Cuando vencen dos temporizadores durante esa respuesta
Entonces la API recibe exactamente 1 petición del panel en ese intervalo
Y tras la respuesta, el siguiente ciclo empieza 30 s después

Dado el panel con la mensajería cerrada y abierto durante 60 s
Cuando se instrumenta el tráfico de red
Entonces hay 0 peticiones con periodo de 20 s (solo la mensajería usa 20 s)

Escenario: Token expirado durante un ciclo
  Dado el panel con auto-refresco activo
  Cuando el endpoint responde 401
  Entonces el temporizador se cancela y se redirige al login
```

**Restricciones (EARS)**
- **EARS-08-1 (Ubicuo):** *El sistema deberá* refrescar el panel cada `panel.sync_segundos` (30 s) sin recarga completa.
- **EARS-08-2 (Por estado):** *Mientras* la pestaña no esté visible, el sistema pausará el auto-refresco.
- **EARS-08-3 (Característica no deseada, RNF-26):** *El sistema no deberá* auto-refrescar a 20 s ningún otro componente distinto de la mensajería.

---

## CU-D81-09 — Ver la gestión diaria (Asignadas vs. Cerradas)

- **Actor primario:** **SUPER/ADMIN/SUPERVISOR**.
- **Precondición:** el usuario tiene rol autorizado y sesión válida.
- **RF:** RF-43 · **RNF:** RNF-27.

**Flujo principal**
1. El supervisor abre la **pantalla principal del panel**.
2. Selecciona **fecha** (por defecto hoy) y **modo**: **Común** o **Referidos**.
3. El SISTEMA muestra, por cada cuadrilla: **Asignadas** vs. **Cerradas**, con totales y porcentaje.
4. La vista se auto-refresca cada 30 s (CU-D81-08).

**Reglas de negocio (E-04 / H-30)**
- **Asignadas** = casos con fila en `despacho_caso` de los despachos de la fecha.
- **Cerradas** = de esos, los que tienen `caso.estado_actual = 'CERRADO'` **en el momento de la consulta**
  (independientemente de cuándo se cerraron).
- **Modo Común** = casos con `caso.categoria = 'RESIDENCIAL'`.
- **Modo Referidos** = `caso_especial.clasificacion = 'REFERIDO'`.
- Los casos **EMPRESA/GOBIERNO** no entran en ninguno de los dos modos del panel (tienen su propia sección).

**Flujos alternativos**
- **A1 (sin despacho para la fecha):** filas en cero, HTTP 200.
- **A2 (fecha inválida o futura fuera de rango):** `422`.
- **A3 (cuadrilla sin casos):** fila con 0/0.
- **A4 (token expirado):** `401` y re-login.

**Criterios de aceptación (Gherkin)**
```gherkin
Dado que el despacho de hoy asignó 10 casos de categoría RESIDENCIAL a C-01 y 4 ya están CERRADO
Cuando el supervisor abre GET /panel/gestion-diaria?fecha=hoy&modo=COMUN
Entonces la fila "C-01" muestra asignadas=10, cerradas=4, porcentaje=40.0

Dado el despacho de hoy para C-02 con 6 casos: 2 REFERIDO (1 CERRADO) y 4 RESIDENCIAL
Cuando consulta modo=REFERIDOS
Entonces la fila C-02 muestra asignadas=2, cerradas=1, porcentaje=50.0
Y en modo=COMUN muestra asignadas=4

Dado que no existe despacho para la fecha consultada
Cuando el supervisor abre el panel para esa fecha
Entonces recibe 200 con todas las cuadrillas en asignadas=0 y cerradas=0

Dado el panel en modo "Común" para hoy con C-01 = (10 asignadas, 4 cerradas)
Cuando se cierra el caso A (queda CERRADO en BD) y transcurren 31 s
Entonces la fila C-01 muestra cerradas=5 sin recarga de página
Y el total del día pasa de 4 a 5

Escenario: Fecha inválida
  Cuando consulta GET /panel/gestion-diaria?fecha=2020-13-40
  Entonces responde 422
```

**Restricciones (EARS)**
- **EARS-09-1 (De acuerdo con E-04):** Asignadas = despacho de la fecha; Cerradas = `caso.estado_actual = 'CERRADO'` al momento de la consulta.
- **EARS-09-2 (Por estado):** *Mientras* el modo sea Referidos, el sistema contará solo los casos clasificados `REFERIDO`.
- **EARS-09-3 (De acuerdo con RNF-21):** el panel se acota a la central del usuario.

---

## CU-D81-10 — Alta manual de un Caso Especial

- **Actor primario:** **SUPER/ADMIN/SUPERVISOR**.
- **Precondición:** rol autorizado y sesión válida; existe la central.
- **RF:** RF-44 · **RNF:** RNF-21.

**Flujo principal**
1. El supervisor pulsa **«Agregar caso especial»** en el panel.
2. Se abre el formulario (reutiliza el de ESPECIALES): clasificación (REFERIDO/EMPRESA/GOBIERNO),
   tipo de actividad, prioridad y solicitante.
3. Al no indicarse `id_caso`, el SISTEMA crea el caso asociado con
   `id_averia = REF-<CÓDIGO_CENTRAL>-<NNNNNN>` (6 dígitos).
4. El caso especial queda disponible en **ESPECIALES** y para el despacho.

**Flujos alternativos**
- **A1 (validación):** falta la clasificación → `422`.
- **A2 (id_averia duplicado):** `409` (conforme a `routes_casos.py`).
- **A3 (rol no autorizado):** TÉCNICO → `403`.
- **A4 (token expirado):** `401` y re-login.

**Criterios de aceptación (Gherkin)**
```gherkin
Dado un supervisor autenticado de la central 2324X
Cuando da de alta un caso especial con clasificacion="REFERIDO", prioridad="ALTA",
  solicitante=S-1 y SIN id_caso
Entonces responde 201 y existe 1 caso con id_averia que cumple ^REF-2324X-\d{6}$ y categoria="REFERIDO"
Y el caso especial queda vinculado a ese id_caso
Y aparece en GET /especiales y en el despacho

Dado el formulario de caso especial
Cuando falta la clasificación
Entonces el sistema responde 422 y no crea el registro

Dado que ya existe el id_averia "REF-2324X-000001"
Cuando se intenta crear otro caso que lo genere
Entonces el sistema responde 409 y no lo duplica

Dado un usuario TECNICO
Cuando intenta dar de alta un caso especial
Entonces el sistema responde 403
```

**Restricciones (EARS)**
- **EARS-10-1 (Ubicuo):** *El sistema deberá* generar el `id_averia` con el patrón `REF-<CÓDIGO_CENTRAL>-<NNNNNN>` cuando no se indique el caso.
- **EARS-10-2 (De acuerdo con RNF-21):** el alta queda acotada a la central del usuario.

---

## CU-D81-11 — Consultar la bandeja de mensajes enviados

- **Actor primario:** **SUPER/ADMIN/SUPERVISOR**.
- **Precondición:** rol autorizado y sesión válida.
- **RF:** RF-41 · **RNF:** RNF-28.

**Flujo principal**
1. El supervisor abre su bandeja de enviados.
2. El SISTEMA devuelve los mensajes con `origen_p00` = el suyo, con fecha, destino, tipo y cuerpo.

**Flujos alternativos**
- **A1 (sin enviados):** lista vacía.
- **A2 (rol no autorizado):** TÉCNICO → `403`.

**Criterios de aceptación (Gherkin)**
```gherkin
Dado un supervisor con 3 mensajes enviados
Cuando abre GET /mensajes/bandeja
Entonces recibe 3 mensajes con origen_p00 igual al suyo

Dado un usuario TECNICO
Cuando solicita GET /mensajes/bandeja
Entonces el sistema responde 403
```

**Restricciones (EARS)**
- **EARS-11-1 (Ubicuo):** *El sistema deberá* restringir la bandeja de enviados al autor de los mensajes.

---

## Trazabilidad RF ↔ CU

| RF | Casos de uso |
|---|---|
| **RF-39** Log de sincronizaciones | CU-D81-01, CU-D81-02, CU-D81-07 |
| **RF-40** Checklist | CU-D81-03 |
| **RF-41** Mensajería interna | CU-D81-04, CU-D81-05, CU-D81-06, CU-D81-07, CU-D81-11 |
| **RF-42** Auto-sync 30 s | CU-D81-08 |
| **RF-43** Gestión diaria | CU-D81-09 |
| **RF-44** Alta de especiales | CU-D81-10 |

## Trazabilidad RNF/RT ↔ CU

| RNF/RT | Casos de uso |
|---|---|
| **RNF-19** (observabilidad) | CU-D81-01, CU-D81-06, CU-D81-07 |
| **RNF-21** (aislamiento por central/RLS) | CU-D81-02, CU-D81-04, CU-D81-05, CU-D81-09, CU-D81-10 |
| **RNF-26** (solo mensajería cada 20 s) | CU-D81-05, CU-D81-08 (escenario negativo) |
| **RNF-27** (auto-refresco 30 s, sin solape, pausa) | CU-D81-08, CU-D81-09 |
| **RNF-28** (RBAC log/mensajería) | CU-D81-02, CU-D81-04, CU-D81-11 |
| **RT-15** (sondeo incremental) | CU-D81-05 |
| **RT-16** (tablas `mensaje`/`mensaje_destino`/`sync_log`/`sync_check`) | CU-D81-01, CU-D81-04, CU-D81-05, CU-D81-06 |

> **Ampliación de la matriz RBAC (`requerimientos.md` §5.2) requerida por este incremento:**
> añadir las filas **«SISTEMAS → Sincronización (ver log + checklist)»** y
> **«MENSAJERÍA (enviar / recibir)»** y **«PANEL gestión diaria»** con SUPER/ADMIN/SUPERVISOR (y TECNICO
> solo *recibir*), y aclarar que la **inspección de BD de SISTEMAS** sigue **exclusiva de SUPER** (D-69).
