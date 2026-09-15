<#
  GGTO.ps1 - Despliegue y jornada diaria de GGTO-v1
  Central Francisco Salias (Area 4) - CANTV

  Lo invoca GGTO.bat (doble clic). Modos:

    jornada    (por defecto) Verifica el despliegue, situa el CSV del dia, muestra
               la rutina diaria y levanta el servidor local abriendo la pagina.
    desplegar  Solo el despliegue: crea las carpetas y los 10 archivos de trabajo.
    abrir      Solo el servidor local (con -SinNavegador no abre el navegador).
    pruebas    Bateria completa: modulos y contratos + comprobacion E2E.
    cierre     Rutina de cierre del dia y apertura de las carpetas de salida.
    estado     Diagnostico del puesto, de los datos y de la copia de cierre.
    ayuda      Esta ayuda.

  Este lanzador NO hace copias de seguridad por su cuenta: la copia de cierre es la
  verificada por relectura de CONFIGURACION -> RESPALDO (D-49, RNF-16).
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('jornada', 'desplegar', 'abrir', 'pruebas', 'cierre', 'estado', 'ayuda')]
  [string]$Modo = 'jornada',
  [int]$Puerto = 8787,
  [switch]$SinNavegador
)

$ErrorActionPreference = 'Stop'

$Raiz = $PSScriptRoot
if (-not $Raiz) { $Raiz = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$App = Join-Path $Raiz 'app'
$Datos = 'C:\GGTO\datos'
$Respaldo = 'C:\GGTO\respaldo'
$Despachos = 'C:\GGTO\despachos'
$Servidor = Join-Path $Raiz 'servir-ggto.ps1'

$script:Avisos = 0
$script:Errores = 0

# --------------------------------------------------------------------------
# Presentacion
# --------------------------------------------------------------------------
function Escribir {
  param([string]$Texto = '', [string]$Color = 'Gray')
  Write-Host $Texto -ForegroundColor $Color
}
function Titulo {
  param([string]$Texto)
  Escribir ''
  Escribir ('=' * 74) 'DarkCyan'
  Escribir ('  ' + $Texto) 'Cyan'
  Escribir ('=' * 74) 'DarkCyan'
}
function Bien { param([string]$T) Escribir ('  [ok]    ' + $T) 'Green' }
function Aviso { param([string]$T) $script:Avisos++; Escribir ('  [aviso] ' + $T) 'Yellow' }
function Mal { param([string]$T) $script:Errores++; Escribir ('  [error] ' + $T) 'Red' }
function Dato { param([string]$T) Escribir ('  - ' + $T) 'Gray' }

# --------------------------------------------------------------------------
# Despliegue: estructura, carpetas y archivos de trabajo
# --------------------------------------------------------------------------
function Probar-Aplicacion {
  $obligatorios = @(
    'app\index.html', 'app\css\estilos.css', 'app\js\app.js', 'app\js\nucleo.js',
    'app\js\almacen.js', 'app\lib\jspdf.umd.min.js', 'app\lib\chart.umd.min.js'
  )
  $faltan = @()
  foreach ($rel in $obligatorios) {
    if (-not (Test-Path -LiteralPath (Join-Path $Raiz $rel))) { $faltan += $rel }
  }
  if ($faltan.Count -gt 0) {
    Mal ('faltan archivos de la aplicacion: ' + ($faltan -join ', '))
    return $false
  }
  $modulos = @(Get-ChildItem -LiteralPath (Join-Path $App 'js') -Filter '*.js' -File -ErrorAction SilentlyContinue)
  $librerias = @(Get-ChildItem -LiteralPath (Join-Path $App 'lib') -Filter '*.js' -File -ErrorAction SilentlyContinue)
  if ($modulos.Count -eq 16) { Bien 'aplicacion completa: 16 archivos .js en app\js' }
  else { Aviso ('app\js tiene ' + $modulos.Count + ' archivos .js; el proyecto documenta 16') }
  if ($librerias.Count -eq 2) { Bien 'librerias locales fijadas (jsPDF y Chart.js): sin dependencia de internet' }
  else { Aviso ('app\lib tiene ' + $librerias.Count + ' librerias; el proyecto documenta 2 (RT-07)') }
  return $true
}

function Probar-Runtime {
  $py = Get-Command python -ErrorAction SilentlyContinue
  $nd = Get-Command node -ErrorAction SilentlyContinue
  if ($py) { Bien ('Python disponible: ' + (& python --version 2>&1)) }
  if ($nd) { Bien ('Node.js disponible: ' + (& node --version 2>&1)) }
  if (-not $py -and -not $nd) {
    Mal 'no hay Python 3.7+ ni Node.js: sin servidor local la pagina no puede leer ni escribir los JSON (RT-06).'
    return $false
  }
  return $true
}

function Asegurar-Carpetas {
  foreach ($c in @(
      @{ ruta = $Datos; uso = 'archivos de trabajo (los 10)' },
      @{ ruta = $Respaldo; uso = 'copia de cierre del dia' },
      @{ ruta = $Despachos; uso = 'ruta controlada de los PDF (D-67)' })) {
    if (Test-Path -LiteralPath $c.ruta) { Bien ('carpeta ' + $c.ruta + ' (' + $c.uso + ')') }
    else {
      New-Item -ItemType Directory -Force -Path $c.ruta | Out-Null
      if (Test-Path -LiteralPath $c.ruta) { Bien ('carpeta ' + $c.ruta + ' creada (' + $c.uso + ')') }
      else { Mal ('no se pudo crear ' + $c.ruta) }
    }
  }
}

$CODIGO_DATOS = @'
// Despliegue de los archivos de trabajo: crea los que falten desde la semilla del
// nucleo y comprueba que los que ya existen sean validos. No sobrescribe nada.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const raizApp = process.argv[2];
const rutaDatos = process.argv[3];
const salida = [];

const esJSON = (t) => { try { JSON.parse(t); return true; } catch { return false; } };

fs.mkdirSync(rutaDatos, { recursive: true });
const N = require(path.join(raizApp, 'js', 'nucleo.js'));
const semilla = N.estructurasIniciales();

for (const nombre of Object.keys(semilla)) {
  const destino = path.join(rutaDatos, nombre);
  if (!fs.existsSync(destino)) {
    const contenido = nombre.endsWith('.jsonl')
      ? String(semilla[nombre])
      : JSON.stringify(semilla[nombre], null, 2) + '\n';
    fs.writeFileSync(destino, contenido, 'utf8');
    salida.push(['creado', nombre, 'sembrado desde app/js/nucleo.js']);
    continue;
  }
  const texto = fs.readFileSync(destino, 'utf8');
  if (nombre.endsWith('.jsonl')) {
    const malas = texto.split(/\r?\n/).filter((l) => l.trim() !== '' && !esJSON(l));
    salida.push(malas.length
      ? ['invalido', nombre, malas.length + ' linea(s) no son JSON: el historial es append-only (D-56)']
      : ['ok', nombre, texto.split(/\r?\n/).filter((l) => l.trim() !== '').length + ' linea(s)']);
    continue;
  }
  if (texto.trim() === '') { salida.push(['invalido', nombre, 'archivo vacio: no es JSON valido']); continue; }
  try {
    const datos = JSON.parse(texto);
    salida.push(['ok', nombre, Array.isArray(datos) ? datos.length + ' registro(s)' : 'objeto de configuracion']);
  } catch (e) {
    salida.push(['invalido', nombre, 'no es JSON valido: ' + e.message]);
  }
}

// Contrato del CSV (D-44, D-69): la ingesta es bloqueante y espera la version 2.
const rutaEstructura = path.join(rutaDatos, 'estructura.json');
if (fs.existsSync(rutaEstructura)) {
  try {
    const e = JSON.parse(fs.readFileSync(rutaEstructura, 'utf8'));
    const campos = Array.isArray(e.campos) ? e.campos : [];
    const conCabecera = campos.filter((c) => typeof c.cabecera === 'string' && c.cabecera !== '').length;
    const noPersisten = Array.isArray(e.no_se_persisten) ? e.no_se_persisten.slice().sort((a, b) => a - b) : [];
    const problemas = [];
    if (e.version !== 2) problemas.push('version ' + e.version + ' (se espera 2)');
    if (campos.length !== 25) problemas.push(campos.length + ' campos (se esperan 25)');
    if (conCabecera !== campos.length) problemas.push(conCabecera + ' de ' + campos.length + ' campos con cabecera');
    if (String(noPersisten) !== String([18, 30, 53, 80])) problemas.push('no_se_persisten = [' + noPersisten + '] (se espera [18, 30, 53, 80])');
    if (e.columnas_esperadas !== 80) problemas.push('columnas_esperadas = ' + e.columnas_esperadas + ' (se esperan 80)');
    salida.push(problemas.length
      ? ['aviso', 'estructura.json', 'contrato incompleto: ' + problemas.join('; ') + ' -> la ingesta abortara (D-44)']
      : ['ok', 'estructura.json', 'contrato v2: 25 campos con cabecera, 80 columnas, no_se_persisten [18, 30, 53, 80]']);
  } catch (e) {
    salida.push(['invalido', 'estructura.json', 'no es JSON valido: ' + e.message]);
  }
}

salida.forEach((f) => console.log(f.join('\t')));
'@

function Probar-Datos {
  $nd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nd) {
    Aviso 'sin Node.js no se pueden sembrar ni verificar los archivos de trabajo; la pagina ofrece crearlos al autorizar la carpeta.'
    return
  }
  $scriptPrep = Join-Path $env:TEMP 'ggto-preparar-datos.mjs'
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($scriptPrep, $CODIGO_DATOS, $utf8)
  # La salida de un programa nativo por stderr no debe abortar el lanzador: se
  # relaja ErrorActionPreference solo durante la llamada y se comprueba el codigo.
  $previo = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $lineas = @()
  try { $lineas = @(& node $scriptPrep $App $Datos 2>&1) } finally { $ErrorActionPreference = $previo }
  $codigo = $LASTEXITCODE
  if ($codigo -ne 0) {
    Mal ('no se pudieron preparar los archivos de trabajo (node termino con ' + $codigo + '): ' + ($lineas -join ' '))
    return
  }
  $hayInvalidos = $false
  foreach ($linea in $lineas) {
    $partes = ([string]$linea) -split "`t"
    if ($partes.Count -lt 3) { continue }
    $texto = $partes[1] + ': ' + $partes[2]
    switch ($partes[0]) {
      'creado' { Bien ('creado ' + $texto) }
      'ok' { Dato ('ok      ' + $texto) }
      'aviso' { Aviso $texto }
      default { Mal $texto; $hayInvalidos = $true }
    }
  }
  if ($hayInvalidos) {
    Dato 'Un archivo ilegible no se toca nunca solo: renombrelo (por ejemplo a .roto) y'
    Dato 'vuelva a ejecutar el despliegue para sembrarlo de nuevo desde el nucleo.'
  }
}

