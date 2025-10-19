@echo off
setlocal enabledelayedexpansion

REM ========================================
REM  ProductScout Backend Restart Script
REM  Versão Melhorada - Com Logging Completo
REM ========================================

REM Create log directory
if not exist "logs" mkdir logs

REM Generate log file name with timestamp
set LOGFILE=logs\backend-restart-%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log
set LOGFILE=%LOGFILE: =0%

echo ======================================== > "%LOGFILE%"
echo  Backend Restart Log >> "%LOGFILE%"
echo  Started: %DATE% %TIME% >> "%LOGFILE%"
echo ======================================== >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo ========================================
echo  Restarting Backend - Smart Version
echo ========================================
echo.
echo [INFO] Logging to: %LOGFILE%
echo [INFO] Script started at %TIME%
echo [INFO] Script started at %TIME% >> "%LOGFILE%"
echo.

REM Step 0: Verify npm is available
echo [STEP 0] Verifying npm installation...
echo [STEP 0] Verifying npm installation... >> "%LOGFILE%"
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found in PATH! >> "%LOGFILE%"
    echo [ERROR] npm not found in PATH!
    echo [ERROR] Please ensure Node.js and npm are installed.
    pause
    exit /b 1
)
echo [OK] npm found. >> "%LOGFILE%"
echo [OK] npm found.
echo.

REM Step 1: Smart process cleanup - ONLY port 3001
echo [STEP 1] Cleaning up backend processes on port 3001...
echo [STEP 1] Cleaning up backend processes on port 3001... >> "%LOGFILE%"
set KILLED_ANY=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set PID=%%a
    if defined PID (
        echo [INFO] Found process !PID! using port 3001 >> "%LOGFILE%"
        echo [INFO] Found process !PID! using port 3001
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Process !PID! terminated. >> "%LOGFILE%"
            echo [OK] Process !PID! terminated.
            set KILLED_ANY=1
        ) else (
            echo [WARNING] Could not kill process !PID! >> "%LOGFILE%"
            echo [WARNING] Could not kill process !PID!
        )
    )
)

if %KILLED_ANY% equ 0 (
    echo [INFO] No backend processes to clean up. >> "%LOGFILE%"
    echo [INFO] No backend processes to clean up.
)

REM Wait for cleanup
timeout /t 2 /nobreak >nul
echo [OK] Port 3001 is available. >> "%LOGFILE%"
echo [OK] Port 3001 is available.
echo.

REM Step 2: Verify directories
echo [STEP 2] Verifying backend directory...
echo [STEP 2] Verifying backend directory... >> "%LOGFILE%"
if not exist "backend" (
    echo [ERROR] Backend directory not found! >> "%LOGFILE%"
    echo [ERROR] Backend directory not found!
    echo [ERROR] Current directory: %CD% >> "%LOGFILE%"
    echo [ERROR] Current directory: %CD%
    pause
    exit /b 1
)
if not exist "backend\package.json" (
    echo [ERROR] package.json not found! >> "%LOGFILE%"
    echo [ERROR] package.json not found in backend directory!
    pause
    exit /b 1
)
echo [OK] Backend directory and package.json found. >> "%LOGFILE%"
echo [OK] Backend directory and package.json found.
echo.

REM Step 3: Double-check port 3001
echo [STEP 3] Final port verification...
echo [STEP 3] Final port verification... >> "%LOGFILE%"
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Port 3001 still in use! >> "%LOGFILE%"
    echo [WARNING] Port 3001 still in use after Step 1!
    echo [INFO] Attempting final cleanup... >> "%LOGFILE%"
    echo [INFO] Attempting final cleanup...

    REM Get PIDs using port 3001 and kill them one by one
    set KILLED_COUNT=0
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
        set PID=%%a
        if defined PID (
            echo [INFO] Killing process ID: !PID! >> "%LOGFILE%"
            echo [INFO] Killing process ID: !PID!
            taskkill /F /PID !PID! >nul 2>&1
            if !errorlevel! equ 0 (
                echo [OK] Process !PID! terminated. >> "%LOGFILE%"
                echo [OK] Process !PID! terminated.
                set /a KILLED_COUNT+=1
            ) else (
                echo [WARNING] Could not kill process !PID! >> "%LOGFILE%"
                echo [WARNING] Could not kill process !PID! - may not exist.
            )
        )
    )

    if !KILLED_COUNT! gtr 0 (
        echo [INFO] Killed !KILLED_COUNT! process(es). Waiting... >> "%LOGFILE%"
        echo [INFO] Killed !KILLED_COUNT! process(es). Waiting for cleanup...
        timeout /t 3 /nobreak >nul
    )

    REM Verify port is free
    netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [ERROR] Port 3001 still in use after cleanup! >> "%LOGFILE%"
        echo [ERROR] Port 3001 still in use after cleanup!
        echo [ERROR] Current processes on port 3001: >> "%LOGFILE%"
        echo [ERROR] Current processes on port 3001:
        netstat -ano | findstr ":3001" >> "%LOGFILE%"
        netstat -ano | findstr ":3001"
        echo.
        echo [ERROR] Please manually close the application using port 3001.
        echo [INFO] Or run emergency-stop.bat
        pause
        exit /b 1
    )
    echo [OK] Port 3001 is now available. >> "%LOGFILE%"
    echo [OK] Port 3001 is now available.
) else (
    echo [OK] Port 3001 is available. >> "%LOGFILE%"
    echo [OK] Port 3001 is available.
)
echo.

