# Auditoría funcional adversarial — Casos de uso del incremento **D-89…D-94** (Identificador de pago 70\*)

| Campo | Valor |
|---|---|
| Documento | Informe de auditoría de `RepoTecnico/casos_uso/casos_uso_D89.md` **v0.1** |
| Fecha | 2026-10-08 |
| Auditor | Auditor funcional adversarial (agente DSH), con contraste contra el código en estado **D-88** |
| Alcance | 12 casos de uso (CU-D89-01…12), su Gherkin/EARS, sus dos matrices de trazabilidad y su coherencia con `incremento_D89_identificador_pago.md`, `propuesta_identificador_pago.md` **v1.0** (DEC-IP-1…4) y `requerimientos.md` (RF-30/31/32/36, RNF-18/21/24, matriz RBAC §5.2) |
| Fuera de alcance | Diseño técnico, estimación, migración (RT-18) y código (no se modifica ningún archivo) |
| Método | Lectura completa de los 3 documentos + inspección del código citado; ante la duda, el hallazgo se descarta o baja de severidad |

## Veredicto global

**NO están listos para implementar.** La estructura de los 12 CU es correcta y la trazabilidad nominal está completa, pero existen **2 defectos CRÍTICOS de implementabilidad** en la regla REPARACIÓN→REFERIDO frente al `CHECK ck_reparacion_con_ip` (un caso REFERIDO **no se puede insertar ni actualizar** con el diseño de RT-17, y el flujo «forzar REPARACIÓN» es incompatible con la propia restricción), más **8 hallazgos ALTOS** de RBAC, contrato de API, multi-central/RLS y criterios de aceptación no testeables. Con las correcciones de H-01…H-10 (y, recomendablemente, H-11…H-19) el documento queda **APTO CON OBSERVACIONES**.

**Resumen:** 21 hallazgos — **2 CRÍTICOS · 8 ALTOS · 9 MEDIOS · 2 BAJOS**.

## Tabla priorizada

| # | Severidad | Caso de uso / artefacto | Hallazgo (1 línea) | Recomendación |
|---|---|---|---|---|
| H-01 | **CRÍTICO** | CU-D89-08/09 · `propuesta:214-217` · RT-17 | El `CHECK ck_reparacion_con_ip` hace **fallar todo caso REFERIDO** escrito como `tipo_caso='REPARACION'` (lo que hoy hace el código) y **congela** las filas marcadas; ningún CU define el `tipo_caso` del REFERIDO | Reformular el CHECK con la exención `categoria='REFERIDO'` y declarar en CU-08/CU-09 el valor de `tipo_caso` y la reclasificación en el mismo `UPDATE` |
| H-02 | **CRÍTICO** | CU-D89-08 A3 (`:357`) vs CU-07 EARS (`:331`) y RNF-29 | «Solo ADM/SUPER puede forzar una REPARACIÓN sin IP» es **imposible** con el CHECK vigente (ríge para escrituras nuevas) | Resolver la duda 1 en contra del forzado: eliminar A3 (o hacerlo con excepción explícita y `CHECK` relajado, decisión del usuario) |
| H-03 | ALTO | CU-D89-01 A3/flujo 5-6 (`:33,41`) · DEC-IP-4 | No se define **qué valor toma `caso.telefono`** cuando la col. 13 no es 70\*; el alias de lectura deja de ser el IP | Añadir el paso: «si no cumple el patrón, `telefono` queda en `NULL` y el valor va a `contacto_cliente`» |
| H-04 | ALTO | CU-D89-05 A1 (`:218`) · RF-52 (`incremento:50`) | El CU limita la edición del IP a **`ADM`**, pero RF-52 y `propuesta:251` dicen **ADMIN/SUPERVISOR** | Corregir A1: «solo ADMIN/SUPERVISOR (y SUPER); un SUPERVISOR sí puede, un TÉCNICO recibe 403» |
| H-05 | ALTO | CU-D89-05/06 (`:218,258`) · RT-19 · RNF-30 | No se define el **contrato de la petición** que distingue IP de contacto ni el camino de compatibilidad de la APK `1.1.0+8` (que envía `telefono`) | Fijar el esquema (`contacto` vs `id_pago`/`numero_pago`) y el mapeo de compatibilidad; el criterio «TÉCNICO envía cambio del identificador → 403» hoy no es testeable |
| H-06 | ALTO | CU-D89-01 flujo 5 y A4 (`:33,42`) · `ingesta.py:73-74` | «Cualquier otro número de la fila» como contacto captura **`telefono_oficina`/`telefono_movil` del técnico** (cols. 78/79) | Acotar a la columna 16 (DEC-IP-2) y, si se admite otra fuente, enumerarla explícitamente |
| H-07 | ALTO | CU-D89-02 A1 (`:92`) · CU-D89-03 · RNF-21/RT-17 | Multi-central sin resolver: `numero` **UNIQUE** + `id_central NOT NULL` hace imposible un IP compartido, y RT-17 **no añade RLS** a `identificador_pago` | Decidir unicidad (`numero` vs `(numero, id_central)`), definir el histórico entre centrales y añadir política RLS a la tabla nueva |
| H-08 | ALTO | CU-D89-03 (`:152-156`) · CU-D89-04 (`:185-190`) | Los criterios parten de un **estado que la propia regla prohíbe** («un caso cuyo número de contacto es 7014000848») y no se define qué pasa si se teclea un 70\* como contacto | Reescribir los Gherkin con dos IP distintas y definir la regla (rechazo 422 / conversión / almacenamiento) |
| H-09 | ALTO | CU-D89-08 A1 (`:355`) vs RF-49 | «Se respeta la clasificación EMPRESA/GOBIERNO» contradice RF-49, que exige `categoria=REFERIDO` para toda REPARACIÓN sin 70\* | Aclarar la excepción (si existe) o eliminar A1; reflejarlo en `clasificacion`/`tiene_id_averia` |
| H-10 | ALTO | RF-53 (`incremento:51`) · CU-03/CU-04 | RF-53 exige rótulo en **listados, ficha rápida, agenda, despacho impreso y APK**, pero ningún CU tiene un criterio para esos artefactos | Añadir el criterio de rótulo en CU-03 (ficha rápida/listados/despacho) y CU-06 (APK/agenda) |
| H-11 | MEDIO | CU-D89-01/11 · RF-56 · `schema.sql:267-282` | Los contadores `filas_sin_identificador_pago`/`filas_con_contacto` y el «detalle de filas» **no tienen columnas ni artefacto** en `ingesta_lote`; RT-17 no los cubre | Extender RT-17 con las columnas del lote y el formato del detalle |
| H-12 | MEDIO | CU-D89-02 A3 (`:94`) · RN-IP-03 | La baja de un IP con casos vigentes se implementa en un CU pero **ningún RF la cubre** (traza RN-IP-03→RF-45/48 es forzada) | Añadir un RF de ciclo de vida del IP (o retirar A3) |
| H-13 | MEDIO | CU-D89-12 (`:491,498`) | No existe visor de auditoría (SISTEMAS es **exclusivo de SUPER**: `routes_sistemas.py:23`, `App.tsx:45`) y el actor `ADM (Super Usuario)` **confunde ADMIN con SUPER** | Declarar el nuevo endpoint/página como entregable y separar los dos roles |
| H-14 | MEDIO | CU-D89-01 A1/EARS (`:39,66`) | «El lote queda en ERROR y no se ingesta nada» **contradice** el comportamiento vigente (`routes_ingesta.py:177` siempre `OK`; `ingesta.py:183-186` solo añade un aviso) | Declarar la regla como cambio nuevo (y su RF) o alinearla con el aviso actual |
| H-15 | MEDIO | CU-D89-10 A2 (`:439`) · matriz RBAC §5.2 | El CU da MONITOREO al **TÉCNICO**, pero la matriz le asigna «—» (el código sí lo permite: `routes_monitoreo.py:58`) | Actualizar §5.2 o retirar A2; dejar la contradicción resuelta en un solo documento |
| H-16 | MEDIO | CU-D89-03 A3 (`:139`) · RNF-31 | RNF-31 enmascara **IP y titular**; CU-03 A3 solo el titular, y CU-06 exige que el TÉCNICO vea el IP | Definir la tabla rol × dato enmascarado en el CU |
| H-17 | MEDIO | CU-D89-04 flujo 2 (`:173`) vs A3 (`:181`) | Buscar por patrón (identificador vs contacto) y buscar por **prefijo con ≥3 dígitos** son reglas incompatibles para el mismo término | Precisar el orden de decisión y qué se muestra en cada caso |
| H-18 | MEDIO | RT-19 (`incremento:67`) · CU-02/07/03 | RT-19 no cubre el contrato de `POST /casos`, `PATCH /casos/{id}` con `id_pago` ni el `relacionados` por IP, que los CU exigen | Ampliar RT-19 con esos contratos |
| H-19 | MEDIO | CU-D89-09 flujo 2 (`:390`) vs A2 (`:398`) | «Estado» figura como disparador de la reclasificación y a la vez se excluye para casos terminales, sin regla explícita | Fijar la excepción de estados terminales (duda 2) en el flujo principal |
| H-20 | BAJO | CU-D89-02 A2 (`:93`) · CU-12 flujo 4 (`:501`) | «Dos identificadores para el mismo número» y «duplicados por formato» son **estados precluidos** por `numero UNIQUE` (salvo inventario previo a la migración) | Marcar A2/flow 4 como conciliación **pre-migración** |
| H-21 | BAJO | Matriz (`:563-568`) | **RT-18 queda sin CU** (declarado explícitamente como tarea del documento técnico) | Aceptar la excepción o trazarlo a un CU de migración |

