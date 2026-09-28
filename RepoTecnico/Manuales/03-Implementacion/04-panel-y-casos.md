# Manual técnico — Panel y gestión de casos

> Documento técnico de implementación de los módulos **PANEL** y **CASOS** de
> GGTO (CANTV C.A., Central Francisco Salias, Área 4). Cada afirmación se
> respalda con una referencia `ruta:línea` leída del repositorio. Lo no
> verificable se marca como **pendiente de confirmar**.

## Visión general (PANEL y CASOS, RF-30..RF-33)

PANEL y CASOS son la interfaz operativa del universo de averías. El catálogo de
módulos funcionales describe PANEL como «Búsqueda de caso por `id_averia` o
`teléfono`; actualización de casos; alta manual de casos nuevos»
(`RepoTecnico/requerimientos.md:59`) y CASOS como la «Data principal de casos y
su resolución (Construcción/Reparación · Residencial/Empresa/Referidos)»
(`RepoTecnico/requerimientos.md:62`).

| Requisito | Descripción | Referencia |
|---|---|---|
| RF-30 | Buscar un caso por `id_averia` o `teléfono` y mostrar su ficha completa | `RepoTecnico/requerimientos.md:136` |
| RF-31 | Actualizar/editar un caso (contacto, dirección, clasificación, estado y campos de gestión) | `RepoTecnico/requerimientos.md:137` |
| RF-32 | Alta manual de un caso nuevo | `RepoTecnico/requerimientos.md:138` |
| RF-33 | Listado con filtros (central, sector, estado, tipo, fechas), detalle y registro de resolución | `RepoTecnico/requerimientos.md:139` |
| RNF-12 | Trazabilidad y auditabilidad de los cambios | `RepoTecnico/requerimientos.md:191` |

El router se declara con `prefix="/api/v1/casos"` y la etiqueta `casos`, y su
docstring lo vincula a «RF-30, RF-31, RF-32, RF-33 y bitácora RNF-12»
(`app/api/routes_casos.py:1`, `app/api/routes_casos.py:24`).

### Permisos

La escritura exige rol ADMIN o SUPERVISOR mediante
`_escritura = require_roles("ADMIN", "SUPERVISOR")`
(`app/api/routes_casos.py:26`). Las lecturas (listado, búsqueda, ficha e
historial) usan `get_current_user`
(`app/api/routes_casos.py:92`, `app/api/routes_casos.py:175`,
`app/api/routes_casos.py:280`, `app/api/routes_casos.py:320`). El rol TECNICO
puede leer pero no crear ni editar, comportamiento fijado por
`test_tecnico_puede_leer_pero_no_escribir`
(`app/tests/test_casos_api.py:45-48`).

## Estados del caso (D-29) y ciclo de vida

### Catálogo de estados

La decisión D-29 fija nueve estados «fijos en el DDL»
(`RepoTecnico/estado_proyecto.md:93`). El catálogo se declara en el esquema
Pydantic como `ESTADOS_CASO` (`app/schemas/casos.py:10-20`) y se restringe con un
`Literal` en `EstadoCaso` (`app/schemas/casos.py:24-27`):

| # | Estado | Significado operativo |
|---|---|---|
| 1 | `NUEVO` | Estado inicial del alta manual (`app/api/routes_casos.py:254`) |
| 2 | `ASIGNADO` | Marcado como asignado en el listado (`app/api/routes_casos.py:66`) |
| 3 | `CONTACTADO` | Contacto realizado (usado en pruebas, `app/tests/test_casos_api.py:135`) |
| 4 | `CITADO` | Con cita propuesta o confirmada (`app/api/routes_casos.py:68`) |
| 5 | `DIFERIDO` | Aplazado |
| 6 | `EN_GESTION` | En gestión del supervisor (`app/api/routes_casos.py:69`) |
| 7 | `ENRUTADO` | Derivado a otra instancia |
| 8 | `CERRADO` | Cierre; excluido de «pendiente» (`app/api/routes_casos.py:63`) |
| 9 | `CANCELADO` | Cancelación; excluido de «pendiente» (`app/api/routes_casos.py:63`) |

