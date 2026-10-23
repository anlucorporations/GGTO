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
(`app/api/routes_casos.py:1`, `app/api/routes_casos.py:48`).

### El identificador de pago (D-89) y la regla REPARACIÓN/REFERIDO (D-90)

Desde **D-89** el caso dejó de ser el eje del histórico: lo es el **identificador de pago
(70\*)**, que se guarda en la tabla `identificador_pago` (`app/models/pago_entities.py:25-43`,
DDL en `RepoTecnico/db/schema.sql:292-304`) y se enlaza desde `caso.id_pago`
(`RepoTecnico/db/schema.sql:324-325`). Un identificador puede acumular **varios reportes**
(1→N); el número es **único global** y su patrón de negocio vive en
`configuracion.pago.serie_regex` (por defecto `^70[0-9]{8}$`, `app/services/pagos.py:27,37-50`).

La separación de números en la ficha es:

| Dato | Columna | Significado |
|---|---|---|
| Identificador de pago (70\*) | `caso.telefono` (alias) + `caso.id_pago` (FK) | El número de negocio; solo contiene un 70\*. |
| Número de contacto | `caso.contacto_cliente` | **Cualquier** otro número; además se suma a `caso.informacion` como `[CONTACTO] <numero>` (`app/services/pagos.py:144-151`). |

El reparto lo hace `_aplicar_identificador` (`app/api/routes_casos.py:332-362`) y lo
confirman las pruebas `app/tests/test_d89_identificador_pago.py` (alta manual, edición e
ingesta).

Sobre esa base, **D-90** añade la regla de negocio: una **REPARACIÓN** exige
**identificador de pago (70\*) + ID de avería real** (un `REF-…` sintético **no** cuenta). Si
falta cualquiera de los dos, el caso pasa a `tipo_caso='REFERIDO'`, se asegura su ficha
`caso_especial` (idempotente, 1:1) y queda traza en `auditoria` con motivo
`SIN_IDENTIFICADOR_PAGO` / `SIN_ID_AVERIA` / `SIN_IDENTIFICADOR_PAGO_Y_AVERIA`. Toda la
lógica vive en `app/services/clasificacion.py` (`tiene_id_averia_real` `:41-44`,
`esta_marcado` `:47-51`, `motivo_marca` `:54-66`, `asegurar_caso_especial` `:77-105`,
`aplicar_regla_reparacion` `:121-173`, `aplicar_en_cambio` `:176-194`) y se describe en
detalle en el manual 06. La base la refuerza con el trigger
`trg_caso_reparacion_a_referido` y el `CHECK ck_reparacion_con_ip`
(`RepoTecnico/db/schema.sql:812-843`). `tipo_caso` incluye ya `REFERIDO`
(`app/schemas/casos.py:22`).

### Permisos

La escritura completa exige rol ADMIN o SUPERVISOR mediante
`_escritura = require_roles("ADMIN", "SUPERVISOR")`
(`app/api/routes_casos.py:51`). La gestión del caso (cambio de estado, cierre, cita, «No
Contesta» y corrección del contacto de campo) suma al TECNICO con
`_gestion = require_roles("ADMIN", "SUPERVISOR", "TECNICO")`
(`app/api/routes_casos.py:53`). Las lecturas (listado, búsqueda, ficha, historial y
relacionados) usan `get_current_user`
(`app/api/routes_casos.py:183`, `app/api/routes_casos.py:281`,
`app/api/routes_casos.py:446`, `app/api/routes_casos.py:857`). El rol TECNICO
puede leer pero no crear ni editar, comportamiento fijado por
`test_tecnico_puede_leer_pero_no_escribir`
(`app/tests/test_casos_api.py:45-52`).

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
(`RepoTecnico/db/schema.sql:319-321`), con `DEFAULT 'NUEVO'`. El modelo
SQLAlchemy declara `estado_actual` con valor por defecto `"NUEVO"` y tipo
`String(20)` (`app/models/caso_entities.py:60`). Enviar un estado inventado
produce `422`, como verifica `test_estado_invalido`
(`app/tests/test_casos_api.py:172-181`).

### Ciclo de vida observado

1. Un caso nace por ingesta CSV con `estado_actual='NUEVO'`
   (`app/models/caso_entities.py:60`) o por alta manual, que fija `NUEVO` y
   escribe la primera fila de bitácora
   (`app/api/routes_casos.py:417`, `app/api/routes_casos.py:427-435`).
