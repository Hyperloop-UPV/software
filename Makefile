# Hyperloop H10 Control Station Makefile

.PHONY: all install clean build-backend build-common-front build-control-station build-ethernet-view
.PHONY: backend common-front control-station ethernet-view
.PHONY: dev-backend dev-control-station dev-ethernet-view
.PHONY: test test-backend test-frontend
.PHONY: ethernet-view-tmux control-station-tmux

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
RED := \033[0;31m
NC := \033[0m # No Color

# Build directories
BACKEND_DIR := backend
COMMON_FRONT_DIR := common-front
CONTROL_STATION_DIR := control-station
ETHERNET_VIEW_DIR := ethernet-view

# Output binary
BACKEND_BIN := $(BACKEND_DIR)/cmd/backend

# Default target
all: install build

# Install all dependencies
install: install-backend install-frontend
	@echo "$(GREEN)✓ All dependencies installed$(NC)"

install-backend:
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	@cd $(BACKEND_DIR) && go mod download
	@echo "$(GREEN)✓ Backend dependencies installed$(NC)"

install-frontend:
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	@cd $(COMMON_FRONT_DIR) && npm install
	@cd $(CONTROL_STATION_DIR) && npm install
	@cd $(ETHERNET_VIEW_DIR) && npm install
	@echo "$(GREEN)✓ Frontend dependencies installed$(NC)"

# Build all components
build: build-backend build-frontend
	@echo "$(GREEN)✓ All components built successfully$(NC)"

build-frontend: build-common-front build-control-station build-ethernet-view

# Individual build targets
backend build-backend:
	@echo "$(BLUE)Building backend...$(NC)"
	@cd $(BACKEND_DIR)/cmd && go build -o backend
	@echo "$(GREEN)✓ Backend built: $(BACKEND_BIN)$(NC)"

common-front build-common-front:
	@echo "$(BLUE)Building common-front...$(NC)"
	@cd $(COMMON_FRONT_DIR) && npm run build
	@echo "$(GREEN)✓ Common-front built$(NC)"

control-station build-control-station: build-common-front
	@echo "$(BLUE)Building control-station...$(NC)"
	@cd $(CONTROL_STATION_DIR) && npm run build
	@echo "$(GREEN)✓ Control-station built$(NC)"

ethernet-view build-ethernet-view: build-common-front
	@echo "$(BLUE)Building ethernet-view...$(NC)"
	@cd $(ETHERNET_VIEW_DIR) && npm run build
	@echo "$(GREEN)✓ Ethernet-view built$(NC)"

# Development servers (individual)
dev-backend:
	@echo "$(YELLOW)Starting backend development server...$(NC)"
	@cd $(BACKEND_DIR)/cmd && ./backend

dev-control-station:
	@echo "$(YELLOW)Starting control-station development server...$(NC)"
	@cd $(CONTROL_STATION_DIR) && npm run dev

dev-ethernet-view:
	@echo "$(YELLOW)Starting ethernet-view development server...$(NC)"
	@cd $(ETHERNET_VIEW_DIR) && npm run dev

# Testing
test: test-backend test-frontend

test-backend:
	@echo "$(BLUE)Running backend tests...$(NC)"
	@cd $(BACKEND_DIR) && go test -v -timeout 30s ./...

test-frontend:
	@echo "$(BLUE)Running frontend tests...$(NC)"
	@cd $(ETHERNET_VIEW_DIR) && npm test || true
	@echo "$(YELLOW)Note: Only ethernet-view has tests configured$(NC)"

# Clean build artifacts
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -f $(BACKEND_BIN)
	@rm -rf $(COMMON_FRONT_DIR)/dist
	@rm -rf $(CONTROL_STATION_DIR)/dist
	@rm -rf $(ETHERNET_VIEW_DIR)/dist
	@echo "$(GREEN)✓ Clean complete$(NC)"

# Combined tmux sessions
ethernet-view-tmux: build-backend
	@echo "$(BLUE)Starting backend + ethernet-view in tmux...$(NC)"
	@tmux new-session -d -s ethernet-view-session -n main
	@tmux send-keys -t ethernet-view-session:main "cd $(BACKEND_DIR)/cmd && ./backend" C-m
	@tmux split-window -t ethernet-view-session:main -h
	@tmux send-keys -t ethernet-view-session:main.1 "cd $(ETHERNET_VIEW_DIR) && npm run dev" C-m
	@tmux select-pane -t ethernet-view-session:main.0
	@tmux attach-session -t ethernet-view-session

control-station-tmux: build-backend
	@echo "$(BLUE)Starting backend + control-station in tmux...$(NC)"
	@tmux new-session -d -s control-station-session -n main
	@tmux send-keys -t control-station-session:main "cd $(BACKEND_DIR)/cmd && ./backend" C-m
	@tmux split-window -t control-station-session:main -h
	@tmux send-keys -t control-station-session:main.1 "cd $(CONTROL_STATION_DIR) && npm run dev" C-m
	@tmux select-pane -t control-station-session:main.0
	@tmux attach-session -t control-station-session

# Help target
help:
	@echo "Hyperloop H10 Control Station - Build System"
	@echo "==========================================="
	@echo ""
	@echo "$(YELLOW)Installation:$(NC)"
	@echo "  make install              - Install all dependencies"
	@echo "  make install-backend      - Install backend dependencies only"
	@echo "  make install-frontend     - Install frontend dependencies only"
	@echo ""
	@echo "$(YELLOW)Building:$(NC)"
	@echo "  make all                  - Install deps and build everything"
	@echo "  make build                - Build all components"
	@echo "  make backend              - Build backend only"
	@echo "  make common-front         - Build common frontend library"
	@echo "  make control-station      - Build control station"
	@echo "  make ethernet-view        - Build ethernet view"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  make dev-backend          - Run backend dev server"
	@echo "  make dev-control-station  - Run control station dev server"
	@echo "  make dev-ethernet-view    - Run ethernet view dev server"
	@echo ""
	@echo "$(YELLOW)Combined Sessions:$(NC)"
	@echo "  make ethernet-view-tmux   - Run backend + ethernet-view in tmux"
	@echo "  make control-station-tmux - Run backend + control-station in tmux"
	@echo ""
	@echo "$(YELLOW)Testing:$(NC)"
	@echo "  make test                 - Run all tests"
	@echo "  make test-backend         - Run backend tests"
	@echo "  make test-frontend        - Run frontend tests"
	@echo ""
	@echo "$(YELLOW)Maintenance:$(NC)"
	@echo "  make clean                - Remove build artifacts"
	@echo "  make help                 - Show this help message"