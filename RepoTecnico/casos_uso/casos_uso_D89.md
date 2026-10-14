# Casos de uso — Incremento **D-89…D-94** · El identificador de pago (70\*) como eje

| Campo | Valor |
|---|---|
| Documento | Casos de uso bajo criterio de **analista funcional** (un CU por objetivo de actor) |
| Estado | **v0.3 — auditoría incorporada + DEC-IP-5/6/7 cerradas** |
| Fecha | 2026-10-08 |
| Requisitos | [`../incremento_D89_identificador_pago.md`](../incremento_D89_identificador_pago.md) (RF-45…RF-57 · RNF-29…RNF-33 · RT-17…RT-20) |
| Decisiones | **DEC-IP-1…7** ([`../propuesta_identificador_pago.md`](../propuesta_identificador_pago.md) §8) |
| Auditoría | [`../auditoria_D89_casos_uso.md`](../auditoria_D89_casos_uso.md) (v1.0) · diseño: [`../documento_tecnico_D89.md`](../documento_tecnico_D89.md) |
| Notación | Criterios funcionales en **Gherkin**; restricciones del sistema en **EARS**; 100 % testeables |

**Actores:** `SIS-ING` Sistema de ingesta · `SIS-CLA` Sistema de clasificación ·
`SUP` Supervisor · `ADM` Administrador · `SUPER` Super Usuario · `TEC` Técnico.

> **Cambios de la v0.2 (auditoría):** el REFERIDO es `tipo_caso='REFERIDO'` y un
> **trigger** garantiza que ninguna fila histórica quede atrapada (H-01); **no
> existe el forzado** de REPARACIÓN (H-02); `caso.telefono` queda `NULL` cuando el
> número no es 70\* (H-03); el contacto solo sale de las **columnas 13 y 16**
> (H-06); el identificador es **único global** con RLS de la ficha (H-07 + DEC-IP-6);
> **un 70\* tecleado como contacto se registra como identificador del caso** (H-08 +
> DEC-IP-7); la edición del identificador es de
> **ADMIN/SUPERVISOR** (H-04); contrato de la edición de contacto **sin heurística**
> (H-05); criterios reescritos y superficies de RF-53 cubiertas (H-10).

---

## CU-D89-01 · Ingestar el archivo diario clasificando los números del reporte

| | |
|---|---|
| **Actor** | `SIS-ING` (lo dispara `SUP` desde INGESTA) |
| **Objetivo** | Incorporar el archivo diario dejando cada número en su sitio: 70\* como identificador de pago, la columna de contacto como número de contacto |
| **Precondición** | Existe configuración de central y el patrón `pago.serie_regex`; hay un archivo `detalle_averias_gpon_<fecha>.csv` con las 80 columnas (RT-05) |
| **Postcondición** | Los reportes nuevos están creados y enlazados a su identificador (si lo traen); el lote informa contadores y avisos sin abortar la carga |
| **Requisitos** | RF-45, RF-46, RF-47, RF-56, RNF-29, RNF-33, RT-05, RT-17, RT-20 |

**Flujo principal**

1. `SUP` carga el archivo en INGESTA; el sistema lo decodifica (ISO-8859-1) y lo parsea por posición.
2. **Validación del encabezado (RT-20):** si no trae **80 columnas**, el lote queda en `ERROR` (`filas_leidas = 0`, 0 casos, `422`) y **no** se ingesta nada.
3. El sistema filtra las filas de la central configurada y descarta las ya conocidas por `id_averia` (RF-22).
4. Para cada fila nueva, el sistema **normaliza** el valor de la **columna 13** y el de la **columna 16** (RF-47).
5. Si el valor normalizado de la columna 13 cumple `pago.serie_regex`, el sistema lo trata como **identificador de pago** y ejecuta CU-D89-02.
6. Si **no** cumple: `caso.telefono = NULL`, el número pasa a **número de contacto** (`contacto_cliente`) y se **suma** a `informacion` como `[CONTACTO] <numero>` (idempotente).
7. El valor de la **columna 16** se guarda siempre como **número de contacto** (el vigente) y se suma a `informacion` igual que en el paso 6. Los números de las **columnas 78/79** son del técnico y **no** se tocan.
8. El sistema crea el caso, lo enlaza a su identificador (si lo tiene) y actualiza los contadores del lote y su `avisos`.
9. La pantalla INGESTA muestra el resumen: filas leídas, nuevas, duplicadas, descartadas, **con identificador**, **sin identificador** y **con contacto**.

**Flujos alternativos**

- **A1 (encabezado ≠ 80 columnas).** Lote en `ERROR` sin casos (paso 2, RT-20; hoy el parser solo avisa, ver `routes_ingesta.py:177`).
- **A2 (fila sin `id_averia`).** Se cuenta como malformada y se descarta; el lote lo informa.
- **A3 (columna 13 que no cumple el patrón).** No se aborta: caso **sin identificador**, `telefono = NULL`, número a contacto, `filas_sin_identificador_pago += 1` (RF-56).
- **A4 (varios contactos en la columna 16, separados por `/`, `;` o `,`).** Todos se normalizan; el **primero** queda en `contacto_cliente` y los demás se suman a `informacion` separados por `|`, **sin duplicar** los ya presentes.
- **A5 (reingreso del mismo archivo).** La deduplicación por `id_averia` no crea casos nuevos y la suma a `informacion` es idempotente (no se duplica la marca).
- **A6 (fila sin ningún número).** El caso se crea con `telefono = NULL`, `id_pago = NULL` y `contacto_cliente = NULL`; se cuenta en `filas_sin_identificador_pago` y se informa en los avisos.

**Criterios de aceptación**

```gherkin
Dado un archivo diario con 100 reportes, 97 con 70* y 3 con un número distinto en la columna 13
Cuando el Supervisor ejecuta la ingesta
Entonces se crean 100 casos nuevos
Y los 97 con 70* quedan con identificador de pago enlazado
Y los 3 restantes quedan con telefono NULL, id_pago NULL, su número en contacto_cliente
Y el lote informa filas_sin_identificador_pago = 3 sin abortar la carga
```

