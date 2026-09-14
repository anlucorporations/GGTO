# Casos de Uso — Página HTML de Gestión de Averías (GGTO-v1)

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías de la central telefónica **Francisco Salias (Área 4)**, CANTV, Venezuela.
- **Fase:** 2 (Auditoría y casos de uso) — documento vivo.
- **Fecha de emisión:** 13/09/2026. **Revisión:** 15/09/2026, segunda pasada (cierre de la reauditoría: corrección de H-N-01 a H-N-30 y de los residuos de H-19, H-29 y H-33; se aplican **D-51 a D-54** y se añaden **RNF-15** y **RNF-16**). **Tercera pasada (última coherencia de los casos de uso):** se aplican **D-55 a D-59**, se precisa el destino de los registros de acceso (D-57/D-58) y se deja §5.4 con solo pendientes técnicos de implementación. **Cuarta pasada:** se aplican **D-60 a D-64** (propuesta de sector del operador y aprobación del supervisor en CU-09 —D-60—, campo **`rol`** de `tecnicos.json` —**D-61**—, **arranque en frío** del primer supervisor —**D-62**—, formato de la credencial SHA-256 —**D-63**— y **log de accesos con rotación de 5 MB × 5 archivos** —**D-64**—), citadas en CU-01, CU-03, CU-06, CU-09 y CU-15 y en las convenciones §1.20 a §1.22.
- **Fuentes normativas (leídas completas, no modificadas):**
  `RepoTecnico/PAGINA-GGTO-INICIAL.md` (fuente primaria del usuario, se cita como `L##`),
  `RepoTecnico/requerimientos.md` (29 RF, **16 RNF**, 11 RT, 8 RN, decisiones **D-01 a D-64**, ambigüedades A-01 a A-18 **todas cerradas**),
  `RepoTecnico/PROPUESTA-PAGINA-GGTO.md` (arquitectura y ciclos C1-C7),
  `RepoTecnico/diccionario_datos.md` (`averias.json`, `despacho.json`, `estructura.json` posicional y archivos de configuración),
  `RepoTecnico/entornos_globales.md` (rutas, lanzador, CSV real),
  `RepoTecnico/auditoria_fase1.md` (29 hallazgos H-01 a H-29: **atendidos**; H-10 y H-28 quedaron atendidos parcialmente en su momento y **se cierran ahora** con D-41/D-42 (H-10) y D-48 (H-28), y **H-21 con D-40/RNF-13**),
  `RepoTecnico/estado_proyecto.md` (estado y decisiones vigentes),
  `RepoTecnico/casos_uso/reauditoria_casos_uso.md` (reauditoría del 15/09/2026: veredicto APTO CON RESERVAS, 30 hallazgos nuevos H-N-01 a H-N-30 y 3 anteriores sin cerrar —H-19, H-29 y H-33—, corregidos en esta revisión).
- **Informe de corrección:** `RepoTecnico/casos_uso/auditoria_casos_uso.md` (35 hallazgos H-01 a H-35 y 18 preguntas). Las correcciones acumuladas del documento aplican las decisiones **D-29 a D-50**; esta revisión añade **D-42 a D-50**.
- **Documentos de apoyo (solo lectura de encabezados):** `detalle_averias_gpon 12_09_2026.csv` (80 columnas, separador `;`) y `alta_manual.csv` (42 columnas).
- **Documento hermano:** `RepoTecnico/casos_uso/diagramas.md` (diagrama UML de casos de uso, diagramas de secuencia y diagrama de estados: 8 bloques Mermaid, todos sincronizados con esta revisión).

---

## 1. Convenciones

1. **Actor principal:** quien inicia y obtiene el valor del caso de uso. **Actores secundarios:** quienes participan, validan o reciben el resultado.
2. **Ciclo:** C1…C7 según `requerimientos.md` §8. **Prioridad:** `MVP` = ciclos C1, C2 y C3 (decisión D-02); `posterior` = C4 a C7.
3. **Trazabilidad:** cada caso de uso lista los RF, RNF, RT y RN que cubre y las decisiones D-xx que aplica. Todo caso de uso cubre al menos un RF. Las marcas **`[H-xx]`** que aparecen en algunos pasos y flujos **no son códigos de requisito**: identifican el **hallazgo de auditoría que originó la corrección** de ese texto (convención de §1.3 y residuo de H-N-30); el requisito aplicable se cita siempre junto a ellas (RF, RNF, RT, RN o D-xx).
4. **Gherkin:** `Dado / Cuando / Entonces / Y`. Cada criterio es verificable: tiene dato de entrada, acción y resultado observable con número concreto. Si un criterio no es testeable se reescribe; no se admite "debe ser rápido", "debe ser usable" ni "etc.".
5. **EARS (restricciones del sistema):** se usa para lo que **no** es acción del usuario, con los cinco patrones:
   - *Ubicuo:* «El sistema deberá …»
   - *Dirigido por evento:* «Cuando &lt;disparador&gt;, el sistema deberá …»
   - *Dirigido por estado:* «Mientras &lt;estado&gt;, el sistema deberá …»
   - *Comportamiento no deseado:* «Si &lt;condición&gt;, entonces el sistema deberá …»
   - *Característica opcional:* «De acuerdo con &lt;característica&gt;, el sistema deberá …»
6. **Nomenclatura de dominio (RNF-07):** `status` = PEND / GESTION / CERRADO (**tres estados; el cuarto estado `ASGN` queda sin efecto por D-38**); `resolucion` = IVR / COS / COLA; `clase` = REP / CNS; `nivel` = COM / REF; `tipo_abonado` = RES / EMP (D-17); `sacas` = SI / NO. En pantalla se escriben "Gestión" y "Cerrado", nunca "estatus".
7. **Fechas:** `DD/MM/AAAA` (RNF-06). Semana operativa de **lunes a sábado** (RN-08). **Muestra real del 12/09/2026:** 80 columnas, 56 registros y 3 centrales — **51 de Francisco Salias, 4 de LAS MERCEDES CPA y 1 de EL HATILLO**; los recuentos «17 con palabras clave y 39 sin ellas» que circulaban antes se calcularon **por error sobre los 56 registros**, no sobre los 51 filtrados (H-01). El desglose vigente de Francisco Salias, con el catálogo de claves de **D-65**, es **18 PEND y 33 GESTION**: 17 registros traen palabras clave y 34 no las traen; como los **3 `ASGN` del CSV entran como PEND por D-38**, quedan **17 + 1 = 18 PEND** y **33 GESTION** (cuadre 17 + 34 = 51, H-N-25 y D-65). Los umbrales de desempeño aplicables son los de D-24 (1.000 casos; filtrado y orden &lt; 1,5 s; MONITOREO &lt; 3 s).
8. **Las 18 ambigüedades están cerradas (18 de 18).** A-01 a A-18 quedaron resueltas: las seis últimas —A-05, A-08, A-09, A-10, A-11 y A-14— con las decisiones **D-29 a D-34**. Por tanto **no hay supuestos**: cuando un caso de uso aplica una decisión heredada de una ambigüedad, **cita la decisión (D-29 a D-34)** tanto en el paso afectado como en su línea de **Trazabilidad**, y no usa marcas de supuesto ni lenguaje de «provisional». La marca de supuesto por ambigüedad queda erradicada por completo de este documento (**0 marcas**, verificado).
9. **Decisiones derivadas registradas.** Los umbrales de desempeño se citan como **D-24** (1.000 casos; filtrado y orden &lt; 1,5 s; MONITOREO &lt; 3 s). Rango de decisiones vigente para este documento: **D-01 a D-64**. Las decisiones **D-42 a D-50** se aplicaron en la revisión del 15/09/2026; las **D-51 a D-54** en la segunda pasada (H-N-27); en la última pasada de coherencia se cierran **D-55** (solo dos roles: operador y supervisor), **D-56** (historial inmutable `historial.jsonl`, H-10 cerrado, RNF-09 completo), **D-57** (los intentos fallidos de sesión se registran sin bloquear la cuenta), **D-58** (ficha de tratamiento de datos personales y log de la aplicación de 5 MB × 5 archivos, sin datos personales) y **D-59** (el emisor del CSV solo participa en CU-08: se retira su relación con CU-09); y en la **cuarta pasada** se incorporan **D-60** (el operador propone el sector y el supervisor aprueba, CU-09), **D-61** (campo **`rol`** de `tecnicos.json`: `Operador`/`Supervisor`, por defecto `Operador`, fuente del rol de la matriz de §2.1), **D-62** (arranque en frío: el primer supervisor se crea sin sesión, con `rol = Supervisor` y `clave_cambio_obligatorio = SI`), **D-63** (la credencial es el SHA-256 hexadecimal de 64 caracteres de `clave_sal + ":" + contraseña` en UTF-8, con sal aleatoria por técnico) y **D-64** (log de accesos `datos/incidencias.log` con intentos fallidos y acciones denegadas, sin datos personales, con rotación de 5 MB × 5 archivos).
10. **Persistencia (D-01, D-15, D-19):** la superficie se sirve desde un servidor local en loopback (`--bind 127.0.0.1`, puerto 8787) que publica **solo** el subdirectorio de la aplicación; los JSON de trabajo viven en `C:\GGTO\datos` (fuera de Google Drive) y se leen/escriben con File System Access API.
11. **Permisos (D-35, RNF-12):** toda acción de escritura exige un rol autorizado según la **matriz acción×rol de §2.1**; la sola identificación de sesión no autoriza. Cada caso de uso que escribe declara su precondición de rol, su restricción EARS de autorización y el flujo alternativo «acción no permitida para su rol».
12. **Autenticación (D-29, D-39):** la sesión exige `P00` **y contraseña** verificada contra el hash con sal guardado en `tecnicos.json`; la contraseña tiene **8 caracteres como mínimo**, **caduca a los 90 días** y **nunca** se persiste ni se muestra en claro.
13. **Accesibilidad mínima obligatoria (D-40, RNF-13):** navegación completa por teclado (`Tab`, `Enter` y flechas en la tabla de CASOS), foco visible, `label` asociado a cada campo, contraste mínimo **4,5:1** y **tabla o texto alternativo equivalente en cada gráfico**. Aplica de forma **transversal** a toda la interfaz (CU-01 a CU-22) y su verificación formal vive en **CU-01** (diálogo de sesión), **CU-10** (tabla), **CU-18** y **CU-19** (gráficos).
14. **Concurrencia sin bloqueo (D-41, RNF-14):** no hay bloqueo de archivo; cada guardado **relee** el archivo, compara su marca de modificación (`fecha_modificacion`) con la capturada al cargarlo y, **si difieren, impide el guardado** hasta que el usuario elija entre *Recargar* (perdiendo sus cambios locales) o *Sobrescribir* conscientemente; el aviso indica quién y cuándo modificó por última vez (`usuario_modificacion` y `fecha_modificacion`). Aplica a **todos** los archivos compartidos: `averias.json` y los padrones y catálogos (`central.json`, `tecnicos.json`, `flota.json`, `cuadrillas.json`, `sectores.json`, `claves_clasificacion.json`). La concurrencia deja de ser un supuesto no verificado: es un requisito probado en CU-12, CU-13, CU-14, CU-15 y CU-21 y en los CU que editan padrones. La marca que se compara (`fecha_modificacion`) es un campo **TEXTO** `DD/MM/AAAA hh:mm` en el diccionario: la comparación es de **igualdad o de orden de texto con formato fijo**, nunca un rango de fechas (H-29).
15. **Integridad de escritura (D-42, RNF-15):** ningún guardado del maestro se confirma sin verificación. Antes de escribir, el sistema copia el maestro a `averias_AAAA-MM-DD_HHMM.bak` (**se conservan las 10 últimas**); escribe en un **archivo temporal**; **relee y compara** el contenido (mismo número de registros e igualdad del texto serializado); y **solo entonces** la pantalla confirma el cambio. Si algo falla, **restaura el respaldo**, avisa y **no confirma**. Aplica a **todos** los casos de uso que escriben `averias.json`, sin excepción: CU-08 (ingesta), **CU-09 (asignación de sector)**, CU-10 (edición en línea), CU-12 (cierre y reapertura), CU-13 (bandeja GESTION), CU-14 (alta manual), CU-16 (despacho), CU-20 (anotación de acciones), CU-21 (respaldo y restauración) y CU-22 (contingencia). CU-09 queda incorporado expresamente al flujo D-42/RNF-15 en esta revisión (H-N-06). **Cada uno de esos guardados añade además sus líneas al historial inmutable `historial.jsonl` (D-56, §1.19).**
16. **Política de respaldo (D-49, RNF-16):** al **cerrar la jornada** la página ofrece crear una copia **fechada con hora** del maestro —`averias_AAAA-MM-DD_HHMM.json`— en **`C:\GGTO\respaldo\`**, **sin cifrado**; el supervisor la lleva después a la red o a un pen drive. La copia incluye **`historial.jsonl` íntegro** (se copia junto con el maestro y **nunca se recorta**, D-56). Objetivos declarados y verificables: **RTO de 1 hora** y **RPO = el cierre del día anterior**. La restauración copia una de esas copias sobre `C:\GGTO\datos\averias.json` previa confirmación del supervisor, y la prueba de restauración queda documentada en C7. Aplica a **CU-21** (dueño del respaldo) y se cita en CU-14, CU-15 y CU-22.
17. **Nada se muestra sin sesión (D-50, RNF-08):** sin una **identificación válida** la página **no renderiza ningún dato**: al abrirse solo se ve el diálogo de acceso y quedan ocultos la tabla de CASOS, los conteos, las fichas, los gráficos y cualquier campo del maestro. Los casos de uso de consulta y de gráficos (**CU-10, CU-11, CU-18, CU-19 y CU-20**) declaran la sesión identificada como precondición y contemplan en sus flujos alternativos la **pérdida de sesión** (por cierre o por expiración de las 8 horas de D-45), que devuelve la pantalla al diálogo y oculta los datos ya mostrados.
18. **No hay puntos `&lt;PENDIENTE&gt;` de decisión del usuario.** Con **D-42 a D-59** quedaron cerrados todos los puntos de decisión que la auditoría y la reauditoría dejaron planteados, incluidos los que exigían una decisión nueva del usuario: H-N-07 y H-N-17 (**D-57** y **D-58**), H-N-20 (**D-55**), H-N-21 (**D-34** y **D-48**) y H-N-31 (**D-58**). §5.4 es la **única** sección de pendientes y recoge solo pendientes **técnicos de implementación**, sin marcas `&lt;PENDIENTE&gt;` en el cuerpo de los casos de uso.
19. **Historial inmutable (D-56, RNF-09):** cada cambio de un caso (`status`, `clase`, `nivel`, `tipo_abonado`, `sector`, `Reparador Principal`, cierre, `sacas`, `observaciones`) **añade** una línea a `C:\GGTO\datos\historial.jsonl` (JSON Lines, **append-only**) con `fecha_hora`, `operador` (`P00` de la sesión), `id_averia`, `campo`, `valor_anterior`, `valor_nuevo` y `accion` (`edicion` | `cierre` | `reapertura` | `asignacion` | `ingesta`). **Nada se borra ni se sobrescribe** y el maestro sigue guardando además el último cambio (`usuario_modificacion`, `fecha_modificacion`). La **lectura** de ese archivo es la que alimenta la consulta de auditoría de **CU-15**; el respaldo lo copia junto con el maestro y **nunca lo recorta** (§1.16, CU-21). Aplica a **CU-08, CU-09, CU-10, CU-12, CU-13, CU-14, CU-15, CU-16, CU-20 y CU-21**.
20. **Registro de accesos (D-57, D-58, D-64):** los **intentos fallidos de sesión** (con fecha, hora y `P00` intentado) y las **acciones denegadas por el rol** («Acción no permitida para su rol») se anotan en el **log de la aplicación** —`datos/incidencias.log`, rotación por tamaño **5 MB × 5 archivos**, **sin datos personales** (D-58, **D-64**)—, **no** en `historial.jsonl`: ese archivo es *append-only* y **solo** registra cambios de campos de un caso (§1.19). **D-64** fija además el destino, el contenido y el nombre de las copias: cuando `incidencias.log` supera 5 MB se renombra a **`incidencias.1.log`** y la cascada desplaza hasta **`incidencias.5.log`**, descartando el más antiguo (procedimiento en `entornos_globales.md` §4.2; el plan de rotación es lógica pura de `nucleo.js` y su aplicación al disco vive en `almacen.js`). La cuenta **no se bloquea** por acumular intentos fallidos (D-57): el registro es la única constancia del intento, y con él se cierra la reserva que RNF-09 mantenía anotada. Aplica a **CU-01** (intentos de sesión) y a todos los CU que deniegan una acción por rol (CU-02 a CU-22). **Toda mención de este documento a «registrar el intento» o «registra el intento»** —en flujos alternativos, criterios de aceptación o EARS— **se refiere a ese log de la aplicación y nunca a `historial.jsonl`.**
21. **Rol de la sesión (D-61):** el rol **no se deduce del nombre ni del `P00`**: se lee del campo **`rol` de `tecnicos.json`**, con los dos únicos valores **`Operador`** y **`Supervisor`** y **`Operador` por defecto** (un registro sin `rol` se lee como operador). Junto con `status` (Activo/Inactivo) es lo que determina la matriz acción×rol de **§2.1** (D-35, RNF-12). El supervisor lo asigna y lo edita en **CU-03**; la sesión lo resuelve en **CU-01** (paso 10).
22. **Arranque en frío (D-62):** si `tecnicos.json` está **vacío** no existe ninguna sesión válida —y por D-50 no debería verse ningún dato—, pero sin al menos un supervisor nadie podría crear los padrones. En ese único caso la página ofrece crear el **primer supervisor**: es el **único supuesto en que se crea un padrón sin sesión**, el registro nace con `rol = Supervisor` y `clave_cambio_obligatorio = SI`, y **en cuanto existe un supervisor el paso desaparece** y toda alta exige sesión de supervisor (**CU-03**, flujo 2b).

---

## 2. Actores

> **Nota de roles (D-35).** La decisión **D-35** absorbe el rol «administrador» en el **supervisor**: a partir de ella el supervisor concentra todas las acciones, incluidas la bandeja GESTION, los padrones, los sectores, las palabras clave, el despacho y el respaldo. En este documento el actor principal «Supervisor (función administrativa)» sustituye al antiguo «Administrador» y **no** existe un rol administrador separado. La matriz acción×rol de §2.1 es la fuente única de permisos. **Roles vigentes (D-55): solo dos —operador de la central y supervisor—**; no existe ni se añade ningún rol adicional (ni «administrador», ni «jefe de central», ni «auditoría / control interno»), y sus funciones quedan absorbidas por el supervisor. Los actores secundarios (cuadrilla / técnico de calle, emisor del CSV y soporte TI del puesto) **no tienen rol ni permisos de escritura**. El **emisor del CSV** es actor secundario **únicamente de CU-08** (entrega el archivo) y **no participa en CU-09** (D-59): la cola de direcciones sin sector la resuelve el **supervisor** (rol elevado, D-35), con la excepción del sector mínimo que la matriz de §2.1 concede al operador.

| Actor | Tipo | Descripción | Casos de uso |
|---|---|---|---|
| **Operador de la central** | Principal | Trabaja la operación diaria: ingiere el CSV (CU-08), resuelve las direcciones sin sector de la cola (CU-09, cuya titularidad es del **supervisor**, rol elevado, D-59), **consulta** los casos de su cuadrilla (CU-10, CU-11), cierra los casos **asignados a su propia cuadrilla** (CU-12) y da de alta casos manuales (CU-14). Se identifica en cada sesión con su `P00` **y su contraseña** contra `tecnicos.json` (D-16, D-29, D-39, RNF-08). **No** accede a los padrones, a la bandeja GESTION (**CU-13, exclusiva del supervisor**), al despacho, al respaldo ni al catálogo completo de sectores (D-35, RNF-12). | **CU-01, CU-08, CU-09, CU-10, CU-11, CU-12, CU-14, CU-22** |
| **Supervisor** (absorbe la función administrativa, D-35) | Principal | Responsable del despacho, de las cifras y del gobierno del sistema: puede **todo**, incluida la bandeja GESTION (CU-13), los padrones (CU-03, CU-04, CU-05), los sectores (CU-06), las palabras clave (CU-07), la ingesta y la cola de sectores (CU-08, CU-09), el despacho y sus PDF (CU-16, CU-17), el MONITOREO y los reportes (CU-18, CU-19, CU-20), el respaldo y la restauración (CU-21), el diagnóstico (CU-22) y el restablecimiento de contraseñas. | **CU-01 a CU-22** |
| **Cuadrilla / técnico de calle** | Secundario | Recibe la hoja impresa del despacho, ejecuta el trabajo y devuelve la hoja al cierre de la jornada. No opera la página en el MVP. | CU-16, CU-17 |
| **Jefe de central** | **Retirado (D-55)** | Consumía las cifras de MONITOREO y de los reportes. **Ya no es un actor del modelo:** sus funciones las ejerce el **supervisor**, que es quien consulta las cifras y decide sobre los casos especiales; el rol queda absorbido como el antiguo «administrador» (D-35). | — (funciones en CU-18, CU-19 y CU-20, a cargo del supervisor) |
| **Emisor del CSV (origen corporativo / VENAPP)** | Secundario externo | Entrega el archivo diario `detalle_averias_gpon DD_MM_AAAA.csv`. No interactúa con la interfaz: es el origen del dato y el disparador de la ingesta. **No participa en CU-09** (D-59): su relación es únicamente con CU-08. | CU-08 |
| **Auditoría / control interno** | **Retirado (D-55)** | Consultaba el historial de cambios y el control documental del despacho. **Ya no es un actor del modelo y no se añade ningún rol nuevo:** la consulta de la auditoría de cambios (CU-15) y el control documental del despacho (CU-17) los ejerce el **supervisor**. | — (funciones en CU-15 y CU-17, a cargo del supervisor) |
| **Soporte TI del puesto** | Secundario | Atiende el arranque del puesto (puerto ocupado, ausencia de Python/Node, navegador sin File System Access API, fallo de la ruta de respaldo). **No tiene permisos de escritura sobre los datos** y, por tanto, no figura en la matriz de §2.1; su criterio de aceptación propio es CU-22 (H-N-05, H-18). | CU-01, CU-21, CU-22 |

### 2.1 Matriz acción×rol (D-35, RNF-12)

| Acción | Operador de la central | Supervisor (función administrativa) |
|---|---|---|
| Iniciar sesión (CU-01) | Permitida | Permitida |
| Consultar casos (lectura) (CU-10, CU-11) | **Solo los casos con `Reparador Principal` = `id` de su cuadrilla** | Todos |
| Cerrar o reabrir un caso (CU-12) | **Solo casos de su propia cuadrilla** | Todos |
| Editar `clase` / `nivel` / `tipo_abonado` (CU-10) | **Solo casos de su propia cuadrilla** | Todos |
| Alta manual de caso (CU-14) | Permitida (el caso se crea para su cuadrilla si el operador tiene una asignada) | Permitida |
| Ingesta del CSV (CU-08) | Permitida | Permitida |
| Resolver la cola de direcciones sin sector (CU-09) | Permitida **solo como propuesta**: el operador propone el sector para la dirección sin coincidencia y queda **pendiente de aprobación** del supervisor (**D-60**) | Permitida (titular de la cola, D-59; **aprueba o rechaza las propuestas**, D-60) |
| Bandeja GESTION (CU-13) | **Prohibida** | Permitida (opera la bandeja) |
| Padrones: técnicos, flota, cuadrillas (CU-03, CU-04, CU-05) | **Prohibida** | Permitida |
| Configuración de la central (CU-02) | **Prohibida** | Permitida |
| Sectores: CRUD completo (CU-06) | **Prohibida**; el operador solo **propone** el sector de una dirección en cola (D-60) | Permitida |
| Palabras clave y modo de búsqueda (CU-07) | **Prohibida** | Permitida |
| Despacho y ajuste de asignaciones (CU-16) | **Prohibida** | Permitida |
| Emisión de PDF y registro de entrega (CU-17) | **Prohibida** | Permitida |
| MONITOREO, GRAFICOS y reportes (CU-18, CU-19) | **Prohibida** | Permitida |
| Casos especiales y averías concentradas (CU-20) | **Prohibida** | Permitida |
| Respaldo y restauración (CU-21) | **Prohibida** | Permitida |
| Cambio del umbral de averías concentradas (CU-20) | **Prohibida** | Permitida |
| Consulta de auditoría (CU-15) y control documental del despacho (CU-17) | **Prohibida** | Permitida (las ejerce el supervisor, D-55) |
| Contingencia y diagnóstico (CU-22) | Permitida (ejecución del lanzador y consulta del estado) | Permitida |
| Contraseña de técnicos (alta, cambio y restablecimiento) (CU-03) | **Prohibida** (solo puede cambiar la propia en el paso 8 de CU-01) | Permitida |

**Reglas de la matriz:**

- **R1.** Si un operador intenta una acción prohibida, el sistema **no** la ejecuta, muestra «Acción no permitida para su rol» y registra el intento con operador y fecha/hora en el **log de la aplicación** (`datos/incidencias.log`, 5 MB × 5 archivos, sin datos personales, §1.20, D-57 y D-58), **sin** modificar el maestro y **sin** bloquear la cuenta.
- **R2.** Un operador **no puede abrir ni consultar** el detalle de un caso cuyo `Reparador Principal` corresponda a otra cuadrilla; el sistema muestra «El caso no está asignado a su cuadrilla».
- **R3.** El cierre de un caso por el operador exige que el `Reparador Principal` del caso coincida con el `id` de la cuadrilla del técnico identificado (equivalencia de D-37).
- **R4.** La bandeja GESTION (CU-13) y el bloque CONCENTRADAS / ESPECIALES (CU-20) son **exclusivos del supervisor**.
- **R5.** La verificación efectiva de la matriz exige la aplicación construida y un operador con cuadrilla asignada → **necesita verificación en el puesto**.

**Nota 1 — credencial de sesión (D-39, resuelta).** La ambigüedad sobre la fuerza de la credencial quedó cerrada: se exige **`P00` + contraseña de 8 caracteres o más**, almacenada como **hash con sal (SHA-256 + sal por técnico)** en `tecnicos.json`, con **cambio obligatorio cada 90 días** y **restablecimiento por el supervisor**. La contraseña **nunca** se guarda ni se muestra en claro. **Riesgo aceptado y anotado:** el hash en un archivo local servido sin TLS protege la **atribución** (evita suplantaciones casuales) pero **no** es una defensa fuerte frente a quien pueda leer `tecnicos.json` o capturar el tráfico en el propio puesto; la mitigación documentada es el puesto único autorizado y la red de loopback (D-15), y lo formaliza el agente padre.

---

## 3. Índice de casos de uso

| CU | Nombre | Actor principal | Ciclo | Prioridad |
|---|---|---|---|---|
| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |
| CU-02 | Configurar los datos operativos de la central | Supervisor (función administrativa) | C1 | MVP |
| CU-03 | Gestionar el padrón de técnicos | Supervisor (función administrativa) | C1 | MVP |
| CU-04 | Gestionar el padrón de flota | Supervisor (función administrativa) | C1 | MVP |
| CU-05 | Gestionar el padrón de cuadrillas | Supervisor (función administrativa) | C1 | MVP |
| CU-06 | Gestionar el catálogo de sectores | Supervisor (función administrativa) | C1 | MVP |
| CU-07 | Gestionar las palabras clave de clasificación | Supervisor (función administrativa) | C2 | MVP |
| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central (y supervisor) | C2 | MVP |
| CU-10 | Gestionar y filtrar los CASOS | Operador de la central | C1 / C3 | MVP |
| CU-11 | Consultar la ficha de un caso | Operador de la central | C3 | MVP |
| CU-12 | Cerrar un caso | Operador de la central | C3 | MVP |
| CU-13 | Gestionar telefónicamente la bandeja GESTION | Supervisor (función administrativa) | C3 | MVP |
| CU-14 | Dar de alta manual un caso | Operador de la central (y supervisor) | C3 | MVP |
| CU-15 | Consultar la auditoría de cambios de un caso | Supervisor (función administrativa) | C1 | MVP |
| CU-16 | Generar y ajustar el despacho del día | Supervisor (función administrativa) | C4 | posterior |
| CU-17 | Emitir el PDF de despacho por cuadrilla y registrar la entrega | Supervisor (función administrativa) | C4 | posterior |
| CU-18 | Monitorear la gestión diaria y semanal | Supervisor (función administrativa) | C5 | posterior |
| CU-19 | Emitir el despacho en pantalla y PDF y el seguimiento semanal estadístico | Supervisor (función administrativa) | C6 | posterior |
| CU-20 | Vigilar casos especiales y averías concentradas | Supervisor (función administrativa) | C6 | posterior |
| CU-21 | Respaldar y restaurar los datos | Supervisor (función administrativa) | C1 (respaldo) / C7 | MVP (respaldo manual, D-36) |
| CU-22 | Operar en contingencia y diagnosticar el entorno | Supervisor (función administrativa) | C1 / C7 | MVP |

**Total: 22 casos de uso.** El rol administrador está absorbido por el supervisor (D-35). El **operador** presta servicio en CU-01, CU-08, CU-09, CU-10, CU-11, CU-12, CU-14 y CU-22 —y **no** en CU-13—; el **supervisor** en CU-01 a CU-22, coherente con la matriz de §2.1 (H-N-04). En **CU-09** la titularidad de la cola de direcciones sin sector es del **supervisor** (rol elevado) y el operador conserva la creación del sector mínimo de §2.1 (D-35, D-59); el **emisor del CSV** solo interviene en CU-08 (D-59).

---

## 4. Casos de uso

### CU-01 — Iniciar sesión e identificar al operador

- **Actor principal:** Operador de la central (el supervisor y la función administrativa usan el mismo mecanismo, D-35).
- **Actores secundarios:** Soporte TI del puesto (arranque del servidor).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** el servidor local responde en `http://localhost:8787` (loopback) y sirve solo el subdirectorio de la aplicación; `C:\GGTO\datos\tecnicos.json` existe y es legible, y cada técnico tiene `P00`, `clave_hash`, `clave_sal`, `clave_fecha_cambio` y `clave_cambio_obligatorio` (D-29, D-39, RF-12); `C:\GGTO\datos\cuadrillas.json` existe y contiene la cuadrilla del técnico si este debe cerrar casos (D-37, RNF-12).
- **Postcondiciones:** la sesión queda asociada a un técnico **activo** del padrón con credencial verificada, con su **rol leído del campo `rol` de `tecnicos.json`** (D-61: `Operador` o `Supervisor`, `Operador` por defecto) y, si es operador, con el `id` de su cuadrilla; la página habilita las acciones permitidas por la matriz de §2.1 (D-35, RNF-12); toda modificación posterior registra ese operador y la fecha/hora (RNF-09); los intentos fallidos quedan anotados en el log de accesos (D-57, D-58, D-64).

**Trazabilidad:** RF-01, **RF-12** (estados `clave_cambio_obligatorio` y **`rol`** leídos de `tecnicos.json`); RNF-03, RNF-07, **RNF-08**, **RNF-12, RNF-13**; RT-06, RT-07, RT-09, RT-10; D-01, D-15, D-16, D-19, **D-29, D-35, D-37, D-39, D-40, D-45, D-50, D-57, D-58, D-61, D-64**; H-01, H-03, H-05, H-31, H-N-07, H-N-17.

**Flujo principal**

1. El operador abre la página en Edge o Chrome desde `http://localhost:8787/index.html`.
2. El sistema detecta el contexto `http://localhost` y comprueba que existen los archivos de `C:\GGTO\datos` (al menos `tecnicos.json` y `averias.json`).
3. El sistema muestra el diálogo **Identificación del operador** con los campos ***P00*** y ***Contraseña*** y el botón *Iniciar sesión*. [D-29, D-39]
4. El operador escribe su `P00` y su contraseña, y pulsa *Iniciar sesión*.
5. El sistema valida la longitud de la contraseña (mínimo **8 caracteres**) antes de verificar la credencial; si tiene menos de 8, rechaza el envío sin consultar el padrón. [D-39]
6. El sistema busca **coincidencia exacta por `P00`** en `tecnicos.json` con `status` activo; el campo `nombre` **no** es un identificador válido. [D-29]
7. El sistema calcula el **hash (SHA-256 + sal del técnico)** de la contraseña escrita y lo compara con `clave_hash`; si no coincide, rechaza la sesión con un mensaje **genérico** que no revela cuál de los dos datos falló. [D-39]
8. Si la credencial es válida y `clave_fecha_cambio` tiene **más de 90 días**, el sistema **no abre la sesión operativa**: exige el cambio de contraseña antes de continuar (paso 9) y solo después abre la sesión. [D-39]
8b. Si la credencial es válida y `clave_cambio_obligatorio = SI` en `tecnicos.json` —lo que ocurre tras un alta (CU-03 paso 5) o un restablecimiento por el supervisor (CU-03 paso 8)—, el sistema **tampoco abre la sesión operativa**: exige el cambio de contraseña por el mismo camino del paso 9, con independencia de la antigüedad de `clave_fecha_cambio`, y al guardarla deja `clave_cambio_obligatorio = NO`. [RF-12, D-39]
9. El operador informa la nueva contraseña dos veces (mínimo 8 caracteres); el sistema guarda su `clave_hash`, una **nueva sal**, `clave_fecha_cambio` = fecha del día y `clave_cambio_obligatorio = NO`, y no conserva la anterior en claro. [RF-12, D-39]
10. El sistema abre la sesión, **resuelve el rol leyendo el campo `rol` de `tecnicos.json`** (D-61: `Operador` o `Supervisor`, `Operador` por defecto cuando el registro no lo trae) y, si es operador, el `id` de su cuadrilla en `cuadrillas.json` (`cuadrillas.id` = valor de `Reparador Principal`, D-37), y muestra en la barra superior el nombre, la cédula, el `P00`, el rol y la cuadrilla. [D-61]
11. El sistema presenta las 7 pestañas —PANEL, MONITOREO, GRAFICOS, CASOS, DESPACHO, CONFIGURACION y GESTION— pero **habilita solo las que la matriz de §2.1 permite a su rol** (D-35, RNF-12).
12. El sistema deja la pestaña PANEL activa y habilita los botones de edición permitidos para su rol.

**Flujos alternativos**