### Restricciones en base de datos

El `CHECK` del DDL contiene exactamente la misma lista
(`RepoTecnico/db/schema.sql:297-299`), con `DEFAULT 'NUEVO'`. El modelo
SQLAlchemy declara `estado_actual` con valor por defecto `"NUEVO"` y tipo
`String(20)` (`app/models/caso_entities.py:54`). Enviar un estado inventado
produce `422`, como verifica `test_estado_invalido`
(`app/tests/test_casos_api.py:172-177`).

### Ciclo de vida observado

1. Un caso nace por ingesta CSV con `estado_actual='NUEVO'`
   (`app/models/caso_entities.py:54`) o por alta manual, que fija `NUEVO` y
   escribe la primera fila de bitácora
   (`app/api/routes_casos.py:254`, `app/api/routes_casos.py:261-269`).
2. La edición puede cambiar el estado mediante `PATCH`
   (`app/api/routes_casos.py:309-310`).
3. Cada cambio real de estado se apila en `caso_estado_hist` y se consulta por
   `GET /api/v1/casos/{id_caso}/historial`
   (`app/api/routes_casos.py:317-329`).
4. Los estados `CERRADO` y `CANCELADO` son terminales a efectos del indicador
   «pendiente» (`app/api/routes_casos.py:62-63`) y también del cálculo de fallas
   masivas (`app/services/fallas.py:71`).

## Endpoints

El router agrupa seis operaciones bajo `/api/v1/casos`
(`app/api/routes_casos.py:24`).

### `GET /api/v1/casos` (filtros y paginación)

Referencia: `app/api/routes_casos.py:89`. Devuelve un objeto `PaginaCasos` con
`items`, `total`, `page`, `page_size` y `pages`
(`app/schemas/casos.py:104-109`).

#### Filtros aceptados

| Parámetro | Tipo | Comportamiento | Referencia |
|---|---|---|---|
| `q` | texto | Búsqueda `ilike` sobre `id_averia`, `telefono`, `nombre_cliente` y `direccion` | `app/api/routes_casos.py:112-121` |
| `id_averia` | texto | `ilike` parcial | `app/api/routes_casos.py:122-123` |
| `telefono` | texto | `ilike` parcial | `app/api/routes_casos.py:124-125` |
| `id_central` | entero | Igualdad | `app/api/routes_casos.py:126-127` |
| `id_sector` | entero | Igualdad | `app/api/routes_casos.py:128-129` |
| `id_causa` | entero | Igualdad | `app/api/routes_casos.py:130-131` |
| `id_lote_ingesta` | entero | Igualdad | `app/api/routes_casos.py:132-133` |
| `estado_actual` | texto | Igualdad | `app/api/routes_casos.py:134-135` |
| `tipo_caso` | texto | Igualdad | `app/api/routes_casos.py:136-137` |
| `categoria` | texto | Igualdad | `app/api/routes_casos.py:138-139` |
| `origen` | texto | Igualdad | `app/api/routes_casos.py:140-141` |
| `en_gestion_supervisor` | booleano | Igualdad | `app/api/routes_casos.py:142-143` |
| `es_falla_masiva` | booleano | Igualdad | `app/api/routes_casos.py:144-145` |
| `desde` / `hasta` | fecha-hora | Rango sobre `fecha_reporte` | `app/api/routes_casos.py:146-149` |

#### Paginación y orden

`page` arranca en 1 (`ge=1`) y `page_size` vale 25 por defecto, con mínimo 1 y
máximo 200 (`app/api/routes_casos.py:108-109`). El total se calcula con
`count()` (`app/api/routes_casos.py:151`) y el número de páginas se deriva por
división entera (`app/api/routes_casos.py:159`). El orden es
`fecha_reporte` descendente con los nulos al final y, como desempate,
`id_caso` descendente (`app/api/routes_casos.py:155`); la prueba
`test_listado_ordenado_por_fecha_descendente` lo verifica
(`app/tests/test_casos_api.py:239-244`).

