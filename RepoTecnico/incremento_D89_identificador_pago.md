# Incremento D-89…D-94 — El **Identificador de pago (70\*)** como eje del sistema

| Campo | Valor |
|---|---|
| Documento | Requerimientos del incremento (base para los casos de uso y el documento técnico) |
| Estado | **v0.2 — hallazgos H-01…H-21 de la auditoría ya incorporados** |
| Fecha | 2026-10-08 |
| Origen | Petición del usuario (3 reglas) + verificación y propuesta [`propuesta_identificador_pago.md`](propuesta_identificador_pago.md) **v1.0** |
| Decisiones | **DEC-IP-1…4** (cerradas 2026-10-08 · §4) |
| Numeración | Continúa la del proyecto: **RF-45…RF-56** · **RNF-29…RNF-33** · **RT-17…RT-19** (el máximo en uso era RF-44 / RNF-28 / RT-16) |

---

## 1. Problema y objetivo

Hoy el sistema gira alrededor del **caso** y usa `caso.telefono` como un dato de
contacto más. El dato real del origen es otro: la columna 13 trae el **70\***, que
es el **Identificador de pago** —la clave que enlaza al **usuario con la
institución**—, mientras que la columna 16 trae el **número de contacto** del
usuario. Además, un identificador de pago **puede acumular varios reportes** (ID
de AVERÍA/CASO), de modo que el histórico debe construirse **alrededor del
identificador**, no del caso. Y una **REPARACIÓN** que no traiga **70\* + ID de
AVERÍA** no es una reparación: es un **CASO REFERIDO (especial)**.

**Objetivo del incremento:** convertir el identificador de pago en el **eje del
modelo y de la operación**, sin romper lo que ya funciona (APK `1.1.0+8`,
contratos y reportes impresos).

## 2. Alcance

| Dentro | Fuera |
|---|---|
| Entidad `identificador_pago` (1 → N casos), asociación desde la ingesta y el alta manual | Facturación, cobranza o conciliación contable real (solo se deja preparada la clave) |
| Clasificación **70\* = identificador** vs **cualquier otro = contacto** y suma del contacto a `informacion` | Integración con el sistema de CANTV para obtener el titular del identificador (se usa el nombre del caso) |
| Histórico por identificador, reincidencia y métricas asociadas | Portabilidad de números / historial de titularidad |
| Regla REPARACIÓN ⇐ 70\* + ID de AVERÍA, con reclasificación a REFERIDO | Reclasificación masiva de datos existentes (DEC-IP-3) |
| Rótulos y edición correcta de contacto vs identificador en web y APK | Renombrado de `caso.telefono` en API/APK (diferido a la v3, DEC-IP-4) |

## 3. Nuevos Requerimientos Funcionales (RF-45…RF-57)