2. La edición puede cambiar el estado mediante `PATCH`
   (`app/api/routes_casos.py:511-512`).
3. Cada cambio real de estado se apila en `caso_estado_hist` y se consulta por
   `GET /api/v1/casos/{id_caso}/historial`
   (`app/api/routes_casos.py:546-570`).
4. Los estados `CERRADO` y `CANCELADO` son terminales a efectos del indicador
   «pendiente» (`app/api/routes_casos.py:89-90`) y también del cálculo de fallas
   masivas (`app/services/fallas.py:71`).
5. **D-90:** si el caso es una `REPARACION` sin 70\* o sin ID de avería real, en el mismo
   `INSERT`/`UPDATE` el servicio (y, como red de seguridad, el trigger de la base) lo
   convierte a `tipo_caso='REFERIDO'` (`app/api/routes_casos.py:426` en el alta,
   `:515` en la edición).

## Endpoints

El router agrupa **trece** operaciones bajo `/api/v1/casos`
(`app/api/routes_casos.py:48`): listado, búsqueda, alta, ficha, edición, estado, historial,
cierre, cita, «No Contesta», contacto, enrutado y relacionados.

### `GET /api/v1/casos` (filtros y paginación)

Referencia: `app/api/routes_casos.py:180`. Devuelve un objeto `PaginaCasos` con
`items`, `total`, `page`, `page_size` y `pages`
(`app/schemas/casos.py:117-122`).

#### Filtros aceptados

| Parámetro | Tipo | Comportamiento | Referencia |
|---|---|---|---|
| `q` | texto | Búsqueda `ilike` sobre avería, teléfono, cliente, dirección, tipo, categoría, estado y nombre de sector | `app/api/routes_casos.py:210-225` |
| `id_averia` | texto | `ilike` parcial | `app/api/routes_casos.py:226-227` |
| `telefono` | texto | `ilike` **solo** sobre `caso.telefono` (el identificador de pago) | `app/api/routes_casos.py:228-229` |
| `id_central` | entero | Igualdad | `app/api/routes_casos.py:230-231` |
| `id_sector` | entero | Igualdad | `app/api/routes_casos.py:232-233` |
| `id_cuadrilla` | entero | Cuadrilla del **último despacho** que incluyó el caso (D-72) | `app/api/routes_casos.py:234-235` |
| `id_causa` | entero | Igualdad | `app/api/routes_casos.py:236-237` |
| `id_lote_ingesta` | entero | Igualdad | `app/api/routes_casos.py:238-239` |
| `estado_actual` | texto | Igualdad | `app/api/routes_casos.py:240-241` |
| `tipo_caso` | texto | Igualdad | `app/api/routes_casos.py:242-243` |
| `categoria` | texto | Igualdad | `app/api/routes_casos.py:244-245` |
| `origen` | texto | Igualdad | `app/api/routes_casos.py:246-247` |
| `en_gestion_supervisor` | booleano | Igualdad | `app/api/routes_casos.py:248-249` |
| `es_falla_masiva` | booleano | Igualdad | `app/api/routes_casos.py:250-251` |
| `desde` / `hasta` | fecha-hora | Rango sobre `fecha_reporte` | `app/api/routes_casos.py:252-255` |

#### Paginación y orden

`page` arranca en 1 (`ge=1`) y `page_size` vale 25 por defecto, con mínimo 1 y
máximo 200 (`app/api/routes_casos.py:207-208`). El total se calcula con
`count()` (`app/api/routes_casos.py:257`) y el número de páginas se deriva por
división entera (`app/api/routes_casos.py:265`). El orden es
`fecha_reporte` descendente con los nulos al final y, como desempate,
`id_caso` descendente (`app/api/routes_casos.py:261`); la prueba
`test_listado_ordenado_por_fecha_descendente` lo verifica
(`app/tests/test_casos_api.py:239-245`).

#### Iconos de estado calculados

`_resumen` completa cada `CasoOut` con `sector_nombre`, cuatro booleanos
calculados y —desde D-89/D-90— los campos del identificador y de la regla
(`app/api/routes_casos.py:83-149`, `app/schemas/casos.py:105-114`):

