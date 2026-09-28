# Diccionario de Datos — Entidades de la base GGTO

| Dato | Valor |
|---|---|
| Proyecto | **GGTO** — Sistema de administración de reportes de avería y construcción de puntos ópticos |
| Cliente | CANTV C.A. — Central Francisco Salias (Área 4) |
| Motor | PostgreSQL 15 (instancia compartida `truekeate-main:southamerica-east1:truekeate-db-dev`) |
| Base | `ggtov2` · usuario de aplicación `ggtov2_app` |
| DDL de referencia | `RepoTecnico/db/schema.sql` (803 líneas, **35 tablas**) |
| Mapeo ORM | `app/models/*.py` (SQLAlchemy 2.x declarativo) |
| Diccionario de origen | `RepoTecnico/diccionario_datos.md` (Borrador v0.2, «sujeto a validación») |
| Esquema de pruebas | `DB_SCHEMA` añade `options=-csearch_path=<esquema>,public` (`app/core/db.py:33-36`) |

> Este manual describe las entidades **tal como están implementadas** en el DDL
> desplegado y en los modelos ORM. Cuando el diccionario de origen (`diccionario_datos.md`)
> y el DDL difieren, la divergencia se señala de forma explícita en la sección
> **Fuentes → Divergencias detectadas**. Lo no verificable se marca como
> «pendiente de confirmar».

## Visión general

### Las 35 tablas del esquema

El DDL contiene **35 sentencias `CREATE TABLE`** (conteo directo sobre
`RepoTecnico/db/schema.sql`). Se agrupan en siete dominios funcionales.

| Dominio | Tablas | Nº |
|---|---|---|
| Seguridad y acceso | `rol`, `usuario`, `dispositivo_seguridad`, `auditoria` | 4 |
| Configuración | `central`, `sector`, `sector_direccion`, `tecnico`, `flota`, `herramienta`, `cuadrilla`, `cuadrilla_tecnico`, `cuadrilla_herramienta`, `causa`, `catalogo_metodo`, `configuracion` | 12 |
| Operación | `ingesta_lote`, `caso`, `caso_estado_hist`, `actividad`, `evidencia`, `incidente`, `sincronizacion` | 7 |
| Especiales | `solicitante`, `caso_especial`, `seguimiento`, `cita` | 4 |
| Despacho | `despacho`, `despacho_caso`, `falla_masiva` | 3 |
| Insumos (v2) | `insumo`, `orden_material`, `orden_material_detalle`, `inventario_movimiento` | 4 |
| Notificaciones | `notificacion` | 1 |
| **Total** | | **35** |

Tablas de catálogo sembradas con datos iniciales idempotentes:
`rol` (4 filas: SUPER, ADMIN, SUPERVISOR, TECNICO), `catalogo_metodo` (9 filas),
`central` (1 fila: `2324X` FRANCISCO SALIAS), `cuadrilla` (1 fila: `C-00`) y
`configuracion` (22 parámetros) — `RepoTecnico/db/schema.sql:736-797`.
El catálogo `causa` **no** se puebla desde el CSV: es administrable y su
mantenimiento corresponde al administrador de catálogos (`RepoTecnico/diccionario_datos.md:487-489`).

### Convenciones de nombres y tipos

Convenciones observadas en el DDL (`RepoTecnico/db/schema.sql:64-652`):

| Convención | Regla | Ejemplo |
|---|---|---|
| Nombre de tabla | singular, `snake_case`, sin prefijos | `caso`, `sector_direccion` |
| Clave primaria | `id_<entidad>` | `id_caso`, `id_sector` |
| Clave foránea | `id_<entidad_referenciada>` | `id_central`, `id_cuadrilla` |
| Marcas de tiempo | sufijo `_en` o nombre explícito | `creado_en`, `asignada_en`, `fecha_hora` |
| Banderas | `boolean` con nombre afirmativo | `activo`, `activa`, `bloqueado`, `es_supervisor` |
| Constantes de dominio | `varchar(20)` con `CHECK` enumerado, no `ENUM` | `estado_actual`, `tipo_caso` |
| JSON | `jsonb` con `DEFAULT '{}'` o `'[]'` | `rol.permisos`, `caso.ayudantes` |

Correspondencia de tipos entre el DDL, el ORM SQLAlchemy y la notación Mermaid
de `RepoTecnico/modelo_er.md:15-26`:

| PostgreSQL (DDL) | SQLAlchemy (`app/models/`) | Mermaid (`modelo_er.md`) |
|---|---|---|
| `serial` | `Integer, primary_key=True` | `serial` |
| `bigserial` | `BigInteger, primary_key=True` | `bigserial` |
| `varchar(n)` | `String(n)` | `varchar` |
| `text` | `Text` | (omitido) |
| `timestamptz` | `DateTime(timezone=True)` | `timestamp` |
| `boolean` | `Boolean` | `bool` |
| `jsonb` | `JSONB` (dialecto PostgreSQL) | `json` |
| `numeric(12,2)` | (no usado en ORM) | `numeric` |
| `inet` | (no usado en ORM) | (omitido) |

Notas de tipado verificadas:

- Los identificadores largos (`caso`, `ingesta_lote`, `despacho`, …) son
  `bigserial`; los catálogos pequeños (`central`, `tecnico`, `sector`) son
  `serial` (`RepoTecnico/db/schema.sql:111,160,285,442`).
- `actividad.latitud/longitud` y `evidencia.latitud/longitud` usan
  `numeric(10,7)` (precisión GPS de ~1 cm) — `RepoTecnico/db/schema.sql:509-510,523-524`.
- `auditoria.ip` es del tipo PostgreSQL `inet` (no `varchar`) —
  `RepoTecnico/db/schema.sql:650`.
- `dispositivo_seguridad.palabras_hash` es `jsonb` con `DEFAULT '[]'`
  (`RepoTecnico/db/schema.sql:548`); el modelo lo expone como `list`
  (`app/models/entities.py:92`).
- El ORM mapea **27 de las 35 tablas**. Las ocho tablas restantes
  (`actividad`, `evidencia`, `incidente`, `sincronizacion`, `insumo`,
  `orden_material_detalle`, `inventario_movimiento`, `auditoria`) no tienen
  clase declarativa y solo existen en el DDL (ver **Fuentes → Cobertura del ORM**).

### Campos de auditoría (creado_en, actualizado_en)

Todas las tablas relevantes registran su creación con `creado_en timestamptz NOT NULL DEFAULT now()`.
Quince tablas añaden además `actualizado_en`:

| Tabla | `actualizado_en` | Disparador `trg_*_actualizado` |
|---|---|---|
| `central` | `RepoTecnico/db/schema.sql:125` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `sector` | `RepoTecnico/db/schema.sql:138` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `tecnico` | `RepoTecnico/db/schema.sql:173` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `usuario` | `RepoTecnico/db/schema.sql:192` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `flota` | `RepoTecnico/db/schema.sql:211` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `herramienta` | `RepoTecnico/db/schema.sql:224` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `cuadrilla` | `RepoTecnico/db/schema.sql:237` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `caso` | `RepoTecnico/db/schema.sql:363` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `caso_especial` | `RepoTecnico/db/schema.sql:392` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `despacho` | `RepoTecnico/db/schema.sql:454` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `falla_masiva` | `RepoTecnico/db/schema.sql:489` | Sí (`RepoTecnico/db/schema.sql:718`) |
| `insumo` | `RepoTecnico/db/schema.sql:585` | Sí (`RepoTecnico/db/schema.sql:719`) |
| `orden_material` | `RepoTecnico/db/schema.sql:598` | Sí (`RepoTecnico/db/schema.sql:719`) |
| `configuracion` | `RepoTecnico/db/schema.sql:103` | Sí (`RepoTecnico/db/schema.sql:719`) |
| `dispositivo_seguridad` | `RepoTecnico/db/schema.sql:553` | **No** (ausente del arreglo `tablas`) |

