# Requerimientos — Página HTML de Gestión de Averías (GGTO)

- **Proyecto:** GGTO-v1 — Central Francisco Salias (Área 4)
- **Fase:** 1 (Concepto) — documento vivo, se actualiza de forma incremental
- **Versión:** v1
- **Fecha:** 2026-09-12
- **Fuente primaria:** `RepoTecnico/PAGINA-GGTO-INICIAL.md` (64 líneas)
- **Documentos derivados:** `RepoTecnico/PROPUESTA-PAGINA-GGTO.md` (análisis y arquitectura),
  `RepoTecnico/diccionario_datos.md`, `RepoTecnico/entornos_globales.md`

> Convención de trazabilidad: `L##` se refiere a la línea de la fuente primaria.
> `D-##` a las decisiones de la entrevista (§3) y `A-##` a las ambigüedades (§9).

---

## 1. Objetivo del sistema

Página HTML que concentra la gestión de los reportes de avería de la central Francisco Salias
(área 4): conformar el despacho diario a las cuadrillas declaradas, agrupar averías
concentradas por sector, dar seguimiento a los casos especiales y emitir el reporte de trabajo
diario y de gestión semanal, alimentándose de un archivo `.csv` que se emite a diario
(L1-2, L31).

---

## 2. Glosario y nomenclatura del dominio

| Término | Significado | Fuente |
|---|---|---|
| `estatus` | Estado del caso: `PEND` (pendiente), `CERRADO`, `GESTION` (requiere verificación telefónica). El `ASGN` del CSV se traduce a `PEND` al ingerir. | L8, L56; col. 27 del CSV; D-38 |
| `resolucion` | Vía de cierre: `IVR`, `COS`, `COLA`. | L8, L56 |
| `sacas` | Indicador `SI`/`NO` asociado al cierre del caso. | L8, L56 |
| `nivel` | `REF` (referido) / `COM` (común o residencial). | L56 |
| `clase` | `REP` (reparación) / `CNS` (construcción). | L56 |
| `sector` | Agrupación geográfica de averías por cercanía de direcciones. | L13, L37 |
| `ingesta` | Procedimiento diario de carga y clasificación del CSV. | L29-38 |
| `despacho` | Distribución del universo de averías entre las cuadrillas. | L40-45 |
| citados | Casos agendados/citados del día que deben entrar en el despacho (definición pendiente, A-05). | L42 |
| `FAT` | Caja de acceso a la red de fibra (planta externa). | L44, L56 |
| `OLT` | Equipo terminal de línea óptica. | L56 |
| `VENAPP` | Origen del campo `codigos_sin_gestion_en_VENAPP`. | L56 |
| cuadrilla | Equipo de trabajo de calle (técnicos + vehículo) al que se asigna el despacho; se identifica con `cuadrillas.id` y ese es el valor de `Reparador Principal` (D-37). | L18, L42 |
| central | Unidad operativa (región, estado, municipio, parroquia, distrito, área, central). | L15 |

---

## 3. Decisiones de la entrevista (Fase 1)

