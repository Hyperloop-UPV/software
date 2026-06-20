import asyncio
import io
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api.board_pinger import get_board_status
from api.config import load
from api.tcp_client import send_order
from api.udp_server import get_state
from tftp.TftpClient import TftpClient

# Load config and initialise a single shared TFTP client for the process lifetime.
# A threading lock guards it because TFTP is stateful and not thread-safe.
_cfg = load()
_blcu_host: str = _cfg["blcu"]["host"]
_blcu_port: int = _cfg["blcu"]["port"]

_client = TftpClient(_blcu_host, _blcu_port)
_lock = threading.Lock()

app = FastAPI(title="TFTP API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
router = APIRouter(prefix="/api")

LOG_FILE = Path(_cfg["log_file"])

logger = logging.getLogger(__name__)


class DownloadRequest(BaseModel):
    remote_filename: str
    local_path: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/status")
def status() -> dict:
    """Return board connectivity and state-machine snapshot."""
    state = get_state()
    return {
        "boards": get_board_status(),
        "general_state_machine": state.general,
        "operational_state_machine": state.operational,
    }


@router.get("/boards")
def boards() -> list:
    """Return the list of known board names."""
    return list(get_board_status().keys())


@router.get("/health")
def health() -> dict:
    """Liveness probe used by the control station to confirm the API is up."""
    return {
        "status": "ok",
        "service": "tftp-api",
        "timestamp": _utc_now(),
    }


@router.post("/flash")
async def upload_file(file: UploadFile = File(...), board: str = Form(...)) -> dict:
    """Upload a firmware file to the BLCU via TFTP, then trigger a flash.

    The entire upload is serialised with a lock because the underlying TFTP
    client is not safe for concurrent use.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    # read the file
    data = await file.read()
    size_bytes = len(data)

    # TFTP upload
    logger.info(
        "Flash upload started: file=%s size=%d bytes", file.filename, size_bytes
    )

    def _do_upload() -> None:
        with _lock:
            _client.upload(file.filename, io.BytesIO(data))

    t0 = time.monotonic()
    loop = asyncio.get_running_loop()
    try:
        await asyncio.wait_for(loop.run_in_executor(None, _do_upload), timeout=30.0)
    except TimeoutError:
        logger.error("Flash upload timed out after 30 s: file=%s", file.filename)
        raise HTTPException(
            status_code=504, detail="TFTP upload timed out after 30 seconds"
        )
    except Exception as exc:
        logger.error("Flash upload failed: file=%s error=%s", file.filename, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    elapsed_ms = (time.monotonic() - t0) * 1000
    logger.info(
        "Flash upload complete: file=%s size=%d bytes elapsed=%.1f ms",
        file.filename,
        size_bytes,
        elapsed_ms,
    )

    # Send order to flash
    try:
        send_order("Write Program", board)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Failed to send flash order: %s", exc)
        raise HTTPException(status_code=500, detail=f"Order failed: {exc}") from exc

    return {
        "ok": True,
        "message": "Upload complete",
        "filename": file.filename,
        "size_bytes": size_bytes,
    }


@router.post("/download")
def download_file(request: DownloadRequest) -> dict:
    """Download a file from the BLCU via TFTP and save it locally."""
    # Resolve to an absolute path so the response always contains a usable location.
    local_path = Path(request.local_path).expanduser().resolve()
    local_path.parent.mkdir(parents=True, exist_ok=True)

    with _lock:
        try:
            _client.download(request.remote_filename, output=str(local_path))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "ok": True,
        "message": "Download complete",
        "remote_filename": request.remote_filename,
        "local_path": str(local_path),
    }


@router.get("/logs")
def get_logs(tail: int = Query(default=200, ge=1, le=5000)) -> dict:
    """Return the last `tail` lines of the application log file."""
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
