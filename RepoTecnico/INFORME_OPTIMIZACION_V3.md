# INFORME DE OPTIMIZACIÓN V3 — Auditoría del proceso de SINCRONIZACIÓN APK↔web

| | |
|---|---|
| **Proyecto** | GGTO — Gestión de Órdenes de Trabajo y Despacho (CANTV, Central Francisco Salias / Área 4) |
| **Alcance** | **Proceso de sincronización APK↔web**: descarga del despacho a la APK, carga del trabajo gestionado, cierre de casos especiales (referidos), cola offline, evidencias, purga local y observabilidad de la sincronización |
| **Fecha** | **2026-10-19** |
| **Autor** | **Equipo de Auditoría — 7 lentes + verificación adversarial** |
| **Versión del informe** | **V3** |
| **Estado auditado** | Backend desplegado **v51** (`HEAD eda4218`) · APK en producción **1.14.1+24** · árbol de trabajo con **D-120 sin commitear** |
| **Método** | 3 fases: 7 revisores en paralelo → 7 verificadores adversariales → síntesis (este informe) |
| **Naturaleza** | Auditoría de solo lectura. Solo el sintetizador escribió este archivo |

> **Aviso de lectura.** Este informe consolida **únicamente hallazgos verificados** por la Fase 2 adversarial. Cuando una lente desmintió un hallazgo de su revisor, se consigna el descarte en §10 y no se arrastra al cuerpo. Cuando una dimensión no aportó hallazgos (R1), se dice expresamente. Las afirmaciones que dependen de datos de producción no disponibles en el alcance se marcan **«necesita verificación»** y no se convierten en hallazgo.
>
> **Aviso de línea base.** El árbol de trabajo contiene un incremento **D-120 sin commitear** (sincronización de `CasoEspecial.estado`, `estado_especial_visible`, botón «Cerrar el caso» en la pantalla Especiales de la APK y `test_d120_especiales_estado.py`) aplicado minutos antes de la lectura. **No está en v51 ni en la APK 1.14.1+24.** Las referencias de línea corresponden al árbol leído; el estado desplegado se indica explícitamente donde difiere. **Revalidar tras desplegar D-120.**

---

## 1. Resumen ejecutivo y veredicto

**VEREDICTO GLOBAL: NO APTO para dar por cerrado el proceso de sincronización APK↔web en su estado desplegado (v51 + APK 1.14.1+24).** La descarga funciona; la carga transmite el trabajo pero **no con integridad garantizada** (duplica); y el **cierre de especiales desde la APK no está garantizado hoy**.

### 1.1 Las tres preguntas del usuario

| # | Pregunta | Veredicto | Sustento verificado |
|---|---|---|---|
| **(a)** | ¿La APK descarga los casos asignados a la cuadrilla? | **SÍ, en el camino normal, con 5 salvedades** | `GET /sync/descarga` resuelve la cuadrilla (`app/services/sync.py:461-490`), incluye el despacho en **BORRADOR** (D-119) y **no filtra por fecha**; D-119 conserva `ids_del_dia` + `ids_vigentes` + `ids_descargados` en la purga (`app_movil/lib/features/sync/purga_despachos.dart:59-86`, `download_service.dart:121-186`). Salvedades: **H-04** (el REF de un especial no se despacha al crearse), **H-09** (la descarga pisa el estado optimista local), **H-10** (`ids_conocidos` en la URL crece sin límite), **H-14** (`date.today()` UTC vs `hoy_operativo()` Caracas), **H-23** (salvaguarda de C-00 inerte con casos). |
| **(b)** | ¿Se cargan los casos gestionados por el usuario? | **SÍ se transmiten, pero NO con integridad garantizada** | `POST /sync/carga` acepta CERRADO/CITADO/ENRUTADO/DIFERIDO/CONTACTADO, evidencias y sesiones (`app/services/sync.py:627-709`). Pero: **no es idempotente** (H-01), **no aplica las reglas del servidor** (H-03), **RBAC fail-open** (H-02), **dos emisores compiten por la cola** (H-07), **un caso reasignado se rechaza para siempre** (H-06) y **DIFERIDO_EVIDENCIAS acaba en ERROR** (H-08). |
| **(c)** | ¿Se pueden cerrar los casos especiales (referidos) desde la APK? | **NO de forma fiable hoy** | En v51 el cierre del caso **no** mueve `CasoEspecial.estado` y la APK 1.14.1 no ofrece cierre del especial (el TÉCNICO no ve la pestaña; el COORDINADOR no puede editar): **H-05**. Además, el REF **puede no haber llegado nunca** a la APK (H-04), el cierre administrativo por PATCH se salta toda regla (**H-17**) y `requiere_informe` no se exige en ninguna capa (**H-16**). |

### 1.2 ¿Es apto para operar hoy?

**Parcialmente.** El objetivo «descargar lo de mi cuadrilla» se cumple en el camino normal. El objetivo «cargar lo que gestioné» se cumple con **duplicación sistemática** y acciones que quedan atascadas. El objetivo **«cerrar los especiales desde la APK» no está garantizado** en el estado desplegado. Por tanto:

- Es **apto con reservas** para operación de campo en tanto no se dependa del cierre de referidos ni de la trazabilidad exacta de la productividad.
- **No es apto** para declarar cerrada la funcionalidad de cierre de especiales ni para auditoría de productividad, porque la bitácora y los conteos se duplican y el especial puede quedar ABIERTO en la ficha y en MONITOREO.

**Condiciones mínimas para pasar a apto (orden de §9):** H-01 (idempotencia + reintento por ítem), H-02 (cerrar el fail-open de RBAC), H-03 (delegar la carga en las reglas del servidor), H-04 (despachar el especial al crearse), H-05 (propagar el cierre del especial de forma única y desplegar D-120 completo) y H-06/H-07 (un solo dueño de la cola y criterio único de pertenencia).

---

## 2. Metodología

Tres fases con separación estricta de roles. Ningún revisor ni verificador modificó archivos; solo el sintetizador escribió este informe.

### Fase 1 — Revisar (7 lentes en paralelo)

| # | Lente | Qué buscó en la sincronización |
|---|---|---|
| R1 | **Ambigüedad y testabilidad** | Criterios de sincronización vagos o no verificables; cobertura real de las pruebas de purga y de contrato |
| R2 | **Consistencia** | Contradicciones código ↔ DDL ↔ APK ↔ despliegue; estados, versiones y reglas duplicadas |
| R3 | **Completitud RNF (ISO 25010)** | Fiabilidad, eficiencia, observabilidad, seguridad, mantenibilidad y accesibilidad del canal APK↔web |
| R4 | **Stakeholders** | Roles de la sincronización: técnico, coordinador, supervisor, admin, cuadrilla de gestión |
| R5 | **Trazabilidad con el brief** | Cobertura de «descargar lo de mi cuadrilla», «cargar lo que gestioné» y «cerrar especiales» |
| R6 | **Riesgos técnicos** | Idempotencia, concurrencia, relojes, pérdida/duplicación, reasignación, evidencias |
| R7 | **Seguridad y legal** | RBAC de campo, fail-open, IDOR, PII en el dispositivo, auditoría de la sincronización |

### Fase 2 — Verificar (7 verificadores adversariales, uno por lente)

Cada verificador recibió **solo** los hallazgos de su dimensión y los contrastó contra el árbol real (lectura de archivos y `grep`, sin modificar nada). Mandato: **filtrar falsos positivos, deduplicar, ajustar severidades con justificación y, ante la duda, descartar**.

| Dimensión | Recibidos | Descartados (§10) | Supervivientes |
|---|---:|---:|---:|
| R1 Ambigüedad y testabilidad | 12 | 0 | **0** (lista entregada vacía; verificada la base de pruebas) |
| R2 Consistencia | 12 | 2 | 2 |
| R3 Completitud RNF | 12 | 2 | 10 |
| R4 Stakeholders | 12 | 3 | 9 |
| R5 Trazabilidad | 12 | 2 | 10 |
| R6 Riesgos técnicos | 12 | 3 | 9 |
| R7 Seguridad y legal | 12 | 3 | 9 |
| **Total** | **84** | **15** | **49 aportaciones** |

### Fase 3 — Sintetizar (este informe)

Deduplicación entre lentes → **25 hallazgos únicos** (H-01…H-25), ordenados por severidad. Criterios de deduplicación aplicados: misma causa raíz con distinto síntoma → un hallazgo; misma causa y mismo síntoma en dos lentes → se conserva la evidencia más fuerte y se anotan los orígenes.

### 2.1 Correcciones y divergencias que el sintetizador debe resolver (y resuelve)

Las lentes discreparon en cuatro puntos. La síntesis toma esta posición:

1. **D-120 (sin commitear) y el cierre del especial.** R7 y R4 descartan el hallazgo porque el árbol lo corrige; **R2 lo mantiene vivo porque v51 y la APK 1.14.1+24 no lo incluyen**. *Posición del informe:* el defecto **existe en producción** (es el estado que el usuario reporta) → **H-05 se mantiene como ALTA**, con la nota de que D-120 lo mitiga parcialmente en el árbol y **no cubre `/sync/carga` ni los filtros que leen la columna cruda**.
2. **Severidad del REF no despachado.** R3 lo califica CRÍTICA; R5 lo baja a ALTA; R6 sostiene que el reparto por sector lo incorpora. *Posición:* el hecho verificado e indiscutido es que **el alta no crea `DespachoCasos`**; el reparto posterior puede incorporarlo, pero no el mismo día si la jornada ya se procesó y **nunca** si no sectoriza. Se fija **ALTA** (H-04), no CRÍTICA, porque falta confirmación con datos de los REF concretos del reporte.
3. **R1 entregó `{"findings":[]}`.** El verificador comprobó que la zona existe y que los criterios clave están cubiertos por pruebas con nombre propio (`d104_purga_despachos_test.dart:19-161`, `d115_actualizacion_unica_test.dart:64-139`, `app/tests/test_sync_api.py:678-867`) y **aceptó el vacío**. R1 advierte expresamente que **el fallo funcional del cierre de especiales quedaba fuera de su lente** y debía verificarlo otro revisor; lo hicieron R2, R5, R6 y R7. **R1 no aporta hallazgos a este informe.**
4. **La purga que conserva casos antiguos no es un defecto.** Dos lentes la reportaron y las dos la descartaron: es el **trade-off explícito de D-119** (que la descarga no borre el despacho) y la evidencia de apoyo era falsa (la rama sin `idsVigentes` sí es alcanzable con `SIN_DESPACHO`). Ver §10.

