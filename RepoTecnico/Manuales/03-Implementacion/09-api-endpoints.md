# API de GGTO — Inventario de Endpoints

> Documento técnico de implementación. Describe la superficie HTTP real de GGTO
> (CANTV C.A., Central Francisco Salias / Área 4): prefijos, autenticación, el
> inventario completo de operaciones por archivo de rutas, los códigos de
> respuesta y las convenciones transversales. Cada afirmación se respalda con
> una referencia `ruta:línea` verificada en el código fuente.

## Visión general

La API es una aplicación **FastAPI** construida en `app/main.py`. La instancia se
declara con título, versión y descripción tomados de la configuración
(`app/main.py:38-47`), y monta nueve routers de negocio en un orden explícito:
salud, autenticación, configuración, ingesta, casos, despachos, especiales,
monitoreo y alertas (`app/main.py:77-85`). Al final se monta la SPA React para no
tapar las rutas de la API (`app/main.py:88-105`).

El middleware de observabilidad asigna un `request-id` a cada petición y registra
su duración (`app/main.py:49-65`); CORS se configura desde `cors_origins`
(`app/main.py:69-75`).

### Prefijo /api/v1

Todas las rutas de negocio se publican bajo el prefijo de versión **`/api/v1`**.
El prefijo se declara de dos maneras según el archivo:

| Archivo de rutas | Prefijo declarado | Línea |
|---|---|---|
| `app/api/routes_health.py` | sin prefijo (rutas absolutas) | `app/api/routes_health.py:14` |
| `app/api/routes_auth.py` | `/api/v1/auth` | `app/api/routes_auth.py:35` |
| `app/api/routes_config.py` | `/api/v1` | `app/api/routes_config.py:57` |
| `app/api/routes_ingesta.py` | `/api/v1/ingesta` | `app/api/routes_ingesta.py:21` |
| `app/api/routes_casos.py` | `/api/v1/casos` | `app/api/routes_casos.py:24` |
| `app/api/routes_despachos.py` | `/api/v1/despachos` | `app/api/routes_despachos.py:41` |
| `app/api/routes_especiales.py` | `/api/v1` | `app/api/routes_especiales.py:40` |
| `app/api/routes_monitoreo.py` | `/api/v1` | `app/api/routes_monitoreo.py:17` |
| `app/api/routes_alertas.py` | `/api/v1` | `app/api/routes_alertas.py:30` |

`routes_health.py` es la única excepción: declara rutas absolutas porque expone
`/health` y `/ready` fuera del espacio versionado (`app/api/routes_health.py:28,34`).
La prueba de contrato exige que ninguna ruta que empiece por `/api/` quede sin
versión (`app/tests/test_contratos.py:27-29`).

### Convención de autenticación Bearer

La autenticación se resuelve con el esquema **HTTP Bearer** de FastAPI, declarado
como dependencia reutilizable en `app/api/deps.py:17`
(`bearer = HTTPBearer(auto_error=False)`). El cliente debe enviar la cabecera:

```
Authorization: Bearer <token>
```

El token es un **JWT HS256** con las reclamaciones `sub` (P00 del usuario), `rol`,
`exp`, `iat` y `jti` (`app/core/security.py:56-72`), con vigencia por defecto de
**480 minutos (8 h)** (`app/core/config.py:30`). La decodificación valida firma y
expiración (`app/core/security.py:75-78`).

La dependencia `get_current_user` (`app/api/deps.py:29-49`) realiza la secuencia:
sin credencial → 401; token inválido o expirado → 401; P00 inexistente o usuario
inactivo → 401; usuario bloqueado → 423. La respuesta 401 incluye la cabecera
`WWW-Authenticate: Bearer` (`app/api/deps.py:22-26`).

La SPA consume la API con el mismo esquema: el token se guarda en `localStorage` y
se adjunta como `Bearer` en cada llamada (`app/web/src/api/client.ts:193,237`).

### Relación 79 paths / 109 operaciones

El esquema OpenAPI publicado (`app.openapi()`) reporta **79 rutas (*paths*)** y
**109 operaciones** (combinación método + path). La diferencia se explica porque
**26 paths comparten varios métodos**; cada path adicional con *n* métodos aporta
*n − 1* operaciones extra, en total **30 operaciones extra** (79 + 30 = 109). Cuatro de
esos paths compartidos tienen tres métodos (`/central/{id_central}`, `/sectores/{id_sector}`,
`/tecnicos/{id_tecnico}` y `/flota/{id_flota}`), lo que explica que 26 paths aporten 30
operaciones extra. Las cuatro rutas incorporadas por el ciclo **D-66**
(`GET /api/v1/despachos/proceso`, `PUT /api/v1/despachos/asignacion`,
`POST /api/v1/despachos/procesar` y `POST /api/v1/ingesta/sectorizar-pendientes`) y las
**dos incorporadas por D-67** (`GET /api/v1/auth/primer-acceso` y
`POST /api/v1/auth/palabras/{p00}/regenerar`) son de un solo método, por lo que no alteran
el número de paths compartidos.

Los paths compartidos verificados son 26, entre ellos:

| Path | Métodos | Path | Métodos |
|---|---|---|---|
| `/api/v1/casos` | GET, POST | `/api/v1/central` | GET, POST |
| `/api/v1/casos/{id_caso}` | GET, PATCH | `/api/v1/central/{id_central}` | GET, PATCH, DELETE |
| `/api/v1/despachos` | GET, POST | `/api/v1/sectores` | GET, POST |
| `/api/v1/despachos/fallas-masivas` | GET, POST | `/api/v1/sectores/{id_sector}` | GET, PATCH, DELETE |
| `/api/v1/fallas-masivas` | GET, POST | `/api/v1/tecnicos` | GET, POST |
| `/api/v1/citas` | GET, POST | `/api/v1/tecnicos/{id_tecnico}` | GET, PATCH, DELETE |
| `/api/v1/citas/{id_cita}` | PATCH, DELETE | `/api/v1/flota` | GET, POST |
| `/api/v1/casos-especiales` | GET, POST | `/api/v1/cuadrillas` | GET, POST |
| `/api/v1/casos-especiales/{id_caso_especial}` | GET, PATCH | `/api/v1/seguimiento` | GET, POST |
| `/api/v1/solicitantes` | GET, POST | `/api/v1/catalogos/causas` | GET, POST |
| `/api/v1/catalogos/metodos` | GET, POST | `/api/v1/despachos/{id_despacho}` | GET, PATCH |
| `/api/v1/cuadrillas/{id_cuadrilla}` | GET, PATCH | `/api/v1/despachos/{id_despacho}/casos/{id_caso}` | DELETE, PATCH |