---

## Detalle por hallazgo

### H-01 · CRÍTICO — El `CHECK ck_reparacion_con_ip` es incompatible con el resultado REFERIDO de RF-49

**Evidencia.**
- Restricción propuesta: `propuesta_identificador_pago.md:214-217` → `CHECK (tipo_caso <> 'REPARACION' OR (id_pago IS NOT NULL AND id_averia NOT LIKE 'REF-%')) NOT VALID` (repetida en `incremento_D89_identificador_pago.md:60,65` — RNF-29/RT-17).
- El alta de un REFERIDO escribe hoy `tipo_caso='REPARACION'` sin `id_pago`: `app/api/routes_especiales.py:86` (`tipo_caso="CONSTRUCCION" if datos.tipo_actividad == "CONSTRUCCION" else "REPARACION"`), sin `id_pago` en el constructor (`:82-98`).
- CU-D89-08 postcondición (`casos_uso_D89.md:342`) exige `categoria=REFERIDO`, `clasificacion=REFERIDO` y `id_averia` sintético `REF-…`, pero **no dice qué valor toma `caso.tipo_caso`** (y el `CHECK` de `schema.sql:293-294` no admite `'REFERIDO'`).
- CU-D89-09 (`:383,390`) define la marca como `tipo_caso='REPARACION' AND (id_pago IS NULL OR id_averia LIKE 'REF-%')` y su postcondición dice «reclasificado como REFERIDO **o** como REPARACIÓN válida».

**Impacto.** En PostgreSQL, `NOT VALID` omite la validación inicial pero **sigue rigiendo para todo `INSERT` y todo `UPDATE`** (la fila nueva debe cumplir la condición). Por tanto:
1. Un REFERIDO con `tipo_caso='REPARACION'` **no se puede insertar** → el alta de referidos (RF-36/RF-49) devuelve error de integridad.
2. Las filas marcadas (históricas, creadas antes del `CHECK`) **no se pueden actualizar**: cualquier edición, cierre, cita, cambio de estado o despacho viola el `CHECK` aunque no toque `id_pago`/`id_averia` → se congelan, y la premisa de DEC-IP-3 («reclasificar en su próximo cambio») es inejecutable tal como está redactada.

**Corrección concreta.**
1. Reformular la restricción eximiendo el resultado REFERIDO, p. ej.:
   `CHECK (categoria = 'REFERIDO' OR tipo_caso <> 'REPARACION' OR (id_pago IS NOT NULL AND id_averia NOT LIKE 'REF-%')) NOT VALID`
   (misma idea para el caso especial EMPRESA/GOBIERNO si H-09 se resuelve como excepción).
2. Añadir a CU-D89-08, tras el paso 2: «El `caso` resultante deja de ser `tipo_caso='REPARACION'`; se conserva `categoria='REFERIDO'` y el `caso_especial` con `clasificacion='REFERIDO'` (D-23/RF-36)».
3. Añadir a CU-D89-09 un paso explícito: «la reclasificación de una fila marcada ocurre **en el mismo `UPDATE`** que el cambio que la dispara; el sistema no emite ningún otro `UPDATE` sobre una fila marcada».
4. Añadir el escenario (testeable en BD):
```gherkin
Dado un caso marcado: tipo_caso = "REPARACION", id_pago IS NULL, categoria = "RESIDENCIAL"
Cuando el Supervisor lo edita y guarda sin aportar el identificador
Entonces la fila queda con categoria = "REFERIDO" y tipo_caso <> "REPARACION"
Y existe una fila en caso_especial con clasificacion = "REFERIDO"
Y la actualización se confirma sin violar ck_reparacion_con_ip
```

### H-02 · CRÍTICO — El flujo «forzar REPARACIÓN sin identificador» (A3) contradice una decisión cerrada y el propio EARS del CU

**Evidencia.** `casos_uso_D89.md:357` (A3: «Solo `ADM`/`SUPER` puede forzarlo… el caso queda marcado») frente a `:331` (EARS de CU-07: «Si `tipo_caso` es `REPARACION`, entonces el sistema **exigirá** identificador de pago y `id_averia` no sintético, **incluso ante una inserción directa en la base de datos**») y RNF-29 (`incremento_D89_identificador_pago.md:60`). El forzado produciría exactamente la fila que la restricción rechaza.

**Impacto.** Un flujo alternativo del caso de uso nuclear de D-90 es inimplementable mientras exista `ck_reparacion_con_ip`; si se implementa relajando el `CHECK`, se anula RNF-29 y DEC-IP-3. Es una contradicción de decisión cerrada, no un matiz.

**Corrección concreta.** Resolver la **duda 1** (`:572`) antes de implementar D-90. Recomendación: eliminar A3 y sustituirlo por:
```gherkin
Dado un Supervisor que intenta registrar una REPARACION sin identificador de pago
Cuando confirma el alta
Entonces el sistema responde 409 con el detalle «una REPARACIÓN exige identificador de pago (70*) e id de avería real»
Y ofrece registrarlo como caso especial REFERIDO
Y el caso no se crea como REPARACION ni siquiera para el rol SUPER
```
Si el usuario decide conservar el forzado, debe ser con una decisión nueva (DEC-IP-5), un `CHECK` que la admita (p. ej. columna `forzado_motivo NOT NULL`) y su criterio de aceptación propio.

