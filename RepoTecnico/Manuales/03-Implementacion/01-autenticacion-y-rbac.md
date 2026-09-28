# Manual de implementación: autenticación y RBAC

Este manual describe, con base en el código real del repositorio, cómo GGTO autentica a
los usuarios, cómo protege las claves y las palabras de seguridad, cómo bloquea el acceso
ante intentos fallidos y cómo autoriza las operaciones por rol. Todas las referencias
tienen la forma `ruta:línea`. Todo aquello que no pudo comprobarse en el código se marca
como **pendiente de confirmar**.

| Aspecto | Componente principal | Referencia |
|---|---|---|
| Contraseñas | Argon2id (`argon2-cffi`) | `app/core/security.py:17` |
| Tokens | JWT HS256 | `app/core/security.py:56-72` |
| Palabras | Diccionario en español | `app/core/words.py:8-20` |
| Endpoints | Router `/api/v1/auth` | `app/api/routes_auth.py:33` |
| Autorización | Dependencias de FastAPI | `app/api/deps.py:29-72` |
| Parámetros | Variables de entorno | `app/core/config.py:27-35` |

## Visión general

### Modelo P00 + clave

GGTO no usa nombre de usuario ni correo para iniciar sesión: la credencial principal es el
**P00**, el identificador laboral del trabajador. El inicio de sesión se resuelve con
`P00 + clave` (`RepoTecnico/requerimientos.md:114`, RF-20). El P00 es un identificador
único en dos entidades distintas: en `tecnico.p00` y en `usuario.p00`
(`RepoTecnico/db/schema.sql:166`, `RepoTecnico/db/schema.sql:179`).

La autenticación es **sin estado** del lado del servidor: el backend valida las
credenciales una vez y entrega un token JWT que el cliente adjunta en cada petición. El
modelo se apoya en tres tablas del esquema: `usuario` (credenciales y estado),
`rol` (catálogo de roles) y `dispositivo_seguridad` (hashes de las palabras de
recuperación) (`RepoTecnico/db/schema.sql:177-193`, `:64-72`, `:545`).

#### El P00 como sujeto del token

El campo `sub` del JWT se llena con `usuario.p00` (`app/core/security.py:63`), y en cada
petición protegida la dependencia `get_current_user` vuelve a buscar el usuario por ese
P00 en la base de datos (`app/api/deps.py:40-44`). Es decir, la sesión no confía en el
token por sí solo: el token identifica al usuario y la base de datos confirma que la
cuenta sigue existiendo, activa y no bloqueada.

#### Primer inicio y recuperación

El flujo previsto combina tres momentos: el **supervisor** registra el P00 en
CONFIGURACIÓN (RF-02, `RepoTecnico/requerimientos.md:91`); el **primer inicio** fija la
clave y genera las 12 palabras con `POST /api/v1/auth/setup`
(`app/api/routes_auth.py:127-168`); y la **recuperación** se hace con 3 de esas 12
palabras mediante `POST /api/v1/auth/unlock` o `POST /api/v1/auth/reset-password`
(`app/api/routes_auth.py:171-206`).

### Roles de la v1

La matriz de roles de la primera versión está documentada en
`RepoTecnico/requerimientos.md:229`: **SUPER**, **ADMIN**, **SUPERVISOR** y **TECNICO**.
Estos cuatro códigos también están sembrados en la tabla `rol` de
`RepoTecnico/db/schema.sql:736-741` de forma idempotente (`ON CONFLICT ... DO NOTHING`).

| Código | Nombre | Descripción sembrada | Referencia |
|---|---|---|---|
| `SUPER` | Super Usuario | Acceso total a todas las secciones y funciones | `RepoTecnico/db/schema.sql:737` |
| `ADMIN` | Administrador | Configura el entorno, usuarios y catálogos | `RepoTecnico/db/schema.sql:738` |
| `SUPERVISOR` | Supervisor | Ingesta, despacho, cuadrillas, reportes y GESTIÓN | `RepoTecnico/db/schema.sql:739` |
| `TECNICO` | Técnico | Gestión de casos en campo | `RepoTecnico/db/schema.sql:740` |

#### Rol SUPER

El rol `SUPER` (Super Usuario) se añadió para cubrir de forma permanente todas las
secciones y funciones, presentes y futuras (decisión D-50,
`RepoTecnico/estado_proyecto.md:114`). En el código se identifica con la constante
`ROL_SUPER = "SUPER"` (`app/api/deps.py:20`) y su rasgo distintivo es el **bypass** de la
dependencia `require_roles` (`app/api/deps.py:65`), explicado más adelante.

