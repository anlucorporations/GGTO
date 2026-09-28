# 06 — Seguimiento, casos especiales y agenda

## Visión general (RF-12, RF-34..RF-36, D-30/D-53)

Este manual cubre el **Ciclo 6** del proyecto GGTO: los **casos especiales**
(REFERIDO / EMPRESA / GOBIERNO) con su **solicitante**, la **agenda de citas** con control de
solapamiento por cuadrilla y el **seguimiento** de casos derivados a otras instancias. Las
tres capacidades comparten un mismo router, cuyo encabezado declara los requisitos
atendidos: `RF-06, RF-12, RF-34, RF-35, RF-36 / RNF-04`
(`app/api/routes_especiales.py:1`).

La decisión **D-30** fijó la ficha de casos especiales —solicitante con unidad, nombre,
contacto y canal, más prioridad y clasificación— (`RepoTecnico/estado_proyecto.md:94`). La
decisión **D-53** da por completado el Ciclo 6 con casos especiales, agenda sin solapamiento
por cuadrilla (duración configurable, `409` con el choque, forzar solo `SUPER`), seguimiento
que enruta el caso y lo saca del despacho, las páginas **ESPECIALES** y **AGENDA**, **111/111
pruebas** y despliegue `ggto-web-00008-vr5` (imagen `v8`)
(`RepoTecnico/estado_proyecto.md:120`).

### Alcance funcional

| Requisito | Descripción | Evidencia en código |
|---|---|---|
| **RF-12** | Contactar y acordar hora con el cliente; gestionar la agenda interna. | `app/api/routes_especiales.py:280-363` |
| **RF-34** | Gestionar el seguimiento de casos derivados a otras instancias/colas. | `app/api/routes_especiales.py:369-440` |
| **RF-35** | Gestionar casos **EMPRESA** (reparación/construcción) y su cita. | `app/api/routes_especiales.py:124-197` |
| **RF-36** | Gestionar casos **REFERIDO** sin `id_averia`, priorizados, con identificador `REF-…`. | `app/api/routes_especiales.py:71-100` |
| **RNF-04** | Agenda sin solapamiento por cuadrilla. | `app/api/routes_especiales.py:257-277` |

### Archivos de referencia

| Capa | Archivo |
|---|---|
| Router FastAPI | `app/api/routes_especiales.py` |
| Esquemas Pydantic | `app/schemas/especiales.py` |
| Modelos SQLAlchemy | `app/models/especiales_entities.py` |
| DDL y función `REF-…` | `RepoTecnico/db/schema.sql:38-57,367-435` |
| Páginas web | `app/web/src/pages/Especiales.tsx`, `app/web/src/pages/Agenda.tsx` |
| Pruebas de integración | `app/tests/test_especiales_api.py` |

El router se monta en `app/main.py:83` con prefijo general `/api/v1`
(`app/api/routes_especiales.py:40`). Las escrituras exigen `ADMIN` o `SUPERVISOR` mediante
`_escritura = require_roles("ADMIN", "SUPERVISOR")` (`app/api/routes_especiales.py:41`); el
rol `SUPER` tiene bypass total (`app/api/deps.py:20,65`).

---

## Casos especiales

Un **caso especial** es un subtipo de caso (`REFERIDO`, `EMPRESA` o `GOBIERNO`) que se
registra con o sin caso asociado; cuando no existe, el sistema lo crea automáticamente.
La tabla se describe en `RepoTecnico/diccionario_datos.md:324-338` y su DDL está en
`RepoTecnico/db/schema.sql:376-393`.

### clasificación REFERIDO/EMPRESA/GOBIERNO

El campo `clasificacion` es obligatorio y solo admite tres valores, validados tanto en la
base de datos (`CHECK (clasificacion IN ('REFERIDO','EMPRESA','GOBIERNO'))`,
`RepoTecnico/db/schema.sql:380-381`) como en Pydantic mediante el literal `Clasificacion`
(`app/schemas/especiales.py:10`). Al crear el caso asociado, la clasificación se copia en
`Caso.categoria` (`app/api/routes_especiales.py:86`), de modo que el motor de despacho puede
derivar el `tipo_asignacion` (`app/services/despacho.py:93-96`).

