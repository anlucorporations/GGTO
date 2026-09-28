# Manual de Operación y Mantenimiento — GGTO

| Campo | Valor |
|---|---|
| Proyecto | GGTO — Sistema de administración de reportes de avería y construcción de puntos ópticos |
| Cliente | CANTV C.A. — Central Francisco Salias (Área 4) |
| Alcance | Operación diaria, rutinas programadas, respaldo, mantenimiento, incidentes y continuidad |
| Versión de la aplicación | `0.9.0` (`app/core/config.py:14`) |
| Base de datos operativa | PostgreSQL 15.18, base `ggtov2`, usuario `ggtov2_app` (`RepoTecnico/entornos_globales.md:71-74`) |
| Despliegue | Cloud Run `ggto-web`, región `europe-west1` (`RepoTecnico/estado_proyecto.md:294`) |

> Este manual describe **la operación real verificada en el código y en los documentos del proyecto**.
> Cuando una capacidad está prevista pero no implementada, se indica expresamente como
> **«pendiente de confirmar»** o «no implementada», sin prometer funciones inexistentes.

---

## Operación diaria

La jornada operativa de la Central Francisco Salias gira en torno a la ingesta del archivo diario de
averías, la gestión de casos, el despacho de cuadrillas con corte a las 16:00, la agenda de citas y el
monitoreo. La plataforma no tiene un planificador de tareas propio: **varias de estas actividades son
manuales y dependen del operador** (véase «Rutinas programadas»).

### Ingesta del CSV diario

#### Ventana de entrega y horario

El archivo matriz de averías lo entrega el sistema origen de CANTV con periodicidad **diaria (días
hábiles)** y **antes de las 08:00**, hora de Venezuela (`RepoTecnico/interfaz_csv_origen.md:27-29`).
El nombre es `detalle_averias_gpon_<fecha>.csv`, con delimitador `;`, codificación **ISO-8859-1**
y **80 columnas** mapeadas por posición (`RepoTecnico/interfaz_csv_origen.md:27-36`). El canal de
entrega definitivo (carpeta/bucket auditado o SFTP) está **por definir con CANTV**
(`RepoTecnico/interfaz_csv_origen.md:63-69`); el repositorio Git está prohibido porque contiene PII.

#### Procedimiento paso a paso

1. Verificar que el archivo del día llegó y que su nombre corresponde a la fecha operativa.
2. Abrir la sección **INGESTA** de la SPA (`/ingesta`, `app/web/src/App.tsx:29`).
3. Ejecutar primero la **previsualización** (`POST /api/v1/ingesta/preview`,
   `app/api/routes_ingesta.py:105-116`). Esta llamada parsea y clasifica **sin guardar nada**: informa
   filas leídas, filas de la central, casos nuevos, duplicados, descartados, sectorizados, sin sector
   y cuadrilla 0 (`app/api/routes_ingesta.py:65-99`).
4. Revisar los **avisos** del resumen (`resultado.avisos`). El parser agrega un aviso si el encabezado
   no tiene 80 columnas y si hay filas malformadas o sin `id_averia` (`app/services/ingesta.py:182-224`).
5. Confirmar la carga real (`POST /api/v1/ingesta`, `app/api/routes_ingesta.py:119-172`).
6. Anotar el `id_lote` devuelto y el conteo de fallas masivas detectadas.

La escritura de la ingesta exige rol **ADMIN** o **SUPERVISOR** (`_escritura = require_roles("ADMIN",
"SUPERVISOR")`, `app/api/routes_ingesta.py:23`); el rol `SUPER` pasa por el bypass de `require_roles`
(`app/api/deps.py:65`).

#### Verificación del resultado

| Verificación | Dónde se comprueba | Referencia |
|---|---|---|
| El lote quedó en estado `OK` y sin error | `ingesta_lote.estado` / `detalle_error` | `app/api/routes_ingesta.py:158-159` |
| Conteos del lote (leídas, central, nuevos, duplicados, descartados) | `GET /api/v1/ingesta/lotes` | `app/api/routes_ingesta.py:175-185` |
| Detalle de un lote concreto | `GET /api/v1/ingesta/lotes/{id_lote}` | `app/api/routes_ingesta.py:188-195` |
| Casos cargados visibles en PANEL | `GET /api/v1/casos?id_lote_ingesta=<id>` | `app/api/routes_casos.py:99,132-133` |
| Fallas masivas generadas por la carga | `GET /api/v1/fallas-masivas` | `app/api/routes_alertas.py:45-61` |

