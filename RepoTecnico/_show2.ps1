$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$t = [System.IO.File]::ReadAllText($p)
$lines = $t -split "`n"
function Show($from, $to) {
  for ($i = $from; $i -le $to; $i++) { if ($i -ge 1 -and $i -le $lines.Count) { Write-Output ("$i : " + $lines[$i-1]) } }
}
Write-Output '=== CU-11 alt/CA 750-775 ==='
Show 758 790
Write-Output '=== CU-12 ears 836-850 ==='
Show 836 850
Write-Output '=== CU-14 905-960 ==='
Show 906 962