function Invoke-Despliegue {
  Titulo 'DESPLIEGUE GGTO-v1'
  Dato ('proyecto: ' + $Raiz)
  Dato ('datos:    ' + $Datos)
  Dato ('fecha:    ' + (Get-Date -Format 'dd/MM/yyyy HH:mm'))
  Escribir ''
  # OJO: estos nombres no pueden ser $app ni $runtime (PowerShell no distingue
  # mayusculas): $app sobrescribiria la ruta de la aplicacion ($App) y el paso de
  # preparar los datos recibiria "True" en lugar de la carpeta.
  $okApp = Probar-Aplicacion
  $okRuntime = Probar-Runtime
  Asegurar-Carpetas
  Escribir ''
  Escribir '  Archivos de trabajo:' 'White'
  Probar-Datos
  return ($okApp -and $okRuntime)
}

# --------------------------------------------------------------------------
# El CSV del dia
# --------------------------------------------------------------------------
function Buscar-Csv {
  $sitios = @($Raiz, 'C:\GGTO', (Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:USERPROFILE 'Desktop'))
  $vistos = @{}
  $lista = @()
  foreach ($s in $sitios) {
    if (-not $s -or -not (Test-Path -LiteralPath $s)) { continue }
    foreach ($f in (Get-ChildItem -LiteralPath $s -Filter '*gpon*.csv' -File -ErrorAction SilentlyContinue)) {
      if ($vistos.ContainsKey($f.FullName)) { continue }
      $vistos[$f.FullName] = $true
      $lista += $f
    }
  }
  return @($lista | Sort-Object LastWriteTime -Descending)
}

