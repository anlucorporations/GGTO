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
| Router | `app/api/routes_monitoreo.py`, prefijo `/api/v1` | `app/api/routes_monitoreo.py:17` |
| Servicio | `app/services/monitoreo.py` | `app/services/monitoreo.py:1` |
| Página web | `app/web/src/pages/Monitoreo.tsx` | `app/web/src/pages/Monitoreo.tsx:1-8` |
| Gráficos | SVG propios en `app/web/src/components/graficos.tsx` | `app/web/src/components/graficos.tsx:1-7` |
| Montaje del router | `app.include_router(routes_monitoreo.router)` | `app/main.py:84` |

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
| API | `app/api/routes_monitoreo.py` | 9 operaciones HTTP, validación de parámetros y plantilla HTML imprimible |
| Servicio | `app/services/monitoreo.py` | Consultas SQLAlchemy y armado de cada indicador |
| Esquemas | No hay módulo Pydantic dedicado: las operaciones devuelven `dict` | Los `return` se anotan `-> dict` (`app/api/routes_monitoreo.py:33,44,56,67,76,87,98,112`) |
| Tipos del frontend | `app/web/src/api/types.ts` | Interfaces `MonitoreoDiario`…`ReporteTrabajo` importadas por la página (`app/web/src/pages/Monitoreo.tsx:12-23`) |
| Cliente web | `app/web/src/api/client.ts` | Funciones `monitoreoDiario`…`obtenerReporteTrabajoImprimible` (`app/web/src/api/client.ts:766-821`) |
| Página web | `app/web/src/pages/Monitoreo.tsx` | Tablero de solo lectura y formulario de reportes (`app/web/src/pages/Monitoreo.tsx:386`) |
| Gráficos | `app/web/src/components/graficos.tsx` | Barras, barras agrupadas, curva y torta en SVG |

El router no define dependencias de rol de escritura: todos sus endpoints exigen únicamente
un usuario autenticado (`app/api/routes_monitoreo.py:32,43,55,66,75,86,97,111,124`), de modo
que el módulo es de **solo lectura** para cualquier rol con sesión válida. Las pruebas de
acceso confirman que el rol `TECNICO` puede consultar las siete rutas de monitoreo y el
reporte (`app/tests/test_monitoreo_api.py:202-206`).

## Métricas

### Gestión diaria

La función `gestion_diaria` devuelve el bloque del día indicado
(`app/services/monitoreo.py:82-106`). El router la expone en `GET /api/v1/monitoreo/diario`
y, si no se envía `fecha`, usa `date.today()` (`app/api/routes_monitoreo.py:27-35`).

| Indicador | Fórmula implementada | Referencia |
|---|---|---|
| `ingresos_nuevos` | `count(caso)` con `creado_en::date = fecha` | `app/services/monitoreo.py:85` |
| `resueltos_residencial` | `caso_estado_hist` con `estado_nuevo='CERRADO'` y categoría `RESIDENCIAL` | `app/services/monitoreo.py:86` |
| `resueltos_empresarial` | idem con categoría en `('EMPRESA','GOBIERNO')` | `app/services/monitoreo.py:87-92` |
| `resueltos_referidos` | idem con categoría `REFERIDO` | `app/services/monitoreo.py:93` |
| `citados` | `count(distinct id_caso)` en `cita` del día | `app/services/monitoreo.py:94-97` |
| `diferidos` | casos que pasaron a `DIFERIDO` ese día | `app/services/monitoreo.py:98` |
| `gestionados` | `count(distinct id_caso)` en `despacho_caso` con estado `GESTIONADO` de despachos del día | `app/services/monitoreo.py:99-104` |
| `pendientes_total` | casos cuyo `estado_actual` no es `CERRADO` ni `CANCELADO` | `app/services/monitoreo.py:105` |