- **1a. El operador abre el archivo con doble clic (`file://`).** El sistema detecta el protocolo `file:`, bloquea la edición y muestra el mensaje «Abra la página con `servir-ggto.ps1` (http://localhost:8787). Desde `file://` no se pueden leer ni escribir los JSON.» [D-01, RT-06, H-23]
- **4a. `P00` o contraseña vacíos.** El sistema rechaza el envío con «Indique su P00 y su contraseña» y no abre la sesión; se permiten 3 intentos fallidos antes de volver al paso 3 con el contador visible y **cada intento anotado en el log de la aplicación** con fecha, hora y `P00` intentado (5 MB × 5 archivos, sin datos personales). **La cuenta no se bloquea** (D-57): el contador solo informa. [D-29, D-39, **D-57, D-58**, §1.20]
- **5a. Contraseña de menos de 8 caracteres.** El sistema rechaza el envío con «La contraseña debe tener al menos 8 caracteres» **sin consultar el padrón**, cuenta el intento y **lo anota en el log de la aplicación**; la cuenta no se bloquea. [D-39, **D-57, D-58**]
- **7a. Credencial incorrecta (P00 inexistente, técnico inactivo o contraseña que no corresponde al hash).** El sistema muestra el mensaje **genérico** «P00 o contraseña incorrectos» (nunca indica cuál de los dos falló ni si el técnico existe), **anota el intento en el log de la aplicación** con fecha, hora y `P00` intentado, mantiene la sesión cerrada y **no bloquea la cuenta** por acumulación de intentos. [D-29, D-35, D-39, **D-57, D-58**, §1.20]
- **8c. Cambio obligatorio pendiente (`clave_cambio_obligatorio = SI`).** El sistema muestra «Debe cambiar la contraseña antes de operar: el supervisor la asignó o restableció» y ejecuta el cambio obligatorio del paso 9; si el operador cancela, la sesión queda cerrada pero `clave_cambio_obligatorio` sigue en `SI`. [RF-12, D-39]
- **8a. Contraseña caducada (más de 90 días desde `clave_fecha_cambio`).** El sistema muestra «Su contraseña tiene más de 90 días: debe cambiarla antes de operar», bloquea toda acción de escritura y ejecuta el cambio obligatorio del paso 9; si el operador cancela, la sesión queda cerrada. [D-39]
- **8b. `tecnicos.json` no existe, está vacío o tiene JSON inválido.** El sistema muestra «Padrón de técnicos no disponible: &lt;detalle&gt;», ofrece la ruta `C:\GGTO\datos\tecnicos.json` y bloquea toda la edición hasta que se restaure desde respaldo (CU-21). [H-20, H-25]
- **10a. La sesión no tiene cuadrilla asociada (técnico sin cuadrilla activa).** El sistema abre la sesión **en modo consulta global de solo lectura**: no habilita el cierre de casos ni la edición en línea, y muestra «Sin cuadrilla asignada: solo consulta. Solicite su inclusión en CONFIGURACION/CUADRILLA». [D-35, D-37, RNF-12]
- **11a. Se cierra la sesión o expira.** La sesión dura **8 horas** contadas desde la identificación del paso 10 y también se cierra al cerrar la pestaña. Al expirar (o al cerrarse), el sistema vuelve al paso 3 y bloquea las acciones de escritura hasta una nueva identificación: al intentar editar exige **reingreso**. Lo ya guardado **no se pierde** —el maestro conserva todos los cambios persistidos—, pero los cambios cargados sin guardar se descartan y el sistema lo advierte antes de salir. [D-45]

**Criterios de aceptación (Gherkin)**

1. **Dado** que el servidor local escucha en `127.0.0.1:8787` y `tecnicos.json` contiene un técnico activo con P00 `12345`, nombre `Luis Pérez` y contraseña vigente `Clave2026`, **Cuando** el operador escribe `12345` y `Clave2026` y pulsa *Iniciar sesión*, **Entonces** la página muestra «Sesión: Luis Pérez (12345)» y habilita los botones *Guardar*, *Cerrar caso* y *Agregar caso*.
2. **Dado** el mismo técnico activo, **Cuando** el operador escribe `12345` y la contraseña `Clave26` (7 caracteres), **Entonces** el sistema muestra «La contraseña debe tener al menos 8 caracteres», no consulta el padrón y mantiene la sesión cerrada. [D-39]
3. **Dado** el mismo técnico activo con P00 `12345` y hash de la contraseña `Clave2026`, **Cuando** el operador escribe `12345` y la contraseña `OtraClave9`, **Entonces** el sistema muestra «P00 o contraseña incorrectos» —sin indicar cuál de los dos datos falló—, incrementa el contador de intentos a 1, **anota el intento en el log de la aplicación** (`P00` intentado, fecha y hora) y mantiene la sesión cerrada, **sin bloquear la cuenta**. [D-39, **D-57, D-58**]
4. **Dado** el mismo técnico activo, **Cuando** el operador escribe `99999` y la contraseña `Clave2026`, **Entonces** el sistema muestra exactamente el mismo mensaje genérico «P00 o contraseña incorrectos» y no revela que el P00 no existe. [D-39]
5. **Dado** un técnico con `status = Inactivo` y credencial correcta, **Cuando** el operador intenta iniciar sesión, **Entonces** el sistema muestra «P00 o contraseña incorrectos», **anota el intento en el log de la aplicación** con fecha, hora y `P00` intentado, mantiene la sesión cerrada y no bloquea la cuenta. [D-39, **D-57, D-58**]
6. **Dado** un técnico activo cuyo `clave_fecha_cambio` es del 01/05/2026 (más de 90 días antes del 14/09/2026), **Cuando** el operador inicia sesión con la credencial correcta, **Entonces** el sistema muestra «Su contraseña tiene más de 90 días: debe cambiarla antes de operar», **no** habilita ninguna pestaña de escritura y exige el cambio de contraseña. [D-39]
7. **Dado** el cambio obligatorio de contraseña exigido en el criterio anterior, **Cuando** el operador informa la nueva contraseña `Nueva2026` dos veces, **Entonces** `tecnicos.json` guarda un `clave_hash` distinto del anterior, una nueva `clave_sal`, `clave_fecha_cambio = 14/09/2026` y `clave_cambio_obligatorio = NO`, y ninguna parte del archivo contiene la contraseña en claro. [RF-12, D-39]
7b. **Dado** un técnico activo con `clave_cambio_obligatorio = SI` y `clave_fecha_cambio = 14/09/2026` (contraseña restablecida hoy por el supervisor), **Cuando** el operador inicia sesión con la credencial temporal correcta, **Entonces** el sistema **no** abre la sesión operativa, muestra «Debe cambiar la contraseña antes de operar: el supervisor la asignó o restableció» y exige el cambio del paso 9; tras informar `ClaveNueva26` dos veces, `tecnicos.json` queda con `clave_cambio_obligatorio = NO` y la sesión se abre. [RF-12, D-39]
8. **Dado** que la sesión está cerrada, **Cuando** el operador intenta pulsar *Cerrar caso*, **Entonces** el sistema no ejecuta la acción y muestra «Identifíquese para editar».
9. **Dado** que el operador abre `index.html` desde `file://`, **Cuando** la página termina de cargar, **Entonces** el sistema muestra el aviso de servidor local y ningún botón de edición queda habilitado.
10. **Dado** que `tecnicos.json` contiene un técnico activo cuyo `nombre` es `Luis Pérez` y cuyo P00 es `12345`, **Cuando** el operador escribe `Luis Pérez` en el campo *P00* y una contraseña cualquiera, **Entonces** el sistema muestra «P00 o contraseña incorrectos» —el nombre no es un identificador válido (D-29)— e incrementa el contador de intentos a 1.
11. **Dado** que el operador ya inició sesión, **Cuando** modifica el `status` de un caso de su cuadrilla, **Entonces** el caso queda con `usuario_modificacion` igual al P00 de la sesión y `fecha_modificacion` con formato `DD/MM/AAAA hh:mm`.
12. **Dado** un técnico activo con P00 `12345` cuyo `cuadrillas.id` es `C1`, **Cuando** inicia sesión, **Entonces** el sistema presenta las **7 pestañas** de RF-01 —PANEL, MONITOREO, GRAFICOS, CASOS, DESPACHO, CONFIGURACION y GESTION—, habilita **CASOS** (solo los casos de `C1`) y **PANEL**, y **no** habilita MONITOREO, GRAFICOS, DESPACHO, CONFIGURACION ni GESTION; el bloque **INGESTA** de CU-08 y el bloque **RESPALDO** de CU-21 **no son pestañas** y quedan además bloqueados por la matriz de §2.1. [RF-01, D-35, RNF-12]
13. **Dado** un técnico activo que no integra ninguna cuadrilla, **Cuando** inicia sesión, **Entonces** el sistema abre la sesión en modo consulta y muestra «Sin cuadrilla asignada: solo consulta», sin habilitar el cierre de casos.
14. **Dado** un equipo con Edge o Chrome versión 86 o superior, **Cuando** se carga la página desde `http://localhost:8787`, **Entonces** las 7 pestañas son navegables y ninguna dependencia se solicita por internet.
15. **Dado** el diálogo **Identificación del operador** con los campos *P00* y *Contraseña*, **Cuando** el usuario recorre el diálogo **solo con el teclado** (`Tab` para pasar de *P00* a *Contraseña* y a *Iniciar sesión*, `Enter` para enviar), **Entonces** el foco es visible en cada control, cada campo tiene su `label` asociado y la sesión se abre sin haber usado el ratón. [D-40, RNF-13]
16. **Dado** cualquier pantalla de la interfaz, **Cuando** se mide el contraste del texto y de los controles sobre su fondo, **Entonces** la relación es de al menos **4,5:1** en el texto normal y el foco visible se distingue con un indicador de contraste equivalente. [D-40, RNF-13]
17. **Dado** una sesión abierta a las 08:00 del 13/09/2026, **Cuando** a las 16:01 del mismo día el operador intenta editar `clase` en un caso de su cuadrilla, **Entonces** el sistema no ejecuta la edición, muestra «Sesión expirada (8 horas): identifíquese de nuevo» y exige el reingreso de `P00` y contraseña, y `averias.json` conserva intactos los cambios guardados antes de la expiración. [D-45]
18. **Dado** un `averias.json` con 51 casos y la página recién abierta, **Cuando** la página termina de cargar **sin** que se haya iniciado sesión, **Entonces** el único contenido visible es el diálogo **Identificación del operador**: la tabla de CASOS, la ficha de un caso, los conteos, los gráficos y cualquier campo del maestro quedan **sin renderizar**, y el DOM no contiene ningún dato del maestro. [D-50, RNF-08]
19. **Dado** una sesión de supervisor con MONITOREO abierto y la tabla de CASOS dibujada, **Cuando** el supervisor cierra la sesión (o la sesión expira a las 8 horas, D-45), **Entonces** la pantalla vuelve al diálogo **Identificación del operador**, los datos ya mostrados —tabla, conteos y gráficos— se ocultan, y cualquier intento de consulta responde «Identifíquese para editar». [D-45, D-50, RNF-08]
20. **Dado** `tecnicos.json` con dos técnicos activos y la misma contraseña —`12345` con `rol = Supervisor` y `4321` cuyo registro **no trae** el campo `rol`—, **Cuando** cada uno inicia sesión con su credencial correcta, **Entonces** la sesión de `12345` muestra el rol **Supervisor** y habilita los padrones, y la de `4321` muestra el rol **Operador** (por defecto, D-61), no habilita CONFIGURACION y solo ve los casos de su cuadrilla. [**D-61**, D-35, RNF-12]
21. **Dado** que el operador `4321` intenta abrir CONFIGURACION y `tecnicos.json` no declara su `rol`, **Cuando** el sistema evalúa el permiso, **Entonces** responde «Acción no permitida para su rol», no modifica ningún archivo y **anota el intento** con operador y fecha/hora en el **log de la aplicación** (`datos/incidencias.log`, §1.20): nunca lo habilita como supervisor por accidente ni escribe la denegación en `historial.jsonl`. [**D-61**, D-35, RNF-12, **D-64**, §1.20]

**Restricciones del sistema (EARS)**

- **Ubicuo:** El sistema deberá servir la página únicamente por `http://127.0.0.1:8787` y publicar solo el subdirectorio de la aplicación, dejando `datos/` y `RepoTecnico/` fuera del alcance HTTP. [D-15, RT-09]
- **Mientras** no exista una identificación válida, el sistema deberá mantener bloqueadas las acciones de edición, cierre, alta y configuración. [RNF-08]
- **El sistema deberá** exigir, para abrir la sesión, la combinación de `P00` de un técnico activo y una contraseña de **8 caracteres como mínimo** verificada contra el hash con sal almacenado en `tecnicos.json`. [D-29, D-39, RNF-08]
- **El sistema deberá** almacenar la contraseña únicamente como **hash (SHA-256) con sal por técnico**, y **no deberá** persistirla ni mostrarla en claro en ningún archivo, pantalla, mensaje o registro. [D-39]
- **Si** la credencial no es válida, entonces el sistema deberá responder con un mensaje genérico que no revele si el `P00` existe ni cuál de los dos datos falló, y deberá **anotar el intento** con fecha, hora y `P00` intentado en el **log de la aplicación** (5 MB × 5 archivos, sin datos personales), **sin bloquear la cuenta**. [D-39, **D-57, D-58**, §1.20]
- **Si** han transcurrido más de **90 días** desde `clave_fecha_cambio`, o **si** `clave_cambio_obligatorio` vale `SI` en `tecnicos.json`, entonces el sistema deberá exigir el cambio de contraseña antes de habilitar cualquier acción de la sesión. [RF-12, D-39]
- **Si** el rol de la sesión es operador, entonces el sistema deberá habilitar únicamente las acciones que le permite la matriz acción×rol, y deberá restringir la consulta, la edición y el cierre a los casos cuyo `Reparador Principal` sea el `id` de su cuadrilla. El rol se leerá del campo **`rol` de `tecnicos.json`** (`Operador` / `Supervisor`, por defecto `Operador`) y **nunca** se deducirá del nombre, del `P00` ni del `status` del técnico. [**D-61**, D-35, D-37, RNF-12]
- **Cuando** el log de accesos `datos/incidencias.log` supere **5 MB**, el sistema deberá rotarlo —`incidencias.log` → `incidencias.1.log` y la cascada hasta `incidencias.5.log`, descartando la copia más antigua— **antes** de escribir el evento nuevo, sin datos personales y sin interrumpir la sesión si la rotación falla. [**D-64**, D-57, D-58, §1.20]
- **Si** la sesión intenta una acción fuera de su rol, entonces el sistema deberá rechazarla, mostrar «Acción no permitida para su rol» y **anotar el intento** con operador y fecha/hora en el **log de la aplicación** (§1.20), sin modificar el maestro. [D-35, RNF-12, **D-57, D-58**]
- **Si** el navegador no soporta File System Access API, entonces el sistema deberá avisar «Modo consulta: este navegador no permite escribir los JSON» y ofrecer el modo descarga. [RNF-03, H-22]
- **El sistema deberá** permitir operar el diálogo de identificación y toda la interfaz **solo con el teclado**, con `label` asociado a cada campo, foco visible y contraste mínimo 4,5:1; y deberá ofrecer una **tabla o texto alternativo equivalente** para cada gráfico. [D-40, RNF-13]
- **El sistema deberá** registrar en cada cambio el operador de la sesión y la fecha/hora del cambio. [RNF-09, D-16]
- **Cuando** transcurran **8 horas** desde la identificación, o **cuando** se cierre la pestaña, el sistema deberá cerrar la sesión y exigir reingreso para cualquier acción de escritura, conservando sin pérdida todo lo ya guardado. [D-45]
- **Mientras** no haya una identificación válida, el sistema **no deberá** renderizar ningún dato del maestro: deberá mostrar solo el diálogo de acceso y mantener ocultos la tabla de CASOS, los conteos, las fichas de caso, los gráficos y cualquier campo de `averias.json`. [D-50, RNF-08]
- **Cuando** la sesión se cierre (por acción del usuario o por expiración de D-45), el sistema deberá volver al diálogo de acceso y **ocultar de inmediato** los datos ya mostrados, sin dejarlos en pantalla ni en el DOM. [D-45, D-50, RNF-08]

---

### CU-02 — Configurar los datos operativos de la central

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actores secundarios:** Operador de la central (consume el filtro en la ingesta).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12); `C:\GGTO\datos\central.json` accesible (puede no existir en la primera ejecución).
- **Postcondiciones:** `central.json` contiene los 10 campos operativos vigentes y la ingesta filtra el CSV contra ellos (RT-03).

**Trazabilidad:** RF-11; RNF-08, RNF-10, **RNF-12, RNF-14**; RT-01, RT-03; D-01, D-12, D-16, **D-35, D-41**; H-14.

**Flujo principal**

1. El supervisor entra en CONFIGURACION → **CENTRAL**.
2. El sistema muestra los 10 campos con el valor vigente: región, estado geográfico, capital del estado geográfico, municipio, parroquia, estado operativo, distrito, área, central y nombre de la central.
3. El supervisor edita los valores (para Francisco Salias, área 4: `area = AREA 4`, `central = 2324X`, `nombre_central = FRANCISCO SALIAS`).
4. El supervisor pulsa *Guardar*.
5. El sistema valida que los 10 campos no estén vacíos y que `area` y `central` no tengan espacios al inicio ni al final.
6. El sistema escribe `C:\GGTO\datos\central.json` y relee el archivo para confirmar el contenido.
7. El sistema muestra «Central guardada» y el resumen de los 10 campos.

**Flujos alternativos**

- **4a. Algún campo obligatorio vacío.** El sistema marca en rojo los campos vacíos, muestra «Complete: &lt;lista de campos&gt;» y no escribe el archivo.
- **6a. La escritura falla (permiso, disco, archivo bloqueado).** El sistema conserva el valor anterior en pantalla, muestra «No se pudo guardar `central.json`: &lt;detalle&gt;» y ofrece *Reintentar* y *Guardar copia en `datos_respaldo`*. [CU-21, H-09]
- **2a. `central.json` no existe.** El sistema muestra el formulario vacío con el botón *Crear central* y advierte que la ingesta quedará bloqueada hasta que exista el registro.
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra la pestaña CONFIGURACION ni ejecuta la escritura, y registra el intento. [D-35, RNF-12]
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.

**Criterios de aceptación (Gherkin)**

1. **Dado** el formulario CENTRAL vacío, **Cuando** el supervisor guarda con 9 campos informados y `municipio` vacío, **Entonces** el sistema muestra «Complete: municipio» y `central.json` no se crea ni se modifica.
2. **Dado** el formulario CENTRAL con `area = AREA 4`, `central = 2324X` y `nombre_central = FRANCISCO SALIAS`, **Cuando** el supervisor pulsa *Guardar*, **Entonces** `central.json` contiene los 10 campos y la relectura inmediata devuelve los mismos valores.
2b. **Dado** que `central.json` se cargó con `fecha_modificacion = 13/09/2026 09:00`, **Cuando** el supervisor pulsa *Guardar* y el archivo en disco tiene ahora `fecha_modificacion = 13/09/2026 09:30` con `usuario_modificacion = 12345`, **Entonces** el sistema no escribe, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 09:30» y deshabilita *Guardar* hasta que el supervisor elija *Recargar* o *Sobrescribir*. [D-41, RNF-14]
3. **Dado** que `central.json` tiene `central = 2324X`, **Cuando** se ejecuta la ingesta del CSV del 12/09/2026, **Entonces** el sistema procesa solo los **51 registros** con `nombre central = FRANCISCO SALIAS` y descarta los 5 restantes (4 de LAS MERCEDES CPA y 1 de EL HATILLO).
4. **Dado** que `central.json` no existe, **Cuando** el usuario autorizado abre CONFIGURACION → CENTRAL, **Entonces** el sistema muestra el formulario vacío con el botón *Crear central* y el aviso «La ingesta está bloqueada hasta configurar la central».
5. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir CONFIGURACION → CENTRAL, **Entonces** el sistema no muestra el formulario, responde «Acción no permitida para su rol», registra el intento con operador y fecha/hora y `central.json` no cambia.

**Restricciones del sistema (EARS)**

- **Mientras** `central.json` no exista o tenga algún campo vacío, el sistema deberá bloquear la ejecución de la ingesta y mostrar «Configure la central (CONFIGURACION → CENTRAL)». [RT-03, RN-04]
- **Cuando** se guarde `central.json`, el sistema deberá releer el archivo escrito y compararlo con lo enviado antes de confirmar en pantalla. [RNF-10, H-09]
- **El sistema deberá** registrar el operador y la fecha/hora de cada modificación de `central.json`. [RNF-09]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar la escritura de `central.json` sin modificar el archivo. [D-35, RNF-12]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-03 — Gestionar el padrón de técnicos

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actores secundarios:** Operador de la central (se identifica contra este padrón).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12), **salvo en el arranque en frío de D-62**: si `tecnicos.json` no existe o está vacío, la página ofrece crear el **primer supervisor** y es el único supuesto en que se crea un padrón sin sesión.
- **Postcondiciones:** `tecnicos.json` contiene el padrón vigente con nombre, cédula, P00, teléfono, correo, especialidad, **`rol`** (D-61) y status; el `P00` es único y obligatorio (D-29) y cada registro tiene `clave_hash` (**SHA-256 hexadecimal de 64 caracteres** de `clave_sal + ":" + contraseña` en UTF-8, D-63), `clave_sal` aleatoria y `clave_fecha_cambio`, sin contraseña en claro (D-39).

**Trazabilidad:** RF-12; RNF-04, **RNF-08**, RNF-10, **RNF-12, RNF-14**; RT-01; D-16, D-07 (referencia desde CU-05), **D-29, D-35, D-39, D-41, D-55, D-61, D-62, D-63**; H-01, H-N-20.

**Flujo principal**

0. **Arranque en frío (D-62).** Si `tecnicos.json` **no existe o está vacío**, la página **no abre ninguna sesión** (D-50) y muestra el paso **«Crear el primer supervisor»**: el supervisor inicial informa nombre, cédula, `P00` y una contraseña de 8 caracteres o más (por duplicado). El sistema crea el registro con **`rol = Supervisor`** y **`clave_cambio_obligatorio = SI`** (D-61, D-62), guarda `clave_hash` (SHA-256 hexadecimal de `clave_sal + ":" + contraseña` en UTF-8, D-63) con sal nueva, escribe `tecnicos.json`, lo relee y pasa al diálogo de identificación. Es el **único caso en que se crea un padrón sin sesión previa**; en cuanto el padrón tiene un supervisor, este paso **desaparece** y todo lo demás exige sesión de supervisor.
1. El supervisor entra en CONFIGURACION → **TECNICOS**.
2. El sistema lista los técnicos con las columnas: nombre, cédula, P00, teléfono, correo, especialidad, status, **rol** y **fecha del último cambio de contraseña**; nunca muestra la contraseña ni su hash. [D-39, **D-61**]
3. El supervisor pulsa *Nuevo técnico*, completa la ficha —incluido el **rol** (`Operador` o `Supervisor`, por defecto `Operador`, D-61)— y asigna una **contraseña inicial de 8 caracteres como mínimo**, que se confirma por duplicado.
4. El sistema valida que `nombre`, `cedula`, **`P00`** y `status` estén informados, que `cedula` no se repita, que **`P00` no se repita** (es único y obligatorio, D-29) y que la contraseña tenga al menos 8 caracteres.
5. El sistema guarda el `clave_hash` (**SHA-256 hexadecimal de 64 caracteres** de `clave_sal + ":" + contraseña` en UTF-8, con **sal nueva aleatoria** para ese técnico), el `clave_sal` y `clave_fecha_cambio` = fecha del día; **no** guarda la contraseña en claro y **marca el cambio obligatorio en el primer ingreso** escribiendo `clave_cambio_obligatorio = SI`. [RF-12, D-39, **D-63**]
6. El sistema agrega el registro a `tecnicos.json`, relee el archivo y muestra «Técnico agregado».
7. Para editar, el supervisor selecciona una fila, modifica los campos y guarda; el sistema aplica la misma validación y persiste. Si el supervisor escribe una contraseña nueva, el sistema regenera sal y hash y actualiza `clave_fecha_cambio`. [D-39]
8. **Restablecimiento de contraseña.** El supervisor pulsa *Restablecer contraseña* sobre un técnico, asigna una contraseña temporal de 8 caracteres o más y el sistema la guarda como hash con sal nueva y **marca el cambio obligatorio en el siguiente ingreso** con `clave_cambio_obligatorio = SI`. [RF-12, D-39]
9. Para dar de baja, el supervisor cambia `status` a inactivo; el técnico desaparece de las listas de selección de cuadrilla, pero permanece en el padrón para no romper el historial. [D-29, D-39]

**Flujos alternativos**

- **4a. Cédula duplicada.** El sistema muestra «La cédula 12345678 ya existe (técnico: Luis Pérez)» y no guarda.
- **4b. `nombre`, `cedula`, `P00` o `status` vacíos.** El sistema muestra el campo faltante y no guarda.
- **4c. `P00` duplicado.** El sistema muestra «El P00 12345 ya está asignado a Luis Pérez» y no guarda. [D-29, RNF-04]
- **4d. Contraseña de menos de 8 caracteres.** El sistema muestra «La contraseña debe tener al menos 8 caracteres y no se muestra en claro en ningún momento» y no guarda. [D-39]
- **4e. Confirmación de contraseña distinta.** El sistema muestra «Las contraseñas no coinciden» y no guarda. [D-39]
- **9a. El técnico pertenece a una cuadrilla activa.** El sistema advierte «El técnico integra las cuadrillas C1 y C3. Al inactivarlo quedan incompletas» y exige confirmación escrita antes de continuar.
- **2a. `tecnicos.json` ausente o inválido.** El sistema muestra «Padrón no disponible» y ofrece *Crear padrón vacío* o *Restaurar desde respaldo* (CU-21).
- **2b. Arranque en frío: `tecnicos.json` vacío (D-62).** El sistema **no** abre el padrón ni una sesión —nadie puede identificarse contra un padrón sin técnicos— y ofrece el paso **«Crear el primer supervisor»**: la ficha se valida igual (nombre, cédula, `P00` único, contraseña de 8+ caracteres por duplicado), el registro nace con **`rol = Supervisor`** y **`clave_cambio_obligatorio = SI`**, y al guardarlo el sistema pasa al diálogo de identificación. Es el **único caso de alta de padrón sin sesión previa**. **En cuanto existe un supervisor, este paso desaparece**: una segunda ejecución con el padrón ya poblado exige sesión de supervisor y, si la sesión es de operador, responde «Acción no permitida para su rol». [**D-62**, D-61, D-63, D-50, D-35, RNF-12]
- **4f. `rol` fuera del dominio.** Si el valor recibido no es `Operador` ni `Supervisor`, el sistema muestra «Rol inválido: use Operador o Supervisor» y no guarda; un registro **sin** `rol` se interpreta como `Operador` al iniciar sesión (nunca como supervisor). [**D-61**]
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra el padrón ni ejecuta la escritura, incluido el restablecimiento de contraseñas, y registra el intento. [D-35, RNF-12]
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.

**Criterios de aceptación (Gherkin)**

1. **Dado** el padrón con un técnico de cédula `12345678`, **Cuando** el supervisor intenta agregar otro con la misma cédula, **Entonces** el sistema muestra «La cédula 12345678 ya existe» y el total de técnicos en `tecnicos.json` no cambia.
2. **Dado** el formulario de alta con `nombre = Ana Gómez`, `cedula = 87654321`, `P00 = 4321`, `especialidad = Fibra`, `status = Activo` y contraseña inicial `Clave2026` confirmada, **Cuando** el supervisor pulsa *Guardar*, **Entonces** `tecnicos.json` contiene el registro con `clave_hash`, `clave_sal` y `clave_fecha_cambio = 14/09/2026`, la lista muestra 1 fila más y **ninguna** parte del archivo contiene la cadena `Clave2026`. [D-39]
2b. **Dado** que `tecnicos.json` se cargó con `fecha_modificacion = 13/09/2026 09:00` y en disco figura ahora `fecha_modificacion = 13/09/2026 09:40` con `usuario_modificacion = 12345`, **Cuando** el supervisor intenta guardar un alta, **Entonces** el sistema no escribe el padrón, muestra el conflicto con el usuario y la fecha/hora del último cambio y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
3. **Dado** el formulario de alta con la contraseña `Clave26`, **Cuando** el supervisor pulsa *Guardar*, **Entonces** el sistema muestra «La contraseña debe tener al menos 8 caracteres» y no crea el registro. [D-39]
4. **Dado** el padrón con el P00 `4321` ya asignado, **Cuando** el supervisor intenta guardar otro técnico con `P00 = 4321`, **Entonces** el sistema muestra «El P00 4321 ya está asignado» y el total de técnicos no cambia.
5. **Dado** el formulario de alta sin `P00`, **Cuando** el supervisor pulsa *Guardar*, **Entonces** el sistema muestra «Complete: P00» y no crea el registro. [D-29]
6. **Dado** un técnico con contraseña vigente, **Cuando** el supervisor pulsa *Restablecer contraseña* y asigna `Temporal2026`, **Entonces** `tecnicos.json` guarda un `clave_hash` distinto del anterior con sal nueva y ese técnico queda obligado a cambiar la contraseña en su siguiente ingreso. [D-39]
7. **Dado** un técnico con `status = Inactivo`, **Cuando** el supervisor abre el selector de técnicos de una cuadrilla, **Entonces** ese técnico no aparece en la lista.
8. **Dado** un técnico que integra 2 cuadrillas activas, **Cuando** el supervisor cambia su `status` a Inactivo, **Entonces** el sistema muestra el aviso con los identificadores de las 2 cuadrillas y exige confirmación antes de persistir.
9. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir CONFIGURACION → TECNICOS o restablecer una contraseña, **Entonces** el sistema responde «Acción no permitida para su rol» y `tecnicos.json` no cambia.
10. **Dado** `C:\GGTO\datos\tecnicos.json` con el contenido `[]` (padrón vacío) y la página recién abierta, **Cuando** se autoriza la carpeta de datos, **Entonces** el sistema **no** muestra el formulario de identificación sino el paso **«Crear el primer supervisor»**, y `averias.json` y los demás archivos del maestro **no se renderizan** en ningún caso (D-50). [**D-62**]
11. **Dado** el paso «Crear el primer supervisor» con `nombre = Supervisor Inicial`, `cedula = 00000001`, `P00 = 00001` y la contraseña `Primera2026` confirmada, **Cuando** se pulsa *Crear supervisor y continuar*, **Entonces** `tecnicos.json` contiene **un** registro con `rol = Supervisor`, `clave_cambio_obligatorio = SI`, `clave_sal` aleatoria y un `clave_hash` de **64 caracteres hexadecimales** que es el SHA-256 de `clave_sal + ":" + Primera2026` en UTF-8, el archivo no contiene la cadena `Primera2026` y la página pasa al diálogo de identificación. [**D-62**, **D-61**, **D-63**, D-39]
12. **Dado** un `tecnicos.json` que ya contiene ese supervisor, **Cuando** se recarga la página, **Entonces** el paso «Crear el primer supervisor» **no aparece** —el padrón ya no está vacío— y solo se ofrece el diálogo de identificación: para dar de alta otro técnico hace falta una sesión con `rol = Supervisor`. [**D-62**]
13. **Dado** el formulario de alta de un técnico con `rol = Operador` y otro con `rol = Supervisor`, **Cuando** el supervisor guarda ambos, **Entonces** `tecnicos.json` conserva el `rol` elegido en cada registro, y al iniciar sesión el de `rol = Operador` recibe «Acción no permitida para su rol» al intentar abrir CONFIGURACION mientras que el de `rol = Supervisor` sí la abre. [**D-61**, D-35, RNF-12]
14. **Dado** un registro de `tecnicos.json` **sin** el campo `rol` (padrón heredado), **Cuando** ese técnico inicia sesión, **Entonces** el sistema le asigna el rol `Operador` por defecto y **no** le habilita ningún padrón ni el despacho. [**D-61**, D-35, RNF-12]

**Restricciones del sistema (EARS)**

- **Si** la cédula ya existe en el padrón, entonces el sistema deberá rechazar el alta sin modificar el archivo. [RNF-04]
- **El sistema deberá** exigir que todo registro de `tecnicos.json` tenga un `P00` informado y único, y deberá rechazar el alta o la edición que lo duplique o lo deje vacío. [D-29, RNF-04]
- **El sistema deberá** almacenar la contraseña de cada técnico únicamente como hash **SHA-256 en hexadecimal (64 caracteres)** de la cadena `clave_sal + ":" + contraseña` codificada en **UTF-8**, con **sal aleatoria por técnico**, y `clave_fecha_cambio`; **no deberá** guardarla ni mostrarla en claro en la ficha, la lista, los mensajes ni los registros. [D-39, **D-63**]
- **El sistema deberá** exigir un mínimo de **8 caracteres** en toda contraseña de alta, cambio o restablecimiento, y deberá marcar el cambio obligatorio en el primer ingreso posterior a un alta o a un restablecimiento. [D-39]
- **El sistema deberá** exigir que todo registro declare el campo **`rol`** ∈ {`Operador`, `Supervisor`}, con `Operador` por defecto cuando el archivo no lo traiga, y **no deberá** deducir el rol del nombre, del `P00` ni del `status`. [**D-61**, D-35, RNF-12]
- **Si** `tecnicos.json` está vacío, entonces el sistema deberá ofrecer la creación del **primer supervisor** —único alta de padrón sin sesión previa—, con `rol = Supervisor` y `clave_cambio_obligatorio = SI`, y deberá retirar ese paso en cuanto exista al menos un supervisor. [**D-62**, D-50, D-35]
- **Cuando** se modifique un técnico, el sistema deberá persistir el cambio y registrar operador y fecha/hora. [RNF-09]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar la escritura de `tecnicos.json`, incluido el restablecimiento de contraseñas, sin modificar el archivo. [D-35, RNF-12]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-04 — Gestionar el padrón de flota

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actores secundarios:** Operador de la central (consume la flota al armar cuadrillas).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12).
- **Postcondiciones:** `flota.json` contiene los vehículos vigentes con CAN00, tipo, marca, modelo, placa, combustible, status, estado de cauchos, estado de fluidos y estado general.

**Trazabilidad:** RF-13; RNF-04, RNF-10, **RNF-12, RNF-14**; RT-01; D-07, **D-35, D-41**.

**Flujo principal**

1. El supervisor entra en CONFIGURACION → **FLOTA**.
2. El sistema lista los vehículos con las 10 columnas del padrón.
3. El supervisor pulsa *Nuevo vehículo*, informa CAN00, placa y status (obligatorios) y los 7 campos restantes.
4. El sistema valida que `CAN00` y `placa` no se repitan y que `status` pertenezca a {Operativo, En mantenimiento, Fuera de servicio}.
5. El sistema agrega el registro a `flota.json`, relee el archivo y muestra «Vehículo agregado».
6. El supervisor edita o cambia el `status` del vehículo cuando cambia su condición; el sistema persiste el cambio y registra operador y fecha/hora.

**Flujos alternativos**

- **4a. CAN00 o placa duplicados.** El sistema muestra «El CAN00 1234 ya está registrado (placa AB123CD)» y no guarda.
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.
- **4b. `status` fuera del enum.** El sistema muestra «Status inválido: use Operativo, En mantenimiento o Fuera de servicio» y no guarda.
- **6a. El vehículo está asignado a una cuadrilla activa.** El sistema advierte «El CAN00 1234 está asignado a la cuadrilla C2» y exige confirmación antes de ponerlo fuera de servicio.
- **2a. `flota.json` ausente o inválido.** El sistema muestra «Padrón no disponible» y ofrece *Crear padrón vacío* o *Restaurar desde respaldo* (CU-21).
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra el padrón ni ejecuta la escritura, y registra el intento. [D-35, RNF-12]

**Criterios de aceptación (Gherkin)**

1. **Dado** el padrón con el CAN00 `1234`, **Cuando** el supervisor agrega otro vehículo con el mismo CAN00, **Entonces** el sistema muestra el aviso de duplicado y el total de vehículos en `flota.json` no cambia.
2. **Dado** el formulario con `CAN00 = 5678`, `placa = XY987ZT`, `status = Operativo`, `estado_cauchos = Bueno`, `estado_fluidos = OK` y `estado_general = Bueno`, **Cuando** el supervisor pulsa *Guardar*, **Entonces** `flota.json` contiene el vehículo y la lista muestra 1 fila más.
2b. **Dado** que `flota.json` se cargó con `fecha_modificacion = 13/09/2026 09:00` y en disco figura ahora `fecha_modificacion = 13/09/2026 09:45` con `usuario_modificacion = 12345`, **Cuando** el supervisor intenta guardar un vehículo, **Entonces** el sistema no escribe el padrón, muestra el conflicto con usuario y fecha/hora y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
3. **Dado** un vehículo con `status = Fuera de servicio`, **Cuando** el supervisor abre el selector de vehículo de una cuadrilla, **Entonces** ese vehículo no aparece en la lista.
4. **Dado** un vehículo asignado a la cuadrilla `C2`, **Cuando** el supervisor lo marca «Fuera de servicio», **Entonces** el sistema muestra «El CAN00 1234 está asignado a la cuadrilla C2» y pide confirmación.
5. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir CONFIGURACION → FLOTA, **Entonces** el sistema responde «Acción no permitida para su rol» y `flota.json` no cambia.

**Restricciones del sistema (EARS)**

- **Si** `CAN00` o `placa` ya existen, entonces el sistema deberá rechazar el alta sin modificar el archivo. [RNF-04]
- **Cuando** se modifique un vehículo, el sistema deberá persistir el cambio y registrar operador y fecha/hora. [RNF-09]
- **El sistema deberá** conservar la grafía corregida `combustible` en el archivo y en la interfaz. [RNF-07, A-06]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar la escritura de `flota.json` sin modificar el archivo. [D-35, RNF-12]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-05 — Gestionar el padrón de cuadrillas

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actores secundarios:** Operador de la central (consume el `id` de su cuadrilla para saber qué casos puede cerrar).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12); existen técnicos (CU-03), vehículos (CU-04) y sectores (CU-06) si se van a referenciar.
- **Postcondiciones:** `cuadrillas.json` contiene las cuadrillas con `id, nombre, tecnicos[], vehiculo, turno, sectores[], status`; el `id` es el valor que toma `averias."Reparador Principal"` y `despacho.json."Reparador Principal"` (D-37).

**Trazabilidad:** RF-14; RNF-04, RNF-10, **RNF-12, RNF-14**; RT-01, **RT-05**; RN-05, RN-06; D-07, **D-31, D-35, D-37, D-41**; H-04.

**Flujo principal**

1. El supervisor entra en CONFIGURACION → **CUADRILLA**.
2. El sistema lista las cuadrillas con id, nombre, técnicos, vehículo, turno, sectores y status.
3. El supervisor pulsa *Nueva cuadrilla* e informa: `id` (por ejemplo `C1`), `nombre` (por ejemplo `Cuadrilla 1`), uno o más técnicos activos, un vehículo operativo, turno y los sectores preferentes.
4. El sistema valida: `id` y `nombre` no vacíos; `id` no repetido; al menos 1 técnico activo; el vehículo existe en `flota.json`; cada sector existe en `sectores.json`.
5. El sistema agrega la cuadrilla a `cuadrillas.json`, relee el archivo y muestra «Cuadrilla agregada».
6. El supervisor edita técnicos, vehículo, turno, sectores o status y guarda; el sistema aplica las mismas validaciones y persiste.
7. El supervisor inactiva una cuadrilla que deja de operar; el sistema la excluye de las listas de asignación del despacho y de los filtros de CASOS, y deja en modo consulta a los técnicos que la integraban (D-35, D-37).

**Flujos alternativos**

- **4a. `id` repetido.** El sistema muestra «La cuadrilla C1 ya existe» y no guarda.
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.
- **4b. Técnico inactivo o vehículo no operativo.** El sistema muestra «El técnico Ana Gómez está inactivo» o «El CAN00 1234 está fuera de servicio» y no guarda.
- **4c. Sector inexistente.** El sistema muestra «El sector 7 no existe en `sectores.json`» y ofrece abrir el CRUD de sectores (CU-06).
- **7a. La cuadrilla tiene casos con `Reparador Principal` = su id.** El sistema advierte «La cuadrilla C1 tiene 12 casos asignados y 3 abiertos» y exige confirmación antes de inactivarla.
- **6a. Alta o edición de la cuadrilla y registro del despacho (D-31, D-37).** El sistema guarda la asignación en `averias."Reparador Principal"` **y**, cuando el despacho del día se confirma, escribe el registro del día en `despacho.json`, que **se amplía con `sector`, `Reparador Principal` y `fecha_despacho`** (RT-05). El agrupamiento del despacho **no** se calcula solo en memoria: queda persistido en `despacho.json` como registro del despacho del día. [D-31, D-37]
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra el padrón ni ejecuta la escritura, y registra el intento. [D-35, RNF-12]

**Criterios de aceptación (Gherkin)**

