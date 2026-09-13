# Casos de Uso — Página HTML de Gestión de Averías (GGTO-v1)

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías de la central telefónica **Francisco Salias (Área 4)**, CANTV, Venezuela.
- **Fase:** 2 (Auditoría y casos de uso) — documento vivo.
- **Fecha de emisión:** 13/09/2026.
- **Fuentes normativas (leídas completas, no modificadas):**
  `RepoTecnico/PAGINA-GGTO-INICIAL.md` (fuente primaria del usuario, se cita como `L##`),
  `RepoTecnico/requerimientos.md` (29 RF, 11 RNF, 11 RT, 9 RN, D-01 a D-28, ambigüedades A-##),
  `RepoTecnico/PROPUESTA-PAGINA-GGTO.md` (arquitectura y ciclos C1-C7),
  `RepoTecnico/diccionario_datos.md` (`averias.json`, `despacho.json`, `estructura.json` posicional y archivos de configuración),
  `RepoTecnico/entornos_globales.md` (rutas, lanzador, CSV real),
  `RepoTecnico/auditoria_fase1.md` (29 hallazgos H-01 a H-29, atendidos o aceptados),
  `RepoTecnico/estado_proyecto.md` (estado y decisiones vigentes).
- **Documentos de apoyo (solo lectura de encabezados):** `detalle_averias_gpon 12_09_2026.csv` (80 columnas, separador `;`) y `alta_manual.csv` (42 columnas).
- **Documento hermano:** `RepoTecnico/casos_uso/diagramas.md` (diagrama UML de casos de uso, diagramas de secuencia y diagrama de estados).

---

## 1. Convenciones

1. **Actor principal:** quien inicia y obtiene el valor del caso de uso. **Actores secundarios:** quienes participan, validan o reciben el resultado.
2. **Ciclo:** C1…C7 según `requerimientos.md` §8. **Prioridad:** `MVP` = ciclos C1, C2 y C3 (decisión D-02); `posterior` = C4 a C7.
3. **Trazabilidad:** cada caso de uso lista los RF, RNF, RT y RN que cubre y las decisiones D-xx que aplica. Todo caso de uso cubre al menos un RF.
4. **Gherkin:** `Dado / Cuando / Entonces / Y`. Cada criterio es verificable: tiene dato de entrada, acción y resultado observable con número concreto. Si un criterio no es testeable se reescribe; no se admite "debe ser rápido", "debe ser usable" ni "etc.".
5. **EARS (restricciones del sistema):** se usa para lo que **no** es acción del usuario, con los cinco patrones:
   - *Ubicuo:* «El sistema deberá …»
   - *Dirigido por evento:* «Cuando &lt;disparador&gt;, el sistema deberá …»
   - *Dirigido por estado:* «Mientras &lt;estado&gt;, el sistema deberá …»
   - *Comportamiento no deseado:* «Si &lt;condición&gt;, entonces el sistema deberá …»
   - *Característica opcional:* «De acuerdo con &lt;característica&gt;, el sistema deberá …»
6. **Nomenclatura de dominio (RNF-07):** `status` = PEND / ASGN / GESTION / CERRADO (D-13); `resolucion` = IVR / COS / COLA; `clase` = REP / CNS; `nivel` = COM / REF; `tipo_abonado` = RES / EMP (D-17); `sacas` = SI / NO. En pantalla se escriben "Gestión" y "Cerrado", nunca "estatus".
7. **Fechas:** `DD/MM/AAAA` (RNF-06). Semana operativa de **lunes a sábado** (RN-08). Los números de los criterios están tomados de la muestra real del 12/09/2026 (80 columnas, 56 registros, 51 de Francisco Salias, 17 con palabras clave de fibra y 39 sin ellas) y de los umbrales D-24 y D-25.
8. **Supuestos por ambigüedad abierta.** Las ambigüedades **A-05, A-08, A-09, A-10, A-11 y A-14** siguen abiertas. Donde un caso de uso depende de ellas, el supuesto se escribe junto al paso y se marca `[SUPUESTO: A-xx]`. Ningún supuesto se presenta como decisión tomada.
9. **Decisión derivada registrada.** Los umbrales de desempeño se citan como **D-24** (1.000 casos; filtrado y orden &lt; 1,5 s; MONITOREO &lt; 3 s). Nota: la lista de decisiones indicada para este trabajo enumera D-01 a D-28; en los documentos fuente vigentes (`requerimientos.md` §3 y `estado_proyecto.md` §3) los umbrales de desempeño aparecen efectivamente como D-24. Se cita como D-24 en todo el documento.
10. **Persistencia (D-01, D-15, D-19):** la superficie se sirve desde un servidor local en loopback (`--bind 127.0.0.1`, puerto 8787) que publica **solo** el subdirectorio de la aplicación; los JSON de trabajo viven en `C:\GGTO\datos` (fuera de Google Drive) y se leen/escriben con File System Access API.

---

## 2. Actores

| Actor | Tipo | Descripción | Casos de uso |
|---|---|---|---|
| **Operador de la central** | Principal | Trabaja la operación diaria: configura padrones, ingiere el CSV, consulta y cierra casos, hace la gestión telefónica y da de alta casos manuales. Se identifica en cada sesión contra `tecnicos.json` (D-16, RNF-08). | CU-01 a CU-14, CU-22 |
| **Supervisor** | Principal | Responsable del despacho del día y de las cifras: aprueba el reparto, emite los PDF por cuadrilla, revisa MONITOREO y reportes y decide sobre los casos especiales y las averías concentradas. | CU-01, CU-10, CU-13, CU-15 a CU-20 |
| **Administrador** | Principal | Custodia el sistema: `central.json`, padrones, sectores, palabras clave, respaldos, restauración y control de acceso. | CU-01 a CU-07, CU-21, CU-22 |
| **Cuadrilla / técnico de calle** | Secundario | Recibe la hoja impresa del despacho, ejecuta el trabajo y devuelve la hoja al cierre de la jornada. No opera la página en el MVP. | CU-16, CU-17 |
| **Emisor del CSV (origen corporativo / VENAPP)** | Secundario externo | Entrega el archivo diario `detalle_averias_gpon DD_MM_AAAA.csv`. No interactúa con la interfaz: es el origen del dato y el disparador de la ingesta. | CU-08, CU-09 |
| **Auditoría / control interno** | Secundario | Consulta el historial de cambios y el control documental del despacho. | CU-14, CU-15, CU-17 |

---

## 3. Índice de casos de uso

| CU | Nombre | Actor principal | Ciclo | Prioridad |
|---|---|---|---|---|
| CU-01 | Iniciar sesión e identificar al operador | Operador de la central | C1 | MVP |
| CU-02 | Configurar los datos operativos de la central | Administrador | C1 | MVP |
| CU-03 | Gestionar el padrón de técnicos | Administrador | C1 | MVP |
| CU-04 | Gestionar el padrón de flota | Administrador | C1 | MVP |
| CU-05 | Gestionar el padrón de cuadrillas | Administrador | C1 | MVP |
| CU-06 | Gestionar el catálogo de sectores | Administrador | C1 | MVP |
| CU-07 | Gestionar las palabras clave de clasificación | Administrador | C2 | MVP |
| CU-08 | Ingestar el CSV diario | Operador de la central | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central | C2 | MVP |
| CU-10 | Gestionar y filtrar los CASOS | Operador de la central | C1 / C3 | MVP |
| CU-11 | Consultar la ficha de un caso | Operador de la central | C3 | MVP |
| CU-12 | Cerrar un caso | Operador de la central | C3 | MVP |
| CU-13 | Gestionar telefónicamente la bandeja GESTION | Operador de la central | C3 | MVP |
| CU-14 | Dar de alta manual un caso | Operador de la central | C3 | MVP |
| CU-15 | Consultar la auditoría de cambios de un caso | Supervisor | C1 | MVP |
| CU-16 | Generar y ajustar el despacho del día | Supervisor | C4 | posterior |
| CU-17 | Emitir el PDF de despacho por cuadrilla y registrar la entrega | Supervisor | C4 | posterior |
| CU-18 | Monitorear la gestión diaria y semanal | Supervisor | C5 | posterior |
| CU-19 | Emitir los reportes de trabajo diario y de gestión semanal | Supervisor | C6 | posterior |
| CU-20 | Vigilar casos especiales y averías concentradas | Supervisor | C6 | posterior |
| CU-21 | Respaldar y restaurar los datos | Administrador | C1 (respaldo) / C7 | MVP (respaldo diario) |
| CU-22 | Operar en contingencia y diagnosticar el entorno | Administrador | C1 / C7 | MVP |

**Total: 22 casos de uso.** Actores de la página: operador de la central, supervisor y administrador. Actores secundarios: cuadrilla/técnico de calle, emisor del CSV y auditoría.

---

## 4. Casos de uso

### CU-01 — Iniciar sesión e identificar al operador

- **Actor principal:** Operador de la central.
- **Actores secundarios:** Supervisor, Administrador (mismo mecanismo de identificación); soporte TI del puesto.
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** el servidor local responde en `http://localhost:8787` (loopback) y sirve solo el subdirectorio de la aplicación; `C:\GGTO\datos\tecnicos.json` existe y es legible.
- **Postcondiciones:** la sesión queda asociada a un técnico del padrón; la página habilita la edición; toda modificación posterior registra ese operador y la fecha/hora (RNF-09).

**Trazabilidad:** RF-01; RNF-03, RNF-07, RNF-08; RT-06, RT-07, RT-09, RT-10; D-01, D-15, D-16, D-19, D-22; H-01.

**Flujo principal**

1. El operador abre la página en Edge o Chrome desde `http://localhost:8787/index.html`.
2. El sistema detecta el contexto `http://localhost` y comprueba que existen los archivos de `C:\GGTO\datos` (al menos `tecnicos.json` y `averias.json`).
3. El sistema muestra el diálogo **Identificación del operador** con el campo *P00 o usuario* y el botón *Iniciar sesión*.
4. El operador escribe su P00 o usuario y pulsa *Iniciar sesión*.
5. El sistema busca coincidencia exacta en `tecnicos.json` con `status` activo.
6. El sistema abre la sesión, muestra en la barra superior el nombre, la cédula y el P00 del operador y presenta las 7 pestañas: PANEL, MONITOREO, GRAFICOS, CASOS, DESPACHO, CONFIGURACION y GESTION.
7. El sistema deja la pestaña PANEL activa y habilita los botones de edición.

**Flujos alternativos**

- **1a. El operador abre el archivo con doble clic (`file://`).** El sistema detecta el protocolo `file:`, bloquea la edición y muestra el mensaje «Abra la página con `servir-ggto.ps1` (http://localhost:8787). Desde `file://` no se pueden leer ni escribir los JSON.» [D-01, RT-06, H-23]
- **4a. P00/usuario vacío.** El sistema rechaza el envío con «Indique su P00 o usuario» y no abre la sesión; se permiten 3 intentos fallidos antes de volver al paso 3 con el contador visible.
- **5a. El usuario no existe en `tecnicos.json` o su `status` no es activo.** El sistema muestra «Operador no registrado o inactivo. Solicite su alta en CONFIGURACION/TECNICOS», registra el intento con fecha y hora y mantiene la sesión cerrada. [RNF-08]
- **5b. `tecnicos.json` no existe, está vacío o tiene JSON inválido.** El sistema muestra «Padrón de técnicos no disponible: <detalle>», ofrece la ruta `C:\GGTO\datos\tecnicos.json` y bloquea la edición hasta que se restaure desde respaldo. [CU-21, H-20, H-25]
- **6a. Ambigüedad A-11.** [SUPUESTO: A-11] Se admite como identificador válido el valor `P00` **o** el campo `nombre` de `tecnicos.json`, porque el significado de `P00` continúa sin definirse; el sistema muestra ambos campos en el diálogo y el administrador puede cambiarlo cuando A-11 se cierre.

**Criterios de aceptación (Gherkin)**

1. **Dado** que el servidor local escucha en `127.0.0.1:8787` y `tecnicos.json` contiene un técnico activo con P00 `12345` y nombre `Luis Pérez`, **Cuando** el operador escribe `12345` y pulsa *Iniciar sesión*, **Entonces** la página muestra «Sesión: Luis Pérez (12345)» y habilita los botones *Guardar*, *Cerrar caso* y *Agregar caso*. **Y** el encabezado de la sesión queda registrado como operador activo.
2. **Dado** que la sesión está cerrada, **Cuando** el operador intenta pulsar *Cerrar caso*, **Entonces** el sistema no ejecuta la acción y muestra «Identifíquese para editar».
3. **Dado** que el operador abre `index.html` desde `file://`, **Cuando** la página termina de cargar, **Entonces** el sistema muestra el aviso de servidor local y ningún botón de edición queda habilitado.
4. **Dado** que `tecnicos.json` no contiene el valor `99999`, **Cuando** el operador lo escribe y pulsa *Iniciar sesión*, **Entonces** el sistema muestra «Operador no registrado o inactivo», incrementa el contador de intentos a 1 y mantiene la sesión cerrada.
5. **Dado** que el operador ya inició sesión, **Cuando** modifica el `status` de un caso, **Entonces** el caso queda con `usuario_modificacion` igual al P00 de la sesión y `fecha_modificacion` con formato `DD/MM/AAAA hh:mm`.
6. **Dado** un equipo con Edge o Chrome versión 86 o superior, **Cuando** se carga la página desde `http://localhost:8787`, **Entonces** las 7 pestañas son navegables y ninguna dependencia se solicita por internet.

**Restricciones del sistema (EARS)**

- **Ubicuo:** El sistema deberá servir la página únicamente por `http://127.0.0.1:8787` y publicar solo el subdirectorio de la aplicación, dejando `datos/` y `RepoTecnico/` fuera del alcance HTTP. [D-15, RT-09]
- **Mientras** no exista una identificación válida, el sistema deberá mantener bloqueadas las acciones de edición, cierre, alta y configuración. [RNF-08]
- **Si** el navegador no soporta File System Access API, entonces el sistema deberá avisar «Modo consulta: este navegador no permite escribir los JSON» y ofrecer el modo descarga. [RNF-03, H-22]
- **El sistema deberá** registrar en cada cambio el operador de la sesión y la fecha/hora del cambio. [RNF-09, D-16]

---

### CU-02 — Configurar los datos operativos de la central

- **Actor principal:** Administrador.
- **Actores secundarios:** Operador de la central (consume el filtro en la ingesta).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01); `C:\GGTO\datos\central.json` accesible (puede no existir en la primera ejecución).
- **Postcondiciones:** `central.json` contiene los 10 campos operativos vigentes y la ingesta filtra el CSV contra ellos (RT-03).

**Trazabilidad:** RF-11; RNF-08, RNF-10; RT-01, RT-03; D-01, D-12, D-16; H-14.

**Flujo principal**

1. El administrador entra en CONFIGURACION → **CENTRAL**.
2. El sistema muestra los 10 campos con el valor vigente: región, estado geográfico, capital del estado geográfico, municipio, parroquia, estado operativo, distrito, área, central y nombre de la central.
3. El administrador edita los valores (para Francisco Salias, área 4: `area = AREA 4`, `central = 2324X`, `nombre_central = FRANCISCO SALIAS`).
4. El administrador pulsa *Guardar*.
5. El sistema valida que los 10 campos no estén vacíos y que `area` y `central` no tengan espacios al inicio ni al final.
6. El sistema escribe `C:\GGTO\datos\central.json` y relee el archivo para confirmar el contenido.
7. El sistema muestra «Central guardada» y el resumen de los 10 campos.

**Flujos alternativos**

- **4a. Algún campo obligatorio vacío.** El sistema marca en rojo los campos vacíos, muestra «Complete: &lt;lista de campos&gt;» y no escribe el archivo.
- **6a. La escritura falla (permiso, disco, archivo bloqueado).** El sistema conserva el valor anterior en pantalla, muestra «No se pudo guardar `central.json`: &lt;detalle&gt;» y ofrece *Reintentar* y *Guardar copia en `datos_respaldo`*. [CU-21, H-09]
- **2a. `central.json` no existe.** El sistema muestra el formulario vacío con el botón *Crear central* y advierte que la ingesta quedará bloqueada hasta que exista el registro.

**Criterios de aceptación (Gherkin)**

1. **Dado** el formulario CENTRAL vacío, **Cuando** el administrador guarda con 9 campos informados y `municipio` vacío, **Entonces** el sistema muestra «Complete: municipio» y `central.json` no se crea ni se modifica.
2. **Dado** el formulario CENTRAL con `area = AREA 4`, `central = 2324X` y `nombre_central = FRANCISCO SALIAS`, **Cuando** el administrador pulsa *Guardar*, **Entonces** `central.json` contiene los 10 campos y la relectura inmediata devuelve los mismos valores.
3. **Dado** que `central.json` tiene `central = 2324X`, **Cuando** se ejecuta la ingesta del CSV del 12/09/2026, **Entonces** el sistema procesa solo los **51 registros** con `nombre central = FRANCISCO SALIAS` y descarta los 5 de LAS MERCEDES CPA y EL HATILLO.
4. **Dado** que `central.json` no existe, **Cuando** el operador abre CONFIGURACION → CENTRAL, **Entonces** el sistema muestra el formulario vacío con el botón *Crear central* y el aviso «La ingesta está bloqueada hasta configurar la central».

**Restricciones del sistema (EARS)**

- **Mientras** `central.json` no exista o tenga algún campo vacío, el sistema deberá bloquear la ejecución de la ingesta y mostrar «Configure la central (CONFIGURACION → CENTRAL)». [RT-03, RN-04]
- **Cuando** se guarde `central.json`, el sistema deberá releer el archivo escrito y compararlo con lo enviado antes de confirmar en pantalla. [RNF-10, H-09]
- **El sistema deberá** registrar el operador y la fecha/hora de cada modificación de `central.json`. [RNF-09]

---

### CU-03 — Gestionar el padrón de técnicos

- **Actor principal:** Administrador.
- **Actores secundarios:** Operador de la central (se identifica contra este padrón).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01).
- **Postcondiciones:** `tecnicos.json` contiene el padrón vigente con nombre, cédula, P00, teléfono, correo, especialidad y status.

