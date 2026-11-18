@echo off
title MAX Model Router
echo.
echo  MAX MODEL ROUTER — Starting on port 11435
echo  Status: http://127.0.0.1:11435/status
echo.
cd /d "%~dp0"
node index.js
