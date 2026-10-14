# Manual técnico — Monitoreo y reportes (GGTO, Ciclo 7)

> Documentación técnica fiel al código real del proyecto **GGTO — CANTV C.A., Central
> Francisco Salias (Área 4)**. Cada afirmación relevante se respalda con una referencia
> `ruta:línea`. Lo que no es verificable en el repositorio se marca como
> **"pendiente de confirmar"**.

## Visión general

### Alcance y requerimientos

El módulo de MONITOREO y REPORTES corresponde al Ciclo 7 del plan de desarrollo y su
objetivo es alimentar los tableros de monitoreo y gráficos con las métricas de gestión
diaria y semanal, casos globales, reparación, construcción y cuadrilla (RF-26,
`RepoTecnico/requerimientos.md:124`), además de generar el reporte de trabajo diario,
semanal y mensual (RF-28, `RepoTecnico/requerimientos.md:126`). El catálogo funcional
lo agrupa bajo las zonas `MONITOREO`, `GRÁFICOS` y `REPORTES`
(`RepoTecnico/requerimientos.md:60-61,80`).

En la traza de decisiones, el cierre de las métricas se registra en **D-56**, que da por
completado el Ciclo 7 con métricas cerradas en `RepoTecnico/metricas.md` v1.0 —lo que a
su vez cierra **S-08** y **D-17**—, siete endpoints de monitoreo, reporte diario/semanal/
mensual con versión imprimible y página web con gráficos SVG propios
(`RepoTecnico/estado_proyecto.md:119`). La definición de métricas había quedado
explícitamente diferida a la Fase 3 por **D-17** (`RepoTecnico/estado_proyecto.md:81`).

| Aspecto | Valor verificado | Referencia |
|---|---|---|
| Ciclo | Ciclo 7 — MONITOREO y REPORTES | `RepoTecnico/estado_proyecto.md:119` |
| Requerimientos | RF-26 (tableros), RF-28 (reporte de trabajo) | `RepoTecnico/requerimientos.md:124,126` |
| Documento normativo | `RepoTecnico/metricas.md` v1.0 (pendiente de validación con CANTV) | `RepoTecnico/metricas.md:8` |
| Router | `app/api/routes_monitoreo.py`, prefijo `/api/v1` | `app/api/routes_monitoreo.py:19` |
| Servicio | `app/services/monitoreo.py` | `app/services/monitoreo.py:1` |
| Día operativo (D-94) | `app/services/tiempo.py` (`ZONA_OPERATIVA`, `hoy_operativo`) | `app/services/tiempo.py:16,30` |
| Página web | `app/web/src/pages/Monitoreo.tsx` | `app/web/src/pages/Monitoreo.tsx:1-16` |
| Gráficos | SVG propios en `app/web/src/components/graficos.tsx` | `app/web/src/components/graficos.tsx:1-7` |
| Montaje del router | `app.include_router(routes_monitoreo.router)` | `app/main.py:90` |

### Ampliación D-89…D-94

Sobre el Ciclo 7 se montaron dos ciclos posteriores que **cambian la superficie** de este
módulo:

- **D-90 — regla REPARACIÓN ⇐ 70\* + avería real.** Añade el endpoint de métricas
  `GET /api/v1/monitoreo/reclasificaciones` (`app/api/routes_monitoreo.py:145-153`) y la
  función `reclasificaciones()` (`app/services/monitoreo.py:263-332`).
- **D-94 — identificador de pago y día operativo.** Añade
  `GET /api/v1/monitoreo/identificadores` (`app/api/routes_monitoreo.py:156-170`) y la
  función `identificadores()` (`app/services/monitoreo.py:335-393`); fija el **día
  operativo** en `America/Caracas` (`app/services/tiempo.py:16`) y sustituye el truncado
  `func.date(...)` por `func.timezone(...)` (`_dia()`, `app/services/monitoreo.py:57-65`).

Ambos endpoints nuevos son de **ADMIN/SUPERVISOR**: el router crea
`_gestion = require_roles("ADMIN", "SUPERVISOR")` (`app/api/routes_monitoreo.py:22`) y lo
aplica como dependencia, de modo que el **TÉCNICO recibe 403**
(`app/api/routes_monitoreo.py:150,162`). Esto corresponde a las filas de la matriz §5.2 de
`RepoTecnico/requerimientos.md` **«MONITOREO — métricas por identificador de pago (D-94)»**
(SUPER/ADMIN/SUPERVISOR lectura; TÉCNICO —) e **«IDENTIFICADOR DE PAGO — histórico,
reincidencia y ciclo de vida (D-89)»** (SUPER/ADMIN/SUPERVISOR CRUD; TÉCNICO lectura de sus
casos). El resto de endpoints de MONITOREO siguen siendo de
lectura para cualquier usuario autenticado, con el alcance por cuadrilla del TÉCNICO
(`app/api/routes_monitoreo.py:41-50`). En la web el bloque del identificador solo se pinta
si el rol no es `TECNICO` (`app/web/src/pages/Monitoreo.tsx:930-931`).

### Fuente normativa de las métricas

Todas las fórmulas implementadas provienen de `RepoTecnico/metricas.md`. La cabecera del
documento advierte que cada métrica define fórmula, entidad, ventana y redondeo, que todo
se calcula en hora de Venezuela (`America/Caracas`), que «día» es el día natural
`00:00–23:59:59` y que la semana operativa es **lunes a sábado**, con el domingo como día
no operativo (`RepoTecnico/metricas.md:10-12`).

El módulo de servicio declara esa dependencia en su docstring: «Cálculo de las métricas de
MONITOREO y REPORTES (ver `RepoTecnico/metricas.md`)» (`app/services/monitoreo.py:1`). El
router hace lo propio e incluye además RF-07 (`app/api/routes_monitoreo.py:1`).

### Ubicación en el código

