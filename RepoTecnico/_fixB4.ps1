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

# CU-15 paso 5 (variante exacta)
E 'sobre los cambios disponibles y exporta la vista en pantalla o la imprime.' 'sobre los cambios disponibles —comparación de **texto** en formato fijo `DD/MM/AAAA`, **nunca** un rango calculado sobre `fecha_modificacion`, que el diccionario declara TEXTO (H-29)— y exporta la vista en pantalla o la imprime.' 'CU15-paso5b'

# ================= CU-18 / CU-19 / CU-20 (semana operativa + D-51) =================
E '**Trazabilidad:** RF-05, RF-06, RF-25; RN-08; RNF-02, RNF-06, RNF-07, **RNF-08, RNF-12, RNF-13**; S-RNF-02b; D-17, D-23, D-24, **D-34, D-35, D-40, D-48, D-50**; H-16, H-28.' '**Trazabilidad:** RF-05, RF-06, RF-25; RN-08; RNF-02, RNF-06, RNF-07, **RNF-08, RNF-12, RNF-13**; S-RNF-02b; D-17, D-23, D-24, D-30, **D-34, D-35, D-40, D-48, D-50**; H-16, H-28.' 'CU18-traz'

E '- **El sistema deberá** calcular «asignados por día» de la zona CUADRILLA agrupando los casos por `fecha_asignacion` (fecha de la **última** asignación de cuadrilla, D-48), sin depender de archivos de despacho por fecha, y mostrar el criterio de cálculo y el rango temporal de cada cifra en pantalla. [D-48, H-28, RNF-01]' '- **El sistema deberá** calcular «asignados por día» de la zona CUADRILLA agrupando los casos por `fecha_asignacion` (fecha de la **última** asignación de cuadrilla, D-48), sin depender de archivos de despacho por fecha, y mostrar el criterio de cálculo y el rango temporal de cada cifra en pantalla. [D-48, H-28, RNF-01]
- **El sistema deberá** calcular «gestionados por día» como el número de **casos con `status = GESTION` distintos** cuyo último cambio de estado a GESTION cae en la fecha del día mostrado, contando cada `id_averia` **una sola vez** y excluyendo los reingresos del mismo caso en el mismo día; la tabla deberá mostrar la fecha de corte y el conteo de casos excluidos por no tener cambio de estado registrado. [RF-05, D-48, H-N-21]' 'CU18-ears'

E '2. **Dado** un rango de corte en la semana del 08/09/2026 al 13/09/2026, **Cuando** el supervisor abre GESTION SEMANAL, **Entonces** la curva muestra 6 puntos: lunes, martes, miércoles, jueves, viernes y sábado, y ningún punto de domingo.' '2. **Dado** un rango de corte en la semana operativa del **07/09/2026 (lunes) al 12/09/2026 (sábado)**, **Cuando** el supervisor abre GESTION SEMANAL, **Entonces** la curva muestra exactamente **6 puntos** fechados 07, 08, 09, 10, 11 y 12 de septiembre de 2026 y ningún punto del domingo 13/09/2026 (RN-08). [RN-08, H-N-22]' 'CU18-ca2'

E '- **2d. Corte sobre un domingo.** Si el usuario elige como fecha de corte el domingo 13/09/2026, el sistema lo ajusta al **sábado 12/09/2026** de esa semana operativa, lo informa en pantalla («Corte ajustado al sábado 12/09/2026: la semana operativa es de lunes a sábado») y dibuja 6 puntos, ninguno del domingo. [RN-08, D-34, H-N-22]
- **4a. Fecha de corte fuera de la semana operativa.**' 'CU18-alt2d'

Write-Output 'FASE B4'
$log | ForEach-Object { Write-Output $_ }
[System.IO.File]::WriteAllText($p, $t, $enc)
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