function Mostrar-Csv {
  $hoy = Get-Date -Format 'dd_MM_yyyy'
  $esperado = 'detalle_averias_gpon ' + $hoy + '.csv'
  $lista = Buscar-Csv
  Escribir ''
  Escribir ('  CSV de entrada de hoy (' + $hoy + '):') 'White'
  $deHoy = @($lista | Where-Object { $_.Name -like ('*' + $hoy + '*') })
  if ($deHoy.Count -gt 0) {
    foreach ($f in $deHoy) { Bien ($f.FullName + '  (' + [math]::Round($f.Length / 1KB) + ' KB)') }
  } else {
    Aviso ('no se encontro el archivo de hoy (' + $esperado + ').')
    if ($lista.Count -gt 0) {
      Escribir '  Ultimos archivos encontrados (se elige igualmente desde el navegador):' 'Yellow'
      foreach ($f in ($lista | Select-Object -First 3)) {
        Dato ($f.FullName + '  -  ' + $f.LastWriteTime.ToString('dd/MM/yyyy HH:mm'))
      }
    } else {
      Dato 'no hay ningun *gpon*.csv en el proyecto, en C:\GGTO, en Descargas ni en el Escritorio.'
    }
    Dato 'El archivo lo aporta el emisor cada dia; en la pagina se elige con el selector de archivos.'
  }
  return $deHoy
}