| Capa | Archivo | Responsabilidad |
|---|---|---|
| API | `app/api/routes_monitoreo.py` | 11 operaciones HTTP, validación de parámetros y plantilla HTML imprimible |
| Servicio | `app/services/monitoreo.py` | Consultas SQLAlchemy y armado de cada indicador |
| Esquemas | No hay módulo Pydantic dedicado: las operaciones devuelven `dict` | Los `return` se anotan `-> dict` (`app/api/routes_monitoreo.py:63,76,90,103,114,127,140,151,163,184`) |
| Tipos del frontend | `app/web/src/api/types.ts` | Interfaces `MonitoreoDiario`…`ReporteTrabajo` importadas por la página (`app/web/src/pages/Monitoreo.tsx:20-33`) |
| Cliente web | `app/web/src/api/client.ts` | Funciones `monitoreoDiario`…`obtenerReporteTrabajoImprimible` (`app/web/src/api/client.ts:904-971`) |
| Página web | `app/web/src/pages/Monitoreo.tsx` | Tablero de solo lectura repartido en fichas/bloques (`app/web/src/pages/Monitoreo.tsx:879-934`) |
| Gráficos | `app/web/src/components/graficos.tsx` | Barras, barras agrupadas, curva y torta en SVG |

Las **seis** primeras operaciones y los dos reportes exigen únicamente un usuario
autenticado y aplican el alcance por cuadrilla (`app/api/routes_monitoreo.py:62,75,89,102,113,126,139,183,198`
y `_alcance` en `:41-50`). Las **dos nuevas** (`reclasificaciones` e `identificadores`) exigen
`ADMIN` o `SUPERVISOR` (`app/api/routes_monitoreo.py:22,150,162`): el rol `TECNICO` recibe
**403**, tal como verifica `app/tests/test_d94_identificador_monitoreo.py:147-150`. Las
pruebas de acceso previas confirman que el rol `TECNICO` sí puede consultar las rutas
clásicas de monitoreo y el reporte (`app/tests/test_monitoreo_api.py:202-206`).

## Métricas

### Gestión diaria

La función `gestion_diaria` devuelve el bloque del día indicado
(`app/services/monitoreo.py:131-162`). El router la expone en `GET /api/v1/monitoreo/diario`
y, si no se envía `fecha`, usa `svc.hoy_operativo()` —el día de `America/Caracas` desde D-94—
(`app/api/routes_monitoreo.py:56-66`).

| Indicador | Fórmula implementada | Referencia |
|---|---|---|
| `ingresos_nuevos` | `count(caso)` con `_dia(creado_en) = fecha` | `app/services/monitoreo.py:139-140` |
| `resueltos_residencial` | `caso_estado_hist` con `estado_nuevo='CERRADO'` y categoría `RESIDENCIAL` | `app/services/monitoreo.py:141` |
| `resueltos_empresarial` | idem con categoría en `('EMPRESA','GOBIERNO')` | `app/services/monitoreo.py:142-148` |
| `resueltos_referidos` | idem con categoría `REFERIDO` | `app/services/monitoreo.py:149` |
| `citados` | `count(distinct id_caso)` en `cita` del día | `app/services/monitoreo.py:150-152` |
| `diferidos` | casos que pasaron a `DIFERIDO` ese día | `app/services/monitoreo.py:153` |
| `gestionados` | `count(distinct id_caso)` en `despacho_caso` con estado `GESTIONADO` de despachos del día | `app/services/monitoreo.py:154-160` |
| `pendientes_total` | casos cuyo `estado_actual` no es `CERRADO` ni `CANCELADO` | `app/services/monitoreo.py:161` |

El criterio de «pendiente» se centraliza en `_pendientes` y en la tupla
`PENDIENTE_EXCLUIR = ("CERRADO", "CANCELADO")` (`app/services/monitoreo.py:27,124-125`).
La categoría empresarial agrupa `EMPRESA` y `GOBIERNO`
(`EMPRESARIAL = ("EMPRESA", "GOBIERNO")`, `app/services/monitoreo.py:28`). La prueba de
integración verifica el bloque con 5 ingresos, 1 resuelto residencial y 4 pendientes
(`app/tests/test_monitoreo_api.py:63-71`).

#### Nota sobre «gestionado»

`RepoTecnico/metricas.md` define «Gestionado» como el caso con al menos una gestión en
`actividad.fecha_hora` y aclara que, mientras no exista la app móvil (Ciclo 8), se aproxima
con `despacho_caso.estado='GESTIONADO'` (`RepoTecnico/metricas.md:22`). La implementación
real usa la aproximación por `despacho_caso` (`app/services/monitoreo.py:154-160`). La app
móvil Flutter **sí existe** desde el Ciclo 8 (`app_movil/`, ver el manual 11), aunque esta
métrica sigue usando la aproximación por `despacho_caso`: la actividad de la APK se refleja
en el despacho, no en una tabla `actividad`.

### Gestión semanal (lunes → sábado)

`rango_semana` calcula el lunes a partir de `fecha.weekday()` y suma cinco días para
obtener el sábado (`app/services/monitoreo.py:33-36`), con la constante
`DIAS_SEMANA = 6` (`app/services/monitoreo.py:29`). `gestion_semanal` recorre los seis días
y arma la curva (`app/services/monitoreo.py:191-216`).

| Indicador por día | Cálculo | Referencia |
|---|---|---|
| `asignados` | `count(despacho_caso)` de despachos de ese día | `app/services/monitoreo.py:199-203` |
| `cerrados` | `_resueltos(..., dia, dia, None)` | `app/services/monitoreo.py:213` |
| `gestionados` | `despacho_caso.estado='GESTIONADO'` de ese día | `app/services/monitoreo.py:204-209` |

La respuesta devuelve `desde` (lunes) y `hasta` (sábado) junto a la lista `dias`
(`app/services/monitoreo.py:216`). La prueba `test_gestion_semanal_devuelve_seis_dias`
valida exactamente seis puntos y las cuatro claves de cada día
(`app/tests/test_monitoreo_api.py:120-125`). La prueba
`test_semanal_refleja_los_cierres` documenta el caso de borde del domingo: si hoy es
domingo el cierre queda fuera de la ventana (`app/tests/test_monitoreo_api.py:155-163`).