### prioridad ALTA/MEDIA/BAJA

`prioridad` es `NOT NULL DEFAULT 'MEDIA'` con `CHECK` de tres niveles
(`RepoTecnico/db/schema.sql:384-385`). En Pydantic es un literal con valor por defecto
`MEDIA` (`app/schemas/especiales.py:12,40`). El listado admite filtrar por prioridad
(`app/api/routes_especiales.py:117-118`), y la SPA la muestra con una clase CSS por nivel
(`app/web/src/pages/Especiales.tsx:50-52,311-313`).

### solicitante (unidad+nombre+contacto+canal)

El **solicitante** es el personal externo que reporta el caso. La tabla exige `unidad`,
`nombre` y `contacto` (`NOT NULL`) y restringe el canal a
`TELEGRAM`/`MCP_IA`/`MANUAL`/`CORREO` (`RepoTecnico/db/schema.sql:367-374`; descripción en
`RepoTecnico/diccionario_datos.md:313-322`). En Pydantic, `SolicitanteCreate` limita las
longitudes a 120/120/60 y deja el canal por defecto en `MANUAL`
(`app/schemas/especiales.py:22-26`).

En la creación del caso especial se aceptan **dos vías mutuamente excluyentes**:
`id_solicitante` (referencia a uno existente) o `crear_solicitante` (se crea en la misma
operación). Si se envían ambos, la API responde **422**
`"Indique `id_solicitante` o `crear_solicitante`, no ambos"`
(`app/api/routes_especiales.py:131-135`). Crear en línea agrega y hace `flush` del
solicitante para obtener su ID (`app/api/routes_especiales.py:138-142`); si se referencia un
ID inexistente, responde **404** (`app/api/routes_especiales.py:143-144`).

### creación automática del caso REF-...

Cuando `CasoEspecialCreate` no trae `id_caso`, el helper `_crear_caso_asociado(...)` crea el
caso (`app/api/routes_especiales.py:151-154`). Sus pasos son:

1. Resolver la central configurada (`app/api/routes_especiales.py:72-73`).
2. Obtener el `id_averia`: el enviado por el cliente o, si falta, el generado por la función
   de base de datos `generar_id_averia_ref(:c)` (`app/api/routes_especiales.py:74-76`). Esa
   función construye `REF-<CÓDIGO_CENTRAL>-<NNNNNN>` con `seq_caso_ref`
   (`RepoTecnico/db/schema.sql:38-57`); para la Central Francisco Salias produce valores como
   `REF-2324X-000001`.
3. Rechazar duplicados con **409** `"Ya existe un caso con id_averia …"`
   (`app/api/routes_especiales.py:77-78`).
4. Sectorizar la dirección con los patrones de la central
   (`app/api/routes_especiales.py:80`; `app/services/sectorizacion.py`).
5. Crear el `Caso` con `origen="MANUAL"`, `estado_actual="NUEVO"`, `tipo_caso` igual a
   `CONSTRUCCION` si `tipo_actividad == "CONSTRUCCION"` y `REPARACION` en caso contrario, y
   `categoria=datos.clasificacion` (`app/api/routes_especiales.py:81-97`).

El caso especial se persiste en estado `ABIERTO` y con `tiene_id_averia=True` cuando el caso
asociado existe (`app/api/routes_especiales.py:156-166`). La prueba de integración verifica
que un referido sin `id_averia` obtiene uno que empieza por `REF-2324X-` y que el caso
asociado queda con `categoria == "REFERIDO"` (`app/tests/test_especiales_api.py:69-81`).

---

## Endpoints de solicitantes y casos especiales (app/api/routes_especiales.py:50,57,103,124,173,183)

