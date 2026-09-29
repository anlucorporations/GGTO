# Manual de Seguridad y Privacidad — GGTO

| Campo | Valor |
|---|---|
| Proyecto | GGTO — Sistema de administración de reportes de avería y construcción de puntos ópticos |
| Cliente | CANTV C.A. — Central Francisco Salias (Área 4) |
| Alcance | Modelo de seguridad, RBAC, RLS, secretos, PII, superficie de exposición y endurecimiento |
| Requerimientos aplicables | RNF-01…RNF-05, RNF-18, RNF-21, RNF-22 (`RepoTecnico/requerimientos.md:180-204`) |
| Riesgo aceptado vigente | **D-26** — instancia compartida sin backups/PITR/SSL obligatorio (`RepoTecnico/estado_proyecto.md:90`) |

> Este manual describe **lo que el código implementa hoy** y separa con claridad lo que está
> **previsto pero no implementado**. Todo dato no verificable se marca como **«pendiente de
> confirmar»**. No se incluyen secretos ni contraseñas: solo se citan **nombres** de secretos.

---

## Modelo de seguridad

### Defensa en capas

La seguridad de GGTO se apoya en varias capas independientes:

| Capa | Mecanismo | Implementación |
|---|---|---|
| Perímetro de red | Servicio Cloud Run y Cloud SQL en GCP | `RepoTecnico/entornos_globales.md:313-325` |
| Autenticación | `P00` + clave con hash Argon2id y token JWT | `app/core/security.py:17,23-25,56-72` |
| Autorización | RBAC por rol con *bypass* de `SUPER` | `app/api/deps.py:52-72` |
| Aislamiento de datos | RLS en PostgreSQL sobre `caso` y `despacho` | `RepoTecnico/db/schema.sql:708-726` |
| Secretos | Google Secret Manager con CMEK | `RepoTecnico/scripts/04_secretos_kms.sh:6-23,43-46` |
| Observabilidad | `request-id` y métricas de negocio | `app/main.py:49-65`, `app/api/routes_alertas.py:400-423` |
| Trazabilidad | Bitácora de estados del caso | `app/api/routes_casos.py:36-49,317-329` |

### Autenticación

El ingreso a la plataforma se realiza con **`P00` (identificador laboral) + clave**
(`RepoTecnico/estado_proyecto.md:160`). La clave se almacena como hash **Argon2id** con los
parámetros por defecto de `argon2-cffi` (`app/core/security.py:16-25`). El perfil del dispositivo
guarda **12 palabras de seguridad**, de las cuales se exigen **3** para desbloquear o restablecer la
clave (`app/core/config.py:32-33`); el diccionario de palabras está en `app/core/words.py:8-20` y se
genera de forma aleatoria con `secrets.SystemRandom` (`app/core/words.py:23-27`).

| Control | Valor real | Referencia |
|---|---|---|
| Hash de clave | Argon2id (parámetros por defecto) | `app/core/security.py:17` |
| Algoritmo del token | HS256 | `app/core/config.py:29` |
| Vigencia del token | 480 minutos (8 h) | `app/core/config.py:30` |
| Contenido del token | `sub` (P00), `rol`, `exp`, `iat`, `jti` | `app/core/security.py:62-68` |
| Intentos antes del bloqueo | 3 | `app/core/config.py:31` |
| Rate limiting | 10 intentos / 60 s por `P00`+IP | `app/core/config.py:34-35`, `app/api/routes_auth.py:41-51,85` |
| Normalización de palabras | minúsculas y sin acentos | `app/core/security.py:47-50` |
| Mensaje ante `P00` inexistente | genérico (no revela existencia) | `app/api/routes_auth.py:88-90` |
| Bloqueo | `usuario.bloqueado = true` al 3.er fallo; responde `423` | `app/api/routes_auth.py:99-111` |
| Desbloqueo | 3 de las 12 palabras | `app/api/routes_auth.py:66-78,330-346` |
| Restablecer clave | 3 de las 12 palabras | `app/api/routes_auth.py:349-365` |
| Primer acceso (D-67) | Comprueba el P00 y crea la cuenta con las 12 palabras; *rate limit* propio de 30/60 s por IP | `app/api/routes_auth.py:219-272` |
| Regeneración de palabras (D-67) | Solo `SUPER`; 12 palabras nuevas, desbloquea y audita | `app/api/routes_auth.py:275-327` |

El token se valida en cada petición: si falta, es inválido o está expirado se devuelve `401`; si el
usuario está bloqueado se devuelve `423` (`app/api/deps.py:22-26,33-48`).

> **Punto de atención:** `secret_key` tiene un valor por defecto de desarrollo
> («cambiar-esta-clave-en-produccion», `app/core/config.py:28`). En producción debe venir de Secret
> Manager (`SECRET_KEY`, `RepoTecnico/entornos_globales.md:136`); si no se sobrescribe, cualquier
> token podría forjarse. Verificar este valor en cada despliegue es una tarea operativa crítica.