**Trazabilidad:** RF-12; RNF-04, RNF-08, RNF-10; RT-01; D-16, D-07 (referencia desde CU-05); A-11.

**Flujo principal**

1. El administrador entra en CONFIGURACION → **TECNICOS**.
2. El sistema lista los técnicos con las columnas: nombre, cédula, P00, teléfono, correo, especialidad y status.
3. El administrador pulsa *Nuevo técnico*, completa la ficha y guarda.
4. El sistema valida que `nombre`, `cedula` y `status` estén informados y que `cedula` no se repita.
5. El sistema agrega el registro a `tecnicos.json`, relee el archivo y muestra «Técnico agregado».
6. Para editar, el administrador selecciona una fila, modifica los campos y guarda; el sistema aplica la misma validación y persiste.
7. Para dar de baja, el administrador cambia `status` a inactivo; el técnico desaparece de las listas de selección de cuadrilla, pero permanece en el padrón para no romper el historial.

**Flujos alternativos**

- **4a. Cédula duplicada.** El sistema muestra «La cédula 12345678 ya existe (técnico: Luis Pérez)» y no guarda.
- **4b. `nombre`, `cedula` o `status` vacíos.** El sistema muestra el campo faltante y no guarda.
- **7a. El técnico pertenece a una cuadrilla activa.** El sistema advierte «El técnico integra las cuadrillas C1 y C3. Al inactivarlo quedan incompletas» y exige confirmación escrita antes de continuar.
- **2a. `tecnicos.json` ausente o inválido.** El sistema muestra «Padrón no disponible» y ofrece *Crear padrón vacío* o *Restaurar desde respaldo* (CU-21).

**Criterios de aceptación (Gherkin)**

1. **Dado** el padrón con un técnico de cédula `12345678`, **Cuando** el administrador intenta agregar otro con la misma cédula, **Entonces** el sistema muestra «La cédula 12345678 ya existe» y el total de técnicos en `tecnicos.json` no cambia.
2. **Dado** el formulario de alta con `nombre = Ana Gómez`, `cedula = 87654321`, `P00 = 4321`, `especialidad = Fibra` y `status = Activo`, **Cuando** el administrador pulsa *Guardar*, **Entonces** `tecnicos.json` contiene el registro y la lista muestra 1 fila más.
3. **Dado** un técnico con `status = Inactivo`, **Cuando** el administrador abre el selector de técnicos de una cuadrilla, **Entonces** ese técnico no aparece en la lista.
4. **Dado** un técnico que integra 2 cuadrillas activas, **Cuando** el administrador cambia su `status` a Inactivo, **Entonces** el sistema muestra el aviso con los identificadores de las 2 cuadrillas y exige confirmación antes de persistir.

**Restricciones del sistema (EARS)**

- **Si** la cédula ya existe en el padrón, entonces el sistema deberá rechazar el alta sin modificar el archivo. [RNF-04]
- **Cuando** se modifique un técnico, el sistema deberá persistir el cambio y registrar operador y fecha/hora. [RNF-09]
- **Mientras** el significado de `P00` no esté cerrado (A-11), el sistema deberá permitir guardarlo como texto libre no obligatorio y mostrarlo tal cual en la ficha. [A-11]

---

### CU-04 — Gestionar el padrón de flota

- **Actor principal:** Administrador.
- **Actores secundarios:** Operador de la central (consume la flota al armar cuadrillas).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01).
- **Postcondiciones:** `flota.json` contiene los vehículos vigentes con CAN00, tipo, marca, modelo, placa, combustible, status, estado de cauchos, estado de fluidos y estado general.

**Trazabilidad:** RF-13; RNF-04, RNF-10; RT-01; D-07.

**Flujo principal**

1. El administrador entra en CONFIGURACION → **FLOTA**.
2. El sistema lista los vehículos con las 10 columnas del padrón.
3. El administrador pulsa *Nuevo vehículo*, informa CAN00, placa y status (obligatorios) y los 7 campos restantes.
4. El sistema valida que `CAN00` y `placa` no se repitan y que `status` pertenezca a {Operativo, En mantenimiento, Fuera de servicio}.
5. El sistema agrega el registro a `flota.json`, relee el archivo y muestra «Vehículo agregado».
6. El administrador edita o cambia el `status` del vehículo cuando cambia su condición; el sistema persiste el cambio y registra operador y fecha/hora.

**Flujos alternativos**

- **4a. CAN00 o placa duplicados.** El sistema muestra «El CAN00 1234 ya está registrado (placa AB123CD)» y no guarda.
- **4b. `status` fuera del enum.** El sistema muestra «Status inválido: use Operativo, En mantenimiento o Fuera de servicio» y no guarda.
- **6a. El vehículo está asignado a una cuadrilla activa.** El sistema advierte «El CAN00 1234 está asignado a la cuadrilla C2» y exige confirmación antes de ponerlo fuera de servicio.
- **2a. `flota.json` ausente o inválido.** El sistema muestra «Padrón no disponible» y ofrece *Crear padrón vacío* o *Restaurar desde respaldo* (CU-21).

**Criterios de aceptación (Gherkin)**

1. **Dado** el padrón con el CAN00 `1234`, **Cuando** el administrador agrega otro vehículo con el mismo CAN00, **Entonces** el sistema muestra el aviso de duplicado y el total de vehículos en `flota.json` no cambia.
2. **Dado** el formulario con `CAN00 = 5678`, `placa = XY987ZT`, `status = Operativo`, `estado_cauchos = Bueno`, `estado_fluidos = OK` y `estado_general = Bueno`, **Cuando** el administrador pulsa *Guardar*, **Entonces** `flota.json` contiene el vehículo y la lista muestra 1 fila más.
3. **Dado** un vehículo con `status = Fuera de servicio`, **Cuando** el administrador abre el selector de vehículo de una cuadrilla, **Entonces** ese vehículo no aparece en la lista.
4. **Dado** un vehículo asignado a la cuadrilla `C2`, **Cuando** el administrador lo marca «Fuera de servicio», **Entonces** el sistema muestra «El CAN00 1234 está asignado a la cuadrilla C2» y pide confirmación.

**Restricciones del sistema (EARS)**

- **Si** `CAN00` o `placa` ya existen, entonces el sistema deberá rechazar el alta sin modificar el archivo. [RNF-04]
- **Cuando** se modifique un vehículo, el sistema deberá persistir el cambio y registrar operador y fecha/hora. [RNF-09]
- **El sistema deberá** conservar la grafía corregida `combustible` en el archivo y en la interfaz. [RNF-07, A-06]

---

### CU-05 — Gestionar el padrón de cuadrillas

- **Actor principal:** Administrador.
- **Actores secundarios:** Supervisor (las usa en el despacho, CU-16); operador de la central.
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01); existen técnicos (CU-03), vehículos (CU-04) y sectores (CU-06) si se van a referenciar.
- **Postcondiciones:** `cuadrillas.json` contiene las cuadrillas con `id, nombre, tecnicos[], vehiculo, turno, sectores[], status`; el `id` es el valor que toma `averias."Reparador Principal"`.

**Trazabilidad:** RF-14; RNF-04, RNF-10; RT-01; RN-05, RN-06; D-07; A-14.

**Flujo principal**

1. El administrador entra en CONFIGURACION → **CUADRILLA**.
2. El sistema lista las cuadrillas con id, nombre, técnicos, vehículo, turno, sectores y status.
3. El administrador pulsa *Nueva cuadrilla* e informa: `id` (por ejemplo `C1`), `nombre` (por ejemplo `Cuadrilla 1`), uno o más técnicos activos, un vehículo operativo, turno y los sectores preferentes.
4. El sistema valida: `id` y `nombre` no vacíos; `id` no repetido; al menos 1 técnico activo; el vehículo existe en `flota.json`; cada sector existe en `sectores.json`.
5. El sistema agrega la cuadrilla a `cuadrillas.json`, relee el archivo y muestra «Cuadrilla agregada».
6. El administrador edita técnicos, vehículo, turno, sectores o status y guarda; el sistema aplica las mismas validaciones y persiste.
7. El administrador inactiva una cuadrilla que deja de operar; el sistema la excluye de las listas de asignación del despacho y de los filtros de CASOS.

**Flujos alternativos**

- **4a. `id` repetido.** El sistema muestra «La cuadrilla C1 ya existe» y no guarda.
- **4b. Técnico inactivo o vehículo no operativo.** El sistema muestra «El técnico Ana Gómez está inactivo» o «El CAN00 1234 está fuera de servicio» y no guarda.
- **4c. Sector inexistente.** El sistema muestra «El sector 7 no existe en `sectores.json`» y ofrece abrir el CRUD de sectores (CU-06).
- **7a. La cuadrilla tiene casos con `Reparador Principal` = su id.** El sistema advierte «La cuadrilla C1 tiene 12 casos asignados y 3 abiertos» y exige confirmación antes de inactivarla.
- **6a. Ambigüedad A-14.** [SUPUESTO: A-14] El sistema guarda la asignación de cuadrilla en `averias."Reparador Principal"` y **no** modifica la composición de `despacho.json` (que sigue con las 12 columnas de L57); el agrupamiento del despacho se calcula en memoria. Si A-14 se cierra ampliando `despacho.json`, este paso se reescribe.

**Criterios de aceptación (Gherkin)**

1. **Dado** el padrón con la cuadrilla `C1`, **Cuando** el administrador intenta crear otra con `id = C1`, **Entonces** el sistema muestra «La cuadrilla C1 ya existe» y el total de cuadrillas no cambia.
2. **Dado** el formulario con `id = C2`, `nombre = Cuadrilla 2`, 2 técnicos activos, vehículo `5678`, `turno = Diurno` y sectores `1` y `4`, **Cuando** el administrador pulsa *Guardar*, **Entonces** `cuadrillas.json` contiene la cuadrilla con los 2 técnicos y los 2 sectores.
3. **Dado** una cuadrilla sin ningún técnico activo, **Cuando** el administrador pulsa *Guardar*, **Entonces** el sistema muestra «Seleccione al menos un técnico activo» y no guarda.
4. **Dado** una cuadrilla con `status = Inactiva`, **Cuando** el supervisor genera el despacho (CU-16), **Entonces** esa cuadrilla no aparece como destino de asignación.
5. **Dado** una cuadrilla inactiva con 3 casos abiertos cuyo `Reparador Principal` es su id, **Cuando** el administrador confirma la inactivación, **Entonces** los 3 casos conservan su `Reparador Principal` y aparecen filtrables por esa cuadrilla en CU-10.

**Restricciones del sistema (EARS)**

- **Si** el `id` de la cuadrilla ya existe, entonces el sistema deberá rechazar el alta y conservar el archivo sin cambios. [RNF-04]
- **Mientras** una cuadrilla esté inactiva, el sistema deberá excluirla de la asignación del despacho sin reescribir los casos ya asignados. [D-07]
- **El sistema deberá** guardar `Reparador Principal` con el `id` de la cuadrilla, tal como lo exige `cuadrillas.json`. [D-07, A-14]

---

### CU-06 — Gestionar el catálogo de sectores

- **Actor principal:** Administrador.
- **Actor secundario:** Operador de la central (asigna sectores en CU-09); supervisor (los usa en el despacho, CU-16).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01).
- **Postcondiciones:** `sectores.json` contiene el catálogo vigente con `id, nombre, vias[], cuadrilla_sugerida`; toda avería puede referenciar un sector existente (RN-04).

**Trazabilidad:** RF-29, RF-18; RN-04; RNF-04, RNF-10; RT-01; D-03, D-25; H-14, H-18.

**Flujo principal**

1. El administrador entra en CONFIGURACION → **SECTORES**.
2. El sistema lista los sectores con id, nombre, número de vías y cuadrilla sugerida.
3. El administrador pulsa *Nuevo sector*, informa `id` (por ejemplo `1`), `nombre` (por ejemplo `Prados del Este`), la lista de calles y urbanizaciones (`vias`) y, opcionalmente, la `cuadrilla_sugerida`.
4. El sistema valida que `id` y `nombre` no estén vacíos, que `id` no se repita y que la cuadrilla sugerida exista en `cuadrillas.json`.
5. El sistema agrega el sector a `sectores.json`, relee el archivo y muestra «Sector agregado».
6. El administrador edita el nombre o la lista de vías y guarda; el sistema persiste y muestra cuántas averías abiertas usan ese sector.
7. El administrador elimina un sector; el sistema bloquea la baja si existen averías con ese `sector` y ofrece reasignarlas primero (CU-09 o CU-10).

**Flujos alternativos**

- **4a. `id` repetido.** El sistema muestra «El sector 1 ya existe (Prados del Este)» y no guarda.
- **7a. El sector tiene averías asociadas.** El sistema muestra «El sector 1 tiene 27 averías (4 abiertas). Reasígnelas antes de eliminarlo» y no elimina.
- **7b. El administrador confirma eliminar un sector sin averías.** El sistema elimina el registro y muestra «Sector eliminado»; el total de sectores baja en 1.
- **4b. Cuadrilla sugerida inexistente.** El sistema muestra «La cuadrilla C9 no existe» y no guarda.
- **2a. `sectores.json` ausente.** El sistema muestra la lista vacía con el aviso «Sin sectores no puede completarse la ingesta (RN-04)» y el botón *Nuevo sector*.

**Criterios de aceptación (Gherkin)**

1. **Dado** el catálogo con el sector `1` (Prados del Este), **Cuando** el administrador intenta crear otro con `id = 1`, **Entonces** el sistema muestra el aviso de duplicado y el total de sectores no cambia.
2. **Dado** el formulario con `id = 4`, `nombre = La Trinidad`, `vias = [Av. Intercomunal, Calle 5]`, **Cuando** el administrador pulsa *Guardar*, **Entonces** `sectores.json` contiene el sector con 2 vías.
3. **Dado** un sector con 4 averías abiertas asociadas, **Cuando** el administrador pulsa *Eliminar*, **Entonces** el sistema muestra «El sector tiene 4 averías abiertas», no elimina el registro y ofrece abrir CU-09.
4. **Dado** un sector sin averías asociadas, **Cuando** el administrador confirma la eliminación, **Entonces** el sector desaparece de `sectores.json` y del selector de sectores de CASOS.
5. **Dado** un catálogo con 6 sectores declarados, **Cuando** se ingiere un CSV con direcciones que coinciden con 5 de ellos, **Entonces** el sistema asigna 5 sectores automáticamente y envía las direcciones restantes a la cola de CU-09.