| # | Requerimiento | Prioridad | Módulo | Regla origen |
|---|---|---|---|---|
| **RF-45** | **Registrar el identificador de pago** (70\*, patrón configurable) y **asociar** a él todos los casos que lo traigan, de modo que un identificador pueda tener **varios reportes** y su histórico se arme a su alrededor. | Alta | Ingesta / Casos | RN-IP-01, RN-IP-04 |
| **RF-46** | **Clasificar el número del reporte:** todo número que cumpla el patrón del identificador se guarda como **identificador de pago**; el número de la **columna 16** (o el de la **columna 13** cuando no cumple el patrón) se guarda como **número de contacto**, asociado al caso **y sumado al campo `informacion`**. Los números de las columnas 78/79 son del técnico y **no** son contacto. Si un 70\* llega por el campo de contacto, **se registra como identificador del caso** (nunca como contacto). | Alta | Ingesta / Casos | RN-IP-02, RN-IP-11 |
| **RF-47** | **Normalizar** todo número antes de compararlo o guardarlo: sin espacios, guiones, paréntesis ni prefijo internacional (`+58`, `0058`, `58`). | Alta | Ingesta / Casos | RN-IP-07 |
| **RF-48** | **Consultar el histórico del identificador de pago:** ficha con el identificador, sus datos conocidos y la lista de sus casos (id de avería, fecha, problema reportado y justificación de cierre). | Alta | PANEL / Casos | RN-IP-04 |
| **RF-49** | **Exigir 70\* + ID de AVERÍA en los casos de REPARACIÓN:** si falta cualquiera de los dos, el caso **no se guarda como REPARACIÓN**: pasa a `tipo_caso='REFERIDO'` y se registra como **caso especial** (`clasificacion=REFERIDO`; se respeta `EMPRESA`/`GOBIERNO` si el usuario los eligió) con `id_averia` sintético `REF-…` si no lo tenía. **No hay forzado** para ningún rol. | Alta | Casos / Especiales | RN-IP-05, DEC-IP-5 |
| **RF-50** | **Marcar** las REPARACIONES existentes sin identificador de pago o sin id real de avería y **reclasificarlas a REFERIDO en su próximo cambio** (edición, cierre, cita, estado o despacho), con traza. | Alta | Casos / Especiales | RN-IP-06 |
| **RF-51** | **Buscar** un caso por **identificador de pago** o por **número de contacto** (PANEL, buscador global y localizador de AGENDA), mostrando en cada resultado qué dato es cuál. | Alta | PANEL / Casos / Agenda | RN-IP-10 |
| **RF-52** | **Editar el número de contacto** desde la ficha web y desde la APK **sin alterar el identificador de pago**; el identificador solo lo modifica ADMIN/SUPERVISOR con validación del patrón. | Alta | Casos / APK | RN-IP-02, RN-IP-10 |
| **RF-53** | **Rotular** el 70\* como «Identificador de pago (70\*)» y los demás números como «Número de contacto» en ficha, listados, ficha rápida, agenda, despacho impreso y APK. | Media | Web / APK / Despacho | RN-IP-10 |
| **RF-54** | **Señalar la reincidencia:** un identificador de pago con **≥ 2 reportes** en la ventana configurada se marca como reincidente en la ficha y en MONITOREO. | Media | Casos / Monitoreo | RN-IP-08 |
| **RF-55** | **Alimentar MONITOREO y los reportes** con las métricas por identificador de pago (casos por identificador, reincidentes, reparaciones reclasificadas a REFERIDO). | Media | Monitoreo | RN-IP-08 |
| **RF-56** | **Informar en la ingesta** los contadores `filas_sin_identificador_pago` y `filas_con_contacto` del lote (columnas nuevas en `ingesta_lote`) y el **detalle por fila** (`avisos jsonb`: fila, `id_averia`, número detectado, motivo), expuesto por `GET /ingesta/lotes/{id}`, **sin** abortar la carga. | Media | Ingesta | RN-IP-09 |
| **RF-57** | **Gestionar el ciclo de vida del identificador de pago:** consultarlo, corregir sus datos conocidos y suspenderlo o darlo de baja **solo si no tiene casos vigentes** (estado distinto de `CANCELADO`); el sistema informa los casos que lo impiden. | Media | Casos / Configuración | RN-IP-03, RN-IP-12 |

## 4. Nuevos Requerimientos No Funcionales (RNF-29…RNF-33) y Técnicos (RT-17…RT-19)

