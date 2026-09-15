@echo off
rem ---------------------------------------------------------------------------
rem  GGTO.bat - Lanzador de la jornada de GGTO-v1
rem  Central Francisco Salias (Area 4) - CANTV
rem
rem  Doble clic: despliega (carpetas + los 10 archivos de trabajo), situa el CSV
rem  del dia, muestra la rutina diaria y levanta el servidor local abriendo la
rem  pagina en el navegador.
rem
rem  Otros modos:  GGTO.bat desplegar | abrir | pruebas | cierre | estado | ayuda
rem  Opciones:     -Puerto 8787     -SinNavegador
rem
rem  El servidor escucha solo en 127.0.0.1 y publica solo app\ (D-15, RT-09).
rem ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"
title GGTO-v1 - Central Francisco Salias (Area 4)

if not exist "%~dp0GGTO.ps1" (
  echo ERROR: no se encontro GGTO.ps1 junto a este archivo.
  echo        Copie GGTO.bat y GGTO.ps1 en la raiz del proyecto.
  echo.
  pause
  exit /b 1
)

set "PS="
rem  PowerShell 7 si esta instalado; si no, Windows PowerShell 5.1 (siempre presente).
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "PS=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined PS if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not defined PS for %%P in (pwsh.exe powershell.exe) do if not defined PS set "PS=%%~$PATH:P"

if not defined PS (
  echo No se encontro PowerShell en este equipo.
  echo Se usara el lanzador minimo con Python ^(sin despliegue ni comprobaciones^).
  echo.
  call "%~dp0servir-ggto.bat"
  exit /b %errorlevel%
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0GGTO.ps1" %*
set "CODIGO=%errorlevel%"

if not "%CODIGO%"=="0" (
  echo.
  echo El lanzador termino con codigo %CODIGO%. Revise los mensajes anteriores.
  echo.
  pause
)

endlocal & exit /b %CODIGO%
