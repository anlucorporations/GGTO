# 05 — Despacho diario (módulo DESPACHO)

## Visión general (RF-08/RF-24/RF-25/RF-27, D-52)

El módulo **DESPACHO** arma, publica, imprime, envía y reporta el despacho diario de las
cuadrillas de la Central **FRANCISCO SALIAS** (`2324X`). Es el Ciclo 5 del proyecto y su
alcance funcional está declarado en el propio encabezado del router
(`app/api/routes_despachos.py:1`) y en la decisión **D-52**
(`RepoTecnico/estado_proyecto.md:123`), que lo da por completado con **96/96 pruebas**,
despliegue `ggto-web-00007-vsr` (imagen `v7`) y verificación en vivo.

### Alcance funcional

| Requisito | Descripción | Evidencia en código |
|---|---|---|
| **RF-08** | Distribuir el universo de averías entre las cuadrillas activas por día, agrupando por sector. | `app/api/routes_despachos.py:76-114` |
| **RF-24** | Proponer la distribución de casos antes de guardarla. | `app/api/routes_despachos.py:63-73`; `app/services/despacho.py:137-260` |
| **RF-25** | Excluir del despacho de calle los casos de la cuadrilla 0 (gestión del supervisor). | `app/services/despacho.py:4-5,115` |
| **RF-27** | Generar el reporte de producción (asignados, cerrados, citados, referidos, etc.). | `app/api/routes_despachos.py:361-426` |
| **RT-08** | Impresión tamaño carta de la ficha de la cuadrilla. | `app/api/routes_despachos.py:299-355` |
| **RF-09** | Registrar y listar fallas masivas desde el módulo de despacho. | `app/api/routes_despachos.py:135-171` |
| **RF-10** | Enviar la ficha de la cuadrilla por Telegram o correo. | `app/api/routes_despachos.py:432-483` |

### Archivos de referencia

| Capa | Archivo |
|---|---|
| Router FastAPI | `app/api/routes_despachos.py` |
| Servicio de propuesta y balanceo | `app/services/despacho.py` |
| Esquemas Pydantic | `app/schemas/despacho.py` |
| Modelos SQLAlchemy | `app/models/despacho_entities.py` |
| Notificaciones y *outbox* | `app/services/notificaciones.py`, `app/services/outbox.py` |
| Página web | `app/web/src/pages/Despacho.tsx` |
| Pruebas de integración | `app/tests/test_despacho_api.py` |

El router se monta en la aplicación principal con prefijo propio
(`app/main.py:82`) y declara su prefijo `/api/v1/despachos` y la etiqueta `despacho`
en `app/api/routes_despachos.py:41`. Las operaciones de escritura exigen los roles
`ADMIN` o `SUPERVISOR` mediante `require_roles(...)`
(`app/api/routes_despachos.py:42`; helper en `app/api/deps.py:52-72`).

---

## Modelo de despacho

El modelo persiste la **cabecera** por cuadrilla y el **detalle** de casos asignados.
El DDL oficial está en `RepoTecnico/db/schema.sql` y su descripción funcional en
`RepoTecnico/diccionario_datos.md:362-390`.

### despacho

Tabla cabecera: una fila por central, fecha y cuadrilla. Definida en
`RepoTecnico/db/schema.sql:441-456` y en `app/models/despacho_entities.py:24-44`.

| Campo | Tipo | Significado |
|---|---|---|
| `id_despacho` | `bigserial` PK | Identificador del despacho. |
| `id_central` | `integer` FK→`central` | Central del despacho. |
| `fecha` | `date` | Día de la jornada. |
| `id_cuadrilla` | `integer` FK→`cuadrilla` | Cuadrilla destino. |
| `estado` | `varchar(20)` | `BORRADOR` / `PUBLICADO` / `CERRADO` (`RepoTecnico/db/schema.sql:446-447`). |
| `generado_auto` | `boolean` | `true` si lo propuso el sistema (RF-24). |
| `enviado_canal` | `varchar(20)` | `TELEGRAM` / `CORREO` (`RepoTecnico/db/schema.sql:449`). |
| `enviado_en` | `timestamptz` | Marca temporal del envío o de la publicación. |
| `reporte_produccion_en` | `timestamptz` | Cierre previsto a las 04:00 p.m. (`RepoTecnico/db/schema.sql:451`). |
| `usuario_crea` | `varchar(20)` FK→`usuario.p00` | Usuario que generó el despacho. |
| `creado_en` / `actualizado_en` | `timestamptz` | Auditoría temporal. |