function Abrir-Carpeta {
  param([string]$Ruta)
  if (Test-Path -LiteralPath $Ruta) { Start-Process -FilePath 'explorer.exe' -ArgumentList $Ruta | Out-Null }
}

# --------------------------------------------------------------------------
# Rutina diaria y de cierre
# --------------------------------------------------------------------------
function Mostrar-RutinaDiaria {
  $csv = Mostrar-Csv
  Escribir ''
  Escribir '  RUTINA DIARIA (en la pagina, una sola pestana por vez):' 'White'
  Dato '1. Iniciar sesion con el P00 y la contrasena (8+ caracteres; la sesion dura 8 horas).'
  if ($csv.Count -gt 0) {
    Dato ('2. PANEL -> INGESTA: elegir el CSV del dia (' + $csv[0].Name + '); revisar el resumen y confirmar.')
  } else {
    Dato '2. PANEL -> INGESTA: elegir el CSV que entrego el emisor; revisar el resumen y confirmar.'
  }
  Dato '3. DESPACHO: generar el reparto, ajustarlo y emitir el PDF por cuadrilla (va a C:\GGTO\despachos).'
  Dato '4. DESPACHO -> control documental: entregar, recoger y destruir las hojas del dia.'
  Dato '5. CASOS y GESTION durante la jornada; MONITOREO, GRAFICOS y REPORTES si es supervisor.'
  Dato '6. Al cerrar: CONFIGURACION -> RESPALDO -> Respaldar ahora, y ENTORNO para verificar el cierre.'
  Escribir ''
}

