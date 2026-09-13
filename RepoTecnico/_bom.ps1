param([string]$File)
$b = [System.IO.File]::ReadAllBytes($File)
if (-not ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)) {
  $bom = [byte[]](0xEF,0xBB,0xBF)
  $out = New-Object byte[] ($bom.Length + $b.Length)
  [System.Array]::Copy($bom, 0, $out, 0, $bom.Length)
  [System.Array]::Copy($b, 0, $out, $bom.Length, $b.Length)
  [System.IO.File]::WriteAllBytes($File, $out)
  Write-Output ('BOM anadido a ' + $File)
} else {
  Write-Output ('ya tenia BOM: ' + $File)
}