| ID | Decisión |
|---|---|
| D-01 | Persistencia mediante servidor local mínimo + File System Access API: la página lee y **escribe** `averias.json` / `despacho.json` en disco. |
| D-02 | Alcance: primero el MVP (CONFIGURACION + CASOS + INGESTA + PANEL) = ciclos C1–C3. |
| D-03 | Los sectores se definen como lista de calles/urbanizaciones, con emparejamiento por texto normalizado y cola de asignación manual. |
| D-04 | La columna `extra` de `averias.json` pertenece a Red / planta externa. |
| D-05 | RN-03: sin palabras clave de fibra → `status = GESTION`; con palabras clave → `status = PEND`. |
| D-06 | Todo caso ingerido entra con `clase = REP`; la corrección a `CNS` o `REF` es manual en CASOS o GESTION. |
| D-07 | Ficha de cuadrilla: `id, nombre, técnicos[], vehículo, turno, sectores[], status`. |
| D-08 | **Revisada el 12/09/2026 — sin efecto:** la verificación del CSV real mostró 80 columnas con `;` y encabezados repetidos. El contrato vigente es el de **D-12** (mapa posicional). |
| D-09 | El archivo maestro de casos se llama `averias.json` (la mención a `averia.json` en L35 es un error de tipeo). |
| D-10 | La `informacion` duplicada son dos columnas distintas: `informacion_1` e `informacion_2`. |
| D-11 | Las palabras clave de clasificación son una lista editable en CONFIGURACION con búsqueda normalizada. |
| D-12 | `estructura.json` es un mapa **posicional** que declara **solo las columnas necesarias** (filtro de central, datos del caso, despacho y gestión), no las 80 del CSV. |
| D-13 | ~~`ASGN` se incorpora como cuarto valor del estatus~~ — **dejada sin efecto por D-38**. |
| D-14 | Se **descartan los datos** de `alta_manual.csv`; los casos se cargan manualmente desde la página. No se usa como modelo obligatorio de campos. |
| D-15 | El servidor local escucha **solo en loopback** (`--bind 127.0.0.1`) y sirve únicamente el subdirectorio de la aplicación, dejando `datos/` fuera del alcance HTTP (H-01 de la auditoría). |
| D-16 | El operador se **identifica en cada sesión** contra `tecnicos.json` (P00 o usuario); cada cambio de caso registra quién lo hizo y cuándo. |
| D-17 | Se crea el campo **`tipo_abonado`** (`RES`/`EMP`) alimentado por `unidad_negocio` (col. 61) y `ups` (col. 62) del CSV; `nivel` sigue siendo REF/COM. |
| D-18 | El **alta manual (RF-04)** usa una lista cerrada de campos y el `id_averia` se genera automáticamente como `MAN-` + consecutivo, verificando unicidad. |
| D-19 | **`datos/` sale de Google Drive:** los JSON viven en disco local (`C:\GGTO\datos`); el respaldo es **manual**, a demanda del supervisor (D-36). |
| D-20 | **Cierre bloqueante:** un caso no puede pasar a `CERRADO` sin `resolucion` y `fechaResolucion`; en alta y edición se validan obligatorios, enums y que el `sector` exista (H-11). |
| D-21 | **Ingesta estricta:** validación **bloqueante** del contrato posicional; las fechas del CSV se recortan a DD/MM/AAAA conservando el texto original, y el `estatus = ASGN` del CSV **prevalece** sobre RN-03 (A-16, A-18). |
| D-22 | El directorio `.git` vive en disco local, fuera de Google Drive, tras la corrupción de `.git\refs` por `desktop.ini`. |
| D-23 | Agrupaciones de RF-23: «abierto» = `status` distinto de `CERRADO`; «tipo» = combinación `clase` + `nivel` calculada en pantalla, sin campo nuevo. |
| D-24 | Umbrales de desempeño: 1.000 casos, filtrado y orden en menos de 1,5 s, MONITOREO en menos de 3 s (Chrome/Edge, 4 GB de RAM). |
| D-25 | Sectores: CRUD completo en C1 (RF-29) y avería concentrada = 3 o más casos abiertos del mismo sector en la semana, con umbral editable. |
| D-26 | **Palabras clave (RN-03):** coincidencia por **subcadena sobre texto normalizado** (mayúsculas, sin tildes, espacios colapsados) en los 4 campos, con vista previa del impacto antes de cambiar la lista o el modo. |
| D-27 | **Datos personales en el PDF:** el despacho lleva fecha, cuadrilla y número de copia; se registra la entrega y las hojas se recogen y destruyen al cierre del día; los respaldos van a una ruta controlada, no a Descargas. |
| D-28 | **Retención:** histórico indefinido de casos; se documenta finalidad y responsable del tratamiento, sin purga automática (**riesgo legal aceptado**, H-13). |
| D-29 | **`P00` es el código de empleado:** único y obligatorio en `tecnicos.json`, y es la credencial con la que el operador inicia sesión (A-11). |
| D-30 | **«Citados del día»** son los casos con cita agendada para la fecha del despacho (`fecha_cita`, col. 19 del CSV); entran con prioridad y se marcan como CITADO (A-05). |
| D-31 | **`despacho.json` se amplía** con `sector`, `Reparador Principal` y `fecha_despacho`, y queda como registro del despacho del día (A-14); RT-05 se corrige. |
| D-32 | **Desempate de la construcción (CNS):** primero la cuadrilla que tenga ese sector como zona preferente en `cuadrillas.sectores`; si hay varias o ninguna, la de menor carga del día y, en empate, el `id` menor; el supervisor puede cambiarla y el cambio queda registrado (A-10). |
| D-33 | **Casos especiales** = los de clientes empresariales (`tipo_abonado = EMP`) y los referidos (`nivel = REF`) que siguen abiertos; tienen bandeja y seguimiento propios (A-09). |
| D-34 | **Salida de reportes:** solo el despacho se emite en pantalla y PDF. El seguimiento semanal es **estadístico**: por día, ingreso del día vs. reparadas del día, con la línea del pendiente al cierre de cada día, agrupado por semana del año con selector **Sem 1 a Sem 36**; sin Excel (A-08). |
| D-35 | **Permisos:** el **operador** solo consulta y cierra los casos asignados a su propia cuadrilla (su despacho del día); el **supervisor** puede todo, incluida la bandeja GESTION, los padrones, los sectores, las palabras clave, el despacho y el respaldo. El rol «administrador» queda absorbido por el supervisor. |
| D-36 | **Respaldo manual** a demanda del supervisor (sin automatismo ni rotación) y el repositorio se mantiene como está, con los CSV, los PDF de despacho y el `.xlsm` versionados (P9); riesgo aceptado. |
| D-37 | **Equivalencia de cuadrilla:** `cuadrillas.id` es el valor de `Reparador Principal` en `averias.json` y en `despacho.json`, y la asignación del despacho se escribe de vuelta en el maestro (P12). |
| D-38 | **`ASGN` se ingiere como `PEND`:** el maestro conserva tres estados (`PEND`/`CERRADO`/`GESTION`) y deja sin efecto el cuarto estado de D-13. Verificado con el CSV del 12/09/2026: 51 insertados de Francisco Salias → **14 PEND + 37 GESTION**. |
| D-39 | **Credencial de sesión:** `P00` + contraseña de 8 caracteres o más, guardada como **hash con sal** en `tecnicos.json`, con cambio obligatorio cada **90 días**; el supervisor puede restablecerla. La contraseña no se guarda en claro. |
| D-40 | **Accesibilidad (RNF-13):** navegación completa por teclado (Tab, Enter y flechas en la tabla), foco visible, `label` asociado a cada campo, contraste mínimo 4,5:1 y texto alternativo en los gráficos. |

