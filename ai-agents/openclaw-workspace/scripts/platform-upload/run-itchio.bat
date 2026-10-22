@echo off
cd /d "Z:\openclaw\workspace\scripts\platform-upload"
echo Starting itch.io upload...
node itchio-playwright.js
pause