### Autorización

La autorización se resuelve con la fábrica `require_roles(*roles)`
(`app/api/deps.py:52-72`). Cada módulo declara los roles de **escritura**; la lectura se concede a
cualquier usuario autenticado mediante `Depends(get_current_user)`.

| Módulo | Guardia de escritura | Referencia |
|---|---|---|
| Ingesta | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_ingesta.py:23` |
| PANEL / CASOS | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_casos.py:26` |
| DESPACHO | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_despachos.py:42` |
| ESPECIALES / AGENDA | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_especiales.py:41` |
| CONFIGURACIÓN | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_config.py:60` |
| ALERTAS / OUTBOX | `require_roles("ADMIN", "SUPERVISOR")` | `app/api/routes_alertas.py:31` |
| MONITOREO / REPORTES | Solo lectura (cualquier autenticado) | `app/api/routes_monitoreo.py:32-124` |

En la SPA, el menú **CONFIGURACIÓN** solo se muestra a `SUPER`, `ADMIN` y `SUPERVISOR`
(`const ROLES_CONFIG = ['SUPER', 'ADMIN', 'SUPERVISOR']`, `app/web/src/components/Layout.tsx:53,170`).
El rol `TECNICO` ve los formularios en **modo solo lectura**
(`app/web/src/components/Layout.tsx:188,218`). Ocultar el menú es una ayuda de usabilidad, **no** un
control de seguridad: la autorización efectiva ocurre en el backend.

### Auditoría

La tabla `auditoria` está definida en el esquema con `usuario`, `accion`, `entidad`, `id_entidad`,
`datos_antes`, `datos_despues`, `ip` y `fecha_hora` (`RepoTecnico/db/schema.sql:659-669`). Desde el
ciclo **D-67** existe además el modelo ORM `Auditoria` (`app/models/entities.py:100-116`) y la
aplicación **sí escribe** en la tabla en dos puntos del router de autenticación:

| Acción | Origen | Datos | Referencia |
|---|---|---|---|
| `ALTA_PRIMER_ACCESO` | `POST /auth/setup` | P00, correo y versión de palabras | `app/api/routes_auth.py:206-214` |
| `REGENERAR_PALABRAS` | `POST /auth/palabras/{p00}/regenerar` (solo SUPER) | P00 solicitante, P00 afectado, versión anterior/nueva e IP | `app/api/routes_auth.py:315-325` |

Las palabras de seguridad nunca se registran en claro: solo se guardan sus hashes Argon2id en
`dispositivo_seguridad.palabras_hash` (`app/models/entities.py:92`,
`RepoTecnico/db/schema.sql:565`), de modo que la auditoría de la regeneración no expone el secreto.

La trazabilidad efectiva en v1 se completa con:

- la **bitácora de estados** `caso_estado_hist`, que registra estado anterior, estado nuevo,
  motivo y usuario (`app/api/routes_casos.py:36-49`) y se consulta por caso
  (`app/api/routes_casos.py:317-329`);
- el campo `caso.creado_por` (`RepoTecnico/db/schema.sql:305`);
- el log del middleware, que **no incluye el usuario** (`app/main.py:62-64`).

RNF-12 y RNF-19 exigen registro de usuario, fecha/hora y cambios sobre cada caso, además de logs con
usuario (`RepoTecnico/requerimientos.md:191,198`). El registro en `auditoria` ya cubre el alta y la
regeneración de accesos; el **usuario en los logs** del middleware sigue **pendiente de confirmar /
no implementado**.

---

## RBAC

### 4 roles y bypass SUPER

Los roles de la v1 son **SUPER, ADMIN, SUPERVISOR y TECNICO**
(`RepoTecnico/requerimientos.md:229`). Cada usuario pertenece a **una central**
(`usuario.id_central`, `RepoTecnico/requerimientos.md:230`).

El rol **`SUPER`** (Super Usuario) tiene **acceso total**: `require_roles` le concede cualquier
operación sin necesidad de enumerarlo en cada endpoint
(`ROL_SUPER = "SUPER"`, `app/api/deps.py:20`; comparación en `app/api/deps.py:65`). Es una decisión
explícita (**D-50**, `RepoTecnico/estado_proyecto.md:114`) que cubre también las secciones y funciones
futuras. La cuenta se crea con `scripts/inyectar_super_usuario.py`, que es idempotente, pide
confirmación y **no escribe la clave en el archivo ni en la línea de comandos** (la lee de la variable
`GGTO_SUPER_CLAVE` o la solicita de forma oculta, `scripts/inyectar_super_usuario.py:12-18,164-172`).

| Aspecto de `SUPER` | Comportamiento | Referencia |
|---|---|---|
| Bypass de autorización | Cualquier operación permitida | `app/api/deps.py:65` |
| Creación de la cuenta | Script con confirmación y bitácora | `scripts/inyectar_super_usuario.py:174-182` |
| Hash de la clave | Reutiliza el mismo Argon2id de la app | `scripts/inyectar_super_usuario.py:44-47,213` |
| Palabras | Opcionales con `--con-palabras` | `scripts/inyectar_super_usuario.py:233-247` |

### Matriz rol × módulo (requerimientos.md:227-256)

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

Corresponde a `RepoTecnico/requerimientos.md:237-250`. El rol `SUPER` no se enumera en los endpoints
porque el bypass de `require_roles` le concede todo (`RepoTecnico/requerimientos.md:252-253`).

> **Brechas verificadas entre la matriz y el código:**
> 1. La matriz prevé la gestión de **USUARIOS y accesos**, pero el inventario de endpoints **no
>    incluye `/api/v1/usuarios`** ni existe pantalla dedicada para darlos de alta. Desde D-67 el
>    **técnico** puede crear su propia cuenta en el primer acceso (`POST /auth/setup`, solo rol
>    `TECNICO`), y el Super Usuario se sigue aprovisionando con `scripts/inyectar_super_usuario.py`;
>    la administración de cuentas de otros roles queda **pendiente de confirmar**.
> 2. La matriz limita al TECNICO a «sus casos», pero el listado de casos solo filtra por
>    `id_central` si el cliente lo envía como parámetro (`app/api/routes_casos.py:126-127`); no hay
>    acotación automática por `usuario.id_central`. **Pendiente de confirmar** (ver «RLS»).
> 3. Toda la escritura por encima de TECNICO exige ADMIN o SUPERVISOR; no existe un rol con permiso
>    de escritura exclusivo de MONITOREO. La excepción singular es la regeneración de palabras, que
>    exige `SUPER` (`app/api/routes_auth.py:284`).

### Pruebas negativas

Las pruebas de autorización y de interfaz están documentadas en el informe de Fase 4:

| Prueba | Ámbito | Resultado | Referencia |
|---|---|---|---|
| `test_config.py` (13) | RBAC de escritura en CONFIGURACIÓN | 13/13 | `RepoTecnico/pruebas/informe_fase4.md:79` |
| `11-rbac.spec.js` (4) | TECNICO solo lectura, ADMIN operativo | 4/4 | `RepoTecnico/pruebas/informe_fase4.md:65` |
| `02-navegacion.spec.js` (7) | RBAC del menú y secciones | 7/7 | `RepoTecnico/pruebas/informe_fase4.md:56` |
| `test_auth.py` | Login, bloqueo, desbloqueo, 12 palabras y, desde D-67, primer acceso y regeneración solo SUPER (15 funciones) | — | `app/tests/test_auth.py:208-317` |

El total de Fase 4 fue **169/169 `pytest` + 46/46 E2E = 215 pruebas en verde**
(`RepoTecnico/pruebas/informe_fase4.md:16-20,103-107`). Las pruebas negativas **entre centrales**
(central A no accede a datos de central B) que exige RNF-21
(`RepoTecnico/requerimientos.md:200`) **no se documentan** en el informe y están **pendientes de
confirmar**.

---

## RLS en PostgreSQL

### Caso y despacho

El *Row Level Security* se aplica como **defensa en profundidad** sobre dos tablas:
`caso` y `despacho`, ambas con `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`
(`RepoTecnico/db/schema.sql:714-715,721-722`). La función `app_central_actual()` lee el parámetro de
sesión `app.id_central` y lo convierte a entero (`RepoTecnico/db/schema.sql:708-712`).

### Políticas

| Tabla | Política | Regla | Referencia |
|---|---|---|---|
| `caso` | `p_caso_central` | `app_central_actual() IS NULL OR id_central = app_central_actual()` | `RepoTecnico/db/schema.sql:717-719` |
| `despacho` | `p_despacho_central` | igual regla | `RepoTecnico/db/schema.sql:724-726` |

Ambas usan la misma expresión en `USING` y en `WITH CHECK`, de modo que la política limita tanto la
lectura como la escritura (`RepoTecnico/db/schema.sql:718-719,725-726`).

> ⚠️ **La cláusula `app_central_actual() IS NULL` es un modo de compatibilidad.** El propio esquema
> advierte que la aplicación debe fijar el alcance con
> `SET LOCAL app.id_central = '<id_central>'` en cada conexión, y que **antes de producción** debe
> eliminarse esa cláusula para que la política sea «denegar por defecto»
> (`RepoTecnico/db/schema.sql:699-706`).
>
> **Estado real:** ninguna parte de `app/` ejecuta `SET LOCAL app.id_central` (verificado por
> búsqueda de `app.id_central` y `SET LOCAL`). En consecuencia, el parámetro siempre es `NULL` y las
> políticas **permiten todas las filas**. La capa RLS está desplegada pero **inactiva de facto**:
> es un control **pendiente de confirmar/conectar** desde la capa de datos.

### Alcance por central (RNF-21)

RNF-21 exige que `usuario.id_central` acote el alcance y que RLS refuerce la autorización
(`RepoTecnico/requerimientos.md:200`). Hoy:

| Control | Estado | Evidencia |
|---|---|---|
| `usuario.id_central` existe en el modelo | ✅ | `RepoTecnico/db/schema.sql:177-195`; `app/api/deps.py:44-49` |
| El token incorpora `id_central` | ✅ | `app/api/routes_auth.py:117-120` |
| Las consultas acotan por el `id_central` del usuario | ❌ No; solo si el cliente lo pide | `app/api/routes_casos.py:126-127` |
| RLS activa con `app.id_central` fijado por la app | ❌ No se fija | `RepoTecnico/db/schema.sql:699-706` |
| Pruebas negativas entre centrales | ❌ No documentadas | `RepoTecnico/pruebas/informe_fase4.md:16-28` |

> **Consecuencia de seguridad:** mientras no se conecte RLS y no se acoten las consultas, un usuario
> autenticado de cualquier rol (incluido TECNICO) puede leer casos de **cualquier central** pasando o
> no el filtro. Es una brecha de aislamiento multi-central **pendiente de confirmar y corregir**.

---

## Gestión de secretos

### Secret Manager

Los secretos se almacenan en Google Secret Manager con cifrado gestionado por **Cloud KMS (CMEK)**.
El script de aprovisionamiento define el llavero `ggtov2`, las claves `ggtov2-secrets` y
`ggtov2-storage`, y una **rotación de 90 días** (`rotationPeriod: 7776000s`)
(`RepoTecnico/scripts/04_secretos_kms.sh:6-8,12-23`).

| Secreto (solo nombre) | Contenido | Referencia |
|---|---|---|
| `ggtov2-db-password` | Contraseña del usuario de base de datos | `RepoTecnico/scripts/04_secretos_kms.sh:43` |
| `ggtov2-db-root-password` | Contraseña root de la instancia planificada | `RepoTecnico/scripts/04_secretos_kms.sh:44` |
| `ggtov2-app-secret-key` | Clave de firma de la aplicación (`SECRET_KEY`) | `RepoTecnico/scripts/04_secretos_kms.sh:45` |
| `ggtov2-db-connection` | Cadena de conexión de la instancia compartida | `RepoTecnico/scripts/10_usar_instancia_truekeate.sh:38-46` |
| `ggto-secret-key` | Clave usada por el servicio `ggto-web` | `RepoTecnico/entornos_globales.md:322` |
| `ggtov2-django-secret-key` | Reservado en el aprovisionamiento | `RepoTecnico/scripts/04_secretos_kms.sh:46` |
| `ggtov2-store-password` / tokens de mensajería | **No creados**: Telegram, SMTP y MCP siguen sin credenciales | `RepoTecnico/entornos_globales.md:170-181` |

El acceso se limita por IAM con el rol `roles/secretmanager.secretAccessor` a la cuenta de servicio
del runtime `ggtov2-app@ggtov2.iam.gserviceaccount.com`
(`RepoTecnico/scripts/04_secretos_kms.sh:49-52`). El script de la instancia compartida otorga además
lectura a `ggtov2-app@ggtov2` y a `truekeate-app-sa@truekeate-main`, y se verificó que
`truekeate-app-sa` **no** tiene acceso a los secretos de GGTO
(`RepoTecnico/entornos_globales.md:96`).

### Variables de entorno

La aplicación se configura **solo por variables de entorno** (RNF-25,
`RepoTecnico/requerimientos.md:204`). La configuración se declara en `app/core/config.py:8-38` con
`pydantic-settings` y `env_file=".env"` (`app/core/config.py:9`). Las variables que referencian
secretos **nunca llevan el valor en el repositorio**: solo el nombre del secreto.

| Variable | Origen del valor | Referencia |
|---|---|---|
| `SECRET_KEY` | Secret Manager (`ggtov2-app-secret-key` / `ggto-secret-key`) | `RepoTecnico/entornos_globales.md:136` |
| `DB_PASSWORD` | Secret Manager (`ggtov2-db-password`) | `RepoTecnico/entornos_globales.md:143` |
| `TELEGRAM_BOT_TOKEN` | Secret Manager (**no configurado**) | `RepoTecnico/entornos_globales.md:170` |
| `SMTP_PASSWORD` | Secret Manager (**no configurado**) | `RepoTecnico/entornos_globales.md:175` |
| `MCP_API_KEY` | Secret Manager (**no configurado**) | `RepoTecnico/entornos_globales.md:181` |
| `telegram.webhook_secret` | Tabla `configuracion` (vacío ⇒ no se exige) | `RepoTecnico/entornos_globales.md:201` |
| `mcp.api_key` | Tabla `configuracion` (vacío ⇒ no se exige) | `RepoTecnico/entornos_globales.md:202` |

El archivo `.gitignore` excluye los CSV con PII (`detalle_averias_gpon*.csv`) por el hallazgo H-01 y
la carpeta `RepoTecnico/credenciales/` está ignorada por Git
(`RepoTecnico/interfaz_csv_origen.md:71-72`; `RepoTecnico/estado_proyecto.md:284`).

### Rotación

| Elemento | Periodicidad / procedimiento | Referencia |
|---|---|---|
| Claves de Cloud KMS | Rotación automática cada 90 días | `RepoTecnico/scripts/04_secretos_kms.sh:23` |
| Contraseña de base de datos | Nueva versión del secreto + nueva revisión de Cloud Run | `RepoTecnico/entornos_globales.md:100-106` |
| `SECRET_KEY` de la app | **Pendiente de confirmar**: no hay procedimiento documentado | — |
| Token JWT | Sin revocación: es *stateless*; el `jti` se emite pero no hay lista de revocación | `app/core/security.py:67` |

### Incidente de exposición resuelto (entornos_globales.md:100-106)

Durante la verificación del entorno, un mensaje de error de Node **imprimió la contraseña** del
usuario `app` de TrueKeate contenida en el secreto `DATABASE_URL`
(`RepoTecnico/entornos_globales.md:100`). La respuesta fue:

1. Rotar la contraseña con `ALTER ROLE app PASSWORD '<nueva>'` (32 caracteres aleatorios).
2. Publicar una **nueva versión del secreto** `DATABASE_URL` (`versions/3`) en `truekeate-main`.
3. Desplegar una **nueva revisión** de Cloud Run `truekeate-api-00034-hvk` para tomar el valor
   `latest`, con `Ready`, 100 % del tráfico y sin errores de autenticación en los logs.
4. Confirmar que `truekeate-web` no consume `DATABASE_URL`, por lo que no requirió revisión nueva.

**Lecciones operativas aplicables a GGTO:** no imprimir valores de secretos en logs ni en mensajes de
error; rotar ante cualquier sospecha; y consumir siempre la versión `latest` de forma controlada con
una nueva revisión del servicio. Las credenciales de mensajería no deben registrarse en el
repositorio.

---

## PII y privacidad (RNF-18/D-34)

### Inventario de PII

El sistema trata datos personales de suscriptores y de trabajadores. RNF-18 exige un inventario y una
clasificación de PII (`RepoTecnico/requerimientos.md:197`), y D-34 lo aprueba como decisión de diseño
(`RepoTecnico/estado_proyecto.md:98`).

| Entidad | PII que contiene | Evidencia |
|---|---|---|
| `caso` | Nombre, teléfono, dirección, serial | `RepoTecnico/db/schema.sql:320,333-334,342` |
| `actividad` | Reporte libre y GPS | `RepoTecnico/requerimientos.md:217` |
| `evidencia` | Imagen, GPS y hora | `RepoTecnico/requerimientos.md:218` |
| `auditoria` | Datos antes/después | `RepoTecnico/requerimientos.md:219` |
| `notificacion` | Destinatario y cuerpo del mensaje | `RepoTecnico/requerimientos.md:220` |
| `solicitante` | Nombre y contacto | `RepoTecnico/requerimientos.md:221` |
| Archivo CSV de origen | Nombre, teléfono, dirección, serial, PII de trabajadores | `RepoTecnico/interfaz_csv_origen.md:96-100` |

En producción hay **1 lote de ingesta con 42 casos reales** que contienen PII de suscriptores
(`RepoTecnico/entornos_globales.md:351-354`).

### Base legal y finalidad

RNF-18 exige declarar la base legal y la finalidad del tratamiento
(`RepoTecnico/requerimientos.md:197`). D-34 registra que base legal, finalidad, inventario,
minimización, enmascaramiento, derechos del titular y DPA **quedan definidos** como decisión
(`RepoTecnico/estado_proyecto.md:98`), con la salvedad expresa de que la **validación legal con CANTV
está pendiente** (`RepoTecnico/requerimientos.md:225`). El responsable de protección de datos es
**CANTV (externo)** y está **pendiente de designar** (`RepoTecnico/requerimientos.md:267`).

### Minimización

La minimización se aplica en la frontera de datos: el parser **descarta 21 columnas** del CSV y
mapea las restantes a **49 campos destino**, unificando tres columnas de información en una
(`RepoTecnico/requerimientos.md:280`; `RepoTecnico/interfaz_csv_origen.md:44-51`). El archivo de
origen **no se transforma** más allá de esa depuración (`RepoTecnico/interfaz_csv_origen.md:12-14`).
Los campos de texto tienen longitudes máximas para evitar volcados inesperados
(`app/services/ingesta.py:80-94`).

### Enmascaramiento por rol

RNF-18 exige **enmascarar teléfono, dirección y serial** para los roles no autorizados
(`RepoTecnico/requerimientos.md:197`).

> ❌ **No implementado.** Una búsqueda de `enmascar`, `mask`, `ocultar` o `PII` en `app/` no arroja
> ninguna coincidencia. Los endpoints devuelven los datos en claro a cualquier usuario autenticado:
> el listado y la búsqueda de casos incluyen teléfono, nombre del cliente y dirección
> (`app/api/routes_casos.py:112-127,186-203`), y la ficha imprimible de la cuadrilla incluye teléfono
> y nombre del cliente (`app/api/routes_despachos.py:314-322`). El **enmascaramiento por rol está
> pendiente de confirmar / no implementado**.

### Retención por entidad (requerimientos.md:212-225)

| Entidad | Contiene PII | Retención propuesta | Acción al vencer |
|---|---|---|---|
| `caso` | Sí (nombre, teléfono, dirección, serial) | 5 años | Anonimizar y archivar |
| `actividad` | Sí (reporte libre, GPS) | 5 años | Anonimizar |
| `evidencia` | Sí (imagen + GPS + hora) | 2 años | Eliminar imagen y metadatos |
| `auditoria` | Sí (datos antes/después) | 3 años | Archivar sin PII |
| `notificacion` | Sí (destinatario, cuerpo) | 1 año | Eliminar |
| `solicitante` | Sí (nombre, contacto) | 5 años | Anonimizar |
| `dispositivo_seguridad` | No (hashes) | Mientras la cuenta esté activa | Eliminar con la cuenta |
| `inventario_movimiento` / `orden_material` (v2) | No | 5 años | Archivar |

Los plazos son una **propuesta** y deben validarse con CANTV/asesoría legal
(`RepoTecnico/requerimientos.md:225`). **No existe** un job ni rutina de purga/anonimización
implementada en el código: la retención es hoy una **política pendiente de confirmar y automatizar**.

### Derechos del titular

RNF-18 exige atender los derechos de **acceso, rectificación y supresión**
(`RepoTecnico/requerimientos.md:197`). No existe en la v1 un endpoint ni pantalla específica para
ejercerlos; las vías disponibles son operativas (consulta y edición de la ficha del caso,
`app/api/routes_casos.py:278-314`) y no cubren la supresión ni la anonimización. Este punto está
**pendiente de confirmar** con CANTV.

### DPA con proveedores

RNF-18 exige **DPA (acuerdos de tratamiento de datos)** con los proveedores
(`RepoTecnico/requerimientos.md:197`). Los proveedores que pueden tratar datos son:

| Proveedor | Uso | Estado del DPA |
|---|---|---|
| SendGrid (o Gmail SMTP) | Envío de correo | Pendiente de confirmar |
| Telegram | Envío de alertas y bot | Pendiente de confirmar |
| Google Cloud (Cloud Run, Cloud SQL, Secret Manager) | Infraestructura | Pendiente de confirmar |
| Servidor MCP/IA | Ingesta conversacional de casos especiales | Pendiente de confirmar |

### Transferencia internacional

El tratamiento implica transferencia fuera de Venezuela: el servicio Cloud Run corre en
`europe-west1` (`RepoTecnico/entornos_globales.md:318`) y la base operativa en
`southamerica-east1` (`RepoTecnico/entornos_globales.md:71`); además, Telegram opera en el exterior
y el correo puede usar SendGrid. RNF-18 exige **evaluar la transferencia internacional**
(`RepoTecnico/requerimientos.md:197`); la evaluación y las garantías contractuales están **pendientes
de confirmar** con CANTV y asesoría legal.

---

## Superficie de exposición actual

### Servicio Cloud Run público con PII real: DEBE restringirse

El servicio `ggto-web` está desplegado con acceso **público**: el script concede el rol
`roles/run.invoker` a `allUsers` (`RepoTecnico/scripts/07_cloudrun_web.sh:31-34`), y el documento de
entorno lo confirma como «Público (`allUsers`) — smoke test; endurecer antes de producción»
(`RepoTecnico/entornos_globales.md:325`). La URL es
`https://ggto-web-593453426217.europe-west1.run.app` (`RepoTecnico/entornos_globales.md:319`).

