# 05 — Despacho diario (módulo DESPACHO)

## Visión general (RF-08/RF-24/RF-25/RF-27, D-52 y D-66)

El módulo **DESPACHO** arma, publica, imprime, envía y reporta el despacho diario de las
cuadrillas de la Central **FRANCISCO SALIAS** (`2324X`). Es el Ciclo 5 del proyecto y su
alcance funcional está declarado en el propio encabezado del router
(`app/api/routes_despachos.py:1`) y en la decisión **D-52**
(`RepoTecnico/estado_proyecto.md:123`), que lo da por completado con **96/96 pruebas**,
despliegue `ggto-web-00007-vsr` (imagen `v7`) y verificación en vivo.

El ciclo **D-66** reescribió la lógica de reparto: el despacho ya no se equilibra por
*carga* de casos, sino que se reparte **por el sector asignado a cada cuadrilla para el
día** en la tabla `cuadrilla_sector_dia`; los **citados del día** tienen prioridad, la
**construcción** va completa a una sola cuadrilla y los casos sin sector asignado quedan
en `sin_asignar`. El ciclo se documenta en `RepoTecnico/estado_proyecto.md:133`.

### Alcance funcional

| Requisito | Descripción | Evidencia en código |
|---|---|---|
| **RF-08** | Distribuir el universo de averías entre las cuadrillas activas por día, agrupando por sector. | `app/api/routes_despachos.py:79-117`; `app/services/despacho.py:323-348` |
| **RF-24** | Proponer la distribución de casos antes de guardarla. | `app/api/routes_despachos.py:66-76`; `app/services/despacho.py:289-434` |
| **RF-25** | La cuadrilla 0 (gestión del supervisor) no compite por sectores: sus casos se despachan **a la propia cuadrilla 0** (D-77). | `app/services/despacho.py:132-149,342-366` |
| **RF-27** | Generar el reporte de producción (asignados, cerrados, citados, referidos, etc.). | `app/api/routes_despachos.py:450-493` |
| **RT-08** | Impresión tamaño carta de la ficha de la cuadrilla. | `app/api/routes_despachos.py:388-444` |
| **RF-09** | Registrar y listar fallas masivas desde el módulo de despacho. | `app/api/routes_despachos.py:138-174` |
| **RF-10** | Enviar la ficha de la cuadrilla por Telegram o correo. | `app/api/routes_despachos.py:521-572` |

### Archivos de referencia

| Capa | Archivo |
|---|---|
| Router FastAPI | `app/api/routes_despachos.py` |
| Servicio de propuesta, asignación y proceso | `app/services/despacho.py` |
| Esquemas Pydantic | `app/schemas/despacho.py` |
| Modelos SQLAlchemy | `app/models/despacho_entities.py` |
| Notificaciones y *outbox* | `app/services/notificaciones.py`, `app/services/outbox.py` |
| Página web | `app/web/src/pages/Despacho.tsx` |
| Formulario flotante de proceso | `app/web/src/components/ProcesarDespacho.tsx` |
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

### cuadrilla_sector_dia

Tabla nueva del ciclo **D-66**: asignación **dinámica** de sectores a cuadrillas por día.
Definida en `RepoTecnico/db/schema.sql:477-488` y en
`app/models/despacho_entities.py:68-92`. El supervisor decide cada jornada qué sectores
atiende cada cuadrilla y el despacho reparte los casos según esa asignación.

| Campo | Tipo | Significado |
|---|---|---|
| `id_asignacion` | `bigserial` PK | Identificador de la asignación. |
| `id_central` | `integer` FK→`central` | Central de la jornada. |
| `fecha` | `date` | Día al que aplica la asignación. |
| `id_cuadrilla` | `integer` FK→`cuadrilla` (`ON DELETE CASCADE`) | Cuadrilla que atiende. |
| `id_sector` | `integer` FK→`sector` (`ON DELETE CASCADE`) | Sector asignado. |
| `usuario` | `varchar(20)` FK→`usuario.p00` | Supervisor que guardó la asignación. |
| `creado_en` | `timestamptz` | Momento del registro. |

La restricción `UNIQUE (fecha, id_sector)` (`RepoTecnico/db/schema.sql:485`) garantiza que
**un sector pertenezca como máximo a una cuadrilla por día**; en el ORM se declara como
`UniqueConstraint("fecha", "id_sector", ...)` (`app/models/despacho_entities.py:90-92`).
El índice `ix_cuadrilla_sector_dia_fecha` acelera la consulta por fecha y cuadrilla
(`RepoTecnico/db/schema.sql:487-488`).

### estados

Los estados válidos son los mismos en la base de datos, el ORM, el esquema Pydantic y la SPA.

| Entidad | Estados | Fuente |
|---|---|---|
| Despacho | `BORRADOR`, `PUBLICADO`, `CERRADO` | `app/schemas/despacho.py:10` |
| Caso del despacho | `ASIGNADO`, `GESTIONADO`, `CERRADO`, `CITADO`, `DIFERIDO` | `app/schemas/despacho.py:11` |
| Tipo de asignación | `REPARACION`, `CONSTRUCCION`, `REFERIDO`, `EMPRESA`, `FALLA_MASIVA` | `app/schemas/despacho.py:12` |
| Canal de envío | `TELEGRAM`, `CORREO` | `app/schemas/despacho.py:13` |

La SPA replica exactamente estas listas para poblar sus selectores
(`app/web/src/pages/Despacho.tsx:24-38`). Al persistir una propuesta, cada caso nace en
estado `ASIGNADO` (`app/services/despacho.py:457`).