1. **Dado** el padrón con la cuadrilla `C1`, **Cuando** el supervisor intenta crear otra con `id = C1`, **Entonces** el sistema muestra «La cuadrilla C1 ya existe» y el total de cuadrillas no cambia.
2. **Dado** el formulario con `id = C2`, `nombre = Cuadrilla 2`, 2 técnicos activos, vehículo `5678`, `turno = Diurno` y sectores `1` y `4`, **Cuando** el supervisor pulsa *Guardar*, **Entonces** `cuadrillas.json` contiene la cuadrilla con los 2 técnicos y los 2 sectores.
2b. **Dado** que `cuadrillas.json` se cargó con `fecha_modificacion = 13/09/2026 09:00` y en disco figura ahora `fecha_modificacion = 13/09/2026 09:50` con `usuario_modificacion = 12345`, **Cuando** el supervisor intenta guardar un cambio de cuadrilla, **Entonces** el sistema no escribe el padrón, muestra el conflicto con usuario y fecha/hora y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
3. **Dado** una cuadrilla sin ningún técnico activo, **Cuando** el supervisor pulsa *Guardar*, **Entonces** el sistema muestra «Seleccione al menos un técnico activo» y no guarda.
4. **Dado** una cuadrilla con `status = Inactiva`, **Cuando** el supervisor genera el despacho (CU-16), **Entonces** esa cuadrilla no aparece como destino de asignación.
5. **Dado** una cuadrilla inactiva con 3 casos abiertos cuyo `Reparador Principal` es su id, **Cuando** el supervisor confirma la inactivación, **Entonces** los 3 casos conservan su `Reparador Principal` y aparecen filtrables por esa cuadrilla en CU-10.
6. **Dado** un despacho del día confirmado con 45 casos en 3 cuadrillas, **Cuando** el supervisor consulta `despacho.json`, **Entonces** el archivo contiene los 45 registros con `sector`, `Reparador Principal` y `fecha_despacho` informados. [D-31, RT-05]
7. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir CONFIGURACION → CUADRILLA, **Entonces** el sistema responde «Acción no permitida para su rol» y `cuadrillas.json` no cambia.

**Restricciones del sistema (EARS)**

- **Si** el `id` de la cuadrilla ya existe, entonces el sistema deberá rechazar el alta y conservar el archivo sin cambios. [RNF-04]
- **Mientras** una cuadrilla esté inactiva, el sistema deberá excluirla de la asignación del despacho sin reescribir los casos ya asignados. [D-07]
- **El sistema deberá** guardar `Reparador Principal` con el `id` de la cuadrilla, tanto en `averias.json` como en el registro del día de `despacho.json`. [D-07, D-37]
- **El sistema deberá** escribir en `despacho.json` las columnas `sector`, `Reparador Principal` y `fecha_despacho` además de las columnas del fuente, para que el archivo sirva de registro del despacho del día. [D-31, RT-05]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar la escritura de `cuadrillas.json` sin modificar el archivo. [D-35, RNF-12]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-06 — Gestionar el catálogo de sectores

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actores secundarios:** Operador de la central (asigna sectores en CU-09 y crea el sector mínimo desde la cola); cuadrillas (los usan en el despacho, CU-16).
- **Ciclo:** C1. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** para el CRUD completo (D-35, RNF-12).
- **Postcondiciones:** `sectores.json` contiene el catálogo vigente con `id, nombre, vias[], cuadrilla_sugerida`; toda avería puede referenciar un sector existente (RN-04).

**Trazabilidad:** RF-29, RF-18; RN-04; RNF-04, RNF-10, **RNF-12, RNF-14**; RT-01; D-03, D-25, **D-35, D-41**; H-14, H-18.

**Flujo principal**

1. El supervisor entra en CONFIGURACION → **SECTORES**.
2. El sistema lista los sectores con id, nombre, número de vías y cuadrilla sugerida.
3. El supervisor pulsa *Nuevo sector*, informa `id` (por ejemplo `1`), `nombre` (por ejemplo `Prados del Este`), la lista de calles y urbanizaciones (`vias`) y, opcionalmente, la `cuadrilla_sugerida`.
4. El sistema valida que `id` y `nombre` no estén vacíos, que `id` no se repita y que la cuadrilla sugerida exista en `cuadrillas.json`.
5. El sistema agrega el sector a `sectores.json`, relee el archivo y muestra «Sector agregado».
6. El supervisor edita el nombre o la lista de vías y guarda; el sistema persiste y muestra cuántas averías abiertas usan ese sector.
7. El supervisor elimina un sector; el sistema bloquea la baja si existen averías con ese `sector` y ofrece reasignarlas primero (CU-09 o CU-10).

**Flujos alternativos**

- **4a. `id` repetido.** El sistema muestra «El sector 1 ya existe (Prados del Este)» y no guarda.
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.
- **7a. El sector tiene averías asociadas.** El sistema muestra «El sector 1 tiene 27 averías (4 abiertas). Reasígnelas antes de eliminarlo» y no elimina.
- **7b. Confirmación de eliminar un sector sin averías.** El sistema elimina el registro y muestra «Sector eliminado»; el total de sectores baja en 1.
- **4b. Cuadrilla sugerida inexistente.** El sistema muestra «La cuadrilla C9 no existe» y no guarda.
- **2a. `sectores.json` ausente.** El sistema muestra la lista vacía con el aviso «Sin sectores no puede completarse la ingesta (RN-04)» y el botón *Nuevo sector*.
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema **no** permite el CRUD de sectores (alta libre, edición o baja) y responde «Acción no permitida para su rol»: el operador solo crea el sector mínimo desde la cola de CU-09. [D-35, RNF-12]

**Criterios de aceptación (Gherkin)**

1. **Dado** el catálogo con el sector `1` (Prados del Este), **Cuando** el supervisor intenta crear otro con `id = 1`, **Entonces** el sistema muestra el aviso de duplicado y el total de sectores no cambia.
2. **Dado** el formulario con `id = 4`, `nombre = La Trinidad`, `vias = [Av. Intercomunal, Calle 5]`, **Cuando** el supervisor pulsa *Guardar*, **Entonces** `sectores.json` contiene el sector con 2 vías.
2b. **Dado** que `sectores.json` se cargó con `fecha_modificacion = 13/09/2026 09:00` y en disco figura ahora `fecha_modificacion = 13/09/2026 09:55` con `usuario_modificacion = 12345`, **Cuando** el supervisor intenta guardar un sector, **Entonces** el sistema no escribe el catálogo, muestra el conflicto con usuario y fecha/hora y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
3. **Dado** un sector con 4 averías abiertas asociadas, **Cuando** el supervisor pulsa *Eliminar*, **Entonces** el sistema muestra «El sector tiene 4 averías abiertas», no elimina el registro y ofrece abrir CU-09.
4. **Dado** un sector sin averías asociadas, **Cuando** el supervisor confirma la eliminación, **Entonces** el sector desaparece de `sectores.json` y del selector de sectores de CASOS.
5. **Dado** un catálogo con 6 sectores declarados, **Cuando** se ingiere un CSV con direcciones que coinciden con 5 de ellos, **Entonces** el sistema asigna 5 sectores automáticamente y envía las direcciones restantes a la cola de CU-09.
6. **Dado** una sesión con rol operador, **Cuando** el operador intenta eliminar o editar un sector desde CONFIGURACION → SECTORES, **Entonces** el sistema responde «Acción no permitida para su rol», no modifica `sectores.json` y registra el intento.

**Restricciones del sistema (EARS)**

- **Si** el `id` del sector ya existe, entonces el sistema deberá rechazar el alta sin modificar el catálogo. [RNF-04]
- **Si** un sector tiene averías asociadas, entonces el sistema deberá impedir su eliminación hasta que se reasignen. [RNF-10, RN-04]
- **El sistema deberá** comparar direcciones contra las vías del sector ignorando mayúsculas, tildes y abreviaturas `Av.`, `Cll.`, `Urb.`. [D-03]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar el alta libre, la edición y la baja de sectores, admitiendo únicamente la **propuesta** de sector para una dirección en cola (CU-09), que queda pendiente de la aprobación del supervisor. [D-35, D-60, RNF-12]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-07 — Gestionar las palabras clave de clasificación

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actor secundario:** Operador de la central (ejecuta la ingesta, CU-08, y consume la lista vigente).
- **Ciclo:** C2. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12); `averias.json` accesible para calcular la vista previa del impacto.
- **Postcondiciones:** `claves_clasificacion.json` contiene la lista de claves vigente, el modo de normalización (`normalizada` por defecto o `estricta`) y los campos evaluados, con el impacto del cambio aceptado por el supervisor.

**Trazabilidad:** RF-27, RF-17; RN-03; RNF-09, RNF-10, **RNF-12, RNF-14**; RT-07; D-05, D-11, D-26, **D-35, D-41, D-43**; H-08.

**Flujo principal**

1. El supervisor entra en CONFIGURACION → **PALABRAS CLAVE**.
2. El sistema muestra las claves vigentes (`LOSS ROJO`, `FALLA FIBRA`, `FIBRA DAÑADA` en la primera ejecución), el modo de búsqueda (`normalizada` por defecto) y los 4 campos evaluados (`ultimo_comentario`, `problema_reporte`, `informacion_1`, `informacion_2`).
3. El supervisor agrega, modifica o quita una clave y/o cambia el modo entre `estricta` y `normalizada`.
4. El supervisor pulsa *Vista previa del impacto*.
5. El sistema recorre `averias.json`, cuenta los casos cuyo `status` cambiaría entre PEND y GESTION con el nuevo conjunto y modo, y muestra el resumen: total evaluado, casos que pasarían a PEND y casos que pasarían a GESTION, con la lista de `id_averia` afectados.
6. El supervisor confirma el cambio.
7. El sistema escribe `claves_clasificacion.json`, relee el archivo y muestra «Claves guardadas» junto con el número de claves activas.

**Flujos alternativos**

- **3a. Clave vacía o duplicada.** El sistema muestra «La clave ya existe: FALLA FIBRA» o «La clave no puede estar vacía» y no permite continuar.
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.
- **4a. Sin vista previa aceptada.** Si el supervisor pulsa *Guardar* sin ejecutar la vista previa, el sistema la ejecuta automáticamente y exige confirmación antes de persistir. [D-26]
- **5a. `averias.json` ausente o inválido.** El sistema muestra «No se puede calcular el impacto: maestro no disponible», permite guardar la lista y advierte que los casos existentes no se reclasifican retroactivamente. [H-20]
- **7a. Fallo de escritura.** El sistema conserva la lista anterior y muestra «No se pudo guardar `claves_clasificacion.json`». [CU-21]
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema muestra la lista en solo lectura (o no la muestra) y rechaza cualquier escritura de las claves, registrando el intento. [D-35, RNF-12]

**Criterios de aceptación (Gherkin)**

1. **Dado** el archivo con las 3 claves por defecto y modo `normalizada`, **Cuando** el supervisor abre la pantalla, **Entonces** la lista muestra `LOSS ROJO`, `FALLA FIBRA` y `FIBRA DAÑADA` y el modo seleccionado es `normalizada`.
2. **Dado** un maestro de 1.000 casos, **Cuando** el supervisor agrega la clave `FIBRA DAÑADA` y pulsa *Vista previa del impacto*, **Entonces** el sistema muestra el total evaluado, cuántos casos pasarían a PEND y cuántos a GESTION y la lista de sus `id_averia`, sin modificar todavía `claves_clasificacion.json`.
3. **Dado** que la vista previa indica que 17 casos pasan a PEND, **Cuando** el supervisor confirma, **Entonces** `claves_clasificacion.json` contiene la nueva clave y la relectura del archivo devuelve el mismo contenido.
3b. **Dado** que `claves_clasificacion.json` se cargó con `fecha_modificacion = 13/09/2026 09:00` y en disco figura ahora `fecha_modificacion = 13/09/2026 10:00` con `usuario_modificacion = 12345`, **Cuando** el supervisor confirma el cambio de claves, **Entonces** el sistema no escribe, muestra el conflicto con usuario y fecha/hora y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
4. **Dado** el texto `Fibra Danada` en `ultimo_comentario` y el modo `normalizada` con la clave `FIBRA DAÑADA`, **Cuando** se clasifica el caso, **Entonces** el sistema lo trata como coincidencia y el caso queda en `status = PEND`.
5. **Dado** el texto `Loss Rojo` en `problema_reporte` y el modo `estricta` con la clave `LOSS ROJO`, **Cuando** se clasifica el caso, **Entonces** el sistema **no** lo considera coincidencia —el modo `estricta` compara por **subcadena literal, sensible a mayúsculas y tildes** (D-43)—, el caso queda en `status = GESTION` y no se aplica ninguna variante (ni `LOSS`/`LOS` ni `DAÑADA`/`DANADA`). Con el modo `normalizada` (el de por defecto) el mismo texto sí coincide y el caso entra en `PEND`. Criterio P3 **cerrado por D-43**. [D-26, D-43]
6. **Dado** que el supervisor intenta guardar la clave `FALLA FIBRA` cuando ya existe, **Cuando** pulsa *Agregar*, **Entonces** el sistema muestra «La clave ya existe» y el archivo no cambia.
7. **Dado** una sesión con rol operador, **Cuando** el operador intenta guardar un cambio en las claves o en el modo de búsqueda, **Entonces** el sistema responde «Acción no permitida para su rol» y `claves_clasificacion.json` no cambia.

**Restricciones del sistema (EARS)**

- **Cuando** el supervisor cambie la lista de claves o el modo de búsqueda, el sistema deberá mostrar la vista previa de los casos afectados antes de persistir. [D-26, H-08]
- **El sistema deberá** evaluar las claves por subcadena sobre el texto normalizado (mayúsculas, sin tildes, espacios colapsados) en `ultimo_comentario`, `problema_reporte`, `informacion_1` e `informacion_2` **cuando el modo sea `normalizada`** (modo por defecto). [RN-03, D-26]
- **Mientras** el modo de búsqueda sea `estricta`, el sistema deberá comparar la clave como **subcadena literal del texto original**, sensible a mayúsculas y tildes y **sin variantes** (`LOSS ROJO` no coincide con `Loss Rojo`, `FIBRA DAÑADA` no coincide con `Fibra Danada`). [D-43]
- **Si** el maestro no está disponible, entonces el sistema deberá permitir guardar la lista y advertir que no se reclasifican los casos existentes. [RNF-10]
- **El sistema deberá** registrar el operador y la fecha/hora de cada cambio de claves o de modo. [RNF-09]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar la escritura de `claves_clasificacion.json` sin modificar el archivo. [D-35, RNF-12]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-08 — Ingestar el CSV diario

- **Actor principal:** Operador de la central (el supervisor puede ejecutarla, D-35).
- **Actores secundarios:** Emisor del CSV (origen del archivo; es su **único** caso de uso, D-59); supervisor (CU-07 define las claves).
- **Ciclo:** C2. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con credencial válida y vigente (D-39)**; **rol autorizado por la matriz de §2.1: el operador puede ingerir y el supervisor también** (D-35, RNF-12); `central.json` completo (CU-02); `estructura.json` posicional vigente; `sectores.json` y `claves_clasificacion.json` disponibles; el archivo `detalle_averias_gpon DD_MM_AAAA.csv` (separador `;`, UTF-8, 80 columnas) está en disco **y tiene al menos 1 registro de datos**.
- **Postcondiciones:** `averias.json` contiene los casos nuevos de Francisco Salias con `ingreso`, `clase = REP`, `nivel = COM`, `tipo_abonado`, `sector` (o en cola) y `status` según RN-03 **con `ASGN` del CSV convertido a PEND (D-38)**; cada caso nuevo **añade a `historial.jsonl`** su línea de ingesta (`id_averia`, `campo = status`, `valor_anterior` vacío, `valor_nuevo` = estado asignado, `accion = ingesta`, operador de la sesión y fecha/hora, D-56); el rastro de origen se limita a la col. 20 del CSV (`ultimo_usuario`), que **inicializa `usuario_modificacion`**, y a `fecha_modificacion` con la **fecha de ingesta** (D-52, D-53): las columnas **53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) no se persisten** y la **col. 18 (`fecha_compromiso`) tampoco** (D-54); los casos ya existentes no se duplican. **Visibilidad del resultado:** los casos recién ingeridos quedan visibles para la sesión que los ingirió; si esa sesión es de operador, los casos que no tengan `Reparador Principal` propio se muestran en solo lectura hasta que el despacho (CU-16) o el alta manual (CU-14) los asigne a su cuadrilla (H-N-05).

**Trazabilidad:** RF-16, RF-17, RF-18, RF-19; RN-01, RN-02, RN-03, RN-04; RNF-02, RNF-04, RNF-06, RNF-08, RNF-09, RNF-10, **RNF-12, RNF-14, RNF-15**; RT-02, RT-03, RT-04, RT-07, RT-08; D-05, D-06, D-10, D-12, D-17, D-21, D-26, **D-35, D-38, D-41, D-42, D-44, D-46, D-52, D-53, D-54, D-56, D-59**; H-03, H-08, H-09, H-14, H-15, H-24, H-27.

**Flujo principal**

0. **Validación previa bloqueante (antes de cualquier escritura).** El sistema lee el archivo completo y comprueba, en este orden: (a) que la cabecera tenga **80 columnas** y que su orden posicional coincida con `estructura.json`; (b) que la primera fila se parta en 80 campos con `;`; (c) que exista **al menos 1 registro de datos** (un archivo de solo encabezado aborta); (d) que la suma del resumen cuadre (leídos = descartados por central + descartados por duplicado + rechazados + nuevos). Si cualquiera falla, la ingesta **aborta sin escribir el maestro y sin disparar el respaldo**. [D-21, H-14]

   **Umbral de la ingesta (D-44, sin umbral porcentual).** El contrato se valida de forma **binaria**: (e) el archivo debe tener **exactamente 80 columnas**; y (f) cada columna declarada en `estructura.json` debe coincidir **en su posición** con la cabecera leída (misma columna, mismo índice). Si falla (e) o (f), la ingesta **aborta sin escribir**; **no existe** ningún umbral porcentual de coincidencia que permita continuar con columnas corridas o faltantes. [D-12, D-21, D-44]
1. El operador abre la pestaña que contiene el bloque **INGESTA**, pulsa *Cargar CSV diario* y elige el archivo `detalle_averias_gpon DD_MM_AAAA.csv`.
2. El sistema confirma el contrato de la validación previa (80 columnas, orden posicional, separador `;`, codificación UTF-8, al menos 1 registro) y avisa si algún campo obligatorio no es legible.
3. El sistema aplica el filtro de central de `central.json` sobre las columnas 1 a 10 y descarta los registros de otras centrales (en la muestra del 12/09/2026: descarta 5 —4 de LAS MERCEDES CPA y 1 de EL HATILLO— y conserva los **51** de FRANCISCO SALIAS).
4. El sistema extrae las columnas declaradas en `estructura.json` según su posición, incluidas `informacion` (col. 31) → `informacion_1`, `informacion` (col. 32) → `informacion_2`, `estatus` (col. 27), `unidad_negocio` (col. 61) y `ups` (col. 62), y **conserva como rastro de origen del dato** únicamente la columna 20 (`ultimo_usuario`), que **inicializa `usuario_modificacion`**, junto con `fecha_modificacion` = fecha de ingesta (D-52, D-53); las columnas **53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) se descartan y no se persisten** (D-53), y la **col. 18 (`fecha_compromiso`) tampoco se persiste** (D-54: los «citados» se determinan por `fecha_cita`, D-30).
5. **Validación de la clave primaria (bloqueante por fila).** El sistema rechaza y cuenta como **rechazada** toda fila cuyo `id_averia` (col. 11) esté vacío o solo tenga espacios, y toda fila cuyo `id_averia` empiece por `MAN-` (prefijo reservado al alta manual, CU-14). Además comprueba la **unicidad dentro del propio lote**: si el mismo `id_averia` aparece 2 o más veces, inserta solo la **primera** aparición y reporta las demás como **duplicadas del lote** con su número de fila. Después descarta los casos cuyo `id_averia` ya existe en `averias.json` y calcula el resumen: registros leídos, descartados por central, rechazados, duplicados del lote, duplicados del maestro y nuevos a insertar. [RN-01, RNF-04, H-09]
6. El sistema clasifica cada caso nuevo: si el `estatus` del CSV es `ASGN`, el caso entra con **`status = PEND`** (D-38, que deja sin efecto el cuarto estado de D-13); si no, busca las claves de `claves_clasificacion.json` por subcadena sobre el texto normalizado en `ultimo_comentario`, `problema_reporte`, `informacion_1` e `informacion_2`: con coincidencia entra `status = PEND`; sin coincidencia entra `status = GESTION`.
7. El sistema completa `sector` emparejando `direccion` contra las vías de `sectores.json`; las direcciones sin coincidencia quedan en la cola de CU-09 sin frenar la inserción del resto.
8. El sistema completa `tipo_abonado` = `EMP` cuando `unidad_negocio` = `CANTV EMPRESAS` o `ups` = `NRES`; en el resto de los casos `RES`.
9. El sistema recorta `fecha_reporte` (col. 15) a `DD/MM/AAAA` y conserva el texto completo con hora en `fecha_reporte_original`.
10. El sistema asigna a cada caso nuevo `ingreso` = fecha de la ingesta, `clase = REP` y `nivel = COM`.
11. El sistema presenta el resumen final por estado (**PEND y GESTION**), por `tipo_abonado`, el informe de incidencias (rechazadas por `id_averia` vacío, por prefijo `MAN-`, duplicadas del lote y fechas inesperadas) y la lista de direcciones sin sector, y solicita *Confirmar ingesta*.
12. El operador confirma; el sistema escribe `averias.json` (respaldo previo según CU-21), relee el archivo, verifica que el conteo aumentó exactamente en el número de casos nuevos y muestra «Ingesta completada: N casos nuevos, M descartados por duplicado, K direcciones sin sector».

**Flujos alternativos**

- **2a. El archivo no tiene 80 columnas o el orden no coincide con `estructura.json`.** El sistema aborta la ingesta sin escribir nada, muestra «Contrato de ingesta inválido: se esperaban 80 columnas y se encontraron X; columna 31 esperada `informacion` y encontrada `Y`» y ofrece descargar el detalle de la cabecera leída. **El umbral es binario y sin margen porcentual**: basta una columna de menos o una columna declarada fuera de su posición para abortar. [D-12, D-21, D-44, H-24]
- **2b. Codificación o separador distintos.** El sistema detecta que la primera fila no se puede partir en 80 campos con `;`, aborta y muestra «Verifique que el archivo use `;` y codificación UTF-8». [RT-08]
- **2d. Archivo de solo encabezado o cuerpo malformado.** Si el archivo tiene la cabecera de 80 columnas pero **0 registros de datos**, o si la suma del resumen no cuadra, el sistema **aborta sin escribir el maestro, sin disparar el respaldo y sin confirmar «Ingesta completada»**, y muestra «El archivo no contiene registros de datos: no se modificó el maestro». [H-14]
- **5a. Todos los registros son duplicados.** El sistema muestra «0 casos nuevos: los 51 registros de Francisco Salias ya existen» y no escribe el maestro. [RN-01, RNF-04]
- **5b. `id_averia` vacío o solo espacios.** El sistema rechaza la fila, **no la inserta**, la cuenta como rechazada y la reporta en el informe de incidencias con su número de fila; el resto de la ingesta continúa. [RN-01, RNF-04, H-09]
- **5c. Duplicado dentro del mismo lote.** Si el mismo `id_averia` aparece 2 o más veces en el lote, el sistema inserta **solo la primera** aparición y reporta las demás como duplicadas con su número de fila: «id_averia 2026-00123 duplicado en el lote: filas 12 y 47; se conservó la fila 12». [RNF-04, H-09]
- **5d. `id_averia` con prefijo `MAN-`.** El sistema rechaza la fila por reserva de prefijo (el `MAN-` pertenece al alta manual, D-18), la cuenta como rechazada y la reporta. [D-18, H-09]
- **6a. La lista de claves está vacía.** El sistema avisa «No hay palabras clave configuradas: todos los casos entrarían en GESTION» y exige confirmación explícita antes de continuar. [RN-03, RF-27]
- **9a. Fecha con formato inesperado.** El sistema conserva el texto original íntegro en `fecha_reporte_original`, deja `fecha_reporte` vacía, cuenta el caso en el informe de incidencias y continúa con los demás. [D-21]
- **12a. Fallo de escritura sobre `C:\GGTO\datos\averias.json`.** El sistema **no confirma la ingesta**, conserva el resumen en pantalla, muestra «No se pudo escribir el maestro: &lt;detalle&gt;» y ofrece *Reintentar* y *Guardar copia en `datos_respaldo`*; el maestro conserva exactamente su contenido anterior. [CU-21, H-09]
- **12b. Reingesta del mismo archivo.** El sistema descarta el 100 % de los registros por duplicado y deja el maestro idéntico: mismo número de registros y mismos `id_averia`. [RNF-04, H-27]
- **2c. El archivo del día no llega (CSV ausente, D-46).** El operador no encuentra `detalle_averias_gpon DD_MM_AAAA.csv`: la página marca el día como **«sin ingesta»**, muestra la fecha del último archivo ingerido y deja el maestro del día anterior **intacto** (no altera `ingreso` ni inserta casos). El operador o el supervisor **registran la novedad** con **fecha, motivo y operador** en `datos/incidencias.log`, y la página **no bloquea** la consulta de casos ni la generación del despacho. El escalamiento con el emisor del CSV queda como punto abierto de §5.4. [D-46, H-15, H-24]
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.
- **12c. Escritura verificada con respaldo previo (D-42, RNF-15).** Antes de escribir, el sistema copia el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribe el contenido nuevo en un **archivo temporal**, lo **relee** y **compara** con lo que quiso escribir (mismo número de registros e igualdad del texto serializado); solo entonces la pantalla muestra «Ingesta completada». Si la copia previa falla, la escritura falla o la relectura no coincide, el sistema **restaura el respaldo**, muestra «No se pudo verificar la escritura: se restauró el maestro del DD/MM/AAAA HH:MM», **no** confirma la ingesta y conserva el resumen en pantalla. [D-42, RNF-15]

**Criterios de aceptación (Gherkin)**

1. **Dado** el archivo `detalle_averias_gpon 12_09_2026.csv` con 80 columnas y 56 registros (51 de FRANCISCO SALIAS, 4 de LAS MERCEDES CPA y 1 de EL HATILLO), y un `averias.json` con 0 casos, **Cuando** el operador confirma la ingesta, **Entonces** el sistema inserta **51 casos** (los de `nombre central = FRANCISCO SALIAS`) y descarta 5 por central distinta.
2. **Dado** el mismo archivo, **Cuando** el operador ejecuta la ingesta una segunda vez, **Entonces** el sistema informa «0 casos nuevos, 51 duplicados» y `averias.json` conserva exactamente los mismos 51 `id_averia`.
3. **Dado** el archivo del 12/09/2026 con los **51 registros de FRANCISCO SALIAS** (11 con palabras clave y `estatus = PEND`, 3 con `estatus = ASGN` —2 con claves y 1 sin ellas— y 37 sin palabras clave y con `estatus = PEND`), **Cuando** el sistema aplica la clasificación, **Entonces** quedan **14 casos en `status = PEND`** (11 con claves + los 3 `ASGN`, que entran como PEND por D-38) **y 37 casos en `status = GESTION`**, de modo que **14 + 37 = 51**. *Nota: los recuentos anteriores «17 PEND y 39 GESTION» eran incorrectos porque se calcularon sobre los **56 registros de las 3 centrales**, no sobre los 51 filtrados de Francisco Salias (H-01).*
4. **Dado** un registro con `estatus = ASGN` en la columna 27, **Cuando** se ingiere, **Entonces** el caso queda en **`status = PEND`** (D-38) y **no** en un estado `ASGN`; el maestro no incorpora ningún cuarto estado.
5. **Dado** un archivo con 79 columnas, **Cuando** el operador confirma la ingesta, **Entonces** el sistema muestra «Contrato de ingesta inválido: se esperaban 80 columnas y se encontraron 79» y `averias.json` no se modifica.
5b. **Dado** un archivo con las **80 columnas** en la cabecera pero con la columna declarada como `direccion` en `estructura.json` desplazada a otra posición, **Cuando** el operador confirma la ingesta, **Entonces** el sistema muestra «Contrato de ingesta inválido: la columna 34 declarada `direccion` no coincide en su posición» y `averias.json` no se modifica: **no** existe umbral porcentual que permita continuar. [D-44]
6. **Dado** un archivo con la cabecera de 80 columnas y **0 registros de datos**, **Cuando** el operador confirma la ingesta, **Entonces** el sistema muestra «El archivo no contiene registros de datos: no se modificó el maestro», **no** escribe `averias.json`, **no** dispara el respaldo y **no** muestra «Ingesta completada».
7. **Dado** un registro cuya columna 11 `id_averia` está vacía, **Cuando** se ingiere el archivo, **Entonces** el sistema rechaza la fila, la cuenta en el resumen como **1 rechazada** y la lista en el informe de incidencias con su número de fila, sin modificar el conteo de insertados por esa fila.
8. **Dado** un lote en el que el `id_averia` `2026-00123` aparece en las filas 12 y 47, **Cuando** se ingiere, **Entonces** el sistema inserta **una sola vez** el caso (el de la fila 12), reporta la fila 47 como duplicada del lote y el maestro contiene un único registro con ese `id_averia`.
9. **Dado** un lote con un registro cuyo `id_averia` empieza por `MAN-`, **Cuando** se ingiere, **Entonces** el sistema rechaza la fila por reserva de prefijo, la cuenta como rechazada y **no** modifica ningún caso manual existente.
10. **Dado** un caso nuevo con `unidad_negocio = CANTV EMPRESAS` y `ups = NRES`, **Cuando** se ingiere, **Entonces** el caso queda con `tipo_abonado = EMP`.
11. **Dado** los 51 casos nuevos, **Cuando** termina la ingesta, **Entonces** cada uno tiene `ingreso` = 13/09/2026, `clase = REP`, `nivel = COM`, `tipo_abonado` informado y `status` ∈ {PEND, GESTION}.
12. **Dado** un registro con `fecha_reporte = 17/07/2026 11:38:20 a.m.`, **Cuando** se ingiere, **Entonces** el caso queda con `fecha_reporte = 17/07/2026` y `fecha_reporte_original = 17/07/2026 11:38:20 a.m.`.
13. **Dado** un registro del CSV con `ultimo_usuario = JPEREZ` (col. 20), `usuario_acciona = MGOMEZ` (col. 53) y `Fecha Hora Asignacion = 12/09/2026 08:15` (col. 80), **Cuando** se ingiere el registro, **Entonces** el caso queda con `usuario_modificacion = JPEREZ` y `fecha_modificacion` = fecha de ingesta, el maestro **no contiene** ningún campo con los valores `MGOMEZ` ni `12/09/2026 08:15` (las columnas 53 y 80 se descartan, D-53) y CU-15 muestra `usuario_modificacion = JPEREZ` como origen del dato. [D-52, D-53, H-N-01]
14. **Dado** un maestro con 1.000 casos y un CSV de 60 registros, **Cuando** el operador pulsa *Confirmar ingesta*, **Entonces** desde ese clic hasta que el resumen aparece en pantalla transcurren menos de 3 s (punto de medida explícito, alineado con D-24; umbral derivado **S-RNF-02b**, pendiente **técnico** de calibración en la implementación, no una decisión del usuario).
15. **Dado** que la escritura de `averias.json` falla, **Cuando** el operador confirma la ingesta, **Entonces** el sistema muestra «No se pudo escribir el maestro: &lt;detalle&gt;», **no** muestra «Ingesta completada», ofrece *Reintentar* y `averias.json` conserva exactamente el mismo contenido y el mismo número de registros que antes del intento.
15c. **Dado** un maestro de 500 casos y un CSV válido de 51 registros nuevos, **Cuando** el operador confirma la ingesta, **Entonces** el sistema deja `averias_AAAA-MM-DD_HHMM.bak` con los 500 casos previos (y conserva como máximo las **10** copias `.bak` más recientes), escribe en el archivo temporal, **relee y compara** el contenido (551 registros, texto idéntico) y **solo entonces** muestra «Ingesta completada: 51 casos nuevos»; si la comparación falla, restaura el `.bak`, avisa y no confirma. [D-42, RNF-15]
15b. **Dado** que el operador cargó el CSV con `averias.json` en `fecha_modificacion = 13/09/2026 09:00` y el maestro fue modificado a las 09:40 por `12345`, **Cuando** el operador pulsa *Confirmar ingesta*, **Entonces** el sistema **no escribe**, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 09:40. Recargue o sobrescriba», conserva el resumen de la ingesta en pantalla y exige *Recargar* o *Sobrescribir* antes de insertar ningún caso. [D-41, RNF-14]
16. **Dado** que el supervisor modificó las claves y las dejó vacías, **Cuando** el operador ejecuta la ingesta, **Entonces** el sistema advierte «No hay palabras clave configuradas: todos los casos entrarían en GESTION» y exige confirmación explícita antes de continuar.
16b. **Dado** una sesión de **operador** con credencial válida y `central.json` completo, **Cuando** el operador confirma la ingesta, **Entonces** el sistema procesa el archivo y persiste los casos nuevos (la ingesta está **permitida** al operador por la matriz de §2.1, D-35) y deja constancia del `P00` en `usuario_modificacion` de cada caso nuevo junto con la fecha de ingesta. [D-35, RNF-12, D-52]
16c. **Dado** una sesión **sin identificación válida** (página recién abierta o sesión expirada por D-45), **Cuando** se intenta cargar el CSV diario, **Entonces** el sistema no muestra el bloque INGESTA, no lee el archivo y responde «Identifíquese para editar», de modo que ningún dato del maestro queda a la vista. [D-50, RNF-08]

**Restricciones del sistema (EARS)**

- **Cuando** el operador inicie la ingesta, el sistema deberá validar el contrato posicional de 80 columnas y **abortar** la operación completa si no coincide. [D-21, H-03, H-24]
- **Si** el archivo no contiene al menos un registro de datos, o la suma del resumen no cuadra, entonces el sistema deberá abortar sin escribir el maestro, sin disparar el respaldo y sin confirmar la ingesta. [H-14]
- **Si** un `id_averia` ya existe en `averias.json`, entonces el sistema deberá descartar el registro y no modificar el caso existente. [RN-01, RNF-04]
- **Si** la columna 11 `id_averia` de una fila está vacía o contiene solo espacios, entonces el sistema deberá rechazar esa fila, contarla como rechazada y reportarla con su número de fila, sin insertarla. [RN-01, RNF-04, H-09]
- **Si** el mismo `id_averia` aparece más de una vez en el lote, entonces el sistema deberá insertar únicamente la primera aparición y reportar las restantes como duplicadas del lote con su número de fila. [RNF-04, H-09]
- **Si** el `id_averia` de una fila del lote empieza por `MAN-`, entonces el sistema deberá rechazarla por reserva de prefijo del alta manual. [D-18, H-09]
- **El sistema deberá** evaluar las palabras clave en `ultimo_comentario`, `problema_reporte`, `informacion_1` e `informacion_2`, por subcadena sobre texto normalizado. [RN-03, D-26]
- **De acuerdo con** el estatus del CSV, el sistema deberá convertir `estatus = ASGN` en `status = PEND` y no incorporar ningún cuarto estado al maestro. [D-38]
- **El sistema deberá** admitir como valores de `status` del maestro únicamente `PEND`, `GESTION` y `CERRADO`, y deberá rechazar cualquier escritura de `status = ASGN`. [D-38]
- **El sistema deberá** conservar, al ingerir, **solo** la columna 20 (`ultimo_usuario`) como rastro de origen del dato: ese valor **inicializa `usuario_modificacion`** y `fecha_modificacion` toma la **fecha de ingesta**; las columnas **53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) no se persisten** y la **col. 18 (`fecha_compromiso`) tampoco**. [D-52, D-53, D-54]
- **Cuando** confirme la ingesta, el sistema deberá **añadir** a `historial.jsonl` la línea de cada caso nuevo con `accion = ingesta`, `operador` = `P00` de la sesión, `valor_anterior` vacío, `campo = status` y `valor_nuevo` con el estado con el que entra el caso. [RNF-09, **D-56**]
- **Si** la sesión no tiene un rol autorizado por la matriz de §2.1 para la ingesta, entonces el sistema deberá rechazarla sin leer el CSV ni escribir el maestro, y deberá **anotar el intento** con operador y fecha/hora en el **log de la aplicación** (§1.20, D-57 y D-58). [D-35, RNF-12, **D-58**]
- **Mientras** no exista una identificación válida, el sistema deberá mantener el bloque INGESTA oculto y bloqueada toda lectura del archivo y toda escritura del maestro. [D-50, RNF-08]
- **El sistema deberá** insertar todo caso ingerido con `clase = REP` y `nivel = COM`, dejando la corrección a `CNS` o `REF` para la edición manual. [RN-02, D-06]
- **Mientras** existan direcciones sin sector, el sistema deberá mantenerlas en una cola visible sin impedir la inserción de los demás casos. [RN-04, CU-09]
- **El sistema deberá** conservar el texto original de la fecha con hora y recortar el valor de trabajo a `DD/MM/AAAA`. [D-21, RNF-06]
- **Si** la escritura del maestro falla, entonces el sistema deberá conservar el maestro anterior, informar el error, ofrecer *Reintentar* y **no** confirmar la ingesta como exitosa. [RNF-10, H-09]
- **Cuando** vaya a escribir el maestro, el sistema deberá copiarlo antes a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribir en un archivo temporal, **releerlo y compararlo** con el contenido pretendido, y **solo entonces** confirmar en pantalla; si cualquier paso falla, deberá restaurar el respaldo, avisar y **no** confirmar. [D-42, RNF-15]
- **Si** el archivo del día no llega, entonces el sistema deberá mostrarlo como «sin ingesta», permitir registrar la novedad (fecha, motivo y operador) en `datos/incidencias.log`, mantener intacto el maestro del día anterior y **no** bloquear la consulta ni el despacho. [D-46]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-09 — Resolver la asignación de sector y las direcciones sin coincidencia

- **Actor principal:** Operador de la central.
- **Actor secundario:** Supervisor (mantiene el catálogo de sectores, CU-06).
- **Ciclo:** C2. **Prioridad:** MVP.
- **Precondiciones:** **sesión identificada (CU-01)** con un técnico activo y **con el rol que autoriza la matriz de §2.1**: la **cola la resuelve el supervisor** (rol elevado, D-35/D-59) y el operador de la central solo puede **proponer** el sector de una dirección en cola, quedando la propuesta pendiente de la aprobación del supervisor (D-60); **`C:\GGTO\datos\sectores.json` disponible y legible**; **existe al menos un caso con `sector` vacío** proveniente de la ingesta (CU-08) o de un alta manual (CU-14), es decir la cola de pendientes no está vacía. **El emisor del CSV no participa en este caso de uso** (D-59): la cola nace del archivo que él entrega, pero la resuelve un rol del sistema, no el origen del dato.
- **Postcondiciones:** cada caso de la cola tiene un `sector` existente en `sectores.json`, o queda registrado como pendiente con su motivo; la asignación queda auditada con operador y fecha/hora.