Ese servicio opera hoy con **PII real** (42 casos) y la recomendación es explícita: «restringir el
acceso (IAP o invocación autenticada), porque hoy `/api/v1/*` expone datos de la base sin
autenticación» (`RepoTecnico/entornos_globales.md:351-358`). El informe de Fase 4 lo lista como
pendiente que **no bloquea** las pruebas pero **sí debe resolverse antes de operar en producción**
(`RepoTecnico/pruebas/informe_fase4.md:109-113`), y los próximos pasos insisten en restringir el
acceso público antes de seguir cargando datos (`RepoTecnico/estado_proyecto.md:134-135`).

Precisión técnica sobre esa afirmación:

- La mayoría de los endpoints `/api/v1/*` **sí exigen token JWT** (`Depends(get_current_user)`),
  como se ve en `app/api/routes_casos.py:92` o `app/api/routes_despachos.py:122`.
- Son **públicos** (sin token): `/api/v1/info`, `/health` y `/ready`
  (`app/api/routes_health.py:17-57`), el `login` (`app/api/routes_auth.py:81`), el `setup` inicial
  (`app/api/routes_auth.py:129`), `primer-acceso` (`app/api/routes_auth.py:219`), `unlock` y
  `reset-password` (`app/api/routes_auth.py:330,349`). El `primer-acceso` es público pero lleva
  *rate limit* por IP de 30/60 s (`app/api/routes_auth.py:229-230`).