| # | Tipo | Requerimiento | Verificación |
|---|---|---|---|
| **RNF-29** | Integridad / Calidad de datos | `identificador_pago.numero` es **único** y validado por el patrón configurado; **no** puede existir el mismo número en dos identificadores. Un caso `REPARACION` no puede quedar sin identificador ni con `id_averia` sintético (restricción `ck_reparacion_con_ip`). | Pruebas de unicidad, de normalización y de la restricción (inserción directa en BD rechazada) |
| **RNF-30** | Compatibilidad / Retrocompatibilidad | `caso.telefono` se mantiene como **alias de lectura** del 70\* y los contratos de **lectura** siguen operando con la APK `1.1.0+8`. Sus **escrituras** antiguas de contacto que envíen un 70\* **se convierten en el identificador del caso** (no corrompen `contacto_cliente` ni `informacion`), de modo que la APK vigente sigue siendo operativa; el rótulo «Identificador de pago» y la edición plena del contacto llegan con la APK de D-93. | Prueba de contrato con la APK vigente (lectura 200 y escritura de 70\* → se enlaza el identificador, contacto intacto) + E2E de la ficha |
| **RNF-31** | Privacidad / Cumplimiento | Reparto de enmascaramiento (extiende RNF-18): **SUPER/ADMIN/SUPERVISOR** ven el identificador completo, el contacto y el **nombre del titular**; **TECNICO** ve el identificador y el contacto de sus casos y el **titular enmascarado** (`A*** B***`); cualquier otro rol recibe `403`. El identificador **no** se enmascara a quien tiene acceso al caso (lo necesita para operar). | Prueba de enmascaramiento por rol con el valor exacto esperado |
| **RNF-32** | Trazabilidad / Auditabilidad | Toda **asociación**, **reclasificación** o **cambio de contacto** deja traza en `auditoria` (`datos_antes`/`datos_despues`) y, si cambia la clasificación, también en `caso_estado_hist`. | Consulta de la bitácora tras cada operación |
| **RNF-33** | Rendimiento | La resolución y el alta del identificador durante la ingesta **no degrada** el SLO de RNF-08: **≤ 5 min (p95)** para 20 000 filas. | Prueba de carga con el dataset de 20 000 filas |
| **RT-17** | Datos | Tabla nueva **`identificador_pago`** (`UNIQUE (numero)` **global**, `id_central` = central de origen, `CHECK` de **formato** y el patrón de negocio parametrizable) + columna **`caso.id_pago`** + índices + **RLS** (la ficha se ve si es de la central del usuario o si esa central tiene casos enlazados); `tipo_caso` admite **`REFERIDO`**; **trigger** `trg_caso_reparacion_a_referido` + `CHECK ck_reparacion_con_ip`; contadores y `avisos jsonb` en **`ingesta_lote`**; claves nuevas en `configuracion` (`pago.serie_regex`, `pago.reincidencia_dias`, `referido.reclasificar_en_proximo_cambio`). | DDL + migración idempotente |
| **RT-18** | Migración | Script `scripts/migrar_d89_identificador_pago.py` **idempotente** (simulación por defecto, `--aplicar --si`, transacción única, verificación post-migración y log); el backfill usa **el mismo normalizador** de RF-47; **prohibido** `DELETE` sin filtro (D-55). | Simulación → aplicar → verificar → reejecutar («ya migrada») |
| **RT-19** | API / Contrato | Endpoints nuevos `/api/v1/pagos`, `/api/v1/pagos/{numero}` (con sus casos) y `/api/v1/auditoria?entidad=&accion=&desde=&hasta=` (+ página AUDITORÍA); `POST /api/v1/casos` y `PATCH /api/v1/casos/{id}` aceptan **`id_pago`** validado contra `pago.serie_regex`; **corrección** de `PATCH /api/v1/casos/{id}/contacto` al esquema `{direccion, contacto, id_pago?}` (el campo legado `telefono` se interpreta **siempre** como contacto y, si trae un 70\*, **se registra como identificador del caso**); `GET /api/v1/casos/{id}/relacionados` resuelve por `id_pago` (y devuelve `[]` si el caso no tiene identificador). | Contrato OpenAPI + pruebas de integración |
| **RT-20** | Ingesta | **Validación del encabezado:** si el archivo no trae las **80 columnas**, el lote queda en `ERROR` (`filas_leidas = 0`, sin casos creados, `422` al cliente), como exige `interfaz_csv_origen.md` §6.2; hoy el parser solo añade un aviso y el lote se marca `OK` (`routes_ingesta.py:177`), por lo que esta es una **corrección del comportamiento** que se implementa y se prueba en D-89. | Prueba de lote con 79 columnas → `ERROR` y 0 casos |

**Totales del incremento:** **13 RF** (RF-45…RF-57) · **5 RNF** (RNF-29…RNF-33) · **4 RT** (RT-17…RT-20).

## 5. Trazabilidad regla ↔ requisito