```gherkin
Dado un caso ingestado cuyo origen trae "701-400.0848" en la columna 13 y "0422-310-9000" en la 16
Cuando se consulta el caso
Entonces el identificador de pago es "7014000848"
Y el número de contacto es "4223109000"
Y el campo informacion contiene "[CONTACTO] 4223109000"
Y el campo Telefono Oficina del técnico no aparece en informacion
```

```gherkin
Dado un archivo con 79 columnas en su encabezado
Cuando el Supervisor intenta cargarlo
Entonces el lote queda en estado ERROR con 0 casos creados
Y la API responde 422 con el motivo
```

**Restricciones (EARS)**

- Mientras el archivo no tenga exactamente 80 columnas, el sistema **rechazará** el lote completo (RT-20).
- El sistema **deberá** resolver el identificador sin degradar el SLO de ingesta: **20 000 filas en ≤ 5 min (p95)**, con una sola consulta por número distinto.
- Si el patrón `pago.serie_regex` no está configurado, entonces el sistema **usará** `^70[0-9]{8}$`.

---

## CU-D89-02 · Resolver y registrar el identificador de pago de un reporte

| | |
|---|---|
| **Actor** | `SIS-ING` |
| **Objetivo** | Garantizar **un solo** identificador por número y central, y enlazar a él todos sus reportes (relación 1 → N) |
| **Precondición** | El caso se está creando o editando con un número que cumple el patrón |
| **Postcondición** | Existe a lo sumo un `identificador_pago` para ese número **en esa central** y el caso queda enlazado (`caso.id_pago`) |
| **Requisitos** | RF-45, RF-57, RNF-29, RNF-31, RT-17 |

**Flujo principal**

1. El sistema normaliza el número (RF-47).
2. Ejecuta `INSERT … ON CONFLICT (numero) DO NOTHING` y, a continuación, `SELECT` del identificador por `numero` (mismo resultado si lo creó otra transacción; la ficha es **única global**).
3. Si no existía, guarda los datos conocidos del titular (`nombre_titular`, `direccion_principal`) tomados del reporte; si existía, los actualiza solo si el reporte trae valor.
4. Enlaza `caso.id_pago` y mantiene `caso.telefono` sincronizado como **alias** (DEC-IP-4).
5. Mantiene el identificador en su central: **no** se reutiliza el de otra central (RLS).

**Flujos alternativos**

- **A1 (el número ya existe, creado por otra central).** Se **reutiliza la misma ficha** (única global, DEC-IP-6): el caso se enlaza a ella, `id_central` conserva la **central de origen** y la central del caso puede leerla por RLS al tener casos enlazados (no se crea una segunda ficha).
- **A2 (conciliación previa a la migración: dos identificadores para el mismo número por datos históricos).** Solo puede ocurrir **antes** de crear `uq_ip_numero`; el script lo lista (paso 6 de la migración) y el sistema no crea un tercero.
- **A3 (intento de baja o suspensión con casos vigentes).** `409` con el detalle de los casos vigentes; queda en `auditoria` (RF-57, RN-IP-12).

**Criterios de aceptación**

```gherkin
Dado un identificador de pago 7014000848 ya registrado en la central A con 2 casos
Cuando se ingesta un tercer reporte con ese número en la central A
Entonces el caso nuevo se enlaza al identificador existente
Y el sistema no crea un segundo identificador para el mismo número y central
Y el identificador sigue teniendo 3 casos
```

```gherkin
Dado un identificador 7014000848 en la central A con casos vigentes
Cuando el Administrador intenta darlo de baja
Entonces el sistema responde 409 con los casos que lo impiden
Y el estado del identificador sigue siendo ACTIVO
```

```gherkin
Dado un identificador 7014000848 creado por la central A
Cuando se ingesta un reporte del mismo número en la central B
Entonces el caso de la central B se enlaza a la MISMA ficha 7014000848
Y no se crea una segunda ficha
Y la central B puede leer la ficha porque tiene un caso enlazado
```

**Restricciones (EARS)**

- El sistema **deberá** impedir que existan dos filas de `identificador_pago` con el mismo `numero` (ficha **única global**).
- El sistema **deberá** permitir la lectura de la ficha a su central de origen y a cualquier central con casos enlazados, y **solo** a ellas (RLS).

---

## CU-D89-03 · Consultar el histórico y el rótulo del identificador de pago

| | |
|---|---|
| **Actor** | `SUP`, `ADM`, `SUPER`, `TEC` |
| **Objetivo** | Ver todos los reportes asociados a un identificador —y el número rotulado correctamente en ficha, listados, ficha rápida, agenda y despacho impreso— para reconocer reincidencias y antecedentes |
| **Precondición** | El usuario está autenticado y tiene acceso al caso |
| **Postcondición** | Se muestran el identificador, su histórico y sus rótulos, sin modificar datos |
| **Requisitos** | RF-48, RF-53, RF-54, RNF-31, RT-19 |

**Flujo principal**

1. El usuario abre la ficha de un caso y entra en la pestaña **Histórico**.
2. El sistema resuelve el caso → `id_pago` (nunca por igualdad de texto) y devuelve `[]` si el caso no tiene identificador.
3. El sistema lista los demás casos de ese identificador: id de avería, fecha de reporte, problema reportado y justificación del cierre.
4. Si el identificador acumula **≥ 2 reportes** en la ventana configurada, muestra el indicador **«Reincidente»** referido **a la central del usuario**.
5. La cabecera y los artefactos que muestran el número lo rotulan **«Identificador de pago (70\*)»**, y el resto como **«Número de contacto»** (RF-53): ficha, ficha rápida, listado de CASOS, agenda y despacho impreso.
6. Los datos personales se ajustan al rol según la tabla de §Enmascaramiento.

**Flujos alternativos**

- **A1 (caso sin identificador de pago).** Muestra «Sin identificador de pago» e indica que el número disponible es de contacto.
- **A2 (identificador sin otros casos).** Muestra «Sin antecedentes para este identificador».
- **A3 (rol sin permiso sobre el titular).** El titular se muestra enmascarado; el número del identificador **no** se enmascara a quien tiene acceso al caso (RNF-31).