| Método y ruta | Línea | Rol | Resumen |
|---|---|---|---|
| `GET /api/v1/solicitantes` | 50 | Lectura | Lista solicitantes por unidad y nombre. |
| `POST /api/v1/solicitantes` | 57 | Escritura | Crea un solicitante. |
| `GET /api/v1/casos-especiales` | 103 | Lectura | Lista con filtros y resumen. |
| `POST /api/v1/casos-especiales` | 124 | Escritura | Ingresa un caso especial. |
| `GET /api/v1/casos-especiales/{id}` | 173 | Lectura | Ficha del caso especial. |
| `PATCH /api/v1/casos-especiales/{id}` | 183 | Escritura | Actualiza el caso especial. |

### Solicitantes

- `GET /solicitantes` devuelve el padrón ordenado por `unidad` y `nombre`
  (`app/api/routes_especiales.py:50-54`).
- `POST /solicitantes` construye el ORM con `datos.model_dump()`, confirma y refresca; el
  código HTTP es **201** (`app/api/routes_especiales.py:57-65`).

### Casos especiales

- `GET /casos-especiales` acepta `clasificacion`, `estado`, `prioridad` y `solo_pendientes`.
  El filtro «solo pendientes» restringe a los estados `ABIERTO` y `EN_PROCESO`
  (`app/api/routes_especiales.py:112-120`). El listado se enriquece con
  `_resumen_especiales(...)` (`app/api/routes_especiales.py:121`).
- `POST /casos-especiales` exige al menos `clasificacion` y `tipo_actividad`; con `id_caso`
  usa un caso existente (**404** si no existe) y sin él lo crea con el helper descrito
  (`app/api/routes_especiales.py:146-154`).
- `GET /casos-especiales/{id}` responde **404** `"Caso especial no encontrado"` si el ID no
  existe (`app/api/routes_especiales.py:173-180`).
- `PATCH /casos-especiales/{id}` aplica solo los campos enviados
  (`exclude_unset=True`) sobre `estado`, `prioridad`, `descripcion`, `requiere_informe`,
  `clasificacion`, `tipo_actividad` e `id_solicitante`
  (`app/api/routes_especiales.py:193-194`; esquema en `app/schemas/especiales.py:55-62`).

### Resumen de estado calculado

`_resumen_especiales(...)` (`app/api/routes_especiales.py:200-245`) añade a cada fila los
campos de contexto que consume la SPA:

| Campo | Regla |
|---|---|
| `sector_nombre` | Nombre del sector del caso asociado. |
| `solicitante_nombre` / `solicitante_unidad` | Datos del solicitante referenciado. |
| `pendiente` | `estado` en `ABIERTO`/`EN_PROCESO`. |
| `asignado` | El caso está en `despacho_caso`. |
| `citado` | Tiene cita en estado `PROPUESTA`/`CONFIRMADA` (por caso o por caso especial). |
| `gestion` | `en_gestion_supervisor`, `estado_actual == "EN_GESTION"` o fila de despacho `GESTIONADO`. |

Estas marcas se calculan con consultas agregadas (`app/api/routes_especiales.py:214-227`) y
se vuelcan sobre `CasoEspecialOut` (`app/api/routes_especiales.py:229-244`). En la SPA se
pintan con el componente `EstadoChips` (`app/web/src/pages/Especiales.tsx:320-327`).

---

## Agenda de citas

La agenda gestiona el compromiso de contacto o atención con el cliente. La tabla se
describe en `RepoTecnico/diccionario_datos.md:346-358` y su DDL en
`RepoTecnico/db/schema.sql:421-435`.

### modelo cita

| Campo | Tipo | Significado |
|---|---|---|
| `id_cita` | `bigserial` PK | Identificador de la cita. |
| `id_caso` | `bigint` FK→`caso`, opcional | Cita asociada a un caso. |
| `id_caso_especial` | `integer` FK→`caso_especial`, opcional | Cita asociada a un caso especial. |
| `id_cuadrilla` | `integer` FK→`cuadrilla`, opcional | Cuadrilla responsable. |
| `fecha_hora` | `timestamptz` | Fecha y hora de la cita. |
| `tipo` | `varchar(20)` | `CONTACTO` / `ATENCION`. |
| `estado` | `varchar(20)` | Estado de la cita. |
| `observacion` | `text` | Nota libre. |
| `creado_por` | `varchar(20)` FK→`usuario.p00` | Usuario que la agendó. |

