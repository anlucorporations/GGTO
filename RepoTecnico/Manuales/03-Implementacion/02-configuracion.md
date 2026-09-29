# Manual de implementación: módulo CONFIGURACIÓN

Este manual documenta el módulo **CONFIGURACIÓN** de GGTO a partir del código real: los
endpoints de `app/api/routes_config.py`, sus esquemas Pydantic, sus modelos SQLAlchemy, las
tablas de `RepoTecnico/db/schema.sql` y las páginas de la SPA que los consumen. Las
referencias se expresan como `ruta:línea`. Lo que no pudo verificarse se anota como
**pendiente de confirmar**.

| Recurso | Router | Página SPA | Tabla principal |
|---|---|---|---|
| Central | `app/api/routes_config.py:81-134` | `Centrales.tsx` | `central` |
| Sectores | `app/api/routes_config.py:140-233` | `Sectores.tsx` | `sector`, `sector_direccion` |
| Técnicos | `app/api/routes_config.py:289-344` | `Tecnicos.tsx` | `tecnico` |
| Flota | `app/api/routes_config.py:350-402` | `Flota.tsx` | `flota` |
| Cuadrillas | `app/api/routes_config.py:408-516` | `Cuadrillas.tsx` | `cuadrilla`, `cuadrilla_tecnico`, `cuadrilla_herramienta` |
| Catálogos | `app/api/routes_config.py:522-574` | `Catalogos.tsx` | `causa`, `catalogo_metodo` |
| Parámetros | `app/api/routes_config.py:580-600` | `Parametros.tsx` | `configuracion` |

## Visión general

### Alcance funcional (RF-02, RF-03, RF-04, RF-38)

El módulo CONFIGURACIÓN agrupa CENTRAL, TÉCNICOS, FLOTA y CUADRILLA
(`RepoTecnico/requerimientos.md:67`). El docstring del router lo declara asociado a
RF-02, RF-03, RF-04, RF-07 y RF-38, con RNF-21 como requisito de autorización
(`app/api/routes_config.py:1`).

| ID | Requerimiento | Referencia |
|---|---|---|
| RF-02 | Crear perfiles y accesos de los trabajadores (alta, edición, roles, credenciales) | `RepoTecnico/requerimientos.md:91` |
| RF-03 | Gestionar las flotas (vehículos de la central) | `RepoTecnico/requerimientos.md:92` |
| RF-04 | Gestionar las cuadrillas (trabajadores + flota + herramientas) | `RepoTecnico/requerimientos.md:93` |
| RF-38 | Configurar la central y los sectores de trabajo | `RepoTecnico/requerimientos.md:144` |

> **Aclaratoria sobre RF-05:** «Gestionar insumos» está marcado explícitamente «Para una
> 2.ª versión» y pertenece al módulo INSUMOS, no a CONFIGURACIÓN
> (`RepoTecnico/requerimientos.md:79,94`). Por eso este manual no describe endpoints de
> insumos: no forman parte del alcance implementado del módulo.

### Estructura del router y convenciones

El router usa el prefijo `/api/v1` y la etiqueta `configuración`
(`app/api/routes_config.py:57`), y se monta en `app/main.py:79`. Sobre esa base se definen
tres convenciones transversales:

- **Escritura restringida:** `_escritura = require_roles("ADMIN", "SUPERVISOR")`
  (`app/api/routes_config.py:60`).
- **404 homogéneo:** `_o_404` busca por clave primaria y lanza `404` con el nombre del
  recurso (`app/api/routes_config.py:63-67`).
- **409 homogéneo:** `_commit` intenta el `commit`, y ante `IntegrityError` hace
  `rollback` y responde `409` con el mensaje recibido
  (`app/api/routes_config.py:70-75`).

### RBAC de escritura

Cada operación de lectura usa `Depends(get_current_user)` y cada operación de escritura usa
`Depends(_escritura)`. Se puede comprobar en cualquier pareja de endpoints:

| Operación | Dependencia | Referencia |
|---|---|---|
| Listar centrales | `get_current_user` | `app/api/routes_config.py:84` |
| Crear central | `_escritura` | `app/api/routes_config.py:97` |
| Crear sector | `_escritura` | `app/api/routes_config.py:157` |
| Crear técnico | `_escritura` | `app/api/routes_config.py:306` |
| Crear cuadrilla | `_escritura` | `app/api/routes_config.py:425` |
| Crear causa | `_escritura` | `app/api/routes_config.py:536` |
| Actualizar parámetro | `_escritura` | `app/api/routes_config.py:590` |

El detalle del mecanismo de roles está en el manual de autenticación y RBAC; en resumen,
`require_roles` concede la operación a los roles enumerados y también al rol `SUPER`
(`app/api/deps.py:52-72`).

### Desactivación lógica (soft delete)

