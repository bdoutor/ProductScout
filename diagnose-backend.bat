@echo off
setlocal enabledelayedexpansion

REM ========================================
REM  ProductScout Backend Diagnostic Tool
REM  Use this to troubleshoot backend issues
REM ========================================

echo ========================================
echo  Backend Diagnostic Tool
echo ========================================
echo.
echo [INFO] Running diagnostics at %TIME% on %DATE%
echo.

REM Create log file
set LOGFILE=backend-diagnostics-%DATE:~-4%-%DATE:~3,2%-%DATE:~0,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log
set LOGFILE=%LOGFILE: =0%
echo Diagnostic Report > "%LOGFILE%"
echo Generated: %DATE% %TIME% >> "%LOGFILE%"
echo ======================================== >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo ========================================
echo 1. System Information
echo ========================================
echo.

echo [CHECK] Operating System...
ver
ver >> "%LOGFILE%"
echo.

echo [CHECK] Node.js version...
where node >nul 2>&1
if %errorlevel% equ 0 (
    node --version
    echo Node.js: >> "%LOGFILE%"
    node --version >> "%LOGFILE%"
    echo [OK] Node.js found.
) else (
    echo [ERROR] Node.js NOT found in PATH!
    echo Node.js: NOT FOUND >> "%LOGFILE%"
)
echo.

echo [CHECK] npm version...
where npm >nul 2>&1
if %errorlevel% equ 0 (
    npm --version
    echo npm: >> "%LOGFILE%"
    npm --version >> "%LOGFILE%"
    echo [OK] npm found.
) else (
    echo [ERROR] npm NOT found in PATH!
    echo npm: NOT FOUND >> "%LOGFILE%"
)
echo.

echo ========================================
echo 2. Directory Structure
echo ========================================
echo.

echo [CHECK] Current directory...
echo Current directory: %CD%
echo Current directory: %CD% >> "%LOGFILE%"
echo.

echo [CHECK] Backend directory...
if exist "backend" (
    echo [OK] backend\ directory exists
    echo backend\ directory: EXISTS >> "%LOGFILE%"
) else (
    echo [ERROR] backend\ directory NOT found!
    echo backend\ directory: NOT FOUND >> "%LOGFILE%"
)
echo.

echo [CHECK] Backend files...
if exist "backend\package.json" (
    echo [OK] backend\package.json exists
    echo backend\package.json: EXISTS >> "%LOGFILE%"
) else (
    echo [ERROR] backend\package.json NOT found!
    echo backend\package.json: NOT FOUND >> "%LOGFILE%"
)

if exist "backend\index.ts" (
    echo [OK] backend\index.ts exists
    echo backend\index.ts: EXISTS >> "%LOGFILE%"
) else (
    echo [ERROR] backend\index.ts NOT found!
    echo backend\index.ts: NOT FOUND >> "%LOGFILE%"
)

if exist "backend\node_modules" (
    echo [OK] backend\node_modules exists
    echo backend\node_modules: EXISTS >> "%LOGFILE%"
) else (
    echo [WARNING] backend\node_modules NOT found - run npm install!
    echo backend\node_modules: NOT FOUND >> "%LOGFILE%"
)
echo.

echo ========================================
echo 3. Running Processes
echo ========================================
echo.

echo [CHECK] Node.js processes...
echo Node.js processes: >> "%LOGFILE%"
tasklist | findstr /i "node.exe"
if %errorlevel% equ 0 (
    tasklist | findstr /i "node.exe" >> "%LOGFILE%"
    echo [WARNING] Node.js processes are running!
) else (
    echo [OK] No Node.js processes running.
    echo None running >> "%LOGFILE%"
)
echo.

echo ========================================
echo 4. Port Usage
echo ========================================
echo.

echo [CHECK] Port 3001 status...
echo Port 3001 status: >> "%LOGFILE%"
netstat -ano | findstr ":3001"
if %errorlevel% equ 0 (
    netstat -ano | findstr ":3001" >> "%LOGFILE%"
    echo [WARNING] Port 3001 is in use!

    echo.
    echo [INFO] Process details for port 3001:
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
        set PID=%%a
        if defined PID (
            echo PID: !PID!
            tasklist /FI "PID eq !PID!" /V
        )
    )
) else (
    echo [OK] Port 3001 is available.
    echo Available >> "%LOGFILE%"
)
echo.

echo ========================================
echo 5. Backend Configuration
echo ========================================
echo.

if exist "backend\package.json" (
    echo [CHECK] package.json scripts...
    echo package.json scripts: >> "%LOGFILE%"
    findstr /C:"\"scripts\"" /C:"\"dev\"" backend\package.json
    findstr /C:"\"scripts\"" /C:"\"dev\"" backend\package.json >> "%LOGFILE%"
) else (
    echo [ERROR] Cannot check package.json - file not found!
)
echo.

if exist "backend\.env" (
    echo [OK] .env file exists
    echo .env: EXISTS >> "%LOGFILE%"
) else (
    echo [WARNING] .env file NOT found (might be optional)
    echo .env: NOT FOUND >> "%LOGFILE%"
)
echo.

echo ========================================
echo 6. Network Connectivity
echo ========================================
echo.

echo [CHECK] Testing localhost connectivity...
ping -n 1 127.0.0.1 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Localhost is reachable
    echo Localhost: OK >> "%LOGFILE%"
) else (
    echo [ERROR] Cannot reach localhost!
    echo Localhost: ERROR >> "%LOGFILE%"
)
echo.

echo ========================================
echo 7. Disk Space
echo ========================================
echo.

echo [CHECK] Available disk space...
echo Disk space: >> "%LOGFILE%"
wmic logicaldisk get name,freespace,size | findstr "C:"
wmic logicaldisk get name,freespace,size | findstr "C:" >> "%LOGFILE%"
echo.

echo ========================================
echo Diagnostic Summary
echo ========================================
echo.
echo [INFO] Full diagnostic report saved to: %LOGFILE%
echo.
echo [INFO] Common issues and solutions:
echo.
echo  1. Node.js not found:
echo     - Install Node.js from https://nodejs.org
echo     - Add Node.js to system PATH
echo.
echo  2. Port 3001 in use:
echo     - Run restart-backend.bat to auto-cleanup
echo     - Or manually kill process using Task Manager
echo.
echo  3. node_modules missing:
echo     - Run: cd backend ^&^& npm install
echo.
echo  4. Backend crashes immediately:
echo     - Check .env file configuration
echo     - Check package.json scripts section
echo     - Run: cd backend ^&^& npm run dev manually
echo.
echo ========================================
echo.

pause
