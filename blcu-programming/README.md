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

| Method | Path        | Description                          |
| :----- | :---------- | :----------------------------------- |
| GET    | `/health`   | Health check                         |
| POST   | `/upload`   | Send a local firmware file to BLCU   |
| POST   | `/download` | Fetch a file from BLCU to local disk |
| GET    | `/logs`     | Tail the TFTP activity log           |

## Development

Dependencies are managed via a Python virtual environment. `pnpm install` creates and populates it automatically.

```bash
# From the repo root — starts all services including this one
pnpm dev

# Or run only this service
pnpm --filter blcu-programming dev
```

The service starts on `http://127.0.0.1:8069` by default. Override with environment variables:

```bash
BLCU_API_HOST=0.0.0.0 BLCU_API_PORT=9000 pnpm --filter blcu-programming dev
```

## Setup (first time)

```bash
pnpm install   # creates .venv and installs Python deps via postinstall
```
