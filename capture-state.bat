@echo off
REM ========================================
REM  Capture System State - Pre/Post Test
REM  Run this BEFORE and AFTER testing
REM ========================================

setlocal enabledelayedexpansion

set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set STATEFILE=logs\system-state-%TIMESTAMP%.log

if not exist "logs" mkdir logs

echo ======================================== > "%STATEFILE%"
echo  System State Snapshot >> "%STATEFILE%"
echo  Captured: %DATE% %TIME% >> "%STATEFILE%"
echo ======================================== >> "%STATEFILE%"
echo. >> "%STATEFILE%"

echo Capturing system state...
echo.

REM Node processes
echo [1/6] Capturing node.exe processes...
echo ========== NODE.EXE PROCESSES ========== >> "%STATEFILE%"
tasklist | findstr /i "node.exe" >> "%STATEFILE%" 2>&1
if %errorlevel% neq 0 (
    echo No node.exe processes running >> "%STATEFILE%"
)
echo. >> "%STATEFILE%"

REM Port 3001 status
echo [2/6] Capturing port 3001 status...
echo ========== PORT 3001 STATUS ========== >> "%STATEFILE%"
netstat -ano | findstr ":3001" >> "%STATEFILE%" 2>&1
if %errorlevel% neq 0 (
    echo Port 3001 is FREE >> "%STATEFILE%"
)
echo. >> "%STATEFILE%"

REM All LISTENING ports
echo [3/6] Capturing all listening ports...
echo ========== ALL LISTENING PORTS ========== >> "%STATEFILE%"
netstat -ano | findstr "LISTENING" >> "%STATEFILE%" 2>&1
echo. >> "%STATEFILE%"

REM Environment
echo [4/6] Capturing environment...
echo ========== ENVIRONMENT ========== >> "%STATEFILE%"
echo Current Directory: %CD% >> "%STATEFILE%"
echo Node Version: >> "%STATEFILE%"
node --version >> "%STATEFILE%" 2>&1
echo npm Version: >> "%STATEFILE%"
npm --version >> "%STATEFILE%" 2>&1
echo. >> "%STATEFILE%"

REM File structure
echo [5/6] Capturing file structure...
echo ========== FILE STRUCTURE ========== >> "%STATEFILE%"
echo backend directory contents: >> "%STATEFILE%"
dir backend >> "%STATEFILE%" 2>&1
echo. >> "%STATEFILE%"

REM Recent logs
echo [6/6] Listing recent logs...
echo ========== RECENT LOGS ========== >> "%STATEFILE%"
if exist "logs" (
    dir logs\*.log /o-d >> "%STATEFILE%" 2>&1
) else (
    echo No logs directory >> "%STATEFILE%"
)
echo. >> "%STATEFILE%"

echo ======================================== >> "%STATEFILE%"
echo  End of snapshot >> "%STATEFILE%"
echo ======================================== >> "%STATEFILE%"

echo.
echo [OK] State captured to: %STATEFILE%
echo.
echo You can now run your test.
echo After the test, run this script again to capture post-test state.
echo.

timeout /t 2 /nobreak >nul