#### Roles ADMIN, SUPERVISOR y TECNICO

Cada rol tiene un alcance funcional distinto. La matriz completa rol × módulo × acción
vive en `RepoTecnico/requerimientos.md:237-250`. Los rasgos verificables en el código son:

- La **escritura de CONFIGURACIÓN** exige `ADMIN` o `SUPERVISOR`
  (`app/api/routes_config.py:59`).
- La SPA marca la sesión como de **solo lectura** cuando el rol es `TECNICO`
  (`app/web/src/auth/AuthContext.tsx:17-18`, `:73`).
- La aprobación de escrituras sensibles sigue siendo del backend: una interfaz de solo
  lectura no sustituye al `403` del servidor (`app/api/deps.py:61-70`).

#### Alcance por central

Cada usuario pertenece a **una central** mediante `usuario.id_central`
(`RepoTecnico/db/schema.sql:184`), que acota el alcance (RNF-21,
`RepoTecnico/requerimientos.md:200`). El identificador de central viaja además como campo
extra del token (`app/api/routes_auth.py:115-118`) y se refuerza con **RLS** en las tablas
`caso` y `despacho` (`RepoTecnico/db/schema.sql:697-709`). El rol `SUPER` no está exento
de esa política a nivel de base de datos; su bypass es a nivel de la dependencia de
autorización de la API.

## Primitivas de seguridad

### Argon2id (`app/core/security.py:17-41`)

El hash de contraseñas usa **Argon2id** con los parámetros por defecto de `argon2-cffi`
(RNF-22). El objeto hasher se instancia una sola vez en el módulo
(`app/core/security.py:17`), por lo que todos los hashes comparten el mismo perfil de
costo.

| Función | Firma | Comportamiento | Referencia |
|---|---|---|---|
| `hash_password` | `(password: str) -> str` | Devuelve el hash Argon2id | `app/core/security.py:23-25` |
| `verify_password` | `(password_hash, password) -> bool` | Verifica sin lanzar excepciones | `app/core/security.py:28-33` |
| `needs_rehash` | `(password_hash) -> bool` | Detecta parámetros desactualizados | `app/core/security.py:36-41` |

`verify_password` captura `VerifyMismatchError`, `VerificationError` e `InvalidHashError` y
devuelve `False` en todos los casos (`app/core/security.py:32-33`). Esto evita filtrar
información por diferencia de excepción y hace segura la verificación de un hash corrupto.
`needs_rehash` devuelve `True` si el hash es inválido
(`app/core/security.py:39-41`), lo que permite regenerarlo sin fallar. La prueba unitaria
confirma que el hash devuelto comienza por `$argon2id$` y que hashes sucesivos de la misma
clave difieren por el **sal** (`app/tests/test_security.py:18-26`).

> **Nota de alcance:** RNF-22 menciona también un *pepper* y política de
> complejidad/caducidad/historial de claves (`RepoTecnico/requerimientos.md:201`). En el
> código revisado solo están implementados el hash Argon2id y la validación de longitud
> mínima en los esquemas; el *pepper*, la caducidad y el historial de claves quedan
> **pendientes de confirmar**.

### JWT (`app/core/security.py:56-78`)

El token se construye con `jwt.encode` usando el algoritmo configurado, `HS256` por
defecto (`app/core/config.py:29`), y la clave secreta `secret_key`
(`app/core/security.py:71`). La función `create_access_token` devuelve una tupla
`(token, segundos_de_vigencia)` (`app/core/security.py:56-72`).

| Campo | Origen | Referencia |
|---|---|---|
| `sub` | P00 del usuario (`usuario.p00`) | `app/core/security.py:63` |
| `rol` | Código del rol (`usuario.rol.codigo`) | `app/core/security.py:64` |
| `exp` | `ahora + access_token_minutes` | `app/core/security.py:61,65` |
| `iat` | Instante de emisión | `app/core/security.py:66` |
| `jti` | `secrets.token_hex(8)` | `app/core/security.py:67` |
| extras | `id_central`, entre otros | `app/api/routes_auth.py:117` |

El parámetro `extra` permite añadir campos sin cambiar la firma
(`app/core/security.py:69-70`); el login lo usa para incluir `id_central`
(`app/api/routes_auth.py:115-118`). La decodificación se hace con `jwt.decode` y lanza
`jwt.PyJWTError` si el token es inválido o expiró (`app/core/security.py:75-78`), lo que
la dependencia de autorización traduce a un `401` (`app/api/deps.py:35-38`).

### Normalización de palabras (`app/core/security.py:47-50`)