#### Iconos de estado calculados

`_resumen` completa cada `CasoOut` con `sector_nombre` y cuatro booleanos
calculados (`app/api/routes_casos.py:56-83`,
`app/schemas/casos.py:97-101`):

| Icono | Condición | Referencia |
|---|---|---|
| `pendiente` | El estado no es `CERRADO` ni `CANCELADO` | `app/api/routes_casos.py:62-63` |
| `asignado` | Existe fila en `despacho_caso` o el estado es `ASIGNADO` | `app/api/routes_casos.py:64-66` |
| `citado` | Existe cita en estado `PROPUESTA` o `CONFIRMADA` | `app/api/routes_casos.py:67-68` |
| `gestion` | `en_gestion_supervisor`, estado `EN_GESTION` o despacho `GESTIONADO` | `app/api/routes_casos.py:69-71` |

### `GET /api/v1/casos/buscar`

Referencia: `app/api/routes_casos.py:172`. Es el endpoint del buscador global y
de la búsqueda rápida del PANEL. Exige al menos uno de `q`, `id_averia` o
`telefono`; si no se envía ninguno responde `422` con el mensaje «Indique `q`,
`id_averia` o `telefono` para buscar»
(`app/api/routes_casos.py:181-185`). La prueba `test_buscar_sin_parametros` fija
ese comportamiento (`app/tests/test_casos_api.py:112-114`).

| Parámetro | Comportamiento | Referencia |
|---|---|---|
| `q` | `ilike` sobre avería, teléfono, cliente y dirección | `app/api/routes_casos.py:187-196` |
| `id_averia` | Igualdad exacta tras `strip()` | `app/api/routes_casos.py:197-198` |
| `telefono` | Igualdad o `ilike` parcial | `app/api/routes_casos.py:199-203` |
| `limite` | 20 por defecto, entre 1 y 100 | `app/api/routes_casos.py:179` |

Cuando se combinan varios criterios se aplica `or_(*condiciones)`; con un solo
criterio se usa directamente (`app/api/routes_casos.py:207`). El orden es
`fecha_reporte` descendente con nulos al final
(`app/api/routes_casos.py:208`).

### `POST /api/v1/casos` (alta manual `REF-...`)

Referencia: `app/api/routes_casos.py:218`. Responde `201 Created` y exige rol de
escritura (`app/api/routes_casos.py:218-223`). La secuencia del alta es:

1. Resolver la central indicada o la configurada
   (`app/api/routes_casos.py:225-226`).
2. Si el cuerpo no trae `id_averia`, generarlo con la función de base de datos
   `generar_id_averia_ref` (`app/api/routes_casos.py:229-233`).
3. Rechazar con `409` si el `id_averia` ya existe
   (`app/api/routes_casos.py:235-236`).
4. Respetar el `id_sector` enviado (validando su existencia con `404`) o
   sectorizar automáticamente por la dirección
   (`app/api/routes_casos.py:238-242`).
5. Completar `fecha_reporte` con la hora actual si viene vacía y fijar
   `ayudantes=[]` (`app/api/routes_casos.py:244-246`).
6. Crear el `Caso` con `origen="MANUAL"`, `estado_actual="NUEVO"`, el código y
   nombre de la central y el P00 del usuario
   (`app/api/routes_casos.py:248-258`).
7. Escribir la primera fila de bitácora con motivo «Alta manual desde PANEL»
   (`app/api/routes_casos.py:261-269`).

#### Verificación

`test_alta_manual_genera_identificador_ref` comprueba que el identificador
empieza por `REF-2324X-`, que el origen es `MANUAL`, el estado `NUEVO` y que
`en_gestion_supervisor` es falso (`app/tests/test_casos_api.py:54-61`).
`test_alta_manual_con_id_explicito` cubre el identificador provisto y el `409`
por duplicado (`app/tests/test_casos_api.py:64-72`).

