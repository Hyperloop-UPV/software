import subprocess
import threading

from api.config import load

_cfg = load()
_BOARDS: dict[str, str] = _cfg["adj-data"]

_status: dict[str, bool] = {name: False for name in _BOARDS}
_lock = threading.Lock()

PING_INTERVAL = 60


def get_board_status() -> dict[str, bool]:
    with _lock:
        return dict(_status)


def _ping(ip: str) -> bool:
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "1", ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=3,
        )
        return result.returncode == 0
    except Exception:
        return False


def _ping_all() -> None:
    results = {name: _ping(ip) for name, ip in _BOARDS.items()}
    with _lock:
        _status.update(results)



def _run(stop: threading.Event) -> None:
    while not stop.is_set():
        _ping_all()
        stop.wait(PING_INTERVAL)


def start() -> threading.Event:
    stop = threading.Event()
    t = threading.Thread(target=_run, args=(stop,), daemon=True, name="board-pinger")
    t.start()
    return stop