Ningún recurso se borra físicamente desde estos endpoints: se marca un estado. Central
pasa a `activa = False` (`app/api/routes_config.py:132-134`), sector a `activo = False`
(`:196-198`), técnico a `status = "INACTIVO"` (`:342-344`), flota a
`status = "FUERA_SERVICIO"` (`:400-402`) y causa a `activo = False` (`:549-551`). Las
relaciones de cuadrilla sí se cierran por fecha: `cuadrilla_tecnico.hasta = hoy`
(`:505-515`). La única eliminación física del módulo es la de una dirección de sector
(`:232`) y, con ella, el `DELETE` de `sector_direccion`.

## Endpoints por recurso

### central

| Método y ruta | Línea | Comportamiento |
|---|---|---|
| `GET /api/v1/central` | `app/api/routes_config.py:81` | Lista ordenada por `id_central`; filtro `solo_activas` |
| `POST /api/v1/central` | `app/api/routes_config.py:93` | Crea; responde `201` |
| `GET /api/v1/central/{id_central}` | `app/api/routes_config.py:106` | Obtiene o `404` |
| `PATCH /api/v1/central/{id_central}` | `app/api/routes_config.py:113` | Actualización parcial |
| `DELETE /api/v1/central/{id_central}` | `app/api/routes_config.py:128` | Desactiva; responde `204` |

El listado aplica el filtro `solo_activas` con `Central.activa.is_(True)`
(`app/api/routes_config.py:88-89`). La creación construye el objeto con `model_dump()` y
delega el conflicto de código duplicado a `_commit(db, "el código de central ya existe")`
(`:99-101`). La actualización usa `model_dump(exclude_unset=True)`, de modo que solo se
escriben los campos enviados (`:121-122`).

### sectores y sector_direccion

| Método y ruta | Línea | Comportamiento |
|---|---|---|
| `GET /api/v1/sectores` | `app/api/routes_config.py:140` | Orden por `prioridad, nombre`; filtros `id_central`, `solo_activos` |
| `POST /api/v1/sectores` | `app/api/routes_config.py:155` | Crea sector con direcciones anidadas; `201` |
| `GET /api/v1/sectores/{id_sector}` | `app/api/routes_config.py:170` | Obtiene o `404` |
| `PATCH /api/v1/sectores/{id_sector}` | `app/api/routes_config.py:177` | Actualización parcial |
| `DELETE /api/v1/sectores/{id_sector}` | `app/api/routes_config.py:192` | Desactiva; `204` |
| `POST /api/v1/sectores/{id_sector}/direcciones` | `app/api/routes_config.py:201` | Agrega un patrón; `201` |
| `DELETE /api/v1/sectores/{id_sector}/direcciones/{id_direccion}` | `app/api/routes_config.py:220` | Elimina el patrón; `204` |

La creación valida primero que la central exista (`_o_404(db, Central, datos.id_central,
"Central")`, `:159`) y luego separa las direcciones del resto de los campos
(`:160-163`). El modelo declara la relación con `cascade="all, delete-orphan"` y carga
anticipada con `lazy="selectin"` (`app/models/config_entities.py:41-43`), por lo que el
`SectorOut` puede devolver sus direcciones. El `DELETE` de una dirección verifica que
pertenezca al sector indicado y responde `404` en caso contrario
(`app/api/routes_config.py:229-231`).

### tecnicos

| Método y ruta | Línea | Comportamiento |
|---|---|---|
| `GET /api/v1/tecnicos` | `app/api/routes_config.py:289` | Orden por `nombre, apellido`; filtros `id_central`, `status` |
| `POST /api/v1/tecnicos` | `app/api/routes_config.py:304` | Valida central y crea; `201` |
| `GET /api/v1/tecnicos/{id_tecnico}` | `app/api/routes_config.py:316` | Obtiene o `404` |
| `PATCH /api/v1/tecnicos/{id_tecnico}` | `app/api/routes_config.py:323` | Actualización parcial |
| `DELETE /api/v1/tecnicos/{id_tecnico}` | `app/api/routes_config.py:338` | Pasa a `INACTIVO`; `204` |

El filtro de estado usa el alias `status` sobre el parámetro `status_`
(`app/api/routes_config.py:294`), porque `status` es el nombre real de la columna
(`app/models/entities.py:57`). La creación valida la central y documenta el conflicto de
`P00` o cédula duplicados (`app/api/routes_config.py:308-311`).

#### Estado de la cuenta del técnico (D-67)

El alta de un técnico solo crea la fila `tecnico`; la cuenta de acceso
(`usuario` + `dispositivo_seguridad`) la crea el propio técnico en su primer acceso. Para
reflejar ese ciclo de vida, `TecnicoOut` incorpora el campo calculado `estado_cuenta`
(`app/schemas/config.py:130-144`), que puede tomar cinco valores:

| `estado_cuenta` | Significado |
|---|---|
| `SIN_ALTA` | El supervisor creó el P00 pero el técnico aún no activó su cuenta (o no tiene palabras de seguridad). |
| `BLOQUEADO` | La cuenta superó los intentos permitidos. |
| `REQUIERE_CAMBIO` | La cuenta debe cambiar la clave. |
| `INACTIVO` | La cuenta (`usuario.activo`) o el técnico (`status`) están desactivados. |
| `ACTIVO` | La cuenta puede iniciar sesión. |

El cálculo vive en el helper `_estado_cuenta` (`app/api/routes_config.py:239-257`) y se
aplica a todo el listado con `_tecnicos_con_estado` (`app/api/routes_config.py:260-282`),
que resuelve usuarios y dispositivos con **dos consultas en lote** por `p00 IN (...)`
(`:265-274`) para **evitar el problema N+1**; el detalle usa `_tecnico_con_estado`
(`:285-286`). Los cinco endpoints de TÉCNICOS devuelven ya el campo
(`app/api/routes_config.py:289-344`).

El ciclo D-67 se apoya en los endpoints de primer acceso y regeneración del router de
autenticación; su detalle está en el manual
`03-Implementacion/01-autenticacion-y-rbac.md`. El estado `SIN_ALTA` se resuelve con
`POST /api/v1/auth/setup` (`app/api/routes_auth.py:129-216`), y la regeneración de palabras
—solo para el rol `SUPER`— con `POST /api/v1/auth/palabras/{p00}/regenerar`
(`app/api/routes_auth.py:275-327`).

### flota

| Método y ruta | Línea | Comportamiento |
|---|---|---|
| `GET /api/v1/flota` | `app/api/routes_config.py:350` | Orden por `can`; filtro `id_central` |
| `POST /api/v1/flota` | `app/api/routes_config.py:362` | Valida central y crea; `201` |
| `GET /api/v1/flota/{id_flota}` | `app/api/routes_config.py:374` | Obtiene o `404` |
| `PATCH /api/v1/flota/{id_flota}` | `app/api/routes_config.py:381` | Actualización parcial |
| `DELETE /api/v1/flota/{id_flota}` | `app/api/routes_config.py:396` | Pasa a `FUERA_SERVICIO`; `204` |

El conflicto de `can` o `placa` duplicados se traduce en `409`
(`app/api/routes_config.py:369`). Ambos campos tienen restricción `UNIQUE` en el esquema
(`RepoTecnico/db/schema.sql:199,203`).

### cuadrillas (integrantes y herramientas)

| Método y ruta | Línea | Comportamiento |
|---|---|---|
| `GET /api/v1/cuadrillas` | `app/api/routes_config.py:408` | Orden por `codigo`; filtros `id_central`, `solo_activas` |
| `POST /api/v1/cuadrillas` | `app/api/routes_config.py:423` | Crea con integrantes y herramientas; `201` |
| `GET /api/v1/cuadrillas/{id_cuadrilla}` | `app/api/routes_config.py:449` | Obtiene o `404` |
| `PATCH /api/v1/cuadrillas/{id_cuadrilla}` | `app/api/routes_config.py:456` | Actualización parcial |
| `POST /api/v1/cuadrillas/{id_cuadrilla}/integrantes` | `app/api/routes_config.py:471` | Incorpora un técnico; `201` |
| `DELETE /api/v1/cuadrillas/{id_cuadrilla}/integrantes/{id_tecnico}` | `app/api/routes_config.py:495` | Cierra la pertenencia; `204` |

La creación separa `integrantes` y `herramientas` del resto de los campos
(`app/api/routes_config.py:429`) y arma las filas de `CuadrillaTecnico` con `desde` por
defecto en la fecha de hoy (`:432-439`) y las de `CuadrillaHerramienta` con
`asignada_en = datetime.now(UTC)` (`:440-443`). Al incorporar un integrante se validan
cuadrilla y técnico (`:482-483`). El retiro busca la fila **activa** (`hasta IS NULL`) y
responde `404` si no existe (`:513-514`); si existe, fija `hasta = hoy` (`:515-516`). No hay
`DELETE /cuadrillas/{id}` en el router: la cuadrilla se desactiva con
`PATCH { "activa": false }` (`app/api/routes_config.py:456-468`).

> Las rutas de direcciones de sector e integrantes de cuadrilla existen en el código con
> sus líneas reales, aunque el inventario resumido de endpoints no las desglose. Se
> documentan aquí porque son parte verificable del contrato.

### catalogos (causas y metodos)

| Método y ruta | Línea | Comportamiento |
|---|---|---|
| `GET /api/v1/catalogos/causas` | `app/api/routes_config.py:522` | Orden por `codigo_causa, subcodigo_causa`; `solo_activos=True` por defecto |
| `POST /api/v1/catalogos/causas` | `app/api/routes_config.py:534` | Crea; `201` |
| `DELETE /api/v1/catalogos/causas/{id_causa}` | `app/api/routes_config.py:545` | Desactiva; `204` |
| `GET /api/v1/catalogos/metodos` | `app/api/routes_config.py:554` | Orden por `dominio, codigo`; filtro `dominio` |
| `POST /api/v1/catalogos/metodos` | `app/api/routes_config.py:566` | Crea; `201` |