### `GET /api/v1/casos/{id_caso}`

Referencia: `app/api/routes_casos.py:278`. Devuelve la ficha completa como
`CasoOut`, incluidos el nombre del sector y los cuatro iconos de estado
(`app/api/routes_casos.py:281`). Si el caso no existe, `_o_404` responde `404`
con «Caso no encontrado» (`app/api/routes_casos.py:29-33`), verificado por
`test_ficha_y_404` (`app/tests/test_casos_api.py:117-123`).

### `PATCH /api/v1/casos/{id_caso}` (historial de estado)

Referencia: `app/api/routes_casos.py:284`. Es una edición parcial: solo se
aplican los campos presentes en el cuerpo, gracias a
`model_dump(exclude_unset=True)` (`app/api/routes_casos.py:292`).

#### Campos con tratamiento especial

| Campo | Tratamiento | Referencia |
|---|---|---|
| `motivo_estado` | Se extrae del cuerpo y se usa como motivo de la bitácora; no se persiste en `caso` | `app/api/routes_casos.py:294` |
| `estado_actual` | Se extrae y se procesa por `_registrar_estado` | `app/api/routes_casos.py:295`, `app/api/routes_casos.py:309-310` |
| `id_sector` | Se valida contra `sector` (`404` si no existe) y se asigna | `app/api/routes_casos.py:296`, `app/api/routes_casos.py:301-304` |
| `direccion` | Si no se envió `id_sector`, dispara la re-sectorización automática | `app/api/routes_casos.py:305-307` |

El resto de campos se aplica con `setattr` en un bucle
(`app/api/routes_casos.py:298-299`).

> Observación de mantenimiento: `CasoUpdate` admite un campo `sector_nombre`
> (`app/schemas/casos.py:149`) que no existe como columna del modelo `Caso`
> (`app/models/caso_entities.py:41-118`). Al aplicarse con `setattr`
> (`app/api/routes_casos.py:298-299`) el valor no se persiste. El cliente web no
> lo envía, por lo que hoy es inocuo; conviene evitarlo en integraciones futuras.

#### Verificación

`test_edicion_registra_historial_de_estado` comprueba que el cambio a
`CONTACTADO` con motivo queda en la bitácora con el P00 del usuario y que
repetir el mismo estado no añade una segunda fila
(`app/tests/test_casos_api.py:129-156`).

### `GET /api/v1/casos/{id_caso}/historial`

Referencia: `app/api/routes_casos.py:317`. Verifica primero la existencia del
caso (`404` si falta) y devuelve la bitácora `caso_estado_hist` ordenada por
`id_hist` descendente, es decir, del movimiento más reciente al más antiguo
(`app/api/routes_casos.py:322-328`). El esquema de salida es
`CasoEstadoHistOut` (`app/schemas/casos.py:158-167`).

## Reglas de negocio

### Generación `generar_id_averia_ref`

Los casos sin incidencia de origen (referidos, empresas, gobiernos y altas
manuales) reciben un identificador sintético `REF-<CÓDIGO_CENTRAL>-<NNNNNN>`
(D-23, `RepoTecnico/estado_proyecto.md:87`). La función está en el DDL:

- Usa la secuencia `seq_caso_ref` (`RepoTecnico/db/schema.sql:39`,
  `RepoTecnico/db/schema.sql:55`).
- Toma el `codigo_central` de la tabla `central` y falla con excepción si no
  existe (`RepoTecnico/db/schema.sql:47-52`).
- Compone el identificador en mayúsculas y con relleno de seis ceros
  (`RepoTecnico/db/schema.sql:54-55`).

El backend la invoca con SQL directo
(`text("SELECT generar_id_averia_ref(:c)")`,
`app/api/routes_casos.py:231-233`). El resultado del formato observado en
pruebas es `REF-2324X-` (`app/tests/test_casos_api.py:58`).

### Re-sectorización automática al editar dirección