**Restricciones del sistema (EARS)**

- **Si** el `id` del sector ya existe, entonces el sistema deberá rechazar el alta sin modificar el catálogo. [RNF-04]
- **Si** un sector tiene averías asociadas, entonces el sistema deberá impedir su eliminación hasta que se reasignen. [RNF-10, RN-04]
- **El sistema deberá** comparar direcciones contra las vías del sector ignorando mayúsculas, tildes y abreviaturas `Av.`, `Cll.`, `Urb.`. [D-03]

---

### CU-07 — Gestionar las palabras clave de clasificación

- **Actor principal:** Administrador.
- **Actor secundario:** Operador de la central (ejecuta la ingesta, CU-08).
- **Ciclo:** C2. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01); `averias.json` accesible para calcular la vista previa del impacto.
- **Postcondiciones:** `claves_clasificacion.json` contiene la lista de claves vigente, el modo de normalización y los campos evaluados, con el impacto del cambio aceptado por el administrador.

**Trazabilidad:** RF-27, RF-17; RN-03; RNF-09, RNF-10; RT-07; D-05, D-11, D-26; H-08.

**Flujo principal**

1. El administrador entra en CONFIGURACION → **PALABRAS CLAVE**.
2. El sistema muestra las claves vigentes (`LOSS ROJO`, `FALLA FIBRA`, `FIBRA DAÑADA` en la primera ejecución), el modo de búsqueda (`normalizada` por defecto) y los 4 campos evaluados (`ultimo_comentario`, `problema_reporte`, `informacion_1`, `informacion_2`).
3. El administrador agrega, modifica o quita una clave y/o cambia el modo entre `estricta` y `normalizada`.
4. El administrador pulsa *Vista previa del impacto*.
5. El sistema recorre `averias.json`, cuenta los casos cuyo `status` cambiaría entre PEND y GESTION con el nuevo conjunto y modo, y muestra el resumen: total evaluado, casos que pasarían a PEND y casos que pasarían a GESTION, con la lista de `id_averia` afectados.
6. El administrador confirma el cambio.
7. El sistema escribe `claves_clasificacion.json`, relee el archivo y muestra «Claves guardadas» junto con el número de claves activas.

**Flujos alternativos**

- **3a. Clave vacía o duplicada.** El sistema muestra «La clave ya existe: FALLA FIBRA» o «La clave no puede estar vacía» y no permite continuar.
- **4a. Sin vista previa aceptada.** Si el administrador pulsa *Guardar* sin ejecutar la vista previa, el sistema la ejecuta automáticamente y exige confirmación antes de persistir. [D-26]
- **5a. `averias.json` ausente o inválido.** El sistema muestra «No se puede calcular el impacto: maestro no disponible», permite guardar la lista y advierte que los casos existentes no se reclasifican retroactivamente. [H-20]
- **7a. Fallo de escritura.** El sistema conserva la lista anterior y muestra «No se pudo guardar `claves_clasificacion.json`». [CU-21]

**Criterios de aceptación (Gherkin)**

1. **Dado** el archivo con las 3 claves por defecto y modo `normalizada`, **Cuando** el administrador abre la pantalla, **Entonces** la lista muestra `LOSS ROJO`, `FALLA FIBRA` y `FIBRA DAÑADA` y el modo seleccionado es `normalizada`.
2. **Dado** un maestro de 1.000 casos, **Cuando** el administrador agrega la clave `FIBRA DAÑADA` y pulsa *Vista previa del impacto*, **Entonces** el sistema muestra el total evaluado, cuántos casos pasarían a PEND y cuántos a GESTION y la lista de sus `id_averia`, sin modificar todavía `claves_clasificacion.json`.
3. **Dado** que la vista previa indica que 17 casos pasan a PEND, **Cuando** el administrador confirma, **Entonces** `claves_clasificacion.json` contiene la nueva clave y la relectura del archivo devuelve el mismo contenido.
4. **Dado** el texto `Fibra Danada` en `ultimo_comentario` y el modo `normalizada` con la clave `FIBRA DAÑADA`, **Cuando** se clasifica el caso, **Entonces** el sistema lo trata como coincidencia y el caso queda en `status = PEND`.
5. **Dado** el texto `Loss Rojo` en `problema_reporte` y el modo `estricta` con la clave `LOSS ROJO`, **Cuando** se clasifica el caso, **Entonces** el sistema lo trata como coincidencia y el caso queda en `status = PEND`.
6. **Dado** que el administrador intenta guardar la clave `FALLA FIBRA` cuando ya existe, **Cuando** pulsa *Agregar*, **Entonces** el sistema muestra «La clave ya existe» y el archivo no cambia.

**Restricciones del sistema (EARS)**

- **Cuando** el administrador cambie la lista de claves o el modo de búsqueda, el sistema deberá mostrar la vista previa de los casos afectados antes de persistir. [D-26, H-08]
- **El sistema deberá** evaluar las claves por subcadena sobre el texto normalizado (mayúsculas, sin tildes, espacios colapsados) en `ultimo_comentario`, `problema_reporte`, `informacion_1` e `informacion_2`. [RN-03, D-26]
- **Si** el maestro no está disponible, entonces el sistema deberá permitir guardar la lista y advertir que no se reclasifican los casos existentes. [RNF-10]
- **El sistema deberá** registrar el operador y la fecha/hora de cada cambio de claves o de modo. [RNF-09]

---

### CU-08 — Ingestar el CSV diario

- **Actor principal:** Operador de la central.
- **Actores secundarios:** Emisor del CSV (origen del archivo); administrador (CU-07 define las claves).
- **Ciclo:** C2. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01); `central.json` completo (CU-02); `estructura.json` posicional vigente; `sectores.json` y `claves_clasificacion.json` disponibles; el archivo `detalle_averias_gpon DD_MM_AAAA.csv` (separador `;`, UTF-8, 80 columnas) está en disco.
- **Postcondiciones:** `averias.json` contiene los casos nuevos de Francisco Salias con `ingreso`, `clase = REP`, `nivel = COM`, `tipo_abonado`, `sector` (o en cola) y `status` según RN-03 con precedencia de `ASGN`; los casos ya existentes no se duplican.

**Trazabilidad:** RF-16, RF-17, RF-18, RF-19; RN-01, RN-02, RN-03, RN-04; RNF-02, RNF-04, RNF-06, RNF-10; RT-02, RT-03, RT-04, RT-07, RT-08; D-05, D-06, D-10, D-12, D-13, D-17, D-21, D-26; H-03, H-24, H-27.

**Flujo principal**

1. El operador abre la pestaña que contiene el bloque **INGESTA**, pulsa *Cargar CSV diario* y elige el archivo `detalle_averias_gpon DD_MM_AAAA.csv`.
2. El sistema lee el archivo con separador `;` y codificación UTF-8, sin usar los nombres de encabezado, y verifica **bloqueantemente**: 80 columnas, orden posicional y campos obligatorios legibles.
3. El sistema aplica el filtro de central de `central.json` sobre las columnas 1 a 10 y descarta los registros de otras centrales (en la muestra del 12/09/2026: descarta 5 de LAS MERCEDES CPA y EL HATILLO).
4. El sistema extrae las columnas declaradas en `estructura.json` según su posición, incluidas `informacion` (col. 31) → `informacion_1`, `informacion` (col. 32) → `informacion_2`, `estatus` (col. 27), `unidad_negocio` (col. 61) y `ups` (col. 62).
5. El sistema descarta los casos cuyo `id_averia` (col. 11) ya existe en `averias.json` y calcula el resumen: registros leídos, descartados por central, descartados por duplicado y nuevos a insertar.
6. El sistema clasifica cada caso nuevo: si el `estatus` del CSV es `ASGN`, el caso entra con `status = ASGN`; si no, busca las claves de `claves_clasificacion.json` por subcadena sobre el texto normalizado en `ultimo_comentario`, `problema_reporte`, `informacion_1` e `informacion_2`: con coincidencia entra `status = PEND`; sin coincidencia entra `status = GESTION`.
7. El sistema completa `sector` emparejando `direccion` contra las vías de `sectores.json`; las direcciones sin coincidencia quedan en la cola de CU-09 sin frenar la inserción del resto.
8. El sistema completa `tipo_abonado` = `EMP` cuando `unidad_negocio` = `CANTV EMPRESAS` o `ups` = `NRES`; en el resto de los casos `RES`.
9. El sistema recorta `fecha_reporte` (col. 15) a `DD/MM/AAAA` y conserva el texto completo con hora en `fecha_reporte_original`.
10. El sistema asigna a cada caso nuevo `ingreso` = fecha de la ingesta, `clase = REP` y `nivel = COM`.
11. El sistema presenta el resumen final por estado (PEND, GESTION, ASGN), por `tipo_abonado` y la lista de direcciones sin sector, y solicita *Confirmar ingesta*.
12. El operador confirma; el sistema escribe `averias.json` (respaldo previo según CU-21), relee el archivo, verifica que el conteo aumentó exactamente en el número de casos nuevos y muestra «Ingesta completada: N casos nuevos, M descartados por duplicado, K direcciones sin sector».

**Flujos alternativos**

- **2a. El archivo no tiene 80 columnas o el orden no coincide con `estructura.json`.** El sistema aborta la ingesta sin escribir nada, muestra «Contrato de ingesta inválido: se esperaban 80 columnas y se encontraron X; columna 31 esperada `informacion` y encontrada `Y`» y ofrece descargar el detalle de la cabecera leída. [D-21, H-24]
- **2b. Codificación o separador distintos.** El sistema detecta que la primera fila no se puede partir en 80 campos con `;`, aborta y muestra «Verifique que el archivo use `;` y codificación UTF-8». [RT-08]
- **5a. Todos los registros son duplicados.** El sistema muestra «0 casos nuevos: los 51 registros de Francisco Salias ya existen» y no escribe el maestro. [RN-01, RNF-04]
- **6a. La lista de claves está vacía.** El sistema avisa «No hay palabras clave configuradas: todos los casos entrarían en GESTION» y exige confirmación explícita antes de continuar. [RN-03, RF-27]
- **9a. Fecha con formato inesperado.** El sistema conserva el texto original íntegro en `fecha_reporte_original`, deja `fecha_reporte` vacía, cuenta el caso en el informe de incidencias y continúa con los demás. [D-21]
- **12a. Fallo de escritura sobre `C:\GGTO\datos\averias.json`.** El sistema no confirma la ingesta, conserva el resumen en pantalla, muestra «No se pudo escribir el maestro: &lt;detalle&gt;» y ofrece *Reintentar* y *Guardar en `datos_respaldo`*. [CU-21, H-09]
- **12b. Reingesta del mismo archivo.** El sistema descarta el 100 % de los registros por duplicado y deja el maestro idéntico: mismo número de registros y mismos `id_averia`. [RNF-04, H-27]
- **2c. El archivo no llega.** El operador no encuentra el archivo: el sistema mantiene el maestro del día anterior y no altera la fecha de ingesta; el supervisor registra la incidencia fuera de la página (el procedimiento de escalamiento con el emisor sigue pendiente). [H-15, H-24]

**Criterios de aceptación (Gherkin)**

1. **Dado** el archivo `detalle_averias_gpon 12_09_2026.csv` con 80 columnas y 56 registros, y un `averias.json` con 0 casos, **Cuando** el operador confirma la ingesta, **Entonces** el sistema inserta **51 casos** (los de `nombre central = FRANCISCO SALIAS`) y descarta 5 por central distinta.
2. **Dado** el mismo archivo, **Cuando** el operador ejecuta la ingesta una segunda vez, **Entonces** el sistema informa «0 casos nuevos, 51 duplicados» y `averias.json` conserva exactamente los mismos 51 `id_averia`.
3. **Dado** los 51 casos ingeridos, **Cuando** el sistema aplica la clasificación, **Entonces** **17** casos quedan en `status = PEND` y **39** en `status = GESTION` según la muestra verificada, salvo los que traigan `estatus = ASGN` en el CSV, que quedan en `ASGN`.
4. **Dado** un registro con `estatus = ASGN` en la columna 27, **Cuando** se ingiere, **Entonces** el caso queda en `status = ASGN` aunque su texto no contenga ninguna palabra clave de fibra.
5. **Dado** un archivo con 79 columnas, **Cuando** el operador confirma la ingesta, **Entonces** el sistema muestra «Contrato de ingesta inválido: se esperaban 80 columnas y se encontraron 79» y `averias.json` no se modifica.
6. **Dado** un caso nuevo con `unidad_negocio = CANTV EMPRESAS` y `ups = NRES`, **Cuando** se ingiere, **Entonces** el caso queda con `tipo_abonado = EMP`.
7. **Dado** los 51 casos nuevos, **Cuando** termina la ingesta, **Entonces** cada uno tiene `ingreso` = 13/09/2026, `clase = REP`, `nivel = COM` y `tipo_abonado` informado.
8. **Dado** un registro con `fecha_reporte = 17/07/2026 11:38:20 a.m.`, **Cuando** se ingiere, **Entonces** el caso queda con `fecha_reporte = 17/07/2026` y `fecha_reporte_original = 17/07/2026 11:38:20 a.m.`.
9. **Dado** un maestro con 1.000 casos y un CSV de 60 registros, **Cuando** el operador ejecuta la ingesta, **Entonces** el sistema termina la validación, el descarte y la inserción en menos de 1,5 s de trabajo de datos y presenta el resumen en pantalla.

**Restricciones del sistema (EARS)**

- **Cuando** el operador inicie la ingesta, el sistema deberá validar el contrato posicional de 80 columnas y **abortar** la operación completa si no coincide. [D-21, H-03, H-24]
- **Si** un `id_averia` ya existe en `averias.json`, entonces el sistema deberá descartar el registro y no modificar el caso existente. [RN-01, RNF-04]
- **El sistema deberá** evaluar las palabras clave en `ultimo_comentario`, `problema_reporte`, `informacion_1` e `informacion_2`, por subcadena sobre texto normalizado. [RN-03, D-26]
- **De acuerdo con** el estatus del CSV, el sistema deberá dar precedencia a `ASGN` sobre la clasificación por palabras clave. [D-21, D-13]
- **El sistema deberá** insertar todo caso ingerido con `clase = REP` y `nivel = COM`, dejando la corrección a `CNS` o `REF` para la edición manual. [RN-02, D-06]
- **Mientras** existan direcciones sin sector, el sistema deberá mantenerlas en una cola visible sin impedir la inserción de los demás casos. [RN-04, CU-09]
- **El sistema deberá** conservar el texto original de la fecha con hora y recortar el valor de trabajo a `DD/MM/AAAA`. [D-21, RNF-06]
- **Si** la escritura del maestro falla, entonces el sistema deberá informar el error y no confirmar la ingesta como exitosa. [RNF-10, H-09]

---

### CU-09 — Resolver la asignación de sector y las direcciones sin coincidencia

- **Actor principal:** Operador de la central.
- **Actor secundario:** Administrador (puede crear el sector que falte, CU-06).
- **Ciclo:** C2. **Prioridad:** MVP.
- **Precondiciones:** existe al menos un caso con `sector` vacío proveniente de la ingesta (CU-08) o de un alta manual (CU-14); `sectores.json` disponible.
- **Postcondiciones:** cada caso de la cola tiene un `sector` existente en `sectores.json`, o queda registrado como pendiente con su motivo.

**Trazabilidad:** RF-18; RN-04; RNF-04, RNF-09, RNF-10; RT-03; D-03, D-25; H-18.

**Flujo principal**

1. El operador abre la pestaña CONFIGURACION → **SECTORES** → *Cola de asignación* (o el aviso de pendientes que deja CU-08).
2. El sistema lista los casos sin sector con `id_averia`, `direccion`, `nombre` y fecha de ingreso, ordenados por antigüedad.
3. El operador selecciona un caso; el sistema muestra la dirección completa y la lista de sectores con sus vías.
4. El operador elige un sector existente y pulsa *Asignar*.
5. El sistema verifica que el sector exista, escribe `averias.sector`, relee el archivo y quita el caso de la cola.
6. Si ningún sector corresponde, el operador pulsa *Crear sector desde esta dirección*, informa `id`, `nombre` y las vías (tomando la dirección como primera vía) y el sistema crea el sector (CU-06) y asigna el caso.
7. El sistema muestra el contador actualizado de casos sin sector y registra la asignación con operador y fecha/hora.