---

## 3. Estado de calidad medido

### 3.1 Calidad declarada y verificada

| Indicador | Valor | Fuente / ruta |
|---|---|---|
| Suite backend | **426/426 en verde** | `app/tests/` (informes de verificación) |
| Suite APK | **212/212 en verde** | `app_movil/test/` |
| Análisis estático APK | **`flutter analyze` limpio** | `app_movil/` |
| Purga D-119 aplicada | **Sí** | `app_movil/lib/features/sync/purga_despachos.dart:59-86` · `download_service.dart:180-187` |
| Backend desplegado | **v51** (`HEAD eda4218`) | según reporte de despliegue |
| APK en producción | **1.14.1+24** | el árbol declara `1.15.0+25` en `app_movil/lib/core/constants.dart:15` (no desplegado) |

> **Lectura crítica del indicador verde.** Las suites **no cubren** las tres preguntas del usuario: no hay prueba de idempotencia de `/sync/carga`, no hay prueba «especial → `/sync/descarga` → el REF aparece», y no hay prueba de cierre de especial por `/sync/carga` (solo por la ruta directa, y solo en el D-120 no desplegado). **El verde acredita lo que las pruebas ejercen, no el proceso completo.**

### 3.2 Métricas de sincronización disponibles y su ruta

| Métrica | Qué mide | Dónde vive / ruta |
|---|---|---|
| Sesiones de sincronización | Contadores (recibidos/procesados/errores), estado y motivo por sesión | `sync_log` · monitor en `app/services/sincronizacion.py:42-59` |
| Checklist de la sesión | Pasos de la actualización (carga, descarga, purga) | `GET /sync/checklist` (`app/api/routes_sync.py:208-224`) |
| Cierre de sesión | Contadores y estado que envía la APK | `PATCH /sync/sesion/{id}` (`app/api/routes_sync.py:193-205`) · `app/services/sync.py:845-874` |
| Purga y reaper de sesiones colgadas | Retención de 90 días | `app/services/purga.py:36-57` |
| Motivo de descarga y casos de cuadrilla | Solo en la respuesta HTTP; **no persistido** | `app_movil/lib/features/sync/download_service.dart:204-213` · `app/services/sync.py:461-490` |
| Rechazos por ítem en la carga | Se aplanan a texto y solo sobrevive el primero | `app_movil/lib/features/sync/upload_service.dart:238-287` |
| Estado de la cola local | Pendientes / reintento / error por acción | `accion_pendiente` (`app_movil/lib/core/database.dart:507-544`) |
| Idempotencia de la carga | **0 casos de prueba** | `app/tests/test_sync_api.py` (37 pruebas) |
| Especial → descarga | **0 casos de prueba** | `app/tests/test_sync_api.py` |
| Cierre de especial por `/sync/carga` | **0 casos de prueba** | `app/tests/test_d120_especiales_estado.py` (solo ruta directa, sin commitear) |

**Ninguna de estas métricas mide hoy «cuántos casos descargó y por qué no bajó ninguno»**, que es la pregunta operativa que el supervisor necesita responder (H-19).

---

## 4. Tabla de hallazgos por severidad

**25 hallazgos únicos: 3 CRÍTICA · 10 ALTA · 12 MEDIA · 0 BAJA.**

| ID | Severidad | Área | Título | Archivo:línea (evidencia principal) |
|---|---|---|---|---|
| **H-01** | CRÍTICA | Sincronización · idempotencia y contrato | `/sync/carga` sin clave de idempotencia; la APK reintenta el lote completo: duplica actividades/cierres y un ítem inválido bloquea la cola en bucle perpetuo | `app/services/sync.py:644-658` · `app_movil/lib/features/sync/upload_service.dart:238-265` |
| **H-02** | CRÍTICA | Sincronización · RBAC de campo | Fail-open: un TÉCNICO sin cuadrilla vigente escribe en **cualquier** caso por `/sync/carga`; el endpoint no exige rol | `app/services/sync.py:603-625` · `app/api/routes_sync.py:158-166` |
| **H-03** | CRÍTICA | Sincronización · reglas de estado y cierre | La carga cierra y reabre casos sin las reglas del servidor (reabre CERRADO, cierra sin modo/actividad, sin clasificación D-90, sin `Seguimiento` en enrutado) | `app/services/sync.py:687-709` · `app/services/sync.py:745-763` |
| **H-04** | ALTA | Especiales · descarga | El caso REF-… del especial no se despacha al crearse: solo llega a la APK si la jornada posterior lo reparte o un supervisor lo asigna a mano (y si no sectoriza, nunca) | `app/api/routes_especiales.py:188-213` · `app/services/sync.py:160-192` |
| **H-05** | ALTA | Especiales · cierre APK↔web | En v51 cerrar el caso no cierra el especial; `/sync/carga` no sincroniza `CasoEspecial.estado` y filtros/monitoreo leen la columna cruda (D-120 sin commitear, parcial) | `app/services/resolucion.py:43-64` · `app/services/sync.py:581-593` |
| **H-06** | ALTA | Sincronización · reasignación | Un caso reasignado a mitad de jornada se rechaza desde `/sync/carga` indefinidamente (intentos=1) y el outbox lo cierra por un endpoint que **no** valida cuadrilla: bypass silencioso del guard | `app/services/sync.py:609-625` · `app/services/despacho.py:1196-1226` |
| **H-07** | ALTA | Cola offline · concurrencia | Dos caminos envían la misma acción a la vez (auto-envío de 5 min vs CARGA) sin mutex compartido: doble cierre y doble juego de evidencias | `app_movil/lib/features/sync/sync_provider.dart:143-185` · `upload_service.dart:115-152` |
| **H-08** | ALTA | Cola offline · dos sumideros | `DIFERIDO_EVIDENCIAS` se encola contra un endpoint que exige otro campo → 422 → ERROR permanente, y su evidencia queda sin vínculo | `app_movil/lib/features/casos/operaciones_service.dart:132-139` · `app/api/schemas/casos.py:245-253` |
| **H-09** | ALTA | Descarga · estado local | `mergearCasos` **reemplaza** la fila: la descarga pisa el estado optimista y `pendiente_sync`, y el trabajo gestionado reaparece como pendiente | `app_movil/lib/core/database.dart:194-230` · `database.dart:423-461` |
| **H-10** | ALTA | Descarga · crecimiento local | `ids_conocidos` viaja con **toda** la caché en la query string y la caché no tiene retención: ~380 casos llenan 8 KB de URL y crece sin límite | `app_movil/lib/features/sync/download_service.dart:104-112` · `database.dart:39-46` |
| **H-11** | ALTA | Evidencias · pérdida de trabajo de campo | Evidencias huérfanas y fantasma: se marca subida antes de vincular, `/evidencias/upload` no guarda `id_caso` ni valida dueño, y la purga borra la referencia local | `app/api/routes_sync.py:78-155` · `app_movil/lib/features/sync/upload_service.dart:43-73` |
| **H-12** | ALTA | Sincronización · integridad del estado | El lote no respeta la cronología: los estados se aplican **siempre** después de las actividades y un CONTACTADO anterior revierte el CIERRE | `app/services/sync.py:627-707` · `app/schemas/sync.py:152-155` |
| **H-13** | ALTA | RBAC de campo · `/casos` | Ningún endpoint de `/casos` aplica el filtro de cuadrilla que sí aplica `/sync`: el TÉCNICO lee y escribe casos de otras cuadrillas (y `/casos/buscar` no acota ni por central) | `app/api/routes_casos.py:56-70` · `routes_casos.py:306-343` |
| **H-14** | MEDIA | Descarga · resolución de cuadrilla | `date.today()` (UTC) para resolver la cuadrilla frente a `hoy_operativo()` (Caracas) para la jornada: entre 20:00 y 24:00 locales el técnico resuelve la cuadrilla equivocada | `app/services/sync.py:105` · `app/services/tiempo.py:25-37` |
| **H-15** | MEDIA | Purga · protección de trabajo sin enviar | «Nunca borra un caso con trabajo sin enviar» falla en 7 de 8 acciones: su payload no lleva `id_caso` y la protección solo lee el payload | `app_movil/lib/core/database.dart:256-288` · `operaciones_service.dart:81-84` |
| **H-16** | MEDIA | Especiales · requisito del informe | `requiere_informe` no se exige en ningún camino (ni APK, ni web, ni backend) | `app/models/especiales_entities.py:60` · `routes_especiales.py:326` |
| **H-17** | MEDIA | Especiales · bandeja y doble verdad | El PATCH del especial permite marcarlo CERRADO sin cerrar el caso, sin reglas ni auditoría; y el TÉCNICO no tiene bandeja de especiales | `app/api/routes_especiales.py:351-370` · `routes_especiales.py:443-463` |
| **H-18** | MEDIA | Descarga · recuperación ante fallos | La DESCARGA, que es la operación crítica, es la única sin reintento ni backoff (una sola llamada, 30 s de timeout) | `app_movil/lib/features/sync/download_service.dart:112` · `app_movil/lib/core/api_client.dart:16-27` |
| **H-19** | MEDIA | Observabilidad | El servidor no sabe qué descargó ni qué falló por caso: `sync_log` solo guarda contadores y el detalle libre nunca se envía | `app_movil/lib/features/sync/sync_sesion.dart:88-101` · `app/schemas/sync.py:209-215` |
| **H-20** | MEDIA | Auditoría · sesiones de sync | IDOR en `PATCH /sync/sesion/{id}`: cualquier autenticado cierra y falsea la sesión de otro técnico | `app/api/routes_sync.py:193-205` · `app/services/sync.py:845-874` |
| **H-21** | MEDIA | Dispositivo · PII y atribución | La caché y la cola offline son del **dispositivo**, no del técnico: sobreviven al logout y se comparten entre P00 | `app_movil/lib/core/database.dart:39-75` · `auth_provider.dart:332-341` |
| **H-22** | MEDIA | Sincronización · validación de ids | `id_metodo`/`id_causa` del cliente no se validan: una FK rota tumba el **lote entero** con 500 | `app/services/sync.py:751-753` · `app/services/sync.py:706` |
| **H-23** | MEDIA | Cuadrilla 0 · actores | La salvaguarda de la cuadrilla de gestión (C-00) es inerte mientras C-00 tenga casos (hoy: 8) | `app/services/sync.py:468-480` · `purga_despachos.dart:49-52` |
| **H-24** | MEDIA | Relojes · zonas horarias | Las actividades viajan con hora local **sin offset** y los estados no llevan hora: la bitácora queda desplazada 4 h y los estados se fechan al sincronizar | `app_movil/lib/features/sync/upload_service.dart:181-215` · `app/models/caso_entities.py:143-145` |
| **H-25** | MEDIA | Accesibilidad · pantalla Sincronizar | Colores fuera del sistema de marca (contraste < 4,5:1), progreso sin semántica y purga sin confirmación ni anuncio | `app_movil/lib/features/sync/sync_screen.dart:56-71` · `sync_screen.dart:224-229` |

