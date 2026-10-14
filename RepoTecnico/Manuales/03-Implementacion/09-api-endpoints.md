# API de GGTO — Inventario de Endpoints

> Documento técnico de implementación. Describe la superficie HTTP real de GGTO
> (CANTV C.A., Central Francisco Salias / Área 4): prefijos, autenticación, el
> inventario completo de operaciones por archivo de rutas, los códigos de
> respuesta y las convenciones transversales. Cada afirmación se respalda con
> una referencia `ruta:línea` verificada en el código fuente.

## Visión general

La API es una aplicación **FastAPI** construida en `app/main.py`. La instancia se
declara con título, versión y descripción tomados de la configuración
(`app/main.py:38-47`), y monta los routers de negocio en un orden explícito:
salud, autenticación, configuración, ingesta, casos, despachos, especiales,
monitoreo, alertas, sistemas y —desde la D-73— sincronización móvil
(`app/main.py:78-89`). Al final se monta la SPA React para no
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
| `app/api/routes_sync.py` | `/api/v1` | `app/api/routes_sync.py:31` |
| `app/api/routes_sistemas.py` | `/api/v1/sistemas` | `app/api/routes_sistemas.py:18` |

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

### Relación de paths y operaciones (revisión D-94)

El esquema OpenAPI publicado (`app.openapi()`) reporta **117 rutas (*paths*)** y
**150 operaciones** (combinación método + path) al cierre de **D-94**. El conteo
es reproducible:

```python
import app.main as m
s = m.app.openapi()
len(s["paths"])                                   # 117
sum(len([k for k in v if k in
        ("get","post","put","patch","delete")]) for v in s["paths"].values())  # 150
```

El código contiene **154 decoradores `@router.*`** en `app/api/routes_*.py`; los
**4** de `app/api/routes_mantenimiento.py` quedan fuera del esquema por
`include_in_schema=False` (`app/api/routes_mantenimiento.py:21`), lo que explica
la diferencia (154 − 4 = 150). **29 paths comparten varios métodos** (por
ejemplo `/api/v1/casos` con GET y POST), y esos métodos extra son la razón de que
las operaciones superen a los paths.

Incorporaciones de los ciclos **D-89…D-94** verificadas en el esquema:

| Operación nueva o modificada | Ciclo | Referencia |
|---|---|---|
| `GET /api/v1/monitoreo/reclasificaciones` | D-90 | `app/api/routes_monitoreo.py:145-153` |
| `GET /api/v1/monitoreo/identificadores` | D-94 | `app/api/routes_monitoreo.py:156-170` |
| `GET /api/v1/casos/buscar` — la búsqueda cubre además `contacto_cliente` | D-92 | `app/api/routes_casos.py:278-326` |
| `POST /api/v1/casos` y `PATCH /api/v1/casos/{id}` — admiten `id_pago` | D-89/D-91 | `app/api/routes_casos.py:365-438,450-519` |
| `POST /api/v1/casos` — datos obligatorios del alta (**RN-AL-01**) | RN-AL | `app/schemas/casos.py` (`CasoManualCreate`) |
| `GET /api/v1/casos` — nuevo filtro `solo_abiertos` (**RN-AL-02**) | RN-AL | `app/api/routes_casos.py` (`listar`) |
| `POST /api/v1/casos-especiales` — datos obligatorios del alta y del solicitante (**RN-AL-01**) | RN-AL | `app/schemas/especiales.py` (`CasoEspecialCreate`) |
| `PATCH /api/v1/casos/{id}/contacto` — edición de campo del contacto | D-88/D-93 | `app/api/routes_casos.py:761-804` |
| `POST /api/v1/ingesta` — encabezado inválido deja el lote en `ERROR` y responde 422 | RT-20 | `app/api/routes_ingesta.py:189-216` |

Las cifras anteriores del proyecto («73 endpoints», «95 paths / 126 operaciones»)
corresponden a cortes previos a D-74…D-94 (`RepoTecnico/plan_desarrollo.md:227`,
`RepoTecnico/pruebas/plan_pruebas.md:21`). La descomposición exacta por ciclo de
los 117 paths **queda pendiente de confirmar**; las cifras vigentes de esta
sección están verificadas con `app.openapi()` sobre el árbol de trabajo.

