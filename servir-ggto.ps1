# servir-ggto.ps1 - servidor local de la pagina GGTO-v1 (solo loopback y solo app/)
#
#  - Escucha unicamente en 127.0.0.1 (D-15, RT-09): ningun otro equipo de la red
#    alcanza la pagina ni puede descargar los JSON.
#  - Publica unicamente el subdirectorio app/: datos/ y RepoTecnico/ quedan
#    fuera del alcance HTTP (D-15, H-01).
#  - Abre el navegador en http://localhost:8787/index.html, que es contexto
#    seguro y habilita File System Access API (RT-06).

param(
  [int]$Puerto = 8787,
  [switch]$SinNavegador
)

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Definition
$app  = Join-Path $raiz 'app'

if (-not (Test-Path -LiteralPath (Join-Path $app 'index.html'))) {
  Write-Host "ERROR: no se encontro $app\index.html" -ForegroundColor Red
  exit 1
}

# --- Puerto ocupado: se avisa y se busca uno libre -------------------------
$ocupado = $null
try { $ocupado = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction Stop } catch { $ocupado = $null }
if ($ocupado) {
  Write-Host "El puerto $Puerto esta en uso." -ForegroundColor Yellow
  $libre = 0
  for ($p = $Puerto + 1; $p -le $Puerto + 20; $p++) {
    $usado = $null
    try { $usado = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop } catch { $usado = $null }
    if (-not $usado) { $libre = $p; break }
  }
  if ($libre -eq 0) {
    Write-Host 'No se encontro un puerto alterno libre (probado del ' -NoNewline
    Write-Host "$($Puerto + 1) al $($Puerto + 20))." -ForegroundColor Red
    exit 1
  }
  Write-Host "Se usara el puerto alterno $libre." -ForegroundColor Yellow
  $Puerto = $libre
}

$url = "http://localhost:$Puerto/index.html"
Write-Host "Sirviendo $app en $url (solo loopback; datos\ no se publica)." -ForegroundColor Cyan
Write-Host 'Para detener el servidor, pulse Ctrl+C.' -ForegroundColor DarkGray

if (-not $SinNavegador) {
  Start-Process $url
}

# --- Opcion A: Python ------------------------------------------------------
$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
  & python -m http.server $Puerto --bind 127.0.0.1 --directory $app
  exit $LASTEXITCODE
}

# --- Opcion B: Node.js -----------------------------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $servidor = Join-Path $env:TEMP 'servir-ggto-node.mjs'
  $codigo = @'
// Servidor local minimo del lanzador GGTO-v1: solo 127.0.0.1 y solo app/.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const [raiz, puerto] = [process.argv[2], Number(process.argv[3])];
const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };
const servidor = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const destino = path.join(raiz, path.normalize(rel).replace(/^([/\\])+/, ''));
    if (!destino.startsWith(raiz)) { res.writeHead(403); res.end('Prohibido'); return; }
    const datos = await readFile(destino);
    res.writeHead(200, { 'Content-Type': tipos[path.extname(destino).toLowerCase()] || 'application/octet-stream' });
    res.end(datos);
  } catch (e) {
    res.writeHead(e && e.code === 'ENOENT' ? 404 : 500);
    res.end(e && e.code === 'ENOENT' ? 'Recurso no encontrado' : 'Error interno');
  }
});
servidor.listen(puerto, '127.0.0.1', () => {
  console.log('Lanzador Node: ' + raiz + ' en http://127.0.0.1:' + puerto + ' (solo loopback)');
});
'@
  Set-Content -LiteralPath $servidor -Value $codigo -Encoding utf8
  & node $servidor $app $Puerto
  exit $LASTEXITCODE
}

Write-Host 'No se encontro Python 3.7+ ni Node.js.' -ForegroundColor Red
Write-Host 'Instale uno de los dos o trabaje en modo descarga desde el navegador (RNF-03, CU-22).'
exit 1