El criterio de «pendiente» se centraliza en `_pendientes` y en la tupla
`PENDIENTE_EXCLUIR = ("CERRADO", "CANCELADO")` (`app/services/monitoreo.py:24,75-76`).
La categoría empresarial agrupa `EMPRESA` y `GOBIERNO`
(`EMPRESARIAL = ("EMPRESA", "GOBIERNO")`, `app/services/monitoreo.py:25`). La prueba de
integración verifica el bloque con 5 ingresos, 1 resuelto residencial y 4 pendientes
(`app/tests/test_monitoreo_api.py:61-69`).

#### Nota sobre «gestionado»

`RepoTecnico/metricas.md` define «Gestionado» como el caso con al menos una gestión en
`actividad.fecha_hora` y aclara que, mientras no exista la app móvil (Ciclo 8), se aproxima
con `despacho_caso.estado='GESTIONADO'` (`RepoTecnico/metricas.md:22`). La implementación
real usa la aproximación por `despacho_caso` (`app/services/monitoreo.py:99-104`). La app
móvil Flutter **no existe** en la v1 y no debe documentarse como disponible.

### Gestión semanal (lunes → sábado)

`rango_semana` calcula el lunes a partir de `fecha.weekday()` y suma cinco días para
obtener el sábado (`app/services/monitoreo.py:29-32`), con la constante
`DIAS_SEMANA = 6` (`app/services/monitoreo.py:26`). `gestion_semanal` recorre los seis días
y arma la curva (`app/services/monitoreo.py:135-156`).

| Indicador por día | Cálculo | Referencia |
|---|---|---|
| `asignados` | `count(despacho_caso)` de despachos de ese día | `app/services/monitoreo.py:139-143` |
| `cerrados` | `_resueltos(..., dia, dia, None)` | `app/services/monitoreo.py:153` |
| `gestionados` | `despacho_caso.estado='GESTIONADO'` de ese día | `app/services/monitoreo.py:144-149` |

La respuesta devuelve `desde` (lunes) y `hasta` (sábado) junto a la lista `dias`
(`app/services/monitoreo.py:156`). La prueba `test_gestion_semanal_devuelve_seis_dias`
valida exactamente seis puntos y las cuatro claves de cada día
(`app/tests/test_monitoreo_api.py:118-123`). La prueba
`test_semanal_refleja_los_cierres` documenta el caso de borde del domingo: si hoy es
domingo el cierre queda fuera de la ventana (`app/tests/test_monitoreo_api.py:153-158`).

### Casos globales

`casos_globales` combina pendientes (a la fecha) con resueltos en el rango, y añade los
desgloses por estado y por categoría (`app/services/monitoreo.py:159-176`).

| Campo | Cálculo | Referencia |
|---|---|---|
| `pendientes` | `_pendientes` (excluye `CERRADO`/`CANCELADO`) | `app/services/monitoreo.py:160` |
| `resueltos` | `_resueltos` en el rango `desde..hasta` | `app/services/monitoreo.py:161` |
| `total` | `pendientes + resueltos` | `app/services/monitoreo.py:175` |
| `por_estado` | `group_by(Caso.estado_actual)` | `app/services/monitoreo.py:162-167` |
| `por_categoria` | `group_by(Caso.categoria)` | `app/services/monitoreo.py:168-173` |

En el router, el rango por defecto es del día 1 del mes en curso hasta hoy
(`hoy.replace(day=1)` y `hoy`, `app/api/routes_monitoreo.py:58-59`).

### Reparación

`reparacion` cuenta pendientes con `tipo_caso != 'CONSTRUCCION'` separados por categoría
(`app/services/monitoreo.py:179-187`):

| Campo | Fórmula | Referencia |
|---|---|---|
| `residenciales_comunes` | pendiente, `categoria='RESIDENCIAL'`, `tipo_caso != 'CONSTRUCCION'` | `app/services/monitoreo.py:180-181` |
| `residenciales_referidos` | pendiente, `categoria='REFERIDO'`, `tipo_caso != 'CONSTRUCCION'` | `app/services/monitoreo.py:182-183` |
| `empresariales` | pendiente, categoría en `EMPRESA`/`GOBIERNO`, `tipo_caso != 'CONSTRUCCION'` | `app/services/monitoreo.py:184-185` |
| `total` | suma de los tres | `app/services/monitoreo.py:186-187` |