**Trazabilidad:** RF-18, RF-24, RF-29 (propuesta de sector desde la cola, aprobada por el supervisor); RN-04, RN-07; RNF-04, RNF-08, RNF-09, RNF-10, **RNF-12, RNF-14, RNF-15**; RT-01, RT-03; D-03, D-25, **D-35, D-41, D-42, D-56, D-59, D-60**; H-18.

**Flujo principal**

> **Nota de rol (D-59).** En este flujo «el operador» designa al usuario de la sesión que resuelve la cola: la **titularidad de la cola es del supervisor** (rol elevado, D-35) y el operador de la central solo puede **proponer** el sector de una dirección en cola, a la espera de la aprobación del supervisor (**D-60**). El **emisor del CSV no interviene** en ningún paso.

1. El operador abre la pestaña CONFIGURACION → **SECTORES** → *Cola de asignación* (o el aviso de pendientes que deja CU-08).
2. El sistema lista los casos sin sector con `id_averia`, `direccion`, `nombre` y fecha de ingreso, ordenados por antigüedad.
3. El operador selecciona un caso; el sistema muestra la dirección completa y la lista de sectores con sus vías.
4. El operador elige un sector existente y pulsa *Asignar*.
5. El sistema verifica que el sector exista y escribe `averias.sector` con la **escritura verificada de D-42/RNF-15**: copia antes el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribe en un **archivo temporal**, **relee y compara** el contenido (mismo número de registros e igualdad del texto serializado) y **solo entonces** confirma y quita el caso de la cola; si algo falla, **restaura el respaldo** y no confirma. La asignación **añade a `historial.jsonl`** la línea `campo = sector` con el valor anterior, el valor nuevo y `accion = edicion` (D-56). [D-42, RNF-15]
6. Si ningún sector corresponde, el operador pulsa *Proponer sector desde esta dirección*, informa `id`, `nombre` y las vías (tomando la dirección como primera vía) y el sistema registra la **propuesta** en estado `PENDIENTE DE APROBACIÓN` —sin `cuadrilla_sugerida` ni edición de otros sectores—; el supervisor la aprueba o la rechaza y, al aprobarla, el caso queda asignado a ese sector (**D-60**).
7. El sistema muestra el contador actualizado de casos sin sector y registra la asignación con operador y fecha/hora.

**Flujos alternativos**

- **5a. El sector elegido fue eliminado por otro proceso.** El sistema muestra «El sector 4 ya no existe. Actualice la lista» y mantiene el caso en la cola.
- **6a. `id` de sector repetido al crearlo desde la dirección.** El sistema muestra «El sector 4 ya existe» y devuelve al paso 4 con la lista actualizada.
- **2a. La cola está vacía.** El sistema muestra «Todas las direcciones tienen sector asignado» y no ofrece acciones.
- **3a. La dirección es ambigua (coincide con dos sectores).** El sistema muestra ambos sectores con las vías coincidentes y exige que el operador elija uno explícitamente; nunca asigna automáticamente el primero. [RN-04, H-18]
- **6b. Intento de editar o eliminar un sector existente desde esta pantalla.** El sistema responde «Acción no permitida para su rol: el CRUD de sectores corresponde al supervisor» y registra el intento; el operador solo puede **proponer** el sector que resuelve la dirección en cola. [D-35, D-60, RNF-12]
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente. La marca que se compara (`fecha_modificacion`) es un campo **TEXTO** `DD/MM/AAAA hh:mm`: la comparación es de igualdad de texto, nunca un rango de fechas (H-29).
- **5b. Escritura verificada con respaldo previo (D-42, RNF-15).** Al asignar el sector, el sistema copia antes el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribe en un **archivo temporal**, **relee y compara** el contenido (mismo número de registros e igualdad del texto serializado) y solo entonces confirma la asignación; si la copia previa falla, la escritura del temporal falla o la relectura no coincide, **restaura el respaldo**, muestra «No se pudo verificar la escritura: se restauró el maestro del DD/MM/AAAA HH:MM» y el caso permanece en la cola. [D-42, RNF-15]

**Criterios de aceptación (Gherkin)**

1. **Dado** 7 casos sin sector tras la ingesta, **Cuando** el operador abre la cola, **Entonces** el sistema muestra los 7 casos ordenados por fecha de ingreso ascendente.
2. **Dado** un caso con dirección `AV INTERCOMUNAL PRADOS DEL ESTE CASA 5` y el sector `1` con la vía `Av. Intercomunal`, **Cuando** el operador asigna el sector `1`, **Entonces** el caso queda con `sector = 1` y la cola pasa a 6 casos.
3. **Dado** un caso cuya dirección coincide con las vías de los sectores `1` y `4`, **Cuando** el operador abre el caso, **Entonces** el sistema muestra ambos sectores y no asigna ninguno hasta que el operador elija uno.
4. **Dado** que el operador pulsa *Crear sector desde esta dirección* con `id = 9`, `nombre = Baruta`, `vias = [Calle Sucre]`, **Cuando** confirma, **Entonces** `sectores.json` contiene el sector `9` y el caso queda con `sector = 9`.
5. **Dado** que el operador asigna un sector, **Cuando** el sistema persiste, **Entonces** el archivo `averias.json` releído contiene el nuevo `sector` y el caso registra `usuario_modificacion` y `fecha_modificacion`.
6. **Dado** que la sesión está cerrada (sin identificación), **Cuando** se intenta abrir la cola de asignación, **Entonces** el sistema no muestra la cola, pide identificación y no habilita ninguna escritura. [RNF-08]
7. **Dado** una sesión de operador con la cola abierta, **Cuando** el operador intenta modificar las vías de un sector ya existente o eliminarlo, **Entonces** el sistema responde «Acción no permitida para su rol», no modifica `sectores.json` y registra el intento. [D-35, RNF-12]
8. **Dado** un maestro de 480 casos y una sesión de operador que asigna el sector `4` al caso `2026-00123`, **Cuando** confirma la asignación, **Entonces** el sistema deja `averias_AAAA-MM-DD_HHMM.bak` con los 480 casos previos (conservando como máximo las **10** copias `.bak` más recientes), escribe en el archivo temporal, **relee y compara** el contenido (481 campos `sector` presentes, texto idéntico) y **solo entonces** muestra «Sector 4 asignado»; si la comparación falla, restaura el `.bak`, avisa y el caso sigue en la cola. [D-42, RNF-15]
9. **Dado** que el operador cargó la cola con `averias.json` en `fecha_modificacion = 13/09/2026 09:00` y el maestro fue modificado a las 09:50 por `12345`, **Cuando** el operador asigna un sector, **Entonces** el sistema **no escribe**, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 09:50. Recargue o sobrescriba», mantiene el caso en la cola y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]

**Restricciones del sistema (EARS)**

- **Si** la dirección del caso coincide con más de un sector, entonces el sistema deberá exigir selección manual y no asignar por defecto. [RN-04, H-18]
- **Si** el operador indica un sector que no existe en `sectores.json`, entonces el sistema deberá rechazar la asignación y ofrecer crearlo. [RNF-10]
- **Mientras** un caso no tenga sector, el sistema deberá mostrarlo en la cola de pendientes y marcarlo en la tabla de CASOS. [RN-04]
- **El sistema deberá** registrar el operador y la fecha/hora de cada asignación de sector y **añadir** a `historial.jsonl` su línea `campo = sector` con `valor_anterior` y `valor_nuevo`. [RNF-09, **D-56**]
- **Mientras** la sesión no esté identificada, el sistema deberá mantener la cola de asignación bloqueada, sin mostrar direcciones ni habilitar escrituras. [RNF-08]
- **Si** el operador intenta editar o eliminar un sector, entonces el sistema deberá rechazarlo, admitiendo únicamente la **propuesta** de sector desde la cola, pendiente de aprobación del supervisor. [D-35, D-60, RNF-12]
- **Cuando** vaya a escribir la asignación de sector en el maestro, el sistema deberá copiarlo antes a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribir en un archivo temporal, **releerlo y compararlo** y **solo entonces** confirmar; si falla, deberá restaurar el respaldo, avisar y **no** confirmar. [D-42, RNF-15]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-10 — Gestionar y filtrar los CASOS

- **Actor principal:** Operador de la central.
- **Actor secundario:** Supervisor (consulta y edita todos los casos, D-35).
- **Ciclo:** C1 (tabla) / C3 (clasificación). **Prioridad:** MVP.
- **Precondiciones:** **sesión identificada (CU-01) con credencial válida y vigente (D-39)** —sin identificación válida la tabla **no se renderiza** (D-50, RNF-08)—; `averias.json` legible; **si la sesión es de operador, tiene una cuadrilla asignada o trabaja en modo consulta global de solo lectura** (D-35, D-37, RNF-12).
- **Postcondiciones:** la tabla muestra los casos con las columnas resumen y los filtros/agrupaciones aplicados; toda edición de `clase`, `nivel` o `tipo_abonado` queda persistida y auditada.

**Trazabilidad:** RF-07, RF-21, RF-23, RF-24; RN-07; RNF-01, RNF-02, RNF-07, **RNF-08**, RNF-09, RNF-10, **RNF-12, RNF-13, RNF-14, RNF-15**; RT-01, RT-04; D-06, D-17, D-23, D-24, **D-29, D-35, D-37, D-39, D-40, D-41, D-42, D-48, D-50, D-56**; H-05, H-28. La edición en línea **sí** escribe el maestro, de modo que le aplican D-41/RNF-14 y D-42/RNF-15 como a cualquier otro camino de escritura (H-N-06, H-N-16), y cada cambio **añade** su línea a `historial.jsonl` (D-56).

**Flujo principal**

1. El operador abre la pestaña **CASOS**.
2. El sistema resuelve el ámbito de visibilidad: el supervisor ve todos los casos; el operador ve **solo los casos cuyo `Reparador Principal` es el `id` de su cuadrilla** (o todos en solo lectura si no tiene cuadrilla). [D-35, D-37, RNF-12]
3. El sistema carga `averias.json` y dibuja la tabla con las 7 columnas resumen: `nivel`, `clase`, `sector`, `id_averia`, `nombre`, `direccion`, `plan`.
4. El sistema muestra los controles de agrupación y filtrado: **abiertos/cerrados** (abierto = `status` distinto de `CERRADO`), **cuadrilla** (`Reparador Principal`), **tipo** (combinación `clase` + `nivel` calculada en pantalla: REP-COM, REP-REF, CNS-COM, CNS-REF), **clase**, **nivel** y **estatus** (PEND, GESTION, CERRADO), más un cuadro de texto de búsqueda libre.
5. El operador aplica uno o varios filtros y/o elige una agrupación; el sistema recalcula y muestra el conteo por grupo.
6. El operador ordena por cualquier columna visible con un clic en el encabezado.
7. El operador selecciona un caso; el sistema resalta la fila y ofrece *Ver detalle* (CU-11).
8. El operador edita `clase` y/o `nivel` y/o `tipo_abonado` en línea y pulsa *Guardar*.
9. El sistema valida los enums (`clase` ∈ {REP, CNS}; `nivel` ∈ {COM, REF}; `tipo_abonado` ∈ {RES, EMP}), **verifica que el caso esté dentro del ámbito del rol** y persiste el cambio en `averias.json`, relee el archivo y confirma con «Caso &lt;id_averia&gt; actualizado». El guardado es **verificado (D-42, RNF-15)**: copia previa a `averias_AAAA-MM-DD_HHMM.bak` (10 últimas), archivo temporal, relectura y comparación, y restauración del respaldo si algo falla. Cada campo modificado **añade además su línea a `historial.jsonl`** con `fecha_hora`, `operador` (`P00`), `id_averia`, `campo`, `valor_anterior`, `valor_nuevo` y `accion = edicion` (D-56).

**Flujos alternativos**

- **2a. `averias.json` no existe.** El sistema muestra la tabla vacía con «No hay maestro de casos. Ejecute la ingesta (CU-08) o cree un caso manual (CU-14)». [H-20]
- **2b. `averias.json` tiene JSON inválido.** El sistema bloquea la tabla, muestra el detalle del error y ofrece *Restaurar desde respaldo* (CU-21).
- **9a. Valor fuera del enum.** El sistema muestra «Clase inválida: use REP o CNS» y no persiste.
- **9b. Fallo de escritura.** El sistema revierte el valor en pantalla, muestra «No se guardó el cambio» y deja el caso en su estado anterior. [H-09]
- **9c. Caso fuera del ámbito del rol (otra cuadrilla).** El sistema no muestra el caso al operador; si el operador fuerza la edición de un `id_averia` de otra cuadrilla, el sistema muestra «El caso no está asignado a su cuadrilla», no escribe y registra el intento. [D-35, D-37, RNF-12]
- **9d. Sesión de operador sin cuadrilla.** El sistema mantiene la tabla en solo lectura y deshabilita *Guardar*, con el aviso «Sin cuadrilla asignada: solo consulta». [D-35, RNF-12]
- **9e. Pérdida de la sesión (cierre o expiración de las 8 horas, D-45).** El sistema **oculta la tabla y los conteos**, vuelve al diálogo **Identificación del operador** y rechaza la edición con «Identifíquese para editar»; al reingresar, la tabla se reconstruye desde el maestro. [D-45, D-50, RNF-08]
- **1a. Apertura sin identificación.** Si la página se abre sin sesión válida, la tabla de CASOS **no se renderiza** en absoluto: solo se ve el diálogo de acceso y ningún dato del maestro. [D-50, RNF-08]
- **5a. El filtro no devuelve filas.** El sistema muestra «0 casos para los filtros aplicados» y ofrece *Limpiar filtros*.
- **6a. Orden por columna con valores vacíos.** El sistema coloca los vacíos al final del orden, en ambos sentidos.
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.

**Criterios de aceptación (Gherkin)**

1. **Dado** un `averias.json` con 1.000 casos, **Cuando** el operador abre CASOS, **Entonces** la tabla se dibuja con las 7 columnas resumen **en menos de 1,5 s** (punto de medida: desde el clic en la pestaña CASOS hasta que la tabla queda dibujada). [RNF-02, D-24]
2. **Dado** el mismo maestro, **Cuando** el operador aplica el filtro `estatus = GESTION` y ordena por `sector`, **Entonces** el resultado y el orden se muestran **en menos de 1,5 s** (punto de medida: desde el clic en *Aplicar filtro* hasta el redibujado). [RNF-02, D-24]
3. **Dado** un caso con `clase = REP` y `nivel = COM`, **Cuando** el operador abre el filtro **tipo**, **Entonces** el caso aparece en el grupo `REP-COM` y no en `CNS-COM` ni en `REP-REF`.
4. **Dado** un caso con `status = CERRADO` y otro con `status = PEND`, **Cuando** el operador aplica el filtro **abiertos**, **Entonces** la tabla muestra solo el caso `PEND` y el conteo indica 1.
5. **Dado** 12 casos con `Reparador Principal = C1` y 8 con `C2`, **Cuando** el operador de la cuadrilla `C1` abre CASOS, **Entonces** la tabla muestra solo los 12 casos de `C1` y no los 8 de `C2`. [D-35, D-37, RNF-12]
6. **Dado** 12 casos con `Reparador Principal = C1` y 8 con `C2`, **Cuando** el supervisor filtra por cuadrilla `C1`, **Entonces** la tabla muestra 12 filas y el conteo indica 12.
7. **Dado** un caso `CNS` con `nivel = COM` de la cuadrilla del operador, **Cuando** el operador cambia `clase` a `REP` y guarda, **Entonces** `averias.json` releído contiene `clase = REP`, el caso registra operador y fecha/hora del cambio y `historial.jsonl` gana **1 línea** con `campo = clase`, `valor_anterior = CNS`, `valor_nuevo = REP`, el `P00` del operador y `accion = edicion`. [D-56]
8. **Dado** un caso de la cuadrilla `C2`, **Cuando** el operador de la cuadrilla `C1` intenta guardar un cambio de `clase` sobre ese caso, **Entonces** el sistema muestra «El caso no está asignado a su cuadrilla», no modifica `averias.json` y registra el intento.
9. **Dado** un caso `REP-COM`, **Cuando** el operador intenta guardar `nivel = EMP`, **Entonces** el sistema muestra «Nivel inválido: use COM o REF» y el archivo no cambia.
10. **Dado** un caso con `tipo_abonado` vacío, **Cuando** el operador lo establece en `EMP` y guarda, **Entonces** el caso aparece en el filtro `tipo_abonado = EMP` y en las métricas de gestión empresarial (CU-18).
10b. **Dado** que el operador cargó CASOS con `averias.json` en `fecha_modificacion = 13/09/2026 09:00` y el maestro fue modificado a las 09:35 por `67890`, **Cuando** el operador edita `clase` de un caso y pulsa *Guardar*, **Entonces** el sistema no escribe, revierte el valor en pantalla, muestra «Conflicto: el archivo fue modificado por 67890 el 13/09/2026 09:35. Recargue o sobrescriba» y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
11. **Dado** la tabla de CASOS con 12 filas y la sesión sin ratón, **Cuando** el operador recorre la interfaz **solo con el teclado** (`Tab` hasta la tabla, flechas `↑`/`↓` para moverse entre filas y `Enter` para abrir el detalle), **Entonces** el foco es visible en cada fila y el detalle del caso enfocado se abre sin usar el ratón. [D-40, RNF-13]
12. **Dado** la tabla de CASOS abierta, **Cuando** el operador enfoca el encabezado de una columna con `Tab` y pulsa `Enter`, **Entonces** el sistema ordena la tabla por esa columna y anuncia el nuevo orden, sin requerir el ratón. [D-40, RNF-13]
13. **Dado** cualquier pantalla de CASOS, **Cuando** se mide el contraste del texto y de los controles sobre su fondo, **Entonces** la relación es de al menos **4,5:1** y cada control del filtro y de la edición en línea tiene su `label` asociado. [D-40, RNF-13]

**Restricciones del sistema (EARS)**

- **Mientras** la tabla muestre más de 200 casos, el sistema deberá paginar o virtualizar el dibujo para mantener el umbral de 1,5 s. [RNF-02, D-24]
- **Cuando** se modifique un caso, el sistema deberá escribir el cambio en `averias.json` con la **escritura verificada de D-42** —copia previa `averias_AAAA-MM-DD_HHMM.bak` (10 últimas), archivo temporal, relectura comparada y restauración ante fallo— y releer el archivo antes de confirmar; además deberá **añadir** a `historial.jsonl` una línea por campo modificado con operador, fecha/hora, valor anterior y valor nuevo. [RN-07, RF-24, D-42, RNF-15, **D-56**, RNF-09]
- **Si** el valor editado no pertenece al enum, entonces el sistema deberá rechazar el cambio sin escribir el archivo. [RNF-10]
- **El sistema deberá** mostrar los valores de la tabla con la nomenclatura del dominio (`REP`, `CNS`, `COM`, `REF`, `PEND`, `GESTION`, `CERRADO`). [RNF-07, D-38]
- **El sistema deberá** calcular el «tipo» en pantalla como combinación de `clase` + `nivel`, sin crear un campo nuevo en el archivo. [D-23]
- **Mientras** la sesión tenga rol operador, el sistema deberá restringir la consulta y la edición en línea a los casos cuyo `Reparador Principal` sea el `id` de su cuadrilla, y deberá rechazar cualquier edición fuera de ese ámbito mostrando «El caso no está asignado a su cuadrilla». [D-35, D-37, RNF-12]
- **Mientras** la contraseña de la sesión esté caducada, el sistema deberá mantener la tabla en solo lectura hasta que se complete el cambio obligatorio de contraseña. [D-39, RNF-08]
- **El sistema deberá** permitir recorrer, filtrar y ordenar la tabla de CASOS **solo con el teclado** (`Tab`, `Enter` y flechas), con foco visible y contraste mínimo 4,5:1, y deberá asociar un `label` a cada control de filtro y de edición. [D-40, RNF-13]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-11 — Consultar la ficha de un caso

- **Actor principal:** Operador de la central.
- **Actores secundarios:** Supervisor.
- **Ciclo:** C3. **Prioridad:** MVP.
- **Precondiciones:** **sesión identificada (CU-01) con credencial válida y vigente (D-39)** —sin identificación válida no se muestra ficha ni dato alguno del maestro (D-50, RNF-08)—; `averias.json` legible; **el caso consultado pertenece al ámbito del rol**: para el operador, `Reparador Principal` = `id` de su cuadrilla (D-35, D-37, RNF-12).
- **Postcondiciones:** la ficha muestra los campos del caso agrupados en secciones; ninguna escritura se produce por el solo hecho de consultar.

**Trazabilidad:** RF-02, RF-22 (apertura del flotante); RNF-01, RNF-02, **RNF-08, RNF-12**; RT-04; D-09, **D-35, D-37, D-39, D-50**; H-19, H-31.

**Flujo principal**

1. El operador abre la pestaña **PANEL** o la tabla **CASOS** (CU-10).
2. El operador escribe un `id_averia` o un `telefono` en el campo de búsqueda y pulsa *Buscar*.
3. El sistema busca en `averias.json` dentro del ámbito del rol: coincidencia exacta por `id_averia`; si el criterio son solo dígitos, también por `telefono`.
4. El sistema muestra la ficha básica con los datos resumen (nivel, clase, sector, `id_averia`, nombre, dirección, plan) y el `status` vigente.
5. El operador pulsa *Ver detalle*; el sistema abre el flotante con toda la información restante agrupada en secciones: **Abonado y contacto** (`persona_reporta`, `contacto`, `nombre`, `direccion`), **Red y planta externa** (`olt`, `plan`, `slot`, `puerto`, `fat`, `serial`, `extra`, `ups`), **Diagnóstico** (`ultimo_comentario`, `problema_reporte`, `informacion_1`, `informacion_2`, `codigos_sin_gestion_en_VENAPP`), **Clasificación** (`clase`, `nivel`, `tipo_abonado`, `sector`) y **Gestión** (`status`, `resolucion`, `fechaResolucion`, `observaciones`, `sacas`).
6. El sistema muestra los botones *Cerrar caso* y *Cancelar*: *Cerrar caso* queda habilitado **solo si el caso está abierto y dentro del ámbito del rol** (el operador únicamente en casos de su cuadrilla) y deshabilitado si el caso ya está `CERRADO` (con la fecha de cierre como texto). [D-35, RNF-12]
7. El operador cierra el flotante con *Cancelar* o con la tecla `Esc`; el sistema vuelve a la vista anterior sin escribir en disco.

**Flujos alternativos**

- **3a. Un `id_averia` no existe.** El sistema muestra «No se encontró el caso con id &lt;valor&gt;» y sugiere buscar por teléfono.
- **3b. El teléfono devuelve varios casos.** El sistema muestra la lista de coincidencias con `id_averia`, nombre, dirección y `status`, y exige que el operador elija uno; nunca abre el primero automáticamente. [H-19]
- **3c. Búsqueda vacía.** El sistema muestra «Escriba un id_averia o un teléfono» y no busca.
- **3d. El caso pertenece a otra cuadrilla (sesión de operador).** El sistema no abre la ficha y muestra «El caso no está asignado a su cuadrilla»; registra la consulta fallida con operador y fecha/hora. [D-35, RNF-12]
- **5a. El caso ya está `CERRADO`.** El sistema muestra el flotante en modo lectura, con `resolucion`, `fechaResolucion`, `observaciones` y `sacas` visibles, y el botón *Cerrar caso* deshabilitado con el texto «Caso cerrado el DD/MM/AAAA». [H-19]
- **2a. `averias.json` no disponible.** El sistema muestra «Maestro de casos no disponible» y ofrece *Restaurar desde respaldo*. [CU-21]
- **1a. Sesión no identificada o contraseña caducada.** El sistema bloquea la consulta y pide identificación o el cambio obligatorio de contraseña (D-39). **No existe modo de consulta anónima ni vista previa de datos personales: sin sesión válida la página no muestra ningún dato** (D-50, RNF-08): el alcance de lo visible antes de iniciar sesión queda cerrado por D-50, que zanja H-31 —antes de identificarse solo se ve el diálogo de acceso—. La regla vale también para el **modo descarga** de CU-22: sin sesión válida no se carga ni se consulta el maestro y el diálogo de acceso es lo único visible (H-N-02).
- **5b. Pérdida de la sesión (cierre o expiración de las 8 horas, D-45).** El sistema cierra la ficha abierta, **oculta sus datos**, vuelve al diálogo de acceso y exige reingreso; ninguna ficha permanece visible sin sesión. [D-45, D-50, RNF-08]

**Criterios de aceptación (Gherkin)**

1. **Dado** un caso con `id_averia = 2026-00123` en el maestro y una sesión de operador de la cuadrilla `C1` con `Reparador Principal = C1`, **Cuando** el operador lo busca por ese id, **Entonces** la ficha muestra `2026-00123`, el nombre, la dirección, el plan y el `status` vigente.
2. **Dado** un caso con `telefono = 02121234567`, `id_averia = 2026-00456`, nombre `María Díaz`, dirección `Calle Sucre 12`, plan `GPON 100M` y `status = PEND` de la cuadrilla del operador, **Cuando** el operador busca ese número, **Entonces** el sistema muestra **una sola** ficha con el encabezado «2026-00456 — María Díaz» y los cuatro campos `direccion`, `plan`, `status` y `sector` informados en pantalla. [H-N-24]
3. **Dado** dos casos con el mismo `telefono` `02121234567` y ambos de la cuadrilla del operador, **Cuando** el operador busca ese número, **Entonces** el sistema muestra una lista con 2 coincidencias e `id_averia` distintos y no abre ninguna ficha hasta que el operador elija.
4. **Dado** un caso con `Reparador Principal = C2` y una sesión de operador de la cuadrilla `C1`, **Cuando** el operador busca ese `id_averia`, **Entonces** el sistema muestra «El caso no está asignado a su cuadrilla» y no abre la ficha. [D-35, RNF-12]
5. **Dado** el mismo caso `2026-00789` con `Reparador Principal = C2` y una sesión de supervisor, **Cuando** el supervisor busca ese `id_averia`, **Entonces** el sistema **no** muestra el mensaje «El caso no está asignado a su cuadrilla» y abre el flotante con el encabezado «2026-00789», las 5 secciones y el botón *Cerrar caso* habilitado (el caso está abierto). [D-35, H-N-24]
6. **Dado** un caso seleccionado con los 29 campos de `averias.json` informados, **Cuando** el operador pulsa *Ver detalle*, **Entonces** el flotante muestra exactamente **5 secciones** en este orden —«Abonado y contacto», «Red y planta externa», «Diagnóstico», «Clasificación» y «Gestión»— y un total de **29 campos** visibles, sin ninguno fuera. [H-N-24]
7. **Dado** un caso con `status = CERRADO`, `resolucion = COS` y `fechaResolucion = 12/09/2026`, **Cuando** el operador abre el detalle, **Entonces** el botón *Cerrar caso* está deshabilitado y muestra «Caso cerrado el 12/09/2026».
8. **Dado** un caso abierto de la cuadrilla del operador y el flotante abierto, **Cuando** el operador pulsa *Cancelar*, **Entonces** el flotante se cierra y la fecha de modificación del caso no cambia.
9. **Dado** un técnico con `clave_fecha_cambio` de hace más de 90 días, **Cuando** intenta consultar la ficha de un caso, **Entonces** el sistema exige primero el cambio obligatorio de contraseña y no muestra datos del abonado. [D-39]

**Restricciones del sistema (EARS)**

- **Cuando** la búsqueda por `telefono` devuelva más de un caso, el sistema deberá exigir la selección explícita del operador. [H-19]
- **Mientras** la sesión no esté identificada con credencial válida, el sistema deberá bloquear la consulta del detalle y no mostrar datos personales del abonado. [RNF-08, RNF-12, D-39]
- **Si** el caso consultado no pertenece al ámbito del rol de la sesión, entonces el sistema deberá denegar la ficha, mostrar «El caso no está asignado a su cuadrilla» y registrar el intento. [D-35, D-37, RNF-12]
- **Mientras** la sesión tenga rol operador, el sistema deberá mantener deshabilitado el botón *Cerrar caso* en los casos que no sean de su cuadrilla. [D-35, RNF-12]
- **El sistema deberá** mostrar las fechas en formato `DD/MM/AAAA`. [RNF-06]

---

### CU-12 — Cerrar un caso

- **Actor principal:** Operador de la central.
- **Actor secundario:** Supervisor (verifica y también puede cerrar cualquier caso, D-35).
- **Ciclo:** C3 (y C1 para el cierre desde el flotante de CASOS). **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con credencial válida y vigente (D-39)**; el caso existe en `averias.json` y su `status` es distinto de `CERRADO`; **el `Reparador Principal` del caso coincide con el `id` de la cuadrilla del operador identificado (equivalencia D-37), o la sesión tiene rol supervisor**. [D-35, RNF-12]
- **Postcondiciones:** el caso queda con `status = CERRADO`, `resolucion`, `fechaResolucion`, `observaciones` y `sacas` persistidos, **con la escritura verificada por relectura y respaldo previo (D-42, RNF-15)**; el cambio queda auditado.

**Trazabilidad:** RF-03, RF-22, RF-24; RN-07; RNF-06, **RNF-08**, RNF-09, RNF-10, **RNF-12, RNF-14, RNF-15**; RT-01; D-20, **D-29, D-35, D-37, D-39, D-41, D-42, D-56**; H-11, H-19.

**Flujo principal**

1. El operador localiza el caso por `id_averia` o `telefono` (CU-11) y abre el flotante de detalle.
2. El operador pulsa *Cerrar caso*.
3. El sistema **verifica el ámbito del rol** (caso de su cuadrilla, D-35/D-37) y habilita el bloque de cierre con los campos: `resolucion` (lista IVR / COS / COLA), `fechaResolucion` (`DD/MM/AAAA`, propuesta con la fecha del día), `observaciones` (texto libre) y `sacas` (SI / NO).
4. El operador completa `resolucion` y `fechaResolucion`, y opcionalmente `observaciones` y `sacas`.
5. El sistema valida: `resolucion` ∈ {IVR, COS, COLA}; `fechaResolucion` con formato `DD/MM/AAAA` y fecha válida; `sacas` ∈ {SI, NO}; `observaciones` de hasta 500 caracteres.
6. El operador pulsa *Confirmar cierre*.
7. El sistema escribe en `averias.json`: `status = CERRADO`, los 4 campos del cierre, `usuario_modificacion` = operador de la sesión y `fecha_modificacion` = fecha/hora actual. La escritura es **verificada (D-42, RNF-15)**: primero copia el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), luego escribe en un **archivo temporal**, **relee y compara** el contenido y solo entonces confirma el cambio en pantalla. Del mismo modo, **añade a `historial.jsonl`** una línea por cada campo modificado (`status`, `resolucion`, `fechaResolucion`, `observaciones`, `sacas`) con `fecha_hora`, el `P00` de la sesión, `valor_anterior`, `valor_nuevo` y `accion = cierre` (D-56).
8. El sistema muestra «Caso &lt;id_averia&gt; cerrado con resolución COS» y actualiza la fila de la tabla; el botón *Cerrar caso* queda deshabilitado para ese caso.

**Flujos alternativos**

- **5a. Falta `resolucion`.** El sistema mantiene deshabilitado el botón *Confirmar cierre*, marca el campo y muestra «Indique la resolución (IVR, COS o COLA)». [D-20, H-11]
- **5b. Falta `fechaResolucion`.** Igual que 5a, con el mensaje «Indique la fecha de resolución en formato DD/MM/AAAA».
- **5c. `fechaResolucion` con formato inválido (por ejemplo `31/02/2026`).** El sistema muestra «Fecha inválida: use DD/MM/AAAA con una fecha real» y no permite confirmar.
- **5d. `sacas` con valor fuera del enum.** El sistema muestra «Sacas debe ser SI o NO» y no permite confirmar.
- **2a. Caso de otra cuadrilla.** Si el `Reparador Principal` del caso no es el `id` de la cuadrilla del operador, el sistema muestra «Acción no permitida para su rol: el caso no está asignado a su cuadrilla», mantiene el bloque de cierre deshabilitado, no escribe el maestro y registra el intento con operador y fecha/hora. [D-35, D-37, RNF-12]
- **2b. Contraseña caducada.** Si la sesión tiene la contraseña caducada, el sistema no habilita el cierre y exige el cambio de contraseña antes de operar. [D-39]
- **1a. El caso ya está `CERRADO`.** El sistema muestra el cierre vigente y ofrece *Reabrir caso*; si el usuario autorizado confirma la reapertura, el caso pasa a `status = GESTION`, se conservan `resolucion` y `fechaResolucion` anteriores en `observaciones` con la marca «Reapertura DD/MM/AAAA hh:mm por &lt;operador&gt;», el cambio se audita y se **añade** a `historial.jsonl` la línea de `status` con `valor_anterior = CERRADO`, `valor_nuevo = GESTION` y `accion = reapertura` (D-56). [H-19, D-56]
- **7a. Fallo de escritura o de verificación (D-42).** Si la copia previa a `averias_AAAA-MM-DD_HHMM.bak`, la escritura del temporal o la relectura comparada fallan, el sistema **restaura el respaldo**, muestra «No se pudo verificar la escritura del cierre: se restauró el maestro del DD/MM/AAAA HH:MM», mantiene el caso abierto, **no confirma** el cierre y ofrece *Reintentar*. [D-42, RNF-15, H-09]
- **3a. El operador cancela.** El sistema cierra el bloque de cierre sin escribir y el caso conserva su `status` anterior.
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.

**Criterios de aceptación (Gherkin)**

1. **Dado** un caso con `status = PEND` de la cuadrilla del operador, **Cuando** el operador pulsa *Cerrar caso* sin informar `resolucion` ni `fechaResolucion`, **Entonces** el botón *Confirmar cierre* permanece deshabilitado y el sistema muestra «Indique la resolución (IVR, COS o COLA)».
2. **Dado** el mismo caso con `resolucion = COS` y sin `fechaResolucion`, **Cuando** el operador intenta confirmar, **Entonces** el sistema muestra «Indique la fecha de resolución en formato DD/MM/AAAA» y `averias.json` no cambia.
3. **Dado** un caso de la cuadrilla del operador con `resolucion = COS`, `fechaResolucion = 13/09/2026`, `observaciones = Reparado en sitio` y `sacas = NO`, **Cuando** el operador confirma el cierre, **Entonces** `averias.json` releído contiene `status = CERRADO` y los 4 campos informados.
4. **Dado** que el operador cierra un caso de su cuadrilla, **Cuando** el sistema persiste, **Entonces** el caso queda con `usuario_modificacion` igual al P00 de la sesión y `fecha_modificacion` con formato `DD/MM/AAAA hh:mm`, y `historial.jsonl` gana la línea (o líneas) del cierre con `accion = cierre`, `operador` = P00 de la sesión, `campo = status`, `valor_anterior = PEND` y `valor_nuevo = CERRADO`. [D-56]
5. **Dado** un caso con `Reparador Principal = C2` y una sesión de operador de la cuadrilla `C1`, **Cuando** el operador pulsa *Confirmar cierre*, **Entonces** el sistema muestra «Acción no permitida para su rol: el caso no está asignado a su cuadrilla», el caso conserva su `status` y `averias.json` no cambia. [D-35, RNF-12]
6. **Dado** el mismo caso `C2` y una sesión de supervisor, **Cuando** el supervisor confirma el cierre con `resolucion = COS` y `fechaResolucion = 13/09/2026`, **Entonces** el caso queda en `status = CERRADO`. [D-35]
7. **Dado** un operador cuyo `clave_fecha_cambio` es de hace más de 90 días, **Cuando** intenta cerrar un caso de su cuadrilla, **Entonces** el sistema exige el cambio de contraseña, no habilita *Confirmar cierre* y `averias.json` no cambia. [D-39]
8. **Dado** un caso `CERRADO` el 12/09/2026, **Cuando** el usuario autorizado abre su detalle, **Entonces** el botón *Cerrar caso* está deshabilitado con el texto «Caso cerrado el 12/09/2026» y el sistema ofrece *Reabrir caso*.
9. **Dado** una `fechaResolucion = 31/02/2026`, **Cuando** el operador intenta confirmar, **Entonces** el sistema muestra «Fecha inválida» y no permite el cierre.
10. **Dado** un caso abierto de su cuadrilla, **Cuando** el operador confirma el cierre, **Entonces** la tabla de CASOS actualiza la fila y el filtro «abiertos» deja de contarlo (el conteo baja en 1).
11. **Dado** un `averias.json` con 51 casos cuya `fecha_modificacion` es `13/09/2026 10:00` y `usuario_modificacion = 12345`, **Y** dos ventanas abiertas sobre el mismo archivo (ventana A de la cuadrilla `C1` y ventana B de la cuadrilla `C2`), **Cuando** la ventana A cierra el caso `2026-00123` a las 10:05 y guarda, **Y** la ventana B, que cargó el maestro a las 10:00, intenta cerrar el caso `2026-00456` a las 10:06 y guardar, **Entonces** el sistema **no escribe** desde B, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 10:05. Recargue o sobrescriba», mantiene *Confirmar cierre* deshabilitado, conserva el cierre de A intacto en `averias.json` y no permite continuar hasta que B elija *Recargar* o *Sobrescribir*. [D-41, RNF-14]
12. **Dado** que la ventana B decide *Recargar*, **Cuando** el sistema reconstruye la vista, **Entonces** el caso `2026-00123` aparece ya `CERRADO` con `usuario_modificacion = 12345` y `fecha_modificacion = 13/09/2026 10:05`, los cambios locales de B se han descartado y `averias.json` sigue con los dos cierres. [D-41, RNF-14]
13. **Dado** el mismo conflicto de dos ventanas, **Cuando** la ventana B elige *Sobrescribir* de forma consciente, **Entonces** el sistema escribe el cierre de B, incrementa `fecha_modificacion`, registra la decisión de sobrescritura con el P00 de B y la fecha/hora, y `averias.json` conserva **ambos** cierres (el de A y el de B) sin pérdida de datos. [D-41, RNF-14]