function Mostrar-RutinaCierre {
  Escribir ''
  Escribir '  CIERRE DEL DIA:' 'White'
  Dato '1. CONFIGURACION -> RESPALDO: pulse Respaldar ahora (copia de los 10 archivos, verificada por relectura).'
  Dato '2. El supervisor lleva la copia de C:\GGTO\respaldo a la red o a un pendrive (D-49).'
  Dato '3. CONFIGURACION -> ENTORNO: comprobar la ultima escritura, el ultimo respaldo y las incidencias del dia.'
  Dato '4. No cierre la ventana del servidor hasta que el respaldo este confirmado.'
  Escribir ''
}

# --------------------------------------------------------------------------
# Estado del puesto
# --------------------------------------------------------------------------
function Mostrar-Estado {
  Titulo 'ESTADO GGTO-v1'
  Dato ('proyecto: ' + $Raiz)
  $py = Get-Command python -ErrorAction SilentlyContinue
  $nd = Get-Command node -ErrorAction SilentlyContinue
  if ($py) { Dato ('python:   ' + (& python --version 2>&1)) } else { Aviso 'python: no instalado' }
  if ($nd) { Dato ('node:     ' + (& node --version 2>&1)) } else { Aviso 'node: no instalado' }
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git) {
    Push-Location $Raiz
    try {
      $commit = (& git log --oneline -1 2>$null)
      $rama = (& git rev-parse --abbrev-ref HEAD 2>$null)
      $sucio = @(& git status --porcelain 2>$null).Count
      Dato ('git:      ' + $rama + ' @ ' + $commit + ' (' + $sucio + ' archivo(s) sin confirmar)')
    } catch { } finally { Pop-Location }
  }

  Escribir ''
  Escribir '  Carpetas y archivos de trabajo:' 'White'
  foreach ($c in @($Datos, $Respaldo, $Despachos)) {
    if (Test-Path -LiteralPath $c) { Dato ($c + '  (existe)') } else { Aviso ($c + '  (no existe)') }
  }
  if (Test-Path -LiteralPath $Datos) {
    foreach ($f in (Get-ChildItem -LiteralPath $Datos -File -ErrorAction SilentlyContinue | Sort-Object Name)) {
      $marca = $f.LastWriteTime.ToString('dd/MM/yyyy HH:mm')
      Dato ($f.Name.PadRight(34) + $marca.PadLeft(18) + ('   ' + $f.Length + ' B'))
    }
  }

  Escribir ''
  Escribir '  Copia de cierre (D-49):' 'White'
  if (Test-Path -LiteralPath $Respaldo) {
    $copias = @(Get-ChildItem -LiteralPath $Respaldo -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like 'averias_*.json' } | Sort-Object LastWriteTime -Descending)
    if ($copias.Count -eq 0) { Aviso 'no hay ninguna copia de cierre en C:\GGTO\respaldo' }
    else {
      Bien ('ultima copia: ' + $copias[0].Name + '  (' + $copias[0].LastWriteTime.ToString('dd/MM/yyyy HH:mm') + ')')
      Dato ($copias.Count.ToString() + ' copia(s) del maestro en la carpeta')
    }
  }

  if (Test-Path -LiteralPath $Despachos) {
    $pdfs = @(Get-ChildItem -LiteralPath $Despachos -File -Filter '*.pdf' -ErrorAction SilentlyContinue)
    Escribir ''
    Escribir '  Ruta controlada de los PDF (D-67):' 'White'
    if ($pdfs.Count -eq 0) { Dato 'sin PDF emitidos todavia' }
    else {
      foreach ($p in ($pdfs | Sort-Object LastWriteTime -Descending | Select-Object -First 6)) {
        Dato ($p.Name.PadRight(46) + $p.LastWriteTime.ToString('dd/MM/yyyy HH:mm'))
      }
      if ($pdfs.Count -gt 6) { Dato ('... y ' + ($pdfs.Count - 6) + ' mas') }
    }
  }

  $log = Join-Path $Datos 'incidencias.log'
  if (Test-Path -LiteralPath $log) {
    Escribir ''
    Escribir '  Ultimas incidencias registradas:' 'White'
    Get-Content -LiteralPath $log -Tail 5 -ErrorAction SilentlyContinue | ForEach-Object { Dato ([string]$_) }
  }
}

