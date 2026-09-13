$ErrorActionPreference = 'Stop'
$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$enc = New-Object System.Text.UTF8Encoding($true)
$t = [System.IO.File]::ReadAllText($p)
$log = New-Object System.Collections.ArrayList
function E($old, $new, $tag) {
  $o = $old -replace "`r`n", "`n"
  $n = $new -replace "`r`n", "`n"
  $t2 = $script:t.Replace($o, $n)
  if ($t2 -eq $script:t) { [void]$script:log.Add("FALLO $tag") }
  else { [void]$script:log.Add("OK    $tag"); $script:t = $t2 }
}

# ================= CU-08 =================
E '- **Precondiciones:** sesión identificada (CU-01); `central.json` completo (CU-02);' '- **Precondiciones:** sesión identificada (CU-01) **con credencial válida y vigente (D-39)**; **rol autorizado por la matriz de §2.1: el operador puede ingerir y el supervisor también** (D-35, RNF-12); `central.json` completo (CU-02);' 'CU08-precond'

E 'el rastro de origen de la ingesta (`ultimo_usuario` col. 20, `usuario_acciona` col. 53 y `Fecha Hora Asignacion` col. 80) queda conservado tal cual llegó del CSV (H-08); los casos ya existentes no se duplican.' 'el rastro de origen se limita a la col. 20 del CSV (`ultimo_usuario`), que **inicializa `usuario_modificacion`**, y a `fecha_modificacion` con la **fecha de ingesta** (D-52, D-53): las columnas **53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) no se persisten** y la **col. 18 (`fecha_compromiso`) tampoco** (D-54); los casos ya existentes no se duplican. **Visibilidad del resultado:** los casos recién ingeridos quedan visibles para la sesión que los ingirió; si esa sesión es de operador, los casos que no tengan `Reparador Principal` propio se muestran en solo lectura hasta que el despacho (CU-16) o el alta manual (CU-14) los asigne a su cuadrilla (H-N-05).' 'CU08-post'

E '**Trazabilidad:** RF-16, RF-17, RF-18, RF-19; RN-01, RN-02, RN-03, RN-04; RNF-02, RNF-04, RNF-06, RNF-10, **RNF-14, RNF-15**; RT-02, RT-03, RT-04, RT-07, RT-08; D-05, D-06, D-10, D-12, D-17, D-21, D-26, **D-38, D-41, D-42, D-44, D-46**; H-03, H-08, H-09, H-14, H-15, H-24, H-27.' '**Trazabilidad:** RF-16, RF-17, RF-18, RF-19; RN-01, RN-02, RN-03, RN-04; RNF-02, RNF-04, RNF-06, RNF-08, RNF-10, **RNF-12, RNF-14, RNF-15**; RT-02, RT-03, RT-04, RT-07, RT-08; D-05, D-06, D-10, D-12, D-17, D-21, D-26, **D-35, D-38, D-41, D-42, D-44, D-46, D-52, D-53, D-54**; H-03, H-08, H-09, H-14, H-15, H-24, H-27.' 'CU08-traz'

E 'y **conserva como rastro de origen del dato** las columnas 20 (`ultimo_usuario`), 53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) tal como llegan, sin recortarlas ni reinterpretarlas (H-08).' 'y **conserva como rastro de origen del dato** únicamente la columna 20 (`ultimo_usuario`), que **inicializa `usuario_modificacion`**, junto con `fecha_modificacion` = fecha de ingesta (D-52, D-53); las columnas **53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) se descartan y no se persisten** (D-53), y la **col. 18 (`fecha_compromiso`) tampoco se persiste** (D-54: los «citados» se determinan por `fecha_cita`, D-30).' 'CU08-paso4'

E '13. **Dado** un registro del CSV con `ultimo_usuario = JPEREZ` (col. 20), `usuario_acciona = MGOMEZ` (col. 53) y `Fecha Hora Asignacion = 12/09/2026 08:15` (col. 80), **Cuando** se ingiere, **Entonces** el maestro conserva esos tres valores tal cual en el rastro de origen del caso y CU-15 los muestra como origen del dato. [H-08]' '13. **Dado** un registro del CSV con `ultimo_usuario = JPEREZ` (col. 20), `usuario_acciona = MGOMEZ` (col. 53) y `Fecha Hora Asignacion = 12/09/2026 08:15` (col. 80), **Cuando** se ingiere el registro, **Entonces** el caso queda con `usuario_modificacion = JPEREZ` y `fecha_modificacion` = fecha de ingesta, el maestro **no contiene** ningún campo con los valores `MGOMEZ` ni `12/09/2026 08:15` (las columnas 53 y 80 se descartan, D-53) y CU-15 muestra `usuario_modificacion = JPEREZ` como origen del dato. [D-52, D-53, H-N-01]' 'CU08-ca13'