- `/api/v1/telegram/webhook` y `/api/v1/mcp` se protegen con **cabecera secreta** solo si está
  configurada; si la clave está vacía, **no se exige**
  (`app/api/routes_alertas.py:260-265,350-356`).

El riesgo real es de **exposición de perímetro**: cualquier persona alcanza el servicio, la SPA, el
`login` y las sondas; y `GET /ready` publica nombre de base, usuario y número de tablas
(`app/api/routes_health.py:49-55`). Debe restringirse con IAP o invocación autenticada.

### Riesgo aceptado D-26

El riesgo **D-26** fue aceptado el 2026-09-25 por la Dirección del proyecto: **no** se modifican
backups/PITR/SSL de la instancia compartida `truekeate-db-dev`, con condición de cierre «migrar a
`ggtov2-pg` propio (REGIONAL, SSL `ENCRYPTED_ONLY`, backups + PITR + `deletionProtectionEnabled`) al
resolver la cuota de facturación» (`RepoTecnico/estado_proyecto.md:90`;
`RepoTecnico/requerimientos.md:206-210`). La misma decisión indica que **no se deben cargar datos
reales de producción** en la instancia compartida hasta que exista respaldo
(`RepoTecnico/requerimientos.md:209-210`).

| Riesgo aceptado | Impacto |
|---|---|
| Sin backups ni PITR | Pérdida irreversible de datos |
| Sin SSL obligatorio en la instancia | Interceptación en tránsito |
| Sin protección de borrado | Borrado accidental o malicioso sin retorno |
| Datos compartidos por base | Coexistencia con TrueKeate en la misma instancia |