---

## Propuesta automática y asignación diaria

El motor de la propuesta vive en `app/services/despacho.py`. Su encabezado documenta las
seis reglas del ciclo **D-66** (`app/services/despacho.py:1-19`). Las constantes del módulo
son `ESTADOS_FUERA` (`:32`), `CATEGORIAS_ESPECIALES = ("REFERIDO", "EMPRESA", "GOBIERNO")`
(`:33`) y los mínimos `MIN_REFERIDOS = 2` / `MIN_EMPRESAS = 1` (`:34-35`).

### universo de casos

`universo_casos(...)` —para el formulario de proceso, incluye los borradores del día—
(`app/services/despacho.py:159-167`) y `seleccionar_casos(...)` —simulación, excluye
cualquier despacho no cerrado— (`:148-156`) comparten el filtro `_filtro_universo(...)`
(`:118-145`), que aplica:

1. Casos de la central solicitada (`Caso.id_central == id_central`).
2. Estados **fuera** de `CERRADO`, `CANCELADO` y `ENRUTADO`
   (`ESTADOS_FUERA`, `app/services/despacho.py:32,142`).
3. **Cuadrilla 0 (D-77)**: los casos en gestión (`en_gestion_supervisor` o estado
   `EN_GESTION`, `app/services/despacho.py:132-135`) **entran** al universo y se separan del
   reparto por sector para despacharse a la **cuadrilla del supervisor**
   (`cuadrilla_supervisor`, `:137-149`; agrupación en `construir_propuesta`, `:342-366`). Si
   la central no tiene cuadrilla 0 vuelven al reparto normal.
4. Exclusión de los casos ya asignados: cualquier despacho no cerrado en la simulación
   (`:125-131`) o solo los `PUBLICADO`/`CERRADO` en modo proceso (`:132-138`).
5. Orden estable por `id_sector`, después por `fecha_reporte` (simulación) o `fecha_cita`
   (proceso) y por último `id_caso` (`app/services/despacho.py:154,165`).

El universo **incluye casos comunes y especiales**: `es_especial(...)` marca las categorías
`REFERIDO`, `EMPRESA` y `GOBIERNO` (`app/services/despacho.py:111-112`).

Las cuadrillas elegibles son las **activas** y **no supervisoras** de la central
(`cuadrillas_activas`, `app/services/despacho.py:170-181`).

### asignación de sectores a cuadrillas por día

La asignación se persiste en `cuadrilla_sector_dia` y se resuelve con estas funciones:

- `asignacion_guardada(db, fecha)` devuelve el mapa `id_sector -> id_cuadrilla` guardado
  para la fecha (`app/services/despacho.py:194-199`).
- `propuesta_asignacion(cuadrillas, casos)` propone un reparto **equilibrado**: ordena los
  sectores por número de casos descendente y asigna cada uno a la cuadrilla con **menor
  carga** acumulada (desempate por `codigo`) (`app/services/despacho.py:202-218`).
- `asignacion_efectiva(db, central, fecha)` devuelve `(asignacion, origen)`, con origen
  `"GUARDADA"` si había asignación o `"PROPUESTA"` si hubo que proponerla
  (`app/services/despacho.py:221-230`).
- `guardar_asignacion(...)` **reemplaza** la asignación del día: borra las filas de esa
  fecha e inserta un registro por sector, ignorando los sectores repetidos porque un
  sector solo puede pertenecer a una cuadrilla por día
  (`app/services/despacho.py:233-263`).

### reparto de los casos

`construir_propuesta(...)` (`app/services/despacho.py:289-434`) recibe la asignación y, si
es `None`, usa la guardada o propone una equilibrada (`:305-308`). Luego:

1. Agrupa los casos por `id_sector` y recorre los sectores de mayor a menor número de
   casos, dejando al final el grupo de casos sin sector (`:324-335`).
2. Cada caso va a la cuadrilla **dueña de su sector**; si el sector no tiene cuadrilla y el
   caso es **citado del día**, se asigna a la cuadrilla **menos cargada** (contador
   `citados_reasignados`); el resto queda en `sin_asignar` (`:336-348`).
3. La **construcción** va completa a **una sola cuadrilla**: se elige la que ya atiende más
   casos no-construcción en los sectores de construcción (desempate por menor carga) y se
   mueven allí las construcciones de las demás (`:350-372`).
4. El `orden_visita` se renumera 1..N con los **citados primero**, luego por sector y
   `id_caso` (`:374-383`).

Si **no hay cuadrillas activas de calle**, la propuesta se devuelve vacía con el motivo
`"No hay cuadrillas activas de calle"` y todos los casos en `sin_asignar`
(`app/services/despacho.py:313-321`).

### reglas (citados del día, ≥2 referidos, ≥1 empresa, frases de exclusión)

El diccionario `reglas` de la propuesta resume el cumplimiento
(`app/services/despacho.py:406-425`):