### H-03 · ALTO — `caso.telefono` sin valor definido cuando el número no es 70\*

**Evidencia.** CU-D89-01 A3 (`:41`): «el caso se crea **sin identificador**, el número va a contacto»; ningún paso asigna `telefono`. El contrato vigente lo escribe siempre desde la col. 13 (`app/services/ingesta.py:38`, `app/api/routes_ingesta.py:167`). DEC-IP-4 (`propuesta:362`, `incremento:61`) declara `caso.telefono` como **alias de lectura del 70\***, y `GET /casos/{id}/relacionados` agrupa por `Caso.telefono` (`app/api/routes_casos.py:756-767`).

**Impacto.** Si el implementador conserva el comportamiento actual, `telefono` guardará números de contacto: (a) el alias deja de ser el IP y RNF-30/`DEC-IP-4` se incumplen; (b) el histórico seguiría mezclando por texto (`routes_casos.py:763`), justo el defecto B2-2 que el incremento quiere eliminar; (c) la búsqueda por teléfono (`routes_casos.py:210,291,301`) devolvería contactos rotulados como IP.

**Corrección concreta.** Añadir al flujo principal de CU-D89-01, tras el paso 4:
«Si el valor normalizado de la columna 13 **no** cumple `pago.serie_regex`, el sistema dejará `caso.telefono` en `NULL`, guardará el número en `caso.contacto_cliente` y lo sumará a `informacion` marcado `[CONTACTO]`». Y el criterio:
```gherkin
Dado un reporte cuya columna 13 trae "0414-222-3344" y la columna 16 trae "0424-111-2233"
Cuando el caso queda ingestado
Entonces caso.telefono es NULL
Y caso.id_pago es NULL
Y caso.contacto_cliente es "4142223344"
Y informacion contiene "[CONTACTO] 4142223344"
```

### H-04 · ALTO — El CU-D89-05 restringe a `ADM` la edición del identificador, contra RF-52

**Evidencia.** `casos_uso_D89.md:218` («lo permite **solo** a `ADM`… un `SUP` recibe el campo deshabilitado y `403`») frente a RF-52 (`incremento_D89_identificador_pago.md:50`: «el identificador solo lo modifica **ADMIN/SUPERVISOR** con validación del patrón») y `propuesta_identificador_pago.md:251` («la **IP** solo ADMIN/SUPERVISOR con validación 70\*»). Coherente con el código, el endpoint de contacto admite ADMIN y SUPERVISOR (`app/api/routes_casos.py:51,657`).

**Impacto.** El criterio de aceptación `:234-238` («rol TECNICO → 403») es correcto, pero el de A1 introduce una restricción que ningún requisito respalda y que quitaría al Supervisor una capacidad que RF-52 le concede; la matriz RBAC §5.2 (`requerimientos.md:243`) da CRUD de PANEL a SUPERVISOR.

**Corrección concreta.** Reescribir A1: «(el usuario intenta editar el identificador de pago). El sistema lo permite **solo a ADMIN, SUPERVISOR (y SUPER)**, validando `pago.serie_regex`; un TÉCNICO recibe `403` si fuerza el endpoint y el campo se muestra deshabilitado». Criterio:
```gherkin
Dado un usuario con rol SUPERVISOR y un caso con identificador 7014000848
Cuando cambia el identificador a "700 111-2233"
Entonces el sistema responde 200 y el identificador queda como 7001112233
Y la auditoría registra el valor anterior y el nuevo

Dado un usuario con rol TECNICO
Cuando envía un cambio del identificador de pago
Entonces el sistema responde 403 y no modifica el caso
```

### H-05 · ALTO — Contrato de la petición IP/contacto sin definir y compatibilidad de la APK `1.1.0+8` sin resolver

**Evidencia.** RT-19 (`incremento:67`) solo dice que `PATCH /api/v1/casos/{id}/contacto` «edita número de contacto (`contacto_cliente`), no el identificador». El esquema vigente expone una sola clave, `telefono` (`app/schemas/casos.py:233-253`), y la APK envía `telefono` (`app_movil/lib/features/casos/operaciones_service.dart:361-365,373`) validando la serie 700/701/702 (`app_movil/lib/features/casos/acciones_caso.dart:69,75-80`). RNF-30 (`incremento:61`) exige que «los contratos actuales y la APK `1.1.0+8` sigan operando **sin cambios obligatorios**», mientras CU-D89-06 (`:256`) dice que la APK «**ya no** exige la serie 700/701/702».

**Impacto.** (a) El criterio «TÉCNICO envía un cambio del identificador → 403» no es verificables sin saber con qué campo llega ese cambio. (b) Una APK sin actualizar escribiría un 70\* en `contacto_cliente` y lo sumaría a `informacion`, incumpliendo RNF-30 y ensuciando la ficha. (c) ADMIN/SUPERVISOR tendrían dos superficies de escritura (`PATCH /casos/{id}` con `CasoUpdate.telefono` sin validación, `app/schemas/casos.py:143`; y `PATCH /casos/{id}/contacto`) sin que el CU diga cuál gobierna el IP.

**Corrección concreta.** Fijar en CU-D89-05/06 el contrato: `ContactoUpdate{ direccion, contacto, id_pago? }`, con `id_pago` (o `numero_pago`) solo ADMIN/SUPERVISOR y `contacto` cualquiera; declarar que en la v1 el campo legado `telefono` de la APK `1.1.0+8` se interpreta como **contacto** (nunca como IP) y se documenta la subida de versión de APK; y añadir el Gherkin:
```gherkin
Dado un caso con id_pago = 7014000848 e id_averia = "AV-99812"
Cuando la APK 1.1.0+8 envía PATCH /casos/{id}/contacto con {"telefono": "0412-555-6677"}
Entonces el sistema responde 422 (la serie 700/701/702 ya no es válida para el contacto)
Y caso.id_pago sigue siendo 7014000848

Dado un usuario con rol TECNICO y un caso con id_pago = 7014000848
Cuando envía PATCH /casos/{id}/contacto con {"id_pago": "7019999999"}
Entonces el sistema responde 403 y caso.id_pago no cambia
```

### H-06 · ALTO — «Cualquier otro número de la fila» incluiría los teléfonos del técnico

**Evidencia.** CU-D89-01 flujo 5 (`:33`) y A4 (`:42`): «cualquier otro número de la fila» se guarda como contacto y se suma a `informacion`. El origen mapea a campos del caso `telefono_oficina` (col. 77→78) y `telefono_movil` (col. 78→79), que la propuesta identifica como **teléfonos del técnico**: `app/services/ingesta.py:73-74` y `propuesta_identificador_pago.md:55` («`telefono_oficina` (78) y `telefono_movil` (79) → teléfonos **del técnico**, no del cliente»). DEC-IP-2 (`propuesta:360`) asocia **la columna `contacto` (col. 16)**.

**Impacto.** Se sumaría a `informacion` (texto que se imprime y se exporta) el teléfono personal/oficina del técnico, con impacto de PII (RNF-18/RNF-31) y ruido operativo; y se contradice DEC-IP-2.

**Corrección concreta.** Acotar el flujo 5 a la columna 16 y reformular A4: «Si la fila trae más de un valor de contacto en la **columna 16** (separadores `/`, `;`, `,`), todos se normalizan y se suman a `informacion` separados por `|`, sin duplicar. Los números de las columnas 78 y 79 son datos del técnico y **no** se tratan como contacto.»