Antes de comparar una palabra de seguridad, el sistema la normaliza: pasa a minúsculas,
elimina espacios extremos y quita los signos diacríticos con
`unicodedata.normalize("NFKD", ...)` y un filtro de caracteres combinantes
(`app/core/security.py:49-50`). Así, «Árbol», «arbol» y «ARBOL » se consideran la misma
palabra. La prueba unitaria lo verifica con acentos y con la letra Ñ
(`app/tests/test_security.py:29-32`).

La normalización se usa tanto al **guardar** los hashes como al **verificar** las palabras:
en `setup` se hashea `normalizar_palabra(p)` (`app/api/routes_auth.py:143`) y en la
verificación se compara contra `normalizar_palabra(item.valor)`
(`app/api/routes_auth.py:74`). El script de inyección del Super Usuario reutiliza las
mismas funciones para no divergir (`scripts/inyectar_super_usuario.py:44-46`).

### Diccionario de palabras (`app/core/words.py`)

El diccionario es una tupla de palabras sencillas en español, «sin tildes ni Ñ para
teclearlas fácil» (`app/core/words.py:7-20`). La generación se hace con
`secrets.SystemRandom().sample(...)`, que garantiza palabras **únicas** y aleatorias
criptográficamente (`app/core/words.py:23-27`).

| Elemento | Valor real | Referencia |
|---|---|---|
| Cantidad de entradas del diccionario | 110 palabras | `app/core/words.py:8-20` |
| Cantidad por dispositivo | 12 (`palabras_seguridad`) | `app/core/config.py:32` |
| Cantidad requerida en recuperación | 3 (`palabras_requeridas`) | `app/core/config.py:33` |
| Generador | `secrets.SystemRandom().sample` | `app/core/words.py:27` |

`generar_palabras` valida que no se pidan más palabras de las disponibles y lanza
`ValueError` si ocurre (`app/core/words.py:25-26`). La prueba unitaria comprueba que se
generan 12 palabras, todas distintas y en minúsculas (`app/tests/test_security.py:48-52`).
El docstring del módulo habla de «las 12 palabras» (`app/core/words.py:1`), que es la
cantidad que efectivamente se genera en `setup` (`app/api/routes_auth.py:142`).

## Endpoints de autenticación

El router se declara con prefijo `/api/v1/auth` y etiqueta `autenticación`
(`app/api/routes_auth.py:33`) y se monta en la aplicación en `app/main.py:78`. La
documentación OpenAPI del proyecto contabiliza estas rutas dentro de las 73 rutas
publicadas.

### POST /api/v1/auth/login

`app/api/routes_auth.py:79`. Recibe un `LoginRequest` y devuelve un `TokenResponse`
(`app/api/routes_auth.py:79`). La secuencia real es:

1. Aplica el *rate limit* por `p00|IP` (`app/api/routes_auth.py:82-83`).
2. Busca el usuario por P00; si no existe, responde `401` con mensaje genérico
   (`app/api/routes_auth.py:85-88`).
3. Si la cuenta está inactiva, responde `403` (`app/api/routes_auth.py:89-90`).
4. Si está bloqueada, responde `423` con la indicación de usar la recuperación
   (`app/api/routes_auth.py:91-95`).
5. Si la clave no verifica, incrementa `intentos_fallidos` y, al alcanzar el máximo,
   marca `bloqueado = True`; responde `401` o `423` según el caso e incluye la cabecera
   `X-Intentos-Restantes` (`app/api/routes_auth.py:97-109`).
6. Si la clave verifica, reinicia `intentos_fallidos`, desbloquea y emite el token
   (`app/api/routes_auth.py:111-119`).

### GET /api/v1/auth/me

`app/api/routes_auth.py:122`. Devuelve los datos del usuario autenticado como `UsuarioOut`
(`app/api/routes_auth.py:122-124`). No recibe parámetros: depende por completo de la
cabecera `Authorization: Bearer`. La respuesta se arma con `_usuario_out`, que incluye el
código de rol y el nombre del técnico asociado si existe
(`app/api/routes_auth.py:52-61`). Es el endpoint que la SPA usa para revalidar la sesión
guardada (`app/web/src/auth/AuthContext.tsx:41-47`).

### POST /api/v1/auth/setup

`app/api/routes_auth.py:127`. Primer inicio de la aplicación: fija la clave del P00 y
genera las 12 palabras (`app/api/routes_auth.py:130`). El P00 debe existir previamente,
creado por el supervisor (RF-02, `app/api/routes_auth.py:133`).