| Clave | Significado |
|---|---|
| `citados_incluidos` | Casos citados finalmente asignados a una cuadrilla. |
| `citados_reasignados` | Citados cuyo sector no tenía cuadrilla y se movieron a la menos cargada. |
| `referidos_asignados` / `referidos_disponibles` / `min_referidos` | Referidos asignados frente al mínimo 2. |
| `cumple_min_referidos` | `referidos >= min(MIN_REFERIDOS, referidos_disponibles)`. |
| `empresas_asignadas` / `empresas_disponibles` / `min_empresas` | Empresas (y gobierno) frente al mínimo 1. |
| `cumple_min_empresas` | `empresas >= min(MIN_EMPRESAS, empresas_disponibles)`. |
| `especiales_asignados` | Casos de categoría especial incluidos en el reparto. |
| `construccion_cuadrilla` / `construccion_en_una_sola` | Cuadrilla única de construcción. |
| `sectores_sin_cuadrilla` | Sectores del `sin_asignar` que no tienen cuadrilla asignada. |
| `cuadrillas_activas` | Número de cuadrillas de calle consideradas. |

Los mínimos son constantes del módulo (`app/services/despacho.py:34-35`); sus equivalentes
configurables en la tabla `configuracion` son `despacho.min_referidos` y
`despacho.min_empresas` (`RepoTecnico/db/schema.sql:794-795`).

El **tipo de asignación** de cada caso se deriva en `_tipo_asignacion(...)`: construcción si
`tipo_caso == "CONSTRUCCION"`; referido si `categoria == "REFERIDO"`; empresa si la categoría
es `EMPRESA` o `GOBIERNO`; en cualquier otro caso, reparación
(`app/services/despacho.py:101-108`).

Las **frases de exclusión** no se evalúan en `despacho.py`, sino durante la clasificación de
la **cuadrilla 0** (`app/services/cuadrilla0.py:28-46`). Las listas provienen de la tabla
`configuracion`:

| Clave | Valor semilla |
|---|---|
| `despacho.frases_campo` | `["LOSS ROJO","FALLA FIBRA","Fibra Dañada"]` (`RepoTecnico/db/schema.sql:799-800`). |
| `despacho.frases_supervisor` | `["NAVEGACION LENTA","PON INTERMITENTE","SIN TONO"]` (`RepoTecnico/db/schema.sql:801-802`). |
| `despacho.columnas_evaluar` | `["problema_reporte","ultimo_comentario","informacion"]` (`RepoTecnico/db/schema.sql:803-804`). |
| `despacho.criterio_cuadrilla0` | `"SUPERVISOR"` (`RepoTecnico/db/schema.sql:796`; decisión **D-59**, `RepoTecnico/estado_proyecto.md:116`). |

El servicio normaliza el texto de esas columnas y decide si el caso pasa al supervisor
(`app/services/cuadrilla0.py:31-40`). El despacho de calle simplemente **respeta** la marca
`en_gestion_supervisor` que ese criterio dejó en el caso, salvo para los **citados del día**
(`app/services/despacho.py:143`).

La persistencia la realiza `guardar_propuesta(...)`: crea un `Despacho` en estado
`BORRADOR` con `generado_auto=True` por cada cuadrilla **con casos**, y sus filas
`DespachoCasos` en estado `ASIGNADO` (`app/services/despacho.py:437-463`).

### proceso (formulario flotante)

`proceso(db, central, fecha)` compone la respuesta del formulario de proceso
(`app/services/despacho.py:469-535`): calcula la asignación efectiva y su origen (`:474`),
la propuesta de reparto (`:475`), el detalle de **sectores** con `total`, `especiales`,
`citados` y `id_cuadrilla` (`:478-493`), las **cuadrillas** con sus `ids_sector` y su total
(`:516-525`) y devuelve además `universo` —con `total`, `comunes`, `especiales`,
`sin_sector` y la lista de `casos`— (`:505-514`), `asignacion`, `grupos`, `sin_asignar`,
`reglas` y `resumen` (`:526-534`).

---

## Endpoints (app/api/routes_despachos.py:66,79,120,138,169,177,190,207,263,270,293,338,360,388,496,509,521,575)

Todas las rutas cuelgan de `/api/v1/despachos` (`app/api/routes_despachos.py:41`). La
columna «Rol» indica el *dependency* aplicado: lectura con `get_current_user` y escritura
con `_escritura` = `ADMIN`/`SUPERVISOR` (`app/api/routes_despachos.py:42`).

| Método y ruta | Línea | Rol | Resumen |
|---|---|---|---|
| `POST /propuesta` | 66 | Escritura | Simula el despacho del día. |
| `POST ""` | 79 | Escritura | Genera y guarda los despachos. |
| `GET ""` | 120 | Lectura | Lista despachos por fecha y/o central. |
| `POST /fallas-masivas` | 138 | Escritura | Reporta una falla masiva. |
| `GET /fallas-masivas` | 169 | Lectura | Lista fallas masivas. |
| `GET /proceso` | 177 | Lectura | Universo, sectores y asignación del día (D-66). |
| `PUT /asignacion` | 190 | Escritura | Guarda la asignación de sectores por cuadrilla. |
| `POST /procesar` | 207 | Escritura | Procesa el despacho con la asignación del día. |
| `GET /{id_despacho}` | 263 | Lectura | Detalle del despacho. |
| `PATCH /{id_despacho}` | 270 | Escritura | Publica / cierra el despacho. |
| `POST /{id_despacho}/casos` | 293 | Escritura | Agrega un caso al despacho. |
| `DELETE /{id_despacho}/casos/{id_caso}` | 338 | Escritura | Quita un caso del despacho. |
| `PATCH /{id_despacho}/casos/{id_caso}` | 360 | Escritura | Cambia el estado del caso. |
| `GET /{id_despacho}/imprimible` | 388 | Lectura | Ficha de la cuadrilla en HTML carta. |
| `GET /reporte/produccion` | 496 | Lectura | Reporte de producción del día. |
| `GET /{id_despacho}/reporte` | 509 | Lectura | Reporte de producción del despacho. |
| `POST /{id_despacho}/enviar` | 521 | Escritura | Envía la ficha por mensajería. |
| `GET /{id_despacho}/notificaciones` | 575 | Lectura | Notificaciones asociadas. |