Las causas se filtran por `activo` cuando `solo_activos` es verdadero, que es el valor por
defecto (`app/api/routes_config.py:528-530`). Los métodos se filtran por dominio
(`:561-562`). La semilla del esquema trae 9 métodos distribuidos en los dominios `CIERRE`,
`ENRUTE`, `CONTACTO` y `DIFERIDO` (`RepoTecnico/db/schema.sql:761-771`). El catálogo de
causas se puebla desde el CSV de ingesta y la semilla del esquema no carga causas
(`RepoTecnico/db/schema.sql:74-85`).

### configuracion (clave/valor)

| Método y ruta | Línea | Comportamiento |
|---|---|---|
| `GET /api/v1/configuracion` | `app/api/routes_config.py:580` | Lista todos los parámetros ordenados por `clave` |
| `PUT /api/v1/configuracion/{clave}` | `app/api/routes_config.py:585` | Actualiza `valor` y, opcionalmente, `descripcion` |

El parámetro se busca por su clave primaria `clave` y, si no existe, responde `404`
(`app/api/routes_config.py:592-594`). El valor es de tipo libre (`Any` en el esquema), lo
que refleja que la columna es `JSONB` (`app/models/config_entities.py:199`). La semilla del
esquema carga 23 parámetros, entre ellos `ingesta.central_codigo`, `despacho.hora_reporte`,
`despacho.min_referidos`, `fallas.umbral_casos`, `outbox.max_intentos` y
`seguridad.max_intentos` (`RepoTecnico/db/schema.sql:788-814`).

## Esquemas de entrada/salida (`app/schemas/config.py`)

### Central y sectores

| Esquema | Campos relevantes | Referencia |
|---|---|---|
| `CentralBase` | `region`, `estado_geografico`, `municipio`, `parroquia`, `area`, `codigo_central`, `nombre_central`, `activa` | `app/schemas/config.py:15-26` |
| `CentralCreate` | Hereda de `CentralBase` | `app/schemas/config.py:29-30` |
| `CentralUpdate` | Todos opcionales (actualización parcial) | `app/schemas/config.py:33-44` |
| `CentralOut` | Agrega `id_central` y `from_attributes` | `app/schemas/config.py:47-49` |
| `SectorDireccionCreate` | `patron`, `tipo_coincidencia` (`CONTIENE`/`EXACTO`/`REGEX`), `normalizar`, `activo` | `app/schemas/config.py:57-61` |
| `SectorCreate` | `id_central`, `nombre`, `codigo`, `prioridad` 1–999, `direcciones` | `app/schemas/config.py:70-77` |
| `SectorOut` | Incluye `direcciones: list[SectorDireccionOut]` | `app/schemas/config.py:88-97` |

`SectorUpdate` deja `prioridad` como `int | None` con rango 1–999
(`app/schemas/config.py:84`). `SectorDireccionOut` es la única salida que expone
`id_sector_direccion` e `id_sector` (`:64-67`).

### Técnicos, flota y cuadrillas

| Esquema | Detalle | Referencia |
|---|---|---|
| `STATUS_TECNICO` | `ACTIVO`, `INACTIVO`, `VACACIONES`, `SUSPENDIDO` | `app/schemas/config.py:104` |
| `TecnicoCreate` | `id_central`, `nombre`, `p00`, `status` | `app/schemas/config.py:107-116` |
| `TecnicoUpdate` | Sin `p00` (no editable) | `app/schemas/config.py:119-127` |
| `TecnicoOut` | Añade `estado_cuenta` (D-67, por defecto `SIN_ALTA`) | `app/schemas/config.py:130-144` |
| `STATUS_FLOTA` | `DISPONIBLE`, `EN_RUTA`, `MANTENIMIENTO`, `FUERA_SERVICIO` | `app/schemas/config.py:148` |
| `FlotaCreate` | `can`, `tipo`, `marca`, `modelo`, `placa`, `combustible`, estados | `app/schemas/config.py:151-162` |
| `ROL_CUADRILLA` | `REPARADOR_PRINCIPAL`, `AYUDANTE`, `SUPERVISOR` | `app/schemas/config.py:199` |
| `CuadrillaCreate` | `codigo`, `nombre`, `id_flota`, `integrantes`, `herramientas` | `app/schemas/config.py:216-224` |
| `CuadrillaOut` | Incluye `integrantes` | `app/schemas/config.py:235-244` |

`TecnicoUpdate` no expone `p00` (`app/schemas/config.py:119-127`), lo que coincide con la
interfaz, que deshabilita el campo al editar (`app/web/src/pages/Tecnicos.tsx:299`).
`CuadrillaUpdate` tampoco permite cambiar `id_central` ni los integrantes: solo `codigo`,
`nombre`, `id_flota`, `es_supervisor` y `activa` (`app/schemas/config.py:227-232`).