### Casos globales

`casos_globales` combina pendientes (a la fecha) con resueltos en el rango, y añade los
desgloses por estado y por categoría (`app/services/monitoreo.py:219-238`).

| Campo | Cálculo | Referencia |
|---|---|---|
| `pendientes` | `_pendientes` (excluye `CERRADO`/`CANCELADO`) | `app/services/monitoreo.py:222` |
| `resueltos` | `_resueltos` en el rango `desde..hasta` | `app/services/monitoreo.py:223` |
| `total` | `pendientes + resueltos` | `app/services/monitoreo.py:237` |
| `por_estado` | `group_by(Caso.estado_actual)` | `app/services/monitoreo.py:224-229` |
| `por_categoria` | `group_by(Caso.categoria)` | `app/services/monitoreo.py:230-235` |

En el router, el rango por defecto es del día 1 del mes en curso hasta el día operativo de
hoy (`hoy.replace(day=1)` y `hoy = svc.hoy_operativo()`, `app/api/routes_monitoreo.py:82-94`).

### Reparación

`reparacion` cuenta pendientes con `tipo_caso != 'CONSTRUCCION'` separados por categoría
(`app/services/monitoreo.py:241-250`):

| Campo | Fórmula | Referencia |
|---|---|---|
| `residenciales_comunes` | pendiente, `categoria='RESIDENCIAL'`, `tipo_caso != 'CONSTRUCCION'` | `app/services/monitoreo.py:243-244` |
| `residenciales_referidos` | pendiente, `categoria='REFERIDO'`, `tipo_caso != 'CONSTRUCCION'` | `app/services/monitoreo.py:245-246` |
| `empresariales` | pendiente, categoría en `EMPRESA`/`GOBIERNO`, `tipo_caso != 'CONSTRUCCION'` | `app/services/monitoreo.py:247-248` |
| `total` | suma de los tres | `app/services/monitoreo.py:249-250` |

### Construcción

`construccion` cuenta pendientes con `tipo_caso == 'CONSTRUCCION'`
(`app/services/monitoreo.py:253-260`):

| Campo | Fórmula | Referencia |
|---|---|---|
| `residenciales` | pendiente, `tipo_caso='CONSTRUCCION'`, `categoria='RESIDENCIAL'` | `app/services/monitoreo.py:255-256` |
| `empresariales` | pendiente, `tipo_caso='CONSTRUCCION'`, categoría `EMPRESA`/`GOBIERNO` | `app/services/monitoreo.py:257-258` |
| `total` | suma | `app/services/monitoreo.py:259-260` |

La prueba `test_reparacion_y_construccion` verifica que un caso `EMPRESA` +
`CONSTRUCCION` no se cuenta en reparación y sí en construcción (total 1)
(`app/tests/test_monitoreo_api.py:94-104`).

### Reclasificaciones de la regla REPARACIÓN/REFERIDO (D-90)

`reclasificaciones(db, id_central)` (`app/services/monitoreo.py:263-332`) mide RF-49/RF-50/
RF-55. Devuelve estas claves:

| Clave | Regla | Referencia |
|---|---|---|
| `reparaciones_validas` | `tipo_caso='REPARACION'` **con** `id_pago` y `id_averia` que no empieza por `REF-` | `app/services/monitoreo.py:276-281` |
| `referidos` | casos `tipo_caso='REFERIDO'` | `app/services/monitoreo.py:282` |
| `reclasificadas` | referidos que además tienen ficha `caso_especial` de actividad `REPARACION` (nacieron reparación y no acreditaron sus claves) | `app/services/monitoreo.py:298-307` |
| `pendientes_historicos` | REPARACIONES **marcadas** (sin 70\* o con avería `REF-…`) que aún no han tenido su próximo cambio (DEC-IP-3) | `app/services/monitoreo.py:283-289` |
| `pendientes_historicos_en_terminal` | las marcadas que además están en estado terminal (`CERRADO`/`CANCELADO`/`ENRUTADO`, `app/services/monitoreo.py:30`) | `app/services/monitoreo.py:290-297` |
| `referidos_sin_ficha` | referidos sin fila en `caso_especial` (estado transitorio) | `app/services/monitoreo.py:308-315` |
| `referidos_por_clasificacion` | desglose de los referidos por `categoria` | `app/services/monitoreo.py:316-323` |

La marca que usa esta métrica es la **derivada** de `app/services/clasificacion.py`
(`esta_marcado`, `:47-51`); la regla completa se documenta en el manual 06. La suite
`app/tests/test_d90_clasificacion.py` cubre estas cifras (constante `METRICAS` en
`app/tests/test_d90_clasificacion.py:32`).

### Identificadores de pago (D-94)

`identificadores(db, id_central, dias, limite)` (`app/services/monitoreo.py:335-393`) mira el
caso desde el lado del **identificador de pago (70\*)**:

| Clave | Regla | Referencia |
|---|---|---|
| `ventana_dias` | días de la ventana de reincidencia (`pago.reincidencia_dias`, por defecto 90) | `app/services/monitoreo.py:377`; `app/services/pagos.py:53-59` |
| `con_casos` | identificadores distintos con al menos un caso de la central | `app/services/monitoreo.py:351-360,378` |
| `casos_con_identificador` | total de casos con `id_pago` | `app/services/monitoreo.py:379` |
| `casos_sin_identificador` | casos de la central con `id_pago` nulo | `app/services/monitoreo.py:380` |
| `media_casos` | `total_casos / con_casos`, redondeado a 1 decimal | `app/services/monitoreo.py:381` |
| `max_casos` | máximo de reportes de un identificador | `app/services/monitoreo.py:382` |
| `reincidentes` | identificadores con **2 o más** reportes dentro de la ventana (RF-54) | `app/services/monitoreo.py:372,383` |
| `top` | lista de hasta `limite` identificadores con `numero`, `casos`, `reportes_ventana` y `reincidente` | `app/services/monitoreo.py:361-366,384-392` |