### Rol de BD con NOINHERIT y riesgo residual

El rol de base de datos `ggtov2_app` fue endurecido el 2026-09-25
(`RepoTecnico/entornos_globales.md:83-98`):

| Cambio | Estado | Evidencia |
|---|---|---|
| `CREATEROLE` revocado | ✅ | `rolcreaterole = false` |
| `CREATEDB` revocado | ✅ | `rolcreatedb = false` |
| `NOINHERIT` aplicado | ✅ | `rolinherit = false` |
| Membresía `cloudsqlsuperuser` revocada | ⚠️ No posible vía SQL | La pertenencia persiste pero **no se hereda** |
| `CONNECT/TEMPORARY/CREATE` de `PUBLIC` revocados en bases ajenas | ✅ | `permission denied for database` |
| `CONNECT` re-otorgado a `app` y `postgres` | ✅ | TrueKeate sigue operando |
| `CONNECT` + `CREATE` en `ggtov2` y `public` | ✅ | DDL de prueba correcto |
| `truekeate-app-sa` sin acceso a secretos de GGTO | ✅ | Solo `ggtov2-app@ggtov2` |

**Riesgo residual (D-25):** al seguir siendo miembro de `cloudsqlsuperuser`, `ggtov2_app` podría
recuperar privilegios con un `SET ROLE cloudsqlsuperuser` explícito. La corrección definitiva requiere
**recrear el rol** (no es posible con los privilegios actuales). Se decidió **aceptar el residual con
`NOINHERIT`** y documentarlo (`RepoTecnico/entornos_globales.md:98`;
`RepoTecnico/estado_proyecto.md:249`).