### H-07 · ALTO — Multi-central: unicidad del IP, histórico entre centrales y RLS ausente

**Evidencia.** CU-D89-02 A1 (`:92`): «número de otra central → el sistema crea/usa el identificador de la central del caso». El modelo propone `numero varchar(10) NOT NULL UNIQUE` + `id_central integer NOT NULL` (`propuesta:195-196`), lo que hace imposible que dos centrales compartan el mismo número. RT-17 (`incremento:65`) no añade `ENABLE ROW LEVEL SECURITY` ni política a `identificador_pago`, mientras el patrón vigente solo cubre `caso` y `despacho` (`RepoTecnico/db/schema.sql:754-766`). RNF-21 exige alcance por central y RLS como defensa en profundidad (`requerimientos.md:200`). La duda 3 del documento (`:574`) deja el histórico por central sin decidir.

**Impacto.** Si un 70\* aparece en dos centrales: (a) la segunda inserción viola `UNIQUE` (500); (b) si se resuelve reutilizando el IP de la otra central, el caso de la central B queda enlazado a una fila que su propia RLS (si se añade) no deja leer → histórico roto y prueba negativa de aislamiento (RNF-21) en rojo.

**Corrección concreta.** Decidir y documentar: unicidad `UNIQUE (numero)` con `id_central` como **central de origen** y lectura permitida por RLS a cualquier central que tenga casos enlazados (política `USING (app_central_actual() IS NULL OR EXISTS (SELECT 1 FROM caso c WHERE c.id_pago = id_pago AND c.id_central = app_central_actual()))`), o bien `UNIQUE (numero, id_central)`. Añadir a RT-17 el DDL de RLS y a CU-D89-03 el escenario:
```gherkin
Dado un identificador 7014000848 con un caso en la central A y otro en la central B
Cuando un Supervisor de la central A abre el histórico
Entonces ve solo los casos de la central A
Y el conteo de reincidencia del identificador se informa como "parcial: 1 de 2 casos visibles por alcance de central"
```

### H-08 · ALTO — Criterios de aceptación anclados en un estado que la regla prohíbe

**Evidencia.** CU-D89-03 (`:152-156`): «un caso A con teléfono 7014000848 y un caso B con teléfono 7014000848 **como número de contacto**». CU-D89-04 (`:185-190`): «otro cuyo número de contacto es 7014000848». Según RN-IP-01/RF-46 (`propuesta:142-150`, `incremento:44`), todo número que cumpla el patrón es **identificador de pago**, nunca contacto. Al mismo tiempo, CU-D89-05 paso 2 (`:211`) dice que el contacto «**no** exige el patrón del identificador», sin decir qué ocurre si el usuario teclea un 70\*: ¿se rechaza, se convierte en IP o se guarda como contacto?

**Impacto.** Dos de los criterios de aceptación más importantes (el histórico no mezcla por texto y la búsqueda separa identificador de contacto) **no son verificables**, porque el estado «contacto = 70\*» no está definido. Un test no puede preparar el escenario.

**Corrección concreta.** Decidir la regla de entrada (recomendado: rechazo explícito) y reescribir:
```gherkin
Dado un caso A enlazado al identificador de pago 7014000848
Y un caso B enlazado al identificador de pago 7014000849 cuyo contacto_cliente es 7014000848
Cuando se abre el histórico del caso A
Entonces solo aparecen los casos enlazados a 7014000848
Y el caso B no aparece aunque su texto coincida

Dado un Supervisor editando el número de contacto de un caso
Cuando escribe "7014000848"
Entonces el sistema responde 422 con el mensaje «7014000848 es un identificador de pago; use «Identificador de pago» para ese número»
Y el contacto_cliente no cambia
```

### H-09 · ALTO — CU-D89-08 A1 contradice RF-49 sobre la clasificación del REFERIDO

**Evidencia.** `casos_uso_D89.md:355`: «(el usuario ya eligió clasificación EMPRESA/GOBIERNO). Se respeta la clasificación elegida y solo se aplica la regla del identificador». RF-49 (`incremento:47`) no admite excepción: «si falta cualquiera de los dos, el caso … se guarda como caso especial REFERIDO (`categoria=REFERIDO`, `clasificacion=REFERIDO`, `id_averia` sintético `REF-…`)». El esquema admite `categoria='EMPRESA'/'GOBIERNO'` (`schema.sql:296`) y `clasificacion IN ('REFERIDO','EMPRESA','GOBIERNO')` (`schema.sql:380-381`).

**Impacto.** Dos implementaciones distintas de la misma regla (reclasificar siempre vs respetar EMPRESA/GOBIERNO) y, con H-01, un tercer caso de fila que viola `ck_reparacion_con_ip`. Además CU-D89-08 A1 no dice si el caso deja de ser `tipo_caso='REPARACION'`.

**Corrección concreta.** Si la excepción existe, elevarla a decisión y escribirla con precisión: «Una REPARACIÓN de clasificación EMPRESA/GOBIERNO sin 70\* se registra como `caso_especial` con `clasificacion` elegida y `tiene_id_averia=false`, se exime del `CHECK` (H-01) y **no** cuenta como reparación reclasificada en las métricas de RF-55»; si no existe, eliminar A1 y añadir el escenario de que también pasa a REFERIDO.

### H-10 · ALTO — RF-53 sin cobertura en los artefactos que enumera

**Evidencia.** RF-53 (`incremento:51`) exige el rótulo en «ficha, listados, ficha rápida, agenda, despacho impreso y APK». La matriz (`casos_uso_D89.md:554`) traza RF-53 solo a CU-03 y CU-04, cuyos flujos se limitan a la ficha/histórico (`:133`) y al buscador (`:174`). El despacho impreso sigue imprimiendo el campo crudo: `app/api/routes_despachos.py:460` (`<td>{c.telefono or ''}</td>`) y `:603` (`{caso.direccion} · {caso.telefono}`); la web rotula «Teléfono» (`app/web/src/components/FichaCaso.tsx:320`) y la APK `'Teléfono'` (`app_movil/lib/features/casos/caso_detalle_screen.dart:121`).

**Impacto.** El requisito se daría por cubierto sin que ningún caso de uso permita verificarlo en 4 de sus 6 superficies (listados, ficha rápida, agenda, despacho impreso).

**Corrección concreta.** Añadir a CU-03 un criterio de rótulo múltiple y uno específico de despacho:
```gherkin
Dado un caso enlazado al identificador 7014000848 con contacto 4223109000
Cuando se abre la ficha rápida, el listado de CASOS, la agenda y el despacho impreso
Entonces el número 7014000848 aparece rotulado «Identificador de pago (70*)»
Y el número 4223109000 aparece rotulado «Número de contacto»
Y ningún artefacto rotula el 70* como «Teléfono»
```

### H-11 · MEDIO — RF-56 sin soporte de datos (contadores del lote y detalle de filas)

**Evidencia.** RF-56 (`incremento:54`) exige informar `filas_sin_identificador_pago` y `filas_con_contacto` «con el detalle de las filas afectadas». `ingesta_lote` no tiene esas columnas (`RepoTecnico/db/schema.sql:267-282`) y RT-17 (`incremento:65`) no las añade, aunque `propuesta:249` sí lo menciona. CU-D89-11 (`:466-468`) exige desplegar el detalle (fila, `id_averia`, número detectado, motivo) sin que exista artefacto que lo almacene ni endpoint que lo sirva (el detalle actual es `texto` en `detalle_error`, `routes_ingesta.py:178`).

