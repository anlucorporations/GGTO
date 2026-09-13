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

# ================= CU-15 =================
E 'el caso tiene `usuario_modificacion` y `fecha_modificacion` informados, y —si se ingirió de un CSV— el rastro de origen (`ultimo_usuario` col. 20 y `usuario_acciona` col. 53) conservado por CU-08.' 'el caso tiene `usuario_modificacion` y `fecha_modificacion` informados y, **si se ingirió de un CSV**, `usuario_modificacion` quedó inicializado con la **col. 20** (`ultimo_usuario`) y `fecha_modificacion` con la **fecha de ingesta** (D-52, D-53); las columnas **53 y 80 no se persisten** y **no se muestran** (D-53).' 'CU15-precond'

E '**Trazabilidad:** RF-24; RNF-09, **RNF-12, RNF-14**; RT-01; D-16, **D-28, D-35, D-41**; H-08, H-10, H-29.' '**Trazabilidad:** RF-24; RNF-08, RNF-09, **RNF-12, RNF-14**; RT-01; D-16, **D-28, D-35, D-41, D-49, D-50, D-52, D-53**; H-08, H-10, H-29.' 'CU15-traz'

E '2. El sistema muestra la sección **Auditoría** con: `usuario_modificacion` y `fecha_modificacion` del **último** cambio, los valores vigentes de `status`, `clase`, `nivel` y `tipo_abonado`, y el **rastro de origen de la ingesta**: `ultimo_usuario` (col. 20 del CSV), `usuario_acciona` (col. 53) y `Fecha Hora Asignacion` (col. 80), conservados por CU-08 tal como llegaron del archivo.' '2. El sistema muestra la sección **Auditoría** con: `usuario_modificacion` y `fecha_modificacion` del **último** cambio, los valores vigentes de `status`, `clase`, `nivel` y `tipo_abonado`, y —solo si el caso se ingirió de un CSV— el **rastro de origen limitado a la col. 20**: la etiqueta «Origen del dato: &lt;ultimo_usuario&gt;», que es el valor con el que CU-08 inicializó `usuario_modificacion`, más la fecha de ingesta en `fecha_modificacion`. Las columnas **53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) no se persisten y no se muestran** (D-53).' 'CU15-paso2'

E '5. El supervisor aplica el filtro por rango de fechas y por operador sobre los cambios disponibles y exporta la vista en pantalla o la impresión.' '5. El supervisor aplica el filtro **por operador** y **por rango de fechas sobre el campo de fecha del registro de cambios disponibles** —comparación de **texto** en formato fijo `DD/MM/AAAA`, nunca un rango sobre `fecha_modificacion`, que el diccionario declara TEXTO (H-29)— y exporta la vista en pantalla o la imprime.' 'CU15-paso5'

E '1. **Dado** un caso modificado por el operador `12345` el `13/09/2026 09:14`, **Cuando** el supervisor abre *Ver auditoría*, **Entonces** el sistema muestra `usuario_modificacion = 12345` y `fecha_modificacion = 13/09/2026 09:14`.
2. **Dado** un caso ingerido con `ultimo_usuario = JPEREZ` (col. 20) y `usuario_acciona = MGOMEZ` (col. 53), **Cuando** el supervisor abre *Ver auditoría*, **Entonces** el sistema muestra ambos valores como rastro de origen del dato y los distingue de `usuario_modificacion` (que corresponde al último cambio hecho en la página).' '1. **Dado** un caso modificado por el operador `12345` el `13/09/2026 09:14`, **Cuando** el supervisor abre *Ver auditoría*, **Entonces** el sistema muestra exactamente dos líneas: `usuario_modificacion = 12345` y `fecha_modificacion = 13/09/2026 09:14`.
2. **Dado** un caso ingerido con `ultimo_usuario = JPEREZ` (col. 20), `usuario_acciona = MGOMEZ` (col. 53) y `Fecha Hora Asignacion = 12/09/2026 08:15` (col. 80), **Cuando** el supervisor abre *Ver auditoría*, **Entonces** el sistema muestra la etiqueta «Origen del dato: JPEREZ» —igual a `usuario_modificacion` inicializado por la ingesta (D-52, D-53)— y la vista **no** contiene las cadenas `MGOMEZ` ni `12/09/2026 08:15` en ninguna parte. [D-53, H-N-01]' 'CU15-ca12'