---

## Endurecimiento recomendado

### IAP o invocación autenticada

Acción prioritaria: retirar `allUsers` del binding de invocación de Cloud Run
(`RepoTecnico/scripts/07_cloudrun_web.sh:31-34`) y exponer el servicio mediante **Identity-Aware
Proxy (IAP)** o **invocación autenticada**. Es la recomendación explícita de
`RepoTecnico/entornos_globales.md:356-358` y de `RepoTecnico/estado_proyecto.md:134-135`. Debe
hacerse **antes de seguir cargando PII real**.

### SSL ENCRYPTED_ONLY

La instancia propia planificada fija `sslMode: "ENCRYPTED_ONLY"` e `ipv4Enabled: false` con red
privada (`RepoTecnico/scripts/06_cloudsql_postgres.sh:31-32`). La aplicación ya solicita TLS con
`DB_SSLMODE=require` (`RepoTecnico/entornos_globales.md:144`), pero la instancia compartida **no lo
obliga**. Al migrar a `ggtov2-pg`, verificar que la conexión use socket privado y TLS estricto.

### Backups/PITR

Habilitar `backupConfiguration.enabled`, `pointInTimeRecoveryEnabled` y
`deletionProtectionEnabled` (`RepoTecnico/scripts/06_cloudsql_postgres.sh:29-33`) en la instancia
propia. Esto cierra D-26 y satisface RNF-16 (RPO ≤ 24 h, RTO ≤ 4 h;
`RepoTecnico/requerimientos.md:195`). Debe acompañarse de una **prueba de restauración documentada**
al menos trimestral (RNF-16).

