#!/bin/zsh
cd "$(dirname "$0")" || exit 1

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