---

## 5. Hallazgos CRÍTICOS y ALTOS detallados

### H-01 · CRÍTICA · Sincronización · idempotencia y contrato por ítem

**Qué pasa.** `POST /sync/carga` **no tiene clave de idempotencia**. El contrato acepta `id_actividad_local` por actividad (`app/schemas/sync.py:127-129`) y `ErrorSyncItem` ya declara el campo (`app/schemas/sync.py:166-169`), pero `aplicar_carga` **nunca lo lee**: no busca una actividad ya aplicada, la tabla `actividad` no tiene columna ni índice único para el identificador local y la evidencia se crea con un serial derivado de `id_actividad`, de modo que un segundo envío no colisiona.

En la APK, cuando el servidor responde `rechazadas > 0` se marcan **TODAS** las acciones del lote como REINTENTO con `intentos = 1` fijo y `proximo_intento = ahora + 1 min` (`upload_service.dart:238-265`), y `marcarAccionReintento` persiste ese 1 (`database.dart:530-544`), así que **nunca** se alcanza `maxIntentosSync = 5` (`constants.dart:40-41`) ni el paso a ERROR. Si la respuesta no es 200, el `catch` solo añade un texto y **no toca la cola**.

**Consecuencia verificada.** En la siguiente pasada se reenvían y se reinsertan las actividades CIERRE/ENRUTE **ya aceptadas**: bitácora duplicada, productividad inflada y MONITOREO contando dos veces. Un único ítem venenoso (caso ajeno, `id_metodo` inexistente) deja el lote entero en bucle perpetuo. El escenario «el servidor aplicó y la respuesta se perdió» (timeout de 30 s) produce el mismo daño.

**Evidencia.** `app/services/sync.py:644-658` (inserción sin dedupe) · `app/services/sync.py:661-683` (serial derivado de `id_actividad`) · `app/services/sync.py:690-709` · `app/schemas/sync.py:127-129` y `166-169` · `app_movil/lib/features/sync/upload_service.dart:229-269` · `app_movil/lib/core/database.dart:530-544` · `app_movil/lib/core/constants.dart:40-41` · `app_movil/lib/core/api_client.dart:19-22` · `app/tests/test_sync_api.py` (37 pruebas, **ninguna** de idempotencia).

**Recomendación.** Persistir `id_actividad_local` con índice único `(id_cuadrilla, dispositivo_id, id_actividad_local)`; en `aplicar_carga`, si el par ya existe, devolver el ítem como **aceptado** sin reinsertar. Devolver en `SyncCargaOut` el `id_actividad_local` de cada ítem (aceptado o rechazado) reutilizando `ErrorSyncItem`, y marcar en la APK **acción por acción**, nunca el lote en bloque, con su contador real de intentos. Pruebas: (a) doble POST idéntico → una sola actividad; (b) lote 1 bueno + 1 malo → el bueno se confirma y solo el malo queda pendiente.

**Origen.** R3 (ALTA), R4 (ALTA), R5 (ALTA), R6 (CRÍTICA), R7 (ALTA). Se consolida en CRÍTICA por la duplicación sistemática en el camino normal de la cola y el bucle perpetuo.

---

### H-02 · CRÍTICA · Sincronización · RBAC de campo (fail-open)

**Qué pasa.** `aplicar_carga` solo calcula `ids_permitidos` cuando `_cuadrilla_activa()` devuelve una cuadrilla. Si el técnico **no tiene pertenencia vigente** (o el usuario no tiene `id_tecnico`, estado que la propia DESCARGA contempla como `SIN_CUADRILLA`/`SIN_TECNICO`), `ids_permitidos` queda en `None` y `_validar_acceso` acepta **CUALQUIER** `id_caso` de la central. Es el estado normal de un técnico retirado de su cuadrilla, así que el fail-open es alcanzable sin privilegios especiales.

Agravantes verificados: (a) `/sync/carga` **no tiene whitelist de rol** (solo `get_current_user`), a diferencia de `/sync/descarga`, que sí la tiene (`app/services/sync.py:436-441`), de modo que también un COORDINADOR (cuyo `id_tecnico` suele ser NULL) puede escribir; y (b) no se comprueba `Caso.id_central`. La única barrera remanente es la RLS por central (`app/api/deps.py:50-58`), que está activa por petición pero **no separa cuadrillas**.

**Impacto.** Rompe el objetivo central del canal: un técnico puede mover estados (incluido CERRADO/CANCELADO), actividades y cierres sobre cualquier caso de su central usando el mismo endpoint con el que sube su trabajo de campo.

**Evidencia.** `app/services/sync.py:603-608` (`ids_permitidos = None`; solo se rellena `if c is not None`) · `app/services/sync.py:614-622` (`_validar_acceso`: `ids_permitidos is not None and id_caso not in ids_permitidos`) · `app/api/routes_sync.py:158-166` (sin `require_roles`) · `app/services/sync.py:436-441` (la descarga sí valida roles) · `app/api/deps.py:50-58` (RLS por central) · `app/tests/test_sync_api.py:494-508` (único test negativo de carga, y **presupone que el técnico SÍ tiene cuadrilla**).

**Recomendación.** Para roles no gestores: si no hay cuadrilla vigente, **rechazar el lote completo** (403) en lugar de continuar sin filtro. Calcular `ids_permitidos` siempre y aplicar whitelist de roles al endpoint. Añadir la comprobación de central del caso y tests negativos: técnico sin cuadrilla, técnico retirado de la cuadrilla y rol COORDINADOR deben recibir 403, no aceptación.

**Origen.** R4 (CRÍTICA), R7 (CRÍTICA). R2 lo reportó como agravante del mismo modelo de autorización; se fusiona aquí.

---

### H-03 · CRÍTICA · Sincronización · reglas de estado y cierre

**Qué pasa.** El bucle de `estados` de `aplicar_carga` solo comprueba que el valor esté en un conjunto fijo que **incluye NUEVO y CANCELADO**: no hay máquina de estados ni bloqueo de estados terminales, de modo que un TÉCNICO puede devolver a NUEVO/CONTACTADO un caso CERRADO y **evadir** `POST /casos/{id}/reactivar`, que exige ADMIN/SUPERVISOR y motivo.

Tampoco se valida el cierre: una actividad de tipo CIERRE pasa el caso a CERRADO **sin llamar a `resolucion.cerrar_caso`**, es decir, sin exigir método del catálogo (si `modo` no llega válido, `id_metodo` queda **NULL en silencio**), sin comprobar que el caso ya estuviera cerrado, sin validar `id_causa` y sin aplicar la regla REPARACIÓN↔REFERIDO de `clasificacion.aplicar_en_cambio`. La `fecha_hora` de la actividad y el motivo los aporta el cliente, así que un cierre puede **fecharse a conveniencia**. En el mismo camino se pierde el `destino` del enrutado y **no se crea `Seguimiento`**, así que un enrutado offline queda ENRUTADO sin constancia de a dónde fue; un caso REPARACION que se convierte en REFERIDO por el trigger de la base queda **sin fila `caso_especial`** (MONITOREO lo mide como `referidos_sin_ficha`).

**Evidencia.** `app/services/sync.py:687-704` (estados admitidos: NUEVO…CANCELADO) · `app/services/sync.py:641-654` (`id_causa` y `fecha_hora` del cliente) · `app/services/sync.py:682-684` (`_estado_por_tipo('CIERRE') = 'CERRADO'`) · `app/services/sync.py:745-763` (`_resolver_metodo` devuelve el entero del cliente; `None` si no está en el catálogo) · `app/services/resolucion.py:84-89` y `126-127` (reglas que la carga se salta: `ya_cerrado`, método del catálogo, `aplicar_en_cambio`) · `app/api/routes_casos.py:836-878` (el camino online sí crea `Seguimiento` con destino) · `app/services/clasificacion.py:141-169` y `185-237` · `RepoTecnico/db/schema.sql:822-853` (el trigger convierte `tipo_caso` sin crear ficha ni auditoría) · `app/tests/test_sync_api.py:521-563` (cierre por lote probado, sin aserción sobre `caso_especial`).

**Recomendación.** Que `aplicar_carga` **delegue** en `resolucion.cerrar_caso`/`resolucion.registrar_estado` y `clasificacion.aplicar_en_cambio` (misma unidad de trabajo, mismas validaciones y auditoría); para ENRUTE, crear el `Seguimiento` y transportar `destino` en `ActividadSyncIn`; **prohibir CERRADO por la vía de `estados`**; validar el `modo` contra el catálogo y **rechazar** (no dejar NULL); sellar `fecha_hora` con el reloj del servidor. Pruebas: cerrar un caso ya CERRADO por lote, reabrir CERRADO desde TÉCNICO y cerrar sin modo deben dar 409/403.

**Origen.** R7 (CRÍTICA), R5 (ALTA), R2 (ALTA), R6 (ALTA, enrutado y clasificación), R4 (MEDIA, reglas del lote).

---

### H-04 · ALTA · Especiales · el REF no se despacha al crearse