Por eso los documentos del proyecto y las pruebas hablaban de **«73 endpoints»**
cuando en realidad se referían a *73 paths*: `RepoTecnico/plan_desarrollo.md:227`
(«73 endpoints OpenAPI»), `RepoTecnico/pruebas/informe_fase4.md:78` y
`RepoTecnico/pruebas/plan_pruebas.md:21`. Esa cifra es **anterior al ciclo D-66**;
tras D-66 y D-67 la superficie vigente es de **79 paths**.

En el código hay **109 decoradores `@router.*`** —uno por operación publicada—.
La cifra de **98 operaciones** que aparece en notas previas del proyecto no
coincide con el código verificado; la diferencia corresponde a las operaciones
que sí existen y que aquel inventario no listaba: las cinco ya documentadas
(`POST /api/v1/auth/setup` — `app/api/routes_auth.py:129`,
`POST /api/v1/sectores/{id_sector}/direcciones` —
`app/api/routes_config.py:201`,
`DELETE /api/v1/sectores/{id_sector}/direcciones/{id_direccion}` —
`app/api/routes_config.py:220`,
`POST /api/v1/cuadrillas/{id_cuadrilla}/integrantes` — `app/api/routes_config.py:471`
y `DELETE /api/v1/cuadrillas/{id_cuadrilla}/integrantes/{id_tecnico}` —
`app/api/routes_config.py:495`), las cuatro del ciclo D-66
(`app/api/routes_despachos.py:177,190,207` y `app/api/routes_ingesta.py:217`) y las dos de
D-67 (`app/api/routes_auth.py:219` y `app/api/routes_auth.py:275`).
La cifra vigente y comprobable es **109 operaciones / 79 paths**; el origen exacto
del conteo de 98 queda **pendiente de confirmar**.

### Documentación OpenAPI en /docs

FastAPI publica por defecto la documentación interactiva en **`/docs`** (Swagger
UI), la alternativa ReDoc en `/redoc` y el esquema crudo en `/openapi.json`. El
endpoint de metadatos devuelve explícitamente esa ruta
(`app/api/routes_health.py:17-25`, campo `"documentacion": "/docs"`). El título y
la versión del esquema provienen de `app_name` y `app_version`
(`app/main.py:39-40`), con versión por defecto **0.9.0** (`app/core/config.py:14`).

Cada router se agrupa en el esquema mediante etiquetas (*tags*): «salud»
(`app/api/routes_health.py:14`), «autenticación» (`app/api/routes_auth.py:35`),
«configuración» (`app/api/routes_config.py:57`), «ingesta»
(`app/api/routes_ingesta.py:21`), «casos» (`app/api/routes_casos.py:24`),
«despacho» (`app/api/routes_despachos.py:41`), «seguimiento y especiales»
(`app/api/routes_especiales.py:40`), «monitoreo y reportes»
(`app/api/routes_monitoreo.py:17`) y «alertas, telegram y mcp»
(`app/api/routes_alertas.py:30`).

Las pruebas de contrato validan que **toda operación tenga `summary`**
(`app/tests/test_contratos.py:41-47`), que toda respuesta declarada tenga
descripción (`:50-57`), que los listados declaren `response_model` (`:60-69`) y
que exista el esquema de seguridad Bearer (`:72-74`).

## Inventario por módulo

A continuación, el inventario completo de las **109 operaciones**, agrupado por
archivo de rutas. La columna «roles» se interpreta así: **Público** = sin token;
**Autenticado** = cualquier usuario con token válido (`get_current_user`);
**ADMIN/SUPERVISOR** = `require_roles("ADMIN", "SUPERVISOR")`, con **bypass total
del rol SUPER** (`app/api/deps.py:52-72`). La columna «línea» apunta al decorador.

### Salud y metadatos (app/api/routes_health.py)

Cuatro operaciones; tres son públicas y una exige token.

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/info` | Metadatos del servicio (nombre, versión, entorno, ruta de docs) | Público | `app/api/routes_health.py:17` |
| GET | `/health` | *Liveness*: no toca la base de datos | Público | `app/api/routes_health.py:28` |
| GET | `/ready` | *Readiness*: versión de PostgreSQL, base, usuario y nº de tablas del esquema | Público | `app/api/routes_health.py:34` |
| GET | `/api/v1/resumen` | Conteo de entidades principales (centrales, roles, cuadrillas, causas, parámetros) | Autenticado | `app/api/routes_health.py:60` |

`/ready` devuelve 503 si la base no responde (`app/api/routes_health.py:56-57`) y
consulta `information_schema.tables` del esquema `public`
(`app/api/routes_health.py:40-48`). `/api/v1/resumen` es la evidencia del esquema
desplegado (`app/api/routes_health.py:62-78`).

### Autenticación (app/api/routes_auth.py)

**Siete operaciones.** Cinco son públicas por diseño (login, setup, `primer-acceso`,
`unlock` y `reset-password`); `me` exige token y `regenerar` exige el rol `SUPER`. La
decisión de P00 + clave con bloqueo a los 3 intentos y 12 palabras de seguridad está en
`RepoTecnico/requerimientos.md:255-256`.

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Iniciar sesión con P00 + clave; emite JWT | Público | `app/api/routes_auth.py:81` |
| GET | `/api/v1/auth/me` | Datos del usuario autenticado (P00, correo, rol, central, nombre) | Autenticado | `app/api/routes_auth.py:124` |
| POST | `/api/v1/auth/setup` | Primer acceso: **crea la cuenta**, fija la clave y genera 12 palabras (**D-67**) | Público | `app/api/routes_auth.py:129` |
| GET | `/api/v1/auth/primer-acceso` | Comprueba si el P00 está registrado y su `estado` (**D-67**) | Público | `app/api/routes_auth.py:219` |
| POST | `/api/v1/auth/palabras/{p00}/regenerar` | Super Usuario: genera 12 palabras nuevas y desbloquea (**D-67**) | SUPER | `app/api/routes_auth.py:275` |
| POST | `/api/v1/auth/unlock` | Desbloquear la cuenta con 3 de las 12 palabras | Público | `app/api/routes_auth.py:330` |
| POST | `/api/v1/auth/reset-password` | Restablecer la clave con 3 de las 12 palabras | Público | `app/api/routes_auth.py:349` |

Detalles verificados de `login`: el límite de intentos se aplica por `p00|IP`
(`app/api/routes_auth.py:84-85`); si el P00 no existe se devuelve un mensaje
genérico para no revelar su existencia (`app/api/routes_auth.py:88-90`); un usuario
inactivo recibe 403 (`:91-92`) y uno bloqueado, 423 (`:93-97`). Cada fallo incrementa
`intentos_fallidos` y devuelve la cabecera `X-Intentos-Restantes`
(`:100-111`). Un login correcto reinicia el contador y emite el token
(`:113-121`).

Detalles de **D-67** verificados en `setup`: si la clave y su confirmación no coinciden
responde 422 (`app/api/routes_auth.py:143-144`); si la cuenta ya tiene `palabras_hash`
responde 409 (`:146-154`); si el P00 no existe como técnico responde 404 (`:156-162`); si el
técnico no está `ACTIVO` responde 409 (`:163-167`); crea el `Usuario` con rol `TECNICO`, el
`id_tecnico` y la central (`:168-181`); versiona el dispositivo de seguridad (`:192-198`) y
registra `ALTA_PRIMER_ACCESO` en `auditoria` (`:206-214`). `primer-acceso` devuelve
`INEXISTENTE`/`BLOQUEADO`/`ACTIVO`/`INACTIVO`/`PENDIENTE` (`:240-272`) con un *rate limit*
propio de 30/60 s (`:229-230`). `regenerar` exige `require_roles("SUPER")` (`:284`),
incrementa `version` (`:300-310`), desbloquea la cuenta y el dispositivo (`:310-313`) y
escribe `REGENERAR_PALABRAS` en `auditoria` (`:315-325`). `unlock` y `reset-password` validan
3 palabras por posición con `_verificar_palabras` (`app/api/routes_auth.py:66-78`).

### Configuración y catálogos (app/api/routes_config.py)

El módulo más extenso: **35 operaciones**. La lectura queda abierta a cualquier
usuario autenticado y la escritura se reserva a ADMIN y SUPERVISOR
(`app/api/routes_config.py:59-60`). Los borrados son **desactivaciones lógicas**
salvo en direcciones de sector e integrantes de cuadrilla.

#### Central

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/central` | Listar centrales; filtro `solo_activas` | Autenticado | `app/api/routes_config.py:81` |
| POST | `/api/v1/central` | Crear central | ADMIN/SUPERVISOR | `app/api/routes_config.py:93` |
| GET | `/api/v1/central/{id_central}` | Obtener una central | Autenticado | `app/api/routes_config.py:106` |
| PATCH | `/api/v1/central/{id_central}` | Actualizar una central | ADMIN/SUPERVISOR | `app/api/routes_config.py:113` |
| DELETE | `/api/v1/central/{id_central}` | Desactivar (`activa = false`) | ADMIN/SUPERVISOR | `app/api/routes_config.py:128` |

