$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$t = [System.IO.File]::ReadAllText($p)
$lines = $t -split "`n"
function Show($from, $to) {
  for ($i = $from; $i -le $to; $i++) {
    if ($i -ge 1 -and $i -le $lines.Count) { Write-Output ("$i : " + $lines[$i-1]) }
  }
}
Write-Output '=== ACTORES 50-66 ==='
Show 50 66
Write-Output '=== INDEX 103-131 ==='
Show 103 131
Write-Output '=== MATRIZ 63-96 ==='
Show 63 96
