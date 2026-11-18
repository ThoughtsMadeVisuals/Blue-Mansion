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

if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Rebuild when the app has been updated since the last build
if [ ! -f "dist/index.html" ] || [ -n "$(find src index.html package.json -newer dist/index.html 2>/dev/null | head -1)" ]; then
  echo "Building the latest version of the app..."
  npm run build || exit 1
fi

echo "Starting The Blue Mansion POS Analytics..."
echo "Keep this window open while using the app. Close it when you're done."
npm run preview -- --port 4173 --open