| Icono / campo | Condición | Referencia |
|---|---|---|
| `pendiente` | El estado no es `CERRADO` ni `CANCELADO` | `app/api/routes_casos.py:89-90` |
| `asignado` | Existe fila en `despacho_caso` **que no sea `DEVUELTO`** (D-157) o el estado es `ASIGNADO` | `app/api/routes_casos.py:169-172` |
| `citado` | Existe cita en estado `PROPUESTA` o `CONFIRMADA` | `app/api/routes_casos.py:94-95` |
| `gestion` | `en_gestion_supervisor`, estado `EN_GESTION` o despacho `GESTIONADO` | `app/api/routes_casos.py:96-98` |
| `id_cuadrilla`, `cuadrilla_codigo`, `cuadrilla_nombre` | Cuadrilla del último despacho **sin filas `DEVUELTO`** (D-78, D-157) | `app/api/routes_casos.py:183-201` |
| `marcado_reclasificar` | `clasificacion.esta_marcado(caso)` (D-90) | `app/api/routes_casos.py:143` |
| `motivo_marca` | `SIN_IDENTIFICADOR_PAGO` / `SIN_ID_AVERIA` / ambos | `app/api/routes_casos.py:144` |
| `tiene_identificador_pago` | `caso.id_pago is not None` | `app/api/routes_casos.py:145` |
| `tiene_id_averia_real` | `id_averia` no vacío y **no** `REF-…` | `app/api/routes_casos.py:146` |

### `GET /api/v1/casos/buscar`

Referencia: `app/api/routes_casos.py:278`. Es el endpoint del buscador global y
de la búsqueda rápida del PANEL. Exige al menos uno de `q`, `id_averia` o
`telefono`; si no se envía ninguno responde `422` con el mensaje «Indique `q`,
`id_averia` o `telefono` para buscar»
(`app/api/routes_casos.py:287-291`). La prueba `test_buscar_sin_parametros` fija
ese comportamiento (`app/tests/test_casos_api.py:112-115`).

| Parámetro | Comportamiento | Referencia |
|---|---|---|
| `q` | `ilike` sobre avería, **identificador de pago** (`telefono`), **número de contacto** (`contacto_cliente`), cliente y dirección (D-92) | `app/api/routes_casos.py:293-305` |
| `id_averia` | Igualdad exacta tras `strip()` | `app/api/routes_casos.py:306-307` |
| `telefono` | Igualdad o `ilike` parcial, también sobre el número de contacto | `app/api/routes_casos.py:308-317` |
| `limite` | 20 por defecto, entre 1 y 100 | `app/api/routes_casos.py:285` |

Cuando se combinan varios criterios se aplica `or_(*condiciones)`; con un solo
criterio se usa directamente (`app/api/routes_casos.py:321`). El orden es
`fecha_reporte` descendente con nulos al final
(`app/api/routes_casos.py:322`).

### `POST /api/v1/casos` (alta manual `REF-...`)

Referencia: `app/api/routes_casos.py:365`. Responde `201 Created` y exige rol de
escritura (`app/api/routes_casos.py:365-371`). La secuencia del alta es:

1. Resolver la central indicada o la configurada y compilar el patrón del 70\*
   (`app/api/routes_casos.py:372-374`).
2. Si el cuerpo no trae `id_averia`, generarlo con la función de base de datos
   `generar_id_averia_ref` (`app/api/routes_casos.py:378-382`).
3. Rechazar con `409` si el `id_averia` ya existe
   (`app/api/routes_casos.py:384-385`).
4. **Clasificar el número (D-89)**: `_aplicar_identificador` resuelve el 70\* en
   `identificador_pago` (y lo deja como alias en `telefono`) o lo trata como número de
   contacto (`app/api/routes_casos.py:387-398`, `:332-362`). El campo `id_pago` del cuerpo
   (`app/schemas/casos.py:134-135`) tiene prioridad sobre `telefono`.
5. Respetar el `id_sector` enviado (validando su existencia con `404`) o
   sectorizar automáticamente por la dirección
   (`app/api/routes_casos.py:400-404`).
6. Completar `fecha_reporte` con la hora actual si viene vacía y fijar
   `ayudantes=[]` (`app/api/routes_casos.py:406-408`).
7. Crear el `Caso` con `origen="MANUAL"`, `estado_actual="NUEVO"`, `id_pago`, el código y
   nombre de la central y el P00 del usuario
   (`app/api/routes_casos.py:410-423`).
8. **Aplicar la regla D-90** (`app/api/routes_casos.py:424-426`): una REPARACIÓN sin 70\* o
   sin avería real se registra como REFERIDO.
9. Escribir la primera fila de bitácora con motivo «Alta manual desde PANEL»
   (`app/api/routes_casos.py:427-435`).

#### Datos obligatorios del alta (RN-AL-01)