La restricción `UNIQUE (fecha, id_cuadrilla)` (`RepoTecnico/db/schema.sql:455`) garantiza
que no existan dos despachos de la misma cuadrilla en la misma fecha. En el ORM se declara
como `UniqueConstraint("fecha", "id_cuadrilla", name="despacho_fecha_id_cuadrilla_key")`
(`app/models/despacho_entities.py:40`). La relación con el detalle usa
`cascade="all, delete-orphan"` y carga anticipada `lazy="selectin"`
(`app/models/despacho_entities.py:42-44`).

### despacho_caso

Tabla de detalle: cada caso asignado dentro de un despacho. Definida en
`RepoTecnico/db/schema.sql:458-471` y en `app/models/despacho_entities.py:47-65`.

| Campo | Tipo | Significado |
|---|---|---|
| `id_despacho_caso` | `bigserial` PK | Identificador de la fila. |
| `id_despacho` | `bigint` FK→`despacho` (`ON DELETE CASCADE`) | Cabecera a la que pertenece. |
| `id_caso` | `bigint` FK→`caso` (`ON DELETE CASCADE`) | Caso asignado. |
| `id_sector` | `integer` FK→`sector` | Sector del caso al momento de asignar. |
| `orden_visita` | `smallint` | Secuencia de visita dentro de la cuadrilla. |
| `tipo_asignacion` | `varchar(20)` | `REPARACION`/`CONSTRUCCION`/`REFERIDO`/`EMPRESA`/`FALLA_MASIVA`. |
| `estado` | `varchar(20)` | `ASIGNADO`/`GESTIONADO`/`CERRADO`/`CITADO`/`DIFERIDO`. |
| `observacion` | `text` | Nota del supervisor para ese caso. |

La restricción `UNIQUE (id_despacho, id_caso)` (`RepoTecnico/db/schema.sql:470`) impide
duplicar el mismo caso dentro de un despacho; en el ORM corresponde a
`UniqueConstraint("id_despacho", "id_caso", ...)` (`app/models/despacho_entities.py:61-63`).

### estados

Los estados válidos son los mismos en la base de datos, el ORM, el esquema Pydantic y la SPA.

| Entidad | Estados | Fuente |
|---|---|---|
| Despacho | `BORRADOR`, `PUBLICADO`, `CERRADO` | `app/schemas/despacho.py:10` |
| Caso del despacho | `ASIGNADO`, `GESTIONADO`, `CERRADO`, `CITADO`, `DIFERIDO` | `app/schemas/despacho.py:11` |
| Tipo de asignación | `REPARACION`, `CONSTRUCCION`, `REFERIDO`, `EMPRESA`, `FALLA_MASIVA` | `app/schemas/despacho.py:12` |
| Canal de envío | `TELEGRAM`, `CORREO` | `app/schemas/despacho.py:13` |

La SPA replica exactamente estas listas para poblar sus selectores
(`app/web/src/pages/Despacho.tsx:21-35`). Al persistir una propuesta, cada caso nace en
estado `ASIGNADO` (`app/services/despacho.py:283`).

---

## Propuesta automática

El motor de la propuesta vive en `app/services/despacho.py`. Su encabezado documenta, en
cinco puntos, las reglas del brief que implementa (`app/services/despacho.py:1-10`).

### agrupación por sector

El **universo de casos** se obtiene en `seleccionar_casos(...)`
(`app/services/despacho.py:100-120`) aplicando, en este orden:

1. Casos de la central solicitada (`Caso.id_central == id_central`).
2. Estados **fuera** de `CERRADO`, `CANCELADO` y `ENRUTADO`, definidos en
   `ESTADOS_FUERA` (`app/services/despacho.py:23,114`).
3. Exclusión de la **cuadrilla 0** (`Caso.en_gestion_supervisor == False`), salvo que el
   caso tenga **cita del día** (`or_(Caso.en_gestion_supervisor.is_(False), citados_hoy)`,
   `app/services/despacho.py:108,115`).
4. Exclusión de casos **ya asignados** a un despacho no cerrado, mediante la subconsulta
   `ocupados` (`app/services/despacho.py:102-107,116`).
5. Orden por `id_sector`, luego `fecha_reporte` y por último `id_caso`
   (`app/services/despacho.py:118`).

Los casos se agrupan en un diccionario por `id_sector`
(`app/services/despacho.py:171-173`). Los grupos se recorren de **mayor a menor tamaño** y,
en empate, por sector distinto de nulo (`app/services/despacho.py:178-180`). Las cuadrillas
elegibles son las **activas** y **no supervisoras** de la central
(`app/services/despacho.py:123-134`).

### balanceo greedy

El reparto es *greedy*: cada sector completo se entrega a la cuadrilla con **menor carga**
acumulada; en empate, a la de menor código (`app/services/despacho.py:181`). Tras asignar el
sector, se incrementa la carga de esa cuadrilla (`app/services/despacho.py:185`).

