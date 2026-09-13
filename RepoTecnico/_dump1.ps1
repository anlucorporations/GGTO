$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$b = [System.IO.File]::ReadAllBytes($p)
$t = [System.IO.File]::ReadAllText($p)
Write-Output ('len chars=' + $t.Length + ' bytes=' + $b.Length)
# localizar '8. Si la credencial'
$pat = ([char]0x38) + '. Si la credencial'
$i = $t.IndexOf($pat)
Write-Output ('idx=' + $i)
if ($i -ge 0) {
  $seg = $t.Substring($i - 1, 340)
  $codes = @()
  foreach ($ch in $seg.ToCharArray()) { $codes += [int][char]$ch }
  Write-Output ($codes -join ',')
}
