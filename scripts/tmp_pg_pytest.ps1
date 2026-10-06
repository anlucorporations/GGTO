# Levanta el clúster PostgreSQL temporal de pruebas (si hace falta) y ejecuta la
# suite de integración contra él, todo en el mismo proceso para que el servidor
# viva lo que dure la corrida.
#
#   pwsh -File scripts/tmp_pg_pytest.ps1                 # suite completa
#   pwsh -File scripts/tmp_pg_pytest.ps1 app/tests/x.py  # subset
param(
  [int]$Puerto = 5599,
  [string]$Raiz = 'C:\GGTO\pgtmp',
  [string[]]$Rutas = @()
)
$ErrorActionPreference = 'Continue'
$pg = 'C:\Program Files\PostgreSQL\18\bin'
$data = Join-Path $Raiz 'data'

function Test-Pg {
  $r = & "$pg\pg_isready.exe" -h 127.0.0.1 -p $Puerto 2>&1
  return $LASTEXITCODE -eq 0
}

if (-not (Test-Pg)) {
  # Si el clúster no existe todavía, se inicializa (trust local, sin contraseña).
  if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
    New-Item -ItemType Directory -Force -Path $Raiz | Out-Null
    & "$pg\initdb.exe" -D $data -U ggto -A trust -E UTF8 --locale=C | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Output 'ERROR: initdb falló'
      exit 3
    }
  }
  # `Start-Process` con salida redirigida evita que el postmaster herede la
  # tubería del shell (que dejaba el comando colgado en Windows). Las opciones de
  # `-o` van entre comillas: si no, Start-Process las parte en varios argumentos.
  $opciones = "-p $Puerto -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off"
  $argumentos = "-D `"$data`" start -o `"$opciones`" -l `"$(Join-Path $Raiz 'pg.log')`""
  Start-Process -FilePath "$pg\pg_ctl.exe" -ArgumentList $argumentos `
    -RedirectStandardOutput (Join-Path $Raiz 'pg_ctl.out') `
    -RedirectStandardError (Join-Path $Raiz 'pg_ctl.err') -Wait -NoNewWindow
  for ($i = 0; $i -lt 30 -and -not (Test-Pg); $i++) { Start-Sleep -Seconds 1 }
}

if (-not (Test-Pg)) {
  Write-Output 'ERROR: el clúster de pruebas no arrancó'
  exit 2
}

# Base y extensiones (idempotente).
& "$pg\psql.exe" -h 127.0.0.1 -p $Puerto -U ggto -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='ggto_test'" | Out-Null
$existe = & "$pg\psql.exe" -h 127.0.0.1 -p $Puerto -U ggto -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='ggto_test'"
if ("$existe".Trim() -ne '1') {
  & "$pg\createdb.exe" -h 127.0.0.1 -p $Puerto -U ggto ggto_test | Out-Null
}
& "$pg\psql.exe" -h 127.0.0.1 -p $Puerto -U ggto -d ggto_test -q -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm" | Out-Null

$env:GGTO_TEST_DB_URL = "postgresql+psycopg2://ggto@127.0.0.1:$Puerto/ggto_test"
$env:GGTO_TEST_SCHEMA = 'ggto_test'
$destino = if ($Rutas.Count -gt 0) { $Rutas } else { @() }
python -m pytest -q @destino 2>&1 | Select-Object -Last 25
