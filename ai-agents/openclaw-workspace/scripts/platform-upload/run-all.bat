@echo off
echo =============================================
echo  MAX Platform Upload — Gumroad + itch.io
echo =============================================
echo.

cd /d "Z:\openclaw\workspace\scripts\platform-upload"

echo [1/2] Launching Gumroad upload...
start "Gumroad Upload" cmd /k "node gumroad-playwright.js"

timeout /t 3 /nobreak >nul

echo [2/2] Launching itch.io upload...
start "itch.io Upload" cmd /k "node itchio-playwright.js"

echo.
echo Both upload windows launched.
echo Watch the browser windows — Google may ask for 2FA.
echo Results saved to Z:\openclaw\workspace\gumroad-results.json
pause
