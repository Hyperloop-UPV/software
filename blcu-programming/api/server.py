from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from api.config import load
from tftp.TftpClient import TftpClient

_cfg = load()
_blcu_host: str = _cfg["blcu"]["host"]
_blcu_port: int = _cfg["blcu"]["port"]

app = FastAPI(title="TFTP API", version="0.1.0")
router = APIRouter(prefix="/api")

LOG_FILE = Path(_cfg["log_file"])


class TransferRequest(BaseModel):
    remote_filename: str
    local_path: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "tftp-api",
        "timestamp": _utc_now(),
    }


@router.post("/upload")
def upload_file(request: TransferRequest) -> dict:
    local_path = Path(request.local_path).expanduser().resolve()
    if not local_path.exists() or not local_path.is_file():
        raise HTTPException(status_code=400, detail="local_path must be an existing file")

    client = TftpClient(_blcu_host, _blcu_port)

    try:
        with local_path.open("rb") as file_handle:
            client.upload(request.remote_filename, file_handle)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "ok": True,
        "message": "Upload complete",
        "host": _blcu_host,
        "port": _blcu_port,
        "remote_filename": request.remote_filename,
        "local_path": str(local_path),
    }


@router.post("/download")
def download_file(request: TransferRequest) -> dict:
    local_path = Path(request.local_path).expanduser().resolve()
    local_path.parent.mkdir(parents=True, exist_ok=True)

    client = TftpClient(_blcu_host, _blcu_port)

    try:
        client.download(request.remote_filename, output=str(local_path))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "ok": True,
        "message": "Download complete",
        "host": _blcu_host,
        "port": _blcu_port,
        "remote_filename": request.remote_filename,
        "local_path": str(local_path),
    }


@router.get("/logs")
def get_logs(tail: int = Query(default=200, ge=1, le=5000)) -> dict:
    if not LOG_FILE.exists():
        return {"path": str(LOG_FILE), "lines": [], "line_count": 0}

    lines = LOG_FILE.read_text(encoding="utf-8", errors="replace").splitlines()
    selected_lines = lines[-tail:]

    return {
        "path": str(LOG_FILE.resolve()),
        "lines": selected_lines,
        "line_count": len(selected_lines),
    }


app.include_router(router)