### Propuesta y generación

- `POST /propuesta` acepta `fecha` e `id_central` opcionales, resuelve la central con
  `resolver_central(...)` y llama a `svc.construir_propuesta(...)` sin guardar nada
  (`app/api/routes_despachos.py:66-76`). Devuelve `PropuestaOut`
  (`app/schemas/despacho.py:42-48`).
- `POST ""` genera y persiste. Si `reemplazar=true`, borra previamente los despachos en
  estado `BORRADOR` de esa central y fecha (`app/api/routes_despachos.py:92-101`). Si ya
  existe algún despacho para la fecha, responde **409** con el mensaje
  `"Ya existe un despacho para esa fecha (use reemplazar=true o edite el existente)"`
  (`app/api/routes_despachos.py:103-112`). Finalmente persiste con `guardar_propuesta(...)`
  y `commit` (`app/api/routes_despachos.py:114-116`); el código HTTP es **201**
  (`app/api/routes_despachos.py:79`).

### Proceso del día con asignación de sectores (D-66)

- `GET /proceso` acepta `fecha` e `id_central` opcionales y devuelve `ProcesoDespachoOut`
  construido por `svc.proceso(...)` (`app/api/routes_despachos.py:177-187`; esquema en
  `app/schemas/despacho.py:130-141`). El rol de lectura es cualquier usuario autenticado
  (`app/api/routes_despachos.py:183`).
- `PUT /asignacion` recibe `AsignacionUpdate` (`fecha`, `id_central` opcional y
  `asignaciones` como lista de bloques `{id_cuadrilla, ids_sector}`;
  `app/schemas/despacho.py:124-127`), llama a `svc.guardar_asignacion(...)` y devuelve el
  proceso recalculado para esa fecha (`app/api/routes_despachos.py:190-204`). Un sector
  enviado en dos bloques se registra **una sola vez** (gana el primero)
  (`app/services/despacho.py:250-252`).
- `POST /procesar` recibe `ProcesarDespacho` (`fecha`, `id_central`, `asignaciones` y
  `reemplazar=true` por defecto; `app/schemas/despacho.py:144-148`). Si hay despachos
  `PUBLICADO`/`CERRADO` responde **409**
  (`"Ya hay despachos publicados o cerrados para esa fecha"`,
  `app/api/routes_despachos.py:218-229`); si `reemplazar` es falso y ya existe algún
  despacho, responde **409** (`:241-249`). Guarda la asignación si viene y genera los
  borradores con `guardar_propuesta(...)` (`app/api/routes_despachos.py:251-260`).

### Consulta y edición del despacho

- `GET ""` ordena por `fecha` descendente y `id_cuadrilla`, y filtra por `fecha` y
  `id_central` cuando se envían (`app/api/routes_despachos.py:120-132`). El detalle se
  compone en `_detalle(...)`, que añade `cuadrilla_codigo` y `cuadrilla_nombre`
  (`app/api/routes_despachos.py:55-60`).
- `GET /{id_despacho}` usa el helper `_o_404(...)`, que responde **404**
  `"Despacho no encontrado"` (`app/api/routes_despachos.py:48-52,263-267`).
- `PATCH /{id_despacho}` aplica solo los campos enviados (`exclude_unset=True`) y descarta
  `observacion` porque la observación es por caso, no del despacho
  (`app/api/routes_despachos.py:278-280`). Si el nuevo estado es `PUBLICADO` y aún no había
  `enviado_en`, lo sella con `datetime.now(UTC)` (`app/api/routes_despachos.py:283-284`).

El formulario de proceso lista también la **cuadrilla 0** (tarjeta «Cuadrilla 0 · casos en
gestión», sin sectores ni selector de sector), para que el supervisor vea cuántos casos en
gestión se van a despachar consigo (`app/web/src/components/ProcesarDespacho.tsx`).

### Asignación manual de casos a una cuadrilla (D-77, D-78)

Además del reparto automático por sector, el Supervisor y el Administrador pueden
**asignar y quitar** casos **comunes y especiales** a una cuadrilla concreta:

- `POST /despachos/asignar-casos` (`app/api/routes_despachos.py:388-417`) recibe
  `id_cuadrilla`, `ids_caso`, `ids_caso_especial` y `fecha` (por defecto hoy). Usa o crea el
  despacho **BORRADOR** de esa cuadrilla y fecha (`app/services/despacho.py:654-747`) y
  agrega cada caso con su `orden_visita` y `tipo_asignacion`.
- **Mueve** el caso si estaba en el borrador de otra cuadrilla del mismo día; si el caso
  está en un despacho `PUBLICADO` o `CERRADO` lo deja intacto y lo informa en `omitidos`.
- Asignar a la **cuadrilla 0** marca `caso.en_gestion_supervisor = true`; asignar a una
  cuadrilla de calle lo desmarca.
- `POST /despachos/quitar-casos` (`app/api/routes_despachos.py:419-438`,
  `app/services/despacho.py:749-806`) saca los casos de los borradores del día y elimina
  los borradores que quedan vacíos.
