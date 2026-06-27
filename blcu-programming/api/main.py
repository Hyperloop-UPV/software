# BLCU Programming backend that runs behind flashing view
# - Http server to communication with the frontend
# - TFTP client to upload and download files from the BLCU
# - UDP server to receive BLCU status (ADJ)
# - TCP to send the order to the BLCU (ADJ)
# Vasyl Kilimenko, Lola Castillo & Javier Ribal del Río 11
import os
import uvicorn

from api.config import load
from api.http_server import app
import api.board_pinger as board_pinger
import api.tcp_client as tcp_client
import api.udp_server as udp_server


def main() -> None:
    cfg = load()["api"]

    host = os.environ.get("BLCU_API_HOST", cfg["host"])
    port = int(os.environ.get("BLCU_API_PORT", cfg["port"]))

    udp_server.start()
    board_pinger.start()
    tcp_client.start()

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=cfg["log_level"],
        access_log=False,
    )


if __name__ == "__main__":
    main()
