# BLCU Programming backend that runs behind flashing view
# - Http server to communication with the frontend
# - TFTP client to upload and download files from the BLCU
# - UDP server to receive BLCU status (ADJ)
# - TCP to send the order to the BLCU (ADJ)
# Vasyl Kilimenko, Lola Castillo & Javier Ribal del Río 11
import uvicorn

from api.config import load


def main() -> None:
    cfg = load()["api"]

    uvicorn.run(
        "api.server:app",
        host=cfg["host"],
        port=cfg["port"],
        log_level=cfg["log_level"],
    )


if __name__ == "__main__":
    main()