**Enmascaramiento por rol (H-16)**

| Dato | SUPER / ADMIN / SUPERVISOR | TECNICO |
|---|---|---|
| Identificador de pago (70\*) | completo | completo (lo necesita en campo) |
| Número de contacto | completo | completo |
| `nombre_titular` | completo | **enmascarado** (`A*** B***`) |
| Otro rol / caso fuera de su alcance | `403` | `403` |

**Criterios de aceptación**

```gherkin
Dado un caso A enlazado al identificador 7014000848 con 3 casos (uno cerrado con justificación)
Y un caso B sin identificador
Cuando el Supervisor abre la pestaña Histórico del caso A
Entonces ve los 3 casos enlazados a 7014000848 con su fecha y problema reportado
Y ve la justificación del caso cerrado
Y ve el indicador «Reincidente»
Y el caso B no aparece
```

```gherkin
Dado un caso enlazado al identificador 7014000848 con contacto 4223109000
Cuando el Supervisor abre la ficha, la ficha rápida, el listado de CASOS, la agenda y el despacho impreso
Entonces el número 7014000848 aparece rotulado «Identificador de pago (70*)»
Y el número 4223109000 aparece rotulado «Número de contacto»
Y ningún artefacto rotula el 70* como «Teléfono»
```

```gherkin
Dado un usuario con rol TECNICO y un caso enlazado a 7014000848 con titular "ANA BEATRIZ"
Cuando abre la ficha del caso
Entonces ve el identificador 7014000848 completo
Y ve el titular como "A*** B***"
```

```gherkin
Dado un identificador 7014000848 con un caso en la central A y otro en la central B
Cuando un Supervisor de la central A abre el histórico
Entonces ve la ficha del identificador (única y global)
Y ve solo el caso de la central A
Y el indicador de reincidencia informa «2 reportes en total: 1 visible en su central»
```

---

## CU-D89-04 · Buscar casos por identificador de pago o por número de contacto

| | |
|---|---|
| **Actor** | `SUP`, `TEC` |
| **Objetivo** | Localizar casos por cualquiera de los dos números, sabiendo cuál es cuál |
| **Precondición** | Sesión iniciada |
| **Postcondición** | Se listan los casos coincidentes agrupados y rotulados por tipo |
| **Requisitos** | RF-51, RF-53, RNF-30 |

**Flujo principal**

1. El usuario escribe un término (número o id de avería) en el buscador global, el de PANEL o el localizador de AGENDA.
2. El sistema lo normaliza y decide **siempre por la misma regla**:
   - Si el término **cumple** el patrón del identificador → grupo «Identificador de pago» por coincidencia y, además, grupo «ID de avería».
   - Si **no** lo cumple y tiene **≥ 3 dígitos** → busca **en ambos espacios** por **prefijo** (identificador y número de contacto) y muestra los grupos «Identificador de pago (coincidencia parcial)» y «Número de contacto».
   - Si lo que parece es un id de avería → grupo «ID de avería».
3. El encabezado informa qué búsqueda se hizo («coincidencia parcial de 4 dígitos»).
4. Al abrir un resultado, la ficha muestra el identificador y el contacto por separado (CU-D89-03).

**Flujos alternativos**

- **A1 (el término coincide con dos grupos).** Se muestran **grupos separados** y nunca se mezclan resultados; cada renglón indica por qué coincidió.
- **A2 (sin coincidencias).** «Sin resultados para ese número» mostrando el término normalizado usado.
- **A3 (menos de 3 dígitos).** Se pide completar el número; no se busca por prefijo.

**Criterios de aceptación**

```gherkin
Dado un caso enlazado al identificador 7014000848
Y un caso cuyo contacto_cliente es 70140008480
Cuando el Supervisor busca "7014"
Entonces aparecen dos grupos: «Identificador de pago (coincidencia parcial)» y «Número de contacto»
Y el encabezado informa «búsqueda por prefijo de 4 dígitos»
```

```gherkin
Dado un usuario en el buscador global
Cuando escribe "70"
Entonces el sistema no busca por prefijo
Y pide completar al menos 3 dígitos
```

**Restricciones (EARS)**

- El sistema **deberá** normalizar el término de búsqueda antes de compararlo (sin guiones, espacios ni prefijo internacional).
- El sistema **deberá** aplicar el mismo orden de decisión (patrón → prefijo en ambos espacios) para el mismo término, sin depender del artefacto desde el que se busque.

---

## CU-D89-05 · Corregir el número de contacto desde la web

| | |
|---|---|
| **Actor** | `SUP`, `ADM`, `SUPER` |
| **Objetivo** | Actualizar el número de contacto del caso sin tocar el identificador de pago |
| **Precondición** | El caso no está en estado terminal (`CERRADO`, `CANCELADO`, `ENRUTADO`) |
| **Postcondición** | `contacto_cliente` actualizado, la marca `[CONTACTO]` **reemplazada** en `informacion` y traza en `auditoria`; el identificador no cambia |
| **Requisitos** | RF-46, RF-52, RN-IP-11, RNF-30, RNF-32, RT-19 |

**Flujo principal**

1. El usuario abre la ficha del caso y edita el campo **Número de contacto** (esquema `{direccion?, contacto?, id_pago?}`).
2. El sistema normaliza el valor y lo valida como **número de contacto** (no exige el patrón del identificador).
3. Guarda `caso.contacto_cliente` y **reemplaza** la marca anterior en `informacion`: `[CONTACTO] <nuevo>` (no acumula números obsoletos).
4. Registra la traza (`datos_antes`/`datos_despues`, acción `CONTACTO_CAMPO`) y refresca la ficha.
5. El identificador de pago se muestra en solo lectura con su rótulo.

**Flujos alternativos**