Los paths compartidos verificados incluyen:

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

Los documentos del proyecto hablaban de **«73 endpoints»** cuando en realidad se
referían a *73 paths*: `RepoTecnico/plan_desarrollo.md:227` («73 endpoints
OpenAPI»), `RepoTecnico/pruebas/informe_fase4.md:78` y
`RepoTecnico/pruebas/plan_pruebas.md:21`. Aquellas cifras (73 → 79 → 95 paths;
109 → 126 operaciones) son cortes sucesivos y **quedaron superados** por los
ciclos D-74…D-94: la superficie vigente es la verificada arriba (**117 paths /
150 operaciones**). El origen exacto de conteos intermedios como «98
operaciones» no se pudo reconstruir y queda **pendiente de confirmar**.

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

A continuación, el inventario completo de las **126 operaciones**, agrupado por
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
| POST | `/api/v1/ingesta/preview` | Simular la ingesta del CSV sin guardar | ADMIN/SUPERVISOR | `app/api/routes_ingesta.py:162-178` |
| POST | `/api/v1/ingesta` | Cargar el archivo diario e insertar los casos nuevos | ADMIN/SUPERVISOR | `app/api/routes_ingesta.py:189-292` |
| GET | `/api/v1/ingesta/lotes` | Historial de cargas (`limite` 1–200, por defecto 50) | Autenticado | `app/api/routes_ingesta.py:294-304` |
| GET | `/api/v1/ingesta/lotes/{id_lote}` | Detalle de una carga | Autenticado | `app/api/routes_ingesta.py:307-314` |
| POST | `/api/v1/ingesta/sectorizar-pendientes` | Re-sectorizar los casos con `id_sector` nulo de la central (**D-66**) | ADMIN/SUPERVISOR | `app/api/routes_ingesta.py:317-349` |

La carga real crea un `IngestaLote` y luego los casos, dejando el lote en `OK` y
los avisos en `detalle_error` (`app/api/routes_ingesta.py:221-273`). Tras insertar,
dispara la detección automática de fallas masivas por concentración
(`app/api/routes_ingesta.py:275-279`). El resumen incluye filas leídas, filas de
la central, casos nuevos, duplicados, descartados, sectorizados, sin sector,
casos de cuadrilla 0 y las **direcciones sin sector** agrupadas por dirección
normalizada (`app/api/routes_ingesta.py:65-118`), más los contadores de **D-89
(RF-56)** `filas_sin_identificador_pago` y `filas_con_contacto`
(`app/api/routes_ingesta.py:94-110`). El endpoint
`sectorizar-pendientes` aplica los patrones vigentes a los casos de la central con
`id_sector IS NULL` y devuelve `revisados`, `asignados` y `sin_sector`
(`app/api/routes_ingesta.py:317-349`).

**RT-20 — encabezado inválido (D-89/D-90).** Si el archivo no trae las **80
columnas** esperadas (`app/services/ingesta.py:22`), la carga **no** inserta
casos: crea el `IngestaLote` con `estado="ERROR"` y `detalle_error`, hace
`commit` y responde **422** con el detalle de columnas
(`app/api/routes_ingesta.py:200-216`; validación en
`app/services/ingesta.py:171-179`). El `preview` también responde 422 pero sin
crear lote (`app/api/routes_ingesta.py:170-171`).

### Casos y PANEL (app/api/routes_casos.py)