Al **incorporar un caso manual** —y también un caso especial, ver
`06-seguimiento-especiales-agenda.md`— hay que informar, sin excepción:

| Dato | Campo del cuerpo | Obligatorio |
|---|---|---|
| Nombre de contacto | `nombre_cliente` | Siempre |
| Teléfono de contacto | `contacto_cliente` | Siempre |
| Dirección del inmueble | `direccion` | Siempre |
| Teléfono con el **identificador de pago (70\*)** | `id_pago` | Siempre (se valida contra `pago.serie_regex`; si no cumple → **422**) |
| Tipo de reporte (Reparación/Construcción) | `tipo_reporte` | Siempre (`REPARACION` o `CONSTRUCCION`) |
| Id de avería | `id_averia` | Solo si `tipo_reporte=REPARACION` |
| Tipo de problema | `tipo_problema` | Solo si `tipo_reporte=REPARACION` |

`CasoManualCreate` (`app/schemas/casos.py`) concentra la regla: los campos
`nombre_cliente`, `contacto_cliente` y `direccion` son obligatorios y no admiten
blanco (`field_validator`), y `model_validator` exige el 70\* y —en una
REPARACIÓN— el id de avería y el tipo de problema. El `tipo_caso` del caso lo fija
`tipo_reporte`; la regla D-90 puede reclasificarlo después.

Como consecuencia del 70\* obligatorio, el alta manual ya no puede producir por sí
misma una REPARACIÓN **sin** identificador: la reclasificación a `REFERIDO` sigue
ocurriendo cuando el `id_averia` informado es sintético (`REF-…`).

#### Verificación

`test_alta_manual_genera_identificador_ref` comprueba que el identificador
empieza por `REF-2324X-`, que el origen es `MANUAL`, el estado `NUEVO` y que
`en_gestion_supervisor` es falso (`app/tests/test_casos_api.py:54-62`).
`test_alta_manual_con_id_explicito` cubre el identificador provisto y el `409`
por duplicado (`app/tests/test_casos_api.py:64-73`). El enlace con el
identificador de pago lo cubre
`test_el_alta_manual_enlaza_el_identificador`
(`app/tests/test_d89_identificador_pago.py:368-395`).

### `GET /api/v1/casos/{id_caso}`

Referencia: `app/api/routes_casos.py:444`. Devuelve la ficha completa como
`CasoOut`, incluidos el nombre del sector, los cuatro iconos de estado
(`app/api/routes_casos.py:447`) y —desde D-78— la **cuadrilla del último
despacho** (`id_cuadrilla`, `cuadrilla_codigo`, `cuadrilla_nombre`), además de los
campos del identificador de pago y de la marca de D-89/D-90. Si el caso
no existe, `_o_404` responde `404` con «Caso no encontrado»
(`app/api/routes_casos.py:56-60`), verificado por `test_ficha_y_404`
(`app/tests/test_casos_api.py:117-127`).

### `PATCH /api/v1/casos/{id_caso}` (historial de estado)

Referencia: `app/api/routes_casos.py:450`. Es una edición parcial: solo se
aplican los campos presentes en el cuerpo, gracias a
`model_dump(exclude_unset=True)` (`app/api/routes_casos.py:458`).

#### Campos con tratamiento especial

| Campo | Tratamiento | Referencia |
|---|---|---|
| `motivo_estado` | Se extrae del cuerpo y se usa como motivo de la bitácora; no se persiste en `caso` | `app/api/routes_casos.py:460` |
| `estado_actual` | Se extrae y se procesa por `_registrar_estado` | `app/api/routes_casos.py:461`, `app/api/routes_casos.py:511-512` |
| `id_sector` | Se valida contra `sector` (`404` si no existe) y se asigna | `app/api/routes_casos.py:462`, `app/api/routes_casos.py:503-506` |
| `direccion` | Si no se envió `id_sector`, dispara la re-sectorización automática | `app/api/routes_casos.py:507-509` |
| `id_pago` | **D-89:** se normaliza y se valida contra el patrón; si no lo cumple → **422** `"El identificador de pago no cumple el patrón configurado (70*)"`; si lo cumple, se resuelve la ficha y `telefono` queda como alias | `app/api/routes_casos.py:463-477` |
| `telefono` | **D-89:** si es un 70\* se resuelve el identificador; si es cualquier otro número, el alias `telefono` queda `NULL` y el valor pasa a `contacto_cliente` y a `informacion` | `app/api/routes_casos.py:478-491` |
| `contacto_cliente` | Se normaliza (RN-IP-07) y se refleja en `informacion` como `[CONTACTO] …` | `app/api/routes_casos.py:492-498` |

