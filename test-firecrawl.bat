@echo off
echo ========================================
echo  Firecrawl Test Script
echo ========================================
echo.

REM Load .env file and get FIRECRAWL_API_KEY
for /f "tokens=1,2 delims==" %%a in ('type backend\.env ^| findstr /v "^#" ^| findstr "FIRECRAWL_API_KEY"') do set %%a=%%b

if "%FIRECRAWL_API_KEY%"=="" (
    echo ERROR: FIRECRAWL_API_KEY not found in backend\.env
    echo.
    echo Please run configure-firecrawl.bat first!
    pause
    exit /b 1
)

echo Found API key: %FIRECRAWL_API_KEY:~0,10%...
echo.

echo Test 1: Testing Firecrawl API directly...
echo.
curl -X POST https://api.firecrawl.dev/v0/scrape ^
  -H "Authorization: Bearer %FIRECRAWL_API_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://www.google.com\"}" ^
  --max-time 30 ^
  -w "\n\nHTTP Status: %%{http_code}\n" 2>&1 | findstr /C:"success" /C:"HTTP Status" /C:"error"

echo.
echo ========================================
echo.

echo Test 2: Checking if backend is running...
echo.
curl http://localhost:3001/health --max-time 5 2>nul

if errorlevel 1 (
    echo WARNING: Backend is not running!
    echo Start it with: cd backend ^&^& npm run dev
    echo.
) else (
    echo ✓ Backend is running!
    echo.

    echo Test 3: Testing ProductScout search with fallback...
    echo.
    curl -X POST http://localhost:3001/api/search ^
      -H "Content-Type: application/json" ^
      -d "{\"query\":\"arroz\",\"debug\":false}" ^
      --max-time 60 ^
      -s | findstr /C:"supplier_name" /C:"status" /C:"items_found"
)

echo.
echo ========================================
echo.
echo Tests complete!
echo.
echo Check the backend terminal for detailed logs.
echo You should see messages like:
echo   [Supplier] HTTP blocked, attempting render fallback...
echo   [Supplier] Successfully fetched using render fallback
echo.
pause
