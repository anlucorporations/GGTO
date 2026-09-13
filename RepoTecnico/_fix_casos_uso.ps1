$ErrorActionPreference = 'Stop'
$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$t = Get-Content -LiteralPath $p -Raw -Encoding UTF8
$edits = New-Object System.Collections.ArrayList
function E($old, $new, $tag) {
  $script:t2 = $script:t.Replace($old, $new)
  if ($script:t2 -eq $script:t) { [void]$script:edits.Add("FALLO<<$tag>>") }
  else { [void]$script:edits.Add("OK<<$tag>>"); $script:t = $script:t2 }
}

# ---------- 1. Encabezado ----------
E '**Revisión:** 15/09/2026 (sincronización con `requerimientos.md`: se aplican **D-42 a D-50** y se añaden **RNF-15** y **RNF-16**).' '**Revisión:** 15/09/2026, segunda pasada (cierre de la reauditoría: corrección de H-N-01 a H-N-30 y de los residuos de H-19, H-29 y H-33; se aplican **D-51 a D-54** y se añaden **RNF-15** y **RNF-16**).' 'H-rev'

E '(29 RF, **16 RNF**, 11 RT, 8 RN, decisiones **D-01 a D-50**' '(29 RF, **16 RNF**, 11 RT, 8 RN, decisiones **D-01 a D-54**' 'H-norma'

E '`RepoTecnico/estado_proyecto.md` (estado y decisiones vigentes).' "``RepoTecnico/estado_proyecto.md`` (estado y decisiones vigentes),
  ``RepoTecnico/casos_uso/reauditoria_casos_uso.md`` (reauditoría del 15/09/2026: veredicto APTO CON RESERVAS, 30 hallazgos nuevos H-N-01 a H-N-30 y 3 anteriores sin cerrar —H-19, H-29 y H-33—, corregidos en esta revisión)." 'H-reaud'

E '`RepoTecnico/casos_uso/diagramas.md` (diagrama UML de casos de uso, diagramas de secuencia y diagrama de estados).' '`RepoTecnico/casos_uso/diagramas.md` (diagrama UML de casos de uso, diagramas de secuencia y diagrama de estados: 8 bloques Mermaid, todos sincronizados con esta revisión).' 'H-hermano'

# ---------- 2. §1 convenciones ----------
E 'Todo caso de uso cubre al menos un RF.' 'Todo caso de uso cubre al menos un RF. Las marcas **`[H-xx]`** que aparecen en algunos pasos y flujos **no son códigos de requisito**: identifican el **hallazgo de auditoría que originó la corrección** de ese texto (convención de §1.3 y residuo de H-N-30); el requisito aplicable se cita siempre junto a ellas (RF, RNF, RT, RN o D-xx).' 'H-N30'

E '**Muestra real del 12/09/2026:** 80 columnas, 56 registros y 3 centrales — **51 de Francisco Salias, 4 de LAS MERCEDES CPA y 1 de EL HATILLO**; los recuentos «17 con palabras clave y 39 sin ellas» que circulaban antes se calcularon **por error sobre los 56 registros**, no sobre los 51 filtrados (H-01). El desglose vigente de Francisco Salias es **14 PEND y 37 GESTION** (11 con claves + 3 con `estatus = ASGN`, que entran como PEND por D-38; y 37 sin claves).' '**Muestra real del 12/09/2026:** 80 columnas, 56 registros y 3 centrales — **51 de Francisco Salias, 4 de LAS MERCEDES CPA y 1 de EL HATILLO**; los recuentos «17 con palabras clave y 39 sin ellas» que circulaban antes se calcularon **por error sobre los 56 registros**, no sobre los 51 filtrados (H-01). El desglose vigente de Francisco Salias es **14 PEND y 37 GESTION**: a partir del `estatus` del CSV, 13 registros traen claves (11 con `estatus = PEND` + 2 con `estatus = ASGN`) y 38 no las traen (1 con `estatus = ASGN` + 37 con `estatus = PEND`); los **3 `ASGN` entran como PEND por D-38**, de modo que quedan **11 + 3 = 14 PEND** y **37 GESTION** (cuadre 13 + 38 = 51, H-N-25).' 'H-N25'

E 'Rango de decisiones vigente para este documento: **D-01 a D-50** (las decisiones **D-42 a D-50** se aplicaron en esta revisión).' 'Rango de decisiones vigente para este documento: **D-01 a D-54**. Las decisiones **D-42 a D-50** se aplicaron en la revisión del 15/09/2026 y las **D-51 a D-54** en esta segunda pasada (H-N-27).' 'H-N27'