La ingesta es **idempotente por `id_averia`**: antes de insertar se consultan los identificadores ya
existentes en lotes de 1000 y solo se crean los nuevos (`app/api/routes_ingesta.py:31-37,61-63`).
Repetir la carga del mismo archivo reporta los casos como duplicados y no genera filas nuevas.

### Gestión de casos

El PANEL y CASOS permiten listar, filtrar, buscar, abrir la ficha, editar y dar de alta manualmente.

| Operación | Endpoint | Referencia |
|---|---|---|
| Listado con filtros y paginación | `GET /api/v1/casos` | `app/api/routes_casos.py:89-159` |
| Búsqueda por avería, teléfono, cliente o dirección | `GET /api/v1/casos/buscar` | `app/api/routes_casos.py:172-212` |
| Alta manual (genera `REF-…` si no se da `id_averia`) | `POST /api/v1/casos` | `app/api/routes_casos.py:218-272` |
| Ficha completa | `GET /api/v1/casos/{id_caso}` | `app/api/routes_casos.py:278-281` |
| Edición y cambio de estado | `PATCH /api/v1/casos/{id_caso}` | `app/api/routes_casos.py:284-314` |
| Bitácora de estados | `GET /api/v1/casos/{id_caso}/historial` | `app/api/routes_casos.py:317-329` |

Los estados válidos de un caso están acotados por la restricción `CHECK` de la tabla:
`NUEVO, ASIGNADO, CONTACTADO, CITADO, DIFERIDO, EN_GESTION, ENRUTADO, CERRADO, CANCELADO`
(`RepoTecnico/db/schema.sql:297-299`). Cada cambio de estado inserta una fila en `caso_estado_hist`
con el estado anterior, el nuevo, el motivo y el `P00` del usuario (`app/api/routes_casos.py:36-49`).
El alta manual usa la función `generar_id_averia_ref(:c)` cuando no se informa `id_averia`
(`app/api/routes_casos.py:231-233`).

### Despacho y reporte de las 16:00

El despacho diario se arma con una **propuesta** automática y luego se genera, edita, imprime, envía y
reporta. El corte operativo está fijado en la configuración `despacho.hora_reporte = "16:00"`
(`RepoTecnico/db/schema.sql:776`) y en la variable prevista `DESPACHO_HORA_REPORTE=16:00`
(`RepoTecnico/entornos_globales.md:164`).

| Paso | Endpoint | Referencia |
|---|---|---|
| Calcular propuesta de reparto | `POST /api/v1/despachos/propuesta` | `app/api/routes_despachos.py:63` |
| Generar el despacho | `POST /api/v1/despachos` | `app/api/routes_despachos.py:76` |
| Consultar despachos | `GET /api/v1/despachos` | `app/api/routes_despachos.py:117` |
| Añadir/quitar/editar casos | `POST/DELETE/PATCH /api/v1/despachos/{id}/casos...` | `app/api/routes_despachos.py:204-297` |
| Ficha imprimible tamaño carta | `GET /api/v1/despachos/{id}/imprimible` | `app/api/routes_despachos.py:299-355` |
| Reporte de producción del día | `GET /api/v1/despachos/reporte/produccion` | `app/api/routes_despachos.py:407-417` |
| Enviar la ficha por Telegram/correo | `POST /api/v1/despachos/{id}/enviar` | `app/api/routes_despachos.py:432-483` |
| Notificaciones del despacho | `GET /api/v1/despachos/{id}/notificaciones` | `app/api/routes_despachos.py:486-499` |

El reporte de producción agrupa por cuadrilla e informa asignados, cerrados, citados, diferidos,
gestionados, referidos y empresas (`app/api/routes_despachos.py:361-404`). La ficha imprimible es
HTML con `@page { size: letter }` e incluye una columna de firma por caso
(`app/api/routes_despachos.py:323-354`). El envío usa el canal `TELEGRAM` o `CORREO`
(`pattern="^(TELEGRAM|CORREO)$"`, `app/api/routes_despachos.py:435`) y toma el destino desde el
parámetro o desde la configuración `despacho.destino_<canal>` (`app/api/routes_despachos.py:466-468`).

