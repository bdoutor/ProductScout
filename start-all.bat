@echo off
setlocal enabledelayedexpansion

REM ========================================
REM  ProductScout - Startup Completo
REM  Inicia Backend + Frontend automaticamente
REM ========================================

echo ========================================
echo  ProductScout - Starting...
echo ========================================
echo.

REM Create log directory
if not exist "logs" mkdir logs

REM Generate log file name
set LOGFILE=logs\startup-%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log
set LOGFILE=%LOGFILE: =0%

echo [INFO] Logging to: %LOGFILE%
echo.
echo ======================================== > "%LOGFILE%"
echo  ProductScout Startup Log >> "%LOGFILE%"
echo  Started: %DATE% %TIME% >> "%LOGFILE%"
echo ======================================== >> "%LOGFILE%"
echo. >> "%LOGFILE%"

REM ========================================
REM STEP 1: Verify npm
REM ========================================
echo [STEP 1] Verifying npm...
echo [STEP 1] Verifying npm... >> "%LOGFILE%"
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found! >> "%LOGFILE%"
    echo [ERROR] npm not found in PATH!
    echo [ERROR] Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] npm found. >> "%LOGFILE%"
echo [OK] npm found.
echo.

REM ========================================
REM STEP 2: Check if services are already running
REM ========================================
echo [STEP 2] Checking if services are already running...
echo [STEP 2] Checking if services are already running... >> "%LOGFILE%"

set BACKEND_RUNNING=0
set FRONTEND_RUNNING=0

REM Check if backend is already running
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    set BACKEND_RUNNING=1
    echo [OK] Backend is already running on port 3001. >> "%LOGFILE%"
    echo [OK] Backend is already running on port 3001.
) else (
    echo [INFO] Backend is not running. >> "%LOGFILE%"
    echo [INFO] Backend is not running.
)

REM Check if frontend is already running
netstat -ano 2>nul | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    set FRONTEND_RUNNING=1
    echo [OK] Frontend is already running on port 3000. >> "%LOGFILE%"
    echo [OK] Frontend is already running on port 3000.
) else (
    echo [INFO] Frontend is not running. >> "%LOGFILE%"
    echo [INFO] Frontend is not running.
)

REM If both are running, skip startup
if %BACKEND_RUNNING% equ 1 if %FRONTEND_RUNNING% equ 1 (
    echo [INFO] Both services already running. Skipping startup. >> "%LOGFILE%"
    echo [INFO] Both services already running. Skipping startup.
    goto ALREADY_RUNNING
)

REM If only some services are running, clean up and restart all
if %BACKEND_RUNNING% equ 1 (
    echo [INFO] Backend running but frontend not. Cleaning up... >> "%LOGFILE%"
    echo [INFO] Backend running but frontend not. Cleaning up...
    goto DO_CLEANUP
)

if %FRONTEND_RUNNING% equ 1 (
    echo [INFO] Frontend running but backend not. Cleaning up... >> "%LOGFILE%"
    echo [INFO] Frontend running but backend not. Cleaning up...
    goto DO_CLEANUP
)

REM Neither is running, proceed normally
echo [INFO] No services running. Starting fresh... >> "%LOGFILE%"
echo [INFO] No services running. Starting fresh...
goto SKIP_CLEANUP

:DO_CLEANUP
echo [INFO] Cleaning up old processes... >> "%LOGFILE%"
echo [INFO] Cleaning up old processes...

REM Kill ALL backend processes on port 3001
set KILLED_BACKEND=0
:KILL_BACKEND_LOOP
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set PID=%%a
    if defined PID (
        echo [INFO] Killing backend process (PID: !PID!) >> "%LOGFILE%"
        echo [INFO] Killing backend process (PID: !PID!)
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Backend process !PID! terminated. >> "%LOGFILE%"
            set KILLED_BACKEND=1
        )
    )
)

