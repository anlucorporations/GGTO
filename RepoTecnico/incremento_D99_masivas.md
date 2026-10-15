# Incremento D-99 — Módulo MASIVAS y jornada de despacho

| Campo | Valor |
|---|---|
| Documento | `incremento_D99_masivas.md` |
| Estado | v1.0 |
| Fecha | 2026-10-14 |
| Origen | Solicitud directa del cliente sobre la plataforma en producción (revisión `ggto-web-00040-2cj`) |
| Decisiones | DEC-MA-1 … DEC-MA-7 |
| Numeración | Continúa la del proyecto: **RF-58…RF-72** · **RNF-34…RNF-36** · **RT-21…RT-24** (el máximo en uso era RF-57 / RNF-33 / RT-20) |

---

## 1. Problema y objetivo

Hasta D-98 la falla masiva era funcionalmente un **aviso**: se detectaba por
concentración (RF-09), se podía planificar (RF-17) y se le podían pedir materiales
(RF-18), pero **no tenía identidad operativa**:

- los casos afectados eran una **deducción implícita** (`falla_masiva.clave_concentracion`
  recalculada en cada lectura), sin asociación auditable;
- **la ficha de la masiva no existía en la APK** y `caso.es_falla_masiva` nunca se
  actualizaba;
- no había **cierre** de la masiva: los casos se cerraban uno a uno;
- la web no tenía una **sección** propia (la tabla vivía dentro de DESPACHO y la
  ficha dentro de ALERTAS);
- el despacho no tenía **jornada**: no se cerraba nunca solo, y los casos sin
  cerrar quedaban colgados indefinidamente.

**Objetivo.** Dar a la masiva el rango de entidad operativa de primer nivel —con
casos asociados, gestión, cierre en cascada y ubicación— y cerrar el ciclo de la
jornada del despacho, de modo que ningún caso quede fuera de control al terminar
el día.

---

## 2. Alcance

### Dentro
1. Asociación explícita y auditable caso ↔ masiva.
2. Sección **MASIVAS** en la web: búsqueda automática, alta manual, gestión,
   reporte imprimible, histórico y mapa de la ubicación del FAT.
3. **Cierre de la masiva** con descripción del trabajo, personal del CRASS que
   valida la reparación y evidencias, cerrando **en cascada** todos sus casos.
4. Catálogo de **personal externo** (solicitantes de referidos y personal del CRASS).
5. **APK**: bloque MASIVA fijo y priorizado y ficha completa (casos asociados,
   datos técnicos con la RUTA, planificar, materiales y cerrar).
6. **Jornada del despacho**: corte automático a las 23:50 y paso de los casos no
   cerrados a `PENDIENTE`.
7. Primer procesamiento de la jornada con asignación de sectores; reproceso con
   reasignación por sector y aviso `DESPACHO ACTUALIZADO`.
8. Reporte de producción con **aro de cumplimiento por cuadrilla** e icono MASIVA.

### Fuera
- Detección de masivas por contenido del texto (se mantiene la concentración).
- Notificación al CRASS por un canal externo propio (se usa la mensajería interna).
- Rediseño del módulo de insumos v2 (`orden_material_detalle`, `inventario_movimiento`).

---

## 3. Nuevos Requerimientos Funcionales (RF-58…RF-72)