**Restricciones del sistema (EARS)**

- **Mientras** falten `resolucion` o `fechaResolucion`, el sistema deberá mantener deshabilitada la confirmación del cierre. [D-20, RNF-10, H-11]
- **Cuando** vaya a escribir el cierre en el maestro, el sistema deberá copiarlo antes a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribir en un archivo temporal, **releerlo y compararlo**, y **solo entonces** confirmar; si falla, deberá restaurar el respaldo, avisar y **no** confirmar. [D-42, RNF-15]
- **Si** un valor de enum o el formato de fecha son inválidos, entonces el sistema deberá rechazar el cierre sin escribir el archivo. [RNF-10]
- **Cuando** se cierre un caso, el sistema deberá registrar operador y fecha/hora del cambio y **añadir** a `historial.jsonl` la línea de cada campo modificado con `accion = cierre`. [RNF-09, D-16, **D-56**]
- **El sistema deberá** conservar el caso cerrado en el maestro sin purga automática y sin plazo de caducidad, con la finalidad del tratamiento documentada en la **ficha de tratamiento de datos personales (D-28)** —responsable, base de licitud y canal del titular—; la retención indefinida es un **riesgo aceptado** por D-28. [D-28, H-N-10]
- **Si** la sesión tiene rol operador y el `Reparador Principal` del caso no es el `id` de su cuadrilla, entonces el sistema deberá rechazar el cierre, no escribir el maestro y registrar el intento. [D-35, D-37, RNF-12]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]
- **Mientras** la contraseña de la sesión esté caducada, el sistema deberá bloquear el cierre de casos hasta que se complete el cambio obligatorio. [D-39, RNF-08]

---

### CU-13 — Gestionar telefónicamente la bandeja GESTION

- **Actor principal:** Supervisor (función administrativa; **la bandeja GESTION es exclusiva de su rol**, D-35 y RF-15).
- **Actor secundario:** Operador de la central (ejecuta en calle los casos que salen de la bandeja).
- **Ciclo:** C3. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor y credencial válida y vigente (D-35, D-39, RNF-12)**; existen casos con `status = GESTION` (en la muestra del 12/09/2026, **37 casos**: los 51 ingeridos menos los 14 que entran en PEND).
- **Postcondiciones:** cada caso gestionado sale de la bandeja con su clasificación corregida (`clase`, `nivel`, `tipo_abonado`, `sector`) y su resultado registrado, **con la escritura verificada por relectura y respaldo previo (D-42, RNF-15)**; los casos no contactados permanecen en la bandeja con su intento anotado.

**Trazabilidad:** RF-15, RF-07 (clasificación), RF-23, RF-24, RF-28; RN-07; RNF-01, **RNF-08**, RNF-09, RNF-10, **RNF-12, RNF-14, RNF-15**; D-06, D-17, D-23, **D-29, D-30, D-35, D-38, D-39, D-41, D-42, D-56**; H-01, H-27.

**Flujo principal**

1. El supervisor abre la pestaña **GESTION**.
2. El sistema lista los casos con `status = GESTION`, ordenados por antigüedad de `ingreso` y agrupados por sector, con `id_averia`, teléfono, nombre, dirección, sector y último comentario; el contador de la bandeja es **37** para la muestra del 12/09/2026.
3. El supervisor selecciona un caso y llama al abonado; el sistema muestra un guion de verificación con los datos del caso a confirmar (dirección, servicio, tipo de abonado, presencia de fibra).
4. El supervisor registra el resultado de la llamada: *Contactado*, *No contesta*, *Número equivocado* o *Reagendar*; y cuando corresponde, corrige `clase`, `nivel` y `tipo_abonado` y escribe una nota breve en `observaciones`.
5. El sistema valida los enums editados y persiste los cambios con operador y fecha/hora, **añadiendo a `historial.jsonl` la línea de cada campo corregido** (`clase`, `nivel`, `tipo_abonado`, `sector`, `observaciones`) con su valor anterior, su valor nuevo y `accion = edicion` (D-56).
6. Cuando el caso queda clasificado, el supervisor pulsa *Enviar a calle*: el sistema cambia `status` a `PEND` si el caso presenta falla de fibra, o lo mantiene en `PEND` dejándolo listo para el despacho si no la presenta (el maestro no tiene estado `ASGN`, D-38), y lo saca de la bandeja.
7. El sistema actualiza el contador de la bandeja y muestra «GESTION: N casos pendientes de llamada, M gestionados hoy».

**Flujos alternativos**

- **4a. No contesta.** El sistema guarda la nota «Sin contacto DD/MM/AAAA hh:mm», mantiene el caso en `GESTION` y conserva su posición en la cola.
- **4b. Número equivocado.** El sistema guarda la nota, mantiene el caso en `GESTION` y lo marca con la etiqueta «Teléfono por verificar».
- **5a. Enum inválido al corregir la clasificación.** El sistema muestra el error y no persiste.
- **6a. El caso tiene `clase = CNS` y no hay cuadrilla con reparaciones en ese sector.** El sistema permite igualmente «Enviar a calle», advierte que la asignación de construcción se resolverá en el despacho (CU-16) y no bloquea el cambio. [RN-06]
- **2a. La bandeja está vacía.** El sistema muestra «No hay casos en GESTION» con la fecha del último cambio de estado.
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra la bandeja GESTION ni permite llamadas, cambios de clasificación ni «Enviar a calle»; muestra «Acción no permitida para su rol» y registra el intento. [D-35, RNF-12, RF-15]
- **1b. Contraseña caducada.** Si la sesión del supervisor tiene la contraseña caducada, el sistema no abre la bandeja y exige el cambio antes de operar. [D-39]
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.
- **5b. Escritura verificada con respaldo previo (D-42, RNF-15).** Al persistir una gestión, el sistema copia antes el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribe en un **archivo temporal**, **relee y compara** el contenido y solo entonces confirma en pantalla; si la relectura no coincide, **restaura el respaldo**, avisa «No se pudo verificar la escritura: se restauró el maestro» y la gestión no se da por registrada. [D-42, RNF-15]

**Criterios de aceptación (Gherkin)**

1. **Dado** 37 casos con `status = GESTION`, **Cuando** el supervisor abre la pestaña GESTION, **Entonces** el sistema lista los 37 casos ordenados por antigüedad y agrupados por sector.
2. **Dado** un caso en `GESTION` con `nivel = COM`, **Cuando** el supervisor verifica por teléfono que es empresarial, cambia `tipo_abonado` a `EMP` y guarda, **Entonces** `averias.json` releído contiene `tipo_abonado = EMP`, el caso registra operador y fecha/hora y `historial.jsonl` gana la línea `campo = tipo_abonado` con `valor_anterior = RES`, `valor_nuevo = EMP` y `accion = edicion`. [D-56]
3. **Dado** un caso en `GESTION` sin palabras clave de fibra, **Cuando** el supervisor confirma «Sin falla de fibra» y pulsa *Enviar a calle*, **Entonces** el caso queda en `status = PEND` y sale de la bandeja (el contador baja en 1).
4. **Dado** un caso en `GESTION`, **Cuando** el supervisor registra «No contesta», **Entonces** el caso permanece en `status = GESTION`, el contador no cambia y `observaciones` contiene la marca de fecha y hora del intento.
5. **Dado** un caso en `GESTION` con `clase = CNS`, **Cuando** el supervisor pulsa *Enviar a calle*, **Entonces** el sistema cambia el estado a `PEND`, advierte sobre la asignación de construcción y el caso conserva `clase = CNS`.
6. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir la pestaña GESTION, **Entonces** el sistema responde «Acción no permitida para su rol», no muestra ningún caso de la bandeja y registra el intento. [D-35, RNF-12]
7. **Dado** un caso ya gestionado, **Cuando** el supervisor aplica el filtro «gestionados hoy», **Entonces** el caso aparece en el conteo diario usado por MONITOREO (CU-18).
7b. **Dado** que el supervisor cargó la bandeja con `averias.json` en `fecha_modificacion = 13/09/2026 10:00` y el maestro fue modificado a las 10:10 por `12345`, **Cuando** el supervisor registra «Contactado» y guarda, **Entonces** el sistema no escribe, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 10:10. Recargue o sobrescriba» y exige *Recargar* o *Sobrescribir* antes de persistir la gestión. [D-41, RNF-14]

**Restricciones del sistema (EARS)**

- **Mientras** un caso no tenga resultado de llamada, el sistema deberá mantenerlo en la bandeja `GESTION`. [RF-15]
- **Cuando** el supervisor cambie `clase`, `nivel` o `tipo_abonado`, el sistema deberá persistir el cambio de inmediato, auditar operador y fecha/hora y **añadir** a `historial.jsonl` la línea del campo con su valor anterior y su valor nuevo. [RN-07, RNF-09, **D-56**]
- **Si** el valor editado no pertenece al enum, entonces el sistema deberá rechazarlo sin escribir el archivo. [RNF-10]
- **El sistema deberá** conservar en `observaciones` el rastro de cada intento de contacto con fecha. [D-16]
- **Cuando** persista una gestión de la bandeja, el sistema deberá copiar el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribir en un archivo temporal, **releerlo y compararlo** y **solo entonces** confirmar; si falla, deberá restaurar el respaldo, avisar y **no** confirmar. [D-42, RNF-15]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá denegar el acceso a la bandeja GESTION y rechazar cualquier cambio de clasificación o «Enviar a calle». [D-35, RNF-12, RF-15]
- **El sistema deberá** admitir como `status` del maestro únicamente PEND, GESTION y CERRADO, de modo que «Enviar a calle» lleve el caso a PEND y nunca a un estado `ASGN`. [D-38]
- **Mientras** la contraseña de la sesión esté caducada, el sistema deberá mantener la bandeja bloqueada hasta completar el cambio obligatorio. [D-39, RNF-08]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-14 — Dar de alta manual un caso

- **Actor principal:** Operador de la central.
- **Actor secundario:** Supervisor (padrones usados en la validación y alta permitida también a su rol).
- **Ciclo:** C3. **Prioridad:** MVP.
- **Precondiciones:** sesión identificada (CU-01) **con credencial válida y vigente (D-39)**; **rol autorizado por la matriz de §2.1: el alta manual está permitida al operador y al supervisor** (D-35, RNF-12); `sectores.json` con al menos un sector; `averias.json` legible.
- **Postcondiciones:** el caso existe en `averias.json` con un `id_averia` único con prefijo `MAN-`, el resto de campos obligatorios informados, **`Reparador Principal` = `id` de la cuadrilla de la sesión y `fecha_asignacion` = fecha del alta** (D-37, D-48) —o ambos vacíos si la sesión no tiene cuadrilla—, de modo que el operador **ve el caso que acaba de crear** (H-N-05); la escritura queda verificada por relectura y respaldo previo (D-42, RNF-15) y el alta auditada.

**Trazabilidad:** RF-04, RF-28; RN-01, RN-02; RNF-04, RNF-08, RNF-09, RNF-10, **RNF-12, RNF-14, RNF-15**; RT-01; D-06, D-14, D-17, D-18, D-20, **D-35, D-37, D-41, D-42, D-48, D-56**; H-02, H-09, H-N-03, H-N-05.

**Flujo principal**

1. El operador abre la pestaña **PANEL**, bloque *Nuevo caso*, y pulsa *Agregar caso*.
2. El sistema presenta la lista **cerrada** de campos: fecha del caso (`DD/MM/AAAA`, propuesta con la fecha del día), teléfono, nombre, dirección, contacto, problema reportado, sector (lista de `sectores.json`), clase (REP / CNS), nivel (COM / REF), tipo_abonado (RES / EMP) y observaciones.
3. El operador completa los campos y pulsa *Guardar caso*.
4. El sistema valida: fecha con formato `DD/MM/AAAA`; teléfono con 7 a 15 dígitos; nombre y dirección no vacíos; sector existente en `sectores.json`; clase, nivel y tipo_abonado dentro de sus enums.
5. El sistema genera el `id_averia` como `MAN-` + consecutivo (por ejemplo `MAN-0001`), tomando el mayor consecutivo existente con ese prefijo y verificando que el valor no exista en `averias.json` ni en el CSV del día.
6. El sistema completa los campos no capturados: `ingreso` = fecha del día, `status = GESTION`, `resolucion`, `fechaResolucion`, `sacas` vacíos; `usuario_modificacion` y `fecha_modificacion` con el operador y la hora.
6b. **Asignación del caso a la cuadrilla de la sesión (D-37, D-48).** El sistema escribe `Reparador Principal` con el `id` de la cuadrilla del técnico identificado y `fecha_asignacion` con la fecha del alta, **antes** de que el caso se muestre, para que el operador lo vea en CASOS; si la sesión **no tiene cuadrilla asignada**, deja ambos campos vacíos, muestra «Caso creado sin cuadrilla: visible en solo lectura hasta el despacho» y el caso queda en el grupo «Sin asignar» (CU-18). [D-37, D-48, RNF-12, H-N-05]
7. El sistema escribe `averias.json` con la **escritura verificada de D-42/RNF-15** (respaldo previo `.bak`, archivo temporal, relectura y comparación), relee el archivo, verifica que el `id_averia` generado es único y muestra «Caso MAN-0001 creado». Además **añade a `historial.jsonl`** la línea de **alta** (`campo = status`, `valor_anterior` vacío, `valor_nuevo = GESTION`, `accion = ingesta`) y, cuando corresponde, la línea de la asignación a la cuadrilla de la sesión (`campo = Reparador Principal`, `accion = asignacion`). [D-56]
8. El sistema limpia el formulario y muestra el caso en la tabla de CASOS.

**Flujos alternativos**