- **A1 (el usuario edita el identificador de pago).** Solo **ADMIN, SUPERVISOR (y SUPER)**, validando `pago.serie_regex`; un TÉCNICO recibe `403` (y el campo se muestra deshabilitado).
- **A2 (el valor del contacto cumple el patrón del identificador).** El sistema lo **registra como identificador del caso**: resuelve/crea la ficha, la enlaza, **no** lo guarda como contacto y responde `200` con «7014000848 se registró como identificador de pago del caso» (RN-IP-11/DEC-IP-7). Si el caso ya tenía un contacto válido distinto, se conserva. La acción queda en `auditoria` (`CONTACTO_A_IDENTIFICADOR`).
- **A3 (valor no numérico o vacío).** `422` «Indique un número de contacto válido».
- **A4 (caso en estado terminal).** `409` «El caso está CERRADO: no admite cambios de contacto».
- **A5 (identificador con formato inválido).** `422` con el patrón esperado; ni el contacto ni el identificador cambian.
- **A6 (petición de una APK antigua que envía `telefono`).** Se interpreta como número de contacto; si trae un 70\*, se aplica A2 (se enlaza como identificador) **sin** corromper `contacto_cliente` ni `informacion` (RNF-30).

**Criterios de aceptación**

```gherkin
Dado un caso con identificador 7014000848 y contacto 4223109000
Cuando el Supervisor cambia el contacto a "0412-555-6677"
Entonces el contacto queda como 4125556677
Y el identificador sigue siendo 7014000848
Y informacion contiene "[CONTACTO] 4125556677" una sola vez
Y ya no contiene la marca anterior "[CONTACTO] 4223109000"
Y la auditoría guarda el valor anterior y el nuevo
```

```gherkin
Dado un caso sin identificador y con contacto 4223109000
Cuando el Supervisor escribe "7014-000.848" en el campo Número de contacto
Entonces el caso queda enlazado al identificador 7014000848
Y contacto_cliente sigue siendo 4223109000
Y informacion no contiene "[CONTACTO] 7014000848"
Y la auditoría registra la acción CONTACTO_A_IDENTIFICADOR
```

```gherkin
Dado un usuario con rol SUPERVISOR y un caso con identificador 7014000848
Cuando cambia el identificador a "700 111-2233"
Entonces el sistema responde 200 y el identificador queda como 7001112233
Y la auditoría registra el valor anterior y el nuevo
```

```gherkin
Dado un usuario con rol TECNICO
Cuando envía el campo id_pago en la edición de contacto
Entonces el sistema responde 403 y no modifica el caso
```

---

## CU-D89-06 · Corregir el número de contacto desde la APK (campo)

| | |
|---|---|
| **Actor** | `TEC` |
| **Objetivo** | Corregir el contacto del caso en la visita, sin conexión y sin romper el identificador |
| **Precondición** | El caso está descargado en el dispositivo y no está en estado terminal |
| **Postcondición** | El cambio se refleja de inmediato en local, queda pendiente de sincronizar y viaja en la CARGA |
| **Requisitos** | RF-46, RF-52, RN-IP-11, RNF-30, RNF-32 |

**Flujo principal**

1. El técnico abre la ficha y pulsa **Editar**.
2. El diálogo muestra **Dirección** y **Número de contacto**; el **Identificador de pago** aparece en la **cabecera**, en solo lectura, rotulado «Identificador de pago (70\*)».
3. El técnico escribe el número; la validación local acepta cualquier número normalizado (ya no exige la serie 700/701/702) y, si el valor cumple el patrón del identificador, lo trata como **identificador del caso** (no como contacto) y lo indica en el diálogo.
4. El cambio se aplica en SQLite (escritura optimista: `contacto_cliente` + reemplazo de la marca en `informacion`) y la ficha lo muestra con el distintivo **«Por sincronizar»**.
5. En la CARGA, el sistema envía `{contacto: <número>}` a `PATCH /casos/{id}/contacto` y limpia el distintivo al confirmarse.

**Flujos alternativos**

- **A1 (sin red).** El cambio queda en la cola y se envía cuando haya conexión; el caso sigue visible con el contacto nuevo.
- **A2 (403 del backend por rol).** El lote se **encola** (no se pierde) y se informa al técnico.
- **A3 (el técnico escribe un 70\* en el contacto).** El sistema lo registra como **identificador del caso** y responde `200` con el mensaje informativo; la ficha muestra el identificador en la cabecera y el contacto anterior se conserva (A2 de CU-05).
- **A4 (APK `1.1.0+8` sin actualizar).** Sigue **leyendo** con normalidad; al enviar un 70\* como contacto, el servidor lo **enlaza como identificador** (no lo guarda como contacto) y no corrompe la ficha (RNF-30). La edición plena del contacto y el rótulo llegan con la APK de **D-93**.

**Criterios de aceptación**

```gherkin
Dado un técnico sin conexión con un caso que tiene contacto 4223109000 e identificador 7014000848
Cuando escribe el contacto "0414-222-3344"
Entonces la APK acepta el número sin exigir la serie 700/701/702
Y la ficha muestra 4142223344 con el distintivo «Por sincronizar»
Y al recuperar la red el cambio llega al servidor
Y el identificador de pago del caso no cambia
```

```gherkin
Dado un técnico en la ficha de un caso
Cuando abre el diálogo de edición
Entonces solo puede editar Dirección y Número de contacto
Y el Identificador de pago se muestra en la cabecera como «Identificador de pago (70*)» en solo lectura
Y la cabecera no lo rotula como «Teléfono»
```

---

## CU-D89-07 · Registrar una REPARACIÓN con identificador de pago y ID de avería

| | |
|---|---|
| **Actor** | `SUP`, `ADM`, `SUPER` |
| **Objetivo** | Dar de alta una reparación legítima, con sus dos claves obligatorias |
| **Precondición** | Existe el identificador de pago (o se crea en el alta) y un `id_averia` real |
| **Postcondición** | Caso creado con `tipo_caso='REPARACION'`, `id_pago` informado e `id_averia` no sintético |
| **Requisitos** | RF-45, RF-49, RNF-29, RT-19 |

**Flujo principal**