---

## 4. Requerimientos funcionales (RF)

| ID | Requerimiento | Ciclo | Fuente |
|---|---|---|---|
| RF-01 | Navegación por 7 pestañas: PANEL, MONITOREO, GRAFICOS, CASOS, DESPACHO, CONFIGURACION y GESTION. | C1 (armazón) | L6-19 |
| RF-02 | PANEL: buscar la ficha básica de un caso por `id_averia` o `telefono` con un botón, leyendo `averias.json`. | C3 | L8 |
| RF-03 | PANEL: actualizar `status` (PEND/CERRADO/GESTION), `resolucion` (IVR/COS/COLA), `fechaResolucion` (DD/MM/AAAA), `observaciones` y `sacas` (SI/NO) por `id_averia` o `telefono`. No permite `CERRADO` sin resolución y fecha. | C3 | L8; D-20, D-38 |
| RF-04 | PANEL: ingresar casos nuevos con una lista **cerrada** de campos (fecha del caso, teléfono, nombre, dirección, contacto, problema reportado, sector, clase, nivel, `tipo_abonado`, observaciones); el `id_averia` se genera como `MAN-` + consecutivo verificando que no exista. | C3 | L8; D-18 |
| RF-05 | MONITOREO: 6 zonas con gráfico + tabla descriptiva — Gestión Diario, Gestión Semanal (barras de ingreso vs. reparadas por día, con línea de pendiente al cierre de cada día y selector de semana Sem 1 a Sem 36), Casos Globales (pendiente vs. resuelto), Reparación (pendientes por tipo), Construcción (pendientes por tipo) y Cuadrilla (asignados vs. cerrados vs. gestionados por día). | C5 | L9; D-34 |
| RF-06 | GRAFICOS: las 6 zonas anteriores como gráficos dedicados — barras (diario, globales, construcción, cuadrilla), barras + línea (semanal) y torta (reparación). | C5 | L10; D-34 |
| RF-07 | CASOS: registro principal de casos y su resolución, clasificados por Construcción/Reparación y por Residencial/Empresa/Referidos. | C1 (tabla) / C3 (clasificación) | L12 |
| RF-08 | DESPACHO: distribuir el universo de averías entre cuadrillas agrupando por dirección (sectores cercanos). | C4 | L13, L40-45 |
| RF-09 | DESPACHO: aplicar las reglas de reparto — citados del día, ≥1 reparación de referidos y ≥1 de empresas por cuadrilla; construcción a una sola cuadrilla con reparaciones en ese sector. | C4 | L42 |
| RF-10 | DESPACHO: generar los PDF del despacho diario, uno por cuadrilla, ajustados al área máxima imprimible de una hoja carta horizontal (con paginación). | C4 | L45 |
| RF-11 | CONFIGURACION/CENTRAL: datos operativos de la central (región, estado geográfico, capital, municipio, parroquia, estado operativo, distrito, área, central, nombre central) como filtro base de la matriz CSV. | C1 | L15 |
| RF-12 | CONFIGURACION/TECNICOS: padrón de trabajadores (Nombre, Cédula, P00, Teléfono, Correo, Especialidad, Status) más la credencial de sesión: contraseña (hash + sal), fecha del último cambio y si debe cambiarla. | C1 | L16; D-39 |
| RF-13 | CONFIGURACION/FLOTA: padrón de vehículos (CAN00, Tipo, Marca, Modelo, Placa, Combustible, Status, Estado Cauchos, Estado Fluidos, Estado General). | C1 | L17 |
| RF-14 | CONFIGURACION/CUADRILLA: padrón de cuadrillas (`id, nombre, técnicos[], vehículo, turno, sectores[], status`). | C1 | L18; D-07 |
| RF-15 | GESTION: bandeja de casos a consultar telefónicamente para clasificarlos correctamente antes del trabajo de calle; la opera el supervisor. | C3 | L19; D-35 |
| RF-16 | INGESTA: cargar el CSV diario, filtrar por los datos de la central, extraer las columnas según `estructura.json` y descartar los casos ya existentes por `id_averia`. | C2 | L31-35 |
| RF-17 | INGESTA: los casos que **no** contengan las palabras clave de fibra (LOSS ROJO, FALLA FIBRA, FIBRA DAÑADA) en `ultimo_comentario`, `problema_reporte`, `informacion_1` o `informacion_2` pasan a `status = GESTION`; los que sí las contienen quedan en `status = PEND`. | C2 | L36; D-05, D-11 |
| RF-18 | INGESTA: completar `sector` agrupando por `direccion` según los sectores declarados; si la dirección no corresponde a ningún sector, solicitarlo al usuario. | C2 | L37 |
| RF-19 | INGESTA: insertar los casos nuevos en `averias.json` con `ingreso = fecha de ingesta`, `clase = REP` y `nivel = COM`. | C2 | L38; D-06 |
| RF-20 | DESPACHO: extraer `id_averia, telefono, persona_reporta, contacto, nombre, direccion, fat, plan, serial` agrupando por `Reparador Principal` (= `cuadrillas.id`) y escribir la asignación de vuelta en `averias.json`. | C4 | L44; D-37 |
| RF-21 | GENERALIDADES: tabla con las columnas resumen `nivel, clase, sector, id_averia, nombre, direccion, plan`. | C1 | L49 |
| RF-22 | GENERALIDADES: al seleccionar un registro se abre un flotante con toda la información restante del caso, agrupada en secciones, con opción de **CERRAR CASO** ingresando los datos de resolución; el botón queda bloqueado si faltan resolución o fecha, y el operador solo puede cerrar casos de su propia cuadrilla. | C1 | L50; D-20, D-35 |
| RF-23 | GENERALIDADES: agrupar y filtrar por **abiertos/cerrados** (abierto = `status` distinto de `CERRADO`), **cuadrilla** (`Reparador Principal`), **tipo** (combinación `clase` + `nivel` calculada en pantalla), `clase`, `nivel` y `estatus`; incluye la edición manual de `clase` y `nivel`. | C1 | L51; D-06, D-23 |
| RF-24 | GENERALIDADES: persistir en `averias.json` cada modificación de un caso. | C1 | L52 |
| RF-25 | Reportes: el despacho diario se emite en pantalla y en PDF (por cuadrilla); el seguimiento semanal es estadístico — ingreso del día vs. reparadas del día con la línea del pendiente al cierre, agrupado por semana del año (Sem 1 a Sem 36) con selector de semana. | C6 | L2; D-34 |
| RF-26 | Seguimiento de casos especiales (EMP o REF abiertos, D-33) y de **averías concentradas**: 3 o más casos abiertos del mismo sector en la semana operativa, con umbral editable en CONFIGURACION. | C6 | L2, L13; D-25, D-33 |
| RF-27 | CONFIGURACION: gestionar la lista editable de palabras clave de clasificación y su modo de búsqueda (`claves_clasificacion.json`). | C2 | D-11 |
| RF-28 | CASOS y PANEL: editar el `tipo_abonado` (`RES`/`EMP`) del caso y usarlo en las métricas de gestión y en la cuota de despacho. | C1 / C5 | D-17 |
| RF-29 | CONFIGURACION/SECTORES: alta, edición y baja de sectores con nombre, lista de calles/urbanizaciones y cuadrilla sugerida. | C1 | D-25 |

