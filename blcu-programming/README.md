# BLCU - Programming

FastAPI service that bridges the *Flashing view* in the Control Station and the BLCU hardware board, transferring firmware files over TFTP.

## How it works

```
Control Station (Electron)
        |
        | HTTP  (port 8069)
        v
  api/main.py  (FastAPI)
        |
        | TFTP  (UDP port 69)
        v
  BLCU board @ 192.168.0.27
```

## API endpoints

| Method | Path                | Description                                        |
| :----- | :------------------ | :------------------------------------------------- |
| GET    | `/api/health`       | Health check                                       |
| GET    | `/api/status`       | Board reachability and state machine status        |
| POST   | `/api/flash`        | Flash a firmware file to a specific board          |

## Directory structure

```
blcu-programming/
├── api/
│   ├── main.py          # Entry point, starts uvicorn
│   ├── http_server.py   # FastAPI app and route handlers
│   ├── config.py        # Loads BLCU-config.json
│   ├── board_pinger.py  # Periodically pings boards via UDP
│   ├── tcp_client.py    # Sends flash order to BLCU via TCP
│   └── udp_server.py    # Receives BLCU status updates
├── scripts/
│   ├── setup.mjs        # Cross-platform venv creation and pip install
│   └── run.mjs          # Cross-platform dev runner
├── BLCU-config.json     # Board addresses and API settings
├── requirements.txt     # Runtime Python dependencies
└── requirements-build.txt  # Build-time deps (includes PyInstaller)
```

## Development

Dependencies are managed via a Python virtual environment. `pnpm install` creates and populates it automatically on all platforms (Windows, macOS, Linux).

```bash
# From the repo root — installs all workspaces including this one
pnpm install

# Start only this service
pnpm --filter blcu-programming dev
```

The service starts on `http://127.0.0.1:8069` by default. Override with environment variables:

```bash
BLCU_API_HOST=0.0.0.0 BLCU_API_PORT=9000 pnpm --filter blcu-programming dev
```

## Building the Electron binary

The BLCU service is packaged as a standalone binary with PyInstaller so it can be bundled inside the Electron app without requiring Python on the end-user machine.

```bash
# Build for the current platform (from repo root)
pnpm --filter blcu-programming build

# Or directly via the build script
node electron-app/build.mjs --blcu-programming
```

PyInstaller cannot cross-compile. Run the build on the same OS you are targeting (Windows → `blcu-programming-windows-amd64.exe`, Linux → `blcu-programming-linux-amd64`, etc.). The CI workflow (`release.yaml`) builds all four platform targets in parallel.

The resulting binary is placed in `electron-app/binaries/` and bundled as an `extraResource` by electron-builder.

## Configuration

`BLCU-config.json` is embedded inside the binary at build time. At runtime, environment variables take precedence over the bundled file:

| Variable         | Default     | Description           |
| :--------------- | :---------- | :-------------------- |
| `BLCU_API_HOST`  | `127.0.0.1` | Host to bind to       |
| `BLCU_API_PORT`  | `8069`      | Port to listen on     |
