@echo off
REM ============================================================================
REM ProductScout v2.0 - One-Click Startup Script
REM ============================================================================
echo.
echo ========================================
echo  ProductScout v2.0 - Starting...
echo  Automotive Parts Edition
echo ========================================
echo.

REM Kill any existing processes on ports 3001 and 3000-3002
echo [1/5] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3002" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo    Done!
echo.

REM Wait a moment for ports to be released
ping -n 3 127.0.0.1 >nul

REM Start Backend
echo [2/5] Starting Backend (Port 3001)...
cd backend
start "ProductScout Backend" cmd /c "npm run dev"
cd ..
echo    Backend starting...
echo.

REM Wait for backend to initialize
echo [3/5] Waiting for backend to initialize...
ping -n 6 127.0.0.1 >nul
echo    Done!
echo.

REM Start Frontend
echo [4/5] Starting Frontend (Port 3000)...
cd frontend
start "ProductScout Frontend" cmd /c "npm run dev"
cd ..
echo    Frontend starting...
echo.

REM Wait for frontend to compile
echo [5/5] Waiting for frontend compilation...
ping -n 12 127.0.0.1 >nul
echo    Done!
echo.

echo ========================================
echo  ProductScout v2.0 is READY!
echo ========================================
echo.
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:3000
echo  Login:    http://localhost:3000/login
echo  Admin:    http://localhost:3000/admin
echo.
echo  Login credentials:
echo  - Username: admin
echo  - Password: admin
echo.
echo  Opening browser...
echo ========================================
echo.

REM Open browser to search page
start http://localhost:3000/

echo.
echo Press any key to stop all services...
pause >nul

REM Cleanup on exit
echo.
echo Stopping services...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3002" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Done!