**Total:** 29 RF.

---

## 5. Requerimientos no funcionales (RNF)

| ID | Requerimiento | Verificación prevista |
|---|---|---|
| RNF-01 | Usabilidad: operación guiada por botones, sin comandos; ingesta + despacho realizables en una sesión corta. | Prueba con un operador sobre datos reales de un día; se documenta el tiempo de cada procedimiento. |
| RNF-02 | Desempeño: con **1.000 casos** en el maestro, la tabla de CASOS filtra y ordena en **menos de 1,5 s** y el MONITOREO se dibuja en **menos de 3 s** (paginación o virtualización). | Cronómetro sobre 1.000 casos en un PC de oficina con Chrome/Edge y 4 GB de RAM. |
| RNF-03 | Portabilidad: página autónoma que abre en cualquier PC de la central con navegador moderno. | Apertura en Edge/Chrome sin instalación adicional (solo el lanzador del servidor local). |
| RNF-04 | Integridad: no duplicar casos por `id_averia` ni perder modificaciones al recargar. | Prueba de doble ingesta del mismo CSV; conteo de registros y verificación de ids únicos. |
| RNF-05 | Impresión: el PDF de despacho por cuadrilla cabe en carta horizontal. | Impresión/visualización del PDF con el volumen máximo previsto por cuadrilla. |
| RNF-06 | Fechas en DD/MM/AAAA y semana operativa lunes–sábado. | Prueba de ingesta y de los cortes semanales del MONITOREO. |
| RNF-07 | Interfaz en español respetando la nomenclatura del dominio (PEND, CERRADO, GESTION, IVR, COS, COLA, sacas). | Revisión de etiquetas; corrección de typos de interfaz (A-06). |
| RNF-08 | Control de acceso: la sesión exige `P00` + contraseña validados contra el hash con sal de `tecnicos.json` (D-39); sin sesión válida la página no permite editar, y la contraseña caduca cada 90 días (H-01, H-03). | Prueba de sesión sin identificar, con contraseña incorrecta y con contraseña caducada: en los tres casos las acciones de edición quedan bloqueadas. |
| RNF-09 | Auditoría: todo cambio de `status`, `clase`, `nivel`, `tipo_abonado` o cierre de caso registra operador y fecha/hora del cambio (H-10). | Revisión del historial tras una sesión de cambios. |
| RNF-10 | Integridad de datos: en alta y edición se validan campos obligatorios, enums, formato de fecha y que el `sector` exista en `sectores.json`; el cierre exige `resolucion` y `fechaResolucion` (H-11). | Casos de prueba con OBL vacío, enum inválido y sector inexistente: todos deben ser rechazados. |
| RNF-11 | Control documental del despacho: cada PDF registra fecha, cuadrilla y número de copia, y la entrega queda asentada para poder recoger las hojas impresas (H-12). | Revisión de la marca en el PDF y del registro de entrega del día. |
| RNF-12 | Control de acceso por rol: el operador solo ve y cierra los casos de su cuadrilla (`Reparador Principal` = cuadrilla del técnico identificado); el supervisor tiene todas las acciones y es quien opera la bandeja GESTION (H-01, D-35). | Prueba con un operador de la cuadrilla 1: no debe poder editar ni cerrar casos de la cuadrilla 2, ni tocar los padrones. |
| RNF-13 | Accesibilidad: toda la operación es posible con teclado (Tab, Enter y flechas en la tabla), el foco es visible, cada campo tiene `label` asociado, el contraste es de al menos 4,5:1 y cada gráfico tiene tabla o texto alternativo equivalente (H-05, D-40). | Recorrido completo de las 7 pestañas solo con teclado y verificación de contraste con herramienta automática. |

