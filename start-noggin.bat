@echo off
setlocal
cd /d "%~dp0"
echo.
echo  ===================================
echo      NOGGIN - USE YOUR HEAD
echo  ===================================
echo.
where node >nul 2>nul
if errorlevel 1 (
 echo ERROR: Node.js is not installed. Install Node.js LTS from nodejs.org.
 pause
 exit /b 1
)
set NEEDS_INSTALL=0
if not exist "node_modules\express\package.json" set NEEDS_INSTALL=1
if not exist "node_modules\socket.io\package.json" set NEEDS_INSTALL=1
if not exist "node_modules\qrcode\package.json" set NEEDS_INSTALL=1
if "%NEEDS_INSTALL%"=="1" (
 echo First run: installing the three server packages...
 call npm install
 if errorlevel 1 (
  echo Installation failed. Check your internet connection and try again.
  pause
  exit /b 1
 )
)
if not exist "state" mkdir "state"
set "NOGGIN_STATE_FILE=%~dp0state\rooms.json"
if not defined PORT set "PORT=3000"
set "NOGGIN_AUTO_PORT=1"
echo Starting NOGGIN on port %PORT%...
echo If the port is busy, the game will try the next free port.
echo WAIT for the message NOGGIN SERVER IS RUNNING.
echo Then open the exact TV address printed in this window.
echo Leave this black window open while you play.
echo.
node server\index.js
if errorlevel 1 (
 echo The game server stopped with an error.
 pause
)
endlocal