E '16. **Dado** que el supervisor modificó las claves y las dejó vacías, **Cuando** el operador ejecuta la ingesta, **Entonces** el sistema advierte «No hay palabras clave configuradas: todos los casos entrarían en GESTION» y exige confirmación explícita antes de continuar.' '16. **Dado** que el supervisor modificó las claves y las dejó vacías, **Cuando** el operador ejecuta la ingesta, **Entonces** el sistema advierte «No hay palabras clave configuradas: todos los casos entrarían en GESTION» y exige confirmación explícita antes de continuar.
16b. **Dado** una sesión de **operador** con credencial válida y `central.json` completo, **Cuando** el operador confirma la ingesta, **Entonces** el sistema procesa el archivo y persiste los casos nuevos (la ingesta está **permitida** al operador por la matriz de §2.1, D-35) y deja constancia del `P00` en `usuario_modificacion` de cada caso nuevo junto con la fecha de ingesta. [D-35, RNF-12, D-52]
16c. **Dado** una sesión **sin identificación válida** (página recién abierta o sesión expirada por D-45), **Cuando** se intenta cargar el CSV diario, **Entonces** el sistema no muestra el bloque INGESTA, no lee el archivo y responde «Identifíquese para editar», de modo que ningún dato del maestro queda a la vista. [D-50, RNF-08]' 'CU08-ca16bc'

E '- **El sistema deberá** conservar, al ingerir, los valores de `ultimo_usuario` (col. 20), `usuario_acciona` (col. 53) y `Fecha Hora Asignacion` (col. 80) como rastro de origen del dato, sin modificarlos. [H-08]' '- **El sistema deberá** conservar, al ingerir, **solo** la columna 20 (`ultimo_usuario`) como rastro de origen del dato: ese valor **inicializa `usuario_modificacion`** y `fecha_modificacion` toma la **fecha de ingesta**; las columnas **53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) no se persisten** y la **col. 18 (`fecha_compromiso`) tampoco**. [D-52, D-53, D-54]
- **Si** la sesión no tiene un rol autorizado por la matriz de §2.1 para la ingesta, entonces el sistema deberá rechazarla sin leer el CSV ni escribir el maestro, y deberá registrar el intento con operador y fecha/hora. [D-35, RNF-12]
- **Mientras** no exista una identificación válida, el sistema deberá mantener el bloque INGESTA oculto y bloqueada toda lectura del archivo y toda escritura del maestro. [D-50, RNF-08]' 'CU08-ears'

# ================= CU-09 =================
E '**Trazabilidad:** RF-18, RF-29 (creación del sector mínimo desde la cola); RN-04; RNF-04, RNF-08, RNF-09, RNF-10, **RNF-12, RNF-14**; RT-03; D-03, D-25, **D-35, D-41**; H-18.' '**Trazabilidad:** RF-18, RF-24, RF-29 (creación del sector mínimo desde la cola); RN-04, RN-07; RNF-04, RNF-08, RNF-09, RNF-10, **RNF-12, RNF-14, RNF-15**; RT-01, RT-03; D-03, D-25, **D-35, D-41, D-42**; H-18.' 'CU09-traz'

E '5. El sistema verifica que el sector exista, escribe `averias.sector`, relee el archivo y quita el caso de la cola.' '5. El sistema verifica que el sector exista y escribe `averias.sector` con la **escritura verificada de D-42/RNF-15**: copia antes el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribe en un **archivo temporal**, **relee y compara** el contenido (mismo número de registros e igualdad del texto serializado) y **solo entonces** confirma y quita el caso de la cola; si algo falla, **restaura el respaldo** y no confirma. [D-42, RNF-15]' 'CU09-paso5'

E '- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente.

**Criterios de aceptación (Gherkin)**

1. **Dado** 7 casos sin sector tras la ingesta,' '- **Conflicto de concurrencia (D-41, RNF-14).** Si al guardar el sistema detecta que el archivo cambió desde su carga, **no escribe**: muestra «Conflicto: el archivo fue modificado por &lt;usuario_modificacion&gt; el &lt;fecha_modificacion&gt;. Recargue o sobrescriba», deshabilita *Guardar* hasta que el usuario decida y registra la decisión con operador y fecha/hora. Si elige *Recargar*, sus cambios locales se pierden y la vista se reconstruye con el contenido del disco; si elige *Sobrescribir*, su escritura procede y queda registrada como sobrescritura consciente. La marca que se compara (`fecha_modificacion`) es un campo **TEXTO** `DD/MM/AAAA hh:mm`: la comparación es de igualdad de texto, nunca un rango de fechas (H-29).
- **5b. Escritura verificada con respaldo previo (D-42, RNF-15).** Al asignar el sector, el sistema copia antes el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribe en un **archivo temporal**, **relee y compara** el contenido (mismo número de registros e igualdad del texto serializado) y solo entonces confirma la asignación; si la copia previa falla, la escritura del temporal falla o la relectura no coincide, **restaura el respaldo**, muestra «No se pudo verificar la escritura: se restauró el maestro del DD/MM/AAAA HH:MM» y el caso permanece en la cola. [D-42, RNF-15]