---

## 6. Restricciones y requisitos técnicos (RT)

| ID | Restricción |
|---|---|
| RT-01 | Los datos de verdad viven en archivos: `averias.json`, `despacho.json` y `estructura.json` (L54-58). |
| RT-02 | La fuente externa es un `.csv` diario con información operativa, administrativa, técnica y complementaria (L31). |
| RT-03 | El filtro de la matriz CSV usa los campos operativos de CONFIGURACION/CENTRAL (L33). |
| RT-04 | Los JSON respetan los nombres y el orden de columnas declarados, con la única corrección `informacion_1` / `informacion_2` (D-10). |
| RT-05 | `despacho.json` conserva las columnas del fuente (L57) **más** `sector`, `Reparador Principal` y `fecha_despacho`, para servir de registro del despacho del día (D-31). |
| RT-06 | Desde `file://` el navegador no puede leer ni escribir los JSON del disco: se requiere servidor local + File System Access API (D-01). |
| RT-07 | Sin internet garantizado en la central: las librerías (CSV, gráficos, PDF) se guardan localmente en `lib/`. |
| RT-08 | El CSV diario real usa `;` como separador, codificación UTF-8, una fila de encabezado de **80 columnas**, fechas con hora y encabezados repetidos; la muestra analizada traía 56 registros de 3 centrales (51 de Francisco Salias). |
| RT-09 | El servidor local escucha solo en loopback y sirve exclusivamente el subdirectorio de la aplicación: `datos/` y `RepoTecnico/` quedan fuera del alcance HTTP. |
| RT-10 | Los JSON de trabajo viven en disco local, fuera de la carpeta sincronizada de Google Drive; el respaldo es manual y bajo responsabilidad del supervisor (D-19, D-36). |
| RT-11 | El metadata de git (`.git`) vive en disco local (`C:\GGTO\git\GGTO-v1.git`), fuera de la unidad sincronizada: Google Drive corrompió `.git\refs` con archivos `desktop.ini` (D-22). |

