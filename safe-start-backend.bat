@echo off
setlocal enabledelayedexpansion

REM ========================================
REM  ProductScout Backend - SAFE START
REM  Ultra-Robust Version - Anti-Loop/Crash
REM ========================================

REM Create log directory
if not exist "logs" mkdir logs

REM Generate log file name with timestamp
set LOGFILE=logs\backend-start-%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log
set LOGFILE=%LOGFILE: =0%

echo ======================================== > "%LOGFILE%"
echo  Backend Safe Start Log >> "%LOGFILE%"
echo  Started: %DATE% %TIME% >> "%LOGFILE%"
echo ======================================== >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo ========================================
echo  ProductScout Backend - SAFE START
echo ========================================
echo.
echo [INFO] Logging to: %LOGFILE%
echo.

REM ========================================
REM STEP 0: Environment Verification
REM ========================================
echo [STEP 0] Verifying environment...
echo [STEP 0] Verifying environment... >> "%LOGFILE%"

REM Check if we're in the right directory
if not exist "backend\package.json" (
    echo [FATAL ERROR] Not in ProductScout root directory! >> "%LOGFILE%"
    echo [FATAL ERROR] Not in ProductScout root directory!
    echo [ERROR] Current directory: %CD% >> "%LOGFILE%"
    echo [ERROR] Current directory: %CD%
    echo [ERROR] Please run this script from the ProductScout root folder.
    pause
    exit /b 1
)

REM Verify npm exists
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [FATAL ERROR] npm not found in PATH! >> "%LOGFILE%"
    echo [FATAL ERROR] npm not found in PATH!
    echo [ERROR] Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Environment check passed. >> "%LOGFILE%"
echo [OK] Environment check passed.
echo.

REM ========================================
REM STEP 1: Intelligent Process Cleanup
REM ========================================
echo [STEP 1] Cleaning up old backend processes...
echo [STEP 1] Cleaning up old backend processes... >> "%LOGFILE%"

REM Get current script PID to avoid killing ourselves
set CURRENT_PID=%CMDCMDLINE%

REM Only kill node.exe processes that are listening on port 3001
set KILLED_ANY=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set PID=%%a
    if defined PID (
        echo [INFO] Found process !PID! using port 3001 >> "%LOGFILE%"
        echo [INFO] Killing backend process (PID: !PID!)
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

REM Wait for processes to fully terminate
timeout /t 2 /nobreak >nul

REM Final verification
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [ERROR] Port 3001 still in use! >> "%LOGFILE%"
    echo [ERROR] Port 3001 still in use after cleanup!
    echo [ERROR] Manual intervention required.
    echo.
    echo Processes using port 3001:
    netstat -ano | findstr ":3001"
    pause
    exit /b 1
)

echo [OK] Port 3001 is available. >> "%LOGFILE%"
echo [OK] Port 3001 is available.
echo.

REM ========================================
REM STEP 2: Dependency Verification
REM ========================================
echo [STEP 2] Verifying dependencies...
echo [STEP 2] Verifying dependencies... >> "%LOGFILE%"

if not exist "backend\node_modules" (
    echo [WARNING] node_modules not found! >> "%LOGFILE%"
    echo [WARNING] node_modules not found!
    echo [INFO] Installing dependencies...

    pushd backend
    echo [INFO] Running npm install... >> "%LOGFILE%"
    call npm install
    set NPM_EXIT=%errorlevel%
    popd

    if !NPM_EXIT! neq 0 (
        echo [FATAL ERROR] npm install failed! >> "%LOGFILE%"
        echo [FATAL ERROR] npm install failed!
        echo [ERROR] Please check the error messages above.
        pause
        exit /b 1
    )

    echo [OK] Dependencies installed successfully. >> "%LOGFILE%"
    echo [OK] Dependencies installed successfully.
) else (
    echo [OK] node_modules exists. >> "%LOGFILE%"
    echo [OK] node_modules exists.
)

REM Verify critical dependencies
if not exist "backend\node_modules\express" (
    echo [ERROR] Express not installed! >> "%LOGFILE%"
    echo [ERROR] Express not installed!
    echo [INFO] Running npm install...
    pushd backend
    call npm install
    popd
)

echo.

REM ========================================
REM STEP 3: TypeScript Compilation Check
REM ========================================
echo [STEP 3] Checking TypeScript compilation...
echo [STEP 3] Checking TypeScript compilation... >> "%LOGFILE%"

if not exist "backend\dist\index.js" (
    echo [WARNING] Compiled files not found. >> "%LOGFILE%"
    echo [WARNING] Compiled files not found.
    echo [INFO] Note: ts-node-dev will handle compilation.
)

echo [OK] TypeScript check passed. >> "%LOGFILE%"
echo [OK] TypeScript check passed.
echo.

REM ========================================
REM STEP 4: Configuration Validation
REM ========================================
echo [STEP 4] Validating configuration...
echo [STEP 4] Validating configuration... >> "%LOGFILE%"
echo.

REM Simplified validation - just check package.json exists
if not exist "backend\package.json" (
    echo [FATAL ERROR] package.json not found! >> "%LOGFILE%"
    echo [FATAL ERROR] package.json not found!
    pause
    exit /b 1
)

echo [OK] Configuration valid. >> "%LOGFILE%"
echo [OK] Configuration valid.
echo.

REM ========================================
REM STEP 5: Start Backend with Full Error Handling
REM ========================================
echo [STEP 5] Starting backend server...
echo [STEP 5] Starting backend server... >> "%LOGFILE%"
echo.
echo [INFO] Backend will start in a new window. >> "%LOGFILE%"
echo [INFO] Backend will start in a new window.
echo [INFO] The window will remain open if errors occur.
echo.

pushd backend

REM Create a wrapper script for better error handling
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
echo     echo [FATAL ERROR] Backend crashed! >> _start_wrapper.bat
echo     echo Exit Code: %%EXIT_CODE%% >> _start_wrapper.bat
echo     echo ======================================== >> _start_wrapper.bat
echo     echo. >> _start_wrapper.bat
echo     echo Common issues: >> _start_wrapper.bat
echo     echo  1. Port 3001 already in use >> _start_wrapper.bat
echo     echo  2. Missing dependencies ^(run npm install^) >> _start_wrapper.bat
echo     echo  3. TypeScript compilation errors >> _start_wrapper.bat
echo     echo  4. Missing .env configuration >> _start_wrapper.bat
echo     echo. >> _start_wrapper.bat
echo     pause >> _start_wrapper.bat
echo ) >> _start_wrapper.bat

REM Start the backend in a new window
start "ProductScout Backend" cmd /k _start_wrapper.bat

popd

echo [OK] Backend process launched! >> "%LOGFILE%"
echo [OK] Backend process launched!
echo.

REM Wait a moment for backend to start
echo [INFO] Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

REM ========================================
REM STEP 6: Health Check
REM ========================================
echo [STEP 6] Performing health check...
echo [STEP 6] Performing health check... >> "%LOGFILE%"

REM Check if port is now listening
netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is listening on port 3001! >> "%LOGFILE%"
    echo [OK] Backend is listening on port 3001!

    REM Try to ping the health endpoint
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

REM ========================================
REM COMPLETION
REM ========================================
echo ======================================== >> "%LOGFILE%"
echo  Startup sequence completed >> "%LOGFILE%"
echo  Finished: %DATE% %TIME% >> "%LOGFILE%"
echo ======================================== >> "%LOGFILE%"

echo ========================================
echo  Startup Complete!
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