> ⚠️ **El corte de las 16:00 no se dispara solo.** No existe en el código ningún planificador que a
> las 16:00 genere o envíe el reporte, ni una alerta automática si el reporte no se confirma. Esas
> conductas están exigidas por RNF-20 (`RepoTecnico/requerimientos.md:199`) pero su implementación
> automática está **pendiente de confirmar**. Hasta entonces el operador debe generar el reporte y
> enviar la ficha manualmente antes del corte.

### Agenda y especiales

Las citas y los casos especiales (EMPRESA / REFERIDO / GOBIERNO) se gestionan en `/especiales` y
`/agenda` (`app/web/src/App.tsx:32-33`).

| Operación | Endpoint | Referencia |
|---|---|---|
| Solicitantes | `GET/POST /api/v1/solicitantes` | `app/api/routes_especiales.py:50-57` |
| Casos especiales | `GET/POST/PATCH /api/v1/casos-especiales...` | `app/api/routes_especiales.py:103-183` |
| Citas (agenda) | `GET/POST/PATCH/DELETE /api/v1/citas...` | `app/api/routes_especiales.py:280-367` |
| Seguimiento (derivación a otras colas) | `GET/POST/PATCH /api/v1/seguimiento...` | `app/api/routes_especiales.py:369-439` |

La agenda controla el **solapamiento de citas** (las pruebas documentan `409` ante solapamiento,
`RepoTecnico/entornos_globales.md:348-349`) y los casos con seguimiento se **excluyen del despacho**
según el flujo de casos especiales. La escritura exige ADMIN o SUPERVISOR
(`app/api/routes_especiales.py:41`).

### Monitoreo

El módulo MONITOREO expone tableros y reportes de solo lectura para cualquier usuario autenticado.

| Tablero | Endpoint | Referencia |
|---|---|---|
| Gestión diaria | `GET /api/v1/monitoreo/diario` | `app/api/routes_monitoreo.py:27` |
| Curva semanal (lunes→sábado) | `GET /api/v1/monitoreo/semanal` | `app/api/routes_monitoreo.py:38` |
| Casos globales | `GET /api/v1/monitoreo/globales` | `app/api/routes_monitoreo.py:49` |
| Reparación (torta) | `GET /api/v1/monitoreo/reparacion` | `app/api/routes_monitoreo.py:62` |
| Construcción | `GET /api/v1/monitoreo/construccion` | `app/api/routes_monitoreo.py:71` |
| Cuadrilla | `GET /api/v1/monitoreo/cuadrilla` | `app/api/routes_monitoreo.py:80` |
| Capacidad operativa | `GET /api/v1/monitoreo/capacidad` | `app/api/routes_monitoreo.py:93` |
| Reporte de trabajo (JSON) | `GET /api/v1/reportes/trabajo` | `app/api/routes_monitoreo.py:105` |
| Reporte de trabajo imprimible | `GET /api/v1/reportes/trabajo/imprimible` | `app/api/routes_monitoreo.py:117` |

Las fórmulas, ventanas y convenciones de cada indicador están fijadas en
`RepoTecnico/metricas.md:31-104`; la semana operativa es **lunes a sábado** y el domingo no cuenta
(`RepoTecnico/metricas.md:11-12`). Los gráficos de la SPA son SVG propios
(`app/web/src/components/graficos.tsx`), no Recharts.

---

## Rutinas programadas

### Detección de fallas tras la ingesta

La única rutina que se ejecuta **de forma automática** es la detección de fallas masivas por
concentración, y ocurre **inmediatamente después de cada carga** del CSV: `POST /api/v1/ingesta`
invoca `fallas.detectar(db, central.id_central)` antes de devolver el resumen
(`app/api/routes_ingesta.py:162-166`). El algoritmo agrupa casos no cerrados por el campo
configurado (`olt`, `fat` o `id_sector`), en la ventana de horas configurada, y crea una falla cuando
el grupo alcanza el umbral (`app/services/fallas.py:53-116`). La detección es **idempotente** por
`clave_concentracion`: mientras la falla siga en `DETECTADA` o `PLANIFICADA` no se duplica
(`app/services/fallas.py:82-90`). Cada falla nueva encola una alerta de Telegram mediante el outbox
(`app/services/fallas.py:112-133`).