**Trece operaciones** (el inventario anterior decía seis; D-88 y D-89 añadieron el
resto). Escritura para ADMIN/SUPERVISOR (`app/api/routes_casos.py:51`); lectura
para cualquier usuario autenticado.

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/casos` | Listado paginado con filtros | Autenticado | `app/api/routes_casos.py:180-276` |
| GET | `/api/v1/casos/buscar` | Búsqueda rápida de PANEL por `q`, `id_averia` o `telefono`; cubre también `contacto_cliente` | Autenticado | `app/api/routes_casos.py:278-326` |
| POST | `/api/v1/casos` | Alta manual (genera `REF-…` si no hay `id_averia`); admite `id_pago` | ADMIN/SUPERVISOR | `app/api/routes_casos.py:365-438` |
| GET | `/api/v1/casos/{id_caso}` | Ficha completa del caso | Autenticado | `app/api/routes_casos.py:444-447` |
| PATCH | `/api/v1/casos/{id_caso}` | Actualizar campos, sector, `id_pago` y/o estado | ADMIN/SUPERVISOR | `app/api/routes_casos.py:450-519` |
| POST | `/api/v1/casos/{id_caso}/estado` | Cambiar el estado desde la gestión | ADMIN/SUPERVISOR | `app/api/routes_casos.py:522-544` |
| GET | `/api/v1/casos/{id_caso}/historial` | Bitácora de estados del caso | Autenticado | `app/api/routes_casos.py:546-564` |
| POST | `/api/v1/casos/{id_caso}/cierre` | Registrar el cierre con método | ADMIN/SUPERVISOR | `app/api/routes_casos.py:577-639` |
| POST | `/api/v1/casos/{id_caso}/cita` | Agendar una cita rápida | ADMIN/SUPERVISOR | `app/api/routes_casos.py:641-671` |
| POST | `/api/v1/casos/{id_caso}/no-contesta` | Registrar «No Contesta» (**D-88**) | ADMIN/SUPERVISOR | `app/api/routes_casos.py:673-758` |
| PATCH | `/api/v1/casos/{id_caso}/contacto` | Corregir dirección y número de contacto desde el campo (**D-88**) | ADMIN/SUPERVISOR/TECNICO | `app/api/routes_casos.py:761-804` |
| POST | `/api/v1/casos/{id_caso}/enrutado` | Enrutar el caso a otra instancia | ADMIN/SUPERVISOR | `app/api/routes_casos.py:807-849` |
| GET | `/api/v1/casos/{id_caso}/relacionados` | Antecedentes del mismo teléfono o dirección | Autenticado | `app/api/routes_casos.py:852-920` |

El listado admite los filtros `q`, `id_averia`, `telefono`, `id_central`,
`id_sector`, `id_causa`, `id_lote_ingesta`, `estado_actual`, `tipo_caso`,
`categoria`, `origen`, `en_gestion_supervisor`, `es_falla_masiva`, `desde` y
`hasta` (`app/api/routes_casos.py:181-198`). Ordena por `fecha_reporte` descendente
y `id_caso` descendente. Cada `CasoOut` del listado añade `sector_nombre`
y los indicadores `pendiente`, `asignado`, `citado` y `gestion`
(`app/api/routes_casos.py:83-153`). El alta manual usa la función de base de datos
`generar_id_averia_ref` (`:379-382`), rechaza duplicados con 409 (`:384-385`) y
registra el estado inicial `NUEVO` en el historial (`:427-435`). Al corregir la
dirección, el sector se recalcula (`:507-509`).

**Identificador de pago en los casos (D-89).** El alta (`POST`) y la edición
(`PATCH`) aceptan el campo **`id_pago`** (también llamado «identificador» en la
interfaz) y lo clasifican con `app/services/pagos.py`:

- Un número que cumple el patrón configurado (`configuracion.pago.serie_regex`,
  por defecto `^70[0-9]{8}$`) se resuelve como **identificador**: se crea la ficha
  si no existe y `caso.telefono` queda como alias (`app/api/routes_casos.py:332-362,377-391`).
- Cualquier otro número es **número de contacto**: va a `contacto_cliente` y se
  suma a `informacion` como `[CONTACTO] <numero>` (`app/services/pagos.py:100-151,208-226`).
- En el `PATCH`, un `id_pago` que **no** cumple el patrón responde **422**
  («El identificador de pago no cumple el patrón configurado (70*)»,
  `app/api/routes_casos.py:467-473`).

**`PATCH /casos/{id}/contacto` — divergencia D-93 pendiente.** El contrato real
del endpoint es `ContactoUpdate` con los campos `direccion` y **`telefono`**, y el
validador **exige las series 700/701/702** (`app/schemas/casos.py:244-264`). La
APK de D-93 envía en cambio la clave **`contacto`** y espera que un `70*` se
registre como identificador del caso
(`app_movil/lib/features/casos/operaciones_service.dart:352-378`); el backend
**no** interpreta ese campo. Queda **pendiente de confirmar** si el contrato se
homologa a `contacto` (y se retira la restricción de series) o si la APK debe
volver a `telefono`.


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
| POST | `/api/v1/casos-especiales` | Ingresar un caso especial (puede crear el caso y el solicitante). **RN-AL-01**: exige nombre y teléfono de contacto, dirección, teléfono con el 70\*, tipo de reporte —y, si es REPARACIÓN, id de avería y tipo de problema— y los datos del solicitante (nombre, unidad y contacto) | ADMIN/SUPERVISOR | `app/api/routes_especiales.py:124` |
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

**Once operaciones**, todas de **lectura**. Las fórmulas están definidas en
`RepoTecnico/metricas.md` y el encabezado del archivo lo referencia
(`app/api/routes_monitoreo.py:1`). D-90 y D-94 añadieron dos operaciones de
gestión restringidas a **ADMIN/SUPERVISOR**.

| Método | Ruta | Propósito | Roles | Línea |
|---|---|---|---|---|
| GET | `/api/v1/monitoreo/diario` | Gestión diaria (`fecha`) | Autenticado | `app/api/routes_monitoreo.py:56-66` |
| GET | `/api/v1/monitoreo/semanal` | Curva semanal lunes a sábado (`desde`) | Autenticado | `app/api/routes_monitoreo.py:69-79` |
| GET | `/api/v1/monitoreo/globales` | Pendientes vs resueltos (`desde`, `hasta`) | Autenticado | `app/api/routes_monitoreo.py:82-94` |
| GET | `/api/v1/monitoreo/reparacion` | Pendientes de reparación por tipo | Autenticado | `app/api/routes_monitoreo.py:97-105` |
| GET | `/api/v1/monitoreo/construccion` | Pendientes de construcción por tipo | Autenticado | `app/api/routes_monitoreo.py:108-116` |
| GET | `/api/v1/monitoreo/cuadrilla` | Asignados, cerrados y gestionados por cuadrilla (`desde`, `dias`) | Autenticado | `app/api/routes_monitoreo.py:119-131` |
| GET | `/api/v1/monitoreo/capacidad` | Capacidad operativa | Autenticado | `app/api/routes_monitoreo.py:134-142` |
| GET | `/api/v1/monitoreo/reclasificaciones` | **D-90:** reclasificados a REFERIDO y pendientes históricos | **ADMIN/SUPERVISOR** | `app/api/routes_monitoreo.py:145-153` |
| GET | `/api/v1/monitoreo/identificadores` | **D-94:** métricas por identificador de pago (`reincidencia`, `top`) | **ADMIN/SUPERVISOR** | `app/api/routes_monitoreo.py:156-170` |
| GET | `/api/v1/reportes/trabajo` | Reporte de trabajo (`periodo`: diario/semanal/mensual) | Autenticado | `app/api/routes_monitoreo.py:176-187` |
| GET | `/api/v1/reportes/trabajo/imprimible` | Reporte de trabajo en HTML imprimible | Autenticado | `app/api/routes_monitoreo.py:190-310` |

Todas aceptan `id_central` opcional y resuelven la central activa cuando se omite
(`app/api/routes_monitoreo.py:25-26`). El parámetro `periodo` está restringido por
patrón a `^(diario|semanal|mensual)$` (`:178,193`), lo que produce **422** ante un
valor inválido. El reporte imprimible compone una plantilla HTML con tamaño carta
(`:244-309`) y **D-94** añadió al informe las tablas de identificadores de pago y
de reclasificaciones (`app/api/routes_monitoreo.py:224-242,299-306`).

**Día operativo (D-94).** Las rutas de MONITOREO y REPORTES usan
`svc.hoy_operativo()` como valor por defecto de `fecha`/`desde`
(`app/api/routes_monitoreo.py:65,78,92,129,186,201`), y
`app/services/monitoreo.py::_dia()` convierte las columnas con
`func.timezone('America/Caracas', columna)` en vez de `func.date(...)`
(`app/services/monitoreo.py:57-65`). El motivo: `func.date` se evalúa en la zona
de la **sesión** (UTC en Cloud SQL) y a partir de las 20:00 de Caracas los casos
caían en el día siguiente (`app/services/tiempo.py:1-8`). El reporte imprimible
rotula la zona operativa (`app/api/routes_monitoreo.py:266`).

**RBAC de las dos operaciones de gestión.** Usan la dependencia
`_gestion = require_roles("ADMIN", "SUPERVISOR")`
(`app/api/routes_monitoreo.py:22`); el rol **TECNICO** recibe **403**. El
`SUPER` pasa por el bypass de `app/api/deps.py:65`. Las métricas de
`/monitoreo/identificadores` se calculan en `app/services/monitoreo.py:335-393`
(claves `con_casos`, `casos_con_identificador`, `casos_sin_identificador`,
`media_casos`, `max_casos`, `reincidentes`, `top`, `ventana_dias`) con la ventana
`pago.reincidencia_dias` (90 días por defecto,
`app/services/pagos.py:53-59`).

### Identificador de pago (70\*) en la API (D-89…D-94)

No hay un módulo de endpoints propio del identificador en la v1 (su CRUD
dedicado queda **pendiente de confirmar**, aunque la matriz RBAC lo declara). El
identificador se consume desde los endpoints ya descritos:

| Punto de contacto | Comportamiento verificado | Referencia |
|---|---|---|
| `CasoOut` | Expone `id_pago`, `marcado_reclasificar`, `motivo_marca`, `tiene_identificador_pago` y `tiene_id_averia_real`; los tres últimos se **calculan** en el endpoint, no son columnas | `app/schemas/casos.py:46-52`; `app/api/routes_casos.py:145-152` |
| `POST /casos` y `PATCH /casos/{id}` | Aceptan `id_pago` y clasifican el número recibido (identificador vs contacto) | `app/api/routes_casos.py:332-362,463-498` |
| `GET /casos/buscar` | `q` y `telefono` cubren `telefono` (identificador) **y** `contacto_cliente` | `app/api/routes_casos.py:292-317` |
| `POST /ingesta` | Resuelve y enlaza el identificador de cada fila (con `cache` por lote) y cuenta las filas sin identificador | `app/api/routes_ingesta.py:237-267` |
| `POST /casos-especiales` | Aplica la misma clasificación al crear el caso especial | `app/api/routes_especiales.py:80-100` |
| `GET /monitoreo/identificadores` | Reincidencia y reportes por 70\* (ADMIN/SUPERVISOR) | `app/api/routes_monitoreo.py:156-170` |
| Despacho imprimible | La ficha rotula **«Identificador de pago (70\*)»** y **«Contacto»** (antes «Teléfono») y añade esa columna | `app/api/routes_despachos.py:458-459,490-494` |

**Regla REPARACIÓN (D-90) y traza.** Todo cambio del caso pasa por
`clasificacion.aplicar_en_cambio(...)`, que reclasifica a `REFERIDO` si falta el
identificador o el `id_averia` real y deja la traza en `auditoria` con
`accion="RECLASIFICACION_REFERIDO"` y el `motivo` (`SIN_IDENTIFICADOR_PAGO`,
`SIN_ID_AVERIA` o `SIN_IDENTIFICADOR_PAGO_Y_AVERIA`)
(`app/services/clasificacion.py:26-35,121-173`). Se aplica en **ocho caminos de
escritura**: alta manual (`app/api/routes_casos.py:426`), edición (`:515`), cambio
de estado (`:540`), cierre (`:630`), cita (`:661`), «No Contesta» (`:744`) y
enrutado (`:840`), más el alta de ESPECIALES
(`app/api/routes_especiales.py:124`). El resultado viaja en el mensaje de la
respuesta (`app/services/clasificacion.py:32-35,168-173`).

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

## Reporte de falla masiva desde la APK (D-82)

El técnico reporta la concentración **desde el campo** con un endpoint propio, porque el alta
administrativa (`POST /api/v1/fallas-masivas`, `app/api/routes_alertas.py:172`) exige
ADMIN/SUPERVISOR:

| Método | Ruta | Resumen | Línea |
|---|---|---|---|
| POST | `/api/v1/fallas-masivas/reporte-campo` | Reporte de campo (RF-16): ODN · dirección · FAT · descripción y máximo 2 fotos | `app/api/routes_alertas.py:203` |

- **Cuerpo** (`FallaMasivaCampo`, `app/schemas/alertas.py:59`): `odn` (3-60), `direccion` (5-200),
  `fat` (1-60), `descripcion` (5-500), `id_sector` y `id_cuadrilla` opcionales, y `evidencias`
  (lista de seriales, **máximo 2**; una tercera da `422`). El `origen` se fija a
  `REPORTE_TECNICO` en el servidor.
- **Rol:** cualquier usuario autenticado (`Depends(get_current_user)`) —el TECNICO es quien
  detecta la concentración—; el endpoint **no** relaja el RBAC de `POST /fallas-masivas`.
- **Cuadrilla:** la activa del reportante (`GET /sync/cuadrilla`) y, si no tiene, la más cercana
  al sector (`app/services/fallas.py:26`).
- **Evidencias:** las fotos se suben antes con `POST /evidencias/upload`
  (`app/api/routes_sync.py:70`) y sus seriales viajan en el reporte; el servidor los guarda en
  `falla_masiva.evidencias` (texto separado por comas) y los devuelve como lista.
- **Columnas nuevas** (D-82): `odn`, `direccion`, `fat`, `evidencias`
  (`RepoTecnico/db/schema.sql:490`); la migración idempotente es
  `scripts/migrar_d82_falla_campo.py` (simulación por defecto, `--aplicar`, `--si`, `--dsn`,
  verificación post-migración y log en `RepoTecnico/BaseOperaciones/migracion_d82.log`).
- **Prueba:** `app/tests/test_d82_falla_campo.py` (6 casos, requiere `GGTO_TEST_DB_URL`).

## Sincronización móvil — APK (D-73)
El módulo `app/api/routes_sync.py` (prefijo `/api/v1`, tag *sincronización móvil*,
`app/api/routes_sync.py:31`) da servicio a la aplicación Flutter de técnicos. Se
registra el último en `app/main.py:89`. Son **cuatro operaciones nuevas**:

| Método | Ruta | Resumen | Línea |
|---|---|---|---|
| GET | `/api/v1/sync/cuadrilla` | Cuadrilla activa del usuario | `app/api/routes_sync.py:45` |
| GET | `/api/v1/sync/descarga` | Descarga diferencial por cuadrilla | `app/api/routes_sync.py:53` |
| POST | `/api/v1/evidencias/upload` | Subir una foto de evidencia (multipart) | `app/api/routes_sync.py:65` |
| POST | `/api/v1/sync/carga` | Cargar actividades y estados del día | `app/api/routes_sync.py:120` |

### Alcance por rol

La resolución de cuadrilla vive en `app/services/sync.py:35` (`_cuadrilla_activa`):
enlaza `usuario.id_tecnico` → `cuadrilla_tecnico` con vigencia
(`desde <= hoy` y `hasta IS NULL o >= hoy`). El rol **TECNICO** queda forzado a su
propia cuadrilla; **SUPERVISOR/ADMIN/SUPER** conservan alcance amplio
(`app/services/sync.py:55`). Un TECNICO sin cuadrilla recibe una descarga vacía,
no un error.

### GET /sync/descarga

`construir_descarga` (`app/services/sync.py:123`) retorna solo los casos cuyo
último despacho pertenece a la cuadrilla y cuyo estado sigue siendo operable
(`ASIGNADO`, `CONTACTADO`, `CITADO`, `DIFERIDO`, `EN_GESTION`). Admite dos
parámetros diferenciales: `desde` (ISO 8601) e `ids_conocidos[]` (lista de ids
locales ya en caché); con ellos solo viajan los casos nuevos o cambiados. El
payload incluye `server_ts` (marca que la APK guarda como punto de corte), los
casos con su línea de despacho (`orden_visita`, `tipo_asignacion`, `observacion`)
y los catálogos de métodos y causas para operar offline.

### POST /evidencias/upload

Endpoint **multipart/form-data** (`app/api/routes_sync.py:65`). Valida:

- peso ≤ **3 MB** (`MAX_FOTO_BYTES`, `app/api/routes_sync.py:33`; excedido → 413);
- formato JPEG/PNG/WebP (otro content-type → 422);
- **idempotencia** por `serial_local`: si el serial ya existe con archivo subido,
  se devuelve la fila existente sin duplicar el objeto en storage.

El archivo se almacena vía `subir_evidencia` (`app/services/storage.py:58`): si
está configurado `GGTO_GCS_BUCKET` con credenciales ADC, sube a Cloud Storage
(`gcs://bucket/evidencias/<uuid>/<nombre>`); si no, cae a un directorio local
(`GGTO_EVIDENCIAS_DIR`), lo que permite desarrollo y pruebas sin credenciales.
La fila resultante queda en `evidencia` con `id_actividad = NULL` hasta que el
batch la vincule.

