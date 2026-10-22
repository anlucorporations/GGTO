# 06 — Seguimiento, casos especiales y agenda

## Visión general (RF-12, RF-34..RF-36, D-30/D-53/D-156)

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

La decisión **D-53** convive ahora con los ciclos **D-89/D-90**: el **identificador
de pago (70\*)** es el eje del histórico (`app/models/pago_entities.py`) y una
REPARACIÓN **exige** 70\* + ID de avería **real**; si le falta cualquiera de los dos,
el caso pasa a `tipo_caso='REFERIDO'` y se registra como **caso especial**
(`app/services/clasificacion.py:121-173`). Esa regla es la que convierte a REFERIDO
en la puerta de entrada de los casos que antes se quedaban como reparaciones
incompletas.

La decisión **D-156** cierra el alcance pendiente de este ciclo: **SEGUIMIENTO**
es una página real de la web (no un módulo vacío), el cierre de un especial
avisa al **solicitante externo ACT-03**, el cierre de una masiva exige un
**validador CRASS de la misma central** y el **supervisor de cuadrilla** queda
solo como etiqueta organizativa. El detalle está en la sección
[SEGUIMIENTO web y aviso ACT-03 (D-156)](#seguimiento-web-y-aviso-act-03-d-156).

### Alcance funcional

| Requisito | Descripción | Evidencia en código |
|---|---|---|
| **RF-12** | Contactar y acordar hora con el cliente; gestionar la agenda interna. | `app/api/routes_especiales.py:388-484` |
| **RF-34** | Gestionar el seguimiento de casos derivados a otras instancias/colas. | `app/api/routes_especiales.py` (`listar_seguimiento`, `_resumen_seguimiento`) |
| **RF-35** | Gestionar casos **EMPRESA** (reparación/construcción) y su cita. | `app/api/routes_especiales.py:189-267` |
| **RF-36** | Gestionar casos **REFERIDO** sin `id_averia`, priorizados, con identificador `REF-…`. | `app/api/routes_especiales.py:73-125` |
| **RNF-04** | Agenda sin solapamiento por cuadrilla. | `app/api/routes_especiales.py:365-386` |
| **RF-49/RF-50 (D-90)** | Una REPARACIÓN sin identificador de pago (70\*) o sin ID de avería real se registra como **REFERIDO**. | `app/services/clasificacion.py:121-173` |

### Archivos de referencia

| Capa | Archivo |
|---|---|
| Router FastAPI | `app/api/routes_especiales.py` |
| Esquemas Pydantic | `app/schemas/especiales.py` |
| Modelos SQLAlchemy | `app/models/especiales_entities.py` |
| DDL y función `REF-…` | `RepoTecnico/db/schema.sql:38-57,391-459` |
| Regla REPARACIÓN/REFERIDO (D-90) | `app/services/clasificacion.py` |
| Identificador de pago (D-89) | `app/services/pagos.py`, `app/models/pago_entities.py`, DDL `RepoTecnico/db/schema.sql:292-304` |
| Páginas web | `app/web/src/pages/Especiales.tsx`, `app/web/src/pages/Agenda.tsx`, `app/web/src/pages/Seguimiento.tsx` |
| Aviso al solicitante externo (D-156) | `app/services/avisos.py`, `app/services/notificaciones.py` |
| Pruebas de integración | `app/tests/test_especiales_api.py`, `app/tests/test_d120_especiales_estado.py`, `app/tests/test_d90_clasificacion.py` |

El router se monta en `app/main.py:89` con prefijo general `/api/v1`
(`app/api/routes_especiales.py:42`). Las escrituras exigen `ADMIN` o `SUPERVISOR` mediante
`_escritura = require_roles("ADMIN", "SUPERVISOR")` (`app/api/routes_especiales.py:43`); el
rol `SUPER` tiene bypass total (`app/api/deps.py:20,65`).

---

## Casos especiales

Un **caso especial** es un subtipo de caso (`REFERIDO`, `EMPRESA` o `GOBIERNO`) que se
registra con o sin caso asociado; cuando no existe, el sistema lo crea automáticamente.
La tabla se describe en `RepoTecnico/diccionario_datos.md:324-338` y su DDL está en
`RepoTecnico/db/schema.sql:400-417`.

### clasificación REFERIDO/EMPRESA/GOBIERNO

El campo `clasificacion` es obligatorio y solo admite tres valores, validados tanto en la
base de datos (`CHECK (clasificacion IN ('REFERIDO','EMPRESA','GOBIERNO'))`,
`RepoTecnico/db/schema.sql:404-405`) como en Pydantic mediante el literal `Clasificacion`
(`app/schemas/especiales.py:10`). Al crear el caso asociado, la clasificación se copia en
`Caso.categoria` (`app/api/routes_especiales.py:106`), de modo que el motor de despacho puede
derivar el `tipo_asignacion` (`app/services/despacho.py:93-96`).

### prioridad ALTA/MEDIA/BAJA

`prioridad` es `NOT NULL DEFAULT 'MEDIA'` con `CHECK` de tres niveles
(`RepoTecnico/db/schema.sql:408-409`). En Pydantic es un literal con valor por defecto
`MEDIA` (`app/schemas/especiales.py:12,40`). El listado admite filtrar por prioridad
(`app/api/routes_especiales.py:117-118`), y la SPA la muestra con una clase CSS por nivel
(`app/web/src/pages/Especiales.tsx:50-52,311-313`).

### solicitante (unidad+nombre+contacto+canal)

El **solicitante** es el personal externo que reporta el caso. La tabla exige `unidad`,
`nombre` y `contacto` (`NOT NULL`) y restringe el canal a
`TELEGRAM`/`MCP_IA`/`MANUAL`/`CORREO` (`RepoTecnico/db/schema.sql:391-397`; descripción en
`RepoTecnico/diccionario_datos.md:313-322`). En Pydantic, `SolicitanteCreate` limita las
longitudes a 120/120/60 y deja el canal por defecto en `MANUAL`
(`app/schemas/especiales.py:22-26`).

En la creación del caso especial se aceptan **dos vías mutuamente excluyentes**:
`id_solicitante` (referencia a uno existente) o `crear_solicitante` (se crea en la misma
operación). Si se envían ambos, la API responde **422**
`"Indique `id_solicitante` o `crear_solicitante`, no ambos"`
(`app/api/routes_especiales.py:196-200`; la condición escrita en el código es
`datos.id_caso and datos.id_solicitante and datos.crear_solicitante`, así que el 422
solo se dispara si además viaja `id_caso`). Crear en línea agrega y hace `flush` del
solicitante para obtener su ID (`app/api/routes_especiales.py:203-207`); si se referencia un
ID inexistente, responde **404** (`app/api/routes_especiales.py:208-209`).

### creación automática del caso REF-...

Cuando `CasoEspecialCreate` no trae `id_caso`, el helper `_crear_caso_asociado(...)` crea el
caso (`app/api/routes_especiales.py:73-125`; se invoca en `:217`). Sus pasos son:

1. Resolver la central configurada (`app/api/routes_especiales.py:74-75`).
2. Obtener el `id_averia`: el enviado por el cliente o, si falta, el generado por la función
   de base de datos `generar_id_averia_ref(:c)` (`app/api/routes_especiales.py:76-78`). Esa
   función construye `REF-<CÓDIGO_CENTRAL>-<NNNNNN>` con `seq_caso_ref`
   (`RepoTecnico/db/schema.sql:38-57`); para la Central Francisco Salias produce valores como
   `REF-2324X-000001`.
3. Rechazar duplicados con **409** `"Ya existe un caso con id_averia …"`
   (`app/api/routes_especiales.py:79-80`).
4. **Datos obligatorios del alta (RN-AL-01)**: el `CasoEspecialCreate` exige nombre y
   teléfono de contacto (`nombre_cliente`, `contacto_cliente`), la dirección del inmueble
   (`direccion`) y el teléfono con el **identificador de pago (70\*)** (`telefono`); los datos
   del **solicitante** (nombre, unidad y contacto) son obligatorios siempre, ya sea por
   `crear_solicitante` o por `id_solicitante`. Si el tipo de reporte (`tipo_actividad`) es
   **REPARACIÓN**, también son obligatorios el `id_averia` y el `tipo_problema`. Las
   validaciones viven en el `model_validator` de `CasoEspecialCreate`
   (`app/schemas/especiales.py`); los datos del caso solo se exigen cuando el especial
   **crea** su caso asociado (`id_caso` no informado).
5. **Clasificar el teléfono (D-89)**: el número informado debe cumplir el patrón del
   identificador de pago (`pago.serie_regex`); si no lo cumple, el alta responde **422**
   (`app/api/routes_especiales.py`). El 70\* se normaliza, se le resuelve su ficha en
   `identificador_pago` (`app/services/pagos.py:157-193`) y queda como `telefono` del caso;
   el **teléfono de contacto** (`contacto_cliente`) se normaliza aparte y se suma a
   `informacion` como `[CONTACTO] <numero>` (`app/services/pagos.py:144-151`).
6. Sectorizar la dirección con los patrones de la central
   (`app/api/routes_especiales.py:100`; `app/services/sectorizacion.py`).
7. Crear el `Caso` con `origen="MANUAL"`, `estado_actual="NUEVO"`, `id_pago` resuelto,
   `tipo_caso` igual a `CONSTRUCCION` si `tipo_actividad == "CONSTRUCCION"` y
   `REPARACION` en caso contrario, `categoria=datos.clasificacion` y `tipo_problema`
   informado (`app/api/routes_especiales.py:101-119`).
8. **Aplicar la regla D-90** (`app/api/routes_especiales.py:122-124`): si el caso quedó como
   REPARACIÓN sin 70\* o sin ID de avería real, se convierte a `tipo_caso='REFERIDO'` y deja
   traza en `auditoria` (ver la sub-sección siguiente).

El caso especial se persiste en estado `ABIERTO` y con `tiene_id_averia` **real**: desde
D-90 el campo lo calcula `clasificacion.tiene_id_averia_real(caso)`
(`app/api/routes_especiales.py:219-220,232`; `app/services/clasificacion.py:41-44`), de modo
que un `id_averia` sintético `REF-…` **no** cuenta como avería. Además, la ficha es
**idempotente**: si ya existe una fila `caso_especial` para el caso —por ejemplo, la creó la
regla de reclasificación— se actualiza en lugar de duplicarla
(`app/api/routes_especiales.py:222-227`). La prueba de integración verifica que un referido
sin `id_averia` obtiene uno que empieza por `REF-2324X-` y que el caso asociado queda con
`categoria == "REFERIDO"` (`app/tests/test_especiales_api.py:69-81`); la regla tiene su
propia suite en `app/tests/test_d90_clasificacion.py`.

### regla REPARACIÓN/REFERIDO (D-90)

Una **REPARACIÓN** exige **identificador de pago (70\*) + ID de avería real**. La regla vive
en `app/services/clasificacion.py` y es la misma para cualquier camino de escritura:

| Pieza | Línea | Qué hace |
|---|---|---|
| `tiene_id_averia_real()` | `:41-44` | Verdadero solo si `id_averia` no está vacío y **no** empieza por `REF-`. El identificador sintético no cuenta como avería. |
| `esta_marcado()` | `:47-51` | **Marca derivada** (no es columna): `tipo_caso == 'REPARACION'` y (`id_pago` nulo **o** sin avería real). |
| `motivo_marca()` | `:54-66` | `SIN_IDENTIFICADOR_PAGO`, `SIN_ID_AVERIA` o `SIN_IDENTIFICADOR_PAGO_Y_AVERIA`. |
| `clasificacion_especial()` | `:69-71` | `EMPRESA`/`GOBIERNO` se conservan; el resto es `REFERIDO`. |
| `asegurar_caso_especial()` | `:77-105` | Crea o actualiza la ficha `caso_especial` — **idempotente**, una sola fila por caso (`:88-90`). |
| `aplicar_regla_reparacion()` | `:121-173` | Convierte a `REFERIDO`, ajusta `categoria`, asegura la ficha y audita (`RECLASIFICACION_REFERIDO`, `:31`). |
| `aplicar_en_cambio()` | `:176-194` | Envoltorio para cualquier cambio del caso. |

La regla se aplica en **los 8 caminos de escritura**: `app/api/routes_especiales.py:124`
(ALTA_ESPECIAL) y, en `app/api/routes_casos.py`, `:426` (ALTA_MANUAL), `:515` (EDICION),
`:540` (CAMBIO_ESTADO), `:630` (CIERRE), `:661` (CITA), `:744` (NO_CONTESTA) y `:840`
(ENRUTADO).

> **Nota de diseño (D-90).** La primera redacción contemplaba **no** reclasificar los casos
> que ya estaban en estado terminal. Es **inexecutable** con el modelo de D-89: el `CHECK
> ck_reparacion_con_ip` rige para **todo** `UPDATE` (`RepoTecnico/db/schema.sql:834-843`), de
> modo que una fila marcada cuya única modificación sea el estado no podría guardarse sin
> reclasificar. Por tanto, **cualquier escritura regulariza el caso** (DEC-IP-3) y los que
> quedaron terminales tras la migración se informan en MONITOREO como **pendientes
> históricos** (RF-55; ver el manual 07).

La base lo refuerza por dos vías: el trigger `trg_caso_reparacion_a_referido`
(`RepoTecnico/db/schema.sql:812-830`), que decide **antes** de validar (`BEFORE INSERT OR
UPDATE`) y conserva `EMPRESA`/`GOBIERNO` como clasificación de negocio (`:819-821`), y el
`CHECK ck_reparacion_con_ip` (`:834-843`), red de seguridad declarada `NOT VALID` para no
escanear las filas históricas. `tipo_caso` ya incluye `REFERIDO`
(`RepoTecnico/db/schema.sql:315-316`).

---

## Endpoints de solicitantes y casos especiales (app/api/routes_especiales.py:52,59,128,189,242,252)

| Método y ruta | Línea | Rol | Resumen |
|---|---|---|---|
| `GET /api/v1/solicitantes` | 52 | Lectura | Lista solicitantes por unidad y nombre. |
| `POST /api/v1/solicitantes` | 59 | Escritura | Crea un solicitante. |
| `GET /api/v1/casos-especiales` | 128 | Lectura | Lista con filtros y resumen. |
| `POST /api/v1/casos-especiales` | 189 | Escritura | Ingresa un caso especial. |
| `GET /api/v1/casos-especiales/{id}` | 242 | Lectura | Ficha del caso especial. |
| `PATCH /api/v1/casos-especiales/{id}` | 252 | Escritura | Actualiza el caso especial. |

### Solicitantes

- `GET /solicitantes` devuelve el padrón ordenado por `unidad` y `nombre`
  (`app/api/routes_especiales.py:52-57`).
- `POST /solicitantes` construye el ORM con `datos.model_dump()`, confirma y refresca; el
  código HTTP es **201** (`app/api/routes_especiales.py:59-67`).

### Casos especiales

- `GET /casos-especiales` acepta `clasificacion`, `estado`, `prioridad`, `tipo_actividad`,
  `id_solicitante` y `solo_pendientes`. El filtro «solo pendientes» restringe a los estados
  `ABIERTO` y `EN_PROCESO` (`app/api/routes_especiales.py:145-156`). El listado se enriquece
  con `_resumen_especiales(...)` (`app/api/routes_especiales.py:186`).
- `POST /casos-especiales` exige al menos `clasificacion` y `tipo_actividad`; con `id_caso`
  usa un caso existente (**404** si no existe) y sin él lo crea con el helper descrito
  (`app/api/routes_especiales.py:211-218`).
- `GET /casos-especiales/{id}` responde **404** `"Caso especial no encontrado"` si el ID no
  existe (`app/api/routes_especiales.py:242-249`).
- `PATCH /casos-especiales/{id}` aplica solo los campos enviados
  (`exclude_unset=True`) sobre `estado`, `prioridad`, `descripcion`, `requiere_informe`,
  `clasificacion`, `tipo_actividad` e `id_solicitante`
  (`app/api/routes_especiales.py:262-263`; esquema en `app/schemas/especiales.py:55-62`).

### Resumen de estado calculado

`_resumen_especiales(...)` (`app/api/routes_especiales.py:269-353`) añade a cada fila los
campos de contexto que consume la SPA:

| Campo | Regla |
|---|---|
| `sector_nombre` | Nombre del sector del caso asociado. |
| `solicitante_nombre` / `solicitante_unidad` | Datos del solicitante referenciado. |
| `pendiente` | `estado` en `ABIERTO`/`EN_PROCESO`. |
| `asignado` | El caso está en `despacho_caso`. |
| `citado` | Tiene cita en estado `PROPUESTA`/`CONFIRMADA` (por caso o por caso especial). |
| `gestion` | `en_gestion_supervisor`, `estado_actual == "EN_GESTION"` o fila de despacho `GESTIONADO`. |

Estas marcas se calculan con consultas agregadas (`app/api/routes_especiales.py:283-296`) y
se vuelcan sobre `CasoEspecialOut` (`app/schemas/especiales.py:65-96`) en
`_resumen_especiales` (`app/api/routes_especiales.py:328-352`), que desde **D-80** añade además la
**cuadrilla del último despacho** del caso asociado. En la SPA se pintan con el componente
`EstadoChips` (`app/web/src/pages/Especiales.tsx:450-458`), donde el segundo indicador es el
icono de la cuadrilla con su color.

---

## Agenda de citas

La agenda gestiona el compromiso de contacto o atención con el cliente. La tabla se
describe en `RepoTecnico/diccionario_datos.md:346-358` y su DDL en
`RepoTecnico/db/schema.sql:445-459`.

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
NULL)` (`RepoTecnico/db/schema.sql:458`) garantiza que toda cita apunte a un caso. En el ORM
corresponde a `Cita` (`app/models/especiales_entities.py:54-70`) y en Pydantic a
`CitaCreate`/`CitaOut` (`app/schemas/especiales.py:94-126`).

### validación de solapamiento (409)

La duración por defecto de una cita es `DURACION_POR_DEFECTO = 60` minutos y los estados que
bloquean son `("PROPUESTA", "CONFIRMADA")`
(`app/api/routes_especiales.py:45-46`). `_duracion(...)` los lee de la configuración
`agenda.duracion_minutos` y `agenda.estados_bloqueantes`, con los valores por defecto si no
están definidos (`app/api/routes_especiales.py:358-362`). *Pendiente de confirmar* si esas dos
claves están sembradas en la base: no aparecen en `RepoTecnico/db/schema.sql`.

`_validar_solape(...)` (`app/api/routes_especiales.py:365-386`) solo actúa si hay cuadrilla
(`app/api/routes_especiales.py:367-368`). Calcula el fin como `fecha_hora + duración`
(`app/api/routes_especiales.py:370`) y busca otra cita de la misma cuadrilla en estado
bloqueante cuyo intervalo se cruce, usando `make_interval(0,0,0,0,0,duracion)` para modelar
la duración en minutos del lado SQL (`app/api/routes_especiales.py:371-379`). Si hay choque,
responde **409** con el detalle
`"La cuadrilla ya tiene una cita a las <fecha> (duración <n> min)"`
(`app/api/routes_especiales.py:380-385`).

El solapamiento puede **forzarse** con `permitir_solape`, pero solo el rol `SUPER`: en caso
contrario la API responde **403** `"Solo el Super Usuario puede forzar solapamientos"`
(`app/api/routes_especiales.py:434-437`, `:461-464`; constante `ROL_SUPER` en
`app/api/deps.py:20`).

### estados

Los estados válidos son `PROPUESTA`, `CONFIRMADA`, `CUMPLIDA`, `REPROGRAMADA`, `DIFERIDA` y
`CANCELADA` (`app/schemas/especiales.py:16`; `RepoTecnico/db/schema.sql:453-454`). La SPA
ofrece acciones directas para confirmar, cumplir, diferir y cancelar
(`app/web/src/pages/Agenda.tsx:24-29`). El borrado lógico no elimina la fila: `DELETE` pasa
la cita a `CANCELADA` (`app/api/routes_especiales.py:472-480`), de modo que deja de bloquear
agenda porque ese estado no está entre los bloqueantes (verificado en
`app/tests/test_especiales_api.py:145-153`).

### endpoints (routes_especiales.py:388,418,446,472)

| Método y ruta | Línea | Rol | Resumen |
|---|---|---|---|
| `GET /api/v1/citas` | 388 | Lectura | Agenda filtrada por rango, cuadrilla y estado. |
| `POST /api/v1/citas` | 418 | Escritura | Agenda una cita sin solapamiento. |
| `PATCH /api/v1/citas/{id_cita}` | 446 | Escritura | Reprograma / cambia estado. |
| `DELETE /api/v1/citas/{id_cita}` | 472 | Escritura | Cancela la cita (**204**). |

- `GET /citas` ordena por `fecha_hora` y filtra por `desde`, `hasta`, `id_cuadrilla`, `estado`
  y —desde D-72— `tipo_caso` y `categoria` del caso asociado
  (`app/api/routes_especiales.py:399-414`).
- `POST /citas` exige `id_caso` o `id_caso_especial` y responde **422** si faltan ambos
  (`app/api/routes_especiales.py:425-426`); valida la existencia del caso, del caso especial
  y de la cuadrilla con **404** (`app/api/routes_especiales.py:427-432`). Al persistir
  excluye el campo auxiliar `permitir_solape` y registra `creado_por=usuario.p00`
  (`app/api/routes_especiales.py:439`).
- `PATCH /citas/{id_cita}` valida el solapamiento solo si cambian `fecha_hora` o
  `id_cuadrilla`, excluyendo la propia cita del chequeo (`id_excluir=id_cita`)
  (`app/api/routes_especiales.py:458-464`).
- `DELETE /citas/{id_cita}` responde **404** si no existe y **204** al cancelar
  (`app/api/routes_especiales.py:472-480`).

---

## Seguimiento

El seguimiento registra la derivación de un caso a otra instancia o cola (**RF-34**). Su
tabla se describe en `RepoTecnico/diccionario_datos.md:340-344` y su DDL en
`RepoTecnico/db/schema.sql:431-442`.

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
(`app/schemas/especiales.py:242-264`). Desde **D-156** `SeguimientoOut` ya no devuelve solo
la derivación: añade `id_averia`, `nombre_cliente`, `direccion`, `sector_nombre`,
`estado_caso`, `id_central` y la cuadrilla del último despacho (`id_cuadrilla`,
`cuadrilla_codigo`, `cuadrilla_nombre`). Esos campos los calcula `_resumen_seguimiento` en
bloque, sin una consulta por fila.

### exclusión del despacho

Al crear un seguimiento en estado `EN_COLA`, el caso pasa a `estado_actual = "ENRUTADO"`
(`crear_seguimiento` en `app/api/routes_especiales.py`). Como el motor de despacho excluye
explícitamente los estados `CERRADO`, `CANCELADO` y `ENRUTADO`
(`app/services/despacho.py:23,114`), el caso **sale del despacho de calle** hasta que se
devuelva. La prueba de integración comprueba que un caso enrutado no aparece en la
propuesta (`app/tests/test_especiales_api.py:188-203`). Al pasar el seguimiento a
`DEVUELTO`, el caso vuelve a `NUEVO` y a `en_gestion_supervisor=False`, y se sella
`fecha_retorno`; con ello vuelve a estar disponible (`app/tests/test_especiales_api.py:205-210`).
`RESUELTO` también sella `fecha_retorno`, pero **no cierra** el caso: el cierre formal sigue
su camino normal (informe y evidencias).

### endpoints (`app/api/routes_especiales.py`)

| Método y ruta | Función | Rol | Resumen |
|---|---|---|---|
| `GET /api/v1/seguimiento` | `listar_seguimiento` | Lectura | Lista derivaciones con filtros y alcance. |
| `POST /api/v1/seguimiento` | `crear_seguimiento` | ADMIN/SUPERVISOR | Deriva un caso a otra instancia. |
| `PATCH /api/v1/seguimiento/{id}` | `actualizar_seguimiento` | ADMIN/SUPERVISOR | Actualiza estado / datos. |
| `GET /api/v1/seguimiento/{id}` | `obtener_seguimiento` | Lectura | Ficha de la derivación. |

- `GET /seguimiento` ordena por `id_seguimiento` descendente y filtra por `id_caso`,
  `estado`, `instancia_destino` (búsqueda parcial con `ilike`) y **`q`** (texto libre sobre
  avería, cliente, dirección, sector, instancia y motivo). El alcance se aplica **en SQL**
  antes de resumir: central del usuario y, para el TÉCNICO, `casos_permitidos` (cuadrilla
  vigente + ventana D-123). Un TÉCNICO sin cuadrilla ve **cero** filas (fail-closed); el
  COORDINADOR no tiene esta capacidad (el menú no se la muestra y la API devuelve vacío).
- `POST /seguimiento` valida el caso con `_caso_visible_seguimiento` (**404** si es de otra
  central/cuadrilla, para no confirmar su existencia), rechaza **409** un caso
  `CERRADO`/`CANCELADO` y registra `usuario=usuario.p00`.
- `PATCH /seguimiento/{id}` aplica solo los campos enviados; `DEVUELTO` restituye el caso y
  `EN_COLA` lo vuelve a enrutar. La visibilidad se comprueba también aquí.
- `GET /seguimiento/{id}` responde **404** `"Seguimiento no encontrado"` si no existe o si
  el caso queda fuera del alcance.

### SEGUIMIENTO web y aviso ACT-03 (D-156)

La página real es `app/web/src/pages/Seguimiento.tsx`, montada en la ruta `/seguimiento`
(`app/web/src/App.tsx`) y visible en la barra para SUPER, ADMIN, SUPERVISOR y TÉCNICO
(`app/web/src/components/Layout.tsx`). Ofrece resumen por estado, búsqueda libre, filtro de
estado e instancia, tabla con caso/cliente/dirección/sector/instancia/fecha/estado, alta de
una derivación y edición del detalle. El TÉCNICO solo consulta; los botones de escritura se
muestran a ADMIN y SUPERVISOR, que son los roles que exige el backend.

El **solicitante externo (ACT-03)** se da de alta manualmente por el supervisor en el
catálogo de personal externo y recibe un **aviso de cierre**:

| Aspecto | Comportamiento |
|---|---|
| Disparadores | `PATCH /casos-especiales/{id}` cuando el especial pasa a `CERRADO` y `clasificacion.sincronizar_estado_especial` cuando el caso se cierra desde la APK/campo. |
| Servicio | `app/services/avisos.py::avisar_cierre_especial`. |
| Contenido | Unidad, nombre, contacto, ID de avería, dirección e informe de atención. |
| Deduplicación | Por caso + canal + asunto: si ya existe el aviso, no se repite. |
| Canales | Los automáticos del catálogo; `MANUAL` y `MCP_IA` se registran en el *outbox* como `PENDIENTE` para que el supervisor los entregue. No se marcan `FALLIDO`. |
| Esquema | `notificacion.canal` admite `MANUAL` (`RepoTecnico/db/schema.sql`). En una base ya creada se aplica `scripts/migrar_d156_notificacion_manual.py` (idempotente, simulación por defecto, `--aplicar`/`--si`/`--dsn`). |
| Auditoría | `AVISO_CIERRE_SOLICITANTE` con el canal y el destinatario. |
| Fuera de alcance | No hay portal público, enlace tokenizado ni alta autónoma del solicitante. |

El **supervisor de cuadrilla** (`rol_cuadrilla=SUPERVISOR`) se conserva únicamente como
**etiqueta organizativa** de la cuadrilla: no concede permisos, no crea un rol global nuevo y
no abre un flujo distinto. La validación de una masiva la ejerce el rol global `SUPERVISOR`.

El cierre de una **masiva** exige un validador **activo**, de tipo **CRASS** y de la **misma
central** de la falla (`app/services/masivas.py::cerrar`). Antes bastaba con que existiera un
solicitante activo; ahora un registro de tipo `OTRO`, inactivo o de otra central responde
**409** con el motivo. Las pruebas están en `app/tests/test_d99_masivas.py`.

---

## Esquemas (app/schemas/especiales.py) y modelos (app/models/especiales_entities.py)

### Esquemas Pydantic

`app/schemas/especiales.py` define los literales compartidos
(`app/schemas/especiales.py:10-16`) y estos modelos:

| Esquema | Línea | Uso |
|---|---|---|
| `SolicitanteCreate` / `SolicitanteOut` | 22-34 | Alta y lectura de solicitantes. |
| `CasoEspecialCreate` | 37-52 | Alta, incluido `crear_solicitante`, `telefono` (D-89) y datos del caso. |
| `CasoEspecialUpdate` | 55-62 | Edición parcial. |
| `CasoEspecialOut` | 65-96 | Ficha + campos de resumen calculados. |
| `CitaCreate` / `CitaUpdate` | 102-120 | Alta y edición de citas; `permitir_solape`. |
| `CitaOut` | 122-138 | Lectura de citas. |
| `SeguimientoCreate` / `SeguimientoUpdate` | 242-256 | Alta y edición de derivaciones. |
| `SeguimientoOut` | 258-283 | Lectura de derivaciones + contexto del caso (D-156). |

`CasoEspecialCreate.crear_solicitante` es de tipo `SolicitanteCreate` y se documenta como
«Crea el solicitante en la misma operación» (`app/schemas/especiales.py:45-47`);
`CasoEspecialCreate.telefono` (`app/schemas/especiales.py:51`) es el dato que D-89 clasifica
en el alta (70\* → identificador; otro número → contacto, ver «creación automática del caso
REF-...»). Los
esquemas de lectura habilitan `from_attributes=True` (`app/schemas/especiales.py:30,66,123,258`).

### Modelos SQLAlchemy

`app/models/especiales_entities.py` declara cuatro entidades:

| Modelo | Tabla | Línea |
|---|---|---|
| `Solicitante` | `solicitante` | 22-32 |
| `CasoEspecial` | `caso_especial` | 35-51 |
| `Cita` | `cita` | 54-73 |
| `Seguimiento` | `seguimiento` | 90-107 |

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
marcas de tiempo (`app/web/src/pages/Especiales.tsx:363-431`). Desde **D-90** el valor de
`tiene_id_averia` que se pinta (`app/web/src/pages/Especiales.tsx:521`) es el **real**: viene
calculado por el servidor con `tiene_id_averia_real()`
(`app/api/routes_especiales.py:219-220,232`) y es `No` cuando el `id_averia` es sintético
`REF-…`. La edición solo está
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
solape (`app/web/src/pages/Agenda.tsx:796-800`).

#### localizador de caso y identificador de pago (D-92)

La agenda incluye un **localizador** de caso que busca por Id de Avería, Tipo, Número o Clase
(`app/web/src/pages/Agenda.tsx:191-198`). Desde **D-92**:

- el criterio «Número (teléfono)» (`app/web/src/pages/Agenda.tsx:196`) muestra el marcador
  *«Identificador de pago (70\*) o contacto»* (`app/web/src/pages/Agenda.tsx:301`) y se envía
  al listado como filtro `telefono` (`app/web/src/pages/Agenda.tsx:230-231`);
- la ficha del caso seleccionado rotula el dato como **«Identificador de pago (70\*)»**,
  alimentado por `casoSel.telefono` (`app/web/src/pages/Agenda.tsx:339-342`).

> Nota: en `Agenda.tsx` **no** existe todavía una etiqueta separada «Número de contacto»; el
> localizador admite el contacto solo a través del filtro de número. El rótulo doble
> (identificador / contacto) sí vive en la ficha del caso
> (`app/web/src/components/FichaCaso.tsx`), que se documenta en el manual 04.

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
| EMPRESA crea caso y solicitante | `201`, `id_caso` e `id_solicitante` no nulos, `tiene_id_averia`. | `app/tests/test_especiales_api.py:51-68` |
| REFERIDO sin `id_averia` | El sistema genera `REF-2324X-…` y categoría `REFERIDO`. | `app/tests/test_especiales_api.py:70-84` |
| Filtros y actualización | Filtra por clasificación y prioridad; `PATCH` a `ATENDIDO`; solo pendientes. | `app/tests/test_especiales_api.py:86-122` |
| Crear cita | `201` y estado `PROPUESTA`. | `app/tests/test_especiales_api.py:124-128` |
| Cita requiere referencia | Sin `id_caso` ni `id_caso_especial` → `422`. | `app/tests/test_especiales_api.py:130-134` |
| No solapamiento | A 30 min → `409`; a 90 min → `201`. | `app/tests/test_especiales_api.py:136-152` |
| Cita cancelada no bloquea | `DELETE` → `204` y una nueva a 15 min es aceptada. | `app/tests/test_especiales_api.py:154-163` |
| Actualizar cita valida solape | `PATCH` en conflicto → `409`; fuera de ventana → `200`. | `app/tests/test_especiales_api.py:165-182` |
| Listado por rango | `desde`/`hasta` devuelve al menos una cita. | `app/tests/test_especiales_api.py:184-195` |
| Derivar y devolver | `ENRUTADO` y excluido del despacho; `DEVUELTO` → `NUEVO`. | `app/tests/test_especiales_api.py:197-220` |
| Seguimiento inexistente | `404`. | `app/tests/test_especiales_api.py:222-226` |
| Filtros de seguimiento | Por `instancia_destino` y por `estado=EN_COLA`. | `app/tests/test_especiales_api.py:228-243` |
| TECNICO solo lectura | `GET` = 200; `POST` de especiales y seguimiento = 403. | `app/tests/test_especiales_api.py:245-257` |
| Sin token | `401`. | `app/tests/test_especiales_api.py:259-261` |
| SUPER fuerza solape | `SUPER` → `201`; `ADMIN` → `403`. | `app/tests/test_especiales_api.py:263-266` |

El *fixture* `entorno` prepara un sector, una cuadrilla y un caso base, y expone sus
identificadores para las pruebas (`app/tests/test_especiales_api.py:17-48`). La suite cubre
así las tres verticales del módulo —especiales, agenda y seguimiento— además del control de
acceso por rol.

La regla **REPARACIÓN/REFERIDO** de D-90 tiene además su propia suite de integración:
`app/tests/test_d90_clasificacion.py`, que ejercita la marca derivada, la idempotencia de la
ficha del especial y las métricas de MONITOREO (`app/tests/test_d90_clasificacion.py:32`
apunta a `/api/v1/monitoreo/reclasificaciones`).