El resto de campos se aplica con `setattr` en un bucle
(`app/api/routes_casos.py:500-501`). Al final, y **antes** del `commit`, se aplica la regla
de D-90 (`clasificacion.aplicar_en_cambio`, `app/api/routes_casos.py:514-515`).

> Observación de mantenimiento: `CasoUpdate` admite un campo `sector_nombre`
> (`app/schemas/casos.py:166`) que no existe como columna del modelo `Caso`
> (`app/models/caso_entities.py:47-128`). Al aplicarse con `setattr`
> (`app/api/routes_casos.py:500-501`) el valor no se persiste. El cliente web no
> lo envía, por lo que hoy es inocuo; conviene evitarlo en integraciones futuras.

#### Verificación

`test_edicion_registra_historial_de_estado` comprueba que el cambio a
`CONTACTADO` con motivo queda en la bitácora con el P00 del usuario y que
repetir el mismo estado no añade una segunda fila
(`app/tests/test_casos_api.py:129-157`). La interpretación del teléfono en la edición la
cubre `test_la_edicion_interpreta_el_telefono`
(`app/tests/test_d89_identificador_pago.py:397-431`).

### `GET /api/v1/casos/{id_caso}/historial`

Referencia: `app/api/routes_casos.py:546`. Verifica primero la existencia del
caso (`404` si falta) y devuelve la bitácora `caso_estado_hist` ordenada por
`id_hist` descendente, es decir, del movimiento más reciente al más antiguo
(`app/api/routes_casos.py:551-558`). El esquema de salida es
`CasoEstadoHistOut` (`app/schemas/casos.py:175-184`).

### `PATCH /api/v1/casos/{id_caso}/contacto` (corrección desde el campo)

Referencia: `app/api/routes_casos.py:761`. Es el camino del **técnico de campo**
(`_gestion`, `app/api/routes_casos.py:767`): corrige **dirección** y número, exige que el caso no
esté en estado terminal (**409**, `app/api/routes_casos.py:781-785`), recalcula el sector si
cambia la dirección (`:790-791`) y deja traza en `auditoria`
(`acción="CONTACTO_CAMPO"`, `app/api/routes_casos.py:792-801`).

> ⚠️ **Discrepancia verificada (D-93/DEC-IP-7).** El cuerpo del endpoint usa el esquema
> `ContactoUpdate` (`app/schemas/casos.py:244-274`), que **solo** declara `direccion` y
> **`telefono`**, y cuyo validador sigue exigiendo las series `(700|701|702)\d{7}`
> (`app/schemas/casos.py:254-264`). **No** existe la clave `contacto` ni el tratamiento de
> «un 70\* se registra como identificador del caso». En cambio, la APK ya envía la clave
> `contacto` (`app_movil/lib/features/casos/operaciones_service.dart:367`). Al no existir en
> el esquema, Pydantic la ignora y el endpoint responde **422** «Indique la dirección o el
> número de contacto» (`app/api/routes_casos.py:777-780`). Por tanto: **lo descrito en el
> incremento D-93 para este endpoint no está aplicado en este árbol**; queda como
> **pendiente de confirmar** para el equipo de desarrollo (ver manual 11, sección 7.4).
> El histórico por identificador, en cambio, **sí** está aplicado (ver abajo).

### `GET /api/v1/casos/{id_caso}/relacionados` (pestaña Histórico, D-89/D-92)

Referencia: `app/api/routes_casos.py:852`. Devuelve los antecedentes del caso y es la
fuente de la pestaña **Histórico** de la ficha. El eje del histórico es el
**identificador de pago**: la consulta filtra por `Caso.telefono == telefono`, es decir, por
el alias del 70\* (`app/api/routes_casos.py:871-878`), y para cada antecedente añade el
`id_averia` anterior, la fecha de cierre, el problema reportado y la justificación del cierre
a partir de la última actividad de tipo `CIERRE` (`app/api/routes_casos.py:882-920`). El
docstring y el código contemplan una caída a `contacto_cliente` cuando `telefono` está vacío
(`app/api/routes_casos.py:862-867`), pero como la consulta compara contra `Caso.telefono`,
un caso cuyo número sea de contacto **no** agrupa antecedentes: lo confirman
`test_relacionados_agrupa_antecedentes_por_identificador_de_pago`
(`app/tests/test_casos_api.py:429-459`) y
`test_relacionados_sin_identificador_no_devuelve_antecedentes`
(`app/tests/test_casos_api.py:462-479`).

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
`app/api/routes_casos.py:380-382`). El resultado del formato observado en
pruebas es `REF-2324X-` (`app/tests/test_casos_api.py:58`).