- **4a. Campo obligatorio vacío.** El sistema marca el campo y muestra «Complete: dirección», sin generar id ni escribir.
- **4b. Sector inexistente.** El sistema muestra «El sector 7 no existe en `sectores.json`» y ofrece abrir CU-06.
- **4c. Fecha inválida.** El sistema muestra «Fecha inválida: use DD/MM/AAAA con una fecha real» y no permite guardar.
- **5a. Colisión de `MAN-` contra el maestro.** Si el `id_averia` candidato (`MAN-0001`) ya existe en `averias.json`, el sistema **rechaza ese valor**, calcula el siguiente consecutivo libre y lo sugiere: muestra «El id MAN-0001 ya existe; se sugiere MAN-0002» y solo continúa el alta cuando el valor sugerido está libre. [D-18, RNF-04]
- **5b. Colisión de `MAN-` contra el CSV del día.** Si el CSV trae una fila con un `id_averia` del espacio `MAN-`, la ingesta ya la rechazó por reserva de prefijo (CU-08 5d) y el alta manual conserva el prefijo como propio. Si aun así se detecta una colisión en el momento del alta, el sistema **rechaza** el id candidato, sugiere el siguiente consecutivo libre y lo informa. [D-18, RN-01, H-09]
- **7a. Fallo de escritura.** El sistema no confirma el alta, conserva los datos en el formulario y ofrece *Reintentar*. La copia fechada del cierre de jornada en `C:\GGTO\respaldo\` (D-49, RNF-16) es la red de seguridad del día. [D-49, CU-21]
- **1a. Acción no permitida para su rol.** Si la sesión no está identificada o su rol no figura como autorizado en la matriz de §2.1, el sistema no muestra el bloque *Nuevo caso* ni ejecuta la escritura, responde «Acción no permitida para su rol» y registra el intento con operador y fecha/hora. [D-35, RNF-12]
- **2a. Campos del fuente que no existen en el maestro (D-47, cerrado).** A-17 quedó cerrada con D-14 (se descartan los datos de `alta_manual.csv`) y **D-47** cierra el punto: aunque la fuente original (L8) pedía «Fecha, Tipo, Actividad, Contacto, Nombre, Dirección, Información, Agente, ETC», el alta manual **no incorpora Tipo, Actividad ni Agente** y el formulario se rige **exclusivamente** por la lista cerrada de campos de **D-18**. No queda mapeo pendiente de esos tres campos; si algún día se decidiera incorporarlos, haría falta una decisión nueva y la ampliación de este caso de uso. [D-14, D-18, D-47]
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.
- **7b. Escritura verificada con respaldo previo (D-42, RNF-15).** Al confirmar el alta, el sistema copia antes el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribe en un **archivo temporal**, **relee y compara** el contenido y solo entonces muestra «Caso MAN-0001 creado»; si la relectura no coincide, **restaura el respaldo**, avisa y el alta **no** se confirma. [D-42, RNF-15]

**Criterios de aceptación (Gherkin)**

1. **Dado** el formulario de nuevo caso con fecha `13/09/2026`, teléfono `04141234567`, nombre `María Díaz`, dirección `Calle Sucre 12`, contacto `04149876543`, problema `Sin tono`, sector `1`, clase `REP`, nivel `COM` y tipo_abonado `RES`, **Cuando** el operador pulsa *Guardar caso*, **Entonces** el sistema crea el caso con `id_averia = MAN-0001`.
2. **Dado** un maestro que ya contiene `MAN-0001` y `MAN-0002`, **Cuando** el operador da de alta un caso nuevo, **Entonces** el sistema rechaza `MAN-0001`, informa «El id MAN-0001 ya existe; se sugiere MAN-0003» y crea el caso con `MAN-0003`.
3. **Dado** el formulario con `direccion` vacía, **Cuando** el operador pulsa *Guardar caso*, **Entonces** el sistema muestra «Complete: dirección» y no crea ningún registro ni consume consecutivo.
4. **Dado** el formulario con `sector = 7` cuando `sectores.json` solo tiene los sectores 1 a 6, **Cuando** el operador guarda, **Entonces** el sistema muestra «El sector 7 no existe en `sectores.json`» y no crea el caso.
5. **Dado** un caso creado manualmente, **Cuando** se lee `averias.json`, **Entonces** el registro tiene `ingreso = 13/09/2026`, `status = GESTION`, `clase = REP`, `nivel = COM`, `sector` informado y `usuario_modificacion` con el P00 de la sesión, y `historial.jsonl` contiene la línea de alta del caso con `accion = ingesta` y su `id_averia = MAN-0001`. [D-56]
5b. **Dado** que el operador abrió el formulario con `averias.json` en `fecha_modificacion = 13/09/2026 09:00` y el maestro fue modificado a las 09:20 por `12345`, **Cuando** el operador pulsa *Guardar caso*, **Entonces** el sistema no escribe, no consume el consecutivo `MAN-`, conserva los datos en el formulario, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 09:20. Recargue o sobrescriba» y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
6. **Dado** el formulario de alta, **Cuando** el operador lo abre, **Entonces** los campos mostrados son exactamente los 11 de la lista cerrada de D-18 —**sin Tipo, Actividad ni Agente** (D-47)— y no hay ningún campo libre fuera de ella. [D-18, D-47]
7. **Dado** un caso manual `MAN-0001`, **Cuando** se ejecuta la ingesta del CSV del día, **Entonces** el caso manual no se modifica ni se duplica.
8. **Dado** una sesión de operador de la cuadrilla `C1` y el formulario completo del criterio 1, **Cuando** el operador pulsa *Guardar caso*, **Entonces** el registro `MAN-0001` de `averias.json` queda con `Reparador Principal = C1` y `fecha_asignacion = 13/09/2026`, y al abrir CASOS el operador **ve el caso** dentro del filtro de su cuadrilla. [D-37, D-48, RNF-12]
9. **Dado** una sesión de operador **sin cuadrilla asignada**, **Cuando** da de alta un caso, **Entonces** el caso queda con `Reparador Principal` y `fecha_asignacion` **vacíos**, el sistema muestra «Caso creado sin cuadrilla: visible en solo lectura hasta el despacho» y el caso aparece en el grupo «Sin asignar» de CU-18 sin distorsionar los totales por cuadrilla. [D-48]
10. **Dado** una sesión **sin identificación válida**, **Cuando** se intenta abrir el bloque *Nuevo caso*, **Entonces** el sistema no muestra el formulario, no lee `sectores.json` y responde «Identifíquese para editar». [D-50, RNF-08]

**Restricciones del sistema (EARS)**

- **Cuando** el operador confirme un alta manual, el sistema deberá generar el `id_averia` con el patrón `MAN-` + consecutivo y comprobar su unicidad antes de escribir. [D-18, RN-01]
- **El sistema deberá** inicializar `usuario_modificacion` con el `P00` de la sesión y `fecha_modificacion` con la fecha y hora del alta (caso de inicialización **manual**, distinto de la ingesta, que los inicializa con la col. 20 y la fecha de ingesta por D-52/D-53). [D-16, D-52, RNF-09]
- **Si** el `id_averia` candidato ya existe en el maestro o colisiona con el espacio `MAN-` del CSV, entonces el sistema deberá rechazar ese valor y sugerir el siguiente consecutivo libre en lugar de reutilizarlo. [D-18, RNF-04, H-09]
- **Si** un campo obligatorio falta o un enum es inválido, entonces el sistema deberá rechazar el alta sin escribir el archivo. [RNF-10]
- **Si** el `sector` no existe en `sectores.json`, entonces el sistema deberá rechazar el alta. [RNF-10, D-20]
- **El sistema deberá** registrar el operador y la fecha/hora de creación del caso y **añadir** a `historial.jsonl` su línea de alta con `accion = ingesta`. [RNF-09, **D-56**]
- **El sistema deberá** limitar el formulario a la lista cerrada de campos definida en D-18, **sin incorporar Tipo, Actividad ni Agente** del fuente. [D-18, D-47]
- **Cuando** el alta se confirme, el sistema deberá escribir `Reparador Principal` = `id` de la cuadrilla de la sesión y `fecha_asignacion` = fecha del alta —o ambos vacíos si la sesión no tiene cuadrilla— **antes** de confirmar en pantalla, para que el caso quede dentro del ámbito de visibilidad del rol que lo creó. [D-37, D-48, RNF-12]
- **Si** la sesión no tiene un rol autorizado por la matriz de §2.1 para el alta manual, entonces el sistema deberá rechazarla sin escribir el maestro y **anotar el intento** con operador y fecha/hora en el **log de la aplicación** (§1.20, D-58). [D-35, RNF-12, **D-58**]
- **Mientras** no exista una identificación válida, el sistema deberá mantener oculto el bloque *Nuevo caso* y bloqueada toda lectura de padrones y toda escritura del maestro. [D-50, RNF-08]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]
- **Cuando** confirme un alta manual, el sistema deberá copiar el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribir en un archivo temporal, **releerlo y compararlo** y **solo entonces** confirmar; si falla, deberá restaurar el respaldo, avisar y **no** confirmar. [D-42, RNF-15]

---

### CU-15 — Consultar la auditoría de cambios de un caso

- **Actor principal:** Supervisor (función administrativa; la consulta de auditoría es de su rol, D-35).
- **Actores secundarios:** Ninguno. El actor «auditoría / control interno» está **retirado (D-55)**: la consulta de la auditoría de cambios la ejerce el supervisor.
- **Ciclo:** C1 (consulta de la auditoría del último cambio y de la secuencia de cambios del historial) / posterior (filtros y exportación de la vista).
- **Prioridad:** MVP (consulta del historial y del último cambio) / posterior (filtros y exportación).
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** —rol leído del campo `rol` de `tecnicos.json` (**D-61**), que es lo que habilita la consulta de auditoría— (D-35, RNF-12); existe `C:\GGTO\datos\historial.jsonl` con al menos una línea del caso consultado (archivo JSON Lines *append-only*, D-56); el caso tiene `usuario_modificacion` y `fecha_modificacion` informados y, **si se ingirió de un CSV**, `usuario_modificacion` quedó inicializado con la **col. 20** (`ultimo_usuario`) y `fecha_modificacion` con la **fecha de ingesta** (D-52, D-53); las columnas **53 y 80 no se persisten** y **no se muestran** (D-53).

> **Ya no hay pendiente de historial (D-56).** El **historial inmutable** quedó decidido: cada cambio de un caso **añade** una línea a `historial.jsonl` y **nada se borra ni se sobrescribe**. Esta consulta **lee ese archivo**; el maestro sigue aportando además el **último** cambio (`usuario_modificacion`, `fecha_modificacion`). Con ello queda cerrado **H-10** (historial de valores anteriores, D-56) y se completa **RNF-09**.

- **Postcondiciones:** el supervisor conoce quién cambió el caso, cuándo y qué valores cambiaron —el **último** cambio desde el maestro y la **secuencia completa** desde `historial.jsonl`—, sin alterar el maestro ni el historial.

**Trazabilidad:** RF-23, RF-24; RNF-08, RNF-09, **RNF-12, RNF-14**; RT-01; D-16, D-28, D-35, **D-41, D-49, D-50, D-52, D-53, D-55, D-56, D-61, D-64**; H-10, H-29.

**Flujo principal**

1. El supervisor abre el flotante de detalle de un caso (CU-11) y pulsa *Ver auditoría*.
2. El sistema muestra la sección **Auditoría** con: `usuario_modificacion` y `fecha_modificacion` del **último** cambio, los valores vigentes de `status`, `clase`, `nivel` y `tipo_abonado`, y —solo si el caso se ingirió de un CSV— el **rastro de origen limitado a la col. 20**: la etiqueta «Origen del dato: &lt;ultimo_usuario&gt;», que es el valor con el que CU-08 inicializó `usuario_modificacion`, más la fecha de ingesta en `fecha_modificacion`. Las columnas **53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) no se persisten y no se muestran** (D-53).
3. El supervisor solicita el historial de cambios del caso.
4. El sistema **lee `C:\GGTO\datos\historial.jsonl`** (JSON Lines, *append-only*), filtra las líneas cuyo `id_averia` coincide con el caso y muestra la **secuencia de cambios** ordenada por `fecha_hora`, con una fila por línea: **fecha/hora, operador, campo, valor anterior y valor nuevo** (y la `accion`: `edicion`, `cierre`, `reapertura`, `asignacion` o `ingesta`). El maestro sigue aportando además el **último** cambio. [D-56, RNF-09]
5. El supervisor aplica el filtro por rango de fechas y por operador sobre los cambios disponibles —comparación de **texto** en formato fijo `DD/MM/AAAA`, **nunca** un rango calculado sobre `fecha_modificacion`, que el diccionario declara TEXTO (H-29)— y exporta la vista en pantalla o la imprime.

**Flujos alternativos**

- **2a. El caso nunca fue modificado.** El sistema muestra «Sin cambios posteriores a la ingesta» e indica la fecha de ingesta; si el caso se ingirió del CSV, muestra además su línea de ingesta (`accion = ingesta`) y, si existe, el usuario de origen del CSV.
- **4a. `historial.jsonl` ausente o sin líneas del caso.** El sistema muestra «Historial no disponible para &lt;id_averia&gt;: falta `C:\GGTO\datos\historial.jsonl`» o «Sin cambios registrados para este caso», muestra el **último** cambio del maestro y **no inventa** ninguna fila ni valor anterior. [D-56]
- **4b. Línea ilegible o JSON inválido en `historial.jsonl`.** El sistema **omite** esa línea de la vista, informa «N líneas del historial no se pudieron leer» e indica que las líneas válidas se conservan íntegras: el archivo **no se reescribe ni se borra** para «arreglarlo». [D-56]
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra la sección de auditoría y responde «Acción no permitida para su rol», registrando el intento. [D-35, RNF-12]
- **2b. El maestro cambió durante la consulta (concurrencia, D-41).** Si entre la apertura del flotante y la pulsación de *Ver auditoría* la marca de modificación de `averias.json` cambió, el sistema **no muestra cifras obsoletas**: avisa «El maestro cambió durante la consulta: modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;» y ofrece *Recargar* para volver a leer el rastro actualizado **y el historial**. [D-41, RNF-14]

**Criterios de aceptación (Gherkin)**

1. **Dado** un caso modificado por el operador `12345` el `13/09/2026 09:14`, **Cuando** el supervisor abre *Ver auditoría*, **Entonces** el sistema muestra el `usuario_modificacion = 12345` y la `fecha_modificacion = 13/09/2026 09:14` del **último** cambio, y la secuencia leída de `historial.jsonl` incluye la línea de ese cambio.
2. **Dado** el caso `X` cuyo `status` se editó **dos veces** —de `GESTION` a `PEND` a las 09:10 y de `PEND` a `CERRADO` a las 10:05, ambas por el operador `12345`—, con las dos líneas correspondientes en `historial.jsonl`, **Cuando** el supervisor consulta la auditoría de `X`, **Entonces** la vista muestra **exactamente 2 líneas** de `campo = status` para ese `id_averia`, con (`valor_anterior = GESTION`, `valor_nuevo = PEND`) y (`valor_anterior = PEND`, `valor_nuevo = CERRADO`), su operador y su fecha/hora, y **ninguna** línea de otro `id_averia`. [D-56, RNF-09]
3. **Dado** un caso ingerido con `ultimo_usuario = JPEREZ` (col. 20), `usuario_acciona = MGOMEZ` (col. 53) y `Fecha Hora Asignacion = 12/09/2026 08:15` (col. 80), **Cuando** el supervisor abre *Ver auditoría*, **Entonces** el sistema muestra la etiqueta «Origen del dato: JPEREZ» —igual a `usuario_modificacion` inicializado por la ingesta (D-52, D-53)— y la vista **no** contiene las cadenas `MGOMEZ` ni `12/09/2026 08:15` en ninguna parte. [D-53, H-N-01]
4. **Dado** un caso recién ingerido y nunca editado, **Cuando** el supervisor abre *Ver auditoría*, **Entonces** el sistema muestra «Sin cambios posteriores a la ingesta», la fecha de ingesta y, si existe, la línea de ingesta del caso (`accion = ingesta`).
5. **Dado** un caso cerrado con resolución `COS`, **Cuando** el supervisor consulta la auditoría, **Entonces** el sistema muestra la línea de `status` a `CERRADO` con operador y fecha/hora y `accion = cierre`.
6. **Dado** que el supervisor consulta la auditoría, **Cuando** cierra la vista, **Entonces** `averias.json` no cambia (misma fecha de modificación, mismo contenido) **y `historial.jsonl` conserva exactamente las mismas líneas, en el mismo orden y con el mismo tamaño** (la consulta solo lee). [D-56]
7. **Dado** un historial con 3 cambios del operador `12345` en fechas `01/09/2026`, `05/09/2026` y `20/09/2026`, **Cuando** el supervisor filtra por operador `12345` y rango `01/09/2026` a `13/09/2026`, **Entonces** la vista muestra **2 filas** —las de `01/09/2026` y `05/09/2026`— con las columnas `operador`, `fecha_hora`, `campo`, `valor_anterior` y `valor_nuevo`, y excluye la de `20/09/2026` por comparación de texto en formato `DD/MM/AAAA`. [H-29]
8. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir *Ver auditoría*, **Entonces** el sistema responde «Acción no permitida para su rol» y no muestra el historial. [D-35, RNF-12]
9. **Dado** el flotante de auditoría abierto con `fecha_modificacion = 13/09/2026 09:14`, **Cuando** otro usuario modifica el caso a las 09:25 y el supervisor pulsa *Ver auditoría*, **Entonces** el sistema avisa «El maestro cambió durante la consulta: modificado por 12345 el 13/09/2026 09:25» y ofrece *Recargar*, sin mostrar como vigente el rastro anterior. [D-41, RNF-14]

**Restricciones del sistema (EARS)**

- **Cuando** se modifiquen `status`, `clase`, `nivel`, `tipo_abonado`, `sector`, `Reparador Principal`, `sacas` u `observaciones`, el sistema deberá **añadir** a `historial.jsonl` la línea del campo cambiado con `fecha_hora`, `operador` (`P00`), `id_averia`, `campo`, `valor_anterior`, `valor_nuevo` y `accion`, además de registrar el operador y la fecha/hora en el maestro. [RNF-09, D-16, **D-56**]
- **El sistema no deberá** modificar ni borrar ninguna línea de `historial.jsonl`: la única operación permitida sobre ese archivo es **añadir al final** (*append-only*). [**D-56**, RNF-09]
- **El sistema deberá** leer `historial.jsonl` para la auditoría y mostrar por caso la secuencia de cambios —fecha/hora, operador, campo, valor anterior y valor nuevo—, además del **último** cambio que conserva el maestro. [**D-56**, RNF-09]
- **El sistema deberá** conservar el rastro de origen de la ingesta **limitado a la col. 20** (`ultimo_usuario`, que inicializa `usuario_modificacion`) y a la fecha de ingesta; las columnas **53 y 80 no se persisten** y **no deberá** mostrarlas ni prometerlas. [D-52, D-53, H-N-01]
- **El sistema deberá** comparar las fechas de `fecha_modificacion` y de los campos de fecha del historial como **texto** en formato fijo `DD/MM/AAAA` (o `DD/MM/AAAA hh:mm`); **no deberá** aplicar filtros por rango de fechas calculados sobre un campo declarado TEXTO. [H-29]
- **Si** una línea de `historial.jsonl` no se puede leer, entonces el sistema deberá omitirla de la vista, informar cuántas líneas fallaron y **conservar intactas** las demás: nunca reescribirá el archivo para «repararlo». [D-56]
- **Si** la sesión no tiene el rol supervisor —rol que se lee del campo `rol` de `tecnicos.json` (**D-61**)—, entonces el sistema deberá denegar la consulta de auditoría y **anotar el intento** en el **log de la aplicación** (§1.20): `datos/incidencias.log`, con fecha y hora, el `P00` de la sesión y el motivo «Acción no permitida para su rol», **sin datos personales** y con la rotación de **5 MB × 5 archivos** de **D-64**; `historial.jsonl` **no** registra denegaciones. [D-35, RNF-12, **D-58, D-61, D-64**]
- **El sistema deberá** conservar el caso, su rastro y el historial sin purga automática y sin plazo de caducidad, con la **ficha de tratamiento de datos personales (D-28)** como documento de finalidad —responsable, base de licitud y canal del titular— y con la copia fechada del cierre de jornada `averias_AAAA-MM-DD_HHMM.json` **junto con `historial.jsonl`** en `C:\GGTO\respaldo\` como respaldo documental (D-49, D-56, RNF-16). [D-28, D-49, H-N-10]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-16 — Generar y ajustar el despacho del día

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actores secundarios:** Operador de la central (prepara los datos); cuadrillas (destinatarias).
- **Ciclo:** C4. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12); casos abiertos en `averias.json` con `sector` asignado; `cuadrillas.json` con cuadrillas activas y sus sectores preferentes; los «citados del día» se determinan con `fecha_cita` (col. 19 del CSV, D-30) sin selector manual.
- **Postcondiciones:** el despacho del día queda armado por cuadrilla, con las reglas de reparto verificadas, la asignación persistida en `averias."Reparador Principal"` (D-37) y `averias.fecha_asignacion` con la fecha de la **última** asignación (D-48), y el registro del día escrito en `despacho.json` con `sector`, `Reparador Principal` y `fecha_despacho` (D-31, RT-05).

**Trazabilidad:** RF-08, RF-09, RF-20; RN-05, RN-06; RNF-01, RNF-10, RNF-11, **RNF-12, RNF-14, RNF-15**; RT-05; D-07, D-25, **D-30, D-31, D-32, D-35, D-37, D-41, D-42, D-48, D-55, D-56**; H-04, H-24, H-28.

**Flujo principal**

1. El supervisor abre la pestaña **DESPACHO** y pulsa *Generar despacho del día*.
2. El sistema toma los casos abiertos (abierto = `status` distinto de `CERRADO`) y extrae `id_averia, telefono, persona_reporta, contacto, nombre, direccion, fat, plan, serial` junto con `sector` y `Reparador Principal`.
3. El sistema agrupa los casos por sector y propone una cuadrilla a cada grupo usando `sectores.cuadrilla_sugerida` y los sectores preferentes de `cuadrillas.json`.
4. El sistema **incorpora con prioridad los casos citados del día** —aquellos cuyo `fecha_cita` (col. 19 del CSV) coincide con la fecha del despacho, D-30— y los marca como **CITADO** en la propuesta y en el despacho; no existe selector manual de citados.
5. El sistema verifica las reglas de reparto y marca el resultado por cuadrilla: citados del día incluidos, ≥1 reparación de referidos (`nivel = REF`, `clase = REP`) y ≥1 reparación de empresas (`tipo_abonado = EMP`, `clase = REP`).
6. El sistema asigna la construcción (`clase = CNS`) a **una sola** cuadrilla: la que tenga reparaciones en el mismo sector, desempatando según D-32 (zona preferente → menor carga del día → `id` menor).
7. El sistema muestra la propuesta por cuadrilla con los incumplimientos señalados.
8. El supervisor ajusta manualmente asignaciones entre cuadrillas hasta que no queden incumplimientos; cada cambio queda registrado con operador y fecha/hora.
9. El supervisor pulsa *Confirmar despacho*; el sistema escribe `Reparador Principal` **y `fecha_asignacion` = fecha del despacho** en cada caso de `averias.json` (D-48: es la fecha de la **última** asignación de cuadrilla y de ella sale la métrica «asignados por día» de MONITOREO), escribe el registro del día en `despacho.json` con `sector`, `Reparador Principal` y `fecha_despacho` (D-31) y **verifica la escritura del maestro según D-42** (respaldo `.bak`, temporal, relectura y comparación) antes de mostrar «Despacho confirmado: N casos en K cuadrillas». Cada caso asignado **añade a `historial.jsonl`** la línea `campo = Reparador Principal` con su valor anterior, su valor nuevo y `accion = asignacion` (D-56).
10. El sistema deja disponible el despacho confirmado para el PDF por cuadrilla (CU-17).

**Flujos alternativos**

- **2a. No hay casos abiertos.** El sistema muestra «No hay casos abiertos para despachar» y no genera propuesta.
- **4a. Alguna cuadrilla no recibe referidos o empresas.** El sistema marca la cuadrilla en rojo con «Sin reparación de referidos» y/o «Sin reparación de empresas» y exige resolverlo o justificarlo antes de confirmar. [RN-05]
- **6a. Varias cuadrillas tienen reparaciones en el sector de la construcción (D-32).** El sistema propone **primero la cuadrilla que tenga ese sector como zona preferente en `cuadrillas.sectores`**; **si hay varias o ninguna**, propone la de **menor carga del día** y, **si persiste el empate, la de `id` menor**. El supervisor puede cambiarla manualmente y el cambio queda **registrado con operador y fecha/hora**. [D-32]
- **4b. Casos citados del día (D-30).** El sistema incluye automáticamente en el despacho, con prioridad y marca **CITADO**, todos los casos abiertos cuyo `fecha_cita` (col. 19) sea igual a la fecha del despacho; no hay selector manual. Si el CSV del día no trae `fecha_cita` para ningún caso, el sistema informa «Sin citados para el DD/MM/AAAA» y continúa. [D-30]
- **9a. Fallo de escritura.** El sistema no confirma, mantiene la propuesta en pantalla y ofrece *Reintentar*. [CU-21]
- **8a. El supervisor quita todos los casos de una cuadrilla activa.** El sistema avisa «La cuadrilla C2 queda sin casos» y exige confirmación para dejarla fuera del despacho.
- **9b. Registro del despacho del día (D-31, D-37).** Al confirmar, el sistema persiste la asignación en `averias."Reparador Principal"` **y** escribe `despacho.json` ampliado con `sector`, `Reparador Principal` y `fecha_despacho`; el agrupamiento del despacho **no** se calcula solo en memoria. [D-31, RT-05]
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra la pestaña DESPACHO ni permite generar o ajustar la propuesta, y registra el intento. [D-35, RNF-12]
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.

**Criterios de aceptación (Gherkin)**

1. **Dado** 60 casos abiertos distribuidos en 4 sectores y 3 cuadrillas activas, **Cuando** el supervisor pulsa *Generar despacho del día*, **Entonces** el sistema presenta los 60 casos agrupados por sector con una cuadrilla propuesta para cada grupo.
2. **Dado** un despacho propuesto con la cuadrilla `C1` sin ninguna reparación de referidos, **Cuando** el supervisor intenta confirmar, **Entonces** el sistema muestra «C1: sin reparación de referidos» y no permite confirmar hasta resolverlo o justificarlo.
3. **Dado** 3 casos con `clase = CNS` en el sector `1` y 2 cuadrillas con reparaciones en el sector `1` (ninguna con el sector `1` como zona preferente, cargas de 9 y 12 casos), **Cuando** el sistema propone el reparto, **Entonces** los 3 casos de construcción quedan en **una sola** cuadrilla, la de menor carga (la de 9 casos). [D-32]
4. **Dado** el mismo escenario con las dos cuadrillas empatadas en 9 casos y con `id` `C1` y `C4`, **Cuando** el sistema propone el reparto, **Entonces** asigna la construcción a la cuadrilla `C1` (el `id` menor). [D-32]
5. **Dado** que el sector `1` es zona preferente de la cuadrilla `C3` y hay otra cuadrilla con reparaciones en ese sector, **Cuando** el sistema propone el reparto, **Entonces** la construcción queda en `C3` por zona preferente. [D-32]
6. **Dado** un despacho propuesto donde el supervisor cambia manualmente la cuadrilla de la construcción de `C3` a `C2`, **Cuando** confirma, **Entonces** el cambio queda registrado con el P00 del supervisor y la fecha/hora.
7. **Dado** 4 casos abiertos con `fecha_cita = 13/09/2026` y el despacho del `13/09/2026`, **Cuando** el supervisor genera el despacho, **Entonces** los 4 casos entran con prioridad y quedan marcados **CITADO**, sin que el supervisor los seleccione a mano. [D-30]
8. **Dado** un despacho confirmado con 45 casos en 3 cuadrillas, **Cuando** el sistema persiste, **Entonces** `averias.json` releído contiene `Reparador Principal` informado en los 45 casos, `despacho.json` contiene 45 registros con `sector`, `Reparador Principal` y `fecha_despacho`, el filtro por cuadrilla de CU-10 los encuentra y `historial.jsonl` gana **45 líneas** de `campo = Reparador Principal` con `accion = asignacion` (una por caso asignado). [D-56]
8b. **Dado** que el supervisor cargó el despacho con `averias.json` en `fecha_modificacion = 13/09/2026 11:00` y el maestro fue modificado a las 11:05 por `12345`, **Cuando** el supervisor pulsa *Confirmar despacho*, **Entonces** el sistema **no escribe** `averias.json` ni `despacho.json`, mantiene la propuesta en pantalla, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 11:05. Recargue o sobrescriba» y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
9. **Dado** un caso con `Reparador Principal` vacío antes del despacho, **Cuando** se confirma el despacho, **Entonces** ese caso queda asignado a una cuadrilla y deja de contar como «sin asignar» en MONITOREO.
10. **Dado** el despacho del día ya confirmado, **Cuando** el supervisor abre DESPACHO de nuevo, **Entonces** el sistema muestra la asignación vigente y permite modificarla antes de emitir los PDF.
8c. **Dado** un maestro de 300 casos abiertos y un despacho confirmado que asigna 45, **Cuando** el supervisor pulsa *Confirmar despacho*, **Entonces** el sistema deja `averias_AAAA-MM-DD_HHMM.bak` con los 300 casos previos, escribe en el archivo temporal, **relee y compara** el contenido (300 registros, texto idéntico) y **solo entonces** muestra «Despacho confirmado: 45 casos en 3 cuadrillas»; si la comparación falla, restaura el `.bak`, avisa y no confirma. [D-42, RNF-15]
11. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir DESPACHO, **Entonces** el sistema responde «Acción no permitida para su rol» y `averias.json` y `despacho.json` no cambian.

**Restricciones del sistema (EARS)**

- **El sistema deberá** agrupar el despacho por sector y por `Reparador Principal` sobre los casos abiertos. [RF-08, RF-20, L44]
- **Cuando** existan casos con `fecha_cita` igual a la fecha del despacho, el sistema deberá incorporarlos con prioridad y marcarlos como CITADO, sin selector manual. [D-30, RN-05]
- **Si** existen casos `clase = CNS`, entonces el sistema deberá asignarlos a una única cuadrilla con reparaciones en ese sector, desempatando por zona preferente en `cuadrillas.sectores`, luego por menor carga del día y luego por `id` menor. [RN-06, D-32]
- **Cuando** el supervisor cambie manualmente una asignación de la construcción, el sistema deberá registrar el operador y la fecha/hora del cambio. [D-32, RNF-09]
- **Mientras** una cuadrilla no tenga al menos una reparación de referidos y una de empresas, el sistema deberá señalar el incumplimiento antes de permitir la confirmación. [RN-05]
- **Cuando** el despacho se confirme, el sistema deberá persistir la asignación en `averias."Reparador Principal"`, escribir el registro del día en `despacho.json` con `sector`, `Reparador Principal` y `fecha_despacho`, y releer ambos archivos. [RN-07, D-31, D-37]
- **El sistema deberá** registrar operador y fecha/hora de la confirmación y de cada ajuste manual del despacho, y **añadir** a `historial.jsonl` la línea `Reparador Principal` de cada caso asignado con `accion = asignacion`. [RNF-09, RNF-11, **D-56**]
- **Cuando** confirme el despacho, el sistema deberá escribir `fecha_asignacion` en cada caso asignado con la fecha del día del despacho (fecha de la **última** asignación de cuadrilla), para alimentar la métrica «asignados por día» de la zona CUADRILLA del MONITOREO sin archivos de despacho por fecha. [D-48]
- **Cuando** vaya a escribir el maestro, el sistema deberá copiarlo antes a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribir en un archivo temporal, **releerlo y compararlo** y **solo entonces** confirmar; si falla, deberá restaurar el respaldo, avisar y **no** confirmar. [D-42, RNF-15]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar la generación y la confirmación del despacho sin modificar los archivos. [D-35, RNF-12]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-17 — Emitir el PDF de despacho por cuadrilla y registrar la entrega

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actores secundarios:** Cuadrilla / técnico de calle (recibe la hoja). El control documental del despacho lo ejerce el supervisor; el actor «auditoría / control interno» está **retirado (D-55)**.
- **Ciclo:** C4. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12); despacho del día confirmado (CU-16) y registrado en `despacho.json` con `sector`, `Reparador Principal` y `fecha_despacho`; impresora con papel carta disponible; `pdf.js` disponible en `lib/`.
- **Postcondiciones:** existe un PDF por cuadrilla en carta horizontal con las **15 columnas canónicas de despacho** (D-31) y la marca de fecha, cuadrilla y número de copia; la entrega queda registrada y las hojas se **recogen y destruyen** al cierre del día, con su asiento (D-27).

**Trazabilidad:** RF-10, RF-20; RNF-05, RNF-11, **RNF-12**; RT-05, RT-07; D-27, **D-31, D-35, D-37, D-55**; H-12, H-24.

**Flujo principal**

1. El supervisor abre la pestaña **DESPACHO** con el despacho del día confirmado y pulsa *PDF por cuadrilla*.
2. El sistema construye la proyección desde `despacho.json` con las **15 columnas canónicas**: `nivel, clase, id_averia, telefono, persona_reporta, contacto, ultimo_comentario, nombre, direccion, plan, fat, serial, sector, Reparador Principal, fecha_despacho` (D-31, RT-05, D-37).
3. El sistema genera un PDF por cuadrilla activa con casos asignados, en hoja carta **horizontal**, respetando el área máxima imprimible y paginando cuando el volumen lo exige.
4. El sistema imprime en cada hoja el encabezado con fecha del día, `id` y nombre de la cuadrilla, y el **número de copia**.
5. El sistema guarda los PDF en la ruta controlada definida para el proyecto (no en la carpeta de Descargas) y muestra la lista de archivos generados.
6. El supervisor imprime las hojas y las entrega a cada cuadrilla; en la página pulsa *Registrar entrega* por cuadrilla.
7. El sistema asienta la entrega con fecha, hora, cuadrilla, número de copia y operador, y muestra el estado «Entregado» por cuadrilla.
8. Al cierre de la jornada, el supervisor pulsa *Recoger hojas*; el sistema asienta la recogida, muestra «Hojas recogidas: 3 de 3 cuadrillas» y **solicita el número de hojas destruidas por cuadrilla**. Al confirmarlo, el sistema asienta la **destrucción** con fecha, hora, cuadrilla, número de copia y operador, muestra «Hojas destruidas: 3 de 3 cuadrillas» y deja el control documental del día cerrado. [D-27, RNF-11]

**Flujos alternativos**

- **3a. Una cuadrilla tiene 0 casos.** El sistema no genera PDF para esa cuadrilla y lo informa en la lista.
- **3b. El volumen de una cuadrilla excede una hoja.** El sistema pagina el contenido y numera las hojas con «Hoja X de Y» conservando fecha, cuadrilla y número de copia en cada hoja. [RNF-05]
- **5a. Fallo de escritura del PDF.** El sistema muestra «No se pudo guardar el PDF de la cuadrilla C2» y permite reintentar por cuadrilla sin regenerar las demás.
- **7a. Una cuadrilla no recibe su hoja.** El sistema mantiene el estado «Pendiente de entrega» y no permite dar el despacho por cerrado hasta registrarlo o justificarlo. [RNF-11]
- **8a. Faltan hojas al cierre.** El sistema muestra «Faltan hojas: C3» y registra la incidencia con fecha, hora y operador; no permite registrar la destrucción de una cuadrilla cuya hoja no se recogió. [D-27, H-12]
- **8b. Hojas recogidas pero no destruidas.** Si el supervisor registra la recogida y el número de hojas destruidas es menor que el de hojas entregadas, el sistema muestra «Pendiente de destruir: N hojas» y **no da el despacho del día por cerrado** hasta completar la destrucción o justificar la incidencia con operador y fecha/hora. [D-27, H-N-09]
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra DESPACHO ni permite generar PDF o registrar entregas, y registra el intento. [D-35, RNF-12]

**Criterios de aceptación (Gherkin)**

1. **Dado** un despacho confirmado con 3 cuadrillas activas, **Cuando** el supervisor pulsa *PDF por cuadrilla*, **Entonces** el sistema genera **3 archivos PDF**, uno por cuadrilla.
2. **Dado** el PDF de la cuadrilla `C1` con 18 casos, **Cuando** se abre el archivo, **Entonces** contiene **las 15 columnas** `nivel, clase, id_averia, telefono, persona_reporta, contacto, ultimo_comentario, nombre, direccion, plan, fat, serial, sector, Reparador Principal, fecha_despacho` y cabe en una hoja carta horizontal, con el encabezado «Fecha 13/09/2026 — Cuadrilla C1 — Copia 1».
3. **Dado** el PDF de la cuadrilla `C2` con 60 casos, **Cuando** se abre, **Entonces** el contenido está paginado y cada hoja repite fecha, cuadrilla y número de copia con la marca «Hoja X de Y».
4. **Dado** que el supervisor pulsa *Registrar entrega* para `C1` y `C2`, **Cuando** consulta el estado del despacho, **Entonces** el sistema muestra `C1: Entregado`, `C2: Entregado` y `C3: Pendiente de entrega`.
5. **Dado** el despacho del día con 3 cuadrillas entregadas, **Cuando** el supervisor pulsa *Recoger hojas* y solo registra 2, **Entonces** el sistema muestra «Faltan hojas: C3» y asienta la incidencia con fecha, hora y operador.
5b. **Dado** el despacho del día con 3 cuadrillas entregadas y recogidas, **Cuando** el supervisor registra la destrucción de las 3 hojas, **Entonces** el sistema muestra «Hojas destruidas: 3 de 3 cuadrillas» y el asiento de la destrucción queda con fecha, hora, cuadrilla, número de copia y P00 del supervisor. [D-27, H-N-09]
5c. **Dado** el mismo despacho con 3 hojas entregadas y solo 2 destruidas, **Cuando** el supervisor intenta cerrar el control documental del día, **Entonces** el sistema muestra «Pendiente de destruir: 1 hoja» y no da el día por cerrado. [D-27, H-N-09]
6. **Dado** un PDF generado, **Cuando** se revisa su ruta, **Entonces** el archivo está en la ruta controlada del proyecto y no en la carpeta de Descargas del puesto.
7. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir la emisión de PDF, **Entonces** el sistema responde «Acción no permitida para su rol» y no genera ningún archivo.

**Restricciones del sistema (EARS)**

- **Cuando** el supervisor solicite el PDF, el sistema deberá generar un archivo por cuadrilla en orientación carta horizontal, ajustado al área máxima imprimible. [RF-10, RNF-05]
- **El sistema deberá** proyectar el PDF desde `despacho.json` con las 15 columnas canónicas `nivel, clase, id_averia, telefono, persona_reporta, contacto, ultimo_comentario, nombre, direccion, plan, fat, serial, sector, Reparador Principal, fecha_despacho`. [D-31, RT-05, RF-20]
- **El sistema deberá** imprimir fecha, cuadrilla y número de copia en todas las hojas de cada PDF. [D-27, RNF-11]
- **Si** el volumen de una cuadrilla excede una hoja, entonces el sistema deberá paginar repitiendo la marca de control documental en cada hoja. [RNF-05, D-27]
- **El sistema deberá** asentar la entrega, la recogida **y la destrucción** de las hojas con fecha, hora, cuadrilla, número de copia y operador; ninguna hoja entregada puede quedar sin constancia de destrucción al cierre del día. [RNF-11, D-27, H-N-09]
- **El sistema deberá** guardar los PDF en una ruta controlada y no en la carpeta de Descargas. [D-27, H-12]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar la emisión del PDF y el registro de entrega. [D-35, RNF-12]

---

### CU-18 — Monitorear la gestión diaria y semanal

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actor secundario:** Operador de la central (alimenta los datos con su gestión). El «jefe de central» está **retirado (D-55)**: las cifras las consume el supervisor.
- **Ciclo:** C5. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12); `averias.json` con casos de la semana en curso y de la semana anterior, y con `sector` y `Reparador Principal` informados en la mayoría de los casos; definiciones de métrica acordadas según D-34 (semana operativa lunes a sábado, Sem 1 a Sem 36).
- **Postcondiciones:** las 6 zonas de MONITOREO muestran gráfico y tabla descriptiva, incluida la **Gestión Semanal estadística** de D-34 (ingreso del día vs. reparadas del día con la línea del pendiente al cierre de cada día, agrupada por semana del año y con selector **Sem 1 a Sem 36**); ninguna consulta modifica los datos.

**Trazabilidad:** RF-05, RF-06, RF-25; RN-08; RNF-02, RNF-06, RNF-07, **RNF-08, RNF-12, RNF-13**; S-RNF-02b; D-17, D-23, D-24, **D-34, D-35, D-40, D-48, D-50, D-55**; H-16, H-28.

**Flujo principal**

1. El supervisor abre la pestaña **MONITOREO**.
2. El sistema calcula y dibuja las 6 zonas con gráfico y tabla descriptiva: **Gestión Diario** (ingreso nuevo, resuelto residencial, resuelto empresarial, resuelto referidos), **Gestión Semanal** (curva de lunes a sábado), **Casos Globales** (pendiente vs. resuelto), **Reparación** (pendientes por tipo: residenciales comunes, residenciales referidos, empresariales), **Construcción** (pendientes residenciales y empresariales) y **Cuadrilla** (asignados por día —de `fecha_asignacion`, D-48— vs. cerrados vs. gestionados por día).
3. El sistema muestra la fecha de corte y el rango de la semana operativa (lunes a sábado) usados en el cálculo.
4. El supervisor cambia la fecha de corte y el sistema recalcula las 6 zonas.
5. El supervisor abre la pestaña **GRAFICOS** y el sistema presenta las mismas 6 zonas como gráficos dedicados: barras (diario, globales, construcción, cuadrilla), **barras + línea** para la semanal (barras de ingreso vs. reparadas por día y línea del pendiente al cierre de cada día) y torta (reparación). [D-34]
6. El supervisor pasa el cursor sobre una barra o segmento y el sistema muestra el valor exacto y el criterio de cálculo aplicado.

**Flujos alternativos**

- **2a. Maestro con 0 casos en el rango.** El sistema muestra los 6 gráficos vacíos con «Sin datos para el rango seleccionado» y el conteo en 0.
- **2b. Casos sin `sector` o sin `Reparador Principal`.** El sistema los agrupa bajo «Sin asignar» y muestra el conteo de excluidos por cada métrica afectada. [H-28]
- **2c. Casos sin `fecha_asignacion`.** Los casos que nunca han pasado por el despacho (o los ingeridos antes de D-48) no tienen `fecha_asignacion`: el sistema **no inventa** la cifra, los agrupa bajo «Sin asignar» y muestra la nota «Asignados: casos sin `fecha_asignacion` (no despachados)». El criterio de cálculo de «asignados por día» queda **cerrado por D-48**: se cuenta por la fecha de la **última** asignación de cuadrilla de cada caso. [D-48, H-28]
- **2d. Corte sobre un domingo.** Si el usuario elige como fecha de corte el domingo 13/09/2026, el sistema lo ajusta al **sábado 12/09/2026** de esa semana operativa, lo informa en pantalla («Corte ajustado al sábado 12/09/2026: la semana operativa es de lunes a sábado») y dibuja 6 puntos, ninguno del domingo. [RN-08, D-34, H-N-22]
- **4a. Fecha de corte fuera de la semana operativa.** El sistema ajusta el rango al lunes y sábado de la semana correspondiente y lo informa.
- **4b. Semana fuera del rango Sem 1 a Sem 36.** El sistema limita el selector a **Sem 1 a Sem 36**, avisa «Semana fuera de rango» y no dibuja la serie. [D-34]
- **5a. El navegador no soporta los gráficos locales.** El sistema muestra las tablas descriptivas sin gráfico y advierte «Gráficos no disponibles en este navegador». [RT-07]
- **1b. Apertura sin sesión o pérdida de la sesión (D-50, D-45).** Si la página se abre sin identificación válida, MONITOREO y GRAFICOS **no se renderizan**: no hay cifras, tablas ni gráficos a la vista, solo el diálogo de acceso. Si la sesión se cierra o expira (8 horas), el sistema **oculta los 6 gráficos y sus tablas**, vuelve al diálogo y exige reingreso antes de recalcular. [D-45, D-50, RNF-08]
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra MONITOREO ni GRAFICOS y registra el intento. [D-35, RNF-12]

**Criterios de aceptación (Gherkin)**

1. **Dado** un maestro con 1.000 casos, **Cuando** el supervisor abre MONITOREO, **Entonces** las 6 zonas se dibujan **en menos de 3 s** (punto de medida: desde el clic en la pestaña MONITOREO hasta que las 6 zonas quedan dibujadas). [RNF-02, D-24]
2. **Dado** un rango de corte en la semana operativa del **07/09/2026 (lunes) al 12/09/2026 (sábado)**, **Cuando** el supervisor abre GESTION SEMANAL, **Entonces** la curva muestra exactamente **6 puntos** fechados 07, 08, 09, 10, 11 y 12 de septiembre de 2026 y ningún punto del domingo 13/09/2026 (RN-08). [RN-08, H-N-22]
3. **Dado** 120 casos con `status = CERRADO`, `clase = REP` y `tipo_abonado = RES` **con `fechaResolucion` dentro de la fecha de corte mostrada**, **Cuando** el supervisor consulta GESTION DIARIO, **Entonces** la tabla muestra «Resuelto Residencial: 120» e indica el corte aplicado en pantalla.
4. **Dado** 8 casos con `tipo_abonado = EMP`, `status = CERRADO` **y `fechaResolucion` dentro del corte**, **Cuando** el supervisor consulta GESTION DIARIO, **Entonces** la tabla muestra «Resuelto Empresarial: 8».
5. **Dado** 5 casos con `clase = CNS` y `status` distinto de `CERRADO`, **Cuando** el supervisor consulta CONSTRUCCION, **Entonces** la tabla muestra 5 casos pendientes de construcción.
6. **Dado** un caso sin `Reparador Principal` ni `fecha_asignacion`, **Cuando** el supervisor consulta la zona CUADRILLA, **Entonces** el caso aparece en el grupo «Sin asignar», no se cuenta entre los «asignados por día» y no distorsiona los totales por cuadrilla. [D-48]
6b. **Dado** un despacho confirmado el 13/09/2026 con 45 casos asignados a 3 cuadrillas y 5 casos reasignados por ajuste manual, **Cuando** el supervisor consulta la zona CUADRILLA, **Entonces** la serie «asignados por día» cuenta los casos por su `fecha_asignacion` = 13/09/2026 —la **última** asignación de cada caso— sin usar ningún archivo de despacho por fecha, y muestra ese criterio de cálculo en pantalla. [D-48]
7. **Dado** que el supervisor abre GRAFICOS, **Cuando** la pestaña termina de cargar, **Entonces** se muestran 6 gráficos: 4 de barras, **1 de barras + línea (semanal)** y 1 de torta. [D-34]
8. **Dado** el selector de semana del bloque **Gestión Semanal estadístico**, **Cuando** el supervisor elige **Sem 36**, **Entonces** el sistema dibuja la serie de ingreso del día, las reparadas del día y la línea del pendiente al cierre de cada día de esa semana, y no ofrece ninguna opción más allá de Sem 36. [D-34]
9. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir MONITOREO, **Entonces** el sistema responde «Acción no permitida para su rol» y no muestra cifras.
10. **Dado** cualquiera de los 6 gráficos de MONITOREO o GRAFICOS, **Cuando** el usuario no puede interpretar la imagen (por ejemplo, con un lector de pantalla o navegación solo por teclado), **Entonces** el sistema ofrece una **tabla o texto alternativo equivalente** con los mismos valores y el mismo criterio de corte que el gráfico. [D-40, RNF-13]
11. **Dado** el bloque de GESTION SEMANAL, **Cuando** el usuario recorre el gráfico solo con el teclado, **Entonces** puede alcanzar la tabla equivalente, leer cada punto (ingreso del día, reparadas del día y pendiente al cierre) y el foco es visible en cada elemento. [D-40, RNF-13]

**Restricciones del sistema (EARS)**

- **El sistema deberá** calcular las métricas sobre la semana operativa de lunes a sábado. [RN-08]
- **El sistema deberá** calcular el seguimiento semanal como serie estadística de **ingreso del día vs. reparadas del día**, con la **línea del pendiente al cierre de cada día**, agrupada por semana del año y seleccionable de **Sem 1 a Sem 36**, sin generar ningún archivo de hoja de cálculo. [D-34, RF-05, RF-25]
- **Mientras** el maestro contenga 1.000 casos, el sistema deberá dibujar MONITOREO en menos de 3 s. [RNF-02, D-24]
- **Si** un caso no tiene sector o cuadrilla, entonces el sistema deberá agruparlo bajo «Sin asignar» y mostrar el conteo de excluidos. [H-28, RNF-10]
- **El sistema deberá** calcular «asignados por día» de la zona CUADRILLA agrupando los casos por `fecha_asignacion` (fecha de la **última** asignación de cuadrilla, D-48), sin depender de archivos de despacho por fecha, y mostrar el criterio de cálculo y el rango temporal de cada cifra en pantalla. [D-48, H-28, RNF-01]
- **El sistema deberá** calcular «gestionados por día» como el número de **casos distintos** (`id_averia` único) cuyo último cambio de estado a `GESTION` cae en la fecha del día mostrado, contando cada caso **una sola vez** aunque haya reingresado al estado el mismo día, y deberá mostrar en pantalla la fecha de corte y el conteo de casos excluidos por no tener cambio de estado registrado. [RF-05, D-48, H-N-21]
- **El sistema deberá** mostrar cada cifra con su fecha de corte y su rango temporal, y cada reemisión de la zona Cuadrilla o del reporte semanal con la huella de comparación («N cambios desde la última emisión», donde N es el número de casos cuyo `fecha_modificacion` cambió después de la emisión anterior), de modo que dos ejecuciones del mismo periodo den el mismo valor. [D-34, H-N-21]
- **El sistema deberá** funcionar sin conexión a internet y sin consultar servicios externos. [RT-07]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá denegar el acceso a MONITOREO y GRAFICOS. [D-35, RNF-12]
- **El sistema deberá** acompañar **cada gráfico** de una tabla o texto alternativo equivalente con los mismos valores y el mismo criterio de corte, alcanzable solo con el teclado y con foco visible. [D-40, RNF-13]

---

### CU-19 — Emitir el despacho en pantalla y PDF y el seguimiento semanal estadístico

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actores secundarios:** Operador de la central (corrige los datos antes de emitir). El «jefe de central» está **retirado (D-55)**: el reporte lo consume el supervisor.
- **Ciclo:** C6. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12); despacho del día confirmado (CU-16) para la salida de despacho; datos del día y de la semana operativa cargados y corregidos para la serie estadística.
- **Postcondiciones:** el **despacho** queda emitido en pantalla y PDF; el **seguimiento semanal** queda disponible como serie estadística por día (ingreso vs. reparadas, con la línea del pendiente al cierre) seleccionable de Sem 1 a Sem 36; **no** se genera ningún archivo XLSX. [D-34]

**Trazabilidad:** RF-25, RF-05; RN-08; RNF-01, RNF-06, RNF-07, RNF-11, **RNF-08, RNF-12, RNF-13**; D-27, **D-34, D-35, D-40, D-50, D-55**; H-16, H-23, H-28.

**Flujo principal**

1. El supervisor abre el bloque **REPORTES** y elige *Despacho del día (pantalla + PDF)* o *Seguimiento semanal estadístico*.
2. **Salida de despacho.** El sistema presenta en pantalla el despacho del día confirmado (fecha, cuadrilla y detalle por cuadrilla) y ofrece *Imprimir* o *Guardar PDF en la ruta controlada*.
3. El sistema genera el PDF del despacho por cuadrilla con la misma proyección de 15 columnas de CU-17 (D-31) y lo guarda con el nombre `despacho_DD_MM_AAAA`, registrando la emisión con fecha, hora y operador.
4. **Salida estadística semanal.** El sistema presenta la serie estadística por día: **ingreso del día**, **reparadas del día** y la **línea del pendiente al cierre de cada día**, con la semana operativa (lunes a sábado) y el selector de semana del año **Sem 1 a Sem 36**.
5. El supervisor elige la semana y el sistema recalcula la serie y muestra la fecha de emisión, el periodo, el operador emisor y el criterio de corte.
6. El sistema permite volver a emitir la misma salida y detecta cambios en los datos, mostrando «El periodo tuvo N cambios desde la última emisión», donde **N es el número de casos del periodo cuya `fecha_modificacion` es posterior a la fecha y hora de la emisión anterior** (huella de comparación declarada, H-N-21).
7. El sistema deja constancia de la emisión (qué salida, qué periodo, quién y cuándo) en el registro de la aplicación.

**Flujos alternativos**

- **1a. Salida en hoja de cálculo (XLSX) solicitada.** El sistema **no genera XLSX** (D-34): ofrece la salida en pantalla y PDF para el despacho, y en pantalla para la serie estadística, con el aviso «Salida no disponible: el despacho se emite en pantalla y PDF; el seguimiento semanal es estadístico en pantalla (D-34)». No se genera ningún archivo.
- **2a. Sin datos en el periodo.** El sistema muestra «Sin datos en el periodo seleccionado» y no genera archivo.
- **3a. Fallo al guardar el PDF.** El sistema mantiene el despacho en pantalla y ofrece *Reintentar* o *Imprimir*.
- **4a. Casos sin clasificar.** El sistema incluye la fila «Sin clasificar» con su conteo y no los reparte entre categorías.
- **4b. Semana fuera de Sem 1 a Sem 36.** El sistema limita el selector a Sem 1 a Sem 36 y avisa «Semana fuera de rango». [D-34]
- **6a. Reemisión tras correcciones.** El sistema genera una nueva versión con la marca «Reemisión DD/MM/AAAA hh:mm — &lt;operador&gt;» y conserva la anterior en la ruta controlada. [RNF-11, D-27]
- **1b. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra el bloque REPORTES y registra el intento. [D-35, RNF-12]
- **1c. Apertura sin sesión o pérdida de la sesión (D-50, D-45).** Sin identificación válida el bloque REPORTES y la serie estadística **no se renderizan** (no se muestra ninguna cifra ni el despacho del día); si la sesión se cierra o expira, el sistema oculta las salidas en pantalla, vuelve al diálogo de acceso y exige reingreso antes de emitir o reemitir. [D-45, D-50, RNF-08]

**Criterios de aceptación (Gherkin)**

1. **Dado** un despacho confirmado del 13/09/2026 con 45 casos en 3 cuadrillas, **Cuando** el supervisor emite la salida de despacho, **Entonces** el sistema la muestra en pantalla y genera el PDF en la ruta controlada con el nombre `despacho_13_09_2026.pdf`. [D-34]
2. **Dado** la semana operativa del **07/09/2026 (lunes) al 12/09/2026 (sábado)**, **Cuando** el supervisor abre el seguimiento semanal, **Entonces** el sistema muestra **6 puntos** diarios fechados 07 a 12 de septiembre de 2026 con ingreso del día y reparadas del día, y ningún punto del domingo 13/09/2026. [D-34, RN-08, H-N-22]
3. **Dado** la serie estadística de una semana, **Cuando** el supervisor la consulta, **Entonces** el sistema dibuja además la **línea del pendiente al cierre de cada día** y muestra su valor numérico en cada punto. [D-34]
4. **Dado** el selector de semana, **Cuando** el supervisor elige **Sem 1** y luego **Sem 36**, **Entonces** el sistema recalcula la serie en ambos casos y no ofrece ninguna semana anterior a Sem 1 ni posterior a Sem 36. [D-34]
5. **Dado** que el supervisor solicita el reporte en XLSX, **Cuando** el sistema no lo tiene implementado por decisión D-34, **Entonces** muestra «Salida no disponible: el despacho se emite en pantalla y PDF; el seguimiento semanal es estadístico en pantalla (D-34)» y no genera ningún archivo.
6. **Dado** una salida de despacho emitida por el supervisor `12345` a las 14:20 del 13/09/2026, **Cuando** se consulta la emisión, **Entonces** el sistema muestra fecha, hora y operador emisor.
7. **Dado** el despacho del 13/09/2026 ya emitido y **3 casos cerrados después** de esa emisión (con `fecha_modificacion` posterior a la hora de emisión), **Cuando** el supervisor lo vuelve a generar, **Entonces** el sistema muestra exactamente «El periodo tuvo 3 cambios desde la última emisión» —N = número de casos del periodo con `fecha_modificacion` posterior a la emisión anterior— y genera una reemisión marcada. [RNF-11, H-N-21]
8. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir REPORTES, **Entonces** el sistema responde «Acción no permitida para su rol» y no genera ningún archivo.
9. **Dado** la serie estadística semanal en pantalla, **Cuando** el usuario la consulta con lector de pantalla o solo con el teclado, **Entonces** el sistema ofrece la **tabla equivalente** con el ingreso del día, las reparadas del día y el pendiente al cierre de cada día de la semana, con los mismos valores que el gráfico. [D-40, RNF-13]
10. **Dado** el PDF del despacho emitido, **Cuando** se revisa su contenido, **Entonces** el texto es seleccionable y su contraste es de al menos 4,5:1, y la tabla equivalente del despacho está disponible en pantalla para quien no pueda interpretar la imagen. [D-40, RNF-13]

**Restricciones del sistema (EARS)**

- **De acuerdo con** D-34, el sistema deberá emitir **solo el despacho** en pantalla y PDF, y deberá presentar el **seguimiento semanal como serie estadística en pantalla** (por día, ingreso del día vs. reparadas del día, con la línea del pendiente al cierre, agrupado por semana del año de Sem 1 a Sem 36). [RF-25, D-34]
- **El sistema no deberá** generar archivos de hoja de cálculo (XLSX) para ninguna de las dos salidas. [D-34]
- **El sistema deberá** calcular los cortes semanales de lunes a sábado y limitar el selector de semana a **Sem 1 a Sem 36**. [RN-08, RNF-06, D-34]
- **Si** el periodo no tiene datos, entonces el sistema deberá informarlo y no generar archivo. [RNF-10]
- **El sistema deberá** guardar cada PDF de despacho en la ruta controlada con el periodo en el nombre y la marca de reemisión cuando corresponda. [D-27, RNF-11]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá denegar el bloque REPORTES. [D-35, RNF-12]
- **El sistema deberá** ofrecer la **tabla equivalente** de la serie estadística semanal y del despacho, alcanzable solo con el teclado, con contraste mínimo 4,5:1 y foco visible. [D-40, RNF-13]

---

### CU-20 — Vigilar casos especiales y averías concentradas

- **Actor principal:** Supervisor (función administrativa, D-35).
- **Actor secundario:** Operador de la central (ejecuta las acciones sobre los casos señalados). El «jefe de central» está **retirado (D-55)**.
- **Ciclo:** C6. **Prioridad:** posterior (fuera del MVP).
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12); maestro con `sector` y `status` informados; umbral de concentración configurado en CONFIGURACION.
- **Postcondiciones:** el supervisor ve la lista de averías concentradas por sector y la lista de **casos especiales** —definición **definitiva**: `tipo_abonado = EMP` o `nivel = REF` **abiertos** (D-33)— y puede actuar sobre ellas.

**Trazabilidad:** RF-26, RF-29; RN-04, RN-08; RNF-01, RNF-08, RNF-09, **RNF-12, RNF-14, RNF-15**; D-23, D-25, **D-33, D-35, D-41, D-42, D-50, D-55, D-56**; H-04, H-14.

**Flujo principal**

1. El supervisor abre el bloque **CONCENTRADAS / ESPECIALES**.
2. El sistema calcula, por sector, el número de casos **abiertos** (abierto = `status` distinto de `CERRADO`) ingresados en la semana operativa en curso.
3. El sistema lista los sectores cuyo conteo alcanza o supera el umbral vigente (3 por defecto, editable en CONFIGURACION) con el conteo, el sector, las cuadrillas implicadas y la lista de `id_averia`.
4. El supervisor ajusta el umbral (por ejemplo a 5) y el sistema recalcula la lista y mantiene el valor guardado para las próximas consultas.
5. El supervisor selecciona un sector concentrado y pulsa *Ver casos*: el sistema abre la tabla de CASOS filtrada por ese sector y por abiertos (CU-10).
6. El supervisor solicita la lista de casos especiales del día; el sistema muestra la lista **definitiva** de los casos **abiertos** con `tipo_abonado = EMP` **o** `nivel = REF` (D-33), sin rótulo de provisionalidad, y permite marcarlos para seguimiento.
7. El supervisor registra una acción por caso (llamada al abonado, escalamiento al supervisor de área, reasignación de cuadrilla) y el sistema la asienta en `observaciones` con operador y fecha/hora y **añade a `historial.jsonl`** la línea `campo = observaciones` con su valor anterior, su valor nuevo y `accion = edicion` (D-56).

**Flujos alternativos**

- **3a. Ningún sector alcanza el umbral.** El sistema muestra «Sin averías concentradas con umbral 3 en la semana operativa del 07/09/2026 al 12/09/2026». [RN-08, H-N-22]
- **4a. Umbral inválido (0, negativo o no numérico).** El sistema muestra «El umbral debe ser un número entero mayor o igual a 1» y conserva el valor anterior.
- **6a. Casos especiales (definición definitiva, D-33).** El sistema muestra los casos **abiertos** con `tipo_abonado = EMP` **o** `nivel = REF`, con el rótulo «Casos especiales: EMP o REF abiertos (D-33)». **No** usa la etiqueta «criterio provisional» ni permite sustituir la definición por un filtro manual: el supervisor puede añadir filtros **sobre** esa lista, pero no redefinirla. [D-33]
- **7a. El caso ya está `CERRADO`.** El sistema permite la anotación, advierte «El caso está cerrado» y no cambia su `status`. [H-19]
- **2a. Casos sin sector.** El sistema los excluye del cálculo y muestra «N casos sin sector no se contabilizan».
- **1a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra el bloque CONCENTRADAS / ESPECIALES ni permite anotar acciones sobre los casos, y registra el intento. [D-35, RNF-12]
- **1b. Apertura sin sesión o pérdida de la sesión (D-50, D-45).** Sin identificación válida el bloque CONCENTRADAS / ESPECIALES **no se renderiza**: no se muestran las listas de averías concentradas ni de casos especiales. Si la sesión se cierra o expira, el sistema **oculta ambas listas y sus conteos**, vuelve al diálogo de acceso y exige reingreso. [D-45, D-50, RNF-08]
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.

**Criterios de aceptación (Gherkin)**

1. **Dado** el sector `1` con 4 casos abiertos ingresados en la semana operativa del **07/09/2026 (lunes) al 12/09/2026 (sábado)** y el umbral 3, **Cuando** el supervisor abre CONCENTRADAS, **Entonces** el sector `1` aparece en la lista con conteo 4. [RN-08, H-N-22]
2. **Dado** el mismo sector con 2 casos abiertos y 3 cerrados en la semana, **Cuando** el supervisor abre CONCENTRADAS, **Entonces** el sector `1` no aparece (solo se cuentan los abiertos) y el conteo mostrado para ese sector es 2.
3. **Dado** el umbral en 3 y 5 sectores por debajo del umbral, **Cuando** el supervisor lo cambia a 1, **Entonces** el sistema muestra los 6 sectores con al menos 1 caso abierto y conserva el umbral 1 en la siguiente consulta.
4. **Dado** un sector concentrado, **Cuando** el supervisor pulsa *Ver casos*, **Entonces** el sistema abre CASOS filtrado por ese sector con el conteo de abiertos coincidente con el de la lista.
5. **Dado** un maestro con 3 casos abiertos `tipo_abonado = EMP`, 5 casos abiertos `nivel = REF`, 2 casos `EMP` cerrados y 1 caso `REF` cerrado, **Cuando** el supervisor abre la lista de casos especiales, **Entonces** el sistema muestra **8** casos (3 EMP abiertos + 5 REF abiertos) y **no** muestra los 3 cerrados, con el rótulo «Casos especiales: EMP o REF abiertos (D-33)». [D-33]
6. **Dado** que el supervisor registra una acción sobre un caso, **Cuando** el sistema persiste, **Entonces** `observaciones` contiene la acción con fecha, hora y P00 del operador y `historial.jsonl` gana la línea `campo = observaciones` con `accion = edicion`. [D-56]
6b. **Dado** que el supervisor registra una acción a las 12:00 con `averias.json` en `fecha_modificacion = 13/09/2026 12:00` y el maestro fue modificado a las 12:02 por `12345`, **Cuando** confirma la anotación, **Entonces** el sistema no escribe, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 12:02. Recargue o sobrescriba», conserva la acción en pantalla y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
6c. **Dado** un maestro de 200 casos y una acción registrada sobre el caso `2026-00123`, **Cuando** el supervisor confirma la anotación, **Entonces** el sistema deja `averias_AAAA-MM-DD_HHMM.bak` con los 200 casos previos, escribe en el archivo temporal, **relee y compara** el contenido y **solo entonces** confirma; si la comparación falla, restaura el `.bak`, avisa y la acción no se da por registrada. [D-42, RNF-15]
7. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir el bloque CONCENTRADAS / ESPECIALES, **Entonces** el sistema responde «Acción no permitida para su rol» y no muestra la lista.

**Restricciones del sistema (EARS)**

- **El sistema deberá** contar como avería concentrada todo sector con 3 o más casos abiertos ingresados en la semana operativa en curso. [D-25]
- **El sistema deberá** considerar «abierto» todo caso con `status` distinto de `CERRADO`. [D-23]
- **El sistema deberá** definir los casos especiales como los casos **abiertos** con `tipo_abonado = EMP` o `nivel = REF`, con carácter **definitivo**, y no deberá rotular esa lista como provisional ni permitir redefinirla manualmente. [D-33]
- **Si** el umbral informado no es un entero mayor o igual a 1, entonces el sistema deberá rechazarlo y conservar el valor vigente. [RNF-10]
- **El sistema deberá** registrar operador y fecha/hora de cada cambio de umbral y de cada acción registrada, y **añadir** a `historial.jsonl` la línea de la acción anotada en `observaciones`. [RNF-09, **D-56**]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá denegar el bloque CONCENTRADAS / ESPECIALES y rechazar las anotaciones. [D-35, D-55, RNF-12]
- **Cuando** se registre una acción sobre un caso, el sistema deberá copiar el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribir en un archivo temporal, **releerlo y compararlo** y **solo entonces** confirmar; si falla, deberá restaurar el respaldo, avisar y **no** confirmar. [D-42, RNF-15]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

---

### CU-21 — Respaldar y restaurar los datos

- **Actor principal:** Supervisor (función administrativa, D-35: el respaldo es de su rol).
- **Actores secundarios:** Soporte TI del puesto; operador de la central (recibe el aviso de fallo).
- **Ciclo:** C1 (respaldo manual) / C7 (prueba de restauración). **Prioridad:** MVP (respaldo manual) / posterior (prueba formal en C7).
- **Precondiciones:** sesión identificada (CU-01) **con rol supervisor** (D-35, RNF-12); `C:\GGTO\datos` con los JSON de trabajo; carpeta **`C:\GGTO\respaldo\`** disponible (D-49).
- **Postcondiciones:** existe una copia **fechada con hora** del maestro (`averias_AAAA-MM-DD_HHMM.json`) en `C:\GGTO\respaldo\`, **sin cifrado**, y —tras una restauración probada y documentada en C7— el sistema vuelve a operar con los datos recuperados dentro del **RTO de 1 hora** y con un **RPO** que no va más atrás del cierre del día anterior (D-49).

**Trazabilidad:** RF-24; RNF-04, RNF-08, RNF-10, **RNF-12, RNF-14, RNF-15, RNF-16**; RT-01, RT-10; D-01, D-19, D-28, D-35, D-36, **D-41, D-42, D-49, D-50, D-55, D-56**; H-09, H-12, H-13, H-25.

**Flujo principal**

1. El supervisor abre el bloque **RESPALDO** y consulta el estado: fecha y hora del último respaldo, tamaño de cada archivo y ruta de destino.
2. El supervisor pulsa *Respaldar ahora* (respaldo **manual**, sin automatismo ni rotación: D-36).
3. **Copia del cierre de jornada (D-49).** El sistema copia `averias.json`, `despacho.json`, `estructura.json`, `central.json`, `tecnicos.json`, `flota.json`, `cuadrillas.json`, `sectores.json`, `claves_clasificacion.json` **y el historial `historial.jsonl`** a **`C:\GGTO\respaldo\`**, con la copia del maestro fechada **con hora** como **`averias_AAAA-MM-DD_HHMM.json`** (`AAAA-MM-DD` = fecha del cierre y `HHMM` = hora y minuto del respaldo, para que dos respaldos del mismo día **no colisionen** ni se sobrescriba la copia anterior, H-N-08). El **historial se copia junto con el maestro y nunca se recorta**: se copia íntegro, sin truncar y sin filtrar por fecha (D-56). **Sin cifrado**: el paquete queda en claro y el supervisor lo lleva después a la red o a un pen drive, bajo su responsabilidad. [D-49, **D-56**, RNF-16]
4. El sistema relee cada copia y la compara con el original **por contenido** (igualdad del texto serializado y mismo número de registros; en el historial, mismo número de líneas y mismo texto), con el mismo criterio de verificación por relectura de D-42; muestra «Respaldo verificado: 10 archivos» y la **fecha y hora del último cierre respaldado**. [D-42, D-49, **D-56**, RNF-16]
5. **Restauración (D-49).** El supervisor elige una copia fechada de `C:\GGTO\respaldo\`, pulsa *Restaurar* y el sistema muestra el archivo, su fecha y cuántos registros contiene frente al maestro vigente.
6. El supervisor confirma; el sistema **respalda el estado actual antes de reemplazar** (con el mismo mecanismo de D-42) y **copia la copia fechada sobre `C:\GGTO\datos\averias.json`**, releyendo el archivo resultante para verificar que es JSON válido y que tiene al menos el mismo número de registros que la copia.
7. El sistema muestra «Restauración completada desde el respaldo del DD/MM/AAAA» con la **hora de inicio y de fin de la restauración** (para comprobar el **RTO de 1 hora**) y la **fecha del cierre respaldado** (para comprobar el **RPO = cierre del día anterior**), y deja la **prueba de restauración documentada en C7** con operador y fecha.

**Flujos alternativos**

- **3a. Fallo de copia (`C:\GGTO\respaldo\` no disponible o sin permisos).** El sistema muestra «No se pudo escribir en `C:\GGTO\respaldo\`: &lt;detalle&gt;», no marca el respaldo como exitoso, lo registra en el log con fecha y hora y ofrece reintentar. [D-49, H-25]
- **4a. La copia difiere del original.** El sistema marca el respaldo como fallido, conserva el error, indica el archivo y la diferencia detectada y recomienda reintentar. La comparación es **por contenido releído** (mismo número de registros e igualdad del texto serializado), el mismo criterio que D-42 aplica al escribir el maestro. [D-42, RNF-15]
- **6a. El respaldo elegido está corrupto.** El sistema detecta el JSON inválido, no reemplaza nada y muestra «Respaldo inválido: &lt;archivo&gt;».
- **6b. El respaldo tiene menos registros que el maestro vigente.** El sistema muestra «La copia tiene 800 casos y el maestro 1.000. ¿Confirma el reemplazo?» y exige confirmación escrita. [RNF-04]
- **1a. Nunca se ha respaldado.** El sistema muestra «Sin respaldos registrados» y resalta el aviso **al cierre de la jornada**; no bloquea la operación del día (aviso, no bloqueo), pero deja constancia de que no hay copia fechada y, por tanto, el RPO no está cubierto. [D-49, H-25]
- **2a. Acción no permitida para su rol.** Si la sesión es de operador, el sistema no muestra el bloque RESPALDO ni permite respaldar o restaurar, y registra el intento. [D-35, RNF-12]
- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.

**Criterios de aceptación (Gherkin)**

1. **Dado** `C:\GGTO\datos` con 9 archivos JSON **y `historial.jsonl`**, **Cuando** al cierre de la jornada el supervisor acepta la copia ofrecida por la página, **Entonces** `C:\GGTO\respaldo\` contiene los **10 archivos** copiados y verificados por contenido —incluido `historial.jsonl` **íntegro** (mismas líneas que el original, sin truncar)—, la copia del maestro se llama `averias_2026-09-13_HHMM.json` —fecha del cierre **y hora del respaldo**— y **no** está cifrada. [D-49, **D-56**, RNF-16, H-N-08]
2. **Dado** un respaldo con `averias.json` de 1.000 casos y un maestro vigente de 1.000 casos, **Cuando** el supervisor restaura, **Entonces** el maestro queda con los mismos 1.000 `id_averia` y el sistema muestra «Restauración completada».
3. **Dado** un archivo de respaldo con JSON inválido, **Cuando** el supervisor intenta restaurarlo, **Entonces** el sistema muestra «Respaldo inválido», no reemplaza ningún archivo y el maestro conserva sus datos.
4. **Dado** un respaldo con 800 casos y un maestro con 1.000, **Cuando** el supervisor intenta restaurar, **Entonces** el sistema pide confirmación escrita y no reemplaza nada hasta obtenerla.
5. **Dado** que la ruta de respaldo no está disponible, **Cuando** el supervisor ejecuta el respaldo, **Entonces** muestra el error, no marca el respaldo como exitoso y deja constancia con fecha y hora.
6. **Dado** un respaldo completado, **Cuando** el supervisor consulta el estado, **Entonces** el sistema muestra la fecha y hora del último respaldo exitoso y la ruta de destino.
7. **Dado** un maestro con 1.000 casos, **Cuando** el supervisor confirma una restauración, **Entonces** existe un respaldo del estado anterior (1.000 casos) en la ruta de respaldo y su contenido coincide con el maestro que había antes de reemplazar.
8. **Dado** una sesión con rol operador, **Cuando** el operador intenta abrir el bloque RESPALDO, **Entonces** el sistema responde «Acción no permitida para su rol» y no copia ni reemplaza ningún archivo.
8c. **Dado** un incidente que obliga a restaurar el maestro del cierre del 12/09/2026, **Cuando** el supervisor inicia la restauración a las 09:05 y el sistema termina de reemplazar y verificar el maestro a las 09:40, **Entonces** la restauración queda registrada con **inicio 09:05 y fin 09:40** —dentro del **RTO de 1 hora** (D-49)—, el maestro recuperado corresponde al **cierre del día anterior** —**RPO** cumplido— y la prueba queda documentada en C7 con el operador que la ejecutó. [D-49, RNF-16]
8b. **Dado** un respaldo elegido con `averias.json` en `fecha_modificacion = 13/09/2026 09:00`, **Cuando** el supervisor confirma *Restaurar* y el maestro vigente tiene ahora `fecha_modificacion = 13/09/2026 12:30` con `usuario_modificacion = 12345`, **Entonces** el sistema **no reemplaza** el maestro, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 12:30. Recargue o sobrescriba» y exige una decisión explícita de sobrescritura consciente antes de continuar. [D-41, RNF-14]

**Restricciones del sistema (EARS)**

- **Cuando** el supervisor solicite un respaldo, el sistema deberá copiar los archivos —incluido el historial `historial.jsonl`— y **releer** cada copia antes de marcarla como exitosa. [RNF-10, H-09, **D-56**]
- **El sistema deberá** copiar el historial `historial.jsonl` **junto con el maestro** y **nunca recortarlo**: la copia conserva todas sus líneas, sin truncar ni filtrar por fecha, porque el historial es *append-only* y nada se borra (D-56). [**D-56**, RNF-16]
- **Si** la copia difiere del original, entonces el sistema deberá marcar el respaldo como fallido e informar el detalle del archivo y de la diferencia. [RNF-10]
- **Cuando** el supervisor restaure un respaldo, el sistema deberá respaldar el estado actual antes de reemplazar y verificar que ese respaldo previo exista y coincida con el estado anterior. [D-19]
- **El sistema deberá** mantener los datos de trabajo fuera de Google Drive, en `C:\GGTO\datos`. [D-19, RT-10]
- **El sistema deberá** ejecutar el respaldo **solo a demanda del supervisor**, sin automatismo programado. Al **cierre de la jornada** deberá **ofrecer** la copia fechada **con hora** del maestro (`averias_AAAA-MM-DD_HHMM.json`) **y de `historial.jsonl`** en `C:\GGTO\respaldo\`, **sin cifrado**, **sin sobrescribir** una copia anterior del mismo día y **sin recortar** el historial; el supervisor la llevará después a la red o a un pen drive. [D-36, D-49, **D-56**, RNF-16]
- **Cuando** el supervisor restaure una copia fechada, el sistema deberá copiarla sobre `C:\GGTO\datos\averias.json` previa confirmación, registrar la hora de inicio y de fin, y permitir verificar el **RTO de 1 hora** y el **RPO del cierre del día anterior**. [D-49, RNF-16]
- **El sistema deberá** conservar el histórico de casos sin purga automática y mantener el respaldo en una ruta controlada. [D-28, D-27]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar el respaldo y la restauración sin copiar ni reemplazar archivos. [D-35, RNF-12]
- **Si** la marca de modificación del archivo difiere de la capturada al cargarlo, entonces el sistema deberá **impedir el guardado** y exigir una decisión explícita del usuario (recargar o sobrescribir), de modo que **ningún guardado sobrescriba cambios ajenos sin decisión explícita**. [D-41, RNF-14]

> **Este caso de uso ya no tiene puntos `&lt;PENDIENTE&gt;`.** La **verificación de la escritura** quedó decidida por **D-42** y RNF-15 (relectura y comparación del contenido tras escribir en un archivo temporal, con respaldo previo `averias_AAAA-MM-DD_HHMM.bak` —se conservan las **10** últimas— y restauración automática ante fallo). La **política de respaldo** quedó decidida por **D-49** y RNF-16: al cierre de la jornada se ofrece la copia fechada con hora `averias_AAAA-MM-DD_HHMM.json` en **`C:\GGTO\respaldo\`**, **sin cifrado**, que el supervisor lleva después a la red o a un pen drive; la restauración copia esa copia sobre `C:\GGTO\datos\averias.json` previa confirmación; y los objetivos declarados son **RTO de 1 hora** y **RPO = cierre del día anterior**, con prueba de restauración documentada en C7. H-11, H-12 y H-13 quedan cerrados.

---

### CU-22 — Operar en contingencia y diagnosticar el entorno

- **Actor principal:** Supervisor (función administrativa, D-35). El operador puede ejecutar el lanzador y consultar el estado del entorno.
- **Actores secundarios:** Operador de la central; soporte TI del puesto. **Sin actores de auditoría ni «jefe de central» (D-55):** las funciones de diagnóstico, respaldo y consulta de cifras son del supervisor.
- **Ciclo:** C1 / C7. **Prioridad:** MVP.
- **Precondiciones:** **sesión identificada (CU-01) con credencial válida y vigente (D-39) para cualquier consulta o descarga del maestro, incluidas las del modo descarga** —sin sesión solo se muestra el diálogo de acceso (D-50 y D-27)—; el puesto tiene Edge o Chrome (versión 86 o superior) y Python 3.7+ o Node.js disponibles para el lanzador.
- **Postcondiciones:** el sistema arranca de forma reproducible, informa con claridad cualquier fallo y permite operar en modo degradado sin perder datos.

**Trazabilidad:** RF-01; RNF-03, RNF-04, **RNF-08**, RNF-10, **RNF-12, RNF-16**; RT-06, RT-07, RT-09, RT-10; D-01, D-15, D-19, D-27, D-35, D-39, **D-45, D-46, D-49, D-50, D-55, D-58**; H-20, H-22, H-23, H-24, H-25, H-28.

**Flujo principal**

1. El usuario ejecuta el lanzador `pwsh -File .\servir-ggto.ps1`, que levanta el servidor en `127.0.0.1:8787` sirviendo solo el subdirectorio de la aplicación y abre el navegador.
2. El sistema carga la página, verifica el contexto (`http` y host local), comprueba la versión del navegador y muestra el estado del entorno: servidor, ruta de datos `C:\GGTO\datos`, versión de la aplicación y navegador detectado.
3. El sistema valida que los archivos de datos requeridos existan y sean JSON válidos y avisa de los que falten.
4. El supervisor consulta el registro de la aplicación (log) y el informe de la última ingesta, y descarga el detalle si lo necesita. Ese **log de la aplicación** (`datos/incidencias.log`) rota por tamaño —**5 MB × 5 archivos**, **sin datos personales** (D-58)— y es donde quedan los **errores** y también los **intentos fallidos y las acciones denegadas** (§1.20, D-57).
5. Si el servidor local no está disponible, el supervisor activa el **modo descarga**, **siempre dentro de una sesión identificada**: el sistema **exige la identificación `P00` + contraseña (CU-01) antes de habilitar el modo** y, solo entonces, permite consultar el maestro cargado con el selector de archivos y guarda los cambios descargando el JSON completo, con el aviso «Modo descarga: reemplace el archivo en C:\GGTO\datos al terminar». **Sin sesión válida no se carga el maestro, no se muestra ningún dato y lo único visible es el diálogo de acceso** (D-50, D-27).
6. Si el archivo del CSV diario no llega, la página muestra el día como **«sin ingesta»** (D-46): mantiene el maestro del día anterior, permite **registrar la novedad** (fecha, motivo y operador) en `datos/incidencias.log` y **no bloquea** la consulta ni el despacho. [D-46, H-24]
7. Al cierre, el supervisor verifica el estado: última escritura confirmada, último respaldo y número de errores registrados en el día.

**Flujos alternativos**

- **1a. El puerto 8787 está ocupado.** El lanzador muestra «El puerto 8787 está en uso» y ofrece cambiar de puerto; el sistema abre la página en el puerto alterno elegido. [H-23]
- **1b. No hay Python ni Node.js.** El sistema no puede levantar el servidor: muestra las opciones *Instalar Python/Node* o *Trabajar en modo descarga* y queda operativo solo en modo descarga. [H-23, RNF-03]
- **1d. Modo descarga sin sesión.** Si el usuario intenta entrar en modo descarga sin haberse identificado, el sistema **no carga el maestro ni habilita el selector de archivos**: muestra el diálogo **Identificación del operador** y responde «Identifíquese para operar en modo descarga»; ningún nombre, teléfono ni dirección de abonado queda a la vista. [D-50, D-27, RNF-08, H-N-02]
- **2a. Navegador sin File System Access API (Firefox o Safari).** El sistema avisa «Este navegador no permite escribir los JSON: use Edge o Chrome 86+» y habilita solo el **modo descarga, siempre con sesión identificada** (D-50). [RNF-03, H-22, D-50]
- **2b. Versión de Chrome/Edge inferior a 86.** El sistema muestra el mismo aviso y ofrece actualizar.
- **3a. `averias.json` ausente, vacío o con JSON inválido.** El sistema bloquea la edición, muestra «Maestro no disponible: &lt;detalle&gt;» y ofrece *Restaurar desde respaldo* (CU-21), que con **D-49** consiste en copiar una copia fechada de `C:\GGTO\respaldo\` sobre `C:\GGTO\datos\averias.json` previa confirmación del supervisor, dentro del **RTO de 1 hora** y con **RPO** del cierre del día anterior. [D-49, RNF-16, H-20, H-25]
- **5a. Cambios sin guardar en modo descarga.** El sistema mantiene el aviso de pendiente y bloquea la salida de la página hasta confirmar la descarga del JSON. [RNF-04]
- **4a. Error en la ingesta.** El sistema registra el error en el log, muestra el mensaje accionable y conserva el archivo con la cabecera leída para diagnóstico. [H-20]
- **7a. Acción no permitida para su rol.** El operador puede ejecutar el lanzador y consultar el estado del entorno, pero **no** puede restaurar desde respaldo ni cambiar la ruta de datos: el sistema responde «Acción no permitida para su rol» y registra el intento. [D-35, RNF-12]

**Criterios de aceptación (Gherkin)**

1. **Dado** un puesto con Python 3.7 o superior y el puerto 8787 libre, **Cuando** el usuario ejecuta `pwsh -File .\servir-ggto.ps1`, **Entonces** el servidor responde en `http://127.0.0.1:8787` y la página abre con las 7 pestañas.
2. **Dado** el servidor levantado, **Cuando** el operador autorizado ejecuta `Get-NetTCPConnection -LocalPort 8787`, **Entonces** la única dirección en escucha es `127.0.0.1` (no `0.0.0.0`); **Y** al solicitar `http://127.0.0.1:8787/datos/averias.json` la respuesta es de **recurso no encontrado** (404), de modo que `datos/` no está publicado por HTTP. El criterio es discriminante: la prueba se hace contra `127.0.0.1`, no contra la IP del equipo, porque el servidor no escucha en esa IP. [D-15, RT-09, H-28]
3. **Dado** un equipo con Firefox, **Cuando** el operador abre la página, **Entonces** el sistema muestra «Este navegador no permite escribir los JSON» y habilita únicamente el **modo descarga, previa identificación**: si la sesión no está abierta, lo único visible es el diálogo de acceso. [RNF-03, D-50]
4. **Dado** un lanzamiento con el puerto 8787 ocupado, **Cuando** el usuario ejecuta el lanzador, **Entonces** el sistema muestra «El puerto 8787 está en uso» y ofrece un puerto alterno.
5. **Dado** que `averias.json` contiene un JSON inválido, **Cuando** el operador abre la página, **Entonces** el sistema muestra «Maestro no disponible: &lt;detalle&gt;» y ofrece *Restaurar desde respaldo* sin permitir edición.
6. **Dado** que el usuario trabaja en modo descarga con 3 cambios sin guardar, **Cuando** intenta cerrar la página, **Entonces** el sistema advierte de los cambios pendientes y exige confirmar la descarga del JSON.
7. **Dado** un fallo de escritura en `averias.json`, **Cuando** el usuario reintenta, **Entonces** el sistema muestra el detalle del error, registra el evento en el log con fecha, hora y detalle accionable, y permite guardar una copia en la ruta de respaldo.
8. **Dado** una sesión con rol operador, **Cuando** el operador intenta restaurar desde respaldo, **Entonces** el sistema responde «Acción no permitida para su rol» y no reemplaza ningún archivo. [D-35, D-55, RNF-12]
9. **Dado** un `averias.json` con 51 casos (con nombre, teléfono y dirección de abonados) y la página recién abierta **sin sesión**, **Cuando** el usuario activa el modo descarga y elige el archivo con el selector, **Entonces** el sistema **no** carga el maestro, **no** dibuja ninguna tabla ni conteo y muestra únicamente el diálogo **Identificación del operador** con «Identifíquese para operar en modo descarga». [D-50, D-27, RNF-08, H-N-02]
10. **Dado** el modo descarga ya activado con una sesión válida de supervisor, **Cuando** la sesión se cierra o expira a las 8 horas (D-45), **Entonces** el sistema **oculta el maestro descargado en pantalla**, vuelve al diálogo de acceso e impide generar una nueva descarga hasta el reingreso. [D-45, D-50, RNF-08]

