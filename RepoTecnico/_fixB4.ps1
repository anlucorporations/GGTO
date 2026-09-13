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

# ---- CU-15 paso 5 (variante exacta) ----
E 'sobre los cambios disponibles y exporta la vista en pantalla o la imprime.' 'sobre los cambios disponibles —comparación de **texto** en formato fijo `DD/MM/AAAA`, **nunca** un rango calculado sobre `fecha_modificacion`, que el diccionario declara TEXTO (H-29)— y exporta la vista en pantalla o la imprime.' 'CU15-paso5'

# ---- CU-18 ----
E '**Trazabilidad:** RF-05, RF-06, RF-25; RN-08; RNF-02, RNF-06, RNF-07, **RNF-08, RNF-12, RNF-13**; S-RNF-02b; D-17, D-23, D-24, **D-34, D-35, D-40, D-48, D-50**; H-16, H-28.' '**Trazabilidad:** RF-05, RF-06, RF-25; RN-08; RNF-02, RNF-06, RNF-07, **RNF-08, RNF-12, RNF-13**; S-RNF-02b; D-17, D-23, D-24, **D-34, D-35, D-40, D-48, D-50, D-55**; H-16, H-28.' 'CU18-traz'

E '- **El sistema deberá** calcular «asignados por día» de la zona CUADRILLA agrupando los casos por `fecha_asignacion` (fecha de la **última** asignación de cuadrilla, D-48), sin depender de archivos de despacho por fecha, y mostrar el criterio de cálculo y el rango temporal de cada cifra en pantalla. [D-48, H-28, RNF-01]' '- **El sistema deberá** calcular «asignados por día» de la zona CUADRILLA agrupando los casos por `fecha_asignacion` (fecha de la **última** asignación de cuadrilla, D-48), sin depender de archivos de despacho por fecha, y mostrar el criterio de cálculo y el rango temporal de cada cifra en pantalla. [D-48, H-28, RNF-01]
- **El sistema deberá** calcular «gestionados por día» como el número de **casos distintos** (`id_averia` único) cuyo último cambio de estado a `GESTION` cae en la fecha del día mostrado, contando cada caso **una sola vez** aunque haya reingresado al estado el mismo día, y deberá mostrar en pantalla la fecha de corte y el conteo de casos excluidos por no tener cambio de estado registrado. [RF-05, D-48, H-N-21]' 'CU18-ears-gest'

E '- **El sistema deberá** mostrar **cada cifra** con su fecha de corte y su rango temporal, y **cada reemisión** de la zona Cuadrilla o del reporte semanal con la huella de comparación («N cambios desde la última emisión», donde N es el número de casos cuyo `fecha_modificacion` cambió después de la emisión anterior), de modo que dos ejecuciones del mismo periodo den el mismo valor. [D-34, H-N-21]' 'CU18-ears-huella'

E '2. **Dado** un rango de corte en la semana del 08/09/2026 al 13/09/2026, **Cuando** el supervisor abre GESTION SEMANAL, **Entonces** la curva muestra 6 puntos: lunes, martes, miércoles, jueves, viernes y sábado, y ningún punto de domingo.' '2. **Dado** un rango de corte en la semana operativa del **07/09/2026 (lunes) al 12/09/2026 (sábado)**, **Cuando** el supervisor abre GESTION SEMANAL, **Entonces** la curva muestra exactamente **6 puntos** fechados 07, 08, 09, 10, 11 y 12 de septiembre de 2026 y ningún punto del domingo 13/09/2026 (RN-08). [RN-08, H-N-22]' 'CU18-ca2'

E '- **4a. Fecha de corte fuera de la semana operativa.**' '- **2d. Corte sobre un domingo.** Si el usuario elige como fecha de corte el domingo 13/09/2026, el sistema lo ajusta al **sábado 12/09/2026** de esa semana operativa, lo informa en pantalla («Corte ajustado al sábado 12/09/2026: la semana operativa es de lunes a sábado») y dibuja 6 puntos, ninguno del domingo. [RN-08, D-34, H-N-22]
- **4a. Fecha de corte fuera de la semana operativa.**' 'CU18-alt2d'

# ---- CU-19 ----
E '**Trazabilidad:** RF-25, RF-05; RN-08; RNF-01, RNF-06, RNF-07, RNF-11, **RNF-08, RNF-12, RNF-13**; D-27, **D-34, D-35, D-40, D-50**; H-16, H-23, H-28.' '**Trazabilidad:** RF-25, RF-05; RN-08; RNF-01, RNF-06, RNF-07, RNF-11, **RNF-08, RNF-12, RNF-13**; D-27, **D-34, D-35, D-40, D-50, D-55**; H-16, H-23, H-28.' 'CU19-traz'