# --------------------------------------------------------------------------
# Pruebas
# --------------------------------------------------------------------------
function Invoke-Pruebas {
  Titulo 'PRUEBAS GGTO-v1'
  $nd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nd) { Mal 'se necesita Node.js para ejecutar la bateria de pruebas'; return $false }
  $archivos = @(
    'pruebas/pruebas_c1.mjs', 'pruebas/pruebas_almacen_c1.mjs', 'pruebas/pruebas_c1b.mjs',
    'pruebas/pruebas_c2.mjs', 'pruebas/pruebas_c3.mjs', 'pruebas/pruebas_c4.mjs',
    'pruebas/pruebas_c4b.mjs', 'pruebas/pruebas_c5.mjs', 'pruebas/pruebas_c6.mjs',
    'pruebas/pruebas_c7.mjs', 'pruebas/pruebas_cu22.mjs', 'pruebas/pruebas_contratos.mjs'
  )
  Push-Location $Raiz
  try {
    Escribir '  Modulos y contratos (node --test)...' 'White'
    $salida = & node --test $archivos 2>&1
    $codigo = $LASTEXITCODE
    $texto = ($salida | Out-String)
    $okModulos = ($codigo -eq 0)
    $cifras = @()
    foreach ($clave in @('tests', 'pass', 'fail')) {
      $m = [regex]::Matches($texto, $clave + '\s+(\d+)')
      if ($m.Count -gt 0) { $cifras += ($clave + ' ' + $m[$m.Count - 1].Groups[1].Value) }
    }
    if ($cifras.Count -gt 0) { Dato ($cifras -join ' | ') }
    if ($okModulos) { Bien 'modulos y contratos: sin fallos' }
    else {
      Mal 'modulos y contratos: hay fallos'
      $salida | Where-Object { $_ -match 'not ok|AssertionError|failing tests' } | Select-Object -First 12 | ForEach-Object { Dato ([string]$_) }
    }

    Escribir ''
    Escribir '  Comprobacion de interfaz en navegador (Chrome/Edge headless)...' 'White'
    $e2e = & node 'pruebas/interfaz.mjs' 2>&1
    $codigoE2e = $LASTEXITCODE
    # El arnes escribe 'Comprobacion de interfaz: N/M correctas.' (con acento en el
    # fuente); se busca la palabra llana para no depender de la codificacion.
    $ultima = @($e2e | Where-Object { $_ -match 'correctas' })
    if ($ultima.Count -gt 0) { Dato ([string]$ultima[-1]) }
    $okE2e = ($codigoE2e -eq 0)
    if ($okE2e) { Bien 'interfaz: sin fallos' }
    else {
      Mal 'interfaz: hay fallos'
      $e2e | Where-Object { $_ -match '^FAIL' } | Select-Object -First 12 | ForEach-Object { Dato ([string]$_) }
    }
    return ($okModulos -and $okE2e)
  } finally { Pop-Location }
}

# --------------------------------------------------------------------------
# Servidor y modos
# --------------------------------------------------------------------------
function Test-PuertoLibre {
  param([int]$p)
  $ocupado = $null
  try { $ocupado = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop } catch { $ocupado = $null }
  return (-not $ocupado)
}

