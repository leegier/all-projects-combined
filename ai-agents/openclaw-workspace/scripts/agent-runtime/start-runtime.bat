@echo off
title MAX Agent Runtime
echo.
echo  MAX AGENT RUNTIME — SQLite-backed goal executor
echo  Add goals:  python orchestrator.py add "Your goal here"
echo  Stats:      python orchestrator.py stats
echo  Run:        python orchestrator.py
echo.
cd /d "%~dp0"
python orchestrator.py
pause