La función `set_actualizado_en()` asigna `NEW.actualizado_en := now()` en cada
`UPDATE` (`RepoTecnico/db/schema.sql:27-34`) y el bloque `DO` crea un disparador
`BEFORE UPDATE ... FOR EACH ROW` sobre las 14 tablas editables del arreglo
`tablas` (`RepoTecnico/db/schema.sql:714-729`). La tabla
`dispositivo_seguridad` declara la columna `actualizado_en` pero **no** aparece
en ese arreglo (`RepoTecnico/db/schema.sql:717-720`), por lo que su marca de
actualización **no se refresca automáticamente**: se recomienda confirmar si es
intencional o añadirla al arreglo. Las tablas transaccionales
(`caso_estado_hist`, `actividad`, `evidencia`, `cita`, `seguimiento`,
`notificacion`, `auditoria`) son de solo inserción y no llevan `actualizado_en`.

### Extensiones pgcrypto/pg_trgm

El DDL crea dos extensiones al inicio de la transacción
(`RepoTecnico/db/schema.sql:23-24`):

| Extensión | Uso declarado en el código | Versión |
|---|---|---|
| `pgcrypto` | `gen_random_uuid()` y `digest()` (`RepoTecnico/db/schema.sql:23`) | 1.3 (verificado en la instancia; hoja de hechos de verificación) |
| `pg_trgm` | Búsqueda difusa por dirección para la sectorización (RF-23 / D-33) — índices GIN `gin_trgm_ops` (`schema.sql:24,674-675`) | 1.6 (verificado en la instancia; hoja de hechos de verificación) |

Como las extensiones viven en `public`, la cadena de conexión conserva ese
esquema en el `search_path` cuando se usa `DB_SCHEMA`:
`options=-csearch_path=<esquema>,public` (`app/core/db.py:33-36`). Esto permite
que los esquemas aislados de prueba resuelvan `gin_trgm_ops` y las funciones de
`pgcrypto` sin reinstalar las extensiones. Las versiones exactas de las
extensiones no están fijadas en el repositorio: **pendiente de confirmar** en
cada entorno si se requiere paridad estricta.

## Entidades por dominio

### Seguridad y acceso

#### `rol` — catálogo de roles