La ventana se calcula con `datetime.now(UTC) - timedelta(days=dias)`
(`app/services/monitoreo.py:350`) y el parámetro `dias` llega desde la configuración
(`app/api/routes_monitoreo.py:165-170`). La suite es
`app/tests/test_d94_identificador_monitoreo.py`.

### Cuadrilla

`por_cuadrilla` recorre las cuadrillas de calle (`es_supervisor = false`) ordenadas por
código (`app/services/monitoreo.py:396-403`) y calcula, por día y por cuadrilla,
`asignados`, `cerrados` y `gestionados` con `_por_dia_cuadrilla`
(`app/services/monitoreo.py:165-188`), acumulando los totales
(`app/services/monitoreo.py:405-415`). La respuesta incluye `desde`, `dias` y `cuadrillas`
(`app/services/monitoreo.py:416`).

#### Cálculo de «cerrados» por cuadrilla

`cerrados` une `caso_estado_hist` con `caso`, `despacho_caso` y `despacho`, y exige que el
despacho sea de esa cuadrilla y ese día y que el historial tenga `estado_nuevo='CERRADO'`
con día operativo del mismo día (`app/services/monitoreo.py:178-186`). La prueba
`test_monitoreo_por_cuadrilla` genera el despacho del lunes, marca un caso como
`GESTIONADO` y comprueba 4 asignados y 1 gestionado (`app/tests/test_monitoreo_api.py:128-152`).

### Capacidad operativa

`capacidad` lista las cuadrillas activas ordenadas por código
(`app/services/monitoreo.py:419-425`) y arma el detalle por cuadrilla: integrantes vigentes
(`cuadrilla_tecnico.hasta IS NULL`, `app/services/monitoreo.py:428-431`), flota asociada
formateada como `can (status)` (`app/services/monitoreo.py:432-436`) y la marca `completa`
(`app/services/monitoreo.py:437`).

| Campo agregado | Cálculo | Referencia |
|---|---|---|
| `cuadrillas_activas` | cuadrillas del detalle que no son de supervisor | `app/services/monitoreo.py:440` |
| `tecnicos_activos` | técnicos de la central con `status='ACTIVO'` | `app/services/monitoreo.py:442-445` |
| `flota_disponible` | flota de la central con `status='DISPONIBLE'` | `app/services/monitoreo.py:446-449` |
| `herramientas_disponibles` | herramienta con `estado='DISPONIBLE'` | `app/services/monitoreo.py:450-453` |
| `sectores_activos` | sectores de la central con `activo = true` | `app/services/monitoreo.py:454-457` |

La prueba `test_capacidad_operativa` confirma 2 cuadrillas activas, 3 en el detalle
(incluye la cuadrilla 0 del supervisor) y que, sin integrantes ni flota, las cuadrillas de
calle quedan marcadas como incompletas (`app/tests/test_monitoreo_api.py:107-117`).

## Endpoints

### Superficie de la API

El router se declara con `prefix="/api/v1"` y la etiqueta OpenAPI
`"monitoreo y reportes"` (`app/api/routes_monitoreo.py:19`). Expone **11 operaciones**:

| Método y ruta | Propósito | Rol | Línea |
|---|---|---|---|
| `GET /api/v1/monitoreo/diario` | Gestión diaria | autenticado (alcance por cuadrilla) | `app/api/routes_monitoreo.py:56` |
| `GET /api/v1/monitoreo/semanal` | Gestión semanal (curva lunes a sábado) | autenticado | `app/api/routes_monitoreo.py:69` |
| `GET /api/v1/monitoreo/globales` | Casos globales: pendientes vs resueltos | autenticado | `app/api/routes_monitoreo.py:82` |
| `GET /api/v1/monitoreo/reparacion` | Pendientes de reparación por tipo | autenticado | `app/api/routes_monitoreo.py:97` |
| `GET /api/v1/monitoreo/construccion` | Pendientes de construcción por tipo | autenticado | `app/api/routes_monitoreo.py:108` |
| `GET /api/v1/monitoreo/cuadrilla` | Asignados vs cerrados vs gestionados por cuadrilla | autenticado | `app/api/routes_monitoreo.py:119` |
| `GET /api/v1/monitoreo/capacidad` | Capacidad operativa | autenticado | `app/api/routes_monitoreo.py:134` |
| `GET /api/v1/monitoreo/reclasificaciones` | Regla REPARACIÓN ⇐ 70\* + avería real (D-90) | **ADMIN/SUPERVISOR** | `app/api/routes_monitoreo.py:145` |
| `GET /api/v1/monitoreo/identificadores` | Métricas por identificador de pago (D-94) | **ADMIN/SUPERVISOR** | `app/api/routes_monitoreo.py:156` |
| `GET /api/v1/reportes/trabajo` | Reporte de trabajo (diario/semanal/mensual) | autenticado | `app/api/routes_monitoreo.py:176` |
| `GET /api/v1/reportes/trabajo/imprimible` | Reporte de trabajo imprimible (HTML) | autenticado | `app/api/routes_monitoreo.py:190` |

### Parámetros y resolución de la central

Todos los endpoints aceptan `id_central` opcional y lo resuelven con
`resolver_central(db, id_central, cargar_config(db))` a través del auxiliar `_central`
(`app/api/routes_monitoreo.py:25-26`). La sesión de base de datos se inyecta con
`Depends(get_db)` y el usuario con `Depends(get_current_user)` o `Depends(_gestion)` según
el endpoint (p. ej. `app/api/routes_monitoreo.py:61-62` y `:149-150`).

