@echo off
setlocal enabledelayedexpansion

REM ========================================
REM  Restart APENAS Backend (mantém frontend)
REM ========================================

echo ========================================
echo  Restarting Backend Only...
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

REM Wait for cleanup
timeout /t 2 /nobreak >nul
echo.

REM Start backend
echo [INFO] Starting backend...
pushd backend

REM Create backend wrapper
echo @echo off > _restart_backend.bat
echo title ProductScout Backend - Restarted >> _restart_backend.bat
echo echo ======================================== >> _restart_backend.bat
echo echo  ProductScout Backend - Restarted >> _restart_backend.bat
echo echo ======================================== >> _restart_backend.bat
echo echo. >> _restart_backend.bat
echo npm run dev >> _restart_backend.bat

REM Start backend in new window
start "ProductScout Backend" cmd /k _restart_backend.bat

popd

echo [OK] Backend restarting...
echo.
echo [INFO] Waiting for backend...
timeout /t 5 /nobreak >nul

REM Check backend
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is running on port 3001!

    REM Try health check
    curl -s http://localhost:3001/health >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Health check passed!
    )
) else (
    echo [WARNING] Backend not yet ready.
    echo [INFO] Check the backend window for errors.
)

echo.
echo ========================================
echo  Backend Restart Complete!
echo ========================================
echo.
echo [INFO] Frontend still running on port 3000
echo [INFO] Backend restarted on port 3001
echo.
echo Try your search again now!
echo.
pause