#### Sectores

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/sectores` | Listar sectores; filtros `id_central`, `solo_activos` | Autenticado | `app/api/routes_config.py:140` |
| POST | `/api/v1/sectores` | Crear sector con sus direcciones/patrones | ADMIN/SUPERVISOR | `app/api/routes_config.py:155` |
| GET | `/api/v1/sectores/{id_sector}` | Obtener un sector | Autenticado | `app/api/routes_config.py:170` |
| PATCH | `/api/v1/sectores/{id_sector}` | Actualizar un sector | ADMIN/SUPERVISOR | `app/api/routes_config.py:177` |
| DELETE | `/api/v1/sectores/{id_sector}` | Desactivar (`activo = false`) | ADMIN/SUPERVISOR | `app/api/routes_config.py:192` |
| POST | `/api/v1/sectores/{id_sector}/direcciones` | Agregar patrón de dirección al sector | ADMIN/SUPERVISOR | `app/api/routes_config.py:201` |
| DELETE | `/api/v1/sectores/{id_sector}/direcciones/{id_direccion}` | Eliminar un patrón (borrado físico) | ADMIN/SUPERVISOR | `app/api/routes_config.py:220` |

#### Técnicos

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/tecnicos` | Listar técnicos; filtros `id_central`, `status` | Autenticado | `app/api/routes_config.py:289` |
| POST | `/api/v1/tecnicos` | Crear técnico | ADMIN/SUPERVISOR | `app/api/routes_config.py:304` |
| GET | `/api/v1/tecnicos/{id_tecnico}` | Obtener un técnico | Autenticado | `app/api/routes_config.py:316` |
| PATCH | `/api/v1/tecnicos/{id_tecnico}` | Actualizar un técnico | ADMIN/SUPERVISOR | `app/api/routes_config.py:323` |
| DELETE | `/api/v1/tecnicos/{id_tecnico}` | Desactivar (`status = "INACTIVO"`) | ADMIN/SUPERVISOR | `app/api/routes_config.py:338` |

Las cinco operaciones devuelven `TecnicoOut` con el campo calculado `estado_cuenta`
(`SIN_ALTA`/`BLOQUEADO`/`REQUIERE_CAMBIO`/`INACTIVO`/`ACTIVO`, D-67), resuelto sin N+1 por
`_tecnicos_con_estado` (`app/api/routes_config.py:260-282`).
#### Flota

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/flota` | Listar flota; filtro `id_central` | Autenticado | `app/api/routes_config.py:350` |
| POST | `/api/v1/flota` | Registrar vehículo | ADMIN/SUPERVISOR | `app/api/routes_config.py:362` |
| GET | `/api/v1/flota/{id_flota}` | Obtener un vehículo | Autenticado | `app/api/routes_config.py:374` |
| PATCH | `/api/v1/flota/{id_flota}` | Actualizar un vehículo | ADMIN/SUPERVISOR | `app/api/routes_config.py:381` |
| DELETE | `/api/v1/flota/{id_flota}` | Retirar (`status = "FUERA_SERVICIO"`) | ADMIN/SUPERVISOR | `app/api/routes_config.py:396` |

#### Cuadrillas

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/cuadrillas` | Listar cuadrillas; filtros `id_central`, `solo_activas` | Autenticado | `app/api/routes_config.py:408` |
| POST | `/api/v1/cuadrillas` | Crear cuadrilla con integrantes y herramientas | ADMIN/SUPERVISOR | `app/api/routes_config.py:423` |
| GET | `/api/v1/cuadrillas/{id_cuadrilla}` | Obtener una cuadrilla | Autenticado | `app/api/routes_config.py:449` |
| PATCH | `/api/v1/cuadrillas/{id_cuadrilla}` | Actualizar una cuadrilla | ADMIN/SUPERVISOR | `app/api/routes_config.py:456` |
| POST | `/api/v1/cuadrillas/{id_cuadrilla}/integrantes` | Agregar integrante a la cuadrilla | ADMIN/SUPERVISOR | `app/api/routes_config.py:471` |
| DELETE | `/api/v1/cuadrillas/{id_cuadrilla}/integrantes/{id_tecnico}` | Retirar integrante (fija `hasta`) | ADMIN/SUPERVISOR | `app/api/routes_config.py:495` |