### POST /sync/carga

`aplicar_carga` (`app/services/sync.py:213`) recibe el batch diario
(`SyncCargaIn`, `app/schemas/sync.py`): lista de `actividades` (máx. 200, cada una
con máx. **5 evidencias**) y de `estados`. Por cada actividad crea la fila en
`actividad` (`sincronizado=true`), vincula las evidencias previamente subidas por
su serial, traduce el tipo al estado objetivo (`CIERRE→CERRADO`,
`CONTACTO→CONTACTADO`, etc.) y registra la bitácora en `caso_estado_hist`
reutilizando `_registrar_estado` (`app/services/sync.py:199`). Verifica además que
cada `id_caso` pertenezca a la cuadrilla del técnico (403 implícito: se reporta
como error por ítem, no aborta el lote). Responde `{aceptadas, rechazadas,
errores[], server_ts}`.

### Tabla sync_log

La D-73 añadió la tabla `sync_log` (`RepoTecnico/db/schema.sql:590`, ORM en
`app/models/sync_entities.py:18`) para bitacorar sesiones DESCARGA/CARGA por
dispositivo: `p00`, `id_cuadrilla`, `tipo`, `dispositivo_id`, `version_app`,
contadores (`recibidos/procesados/errores`) y `estado`
(`EN_PROCESO/OK/PARCIAL/ERROR`). Su migración sobre la base vigente se aplica con
`scripts/migrar_d73_sync.py` (dry-run por defecto, transacción única, verificación
post). La relajación asociada —`evidencia.id_actividad` pasa de `NOT NULL` a
nullable (`RepoTecnico/db/schema.sql:534`)— es la que habilita el flujo
foto-primero-actividad-después.

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
Telegram (`app/api/routes_alertas.py:265`). **D-90/D-94:** el rol **TECNICO** recibe
**403** en `GET /monitoreo/reclasificaciones` y `GET /monitoreo/identificadores`
(la dependencia `_gestion = require_roles("ADMIN", "SUPERVISOR")` no lo incluye:
`app/api/routes_monitoreo.py:22,150,162`); el `SUPER` pasa por el bypass
(`app/api/deps.py:65`). La prueba negativa de escritura con rol
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
criterio (`app/api/routes_casos.py:287-291`), clave y confirmación distintas
(`app/api/routes_auth.py:143-144`), `id_solicitante` y `crear_solicitante`
simultáneos (`app/api/routes_especiales.py:131-135`), cita sin `id_caso` ni
`id_caso_especial` (`app/api/routes_especiales.py:308-309`) y `periodo` inválido
en reportes (`app/api/routes_monitoreo.py:178`).