| # | Enunciado | Prioridad | Módulo |
|---|---|---|---|
| **RF-58** | **Asociar automáticamente** los casos de la concentración a la falla masiva en el momento de detectarla, y permitir reconstruir la asociación si falta. | Alta | Masivas |
| **RF-59** | **Listar los CASOS ASOCIADOS** de la masiva con sus datos técnicos y la **RUTA**, y permitir **agregar y quitar** casos a mano. La RUTA se toma de la columna EXTRA del archivo de ingesta y, si viene vacía, se compone con Tarjeta (slot) · Puerto · FAT. | Alta | Masivas |
| **RF-60** | Ofrecer una **sección MASIVAS** con búsqueda automática (detección por concentración), alta manual, gestión, **reporte imprimible**, **histórico** filtrable y **ubicación** del FAT afectado (coordenadas de la masiva y GPS de las evidencias). | Alta | Masivas |
| **RF-61** | **Cerrar la masiva** exigiendo obligatoriamente la **descripción del trabajo**, el **personal del CRASS que valida la reparación** y las **evidencias**. | Alta | Masivas |
| **RF-62** | Al cerrar la masiva, cerrar **todos sus casos asociados** con el modo indicado (IVR por defecto) y la descripción `Reparado en FDT`, informando de los casos omitidos. | Alta | Masivas |
| **RF-63** | Mantener un **catálogo de personal externo** con NOMBRE, UNIDAD y TELÉFONO, que sirva de desplegable del validador del CRASS y del solicitante de los casos referidos. | Media | Configuración |
| **RF-64** | En la **APK**, mostrar la MASIVA de forma **fija y priorizada**: un bloque siempre visible por encima del trabajo de campo y una ficha con CASOS ASOCIADOS, DATOS TÉCNICOS (con la RUTA) y la gestión (Planificar · Materiales · Cerrar). | Alta | APK |
| **RF-65** | **Cerrar automáticamente** los despachos a las **23:50** del día de la jornada (hora configurable), dejando constancia de la hora y del carácter automático del cierre. | Alta | Despacho |
| **RF-66** | Los casos del despacho que **no estén cerrados** al corte pasan a **PENDIENTE**, de modo que vuelven al universo despachable de la jornada siguiente. | Alta | Despacho |
| **RF-67** | En el **primer procesamiento** de la jornada, exigir la **asignación de los sectores** a cada cuadrilla antes de procesar. | Alta | Despacho |
| **RF-68** | En el **reproceso** de la jornada, reasignar los casos a las cuadrillas **según el sector** de cada una, y presentar la ficha del despacho sin cierre manual y con un **cuadro de información reorganizado** y **Box Infos** de resumen. | Media | Despacho |
| **RF-69** | Enviar a los técnicos de cada cuadrilla el aviso **DESPACHO ACTUALIZADO** en cada procesamiento, con el número de casos asignados. | Media | Despacho |
| **RF-70** | Presentar el **reporte de producción** con un **gráfico de aro por cada cuadrilla** que refleje ABIERTOS, CERRADOS, ENRUTADO, DIFERIDO y CITADOS, y el porcentaje de cumplimiento. | Media | Despacho |
| **RF-71** | Marcar con un **icono de MASIVA** la cuadrilla a la que se le asignó una falla masiva, tanto en la ficha del despacho como en el reporte de producción. | Media | Despacho |
| **RF-72** | Entregar en la **descarga de la APK** las masivas activas que atañen a la cuadrilla, con sus casos asociados y la RUTA, junto con los datos técnicos del caso. | Alta | Sincronización |

**Totales del incremento:** **15 RF** (RF-58…RF-72) · **3 RNF** (RNF-34…RNF-36) · **4 RT** (RT-21…RT-24).

---

## 4. Nuevos Requerimientos No Funcionales (RNF-34…RNF-36)

| # | Enunciado | Criterio de verificación |
|---|---|---|
| **RNF-34** | El corte de jornada **no puede depender de un planificador en proceso**: Cloud Run apaga la instancia cuando no hay tráfico, de modo que un *cron* interno no es fiable. El corte debe ser **determinista** (una función del día operativo y de la hora configurada) y dispararse al entrar un gestor. | Con el servicio dormido y sin ningún job externo, la primera entrada de un SUPER/ADMIN/SUPERVISOR después del corte deja el despacho cerrado y los casos en PENDIENTE. |
| **RNF-35** | La sección MASIVAS debe responder en menos de **2 s** con el histórico por defecto (90 días) en el entorno de producción. | Medición con el histórico sembrado; el endpoint va indexado por `(id_central, estado, fecha_deteccion DESC)`. |
| **RNF-36** | La APK debe poder **mostrar la masiva y sus casos asociados sin conexión**, con los datos de la última sincronización. | Con el dispositivo en modo avión tras una descarga, la ficha MASIVA muestra RUTA, casos asociados y planificación. |

---

## 5. Requerimientos Técnicos (RT-21…RT-24)

