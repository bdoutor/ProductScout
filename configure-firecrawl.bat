@echo off
echo ========================================
echo  Firecrawl Configuration Helper
echo ========================================
echo.

REM Check if .env file exists
if not exist "backend\.env" (
    echo ERROR: backend\.env file not found!
    echo Please make sure you are running this from the project root.
    pause
    exit /b 1
)

echo Step 1: Opening Firecrawl website...
echo Go to: https://www.firecrawl.dev/
echo.
echo 1. Click "Sign Up" or "Get Started"
echo 2. Create account or login with GitHub/Google
echo 3. Go to Dashboard ^> API Keys
echo 4. Click "Create API Key"
echo 5. Copy the key (format: fc-xxxxxxxxxxxxxxxxxxxxxxxx)
echo.
start https://www.firecrawl.dev/
echo.
echo ========================================
echo.
echo Step 2: Enter your Firecrawl API key
echo.
set /p FIRECRAWL_KEY="Paste your Firecrawl API key here: "

if "%FIRECRAWL_KEY%"=="" (
    echo ERROR: No key provided!
    pause
    exit /b 1
)

echo.
echo Step 3: Updating backend\.env file...

REM Backup original .env
copy backend\.env backend\.env.backup >nul
echo Backup created: backend\.env.backup

REM Update .env file
powershell -Command "(Get-Content backend\.env) -replace '^# FIRECRAWL_API_KEY=.*', 'FIRECRAWL_API_KEY=%FIRECRAWL_KEY%' -replace '^#FIRECRAWL_API_KEY=.*', 'FIRECRAWL_API_KEY=%FIRECRAWL_KEY%' | Set-Content backend\.env"

echo ✓ .env file updated!
echo.

echo Step 4: Testing Firecrawl connection...
echo.

curl -X POST https://api.firecrawl.dev/v0/scrape ^
  -H "Authorization: Bearer %FIRECRAWL_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://www.google.com\"}" ^
  -w "\nHTTP Status: %%{http_code}\n"

echo.
echo ========================================
echo.
echo Configuration complete!
echo.
echo Next steps:
echo 1. Restart the backend server (Ctrl+C then npm run dev)
echo 2. Test a search query
echo 3. Check logs for "Successfully fetched using render fallback"
echo.
echo For detailed instructions, see: FIRECRAWL_SETUP.md
echo.
pause