Los tres 422 incorporados por D-89…D-94 son:

| Caso | Detalle de la respuesta | Referencia |
|---|---|---|
| **Encabezado del CSV inválido (RT-20)** | «El encabezado tiene *n* columnas; se esperaban 80». La carga **crea el lote en `ERROR`** con 0 casos antes de responder | `app/api/routes_ingesta.py:200-216`; `app/services/ingesta.py:171-179` |
| **`id_pago` que no cumple el patrón** | «El identificador de pago no cumple el patrón configurado (70\*)» | `app/api/routes_casos.py:467-473` |
| **PATCH de contacto sin datos** | «Indique la dirección o el número de contacto» | `app/api/routes_casos.py:777-780` |

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
(`app/api/routes_casos.py:207-208`). La respuesta usa el esquema `PaginaCasos` con
`items`, `total`, `page`, `page_size` y `pages`
(`app/schemas/casos.py:117-122`), calculado como `(total + page_size - 1) //
page_size` (`app/api/routes_casos.py:265`). La prueba de contrato exige esas cinco
claves (`app/tests/test_contratos.py:146-150`).

Los demás listados no usan `page`: emplean un tope `limite`
(`/api/v1/ingesta/lotes`, 1–200 y por defecto 50,
`app/api/routes_ingesta.py:294-298`; `/api/v1/notificaciones`, 1–500 y por defecto
100, `app/api/routes_alertas.py:355-362`) o devuelven la colección completa
ordenada (por ejemplo, `/api/v1/central`, `app/api/routes_config.py:87-90`). La
búsqueda de PANEL acota con `limite` (1–100, por defecto 20,
`app/api/routes_casos.py:285`).