Cuando un `PATCH` incluye `direccion` y **no** incluye `id_sector`, el backend
recalcula el sector con `_sectorizar`
(`app/api/routes_casos.py:305-307`). `_sectorizar` delega en `asignar_sector`
con los patrones de la central del caso
(`app/api/routes_casos.py:52-53`), que ordena los patrones por longitud
descendente y admite coincidencia `CONTIENE`, `EXACTO` o `REGEX`
(`app/services/sectorizacion.py:33`, `app/services/sectorizacion.py:53-57`). Si
no hay coincidencia, el sector queda en `None`
(`app/services/sectorizacion.py:58`). La prueba
`test_edicion_recalcula_sector` parte de un caso sin sector y, al corregir la
dirección, obtiene el sector esperado
(`app/tests/test_casos_api.py:159-169`).

### Registro en `caso_estado_hist`

`_registrar_estado` implementa la regla de idempotencia de la bitácora:

1. Si el estado nuevo es igual al actual, retorna sin escribir
   (`app/api/routes_casos.py:38-39`).
2. En caso contrario, inserta una fila con `estado_anterior`, `estado_nuevo`,
   `motivo` y `usuario` (`app/api/routes_casos.py:40-48`).
3. Actualiza `caso.estado_actual` (`app/api/routes_casos.py:49`).

La tabla `caso_estado_hist` tiene `fecha_hora` con `DEFAULT now()`
(`RepoTecnico/db/schema.sql:403`) y borrado en cascada cuando se elimina el caso
(`RepoTecnico/db/schema.sql:398`). El alta manual inserta la fila inicial
directamente en la ruta, sin pasar por `_registrar_estado`, porque el caso aún
no tiene estado previo (`app/api/routes_casos.py:261-269`).

## Esquemas y modelo

### Esquemas Pydantic (`app/schemas/casos.py`)

| Esquema | Uso | Referencia |
|---|---|---|
| `ESTADOS_CASO` / `EstadoCaso` | Catálogo y restricción de estados | `app/schemas/casos.py:10-27` |
| `TIPO_CASO` | `AVERIA`, `REPARACION`, `CONSTRUCCION` | `app/schemas/casos.py:21` |
| `CATEGORIA` | `RESIDENCIAL`, `EMPRESA`, `REFERIDO`, `GOBIERNO` | `app/schemas/casos.py:22` |
| `ORIGEN` | `INGESTA_CSV`, `MANUAL`, `TELEGRAM`, `MCP_IA` | `app/schemas/casos.py:23` |
| `CasoOut` | Ficha y elementos de listado | `app/schemas/casos.py:30-101` |
| `PaginaCasos` | Respuesta paginada | `app/schemas/casos.py:104-109` |
| `CasoManualCreate` | Cuerpo del alta manual | `app/schemas/casos.py:112-130` |
| `CasoUpdate` | Cuerpo de la edición parcial | `app/schemas/casos.py:133-155` |
| `CasoEstadoHistOut` | Fila de bitácora | `app/schemas/casos.py:158-167` |

`CasoOut` usa `ConfigDict(from_attributes=True)` para validar desde el ORM y
omite deliberadamente columnas geográficas y técnicas que no se muestran en la
ficha (por ejemplo `capital_estado`, `distrito`, `estado_operativo`, `extra`,
`dias_area_resolutoria`, `ups`, `codigos_gestionados_venapp`), comparado con el
modelo `Caso` (`app/schemas/casos.py:30-95`,
`app/models/caso_entities.py:63-106`). Esa reducción es una decisión de
presentación, no una restricción de la tabla.

### Modelo `Caso` (`app/models/caso_entities.py`)

El docstring lo describe como «Tabla central de casos (63 columnas; mapeo
depurado del CSV — D-27)» (`app/models/caso_entities.py:42`). Agrupa sus campos
en cinco bloques:

| Bloque | Ejemplos | Referencia |
|---|---|---|
| Clasificación del sistema | `id_averia`, `origen`, `tipo_caso`, `categoria`, `estado_actual`, `id_sector`, `id_lote_ingesta` | `app/models/caso_entities.py:49-60` |
| Geografía (filtro de central) | `region`, `municipio`, `parroquia`, `codigo_central`, `nombre_central` | `app/models/caso_entities.py:62-72` |
| Contacto y administración | `telefono`, `fecha_reporte`, `direccion`, `nombre_cliente` | `app/models/caso_entities.py:74-89` |
| Datos técnicos / lógicos | `olt`, `plan`, `slot`, `puerto`, `fat`, `serial` | `app/models/caso_entities.py:91-106` |
| Asignación de origen | `reparador_principal`, `ayudantes` (JSONB), `flota_can` | `app/models/caso_entities.py:108-116` |

`id_averia` es único y no nulo (`app/models/caso_entities.py:50`) y
`ayudantes` es JSONB con lista vacía por defecto
(`app/models/caso_entities.py:110`). El DDL reproduce la misma estructura con
los `CHECK` de `origen`, `tipo_caso`, `categoria` y `estado_actual`
(`RepoTecnico/db/schema.sql:285-364`).

### Modelo `CasoEstadoHist`

Documentado como «Bitácora de cambios de estado de un caso (RNF-12)»
(`app/models/caso_entities.py:122`). Contiene `id_hist`, `id_caso`,
`estado_anterior`, `estado_nuevo`, `motivo`, `usuario` y `fecha_hora`
(`app/models/caso_entities.py:126-136`). El borrado en cascada y el valor por
defecto de la fecha están en el DDL
(`RepoTecnico/db/schema.sql:396-404`).

## Página web CASOS y Panel

### CASOS (`app/web/src/pages/Casos.tsx`)

Es la página más extensa del módulo (964 líneas). Se organiza en tres bloques:
filtros y listado, ficha con edición y cambio de estado, e historial.

#### Filtros mostrados

La interfaz ofrece texto libre, estado, clase, tipo, origen, «Cuadrilla 0
(supervisor)» y rango de fechas de reporte
(`app/web/src/pages/Casos.tsx:470-578`). Los catálogos se declaran localmente:
estados (`app/web/src/pages/Casos.tsx:19-29`), categorías
(`app/web/src/pages/Casos.tsx:31`), tipos (`app/web/src/pages/Casos.tsx:32`) y
orígenes (`app/web/src/pages/Casos.tsx:33`).

> La interfaz **no** expone los filtros `id_central`, `id_sector`, `id_causa` ni
> `id_lote_ingesta` que el backend sí acepta
> (`app/api/routes_casos.py:126-133`); el catálogo de filtros realmente enviado
> está en `app/web/src/pages/Casos.tsx:303-316`.

#### Paginación

Los tamaños disponibles son 10, 25, 50 y 100
(`app/web/src/pages/Casos.tsx:34`) y el valor inicial es 25
(`app/web/src/pages/Casos.tsx:285`). La barra inferior muestra el total y la
página y ofrece «Anterior»/«Siguiente» con los límites deshabilitados
(`app/web/src/pages/Casos.tsx:580-619`).

#### Ficha

La ficha (`app/web/src/pages/Casos.tsx:633-716`) agrupa los campos en
Identificación, Contacto, Fechas, Textos, Datos técnicos y Clasificación y
geografía. Los campos vacíos se renderizan como «—» mediante el componente
`Fila` (`app/web/src/pages/Casos.tsx:176-184`).

#### Edición y cambio de estado

Solo se habilita si el usuario no está en modo solo lectura
(`app/web/src/pages/Casos.tsx:718-720`). `construirPayload` compara cada campo
con el original y envía únicamente los cambios
(`app/web/src/pages/Casos.tsx:133-174`), de modo que el `PATCH` respeta la
semántica de `exclude_unset`. El cambio de estado valida que el nuevo estado no
sea igual al actual antes de llamar al API
(`app/web/src/pages/Casos.tsx:411-418`).

#### Historial