Después, la regla de **construcción** fuerza que todos los casos `CONSTRUCCION` queden en
**una sola cuadrilla**: se elige la candidata con más casos no-construcción en los sectores
de construcción y, como desempate, la de mayor carga; luego se mueven las construcciones de
las demás cuadrillas a la elegida, ajustando las cargas
(`app/services/despacho.py:187-211`). Por último, cada cuadrilla renumera su `orden_visita`
de 1..N ordenando por sector y `id_caso` (`app/services/despacho.py:213-219`).

Si **no hay cuadrillas activas de calle**, la propuesta se devuelve vacía con el motivo
`"No hay cuadrillas activas de calle"` y todos los casos en `sin_asignar`
(`app/services/despacho.py:162-168`).

### reglas (citados del día, ≥2 referidos, ≥1 empresa, frases de exclusión)

El diccionario `reglas` de la propuesta resume el cumplimiento
(`app/services/despacho.py:240-253`):

| Clave | Significado |
|---|---|
| `citados_incluidos` | Casos incluidos por tener cita del día. |
| `referidos_asignados` / `referidos_disponibles` / `min_referidos` | Referidos asignados frente al mínimo 2. |
| `cumple_min_referidos` | `referidos >= min(MIN_REFERIDOS, referidos_disponibles)`. |
| `empresas_asignadas` / `empresas_disponibles` / `min_empresas` | Empresas (y gobierno) frente al mínimo 1. |
| `cumple_min_empresas` | `empresas >= min(MIN_EMPRESAS, empresas_disponibles)`. |
| `construccion_cuadrilla` / `construccion_en_una_sola` | Cuadrilla única de construcción. |
| `cuadrillas_activas` | Número de cuadrillas de calle consideradas. |

Los mínimos son constantes del módulo: `MIN_REFERIDOS = 2` y `MIN_EMPRESAS = 1`
(`app/services/despacho.py:24-25`); sus equivalentes configurables en la tabla
`configuracion` son `despacho.min_referidos` y `despacho.min_empresas`
(`RepoTecnico/db/schema.sql:777-778`).

El **tipo de asignación** de cada caso se deriva en `_tipo_asignacion(...)`: construcción si
`tipo_caso == "CONSTRUCCION"`; referido si `categoria == "REFERIDO"`; empresa si la categoría
es `EMPRESA` o `GOBIERNO`; en cualquier otro caso, reparación
(`app/services/despacho.py:90-97`).

Las **frases de exclusión** no se evalúan en `despacho.py`, sino durante la clasificación de
la **cuadrilla 0** (`app/services/cuadrilla0.py:28-46`). Las listas provienen de la tabla
`configuracion`:

| Clave | Valor semilla |
|---|---|
| `despacho.frases_campo` | `["LOSS ROJO","FALLA FIBRA","Fibra Dañada"]` (`RepoTecnico/db/schema.sql:782-783`). |
| `despacho.frases_supervisor` | `["NAVEGACION LENTA","PON INTERMITENTE","SIN TONO"]` (`RepoTecnico/db/schema.sql:784-785`). |
| `despacho.columnas_evaluar` | `["problema_reporte","ultimo_comentario","informacion"]` (`RepoTecnico/db/schema.sql:786-787`). |
| `despacho.criterio_cuadrilla0` | `"SUPERVISOR"` (`RepoTecnico/db/schema.sql:779`; decisión **D-59**, `RepoTecnico/estado_proyecto.md:116`). |

El servicio normaliza el texto de esas columnas y decide si el caso pasa al supervisor
(`app/services/cuadrilla0.py:31-40`). El despacho de calle simplemente **respeta** la marca
`en_gestion_supervisor` que ese criterio dejó en el caso (`app/services/despacho.py:115`).

La persistencia la realiza `guardar_propuesta(...)`: crea un `Despacho` en estado
`BORRADOR` con `generado_auto=True` por cada cuadrilla **con casos**, y sus filas
`DespachoCasos` en estado `ASIGNADO` (`app/services/despacho.py:263-289`).

---

## Endpoints (app/api/routes_despachos.py:63,76,117,135,166,174,181,204,249,271,299,407,420,432,486)

Todas las rutas cuelgan de `/api/v1/despachos` (`app/api/routes_despachos.py:41`). La
columna «Rol» indica el *dependency* aplicado: lectura con `get_current_user` y escritura
con `_escritura` = `ADMIN`/`SUPERVISOR` (`app/api/routes_despachos.py:42`).