| Endpoint | Parámetros propios | Validación |
|---|---|---|
| `/monitoreo/diario` | `fecha` (date), `id_central`, `id_cuadrilla` (D-72) | `fecha` por defecto `svc.hoy_operativo()` (`:58,65`) |
| `/monitoreo/semanal` | `desde` (date), `id_central`, `id_cuadrilla` | `desde` por defecto `svc.hoy_operativo()` (`:71,78`) |
| `/monitoreo/globales` | `desde`, `hasta`, `id_central`, `id_cuadrilla` | por defecto día 1 del mes → día operativo de hoy (`:84-87,92-93`) |
| `/monitoreo/reparacion` | `id_central`, `id_cuadrilla` | — (`:99`) |
| `/monitoreo/construccion` | `id_central`, `id_cuadrilla` | — (`:110`) |
| `/monitoreo/cuadrilla` | `desde`, `dias`, `id_central`, `id_cuadrilla` | `dias` entre 1 y 31, por defecto 6 (`:121-122`) |
| `/monitoreo/capacidad` | `id_central`, `id_cuadrilla` | — (`:136`) |
| `/monitoreo/reclasificaciones` | `id_central` | rol ADMIN/SUPERVISOR (`:148-150`) |
| `/monitoreo/identificadores` | `id_central`, `limite` | `limite` entre 1 y 50, por defecto 10; rol ADMIN/SUPERVISOR (`:159-162`) |
| `/reportes/trabajo` | `periodo`, `fecha`, `id_central`, `id_cuadrilla` | patrón `^(diario|semanal|mensual)$` (`:178`) |
| `/reportes/trabajo/imprimible` | `periodo`, `fecha`, `id_central`, `id_cuadrilla` | igual patrón (`:193`) |

El parámetro `dias` de `/monitoreo/cuadrilla` se usa para construir el rango con
`_dias(desde, dias)` (`app/services/monitoreo.py:49-50,406`); en la página web el bloque de
cuadrilla solicita siempre 6 días (`app/web/src/pages/Monitoreo.tsx:754`,
`app/web/src/api/client.ts:937-939`).

#### Cliente web

`app/web/src/api/client.ts` implementa una función por endpoint
(`monitoreoDiario`…`monitoreoCapacidad`, y desde D-90/D-94 `monitoreoReclasificaciones` y
`monitoreoIdentificadores`, más `reporteTrabajo` y `obtenerReporteTrabajoImprimible`;
`app/web/src/api/client.ts:904-971`). El comentario
explica que el reporte imprimible se pide con `Bearer` y se abre en una pestaña nueva,
porque la URL directa no puede llevar la cabecera de autorización
(`app/web/src/api/client.ts:961-970`).

## Reporte de trabajo

### GET /api/v1/reportes/trabajo

`reporte_trabajo` calcula el rango según el periodo y compone un objeto con la cabecera
(`periodo`, `desde`, `hasta`) y **nueve bloques** (`app/services/monitoreo.py:464-482`):
`diario`, `semanal`, `globales`, `reparacion`, `construccion`, `cuadrilla`, `capacidad` y,
desde D-94, `reclasificaciones` e `identificadores` (`:479-481`).

| Periodo | Rango | Referencia |
|---|---|---|
| `diario` | el día indicado | `app/services/monitoreo.py:46` |
| `semanal` | lunes a sábado de la semana del día indicado | `app/services/monitoreo.py:40-41` |
| `mensual` | del día 1 al último día del mes | `app/services/monitoreo.py:42-45` |

La implementación del rango mensual calcula el primer día del mes siguiente sumando 32
días y reemplazando el día por 1, y luego resta un día (`app/services/monitoreo.py:43-45`).
El bloque semanal se calcula siempre desde el lunes de la fecha, aunque el periodo sea
diario o mensual (`app/services/monitoreo.py:466-467,473`). El router devuelve el JSON y valida
el `periodo` con un patrón que produce HTTP 422 si es inválido
(`app/api/routes_monitoreo.py:178`; prueba `app/tests/test_monitoreo_api.py:192-197`).

La prueba parametrizada `test_reporte_trabajo` recorre los tres periodos y comprueba la
presencia de las siete claves del Ciclo 7, que el mensual empieza en `-01` y que el semanal
trae seis días (`app/tests/test_monitoreo_api.py:167-179`).

### Versión imprimible

`reporte_imprimible` está declarado con `response_class=HTMLResponse`
(`app/api/routes_monitoreo.py:190`). Vuelve a invocar `svc.reporte_trabajo` y desempaqueta
los bloques diario, globales, reparación y construcción
(`app/api/routes_monitoreo.py:200-203`). Con esos datos construye filas HTML para el
detalle diario, la semana, las cuadrillas, los pendientes por estado, los identificadores
de pago y la regla REPARACIÓN/REFERIDO
(`app/api/routes_monitoreo.py:205-242`), y renderiza un documento completo con
`@page { size: letter; margin: 1cm; }` y estilos de impresión
(`app/api/routes_monitoreo.py:244-309`).

| Elemento del HTML | Origen | Referencia |
|---|---|---|
| Tarjetas: pendientes, resueltos, reparación, construcción, cuadrillas activas | `globales`, `reparacion`, `construccion`, `capacidad` | `app/api/routes_monitoreo.py:269-275` |
| Tarjetas: identificadores de pago, reincidentes (N días), casos sin 70\*, media de reportes | `identificadores` | `app/api/routes_monitoreo.py:277-282` |
| Tabla «Gestión del día» | `diario` | `app/api/routes_monitoreo.py:284-285` |
| Tabla «Gestión semanal (lunes a sábado)» | `semanal.dias` | `app/api/routes_monitoreo.py:287-289` |
| Tabla «Producción por cuadrilla (semana)» | `cuadrilla.cuadrillas` | `app/api/routes_monitoreo.py:291-293` |
| Tabla «Pendientes por estado» | `globales.por_estado` | `app/api/routes_monitoreo.py:295-297` |
| Tabla «Identificadores de pago con más reportes (últimos N días)» (Identificador · Casos · En la ventana · Reincidente) | `identificadores.top` | `app/api/routes_monitoreo.py:299-302` |
| Tabla «Regla REPARACIÓN ⇐ 70\* + avería real» (reparaciones válidas, referidos, reclasificadas, referidos sin ficha, marcadas sin regularizar) | `reclasificaciones` | `app/api/routes_monitoreo.py:304-306` |
| Encabezado «Día operativo: America/Caracas» | `svc.ZONA_OPERATIVA` | `app/api/routes_monitoreo.py:266` |
| Botón «Imprimir» con `window.print()` | solo pantalla (`.no-print`) | `app/api/routes_monitoreo.py:308` |