La restricción `ck_cita_referencia CHECK (id_caso IS NOT NULL OR id_caso_especial IS NOT
NULL)` (`RepoTecnico/db/schema.sql:434`) garantiza que toda cita apunte a un caso. En el ORM
corresponde a `Cita` (`app/models/especiales_entities.py:54-70`) y en Pydantic a
`CitaCreate`/`CitaOut` (`app/schemas/especiales.py:94-126`).

### validación de solapamiento (409)

La duración por defecto de una cita es `DURACION_POR_DEFECTO = 60` minutos y los estados que
bloquean son `("PROPUESTA", "CONFIRMADA")`
(`app/api/routes_especiales.py:43-44`). `_duracion(...)` los lee de la configuración
`agenda.duracion_minutos` y `agenda.estados_bloqueantes`, con los valores por defecto si no
están definidos (`app/api/routes_especiales.py:250-254`). *Pendiente de confirmar* si esas dos
claves están sembradas en la base: no aparecen en `RepoTecnico/db/schema.sql`.

`_validar_solape(...)` (`app/api/routes_especiales.py:257-277`) solo actúa si hay cuadrilla
(`app/api/routes_especiales.py:259-260`). Calcula el fin como `fecha_hora + duración`
(`app/api/routes_especiales.py:262`) y busca otra cita de la misma cuadrilla en estado
bloqueante cuyo intervalo se cruce, usando `make_interval(0,0,0,0,0,duracion)` para modelar
la duración en minutos del lado SQL (`app/api/routes_especiales.py:263-271`). Si hay choque,
responde **409** con el detalle
`"La cuadrilla ya tiene una cita a las <fecha> (duración <n> min)"`
(`app/api/routes_especiales.py:272-277`).

El solapamiento puede **forzarse** con `permitir_solape`, pero solo el rol `SUPER`: en caso
contrario la API responde **403** `"Solo el Super Usuario puede forzar solapamientos"`
(`app/api/routes_especiales.py:317-320`, `:344-347`; constante `ROL_SUPER` en
`app/api/deps.py:20`).

### estados

Los estados válidos son `PROPUESTA`, `CONFIRMADA`, `CUMPLIDA`, `REPROGRAMADA`, `DIFERIDA` y
`CANCELADA` (`app/schemas/especiales.py:16`; `RepoTecnico/db/schema.sql:429-430`). La SPA
ofrece acciones directas para confirmar, cumplir, diferir y cancelar
(`app/web/src/pages/Agenda.tsx:24-29`). El borrado lógico no elimina la fila: `DELETE` pasa
la cita a `CANCELADA` (`app/api/routes_especiales.py:355-363`), de modo que deja de bloquear
agenda porque ese estado no está entre los bloqueantes (verificado en
`app/tests/test_especiales_api.py:145-153`).

### endpoints (routes_especiales.py:280,301,329,355)

| Método y ruta | Línea | Rol | Resumen |
|---|---|---|---|
| `GET /api/v1/citas` | 280 | Lectura | Agenda filtrada por rango, cuadrilla y estado. |
| `POST /api/v1/citas` | 301 | Escritura | Agenda una cita sin solapamiento. |
| `PATCH /api/v1/citas/{id_cita}` | 329 | Escritura | Reprograma / cambia estado. |
| `DELETE /api/v1/citas/{id_cita}` | 355 | Escritura | Cancela la cita (**204**). |

- `GET /citas` ordena por `fecha_hora` y filtra por `desde`, `hasta`, `id_cuadrilla` y
  `estado` (`app/api/routes_especiales.py:289-298`).
- `POST /citas` exige `id_caso` o `id_caso_especial` y responde **422** si faltan ambos
  (`app/api/routes_especiales.py:308-309`); valida la existencia del caso, del caso especial
  y de la cuadrilla con **404** (`app/api/routes_especiales.py:310-315`). Al persistir
  excluye el campo auxiliar `permitir_solape` y registra `creado_por=usuario.p00`
  (`app/api/routes_especiales.py:322`).