- Si `clave` y `confirmacion` no coinciden, responde `422`
  (`app/api/routes_auth.py:134-135`).
- Si el P00 no está registrado, responde `404` (`app/api/routes_auth.py:137-139`).
- Hashea las 12 palabras normalizadas (`app/api/routes_auth.py:142-143`).
- Actualiza `usuario.clave_hash`, correo, intentos y banderas
  (`app/api/routes_auth.py:145-149`).
- Crea o actualiza `dispositivo_seguridad`, incrementa su `version` y lo desbloquea
  (`app/api/routes_auth.py:151-159`).
- Sincroniza el correo del técnico asociado si existe
  (`app/api/routes_auth.py:161-165`).
- Devuelve `SetupResponse` con las palabras en claro para que el usuario las guarde
  (`app/api/routes_auth.py:167-168`).

### POST /api/v1/auth/unlock

`app/api/routes_auth.py:171`. Desbloquea una cuenta con 3 de las 12 palabras
(`app/api/routes_auth.py:171`). Si el P00 no existe, responde `404`
(`app/api/routes_auth.py:173-175`); si la verificación de palabras falla, responde `401`
(`app/api/routes_auth.py:179-180`). En caso correcto pone `bloqueado = False`, reinicia
`intentos_fallidos` y desbloquea también el dispositivo (`app/api/routes_auth.py:182-187`).

### POST /api/v1/auth/reset-password

`app/api/routes_auth.py:190`. Restablece la clave con 3 de las 12 palabras
(`app/api/routes_auth.py:190`). Reutiliza la misma verificación de palabras y responde
`404` o `401` en los mismos casos (`app/api/routes_auth.py:192-199`). Al validar,
reemplaza `clave_hash` por el hash de `nueva_clave`, desbloquea la cuenta y limpia
`requiere_cambio_clave` (`app/api/routes_auth.py:201-205`).

### Esquemas Pydantic

Los contratos de entrada y salida están en `app/schemas/auth.py` y fijan buena parte de la
validación antes de llegar al código de negocio.

| Esquema | Restricciones reales | Referencia |
|---|---|---|
| `LoginRequest` | `p00` 3–20 caracteres; `clave` 4–128 | `app/schemas/auth.py:8-10` |
| `UsuarioOut` | p00, correo, rol, id_rol, id_central, nombre, apellido | `app/schemas/auth.py:13-20` |
| `TokenResponse` | `access_token`, `token_type="bearer"`, `expires_in`, `usuario` | `app/schemas/auth.py:23-27` |
| `PalabraPosicion` | `pos` entre 1 y 12; `valor` 1–40 caracteres | `app/schemas/auth.py:30-32` |
| `UnlockRequest` | lista de exactamente 3 palabras | `app/schemas/auth.py:35-37` |
| `ResetPasswordRequest` | 3 palabras y `nueva_clave` de 8 a 128 | `app/schemas/auth.py:40-43` |
| `SetupRequest` | correo 5–120; clave y confirmación de 8 a 128 | `app/schemas/auth.py:46-52` |
| `SetupResponse` | palabras y aviso de guardarlas | `app/schemas/auth.py:55-58` |

> La longitud exacta de 3 palabras se impone en el esquema (`min_length=3, max_length=3`),
> mientras que el parámetro `palabras_requeridas` existe en la configuración
> (`app/core/config.py:33`) pero **no se consulta** en `routes_auth.py`. Se documenta el
> hecho: hoy el número está fijado por el esquema, no por el parámetro.

## Bloqueo y rate limiting

### max_intentos, palabras_requeridas y rate limit (`app/core/config.py:27-35`)

Los parámetros de seguridad se leen de variables de entorno mediante `pydantic-settings`
(`app/core/config.py:8-9`) y se exponen como atributos del objeto `Settings`.

| Parámetro | Valor por defecto | Uso | Referencia |
|---|---|---|---|
| `access_token_minutes` | 480 (8 h) | Vigencia del token | `app/core/config.py:30` |
| `max_intentos` | 3 | Intentos antes del bloqueo | `app/core/config.py:31` |
| `palabras_seguridad` | 12 | Palabras generadas por dispositivo | `app/core/config.py:32` |
| `palabras_requeridas` | 3 | Palabras exigidas para recuperar | `app/core/config.py:33` |
| `rate_limit_intentos` | 10 | Peticiones por ventana | `app/core/config.py:34` |
| `rate_limit_ventana_seg` | 60 | Ventana en segundos | `app/core/config.py:35` |