- **En la web (D-78):** en **CASOS** la asignación vive en la **ficha de cada caso**, pestaña
  **Despacho** (`app/web/src/components/FichaCaso.tsx`), con la **cuadrilla actual**, el
  selector de cuadrilla destino y los botones «Asignar a cuadrilla» / «Quitar del despacho».
  La ficha informa la cuadrilla del **último despacho** mediante los campos
  `id_cuadrilla`/`cuadrilla_codigo`/`cuadrilla_nombre` de `CasoOut`, calculados en
  `_resumen` (`app/api/routes_casos.py:77-155`). En **ESPECIALES** se conserva la selección
  de renglones con su barra. El rol TECNICO no ve ninguna de las dos acciones.

### Casos del despacho

- `POST /{id_despacho}/casos` rechaza con **409** los repetidos
  (`"El caso ya está en el despacho"`); si no existe el caso, responde **404**
  (`app/api/routes_despachos.py:303-313`). D-77 retiró el 409 que bloqueaba los casos de la
  cuadrilla 0: la asignación explícita del supervisor manda. El `orden_visita` es el indicado
  o el máximo + 1 (`app/api/routes_despachos.py:314-321`). El `id_sector` se copia del caso
  (`app/api/routes_despachos.py:326`).
- `DELETE /{id_despacho}/casos/{id_caso}` responde **404** si el caso no está en el
  despacho y, si lo está, elimina la fila (`app/api/routes_despachos.py:352-354`).
- `PATCH /{id_despacho}/casos/{id_caso}` cambia `estado` y, opcionalmente, `observacion`
  (`app/api/routes_despachos.py:377-379`).

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
| Despacho inexistente | 404 | `Despacho no encontrado` | `app/api/routes_despachos.py:51` |
| Caso inexistente al agregar | 404 | `Caso no encontrado` | `app/api/routes_despachos.py:304` |
| Caso de cuadrilla 0 | 409 | `El caso pertenece a la cuadrilla 0 (supervisor)` | `app/api/routes_despachos.py:306` |
| Caso ya presente | 409 | `El caso ya está en el despacho` | `app/api/routes_despachos.py:313` |
| Caso ausente al quitar/editar | 404 | `El caso no está en el despacho` | `app/api/routes_despachos.py:353,376` |
| Fecha ya despachada | 409 | `Ya existe un despacho para esa fecha...` | `app/api/routes_despachos.py:109-112` |
| Despachos publicados/cerrados | 409 | `Ya hay despachos publicados o cerrados para esa fecha` | `app/api/routes_despachos.py:225-229` |

### Flujo de edición en la interfaz

La página DESPACHO ofrece un detalle editable por despacho: cambiar el estado de cada caso
con un selector `ASIGNADO/GESTIONADO/CERRADO/CITADO/DIFERIDO`, quitar casos y agregar un
caso por su ID con tipo de asignación y observación opcionales
(`app/web/src/pages/Despacho.tsx:877-926`, `:1023-1065`). Al agregar, la SPA valida que el ID
sea entero positivo antes de llamar a la API (`app/web/src/pages/Despacho.tsx:402-403`).

El botón **«Procesar despacho»** (sustituye al antiguo «Generar despacho») abre el formulario
flotante `ProcesarDespacho` (`app/web/src/pages/Despacho.tsx:596-614`); al confirmar, la SPA
llama a `api.procesarDespacho(...)` y refresca el listado desde el callback `alProcesar`
(`app/web/src/pages/Despacho.tsx:370-377`). El conflicto **409** de despachos ya publicados o
cerrados llega como `ApiError` y se muestra en el aviso del modal
(`app/web/src/components/ProcesarDespacho.tsx:89-93`).

---

## Impresión tamaño carta

El requisito **RT-08** se materializa en HTML servido por la API, sin motor de plantillas
externo.

### GET /api/v1/despachos/{id}/imprimible

Devuelve `HTMLResponse` (`app/api/routes_despachos.py:388-392`) con:

- Cabecera con central, fecha, cuadrilla, estado y número de casos
  (`app/api/routes_despachos.py:430-436`).
- Tabla ordenada por `orden_visita` con columnas `#`, `ID avería`, `Sector`, `Dirección`,
  `Cliente`, `Teléfono`, `Tipo`, `Problema` y `Firma / resultado`
  (`app/api/routes_despachos.py:403-411,437-440`).
- Hoja configurada con `@page { size: letter; margin: 1cm; }`
  (`app/api/routes_despachos.py:416`).
- Botón `Imprimir` que invoca `window.print()` y se oculta en la impresión mediante
  `@media print { .no-print { display: none; } }`
  (`app/api/routes_despachos.py:427,442`).

La SPA abre el HTML en una pestaña nueva y avisa si el navegador bloqueó la ventana
emergente (`app/web/src/pages/Despacho.tsx:464-484`). La prueba de integración verifica que
el `content-type` sea `text/html`, que contenga `size: letter`, `Despacho de cuadrilla` e
`ID avería` (`app/tests/test_despacho_api.py:350-360`).

### GET /api/v1/despachos/reporte/produccion

Devuelve `ReporteProduccionOut` (`app/schemas/despacho.py:185-189`) construido por
`_reporte(...)` (`app/api/routes_despachos.py:450-493`). El cálculo recorre las filas que
unen despacho, cuadrilla, despacho_caso y caso de la central y fecha
(`app/api/routes_despachos.py:451-457`) y acumula por cuadrilla y en totales
(`app/api/routes_despachos.py:459-488`):