### Filtros

Los filtros se declaran como *query params* tipados. Los más relevantes:

| Endpoint | Filtros | Línea |
|---|---|---|
| `GET /api/v1/casos` | `q`, `id_averia`, `telefono`, `id_central`, `id_sector`, `id_causa`, `id_lote_ingesta`, `estado_actual`, **`solo_abiertos`** (excluye `CERRADO`/`CANCELADO`), `tipo_caso`, `categoria`, `origen`, `en_gestion_supervisor`, `es_falla_masiva`, `desde`, `hasta` | `app/api/routes_casos.py:181-198` |
| `GET /api/v1/casos/buscar` | `q`, `id_averia`, `telefono`, `limite`; `q`/`telefono` cubren `telefono` **y** `contacto_cliente` (**D-92**) | `app/api/routes_casos.py:282-285,292-317` |
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
| `GET /api/v1/monitoreo/*` y reportes | `fecha`, `desde`, `hasta`, `dias`, `id_central`, `periodo`; `fecha`/`desde` por defecto = **día operativo** `America/Caracas` (**D-94**) | `app/api/routes_monitoreo.py:58-60,71-73,84-87,120-124,178-181` |
| `GET /api/v1/monitoreo/identificadores` | `id_central`, `limite` (1–50, por defecto 10); la ventana sale de `pago.reincidencia_dias` (**D-94**) | `app/api/routes_monitoreo.py:159-169` |