### Re-sectorización automática al editar dirección

Cuando un `PATCH` incluye `direccion` y **no** incluye `id_sector`, el backend
recalcula el sector con `_sectorizar`
(`app/api/routes_casos.py:507-509`). `_sectorizar` delega en `asignar_sector`
con los patrones de la central del caso
(`app/api/routes_casos.py:79-80`), que ordena los patrones por longitud
descendente y admite coincidencia `CONTIENE`, `EXACTO` o `REGEX`
(`app/services/sectorizacion.py:33`, `app/services/sectorizacion.py:53-57`). Si
no hay coincidencia, el sector queda en `None`
(`app/services/sectorizacion.py:58`). La prueba
`test_edicion_recalcula_sector` parte de un caso sin sector y, al corregir la
dirección, obtiene el sector esperado
(`app/tests/test_casos_api.py:159-170`).

### Registro en `caso_estado_hist`

`_registrar_estado` implementa la regla de idempotencia de la bitácora:

1. Si el estado nuevo es igual al actual, retorna sin escribir
   (`app/api/routes_casos.py:65-66`).
2. En caso contrario, inserta una fila con `estado_anterior`, `estado_nuevo`,
   `motivo` y `usuario` (`app/api/routes_casos.py:67-75`).
3. Actualiza `caso.estado_actual` (`app/api/routes_casos.py:76`).

La tabla `caso_estado_hist` tiene `fecha_hora` con `DEFAULT now()`
(`RepoTecnico/db/schema.sql:427`) y borrado en cascada cuando se elimina el caso
(`RepoTecnico/db/schema.sql:422`). El alta manual inserta la fila inicial
directamente en la ruta, sin pasar por `_registrar_estado`, porque el caso aún
no tiene estado previo (`app/api/routes_casos.py:427-435`).

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

#### Solo casos abiertos (RN-AL-02)

La sección CASOS muestra **únicamente casos abiertos**: la página envía siempre
`solo_abiertos=true` en el listado (`app/web/src/pages/Casos.tsx`, `cargarLista`)
y el selector de estado ofrece solo los estados abiertos (`NUEVO`, `ASIGNADO`,
`CONTACTADO`, `CITADO`, `DIFERIDO`, `EN_GESTION`, `ENRUTADO`), sin `CERRADO` ni
`CANCELADO` (`app/web/src/pages/Casos.tsx`, constante `ESTADOS`).

El backend lo resuelve con el parámetro `solo_abiertos` de `GET /api/v1/casos`
(`app/api/routes_casos.py`), que excluye los estados terminales
`ESTADOS_TERMINALES = ("CERRADO", "CANCELADO")` definidos en `app/schemas/casos.py`.
Es una lista **opt-in**: el resto de consumidores (despacho, monitoreo, informes)
siguen viendo el universo completo salvo que pidan el filtro.

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

La ficha es una ventana flotante que reparte los datos en pestañas
(`app/web/src/components/FichaCaso.tsx:30-38`): **Resumen, Contacto, Datos
técnicos, Clasificación, Despacho, Textos, Resolución e Histórico**. Cada pestaña
usa una rejilla de hasta tres datos por línea en escritorio que cae a una en
móvil (`.datos-grid`), y los campos vacíos se renderizan como «—» mediante el
componente `Dato` (`app/web/src/components/FichaCaso.tsx:54-62`). La pestaña
**Gestión** se eliminó en D-76 y la pestaña **Despacho** se añadió en D-78.

#### Edición (Sector, cita e información)

La edición ligera vive en la pestaña **Clasificación**
(`app/web/src/components/FichaCaso.tsx:301-380`) y solo la obtienen ADMIN,
SUPERVISOR y Super Usuario (`puedeEditar`). Se habilita con el botón **Editar**
del título de la ficha (`app/web/src/pages/Casos.tsx:594-604`), que envía una
señal con número de secuencia a la ficha; el efecto reacciona a esa secuencia
—no a la pestaña— de modo que volver a pulsarlo reabre el formulario aunque ya
se esté en Clasificación (`app/web/src/components/FichaCaso.tsx:118-131`). El
formulario se limita a **Sector** (`#ficha-sector`, con opción «Sin sector»),
**Fecha de cita** (`#ficha-fecha-cita`) e **Información** de 200 caracteres
(`#ficha-informacion`) y se guarda con `PATCH /casos/{id}`, que valida el sector
y, si se corrige la dirección sin enviar sector, lo recalcula
(`app/api/routes_casos.py:350-372`). El **Supervisor** puede así asignar o
cambiar el sector de un caso.

