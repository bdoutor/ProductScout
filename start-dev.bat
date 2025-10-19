@echo off
echo ========================================
echo  ProductScout - Development Environment
echo ========================================
echo.

REM Check if node_modules exist
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
echo Starting services...
echo.
echo [1/2] Starting Backend API (http://localhost:3001)...
start "ProductScout Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend (http://localhost:3000)...
start "ProductScout Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo  Services started!
echo ========================================
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:3000
echo ========================================
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak > nul
start http://localhost:3000

echo.
echo Close this window or press Ctrl+C to stop all services.
pause