**Impacto.** CU-11 no es implementable sin DDL ni contrato; el requisito queda nominalmente cubierto.

**Corrección concreta.** Extender RT-17: `ALTER TABLE ingesta_lote ADD COLUMN filas_sin_identificador_pago integer NOT NULL DEFAULT 0, ADD COLUMN filas_con_contacto integer NOT NULL DEFAULT 0;` y una tabla o `jsonb` de detalle por lote; añadir el contrato `GET /ingesta/lotes/{id}` con `avisos_detalle: [{fila, id_averia, numero, motivo}]` en RT-19.

### H-12 · MEDIO — RN-IP-03 (baja del identificador) sin requisito que la respalde

**Evidencia.** CU-D89-02 A3 (`:94`) implementa «intento de baja con casos vigentes → se rechaza», pero la ficha del CU solo declara RF-45, RNF-29 y RT-17 (`:80`), que no mencionan baja ni estado del identificador. La trazabilidad del incremento encamina RN-IP-03 a RF-45/RF-48 (`incremento:77`), pero RF-45 es el registro/asociación y RF-48 la consulta del histórico; ninguno regula el ciclo de vida. El modelo sí prevé estados (`propuesta:199-200`, `estado IN ('ACTIVO','SUSPENDIDO','BAJA')`).

**Impacto.** Una regla de negocio cerrada se implementa en un CU sin requisito, y ninguna prueba de RF la exigiría. Trazabilidad nominal, no efectiva.

**Corrección concreta.** Añadir un RF (p. ej. RF-57) «Impedir la baja o suspensión de un identificador de pago con casos no `CANCELADO`», enlazarlo en la matriz RN-IP-03 y añadirlo a los requisitos de CU-D89-02, o retirar A3 del CU.

### H-13 · MEDIO — CU-D89-12 presupone un visor de auditoría que no existe y confunde ADMIN con SUPER

**Evidencia.** CU-D89-12 (`:490,498`) con actor `ADM (Super Usuario)` describe «abre SISTEMAS/auditoría y filtra por entidad `identificador_pago` o `caso`». Pero SISTEMAS es **exclusivo del Super Usuario**: `app/api/routes_sistemas.py:20-23` (`_solo_super = require_roles()`), `app/web/src/App.tsx:45` («SISTEMAS: solo Super Usuario»), `app/web/src/api/client.ts:1035`. No hay endpoint ni página de auditoría (la única superficie es el contenido paginado de la tabla, `routes_sistemas.py:51-60`, sin filtro por entidad). La matriz §5.2 distingue AUDITORÍA (SUPER/ADMIN lectura) de SISTEMAS→Base de datos (solo SUPER) (`requerimientos.md:251,254`).

**Impacto.** El CU da por existente una pantalla y un endpoint que hay que construir, no los declara como entregable ni los traza a un RF; y al usar `ADM (Super Usuario)` como un solo actor, un implementador no sabe si el visor es para ADMIN, para SUPER o para ambos (el segundo Gherkin, `:517-521`, niega el acceso a SUPERVISOR, lo que es correcto).

**Corrección concreta.** Separar los actores `ADM` y `SUPER` en todo el documento (fichas y matrices), declarar el entregable «`GET /api/v1/auditoria?entidad=&accion=&desde=&hasta=` + página AUDITORÍA» como parte de RT-19/RF nuevos, y fijar el escenario:
```gherkin
Dado un usuario con rol ADMIN
Cuando abre la página AUDITORÍA y filtra por entidad "identificador_pago"
Entonces ve la tabla auditoria filtrada con usuario, fecha, datos_antes y datos_despues
Y no ve la sección SISTEMAS→Base de datos
```

### H-14 · MEDIO — CU-D89-01 A1 describe como vigente un rechazo que el sistema no hace

**Evidencia.** CU-D89-01 A1 (`:39`) y su EARS (`:66`): «el lote queda en `ERROR` y no se ingesta nada» si el encabezado no tiene 80 columnas. Hoy `parsear` **solo añade un aviso** y continúa (`app/services/ingesta.py:183-186`) y el endpoint fija `lote.estado = "OK"` incondicionalmente (`app/api/routes_ingesta.py:177`), con `detalle_error` a partir de los avisos (`:178`). RT-05 (`requerimientos.md:287`) describe el parser de 80 columnas, no un rechazo del lote.

**Impacto.** El CU introduce un cambio de comportamiento de la ingesta sin requisito que lo respalde y con impacto operativo (un archivo con encabezado alterado hoy se procesa; con la regla nueva se perdería el día completo). Un test que verifique A1 fallará contra el código actual.

**Corrección concreta.** Decidir y trazar: si se mantiene el rechazo, elevarlo a RF y EARS con su límite («si el **encabezado** no tiene 80 columnas → `estado='ERROR'`, `filas_leidas=0`, sin casos creados, HTTP 422»); si no, reescribir A1 como «el lote queda en `OK` con el aviso … y se informa en INGESTA», que es lo verificable hoy.

### H-15 · MEDIO — CU-D89-10 concede MONITOREO al TÉCNICO contra la matriz RBAC

**Evidencia.** CU-D89-10 A2 (`:439`): «(rol TECNICO). El alcance se limita a su cuadrilla (comportamiento vigente de MONITOREO)». La matriz §5.2 asigna **«—»** al TÉCNICO en MONITOREO/GRÁFICOS (`requerimientos.md:247`). El código sí lo permite y lo acota: `app/api/routes_monitoreo.py:58` usa `get_current_user` y `:25-37` acota por cuadrilla.

**Impacto.** Un CU que describe como vigente una capacidad que el requisito RBAC niega: o el CU está mal, o la matriz está desactualizada. Mientras no se resuelva, la prueba negativa de RNF-21 («TECNICO recibe 403 en MONITOREO») es contradictoria con el CU.

**Corrección concreta.** Actualizar la matriz §5.2 (TECNICO: «Lectura de su cuadrilla») con nota de la decisión, o retirar A2. Dejar constancia en uno solo de los dos documentos.

### H-16 · MEDIO — RNF-31 sin reparto de enmascaramiento por rol

**Evidencia.** RNF-31 (`incremento:62`) enmascara «el identificador de pago **y** el nombre del titular» para roles no autorizados. CU-D89-03 A3 (`:139`) solo enmascara el titular; CU-D89-06 (`:280-281`) exige que el TÉCNICO **vea** el identificador en solo lectura; CU-D89-01/03/04 muestran el número rotulado a SUP/TEC. Ningún CU define qué rol está «autorizado».

**Impacto.** Criterio no testeable (¿el TECNICO ve el 70\* o un valor enmascarado?) y riesgo de bloquear la operación de campo si se aplica al pie de la letra. Además no hay ningún mecanismo de enmascaramiento por rol en la API (solo la ofuscación de columnas sensibles de la inspección de BD, `app/services/sistemas.py:308,353`).

**Corrección concreta.** Añadir una tabla al CU-03: rol × dato (IP, titular, contacto); propuesta: SUP/ADMIN/SUPERVISOR ven todo; TECNICO ve el IP y el contacto de sus casos y el titular enmascarado (`701****848`, `A*** B***`); cualquier otro rol recibe 403. Y su Gherkin con el valor exacto enmascarado.

### H-17 · MEDIO — CU-D89-04: búsqueda por patrón vs búsqueda por prefijo