E '6. **Dado** un filtro por operador `12345` y rango `01/09/2026` a `13/09/2026`, **Cuando** el supervisor aplica, **Entonces** el sistema muestra solo los cambios de ese operador en ese rango.' '6. **Dado** un registro de cambios con 3 cambios del operador `12345` en fechas `01/09/2026`, `05/09/2026` y `20/09/2026`, **Cuando** el supervisor filtra por operador `12345` y rango `01/09/2026` a `13/09/2026`, **Entonces** la vista muestra **2 filas** —las de `01/09/2026` y `05/09/2026`— con las columnas `operador`, `fecha_cambio`, `campo`, `valor_anterior` y `valor_nuevo`, y excluye la de `20/09/2026` por comparación de texto en formato `DD/MM/AAAA`. [H-29]' 'CU15-ca6'

E '- **El sistema deberá** mostrar como auditoría disponible en el MVP únicamente el operador y la fecha/hora del **último** cambio, más el rastro de origen de la ingesta de las columnas 20, 53 y 80 del CSV; **no** deberá mostrar valores anteriores que el maestro no conserve. [H-08, H-10]' '- **El sistema deberá** mostrar como auditoría disponible en el MVP únicamente el operador y la fecha/hora del **último** cambio, más el rastro de origen de la ingesta **limitado a la col. 20** (`ultimo_usuario`, que inicializa `usuario_modificacion`) y a la fecha de ingesta; las columnas **53 y 80 no se persisten** y **no deberá** mostrarlas ni prometerlas, ni mostrar valores anteriores que el maestro no conserve. [D-52, D-53, H-08, H-10]
- **El sistema deberá** comparar las fechas de `fecha_modificacion` y de los campos de fecha del registro de cambios como **texto** en formato fijo `DD/MM/AAAA` (o `DD/MM/AAAA hh:mm`); **no deberá** aplicar filtros por rango de fechas calculados sobre un campo declarado TEXTO. [H-29]' 'CU15-ears'

E '- **El sistema deberá** conservar el caso y su rastro sin purga automática, con la copia fechada del cierre de jornada en `C:\GGTO\respaldo\` como respaldo documental (D-49, RNF-16). [D-28, D-49]' '- **El sistema deberá** conservar el caso y su rastro sin purga automática y sin plazo de caducidad, con la **ficha de tratamiento de datos personales (D-28)** como documento de finalidad —responsable, base de licitud y canal del titular— y con la copia fechada del cierre de jornada `averias_AAAA-MM-DD_HHMM.json` en `C:\GGTO\respaldo\` como respaldo documental (D-49, RNF-16). [D-28, D-49, H-N-10]' 'CU15-ears2'

# ================= CU-16 =================
E '`C:\GGTO\datos\averias.json` previa confirmación, registrar la hora de inicio y de fin, y permitir verificar el **RTO de 1 hora** y el **RPO del cierre del día anterior**. [D-49, RNF-16]' '`C:\GGTO\datos\averias.json` previa confirmación, registrar la hora de inicio y de fin, y permitir verificar el **RTO de 1 hora** y el **RPO del cierre del día anterior**. [D-49, RNF-16]' 'chk-cu21'

E '10. **Dado** el despacho del día ya confirmado, **Cuando** el supervisor abre DESPACHO de nuevo, **Entonces** el sistema muestra la asignación vigente y permite modificarla antes de emitir los PDF.' '10. **Dado** el despacho del día ya confirmado, **Cuando** el supervisor abre DESPACHO de nuevo, **Entonces** el sistema muestra la asignación vigente y permite modificarla antes de emitir los PDF.
8c. **Dado** un maestro de 300 casos abiertos y un despacho confirmado que asigna 45, **Cuando** el supervisor pulsa *Confirmar despacho*, **Entonces** el sistema deja `averias_AAAA-MM-DD_HHMM.bak` con los 300 casos previos, escribe en el archivo temporal, **relee y compara** el contenido (300 registros, texto idéntico) y **solo entonces** muestra «Despacho confirmado: 45 casos en 3 cuadrillas»; si la comparación falla, restaura el `.bak`, avisa y no confirma. [D-42, RNF-15]' 'CU16-ca8c'

