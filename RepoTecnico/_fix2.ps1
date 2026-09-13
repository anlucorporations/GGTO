$ErrorActionPreference = 'Stop'
$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$t = Get-Content -LiteralPath $p -Raw -Encoding UTF8
$edits = New-Object System.Collections.ArrayList
function E($old, $new, $tag) {
  $script:t2 = $script:t.Replace($old, $new)
  if ($script:t2 -eq $script:t) { [void]$script:edits.Add("FALLO<<$tag>>") }
  else { [void]$script:edits.Add("OK<<$tag>>"); $script:t = $script:t2 }
}

E '| **Cuadrilla / técnico de calle** | Secundario | Recibe la hoja impresa del despacho, ejecuta el trabajo y devuelve la hoja al cierre de la jornada. No opera la página en el MVP. | CU-16, CU-17 |' '| **Cuadrilla / técnico de calle** | Secundario | Recibe la hoja impresa del despacho, ejecuta el trabajo y devuelve la hoja al cierre de la jornada. No opera la página en el MVP. | CU-16, CU-17 |
| **Jefe de central** | Principal (consumo) | Consume las cifras de MONITOREO y de los reportes y decide sobre los casos especiales. **No** tiene rol propio en la matriz de §2.1 ni criterio de aceptación propio: queda como punto abierto en §5.4 (H-N-20). | CU-18, CU-19, CU-20 (solo lectura) |' 'H-N20b2'

E '| CU-08 | Ingestar el CSV diario | Operador de la central | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central | C2 | MVP |' '| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central (y supervisor) | C2 | MVP |' 'H-idx2b'

E '| CU-16 | Generar y ajustar el despacho del día | Supervisor (función administrativa) | C4 | posterior |' '| CU-16 | Generar y ajustar el despacho del día | Supervisor (función administrativa) | C4 | posterior |' 'chk-idx'

Write-Output 'FASE 2'
$edits | ForEach-Object { Write-Output $_ }
Set-Content -LiteralPath $p -Value $t -Encoding UTF8 -NoNewline
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