**Flujos alternativos**

- **5a. El sector elegido fue eliminado por otro proceso.** El sistema muestra «El sector 4 ya no existe. Actualice la lista» y mantiene el caso en la cola.
- **6a. `id` de sector repetido al crearlo desde la dirección.** El sistema muestra «El sector 4 ya existe» y devuelve al paso 4 con la lista actualizada.
- **2a. La cola está vacía.** El sistema muestra «Todas las direcciones tienen sector asignado» y no ofrece acciones.
- **3a. La dirección es ambigua (coincide con dos sectores).** El sistema muestra ambos sectores con las vías coincidentes y exige que el operador elija uno explícitamente; nunca asigna automáticamente el primero. [RN-04, H-18]

**Criterios de aceptación (Gherkin)**

1. **Dado** 7 casos sin sector tras la ingesta, **Cuando** el operador abre la cola, **Entonces** el sistema muestra los 7 casos ordenados por fecha de ingreso ascendente.
2. **Dado** un caso con dirección `AV INTERCOMUNAL PRADOS DEL ESTE CASA 5` y el sector `1` con la vía `Av. Intercomunal`, **Cuando** el operador asigna el sector `1`, **Entonces** el caso queda con `sector = 1` y la cola pasa a 6 casos.
3. **Dado** un caso cuya dirección coincide con las vías de los sectores `1` y `4`, **Cuando** el operador abre el caso, **Entonces** el sistema muestra ambos sectores y no asigna ninguno hasta que el operador elija uno.
4. **Dado** que el operador pulsa *Crear sector desde esta dirección* con `id = 9`, `nombre = Baruta`, `vias = [Calle Sucre]`, **Cuando** confirma, **Entonces** `sectores.json` contiene el sector `9` y el caso queda con `sector = 9`.
5. **Dado** que el operador asigna un sector, **Cuando** el sistema persiste, **Entonces** el archivo `averias.json` releído contiene el nuevo `sector` y el caso registra `usuario_modificacion` y `fecha_modificacion`.

**Restricciones del sistema (EARS)**

- **Si** la dirección del caso coincide con más de un sector, entonces el sistema deberá exigir selección manual y no asignar por defecto. [RN-04, H-18]
- **Si** el operador indica un sector que no existe en `sectores.json`, entonces el sistema deberá rechazar la asignación y ofrecer crearlo. [RNF-10]
- **Mientras** un caso no tenga sector, el sistema deberá mostrarlo en la cola de pendientes y marcarlo en la tabla de CASOS. [RN-04]
- **El sistema deberá** registrar el operador y la fecha/hora de cada asignación de sector. [RNF-09]

---

### CU-10 — Gestionar y filtrar los CASOS

- **Actor principal:** Operador de la central.
- **Actor secundario:** Supervisor (consulta las mismas vistas).
- **Ciclo:** C1 (tabla) / C3 (clasificación). **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01); `averias.json` legible.
- **Postcondiciones:** la tabla muestra los casos con las columnas resumen y los filtros/agrupaciones aplicados; toda edición de `clase`, `nivel` o `tipo_abonado` queda persistida.

**Trazabilidad:** RF-07, RF-21, RF-23, RF-24; RN-07; RNF-01, RNF-02, RNF-07, RNF-09, RNF-10; RT-01, RT-04; D-06, D-23, D-24, D-17; H-05, H-28.

**Flujo principal**

1. El operador abre la pestaña **CASOS**.
2. El sistema carga `averias.json` y dibuja la tabla con las 7 columnas resumen: `nivel`, `clase`, `sector`, `id_averia`, `nombre`, `direccion`, `plan`.
3. El sistema muestra los controles de agrupación y filtrado: **abiertos/cerrados** (abierto = `status` distinto de `CERRADO`), **cuadrilla** (`Reparador Principal`), **tipo** (combinación `clase` + `nivel` calculada en pantalla: REP-COM, REP-REF, CNS-COM, CNS-REF), **clase**, **nivel** y **estatus**, más un cuadro de texto de búsqueda libre.
4. El operador aplica uno o varios filtros y/o elige una agrupación; el sistema recalcula y muestra el conteo por grupo.
5. El operador ordena por cualquier columna visible con un clic en el encabezado.
6. El operador selecciona un caso; el sistema resalta la fila y ofrece *Ver detalle* (CU-11).
7. El operador edita `clase` y/o `nivel` y/o `tipo_abonado` en línea y pulsa *Guardar*.
8. El sistema valida los enums (`clase` ∈ {REP, CNS}; `nivel` ∈ {COM, REF}; `tipo_abonado` ∈ {RES, EMP}), persiste el cambio en `averias.json`, relee el archivo y confirma con «Caso &lt;id_averia&gt; actualizado».

**Flujos alternativos**

- **2a. `averias.json` no existe.** El sistema muestra la tabla vacía con «No hay maestro de casos. Ejecute la ingesta (CU-08) o cree un caso manual (CU-14)». [H-20]
- **2b. `averias.json` tiene JSON inválido.** El sistema bloquea la tabla, muestra el detalle del error y ofrece *Restaurar desde respaldo* (CU-21).
- **8a. Valor fuera del enum.** El sistema muestra «Clase inválida: use REP o CNS» y no persiste.
- **8b. Fallo de escritura.** El sistema revierte el valor en pantalla, muestra «No se guardó el cambio» y deja el caso en su estado anterior. [H-09]
- **4a. El filtro no devuelve filas.** El sistema muestra «0 casos para los filtros aplicados» y ofrece *Limpiar filtros*.
- **5a. Orden por columna con valores vacíos.** El sistema coloca los vacíos al final del orden, en ambos sentidos.

**Criterios de aceptación (Gherkin)**

1. **Dado** un `averias.json` con 1.000 casos, **Cuando** el operador abre CASOS, **Entonces** la tabla se dibuja con las 7 columnas resumen en **menos de 1,5 s**.
2. **Dado** el mismo maestro, **Cuando** el operador aplica el filtro `estatus = GESTION` y ordena por `sector`, **Entonces** el resultado y el orden se muestran en **menos de 1,5 s**.
3. **Dado** un caso con `clase = REP` y `nivel = COM`, **Cuando** el operador abre el filtro **tipo**, **Entonces** el caso aparece en el grupo `REP-COM` y no en `CNS-COM` ni en `REP-REF`.
4. **Dado** un caso con `status = CERRADO` y otro con `status = PEND`, **Cuando** el operador aplica el filtro **abiertos**, **Entonces** la tabla muestra solo el caso `PEND` y el conteo indica 1.
5. **Dado** 12 casos con `Reparador Principal = C1` y 8 con `C2`, **Cuando** el operador filtra por cuadrilla `C1`, **Entonces** la tabla muestra 12 filas y el conteo indica 12.
6. **Dado** un caso `CNS` con `nivel = COM`, **Cuando** el operador cambia `clase` a `REP` y guarda, **Entonces** `averias.json` releído contiene `clase = REP` y el caso registra operador y fecha/hora del cambio.
7. **Dado** un caso `REP-COM`, **Cuando** el operador intenta guardar `nivel = EMP`, **Entonces** el sistema muestra «Nivel inválido: use COM o REF» y el archivo no cambia.
8. **Dado** un caso con `tipo_abonado` vacío, **Cuando** el operador lo establece en `EMP` y guarda, **Entonces** el caso aparece en el filtro `tipo_abonado = EMP` y en las métricas de gestión empresarial (CU-18).

**Restricciones del sistema (EARS)**

- **Mientras** la tabla muestre más de 200 casos, el sistema deberá paginar o virtualizar el dibujo para mantener el umbral de 1,5 s. [RNF-02, D-24]
- **Cuando** se modifique un caso, el sistema deberá escribir el cambio en `averias.json` y releer el archivo antes de confirmar. [RN-07, RF-24]
- **Si** el valor editado no pertenece al enum, entonces el sistema deberá rechazar el cambio sin escribir el archivo. [RNF-10]
- **El sistema deberá** mostrar los valores de la tabla con la nomenclatura del dominio (`REP`, `CNS`, `COM`, `REF`, `PEND`, `ASGN`, `GESTION`, `CERRADO`). [RNF-07]
- **El sistema deberá** calcular el «tipo» en pantalla como combinación de `clase` + `nivel`, sin crear un campo nuevo en el archivo. [D-23]

---

### CU-11 — Consultar la ficha de un caso

- **Actor principal:** Operador de la central.
- **Actores secundarios:** Supervisor.
- **Ciclo:** C3. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) o modo consulta; `averias.json` legible.
- **Postcondiciones:** la ficha muestra todos los campos del caso agrupados en secciones; ninguna escritura se produce por el solo hecho de consultar.

**Trazabilidad:** RF-02, RF-22 (apertura del flotante); RNF-01, RNF-02; RT-04; D-09; H-19.

**Flujo principal**

1. El operador abre la pestaña **PANEL** o la tabla **CASOS** (CU-10).
2. El operador escribe un `id_averia` o un `telefono` en el campo de búsqueda y pulsa *Buscar*.
3. El sistema busca en `averias.json`: coincidencia exacta por `id_averia`; si el criterio son solo dígitos, también por `telefono`.
4. El sistema muestra la ficha básica con los datos resumen (nivel, clase, sector, `id_averia`, nombre, dirección, plan) y el `status` vigente.
5. El operador pulsa *Ver detalle*; el sistema abre el flotante con toda la información restante agrupada en secciones: **Abonado y contacto** (`persona_reporta`, `contacto`, `nombre`, `direccion`), **Red y planta externa** (`olt`, `plan`, `slot`, `puerto`, `fat`, `serial`, `extra`, `ups`), **Diagnóstico** (`ultimo_comentario`, `problema_reporte`, `informacion_1`, `informacion_2`, `codigos_sin_gestion_en_VENAPP`), **Clasificación** (`clase`, `nivel`, `tipo_abonado`, `sector`) y **Gestión** (`status`, `resolucion`, `fechaResolucion`, `observaciones`, `sacas`).
6. El sistema muestra los botones *Cerrar caso* y *Cancelar*: *Cerrar caso* queda habilitado si el caso está abierto (para capturar `resolucion` y `fechaResolucion`) y deshabilitado si el caso ya está `CERRADO` (con la fecha de cierre como texto).
7. El operador cierra el flotante con *Cancelar* o con la tecla `Esc`; el sistema vuelve a la vista anterior sin escribir en disco.

**Flujos alternativos**

- **3a. Un `id_averia` no existe.** El sistema muestra «No se encontró el caso con id &lt;valor&gt;» y sugiere buscar por teléfono.
- **3b. El teléfono devuelve varios casos.** El sistema muestra la lista de coincidencias con `id_averia`, nombre, dirección y `status`, y exige que el operador elija uno; nunca abre el primero automáticamente. [H-19]
- **3c. Búsqueda vacía.** El sistema muestra «Escriba un id_averia o un teléfono» y no busca.
- **5a. El caso ya está `CERRADO`.** El sistema muestra el flotante en modo lectura, con `resolucion`, `fechaResolucion`, `observaciones` y `sacas` visibles, y el botón *Cerrar caso* deshabilitado con el texto «Caso cerrado el DD/MM/AAAA». [H-19]
- **2a. `averias.json` no disponible.** El sistema muestra «Maestro de casos no disponible» y ofrece *Restaurar desde respaldo*. [CU-21]

**Criterios de aceptación (Gherkin)**

1. **Dado** un caso con `id_averia = 2026-00123` en el maestro, **Cuando** el operador lo busca por ese id, **Entonces** la ficha muestra `2026-00123`, el nombre, la dirección, el plan y el `status` vigente.
2. **Dado** un caso con `telefono = 02121234567`, **Cuando** el operador busca ese número, **Entonces** el sistema muestra la ficha del caso.
3. **Dado** dos casos con el mismo `telefono` `02121234567`, **Cuando** el operador busca ese número, **Entonces** el sistema muestra una lista con 2 coincidencias e `id_averia` distintos y no abre ninguna ficha hasta que el operador elija.
4. **Dado** un caso seleccionado, **Cuando** el operador pulsa *Ver detalle*, **Entonces** el flotante muestra las 5 secciones con los campos de `averias.json` y ningún campo queda fuera.
5. **Dado** un caso con `status = CERRADO`, `resolucion = COS` y `fechaResolucion = 12/09/2026`, **Cuando** el operador abre el detalle, **Entonces** el botón *Cerrar caso* está deshabilitado y muestra «Caso cerrado el 12/09/2026».
6. **Dado** un caso abierto y el flotante abierto, **Cuando** el operador pulsa *Cancelar*, **Entonces** el flotante se cierra y la fecha de modificación del caso no cambia.

**Restricciones del sistema (EARS)**

- **Cuando** la búsqueda por `telefono` devuelva más de un caso, el sistema deberá exigir la selección explícita del operador. [H-19]
- **Mientras** la sesión esté en modo consulta, el sistema deberá mostrar el detalle sin habilitar acciones de escritura. [RNF-08]
- **El sistema deberá** mostrar las fechas en formato `DD/MM/AAAA`. [RNF-06]
- **El sistema deberá** abrir la ficha en menos de 1,5 s con un maestro de 1.000 casos. [RNF-02, D-24]

---

### CU-12 — Cerrar un caso

- **Actor principal:** Operador de la central.
- **Actor secundario:** Supervisor (verifica los cierres en MONITOREO).
- **Ciclo:** C3 (y C1 para el cierre desde el flotante de CASOS). **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01); el caso existe en `averias.json` y su `status` es distinto de `CERRADO`.
- **Postcondiciones:** el caso queda con `status = CERRADO`, `resolucion`, `fechaResolucion`, `observaciones` y `sacas` persistidos; el cambio queda auditado.

**Trazabilidad:** RF-03, RF-22, RF-24; RN-07; RNF-06, RNF-09, RNF-10; RT-01; D-13, D-20; H-11, H-19.

**Flujo principal**

1. El operador localiza el caso por `id_averia` o `telefono` (CU-11) y abre el flotante de detalle.
2. El operador pulsa *Cerrar caso*.
3. El sistema habilita el bloque de cierre con los campos: `resolucion` (lista IVR / COS / COLA), `fechaResolucion` (`DD/MM/AAAA`, propuesta con la fecha del día), `observaciones` (texto libre) y `sacas` (SI / NO).
4. El operador completa `resolucion` y `fechaResolucion`, y opcionalmente `observaciones` y `sacas`.
5. El sistema valida: `resolucion` ∈ {IVR, COS, COLA}; `fechaResolucion` con formato `DD/MM/AAAA` y fecha válida; `sacas` ∈ {SI, NO}; `observaciones` de hasta 500 caracteres.
6. El operador pulsa *Confirmar cierre*.
7. El sistema escribe en `averias.json`: `status = CERRADO`, los 4 campos del cierre, `usuario_modificacion` = operador de la sesión y `fecha_modificacion` = fecha/hora actual; relee el archivo y verifica el cambio.
8. El sistema muestra «Caso &lt;id_averia&gt; cerrado con resolución COS» y actualiza la fila de la tabla; el botón *Cerrar caso* queda deshabilitado para ese caso.

**Flujos alternativos**

- **5a. Falta `resolucion`.** El sistema mantiene deshabilitado el botón *Confirmar cierre*, marca el campo y muestra «Indique la resolución (IVR, COS o COLA)». [D-20, H-11]
- **5b. Falta `fechaResolucion`.** Igual que 5a, con el mensaje «Indique la fecha de resolución en formato DD/MM/AAAA».
- **5c. `fechaResolucion` con formato inválido (por ejemplo `31/02/2026`).** El sistema muestra «Fecha inválida: use DD/MM/AAAA con una fecha real» y no permite confirmar.
- **5d. `sacas` con valor fuera del enum.** El sistema muestra «Sacas debe ser SI o NO» y no permite confirmar.
- **1a. El caso ya está `CERRADO`.** El sistema muestra el cierre vigente y ofrece *Reabrir caso*; si el operador confirma la reapertura, el caso pasa a `status = GESTION`, se conservan `resolucion` y `fechaResolucion` anteriores en `observaciones` con la marca «Reapertura DD/MM/AAAA hh:mm por &lt;operador&gt;» y el cambio se audita. [H-19]
- **7a. Fallo de escritura.** El sistema muestra «No se pudo guardar el cierre», mantiene el caso abierto y ofrece *Reintentar* y *Guardar en `datos_respaldo`*. [H-09]
- **2a. El operador cancela.** El sistema cierra el bloque de cierre sin escribir y el caso conserva su `status` anterior.