1. El usuario abre el alta manual (`POST /api/v1/casos`) y elige `tipo_caso = REPARACION`.
2. El sistema exige el **Identificador de pago**: valida el patrón y, si ya existe en la central, **autocompleta** titular y dirección conocidos.
3. El sistema exige el **ID de AVERÍA** y verifica que no exista ya (RF-22).
4. El sistema crea el caso, lo enlaza al identificador y registra la bitácora.
5. La ficha muestra el identificador rotulado y el contacto como dato secundario.

**Flujos alternativos**

- **A1 (falta el identificador de pago).** Se aplica CU-D89-08: el caso **no** se crea como REPARACIÓN.
- **A2 (falta el ID de avería).** Igual que A1.
- **A3 (intento de forzar una REPARACIÓN sin requisitos).** **No existe el forzado para ningún rol** (DEC-IP-5): el sistema responde `409` «una REPARACIÓN exige identificador de pago (70\*) e id de avería real» y ofrece registrarlo como caso especial REFERIDO.
- **A4 (`id_averia` ya existente).** `409` «Ya existe un caso con ese id de avería» y se ofrece abrir el caso.
- **A5 (identificador con formato inválido).** `422` con el patrón configurado y un ejemplo válido.
- **A6 (`tipo_caso = CONSTRUCCION`).** No se exige identificador de pago.

**Criterios de aceptación**

```gherkin
Dado un Supervisor en el alta manual
Cuando registra una REPARACION con identificador 7014000848 e id de avería "AV-99812"
Entonces el caso se crea como REPARACION
Y queda enlazado al identificador 7014000848
Y la ficha muestra «Identificador de pago (70*)»
```

```gherkin
Dado un Supervisor que intenta registrar una REPARACION sin identificador de pago
Cuando confirma el alta
Entonces el sistema responde 409 con «una REPARACIÓN exige identificador de pago (70*) e id de avería real»
Y ofrece registrarlo como caso especial REFERIDO
Y el caso no se crea como REPARACION ni siquiera para el rol SUPER
```

```gherkin
Dado un caso con id_averia "AV-99812"
Cuando el Supervisor intenta crear otro caso con el mismo id de avería
Entonces el sistema responde 409 y ofrece abrir el caso existente
```

**Restricciones (EARS)**

- Si `tipo_caso` es `REPARACION`, entonces el sistema **exigirá** identificador de pago e `id_averia` no sintético, incluso ante una inserción directa en la base de datos (trigger + `CHECK`).

---

## CU-D89-08 · Reclasificar automáticamente a REFERIDO una REPARACIÓN sin requisitos

| | |
|---|---|
| **Actor** | `SIS-CLA` (lo origina `SUP`/`ADM` al dar de alta o editar) |
| **Objetivo** | No admitir como REPARACIÓN lo que no tiene 70\* o no tiene avería real; convertirlo en caso especial |
| **Precondición** | Se está creando o modificando un caso como `REPARACION` |
| **Postcondición** | El caso queda `tipo_caso='REFERIDO'` (deja de ser REPARACIÓN) con su `id_averia` sintético `REF-…` si no tenía y su ficha de `caso_especial` |
| **Requisitos** | RF-49, RF-50, RNF-29, RNF-32, RT-17 |

**Flujo principal**

1. El sistema detecta que falta el identificador de pago, el id de avería real, o ambos.
2. Genera el `id_averia` sintético `REF-<CÓDIGO_CENTRAL>-<NNNNNN>` (D-23) si no había uno y guarda el original en `informacion`.
3. En la **misma operación** el caso pasa a `tipo_caso='REFERIDO'`; `categoria` pasa a `REFERIDO` salvo que el usuario haya elegido **EMPRESA/GOBIERNO**, que se conservan como clasificación de negocio.
4. Crea (de forma **idempotente**: una sola fila por caso) el `caso_especial` con la `clasificacion` correspondiente, `tipo_actividad='REPARACION'` y `tiene_id_averia=false`.
5. Marca la causa (`SIN_IDENTIFICADOR_PAGO`, `SIN_ID_AVERIA` o ambas) para mostrarla como chip y registra la decisión en `caso_estado_hist` y `auditoria`.

**Flujos alternativos**

- **A1 (el usuario eligió clasificación EMPRESA/GOBIERNO).** El caso **deja igualmente de ser REPARACIÓN** (`tipo_caso='REFERIDO'`, exento del `CHECK`) y `categoria`/`clasificacion` conservan EMPRESA/GOBIERNO; **no** cuenta como reparación reclasificada en las métricas de RF-55, sino como referido de empresa/gobierno.
- **A2 (el caso ya existe como REPARACIÓN y se le quita el identificador en una edición).** Se reclasifica en la misma transacción (RN-IP-06).
- **A3 (el usuario insiste en guardarlo como REPARACIÓN).** No hay forzado (DEC-IP-5): `409` y oferta de registrarlo como REFERIDO (A1 de CU-D89-07).
- **A4 (la escritura no pasa por el servicio).** El **trigger** de la base convierte `tipo_caso` a `REFERIDO` antes de validar, de modo que la inserción/actualización no falla; D-90 completa la ficha del especial.

**Criterios de aceptación**

```gherkin
Dado un Supervisor que registra un caso con tipo REPARACION y sin identificador de pago
Cuando confirma el alta
Entonces el caso queda con tipo_caso "REFERIDO"
Y existe una fila en caso_especial con clasificacion "REFERIDO" y tiene_id_averia false
Y el id de avería es REF-<CENTRAL>-<NNNNNN>
Y el chip indica «Reclasificado: sin identificador de pago»
Y la bitácora registra la reclasificación con usuario y fecha
```

```gherkin
Dado un Supervisor que registra un caso REPARACION de clasificación EMPRESA sin identificador de pago
Cuando confirma el alta
Entonces el caso queda con tipo_caso "REFERIDO"
Y categoria y clasificacion siguen siendo "EMPRESA"
Y no se cuenta en la métrica de reparaciones reclasificadas sino en referidos de empresa
```