#### Despacho: asignación del caso a una cuadrilla (D-78)

La pestaña **Despacho** (`app/web/src/components/FichaCaso.tsx`) concentra la
asignación manual del caso abierto y sustituye a la selección múltiple que D-77
había puesto en el listado:

- Muestra tres datos: **Estado del caso**, **Cuadrilla actual** (la del último
  despacho, o «Sin despacho») y **Cuadrilla 0 (supervisor)**.
- Ofrece el selector `#ficha-cuadrilla-destino` con el catálogo de cuadrillas
  activas (incluida la 0, marcada «(supervisor)») y los botones **Asignar a
  cuadrilla** (`POST /despachos/asignar-casos`) y **Quitar del despacho**
  (`POST /despachos/quitar-casos`), ambos con `ids_caso: [id_caso]`.
- Solo la ven ADMIN, SUPERVISOR y Super Usuario (`puedeAsignar`); el rol TECNICO
  ve la pestaña con el aviso de solo lectura, sin selector.

El listado ya no tiene casillas de selección: `TablaCasos`
(`app/web/src/pages/Casos.tsx`) volvió a sus **7 columnas** (ID avería, Tipo,
Clase, Sector, Dirección, Nombre y Estado).

##### ESPECIALES: la asignación también vive en la ficha (D-79)

> ⚠️ **CORRECCIÓN (2026-10-05): este apartado describe el diseño del ciclo D-79, que NO está
> aplicado en el árbol de trabajo.** `app/web/src/pages/Especiales.tsx` conserva todavía la barra
> `barra-asignacion` y la columna `col-seleccion`, y el bundle desplegado no contiene
> `esp-cuadrilla-destino`. Lo mismo vale para el chip de cuadrilla de **D-80** descrito más abajo:
> `app/web/src/components/EstadoChips.tsx` tiene **44 líneas** y ninguna marca `data-cuadrilla` ni
> `tono-`, e `Iconos.tsx` y `styles.css` no traen el icono ni los tonos. Sí están aplicados el
> **backend** de D-80 (`CasoEspecialOut`) y el ciclo **D-78**. Ver
> `RepoTecnico/estado_proyecto.md` (corrección de estado del 2026-10-05).

La sección **ESPECIALES** siguió el mismo patrón en D-79
(`app/web/src/pages/Especiales.tsx`):

- El **cuadro principal** perdió la asignación masiva: se retiraron la barra
  `barra-asignacion` (`#cuadrilla-destino-esp`, «Asignar a cuadrilla», «Quitar
  del despacho», «Limpiar selección»), la columna de casillas `col-seleccion`
  —con su «Seleccionar todos los especiales de la página»— y el resaltado
  `fila-seleccionada`. La tabla queda en **8 columnas**.
- La asignación está en la **ficha del especial**, con un bloque **Despacho**:
  selector `#esp-cuadrilla-destino`, **Asignar a cuadrilla** y **Quitar del
  despacho**, que envían `ids_caso_especial: [id_caso_especial]`.
- La **fila abre la ficha del especial** en lugar de saltar al caso asociado.
  Esto corrige un defecto real: `POST /casos-especiales` **siempre** crea un caso
  asociado (`id_caso` nunca es nulo), así que la condición anterior
  (`id_caso !== null`) hacía que el modal —con la edición del especial— **nunca
  se abriera**. Para llegar al caso, la ficha incluye el enlace **«Abrir en
  CASOS»** junto al `ID caso asociado`.

La **cuadrilla actual** la calcula la API en `_resumen`
(`app/api/routes_casos.py`), que rellena `id_cuadrilla`, `cuadrilla_codigo` y
`cuadrilla_nombre` de `CasoOut` con el **último despacho** que incluyó el caso
(`fecha` e `id_despacho` descendentes), la misma regla del filtro «Cuadrilla» de
D-72. El cálculo aplica a `GET /casos` y a `GET /casos/{id_caso}`. En
**ESPECIALES** el equivalente lo hace `_resumen_especiales`
(`app/api/routes_especiales.py`) sobre el caso asociado y lo publica en
`CasoEspecialOut` (D-80).

##### Columnas y chips de estado (D-80)