| Totales | Regla |
|---|---|
| `asignados` | Toda fila del despacho. |
| `cerrados` | `caso.estado_actual == "CERRADO"` o `dc.estado == "CERRADO"`. |
| `citados` | `caso.estado_actual == "CITADO"` o `dc.estado == "CITADO"`. |
| `diferidos` | `caso.estado_actual == "DIFERIDO"` o `dc.estado == "DIFERIDO"`. |
| `gestionados` | `dc.estado == "GESTIONADO"`. |
| `referidos` | `dc.tipo_asignacion == "REFERIDO"`. |
| `empresas` | `dc.tipo_asignacion == "EMPRESA"`. |

El endpoint global acepta `fecha` e `id_central` (`app/api/routes_despachos.py:496-506`) y
el endpoint por despacho reutiliza el mismo cálculo con la central y fecha del despacho
seleccionado (`app/api/routes_despachos.py:509-515`). Estas definiciones son coherentes con
`RepoTecnico/metricas.md:22-23,48-50`. La SPA pinta los siete totales como tarjetas y una
tabla por cuadrilla (`app/web/src/pages/Despacho.tsx:42-50,145-182,1067-1091`).

---

## Publicación y notificación

### POST /api/v1/despachos/{id}/enviar

Envía la ficha del despacho por el canal indicado (`app/api/routes_despachos.py:521-528`):

- `canal` es un *query param* con patrón `^(TELEGRAM|CORREO)$`, por defecto `TELEGRAM`
  (`app/api/routes_despachos.py:524`).
- `destinatario` es opcional; si no se envía, se toma de la configuración
  `despacho.destino_telegram` o `despacho.destino_correo` según el canal
  (`app/api/routes_despachos.py:555-557`; semillas vacías en `RepoTecnico/db/schema.sql:797-798`).
- El cuerpo del mensaje resume fecha, cuadrilla, número de casos, referidos frente al mínimo
  `MIN_REFERIDOS` y empresas frente a `MIN_EMPRESAS`, y luego una línea por caso con orden,
  tipo de asignación, ID de avería, dirección y teléfono
  (`app/api/routes_despachos.py:529-552`).
- El envío real lo hace `enviar(canal, destino, asunto, cuerpo)`
  (`app/services/notificaciones.py:64-72`). Con Telegram usa `TELEGRAM_BOT_TOKEN` y la API
  `sendMessage` (`app/services/notificaciones.py:19-36`); con correo usa `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM`
  (`app/services/notificaciones.py:39-61`).
- La operación **siempre** registra una fila en `notificacion` con el estado devuelto
  (`ENVIADO`, `PENDIENTE` o `FALLIDO`); solo si el estado es `ENVIADO` marca
  `despacho.enviado_canal` y `despacho.enviado_en`
  (`app/api/routes_despachos.py:560-569`). Responde `EnvioOut`
  (`app/schemas/despacho.py:177-182`).

> **Estado real de los canales:** en la v1 los canales previstos son Telegram, correo (SMTP)
> y MCP. Telegram y correo **aún no tienen credenciales en producción**: si falta el token
> o el host SMTP, el envío queda **PENDIENTE** con el motivo
> (`app/services/notificaciones.py:21-22,41-42`). La prueba de integración confirma que sin
> `TELEGRAM_BOT_TOKEN` el estado es `PENDIENTE` y el error menciona
> `TELEGRAM_BOT_TOKEN` (`app/tests/test_despacho_api.py:375-395`). El envío se completa en
> el **Ciclo 9** (ver `RepoTecnico/entornos_globales.md:187-206`).

### notificaciones del despacho

`GET /{id_despacho}/notificaciones` reconstruye el asunto
`"Despacho {fecha} — Cuadrilla {codigo}"` y lista las notificaciones cuyo `asunto` coincide,
en orden descendente por `id_notificacion` (`app/api/routes_despachos.py:575-588`). La SPA
muestra una tabla con ID, canal, destinatario, estado, error, `enviado_en` y `creado_en`
(`app/web/src/pages/Despacho.tsx:984-1019`).

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
  `app/schemas/despacho.py:192-196`). Resuelve la central
  (`app/api/routes_despachos.py:146-147`) y, si viene `id_sector`, busca la cuadrilla del
  despacho más reciente que tuvo casos en ese sector
  (`app/api/routes_despachos.py:148-158`). Crea la falla en estado `DETECTADA`
  (`app/api/routes_despachos.py:159-166`) y responde **201**.
- `GET /fallas-masivas` lista todas las fallas ordenadas por `id_falla` descendente
  (`app/api/routes_despachos.py:169-174`).

El modelo `FallaMasiva` (`app/models/despacho_entities.py:112-130`; DDL en
`RepoTecnico/db/schema.sql:490-507`) incluye `clave_concentracion`, `estado`
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
(`app/web/src/pages/Despacho.tsx:505-531,1092-1213`). La prueba de integración comprueba el
alta en estado `DETECTADA` y el listado (`app/tests/test_despacho_api.py:396-405`).

---

## Esquemas (app/schemas/despacho.py) y modelos (app/models/despacho_entities.py)

### Esquemas Pydantic

`app/schemas/despacho.py` define los literales de estado y canal
(`app/schemas/despacho.py:10-13`) y los siguientes modelos:

