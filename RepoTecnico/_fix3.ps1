$ErrorActionPreference = 'Stop'
$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$t = Get-Content -LiteralPath $p -Raw -Encoding UTF8
$edits = New-Object System.Collections.ArrayList
function E($old, $new, $tag) {
  $script:t2 = $script:t.Replace($old, $new)
  if ($script:t2 -eq $script:t) { [void]$script:edits.Add("FALLO<<$tag>>") }
  else { [void]$script:edits.Add("OK<<$tag>>"); $script:t = $script:t2 }
}

$old = @'
| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |
| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central (y supervisor) | C2 | MVP |
| CU-02 | Configurar los datos operativos de la central | Supervisor (función administrativa) | C1 | MVP |
'@
$new = @'
| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |
| CU-02 | Configurar los datos operativos de la central | Supervisor (función administrativa) | C1 | MVP |
'@
E $old $new 'idx-clean1'

$old2 = @'
| CU-08 | Ingestar el CSV diario | Operador de la central | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central | C2 | MVP |
| CU-10 | Gestionar y filtrar los CASOS | Operador de la central | C1 / C3 | MVP |
'@
$new2 = @'
| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central (y supervisor) | C2 | MVP |
| CU-10 | Gestionar y filtrar los CASOS | Operador de la central | C1 / C3 | MVP |
'@
E $old2 $new2 'idx-clean2'

Write-Output 'FASE 3'
$edits | ForEach-Object { Write-Output $_ }
Set-Content -LiteralPath $p -Value $t -Encoding UTF8 -NoNewline
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