E '2. **Dado** la semana operativa del 08/09/2026 al 13/09/2026, **Cuando** el supervisor abre el seguimiento semanal, **Entonces** el sistema muestra 6 puntos diarios (lunes a sábado) con ingreso del día y reparadas del día, y ningún domingo. [D-34]' '2. **Dado** la semana operativa del **07/09/2026 (lunes) al 12/09/2026 (sábado)**, **Cuando** el supervisor abre el seguimiento semanal, **Entonces** el sistema muestra **6 puntos** diarios fechados 07 a 12 de septiembre de 2026 con ingreso del día y reparadas del día, y ningún punto del domingo 13/09/2026. [D-34, RN-08, H-N-22]' 'CU19-ca2'

E '6. **Dado** el despacho del 13/09/2026 ya emitido, **Cuando** el supervisor lo vuelve a generar tras cerrar 3 casos, **Entonces** el sistema muestra «El periodo tuvo 3 cambios desde la última emisión» y genera una reemisión marcada.' '6. **Dado** el despacho del 13/09/2026 ya emitido y 3 casos cerrados después de esa emisión (sus `fecha_modificacion` son posteriores a la hora de emisión), **Cuando** el supervisor lo vuelve a generar, **Entonces** el sistema muestra exactamente «El periodo tuvo 3 cambios desde la última emisión» —N = número de casos con `fecha_modificacion` posterior a la emisión anterior— y genera una reemisión marcada. [RNF-11, H-N-21]' 'CU19-ca7'

E '6. El sistema permite volver a emitir la misma salida y detecta cambios en los datos, mostrando «El periodo tuvo N cambios desde la última emisión».' '6. El sistema permite volver a emitir la misma salida y detecta cambios en los datos, mostrando «El periodo tuvo N cambios desde la última emisión», donde **N es el número de casos del periodo cuya `fecha_modificacion` es posterior a la fecha y hora de la emisión anterior** (huella de comparación declarada, H-N-21).' 'CU19-paso6'

# ---- CU-20 ----
E '**Trazabilidad:** RF-26, RF-29; RN-04, RN-08; RNF-01, RNF-08, RNF-09, **RNF-12, RNF-14**; D-23, D-25, **D-33, D-35, D-41, D-50**; H-04, H-14.' '**Trazabilidad:** RF-26, RF-29; RN-04, RN-08; RNF-01, RNF-08, RNF-09, **RNF-12, RNF-14, RNF-15**; D-23, D-25, **D-33, D-35, D-41, D-42, D-50, D-55**; H-04, H-14.' 'CU20-traz'

E '- **3a. Ningún sector alcanza el umbral.** El sistema muestra «Sin averías concentradas con umbral 3 en la semana del 08/09/2026 al 13/09/2026».' '- **3a. Ningún sector alcanza el umbral.** El sistema muestra «Sin averías concentradas con umbral 3 en la semana operativa del 07/09/2026 al 12/09/2026». [RN-08, H-N-22]' 'CU20-alt3a'

E '1. **Dado** el sector `1` con 4 casos abiertos ingresados entre el 08/09/2026 y el 13/09/2026 y el umbral 3, **Cuando** el supervisor abre CONCENTRADAS, **Entonces** el sector `1` aparece en la lista con conteo 4.' '1. **Dado** el sector `1` con 4 casos abiertos ingresados en la semana operativa del **07/09/2026 (lunes) al 12/09/2026 (sábado)** y el umbral 3, **Cuando** el supervisor abre CONCENTRADAS, **Entonces** el sector `1` aparece en la lista con conteo 4. [RN-08, H-N-22]' 'CU20-ca1'

E '2. **Dado** una acción registrada sobre un caso, **Cuando** el sistema persiste, **Entonces** `observaciones` contiene la acción con fecha, hora y P00 del operador.' '2. **Dado** una acción registrada sobre un caso, **Cuando** el sistema persiste, **Entonces** `observaciones` contiene la acción con fecha, hora y P00 del operador.' 'chk-cu20'