| Regla de la propuesta | Requisitos |
|---|---|
| RN-IP-01 (70\* = identificador, patrón parametrizable) | RF-45, RF-47, RNF-29, RT-17 |
| RN-IP-02 (lo demás = contacto y se suma a `informacion`) | RF-46, RF-52 |
| RN-IP-03 (no dar de baja un identificador con casos vigentes) | RF-57, RN-IP-12 |
| RN-IP-04 (1 identificador → N reportes; histórico) | RF-45, RF-48, RF-51 |
| RN-IP-05 (REPARACIÓN ⇐ 70\* + ID de AVERÍA) | RF-49, RNF-29 |
| RN-IP-06 (reclasificar al perder el requisito) | RF-49, RF-50, RNF-32 |
| RN-IP-07 (normalización) | RF-47, RNF-29 |
| RN-IP-08 (reincidencia) | RF-54, RF-55 |
| RN-IP-09 (aviso de ingesta, sin abortar) | RF-56 |
| RN-IP-10 (rótulos) | RF-51, RF-52, RF-53 |
| RN-IP-11 (un 70\* en el campo de contacto se convierte en identificador) | RF-46, RF-52 |
| RN-IP-12 (ciclo de vida del identificador) | RF-57 |
| RN-IP-13 (identificador único global + RLS de la ficha) | RF-45, RNF-29, RT-17 |
| RN-IP-14 (la regla alcanza las filas históricas) | RF-50, RT-17 |
| DEC-IP-1 (patrón parametrizable) | RF-45, RF-47, RT-17 |
| DEC-IP-2 (columna `contacto` asociada + sumada) | RF-46, RF-52 |
| DEC-IP-3 (marcar y reclasificar en el próximo cambio) | RF-50, RT-17 |
| DEC-IP-4 (alias `caso.telefono` + `id_pago`) | RNF-30, RT-19 |
| DEC-IP-5 (sin forzado de REPARACIÓN) | RF-49, RNF-29 |
| DEC-IP-6 (único global + RLS de la ficha) | RF-45, RT-17, RNF-29 |
| DEC-IP-7 (un 70\* en el contacto se registra como identificador) | RF-46, RF-52, RN-IP-11 |

## 6. Actores del incremento

| Actor | Objetivo principal |
|---|---|
| **Sistema de ingesta** (proceso automático del archivo diario) | Clasificar los números, resolver el identificador de pago y enlazar el reporte sin intervención humana |
| **Supervisor** | Ver el histórico por identificador, buscar por identificador o contacto, dar de alta REPARACIONES válidas, revisar avisos de ingesta y reincidencias |
| **Administrador / Super Usuario** | Corregir el identificador de pago, auditar los cambios y supervisar la migración/marcas |
| **Técnico** | Identificar el identificador de pago en la APK y corregir el **número de contacto** desde el campo |
| **Sistema de clasificación** (servicio de reglas) | Reclasificar a REFERIDO y mantener la coherencia de los casos marcados |

## 7. Módulos afectados y esfuerzo estimado

| Módulo | Alcance | Ciclo |
|---|---|---|
| Datos + ingesta | Entidad, backfill con el normalizador de RF-47, **RLS**, `tipo_caso` con `REFERIDO`, **trigger + CHECK**, clasificación 70\*/contacto, contadores y `avisos` del lote, validación del encabezado (RT-20) | **D-89** |
| Reglas de REPARACIÓN/REFERIDO | Servicio de clasificación (exigencia sin forzado), `caso_especial` idempotente, marca y reclasificación en el próximo cambio, chip, `tiene_id_averia` real y métricas de reclasificados | **D-90** |
| API e históricos | `/pagos`, `relacionados` por `id_pago`, corrección de D-88, búsqueda | **D-91** |
| Web | Rótulos, histórico por identificador, reincidencia, búsqueda global | **D-92** |
| APK | Cabecera con identificador y contacto, edición de contacto | **D-93** |
| Monitoreo, informes y manuales | Métricas, despacho impreso, manuales 04/05/06/11 + HTML/PDF/AYUDA | **D-94** |

## 8. Criterios de aceptación del incremento (globales)

```gherkin
Dado un archivo diario con 100 reportes de los cuales 3 traen un número que no es 70*
Cuando se ejecuta la ingesta
Entonces los 97 con 70* quedan enlazados a su identificador de pago
Y los 3 restantes quedan con número de contacto y sin identificador
Y el lote informa filas_sin_identificador_pago = 3 y no aborta la carga
```

```gherkin
Dado un identificador de pago con 2 reportes cerrados
Cuando se consulta el histórico de cualquiera de los dos casos
Entonces se listan los casos del mismo identificador (no los de igual texto)
Y el identificador aparece rotulado como «Identificador de pago (70*)»
```

