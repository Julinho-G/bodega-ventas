@echo off
rem ===================================================================
rem  Apaga BODEGA D' CONSTANTINA (doble clic en este archivo).
rem  Las ventas y productos quedan guardados. Para prenderlo: iniciar.cmd
rem ===================================================================
cd /d "%~dp0"
echo Apagando el sistema...
docker compose stop
if errorlevel 1 (
  echo No se pudo apagar. Esta abierto Docker Desktop?
  pause
  exit /b 1
)
echo.
echo Sistema apagado. Tus datos quedan guardados.
timeout /t 4 >nul