Se muestra en una tabla con estado anterior, estado nuevo, motivo, usuario y
fecha y hora (`app/web/src/pages/Casos.tsx:929-959`), cargado con
`api.obtenerHistorialCaso` (`app/web/src/pages/Casos.tsx:331-339`).

### PANEL (`app/web/src/pages/Panel.tsx`)

El PANEL es la página raíz. Muestra un resumen con seis tarjetas —tablas,
centrales, roles, cuadrillas, causas y parámetros—
(`app/web/src/pages/Panel.tsx:8-15`) alimentadas por `api.obtenerResumen`
(`app/web/src/pages/Panel.tsx:29`), e identifica la sesión con el nombre completo
y el rol (`app/web/src/pages/Panel.tsx:44`, `app/web/src/pages/Panel.tsx:63`).

Incluye una «Búsqueda rápida de casos» por ID de avería o teléfono que, al
enviar, navega a CASOS con el término en el estado de navegación:
`navigate('/casos', { state: { q } })`
(`app/web/src/pages/Panel.tsx:46-55`). CASOS recoge ese término como filtro
inicial (`app/web/src/pages/Casos.tsx:260-264`).

### Modal «Agregar caso» (`app/web/src/components/ModalCaso.tsx`)

El botón «Agregar caso» de la barra superior abre este modal flotante
(`app/web/src/components/Layout.tsx:186-196`, `app/web/src/components/Layout.tsx:225`).
Sus rasgos técnicos son:

| Rasgo | Comportamiento | Referencia |
|---|---|---|
| Foco inicial | Enfoca el primer control del modal | `app/web/src/components/ModalCaso.tsx:92-93` |
| Cierre con `Escape` | Llama a `onCerrar` | `app/web/src/components/ModalCaso.tsx:95-100` |
| Trampa de foco | Cicla el `Tab` dentro del modal | `app/web/src/components/ModalCaso.tsx:101-119` |
| Cierre por fondo | `onMouseDown` en el fondo, detenido en la caja | `app/web/src/components/ModalCaso.tsx:208-215` |
| Alta normal | Exige al menos nombre, teléfono, dirección o problema | `app/web/src/components/ModalCaso.tsx:182-190` |
| Alta especial | Cambia a `crearCasoEspecial` con solicitante | `app/web/src/components/ModalCaso.tsx:129-172` |

El caso normal se crea con `api.crearCaso` (`app/web/src/components/ModalCaso.tsx:193`)
y el resultado destaca en color el identificador `REF-…` cuando corresponde
(`app/web/src/components/ModalCaso.tsx:236-242`).

> Aunque compartan el modal, los casos especiales pertenecen a otro módulo
> (`/api/v1/casos-especiales`, `app/api/routes_especiales.py:124`). Este manual
> solo describe el punto de entrada; el detalle está en el manual de casos
> especiales.

## Buscador global de la barra superior (D-57)

La decisión D-57 elimina el menú lateral y deja «una sola barra superior» con un
buscador global de un solo campo, el botón «Agregar caso» con modal flotante, el
menú de usuario, enlaces con iconos en móvil y CONFIGURACIÓN como submenú
restringido (`RepoTecnico/estado_proyecto.md:117`).

### Comportamiento

`BuscadorGlobal` se monta en la barra superior
(`app/web/src/components/Layout.tsx:4`, `app/web/src/components/Layout.tsx:180`).
Su docstring lo describe como «un único cuadro que consulta `/casos/buscar?q=` y
muestra hasta 8 coincidencias en un desplegable»
(`app/web/src/components/BuscadorGlobal.tsx:8-12`).

- Exige texto no vacío; si está vacío, muestra «Escriba un incidente, teléfono,
  cliente o dirección» (`app/web/src/components/BuscadorGlobal.tsx:36-41`).
- Llama a `api.buscarCasos({ q, limite: 8 })`
  (`app/web/src/components/BuscadorGlobal.tsx:44`), que hace
  `GET /casos/buscar` (`app/web/src/api/client.ts:508-515`).
