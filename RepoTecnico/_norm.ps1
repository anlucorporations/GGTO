$ErrorActionPreference = 'Stop'
$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$t = [System.IO.File]::ReadAllText($p)
Write-Output ('CRLF=' + ([regex]::Matches($t,"`r`n").Count) + ' LF=' + ([regex]::Matches($t,"(?<!`r)`n").Count))
$t2 = $t -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($p, $t2, (New-Object System.Text.UTF8Encoding($true)))
$t3 = [System.IO.File]::ReadAllText($p)
Write-Output ('tras normalizar: CRLF=' + ([regex]::Matches($t3,"`r`n").Count) + ' LF=' + ([regex]::Matches($t3,"(?<!`r)`n").Count))
Write-Output ('lineas=' + ($t3 -split "`n").Count + ' acento=' + $t3.Contains('sesión') + ' emdash=' + $t3.Contains('—'))
