@echo off
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies for the first time...
  call npm install
)

if not exist "dist" (
  echo Building app for the first time...
  call npm run build
)

echo Starting The Blue Mansion POS Analytics...
echo Keep this window open while using the app. Close it when you're done.
call npm run preview -- --port 4173 --open