| Método y ruta | Línea | Rol | Resumen |
|---|---|---|---|
| `POST /propuesta` | 63 | Escritura | Simula el despacho del día. |
| `POST ""` | 76 | Escritura | Genera y guarda los despachos. |
| `GET ""` | 117 | Lectura | Lista despachos por fecha y/o central. |
| `POST /fallas-masivas` | 135 | Escritura | Reporta una falla masiva. |
| `GET /fallas-masivas` | 166 | Lectura | Lista fallas masivas. |
| `GET /{id_despacho}` | 174 | Lectura | Detalle del despacho. |
| `PATCH /{id_despacho}` | 181 | Escritura | Publica / cierra el despacho. |
| `POST /{id_despacho}/casos` | 204 | Escritura | Agrega un caso al despacho. |
| `DELETE /{id_despacho}/casos/{id_caso}` | 249 | Escritura | Quita un caso del despacho. |
| `PATCH /{id_despacho}/casos/{id_caso}` | 271 | Escritura | Cambia el estado del caso. |
| `GET /{id_despacho}/imprimible` | 299 | Lectura | Ficha de la cuadrilla en HTML carta. |
| `GET /reporte/produccion` | 407 | Lectura | Reporte de producción del día. |
| `GET /{id_despacho}/reporte` | 420 | Lectura | Reporte de producción del despacho. |
| `POST /{id_despacho}/enviar` | 432 | Escritura | Envía la ficha por mensajería. |
| `GET /{id_despacho}/notificaciones` | 486 | Lectura | Notificaciones asociadas. |

### Propuesta y generación

- `POST /propuesta` acepta `fecha` e `id_central` opcionales, resuelve la central con
  `resolver_central(...)` y llama a `svc.construir_propuesta(...)` sin guardar nada
  (`app/api/routes_despachos.py:63-73`). Devuelve `PropuestaOut`
  (`app/schemas/despacho.py:41-47`).
- `POST ""` genera y persiste. Si `reemplazar=true`, borra previamente los despachos en
  estado `BORRADOR` de esa central y fecha (`app/api/routes_despachos.py:89-98`). Si ya
  existe algún despacho para la fecha, responde **409** con el mensaje
  `"Ya existe un despacho para esa fecha (use reemplazar=true o edite el existente)"`
  (`app/api/routes_despachos.py:100-109`). Finalmente persiste con `guardar_propuesta(...)`
  y `commit` (`app/api/routes_despachos.py:111-114`); el código HTTP es **201**
  (`app/api/routes_despachos.py:76`).

### Consulta y edición del despacho

- `GET ""` ordena por `fecha` descendente y `id_cuadrilla`, y filtra por `fecha` y
  `id_central` cuando se envían (`app/api/routes_despachos.py:117-129`). El detalle se
  compone en `_detalle(...)`, que añade `cuadrilla_codigo` y `cuadrilla_nombre`
  (`app/api/routes_despachos.py:52-57`).
- `GET /{id_despacho}` usa el helper `_o_404(...)`, que responde **404**
  `"Despacho no encontrado"` (`app/api/routes_despachos.py:45-49,174-178`).
- `PATCH /{id_despacho}` aplica solo los campos enviados (`exclude_unset=True`) y descarta
  `observacion` porque la observación es por caso, no del despacho
  (`app/api/routes_despachos.py:189-191`). Si el nuevo estado es `PUBLICADO` y aún no había
  `enviado_en`, lo sella con `datetime.now(UTC)` (`app/api/routes_despachos.py:194-195`).

### Casos del despacho

- `POST /{id_despacho}/casos` rechaza con **409** los casos de la cuadrilla 0
  (`"El caso pertenece a la cuadrilla 0 (supervisor)"`) y los repetidos
  (`"El caso ya está en el despacho"`); si no existe el caso, responde **404**
  (`app/api/routes_despachos.py:213-224`). El `orden_visita` es el indicado o el máximo + 1
  (`app/api/routes_despachos.py:225-232`). El `id_sector` se copia del caso
  (`app/api/routes_despachos.py:237`).
- `DELETE /{id_despacho}/casos/{id_caso}` responde **404** si el caso no está en el
  despacho y, si lo está, elimina la fila (`app/api/routes_despachos.py:258-268`).
- `PATCH /{id_despacho}/casos/{id_caso}` cambia `estado` y, opcionalmente, `observacion`
  (`app/api/routes_despachos.py:288-290`).

### Impresión, reportes, envío y notificaciones

Estas rutas se detallan en las secciones «Impresión tamaño carta», «Publicación y
notificación» y «Fallas masivas en despacho» de este mismo manual.

---

## Edición de casos del despacho y conflictos

La edición manual del despacho se apoya en los tres endpoints de casos y en la validación de
conflictos del backend.

### Conflictos y códigos de respuesta