- `PATCH /citas/{id_cita}` valida el solapamiento solo si cambian `fecha_hora` o
  `id_cuadrilla`, excluyendo la propia cita del chequeo (`id_excluir=id_cita`)
  (`app/api/routes_especiales.py:341-347`).
- `DELETE /citas/{id_cita}` responde **404** si no existe y **204** al cancelar
  (`app/api/routes_especiales.py:355-363`).

---

## Seguimiento

El seguimiento registra la derivación de un caso a otra instancia o cola (**RF-34**). Su
tabla se describe en `RepoTecnico/diccionario_datos.md:340-344` y su DDL en
`RepoTecnico/db/schema.sql:407-418`.

### tabla seguimiento

| Campo | Tipo | Significado |
|---|---|---|
| `id_seguimiento` | `bigserial` PK | Identificador de la derivación. |
| `id_caso` | `bigint` FK→`caso` (`ON DELETE CASCADE`) | Caso derivado. |
| `instancia_destino` | `varchar(120)` | Cola o área destino. |
| `motivo` | `text` | Razón de la derivación. |
| `fecha_envio` | `timestamptz` | Fecha de envío (por defecto `now()`). |
| `fecha_retorno` | `timestamptz` | Fecha de retorno, si ocurrió. |
| `estado` | `varchar(20)` | `EN_COLA` / `RESUELTO` / `DEVUELTO`. |
| `observacion` | `text` | Nota libre. |
| `usuario` | `varchar(20)` FK→`usuario.p00` | Usuario que derivó. |

En el ORM corresponde a `Seguimiento` (`app/models/especiales_entities.py:73-90`) y en
Pydantic a `SeguimientoCreate`/`SeguimientoUpdate`/`SeguimientoOut`
(`app/schemas/especiales.py:132-158`).

### exclusión del despacho

Al crear un seguimiento en estado `EN_COLA`, el caso pasa a `estado_actual = "ENRUTADO"`
(`app/api/routes_especiales.py:400-403`). Como el motor de despacho excluye explícitamente
los estados `CERRADO`, `CANCELADO` y `ENRUTADO` (`app/services/despacho.py:23,114`), el caso
**sale del despacho de calle** hasta que se devuelva. La prueba de integración comprueba que
un caso enrutado no aparece en la propuesta
(`app/tests/test_especiales_api.py:188-203`). Al pasar el seguimiento a `DEVUELTO`, el caso
vuelve a `NUEVO` y a `en_gestion_supervisor=False`, y se sella `fecha_retorno`
(`app/api/routes_especiales.py:422-427`), con lo que vuelve a estar disponible
(`app/tests/test_especiales_api.py:205-210`).

### endpoints (routes_especiales.py:369,387,409,433)

| Método y ruta | Línea | Rol | Resumen |
|---|---|---|---|
| `GET /api/v1/seguimiento` | 369 | Lectura | Lista derivaciones con filtros. |
| `POST /api/v1/seguimiento` | 387 | Escritura | Deriva un caso a otra instancia. |
| `PATCH /api/v1/seguimiento/{id}` | 409 | Escritura | Actualiza estado / datos. |
| `GET /api/v1/seguimiento/{id}` | 433 | Lectura | Ficha de la derivación. |

- `GET /seguimiento` ordena por `id_seguimiento` descendente y filtra por `id_caso`,
  `estado` e `instancia_destino` (búsqueda parcial con `ilike`)
  (`app/api/routes_especiales.py:377-384`).
- `POST /seguimiento` responde **404** si el caso no existe y registra `usuario=usuario.p00`
  (`app/api/routes_especiales.py:394-397`).
- `PATCH /seguimiento/{id}` aplica solo los campos enviados; si el nuevo estado es
  `DEVUELTO` restituye el caso (`app/api/routes_especiales.py:419-427`).
- `GET /seguimiento/{id}` responde **404** `"Seguimiento no encontrado"` si no existe
  (`app/api/routes_especiales.py:433-440`).

---

## Esquemas (app/schemas/especiales.py) y modelos (app/models/especiales_entities.py)