**Qué pasa.** El alta de un especial crea el `Caso` asociado (`id_averia REF-…`, estado NUEVO) y **nada más**: **no inserta fila en `despacho_casos`**. `GET /sync/descarga` arma la lista exclusivamente con `_casos_ids_de_cuadrilla`, que resuelve el **último despacho** de cada caso y descarta los que no tienen fila en `despacho_caso`. Por tanto un REFERIDO creado **después de procesar la jornada del día** es invisible para la APK: no hay tarjeta, no hay ficha y no hay PIE de acciones, así que el técnico **no puede cerrarlo por ninguna vía**.

Solo hay dos caminos para que llegue: (1) que la jornada se procese **después** del alta con el tipo `ESPECIALES_REPARACION` (marcado por defecto) y el caso tenga **sector resuelto**; o (2) la asignación manual del bloque «Despacho» de la web, que además exige que el despacho de hoy de esa cuadrilla siga en **BORRADOR** (si está PUBLICADO o CERRADO responde 409 y el especial no llega hasta el día siguiente). Y si la dirección **no sectoriza**, el caso cae en `sin_asignar` y no llega a **ninguna** cuadrilla, sin aviso a nadie.

**Estado de la discrepancia.** R3 y R5 confirman el hecho de código; R6 sostiene que el reparto diario por sector lo incorpora (cierto **si** la jornada se procesa después y hay sector). La síntesis fija **ALTA** y no CRÍTICA porque falta confirmar con datos si los REF del reporte están `asignado=true` o atrapados en `sin_asignar`.

**Evidencia.** `app/api/routes_especiales.py:159-213` y `188-213` (crea el Caso y ningún `DespachoCasos`) · `app/services/sync.py:160-192`, `461-490` y `468-480` (ids de cuadrilla = último despacho) · `app/services/despacho.py:88` (`ESPECIALES_REPARACION` por defecto), `1104-1120`, `1123-1146` (409 si PUBLICADO/CERRADO), `747-779` (sin sector → `sin_asignar`) · `app/services/sectorizacion.py:23-58` · `app/web/src/pages/Especiales.tsx:124-142` y `592-634` (única asignación manual) · `app/tests/test_sync_api.py` (sin prueba especial → descarga).

**Recomendación.** Al crear un especial, **insertar su `DespachoCasos` en el borrador abierto del día** (o en un despacho de refuerzo si la jornada ya está publicada) y permitir asignar a un despacho PUBLICADO sin reabrirlo. Mientras eso no exista: exponer en `/sync/descarga` un contador de especiales pendientes de la cuadrilla, avisar en la web cuando un especial queda sin despachar, y **alertar o bloquear el alta** cuando no sectoriza (o asignarlo a la cuadrilla 0/gestión). Prueba de integración: «crear especial → `GET /sync/descarga` del técnico → el REF aparece con `id_caso`».

**Origen.** R3 (CRÍTICA→ALTA), R5 (ALTA), R4 (MEDIA, sin sector). R6 refuta el marco «nunca llega»; se conserva el núcleo verificado.

---

### H-05 · ALTA · Especiales · el cierre del caso no cierra el especial (estado desplegado)

**Qué pasa.** En **v51 / APK 1.14.1+24** (lo que el usuario opera), `caso_especial.estado` es una columna independiente y **ningún camino de campo la mueve**: cerrar el caso desde la ficha (lo que D-112 permite al TÉCNICO) deja el especial `ABIERTO` para siempre, el listado calcula `pendiente` sobre la columna cruda y la APK **no ofrece ninguna acción de cierre del especial**: el TÉCNICO no ve la pestaña Especiales (`main.dart:184-186` lo manda a `CasosScreen`) y el COORDINADOR la ve pero con `puedeGestionar=false`, y su PATCH daría 403 porque `_especial_alta` incluye COORDINADOR pero `_escritura` no (`app/api/deps.py:88`). **Esta es la causa directa del síntoma reportado «los referidos no se están cerrando desde la APK».**

**Mitigación en curso, NO desplegada.** El árbol tiene **D-120 sin commitear**: `resolucion.registrar_estado` llama a `clasificacion.sincronizar_estado_especial` (`app/services/resolucion.py:64`) y el listado deriva el estado visible del caso (`clasificacion.py:100-115`; `routes_especiales.py:439-447`), de modo que un referido cerrado **se muestra** CERRADO. Ese parche deja **tres huecos**: (1) `POST /sync/carga` **no lo usa** (`app/services/sync.py:581-593` tiene su propio `_registrar_estado`), así que la columna queda obsoleta en el camino offline; (2) los filtros `estado` y `solo_pendientes` siguen leyendo la **columna cruda** (`routes_especiales.py:242-251`), de modo que un especial con el caso cerrado **sigue saliendo en «pendientes» por API** y MONITOREO lo cuenta ABIERTO (`app/services/monitoreo.py:262-280`); (3) el botón de cierre sigue exigiendo `puedeGestionar`, así que TÉCNICO y COORDINADOR siguen sin poder cerrar.

**Evidencia.** `app/services/resolucion.py:43-64` (la sincronización que existe) · `app/services/clasificacion.py:86-134` (`estado_especial_visible`/`sincronizar_estado_especial`) · `app/api/routes_especiales.py:443-445`, `463`, `250-251`, `45` · `app/services/monitoreo.py:262-280` · `app/services/sync.py:581-593` · `app/api/routes_casos.py:73-86` · `app/api/deps.py:88` · `app_movil/lib/main.dart:184-186` · `app_movil/lib/features/inicio/inicio_gestion_screen.dart:37-58` · `app_movil/lib/features/especiales/especiales_screen.dart:123-144` y `269-275` · `app/tests/test_especiales_api.py:166-173` (el cierre solo se prueba por PATCH) · `app/tests/test_d120_especiales_estado.py:98-138` (sin commitear; el único cierre probado es por la ruta directa, **nunca** por `/sync/carga`).

**Recomendación.** Commitear y **desplegar D-120**, y cerrarlo del todo: usar `resolucion.registrar_estado` (o llamar a `clasificacion.sincronizar_estado_especial`) **también** en `aplicar_carga`; calcular `solo_pendientes` y el filtro `estado` sobre el **estado derivado** (o añadir job de regularización) y agregar MONITOREO por el derivado; añadir `POST /casos-especiales/{id}/cierre` con `_campo` (ADMIN/SUPERVISOR/TÉCNICO) o permitir que el TÉCNICO cierre el caso del especial desde la bandeja; decidir explícitamente el caso del COORDINADOR (crear sí / cerrar no es una asimetría a mantener). Prueba end-to-end: alta REFERIDO → despacho → cierre por `/sync/carga` → `GET /casos-especiales` y `GET /monitoreo` deben reflejar CERRADO.

**Origen.** R2 (ALTA, en el código desplegado), R5 (MEDIA/ALTA), R3 (MEDIA), R6 (MEDIA), R4 (MEDIA). R7 y R4 descartan contra el árbol, pero el estado auditado es el desplegado: **se mantiene ALTA**.

---

### H-06 · ALTA · Sincronización · caso reasignado: rechazo perpetuo y bypass del guard

**Qué pasa.** `aplicar_carga` autoriza por el **último despacho vigente en el momento de subir** (recalcula `_casos_ids_de_cuadrilla`). Si el supervisor reasigna el caso a otra cuadrilla el mismo día, la fila del borrador de origen **se borra** (`despacho.py:1196-1226`), y toda actividad/estado encolado se rechaza con «El caso no está asignado a tu cuadrilla».

La APK **no distingue** ese rechazo de un fallo transitorio: lo marca REINTENTO a 1 minuto con `intentos=1` y lo reintenta en cada sincronización (arrastrando al resto del lote, H-01), mientras el estado local ya quedó CERRADO al encolar y D-101 lo oculta del listado: el técnico **no vuelve a tocarlo**.

**Matiz verificado (corrige al revisor de R5).** El trabajo **no se pierde para siempre**: la acción sigue en `accion_pendiente` y `SyncProvider.sincronizar()` la reenvía a su endpoint original `POST /casos/{id}/cierre`, que solo exige `_gestion` (TÉCNICO incluido) y **no comprueba pertenencia** (`routes_casos.py:63` y `636-667`; `resolucion.py:67-89`). Es decir: **bypass silencioso del guard** (el cierre entra por una vía que ignora la regla de cuadrilla) + **bucle de reintento sin diagnóstico**, y la regla de negocio («¿puede el técnico cerrar un caso que ya no es suyo?») queda **indefinida entre dos caminos**.

**Evidencia.** `app/services/sync.py:609-625` y `160-192` · `app/services/despacho.py:1196-1226` y `1273-1280` · `app/services/jornada.py:99-107` (la jornada cerrada devuelve los casos a PENDIENTE y quedan redespachables) · `app_movil/lib/features/sync/upload_service.dart:256-265` · `app_movil/lib/features/casos/operaciones_service.dart:226-242` · `app_movil/lib/features/casos/acciones_caso.dart:34-58` · `app_movil/lib/features/sync/sync_provider.dart:244-284` y `339-354` · `app/api/routes_casos.py:63`, `551-572`, `636-667` · `app/services/resolucion.py:67-89`.

**Recomendación.** Definir la regla y hacerla cumplir en **un solo sitio**: (a) aceptar en `aplicar_carga` el trabajo de casos que estuvieron despachados a la cuadrilla en las últimas 24-48 h (histórico de `despacho_casos`, no solo el último); o (b) devolver un código por ítem (`NO_ES_MI_CASO`) que la APK marque como **ERROR visible** con banner al técnico y conserve la evidencia, nunca en reintento perpetuo; y (c) **cerrar el bypass**: el cierre online debe validar la misma pertenencia que el lote, o documentarse explícitamente que el cierre de campo no la exige. Prueba: cerrar sin conexión → reasignar de cuadrilla → sincronizar, y comprobar **un único desenlace y una única actividad**.

**Origen.** R5 (ALTA), R6 (ALTA), R4 (ALTA). R3 lo había integrado en la idempotencia.

---

### H-07 · ALTA · Cola offline · dos emisores concurrentes sin mutex