### Catálogos y parámetros

| Esquema | Detalle | Referencia |
|---|---|---|
| `CausaCreate` | `codigo_causa`, `subcodigo_causa`, descripciones, `tipo`, `activo` | `app/schemas/config.py:252-258` |
| `MetodoCreate` | `dominio` restringido a `CIERRE`/`ENRUTE`/`DIFERIDO`/`CONTACTO` | `app/schemas/config.py:266-270` |
| `ConfiguracionOut` | `clave`, `valor` (`Any`), `descripcion`, `actualizado_en` | `app/schemas/config.py:278-283` |
| `ConfiguracionUpdate` | `valor` obligatorio; `descripcion` opcional | `app/schemas/config.py:286-288` |

La restricción `Literal` del dominio en `MetodoCreate` coincide con el `CHECK` de la tabla
(`RepoTecnico/db/schema.sql:90-91`).

## Modelos y tablas

### `app/models/config_entities.py`

Este archivo define siete modelos que se mapean al esquema desplegado
(`app/models/config_entities.py:1`):

| Modelo | Tabla | Clave primaria | Referencia |
|---|---|---|---|
| `Sector` | `sector` | `id_sector` | `app/models/config_entities.py:26-43` |
| `SectorDireccion` | `sector_direccion` | `id_sector_direccion` | `app/models/config_entities.py:46-63` |
| `Flota` | `flota` | `id_flota` | `app/models/config_entities.py:66-82` |
| `Herramienta` | `herramienta` | `id_herramienta` | `app/models/config_entities.py:85-95` |
| `Cuadrilla` | `cuadrilla` | `id_cuadrilla` | `app/models/config_entities.py:98-120` |
| `CuadrillaTecnico` | `cuadrilla_tecnico` | compuesta `(id_cuadrilla, id_tecnico, desde)` | `app/models/config_entities.py:123-140` |
| `CuadrillaHerramienta` | `cuadrilla_herramienta` | compuesta `(id_cuadrilla, id_herramienta, asignada_en)` | `app/models/config_entities.py:143-161` |
| `Causa` | `causa` | `id_causa` | `app/models/config_entities.py:164-178` |
| `CatalogoMetodo` | `catalogo_metodo` | `id_metodo` | `app/models/config_entities.py:181-192` |
| `Configuracion` | `configuracion` | `clave` | `app/models/config_entities.py:195-201` |

### `app/models/entities.py`

Los modelos Central, Técnico y Usuario del Ciclo 1 viven en `app/models/entities.py`
(`app/models/entities.py:1`): `Central` (`:26-42`), `Tecnico` (`:45-59`) y `Usuario`
(`:62-82`), además de `Rol` (`:14-23`), `DispositivoSeguridad` (`:85-97`) y `Auditoria`
(`:100-116`, incorporado por D-67). El router de
configuración los importa junto con los del Ciclo 2 (`app/api/routes_config.py:13-27`).

### `RepoTecnico/db/schema.sql`

El DDL de referencia define las tablas del módulo con `CREATE TABLE IF NOT EXISTS`:

| Tabla | Línea del DDL | Nota del esquema |
|---|---|---|
| `rol` | `RepoTecnico/db/schema.sql:64` | Catálogo de roles |
| `causa` | `RepoTecnico/db/schema.sql:75` | Única por `(codigo_causa, subcodigo_causa)` |
| `catalogo_metodo` | `RepoTecnico/db/schema.sql:88` | `CHECK` de dominio |
| `configuracion` | `RepoTecnico/db/schema.sql:99` | `valor` JSONB |
| `central` | `RepoTecnico/db/schema.sql:111` | `codigo_central` único |
| `sector` | `RepoTecnico/db/schema.sql:129` | Único por `(id_central, codigo)` |
| `sector_direccion` | `RepoTecnico/db/schema.sql:143` | Único por `(id_sector, patron)` |
| `tecnico` | `RepoTecnico/db/schema.sql:160` | `p00` y `cedula` únicos |
| `flota` | `RepoTecnico/db/schema.sql:196` | `can` y `placa` únicos |
| `herramienta` | `RepoTecnico/db/schema.sql:215` | `codigo` único |
| `cuadrilla` | `RepoTecnico/db/schema.sql:228` | Único por `(id_central, codigo)` |
| `cuadrilla_tecnico` | `RepoTecnico/db/schema.sql:244` | PK compuesta con `desde` |
| `cuadrilla_herramienta` | `RepoTecnico/db/schema.sql:254` | PK compuesta con `asignada_en` |

### Restricciones e índices

- **Una sola cuadrilla de supervisor por central:** índice único parcial
  `ux_cuadrilla_supervisor ON cuadrilla (id_central) WHERE es_supervisor`
  (`RepoTecnico/db/schema.sql:241-242`).
- **Roles de cuadrilla:** `CHECK (rol_cuadrilla IN ('REPARADOR_PRINCIPAL','AYUDANTE','SUPERVISOR'))`
  (`RepoTecnico/db/schema.sql:248-249`).