| Situación | Código | Mensaje | Línea |
|---|---|---|---|
| Despacho inexistente | 404 | `Despacho no encontrado` | `app/api/routes_despachos.py:48` |
| Caso inexistente al agregar | 404 | `Caso no encontrado` | `app/api/routes_despachos.py:215` |
| Caso de cuadrilla 0 | 409 | `El caso pertenece a la cuadrilla 0 (supervisor)` | `app/api/routes_despachos.py:217` |
| Caso ya presente | 409 | `El caso ya está en el despacho` | `app/api/routes_despachos.py:224` |
| Caso ausente al quitar/editar | 404 | `El caso no está en el despacho` | `app/api/routes_despachos.py:264,287` |
| Fecha ya despachada | 409 | `Ya existe un despacho para esa fecha...` | `app/api/routes_despachos.py:106-109` |

### Flujo de edición en la interfaz

La página DESPACHO ofrece un detalle editable por despacho: cambiar el estado de cada caso
con un selector `ASIGNADO/GESTIONADO/CERRADO/CITADO/DIFERIDO`, quitar casos y agregar un
caso por su ID con tipo de asignación y observación opcionales
(`app/web/src/pages/Despacho.tsx:446-463`, `:867-912`). Al agregar, la SPA valida que el ID
sea entero positivo antes de llamar a la API (`app/web/src/pages/Despacho.tsx:403-407`).

El flujo de la generación maneja el conflicto **409**: si el usuario intenta generar sin
`reemplazar` y la API responde 409, la SPA pregunta si desea reemplazar los borradores y
relanza la operación con `reemplazar=true` (`app/web/src/pages/Despacho.tsx:365-374`).

---

## Impresión tamaño carta

El requisito **RT-08** se materializa en HTML servido por la API, sin motor de plantillas
externo.

### GET /api/v1/despachos/{id}/imprimible

Devuelve `HTMLResponse` (`app/api/routes_despachos.py:299-303`) con:

- Cabecera con central, fecha, cuadrilla, estado y número de casos
  (`app/api/routes_despachos.py:341-347`).
- Tabla ordenada por `orden_visita` con columnas `#`, `ID avería`, `Sector`, `Dirección`,
  `Cliente`, `Teléfono`, `Tipo`, `Problema` y `Firma / resultado`
  (`app/api/routes_despachos.py:314-322,349-350`).
- Hoja configurada con `@page { size: letter; margin: 1cm; }`
  (`app/api/routes_despachos.py:327`).
- Botón `Imprimir` que invoca `window.print()` y se oculta en la impresión mediante
  `@media print { .no-print { display: none; } }`
  (`app/api/routes_despachos.py:338,353`).

La SPA abre el HTML en una pestaña nueva y avisa si el navegador bloqueó la ventana
emergente (`app/web/src/pages/Despacho.tsx:465-481`). La prueba de integración verifica que
el `content-type` sea `text/html`, que contenga `size: letter`, `Despacho de cuadrilla` e
`ID avería` (`app/tests/test_despacho_api.py:228-236`).

### GET /api/v1/despachos/reporte/produccion

Devuelve `ReporteProduccionOut` (`app/schemas/despacho.py:124-128`) construido por
`_reporte(...)` (`app/api/routes_despachos.py:361-404`). El cálculo recorre las filas que
unen despacho, cuadrilla, despacho_caso y caso de la central y fecha
(`app/api/routes_despachos.py:362-368`) y acumula por cuadrilla y en totales
(`app/api/routes_despachos.py:370-399`):

| Totales | Regla |
|---|---|
| `asignados` | Toda fila del despacho. |
| `cerrados` | `caso.estado_actual == "CERRADO"` o `dc.estado == "CERRADO"`. |
| `citados` | `caso.estado_actual == "CITADO"` o `dc.estado == "CITADO"`. |
| `diferidos` | `caso.estado_actual == "DIFERIDO"` o `dc.estado == "DIFERIDO"`. |
| `gestionados` | `dc.estado == "GESTIONADO"`. |
| `referidos` | `dc.tipo_asignacion == "REFERIDO"`. |
| `empresas` | `dc.tipo_asignacion == "EMPRESA"`. |

El endpoint global acepta `fecha` e `id_central` (`app/api/routes_despachos.py:407-417`) y
el endpoint por despacho reutiliza el mismo cálculo con la central y fecha del despacho
seleccionado (`app/api/routes_despachos.py:420-426`). Estas definiciones son coherentes con
`RepoTecnico/metricas.md:22-23,48-50`. La SPA pinta los siete totales como tarjetas y una
tabla por cuadrilla (`app/web/src/pages/Despacho.tsx:39-47,140-182,1044-1067`).

---

## Publicación y notificación

