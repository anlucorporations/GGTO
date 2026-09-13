$h = @"
linea1
linea2
"@
Write-Output ('script-herestring CR: ' + $h.Contains("`r"))
$t = Get-Content -LiteralPath 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md' -Raw -Encoding UTF8
Write-Output ('leido CRLF: ' + ([regex]::Matches($t,"`r`n").Count))
Write-Output ('match multilinea: ' + ($t.Contains("| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |`r`n| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |")))