function Iniciar-Servidor {
  param([switch]$VerificarRuntime)
  if ($VerificarRuntime) {
    if (-not (Probar-Runtime)) {
      Mal 'no se puede levantar el servidor local.'
      return $false
    }
  }
  if (-not (Test-PuertoLibre $Puerto)) {
    Aviso ('el puerto ' + $Puerto + ' esta ocupado: el lanzador usara el primero libre entre ' +
      ($Puerto + 1) + ' y ' + ($Puerto + 20))
  }
  Escribir ''
  Escribir '  Para detener el servidor y cerrar la jornada: Ctrl+C en esta ventana.' 'DarkGray'
  $argumentos = @{ Puerto = $Puerto }
  if ($SinNavegador) { $argumentos['SinNavegador'] = $true }
  & $Servidor @argumentos
  return $true
}

function Mostrar-Ayuda {
  Titulo 'GGTO-v1 - AYUDA'
  Escribir '  Uso:  GGTO.bat [modo] [-Puerto 8787] [-SinNavegador]' 'White'
  Escribir ''
  Dato 'jornada    (por defecto) Despliegue + CSV del dia + rutina + servidor y navegador.'
  Dato 'desplegar  Verifica y crea las carpetas y los 10 archivos de trabajo. No arranca nada mas.'
  Dato 'abrir      Solo el servidor local (y el navegador, salvo -SinNavegador).'
  Dato 'pruebas    Bateria completa: modulos y contratos + comprobacion de interfaz en navegador.'
  Dato 'cierre     Rutina de cierre del dia y apertura de C:\GGTO\respaldo y C:\GGTO\despachos.'
  Dato 'estado     Diagnostico del puesto: runtime, datos, copia de cierre y PDF emitidos.'
  Dato 'ayuda      Esta ayuda.'
  Escribir ''
  Dato 'Rutas: datos C:\GGTO\datos - respaldo C:\GGTO\respaldo - PDF C:\GGTO\despachos.'
  Dato 'La pagina se sirve solo en loopback (127.0.0.1) y publica solo app\ (D-15, RT-09).'
  Dato 'Nunca abra app\index.html con doble clic: en file:// la pagina se bloquea a proposito.'
}

# --------------------------------------------------------------------------
# Programa
# --------------------------------------------------------------------------
switch ($Modo) {
  'ayuda' { Mostrar-Ayuda; exit 0 }
  'estado' { Mostrar-Estado; exit 0 }
  'cierre' {
    Titulo 'CIERRE DE LA JORNADA'
    Mostrar-RutinaCierre
    Escribir '  Abriendo las carpetas de salida...' 'White'
    Abrir-Carpeta $Respaldo
    Abrir-Carpeta $Despachos
    exit 0
  }
  'desplegar' {
    $ok = Invoke-Despliegue
    Escribir ''
    if ($ok -and $script:Errores -eq 0) {
      Bien ('despliegue correcto (' + $script:Avisos + ' aviso(s)): el proyecto esta listo para la jornada.')
      exit 0
    }
    Mal ('despliegue incompleto: ' + $script:Errores + ' error(es), ' + $script:Avisos + ' aviso(s).')
    exit 1
  }
  'pruebas' {
    $ok = Invoke-Despliegue
    Escribir ''
    if (-not $ok) { Mal 'el despliegue tiene errores: corrija antes de fiarse de las pruebas.' }
    $okPruebas = Invoke-Pruebas
    Escribir ''
    if ($okPruebas) { Bien 'BATERIA COMPLETA EN VERDE.'; exit 0 }
    Mal 'LA BATERIA TIENE FALLOS.'
    exit 1
  }
  'abrir' {
    Titulo 'SERVIDOR GGTO-v1'
    Asegurar-Carpetas | Out-Null
    [void](Iniciar-Servidor -VerificarRuntime)
    exit 0
  }
  default {
    $ok = Invoke-Despliegue
    if (-not $ok) {
      Escribir ''
      Mal 'no se puede abrir la jornada: el despliegue tiene errores.'
      exit 1
    }
    Mostrar-RutinaDiaria
    [void](Iniciar-Servidor)
    Mostrar-RutinaCierre
    Escribir '  Servidor detenido. Jornada finalizada.' 'DarkCyan'
    exit 0
  }
}
