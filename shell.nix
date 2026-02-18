{ pkgs ? import <nixpkgs> {} }:

let
  # Pin nixpkgs for reproducibility
  pinnedPkgs = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/nixos-23.11.tar.gz";
    sha256 = "1ndiv385w1qyb3b18vw13991fzb9wg4cl21wglk89grsfsnra41k";
  }) {};

  # Use pinned packages by default
  finalPkgs = if pkgs == import <nixpkgs> {} then pinnedPkgs else pkgs;

in finalPkgs.mkShell {
  name = "hyperloop-h10-dev";

  buildInputs = with finalPkgs; [
    # Go development
    go
    gotools
    gopls
    delve

    # Node.js development
    nodejs_20
    nodePackages.npm
    nodePackages.typescript
    nodePackages.typescript-language-server

    # Python for testing
    python3

    # System dependencies
    libpcap
    pkg-config

    # Build tools
    gnumake
    gcc

    # Development utilities
    git
    ripgrep
    jq
    curl
    wget
    tmux

    # Optional productivity tools (can be removed for minimal setup)
    watchman
  ];

  shellHook = ''
    # Hyperloop H10 Development Environment

    # Set up environment variables
    export GOPATH="$HOME/go"
    export PATH="$GOPATH/bin:$PATH"
    export NODE_ENV="development"
    export CGO_ENABLED=1

    # Create command functions for running services in tmux
    ethernet-view() {
      # Check if backend is built
      if [ ! -f "backend/cmd/backend" ]; then
        echo "Building backend first..."
        make backend
      fi

      # Kill existing session if it exists
      tmux kill-session -t ethernet-view 2>/dev/null || true

      # Create new session
      tmux new-session -d -s ethernet-view -n main

      # Start backend in first pane
      tmux send-keys -t ethernet-view:main "cd backend/cmd && ./backend" C-m

      # Split horizontally and start ethernet-view
      tmux split-window -t ethernet-view:main -h -p 50
      tmux send-keys -t ethernet-view:main.1 "cd ethernet-view && npm run dev" C-m

      # Add status pane at bottom
      tmux split-window -t ethernet-view:main.0 -v -p 20
      tmux send-keys -t ethernet-view:main.2 "echo 'Logs/Status - Press Enter for shell'; read; bash" C-m

      # Configure pane titles
      tmux select-pane -t ethernet-view:main.0 -T "Backend"
      tmux select-pane -t ethernet-view:main.1 -T "Ethernet View (http://localhost:5174)"
      tmux select-pane -t ethernet-view:main.2 -T "Logs/Shell"
      tmux set-option -t ethernet-view pane-border-status top

      echo "Starting ethernet-view session..."
      echo "Backend running on configured port"
      echo "Ethernet View: http://localhost:5174"

      # Attach to session
      tmux attach-session -t ethernet-view
    }

    control-station() {
      # Check if backend is built
      if [ ! -f "backend/cmd/backend" ]; then
        echo "Building backend first..."
        make backend
      fi

      # Kill existing session if it exists
      tmux kill-session -t control-station 2>/dev/null || true

      # Create new session
      tmux new-session -d -s control-station -n main

      # Start backend in first pane
      tmux send-keys -t control-station:main "cd backend/cmd && ./backend" C-m

      # Split horizontally and start control-station
      tmux split-window -t control-station:main -h -p 50
      tmux send-keys -t control-station:main.1 "cd control-station && npm run dev" C-m

      # Add status pane at bottom
      tmux split-window -t control-station:main.0 -v -p 20
      tmux send-keys -t control-station:main.2 "echo 'Logs/Status - Press Enter for shell'; read; bash" C-m

      # Configure pane titles
      tmux select-pane -t control-station:main.0 -T "Backend"
      tmux select-pane -t control-station:main.1 -T "Control Station (http://localhost:5173)"
      tmux select-pane -t control-station:main.2 -T "Logs/Shell"
      tmux set-option -t control-station pane-border-status top

      echo "Starting control-station session..."
      echo "Backend running on configured port"
      echo "Control Station: http://localhost:5173"

      # Attach to session
      tmux attach-session -t control-station
    }

    # Export functions so they're available in the shell
    export -f ethernet-view
    export -f control-station

    # Ensure clean terminal state
    clear

    # Check if dependencies need installation
    check_dependencies() {
      local install_needed=false

      if [ ! -d "common-front/node_modules" ]; then
        echo "⚠️  Missing common-front dependencies"
        install_needed=true
      fi

      if [ ! -d "control-station/node_modules" ]; then
        echo "⚠️  Missing control-station dependencies"
        install_needed=true
      fi

      if [ ! -d "ethernet-view/node_modules" ]; then
        echo "⚠️  Missing ethernet-view dependencies"
        install_needed=true
      fi

      if [ "$install_needed" = true ]; then
        echo ""
        echo "Run 'make install' to install all dependencies"
      fi
    }

    # Display environment info
    echo "Hyperloop H10 Development Environment"
    echo "====================================="
    echo ""
    echo "Environment:"
    echo "  Go version: $(go version | cut -d' ' -f3)"
    echo "  Node version: $(node --version)"
    echo "  NPM version: $(npm --version)"
    echo ""
    echo "Quick Start:"
    echo "  make install        - Install all dependencies"
    echo "  make all           - Build all components"
    echo "  ethernet-view      - Run backend + Ethernet view in tmux"
    echo "  control-station    - Run backend + Control station in tmux"
    echo ""
    echo "Individual Commands:"
    echo "  make backend       - Build backend"
    echo "  make common-front  - Build common frontend library"
    echo "  make control-station - Build control station"
    echo "  make ethernet-view - Build ethernet view"
    echo ""

    check_dependencies
  '';

  # Prevent impurities
  pure = true;

  # Additional environment variables for pure builds
  NIX_ENFORCE_PURITY = 1;
}
