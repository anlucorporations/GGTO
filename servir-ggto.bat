@echo off
rem servir-ggto.bat - lanzador del entorno GGTO-v1 (solo loopback y solo app\)
rem Equivale a: python -m http.server 8787 --bind 127.0.0.1 --directory app
setlocal
cd /d "%~dp0"

if not exist "app\index.html" (
  echo ERROR: no se encontro app\index.html
  exit /b 1
)

echo Sirviendo "%CD%\app" en http://localhost:8787 ^(solo loopback; datos\ no se publica^).
start "" http://localhost:8787/index.html
python -m http.server 8787 --bind 127.0.0.1 --directory app
if errorlevel 1 (
  echo.
  echo No se pudo levantar el servidor con Python. Use: pwsh -File .\servir-ggto.ps1
  echo o instale Python 3.7+ / Node.js.
  exit /b 1
)
endlocal