```gherkin
Dado un caso REPARACION con identificador de pago
Cuando un Supervisor le quita el identificador y guarda
Entonces el sistema lo reclasifica a REFERIDO en la misma operación
```

```gherkin
Dado un caso SIN identificador insertado directamente con tipo_caso "REPARACION" en la base
Cuando se inserta la fila
Entonces el trigger la guarda con tipo_caso "REFERIDO"
Y la restricción ck_reparacion_con_ip no se viola
```

---

## CU-D89-09 · Reclasificar en su próximo cambio un caso marcado (histórico)

| | |
|---|---|
| **Actor** | `SIS-CLA` (lo dispara cualquier cambio hecho por `SUP`/`ADM`/`TEC`) |
| **Objetivo** | Limpiar progresivamente las REPARACIONES históricas que no cumplen, sin conversión masiva |
| **Precondición** | Existe un caso marcado: `tipo_caso='REPARACION'` y (`id_pago IS NULL` o `id_averia LIKE 'REF-%'`) |
| **Postcondición** | El caso queda reclasificado como REFERIDO o consolidado como REPARACIÓN válida |
| **Requisitos** | RF-50, RNF-29, RNF-32, RT-17 |

**Flujo principal**

1. El sistema lista los casos marcados con el chip **«Reclasificar a REFERIDO»** (web y APK).
2. La reclasificación se dispara en **edición, cierre, cita o despacho**, y en el paso **a** un estado terminal (`CERRADO`, `CANCELADO`, `ENRUTADO`).
3. Si el usuario **aportó** el identificador de pago o un id de avería real, el caso se consolida como REPARACIÓN válida.
4. Si no los aportó, el caso se reclasifica a REFERIDO en la **misma operación** (CU-D89-08) y la marca desaparece.
5. Todo queda en `auditoria` con el motivo.

**Flujos alternativos**

- **A1 (el cambio no toca los datos faltantes: p. ej. solo una observación).** Reclasifica igual: el cambio es la oportunidad de regularizar.
- **A2 (el caso ya está en estado terminal).** **No** se puede eximir de la regla (corrección de **D-90** respecto a la redacción inicial de este flujo): el `CHECK ck_reparacion_con_ip` rige para todo `UPDATE`, de modo que una fila marcada cuya única modificación fuese el estado **no podría guardarse** sin reclasificar, y el trigger de la base la convierte en cualquier caso. Por tanto **cualquier escritura regulariza** el caso; los marcados que **aún no se han reescrito** permanecen marcados y se informan en MONITOREO (`pendientes_historicos_en_terminal`), contando en la métrica de RF-55. La interpretación vigente de la duda 2 es esta.
- **A3 (el usuario pide el detalle).** La ficha explica **qué** falta («sin identificador de pago» / «sin id de avería real»).

**Criterios de aceptación**

```gherkin
Dado un caso marcado: tipo_caso "REPARACION", id_pago NULL, categoria "RESIDENCIAL"
Cuando el Supervisor lo edita y guarda sin aportar el identificador
Entonces la fila queda con tipo_caso "REFERIDO" y categoria "REFERIDO"
Y existe una fila en caso_especial con clasificacion "REFERIDO"
Y la actualización se confirma sin violar ck_reparacion_con_ip
Y la marca «Reclasificar a REFERIDO» desaparece
```

```gherkin
Dado un caso marcado: tipo_caso "REPARACION" sin identificador de pago
Cuando el Supervisor lo edita y aporta el identificador 7014000848
Entonces el caso se mantiene como REPARACIÓN y se enlaza al identificador
Y la marca desaparece
```

```gherkin
Dado un caso marcado en estado CERRADO
Cuando se le cambia el estado a CANCELADO
Entonces el caso no se reclasifica
Y aparece en MONITOREO como pendiente histórico
```

---

## CU-D89-10 · Consultar reincidencia y métricas por identificador de pago

| | |
|---|---|
| **Actor** | `SUP`, `ADM`, `SUPER` |
| **Objetivo** | Detectar usuarios con reportes repetidos y medir la carga por identificador |
| **Precondición** | Existen casos con identificador de pago en el período consultado |
| **Postcondición** | Se muestran los indicadores sin modificar datos |
| **Requisitos** | RF-54, RF-55, RNF-31 |

**Flujo principal**

1. El usuario abre MONITOREO y elige el período.
2. El sistema calcula sobre la **ficha global** del identificador: casos por identificador, **reincidentes** (≥ 2 reportes en la ventana configurada), reparaciones reclasificadas a REFERIDO y **pendientes históricos**, e informa **cuántos de esos casos son visibles** según el alcance del usuario.
3. El sistema muestra el listado de reincidentes con su número rotulado y el enlace a su histórico.
4. El reporte de producción incluye el resumen por identificador.

**Flujos alternativos**

- **A1 (período sin datos).** «Sin casos con identificador en el período».
- **A2 (rol TECNICO).** **No** accede a esta vista (reincidencia y métricas por identificador): `403`. Conserva su acceso vigente a MONITOREO acotado a su cuadrilla, actualizado en §5.2 de `requerimientos.md` (D-94).
- **A3 (identificador sin nombre de titular).** Se muestra el número y «titular no informado».
- **A4 (identificador con casos en dos centrales).** El indicador es **global** (la ficha es única, DEC-IP-6) y se rotula «N reportes en total: M visibles en su central».

**Criterios de aceptación**

```gherkin
Dado un identificador con 3 reportes en los últimos 30 días
Cuando el Supervisor consulta MONITOREO del mes
Entonces ese identificador aparece en la lista de reincidentes con 3 reportes
Y el total coincide con el global de sus casos (indicando los visibles por alcance)
```

```gherkin
Dado un usuario con rol TECNICO
Cuando solicita la lista de identificadores reincidentes
Entonces el sistema responde 403
```

---

## CU-D89-11 · Revisar los avisos de la ingesta (sin identificador / con contacto)

