@echo off
echo.
echo ========================================
echo   ProductScout - Stopping servers...
echo ========================================
echo.

echo Killing Node.js processes...
taskkill /F /IM node.exe /T 2>nul

echo.
echo ProductScout servers stopped!
echo.
pause