**Restricciones del sistema (EARS)**

- **El sistema deberá** servir la página únicamente en loopback y publicar solo el subdirectorio de la aplicación, dejando `datos/` fuera del alcance HTTP. [D-15, RT-09]
- **Si** el navegador no soporta File System Access API, entonces el sistema deberá ofrecer el modo descarga con aviso visible. [RNF-03, H-22]
- **Mientras** no exista una identificación válida, el sistema **no deberá** habilitar el modo descarga ni cargar el maestro: deberá mostrar solo el diálogo de acceso, sin exponer nombre, teléfono ni dirección de ningún abonado, y sin escribir la copia completa del maestro en la carpeta de Descargas. [D-50, D-27, RNF-08, H-N-02]
- **Si** la sesión se cierra o expira durante el modo descarga, entonces el sistema deberá ocultar el maestro de la pantalla y exigir reingreso antes de permitir una nueva descarga. [D-45, D-50, RNF-08]
- **Si** un archivo de datos falta o no es JSON válido, entonces el sistema deberá bloquear la edición, informar con claridad y ofrecer la restauración desde respaldo. [H-20, H-25]
- **Mientras** el servidor local no esté disponible, el sistema deberá permitir la operación en modo descarga sin pérdida de datos **y solo con una sesión identificada** (D-50). [H-23, D-50, D-27]
- **El sistema deberá** registrar en el **log de la aplicación** los errores de lectura, escritura e ingesta —y los intentos fallidos de sesión y las acciones denegadas por rol (§1.20)—, con fecha, hora y detalle accionable, con rotación por tamaño de **5 MB × 5 archivos** y **sin datos personales**. [H-20, **D-57, D-58**]
- **El sistema deberá** funcionar sin conexión a internet y sin CDN, con las **versiones de las librerías de `lib/` (CSV, gráficos y PDF) fijadas** en C1 y verificadas por el paso 2 de diagnóstico. [RT-07]
- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá rechazar las acciones de restauración y de cambio de ruta de datos, admitiendo solo el arranque del puesto y la consulta del estado. [D-35, D-55, RNF-12]

> **Puntos resueltos que ya no son `&lt;PENDIENTE&gt;` en este caso de uso:** (a) la **concurrencia de dos sesiones** quedó decidida por **D-41** y RNF-14 (sin bloqueo: relectura de la marca de modificación y decisión obligatoria entre recargar o sobrescribir), y (b) la **escritura verificada con respaldo previo** (no «atómica»: D-42 solo especifica copia previa `.bak`, archivo temporal, relectura comparada y restauración) y el versionado del maestro quedan decididos por **D-42** y RNF-15 (respaldo previo `averias_AAAA-MM-DD_HHMM.bak` con las 10 últimas copias, escritura en archivo temporal, relectura y comparación antes de confirmar, y restauración del respaldo si algo falla). [D-41, D-42, H-10, H-11]

---

## 5. Trazabilidad inversa — RF a casos de uso

| RF | Casos de uso que lo cubren | Estado | Observación |
|---|---|---|---|
| RF-01 | CU-01 (armazón de 7 pestañas) + los CU que declaran su pestaña en el flujo principal (CU-02 a CU-22) | Cubierto | El armazón lo construye CU-01; el resto lo consume. Se elimina la sobre-declaración «CU-02 a CU-14» de la versión anterior (H-20). |
| RF-02 | CU-11 (búsqueda por `id_averia` o `telefono`) | Cubierto | — |
| RF-03 | CU-12 (actualización de `status`, `resolucion`, `fechaResolucion`, `observaciones`, `sacas`) | Cubierto | Cierre bloqueante y con autorización por rol (D-35). |
| RF-04 | CU-14 (alta manual con lista cerrada e `id_averia` `MAN-`) | Cubierto | Colisión de `MAN-` resuelta con rechazo y consecutivo libre. |
| RF-05 | CU-18 (6 zonas con gráfico y tabla), CU-19 (serie semanal estadística) | Cubierto | Cifras de resueltos con corte explícito en el «Dado»; cada gráfico lleva tabla o texto alternativo equivalente (D-40, RNF-13). |
| RF-06 | CU-18 (GRAFICOS: 4 barras, barras + línea semanal y torta) | Cubierto | Barras + línea conforme a D-34; cada gráfico con tabla o texto alternativo equivalente (D-40, RNF-13). |
| RF-07 | CU-10 (registro principal y clasificación), CU-13 (reclasificación telefónica) | Cubierto | — |
| RF-08 | CU-16 (distribución por sector y cuadrilla) | Cubierto | — |
| RF-09 | CU-16 (citados del día por `fecha_cita`, ≥1 referido y ≥1 empresa, construcción única) | Cubierto | Citados definidos por D-30. |
| RF-10 | CU-17 (PDF por cuadrilla, carta horizontal) | Cubierto (C4, no MVP) | Lista canónica de 15 columnas fijada por D-31 (H-24 cerrado). |
| RF-11 | CU-02 (CENTRAL) | Cubierto | — |
| RF-12 | CU-03 (TECNICOS) | Cubierto | — |
| RF-13 | CU-04 (FLOTA) | Cubierto | — |
| RF-14 | CU-05 (CUADRILLA) | Cubierto | `despacho.json` ampliado por D-31 (H-04 cerrado). |
| RF-15 | CU-13 (bandeja GESTION, exclusiva del supervisor) | Cubierto | Tamaño de bandeja corregido a 37 (D-38, H-01 cerrado). |
| RF-16 | CU-08 (carga, filtro de central, extracción y dedupe) | Cubierto | Validación de `id_averia` vacío, duplicados del lote y prefijo `MAN-`. |
| RF-17 | CU-08 (clasificación) y CU-07 (vista previa) | Cubierto | El criterio CA-3 de CU-08 ya es determinista (14/37, D-38) y la semántica del modo `estricta` de CU-07 queda cerrada por **D-43** (subcadena literal, sensible a mayúsculas y tildes, sin variantes); P3 cerrado. |
| RF-18 | CU-08 (asignación de sector) y CU-09 (cola de direcciones sin coincidencia) | Cubierto | — |
| RF-19 | CU-08 (`ingreso`, `clase = REP`, `nivel = COM`) | Cubierto | — |
| RF-20 | CU-16 (extracción por `Reparador Principal`) y CU-17 (15 columnas del despacho) | Cubierto | Lista canónica única de 15 columnas (D-31, H-24 cerrado). |
| RF-21 | CU-10 (tabla con las 7 columnas resumen) | Cubierto | — |
| RF-22 | CU-11 (flotante con toda la información) y CU-12 (cierre con bloqueo y autorización) | Cubierto | Dueño único del cierre: CU-12; el botón del flotante invoca CU-12 (H-22). |
| RF-23 | CU-10 (agrupación y filtrado), CU-13 (clasificación correctiva) y CU-15 (rastro de los cambios) | Cubierto | La transición de estado atribuida por error a CU-10 se eliminó del diagrama (H-07) y la edición de `clase`/`nivel` exige rol y ámbito de cuadrilla. La métrica «asignados por día» queda definida por **D-48** a partir de `fecha_asignacion` (H-28 cerrado). |
| RF-24 | CU-08, CU-10, CU-12, CU-13, CU-14, CU-16 (persistencia inmediata) y CU-21 (respaldo del archivo) | Cubierto | Persistencia, relectura, **control de concurrencia por comparación de marca (D-41, RNF-14)** y **escritura verificada con respaldo previo (D-42, RNF-15)** aplicados; cada cambio añade además su línea a `historial.jsonl` (D-56); H-11 cerrado. |
| RF-25 | CU-19 (despacho en pantalla y PDF; seguimiento semanal estadístico Sem 1 a Sem 36) y CU-18 (zona GESTION SEMANAL) | Cubierto | Reconciliado con D-34 (H-23 cerrado); sin XLSX. |
| RF-26 | CU-20 (averías concentradas) y CU-20 (casos especiales EMP/REF abiertos, D-33) | **Parcial** | Criterio de caso especial cerrado y sin rótulo provisional; permanece el conteo de averías concentradas por semana operativa sujeto a la definición de corte de la semana. |
| RF-27 | CU-07 (palabras clave y modo de búsqueda) | Cubierto | Semántica del modo `estricta` definida por **D-43** (subcadena literal, sensible a mayúsculas y tildes, sin variantes); P3 cerrado. |
| RF-28 | CU-13 (edición y uso de `tipo_abonado`) y CU-10 (edición en línea) | Cubierto | — |
| RF-29 | CU-06 (CRUD de sectores) y CU-09 (propuesta de sector desde la cola, aprobada por el supervisor) | Cubierto | La excepción del operador queda acotada por D-35 y convertida en propuesta por D-60. |

**Resultado: 29 de 29 RF cubiertos; ningún RF queda sin caso de uso.** Tras esta sincronización queda **1** fila en estado **Parcial** —**RF-26** (conteo de averías concentradas por semana operativa sujeto a la definición de corte de la semana)—, **no** por falta de dueño funcional. RF-17, RF-23, RF-24 y RF-27, antes «Parcial», pasan a **Cubierto** con **D-42**, **D-43** y **D-48** (H-11, H-28 y P3 cerrados). Las filas RF-01, RF-10 y RF-20 ya habían pasado a **Cubierto** en la revisión anterior (H-20, H-24, H-34).

### 5.1 Cobertura de RNF, RT y RN

**Verificación de esta tabla (H-19, H-N-16):** cada fila se regeneró **desde las 22 líneas «Trazabilidad» de los casos de uso**, que son la fuente única; no se conserva ninguna atribución que esas líneas no respalden. La columna **Estado** distingue «Verificado» (contrastado línea a línea) de «Con reserva» (el requisito se cumple, pero arrastra un asunto abierto de §5.4).