**Qué pasa.** `SyncProvider` protege `sincronizar()` con el flag `_sincronizando`, y ese envío se lanza **cada 5 minutos y al recuperar red** (`sync_provider.dart:143-185`). Pero `UploadService.cargar()` —que lee **la misma tabla** `accion_pendiente` y consume los mismos tipos CIERRE/CONTACTADO/CITADO/DIFERIDO/ENRUTADO— **no consulta ni toma ese flag** (`upload_service.dart:115-121` y `152`), y `ActualizacionDatosService` la invoca como primer paso del botón. El cerrojo de la pantalla es un `bool` del `State` (`sync_screen.dart:25` y `39-41`) que **se pierde al salir y volver a entrar**; `accionesPendientes` no reclama filas ni las marca `EN_VUELO`.

**Consecuencia.** Si el temporizador o la reconexión caen dentro de la ventana de la carga (que puede durar por las fotos), las mismas acciones se envían **por dos endpoints distintos** (`/sync/carga` y `/casos/{id}/cierre`), que cierran el caso y registran actividad por su cuenta: dos actividades para el mismo hecho y —como `resolucion.cerrar_caso` genera sus propios seriales a partir del id de actividad— **una segunda fila de `Evidencia` para la misma foto**.

**Evidencia.** `app_movil/lib/features/sync/sync_screen.dart:25` y `39-41` · `app_movil/lib/features/sync/upload_service.dart:115-121`, `152`, `229-265` · `app_movil/lib/features/sync/sync_provider.dart:143-168`, `173-185`, `229-233`, `244-258` · `app_movil/lib/core/database.dart:507-516` · `app_movil/lib/features/sync/actualizacion_datos_service.dart:70-72` y `96-146` · `app/services/resolucion.py:106-124` · `app/services/sync.py:627-688` y `app/api/routes_casos.py:636-667` (dos vías de cierre) · ninguna prueba Dart dispara `enviarAtendidos()` durante `cargar()`.

**Recomendación.** **Mutex único de sincronización** a nivel de app/provider (un `Future` en curso o un `SyncLock`), compartido por `cargar`, `sincronizar` y `descargar` —no un flag de widget—, y **reclamación transaccional** de la cola (estado `EN_VUELO` + token + caducidad) antes de enviar. Prueba d88/d115 que dispare el auto-envío durante la carga y verifique que cada acción se envía **una sola vez**.

**Origen.** R3 (CRÍTICA→ALTA), R5 (ALTA), R6 (ALTA), R4 (ALTA). Se ajusta a ALTA porque no es determinista: exige que un tick caiga en la ventana.

---

### H-08 · ALTA · Cola offline · `DIFERIDO_EVIDENCIAS` sin endpoint válido

**Qué pasa.** La acción `DIFERIDO_EVIDENCIAS` se encola con endpoint `/casos/{id}/estado` y payload `{evidencias}` (`operaciones_service.dart:132-139`), pero ese endpoint exige `estado_actual` → **422** → `esDefinitivo` → la acción queda en **ERROR** y la CARGA ya no la recoge (`accionesPendientes` solo toma PENDIENTE/REINTENTO). El disparador es probable: el auto-envío se ejecuta **justo al recuperar la red**, antes de que el técnico pulse Cargar.

El fichero **sí** se sube (paso 1 de la CARGA), pero `/evidencias/upload` crea la `Evidencia` con `id_actividad=None` y **ni siquiera guarda el `id_caso`** del formulario, así que el serial nunca queda ligado ni a la actividad ni al caso. Además, cuando la CARGA sí procesa esa acción, la convierte en una actividad **CONTACTO** (`upload_service.dart:206-217`), que añade una actividad y un paso de bitácora CONTACTADO **espurios** antes del estado DIFERIDO (el estado final se salva porque el servidor aplica actividades antes que estados).

**Evidencia.** `app_movil/lib/features/sync/sync_provider.dart:144-149`, `253-260`, `339-353` · `app_movil/lib/features/casos/operaciones_service.dart:132-139` · `app_movil/lib/features/sync/upload_service.dart:206-217` · `app_movil/lib/core/api_error.dart:38-42` · `app/api/schemas/casos.py:245-253` · `app/api/routes_sync.py:137-140`.

**Recomendación.** **Un único dueño de la cola**: que el auto-envío use también `/sync/carga`, o que `accionesPendientes()` **excluya** los tipos que solo procesa la CARGA (CIERRE/ENRUTADO/DIFERIDO_EVIDENCIAS). Dar a `DIFERIDO_EVIDENCIAS` un endpoint válido (o tratarlo dentro de `/sync/carga` sin cambiar el estado) y guardar `id_caso` en la `Evidencia` que crea `/evidencias/upload`.

**Origen.** R5 (ALTA). R6 lo integró parcialmente en idempotencia; se conserva separado por su mecanismo propio (endpoint equivocado).

---

### H-09 · ALTA · Descarga · `mergearCasos` pisa el estado optimista y `pendiente_sync`

**Qué pasa.** `mergearCasos` inserta con `ConflictAlgorithm.replace` el `datos_json` **íntegro** del servidor, que no trae `pendiente_sync` ni el estado local. Como el trigger de la base actualiza `caso.actualizado_en` en **cada** UPDATE —incluido el paso a PENDIENTE del cierre de jornada de las 23:50—, el diferencial **reenvía el caso** y la descarga **pisa la fila**: el CERRADO local y su distintivo desaparecen, el caso sale de `estadosGestionados` y vuelve al listado como pendiente; el técnico puede cerrarlo otra vez y el cierre anterior **sigue en la cola** → doble cierre y doble actividad. Es exactamente lo que D-85 evitó en `aplicarCambioLocal`, que **sí** fusiona y conserva `pendiente_sync`.

**Evidencia.** `app_movil/lib/core/database.dart:194-230` (`replace`) frente a `423-461` (fusión D-85) · `app_movil/lib/features/sync/download_service.dart:104-112` y `130` · `app_movil/lib/features/sync/actualizacion_datos_service.dart:70-72` y `96-124` (la descarga corre **aunque la carga falle**, a propósito) · `RepoTecnico/db/schema.sql:26-31` y `856-875` (trigger que sube `actualizado_en` en cualquier UPDATE) · `app/services/jornada.py:99-107` · `app/services/sync.py:533-547` · `app_movil/lib/features/casos/caso_detalle_screen.dart:38` (el distintivo sale de `pendiente_sync`) · ninguna prueba cubre «carga fallida + descarga posterior con el mismo caso modificado».

**Recomendación.** Que `mergearCasos` **fusione** como `aplicarCambioLocal`: conservar `estado_actual`, `pendiente_sync` y `fecha_cita` locales mientras ese caso tenga una acción en `accion_pendiente` o evidencias sin subir, y dejar que la CARGA confirme el estado real; si no se puede fusionar, marcar el caso como **«conflicto»** y no dejar que la descarga pise un cambio local no enviado. Prueba: encolar cierre, simular fallo de carga, descargar con el caso modificado y comprobar que sigue CERRADO y pendiente de sincronizar.

**Origen.** R5 (ALTA), R6 (ALTA), R4 (MEDIA→ALTA por duplicación).

---

### H-10 · ALTA · Descarga · `ids_conocidos` sin límite y caché sin retención

**Qué pasa.** La APK envía **todos** los `id_caso` locales como parámetro repetido `ids_conocidos` en la URL del `GET`, a razón de ~21 bytes por caso: **unas 380 referencias llenan una URL de 8 KB**. El problema **no se autolimita** porque la purga conserva para siempre todo caso gestionado (CERRADO, CANCELADO, ENRUTADO, DIFERIDO, CITADO) y `caso_local` **no tiene expiración ni tope** (`database.dart:39-46`), así que tras meses el técnico arrastra cientos o miles de casos históricos en la caché y en la URL, y la petición depende de que el balanceador admita URLs enormes (**414/431** o corte del proxy si no).

**Evidencia.** `app_movil/lib/features/sync/download_service.dart:104-112` · `app/api/routes_sync.py:63-75` (`Query` repetido) · `app_movil/lib/core/database.dart:234-238` y `39-46` · `app_movil/lib/features/sync/purga_despachos.dart:81-83` (los gestionados no se purgan **nunca**) · `database.dart:39-46` (`caso_local` sin retención).

**Recomendación.** Mover «lo que ya tengo» a un **POST con cuerpo** (o sustituirlo por un diferencial con marca del servidor **y cursor de lote**) y definir **retención** de los casos gestionados (p. ej. N días) con compactación local. *Necesita verificación:* límite exacto de URL del front-end de Cloud Run y número real de casos en caché de los dispositivos de campo.

**Origen.** R3 (ALTA). R3 descartó el hallazgo de rendimiento del ranking por materialidad no demostrada y remitió el riesgo de escala aquí.

---

### H-11 · ALTA · Evidencias · huérfanas, fantasma y endpoint sin validación

**Qué pasa.** El flujo sube la foto, el servidor crea la `Evidencia` **sin `id_actividad`** (el `id_caso` que la APK envía como `Form` **no se usa** en el alta) y la APK marca `subida=1` en el mismo acto. El vínculo con el caso solo ocurre cuando `/sync/carga` encuentra ese serial dentro de una actividad. Si la actividad se rechaza o el caso se purga después, la foto queda en el bucket **sin caso ni actividad**, la fila local ya `subida=1` se borra en la purga y **nadie recibe aviso**. Y al revés: si la subida falla, el lote sigue enviando el serial y el servidor fabrica una `Evidencia` con **`ruta_remota` igual al serial**, es decir, una evidencia **fantasma** dentro de un cierre que parece completo; como la acción se marca enviada y se borra, la foto real se sube después con otro serial y la fila fantasma se queda para siempre.

Agravantes verificados: `/evidencias/upload` **no valida el caso ni el permiso** (no comprueba que exista, ni que sea de la cuadrilla, ni el `content_type` real por bytes mágicos), acepta `lat/long`/`origen_camara`/`fecha_hora` **declarados por el cliente**, y si el serial ya existe **devuelve la ruta de una evidencia ajena sin comprobar dueño** (`routes_sync.py:111-122`); como el serial es **predecible** (`caso_averia-TIPO-aaaammdd-hhmmss`), un serial ajeno permite que la carga del dueño acabe vinculando un fichero que no es el suyo.