La detección también puede lanzarse **a demanda** con `POST /api/v1/fallas-masivas/detectar`
(`app/api/routes_alertas.py:90-101`). Los parámetros vigentes son `fallas.activo`,
`fallas.umbral_casos=5`, `fallas.ventana_horas=24` y `fallas.campo_concentracion="olt"`
(`RepoTecnico/entornos_globales.md:195-198`).

### Procesamiento del outbox

El patrón *outbox* persiste primero la notificación en estado `PENDIENTE` y la envía después
(`app/services/outbox.py:34-48`). El procesamiento **no es automático**: se dispara con
`POST /api/v1/notificaciones/procesar` (`app/api/routes_alertas.py:186-195`) o como efecto de una
llamada al webhook de Telegram o a la herramienta MCP `procesar_notificaciones`
(`app/api/routes_alertas.py:201-206,381-383`).

| Regla del outbox | Comportamiento | Referencia |
|---|---|---|
| Reintentos | Hasta `outbox.max_intentos` (por defecto 5) | `app/services/outbox.py:20,53,87-90` |
| Backoff | `min(2^(n-1), 60)` minutos | `app/services/outbox.py:29-31` |
| Canal sin credenciales | Queda `PENDIENTE` y **no consume intento** | `app/services/outbox.py:78-85` |
| Canal sin destinatario | Queda `PENDIENTE` | `app/services/notificaciones.py:66-67` |
| Estado terminal | `FALLIDO` al agotar intentos | `app/services/outbox.py:87-90` |

Telegram devuelve `PENDIENTE` mientras no exista `TELEGRAM_BOT_TOKEN`
(`app/services/notificaciones.py:19-22`) y el correo mientras no exista `SMTP_HOST`
(`app/services/notificaciones.py:39-42`). En producción **ninguno de los dos tiene credenciales
todavía**, por lo que las notificaciones permanecen pendientes con su motivo
(`RepoTecnico/entornos_globales.md:190-191`). La bandeja se consulta en
`GET /api/v1/notificaciones` (`app/api/routes_alertas.py:169-183`).

### Qué es automático y qué es manual según el código

| Actividad | ¿Automática? | Evidencia |
|---|---|---|
| Detección de fallas masivas | **Sí**, tras cada ingesta y a demanda | `app/api/routes_ingesta.py:162-166` |
| Encolado de alertas de falla | **Sí** al detectar/planificar/reportar falla | `app/services/fallas.py:112-115` |
| Envío efectivo de notificaciones | **No**: requiere procesar el outbox | `app/api/routes_alertas.py:186-195` |
| Ingesta del CSV | **No**: la sube el operador | `app/api/routes_ingesta.py:119-126` |
| Cálculo y generación del despacho | **No**: el operador invoca propuesta/generación | `app/api/routes_despachos.py:63,76` |
| Reporte de producción de las 16:00 | **No** hay disparo por horario | `RepoTecnico/requerimientos.md:199` |
| Respaldo de la base de datos | **No** existe (D-26) | `RepoTecnico/estado_proyecto.md:90` |
| Migraciones de esquema | **No** implementadas (Alembic ausente) | `RepoTecnico/requerimientos.md:288` |

> La plataforma **no incluye** `APScheduler`, `Celery`, tareas `BackgroundTasks` ni `lifespan`
> con trabajos programados: una búsqueda en `app/` no encuentra ninguna de esas construcciones. Toda
> rutina periódica que se necesite debe ejecutarse manualmente o resolverse con un servicio externo
> **pendiente de confirmar**.

---

## Respaldo y recuperación

### RNF-16 (RPO ≤ 24 h, RTO ≤ 4 h)

El requerimiento RNF-16 exige «backups automáticos diarios, *point-in-time recovery* y protección de
borrado; **RPO ≤ 24 h** y **RTO ≤ 4 h**; prueba de restauración documentada al menos trimestral»
(`RepoTecnico/requerimientos.md:195`). La instancia propia planificada `ggtov2-pg` se definiría con
`backupConfiguration.enabled=true`, `pointInTimeRecoveryEnabled=true` y
`deletionProtectionEnabled=true` (`RepoTecnico/scripts/06_cloudsql_postgres.sh:29-33`), junto con
`sslMode: ENCRYPTED_ONLY` (`RepoTecnico/scripts/06_cloudsql_postgres.sh:32`).