REM Check if still processes on 3001
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Still processes on 3001, retrying... >> "%LOGFILE%"
    timeout /t 1 /nobreak >nul
    goto KILL_BACKEND_LOOP
)

if %KILLED_BACKEND% equ 1 (
    echo [OK] All backend processes terminated. >> "%LOGFILE%"
    echo [OK] All backend processes terminated.
)

REM Kill ALL frontend processes on port 3000
set KILLED_FRONTEND=0
:KILL_FRONTEND_LOOP
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    set PID=%%a
    if defined PID (
        echo [INFO] Killing frontend process (PID: !PID!) >> "%LOGFILE%"
        echo [INFO] Killing frontend process (PID: !PID!)
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Frontend process !PID! terminated. >> "%LOGFILE%"
            set KILLED_FRONTEND=1
        )
    )
)

REM Check if still processes on 3000
netstat -ano 2>nul | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Still processes on 3000, retrying... >> "%LOGFILE%"
    timeout /t 1 /nobreak >nul
    goto KILL_FRONTEND_LOOP
)

if %KILLED_FRONTEND% equ 1 (
    echo [OK] All frontend processes terminated. >> "%LOGFILE%"
    echo [OK] All frontend processes terminated.
)

REM Extra wait to ensure cleanup
timeout /t 3 /nobreak >nul
echo [OK] Cleanup complete (ports verified free). >> "%LOGFILE%"
echo [OK] Cleanup complete.

:SKIP_CLEANUP
echo.

REM ========================================
REM STEP 3: Verify directories and dependencies
REM ========================================
echo [STEP 3] Verifying directories...
echo [STEP 3] Verifying directories... >> "%LOGFILE%"

if not exist "backend" (
    echo [ERROR] Backend directory not found! >> "%LOGFILE%"
    echo [ERROR] Backend directory not found!
    pause
    exit /b 1
)

if not exist "frontend" (
    echo [ERROR] Frontend directory not found! >> "%LOGFILE%"
    echo [ERROR] Frontend directory not found!
    pause
    exit /b 1
)

echo [OK] Directories verified. >> "%LOGFILE%"
echo [OK] Directories verified.

REM Check backend dependencies
if not exist "backend\node_modules" (
    echo [WARNING] Backend dependencies not found! >> "%LOGFILE%"
    echo [WARNING] Backend dependencies not found! Installing...
    pushd backend
    call npm install
    popd
    echo [OK] Backend dependencies installed. >> "%LOGFILE%"
)

REM Check frontend dependencies
if not exist "frontend\node_modules" (
    echo [WARNING] Frontend dependencies not found! >> "%LOGFILE%"
    echo [WARNING] Frontend dependencies not found! Installing...
    pushd frontend
    call npm install
    popd
    echo [OK] Frontend dependencies installed. >> "%LOGFILE%"
)

echo [OK] All dependencies verified. >> "%LOGFILE%"
echo [OK] All dependencies verified.
echo.

REM ========================================
REM STEP 4: Start Backend (if not already running)
REM ========================================
if %BACKEND_RUNNING% equ 1 (
    echo [STEP 4] Backend already running, skipping...
    echo [STEP 4] Backend already running, skipping... >> "%LOGFILE%"
    goto SKIP_BACKEND
)

echo [STEP 4] Starting backend server...
echo [STEP 4] Starting backend server... >> "%LOGFILE%"

pushd backend

REM Create backend wrapper
echo @echo off > _start_backend.bat
echo title ProductScout Backend >> _start_backend.bat
echo echo ======================================== >> _start_backend.bat
echo echo  ProductScout Backend >> _start_backend.bat
echo echo ======================================== >> _start_backend.bat
echo echo. >> _start_backend.bat
echo npm run dev >> _start_backend.bat

REM Start backend in minimized window
start "ProductScout Backend" /MIN cmd /k _start_backend.bat

popd

echo [OK] Backend starting... >> "%LOGFILE%"
echo [OK] Backend starting...
echo.

