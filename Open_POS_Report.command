#!/bin/zsh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/package.json" ]; then
  cd "$SCRIPT_DIR" || exit 1
elif [ -d "/Users/vinceong/Desktop/Antigravity/Bluemansion" ]; then
  cd "/Users/vinceong/Desktop/Antigravity/Bluemansion" || exit 1
else
  echo "Error: Could not find the project folder. Keep Open_POS_Report.command inside the Blue-Mansion folder."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies for the first time..."
  npm install
fi

if [ ! -d "dist" ]; then
  echo "Building app for the first time..."
  npm run build
fi

echo "Starting The Blue Mansion POS Analytics..."
echo "Keep this window open while using the app. Close it when you're done."
npm run preview -- --port 4173 --open
