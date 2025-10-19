@echo off
setlocal enabledelayedexpansion

REM ========================================
REM  ProductScout - Stop All Services
REM ========================================

echo ========================================
echo  ProductScout - Stopping Services
echo ========================================
echo.

REM Kill backend on port 3001
echo [INFO] Stopping backend (port 3001)...
set KILLED_BACKEND=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set PID=%%a
    if defined PID (
        echo [INFO] Killing backend process (PID: !PID!)
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Backend stopped.
            set KILLED_BACKEND=1
        )
    )
)

if %KILLED_BACKEND% equ 0 (
    echo [INFO] Backend was not running.
)
echo.

REM Kill frontend on port 3000
echo [INFO] Stopping frontend (port 3000)...
set KILLED_FRONTEND=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    set PID=%%a
    if defined PID (
        echo [INFO] Killing frontend process (PID: !PID!)
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Frontend stopped.
            set KILLED_FRONTEND=1
        )
    )
)

if %KILLED_FRONTEND% equ 0 (
    echo [INFO] Frontend was not running.
)
echo.

echo ========================================
echo  All services stopped!
echo ========================================
echo.
pause