**Criterios de aceptación (Gherkin)**

1. **Dado** un caso con `status = PEND`, **Cuando** el operador pulsa *Cerrar caso* sin informar `resolucion` ni `fechaResolucion`, **Entonces** el botón *Confirmar cierre* permanece deshabilitado y el sistema muestra «Indique la resolución (IVR, COS o COLA)».
2. **Dado** el mismo caso con `resolucion = COS` y sin `fechaResolucion`, **Cuando** el operador intenta confirmar, **Entonces** el sistema muestra «Indique la fecha de resolución en formato DD/MM/AAAA» y `averias.json` no cambia.
3. **Dado** un caso con `resolucion = COS`, `fechaResolucion = 13/09/2026`, `observaciones = Reparado en sitio` y `sacas = NO`, **Cuando** el operador confirma el cierre, **Entonces** `averias.json` releído contiene `status = CERRADO` y los 4 campos informados.
4. **Dado** que el operador cierra un caso, **Cuando** el sistema persiste, **Entonces** el caso queda con `usuario_modificacion` igual al P00 de la sesión y `fecha_modificacion` con formato `DD/MM/AAAA hh:mm`.
5. **Dado** un caso `CERRADO` el 12/09/2026, **Cuando** el operador abre su detalle, **Entonces** el botón *Cerrar caso* está deshabilitado con el texto «Caso cerrado el 12/09/2026» y el sistema ofrece *Reabrir caso*.
6. **Dado** una `fechaResolucion = 31/02/2026`, **Cuando** el operador intenta confirmar, **Entonces** el sistema muestra «Fecha inválida» y no permite el cierre.
7. **Dado** un caso abierto, **Cuando** el operador confirma el cierre, **Entonces** la tabla de CASOS actualiza la fila y el filtro «abiertos» deja de contarlo (el conteo baja en 1).

**Restricciones del sistema (EARS)**

- **Mientras** falten `resolucion` o `fechaResolucion`, el sistema deberá mantener deshabilitada la confirmación del cierre. [D-20, RNF-10, H-11]
- **Si** un valor de enum o el formato de fecha son inválidos, entonces el sistema deberá rechazar el cierre sin escribir el archivo. [RNF-10]
- **Cuando** se cierre un caso, el sistema deberá registrar operador y fecha/hora del cambio. [RNF-09, D-16]
- **El sistema deberá** conservar el caso cerrado en el maestro sin purga automática, con finalidad documentada. [D-28]

---

### CU-13 — Gestionar telefónicamente la bandeja GESTION

- **Actor principal:** Operador de la central.
- **Actor secundario:** Supervisor (controla el avance de la bandeja).
- **Ciclo:** C3. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01); existen casos con `status = GESTION` (los 39 sin palabras clave de fibra de la muestra, menos los `ASGN`).
- **Postcondiciones:** cada caso gestionado sale de la bandeja con su clasificación corregida (`clase`, `nivel`, `tipo_abonado`, `sector`) y su resultado registrado; los casos no contactados permanecen en la bandeja con su intento anotado.

**Trazabilidad:** RF-15, RF-07 (clasificación), RF-23, RF-24, RF-28; RN-07; RNF-01, RNF-09, RNF-10; D-06, D-17, D-23; H-27.

**Flujo principal**

1. El operador abre la pestaña **GESTION**.
2. El sistema lista los casos con `status = GESTION`, ordenados por antigüedad de `ingreso` y agrupados por sector, con `id_averia`, teléfono, nombre, dirección, sector y último comentario.
3. El operador selecciona un caso y llama al abonado; el sistema muestra un guion de verificación con los datos del caso a confirmar (dirección, servicio, tipo de abonado, presencia de fibra).
4. El operador registra el resultado de la llamada: *Contactado*, *No contesta*, *Número equivocado* o *Reagendar*; y cuando corresponde, corrige `clase`, `nivel` y `tipo_abonado` y escribe una nota breve en `observaciones`.
5. El sistema valida los enums editados y persiste los cambios con operador y fecha/hora.
6. Cuando el caso queda clasificado, el operador pulsa *Enviar a calle*: el sistema cambia `status` a `PEND` si el caso presenta falla de fibra o a `ASGN` si ya se decidió su asignación, y lo saca de la bandeja.
7. El sistema actualiza el contador de la bandeja y muestra «GESTION: N casos pendientes de llamada, M gestionados hoy».

**Flujos alternativos**

- **4a. No contesta.** El sistema guarda la nota «Sin contacto DD/MM/AAAA hh:mm», mantiene el caso en `GESTION` y conserva su posición en la cola.
- **4b. Número equivocado.** El sistema guarda la nota, mantiene el caso en `GESTION` y lo marca con la etiqueta «Teléfono por verificar».
- **5a. Enum inválido al corregir la clasificación.** El sistema muestra el error y no persiste.
- **6a. El caso tiene `clase = CNS` y no hay cuadrilla con reparaciones en ese sector.** El sistema permite igualmente «Enviar a calle», advierte que la asignación de construcción se resolverá en el despacho (CU-16) y no bloquea el cambio. [RN-06]
- **2a. La bandeja está vacía.** El sistema muestra «No hay casos en GESTION» con la fecha del último cambio de estado.

**Criterios de aceptación (Gherkin)**

1. **Dado** 39 casos con `status = GESTION`, **Cuando** el operador abre la pestaña GESTION, **Entonces** el sistema lista los 39 casos ordenados por antigüedad y agrupados por sector.
2. **Dado** un caso en `GESTION` con `nivel = COM`, **Cuando** el operador verifica por teléfono que es empresarial, cambia `tipo_abonado` a `EMP` y guarda, **Entonces** `averias.json` releído contiene `tipo_abonado = EMP` y el caso registra operador y fecha/hora.
3. **Dado** un caso en `GESTION` sin palabras clave de fibra, **Cuando** el operador confirma «Sin falla de fibra» y pulsa *Enviar a calle*, **Entonces** el caso queda en `status = PEND` y sale de la bandeja (el contador baja en 1).
4. **Dado** un caso en `GESTION`, **Cuando** el operador registra «No contesta», **Entonces** el caso permanece en `status = GESTION`, el contador no cambia y `observaciones` contiene la marca de fecha y hora del intento.
5. **Dado** un caso en `GESTION` con `clase = CNS`, **Cuando** el operador pulsa *Enviar a calle*, **Entonces** el sistema cambia el estado, advierte sobre la asignación de construcción y el caso conserva `clase = CNS`.
6. **Dado** un caso ya gestionado, **Cuando** el operador aplica el filtro «gestionados hoy», **Entonces** el caso aparece en el conteo diario usado por MONITOREO (CU-18).

**Restricciones del sistema (EARS)**

- **Mientras** un caso no tenga resultado de llamada, el sistema deberá mantenerlo en la bandeja `GESTION`. [RF-15]
- **Cuando** el operador cambie `clase`, `nivel` o `tipo_abonado`, el sistema deberá persistir el cambio de inmediato y auditar operador y fecha/hora. [RN-07, RNF-09]
- **Si** el valor editado no pertenece al enum, entonces el sistema deberá rechazarlo sin escribir el archivo. [RNF-10]
- **El sistema deberá** conservar en `observaciones` el rastro de cada intento de contacto con fecha. [D-16]

---

### CU-14 — Dar de alta manual un caso

- **Actor principal:** Operador de la central.
- **Actor secundario:** Administrador (padrones usados en la validación).
- **Ciclo:** C3. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01); `sectores.json` con al menos un sector; `averias.json` legible.
- **Postcondiciones:** el caso existe en `averias.json` con un `id_averia` único con prefijo `MAN-` y el resto de campos obligatorios informados.

**Trazabilidad:** RF-04, RF-28; RN-01, RN-02; RNF-04, RNF-09, RNF-10; RT-01; D-06, D-14, D-17, D-18, D-20; H-02.

**Flujo principal**

1. El operador abre la pestaña **PANEL**, bloque *Nuevo caso*, y pulsa *Agregar caso*.
2. El sistema presenta la lista **cerrada** de campos: fecha del caso (`DD/MM/AAAA`, propuesta con la fecha del día), teléfono, nombre, dirección, contacto, problema reportado, sector (lista de `sectores.json`), clase (REP / CNS), nivel (COM / REF), tipo_abonado (RES / EMP) y observaciones.
3. El operador completa los campos y pulsa *Guardar caso*.
4. El sistema valida: fecha con formato `DD/MM/AAAA`; teléfono con 7 a 15 dígitos; nombre y dirección no vacíos; sector existente en `sectores.json`; clase, nivel y tipo_abonado dentro de sus enums.
5. El sistema genera el `id_averia` como `MAN-` + consecutivo (por ejemplo `MAN-0001`), tomando el mayor consecutivo existente con ese prefijo y verificando que el valor no exista en `averias.json`.
6. El sistema completa los campos no capturados: `ingreso` = fecha del día, `status = GESTION`, `resolucion`, `fechaResolucion`, `sacas` vacíos; `usuario_modificacion` y `fecha_modificacion` con el operador y la hora.
7. El sistema escribe `averias.json`, relee el archivo, verifica que el `id_averia` generado es único y muestra «Caso MAN-0001 creado».
8. El sistema limpia el formulario y muestra el caso en la tabla de CASOS.

**Flujos alternativos**

- **4a. Campo obligatorio vacío.** El sistema marca el campo y muestra «Complete: dirección», sin generar id ni escribir.
- **4b. Sector inexistente.** El sistema muestra «El sector 7 no existe en `sectores.json`» y ofrece abrir CU-06.
- **4c. Fecha inválida.** El sistema muestra «Fecha inválida: use DD/MM/AAAA con una fecha real» y no permite guardar.
- **5a. El id generado ya existe (`MAN-0001` presente en el maestro).** El sistema incrementa el consecutivo hasta encontrar un valor libre, muestra «El id MAN-0001 ya existía; se usó MAN-0002» y continúa con el alta. [D-18, RNF-04]
- **5b. El CSV del día trae un caso con el mismo `MAN-`.** El sistema mantiene el prefijo reservado a los casos manuales y no reutiliza ids del CSV; si detecta colisión, incrementa el consecutivo y lo informa. [RN-01]
- **7a. Fallo de escritura.** El sistema no confirma el alta, conserva los datos en el formulario y ofrece *Reintentar*. [CU-21]
- **2a. Campos del fuente que no existen en el maestro (residuo de A-17/H-02).** A-17 quedó cerrada con D-14 (se descartan los datos de `alta_manual.csv`), pero el fuente original (L8) pedía «Fecha, Tipo, Actividad, Contacto, Nombre, Dirección, Información, Agente, ETC». El formulario aplica la lista cerrada de D-18 y **no** incluye Tipo, Actividad ni Agente; el mapeo de esos tres campos queda pendiente como observación de la auditoría (P6/H-02) y, si se decide incorporarlos, este caso de uso se amplía.

**Criterios de aceptación (Gherkin)**

1. **Dado** el formulario de nuevo caso con fecha `13/09/2026`, teléfono `04141234567`, nombre `María Díaz`, dirección `Calle Sucre 12`, contacto `04149876543`, problema `Sin tono`, sector `1`, clase `REP`, nivel `COM` y tipo_abonado `RES`, **Cuando** el operador pulsa *Guardar caso*, **Entonces** el sistema crea el caso con `id_averia = MAN-0001`.
2. **Dado** un maestro que ya contiene `MAN-0001`, **Cuando** el operador da de alta un caso nuevo, **Entonces** el sistema asigna `MAN-0002` e informa que el consecutivo anterior ya existía.
3. **Dado** el formulario con `direccion` vacía, **Cuando** el operador pulsa *Guardar caso*, **Entonces** el sistema muestra «Complete: dirección» y no crea ningún registro ni consume consecutivo.
4. **Dado** el formulario con `sector = 7` cuando `sectores.json` solo tiene los sectores 1 a 6, **Cuando** el operador guarda, **Entonces** el sistema muestra «El sector 7 no existe en `sectores.json`» y no crea el caso.
5. **Dado** un caso creado manualmente, **Cuando** se lee `averias.json`, **Entonces** el registro tiene `ingreso = 13/09/2026`, `status = GESTION`, `clase = REP`, `nivel = COM`, `sector` informado y `usuario_modificacion` con el P00 de la sesión.
6. **Dado** el formulario de alta, **Cuando** el operador lo abre, **Entonces** los campos mostrados son exactamente los 11 de la lista cerrada y no hay ningún campo libre fuera de ella.
7. **Dado** un caso manual `MAN-0001`, **Cuando** se ejecuta la ingesta del CSV del día, **Entonces** el caso manual no se modifica ni se duplica.

**Restricciones del sistema (EARS)**

- **Cuando** el operador confirme un alta manual, el sistema deberá generar el `id_averia` con el patrón `MAN-` + consecutivo y comprobar su unicidad antes de escribir. [D-18, RN-01]
- **Si** un campo obligatorio falta o un enum es inválido, entonces el sistema deberá rechazar el alta sin escribir el archivo. [RNF-10]
- **Si** el `sector` no existe en `sectores.json`, entonces el sistema deberá rechazar el alta. [RNF-10, D-20]
- **El sistema deberá** registrar el operador y la fecha/hora de creación del caso. [RNF-09]
- **El sistema deberá** limitar el formulario a la lista cerrada de campos definida en D-18. [D-18]

---

### CU-15 — Consultar la auditoría de cambios de un caso

- **Actor principal:** Supervisor.
- **Actores secundarios:** Auditoría / control interno; administrador (responde por la integridad).
- **Ciclo:** C1 (auditoría mínima) / posterior (historial completo de valores anteriores).
- **Prioridad:** MVP (auditoría del último cambio) / posterior (historial completo).
- **Precondiciones:** sesión identificada (CU-01); existe al menos un caso con `usuario_modificacion` y `fecha_modificacion` informados.
- **Postcondiciones:** el supervisor conoce quién cambió el caso, cuándo y qué valores cambiaron, sin alterar el maestro.

**Trazabilidad:** RF-24; RNF-09; RT-01; D-16; H-10.

**Flujo principal**

1. El supervisor abre el flotante de detalle de un caso (CU-11) y pulsa *Ver auditoría*.
2. El sistema muestra la sección **Auditoría** con: `usuario_modificacion`, `fecha_modificacion`, `status`, `clase`, `nivel` y `tipo_abonado` vigentes, y el rastro de origen de la ingesta (`ultimo_usuario`, `usuario_acciona`, `Fecha Hora Asignacion` del CSV, conservados al ingerir).
3. El supervisor solicita el historial de cambios del caso.
4. El sistema muestra la lista de cambios registrados, del más reciente al más antiguo, con fecha/hora, operador, campo, valor anterior y valor nuevo.
5. El supervisor aplica el filtro por rango de fechas y por operador y exporta la vista en pantalla o la imprime.

**Flujos alternativos**

- **2a. El caso nunca fue modificado.** El sistema muestra «Sin cambios posteriores a la ingesta» e indica la fecha de ingesta y, si existe, el usuario de origen del CSV.
- **4a. Historial completo no disponible (alcance MVP).** El sistema muestra solo el último cambio y el aviso «Historial de valores anteriores: pendiente de implementación (H-10)». [H-10]
- **1a. El supervisor no tiene sesión identificada.** El sistema permite la consulta en modo lectura y no habilita ninguna escritura. [RNF-08]

**Criterios de aceptación (Gherkin)**