### Construcción

`construccion` cuenta pendientes con `tipo_caso == 'CONSTRUCCION'`
(`app/services/monitoreo.py:190-196`):

| Campo | Fórmula | Referencia |
|---|---|---|
| `residenciales` | pendiente, `tipo_caso='CONSTRUCCION'`, `categoria='RESIDENCIAL'` | `app/services/monitoreo.py:191-192` |
| `empresariales` | pendiente, `tipo_caso='CONSTRUCCION'`, categoría `EMPRESA`/`GOBIERNO` | `app/services/monitoreo.py:193-194` |
| `total` | suma | `app/services/monitoreo.py:195-196` |

La prueba `test_reparacion_y_construccion` verifica que un caso `EMPRESA` +
`CONSTRUCCION` no se cuenta en reparación y sí en construcción (total 1)
(`app/tests/test_monitoreo_api.py:92-102`).

### Cuadrilla

`por_cuadrilla` recorre las cuadrillas de calle (`es_supervisor = false`) ordenadas por
código (`app/services/monitoreo.py:200-203`) y calcula, por día y por cuadrilla,
`asignados`, `cerrados` y `gestionados` con `_por_dia_cuadrilla`
(`app/services/monitoreo.py:109-132`), acumulando los totales
(`app/services/monitoreo.py:207-215`). La respuesta incluye `desde` y `dias`
(`app/services/monitoreo.py:216`).

#### Cálculo de «cerrados» por cuadrilla

`cerrados` une `caso_estado_hist` con `caso`, `despacho_caso` y `despacho`, y exige que el
despacho sea de esa cuadrilla y ese día y que el historial tenga `estado_nuevo='CERRADO'`
con fecha del mismo día (`app/services/monitoreo.py:122-130`). La prueba
`test_monitoreo_por_cuadrilla` genera el despacho del lunes, marca un caso como
`GESTIONADO` y comprueba 4 asignados y 1 gestionado (`app/tests/test_monitoreo_api.py:126-150`).

### Capacidad operativa

`capacidad` lista las cuadrillas activas ordenadas por código
(`app/services/monitoreo.py:220-223`) y arma el detalle por cuadrilla: integrantes vigentes
(`cuadrilla_tecnico.hasta IS NULL`, `app/services/monitoreo.py:226-229`), flota asociada
formateada como `can (status)` (`app/services/monitoreo.py:230-234`) y la marca `completa`
(`app/services/monitoreo.py:235`).

| Campo agregado | Cálculo | Referencia |
|---|---|---|
| `cuadrillas_activas` | cuadrillas del detalle que no son de supervisor | `app/services/monitoreo.py:238` |
| `tecnicos_activos` | técnicos de la central con `status='ACTIVO'` | `app/services/monitoreo.py:240-243` |
| `flota_disponible` | flota de la central con `status='DISPONIBLE'` | `app/services/monitoreo.py:244-247` |
| `herramientas_disponibles` | herramienta con `estado='DISPONIBLE'` | `app/services/monitoreo.py:248-251` |
| `sectores_activos` | sectores de la central con `activo = true` | `app/services/monitoreo.py:252-255` |

La prueba `test_capacidad_operativa` confirma 2 cuadrillas activas, 3 en el detalle
(incluye la cuadrilla 0 del supervisor) y que, sin integrantes ni flota, las cuadrillas de
calle quedan marcadas como incompletas (`app/tests/test_monitoreo_api.py:105-112`).

## Endpoints

### Superficie de la API

El router se declara con `prefix="/api/v1"` y la etiqueta OpenAPI
`"monitoreo y reportes"` (`app/api/routes_monitoreo.py:17`). Expone **9 operaciones**:

