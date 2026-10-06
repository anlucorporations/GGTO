# Levanta el clúster PostgreSQL temporal de pruebas (si hace falta) y ejecuta la
# suite de integración contra él.
#
#   pwsh -File scripts/tmp_pg_pytest.ps1                 # suite completa
#   pwsh -File scripts/tmp_pg_pytest.ps1 app/tests/x.py  # subset
#
# Notas de Windows (por qué el script está escrito así):
#   · `pg_ctl start` se lanza con `Start-Process` y la salida redirigida a
#     archivos: si no, el postmaster hereda la tubería del shell y el comando se
#     queda colgado al terminar.
#   · La salida de `pytest` va a un archivo y luego se muestra el final: pasar la
#     salida por una tubería de PowerShell vuelve a colgarse por el mismo motivo.
#   · El clúster se recrea solo si falta el directorio de datos (`initdb`).
param(
  [int]$Puerto = 5599,
  [string]$Raiz = 'C:\GGTO\pgtmp',
  [string[]]$Rutas = @()
)
$ErrorActionPreference = 'Continue'
$pg = 'C:\Program Files\PostgreSQL\18\bin'
$data = Join-Path $Raiz 'data'
$logPytest = Join-Path $Raiz 'pytest_tmp_pg.log'

function Test-Pg {
  & "$pg\pg_isready.exe" -h 127.0.0.1 -p $Puerto *> $null
  return $LASTEXITCODE -eq 0
}

function En-Ejecucion {
  # `pg_ctl status`: 0 = en ejecución, 3 = detenido, 4 = sin directorio de datos.
  & "$pg\pg_ctl.exe" -D $data status *> $null
  return $LASTEXITCODE -eq 0
}

function Esperar-Pg([int]$Segundos) {
  for ($i = 0; $i -lt $Segundos; $i++) {
    if (Test-Pg) { return $true }
    Start-Sleep -Seconds 1
  }
  return (Test-Pg)
}

if (-not (Test-Pg) -and -not (En-Ejecucion)) {
  # Si el clúster no existe todavía, se inicializa (trust local, sin contraseña).
  if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
    New-Item -ItemType Directory -Force -Path $Raiz | Out-Null
    & "$pg\initdb.exe" -D $data -U ggto -A trust -E UTF8 --locale=C *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-Output 'ERROR: initdb falló'
      exit 3
    }
  }
  # Las opciones de `-o` van entre comillas: si no, Start-Process las parte.
  # OJO: sin `-Wait`; el arranque se confirma con `pg_isready` (con `-Wait`, el
  # postmaster hereda las asas y el comando puede quedarse esperando).
  $opciones = "-p $Puerto -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off"
  $argumentos = "-D `"$data`" start -o `"$opciones`" -l `"$(Join-Path $Raiz 'pg.log')`""
  Start-Process -FilePath "$pg\pg_ctl.exe" -ArgumentList $argumentos `
    -RedirectStandardOutput (Join-Path $Raiz 'pg_ctl.out') `
    -RedirectStandardError (Join-Path $Raiz 'pg_ctl.err') -WindowStyle Hidden
  if (-not (Esperar-Pg 90)) {
    Write-Output 'ERROR: el clúster de pruebas no arrancó'
    Write-Output '--- pg_ctl.err ---'
    Get-Content (Join-Path $Raiz 'pg_ctl.err') -Tail 10 -ErrorAction SilentlyContinue
    Write-Output '--- pg.log (últimas líneas) ---'
    Get-Content (Join-Path $Raiz 'pg.log') -Tail 10 -ErrorAction SilentlyContinue
    exit 2
  }
}

# Base y extensiones (idempotente).
$existe = & "$pg\psql.exe" -h 127.0.0.1 -p $Puerto -U ggto -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='ggto_test'"
if ("$existe".Trim() -ne '1') {
  & "$pg\createdb.exe" -h 127.0.0.1 -p $Puerto -U ggto ggto_test *> $null
}
& "$pg\psql.exe" -h 127.0.0.1 -p $Puerto -U ggto -d ggto_test -q `
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm" *> $null

$env:GGTO_TEST_DB_URL = "postgresql+psycopg2://ggto@127.0.0.1:$Puerto/ggto_test"
$env:GGTO_TEST_SCHEMA = 'ggto_test'
$destino = if ($Rutas.Count -gt 0) { $Rutas } else { @() }

python -m pytest -q @destino > $logPytest 2>&1
$codigo = $LASTEXITCODE
Get-Content $logPytest -Tail 25
exit $codigo