| Esquema | Línea | Uso |
|---|---|---|
| `CasoAsignadoOut` | 16-31 | Caso dentro de una propuesta (incluye `especial`, D-66). |
| `GrupoCuadrillaOut` | 34-39 | Grupo de casos por cuadrilla. |
| `PropuestaOut` | 42-48 | Respuesta de `POST /propuesta`. |
| `DespachoCasoOut` | 51-60 | Fila de `despacho_caso` en el detalle. |
| `DespachoOut` | 63-76 | Cabecera del despacho. |
| `DespachoDetalleOut` | 79-82 | Cabecera + cuadrilla + casos. |
| `DespachoUpdate` | 85-88 | Cuerpo de `PATCH /{id}`. |
| `SectorProcesoOut` | 94-100 | Sector con total, especiales, citados y cuadrilla (D-66). |
| `CuadrillaProcesoOut` | 103-108 | Cuadrilla con sus `ids_sector` y total (D-66). |
| `UniversoOut` | 111-116 | Universo del proceso: total, comunes, especiales, sin sector y casos (D-66). |
| `AsignacionBloque` | 119-121 | Bloque `{id_cuadrilla, ids_sector}` (D-66). |
| `AsignacionUpdate` | 124-127 | Cuerpo de `PUT /asignacion` (D-66). |
| `ProcesoDespachoOut` | 130-141 | Respuesta de `GET /proceso` (D-66). |
| `ProcesarDespacho` | 144-148 | Cuerpo de `POST /procesar` (D-66). |
| `CasoAgregar` | 151-155 | Cuerpo de `POST /{id}/casos`. |
| `CasoEstadoUpdate` | 158-160 | Cuerpo de `PATCH /{id}/casos/{id_caso}`. |
| `NotificacionOut` | 163-173 | Notificación del *outbox*. |
| `EnvioOut` | 177-182 | Respuesta de `POST /{id}/enviar`. |
| `ReporteProduccionOut` | 185-189 | Reporte de producción. |
| `FallaMasivaCreate` / `FallaMasivaOut` | 192-209 | Alta y lectura de fallas masivas. |

Los esquemas de lectura usan `ConfigDict(from_attributes=True)` para validar directamente
las entidades ORM (`app/schemas/despacho.py:52,64,164,199`). `DespachoDetalleOut` amplía
`DespachoOut` con `cuadrilla_codigo`, `cuadrilla_nombre` y la lista `casos`
(`app/schemas/despacho.py:79-82`), que el router rellena en `_detalle(...)`
(`app/api/routes_despachos.py:55-60`).

### Modelos SQLAlchemy

`app/models/despacho_entities.py` declara cinco entidades:

| Modelo | Tabla | Línea |
|---|---|---|
| `Despacho` | `despacho` | 24-44 |
| `DespachoCasos` | `despacho_caso` | 47-65 |
| `CuadrillaSectorDia` | `cuadrilla_sector_dia` | 68-92 |
| `Notificacion` | `notificacion` | 95-109 |
| `FallaMasiva` | `falla_masiva` | 112-130 |

`Despacho.casos` es una relación con borrado en cascada y carga `selectin`
(`app/models/despacho_entities.py:42-44`), y `DespachoCasos.despacho` es su inverso
(`app/models/despacho_entities.py:65`). `CuadrillaSectorDia` solo declara la restricción
`UNIQUE (fecha, id_sector)` y no expone relaciones ORM
(`app/models/despacho_entities.py:90-92`). La tabla `notificacion` guarda `intentos` y
`proximo_intento`, claves del *outbox* (`app/models/despacho_entities.py:107-108`).

---

## Página web DESPACHO (app/web/src/pages/Despacho.tsx)

La página se monta en la ruta protegida `/despacho` (`app/web/src/App.tsx:32`) y consume el
cliente API compartido (`app/web/src/api/client.ts:553-694`).

### Estructura de la página

| Bloque | Contenido | Línea |
|---|---|---|
| Jornada | Selector de fecha, «Simular propuesta» y «Procesar despacho». | 578-615 |
| Propuesta | Resumen, chips de reglas y tablas por cuadrilla + «Sin asignar». | 617-690 |
| Despachos del día | Tabla con estado, casos, canal, origen y acciones. | 692-775 |
| Detalle | Ficha, publicar/cerrar, casos editables, envío, notificaciones y alta de caso. | 777-1065 |
| Reporte de producción | Global del día y del despacho seleccionado. | 1067-1091 |
| Fallas masivas | Alta y tabla de registradas. | 1092-1213 |

### Formulario flotante de proceso (app/web/src/components/ProcesarDespacho.tsx)

El componente implementa el requisito de UI 6 del ciclo **D-66** y se presenta dentro del
modal genérico, que ocupa el **90 % de la ventana** del navegador
(`app/web/src/components/Modal.tsx:4-7`):

- Carga el proceso con `api.obtenerProcesoDespacho({ fecha })` y siembra el estado local de
  asignación a partir de `datos.sectores`
  (`app/web/src/components/ProcesarDespacho.tsx:32-50`).
- Muestra cuatro tarjetas con el **universo de casos**, comunes, especiales y sin sector
  (`:113-130`) y una tabla del universo con filtros **Todos / Comunes / Especiales**
  (`:132-184`).
- Muestra la tabla de **sectores** con `total`, `especiales`, `citados` y un selector de
  cuadrilla por sector —la asignación es modificable— (`:186-233`), y las **cuadrillas**
  con sus sectores y su total (`:235-258`).
- Advierte cuántos sectores quedan sin cuadrilla y recuerda que sus casos no se despacharán
  salvo los citados (`:260-267`).
- Los botones **«Procesar despacho»** y **«Cancelar»** están al pie; procesar llama a
  `api.procesarDespacho({ fecha, asignaciones, reemplazar: true })` (`:83-94,269-276`).