REM Wait for backend to initialize
echo [INFO] Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

REM Verify backend is running
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is listening on port 3001! >> "%LOGFILE%"
    echo [OK] Backend is listening on port 3001!
) else (
    echo [WARNING] Backend not yet ready. >> "%LOGFILE%"
    echo [WARNING] Backend not yet ready, continuing...
)
echo.

:SKIP_BACKEND

REM ========================================
REM STEP 5: Start Frontend (if not already running)
REM ========================================
if %FRONTEND_RUNNING% equ 1 (
    echo [STEP 5] Frontend already running, skipping...
    echo [STEP 5] Frontend already running, skipping... >> "%LOGFILE%"
    goto SKIP_FRONTEND
)

echo [STEP 5] Starting frontend...
echo [STEP 5] Starting frontend... >> "%LOGFILE%"

pushd frontend

REM Create frontend wrapper
echo @echo off > _start_frontend.bat
echo title ProductScout Frontend >> _start_frontend.bat
echo echo ======================================== >> _start_frontend.bat
echo echo  ProductScout Frontend >> _start_frontend.bat
echo echo ======================================== >> _start_frontend.bat
echo echo. >> _start_frontend.bat
echo npm run dev >> _start_frontend.bat

REM Start frontend in minimized window
start "ProductScout Frontend" /MIN cmd /k _start_frontend.bat

popd

echo [OK] Frontend starting... >> "%LOGFILE%"
echo [OK] Frontend starting...
echo.

REM ========================================
REM STEP 6: Wait and Open Browser
REM ========================================
echo [STEP 6] Waiting for frontend to initialize...
echo [STEP 6] Waiting for frontend... >> "%LOGFILE%"

REM Wait for frontend to be ready (Next.js takes a bit longer)
REM Loop to check if frontend is ready
set FRONTEND_WAIT=0
set MAX_WAIT=20

:WAIT_FRONTEND
timeout /t 2 /nobreak >nul
set /a FRONTEND_WAIT+=2

netstat -ano 2>nul | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend is listening on port 3000! >> "%LOGFILE%"
    echo [OK] Frontend is listening on port 3000!
    goto OPEN_BROWSER
)

if %FRONTEND_WAIT% LSS %MAX_WAIT% (
    echo [INFO] Waiting... (%FRONTEND_WAIT%s/%MAX_WAIT%s)
    goto WAIT_FRONTEND
)

echo [WARNING] Frontend not ready after %MAX_WAIT% seconds. >> "%LOGFILE%"
echo [WARNING] Frontend not ready after %MAX_WAIT% seconds.
echo [INFO] Will open browser anyway...

:SKIP_FRONTEND
:OPEN_BROWSER
REM Open browser automatically
echo [INFO] Opening browser... >> "%LOGFILE%"
echo [INFO] Opening browser to http://localhost:3000...
start http://localhost:3000

echo.

REM ========================================
REM COMPLETION
REM ========================================
:ALREADY_RUNNING
echo ======================================== >> "%LOGFILE%"
echo  Startup completed >> "%LOGFILE%"
echo  Finished: %DATE% %TIME% >> "%LOGFILE%"
echo ======================================== >> "%LOGFILE%"

echo ========================================
echo  ProductScout Started!
echo ========================================
echo.
echo [OK] Backend:  http://localhost:3001
echo [OK] Frontend: http://localhost:3000
echo.
echo [INFO] Browser should open automatically
echo [INFO] If not, visit: http://localhost:3000
echo.
if %BACKEND_RUNNING% equ 1 if %FRONTEND_RUNNING% equ 1 (
    echo [INFO] Services were already running - no restart needed
) else (
    echo [INFO] Both services are running in minimized windows
    echo [INFO] To stop: Close the terminal windows or run emergency-stop.bat
)
echo.
echo [INFO] Log file: %LOGFILE%
echo.
echo ========================================
echo.

pause