| Grupo | Cobertura | Estado |
|---|---|---|
| RNF-01 | CU-10, CU-11, CU-13, CU-16, CU-18, CU-19, CU-20 | Verificado |
| RNF-02 | CU-08, CU-10, CU-11, CU-18 | Verificado (umbrales con punto de medida explícito) |
| RNF-03 | CU-01, CU-22 | Verificado |
| RNF-04 | CU-03, CU-04, CU-05, CU-06, CU-08, CU-14, CU-21, CU-22 | Verificado |
| RNF-05 | CU-17 | Verificado |
| RNF-06 | CU-08, CU-11, CU-12, CU-18, CU-19 | Verificado |
| RNF-07 | CU-01, CU-04, CU-10, CU-18, CU-19 | Verificado |
| **RNF-08** | CU-01, CU-02, CU-03, **CU-08**, CU-09, CU-10, CU-11, CU-12, CU-13, **CU-14**, CU-15, CU-18, CU-19, CU-20, CU-21, **CU-22** | Verificado con las altas de esta revisión: CU-08 y CU-14 declaran la sesión válida y el no-renderizado (H-N-03) y CU-22 la exige también en modo descarga (H-N-02); **D-61** fija de dónde sale el rol (`rol` de `tecnicos.json`) y **D-62** el único alta de padrón sin sesión (arranque en frío, CU-03) |
| RNF-09 | CU-01, CU-02, CU-03, CU-04, CU-05, CU-06, CU-07, CU-08, CU-09, CU-10, CU-12, CU-13, CU-14, CU-15, CU-16, CU-20 | **Historial resuelto (D-56):** los cambios de caso (campo, valor anterior y valor nuevo) se conservan de forma **inmutable** en `historial.jsonl` (*append-only*) y su consulta es CU-15. **Registro de accesos resuelto (D-57, D-58, D-64):** los intentos fallidos de sesión y las acciones denegadas por rol se anotan en el **log de la aplicación** (5 MB × 5 archivos, **sin datos personales**, §1.20), **no** en `historial.jsonl`; **D-64** fija el destino, el contenido y la rotación (`incidencias.1.log` … `incidencias.5.log`); H-N-17 queda cerrado y no subsiste ninguna reserva en RNF-09 |
| RNF-10 | CU-02, CU-03, CU-04, CU-05, CU-06, CU-07, CU-08, CU-10, CU-11, CU-12, CU-13, CU-14, CU-16, CU-21 | Verificado |
| RNF-11 | CU-16, CU-17, CU-19 | Verificado |
| **RNF-12** | **CU-01 a CU-22 (los 22 casos de uso)** | **Verificado (D-35, D-55):** los 22 declaran el rol en su línea Trazabilidad; **CU-08 y CU-14** incorporan en esta revisión la precondición de rol, el flujo de denegación, el Gherkin negativo y el EARS de autorización (H-N-03) |
| **RNF-13** | **Transversal: CU-01 a CU-22 (todos los casos de uso con interfaz); verificación formal en CU-01 (diálogo de sesión), CU-10 (tabla de CASOS), CU-18 y CU-19 (gráficos con tabla o texto alternativo equivalente)** | Verificado (D-40) |
| **RNF-14** | **CU-02 a CU-10, CU-12, CU-13, CU-14, CU-15, CU-16, CU-20, CU-21** (todos los que escriben archivos compartidos; incluye **CU-09**, incorporado en esta revisión) | Verificado (D-41); probado con dos ventanas en CU-12 y con Gherkin de conflicto en CU-02, CU-03, CU-04, CU-05, CU-06, CU-07, CU-08, CU-09, CU-10, CU-13, CU-14, CU-15, CU-16, CU-20 y CU-21 |
| **RNF-15** | **CU-08, CU-09, CU-10, CU-12, CU-13, CU-14, CU-16, CU-20 y CU-21** (todos los CU que escriben `averias.json`) | **Verificado (D-42):** se **retira la hipótesis** sobre CU-10 y se **añade CU-09** (H-N-06, H-N-16); patrón único: `.bak` con las 10 últimas, archivo temporal, relectura comparada y restauración |
| **RNF-16** | **CU-21** (dueño del respaldo; citado además en **CU-14, CU-15, CU-19 y CU-22**) | **Verificado (D-49):** copia **`averias_AAAA-MM-DD_HHMM.json`** en `C:\GGTO\respaldo\`, sin cifrado; restauración con confirmación, RTO 1 hora y RPO del cierre del día anterior (H-N-08) |
| RT-01 | CU-02, CU-03, CU-04, CU-05, CU-06, CU-08, **CU-09**, CU-10, CU-12, CU-14, CU-21 | Verificado |
| RT-02 | CU-08 | Verificado |
| RT-03 | CU-02, CU-08, CU-09 | Verificado |
| RT-04 | CU-08, CU-10, CU-11 | Verificado |
| RT-05 | CU-05, CU-16, CU-17 | Verificado (ampliado con D-31) |
| RT-06 | CU-01, CU-22 | Verificado |
| RT-07 | CU-01, CU-07, CU-17, CU-18, CU-22 | Verificado |
| RT-08 | CU-08 | Verificado |
| RT-09 | CU-01, CU-22 | Verificado |
| RT-10 | CU-01, CU-21, **CU-22** | Verificado |
| RT-11 | **Fuera del alcance de los casos de uso** (ubicación del repositorio git; ver `entornos_globales.md` §7.1) | Declarado fuera de alcance, igual que D-08 y D-22 |
| RN-01 | CU-08, CU-14 | Verificado |
| RN-02 | CU-08, CU-14 | Verificado |
| RN-03 | CU-07, CU-08 | Verificado |
| RN-04 | CU-02, CU-06, CU-08, CU-09, CU-20 | Verificado |
| RN-05 | CU-05, CU-16 | Verificado |
| RN-06 | CU-05, CU-13, CU-16 | Verificado |
| RN-07 | CU-09, CU-10, CU-12, CU-13, CU-14, CU-16 | Verificado |
| RN-08 | CU-18, CU-19, CU-20 | Verificado (los 4 «Dados» con rango semanal usan 07/09–12/09/2026, H-N-22) |
| **S-RNF-02b** (derivado) | CU-08 (rendimiento de la ingesta, con punto de medida explícito) | **Derivado del analista** — pendiente **técnico** de calibración, no decisión del usuario (ver §5.4, n.º 1) |

**Lectura de la tabla:** los 16 RNF y los 10 RT aplicables tienen al menos un CU asignado; **RNF-12, RNF-13 y RNF-14** son de cobertura amplia o transversal y **RNF-15** cubre exactamente la lista canónica de los 9 CU que escriben el maestro. Las cuatro decisiones que la reauditoría marcó como ausentes —**D-51, D-52, D-53 y D-54**— quedan citadas en esta revisión, y **D-55** en la línea Trazabilidad de CU-03, CU-15, CU-16, CU-17, CU-18, CU-19, CU-20, CU-21 y CU-22 (además de las reglas de la matriz de §2.1). **D-56** se cita en CU-08, CU-09, CU-10, CU-12, CU-13, CU-14, CU-15, CU-16, CU-20 y CU-21; **D-57** y **D-58** en CU-01, con **D-58** también en CU-08, CU-14 y CU-22 y, por la convención **§1.20**, en todos los CU que registran una acción denegada; y **D-59** en CU-08 y CU-09. **En la cuarta pasada** se añaden **D-61** (el rol de la sesión sale del campo `rol` de `tecnicos.json`; **CU-01** y **CU-03**, y es la fuente del rol de la matriz de §2.1), **D-62** (arranque en frío del primer supervisor; **CU-03**), **D-63** (formato de la credencial SHA-256; **CU-01** y **CU-03**) y **D-64** (log de accesos `incidencias.log` con rotación 5 MB × 5 archivos; **CU-01** y **CU-15**, y por **§1.20** transversal a las denegaciones por rol).

### 5.2 Decisiones aplicadas y trazabilidad de decisiones

**Fuente única:** las decisiones se atribuyen **solo** a los casos de uso cuya línea **Trazabilidad** (o cuyo cuerpo, cuando la decisión se aplica dentro del CU) las cita de verdad; las filas «fuera del alcance» remiten a los documentos donde viven.

| Decisión | Casos de uso |
|---|---|
| D-01 (servidor local + File System Access API) | CU-01, CU-21, CU-22 |
| D-02 (MVP = C1-C3) | Índice de casos de uso (columna Ciclo/Prioridad) |
| D-03 (sectores por listas de vías y emparejamiento normalizado) | CU-06, CU-09 |
| **D-04** (`extra` = red / planta externa) | **Sin caso de uso que lo requiera**: la col. `extra` se muestra en la sección «Red y planta externa» del flotante (CU-11), pero ninguna funcionalidad depende de ella; se retira la atribución a CU-11 (H-N-16) |
| D-05 (RN-03: con claves → PEND; sin claves → GESTION) | CU-07, CU-08 |
| D-06 (`clase = REP` al ingerir; corrección manual) | CU-08, CU-10, CU-13, CU-14 |
| D-07 (ficha de cuadrilla) | CU-05, CU-16 |
| D-08 (contrato de 80 columnas; sin efecto por D-12) | Sin caso de uso propio; se cita como antecedente en CU-08 |
| D-09 (`averias.json` es el maestro) | CU-11 |
| D-10 (`informacion_1` / `informacion_2`) | CU-08, CU-11 |
| D-11 (palabras clave editables) | CU-07 |
| D-12 (`estructura.json` posicional) | CU-02, CU-08 |
| D-13 (`ASGN` cuarto estado) — **sin efecto por D-38** | Reemplazada por D-38 en CU-08, CU-10, CU-13 y CU-16 |
| D-14 (se descarta `alta_manual.csv`) | CU-14 |
| D-15 (loopback y solo la aplicación) | CU-01, CU-22 |
| D-16 (identificación y auditoría) | CU-01, CU-03, CU-12, CU-15, **CU-14** (inicialización manual de `usuario_modificacion`) |
| D-17 (`tipo_abonado` RES/EMP) | CU-08, CU-10, CU-13, CU-14, CU-18 |
| D-18 (alta manual con `MAN-`) | CU-08 (rechazo del prefijo), CU-14 |
| D-19 (`datos/` en disco local con respaldo) | CU-01, CU-21, CU-22 |
| D-20 (cierre bloqueante e integridad) | CU-12, CU-14 |
| D-21 (ingesta estricta y fechas recortadas) | CU-08 |
| D-22 (git en disco local) | **Fuera del alcance de los casos de uso** (igual que RT-11); se retiró la atribución errónea a CU-01 (H-20) |
| D-23 (abierto = distinto de CERRADO; tipo = clase + nivel) | CU-10, CU-13, CU-18, CU-20 |
| D-24 (umbrales de desempeño) | CU-10, CU-11, CU-18 |
| D-25 (CRUD de sectores y umbral de concentración) | CU-06, CU-09, CU-20 |
| D-26 (subcadena normalizada y vista previa) | CU-07, CU-08 |
| D-27 (control documental del PDF: entrega, recogida y destrucción; no a Descargas) | CU-17, CU-19, CU-21, **CU-22** (destino controlado y modo descarga) |
| D-28 (retención indefinida, riesgo aceptado y ficha de tratamiento) | CU-12, CU-15, CU-19, CU-21 |
| D-29 (`P00` = código de empleado único, obligatorio y parte de la credencial) | CU-01, CU-03, CU-10, CU-11, CU-12, CU-13 |
| D-30 (citados = `fecha_cita` del día, con prioridad y marca CITADO) | CU-13, CU-16 |
| D-31 (`despacho.json` ampliado con `sector`, `Reparador Principal` y `fecha_despacho`) | CU-05, CU-16, CU-17, CU-19 |
| D-32 (desempate: zona preferente → menor carga → `id` menor) | CU-16 |
| D-33 (casos especiales = EMP o REF abiertos, criterio definitivo) | CU-20 |
| D-34 (solo el despacho en pantalla + PDF; seguimiento semanal estadístico Sem 1 a Sem 36; sin XLSX) | CU-18, CU-19 |
| **D-35** (matriz de permisos operador/supervisor; absorbe la función administrativa) | **CU-01 a CU-22** (matriz en §2.1) |
| D-36 (respaldo manual a demanda, sin automatismo) | CU-21 |
| D-37 (`cuadrillas.id` = `Reparador Principal`; asignación persistida) | CU-01, CU-05, CU-10, CU-11, CU-12, **CU-14**, CU-16, CU-17 |
| D-38 (`ASGN` se ingiere como `PEND`) | CU-08, CU-10, CU-13, CU-16 |
| D-39 (`P00` + contraseña con hash, sal, caducidad de 90 días y restablecimiento) | CU-01, CU-03, CU-10, CU-11, CU-12, CU-13, **CU-14, CU-22** |
| D-40 (accesibilidad mínima obligatoria) | **Transversal CU-01 a CU-22**; verificación formal en CU-01, CU-10, CU-18 y CU-19 |
| D-41 (concurrencia sin bloqueo: relectura y decisión entre recargar o sobrescribir) | CU-02 a CU-10, CU-12, CU-13, CU-14, CU-15, CU-16, CU-20, CU-21 |
| D-42 (escritura verificada con respaldo previo; RNF-15) | **CU-08, CU-09, CU-10, CU-12, CU-13, CU-14, CU-16, CU-20, CU-21** (y la convención §1.15) |
| D-43 (modo `estricta`: subcadena literal, sin variantes) | CU-07, CU-08 |
| D-44 (umbral de la ingesta: 80 columnas y coincidencia posicional, sin umbral porcentual) | CU-08 |
| D-45 (expiración de sesión: 8 horas y cierre al cerrar la pestaña) | CU-01, **CU-10, CU-11, CU-18, CU-19, CU-20, CU-22** (pérdida de sesión en los CU de consulta, gráficos y contingencia) |
| D-46 (CSV ausente: «sin ingesta», novedad en `datos/incidencias.log`) | CU-08, CU-22 |
| D-47 (el alta manual no incorpora Tipo, Actividad ni Agente) | CU-14 |
| D-48 (`fecha_asignacion` = fecha de la última asignación; métrica «asignados por día») | CU-05, **CU-14**, CU-16, CU-18 |
| D-49 (política de respaldo: copia fechada con hora al cierre en `C:\GGTO\respaldo\`; RTO 1 hora y RPO del día anterior; RNF-16) | **CU-21** (y citada en CU-14, CU-15, CU-19 y CU-22) |
| D-50 (sin sesión válida la página no muestra ningún dato) | **CU-01, CU-10, CU-11, CU-18, CU-19, CU-20 y CU-22** (transversal a toda la interfaz) |
| **D-51** (ubicación del proyecto: `C:\GGTO\proyecto`; Google Drive sale del flujo) | **Fuera del alcance funcional de los casos de uso** (como D-08, D-22 y RT-11): es una decisión de entorno y se documenta en `entornos_globales.md` y en las convenciones §1.10 y §1.16 de este documento |
| **D-52** (`sectores.id` = texto único; `usuario_modificacion` y `fecha_modificacion` se inicializan con la **col. 20** del CSV y la **fecha de ingesta**) | **CU-08** (inicialización por ingesta), **CU-14** (inicialización manual con el `P00` de la sesión), **CU-15** (lectura del rastro) |
| **D-53** (las columnas **53 y 80 no se persisten**: el rastro de origen se limita a la col. 20 y a la fecha de ingesta) | **CU-08** (paso 4, CA 13, EARS y trazabilidad) y **CU-15** (precondición, paso 2, CA 2, EARS y trazabilidad) |
| **D-54** (la **col. 18 `fecha_compromiso` no se persiste**; los citados salen de `fecha_cita`, D-30) | **CU-08** (paso 4, EARS y trazabilidad) |
| **D-56** (historial inmutable: cada cambio **añade** una línea a `historial.jsonl` —*append-only*— con `fecha_hora`, `operador`, `id_averia`, `campo`, `valor_anterior`, `valor_nuevo` y `accion`; cierra H-10 y completa RNF-09) | **CU-08** (línea de ingesta), **CU-09** (sector), **CU-10** (edición en línea), **CU-12** (cierre y reapertura), **CU-13** (reclasificación), **CU-14** (alta y asignación), **CU-15** (lectura y consulta de la secuencia), **CU-16** (asignación del despacho), **CU-20** (anotación de acciones) y **CU-21** (el historial se copia con el maestro y no se recorta) |
| **D-57** (sin bloqueo por intentos fallidos: cada intento de sesión se registra con fecha, hora y `P00` intentado, pero **la cuenta no se bloquea**) | **CU-01** (flujos 4a, 5a y 7a, sus Gherkin 3 y 5 y sus EARS) y **§1.20** (convención del registro de accesos) |
| **D-58** (datos personales: se mantiene D-36, ficha de tratamiento en `entornos_globales.md` §12 y **log de la aplicación con rotación por tamaño de 5 MB × 5 archivos, sin datos personales**) | **CU-01** (intentos fallidos), **CU-08** (denegación de la ingesta), **CU-14** (denegación del alta) y **CU-22** (consulta del log y errores); por la convención **§1.20**, transversal a las acciones denegadas por rol de **CU-02 a CU-22** |
| **D-59** (el emisor del CSV **solo** participa en CU-08: se retira su relación con CU-09; la cola de direcciones sin sector la resuelve el supervisor) | **CU-08** (actor secundario y trazabilidad), **CU-09** (precondición, nota de rol del flujo y trazabilidad) y **§2 y §2.1** (tabla de actores y matriz acción×rol) |
| **D-55** (solo existen **dos roles**: operador y supervisor; el «jefe de central» y la «auditoría / control interno» se retiran y sus funciones las ejerce el supervisor) | **§2 y §2.1** (tabla de actores y matriz) y **CU-01, CU-03, CU-15, CU-16, CU-17, CU-18, CU-19, CU-20, CU-21, CU-22** |
| **D-61** (el rol de la sesión se lee del campo **`rol` de `tecnicos.json`**: `Operador` / `Supervisor`, por defecto `Operador`; junto con `status` determina la matriz de D-35/RNF-12) | **CU-01** (paso 10, CA 20 y 21, EARS y trazabilidad), **CU-03** (pasos 0, 2 y 3, flujo 4f, CA 11, 13 y 14, EARS y trazabilidad) y **§1.21** (convención del rol de la sesión); es la fuente del rol de la matriz de **§2.1** |
| **D-62** (arranque en frío: si `tecnicos.json` está vacío la página ofrece crear el **primer supervisor**, único alta de padrón sin sesión; nace con `rol = Supervisor` y `clave_cambio_obligatorio = SI`) | **CU-03** (precondición, paso 0, flujo 2b, CA 10 a 12, EARS y trazabilidad) y **§1.22** (convención del arranque en frío) |
| **D-63** (formato de la credencial: `clave_hash` = **SHA-256 hexadecimal de 64 caracteres** de `clave_sal + ":" + contraseña` en **UTF-8**; `clave_sal` aleatoria por técnico) | **CU-01** (pasos 7 y 9 y EARS de credencial) y **CU-03** (postcondición, pasos 0 y 5, CA 11 y EARS) |
| **D-64** (log de accesos: `datos/incidencias.log` con intentos fallidos y acciones denegadas —fecha y hora, `P00` intentado y motivo, **sin datos personales**— y rotación de **5 MB × 5 archivos**: `incidencias.1.log` … `incidencias.5.log`) | **CU-01** (intentos fallidos: flujos 4a/5a/7a, CA 3 y 5, EARS de rotación y trazabilidad), **CU-15** (la denegación de la consulta va al log, no al historial) y **§1.20** (convención del registro de accesos); por la convención **§1.20**, transversal a las acciones denegadas por rol de **CU-02 a CU-22** |

**Nota de verificación (H-19, H-N-16, H-N-27).** La atribución de cada decisión se contrastó con la línea **Trazabilidad** del caso de uso correspondiente. Se corrigieron en esta revisión: **RNF-12** («aplicado en los 22 CU» ahora respaldado por CU-08 y CU-14), **RNF-15** (se retira la hipótesis sobre CU-10 y se añade CU-09 con su Gherkin), **RNF-16** (CU-15 sí cita D-49/RNF-16 en su EARS), **D-04** (se retira la atribución a CU-11, sin respaldo), **D-22** (retirado de la trazabilidad de CU-01), **D-30** (añadido a CU-13 y CU-18), **D-45/D-49/D-50** (añadidos a los CU que los aplican en su cuerpo), **D-35, D-37, D-41, D-42, D-48** (añadidos a CU-14) y **D-56** (añadido a CU-08, CU-09, CU-10, CU-12, CU-13, CU-14, CU-15, CU-16, CU-20 y CU-21, con su Gherkin de inmutabilidad en CU-15 y en CU-21). D-13 queda **sin efecto** por D-38. **D-08, D-22, D-51 y RT-11** se declaran **fuera del alcance de los casos de uso** y se remiten a `entornos_globales.md` y `requerimientos.md`; **D-52, D-53, D-54 y D-56** se citan en este documento en las líneas indicadas arriba. **En la última pasada de coherencia** se añaden **D-57 y D-58** —intentos fallidos de sesión y acciones denegadas por rol, anotados en el **log de la aplicación** (§1.20), atribuidos a **CU-01** y a los CU que registran el intento— y **D-59** —el **emisor del CSV** queda como actor secundario **solo de CU-08** y se retira su relación con **CU-09**, cuya cola resuelve el supervisor—.

### 5.3 Decisiones aplicadas en lugar de supuestos (H-04)

Las 18 ambigüedades están cerradas y **no queda ningún supuesto** en este documento. Esta tabla sustituye a la antigua sección «Supuestos por ambigüedades abiertas» y permite verificar la sustitución:

| Ambigüedad cerrada | Decisión | Casos de uso que la aplican | Dónde se cita |
|---|---|---|---|
| A-05 («casos citados del día») | **D-30** | CU-16 | Precondición, paso 4, flujo 4b, CA 7, EARS y trazabilidad |
| A-08 (formato de los reportes) | **D-34** | CU-18, CU-19 | Precondición, pasos 2 a 5, flujos 1a y 4b, CA 1 a 5, EARS y trazabilidad |
| A-09 («casos especiales») | **D-33** | CU-20 | Precondición, paso 6, flujo 6a, CA 5, EARS y trazabilidad |
| A-10 (desempate de cuadrilla para construcción) | **D-32** | CU-16 | Paso 6, flujo 6a, CA 3 a 6, EARS y trazabilidad |
| A-11 (significado de `P00`) | **D-29** y **D-39** | CU-01, CU-03 | Diálogo, pasos 4 a 9, flujos 4a/5a/7a/8a, CA 1 a 7, EARS y trazabilidad |
| A-14 (composición de `despacho.json`) | **D-31** | CU-05, CU-16, CU-17, CU-19 | Flujo 6a/9b de CU-05 y CU-16, paso 2 y CA 2 de CU-17, CA 8 de CU-16, EARS y trazabilidad |
| *(nueva, no era ambigüedad documentada)* estatus `ASGN` del CSV | **D-38** | CU-08, CU-10, CU-13, CU-16 | Paso 6 y CA 3 y 4 de CU-08, nomenclatura de CU-10 y CU-13, EARS y trazabilidad |

**Verificación mecánica:** la marca de supuesto por ambigüedad (el literal con corchete y el identificador A-xx) aparece **0 veces** en este documento.

### 5.4 Pendientes abiertos (única sección de pendientes del documento)

Esta es la **única** sección de pendientes del documento (sustituye a la lista final anterior, que estaba duplicada: H-19 y H-N-16). **No queda ningún punto `&lt;PENDIENTE&gt;` de decisión del usuario**, ni en el cuerpo de los casos de uso ni aquí: **D-55 a D-59** cerraron los últimos asuntos que exigían decisión. Quedan abiertos **cuatro pendientes técnicos de implementación** (ninguno de negocio).

> **Cerrado en esta última pasada de coherencia (D-55 a D-59).** Ya **no son pendientes**: (a) el **historial inmutable de valores anteriores** → `historial.jsonl` *append-only* (§1.19, D-56; H-10); (b) la **ficha de tratamiento de datos personales** y el **paquete versionado en repositorios privados** → D-58 y `entornos_globales.md` §12 (H-N-31, H-N-10); (c) el **bloqueo de la cuenta por intentos fallidos** → no hay bloqueo: cada intento se registra (D-57; H-N-07); (d) el **formato, la rotación y el destino del registro de intentos y acciones denegadas** → **log de la aplicación** de **5 MB × 5 archivos, sin datos personales** (§1.20, D-58; H-N-17), distinto de `historial.jsonl`, que **solo** registra cambios de campos de un caso; (e) el **diccionario de datos rezagado** → su Anexo A ya refleja que las columnas **18, 53 y 80 no se copian** (D-53, D-54; H-N-29); y (f) la **relación del actor «emisor del CSV» con CU-09** → se retira: es actor secundario **solo de CU-08** (D-59).

*(Nota de numeración: el apartado «Decisiones aplicadas en lugar de supuestos» que antes llevaba el ordinal **5.3** se conserva a continuación con el ordinal **5.5**, para que la sección de pendientes sea la única con el rótulo 5.4 de esta revisión; el contenido de ambas es el mismo que en la revisión anterior.)*

| # | Asunto abierto | Por qué no se aplica | Hallazgo | Dónde queda anotado |
|---|---|---|---|---|
| 1 | **Umbral de desempeño propio de la ingesta** (derivado **S-RNF-02b**: &lt; 3 s con punto de medida explícito) | Pendiente **técnico** de calibración en la implementación, no decisión de negocio | H-27 | CU-08, CA 14; §5.1 |
| 2 | **Conteo de averías concentradas por semana operativa:** fijar la definición exacta del corte de la semana al implementar CU-20 | Pendiente **técnico**; RF-26 queda en estado «Parcial» por esta razón | H-14 / RF-26 | CU-20; §5, fila RF-26 |
| 3 | **Procedimiento de escalamiento con el emisor del CSV** cuando el archivo del día no llega: definir el canal y el responsable | Pendiente **técnico-operativo**, ajeno a la lógica de los CU | H-15 | CU-08, flujo 2c; CU-22, paso 6 |
| 4 | **Versiones de las librerías locales de `lib/`** (CSV, gráficos y PDF) por fijar antes de C1, junto con el lanzador | Pendiente **técnico** de C1 | RT-07 | CU-22 |

**Asuntos de actores y roles: cerrados por D-55.** El «jefe de central» y la «auditoría / control interno» **no son roles del sistema**: solo existen **operador** y **supervisor**, y las funciones de ambos actores retirados (consumo de cifras, consulta de la auditoría de cambios y control documental del despacho) las ejerce el **supervisor** (D-55). Quedan cubiertos, por tanto, los puntos 4, 5 y 6 de las preguntas P6/§8 de la reauditoría (H-N-20) y **no** se añade ningún rol de solo lectura. **No queda abierto ningún punto de actores**: la única observación pendiente (relación «emisor del CSV» ↔ CU-09) queda **cerrada por D-59**, con el emisor como actor secundario **solo de CU-08** y la cola de direcciones sin sector resuelta por el **supervisor** (rol elevado).

**Riesgos aceptados y puntos que D-42 a D-59 cerraron y ya no figuran como pendientes:** la **escritura verificada con respaldo previo** —no «atómica»: D-42 solo especifica copia previa `.bak`, archivo temporal, relectura comparada y restauración— y el versionado del maestro (**D-42**, RNF-15; H-11, H-N-18), la **semántica del modo `estricta`** (**D-43**; H-15/P3), el **algoritmo de RN-03** que planteaba **H-08** (resuelto por D-26 y D-43), la **expiración de sesión de 8 horas** (**D-45**; H-03), el **CSV ausente** (**D-46**; H-N-12 en su parte funcional), el **mapeo de Tipo/Actividad/Agente del alta manual** (**D-47**; H-02), la **métrica «Asignados» de la zona Cuadrilla** (**D-48**; H-28), la **política de respaldo** —ruta `C:\GGTO\respaldo\`, ausencia de cifrado, quién la custodia, RTO 1 hora y RPO del cierre del día anterior, con copia `averias_AAAA-MM-DD_HHMM.json` para no colisionar el mismo día— (**D-49**, RNF-16; H-12, H-13, H-N-08), el **alcance de lo visible antes de iniciar sesión**, que queda en **nada: solo el diálogo de acceso**, también en el **modo descarga** (**D-50**, RNF-08; H-31, H-N-02), la **ubicación del proyecto en `C:\GGTO\proyecto`** (**D-51**; H-N-27), la **inicialización del rastro de auditoría con la col. 20 y la fecha de ingesta** (**D-52**, **D-53**; H-N-01), la **no persistencia de la col. 18 `fecha_compromiso`** (**D-54**; A-04), los **dos únicos roles del sistema** (**D-55**; H-N-20) y el **historial inmutable de valores anteriores** en `historial.jsonl` *append-only* (**D-56**, RNF-09; H-10 y el punto que la lista anterior abría sobre el historial), el **registro de los intentos fallidos de sesión y de las acciones denegadas por rol** en el **log de la aplicación** de **5 MB × 5 archivos**, **sin datos personales** y sin bloqueo de la cuenta (**D-57**, **D-58**, §1.20; H-N-07, H-N-17, H-N-31) y el **alcance del actor «emisor del CSV»**, limitado a CU-08 (**D-59**).

**Huecos de la auditoría y de la reauditoría cerrados en esta revisión (ya no figuran como pendientes):** H-01 (cifras de la ingesta con **18 PEND + 33 GESTION**, D-38), H-03 (credencial con contraseña, hash y sal, D-39), H-05/H-21 (accesibilidad, D-40 y RNF-13), H-04 (supuestos sustituidos por D-29 a D-34), H-08 (algoritmo de RN-03 especificado por D-26 y D-43), H-10 (concurrencia, D-41 y RNF-14; y **historial de valores anteriores, D-56**), H-02 (mapeo de Tipo/Actividad/Agente, D-47), H-11 (escritura verificada y versionado, D-42 y RNF-15), H-12 y H-13 (política de respaldo, D-49 y RNF-16), H-28 (métrica «asignados por día», D-48), H-31 (alcance visible sin identificación, D-50 y RNF-08), H-15/P3 (modo `estricta`, D-43) y **H-29** (el campo TEXTO `fecha_modificacion` ya no se filtra por rango: cerrado en CU-15 y en §1.14); y de la reauditoría: **H-N-01** (D-52/D-53/D-54), **H-N-02** (sesión en modo descarga, D-50/D-27), **H-N-03, H-N-04 y H-N-05** (permisos, actores y asignación de cuadrilla en CU-08 y CU-14), **H-N-06** (CU-09 dentro de D-42/RNF-15), **H-N-08** (colisión del respaldo fechado; el historial se copia íntegro, D-56), **H-N-09** (destrucción de hojas en CU-17), **H-N-10** (ficha de tratamiento citada por D-28), **H-N-13** (`clave_cambio_obligatorio` en CU-01), **H-N-14** (EARS de expiración unificados), **H-N-15** (CA-12 de CU-01 con las 7 pestañas reales), **H-N-16** (tablas §5.1/§5.2 regeneradas), **H-N-18** («escritura atómica» sustituida por «escritura verificada con respaldo previo»), **H-N-19** (D-45 y D-50 en los diagramas), **H-N-22** (semana operativa lunes–sábado en CU-18, CU-19 y CU-20), **H-N-23** (inventario de relaciones de los diagramas), **H-N-24** (criterios no falsables reescritos en CU-11, CU-15 y CU-18), **H-N-25** (desglose 17/34 del encabezado), **H-N-26** (renumeración de los flujos de CU-11), **H-N-27** (rango de decisiones y filas D-51 a D-55), **H-N-29** (el **Anexo A del diccionario ya refleja que las columnas 18, 53 y 80 no se copian**: el punto 9 de la lista anterior queda cerrado), **H-N-30** (convención de las marcas `[H-xx]`), **H-N-20** (actores, por **D-55**), **H-N-07** (intentos fallidos sin bloqueo de la cuenta, **D-57**), **H-N-17** (destino de los intentos y las denegaciones: el log de la aplicación, **D-58** y §1.20) y **H-N-31** (ficha de tratamiento y paquete de datos personales en repositorios privados, **D-58**).

**Preguntas de la reauditoría que ya NO están abiertas (resueltas en esta pasada):** (a) el **bloqueo por intentos fallidos** → **D-57** (se registran y **no** se bloquea la cuenta); (b) el **registro de intentos y denegaciones** → **D-58** y **§1.20** (log de la aplicación, **5 MB × 5 archivos**, sin datos personales, con rotación por tamaño: no es un archivo *append-only*); (c) la **política sobre el paquete de datos personales versionado** y el formato del log → **D-58** (repositorios privados y ficha de tratamiento en `entornos_globales.md` §12) y (d) la **relación del emisor del CSV con CU-09** → **D-59** (se retira: es actor secundario solo de CU-08). Ninguna de las cuatro exige ya respuesta del usuario; los cuatro pendientes de la tabla son **técnicos de implementación**.

### 5.5 Decisiones aplicadas en lugar de supuestos (H-04)

Las 18 ambigüedades están cerradas y **no queda ningún supuesto** en este documento. Esta tabla sustituye a la antigua sección «Supuestos por ambigüedades abiertas» y permite verificar la sustitución:

| Ambigüedad cerrada | Decisión | Casos de uso que la aplican | Dónde se cita |
|---|---|---|---|
| A-05 («casos citados del día») | **D-30** | CU-13, CU-16 | Precondición, paso 4, flujo 4b, CA 7, EARS y trazabilidad de CU-16; paso 2 y CA 7 de CU-13 |
| A-08 (formato de los reportes) | **D-34** | CU-18, CU-19 | Precondición, pasos 2 a 5, flujos 1a y 4b, CA 1 a 5, EARS y trazabilidad |
| A-09 («casos especiales») | **D-33** | CU-20 | Precondición, paso 6, flujo 6a, CA 5, EARS y trazabilidad |
| A-10 (desempate de cuadrilla para construcción) | **D-32** | CU-16 | Paso 6, flujo 6a, CA 3 a 6, EARS y trazabilidad |
| A-11 (significado de `P00`) | **D-29** y **D-39** | CU-01, CU-03 | Diálogo, pasos 4 a 9, flujos 4a/5a/7a/8a, CA 1 a 7, EARS y trazabilidad |
| A-14 (composición de `despacho.json`) | **D-31** | CU-05, CU-16, CU-17, CU-19 | Flujo 6a/9b de CU-05 y CU-16, paso 2 y CA 2 de CU-17, CA 8 de CU-16, EARS y trazabilidad |
| A-01 (persistencia de las columnas 53 y 80 del CSV) | **D-53** | CU-08, CU-15 | Paso 4, CA 13 y EARS de CU-08; precondición, paso 2, CA 2 y EARS de CU-15 |
| A-04 (destino de la col. 18 `fecha_compromiso`) | **D-54** | CU-08 | Paso 4 y EARS de CU-08 |
| *(nueva, no era ambigüedad documentada)* estatus `ASGN` del CSV | **D-38** | CU-08, CU-10, CU-13, CU-16 | Paso 6 y CA 3 y 4 de CU-08, nomenclatura de CU-10 y CU-13, EARS y trazabilidad |
| *(nueva, no era ambigüedad documentada)* roles del sistema | **D-55** | §2 y §2.1; CU-03, CU-15 a CU-22 | Tabla de actores, matriz acción×rol y línea Trazabilidad de cada CU citado |

**Verificación mecánica:** la marca de supuesto por ambigüedad (el literal con corchete y el identificador A-xx) aparece **0 veces** en este documento.

---

**Registro de decisiones de la última pasada de coherencia (D-56 a D-59).** Se aplican **D-56** (historial inmutable `historial.jsonl` *append-only*: CU-08, CU-09, CU-10, CU-12, CU-13, CU-14, CU-15, CU-16, CU-20 y CU-21), **D-57** (los intentos fallidos de sesión se registran y **no** bloquean la cuenta: CU-01, flujos 4a/5a/7a, sus Gherkin y sus EARS), **D-58** (ficha de tratamiento de datos personales y **log de la aplicación** de **5 MB × 5 archivos**, **sin datos personales**, como destino de los intentos fallidos y de las acciones denegadas, **no** de `historial.jsonl`: convención **§1.20**, CU-01, CU-08, CU-14 y CU-22) y **D-59** (el **emisor del CSV** solo participa en **CU-08**: se retira su relación con CU-09, cuya cola resuelve el supervisor; §2, §2.1, CU-08 y CU-09). Con ello §5.4 queda con **cuatro pendientes técnicos** y **ningún** punto de decisión del usuario.

**Registro de decisiones aplicadas en la revisión anterior (D-51 a D-55 y correcciones de la reauditoría).** Se aplicaron **D-51** (ubicación del proyecto en `C:\GGTO\proyecto`; se cita en §1, en §5.2 y en el alcance declarado), **D-52** (`sectores.id` texto único y **inicialización del rastro de auditoría con la col. 20 y la fecha de ingesta** en CU-08, con su excepción de alta manual en CU-14), **D-53** (**las columnas 53 y 80 no se persisten**: CU-08 paso 4, CA 13 y EARS; CU-15 precondición, paso 2, CA 2 y EARS), **D-54** (la col. 18 no se persiste: CU-08 paso 4 y EARS) y **D-55** (**solo dos roles**; «jefe de central» y «auditoría / control interno» retirados: §2, §2.1 y la línea Trazabilidad de CU-03, CU-15, CU-16, CU-17, CU-18, CU-19, CU-20, CU-21 y CU-22). Además, en esta revisión se corrigieron **H-N-01 a H-N-30** con las excepciones declaradas en §5.4 y se cerraron **H-19** (tablas §5.1/§5.2 regeneradas desde las líneas Trazabilidad), **H-29** (`fecha_modificacion` es TEXTO: sin rangos de fecha sobre él) y **H-33** (`CU05 include CU06` añadido al bloque §1 de `diagramas.md`).

**Registro de decisiones de la revisión anterior (D-42 a D-50).** Se aplicaron **D-42** (escritura verificada con respaldo previo `averias_AAAA-MM-DD_HHMM.bak` —10 últimas copias—, archivo temporal, relectura y comparación, y restauración ante fallo; **RNF-15**) en los CU que escriben el maestro, hoy CU-08, **CU-09**, CU-10, CU-12, CU-13, CU-14, CU-16, CU-20 y CU-21; **D-43** (modo `estricta`) en CU-07 y CU-08; **D-44** (umbral de la ingesta) en CU-08; **D-45** (sesión de 8 horas) en CU-01 y, por pérdida de sesión, en CU-10, CU-11, CU-18, CU-19, CU-20 y CU-22; **D-46** (CSV ausente) en CU-08 y CU-22; **D-47** (alta manual sin Tipo/Actividad/Agente) en CU-14; **D-48** (`fecha_asignacion` y «asignados por día») en CU-05, **CU-14**, CU-16 y CU-18; **D-49** (copia fechada **con hora** `averias_AAAA-MM-DD_HHMM.json` al cierre en `C:\GGTO\respaldo\`, sin cifrado, RTO 1 hora y RPO del cierre del día anterior; **RNF-16**) en CU-21, alineando CU-14, CU-15, CU-19 y CU-22; y **D-50** (sin sesión válida la página no renderiza ningún dato) en **CU-01, CU-10, CU-11, CU-18, CU-19, CU-20 y CU-22**, con **RNF-08**.

**Registro de decisiones de la revisión anterior (D-29 a D-41).** Se aplicaron **D-29 a D-41**: D-29 (`P00` único y obligatorio), D-30 (citados por `fecha_cita`), D-31 (`despacho.json` ampliado), D-32 (desempate de la construcción), D-33 (casos especiales definitivos), D-34 (salidas de reportes), D-35 (matriz de permisos), D-36 (respaldo manual), D-37 (equivalencia de cuadrilla), **D-38 (`ASGN` del CSV entra como `PEND`; el maestro conserva tres estados)**, **D-39 (`P00` + contraseña con hash, sal, caducidad de 90 días y restablecimiento)** y **D-40 (accesibilidad mínima obligatoria, RNF-13)**. **D-41** (concurrencia sin bloqueo) se aplicó a todos los CU que escriben y se probó con un criterio de dos ventanas simultáneas en CU-12.

**Nota de cierre.** D-38 resolvió el bloqueo aritmético del corpus (H-01): la ingesta del 12/09/2026 produce **51 insertados → 18 PEND + 33 GESTION**, con el desglose «con/sin claves» corregido a **17/34** (H-N-25). D-39 cerró la brecha de autenticación (H-03) y D-40 la de accesibilidad (H-05/H-21). **D-41 cerró la concurrencia (H-10)**; **D-42 y RNF-15 cerraron H-11**; **D-49 y RNF-16 cerraron H-12 y H-13**; **D-50 y RNF-08 cerraron H-31**; y **D-52, D-53 y D-54 cerraron H-N-01** (el rastro de origen es la col. 20 y la fecha de ingesta, y las columnas 53, 80 y 18 no se persisten). **D-55 cierra H-N-20:** solo existen **dos roles** —operador y supervisor— y el «jefe de central» y la «auditoría / control interno» quedan retirados del modelo, con sus funciones en el supervisor. En la última pasada de coherencia, **D-57** y **D-58** cierran **H-N-07, H-N-17 y H-N-31** (los intentos fallidos de sesión y las acciones denegadas por rol se anotan en el **log de la aplicación** de **5 MB × 5 archivos**, **sin datos personales**, y la cuenta **no se bloquea**; `historial.jsonl` queda reservado a los cambios de campos de un caso) y **D-59** cierra la observación de actores (el **emisor del CSV** solo participa en **CU-08**). **Riesgo aceptado y documentado por el agente padre:** el hash en un archivo local servido sin TLS protege la atribución frente a suplantaciones casuales, pero **no** es una defensa fuerte frente a quien pueda leer `tecnicos.json` o capturar el tráfico en el puesto.