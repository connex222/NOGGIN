@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 20 or newer first.
  pause
  exit /b 1
)
echo Running NOGGIN code checks and simulated multiplayer rehearsal...
call npm run check
if errorlevel 1 goto failed
call npm test
if errorlevel 1 goto failed
call npm run audit
if errorlevel 1 goto failed
echo.
echo ALL LOCAL AUTOMATED CHECKS PASSED.
echo NOTE: This does not test a live Socket.IO server or real connected phones.
pause
exit /b 0
:failed
echo.
echo A local check FAILED. Copy the error above when reporting a problem.
pause
exit /b 1