### Estado real (D-26: sin backups/PITR)

La base operativa **no es** `ggtov2-pg`, sino la instancia compartida
`truekeate-main:southamerica-east1:truekeate-db-dev`, que **no tiene backups ni PITR ni SSL
obligatorio ni protección de borrado** (`RepoTecnico/entornos_globales.md:80-81`). El **riesgo D-26
fue aceptado** por la Dirección del proyecto el 2026-09-25, con dueño asignado y condición de cierre
«migrar a `ggtov2-pg` propio al desbloquear la facturación»
(`RepoTecnico/estado_proyecto.md:90`; `RepoTecnico/requerimientos.md:206-210`).

| Elemento | Estado real | Referencia |
|---|---|---|
| Backups automáticos | ❌ No existen en la instancia compartida | `RepoTecnico/entornos_globales.md:80-81` |
| Point-in-time recovery | ❌ No existe | `RepoTecnico/estado_proyecto.md:90` |
| Protección de borrado | ❌ No existe | `RepoTecnico/entornos_globales.md:80-81` |
| SSL obligatorio | ❌ No; la app usa `DB_SSLMODE=require` pero la instancia no lo fuerza | `RepoTecnico/entornos_globales.md:144` |
| Datos reales cargados | ⚠️ Sí: 42 casos con PII | `RepoTecnico/entornos_globales.md:351-354` |

> La condición de cierre de D-26 incluye **no cargar datos reales de producción** en la instancia
> compartida hasta que exista respaldo (`RepoTecnico/requerimientos.md:209-210`). Ese límite ya fue
> superado por la carga operativa documentada, por lo que la migración es una **prioridad operativa**.

### Procedimiento deseado y pendiente

1. Desbloquear la facturación de GCP y aprovisionar `ggtov2-pg` con
   `RepoTecnico/scripts/06_cloudsql_postgres.sh` (REGIONAL/HA, backups + PITR + `ENCRYPTED_ONLY`).
2. Migrar la base `ggtov2` con una ventana de mantenimiento y verificar los 35 objetos.
3. Reapuntar Cloud Run a la instancia propia y retirar el uso compartido de `truekeate-db-dev`.
4. Ejecutar y **documentar** una prueba de restauración trimestral (RNF-16).
5. Designar responsable del respaldo y registrar el resultado en `RepoTecnico/`.

Mientras no exista respaldo, el plan de contingencia es **conservar los CSV de origen** (el sistema
origen de CANTV mantiene el histórico, `RepoTecnico/interfaz_csv_origen.md:93-94`) y poder reconstruir
la base reingeriendo los archivos. Este procedimiento es **pendiente de confirmar y de documentar
formalmente**.

---

## Mantenimiento

### Esquema (db/schema.sql) y recarga de catálogos

El esquema completo está en `RepoTecnico/db/schema.sql` y define **35 tablas**, las extensiones
`pgcrypto` y `pg_trgm`, RLS en `caso` y `despacho`, y 14 triggers `actualizado_en`
(`RepoTecnico/entornos_globales.md:299-309`). El script es idempotente por el uso de
`CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS` (`RepoTecnico/db/schema.sql:64,665-677`).
Una aplicación inicial carga las semillas: 3 roles, 1 central (`2324X`), 1 cuadrilla (`C-00`),
9 métodos, 13 parámetros y 0 causas (`RepoTecnico/entornos_globales.md:308`).

Los catálogos se mantienen **desde la aplicación**, no reeditando el DDL:

| Catálogo | Endpoints | Referencia |
|---|---|---|
| Causas | `GET/POST/DELETE /api/v1/catalogos/causas` | `app/api/routes_config.py:471-501` |
| Métodos | `GET/POST /api/v1/catalogos/metodos` | `app/api/routes_config.py:503-527` |
| Parámetros | `GET /api/v1/configuracion`, `PUT /api/v1/configuracion/{clave}` | `app/api/routes_config.py:529-534` |
| Central, sectores, técnicos, flota, cuadrillas | CRUD en `/api/v1/...` | `app/api/routes_config.py:80-410` |

La escritura de configuración exige ADMIN o SUPERVISOR (`app/api/routes_config.py:59`). Los
parámetros del sistema viven en la tabla `configuracion` como JSONB
(`RepoTecnico/entornos_globales.md:187-206`), por lo que su cambio **no requiere desplegar código**
(RNF-10, `RepoTecnico/requerimientos.md:189`).