**Evidencia.** Flujo 2 (`:173`): «si cumple el patrón busca identificador de pago; si no, busca número de contacto». A3 (`:181`): «(número incompleto, ≥ 3 dígitos). El sistema busca por prefijo y lo indica en el encabezado». Un término como `7014` no cumple el patrón (por lo que iría a contacto) y a la vez es un prefijo de identificador.

**Impacto.** Dos criterios incompatibles para el mismo término de entrada; el resultado del buscador depende de la interpretación del implementador.

**Corrección concreta.** Precisar la decisión: «con ≥ 3 dígitos el sistema busca **en ambos** espacios (identificador por prefijo y contacto por prefijo) y muestra los grupos «Identificador de pago (coincidencia parcial)» y «Número de contacto»», con el escenario:
```gherkin
Dado un identificador 7014000848 y un contacto 7014000999
Cuando el usuario busca "7014"
Entonces aparecen dos grupos rotulados «Identificador de pago (coincidencia parcial)» y «Número de contacto»
Y el encabezado informa «búsqueda por prefijo de 4 dígitos»
```

### H-18 · MEDIO — RT-19 no cubre los contratos que los CU exigen

**Evidencia.** RT-19 (`incremento:67`) define solo `/api/v1/pagos`, `/api/v1/pagos/{numero}` y la corrección del `PATCH /casos/{id}/contacto`. CU-D89-07 (`:299-300`) requiere que el alta manual exija y persista el identificador, lo que toca `POST /api/v1/casos` (`app/schemas/casos.py:118-136`, hoy sin `id_pago`); CU-D89-02/09 exigen enlazar/desenlazar desde la edición (`PATCH /casos/{id}`, `app/schemas/casos.py:139-161`); CU-D89-03 exige el histórico por `id_pago`, hoy por teléfono (`app/api/routes_casos.py:756-767`). El `propuesta:251` sí menciona `PATCH /casos/{id}` con `id_pago`.

**Impacto.** El requisito técnico que gobierna los contratos no cubre las tres escrituras/lecturas que los CU necesitan: la trazabilidad RT→CU es incompleta en el sentido que importa (contratos).

**Corrección concreta.** Ampliar RT-19: «`POST /api/v1/casos` y `PATCH /api/v1/casos/{id}` aceptan `id_pago` (validado contra `pago.serie_regex`); `GET /api/v1/casos/{id}/relacionados` pasa a resolver por `id_pago` (y devuelve `[]` si el caso no tiene identificador)». Añadir `RT-19` a los requisitos de CU-03.

### H-19 · MEDIO — CU-D89-09: el «próximo cambio» incluye el estado y a la vez lo excluye

**Evidencia.** Flujo principal 2 (`:390`) enumera «edición, cierre, cita, estado o despacho» (igual que RF-50, `incremento:48`, y DEC-IP-3, `propuesta:361`). A2 (`:398`) dice «(caso en estado terminal). **No** se reclasifica por un cambio de estado». A1 (`:397`) dice que cualquier cambio, aunque no toque los datos faltantes, reclasifica.

**Impacto.** A1 y A2 se contradicen para un caso terminal: ¿un cambio de estado en un caso CERRADO marcado reclasifica (A1) o no (A2)? Y con H-01, la fila ni siquiera podría actualizarse sin reclasificar.

**Corrección concreta.** Mover la excepción al flujo principal: «La reclasificación se dispara en edición, cierre, cita o despacho. Un cambio de estado **a** un estado terminal (`CERRADO`, `CANCELADO`, `ENRUTADO`) reclasifica; un cambio de estado en un caso **ya** terminal no lo hace y queda informado en MONITOREO como pendiente histórico (duda 2)». Añadir el escenario de la excepción.

### H-20 · BAJO — Estados precluidos por la unicidad del identificador

**Evidencia.** CU-D89-02 A2 (`:93`) «dos identificadores ya creados para el mismo número por datos históricos» y CU-D89-12 flujo 4 (`:501`) «identificadores duplicados por formato», frente a `numero … NOT NULL UNIQUE` (`propuesta:195`) y RNF-29.

**Impacto.** Son flujos defensivos que no pueden ocurrir tras el DDL (la migración inserta `SELECT DISTINCT`, `propuesta:269`) salvo en el inventario **previo** a la migración (`propuesta:262-265`). No testeables tras D-89.

**Corrección concreta.** Renombrar estos puntos como «conciliación previa a la migración (paso 1 del plan)» y quitarlos de los flujos del CU, o justificar explícitamente el escenario previo al `UNIQUE`.

### H-21 · BAJO — RT-18 sin caso de uso

**Evidencia.** Matriz de cobertura (`casos_uso_D89.md:564`) y nota (`:567-568`): RT-18 (script `scripts/migrar_d89_identificador_pago.py`, `incremento:66`) queda fuera de los CU «por ser una tarea de migración y no un objetivo de actor».

**Impacto.** Ninguno operativo: la excepción está declarada y es razonable. Se registra para que el conteo «sin huérfanos» no se lea como cobertura total.

**Corrección concreta.** Mantener la nota, o trazarlo a un CU de migración (CU-D89-13) con el escenario «simular → aplicar → verificar → reejecutar devuelve «ya migrada»» que exige la verificación de RT-18.

---

## Vacíos funcionales

Puntos que los 12 CU no cubren y que un test o una inspección puede exigir; varios ya están recogidos arriba (H-03, H-05, H-07, H-08, H-16) y el resto se listan aquí:

1. **Número nulo o vacío.** Ni CU-01 (col. 13 vacía) ni CU-02/CU-05 definen el caso «sin ningún número»: ¿se crea el caso con `telefono=NULL` e `id_pago=NULL`? ¿Se cuenta en `filas_sin_identificador_pago`? ¿Se avisa? Hoy la ingesta lo acepta sin más (`ingesta.py:139-141`, `_limpiar` devuelve `None`).
2. **Dos identificadores para el mismo número** y **un identificador compartido por dos centrales**: tratados solo como flujos defensivos (H-07, H-20) sin regla de resolución.
3. **Cambio del patrón `pago.serie_regex` con datos existentes.** No hay ningún CU ni requisito que defina qué pasa con los identificadores ya creados si CANTV cambia la serie (p. ej. a `70\d{8}|71\d{8}`): ¿se revalida `ck_ip_serie`? ¿quedan exentos los históricos? `propuesta:203` fija `CHECK (numero ~ '^70[0-9]{8}$')` **sin** parametrizar, lo que contradice DEC-IP-1 («patrón parametrizable»): con el `CHECK` fijo, cambiar `configuracion.pago.serie_regex` no cambia la restricción de BD.
4. **Concurrencia en la ingesta.** La resolución «buscar y, si no existe, crear» (`:85-86`) es una carrera clásica: dos ingestas simultáneas (o la ingesta y un alta manual) pueden violar el `UNIQUE` de `numero`. Ningún CU define el manejo (`ON CONFLICT … DO NOTHING` + reselección) ni el reintento.
5. **PII del titular.** `nombre_titular`/`direccion_principal` del identificador son PII de un tercero (el suscriptor) que hoy no aparece en el inventario de retención de §5.1 (`requerimientos.md:214-225`, que solo cubre `caso`, `actividad`, `evidencia`, `auditoria`, `notificacion`, `solicitud`, `mensaje`…). Falta la fila `identificador_pago` con su plazo y acción, y falta el derecho de supresión sobre él (RNF-18).
6. **Desempeño con 20 000 filas (RNF-33).** CU-01 cita el SLO solo como EARS (`:67`) y no hay criterio de aceptación medible ni regla de eficiencia (p. ej. resolución del identificador en un *mapa* precargado, no una consulta por fila). La ingesta actual inserta fila a fila (`routes_ingesta.py:166-175`); añadir una consulta por fila multiplica el costo.
7. **Casos en estado terminal (duda 2).** Además de H-19: cuanto un marcado se queda terminal sin regularizar, no se dice si cuenta en las métricas de RF-55, si bloquea su caso_especial o si debe poder cerrarse administrativamente.
8. **¿Puede el Super Usuario forzar una REPARACIÓN sin identificador (duda 1)?** Ver H-02: hoy el CU dice que sí, el `CHECK` dice que no.
9. **Borrado/limpieza de `[CONTACTO]` en `informacion`.** Ni al corregir el contacto (CU-05) ni al editar `informacion` se dice si el valor anterior se sustituye o se acumula; con varias correcciones, `informacion` acumula líneas obsoletas sin regla.
10. **`contacto_cliente` único por caso.** CU-01 A4 admite «más de un número de contacto en la fila» y sumarlos a `informacion`, pero `contacto_cliente` es una sola columna `varchar(60)` (`schema.sql:323`): no se define cuál de los números queda allí ni cómo se recuperan los demás estructuradamente (contradice el motivo declarado de DEC-IP-2: «se descarta el volcado a texto libre», `propuesta:228-229`).