### POST /api/v1/despachos/{id}/enviar

Envía la ficha del despacho por el canal indicado (`app/api/routes_despachos.py:432-439`):

- `canal` es un *query param* con patrón `^(TELEGRAM|CORREO)$`, por defecto `TELEGRAM`
  (`app/api/routes_despachos.py:435`).
- `destinatario` es opcional; si no se envía, se toma de la configuración
  `despacho.destino_telegram` o `despacho.destino_correo` según el canal
  (`app/api/routes_despachos.py:466-468`; semillas vacías en `RepoTecnico/db/schema.sql:780-781`).
- El cuerpo del mensaje resume fecha, cuadrilla, número de casos, referidos frente al mínimo
  `MIN_REFERIDOS` y empresas frente a `MIN_EMPRESAS`, y luego una línea por caso con orden,
  tipo de asignación, ID de avería, dirección y teléfono
  (`app/api/routes_despachos.py:440-463`).
- El envío real lo hace `enviar(canal, destino, asunto, cuerpo)`
  (`app/services/notificaciones.py:64-72`). Con Telegram usa `TELEGRAM_BOT_TOKEN` y la API
  `sendMessage` (`app/services/notificaciones.py:19-36`); con correo usa `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM`
  (`app/services/notificaciones.py:39-61`).
- La operación **siempre** registra una fila en `notificacion` con el estado devuelto
  (`ENVIADO`, `PENDIENTE` o `FALLIDO`); solo si el estado es `ENVIADO` marca
  `despacho.enviado_canal` y `despacho.enviado_en`
  (`app/api/routes_despachos.py:471-480`). Responde `EnvioOut`
  (`app/schemas/despacho.py:116-121`).

> **Estado real de los canales:** en la v1 los canales previstos son Telegram, correo (SMTP)
> y MCP. Telegram y correo **aún no tienen credenciales en producción**: si falta el token
> o el host SMTP, el envío queda **PENDIENTE** con el motivo
> (`app/services/notificaciones.py:21-22,41-42`). La prueba de integración confirma que sin
> `TELEGRAM_BOT_TOKEN` el estado es `PENDIENTE` y el error menciona
> `TELEGRAM_BOT_TOKEN` (`app/tests/test_despacho_api.py:253-268`). El envío se completa en
> el **Ciclo 9** (ver `RepoTecnico/entornos_globales.md:187-206`).

### notificaciones del despacho

`GET /{id_despacho}/notificaciones` reconstruye el asunto
`"Despacho {fecha} — Cuadrilla {codigo}"` y lista las notificaciones cuyo `asunto` coincide,
en orden descendente por `id_notificacion` (`app/api/routes_despachos.py:486-499`). La SPA
muestra una tabla con ID, canal, destinatario, estado, error, `enviado_en` y `creado_en`
(`app/web/src/pages/Despacho.tsx:1006-1040`).

El patrón *outbox* (`RNF-20`) está descrito en `app/services/outbox.py:1-7`: toda
notificación se persiste primero en estado `PENDIENTE` (`app/services/outbox.py:34-48`) y un
proceso la reintenta con **backoff exponencial** 1, 2, 4, 8… minutos con tope de 60
(`app/services/outbox.py:29-31`). Cuando el canal no tiene credenciales no se consumen
intentos: la notificación permanece `PENDIENTE` y se reprograma
(`app/services/outbox.py:78-85`). El despacho directo (`/enviar`) no usa el *outbox*, sino
que llama a `enviar(...)` en línea y guarda el resultado.

---

## Fallas masivas en despacho

### POST/GET /api/v1/despachos/fallas-masivas

- `POST /fallas-masivas` recibe `FallaMasivaCreate` (`descripcion`, `id_sector` opcional y
  `origen` con valores `AUTOMATICA`/`REPORTE_TECNICO`/`MCP`, por defecto `REPORTE_TECNICO`;
  `app/schemas/despacho.py:131-134`). Resuelve la central
  (`app/api/routes_despachos.py:143-144`) y, si viene `id_sector`, busca la cuadrilla del
  despacho más reciente que tuvo casos en ese sector
  (`app/api/routes_despachos.py:145-155`). Crea la falla en estado `DETECTADA`
  (`app/api/routes_despachos.py:156-163`) y responde **201**.
- `GET /fallas-masivas` lista todas las fallas ordenadas por `id_falla` descendente
  (`app/api/routes_despachos.py:166-171`).