| | |
|---|---|
| **Actor** | `SUP` |
| **Objetivo** | Saber qué filas del archivo no trajeron identificador de pago y cuáles trajeron contacto, para gestionarlas |
| **Precondición** | Existe al menos un lote de ingesta |
| **Postcondición** | El usuario conoce el detalle; no se modifica ningún caso |
| **Requisitos** | RF-56, RNF-30, RT-19 |

**Flujo principal**

1. El usuario abre INGESTA y el resumen del último lote.
2. El sistema muestra los contadores `filas_sin_identificador_pago` y `filas_con_contacto`.
3. El usuario despliega el detalle desde `GET /ingesta/lotes/{id}`: fila, `id_averia`, número detectado y motivo.
4. El usuario puede abrir cada caso desde el listado de avisos.

**Flujos alternativos**

- **A1 (lote sin avisos).** «Todas las filas trajeron identificador de pago».
- **A2 (lote en `ERROR` por encabezado, RT-20).** Se muestran el motivo del error y `filas_leidas = 0`, no los contadores.

**Criterios de aceptación**

```gherkin
Dado un lote con 3 filas cuyo número no cumple el patrón
Cuando el Supervisor abre el detalle del lote en INGESTA
Entonces ve las 3 filas con su id de avería, el número detectado y el motivo
Y el contador filas_sin_identificador_pago muestra 3
```

---

## CU-D89-12 · Auditar los cambios del identificador de pago

| | |
|---|---|
| **Actor** | `SUPER`, `ADM` (la sección **SISTEMAS → Base de datos** sigue siendo solo de `SUPER`) |
| **Objetivo** | Revisar quién creó, enlazó, cambió o reclasificó identificadores y por qué |
| **Precondición** | Existen operaciones registradas sobre casos con identificador |
| **Postcondición** | Se muestra la traza; no se modifica nada |
| **Requisitos** | RNF-31, RNF-32, RT-19 |

**Flujo principal**

1. El usuario abre la página **AUDITORÍA** (`GET /api/v1/auditoria`) y filtra por entidad (`identificador_pago`/`caso`), acción y rango de fechas.
2. El sistema muestra usuario, fecha, acción y `datos_antes`/`datos_despues`, con el **titular enmascarado** si el rol no lo revela.
3. El usuario puede abrir el caso afectado desde la traza.
4. El informe de conciliación (pre-migración) señala identificadores duplicados por formato y casos huérfanos.

**Flujos alternativos**

- **A1 (rol no autorizado: SUPERVISOR o TECNICO).** `403` y el enlace no se renderiza.
- **A2 (más de 50 resultados).** Paginación de 50 renglones (patrón de SISTEMAS, D-69).
- **A3 (traza inexistente para una operación).** Se informa el vacío y se abre incidencia (RNF-32).
- **A4 (`ADM` intenta abrir SISTEMAS → Base de datos).** `403`: esa sección es exclusiva de `SUPER`.

**Criterios de aceptación**

```gherkin
Dado un cambio del identificador de pago hecho por un Administrador
Cuando consulta la página AUDITORÍA filtrando por entidad "identificador_pago"
Entonces ve la fila con usuario, fecha, valor anterior y valor nuevo
Y el titular aparece enmascarado
```

```gherkin
Dado un usuario con rol ADMIN
Cuando abre la página AUDITORÍA
Entonces ve la traza filtrable
Y no ve la sección SISTEMAS → Base de datos
```

```gherkin
Dado un usuario con rol SUPERVISOR
Cuando solicita GET /api/v1/auditoria
Entonces el sistema responde 403
```

---

## CU-D89-13 · Ejecutar y verificar la migración del identificador de pago

| | |
|---|---|
| **Actor** | `SUPER` (con la dirección del proyecto) |
| **Objetivo** | Poner en producción el modelo del identificador sin pérdida y de forma reversible |
| **Precondición** | Base respaldada; el script `scripts/migrar_d89_identificador_pago.py` está disponible |
| **Postcondición** | DDL aplicado, backfill enlazado y verificaciones en verde; reejecutar informa «ya migrada» |
| **Requisitos** | RT-17, RT-18, RNF-29 |

**Flujo principal**

1. El sistema ejecuta el script en **simulación** e imprime el inventario (con 70\*, sin 70\*, sin contacto, REPARACIONES sin id real, duplicados por formato).
2. Con `--aplicar --si`, aplica el DDL idempotente y el backfill con el **mismo normalizador de RF-47**.
3. Verifica: identificadores = números normalizados distintos que cumplen el patrón; 0 casos válidos sin `id_pago`; 0 alias divergentes; 0 marcas `[CONTACTO]` duplicadas.
4. Lista los casos marcados (sin convertirlos) e informa.
5. Cuando no queden violaciones, ejecuta `VALIDATE CONSTRAINT ck_reparacion_con_ip`.

**Flujos alternativos**

- **A1 (el script ya se aplicó).** Informa «ya migrada» y no modifica nada.
- **A2 (conflicto de unicidad en el backfill).** Se detiene, lista los conflictos y no deja la base a medias (transacción única).
- **A3 (rollback).** Se ejecuta el procedimiento documentado (trigger, `CHECK`, policy, vista, índice) y se informa de las reclasificaciones ya aplicadas, que no se revierten.

**Criterios de aceptación**

```gherkin
Dado un entorno de pruebas con la base migrada en simulación
Cuando se ejecuta el script con --aplicar --si
Entonces el número de identificadores es igual al de números normalizados distintos que cumplen el patrón
Y no quedan casos con número válido sin id_pago
Y los casos marcados se listan sin convertirse
```

```gherkin
Dado un entorno ya migrado
Cuando se vuelve a ejecutar el script
Entonces informa «ya migrada» y no modifica ninguna fila
```

---

## Matriz de trazabilidad