- **Estados válidos:** técnico (`:170-171`), flota (`:205-206`), herramienta (`:220-221`).
- **Trigger `actualizado_en`:** las tablas `central`, `sector`, `tecnico`, `usuario`,
  `flota`, `herramienta`, `cuadrilla` y `configuracion` reciben un trigger
  `BEFORE UPDATE` que actualiza la marca de tiempo
  (`RepoTecnico/db/schema.sql:731-746`).
- **Índice trigram:** `sector_direccion.patron` participa de la búsqueda difusa con
  `pg_trgm` (`RepoTecnico/db/schema.sql:143-153`; extensión en `:23-24`).

## RBAC de escritura de configuración

### require_roles ADMIN/SUPERVISOR

La línea clave del módulo es `_escritura = require_roles("ADMIN", "SUPERVISOR")`
(`app/api/routes_config.py:60`), que se aplica con `Depends(_escritura)` en todos los
POST, PATCH, PUT y DELETE. El comentario del propio archivo lo resume: «Escritura solo para
ADMIN y SUPERVISOR (RNF-21); lectura para cualquier usuario autenticado»
(`app/api/routes_config.py:59`).

### Lectura autenticada

Los `GET` exigen sesión válida pero no un rol concreto; por ejemplo, listar centrales
depende de `get_current_user` (`app/api/routes_config.py:84`) y listar sectores también
(`:143`). Esto se corresponde con la matriz, que da «Lectura + edición operativa» al
SUPERVISOR y permite lectura a otros perfiles en módulos de consulta
(`RepoTecnico/requerimientos.md:239`).

### Bypass SUPER

El rol `SUPER` obtiene cualquier operación sin figurar en la lista de roles
(`app/api/deps.py:65`). La prueba de integración `test_super_usuario_tiene_acceso_total`
recorre lectura de los ocho recursos del módulo y escritura en flota, causas y parámetros
(`app/tests/test_config.py:163-193`).

## Validez y errores (409/404/422)

### 404 Not Found

| Caso | Detalle | Referencia |
|---|---|---|
| Recurso inexistente | `_o_404` con el nombre del recurso | `app/api/routes_config.py:63-67` |
| Central inexistente al crear sector/técnico/flota/cuadrilla | `_o_404(db, Central, ...)` | `:159`, `:308`, `:366`, `:427` |
| Dirección de otro sector | «La dirección no pertenece al sector» | `app/api/routes_config.py:230-231` |
| Integrante no activo | «El técnico no está activo en la cuadrilla» | `app/api/routes_config.py:513-514` |
| Parámetro inexistente | «Parámetro no encontrado» | `app/api/routes_config.py:593-594` |

### 409 Conflict

`_commit` captura `IntegrityError`, hace `rollback` y responde `409`
(`app/api/routes_config.py:70-75`). Los mensajes concretos identifican la restricción:

| Endpoint | Mensaje | Referencia |
|---|---|---|
| Crear central | «el código de central ya existe» | `app/api/routes_config.py:101` |
| Crear sector | «el código de sector ya existe en la central» | `app/api/routes_config.py:165` |
| Agregar dirección | «el patrón ya existe en el sector» | `app/api/routes_config.py:215` |
| Crear técnico | «el P00 o la cédula ya existen» | `app/api/routes_config.py:311` |
| Crear flota | «el CAN o la placa ya existen» | `app/api/routes_config.py:369` |
| Crear cuadrilla | «el código de cuadrilla ya existe en la central» | `app/api/routes_config.py:444` |
| Agregar integrante | «el técnico ya está en la cuadrilla desde esa fecha» | `app/api/routes_config.py:491` |
| Crear causa | «la causa ya existe» | `app/api/routes_config.py:540` |
| Crear método | «el método ya existe para ese dominio» | `app/api/routes_config.py:572` |

### 422 Unprocessable Entity

Los `422` provienen de la validación de Pydantic antes de entrar al endpoint, por los
límites declarados en `app/schemas/config.py`: por ejemplo `prioridad` entre 1 y 999
(`app/schemas/config.py:75`), `tipo_coincidencia` restringido a tres valores (`:59`),
`status` de flota restringido a cuatro valores (`:159`) y `dominio` de método a cuatro
valores (`:267`).

### 201 y 204

Las creaciones responden `201 CREATED` (por ejemplo central en
`app/api/routes_config.py:93`, sector en `:155`, cuadrilla en `:423`) y las operaciones de
desactivación o retiro responden `204 NO CONTENT`
(`:128`, `:192`, `:338`, `:396`, `:495`). El cliente de la SPA trata el `204` como
respuesta sin cuerpo (`app/web/src/api/client.ts:221`).

## Página web de configuración

### Rutas y navegación (`app/web/src/App.tsx`)

Las seis pantallas del módulo están dentro del grupo protegido por `RutaProtegida` y
`Layout` (`app/web/src/App.tsx:26-27`):