| Método y ruta | Propósito | Línea |
|---|---|---|
| `GET /api/v1/monitoreo/diario` | Gestión diaria | `app/api/routes_monitoreo.py:27` |
| `GET /api/v1/monitoreo/semanal` | Gestión semanal (curva lunes a sábado) | `app/api/routes_monitoreo.py:38` |
| `GET /api/v1/monitoreo/globales` | Casos globales: pendientes vs resueltos | `app/api/routes_monitoreo.py:49` |
| `GET /api/v1/monitoreo/reparacion` | Pendientes de reparación por tipo | `app/api/routes_monitoreo.py:62` |
| `GET /api/v1/monitoreo/construccion` | Pendientes de construcción por tipo | `app/api/routes_monitoreo.py:71` |
| `GET /api/v1/monitoreo/cuadrilla` | Asignados vs cerrados vs gestionados por cuadrilla | `app/api/routes_monitoreo.py:80` |
| `GET /api/v1/monitoreo/capacidad` | Capacidad operativa | `app/api/routes_monitoreo.py:93` |
| `GET /api/v1/reportes/trabajo` | Reporte de trabajo (diario/semanal/mensual) | `app/api/routes_monitoreo.py:105` |
| `GET /api/v1/reportes/trabajo/imprimible` | Reporte de trabajo imprimible (HTML) | `app/api/routes_monitoreo.py:117` |

### Parámetros y resolución de la central

Todos los endpoints aceptan `id_central` opcional y lo resuelven con
`resolver_central(db, id_central, cargar_config(db))` a través del auxiliar `_central`
(`app/api/routes_monitoreo.py:20-21`). La sesión de base de datos se inyecta con
`Depends(get_db)` y el usuario con `Depends(get_current_user)`
(`app/api/routes_monitoreo.py:31-32`).

| Endpoint | Parámetros propios | Validación |
|---|---|---|
| `/monitoreo/diario` | `fecha` (date), `id_central` | `fecha` por defecto `date.today()` (`:29,35`) |
| `/monitoreo/semanal` | `desde` (date), `id_central` | `desde` por defecto `date.today()` (`:40,46`) |
| `/monitoreo/globales` | `desde`, `hasta`, `id_central` | por defecto día 1 del mes → hoy (`:51-53,58-59`) |
| `/monitoreo/reparacion` | `id_central` | — (`:64`) |
| `/monitoreo/construccion` | `id_central` | — (`:73`) |
| `/monitoreo/cuadrilla` | `desde`, `dias`, `id_central` | `dias` entre 1 y 31, por defecto 6 (`:82-83`) |
| `/monitoreo/capacidad` | `id_central` | — (`:95`) |
| `/reportes/trabajo` | `periodo`, `fecha`, `id_central` | patrón `^(diario|semanal|mensual)$` (`:107`) |
| `/reportes/trabajo/imprimible` | `periodo`, `fecha`, `id_central` | igual patrón (`:120`) |

El parámetro `dias` de `/monitoreo/cuadrilla` se usa para construir el rango con
`_dias(desde, dias)` (`app/services/monitoreo.py:199,206`); en la página web siempre se
solicita con 6 días (`app/web/src/pages/Monitoreo.tsx:420`, `app/web/src/api/client.ts:791-796`).

#### Cliente web

`app/web/src/api/client.ts` implementa una función por endpoint
(`monitoreoDiario`…`monitoreoCapacidad`, `reporteTrabajo`,
`obtenerReporteTrabajoImprimible`; `app/web/src/api/client.ts:766-821`). El comentario
explica que el reporte imprimible se pide con `Bearer` y se abre en una pestaña nueva,
porque la URL directa no puede llevar la cabecera de autorización
(`app/web/src/api/client.ts:811-815`).

## Reporte de trabajo

### GET /api/v1/reportes/trabajo