#### Reaplicación del esquema

Reaplicar `db/schema.sql` sobre una base con datos vuelve a crear las políticas RLS (`DROP POLICY IF
EXISTS` + `CREATE POLICY`, `RepoTecnico/db/schema.sql:699-709`) y recrea triggers
(`RepoTecnico/db/schema.sql:714-724`). Es una operación **de mantenimiento mayor** que debe ejecutarse
con respaldo previo y ventana acordada; hoy no hay respaldo (D-26), por lo que se recomienda
**no reaplicarla** sin antes migrar a la instancia con PITR.

### recalcular_cuadrilla0.py

Cuando cambia el criterio de **cuadrilla 0**, los casos ya cargados no se recalculan solos: hay que
reevaluar la marca `caso.en_gestion_supervisor`. Para ello existe el script
`scripts/recalcular_cuadrilla0.py`.

| Aspecto | Comportamiento | Referencia |
|---|---|---|
| Modo por defecto | **Simulación** (`--dry-run`): solo informa qué cambiaría | `scripts/recalcular_cuadrilla0.py:14-15,117-119` |
| Escritura | Requiere `--aplicar` y confirmación, o `--si` | `scripts/recalcular_cuadrilla0.py:121-131` |
| Alcance | Todas las centrales o una con `--id-central` | `scripts/recalcular_cuadrilla0.py:96-100` |
| Bitácora | `RepoTecnico/BaseOperaciones/recalculo_cuadrilla0.log` | `scripts/recalcular_cuadrilla0.py:42,45-49` |
| Ejecución autónoma | **Nunca**; hay que invocarlo explícitamente | `scripts/recalcular_cuadrilla0.py:18` |

El script lee el criterio vigente (`despacho.criterio_cuadrilla0`, `despacho.columnas_evaluar`,
`despacho.frases_campo`, `despacho.frases_supervisor`) y lo aplica con la misma función que la ingesta
(`app.services.cuadrilla0.evaluar`, `scripts/recalcular_cuadrilla0.py:40,84-107`). El cambio de
criterio `UNION → SUPERVISOR` (D-59) se aplicó así sobre los 42 casos reales: 36 volvieron a
`Pendiente` y 6 permanecieron en Gestión (`RepoTecnico/estado_proyecto.md:116`).

### Migraciones Alembic (previstas, no implementadas → "pendiente de confirmar")

RNF-24 y RT-13 prevén **migraciones versionadas con Alembic**, con `db/schema.sql` como línea base
(`RepoTecnico/requerimientos.md:288`) y versiones en `db/migrations/`
(`RepoTecnico/entornos_globales.md:240`). Sin embargo, **el repositorio no contiene `alembic.ini`, ni
carpeta `db/migrations/`, ni dependencia de Alembic** en `app/requirements*.txt`; el único artefacto
de esquema es `RepoTecnico/db/schema.sql` (verificado: `RepoTecnico/db/` solo contiene `schema.sql`).
Por tanto, **el uso de Alembic está pendiente de confirmar / no implementado** y los cambios de
esquema en v1 deberán aplicarse con DDL manual controlado hasta que se incorpore.

### Logs y /health /ready

La aplicación registra con `logging.basicConfig` en nivel INFO y formato
`asctime levelname name message` (`app/main.py:32-34`). El `ObservabilidadMiddleware` asigna un
`request_id` (de la cabecera `X-Request-ID` o uno nuevo), lo devuelve en la respuesta y registra
método, ruta, código y duración en milisegundos; ante una excepción registra el fallo con el
`request_id` (`app/main.py:49-65`).

| Sonda | Ruta | Comportamiento | Referencia |
|---|---|---|---|
| Metadatos | `GET /api/v1/info` | Servicio, versión, entorno y `/docs` (público) | `app/api/routes_health.py:17-25` |
| Liveness | `GET /health` | `{"status":"ok"}`, **no toca la BD** (público) | `app/api/routes_health.py:28-31` |
| Readiness | `GET /ready` | Verifica conexión y reporta base, usuario, versión y nº de tablas; `503` si falla (público) | `app/api/routes_health.py:34-57` |
| Resumen | `GET /api/v1/resumen` | Conteos de entidades (**requiere token**) | `app/api/routes_health.py:60-80` |