| # | Enunciado |
|---|---|
| **RT-21** | Tabla `falla_masiva_caso` con `UNIQUE (id_falla, id_caso)`, `ON DELETE CASCADE` hacia `falla_masiva` y `caso`, e índice por `id_caso`. Es la **única fuente de verdad** de la asociación. |
| **RT-22** | El cierre de la masiva y el de todos sus casos es **una sola transacción**: o se cierran la masiva y sus casos, o no se cierra nada. Un caso ya cerrado se **omite y se informa**, nunca aborta el cierre. |
| **RT-23** | Migración `scripts/migrar_d99_masivas.py`: **simulación por defecto**, `--aplicar` para escribir, transacción única, verificación posterior obligatoria (tupla `(1, 1, 8, 3, 5, 3)`), log en `RepoTecnico/BaseOperaciones/migracion_d99.log` y códigos de salida 0/1/2/4. Es idempotente y reejecutable. |
| **RT-24** | La lógica de cierre de un caso se **extrae** a `app/services/resolucion.py` y la consumen tanto `POST /casos/{id}/cierre` como el cierre en cascada, para que no existan dos caminos de cierre divergentes. |

---

## 6. Trazabilidad

| Requisito previo | Cómo lo afecta D-99 |
|---|---|
| **RF-08 / RF-24** (despacho diario) | Se añade la jornada: primer procesamiento con sectores (RF-67), reproceso por sector (RF-68) y corte automático (RF-65/RF-66). |
| **RF-09** (fallas masivas) | La detección ahora **materializa la asociación** (RF-58) en vez de dejarla implícita. |
| **RF-15 / `CERRAR`** (resolución del caso) | El cierre individual no cambia; se reutiliza tal cual para el cierre en cascada (RT-24). |
| **RF-17** (planificación de masivas) | Pasa a ser una pestaña de la ficha, disponible también en la APK (RF-64). |
| **RF-18** (materiales) | Ídem: pestaña de la ficha compartida entre web y APK. |
| **RF-27** (reporte de producción) | Se enriquece con ABIERTOS y ENRUTADO y se convierte en un aro por cuadrilla (RF-70). |
| **RF-37 / cuadrilla 0** | Sin cambios: la cuadrilla 0 sigue recibiendo solo los casos en gestión. |
| **RF-39 / RF-41** (sync y mensajería) | El aviso DESPACHO ACTUALIZADO usa la mensajería interna existente (RF-69) y la descarga incorpora las masivas (RF-72). |
| **RNF-13** (día operativo) | El corte se evalúa en `America/Caracas`, no en UTC del servidor. |
| **RN-AL-01…03** | Sin cambios. |

---

## 7. Decisiones (DEC-MA-1 … DEC-MA-7)

| # | Decisión | Motivo |
|---|---|---|
| **DEC-MA-1** | La asociación caso ↔ masiva se guarda en una **tabla explícita** `falla_masiva_caso`; no se deduce de `clave_concentracion`. | La deducción no permite auditar qué casos se atendieron, ni agregar o quitar casos, ni cerrar en cascada sin ambigüedad. |
| **DEC-MA-2** | El cierre de la masiva exige el **personal del CRASS**, que se materializa como el catálogo de **personal externo**. | El cliente pidió expresamente que se registre quién valida la reparación; usar un catálogo permite reutilizarlo como solicitante de los casos referidos. |
| **DEC-MA-3** | El mapa usa **Leaflet + OpenStreetMap**. | Mapa real, sin clave de API ni coste, y coherente con un proyecto académico. Se descartó un mapa SVG propio (sin calles ni zoom) y un enlace externo a Google Maps (no embebido). |
| **DEC-MA-4** | El catálogo de personal externo **amplía la tabla `solicitante`** existente en vez de crear una tabla nueva. | Ya registraba (unidad, nombre, contacto) al personal externo que reporta casos referidos; crear un catálogo paralelo habría duplicado la entidad y roto la trazabilidad de los referidos históricos. |
| **DEC-MA-5** | El corte de jornada es **perezoso**: lo dispara la entrada de un SUPER/ADMIN/SUPERVISOR. **No** se usa Cloud Scheduler ni un planificador en proceso. | En Cloud Run la instancia se apaga sin tráfico: un *cron* interno no es fiable y uno externo añade configuración y secretos. La entrada de un gestor es el momento en que el estado vencido importa. |
| **DEC-MA-6** | Se añade el estado de caso **`PENDIENTE`**. | El cliente pidió literalmente que los casos no cerrados «pasen a PENDIENTES». `NUEVO` significa «nunca despachado» y `DIFERIDO`/`CITADO` son desenlaces de la jornada; hacía falta un estado que dijera «estuvo despachado y volvió al pozo». `PENDIENTE` queda **fuera** de los estados terminales y del filtro de exclusión, así que es despachable y cuenta como trabajo abierto. |
| **DEC-MA-7** | Se **elimina el cierre manual del despacho** de la ficha flotante. | El cliente lo pidió expresamente: el despacho se cierra solo a las 23:50. Mantener el botón invitaba a cerrar la jornada antes de tiempo y a dejar casos sin reasignar. La API conserva `PATCH /despachos/{id}` por compatibilidad. |