El bloqueo efectivo se decide en `login`: cada fallo incrementa `intentos_fallidos` y, al
llegar a `max_intentos`, marca `bloqueado = True` (`app/api/routes_auth.py:98-101`). El
valor de intentos restantes viaja en la cabecera `X-Intentos-Restantes`
(`app/api/routes_auth.py:99,108`). La prueba de integración comprueba que el primer fallo
devuelve 2 restantes (`app/tests/test_auth.py:81-84`) y que el tercero responde `423`
incluso con la clave correcta (`app/tests/test_auth.py:87-94`).

> En la tabla `configuracion` también existe la clave `seguridad.max_intentos = 3`
> (`RepoTecnico/db/schema.sql:795-796`). El código de autenticación revisado usa
> `get_settings()` (`app/api/routes_auth.py:81`) y no lee ese parámetro de la base de
> datos; la duplicación queda **pendiente de confirmar** (si se desea un único origen).

### Mecanismo del rate limiting

El limitador es **en memoria del proceso**, no distribuido. Se apoya en un diccionario
`defaultdict(deque)` de marcas de tiempo (`app/api/routes_auth.py:36`) y una función que
descarta las marcas fuera de la ventana y responde `429` al superar el máximo
(`app/api/routes_auth.py:39-49`). La clave del cubo es `f"{datos.p00}|{ip}"`
(`app/api/routes_auth.py:82-83`), de modo que ráfagas contra el mismo P00 desde la misma
IP se frenan sin afectar a otros usuarios.

| Evento | Respuesta | Referencia |
|---|---|---|
| Supera 10 intentos en 60 s | `429 Too Many Requests` | `app/api/routes_auth.py:44-48` |
| P00 inexistente | `401` genérico | `app/api/routes_auth.py:86-88` |
| Usuario inactivo | `403` | `app/api/routes_auth.py:89-90` |
| Usuario bloqueado | `423 Locked` | `app/api/routes_auth.py:91-95` |
| Clave incorrecta | `401` con `X-Intentos-Restantes` | `app/api/routes_auth.py:105-109` |
| Tercer fallo | `423` y `bloqueado = True` | `app/api/routes_auth.py:100-106` |

### Recuperación del bloqueo

El desbloqueo no depende del paso del tiempo ni de un administrador: se resuelve con las
palabras de seguridad. `_verificar_palabras` recorre las posiciones enviadas, calcula
`indice = pos - 1`, valida el rango y compara el hash correspondiente
(`app/api/routes_auth.py:64-76`). Si alguna posición o palabra falla, devuelve `False`.
Las pruebas cubren el desbloqueo correcto (`app/tests/test_auth.py:118-141`), el rechazo
con palabras incorrectas (`app/tests/test_auth.py:144-158`) y el restablecimiento de clave
(`app/tests/test_auth.py:171-188`).

## Sesión y token

### Vigencia de 8 horas

El token dura **480 minutos** por defecto (`app/core/config.py:30`), equivalente a una
jornada de 8 horas. La vigencia se calcula con `exp = ahora + timedelta(minutes=minutos)`
(`app/core/security.py:61`) y se devuelve también en segundos como `expires_in`
(`app/core/security.py:72`, `app/api/routes_auth.py:119`). La prueba unitaria inyecta 5
minutos y comprueba que `expira == 300` (`app/tests/test_security.py:35-40`).

`access_token_minutes` es configurable por entorno (`app/core/config.py:30`). No existe en
el código revisado un mecanismo de **rotación** ni de **revocación** de tokens distinto
del bloqueo de la cuenta: el campo `jti` se genera (`app/core/security.py:67`) pero no se
persiste en ninguna tabla de sesiones. La rotación y la revocación de sesión que menciona
RNF-22 (`RepoTecnico/requerimientos.md:201`) quedan **pendientes de confirmar**.

### X-Request-ID y observabilidad

Toda petición pasa por `ObservabilidadMiddleware` (`app/main.py:49-65`). El middleware lee
la cabecera `X-Request-ID` del cliente o genera un identificador con
`uuid.uuid4().hex[:12]` (`app/main.py:53`), y lo reescribe en la respuesta
(`app/main.py:62`). También registra una línea de bitácora con método, ruta, código de
estado y duración en milisegundos (`app/main.py:63-64`), y registra las excepciones con el
mismo `request_id` (`app/main.py:57-60`). El middleware se agrega antes que CORS
(`app/main.py:68-75`), de modo que la cabecera está presente también en respuestas de
error gestionadas por la aplicación.

### Expiración y cierre de sesión en la SPA