**Evidencia.** `app_movil/lib/features/sync/upload_service.dart:43-73` y `134-148` (el fallo de foto solo suma a errores y el lote continúa) · `app/api/routes_sync.py:78-155` (id_caso aceptado y nunca usado; `id_actividad=None`), `111-122`, `125-135`, `137-148` · `app/models/entities.py:165-181` (sin `id_caso`; `id_actividad` nullable) · `app/services/sync.py:661-683` · `app_movil/lib/core/database.dart:292-310` y `256-288` · `app_movil/lib/features/sync/purga_despachos.dart:59-86` y `93-110` · `app_movil/lib/features/evidencias/evidencia_service.dart:91-102` · `app/services/resolucion.py:107-123` (serial sintético y `ruta_remota=serial`) · `app/services/storage.py:58-84` · `app/services/masivas.py:412-424` (las evidencias se listan por `id_actividad`).

**Recomendación.** Guardar **`id_caso` en la evidencia** y vincularla al subir; marcar `subida=1` solo cuando el servidor confirme **y** exista actividad vinculada (o subir la foto dentro del propio lote); no aceptar la actividad de cierre si alguna evidencia no se pudo subir. En el servidor: no crear `Evidencia` con `ruta_remota`=serial cuando el archivo no exista (guardar el serial pendiente o rechazar el ítem), validar el caso y su cuadrilla antes de leer el fichero, verificar bytes mágicos, asociar el serial al `p00` que lo sube y devolver 409/404 en lugar de la ruta cuando el serial ya existe y no es del mismo usuario.

**Origen.** R3 (ALTA), R6 (MEDIA), R4 (MEDIA), R7 (MEDIA). Se consolida en ALTA por la **pérdida de trabajo de campo** (foto del cierre fuera de la ficha).

---

### H-12 · ALTA · Sincronización · cronología invertida (CONTACTADO revierte CIERRE)

**Qué pasa.** La APK parte la cola en **dos listas** (actividades y estados) y el servidor aplica **SIEMPRE** primero todas las actividades y después todos los estados, **ignorando el orden de captura**: `EstadoSyncIn` **no lleva marca de tiempo** y el único control es comparar con el estado actual, **sin guarda de estado terminal**. Un técnico que marca CONTACTADO sin cobertura y más tarde CIERRA el caso envía `estados=[CONTACTADO]` y `actividades=[CIERRE]`: el servidor registra la actividad CIERRE y deja el caso CERRADO, **pero después aplica CONTACTADO y lo devuelve a abierto**. Resultado: bitácora incoherente (NUEVO→CERRADO→CONTACTADO), el caso **reaparece como pendiente** en supervisión y el técnico cree que lo cerró. El mismo patrón afecta a CITADO y DIFERIDO frente a un cierre.

**Evidencia.** `app_movil/lib/features/sync/upload_service.dart:152-237` (dos listas desde la misma cola) · `app/services/sync.py:627` (bucle de actividades) y `690` (bucle de estados, siempre después) · `app/schemas/sync.py:152-155` (`EstadoSyncIn` sin fecha) · `app/services/sync.py:704-707` (solo compara con el estado actual) · `app_movil/lib/features/casos/operaciones_service.dart:530-575` (estados encolados sin marca temporal).

**Recomendación.** Enviar **una única secuencia ordenada por fecha de captura** (añadir `fecha_hora` a los estados) y aplicarla **en orden**, ignorando los estados más antiguos que la última actividad del mismo caso; añadir **guarda de estado terminal** en el bucle de estados. Prueba: CONTACTADO(t1) + CIERRE(t2) debe terminar CERRADO con bitácora ordenada.

**Origen.** R3 (ALTA).

---

### H-13 · ALTA · RBAC de campo · `/casos` sin filtro de cuadrilla

**Qué pasa.** Los endpoints de resolución de campo usan `_gestion` (incluye TÉCNICO) y cargan el caso por id con `_o_404` **sin ninguna comprobación de pertenencia**; los de lectura usan `_lectura` (incluye TÉCNICO) acotando **solo por central**. Resultado: con un token de TÉCNICO se puede **cerrar, enrutar, agendar cita rápida, lanzar «no contesta» o corregir dirección/contacto** de un caso de **otra cuadrilla**, y se puede **bloquear la agenda de otra cuadrilla** vía `POST /citas` (que con el rol de campo solo valida que los ids existan). En lectura, listar/ficha devuelven la PII de **toda la central** (nombre, dirección, teléfono 70*) y `/casos/buscar` construye las condiciones **sin** la condición de central.

Es **incoherente con la DESCARGA**, que entrega solo la cuadrilla, y la única barrera efectiva es la RLS por central (`deps.py:50-58`), que **no separa cuadrillas**. Se deduplica aquí el hallazgo de lectura de PII, que comparte la misma causa: **no existe un helper de autorización de cuadrilla fuera de `/sync`**.

**Evidencia.** `app/api/routes_casos.py:56` (`_lectura`), `63` (`_gestion`), `66-70` (`_o_404` sin filtro) y usos en `562`, `587`, `646`, `676`, `719`, `801`, `842` · `routes_casos.py:187-289` (listar: solo central en `223`; cuadrilla opcional en `245-246`) · `routes_casos.py:470-473` (ficha sin filtro) · `routes_casos.py:306-343` (buscar sin `Caso.id_central`) · `app/api/routes_especiales.py:539-564` (`crear_cita` con TÉCNICO) · `app/api/deps.py:50-58` · `app/tests/test_d112_campo_rbac.py:51-135` (solo camino feliz, sin caso negativo de otra cuadrilla).

**Recomendación.** Extraer un **helper de autorización de caso** con el mismo criterio que `sync._casos_ids_de_cuadrilla` (última cuadrilla) y aplicarlo en **todos** los endpoints de resolución de campo, en `/citas` y, para el rol TÉCNICO, en listar/buscar/ficha; añadir la condición de central en `/casos/buscar`. Tests negativos con un técnico de otra cuadrilla para cierre, enrutado, cita, contacto y lectura.

**Origen.** R7 (ALTA), R4 (ALTA, como «dos emisores con permisos distintos»). Consolida también el hallazgo de PII de lectura que R7 había deduplicado.

---

## 6. Requisitos no funcionales faltantes (ISO 25010) en la sincronización

Se contrastaron las 8 características de ISO/IEC 25010 contra el canal APK↔web. **Lo que falta, con su hallazgo:**

| Característica ISO 25010 | Requisito no funcional ausente | Hallazgo |
|---|---|---|
| **Adecuación funcional** (completitud) | El especial recién creado **no es alcanzable** desde la APK hasta que se despacha; y `requiere_informe` no bloquea el cierre | H-04, H-16 |
| **Adecuación funcional** (corrección) | Las reglas de cierre son **distintas** según la vía (lote vs endpoints) y la cronología no se respeta | H-03, H-12 |
| **Eficiencia de desempeño** (comportamiento temporal) | La descarga transporta toda la caché en la URL y no tiene paginación ni cursor; la caché crece sin retención | H-10 |
| **Eficiencia de desempeño** (utilización de recursos) | La descarga escanea histórico de `despacho_caso` sin filtro de cuadrilla; N+1 en la carga local (riesgo, no medido) | H-10 (mecanismo directo) |
| **Compatibilidad / interoperabilidad** | **No hay contrato por ítem**: `id_actividad_local` se acepta y se ignora; el `destino` del enrutado se pierde en el lote | H-01, H-03 |
| **Fiabilidad** (tolerancia a fallos) | La **descarga** no reintenta ni tiene backoff; la **carga** reintenta el lote completo sin tope real (`intentos` fijado a 1) | H-18, H-01 |
| **Fiabilidad** (recuperabilidad) | No hay reclamación de cola (`EN_VUELO` + lease) ni idempotencia que permita reanudar sin duplicar | H-01, H-07 |
| **Fiabilidad** (madurez) | La purga borra evidencias ya subidas sin actividad y deja filas huérfanas | H-11, H-15 |
| **Seguridad** (confidencialidad) | Fail-open de RBAC en la carga; `/casos` sin cuadrilla; PII y cola por dispositivo, no por técnico | H-02, H-13, H-21 |
| **Seguridad** (integridad) | El cliente fija `fecha_hora`, `id_causa`, `id_metodo`, geolocalización y `origen_camara` sin validación; IDOR en la sesión de sync | H-03, H-20, H-11 |
| **Seguridad** (autenticidad/no repudio) | La sesión de sincronización puede cerrarla y falsearla **cualquier autenticado**; la bitácora no sella autor | H-20 |
| **Mantenibilidad** (modularidad/reutilización) | **Tres** implementaciones de `_registrar_estado`; las reglas de cierre viven duplicadas en APK, web y backend | H-03, H-05 |
| **Mantenibilidad** (analizabilidad) | `sync_log` solo guarda contadores; el motivo y el detalle por caso **nunca se envían**; los errores se aplanan | H-19 |
| **Usabilidad / accesibilidad** | La pantalla Sincronizar incumple contraste 4,5:1, no anuncia progreso con TalkBack y purga sin confirmación | H-25 |
| **Portabilidad** | Sin hallazgos verificados en este alcance | — |
| **Adecuación funcional** (exactitud) | Duplicación de actividades y cierres; el especial cerrado sigue contando ABIERTO en MONITOREO | H-01, H-05 |

**Lectura de conjunto.** Los RNF de sincronización **no están especificados en ningún documento**: no hay requisito de idempotencia, de reintento, de tamaño de payload, de retención de caché, de autorización por cuadrilla en la carga ni de trazabilidad por ítem. El canal se diseñó para el camino feliz y se probó en el camino feliz (426 + 212 pruebas verdes); **ninguna prueba ejerce los bordes que este informe documenta**.

---

## 7. Stakeholders y permisos faltantes o contradictorios