---

## 7. Reglas de negocio

| ID | Regla | Fuente |
|---|---|---|
| RN-01 | Un caso es nuevo si su `id_averia` no existe en `averias.json`. | L35 |
| RN-02 | Al ingerir: `ingreso` = fecha de la ingesta, `clase = REP`, `nivel = COM`; la corrección a `CNS`/`REF` es manual. | L38; D-06 |
| RN-03 | Sin palabras clave de fibra → `status = GESTION`; con palabras clave → `status = PEND`. Si el CSV trae `estatus = ASGN`, se ingiere como `PEND` y no entra a la bandeja GESTION (D-38). La búsqueda es por **subcadena sobre texto normalizado** (mayúsculas, sin tildes, espacios colapsados) en `ultimo_comentario`, `problema_reporte`, `informacion_1` e `informacion_2`, con vista previa del impacto antes de cambiar la lista o el modo. | L36; D-05, D-11, D-21, D-26 |
| RN-04 | Toda dirección debe quedar asociada a un sector; si no hay coincidencia, el sistema solicita incorporar el sector. | L37 |
| RN-05 | Cada cuadrilla recibe: citados del día (`fecha_cita` = día, D-30) + ≥1 reparación de referidos + ≥1 reparación de empresas. | L42 |
| RN-06 | La construcción se asigna a una sola cuadrilla: la que tenga reparaciones en ese sector, desempatando por zona preferente, luego menor carga y luego `id` menor (D-32). | L42 |
| RN-07 | Toda edición de un caso se refleja de inmediato en `averias.json`. | L52 |
| RN-08 | La semana operativa va de lunes a sábado. | L9 |