REM Step 4: Verify dependencies
echo [STEP 4] Checking node_modules...
echo [STEP 4] Checking node_modules... >> "%LOGFILE%"
if not exist "backend\node_modules" (
    echo [WARNING] node_modules not found! >> "%LOGFILE%"
    echo [WARNING] node_modules not found! Running npm install...
    pushd backend
    if %errorlevel% neq 0 (
        echo [ERROR] Could not change to backend directory! >> "%LOGFILE%"
        echo [ERROR] Could not change to backend directory!
        pause
        exit /b 1
    )

    echo [INFO] Installing dependencies... >> "%LOGFILE%"
    echo [INFO] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed! >> "%LOGFILE%"
        echo [ERROR] npm install failed!
        popd
        pause
        exit /b 1
    )

    popd
    echo [OK] Dependencies installed. >> "%LOGFILE%"
    echo [OK] Dependencies installed.
) else (
    echo [OK] node_modules exists. >> "%LOGFILE%"
    echo [OK] node_modules exists.
)
echo.

REM Step 5: Start backend using safe method
echo [STEP 5] Starting backend...
echo [STEP 5] Starting backend... >> "%LOGFILE%"
pushd backend
if %errorlevel% neq 0 (
    echo [ERROR] Could not change to backend directory! >> "%LOGFILE%"
    echo [ERROR] Could not change to backend directory!
    pause
    exit /b 1
)

echo [INFO] Current directory: %CD% >> "%LOGFILE%"
echo [INFO] Current directory: %CD%
echo [INFO] Creating startup wrapper... >> "%LOGFILE%"
echo [INFO] Creating startup wrapper...
echo.

REM Create wrapper script (same as safe-start)
echo @echo off > _start_wrapper.bat
echo echo ======================================== >> _start_wrapper.bat
echo echo  ProductScout Backend Starting... >> _start_wrapper.bat
echo echo ======================================== >> _start_wrapper.bat
echo echo. >> _start_wrapper.bat
echo echo [INFO] Starting development server... >> _start_wrapper.bat
echo echo [INFO] Press Ctrl+C to stop the server. >> _start_wrapper.bat
echo echo. >> _start_wrapper.bat
echo npm run dev >> _start_wrapper.bat
echo set EXIT_CODE=%%errorlevel%% >> _start_wrapper.bat
echo echo. >> _start_wrapper.bat
echo if %%EXIT_CODE%% neq 0 ( >> _start_wrapper.bat
echo     echo ======================================== >> _start_wrapper.bat
echo     echo [ERROR] Backend crashed! >> _start_wrapper.bat
echo     echo Exit Code: %%EXIT_CODE%% >> _start_wrapper.bat
echo     echo ======================================== >> _start_wrapper.bat
echo     echo. >> _start_wrapper.bat
echo     pause >> _start_wrapper.bat
echo ) >> _start_wrapper.bat

REM Start backend in new window
start "ProductScout Backend" cmd /k _start_wrapper.bat

popd

echo [OK] Backend process launched! >> "%LOGFILE%"
echo [OK] Backend process launched!
echo.
echo [INFO] Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

REM Health check
echo [STEP 6] Performing health check...
echo [STEP 6] Performing health check... >> "%LOGFILE%"
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is listening on port 3001! >> "%LOGFILE%"
    echo [OK] Backend is listening on port 3001!

    curl -s http://localhost:3001/health >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Health check endpoint responding! >> "%LOGFILE%"
        echo [OK] Health check endpoint responding!
    ) else (
        echo [WARNING] Port open but health check failed. >> "%LOGFILE%"
        echo [WARNING] Port open but health check failed.
        echo [INFO] Backend may still be initializing...
    )
) else (
    echo [WARNING] Backend not yet listening on port 3001. >> "%LOGFILE%"
    echo [WARNING] Backend not yet listening on port 3001.
    echo [INFO] Check the backend window for errors.
)

echo.
echo ======================================== >> "%LOGFILE%"
echo  Restart sequence completed >> "%LOGFILE%"
echo  Finished: %DATE% %TIME% >> "%LOGFILE%"
echo ======================================== >> "%LOGFILE%"

echo ========================================
echo  Restart Complete!
echo ========================================
echo.
echo [INFO] Backend window is open.
echo [INFO] Log file: %LOGFILE%
echo.
echo Quick links:
echo  - Backend:      http://localhost:3001
echo  - Health check: http://localhost:3001/health
echo  - API search:   http://localhost:3001/api/search
echo.
echo ========================================
echo.
pause