```gherkin
Dado un usuario que intenta guardar un caso de tipo REPARACION
Cuando falta el identificador de pago o el id de avería real
Entonces el sistema guarda el caso como caso especial REFERIDO
Y deja constancia de cuál dato faltó
```

## 9. Estado de ejecución — ciclo **D-89** ✅ (2026-10-08)

| Entregable | Estado | Evidencia |
|---|---|---|
| Esquema `identificador_pago` + `caso.id_pago` + índices + RLS + `tipo_caso REFERIDO` + trigger + `CHECK` + contadores/`avisos` de `ingesta_lote` + parámetros | ✅ | `RepoTecnico/db/schema.sql` (41 tablas en la base de prueba) |
| ORM (`IdentificadorPago`, `Caso.id_pago`, `IngestaLote`) | ✅ | `app/models/pago_entities.py`, `app/models/caso_entities.py` |
| Servicio del identificador (normalización, patrón parametrizable, clasificación, resolución idempotente, `[CONTACTO]` atómico, histórico y reincidencia) | ✅ | `app/services/pagos.py` |
| Clasificación en la ingesta + contadores + `avisos` + **RT-20** | ✅ | `app/api/routes_ingesta.py`, `app/services/ingesta.py`, `app/schemas/ingesta.py` |
| Alta manual y edición con `id_pago` (adelanto de RT-19/D-91) | ✅ | `app/api/routes_casos.py` (`_aplicar_identificador`), `app/schemas/casos.py` |
| Migración idempotente con backfill, limpieza del alias inválido, respaldo y verificaciones | ✅ | `scripts/migrar_d89_identificador_pago.py` (+ log en `BaseOperaciones/`) |
| Pruebas del ciclo | ✅ **39** (23 unitarias + 16 de integración) | `app/tests/test_d89_reglas_pago.py`, `app/tests/test_d89_identificador_pago.py` |
| Suite completa sin regresiones | ✅ **347 en verde** · `ruff` limpio · `mypy` limpio (`app/` + script) | clúster PostgreSQL 18 temporal, esquema aislado `ggto_test` |
| Migración verificada en base limpia | ✅ simulación → aplicar → **reejecutar sin cambios**; 1 identificador y 2 casos enlazados desde 2 formatos del mismo número | base `ggto_d89` del clúster temporal |

**Pendiente del incremento:** D-90 (servicio de clasificación, `caso_especial` idempotente y métricas), D-91 (API `/pagos`, `/auditoria`, `/relacionados` por `id_pago`), D-92 (web), D-93 (APK) y D-94 (monitoreo, informes y manuales).

## 10. Estado de ejecución — ciclo **D-90** ✅ (2026-10-08)

| Entregable | Estado | Evidencia |
|---|---|---|
| Servicio de clasificación (predicados, marca derivada, ficha idempotente, regla y traza) | ✅ | `app/services/clasificacion.py` |
| Regla aplicada en **todos** los caminos de escritura (alta, edición, estado, cierre, cita, «No Contesta», enrutado y alta de especiales) | ✅ | `app/api/routes_casos.py`, `app/api/routes_especiales.py` |
| `tiene_id_averia` **real** (el `REF-…` sintético no cuenta) y una sola ficha por caso | ✅ | `app/api/routes_especiales.py` |
| Marcas expuestas en la ficha y los listados | ✅ | `CasoOut.marcado_reclasificar` / `motivo_marca` / `tiene_identificador_pago` / `tiene_id_averia_real` |
| Métricas de reclasificados | ✅ | `app/services/monitoreo.py`, `GET /api/v1/monitoreo/reclasificaciones` (ADMIN/SUPERVISOR · TÉCNICO 403) |
| Pruebas del ciclo | ✅ **14** nuevas | `app/tests/test_d90_clasificacion.py` |
| Suite completa sin regresiones | ✅ **361 en verde** · `ruff` limpio · `mypy` limpio | clúster PostgreSQL 18, esquema aislado `ggto_test` |
| **Corrección de diseño:** la excepción «un cambio de estado en un caso ya terminal no reclasifica» es **inexecutable** con el `CHECK` de D-89 | ✅ documentada | CU-D89-09/A2 (v0.4) y documento técnico §14: **cualquier escritura regulariza**; los marcados no reescritos se informan en MONITOREO |

