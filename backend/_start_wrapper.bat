@echo off 
echo ======================================== 
echo  ProductScout Backend Starting... 
echo ======================================== 
echo. 
echo [INFO] Starting development server... 
echo [INFO] Press Ctrl+C to stop the server. 
echo. 
npm run dev 
set EXIT_CODE=%errorlevel% 
echo. 
if %EXIT_CODE% neq 0 ( 
    echo ======================================== 
    echo [FATAL ERROR] Backend crashed 
    echo Exit Code: %EXIT_CODE% 
    echo ======================================== 
    echo. 
    echo Common issues: 
    echo  1. Port 3001 already in use 
    echo  2. Missing dependencies (run npm install) 
    echo  3. TypeScript compilation errors 
    echo  4. Missing .env configuration 
    echo. 
    pause 
) 