### Esquemas Pydantic

`app/schemas/especiales.py` define los literales compartidos
(`app/schemas/especiales.py:10-16`) y estos modelos:

| Esquema | Línea | Uso |
|---|---|---|
| `SolicitanteCreate` / `SolicitanteOut` | 22-31 | Alta y lectura de solicitantes. |
| `CasoEspecialCreate` | 37-52 | Alta, incluido `crear_solicitante` y datos del caso. |
| `CasoEspecialUpdate` | 55-62 | Edición parcial. |
| `CasoEspecialOut` | 65-88 | Ficha + campos de resumen calculados. |
| `CitaCreate` / `CitaUpdate` | 94-111 | Alta y edición de citas; `permitir_solape`. |
| `CitaOut` | 114-126 | Lectura de citas. |
| `SeguimientoCreate` / `SeguimientoUpdate` | 132-145 | Alta y edición de derivaciones. |
| `SeguimientoOut` | 148-158 | Lectura de derivaciones. |

`CasoEspecialCreate.crear_solicitante` es de tipo `SolicitanteCreate` y se documenta como
«Crea el solicitante en la misma operación» (`app/schemas/especiales.py:45-47`). Los
esquemas de lectura habilitan `from_attributes=True` (`app/schemas/especiales.py:30,66,115,149`).

### Modelos SQLAlchemy

`app/models/especiales_entities.py` declara cuatro entidades:

| Modelo | Tabla | Línea |
|---|---|---|
| `Solicitante` | `solicitante` | 22-32 |
| `CasoEspecial` | `caso_especial` | 35-51 |
| `Cita` | `cita` | 54-70 |
| `Seguimiento` | `seguimiento` | 73-90 |

Los docstrings del módulo identifican `Solicitante` como «personal externo que reporta casos
especiales» (`app/models/especiales_entities.py:23`) y `Cita` como agenda que «no admite
solapamientos por cuadrilla» (`app/models/especiales_entities.py:55`).

---

## Páginas web ESPECIALES y AGENDA (app/web/src/pages/Especiales.tsx, Agenda.tsx)

Ambas páginas están dentro de la ruta protegida y se montan en `/especiales` y `/agenda`
(`app/web/src/App.tsx:32-33`).

### ESPECIALES

`Especiales.tsx` ofrece filtros por clasificación, estado y prioridad, más la casilla «Solo
pendientes (ABIERTO / EN_PROCESO)»
(`app/web/src/pages/Especiales.tsx:17-19,204-270`). La tabla de resultados muestra tipo de
actividad, sector, prioridad, solicitante, estado y acción
(`app/web/src/pages/Especiales.tsx:283-344`). Cada fila es clicable: si el caso especial
tiene `id_caso`, navega a `/casos` con `state.abrirCaso`; si no, abre la ficha especial
(`app/web/src/pages/Especiales.tsx:137-144,296-308`).

La ficha muestra ID de caso especial, caso asociado, solicitante, clasificación, tipo de
actividad, sector, prioridad, estado, `tiene_id_averia`, `requiere_informe`, descripción y
marcas de tiempo (`app/web/src/pages/Especiales.tsx:363-431`). La edición solo está
disponible fuera del modo lectura y permite cambiar prioridad, estado, `requiere_informe` y
descripción (`app/web/src/pages/Especiales.tsx:433-503`); el guardado envía únicamente los
campos que cambiaron (`app/web/src/pages/Especiales.tsx:146-178`).

### AGENDA

`Agenda.tsx` implementa un calendario con vistas **Día**, **Semana** y **Mes**
(`app/web/src/pages/Agenda.tsx:48,459-472`). El rango visible se calcula según la vista: un
día, la semana lunes–domingo o la rejilla mensual completa
(`app/web/src/pages/Agenda.tsx:204-215`). La carga llama a `api.listarCitas(...)` con
`desde`/`hasta` en formato `T00:00:00`/`T23:59:59` y filtros opcionales de cuadrilla y
estado (`app/web/src/pages/Agenda.tsx:217-233`).

