# BLCU Programming backend that runs behind flashing view
# - Http server to communication with the frontend
# - TFTP client to upload and download files from the BLCU
# - UDP server to receive BLCU status (ADJ)
# - TCP to send the order to the BLCU (ADJ)
# Vasyl Kilimenko, Lola Castillo & Javier Ribal del Río 11
import uvicorn

from api.config import load
import api.board_pinger as board_pinger
import api.udp_server as udp_server


def main() -> None:
    cfg = load()["api"]

    udp_server.start()
    board_pinger.start()

    uvicorn.run(
        "api.http_server:app",
        host=cfg["host"],
        port=cfg["port"],
        log_level=cfg["log_level"],
    )


if __name__ == "__main__":
    main()