`reporte_trabajo` calcula el rango según el periodo y compone un objeto con siete bloques
(`app/services/monitoreo.py:262-276`): `periodo`, `desde`, `hasta`, `diario`, `semanal`,
`globales`, `reparacion`, `construccion`, `cuadrilla` y `capacidad`.

| Periodo | Rango | Referencia |
|---|---|---|
| `diario` | el día indicado | `app/services/monitoreo.py:42` |
| `semanal` | lunes a sábado de la semana del día indicado | `app/services/monitoreo.py:36-37` |
| `mensual` | del día 1 al último día del mes | `app/services/monitoreo.py:38-41` |

La implementación del rango mensual calcula el primer día del mes siguiente sumando 32
días y reemplazando el día por 1, y luego resta un día (`app/services/monitoreo.py:39-41`).
El bloque semanal se calcula siempre desde el lunes de la fecha, aunque el periodo sea
diario o mensual (`app/services/monitoreo.py:264,270`). El router devuelve el JSON y valida
el `periodo` con un patrón que produce HTTP 422 si es inválido
(`app/api/routes_monitoreo.py:107`; prueba `app/tests/test_monitoreo_api.py:190-192`).

La prueba parametrizada `test_reporte_trabajo` recorre los tres periodos y comprueba la
presencia de las siete claves, que el mensual empieza en `-01` y que el semanal trae seis
días (`app/tests/test_monitoreo_api.py:164-177`).

### Versión imprimible

`reporte_imprimible` está declarado con `response_class=HTMLResponse`
(`app/api/routes_monitoreo.py:117`). Vuelve a invocar `svc.reporte_trabajo` y desempaqueta
los bloques diario, globales, reparación y construcción
(`app/api/routes_monitoreo.py:127-128`). Con esos datos construye filas HTML para el
detalle diario, la semana, las cuadrillas y los pendientes por estado
(`app/api/routes_monitoreo.py:130-148`), y renderiza un documento completo con
`@page { size: letter; margin: 1cm; }` y estilos de impresión
(`app/api/routes_monitoreo.py:150-198`).

| Elemento del HTML | Origen | Referencia |
|---|---|---|
| Tarjetas: pendientes, resueltos, reparación, construcción, cuadrillas activas | `globales`, `reparacion`, `construccion`, `capacidad` | `app/api/routes_monitoreo.py:174-180` |
| Tabla «Gestión del día» | `diario` | `app/api/routes_monitoreo.py:182-183` |
| Tabla «Gestión semanal (lunes a sábado)» | `semanal.dias` | `app/api/routes_monitoreo.py:185-187` |
| Tabla «Producción por cuadrilla (semana)» | `cuadrilla.cuadrillas` | `app/api/routes_monitoreo.py:189-191` |
| Tabla «Pendientes por estado» | `globales.por_estado` | `app/api/routes_monitoreo.py:193-195` |
| Botón «Imprimir» con `window.print()` | solo pantalla (`.no-print`) | `app/api/routes_monitoreo.py:165,197` |

La prueba `test_reporte_imprimible` verifica `content-type: text/html`, la cadena
`size: letter`, «Reporte de trabajo» y «Gestión semanal»
(`app/tests/test_monitoreo_api.py:180-187`). En la interfaz, el botón «Imprimir / PDF»
obtiene el HTML y lo escribe en una ventana nueva
(`app/web/src/pages/Monitoreo.tsx:465-484,564-571`). Si el navegador bloquea la ventana
emergente se muestra un aviso explícito (`app/web/src/pages/Monitoreo.tsx:472-475`).

## Reglas de cálculo

### Reparación y construcción excluyentes

Reparación y construcción son conjuntos disjuntos: reparación exige
`tipo_caso != 'CONSTRUCCION'` y construcción exige `tipo_caso == 'CONSTRUCCION'`
(`app/services/monitoreo.py:181,183,185,191,193`). La regla está documentada en
`RepoTecnico/metricas.md:66-67` y confirmada por la prueba
`test_reparacion_y_construccion` (`app/tests/test_monitoreo_api.py:92-102`). Un caso no
puede aparecer en ambos totales.