**Pendiente del incremento:** D-91 (`/pagos`, `/auditoria` y `relacionados` por `id_pago`), D-92 (web), D-93 (APK) y D-94 (monitoreo, informes y manuales).

## 10bis. Cierre del incremento — ciclos D-91…D-94 (2026-10-08)

| Ciclo | Estado | Qué quedó | Evidencia |
|---|---|---|---|
| **D-91** · API `/pagos`, `/auditoria` y `relacionados` por `id_pago` | ⏸️ **Diferido** a otra versión (decisión del usuario) | Se resolvió con la API existente más un adelanto mínimo: la búsqueda `q`/`telefono` de `GET /casos/buscar` cubre también el número de contacto | documento técnico §15 |
| **D-92** · Web | ✅ | Rótulos «Identificador de pago (70\*)» y «Número de contacto», histórico por identificador con reincidencia, chip «Reclasificar a REFERIDO», búsqueda global agrupada | documento técnico §15 · E2E `24-identificador-pago` 6/6 |
| **D-93** · APK | ✅ | Cabecera con el identificador en solo lectura y el contacto, edición del contacto **sin** la serie 700/701/702, envío de `contacto`, versión `1.1.0+9` firmada y publicada | documento técnico §16 · `flutter test` 64/64 |
| **D-94** · Monitoreo, informes y manuales | ✅ | **Día operativo** `America/Caracas`, métricas por identificador (reincidentes y reportes por 70\*), informe imprimible con el lado del identificador, despacho impreso rotulado, matriz RBAC §5.2 y **manuales sincronizados** | documento técnico §17 · `test_d94_identificador_monitoreo.py` (8) · E2E `25-monitoreo-identificador` 2/2 |

**Estado del incremento: cerrado** (D-91 diferido por decisión del usuario). El identificador de
pago (70\*) es ya el eje del dato: enlaza los reportes, gobierna la regla REPARACIÓN/REFERIDO, se
edita desde el campo, informa la reincidencia y quedó documentado en los manuales.

## 11. Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| v0.1 | 2026-10-08 | Emisión inicial: RF-45…RF-56, RNF-29…RNF-33 y RT-17…RT-19, trazados a las reglas RN-IP y a las decisiones DEC-IP. |
| **v0.2** | 2026-10-08 | **Hallazgos H-01…H-21 de la auditoría incorporados:** RF-46 (contacto solo de las columnas 13/16 y `422` para un 70\*), RF-49 (`tipo_caso='REFERIDO'` sin forzado), RF-56 (columnas y `avisos jsonb` del lote), **RF-57** (ciclo de vida del identificador), RNF-30 (compatibilidad real de la APK `1.1.0+8`), RNF-31 (reparto de enmascaramiento por rol), RT-17 (RLS, `UNIQUE (numero, id_central)`, trigger, `REFERIDO`, contadores), RT-18 (mismo normalizador), RT-19 (auditoría, `id_pago` en el alta y la edición, `relacionados` por identificador) y **RT-20** (rechazo del lote con encabezado inválido). Totales: **13 RF · 5 RNF · 4 RT**. |
| **v0.3** | 2026-10-08 | **DEC-IP-5/6/7 cerradas** (entrevista una a una): RF-46 y RNF-30 pasan de «70\* en el contacto → `422`» a **«se registra como identificador del caso»**; RT-17 pasa a **`UNIQUE (numero)` global** con `id_central` = central de origen y RLS que permite leer la ficha a la central con casos enlazados; trazabilidad de RN-IP-11/13 y DEC-IP-6/7 actualizada. |
| **v0.4** | 2026-10-08 | **D-89 implementado y verificado** (§9): esquema, ORM, servicio, ingesta con RT-20, migración probada en base limpia, 39 pruebas del ciclo y suite completa en verde. |
| **v0.5** | 2026-10-08 | **D-90 implementado y verificado** (§10): servicio de clasificación, ficha `caso_especial` idempotente, `tiene_id_averia` real, regla en los 8 caminos de escritura, marcas en `CasoOut` y métricas de reclasificados; **361 pruebas** en verde y corrección documentada de la excepción de estados terminales. |