> ⚠️ **El chip de cuadrilla con color de D-80 NO está aplicado** (ver la corrección al inicio del
> apartado «ESPECIALES»): el listado sigue mostrando el icono genérico de «Asignado».

Las dos tablas cierran con la columna **Estado**, que pinta cuatro indicadores con
`EstadoChips` (`app/web/src/components/EstadoChips.tsx`). Desde D-80 el segundo
indicador **no** es el icono genérico de «Asignado», sino el **icono de la
cuadrilla** a la que el caso fue asignado, con el color de esa cuadrilla y su
etiqueta corta.

Como la paleta de cuadrillas tiene diez tonos, cualquier color de estado acabaría
coincidiendo con el de alguna cuadrilla (de hecho ocurría en tres pares: el verde
de Gestión con **C0**, el ámbar de Pendiente con **C1** y el morado de Citado con
**C3**). Por eso los cuatro chips se reparten en **dos familias que se distinguen
por su forma**, no solo por el tono:

| Familia | Chips | Forma | Contenido |
|---|---|---|---|
| **Asignación** | Cuadrilla (o Asignado si aún no tiene cuadrilla) | **Píldora** con relleno sólido | Icono blanco + código de la cuadrilla |
| **Estado** | Pendiente · Citado · Gestión | Cuadrado redondeado con **contorno tintado**, sin relleno | Solo icono, en el color del estado |

Con esto, un chip verde sólido con el texto `C0` (píldora) nunca se confunde con
el chip verde de contorno de **Gestión** (cuadrado), y lo mismo en los pares
ámbar/Pendiente y morado/Citado. Una captura de los cuatro chips, de la fila
completa y de los tres pares que coincidían está en
`docs/imagenes/chips-estado-d80.png`.

Los tonos de la familia de asignación, en orden:

| Cuadrilla | Color del chip | Etiqueta |
|---|---|---|
| C0 | verde `#1f7a4d` | `C0` |
| C1 | ámbar `#8a6100` | `C1` |
| C2 | azul `#0b4f9c` | `C2` |
| C3 | morado `#6b46c1` | `C3` |
| C4…C9 | naranja · cian · rosa · pizarra · marrón · índigo | `C4`…`C9` |
| sin número ni id | pizarra `#64748b` (respaldo) | el propio código |

El color y la etiqueta se derivan del **código** de la cuadrilla en
`app/web/src/cuadrillas.ts`: se toma el **último** grupo de dígitos (`C-00` → 0,
`C-01` → 1, `E2E-C1` → 1, `TCD12` → 12) para que un número en el prefijo no
desplace la cuadrilla, y si el código no trae dígitos se usa `id_cuadrilla` como
respaldo. La paleta tiene **10 tonos y cicla**: C0 y C10 comparten color, aunque
el chip muestre siempre el código. Si el caso está asignado pero aún no tiene
cuadrilla (por ejemplo `estado_actual = ASIGNADO` sin despacho) se conserva el
icono azul de **Asignado**, también en forma de píldora; si no hay ninguna de las
dos cosas, el chip de cuadrilla no se pinta. El color nunca es el único
indicador: el chip incluye el código y un `title`/`aria-label` con «Cuadrilla
C-00 — nombre».

#### Cambio de estado

D-76 retiró de la web el formulario «Cambiar estado» junto con la pestaña
Gestión: ningún rol mueve el estado desde la ficha. El endpoint
`POST /casos/{id}/estado` (`app/api/routes_casos.py:376-398`) sigue disponible
para los clientes que lo usan (APK). El movimiento queda registrado en la
bitácora, que se muestra dentro de la misma ventana flotante bajo la ficha
(`app/web/src/pages/Casos.tsx:621`).

#### Historial

Se muestra en una tabla con estado anterior, estado nuevo, motivo, usuario y
fecha y hora (`app/web/src/pages/Casos.tsx:896-921`), cargado con
`api.obtenerHistorialCaso` (`app/web/src/pages/Casos.tsx:331-339`).

### Antigua página PANEL (`app/web/src/pages/Panel.tsx`)

La página raíz es hoy **OPERACIÓN** (`app/web/src/App.tsx`); la ruta `/panel`
redirige a ella. El componente `Panel.tsx` ya no se monta y conserva solo el
resumen de tablas del sistema; la **búsqueda rápida que vivía en el widget de
OPERACIÓN se retiró**. El listado de CASOS mantiene su propio buscador y la barra
superior conserva el localizador flotante de casos.

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
