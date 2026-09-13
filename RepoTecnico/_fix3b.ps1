$ErrorActionPreference = 'Stop'
$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$enc = New-Object System.Text.UTF8Encoding($true)
$t = [System.IO.File]::ReadAllText($p)
$edits = New-Object System.Collections.ArrayList
function E($old, $new, $tag) {
  $o = $old -replace "`r`n", "`n"
  $n = $new -replace "`r`n", "`n"
  if ($script:t.Contains("`r`n")) { $o = $o -replace "`n", "`r`n"; $n = $n -replace "`n", "`r`n" }
  $t2 = $script:t.Replace($o, $n)
  if ($t2 -eq $script:t) { [void]$script:edits.Add("FALLO<<$tag>>") }
  else { [void]$script:edits.Add("OK<<$tag>>"); $script:t = $t2 }
}

$old = "| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |
| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central (y supervisor) | C2 | MVP |
| CU-02 | Configurar los datos operativos de la central | Supervisor (función administrativa) | C1 | MVP |"
$new = "| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |
| CU-02 | Configurar los datos operativos de la central | Supervisor (función administrativa) | C1 | MVP |"
E $old $new 'idx-clean1'

$old2 = "| CU-08 | Ingestar el CSV diario | Operador de la central | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central | C2 | MVP |"
$new2 = "| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central (y supervisor) | C2 | MVP |"
E $old2 $new2 'idx-clean2'

Write-Output 'FASE 3b'
$edits | ForEach-Object { Write-Output $_ }
[System.IO.File]::WriteAllText($p, $t, $enc)
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
