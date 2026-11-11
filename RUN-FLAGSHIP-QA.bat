@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "REPORT=%~dp0NOGGIN-FLAGSHIP-QA-RESULTS.txt"
set "FAILED=0"
> "%REPORT%" echo NOGGIN FLAGSHIP - LOCAL QA
>> "%REPORT%" echo =====================================================
>> "%REPORT%" echo Timestamp: %DATE% %TIME%
>> "%REPORT%" echo Working directory: %CD%
>> "%REPORT%" echo Branch required: main or improvement/noggin-flagship
>> "%REPORT%" echo No GitHub merge, push or Render deploy is performed.
>> "%REPORT%" echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not installed.
  set "FAILED=1"
  >> "%REPORT%" echo ERROR: Node.js not installed.
  goto :done
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not installed.
  set "FAILED=1"
  >> "%REPORT%" echo ERROR: npm not installed.
  goto :done
)
where git >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "CURRENT_BRANCH=%%B"
  if defined CURRENT_BRANCH (
    >> "%REPORT%" echo Checked out branch: !CURRENT_BRANCH!
    if /i not "!CURRENT_BRANCH!"=="improvement/noggin-flagship" if /i not "!CURRENT_BRANCH!"=="main" (
      echo ERROR: Checkout main or improvement/noggin-flagship first.
      >> "%REPORT%" echo ERROR: Incorrect Git branch.
      set "FAILED=1"
      goto :done
    )
  )
)
call :run "NODE VERSION" "node --version"
call :run "NPM VERSION" "npm --version"
call :run "INSTALL DEPENDENCIES" "npm install --no-audit --no-fund"
if "!FAILED!"=="1" goto :done
call :run "SYNTAX CHECKS" "npm run check"
call :run "NODE TEST SUITE" "npm test"
call :run "100 MATCH SIMULATION - EVERYONE ROLLS" "node tools\simulate.js 100 auto"
call :run "100 MATCH SIMULATION - SEQUENTIAL" "node tools\simulate.js 100 auto --sequential"
call :run "RELEASE AUDIT" "npm run audit"
:done
>> "%REPORT%" echo.
if "!FAILED!"=="1" (
  echo FAIL: See "%REPORT%"
  >> "%REPORT%" echo RESULT: FAIL - review failing stages above.
) else (
  echo Finished local checks. See "%REPORT%"
  >> "%REPORT%" echo RESULT: ALL EXECUTED STAGES PASSED.
)
echo.
echo Send NOGGIN-FLAGSHIP-QA-RESULTS.txt to ChatGPT.
echo This script does not replace testing the TV and real phones.
pause
exit /b !FAILED!

:run
set "LABEL=%~1"
set "COMMAND=%~2"
echo Running: !LABEL!
>> "%REPORT%" echo.
>> "%REPORT%" echo ==== !LABEL! ====
cmd /d /s /c "!COMMAND!" >> "%REPORT%" 2>&1
if errorlevel 1 (
  set "FAILED=1"
  >> "%REPORT%" echo STAGE RESULT: FAIL
  echo FAILED: !LABEL!
) else (
  >> "%REPORT%" echo STAGE RESULT: PASS
)
exit /b 0