### MFA (RNF-22, previsto)

RNF-22 exige **MFA obligatorio para ADMIN y SUPERVISOR**, además de política de complejidad,
caducidad e historial de claves, expiración/rotación/revocación de sesión, protección CSRF/CORS y
registro de eventos de login (`RepoTecnico/requerimientos.md:201`). La matriz RBAC insiste en el MFA
para ADMIN y SUPERVISOR (`RepoTecnico/requerimientos.md:255`).

| Control de RNF-22 | Estado real | Evidencia |
|---|---|---|
| Hash Argon2id | ✅ Implementado | `app/core/security.py:17,23-25` |
| Bloqueo y rate limiting | ✅ Implementado | `app/api/routes_auth.py:41-51,99-111` |
| Expiración del token | ✅ 480 min | `app/core/config.py:30` |
| MFA | ❌ No implementado (sin TOTP/OTP en `app/`) | — |
| Complejidad/caducidad/historial de claves | ❌ No implementado | — |
| Revocación de sesión/token | ❌ No implementado (JWT sin lista de revocación) | `app/core/security.py:56-72` |
| Protección CSRF | ❌ No implementado (no hay referencias a CSRF) | — |
| CORS restringido | ⚠️ Por defecto `cors_origins = "*"` | `app/core/config.py:38`, `app/main.py:69-75` |
| Registro de eventos de login | ⚠️ Solo el log general sin usuario | `app/main.py:62-64` |
| Autenticación de canales externos | ⚠️ Por cabecera si la clave está configurada | `app/api/routes_alertas.py:260-265,350-356` |