# ================= CU-17 (D-27: destrucción de hojas) =================
E 'la entrega queda registrada y las hojas se recogen al cierre.' 'la entrega queda registrada y las hojas se **recogen y destruyen** al cierre del día, con su asiento (D-27).' 'CU17-post'

E '8. Al cierre de la jornada, el supervisor pulsa *Recoger hojas*; el sistema asienta la recogida y muestra «Hojas recogidas: 3 de 3 cuadrillas».' '8. Al cierre de la jornada, el supervisor pulsa *Recoger hojas*; el sistema asienta la recogida, muestra «Hojas recogidas: 3 de 3 cuadrillas» y **solicita el número de hojas destruidas por cuadrilla**. Al confirmarlo, el sistema asienta la **destrucción** con fecha, hora, cuadrilla, número de copia y operador, muestra «Hojas destruidas: 3 de 3 cuadrillas» y deja el control documental del día cerrado. [D-27, RNF-11]' 'CU17-paso8'

E '- **8a. Faltan hojas al cierre.** El sistema muestra «Faltan hojas: C3» y registra la incidencia con fecha, hora y operador. [D-27, H-12]' '- **8a. Faltan hojas al cierre.** El sistema muestra «Faltan hojas: C3» y registra la incidencia con fecha, hora y operador; no permite registrar la destrucción de una cuadrilla cuya hoja no se recogió. [D-27, H-12]
- **8b. Hojas recogidas pero no destruidas.** Si el supervisor registra la recogida y el número de hojas destruidas es menor que el de hojas entregadas, el sistema muestra «Pendiente de destruir: N hojas» y **no da el despacho del día por cerrado** hasta completar la destrucción o justificar la incidencia con operador y fecha/hora. [D-27, H-N-09]' 'CU17-alt8b'

E '5. **Dado** el despacho del día con 3 cuadrillas entregadas, **Cuando** el supervisor pulsa *Recoger hojas* y solo registra 2, **Entonces** el sistema muestra «Faltan hojas: C3» y asienta la incidencia con fecha, hora y operador.' '5. **Dado** el despacho del día con 3 cuadrillas entregadas, **Cuando** el supervisor pulsa *Recoger hojas* y solo registra 2, **Entonces** el sistema muestra «Faltan hojas: C3» y asienta la incidencia con fecha, hora y operador.
5b. **Dado** el despacho del día con 3 cuadrillas entregadas y recogidas, **Cuando** el supervisor registra la destrucción de las 3 hojas, **Entonces** el sistema muestra «Hojas destruidas: 3 de 3 cuadrillas» y el asiento de la destrucción queda con fecha, hora, cuadrilla, número de copia y P00 del supervisor. [D-27, H-N-09]
5c. **Dado** el mismo despacho con 3 hojas entregadas y solo 2 destruidas, **Cuando** el supervisor intenta cerrar el control documental del día, **Entonces** el sistema muestra «Pendiente de destruir: 1 hoja» y no da el día por cerrado. [D-27, H-N-09]' 'CU17-ca5'

E '- **El sistema deberá** asentar la entrega y la recogida de las hojas con fecha, hora, cuadrilla y operador. [RNF-11, D-27]' '- **El sistema deberá** asentar la entrega, la recogida **y la destrucción** de las hojas con fecha, hora, cuadrilla, número de copia y operador; ninguna hoja entregada puede quedar sin constancia de destrucción al cierre del día. [RNF-11, D-27, H-N-09]' 'CU17-ears'

Write-Output 'FASE B3'
$log | ForEach-Object { Write-Output $_ }
[System.IO.File]::WriteAllText($p, $t, $enc)
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