1. **Dado** un caso modificado por el operador `12345` el `13/09/2026 09:14`, **Cuando** el supervisor abre *Ver auditoría*, **Entonces** el sistema muestra `usuario_modificacion = 12345` y `fecha_modificacion = 13/09/2026 09:14`.
2. **Dado** un caso recién ingerido y nunca editado, **Cuando** el supervisor abre *Ver auditoría*, **Entonces** el sistema muestra «Sin cambios posteriores a la ingesta» y la fecha de ingesta.
3. **Dado** un caso cerrado con resolución `COS`, **Cuando** el supervisor consulta la auditoría, **Entonces** el sistema muestra el cambio de `status` a `CERRADO` con operador y fecha/hora.
4. **Dado** que el supervisor consulta la auditoría, **Cuando** cierra la vista, **Entonces** `averias.json` no cambia (misma fecha de modificación, mismo contenido).
5. **Dado** un filtro por operador `12345` y rango `01/09/2026` a `13/09/2026`, **Cuando** el supervisor aplica, **Entonces** el sistema muestra solo los cambios de ese operador en ese rango.

**Restricciones del sistema (EARS)**

- **Cuando** se modifiquen `status`, `clase`, `nivel`, `tipo_abonado`, `sector` o los campos de cierre, el sistema deberá registrar el operador y la fecha/hora del cambio. [RNF-09, D-16]
- **Mientras** el usuario no tenga sesión identificada, el sistema deberá mostrar la auditoría en modo solo lectura. [RNF-08]
- **El sistema deberá** conservar los valores anteriores de los campos auditados para poder mostrar el historial. [RNF-09, H-10]
- **El sistema deberá** conservar el caso y su historial sin purga automática. [D-28]

---

### CU-16 — Generar y ajustar el despacho del día

- **Actor principal:** Supervisor.
- **Actores secundarios:** Operador de la central (prepara los datos), cuadrillas (destinatarias).
- **Ciclo:** C4. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** casos abiertos en `averias.json` con `sector` asignado; `cuadrillas.json` con cuadrillas activas y sus sectores; existe la definición operativa de «citados del día».
- **Postcondiciones:** el despacho del día queda armado por cuadrilla, con las reglas de reparto verificadas y la asignación persistida en `averias."Reparador Principal"`.

**Trazabilidad:** RF-08, RF-09, RF-20; RN-05, RN-06; RNF-01, RNF-10, RNF-11; RT-05; D-07, D-25; A-05, A-10, A-14 (H-05, H-28).

**Flujo principal**

1. El supervisor abre la pestaña **DESPACHO** y pulsa *Generar despacho del día*.
2. El sistema toma los casos abiertos (abierto = `status` distinto de `CERRADO`) y extrae `id_averia, telefono, persona_reporta, contacto, nombre, direccion, fat, plan, serial` junto con `sector` y `Reparador Principal`.
3. El sistema agrupa los casos por sector y propone una cuadrilla a cada grupo usando `sectores.cuadrilla_sugerida` y los sectores preferentes de `cuadrillas.json`.
4. El sistema verifica las reglas de reparto y marca el resultado por cuadrilla: citados del día incluidos, ≥1 reparación de referidos (`nivel = REF`, `clase = REP`) y ≥1 reparación de empresas (`tipo_abonado = EMP`, `clase = REP`).
5. El sistema asigna la construcción (`clase = CNS`) a **una sola** cuadrilla: la que tenga reparaciones en el mismo sector.
6. El sistema muestra la propuesta por cuadrilla con los incumplimientos señalados.
7. El supervisor ajusta manualmente asignaciones entre cuadrillas hasta que no queden incumplimientos.
8. El supervisor pulsa *Confirmar despacho*; el sistema escribe `Reparador Principal` en cada caso de `averias.json`, relee el archivo y muestra «Despacho confirmado: N casos en K cuadrillas».
9. El sistema deja disponible el despacho confirmado para el PDF por cuadrilla (CU-17).

**Flujos alternativos**

- **2a. No hay casos abiertos.** El sistema muestra «No hay casos abiertos para despachar» y no genera propuesta.
- **4a. Alguna cuadrilla no recibe referidos o empresas.** El sistema marca la cuadrilla en rojo con «Sin reparación de referidos» y/o «Sin reparación de empresas» y exige resolverlo o justificarlo antes de confirmar. [RN-05]
- **5a. Varias cuadrillas tienen reparaciones en el sector de la construcción.** [SUPUESTO: A-10] El sistema propone la cuadrilla con menos casos asignados y, si persiste el empate, la de `id` menor; el supervisor puede cambiarla manualmente y la decisión queda registrada con su operador y fecha/hora. [A-10]
- **2b. La definición de «citados del día» no está cerrada.** [SUPUESTO: A-05] El sistema ofrece un selector manual «Citados del día» sobre los casos abiertos, sin campo de datos que lo determine, y no incluye ningún caso por defecto; el supervisor los marca uno a uno. [A-05]
- **8a. Fallo de escritura.** El sistema no confirma, mantiene la propuesta en pantalla y ofrece *Reintentar*. [CU-21]
- **7a. El supervisor quita todos los casos de una cuadrilla activa.** El sistema avisa «La cuadrilla C2 queda sin casos» y exige confirmación para dejarla fuera del despacho.
- **5b. Ambigüedad A-14.** [SUPUESTO: A-14] La asignación se persiste en `averias."Reparador Principal"`; `despacho.json` conserva sus 12 columnas de L57 y el agrupamiento se calcula en memoria. [A-14]

**Criterios de aceptación (Gherkin)**

1. **Dado** 60 casos abiertos distribuidos en 4 sectores y 3 cuadrillas activas, **Cuando** el supervisor pulsa *Generar despacho del día*, **Entonces** el sistema presenta los 60 casos agrupados por sector con una cuadrilla propuesta para cada grupo.
2. **Dado** un despacho propuesto con la cuadrilla `C1` sin ninguna reparación de referidos, **Cuando** el supervisor intenta confirmar, **Entonces** el sistema muestra «C1: sin reparación de referidos» y no permite confirmar hasta resolverlo o justificarlo.
3. **Dado** 3 casos con `clase = CNS` en el sector `1` y 2 cuadrillas con reparaciones en el sector `1`, **Cuando** el sistema propone el reparto, **Entonces** los 3 casos de construcción quedan en **una sola** cuadrilla.
4. **Dado** un despacho confirmado con 45 casos en 3 cuadrillas, **Cuando** el sistema persiste, **Entonces** `averias.json` releído contiene `Reparador Principal` informado en los 45 casos y el filtro por cuadrilla de CU-10 los encuentra.
5. **Dado** un caso con `Reparador Principal` vacío antes del despacho, **Cuando** se confirma el despacho, **Entonces** ese caso queda asignado a una cuadrilla y deja de contar como «sin asignar» en MONITOREO.
6. **Dado** el despacho del día ya confirmado, **Cuando** el supervisor abre DESPACHO de nuevo, **Entonces** el sistema muestra la asignación vigente y permite modificarla antes de emitir los PDF.

**Restricciones del sistema (EARS)**

- **El sistema deberá** agrupar el despacho por sector y por `Reparador Principal` sobre los casos abiertos. [RF-08, RF-20, L44]
- **Mientras** una cuadrilla no tenga al menos una reparación de referidos y una de empresas, el sistema deberá señalar el incumplimiento antes de permitir la confirmación. [RN-05]
- **Si** existen casos `clase = CNS`, entonces el sistema deberá asignarlos a una única cuadrilla con reparaciones en ese sector. [RN-06]
- **Cuando** el despacho se confirme, el sistema deberá persistir la asignación en `averias."Reparador Principal"` y releer el archivo. [RN-07, A-14]
- **El sistema deberá** registrar operador y fecha/hora de la confirmación y de cada ajuste manual del despacho. [RNF-09, RNF-11]

---

### CU-17 — Emitir el PDF de despacho por cuadrilla y registrar la entrega

- **Actor principal:** Supervisor.
- **Actores secundarios:** Cuadrilla / técnico de calle (recibe la hoja); auditoría / control interno (verifica el control documental).
- **Ciclo:** C4. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** despacho del día confirmado (CU-16); impresora con papel carta disponible; `pdf.js` y `despacho.json` accesibles.
- **Postcondiciones:** existe un PDF por cuadrilla en carta horizontal con las 12 columnas de despacho y la marca de fecha, cuadrilla y número de copia; la entrega queda registrada y las hojas se recogen al cierre.

**Trazabilidad:** RF-10, RF-20; RNF-05, RNF-11; RT-05, RT-07; D-27; H-12.

**Flujo principal**

1. El supervisor abre la pestaña **DESPACHO** con el despacho del día confirmado y pulsa *PDF por cuadrilla*.
2. El sistema construye la proyección `despacho.json` con las 12 columnas: `nivel, clase, id_averia, telefono, persona_reporta, contacto, ultimo_comentario, nombre, direccion, plan, fat, serial`.
3. El sistema genera un PDF por cuadrilla activa con casos asignados, en hoja carta **horizontal**, respetando el área máxima imprimible y paginando cuando el volumen lo exige.
4. El sistema imprime en cada hoja el encabezado con fecha del día, `id` y nombre de la cuadrilla, y el **número de copia**.
5. El sistema guarda los PDF en la ruta controlada definida para el proyecto (no en la carpeta de Descargas) y muestra la lista de archivos generados.
6. El supervisor imprime las hojas y las entrega a cada cuadrilla; en la página pulsa *Registrar entrega* por cuadrilla.
7. El sistema asienta la entrega con fecha, hora, cuadrilla, número de copia y operador, y muestra el estado «Entregado» por cuadrilla.
8. Al cierre de la jornada, el supervisor pulsa *Recoger hojas*; el sistema asienta la recogida y muestra «Hojas recogidas: 3 de 3 cuadrillas».

**Flujos alternativos**

- **3a. Una cuadrilla tiene 0 casos.** El sistema no genera PDF para esa cuadrilla y lo informa en la lista.
- **3b. El volumen de una cuadrilla excede una hoja.** El sistema pagina el contenido y numera las hojas con «Hoja X de Y» conservando fecha, cuadrilla y número de copia en cada hoja. [RNF-05]
- **5a. Fallo de escritura del PDF.** El sistema muestra «No se pudo guardar el PDF de la cuadrilla C2» y permite reintentar por cuadrilla sin regenerar las demás.
- **7a. Una cuadrilla no recibe su hoja.** El sistema mantiene el estado «Pendiente de entrega» y no permite dar el despacho por cerrado hasta registrarlo o justificarlo. [RNF-11]
- **8a. Faltan hojas al cierre.** El sistema muestra «Faltan hojas: C3» y registra la incidencia con fecha, hora y operador. [D-27, H-12]

**Criterios de aceptación (Gherkin)**

1. **Dado** un despacho confirmado con 3 cuadrillas activas, **Cuando** el supervisor pulsa *PDF por cuadrilla*, **Entonces** el sistema genera **3 archivos PDF**, uno por cuadrilla.
2. **Dado** el PDF de la cuadrilla `C1` con 18 casos, **Cuando** se abre el archivo, **Entonces** contiene las 12 columnas de despacho y cabe en una hoja carta horizontal, con el encabezado «Fecha 13/09/2026 — Cuadrilla C1 — Copia 1».
3. **Dado** el PDF de la cuadrilla `C2` con 60 casos, **Cuando** se abre, **Entonces** el contenido está paginado y cada hoja repite fecha, cuadrilla y número de copia con la marca «Hoja X de Y».
4. **Dado** que el supervisor pulsa *Registrar entrega* para `C1` y `C2`, **Cuando** consulta el estado del despacho, **Entonces** el sistema muestra `C1: Entregado`, `C2: Entregado` y `C3: Pendiente de entrega`.
5. **Dado** el despacho del día con 3 cuadrillas entregadas, **Cuando** el supervisor pulsa *Recoger hojas* y solo registra 2, **Entonces** el sistema muestra «Faltan hojas: C3» y asienta la incidencia con fecha, hora y operador.
6. **Dado** un PDF generado, **Cuando** se revisa su ruta, **Entonces** el archivo está en la ruta controlada del proyecto y no en la carpeta de Descargas del puesto.

**Restricciones del sistema (EARS)**

- **Cuando** el supervisor solicite el PDF, el sistema deberá generar un archivo por cuadrilla en orientación carta horizontal, ajustado al área máxima imprimible. [RF-10, RNF-05]
- **El sistema deberá** imprimir fecha, cuadrilla y número de copia en todas las hojas de cada PDF. [D-27, RNF-11]
- **Si** el volumen de una cuadrilla excede una hoja, entonces el sistema deberá paginar repitiendo la marca de control documental en cada hoja. [RNF-05, D-27]
- **El sistema deberá** asentar la entrega y la recogida de las hojas con fecha, hora, cuadrilla y operador. [RNF-11, D-27]
- **El sistema deberá** guardar los PDF en una ruta controlada y no en la carpeta de Descargas. [D-27, H-12]

---

### CU-18 — Monitorear la gestión diaria y semanal

- **Actor principal:** Supervisor.
- **Actor secundario:** Operador de la central (alimenta los datos con su gestión); jefe de central (consume las cifras).
- **Ciclo:** C5. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** `averias.json` con casos de la semana en curso y de la semana anterior; definiciones de métrica acordadas; `averias.json` con `sector` y `Reparador Principal` informados en la mayoría de los casos.
- **Postcondiciones:** las 6 zonas de MONITOREO muestran gráfico y tabla descriptiva; ninguna consulta modifica los datos.

**Trazabilidad:** RF-05, RF-06; RN-08; RNF-02, RNF-06, RNF-07; D-17, D-23, D-24; H-28.

**Flujo principal**

1. El supervisor abre la pestaña **MONITOREO**.
2. El sistema calcula y dibuja las 6 zonas con gráfico y tabla descriptiva: **Gestión Diario** (ingreso nuevo, resuelto residencial, resuelto empresarial, resuelto referidos), **Gestión Semanal** (curva de lunes a sábado), **Casos Globales** (pendiente vs. resuelto), **Reparación** (pendientes por tipo: residenciales comunes, residenciales referidos, empresariales), **Construcción** (pendientes residenciales y empresariales) y **Cuadrilla** (asignados vs. cerrados vs. gestionados por día).
3. El sistema muestra la fecha de corte y el rango de la semana operativa (lunes a sábado) usados en el cálculo.
4. El supervisor cambia la fecha de corte y el sistema recalcula las 6 zonas.
5. El supervisor abre la pestaña **GRAFICOS** y el sistema presenta las mismas 6 zonas como gráficos dedicados: barras (diario, globales, construcción, cuadrilla), curva (semanal) y torta (reparación).
6. El supervisor pasa el cursor sobre una barra o segmento y el sistema muestra el valor exacto y el criterio de cálculo aplicado.

**Flujos alternativos**

- **2a. Maestro con 0 casos en el rango.** El sistema muestra los 6 gráficos vacíos con «Sin datos para el rango seleccionado» y el conteo en 0.
- **2b. Casos sin `sector` o sin `Reparador Principal`.** El sistema los agrupa bajo «Sin asignar» y muestra el conteo de excluidos por cada métrica afectada. [H-28]
- **2c. Métricas no calculables por falta de campos de fecha de asignación.** El sistema muestra «Asignados: criterio pendiente (H-28)» en la zona Cuadrilla y no inventa la cifra. [H-28]
- **4a. Fecha de corte fuera de la semana operativa.** El sistema ajusta el rango al lunes y sábado de la semana correspondiente y lo informa.
- **5a. El navegador no soporta los gráficos locales.** El sistema muestra las tablas descriptivas sin gráfico y advierte «Gráficos no disponibles en este navegador». [RT-07]

**Criterios de aceptación (Gherkin)**

1. **Dado** un maestro con 1.000 casos, **Cuando** el supervisor abre MONITOREO, **Entonces** las 6 zonas se dibujan en **menos de 3 s**.
2. **Dado** un rango de corte en la semana del 08/09/2026 al 13/09/2026, **Cuando** el supervisor abre GESTION SEMANAL, **Entonces** la curva muestra 6 puntos: lunes, martes, miércoles, jueves, viernes y sábado, y ningún punto de domingo.
3. **Dado** 120 casos con `status = CERRADO`, `clase = REP` y `tipo_abonado = RES`, **Cuando** el supervisor consulta GESTION DIARIO, **Entonces** la tabla muestra «Resuelto Residencial: 120».
4. **Dado** 8 casos con `tipo_abonado = EMP` y `status = CERRADO`, **Cuando** el supervisor consulta GESTION DIARIO, **Entonces** la tabla muestra «Resuelto Empresarial: 8».
5. **Dado** 5 casos con `clase = CNS` y `status` distinto de `CERRADO`, **Cuando** el supervisor consulta CONSTRUCCION, **Entonces** la tabla muestra 5 casos pendientes de construcción.
6. **Dado** un caso sin `Reparador Principal`, **Cuando** el supervisor consulta la zona CUADRILLA, **Entonces** el caso aparece en el grupo «Sin asignar» y no distorsiona los totales por cuadrilla.
7. **Dado** que el supervisor abre GRAFICOS, **Cuando** la pestaña termina de cargar, **Entonces** se muestran 6 gráficos: 4 de barras, 1 de curva y 1 de torta.