---

## 8. Alcance por ciclo

| Ciclo | Contenido | Requerimientos |
|---|---|---|
| C1 | Armazón de pestañas, CONFIGURACION completa, tabla CASOS + flotante de cierre, persistencia JSON. | RF-01, RF-07 (tabla), RF-11 a RF-14, RF-21 a RF-24 |
| C2 | INGESTA del CSV: carga, filtro por central, mapeo, dedupe, clasificación por palabras clave, asignación de sector. | RF-16 a RF-19, RF-27 |
| C3 | PANEL (búsqueda, actualización, alta) + GESTION telefónica + reclasificación. | RF-02 a RF-04, RF-07 (clasificación), RF-15, RF-23 |
| C4 | DESPACHO: agrupación por sector, reglas RN-05/RN-06, edición y PDF por cuadrilla. | RF-08 a RF-10, RF-20 |
| C5 | MONITOREO + GRAFICOS. | RF-05, RF-06 |
| C6 | Reportes diario y semanal + casos especiales y averías concentradas. | RF-25, RF-26 |
| C7 | Pruebas funcionales con datos reales, ajuste de impresión, entrega y manual de usuario. | RNF-01 a RNF-07 |

---

## 9. Ambigüedades: 12 cerradas y 6 abiertas

Las filas marcadas **Resuelta (D-xx)** se conservan como historial de decisión. Estado al
13/09/2026: **cerradas las 18** (A-01 a A-18) y **ninguna abierta**.