La prueba `test_reporte_imprimible` verifica `content-type: text/html`, la cadena
`size: letter`, «Reporte de trabajo» y «Gestión semanal»
(`app/tests/test_monitoreo_api.py:182-189`); `test_d94_identificador_monitoreo.py:163`
comprueba que el informe incluye el lado del identificador. En la interfaz, el botón
«Imprimir / PDF» obtiene el HTML y lo escribe en una ventana nueva
(`app/web/src/pages/Monitoreo.tsx:456-556`). Si el navegador bloquea la ventana
emergente se muestra un aviso explícito (`app/web/src/pages/Monitoreo.tsx:488-490`).

## Reglas de cálculo

### Reparación y construcción excluyentes

Reparación y construcción son conjuntos disjuntos: reparación exige
`tipo_caso != 'CONSTRUCCION'` y construcción exige `tipo_caso == 'CONSTRUCCION'`
(`app/services/monitoreo.py:243-248,255-258`). La regla está documentada en
`RepoTecnico/metricas.md:66-67` y confirmada por la prueba
`test_reparacion_y_construccion` (`app/tests/test_monitoreo_api.py:94-104`). Un caso no
puede aparecer en ambos totales.

### Redondeo y zona horaria America/Caracas

`RepoTecnico/metricas.md:123-130` fija las reglas transversales:

| Regla | Texto normativo | Referencia |
|---|---|---|
| Redondeo | Todos los conteos son enteros; no hay promedios en v1 | `RepoTecnico/metricas.md:125` |
| Zona horaria | Las fechas se interpretan en `America/Caracas`; el frontend muestra `dd/mm/aaaa` | `RepoTecnico/metricas.md:126` |
| Tipos | `despacho.fecha` es `date`; `caso.creado_en` y `caso_estado_hist.fecha_hora` son `timestamptz` y se truncan a día con `::date` | `RepoTecnico/metricas.md:127-128` |

La implementación aplica el truncado a día mediante `_dia(...)`
(`app/services/monitoreo.py:57-65`) en **todas** las comparaciones de tiempo —incluidas las
de `caso.creado_en`, `caso_estado_hist.fecha_hora` y `cita.fecha_hora`— y nunca calcula
promedios: todos los
indicadores son `count` o sumas de conteos, salvo `media_casos` de la métrica de D-94
(`app/services/monitoreo.py:381`). El único porcentaje del tablero existe en la presentación
de la torta, calculado en el navegador con
`Math.round((p.valor / total) * 100)` (`app/web/src/components/graficos.tsx:343`), no en
el backend.

#### Día operativo (D-94) — resuelto

`metricas.md` afirma que el cálculo se hace en hora de Venezuela, pero la implementación
**antigua** aplicaba `func.date(...)` sobre columnas `timestamptz`, que PostgreSQL evalúa en
la zona de la **sesión** (UTC en Cloud SQL): a partir de las 20:00 de Caracas, todo caía en
el día siguiente. **D-94 lo corrige** con dos piezas:

| Pieza | Qué hace | Referencia |
|---|---|---|
| `app/services/tiempo.py` | `ZONA_OPERATIVA = "America/Caracas"`, `ahora_operativo()`, `hoy_operativo()`, `dia_operativo()` | `app/services/tiempo.py:16,25-44` |
| `_dia(columna)` | `func.date(func.timezone('America/Caracas', columna))`: la conversión se hace **en la base**, que ya trae la base de zonas horarias, no en Python | `app/services/monitoreo.py:57-65` |
| Rutas | `svc.hoy_operativo()` como valor por defecto de `fecha`/`desde` | `app/api/routes_monitoreo.py:65,78,92,129,186,201` |
| Informe imprimible | Encabezado «Día operativo: America/Caracas» | `app/api/routes_monitoreo.py:266` |
| Alarmas de despacho | Usan el día operativo | `app/services/mensajes.py::emitir_alarmas_despacho` (ver el manual 05) |

`app/services/monitoreo.py` **reexporta** `ZONA_OPERATIVA` y `hoy_operativo` desde
`app/services/tiempo.py` (`app/services/monitoreo.py:25`), de modo que las rutas los usan
como `svc.hoy_operativo()`. La prueba `test_hoy_operativo_es_el_de_caracas`
(`app/tests/test_d94_identificador_monitoreo.py:59-62`) fija el comportamiento. Ya **no**
queda como «pendiente de confirmar»: la zona de cálculo está explícita en el código.

## Página web MONITOREO y gráficos SVG propios

### Estructura de la página

Desde **D-72** `Monitoreo.tsx` no es una página monolítica: exporta **fichas** («bloques»)
que se reparten entre las pestañas de la página OPERACIÓN, y el componente por defecto
`Monitoreo` (`app/web/src/pages/Monitoreo.tsx:879-934`) arma la pestaña **MONITOREO**
(`app/web/src/pages/Operacion.tsx:83`). El TÉCNICO ve solo los datos de su cuadrilla: la API
los limita con `_alcance(...)` (`app/api/routes_monitoreo.py:41-50`).

Cada bloque carga sus propios datos con el *hook* `useCarga(...)`
(`app/web/src/pages/Monitoreo.tsx:136-159`); ya **no** existe una carga conjunta con
`Promise.allSettled` (ese patrón quedó solo en `app/web/src/pages/Alertas.tsx:76`).