> RNF-19 pide logs con `request-id` **y usuario** en todas las operaciones, métricas de negocio,
> alertas ante ingesta no ejecutada o fallo de notificación, y retención ≥ 30 días
> (`RepoTecnico/requerimientos.md:198`). El código cumple el `request-id` y las métricas
> (`GET /api/v1/metricas`, `app/api/routes_alertas.py:400-423`), pero **no registra el usuario en el
> log ni incluye alertas automáticas ni política de retención propia**: esos puntos están
> **pendientes de confirmar** con la configuración de Cloud Logging.

---

## Incidentes

### Tipos (ingesta fallida, dependencia externa caída, bloqueo de usuario, fallo de notificación)

| Tipo | Síntoma observable | Causa típica | Referencia |
|---|---|---|---|
| Ingesta fallida | Aviso de columnas ≠ 80 o de filas malformadas; lote con `detalle_error` | Cambio de formato del sistema origen | `app/services/ingesta.py:182-186,218-223` |
| Ingesta vacía o tardía | No hay lote del día | El archivo no llegó antes de las 08:00 | `RepoTecnico/interfaz_csv_origen.md:29,88` |
| Dependencia externa caída | Notificaciones en `PENDIENTE`/`FALLIDO` | Telegram o SMTP sin credenciales o caído | `app/services/notificaciones.py:19-42` |
| Bloqueo de usuario | `423` al iniciar sesión | 3 intentos fallidos | `app/api/routes_auth.py:91-109` |
| Fallo de notificación | Métrica `notificaciones_fallidas` > 0 | Agotó `outbox.max_intentos` | `app/services/outbox.py:87-90` |
| BD no disponible | `/ready` devuelve `503` | Instancia inaccesible | `app/api/routes_health.py:56-57` |

### Detección

1. **Readiness**: consultar `GET /ready`; un `503` indica base no disponible
   (`app/api/routes_health.py:56-57`).
2. **Historial de lotes**: `GET /api/v1/ingesta/lotes` con `estado` y `detalle_error`
   (`app/api/routes_ingesta.py:175-185`).
3. **Bandeja de notificaciones**: `GET /api/v1/notificaciones?estado=PENDIENTE|FALLIDO`
   (`app/api/routes_alertas.py:169-183`).
4. **Métricas**: `GET /api/v1/metricas` devuelve lotes de ingesta, casos ingeridos, fallas activas,
   pendientes/enviadas/fallidas y si cada canal está configurado
   (`app/api/routes_alertas.py:400-423`).
5. **Alertas de falla masiva**: `GET /api/v1/fallas-masivas?solo_activas=true`
   (`app/api/routes_alertas.py:45-61`).

### Contención

- **Ingesta fallida por formato**: no reingerir a ciegas. Comparar el encabezado contra las 80
  posiciones esperadas (`app/services/ingesta.py:20-23,183-186`) y solicitar a CANTV una nueva versión
  del contrato de interfaz (`RepoTecnico/interfaz_csv_origen.md:88-91`).
- **Dependencia externa caída**: el outbox **no pierde** la notificación: queda `PENDIENTE` sin
  consumir intentos mientras falte credencial, y se reintenta con backoff al configurar el canal
  (`app/services/outbox.py:78-85`).
- **Usuario bloqueado**: desbloquear con 3 de las 12 palabras (`POST /api/v1/auth/unlock`,
  `app/api/routes_auth.py:171-187`) o restablecer la clave (`POST /api/v1/auth/reset-password`,
  `app/api/routes_auth.py:190-206`).
- **Fallo de notificación crítica**: verificar el error registrado en `notificacion.error`
  (`RepoTecnico/db/schema.sql:635`) y, si el canal está caído, usar el otro canal como respaldo
  (envío de despacho con `canal=CORREO`, `app/api/routes_despachos.py:435`).
- **Falla masiva**: planificarla (`POST /api/v1/fallas-masivas/{id}/planificacion`,
  `app/api/routes_alertas.py:120-141`) y solicitar material si aplica
  (`app/api/routes_alertas.py:144-163`).

### Escalamiento

