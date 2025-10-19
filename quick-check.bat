@echo off
REM ========================================
REM  Quick Health Check - Backend Status
REM ========================================

echo ========================================
echo  Backend Quick Health Check
echo ========================================
echo.

REM Check if backend is running
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1

if %errorlevel% equ 0 (
    echo [STATUS] Backend is RUNNING on port 3001
    echo.

    REM Get PID
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
        echo [INFO] Process ID: %%a
    )

    echo.
    echo [TEST] Checking health endpoint...

    curl -s http://localhost:3001/health 2>nul
    if !errorlevel! equ 0 (
        echo.
        echo [OK] Health endpoint is responding!
    ) else (
        echo [WARNING] Health endpoint not responding
        echo [INFO] Backend may still be starting up
    )

) else (
    echo [STATUS] Backend is NOT RUNNING
    echo.
    echo [INFO] Port 3001 is available
    echo [INFO] Run safe-start-backend.bat to start
)

echo.
echo ========================================
timeout /t 3 /nobreak >nul