La SPA guarda el token y el usuario en `localStorage` bajo las claves `ggto_token` y
`ggto_usuario` (`app/web/src/api/client.ts:95-96`), expuestas mediante `getToken`,
`getUsuarioGuardado`, `guardarSesion` y `limpiarSesion`
(`app/web/src/api/client.ts:141-163`). En cada llamada, el cliente adjunta
`Authorization: Bearer <token>` si existe (`app/web/src/api/client.ts:192-193`).

Al montar, `AuthProvider` revalida el token con `GET /auth/me`; si la llamada falla,
limpia la sesión y deja al usuario en `null` (`app/web/src/auth/AuthContext.tsx:35-59`).
`iniciarSesion` llama a `login`, guarda el token y la respuesta, y actualiza el estado
(`app/web/src/auth/AuthContext.tsx:61-66`). El cierre de sesión llama a `limpiarSesion`
(`app/web/src/auth/AuthContext.tsx:29-32`).

### Almacenamiento del token

| Elemento | Valor | Referencia |
|---|---|---|
| Clave del token en `localStorage` | `ggto_token` | `app/web/src/api/client.ts:95` |
| Clave del usuario en `localStorage` | `ggto_usuario` | `app/web/src/api/client.ts:96` |
| Cabecera de autorización | `Bearer` | `app/web/src/api/client.ts:193` |
| Endpoint de revalidación | `GET /api/v1/auth/me` | `app/web/src/api/client.ts:268-270` |

> Almacenar el token en `localStorage` es vulnerable a XSS; el endurecimiento previsto en
> RNF-22 incluye protección CSRF/CORS (`RepoTecnico/requerimientos.md:201`). El middleware
> CORS está configurado con `cors_origins` (`app/main.py:69-75`, `app/core/config.py:38`).
> Una revisión específica de XSS/CSRF sobre la SPA queda **pendiente de confirmar**.

## RBAC

### get_current_user (`app/api/deps.py:29-49`)

Es la dependencia base de autenticación. Usa un esquema `HTTPBearer(auto_error=False)`
(`app/api/deps.py:17`), lo que permite responder con un mensaje propio en vez del error
automático. Su lógica es:

1. Si no hay credencial, lanza `CREDENCIALES_INVALIDAS` (`401`) (`app/api/deps.py:33-34`).
2. Decodifica el token y convierte cualquier `jwt.PyJWTError` en `401`
   (`app/api/deps.py:35-38`).
3. Extrae `sub`; si falta, `401` (`app/api/deps.py:40-42`).
4. Busca el usuario por `p00`; si no existe o no está activo, `401`
   (`app/api/deps.py:44-46`).
5. Si está bloqueado, responde `423` (`app/api/deps.py:47-48`).

La definición reutilizable del `401` incluye la cabecera `WWW-Authenticate: Bearer`
(`app/api/deps.py:22-26`). Esta dependencia se usa directamente en endpoints de solo
lectura, por ejemplo el listado de centrales (`app/api/routes_config.py:83`).

### require_roles y bypass SUPER (`app/api/deps.py:52-72`)

`require_roles(*roles)` es una **fábrica** de dependencias: recibe los códigos aceptados y
devuelve una función `_check` (`app/api/deps.py:52-59`). Su decisión es:

- Si el usuario no tiene rol asociado, responde `403` (`app/api/deps.py:60-64`).
- Si `usuario.rol.codigo == ROL_SUPER` **o** el código está entre los roles indicados,
  permite el paso (`app/api/deps.py:65-66`).
- En cualquier otro caso, responde `403` con «No tiene permisos para esta operación»
  (`app/api/deps.py:67-70`).

El bypass del Super Usuario no requiere enumerarlo en cada endpoint
(`app/api/deps.py:53-57`), tal como exige D-50
(`RepoTecnico/requerimientos.md:252-253`). El patrón de uso típico es declarar una vez
`_escritura = require_roles("ADMIN", "SUPERVISOR")` y aplicarlo con
`Depends(_escritura)` (`app/api/routes_config.py:59,96`).

### Matriz rol × módulo (`RepoTecnico/requerimientos.md:227-256`)

La matriz oficial de la v1 cruza cada módulo con los cuatro roles. Se reproduce de forma
resumida, respetando el texto del documento:

| Módulo / acción | SUPER | ADMIN | SUPERVISOR | TECNICO |
|---|---|---|---|---|
| CONFIGURACIÓN (central, sectores, catálogos, usuarios, flota, cuadrillas) | CRUD | CRUD | Lectura + edición operativa | — |
| INGESTA (cargar y procesar CSV) | CRUD | CRUD | CRUD | — |
| PANEL (buscar, editar, alta manual) | CRUD | CRUD | CRUD | Lectura de sus casos |
| CASOS / SEGUIMIENTO / EMPRESAS / REFERIDOS | CRUD | CRUD | CRUD | Lectura + gestión de su cuadrilla |
| DESPACHO (armar, publicar, reporte 16:00) | CRUD | CRUD | CRUD | Lectura de su despacho |
| GESTIÓN (cuadrilla 0) | CRUD | CRUD | CRUD | — |
| MONITOREO / GRÁFICOS | Lectura | Lectura | Lectura | — |
| GESTIÓN TÉCNICA (contactar, atender, cerrar, enrutar, diferir, evidencias) | CRUD | — | Lectura | CRUD (solo sus casos y offline) |
| ALERTAS (falla masiva, incidentes, solicitud de material) | CRUD | Lectura | Lectura | CRUD |
| INSUMOS (v2) | CRUD | CRUD | CRUD | Solicitud |
| AUDITORÍA | Lectura | Lectura | — | — |
| USUARIOS y accesos | CRUD | CRUD | Alta/baja de técnicos | — |

Cada usuario pertenece a una central y el alcance se refuerza con RLS
(`RepoTecnico/requerimientos.md:229-230`). El documento advierte además que la columna
`SUPER` es siempre acceso total porque no se enumera en los endpoints
(`RepoTecnico/requerimientos.md:252-253`).

> RNF-22 exige **MFA obligatorio para ADMIN y SUPERVISOR**
> (`RepoTecnico/requerimientos.md:201,255`). El código revisado implementa únicamente
> P00 + clave + 12 palabras; no se encontró un segundo factor. El MFA queda **pendiente de
> confirmar**.

### Aplicación en los routers

| Patrón | Significado | Ejemplo real |
|---|---|---|
| `Depends(get_current_user)` | Solo requiere sesión válida | `app/api/routes_config.py:83` |
| `Depends(_escritura)` | Exige ADMIN o SUPERVISOR (o SUPER) | `app/api/routes_config.py:96` |
| `require_roles("ADMIN", "SUPERVISOR")` | Definición de la fábrica | `app/api/routes_config.py:59` |

## Super Usuario

### Creación con `scripts/inyectar_super_usuario.py`

El Super Usuario se aprovisiona con un script explícito, idempotente y con confirmación
(`scripts/inyectar_super_usuario.py:1-30`). El script:

- Reutiliza exactamente las mismas funciones de hash y de palabras que la aplicación
  (`scripts/inyectar_super_usuario.py:44-46`).
- Resuelve el rol `SUPER`; si no existe en el catálogo, lo crea
  (`scripts/inyectar_super_usuario.py:115-128`). El catálogo ya lo trae sembrado en
  `RepoTecnico/db/schema.sql:737`.
- Resuelve la central indicada o la primera activa
  (`scripts/inyectar_super_usuario.py:131-144`).
- Crea o actualiza la ficha del técnico (`:192-210`) y la cuenta de usuario con
  `activo=true`, `bloqueado=false` e `intentos_fallidos=0` (`:212-231`).
- Opcionalmente genera y guarda las 12 palabras de seguridad (`:233-247`).
- Registra cada ejecución en `RepoTecnico/BaseOperaciones/inyeccion_super_usuario.log`
  (`scripts/inyectar_super_usuario.py:82`).
- Admite `--dry-run`, que hace `rollback` en lugar de `commit` (`:249-254`), y `--si`
  para omitir la confirmación interactiva (`:178-182`).

### Manejo de la clave

La clave **nunca** se escribe en el archivo ni en la línea de comandos: se lee de la
variable de entorno indicada por `--clave-env` (por defecto `GGTO_SUPER_CLAVE`) o se
solicita de forma oculta con `getpass` (`scripts/inyectar_super_usuario.py:13-15,164-169`).
Se exige una longitud mínima de 8 caracteres salvo en simulación (`:170-172`). En este
manual solo se documenta el **nombre** de la variable de entorno, nunca su valor.

### Palabras en dispositivo_seguridad

Las palabras se guardan únicamente como hashes en la columna JSONB `palabras_hash` de la
tabla `dispositivo_seguridad` (`RepoTecnico/db/schema.sql:545`, `app/models/entities.py:92`).
El modelo `DispositivoSeguridad` incluye además `clave_privada_ref`, `documento_cifrado`,
`bloqueado` y `version` (`app/models/entities.py:85-97`). El script inserta o actualiza
con `ON CONFLICT (p00) DO UPDATE` e incrementa `version`
(`scripts/inyectar_super_usuario.py:240-246`). El endpoint `setup` hace lo mismo desde la
API e incrementa `version` (`app/api/routes_auth.py:151-159`). Las palabras en claro se
muestran una sola vez (`app/schemas/auth.py:58`, `scripts/inyectar_super_usuario.py:271-274`).