**Restricciones del sistema (EARS)**

- **El sistema deberá** calcular las métricas sobre la semana operativa de lunes a sábado. [RN-08]
- **Mientras** el maestro contenga 1.000 casos, el sistema deberá dibujar MONITOREO en menos de 3 s. [RNF-02, D-24]
- **Si** un caso no tiene sector o cuadrilla, entonces el sistema deberá agruparlo bajo «Sin asignar» y mostrar el conteo de excluidos. [H-28, RNF-10]
- **El sistema deberá** mostrar el criterio de cálculo y el rango temporal de cada cifra en pantalla. [H-28, RNF-01]
- **El sistema deberá** funcionar sin conexión a internet y sin consultar servicios externos. [RT-07]

---

### CU-19 — Emitir los reportes de trabajo diario y de gestión semanal

- **Actor principal:** Supervisor.
- **Actores secundarios:** Jefe de central; operador de la central (corrige los datos antes de emitir).
- **Ciclo:** C6. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** datos del día y de la semana operativa cargados y corregidos; formato de salida acordado.
- **Postcondiciones:** existe el reporte de trabajo diario y el reporte de gestión semanal con los datos del periodo, y queda constancia de a quién y cuándo se entregaron.

**Trazabilidad:** RF-25; RN-08; RNF-01, RNF-06, RNF-07; D-28; A-08 (H-12, H-28).

**Flujo principal**

1. El supervisor abre el bloque **REPORTES** y elige *Reporte de trabajo diario* o *Reporte de gestión semanal*.
2. El sistema propone la fecha del día (diario) o la semana operativa lunes a sábado (semanal) y muestra el resumen de datos incluidos.
3. El supervisor confirma el periodo y pulsa *Generar*.
4. El sistema construye el reporte con: para el diario, ingreso nuevo, resueltos por tipo de abonado y nivel, pendientes por tipo, casos gestionados y cuadrillas activas; para el semanal, la serie de lunes a sábado y los acumulados de la semana.
5. El sistema presenta el reporte en pantalla con fecha de emisión, periodo, operador emisor y el detalle por cuadrilla.
6. El supervisor elige la salida: *Imprimir* o *Guardar PDF en la ruta controlada*.
7. El sistema genera la salida elegida, la guarda con el nombre `reporte_diario_DD_MM_AAAA` o `reporte_semanal_DD_MM_AAAA_AL_DD_MM_AAAA` y registra la emisión con fecha, hora y operador.
8. El sistema permite volver a emitir el mismo reporte y detecta cambios en los datos, mostrando «El periodo tuvo N cambios desde la última emisión».

**Flujos alternativos**

- **3a. Formato de salida no acordado (A-08 abierto).** [SUPUESTO: A-08] El sistema ofrece **pantalla + PDF en carta** como salida por defecto, no genera XLSX y lo advierte en la propia pantalla; cuando A-08 se cierre se ajusta la salida. [A-08]
- **2a. Sin datos en el periodo.** El sistema muestra «Sin datos en el periodo seleccionado» y no genera archivo.
- **4a. Casos sin clasificar.** El sistema incluye la fila «Sin clasificar» con su conteo y no los reparte entre categorías.
- **6a. Fallo al guardar el PDF.** El sistema mantiene el reporte en pantalla y ofrece *Reintentar* o *Imprimir*.
- **8a. Reemisión tras correcciones.** El sistema genera una nueva versión con la marca «Reemisión DD/MM/AAAA hh:mm — &lt;operador&gt;» y conserva la anterior en la ruta controlada. [RNF-11, D-27]

**Criterios de aceptación (Gherkin)**

1. **Dado** los datos del 13/09/2026 con 51 casos ingresados y 30 cerrados, **Cuando** el supervisor genera el reporte diario, **Entonces** el reporte muestra ingreso nuevo 51, cerrados 30 y el desglose por tipo de abonado, y el archivo se guarda como `reporte_diario_13_09_2026.pdf`.
2. **Dado** la semana operativa del 08/09/2026 al 13/09/2026, **Cuando** el supervisor genera el reporte semanal, **Entonces** el reporte muestra 6 columnas (lunes a sábado) y ningún domingo.
3. **Dado** un reporte emitido por el operador `12345` a las 14:20 del 13/09/2026, **Cuando** el supervisor consulta la emisión, **Entonces** el sistema muestra fecha, hora y operador emisor.
4. **Dado** el reporte diario del 13/09/2026 ya emitido, **Cuando** el supervisor lo vuelve a generar tras cerrar 3 casos, **Entonces** el sistema muestra «El periodo tuvo 3 cambios desde la última emisión» y genera una reemisión marcada.
5. **Dado** que el supervisor solicita el reporte en XLSX, **Cuando** el sistema no lo tiene implementado, **Entonces** muestra «Salida no disponible: se ofrece pantalla y PDF (A-08 pendiente)» y no genera ningún archivo.

**Restricciones del sistema (EARS)**

- **De acuerdo con** el formato de salida que se acuerde (A-08), el sistema deberá generar el reporte diario y el semanal y registrar su emisión. [RF-25, A-08]
- **El sistema deberá** calcular los cortes semanales de lunes a sábado. [RN-08, RNF-06]
- **Si** el periodo no tiene datos, entonces el sistema deberá informarlo y no generar archivo. [RNF-10]
- **El sistema deberá** guardar cada reporte en la ruta controlada con el periodo en el nombre y la marca de reemisión cuando corresponda. [D-27, RNF-11]

---

### CU-20 — Vigilar casos especiales y averías concentradas

- **Actor principal:** Supervisor.
- **Actor secundario:** Operador de la central (ejecuta las acciones sobre los casos señalados); jefe de central.
- **Ciclo:** C6. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** maestro con `sector` y `status` informados; umbral de concentración configurado en CONFIGURACION.
- **Postcondiciones:** el supervisor ve la lista de averías concentradas por sector y la lista de casos especiales del día, y puede actuar sobre ellas.

**Trazabilidad:** RF-26, RF-29; RN-04, RN-08; RNF-01, RNF-09; D-23, D-25; A-09 (H-14).

**Flujo principal**

1. El supervisor abre el bloque **CONCENTRADAS / ESPECIALES**.
2. El sistema calcula, por sector, el número de casos **abiertos** (abierto = `status` distinto de `CERRADO`) ingresados en la semana operativa en curso.
3. El sistema lista los sectores cuyo conteo alcanza o supera el umbral vigente (3 por defecto, editable en CONFIGURACION) con el conteo, el sector, las cuadrillas implicadas y la lista de `id_averia`.
4. El supervisor ajusta el umbral (por ejemplo a 5) y el sistema recalcula la lista y mantiene el valor guardado para las próximas consultas.
5. El supervisor selecciona un sector concentrado y pulsa *Ver casos*: el sistema abre la tabla de CASOS filtrada por ese sector y por abiertos (CU-10).
6. El supervisor solicita la lista de casos especiales del día; el sistema muestra la lista según el criterio vigente y permite marcarlos para seguimiento. [SUPUESTO: A-09]
7. El supervisor registra una acción por caso (llamada al abonado, escalamiento al supervisor de área, reasignación de cuadrilla) y el sistema la asienta en `observaciones` con operador y fecha/hora.

**Flujos alternativos**

- **3a. Ningún sector alcanza el umbral.** El sistema muestra «Sin averías concentradas con umbral 3 en la semana del 08/09/2026 al 13/09/2026».
- **4a. Umbral inválido (0, negativo o no numérico).** El sistema muestra «El umbral debe ser un número entero mayor o igual a 1» y conserva el valor anterior.
- **6a. Criterio de «caso especial» no definido (A-09 abierto).** [SUPUESTO: A-09] El sistema muestra por defecto los casos con `tipo_abonado = EMP` o `nivel = REF` abiertos, rotula la lista como «Criterio provisional (A-09 pendiente)» y permite al supervisor aplicar además un filtro manual. [A-09]
- **7a. El caso ya está `CERRADO`.** El sistema permite la anotación, advierte «El caso está cerrado» y no cambia su `status`. [H-19]
- **2a. Casos sin sector.** El sistema los excluye del cálculo y muestra «N casos sin sector no se contabilizan».

**Criterios de aceptación (Gherkin)**

1. **Dado** el sector `1` con 4 casos abiertos ingresados entre el 08/09/2026 y el 13/09/2026 y el umbral 3, **Cuando** el supervisor abre CONCENTRADAS, **Entonces** el sector `1` aparece en la lista con conteo 4.
2. **Dado** el mismo sector con 2 casos abiertos y 3 cerrados en la semana, **Cuando** el supervisor abre CONCENTRADAS, **Entonces** el sector `1` no aparece (solo se cuentan los abiertos) y el conteo mostrado para ese sector es 2.
3. **Dado** el umbral en 3 y 5 sectores por debajo del umbral, **Cuando** el supervisor lo cambia a 1, **Entonces** el sistema muestra los 6 sectores con al menos 1 caso abierto y conserva el umbral 1 en la siguiente consulta.
4. **Dado** un sector concentrado, **Cuando** el supervisor pulsa *Ver casos*, **Entonces** el sistema abre CASOS filtrado por ese sector con el conteo de abiertos coincidente con el de la lista.
5. **Dado** el criterio provisional de A-09, **Cuando** el supervisor abre la lista de casos especiales, **Entonces** el sistema muestra los casos abiertos con `tipo_abonado = EMP` o `nivel = REF` y la etiqueta «Criterio provisional (A-09 pendiente)».
6. **Dado** que el supervisor registra una acción sobre un caso, **Cuando** el sistema persiste, **Entonces** `observaciones` contiene la acción con fecha, hora y P00 del operador.

**Restricciones del sistema (EARS)**

- **El sistema deberá** contar como avería concentrada todo sector con 3 o más casos abiertos ingresados en la semana operativa en curso. [D-25]
- **El sistema deberá** considerar «abierto» todo caso con `status` distinto de `CERRADO`. [D-23]
- **Si** el umbral informado no es un entero mayor o igual a 1, entonces el sistema deberá rechazarlo y conservar el valor vigente. [RNF-10]
- **Mientras** A-09 no esté cerrada, el sistema deberá rotular la lista de casos especiales como criterio provisional. [A-09]
- **El sistema deberá** registrar operador y fecha/hora de cada cambio de umbral y de cada acción registrada. [RNF-09]

---

### CU-21 — Respaldar y restaurar los datos

- **Actor principal:** Administrador.
- **Actores secundarios:** Soporte TI del puesto; operador de la central (recibe el aviso de fallo).
- **Ciclo:** C1 (respaldo diario) / C7 (prueba de restauración). **Prioridad:** MVP (respaldo diario) / posterior (prueba formal en C7).
- **Precondiciones:** `C:\GGTO\datos` con los JSON de trabajo; ruta de respaldo disponible (`G:\Mi unidad\CANTV PDE\GGTO-v1\datos_respaldo` o ruta de red).
- **Postcondiciones:** existe una copia fechada e íntegra de los JSON y, tras una restauración probada, el sistema vuelve a operar con los datos recuperados.

**Trazabilidad:** RF-24; RNF-04, RNF-10; RT-01, RT-10; D-01, D-19, D-28; H-09, H-25.

**Flujo principal**

1. El administrador abre el bloque **RESPALDO** y consulta el estado: fecha del último respaldo, número de copias en rotación y tamaño de cada archivo.
2. El administrador pulsa *Respaldar ahora*.
3. El sistema copia `averias.json`, `despacho.json`, `estructura.json`, `central.json`, `tecnicos.json`, `flota.json`, `cuadrillas.json`, `sectores.json` y `claves_clasificacion.json` a la ruta de respaldo en una carpeta con la fecha del día.
4. El sistema relee cada copia, la compara con el original (número de registros y contenido) y muestra «Respaldo verificado: 9 archivos».
5. El administrador programa el respaldo diario al cierre de la jornada; el sistema lo ejecuta a la hora indicada y registra el resultado.
6. **Restauración:** el administrador elige una carpeta de respaldo, pulsa *Restaurar* y el sistema muestra qué archivos se van a reemplazar y con qué fecha.
7. El administrador confirma; el sistema respalda el estado actual antes de reemplazar, copia los archivos elegidos y relee cada uno para verificar que son JSON válidos y que `averias.json` tiene al menos el mismo número de registros que la copia.
8. El sistema muestra «Restauración completada desde el respaldo del DD/MM/AAAA» y el estado de cada archivo.

**Flujos alternativos**

- **3a. Fallo de copia (ruta no disponible).** El sistema muestra «No se pudo escribir en la ruta de respaldo: &lt;detalle&gt;» y ofrece elegir otra ruta; no marca el respaldo como exitoso. [H-25]
- **4a. La copia difiere del original.** El sistema marca el respaldo como fallido, conserva el error y recomienda reintentar.
- **7a. El respaldo elegido está corrupto.** El sistema detecta el JSON inválido, no reemplaza nada y muestra «Respaldo inválido: &lt;archivo&gt;».
- **7b. El respaldo tiene menos registros que el maestro vigente.** El sistema muestra «La copia tiene 800 casos y el maestro 1.000. ¿Confirma el reemplazo?» y exige confirmación escrita. [RNF-04]
- **1a. Nunca se ha respaldado.** El sistema muestra «Sin respaldos registrados», resalta el aviso y no permite activar la operación del día sin confirmar el respaldo (aviso, no bloqueo). [H-25]
- **6a. A-11/A-14 abiertas.** No aplica a este flujo; el respaldo copia los archivos tal como estén.

**Criterios de aceptación (Gherkin)**

1. **Dado** `C:\GGTO\datos` con 9 archivos JSON, **Cuando** el administrador pulsa *Respaldar ahora*, **Entonces** la ruta de respaldo contiene una carpeta con la fecha del día y los 9 archivos copiados y verificados.
2. **Dado** un respaldo con `averias.json` de 1.000 casos y un maestro vigente de 1.000 casos, **Cuando** el administrador restaura, **Entonces** el maestro queda con los mismos 1.000 `id_averia` y el sistema muestra «Restauración completada».
3. **Dado** un archivo de respaldo con JSON inválido, **Cuando** el administrador intenta restaurarlo, **Entonces** el sistema muestra «Respaldo inválido», no reemplaza ningún archivo y el maestro conserva sus datos.
4. **Dado** un respaldo con 800 casos y un maestro con 1.000, **Cuando** el administrador intenta restaurar, **Entonces** el sistema pide confirmación escrita y no reemplaza nada hasta obtenerla.
5. **Dado** que la ruta de respaldo no está disponible, **Cuando** el sistema ejecuta el respaldo diario, **Entonces** muestra el error, no marca el respaldo como exitoso y deja constancia con fecha y hora.
6. **Dado** un respaldo completado, **Cuando** el administrador consulta el estado, **Entonces** el sistema muestra la fecha del último respaldo exitoso y el número de copias en rotación.

**Restricciones del sistema (EARS)**

- **Cuando** el administrador solicite un respaldo, el sistema deberá copiar los archivos y **releer** cada copia antes de marcarla como exitosa. [RNF-10, H-09]
- **Si** la copia difiere del original, entonces el sistema deberá marcar el respaldo como fallido e informar el detalle. [RNF-10]
- **Cuando** el administrador restaure un respaldo, el sistema deberá respaldar el estado actual antes de reemplazar. [D-19]
- **El sistema deberá** mantener los datos de trabajo fuera de Google Drive, en `C:\GGTO\datos`. [D-19, RT-10]
- **El sistema deberá** conservar el histórico de casos sin purga automática y mantener el respaldo en una ruta controlada. [D-28, D-27]

