#!/bin/bash
set -e

# Default values - build everything
BUILD_BACKEND=true
BUILD_ETHERNET_VIEW=true
BUILD_CONTROL_STATION=true
BUILD_COMMON_FRONT=true
BACKEND_PLATFORMS=("windows-amd64" "linux-amd64" "darwin-amd64" "darwin-arm64")

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend)
            BUILD_BACKEND=true
            BUILD_ETHERNET_VIEW=false
            BUILD_CONTROL_STATION=false
            BUILD_COMMON_FRONT=false
            shift
            ;;
        --ethernet-view)
            BUILD_BACKEND=false
            BUILD_ETHERNET_VIEW=true
            BUILD_CONTROL_STATION=false
            BUILD_COMMON_FRONT=false
            shift
            ;;
        --control-station)
            BUILD_BACKEND=false
            BUILD_ETHERNET_VIEW=false
            BUILD_CONTROL_STATION=true
            BUILD_COMMON_FRONT=false
            shift
            ;;
        --backend-platform)
            if [[ -z "$2" ]]; then
                echo "Error: --backend-platform requires a value"
                echo "Available platforms: windows-amd64, linux-amd64, darwin-amd64, darwin-arm64, all"
                exit 1
            fi
            if [[ "$2" == "all" ]]; then
                BACKEND_PLATFORMS=("windows-amd64" "linux-amd64" "darwin-amd64" "darwin-arm64")
            else
                BACKEND_PLATFORMS=("$2")
            fi
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backend              Build only the backend"
            echo "  --ethernet-view        Build only ethernet-view frontend"
            echo "  --control-station      Build only control-station frontend"
            echo "  --backend-platform PLATFORM  Build backend for specific platform"
            echo "                         Options: windows-amd64, linux-amd64, darwin-amd64, darwin-arm64, all"
            echo "                         Default: all"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Build everything (default)"
            echo "  $0 --backend                          # Build only backend"
            echo "  $0 --ethernet-view                    # Build only ethernet-view"
            echo "  $0 --backend --backend-platform linux-amd64  # Build only backend for Linux"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "Building Hyperloop Control Station Electron App..."

# Get the script directory and move to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ELECTRON_APP_DIR="$SCRIPT_DIR"

cd "$PROJECT_ROOT"

# Create directories (use absolute path)
mkdir -p "$ELECTRON_APP_DIR/binaries"
mkdir -p "$ELECTRON_APP_DIR/renderer"

# Build Go backend
if [[ "$BUILD_BACKEND" == true ]]; then
    echo "Building Go backend..."
    cd backend/cmd

    for platform in "${BACKEND_PLATFORMS[@]}"; do
        case $platform in
            windows-amd64)
                echo "  - Windows amd64"
                GOOS=windows GOARCH=amd64 CGO_ENABLED=1 go build -o "$ELECTRON_APP_DIR/binaries/backend-windows-amd64.exe" . || echo "Windows build failed (may need cross-compile tools)"
                ;;
            linux-amd64)
                echo "  - Linux amd64"
                GOOS=linux GOARCH=amd64 CGO_ENABLED=1 go build -o "$ELECTRON_APP_DIR/binaries/backend-linux-amd64" . || echo "Linux build failed (may need cross-compile tools)"
                ;;
            darwin-amd64)
                echo "  - macOS amd64"
                GOOS=darwin GOARCH=amd64 CGO_ENABLED=1 go build -o "$ELECTRON_APP_DIR/binaries/backend-darwin-amd64" . || echo "macOS amd64 build failed (may need cross-compile tools)"
                ;;
            darwin-arm64)
                echo "  - macOS arm64"
                GOOS=darwin GOARCH=arm64 CGO_ENABLED=1 go build -o "$ELECTRON_APP_DIR/binaries/backend-darwin-arm64" . || echo "macOS arm64 build failed (may need cross-compile tools)"
                ;;
            *)
                echo "  ⚠️  Unknown platform: $platform"
                ;;
        esac
    done

    cd "$PROJECT_ROOT"
fi

# Skip Rust packet-sender (has platform-specific issues)
if [[ "$BUILD_BACKEND" == true ]]; then
    echo "⚠️  Skipping packet-sender build (optional tool)"
    echo "   If needed, build manually or get from GitHub Actions"
fi

# Build frontends
if [[ "$BUILD_COMMON_FRONT" == true ]]; then
    echo "Building common-front..."
    cd common-front
    npm install
    npm run build
    cd "$PROJECT_ROOT"
fi

if [[ "$BUILD_CONTROL_STATION" == true ]]; then
    echo "Building control-station..."
    cd control-station
    npm install
    npm run build
    rm -rf "$ELECTRON_APP_DIR/renderer/control-station"
    cp -r static "$ELECTRON_APP_DIR/renderer/control-station"
    cd "$PROJECT_ROOT"
fi

if [[ "$BUILD_ETHERNET_VIEW" == true ]]; then
    echo "Building ethernet-view..."
    cd ethernet-view
    npm install
    npm run build
    rm -rf "$ELECTRON_APP_DIR/renderer/ethernet-view"
    cp -r static "$ELECTRON_APP_DIR/renderer/ethernet-view"
    cd "$PROJECT_ROOT"
fi

# Install Electron dependencies (always needed if any frontend is built)
if [[ "$BUILD_ETHERNET_VIEW" == true ]] || [[ "$BUILD_CONTROL_STATION" == true ]]; then
    echo "Installing Electron dependencies..."
    cd "$ELECTRON_APP_DIR"
    npm install
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "To run in development: cd electron-app && npm start"
echo "To build installers: cd electron-app && npm run dist"