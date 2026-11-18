@echo off
REM ============================================================
REM  FRANKENSTINE AUTO-START - All Services (HIDDEN VERSION)
REM  Starts: Ollama, OpenClaw Gateway, Telegram Bot, Discord Bot
REM  All windows run completely hidden - no visible windows
REM ============================================================

set LOGFILE=%USERPROFILE%\auto-start-%date:~10,4%-%date:~4,2%-%date:~7,2%.log
echo [%date% %time%] AUTO-START INITIATED >> "%LOGFILE%"

REM === Wait for system to settle (network, services) ===
echo Waiting for system to settle (20 sec)...
timeout /t 20 /nobreak >nul

REM === Helper: Check if port is listening ===
:checkport
powershell -Command "try { (Test-NetConnection -Port %1 -InformationLevel Quiet) } catch { exit 1 }" 2>nul && exit 0 || exit 1
goto :eof

REM === 1. Ollama - ensure running on port 11434 ===
call :checkport 11434
if errorlevel 1 (
    echo Starting Ollama...
    cscript //nologo "%USERPROFILE%\run-hidden.vbs" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
    echo [%date% %time%] Started Ollama >> "%LOGFILE%"
    timeout /t 8 /nobreak >nul
    REM Verify it's up
    call :checkport 11434
    if errorlevel 1 echo WARNING: Ollama may have failed to start >> "%LOGFILE%"
) else (
    echo Ollama already running on 11434.
)

REM === 2. OpenClaw Gateway - ensure running on port 18789 ===
call :checkport 18789
if errorlevel 1 (
    echo Starting OpenClaw Gateway...
    cd /d E:\openclaw\workspace
    cscript //nologo "%USERPROFILE%\run-hidden.vbs" "cmd" "/c" "openclaw gateway --port 18789"
    echo [%date% %time%] Started OpenClaw Gateway >> "%LOGFILE%"
    timeout /t 5 /nobreak >nul
    REM Verify
    call :checkport 18789
    if errorlevel 1 echo WARNING: OpenClaw Gateway may have failed to start >> "%LOGFILE%"
) else (
    echo OpenClaw Gateway already running on 18789.
)

REM === 3. Telegram Bot (MAX control) ===
echo Starting Telegram Bot...
cd /d E:\openclaw\workspace\scripts
REM Check if already running (by looking for its log)
findstr /i "telegram-bot.js" ..\scripts\telegram-bot.log >nul 2>&1
if errorlevel 1 (
    cscript //nologo "%USERPROFILE%\run-hidden.vbs" "node" "telegram-bot.js"
    echo [%date% %time%] Started Telegram Bot >> "%LOGFILE%"
    timeout /t 3 /nobreak >nul
) else (
    echo Telegram Bot already appears to be running.
)

REM === 4. Discord Mission Control Bot ===
echo Starting Discord Mission Control...
cd /d E:\openclaw\workspace\mission-control
findstr /i "bot.js" ..\mission-control\discord-bot.log >nul 2>&1
if errorlevel 1 (
    cscript //nologo "%USERPROFILE%\run-hidden.vbs" "node" "bot.js"
    echo [%date% %time%] Started Discord Bot >> "%LOGFILE%"
    timeout /t 3 /nobreak >nul
) else (
    echo Discord Bot already appears to be running.
)

echo [%date% %time%] AUTO-START COMPLETED >> "%LOGFILE%"
echo All services launched (hidden).

REM === Optional: Launch Hermes terminal if needed ===
REM start "" "E:\openclaw\workspace\scripts\agent-runtime\hermes-cli.bat"

goto :eof