---

### CU-22 — Operar en contingencia y diagnosticar el entorno

- **Actor principal:** Administrador.
- **Actores secundarios:** Operador de la central; soporte TI del puesto.
- **Ciclo:** C1 / C7. **Prioridad:** MVP.
- **Precondiciones:** el puesto tiene Edge o Chrome (versión 86 o superior) y Python 3.7+ o Node.js disponibles para el lanzador.
- **Postcondiciones:** el sistema arranca de forma reproducible, informa con claridad cualquier fallo y permite operar en modo degradado sin perder datos.

**Trazabilidad:** RF-01; RNF-03, RNF-04, RNF-10; RT-06, RT-07, RT-09; D-01, D-15, D-19; H-20, H-22, H-23, H-24, H-25.

**Flujo principal**

1. El administrador (o el operador) ejecuta el lanzador `pwsh -File .\servir-ggto.ps1`, que levanta el servidor en `127.0.0.1:8787` sirviendo solo el subdirectorio de la aplicación y abre el navegador.
2. El sistema carga la página, verifica el contexto (`http` y host local), comprueba la versión del navegador y muestra el estado del entorno: servidor, ruta de datos `C:\GGTO\datos`, versión de la aplicación y navegador detectado.
3. El sistema valida que los archivos de datos requeridos existan y sean JSON válidos y avisa de los que falten.
4. El administrador consulta el registro de la aplicación (log) y el informe de la última ingesta, y descarga el detalle si lo necesita.
5. Si el servidor local no está disponible, el administrador activa el **modo descarga**: el sistema permite consultar el maestro cargado con el selector de archivos y guarda los cambios descargando el JSON completo, con el aviso «Modo descarga: reemplace el archivo en C:\GGTO\datos al terminar».
6. Si el archivo del CSV diario no llega, el administrador mantiene el maestro del día anterior, deja constancia de la incidencia y continúa con la operación existente. [H-24]
7. Al cierre, el administrador verifica el estado: última escritura confirmada, último respaldo y número de errores registrados en el día.

**Flujos alternativos**

- **1a. El puerto 8787 está ocupado.** El lanzador muestra «El puerto 8787 está en uso» y ofrece cambiar de puerto; el sistema abre la página en el puerto alterno elegido. [H-23]
- **1b. No hay Python ni Node.js.** El sistema no puede levantar el servidor: muestra las opciones *Instalar Python/Node* o *Trabajar en modo descarga* y queda operativo solo en modo descarga. [H-23, RNF-03]
- **2a. Navegador sin File System Access API (Firefox o Safari).** El sistema avisa «Este navegador no permite escribir los JSON: use Edge o Chrome 86+» y habilita solo el modo descarga. [RNF-03, H-22]
- **2b. Versión de Chrome/Edge inferior a 86.** El sistema muestra el mismo aviso y ofrece actualizar.
- **3a. `averias.json` ausente, vacío o con JSON inválido.** El sistema bloquea la edición, muestra «Maestro no disponible: &lt;detalle&gt;» y ofrece *Restaurar desde respaldo* (CU-21). [H-20, H-25]
- **5a. Cambios sin guardar en modo descarga.** El sistema mantiene el aviso de pendiente y bloquea la salida de la página hasta confirmar la descarga del JSON. [RNF-04]
- **4a. Error en la ingesta.** El sistema registra el error en el log, muestra el mensaje accionable y conserva el archivo con la cabecera leída para diagnóstico. [H-20]

**Criterios de aceptación (Gherkin)**

1. **Dado** un puesto con Python 3.7 o superior y el puerto 8787 libre, **Cuando** el administrador ejecuta `pwsh -File .\servir-ggto.ps1`, **Entonces** el servidor responde en `http://127.0.0.1:8787` y la página abre con las 7 pestañas.
2. **Dado** el servidor levantado, **Cuando** se consulta la URL `http://<IP-del-equipo>:8787/datos/averias.json`, **Entonces** la respuesta es de recurso no encontrado: `datos/` no está publicado por HTTP.
3. **Dado** un equipo con Firefox, **Cuando** el operador abre la página, **Entonces** el sistema muestra «Este navegador no permite escribir los JSON» y habilita únicamente el modo descarga.
4. **Dado** un lanzamiento con el puerto 8787 ocupado, **Cuando** el administrador ejecuta el lanzador, **Entonces** el sistema muestra «El puerto 8787 está en uso» y ofrece un puerto alterno.
5. **Dado** que `averias.json` contiene un JSON inválido, **Cuando** el operador abre la página, **Entonces** el sistema muestra «Maestro no disponible: <detalle>» y ofrece *Restaurar desde respaldo* sin permitir edición.
6. **Dado** que el operador trabaja en modo descarga con 3 cambios sin guardar, **Cuando** intenta cerrar la página, **Entonces** el sistema advierte de los cambios pendientes y exige confirmar la descarga del JSON.
7. **Dado** un fallo de escritura en `averias.json`, **Cuando** el operador reintenta, **Entonces** el sistema muestra el detalle del error, registra el evento en el log con fecha y hora y permite guardar una copia en `datos_respaldo`.

**Restricciones del sistema (EARS)**

- **El sistema deberá** servir la página únicamente en loopback y publicar solo el subdirectorio de la aplicación, dejando `datos/` fuera del alcance HTTP. [D-15, RT-09]
- **Si** el navegador no soporta File System Access API, entonces el sistema deberá ofrecer el modo descarga con aviso visible. [RNF-03, H-22]
- **Si** un archivo de datos falta o no es JSON válido, entonces el sistema deberá bloquear la edición, informar con claridad y ofrecer la restauración desde respaldo. [H-20, H-25]
- **Mientras** el servidor local no esté disponible, el sistema deberá permitir la operación en modo descarga sin pérdida de datos. [H-23]
- **El sistema deberá** registrar en un log los errores de lectura, escritura e ingesta, con fecha, hora y detalle accionable. [H-20]
- **El sistema deberá** funcionar sin conexión a internet y sin CDN. [RT-07]

---

## 5. Trazabilidad inversa — RF a casos de uso

| RF | Casos de uso que lo cubren | Estado |
|---|---|---|
| RF-01 | CU-01 (armazón de 7 pestañas), CU-02 a CU-14 (contenido de cada pestaña) | Cubierto |
| RF-02 | CU-11 (búsqueda por `id_averia` o `telefono`) | Cubierto |
| RF-03 | CU-12 (actualización de `status`, `resolucion`, `fechaResolucion`, `observaciones`, `sacas`) | Cubierto |
| RF-04 | CU-14 (alta manual con lista cerrada e `id_averia` `MAN-`) | Cubierto |
| RF-05 | CU-18 (6 zonas con gráfico y tabla) | Cubierto |
| RF-06 | CU-18 (GRAFICOS: barras, curva y torta) | Cubierto |
| RF-07 | CU-10 (registro principal y clasificación), CU-13 (reclasificación) | Cubierto |
| RF-08 | CU-16 (distribución por sector y cuadrilla) | Cubierto |
| RF-09 | CU-16 (citados, ≥1 referido y ≥1 empresa, construcción única) | Cubierto |
| RF-10 | CU-17 (PDF por cuadrilla, carta horizontal) | Cubierto |
| RF-11 | CU-02 (CENTRAL) | Cubierto |
| RF-12 | CU-03 (TECNICOS) | Cubierto |
| RF-13 | CU-04 (FLOTA) | Cubierto |
| RF-14 | CU-05 (CUADRILLA) | Cubierto |
| RF-15 | CU-13 (bandeja GESTION) | Cubierto |
| RF-16 | CU-08 (carga, filtro de central, extracción y dedupe) | Cubierto |
| RF-17 | CU-08 (clasificación; vista previa en CU-07) | Cubierto |
| RF-18 | CU-08 (asignación de sector) y CU-09 (cola de direcciones sin coincidencia) | Cubierto |
| RF-19 | CU-08 (`ingreso`, `clase = REP`, `nivel = COM`) | Cubierto |
| RF-20 | CU-16 (extracción por `Reparador Principal`) y CU-17 (12 columnas del despacho) | Cubierto |
| RF-21 | CU-10 (tabla con las 7 columnas resumen) | Cubierto |
| RF-22 | CU-11 (flotante con toda la información) y CU-12 (cierre con bloqueo) | Cubierto |
| RF-23 | CU-10 (agrupación y filtrado) y CU-15 (trazabilidad de los cambios de clasificación) | Cubierto |
| RF-24 | CU-10, CU-12, CU-13, CU-14 (persistencia inmediata) y CU-21 (respaldo del archivo) | Cubierto |
| RF-25 | CU-19 (reporte diario y reporte semanal) | Cubierto |
| RF-26 | CU-20 (averías concentradas y casos especiales) | Cubierto |
| RF-27 | CU-07 (palabras clave y modo de búsqueda) | Cubierto |
| RF-28 | CU-13 (edición y uso de `tipo_abonado`) y CU-10 (edición en línea) | Cubierto |
| RF-29 | CU-06 (CRUD de sectores) y CU-09 (creación desde la cola) | Cubierto |

**Resultado: 29 de 29 RF cubiertos; ningún RF queda sin caso de uso.**

### 5.1 Cobertura de RNF, RT y RN

| Grupo | Cobertura |
|---|---|
| RNF-01 | CU-10, CU-11, CU-13, CU-16, CU-18, CU-19, CU-20 |
| RNF-02 | CU-08, CU-10, CU-11, CU-18 |
| RNF-03 | CU-01, CU-22 |
| RNF-04 | CU-03, CU-04, CU-05, CU-06, CU-08, CU-14, CU-21, CU-22 |
| RNF-05 | CU-17 |
| RNF-06 | CU-08, CU-11, CU-12, CU-18, CU-19 |
| RNF-07 | CU-01, CU-04, CU-10, CU-18, CU-19 |
| RNF-08 | CU-01, CU-02, CU-03, CU-06, CU-08, CU-15 |
| RNF-09 | CU-01, CU-02, CU-03, CU-04, CU-05, CU-06, CU-07, CU-09, CU-10, CU-12, CU-13, CU-14, CU-15, CU-16, CU-20 |
| RNF-10 | CU-02, CU-03, CU-04, CU-05, CU-06, CU-07, CU-08, CU-10, CU-11, CU-12, CU-13, CU-14, CU-16, CU-21 |
| RNF-11 | CU-16, CU-17, CU-19 |
| RT-01 | CU-02, CU-03, CU-04, CU-05, CU-06, CU-08, CU-10, CU-12, CU-14, CU-21 |
| RT-02 | CU-08 |
| RT-03 | CU-02, CU-08, CU-09 |
| RT-04 | CU-08, CU-10, CU-11 |
| RT-05 | CU-16, CU-17 |
| RT-06 | CU-01, CU-22 |
| RT-07 | CU-01, CU-07, CU-17, CU-18, CU-22 |
| RT-08 | CU-08 |
| RT-09 | CU-01, CU-22 |
| RT-10 | CU-01, CU-21 |
| RT-11 | Fuera del alcance de los casos de uso (ubicación del repositorio git; ver `entornos_globales.md` §7.1) |
| RN-01 | CU-08, CU-14 |
| RN-02 | CU-08, CU-14 |
| RN-03 | CU-07, CU-08 |
| RN-04 | CU-02, CU-06, CU-08, CU-09, CU-20 |
| RN-05 | CU-05, CU-16 |
| RN-06 | CU-05, CU-13, CU-16 |
| RN-07 | CU-10, CU-12, CU-13, CU-14, CU-16 |
| RN-08 | CU-18, CU-19, CU-20 |

### 5.2 Decisiones aplicadas y trazabilidad de decisiones

| Decisión | Casos de uso |
|---|---|
| D-01 (servidor local + File System Access API) | CU-01, CU-21, CU-22 |
| D-02 (MVP = C1-C3) | Índice de casos de uso (columna Ciclo/Prioridad) |
| D-03 (sectores por listas de vías y emparejamiento normalizado) | CU-06, CU-09 |
| D-04 (`extra` = red / planta externa) | CU-11 |
| D-05 (RN-03: con claves → PEND; sin claves → GESTION) | CU-07, CU-08 |
| D-06 (`clase = REP` al ingerir; corrección manual) | CU-08, CU-10, CU-13, CU-14 |
| D-07 (ficha de cuadrilla) | CU-05, CU-16 |
| D-09 (`averias.json` es el maestro) | CU-11 |
| D-10 (`informacion_1` / `informacion_2`) | CU-08, CU-11 |
| D-11 (palabras clave editables) | CU-07 |
| D-12 (`estructura.json` posicional) | CU-02, CU-08 |
| D-13 (`ASGN` cuarto estado) | CU-08, CU-12 |
| D-14 (se descarta `alta_manual.csv`) | CU-14 |
| D-15 (loopback y solo la aplicación) | CU-01, CU-22 |
| D-16 (identificación y auditoría) | CU-01, CU-15 |
| D-17 (`tipo_abonado` RES/EMP) | CU-08, CU-10, CU-13, CU-18 |
| D-18 (alta manual con `MAN-`) | CU-14 |
| D-19 (`datos/` en disco local con respaldo) | CU-01, CU-21 |
| D-20 (cierre bloqueante e integridad) | CU-12, CU-14 |
| D-21 (ingesta estricta y fechas recortadas) | CU-08 |
| D-22 (git en disco local) | CU-01 (entorno del puesto) |
| D-23 (abierto = distinto de CERRADO; tipo = clase + nivel) | CU-10, CU-13, CU-20 |
| D-24 (umbrales de desempeño) | CU-10, CU-11, CU-18 |
| D-25 (CRUD de sectores y umbral de concentración) | CU-06, CU-20 |
| D-26 (subcadena normalizada y vista previa) | CU-07, CU-08 |
| D-27 (control documental del PDF) | CU-17, CU-19, CU-21 |
| D-28 (retención indefinida y riesgo aceptado) | CU-12, CU-15, CU-19, CU-21 |

### 5.3 Supuestos por ambigüedades abiertas

| Ambigüedad | Casos de uso afectados | Supuesto marcado en el documento |
|---|---|---|
| A-05 («casos citados del día») | CU-16 | Selector manual de citados, sin campo de datos ni inclusión automática. |
| A-08 (formato de los reportes) | CU-19 | Salida por defecto pantalla + PDF en carta; sin XLSX, con aviso en pantalla. |
| A-09 («casos especiales») | CU-20 | Lista provisional = casos abiertos `EMP` o `REF`, rotulada como criterio provisional. |
| A-10 (desempate de cuadrilla para construcción) | CU-16 | Menor carga y, en empate, `id` menor; ajuste manual registrado. |
| A-11 (significado de `P00`) | CU-01, CU-03 | Identificación por `P00` **o** `nombre`; `P00` guardado como texto libre no obligatorio. |
| A-14 (composición de `despacho.json`) | CU-05, CU-16 | La asignación se persiste en `averias."Reparador Principal"`; `despacho.json` conserva sus 12 columnas. |

**Decisiones tomadas por el analista al redactar este documento (no estaban cerradas en la normativa):**

1. **Umbrales de desempeño citados como D-24.** Los umbrales (1.000 casos, filtrado y orden &lt; 1,5 s, MONITOREO &lt; 3 s) se citan como **D-24** porque así aparecen en `requerimientos.md` §3 y en `estado_proyecto.md` §3, aunque la lista de decisiones indicada para este trabajo los sitúa fuera de D-01…D-28.
2. **Cierre cubierto por CU-12 y alta manual por CU-14**, de modo que RF-03 y RF-04 tienen un único dueño funcional cada uno y el flotante de CASOS (CU-11) no duplica el cierre.
3. **La auditoría se separó en CU-15** (consulta del historial) para que el supervisor tenga un objetivo propio; el registro del cambio en sí queda como restricción EARS dentro de cada caso de uso que escribe (RNF-09).
4. **El respaldo (CU-21) y la contingencia (CU-22)** se redactaron como casos de uso propios porque los hallazgos H-25, H-23, H-22 y H-20 no tenían RF/RNF con dueño; cubren RNF-03, RNF-04 y RNF-10 sin crear requisitos nuevos.
5. **Los "citados" y los "casos especiales" no se inventaron:** se dejaron como selección manual y como criterio provisional rotulado, respectivamente.