| Zona de la interfaz | Componente y línea | Contenido |
|---|---|---|
| Parámetros de consulta | `app/web/src/pages/Monitoreo.tsx:896-919` | Fecha de la semana (lunes a sábado) |
| Reportes | `BloqueReportes`, `app/web/src/pages/Monitoreo.tsx:456-556` | Selector de periodo, «Ver reporte» y «Imprimir / PDF» |
| Gestión diaria | `BloqueGestionDiaria`, `app/web/src/pages/Monitoreo.tsx:433-454` | Tarjetas + gráfico de barras |
| Casos globales | `BloqueCasosGlobales`, `app/web/src/pages/Monitoreo.tsx:558-614` | Tarjetas, barras pendientes/resueltos y tablas por estado y categoría |
| Capacidad operativa | `BloqueCapacidadOperativa`, `app/web/src/pages/Monitoreo.tsx:616-634` | Tarjetas + detalle de cuadrillas |
| Gestión semanal | `BloqueGestionSemanal`, `app/web/src/pages/Monitoreo.tsx:636-678` | Curva de asignados/cerrados/gestionados + detalle diario |
| Reparación | `BloqueReparacion`, `app/web/src/pages/Monitoreo.tsx:680-709` | Gráfico de torta con centro = total |
| Construcción | `BloqueConstruccion`, `app/web/src/pages/Monitoreo.tsx:711-752` | Tarjetas + barras |
| Cuadrilla | `BloqueCuadrilla`, `app/web/src/pages/Monitoreo.tsx:754-786` | Barras agrupadas + totales por cuadrilla |
| **Identificador de pago (D-94)** | `BloqueIdentificadorPago`, `app/web/src/pages/Monitoreo.tsx:799-877` | Zona «Identificador de pago (70\*)» (ver abajo) |

El resumen del reporte (`ResumenReporte`) muestra periodo y rango, y luego los bloques de
gestión diaria, casos globales, reparación, construcción y capacidad operativa
(`app/web/src/pages/Monitoreo.tsx:340-431`). Utilidades destacadas: `lunesDe` calcula el
lunes de la semana tratando el domingo como día 6 hacia atrás
(`app/web/src/pages/Monitoreo.tsx:74-80`), y `diaCorto` etiqueta la curva con el día
abreviado más el número (`app/web/src/pages/Monitoreo.tsx:82-86`, tabla `DIAS_CORTOS` en
`:47`).

### Zona «Identificador de pago (70\*)» (D-94)

`BloqueIdentificadorPago` (`app/web/src/pages/Monitoreo.tsx:799-877`) es la zona que pinta
el lado del identificador dentro de la pestaña MONITOREO. Solo se monta si el rol **no** es
`TECNICO` (`app/web/src/pages/Monitoreo.tsx:930-931`), coherente con el 403 del backend.

| Elemento | Origen | Referencia |
|---|---|---|
| Carga de los dos bloques | `api.monitoreoIdentificadores()` y `api.monitoreoReclasificaciones()` | `app/web/src/pages/Monitoreo.tsx:800-807` |
| Tarjetas: identificadores con casos, reincidentes (N días), casos con 70\*, casos sin 70\*, media de reportes, máximo de reportes | `identificadores` | `app/web/src/pages/Monitoreo.tsx:814-826` |
| Tabla «Identificadores con más reportes» (Identificador de pago (70\*) · Casos · En la ventana · Reincidente) | `identificadores.top` | `app/web/src/pages/Monitoreo.tsx:827-853` |
| Tarjetas de la regla: reparaciones válidas, casos REFERIDO, reclasificadas, marcadas sin regularizar | `reclasificaciones` | `app/web/src/pages/Monitoreo.tsx:859-872` |

El bloque se distingue por el ancla `#zona-identificador-pago`
(`app/web/src/pages/Monitoreo.tsx:809`), que usan las pruebas E2E
(`RepoTecnico/pruebas/e2e/tests/25-monitoreo-identificador.spec.js`).

### Componentes de gráficos

`app/web/src/components/graficos.tsx` implementa los gráficos **sin dependencias
externas**: su docstring indica explícitamente que no se usa recharts ni chart.js y que
todo se dibuja con SVG y las clases CSS de `styles.css`
(`app/web/src/components/graficos.tsx:1-7`). Esto contradice la previsión **D-38**, que
mencionaba Recharts (`RepoTecnico/estado_proyecto.md:102`); la realidad verificada es el
SVG propio.

| Componente | Uso | Referencia |
|---|---|---|
| `GraficoBarras` | Barras verticales con valor encima y etiqueta debajo | `app/web/src/components/graficos.tsx:91` |
| `GraficoBarrasAgrupadas` | Una serie por color dentro de cada grupo, con leyenda | `app/web/src/components/graficos.tsx:147` |
| `GraficoLineas` | Polilínea con un punto por observación y leyenda | `app/web/src/components/graficos.tsx:228` |
| `GraficoTorta` | Torta por `stroke-dasharray` sobre un círculo, con leyenda y porcentajes | `app/web/src/components/graficos.tsx:292` |

Constantes de dibujo: ancho lógico `ANCHO = 640`, margen superior 20 y margen inferior 60
(`app/web/src/components/graficos.tsx:10-12`). La paleta de series es
`['#0b4f9c', '#1f7a4d', '#8a6100', '#b3261e', '#5b21b6', '#0e7490']`
(`app/web/src/components/graficos.tsx:15`). Todos los gráficos muestran «Sin datos para
graficar.» cuando la entrada está vacía (`app/web/src/components/graficos.tsx:92,153-155,230-232,295-297`).

#### Accesibilidad y detalle

Cada `svg` se declara con `role="img"` (`app/web/src/components/graficos.tsx:102,166,248,306`).
Los puntos de la curva llevan un `<title>` con serie, etiqueta y valor
(`app/web/src/components/graficos.tsx:268-270`), igual que las porciones de la torta
(`app/web/src/components/graficos.tsx:324`). La torta rotula el total en el centro
(`app/web/src/components/graficos.tsx:329-334`).

## Pruebas

### Cobertura del ciclo 7

El archivo `app/tests/test_monitoreo_api.py` contiene **16 pruebas** de integración
(`RepoTecnico/pruebas/informe_fase4.md:76`) y cubre gestión diaria y semanal, globales,
capacidad y reportes. En la Fase 4 el proyecto cerró con **169/169** pruebas de `pytest`
en verde (`RepoTecnico/pruebas/informe_fase4.md:18,85,94`), y **215 pruebas** sumando las
46 E2E de Playwright (`RepoTecnico/pruebas/informe_fase4.md:103`).