| Caso de uso | RF | RNF | RT | Actor |
|---|---|---|---|---|
| CU-D89-01 Ingestar y clasificar números | RF-45, RF-46, RF-47, RF-56 | RNF-29, RNF-33 | RT-05, RT-17, RT-20 | SIS-ING / SUP |
| CU-D89-02 Resolver el identificador | RF-45, RF-57 | RNF-29, RNF-31 | RT-17 | SIS-ING |
| CU-D89-03 Histórico y rótulos del identificador | RF-48, RF-53, RF-54 | RNF-31 | RT-19 | SUP / ADM / SUPER / TEC |
| CU-D89-04 Buscar por identificador o contacto | RF-51, RF-53 | RNF-30 | — | SUP / TEC |
| CU-D89-05 Corregir contacto (web) | RF-46, RF-52 | RNF-30, RNF-32 | RT-19 | SUP / ADM / SUPER |
| CU-D89-06 Corregir contacto (APK) | RF-46, RF-52 | RNF-30, RNF-32 | — | TEC |
| CU-D89-07 Alta de REPARACIÓN válida | RF-45, RF-49 | RNF-29 | RT-19 | SUP / ADM / SUPER |
| CU-D89-08 Reclasificar a REFERIDO | RF-49, RF-50 | RNF-29, RNF-32 | RT-17 | SIS-CLA |
| CU-D89-09 Reclasificar caso marcado | RF-50 | RNF-29, RNF-32 | RT-17 | SIS-CLA |
| CU-D89-10 Reincidencia y métricas | RF-54, RF-55 | RNF-31 | — | SUP / ADM / SUPER |
| CU-D89-11 Avisos de ingesta | RF-56 | RNF-30 | RT-19 | SUP |
| CU-D89-12 Auditoría del identificador | — | RNF-31, RNF-32 | RT-19 | SUPER / ADM |
| CU-D89-13 Migración y verificación | — | RNF-29 | RT-17, RT-18 | SUPER |

**Cobertura de requisitos:**

| Requisito | Casos de uso |
|---|---|
| RF-45 | CU-01, CU-02, CU-07 |
| RF-46 | CU-01, CU-05, CU-06 |
| RF-47 | CU-01 |
| RF-48 | CU-03 |
| RF-49 | CU-07, CU-08 |
| RF-50 | CU-08, CU-09 |
| RF-51 | CU-04 |
| RF-52 | CU-05, CU-06 |
| RF-53 | CU-03, CU-04 |
| RF-54 | CU-03, CU-10 |
| RF-55 | CU-10 |
| RF-56 | CU-01, CU-11 |
| RF-57 | CU-02 |
| RNF-29 | CU-01, CU-02, CU-07, CU-08, CU-09, CU-13 |
| RNF-30 | CU-04, CU-05, CU-06, CU-11 |
| RNF-31 | CU-02, CU-03, CU-10, CU-12 |
| RNF-32 | CU-05, CU-06, CU-08, CU-09, CU-12 |
| RNF-33 | CU-01 |
| RT-05 | CU-01 |
| RT-17 | CU-01, CU-02, CU-08, CU-09, CU-13 |
| RT-18 | CU-13 |
| RT-19 | CU-03, CU-05, CU-07, CU-11, CU-12 |
| RT-20 | CU-01 |

> **Sin huérfanos:** los 13 RF, los 5 RNF y los 4 RT quedan cubiertos por al menos un
> caso de uso (RT-18 a través del CU-13, que existe precisamente para trazarlo).

## Decisiones y dudas

| # | Tema | Estado |
|---|---|---|
| 1 | ¿Puede el Super Usuario **forzar** una REPARACIÓN sin identificador? | **Resuelto por diseño: no** (DEC-IP-5); requiere confirmación del usuario |
| 2 | Casos marcados en estado **terminal** | **Resuelto en D-90:** **cualquier** escritura regulariza el caso (el `CHECK` impide eximir el `UPDATE` de una fila marcada); los marcados **no reescritos** se informan en MONITOREO como pendientes históricos (CU-09/A2 corregido) |
| 3 | Alcance **multi-central** del histórico | **Resuelto (DEC-IP-6):** identificador **único global**; la ficha se ve si es de la central del usuario o si esa central tiene casos enlazados; reincidencia global informando los casos visibles |
| 4 | ¿Qué pasa si el contacto tecleado es un 70\*? | **Resuelto (DEC-IP-7):** se **registra como identificador del caso** (no como contacto) y se informa |

## Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| v0.1 | 2026-10-08 | Emisión inicial: 12 casos de uso con Gherkin/EARS y matriz de trazabilidad. |
| **v0.2** | 2026-10-08 | **Auditoría H-01…H-21 incorporada:** REFERIDO como `tipo_caso` + trigger (H-01), forzado eliminado (H-02), `telefono` nulo (H-03), edición del identificador ADMIN/SUPERVISOR (H-04), contrato sin heurística y compatibilidad de la APK (H-05), contacto solo de las columnas 13/16 (H-06), unicidad por central y RLS (H-07), Gherkin reescritos y regla del 70\* como contacto (H-08), EMPRESA/GOBIERNO aclarado (H-09), superficies de RF-53 (H-10), avisos del lote (H-11), RF-57 (H-12), AUDITORÍA y actores separados (H-13), RT-20 (H-14), MONITOREO del TÉCNICO aclarado (H-15), tabla de enmascaramiento (H-16), orden de búsqueda (H-17), RT-19 ampliado (H-18), estados terminales (H-19), conciliación pre-migración (H-20) y **CU-13** para RT-18 (H-21). |
| **v0.4** | 2026-10-08 | **Corrección de D-90:** CU-09/A2 — la excepción «un cambio de estado en un caso ya terminal no reclasifica» es **inexecutable** con el `CHECK` de D-89 (bloquearía ese `UPDATE`) y el trigger de la base convierte la fila igualmente; queda «cualquier escritura regulariza» y los marcados no reescritos se informan en MONITOREO. |
| **v0.3** | 2026-10-08 | **DEC-IP-5/6/7 cerradas** (entrevista una a una): CU-02 pasa a **ficha única global** reutilizada entre centrales (RLS por casos enlazados), CU-03/CU-10 informan la reincidencia **global** con los casos visibles, y CU-05/CU-06 convierten un 70\* tecleado como contacto en **identificador del caso** (con su Gherkin y la auditoría `CONTACTO_A_IDENTIFICADOR`). |
