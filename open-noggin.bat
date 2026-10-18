@echo off
setlocal
cd /d "%~dp0"
set "PORTFILE=%~dp0state\active-port.txt"
if not exist "%PORTFILE%" (
  echo NOGGIN has not recorded a running Windows server.
  echo Double-click start-noggin.bat first and leave it open.
  pause
  exit /b 1
)
set /p LIVE_PORT=<"%PORTFILE%"
if not defined LIVE_PORT (
  echo No valid port recorded. Run start-noggin.bat again.
  pause
  exit /b 1
)
echo Opening the last recorded NOGGIN TV address: http://localhost:%LIVE_PORT%/tv/
start "" "http://localhost:%LIVE_PORT%/tv/"
endlocal