- El desplegable muestra ID de avería, cliente, teléfono y estado, o bien «Sin
  coincidencias» (`app/web/src/components/BuscadorGlobal.tsx:118-140`).
- El botón de limpiar vacía el texto y los resultados
  (`app/web/src/components/BuscadorGlobal.tsx:93-108`).

### Navegación a la ficha

Al elegir un resultado, el componente navega a CASOS pasando el `id_caso`:
`navigate('/casos', { state: { abrirCaso: caso.id_caso } })`
(`app/web/src/components/BuscadorGlobal.tsx:56-59`). CASOS interpreta ese estado
y abre la ficha automáticamente
(`app/web/src/pages/Casos.tsx:265-270`, `app/web/src/pages/Casos.tsx:364-366`).

### Accesibilidad

El formulario usa `role="search"` y el desplegable `role="listbox"` con opciones
`role="option"`; los botones llevan `aria-label`
(`app/web/src/components/BuscadorGlobal.tsx:72`, `app/web/src/components/BuscadorGlobal.tsx:117-128`).
El cierre del desplegable al hacer clic fuera se encapsula en
`useCerrarDesplegable` (`app/web/src/components/BuscadorGlobal.tsx:6`,
`app/web/src/components/BuscadorGlobal.tsx:30`). El E2E de navegación cubre
«secciones, menú CONFIGURACIÓN, RBAC de menú, barra móvil, buscador»
(`RepoTecnico/pruebas/informe_fase4.md:56`).

## Pruebas (`app/tests/test_casos_api.py`, 17 pruebas)

El informe de Fase 4 registra el archivo con 17 pruebas de integración y ámbito
«Búsqueda, filtros, ficha, edición, alta `REF-…` y bitácora»
(`RepoTecnico/pruebas/informe_fase4.md:74`).

### Cobertura por área

| Área | Pruebas | Referencia |
|---|---|---|
| Acceso y RBAC | `test_sin_token`, `test_tecnico_puede_leer_pero_no_escribir` | `app/tests/test_casos_api.py:41-48` |
| Alta manual | Generación de `REF-…`, identificador explícito, duplicado `409`, sectorización, historial inicial | `app/tests/test_casos_api.py:54-88` |
| Búsqueda (RF-30) | Por avería, por teléfono y sin parámetros (`422`) | `app/tests/test_casos_api.py:94-114` |
| Ficha (RF-31) | Ficha y `404` | `app/tests/test_casos_api.py:117-123` |
| Edición y bitácora | Historial de estado, re-sectorización, estado inválido | `app/tests/test_casos_api.py:129-177` |
| Listado (RF-33) | Filtros, paginación, ingeridos, orden y no duplicación del modelo | `app/tests/test_casos_api.py:183-252` |

### Trazabilidad

| Requisito | Nivel de prueba | Referencia |
|---|---|---|
| RF-30…RF-33 (panel y casos) | Integración + Contratos + E2E-01/03 | `RepoTecnico/pruebas/plan_pruebas.md:90` |
| RF-30…RF-33 (E2E) | `03-casos.spec.js` (6 pruebas) | `RepoTecnico/pruebas/informe_fase4.md:57` |
| RNF-12 (bitácora) | `test_edicion_registra_historial_de_estado` | `app/tests/test_casos_api.py:129` |
| D-57 (rediseño de navegación) | 32/32 pruebas de regresión | `RepoTecnico/estado_proyecto.md:288` |

La prueba `test_listado_incluye_casos_ingeridos` conecta ambos manuales: carga el
CSV de muestra, verifica que el listado por `origen=INGESTA_CSV` devuelve 51
casos y que la búsqueda por `DEMO-0001` los encuentra con su lote y su central
(`app/tests/test_casos_api.py:214-236`). El resultado global de Fase 4 fue
169/169 en `pytest` y 46/46 en Playwright
(`RepoTecnico/pruebas/informe_fase4.md:18-19`).