Los rangos de fecha se aplican sobre `Caso.fecha_reporte` (`desde`/`hasta`,
`app/api/routes_casos.py:146-149`).

### RBAC por endpoint

El control de acceso se implementa en `app/api/deps.py`. `require_roles(*roles)`
devuelve una dependencia que exige uno de los roles indicados
(`app/api/deps.py:52-72`); el rol **SUPER** concede cualquier operación sin
enumerarse (`ROL_SUPER = "SUPER"` en `:20`, comparación en `:65`). Esto es
consistente con `RepoTecnico/requerimientos.md:264-265`.

En la práctica, cada archivo de rutas define sus dependencias de escritura:

| Archivo | Dependencia de escritura | Línea |
|---|---|---|
| `app/api/routes_config.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_config.py:60` |
| `app/api/routes_ingesta.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_ingesta.py:31` |
| `app/api/routes_casos.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_casos.py:51` |
| `app/api/routes_casos.py` | `require_roles("ADMIN", "SUPERVISOR", "TECNICO")` — `PATCH /casos/{id}/contacto` (**D-88**) | `app/api/routes_casos.py:53,767` |
| `app/api/routes_despachos.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_despachos.py:42` |
| `app/api/routes_especiales.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_especiales.py:41` |
| `app/api/routes_alertas.py` | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_alertas.py:31` |
| `app/api/routes_monitoreo.py` | `require_roles("ADMIN", "SUPERVISOR")` — solo las dos métricas de gestión (**D-90/D-94**) | `app/api/routes_monitoreo.py:22,150,162` |

Consecuencia verificada: **la única operación de escritura que acepta el rol
TECNICO es `PATCH /api/v1/casos/{id}/contacto`** (edición de dirección y número
de contacto desde el campo, D-88). El resto de la escritura es ADMIN/SUPERVISOR,
que es lo que refleja la matriz de `RepoTecnico/requerimientos.md:253` al reservar
el CRUD técnico a la app móvil. La otra excepción singular al esquema es el
forzado de solapamiento de citas, reservado exclusivamente a SUPER
(`app/api/routes_especiales.py:319-320,346-347`).

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