#### Catálogos y parámetros

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/catalogos/causas` | Listar causas; filtro `solo_activos` (por defecto `true`) | Autenticado | `app/api/routes_config.py:522` |
| POST | `/api/v1/catalogos/causas` | Crear causa | ADMIN/SUPERVISOR | `app/api/routes_config.py:534` |
| DELETE | `/api/v1/catalogos/causas/{id_causa}` | Desactivar (`activo = false`) | ADMIN/SUPERVISOR | `app/api/routes_config.py:545` |
| GET | `/api/v1/catalogos/metodos` | Listar métodos; filtro `dominio` | Autenticado | `app/api/routes_config.py:554` |
| POST | `/api/v1/catalogos/metodos` | Crear método | ADMIN/SUPERVISOR | `app/api/routes_config.py:566` |
| GET | `/api/v1/configuracion` | Listar parámetros de `configuracion` | Autenticado | `app/api/routes_config.py:580` |
| PUT | `/api/v1/configuracion/{clave}` | Actualizar valor (y descripción) de un parámetro | ADMIN/SUPERVISOR | `app/api/routes_config.py:585` |

Las creaciones y actualizaciones traducen el `IntegrityError` de SQLAlchemy a
**409** con un mensaje de conflicto (`app/api/routes_config.py:70-75`). Las
creaciones devuelven **201** y los borrados **204** (por ejemplo,
`app/api/routes_config.py:93,128`).

### Ingesta (app/api/routes_ingesta.py)

Cinco operaciones. Las dos de escritura reciben el archivo por
`multipart/form-data` (`archivo`) e id_central opcional por formulario.

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| POST | `/api/v1/ingesta/preview` | Simular la ingesta del CSV sin guardar | ADMIN/SUPERVISOR | `app/api/routes_ingesta.py:124` |
| POST | `/api/v1/ingesta` | Cargar el archivo diario e insertar los casos nuevos | ADMIN/SUPERVISOR | `app/api/routes_ingesta.py:138` |
| GET | `/api/v1/ingesta/lotes` | Historial de cargas (`limite` 1–200, por defecto 50) | Autenticado | `app/api/routes_ingesta.py:194` |
| GET | `/api/v1/ingesta/lotes/{id_lote}` | Detalle de una carga | Autenticado | `app/api/routes_ingesta.py:207` |
| POST | `/api/v1/ingesta/sectorizar-pendientes` | Re-sectorizar los casos con `id_sector` nulo de la central (**D-66**) | ADMIN/SUPERVISOR | `app/api/routes_ingesta.py:217` |

La carga real crea un `IngestaLote` y luego los casos, dejando el lote en `OK` y
los avisos en `detalle_error` (`app/api/routes_ingesta.py:152-179`). Tras insertar,
dispara la detección automática de fallas masivas por concentración
(`app/api/routes_ingesta.py:181-191`). El resumen incluye filas leídas, filas de
la central, casos nuevos, duplicados, descartados, sectorizados, sin sector,
casos de cuadrilla 0 y las **direcciones sin sector** agrupadas por dirección
normalizada (`app/api/routes_ingesta.py:65-118`). El endpoint
`sectorizar-pendientes` aplica los patrones vigentes a los casos de la central con
`id_sector IS NULL` y devuelve `revisados`, `asignados` y `sin_sector`
(`app/api/routes_ingesta.py:217-251`).

### Casos y PANEL (app/api/routes_casos.py)

Seis operaciones. Escritura para ADMIN/SUPERVISOR (`app/api/routes_casos.py:26`);
lectura para cualquier usuario autenticado.

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/casos` | Listado paginado con filtros | Autenticado | `app/api/routes_casos.py:89` |
| GET | `/api/v1/casos/buscar` | Búsqueda rápida de PANEL por `q`, `id_averia` o `telefono` | Autenticado | `app/api/routes_casos.py:172` |
| POST | `/api/v1/casos` | Alta manual (genera `REF-…` si no hay `id_averia`) | ADMIN/SUPERVISOR | `app/api/routes_casos.py:218` |
| GET | `/api/v1/casos/{id_caso}` | Ficha completa del caso | Autenticado | `app/api/routes_casos.py:278` |
| PATCH | `/api/v1/casos/{id_caso}` | Actualizar campos, sector y/o estado | ADMIN/SUPERVISOR | `app/api/routes_casos.py:284` |
| GET | `/api/v1/casos/{id_caso}/historial` | Bitácora de estados del caso | Autenticado | `app/api/routes_casos.py:317` |

El listado admite los filtros `q`, `id_averia`, `telefono`, `id_central`,
`id_sector`, `id_causa`, `id_lote_ingesta`, `estado_actual`, `tipo_caso`,
`categoria`, `origen`, `en_gestion_supervisor`, `es_falla_masiva`, `desde` y
`hasta` (`app/api/routes_casos.py:93-109`). Ordena por `fecha_reporte` descendente
y `id_caso` descendente (`:155`). Cada `CasoOut` del listado añade `sector_nombre`
y los indicadores `pendiente`, `asignado`, `citado` y `gestion`
(`app/api/routes_casos.py:56-83`). El alta manual usa la función de base de datos
`generar_id_averia_ref` (`:231-233`), rechaza duplicados con 409 (`:235-236`) y
registra el estado inicial `NUEVO` en el historial (`:261-269`). Al corregir la
dirección, el sector se recalcula (`:305-307`).

### Despacho (app/api/routes_despachos.py)