| Prueba | Qué valida | Referencia |
|---|---|---|
| `test_gestion_diaria` | Ingresos, resueltos y pendientes del día | `app/tests/test_monitoreo_api.py:63-71` |
| `test_gestion_diaria_sin_datos` | Día sin registros devuelve ceros | `app/tests/test_monitoreo_api.py:74-81` |
| `test_globales` | Pendientes/resueltos/total y desgloses | `app/tests/test_monitoreo_api.py:84-91` |
| `test_reparacion_y_construccion` | Exclusividad de ambos conjuntos | `app/tests/test_monitoreo_api.py:94-104` |
| `test_capacidad_operativa` | Cuadrillas activas, detalle y marca de incompleta | `app/tests/test_monitoreo_api.py:107-117` |
| `test_gestion_semanal_devuelve_seis_dias` | Seis puntos lunes-sábado | `app/tests/test_monitoreo_api.py:120-125` |
| `test_monitoreo_por_cuadrilla` | Asignados y gestionados por cuadrilla | `app/tests/test_monitoreo_api.py:128-152` |
| `test_semanal_refleja_los_cierres` | Borde del domingo fuera de ventana | `app/tests/test_monitoreo_api.py:155-163` |
| `test_reporte_trabajo` | Los tres periodos y sus bloques | `app/tests/test_monitoreo_api.py:167-179` |
| `test_reporte_imprimible` | HTML con `size: letter` y secciones | `app/tests/test_monitoreo_api.py:182-189` |
| `test_periodo_invalido` | HTTP 422 con periodo inválido | `app/tests/test_monitoreo_api.py:192-197` |
| `test_sin_token` | HTTP 401 sin autenticación | `app/tests/test_monitoreo_api.py:200-201` |
| `test_tecnico_puede_consultar` | Lectura permitida al rol técnico | `app/tests/test_monitoreo_api.py:204-208` |
| `test_cita_cuenta_en_el_dia` | Una cita incrementa `citados` | `app/tests/test_monitoreo_api.py:211` |

Desde D-90/D-94 se suman dos suites específicas:

| Prueba | Qué valida | Referencia |
|---|---|---|
| `test_d90_clasificacion.py` | Marca derivada, idempotencia de la ficha del especial y cifras de `reclasificaciones` | `app/tests/test_d90_clasificacion.py:32` |
| `test_d94_identificador_monitoreo.py` | `identificadores()` (reportes, reincidentes, reparto con/sin 70\*), `hoy_operativo()` de Caracas, el informe imprimible con el identificador y el **403** al TÉCNICO | `app/tests/test_d94_identificador_monitoreo.py:59-62,104-155,163` |

### Aprendizajes de la Fase 4

El informe de Fase 4 documenta el defecto **F4-03**: `test_monitoreo_api.py` capturaba la
fecha al importar el módulo (`HOY = date.today()`), de modo que una corrida que cruzaba la
medianoche fallaba; se corrigió pasando a la función `hoy()` evaluada dentro de cada prueba
(`RepoTecnico/pruebas/informe_fase4.md:38`). El defecto **F4-06** fue una regresión de esa
misma corrección: una variable local `hoy` tapaba la función y producía
`TypeError: 'datetime.datetime' object is not callable`
(`RepoTecnico/pruebas/informe_fase4.md:41`). La prueba
`app/tests/test_monitoreo_api.py:15` conserva la función `hoy()` que explica ese diseño.

En E2E, el guion `08-monitoreo.spec.js` aportó 3 pruebas para zonas del tablero, gráficos
SVG y reporte de trabajo (`RepoTecnico/pruebas/informe_fase4.md:62`). Sobre D-90/D-94 se
añadieron `24-identificador-pago.spec.js` y `25-monitoreo-identificador.spec.js`
(`RepoTecnico/pruebas/e2e/tests/`).

## Pendiente de validación con CANTV

`RepoTecnico/metricas.md:130-135` enumera tres puntos abiertos que afectan directamente a
este módulo y que **no deben darse por cerrados**:

| # | Pregunta abierta | Referencia |
|---|---|---|
| 1 | ¿«Ingreso nuevo» debe contar por `creado_en` (entrada al sistema) o por `fecha_reporte` (fecha del reporte en el sistema origen)? | `RepoTecnico/metricas.md:132-133` |
| 2 | ¿La semana operativa es lunes–sábado o lunes–domingo? | `RepoTecnico/metricas.md:134` |
| 3 | Confirmar la aproximación de **Gestionado** mientras la app móvil no exista (Ciclo 8) | `RepoTecnico/metricas.md:135` |

Estado de cada punto en el código:

1. La implementación actual usa `creado_en` (`app/services/monitoreo.py:85`).
2. La implementación actual usa lunes–sábado con `DIAS_SEMANA = 6`
   (`app/services/monitoreo.py:26,29-32`).
3. La implementación actual aproxima «Gestionado» con `despacho_caso.estado='GESTIONADO'`
   (`app/services/monitoreo.py:154-160`). Nota: la app móvil del Ciclo 8 **ya existe**
   (`app_movil/`, D-82…D-93), pero la métrica no cambió de fuente; si CANTV quiere que
   «Gestionado» se lea de la actividad de campo, es un cambio pendiente de decidir.

Cualquier cambio en estas respuestas obligará a ajustar `app/services/monitoreo.py`, la
plantilla imprimible (`app/api/routes_monitoreo.py:244-309`) y las pruebas del ciclo
(`app/tests/test_monitoreo_api.py`).

Estado de los `pendiente de confirmar` de este manual tras D-94:

- **Zona horaria de cálculo:** **resuelta**. Ya no depende de la zona de la sesión de
  PostgreSQL: el día operativo está fijado en `app/services/tiempo.py:16` y la conversión se
  hace por columna con `_dia()` (`app/services/monitoreo.py:57-65`).
- **Nombre exacto del módulo de esquemas de monitoreo:** sigue **pendiente de confirmar**:
  no existe un `app/schemas/monitoreo.py`; las operaciones devuelven `dict` sin modelo
  Pydantic (`app/api/routes_monitoreo.py:63,76,90,103,114,127,140,151,163,184`).
