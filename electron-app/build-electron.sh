#!/bin/bash
set -e

echo "Building Hyperloop Control Station Electron App..."

# Get the script directory and move to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ELECTRON_APP_DIR="$SCRIPT_DIR"

cd "$PROJECT_ROOT"

# Create directories (use absolute path)
mkdir -p "$ELECTRON_APP_DIR/binaries"
mkdir -p "$ELECTRON_APP_DIR/renderer"

# Build Go backend for all platforms
echo "Building Go backend..."
cd backend/cmd

echo "  - Windows amd64"
GOOS=windows GOARCH=amd64 CGO_ENABLED=1 go build -o "$ELECTRON_APP_DIR/binaries/backend-windows-amd64.exe" . || echo "Windows build failed (may need cross-compile tools)"

echo "  - Linux amd64"
GOOS=linux GOARCH=amd64 CGO_ENABLED=1 go build -o "$ELECTRON_APP_DIR/binaries/backend-linux-amd64" . || echo "Linux build failed (may need cross-compile tools)"

echo "  - macOS amd64"
GOOS=darwin GOARCH=amd64 CGO_ENABLED=1 go build -o "$ELECTRON_APP_DIR/binaries/backend-darwin-amd64" . || echo "macOS amd64 build failed (may need cross-compile tools)"

echo "  - macOS arm64"
GOOS=darwin GOARCH=arm64 CGO_ENABLED=1 go build -o "$ELECTRON_APP_DIR/binaries/backend-darwin-arm64" . || echo "macOS arm64 build failed (may need cross-compile tools)"

cd "$PROJECT_ROOT"

# Skip Rust packet-sender (has platform-specific issues)
echo "⚠️  Skipping packet-sender build (optional tool)"
echo "   If needed, build manually or get from GitHub Actions"

# Build frontends
echo "Building common-front..."
cd common-front
npm install
npm run build

echo "Building control-station..."
cd ../control-station
npm install
npm run build
rm -rf "$ELECTRON_APP_DIR/renderer/control-station"
cp -r static "$ELECTRON_APP_DIR/renderer/control-station"

echo "Building ethernet-view..."
cd ../ethernet-view
npm install
npm run build
rm -rf "$ELECTRON_APP_DIR/renderer/ethernet-view"
cp -r static "$ELECTRON_APP_DIR/renderer/ethernet-view"

# Install Electron dependencies
echo "Installing Electron dependencies..."
cd "$ELECTRON_APP_DIR"
npm install

echo ""
echo "✅ Build complete!"
echo ""
echo "To run in development: cd electron-app && npm start"
echo "To build installers: cd electron-app && npm run dist"