| Actor | Puede (verificado) | No puede / contradicción | Fuente | Hallazgo |
|---|---|---|---|---|
| **TÉCNICO** | Descargar su cuadrilla; cerrar/contactar/citar/enrutar por `/casos`; ver su ficha | **No ve la pestaña Especiales**; no puede cerrar el especial; **sí** puede cerrar casos de **otra** cuadrilla por `/casos`; si pierde cuadrilla, `/sync/carga` deja de filtrar (fail-open) | `main.dart:184-186` · `inicio_gestion_screen.dart:37-58` · `routes_casos.py:63` · `sync.py:603-625` | H-05, H-13, H-02 |
| **COORDINADOR** | Crear especiales (`_especial_alta`, `deps.py:45`) | **No** puede editar/cerrar especiales (`_escritura`, `deps.py:88`); ve Sincronizar en la APK pero `/sync/descarga` le da **403**; suele tener `id_tecnico` NULL → fail-open en la carga | `deps.py:45` y `88` · `routes_sync.py` (descarga con roles) · `sync.py:603-608` | H-02, H-05 |
| **SUPERVISOR** | Editar y cerrar especiales por PATCH; reasignar cuadrillas; descargar (si tiene cuadrilla) | El PATCH le permite marcar **CERRADO sin cerrar el caso**, sin reglas ni auditoría | `routes_especiales.py:351-370` · `deps.py:88` | H-17 |
| **ADMIN** | Todo lo del supervisor | Mismo PATCH sin reglas; no se le exige `requiere_informe` | `routes_especiales.py:45`, `351-370` | H-16, H-17 |
| **SUPER** | UI de especiales en la APK y cierre del caso asociado desde CASOS (web) | Sin hueco verificado (R4 descartó el hallazgo) | `inicio_gestion_screen.dart:37-38`, `55-57` · `Casos.tsx:249` | — (§10) |
| **Cuadrilla de gestión C-00** | Se comporta como una cuadrilla más | La salvaguarda `CUADRILLA_GESTION` **solo** se emite si no tiene ningún caso; hoy tiene **8** en BORRADOR → un TÉCNICO cuya única cuadrilla sea C-00 descargaría esos 8 y la purga procedería | `sync.py:468-480` · `purga_despachos.dart:49-52` · `test_sync_api.py:282-306` | H-23 |
| **Cualquier usuario autenticado** | Cerrar su propia sesión de sync | Puede cerrar y **falsear** la sesión de sync de **otro** (IDOR) | `routes_sync.py:193-205` · `sync.py:845-874` | H-20 |
| **Dispositivo compartido (turnos)** | El técnico entrante hereda la caché y la cola | La caché/cola **no** es por P00: PII del anterior y acciones enviadas con el token del siguiente (atribución falsa) | `database.dart:39-75` · `auth_provider.dart:332-341` | H-21 |
| **Central (RLS)** | Aísla entre centrales | **No** aísla entre cuadrillas; es la única barrera que queda en la carga | `deps.py:50-58` | H-02, H-13 |

**Permisos contradictorios que el diseño debe resolver (no son bug, son decisión pendiente):**
1. **Cerrar el caso no cierra el especial** en la UI y sí debería hacerlo la regla de negocio (o el estado del especial debe ser **derivado** y no una columna escribible).
2. **Crear sí / cerrar no** para el COORDINADOR: asimetría no documentada.
3. **La cuadrilla se exige en la descarga y en la carga, pero no en `/casos`**: el mismo técnico puede hacer por la vía online lo que la vía offline le rechaza.
4. **El especial administrativo (PATCH) y el especial de campo (cierre del caso) son dos verdades**: una puede contradecir a la otra y la lista oculta la incoherencia.
5. **`requiere_informe` es un campo decorativo**: se muestra y se edita, pero no condiciona ningún cierre.

---

## 8. Trazabilidad con el brief

### 8.1 «Descargar lo de mi cuadrilla»

| Elemento del requisito | ¿Cubierto? | Evidencia / hueco |
|---|---|---|
| Resolver la cuadrilla del técnico | **Sí** | `_cuadrilla_activa` (`sync.py:94-121`), prefiere cuadrilla de campo |
| Entregar los casos del despacho del día | **Sí** | `_casos_ids_de_cuadrilla` (`sync.py:160-192`) |
| Entregar el despacho en **BORRADOR** (D-119) | **Sí** | `sync.py:57`, `206-215`; prueba `test_sync_api.py:678-867` |
| No filtrar por fecha (arrastrar pendientes) | **Sí** | `sync.py:461-490` |
| No borrar lo recién descargado (purga D-119) | **Sí** | `purga_despachos.dart:59-86`; `d104_purga_despachos_test.dart:19-161` |
| Conservar ids del servidor (`ids_del_dia`/`ids_vigentes`) | **Sí** | `download_service.dart:180-187` |
| Casos de **especiales/referidos** | **NO** hasta que se despachan; **NO** si no sectorizan | H-04 |
| Cuadrilla correcta en la franja 20:00–24:00 | **NO** (UTC vs Caracas) | H-14 |
| Respetar el trabajo local no enviado | **NO** (la descarga lo pisa) | H-09 |
| Descarga reanudable / con reintento | **NO** | H-18 |

**Veredicto de trazabilidad:** el requisito se cumple para el despacho **ordinario** de la cuadrilla; **no** para el caso especial recién creado, ni en la franja horaria de cierre, ni cuando hay trabajo local pendiente.

### 8.2 «Cargar lo que gestioné»

| Elemento del requisito | ¿Cubierto? | Evidencia / hueco |
|---|---|---|
| Subir CERRADO/CITADO/ENRUTADO/DIFERIDO/CONTACTADO | **Sí** | `sync.py:627-709` |
| Subir evidencias y vincularlas | **Parcial** | vincula por serial en el lote (`sync.py:661-683`), pero la subida marca antes de vincular y deja huérfanas/fantasma (H-11) |
| Registrar sesión y checklist | **Sí, agregado** | `sync.py:845-874`; `routes_sync.py:193-224` |
| No duplicar al reintentar | **NO** | H-01 |
| Aplicar las mismas reglas que la web | **NO** | H-03 |
| Respetar la autorización de cuadrilla | **NO** (fail-open) | H-02 |
| Sobrevivir a una reasignación | **NO** (rechazo perpetuo o bypass) | H-06 |
| Un solo emisor | **NO** | H-07 |
| No perder `DIFERIDO_EVIDENCIAS` | **NO** | H-08 |
| Enrutar con destino y `Seguimiento` | **NO** | H-03 |
| Bitácora con la hora real del hecho | **NO** (hora local sin offset; estados sellados al sincronizar) | H-24 |
| Rechazo por ítem con diagnóstico | **NO** (se aplana y solo sobrevive el primero) | H-01, H-19 |

**Veredicto de trazabilidad:** se **transmite** lo gestionado, pero no se puede afirmar que se **registre correctamente**: se duplica en el reintento normal, se saltan reglas del servidor y quedan acciones atascadas sin diagnóstico.

### 8.3 «Cerrar los casos especiales (referidos) desde la APK»

| Elemento del requisito | ¿Cubierto? | Evidencia / hueco |
|---|---|---|
| El REF llega a la APK | **Condicional** | solo si la jornada lo reparte o se asigna a mano (H-04) |
| La APK tiene acción de cierre del caso | **Sí** (ficha del caso, D-87 offline) | `acciones_caso.dart:70-87`; `caso_detalle_screen.dart:50-83` |
| La APK tiene acción de cierre del **especial** | **NO en v51/1.14.1**; sí en el árbol D-120 (sin commitear) | H-05 |
| Cerrar el caso cierra el especial | **NO en v51**; **sí** por la vía `resolucion` con D-120 | H-05 |
| El especial cerrado deja de aparecer pendiente | **NO** (filtros y MONITOREO leen la columna cruda) | H-05 |
| Se exige el informe cuando `requiere_informe` | **NO** | H-16 |
| El cierre administrativo respeta reglas y auditoría | **NO** | H-17 |
| El técnico puede cerrar sin cobertura | **Sí** (cola offline) | `operaciones_service.dart`; D-87 |

**Veredicto de trazabilidad:** **el requisito no está cubierto en el estado desplegado**. La respuesta a la pregunta (c) del usuario es **NO de forma fiable hoy**.

---

## 9. Plan de acción

Esfuerzo: **S** ≤ 1 día · **M** 2–5 días · **L** > 1 semana. La columna «Ref.» remite a los hallazgos de §4.

### 9.1 Quick wins (S) — cierran riesgo con cambios acotados

| # | Acción | Responsable | Ref. |
|---|---|---|---|
| 1 | Rechazar el lote completo (403) si un rol de campo no tiene cuadrilla vigente; añadir whitelist de roles a `/sync/carga` | Backend | H-02 |
| 2 | Marcar en ERROR solo las acciones cuyo `id_caso` aparece en `errores`; no reiniciar `intentos` a 1 en bloque | APK | H-01 |
| 3 | Validar `id_metodo`/`id_causa` **por ítem** antes de insertar y aislar la unidad de trabajo por actividad (no un `commit` único) | Backend | H-22 |
| 4 | Comprobar propiedad en `cerrar_sesion` (`sesion.p00 == usuario.p00`, o ADMIN/SUPER) | Backend | H-20 |
| 5 | Sustituir `date.today()` por `hoy_operativo()` en `_cuadrilla_activa` (un único «hoy» por petición) | Backend | H-14 |
| 6 | Enviar `detalle`, `motivo` y `casos_cuadrilla` en el cierre de la sesión de descarga; exponerlos en el monitor | APK + Backend | H-19 |
| 7 | Migrar la pantalla Sincronizar a los tokens de `theme.dart`, añadir `Semantics` a barra/fase y confirmación con recuento antes de la purga | APK | H-25 |
| 8 | Bloquear el paso a CERRADO/ATENDIDO del especial cuando `requiere_informe` y no haya informe | Backend (+Web) | H-16 |
| 9 | Añadir `id_caso` al payload de **todas** las acciones encoladas (columna en `accion_pendiente`) y usarla en `clavesConTrabajoPendiente` | APK | H-15 |

### 9.2 Mejoras (M) — corrigen el defecto de fondo

