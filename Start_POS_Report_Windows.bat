@echo off
cd /d "%~dp0"

echo Building the latest version of the app...
call npm install --no-audit --no-fund
call npm run build

echo Starting The Blue Mansion POS Analytics...
echo Keep this window open while using the app. Close it when you're done.
call npm run preview -- --port 4173 --open