### Acciones y control por rol

- El modo **solo lectura** para el rol `TECNICO` se anuncia con un aviso y oculta simular,
  procesar, editar y enviar (`app/web/src/pages/Despacho.tsx:195,569-576`).
- Las reglas incumplidas (`cumple_min_referidos`, `cumple_min_empresas`,
  `construccion_en_una_sola`) se resaltan con chips de alerta
  (`app/web/src/pages/Despacho.tsx:533-556,650-662`).
- «Publicar» y «Cerrar» llaman a `cambiarEstadoDespacho(...)` → `actualizarDespacho(...)`;
  «Imprimir» pide el HTML y lo abre en otra pestaña
  (`app/web/src/pages/Despacho.tsx:379-396,464-484,828-855`).
- El formulario de envío usa canal `TELEGRAM`/`CORREO` y un destinatario opcional cuya ayuda
  indica «Vacío = destino configurado» (`app/web/src/pages/Despacho.tsx:935-981`); el
  resultado del envío se muestra con su estado y error
  (`app/web/src/pages/Despacho.tsx:971-977`).

---

## Pruebas (app/tests/test_despacho_api.py 23)

La tabla de pruebas de la Fase 4 registró `test_despacho_api.py` con **17 pruebas** de
integración para «Propuesta, balanceo, generación, publicación y fallas masivas»
(`RepoTecnico/pruebas/informe_fase4.md:73`), dentro del total **169/169** en verde
(`RepoTecnico/pruebas/informe_fase4.md:94`). Tras el ciclo **D-66** la suite del archivo
contiene **23 pruebas**: se añadieron las de proceso del día, asignación de sectores,
reparto por sector asignado, sector sin cuadrilla, citado sin sector y casos especiales. El
plan de pruebas asigna a E2E-06 la cobertura de «Propuesta, generación del despacho y falla
masiva manual» para RF-08/RF-09/RF-24 (`RepoTecnico/pruebas/plan_pruebas.md:71,87`).

### Escenarios cubiertos por la suite de integración

| Escenario | Verificación | Línea |
|---|---|---|
| Sin token | `401`. | `app/tests/test_despacho_api.py:66-68` |
| TECNICO no puede proponer | `403`. | `app/tests/test_despacho_api.py:70-73` |
| Reparto por sector | 10 casos, 2 grupos, cada caso una vez; reglas del brief. | `app/tests/test_despacho_api.py:75-91` |
| Construcción en una sola cuadrilla | Un único grupo con `CONSTRUCCION`. | `app/tests/test_despacho_api.py:92-98` |
| Orden de visita por cuadrilla | Secuencia 1..N. | `app/tests/test_despacho_api.py:99-104` |
| Exclusión de cuadrilla 0 | El caso marcado no aparece. | `app/tests/test_despacho_api.py:105-115` |
| Exclusión de cerrados | El caso `CERRADO` no aparece. | `app/tests/test_despacho_api.py:116-122` |
| Citados del día | Un caso de cuadrilla 0 con cita entra y marca `es_cita`. | `app/tests/test_despacho_api.py:123-136` |
| Sin cuadrillas | Propuesta vacía y `cuadrillas_activas == 0`. | `app/tests/test_despacho_api.py:137-176` |
| Proceso del día | Universo, sectores y cuadrillas con su asignación (**D-66**). | `app/tests/test_despacho_api.py:178-204` |
| Reparto por sector asignado | Cada caso va a la cuadrilla de su sector (**D-66**). | `app/tests/test_despacho_api.py:205-215` |
| Sector sin cuadrilla | Sus casos quedan en `sin_asignar` (**D-66**). | `app/tests/test_despacho_api.py:216-226` |
| Citado sin sector asignado | No se pierde: va a la cuadrilla menos cargada (**D-66**). | `app/tests/test_despacho_api.py:227-240` |
| Procesar con asignación | Guarda la asignación y crea los despachos (**D-66**). | `app/tests/test_despacho_api.py:241-262` |
| Casos especiales | El despacho incluye REFERIDO/EMPRESA/GOBIERNO (**D-66**). | `app/tests/test_despacho_api.py:263-274` |
| Generar y no duplicar | 201, 409 sin reemplazar, 201 con `reemplazar=true`. | `app/tests/test_despacho_api.py:275-294` |
| Agregar/quitar caso | 200, 409 al duplicar y cambio de estado. | `app/tests/test_despacho_api.py:295-324` |
| Publicar | `estado=PUBLICADO` y `enviado_en` no nulo. | `app/tests/test_despacho_api.py:325-334` |
| Caso de cuadrilla 0 al agregar | 409. | `app/tests/test_despacho_api.py:335-349` |
| Imprimible | HTML con `size: letter`, título y `ID avería`. | `app/tests/test_despacho_api.py:350-360` |
| Reporte de producción | Totales y reporte global ≥ del despacho. | `app/tests/test_despacho_api.py:361-374` |
| Envío sin credenciales | `PENDIENTE` y error con `TELEGRAM_BOT_TOKEN`. | `app/tests/test_despacho_api.py:375-395` |
| Fallas masivas | Alta en `DETECTADA` y listado. | `app/tests/test_despacho_api.py:396-405` |

El *fixture* `entorno` monta dos sectores, dos cuadrillas y un universo de diez casos que
incluye dos referidos, una empresa y una construcción
(`app/tests/test_despacho_api.py:16-54`), lo que permite validar las reglas del brief de
forma determinista.
