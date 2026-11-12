@echo off
rem ===================================================================
rem  Prende BODEGA D' CONSTANTINA (doble clic en este archivo).
rem  1. Abre Docker Desktop si esta cerrado y espera a que este listo.
rem  2. Prende el sistema (base de datos, API, pantallas y copias).
rem  3. Espera a que la API responda y abre la caja en el navegador.
rem ===================================================================
cd /d "%~dp0"

set PUERTO=8080
for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"PUERTO=" .env 2^>nul') do set PUERTO=%%b

docker info >nul 2>&1
if not errorlevel 1 goto prender

echo Abriendo Docker Desktop...
docker desktop start >nul 2>&1
if errorlevel 1 start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"

set /a intentos=0
:esperar_docker
docker info >nul 2>&1
if not errorlevel 1 goto prender
set /a intentos+=1
if %intentos% geq 60 goto sin_docker
timeout /t 3 /nobreak >nul
goto esperar_docker

:prender
echo Prendiendo el sistema...
docker compose up -d
if errorlevel 1 goto error

set /a intentos=0
:esperar_api
curl -s -o nul -f http://localhost:%PUERTO%/api/health
if not errorlevel 1 goto listo
set /a intentos+=1
if %intentos% geq 30 goto error
timeout /t 2 /nobreak >nul
goto esperar_api

:listo
echo.
echo Listo: http://localhost:%PUERTO%
start "" http://localhost:%PUERTO%
timeout /t 4 >nul
exit /b 0

:sin_docker
echo.
echo Docker Desktop no termino de abrir en 3 minutos. Abrelo a mano y vuelve a intentar.
pause
exit /b 1

:error
echo.
echo No se pudo prender el sistema. Revisa los mensajes de arriba
echo o ejecuta en esta carpeta:  docker compose logs api
pause
exit /b 1