E '6b. **Dado** que el supervisor registra una acción a las 12:00 con `averias.json` en `fecha_modificacion = 13/09/2026 12:00` y el maestro fue modificado a las 12:02 por `12345`, **Cuando** confirma la anotación, **Entonces** el sistema no escribe, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 12:02. Recargue o sobrescriba», conserva la acción en pantalla y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]' '6b. **Dado** que el supervisor registra una acción a las 12:00 con `averias.json` en `fecha_modificacion = 13/09/2026 12:00` y el maestro fue modificado a las 12:02 por `12345`, **Cuando** confirma la anotación, **Entonces** el sistema no escribe, muestra «Conflicto: el archivo fue modificado por 12345 el 13/09/2026 12:02. Recargue o sobrescriba», conserva la acción en pantalla y exige *Recargar* o *Sobrescribir*. [D-41, RNF-14]
6c. **Dado** un maestro de 200 casos y una acción registrada sobre el caso `2026-00123`, **Cuando** el supervisor confirma la anotación, **Entonces** el sistema deja `averias_AAAA-MM-DD_HHMM.bak` con los 200 casos previos, escribe en el archivo temporal, **relee y compara** el contenido y **solo entonces** confirma; si la comparación falla, restaura el `.bak`, avisa y la acción no se da por registrada. [D-42, RNF-15]' 'CU20-ca6c'

E '- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá denegar el bloque CONCENTRADAS / ESPECIALES y rechazar las anotaciones. [D-35, RNF-12]' '- **Si** la sesión no tiene el rol supervisor, entonces el sistema deberá denegar el bloque CONCENTRADAS / ESPECIALES y rechazar las anotaciones. [D-35, D-55, RNF-12]
- **Cuando** se registre una acción sobre un caso, el sistema deberá copiar el maestro a `averias_AAAA-MM-DD_HHMM.bak` (conservando las **10** últimas), escribir en un archivo temporal, **releerlo y compararlo** y **solo entonces** confirmar; si falla, deberá restaurar el respaldo, avisar y **no** confirmar. [D-42, RNF-15]' 'CU20-ears'

# ---- CU-21 ----
E '- **Postcondiciones:** existe una copia **fechada** del maestro (`averias_AAAA-MM-DD.json`) en `C:\GGTO\respaldo\`, **sin cifrado**' '- **Postcondiciones:** existe una copia **fechada con hora** del maestro (`averias_AAAA-MM-DD_HHMM.json`) en `C:\GGTO\respaldo\`, **sin cifrado**' 'CU21-post'

E '**Trazabilidad:** RF-24; RNF-04, RNF-10, **RNF-12, RNF-14, RNF-15, RNF-16**; RT-01, RT-10; D-01, D-19, D-28, D-35, D-36, **D-41, D-42, D-49**; H-09, H-12, H-13, H-25.' '**Trazabilidad:** RF-24; RNF-04, RNF-08, RNF-10, **RNF-12, RNF-14, RNF-15, RNF-16**; RT-01, RT-10; D-01, D-19, D-28, D-35, D-36, **D-41, D-42, D-49, D-50, D-55**; H-09, H-12, H-13, H-25.' 'CU21-traz'

E 'con la copia del maestro fechada como **`averias_AAAA-MM-DD.json`** (`AAAA-MM-DD` = fecha del cierre)' 'con la copia del maestro fechada **con hora** como **`averias_AAAA-MM-DD_HHMM.json`** (`AAAA-MM-DD` = fecha del cierre y `HHMM` = hora y minuto del respaldo, para que dos respaldos del mismo día **no colisionen** ni se sobrescriba la copia anterior, H-N-08)' 'CU21-paso3'

E 'la copia del maestro se llama `averias_2026-09-13.json` (fecha del cierre) y **no** está cifrada. [D-49, RNF-16]' 'la copia del maestro se llama `averias_2026-09-13_HHMM.json` —fecha del cierre **y hora del respaldo**— y **no** está cifrada. [D-49, RNF-16, H-N-08]' 'CU21-ca1'

E '- **El sistema deberá** ejecutar el respaldo **solo a demanda del supervisor**, sin automatismo programado. Al **cierre de la jornada** deberá **ofrecer** la copia fechada del maestro (`averias_AAAA-MM-DD.json`) en `C:\GGTO\respaldo\`, **sin cifrado**' '- **El sistema deberá** ejecutar el respaldo **solo a demanda del supervisor**, sin automatismo programado. Al **cierre de la jornada** deberá **ofrecer** la copia fechada **con hora** del maestro (`averias_AAAA-MM-DD_HHMM.json`) en `C:\GGTO\respaldo\`, **sin cifrado** y **sin sobrescribir** una copia anterior del mismo día' 'CU21-ears'

E 'al cierre de la jornada se ofrece la copia fechada `averias_AAAA-MM-DD.json` en **`C:\GGTO\respaldo\`**' 'al cierre de la jornada se ofrece la copia fechada con hora `averias_AAAA-MM-DD_HHMM.json` en **`C:\GGTO\respaldo\`**' 'CU21-nota'

Write-Output 'FASE B4'
$log | ForEach-Object { Write-Output $_ }
[System.IO.File]::WriteAllText($p, $t, $enc)
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