El modelo `FallaMasiva` (`app/models/despacho_entities.py:85-102`; DDL en
`RepoTecnico/db/schema.sql:473-490`) incluye `clave_concentracion`, `estado`
(`DETECTADA`/`PLANIFICADA`/`ATENDIDA`/`CERRADA`) y `planificacion`. La **detección
automática** por concentración la implementa `app/services/fallas.py:53-116`, agrupando por
`fallas.campo_concentracion` (`olt`/`fat`/`id_sector`) con umbral `fallas.umbral_casos` y
ventana `fallas.ventana_horas` (`app/services/fallas.py:14-16,59-77`); es **idempotente**
por `clave_concentracion` mientras la falla siga en `DETECTADA`/`PLANIFICADA`
(`app/services/fallas.py:82-90`).

La detección bajo demanda, la actualización de estado, la planificación (RF-17) y la
solicitud de material (RF-18) viven en el router de alertas, no en el de despachos:
`POST /fallas-masivas/detectar` (`app/api/routes_alertas.py:90-101`),
`PATCH /fallas-masivas/{id_falla}` (`app/api/routes_alertas.py:104-117`),
`POST /fallas-masivas/{id_falla}/planificacion` (`app/api/routes_alertas.py:120-141`) y
`POST /fallas-masivas/{id_falla}/material` (`app/api/routes_alertas.py:144-163`).

La página DESPACHO incluye un formulario para reportar la falla (descripción, sector
opcional y origen) y una tabla de las registradas
(`app/web/src/pages/Despacho.tsx:506-531,1069-1162`). La prueba de integración comprueba el
alta en estado `DETECTADA` y el listado (`app/tests/test_despacho_api.py:274-283`).

---

## Esquemas (app/schemas/despacho.py) y modelos (app/models/despacho_entities.py)

### Esquemas Pydantic

`app/schemas/despacho.py` define los literales de estado y canal
(`app/schemas/despacho.py:10-13`) y los siguientes modelos:

| Esquema | Línea | Uso |
|---|---|---|
| `CasoAsignadoOut` | 16-30 | Caso dentro de una propuesta. |
| `GrupoCuadrillaOut` | 33-38 | Grupo de casos por cuadrilla. |
| `PropuestaOut` | 41-47 | Respuesta de `POST /propuesta`. |
| `DespachoCasoOut` | 50-59 | Fila de `despacho_caso` en el detalle. |
| `DespachoOut` | 62-75 | Cabecera del despacho. |
| `DespachoDetalleOut` | 78-81 | Cabecera + cuadrilla + casos. |
| `DespachoUpdate` | 84-87 | Cuerpo de `PATCH /{id}`. |
| `CasoAgregar` | 90-94 | Cuerpo de `POST /{id}/casos`. |
| `CasoEstadoUpdate` | 97-99 | Cuerpo de `PATCH /{id}/casos/{id_caso}`. |
| `NotificacionOut` | 102-113 | Notificación del *outbox*. |
| `EnvioOut` | 116-121 | Respuesta de `POST /{id}/enviar`. |
| `ReporteProduccionOut` | 124-128 | Reporte de producción. |
| `FallaMasivaCreate` / `FallaMasivaOut` | 131-147 | Alta y lectura de fallas masivas. |

Los esquemas de lectura usan `ConfigDict(from_attributes=True)` para validar directamente
las entidades ORM (`app/schemas/despacho.py:51,63,103,138`). `DespachoDetalleOut` amplía
`DespachoOut` con `cuadrilla_codigo`, `cuadrilla_nombre` y la lista `casos`
(`app/schemas/despacho.py:78-81`), que el router rellena en `_detalle(...)`
(`app/api/routes_despachos.py:52-57`).

### Modelos SQLAlchemy

`app/models/despacho_entities.py` declara cuatro entidades:

| Modelo | Tabla | Línea |
|---|---|---|
| `Despacho` | `despacho` | 24-44 |
| `DespachoCasos` | `despacho_caso` | 47-65 |
| `Notificacion` | `notificacion` | 68-82 |
| `FallaMasiva` | `falla_masiva` | 85-102 |

`Despacho.casos` es una relación con borrado en cascada y carga `selectin`
(`app/models/despacho_entities.py:42-44`), y `DespachoCasos.despacho` es su inverso
(`app/models/despacho_entities.py:65`). La tabla `notificacion` guarda `intentos` y
`proximo_intento`, claves del *outbox* (`app/models/despacho_entities.py:80-81`).

---

## Página web DESPACHO (app/web/src/pages/Despacho.tsx)

La página se monta en la ruta protegida `/despacho` (`app/web/src/App.tsx:31`) y consume el
cliente API compartido (`app/web/src/api/client.ts:541-662`).

### Estructura de la página

