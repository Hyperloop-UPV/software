import logging
import socket
import struct
import threading
from dataclasses import dataclass

from api.config import load

log = logging.getLogger(__name__)

_cfg = load()
_PACKET_CFG = _cfg["packet"]

PACKET_ID: int = _PACKET_CFG["id"]
GENERAL_SM: list[str] = _PACKET_CFG["general_state_machine"]
OPERATIONAL_SM: list[str] = _PACKET_CFG["operational_state_machine"]

# Minimum packet size: 2 bytes ID + 1 byte each enum
_MIN_SIZE = 2 + 1 + 1


@dataclass
class BLCUState:
    general: str = "Unknown"
    operational: str = "Unknown"
    received: bool = False


_state = BLCUState()
_lock = threading.Lock()


def get_state() -> BLCUState:
    with _lock:
        return BLCUState(_state.general, _state.operational, _state.received)


def _parse(data: bytes) -> None:
    if len(data) < _MIN_SIZE:
        log.warning("Packet too short (%d bytes), discarding", len(data))
        return

    packet_id = struct.unpack_from("<H", data, 0)[0]

    if packet_id != PACKET_ID:
        log.info("Packet ID mismatch: received %d, expected %d", packet_id, PACKET_ID)
        return

    general_idx = data[2]
    operational_idx = data[3]

    general = (
        GENERAL_SM[general_idx]
        if general_idx < len(GENERAL_SM)
        else f"Unknown({general_idx})"
    )
    operational = (
        OPERATIONAL_SM[operational_idx]
        if operational_idx < len(OPERATIONAL_SM)
        else f"Unknown({operational_idx})"
    )

    with _lock:
        _state.general = general
        _state.operational = operational
        _state.received = True

    log.info("BLCU state updated: general=%s operational=%s", general, operational)


def _serve(host: str, port: int, stop: threading.Event) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    sock.settimeout(1.0)
    log.info("UDP server listening on %s:%d", host, port)

    while not stop.is_set():
        try:
            data, _ = sock.recvfrom(1500)
            _parse(data)
        except socket.timeout:
            continue
        except Exception:
            log.exception("UDP receive error")

    sock.close()
    log.info("UDP server stopped")


def start() -> threading.Event:
    host: str = "0.0.0.0"
    port: int = _cfg["blcu"]["UDP_PORT_DESTINATION"]
    stop = threading.Event()
    t = threading.Thread(
        target=_serve, args=(host, port, stop), daemon=True, name="udp-server"
    )
    t.start()
    return stop