La ficha de una cita permite confirmar, cumplir, diferir y cancelar
(`app/web/src/pages/Agenda.tsx:652-667`), reprogramar la fecha
(`app/web/src/pages/Agenda.tsx:361-382,669-694`) y eliminar (cancelar) la cita
(`app/web/src/pages/Agenda.tsx:384-399`). La casilla «Forzar solape» solo se habilita si el
rol del usuario es `SUPER` (`app/web/src/pages/Agenda.tsx:180,677-686,781-790`). Los errores
**409** y **403** se traducen a mensajes «Solapamiento: …» y «Sin permiso: …»
(`app/web/src/pages/Agenda.tsx:105-113`). La ayuda bajo el formulario recuerda que se
exige al menos un ID de caso o de caso especial y que solo el Super Usuario puede forzar el
solape (`app/web/src/pages/Agenda.tsx:805-809`).

---

## Pruebas (app/tests/test_especiales_api.py 15)

La Fase 4 registra `test_especiales_api.py` con **15 pruebas** de integración para
«Referidos/empresas/gobierno, solicitante y seguimiento»
(`RepoTecnico/pruebas/informe_fase4.md:77`), dentro del total **169/169** en verde
(`RepoTecnico/pruebas/informe_fase4.md:94`). El plan de pruebas asigna a E2E-04 y E2E-05 la
cobertura de especiales y agenda para RF-12 y RF-35/RF-36
(`RepoTecnico/pruebas/plan_pruebas.md:69-70,88`).

### Escenarios cubiertos por la suite de integración

| Escenario | Verificación | Línea |
|---|---|---|
| EMPRESA crea caso y solicitante | `201`, `id_caso` e `id_solicitante` no nulos, `tiene_id_averia`. | `app/tests/test_especiales_api.py:51-66` |
| REFERIDO sin `id_averia` | El sistema genera `REF-2324X-…` y categoría `REFERIDO`. | `app/tests/test_especiales_api.py:69-81` |
| Filtros y actualización | Filtra por clasificación y prioridad; `PATCH` a `ATENDIDO`; solo pendientes. | `app/tests/test_especiales_api.py:84-109` |
| Crear cita | `201` y estado `PROPUESTA`. | `app/tests/test_especiales_api.py:115-118` |
| Cita requiere referencia | Sin `id_caso` ni `id_caso_especial` → `422`. | `app/tests/test_especiales_api.py:121-124` |
| No solapamiento | A 30 min → `409`; a 90 min → `201`. | `app/tests/test_especiales_api.py:127-142` |
| Cita cancelada no bloquea | `DELETE` → `204` y una nueva a 15 min es aceptada. | `app/tests/test_especiales_api.py:145-153` |
| Actualizar cita valida solape | `PATCH` en conflicto → `409`; fuera de ventana → `200`. | `app/tests/test_especiales_api.py:156-172` |
| Listado por rango | `desde`/`hasta` devuelve al menos una cita. | `app/tests/test_especiales_api.py:175-182` |
| Derivar y devolver | `ENRUTADO` y excluido del despacho; `DEVUELTO` → `NUEVO`. | `app/tests/test_especiales_api.py:188-210` |
| Seguimiento inexistente | `404`. | `app/tests/test_especiales_api.py:213-216` |
| Filtros de seguimiento | Por `instancia_destino` y por `estado=EN_COLA`. | `app/tests/test_especiales_api.py:219-230` |
| TECNICO solo lectura | `GET` = 200; `POST` de especiales y seguimiento = 403. | `app/tests/test_especiales_api.py:236-247` |
| Sin token | `401`. | `app/tests/test_especiales_api.py:250-251` |
| SUPER fuerza solape | `SUPER` → `201`; `ADMIN` → `403`. | `app/tests/test_especiales_api.py:254-266` |

El *fixture* `entorno` prepara un sector, una cuadrilla y un caso base, y expone sus
identificadores para las pruebas (`app/tests/test_especiales_api.py:17-38`). La suite cubre
así las tres verticales del módulo —especiales, agenda y seguimiento— además del control de
acceso por rol.