## Verificado sin hallazgos

Comprobaciones que salieron correctas (para delimitar la cobertura de esta auditoría):

- **Cobertura de requisitos:** los 12 RF (45…56), los 5 RNF (29…33) y RT-17/RT-19 aparecen en al menos un CU; ningún CU carece de requisito. La única excepción es RT-18, declarada y razonada (H-21).
- **Consistencia entre matrices:** verifiqué las 12 filas de la matriz CU→requisito contra las 20 filas de la matriz requisito→CU y contra el campo «Requisitos» de cada ficha: **coinciden todas** (RF-45: CU-01/02/07/12; RF-46: CU-01/05/06; … RT-19: CU-05/07). No hay requisitos citados en una matriz y ausentes en la otra.
- **Estructura de los CU:** los 12 tienen actor, objetivo, precondición, postcondición, flujo principal y flujos alternativos, y el actor es coherente con el objetivo (un CU por objetivo de actor). Los actores `SIS-ING`, `SIS-CLA`, `SUP`, `ADM`, `TEC` existen o están definidos en el incremento §6 (`incremento:92-98`).
- **Uso correcto de EARS:** las restricciones de sistema están redactadas en EARS y no en Gherkin (CU-01 `:64-68`, CU-02 `:111-113`, CU-04 `:192-194`, CU-07 `:329-331`), y son restricciones del sistema, no acciones de usuario.
- **Simetría con el código en la semántica invertida de D-88:** confirmado que el endpoint actual escribe en `caso.telefono` con serie 700/701/702 (`app/schemas/casos.py:241-253`, `app/api/routes_casos.py:677-679`) — la motivación del incremento es real.
- **`tiene_id_averia` siempre verdadero:** confirmado (`app/api/routes_especiales.py:191`), coincide con la brecha B3-3 de la propuesta.
- **Estados terminales:** los tres estados usados en CU-05/06 (`CERRADO`, `CANCELADO`, `ENRUTADO`) coinciden exactamente con el servidor (`app/api/routes_casos.py:671`) y con la APK (`acciones_caso.dart:24`).
- **Comportamiento offline de la APK:** CU-06 A1/A2 son consistentes con el mecanismo vigente: `_convieneEncolar` encola fallos de red, 403 y 5xx (`operaciones_service.dart:297-300,389-401`), y el caso sigue visible con `pendiente_sync`.
- **Búsqueda y deduplicación vigentes:** la deduplicación por `id_averia` que cita CU-01 paso 2 y A5 existe (`routes_ingesta.py:61-63`) y la ingesta no aborta por filas sin número (diseño que RF-56/RN-IP-09 aprovechan). `caso.id_averia` es `UNIQUE` y `caso.telefono` **no** lo es (`schema.sql:290,716`), por lo que la relación 1 IP → N casos (RF-45) es viable sin conflicto de esquema.
- **Convención de migración:** RT-18 (script idempotente en `scripts/`) coincide con la práctica real del proyecto (`scripts/migrar_d73_sync.py`, `migrar_d81_sync_mensajeria.py`, `migrar_d82_falla_campo.py`, `migrar_d88_contacto_cos.py`); no existe `db/migrations/`, de modo que la ausencia de Alembic en RT-18 **no** es un defecto introducido por D-89 aunque RNF-24 lo mencione.
- **Numeración:** RF-45…/RNF-29…/RT-17… continúa correctamente la serie en uso (RF-44 / RNF-28 / RT-16, D-81).
- **Denominaciones internas:** las referencias a CU-D89-nn, RF-nn, RNF-nn, RT-nn, RN-IP-nn y DEC-IP-nn son correctas y los enlaces entre los tres documentos existen (`incremento_D89_identificador_pago.md`, `propuesta_identificador_pago.md`).

## Veredicto final

**NO APTO para pasar a desarrollo en su estado actual (v0.1).** Los casos de uso tienen la estructura y la trazabilidad nominal correctas, pero **no son implementables** en la regla central del incremento (REPARACIÓN→REFERIDO) mientras no se corrijan:

**Condiciones de paso a desarrollo (obligatorias):**
1. **H-01** Reformular `ck_reparacion_con_ip` eximiendo `categoria='REFERIDO'` y declarar en CU-08/CU-09 el `tipo_caso` resultante y la reclasificación en el mismo `UPDATE` (con el escenario de BD propuesto).
2. **H-02** Resolver la duda 1: eliminar el forzado de A3 (recomendado) o elevarlo a decisión con su propio mecanismo y criterio.
3. **H-03/H-04/H-05** Fijar en los CU: valor de `caso.telefono` para números no-70\*, RBAC de la edición del identificador (ADMIN/SUPERVISOR) y contrato de la petición + compatibilidad de la APK `1.1.0+8`.
4. **H-06/H-09** Acotar el contacto a la columna 16 y resolver la excepción EMPRESA/GOBIERNO.
5. **H-07** Decidir la unicidad del identificador entre centrales y añadir RLS a `identificador_pago` (RNF-21), cerrando la duda 3.
6. **H-08/H-10** Reescribir los Gherkin no testeables y cubrir los artefactos de RF-53.

**Recomendadas (no bloquean el arranque, sí la aceptación):** H-11 a H-19. **Documentales:** H-20, H-21.

Fuentes citadas: `RepoTecnico/casos_uso/casos_uso_D89.md` (todas las líneas indicadas) · `RepoTecnico/incremento_D89_identificador_pago.md` (§3 RF-45…56, §4 RNF-29…RT-19, §5, §6, §8) · `RepoTecnico/propuesta_identificador_pago.md` (§1.1-1.3, §2.2-2.3, §3, §4, §8) · `RepoTecnico/requerimientos.md` (RF-30/31/32/36, RNF-18/21/24, §5.1, §5.2, RT-05) · `RepoTecnico/db/schema.sql:267-393,714-766` · `app/api/routes_casos.py:49-51,173-311,651-694,741-809` · `app/api/routes_especiales.py:72-101,165-213` · `app/api/routes_ingesta.py:40-118,138-191` · `app/api/routes_monitoreo.py:25-58` · `app/api/routes_sistemas.py:20-60` · `app/api/routes_despachos.py:460,603` · `app/schemas/casos.py:118-161,233-263` · `app/services/ingesta.py:26-76,139-152,171-224` · `app/services/sistemas.py:308,353` · `app/models/caso_entities.py:52-53,75-78,114-115` · `app/web/src/App.tsx:45` · `app/web/src/api/client.ts:1035` · `app/web/src/components/FichaCaso.tsx:14,121-162,317-323,675-685` · `app/web/src/pages/Casos.tsx:63-69,132-173` · `app_movil/lib/features/casos/acciones_caso.dart:24,58-89` · `app_movil/lib/features/casos/operaciones_service.dart:290-300,352-405` · `app_movil/lib/features/casos/caso_detalle_screen.dart:95-128,273-296`.

## Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| v1.0 | 2026-10-08 | Auditoría adversarial de `casos_uso_D89.md` v0.1: 21 hallazgos (2 CRÍTICOS, 8 ALTOS, 9 MEDIOS, 2 BAJOS), vacíos funcionales y verificación sin hallazgos. |

---

## Incorporación de los hallazgos (estado al 2026-10-08)

Todas las condiciones obligatorias del veredicto se resolvieron en la **v0.2** de los
cuatro documentos del incremento (`propuesta_identificador_pago.md` **v1.1**,
`incremento_D89_identificador_pago.md` **v0.2**, `casos_uso/casos_uso_D89.md`
**v0.2** y `documento_tecnico_D89.md` **v0.2**).

| # | Severidad | Resolución |
|---|---|---|
| H-01 | CRÍTICO | `tipo_caso` admite **`REFERIDO`** (ALTER del CHECK), **trigger** `trg_caso_reparacion_a_referido` que convierte la fila **antes** de validar, y `CHECK ck_reparacion_con_ip` como red de seguridad: las filas marcadas ya no se congelan. Declarado en CU-08/CU-09, en el DDL (RT-17) y en el árbol de decisión |
| H-02 | CRÍTICO | Se **elimina el forzado** (DEC-IP-5): CU-07/A3 y CU-08/A3 devuelven `409` con la oferta de registrarlo como REFERIDO; coherente con RNF-29 y con el EARS del CU-07 |
| H-03 | ALTO | CU-01 paso 6: si la columna 13 no cumple el patrón, **`caso.telefono = NULL`** y el número va a contacto; añadido el Gherkin correspondiente |
| H-04 | ALTO | CU-05/A1: el identificador lo edita **ADMIN/SUPERVISOR/SUPER** (TECNICO `403`), con el Gherkin del SUPERVISOR |
| H-05 | ALTO | Esquema `ContactoUpdate{direccion?, contacto?, id_pago?}` en el documento técnico §5; el campo legado `telefono` se interpreta **siempre** como contacto (**sin heurística**: un 70\* → `422`); RNF-30 reescrito (lectura 200 / escritura de 70\* 422) |
| H-06 | ALTO | CU-01 pasos 6-7 y A4: el contacto sale **solo** de las columnas 13 y 16; las 78/79 son del técnico (RN-IP-02) |
| H-07 | ALTO | **DEC-IP-6 = único GLOBAL** (decisión del usuario): `UNIQUE (numero)`, `id_central` = central de origen y **RLS** que permite leer la ficha a la central de origen o a cualquier central con casos enlazados; histórico y reincidencia **globales** informando los casos visibles; Gherkin de reutilización entre centrales |
| H-08 | ALTO | **DEC-IP-7 = conversión** (decisión del usuario): un 70\* tecleado en el campo de contacto **se registra como identificador del caso** (no como contacto) con auditoría `CONTACTO_A_IDENTIFICADOR`; Gherkin reescritos con dos identificadores distintos y esa regla |
| H-09 | ALTO | CU-08/A1: el caso **siempre** deja de ser REPARACIÓN (`tipo_caso='REFERIDO'`); `categoria`/`clasificacion` conservan EMPRESA/GOBIERNO y no cuentan como reparación reclasificada |
| H-10 | ALTO | CU-03 cubre ficha, ficha rápida, listado de CASOS, agenda y **despacho impreso**; CU-06 cubre la APK; Gherkin de rótulos múltiples |
| H-11 | MEDIO | `ingesta_lote` gana `filas_sin_identificador_pago`, `filas_con_contacto` y `avisos jsonb`; contrato `GET /ingesta/lotes/{id}` en RT-19; CU-11 implementable |
| H-12 | MEDIO | **RF-57** (ciclo de vida del identificador) + RN-IP-12; CU-02/A3 trazado a RF-57 |
| H-13 | MEDIO | Actores **`ADM`** y **`SUPER`** separados; `GET /api/v1/auditoria` + página AUDITORÍA declarados en RT-19; SISTEMAS→BD sigue siendo solo SUPER |
| H-14 | MEDIO | **RT-20**: el rechazo del lote con encabezado inválido se declara como **corrección** alineada con `interfaz_csv_origen.md` §6.2 (hoy `routes_ingesta.py:177` marca `OK`), con su Gherkin |
| H-15 | MEDIO | CU-10/A2: el TÉCNICO **no** accede a la vista de reincidencia (`403`); la actualización de la matriz §5.2 para su MONITOREO acotado queda en D-94 |
| H-16 | MEDIO | Tabla de **enmascaramiento por rol** en CU-03 (el identificador **no** se enmascara a quien tiene acceso al caso; el titular sí al TÉCNICO `A*** B***`) + RNF-31 reescrito |
| H-17 | MEDIO | CU-04 con **una sola regla**: patrón → coincidencia exacta + id de avería; sin patrón y ≥ 3 dígitos → **prefijo en ambos espacios** con grupos separados; < 3 dígitos → pide completar |
| H-18 | MEDIO | RT-19 ampliado: `POST /api/v1/casos` y `PATCH /api/v1/casos/{id}` con `id_pago`, `relacionados` por identificador y `GET /auditoria` |
| H-19 | MEDIO | CU-09: la excepción de estados terminales está en el flujo principal (cambio **a** terminal reclasifica; cambio **en** terminal no) con su Gherkin |
| H-20 | BAJO | CU-02/A2 y CU-12/paso 4 marcados como **conciliación previa a la migración** (paso 6 del plan) |
| H-21 | BAJO | **CU-13** traza RT-18 (simular → aplicar → verificar → reejecutar) |

**Vacíos funcionales:** todos incorporados — número nulo (CU-01/A6), unicidad y
multi-central (CU-02/A1-A2, DEC-IP-6), patrón configurable frente al `CHECK` de
formato (RT-17), concurrencia (`ON CONFLICT` + `SELECT`, §4.2 del técnico),
retención del titular (`requerimientos.md` §5.1, fila nueva de `identificador_pago`),
desempeño con criterio medible (CU-01 EARS), estados terminales (CU-09/A2),
forzado (DEC-IP-5), limpieza de `[CONTACTO]` (CU-05 paso 3 + SQL de reemplazo) y
varios contactos por caso (CU-01/A4 + §4.3 del técnico).

**Estado del veredicto:** las condiciones obligatorias 1-6 quedan **cumplidas en
v0.2/v0.3**; las decisiones DEC-IP-5, DEC-IP-6 y DEC-IP-7 fueron **confirmadas por el
usuario** el 2026-10-08 (sin forzado · único global con RLS de la ficha · el 70\* en el
contacto se convierte en identificador), por lo que el documento queda **APTO para
arrancar D-89**.