Dieciocho operaciones (D-66 incorporó `/proceso`, `/asignacion` y `/procesar`).
Escritura para ADMIN/SUPERVISOR (`app/api/routes_despachos.py:42`).

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| POST | `/api/v1/despachos/propuesta` | Simular el despacho del día (sin guardar) | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:66` |
| POST | `/api/v1/despachos` | Generar y guardar el despacho del día (`reemplazar` opcional) | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:79` |
| GET | `/api/v1/despachos` | Listar despachos por `fecha` e `id_central` | Autenticado | `app/api/routes_despachos.py:120` |
| POST | `/api/v1/despachos/fallas-masivas` | Reportar una falla masiva asociada al sector | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:138` |
| GET | `/api/v1/despachos/fallas-masivas` | Listar las fallas masivas registradas | Autenticado | `app/api/routes_despachos.py:169` |
| GET | `/api/v1/despachos/proceso` | Universo, sectores y asignación por cuadrilla del día (**D-66**) | Autenticado | `app/api/routes_despachos.py:177` |
| PUT | `/api/v1/despachos/asignacion` | Guardar la asignación de sectores por cuadrilla del día (**D-66**) | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:190` |
| POST | `/api/v1/despachos/procesar` | Procesar el despacho con la asignación del día (**D-66**) | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:207` |
| GET | `/api/v1/despachos/{id_despacho}` | Detalle del despacho | Autenticado | `app/api/routes_despachos.py:263` |
| PATCH | `/api/v1/despachos/{id_despacho}` | Publicar o cerrar el despacho | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:270` |
| POST | `/api/v1/despachos/{id_despacho}/casos` | Agregar un caso al despacho | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:293` |
| DELETE | `/api/v1/despachos/{id_despacho}/casos/{id_caso}` | Quitar un caso del despacho | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:338` |
| PATCH | `/api/v1/despachos/{id_despacho}/casos/{id_caso}` | Actualizar el estado del caso en el despacho | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:360` |
| GET | `/api/v1/despachos/{id_despacho}/imprimible` | Ficha de la cuadrilla lista para imprimir (HTML carta) | Autenticado | `app/api/routes_despachos.py:388` |
| GET | `/api/v1/despachos/reporte/produccion` | Reporte de producción del día | Autenticado | `app/api/routes_despachos.py:496` |
| GET | `/api/v1/despachos/{id_despacho}/reporte` | Reporte de producción del despacho | Autenticado | `app/api/routes_despachos.py:509` |
| POST | `/api/v1/despachos/{id_despacho}/enviar` | Enviar la ficha por `TELEGRAM` o `CORREO` | ADMIN/SUPERVISOR | `app/api/routes_despachos.py:521` |
| GET | `/api/v1/despachos/{id_despacho}/notificaciones` | Notificaciones asociadas al despacho | Autenticado | `app/api/routes_despachos.py:575` |

Generar un despacho sin `reemplazar=true` cuando ya existe uno para la fecha
devuelve **409** (`app/api/routes_despachos.py:103-112`). Agregar un caso de
cuadrilla 0 o repetido también devuelve 409 (`:305-313`). Publicar un despacho
fija `enviado_en` si no estaba enviado (`:283-284`). La ficha imprimible es HTML
con `@page size: letter` (`:412-444`, evidencia de RT-08). El envío lee el destino
desde `despacho.destino_<canal>` de la tabla `configuracion` (`:555-557`) y
registra siempre una `Notificacion` (`:560-572`); si el canal no tiene
credenciales, queda `PENDIENTE` (ver `app/services/notificaciones.py:20-22,40-42`).

Las tres operaciones del **proceso de despacho (D-66)** se apoyan en
`app/services/despacho.py`:

- `GET /despachos/proceso` devuelve `ProcesoDespachoOut` con el universo de casos
  (comunes y especiales, más `sin_sector`), los sectores con su total de casos,
  especiales y citados, las cuadrillas con sus `ids_sector`, la asignación
  efectiva y su origen (`GUARDADA`/`PROPUESTA`), los grupos, `sin_asignar`, las
  `reglas` y el `resumen` (`app/api/routes_despachos.py:177-187`;
  `app/services/despacho.py:469-535`).
- `PUT /despachos/asignacion` recibe `AsignacionUpdate` (fecha, central y una
  lista de bloques `{id_cuadrilla, ids_sector}`), reemplaza la asignación del día
  con `guardar_asignacion(...)` (un sector solo puede pertenecer a una cuadrilla
  por día) y devuelve el proceso recalculado
  (`app/api/routes_despachos.py:190-204`; `app/services/despacho.py:233-263`).
- `POST /despachos/procesar` responde **409** si ya hay despachos
  `PUBLICADO`/`CERRADO` para la fecha; si `reemplazar` es verdadero (por defecto)
  borra los borradores del día, guarda la asignación recibida y genera los
  despachos con `guardar_propuesta(...)` (`app/api/routes_despachos.py:207-260`).

### Especiales, agenda y seguimiento (app/api/routes_especiales.py)

Catorce operaciones (empresas/referidos/gobiernos, solicitantes, agenda y
seguimiento). Escritura para ADMIN/SUPERVISOR
(`app/api/routes_especiales.py:41`).

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/solicitantes` | Listar personal externo solicitante | Autenticado | `app/api/routes_especiales.py:50` |
| POST | `/api/v1/solicitantes` | Crear solicitante | ADMIN/SUPERVISOR | `app/api/routes_especiales.py:57` |
| GET | `/api/v1/casos-especiales` | Listar casos especiales; filtros `clasificacion`, `estado`, `prioridad`, `solo_pendientes` | Autenticado | `app/api/routes_especiales.py:103` |
| POST | `/api/v1/casos-especiales` | Ingresar un caso especial (puede crear el caso y el solicitante) | ADMIN/SUPERVISOR | `app/api/routes_especiales.py:124` |
| GET | `/api/v1/casos-especiales/{id_caso_especial}` | Obtener un caso especial | Autenticado | `app/api/routes_especiales.py:173` |
| PATCH | `/api/v1/casos-especiales/{id_caso_especial}` | Actualizar un caso especial | ADMIN/SUPERVISOR | `app/api/routes_especiales.py:183` |
| GET | `/api/v1/citas` | Agenda de citas; filtros `desde`, `hasta`, `id_cuadrilla`, `estado` | Autenticado | `app/api/routes_especiales.py:280` |
| POST | `/api/v1/citas` | Agendar una cita (valida solapamiento) | ADMIN/SUPERVISOR | `app/api/routes_especiales.py:301` |
| PATCH | `/api/v1/citas/{id_cita}` | Reprogramar/actualizar una cita | ADMIN/SUPERVISOR | `app/api/routes_especiales.py:329` |
| DELETE | `/api/v1/citas/{id_cita}` | Cancelar la cita (`estado = "CANCELADA"`) | ADMIN/SUPERVISOR | `app/api/routes_especiales.py:355` |
| GET | `/api/v1/seguimiento` | Casos derivados a otras colas | Autenticado | `app/api/routes_especiales.py:369` |
| POST | `/api/v1/seguimiento` | Derivar un caso a otra instancia | ADMIN/SUPERVISOR | `app/api/routes_especiales.py:387` |
| PATCH | `/api/v1/seguimiento/{id_seguimiento}` | Actualizar el seguimiento (p. ej. `DEVUELTO`) | ADMIN/SUPERVISOR | `app/api/routes_especiales.py:409` |
| GET | `/api/v1/seguimiento/{id_seguimiento}` | Obtener un seguimiento | Autenticado | `app/api/routes_especiales.py:433` |