| Nivel | Responsable | Cuándo | Acción |
|---|---|---|---|
| N1 | Operador de turno (SUPERVISOR) | Ingesta tardía, avisos del parser, cita solapada | Reprocesar/reintentar y registrar |
| N2 | ADMIN | Bloqueo de usuario, fallo persistente de notificación | Desbloqueo, cambio de canal |
| N3 | Dirección del proyecto | BD no disponible, pérdida de datos, acceso indebido | Coordinar con GCP/CANTV |
| N4 | CANTV (protección de datos) | Incidente con PII | Notificación formal **pendiente de confirmar** |

Los responsables de protección de datos y del sistema origen **están pendientes de designar** del
lado de CANTV (`RepoTecnico/requerimientos.md:267-268`).

---

## Continuidad

### Disponibilidad 99 % en 06:00–20:00 (RNF-17)

RNF-17 exige disponibilidad del backend/web **≥ 99 %** en horario operativo **06:00–20:00**, con
reintentos y degradación controlada ante caída de dependencias externas (Telegram, correo, MCP)
(`RepoTecnico/requerimientos.md:196`). El despliegue real es Cloud Run `ggto-web` en
`europe-west1`, con acceso público y escalado `minInstanceCount=0`/`maxInstanceCount=10` para el
servicio planificado (`RepoTecnico/scripts/07_cloudrun_web.sh:24`).

| Riesgo de continuidad | Efecto | Estado |
|---|---|---|
| Instancia compartida sin HA declarada | Indisponibilidad de BD afecta a GGTO y a TrueKeate | Riesgo aceptado D-26 |
| `minInstanceCount=0` | Arranque en frío tras inactividad | Configuración del servicio |
| Sin respaldo | Pérdida irreversible ante borrado/corrupción | D-26 |
| Un solo canal con credenciales | Sin Telegram, las alertas quedan pendientes | `app/services/notificaciones.py:20-22` |

No existe un **acuerdo de nivel de servicio monitorizado** ni una página de estado: el cumplimiento
del 99 % es **pendiente de confirmar** con métricas de uptime (RNF-19).

### Degradación controlada

El diseño permite operar con dependencias degradadas sin bloquear el flujo principal:

- Las notificaciones se **encolan** y no interrumpen la ingesta ni el despacho
  (`app/services/outbox.py:34-48`).
- Un canal sin credenciales **difiere** la notificación en lugar de perderla
  (`app/services/outbox.py:78-85`).
- El servidor MCP responde con error JSON-RPC y **no bloquea** la API principal
  (`app/api/routes_alertas.py:386-394`).
- Si la sectorización no encuentra patrón, el caso se crea **sin sector** y queda reportado en
  `sin_sector` (`app/api/routes_ingesta.py:83-86`).
- El parser **recorta** valores que exceden la longitud de su campo en lugar de abortar la carga,
  y lo informa en los avisos (`app/services/ingesta.py:80-94,208-223`).

---

## Pendientes operativos

Resumen de los puntos abiertos que afectan a la operación y al mantenimiento, tomados literalmente de
los documentos del proyecto:

| # | Pendiente | Referencia |
|---|---|---|
| 1 | Crear el `.env.ggto` del proyecto, separado del entorno de MCC | `RepoTecnico/entornos_globales.md:275` |
| 2 | Disponer de cliente `psql` y/o dependencia de pruebas | `RepoTecnico/entornos_globales.md:276` |
| 3 | Desbloquear la facturación GCP para `compute`, `run`, `secretmanager` y Cloud SQL propio | `RepoTecnico/entornos_globales.md:277-278` |
| 4 | Configurar las credenciales reales de Telegram, correo y MCP | `RepoTecnico/entornos_globales.md:279-280` |
| 5 | Habilitar backups/PITR/protección de borrado **antes de datos reales** | `RepoTecnico/entornos_globales.md:281` |
| 6 | Restringir el acceso público del servicio con PII real | `RepoTecnico/pruebas/informe_fase4.md:112-113` |
| 7 | Firmar el contrato de interfaz del CSV con CANTV | `RepoTecnico/pruebas/informe_fase4.md:111` |
| 8 | App móvil Flutter (Ciclo 8, fuera de alcance de la v1) | `RepoTecnico/pruebas/informe_fase4.md:109-110` |

> **Nota final de fidelidad:** todo lo descrito en este manual se apoya en archivos existentes del
> repositorio. Las capacidades de automatización, migraciones, respaldo y alertas programadas que
> aparecen en los requerimientos pero no en el código se han marcado como **«pendiente de confirmar»**.