---

## 8. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R-99-1 | El corte perezoso (DEC-MA-5) deja el despacho vencido si **nadie entra** al sistema tras las 23:50. | El corte es determinista: en cuanto entra un gestor, se aplica. Además `POST /despachos/cierre-jornada` permite forzarlo y sirve de base para un job futuro sin cambiar la lógica. |
| R-99-2 | Un caso **CITADO** al que el corte pone `PENDIENTE` podría perder su prioridad. | No la pierde: `construir_propuesta` prioriza por `caso.fecha_cita`, no por `estado_actual`. Queda cubierto por prueba automatizada. |
| R-99-3 | El cierre en cascada puede **cerrar casos que no correspondía** si la asociación automática fue demasiado amplia. | La asociación es visible y editable (RF-59) antes de cerrar, y el diálogo de cierre advierte de que se cerrarán **todos** los casos asociados. |
| R-99-4 | La migración D-99 toca el CHECK de `caso.estado_actual`, que rige para toda escritura. | El script descubre el constraint por expresión (`pg_get_constraintdef`) en vez de por nombre, lo reemplaza en la misma transacción y verifica el resultado antes de confirmar. |

---

## 9. Verificación

| Ámbito | Evidencia |
|---|---|
| Esquema | `RepoTecnico/db/schema.sql` sección 13, aplicada contra PostgreSQL real (el `conftest` recrea el esquema desde el fichero en cada corrida) y comprobada por consulta directa en producción. |
| Backend | **`pytest` 384/384 en verde** (456 s, PostgreSQL 18 local). Incluye las **12 pruebas nuevas** de `app/tests/test_d99_masivas.py`: asociación automática y manual, RUTA desde EXTRA, cierre en cascada con omisión de los ya cerrados, exigencia del validador del CRASS, CRUD del catálogo de personal externo, corte de jornada con paso a PENDIENTE, respeto de los estados resueltos, reporte con ABIERTOS/ENRUTADO y marca `es_masiva`, primera vez/reproceso, aviso DESPACHO ACTUALIZADO y descarga de la APK con masivas y datos técnicos. |
| Lint y tipos | `ruff check app scripts` sin hallazgos nuevos y `mypy app` sin hallazgos nuevos (los preexistentes se mantienen). |
| Web | `tsc --noEmit` y `vite build` en verde (97 módulos; `index-dZ8yh0XN.js` de 722 kB). |
| APK | `flutter analyze` → **«No issues found!»** y `flutter test` → **80/80** (65 previos + **15 nuevos** de `app_movil/test/d99_masivas_test.dart`). |
| E2E | `RepoTecnico/pruebas/e2e/tests/06-despacho.spec.js` actualizado (ya no prueba el botón «Registrar falla» que se eliminó) y nuevo `26-masivas.spec.js` con 7 casos. **No ejecutados** en este entorno: requieren `run_e2e.sh`, el esquema `ggto_e2e` y uvicorn en `127.0.0.1:8090`. |
| Migración | `python scripts/migrar_d99_masivas.py` en simulación y `--aplicar --si` con verificación posterior `(1, 1, 8, 3, 5, 3)`; probado además sobre un esquema **sin D-99** para demostrar que el script basta por sí solo. Reejecución idempotente. |
| Producción | Revisión `ggto-web-00041-2m2` (imagen `ggto-web:v28`), 100 % del tráfico; `/ready` → 43 tablas; contrato de **130 paths** con los seis endpoints nuevos; APK descargada de la web idéntica al build local (`5231b869…d49d448`). |

> **Pendiente declarado.** Los E2E no se han ejecutado y el árbol de trabajo **no se
> ha commiteado ni empujado**. El servicio `ggto-web` sigue con
> `--allow-unauthenticated` y contiene PII real (riesgo arrastrado, ajeno a este
> incremento).