| Bloque | Contenido | Línea |
|---|---|---|
| Jornada | Selector de fecha, «Simular propuesta» y «Generar despacho». | 579-607 |
| Propuesta | Resumen, chips de reglas y tablas por cuadrilla + «Sin asignar». | 610-682 |
| Despachos del día | Tabla con estado, casos, canal, origen y acciones. | 685-760 |
| Detalle | Ficha, publicar/cerrar, casos editables, envío y notificaciones. | 763-1042 |
| Reporte de producción | Global del día y del despacho seleccionado. | 1044-1067 |
| Fallas masivas | Alta y tabla de registradas. | 1069-1162 |

### Acciones y control por rol

- El modo **solo lectura** para el rol `TECNICO` se anuncia con un aviso y oculta simular,
  generar, editar y enviar (`app/web/src/pages/Despacho.tsx:185,569-576`).
- Las reglas incumplidas (`cumple_min_referidos`, `cumple_min_empresas`,
  `construccion_en_una_sola`) se resaltan con chips de alerta
  (`app/web/src/pages/Despacho.tsx:533-555,623-659`).
- «Publicar» y «Cerrar» llaman a `actualizarDespacho(...)`; «Imprimir» pide el HTML y lo
  abre en otra pestaña (`app/web/src/pages/Despacho.tsx:381-396,465-481,821-847`).
- El formulario de envío usa canal `TELEGRAM`/`CORREO` y un destinatario opcional cuya ayuda
  indica «Vacío = destino configurado» (`app/web/src/pages/Despacho.tsx:963-997`); el
  resultado del envío se muestra con su estado y error
  (`app/web/src/pages/Despacho.tsx:999-1004`).

---

## Pruebas (app/tests/test_despacho_api.py 17)

La tabla de pruebas de la Fase 4 registra `test_despacho_api.py` con **17 pruebas** de
integración para «Propuesta, balanceo, generación, publicación y fallas masivas»
(`RepoTecnico/pruebas/informe_fase4.md:73`), dentro del total **169/169** en verde
(`RepoTecnico/pruebas/informe_fase4.md:94`). El plan de pruebas asigna a E2E-06 la
cobertura de «Propuesta, generación del despacho y falla masiva manual» para
RF-08/RF-09/RF-24 (`RepoTecnico/pruebas/plan_pruebas.md:71,87`).

### Escenarios cubiertos por la suite de integración

| Escenario | Verificación | Línea |
|---|---|---|
| Sin token | `401`. | `app/tests/test_despacho_api.py:66-67` |
| TECNICO no puede proponer | `403`. | `app/tests/test_despacho_api.py:70-72` |
| Reparto por sector | 10 casos, 2 grupos, cada caso una vez; reglas del brief. | `app/tests/test_despacho_api.py:75-89` |
| Construcción en una sola cuadrilla | Un único grupo con `CONSTRUCCION`. | `app/tests/test_despacho_api.py:92-96` |
| Orden de visita por cuadrilla | Secuencia 1..N. | `app/tests/test_despacho_api.py:99-102` |
| Exclusión de cuadrilla 0 | El caso marcado no aparece. | `app/tests/test_despacho_api.py:105-113` |
| Exclusión de cerrados | El caso `CERRADO` no aparece. | `app/tests/test_despacho_api.py:116-120` |
| Citados del día | Un caso de cuadrilla 0 con cita entra y marca `es_cita`. | `app/tests/test_despacho_api.py:123-134` |
| Sin cuadrillas | Propuesta vacía y `cuadrillas_activas == 0`. | `app/tests/test_despacho_api.py:137-147` |
| Generar y no duplicar | 201, 409 sin reemplazar, 201 con `reemplazar=true`. | `app/tests/test_despacho_api.py:153-170` |
| Agregar/quitar caso | 200, 409 al duplicar y cambio de estado. | `app/tests/test_despacho_api.py:173-200` |
| Publicar | `estado=PUBLICADO` y `enviado_en` no nulo. | `app/tests/test_despacho_api.py:203-210` |
| Caso de cuadrilla 0 al agregar | 409. | `app/tests/test_despacho_api.py:213-222` |
| Imprimible | HTML con `size: letter`, título y `ID avería`. | `app/tests/test_despacho_api.py:228-236` |
| Reporte de producción | Totales y reporte global ≥ del despacho. | `app/tests/test_despacho_api.py:239-250` |
| Envío sin credenciales | `PENDIENTE` y error con `TELEGRAM_BOT_TOKEN`. | `app/tests/test_despacho_api.py:253-268` |
| Fallas masivas | Alta en `DETECTADA` y listado. | `app/tests/test_despacho_api.py:274-283` |

El *fixture* `entorno` monta dos sectores, dos cuadrillas y un universo de diez casos que
incluye dos referidos, una empresa y una construcción
(`app/tests/test_despacho_api.py:16-54`), lo que permite validar las reglas del brief de
forma determinista.