Propósito: catálogo de roles del sistema con su bolsa de permisos en `jsonb`
(`RepoTecnico/db/schema.sql:64-72`; ORM `app/models/entities.py:14-23`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_rol` | `serial` | PK, NN | Identificador del rol. |
| `codigo` | `varchar(30)` | UQ, NN | `SUPER`, `ADMIN`, `SUPERVISOR`, `TECNICO` (`RepoTecnico/db/schema.sql:736-741`). |
| `nombre` | `varchar(80)` | NN | Nombre visible. |
| `descripcion` | `text` | — | Alcance funcional resumido. |
| `permisos` | `jsonb` | NN, `'{}'` | Permisos adicionales; el rol `SUPER` no depende de esta bolsa porque `require_roles` le concede bypass total (`app/api/deps.py:20,65`). |
| `activo` | `boolean` | NN, `true` | Rol habilitado. |
| `creado_en` | `timestamptz` | NN, `now()` | Auditoría de creación. |

#### `usuario` — credenciales de acceso

Propósito: cuentas de acceso con login por `P00`, hash de clave y alcance por
central (`RepoTecnico/db/schema.sql:177-193`; ORM `app/models/entities.py:62-82`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_usuario` | `serial` | PK, NN | Identificador. |
| `p00` | `varchar(20)` | UQ, NN | Identificador laboral usado como login y como `sub` del JWT. |
| `correo` | `varchar(120)` | UQ | Correo del usuario. |
| `clave_hash` | `varchar(255)` | NN | Hash **Argon2id** (`app/core/security.py:16-25`). |
| `id_rol` | `integer` | FK→`rol`, NN | Rol asignado. |
| `id_tecnico` | `integer` | FK→`tecnico` | Vínculo con el trabajador (opcional). |
| `id_central` | `integer` | FK→`central` | **Alcance por central (D-36)**; refuerza RLS. |
| `intentos_fallidos` | `smallint` | NN, `0` | Bloqueo a los 3 intentos (`app/core/config.py:31`). |
| `bloqueado` | `boolean` | NN, `false` | Cuenta bloqueada por intentos. |
| `bloqueo_cliente` | `boolean` | NN, `false` | Bandera prevista para ocultar datos del cliente (RNF-05). |
| `requiere_cambio_clave` | `boolean` | NN, `false` | Fuerza cambio de clave. |
| `activo` | `boolean` | NN, `true` | Cuenta habilitada. |
| `ultimo_acceso` | `timestamptz` | — | Último ingreso exitoso. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

#### `dispositivo_seguridad` — recuperación y documento cifrado

Propósito: 12 palabras de recuperación y documento cifrado por usuario
(`RepoTecnico/db/schema.sql:545-554`; ORM `app/models/entities.py:85-97`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_dispositivo` | `bigserial` | PK, NN | Identificador. |
| `p00` | `varchar(20)` | UQ, NN, FK→`usuario.p00` `ON DELETE CASCADE` | Usuario propietario. |
| `palabras_hash` | `jsonb` | NN, `'[]'` | Hashes de las 12 palabras (`app/core/config.py:32-33`). |
| `clave_privada_ref` | `varchar(255)` | — | Referencia al secreto de la clave privada (no la clave). |
| `documento_cifrado` | `text` | — | Documento de recuperación cifrado. |
| `bloqueado` | `boolean` | NN, `false` | Dispositivo bloqueado. |
| `version` | `integer` | NN, `1` | Versión del documento. |
| `actualizado_en` | `timestamptz` | NN | Sin disparador automático (ver hallazgo arriba). |

#### `auditoria` — bitácora de acciones

Propósito: bitácora de acciones con valores antes/después en `jsonb`
(`RepoTecnico/db/schema.sql:642-652`; sin modelo ORM).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_auditoria` | `bigserial` | PK, NN | Identificador. |
| `usuario` | `varchar(20)` | — | P00 que ejecutó la acción. |
| `accion` | `varchar(60)` | NN | Acción registrada. |
| `entidad` | `varchar(60)` | — | Tabla o entidad afectada. |
| `id_entidad` | `varchar(40)` | — | Identificador del registro afectado. |
| `datos_antes` | `jsonb` | — | Estado previo. |
| `datos_despues` | `jsonb` | — | Estado posterior. |
| `ip` | `inet` | — | Dirección de origen. |
| `fecha_hora` | `timestamptz` | NN, `now()` | Momento del evento. |

Índice de apoyo: `ix_auditoria_fecha ON auditoria (fecha_hora)`
(`RepoTecnico/db/schema.sql:677`). No se encontró código en `app/` que escriba
en `auditoria`: **pendiente de confirmar** su punto de registro efectivo.

### Configuración

#### `central` — dirección operativa

Propósito: base del filtro de ingesta; la central sembrada es `2324X`
FRANCISCO SALIAS (`RepoTecnico/db/schema.sql:111-126,757-761`;
ORM `app/models/entities.py:26-42`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_central` | `serial` | PK, NN | Identificador. |
| `region` | `varchar(80)` | NN | Ej. `CAPITAL`. |
| `estado_geografico` | `varchar(80)` | NN | Ej. `BOLIVARIANO MIRANDA`. |
| `capital_estado` | `varchar(80)` | — | Ej. `LOS TEQUES`. |
| `municipio` | `varchar(80)` | NN | Ej. `BARUTA`. |
| `parroquia` | `varchar(80)` | NN | Ej. `BARUTA`. |
| `estado_operativo` | `varchar(80)` | — | Ej. `MIRANDA-2`. |
| `distrito` | `varchar(40)` | — | Ej. `10204`. |
| `area` | `varchar(20)` | NN | Ej. `AREA 4`. |
| `codigo_central` | `varchar(20)` | UQ, NN | Ej. `2324X`; base de `generar_id_averia_ref`. |
| `nombre_central` | `varchar(120)` | NN | Ej. `FRANCISCO SALIAS`. |
| `activa` | `boolean` | NN, `true` | Central operativa. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

#### `sector` — agrupación geográfica de trabajo

Propósito: sectores definidos por el supervisor (Norte 1, Sur 2…) para rutas y
despacho (`RepoTecnico/db/schema.sql:129-140`; ORM `app/models/config_entities.py:26-43`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_sector` | `serial` | PK, NN | Identificador. |
| `id_central` | `integer` | FK→`central` `ON DELETE CASCADE`, NN | Central propietaria. |
| `nombre` | `varchar(120)` | NN | Nombre visible. |
| `codigo` | `varchar(20)` | NN | Código corto. |
| `descripcion` | `text` | — | Notas del supervisor. |
| `prioridad` | `smallint` | NN, `100` | Orden de atención. |
| `activo` | `boolean` | NN, `true` | Sector vigente. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

Restricción única compuesta `UNIQUE (id_central, codigo)`
(`RepoTecnico/db/schema.sql:139`; ORM `app/models/config_entities.py:39`).

#### `sector_direccion` — patrones de dirección del sector

Propósito: alias/patrones de dirección que pertenecen a un sector; base de la
sectorización por coincidencia de texto (`RepoTecnico/db/schema.sql:143-153`;
ORM `app/models/config_entities.py:46-63`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_sector_direccion` | `serial` | PK, NN | Identificador. |
| `id_sector` | `integer` | FK→`sector` `ON DELETE CASCADE`, NN | Sector destino. |
| `patron` | `varchar(160)` | NN | Texto a buscar en `caso.direccion`. |
| `tipo_coincidencia` | `varchar(20)` | NN, `CONTIENE` | `CONTIENE` / `EXACTO` / `REGEX`. |
| `normalizar` | `boolean` | NN, `true` | Sin acentos ni mayúsculas antes de comparar. |
| `activo` | `boolean` | NN, `true` | Patrón vigente. |
| `creado_en` | `timestamptz` | NN | Auditoría. |

Restricción `UNIQUE (id_sector, patron)` (`RepoTecnico/db/schema.sql:152`) e índice trigram
`ix_sector_patron_trgm` (`RepoTecnico/db/schema.sql:675`).

#### `tecnico` — trabajador de la central

Propósito: datos del personal técnico (`RepoTecnico/db/schema.sql:160-174`;
ORM `app/models/entities.py:45-59`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_tecnico` | `serial` | PK, NN | Identificador. |
| `id_central` | `integer` | FK→`central`, NN | Central que lo emplea. |
| `nombre` | `varchar(80)` | NN | Nombre. |
| `apellido` | `varchar(80)` | — | Apellido. |
| `cedula` | `varchar(20)` | UQ | Cédula. |
| `p00` | `varchar(20)` | UQ, NN | Identificador laboral. |
| `telefono` | `varchar(30)` | — | Contacto (PII). |
| `correo` | `varchar(120)` | — | Correo (PII). |
| `especialidad` | `varchar(80)` | — | Especialidad. |
| `status` | `varchar(20)` | NN, `ACTIVO` | `ACTIVO`/`INACTIVO`/`VACACIONES`/`SUSPENDIDO`. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

#### `flota` — vehículos de la central

Propósito: parque automotor asignable a cuadrillas (`RepoTecnico/db/schema.sql:196-212`;
ORM `app/models/config_entities.py:66-82`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_flota` | `serial` | PK, NN | Identificador. |
| `id_central` | `integer` | FK→`central`, NN | Central propietaria. |
| `can` | `varchar(20)` | UQ, NN | Código CAN. |
| `tipo` / `marca` / `modelo` | `varchar(40)` | — | Características. |
| `placa` | `varchar(20)` | UQ | Placa. |
| `combustible` | `varchar(20)` | — | Tipo de combustible. |
| `status` | `varchar(20)` | NN, `DISPONIBLE` | `DISPONIBLE`/`EN_RUTA`/`MANTENIMIENTO`/`FUERA_SERVICIO`. |
| `estado_cauchos` / `estado_fluidos` / `estado_general` | `varchar(30)` | — | Chequeo operativo. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

#### `herramienta` — inventario de herramientas

Propósito: herramientas asignables a cuadrillas (`RepoTecnico/db/schema.sql:215-225`;
ORM `app/models/config_entities.py:85-95`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_herramienta` | `serial` | PK, NN | Identificador. |
| `id_central` | `integer` | FK→`central`, NN | Central propietaria. |
| `nombre` | `varchar(120)` | NN | Nombre. |
| `codigo` | `varchar(40)` | UQ, NN | Código de inventario. |
| `estado` | `varchar(20)` | NN, `DISPONIBLE` | `DISPONIBLE`/`ASIGNADA`/`AVERIADA`/`PERDIDA`. |
| `observacion` | `text` | — | Notas. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

#### `cuadrilla` — equipo de trabajo

Propósito: cuadrilla = técnicos + flota + herramientas; la cuadrilla de
supervisor es la «cuadrilla 0» (`RepoTecnico/db/schema.sql:228-242`;
ORM `app/models/config_entities.py:98-120`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_cuadrilla` | `serial` | PK, NN | Identificador. |
| `id_central` | `integer` | FK→`central`, NN | Central que la organiza. |
| `codigo` | `varchar(20)` | NN | Código corto (ej. `C-00`). |
| `nombre` | `varchar(80)` | NN | Nombre. |
| `id_flota` | `integer` | FK→`flota` | Vehículo asignado. |
| `es_supervisor` | `boolean` | NN, `false` | Marca la cuadrilla 0. |
| `activa` | `boolean` | NN, `true` | Cuadrilla vigente. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

Restricciones: `UNIQUE (id_central, codigo)` (`RepoTecnico/db/schema.sql:238`) e índice único
parcial `ux_cuadrilla_supervisor ON cuadrilla (id_central) WHERE es_supervisor`
que garantiza **una sola cuadrilla 0 por central** (`RepoTecnico/db/schema.sql:241-242`).

#### `cuadrilla_tecnico` — pertenencia N:M con vigencia

Propósito: integración de técnicos en cuadrillas con rol y rango de fechas
(`RepoTecnico/db/schema.sql:244-252`; ORM `app/models/config_entities.py:123-140`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_cuadrilla` | `integer` | PK, FK→`cuadrilla` `ON DELETE CASCADE`, NN | Cuadrilla. |
| `id_tecnico` | `integer` | PK, FK→`tecnico` `ON DELETE CASCADE`, NN | Técnico. |
| `desde` | `date` | PK, NN, `CURRENT_DATE` | Inicio de la pertenencia. |
| `rol_cuadrilla` | `varchar(30)` | NN, `REPARADOR_PRINCIPAL` | `REPARADOR_PRINCIPAL`/`AYUDANTE`/`SUPERVISOR`. |
| `hasta` | `date` | — | Fin de la pertenencia (nulo = vigente). |

PK compuesta `(id_cuadrilla, id_tecnico, desde)` (`RepoTecnico/db/schema.sql:251`).

#### `cuadrilla_herramienta` — asignación de herramientas

Propósito: historial de asignación/devolución de herramientas
(`RepoTecnico/db/schema.sql:254-260`; ORM `app/models/config_entities.py:143-161`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_cuadrilla` | `integer` | PK, FK→`cuadrilla` `ON DELETE CASCADE`, NN | Cuadrilla. |
| `id_herramienta` | `integer` | PK, FK→`herramienta` `ON DELETE CASCADE`, NN | Herramienta. |
| `asignada_en` | `timestamptz` | PK, NN, `now()` | Momento de la asignación. |
| `devuelta_en` | `timestamptz` | — | Momento de la devolución. |

PK compuesta `(id_cuadrilla, id_herramienta, asignada_en)` (`RepoTecnico/db/schema.sql:259`).

#### `causa` — catálogo de causas

Propósito: catálogo administrable de causas (código/subcódigo) usado por
`caso.id_causa` y `actividad.id_causa` (`RepoTecnico/db/schema.sql:75-85`;
ORM `app/models/config_entities.py:164-178`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_causa` | `serial` | PK, NN | Identificador. |
| `codigo_causa` | `varchar(20)` | NN | Código principal. |
| `subcodigo_causa` | `varchar(20)` | NN, `''` | Subcódigo (vacío si no aplica). |
| `descripcion` | `varchar(255)` | — | Descripción del código. |
| `descripcion_subcodigo` | `varchar(255)` | — | Descripción del subcódigo. |
| `tipo` | `varchar(20)` | — | Clasificación libre. |
| `activo` | `boolean` | NN, `true` | Causa vigente. |
| `creado_en` | `timestamptz` | NN | Auditoría. |

Restricción `UNIQUE (codigo_causa, subcodigo_causa)` (`RepoTecnico/db/schema.sql:84`).
Semilla actual: **0 causas** (el catálogo se administra, no se carga del CSV).

#### `catalogo_metodo` — métodos de cierre/enrutado/contacto

Propósito: métodos normalizados usados por `actividad.id_metodo`
(`RepoTecnico/db/schema.sql:88-96`; ORM `app/models/config_entities.py:181-192`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_metodo` | `serial` | PK, NN | Identificador. |
| `dominio` | `varchar(20)` | NN | `CIERRE`/`ENRUTE`/`DIFERIDO`/`CONTACTO`. |
| `codigo` | `varchar(30)` | NN | Código (ej. `IVR`, `COS`, `SACAS`). |
| `nombre` | `varchar(120)` | NN | Nombre visible. |
| `activo` | `boolean` | NN, `true` | Método vigente. |

Restricción `UNIQUE (dominio, codigo)` (`RepoTecnico/db/schema.sql:95`); semilla de 9 métodos
(`RepoTecnico/db/schema.sql:744-754`).

#### `configuracion` — parámetros del sistema

Propósito: parámetros configurables en `jsonb` (`RepoTecnico/db/schema.sql:99-104`;
ORM `app/models/config_entities.py:195-201`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `clave` | `varchar(80)` | PK, NN | Clave del parámetro (ej. `fallas.umbral_casos`). |
| `valor` | `jsonb` | NN | Valor tipado en JSON. |
| `descripcion` | `text` | — | Explicación del parámetro. |
| `actualizado_en` | `timestamptz` | NN, `now()` | Refrescado por disparador. |

Los parámetros relacionados con secretos solo se nombran, nunca se transcriben:
`telegram.webhook_secret` y `mcp.api_key` se siembran vacíos
(`RepoTecnico/db/schema.sql:793-794`). El resto de claves sembradas
(`ingesta.*`, `despacho.*`, `fallas.*`, `outbox.max_intentos`,
`seguridad.*`) consta en `RepoTecnico/db/schema.sql:771-797`.

### Operación

#### `ingesta_lote` — carga del CSV diario

Propósito: cabecera y métricas de cada carga del archivo
`detalle_averias_gpon_*.csv` (`RepoTecnico/db/schema.sql:267-282`;
ORM `app/models/caso_entities.py:23-38`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_lote` | `bigserial` | PK, NN | Identificador del lote. |
| `archivo` | `varchar(255)` | NN | Nombre del archivo cargado. |
| `fecha_archivo` | `date` | — | Fecha declarada del archivo (en el ORM se mapea como `DateTime`; ver divergencias). |
| `id_central` | `integer` | FK→`central` | Central del lote. |
| `filas_leidas` / `filas_central` | `integer` | NN, `0` | Filas totales y filas de la central. |
| `casos_nuevos` / `casos_duplicados` / `casos_descartados` | `integer` | NN, `0` | Resultado de la deduplicación por `id_averia`. |
| `estado` | `varchar(20)` | NN, `PROCESANDO` | `PROCESANDO`/`OK`/`ERROR`. |
| `detalle_error` | `text` | — | Mensaje de error del lote. |
| `usuario` | `varchar(20)` | — | P00 que ejecutó la carga. |
| `creado_en` | `timestamptz` | NN | Auditoría. |

#### `caso` — entidad central de averías

Propósito: tabla central del sistema; mapea el CSV (80 columnas depuradas) más
los campos propios del sistema. La deduplicación global se apoya en
`id_averia` (`RepoTecnico/db/schema.sql:285-364`; ORM `app/models/caso_entities.py:41-118`).

| Grupo | Campos (tipo) | Nulo | Descripción |
|---|---|---|---|
| Identidad | `id_caso` (`bigserial` PK), `id_central` (FK, NN) | — | Identificador interno y central propietaria. |
| Clasificación | `id_averia` `varchar(30)` UQ NN; `origen` NN `INGESTA_CSV`; `tipo_caso` NN `AVERIA`; `categoria` NN `RESIDENCIAL` | Solo `id_averia`/`origen`/`tipo_caso`/`categoria` son NN | Enumerados con `CHECK`: origen `INGESTA_CSV`/`MANUAL`/`TELEGRAM`/`MCP_IA`; tipo `AVERIA`/`REPARACION`/`CONSTRUCCION`; categoría `RESIDENCIAL`/`EMPRESA`/`REFERIDO`/`GOBIERNO`. |
| Estado | `estado_actual` `varchar(20)` NN `NUEVO` | NN | `NUEVO`/`ASIGNADO`/`CONTACTADO`/`CITADO`/`DIFERIDO`/`EN_GESTION`/`ENRUTADO`/`CERRADO`/`CANCELADO` (`RepoTecnico/db/schema.sql:297-299`). |
| Enlaces | `id_sector` FK, `id_causa` FK, `id_lote_ingesta` FK | Sí | Sectorización, causa y lote de origen. |
| Banderas | `en_gestion_supervisor` NN `false`, `es_falla_masiva` NN `false`, `creado_por` FK→`usuario.p00` | `creado_por` sí | Gestión por cuadrilla 0 y agregación a falla masiva. |
| Geografía | `region`, `estado_geografico`, `capital_estado`, `municipio`, `parroquia`, `estado_operativo`, `distrito`, `area`, `codigo_central`, `nombre_central` (`varchar`) | Sí | Copia denormalizada usada como filtro de central. |
| Contacto | `telefono` `varchar(30)`, `fecha_reporte`, `persona_reporta` `varchar(120)`, `contacto_cliente` `varchar(60)`, `fecha_compromiso`, `fecha_cita`, `ultimo_comentario` `text`, `results` `text`, `asignado_a` `varchar(60)`, `cuadrilla_externa` `varchar(40)`, `estatus_origen` `varchar(20)`, `problema_reporte` `text`, `informacion` `text`, `nombre_cliente` `varchar(160)`, `direccion` `text` | Sí | `informacion` unifica las columnas 31, 32 y 52 del CSV (D-27, `RepoTecnico/db/schema.sql:332`); `direccion` es la base de la sectorización. |
| Técnico/lógico | `olt` `varchar(40)`, `plan` `varchar(60)`, `slot` `varchar(10)`, `puerto` `varchar(10)`, `fat` `varchar(80)`, `serial` `varchar(60)`, `extra`, `area_trabajo`, `tipo_servicio`, `tipo_problema`, `dias_area_resolutoria` `integer`, `unidad_negocio`, `ups`, `codigos_gestionados_venapp`, `codigos_sin_gestion_venapp` | Sí | Datos de red y gestión VENAPP. |
| Asignación origen | `reparador_principal` `varchar(20)`, `ayudantes` `jsonb` NN `'[]'`, `flota_can`, `despacho_nombre`, `despacho_apellido`, `telefono_oficina`, `telefono_movil`, `fecha_hora_asignacion` | `ayudantes` NN; el resto sí | Hasta 9 ayudantes en el arreglo JSON. |
| Auditoría | `creado_en` NN, `actualizado_en` NN | NN | Refrescado por disparador. |

El comentario del modelo indica **63 columnas** (`app/models/caso_entities.py:42`)
y el conteo sobre el DDL confirma 63 definiciones de columna en
`RepoTecnico/db/schema.sql:286-363`. El diccionario de origen habla de **49 campos destino**
del CSV (`diccionario_datos.md:8,238`): corresponde al mapeo de columnas del
archivo, no al total físico de la tabla (ver **Divergencias detectadas**).

#### `caso_estado_hist` — bitácora de estados

Propósito: historial de transiciones de estado de un caso
(`RepoTecnico/db/schema.sql:396-404`; ORM `app/models/caso_entities.py:121-136`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_hist` | `bigserial` | PK, NN | Identificador. |
| `id_caso` | `bigint` | FK→`caso` `ON DELETE CASCADE`, NN | Caso afectado. |
| `estado_anterior` | `varchar(20)` | — | Estado previo (nulo en el alta). |
| `estado_nuevo` | `varchar(20)` | NN | Estado nuevo. |
| `motivo` | `text` | — | Justificación del cambio. |
| `usuario` | `varchar(20)` | FK→`usuario.p00` | Autor del cambio. |
| `fecha_hora` | `timestamptz` | NN, `now()` | Momento del cambio. |

#### `actividad` — reporte corto de gestión

Propósito: registrar contacto, cierre, enrute, diferido, incidente o falla
masiva sobre un caso, con GPS y marca de sincronización
(`RepoTecnico/db/schema.sql:496-513`; **sin modelo ORM**).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_actividad` | `bigserial` | PK, NN | Identificador. |
| `id_caso` | `bigint` | FK→`caso` `ON DELETE CASCADE`, NN | Caso gestionado. |
| `id_usuario` | `integer` | FK→`usuario` | Técnico que reporta. |
| `id_cuadrilla` | `integer` | FK→`cuadrilla` | Cuadrilla ejecutora. |
| `tipo` | `varchar(20)` | NN | `CONTACTO`/`CIERRE`/`ENRUTE`/`DIFERIDO`/`INCIDENTE`/`FALLA_MASIVA`. |
| `resultado` | `varchar(20)` | — | `CONTACTADO`/`CERRADO`/`ENRUTADO`/`DIFERIDO`. |
| `reporte_corto` | `text` | — | Descripción/justificación. |
| `id_metodo` | `integer` | FK→`catalogo_metodo` | Método de cierre/enrutado/contacto. |
| `id_causa` | `integer` | FK→`causa` | Causa para enrute/diferido. |
| `fecha_hora` | `timestamptz` | NN, `now()` | Momento reportado por el dispositivo. |
| `latitud` / `longitud` | `numeric(10,7)` | — | Coordenadas GPS. |
| `sincronizado` | `boolean` | NN, `false` | Origen offline pendiente de subida. |
| `creado_en` | `timestamptz` | NN | Auditoría. |

Índices: `ix_actividad_caso`, `ix_actividad_usuario` (`RepoTecnico/db/schema.sql:667-668`).
Ninguna ruta de la API ni servicio referencia esta tabla: **pendiente de
confirmar** dónde se persisten las actividades en la v1.

#### `evidencia` — registro fotográfico

Propósito: respaldo fotográfico de una actividad con GPS y marca temporal
(`RepoTecnico/db/schema.sql:515-528`; **sin modelo ORM**).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_evidencia` | `bigserial` | PK, NN | Identificador. |
| `id_actividad` | `bigint` | FK→`actividad` `ON DELETE CASCADE`, NN | Actividad respaldada. |
| `tipo` | `varchar(20)` | NN | `POTENCIA`/`NAVEGACION`/`DEMO`. |
| `serial_imagen` | `varchar(160)` | UQ, NN | Clave lógica: caso + avería + tipo + fecha/hora. |
| `ruta_local` / `ruta_remota` | `varchar(255)` | — | Ruta en el dispositivo y objeto remoto. |
| `latitud` / `longitud` | `numeric(10,7)` | — | Coordenadas de la captura. |
| `fecha_hora` | `timestamptz` | NN | Marca de la captura. |
| `origen_camara` | `boolean` | NN, `true` | `false` = galería, considerado inválido. |
| `creado_en` | `timestamptz` | NN | Auditoría. |

Índice `ix_evidencia_actividad` (`RepoTecnico/db/schema.sql:669`). La única mención en el
código es un docstring de `app/api/routes_health.py:62`, que cita la
«evidencia del esquema desplegado» al contar entidades: **pendiente de
confirmar** el flujo de carga de imágenes.

#### `incidente` — novedades de flota o herramienta

Propósito: reportar incidentes de flota o herramienta asociados a una actividad
(`RepoTecnico/db/schema.sql:530-542`; **sin modelo ORM**).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_incidente` | `bigserial` | PK, NN | Identificador. |
| `tipo` | `varchar(20)` | NN | `FLOTA`/`HERRAMIENTA`. |
| `id_flota` | `integer` | FK→`flota` | Vehículo afectado. |
| `id_herramienta` | `integer` | FK→`herramienta` | Herramienta afectada. |
| `descripcion` | `text` | — | Detalle del incidente. |
| `id_actividad` | `bigint` | FK→`actividad` `ON DELETE SET NULL` | Actividad que lo reporta. |
| `estado` | `varchar(20)` | NN, `REPORTADO` | `REPORTADO`/`EN_REVISION`/`RESUELTO`. |
| `creado_en` | `timestamptz` | NN | Auditoría. |

Restricción `ck_incidente_referencia`: debe existir `id_flota` o
`id_herramienta` (`RepoTecnico/db/schema.sql:540-541`).

#### `sincronizacion` — paquetes ZIP del dispositivo

Propósito: historial de sincronizaciones con conteos y archivo ZIP
(`RepoTecnico/db/schema.sql:557-570`; **sin modelo ORM**).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_sync` | `bigserial` | PK, NN | Identificador. |
| `id_dispositivo` | `bigint` | FK→`dispositivo_seguridad` `ON DELETE SET NULL` | Dispositivo. |
| `id_tecnico` | `integer` | FK→`tecnico` | Técnico. |
| `inicio` / `fin` | `timestamptz` | `inicio` NN | Ventana de sincronización. |
| `casos_descargados` / `actividades_subidas` / `evidencias_subidas` | `integer` | NN, `0` | Conteos del intercambio. |
| `archivo_zip` | `varchar(160)` | — | Nombre `central+cuadrilla+fecha`. |
| `estado` | `varchar(20)` | NN, `EN_PROCESO` | `EN_PROCESO`/`OK`/`ERROR`. |
| `detalle_json` | `jsonb` | — | Detalle por caso. |

### Especiales

#### `solicitante` — personal externo

Propósito: unidad, nombre y contacto de quien reporta un caso especial
(`RepoTecnico/db/schema.sql:367-374`; ORM `app/models/especiales_entities.py:22-32`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_solicitante` | `serial` | PK, NN | Identificador. |
| `unidad` | `varchar(120)` | NN | Unidad/área de la empresa. |
| `nombre` | `varchar(120)` | NN | Nombre del contacto (PII). |
| `contacto` | `varchar(60)` | NN | Teléfono/correo (PII). |
| `canal` | `varchar(20)` | — | `TELEGRAM`/`MCP_IA`/`MANUAL`/`CORREO`. |
| `creado_en` | `timestamptz` | NN | Auditoría. |

#### `caso_especial` — referidos, empresas y gobiernos

Propósito: subtipo de caso sin `id_averia` de origen
(`RepoTecnico/db/schema.sql:376-393`; ORM `app/models/especiales_entities.py:35-51`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_caso_especial` | `serial` | PK, NN | Identificador. |
| `id_caso` | `bigint` | FK→`caso` `ON DELETE CASCADE` | Caso vinculado si existe. |
| `id_solicitante` | `integer` | FK→`solicitante` | Quién lo reporta. |
| `clasificacion` | `varchar(20)` | NN | `REFERIDO`/`EMPRESA`/`GOBIERNO`. |
| `tipo_actividad` | `varchar(20)` | NN | `REPARACION`/`CONSTRUCCION`. |
| `prioridad` | `varchar(20)` | NN, `MEDIA` | `ALTA`/`MEDIA`/`BAJA`. |
| `tiene_id_averia` | `boolean` | NN, `false` | Indica si dispone de avería de origen. |
| `descripcion` | `text` | — | Detalle de la solicitud. |
| `requiere_informe` | `boolean` | NN, `true` | Exige informe de atención. |
| `estado` | `varchar(20)` | NN, `ABIERTO` | `ABIERTO`/`EN_PROCESO`/`ATENDIDO`/`CERRADO`. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

#### `seguimiento` — derivación a otras instancias

Propósito: registrar el paso de un caso a otra cola/instancia y su retorno
(`RepoTecnico/db/schema.sql:407-418`; ORM `app/models/especiales_entities.py:73-90`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_seguimiento` | `bigserial` | PK, NN | Identificador. |
| `id_caso` | `bigint` | FK→`caso` `ON DELETE CASCADE`, NN | Caso derivado. |
| `instancia_destino` | `varchar(120)` | NN | Cola o área destino. |
| `motivo` | `text` | — | Motivo de la derivación. |
| `fecha_envio` | `timestamptz` | NN, `now()` | Fecha de envío. |
| `fecha_retorno` | `timestamptz` | — | Fecha de retorno. |
| `estado` | `varchar(20)` | NN, `EN_COLA` | `EN_COLA`/`RESUELTO`/`DEVUELTO`. |
| `observacion` | `text` | — | Notas. |
| `usuario` | `varchar(20)` | FK→`usuario.p00` | Autor. |

Índice `ix_seguimiento_caso` (`RepoTecnico/db/schema.sql:671`).

#### `cita` — agenda de contacto/atención

Propósito: citas por caso o caso especial, **sin solapamiento** por cuadrilla
(RF-12) (`RepoTecnico/db/schema.sql:421-435`; ORM `app/models/especiales_entities.py:54-70`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_cita` | `bigserial` | PK, NN | Identificador. |
| `id_caso` | `bigint` | FK→`caso` `ON DELETE CASCADE` | Caso citado. |
| `id_caso_especial` | `integer` | FK→`caso_especial` `ON DELETE CASCADE` | Caso especial citado. |
| `id_cuadrilla` | `integer` | FK→`cuadrilla` | Cuadrilla que atiende. |
| `fecha_hora` | `timestamptz` | NN | Fecha y hora de la cita. |
| `tipo` | `varchar(20)` | NN, `CONTACTO` | `CONTACTO`/`ATENCION`. |
| `estado` | `varchar(20)` | NN, `PROPUESTA` | `PROPUESTA`/`CONFIRMADA`/`CUMPLIDA`/`REPROGRAMADA`/`DIFERIDA`/`CANCELADA`. |
| `observacion` | `text` | — | Notas. |
| `creado_por` | `varchar(20)` | FK→`usuario.p00` | Autor. |
| `creado_en` | `timestamptz` | NN | Auditoría. |

Restricción `ck_cita_referencia`: debe existir `id_caso` o `id_caso_especial`
(`RepoTecnico/db/schema.sql:434`). Índice `ix_cita_cuadrilla_fecha ON cita (id_cuadrilla, fecha_hora)`
(`RepoTecnico/db/schema.sql:670`).

### Despacho

#### `despacho` — cabecera diaria por cuadrilla

Propósito: despacho de un día para una cuadrilla, con canal y hora de reporte
(`RepoTecnico/db/schema.sql:441-456`; ORM `app/models/despacho_entities.py:24-44`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_despacho` | `bigserial` | PK, NN | Identificador. |
| `id_central` | `integer` | FK→`central`, NN | Central que lo genera. |
| `fecha` | `date` | NN | Día del despacho. |
| `id_cuadrilla` | `integer` | FK→`cuadrilla`, NN | Cuadrilla destino. |
| `estado` | `varchar(20)` | NN, `BORRADOR` | `BORRADOR`/`PUBLICADO`/`CERRADO`. |
| `generado_auto` | `boolean` | NN, `false` | Propuesto automáticamente. |
| `enviado_canal` | `varchar(20)` | — | `TELEGRAM`/`CORREO`. |
| `enviado_en` | `timestamptz` | — | Momento del envío. |
| `reporte_produccion_en` | `timestamptz` | — | Cierre 04:00 p.m. (RF-27). |
| `usuario_crea` | `varchar(20)` | FK→`usuario.p00` | Autor. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

Restricción `UNIQUE (fecha, id_cuadrilla)`: un despacho por cuadrilla y día
(`RepoTecnico/db/schema.sql:455`). Tabla sujeta a RLS (`RepoTecnico/db/schema.sql:704-709`).

#### `despacho_caso` — detalle de casos asignados

Propósito: casos incluidos en un despacho con orden de visita y tipo de
asignación (`RepoTecnico/db/schema.sql:458-471`; ORM `app/models/despacho_entities.py:47-65`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_despacho_caso` | `bigserial` | PK, NN | Identificador. |
| `id_despacho` | `bigint` | FK→`despacho` `ON DELETE CASCADE`, NN | Despacho. |
| `id_caso` | `bigint` | FK→`caso` `ON DELETE CASCADE`, NN | Caso asignado. |
| `id_sector` | `integer` | FK→`sector` | Sector que agrupa la visita. |
| `orden_visita` | `smallint` | — | Orden de recorrido. |
| `tipo_asignacion` | `varchar(20)` | — | `REPARACION`/`CONSTRUCCION`/`REFERIDO`/`EMPRESA`/`FALLA_MASIVA`. |
| `estado` | `varchar(20)` | NN, `ASIGNADO` | `ASIGNADO`/`GESTIONADO`/`CERRADO`/`CITADO`/`DIFERIDO`. |
| `observacion` | `text` | — | Notas. |

Restricción `UNIQUE (id_despacho, id_caso)`: un caso una sola vez por despacho
(`RepoTecnico/db/schema.sql:470`). Índices `ix_despacho_caso_caso` e `ix_despacho_caso_despacho`
(`RepoTecnico/db/schema.sql:665-666`).

#### `falla_masiva` — evento de falla por concentración

Propósito: agrupar casos concentrados y documentar su planificación
(`RepoTecnico/db/schema.sql:473-490`; ORM `app/models/despacho_entities.py:85-103`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_falla` | `bigserial` | PK, NN | Identificador. |
| `id_central` | `integer` | FK→`central`, NN | Central que la registra. |
| `clave_concentracion` | `varchar(120)` | — | Clave del grupo (ej. `olt:pde-olt-00`) para detección idempotente. |
| `descripcion` | `text` | NN | Descripción del evento. |
| `fecha_deteccion` | `timestamptz` | NN, `now()` | Momento de la detección. |
| `origen` | `varchar(20)` | NN, `AUTOMATICA` | `AUTOMATICA`/`REPORTE_TECNICO`/`MCP`. |
| `id_sector` | `integer` | FK→`sector` | Sector afectado. |
| `id_cuadrilla` | `integer` | FK→`cuadrilla` | Cuadrilla asignada. |
| `estado` | `varchar(20)` | NN, `DETECTADA` | `DETECTADA`/`PLANIFICADA`/`ATENDIDA`/`CERRADA`. |
| `planificacion` | `text` | — | Plan de atención. |
| `reporte_simple` | `text` | — | Reporte resumido. |
| `planificada_en` | `timestamptz` | — | Cuándo se documentó la planificación (RF-17). |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

Parámetros asociados en `configuracion`: `fallas.activo`, `fallas.umbral_casos`,
`fallas.ventana_horas` y `fallas.campo_concentracion`
(`RepoTecnico/db/schema.sql:788-791`).

### Insumos (v2)

#### `insumo` — catálogo de materiales

Propósito: catálogo de insumos por central (v2, RF-05)
(`RepoTecnico/db/schema.sql:576-586`; **sin modelo ORM**).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_insumo` | `serial` | PK, NN | Identificador. |
| `id_central` | `integer` | FK→`central` | Central que lo cataloga. |
| `codigo` | `varchar(40)` | UQ, NN | Código del insumo. |
| `nombre` | `varchar(120)` | NN | Nombre. |
| `unidad_medida` | `varchar(20)` | NN, `UNIDAD` | Unidad de medida. |
| `stock_minimo` | `numeric(12,2)` | NN, `0` | Umbral de reposición. |
| `activo` | `boolean` | NN, `true` | Insumo vigente. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

#### `orden_material` — solicitud de material

Propósito: cabecera de una orden de material (RF-18)
(`RepoTecnico/db/schema.sql:588-599`; ORM mínimo `app/models/insumos_entities.py:13-24`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_orden` | `bigserial` | PK, NN | Identificador. |
| `id_caso` | `bigint` | FK→`caso` | Caso que la origina. |
| `id_cuadrilla` | `integer` | FK→`cuadrilla` | Cuadrilla solicitante. |
| `solicitante_usuario` | `varchar(20)` | FK→`usuario.p00` | Usuario solicitante. |
| `estado` | `varchar(20)` | NN, `SOLICITADA` | `SOLICITADA`/`APROBADA`/`ENTREGADA`/`RECHAZADA`. |
| `fecha` | `timestamptz` | NN, `now()` | Fecha de la solicitud. |
| `observacion` | `text` | — | Notas. |
| `creado_en` / `actualizado_en` | `timestamptz` | NN | Auditoría. |

#### `orden_material_detalle` — renglones de la orden

Propósito: insumos y cantidades de cada orden
(`RepoTecnico/db/schema.sql:601-608`; **sin modelo ORM**).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_orden_detalle` | `bigserial` | PK, NN | Identificador. |
| `id_orden` | `bigint` | FK→`orden_material` `ON DELETE CASCADE`, NN | Orden padre. |
| `id_insumo` | `integer` | FK→`insumo`, NN | Insumo. |
| `cantidad_solicitada` | `numeric(12,2)` | NN, `CHECK > 0` | Cantidad pedida. |
| `cantidad_entregada` | `numeric(12,2)` | NN, `0` | Cantidad entregada. |

Restricción `UNIQUE (id_orden, id_insumo)` (`RepoTecnico/db/schema.sql:607`).

#### `inventario_movimiento` — ingresos, egresos y ajustes

Propósito: kardex de movimientos de inventario
(`RepoTecnico/db/schema.sql:610-620`; **sin modelo ORM**).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_mov` | `bigserial` | PK, NN | Identificador. |
| `id_insumo` | `integer` | FK→`insumo`, NN | Insumo movido. |
| `tipo` | `varchar(20)` | NN | `INGRESO`/`EGRESO`/`AJUSTE`. |
| `cantidad` | `numeric(12,2)` | NN, `CHECK > 0` | Cantidad del movimiento. |
| `id_orden` | `bigint` | FK→`orden_material` | Orden que lo genera. |
| `id_tecnico` | `integer` | FK→`tecnico` | Técnico que recibe. |
| `fecha` | `timestamptz` | NN, `now()` | Fecha del movimiento. |
| `usuario` | `varchar(20)` | FK→`usuario.p00` | Usuario que registra. |
| `observacion` | `text` | — | Notas. |

El módulo de insumos corresponde a la **v2** (`app/models/insumos_entities.py:1`):
no se encontraron rutas ni servicios que operen estas cuatro tablas en la v1.

### Notificaciones

#### `notificacion` — bandeja de salida (outbox)

Propósito: mensajes por Telegram, correo o MCP con reintentos y backoff
(patrón *outbox*, RNF-20) (`RepoTecnico/db/schema.sql:626-640`;
ORM `app/models/despacho_entities.py:68-82`).

| Campo | Tipo | Clave / Nulo | Descripción |
|---|---|---|---|
| `id_notificacion` | `bigserial` | PK, NN | Identificador. |
| `canal` | `varchar(20)` | NN | `TELEGRAM`/`CORREO`/`MCP_IA`. |
| `destinatario` | `varchar(160)` | — | Destino (PII cuando es correo). |
| `asunto` | `varchar(200)` | — | Asunto. |
| `cuerpo` | `text` | — | Cuerpo del mensaje. |
| `id_caso` | `bigint` | FK→`caso` `ON DELETE SET NULL` | Caso notificado. |
| `estado` | `varchar(20)` | NN, `PENDIENTE` | `PENDIENTE`/`ENVIADO`/`FALLIDO`. |
| `error` | `text` | — | Último error de envío. |
| `enviado_en` | `timestamptz` | — | Momento del envío efectivo. |
| `intentos` | `smallint` | NN, `0` | Reintentos consumidos. |
| `proximo_intento` | `timestamptz` | — | Próximo intento (backoff). |
| `creado_en` | `timestamptz` | NN | Auditoría. |

Índice `ix_notificacion_caso` (`RepoTecnico/db/schema.sql:676`). El procesamiento de la
bandeja se apoya en `app/services/outbox.py` y el límite de reintentos en el
parámetro `outbox.max_intentos` (`RepoTecnico/db/schema.sql:792`). En producción,
Telegram y correo **aún no tienen credenciales**: las notificaciones quedan en
estado `PENDIENTE` (hoja de hechos de verificación).

## Campos PII

### inventario y clasificación (RNF-18)

RNF-18 exige «inventario y clasificación de PII; minimización; retención por
entidad; enmascaramiento de teléfono, dirección y serial para roles no
autorizados» (`RepoTecnico/requerimientos.md:197`). El inventario verificado
sobre el DDL es:

| Tabla | Campos con PII | Clasificación propuesta |
|---|---|---|
| `caso` | `telefono`, `nombre_cliente`, `direccion`, `persona_reporta`, `contacto_cliente`, `telefono_oficina`, `telefono_movil`, `serial`, `informacion` (texto libre) | Confidencial |
| `tecnico` | `cedula`, `telefono`, `correo`, `nombre`, `apellido` | Confidencial (personal interno) |
| `usuario` | `correo`, `clave_hash` (secreto de autenticación) | Restringido |
| `solicitante` | `nombre`, `contacto` | Confidencial |
| `actividad` | `reporte_corto` (texto libre), `latitud`, `longitud` | Confidencial (geolocalización) |
| `evidencia` | `ruta_local`, `ruta_remota`, `latitud`, `longitud`, `fecha_hora`, `serial_imagen` | Confidencial (imagen + ubicación) |
| `notificacion` | `destinatario`, `cuerpo` | Confidencial |
| `auditoria` | `datos_antes`, `datos_despues`, `ip`, `usuario` | Restringido |
| `dispositivo_seguridad` | `palabras_hash`, `clave_privada_ref`, `documento_cifrado` | Secreto (sin PII en claro) |
| `falla_masiva` | `descripcion`, `planificacion`, `reporte_simple` (pueden citar direcciones) | Interno |

Estado de la minimización y el enmascaramiento:
`schema.sql` no cifra columnas a nivel de base (el cifrado en reposo depende de
CMEK, pendiente según D-26); la bandera `usuario.bloqueo_cliente`
(`RepoTecnico/db/schema.sql:187`) está prevista para «ocultar datos del
cliente», pero **no se encontró código de enmascaramiento** en `app/`
(búsqueda de `mask`/`enmascar` sin resultados): **pendiente de confirmar** su
implementación. El diccionario de origen describe `clave_hash` como
«bcrypt/argon2» (`RepoTecnico/diccionario_datos.md:137`); el algoritmo real es **Argon2id**
(`app/core/security.py:16-25`).

### retención por entidad (requerimientos.md:212-225)

| Entidad | Contiene PII | Retención propuesta | Acción al vencer |
|---|---|---|---|
| `caso` | Sí | 5 años | Anonimizar y archivar |
| `actividad` | Sí | 5 años | Anonimizar |
| `evidencia` | Sí | 2 años | Eliminar imagen y metadatos |
| `auditoria` | Sí | 3 años | Archivar sin PII |
| `notificacion` | Sí | 1 año | Eliminar |
| `solicitante` | Sí | 5 años | Anonimizar |
| `dispositivo_seguridad` | No (hashes) | Mientras la cuenta esté activa | Eliminar con la cuenta |
| `inventario_movimiento` / `orden_material` (v2) | No | 5 años | Archivar |

Los plazos son **propuesta** y deben validarse con CANTV y asesoría legal
(`RepoTecnico/requerimientos.md:225`). Para la v1, el riesgo aceptado D-26
indica que la instancia compartida no cumple RNF-16/SSL obligatorio y que **no
se cargan datos reales de producción** hasta que exista respaldo
(`RepoTecnico/requerimientos.md:206-210`).

## Fuentes

### `RepoTecnico/diccionario_datos.md`

Documento de Fase 1 (Borrador v0.2, «sujeto a validación») con 33 entidades
listadas en su inventario (`RepoTecnico/diccionario_datos.md:36-70`) y el mapeo posicional
del CSV de 80 columnas a 49 campos destino (`RepoTecnico/diccionario_datos.md:230-297`).
Aporta la justificación funcional de cada entidad, los códigos de requerimiento
asociados y las cinco dudas abiertas (`RepoTecnico/diccionario_datos.md:480-494`).

### `RepoTecnico/db/schema.sql`

Fuente normativa de la estructura física: 35 tablas, 2 extensiones, 2 funciones
(`set_actualizado_en`, `generar_id_averia_ref`), 1 secuencia (`seq_caso_ref`),
21 objetos de índice, 2 políticas RLS, 14 disparadores y las semillas
idempotentes (`RepoTecnico/db/schema.sql:18-799`). Es el archivo que se aplica
con `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f RepoTecnico/db/schema.sql`
(`RepoTecnico/db/schema.sql:12-15`).

### Cobertura del ORM (`app/models/`)

El ORM mapea 27 tablas mediante 6 módulos
(`app/models/__init__.py:1-17`): `entities.py` (rol, central, tecnico, usuario,
dispositivo_seguridad), `caso_entities.py` (ingesta_lote, caso,
caso_estado_hist), `config_entities.py` (sector, sector_direccion, flota,
herramienta, cuadrilla, cuadrilla_tecnico, cuadrilla_herramienta, causa,
catalogo_metodo, configuracion), `despacho_entities.py` (despacho,
despacho_caso, notificacion, falla_masiva), `especiales_entities.py`
(solicitante, caso_especial, cita, seguimiento) e `insumos_entities.py`
(orden_material). Las ocho tablas sin modelo son `actividad`, `evidencia`,
`incidente`, `sincronizacion`, `insumo`, `orden_material_detalle`,
`inventario_movimiento` y `auditoria`; una búsqueda en `app/**/*.py` confirma
que tampoco son referenciadas por SQL directo. Es decir, en la v1 esas tablas
existen en la base pero ningún flujo de la aplicación las escribe:
**pendiente de confirmar** si corresponden a módulos diferidos (app móvil y
v2 de insumos) o a trabajo aún no implementado.

### Divergencias detectadas

| # | Tema | `diccionario_datos.md` | Implementación real | Referencia |
|---|---|---|---|---|
| 1 | Tipo de `despacho.id_despacho` | `serial` | `bigserial` | `RepoTecnico/diccionario_datos.md:368` vs `RepoTecnico/db/schema.sql:442` |
| 2 | Tipo de `cita.id_cita` | `serial` | `bigserial` | `RepoTecnico/diccionario_datos.md:351` vs `RepoTecnico/db/schema.sql:422` |
| 3 | Hash de clave | «bcrypt/argon2» | Argon2id | `RepoTecnico/diccionario_datos.md:137` vs `app/core/security.py:16-25` |
| 4 | Dominios de `catalogo_metodo` | `CIERRE`/`ENRUTE`/`DIFERIDO` | Incluye `CONTACTO` | `RepoTecnico/diccionario_datos.md:446` vs `RepoTecnico/db/schema.sql:90-91` |
| 5 | Códigos de `rol` | `SUPERVISOR`, `TECNICO`, `ADMIN` | Además `SUPER` (bypass total) | `RepoTecnico/diccionario_datos.md:149` vs `RepoTecnico/db/schema.sql:736-741`, `app/api/deps.py:20,65` |
| 6 | Columna `actividad.metodo` | Listada como `varchar(20)` | No existe; el método se referencia con `id_metodo` (FK) | `RepoTecnico/diccionario_datos.md:407-408` vs `RepoTecnico/db/schema.sql:506` |
| 7 | `cita.estado` | Sin `CANCELADA` | Incluye `CANCELADA` | `RepoTecnico/diccionario_datos.md:356` vs `RepoTecnico/db/schema.sql:429-430` |
| 8 | `caso_especial.estado` | Sin enumerado | `CHECK` con 4 estados | `RepoTecnico/diccionario_datos.md:337` vs `RepoTecnico/db/schema.sql:389-390` |
| 9 | Nº de columnas de `caso` | «49 campos destino» (mapeo CSV) | 63 columnas físicas | `diccionario_datos.md:8,238` vs `RepoTecnico/db/schema.sql:286-363`, `app/models/caso_entities.py:42` |
| 10 | Tipo de `ingesta_lote.fecha_archivo` | No precisado | `date` en DDL; `DateTime` en el ORM | `RepoTecnico/db/schema.sql:270` vs `app/models/caso_entities.py:28` |
| 11 | Longitud de `caso.extra` | No precisada | `varchar(120)` en DDL; `String(40)` en el ORM | `RepoTecnico/db/schema.sql:343` vs `app/models/caso_entities.py:98` |
| 12 | Disparador de `dispositivo_seguridad` | No aplica | Tiene `actualizado_en` pero sin disparador | `RepoTecnico/db/schema.sql:553` vs `RepoTecnico/db/schema.sql:717-720` |

Las divergencias 10 y 11 son de **mapeo ORM**, no del DDL: al no usar migraciones
Alembic en el baseline actual, un `DateTime` sobre una columna `date` puede
producir conversiones implícitas de zona horaria. Se recomienda alinear el
modelo con el DDL o versionar la migración correspondiente; queda **pendiente de
confirmar** cuál de los dos es la intención definitiva.
