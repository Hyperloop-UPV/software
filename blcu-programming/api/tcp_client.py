import logging
import socket
import struct
import threading

from api.config import load

log = logging.getLogger(__name__)

_cfg = load()
_host: str = _cfg["blcu"]["host"]
_port: int = _cfg["blcu"]["TCP_PORT_SERVER"]
_ORDERS: dict[str, dict] = _cfg["orders"]

_RECONNECT_DELAY = 5.0

_sock: socket.socket | None = None
_sock_lock = threading.Lock()


def send(data: bytes) -> None:
    """Send raw bytes to the BLCU. Raises RuntimeError if not connected."""
    with _sock_lock:
        if _sock is None:
            raise RuntimeError("TCP connection to BLCU is not established")
        _sock.sendall(data)


def send_order(order_name: str, board_name: str) -> None:
    """Build and send an order packet to the BLCU.

    Protocol (little-endian):
      [uint16 order_id] [uint8 board_enum]
    where board_enum is the index of board_name in the order's enum-order list.
    """
    order = _ORDERS[order_name]
    order_id = int(order["id"])
    enum = order["enum-order"]
    if board_name not in enum:
        raise ValueError(f"Board '{board_name}' cannot be flashed with '{order_name}'. Valid boards: {', '.join(enum)}")
    board_idx = enum.index(board_name)
    packet = struct.pack("<HB", order_id, board_idx)
    send(packet)
    log.info("Sent order: %s(%d) board=%s(%d)", order_name, order_id, board_name, board_idx)


def _run(host: str, port: int, stop: threading.Event) -> None:
    global _sock

    while not stop.is_set():
        log.info("Connecting to BLCU TCP at %s:%d", host, port)
        try:
            conn = socket.create_connection((host, port))
        except OSError as exc:
            log.warning("TCP connection failed: %s — retrying in %.0f s", exc, _RECONNECT_DELAY)
            stop.wait(_RECONNECT_DELAY)
            continue

        log.info("TCP connection to BLCU established")
        with _sock_lock:
            _sock = conn

        # Wait until the connection drops or stop is requested.
        conn.settimeout(1.0)
        while not stop.is_set():
            try:
                # Detect a closed connection without reading payload.
                if not conn.recv(1, socket.MSG_PEEK):
                    break
            except socket.timeout:
                continue
            except OSError:
                break

        with _sock_lock:
            _sock = None
        conn.close()
        log.info("TCP connection closed")

        if not stop.is_set():
            log.info("Reconnecting in %.0f s", _RECONNECT_DELAY)
            stop.wait(_RECONNECT_DELAY)

    log.info("TCP client stopped")


def start() -> threading.Event:
    stop = threading.Event()
    threading.Thread(
        target=_run, args=(_host, _port, stop), daemon=True, name="tcp-client"
    ).start()
    return stop