### Redondeo y zona horaria America/Caracas

`RepoTecnico/metricas.md:123-130` fija las reglas transversales:

| Regla | Texto normativo | Referencia |
|---|---|---|
| Redondeo | Todos los conteos son enteros; no hay promedios en v1 | `RepoTecnico/metricas.md:125` |
| Zona horaria | Las fechas se interpretan en `America/Caracas`; el frontend muestra `dd/mm/aaaa` | `RepoTecnico/metricas.md:126` |
| Tipos | `despacho.fecha` es `date`; `caso.creado_en` y `caso_estado_hist.fecha_hora` son `timestamptz` y se truncan a día con `::date` | `RepoTecnico/metricas.md:127-128` |

La implementación aplica el truncado a día mediante `func.date(...)` en las comparaciones
(`app/services/monitoreo.py:57,71,85,91,95,129`) y nunca calcula promedios: todos los
indicadores son `count` o sumas de conteos (`app/services/monitoreo.py:49-50,187,196,211-213`).
El único porcentaje existe en la presentación de la torta, calculado en el navegador con
`Math.round((p.valor / total) * 100)` (`app/web/src/components/graficos.tsx:343`), no en
el backend.

#### Matiz verificado sobre la zona horaria

`metricas.md` afirma que el cálculo se hace en hora de Venezuela y que el truncado es «en
la zona del servidor» (`RepoTecnico/metricas.md:126-128`). El código aplica `func.date(...)`
sobre columnas `timestamptz`, lo que resuelve en la zona horaria configurada en la sesión
de PostgreSQL. La fijación explícita de esa zona a `America/Caracas` a nivel de conexión
**pendiente de confirmar** en `app/core/db.py`.

## Página web MONITOREO y gráficos SVG propios

### Estructura de la página

La página `Monitoreo` es un tablero de solo lectura
(`app/web/src/pages/Monitoreo.tsx:386`). Al montarse consulta en paralelo, con
`Promise.allSettled`, los siete endpoints de monitoreo
(`app/web/src/pages/Monitoreo.tsx:410-437`). Un fallo parcial no anula el resto: cada
bloque se guarda solo si su promesa se cumplió (`app/web/src/pages/Monitoreo.tsx:424-430`)
y se reporta el primer rechazo como error (`app/web/src/pages/Monitoreo.tsx:432-435`).

| Zona de la interfaz | Contenido | Referencia |
|---|---|---|
| Parámetros de consulta | Fecha (diario y semana) y rango de globales | `app/web/src/pages/Monitoreo.tsx:501-540` |
| Reportes | Selector de periodo, «Ver reporte» y «Imprimir / PDF» | `app/web/src/pages/Monitoreo.tsx:543-581` |
| Zona gestión diaria | Tarjetas + gráfico de barras | `app/web/src/pages/Monitoreo.tsx:585-596` |
| Zona casos globales | Tarjetas, barras pendientes/resueltos y tablas por estado y categoría | `app/web/src/pages/Monitoreo.tsx:598-629` |
| Zona gestión semanal | Curva de asignados/cerrados/gestionados + detalle diario | `app/web/src/pages/Monitoreo.tsx:633-663` |
| Zona reparación | Gráfico de torta con centro = total | `app/web/src/pages/Monitoreo.tsx:667-689` |
| Zona construcción | Tarjetas + barras | `app/web/src/pages/Monitoreo.tsx:691-722` |
| Zona cuadrilla | Barras agrupadas + totales por cuadrilla | `app/web/src/pages/Monitoreo.tsx:726-747` |
| Zona capacidad operativa | Tarjetas + detalle de cuadrillas | `app/web/src/pages/Monitoreo.tsx:750-761` |