E 'La concurrencia deja de ser un supuesto no verificado: es un requisito probado en CU-12, CU-13, CU-14, CU-15 y CU-21 y en los CU que editan padrones.' 'La concurrencia deja de ser un supuesto no verificado: es un requisito probado en CU-12, CU-13, CU-14, CU-15 y CU-21 y en los CU que editan padrones. La marca que se compara (`fecha_modificacion`) es un campo **TEXTO** `DD/MM/AAAA hh:mm` en el diccionario: la comparación es de **igualdad o de orden de texto con formato fijo**, nunca un rango de fechas (H-29).' 'H-29a'

E 'Aplica a todos los casos de uso que escriben `averias.json`: CU-08 (ingesta), CU-12 (cierre y reapertura), CU-13 (bandeja GESTION), CU-14 (alta manual), CU-16 (despacho), CU-21 (respaldo y restauración) y CU-22 (contingencia).' 'Aplica a **todos** los casos de uso que escriben `averias.json`, sin excepción: CU-08 (ingesta), **CU-09 (asignación de sector)**, CU-10 (edición en línea), CU-12 (cierre y reapertura), CU-13 (bandeja GESTION), CU-14 (alta manual), CU-16 (despacho), CU-20 (anotación de acciones), CU-21 (respaldo y restauración) y CU-22 (contingencia). CU-09 queda incorporado expresamente al flujo D-42/RNF-15 en esta revisión (H-N-06).' 'H-N06a'

E 'copia **fechada** del maestro —`averias_AAAA-MM-DD.json`— en **`C:\GGTO\respaldo\`**' 'copia **fechada con hora** del maestro —`averias_AAAA-MM-DD_HHMM.json`— en **`C:\GGTO\respaldo\`**' 'H-N08a'

E '—antes de identificarse solo se ve el diálogo de acceso—.' '—antes de identificarse solo se ve el diálogo de acceso—. La regla vale también para el **modo descarga** de CU-22: sin sesión válida no se carga ni se consulta el maestro y el diálogo de acceso es lo único visible (H-N-02).' 'H-N02conv'

E 'Con **D-42 a D-50** quedaron cerrados todos los puntos que dependían del usuario; §5.4 recoge únicamente los **pendientes técnicos de implementación** (no son decisiones de negocio) y no se marca ninguno en el cuerpo de los casos de uso.' 'Con **D-42 a D-54** quedaron cerrados todos los puntos de decisión que la reauditoría dejó planteados salvo los que exigen una decisión nueva del usuario (H-N-07, H-N-17, H-N-20, H-N-21 y el destino del paquete de datos personales, H-N-31): §5.4 es la **única** sección de pendientes y los recoge sin marcas `&lt;PENDIENTE&gt;` en el cuerpo de los casos de uso.' 'H-PEND'

# ---------- 3. §2 actores e índice ----------
E '| **Operador de la central** | Principal | Trabaja la operación diaria: ingiere el CSV, resuelve direcciones sin sector, **consulta** los casos de su cuadrilla, cierra los casos **asignados a su propia cuadrilla** y da de alta casos manuales. Se identifica en cada sesión con su `P00` **y su contraseña** contra `tecnicos.json` (D-16, D-29, D-39, RNF-08). **No** accede a los padrones, a la bandeja GESTION ni al respaldo (D-35, RNF-12). | CU-01, CU-08 a CU-14, CU-22 |' '| **Operador de la central** | Principal | Trabaja la operación diaria: ingiere el CSV (CU-08), resuelve direcciones sin sector (CU-09), **consulta** los casos de su cuadrilla (CU-10, CU-11), cierra los casos **asignados a su propia cuadrilla** (CU-12) y da de alta casos manuales (CU-14). Se identifica en cada sesión con su `P00` **y su contraseña** contra `tecnicos.json` (D-16, D-29, D-39, RNF-08). **No** accede a los padrones, a la bandeja GESTION (**CU-13, exclusiva del supervisor**), al despacho, al respaldo ni al catálogo completo de sectores (D-35, RNF-12). | **CU-01, CU-08, CU-09, CU-10, CU-11, CU-12, CU-14, CU-22** |' 'H-N04a'