### Verificación y bitácora

Tras el `commit`, el script ejecuta una consulta de verificación que une `usuario`, `rol` y
`tecnico` y registra el resultado (`scripts/inyectar_super_usuario.py:256-267`). La
existencia del rol y su efecto fueron verificados en producción según D-50
(`RepoTecnico/estado_proyecto.md:114`). El detalle de las credenciales usadas no se
reproduce aquí por tratarse de datos sensibles.

## Pruebas

### `app/tests/test_auth.py`

Prueba de integración del Ciclo 1: login, bloqueo, recuperación y sesiones
(`app/tests/test_auth.py:1-3`). Requiere base de datos; si `GGTO_TEST_DB_URL` no está
definida, las pruebas de integración se omiten (`app/tests/conftest.py:24-25,70-72`).

| Prueba | Qué verifica | Referencia |
|---|---|---|
| `test_login_correcto` | `200`, `token_type=bearer`, rol `TECNICO` | `app/tests/test_auth.py:55-61` |
| `test_login_p00_inexistente` | `401` | `app/tests/test_auth.py:64-66` |
| `test_rate_limit_bloquea_rafagas` | aparece `429` | `app/tests/test_auth.py:69-78` |
| `test_login_clave_incorrecta` | `401` y `X-Intentos-Restantes = 2` | `app/tests/test_auth.py:81-84` |
| `test_bloqueo_a_los_tres_intentos` | tercero `423` y bloqueo persistente | `app/tests/test_auth.py:87-94` |
| `test_setup_genera_doce_palabras` | 12 palabras y login posterior | `app/tests/test_auth.py:97-107` |
| `test_setup_confirmacion_no_coincide` | `422` | `app/tests/test_auth.py:110-115` |
| `test_desbloqueo_con_tres_palabras` | `200` y desbloqueo | `app/tests/test_auth.py:118-141` |
| `test_desbloqueo_con_palabras_incorrectas` | `401` | `app/tests/test_auth.py:144-158` |
| `test_me_requiere_token` | `401` sin token y `200` con token | `app/tests/test_auth.py:161-168` |
| `test_restablecer_clave_con_palabras` | nueva clave operativa | `app/tests/test_auth.py:171-188` |

El informe de Fase 4 registra 11 pruebas en este archivo
(`RepoTecnico/pruebas/informe_fase4.md:81`).

### `app/tests/test_security.py`

Pruebas unitarias que **no requieren base de datos** (`app/tests/test_security.py:1`):
hash y verificación Argon2id (`:18-22`), salado (`:25-26`), normalización de palabras
(`:29-32`), ida y vuelta del token (`:35-40`), token inválido (`:43-45`) y generación de
palabras (`:48-52`). El informe de Fase 4 registra 6 pruebas
(`RepoTecnico/pruebas/informe_fase4.md:82`).

### RBAC de la SPA

En el cliente, `AuthProvider` expone `autenticado`, `cargando` y `soloLectura`, calculado
este último como `usuario?.rol === 'TECNICO'` (`app/web/src/auth/AuthContext.tsx:68-78`).
Las páginas de CONFIGURACIÓN usan `soloLectura` para ocultar formularios y botones de
escritura, por ejemplo en Centrales (`app/web/src/pages/Centrales.tsx:53,164,288`),
Sectores (`app/web/src/pages/Sectores.tsx:50,251,474`) y Técnicos
(`app/web/src/pages/Tecnicos.tsx:35,177,319`).

`RutaProtegida` bloquea las rutas privadas: mientras `cargando` es verdadero muestra
«Validando sesión…», y si no hay sesión redirige a `/login` con `<Navigate replace />`
(`app/web/src/components/RutaProtegida.tsx:5-18`). Las rutas se declaran en `App.tsx`:
`/login` es pública, el resto cuelga de `RutaProtegida` y `*` redirige a `/`
(`app/web/src/App.tsx:24-46`). Las pruebas de configuración del backend verifican además
que un `TECNICO` recibe `403` al crear flota (`app/tests/test_config.py:149-155`) y `200`
al leer centrales (`app/tests/test_config.py:158-160`).

> La interfaz oculta controles, pero la autorización real ocurre en la API. Cualquier
> endpoint nuevo debe declarar su `Depends(...)` correspondiente; de lo contrario quedaría
> accesible para cualquier sesión válida.