**Criterios de aceptación (Gherkin)**

1. **Dado** 7 casos sin sector tras la ingesta,' 'CU09-flujo-d42'

E '7. **Dado** una sesión de operador con la cola abierta, **Cuando** el operador intenta modificar las vías de un sector ya existente o eliminarlo, **Entonces** el sistema responde «Acción no permitida para su rol», no modifica `sectores.json` y registra el intento. [D-35, RNF-12]' '7. **Dado** una sesión de operador con la cola abierta, **Cuando** el operador intenta modificar las vías de un sector ya existente o eliminarlo, **Entonces** el sistema responde «Acción no permitida para su rol», no modifica `sectores.json` y registra el intento. [D-35, RNF-12]
8. **Dado** un maestro de 480 casos y una sesión de operador que asigna el sector `4` al caso `2026-00123`, **Cuando** confirma la asignación, **Entonces** el sistema deja `averias_AAAA-MM-DD_HHMM.bak` con los 480 casos previos (conservando como máximo las **10** copias `.bak` más recientes), escribe en el archivo temporal, **relee y compara** el contenido (481 campos `sector` presentes, texto idéntico) y **solo entonces** muestra «Sector 4 asignado»; si la comparación falla, restaura el `.bak`, avisa y el caso sigue en la cola. [D-42, RNF-15]
9. **Dado** que el operador cargó la cola con `averias.json` en `fecha_modificacion = 13/09/2026 09:00` y el maestro fue modificado a las 09:50 por `12345`, **Cuando** el operador asigna un sector, **Entonces** el sistema **no escribe**, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 09:50. Recargue o sobrescriba», mantiene el caso en la cola y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]' 'CU09-ca'

E '- **Si** el operador intenta editar o eliminar un sector, entonces el sistema deberá rechazarlo, admitiendo únicamente la creación del sector mínimo desde la cola. [D-35, RNF-12]' '- **Si** el operador intenta editar o eliminar un sector, entonces el sistema deberá rechazarlo, admitiendo únicamente la creación del sector mínimo desde la cola. [D-35, RNF-12]
- **Cuando** vaya a escribir la asignación de sector en el maestro, el sistema deberá copiarlo antes a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribir en un archivo temporal, **releerlo y compararlo** y **solo entonces** confirmar; si falla, deberá restaurar el respaldo, avisar y **no** confirmar. [D-42, RNF-15]' 'CU09-ears'

# ================= CU-10 =================
E 'D-06, D-17, D-23, D-24, **D-29, D-35, D-37, D-39, D-40, D-41, D-42, D-48, D-50**; H-05, H-28.' 'D-06, D-17, D-23, D-24, **D-29, D-35, D-37, D-39, D-40, D-41, D-42, D-48, D-50**; H-05, H-28. La edición en línea **sí** escribe el maestro, de modo que le aplican D-41/RNF-14 y D-42/RNF-15 como a cualquier otro camino de escritura (H-N-06, H-N-16).' 'CU10-traz'

E 'relee el archivo y confirma con «Caso &lt;id_averia&gt; actualizado».' 'relee el archivo y confirma con «Caso &lt;id_averia&gt; actualizado». El guardado es **verificado (D-42, RNF-15)**: copia previa a `averias_AAAA-MM-DD_HHMM.bak` (10 últimas), archivo temporal, relectura y comparación, y restauración del respaldo si algo falla.' 'CU10-paso9'

E '- **Cuando** se modifique un caso, el sistema deberá escribir el cambio en `averias.json` y releer el archivo antes de confirmar. [RN-07, RF-24]' '- **Cuando** se modifique un caso, el sistema deberá escribir el cambio en `averias.json` con la **escritura verificada de D-42** —copia previa `averias_AAAA-MM-DD_HHMM.bak` (10 últimas), archivo temporal, relectura comparada y restauración ante fallo— y releer el archivo antes de confirmar. [RN-07, RF-24, D-42, RNF-15]' 'CU10-ears'

Write-Output 'FASE B1'
$log | ForEach-Object { Write-Output $_ }
[System.IO.File]::WriteAllText($p, $t, $enc)
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
