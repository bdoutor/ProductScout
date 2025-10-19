@echo off
echo.
echo ========================================
echo   ProductScout - Starting...
echo ========================================
echo.

echo [1/3] Starting Backend...
cd /d "%~dp0backend"
start "ProductScout Backend" cmd /k "npm run dev"

echo [2/3] Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend...
cd /d "%~dp0frontend"
start "ProductScout Frontend" cmd /k "npm run dev"

echo.
echo Waiting for servers to start...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   Opening ProductScout in browser...
echo ========================================
echo.
start http://localhost:3000

echo.
echo ProductScout is running!
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Press any key to close this window (servers will keep running)
pause >nul