| # | Acción | Responsable | Ref. |
|---|---|---|---|
| 10 | Idempotencia real: índice único `(id_cuadrilla, dispositivo_id, id_actividad_local)` + devolver resultado **por ítem** + marcar acción por acción en la APK | Backend + APK | H-01 |
| 11 | Mutex único de sincronización (`cargar`/`sincronizar`/`descargar`) + reclamación transaccional de la cola (`EN_VUELO` + lease) | APK | H-07 |
| 12 | Un solo dueño de la cola: excluir del outbox los tipos que solo procesa `/sync/carga`, y dar a `DIFERIDO_EVIDENCIAS` un endpoint válido | APK | H-08 |
| 13 | `mergearCasos` con **fusión** (conservar `estado_actual`/`pendiente_sync`/`fecha_cita` si hay acción pendiente); marcar «conflicto» | APK | H-09 |
| 14 | Delegar `aplicar_carga` en `resolucion.registrar_estado` + `clasificacion.aplicar_en_cambio`; crear `Seguimiento` en ENRUTE y transportar `destino` | Backend | H-03 |
| 15 | Unificar los **tres** `_registrar_estado` en `resolucion.registrar_estado` (incluido `sync.py` y `routes_casos.py`) | Backend | H-05 |
| 16 | Unificar la autorización de cuadrilla: helper único aplicado a `/casos` (lectura y escritura), `/citas` y `/sync` | Backend | H-13 |
| 17 | **Despachar el especial al crearse** (insertar en el borrador abierto o en refuerzo) y permitir asignar a PUBLICADO; avisar de los `sin_asignar` | Backend + Web | H-04 |
| 18 | Declarar explícita la regla del caso reasignado: aceptar por ventana de jornada o devolver `NO_ES_MI_CASO` como ERROR visible; cerrar el bypass del outbox | Backend + APK | H-06 |
| 19 | Evidencia con `id_caso`, sin alta fantasma cuando el archivo no existe, y validación de pertenencia/bytes mágicos en `/evidencias/upload` | Backend | H-11 |
| 20 | Commitear y **desplegar D-120** completo: cubrir `/sync/carga`, `solo_pendientes`, filtros y MONITOREO por el estado derivado | Backend | H-05 |
| 21 | `ids_conocidos` por **POST con cuerpo** (o diferencial con marca de servidor + cursor) y retención de `caso_local` | APK + Backend | H-10 |
| 22 | Aplicar reglas de transición al PATCH del especial + auditoría; prohibir CERRADO administrativo con el caso abierto | Backend | H-17 |
| 23 | Bifurcar por `c.es_supervisor`, no por «tiene casos», para la cuadrilla de gestión C-00 | Backend | H-23 |

### 9.3 Roadmap (L) — rediseño del canal

| # | Acción | Responsable | Ref. |
|---|---|---|---|
| 24 | **Contrato de sincronización versionado por ítem** (aceptado/duplicado/rechazado con código y mensaje), con clave de idempotencia, paginación y cursor; sustituir el lote monolítico | Backend + APK | H-01, H-19 |
| 25 | **Máquina de estados única** en el dominio (prohibido CERRADO por la vía de `estados`, transiciones terminales, `fecha_hora` sellada por el servidor, auditoría en toda transición) | Backend | H-03, H-12, H-24 |
| 26 | **Reintentos con backoff específicos para la descarga** (timeouts y 5xx), timeout progresivo y descarga **reanudable** | APK | H-18 |
| 27 | **Particionar la caché por P00** (o base por usuario), purga al cambio de usuario y cifrado en reposo (SQLCipher) para PII de campo | APK | H-21 |
| 28 | **Batería de integración del canal**: especial → descarga → cierre → MONITOREO; doble POST idéntico; lote mixto; reasignación; descarga con carga fallida; purga con evidencia `subida=1` sin actividad | QA / Backend | H-01, H-04, H-05, H-09, H-11 |
| 29 | **Observabilidad operativa**: motivo y resultado por caso en `sync_log`, panel de «descargó N y por qué no bajó ninguno», alerta de sesiones con rechazo | Backend + Web | H-19, H-20 |

**Secuencia recomendada.** Semana 1: quick wins 1–9 (H-02, H-20, H-14 primero: son S y de riesgo alto). Semana 2–3: mejoras 10–16 (el núcleo de dup/reglas/cola). Semana 3–4: 17–21 (especiales y evidencias) + desplegar D-120. Después: roadmap 24–29 antes de declarar el canal «cerrado».

---

## 10. Descartes: hallazgos filtrados y por qué

**15 aportaciones descartadas o deduplicadas de 49.** Se documentan para que no se reabran sin motivo.

| # | Dimensión | Hallazgo descartado | Motivo del descarte |
|---|---|---|---|
| 1 | R1 | *(ninguno)* | La lista llegó vacía; el verificador comprobó que la zona existe y que los criterios clave están cubiertos por pruebas con nombre propio (`d104_purga_despachos_test.dart:19-161`, `d115_actualizacion_unica_test.dart:64-139`, `test_sync_api.py:678-867`) y **aceptó el vacío**. Advirtió que el cierre de especiales quedaba fuera de su lente. |
| 2 | R3 | «Un rechazo parcial deja la cola en bucle de 1 minuto **y el trabajo de campo nunca se aplica**» | La consecuencia grave es **falsa**: el outbox clásico reenvía la acción a su endpoint original, que no valida cuadrilla, y el cierre acaba aplicándose. Lo que queda en pie (reenvío de acciones ya aceptadas y aplanado del mensaje) **es H-01**. Sobredimensionado → descartado como hallazgo propio. |
| 3 | R3 | «La descarga rankea todo el histórico de `despacho_caso` dos veces y trae masivas con N+1» | El código es como se describe, pero **no hay medición de volumen ni de tiempo** y las fallas masivas activas por central son pocas; el riesgo de escala se reporta con mecanismo directo y medible en **H-10**. Ante la duda, descartado. |
| 4 | R2 | «Un TÉCNICO sin cuadrilla no tiene restricción en la carga» (como hallazgo independiente) | Es el **mismo modelo de autorización** que **H-02**; se conserva como agravante dentro de H-02, donde corresponde la corrección. |
| 5 | R2 | «Contradicción sobre la cuadrilla C-00: la sync dice que no recibe trabajo de campo y el despacho la trata como cuadrilla» | Premisa **incorrecta**: `CUADRILLA_GESTION` solo se emite cuando **no hay ningún caso**; con 8 casos esa rama no se ejecuta. El residuo real (salvaguarda inerte) es **H-23**. |
| 6 | R4 | «Cerrar el caso REF desde la APK no cierra el especial» (CRÍTICO) | Contra el **árbol actual** (D-120 sin commitear) no se sostiene; **pero sí contra v51/APK 1.14.1**. Se descarta como hallazgo redactado y **se conserva como H-05 con la salvedad de despliegue**. |
| 7 | R4 | «El TÉCNICO no puede cerrar el especial: sin pantalla, sin permiso y sin cola offline» | El TÉCNICO cierra el **caso asociado** (que es la vía de diseño) y el árbol ya añade botón de cierre en Especiales con cola offline. Se pliega en **H-05**. |
| 8 | R4 | «Huecos de matriz: SUPER no puede cerrar especiales, COORDINADOR crea pero no cierra, COORDINADOR ve Sincronizar pero recibe 403» | (a) es **falsa** (SUPER sí puede, por APK y por CASOS con D-120); (b) la asimetría COORDINADOR es **deliberada** y sin evidencia de requisito contrario; (c) es cierta pero menor. Descartado por duda y para no duplicar H-02/H-05. |
| 9 | R5 | «La purga de jornadas anteriores quedó inoperante: `ids_vigentes` conserva justo lo que se quería borrar» | Es el **trade-off explícito de D-119** (evitar que la descarga borre el despacho), no un defecto; y la evidencia de apoyo era **falsa** (la rama sin `idsVigentes` sí es alcanzable con `SIN_DESPACHO`). |
| 10 | R5 | «La ficha de la APK no recibe los datos del especial ni ofrece acciones: el cierre exige dos pasos» | **Falso**: la ficha ofrece Contactado/No contesta/Agendar/Atender y el cierre en dos pasos es el flujo D-87, que funciona offline. El residuo (payload sin bloque `especial`) es UX y se cubre en H-05/H-04. |
| 11 | R6 | «El caso REF no entra en ningún despacho, no llega a la APK y ningún camino cierra la ficha» (CRÍTICO/ALTO) | **Refutado en parte**: el reparto diario por sector lo incorpora (universo de despacho solo excluye CERRADO/CANCELADO/ENRUTADO) y el árbol ya deriva el estado. Se conserva el **núcleo verificado** (el alta no crea `DespachoCasos`) como **H-04** y la desalineación de la columna cruda como **H-05**. |
| 12 | R6 | «La sesión de CARGA no se vincula y `cerrar_sesion` acepta cualquier contador y propietario» (observabilidad) | Verificado, pero **descartado por prioridad**: no rompe ninguno de los tres objetivos de campo ni pierde/duplica trabajo; el IDOR se recoge en **H-20** y la falta de detalle en **H-19**. |
| 13 | R6 | «Todo el trabajo del día viaja en un único POST y un 4xx deja la cola sin marcar» | **Deduplicado** dentro de **H-01**: misma causa raíz (no hay contrato por ítem ni distinción aceptado/rechazado). |
| 14 | R7 | «Nada actualiza `caso_especial.estado`» (CRÍTICO) | **Corregido en el árbol** por D-120 (sin commitear) y por eso no se sostiene contra el código en disco; **sí** contra v51 desplegado, por lo que se conserva como **H-05** (ALTA) con la advertencia de que D-120 no está commiteado, desplegado ni verificado en CI. |
| 15 | R7 | «La descarga entrega PII de casos de masivas que no son del técnico» y «el TÉCNICO lee la PII de toda la central» (como dos hallazgos) | El primero: es la **misma población** que el técnico trabaja por sector; calificarlo de fuga exige demostrar casos de otra cuadrilla, no verificable en lectura → descartado por duda. El segundo: **deduplicado** en **H-13**, que cubre lectura y escritura y conserva toda la evidencia. |

**Regla aplicada en todos los casos:** ante duda razonable, **se descarta**; solo se elevan a hallazgo los hechos confirmados contra el código con `ruta:línea`, con consecuencia demostrada sobre uno de los tres objetivos del brief. Los **15 descartes** no reducen el veredicto: los **25 supervivientes** bastan para sostenerlo.

---

*Fin del informe. Las referencias de línea corresponden al árbol de trabajo en el momento de la lectura; el estado desplegado es v51 (`HEAD eda4218`) y APK 1.14.1+24, sin D-120. Revalidar al publicar.*
