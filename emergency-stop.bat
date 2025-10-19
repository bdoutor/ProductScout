@echo off
setlocal enabledelayedexpansion

REM ========================================
REM  Emergency Stop - Kill Backend Safely
REM  Use this if backend is stuck/looping
REM ========================================

echo ========================================
echo  EMERGENCY STOP - Backend Cleanup
echo ========================================
echo.
echo [WARNING] This will stop ALL processes using port 3001.
echo [WARNING] Other node.exe processes will NOT be affected.
echo.

pause

echo.
echo [INFO] Scanning for processes on port 3001...
echo.

set FOUND_ANY=0

REM Find and display processes using port 3001
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set PID=%%a
    if defined PID (
        set FOUND_ANY=1
        echo [FOUND] Process ID: !PID! is using port 3001

        REM Get process name
        for /f "tokens=1" %%b in ('tasklist /FI "PID eq !PID!" /NH 2^>nul') do (
            echo [INFO] Process name: %%b
        )

        echo [ACTION] Terminating PID !PID!...
        taskkill /F /PID !PID! >nul 2>&1

        if !errorlevel! equ 0 (
            echo [OK] Process !PID! terminated successfully.
        ) else (
            echo [ERROR] Failed to terminate process !PID!
            echo [INFO] You may need administrator privileges.
        )
        echo.
    )
)

if %FOUND_ANY% equ 0 (
    echo [INFO] No processes found using port 3001.
    echo [INFO] Backend may already be stopped.
)

echo.
echo [INFO] Waiting for cleanup...
timeout /t 3 /nobreak >nul

echo.
echo [VERIFICATION] Checking if port 3001 is now free...
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1

if %errorlevel% equ 0 (
    echo [ERROR] Port 3001 is still in use!
    echo.
    echo Current status:
    netstat -ano | findstr ":3001"
    echo.
    echo [RECOMMENDATION] Try these steps:
    echo  1. Close the backend window manually
    echo  2. Restart VS Code
    echo  3. Check Task Manager for stuck processes
) else (
    echo [SUCCESS] Port 3001 is now free!
    echo [OK] Backend stopped successfully.
)

echo.
echo ========================================
echo  Emergency Stop Complete
echo ========================================
echo.

pause