> El **MFA, la política de claves, la revocación de tokens, el CSRF y un CORS restringido** están
> exigidos por RNF-22 pero **no implementados**: son los principales puntos de endurecimiento
> **pendientes de confirmar**. Mientras tanto, `cors_origins` debe fijarse a los orígenes reales en
> producción y las claves `telegram.webhook_secret` y `mcp.api_key` deben establecerse (hoy vacías ⇒
> no se exigen, `RepoTecnico/entornos_globales.md:201-202`).

---

## Cumplimiento y pendientes

| Tema | Responsable | Estado |
|---|---|---|
| Administración de catálogos, flota y almacén | SUPERVISOR | Cubierto en v1 |
| Auditoría interna de la bitácora | ADMIN (solo lectura de `auditoria`) | **Parcial**: D-67 registra `ALTA_PRIMER_ACCESO` y `REGENERAR_PALABRAS`; no hay endpoints para consultar `auditoria` |
| Soporte/helpdesk de la plataforma | SUPERVISOR (registro por correo) | Informal en v1 |
| Responsable de protección de datos | **CANTV (externo)** | **Pendiente de designar** (`RepoTecnico/requerimientos.md:267`) |
| Dueño del sistema origen (CSV) | **CANTV (externo)** | **Pendiente de formalizar** (`RepoTecnico/requerimientos.md:268`) |
| Validación legal de base legal y retención | CANTV + asesoría legal | **Pendiente** (`RepoTecnico/requerimientos.md:225`) |
| Firma del contrato de interfaz del CSV | CANTV | **Pendiente** (`RepoTecnico/pruebas/informe_fase4.md:111`) |

Gobierno de datos en la v1 (D-39, `RepoTecnico/requerimientos.md:258-268`): la administración de
catálogos, la flota y el almacén recaen en el SUPERVISOR; la auditoría interna, en el ADMIN en modo
lectura; no existe rol AUDITOR en v1.

### Lista de acciones recomendadas

1. Restringir el acceso público de `ggto-web` con IAP o invocación autenticada.
2. Migrar a `ggtov2-pg` con backups + PITR + SSL `ENCRYPTED_ONLY` + protección de borrado.
3. Implementar el **enmascaramiento por rol** de teléfono, dirección y serial.
4. Extender el registro de **auditoría** (hoy limitado a alta y regeneración de accesos) y añadir el usuario a los logs.
5. Conectar **RLS** fijando `app.id_central` por sesión y acotar las consultas por `usuario.id_central`.
6. Habilitar **MFA** para ADMIN y SUPERVISOR y la política de claves de RNF-22.
7. Fijar `cors_origins` a los orígenes reales y establecer `telegram.webhook_secret` y `mcp.api_key`.
8. Definir con CANTV la base legal, la retención definitiva y los DPA de proveedores.
9. Establecer el procedimiento de rotación de `SECRET_KEY` y verificar que no use el valor por defecto.

> **Nota final de fidelidad:** los controles marcados como ✅ están implementados y localizados en el
> código; los marcados como ❌ o «pendiente de confirmar» se declaran así porque **no existen** en el
> repositorio, pese a figurar en los requerimientos. No se ha documentado ningún control que no se
> haya podido verificar.