| Ruta | Componente | Referencia |
|---|---|---|
| `/central` | `Centrales` | `app/web/src/App.tsx:36` |
| `/sectores` | `Sectores` | `app/web/src/App.tsx:37` |
| `/tecnicos` | `Tecnicos` | `app/web/src/App.tsx:38` |
| `/flota` | `Flota` | `app/web/src/App.tsx:39` |
| `/cuadrillas` | `Cuadrillas` | `app/web/src/App.tsx:40` |
| `/catalogos` | `Catalogos` | `app/web/src/App.tsx:41` |
| `/parametros` | `Parametros` | `app/web/src/App.tsx:42` |

Todas leen `soloLectura` del contexto de autenticación y, cuando es verdadero, ocultan el
panel de formulario y las columnas de acciones.

### Centrales.tsx

Formulario con región, estado geográfico, capital, municipio, parroquia, estado operativo,
distrito, área, código y nombre (`app/web/src/pages/Centrales.tsx:8-20`), más la casilla
`activa` (`:240-248`). El envío distingue edición de creación
(`app/web/src/pages/Centrales.tsx:122-128`) y valida en el cliente los campos obligatorios
(`:108-119`). La tabla muestra ID, código, nombre, región, estado, municipio, parroquia,
área y si está activa (`:279-315`). El botón «Desactivar» pide confirmación
(`:138-139`).

### Sectores.tsx

Gestiona el sector y sus direcciones. Permite filtrar por central y por activos
(`app/web/src/pages/Sectores.tsx:67-69`), validar la prioridad entre 1 y 999
(`:128-132`) y adjuntar varias direcciones al crear, con tipo de coincidencia, normalizar y
activa (`:155-162`, `:333-386`). Al editar un sector se cargan sus direcciones actuales y
se permite agregar o quitar patrones uno a uno
(`:389-436`). La lista de tipos es `CONTIENE`, `EXACTO`, `REGEX`
(`app/web/src/pages/Sectores.tsx:47`).

### Tecnicos.tsx

Formulario con central, nombre, apellido, cédula, P00, teléfono, correo, especialidad y
status (`app/web/src/pages/Tecnicos.tsx:29-51`). El P00 se deshabilita al editar
(`app/web/src/pages/Tecnicos.tsx:299`), coherente con `TecnicoUpdate`, que no lo incluye.
Los estados disponibles son `ACTIVO`, `INACTIVO`, `VACACIONES` y `SUSPENDIDO`
(`app/web/src/pages/Tecnicos.tsx:10`), con filtros por central y status
(`app/web/src/pages/Tecnicos.tsx:356-379`).

**Columna Cuenta (D-67).** El listado añade la columna **Cuenta** entre `Status` y
`Acciones` (`app/web/src/pages/Tecnicos.tsx:393`) y pinta un chip con el valor de
`t.estado_cuenta` (`app/web/src/pages/Tecnicos.tsx:421-428`). Los mapas `ETIQUETA_CUENTA`
(texto legible) y `CLASE_CUENTA` (clase CSS por estado) traducen los cinco valores
(`app/web/src/pages/Tecnicos.tsx:12-27`), y las clases `.estado-cuenta` /
`.estado-cuenta.estado-*` viven en `app/web/src/styles.css:2090-2123`.

**Botón «Palabras» (solo SUPER).** En la columna de acciones, el botón **Palabras** se
renderiza únicamente si `usuario?.rol === 'SUPER'` (`app/web/src/pages/Tecnicos.tsx:55,435-444`).
Al pulsarlo pide confirmación y llama a `api.regenerarPalabras(t.p00)`
(`app/web/src/pages/Tecnicos.tsx:74-98`, `app/web/src/api/client.ts:298-304`), que invoca
`POST /api/v1/auth/palabras/{p00}/regenerar`. El resultado se muestra en un `Modal` con la
lista numerada de las 12 palabras nuevas, que solo se ven una vez
(`app/web/src/pages/Tecnicos.tsx:465-506`). Un `ADMIN` o `SUPERVISOR` no ve el botón, y un
`TECNICO` tampoco porque la página está en modo solo lectura.

### Flota.tsx

Formulario con central, CAN, tipo, marca, modelo, placa, combustible, status y tres
estados de mantenimiento (cauchos, fluidos, general)
(`app/web/src/pages/Flota.tsx:10-22`). La acción destructiva no borra: pasa el vehículo a
`FUERA_SERVICIO` con confirmación (`:160-166`), igual que hace la API
(`app/api/routes_config.py:400-402`).

### Cuadrillas.tsx