| ID | Ambigüedad | Pregunta a resolver | Ciclo afectado |
|---|---|---|---|
| A-04 | **Resuelta (D-25):** el sector es una entidad con `id` y `nombre` propios, gestionada por el CRUD de RF-29; `averias.sector` guarda ese `id` y la dirección se asocia por las vías del sector. | Decidido por el usuario el 12/09/2026. | C2 |
| A-05 | **Resuelta (D-30):** «citado» = caso con `fecha_cita` igual al día del despacho. | Decidido por el usuario el 13/09/2026. | C4 |
| A-08 | **Resuelta (D-34):** despacho en pantalla + PDF; seguimiento semanal estadístico (ingreso vs. reparadas por día + línea de pendiente), por semana Sem 1 a Sem 36. | Decidido por el usuario el 13/09/2026. | C6 |
| A-09 | **Resuelta (D-33):** casos especiales = EMP o REF abiertos. | Decidido por el usuario el 13/09/2026. | C6 |
| A-10 | Desempate cuando varias cuadrillas tienen reparaciones en el sector de la construcción (L42). | ¿Qué criterio decide (menor carga, sectores asignados a la cuadrilla o decisión manual)? | C4 |
| A-11 | **Resuelta (D-17 y D-29):** `tipo_abonado` se deriva de `unidad_negocio`/`ups`, y `P00` es el código de empleado que identifica la sesión. | Decidido por el usuario el 13/09/2026. | C1 |
| A-12 | **Resuelta (D-12):** `estructura.json` pasa a ser un mapa posicional que declara solo las columnas necesarias. | Decidido por el usuario el 12/09/2026. | C2 |
| A-14 | **Resuelta (D-31):** `despacho.json` se amplía con `sector`, `Reparador Principal` y `fecha_despacho`. | Decidido por el usuario el 13/09/2026. | C4 |
| A-15 | **Resuelta (D-13, revisada por D-38):** el `ASGN` del CSV se ingiere como `PEND`; el maestro conserva tres estados. | Decidido por el usuario el 12/09/2026 y revisado el 13/09/2026. | C2 |
| A-16 | **Resuelta (D-21):** las fechas se recortan a `DD/MM/AAAA` y el texto original con hora se conserva en un campo aparte. | Decidido por el usuario el 12/09/2026. | C2 |
| A-17 | **Resuelta (D-14):** los datos de `alta_manual.csv` se descartan; los casos se cargan manualmente en la página. | Decidido por el usuario el 12/09/2026. | C1 / C6 |
| A-18 | **Resuelta (D-21 y D-38):** el `estatus` del CSV prevalece sobre RN-03 y `ASGN` entra como `PEND`. | Decidido el 13/09/2026. | C2 |

Ambigüedades ya cerradas: A-01 (D-09), A-02 (D-10), A-03 (D-07), A-06 (D-11), A-07 (D-05), A-04 (D-25), A-12 (D-12), A-13 (D-06), A-15 (D-13) y A-17 (D-14). Abiertas: A-05, A-08, A-09, A-10, A-11 y A-14.

---

## 10. Criterios de aceptación de la Fase 1

- [x] Requerimientos funcionales, no funcionales y técnicos extraídos de la fuente primaria con trazabilidad por línea.
- [x] Modelo de datos preliminar y diccionario de datos (`diccionario_datos.md`).
- [x] Entornos, rutas y comandos registrados (`entornos_globales.md`).
- [x] Decisiones de la entrevista registradas (D-01 a D-11).
- [x] URLs de los repositorios remotos (GitHub y GitLab) y ramas: `main` y `GGTOv1-DSH`.
- [x] GCP no aplica: ejecución local en la central.
- [ ] Respuestas al bloque 4 de preguntas (A-04, A-05, A-08, A-09, A-10, A-11, A-14) o su diferimiento explícito a los ciclos C4–C6.

---

## 11. Próximos pasos

1. Cerrar los pendientes del §10 (repositorios, GCP y bloque 4 de preguntas).
2. Fase 2: auditoría de estos requerimientos con el equipo de auditoría y elaboración de los
   casos de uso con criterios Gherkin/EARS y trazabilidad a los RF.
3. Al aprobarse la Fase 2, iniciar el ciclo C1 del plan de desarrollo.