Reglas destacadas: un caso especial no puede indicar a la vez `id_solicitante` y
`crear_solicitante` (422, `app/api/routes_especiales.py:131-135`); si no se
indica `id_caso`, se crea un caso asociado con `origen = "MANUAL"`
(`:71-100`). La agenda usa una duración configurable
(`agenda.duracion_minutos`, por defecto 60 min) y estados bloqueantes
(`app/api/routes_especiales.py:43-44,250-254`); el solapamiento devuelve **409**
(`:273-277`). **Forzar un solapamiento está reservado al rol SUPER**: cualquier
otro rol recibe 403 (`:317-320` y `:344-347`). Al derivar con estado `EN_COLA`,
el caso pasa a `ENRUTADO` (`:400-403`); al registrarlo `DEVUELTO`, vuelve a
`NUEVO` (`:422-427`).

### Monitoreo y reportes (app/api/routes_monitoreo.py)

Nueve operaciones, todas de **lectura** para cualquier usuario autenticado. Las
fórmulas están definidas en `RepoTecnico/metricas.md` y el encabezado del archivo
lo referencia (`app/api/routes_monitoreo.py:1`).

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/monitoreo/diario` | Gestión diaria (`fecha`) | Autenticado | `app/api/routes_monitoreo.py:27` |
| GET | `/api/v1/monitoreo/semanal` | Curva semanal lunes a sábado (`desde`) | Autenticado | `app/api/routes_monitoreo.py:38` |
| GET | `/api/v1/monitoreo/globales` | Pendientes vs resueltos (`desde`, `hasta`) | Autenticado | `app/api/routes_monitoreo.py:49` |
| GET | `/api/v1/monitoreo/reparacion` | Pendientes de reparación por tipo | Autenticado | `app/api/routes_monitoreo.py:62` |
| GET | `/api/v1/monitoreo/construccion` | Pendientes de construcción por tipo | Autenticado | `app/api/routes_monitoreo.py:71` |
| GET | `/api/v1/monitoreo/cuadrilla` | Asignados, cerrados y gestionados por cuadrilla (`desde`, `dias`) | Autenticado | `app/api/routes_monitoreo.py:80` |
| GET | `/api/v1/monitoreo/capacidad` | Capacidad operativa | Autenticado | `app/api/routes_monitoreo.py:93` |
| GET | `/api/v1/reportes/trabajo` | Reporte de trabajo (`periodo`: diario/semanal/mensual) | Autenticado | `app/api/routes_monitoreo.py:105` |
| GET | `/api/v1/reportes/trabajo/imprimible` | Reporte de trabajo en HTML imprimible | Autenticado | `app/api/routes_monitoreo.py:117` |

Todas aceptan `id_central` opcional y resuelven la central activa cuando se omite
(`app/api/routes_monitoreo.py:20-21`). El parámetro `periodo` está restringido por
patrón a `^(diario|semanal|mensual)$` (`:107,120`), lo que produce **422** ante un
valor inválido. El reporte imprimible compone una plantilla HTML con tamaño carta
(`:150-198`).

### Alertas, Telegram y MCP (app/api/routes_alertas.py)

Once operaciones: fallas masivas, bandeja de notificaciones (*outbox*), bot de
Telegram, servidor MCP y métricas. Escritura para ADMIN/SUPERVISOR
(`app/api/routes_alertas.py:31`).

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/fallas-masivas` | Listar fallas masivas; filtros `estado`, `id_central`, `solo_activas` | Autenticado | `app/api/routes_alertas.py:45` |
| POST | `/api/v1/fallas-masivas` | Reportar una falla masiva manual y alertar | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:64` |
| POST | `/api/v1/fallas-masivas/detectar` | Detectar fallas por concentración (idempotente) | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:90` |
| PATCH | `/api/v1/fallas-masivas/{id_falla}` | Actualizar estado o cuadrilla de la falla | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:104` |
| POST | `/api/v1/fallas-masivas/{id_falla}/planificacion` | Documentar la planificación de atención (RF-17) | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:120` |
| POST | `/api/v1/fallas-masivas/{id_falla}/material` | Solicitar material para la falla (RF-18) | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:144` |
| GET | `/api/v1/notificaciones` | Bandeja de notificaciones; filtros `estado`, `canal`, `limite` | Autenticado | `app/api/routes_alertas.py:169` |
| POST | `/api/v1/notificaciones/procesar` | Procesar el outbox (reintentos con backoff) | ADMIN/SUPERVISOR | `app/api/routes_alertas.py:186` |
| POST | `/api/v1/telegram/webhook` | Webhook del bot de Telegram | Público (secreto propio) | `app/api/routes_alertas.py:256` |
| POST | `/api/v1/mcp` | Servidor MCP en JSON-RPC 2.0 | Público (clave propia) | `app/api/routes_alertas.py:346` |
| GET | `/api/v1/metricas` | Métricas de negocio y estado de los canales | Autenticado | `app/api/routes_alertas.py:400` |

El webhook de Telegram exige la cabecera
`X-Telegram-Bot-Api-Secret-Token` cuando `telegram.webhook_secret` está
configurado; si no coincide, devuelve **403** (`app/api/routes_alertas.py:262-265`).
Soporta los comandos `/start`, `/ayuda`, `/help`, `/estado`, `/caso` y `/falla`
(`:209-253`), y responde encolando en el outbox (`:201-206`).

El servidor MCP valida la cabecera `X-MCP-Key` contra `mcp.api_key` y, si no
coincide, responde **HTTP 200 con error JSON-RPC `-32001`**
(`app/api/routes_alertas.py:352-356`). Implementa `initialize`
(`protocolVersion` `2024-11-05`), `tools/list` y `tools/call`
(`:363-372`), con cuatro herramientas: `estado_central`, `consultar_caso`,
`reportar_falla` y `procesar_notificaciones` (`:282-293`). Los errores de
herramienta se devuelven como `-32602` y un método desconocido como `-32601`
(`:387-392`). `MCP_VERSION` es `0.1.0` (`app/api/routes_alertas.py:32`).

El modo de prueba de contrato confirma que ambos webhooks son públicos y no exigen
token JWT (`app/tests/test_contratos.py:139-143`).

## Códigos de respuesta

### 200/201

- **200** es el código por defecto de las operaciones de lectura y de las
  actualizaciones que devuelven cuerpo (`app/api/routes_casos.py:89`,
  `app/api/routes_config.py:113`).
- **201** se declara explícitamente en las creaciones, por ejemplo
  `POST /api/v1/casos` (`app/api/routes_casos.py:218`),
  `POST /api/v1/despachos` (`app/api/routes_despachos.py:79`) y
  `POST /api/v1/ingesta` (`app/api/routes_ingesta.py:138`).
- **204** se usa en los borrados/desactivaciones, por ejemplo
  `DELETE /api/v1/central/{id_central}` (`app/api/routes_config.py:128`) y
  `DELETE /api/v1/citas/{id_cita}` (`app/api/routes_especiales.py:355`).

### 401

Credenciales inválidas o token expirado. La constante reutilizable vive en
`app/api/deps.py:22-26` y se lanza cuando falta la credencial (`:33-34`), el token
no decodifica (`:35-38`), falta `sub` (`:40-42`) o el usuario no existe/está
inactivo (`:44-46`). En el login, un P00 inexistente o una clave incorrecta
también devuelven 401 (`app/api/routes_auth.py:88-90,107-111`), y `unlock` /
`reset-password` devuelven 401 si las palabras no coinciden
(`app/api/routes_auth.py:339,358`). La prueba de contrato lo verifica en
`app/tests/test_contratos.py:101-104`.

### 403

Operación no permitida para el rol. `require_roles` devuelve 403 cuando el usuario
no tiene rol asociado o su rol no está en la lista permitida
(`app/api/deps.py:60-70`). Otros casos: usuario inactivo en el login
(`app/api/routes_auth.py:92`), intento de forzar un solapamiento de citas sin ser
SUPER (`app/api/routes_especiales.py:320,347`) y secreto inválido del webhook de
Telegram (`app/api/routes_alertas.py:265`). La prueba negativa de escritura con rol
TECNICO está en `app/tests/test_contratos.py:107-111` y la matriz de RBAC en
`:127-136`.

### 404

Recurso inexistente. Se centraliza en los auxiliares `_o_404` de cada módulo:
casos (`app/api/routes_casos.py:29-33`), configuración
(`app/api/routes_config.py:63-67`), despachos (`app/api/routes_despachos.py:45-49`)
y fallas masivas (`app/api/routes_alertas.py:35-39`). También se devuelve 404 en
`auth/unlock`, `auth/reset-password` y `auth/setup` cuando el P00 no existe
(`app/api/routes_auth.py:159,334,353`), y en las validaciones de claves foráneas
de especiales (`app/api/routes_especiales.py:144,149,179,192,311,313,315,338,361,
396,418,439`). La prueba de contrato está en `app/tests/test_contratos.py:114-117`.

### 409

Conflicto de unicidad o de estado. Casos verificados: `IntegrityError` traducido en
configuración (`app/api/routes_config.py:70-75`), `id_averia` duplicado en el alta
manual (`app/api/routes_casos.py:235-236`), despacho ya existente para la fecha
(`app/api/routes_despachos.py:103-112`), caso ya asignado o perteneciente a la
cuadrilla 0 (`app/api/routes_despachos.py:305-313`), caso especial con `id_averia`
repetido (`app/api/routes_especiales.py:77-78`) y solapamiento de citas
(`app/api/routes_especiales.py:271-277`).

### 422

Validación. FastAPI devuelve 422 automáticamente ante cuerpos que no cumplen el
esquema Pydantic; la prueba de contrato comprueba que el `detail` es una lista
(`app/tests/test_contratos.py:120-124`). Además hay 422 explícitos: búsqueda sin
criterio (`app/api/routes_casos.py:181-185`), clave y confirmación distintas
(`app/api/routes_auth.py:143-144`), `id_solicitante` y `crear_solicitante`
simultáneos (`app/api/routes_especiales.py:131-135`), cita sin `id_caso` ni
`id_caso_especial` (`app/api/routes_especiales.py:308-309`) y `periodo` inválido
en reportes (`app/api/routes_monitoreo.py:107`).

### 423

Cuenta bloqueada. `get_current_user` devuelve 423 si `usuario.bloqueado`
(`app/api/deps.py:47-48`). En el login, un usuario bloqueado recibe 423
(`app/api/routes_auth.py:93-97`) y un fallo que alcanza `max_intentos = 3`
(`app/core/config.py:31`) bloquea la cuenta y responde 423 con el saldo de
intentos en `X-Intentos-Restantes` (`app/api/routes_auth.py:100-111`).

### 429

Demasiados intentos. El limitador en memoria `_rate_limit` cuenta por clave
(`p00|IP`) dentro de una ventana y lanza 429 con el detalle «Demasiados intentos.
Espere un momento.» (`app/api/routes_auth.py:41-51`). Los valores por defecto son
**10 intentos en 60 s** (`app/core/config.py:34-35`), aplicados en el login con la
IP del cliente (`app/api/routes_auth.py:84-85`).

## Convenciones

### Paginación

Solo el listado de casos implementa paginación completa, con los parámetros
`page` (≥ 1) y `page_size` (1–200, por defecto 25)
(`app/api/routes_casos.py:108-109`). La respuesta usa el esquema `PaginaCasos` con
`items`, `total`, `page`, `page_size` y `pages`
(`app/schemas/casos.py:104-109`), calculado como `(total + page_size - 1) //
page_size` (`app/api/routes_casos.py:159`). La prueba de contrato exige esas cinco
claves (`app/tests/test_contratos.py:146-150`).

Los demás listados no usan `page`: emplean un tope `limite`
(`/api/v1/ingesta/lotes`, 1–200 y por defecto 50,
`app/api/routes_ingesta.py:194-198`; `/api/v1/notificaciones`, 1–500 y por defecto
100, `app/api/routes_alertas.py:169-176`) o devuelven la colección completa
ordenada (por ejemplo, `/api/v1/central`, `app/api/routes_config.py:87-90`). La
búsqueda de PANEL acota con `limite` (1–100, por defecto 20,
`app/api/routes_casos.py:179`).

### Filtros

Los filtros se declaran como *query params* tipados. Los más relevantes:

| Endpoint | Filtros | Línea |
|---|---|---|
| `GET /api/v1/casos` | `q`, `id_averia`, `telefono`, `id_central`, `id_sector`, `id_causa`, `id_lote_ingesta`, `estado_actual`, `tipo_caso`, `categoria`, `origen`, `en_gestion_supervisor`, `es_falla_masiva`, `desde`, `hasta` | `app/api/routes_casos.py:93-109` |
| `GET /api/v1/casos/buscar` | `q`, `id_averia`, `telefono`, `limite` | `app/api/routes_casos.py:176-179` |
| `GET /api/v1/central` | `solo_activas` | `app/api/routes_config.py:85` |
| `GET /api/v1/sectores` | `id_central`, `solo_activos` | `app/api/routes_config.py:144-145` |
| `GET /api/v1/tecnicos` | `id_central`, `status` | `app/api/routes_config.py:293-294` |
| `GET /api/v1/cuadrillas` | `id_central`, `solo_activas` | `app/api/routes_config.py:412-413` |
| `GET /api/v1/catalogos/metodos` | `dominio` | `app/api/routes_config.py:558` |
| `GET /api/v1/despachos` | `fecha`, `id_central` | `app/api/routes_despachos.py:122-123` |
| `GET /api/v1/citas` | `desde`, `hasta`, `id_cuadrilla`, `estado` | `app/api/routes_especiales.py:284-287` |
| `GET /api/v1/seguimiento` | `id_caso`, `estado`, `instancia_destino` | `app/api/routes_especiales.py:373-375` |
| `GET /api/v1/fallas-masivas` | `estado`, `id_central`, `solo_activas` | `app/api/routes_alertas.py:50-52` |
| `GET /api/v1/notificaciones` | `estado`, `canal`, `limite` | `app/api/routes_alertas.py:174-176` |
| `GET /api/v1/monitoreo/*` y reportes | `fecha`, `desde`, `hasta`, `dias`, `id_central`, `periodo` | `app/api/routes_monitoreo.py:29-30,40-41,51-53,83-84,107-109` |

Los rangos de fecha se aplican sobre `Caso.fecha_reporte` (`desde`/`hasta`,
`app/api/routes_casos.py:146-149`).

### RBAC por endpoint

El control de acceso se implementa en `app/api/deps.py`. `require_roles(*roles)`
devuelve una dependencia que exige uno de los roles indicados
(`app/api/deps.py:52-72`); el rol **SUPER** concede cualquier operación sin
enumerarse (`ROL_SUPER = "SUPER"` en `:20`, comparación en `:65`). Esto es
consistente con `RepoTecnico/requerimientos.md:252-253`.

En la práctica, cada archivo de rutas define una única dependencia de escritura:

| Archivo | Dependencia de escritura | Línea |
|---|---|---|
| `app/api/routes_config.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_config.py:60` |
| `app/api/routes_ingesta.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_ingesta.py:23` |
| `app/api/routes_casos.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_casos.py:26` |
| `app/api/routes_despachos.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_despachos.py:42` |
| `app/api/routes_especiales.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_especiales.py:41` |
| `app/api/routes_alertas.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_alertas.py:31` |

Consecuencia verificada: **en la v1 ninguna operación de escritura acepta el rol
TECNICO**. La matriz de `RepoTecnico/requerimientos.md:246` prevé CRUD del técnico
para la «gestión técnica» desde la app móvil, que corresponde al Ciclo 8 y **no
está desarrollada**; por tanto, esa capacidad no existe en la API actual. La
excepción singular al esquema es el forzado de solapamiento de citas, reservado
exclusivamente a SUPER (`app/api/routes_especiales.py:319-320,346-347`).

### Request-id

El `ObservabilidadMiddleware` (`app/main.py:49-65`) toma el valor de la cabecera
`X-Request-ID` entrante o genera uno de 12 caracteres hexadecimales
(`app/main.py:53`), mide la duración con `time.perf_counter` (`:54,61`) y
**devuelve siempre** `X-Request-ID` en la respuesta (`:62`). Cada petición se
registra con método, ruta, código y milisegundos (`:63-64`); si se produce una
excepción, se registra el fallo con el mismo `request_id` y se re-lanza
(`:57-59`). Esto soporta RNF-19, cuya verificación se apoya además en
`GET /api/v1/metricas` (`app/api/routes_alertas.py:400-423`).

## Endpoints públicos (/health, /ready, /api/v1/info) y el resto autenticado

### Superficie pública por diseño

| Endpoint | Motivo | Línea |
|---|---|---|
| `GET /health` | *Liveness* para el orquestador; no toca la BD | `app/api/routes_health.py:28-31` |
| `GET /ready` | *Readiness*; consulta PostgreSQL y responde 503 si falla | `app/api/routes_health.py:34-57` |
| `GET /api/v1/info` | Metadatos del servicio (nombre, versión, entorno, `/docs`) | `app/api/routes_health.py:17-25` |
| `POST /api/v1/auth/login` | Emisión inicial del token | `app/api/routes_auth.py:81` |
| `POST /api/v1/auth/setup` | Primer acceso; **crea la cuenta** y el P00 lo registra antes el supervisor (**D-67**) | `app/api/routes_auth.py:129` |
| `GET /api/v1/auth/primer-acceso` | Comprueba el P00 y su estado antes del alta (**D-67**) | `app/api/routes_auth.py:219` |
| `POST /api/v1/auth/unlock` | Recuperación de cuenta bloqueada con 3 de 12 palabras | `app/api/routes_auth.py:330` |
| `POST /api/v1/auth/reset-password` | Restablecimiento de clave con 3 de 12 palabras | `app/api/routes_auth.py:349` |

### Rutas sin JWT pero con secreto propio

Dos operaciones son públicas desde la perspectiva del esquema OpenAPI porque no
dependen de `HTTPBearer`, pero se protegen con un secreto de canal:

- `POST /api/v1/telegram/webhook`: valida `X-Telegram-Bot-Api-Secret-Token`
  contra `telegram.webhook_secret`; vacío ⇒ no se exige
  (`app/api/routes_alertas.py:262-265`).
- `POST /api/v1/mcp`: valida `X-MCP-Key` contra `mcp.api_key`; vacío ⇒ no se exige
  (`app/api/routes_alertas.py:352-356`).

Los nombres de esos secretos/parámetros están documentados en la tabla
`configuracion` (`RepoTecnico/entornos_globales.md:199-202`). No se reproducen
valores ni credenciales en este manual.

### Resto de la superficie

Descontadas las **ocho rutas públicas por diseño** y las dos rutas con secreto
propio, las **99 operaciones restantes** exigen token Bearer: o bien con la
dependencia `get_current_user` (lectura) o con `require_roles("ADMIN",
"SUPERVISOR")` (escritura), o con `require_roles("SUPER")` en el caso singular de
`POST /api/v1/auth/palabras/{p00}/regenerar`. La prueba
`test_las_rutas_privadas_exigen_seguridad` enumera la lista exacta de rutas
públicas y comprueba que el resto declare seguridad en OpenAPI
(`app/tests/test_contratos.py:77-95`).

### Códigos adicionales de infraestructura

- **503**: `/ready` cuando la base de datos no responde
  (`app/api/routes_health.py:56-57`) y `/api/v1/resumen` en la misma situación
  (`app/api/routes_health.py:79-80`).
- **500**: cualquier excepción no controlada; el middleware la registra con su
  `request_id` y la re-lanza (`app/main.py:57-59`).
- **Errores JSON-RPC dentro de HTTP 200** en `/api/v1/mcp` (`-32001`, `-32602`,
  `-32601`), por el formato del protocolo
  (`app/api/routes_alertas.py:355-356,387-392`).