E '| **Supervisor** (absorbe la función administrativa, D-35) | Principal | Responsable del despacho, de las cifras y del gobierno del sistema: puede **todo**, incluida la bandeja GESTION, los padrones, los sectores, las palabras clave, el despacho, el respaldo, la restauración y el restablecimiento de contraseñas. | CU-01 a CU-07, CU-10 a CU-22 |' '| **Supervisor** (absorbe la función administrativa, D-35) | Principal | Responsable del despacho, de las cifras y del gobierno del sistema: puede **todo**, incluida la bandeja GESTION (CU-13), los padrones (CU-03, CU-04, CU-05), los sectores (CU-06), las palabras clave (CU-07), la ingesta y la cola de sectores (CU-08, CU-09), el despacho y sus PDF (CU-16, CU-17), el MONITOREO y los reportes (CU-18, CU-19, CU-20), el respaldo y la restauración (CU-21), el diagnóstico (CU-22) y el restablecimiento de contraseñas. | **CU-01 a CU-22** |' 'H-N04b'

E '| **Auditoría / control interno** | Secundario | Consulta el historial de cambios y el control documental del despacho. | CU-15, CU-17 |' '| **Auditoría / control interno** | Secundario | Consulta el historial de cambios y el control documental del despacho. **Función declarada, sin rol propio:** la matriz de §2.1 solo define los roles operador y supervisor, de modo que hoy la auditoría **no puede ejercer** su función declarada sobre CU-15 (que exige rol supervisor). Queda como punto abierto en §5.4 (H-N-20). | CU-15, CU-17 (pendiente de rol de solo lectura) |' 'H-N20a'

E '| **Soporte TI del puesto** | Secundario | Atiende el arranque del puesto (puerto ocupado, ausencia de Python/Node, navegador sin File System Access API, fallo de la ruta de respaldo). No tiene permisos de escritura sobre los datos. | CU-01, CU-21, CU-22 |' '| **Soporte TI del puesto** | Secundario | Atiende el arranque del puesto (puerto ocupado, ausencia de Python/Node, navegador sin File System Access API, fallo de la ruta de respaldo). **No tiene permisos de escritura sobre los datos** y, por tanto, no figura en la matriz de §2.1; su criterio de aceptación propio es CU-22 (H-N-05, H-18). | CU-01, CU-21, CU-22 |' 'H-N05sop'

E '| **Jefe de central** | Principal (consumo) | Consume las cifras de MONITOREO y de los reportes y decide sobre los casos especiales. **No** está registrado en §2 ni tiene rol en la matriz §2.1: queda como punto abierto en §5.4 (H-N-20). | CU-18, CU-19, CU-20 (solo lectura) |
| **Emisor del CSV (origen corporativo / VENAPP)** | Secundario externo | Entrega el archivo diario `detalle_averias_gpon DD_MM_AAAA.csv`. No interactúa con la interfaz: es el origen del dato y el disparador de la ingesta. | CU-08, CU-09 |' 'H-N20b'

E '| Respaldo, restauración y cambio de umbral (CU-21) | **Prohibida** | Permitida |' '| Respaldo y restauración (CU-21) | **Prohibida** | Permitida |
| Cambio del umbral de averías concentradas (CU-20) | **Prohibida** | Permitida |' 'H-N04c'

E '| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |' '| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |
| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central (y supervisor) | C2 | MVP |' 'H-idx1'

E '| CU-08 | Ingestar el CSV diario | Operador de la central | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central | C2 | MVP |
| CU-10 | Gestionar y filtrar los CASOS | Operador de la central | C1 / C3 | MVP |' '| CU-10 | Gestionar y filtrar los CASOS | Operador de la central | C1 / C3 | MVP |' 'H-idx2'

E '| CU-14 | Dar de alta manual un caso | Operador de la central | C3 | MVP |' '| CU-14 | Dar de alta manual un caso | Operador de la central (y supervisor) | C3 | MVP |' 'H-idx3'

E '**Total: 22 casos de uso.** El rol administrador está absorbido por el supervisor (D-35).' '**Total: 22 casos de uso.** El rol administrador está absorbido por el supervisor (D-35). El **operador** presta servicio en CU-01, CU-08, CU-09, CU-10, CU-11, CU-12, CU-14 y CU-22 —y **no** en CU-13—; el **supervisor** en CU-01 a CU-22, coherente con la matriz de §2.1 (H-N-04).' 'H-idx4'

Write-Output 'FASE 1'
$edits | ForEach-Object { Write-Output $_ }
Set-Content -LiteralPath $p -Value $t -Encoding UTF8 -NoNewline
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