El resumen del reporte (`ResumenReporte`) muestra periodo y rango, y luego los bloques de
gestión diaria, casos globales, reparación, construcción y capacidad operativa
(`app/web/src/pages/Monitoreo.tsx:294-380`). Utilidades destacadas: `lunesDe` calcula el
lunes de la semana tratando el domingo como día 6 hacia atrás
(`app/web/src/pages/Monitoreo.tsx:62-68`), y `diaCorto` etiqueta la curva con el día
abreviado más el número (`app/web/src/pages/Monitoreo.tsx:70-74,35`).

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
| `test_gestion_diaria` | Ingresos, resueltos y pendientes del día | `app/tests/test_monitoreo_api.py:61-69` |
| `test_gestion_diaria_sin_datos` | Día sin registros devuelve ceros | `app/tests/test_monitoreo_api.py:72-76` |
| `test_globales` | Pendientes/resueltos/total y desgloses | `app/tests/test_monitoreo_api.py:82-89` |
| `test_reparacion_y_construccion` | Exclusividad de ambos conjuntos | `app/tests/test_monitoreo_api.py:92-102` |
| `test_capacidad_operativa` | Cuadrillas activas, detalle y marca de incompleta | `app/tests/test_monitoreo_api.py:105-112` |
| `test_gestion_semanal_devuelve_seis_dias` | Seis puntos lunes-sábado | `app/tests/test_monitoreo_api.py:118-123` |
| `test_monitoreo_por_cuadrilla` | Asignados y gestionados por cuadrilla | `app/tests/test_monitoreo_api.py:126-150` |
| `test_semanal_refleja_los_cierres` | Borde del domingo fuera de ventana | `app/tests/test_monitoreo_api.py:153-158` |
| `test_reporte_trabajo` | Los tres periodos y sus siete bloques | `app/tests/test_monitoreo_api.py:164-177` |
| `test_reporte_imprimible` | HTML con `size: letter` y secciones | `app/tests/test_monitoreo_api.py:180-187` |
| `test_periodo_invalido` | HTTP 422 con periodo inválido | `app/tests/test_monitoreo_api.py:190-192` |
| `test_sin_token` | HTTP 401 sin autenticación | `app/tests/test_monitoreo_api.py:198-199` |
| `test_tecnico_puede_consultar` | Lectura permitida al rol técnico | `app/tests/test_monitoreo_api.py:202-206` |
| `test_cita_cuenta_en_el_dia` | Una cita incrementa `citados` | `app/tests/test_monitoreo_api.py:209-216` |

### Aprendizajes de la Fase 4

El informe de Fase 4 documenta el defecto **F4-03**: `test_monitoreo_api.py` capturaba la
fecha al importar el módulo (`HOY = date.today()`), de modo que una corrida que cruzaba la
medianoche fallaba; se corrigió pasando a la función `hoy()` evaluada dentro de cada prueba
(`RepoTecnico/pruebas/informe_fase4.md:38`). El defecto **F4-06** fue una regresión de esa
misma corrección: una variable local `hoy` tapaba la función y producía
`TypeError: 'datetime.datetime' object is not callable`
(`RepoTecnico/pruebas/informe_fase4.md:41`). La prueba
`app/tests/test_monitoreo_api.py:13-20` conserva el docstring que explica ese diseño.

En E2E, el guion `08-monitoreo.spec.js` aportó 3 pruebas para zonas del tablero, gráficos
SVG y reporte de trabajo (`RepoTecnico/pruebas/informe_fase4.md:62`).

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
   (`app/services/monitoreo.py:99-104`).

Cualquier cambio en estas respuestas obligará a ajustar `app/services/monitoreo.py`, la
plantilla imprimible (`app/api/routes_monitoreo.py:150-198`) y las pruebas del ciclo
(`app/tests/test_monitoreo_api.py`). Adicionalmente, la fijación explícita de la zona
horaria de cálculo y el nombre exacto del módulo de esquemas de monitoreo quedan como
**pendiente de confirmar**.