Formulario con central, código, nombre, vehículo de la flota de esa central, «es
supervisora» y «activa» (`app/web/src/pages/Cuadrillas.tsx:23-30`). Al crear, permite
agregar integrantes con su rol y una lista de IDs de herramientas separados por coma
(`:166-184`, `:321-399`). Al editar, lista los integrantes activos (`hasta === null`) y
permite incorporar o retirar (`:413-472`). Los roles son `REPARADOR_PRINCIPAL`, `AYUDANTE`
y `SUPERVISOR` (`:16`). El selector de vehículos y técnicos se acota a la central elegida
(`:132-137`).

### Catalogos.tsx

Presenta dos paneles: causas y métodos. El de causas permite código, subcódigo, tipo,
descripción, descripción del subcódigo y activa
(`app/web/src/pages/Catalogos.tsx:10-17`, `:169-226`), con desactivación confirmada
(`:114-125`). El de métodos permite dominio, código, nombre y activo
(`:19-24`, `:285-332`), con filtro por dominio (`:335-347`). Los dominios son `CIERRE`,
`ENRUTE`, `DIFERIDO` y `CONTACTO` (`:8`).

### Parametros.tsx

Edita el valor de cada parámetro como JSON: el formulario exige JSON válido y muestra un
error explícito si no lo es (`app/web/src/pages/Parametros.tsx:64-70`). La tabla muestra
clave, valor formateado, descripción y fecha de actualización
(`:131-173`). El valor se serializa con `JSON.stringify(valor, null, 2)` para editarlo
(`:13-19`). Esto se corresponde con `ConfiguracionUpdate.valor: Any`
(`app/schemas/config.py:286-288`).

## Pruebas

### `app/tests/test_config.py`

Pruebas de integración del Ciclo 2: configuración y RBAC
(`app/tests/test_config.py:1-4`). Dependen de los fixtures `client`, `admin_token` y
`db_session` definidos en `conftest.py` (`app/tests/conftest.py:103-161`).

| Prueba | Qué verifica | Referencia |
|---|---|---|
| `test_sin_token_devuelve_401` | `GET /central` sin token → `401` | `app/tests/test_config.py:9-10` |
| `test_listar_central_incluye_la_sembrada` | aparece `2324X` | `app/tests/test_config.py:13-17` |
| `test_crear_y_actualizar_central` | `201`, duplicado `409`, PATCH `200` | `app/tests/test_config.py:20-36` |
| `test_crear_sector_con_direcciones` | 3 direcciones y patrón duplicado `409` | `app/tests/test_config.py:39-63` |
| `test_crear_tecnico_y_duplicado` | P00 repetido → `409` | `app/tests/test_config.py:66-72` |
| `test_crear_flota` | `201` y PATCH a `MANTENIMIENTO` | `app/tests/test_config.py:75-88` |
| `test_crear_cuadrilla_con_integrantes` | `201` y retiro `204` | `app/tests/test_config.py:91-119` |
| `test_catalogos_causas` | `201` y causa listada | `app/tests/test_config.py:122-130` |
| `test_configuracion_listar_y_actualizar` | clave `despacho.min_referidos` y PUT | `app/tests/test_config.py:133-146` |
| `test_rbac_tecnico_no_puede_crear` | flota con token TECNICO → `403` | `app/tests/test_config.py:149-155` |
| `test_rbac_tecnico_puede_leer` | `GET /central` con TECNICO → `200` | `app/tests/test_config.py:158-160` |
| `test_super_usuario_tiene_acceso_total` | lectura y escritura con SUPER | `app/tests/test_config.py:163-193` |
| `test_super_usuario_aparece_en_me` | `GET /auth/me` devuelve rol `SUPER` | `app/tests/test_config.py:196-199` |

El informe de Fase 4 registra 13 pruebas en este archivo
(`RepoTecnico/pruebas/informe_fase4.md:79`).

### `app/tests/test_config_db.py`

Pruebas unitarias, sin base de datos, de la construcción de la URL de conexión
(`app/tests/test_config_db.py:1-2`). Verifican la URL TCP sin esquema
(`:18-26`), la URL con `search_path` alternativo
(`options=-csearch_path%3Dggto_test%2Cpublic`, `:29-37`) y la URL por socket de Cloud SQL
(`:40-50`). El informe de Fase 4 registra 3 pruebas
(`RepoTecnico/pruebas/informe_fase4.md:84`).

### Aislamiento por esquema

El parámetro `DB_SCHEMA` añade `options=-csearch_path=<esquema>,public` a la URL de
conexión (`app/core/config.py:24-25`), lo que permite ejecutar las pruebas contra el
esquema `ggto_test` sin tocar `public` (`RepoTecnico/entornos_globales.md:145`). El fallo
F4-01 y su corrección se documentan en el informe de Fase 4
(`RepoTecnico/pruebas/informe_fase4.md:36`).

### CI

El flujo de integración continua levanta PostgreSQL 15 como servicio y ejecuta `ruff`,
`mypy` y `pytest app/tests -q` (`.github/workflows/ci.yml:16-54`). Las pruebas de
integración requieren `GGTO_TEST_DB_URL`; si no está definida, el `conftest` las omite
(`app/tests/conftest.py:70-72`).
